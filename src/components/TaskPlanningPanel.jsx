import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardList, Plus, ChevronLeft, ChevronRight, Check, X, Clock,
  User, Edit2, Trash2, FileDown, Briefcase, MapPin, AlertCircle,
  CalendarDays, LayoutList
} from 'lucide-react';
import api from '../utils/api';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from '../hooks/useToast';
import './TaskPlanningPanel.css';

// ═══ Constantes ═══
const SECTIONS = {
  prep_locations:     { label: 'Prépa Locations',    emoji: '📦', color: '#3b82f6' },
  prep_prestations:   { label: 'Prépa Prestations',  emoji: '🎤', color: '#f59e0b' },
  prep_ventes:        { label: 'Prépa Ventes',       emoji: '🏷️', color: '#10b981' },
  taches_prioritaires:{ label: 'Tâches Prioritaires', emoji: '🔴', color: '#ef4444' },
  taches_secondaires: { label: 'Tâches Secondaires', emoji: '🟡', color: '#f59e0b' },
  courses:            { label: 'Courses',             emoji: '🚗', color: '#8b5cf6' },
  manual:             { label: 'Autres',              emoji: '📋', color: '#64748b' },
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

const formatDateFr = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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
function TaskPlanningPanel({ currentUser, refreshKey }) {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Inline add form
  const [addingSection, setAddingSection] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPerson, setNewTaskPerson] = useState('');

  // Semaine : 7 jours à partir du lundi
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  // Load tasks
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      let data;
      if (viewMode === 'week') {
        data = await api.getTasks({ dateFrom: weekDays[0], dateTo: weekDays[6] });
      } else {
        data = await api.getTasks({ date: selectedDate });
      }
      setTasks(data);
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

  // Export PDF
  const handleExportPdf = async () => {
    try {
      toast.info('Génération du PDF…');
      const blob = await api.exportTasksPdf(selectedDate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taches-${selectedDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF téléchargé');
    } catch (err) {
      toast.error('Erreur export PDF');
    }
  };

  const renderTaskRow = (task) => {
    const isDone = task.status === 'done';
    const isProgress = task.status === 'in_progress';

    return (
      <div key={task.id} className="task-row">
        <button
          className={`task-status-btn ${isDone ? 'done' : isProgress ? 'in-progress' : ''}`}
          onClick={() => cycleStatus(task)}
          title={`Statut: ${task.status} — cliquer pour changer`}
        >
          {isDone && <Check size={14} />}
          {isProgress && <Clock size={12} />}
        </button>

        <div className="task-info">
          <div className={`task-title ${isDone ? 'done' : ''}`}>{task.title}</div>
          <div className="task-meta">
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
          <button className="delete" onClick={() => handleDelete(task.id)} title="Supprimer">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  const renderSection = (sectionKey) => {
    const info = SECTIONS[sectionKey];
    const sectionTasks = grouped[sectionKey] || [];

    return (
      <div key={sectionKey} className="task-section">
        <div className="section-header" style={{ borderBottomColor: info.color }}>
          <h4>
            <span>{info.emoji}</span>
            {info.label}
          </h4>
          <span className="section-count">{sectionTasks.length}</span>
        </div>

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

  // ── Groupement par jour (vue semaine) ──
  const weekGrouped = useMemo(() => {
    if (viewMode !== 'week') return {};
    const map = {};
    weekDays.forEach(d => { map[d] = []; });
    tasks.forEach(t => {
      const d = t.date;
      if (map[d]) map[d].push(t);
    });
    return map;
  }, [tasks, weekDays, viewMode]);

  // ── Vue semaine : mini-carte tâche ──
  const renderWeekTaskCard = (task) => {
    const isDone = task.status === 'done';
    const isProgress = task.status === 'in_progress';
    const sectionInfo = SECTIONS[task.section] || SECTIONS.manual;
    return (
      <div
        key={task.id}
        className={`week-task-card ${isDone ? 'done' : ''} ${isProgress ? 'in-progress' : ''}`}
        style={{ borderLeftColor: sectionInfo.color }}
        title={`${task.title}${task.personFirstName ? ` — ${task.personFirstName}` : ''}`}
      >
        <button
          className={`task-status-btn mini ${isDone ? 'done' : isProgress ? 'in-progress' : ''}`}
          onClick={() => cycleStatus(task)}
        >
          {isDone && <Check size={10} />}
          {isProgress && <Clock size={10} />}
        </button>
        <span className={`week-task-title ${isDone ? 'done' : ''}`}>{task.title}</span>
        {(task.personFirstName || task.personLastName) && (
          <span className="week-task-person">{task.personFirstName?.charAt(0)}{task.personLastName?.charAt(0)}</span>
        )}
      </div>
    );
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
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
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
        /* ═══ VUE SEMAINE ═══ */
        <div className="week-view-container">
          <div className="week-grid">
            {weekDays.map(dayStr => {
              const dayTasks = weekGrouped[dayStr] || [];
              const isToday = dayStr === todayStr();
              const dayDate = new Date(dayStr + 'T00:00:00');
              const dayLabel = dayDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
              const dayDone = dayTasks.filter(t => t.status === 'done').length;

              return (
                <div key={dayStr} className={`week-day-column ${isToday ? 'today' : ''}`}>
                  <div className="week-day-header">
                    <span className="week-day-label">{dayLabel}</span>
                    {dayTasks.length > 0 && (
                      <span className="week-day-count">
                        {dayDone}/{dayTasks.length}
                      </span>
                    )}
                  </div>
                  <div className="week-day-tasks">
                    {dayTasks.length === 0 ? (
                      <div className="week-empty">—</div>
                    ) : (
                      dayTasks.map(renderWeekTaskCard)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ═══ VUE JOUR ═══ */
        <div className="sections-container">
          {Object.keys(SECTIONS).map(renderSection)}
        </div>
      )}

      {confirmDialog && <ConfirmDialog {...confirmDialog} />}
    </div>
  );
}

export default TaskPlanningPanel;
