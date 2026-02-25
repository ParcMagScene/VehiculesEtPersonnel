import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Radio, Monitor, ClipboardList, FileText, Plus, Search,
  ChevronLeft, ChevronRight, Calendar, Clock, MapPin, User,
  Edit2, Trash2, Filter, Sun, Moon as MoonIcon, MessageSquare,
  Briefcase, ArrowUpDown, RefreshCw
} from 'lucide-react';
import api from '../utils/api';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from '../hooks/useToast';
import './CommunicationPanel.css';

// ═══ Constantes ═══
const EVENT_TYPES = {
  preparation:  { label: 'Préparation',  color: '#6366f1', emoji: '🔧' },
  enlevement:   { label: 'Enlèvement',   color: '#f59e0b', emoji: '📦' },
  livraison:    { label: 'Livraison',     color: '#10b981', emoji: '🚚' },
  depart:       { label: 'Départ',        color: '#3b82f6', emoji: '🚀' },
  retour:       { label: 'Retour',        color: '#8b5cf6', emoji: '↩️' },
  recuperation: { label: 'Récupération',  color: '#ef4444', emoji: '📥' },
};

const EVENT_CATEGORIES = {
  vente:        { label: 'Vente',        color: '#10b981' },
  location:     { label: 'Location',     color: '#3b82f6' },
  prestation:   { label: 'Prestation',   color: '#f59e0b' },
  installation: { label: 'Installation', color: '#8b5cf6' },
};

const PERIODS = {
  AM: { label: 'Matin', icon: '🌅' },
  PM: { label: 'Après-midi', icon: '☀️' },
};

const formatDateFr = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ═══ Sous-panneau : Affichage Dynamique ═══
function DynamicDisplayPanel({ currentUser, onEditEvent, onCreateEvent }) {
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = { date: selectedDate };
      if (typeFilter) params.type = typeFilter;
      const data = await api.getDisplayEvents(params);
      setEvents(data);
    } catch (err) {
      toast.error('Erreur chargement événements : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, typeFilter, toast]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Filtrer localement par recherche
  const filteredEvents = useMemo(() => {
    if (!searchTerm) return events;
    const q = searchTerm.toLowerCase();
    return events.filter(e =>
      (e.affaireId || '').toLowerCase().includes(q) ||
      (e.client || '').toLowerCase().includes(q) ||
      (e.comment || '').toLowerCase().includes(q) ||
      (e.location || '').toLowerCase().includes(q)
    );
  }, [events, searchTerm]);

  // Grouper par période
  const grouped = useMemo(() => {
    const am = filteredEvents.filter(e => e.period === 'AM');
    const pm = filteredEvents.filter(e => e.period === 'PM');
    const other = filteredEvents.filter(e => e.period !== 'AM' && e.period !== 'PM');
    return { am, pm, other };
  }, [filteredEvents]);

  const handleDelete = async (id) => {
    setConfirmDialog({
      title: 'Supprimer l\'événement',
      message: 'Voulez-vous vraiment supprimer cet événement d\'affichage ?',
      onConfirm: async () => {
        try {
          await api.deleteDisplayEvent(id);
          toast.success('Événement supprimé');
          loadEvents();
        } catch (err) {
          toast.error('Erreur suppression : ' + err.message);
        }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  const renderEventCard = (event) => {
    const typeInfo = EVENT_TYPES[event.type] || { label: event.type, color: '#64748b', emoji: '📌' };
    const catInfo = EVENT_CATEGORIES[event.category] || null;

    return (
      <div key={event.id} className="event-card">
        <div className="type-stripe" style={{ background: typeInfo.color }} />
        <div className="card-body">
          <div className="card-top-row">
            <span
              className="event-type-badge"
              style={{ background: typeInfo.color + '18', color: typeInfo.color }}
            >
              {typeInfo.emoji} {typeInfo.label}
            </span>
            {event.affaireId && (
              <span className="event-affaire">
                <Briefcase size={13} /> {event.affaireId}
              </span>
            )}
            {catInfo && (
              <span className="event-category" style={{ color: catInfo.color }}>
                {catInfo.label}
              </span>
            )}
          </div>
          <div className="event-details">
            {event.client && <span><User size={13} /> {event.client}</span>}
            {event.location && <span><MapPin size={13} /> {event.location}</span>}
            {event.time && <span><Clock size={13} /> {event.time}</span>}
          </div>
          {event.comment && (
            <div className="event-comment">
              <MessageSquare size={12} /> {event.comment}
            </div>
          )}
        </div>
        <div className="card-actions">
          <button
            className="edit"
            title="Modifier"
            onClick={() => onEditEvent(event)}
          >
            <Edit2 size={15} />
          </button>
          <button
            className="delete"
            title="Supprimer"
            onClick={() => handleDelete(event.id)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    );
  };

  const renderPeriodGroup = (title, icon, events) => {
    if (events.length === 0) return null;
    return (
      <div className="period-group">
        <h3>{icon} {title} — {events.length} événement{events.length > 1 ? 's' : ''}</h3>
        {events.map(renderEventCard)}
      </div>
    );
  };

  return (
    <div className="dynamic-display-panel">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="date-nav">
            <button onClick={() => setSelectedDate(d => addDays(d, -1))} title="Jour précédent">
              <ChevronLeft size={16} />
            </button>
            <span
              className="current-date"
              onClick={() => setSelectedDate(todayStr())}
              title="Revenir à aujourd'hui"
            >
              {formatDateFr(selectedDate)}
            </span>
            <button onClick={() => setSelectedDate(d => addDays(d, 1))} title="Jour suivant">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="search-input">
            <Search size={14} />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="toolbar-right">
          <button className="btn-add-event" onClick={() => onCreateEvent(selectedDate)} title="Ajouter un événement">
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      {/* Filtres par type */}
      <div className="filters-row">
        <span
          className={`filter-chip ${!typeFilter ? 'active' : ''}`}
          onClick={() => setTypeFilter('')}
        >
          Tous
        </span>
        {Object.entries(EVENT_TYPES).map(([key, info]) => (
          <span
            key={key}
            className={`filter-chip ${typeFilter === key ? 'active' : ''}`}
            onClick={() => setTypeFilter(typeFilter === key ? '' : key)}
          >
            {info.emoji} {info.label}
          </span>
        ))}
      </div>

      {/* Contenu */}
      <div className="events-container">
        {loading ? (
          <div className="events-empty">
            <RefreshCw size={32} className="spin" />
            <p>Chargement…</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="events-empty">
            <Calendar size={48} />
            <p>Aucun événement pour le {formatDateShort(selectedDate)}</p>
            <button
              className="btn-add-event"
              style={{ marginTop: 16 }}
              onClick={() => onCreateEvent(selectedDate)}
            >
              <Plus size={16} /> Créer le premier événement
            </button>
          </div>
        ) : (
          <>
            {renderPeriodGroup('Matin', '🌅', grouped.am)}
            {renderPeriodGroup('Après-midi', '☀️', grouped.pm)}
            {renderPeriodGroup('Non spécifié', '📌', grouped.other)}
          </>
        )}
      </div>

      {confirmDialog && <ConfirmDialog {...confirmDialog} />}
    </div>
  );
}

// ═══ Sous-panneau : Planification des tâches (placeholder Phase 6) ═══
function TaskPlanningPlaceholder() {
  return (
    <div className="task-planning-placeholder">
      <ClipboardList size={48} />
      <h3>Planification des tâches</h3>
      <p>
        Ce module permettra d'assigner des tâches au personnel en fonction des événements
        d'affichage dynamique et de générer des fiches de travail en PDF.
      </p>
      <p style={{ fontSize: '0.8rem', marginTop: 12, opacity: 0.7 }}>
        🚧 En cours de développement — Phase 6
      </p>
    </div>
  );
}

// ═══ Sous-panneau : Import BL (placeholder Phase 5) ═══
function BLImportPlaceholder() {
  return (
    <div className="bl-import-placeholder">
      <FileText size={48} />
      <h3>Import de Bons de Livraison</h3>
      <p>
        Ce module permettra d'importer des BL en PDF, de les associer aux affaires,
        et de générer automatiquement les événements d'affichage dynamique.
      </p>
      <p style={{ fontSize: '0.8rem', marginTop: 12, opacity: 0.7 }}>
        🚧 En cours de développement — Phase 5
      </p>
    </div>
  );
}

// ═══ Composant Principal ═══
function CommunicationPanel({ currentUser }) {
  const toast = useToast();
  const [activeSubTab, setActiveSubTab] = useState('display');
  const [stats, setStats] = useState(null);

  // Dialog d'événement (Phase 4)
  const [editingEvent, setEditingEvent] = useState(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [eventDialogDate, setEventDialogDate] = useState(null);

  useEffect(() => {
    api.getCommunicationStats().then(setStats).catch(() => null);
  }, [activeSubTab]);

  const handleCreateEvent = (date) => {
    setEditingEvent(null);
    setEventDialogDate(date);
    setShowEventDialog(true);
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setEventDialogDate(null);
    setShowEventDialog(true);
  };

  const subTabs = [
    { id: 'display', label: 'Affichage dynamique', icon: Monitor, count: stats?.displayEventsTotal || 0 },
    { id: 'tasks', label: 'Planification', icon: ClipboardList, count: stats?.tasksPending || 0 },
    { id: 'bl', label: 'Import BL', icon: FileText, count: stats?.blImportsTotal || 0 },
  ];

  return (
    <div className="communication-panel">
      {/* Header */}
      <div className="panel-header">
        <h2><Radio size={22} /> Communication</h2>
        <div className="header-stats">
          {stats && (
            <>
              <span className="stat-badge highlight">
                <Calendar size={14} /> {stats.displayEventsToday} aujourd'hui
              </span>
              <span className="stat-badge">
                <ClipboardList size={14} /> {stats.tasksPending} tâches en attente
              </span>
            </>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="sub-tabs">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`sub-tab ${activeSubTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveSubTab(tab.id)}
            >
              <Icon size={16} />
              {tab.label}
              {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="panel-content">
        {activeSubTab === 'display' && (
          <DynamicDisplayPanel
            currentUser={currentUser}
            onEditEvent={handleEditEvent}
            onCreateEvent={handleCreateEvent}
          />
        )}
        {activeSubTab === 'tasks' && <TaskPlanningPlaceholder />}
        {activeSubTab === 'bl' && <BLImportPlaceholder />}
      </div>

      {/* Event Dialog (Phase 4 — sera un import lazy) */}
      {showEventDialog && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
        }}>
          <div style={{
            background: 'var(--bg-primary, #fff)', borderRadius: 12, padding: 24,
            width: '90%', maxWidth: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Monitor size={20} />
              {editingEvent ? 'Modifier l\'événement' : 'Nouvel événement'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Le formulaire complet d'événement sera disponible en Phase 4.
              <br />Date sélectionnée : <strong>{editingEvent?.date || eventDialogDate || '—'}</strong>
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setShowEventDialog(false)}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: 'var(--accent-color, #6366f1)', color: 'white',
                  fontWeight: 600, cursor: 'pointer'
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunicationPanel;
