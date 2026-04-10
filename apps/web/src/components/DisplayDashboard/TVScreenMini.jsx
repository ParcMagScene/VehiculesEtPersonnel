// ═══════════════════════════════════════════════════════════════
// TVScreenMini — Rendu miniature de l'écran TV Dashboard
// Réplique fidèle du client calendar-dashboard en version réduite
// Aligné sur : calendar-dashboard/client/ (index.html + styles.css)
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, memo } from 'react';

import { STATUS } from '../../constants';

const SAMPLE_TASKS = [
  { time: '07:00', period: 'AM', title: 'Prépa sono festival Dupont', section: 'prep_locations', sectionLabel: 'Prépa Location', status: STATUS.PENDING, affaireNum: 'AF32887', affaireType: 'Location' },
  { time: '08:30', period: 'AM', title: 'Chargement camion 3T', section: 'chargement', sectionLabel: 'Chargement', status: STATUS.PENDING, affaireNum: '' },
  { time: '09:00', period: 'AM', title: 'Départ livraison Mairie', section: 'depart', sectionLabel: 'Départ', status: STATUS.DONE, affaireNum: 'AF32899', affaireType: 'Prestation' },
  { time: '', period: 'PM', title: 'Récup du barnum Legrand', section: 'recuperation', sectionLabel: 'Récupération', status: STATUS.PENDING, affaireNum: '' },
  { time: '15:30', period: 'PM', title: 'Courses visserie + câbles', section: 'courses', sectionLabel: 'Courses', status: STATUS.PENDING, affaireNum: '' },
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

  // Événements = tâches du jour (format enrichi depuis tv-state)
  const tasks = state.events && state.events.length > 0 ? state.events : SAMPLE_TASKS;

  const dateStr = clock.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = clock.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Couleur par recherche substring (aligné sur le vrai client TV main.js)
  // Cherche le keyword dans title + sectionLabel + location (pas juste section)
  const getTaskColor = (task) => {
    const searchText = `${task.title || ''} ${task.section || ''} ${task.sectionLabel || ''} ${task.location || ''}`.toLowerCase();
    for (const rule of colorRules) {
      if (rule.keyword && searchText.includes(rule.keyword.toLowerCase())) {
        return rule.color;
      }
    }
    return eventTextColor;
  };

  // Icône animée par recherche substring (aligné sur le vrai client TV main.js)
  const getTaskIcon = (task) => {
    const searchText = `${task.title || ''} ${task.section || ''} ${task.sectionLabel || ''} ${task.location || ''}`.toLowerCase();
    for (const rule of iconRules) {
      if (rule.keyword && searchText.includes(rule.keyword.toLowerCase())) {
        return rule.gifFilename || rule.gif_filename;
      }
    }
    return null;
  };

  // Couleurs par type d'affaire (aligné sur AffaireBadge / affaireConstants)
  const AFFAIRE_TYPE_COLORS = {
    Prestation: '#3b82f6', Location: '#f59e0b', Installation: '#10b981',
    Vente: '#8b5cf6', 'Tournée': '#ec4899',
  };

  const completed = state.completedEvents || [];

  const renderTask = (task, i) => {
    const color = getTaskColor(task);
    const iconFile = getTaskIcon(task);
    const eventId = String(task.id || i);
    const isDone = task.status === STATUS.DONE || completed.includes(eventId);
    // Plage horaire : "07:00 → 08:30" comme le vrai TV
    const endTime = task.end_time || task.endTime || '';
    const timeDisplay = task.time
      ? (endTime ? `${task.time} → ${endTime}` : task.time)
      : (task.period === 'AM' ? 'Matin' : task.period === 'PM' ? 'Après-midi' : '');
    const affNum = task.affaireNum || task.affaire_num || '';
    const affType = task.affaireType || task.affaire_type || '';
    const badgeColor = AFFAIRE_TYPE_COLORS[affType] || '#3b82f6';
    return (
      <div
        key={i}
        className={`tv-mini-event${isDone ? ' done' : ''}${!task.time ? ' all-day' : ''}${task.title && task.title.includes('!') && !isDone ? ' urgent' : ''}`}
        style={{ color: isDone ? undefined : color, background: eventBgColor }}
      >
        <span className="tv-mini-evt-time">{timeDisplay}</span>
        <span className="tv-mini-evt-title">{isDone ? '✅ ' : ''}{task.title}</span>
        <span className="tv-mini-evt-loc">
          {iconFile ? (
            <img src={`/api/display/gifs/${iconFile}`} alt="" className="tv-mini-evt-icon" />
          ) : (
            task.sectionLabel || ''
          )}
        </span>
        <span className="tv-mini-evt-affaire">
          {affNum ? <span className="tv-mini-affaire-badge" style={{ '--badge-color': badgeColor }}>{affNum}</span> : ''}
        </span>
      </div>
    );
  };

  // Séparer régulières / récurrentes (comme le vrai TV)
  const regularTasks = tasks.filter(t => !t.is_recurrent);
  const recurrentTasks = tasks.filter(t => t.is_recurrent);

  // Sonos : artiste/titre fournis directement par le backend
  const sonosTitle = state.sonos?.title || '';
  const sonosArtist = state.sonos?.artist || '';

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

      {/* ─── Main (tâches du jour, réplique calendar-dashboard) ─── */}
      <div className="tv-mini-main" ref={eventsRef}>
        <div className="tv-mini-events">
          {regularTasks.length > 0
            ? regularTasks.map(renderTask)
            : <div className="tv-mini-no-events">Aucune tâche planifiée aujourd'hui</div>
          }
        </div>
        {recurrentTasks.length > 0 && (
          <div className="tv-mini-events tv-mini-recurrent">
            {recurrentTasks.map(renderTask)}
          </div>
        )}
      </div>

      {/* ─── Sneaky photo (slide left-to-right, like calendar-dashboard) ─── */}
      {sneakyPhoto.active && sneakyPhoto.path && (
        <div className="tv-mini-sneaky">
          <img src={sneakyPhoto.path} alt="Sneaky" />
        </div>
      )}

      {/* ─── Sonos widget (visible uniquement si en lecture, comme le vrai TV) ─── */}
      {state.sonos && state.sonos.playing && state.sonos.title && (
        <div className="tv-mini-sonos playing" style={{ borderColor: primaryColor, color: primaryColor }}>
          {state.sonos.albumArtURI && (
            <img src={state.sonos.albumArtURI} alt="" className="tv-mini-sonos-art" />
          )}
          <div className="tv-mini-sonos-info">
            <span className="tv-mini-sonos-title">{sonosTitle}</span>
            <span className="tv-mini-sonos-artist">{sonosArtist}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(TVScreenMini);
