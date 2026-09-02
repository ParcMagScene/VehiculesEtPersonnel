// ═══════════════════════════════════════════════════════════════
// DashboardTasksSidebar — Panneau latéral gauche dans Dashboard Écrans
// Affiche les tâches du jour (filtrable par section) avec couleurs
// automatiques (type de tâche + type d'affaire) + widget Sonos
// ═══════════════════════════════════════════════════════════════
/* eslint-disable no-misleading-character-class */

import {
  Briefcase,
  Check,
  ClipboardList,
  Clock,
  Disc,
  Eye,
  EyeOff,
  Music,
  RefreshCw,
  Save,
  Settings,
  Truck,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Accordion, Button, Tooltip } from '@/design-system';

import { STATUS } from '../../constants';
import { ACCENT_COLORS, PLANNING_SECTIONS, STATUS_COLORS } from '../../constants/colors';
import { useAffairesList } from '../../hooks/useAffairesList';
import { useRefreshSubscription } from '../../hooks/useRefreshSubscription';
import { useToast } from '../../hooks/useToast';
import { AFFAIRE_TYPES } from '../../utils/affaireConstants';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';

// ─── Sections (depuis colorConstants, labels courts pour sidebar) ───
const SECTIONS = Object.fromEntries(
  Object.entries(PLANNING_SECTIONS)
    .filter(([k]) => k !== 'rdv' && k !== 'evenements' && k !== 'depot')
    .map(([k, v]) => [
      k,
      {
        ...v,
        label:
          k === 'taches_prioritaires'
            ? 'Prioritaires'
            : k === 'taches_secondaires'
              ? 'Secondaires'
              : k.startsWith('prep_')
                ? v.label.replace('Préparations ', 'Prépa ')
                : v.label,
      },
    ]),
);

const SECTION_ALIASES = { enlevement: 'courses', retour: 'courses', recuperation: 'courses' };
const normalizeSection = (sec) => SECTION_ALIASES[sec] || sec;
const SECTION_ORDER = Object.keys(SECTIONS);

// Lookup rapide type d'affaire par clé
const AFFAIRE_TYPE_MAP = Object.fromEntries(AFFAIRE_TYPES.map((t) => [t.value, t]));

// ─── Nettoyage du titre de tâche (retire emojis, label de section, numéro AF) ───
const SECTION_LABEL_RE =
  /^(Pr(?:e|é)paration|Chargement|D(?:e|é)part|Enl(?:e|è)vement|Retour|R(?:e|é)cup(?:e|é)ration|Installation|Livraison|Montage|D(?:e|é)montage|Prioritaires?|Secondaires?|Courses?|Divers)\s*[—–\-:]?\s*/i;
// eslint-disable-next-line no-misleading-character-class
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u2700-\u27BF]/gu;

// Extrait un numéro d'affaire générique (AF\d{3,}) depuis un texte libre.
function extractAfFromText(text) {
  if (!text) return '';
  const m = String(text).match(/\bAF\s*\d{3,}\b/i);
  return m ? m[0].toUpperCase().replace(/\s+/g, '') : '';
}

function stripAfNum(text, task) {
  if (!text) return text;
  const affNumLinked = task.affaire_num || task.affaireNum || '';
  const affNum = affNumLinked || extractAfFromText(text);
  if (!affNum) return text;
  const digits = affNum.replace(/^AF/i, '');
  if (!digits) return text;
  const flexDigits = digits.split('').join('\\s*');
  return text.replace(new RegExp('\\bAF\\s*' + flexDigits + '\\b', 'gi'), '');
}

function cleanTaskDisplayTitle(task, affaireName) {
  const rawTitle = (task.title || '').trim();
  const rawGev = (task.google_event_title || '').trim();

  // 1. Priorité : titre édité par l'utilisateur
  if (rawTitle) {
    let t = rawTitle.replace(EMOJI_RE, '').trim();
    t = t.replace(SECTION_LABEL_RE, '').trim();
    t = stripAfNum(t, task);
    t = t
      .replace(/\s*[—–-]\s*(?=[—–-]|$)/g, '')
      .replace(/^[\s—–-]+/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (t) return t.charAt(0).toUpperCase() + t.slice(1);
  }

  // 2. Fallback : google_event_title
  if (rawGev) {
    let t = rawGev.replace(EMOJI_RE, '').trim();
    t = t.replace(SECTION_LABEL_RE, '').trim();
    t = stripAfNum(t, task);
    t = t
      .replace(/\s*[—–-]\s*(?=[—–-]|$)/g, '')
      .replace(/^[\s—–-]+/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (t) return t.charAt(0).toUpperCase() + t.slice(1);
  }

  // 3. Fallback : nom de l'affaire > notes (peut contenir un AF à retirer)
  const fallbackRaw = affaireName || task.notes || '-';
  const fallback =
    stripAfNum(fallbackRaw, task)
      .replace(/\s*[—–-]\s*(?=[—–-]|$)/g, '')
      .replace(/^[\s—–-]+/, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || '-';
  return fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

function DashboardTasksSidebar({ refreshKey, style }) {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState({});

  // Section filter
  const [visibleSections, setVisibleSections] = useState(null); // null = all visible
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterDirty, setFilterDirty] = useState(false);

  // Affaires : source unique via useAffairesList (cache IDB + subscribe bus auto).
  // Expose une map indexée par numeroAffaire.toUpperCase() pour le lookup.
  const { affairesMap } = useAffairesList();

  // Sonos state
  const [nowPlaying, setNowPlaying] = useState(null);
  const taskInterval = useRef(null);
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
    } catch {
      /* ignore */
    }
  }, []);

  // ─── Sonos now playing ───
  // Anti-clignotement :
  //  - on dédoublonne via comparaison shallow des champs significatifs pour éviter un setState
  //    inutile (qui re-monterait l'<img> et causerait un flash visuel).
  //  - en cas d'erreur transitoire, on conserve la dernière lecture connue plutôt que de
  //    basculer sur l'état "idle/erreur" (ce qui faisait alterner playing ⇄ idle toutes les 10 s).
  const sonosFailRef = useRef(0);
  const loadNowPlaying = useCallback(async () => {
    try {
      const data = await api.getSonosNowPlaying();
      sonosFailRef.current = 0;
      setNowPlaying((prev) => {
        if (!prev && !data) return prev;
        if (
          prev &&
          data &&
          prev.title === data.title &&
          prev.artist === data.artist &&
          prev.albumArtURI === data.albumArtURI &&
          prev.playing === data.playing &&
          prev.duration === data.duration &&
          // tolérance 2s sur la position pour éviter un re-render à chaque tick
          Math.abs((prev.position || 0) - (data.position || 0)) < 2
        ) {
          return prev;
        }
        return data;
      });
    } catch {
      // 1ʳᵉ et 2ᵉ erreurs → on garde l'état précédent (réseau hoquet).
      // Au-delà, on bascule en mode erreur explicite.
      sonosFailRef.current += 1;
      if (sonosFailRef.current >= 3) {
        setNowPlaying({ playing: false, error: 'Erreur de connexion' });
      }
    }
  }, []);

  useEffect(() => {
    const stopPolling = () => {
      if (taskInterval.current) {
        clearInterval(taskInterval.current);
        taskInterval.current = null;
      }
      if (sonosInterval.current) {
        clearInterval(sonosInterval.current);
        sonosInterval.current = null;
      }
    };

    const startPolling = () => {
      if (!taskInterval.current) taskInterval.current = setInterval(loadTasks, 60000);
      if (!sonosInterval.current) sonosInterval.current = setInterval(loadNowPlaying, 10000);
    };

    const refreshAndResume = () => {
      if (document.hidden) {
        stopPolling();
        return;
      }
      loadTasks();
      loadNowPlaying();
      startPolling();
    };

    loadSidebarConfig();
    refreshAndResume();

    const onVisibility = () => refreshAndResume();
    const onFocus = () => refreshAndResume();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      stopPolling();
    };
  }, [loadTasks, loadNowPlaying, loadSidebarConfig, refreshKey]);

  // Auto-refresh quand le planning change ailleurs (TaskPlanning, EventTaskModal, mobile, etc.).
  useRefreshSubscription('planning', loadTasks);

  // Refresh affaires : géré automatiquement par useAffairesList (bus 'affaires' + 'reservations').

  // ─── Toggle visibilité d'une tâche (afficher/masquer sur l'écran TV) ───
  const handleToggleVisible = useCallback(
    async (task) => {
      try {
        await api.toggleTaskVisibility(task.id);
        loadTasks();
        refreshBus.publish('planning');
      } catch {
        toast.error('Impossible de modifier la visibilité de la tâche.');
      }
    },
    [loadTasks, toast],
  );

  // ─── Résoudre la couleur d'une tâche ───
  const getTaskColor = useCallback(
    (task) => {
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
          if (cat === 'prestation') return STATUS_COLORS.info;
          if (cat === 'location') return STATUS_COLORS.warning;
          if (cat === 'installation') return STATUS_COLORS.success;
          if (cat === 'vente') return ACCENT_COLORS.violet;
          if (cat.includes('tourn')) return ACCENT_COLORS.pink;
        }
      }
      // 2. Couleur de la section
      const sec = normalizeSection(task.section || 'manual');
      const sectionInfo = SECTIONS[sec];
      return sectionInfo ? sectionInfo.color : STATUS_COLORS.neutral;
    },
    [affairesMap],
  );

  // ─── Grouper par section (exclure les tâches validées) ───
  const grouped = useMemo(() => {
    const groups = {};
    SECTION_ORDER.forEach((key) => {
      groups[key] = [];
    });
    tasks.forEach((t) => {
      if (t.status === STATUS.DONE) return;
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
    return SECTION_ORDER.filter((k) => visibleSections.includes(k));
  }, [visibleSections]);

  // Compteur total tâches (dans sections visibles)
  const totalTasks = useMemo(() => {
    let count = 0;
    filteredOrder.forEach((k) => {
      count += (grouped[k] || []).length;
    });
    return count;
  }, [grouped, filteredOrder]);

  const doneTasks = useMemo(() => {
    let count = 0;
    filteredOrder.forEach((k) => {
      (grouped[k] || []).forEach((t) => {
        if (t.status === STATUS.DONE) count++;
      });
    });
    return count;
  }, [grouped, filteredOrder]);

  const toggleSection = (key) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Filter toggles ───
  const toggleSectionFilter = (key) => {
    setFilterDirty(true);
    setVisibleSections((prev) => {
      const current = prev || [...SECTION_ORDER];
      if (current.includes(key)) {
        const next = current.filter((k) => k !== key);
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
    } catch {
      /* ignore */
    }
  }, [visibleSections]);

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Résoudre badge affaire sur la tâche
  const getAffaireBadge = useCallback(
    (task) => {
      const linkedAf = (task.affaire_num || task.affaireNum || '').toUpperCase();
      const affNum =
        linkedAf || extractAfFromText(task.title) || extractAfFromText(task.google_event_title);
      if (!affNum) return null;
      const affaire = affairesMap[affNum];
      const typeInfo = affaire?.type ? AFFAIRE_TYPE_MAP[affaire.type] : null;
      const name = (
        affaire?.nom ||
        affaire?.titre ||
        affaire?.client ||
        task.eventClient ||
        ''
      ).trim();
      return {
        num: affNum,
        name,
        color: typeInfo?.color || ACCENT_COLORS.indigo,
        icon: typeInfo?.icon || '📋',
      };
    },
    [affairesMap],
  );

  return (
    <div className="dash-tasks-sidebar" style={style}>
      {/* ─── En-tête ─── */}
      <div className="dash-tasks-header">
        <ClipboardList size={16} />
        <span className="dash-tasks-title">Tâches du jour</span>
        <span className="dash-tasks-count">
          {doneTasks}/{totalTasks}
        </span>
        <Button
          variant="ghost"
          className={`dash-filter-btn ${showFilterPanel ? 'active' : ''}`}
          onClick={() => setShowFilterPanel((p) => !p)}
          title="Filtrer les sections"
        >
          <Settings size={13} />
        </Button>
      </div>

      {/* ─── Panneau filtre sections ─── */}
      {showFilterPanel && (
        <div className="dash-filter-panel">
          <div className="dash-filter-top">
            <span className="dash-filter-label">Sections affichées</span>
            <Button variant="ghost" className="dash-filter-all" onClick={selectAllSections}>
              Toutes
            </Button>
          </div>
          <div className="dash-filter-grid">
            {SECTION_ORDER.map((key) => {
              const sec = SECTIONS[key];
              const isVisible = !visibleSections || visibleSections.includes(key);
              const count = (grouped[key] || []).length;
              return (
                <Button
                  variant="ghost"
                  key={key}
                  className={`dash-filter-chip ${isVisible ? 'on' : 'off'}`}
                  onClick={() => toggleSectionFilter(key)}
                  style={isVisible ? { borderColor: sec.color, color: sec.color } : {}}
                >
                  {isVisible ? <Eye size={10} /> : <EyeOff size={10} />}
                  <span>
                    {sec.emoji} {sec.label}
                  </span>
                  {count > 0 && <span className="dash-filter-chip-count">{count}</span>}
                </Button>
              );
            })}
          </div>
          {filterDirty && (
            <Button variant="ghost" className="dash-filter-save" onClick={saveSidebarConfig}>
              <Save size={12} /> Enregistrer
            </Button>
          )}
        </div>
      )}

      {/* ─── Date ─── */}
      <div className="dash-tasks-date">
        {new Date(today + 'T00:00').toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
      </div>

      {/* ─── Liste par section ─── */}
      <div className="dash-tasks-list">
        {loading ? (
          <div className="dash-tasks-loading">Chargement…</div>
        ) : totalTasks === 0 ? (
          <div className="dash-tasks-empty">Aucune tâche aujourd'hui</div>
        ) : (
          filteredOrder.map((key) => {
            const items = grouped[key];
            if (!items || items.length === 0) return null;
            const section = SECTIONS[key];
            const collapsed = collapsedSections[key];
            return (
              <div key={key} className="dash-section">
                <Accordion
                  title={
                    <>
                      <span className="dash-section-emoji">{section.emoji}</span>{' '}
                      <span className="dash-section-label" style={{ color: section.color }}>
                        {section.label}
                      </span>{' '}
                      <span className="dash-section-count">{items.length}</span>
                    </>
                  }
                  open={!collapsed}
                  onToggle={() => toggleSection(key)}
                  className="dash-section-accordion"
                >
                  <div className="dash-section-items">
                    {items.map((task) => {
                      const isDone = task.status === STATUS.DONE;
                      const isProgress = task.status === 'in_progress';
                      const isHidden = task.visible === 0;
                      const taskColor = getTaskColor(task);
                      const affBadge = getAffaireBadge(task);
                      return (
                        <div
                          key={task.id}
                          className={`dash-task-item ${isDone ? 'done' : ''} ${isProgress ? 'in-progress' : ''} ${isHidden ? 'hidden-task' : ''}`}
                          style={{ borderLeftColor: taskColor }}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            className={`dash-task-visible-btn ${isHidden ? 'off' : ''}`}
                            onClick={() => handleToggleVisible(task)}
                            title={isHidden ? "Afficher sur l'écran TV" : "Masquer de l'écran TV"}
                          >
                            {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
                          </Button>
                          <span
                            className={`dash-task-status ${isDone ? 'done' : isProgress ? 'in-progress' : ''}`}
                          >
                            {isDone ? <Check size={10} /> : isProgress ? <Clock size={10} /> : null}
                          </span>
                          <div className="dash-task-info">
                            <div className="dash-task-name-row">
                              {affBadge && (
                                <span
                                  className="dash-task-affaire"
                                  style={{
                                    background: `${affBadge.color}14`,
                                    color: affBadge.color,
                                    borderColor: `${affBadge.color}40`,
                                  }}
                                  title={affBadge.num}
                                >
                                  <Briefcase size={8} /> {affBadge.name || affBadge.num}
                                </span>
                              )}
                              <span className="dash-task-name">
                                {cleanTaskDisplayTitle(task, affBadge?.name)}
                              </span>
                            </div>
                            <div className="dash-task-meta">
                              {(task.time || task.period) && (
                                <span className="dash-task-time">
                                  <Clock size={9} />
                                  {task.time
                                    ? `${task.time}${task.endTime ? ` → ${task.endTime}` : ''}`
                                    : { AM: 'Matin', PM: 'Après-midi', JOURNEE: 'Journée' }[
                                        task.period
                                      ] || task.period}
                                </span>
                              )}
                              {task.reservation_vehicle_name && (
                                <span className="dash-task-vehicle">
                                  <Truck size={9} /> {task.reservation_vehicle_name}
                                </span>
                              )}
                            </div>
                            {task.notes && <div className="dash-task-notes">{task.notes}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Accordion>
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
          <Tooltip content="Rafraîchir">
            <Button variant="ghost" className="dash-sonos-refresh" onClick={loadNowPlaying}>
              <RefreshCw size={10} />
            </Button>
          </Tooltip>
        </div>
        {nowPlaying && nowPlaying.title ? (
          <div className={`dash-sonos-playing ${nowPlaying.playing ? '' : 'paused'}`}>
            {nowPlaying.albumArtURI && (
              <img
                src={nowPlaying.albumArtURI}
                alt=""
                loading="lazy"
                className="dash-sonos-art"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div className="dash-sonos-info">
              <div className="dash-sonos-title">{nowPlaying.title}</div>
              <div className="dash-sonos-artist">
                {nowPlaying.artist}
                {nowPlaying.playing ? '' : ' — en pause'}
              </div>
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
