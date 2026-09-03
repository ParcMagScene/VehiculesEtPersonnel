import { Users } from 'lucide-react';
import { useMemo } from 'react';

import { Avatar, Button, SearchBar } from '@/design-system';

import { STATUS_COLORS } from '../../constants/colors';

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

export const PersonnelAgendaSidebar = ({
  persons = [],
  selectedPersonId,
  onSelectPerson,
  searchPerson,
  onSearchChange,
}) => {
  // Filtre personnes
  const filteredPersons = useMemo(() => {
    if (!searchPerson) return persons;
    const q = searchPerson.toLowerCase();
    return persons.filter(
      (p) =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q),
    );
  }, [persons, searchPerson]);

  return (
    <div className="agenda-sidebar">
      <div className="agenda-sidebar-header">
        <Users size={18} />
        <span>Personnel</span>
      </div>
      <SearchBar
        value={searchPerson}
        onChange={onSearchChange}
        placeholder="Rechercher..."
        size="sm"
      />
      <div className="agenda-person-list">
        {filteredPersons.map((person) => (
          <Button
            variant="ghost"
            key={person.id}
            className={`agenda-person-item ${person.id === selectedPersonId ? 'active' : ''}`}
            onClick={() => onSelectPerson(person.id)}
          >
            <Avatar name={`${person.first_name || ''} ${person.last_name || ''}`} size="sm" />
            <div className="agenda-person-info">
              <div className="agenda-person-name">
                {person.first_name} {person.last_name}
              </div>
              <div className="agenda-person-role">
                {person.role || person.position || person.type || ''}
              </div>
            </div>
          </Button>
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
  );
};

export default PersonnelAgendaSidebar;
