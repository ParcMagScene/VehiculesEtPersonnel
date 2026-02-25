import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  Radio, Monitor, ClipboardList, FileText, Plus, Search,
  ChevronLeft, ChevronRight, Calendar, Clock, MapPin, User,
  Edit2, Trash2, Filter, Sun, Moon as MoonIcon, MessageSquare,
  Briefcase, ArrowUpDown, RefreshCw, CalendarDays, LayoutList
} from 'lucide-react';
import api from '../utils/api';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from '../hooks/useToast';
import './CommunicationPanel.css';

const DynamicDisplayDialog = lazy(() => import('./DynamicDisplayDialog'));
const BLImportModal = lazy(() => import('./BLImportModal'));
const TaskPlanningPanel = lazy(() => import('./TaskPlanningPanel'));

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
function DynamicDisplayPanel({ currentUser, onEditEvent, onCreateEvent, refreshKey }) {
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [viewMode, setViewMode] = useState('day');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Week days computation
  const weekDays = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    const monday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [selectedDate]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (viewMode === 'week') {
        params.dateFrom = weekDays[0];
        params.dateTo = weekDays[6];
      } else {
        params.date = selectedDate;
      }
      if (typeFilter) params.type = typeFilter;
      const data = await api.getDisplayEvents(params);
      setEvents(data);
    } catch (err) {
      toast.error('Erreur chargement événements : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, viewMode, weekDays, typeFilter, toast]);

  useEffect(() => { loadEvents(); }, [loadEvents, refreshKey]);

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

  // Grouper par jour (vue semaine)
  const weekGroupedDisplay = useMemo(() => {
    if (viewMode !== 'week') return {};
    const map = {};
    weekDays.forEach(d => { map[d] = []; });
    filteredEvents.forEach(ev => {
      const d = ev.date;
      if (map[d]) map[d].push(ev);
    });
    return map;
  }, [filteredEvents, weekDays, viewMode]);

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
          <div className="dd-view-toggle">
            <button className={viewMode === 'day' ? 'active' : ''} onClick={() => setViewMode('day')} title="Vue jour">
              <LayoutList size={15} /> Jour
            </button>
            <button className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')} title="Vue semaine">
              <CalendarDays size={15} /> Semaine
            </button>
          </div>
          <div className="date-nav">
            <button onClick={() => setSelectedDate(d => addDays(d, viewMode === 'week' ? -7 : -1))}>
              <ChevronLeft size={16} />
            </button>
            <span
              className="current-date"
              onClick={() => setSelectedDate(todayStr())}
              title="Revenir à aujourd'hui"
            >
              {viewMode === 'week'
                ? `${formatDateShort(weekDays[0])} → ${formatDateShort(weekDays[6])}`
                : formatDateFr(selectedDate)}
            </span>
            <button onClick={() => setSelectedDate(d => addDays(d, viewMode === 'week' ? 7 : 1))}>
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
        ) : viewMode === 'week' ? (
          /* ═══ VUE SEMAINE ═══ */
          <div className="dd-week-container">
            <div className="dd-week-grid">
              {weekDays.map(dayStr => {
                const dayEvents = weekGroupedDisplay[dayStr] || [];
                const isToday = dayStr === todayStr();
                const dayDate = new Date(dayStr + 'T00:00:00');
                const dayLabel = dayDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });

                return (
                  <div key={dayStr} className={`dd-week-column ${isToday ? 'today' : ''}`}>
                    <div className="dd-week-header">
                      <span className="dd-week-label">{dayLabel}</span>
                      {dayEvents.length > 0 && <span className="dd-week-count">{dayEvents.length}</span>}
                    </div>
                    <div className="dd-week-events">
                      {dayEvents.length === 0 ? (
                        <div className="dd-week-empty">—</div>
                      ) : (
                        dayEvents.map(ev => {
                          const typeInfo = EVENT_TYPES[ev.type] || { label: ev.type, emoji: '📌', color: '#64748b' };
                          return (
                            <div key={ev.id} className="dd-week-card" style={{ borderLeftColor: typeInfo.color }}>
                              <div className="dd-week-card-top">
                                <span className="dd-week-type" style={{ color: typeInfo.color }}>{typeInfo.emoji} {typeInfo.label}</span>
                                <button className="dd-week-del" onClick={() => handleDelete(ev.id)} title="Supprimer"><Trash2 size={11} /></button>
                              </div>
                              {ev.client && <div className="dd-week-client">{ev.client}</div>}
                              {ev.affaireId && <div className="dd-week-affaire"><Briefcase size={10} /> {ev.affaireId}</div>}
                              {ev.location && <div className="dd-week-location"><MapPin size={10} /> {ev.location}</div>}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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

// ═══ Sous-panneau : Import BL ═══
function BLImportSubPanel({ onRefresh }) {
  const toast = useToast();
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const loadImports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBLImports();
      setImports(data);
    } catch (err) {
      toast.error('Erreur chargement imports BL');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadImports(); }, [loadImports]);

  const handleDelete = (id) => {
    setConfirmDialog({
      title: 'Supprimer l\'import',
      message: 'Voulez-vous vraiment supprimer cet import BL ?',
      onConfirm: async () => {
        try {
          await api.deleteBLImport(id);
          toast.success('Import supprimé');
          loadImports();
          onRefresh?.();
        } catch (err) {
          toast.error('Erreur suppression');
        }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  const statusLabels = { pending: '⏳ En attente', validated: '✅ Validé', rejected: '❌ Rejeté' };

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
          <FileText size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Imports de Bons de Livraison
        </h3>
        <button className="btn-add-event" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
          border: 'none', borderRadius: 8, background: 'var(--accent-color, #6366f1)',
          color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer'
        }} onClick={() => setShowImportModal(true)}>
          <Plus size={16} /> Importer un BL
        </button>
      </div>

      {loading ? (
        <div className="events-empty">
          <RefreshCw size={32} className="spin" />
          <p>Chargement…</p>
        </div>
      ) : imports.length === 0 ? (
        <div className="bl-import-placeholder">
          <FileText size={48} />
          <h3>Aucun import BL</h3>
          <p>Importez un bon de livraison PDF pour commencer</p>
          <button
            className="btn-add-event"
            style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', border: 'none', borderRadius: 8,
              background: 'var(--accent-color, #6366f1)', color: 'white',
              fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
            onClick={() => setShowImportModal(true)}
          >
            <Plus size={16} /> Premier import
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {imports.map(bl => (
            <div key={bl.id} className="event-card" style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 10, overflow: 'hidden' }}>
              <div className="type-stripe" style={{ background: bl.status === 'validated' ? '#10b981' : bl.status === 'rejected' ? '#ef4444' : '#f59e0b', width: 5 }} />
              <div className="card-body" style={{ padding: '12px 16px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                    {bl.filename || 'Import BL'}
                  </span>
                  {bl.affaireId && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                      <Briefcase size={13} /> {bl.affaireId}
                    </span>
                  )}
                  <span style={{
                    fontSize: '0.75rem', padding: '2px 8px', borderRadius: 8,
                    background: 'var(--bg-tertiary)', color: 'var(--text-secondary)'
                  }}>
                    {statusLabels[bl.status] || bl.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Importé le {new Date(bl.createdAt).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <div className="card-actions" style={{ padding: 8 }}>
                <button className="delete" onClick={() => handleDelete(bl.id)} title="Supprimer"
                  style={{ width: 30, height: 30, border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showImportModal && (
        <Suspense fallback={null}>
          <BLImportModal
            onClose={() => setShowImportModal(false)}
            onImported={() => {
              loadImports();
              onRefresh?.();
            }}
          />
        </Suspense>
      )}
      {confirmDialog && <ConfirmDialog {...confirmDialog} />}
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
  const [displayRefreshKey, setDisplayRefreshKey] = useState(0);

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
            refreshKey={displayRefreshKey}
          />
        )}
        {activeSubTab === 'tasks' && (
          <Suspense fallback={null}>
            <TaskPlanningPanel currentUser={currentUser} refreshKey={displayRefreshKey} />
          </Suspense>
        )}
        {activeSubTab === 'bl' && (
          <BLImportSubPanel
            onRefresh={() => {
              setDisplayRefreshKey(k => k + 1);
              api.getCommunicationStats().then(setStats).catch(() => null);
            }}
          />
        )}
      </div>

      {/* Event Dialog */}
      {showEventDialog && (
        <Suspense fallback={null}>
          <DynamicDisplayDialog
            event={editingEvent}
            defaultDate={eventDialogDate}
            onSave={() => {
              setShowEventDialog(false);
              setEditingEvent(null);
              setDisplayRefreshKey(k => k + 1);
              // Refresh stats
              api.getCommunicationStats().then(setStats).catch(() => null);
            }}
            onClose={() => {
              setShowEventDialog(false);
              setEditingEvent(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

export default CommunicationPanel;
