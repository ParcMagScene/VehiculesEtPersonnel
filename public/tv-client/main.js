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
    renderEvents(state.events || []);

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
  const eventTitle = event.title || 'Sans titre';
  const eventLocation = event.location || '';
  const eventDescription = event.description || '';

  // Vérifier si terminé
  const isCompleted = completedEvents.includes(eventId);

  // Rechercher icône de lieu (sur titre + sectionLabel + location)
  const searchTextForIcon = `${eventTitle} ${event.sectionLabel || ''} ${eventLocation}`;
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

  // Section badge (label coloré)
  const sectionBadge = event.sectionLabel ? `<span class="section-badge">${event.sectionLabel}</span>` : '';

  li.innerHTML = `
    <div class="event-columns">
      <div class="col-time">${timeStr}</div>
      <div class="col-title">${isCompleted ? '<span class="completed-icon">✅</span>' : ''}${eventTitle}</div>
      <div class="col-location">${locationContent}</div>
      <div class="col-description">${eventDescription}</div>
    </div>
  `;

  // Marquer comme terminé si c'est le cas
  if (isCompleted) li.classList.add('event-completed');

  // Gestionnaire de clic pour toggle completed
  li.style.cursor = 'pointer';
  li.addEventListener('click', () => toggleEventComplete(eventId, li));

  // Application des couleurs personnalisées (mot-clé dans titre + section + location)
  const searchText = `${eventTitle} ${event.sectionLabel || ''} ${eventLocation}`.toLowerCase();
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
  const title = document.getElementById('sonos-title');
  const artist = document.getElementById('sonos-artist');

  if (!widget) return;

  if (data && data.playing && data.title) {
    widget.style.display = 'flex';
    if (albumArt) albumArt.src = data.albumArt || '/display-logo/logo.png';
    if (title) title.textContent = data.title;
    if (artist) artist.textContent = data.artist || '';
  } else {
    widget.style.display = 'none';
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
