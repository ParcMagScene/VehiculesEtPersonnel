// ===============================================
//  Dashboard TV — Client JavaScript
//  Fusionné dans eM@g depuis calendar-dashboard
//  Consomme les APIs /api/display/* du serveur eM@g
// ===============================================

const API_BASE = window.location.origin;

// État global
let colorRules = [];
let locationIconRules = [];
let completedEvents = [];
let tvConfig = {};
let allEvents = [];

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
  // Afficher brièvement l'icône cloche
  const btn = document.getElementById('btn-test-sound');
  if (btn) {
    btn.classList.add('visible');
    setTimeout(() => btn.classList.remove('visible'), 5000);
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

  // Mettre en surbrillance l'événement concerné
  const eventEl = document.querySelector(`[data-event-id="${event.id}"]`);
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
    const response = await fetch(`${API_BASE}/api/display/tv-public-state`);
    const state = await response.json();

    // Appliquer la config (variables CSS)
    tvConfig = state.config || {};
    applyConfig(tvConfig);

    // Message d'accueil
    const welcomeEl = document.getElementById('welcome');
    if (welcomeEl && state.welcomeMessage) {
      welcomeEl.innerHTML = `<span>${state.welcomeMessage}</span>`;
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

  } catch (error) {
    console.error('Erreur chargement état TV:', error);
  }
}

// ===============================================
//  APPLIQUER LA CONFIGURATION VISUELLE
// ===============================================
function applyConfig(config) {
  const root = document.documentElement;
  if (config.primaryColor) root.style.setProperty('--primary-color', config.primaryColor);
  if (config.secondaryColor) root.style.setProperty('--secondary-color', config.secondaryColor);
  if (config.eventBgColor) root.style.setProperty('--event-bg-color', config.eventBgColor);
  if (config.eventTextColor) root.style.setProperty('--event-text-color', config.eventTextColor);
  if (config.fontFamily) root.style.setProperty('--font-family', config.fontFamily);

  // Overscan TV : ?overscan=XX dans l'URL (en px), ou auto-détection Raspberry Pi
  const params = new URLSearchParams(window.location.search);
  let overscan = parseInt(params.get('overscan'), 10);
  if (isNaN(overscan)) {
    // Auto-détection : appliquer une marge par défaut sur les navigateurs embarqués (Pi, etc.)
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('raspbian') || ua.includes('raspberry') || ua.includes('chromium') && ua.includes('linux armv')) {
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
function renderEvents(events) {
  // Séparer événements réguliers et récurrents
  const regular = events.filter(e => !e.is_recurrent);
  const recurrent = events.filter(e => e.is_recurrent);

  const regularList = document.getElementById('regular-events-list');
  const recurrentList = document.getElementById('recurrent-events-list');

  if (regularList) {
    if (regular.length === 0) {
      regularList.innerHTML = '<li>Aucune tâche planifiée aujourd\'hui</li>';
    } else {
      regularList.innerHTML = '';
      regular.forEach(event => {
        const li = createEventElement(event);
        regularList.appendChild(li);
      });
    }
  }

  if (recurrentList) {
    if (recurrent.length === 0) {
      recurrentList.innerHTML = '<li>Aucune tâche récurrente</li>';
    } else {
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

  const timeStr = event.time || '';
  const endTimeStr = event.end_time || '';
  const periodLabels = { AM: 'Matin', PM: 'Après-midi', JOURNEE: 'Journée' };
  const periodStr = periodLabels[event.period] || event.period || '';
  const timeDisplay = timeStr
    ? (endTimeStr ? `${timeStr} → ${endTimeStr}` : timeStr)
    : (periodStr || '');
  const eventTitle = event.title || 'Sans titre';
  const eventLocation = event.location || '';
  const affaireNum = event.affaire_num || '';
  const affaireType = event.affaire_type || '';

  // Vérifier si terminé (status 'done' dans la planification OU marqué manuellement sur l'écran)
  const isCompleted = event.status === 'done' || completedEvents.includes(eventId);

  // Rechercher icône de lieu (sur titre + sectionLabel + location)
  const searchTextForIcon = `${eventTitle} ${event.section || ''} ${event.sectionLabel || ''} ${eventLocation}`;
  const locationIcon = getLocationIcon(searchTextForIcon);

  // Construire le contenu de la colonne lieu
  let locationContent;
  if (locationIcon) {
    locationContent = `<div class="location-icon"><img src="/api/display/gifs/${locationIcon}" alt="${event.sectionLabel || ''}"></div>`;
  } else if (eventLocation) {
    locationContent = eventLocation;
  } else {
    locationContent = event.sectionLabel || '';
  }

  // Badge affaire (couleur selon le type d'affaire)
  const AFFAIRE_TYPE_COLORS = {
    Prestation: '#3b82f6', Location: '#f59e0b', Installation: '#10b981',
    Vente: '#8b5cf6', 'Tournée': '#ec4899',
  };
  const badgeColor = AFFAIRE_TYPE_COLORS[affaireType] || '#3b82f6';
  const affaireBadge = affaireNum
    ? `<span class="tv-affaire-badge" style="--badge-color:${badgeColor}">${affaireNum}</span>`
    : '';

  li.innerHTML = `
    <div class="event-columns">
      <div class="col-time">${timeDisplay}</div>
      <div class="col-title">${isCompleted ? '<span class="completed-icon">✅</span>' : ''}${eventTitle}</div>
      <div class="col-location">${locationContent}</div>
      <div class="col-affaire">${affaireBadge}</div>
    </div>
  `;

  // Marquer comme terminé si c'est le cas
  if (isCompleted) li.classList.add('event-completed');

  // Gestionnaire de clic pour toggle completed
  li.style.cursor = 'pointer';
  li.addEventListener('click', () => toggleEventComplete(eventId, li));

  // Application des couleurs personnalisées (mot-clé dans titre + section + location)
  const searchText = `${eventTitle} ${event.section || ''} ${event.sectionLabel || ''} ${eventLocation}`.toLowerCase();
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
    const response = await fetch(`${API_BASE}${endpoint}`, {
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

    const response = await fetch(`${API_BASE}/api/display/weather`);
    const data = await response.json();
    const weatherEl = document.getElementById('weather');

    if (weatherEl && data && !data.error && data.main) {
      const temp = Math.round(data.main.temp);
      const desc = data.weather?.[0]?.description || '';
      const icon = getWeatherIcon(data.weather?.[0]?.icon);
      const wind = data.wind?.speed ? Math.round(data.wind.speed * 3.6) : null;
      let text = `${icon} ${temp}°C`;
      if (desc) text += ` • ${desc}`;
      if (wind) text += ` • ${wind} km/h`;
      weatherEl.textContent = text;
      weatherEl.style.display = 'block';
    } else if (weatherEl) {
      weatherEl.textContent = '';
    }
  } catch (error) {
    console.error('Erreur météo:', error);
  }
}

function getWeatherIcon(iconCode) {
  const iconMap = {
    '01d': '☀️', '01n': '🌙', '02d': '🌤️', '02n': '☁️',
    '03d': '☁️', '03n': '☁️', '04d': '☁️', '04n': '☁️',
    '09d': '🌧️', '09n': '🌧️', '10d': '🌦️', '10n': '🌧️',
    '11d': '⛈️', '11n': '⛈️', '13d': '❄️', '13n': '❄️',
    '50d': '🌫️', '50n': '🌫️'
  };
  return iconMap[iconCode] || '🌡️';
}

// ===============================================
//  SONOS
// ===============================================
async function loadSonosNowPlaying() {
  try {
    const response = await fetch(`${API_BASE}/api/display/sonos-now-playing`);
    const data = await response.json();
    updateSonosWidget(data);
  } catch (error) {
    console.error('Erreur Sonos:', error);
    const widget = document.getElementById('sonos-widget');
    if (widget) widget.style.display = 'none';
  }
}

function updateSonosWidget(data) {
  const widget = document.getElementById('sonos-widget');
  const albumArt = document.getElementById('sonos-album-art');
  const titleEl = document.getElementById('sonos-title');
  const artistEl = document.getElementById('sonos-artist');

  if (!widget) return;

  if (data && data.playing && data.title) {
    widget.style.display = 'flex';
    if (albumArt) {
      albumArt.src = data.albumArtURI || data.albumArt || '/display-logo/logo.png';
      albumArt.onerror = () => { albumArt.onerror = null; albumArt.src = '/display-logo/logo.png'; };
    }

    // Radio : Sonos met souvent "Artiste - Titre" dans le champ title, avec artist vide
    let displayTitle = data.title;
    let displayArtist = data.artist || '';
    if (!displayArtist && displayTitle.includes(' - ')) {
      const parts = displayTitle.split(' - ');
      displayArtist = parts[0].trim();
      displayTitle = parts.slice(1).join(' - ').trim();
    }

    if (titleEl) titleEl.textContent = displayTitle;
    if (artistEl) artistEl.textContent = displayArtist;
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

  let scrollPosition = 0;
  const scrollSpeed = 0.5;
  const pauseAtBottom = 3000;
  const pauseAtTop = 2000;
  let isPaused = false;

  function scroll() {
    if (isPaused) return;
    const maxScroll = mainElement.scrollHeight - mainElement.clientHeight;
    if (maxScroll > 0) {
      scrollPosition += scrollSpeed;
      if (scrollPosition >= maxScroll) {
        scrollPosition = maxScroll;
        isPaused = true;
        setTimeout(() => {
          scrollPosition = 0;
          mainElement.scrollTop = 0;
          isPaused = true;
          setTimeout(() => { isPaused = false; }, pauseAtTop);
        }, pauseAtBottom);
      }
      mainElement.scrollTop = scrollPosition;
    }
  }

  setInterval(scroll, 16);
}

// ===============================================
//  BOUTON DE TEST SONORE
// ===============================================
function setupTestSoundButton() {
  const btn = document.getElementById('btn-test-sound');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    console.log('🔔 Test sonore SNCF.wav');
    playAlarmSound();
    btn.classList.add('test-playing');
    setTimeout(() => btn.classList.remove('test-playing'), 2000);
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
  setInterval(checkAlarms, 1000);               // Alarmes : chaque seconde

  setInterval(refreshTokenSilently, 6 * 60 * 60 * 1000); // Token refresh : toutes les 6h

  // Bouton de test sonore
  setupTestSoundButton();

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
