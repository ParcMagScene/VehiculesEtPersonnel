/**
 * Son de notification généré via Web Audio API
 * Pas de fichier audio externe nécessaire
 */

let audioCtx = null;

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
};

/**
 * Joue un son de notification court et agréable (deux notes ascendantes)
 */
export const playNotificationSound = () => {
  try {
    const ctx = getAudioContext();
    
    // Reprendre le contexte si suspendu (requis par les navigateurs modernes)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const now = ctx.currentTime;

    // Note 1 — Do5 (523 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Note 2 — Mi5 (659 Hz) — légèrement décalée
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659, now + 0.1);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0.15, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.3);

    // Note 3 — Sol5 (784 Hz) — résolution
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(784, now + 0.2);
    gain3.gain.setValueAtTime(0, now);
    gain3.gain.setValueAtTime(0.12, now + 0.2);
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc3.connect(gain3).connect(ctx.destination);
    osc3.start(now + 0.2);
    osc3.stop(now + 0.45);
  } catch (e) {
    // Silencieux si l'audio n'est pas disponible
    console.warn('Notification sonore indisponible:', e.message);
  }
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
