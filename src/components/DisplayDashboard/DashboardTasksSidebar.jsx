// ═══════════════════════════════════════════════════════════════
// DashboardTasksSidebar — Panneau latéral gauche dans Dashboard Écrans
// Affiche les tâches du jour (comme dans la planification, sans événements)
// + widget Sonos lecture en cours en bas
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { ClipboardList, Clock, Check, Music, Disc, RefreshCw, ChevronDown, ChevronRight, Truck } from 'lucide-react';
import api from '../../utils/api';

// ─── Sections (mêmes que TaskPlanningPanel, sans rdv/evenements) ───
const SECTIONS = {
  taches_prioritaires: { label: 'Prioritaires',        emoji: '🔴', color: '#ef4444' },
  courses:             { label: 'Courses',              emoji: '🚗', color: '#8b5cf6' },
  prep_locations:      { label: 'Prépa Locations',      emoji: '📦', color: '#f59e0b' },
  prep_prestations:    { label: 'Prépa Prestations',    emoji: '🎤', color: '#3b82f6' },
  prep_ventes:         { label: 'Prépa Ventes',         emoji: '🏷️', color: '#10b981' },
  prep_installations:  { label: 'Prépa Installations',  emoji: '⚙️', color: '#8b5cf6' },
  prep_tournees:       { label: 'Prépa Tournées',       emoji: '🚐', color: '#ec4899' },
  chargement:          { label: 'Chargement',           emoji: '📦', color: '#f59e0b' },
  depart:              { label: 'Départ',               emoji: '🚀', color: '#3b82f6' },
  installation:        { label: 'Installation',         emoji: '🛠️', color: '#10b981' },
  montage:             { label: 'Montage',              emoji: '🔩', color: '#0891b2' },
  demontage:           { label: 'Démontage',            emoji: '🔧', color: '#dc2626' },
  taches_secondaires:  { label: 'Secondaires',          emoji: '🟡', color: '#f59e0b' },
  manual:              { label: 'Autres',               emoji: '📋', color: '#64748b' },
};

const SECTION_ALIASES = { enlevement: 'courses', retour: 'courses', recuperation: 'courses' };
const normalizeSection = (sec) => SECTION_ALIASES[sec] || sec;
const SECTION_ORDER = Object.keys(SECTIONS);

function DashboardTasksSidebar({ refreshKey }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState({});

  // Sonos state
  const [nowPlaying, setNowPlaying] = useState(null);
  const sonosInterval = useRef(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // ─── Chargement tâches du jour ───
  const loadTasks = useCallback(async () => {
    try {
      const data = await api.getTasks({ date: today });
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [today]);

  // ─── Sonos now playing ───
  const loadNowPlaying = useCallback(async () => {
    try {
      const data = await api.getDisplaySonosNowPlaying();
      setNowPlaying(data);
    } catch {
      setNowPlaying({ playing: false, error: 'Erreur de connexion' });
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadNowPlaying();
    // Refresh tâches toutes les 60s, Sonos toutes les 10s
    const taskTimer = setInterval(loadTasks, 60000);
    sonosInterval.current = setInterval(loadNowPlaying, 10000);
    return () => {
      clearInterval(taskTimer);
      if (sonosInterval.current) clearInterval(sonosInterval.current);
    };
  }, [loadTasks, loadNowPlaying, refreshKey]);

  // ─── Grouper par section ───
  const grouped = useMemo(() => {
    const groups = {};
    SECTION_ORDER.forEach(key => { groups[key] = []; });
    tasks.forEach(t => {
      // Exclure les événements Google Calendar (sourceType === 'google_event' sans section opérationnelle)
      if (t.sourceType === 'google_event' && !t.section) return;
      const sec = normalizeSection(t.section || 'manual');
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(t);
    });
    return groups;
  }, [tasks]);

  // Compteur total tâches
  const totalTasks = tasks.filter(t => !(t.sourceType === 'google_event' && !t.section)).length;
  const doneTasks = tasks.filter(t => t.status === 'done' && !(t.sourceType === 'google_event' && !t.section)).length;

  const toggleSection = (key) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="dash-tasks-sidebar">
      {/* ─── En-tête ─── */}
      <div className="dash-tasks-header">
        <ClipboardList size={16} />
        <span className="dash-tasks-title">Tâches du jour</span>
        <span className="dash-tasks-count">{doneTasks}/{totalTasks}</span>
      </div>

      {/* ─── Date ─── */}
      <div className="dash-tasks-date">
        {new Date(today + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>

      {/* ─── Liste par section ─── */}
      <div className="dash-tasks-list">
        {loading ? (
          <div className="dash-tasks-loading">Chargement…</div>
        ) : totalTasks === 0 ? (
          <div className="dash-tasks-empty">Aucune tâche aujourd'hui</div>
        ) : (
          SECTION_ORDER.map(key => {
            const items = grouped[key];
            if (!items || items.length === 0) return null;
            const section = SECTIONS[key];
            const collapsed = collapsedSections[key];
            return (
              <div key={key} className="dash-section">
                <button className="dash-section-header" onClick={() => toggleSection(key)}>
                  {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  <span className="dash-section-emoji">{section.emoji}</span>
                  <span className="dash-section-label" style={{ color: section.color }}>{section.label}</span>
                  <span className="dash-section-count">{items.length}</span>
                </button>
                {!collapsed && (
                  <div className="dash-section-items">
                    {items.map(task => {
                      const isDone = task.status === 'done';
                      const isProgress = task.status === 'in_progress';
                      return (
                        <div key={task.id} className={`dash-task-item ${isDone ? 'done' : ''} ${isProgress ? 'in-progress' : ''}`}>
                          <span className={`dash-task-status ${isDone ? 'done' : isProgress ? 'in-progress' : ''}`}>
                            {isDone ? <Check size={10} /> : isProgress ? <Clock size={10} /> : null}
                          </span>
                          <div className="dash-task-info">
                            <div className="dash-task-name">{task.title}</div>
                            {task.time && (
                              <span className="dash-task-time"><Clock size={9} /> {task.time}{task.endTime ? ` → ${task.endTime}` : ''}</span>
                            )}
                            {task.reservation_vehicle_name && (
                              <span className="dash-task-vehicle"><Truck size={9} /> {task.reservation_vehicle_name}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ─── Sonos widget ─── */}
      <div className="dash-sonos-widget">
        <div className="dash-sonos-header">
          <Music size={14} />
          <span>Sonos</span>
          <button className="dash-sonos-refresh" onClick={loadNowPlaying} title="Rafraîchir">
            <RefreshCw size={10} />
          </button>
        </div>
        {nowPlaying && nowPlaying.playing ? (
          <div className="dash-sonos-playing">
            {nowPlaying.albumArtURI && (
              <img src={nowPlaying.albumArtURI} alt="" className="dash-sonos-art" />
            )}
            <div className="dash-sonos-info">
              <div className="dash-sonos-title">{nowPlaying.title}</div>
              <div className="dash-sonos-artist">{nowPlaying.artist}</div>
              {nowPlaying.duration > 0 && (
                <div className="dash-sonos-time">
                  {formatTime(nowPlaying.position)} / {formatTime(nowPlaying.duration)}
                </div>
              )}
            </div>
            <Disc size={16} className="dash-sonos-spinning" />
          </div>
        ) : (
          <div className="dash-sonos-idle">
            <Music size={16} />
            <span>{nowPlaying?.error || 'Aucune lecture'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(DashboardTasksSidebar);
