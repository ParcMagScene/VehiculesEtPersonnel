import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import {
  ClipboardList, Plus, ChevronLeft, ChevronRight, ChevronDown, Check, X, Clock,
  User, Edit2, Trash2, FileDown, Briefcase, MapPin, AlertCircle,
  CalendarDays, LayoutList, Monitor, Calendar, UserPlus, Eye, EyeOff, Settings,
  Repeat, SkipForward, Link, RefreshCw, Truck, CheckCheck
} from 'lucide-react';
import api from '../../utils/api';
import { AFFAIRE_TYPE_INFO } from '../../utils/affaireConstants';
import AffaireBadge from '../AffaireBadge';
import { formatDateFr } from '../../utils/formatUtils';
import { Accordion, Button, DetailRow, Divider, Input, Select, Tooltip } from '@/design-system';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import EventTaskModal from './EventTaskModal';
import TaskEditModal from './TaskEditModal';
import AddTaskModal from './AddTaskModal';
import { STATUS } from '../../constants';

import './TaskPlanningPanel.css';

const TaskPDFExportModal = lazy(() => import('./TaskPDFExportModal'));

// ═══ Constantes ═══
const SECTIONS = {
  rdv:                { label: 'Rendez-vous',          emoji: '📅', color: '#059669' },
  evenements:         { label: 'Événements Google',    emoji: '📌', color: '#64748b' },
  // — Prioritaires & Courses en premier —
  taches_prioritaires:{ label: 'Tâches Prioritaires',  emoji: '🔴', color: '#ef4444' },
  courses:            { label: 'Courses',              emoji: '🚗', color: '#8b5cf6' },
  // — Préparations —
  prep_locations:     { label: 'Préparations Locations',      emoji: '📦', color: '#f59e0b', affaireOnly: true },
  prep_prestations:   { label: 'Préparations Prestations',    emoji: '🎤', color: '#3b82f6', affaireOnly: true },
  prep_ventes:        { label: 'Préparations Ventes',         emoji: '🏷️', color: '#10b981', affaireOnly: true },
  prep_installations: { label: 'Préparations Installations',  emoji: '⚙️', color: '#8b5cf6', affaireOnly: true },
  prep_tournees:      { label: 'Préparations Tournées',       emoji: '🚐', color: '#ec4899', affaireOnly: true },
  // — Autres étapes opérationnelles —
  chargement:         { label: 'Chargement',           emoji: '📦', color: '#f59e0b', affaireOnly: true },
  depart:             { label: 'Départ',               emoji: '🚀', color: '#3b82f6', affaireOnly: true },
  installation:       { label: 'Installation',         emoji: '🛠️', color: '#10b981', affaireOnly: true },
  montage:            { label: 'Montage',              emoji: '🔩', color: '#0891b2', affaireOnly: true },
  demontage:          { label: 'Démontage',            emoji: '🔧', color: '#dc2626', affaireOnly: true },
  // — En bas —
  taches_secondaires: { label: 'Tâches Secondaires',   emoji: '🟡', color: '#f59e0b' },
  manual:             { label: 'Autres',               emoji: '📋', color: 'var(--theme-text-secondary)' },
};

// Sections événements (haut) vs opérationnelles (bas)
const EVENT_SECTION_KEYS = ['rdv', 'evenements'];
const OPS_SECTION_KEYS = Object.keys(SECTIONS).filter(k => !EVENT_SECTION_KEYS.includes(k));

const EVENT_TYPES = {
  preparation:  { label: 'Préparation',  emoji: '🔧', color: '#6366f1' },
  enlevement:   { label: 'Enlèvement',   emoji: '📦', color: '#f59e0b' },
  livraison:    { label: 'Livraison',     emoji: '🚚', color: '#10b981' },
  depart:       { label: 'Départ',        emoji: '🚀', color: '#3b82f6' },
  retour:       { label: 'Retour',        emoji: '↩️', color: '#8b5cf6' },
  recuperation: { label: 'Récupération',  emoji: '📥', color: '#ef4444' },
  montage:      { label: 'Montage',       emoji: '🔩', color: '#0891b2' },
  demontage:    { label: 'Démontage',     emoji: '🔧', color: '#dc2626' },
};

const mapEventToSection = (event) => {
  const type = event.type;
  const cat = event.category;
  if (type === 'preparation') {
    if (cat === 'location') return 'prep_locations';
    if (cat === 'prestation') return 'prep_prestations';
    if (cat === 'vente') return 'prep_ventes';
    if (cat === 'installation') return 'prep_installations';
    return 'prep_locations';
  }
  if (type === 'enlevement') return 'courses';
  if (type === 'depart') return 'depart';
  if (type === 'livraison') return 'courses';
  if (type === 'retour') return 'courses';
  if (type === 'recuperation') return 'courses';
  if (type === 'installation') return 'installation';
  if (type === 'montage') return 'montage';
  if (type === 'demontage') return 'demontage';
  return 'evenements';
};

const mapAffaireToSection = (affaire) => {
  const info = AFFAIRE_TYPE_INFO[affaire.type];
  return info ? info.section : 'manual';
};

const _STATUS_ORDER = ['pending', 'in_progress', 'done', 'cancelled'];

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

// Obtenir le lundi de la semaine contenant dateStr
const getMonday = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Obtenir les 7 jours de la semaine (lun→dim)
const getWeekDays = (dateStr) => {
  const monday = getMonday(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
};

// ═══ Composant Principal ═══
function TaskPlanningPanel({ _currentUser, refreshKey, googleEvents = [], onNavigateToEntity }) {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [tasks, setTasks] = useState([]);
  const [persons, setPersons] = useState([]);
  const [affaires, setAffaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'
  const [expandedWeekDay, setExpandedWeekDay] = useState(null); // dayStr to expand in week view
  const [wkSplitRatio, setWkSplitRatio] = useState(50); // % height for events section
  const wkSplitDragging = useRef(false);
  const wkSplitContentRef = useRef(null);

  // Inline add form
  const [_addingSection, setAddingSection] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPerson, setNewTaskPerson] = useState('');
  const [newTaskAffaire, setNewTaskAffaire] = useState('');
  const [newTaskType, setNewTaskType] = useState('');
  const [newTaskClient, setNewTaskClient] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newTaskPeriod, setNewTaskPeriod] = useState('AM');
  const [newTaskGoogleEvent, setNewTaskGoogleEvent] = useState('');
  const [newTaskReservation, setNewTaskReservation] = useState(''); // reservation ID or '__new__'
  const [newTaskVehicle, setNewTaskVehicle] = useState(''); // vehicle ID (for new reservation)
  // Affaire autocomplete (inline add)
  const [affaireInlineSearch, setAffaireInlineSearch] = useState('');
  const [_affaireInlineOpen, setAffaireInlineOpen] = useState(false);
  const [allAffaires, setAllAffaires] = useState([]);
  const affaireInlineRef = useRef(null);
  const [showPdfExport, setShowPdfExport] = useState(false);
  const [displayEvents, setDisplayEvents] = useState([]);
  // Véhicules & réservations (pour le picker dans le formulaire courses/chargement)
  const [vehicles, setVehicles] = useState([]);
  const [reservations, setReservations] = useState([]);
  // Multi-assignment
  const [planningAssignments, setPlanningAssignments] = useState([]);
  const [assigningEntity, setAssigningEntity] = useState(null); // "task:123" | "display_event:456" | "affaire:AF1234"
  // RDV detail expansion
  const [expandedRdv, setExpandedRdv] = useState(null);
  // EventTaskModal
  const [eventTaskModalEvent, setEventTaskModalEvent] = useState(null);
  // TaskEditModal — édition individuelle d'une tâche
  const [editingTask, setEditingTask] = useState(null);
  // AddTaskModal — modal unique d'ajout de tâche
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

  // ── Tâches récurrentes ──
  const [showRecurring, setShowRecurring] = useState(false);
  const [recurringTasks, setRecurringTasks] = useState([]);
  const [recurringForm, setRecurringForm] = useState(null); // null = fermé, {} = nouveau, {id,...} = édition

  // ── Collapse sections ──
  const [collapsedSections, setCollapsedSections] = useState({});
  const toggleSectionCollapse = (key) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  // Collapse past/future events independently (default: both collapsed)
  const [collapsedPastEvents, setCollapsedPastEvents] = useState(true);
  const [collapsedFutureEvents, setCollapsedFutureEvents] = useState(true);

  // ── Statuts des événements planning (Google/iCal/RDV) ──
  const [eventStatuses, setEventStatuses] = useState(new Map());

  // ── iCal Calendars ──
  const [icalCalendars, setIcalCalendars] = useState([]);
  const [icalEvents, setIcalEvents] = useState([]);
  const [showIcalManager, setShowIcalManager] = useState(false);
  const [icalForm, setIcalForm] = useState(null); // null = fermé, {} = nouveau, {id,...} = édition
  const [icalLoading, setIcalLoading] = useState(false);

  // Semaine : 7 jours à partir du lundi
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  // Load tasks + display events + affaires
  const initialLoadDone = useRef(false);
  const loadTasks = useCallback(async (silent = false) => {
    if (!silent && !initialLoadDone.current) setLoading(true);
    try {
      let data, events, affairesData;
      if (viewMode === 'week') {
        [data, events, affairesData] = await Promise.all([
          api.getTasks({ dateFrom: weekDays[0], dateTo: weekDays[6] }),
          api.getDisplayEvents({ dateFrom: weekDays[0], dateTo: weekDays[6] }),
          api.getPlanningAffaires({ dateFrom: weekDays[0], dateTo: weekDays[6] }),
        ]);
      } else {
        [data, events, affairesData] = await Promise.all([
          api.getTasks({ date: selectedDate }),
          api.getDisplayEvents({ date: selectedDate }),
          api.getPlanningAffaires({ date: selectedDate }),
        ]);
      }
      setTasks(data);
      setDisplayEvents(Array.isArray(events) ? events : []);
      setAffaires(Array.isArray(affairesData) ? affairesData : []);
      // Charger statuts + multi-affectations en parallèle
      try {
        const [statuses, assignments] = await Promise.all([
          api.getPlanningEventStatuses().catch(() => []),
          api.getPlanningAssignments().catch(() => []),
        ]);
        const map = new Map();
        (Array.isArray(statuses) ? statuses : []).forEach(s => map.set(`${s.eventType}:${s.eventId}`, s.status));
        setEventStatuses(map);
        setPlanningAssignments(Array.isArray(assignments) ? assignments : []);
      } catch { /* ignore */ }
      initialLoadDone.current = true;
    } catch (err) {
      toast.error('Erreur chargement tâches');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, viewMode, weekDays, toast]);

  // Load persons for assignment (permanents uniquement)
  const loadPersons = useCallback(async () => {
    try {
      const data = await api.getPersons();
      // Filtrer pour ne garder que les permanents actifs
      const permanents = (Array.isArray(data) ? data : []).filter(
        p => p.type === 'permanent' && p.status !== STATUS.INACTIVE
      );
      setPersons(permanents);
    } catch {
      setPersons([]);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks, refreshKey]);
  useEffect(() => { loadPersons(); }, [loadPersons]);

  // Charger toutes les affaires pour l'autocomplete inline
  useEffect(() => {
    api.getAffaires().then(data => setAllAffaires(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  // Fermer dropdown affaire inline sur clic extérieur
  useEffect(() => {
    const handleClick = (e) => {
      if (affaireInlineRef.current && !affaireInlineRef.current.contains(e.target)) {
        setAffaireInlineOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Filtrer les affaires pour l'autocomplete inline
  const _filteredInlineAffaires = useMemo(() => {
    if (!affaireInlineSearch.trim()) return allAffaires.slice(0, 30);
    const q = affaireInlineSearch.toLowerCase();
    return allAffaires.filter(a =>
      (a.numeroAffaire || '').toLowerCase().includes(q) ||
      (a.client || '').toLowerCase().includes(q) ||
      (a.titre || a.nom || '').toLowerCase().includes(q)
    ).slice(0, 30);
  }, [allAffaires, affaireInlineSearch]);

  const _selectedInlineAffaire = useMemo(() => {
    if (!newTaskAffaire) return null;
    return allAffaires.find(a => a.numeroAffaire === newTaskAffaire) || null;
  }, [allAffaires, newTaskAffaire]);

  // ── Véhicules & réservations (pour picker dans formulaire) ──
  const loadVehiclesAndReservations = useCallback(async () => {
    try {
      const [vehs, rezs] = await Promise.all([api.getVehicles(), api.getReservations()]);
      setVehicles(vehs || []);
      setReservations(rezs || []);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadVehiclesAndReservations(); }, [loadVehiclesAndReservations]);

  // ── iCal : chargement des calendriers configurés ──
  const loadIcalCalendars = useCallback(async () => {
    try {
      const res = await api.getIcalCalendars();
      setIcalCalendars(res.calendars || []);
    } catch { setIcalCalendars([]); }
  }, []);

  // ── iCal : chargement des événements (fenêtre glissante couvrant selectedDate ± 2 semaines) ──
  const loadIcalEvents = useCallback(async () => {
    setIcalLoading(true);
    try {
      const from = addDays(selectedDate, -14);
      const to = addDays(selectedDate, 14);
      const res = await api.getIcalEvents({ dateFrom: from, dateTo: to });
      const events = (res.events || []).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
      setIcalEvents(events);
      if (res.syncErrors?.length) {
        res.syncErrors.forEach(e => toast.warning(`iCal: ${e}`));
      }
    } catch { setIcalEvents([]); }
    finally { setIcalLoading(false); }
  }, [selectedDate]);

  useEffect(() => { loadIcalCalendars(); }, [loadIcalCalendars]);
  useEffect(() => { loadIcalEvents(); }, [loadIcalEvents, icalCalendars]);

  // ── Chargement des tâches récurrentes ──
  const loadRecurringTasks = useCallback(async () => {
    try {
      const res = await api.getRecurringTasks();
      setRecurringTasks(res.recurringTasks || []);
    } catch { setRecurringTasks([]); }
  }, []);
  useEffect(() => { if (showRecurring) loadRecurringTasks(); }, [showRecurring, loadRecurringTasks]);

  // ── Draggable week-view split ──
  const handleWkSplitMouseDown = useCallback((e) => {
    e.preventDefault();
    wkSplitDragging.current = true;
    wkSplitContentRef.current = e.target.closest('.wk-day-content');
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMove = (e) => {
      if (!wkSplitDragging.current || !wkSplitContentRef.current) return;
      const rect = wkSplitContentRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const pct = Math.max(10, Math.min(90, (y / rect.height) * 100));
      setWkSplitRatio(Math.round(pct));
    };
    const handleUp = () => {
      if (wkSplitDragging.current) {
        wkSplitDragging.current = false;
        wkSplitContentRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, []);

  const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  const handleSaveRecurring = async () => {
    if (!recurringForm) return;
    if (!recurringForm.title?.trim()) { toast.warning('Titre requis'); return; }
    // Préparer le payload avec les clés snake_case attendues par le serveur
    const payload = {
      ...recurringForm,
      day_of_week: recurringForm.dayOfWeek,
      day_of_month: recurringForm.dayOfMonth,
    };
    try {
      if (recurringForm.id) {
        await api.updateRecurringTask(recurringForm.id, payload);
      } else {
        await api.createRecurringTask(payload);
      }
      toast.success(recurringForm.id ? 'Tâche récurrente modifiée' : 'Tâche récurrente créée');
      setRecurringForm(null);
      loadRecurringTasks();
    } catch { toast.error('Erreur sauvegarde'); }
  };

  const handleDeleteRecurring = async (id) => {
    confirm({
      title: 'Supprimer la tâche récurrente',
      message: 'Supprimer cette tâche récurrente ?',
      onConfirm: async () => {
        try { await api.deleteRecurringTask(id); toast.success('Supprimée'); loadRecurringTasks(); }
        catch { toast.error('Erreur suppression'); }
      },
    });
  };

  // ── iCal Calendars CRUD ──
  const handleSaveIcal = async () => {
    if (!icalForm) return;
    if (!icalForm.name?.trim() || !icalForm.url?.trim()) { toast.warning('Nom et URL requis'); return; }
    try {
      if (icalForm.id) {
        await api.updateIcalCalendar(icalForm.id, icalForm);
      } else {
        await api.createIcalCalendar(icalForm);
      }
      toast.success(icalForm.id ? 'Calendrier modifié' : 'Calendrier ajouté');
      setIcalForm(null);
      await loadIcalCalendars();
      loadIcalEvents();
    } catch { toast.error('Erreur sauvegarde'); }
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
        } catch { toast.error('Erreur suppression'); }
      },
    });
  };

  const handleGenerateRecurring = async () => {
    try {
      const res = await api.generateRecurringTasks(selectedDate);
      toast.success(`${res.generated || 0} tâche(s) récurrente(s) générée(s)`);
      loadTasks(true);
    } catch { toast.error('Erreur génération'); }
  };

  const handleRollover = async () => {
    confirm({
      title: 'Reporter les tâches',
      message: `Reporter les tâches non terminées du ${formatDateFr(selectedDate)} au lendemain ?`,
      onConfirm: async () => {
        try {
          const res = await api.rolloverTasks(selectedDate);
          toast.success(`${res.rolled || 0} tâche(s) reportée(s)`);
          loadTasks(true);
        } catch { toast.error('Erreur report'); }
      },
    });
  };

  const handleClearCompleted = async () => {
    if (!window.confirm(`Supprimer toutes les tâches terminées du ${formatDateFr(selectedDate)} du planning et du dashboard ?`)) return;
    try {
      const res = await api.clearCompletedTasks(selectedDate);
      toast.success(`${res.cleared || 0} tâche(s) terminée(s) effacée(s)`);
      loadTasks(true);
    } catch { toast.error('Erreur suppression'); }
  };

  // Normaliser les anciennes sections transport → courses
  const SECTION_ALIASES = { enlevement: 'courses', retour: 'courses', recuperation: 'courses' };
  const normalizeSection = (sec) => SECTION_ALIASES[sec] || sec;

  // Grouper par section
  const grouped = useMemo(() => {
    const groups = {};
    Object.keys(SECTIONS).forEach(key => { groups[key] = []; });
    tasks.forEach(t => {
      const sec = normalizeSection(t.section || 'manual');
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(t);
    });
    return groups;
  }, [tasks]);

  // Événements d'affichage non liés à des tâches existantes
  const linkedEventIds = useMemo(() =>
    new Set(tasks.filter(t => t.displayEventId).map(t => t.displayEventId)),
    [tasks]
  );

  const unlinkedEvents = useMemo(() =>
    displayEvents.filter(ev => !linkedEventIds.has(ev.id)),
    [displayEvents, linkedEventIds]
  );

  const _eventsBySection = useMemo(() => {
    const groups = {};
    Object.keys(SECTIONS).forEach(k => { groups[k] = []; });
    unlinkedEvents.forEach(ev => {
      const sec = mapEventToSection(ev);
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(ev);
    });
    return groups;
  }, [unlinkedEvents]);

  // Tous les événements Google Calendar pour la semaine en cours
  const weekGoogleEvents = useMemo(() => {
    if (!googleEvents || googleEvents.length === 0) return [];
    return googleEvents.filter(ev => {
      const evDate = ev.start?.dateTime || ev.start?.date || '';
      const evDateStr = evDate.slice(0, 10);
      return weekDays.includes(evDateStr);
    });
  }, [googleEvents, weekDays]);

  // Événements Google pour le jour sélectionné
  const dayGoogleEvents = useMemo(() => {
    if (!googleEvents || googleEvents.length === 0) return [];
    return googleEvents.filter(ev => {
      const evDate = ev.start?.dateTime || ev.start?.date || '';
      return evDate.slice(0, 10) === selectedDate;
    });
  }, [googleEvents, selectedDate]);

  // IDs Google/iCal event qui ont déjà des tâches créées
  const processedGoogleIds = useMemo(() =>
    new Set(tasks.filter(t => (t.sourceType === 'google_event' || t.sourceType === 'ical_event') && t.sourceId).map(t => t.sourceId)),
    [tasks]
  );

  // Index des tâches par sourceId pour afficher les tâches liées à chaque événement
  const tasksBySourceId = useMemo(() => {
    const map = new Map();
    tasks.forEach(t => {
      if ((t.sourceType === 'google_event' || t.sourceType === 'ical_event') && t.sourceId) {
        if (!map.has(t.sourceId)) map.set(t.sourceId, []);
        map.get(t.sourceId).push(t);
      }
    });
    return map;
  }, [tasks]);

  // ── Index des affaires par numéro pour enrichir les tâches liées ──
  const affaireByNum = useMemo(() => {
    const map = new Map();
    affaires.forEach(a => {
      if (a.numeroAffaire) map.set(a.numeroAffaire.toUpperCase(), a);
    });
    return map;
  }, [affaires]);

  // ── Lier les événements Google aux affaires par numéro d'affaire ──
  // Évite les doublons : un event Google portant un AF existant est masqué,
  // et l'affaire récupère les horaires Google associés.
  const { enrichedAffaires, filteredDayGoogleEvents, filteredWeekGoogleEvents, unlinkedAffaireEvents } = useMemo(() => {
    const affaireNumMap = new Map();
    affaires.forEach(a => {
      if (a.numeroAffaire) affaireNumMap.set(a.numeroAffaire.toUpperCase(), a);
    });

    const linkedByAffaire = new Map(); // affaireNum → googleEvent
    const unlinked = []; // Events Google avec AF non trouvé en base

    const filterLinked = (events) => {
      return events.filter(ev => {
        const match = (ev.summary || '').match(/\bAF\s*\d{4,}/i);
        if (match) {
          const num = match[0].toUpperCase().replace(/\s+/g, '');
          if (affaireNumMap.has(num)) {
            // Garder le premier événement lié (ou celui avec l'heure la plus tôt)
            if (!linkedByAffaire.has(num)) {
              linkedByAffaire.set(num, ev);
            }
            return false; // Filtrer cet événement Google (l'affaire prend le relais)
          } else {
            // AF détecté mais pas en base → à créer
            unlinked.push(ev);
          }
        }
        return true;
      });
    };

    const fDay = filterLinked(dayGoogleEvents);
    const fWeek = filterLinked(weekGoogleEvents);

    // Enrichir les affaires avec les données de l'événement Google lié
    // Exclure les affaires masquées de l'affichage section (elles restent dans affaireByNum)
    const enriched = affaires
      .filter(a => !a.planningHidden)
      .map(a => {
      const num = (a.numeroAffaire || '').toUpperCase();
      const gev = linkedByAffaire.get(num);
      if (gev) {
        const startDT = gev.start?.dateTime || '';
        const endDT = gev.end?.dateTime || '';
        return {
          ...a,
          _linkedGoogleEvent: gev,
          _googleTime: startDT.includes('T') ? new Date(startDT).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
          _googleEndTime: endDT.includes('T') ? new Date(endDT).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
          _googleLocation: gev.location || '',
          _googleId: gev.id,
        };
      }
      return a;
    });

    return { enrichedAffaires: enriched, filteredDayGoogleEvents: fDay, filteredWeekGoogleEvents: fWeek, unlinkedAffaireEvents: unlinked };
  }, [affaires, dayGoogleEvents, weekGoogleEvents]);

  // ── Auto-création des affaires pour les events Google avec AF non trouvé en base ──
  const syncedAFRef = useRef(new Set());
  useEffect(() => {
    if (!unlinkedAffaireEvents || unlinkedAffaireEvents.length === 0) return;
    // Ne syncer que les events pas encore traités
    const toSync = unlinkedAffaireEvents.filter(ev => {
      const m = (ev.summary || '').match(/\bAF\s*\d{4,}/i);
      if (!m) return false;
      const num = m[0].toUpperCase().replace(/\s+/g, '');
      if (syncedAFRef.current.has(num)) return false;
      syncedAFRef.current.add(num);
      return true;
    });
    if (toSync.length === 0) return;
    (async () => {
      try {
        await api.syncGoogleEventsToAffaires(toSync);
        await loadTasks(true); // Refresh silencieux
      } catch (err) {
        console.error('[TaskPlanning] Auto-sync affaires failed:', err);
      }
    })();
  }, [unlinkedAffaireEvents, loadTasks]);

  // ── Liaison manuelle event → affaire ──
  const [linkingEvent, setLinkingEvent] = useState(null); // Google event en cours de liaison
  const [linkSearchQuery, setLinkSearchQuery] = useState('');

  // ── Liaison manuelle tâche → affaire ──
  const [linkingTaskId, setLinkingTaskId] = useState(null);
  const [linkTaskSearchQuery, setLinkTaskSearchQuery] = useState('');

  const handleLinkTaskToAffaire = async (taskId, affaireNum) => {
    try {
      await api.updateTask(taskId, { affaire_num: affaireNum });
      setLinkingTaskId(null);
      setLinkTaskSearchQuery('');
      await loadTasks(true);
      toast.success(`Tâche liée à ${affaireNum}`);
    } catch (err) {
      toast.error('Erreur lors de la liaison');
    }
  };

  const handleManualLink = async (event, affaireNum) => {
    try {
      // Créer/mettre à jour l'affaire avec cet event
      const summary = event.summary || '';
      await api.syncGoogleEventsToAffaires([{
        ...event,
        summary: summary.includes(affaireNum) ? summary : `${affaireNum} ${summary}`,
      }]);
      syncedAFRef.current.add(affaireNum.toUpperCase());
      setLinkingEvent(null);
      setLinkSearchQuery('');
      await loadTasks(true);
      toast.success(`Événement lié à ${affaireNum}`);
    } catch (err) {
      toast.error('Erreur lors de la liaison');
    }
  };

  // Ouvrir EventTaskModal à partir d'une affaire (pseudo événement, ou Google event lié)
  const openAffaireTaskModal = (affaire) => {
    // Si l'affaire est liée à un événement Google, utiliser celui-ci directement
    if (affaire._linkedGoogleEvent) {
      setEventTaskModalEvent(affaire._linkedGoogleEvent);
      return;
    }
    const pseudoEvent = {
      id: `affaire-${affaire.id || affaire.numeroAffaire}`,
      summary: `${affaire.type || ''} ${affaire.numeroAffaire}${affaire.client ? ' — ' + affaire.client : ''}`,
      start: { date: affaire.dateDebut || affaire.date_debut || '' },
      end: { date: affaire.dateFin || affaire.date_fin || '' },
      location: affaire.adresseLivraison || '',
      description: affaire.titre || affaire.description || '',
    };
    setEventTaskModalEvent(pseudoEvent);
  };

  // googleRdvEvents = événements Google NON liés à une affaire existante
  const allGoogleEvents = useMemo(() => {
    return viewMode === 'week' ? filteredWeekGoogleEvents : filteredDayGoogleEvents;
  }, [viewMode, filteredWeekGoogleEvents, filteredDayGoogleEvents]);

  // Séparer RDV (titre contient "rdv") des autres événements Google
  const googleRdvEvents = useMemo(() =>
    allGoogleEvents.filter(ev => /rdv/i.test(ev.summary || '')),
  [allGoogleEvents]);

  const googleOtherEvents = useMemo(() =>
    allGoogleEvents.filter(ev => !/rdv/i.test(ev.summary || '')),
  [allGoogleEvents]);

  // Fusionner Google (non-RDV) + iCal en une seule liste triée chronologiquement
  // Filtrer les iCal par la date/semaine sélectionnée pour ne montrer que les événements pertinents
  const mergedOtherEvents = useMemo(() => {
    const googleNorm = googleOtherEvents.map(ev => ({
      ...ev,
      _source: 'google',
      _sortKey: ev.start?.dateTime || ev.start?.date || '',
    }));
    const dateSet = viewMode === 'week' ? new Set(weekDays) : new Set([selectedDate]);
    const filteredIcal = icalEvents.filter(ev => {
      const evDate = (ev.start || '').slice(0, 10);
      return dateSet.has(evDate);
    });
    const icalNorm = filteredIcal.map(ev => ({
      ...ev,
      _source: 'ical',
      _sortKey: ev.start || '',
    }));
    return [...googleNorm, ...icalNorm].sort((a, b) => a._sortKey.localeCompare(b._sortKey));
  }, [googleOtherEvents, icalEvents, viewMode, selectedDate, weekDays]);

  // ── Groupement par jour pour la vue semaine ──
  const weekGroupedByDay = useMemo(() => {
    if (viewMode !== 'week') return null;
    const map = {};
    weekDays.forEach(d => {
      map[d] = { tasks: [], events: [], affaires: [], googleEvents: [] };
    });
    // Tâches
    tasks.forEach(t => {
      if (map[t.date]) map[t.date].tasks.push(t);
    });
    // Événements d'affichage non liés
    unlinkedEvents.forEach(ev => {
      if (map[ev.date]) map[ev.date].events.push(ev);
    });
    // Affaires : actives sur chaque jour de la semaine
    enrichedAffaires.forEach(a => {
      const debut = a.dateDebut || a.date_debut || '';
      const fin = a.dateFin || a.date_fin || '';
      weekDays.forEach(d => {
        if (debut && debut <= d && (!fin || fin === '' || fin >= d)) {
          if (map[d]) map[d].affaires.push(a);
        }
      });
    });
    // Google events (uniquement ceux non liés à une affaire)
    filteredWeekGoogleEvents.forEach(ev => {
      const evDate = (ev.start?.dateTime || ev.start?.date || '').slice(0, 10);
      if (map[evDate]) map[evDate].googleEvents.push(ev);
    });
    // iCal events groupés par jour
    icalEvents.forEach(ev => {
      const evDate = (ev.start || '').slice(0, 10);
      if (map[evDate]) map[evDate].googleEvents.push({ ...ev, _source: 'ical' });
    });
    return map;
  }, [viewMode, weekDays, tasks, unlinkedEvents, enrichedAffaires, filteredWeekGoogleEvents, icalEvents]);

  // Index des display events par affaire_id (pour affectation personnel sur les lignes affaire)
  const _displayEventByAffaire = useMemo(() => {
    const map = new Map();
    displayEvents.forEach(ev => {
      if (ev.affaireId) {
        // Garder le premier (ou le plus récent) display event pour chaque affaire
        if (!map.has(ev.affaireId)) map.set(ev.affaireId, ev);
      }
    });
    return map;
  }, [displayEvents]);

  // Map multi-affectations : "entityType:entityId" → [{id, personId, firstName, lastName}]
  const assignmentsByEntity = useMemo(() => {
    const map = new Map();
    (planningAssignments || []).forEach(a => {
      const key = `${a.entityType}:${a.entityId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return map;
  }, [planningAssignments]);

  // Affaires groupées par section de préparation
  const affairesBySection = useMemo(() => {
    const groups = {};
    Object.keys(SECTIONS).forEach(k => { groups[k] = []; });
    enrichedAffaires.forEach(a => {
      const sec = mapAffaireToSection(a);
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(a);
      // Seules les affaires dont le titre contient "rdv" vont dans la section RDV
      if (a.titre && /rdv/i.test(a.titre)) {
        if (!groups.rdv) groups.rdv = [];
        groups.rdv.push(a);
      }
    });
    return groups;
  }, [enrichedAffaires]);

  // Toggle multi-affectation (ajouter ou retirer une personne)
  const handleToggleAssignment = async (entityType, entityId, personId) => {
    try {
      const key = `${entityType}:${entityId}`;
      const existing = assignmentsByEntity.get(key) || [];
      const found = existing.find(a => a.personId === personId);
      if (found) {
        await api.removePlanningAssignment(found.id);
      } else {
        await api.addPlanningAssignment(entityType, entityId, personId);
      }
      // Recharger les affectations
      const updated = await api.getPlanningAssignments();
      setPlanningAssignments(Array.isArray(updated) ? updated : []);
    } catch (err) {
      toast.error('Erreur affectation');
    }
  };

  // Composant d'affectation multi-personnel partagé par les 3 renderers
  const renderMultiAssign = (entityType, entityId) => {
    const key = `${entityType}:${entityId}`;
    const assignments = assignmentsByEntity.get(key) || [];
    const isOpen = assigningEntity === key;

    return (
      <div className="event-assign-container">
        <div className="multi-assign-chips">
          {assignments.map(a => (
            <span key={a.id} className="task-person assigned" role="button" tabIndex={0} onClick={() => setAssigningEntity(isOpen ? null : key)}>
              <User size={11} />
              {a.firstName} {a.lastName?.charAt(0)}.
            </span>
          ))}
          <Tooltip content="Affecter du personnel">
            <Button variant="primary" size="sm" iconOnly className="btn-assign" onClick={() => setAssigningEntity(isOpen ? null : key)} aria-label="Affecter">
              <UserPlus size={13} />
            </Button>
          </Tooltip>
        </div>
        {isOpen && (
          <div className="assign-dropdown">
            <div className="assign-dropdown-title">Multi-affectation :</div>
            {persons.map(p => {
              const isAssigned = assignments.some(a => a.personId === p.id);
              return (
                <div key={p.id} className={`assign-option ${isAssigned ? 'selected' : ''}`} role="button" tabIndex={0} onClick={() => handleToggleAssignment(entityType, entityId, p.id)}>
                  <span className={`assign-check ${isAssigned ? 'on' : ''}`}>{isAssigned ? <Check size={12} /> : null}</span>
                  {p.firstName || p.prenom} {p.lastName || p.nom}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Toggle task status
  const cycleStatus = async (task) => {
    const nextStatus = {
      pending: 'in_progress',
      in_progress: 'done',
      done: 'pending',
      cancelled: 'pending',
    };
    const newStatus = nextStatus[task.status] || 'pending';
    try {
      await api.updateTask(task.id, { status: newStatus });
      loadTasks(true);
    } catch (err) {
      toast.error('Erreur mise à jour');
    }
  };

  // Delete task
  const handleDelete = (id) => {
    confirm({
      title: 'Supprimer la tâche',
      message: 'Voulez-vous supprimer cette tâche ?',
      onConfirm: async () => {
        try {
          await api.deleteTask(id);
          toast.success('Tâche supprimée');
          loadTasks(true);
        } catch (err) {
          toast.error('Erreur suppression');
        }
      },
    });
  };

  // Retirer un événement d'affichage de la planification
  const handleDeleteDisplayEvent = (id) => {
    confirm({
      title: 'Retirer de la planification',
      message: 'Supprimer cet événement d\'affichage ?',
      onConfirm: async () => {
        try {
          await api.deleteDisplayEvent(id);
          toast.success('Événement retiré');
          loadTasks(true);
        } catch (err) {
          toast.error('Erreur suppression');
        }
      },
    });
  };

  // Add task inline
  const _handleAddTask = async (section) => {
    if (!newTaskTitle.trim()) {
      toast.warning('Titre requis');
      return;
    }
    try {
      // Déterminer la section effective (pour courses, le type peut override)
      let effectiveSection = section;
      if (section === 'courses' && newTaskType) {
        // Les types de course ont des alias sections: enlevement, retour, recuperation → courses
        // On stocke le type dans le titre préfixé pour le badge
        effectiveSection = 'courses';
      }

      // Trouver l'affaire sélectionnée pour pré-remplir google_event_title/affaire_num
      const selectedAffaire = newTaskAffaire ? affaires.find(a => a.numeroAffaire === newTaskAffaire) : null;

      // Trouver l'événement Google sélectionné
      const allGoogleEvts = [...(dayGoogleEvents || []), ...(icalEvents || [])];
      const selectedGoogEvent = newTaskGoogleEvent ? allGoogleEvts.find(e => e.id === newTaskGoogleEvent) : null;

      // Construire le titre final
      let finalTitle = newTaskTitle.trim();
      // Auto-capitaliser la première lettre
      if (finalTitle) finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
      if (section === 'courses' && newTaskType) {
        const typeInfo = EVENT_TYPES[newTaskType];
        if (typeInfo) {
          finalTitle = `${typeInfo.emoji} ${typeInfo.label} — ${finalTitle}`;
        }
      }

      // Gérer la réservation véhicule (sections nécessitant un véhicule)
      let reservationId = null;
      if (newTaskReservation && newTaskReservation !== '__new__') {
        reservationId = newTaskReservation;
      } else if (newTaskReservation === '__new__' && newTaskVehicle) {
        // Créer une nouvelle réservation inline
        try {
          const newRez = await api.createReservation({
            id: `${Date.now()}.${Math.random()}`,
            vehicle_id: newTaskVehicle,
            start_date: selectedDate,
            start_period: newTaskPeriod || 'AM',
            end_date: selectedDate,
            end_period: newTaskPeriod || 'PM',
            client_name: newTaskClient || (selectedAffaire?.client) || '',
            driver_name: newTaskPerson ? persons.find(p => String(p.id) === String(newTaskPerson))?.firstName || '' : '',
            prestation_name: finalTitle,
            affaire: newTaskAffaire || '',
            notes: '',
          });
          reservationId = newRez.id;
          loadVehiclesAndReservations(); // refresh
        } catch (err) {
          toast.error('Erreur création réservation véhicule');
          return;
        }
      }

      await api.createTask({
        date: selectedDate,
        period: newTaskPeriod || 'AM',
        time: newTaskTime || null,
        section: effectiveSection,
        title: finalTitle,
        person_id: newTaskPerson || null,
        status: STATUS.PENDING,
        source_type: selectedGoogEvent ? (selectedGoogEvent._source === 'ical' ? 'ical_event' : 'google_event') : selectedAffaire ? 'affaire' : 'manual',
        source_id: selectedGoogEvent?.id || null,
        google_event_title: selectedGoogEvent?.summary || selectedGoogEvent?.title || null,
        affaire_num: newTaskAffaire || null,
        reservation_id: reservationId,
      });
      toast.success('Tâche ajoutée');
      setNewTaskTitle('');
      setNewTaskPerson('');
      setNewTaskAffaire('');
      setAffaireInlineSearch('');
      setAffaireInlineOpen(false);
      setNewTaskType('');
      setNewTaskClient('');
      setNewTaskTime('');
      setNewTaskPeriod('AM');
      setNewTaskGoogleEvent('');
      setNewTaskReservation('');
      setNewTaskVehicle('');
      setAddingSection(null);
      loadTasks(true);
    } catch (err) {
      toast.error('Erreur création tâche');
    }
  };

  // Export PDF — ouvrir la modale d'export
  const handleExportPdf = () => {
    setShowPdfExport(true);
  };

  // Extraire un numéro d'affaire (AF suivi de chiffres) depuis un texte
  const extractAffaireNum = (text) => {
    if (!text) return null;
    const match = text.match(/\bAF\s*\d{3,}/i);
    return match ? match[0].toUpperCase().replace(/\s+/g, '') : null;
  };

  const renderTaskRow = (task) => {
    const isDone = task.status === STATUS.DONE;
    const isProgress = task.status === 'in_progress';
    const isGoogle = task.sourceType === 'google_event';
    const isHidden = task.visible === 0;
    const affaireNum = task.affaireNum || extractAffaireNum(task.title) || extractAffaireNum(task.googleEventTitle);
    const taskSection = normalizeSection(task.section || 'manual');
    const sectionInfo = SECTIONS[taskSection];

    // --- Nettoyage du titre pour éviter les doublons ---
    let displayTitle = task.title;
    // 1. Retirer le suffixe " — eventSummary" (tâches Google: "emoji Label — Summary")
    if (task.googleEventTitle) {
      const dashIdx = displayTitle.indexOf(' — ');
      if (dashIdx >= 0) {
        const suffix = displayTitle.slice(dashIdx + 3).trim();
        if (suffix.toLowerCase() === task.googleEventTitle.trim().toLowerCase()) {
          displayTitle = displayTitle.slice(0, dashIdx).trim();
        }
      }
    }
    // 2. Retirer le label de section du titre (redondant : "📦 Chargement" dans la section Chargement, etc.)
    if (sectionInfo?.affaireOnly) {
      displayTitle = displayTitle
        .replace(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]+\s*/u, '') // retirer emoji
        .replace(/^(Préparation|Chargement|Départ|Enlèvement|Retour|Récupération|Installation)\s*—?\s*/i, '')
        .trim();
      // Si le titre est vide après nettoyage, utiliser le googleEventTitle ou le client comme titre principal
      if (!displayTitle) {
        displayTitle = task.googleEventTitle || task.notes || '';
      }
    }

    // 2b. Section Courses : extraire le type (Livraison, Récupération, etc.)
    //     Sources : 1) section originale (enlevement, retour, recuperation)
    //               2) eventType du display_event lié (livraison, enlevement, etc.)
    //               3) préfixe dans le titre (fallback legacy)
    let courseType = null;
    if (taskSection === 'courses') {
      const SECTION_COURSE_TYPE = { enlevement: 'enlevement', retour: 'retour', recuperation: 'recuperation' };
      const EVENT_COURSE_TYPE = { livraison: 'livraison', enlevement: 'enlevement', retour: 'retour', recuperation: 'recuperation' };
      if (SECTION_COURSE_TYPE[task.section]) {
        courseType = SECTION_COURSE_TYPE[task.section];
      } else if (task.eventType && EVENT_COURSE_TYPE[task.eventType]) {
        courseType = EVENT_COURSE_TYPE[task.eventType];
      } else {
        // Fallback : chercher dans le titre
        const courseMatch = displayTitle.match(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]*\s*(Livraison|Récupération|Recuperation|Enlèvement|Enlevement|Retour)\b/iu);
        if (courseMatch) {
          const rawType = courseMatch[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const TYPE_MAP = { livraison: 'livraison', recuperation: 'recuperation', enlevement: 'enlevement', retour: 'retour' };
          courseType = TYPE_MAP[rawType] || null;
        }
      }
      // Retirer le type + emoji du titre pour éviter la redondance avec le badge
      if (courseType) {
        displayTitle = displayTitle
          .replace(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]+\s*/u, '')
          .replace(/^(Livraison|Récupération|Recuperation|Enlèvement|Enlevement|Retour)\s*—?\s*/i, '')
          .trim();
        if (!displayTitle) {
          displayTitle = task.googleEventTitle || task.notes || '';
        }
      }
    }
    // 3. Retirer le N° d'affaire du titre (déjà affiché en badge)
    //    Utiliser un pattern regex souple pour matcher "AF30875", "AF 30875", "af30 875", etc.
    const stripAffaireNum = (text) => {
      if (!text || !affaireNum) return text;
      // Construire un pattern à partir des chiffres du numéro (ex: AF30875 → AF\s*3\s*0\s*8\s*7\s*5)
      const digits = affaireNum.replace(/^AF/i, '');
      const flexDigits = digits.split('').join('\\s*');
      const pattern = new RegExp('\\bAF\\s*' + flexDigits + '\\b', 'gi');
      return text.replace(pattern, '').replace(/\s*[—–-]\s*(?=[—–-]|$)/g, '').replace(/\s{2,}/g, ' ').trim();
    };
    displayTitle = stripAffaireNum(displayTitle);

    // 4. Enrichir avec le client/titre de l'affaire si le titre est trop générique
    const linkedAffaire = affaireNum ? affaireByNum.get(affaireNum.toUpperCase()) : null;
    const isGenericTitle = !displayTitle || /^(Location|Prestation|Vente|Installation|Livraison)\s*$/i.test(displayTitle);
    if (isGenericTitle && linkedAffaire) {
      // Titre générique → utiliser le titre/objet de l'affaire (le client est déjà dans sa colonne dédiée)
      const titre = linkedAffaire.titre || linkedAffaire.eventName || '';
      displayTitle = titre || displayTitle || '-';
    }
    // NB : le client n'est plus ajouté au titre — il a sa propre colonne (ev-col-client)

    // --- Nettoyage du sous-titre (googleEventTitle) ---
    let cleanEventTitle = stripAffaireNum(task.googleEventTitle || '');
    // Si le titre affiche le client de l'affaire, montrer le titre/objet de l'affaire en sous-titre
    if (isGenericTitle && linkedAffaire) {
      const affaireTitre = linkedAffaire.titre || linkedAffaire.eventName || '';
      if (affaireTitre && affaireTitre.toLowerCase() !== displayTitle.toLowerCase()) {
        cleanEventTitle = affaireTitre;
      }
    }
    // Montrer le sous-titre uniquement s'il apporte une info différente du titre
    // — vérifier aussi que le titre ne contient pas déjà le sous-titre (évite "NOM — CLIENT — NOM")
    const cleanEventNorm = cleanEventTitle.toLowerCase().replace(/\s+/g, '');
    const displayTitleNorm = displayTitle.toLowerCase().replace(/\s+/g, '');
    const showSubtitle = cleanEventTitle &&
      cleanEventNorm !== displayTitleNorm &&
      !displayTitleNorm.includes(cleanEventNorm);

    // Masquer l'eventType quand il est redondant avec le nom de la section
    const SECTION_EVENT_TYPES = {
      prep_locations: 'preparation', prep_prestations: 'preparation', prep_ventes: 'preparation', prep_installations: 'preparation',
      chargement: 'chargement', depart: 'depart', courses: 'courses',
      installation: 'installation',
      montage: 'montage', demontage: 'demontage',
    };
    const showEventType = task.eventType && SECTION_EVENT_TYPES[taskSection] !== task.eventType;

    // Combiner titre + sous-titre en un seul texte compact
    const fullTitle = showSubtitle ? `${displayTitle} — ${cleanEventTitle}` : displayTitle;
    // Nom et Client de l'affaire liée
    const affaireNom = stripAffaireNum(linkedAffaire?.nom || '');
    const affaireClient = linkedAffaire?.client || '';
    // Priorité : titre édité par l'utilisateur > nom de l'affaire
    const rawNom = fullTitle || affaireNom || '-';
    const displayNom = rawNom.charAt(0).toUpperCase() + rawNom.slice(1);
    const displayClient = affaireClient;

    return (
      <div key={task.id} className={`task-row event-row-cols ${isGoogle ? 'google-task-row' : ''} ${isDone ? 'task-done-row' : ''} ${isHidden ? 'hidden-display' : ''}`}>
        <Button variant="ghost"           className={`ev-col task-status-btn ${isDone ? 'done' : isProgress ? 'in-progress' : ''}`}
          onClick={() => cycleStatus(task)}
          title={`Statut: ${task.status} — cliquer pour changer`}
        >
          {isDone && <Check size={14} />}
          {isProgress && <Clock size={12} />}
        </Button>

        <span className="ev-col ev-col-affaire">
          {affaireNum ? <AffaireBadge numero={affaireNum} type={linkedAffaire?.type} size="sm" onNavigate={onNavigateToEntity ? (num) => onNavigateToEntity('affaire', { numero: num }) : undefined} /> : null}
        </span>

        <span className={`ev-col ev-col-nom ${isDone ? 'done' : ''}`} title={[fullTitle, showEventType && task.eventType, (task.locationAddress || task.eventLocation || linkedAffaire?.location) && '📍 ' + (task.locationAddress || task.eventLocation || linkedAffaire?.location), task.notes && '📝 ' + task.notes, (task.personFirstName || task.personLastName) && '👤 ' + [task.personFirstName, task.personLastName].filter(Boolean).join(' ')].filter(Boolean).join('\n')}>
          {isGoogle && <span className="google-mini-badge" title="Google Calendar">G</span>}
          {courseType && (() => { const ct = EVENT_TYPES[courseType]; return ct ? <span className="course-type-badge" style={{ background: `${ct.color}18`, color: ct.color, borderColor: `${ct.color}40` }}>{ct.emoji} {ct.label}</span> : null; })()}
          {task.reservation_vehicle_name && (
            <span className="vehicle-badge" title={`🚗 ${task.reservation_vehicle_name} ${task.reservation_vehicle_reg || ''}`}>
              <Truck size={11} /> {task.reservation_vehicle_name}
            </span>
          )}
          {task.locationAddress && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.locationAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="task-location-badge"
              title={`📍 ${task.locationAddress}`}
              onClick={e => e.stopPropagation()}
            >
              <MapPin size={11} /> {task.locationAddress.length > 30 ? task.locationAddress.slice(0, 30) + '…' : task.locationAddress}
            </a>
          )}
          {displayNom}
          {task.notes && <span className="task-notes-inline">({task.notes})</span>}
        </span>

        <span className="ev-col ev-col-client" title={displayClient}>{displayClient}</span>
        <span className="ev-col ev-col-spacer" />

        <span className="ev-col ev-col-time">
          {task.time ? <><Clock size={11} /> {task.time}{task.endTime ? ` → ${task.endTime}` : ''}</> : task.period ? <span className="period-badge">{task.period}</span> : ''}
        </span>

        <div className="task-actions">
          {/* Multi-affectation personnel */}
          {renderMultiAssign('task', task.id)}
          {/* Lier à une affaire (seulement si pas déjà liée) */}
          {!affaireNum && (
            <Button variant="ghost"               className={`btn-link-affaire ${linkingTaskId === task.id ? 'active' : ''}`}
              title="Lier à une affaire"
              onClick={(e) => { e.stopPropagation(); setLinkingTaskId(linkingTaskId === task.id ? null : task.id); setLinkTaskSearchQuery(''); }}
            >
              <Link size={13} />
            </Button>
          )}
          <Tooltip content={isHidden ? 'Afficher sur l\'écran' : 'Masquer de l\'écran'}>
            <Button variant="ghost"               className={`toggle-visible ${isHidden ? 'off' : ''}`}
              onClick={() => handleToggleTaskVisible(task)}
            >
              {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
          </Tooltip>
          <Tooltip content="Modifier cette tâche">
            <Button variant="ghost"               className="edit"
              onClick={() => setEditingTask(task)}
            >
              <Edit2 size={14} />
            </Button>
          </Tooltip>
          <Tooltip content="Supprimer">
            <Button variant="ghost" className="delete" onClick={() => handleDelete(task.id)}>
              <Trash2 size={14} />
            </Button>
          </Tooltip>
        </div>
        {/* Popover de liaison manuelle tâche → affaire */}
        {linkingTaskId === task.id && (() => {
          const today = selectedDate || new Date().toISOString().slice(0, 10);
          const q = linkTaskSearchQuery.toUpperCase().trim();
          // Trier : en cours/à venir d'abord, puis par date début décroissante
          const sorted = [...affaires].sort((a, b) => {
            const aDebut = a.dateDebut || a.date_debut || '';
            const aFin = a.dateFin || a.date_fin || '';
            const bDebut = b.dateDebut || b.date_debut || '';
            const bFin = b.dateFin || b.date_fin || '';
            const aActive = aDebut <= today && (!aFin || aFin >= today) ? 0 : aDebut > today ? 1 : 2;
            const bActive = bDebut <= today && (!bFin || bFin >= today) ? 0 : bDebut > today ? 1 : 2;
            if (aActive !== bActive) return aActive - bActive;
            return (bDebut || '').localeCompare(aDebut || '');
          });
          const filtered = q.length >= 1
            ? sorted.filter(a =>
                (a.numeroAffaire || '').toUpperCase().includes(q)
                || (a.client || '').toUpperCase().includes(q)
                || (a.titre || '').toUpperCase().includes(q)
                || (a.eventName || '').toUpperCase().includes(q)
              )
            : sorted;
          const linkableAff = filtered.slice(0, 10);
          return (
            <div className="link-affaire-popover" onClick={(e) => e.stopPropagation()}>
              <div className="link-popover-header">
                <span>🔗 Lier à une affaire</span>
                <Button variant="ghost" className="link-popover-close" onClick={() => { setLinkingTaskId(null); setLinkTaskSearchQuery(''); }}>
                  <X size={14} />
                </Button>
              </div>
              <Input
                type="text"
                className="link-search-input"
                placeholder="Filtrer par AF, client…"
                value={linkTaskSearchQuery}
                onChange={(e) => setLinkTaskSearchQuery(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Escape') { setLinkingTaskId(null); setLinkTaskSearchQuery(''); } }}
              />
              {linkTaskSearchQuery.match(/^\s*AF\s*\d{4,}\s*$/i) && !affaires.some(a => (a.numeroAffaire || '').toUpperCase() === linkTaskSearchQuery.toUpperCase().replace(/\s+/g, '').trim()) && (
                <Button variant="ghost"                   className="link-option link-option-create"
                  onClick={() => {
                    const num = linkTaskSearchQuery.toUpperCase().replace(/\s+/g, '').trim();
                    handleLinkTaskToAffaire(task.id, num);
                  }}
                >
                  ➕ Lier à <strong>{linkTaskSearchQuery.toUpperCase().replace(/\s+/g, '').trim()}</strong>
                </Button>
              )}
              {linkableAff.length > 0 ? (
                <div className="link-options-list">
                  {linkableAff.map(a => (
                    <Button variant="ghost"                       key={a.id || a.numeroAffaire}
                      className="link-option"
                      onClick={() => handleLinkTaskToAffaire(task.id, a.numeroAffaire)}
                    >
                      <AffaireBadge numero={a.numeroAffaire} type={a.type} size="sm" />
                      <span className="link-option-client">{a.client || a.titre || 'Sans client'}</span>
                    </Button>
                  ))}
                  {filtered.length > 10 && <div className="link-no-results" style={{ fontSize: '0.7rem', opacity: 0.6 }}>+{filtered.length - 10} autres…</div>}
                </div>
              ) : (
                <div className="link-no-results">Aucune affaire trouvée</div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  const _renderDisplayEventRow = (event) => {
    const typeInfo = EVENT_TYPES[event.type] || { label: event.type, emoji: '📌', color: 'var(--theme-text-secondary)' };
    const _isPrep = event.type === 'preparation';
    const isHidden = event.visible === 0;

    // Le type est redondant si on est dans une section affaireOnly (le bandeau dit déjà "Préparations X", "Chargement", etc.)
    const section = event._section || mapEventToSection(event);
    const sectionInfo = SECTIONS[section];
    const isTypeRedundant = sectionInfo?.affaireOnly;

    // Extraire un éventuel numéro d'affaire
    const affaireNum = event.affaireId
      ? (event.affaireId.match(/\bAF\s*\d{3,}/i) || [null])[0]?.toUpperCase()?.replace(/\s+/g, '')
      : null;

    // Nom et Client de l'affaire liée (linkedAff depuis affaireByNum OU champs enrichis du serveur)
    const linkedAff = affaireNum ? affaireByNum.get(affaireNum.toUpperCase()) : null;
    const affaireNom = linkedAff?.nom || event.affaireNom || '';
    const affaireClient = linkedAff?.client || event.affaireClient || '';
    const affaireTypeResolved = linkedAff?.type || event.affaireType || '';
    const fallbackName = isTypeRedundant
      ? (event.affaireId || typeInfo.label)
      : `${typeInfo.label}${event.affaireId && !affaireNum ? ' (' + event.affaireId + ')' : ''}`;
    const displayName = affaireNom || fallbackName;

    const isDone = event.status === STATUS.DONE;
    const isProgress = event.status === 'in_progress';

    return (
      <div key={`de-${event.id}`} className={`task-row event-row-cols display-event-row ${isDone ? 'task-done-row' : ''} ${isHidden ? 'hidden-display' : ''}`}>
        <Button variant="ghost"           className={`ev-col task-status-btn ${isDone ? 'done' : isProgress ? 'in-progress' : ''}`}
          onClick={() => handleCycleDisplayEventStatus(event)}
          title={`Statut: ${event.status || 'pending'} — cliquer pour changer`}
        >
          {isDone && <Check size={14} />}
          {isProgress && <Clock size={12} />}
        </Button>

        <span className="ev-col ev-col-affaire">
          {affaireNum ? <AffaireBadge numero={affaireNum} type={affaireTypeResolved} size="sm" onNavigate={onNavigateToEntity ? (num) => onNavigateToEntity('affaire', { numero: num }) : undefined} /> : null}
        </span>

        <span className="ev-col ev-col-nom" title={[displayName, event.location && '📍 ' + event.location, event.comment && '📝 ' + event.comment].filter(Boolean).join('\n')}>
          {displayName}
          {!isTypeRedundant && <span className="course-type-badge" style={{ background: `${typeInfo.color}18`, color: typeInfo.color, borderColor: `${typeInfo.color}40` }}>{typeInfo.emoji} {typeInfo.label}</span>}
        </span>

        <span className="ev-col ev-col-client" title={affaireClient}>{affaireClient}</span>
        <span className="ev-col ev-col-spacer" />

        <span className="ev-col ev-col-time">
          {event.time ? <><Clock size={11} /> {event.time}</> : event.period ? <span className="period-badge">{event.period}</span> : ''}
        </span>

        <div className="task-actions">
          {/* Multi-affectation personnel */}
          {renderMultiAssign('display_event', event.id)}
          <Tooltip content={isHidden ? 'Afficher sur l\'écran' : 'Masquer de l\'écran'}>
            <Button variant="ghost"               className={`toggle-visible ${isHidden ? 'off' : ''}`}
              onClick={() => handleToggleDisplayEventVisible(event)}
            >
              {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
          </Tooltip>
          <Tooltip content="Retirer">
            <Button variant="ghost" className="delete" onClick={() => handleDeleteDisplayEvent(event.id)}>
              <Trash2 size={14} />
            </Button>
          </Tooltip>
        </div>
      </div>
    );
  };

  // Masquer une affaire de la planification
  const handleHideAffaire = (affaire) => {
    confirm({
      title: 'Retirer de la planification',
      message: `Masquer l'affaire ${affaire.numeroAffaire} de la planification ?`,
      onConfirm: async () => {
        try {
          await api.hidePlanningAffaire(affaire.numeroAffaire);
          toast.success(`${affaire.numeroAffaire} retirée`);
          loadTasks(true);
        } catch (err) {
          toast.error('Erreur masquage affaire');
        }
      },
    });
  };

  // Carte affaire dans une section — layout colonnes aligné
  const _renderAffaireRow = (affaire) => {
    const typeInfo = AFFAIRE_TYPE_INFO[affaire.type] || { label: affaire.type || 'Affaire', emoji: '📋', color: 'var(--theme-text-secondary)' };
    const isExpanded = expandedRdv === affaire.numeroAffaire;
    const planningStatus = affaire.planningStatus || eventStatuses.get(`rdv:${affaire.numeroAffaire}`) || 'pending';
    const isDone = planningStatus === STATUS.DONE;
    const isProgress = planningStatus === 'in_progress';
    const displayNom = affaire.nom || affaire.event_name || affaire.titre || affaire.client || typeInfo.label;
    const displayClient = affaire.client || '';
    const timeStr = affaire._googleTime
      ? `${affaire._googleTime}${affaire._googleEndTime ? ` → ${affaire._googleEndTime}` : ''}`
      : '';
    const tooltipParts = [
      displayNom,
      (affaire.titre || affaire.event_name) && (affaire.event_name || affaire.titre),
      (affaire._googleLocation || affaire.adresseLivraison) && '📍 ' + (affaire._googleLocation || affaire.adresseLivraison).split('\n')[0],
      affaire.interlocuteur && '👤 ' + affaire.interlocuteur,
      affaire.tel && '📞 ' + affaire.tel,
      affaire.blCount > 0 && `📄 ${affaire.blCount} BL`,
    ].filter(Boolean).join('\n');

    return (
      <div
        key={`aff-${affaire.numeroAffaire}`}
        className={`task-row event-row-cols affaire-row ${isDone ? 'task-done-row' : ''} ${affaire._linkedGoogleEvent ? 'google-linked' : ''}`}
        style={{ flexWrap: 'wrap' }}
      >
        <Button variant="ghost"           className={`ev-col task-status-btn ${isDone ? 'done' : isProgress ? 'in-progress' : ''}`}
          title={`Statut: ${planningStatus} — cliquer pour changer`}
          onClick={(e) => { e.stopPropagation(); handleCycleAffaireStatus(affaire.numeroAffaire); }}
        >
          {isDone && <Check size={14} />}
          {isProgress && <Clock size={12} />}
        </Button>

        <span className="ev-col ev-col-affaire">
          <AffaireBadge numero={affaire.numeroAffaire} type={affaire.type} size="sm" onNavigate={onNavigateToEntity ? (num) => { onNavigateToEntity('affaire', { numero: num }); } : undefined} />
        </span>

        <span className="ev-col ev-col-nom" role="button" tabIndex={0} title={tooltipParts} style={{ cursor: 'pointer' }} onClick={() => openAffaireTaskModal(affaire)}>
          {displayNom}
          {affaire._linkedGoogleEvent && <span className="google-linked-badge" title="Lié à un événement Google Calendar">G</span>}
        </span>

        <span className="ev-col ev-col-client" title={displayClient}>{displayClient}</span>
        <span className="ev-col ev-col-spacer" />

        <span className="ev-col ev-col-time">
          {timeStr ? <><Clock size={11} /> {timeStr}</> : ''}
        </span>

        <div className="task-actions rdv-actions">
          {/* Multi-affectation personnel directe sur l'affaire */}
          {renderMultiAssign('affaire', affaire.numeroAffaire)}
          <Tooltip content="Voir détails">
            <Button variant="ghost" className="btn-rdv-view" onClick={() => setExpandedRdv(isExpanded ? null : affaire.numeroAffaire)}>
              <Eye size={14} />
            </Button>
          </Tooltip>
          <Tooltip content="Définir les tâches pour cette affaire">
            <Button variant="ghost" className="task-status-btn" onClick={(e) => { e.stopPropagation(); openAffaireTaskModal(affaire); }}>
              <Plus size={14} />
            </Button>
          </Tooltip>
          <Tooltip content="Retirer de la planification">
            <Button variant="ghost" className="delete" onClick={(e) => { e.stopPropagation(); handleHideAffaire(affaire); }}>
              <X size={14} />
            </Button>
          </Tooltip>
        </div>

        {isExpanded && (
          <div className="rdv-detail-card">
            <DetailRow className="rdv-detail-row" label="Client :" value={affaire.client || '—'} />
            <DetailRow className="rdv-detail-row" label="Interlocuteur :" value={affaire.interlocuteur || '—'} />
            <DetailRow className="rdv-detail-row" label="Tél :" value={affaire.tel || '—'} />
            <DetailRow className="rdv-detail-row" label="Adresse :" value={affaire.adresseLivraison?.split('\n').join(', ') || '—'} />
            {affaire.titre && <DetailRow className="rdv-detail-row" label="Titre :" value={affaire.titre} />}
            {affaire.devis && <DetailRow className="rdv-detail-row" label="Devis :" value={affaire.devis} />}
          </div>
        )}
      </div>
    );
  };

  // Carte Google Calendar — ligne compacte en colonnes
  const renderGoogleRdvRow = (event) => {
    const summary = event.summary || 'Événement';
    const startDT = event.start?.dateTime || event.start?.date || '';
    const endDT = event.end?.dateTime || event.end?.date || '';
    const timeStr = startDT.includes('T')
      ? `${new Date(startDT).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${endDT ? ' → ' + new Date(endDT).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}`
      : 'Journée';
    const _dayStr = startDT.includes('T')
      ? new Date(startDT).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
      : startDT ? new Date(startDT + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
    const location = event.location || '';
    const affaireMatch = summary.match(/\bAF\s*\d{4,}/i);
    const affaireNum = affaireMatch ? affaireMatch[0].toUpperCase().replace(/\s+/g, '') : '';
    const isProcessed = processedGoogleIds.has(event.id);
    const linkedTasks = tasksBySourceId.get(event.id) || [];
    const isLinking = linkingEvent?.id === event.id;
    // Nom et Client de l'affaire liée
    const linkedAff = affaireNum ? affaireByNum.get(affaireNum.toUpperCase()) : null;
    const affaireClient = linkedAff?.client || '';
    // Titre : retirer le n° d'affaire (déjà affiché dans le badge)
    let displayNom = summary;
    if (affaireNum) {
      displayNom = summary.replace(/\baf\s*\d{4,}/gi, '').replace(/^\s*[-—–:]+\s*/, '').replace(/\s*[-—–:]+\s*$/, '').trim() || summary;
    }

    // Filtrer les affaires pour la recherche manuelle
    const linkableAffaires = isLinking && linkSearchQuery.length >= 2
      ? affaires.filter(a => {
          const q = linkSearchQuery.toUpperCase();
          return (a.numeroAffaire || '').toUpperCase().includes(q)
            || (a.client || '').toUpperCase().includes(q)
            || (a.titre || '').toUpperCase().includes(q);
        }).slice(0, 8)
      : [];

    return (
      <div
        key={`gcal-rdv-${event.id}`}
        className="task-row event-row-cols google-rdv-row"
      >
        <span className="ev-col ev-col-affaire">
          {affaireNum ? <AffaireBadge numero={affaireNum} type={linkedAff?.type} size="sm" onNavigate={onNavigateToEntity ? (num) => onNavigateToEntity('affaire', { numero: num }) : undefined} /> : null}
        </span>
        <span className="ev-col ev-col-nom" role="button" tabIndex={0} title={[displayNom, location && '📍 ' + location].filter(Boolean).join('\n')} style={{ cursor: 'pointer' }} onClick={() => setEventTaskModalEvent(event)}>{displayNom}</span>
        <span className="ev-col ev-col-client" title={affaireClient}>{affaireClient}</span>
        <span className="ev-col ev-col-spacer" />
        <span className="ev-col ev-col-time"><Clock size={11} /> {timeStr}</span>
        <div className="task-actions">
          <span className="google-badge" title="Google Calendar">G</span>
          <span className={`ev-col ev-col-status google-status-badge ${isProcessed ? 'done' : 'pending'}`}>
            {isProcessed ? '✓' : '⚙'}
          </span>
          <Button variant="ghost"             className={`btn-link-affaire ${isLinking ? 'active' : ''}`}
            title="Lier à une affaire"
            style={affaireNum ? { visibility: 'hidden' } : {}}
            onClick={(e) => { e.stopPropagation(); setLinkingEvent(isLinking ? null : event); setLinkSearchQuery(''); }}
          >
            <Link size={13} />
          </Button>
        </div>
        {/* Mini-badges des tâches créées depuis cet événement */}
        {linkedTasks.length > 0 && (
          <div className="event-linked-tasks">
            {linkedTasks.map(t => {
              const isDone = t.status === STATUS.DONE;
              const label = (t.title || '').replace(/\s*—.*$/, '').replace(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]+\s*/u, '').trim();
              const emoji = (t.title || '').match(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]+/u)?.[0] || '📋';
              return (
                <span key={t.id} className={`linked-task-chip ${isDone ? 'done' : ''}`} title={`${t.title}${t.date ? ' — ' + t.date : ''}${t.time ? ' ' + t.time : ''}`}>
                  {emoji} {label}{t.date && t.date !== selectedDate ? ` (${new Date(t.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })})` : ''}
                  {isDone && <Check size={10} />}
                </span>
              );
            })}
          </div>
        )}
        {/* Popover de liaison manuelle */}
        {isLinking && (
          <div className="link-affaire-popover" onClick={(e) => e.stopPropagation()}>
            <div className="link-popover-header">
              <span>🔗 Lier à une affaire</span>
              <Button variant="ghost" className="link-popover-close" onClick={() => { setLinkingEvent(null); setLinkSearchQuery(''); }}>
                <X size={14} />
              </Button>
            </div>
            <Input
              type="text"
              className="link-search-input"
              placeholder="Rechercher AF, client…"
              value={linkSearchQuery}
              onChange={(e) => setLinkSearchQuery(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Escape') { setLinkingEvent(null); setLinkSearchQuery(''); } }}
            />
            {/* Saisie directe d'un numéro AF */}
            {linkSearchQuery.match(/^\s*AF\s*\d{4,}\s*$/i) && (
              <Button variant="ghost"                 className="link-option link-option-create"
                onClick={() => {
                  const num = linkSearchQuery.toUpperCase().replace(/\s+/g, '').trim();
                  handleManualLink(event, num);
                }}
              >
                ➕ Créer & lier <strong>{linkSearchQuery.toUpperCase().replace(/\s+/g, '').trim()}</strong>
              </Button>
            )}
            {linkableAffaires.length > 0 && (
              <div className="link-options-list">
                {linkableAffaires.map(a => (
                  <Button variant="ghost"                     key={a.id || a.numeroAffaire}
                    className="link-option"
                    onClick={() => handleManualLink(event, a.numeroAffaire)}
                  >
                    <AffaireBadge numero={a.numeroAffaire} type={a.type} size="sm" />
                    <span className="link-option-client">{a.client || 'Sans client'}</span>
                  </Button>
                ))}
              </div>
            )}
            {linkSearchQuery.length >= 2 && linkableAffaires.length === 0 && !linkSearchQuery.match(/^\s*AF\s*\d{4,}\s*$/i) && (
              <div className="link-no-results">Aucune affaire trouvée</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Carte RDV : affaire avec détails dépliables
  const renderRdvRow = (affaire) => {
    const typeInfo = AFFAIRE_TYPE_INFO[affaire.type] || { label: affaire.type || 'Affaire', emoji: '📋', color: 'var(--theme-text-secondary)' };
    const isExpanded = expandedRdv === affaire.numeroAffaire;
    const displayNom = affaire.nom || affaire.event_name || affaire.titre || affaire.client || typeInfo.label;
    const displayClient = affaire.client || '';
    const timeStr = affaire._googleTime
      ? `${affaire._googleTime}${affaire._googleEndTime ? ` → ${affaire._googleEndTime}` : ''}`
      : '';
    const tooltipParts = [
      displayNom,
      (affaire.titre || affaire.event_name) && (affaire.event_name || affaire.titre),
      (affaire._googleLocation || affaire.adresseLivraison) && '📍 ' + (affaire._googleLocation || affaire.adresseLivraison).split('\n')[0],
      affaire.interlocuteur && '👤 ' + affaire.interlocuteur,
      affaire.tel && '📞 ' + affaire.tel,
    ].filter(Boolean).join('\n');

    return (
      <div key={`rdv-${affaire.numeroAffaire}`} className={`task-row event-row-cols rdv-row ${affaire._linkedGoogleEvent ? 'google-linked' : ''}`} style={{ flexWrap: 'wrap' }}>

        <span className="ev-col ev-col-affaire">
          <AffaireBadge numero={affaire.numeroAffaire} type={affaire.type} size="sm" onNavigate={onNavigateToEntity ? (num) => onNavigateToEntity('affaire', { numero: num }) : undefined} />
        </span>

        <span className="ev-col ev-col-nom" role="button" tabIndex={0} title={tooltipParts} style={{ cursor: 'pointer' }} onClick={() => openAffaireTaskModal(affaire)}>
          {displayNom}
          {affaire._linkedGoogleEvent && <span className="google-linked-badge" title="Lié à un événement Google Calendar">G</span>}
        </span>

        <span className="ev-col ev-col-client" title={displayClient}>{displayClient}</span>
        <span className="ev-col ev-col-spacer" />

        <span className="ev-col ev-col-time">
          {timeStr ? <><Clock size={11} /> {timeStr}</> : ''}
        </span>

        <div className="task-actions rdv-actions">
          <Tooltip content="Voir détails">
            <Button variant="ghost" className="btn-rdv-view" onClick={() => setExpandedRdv(isExpanded ? null : affaire.numeroAffaire)}>
              <Eye size={14} />
            </Button>
          </Tooltip>
          <Tooltip content="Définir les tâches pour cette affaire">
            <Button variant="ghost" className="task-status-btn" onClick={(e) => { e.stopPropagation(); openAffaireTaskModal(affaire); }}>
              <Plus size={14} />
            </Button>
          </Tooltip>
          <Tooltip content="Retirer de la planification">
            <Button variant="ghost" className="delete" onClick={(e) => { e.stopPropagation(); handleHideAffaire(affaire); }}>
              <X size={14} />
            </Button>
          </Tooltip>
        </div>

        {isExpanded && (
          <div className="rdv-detail-card">
            <DetailRow className="rdv-detail-row" label="Client :" value={affaire.client || '—'} />
            <DetailRow className="rdv-detail-row" label="Interlocuteur :" value={affaire.interlocuteur || '—'} />
            <DetailRow className="rdv-detail-row" label="Tél :" value={affaire.tel || '—'} />
            <DetailRow className="rdv-detail-row" label="Adresse :" value={affaire.adresseLivraison?.split('\n').join(', ') || '—'} />
            {affaire.titre && <DetailRow className="rdv-detail-row" label="Titre :" value={affaire.titre} />}
            {affaire.devis && <DetailRow className="rdv-detail-row" label="Devis :" value={affaire.devis} />}
          </div>
        )}
      </div>
    );
  };

  // Carte événement iCal
  // Transformer un événement iCal en objet compatible EventTaskModal (format Google-like)
  const icalToGoogleLike = useCallback((ev) => {
    const startDT = ev.start || '';
    const endDT = ev.end || '';
    return {
      id: ev.id, // uid iCal ou généré
      summary: ev.summary || 'Événement',
      start: startDT.includes('T') ? { dateTime: startDT } : { date: startDT },
      end: endDT.includes('T') ? { dateTime: endDT } : { date: endDT },
      location: ev.location || '',
      description: ev.description || '',
      _ical: true,
      _calendarName: ev.calendarName,
      _calendarColor: ev.calendarColor,
    };
  }, []);

  const renderIcalEventRow = (event) => {
    const startDT = event.start || '';
    const endDT = event.end || '';
    const timeStr = startDT.includes('T')
      ? `${new Date(startDT).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${endDT ? ' → ' + new Date(endDT).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}`
      : 'Journée';
    const _dayStr = startDT.includes('T')
      ? new Date(startDT).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
      : startDT ? new Date(startDT + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
    const isProcessed = processedGoogleIds.has(event.id);
    const linkedTasks = tasksBySourceId.get(event.id) || [];
    const icalAffaireMatch = (event.summary || '').match(/\bAF\s*\d{4,}/i);
    const affaireNum = icalAffaireMatch ? icalAffaireMatch[0].toUpperCase().replace(/\s+/g, '') : '';
    const isLinking = linkingEvent?.id === event.id;
    // Nom et Client de l'affaire liée
    const linkedAff = affaireNum ? affaireByNum.get(affaireNum.toUpperCase()) : null;
    const affaireClient = linkedAff?.client || '';
    // Titre : retirer le n° d'affaire (déjà affiché dans le badge)
    let displayNom = event.summary || 'Événement';
    if (affaireNum) {
      displayNom = displayNom.replace(/\baf\s*\d{4,}/gi, '').replace(/^\s*[-—–:]+\s*/, '').replace(/\s*[-—–:]+\s*$/, '').trim() || displayNom;
    }

    const linkableAffaires = isLinking && linkSearchQuery.length >= 2
      ? affaires.filter(a => {
          const q = linkSearchQuery.toUpperCase();
          return (a.numeroAffaire || '').toUpperCase().includes(q)
            || (a.client || '').toUpperCase().includes(q)
            || (a.titre || '').toUpperCase().includes(q);
        }).slice(0, 8)
      : [];

    return (
      <div
        key={`ical-${event.id}-${startDT}`}
        className="task-row event-row-cols ical-event-row"
      >
        <span className="ev-col ev-col-affaire">
          {affaireNum ? <AffaireBadge numero={affaireNum} type={linkedAff?.type} size="sm" onNavigate={onNavigateToEntity ? (num) => onNavigateToEntity('affaire', { numero: num }) : undefined} /> : null}
        </span>
        <span className="ev-col ev-col-nom" role="button" tabIndex={0} title={[displayNom, event.location && '📍 ' + event.location].filter(Boolean).join('\n')} onClick={() => setEventTaskModalEvent(icalToGoogleLike(event))} style={{ cursor: 'pointer' }}>{displayNom}</span>
        <span className="ev-col ev-col-client" title={affaireClient}>{affaireClient}</span>
        <span className="ev-col ev-col-spacer" />
        <span className="ev-col ev-col-time"><Clock size={11} /> {timeStr}</span>
        <div className="task-actions">
          <span className="ical-origin-badge" style={{ borderColor: event.calendarColor || '#3b82f6', color: event.calendarColor || '#3b82f6' }} title={event.calendarName}>
            {(event.calendarName || 'iCal').slice(0, 3)}
          </span>
          <span className={`ev-col ev-col-status google-status-badge ${isProcessed ? 'done' : 'pending'}`}>
            {isProcessed ? '✓' : '⚙'}
          </span>
          <Button variant="ghost"             className={`btn-link-affaire ${isLinking ? 'active' : ''}`}
            title="Lier à une affaire"
            style={affaireNum ? { visibility: 'hidden' } : {}}
            onClick={(e) => { e.stopPropagation(); setLinkingEvent(isLinking ? null : event); setLinkSearchQuery(''); }}
          >
            <Link size={13} />
          </Button>
        </div>
        {/* Mini-badges des tâches créées depuis cet événement iCal */}
        {linkedTasks.length > 0 && (
          <div className="event-linked-tasks">
            {linkedTasks.map(t => {
              const isDone = t.status === STATUS.DONE;
              const label = (t.title || '').replace(/\s*—.*$/, '').replace(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]+\s*/u, '').trim();
              const emoji = (t.title || '').match(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]+/u)?.[0] || '📋';
              return (
                <span key={t.id} className={`linked-task-chip ${isDone ? 'done' : ''}`} title={`${t.title}${t.date ? ' — ' + t.date : ''}${t.time ? ' ' + t.time : ''}`}>
                  {emoji} {label}{t.date && t.date !== selectedDate ? ` (${new Date(t.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })})` : ''}
                  {isDone && <Check size={10} />}
                </span>
              );
            })}
          </div>
        )}
        {isLinking && (
          <div className="link-affaire-popover" onClick={(e) => e.stopPropagation()}>
            <div className="link-popover-header">
              <span>🔗 Lier à une affaire</span>
              <Button variant="ghost" className="link-popover-close" onClick={() => { setLinkingEvent(null); setLinkSearchQuery(''); }}>
                <X size={14} />
              </Button>
            </div>
            <Input
              type="text"
              className="link-search-input"
              placeholder="Rechercher AF, client…"
              value={linkSearchQuery}
              onChange={(e) => setLinkSearchQuery(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Escape') { setLinkingEvent(null); setLinkSearchQuery(''); } }}
            />
            {linkSearchQuery.match(/^\s*AF\s*\d{4,}\s*$/i) && (
              <Button variant="ghost"                 className="link-option link-option-create"
                onClick={() => {
                  const num = linkSearchQuery.toUpperCase().replace(/\s+/g, '').trim();
                  handleManualLink(event, num);
                }}
              >
                ➕ Créer & lier <strong>{linkSearchQuery.toUpperCase().replace(/\s+/g, '').trim()}</strong>
              </Button>
            )}
            {linkableAffaires.length > 0 && (
              <div className="link-options-list">
                {linkableAffaires.map(a => (
                  <Button variant="ghost"                     key={a.id || a.numeroAffaire}
                    className="link-option"
                    onClick={() => handleManualLink(event, a.numeroAffaire)}
                  >
                    <AffaireBadge numero={a.numeroAffaire} type={a.type} size="sm" />
                    <span className="link-option-client">{a.client || 'Sans client'}</span>
                  </Button>
                ))}
              </div>
            )}
            {linkSearchQuery.length >= 2 && linkableAffaires.length === 0 && !linkSearchQuery.match(/^\s*AF\s*\d{4,}\s*$/i) && (
              <div className="link-no-results">Aucune affaire trouvée</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Rendu compact d'une mini-carte pour la vue semaine ──
  const renderWeekMiniCard = (item, type) => {
    if (type === 'task') {
      const isDone = item.status === STATUS.DONE;
      const isProgress = item.status === 'in_progress';
      const sectionInfo = SECTIONS[normalizeSection(item.section || 'manual')] || SECTIONS.manual;
      return (
        <div
          key={`wt-${item.id}`}
          className={`wk-card wk-task ${isDone ? 'done' : ''} ${isProgress ? 'in-progress' : ''} ${item.visible === 0 ? 'hidden-display' : ''}`}
          style={{ borderLeftColor: sectionInfo.color }}
        >
          <Button variant="ghost"             className={`wk-status ${isDone ? 'done' : isProgress ? 'in-progress' : ''}`}
            onClick={() => cycleStatus(item)}
          >
            {isDone && <Check size={10} />}
            {isProgress && <Clock size={10} />}
          </Button>
          {(() => {
            const an = item.affaireNum || extractAffaireNum(item.title) || extractAffaireNum(item.googleEventTitle);
            return an ? <AffaireBadge numero={an} type={affaireByNum.get(an.toUpperCase())?.type} size="sm" onNavigate={onNavigateToEntity ? (num) => onNavigateToEntity('affaire', { numero: num }) : undefined} /> : null;
          })()}
          {(() => {
            const isP = (item.section || '').startsWith('prep_');
            const cleaned = isP ? item.title.replace(/^🔧\s*Préparation\s*—\s*/i, '') : item.title;
            const an = item.affaireNum || extractAffaireNum(item.title) || extractAffaireNum(item.googleEventTitle);
            // Nom de l'événement Google ou titre de l'affaire liée
            const eventLabel = item.googleEventTitle
              || (an && affaireByNum.get(an.toUpperCase())?.event_name)
              || (an && affaireByNum.get(an.toUpperCase())?.titre)
              || '';
            const wkDisplayTitle = cleaned || eventLabel || item.title || '-';
            const wkCapTitle = wkDisplayTitle.charAt(0).toUpperCase() + wkDisplayTitle.slice(1);
            return (
              <span className="wk-task-info">
                <span className={`wk-title ${isDone ? 'done' : ''}`} title={`${an ? an + ' · ' : ''}${item.title}${eventLabel ? ' — ' + eventLabel : ''}`}>{wkCapTitle}</span>
                {eventLabel && <span className="wk-event-label" title={eventLabel}>{eventLabel.length > 20 ? eventLabel.slice(0, 20) + '…' : eventLabel}</span>}
              </span>
            );
          })()}
          {(item.personFirstName) && (
            <span className="wk-person">{item.personFirstName?.charAt(0)}{item.personLastName?.charAt(0)}</span>
          )}
          <div className="wk-actions">
            <Button variant="ghost" onClick={() => setEditingTask(item)} title="Modifier">
              <Edit2 size={10} />
            </Button>
            <Button variant="ghost" onClick={() => handleToggleTaskVisible(item)} title={item.visible === 0 ? 'Afficher' : 'Masquer'}>
              {item.visible === 0 ? <EyeOff size={10} /> : <Eye size={10} />}
            </Button>
            <Button variant="ghost" className="del" onClick={() => handleDelete(item.id)} title="Supprimer">
              <Trash2 size={10} />
            </Button>
          </div>
        </div>
      );
    }
    if (type === 'event') {
      const typeInfo = EVENT_TYPES[item.type] || { label: item.type, emoji: '📌', color: 'var(--theme-text-secondary)' };
      return (
        <div
          key={`we-${item.id}`}
          className={`wk-card wk-event ${item.visible === 0 ? 'hidden-display' : ''}`}
          style={{ borderLeftColor: typeInfo.color }}
        >
          <Monitor size={10} style={{ color: typeInfo.color, flexShrink: 0 }} />
          <span className="wk-title" title={`${typeInfo.label}${item.client ? ' — ' + item.client : ''}`}>
            {typeInfo.emoji} {item.client || typeInfo.label}
          </span>
          <div className="wk-actions">
            <Button variant="ghost" onClick={() => handleToggleDisplayEventVisible(item)} title={item.visible === 0 ? 'Afficher' : 'Masquer'}>
              {item.visible === 0 ? <EyeOff size={10} /> : <Eye size={10} />}
            </Button>
            <Button variant="ghost" className="del" onClick={() => handleDeleteDisplayEvent(item.id)} title="Retirer">
              <Trash2 size={10} />
            </Button>
          </div>
        </div>
      );
    }
    if (type === 'affaire') {
      const typeInfo = AFFAIRE_TYPE_INFO[item.type] || { label: 'Affaire', emoji: '📋', color: 'var(--theme-text-secondary)' };
      const isProcessed = item._googleId
        ? processedGoogleIds.has(item._googleId)
        : processedGoogleIds.has(`affaire-${item.id || item.numeroAffaire}`);
      return (
        <div
          key={`wa-${item.numeroAffaire}`}
          className={`wk-card wk-affaire ${isProcessed ? 'processed' : 'pending'} ${item._linkedGoogleEvent ? 'google-linked' : ''}`}
          style={{ borderLeftColor: typeInfo.color, cursor: 'pointer' }}
          onClick={() => openAffaireTaskModal(item)}
        >
          <Briefcase size={10} style={{ color: typeInfo.color, flexShrink: 0 }} />
          <span className="wk-title" title={`${item.numeroAffaire}${item.client ? ' — ' + item.client : ''}${item.event_name || item.titre ? ' • ' + (item.event_name || item.titre) : ''}${item._googleTime ? ' • ' + item._googleTime : ''}`}>
            {typeInfo.emoji} {item.client || item.numeroAffaire}{(item.event_name || item.titre) ? ` · ${(item.event_name || item.titre).slice(0, 15)}${(item.event_name || item.titre).length > 15 ? '…' : ''}` : ''}
          </span>
          {item._googleTime && <span className="wk-time">{item._googleTime}</span>}
          {item._linkedGoogleEvent && <span className="wk-google-badge" title="Lié Google">G</span>}
          {isProcessed && <span className="wk-status-dot done">✓</span>}
          <div className="wk-actions">
            <Button variant="ghost" className="del" onClick={(e) => { e.stopPropagation(); handleHideAffaire(item); }} title="Retirer">
              <X size={10} />
            </Button>
          </div>
        </div>
      );
    }
    if (type === 'google') {
      const summary = item.summary || 'Événement';
      const isProcessed = processedGoogleIds.has(item.id);
      const startDT = typeof item.start === 'string' ? item.start : (item.start?.dateTime || item.start?.date || '');
      const timeStr = startDT.includes('T')
        ? new Date(startDT).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : '';
      return (
        <div
          key={`wg-${item.id}`}
          className={`wk-card wk-google ${isProcessed ? 'processed' : 'pending'}`}
          style={{ borderLeftColor: isProcessed ? '#10b981' : '#4285f4', cursor: 'pointer' }}
          onClick={() => setEventTaskModalEvent(item)}
        >
          <Calendar size={10} style={{ color: '#4285f4', flexShrink: 0 }} />
          <span className="wk-title" title={summary}>{summary.slice(0, 22)}{summary.length > 22 ? '…' : ''}</span>
          {timeStr && <span className="wk-time">{timeStr}</span>}
          <span className={`wk-status-dot ${isProcessed ? 'done' : ''}`}>{isProcessed ? '✓' : '⚙'}</span>
        </div>
      );
    }
    return null;
  };

  // ── Colonne étendue d'un jour — bande ÉVÉNEMENTS (Google, affaires, display events) ──
  const renderWeekDayExpandedEvents = (dayStr) => {
    const dayData = weekGroupedByDay?.[dayStr] || { tasks: [], events: [], affaires: [], googleEvents: [] };
    const totalEvents = dayData.googleEvents.length + dayData.affaires.length + dayData.events.length;
    if (totalEvents === 0) return <div className="wk-empty">—</div>;
    return (
      <div className="wk-day-expanded">
        {dayData.googleEvents.length > 0 && (
          <div className="wk-expanded-section">
            <div className="wk-expanded-section-label" style={{ color: '#4285f4' }}>📅 Google Calendar</div>
            {dayData.googleEvents.map(ev => renderWeekMiniCard(ev, 'google'))}
          </div>
        )}
        {dayData.affaires.length > 0 && (
          <div className="wk-expanded-section">
            <div className="wk-expanded-section-label" style={{ color: 'var(--theme-primary, #3b82f6)' }}>📋 Affaires</div>
            {dayData.affaires.map(a => renderWeekMiniCard(a, 'affaire'))}
          </div>
        )}
        {dayData.events.length > 0 && (
          <div className="wk-expanded-section">
            <div className="wk-expanded-section-label" style={{ color: 'var(--theme-text-secondary)' }}>📺 Écran</div>
            {dayData.events.map(ev => renderWeekMiniCard(ev, 'event'))}
          </div>
        )}
      </div>
    );
  };

  // ── Colonne étendue d'un jour — bande TÂCHES (groupées par section avec lignes complètes) ──
  const renderWeekDayExpandedTasks = (dayStr) => {
    const dayData = weekGroupedByDay?.[dayStr] || { tasks: [], events: [], affaires: [], googleEvents: [] };
    if (dayData.tasks.length === 0) return <div className="wk-empty">—</div>;

    const tasksBySection = {};
    dayData.tasks.forEach(t => {
      const sec = normalizeSection(t.section || 'manual');
      if (!tasksBySection[sec]) tasksBySection[sec] = [];
      tasksBySection[sec].push(t);
    });
    const sectionOrder = Object.keys(SECTIONS);

    return (
      <div className="wk-day-expanded">
        {/* En-tête de colonnes */}
        <div className="tp-columns-header tp-columns-header-mini">
          <span className="ev-col-h ev-col-h-status">✔</span>
          <span className="ev-col-h ev-col-h-affaire">Aff.</span>
          <span className="ev-col-h ev-col-h-nom">Titre</span>
          <span className="ev-col-h ev-col-h-client">Client</span>
          <span className="ev-col-h ev-col-h-spacer"></span>
          <span className="ev-col-h ev-col-h-time">Heure</span>
          <span className="ev-col-h ev-col-h-actions">Actions</span>
        </div>
        {sectionOrder.map(secKey => {
          const secInfo = SECTIONS[secKey];
          if (!secInfo) return null;
          const secTasks = tasksBySection[secKey] || [];
          if (secTasks.length === 0) return null;
          return (
            <div key={secKey} className="wk-expanded-section">
              <div className="wk-expanded-section-label" style={{ color: secInfo.color }}>
                {secInfo.emoji} {secInfo.label}
              </div>
              {secTasks.map(renderTaskRow)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSection = (sectionKey) => {
    const info = SECTIONS[sectionKey];
    const sectionTasks = grouped[sectionKey] || [];
    const sectionAffaires = affairesBySection[sectionKey] || [];
    const isRdv = sectionKey === 'rdv';
    const isEvenements = sectionKey === 'evenements';
    const googleRdvCount = isRdv ? googleRdvEvents.length : 0;
    const mergedCount = isEvenements ? mergedOtherEvents.length : 0;
    // Les affaires comptent uniquement dans RDV
    const affaireCount = isRdv ? sectionAffaires.length : 0;
    const totalCount = sectionTasks.length + affaireCount + googleRdvCount + mergedCount;

    // Masquer les sections opérationnelles vides
    if (!isRdv && !isEvenements && totalCount === 0) return null;

    const isCollapsible = isEvenements;
    const isCollapsed = isCollapsible && collapsedSections[sectionKey];

    return (
      <div key={sectionKey} className={`task-section ${isRdv ? 'rdv-section' : ''} ${isEvenements ? 'evenements-section' : ''} ${isCollapsed ? 'section-collapsed' : ''}`}>
        <div
          className={`section-header ${isCollapsible ? 'collapsible' : ''}`}
          style={{ borderBottomColor: info.color, background: `color-mix(in srgb, ${info.color} 10%, var(--theme-bg-secondary, #f8fafc))` }}
          onClick={isCollapsible ? () => toggleSectionCollapse(sectionKey) : undefined}
        >
          <h4 style={{ color: info.color }}>
            {isCollapsible && <ChevronDown size={16} className={`section-chevron ${isCollapsed ? 'collapsed' : ''}`} />}
            <span>{info.emoji}</span>
            {info.label}
          </h4>
          <span className="section-count" style={{ background: info.color }}>{totalCount}</span>
          {isEvenements && (
            <div className="ical-header-actions" onClick={e => e.stopPropagation()}>
              <Button variant="ghost" className="ical-manage-btn" onClick={() => setShowIcalManager(v => !v)}>
                <Link size={13} /> iCal ({icalCalendars.length})
              </Button>
              <Tooltip content="Rafraîchir les événements iCal">
                <Button variant="ghost" className="ical-refresh-btn" onClick={() => { loadIcalCalendars(); loadIcalEvents(); }}>
                  <RefreshCw size={13} className={icalLoading ? 'spinning' : ''} />
                </Button>
              </Tooltip>
            </div>
          )}
        </div>

        {!isCollapsed && <>
        {/* Section RDV : Google Calendar RDV (titre contient "rdv") + affaires avec "rdv" dans le titre */}
        {isRdv && googleRdvEvents.map(renderGoogleRdvRow)}
        {isRdv && sectionAffaires.map(renderRdvRow)}
        {isRdv && totalCount === 0 && (
          <div className="section-empty-msg">Aucun rendez-vous pour cette date</div>
        )}

        {/* Section Événements Google + iCal : liste fusionnée triée */}
        {isEvenements && (() => {
          const now = new Date();
          // Utiliser selectedDate (date affichée) pour classer les événements, pas la date réelle
          const viewDate = selectedDate;
          // Déterminer si un événement est "du jour" ou "en cours"
          const classifyEvent = (ev) => {
            const start = ev._source === 'ical' ? (ev.start || '') : (ev.start?.dateTime || ev.start?.date || '');
            const end = ev._source === 'ical' ? (ev.end || '') : (ev.end?.dateTime || ev.end?.date || '');
            const startDate = start.slice(0, 10);
            const evStart = start ? new Date(start.includes('T') ? start : start + 'T00:00:00') : null;
            const evEnd = end ? new Date(end.includes('T') ? end : end + 'T23:59:59') : null;
            const isSelected = startDate === viewDate;
            const isOngoing = evStart && evEnd && evStart <= now && now <= evEnd;
            if (isSelected || isOngoing) return 'today';
            if (startDate < viewDate) return 'past';
            return 'future';
          };
          // Classer les événements en 3 groupes
          const pastEvents = [];
          const todayEvents = [];
          const futureEvents = [];
          mergedOtherEvents.forEach(ev => {
            const cls = classifyEvent(ev);
            if (cls === 'past') pastEvents.push(ev);
            else if (cls === 'today') todayEvents.push(ev);
            else futureEvents.push(ev);
          });
          const renderEvRow = (ev) => ev._source === 'ical' ? renderIcalEventRow(ev) : renderGoogleRdvRow(ev);
          return (
            <>
              {/* Événements précédents */}
              {pastEvents.length > 0 && (
                <Accordion
                  title={<><span className="subgroup-label">Événements précédents</span> <span className="subgroup-count">{pastEvents.length}</span></>}
                  open={!collapsedPastEvents}
                  onToggle={() => setCollapsedPastEvents(v => !v)}
                  className="events-subgroup events-past-group"
                >
                  <div className="events-subgroup-content">{pastEvents.map(renderEvRow)}</div>
                </Accordion>
              )}
              {/* Événements du jour */}
              {todayEvents.length > 0 && (
                <div className="events-today-group">{todayEvents.map(renderEvRow)}</div>
              )}
              {/* Événements suivants */}
              {futureEvents.length > 0 && (
                <Accordion
                  title={<><span className="subgroup-label">Événements suivants</span> <span className="subgroup-count">{futureEvents.length}</span></>}
                  open={!collapsedFutureEvents}
                  onToggle={() => setCollapsedFutureEvents(v => !v)}
                  className="events-subgroup events-future-group"
                >
                  <div className="events-subgroup-content">{futureEvents.map(renderEvRow)}</div>
                </Accordion>
              )}
            </>
          );
        })()}

        {/* Sections opérationnelles : uniquement des tâches */}
        {!isRdv && !isEvenements && sectionTasks.map(renderTaskRow)}
        {!isRdv && !isEvenements && sectionTasks.length === 0 && (
          <div className="section-empty-msg">Aucune tâche</div>
        )}

        </>}
      </div>
    );
  };

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === STATUS.DONE).length;

  // Toggle la visibilité d'une tâche sur l'affichage dynamique
  const handleToggleTaskVisible = async (task) => {
    try {
      await api.toggleTaskVisibility(task.id);
      loadTasks(true);
    } catch (err) {
      toast.error('Erreur toggle visibilité');
    }
  };

  // Toggle la visibilité d'un événement d'affichage
  const handleToggleDisplayEventVisible = async (event) => {
    try {
      await api.toggleDisplayEventVisibility(event.id);
      loadTasks(true);
    } catch (err) {
      toast.error('Erreur toggle visibilité');
    }
  };

  const handleCycleDisplayEventStatus = async (event) => {
    try {
      await api.cycleDisplayEventStatus(event.id);
      loadTasks(true);
    } catch (err) {
      toast.error('Erreur mise à jour statut');
    }
  };

  const handleCycleAffaireStatus = async (numeroAffaire) => {
    try {
      await api.cycleAffaireStatus(numeroAffaire);
      loadTasks(true);
    } catch (err) {
      toast.error('Erreur mise à jour statut affaire');
    }
  };

  const _handleCyclePlanningEventStatus = async (eventType, eventId) => {
    try {
      await api.cyclePlanningEventStatus(eventType, eventId);
      loadTasks(true);
    } catch (err) {
      toast.error('Erreur mise à jour statut');
    }
  };

  // Format date court pour le mode semaine
  const _getDateBadge = (dateStr) => {
    if (viewMode !== 'week' || !dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
  };

  return (
    <div className="task-planning-panel">
      {/* Toolbar */}
      <div className="tp-toolbar">
        <div className="tp-toolbar-left">
          {/* Toggle vue Jour / Semaine */}
          <div className="tp-view-toggle">
            <Button variant="ghost"               className={viewMode === 'day' ? 'active' : ''}
              onClick={() => setViewMode('day')}
              title="Vue jour"
            >
              <LayoutList size={15} /> Jour
            </Button>
            <Button variant="ghost"               className={viewMode === 'week' ? 'active' : ''}
              onClick={() => setViewMode('week')}
              title="Vue semaine"
            >
              <CalendarDays size={15} /> Semaine
            </Button>
          </div>

          <div className="tp-date-nav">
            <Button variant="ghost" onClick={() => setSelectedDate(d => addDays(d, viewMode === 'week' ? -7 : -1))}>
              <ChevronLeft size={16} />
            </Button>
            <span className="tp-current-date" role="button" tabIndex={0} onClick={() => setSelectedDate(todayStr())} title="Aujourd'hui">
              {viewMode === 'week'
                ? `${formatDateShort(weekDays[0])} → ${formatDateShort(weekDays[6])}`
                : formatDateFr(selectedDate)}
            </span>
            <Button variant="ghost" onClick={() => setSelectedDate(d => addDays(d, viewMode === 'week' ? 7 : 1))}>
              <ChevronRight size={16} />
            </Button>
          </div>
          {totalTasks > 0 && (
            <span style={{ fontSize: '0.82rem', color: 'var(--theme-text-secondary)' }}>
              {doneTasks}/{totalTasks} terminée{doneTasks > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="tp-toolbar-right">
          <Button variant="secondary" className="btn-toolbar-action" onClick={handleRollover} title="Reporter les tâches non terminées au lendemain">
            <SkipForward size={16} /> Reporter
          </Button>
          <Button variant="secondary" className="btn-toolbar-action btn-clear-done" onClick={handleClearCompleted} title="Effacer les tâches terminées du planning et du dashboard" disabled={doneTasks === 0}>
            <CheckCheck size={16} /> Effacer terminées
          </Button>
          <Button variant="secondary" className="btn-toolbar-action" onClick={handleGenerateRecurring} title="Générer les tâches récurrentes pour ce jour">
            <Repeat size={16} /> Générer
          </Button>
          <Button variant={showRecurring ? 'primary' : 'secondary'} className={`btn-toolbar-action ${showRecurring ? 'active' : ''}`} onClick={() => setShowRecurring(v => !v)} title="Gérer les tâches récurrentes">
            <Settings size={16} /> Récurrentes
          </Button>
          <Button variant="secondary" className="btn-export-pdf" onClick={handleExportPdf} title="Exporter la fiche de tâches en PDF">
            <FileDown size={16} /> PDF
          </Button>
          <Button variant="primary" className="btn-toolbar-action" onClick={() => setShowAddTaskModal(true)} title="Ajouter une nouvelle tâche">
            <Plus size={16} /> Nouvelle tâche
          </Button>
        </div>
      </div>

      {/* ═══ Panneau Tâches Récurrentes ═══ */}
      {showRecurring && (
        <div className="recurring-panel">
          <div className="recurring-panel-header">
            <h3><Repeat size={18} /> Tâches Récurrentes</h3>
            <Button variant="primary" size="sm" onClick={() => setRecurringForm({ title: '', section: 'manual', recurrence: 'daily', dayOfWeek: 1, dayOfMonth: 1, time: '08:00', period: 'AM', notes: '' })}>
              <Plus size={14} /> Ajouter
            </Button>
          </div>

          {/* Formulaire création/édition */}
          {recurringForm && (
            <div className="recurring-form">
              <div className="recurring-form-row">
                <Input type="text" placeholder="Titre de la tâche..." value={recurringForm.title || ''} onChange={e => setRecurringForm(f => ({ ...f, title: e.target.value }))} autoFocus />
                <Select value={recurringForm.section || 'manual'} onChange={e => setRecurringForm(f => ({ ...f, section: e.target.value }))}>
                  {Object.entries(SECTIONS).map(([k, v]) => (
                    <option key={k} value={k}>{v.emoji} {v.label}</option>
                  ))}
                </Select>
              </div>
              <div className="recurring-form-row">
                <Select value={recurringForm.recurrence || 'daily'} onChange={e => setRecurringForm(f => ({ ...f, recurrence: e.target.value }))}>
                  <option value="daily">Journalière</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuelle</option>
                </Select>
                {recurringForm.recurrence === 'weekly' && (
                  <Select value={recurringForm.dayOfWeek ?? 1} onChange={e => setRecurringForm(f => ({ ...f, dayOfWeek: parseInt(e.target.value) }))}>
                    {DAYS_FR.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </Select>
                )}
                {recurringForm.recurrence === 'monthly' && (
                  <Select value={recurringForm.dayOfMonth ?? 1} onChange={e => setRecurringForm(f => ({ ...f, dayOfMonth: parseInt(e.target.value) }))}>
                    {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                  </Select>
                )}
                <input type="time" value={recurringForm.time || '08:00'} onChange={e => setRecurringForm(f => ({ ...f, time: e.target.value }))} />
                <Select value={recurringForm.period || 'AM'} onChange={e => setRecurringForm(f => ({ ...f, period: e.target.value }))}>
                  <option value="AM">Matin</option>
                  <option value="PM">Après-midi</option>
                </Select>
              </div>
              <div className="recurring-form-row">
                <Input type="text" placeholder="Notes (optionnel)" value={recurringForm.notes || ''} onChange={e => setRecurringForm(f => ({ ...f, notes: e.target.value }))} />
                <div className="form-actions">
                  <Button variant="success" size="sm" iconOnly onClick={handleSaveRecurring} aria-label="Enregistrer"><Check size={14} /></Button>
                  <Button variant="ghost" size="sm" iconOnly onClick={() => setRecurringForm(null)} aria-label="Annuler"><X size={14} /></Button>
                </div>
              </div>
            </div>
          )}

          {/* Liste */}
          <div className="recurring-list">
            {recurringTasks.length === 0 && !recurringForm && (
              <div className="recurring-empty">Aucune tâche récurrente configurée</div>
            )}
            {recurringTasks.map(rt => (
              <div key={rt.id} className={`recurring-item ${rt.active ? '' : 'inactive'}`}>
                <div className="recurring-item-info">
                  <span className="recurring-item-title">{SECTIONS[rt.section]?.emoji || '📋'} {rt.title}</span>
                  <span className="recurring-item-meta">
                    {rt.recurrence === 'daily' && '🔄 Tous les jours'}
                    {rt.recurrence === 'weekly' && `🔄 Chaque ${DAYS_FR[rt.dayOfWeek] || ''}`}
                    {rt.recurrence === 'monthly' && `🔄 Le ${rt.dayOfMonth} de chaque mois`}
                    {rt.time && ` à ${rt.time}`}
                    {' · '}{SECTIONS[rt.section]?.label || rt.section}
                  </span>
                </div>
                <div className="recurring-item-actions">
                  <Tooltip content="Modifier"><Button variant="ghost" onClick={() => setRecurringForm({ ...rt })}><Edit2 size={14} /></Button></Tooltip>
                  <Tooltip content="Supprimer"><Button variant="ghost" className="delete" onClick={() => handleDeleteRecurring(rt.id)}><Trash2 size={14} /></Button></Tooltip>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contenu */}
      {loading ? (
        <div className="sections-container">
          <div className="empty-state">
            <ClipboardList size={48} />
            <p>Chargement…</p>
          </div>
        </div>
      ) : viewMode === 'week' ? (
        <div className="wk-split-layout">
          {/* ── Colonnes des jours ── */}
          <div className="wk-days-row">
            {weekDays.map(d => {
              const dt = new Date(d + 'T00:00:00');
              const dayLabel = dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
              const isToday = d === todayStr();
              const isExpanded = expandedWeekDay === d;
              const dayData = weekGroupedByDay?.[d] || { tasks: [], events: [], affaires: [], googleEvents: [] };
              const evCount = dayData.googleEvents.length + dayData.affaires.length + dayData.events.length;
              const taskCount = dayData.tasks.length;
              const _total = evCount + taskCount;

              return (
                <div key={d} className={`wk-day-col ${isToday ? 'today' : ''} ${isExpanded ? 'expanded' : ''}`}>
                  {/* En-tête cliquable */}
                  <div
                    className={`wk-col-header ${isToday ? 'today' : ''}`}
                    onClick={() => { setExpandedWeekDay(isExpanded ? null : d); setSelectedDate(d); }}
                    title={isExpanded ? 'Réduire' : 'Cliquer pour agrandir'}
                  >
                    <span className="wk-day-label">{dayLabel}</span>
                    <span className="wk-header-counts">
                      {evCount > 0 && <span className="wk-day-count ev">{evCount}</span>}
                      {taskCount > 0 && <span className="wk-day-count task">{taskCount}</span>}
                    </span>
                    <ChevronDown size={14} className={`wk-expand-chevron ${isExpanded ? 'open' : ''}`} />
                  </div>

                  {/* Contenu splitté en deux sections */}
                  <div className="wk-day-content">
                    {isExpanded ? (
                      <>
                        {/* ── Section Événements (expanded) ── */}
                        <div className="wk-section wk-section-events" style={{ flex: `${wkSplitRatio} 0 0` }}>
                          <div className="wk-section-label ev-label">📅 Événements</div>
                          {renderWeekDayExpandedEvents(d)}
                        </div>
                        {/* ── Séparateur draggable ── */}
                        <div className="wk-split-handle" onMouseDown={handleWkSplitMouseDown} title="Glisser pour redimensionner">
                          <div className="wk-split-handle-grip" />
                        </div>
                        {/* ── Section Tâches (expanded) ── */}
                        <div className="wk-section wk-section-tasks" style={{ flex: `${100 - wkSplitRatio} 0 0` }}>
                          <div className="wk-section-label task-label">📋 Tâches</div>
                          {renderWeekDayExpandedTasks(d)}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* ── Section Événements (compact) ── */}
                        <div className="wk-section wk-section-events" style={{ flex: `${wkSplitRatio} 0 0` }}>
                          <div className="wk-section-label ev-label">📅 Événements</div>
                          {dayData.googleEvents.length > 0 && (
                            <div className="wk-compact-group">
                              {dayData.googleEvents.map(ev => renderWeekMiniCard(ev, 'google'))}
                            </div>
                          )}
                          {dayData.affaires.length > 0 && (
                            <div className="wk-compact-group">
                              {dayData.affaires.map(a => renderWeekMiniCard(a, 'affaire'))}
                            </div>
                          )}
                          {dayData.events.length > 0 && (
                            <div className="wk-compact-group">
                              {dayData.events.map(ev => renderWeekMiniCard(ev, 'event'))}
                            </div>
                          )}
                          {evCount === 0 && <div className="wk-empty-mini">—</div>}
                        </div>

                        {/* ── Séparateur draggable ── */}
                        <div className="wk-split-handle" onMouseDown={handleWkSplitMouseDown} title="Glisser pour redimensionner">
                          <div className="wk-split-handle-grip" />
                        </div>

                        {/* ── Section Tâches (compact) ── */}
                        <div className="wk-section wk-section-tasks" style={{ flex: `${100 - wkSplitRatio} 0 0` }}>
                          <div className="wk-section-label task-label">📋 Tâches</div>
                          {(() => {
                            const grouped = {};
                            dayData.tasks.forEach(t => {
                              const sec = normalizeSection(t.section || 'manual');
                              if (!grouped[sec]) grouped[sec] = [];
                              grouped[sec].push(t);
                            });
                            return Object.keys(SECTIONS).map(secKey => {
                              const items = grouped[secKey];
                              if (!items || items.length === 0) return null;
                              const info = SECTIONS[secKey] || SECTIONS.manual;
                              return (
                                <div key={secKey} className="wk-compact-group">
                                  <div className="wk-task-group-label" style={{ color: info.color }}>
                                    <span>{info.emoji}</span> {info.label}
                                  </div>
                                  {items.map(t => renderWeekMiniCard(t, 'task'))}
                                </div>
                              );
                            });
                          })()}
                          {taskCount === 0 && <div className="wk-empty-mini">—</div>}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="sections-container">
          {/* En-tête de colonnes (sticky) */}
          <div className="tp-columns-header">
            <span className="ev-col-h ev-col-h-status">✔</span>
            <span className="ev-col-h ev-col-h-affaire">Affaire</span>
            <span className="ev-col-h ev-col-h-nom">Titre / Nom</span>
            <span className="ev-col-h ev-col-h-client">Client</span>
            <span className="ev-col-h ev-col-h-spacer"></span>
            <span className="ev-col-h ev-col-h-time">Heure</span>
            <span className="ev-col-h ev-col-h-actions">Actions</span>
          </div>
          {/* ── Autres Événements : tout en haut avec gestion iCal ── */}
          <div className="sections-group sections-top-events">
            {renderSection('evenements')}

            {showIcalManager && (
              <div className="ical-manager-panel">
                <div className="ical-manager-header">
                  <h5><Link size={14} /> Calendriers iCal</h5>
                  <Button variant="primary" size="sm" onClick={() => setIcalForm({ name: '', url: '', color: '#3b82f6' })}>
                    <Plus size={14} /> Ajouter
                  </Button>
                </div>

                {icalForm && (
                  <div className="ical-form">
                    <Input type="text" placeholder="Nom du calendrier" value={icalForm.name} onChange={e => setIcalForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                    <Input type="url" placeholder="URL iCal (.ics)" value={icalForm.url} onChange={e => setIcalForm(f => ({ ...f, url: e.target.value }))} />
                    <div className="ical-form-row">
                      <input type="color" value={icalForm.color || '#3b82f6'} onChange={e => setIcalForm(f => ({ ...f, color: e.target.value }))} title="Couleur" />
                      <div className="form-actions">
                        <Button variant="success" size="sm" iconOnly onClick={handleSaveIcal} aria-label="Enregistrer"><Check size={14} /></Button>
                        <Button variant="ghost" size="sm" iconOnly onClick={() => setIcalForm(null)} aria-label="Annuler"><X size={14} /></Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="ical-calendar-list">
                  {icalCalendars.length === 0 && !icalForm && (
                    <div className="ical-empty">Aucun calendrier iCal configuré</div>
                  )}
                  {icalCalendars.map(cal => (
                    <div key={cal.id} className={`ical-calendar-item ${cal.lastSyncError ? 'has-error' : ''}`}>
                      <span className="ical-color-dot" style={{ background: cal.color || '#3b82f6' }} />
                      <div className="ical-cal-info">
                        <span className="ical-cal-name">{cal.name}</span>
                        <span className="ical-cal-url" title={cal.url}>{cal.url.length > 50 ? cal.url.slice(0, 50) + '…' : cal.url}</span>
                        {cal.lastSyncError && (
                          <span className="ical-cal-error"><AlertCircle size={11} /> {cal.lastSyncError}</span>
                        )}
                      </div>
                      <div className="ical-cal-actions">
                        <Tooltip content="Modifier"><Button variant="ghost" onClick={() => setIcalForm({ ...cal })}><Edit2 size={13} /></Button></Tooltip>
                        <Tooltip content="Supprimer"><Button variant="ghost" className="delete" onClick={() => handleDeleteIcal(cal.id)}><Trash2 size={13} /></Button></Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RDV ── */}
          <div className="sections-group sections-events-group">
            {renderSection('rdv')}
          </div>

          <Divider label="Opérations & Tâches" style={{ margin: '18px 0 14px' }} />
          <div className="sections-group sections-ops-group">
            {OPS_SECTION_KEYS.map(renderSection)}
          </div>
        </div>
      )}

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
      {eventTaskModalEvent && (
        <EventTaskModal
          event={eventTaskModalEvent}
          existingTasks={tasks.filter(t => (t.sourceType === 'google_event' || t.sourceType === 'ical_event') && t.sourceId === eventTaskModalEvent.id)}
          onSave={(taskDate) => { setEventTaskModalEvent(null); if (taskDate && taskDate !== selectedDate) setSelectedDate(taskDate); else loadTasks(true); }}
          onDelete={() => { setEventTaskModalEvent(null); loadTasks(true); }}
          onClose={() => setEventTaskModalEvent(null)}
        />
      )}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          persons={persons}
          onSave={() => { setEditingTask(null); loadTasks(true); }}
          onClose={() => setEditingTask(null)}
        />
      )}
      {showAddTaskModal && (
        <AddTaskModal
          isOpen={showAddTaskModal}
          onClose={() => setShowAddTaskModal(false)}
          selectedDate={selectedDate}
          persons={persons}
          affaires={affaires}
          allAffaires={allAffaires}
          googleEvents={dayGoogleEvents}
          icalEvents={icalEvents}
          vehicles={vehicles}
          reservations={reservations}
          onTaskCreated={() => loadTasks(true)}
          loadVehiclesAndReservations={loadVehiclesAndReservations}
        />
      )}
    </div>
  );
}

export default React.memo(TaskPlanningPanel);