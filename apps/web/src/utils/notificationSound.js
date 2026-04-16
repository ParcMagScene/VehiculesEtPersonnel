/**
 * Système audio & feedback via Web Audio API
 * Sons synthétiques, vibration, volume global
 */

let audioCtx = null;
let masterVolume = 0.7; // 0..1

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
};

/** Régler le volume global (0..1) */
export const setVolume = (v) => {
  masterVolume = Math.max(0, Math.min(1, v));
};
export const getVolume = () => masterVolume;

// ── Helpers internes ──────────────────────────────────────────
const note = (ctx, freq, start, dur, vol, type = 'sine') => {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(vol * masterVolume, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur);
};

// ── Sons disponibles ──────────────────────────────────────────

/** Arpège ascendant Do-Mi-Sol (son original de message) */
const playNotification = (ctx, t) => {
  note(ctx, 523, t, 0.15, 0.15);
  note(ctx, 659, t + 0.1, 0.2, 0.15);
  note(ctx, 784, t + 0.2, 0.25, 0.12);
};

/** Accord majeur bref — confirmation positive */
const playSuccess = (ctx, t) => {
  note(ctx, 523, t, 0.12, 0.12); // Do5
  note(ctx, 659, t, 0.12, 0.1); // Mi5
  note(ctx, 784, t, 0.12, 0.1); // Sol5
  note(ctx, 1047, t + 0.1, 0.2, 0.08); // Do6 résolution
};

/** Deux notes descendantes — erreur / échec */
const playError = (ctx, t) => {
  note(ctx, 440, t, 0.15, 0.18, 'square'); // La4
  note(ctx, 349, t + 0.15, 0.25, 0.14, 'square'); // Fa4
};

/** Deux bips courts — attention */
const playWarning = (ctx, t) => {
  note(ctx, 880, t, 0.08, 0.12, 'triangle');
  note(ctx, 880, t + 0.15, 0.08, 0.12, 'triangle');
};

/** Micro-clic UI */
const playClick = (ctx, t) => {
  note(ctx, 1200, t, 0.03, 0.06, 'sine');
};

/** Son de suppression — balayage descendant */
const playDelete = (ctx, t) => {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.2);
  g.gain.setValueAtTime(0.12 * masterVolume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.25);
};

const SOUNDS = {
  notification: playNotification,
  success: playSuccess,
  error: playError,
  warning: playWarning,
  click: playClick,
  delete: playDelete,
};

export const SOUND_TYPES = Object.keys(SOUNDS);

/**
 * Joue un son par type
 * @param {'notification'|'success'|'error'|'warning'|'click'|'delete'} type
 */
export const playSound = (type = 'notification') => {
  try {
    const fn = SOUNDS[type] || SOUNDS.notification;
    const ctx = getAudioContext();
    fn(ctx, ctx.currentTime);
  } catch (e) {
    console.warn('Son indisponible:', e.message);
  }
};

/** Rétro-compatibilité */
export const playNotificationSound = () => playSound('notification');

// ── Vibration ─────────────────────────────────────────────────
const VIBRATION_PATTERNS = {
  notification: [100, 50, 100],
  success: [50],
  error: [100, 30, 100, 30, 100],
  warning: [80, 40, 80],
  click: [15],
  delete: [40, 20, 40],
};

/**
 * Vibration haptique (mobile uniquement)
 * @param {'notification'|'success'|'error'|'warning'|'click'|'delete'} type
 */
export const vibrate = (type = 'notification') => {
  if (navigator.vibrate) {
    navigator.vibrate(VIBRATION_PATTERNS[type] || VIBRATION_PATTERNS.notification);
  }
};

/**
 * Feedback combiné : son + vibration
 * @param {'notification'|'success'|'error'|'warning'|'click'|'delete'} type
 * @param {{ sound?: boolean, haptic?: boolean }} opts
 */
export const feedback = (type = 'notification', opts = {}) => {
  const { sound = true, haptic = true } = opts;
  if (sound) playSound(type);
  if (haptic) vibrate(type);
};

/**
 * Demande la permission pour les notifications navigateur
 * @returns {Promise<boolean>} true si la permission est accordée
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

/**
 * Affiche une notification navigateur
 * @param {string} title - Titre de la notification
 * @param {Object} options - Options (body, icon, tag, etc.)
 */
export const showBrowserNotification = (title, options = {}) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return null;

  try {
    const notif = new Notification(title, {
      icon: '/Logos/logo-emag-192.png',
      badge: '/Logos/logo-emag-192.png',
      tag: 'emag-message', // Regroupe les notifications
      renotify: true,
      ...options,
    });

    // Fermer automatiquement après 5 secondes
    setTimeout(() => notif.close(), 5000);

    // Clic sur la notification → focus la fenêtre
    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    return notif;
  } catch (e) {
    console.warn('Notification navigateur échouée:', e.message);
    return null;
  }
};
