import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  ClipboardList, Plus, ChevronLeft, ChevronRight, Check, X, Clock,
  User, Edit2, Trash2, FileDown, Briefcase, MapPin, AlertCircle,
  CalendarDays, LayoutList, Monitor, Calendar, UserPlus, Eye, EyeOff, Settings
} from 'lucide-react';
import api from '../utils/api';
import { formatDateFr } from '../utils/formatUtils';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from '../hooks/useToast';
import EventTaskModal from './EventTaskModal';
import './TaskPlanningPanel.css';

const TaskPDFExportModal = lazy(() => import('./TaskPDFExportModal'));

// ═══ Constantes ═══
const SECTIONS = {
  rdv:                { label: 'Événements du jour',  emoji: '📅', color: '#059669' },
  prep_locations:     { label: 'Prépa Locations',    emoji: '📦', color: '#3b82f6' },
  prep_prestations:   { label: 'Prépa Prestations',  emoji: '🎤', color: '#f59e0b' },
  prep_ventes:        { label: 'Prépa Ventes',       emoji: '🏷️', color: '#10b981' },
  prep_installations: { label: 'Prépa Installations', emoji: '⚙️', color: '#8b5cf6' },
  taches_prioritaires:{ label: 'Tâches Prioritaires', emoji: '🔴', color: '#ef4444' },
  taches_secondaires: { label: 'Tâches Secondaires', emoji: '🟡', color: '#f59e0b' },
  courses:            { label: 'Courses',             emoji: '🚗', color: '#8b5cf6' },
  manual:             { label: 'Autres',              emoji: '📋', color: 'var(--theme-text-secondary)' },
};

const AFFAIRE_TYPE_INFO = {
  'Prestation':    { label: 'Prestation',    emoji: '🎭', color: '#f59e0b', section: 'prep_prestations' },
  'Location':      { label: 'Location',      emoji: '🏗️', color: '#3b82f6', section: 'prep_locations' },
  'Vente':         { label: 'Vente',         emoji: '💰', color: '#8b5cf6', section: 'prep_ventes' },
  'Installation':  { label: 'Installation',  emoji: '⚙️', color: '#10b981', section: 'prep_installations' },
};

const EVENT_TYPES = {
  preparation:  { label: 'Préparation',  emoji: '🔧', color: '#6366f1' },
  enlevement:   { label: 'Enlèvement',   emoji: '📦', color: '#f59e0b' },
  livraison:    { label: 'Livraison',     emoji: '🚚', color: '#10b981' },
  depart:       { label: 'Départ',        emoji: '🚀', color: '#3b82f6' },
  retour:       { label: 'Retour',        emoji: '↩️', color: '#8b5cf6' },
  recuperation: { label: 'Récupération',  emoji: '📥', color: '#ef4444' },
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
  if (['livraison', 'enlevement', 'depart'].includes(type)) return 'taches_prioritaires';
  if (['retour', 'recuperation'].includes(type)) return 'taches_secondaires';
  return 'manual';
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
function TaskPlanningPanel({ currentUser, refreshKey, googleEvents = [] }) {
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

  // Semaine : 7 jours à partir du lundi
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  // Load tasks + display events + affaires
  const loadTasks = useCallback(async () => {
    setLoading(true);
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
    } catch (err) {
      toast.error('Erreur chargement tâches');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, viewMode, weekDays, toast]);

  // Load persons for assignment
  const loadPersons = useCallback(async () => {
    try {
      const data = await api.getPersons();
      setPersons(Array.isArray(data) ? data : []);
    } catch {
      setPersons([]);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks, refreshKey]);
  useEffect(() => { loadPersons(); }, [loadPersons]);

  // Grouper par section
  const grouped = useMemo(() => {
    const groups = {};
    Object.keys(SECTIONS).forEach(key => { groups[key] = []; });
    tasks.forEach(t => {
      const sec = t.section || 'manual';
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

  // IDs Google event qui ont déjà des tâches créées
  const processedGoogleIds = useMemo(() =>
    new Set(tasks.filter(t => t.source_type === 'google_event' && t.source_id).map(t => t.source_id)),
    [tasks]
  );

  // googleRdvEvents = tous les events Google du jour/semaine (plus de filtre "rdv")
  const googleRdvEvents = useMemo(() => {
    return viewMode === 'week' ? weekGoogleEvents : dayGoogleEvents;
  }, [viewMode, weekGoogleEvents, dayGoogleEvents]);

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
    affaires.forEach(a => {
      const debut = a.dateDebut || a.date_debut || '';
      const fin = a.dateFin || a.date_fin || '';
      weekDays.forEach(d => {
        if (debut && debut <= d && (!fin || fin === '' || fin >= d)) {
          if (map[d]) map[d].affaires.push(a);
        }
      });
    });
    // Google events
    weekGoogleEvents.forEach(ev => {
      const evDate = (ev.start?.dateTime || ev.start?.date || '').slice(0, 10);
      if (map[evDate]) map[evDate].googleEvents.push(ev);
    });
    return map;
  }, [viewMode, weekDays, tasks, unlinkedEvents, affaires, weekGoogleEvents]);

  // Affaires groupées par section de préparation
  const affairesBySection = useMemo(() => {
    const groups = {};
    Object.keys(SECTIONS).forEach(k => { groups[k] = []; });
    affaires.forEach(a => {
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
  }, [affaires]);

  // Assigner un personnel à un événement d'affichage
  const handleAssignPerson = async (eventId, personId) => {
    try {
      await api.assignDisplayEvent(eventId, personId || null);
      toast.success('Personnel affecté');
      setAssigningEventId(null);
      loadTasks();
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
      loadTasks();
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
          loadTasks();
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
          loadTasks();
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
      loadTasks();
    } catch (err) {
      toast.error('Erreur création tâche');
    }
  };

  // Export PDF — ouvrir la modale d'export
  const handleExportPdf = () => {
    setShowPdfExport(true);
  };

  const renderTaskRow = (task) => {
    const isDone = task.status === 'done';
    const isProgress = task.status === 'in_progress';
    const isGoogle = task.source_type === 'google_event';
    const isHidden = task.visible === 0;
    const dateBadge = getDateBadge(task.date);

    return (
      <div key={task.id} className={`task-row ${isGoogle ? 'google-task-row' : ''} ${isHidden ? 'hidden-display' : ''}`}>
        <button
          className={`task-status-btn ${isDone ? 'done' : isProgress ? 'in-progress' : ''}`}
          onClick={() => cycleStatus(task)}
          title={`Statut: ${task.status} — cliquer pour changer`}
        >
          {isDone && <Check size={14} />}
          {isProgress && <Clock size={12} />}
        </button>

        <div className="task-info">
          <div className={`task-title ${isDone ? 'done' : ''}`}>
            {isGoogle && <span className="google-mini-badge" title="Google Calendar">G</span>}
            {dateBadge && <span className="date-badge">{dateBadge}</span>}
            {task.title}
          </div>
          <div className="task-meta">
            {task.time && (
              <span><Clock size={11} /> {task.time}{task.end_time ? ` → ${task.end_time}` : ''}</span>
            )}
            {task.affaire_num && (
              <span><Briefcase size={11} /> {task.affaire_num}</span>
            )}
            {task.google_event_title && (
              <span><Calendar size={11} /> {task.google_event_title}</span>
            )}
            {task.eventType && (
              <span><Briefcase size={11} /> {task.eventType}</span>
            )}
            {task.notes && (
              <span title={task.notes}>📝 {task.notes.slice(0, 40)}{task.notes.length > 40 ? '…' : ''}</span>
            )}
          </div>
        </div>

        {(task.personFirstName || task.personLastName) && (
          <span className="task-person">
            <User size={12} />
            {task.personFirstName} {task.personLastName?.charAt(0)}.
          </span>
        )}

        <div className="task-actions">
          <button
            className={`toggle-visible ${isHidden ? 'off' : ''}`}
            onClick={() => handleToggleTaskVisible(task)}
            title={isHidden ? 'Afficher sur l\'écran' : 'Masquer de l\'écran'}
          >
            {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          {isGoogle && task.source_id && (
            <button
              className="edit"
              onClick={() => {
                const ev = googleEvents.find(e => e.id === task.source_id);
                if (ev) setEventTaskModalEvent(ev);
              }}
              title="Modifier les tâches de cet événement"
            >
              <Edit2 size={14} />
            </button>
          )}
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
    return (
      <div key={`de-${event.id}`} className={`task-row display-event-row ${isHidden ? 'hidden-display' : ''}`}>
        <span className="display-event-icon" style={{ color: typeInfo.color }}>
          <Monitor size={14} />
        </span>
        <div className="task-info">
          <div className="task-title">
            {typeInfo.emoji} {dateBadge && <span className="date-badge">{dateBadge}</span>}
            {typeInfo.label}
            {event.client ? ` — ${event.client}` : ''}
            {event.affaireId ? ` (${event.affaireId})` : ''}
          </div>
          <div className="task-meta">
            {event.location && <span><MapPin size={11} /> {event.location}</span>}
            {event.time && <span><Clock size={11} /> {event.time}</span>}
            {event.comment && <span>📝 {event.comment.slice(0, 40)}{event.comment.length > 40 ? '…' : ''}</span>}
          </div>
        </div>

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
          loadTasks();
        } catch (err) {
          toast.error('Erreur masquage affaire');
        }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  // Carte affaire dans une section
  const renderAffaireRow = (affaire) => {
    const typeInfo = AFFAIRE_TYPE_INFO[affaire.type] || { label: affaire.type || 'Affaire', emoji: '📋', color: 'var(--theme-text-secondary)' };
    const dateBadge = getDateBadge(affaire.dateDebut || affaire.date_debut);
    return (
      <div key={`aff-${affaire.numeroAffaire}`} className="task-row affaire-row">
        <span className="display-event-icon" style={{ color: typeInfo.color }}>
          <Briefcase size={14} />
        </span>
        <div className="task-info">
          <div className="task-title">
            {typeInfo.emoji} {dateBadge && <span className="date-badge">{dateBadge}</span>}
            {affaire.numeroAffaire}
            {affaire.client ? ` — ${affaire.client}` : ''}
          </div>
          <div className="task-meta">
            {affaire.adresseLivraison && <span><MapPin size={11} /> {affaire.adresseLivraison.split('\n')[0]}</span>}
            {affaire.interlocuteur && <span><User size={11} /> {affaire.interlocuteur}</span>}
            {affaire.blCount > 0 && <span>📄 {affaire.blCount} BL</span>}
          </div>
        </div>
        <div className="task-actions">
          <button className="delete" onClick={() => handleHideAffaire(affaire)} title="Retirer de la planification">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  };

  // Carte Google Calendar — cliquable pour ouvrir EventTaskModal
  const renderGoogleRdvRow = (event) => {
    const summary = event.summary || 'Événement';
    const startDT = event.start?.dateTime || event.start?.date || '';
    const endDT = event.end?.dateTime || event.end?.date || '';
    const timeStr = startDT.includes('T')
      ? `${new Date(startDT).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${endDT ? ' → ' + new Date(endDT).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}`
      : 'Journée entière';
    const location = event.location || '';
    const affaireNum = (summary.match(/AF\d{4,}/i) || [''])[0];
    const isProcessed = processedGoogleIds.has(event.id);
    const isExpanded = expandedRdv === `gcal-${event.id}`;
    return (
      <div
        key={`gcal-rdv-${event.id}`}
        className={`task-row rdv-row google-rdv-row ${isProcessed ? 'processed' : 'pending'}`}
        onClick={() => setEventTaskModalEvent(event)}
        style={{ cursor: 'pointer' }}
      >
        <span className="display-event-icon" style={{ color: isProcessed ? '#10b981' : '#3b82f6' }}>
          <Calendar size={14} />
        </span>
        <div className="task-info">
          <div className="task-title">
            {affaireNum && <span className="affaire-tag">{affaireNum}</span>} {summary}
          </div>
          <div className="task-meta">
            <span><Clock size={11} /> {timeStr}</span>
            {location && <span><MapPin size={11} /> {location}</span>}
          </div>
        </div>
        <div className="task-actions rdv-actions">
          <span className={`google-status-badge ${isProcessed ? 'done' : 'pending'}`}>
            {isProcessed ? '✓ Planifié' : '⚙ Définir'}
          </span>
          <span className="google-badge" title="Google Calendar">G</span>
          <button className="btn-rdv-view" onClick={(e) => { e.stopPropagation(); setExpandedRdv(isExpanded ? null : `gcal-${event.id}`); }} title="Voir détails">
            <Eye size={14} />
          </button>
        </div>
        {isExpanded && (
          <div className="rdv-detail-card" onClick={e => e.stopPropagation()}>
            <div className="rdv-detail-row"><strong>Titre :</strong> {summary}</div>
            {affaireNum && <div className="rdv-detail-row"><strong>Affaire :</strong> {affaireNum}</div>}
            <div className="rdv-detail-row"><strong>Horaire :</strong> {timeStr}</div>
            {location && <div className="rdv-detail-row"><strong>Lieu :</strong> {location}</div>}
            {event.description && <div className="rdv-detail-row"><strong>Description :</strong> {event.description.slice(0, 200)}{event.description.length > 200 ? '…' : ''}</div>}
          </div>
        )}
      </div>
    );
  };

  // Carte RDV : affaire avec détails dépliables
  const renderRdvRow = (affaire) => {
    const typeInfo = AFFAIRE_TYPE_INFO[affaire.type] || { label: affaire.type || 'Affaire', emoji: '📋', color: 'var(--theme-text-secondary)' };
    const isExpanded = expandedRdv === affaire.numeroAffaire;
    return (
      <div key={`rdv-${affaire.numeroAffaire}`} className="task-row rdv-row">
        <span className="display-event-icon" style={{ color: typeInfo.color }}>
          <Calendar size={14} />
        </span>
        <div className="task-info">
          <div className="task-title">
            {typeInfo.emoji} {affaire.numeroAffaire} — {affaire.client || 'Sans client'}
          </div>
          <div className="task-meta">
            {affaire.adresseLivraison && <span><MapPin size={11} /> {affaire.adresseLivraison.split('\n')[0]}</span>}
            {affaire.interlocuteur && <span><User size={11} /> {affaire.interlocuteur}</span>}
            {affaire.tel && <span>📞 {affaire.tel}</span>}
            <span>📆 {affaire.dateDebut ? new Date(affaire.dateDebut + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}
              {affaire.dateFin ? ` → ${new Date(affaire.dateFin + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}
            </span>
          </div>
        </div>
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

  // ── Rendu compact d'une mini-carte pour la vue semaine ──
  const renderWeekMiniCard = (item, type) => {
    if (type === 'task') {
      const isDone = item.status === 'done';
      const isProgress = item.status === 'in_progress';
      const sectionInfo = SECTIONS[item.section] || SECTIONS.manual;
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
          <span className={`wk-title ${isDone ? 'done' : ''}`} title={item.title}>{item.title}</span>
          {(item.personFirstName) && (
            <span className="wk-person">{item.personFirstName?.charAt(0)}{item.personLastName?.charAt(0)}</span>
          )}
          <div className="wk-actions">
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
      return (
        <div
          key={`wa-${item.numeroAffaire}`}
          className="wk-card wk-affaire"
          style={{ borderLeftColor: typeInfo.color }}
        >
          <Briefcase size={10} style={{ color: typeInfo.color, flexShrink: 0 }} />
          <span className="wk-title" title={`${item.numeroAffaire}${item.client ? ' — ' + item.client : ''}`}>
            {typeInfo.emoji} {item.client || item.numeroAffaire}
          </span>
          <div className="wk-actions">
            <button className="del" onClick={() => handleHideAffaire(item)} title="Retirer">
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

  // ── Colonne d'un jour dans la vue semaine ──
  const renderWeekDayColumn = (dayStr) => {
    const dayData = weekGroupedByDay?.[dayStr] || { tasks: [], events: [], affaires: [], googleEvents: [] };
    const d = new Date(dayStr + 'T00:00:00');
    const dayLabel = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
    const isToday = dayStr === todayStr();
    const totalItems = dayData.tasks.length + dayData.events.length + dayData.affaires.length + dayData.googleEvents.length;

    return (
      <div key={dayStr} className={`wk-day-col ${isToday ? 'today' : ''}`}>
        <div className="wk-day-header">
          <span className="wk-day-label">{dayLabel}</span>
          {totalItems > 0 && <span className="wk-day-count">{totalItems}</span>}
        </div>
        <div className="wk-day-body">
          {totalItems === 0 && <div className="wk-empty">—</div>}
          {dayData.googleEvents.map(ev => renderWeekMiniCard(ev, 'google'))}
          {dayData.affaires.map(a => renderWeekMiniCard(a, 'affaire'))}
          {dayData.events.map(ev => renderWeekMiniCard(ev, 'event'))}
          {dayData.tasks.map(t => renderWeekMiniCard(t, 'task'))}
        </div>
      </div>
    );
  };

  const renderSection = (sectionKey) => {
    const info = SECTIONS[sectionKey];
    const sectionTasks = grouped[sectionKey] || [];
    const sectionEvents = eventsBySection[sectionKey] || [];
    const sectionAffaires = affairesBySection[sectionKey] || [];
    const isRdv = sectionKey === 'rdv';
    const googleRdvCount = isRdv ? googleRdvEvents.length : 0;
    const totalCount = sectionTasks.length + sectionEvents.length + sectionAffaires.length + googleRdvCount;

    return (
      <div key={sectionKey} className={`task-section ${isRdv ? 'rdv-section' : ''}`}>
        <div className="section-header" style={{ borderBottomColor: info.color }}>
          <h4>
            <span>{info.emoji}</span>
            {info.label}
          </h4>
          <span className="section-count">{totalCount}</span>
        </div>

        {/* Section RDV : Google Calendar RDV + affaires avec "rdv" dans le titre */}
        {isRdv && googleRdvEvents.map(renderGoogleRdvRow)}
        {isRdv && sectionAffaires.map(renderRdvRow)}

        {/* Sections non-RDV : affaires + événements + tâches */}
        {!isRdv && sectionAffaires.map(renderAffaireRow)}
        {!isRdv && sectionEvents.map(renderDisplayEventRow)}
        {sectionTasks.map(renderTaskRow)}

        {addingSection === sectionKey ? (
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
              <option value="">— Personne —</option>
              {persons.map(p => (
                <option key={p.id} value={p.id}>
                  {p.firstName || p.prenom} {p.lastName || p.nom}
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
        )}
      </div>
    );
  };

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'done').length;

  // Toggle la visibilité d'une tâche sur l'affichage dynamique
  const handleToggleTaskVisible = async (task) => {
    try {
      await api.toggleTaskVisibility(task.id);
      loadTasks();
    } catch (err) {
      toast.error('Erreur toggle visibilité');
    }
  };

  // Toggle la visibilité d'un événement d'affichage
  const handleToggleDisplayEventVisible = async (event) => {
    try {
      await api.toggleDisplayEventVisibility(event.id);
      loadTasks();
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
          <button className="btn-export-pdf" onClick={handleExportPdf} title="Exporter la fiche de tâches en PDF">
            <FileDown size={16} /> PDF
          </button>
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="sections-container">
          <div className="empty-state">
            <ClipboardList size={48} />
            <p>Chargement…</p>
          </div>
        </div>
      ) : viewMode === 'week' ? (
        <div className="wk-day-grid">
          {weekDays.map(d => renderWeekDayColumn(d))}
        </div>
      ) : (
        <div className="sections-container">
          {Object.keys(SECTIONS).map(renderSection)}
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
          existingTasks={tasks.filter(t => t.source_type === 'google_event' && t.source_id === eventTaskModalEvent.id)}
          onSave={() => { setEventTaskModalEvent(null); loadTasks(); }}
          onDelete={() => { setEventTaskModalEvent(null); loadTasks(); }}
          onClose={() => setEventTaskModalEvent(null)}
        />
      )}
    </div>
  );
}

export default TaskPlanningPanel;