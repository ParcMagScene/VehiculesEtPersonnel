import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, isSameMonth, isToday, parseISO, isWeekend,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Calendar as CalIcon, Users, Briefcase,
  Clock, MapPin, Ban, Palmtree, Search,
} from 'lucide-react';
import api from '../utils/api';
import './PersonnelAgenda.css';

// Couleurs par type d'événement
const EVENT_COLORS = {
  mission: { bg: 'var(--theme-info-bg-strong)', border: '#3b82f6', text: 'var(--theme-info-text)' },
  leave: { bg: 'var(--theme-success-bg-strong)', border: '#10b981', text: 'var(--theme-success-text)' },
  unavailability: { bg: 'var(--btn-danger-bg)', border: '#ef4444', text: 'var(--theme-danger-text)' },
  google: { bg: 'var(--btn-warning-bg)', border: '#f59e0b', text: 'var(--theme-warning-text)' },
};

const MISSION_TYPE_LABELS = {
  intervention: 'Intervention',
  livraison: 'Livraison',
  installation: 'Installation',
  maintenance: 'Maintenance',
  depannage: 'Dépannage',
};

const LEAVE_TYPE_LABELS = {
  conge_paye: 'Congé payé',
  rtt: 'RTT',
  maladie: 'Maladie',
  formation: 'Formation',
  sans_solde: 'Sans solde',
  maternite: 'Maternité',
  paternite: 'Paternité',
  mariage_salarie: 'Mariage',
  deces_proche: 'Décès proche',
  enfant_malade: 'Enfant malade',
  demenagement: 'Déménagement',
};

function PersonnelAgenda({ persons = [], currentUser, googleEvents = [] }) {
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [agendaView, setAgendaView] = useState('week'); // 'week' | 'month'
  const [agendaDate, setAgendaDate] = useState(new Date());
  const [events, setEvents] = useState({ missions: [], leaves: [], unavailabilities: [] });
  const [loading, setLoading] = useState(false);
  const [searchPerson, setSearchPerson] = useState('');

  // Sélection auto de la personne connectée
  useEffect(() => {
    if (!selectedPersonId && persons.length > 0 && currentUser) {
      const self = persons.find(p =>
        p.email === currentUser.email ||
        (p.first_name === currentUser.firstName && p.last_name === currentUser.lastName)
      );
      setSelectedPersonId(self?.id || persons[0]?.id);
    }
  }, [selectedPersonId, persons, currentUser]);

  // Plage de dates visible
  const dateRange = useMemo(() => {
    if (agendaView === 'week') {
      return {
        start: startOfWeek(agendaDate, { weekStartsOn: 1 }),
        end: endOfWeek(agendaDate, { weekStartsOn: 1 }),
      };
    }
    return {
      start: startOfMonth(agendaDate),
      end: endOfMonth(agendaDate),
    };
  }, [agendaView, agendaDate]);

  const visibleDays = useMemo(() =>
    eachDayOfInterval({ start: dateRange.start, end: dateRange.end }),
    [dateRange]
  );

  // Charger les données
  const loadAgendaData = useCallback(async () => {
    if (!selectedPersonId) return;
    setLoading(true);
    try {
      const startStr = format(dateRange.start, 'yyyy-MM-dd');
      const endStr = format(dateRange.end, 'yyyy-MM-dd');

      const [missionsData, leavesData, availData] = await Promise.all([
        api.getMissions({ startDate: startStr, endDate: endStr }).catch(() => []),
        api.getAllLeaves({ personId: selectedPersonId, startDate: startStr, endDate: endStr }).catch(() => []),
        api.getAvailabilities({ personId: selectedPersonId, startDate: startStr, endDate: endStr }).catch(() => []),
      ]);

      // Filtrer les missions assignées à cette personne
      const personMissions = (missionsData || []).filter(m => {
        const assignments = typeof m.assignments_json === 'string'
          ? JSON.parse(m.assignments_json || '[]')
          : (m.assignments || []);
        return assignments.some(a => a.person_id === selectedPersonId || a.personId === selectedPersonId);
      });

      setEvents({
        missions: personMissions,
        leaves: leavesData || [],
        unavailabilities: availData || [],
      });
    } catch (err) {
      console.error('[Agenda] Erreur chargement:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPersonId, dateRange]);

  useEffect(() => { loadAgendaData(); }, [loadAgendaData]);

  // Événements Google Calendar pour la personne
  const personGoogleEvents = useMemo(() => {
    if (!selectedPersonId || !googleEvents.length) return [];
    const person = persons.find(p => p.id === selectedPersonId);
    if (!person?.email) return [];
    return googleEvents.filter(e =>
      e.attendees?.some(a => a.email === person.email) ||
      e.organizer?.email === person.email
    );
  }, [selectedPersonId, googleEvents, persons]);

  // Événements d'un jour donné
  const getEventsForDay = useCallback((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const result = [];

    // Missions
    events.missions.forEach(m => {
      const start = m.start_date || m.startDate;
      const end = m.end_date || m.endDate || start;
      if (start <= dayStr && end >= dayStr) {
        result.push({
          id: `mission-${m.id}`,
          type: 'mission',
          title: MISSION_TYPE_LABELS[m.type] || m.type || 'Mission',
          subtitle: m.client_name || m.clientName || '',
          location: m.location || '',
          raw: m,
        });
      }
    });

    // Congés
    events.leaves.forEach(l => {
      const start = l.start_date || l.startDate;
      const end = l.end_date || l.endDate || start;
      if (start <= dayStr && end >= dayStr) {
        result.push({
          id: `leave-${l.id}`,
          type: 'leave',
          title: LEAVE_TYPE_LABELS[l.leave_type || l.leaveType] || l.leave_type || 'Congé',
          subtitle: l.status === 'approved' ? 'Validé' : l.status === 'pending' ? 'En attente' : l.status,
          raw: l,
        });
      }
    });

    // Indisponibilités
    events.unavailabilities.forEach(u => {
      const start = u.start_date || u.startDate;
      const end = u.end_date || u.endDate || start;
      if (start <= dayStr && end >= dayStr) {
        result.push({
          id: `unavail-${u.id}`,
          type: 'unavailability',
          title: u.reason || 'Indisponible',
          subtitle: u.type || '',
          raw: u,
        });
      }
    });

    // Google Calendar
    personGoogleEvents.forEach(g => {
      const gStart = g.start?.dateTime || g.start?.date || '';
      const gEnd = g.end?.dateTime || g.end?.date || '';
      const gStartDate = gStart.substring(0, 10);
      const gEndDate = gEnd.substring(0, 10);
      if (gStartDate <= dayStr && gEndDate >= dayStr) {
        result.push({
          id: `google-${g.id}`,
          type: 'google',
          title: g.summary || 'Événement',
          subtitle: g.location || '',
          raw: g,
        });
      }
    });

    return result;
  }, [events, personGoogleEvents]);

  // Navigation
  const navigate = (direction) => {
    const delta = direction === 'prev' ? -1 : 1;
    if (agendaView === 'week') {
      setAgendaDate(d => addWeeks(d, delta));
    } else {
      setAgendaDate(d => addMonths(d, delta));
    }
  };

  const goToday = () => setAgendaDate(new Date());

  // Personne sélectionnée
  const selectedPerson = persons.find(p => p.id === selectedPersonId);

  // Filtre personnes
  const filteredPersons = useMemo(() => {
    if (!searchPerson) return persons;
    const q = searchPerson.toLowerCase();
    return persons.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    );
  }, [persons, searchPerson]);

  // Titre de la période
  const periodTitle = agendaView === 'week'
    ? format(dateRange.start, "'Semaine du' d MMMM yyyy", { locale: fr })
    : format(agendaDate, 'MMMM yyyy', { locale: fr });

  return (
    <div className="personnel-agenda">
      {/* Barre latérale - sélection personne */}
      <div className="agenda-sidebar">
        <div className="agenda-sidebar-header">
          <Users size={18} />
          <span>Personnel</span>
        </div>
        <div className="agenda-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchPerson}
            onChange={e => setSearchPerson(e.target.value)}
          />
        </div>
        <div className="agenda-person-list">
          {filteredPersons.map(person => (
            <button
              key={person.id}
              className={`agenda-person-item ${person.id === selectedPersonId ? 'active' : ''}`}
              onClick={() => setSelectedPersonId(person.id)}
            >
              <div className="agenda-person-avatar">
                {(person.first_name || '')[0]}{(person.last_name || '')[0]}
              </div>
              <div className="agenda-person-info">
                <div className="agenda-person-name">
                  {person.first_name} {person.last_name}
                </div>
                <div className="agenda-person-role">
                  {person.role || person.position || person.type || ''}
                </div>
              </div>
            </button>
          ))}
        </div>
        {/* Légende */}
        <div className="agenda-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: EVENT_COLORS.mission.border }} />
            <span>Missions</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: EVENT_COLORS.leave.border }} />
            <span>Congés</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: EVENT_COLORS.unavailability.border }} />
            <span>Indisponible</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: EVENT_COLORS.google.border }} />
            <span>Google</span>
          </div>
        </div>
      </div>

      {/* Zone principale */}
      <div className="agenda-main">
        {/* Toolbar */}
        <div className="agenda-toolbar">
          <div className="agenda-toolbar-left">
            <h2 className="agenda-person-title">
              {selectedPerson
                ? `${selectedPerson.first_name} ${selectedPerson.last_name}`
                : 'Sélectionnez une personne'}
            </h2>
          </div>
          <div className="agenda-toolbar-center">
            <button className="agenda-nav-btn" onClick={() => navigate('prev')}>
              <ChevronLeft size={18} />
            </button>
            <span className="agenda-period-title">{periodTitle}</span>
            <button className="agenda-nav-btn" onClick={() => navigate('next')}>
              <ChevronRight size={18} />
            </button>
            <button className="agenda-today-btn" onClick={goToday}>
              Aujourd'hui
            </button>
          </div>
          <div className="agenda-toolbar-right">
            <div className="agenda-view-toggle">
              <button
                className={agendaView === 'week' ? 'active' : ''}
                onClick={() => setAgendaView('week')}
              >Semaine</button>
              <button
                className={agendaView === 'month' ? 'active' : ''}
                onClick={() => setAgendaView('month')}
              >Mois</button>
            </div>
          </div>
        </div>

        {/* Grille calendrier */}
        {loading ? (
          <div className="agenda-loading">
            <Clock size={20} className="spinning" />
            <span>Chargement...</span>
          </div>
        ) : !selectedPersonId ? (
          <div className="agenda-empty">
            <Users size={48} />
            <p>Sélectionnez une personne pour voir son agenda</p>
          </div>
        ) : agendaView === 'week' ? (
          /* === VUE SEMAINE === */
          <div className="agenda-week">
            <div className="agenda-week-header">
              {visibleDays.map(day => (
                <div
                  key={day.toString()}
                  className={`agenda-week-day-header ${isToday(day) ? 'today' : ''} ${isWeekend(day) ? 'weekend' : ''}`}
                >
                  <span className="week-day-name">{format(day, 'EEE', { locale: fr })}</span>
                  <span className={`week-day-number ${isToday(day) ? 'today-badge' : ''}`}>
                    {format(day, 'd')}
                  </span>
                </div>
              ))}
            </div>
            <div className="agenda-week-body">
              {visibleDays.map(day => {
                const dayEvents = getEventsForDay(day);
                return (
                  <div
                    key={day.toString()}
                    className={`agenda-week-day ${isToday(day) ? 'today' : ''} ${isWeekend(day) ? 'weekend' : ''}`}
                  >
                    {dayEvents.length === 0 && (
                      <div className="agenda-day-free">Disponible</div>
                    )}
                    {dayEvents.map(evt => (
                      <div
                        key={evt.id}
                        className="agenda-event"
                        style={{
                          background: EVENT_COLORS[evt.type]?.bg,
                          borderLeftColor: EVENT_COLORS[evt.type]?.border,
                          color: EVENT_COLORS[evt.type]?.text,
                        }}
                        title={`${evt.title}${evt.subtitle ? ' — ' + evt.subtitle : ''}`}
                      >
                        <div className="agenda-event-icon">
                          {evt.type === 'mission' && <Briefcase size={12} />}
                          {evt.type === 'leave' && <Palmtree size={12} />}
                          {evt.type === 'unavailability' && <Ban size={12} />}
                          {evt.type === 'google' && <CalIcon size={12} />}
                        </div>
                        <div className="agenda-event-text">
                          <div className="agenda-event-title">{evt.title}</div>
                          {evt.subtitle && (
                            <div className="agenda-event-subtitle">{evt.subtitle}</div>
                          )}
                          {evt.location && (
                            <div className="agenda-event-location">
                              <MapPin size={10} /> {evt.location}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* === VUE MOIS === */
          <div className="agenda-month">
            <div className="agenda-month-header">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                <div key={d} className="agenda-month-day-label">{d}</div>
              ))}
            </div>
            <div className="agenda-month-grid">
              {/* Padding for first week */}
              {(() => {
                const firstDay = visibleDays[0];
                const dayOfWeek = (firstDay.getDay() + 6) % 7; // 0=Mon
                const padding = [];
                for (let i = 0; i < dayOfWeek; i++) {
                  padding.push(<div key={`pad-${i}`} className="agenda-month-cell empty" />);
                }
                return padding;
              })()}
              {visibleDays.map(day => {
                const dayEvents = getEventsForDay(day);
                return (
                  <div
                    key={day.toString()}
                    className={`agenda-month-cell ${isToday(day) ? 'today' : ''} ${!isSameMonth(day, agendaDate) ? 'other-month' : ''} ${isWeekend(day) ? 'weekend' : ''}`}
                  >
                    <div className="month-cell-date">
                      <span className={isToday(day) ? 'today-badge' : ''}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    <div className="month-cell-events">
                      {dayEvents.slice(0, 3).map(evt => (
                        <div
                          key={evt.id}
                          className="month-event-dot"
                          style={{
                            background: EVENT_COLORS[evt.type]?.border,
                          }}
                          title={evt.title}
                        >
                          <span className="month-event-label">{evt.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="month-event-more">+{dayEvents.length - 3}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PersonnelAgenda;
