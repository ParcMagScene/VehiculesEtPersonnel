import './PersonnelAgenda.css';

import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button, EmptyState } from '@/design-system';

import PersonnelAgendaSidebar from './PersonnelAgendaSidebar';
import PersonnelAgendaToolbar from './PersonnelAgendaToolbar';
import PersonnelAgendaWeekView from './PersonnelAgendaWeekView';
import PersonnelAgendaMonthView from './PersonnelAgendaMonthView';

import { STATUS } from '../../constants';
import { STATUS_COLORS } from '../../constants/colors';
import api from '../../utils/api';

// Couleurs par type d'événement
const EVENT_COLORS = {
  mission: {
    bg: 'var(--theme-info-bg-strong)',
    border: STATUS_COLORS.info,
    text: 'var(--theme-info-text)',
  },
  leave: {
    bg: 'var(--theme-success-bg-strong)',
    border: STATUS_COLORS.success,
    text: 'var(--theme-success-text)',
  },
  unavailability: {
    bg: 'var(--btn-danger-bg)',
    border: STATUS_COLORS.danger,
    text: 'var(--theme-danger-text)',
  },
  google: {
    bg: 'var(--btn-warning-bg)',
    border: STATUS_COLORS.warning,
    text: 'var(--theme-warning-text)',
  },
};

export { EVENT_COLORS };

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
      const self = persons.find(
        (p) =>
          p.email === currentUser.email ||
          (p.first_name === currentUser.firstName && p.last_name === currentUser.lastName),
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

  const visibleDays = useMemo(
    () => eachDayOfInterval({ start: dateRange.start, end: dateRange.end }),
    [dateRange],
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
        api
          .getAllLeaves({ personId: selectedPersonId, startDate: startStr, endDate: endStr })
          .catch(() => []),
        api
          .getAvailabilities({ personId: selectedPersonId, startDate: startStr, endDate: endStr })
          .catch(() => []),
      ]);

      // Filtrer les missions assignées à cette personne
      const personMissions = (missionsData || []).filter((m) => {
        const assignments =
          typeof m.assignments_json === 'string'
            ? JSON.parse(m.assignments_json || '[]')
            : m.assignments || [];
        return assignments.some(
          (a) => a.person_id === selectedPersonId || a.personId === selectedPersonId,
        );
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

  useEffect(() => {
    loadAgendaData();
  }, [loadAgendaData]);

  // Événements Google Calendar pour la personne
  const personGoogleEvents = useMemo(() => {
    if (!selectedPersonId || !googleEvents.length) return [];
    const person = persons.find((p) => p.id === selectedPersonId);
    if (!person?.email) return [];
    return googleEvents.filter(
      (e) =>
        e.attendees?.some((a) => a.email === person.email) || e.organizer?.email === person.email,
    );
  }, [selectedPersonId, googleEvents, persons]);

  // Événements d'un jour donné
  const getEventsForDay = useCallback(
    (day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const result = [];

      // Missions
      events.missions.forEach((m) => {
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
      events.leaves.forEach((l) => {
        const start = l.start_date || l.startDate;
        const end = l.end_date || l.endDate || start;
        if (start <= dayStr && end >= dayStr) {
          result.push({
            id: `leave-${l.id}`,
            type: 'leave',
            title: LEAVE_TYPE_LABELS[l.leave_type || l.leaveType] || l.leave_type || 'Congé',
            subtitle:
              l.status === STATUS.APPROVED
                ? 'Validé'
                : l.status === STATUS.PENDING
                  ? 'En attente'
                  : l.status,
            raw: l,
          });
        }
      });

      // Indisponibilités
      events.unavailabilities.forEach((u) => {
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
      personGoogleEvents.forEach((g) => {
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
    },
    [events, personGoogleEvents],
  );

  // Navigation
  const navigate = (direction) => {
    const delta = direction === 'prev' ? -1 : 1;
    if (agendaView === 'week') {
      setAgendaDate((d) => addWeeks(d, delta));
    } else {
      setAgendaDate((d) => addMonths(d, delta));
    }
  };

  const goToday = () => setAgendaDate(new Date());

  // Personne sélectionnée
  const selectedPerson = persons.find((p) => p.id === selectedPersonId);

  // Titre de la période
  const periodTitle =
    agendaView === 'week'
      ? format(dateRange.start, "'Semaine du' d MMMM yyyy", { locale: fr })
      : format(agendaDate, 'MMMM yyyy', { locale: fr });

  return (
    <div className="personnel-agenda">
      {/* Barre latérale - sélection personne */}
      <PersonnelAgendaSidebar
        persons={persons}
        selectedPersonId={selectedPersonId}
        onSelectPerson={setSelectedPersonId}
        searchPerson={searchPerson}
        onSearchChange={setSearchPerson}
      />

      {/* Zone principale */}
      <div className="agenda-main">
        {/* Toolbar */}
        <PersonnelAgendaToolbar
          selectedPerson={selectedPerson}
          agendaView={agendaView}
          onViewChange={setAgendaView}
          periodTitle={periodTitle}
          onNavigate={navigate}
          onToday={goToday}
        />

        {/* Grille calendrier */}
        {loading ? (
          <div className="agenda-loading">
            <Clock size={20} className="spinning" />
            <span>Chargement...</span>
          </div>
        ) : !selectedPersonId ? (
          <EmptyState
            icon={<Users size={48} />}
            title="Sélectionnez une personne pour voir son agenda"
          />
        ) : agendaView === 'week' ? (
          <PersonnelAgendaWeekView visibleDays={visibleDays} getEventsForDay={getEventsForDay} />
        ) : (
          <PersonnelAgendaMonthView
            visibleDays={visibleDays}
            agendaDate={agendaDate}
            getEventsForDay={getEventsForDay}
          />
        )}
      </div>
    </div>
  );
}

export default PersonnelAgenda;
