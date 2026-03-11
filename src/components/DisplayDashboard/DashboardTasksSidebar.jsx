// ═══════════════════════════════════════════════════════════════
// DashboardTasksSidebar — Panneau latéral gauche dans Dashboard Écrans
// Affiche les tâches du jour (filtrable par section) avec couleurs
// automatiques (type de tâche + type d'affaire) + widget Sonos
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import {
  ClipboardList, Clock, Check, Music, Disc, RefreshCw,
  ChevronDown, ChevronRight, Truck, Settings, Eye, EyeOff,
  Save, Briefcase
} from 'lucide-react';
import api from '../../utils/api';
import { AFFAIRE_TYPES } from '../../utils/affaireConstants';

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

// Lookup rapide type d'affaire par clé
const AFFAIRE_TYPE_MAP = Object.fromEntries(AFFAIRE_TYPES.map(t => [t.value, t]));

// ─── Nettoyage du titre de tâche (retire emojis, label de section, numéro AF) ───
const SECTION_LABEL_RE = /^(Pr[eé]paration|Chargement|D[eé]part|Enl[eè]vement|Retour|R[eé]cup[eé]ration|Installation|Livraison|Montage|D[eé]montage|Prioritaires?|Secondaires?|Courses?|Divers)\s*[—–\-:]?\s*/i;
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u2700-\u27BF]/gu;

function stripAfNum(text, task) {
  const affNum = (task.affaire_num || task.affaireNum || '');
  if (!affNum) return text;
  const digits = affNum.replace(/^AF/i, '');
  if (!digits) return text;
  const flexDigits = digits.split('').join('\\s*');
  return text.replace(new RegExp('\\bAF\\s*' + flexDigits + '\\b', 'gi'), '');
}

function cleanTaskDisplayTitle(task) {
  const rawGev = (task.google_event_title || '').trim();
  const rawTitle = (task.title || '').trim();

  // 1. Si google_event_title existe → utiliser (nettoyé)
  if (rawGev) {
    let t = rawGev.replace(EMOJI_RE, '').trim();
    t = t.replace(SECTION_LABEL_RE, '').trim();
    t = stripAfNum(t, task);
    t = t.replace(/\s*[—–\-]\s*(?=[—–\-]|$)/g, '').replace(/^[\s—–\-]+/, '').replace(/\s{2,}/g, ' ').trim();
    if (t) return t;
  }

  // 2. Sinon, utiliser le titre brut (retirer juste les emojis + AF, garder le label de section)
  if (rawTitle) {
    let t = rawTitle.replace(EMOJI_RE, '').trim();
    t = stripAfNum(t, task);
    t = t.replace(/\s*[—–\-]\s*(?=[—–\-]|$)/g, '').replace(/^[\s—–\-]+/, '').replace(/\s{2,}/g, ' ').trim();
    if (t) return t;
  }

  return task.notes || '-';
}

function DashboardTasksSidebar({ refreshKey, style }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState({});

  // Section filter
  const [visibleSections, setVisibleSections] = useState(null); // null = all visible
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterDirty, setFilterDirty] = useState(false);

  // Affaires cache (pour résoudre la couleur du type d'affaire)
  const [affairesMap, setAffairesMap] = useState({});

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

  // ─── Chargement config sidebar (sections visibles) ───
  const loadSidebarConfig = useCallback(async () => {
    try {
      const data = await api.getDisplaySidebarConfig();
      setVisibleSections(data.sections); // null = all
    } catch { /* ignore */ }
  }, []);

  // ─── Chargement des affaires (pour résoudre les types) ───
  const loadAffaires = useCallback(async () => {
    try {
      const data = await api.getAffaires();
      const map = {};
      (Array.isArray(data) ? data : []).forEach(a => {
        if (a.numeroAffaire) map[a.numeroAffaire.toUpperCase()] = a;
      });
      setAffairesMap(map);
    } catch { /* ignore */ }
  }, []);

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
    loadSidebarConfig();
    loadAffaires();
    const taskTimer = setInterval(loadTasks, 60000);
    sonosInterval.current = setInterval(loadNowPlaying, 10000);
    return () => {
      clearInterval(taskTimer);
      if (sonosInterval.current) clearInterval(sonosInterval.current);
    };
  }, [loadTasks, loadNowPlaying, loadSidebarConfig, loadAffaires, refreshKey]);

  // ─── Résoudre la couleur d'une tâche ───
  const getTaskColor = useCallback((task) => {
    // 1. Si une affaire est liée → couleur du type d'affaire
    const affNum = (task.affaire_num || task.affaireNum || '').toUpperCase();
    if (affNum) {
      const affaire = affairesMap[affNum];
      if (affaire && affaire.type) {
        const typeInfo = AFFAIRE_TYPE_MAP[affaire.type];
        if (typeInfo) return typeInfo.color;
      }
      // Fallback : essayer depuis event_category
      if (task.event_category) {
        const cat = task.event_category.toLowerCase();
        if (cat === 'prestation') return '#3b82f6';
        if (cat === 'location') return '#f59e0b';
        if (cat === 'installation') return '#10b981';
        if (cat === 'vente') return '#8b5cf6';
        if (cat.includes('tourn')) return '#ec4899';
      }
    }
    // 2. Couleur de la section
    const sec = normalizeSection(task.section || 'manual');
    const sectionInfo = SECTIONS[sec];
    return sectionInfo ? sectionInfo.color : '#64748b';
  }, [affairesMap]);

  // ─── Grouper par section ───
  const grouped = useMemo(() => {
    const groups = {};
    SECTION_ORDER.forEach(key => { groups[key] = []; });
    tasks.forEach(t => {
      if (t.sourceType === 'google_event' && !t.section) return;
      const sec = normalizeSection(t.section || 'manual');
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(t);
    });
    return groups;
  }, [tasks]);

  // Sections filtrées
  const filteredOrder = useMemo(() => {
    if (!visibleSections) return SECTION_ORDER;
    return SECTION_ORDER.filter(k => visibleSections.includes(k));
  }, [visibleSections]);

  // Compteur total tâches (dans sections visibles)
  const totalTasks = useMemo(() => {
    let count = 0;
    filteredOrder.forEach(k => { count += (grouped[k] || []).length; });
    return count;
  }, [grouped, filteredOrder]);

  const doneTasks = useMemo(() => {
    let count = 0;
    filteredOrder.forEach(k => {
      (grouped[k] || []).forEach(t => { if (t.status === 'done') count++; });
    });
    return count;
  }, [grouped, filteredOrder]);

  const toggleSection = (key) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Filter toggles ───
  const toggleSectionFilter = (key) => {
    setFilterDirty(true);
    setVisibleSections(prev => {
      const current = prev || [...SECTION_ORDER];
      if (current.includes(key)) {
        const next = current.filter(k => k !== key);
        return next.length === 0 ? [key] : next; // empêcher vide
      }
      return [...current, key];
    });
  };

  const selectAllSections = () => {
    setFilterDirty(true);
    setVisibleSections(null);
  };

  const saveSidebarConfig = useCallback(async () => {
    try {
      await api.saveDisplaySidebarConfig(visibleSections);
      setFilterDirty(false);
    } catch { /* ignore */ }
  }, [visibleSections]);

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Résoudre badge affaire sur la tâche
  const getAffaireBadge = useCallback((task) => {
    const affNum = (task.affaire_num || task.affaireNum || '').toUpperCase();
    if (!affNum) return null;
    const affaire = affairesMap[affNum];
    const typeInfo = affaire?.type ? AFFAIRE_TYPE_MAP[affaire.type] : null;
    return { num: affNum, color: typeInfo?.color || '#6366f1', icon: typeInfo?.icon || '📋' };
  }, [affairesMap]);

  return (
    <div className="dash-tasks-sidebar" style={style}>
      {/* ─── En-tête ─── */}
      <div className="dash-tasks-header">
        <ClipboardList size={16} />
        <span className="dash-tasks-title">Tâches du jour</span>
        <span className="dash-tasks-count">{doneTasks}/{totalTasks}</span>
        <button
          className={`dash-filter-btn ${showFilterPanel ? 'active' : ''}`}
          onClick={() => setShowFilterPanel(p => !p)}
          title="Filtrer les sections"
        >
          <Settings size={13} />
        </button>
      </div>

      {/* ─── Panneau filtre sections ─── */}
      {showFilterPanel && (
        <div className="dash-filter-panel">
          <div className="dash-filter-top">
            <span className="dash-filter-label">Sections affichées</span>
            <button className="dash-filter-all" onClick={selectAllSections}>Toutes</button>
          </div>
          <div className="dash-filter-grid">
            {SECTION_ORDER.map(key => {
              const sec = SECTIONS[key];
              const isVisible = !visibleSections || visibleSections.includes(key);
              const count = (grouped[key] || []).length;
              return (
                <button
                  key={key}
                  className={`dash-filter-chip ${isVisible ? 'on' : 'off'}`}
                  onClick={() => toggleSectionFilter(key)}
                  style={isVisible ? { borderColor: sec.color, color: sec.color } : {}}
                >
                  {isVisible ? <Eye size={10} /> : <EyeOff size={10} />}
                  <span>{sec.emoji} {sec.label}</span>
                  {count > 0 && <span className="dash-filter-chip-count">{count}</span>}
                </button>
              );
            })}
          </div>
          {filterDirty && (
            <button className="dash-filter-save" onClick={saveSidebarConfig}>
              <Save size={12} /> Enregistrer
            </button>
          )}
        </div>
      )}

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
          filteredOrder.map(key => {
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
                      const taskColor = getTaskColor(task);
                      const affBadge = getAffaireBadge(task);
                      return (
                        <div
                          key={task.id}
                          className={`dash-task-item ${isDone ? 'done' : ''} ${isProgress ? 'in-progress' : ''}`}
                          style={{ borderLeftColor: taskColor }}
                        >
                          <span className={`dash-task-status ${isDone ? 'done' : isProgress ? 'in-progress' : ''}`}>
                            {isDone ? <Check size={10} /> : isProgress ? <Clock size={10} /> : null}
                          </span>
                          <div className="dash-task-info">
                            <div className="dash-task-name-row">
                              {affBadge && (
                                <span
                                  className="dash-task-affaire"
                                  style={{ background: `${affBadge.color}14`, color: affBadge.color, borderColor: `${affBadge.color}40` }}
                                  title={affBadge.num}
                                >
                                  <Briefcase size={8} /> {affBadge.num}
                                </span>
                              )}
                              <span className="dash-task-name">{cleanTaskDisplayTitle(task)}</span>
                            </div>
                            <div className="dash-task-meta">
                              {task.time && (
                                <span className="dash-task-time"><Clock size={9} /> {task.time}{task.endTime ? ` → ${task.endTime}` : ''}</span>
                              )}
                              {task.reservation_vehicle_name && (
                                <span className="dash-task-vehicle"><Truck size={9} /> {task.reservation_vehicle_name}</span>
                              )}
                            </div>
                            {task.notes && (
                              <div className="dash-task-notes">{task.notes}</div>
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
        {nowPlaying && nowPlaying.title ? (
          <div className={`dash-sonos-playing ${nowPlaying.playing ? '' : 'paused'}`}>
            {nowPlaying.albumArtURI && (
              <img src={nowPlaying.albumArtURI} alt="" className="dash-sonos-art" />
            )}
            <div className="dash-sonos-info">
              <div className="dash-sonos-title">{nowPlaying.title}</div>
              <div className="dash-sonos-artist">{nowPlaying.artist}{nowPlaying.playing ? '' : ' — en pause'}</div>
              {nowPlaying.duration > 0 && (
                <div className="dash-sonos-time">
                  {formatTime(nowPlaying.position)} / {formatTime(nowPlaying.duration)}
                </div>
              )}
            </div>
            {nowPlaying.playing && <Disc size={16} className="dash-sonos-spinning" />}
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
