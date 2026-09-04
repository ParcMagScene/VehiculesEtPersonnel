import './PersonnelPlanningView.css';

import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  isSameWeek,
  isSameYear,
  isWeekend as isWeekendFn,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, Clock, Plus, Star, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, EmptyState, SearchBar, Tooltip } from '@/design-system';

import { STATUS } from '../../constants';
import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import usePersonnelFavorites from '../../hooks/usePersonnelFavorites';
import { useToast } from '../../hooks/useToast';
import useWindowWidth from '../../hooks/useWindowWidth';
import api from '../../utils/api';
import { computeGridColumnsCss } from '../../utils/planningGridColumns';
import LeaveRequestForm from '../leaves/LeaveRequestForm';
import LeaveRequestsPanel from '../leaves/LeaveRequestsPanel';
import LeaveValidationPanel from '../leaves/LeaveValidationPanel';
import PeriodCalendarModal from '../planning/PeriodCalendarModal';
import AssignmentDialog from './AssignmentDialog';
import {
  CONTRACT_TYPES,
  NON_PERMANENT_TYPES,
  PERMANENT_TYPES,
  PERSON_TYPES,
} from './personnelConstants';
import PersonnelContextMenu from './PersonnelContextMenu';
import { PersonnelSlidePanel } from './PersonnelDetailPanel';
import { PlanningHeader } from './PlanningHeader';
import { PlanningToolbar } from './PlanningToolbar';
import useDragHandlers from './useDragHandlers';

// ═══════════════════════════════════════
// Personnel Planning View (extracted from PlanningTab)
// ═══════════════════════════════════════

export const PlanningTab = ({
  persons,
  skills,
  positions = [],
  view = 'week',
  setView,
  currentDate = new Date(),
  setCurrentDate,
  googleEvents = [],
  onPersonEdit,
  onPersonCreate,
  navigateToPersonId,
  onNavigateToPersonHandled,
  quickAssignmentSlot,
  onQuickAssignmentHandled,
  currentUser,
  onOpenSuivi,
  googleBanner = null,
}) => {
  const triggerOnEnterSpace = useCallback((event, callback) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    callback();
  }, []);

  const toast = useToast();
  const { confirm: confirmDelete, ConfirmDialogRenderer: DeleteConfirmRenderer } =
    useConfirmDialog();
  const scrollAreaRef = useRef(null);
  const headerScrollRef = useRef(null);
  const personColumnRef = useRef(null);
  const [personColumnWidth, setPersonColumnWidth] = useState(250);
  const columnResizingRef = useRef(false);
  const [collapsedSections, setCollapsedSections] = useState({
    permanents: false,
    favoris: false,
    nonPermanents: true,
    inactifs: true,
  });
  const [selectedPersonForDetails, setSelectedPersonForDetails] = useState(null);
  const clickTimerRef = useRef(null);

  // ═══ Navigation de dates ═══
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [showWeekSelector, setShowWeekSelector] = useState(false);
  const [showYearSelector, setShowYearSelector] = useState(false);

  const goToPrevious = () => {
    if (!setCurrentDate) return;
    const newDate = new Date(currentDate);
    if (view === 'week') newDate.setDate(newDate.getDate() - 7);
    else if (view === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else newDate.setFullYear(newDate.getFullYear() - 1);
    setCurrentDate(newDate);
  };
  const goToNext = () => {
    if (!setCurrentDate) return;
    const newDate = new Date(currentDate);
    if (view === 'week') newDate.setDate(newDate.getDate() + 7);
    else if (view === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else newDate.setFullYear(newDate.getFullYear() + 1);
    setCurrentDate(newDate);
  };
  const goToToday = () => setCurrentDate?.(new Date());
  const getDateLabel = () => {
    let label = '';
    if (view === 'week') label = format(currentDate, "'Semaine du' d MMMM yyyy", { locale: fr });
    else if (view === 'month') label = format(currentDate, 'MMMM yyyy', { locale: fr });
    else label = format(currentDate, 'yyyy', { locale: fr });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };
  const ppIsCurrentPeriod = () => {
    const today = new Date();
    if (view === 'week') return isSameWeek(currentDate, today, { weekStartsOn: 1 });
    if (view === 'month') return isSameMonth(currentDate, today);
    return isSameYear(currentDate, today);
  };
  const ppShowTodayHighlight = !ppIsCurrentPeriod();

  // ═══ Toolbar : recherche, filtre, favoris ═══
  const [planningSearch, setPlanningSearch] = useState('');
  const [planningFilter, setPlanningFilter] = useState('');
  const { isFavorite, toggleFavorite, sortPersonsByFavorites } = usePersonnelFavorites();

  // Navigation croisée depuis un autre module
  useEffect(() => {
    if (navigateToPersonId && persons.length > 0) {
      const target = persons.find((p) => p.id === navigateToPersonId);
      if (target) {
        setSelectedPersonForDetails(target);
      }
      if (onNavigateToPersonHandled) onNavigateToPersonHandled();
    }
  }, [navigateToPersonId, persons, onNavigateToPersonHandled]);

  // Ouvrir le dialog d'affectation rapide depuis l'extérieur
  useEffect(() => {
    if (quickAssignmentSlot && persons.length > 0) {
      const dayDate = new Date(quickAssignmentSlot.day + 'T00:00:00');
      setAssignmentDialog({
        person: persons[0] || null,
        day: dayDate,
        period: quickAssignmentSlot.period || 'AM',
      });
      if (onQuickAssignmentHandled) onQuickAssignmentHandled();
    }
  }, [quickAssignmentSlot, persons, onQuickAssignmentHandled]);

  // Planning data state
  const [planningData, setPlanningData] = useState({
    missions: [],
    availabilities: [],
    taskAssignments: [],
  });
  const [assignmentDialog, setAssignmentDialog] = useState(null);
  const [deleteMission, setDeleteMission] = useState(null);
  const [hoveredSlot, setHoveredSlot] = useState(null);

  // Leave management state
  const [showLeaveModal, setShowLeaveModal] = useState(null);
  const [showLeaveApproval, setShowLeaveApproval] = useState(false);
  const [showLeaveHistory, setShowLeaveHistory] = useState(null);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);
  const [periodCalendar, setPeriodCalendar] = useState(null);

  // Calcul des jours selon la vue
  const days = useMemo(() => {
    if (view === 'week') {
      return eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      });
    } else if (view === 'month') {
      return eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      });
    } else {
      return eachMonthOfInterval({
        start: startOfYear(currentDate),
        end: endOfYear(currentDate),
      });
    }
  }, [view, currentDate]);

  const timeSlots = useMemo(() => {
    return days.map((day) => ({ day }));
  }, [days]);

  const loadPlanning = useCallback(async () => {
    try {
      if (days.length === 0) return;
      const startStr = format(days[0], 'yyyy-MM-dd');
      const lastDay = view === 'year' ? endOfMonth(days[days.length - 1]) : days[days.length - 1];
      const endStr = format(lastDay, 'yyyy-MM-dd');
      const data = await api.getPersonnelPlanning({ startDate: startStr, endDate: endStr });
      setPlanningData(data || { missions: [], availabilities: [], taskAssignments: [] });
    } catch (err) {
      console.error('Erreur chargement planning:', err);
      toast.error('Erreur chargement du planning');
    }
  }, [days, toast, view]);

  useEffect(() => {
    loadPlanning();
  }, [loadPlanning]);

  useEffect(() => {
    api
      .getPendingLeavesCount()
      .then((r) => setPendingLeaveCount(r?.count || 0))
      .catch(() => {});
  }, [planningData]);

  // Index des missions par personne
  const missionSpans = useMemo(() => {
    const spans = {};
    if (view === 'year' || days.length === 0) return spans;
    const viewStart = days[0];
    const viewEnd = days[days.length - 1];

    (planningData.missions || []).forEach((mission) => {
      if (!mission.assignments) return;
      mission.assignments.forEach((a) => {
        const personId = a.personId || a.person_id;
        if (!personId) return;
        if (!spans[personId]) spans[personId] = [];

        try {
          const mStart = parseISO(mission.startDate || mission.start_date);
          const mEnd = parseISO(mission.endDate || mission.end_date);
          const visStart = mStart < viewStart ? viewStart : mStart;
          const visEnd = mEnd > viewEnd ? viewEnd : mEnd;
          if (visStart > viewEnd || visEnd < viewStart) return;

          const startDayIdx = days.findIndex((d) => isSameDay(d, visStart));
          const endDayIdx = days.findIndex((d) => isSameDay(d, visEnd));
          if (startDayIdx === -1) return;
          const endIdx = endDayIdx === -1 ? startDayIdx : endDayIdx;
          const startSlotIdx = startDayIdx;
          const slotCount = endIdx - startDayIdx + 1;

          const mDays = eachDayOfInterval({ start: visStart, end: visEnd });
          const onDaySet = new Set();
          let storedOffDays = null;
          const rawDayStates = mission.dayStates || mission.day_states;
          if (rawDayStates) {
            try {
              const parsed =
                typeof rawDayStates === 'string' ? JSON.parse(rawDayStates) : rawDayStates;
              if (Array.isArray(parsed)) {
                storedOffDays = new Set(parsed);
              }
            } catch {
              /* ignore */
            }
          }

          mDays.forEach((d) => {
            const dayKey = format(d, 'yyyy-MM-dd');
            if (storedOffDays) {
              if (!storedOffDays.has(dayKey)) {
                onDaySet.add(dayKey);
              }
            } else {
              if (!isWeekendFn(d)) {
                onDaySet.add(dayKey);
              }
            }
          });

          spans[personId].push({
            mission,
            assignment: a,
            startSlotIdx,
            slotCount,
            missionId: mission.id,
            clippedLeft: mStart < viewStart,
            clippedRight: mEnd > viewEnd,
            onDays: onDaySet,
            missionStart: mStart,
            missionEnd: mEnd,
          });
        } catch {
          /* erreur parsing date */
        }
      });
    });
    return spans;
  }, [planningData.missions, days, view]);

  // Index des absences
  const LEAVE_TYPE_COLORS = {
    unavailable: 'var(--theme-text-muted)',
    absence: STATUS_COLORS.danger,
    conge_paye: '#60a5fa',
    rtt: '#a78bfa',
    maladie: '#f87171',
    sans_solde: '#fb923c',
    formation: ACCENT_COLORS.violet,
    entreprise: STATUS_COLORS.info,
    workshop: STATUS_COLORS.warning,
    examen: STATUS_COLORS.success,
    rdv: ACCENT_COLORS.cyan,
    repos: '#fbbf24',
    autre: 'var(--theme-text-muted)',
  };
  const LEAVE_TYPE_LABELS = {
    unavailable: 'Indisponible',
    absence: 'Absence',
    conge_paye: 'CP',
    rtt: 'RTT',
    maladie: 'Maladie',
    sans_solde: 'SS',
    formation: 'Form.',
    entreprise: 'Entr.',
    workshop: 'Work.',
    examen: 'Exam.',
    rdv: 'RDV',
    repos: 'Repos',
    autre: 'Autre',
  };

  const absenceSlots = useMemo(() => {
    const map = {};
    if (view === 'year' || days.length === 0) return map;
    const viewStart = days[0];
    const viewEnd = days[days.length - 1];

    (planningData.availabilities || []).forEach((avail) => {
      if (avail.status === STATUS.REJECTED) return;
      try {
        const aStart = parseISO(avail.start_date || avail.startDate);
        const aEnd = parseISO(avail.end_date || avail.endDate);
        if (aStart > viewEnd || aEnd < viewStart) return;

        const personId = avail.person_id || avail.personId;
        const clampedStart = aStart < viewStart ? viewStart : aStart;
        const clampedEnd = aEnd > viewEnd ? viewEnd : aEnd;
        const startIdx = days.findIndex((d) => isSameDay(d, clampedStart));
        const endIdx = days.findIndex((d) => isSameDay(d, clampedEnd));
        if (startIdx === -1) return;
        const eIdx = endIdx === -1 ? startIdx : endIdx;

        for (let i = startIdx; i <= eIdx; i++) {
          const isFirstDay = i === startIdx && isSameDay(clampedStart, aStart);
          const isLastDay = i === endIdx && isSameDay(clampedEnd, aEnd);
          const sp = isFirstDay ? avail.start_period || avail.startPeriod || 'AM' : 'AM';
          const ep = isLastDay ? avail.end_period || avail.endPeriod || 'PM' : 'PM';
          const period = sp === 'AM' && ep === 'PM' ? 'FULL' : sp === 'PM' ? 'PM' : 'AM';
          map[`${personId}_${i}`] = {
            type: avail.type || 'unavailable',
            reason: avail.reason,
            status: avail.status || 'approved',
            period,
            is_unavailability: (avail.type || 'unavailable').toLowerCase() !== 'entreprise',
          };
        }
      } catch {
        /* ignore */
      }
    });
    return map;
  }, [planningData.availabilities, days, view]);

  const taskSlots = useMemo(() => {
    const map = {};
    if (view === 'year' || days.length === 0) return map;

    (planningData.taskAssignments || []).forEach((ta) => {
      try {
        const personId = ta.person_id || ta.personId;
        const taskDate = parseISO(ta.date);
        const slotIdx = days.findIndex((d) => isSameDay(d, taskDate));
        if (slotIdx === -1) return;

        const key = `${personId}_${slotIdx}`;
        if (!map[key]) map[key] = [];
        map[key].push({
          id: ta.id,
          title: ta.title,
          period: ta.period,
          section: ta.section,
          affaireNum: ta.affaire_num,
          sourceType: ta.source_type,
          status: ta.status,
        });
      } catch {
        /* ignore */
      }
    });
    return map;
  }, [planningData.taskAssignments, days, view]);

  // Vue année : agrégats mensuels (compteurs par personne × mois).
  const yearStats = useMemo(() => {
    const map = {};
    if (view !== 'year' || days.length === 0) return map;
    const bucket = (personId, monthIdx) => {
      const key = `${personId}_${monthIdx}`;
      if (!map[key]) map[key] = { missions: 0, absences: 0, tasks: 0, absencesByType: {} };
      return map[key];
    };
    const monthIndexOf = (isoDate) => {
      try {
        const d = parseISO(isoDate);
        return days.findIndex(
          (m) => d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth(),
        );
      } catch {
        return -1;
      }
    };
    (planningData.missions || []).forEach((mission) => {
      (mission.assignments || []).forEach((a) => {
        const personId = a.personId || a.person_id;
        if (!personId) return;
        const start = mission.startDate || mission.start_date;
        const end = mission.endDate || mission.end_date;
        if (!start) return;
        const sIdx = monthIndexOf(start);
        const eIdx = end ? monthIndexOf(end) : sIdx;
        if (sIdx === -1) return;
        for (let i = sIdx; i <= (eIdx === -1 ? sIdx : eIdx); i += 1) {
          bucket(personId, i).missions += 1;
        }
      });
    });
    (planningData.availabilities || []).forEach((avail) => {
      if (avail.status === STATUS.REJECTED) return;
      const personId = avail.person_id || avail.personId;
      if (!personId) return;
      const start = avail.start_date || avail.startDate;
      const end = avail.end_date || avail.endDate;
      const sIdx = monthIndexOf(start);
      const eIdx = end ? monthIndexOf(end) : sIdx;
      if (sIdx === -1) return;
      const type = avail.type || 'unavailable';
      for (let i = sIdx; i <= (eIdx === -1 ? sIdx : eIdx); i += 1) {
        const b = bucket(personId, i);
        b.absences += 1;
        b.absencesByType[type] = (b.absencesByType[type] || 0) + 1;
      }
    });
    (planningData.taskAssignments || []).forEach((ta) => {
      const personId = ta.person_id || ta.personId;
      if (!personId) return;
      const idx = monthIndexOf(ta.date);
      if (idx === -1) return;
      bucket(personId, idx).tasks += 1;
    });
    return map;
  }, [
    view,
    days,
    planningData.missions,
    planningData.availabilities,
    planningData.taskAssignments,
  ]);

  const coveredSlotsForPerson = useCallback(
    (personId) => {
      const set = new Set();
      (missionSpans[personId] || []).forEach((s) => {
        for (let i = s.startSlotIdx; i < s.startSlotIdx + s.slotCount; i++) set.add(i);
      });
      return set;
    },
    [missionSpans],
  );

  // Initialize drag handlers hook
  const dragHandlers = useDragHandlers({
    days,
    view,
    coveredSlotsForPerson,
    loadPlanning,
    toast,
    onAssignmentDialogOpen: (dialogState) => setAssignmentDialog(dialogState),
  });

  // Add global mouseup listener for drag handlers
  useEffect(() => {
    const onUp = () => dragHandlers.handleGlobalMouseUp();
    document.addEventListener('mouseup', onUp);
    return () => document.removeEventListener('mouseup', onUp);
  }, [dragHandlers]);

  const windowWidth = useWindowWidth();
  const gridColumns = useMemo(
    () => computeGridColumnsCss({ view, days, module: 'planning', windowWidth }),
    [view, days, windowWidth],
  );

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    const headerScroll = headerScrollRef.current;
    const personCol = personColumnRef.current;
    if (!scrollArea) return;

    const handleScroll = () => {
      if (headerScroll) headerScroll.scrollLeft = scrollArea.scrollLeft;
      if (personCol) personCol.scrollTop = scrollArea.scrollTop;
      const bannerScrollArea = document.querySelector('.banner-scroll-area');
      if (bannerScrollArea) bannerScrollArea.scrollLeft = scrollArea.scrollLeft;
    };
    const handlePersonScroll = () => {
      if (scrollArea) scrollArea.scrollTop = personCol.scrollTop;
    };

    scrollArea.addEventListener('scroll', handleScroll, { passive: true });
    if (personCol) personCol.addEventListener('scroll', handlePersonScroll, { passive: true });
    return () => {
      scrollArea.removeEventListener('scroll', handleScroll);
      if (personCol) personCol.removeEventListener('scroll', handlePersonScroll);
    };
  }, []);

  const isToday = (day) => isSameDay(day, new Date());

  const filteredPersons = useMemo(() => {
    return persons.filter((p) => {
      const matchSearch =
        !planningSearch ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(planningSearch.toLowerCase());
      const matchFilter = !planningFilter || p.type === planningFilter;
      return matchSearch && matchFilter;
    });
  }, [persons, planningSearch, planningFilter]);

  const isPersonInactive = useCallback(
    (p) => p.status === STATUS.INACTIVE || p.isActive === false,
    [],
  );

  const enterpriseTraineeIds = useMemo(() => {
    if (!days.length) return new Set();
    const start = days[0];
    const end = view === 'year' ? endOfMonth(days[days.length - 1]) : days[days.length - 1];
    const ids = new Set();

    (planningData.availabilities || []).forEach((avail) => {
      if (avail.status === STATUS.REJECTED) return;
      if ((avail.type || '').toLowerCase() !== 'entreprise') return;

      try {
        const aStart = parseISO(avail.start_date || avail.startDate);
        const aEnd = parseISO(avail.end_date || avail.endDate);
        if (aStart <= end && aEnd >= start) {
          ids.add(avail.person_id || avail.personId);
        }
      } catch {
        /* ignore */
      }
    });

    return ids;
  }, [planningData.availabilities, days, view]);

  const activeFilteredPersons = filteredPersons.filter((p) => !isPersonInactive(p));
  const inactivePersons = filteredPersons.filter((p) => isPersonInactive(p));

  const permanents = activeFilteredPersons.filter(
    (p) =>
      PERMANENT_TYPES.includes(p.type) ||
      (p.type === 'stagiaire' && enterpriseTraineeIds.has(p.id)),
  );
  const nonPermanentsRaw = activeFilteredPersons.filter(
    (p) =>
      NON_PERMANENT_TYPES.includes(p.type) &&
      !(p.type === 'stagiaire' && enterpriseTraineeIds.has(p.id)),
  );

  const favoriteNonPermanents = useMemo(
    () => sortPersonsByFavorites(nonPermanentsRaw.filter((p) => isFavorite(p.id))),
    [nonPermanentsRaw, isFavorite, sortPersonsByFavorites],
  );

  const nonPermanentsSource = useMemo(
    () => nonPermanentsRaw.filter((p) => !isFavorite(p.id)),
    [nonPermanentsRaw, isFavorite],
  );

  const nonPermanents = useMemo(
    () => sortPersonsByFavorites(nonPermanentsSource),
    [nonPermanentsSource, sortPersonsByFavorites],
  );

  const handleSlotClick = (person, day, slotIndex, period) => {
    if (view === 'year') return;
    if (dragHandlers.dragCreate || dragHandlers.dragMove || dragHandlers.resizeState) return;
    const covered = coveredSlotsForPerson(person.id);
    if (covered.has(slotIndex)) return;
    setAssignmentDialog({ person, day, period: period || 'AM' });
  };

  const handleAssignmentCreated = () => {
    loadPlanning();
  };

  const handleDeleteMission = async (missionToDelete) => {
    const mission = missionToDelete || deleteMission?.mission;
    if (!mission) return;
    const ok = await confirmDelete(
      `Supprimer la mission "${mission.title}" et toutes ses affectations ?`,
    );
    if (!ok) {
      setDeleteMission(null);
      return;
    }
    try {
      await api.deleteMission(mission.id);
      setDeleteMission(null);
      loadPlanning();
    } catch (err) {
      console.error('Erreur suppression mission:', err);
      toast.error('Erreur suppression de la mission');
      setDeleteMission(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return STATUS_COLORS.success;
      case 'option':
        return STATUS_COLORS.warning;
      case 'proposed':
        return 'var(--theme-text-gray)';
      case 'refused':
        return STATUS_COLORS.danger;
      case 'cancelled':
        return 'var(--theme-text-muted)';
      default:
        return '#667eea';
    }
  };

  const renderPersonRow = (person) => {
    const personSpanList = missionSpans[person.id] || [];
    const covered = coveredSlotsForPerson(person.id);
    const personName = `${person.firstName} ${person.lastName || ''}`;
    const isMoving = dragHandlers.dragMove && dragHandlers.dragMove.person.id === person.id;
    const isResizing = dragHandlers.resizeState && dragHandlers.resizeState.person.id === person.id;
    const movingSpanId = isMoving ? dragHandlers.dragMove.span.missionId : null;
    const resizingSpanId = isResizing ? dragHandlers.resizeState.span.missionId : null;

    return (
      <div key={person.id} className="pp-person-row" onMouseUp={dragHandlers.handleGlobalMouseUp}>
        {timeSlots.map((slot, slotIndex) => {
          const weekend = isWeekendFn(slot.day);
          const today = isToday(slot.day);
          const todayCls = today ? ' today-slot' : '';
          let spanHere = personSpanList.find((s) => s.startSlotIdx === slotIndex);
          const isCovered = covered.has(slotIndex);
          const isDragSel = dragHandlers.isInDragSelection(person.id, slotIndex);
          let movePreviewHere = null;
          if (isMoving && dragHandlers.dragMove.currentStartIdx === slotIndex && movingSpanId) {
            movePreviewHere = dragHandlers.dragMove.span;
          }
          const isOriginalBeingMoved = spanHere && isMoving && spanHere.missionId === movingSpanId;
          let resizePreviewHere = null;
          if (
            isResizing &&
            dragHandlers.resizeState.currentStartIdx === slotIndex &&
            resizingSpanId
          ) {
            resizePreviewHere = {
              ...dragHandlers.resizeState.span,
              slotCount: dragHandlers.resizeState.currentSlotCount,
            };
          }
          const isOriginalBeingResized =
            spanHere && isResizing && spanHere.missionId === resizingSpanId;
          const dayLabel =
            view === 'year'
              ? format(slot.day, 'MMMM yyyy', { locale: fr })
              : format(slot.day, 'EEEE d MMM', { locale: fr });
          const anyDragActive = dragHandlers.isAnyDragActive();
          const absenceKey = `${person.id}_${slotIndex}`;
          const absence = absenceSlots[absenceKey];
          const hasAbsence = !!absence;
          const hasBlockingAbsence = !!absence && absence.is_unavailability !== false;
          const absenceColor = hasAbsence
            ? LEAVE_TYPE_COLORS[absence.type] || 'var(--theme-text-muted)'
            : null;
          const absenceLabel = hasAbsence ? LEAVE_TYPE_LABELS[absence.type] || '' : '';
          const absencePeriodLabel =
            hasAbsence && absence.period !== 'FULL' ? ` (${absence.period})` : '';
          const absenceTooltip = hasAbsence
            ? `${absenceLabel}${absencePeriodLabel}${absence.reason ? ' — ' + absence.reason : ''}${absence.status === STATUS.PENDING ? ' (en attente)' : ''}`
            : '';
          const isFullAbsence = hasBlockingAbsence && absence.period === 'FULL';
          const tasksHere = taskSlots[`${person.id}_${slotIndex}`] || [];

          return (
            <div
              key={slotIndex}
              className={`pp-slot${weekend ? ' weekend' : ''}${todayCls}${isCovered && !isOriginalBeingMoved ? ' has-assignment' : ''}${isHovered ? ' pp-cell-hovered' : ''}${isDragSel ? ' pp-drag-selected' : ''}${hasBlockingAbsence ? ' pp-slot-absence' : ''}`}
              role={!isCovered && !isFullAbsence && view !== 'year' ? 'button' : undefined}
              tabIndex={!isCovered && !isFullAbsence && view !== 'year' ? 0 : undefined}
              onMouseDown={(e) =>
                !isCovered &&
                !isFullAbsence &&
                dragHandlers.handleSlotMouseDown(person, slotIndex, e)
              }
              onContextMenu={(e) => {
                if (isCovered) return;
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, person, day: slot.day });
              }}
              onMouseEnter={() => {
                dragHandlers.handleSlotMouseEnter(person, slotIndex);
                if (!anyDragActive) setHoveredSlot({ personId: person.id, slotIndex });
              }}
              onMouseLeave={() => {
                if (!anyDragActive) setHoveredSlot(null);
              }}
              onMouseUp={dragHandlers.handleGlobalMouseUp}
              onClick={(e) => {
                if (isCovered || isFullAbsence || dragHandlers.wasDraggedRef.current) {
                  dragHandlers.wasDraggedRef.current = false;
                  return;
                }
                e.stopPropagation();
                const period = hasBlockingAbsence
                  ? absence.period === 'AM'
                    ? 'PM'
                    : 'AM'
                  : undefined;
                handleSlotClick(person, slot.day, slotIndex, period);
              }}
              onKeyDown={(e) =>
                !isCovered &&
                !isFullAbsence &&
                view !== 'year' &&
                triggerOnEnterSpace(e, () => {
                  const period = hasBlockingAbsence
                    ? absence.period === 'AM'
                      ? 'PM'
                      : 'AM'
                    : undefined;
                  handleSlotClick(person, slot.day, slotIndex, period);
                })
              }
              data-emag-tooltip={
                isHovered && !anyDragActive
                  ? hasAbsence
                    ? `${personName} — ${absenceTooltip}`
                    : `${personName} — ${dayLabel}`
                  : undefined
              }
              style={{
                cursor: view !== 'year' && !isCovered && !isFullAbsence ? 'crosshair' : 'default',
                ...(hasAbsence
                  ? (() => {
                      const isPending = absence.status === STATUS.PENDING;
                      const baseAlpha = isPending ? '25' : '40';
                      const stripesAlpha = isPending ? '70' : '00';
                      const stripes = isPending
                        ? `, repeating-linear-gradient(45deg, transparent 0, transparent 5px, ${absenceColor}${stripesAlpha} 5px, ${absenceColor}${stripesAlpha} 8px)`
                        : '';
                      let backgroundImage = 'none';
                      if (absence.period === 'AM') {
                        backgroundImage = `linear-gradient(to bottom, ${absenceColor}${baseAlpha} 50%, transparent 50%)${stripes}`;
                      } else if (absence.period === 'PM') {
                        backgroundImage = `linear-gradient(to bottom, transparent 50%, ${absenceColor}${baseAlpha} 50%)${stripes}`;
                      } else if (isPending) {
                        backgroundImage = `repeating-linear-gradient(45deg, transparent 0, transparent 5px, ${absenceColor}${stripesAlpha} 5px, ${absenceColor}${stripesAlpha} 8px)`;
                      }
                      return {
                        backgroundColor:
                          absence.period === 'FULL' ? absenceColor + baseAlpha : 'transparent',
                        backgroundImage,
                        ...(isPending
                          ? {
                              outline: `1.5px dashed ${absenceColor}`,
                              outlineOffset: '-2px',
                            }
                          : {}),
                      };
                    })()
                  : {}),
              }}
            >
              {view === 'year' &&
                (() => {
                  const s = yearStats[`${person.id}_${slotIndex}`];
                  if (!s || (s.missions === 0 && s.absences === 0 && s.tasks === 0)) return null;
                  return (
                    <div className="pp-year-cell-stats">
                      {s.missions > 0 && (
                        <span
                          className="pp-year-stat pp-year-stat-mission"
                          title={`${s.missions} mission(s)`}
                        >
                          {s.missions}M
                        </span>
                      )}
                      {s.absences > 0 && (
                        <span
                          className="pp-year-stat pp-year-stat-absence"
                          title={`${s.absences} absence(s)`}
                        >
                          {s.absences}A
                        </span>
                      )}
                      {s.tasks > 0 && (
                        <span
                          className="pp-year-stat pp-year-stat-task"
                          title={`${s.tasks} tâche(s)`}
                        >
                          {s.tasks}T
                        </span>
                      )}
                    </div>
                  );
                })()}
              {hasAbsence && !isCovered && (
                <span
                  className="pp-absence-label"
                  style={{
                    color: absenceColor,
                    fontStyle: absence.status === STATUS.PENDING ? 'italic' : 'normal',
                    opacity: absence.status === STATUS.PENDING ? 0.85 : 1,
                  }}
                >
                  {absence.status === STATUS.PENDING ? '⏳ ' : ''}
                  {absenceLabel}
                  {absencePeriodLabel}
                </span>
              )}
              {tasksHere.length > 0 && !isCovered && (
                <div className="pp-task-chips">
                  {tasksHere.map((task) => (
                    <div
                      key={task.id}
                      className={`pp-task-chip${task.sourceType === 'affaire' ? ' affaire' : ''}`}
                      title={`${task.title}${task.affaireNum ? ` (${task.affaireNum})` : ''}${task.period ? ` — ${task.period}` : ''}`}
                    >
                      <span className="pp-task-chip-title">
                        {task.title || task.affaireNum || 'Tâche'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {spanHere &&
                !isOriginalBeingMoved &&
                !isOriginalBeingResized &&
                renderAssignmentBlock(spanHere, person, slotIndex, false)}
              {spanHere &&
                (isOriginalBeingMoved || isOriginalBeingResized) &&
                renderAssignmentBlock(spanHere, person, slotIndex, true)}
              {movePreviewHere && renderPreviewBlock(movePreviewHere, person)}
              {resizePreviewHere && renderPreviewBlock(resizePreviewHere, person)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderAssignmentBlock = (spanHere, person, slotIndex, isGhost) => {
    const assignStatus = spanHere.assignment?.status || '';
    const missionTitle = spanHere.mission?.title || '';
    return (
      <div
        className={`pp-assignment-block${spanHere.clippedLeft ? ' clipped-left' : ''}${spanHere.clippedRight ? ' clipped-right' : ''}${isGhost ? ' pp-ghost' : ''}`}
        role={!isGhost ? 'button' : undefined}
        tabIndex={!isGhost ? 0 : undefined}
        style={{
          backgroundColor: 'transparent',
          '--indicator-color': getStatusColor(assignStatus),
          borderRight: spanHere.clippedRight
            ? `3px dashed ${getStatusColor(assignStatus)}40`
            : 'none',
          width: `calc(${spanHere.slotCount * 100}% + ${spanHere.slotCount - 1}px)`,
        }}
        title=""
        onMouseDown={(e) =>
          !isGhost && dragHandlers.handleBlockMouseDown(e, spanHere, person, slotIndex)
        }
        onClick={(e) => {
          if (isGhost) return;
          if (dragHandlers.wasDraggedRef.current) {
            dragHandlers.wasDraggedRef.current = false;
            return;
          }
          e.stopPropagation();
          setAssignmentDialog({
            person,
            day: days[slotIndex],
            period: 'AM',
            editMission: spanHere,
          });
        }}
        onKeyDown={(e) =>
          !isGhost &&
          triggerOnEnterSpace(e, () =>
            setAssignmentDialog({
              person,
              day: days[slotIndex],
              period: 'AM',
              editMission: spanHere,
            }),
          )
        }
      >
        <div className="pp-assignment-days">
          {Array.from({ length: spanHere.slotCount }, (_, i) => {
            const dayDate = days[spanHere.startSlotIdx + i];
            if (!dayDate) return null;
            const dayKey = format(dayDate, 'yyyy-MM-dd');
            const isOn = spanHere.onDays.has(dayKey);
            const isWe = isWeekendFn(dayDate);
            return (
              <div
                key={dayKey}
                className={`pp-assignment-day-stripe${isOn ? ' on' : ' off'}${isWe ? ' we' : ''}`}
                style={{
                  width: `${100 / spanHere.slotCount}%`,
                  backgroundColor: isOn
                    ? getStatusColor(assignStatus) + 'C0'
                    : getStatusColor(assignStatus) + '25',
                }}
              />
            );
          })}
        </div>
        <div className="pp-assignment-content">
          <span className="pp-assignment-title">{missionTitle}</span>
          {spanHere.assignment?.position &&
            (() => {
              let posNames = [];
              try {
                const parsed = JSON.parse(spanHere.assignment.position);
                if (Array.isArray(parsed)) posNames = parsed;
                else posNames = [spanHere.assignment.position];
              } catch {
                posNames = [spanHere.assignment.position];
              }
              return posNames.length > 0 ? (
                <span className="pp-assignment-position">{posNames.join(', ')}</span>
              ) : null;
            })()}
        </div>
        {!isGhost && (
          <>
            <Tooltip content="Supprimer cette mission" position="bottom">
              <Button
                variant="ghost"
                className="pp-assignment-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteMission(spanHere.mission);
                }}
              >
                <Trash2 size={12} />
              </Button>
            </Tooltip>
            {view !== 'year' && !spanHere.clippedLeft && (
              <div
                className="pp-resize-handle pp-resize-handle-start"
                role="separator"
                aria-orientation="horizontal"
                onMouseDown={(e) => dragHandlers.handleResizeStart(e, spanHere, person, 'start')}
                title="Glisser pour modifier le début"
              />
            )}
            {view !== 'year' && !spanHere.clippedRight && (
              <div
                className="pp-resize-handle pp-resize-handle-end"
                role="separator"
                aria-orientation="horizontal"
                onMouseDown={(e) => dragHandlers.handleResizeStart(e, spanHere, person, 'end')}
                title="Glisser pour modifier la fin"
              />
            )}
          </>
        )}
      </div>
    );
  };

  const renderPreviewBlock = (span, _person) => {
    const assignStatus = span.assignment?.status || '';
    const missionTitle = span.mission?.title || '';
    return (
      <div
        className="pp-assignment-block pp-preview"
        style={{
          '--indicator-color': getStatusColor(assignStatus),
          width: `calc(${span.slotCount * 100}% + ${span.slotCount - 1}px)`,
        }}
      >
        <div className="pp-assignment-days">
          {Array.from({ length: span.slotCount }, (_, i) => (
            <div
              key={i}
              className="pp-assignment-day-stripe on"
              style={{
                width: `${100 / span.slotCount}%`,
                backgroundColor: getStatusColor(assignStatus) + '80',
              }}
            />
          ))}
        </div>
        <div className="pp-assignment-content">
          <span className="pp-assignment-title">{missionTitle}</span>
        </div>
      </div>
    );
  };

  const isHovered = hoveredSlot ? hoveredSlot : null;

  return (
    <div className="personnel-tab-content planning-full">
      <div className="pp-planning-toolbar">
        {setView && setCurrentDate && (
          <PlanningHeader
            view={view}
            setView={setView}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            getDateLabel={getDateLabel}
            ppShowTodayHighlight={ppShowTodayHighlight}
            goToPrevious={goToPrevious}
            goToNext={goToNext}
            goToToday={goToToday}
            showMonthSelector={showMonthSelector}
            setShowMonthSelector={setShowMonthSelector}
            showWeekSelector={showWeekSelector}
            setShowWeekSelector={setShowWeekSelector}
            showYearSelector={showYearSelector}
            setShowYearSelector={setShowYearSelector}
          />
        )}
        <PlanningToolbar
          planningSearch={planningSearch}
          setPlanningSearch={setPlanningSearch}
          planningFilter={planningFilter}
          setPlanningFilter={setPlanningFilter}
          filteredCount={filteredPersons.length}
          totalCount={persons.length}
        />
      </div>

      {googleBanner}

      {filteredPersons.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={48} />}
          title="Ajoutez du personnel pour afficher le planning"
          action={
            onPersonCreate && (
              <Button variant="ghost" className="personnel-add-btn u-mt-3" onClick={onPersonCreate}>
                <Plus size={16} /> Ajouter une personne
              </Button>
            )
          }
        />
      ) : (
        <div className="pp-planning-with-panel">
          <div className="pp-calendar-container">
            <div className="pp-planning-search-row">
              <div className="pp-planning-search-wrap" style={{ width: personColumnWidth }}>
                <SearchBar
                  value={planningSearch}
                  onChange={setPlanningSearch}
                  placeholder="Rechercher…"
                  size="sm"
                />
                {onPersonCreate && (
                  <Tooltip
                    content="Ajouter une personne (modification/suppression : clic droit sur la ligne)"
                    position="bottom"
                  >
                    <Button
                      variant="primary"
                      className="pp-planning-search-add-btn"
                      onClick={onPersonCreate}
                      aria-label="Ajouter une personne"
                    >
                      <Plus size={14} />
                    </Button>
                  </Tooltip>
                )}
              </div>
            </div>
            <div className="pp-headers-row">
              <div className="pp-column-header">
                <span>Permanents</span>
                <div className="pp-column-header-actions">
                  {pendingLeaveCount > 0 && (
                    <Tooltip content="Demandes de congés en attente" position="bottom">
                      <Button
                        variant="ghost"
                        className="pp-leave-badge-btn"
                        onClick={() => setShowLeaveApproval(true)}
                      >
                        <Clock size={12} />
                        <span className="pp-leave-badge-count">{pendingLeaveCount}</span>
                      </Button>
                    </Tooltip>
                  )}
                  <Button
                    variant="ghost"
                    className="pp-section-toggle"
                    onClick={() =>
                      setCollapsedSections((prev) => ({ ...prev, permanents: !prev.permanents }))
                    }
                    title={collapsedSections.permanents ? 'Développer' : 'Rétracter'}
                  >
                    {collapsedSections.permanents ? '▼' : '▲'}
                  </Button>
                </div>
              </div>
              <div className="pp-headers-scroll" ref={headerScrollRef}>
                <div className="pp-headers-grid" style={{ gridTemplateColumns: gridColumns }}>
                  {view === 'year' ? (
                    <div className="pp-header">
                      {days.map((monthDate, i) => (
                        <div
                          key={i}
                          className={`pp-header-cell month-header${isSameDay(startOfMonth(new Date()), startOfMonth(monthDate)) ? ' today' : ''}`}
                        >
                          <div className="pp-month-name">
                            {format(monthDate, 'MMMM', { locale: fr })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="pp-header">
                      {days.map((day, i) => (
                        <div
                          key={i}
                          className={`pp-header-cell day-header${isWeekendFn(day) ? ' weekend' : ''}${isToday(day) ? ' today' : ''}`}
                        >
                          <div className="pp-day-name">{format(day, 'EEEE', { locale: fr })}</div>
                          <div className="pp-day-number">
                            {format(day, 'd MMMM', { locale: fr })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pp-content-row">
              <div
                className="pp-person-column"
                ref={personColumnRef}
                style={{ width: personColumnWidth }}
              >
                <button
                  type="button"
                  className="pp-column-resize-handle"
                  aria-label="Redimensionner la colonne du personnel"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startWidth = personColumnWidth;
                    columnResizingRef.current = true;
                    const onMove = (ev) => {
                      if (!columnResizingRef.current) return;
                      const delta = ev.clientX - startX;
                      setPersonColumnWidth(Math.max(150, Math.min(420, startWidth + delta)));
                    };
                    const onUp = () => {
                      columnResizingRef.current = false;
                      document.removeEventListener('mousemove', onMove);
                      document.removeEventListener('mouseup', onUp);
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                    e.preventDefault();
                    const delta = e.key === 'ArrowLeft' ? -16 : 16;
                    setPersonColumnWidth((width) => Math.max(150, Math.min(420, width + delta)));
                  }}
                />
                {!collapsedSections.permanents &&
                  permanents.map((person) => (
                    <div
                      key={person.id}
                      className={`pp-person-cell u-cursor-pointer${isHovered?.personId === person.id ? ' pp-row-hovered' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (clickTimerRef.current) return;
                        clickTimerRef.current = setTimeout(() => {
                          clickTimerRef.current = null;
                          setSelectedPersonForDetails(person);
                        }, 250);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (clickTimerRef.current) {
                          clearTimeout(clickTimerRef.current);
                          clickTimerRef.current = null;
                        }
                        onPersonEdit && onPersonEdit(person);
                      }}
                      onKeyDown={(e) =>
                        triggerOnEnterSpace(e, () => setSelectedPersonForDetails(person))
                      }
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, person });
                      }}
                    >
                      <Button
                        variant="ghost"
                        className={`pp-fav-star${isFavorite(person.id) ? ' active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(person.id);
                        }}
                        title={
                          isFavorite(person.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'
                        }
                      >
                        <Star size={12} fill={isFavorite(person.id) ? 'currentColor' : 'none'} />
                      </Button>
                      <span className="pp-person-name">
                        {person.firstName} {person.lastName || ''}
                      </span>
                      <span className={`person-type-badge mini type-${person.type}`}>
                        {PERSON_TYPES.find((t) => t.value === person.type)?.label || person.type}
                      </span>
                    </div>
                  ))}

                {favoriteNonPermanents.length > 0 && (
                  <div className="pp-section-header">
                    <span>Favoris</span>
                    <Button
                      variant="ghost"
                      className="pp-section-toggle"
                      onClick={() =>
                        setCollapsedSections((prev) => ({
                          ...prev,
                          favoris: !prev.favoris,
                        }))
                      }
                    >
                      {collapsedSections.favoris ? '▼' : '▲'}
                    </Button>
                  </div>
                )}
                {!collapsedSections.favoris &&
                  favoriteNonPermanents.map((person) => (
                    <div
                      key={person.id}
                      className={`pp-person-cell u-cursor-pointer pp-person-favorite${isHovered?.personId === person.id ? ' pp-row-hovered' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (clickTimerRef.current) return;
                        clickTimerRef.current = setTimeout(() => {
                          clickTimerRef.current = null;
                          setSelectedPersonForDetails(person);
                        }, 250);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (clickTimerRef.current) {
                          clearTimeout(clickTimerRef.current);
                          clickTimerRef.current = null;
                        }
                        onPersonEdit && onPersonEdit(person);
                      }}
                      onKeyDown={(e) =>
                        triggerOnEnterSpace(e, () => setSelectedPersonForDetails(person))
                      }
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, person });
                      }}
                    >
                      <Button
                        variant="ghost"
                        className="pp-fav-star active"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(person.id);
                        }}
                        title="Retirer des favoris"
                      >
                        <Star size={12} fill="currentColor" />
                      </Button>
                      <span className="pp-person-name">
                        {person.firstName} {person.lastName || ''}
                      </span>
                      <span className={`person-type-badge mini type-${person.type}`}>
                        {person.type === 'contractuel'
                          ? CONTRACT_TYPES.find((c) => c.value === person.contractType)?.label ||
                            'Contractuel'
                          : PERSON_TYPES.find((t) => t.value === person.type)?.label || person.type}
                      </span>
                    </div>
                  ))}

                {nonPermanents.length > 0 && (
                  <div className="pp-section-header">
                    <span>Non-permanents</span>
                    <Button
                      variant="ghost"
                      className="pp-section-toggle"
                      onClick={() =>
                        setCollapsedSections((prev) => ({
                          ...prev,
                          nonPermanents: !prev.nonPermanents,
                        }))
                      }
                    >
                      {collapsedSections.nonPermanents ? '▼' : '▲'}
                    </Button>
                  </div>
                )}
                {!collapsedSections.nonPermanents &&
                  nonPermanents.map((person) => (
                    <div
                      key={person.id}
                      className={`pp-person-cell u-cursor-pointer${isHovered?.personId === person.id ? ' pp-row-hovered' : ''}${isFavorite(person.id) ? ' pp-person-favorite' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (clickTimerRef.current) return;
                        clickTimerRef.current = setTimeout(() => {
                          clickTimerRef.current = null;
                          setSelectedPersonForDetails(person);
                        }, 250);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (clickTimerRef.current) {
                          clearTimeout(clickTimerRef.current);
                          clickTimerRef.current = null;
                        }
                        onPersonEdit && onPersonEdit(person);
                      }}
                      onKeyDown={(e) =>
                        triggerOnEnterSpace(e, () => setSelectedPersonForDetails(person))
                      }
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, person });
                      }}
                    >
                      <Button
                        variant="ghost"
                        className={`pp-fav-star${isFavorite(person.id) ? ' active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(person.id);
                        }}
                        title={
                          isFavorite(person.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'
                        }
                      >
                        <Star size={12} fill={isFavorite(person.id) ? 'currentColor' : 'none'} />
                      </Button>
                      <span className="pp-person-name">
                        {person.firstName} {person.lastName || ''}
                      </span>
                      <span className={`person-type-badge mini type-${person.type}`}>
                        {person.type === 'contractuel'
                          ? CONTRACT_TYPES.find((c) => c.value === person.contractType)?.label ||
                            'Contractuel'
                          : PERSON_TYPES.find((t) => t.value === person.type)?.label || person.type}
                      </span>
                    </div>
                  ))}

                {inactivePersons.length > 0 && (
                  <div className="pp-section-header">
                    <span>Inactifs</span>
                    <Button
                      variant="ghost"
                      className="pp-section-toggle"
                      onClick={() =>
                        setCollapsedSections((prev) => ({
                          ...prev,
                          inactifs: !prev.inactifs,
                        }))
                      }
                    >
                      {collapsedSections.inactifs ? '▼' : '▲'}
                    </Button>
                  </div>
                )}
                {!collapsedSections.inactifs &&
                  inactivePersons.map((person) => (
                    <div
                      key={person.id}
                      className={`pp-person-cell u-cursor-pointer pp-person-inactive${isHovered?.personId === person.id ? ' pp-row-hovered' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (clickTimerRef.current) return;
                        clickTimerRef.current = setTimeout(() => {
                          clickTimerRef.current = null;
                          setSelectedPersonForDetails(person);
                        }, 250);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (clickTimerRef.current) {
                          clearTimeout(clickTimerRef.current);
                          clickTimerRef.current = null;
                        }
                        onPersonEdit && onPersonEdit(person);
                      }}
                      onKeyDown={(e) =>
                        triggerOnEnterSpace(e, () => setSelectedPersonForDetails(person))
                      }
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, person });
                      }}
                    >
                      <Button
                        variant="ghost"
                        className={`pp-fav-star${isFavorite(person.id) ? ' active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(person.id);
                        }}
                        title={
                          isFavorite(person.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'
                        }
                      >
                        <Star size={12} fill={isFavorite(person.id) ? 'currentColor' : 'none'} />
                      </Button>
                      <span className="pp-person-name">
                        {person.firstName} {person.lastName || ''}
                      </span>
                      <span className="pp-status-dot inactive">○ Inactif</span>
                    </div>
                  ))}
              </div>

              <div className="pp-scroll-area" ref={scrollAreaRef}>
                <div
                  className={`pp-grid ${view}-view${dragHandlers.dragCreate ? ' pp-dragging' : ''}${dragHandlers.resizeState ? ' pp-resizing' : ''}${dragHandlers.dragMove ? ' pp-dragging' : ''}`}
                  style={{ gridTemplateColumns: gridColumns }}
                >
                  {!collapsedSections.permanents && permanents.map(renderPersonRow)}

                  {favoriteNonPermanents.length > 0 && (
                    <div className="pp-section-separator" style={{ gridColumn: '1 / -1' }}>
                      <span>Favoris</span>
                      <Button
                        variant="ghost"
                        className="pp-section-toggle"
                        onClick={() =>
                          setCollapsedSections((prev) => ({
                            ...prev,
                            favoris: !prev.favoris,
                          }))
                        }
                      >
                        {collapsedSections.favoris ? '▼' : '▲'}
                      </Button>
                    </div>
                  )}

                  {!collapsedSections.favoris && favoriteNonPermanents.map(renderPersonRow)}

                  {nonPermanents.length > 0 && (
                    <div className="pp-section-separator" style={{ gridColumn: '1 / -1' }}>
                      <span>Non-permanents</span>
                      <Button
                        variant="ghost"
                        className="pp-section-toggle"
                        onClick={() =>
                          setCollapsedSections((prev) => ({
                            ...prev,
                            nonPermanents: !prev.nonPermanents,
                          }))
                        }
                      >
                        {collapsedSections.nonPermanents ? '▼' : '▲'}
                      </Button>
                    </div>
                  )}

                  {!collapsedSections.nonPermanents && nonPermanents.map(renderPersonRow)}

                  {inactivePersons.length > 0 && (
                    <div className="pp-section-separator" style={{ gridColumn: '1 / -1' }}>
                      <span>Inactifs</span>
                      <Button
                        variant="ghost"
                        className="pp-section-toggle"
                        onClick={() =>
                          setCollapsedSections((prev) => ({
                            ...prev,
                            inactifs: !prev.inactifs,
                          }))
                        }
                      >
                        {collapsedSections.inactifs ? '▼' : '▲'}
                      </Button>
                    </div>
                  )}

                  {!collapsedSections.inactifs && inactivePersons.map(renderPersonRow)}
                </div>
              </div>
            </div>
          </div>
          <PersonnelSlidePanel
            person={selectedPersonForDetails}
            positions={positions}
            skills={skills}
            onClose={() => setSelectedPersonForDetails(null)}
            onEdit={(person) => {
              setSelectedPersonForDetails(null);
              onPersonEdit && onPersonEdit(person);
            }}
            onRequestLeave={(personId) => {
              const p = persons.find((pp) => pp.id === personId);
              setShowLeaveModal({ person: p || null });
            }}
          />
        </div>
      )}

      {assignmentDialog && (
        <AssignmentDialog
          person={assignmentDialog.person}
          day={assignmentDialog.day}
          endDay={assignmentDialog.endDay}
          period={assignmentDialog.period}
          skills={skills}
          positions={positions}
          editMission={assignmentDialog.editMission || null}
          googleEvents={googleEvents}
          onClose={() => setAssignmentDialog(null)}
          onCreated={handleAssignmentCreated}
          onDelete={(mission) => {
            setAssignmentDialog(null);
            handleDeleteMission(mission);
          }}
        />
      )}

      {DeleteConfirmRenderer}

      {showLeaveModal && (
        <LeaveRequestForm
          person={showLeaveModal.person || null}
          persons={persons.filter((p) => !isPersonInactive(p))}
          isAdmin={!!currentUser?.isAdmin}
          currentUser={currentUser}
          onClose={() => setShowLeaveModal(null)}
          onCreated={() => {
            loadPlanning();
          }}
        />
      )}

      {showLeaveApproval && (
        <LeaveValidationPanel
          onClose={() => setShowLeaveApproval(false)}
          onRefresh={() => loadPlanning()}
        />
      )}

      {showLeaveHistory && (
        <LeaveRequestsPanel
          personId={showLeaveHistory.personId}
          isAdmin={!!currentUser?.isAdmin}
          onClose={() => setShowLeaveHistory(null)}
          onNewRequest={() => {
            const p = persons.find((pp) => pp.id === showLeaveHistory.personId);
            setShowLeaveHistory(null);
            setShowLeaveModal({ person: p || null });
          }}
          onRefresh={() => loadPlanning()}
        />
      )}

      {contextMenu && (
        <PersonnelContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          person={contextMenu.person}
          onSelect={(type, person) => {
            const day = contextMenu.day;
            setContextMenu(null);
            if (type === 'suivi') {
              onOpenSuivi && onOpenSuivi(person);
            } else if (type === 'conge_paye') {
              setShowLeaveModal({ person, day });
            } else {
              setPeriodCalendar({ person, type, day });
            }
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {periodCalendar && (
        <PeriodCalendarModal
          person={periodCalendar.person}
          periodType={periodCalendar.type}
          initialDate={periodCalendar.day}
          isAdmin={false}
          onClose={() => setPeriodCalendar(null)}
          onCreated={() => loadPlanning()}
        />
      )}
    </div>
  );
};

export default PlanningTab;
