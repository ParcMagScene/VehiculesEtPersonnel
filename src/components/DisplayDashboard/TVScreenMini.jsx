// ═══════════════════════════════════════════════════════════════
// TVScreenMini — Rendu miniature de l'écran TV Dashboard
// Réplique fidèle du client calendar-dashboard en version réduite
// Aligné sur : calendar-dashboard/client/ (index.html + styles.css)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, memo } from 'react';

const SAMPLE_REGULAR = [
  { time: '08:00', title: 'Livraison matériel chantier Dupont', location: 'Entrepôt A', description: 'Presta LM' },
  { time: '09:30', title: 'Installation sono festival', location: 'Salle des fêtes', description: 'Location' },
  { time: '', title: 'Maintenance éclairage scène 2', location: 'Bureau', description: '' },
  { time: '14:00', title: 'Retour camion-grue', location: 'Dépôt', description: 'Livraison' },
  { time: '15:30', title: 'Préparation commande Mairie', location: 'Entrepôt B', description: '' },
];

const SAMPLE_RECURRENT = [
  { time: '07:30', title: 'Briefing équipe matin', location: 'Bureau', description: '' },
  { time: '17:00', title: 'Rangement dépôt', location: 'Dépôt', description: '' },
];

function TVScreenMini({ state = {} }) {
  const [clock, setClock] = useState(() => new Date());
  const eventsRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll miniature (réplique du comportement calendar-dashboard)
  useEffect(() => {
    const el = eventsRef.current;
    if (!el) return;
    let pos = 0;
    let paused = false;
    const speed = 0.3;
    const id = setInterval(() => {
      if (paused) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      pos += speed;
      if (pos >= max) {
        pos = max;
        paused = true;
        setTimeout(() => { pos = 0; el.scrollTop = 0; paused = true; setTimeout(() => { paused = false; }, 1500); }, 2000);
      }
      el.scrollTop = pos;
    }, 16);
    return () => clearInterval(id);
  }, []);

  const config = state.config || {};
  const primaryColor = config.primaryColor || '#00e1ff';
  const secondaryColor = config.secondaryColor || '#000000';
  const eventBgColor = config.eventBgColor || '#000000';
  const eventTextColor = config.eventTextColor || '#ffffff';
  const fontFamily = config.fontFamily || 'Arial, sans-serif';
  const welcomeMessage = state.welcomeMessage || 'Bienvenue !';
  const colorRules = state.colorRules || [];
  const iconRules = state.iconRules || [];
  const logoUrl = state.logoUrl || null;
  const sneakyPhoto = state.sneakyPhoto || { active: false };

  // Séparer événements réguliers et récurrents (comme calendar-dashboard)
  const allEvents = state.events && state.events.length > 0 ? state.events : null;
  const regularEvents = allEvents
    ? allEvents.filter(e => !e.is_recurrent)
    : SAMPLE_REGULAR;
  const recurrentEvents = allEvents
    ? allEvents.filter(e => e.is_recurrent)
    : SAMPLE_RECURRENT;

  const dateStr = clock.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = clock.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const getEventColor = (title, location) => {
    const searchText = `${title} ${location}`.toLowerCase();
    for (const rule of colorRules) {
      if (rule.keyword && searchText.includes(rule.keyword.toLowerCase())) {
        return rule.color;
      }
    }
    return eventTextColor;
  };

  const getLocationIcon = (location) => {
    if (!location) return null;
    const locLower = location.toLowerCase();
    for (const rule of iconRules) {
      if (rule.keyword && locLower.includes(rule.keyword.toLowerCase())) {
        return rule.gif_filename;
      }
    }
    return null;
  };

  const renderEvent = (evt, i) => {
    const color = getEventColor(evt.title, evt.location);
    const iconFile = getLocationIcon(evt.location);
    const isAllDay = !evt.time;
    return (
      <div
        key={i}
        className={`tv-mini-event${isAllDay ? ' all-day' : ''}`}
        style={{ color, background: eventBgColor }}
      >
        <span className="tv-mini-evt-time">{evt.time || ''}</span>
        <span className="tv-mini-evt-title">{evt.title}</span>
        <span className="tv-mini-evt-loc">
          {iconFile ? (
            <img src={`/display-gifs/${iconFile}`} alt="" className="tv-mini-evt-icon" />
          ) : (
            evt.location || ''
          )}
        </span>
        <span className="tv-mini-evt-desc">{evt.description || ''}</span>
      </div>
    );
  };

  return (
    <div className="tv-mini-screen" style={{ background: eventBgColor, fontFamily }}>
      {/* ─── Header (grid 3 colonnes, réplique calendar-dashboard) ─── */}
      <div className="tv-mini-header" style={{ background: secondaryColor }}>
        <div className="tv-mini-logo-zone">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="tv-mini-logo" />
          ) : (
            <div className="tv-mini-logo-placeholder" style={{ color: primaryColor }}>LOGO</div>
          )}
        </div>

        <div className="tv-mini-marquee-zone">
          {/* Edge-fade like calendar-dashboard #welcome::before/::after */}
          <div className="tv-mini-marquee-fade left" style={{ background: `linear-gradient(to right, ${secondaryColor}, transparent)` }} />
          <div className="tv-mini-marquee" style={{ color: primaryColor }}>
            <span>{welcomeMessage}</span>
          </div>
          <div className="tv-mini-marquee-fade right" style={{ background: `linear-gradient(to left, ${secondaryColor}, transparent)` }} />
        </div>

        <div className="tv-mini-datetime-zone" style={{ color: primaryColor }}>
          <div className="tv-mini-date">{dateStr}</div>
          <div className="tv-mini-time">{timeStr}</div>
          {config.showWeather && (
            <div className="tv-mini-weather">
              {state.weather
                ? `${state.weather.icon || '☀️'} ${state.weather.temp || '28'}°C`
                : '☀️ 28°C'}
            </div>
          )}
        </div>
      </div>

      {/* ─── Main (events + recurrent, réplique calendar-dashboard) ─── */}
      <div className="tv-mini-main" ref={eventsRef}>
        {/* Événements ponctuels */}
        <div className="tv-mini-events">
          {regularEvents.length > 0
            ? regularEvents.map(renderEvent)
            : <div className="tv-mini-no-events">Aucun événement aujourd'hui</div>
          }
        </div>

        {/* Événements récurrents (section en bas, comme calendar-dashboard) */}
        {recurrentEvents.length > 0 && (
          <div className="tv-mini-recurrent-section">
            <div className="tv-mini-recurrent-title" style={{ color: primaryColor, borderColor: primaryColor }}>
              🔄 Récurrents
            </div>
            <div className="tv-mini-events">
              {recurrentEvents.map(renderEvent)}
            </div>
          </div>
        )}
      </div>

      {/* ─── Sneaky photo (slide left-to-right, like calendar-dashboard) ─── */}
      {sneakyPhoto.active && sneakyPhoto.path && (
        <div className="tv-mini-sneaky">
          <img src={sneakyPhoto.path} alt="Sneaky" />
        </div>
      )}

      {/* ─── Sonos widget (floating bottom center, like calendar-dashboard) ─── */}
      {state.sonos?.playing && (
        <div className="tv-mini-sonos" style={{ borderColor: primaryColor, color: primaryColor }}>
          {state.sonos.albumArt && (
            <img src={state.sonos.albumArt} alt="" className="tv-mini-sonos-art" />
          )}
          <div className="tv-mini-sonos-info">
            <span className="tv-mini-sonos-title">{state.sonos.title}</span>
            <span className="tv-mini-sonos-artist">{state.sonos.artist}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(TVScreenMini);
