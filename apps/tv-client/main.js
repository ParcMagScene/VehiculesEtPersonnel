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

// Mode preview (iframe dans /admin/Dashboard Ecrans) — recoit les overrides
// via postMessage pour prevoir le rendu avant validation cote admin.
const IS_PREVIEW = new URLSearchParams(window.location.search).get('preview') === '1';
let previewOverrides = null;
let lastRawState = null;

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
async function loadTVState() {
  try {
    const response = await tvFetch(`${API_BASE}/api/display/tv-public-state`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const state = await response.json();

    // Cache la réponse pour le mode offline
    cacheSet(CACHE_KEYS.tvState, state);
    setOnlineStatus(true);

    lastRawState = state;
    applyTVState(mergePreviewOverrides(state));
  } catch (error) {
    console.error('Erreur chargement état TV:', error);
    setOnlineStatus(false);
    // Fallback : utiliser le cache
    const cached = cacheGet(CACHE_KEYS.tvState);
    if (cached && cached.data) {
      lastRawState = cached.data;
      applyTVState(mergePreviewOverrides(cached.data));
    }
  }
}

/**
 * En mode preview, fusionne le state serveur avec les overrides recus
 * du parent via postMessage (config, welcomeMessage, colorRules, iconRules,
 * logoUrl). Retourne le state tel quel en mode normal.
 */
function mergePreviewOverrides(state) {
  if (!IS_PREVIEW || !previewOverrides) return state;
  const o = previewOverrides;
  return {
    ...state,
    config: { ...(state.config || {}), ...(o.config || {}) },
    welcomeMessage: o.welcomeMessage !== undefined ? o.welcomeMessage : state.welcomeMessage,
    colorRules: o.colorRules !== undefined ? o.colorRules : state.colorRules,
    iconRules: o.iconRules !== undefined ? o.iconRules : state.iconRules,
    logoUrl: o.logoUrl !== undefined ? o.logoUrl : state.logoUrl,
  };
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

  // ── Scaling global TV (cf. docs/tv-client-scaling.md) ──
  // Priorite : query string ?tvScale=X > config serveur > default 1.6.
  // La query string permet a chaque ecran d'ajuster localement sans SQL,
  // utile pour des Pi de resolutions differentes derriere le meme backend.
  const params = new URLSearchParams(window.location.search);
  const overrideScale = params.get('tvScale');
  applyTvScale(overrideScale !== null ? overrideScale : config.tvScale);

  // Overscan TV : ?overscan=XX dans l'URL (en px), ou auto-détection Raspberry Pi
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

/**
 * Applique le facteur d'agrandissement global au container .tv-scale.
 * Valeur par defaut : 1.6 (recommande pour TV 65" a 4-5 m).
 * Bornes de securite : [0.5, 3] pour eviter tout facteur aberrant.
 * Sans effet sur mobile (media query @media (max-width: 768px)
 * force .tv-scale { transform: none } dans styles.css).
 */
function applyTvScale(raw) {
  const el = document.querySelector('.tv-scale');
  if (!el) return;
  const parsed = Number(raw);
  const scale = Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 3 ? parsed : 1.6;
  // On ecrit uniquement la variable CSS pour ne pas ecraser la media
  // query mobile (transform:none) via des styles inline.
  el.style.setProperty('--tv-scale', String(scale));
}

// ===============================================
//  RENDU DES ÉVÉNEMENTS
// ===============================================
function renderEvents(events) {
  // Filtrer les événements terminés
  const activeEvents = events.filter(e => {
    const eventId = String(e.id);
    return e.status !== 'done' && !completedEvents.includes(eventId);
  });

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
    }
  }
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

  li.innerHTML = `
    <div class="event-columns">
      <div class="col-time">${timeDisplay}</div>
      <div class="col-title">${isCompleted ? '<span class="completed-icon">✅</span>' : ''}${eventTitle}</div>
      <div class="col-affaire">${affaireBadge}</div>
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
  const isCompleted = completedEvents.includes(strEventId);
  const endpoint = isCompleted
    ? '/api/display/tv/uncomplete-event'
    : '/api/display/tv/complete-event';

  try {
    const response = await tvFetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: strEventId })
    });

    if (response.ok) {
      if (isCompleted) {
        completedEvents = completedEvents.filter(id => id !== strEventId);
        li.classList.remove('event-completed');
      } else {
        completedEvents.push(strEventId);
        li.classList.add('event-completed');
      }
      // Mettre à jour l'icône dans le titre
      const titleDiv = li.querySelector('.col-title');
      if (titleDiv) {
        const hasIcon = titleDiv.querySelector('.completed-icon');
        if (li.classList.contains('event-completed')) {
          if (!hasIcon) titleDiv.insertAdjacentHTML('afterbegin', '<span class="completed-icon">✅</span>');
        } else {
          if (hasIcon) hasIcon.remove();
        }
      }
    }
  } catch (error) {
    console.error('Erreur toggle événement:', error);
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
async function loadSonosNowPlaying() {
  try {
    const response = await tvFetch(`${API_BASE}/api/sonos/now-playing`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    cacheSet(CACHE_KEYS.sonos, data);
    updateSonosWidget(data);
  } catch (error) {
    console.error('Erreur Sonos:', error);
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
      // Priorite au logo officiel du service (Radio Meuh, France Inter, Tidal,
      // Spotify, etc.) si detecte. Fallback : artwork de l'album, puis logo entreprise.
      const artUrl =
        data.service?.logo || data.albumArtURI || data.albumArt || '/display-logo/logo.png';
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
function startAutoScroll() {
  const mainElement = document.querySelector('main');
  if (!mainElement) return;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

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
    await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch { /* silencieux */ }
}

// ===============================================
//  INITIALISATION
// ===============================================
async function init() {
  console.log('🚀 Dashboard TV (eM@g) — Initialisation...');
  if (IS_PREVIEW) {
    console.log('👁 Mode preview actif — attente des overrides via postMessage');
    window.addEventListener('message', (evt) => {
      // Best-effort : accepter n'importe quelle origine (iframe admin locale).
      // Ne traite que les payloads structures explicitement pour preview.
      const data = evt.data;
      if (data && typeof data === 'object' && data.type === 'tv-preview:overrides') {
        previewOverrides = data.overrides || {};
        if (lastRawState) applyTVState(mergePreviewOverrides(lastRawState));
      }
    });
  }

  // Charger l'état complet (config, events, rules, sonos, sneaky, welcome)
  await loadTVState();

  // Mise à jour immédiate
  updateDateTime();
  loadWeather();

  // Intervalles de mise à jour
  setInterval(updateDateTime, 1000);            // Horloge : chaque seconde
  setInterval(loadTVState, 30000);              // État complet : toutes les 30s
  setInterval(loadWeather, 600000);             // Météo : toutes les 10 min
  setInterval(loadSonosNowPlaying, 5000);       // Sonos : toutes les 5s
  if (!IS_PREVIEW) {
    // Pas d'alarme sonore en preview admin.
    setInterval(checkAlarms, 1000);
  }

  setInterval(refreshTokenSilently, 6 * 60 * 60 * 1000); // Token refresh : toutes les 6h

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
