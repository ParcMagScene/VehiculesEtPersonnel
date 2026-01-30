import React, { useMemo } from 'react';
import { format, addDays, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Wrench, AlertTriangle, Calendar } from 'lucide-react';
import './PlanningView.css';

function PlanningView({ 
  vehicles = [], 
  reservations = [], 
  maintenances = [], 
  currentDate,
  onOpenReservation,
  onOpenMaintenance,
  clients = [],
  drivers = []
}) {
  // Générer les jours de la semaine
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = [];
    let current = start;
    
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    
    return days;
  }, [currentDate]);

  // Obtenir les réservations pour un véhicule et un jour
  const getReservationsForDay = (vehicleId, day) => {
    return reservations.filter(r => {
      if (r.vehicleId !== vehicleId) return false;
      const startDate = parseISO(r.date);
      const endDate = r.endDate ? parseISO(r.endDate) : startDate;
      return day >= startDate && day <= endDate;
    });
  };

  // Obtenir les interventions pour un véhicule et un jour
  const getMaintenancesForDay = (vehicleId, day) => {
    return maintenances.filter(m => {
      if (m.vehicleId !== vehicleId) return false;
      if (!m.startDate) return false;
      const startDate = parseISO(m.startDate);
      const endDate = m.endDate ? parseISO(m.endDate) : startDate;
      return day >= startDate && day <= endDate;
    });
  };

  // Obtenir le client
  const getClient = (clientId) => {
    return clients.find(c => c.id === clientId);
  };

  // Obtenir le conducteur
  const getDriver = (driverId) => {
    return drivers.find(d => d.id === driverId);
  };

  // Obtenir la couleur de statut
  const getStatusColor = (status) => {
    switch(status) {
      case 'reported': return '#ef4444';
      case 'scheduled': return '#f59e0b';
      case 'in_progress': return '#3b82f6';
      case 'pending': return '#8b5cf6';
      case 'completed': return '#10b981';
      default: return '#6b7280';
    }
  };

  return (
    <div className="planning-view">
      <div className="planning-header">
        <div className="planning-week-title">
          {format(weekDays[0], "'Semaine du' d MMMM yyyy", { locale: fr })}
        </div>
      </div>

      <div className="planning-container">
        {/* Colonne fixe des véhicules */}
        <div className="planning-vehicles-column">
          <div className="planning-column-header">Véhicules</div>
          <div className="planning-vehicles-list">
            {vehicles.map(vehicle => (
              <div key={vehicle.id} className="planning-vehicle-row">
                <div className="planning-vehicle-name">{vehicle.name}</div>
                <div className="planning-vehicle-registration">{vehicle.registration}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grille scrollable */}
        <div className="planning-grid-container">
          <div className="planning-days-header">
            {weekDays.map(day => (
              <div key={day.toString()} className="planning-day-header">
                <div className="planning-day-name">
                  {format(day, 'EEEE', { locale: fr })}
                </div>
                <div className="planning-day-date">
                  {format(day, 'd MMM', { locale: fr })}
                </div>
              </div>
            ))}
          </div>

          <div className="planning-grid">
            {vehicles.map(vehicle => (
              <div key={vehicle.id} className="planning-grid-row">
                {weekDays.map(day => {
                  const dayReservations = getReservationsForDay(vehicle.id, day);
                  const dayMaintenances = getMaintenancesForDay(vehicle.id, day);
                  
                  return (
                    <div key={day.toString()} className="planning-cell">
                      {/* Réservations */}
                      {dayReservations.map(reservation => {
                        const client = getClient(reservation.clientId);
                        const driver = getDriver(reservation.driverId);
                        
                        return (
                          <div
                            key={reservation.id}
                            className="planning-reservation"
                            onClick={() => onOpenReservation && onOpenReservation(reservation)}
                            title={`${client?.name || 'Client'} - ${driver?.name || 'Conducteur'}`}
                          >
                            <div className="planning-reservation-icon">
                              <Calendar size={14} />
                            </div>
                            <div className="planning-reservation-info">
                              <div className="planning-reservation-client">
                                {client?.name || 'Client'}
                              </div>
                              <div className="planning-reservation-period">
                                {reservation.period === 'AM' ? 'Matin' : 
                                 reservation.period === 'PM' ? 'Après-midi' : 'Journée'}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Interventions */}
                      {dayMaintenances.map(maintenance => (
                        <div
                          key={maintenance.id}
                          className={`planning-maintenance planning-maintenance-${maintenance.status}`}
                          style={{ borderLeftColor: getStatusColor(maintenance.status) }}
                          onClick={() => onOpenMaintenance && onOpenMaintenance(vehicle, maintenance.id)}
                          title={maintenance.description}
                        >
                          <div className="planning-maintenance-icon">
                            {maintenance.status === 'reported' ? (
                              <AlertTriangle size={14} />
                            ) : (
                              <Wrench size={14} />
                            )}
                          </div>
                          <div className="planning-maintenance-info">
                            <div className="planning-maintenance-description">
                              {maintenance.description}
                            </div>
                            <div className="planning-maintenance-status">
                              {maintenance.status === 'reported' ? 'Panne' :
                               maintenance.status === 'scheduled' ? 'Programmée' :
                               maintenance.status === 'in_progress' ? 'En cours' :
                               maintenance.status === 'pending' ? 'Demande' : 'Terminée'}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Cellule vide */}
                      {dayReservations.length === 0 && dayMaintenances.length === 0 && (
                        <div className="planning-cell-empty"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlanningView;
