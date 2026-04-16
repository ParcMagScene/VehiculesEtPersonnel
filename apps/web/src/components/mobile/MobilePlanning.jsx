import './MobilePlanning.css';

import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button, Tooltip } from '@/design-system';

import { STATUS } from '../../constants';
import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import PullToRefreshIndicator from './PullToRefreshIndicator';

function MobilePlanning({
  vehicles,
  reservations,
  maintenances,
  currentDate,
  onClose,
  clients: _clients = [],
  drivers: _drivers = [],
  onRefresh,
}) {
  const [selectedMonth, setSelectedMonth] = useState(currentDate);
  const scrollWrapperRef = useRef(null);

  const { containerProps: ptrProps, indicatorNode: ptrIndicator } = usePullToRefresh(onRefresh, {
    disabled: !onRefresh,
  });

  // Filtrer les véhicules propres (pas de location)
  const ownVehicles = vehicles.filter((v) => v.type !== 'location');

  // Générer tous les jours du mois sélectionné
  const monthDays = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    const days = [];
    let current = start;
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [selectedMonth]);

  // Obtenir les réservations qui commencent un jour donné OU qui sont en cours ce jour
  const getReservationsForDay = (vehicleId, day) => {
    const dayStart = startOfDay(day);

    return reservations.filter((r) => {
      if (r.vehicleId !== vehicleId) return false;
      if (!r.startDate || !r.endDate) return false;
      try {
        const resStart = startOfDay(new Date(r.startDate));
        const resEnd = startOfDay(new Date(r.endDate));
        if (isNaN(resStart.getTime()) || isNaN(resEnd.getTime())) return false;

        // Afficher la réservation si elle commence ce jour OU si elle est en cours ce jour
        const startsOnDay = resStart.getTime() === dayStart.getTime();
        const isOngoingOnDay =
          resStart.getTime() <= dayStart.getTime() && resEnd.getTime() >= dayStart.getTime();

        return startsOnDay || isOngoingOnDay;
      } catch (e) {
        return false;
      }
    });
  };

  // Obtenir les interventions qui commencent un jour donné
  const getMaintenancesStartingOnDay = (vehicleId, day) => {
    const dayStart = startOfDay(day);

    return maintenances.filter((m) => {
      if (m.vehicleId !== vehicleId) return false;
      if (!m.startDate) return false;
      // Ne pas afficher les pannes signalées et les demandes d'intervention
      if (m.status === 'reported' || m.status === 'requested') return false;
      const maintStart = startOfDay(new Date(m.startDate));
      return maintStart.getTime() === dayStart.getTime();
    });
  };

  // Calculer la durée en jours
  const calculateDuration = (startDate, endDate) => {
    if (!endDate) return 1;
    const start = startOfDay(new Date(startDate));
    const end = startOfDay(new Date(endDate));
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  };

  // Vérifier si deux éléments se chevauchent en tenant compte des périodes
  const doElementsOverlap = (elem1, elem2) => {
    const start1 = new Date(elem1.startDate);
    const end1 = new Date(elem1.endDate || elem1.startDate);
    const start2 = new Date(elem2.startDate);
    const end2 = new Date(elem2.endDate || elem2.startDate);

    // Pas de chevauchement si les dates ne se croisent pas
    if (end1 < start2 || end2 < start1) return false;

    // Si même jour, vérifier les périodes
    if (
      start1.toDateString() === start2.toDateString() &&
      end1.toDateString() === end2.toDateString()
    ) {
      // AM et PM ne se chevauchent pas
      if (
        (elem1.startPeriod === 'AM' &&
          elem1.endPeriod === 'AM' &&
          elem2.startPeriod === 'PM' &&
          elem2.endPeriod === 'PM') ||
        (elem1.startPeriod === 'PM' &&
          elem1.endPeriod === 'PM' &&
          elem2.startPeriod === 'AM' &&
          elem2.endPeriod === 'AM')
      ) {
        return false;
      }
    }

    return true;
  };

  // Calculer les rows pour un ensemble d'éléments (réservations + interventions)
  const calculateRows = (vehicleId, days) => {
    const allElements = [];

    // Collecter toutes les réservations
    days.forEach((day, dayIndex) => {
      const dayReservations = getReservationsForDay(vehicleId, day);
      dayReservations.forEach((res) => {
        allElements.push({
          ...res,
          type: 'reservation',
          dayIndex,
          duration: calculateDuration(res.startDate, res.endDate),
        });
      });

      const dayMaintenances = getMaintenancesStartingOnDay(vehicleId, day);
      dayMaintenances.forEach((maint) => {
        allElements.push({
          ...maint,
          type: 'maintenance',
          dayIndex,
          duration: calculateDuration(maint.startDate, maint.endDate),
        });
      });
    });

    // Assigner les rows en évitant les chevauchements
    const rows = [];
    allElements.forEach((elem) => {
      let assignedRow = -1;

      // Chercher une row disponible
      for (let r = 0; r < rows.length; r++) {
        let hasOverlap = false;
        for (let other of rows[r]) {
          if (doElementsOverlap(elem, other)) {
            hasOverlap = true;
            break;
          }
        }
        if (!hasOverlap) {
          assignedRow = r;
          break;
        }
      }

      // Si aucune row disponible, créer une nouvelle
      if (assignedRow === -1) {
        assignedRow = rows.length;
        rows.push([]);
      }

      elem.row = assignedRow + 1; // gridRow est 1-indexed
      rows[assignedRow].push(elem);
    });

    return allElements;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'reported':
        return STATUS_COLORS.danger;
      case 'scheduled':
        return STATUS_COLORS.warning;
      case 'in_progress':
      case 'IN_PROGRESS':
        return STATUS_COLORS.info;
      case 'pending':
      case 'PENDING':
        return ACCENT_COLORS.violet;
      case 'completed':
      case 'COMPLETED':
        return STATUS_COLORS.success;
      case 'rescheduled':
        return ACCENT_COLORS.orange;
      default:
        return 'var(--theme-text-gray)';
    }
  };

  const goToPreviousMonth = () => {
    setSelectedMonth((prev) => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setSelectedMonth((prev) => addMonths(prev, 1));
  };

  const goToCurrentMonth = () => {
    setSelectedMonth(new Date());
    // Le scroll vers aujourd'hui sera déclenché par useEffect
  };

  // Fonction pour scroller vers le jour actuel
  const scrollToToday = () => {
    const today = new Date();
    // Vérifier si aujourd'hui est dans le mois affiché
    if (
      today.getMonth() === selectedMonth.getMonth() &&
      today.getFullYear() === selectedMonth.getFullYear()
    ) {
      const todayIndex = monthDays.findIndex((day) => isSameDay(day, today));
      if (todayIndex !== -1 && scrollWrapperRef.current) {
        // Calculer la position de scroll (80px par colonne)
        const scrollPosition = todayIndex * 80;
        scrollWrapperRef.current.scrollTo({
          left: scrollPosition,
          behavior: 'smooth',
        });
      }
    }
  };

  // Scroller vers aujourd'hui au chargement et quand le mois change
  useEffect(() => {
    // Petit délai pour s'assurer que le DOM est prêt
    const timer = setTimeout(() => {
      scrollToToday();
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, monthDays]);

  return (
    <div className="mobile-planning" {...ptrProps}>
      <PullToRefreshIndicator indicator={ptrIndicator} />
      <div className="mobile-planning-header">
        <div className="month-navigation">
          <Button
            variant="ghost"
            className="month-nav-btn"
            onClick={goToPreviousMonth}
            aria-label="Mois précédent"
          >
            <ChevronLeft size={20} />
          </Button>
          <h2 onClick={goToCurrentMonth} style={{ cursor: 'pointer' }}>
            {format(selectedMonth, 'MMMM yyyy', { locale: fr })}
          </h2>
          <Button
            variant="ghost"
            className="month-nav-btn"
            onClick={goToNextMonth}
            aria-label="Mois suivant"
          >
            <ChevronRight size={20} />
          </Button>
          <Tooltip content="Aller à aujourd'hui" position="bottom">
            <Button variant="ghost" className="today-btn" onClick={scrollToToday}>
              <CalendarDays size={18} />
              <span>Aujourd'hui</span>
            </Button>
          </Tooltip>
        </div>
        <Button
          variant="ghost"
          className="close-button"
          onClick={onClose}
          aria-label="Fermer le planning"
        >
          <X size={24} />
        </Button>
      </div>

      <div className="mobile-planning-container">
        <div className="mobile-planning-scroll-wrapper" ref={scrollWrapperRef}>
          <div className="mobile-planning-scroll-content">
            {/* En-tête des jours - sticky */}
            <div className="mobile-days-header">
              {monthDays.map((day) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={day.toString()}
                    className={`mobile-day-column ${isToday ? 'today' : ''}`}
                  >
                    <div className="mobile-day-name">{format(day, 'EEE', { locale: fr })}</div>
                    <div className="mobile-day-date">{format(day, 'd', { locale: fr })}</div>
                  </div>
                );
              })}
            </div>

            {/* Grille des véhicules */}
            <div className="mobile-planning-vehicles">
              {ownVehicles.map((vehicle) => {
                // Calculer le nombre exact de colonnes
                const gridTemplateColumns = monthDays.map(() => '80px').join(' ');

                // Calculer les rows pour ce véhicule
                const vehicleElements = calculateRows(vehicle.id, monthDays);
                const reservationsWithRows = vehicleElements.filter(
                  (e) => e.type === 'reservation',
                );
                const maintenancesWithRows = vehicleElements.filter(
                  (e) => e.type === STATUS.MAINTENANCE,
                );

                return (
                  <div key={vehicle.id} className="mobile-vehicle-row">
                    <div className="mobile-vehicle-label-wrapper">
                      <div className="mobile-vehicle-label">
                        <div className="mobile-vehicle-name">{vehicle.name}</div>
                        <div className="mobile-vehicle-registration">{vehicle.registration}</div>
                      </div>
                    </div>

                    <div className="mobile-days-grid" style={{ gridTemplateColumns }}>
                      {/* Cellules vides pour la structure */}
                      {monthDays.map((day, index) => (
                        <div
                          key={day.toString()}
                          className="mobile-day-cell"
                          style={{ gridColumn: index + 1 }}
                        ></div>
                      ))}
                      {/* Réservations (affichées en premier, en arrière-plan) */}
                      {reservationsWithRows.map((reservation) => {
                        return (
                          <div
                            key={reservation.id}
                            className="mobile-reservation"
                            style={{
                              gridColumn: `${reservation.dayIndex + 1} / span ${reservation.duration}`,
                              gridRow: reservation.row,
                              backgroundColor:
                                vehicle.displayColor || vehicle.color || STATUS_COLORS.info,
                            }}
                          >
                            <div className="mobile-reservation-content-wrapper">
                              <div className="mobile-reservation-inner">
                                <div className="mobile-item-icon">
                                  <Calendar size={12} />
                                </div>
                                <div className="mobile-item-content">
                                  <div className="mobile-item-title">
                                    {reservation.clientName ||
                                      reservation.driverName ||
                                      'Réservation'}
                                  </div>
                                  <div className="mobile-item-subtitle">
                                    {format(new Date(reservation.startDate), 'dd/MM')}
                                    {reservation.endDate &&
                                      reservation.endDate !== reservation.startDate &&
                                      ` - ${format(new Date(reservation.endDate), 'dd/MM')}`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Interventions (affichées par-dessus les réservations) */}
                      {maintenancesWithRows.map((maintenance) => {
                        return (
                          <div
                            key={maintenance.id}
                            className={`mobile-maintenance mobile-maintenance-${maintenance.status}`}
                            style={{
                              borderLeftColor: getStatusColor(maintenance.status),
                              gridColumn: `${maintenance.dayIndex + 1} / span ${maintenance.duration}`,
                              gridRow: maintenance.row,
                            }}
                          >
                            <div className="mobile-maintenance-content-wrapper">
                              <div className="mobile-maintenance-inner">
                                <div className="mobile-item-icon">
                                  {maintenance.status === 'reported' ? (
                                    <AlertTriangle size={12} />
                                  ) : (
                                    <Wrench size={12} />
                                  )}
                                </div>
                                <div className="mobile-item-content">
                                  <div className="mobile-item-title">
                                    {maintenance.description?.substring(0, 20) || 'Maintenance'}
                                  </div>
                                  <div className="mobile-item-subtitle">
                                    {format(new Date(maintenance.startDate), 'dd/MM')}
                                    {maintenance.endDate &&
                                      ` - ${format(new Date(maintenance.endDate), 'dd/MM')}`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MobilePlanning;
