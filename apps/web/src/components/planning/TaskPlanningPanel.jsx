import './TaskPlanningPanel.css';

import {
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileDown,
  LayoutList,
  Plus,
  Settings,
  SkipForward,
} from 'lucide-react';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Tooltip } from '@/design-system';

import { STATUS } from '../../constants';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { safeParseDate } from '../../utils/dateUtils';
import { formatDateFr } from '../../utils/formatUtils';
import AddTaskModal from './AddTaskModal';
import EventTaskModal from './EventTaskModal';
import TaskEditModal from './TaskEditModal';
import { usePlanningModal } from './PlanningModalContext';
const TaskPDFExportModal = lazy(() => import('./TaskPDFExportModal'));

import {
  addDays,
  formatDateShort,
  getWeekDays,
  mapAffaireToSection,
  normalizeSection,
  SECTIONS,
  todayStr,
} from './planningConstants';
import { PlanningDayView, PlanningRecurringPanel } from './PlanningDayView';
import { GoogleRdvRow, IcalEventRow, MultiAssignWidget, RdvRow } from './PlanningEventRows';
import { PlanningTaskRow } from './PlanningTaskRow';
import { PlanningWeekView } from './PlanningWeekView';

// ==============================================================
// TaskPlanningPanel — lean container (data + state + routing)
// ==============================================================
function TaskPlanningPanel({ _currentUser, refreshKey, googleEvents = [], onNavigateToEntity }) {
  const { modal, openModal, closeModal } = usePlanningModal();
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [editingTask, setEditingTask] = useState(null);
  const [tasks, setTasks] = useState([]),
    [persons, setPersons] = useState([]),
    [affaires, setAffaires] = useState([]);
  const [loading, setLoading] = useState(true),
    [selectedDate, setSelectedDate] = useState(todayStr()),
    [viewMode, setViewMode] = useState('day');
  const [expandedWeekDay, setExpandedWeekDay] = useState(null),
    [wkSplitRatio, setWkSplitRatio] = useState(50);
  const wkSplitDragging = useRef(false),
    wkSplitContentRef = useRef(null);
  const [showPdfExport, setShowPdfExport] = useState(false),
    [displayEvents, setDisplayEvents] = useState([]);
  const [vehicles, setVehicles] = useState([]),
    [reservations, setReservations] = useState([]);
  const [planningAssignments, setPlanningAssignments] = useState([]),
    [assigningEntity, setAssigningEntity] = useState(null);
  const [expandedRdv, setExpandedRdv] = useState(null),
    [eventTaskModalEvent, setEventTaskModalEvent] = useState(null);
  // Les états modaux sont maintenant gérés par le contexte
  const [showRecurring, setShowRecurring] = useState(false),
    [recurringTasks, setRecurringTasks] = useState([]),
    [recurringForm, setRecurringForm] = useState(null);

  // Patch : ferme tous les autres modaux avant d’ouvrir EventTaskModal
  // Ouvre un modal de façon centralisée
  const openEventTaskModal = useCallback(
    (event) => {
      openModal('event-task', { event });
    },
    [openModal],
  );

  const openAddTaskModal = useCallback(() => {
    openModal('add-task', {});
  }, [openModal]);

  const openTaskEditModal = useCallback(
    (task) => {
      openModal('edit-task', { task });
    },
    [openModal],
  );

  // Remplacer tous les usages de setEventTaskModalEvent(event) par openEventTaskModal(event)
  const [collapsedSections, setCollapsedSections] = useState({});
  const toggleSectionCollapse = useCallback(
    (key) => setCollapsedSections((p) => ({ ...p, [key]: !p[key] })),
    [],
  );
  const [collapsedPastEvents, setCollapsedPastEvents] = useState(true),
    [collapsedFutureEvents, setCollapsedFutureEvents] = useState(true);
  const [_eventStatuses, setEventStatuses] = useState(new Map());
  const [icalCalendars, setIcalCalendars] = useState([]),
    [icalEvents, setIcalEvents] = useState([]);
  const [showIcalManager, setShowIcalManager] = useState(false),
    [icalForm, setIcalForm] = useState(null),
    [icalLoading, setIcalLoading] = useState(false);
  const [linkingEvent, setLinkingEvent] = useState(null),
    [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkingTaskId, setLinkingTaskId] = useState(null),
    [linkTaskSearchQuery, setLinkTaskSearchQuery] = useState('');
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  // ═══ Data loading ═══
  const initialLoadDone = useRef(false);
  const loadTasks = useCallback(
    async (silent = false) => {
      if (!silent && !initialLoadDone.current) setLoading(true);
      try {
        const range =
          viewMode === 'week'
            ? { dateFrom: weekDays[0], dateTo: weekDays[6] }
            : { date: selectedDate };
        const [data, events, affairesData] = await Promise.all([
          api.getTasks(range),
          api.getDisplayEvents(range),
          api.getPlanningAffaires(range),
        ]);
        setTasks(data);
        setDisplayEvents(Array.isArray(events) ? events : []);
        setAffaires(Array.isArray(affairesData) ? affairesData : []);
        try {
          const [statuses, assignments] = await Promise.all([
            api.getPlanningEventStatuses().catch(() => []),
            api.getPlanningAssignments().catch(() => []),
          ]);
          const map = new Map();
          (Array.isArray(statuses) ? statuses : []).forEach((s) =>
            map.set(`${s.eventType}:${s.eventId}`, s.status),
          );
          setEventStatuses(map);
          setPlanningAssignments(Array.isArray(assignments) ? assignments : []);
        } catch {
          /* ignore */
        }
        initialLoadDone.current = true;
      } catch {
        setTasks([]);
        setDisplayEvents([]);
        setAffaires([]);
      } finally {
        setLoading(false);
      }
    },
    [selectedDate, viewMode, weekDays, toast],
  );

  const loadPersons = useCallback(async () => {
    try {
      const data = await api.getPersons();
      setPersons(
        (Array.isArray(data) ? data : []).filter(
          (p) => p.type === 'permanent' && p.status !== STATUS.INACTIVE,
        ),
      );
    } catch {
      setPersons([]);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks, refreshKey]);
  useEffect(() => {
    loadPersons();
  }, [loadPersons]);

  const loadVehiclesAndReservations = useCallback(async () => {
    try {
      const [vehs, rezs] = await Promise.all([api.getVehicles(), api.getReservations()]);
      setVehicles(vehs || []);
      setReservations(rezs || []);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    loadVehiclesAndReservations();
  }, [loadVehiclesAndReservations]);

  const loadIcalCalendars = useCallback(async () => {
    try {
      const res = await api.getIcalCalendars();
      setIcalCalendars(res.calendars || []);
    } catch {
      setIcalCalendars([]);
    }
  }, []);

  const loadIcalEvents = useCallback(async () => {
    setIcalLoading(true);
    try {
      const res = await api.getIcalEvents({
        dateFrom: addDays(selectedDate, -14),
        dateTo: addDays(selectedDate, 14),
      });
      setIcalEvents(
        (res.events || []).sort((a, b) => (a.start || '').localeCompare(b.start || '')),
      );
      if (res.syncErrors?.length) res.syncErrors.forEach((e) => toast.warning(`iCal: ${e}`));
    } catch {
      setIcalEvents([]);
    } finally {
      setIcalLoading(false);
    }
  }, [selectedDate, toast]);

  useEffect(() => {
    loadIcalCalendars();
  }, [loadIcalCalendars]);
  useEffect(() => {
    loadIcalEvents();
  }, [loadIcalEvents, icalCalendars]);

  const loadRecurringTasks = useCallback(async () => {
    try {
      const res = await api.getRecurringTasks();
      setRecurringTasks(res.recurringTasks || []);
    } catch {
      setRecurringTasks([]);
    }
  }, []);
  useEffect(() => {
    if (showRecurring) loadRecurringTasks();
  }, [showRecurring, loadRecurringTasks]);

  // ═══ Week-view split drag ═══
  const handleWkSplitMouseDown = useCallback((e) => {
    e.preventDefault();
    wkSplitDragging.current = true;
    wkSplitContentRef.current = e.target.closest('.wk-day-content');
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!wkSplitDragging.current || !wkSplitContentRef.current) return;
      const rect = wkSplitContentRef.current.getBoundingClientRect();
      setWkSplitRatio(
        Math.round(Math.max(10, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100))),
      );
    };
    const onUp = () => {
      if (wkSplitDragging.current) {
        wkSplitDragging.current = false;
        wkSplitContentRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  // ═══ Recurring CRUD ═══
  const handleSaveRecurring = async () => {
    if (!recurringForm) return;
    if (!recurringForm.title?.trim()) {
      toast.warning('Titre requis');
      return;
    }
    const payload = {
      ...recurringForm,
      day_of_week: recurringForm.dayOfWeek,
      day_of_month: recurringForm.dayOfMonth,
    };
    try {
      if (recurringForm.id) await api.updateRecurringTask(recurringForm.id, payload);
      else await api.createRecurringTask(payload);
      toast.success(recurringForm.id ? 'Tâche récurrente modifiée' : 'Tâche récurrente créée');
      setRecurringForm(null);
      loadRecurringTasks();
    } catch {
      toast.error('Erreur sauvegarde');
    }
  };

  const handleDeleteRecurring = async (id) => {
    confirm({
      title: 'Supprimer la tâche récurrente',
      message: 'Supprimer cette tâche récurrente ?',
      onConfirm: async () => {
        try {
          await api.deleteRecurringTask(id);
          toast.success('Supprimée');
          loadRecurringTasks();
        } catch {
          toast.error('Erreur suppression');
        }
      },
    });
  };

  // ═══ iCal CRUD ═══
  const handleSaveIcal = async () => {
    if (!icalForm) return;
    if (!icalForm.name?.trim() || !icalForm.url?.trim()) {
      toast.warning('Nom et URL requis');
      return;
    }
    try {
      if (icalForm.id) await api.updateIcalCalendar(icalForm.id, icalForm);
      else await api.createIcalCalendar(icalForm);
      toast.success(icalForm.id ? 'Calendrier modifié' : 'Calendrier ajouté');
      setIcalForm(null);
      await loadIcalCalendars();
      loadIcalEvents();
    } catch {
      toast.error('Erreur sauvegarde');
    }
  };

  const handleDeleteIcal = async (id) => {
    confirm({
      title: 'Supprimer le calendrier',
      message: 'Supprimer ce calendrier iCal ?',
      onConfirm: async () => {
        try {
          await api.deleteIcalCalendar(id);
          toast.success('Calendrier supprimé');
          await loadIcalCalendars();
          loadIcalEvents();
        } catch {
          toast.error('Erreur suppression');
        }
      },
    });
  };

  // ═══ Batch actions ═══
  // handleGenerateRecurring : retiré côté UI (le bouton "Générer" a été supprimé
  // de la barre d'action). La génération est désormais déclenchée par le scheduler
  // backend (cron quotidien). L'API api.generateRecurringTasks reste disponible
  // pour usage interne / scripts.
  const handleRollover = () =>
    confirm({
      title: 'Reporter les tâches',
      message: `Reporter les tâches non terminées du ${formatDateFr(selectedDate)} au lendemain ?`,
      onConfirm: async () => {
        try {
          const r = await api.rolloverTasks(selectedDate);
          toast.success(`${r.rolled || 0} tâche(s) reportée(s)`);
          loadTasks(true);
        } catch {
          toast.error('Erreur report');
        }
      },
    });
  const handleClearCompleted = async () => {
    if (
      !window.confirm(
        `Supprimer toutes les tâches terminées du ${formatDateFr(selectedDate)} du planning et du dashboard ?`,
      )
    )
      return;
    try {
      const r = await api.clearCompletedTasks(selectedDate);
      toast.success(`${r.cleared || 0} tâche(s) terminée(s) effacée(s)`);
      loadTasks(true);
    } catch {
      toast.error('Erreur suppression');
    }
  };

  // ═══ Memoized data ═══
  const grouped = useMemo(() => {
    const g = {};
    Object.keys(SECTIONS).forEach((k) => {
      g[k] = [];
    });
    tasks.forEach((t) => {
      const s = normalizeSection(t.section || 'manual');
      if (!g[s]) g[s] = [];
      g[s].push(t);
    });
    return g;
  }, [tasks]);

  const linkedEventIds = useMemo(
    () =>
      new Set(
        tasks
          .filter((t) => t.display_event_id || t.displayEventId)
          .map((t) => t.display_event_id || t.displayEventId),
      ),
    [tasks],
  );
  const unlinkedEvents = useMemo(
    () => displayEvents.filter((ev) => !linkedEventIds.has(ev.id)),
    [displayEvents, linkedEventIds],
  );

  const weekGoogleEvents = useMemo(() => {
    if (!googleEvents?.length) return [];
    return googleEvents.filter((ev) =>
      weekDays.includes((ev.start?.dateTime || ev.start?.date || '').slice(0, 10)),
    );
  }, [googleEvents, weekDays]);

  const dayGoogleEvents = useMemo(() => {
    if (!googleEvents?.length) return [];
    return googleEvents.filter(
      (ev) => (ev.start?.dateTime || ev.start?.date || '').slice(0, 10) === selectedDate,
    );
  }, [googleEvents, selectedDate]);

  const processedGoogleIds = useMemo(
    () =>
      new Set(
        tasks
          .filter(
            (t) => (t.sourceType === 'google_event' || t.sourceType === 'ical_event') && t.sourceId,
          )
          .map((t) => t.sourceId),
      ),
    [tasks],
  );

  const tasksBySourceId = useMemo(() => {
    const m = new Map();
    tasks.forEach((t) => {
      if ((t.sourceType === 'google_event' || t.sourceType === 'ical_event') && t.sourceId) {
        if (!m.has(t.sourceId)) m.set(t.sourceId, []);
        m.get(t.sourceId).push(t);
      }
    });
    return m;
  }, [tasks]);

  const affaireByNum = useMemo(() => {
    const m = new Map();
    affaires.forEach((a) => {
      if (a.numeroAffaire) m.set(a.numeroAffaire.toUpperCase(), a);
    });
    return m;
  }, [affaires]);

  // ── Enrich affaires with linked Google events, filter duplicates ──
  const {
    enrichedAffaires,
    filteredDayGoogleEvents,
    filteredWeekGoogleEvents,
    unlinkedAffaireEvents,
  } = useMemo(() => {
    const numMap = new Map();
    affaires.forEach((a) => {
      if (a.numeroAffaire) numMap.set(a.numeroAffaire.toUpperCase(), a);
    });
    const linkedByAff = new Map();
    const unlinked = [];
    const filterLinked = (events) =>
      events.filter((ev) => {
        const match = (ev.summary || '').match(/\bAF\s*\d{4,}/i);
        if (match) {
          const num = match[0].toUpperCase().replace(/\s+/g, '');
          if (numMap.has(num)) {
            if (!linkedByAff.has(num)) linkedByAff.set(num, ev);
            return false;
          } else unlinked.push(ev);
        }
        return true;
      });
    const fDay = filterLinked(dayGoogleEvents);
    const fWeek = filterLinked(weekGoogleEvents);
    const enriched = affaires
      .filter((a) => !a.planningHidden)
      .map((a) => {
        const num = (a.numeroAffaire || '').toUpperCase();
        const gev = linkedByAff.get(num);
        if (!gev) return a;
        const startDT = gev.start?.dateTime || '',
          endDT = gev.end?.dateTime || '';
        return {
          ...a,
          _linkedGoogleEvent: gev,
          _googleTime: startDT.includes('T')
            ? safeParseDate(startDT)?.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              }) || ''
            : '',
          _googleEndTime: endDT.includes('T')
            ? safeParseDate(endDT)?.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              }) || ''
            : '',
          _googleLocation: gev.location || '',
          _googleId: gev.id,
        };
      });
    return {
      enrichedAffaires: enriched,
      filteredDayGoogleEvents: fDay,
      filteredWeekGoogleEvents: fWeek,
      unlinkedAffaireEvents: unlinked,
    };
  }, [affaires, dayGoogleEvents, weekGoogleEvents]);

  // ── Auto-create affaires for unlinked Google events with AF number ──
  const syncedAFRef = useRef(new Set());
  useEffect(() => {
    if (!unlinkedAffaireEvents?.length) return;
    const toSync = unlinkedAffaireEvents.filter((ev) => {
      const m = (ev.summary || '').match(/\bAF\s*\d{4,}/i);
      if (!m) return false;
      const num = m[0].toUpperCase().replace(/\s+/g, '');
      if (syncedAFRef.current.has(num)) return false;
      syncedAFRef.current.add(num);
      return true;
    });
    if (!toSync.length) return;
    (async () => {
      try {
        await api.syncGoogleEventsToAffaires(toSync);
        await loadTasks(true);
      } catch (err) {
        console.error('[TaskPlanning] Auto-sync affaires failed:', err);
      }
    })();
  }, [unlinkedAffaireEvents, loadTasks]);

  // ── Google events post-filter ──
  const allGoogleEvents = useMemo(
    () => (viewMode === 'week' ? filteredWeekGoogleEvents : filteredDayGoogleEvents),
    [viewMode, filteredWeekGoogleEvents, filteredDayGoogleEvents],
  );
  const googleRdvEvents = useMemo(
    () => allGoogleEvents.filter((ev) => /rdv/i.test(ev.summary || '')),
    [allGoogleEvents],
  );
  const googleOtherEvents = useMemo(
    () => allGoogleEvents.filter((ev) => !/rdv/i.test(ev.summary || '')),
    [allGoogleEvents],
  );

  const mergedOtherEvents = useMemo(() => {
    const googleNorm = googleOtherEvents.map((ev) => ({
      ...ev,
      _source: 'google',
      _sortKey: ev.start?.dateTime || ev.start?.date || '',
    }));
    const dateSet = viewMode === 'week' ? new Set(weekDays) : new Set([selectedDate]);
    const icalNorm = icalEvents
      .filter((ev) => dateSet.has((ev.start || '').slice(0, 10)))
      .map((ev) => ({ ...ev, _source: 'ical', _sortKey: ev.start || '' }));
    return [...googleNorm, ...icalNorm].sort((a, b) => a._sortKey.localeCompare(b._sortKey));
  }, [googleOtherEvents, icalEvents, viewMode, selectedDate, weekDays]);

  const weekGroupedByDay = useMemo(() => {
    if (viewMode !== 'week') return null;
    const map = {};
    weekDays.forEach((d) => {
      map[d] = { tasks: [], events: [], affaires: [], googleEvents: [] };
    });
    tasks.forEach((t) => {
      if (map[t.date]) map[t.date].tasks.push(t);
    });
    unlinkedEvents.forEach((ev) => {
      if (map[ev.date]) map[ev.date].events.push(ev);
    });
    enrichedAffaires.forEach((a) => {
      const debut = a.dateDebut || a.date_debut || '',
        fin = a.dateFin || a.date_fin || '';
      weekDays.forEach((d) => {
        if (debut && debut <= d && (!fin || fin >= d)) map[d]?.affaires.push(a);
      });
    });
    filteredWeekGoogleEvents.forEach((ev) => {
      const d = (ev.start?.dateTime || ev.start?.date || '').slice(0, 10);
      if (map[d]) map[d].googleEvents.push(ev);
    });
    icalEvents.forEach((ev) => {
      const d = (ev.start || '').slice(0, 10);
      if (map[d]) map[d].googleEvents.push({ ...ev, _source: 'ical' });
    });
    return map;
  }, [
    viewMode,
    weekDays,
    tasks,
    unlinkedEvents,
    enrichedAffaires,
    filteredWeekGoogleEvents,
    icalEvents,
  ]);

  const assignmentsByEntity = useMemo(() => {
    const m = new Map();
    (planningAssignments || []).forEach((a) => {
      const k = `${a.entityType}:${a.entityId}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(a);
    });
    return m;
  }, [planningAssignments]);

  const affairesBySection = useMemo(() => {
    const g = {};
    Object.keys(SECTIONS).forEach((k) => {
      g[k] = [];
    });
    enrichedAffaires.forEach((a) => {
      const sec = mapAffaireToSection(a);
      if (!g[sec]) g[sec] = [];
      g[sec].push(a);
      if (a.titre && /rdv/i.test(a.titre)) {
        if (!g.rdv) g.rdv = [];
        g.rdv.push(a);
      }
    });
    return g;
  }, [enrichedAffaires]);

  // ═══ Action handlers ═══
  const handleToggleAssignment = useCallback(
    async (entityType, entityId, personId) => {
      try {
        const key = `${entityType}:${entityId}`;
        const found = (assignmentsByEntity.get(key) || []).find((a) => a.personId === personId);
        if (found) await api.removePlanningAssignment(found.id);
        else await api.addPlanningAssignment(entityType, entityId, personId);
        const updated = await api.getPlanningAssignments();
        setPlanningAssignments(Array.isArray(updated) ? updated : []);
      } catch {
        toast.error('Erreur affectation');
      }
    },
    [assignmentsByEntity, toast],
  );
  const cycleStatus = useCallback(
    async (task) => {
      const next = {
        pending: 'done',
        in_progress: 'done',
        done: 'pending',
        cancelled: 'pending',
      };
      try {
        await api.updateTask(task.id, { status: next[task.status] || 'pending' });
        loadTasks(true);
      } catch {
        toast.error('Erreur mise à jour');
      }
    },
    [loadTasks, toast],
  );
  const handleDelete = useCallback(
    (id) =>
      confirm({
        title: 'Supprimer la tâche',
        message: 'Voulez-vous supprimer cette tâche ?',
        onConfirm: async () => {
          try {
            await api.deleteTask(id);
            toast.success('Tâche supprimée');
            loadTasks(true);
          } catch {
            toast.error('Erreur suppression');
          }
        },
      }),
    [confirm, toast, loadTasks],
  );
  const handleDeleteDisplayEvent = useCallback(
    (id) =>
      confirm({
        title: 'Retirer de la planification',
        message: "Supprimer cet événement d'affichage ?",
        onConfirm: async () => {
          try {
            await api.deleteDisplayEvent(id);
            toast.success('Événement retiré');
            loadTasks(true);
          } catch {
            toast.error('Erreur suppression');
          }
        },
      }),
    [confirm, toast, loadTasks],
  );
  const handleToggleTaskVisible = useCallback(
    async (t) => {
      try {
        await api.toggleTaskVisibility(t.id);
        loadTasks(true);
      } catch {
        toast.error('Erreur toggle visibilité');
      }
    },
    [loadTasks, toast],
  );
  const handleToggleDisplayEventVisible = useCallback(
    async (ev) => {
      try {
        await api.toggleDisplayEventVisibility(ev.id);
        loadTasks(true);
      } catch {
        toast.error('Erreur toggle visibilité');
      }
    },
    [loadTasks, toast],
  );
  const _handleCycleDisplayEventStatus = useCallback(
    async (ev) => {
      try {
        await api.cycleDisplayEventStatus(ev.id);
        loadTasks(true);
      } catch {
        toast.error('Erreur mise à jour statut');
      }
    },
    [loadTasks, toast],
  );
  const _handleCycleAffaireStatus = useCallback(
    async (num) => {
      try {
        await api.cycleAffaireStatus(num);
        loadTasks(true);
      } catch {
        toast.error('Erreur mise à jour statut affaire');
      }
    },
    [loadTasks, toast],
  );
  const handleHideAffaire = useCallback(
    (a) =>
      confirm({
        title: 'Retirer de la planification',
        message: `Masquer l'affaire ${a.numeroAffaire} de la planification ?`,
        onConfirm: async () => {
          try {
            await api.hidePlanningAffaire(a.numeroAffaire);
            toast.success(`${a.numeroAffaire} retirée`);
            loadTasks(true);
          } catch {
            toast.error('Erreur masquage affaire');
          }
        },
      }),
    [confirm, toast, loadTasks],
  );

  const handleLinkTaskToAffaire = useCallback(
    async (taskId, num) => {
      try {
        await api.updateTask(taskId, { affaire_num: num });
        setLinkingTaskId(null);
        setLinkTaskSearchQuery('');
        await loadTasks(true);
        toast.success(`Tâche liée à ${num}`);
      } catch {
        toast.error('Erreur lors de la liaison');
      }
    },
    [loadTasks, toast],
  );
  const handleManualLink = useCallback(
    async (event, num) => {
      try {
        const s = event.summary || '';
        await api.syncGoogleEventsToAffaires([
          { ...event, summary: s.includes(num) ? s : `${num} ${s}` },
        ]);
        syncedAFRef.current.add(num.toUpperCase());
        setLinkingEvent(null);
        setLinkSearchQuery('');
        await loadTasks(true);
        toast.success(`Événement lié à ${num}`);
      } catch {
        toast.error('Erreur lors de la liaison');
      }
    },
    [loadTasks, toast],
  );
  const openAffaireTaskModal = useCallback((af) => {
    if (af._linkedGoogleEvent) {
      openEventTaskModal(af._linkedGoogleEvent);
      return;
    }
    openEventTaskModal({
      id: `affaire-${af.id || af.numeroAffaire}`,
      summary: `${af.type || ''} ${af.numeroAffaire}${af.client ? ' — ' + af.client : ''}`,
      start: { date: af.dateDebut || af.date_debut || '' },
      end: { date: af.dateFin || af.date_fin || '' },
      location: af.adresseLivraison || '',
      description: af.titre || af.description || '',
    });
  }, []);
  const icalToGoogleLike = useCallback((ev) => {
    const s = ev.start || '',
      e = ev.end || '';
    return {
      id: ev.id,
      summary: ev.summary || 'Événement',
      start: s.includes('T') ? { dateTime: s } : { date: s },
      end: e.includes('T') ? { dateTime: e } : { date: e },
      location: ev.location || '',
      description: ev.description || '',
      _ical: true,
      _calendarName: ev.calendarName,
      _calendarColor: ev.calendarColor,
    };
  }, []);

  // ═══ Render wrappers (delegate to extracted components) ═══
  const renderMultiAssign = useCallback(
    (entityType, entityId) => (
      <MultiAssignWidget
        entityType={entityType}
        entityId={entityId}
        assignmentsByEntity={assignmentsByEntity}
        assigningEntity={assigningEntity}
        setAssigningEntity={setAssigningEntity}
        onToggleAssignment={handleToggleAssignment}
        persons={persons}
      />
    ),
    [assignmentsByEntity, assigningEntity, handleToggleAssignment, persons],
  );

  const renderTaskRow = useCallback(
    (task) => (
      <PlanningTaskRow
        key={task.id}
        task={task}
        affaireByNum={affaireByNum}
        onNavigateToEntity={onNavigateToEntity}
        onCycleStatus={cycleStatus}
        onDelete={handleDelete}
        onToggleVisible={handleToggleTaskVisible}
        onEdit={openTaskEditModal}
        onLinkTask={handleLinkTaskToAffaire}
        linkingTaskId={linkingTaskId}
        setLinkingTaskId={setLinkingTaskId}
        linkTaskSearchQuery={linkTaskSearchQuery}
        setLinkTaskSearchQuery={setLinkTaskSearchQuery}
        affaires={affaires}
        selectedDate={selectedDate}
        renderMultiAssign={renderMultiAssign}
      />
    ),
    [
      affaireByNum,
      onNavigateToEntity,
      cycleStatus,
      handleDelete,
      handleToggleTaskVisible,
      openTaskEditModal,
      handleLinkTaskToAffaire,
      linkingTaskId,
      linkTaskSearchQuery,
      affaires,
      selectedDate,
      renderMultiAssign,
    ],
  );

  const renderGoogleRdvRow = useCallback(
    (event) => (
      <GoogleRdvRow
        key={`gcal-rdv-${event.id}`}
        event={event}
        affaireByNum={affaireByNum}
        processedGoogleIds={processedGoogleIds}
        tasksBySourceId={tasksBySourceId}
        onNavigateToEntity={onNavigateToEntity}
        onOpenEventTaskModal={openEventTaskModal}
        linkingEvent={linkingEvent}
        setLinkingEvent={setLinkingEvent}
        linkSearchQuery={linkSearchQuery}
        setLinkSearchQuery={setLinkSearchQuery}
        affaires={affaires}
        onManualLink={handleManualLink}
        selectedDate={selectedDate}
      />
    ),
    [
      affaireByNum,
      processedGoogleIds,
      tasksBySourceId,
      onNavigateToEntity,
      linkingEvent,
      linkSearchQuery,
      affaires,
      handleManualLink,
      selectedDate,
    ],
  );

  const renderRdvRow = useCallback(
    (affaire) => (
      <RdvRow
        key={`rdv-${affaire.numeroAffaire}`}
        affaire={affaire}
        expandedRdv={expandedRdv}
        setExpandedRdv={setExpandedRdv}
        onNavigateToEntity={onNavigateToEntity}
        onOpenAffaireTaskModal={openAffaireTaskModal}
        onHideAffaire={handleHideAffaire}
      />
    ),
    [expandedRdv, onNavigateToEntity, openAffaireTaskModal, handleHideAffaire],
  );

  const renderIcalEventRow = useCallback(
    (event) => (
      <IcalEventRow
        key={`ical-${event.id}-${event.start || ''}`}
        event={event}
        affaireByNum={affaireByNum}
        processedGoogleIds={processedGoogleIds}
        tasksBySourceId={tasksBySourceId}
        onNavigateToEntity={onNavigateToEntity}
        onOpenEventTaskModal={openEventTaskModal}
        linkingEvent={linkingEvent}
        setLinkingEvent={setLinkingEvent}
        linkSearchQuery={linkSearchQuery}
        setLinkSearchQuery={setLinkSearchQuery}
        affaires={affaires}
        onManualLink={handleManualLink}
        selectedDate={selectedDate}
        icalToGoogleLike={icalToGoogleLike}
      />
    ),
    [
      affaireByNum,
      processedGoogleIds,
      tasksBySourceId,
      onNavigateToEntity,
      linkingEvent,
      linkSearchQuery,
      affaires,
      handleManualLink,
      selectedDate,
      icalToGoogleLike,
    ],
  );

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === STATUS.DONE).length;

  // ═══ JSX ═══
  return (
    <div className="task-planning-panel">
      {/* ── Toolbar ── */}
      <div className="tp-toolbar">
        <div className="tp-toolbar-left">
          <div className="tp-view-toggle">
            <Tooltip content="Vue jour" position="bottom">
              <Button
                variant="ghost"
                className={viewMode === 'day' ? 'active' : ''}
                onClick={() => setViewMode('day')}
              >
                <LayoutList size={15} /> Jour
              </Button>
            </Tooltip>
            <Tooltip content="Vue semaine" position="bottom">
              <Button
                variant="ghost"
                className={viewMode === 'week' ? 'active' : ''}
                onClick={() => setViewMode('week')}
              >
                <CalendarDays size={15} /> Semaine
              </Button>
            </Tooltip>
          </div>
          <div className="tp-date-nav">
            {/* Flèches navigation : variant=secondary pour avoir une bordure visible
                cohérente avec les autres modules (cf. .date-nav dans PlanningPanel.css). */}
            <Button
              variant="secondary"
              className="tp-nav-arrow"
              aria-label={viewMode === 'week' ? 'Semaine précédente' : 'Jour précédent'}
              title={viewMode === 'week' ? 'Semaine précédente' : 'Jour précédent'}
              onClick={() => setSelectedDate((d) => addDays(d, viewMode === 'week' ? -7 : -1))}
            >
              <ChevronLeft size={16} />
            </Button>
            <Tooltip content="Aujourd'hui" position="bottom">
              <span
                className="tp-current-date"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDate(todayStr())}
              >
                {viewMode === 'week'
                  ? `${formatDateShort(weekDays[0])} → ${formatDateShort(weekDays[6])}`
                  : formatDateFr(selectedDate)}
              </span>
            </Tooltip>
            <Button
              variant="secondary"
              className="tp-nav-arrow"
              aria-label={viewMode === 'week' ? 'Semaine suivante' : 'Jour suivant'}
              title={viewMode === 'week' ? 'Semaine suivante' : 'Jour suivant'}
              onClick={() => setSelectedDate((d) => addDays(d, viewMode === 'week' ? 7 : 1))}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
          {totalTasks > 0 && (
            <span className="u-text-secondary tp-progress-mini">
              {doneTasks}/{totalTasks} terminée{doneTasks > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="tp-toolbar-right">
          <Tooltip content="Reporter les tâches non terminées au lendemain" position="bottom">
            <Button variant="secondary" className="btn-toolbar-action" onClick={handleRollover}>
              <SkipForward size={16} /> Reporter
            </Button>
          </Tooltip>
          <Tooltip
            content="Effacer les tâches terminées du planning et du dashboard"
            position="bottom"
          >
            <Button
              variant="secondary"
              className="btn-toolbar-action btn-clear-done"
              onClick={handleClearCompleted}
              disabled={doneTasks === 0}
            >
              <CheckCheck size={16} /> Effacer terminées
            </Button>
          </Tooltip>
          {/* Bouton "Générer" supprimé : la génération automatique des tâches récurrentes
              s'effectue désormais via le scheduler backend (cron quotidien). Le bouton
              "Récurrentes" ci-dessous reste pour gérer les modèles. */}
          <Tooltip content="Gérer les tâches récurrentes" position="bottom">
            <Button
              variant={showRecurring ? 'primary' : 'secondary'}
              className={`btn-toolbar-action ${showRecurring ? 'active' : ''}`}
              onClick={() => setShowRecurring((v) => !v)}
            >
              <Settings size={16} /> Récurrentes
            </Button>
          </Tooltip>
          <Tooltip content="Exporter la fiche de tâches en PDF" position="bottom">
            <Button
              variant="secondary"
              className="btn-export-pdf"
              onClick={() => setShowPdfExport(true)}
            >
              <FileDown size={16} /> PDF
            </Button>
          </Tooltip>
          <Tooltip content="Ajouter une nouvelle tâche" position="bottom">
            <Button variant="primary" className="btn-toolbar-action" onClick={openAddTaskModal}>
              <Plus size={16} /> Nouvelle tâche
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* ── Recurring Panel ── */}
      {showRecurring && (
        <PlanningRecurringPanel
          recurringTasks={recurringTasks}
          recurringForm={recurringForm}
          setRecurringForm={setRecurringForm}
          onSave={handleSaveRecurring}
          onDelete={handleDeleteRecurring}
        />
      )}

      {/* ── Content: loading / week / day ── */}
      {loading ? (
        <div className="sections-container">
          <div className="empty-state">
            <ClipboardList size={48} />
            <p>Chargement…</p>
          </div>
        </div>
      ) : viewMode === 'week' ? (
        <PlanningWeekView
          weekDays={weekDays}
          weekGroupedByDay={weekGroupedByDay}
          expandedWeekDay={expandedWeekDay}
          setExpandedWeekDay={setExpandedWeekDay}
          wkSplitRatio={wkSplitRatio}
          onSplitMouseDown={handleWkSplitMouseDown}
          setSelectedDate={setSelectedDate}
          renderTaskRow={renderTaskRow}
          affaireByNum={affaireByNum}
          processedGoogleIds={processedGoogleIds}
          onNavigateToEntity={onNavigateToEntity}
          onCycleStatus={cycleStatus}
          onEdit={setEditingTask}
          onDelete={handleDelete}
          onToggleTaskVisible={handleToggleTaskVisible}
          onToggleDisplayEventVisible={handleToggleDisplayEventVisible}
          onDeleteDisplayEvent={handleDeleteDisplayEvent}
          onOpenAffaireTaskModal={openAffaireTaskModal}
          onOpenEventTaskModal={setEventTaskModalEvent}
          onHideAffaire={handleHideAffaire}
        />
      ) : (
        <PlanningDayView
          grouped={grouped}
          affairesBySection={affairesBySection}
          googleRdvEvents={googleRdvEvents}
          mergedOtherEvents={mergedOtherEvents}
          renderTaskRow={renderTaskRow}
          renderGoogleRdvRow={renderGoogleRdvRow}
          renderRdvRow={renderRdvRow}
          renderIcalEventRow={renderIcalEventRow}
          collapsedSections={collapsedSections}
          toggleSectionCollapse={toggleSectionCollapse}
          collapsedPastEvents={collapsedPastEvents}
          setCollapsedPastEvents={setCollapsedPastEvents}
          collapsedFutureEvents={collapsedFutureEvents}
          setCollapsedFutureEvents={setCollapsedFutureEvents}
          selectedDate={selectedDate}
          icalCalendars={icalCalendars}
          icalLoading={icalLoading}
          showIcalManager={showIcalManager}
          setShowIcalManager={setShowIcalManager}
          icalForm={icalForm}
          setIcalForm={setIcalForm}
          onSaveIcal={handleSaveIcal}
          onDeleteIcal={handleDeleteIcal}
          onRefreshIcal={() => {
            loadIcalCalendars();
            loadIcalEvents();
          }}
        />
      )}

      {/* ── Modals ── */}
      {ConfirmDialogRenderer}
      {showPdfExport && (
        <Suspense fallback={null}>
          <TaskPDFExportModal
            date={selectedDate}
            tasks={tasks}
            affaires={affaires}
            displayEvents={displayEvents}
            googleRdvEvents={googleRdvEvents}
            planningAssignments={planningAssignments}
            persons={persons}
            onClose={() => setShowPdfExport(false)}
          />
        </Suspense>
      )}
      {/* Gestion centralisée des modals */}
      {modal?.type === 'event-task' && (
        <EventTaskModal
          event={modal.props.event}
          existingTasks={tasks.filter(
            (t) =>
              (t.sourceType === 'google_event' || t.sourceType === 'ical_event') &&
              t.sourceId === modal.props.event.id,
          )}
          onSave={(taskDate) => {
            closeModal();
            if (taskDate && taskDate !== selectedDate) setSelectedDate(taskDate);
            else loadTasks(true);
          }}
          onDelete={() => {
            closeModal();
            loadTasks(true);
          }}
          onClose={closeModal}
        />
      )}
      {modal?.type === 'edit-task' && (
        <TaskEditModal
          task={modal.props.task}
          persons={persons}
          onSave={() => {
            closeModal();
            loadTasks(true);
          }}
          onClose={closeModal}
        />
      )}
      {modal?.type === 'add-task' && (
        <AddTaskModal
          isOpen={true}
          onClose={closeModal}
          selectedDate={selectedDate}
          persons={persons}
          affaires={affaires}
          googleEvents={dayGoogleEvents}
          icalEvents={icalEvents}
          vehicles={vehicles}
          reservations={reservations}
          onTaskCreated={() => {
            closeModal();
            loadTasks(true);
          }}
          loadVehiclesAndReservations={loadVehiclesAndReservations}
        />
      )}
    </div>
  );
}

export default React.memo(TaskPlanningPanel);
