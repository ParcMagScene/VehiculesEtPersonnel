import './MobileTasks.css';
import './MobileModuleWrapper.css';

import {
  ArrowLeft,
  Briefcase,
  CheckCircle,
  Circle,
  Clock,
  MapPin,
  RefreshCw,
  User,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Accordion, Button, ProgressBar } from '@/design-system';

import { ROLES, STATUS } from '../../constants';
import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import useSwipeAction from '../../hooks/useSwipeAction';
import api from '../../utils/api';
import PullToRefreshIndicator from './PullToRefreshIndicator';
import SwipeableRow from './SwipeableRow';

const SECTIONS = {
  rdv: { label: 'Rendez-vous', emoji: '📅', color: STATUS_COLORS.info },
  evenements: { label: 'Événements', emoji: '📌', color: '#64748b' },
  taches_prioritaires: { label: 'Prioritaires', emoji: '🔴', color: STATUS_COLORS.danger },
  courses: { label: 'Courses', emoji: '🚗', color: STATUS_COLORS.warning },
  prep_locations: { label: 'Prép. Locations', emoji: '📦', color: ACCENT_COLORS.violet },
  prep_prestations: { label: 'Prép. Prestations', emoji: '🎤', color: ACCENT_COLORS.pink },
  prep_ventes: { label: 'Prép. Ventes', emoji: '🏷️', color: '#14b8a6' },
  prep_installations: { label: 'Prép. Installations', emoji: '⚙️', color: '#8b5cf6' },
  prep_tournees: { label: 'Prép. Tournées', emoji: '🚐', color: '#ec4899' },
  chargement: { label: 'Chargement', emoji: '📦', color: ACCENT_COLORS.indigo },
  depart: { label: 'Départ', emoji: '🚀', color: '#0ea5e9' },
  enlevement: { label: 'Enlèvement', emoji: '📦', color: '#f59e0b' },
  installation: { label: 'Installation', emoji: '🛠️', color: STATUS_COLORS.success },
  montage: { label: 'Montage', emoji: '🔩', color: '#059669' },
  demontage: { label: 'Démontage', emoji: '🔧', color: STATUS_COLORS.warningDark },
  intervention: { label: 'Intervention', emoji: '🛠️', color: '#0d9488' },
  retour: { label: 'Retour', emoji: '↩️', color: '#8b5cf6' },
  recuperation: { label: 'Récupération', emoji: '📥', color: '#ef4444' },
  depot: { label: 'Dépôt', emoji: '🏠', color: '#6366f1' },
  taches_secondaires: { label: 'Secondaires', emoji: '🟡', color: ACCENT_COLORS.amber },
  manual: { label: 'Autres', emoji: '📋', color: STATUS_COLORS.neutralSoft },
};

const STATUS_INFO = {
  pending: { label: 'À faire', icon: Circle, color: '#94a3b8' },
  in_progress: { label: 'En cours', icon: Clock, color: STATUS_COLORS.warning },
  done: { label: 'Validée', icon: CheckCircle, color: STATUS_COLORS.success },
  cancelled: { label: 'Annulée', icon: XCircle, color: STATUS_COLORS.danger },
};

function MobileTasks({ currentUser, onBack }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [personId, setPersonId] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState(new Set());
  const [showAllTasks, setShowAllTasks] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  // Résoudre le person_id lié au user courant
  useEffect(() => {
    if (!currentUser) return;
    const resolve = async () => {
      try {
        const persons = await api.getPersons();
        const me = persons.find((p) => p.userId === currentUser.id || p.user_id === currentUser.id);
        if (me) setPersonId(me.id);
      } catch (e) {
        console.error('Erreur résolution personne:', e);
      }
    };
    resolve();
  }, [currentUser]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = { date: today };
      const data = await api.getTasks(params);
      const all = Array.isArray(data) ? data : [];
      // En mode "mes tâches" : assignées à moi + non assignées
      if (personId && !showAllTasks) {
        setTasks(all.filter((t) => !t.person_id || t.person_id === personId));
      } else {
        setTasks(all);
      }
    } catch (e) {
      console.error('Erreur chargement tâches:', e);
    }
    setLoading(false);
  }, [today, personId, showAllTasks]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const { containerProps: ptrProps, indicatorNode: ptrIndicator } = usePullToRefresh(loadTasks);
  const { getSwipeProps, swipeState, resetSwipe } = useSwipeAction();

  const handleValidate = async (task) => {
    const newStatus = task.status === STATUS.DONE ? 'pending' : 'done';
    setUpdating(task.id);
    try {
      await api.updateTask(task.id, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    } catch (e) {
      console.error('Erreur mise à jour statut:', e);
    }
    setUpdating(null);
  };

  const toggleSection = (key) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Grouper par section (fallback to 'manual' if section not in SECTIONS)
  const grouped = {};
  tasks.forEach((t) => {
    const sec = t.section && SECTIONS[t.section] ? t.section : 'manual';
    if (!grouped[sec]) grouped[sec] = [];
    grouped[sec].push(t);
  });

  const activeSections = Object.keys(SECTIONS).filter((k) => grouped[k]?.length > 0);
  const doneCount = tasks.filter((t) => t.status === STATUS.DONE).length;
  const totalCount = tasks.length;
  const isAdmin = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.MANAGER;

  return (
    <div className="mobile-tasks">
      <div className="mobile-tasks-header">
        <Button variant="ghost" className="mobile-back-btn" onClick={onBack} aria-label="Retour">
          <ArrowLeft size={20} />
        </Button>
        <h2>Tâches du jour</h2>
        <Button
          variant="ghost"
          className="mobile-tasks-refresh"
          onClick={loadTasks}
          disabled={loading}
          aria-label="Actualiser"
        >
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </Button>
      </div>

      {/* Barre de progression */}
      <div className="mobile-tasks-progress">
        <ProgressBar
          value={doneCount}
          max={totalCount || 1}
          size="lg"
          color="success"
          label={`${doneCount}/${totalCount} validée${doneCount > 1 ? 's' : ''}`}
        />
      </div>

      {/* Toggle mes tâches / toutes (admin seulement) */}
      {isAdmin && personId && (
        <div className="mobile-tasks-toggle">
          <Button
            variant="ghost"
            className={!showAllTasks ? 'active' : ''}
            onClick={() => setShowAllTasks(false)}
          >
            <User size={14} /> Mes tâches
          </Button>
          <Button
            variant="ghost"
            className={showAllTasks ? 'active' : ''}
            onClick={() => setShowAllTasks(true)}
          >
            Toutes
          </Button>
        </div>
      )}

      {/* Liste */}
      <div className="mobile-tasks-list" {...ptrProps}>
        <PullToRefreshIndicator indicator={ptrIndicator} />
        {loading && tasks.length === 0 ? (
          <div className="mobile-tasks-empty">
            <RefreshCw size={32} className="spin" />
            <p>Chargement…</p>
          </div>
        ) : activeSections.length === 0 ? (
          <div className="mobile-tasks-empty">
            <CheckCircle size={40} />
            <p>Aucune tâche pour aujourd'hui</p>
            {!personId && <span>Votre compte n'est pas lié à une fiche personnel</span>}
          </div>
        ) : (
          activeSections.map((sectionKey) => {
            const info = SECTIONS[sectionKey] || SECTIONS.manual;
            const sectionTasks = grouped[sectionKey];
            const collapsed = collapsedSections.has(sectionKey);
            const sectionDone = sectionTasks.filter((t) => t.status === STATUS.DONE).length;

            return (
              <div key={sectionKey} className="mobile-tasks-section">
                <Accordion
                  title={
                    <>
                      <span className="mobile-tasks-section-emoji">{info.emoji}</span>{' '}
                      <span className="mobile-tasks-section-label">{info.label}</span>{' '}
                      <span className="mobile-tasks-section-count" style={{ color: info.color }}>
                        {sectionDone}/{sectionTasks.length}
                      </span>
                    </>
                  }
                  open={!collapsed}
                  onToggle={() => toggleSection(sectionKey)}
                  className="mobile-tasks-section-accordion"
                >
                  <div className="mobile-tasks-section-items">
                    {sectionTasks.map((task) => {
                      const st = STATUS_INFO[task.status] || STATUS_INFO.pending;
                      const isDone = task.status === STATUS.DONE;
                      const isUpdating = updating === task.id;

                      return (
                        <SwipeableRow
                          key={task.id}
                          itemId={task.id}
                          swipeState={swipeState}
                          getSwipeProps={getSwipeProps}
                          onReset={resetSwipe}
                          leftAction={{
                            label: isDone ? 'À faire' : 'Valider',
                            icon: isDone ? '↩️' : '✅',
                            color: isDone ? STATUS_COLORS.warning : STATUS_COLORS.success,
                            onClick: () => handleValidate(task),
                          }}
                        >
                          <div
                            className={`mobile-task-card ${isDone ? 'done' : ''} ${isUpdating ? 'updating' : ''}`}
                          >
                            <Button
                              variant="ghost"
                              className={`mobile-task-status-btn ${task.status}`}
                              onClick={() => handleValidate(task)}
                              disabled={isUpdating}
                              title={isDone ? 'Remettre à faire' : 'Valider'}
                            >
                              <st.icon size={22} />
                            </Button>
                            <div className="mobile-task-content">
                              <span className={`mobile-task-title ${isDone ? 'done' : ''}`}>
                                {task.title || '—'}
                              </span>
                              <div className="mobile-task-meta">
                                {task.time && (
                                  <span className="mobile-task-time">
                                    <Clock size={11} /> {task.time}
                                    {task.endTime ? ` → ${task.endTime}` : ''}
                                  </span>
                                )}
                                {task.affaireNum && (
                                  <span className="mobile-task-affaire">
                                    <Briefcase size={11} /> {task.affaireNum}
                                  </span>
                                )}
                                {task.locationAddress && (
                                  <span className="mobile-task-location">
                                    <MapPin size={11} />{' '}
                                    {task.locationAddress.split('\n')[0].slice(0, 30)}
                                  </span>
                                )}
                                {showAllTasks &&
                                  (task.personFirstName || task.person_first_name) && (
                                    <span className="mobile-task-person">
                                      <User size={11} />{' '}
                                      {task.personFirstName || task.person_first_name}
                                    </span>
                                  )}
                              </div>
                              {task.notes && <p className="mobile-task-notes">{task.notes}</p>}
                            </div>
                          </div>
                        </SwipeableRow>
                      );
                    })}
                  </div>
                </Accordion>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default MobileTasks;
