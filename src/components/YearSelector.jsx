import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import './YearSelector.css';

function YearSelector({ currentDate, onSelectYear, onClose, reservations = [] }) {
  // Générer une grille de 16 années centrée sur l'année actuelle
  const years = useMemo(() => {
    const currentYear = currentDate.getFullYear();
    const yearsArray = [];
    
    // Générer 16 années (-8 à +7)
    for (let i = -8; i < 8; i++) {
      yearsArray.push(currentYear + i);
    }
    
    return yearsArray;
  }, [currentDate]);

  // Vérifier si une année a des réservations
  const hasReservations = (year) => {
    return reservations.some(r => {
      const rDate = new Date(r.date);
      return rDate.getFullYear() === year;
    });
  };

  // Gérer le clic sur une année
  const handleYearClick = (year) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(year);
    onSelectYear(newDate);
    onClose();
  };

  const currentYear = currentDate.getFullYear();
  const todayYear = new Date().getFullYear();

  return (
    <div className="year-selector-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="year-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="year-selector-header">
          <h3>Sélectionner une année</h3>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="year-selector-grid">
          {years.map((year) => {
            const isCurrent = year === currentYear;
            const isToday = year === todayYear;
            const hasRes = hasReservations(year);
            
            return (
              <button
                key={year}
                className={`year-item ${isCurrent ? 'current' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => handleYearClick(year)}
              >
                <span className="year-number">{year}</span>
                {hasRes && (
                  <div className="year-indicator" title="Année avec réservations">
                    <div className="indicator-dot" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default YearSelector;
