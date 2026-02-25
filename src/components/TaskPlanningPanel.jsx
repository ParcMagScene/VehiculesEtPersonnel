import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardList, Plus, ChevronLeft, ChevronRight, Check, X, Clock,
  User, Edit2, Trash2, FileDown, Briefcase, MapPin, AlertCircle
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

// ═══ Composant Principal ═══
function TaskPlanningPanel({ currentUser, refreshKey }) {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Inline add form
  const [addingSection, setAddingSection] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPerson, setNewTaskPerson] = useState('');

  // Load tasks
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTasks({ date: selectedDate });
      setTasks(data);
    } catch (err) {
      toast.error('Erreur chargement tâches');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, toast]);

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

  return (
    <div className="task-planning-panel">
      {/* Toolbar */}
      <div className="tp-toolbar">
        <div className="tp-toolbar-left">
          <div className="tp-date-nav">
            <button onClick={() => setSelectedDate(d => addDays(d, -1))}>
              <ChevronLeft size={16} />
            </button>
            <span className="tp-current-date" onClick={() => setSelectedDate(todayStr())} title="Aujourd'hui">
              {formatDateFr(selectedDate)}
            </span>
            <button onClick={() => setSelectedDate(d => addDays(d, 1))}>
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
          <button className="btn-export-pdf" title="Exporter en PDF (Phase 7)">
            <FileDown size={16} /> PDF
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="sections-container">
        {loading ? (
          <div className="empty-state">
            <ClipboardList size={48} />
            <p>Chargement…</p>
          </div>
        ) : (
          Object.keys(SECTIONS).map(renderSection)
        )}
      </div>

      {confirmDialog && <ConfirmDialog {...confirmDialog} />}
    </div>
  );
}

export default TaskPlanningPanel;
