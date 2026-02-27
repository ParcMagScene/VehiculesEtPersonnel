import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  Radio, Monitor, ClipboardList, Plus, Search,
  ChevronLeft, ChevronRight, Calendar, Clock, MapPin, User,
  Edit2, Trash2, Filter, Sun, Moon as MoonIcon, MessageSquare,
  Briefcase, ArrowUpDown, RefreshCw, CalendarDays, LayoutList,
  Eye, EyeOff
} from 'lucide-react';
import api from '../utils/api';
import { formatDateFr, formatDateSimple as formatDateShort } from '../utils/formatUtils';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from '../hooks/useToast';
import './CommunicationPanel.css';

const DynamicDisplayDialog = lazy(() => import('./DynamicDisplayDialog'));
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

const AFFAIRE_TYPE_INFO = {
  'Prestation':    { label: 'Prestation',    emoji: '🎭', color: '#f59e0b' },
  'Location':      { label: 'Location',      emoji: '🏗️', color: '#3b82f6' },
  'Vente':         { label: 'Vente',         emoji: '💰', color: '#8b5cf6' },
  'Installation':  { label: 'Installation',  emoji: '⚙️', color: '#10b981' },
};

function DynamicDisplayPanel({ currentUser, onEditEvent, onCreateEvent, refreshKey }) {
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [affaires, setAffaires] = useState([]);
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
      const affaireParams = {};
      if (viewMode === 'week') {
        params.dateFrom = weekDays[0];
        params.dateTo = weekDays[6];
        affaireParams.dateFrom = weekDays[0];
        affaireParams.dateTo = weekDays[6];
      } else {
        params.date = selectedDate;
        affaireParams.date = selectedDate;
      }
      if (typeFilter) params.type = typeFilter;
      const [data, affairesData] = await Promise.all([
        api.getDisplayEvents(params),
        api.getPlanningAffaires(affaireParams),
      ]);
      setEvents(data);
      setAffaires(Array.isArray(affairesData) ? affairesData : []);
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

  // Filtrer affaires par recherche
  const filteredAffaires = useMemo(() => {
    let list = affaires;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(a =>
        (a.numeroAffaire || '').toLowerCase().includes(q) ||
        (a.client || '').toLowerCase().includes(q) ||
        (a.adresseLivraison || '').toLowerCase().includes(q) ||
        (a.titre || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [affaires, searchTerm]);

  // Grouper par période
  const grouped = useMemo(() => {
    const am = filteredEvents.filter(e => e.period === 'AM');
    const pm = filteredEvents.filter(e => e.period === 'PM');
    const other = filteredEvents.filter(e => e.period !== 'AM' && e.period !== 'PM');
    return { am, pm, other };
  }, [filteredEvents]);

  // Grouper affaires par type
  const affairesByType = useMemo(() => {
    const groups = {};
    filteredAffaires.forEach(a => {
      const t = a.type || 'Autre';
      if (!groups[t]) groups[t] = [];
      groups[t].push(a);
    });
    return groups;
  }, [filteredAffaires]);

  // Grouper par jour (vue semaine) — événements + affaires
  const weekGroupedDisplay = useMemo(() => {
    if (viewMode !== 'week') return {};
    const map = {};
    weekDays.forEach(d => { map[d] = { events: [], affaires: [] }; });
    filteredEvents.forEach(ev => {
      const d = ev.date;
      if (map[d]) map[d].events.push(ev);
    });
    // Ajouter les affaires à chaque jour où elles sont actives
    filteredAffaires.forEach(a => {
      weekDays.forEach(d => {
        if (a.dateDebut && a.dateDebut <= d && (!a.dateFin || a.dateFin === '' || a.dateFin >= d)) {
          map[d].affaires.push(a);
        }
      });
    });
    return map;
  }, [filteredEvents, filteredAffaires, weekDays, viewMode]);

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

  const handleToggleVisible = async (eventId) => {
    try {
      const updated = await api.toggleDisplayEventVisibility(eventId);
      setEvents(prev => prev.map(e => e.id === eventId ? updated : e));
    } catch (err) {
      toast.error('Erreur bascule visibilité : ' + err.message);
    }
  };

  const renderEventCard = (event) => {
    const typeInfo = EVENT_TYPES[event.type] || { label: event.type, color: 'var(--theme-text-secondary)', emoji: '📌' };
    const catInfo = EVENT_CATEGORIES[event.category] || null;
    const isHidden = event.visible === 0;

    return (
      <div key={event.id} className={`event-card ${isHidden ? 'event-hidden' : ''}`}>
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
            {isHidden && <span className="event-hidden-badge">Masqué</span>}
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
            className={`toggle-visible ${isHidden ? 'hidden-state' : ''}`}
            title={isHidden ? 'Rendre visible' : 'Masquer de l\'affichage'}
            onClick={() => handleToggleVisible(event.id)}
          >
            {isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
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

  const renderAffaireCard = (affaire) => {
    const typeInfo = AFFAIRE_TYPE_INFO[affaire.type] || { label: affaire.type || 'Affaire', emoji: '📋', color: 'var(--theme-text-secondary)' };
    return (
      <div key={`aff-${affaire.numeroAffaire || affaire.id}`} className="event-card affaire-card">
        <div className="type-stripe" style={{ background: typeInfo.color }} />
        <div className="card-body">
          <div className="card-top-row">
            <span className="event-type-badge" style={{ background: typeInfo.color + '18', color: typeInfo.color }}>
              {typeInfo.emoji} {typeInfo.label}
            </span>
            <span className="event-affaire">
              <Briefcase size={13} /> {affaire.numeroAffaire}
            </span>
          </div>
          <div className="event-details">
            {affaire.client && <span><User size={13} /> {affaire.client}</span>}
            {affaire.adresseLivraison && <span><MapPin size={13} /> {affaire.adresseLivraison.split('\n')[0]}</span>}
            {affaire.interlocuteur && <span><User size={12} /> {affaire.interlocuteur}</span>}
          </div>
          {affaire.titre && (
            <div className="event-comment">
              <MessageSquare size={12} /> {affaire.titre.slice(0, 60)}{affaire.titre.length > 60 ? '…' : ''}
            </div>
          )}
          <div className="affaire-meta-row">
            {affaire.blCount > 0 && <span className="affaire-badge bl">📄 {affaire.blCount} BL</span>}
            {affaire.eventsCount > 0 && <span className="affaire-badge events">📅 {affaire.eventsCount} évén.</span>}
            {affaire.dateDebut && <span className="affaire-badge date">📆 {new Date(affaire.dateDebut + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>}
          </div>
        </div>
      </div>
    );
  };

  const renderAffaireTypeGroup = (type, affs) => {
    const typeInfo = AFFAIRE_TYPE_INFO[type] || { label: type, emoji: '📋', color: 'var(--theme-text-secondary)' };
    return (
      <div key={`aff-type-${type}`} className="period-group affaire-type-group">
        <h3 style={{ color: typeInfo.color }}>{typeInfo.emoji} {type} — {affs.length} affaire{affs.length > 1 ? 's' : ''}</h3>
        {affs.map(renderAffaireCard)}
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
                const dayData = weekGroupedDisplay[dayStr] || { events: [], affaires: [] };
                const totalItems = dayData.events.length + dayData.affaires.length;
                const isToday = dayStr === todayStr();
                const dayDate = new Date(dayStr + 'T00:00:00');
                const dayLabel = dayDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });

                return (
                  <div key={dayStr} className={`dd-week-column ${isToday ? 'today' : ''}`}>
                    <div className="dd-week-header">
                      <span className="dd-week-label">{dayLabel}</span>
                      {totalItems > 0 && <span className="dd-week-count">{totalItems}</span>}
                    </div>
                    <div className="dd-week-events">
                      {totalItems === 0 ? (
                        <div className="dd-week-empty">—</div>
                      ) : (
                        <>
                          {dayData.affaires.map(a => {
                            const ti = AFFAIRE_TYPE_INFO[a.type] || { label: 'Affaire', emoji: '📋', color: 'var(--theme-text-secondary)' };
                            return (
                              <div key={`wa-${a.numeroAffaire || a.id}`} className="dd-week-card affaire-week-card" style={{ borderLeftColor: ti.color }}>
                                <div className="dd-week-card-top">
                                  <span className="dd-week-type" style={{ color: ti.color }}>{ti.emoji} {a.type}</span>
                                </div>
                                {a.client && <div className="dd-week-client">{a.client}</div>}
                                <div className="dd-week-affaire"><Briefcase size={10} /> {a.numeroAffaire}</div>
                              </div>
                            );
                          })}
                          {dayData.events.map(ev => {
                            const typeInfo = EVENT_TYPES[ev.type] || { label: ev.type, emoji: '📌', color: 'var(--theme-text-secondary)' };
                            const isHidden = ev.visible === 0;
                            return (
                              <div key={ev.id} className={`dd-week-card ${isHidden ? 'event-hidden' : ''}`} style={{ borderLeftColor: typeInfo.color }}>
                                <div className="dd-week-card-top">
                                  <span className="dd-week-type" style={{ color: typeInfo.color }}>{typeInfo.emoji} {typeInfo.label}</span>
                                  <div className="dd-week-card-actions">
                                    <button className={`dd-week-toggle ${isHidden ? 'hidden-state' : ''}`} onClick={() => handleToggleVisible(ev.id)} title={isHidden ? 'Rendre visible' : 'Masquer'}>
                                      {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
                                    </button>
                                    <button className="dd-week-edit" onClick={() => onEditEvent(ev)} title="Modifier"><Edit2 size={11} /></button>
                                    <button className="dd-week-del" onClick={() => handleDelete(ev.id)} title="Supprimer"><Trash2 size={11} /></button>
                                  </div>
                                </div>
                                {ev.client && <div className="dd-week-client">{ev.client}</div>}
                                {ev.affaireId && <div className="dd-week-affaire"><Briefcase size={10} /> {ev.affaireId}</div>}
                                {ev.location && <div className="dd-week-location"><MapPin size={10} /> {ev.location}</div>}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : filteredEvents.length === 0 && filteredAffaires.length === 0 ? (
          <div className="events-empty">
            <Calendar size={48} />
            <p>Aucun événement ni affaire pour le {formatDateShort(selectedDate)}</p>
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
            {/* Affaires groupées par type */}
            {Object.entries(affairesByType).map(([type, affs]) => renderAffaireTypeGroup(type, affs))}
            {/* Événements groupés par période */}
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


// ═══ Composant Principal ═══
function CommunicationPanel({ currentUser, googleEvents = [] }) {
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
            <TaskPlanningPanel currentUser={currentUser} refreshKey={displayRefreshKey} googleEvents={googleEvents} />
          </Suspense>
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
