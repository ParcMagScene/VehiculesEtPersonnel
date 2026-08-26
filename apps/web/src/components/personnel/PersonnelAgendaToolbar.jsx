import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/design-system';

export const PersonnelAgendaToolbar = ({
  selectedPerson,
  agendaView,
  onViewChange,
  periodTitle,
  onNavigate,
  onToday,
}) => {
  return (
    <div className="agenda-toolbar">
      <div className="agenda-toolbar-left">
        <h2 className="agenda-person-title">
          {selectedPerson
            ? `${selectedPerson.first_name} ${selectedPerson.last_name}`
            : 'Sélectionnez une personne'}
        </h2>
      </div>
      <div className="agenda-toolbar-center">
        <Button variant="ghost" className="agenda-nav-btn" onClick={() => onNavigate('prev')}>
          <ChevronLeft size={18} />
        </Button>
        <span className="agenda-period-title">{periodTitle}</span>
        <Button variant="ghost" className="agenda-nav-btn" onClick={() => onNavigate('next')}>
          <ChevronRight size={18} />
        </Button>
        <Button variant="ghost" className="agenda-today-btn" onClick={onToday}>
          Aujourd'hui
        </Button>
      </div>
      <div className="agenda-toolbar-right">
        <div className="agenda-view-toggle">
          <Button
            variant="ghost"
            className={agendaView === 'week' ? 'active' : ''}
            onClick={() => onViewChange('week')}
          >
            Semaine
          </Button>
          <Button
            variant="ghost"
            className={agendaView === 'month' ? 'active' : ''}
            onClick={() => onViewChange('month')}
          >
            Mois
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PersonnelAgendaToolbar;
