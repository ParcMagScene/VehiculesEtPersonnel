import './WeekSelector.css';

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getWeek,
  isSameDay,
  isSameWeek,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { X } from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/design-system';

import { STATUS_COLORS } from '../constants/colors';

function WeekSelector({ currentDate, onSelectWeek, onClose, reservations = [], vehicles = [] }) {
  // Générer les jours du mois actuel
  const monthDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    });
  }, [currentDate]);

  // Obtenir le premier jour du mois (pour calculer l'offset)
  const firstDayOfMonth = startOfMonth(currentDate);
  const startOffset = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1; // Lundi = 0

  // Obtenir les réservations pour un jour donné
  const getDayReservations = (day) => {
    return reservations.filter((r) => {
      const rStartDate = new Date(r.date);
      const rEndDate = r.endDate ? new Date(r.endDate) : rStartDate;

      // Vérifier si le jour est dans la plage de la réservation
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      return rStartDate <= dayEnd && rEndDate >= dayStart;
    });
  };

  // Gérer le clic sur une semaine
  const handleWeekClick = (weekDate) => {
    onSelectWeek(weekDate);
    onClose();
  };

  // Générer les semaines uniques du mois
  const weeks = useMemo(() => {
    const weeksSet = new Set();
    monthDays.forEach((day) => {
      const weekStart = startOfWeek(day, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      if (!weeksSet.has(weekKey)) {
        weeksSet.add(weekKey);
      }
    });
    return Array.from(weeksSet).map((key) => new Date(key));
  }, [monthDays]);

  const _currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

  return (
    <div
      className="week-selector-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="week-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="week-selector-header">
          <h3>Sélectionner une semaine - {format(currentDate, 'MMMM yyyy', { locale: fr })}</h3>
          <Button variant="ghost" className="close-button" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        <div className="week-selector-calendar">
          {/* En-tête des jours */}
          <div className="week-selector-weekdays">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
              <div key={day} className="weekday-name">
                {day}
              </div>
            ))}
          </div>

          {/* Grille des jours */}
          <div className="week-selector-days-grid">
            {/* Espaces vides avant le premier jour */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="week-selector-day empty" />
            ))}

            {/* Jours du mois */}
            {monthDays.map((day, index) => {
              const dayReservations = getDayReservations(day);
              const weekStart = startOfWeek(day, { weekStartsOn: 1 });
              const isCurrentWeek = isSameWeek(day, currentDate, { weekStartsOn: 1 });
              const isToday = isSameDay(day, new Date());
              const weekNum = getWeek(day, { weekStartsOn: 1 });

              // Récupérer les couleurs des véhicules réservés ce jour
              const colors = new Set();
              dayReservations.forEach((r) => {
                const vehicle = vehicles.find((v) => v.id === r.vehicleId);
                if (vehicle) {
                  colors.add(vehicle.displayColor || vehicle.color || STATUS_COLORS.info);
                }
              });

              // Vérifier si c'est le premier jour de la semaine (lundi)
              const isMonday = day.getDay() === 1;

              return (
                <div
                  key={index}
                  className={`week-selector-day ${isCurrentWeek ? 'current-week' : ''} ${isToday ? 'today' : ''} ${isMonday ? 'week-start' : ''}`}
                  onClick={() => handleWeekClick(weekStart)}
                  title={`Semaine ${weekNum}`}
                >
                  {isMonday && <div className="week-number-badge">S{weekNum}</div>}
                  <div className="day-number">{format(day, 'd')}</div>
                  {colors.size > 0 && (
                    <div className="day-dots">
                      {Array.from(colors)
                        .slice(0, 3)
                        .map((color, idx) => (
                          <div key={idx} className="day-dot" style={{ backgroundColor: color }} />
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Liste des semaines cliquables */}
          <div className="week-selector-list">
            <h4>Semaines du mois</h4>
            <div className="weeks-list">
              {weeks.map((weekStart, index) => {
                const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                const weekNum = getWeek(weekStart, { weekStartsOn: 1 });
                const isCurrentWeek = isSameWeek(weekStart, currentDate, { weekStartsOn: 1 });

                return (
                  <Button
                    variant="ghost"
                    key={index}
                    className={`week-item ${isCurrentWeek ? 'current' : ''}`}
                    onClick={() => handleWeekClick(weekStart)}
                  >
                    <span className="week-number">Semaine {weekNum}</span>
                    <span className="week-dates">
                      {format(weekStart, 'd MMM', { locale: fr })} -{' '}
                      {format(weekEnd, 'd MMM', { locale: fr })}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WeekSelector;
