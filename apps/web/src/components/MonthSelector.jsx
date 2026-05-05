import './MonthSelector.css';

import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo } from 'react';

import { Modal, ModalBody, ModalHeader } from '@/design-system';

import { STATUS_COLORS } from '../constants/colors';

function MonthSelector({ currentDate, onSelectMonth, onClose, reservations = [], vehicles = [] }) {
  // Générer les 12 mois de l'année en cours
  const months = useMemo(() => {
    return eachMonthOfInterval({
      start: startOfYear(currentDate),
      end: endOfYear(currentDate),
    });
  }, [currentDate]);

  // Obtenir les réservations pour un mois donné
  const getMonthReservations = (monthDate) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    return reservations.filter((r) => {
      const rDate = new Date(r.date);
      return rDate >= monthStart && rDate <= monthEnd;
    });
  };

  // Générer les pastilles de couleur pour un mois
  const renderMonthDots = (monthDate) => {
    const monthReservations = getMonthReservations(monthDate);
    const days = eachDayOfInterval({
      start: startOfMonth(monthDate),
      end: endOfMonth(monthDate),
    });

    // Créer une grille 7x6 pour représenter le mois
    const grid = [];
    const firstDay = days[0].getDay(); // 0 = dimanche
    const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Lundi = 0

    // Remplir la grille
    for (let i = 0; i < 42; i++) {
      // 6 semaines max
      const dayIndex = i - startOffset;
      if (dayIndex >= 0 && dayIndex < days.length) {
        const day = days[dayIndex];
        const dayReservations = monthReservations.filter((r) => {
          const rDate = new Date(r.date);
          return rDate.getDate() === day.getDate();
        });

        // Récupérer les couleurs des véhicules réservés ce jour
        const colors = new Set();
        dayReservations.forEach((r) => {
          const vehicle = vehicles.find((v) => v.id === r.vehicleId);
          if (vehicle) {
            colors.add(vehicle.displayColor || vehicle.color || STATUS_COLORS.info);
          }
        });

        grid.push(
          <div key={i} className="month-selector-day">
            {colors.size > 0 && (
              <div className="day-dots">
                {Array.from(colors)
                  .slice(0, 3)
                  .map((color, idx) => (
                    <div key={idx} className="day-dot" style={{ backgroundColor: color }} />
                  ))}
              </div>
            )}
          </div>,
        );
      } else {
        grid.push(<div key={i} className="month-selector-day empty" />);
      }
    }

    return grid;
  };

  const handleMonthClick = (monthDate) => {
    onSelectMonth(monthDate);
    onClose();
  };

  const currentMonthIndex = currentDate.getMonth();

  return (
    <Modal open onClose={onClose} size="lg" className="month-selector-modal">
      <ModalHeader onClose={onClose}>
        Sélectionner un mois - {format(currentDate, 'yyyy', { locale: fr })}
      </ModalHeader>
      <ModalBody>
        <div className="month-selector-grid">
          {months.map((monthDate, index) => (
            <div
              key={index}
              className={`month-selector-item ${index === currentMonthIndex ? 'current' : ''}`}
              onClick={() => handleMonthClick(monthDate)}
            >
              <div className="month-selector-name">{format(monthDate, 'MMMM', { locale: fr })}</div>
              <div className="month-selector-mini-calendar">{renderMonthDots(monthDate)}</div>
            </div>
          ))}
        </div>
      </ModalBody>
    </Modal>
  );
}

export default MonthSelector;
