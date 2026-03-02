// ═══════════════════════════════════════════════════════════════
// TVScreenMini — Rendu miniature de l'écran TV Dashboard
// Réplique fidèle du client TV en version réduite
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, memo } from 'react';

const SAMPLE_EVENTS = [
  { time: '08:00', title: 'Livraison matériel chantier Dupont', location: 'Entrepôt A', description: 'Presta LM' },
  { time: '09:30', title: 'Installation sono festival', location: 'Salle des fêtes', description: 'Location' },
  { time: '', title: 'Maintenance éclairage scène 2', location: 'Bureau', description: '' },
  { time: '14:00', title: 'Retour camion-grue', location: 'Dépôt', description: 'Livraison' },
  { time: '15:30', title: 'Préparation commande Mairie', location: 'Entrepôt B', description: '' },
];

function TVScreenMini({ state = {} }) {
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
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
  const events = state.events && state.events.length > 0 ? state.events : SAMPLE_EVENTS;

  const dateStr = clock.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = clock.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Appliquer les règles de couleur pour un événement
  const getEventColor = (title, location) => {
    const searchText = `${title} ${location}`.toLowerCase();
    for (const rule of colorRules) {
      if (rule.keyword && searchText.includes(rule.keyword.toLowerCase())) {
        return rule.color;
      }
    }
    return eventTextColor;
  };

  // Trouver l'icône GIF pour un lieu
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

  return (
    <div className="tv-mini-screen" style={{ background: eventBgColor, fontFamily }}>
      {/* ─── Header ─── */}
      <div className="tv-mini-header" style={{ background: secondaryColor }}>
        <div className="tv-mini-logo-zone">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="tv-mini-logo" />
          ) : (
            <div className="tv-mini-logo-placeholder" style={{ color: primaryColor }}>LOGO</div>
          )}
        </div>

        <div className="tv-mini-marquee-zone">
          <div className="tv-mini-marquee" style={{ color: primaryColor }}>
            <span>{welcomeMessage}</span>
          </div>
        </div>

        <div className="tv-mini-datetime-zone" style={{ color: primaryColor }}>
          <div className="tv-mini-date">{dateStr}</div>
          <div className="tv-mini-time">{timeStr}</div>
          {config.showWeather && (
            <div className="tv-mini-weather">☀️ 28°C</div>
          )}
        </div>
      </div>

      {/* ─── Events ─── */}
      <div className="tv-mini-events">
        {events.map((evt, i) => {
          const color = getEventColor(evt.title, evt.location);
          const iconFile = getLocationIcon(evt.location);
          const isAllDay = !evt.time;

          return (
            <div
              key={i}
              className={`tv-mini-event${isAllDay ? ' all-day' : ''}`}
              style={{
                color,
                background: eventBgColor,
                borderColor: isAllDay ? 'rgba(135, 206, 235, 0.4)' : 'transparent',
              }}
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
        })}
      </div>

      {/* ─── Sneaky photo ─── */}
      {sneakyPhoto.active && sneakyPhoto.path && (
        <div className="tv-mini-sneaky">
          <img src={sneakyPhoto.path} alt="Sneaky" />
        </div>
      )}

      {/* ─── Sonos widget ─── */}
      {state.sonos?.playing && (
        <div className="tv-mini-sonos" style={{ borderColor: primaryColor, color: primaryColor }}>
          <span className="tv-mini-sonos-icon">🎵</span>
          <span className="tv-mini-sonos-track">{state.sonos.title} — {state.sonos.artist}</span>
        </div>
      )}
    </div>
  );
}

export default memo(TVScreenMini);
