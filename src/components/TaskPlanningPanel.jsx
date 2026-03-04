import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import {
  ClipboardList, Plus, ChevronLeft, ChevronRight, ChevronDown, Check, X, Clock,
  User, Edit2, Trash2, FileDown, Briefcase, MapPin, AlertCircle,
  CalendarDays, LayoutList, Monitor, Calendar, UserPlus, Eye, EyeOff, Settings,
  Repeat, SkipForward, Link, RefreshCw, Palette
} from 'lucide-react';
import api from '../utils/api';
import { AFFAIRE_TYPE_INFO } from '../utils/affaireConstants';
import AffaireBadge from './AffaireBadge';
import { formatDateFr } from '../utils/formatUtils';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from '../hooks/useToast';
import EventTaskModal from './EventTaskModal';
import TaskEditModal from './TaskEditModal';
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

const STATUS_ORDER = ['pending', 'in_progress', 'done', 'cancelled'];

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
function TaskPlanningPanel({ currentUser, refreshKey, googleEvents = [], onNavigateToEntity }) {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [persons, setPersons] = useState([]);
  const [affaires, setAffaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Inline add form
  const [addingSection, setAddingSection] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPerson, setNewTaskPerson] = useState('');
  const [showPdfExport, setShowPdfExport] = useState(false);
  const [displayEvents, setDisplayEvents] = useState([]);
  // Personnel assignment popover for display events
  const [assigningEventId, setAssigningEventId] = useState(null);
  // RDV detail expansion
  const [expandedRdv, setExpandedRdv] = useState(null);
  // EventTaskModal
  const [eventTaskModalEvent, setEventTaskModalEvent] = useState(null);
  // TaskEditModal — édition individuelle d'une tâche
  const [editingTask, setEditingTask] = useState(null);

  // ── Tâches récurrentes ──
  const [showRecurring, setShowRecurring] = useState(false);
  const [recurringTasks, setRecurringTasks] = useState([]);
  const [recurringForm, setRecurringForm] = useState(null); // null = fermé, {} = nouveau, {id,...} = édition

  // ── Collapse sections ──
  const [collapsedSections, setCollapsedSections] = useState({});
  const toggleSectionCollapse = (key) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));

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
        p => p.type === 'permanent' && p.status !== 'inactive'
      );
      setPersons(permanents);
    } catch {
      setPersons([]);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks, refreshKey]);
  useEffect(() => { loadPersons(); }, [loadPersons]);

  // ── iCal : chargement des calendriers configurés ──
  const loadIcalCalendars = useCallback(async () => {
    try {
      const res = await api.getIcalCalendars();
      setIcalCalendars(res.calendars || []);
    } catch { setIcalCalendars([]); }
  }, []);

  // ── iCal : chargement des événements (fenêtre glissante ±1 semaine) ──
  const loadIcalEvents = useCallback(async () => {
    setIcalLoading(true);
    try {
      const today = todayStr();
      const from = addDays(today, -7);
      const to = addDays(today, 7);
      const res = await api.getIcalEvents({ dateFrom: from, dateTo: to });
      const events = (res.events || []).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
      setIcalEvents(events);
      if (res.syncErrors?.length) {
        res.syncErrors.forEach(e => toast.warning(`iCal: ${e}`));
      }
    } catch { setIcalEvents([]); }
    finally { setIcalLoading(false); }
  }, []);

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
    setConfirmDialog({
      title: 'Supprimer la tâche récurrente',
      message: 'Supprimer cette tâche récurrente ?',
      onConfirm: async () => {
        try { await api.deleteRecurringTask(id); toast.success('Supprimée'); loadRecurringTasks(); }
        catch { toast.error('Erreur suppression'); }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
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
    setConfirmDialog({
      title: 'Supprimer le calendrier',
      message: 'Supprimer ce calendrier iCal ?',
      onConfirm: async () => {
        try {
          await api.deleteIcalCalendar(id);
          toast.success('Calendrier supprimé');
          await loadIcalCalendars();
          loadIcalEvents();
        } catch { toast.error('Erreur suppression'); }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
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
    setConfirmDialog({
      title: 'Reporter les tâches',
      message: `Reporter les tâches non terminées du ${formatDateFr(selectedDate)} au lendemain ?`,
      onConfirm: async () => {
        try {
          const res = await api.rolloverTasks(selectedDate);
          toast.success(`${res.rolled || 0} tâche(s) reportée(s)`);
          loadTasks(true);
        } catch { toast.error('Erreur report'); }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
    });
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

  const eventsBySection = useMemo(() => {
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
  const mergedOtherEvents = useMemo(() => {
    const googleNorm = googleOtherEvents.map(ev => ({
      ...ev,
      _source: 'google',
      _sortKey: ev.start?.dateTime || ev.start?.date || '',
    }));
    const icalNorm = icalEvents.map(ev => ({
      ...ev,
      _source: 'ical',
      _sortKey: ev.start || '',
    }));
    return [...googleNorm, ...icalNorm].sort((a, b) => a._sortKey.localeCompare(b._sortKey));
  }, [googleOtherEvents, icalEvents]);

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
    return map;
  }, [viewMode, weekDays, tasks, unlinkedEvents, enrichedAffaires, filteredWeekGoogleEvents]);

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

  // Assigner un personnel à un événement d'affichage
  const handleAssignPerson = async (eventId, personId) => {
    try {
      await api.assignDisplayEvent(eventId, personId || null);
      toast.success('Personnel affecté');
      setAssigningEventId(null);
      loadTasks(true);
    } catch (err) {
      toast.error('Erreur affectation');
    }
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
    setConfirmDialog({
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
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  // Retirer un événement d'affichage de la planification
  const handleDeleteDisplayEvent = (id) => {
    setConfirmDialog({
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
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  // Add task inline
  const handleAddTask = async (section) => {
    if (!newTaskTitle.trim()) {
      toast.warning('Titre requis');
      return;
    }
    try {
      await api.createTask({
        date: selectedDate,
        period: 'AM',
        section,
        title: newTaskTitle.trim(),
        person_id: newTaskPerson || null,
        status: 'pending',
        source_type: 'manual',
      });
      toast.success('Tâche ajoutée');
      setNewTaskTitle('');
      setNewTaskPerson('');
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
    const isDone = task.status === 'done';
    const isProgress = task.status === 'in_progress';
    const isGoogle = task.sourceType === 'google_event';
    const isHidden = task.visible === 0;
    const dateBadge = getDateBadge(task.date);
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
    // 3. Retirer le N° d'affaire du titre (déjà affiché en badge)
    if (affaireNum) {
      const escaped = affaireNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      displayTitle = displayTitle.replace(new RegExp(escaped, 'gi'), '').replace(/\s{2,}/g, ' ').trim();
    }

    // 4. Enrichir avec le client/titre de l'affaire si le titre est trop générique
    const linkedAffaire = affaireNum ? affaireByNum.get(affaireNum.toUpperCase()) : null;
    const isGenericTitle = !displayTitle || /^(Location|Prestation|Vente|Installation|Livraison)\s*$/i.test(displayTitle);
    if (isGenericTitle && linkedAffaire) {
      const client = linkedAffaire.client || '';
      const titre = linkedAffaire.titre || linkedAffaire.eventName || '';
      displayTitle = client || titre || displayTitle || '-';
    } else if (linkedAffaire) {
      // Même titre non-générique : ajouter le client s'il n'apparaît pas déjà
      const client = linkedAffaire.client || '';
      if (client && !displayTitle.toLowerCase().includes(client.toLowerCase())) {
        displayTitle = `${displayTitle} — ${client}`;
      }
    }

    // --- Nettoyage du sous-titre (googleEventTitle) ---
    let cleanEventTitle = task.googleEventTitle || '';
    if (affaireNum && cleanEventTitle) {
      const escaped = affaireNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleanEventTitle = cleanEventTitle.replace(new RegExp(escaped, 'gi'), '').replace(/\s{2,}/g, ' ').trim();
    }
    // Si le titre affiche le client de l'affaire, montrer le titre/objet de l'affaire en sous-titre
    if (isGenericTitle && linkedAffaire) {
      const affaireTitre = linkedAffaire.titre || linkedAffaire.eventName || '';
      if (affaireTitre && affaireTitre.toLowerCase() !== displayTitle.toLowerCase()) {
        cleanEventTitle = affaireTitre;
      }
    }
    // Montrer le sous-titre uniquement s'il apporte une info différente du titre
    const showSubtitle = cleanEventTitle &&
      cleanEventTitle.toLowerCase().replace(/\s+/g, '') !== displayTitle.toLowerCase().replace(/\s+/g, '');

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
    const affaireNom = linkedAffaire?.nom || '';
    const affaireClient = linkedAffaire?.client || '';
    const displayNom = affaireNom || fullTitle;
    const displayClient = affaireClient;

    return (
      <div key={task.id} className={`task-row event-row-cols ${isGoogle ? 'google-task-row' : ''} ${isDone ? 'task-done-row' : ''} ${isHidden ? 'hidden-display' : ''}`}>
        <button
          className={`ev-col task-status-btn ${isDone ? 'done' : isProgress ? 'in-progress' : ''}`}
          onClick={() => cycleStatus(task)}
          title={`Statut: ${task.status} — cliquer pour changer`}
        >
          {isDone && <Check size={14} />}
          {isProgress && <Clock size={12} />}
        </button>

        <span className="ev-col ev-col-affaire">
          {affaireNum ? <AffaireBadge numero={affaireNum} type={linkedAffaire?.type} size="sm" onNavigate={onNavigateToEntity ? (num) => onNavigateToEntity('affaire', { numero: num }) : undefined} /> : null}
        </span>

        <span className={`ev-col ev-col-nom ${isDone ? 'done' : ''}`} title={[fullTitle, showEventType && task.eventType, (task.eventLocation || linkedAffaire?.location) && '📍 ' + (task.eventLocation || linkedAffaire?.location), task.notes && '📝 ' + task.notes, (task.personFirstName || task.personLastName) && '👤 ' + [task.personFirstName, task.personLastName].filter(Boolean).join(' ')].filter(Boolean).join('\n')}>
          {isGoogle && <span className="google-mini-badge" title="Google Calendar">G</span>}
          {displayNom}
        </span>

        <span className="ev-col ev-col-client" title={displayClient}>{displayClient}</span>

        <span className="ev-col ev-col-date">{dateBadge || ''}</span>

        <span className="ev-col ev-col-time">
          {task.time ? <><Clock size={11} /> {task.time}{task.endTime ? ` → ${task.endTime}` : ''}</> : task.period ? <span className="period-badge">{task.period}</span> : ''}
        </span>

        <div className="task-actions">
          <button
            className={`toggle-visible ${isHidden ? 'off' : ''}`}
            onClick={() => handleToggleTaskVisible(task)}
            title={isHidden ? 'Afficher sur l\'écran' : 'Masquer de l\'écran'}
          >
            {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            className="edit"
            onClick={() => setEditingTask(task)}
            title="Modifier cette tâche"
          >
            <Edit2 size={14} />
          </button>
          <button className="delete" onClick={() => handleDelete(task.id)} title="Supprimer">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  const renderDisplayEventRow = (event) => {
    const typeInfo = EVENT_TYPES[event.type] || { label: event.type, emoji: '📌', color: 'var(--theme-text-secondary)' };
    const isPrep = event.type === 'preparation';
    const isHidden = event.visible === 0;
    const dateBadge = getDateBadge(event.date);

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

    return (
      <div key={`de-${event.id}`} className={`task-row event-row-cols display-event-row ${isHidden ? 'hidden-display' : ''}`}>
        <span className="ev-col ev-col-dot" style={{ color: typeInfo.color }}>
          <Monitor size={14} />
        </span>

        <span className="ev-col ev-col-affaire">
          {affaireNum ? <AffaireBadge numero={affaireNum} type={affaireTypeResolved} size="sm" onNavigate={onNavigateToEntity ? (num) => onNavigateToEntity('affaire', { numero: num }) : undefined} /> : null}
        </span>

        <span className="ev-col ev-col-nom" title={[displayName, event.location && '📍 ' + event.location, event.comment && '📝 ' + event.comment].filter(Boolean).join('\n')}>
          {!isTypeRedundant && <>{typeInfo.emoji} </>}
          {displayName}
        </span>

        <span className="ev-col ev-col-client" title={affaireClient}>{affaireClient}</span>

        <span className="ev-col ev-col-date">{dateBadge || ''}</span>

        <span className="ev-col ev-col-time">
          {event.time ? <><Clock size={11} /> {event.time}</> : event.period ? <span className="period-badge">{event.period}</span> : ''}
        </span>

        {/* Affectation personnel (préparations) */}
        {isPrep && (
          <div className="event-assign-container">
            {event.assigned_person_first_name ? (
              <span className="task-person assigned" onClick={() => setAssigningEventId(assigningEventId === event.id ? null : event.id)}>
                <User size={12} />
                {event.assigned_person_first_name} {event.assigned_person_last_name?.charAt(0)}.
              </span>
            ) : (
              <button className="btn-assign" onClick={() => setAssigningEventId(assigningEventId === event.id ? null : event.id)} title="Affecter un personnel">
                <UserPlus size={13} />
              </button>
            )}
            {assigningEventId === event.id && (
              <div className="assign-dropdown">
                <div className="assign-dropdown-title">Affecter à :</div>
                {event.assigned_person_id && (
                  <div className="assign-option unassign" onClick={() => handleAssignPerson(event.id, null)}>
                    <X size={12} /> Retirer l'affectation
                  </div>
                )}
                {persons.map(p => (
                  <div key={p.id} className="assign-option" onClick={() => handleAssignPerson(event.id, p.id)}>
                    <User size={12} /> {p.firstName || p.prenom} {p.lastName || p.nom}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="task-actions">
          <button
            className={`toggle-visible ${isHidden ? 'off' : ''}`}
            onClick={() => handleToggleDisplayEventVisible(event)}
            title={isHidden ? 'Afficher sur l\'écran' : 'Masquer de l\'écran'}
          >
            {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button className="delete" onClick={() => handleDeleteDisplayEvent(event.id)} title="Retirer">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  // Masquer une affaire de la planification
  const handleHideAffaire = (affaire) => {
    setConfirmDialog({
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
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  // Carte affaire dans une section — layout colonnes aligné
  const renderAffaireRow = (affaire) => {
    const typeInfo = AFFAIRE_TYPE_INFO[affaire.type] || { label: affaire.type || 'Affaire', emoji: '📋', color: 'var(--theme-text-secondary)' };
    const dateBadge = getDateBadge(affaire.dateDebut || affaire.date_debut);
    const isProcessed = affaire._googleId
      ? processedGoogleIds.has(affaire._googleId)
      : processedGoogleIds.has(`affaire-${affaire.id || affaire.numeroAffaire}`);
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
      affaire.blCount > 0 && `📄 ${affaire.blCount} BL`,
    ].filter(Boolean).join('\n');

    return (
      <div
        key={`aff-${affaire.numeroAffaire}`}
        className={`task-row event-row-cols affaire-row ${isProcessed ? 'processed' : 'pending'} ${affaire._linkedGoogleEvent ? 'google-linked' : ''}`}
        onClick={() => openAffaireTaskModal(affaire)}
        style={{ cursor: 'pointer' }}
      >
        <span className="ev-col ev-col-dot" style={{ color: typeInfo.color }}>
          <Briefcase size={14} />
        </span>

        <span className="ev-col ev-col-affaire">
          <AffaireBadge numero={affaire.numeroAffaire} type={affaire.type} size="sm" onNavigate={onNavigateToEntity ? (num) => { /* stop propagation handled by AffaireBadge */ onNavigateToEntity('affaire', { numero: num }); } : undefined} />
        </span>

        <span className="ev-col ev-col-nom" title={tooltipParts} style={{ cursor: 'pointer' }}>
          {displayNom}
          {affaire._linkedGoogleEvent && <span className="google-linked-badge" title="Lié à un événement Google Calendar">G</span>}
          {isProcessed && <span className="processed-badge" title="Tâches définies">✓</span>}
        </span>

        <span className="ev-col ev-col-client" title={displayClient}>{displayClient}</span>

        <span className="ev-col ev-col-date">{dateBadge || ''}</span>

        <span className="ev-col ev-col-time">
          {timeStr ? <><Clock size={11} /> {timeStr}</> : ''}
        </span>

        <div className="task-actions">
          {!isProcessed && (
            <button className="task-status-btn" onClick={(e) => { e.stopPropagation(); openAffaireTaskModal(affaire); }} title="Définir les tâches pour cette affaire">
              <Plus size={14} />
            </button>
          )}
          {isProcessed && (
            <span className="task-status-btn done" title="Tâches déjà définies">
              <Check size={14} />
            </span>
          )}
          <button className="delete" onClick={(e) => { e.stopPropagation(); handleHideAffaire(affaire); }} title="Retirer de la planification">
            <X size={14} />
          </button>
        </div>
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
    const dayStr = startDT.includes('T')
      ? new Date(startDT).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
      : startDT ? new Date(startDT + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
    const location = event.location || '';
    const affaireMatch = summary.match(/\bAF\s*\d{4,}/i);
    const affaireNum = affaireMatch ? affaireMatch[0].toUpperCase().replace(/\s+/g, '') : '';
    const isProcessed = processedGoogleIds.has(event.id);
    const linkedTasks = tasksBySourceId.get(event.id) || [];
    const isLinking = linkingEvent?.id === event.id;
    // Retirer l'affaire du titre pour éviter la redondance
    let displaySummary = summary;
    if (affaireNum) {
      displaySummary = summary.replace(/\baf\s*\d{4,}/gi, '').replace(/^\s*[-—–:]\s*/, '').trim() || summary;
    }
    // Nom et Client de l'affaire liée
    const linkedAff = affaireNum ? affaireByNum.get(affaireNum.toUpperCase()) : null;
    const affaireNom = linkedAff?.nom || '';
    const affaireClient = linkedAff?.client || '';
    const displayNom = affaireNom || displaySummary;

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
        className={`task-row event-row-cols google-rdv-row ${isProcessed ? 'processed' : 'pending'}`}
      >
        <span className="ev-col ev-col-dot" style={{ color: isProcessed ? '#10b981' : '#4285f4', cursor: 'pointer' }} onClick={() => setEventTaskModalEvent(event)}>
          <Calendar size={14} />
        </span>
        <span className="ev-col ev-col-affaire">
          {affaireNum ? <AffaireBadge numero={affaireNum} type={linkedAff?.type} size="sm" onNavigate={onNavigateToEntity ? (num) => onNavigateToEntity('affaire', { numero: num }) : undefined} /> : null}
        </span>
        <span className="ev-col ev-col-nom" title={[displayNom, displaySummary !== displayNom && displaySummary, location && '📍 ' + location].filter(Boolean).join('\n')} style={{ cursor: 'pointer' }} onClick={() => setEventTaskModalEvent(event)}>{displayNom}</span>
        <span className="ev-col ev-col-client" title={affaireClient}>{affaireClient}</span>
        <span className="ev-col ev-col-date">{dayStr}</span>
        <span className="ev-col ev-col-time"><Clock size={11} /> {timeStr}</span>
        <div className="task-actions">
          <span className="google-badge" title="Google Calendar">G</span>
          <span className={`ev-col ev-col-status google-status-badge ${isProcessed ? 'done' : 'pending'}`}>
            {isProcessed ? '✓' : '⚙'}
          </span>
          {!affaireNum && (
            <button
              className={`btn-link-affaire ${isLinking ? 'active' : ''}`}
              title="Lier à une affaire"
              onClick={(e) => { e.stopPropagation(); setLinkingEvent(isLinking ? null : event); setLinkSearchQuery(''); }}
            >
              <Link size={13} />
            </button>
          )}
        </div>
        {/* Mini-badges des tâches créées depuis cet événement */}
        {linkedTasks.length > 0 && (
          <div className="event-linked-tasks">
            {linkedTasks.map(t => {
              const isDone = t.status === 'done';
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
              <button className="link-popover-close" onClick={() => { setLinkingEvent(null); setLinkSearchQuery(''); }}>
                <X size={14} />
              </button>
            </div>
            <input
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
              <button
                className="link-option link-option-create"
                onClick={() => {
                  const num = linkSearchQuery.toUpperCase().replace(/\s+/g, '').trim();
                  handleManualLink(event, num);
                }}
              >
                ➕ Créer & lier <strong>{linkSearchQuery.toUpperCase().replace(/\s+/g, '').trim()}</strong>
              </button>
            )}
            {linkableAffaires.length > 0 && (
              <div className="link-options-list">
                {linkableAffaires.map(a => (
                  <button
                    key={a.id || a.numeroAffaire}
                    className="link-option"
                    onClick={() => handleManualLink(event, a.numeroAffaire)}
                  >
                    <AffaireBadge numero={a.numeroAffaire} type={a.type} size="sm" />
                    <span className="link-option-client">{a.client || 'Sans client'}</span>
                  </button>
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
    const dateBadge = getDateBadge(affaire.dateDebut || affaire.date_debut);
    const displayNom = affaire.nom || affaire.event_name || affaire.titre || affaire.client || typeInfo.label;
    const displayClient = affaire.client || '';
    const linkedAff = affaire.numeroAffaire ? affaireByNum.get(affaire.numeroAffaire.toUpperCase()) : null;
    const tooltipParts = [
      displayNom,
      (affaire.titre || affaire.event_name) && (affaire.event_name || affaire.titre),
      affaire.adresseLivraison && '📍 ' + affaire.adresseLivraison.split('\n')[0],
      affaire.interlocuteur && '👤 ' + affaire.interlocuteur,
      affaire.tel && '📞 ' + affaire.tel,
    ].filter(Boolean).join('\n');

    return (
      <div key={`rdv-${affaire.numeroAffaire}`} className="task-row event-row-cols rdv-row" style={{ flexWrap: 'wrap' }}>
        <span className="ev-col ev-col-dot" style={{ color: typeInfo.color }}>
          <Calendar size={14} />
        </span>

        <span className="ev-col ev-col-affaire">
          <AffaireBadge numero={affaire.numeroAffaire} type={affaire.type} size="sm" onNavigate={onNavigateToEntity ? (num) => onNavigateToEntity('affaire', { numero: num }) : undefined} />
        </span>

        <span className="ev-col ev-col-nom" title={tooltipParts}>{displayNom}</span>

        <span className="ev-col ev-col-client" title={displayClient}>{displayClient}</span>

        <span className="ev-col ev-col-date">{dateBadge || ''}</span>

        <span className="ev-col ev-col-time"></span>

        <div className="task-actions rdv-actions">
          <button className="btn-rdv-view" onClick={() => setExpandedRdv(isExpanded ? null : affaire.numeroAffaire)} title="Voir détails">
            <Eye size={14} />
          </button>
        </div>
        {isExpanded && (
          <div className="rdv-detail-card">
            <div className="rdv-detail-row"><strong>Client :</strong> {affaire.client || '—'}</div>
            <div className="rdv-detail-row"><strong>Interlocuteur :</strong> {affaire.interlocuteur || '—'}</div>
            <div className="rdv-detail-row"><strong>Tél :</strong> {affaire.tel || '—'}</div>
            <div className="rdv-detail-row"><strong>Adresse :</strong> {affaire.adresseLivraison?.split('\n').join(', ') || '—'}</div>
            {affaire.titre && <div className="rdv-detail-row"><strong>Titre :</strong> {affaire.titre}</div>}
            {affaire.devis && <div className="rdv-detail-row"><strong>Devis :</strong> {affaire.devis}</div>}
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
    const dayStr = startDT.includes('T')
      ? new Date(startDT).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
      : startDT ? new Date(startDT + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
    const isProcessed = processedGoogleIds.has(event.id);
    const linkedTasks = tasksBySourceId.get(event.id) || [];
    const icalAffaireMatch = (event.summary || '').match(/\bAF\s*\d{4,}/i);
    const affaireNum = icalAffaireMatch ? icalAffaireMatch[0].toUpperCase().replace(/\s+/g, '') : '';
    const isLinking = linkingEvent?.id === event.id;
    let displaySummary = event.summary || 'Événement';
    if (affaireNum) {
      displaySummary = displaySummary.replace(/\baf\s*\d{4,}/gi, '').replace(/^\s*[-—–:]\s*/, '').trim() || displaySummary;
    }
    // Nom et Client de l'affaire liée
    const linkedAff = affaireNum ? affaireByNum.get(affaireNum.toUpperCase()) : null;
    const affaireNom = linkedAff?.nom || '';
    const affaireClient = linkedAff?.client || '';
    const displayNom = affaireNom || displaySummary;

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
        className={`task-row event-row-cols ical-event-row ${isProcessed ? 'processed' : 'pending'}`}
      >
        <span className="ev-col ev-col-dot" onClick={() => setEventTaskModalEvent(icalToGoogleLike(event))} style={{ cursor: 'pointer' }}>
          <span className="ical-color-dot" style={{ background: event.calendarColor || '#3b82f6' }} />
        </span>
        <span className="ev-col ev-col-affaire">
          {affaireNum ? <AffaireBadge numero={affaireNum} type={linkedAff?.type} size="sm" onNavigate={onNavigateToEntity ? (num) => onNavigateToEntity('affaire', { numero: num }) : undefined} /> : null}
        </span>
        <span className="ev-col ev-col-nom" title={[displayNom, displaySummary !== displayNom && displaySummary, event.location && '📍 ' + event.location].filter(Boolean).join('\n')} onClick={() => setEventTaskModalEvent(icalToGoogleLike(event))} style={{ cursor: 'pointer' }}>{displayNom}</span>
        <span className="ev-col ev-col-client" title={affaireClient}>{affaireClient}</span>
        <span className="ev-col ev-col-date">{dayStr}</span>
        <span className="ev-col ev-col-time"><Clock size={11} /> {timeStr}</span>
        <div className="task-actions">
          <span className="ical-origin-badge" style={{ borderColor: event.calendarColor || '#3b82f6', color: event.calendarColor || '#3b82f6' }} title={event.calendarName}>
            {(event.calendarName || 'iCal').slice(0, 3)}
          </span>
          <span className={`ev-col ev-col-status google-status-badge ${isProcessed ? 'done' : 'pending'}`}>
            {isProcessed ? '✓' : '⚙'}
          </span>
          {!affaireNum && (
            <button
              className={`btn-link-affaire ${isLinking ? 'active' : ''}`}
              title="Lier à une affaire"
              onClick={(e) => { e.stopPropagation(); setLinkingEvent(isLinking ? null : event); setLinkSearchQuery(''); }}
            >
              <Link size={13} />
            </button>
          )}
        </div>
        {/* Mini-badges des tâches créées depuis cet événement iCal */}
        {linkedTasks.length > 0 && (
          <div className="event-linked-tasks">
            {linkedTasks.map(t => {
              const isDone = t.status === 'done';
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
              <button className="link-popover-close" onClick={() => { setLinkingEvent(null); setLinkSearchQuery(''); }}>
                <X size={14} />
              </button>
            </div>
            <input
              type="text"
              className="link-search-input"
              placeholder="Rechercher AF, client…"
              value={linkSearchQuery}
              onChange={(e) => setLinkSearchQuery(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Escape') { setLinkingEvent(null); setLinkSearchQuery(''); } }}
            />
            {linkSearchQuery.match(/^\s*AF\s*\d{4,}\s*$/i) && (
              <button
                className="link-option link-option-create"
                onClick={() => {
                  const num = linkSearchQuery.toUpperCase().replace(/\s+/g, '').trim();
                  handleManualLink(event, num);
                }}
              >
                ➕ Créer & lier <strong>{linkSearchQuery.toUpperCase().replace(/\s+/g, '').trim()}</strong>
              </button>
            )}
            {linkableAffaires.length > 0 && (
              <div className="link-options-list">
                {linkableAffaires.map(a => (
                  <button
                    key={a.id || a.numeroAffaire}
                    className="link-option"
                    onClick={() => handleManualLink(event, a.numeroAffaire)}
                  >
                    <AffaireBadge numero={a.numeroAffaire} type={a.type} size="sm" />
                    <span className="link-option-client">{a.client || 'Sans client'}</span>
                  </button>
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
      const isDone = item.status === 'done';
      const isProgress = item.status === 'in_progress';
      const sectionInfo = SECTIONS[normalizeSection(item.section || 'manual')] || SECTIONS.manual;
      return (
        <div
          key={`wt-${item.id}`}
          className={`wk-card wk-task ${isDone ? 'done' : ''} ${isProgress ? 'in-progress' : ''} ${item.visible === 0 ? 'hidden-display' : ''}`}
          style={{ borderLeftColor: sectionInfo.color }}
        >
          <button
            className={`wk-status ${isDone ? 'done' : isProgress ? 'in-progress' : ''}`}
            onClick={() => cycleStatus(item)}
          >
            {isDone && <Check size={10} />}
            {isProgress && <Clock size={10} />}
          </button>
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
            return (
              <span className="wk-task-info">
                <span className={`wk-title ${isDone ? 'done' : ''}`} title={`${an ? an + ' · ' : ''}${item.title}${eventLabel ? ' — ' + eventLabel : ''}`}>{cleaned}</span>
                {eventLabel && <span className="wk-event-label" title={eventLabel}>{eventLabel.length > 20 ? eventLabel.slice(0, 20) + '…' : eventLabel}</span>}
              </span>
            );
          })()}
          {(item.personFirstName) && (
            <span className="wk-person">{item.personFirstName?.charAt(0)}{item.personLastName?.charAt(0)}</span>
          )}
          <div className="wk-actions">
            <button onClick={() => setEditingTask(item)} title="Modifier">
              <Edit2 size={10} />
            </button>
            <button onClick={() => handleToggleTaskVisible(item)} title={item.visible === 0 ? 'Afficher' : 'Masquer'}>
              {item.visible === 0 ? <EyeOff size={10} /> : <Eye size={10} />}
            </button>
            <button className="del" onClick={() => handleDelete(item.id)} title="Supprimer">
              <Trash2 size={10} />
            </button>
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
            <button onClick={() => handleToggleDisplayEventVisible(item)} title={item.visible === 0 ? 'Afficher' : 'Masquer'}>
              {item.visible === 0 ? <EyeOff size={10} /> : <Eye size={10} />}
            </button>
            <button className="del" onClick={() => handleDeleteDisplayEvent(item.id)} title="Retirer">
              <Trash2 size={10} />
            </button>
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
            <button className="del" onClick={(e) => { e.stopPropagation(); handleHideAffaire(item); }} title="Retirer">
              <X size={10} />
            </button>
          </div>
        </div>
      );
    }
    if (type === 'google') {
      const summary = item.summary || 'Événement';
      const isProcessed = processedGoogleIds.has(item.id);
      const startDT = item.start?.dateTime || item.start?.date || '';
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

  // ── Colonne d'un jour (événements uniquement) ──
  const renderWeekEventCol = (dayStr) => {
    const dayData = weekGroupedByDay?.[dayStr] || { tasks: [], events: [], affaires: [], googleEvents: [] };
    const eventsCount = dayData.googleEvents.length + dayData.affaires.length + dayData.events.length;
    return (
      <div key={dayStr} className="wk-band-col">
        {eventsCount === 0 && <div className="wk-empty">—</div>}
        {dayData.googleEvents.map(ev => renderWeekMiniCard(ev, 'google'))}
        {dayData.affaires.map(a => renderWeekMiniCard(a, 'affaire'))}
        {dayData.events.map(ev => renderWeekMiniCard(ev, 'event'))}
      </div>
    );
  };

  // ── Colonne d'un jour (tâches groupées par section) ──
  const renderWeekTaskCol = (dayStr) => {
    const dayData = weekGroupedByDay?.[dayStr] || { tasks: [], events: [], affaires: [], googleEvents: [] };
    const tasksCount = dayData.tasks.length;
    if (tasksCount === 0) return <div key={dayStr} className="wk-band-col"><div className="wk-empty">—</div></div>;

    // Grouper par section en respectant l'ordre SECTIONS
    const grouped = {};
    dayData.tasks.forEach(t => {
      const sec = normalizeSection(t.section || 'manual');
      if (!grouped[sec]) grouped[sec] = [];
      grouped[sec].push(t);
    });
    const sectionOrder = Object.keys(SECTIONS);

    return (
      <div key={dayStr} className="wk-band-col">
        {sectionOrder.map(secKey => {
          const items = grouped[secKey];
          if (!items || items.length === 0) return null;
          const info = SECTIONS[secKey] || SECTIONS.manual;
          return (
            <div key={secKey} className="wk-task-group">
              <div className="wk-task-group-label" style={{ color: info.color }}>
                <span>{info.emoji}</span> {info.label}
              </div>
              {items.map(t => renderWeekMiniCard(t, 'task'))}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSection = (sectionKey) => {
    const info = SECTIONS[sectionKey];
    const sectionTasks = grouped[sectionKey] || [];
    const sectionEvents = eventsBySection[sectionKey] || [];
    const sectionAffaires = affairesBySection[sectionKey] || [];
    const isRdv = sectionKey === 'rdv';
    const isEvenements = sectionKey === 'evenements';
    const isAffaireOnly = !!info.affaireOnly;
    const googleRdvCount = isRdv ? googleRdvEvents.length : 0;
    const mergedCount = isEvenements ? mergedOtherEvents.length : 0;
    const totalCount = sectionTasks.length + sectionEvents.length + sectionAffaires.length + googleRdvCount + mergedCount;

    // Masquer les sections vides SAUF rdv (toujours visible)
    if (totalCount === 0 && !isRdv) return null;

    const isCollapsible = isEvenements;
    const isCollapsed = isCollapsible && collapsedSections[sectionKey];

    return (
      <div key={sectionKey} className={`task-section ${isRdv ? 'rdv-section' : ''} ${isEvenements ? 'evenements-section' : ''} ${isCollapsed ? 'section-collapsed' : ''}`}>
        <div
          className={`section-header ${isCollapsible ? 'collapsible' : ''}`}
          style={{ borderBottomColor: info.color }}
          onClick={isCollapsible ? () => toggleSectionCollapse(sectionKey) : undefined}
        >
          <h4>
            {isCollapsible && <ChevronDown size={16} className={`section-chevron ${isCollapsed ? 'collapsed' : ''}`} />}
            <span>{info.emoji}</span>
            {info.label}
          </h4>
          <span className="section-count">{totalCount}</span>
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
          const todayDate = todayStr();
          // Déterminer si un événement est "du jour" ou "en cours"
          const isEventToday = (ev) => {
            const start = ev._source === 'ical' ? (ev.start || '') : (ev.start?.dateTime || ev.start?.date || '');
            const end = ev._source === 'ical' ? (ev.end || '') : (ev.end?.dateTime || ev.end?.date || '');
            const startDate = start.slice(0, 10);
            const evStart = start ? new Date(start.includes('T') ? start : start + 'T00:00:00') : null;
            const evEnd = end ? new Date(end.includes('T') ? end : end + 'T23:59:59') : null;
            const isToday = startDate === todayDate;
            const isOngoing = evStart && evEnd && evStart <= now && now <= evEnd;
            return isToday || isOngoing;
          };
          // Séparer en groupes contigus : today/ongoing vs autres
          const groups = [];
          let currentGroup = null;
          mergedOtherEvents.forEach((ev, i) => {
            const today = isEventToday(ev);
            if (!currentGroup || currentGroup.isToday !== today) {
              currentGroup = { isToday: today, events: [] };
              groups.push(currentGroup);
            }
            currentGroup.events.push(ev);
          });
          return groups.map((group, gi) => {
            const items = group.events.map(ev =>
              ev._source === 'ical' ? renderIcalEventRow(ev) : renderGoogleRdvRow(ev)
            );
            if (group.isToday) {
              return <div key={`today-group-${gi}`} className="events-today-group">{items}</div>;
            }
            return <React.Fragment key={`other-group-${gi}`}>{items}</React.Fragment>;
          });
        })()}

        {/* Sections non-RDV : affaires + événements + tâches */}
        {!isRdv && sectionAffaires.map(renderAffaireRow)}
        {!isRdv && (() => {
          // Filtrer les display events redondants avec les affaires déjà affichées
          const affaireNums = new Set(sectionAffaires.map(a => a.numeroAffaire).filter(Boolean));
          const affaireIds = new Set(sectionAffaires.map(a => String(a.id)).filter(Boolean));
          const filteredEvents = sectionEvents
            .filter(ev => {
              if (ev.affaireId && (affaireNums.has(ev.affaireId) || affaireIds.has(String(ev.affaireId)))) return false;
              if (ev.affaire_id && (affaireNums.has(ev.affaire_id) || affaireIds.has(String(ev.affaire_id)))) return false;
              return true;
            });
          // Filtrer les tâches redondantes : tâches source_type=affaire dont l'affaire est déjà visible
          const filteredTasks = sectionTasks.filter(t => {
            if (t.sourceType === 'affaire' && t.sourceId) {
              if (affaireIds.has(String(t.sourceId))) return false;
              // Vérifier aussi par numéro d'affaire
              const taskAffNum = t.affaireNum || extractAffaireNum(t.title) || extractAffaireNum(t.googleEventTitle);
              if (taskAffNum && affaireNums.has(taskAffNum.toUpperCase())) return false;
            }
            return true;
          });
          return (
            <>
              {filteredEvents.map(renderDisplayEventRow)}
              {filteredTasks.map(renderTaskRow)}
            </>
          );
        })()}

        {/* Bouton Ajouter une tâche : masqué pour les sections réservées aux affaires */}
        {!isAffaireOnly && (addingSection === sectionKey ? (
          <div className="task-form-inline">
            <input
              type="text"
              placeholder="Titre de la tâche..."
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddTask(sectionKey);
                if (e.key === 'Escape') setAddingSection(null);
              }}
            />
            <select value={newTaskPerson} onChange={e => setNewTaskPerson(e.target.value)}>
              <option value="">— Responsable —</option>
              {persons.map(p => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
            <div className="form-actions">
              <button className="btn-confirm" onClick={() => handleAddTask(sectionKey)} title="Ajouter">
                <Check size={14} />
              </button>
              <button className="btn-cancel" onClick={() => setAddingSection(null)} title="Annuler">
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="add-task-inline" onClick={() => {
            setAddingSection(sectionKey);
            setNewTaskTitle('');
            setNewTaskPerson('');
          }}>
            <Plus size={14} /> Ajouter une tâche
          </div>
        ))}
        </>}
      </div>
    );
  };

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'done').length;

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

  // Format date court pour le mode semaine
  const getDateBadge = (dateStr) => {
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
            <button
              className={viewMode === 'day' ? 'active' : ''}
              onClick={() => setViewMode('day')}
              title="Vue jour"
            >
              <LayoutList size={15} /> Jour
            </button>
            <button
              className={viewMode === 'week' ? 'active' : ''}
              onClick={() => setViewMode('week')}
              title="Vue semaine"
            >
              <CalendarDays size={15} /> Semaine
            </button>
          </div>

          <div className="tp-date-nav">
            <button onClick={() => setSelectedDate(d => addDays(d, viewMode === 'week' ? -7 : -1))}>
              <ChevronLeft size={16} />
            </button>
            <span className="tp-current-date" onClick={() => setSelectedDate(todayStr())} title="Aujourd'hui">
              {viewMode === 'week'
                ? `${formatDateShort(weekDays[0])} → ${formatDateShort(weekDays[6])}`
                : formatDateFr(selectedDate)}
            </span>
            <button onClick={() => setSelectedDate(d => addDays(d, viewMode === 'week' ? 7 : 1))}>
              <ChevronRight size={16} />
            </button>
          </div>
          {totalTasks > 0 && (
            <span style={{ fontSize: '0.82rem', color: 'var(--theme-text-secondary)' }}>
              {doneTasks}/{totalTasks} terminée{doneTasks > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="tp-toolbar-right">
          <button className="btn-toolbar-action" onClick={handleRollover} title="Reporter les tâches non terminées au lendemain">
            <SkipForward size={16} /> Reporter
          </button>
          <button className="btn-toolbar-action" onClick={handleGenerateRecurring} title="Générer les tâches récurrentes pour ce jour">
            <Repeat size={16} /> Générer
          </button>
          <button className={`btn-toolbar-action ${showRecurring ? 'active' : ''}`} onClick={() => setShowRecurring(v => !v)} title="Gérer les tâches récurrentes">
            <Settings size={16} /> Récurrentes
          </button>
          <button className="btn-export-pdf" onClick={handleExportPdf} title="Exporter la fiche de tâches en PDF">
            <FileDown size={16} /> PDF
          </button>
        </div>
      </div>

      {/* ═══ Panneau Tâches Récurrentes ═══ */}
      {showRecurring && (
        <div className="recurring-panel">
          <div className="recurring-panel-header">
            <h3><Repeat size={18} /> Tâches Récurrentes</h3>
            <button className="btn-add-recurring" onClick={() => setRecurringForm({ title: '', section: 'manual', recurrence: 'daily', dayOfWeek: 1, dayOfMonth: 1, time: '08:00', period: 'AM', notes: '' })}>
              <Plus size={14} /> Ajouter
            </button>
          </div>

          {/* Formulaire création/édition */}
          {recurringForm && (
            <div className="recurring-form">
              <div className="recurring-form-row">
                <input type="text" placeholder="Titre de la tâche..." value={recurringForm.title || ''} onChange={e => setRecurringForm(f => ({ ...f, title: e.target.value }))} autoFocus />
                <select value={recurringForm.section || 'manual'} onChange={e => setRecurringForm(f => ({ ...f, section: e.target.value }))}>
                  {Object.entries(SECTIONS).filter(([, v]) => !v.affaireOnly).map(([k, v]) => (
                    <option key={k} value={k}>{v.emoji} {v.label}</option>
                  ))}
                </select>
              </div>
              <div className="recurring-form-row">
                <select value={recurringForm.recurrence || 'daily'} onChange={e => setRecurringForm(f => ({ ...f, recurrence: e.target.value }))}>
                  <option value="daily">Journalière</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuelle</option>
                </select>
                {recurringForm.recurrence === 'weekly' && (
                  <select value={recurringForm.dayOfWeek ?? 1} onChange={e => setRecurringForm(f => ({ ...f, dayOfWeek: parseInt(e.target.value) }))}>
                    {DAYS_FR.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                )}
                {recurringForm.recurrence === 'monthly' && (
                  <select value={recurringForm.dayOfMonth ?? 1} onChange={e => setRecurringForm(f => ({ ...f, dayOfMonth: parseInt(e.target.value) }))}>
                    {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                  </select>
                )}
                <input type="time" value={recurringForm.time || '08:00'} onChange={e => setRecurringForm(f => ({ ...f, time: e.target.value }))} />
                <select value={recurringForm.period || 'AM'} onChange={e => setRecurringForm(f => ({ ...f, period: e.target.value }))}>
                  <option value="AM">Matin</option>
                  <option value="PM">Après-midi</option>
                </select>
              </div>
              <div className="recurring-form-row">
                <input type="text" placeholder="Notes (optionnel)" value={recurringForm.notes || ''} onChange={e => setRecurringForm(f => ({ ...f, notes: e.target.value }))} />
                <div className="form-actions">
                  <button className="btn-confirm" onClick={handleSaveRecurring}><Check size={14} /></button>
                  <button className="btn-cancel" onClick={() => setRecurringForm(null)}><X size={14} /></button>
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
                  <button onClick={() => setRecurringForm({ ...rt })} title="Modifier"><Edit2 size={14} /></button>
                  <button className="delete" onClick={() => handleDeleteRecurring(rt.id)} title="Supprimer"><Trash2 size={14} /></button>
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
          {/* ── En-têtes des jours (partagés) ── */}
          <div className="wk-day-headers">
            {weekDays.map(d => {
              const dt = new Date(d + 'T00:00:00');
              const dayLabel = dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
              const isToday = d === todayStr();
              const dayData = weekGroupedByDay?.[d] || { tasks: [], events: [], affaires: [], googleEvents: [] };
              const total = dayData.tasks.length + dayData.googleEvents.length + dayData.affaires.length + dayData.events.length;
              return (
                <div key={d} className={`wk-col-header ${isToday ? 'today' : ''}`}>
                  <span className="wk-day-label">{dayLabel}</span>
                  {total > 0 && <span className="wk-day-count">{total}</span>}
                </div>
              );
            })}
          </div>

          {/* ── Bande haute : Événements ── */}
          <div className="wk-band wk-band-events">
            <div className="wk-band-label">📅 Événements</div>
            <div className="wk-band-grid">
              {weekDays.map(d => renderWeekEventCol(d))}
            </div>
          </div>

          {/* ── Bande basse : Tâches ── */}
          <div className="wk-band wk-band-tasks">
            <div className="wk-band-label">✅ Tâches</div>
            <div className="wk-band-grid">
              {weekDays.map(d => renderWeekTaskCol(d))}
            </div>
          </div>
        </div>
      ) : (
        <div className="sections-container">
          {/* ── Autres Événements : tout en haut avec gestion iCal ── */}
          <div className="sections-group sections-top-events">
            {renderSection('evenements')}

            {/* Gestion des calendriers iCal */}
            <div className="ical-manager-bar">
              <button className="ical-manage-btn" onClick={() => setShowIcalManager(v => !v)}>
                <Link size={13} /> Calendriers iCal ({icalCalendars.length})
              </button>
              <button className="ical-refresh-btn" onClick={() => { loadIcalCalendars(); loadIcalEvents(); }} title="Rafraîchir les événements iCal">
                <RefreshCw size={13} className={icalLoading ? 'spinning' : ''} />
              </button>
            </div>

            {showIcalManager && (
              <div className="ical-manager-panel">
                <div className="ical-manager-header">
                  <h5><Link size={14} /> Calendriers iCal</h5>
                  <button className="btn-add-ical" onClick={() => setIcalForm({ name: '', url: '', color: '#3b82f6' })}>
                    <Plus size={14} /> Ajouter
                  </button>
                </div>

                {icalForm && (
                  <div className="ical-form">
                    <input type="text" placeholder="Nom du calendrier" value={icalForm.name} onChange={e => setIcalForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                    <input type="url" placeholder="URL iCal (.ics)" value={icalForm.url} onChange={e => setIcalForm(f => ({ ...f, url: e.target.value }))} />
                    <div className="ical-form-row">
                      <input type="color" value={icalForm.color || '#3b82f6'} onChange={e => setIcalForm(f => ({ ...f, color: e.target.value }))} title="Couleur" />
                      <div className="form-actions">
                        <button className="btn-confirm" onClick={handleSaveIcal}><Check size={14} /></button>
                        <button className="btn-cancel" onClick={() => setIcalForm(null)}><X size={14} /></button>
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
                        <button onClick={() => setIcalForm({ ...cal })} title="Modifier"><Edit2 size={13} /></button>
                        <button className="delete" onClick={() => handleDeleteIcal(cal.id)} title="Supprimer"><Trash2 size={13} /></button>
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

          <div className="sections-divider">
            <span>Opérations & Tâches</span>
          </div>
          <div className="sections-group sections-ops-group">
            {OPS_SECTION_KEYS.map(renderSection)}
          </div>
        </div>
      )}

      {confirmDialog && <ConfirmDialog {...confirmDialog} />}
      {showPdfExport && (
        <Suspense fallback={null}>
          <TaskPDFExportModal
            date={selectedDate}
            tasks={tasks}
            affaires={affaires}
            displayEvents={displayEvents}
            googleRdvEvents={googleRdvEvents}
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
    </div>
  );
}

export default TaskPlanningPanel;