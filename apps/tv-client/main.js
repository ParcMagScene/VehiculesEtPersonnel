// ===============================================
//  Dashboard TV — Client JavaScript
//  Fusionné dans eM@g depuis calendar-dashboard
//  Consomme les APIs /api/display/* du serveur eM@g
// ===============================================

const API_BASE = window.location.origin;

// Token TV : lu depuis le paramètre URL ?token= ou depuis localStorage
const TV_TOKEN = (() => {
  const urlToken = new URLSearchParams(window.location.search).get('token');
  if (urlToken) {
    localStorage.setItem('tv-token', urlToken);
    return urlToken;
  }
  return localStorage.getItem('tv-token') || '';
})();

/** Fetch wrapper qui inclut le header X-TV-Token */
function tvFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (TV_TOKEN) headers['X-TV-Token'] = TV_TOKEN;
  return fetch(url, { ...options, headers });
}

// État global
let colorRules = [];
let locationIconRules = [];
let completedEvents = [];
let tvConfig = {};
let allEvents = [];
let isOffline = false;
let regularAutoScrollStop = null;
let recurrentAutoScrollStop = null;

// ===============================================
//  CACHE OFFLINE — localStorage
// ===============================================
const CACHE_KEYS = {
  tvState: 'tv-cache-state',
  weather: 'tv-cache-weather',
  sonos:   'tv-cache-sonos',
};

function cacheSet(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* quota exceeded — ignore */ }
}

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function setOnlineStatus(online) {
  const prev = isOffline;
  isOffline = !online;
  const indicator = document.getElementById('offline-indicator');
  if (indicator) {
    indicator.style.display = isOffline ? 'flex' : 'none';
  }
  if (prev !== isOffline) {
    console.log(isOffline ? '🔴 Mode offline — données en cache' : '🟢 Connexion rétablie');
  }
}

/** Échappe les caractères HTML pour prévenir les injections XSS */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===============================================
//  ALARME SONORE — SNCF.wav à l'échéance
// ===============================================
const alarmTriggered = new Set();   // IDs des événements déjà signalés aujourd'hui
let alarmAudio = null;              // Instance Audio réutilisable
let lastAlarmDay = new Date().toDateString();
let lastAlarmTestTs = 0;            // Dernier timestamp d'alarme test reçu du serveur

function getAlarmAudio() {
  if (!alarmAudio) {
    alarmAudio = new Audio('/SNCF.wav');
    alarmAudio.volume = 1.0;
    // [PERF Sprint 1] Préchargement actif pour éliminer la latence à la 1ère alarme.
    alarmAudio.preload = 'auto';
    try { alarmAudio.load(); } catch (_) { /* ignoré */ }
  }
  return alarmAudio;
}

/** Joue le signal SNCF */
function playAlarmSound() {
  const audio = getAlarmAudio();
  audio.currentTime = 0;
  const playPromise = audio.play();
  if (playPromise) {
    playPromise.catch(err => {
      console.warn('⚠️ Lecture audio bloquée (autoplay) :', err.message);
    });
  }

}

/** Vérifie toutes les secondes si une tâche arrive à échéance */
function checkAlarms() {
  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const today = now.toDateString();

  // Reset des alarmes si nouveau jour
  if (today !== lastAlarmDay) {
    alarmTriggered.clear();
    lastAlarmDay = today;
  }

  for (const event of allEvents) {
    if (!event.end_time || event.end_time === '') continue;
    const eventId = String(event.id);
    if (alarmTriggered.has(eventId)) continue;
    // Ne pas sonner pour les tâches déjà terminées
    if (completedEvents.includes(eventId)) continue;

    if (currentHHMM >= event.end_time) {
      console.log(`🔔 ALARME — Tâche "${event.title}" échue à ${event.end_time}`);
      alarmTriggered.add(eventId);
      playAlarmSound();
      showAlarmFlash(event);
    }
  }
}

/** Flash visuel quand une alarme se déclenche */
function showAlarmFlash(event) {
  // Flash rouge sur le body
  document.body.classList.add('alarm-flash');
  setTimeout(() => document.body.classList.remove('alarm-flash'), 3000);

  // Mettre en surbrillance l'événement concerné (sanitize l'ID pour éviter injection querySelector)
  const safeId = CSS.escape(String(event.id));
  const eventEl = document.querySelector(`[data-event-id="${safeId}"]`);
  if (eventEl) {
    eventEl.classList.add('alarm-active');
    setTimeout(() => eventEl.classList.remove('alarm-active'), 10000);
  }
}

// ===============================================
//  FONCTIONS UTILITAIRES
// ===============================================
function formatDate(date) {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('fr-FR', options);
}

function formatTime(date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ===============================================
//  AFFICHAGE DATE/HEURE
// ===============================================
function updateDateTime() {
  const now = new Date();
  const dateElement = document.getElementById('date');
  const heureElement = document.getElementById('heure');
  if (dateElement) dateElement.textContent = formatDate(now);
  if (heureElement) heureElement.textContent = formatTime(now);
}

// ===============================================
//  CHARGEMENT ÉTAT COMPLET TV
// ===============================================
// [PERF Sprint 3] Backoff exponentiel : si le backend tombe, on n'inonde pas
// le réseau toutes les 30s. On décale la prochaine tentative jusqu'à 5 min max,
// reset à 0 sur succès.
let _tvStateBackoffSkip = 0;       // nb de ticks à sauter avant retry
let _tvStateConsecErrors = 0;
async function loadTVState() {
  if (_tvStateBackoffSkip > 0) { _tvStateBackoffSkip--; return; }
  try {
    const response = await tvFetch(`${API_BASE}/api/display/tv-public-state`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const state = await response.json();

    // Cache la réponse pour le mode offline
    cacheSet(CACHE_KEYS.tvState, state);
    setOnlineStatus(true);
    _tvStateConsecErrors = 0;
    _tvStateBackoffSkip = 0;

    applyTVState(state);
  } catch (error) {
    console.error('Erreur chargement état TV:', error);
    setOnlineStatus(false);
    _tvStateConsecErrors++;
    // 30s base × 2^(n-1), cappé à ~5 min (10 ticks de 30s)
    _tvStateBackoffSkip = Math.min(10, Math.pow(2, _tvStateConsecErrors - 1) - 1);
    // Fallback : utiliser le cache
    const cached = cacheGet(CACHE_KEYS.tvState);
    if (cached && cached.data) {
      applyTVState(cached.data);
    }
  }
}

/** Applique l'état TV (live ou cache) */
function applyTVState(state) {
    // Appliquer la config (variables CSS)
    tvConfig = state.config || {};
    applyConfig(tvConfig);

    // Message d'accueil
    const welcomeEl = document.getElementById('welcome');
    if (welcomeEl && state.welcomeMessage) {
      welcomeEl.innerHTML = `<span>${escapeHtml(state.welcomeMessage)}</span>`;
    }

    // Stocker les règles
    colorRules = state.colorRules || [];
    locationIconRules = (state.iconRules || []).map(r => ({
      keyword: r.keyword,
      icon: r.gif_filename
    }));

    // Completed events
    completedEvents = state.completedEvents || [];

    // Logo
    if (state.logoUrl) {
      const logoEl = document.getElementById('logo');
      if (logoEl) logoEl.src = state.logoUrl;
    }

    // Sneaky photo
    if (state.sneakyPhoto && state.sneakyPhoto.active) {
      showSneakyPhoto(state.sneakyPhoto.path);
    } else {
      hideSneakyPhoto();
    }

    // Sonos
    updateSonosWidget(state.sonos);

    // Événements (tâches planifiées)
    allEvents = state.events || [];
    renderEvents(allEvents);

    // Alarme test déclenchée depuis l'admin
    if (state.alarmTest && state.alarmTest > lastAlarmTestTs) {
      lastAlarmTestTs = state.alarmTest;
      console.log('🔔 Alarme test reçue depuis l\'admin');
      playAlarmSound();
      showAlarmFlash({ id: 'test', title: 'Test alarme admin' });
    }
}

// ===============================================
//  APPLIQUER LA CONFIGURATION VISUELLE
// ===============================================
/** Valide qu'une valeur est un token CSS sûr (couleur hex, rgb, hsl, mot-clé simple) */
function isSafeCSSValue(value) {
  if (!value || typeof value !== 'string') return false;
  return /^(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)|[a-zA-Z\- ]{1,50})$/.test(value.trim());
}

function applyConfig(config) {
  const root = document.documentElement;
  if (isSafeCSSValue(config.primaryColor)) root.style.setProperty('--primary-color', config.primaryColor);
  if (isSafeCSSValue(config.secondaryColor)) root.style.setProperty('--secondary-color', config.secondaryColor);
  if (isSafeCSSValue(config.eventBgColor)) root.style.setProperty('--event-bg-color', config.eventBgColor);
  if (isSafeCSSValue(config.eventTextColor)) root.style.setProperty('--event-text-color', config.eventTextColor);
  if (config.fontFamily && isSafeCSSValue(config.fontFamily)) root.style.setProperty('--font-family', config.fontFamily);

  // Overscan TV : ?overscan=XX dans l'URL (en px), ou auto-détection Raspberry Pi
  const params = new URLSearchParams(window.location.search);
  let overscan = parseInt(params.get('overscan'), 10);
  if (isNaN(overscan)) {
    // Auto-détection : appliquer une marge par défaut sur les navigateurs embarqués (Pi, etc.)
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('raspbian') || ua.includes('raspberry') || (ua.includes('chromium') && ua.includes('linux armv'))) {
      overscan = 24;
    }
  }
  if (overscan > 0) {
    root.style.setProperty('--tv-overscan', overscan + 'px');
  }
}

// ===============================================
//  RENDU DES ÉVÉNEMENTS
// ===============================================
// [PERF Sprint 2] Signature des events affichés : si rien n'a changé (ids,
// statuts, ordre, drapeau récurrent), on évite la reconstruction complète du DOM
// + le restart de l'auto-scroll (qui provoque un saut visuel à chaque tick).
let _lastEventsSig = '';
function renderEvents(events) {
  // Filtrer les événements terminés
  const activeEvents = events.filter(e => {
    const eventId = String(e.id);
    return e.status !== 'done' && !completedEvents.includes(eventId);
  });

  // Signature stable basée sur ce qui influence l'affichage.
  const sig = activeEvents
    .map(e => `${e.id}:${e.status || ''}:${e.is_recurrent ? 1 : 0}`)
    .join('|') + `#completed=${completedEvents.length}`;
  if (sig === _lastEventsSig) return;
  _lastEventsSig = sig;

  // Séparer événements réguliers et récurrents
  const regular = activeEvents.filter(e => !e.is_recurrent);
  const recurrent = activeEvents.filter(e => e.is_recurrent);

  const regularList = document.getElementById('regular-events-list');
  const recurrentList = document.getElementById('recurrent-events-list');

  if (regularList) {
    const regularSection = regularList.closest('.events-section') || regularList.parentElement;
    if (regular.length === 0) {
      regularList.innerHTML = '';
      if (regularSection) regularSection.style.display = 'none';
    } else {
      if (regularSection) regularSection.style.display = '';
      regularList.innerHTML = '';
      regular.forEach(event => {
        const li = createEventElement(event);
        regularList.appendChild(li);
      });
      if (regularAutoScrollStop) regularAutoScrollStop();
      regularAutoScrollStop = enableAutoScroll(regularList);
    }
  }

  if (recurrentList) {
    const recurrentSection = recurrentList.closest('.events-section') || recurrentList.parentElement;
    if (recurrent.length === 0) {
      recurrentList.innerHTML = '';
      if (recurrentSection) recurrentSection.style.display = 'none';
    } else {
      if (recurrentSection) recurrentSection.style.display = '';
      recurrentList.innerHTML = '';
      recurrent.forEach(event => {
        const li = createEventElement(event);
        recurrentList.appendChild(li);
      });
      if (recurrentAutoScrollStop) recurrentAutoScrollStop();
      recurrentAutoScrollStop = enableAutoScroll(recurrentList);
    }
  }
}

// Auto-scroll vertical doux pour afficher toute la liste sans interaction
function enableAutoScroll(listEl) {
  if (!listEl) return null;

  listEl.scrollTop = 0;
  const maxScroll = listEl.scrollHeight - listEl.clientHeight;
  if (maxScroll <= 8) return null;

  let rafId = null;
  let dir = 1;
  let lastTs = performance.now();
  let pauseUntil = lastTs + 1800;
  const speed = 26; // px/s
  let stopped = false;

  const step = (ts) => {
    if (stopped) return;
    const max = listEl.scrollHeight - listEl.clientHeight;
    if (max <= 8) return;

    if (ts < pauseUntil) {
      rafId = requestAnimationFrame(step);
      return;
    }

    const dt = Math.max(0, (ts - lastTs) / 1000);
    lastTs = ts;
    listEl.scrollTop += speed * dt * dir;

    if (listEl.scrollTop >= max - 1) {
      listEl.scrollTop = max;
      dir = -1;
      pauseUntil = ts + 2200;
    } else if (listEl.scrollTop <= 1) {
      listEl.scrollTop = 0;
      dir = 1;
      pauseUntil = ts + 2200;
    }

    rafId = requestAnimationFrame(step);
  };

  rafId = requestAnimationFrame(step);
  return () => {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
  };
}

// ===============================================
//  CRÉATION D'UN ÉLÉMENT ÉVÉNEMENT
// ===============================================
function createEventElement(event) {
  const li = document.createElement('li');
  li.className = 'event-item';

  const eventId = String(event.id);
  li.dataset.eventId = eventId;

  // Détecter événement "toute la journée" (pas d'heure)
  const isAllDay = !event.time || event.time === '';
  if (isAllDay) li.classList.add('all-day-event');

  const timeStr = escapeHtml(event.time || '');
  const endTimeStr = escapeHtml(event.end_time || '');
  const periodStr = escapeHtml(event.period || '');
  const timeDisplay = timeStr
    ? (endTimeStr ? `${timeStr} → ${endTimeStr}` : timeStr)
    : (periodStr || '');
  const eventTitle = escapeHtml(event.title || 'Sans titre');
  const eventLocation = escapeHtml(event.location || '');
  const affaireNum = event.affaire_num || '';
  const affaireType = event.affaire_type || '';
  const reservationVehicleName = escapeHtml(event.reservation_vehicle_name || '');
  const reservationVehicleReg = escapeHtml(event.reservation_vehicle_reg || '');

  // Vérifier si terminé (status 'done' dans la planification OU marqué manuellement sur l'écran)
  const isCompleted = event.status === 'done' || completedEvents.includes(eventId);

  // Rechercher icône de lieu (sur titre + sectionLabel + location — texte brut pour le matching)
  const rawTitle = event.title || '';
  const rawLocation = event.location || '';
  const searchTextForIcon = `${rawTitle} ${event.section || ''} ${event.sectionLabel || ''} ${rawLocation}`;
  const locationIcon = getLocationIcon(searchTextForIcon);

  // Construire le contenu de la colonne lieu
  let locationContent;
  if (locationIcon) {
    locationContent = `<div class="location-icon"><img src="/api/display/gifs/${encodeURIComponent(locationIcon)}" alt="${escapeHtml(event.sectionLabel || '')}"></div>`;
  } else if (eventLocation) {
    locationContent = eventLocation;
  } else {
    locationContent = escapeHtml(event.sectionLabel || '');
  }

  // Badge affaire (couleur selon le type d'affaire)
  const AFFAIRE_TYPE_COLORS = {
    Prestation: '#3b82f6', Location: '#f59e0b', Installation: '#10b981',
    Vente: '#8b5cf6', 'Tournée': '#ec4899',
  };
  const badgeColor = AFFAIRE_TYPE_COLORS[affaireType] || '#3b82f6';
  const affaireBadge = affaireNum
    ? `<span class="tv-affaire-badge" style="--badge-color:${badgeColor}">${escapeHtml(affaireNum)}</span>`
    : '';
  const reservationVehicleBadge = reservationVehicleName
    ? `<span class="tv-vehicle-badge" title="${reservationVehicleReg ? `${reservationVehicleName} (${reservationVehicleReg})` : reservationVehicleName}">🚛 ${reservationVehicleName}${reservationVehicleReg ? ` (${reservationVehicleReg})` : ''}</span>`
    : '';

  li.innerHTML = `
    <div class="event-columns">
      <div class="col-time">${timeDisplay}</div>
      <div class="col-title">${isCompleted ? '<span class="completed-icon">✅</span>' : ''}${eventTitle}</div>
      <div class="col-affaire">${affaireBadge}${reservationVehicleBadge}</div>
      <div class="col-location">${locationContent}</div>
    </div>
  `;

  // Marquer comme terminé si c'est le cas
  if (isCompleted) li.classList.add('event-completed');

  // Application des couleurs personnalisées (mot-clé dans titre + section + location — texte brut)
  const searchText = `${rawTitle} ${event.section || ''} ${event.sectionLabel || ''} ${rawLocation}`.toLowerCase();
  for (const rule of colorRules) {
    if (searchText.includes(rule.keyword.toLowerCase())) {
      li.style.setProperty('--event-color', rule.color);
      if (!isCompleted) {
        li.style.color = rule.color;
      }
      break;
    }
  }

  // Clignotement pour les événements urgents (contenant !)
  if (eventTitle.includes('!') && !isCompleted) {
    li.classList.add('event-urgent');
  }

  return li;
}

// ===============================================
//  TOGGLE ÉVÉNEMENT TERMINÉ
// ===============================================
async function toggleEventComplete(eventId, li) {
  const strEventId = String(eventId);
  const wasCompleted = completedEvents.includes(strEventId);
  const endpoint = wasCompleted
    ? '/api/display/tv/uncomplete-event'
    : '/api/display/tv/complete-event';

  // [PERF Sprint 4] Optimistic UI : on bascule l'affichage immédiatement,
  // puis on revert si la requête échoue. Évite l'effet "clic sans réaction".
  const titleDiv = li.querySelector('.col-title');
  const applyVisual = (completed) => {
    if (completed) {
      li.classList.add('event-completed');
      if (titleDiv && !titleDiv.querySelector('.completed-icon')) {
        titleDiv.insertAdjacentHTML('afterbegin', '<span class="completed-icon">✅</span>');
      }
    } else {
      li.classList.remove('event-completed');
      const icon = titleDiv && titleDiv.querySelector('.completed-icon');
      if (icon) icon.remove();
    }
  };

  // 1) Mise à jour optimiste de l'état + DOM
  if (wasCompleted) {
    completedEvents = completedEvents.filter(id => id !== strEventId);
  } else {
    completedEvents.push(strEventId);
  }
  applyVisual(!wasCompleted);

  // Invalide la signature pour qu'un éventuel renderEvents() rafraîchisse
  // bien le DOM même si le serveur renvoie le même payload.
  _lastEventsSig = null;

  // 2) Requête réseau, revert si échec
  try {
    const response = await tvFetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: strEventId })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error('Erreur toggle événement (revert):', error);
    // Revert état + DOM
    if (wasCompleted) {
      completedEvents.push(strEventId);
    } else {
      completedEvents = completedEvents.filter(id => id !== strEventId);
    }
    applyVisual(wasCompleted);
    _lastEventsSig = null;
  }
}

// ===============================================
//  ICÔNES DE LIEUX
// ===============================================
function getLocationIcon(text) {
  if (!text || locationIconRules.length === 0) return null;
  const textLower = text.toLowerCase();
  for (const rule of locationIconRules) {
    if (rule.keyword && rule.icon && textLower.includes(rule.keyword.toLowerCase())) {
      return rule.icon;
    }
  }
  return null;
}

// ===============================================
//  MÉTÉO
// ===============================================
async function loadWeather() {
  try {
    if (!tvConfig.showWeather) {
      const weatherEl = document.getElementById('weather');
      if (weatherEl) weatherEl.style.display = 'none';
      return;
    }

    const response = await tvFetch(`${API_BASE}/api/display/weather`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    cacheSet(CACHE_KEYS.weather, data);
    renderWeather(data);
  } catch (error) {
    console.error('Erreur météo:', error);
    const cached = cacheGet(CACHE_KEYS.weather);
    if (cached && cached.data) {
      renderWeather(cached.data);
    }
  }
}

function renderWeather(data) {
  const weatherEl = document.getElementById('weather');
  if (weatherEl && data && !data.error && data.main) {
    const temp = Math.round(data.main.temp);
    const icon = getWeatherIcon(data.weather?.[0]?.icon);
    weatherEl.innerHTML = `<div class="weather-line1">${icon} ${temp}°C</div>`;
    weatherEl.style.display = 'flex';
  } else if (weatherEl) {
    weatherEl.textContent = '';
  }
}

function getWeatherIcon(iconCode) {
  const iconMap = {
    '01d': '&#9728;', '01n': '&#9790;', '02d': '&#9925;', '02n': '&#9729;',
    '03d': '&#9729;', '03n': '&#9729;', '04d': '&#9729;', '04n': '&#9729;',
    '09d': '&#9748;', '09n': '&#9748;', '10d': '&#9926;', '10n': '&#9748;',
    '11d': '&#9736;', '11n': '&#9736;', '13d': '&#10052;', '13n': '&#10052;',
    '50d': '&#9729;', '50n': '&#9729;'
  };
  return iconMap[iconCode] || '&#9729;';
}

// ===============================================
//  SONOS
// ===============================================
// [PERF Sprint 2] Signature du dernier rendu : si la réponse est strictement
// identique (titre/artiste/cover/playing), on évite tout DOM update inutile.
// [PERF Sprint 3] Backoff exponentiel sur erreur (cap 1 min) : sur un Sonos
// débranché ou un backend down, on évite le hammering toutes les 5s.
let _lastSonosSig = '';
let _sonosBackoffSkip = 0;
let _sonosConsecErrors = 0;
async function loadSonosNowPlaying() {
  if (_sonosBackoffSkip > 0) { _sonosBackoffSkip--; return; }
  try {
    const response = await tvFetch(`${API_BASE}/api/sonos/now-playing`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    cacheSet(CACHE_KEYS.sonos, data);
    _sonosConsecErrors = 0;
    _sonosBackoffSkip = 0;
    const sig = data ? `${data.playing ? 1 : 0}|${data.title || ''}|${data.artist || ''}|${data.albumArtURI || data.albumArt || ''}` : '';
    if (sig === _lastSonosSig) return;
    _lastSonosSig = sig;
    updateSonosWidget(data);
  } catch (error) {
    console.error('Erreur Sonos:', error);
    _sonosConsecErrors++;
    // 5s base × 2^(n-1), cappé à 12 ticks (~1 min)
    _sonosBackoffSkip = Math.min(12, Math.pow(2, _sonosConsecErrors - 1) - 1);
    const cached = cacheGet(CACHE_KEYS.sonos);
    if (cached && cached.data) {
      updateSonosWidget(cached.data);
    } else {
      const widget = document.getElementById('sonos-widget');
      if (widget) widget.style.display = 'none';
    }
  }
}

function updateSonosWidget(data) {
  const widget = document.getElementById('sonos-widget');
  const albumArt = document.getElementById('sonos-album-art');
  const titleEl = document.getElementById('sonos-title');
  const artistEl = document.getElementById('sonos-artist');

  if (!widget) return;

  // Afficher le widget dès qu'il y a un titre (même en pause)
  if (data && data.title) {
    widget.style.display = 'flex';
    widget.style.opacity = data.playing ? '1' : '0.6';
    if (albumArt) {
      const artUrl = data.albumArtURI || data.albumArt || '/display-logo/logo.png';
      // Éviter de re-tenter les URLs en 404 (ex: RadioMeuh.png manquant)
      if (albumArt._failedUrls && albumArt._failedUrls.has(artUrl)) {
        albumArt.src = '/display-logo/logo.png';
      } else if (albumArt.src !== artUrl) {
        albumArt.onerror = () => {
          albumArt.onerror = null;
          if (!albumArt._failedUrls) albumArt._failedUrls = new Set();
          albumArt._failedUrls.add(artUrl);
          albumArt.src = '/display-logo/logo.png';
        };
        albumArt.src = artUrl;
      }
    }

    // Artiste / titre : fournis directement par le backend (parsing radio centralisé)
    if (titleEl) titleEl.textContent = data.title || '';
    if (artistEl) artistEl.textContent = data.artist || '';


  } else {
    widget.style.display = 'none';
    if (titleEl) titleEl.textContent = '';
    if (artistEl) artistEl.textContent = '';
  }
}

// ===============================================
//  PHOTO FURTIVE
// ===============================================
let sneakyPhotoContainer = null;

function showSneakyPhoto(photoPath) {
  if (sneakyPhotoContainer) return;
  // Valider que le path est une URL relative sûre (pas de protocol injection)
  if (!photoPath || typeof photoPath !== 'string' || /^[a-z]+:/i.test(photoPath)) return;

  sneakyPhotoContainer = document.createElement('div');
  sneakyPhotoContainer.className = 'sneaky-photo-container';
  sneakyPhotoContainer.id = 'sneaky-photo-container';

  const img = document.createElement('img');
  img.className = 'sneaky-photo';
  img.src = `${photoPath}?t=${Date.now()}`;
  img.alt = 'Photo furtive';
  img.onerror = () => hideSneakyPhoto();

  sneakyPhotoContainer.appendChild(img);
  document.body.appendChild(sneakyPhotoContainer);
}

function hideSneakyPhoto() {
  if (sneakyPhotoContainer) {
    sneakyPhotoContainer.remove();
    sneakyPhotoContainer = null;
  }
}

// ===============================================
//  DÉFILEMENT AUTOMATIQUE
// ===============================================
let _autoScrollStarted = false;
function startAutoScroll() {
  // [PERF Sprint 4] Idempotence : éviter double init (double rAF + listeners empilés)
  if (_autoScrollStarted) return;
  const mainElement = document.querySelector('main');
  if (!mainElement) return;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  _autoScrollStarted = true;

  // Wrapper GPU-composited : transform au lieu de scrollTop → pas de reflow par frame
  const wrapper = document.createElement('div');
  wrapper.style.willChange = 'transform';
  while (mainElement.firstChild) {
    wrapper.appendChild(mainElement.firstChild);
  }
  mainElement.appendChild(wrapper);

  let scrollPosition = 0;
  const scrollSpeedPxPerSec = 30;
  const pauseAtBottom = 3000;
  const pauseAtTop = 2000;
  let pauseUntil = 0;
  let lastTs = null;
  let rafId = null;

  function step(ts) {
    const maxScroll = Math.max(0, wrapper.scrollHeight - mainElement.clientHeight);

    if (lastTs == null) lastTs = ts;
    const dtMs = ts - lastTs;
    lastTs = ts;

    if (maxScroll <= 0) {
      wrapper.style.transform = 'translate3d(0, 0, 0)';
      rafId = requestAnimationFrame(step);
      return;
    }

    if (ts < pauseUntil) {
      rafId = requestAnimationFrame(step);
      return;
    }

    scrollPosition += (scrollSpeedPxPerSec * dtMs) / 1000;

    if (scrollPosition >= maxScroll) {
      scrollPosition = maxScroll;
      wrapper.style.transform = `translate3d(0, -${scrollPosition}px, 0)`;
      pauseUntil = ts + pauseAtBottom;
      setTimeout(() => {
        scrollPosition = 0;
        wrapper.style.transform = 'translate3d(0, 0, 0)';
        pauseUntil = performance.now() + pauseAtTop;
      }, pauseAtBottom);
    } else {
      wrapper.style.transform = `translate3d(0, -${scrollPosition}px, 0)`;
    }

    rafId = requestAnimationFrame(step);
  }

  rafId = requestAnimationFrame(step);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (!rafId) {
      lastTs = null;
      rafId = requestAnimationFrame(step);
    }
  });
}



// ===============================================
//  SILENT TOKEN REFRESH (toutes les 6h)
// ===============================================
async function refreshTokenSilently() {
  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) {
      // [PERF Sprint 1] Plus de catch totalement silencieux : on log au moins
      // pour pouvoir diagnostiquer une session expirée en TV 24/7.
      console.warn(`⚠️ Token refresh échoué [HTTP ${response.status}]`);
    }
  } catch (error) {
    console.warn('⚠️ Token refresh erreur réseau:', error && error.message ? error.message : error);
  }
}

// ===============================================
//  INITIALISATION
// ===============================================
async function init() {
  console.log('🚀 Dashboard TV (eM@g) — Initialisation...');

  // Charger l'état complet (config, events, rules, sonos, sneaky, welcome)
  await loadTVState();

  // Mise à jour immédiate
  updateDateTime();
  loadWeather();

  // Préchargement audio alarme (évite latence audio à la première alerte)
  getAlarmAudio();

  // [PERF Sprint 1] Gestionnaire centralisé d'intervalles avec pause sur
  // visibilitychange : sur une TV 24/7 mise en veille (écran off) le navigateur
  // garde le JS actif. On stoppe les pollings tant que l'onglet est caché.
  const intervalSpecs = [
    { key: 'dateTime',     fn: updateDateTime,        ms: 1000 },
    { key: 'tvState',      fn: loadTVState,           ms: 30000 },
    { key: 'weather',      fn: loadWeather,           ms: 600000 },
    { key: 'sonos',        fn: loadSonosNowPlaying,   ms: 5000 },
    { key: 'alarms',       fn: checkAlarms,           ms: 1000 },
    { key: 'tokenRefresh', fn: refreshTokenSilently,  ms: 6 * 60 * 60 * 1000 },
  ];
  const intervalHandles = Object.create(null);

  function startIntervals() {
    for (const s of intervalSpecs) {
      if (intervalHandles[s.key]) continue;
      intervalHandles[s.key] = setInterval(s.fn, s.ms);
    }
  }
  function stopIntervals() {
    for (const k of Object.keys(intervalHandles)) {
      clearInterval(intervalHandles[k]);
      delete intervalHandles[k];
    }
  }

  startIntervals();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopIntervals();
      console.log('📺 TV en veille — intervalles en pause');
    } else {
      startIntervals();
      // Rattraper immédiatement l'état à la sortie de veille.
      try { updateDateTime(); } catch (_) { /* ignoré */ }
      try { loadTVState(); } catch (_) { /* ignoré */ }
      console.log('📺 TV réveillée — intervalles repris');
    }
  });

  // Démarrer le défilement automatique
  startAutoScroll();

  console.log('✅ Dashboard TV initialisé');
}

// ===============================================
//  DÉMARRAGE
// ===============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
