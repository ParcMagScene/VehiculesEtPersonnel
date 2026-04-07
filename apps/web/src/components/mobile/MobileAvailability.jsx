import { useState } from 'react';
import { format, addDays, startOfDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Car, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { getVehicleAvatar } from '../../utils/vehicleAvatars';
import { STATUS } from '../../constants';

import { Button } from '@/design-system';
import './MobileAvailability.css';

function MobileAvailability({ vehicles, reservations, maintenances, onClose, onCreateReservation }) {
  const [currentDay, setCurrentDay] = useState(startOfDay(new Date()));

  // Filtrer les véhicules (pas de location)
  const ownVehicles = vehicles.filter(v => v.type !== 'location');

  // Vérifier si un véhicule est disponible pour un jour donné
  const isVehicleAvailable = (vehicleId, day) => {
    const dayStart = startOfDay(day);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    // Vérifier réservations
    const hasReservation = reservations.some(r => {
      if (r.vehicleId !== vehicleId) return false;
      const resStart = parseISO(r.date);
      const resEnd = r.endDate ? parseISO(r.endDate) : resStart;
      return dayStart <= resEnd && dayEnd >= resStart;
    });

    if (hasReservation) return false;

    // Vérifier interventions
    const hasMaintenance = maintenances.some(m => {
      if (m.vehicleId !== vehicleId) return false;
      if (!m.startDate || m.status === STATUS.COMPLETED) return false;
      const maintStart = parseISO(m.startDate);
      const maintEnd = m.endDate ? parseISO(m.endDate) : maintStart;
      return dayStart <= maintEnd && dayEnd >= maintStart;
    });

    return !hasMaintenance;
  };

  // Obtenir les véhicules disponibles pour le jour actuel
  const availableVehicles = ownVehicles.filter(v => isVehicleAvailable(v.id, currentDay));

  const goToPreviousDay = () => {
    setCurrentDay(addDays(currentDay, -1));
  };

  const goToNextDay = () => {
    setCurrentDay(addDays(currentDay, 1));
  };

  const goToToday = () => {
    setCurrentDay(startOfDay(new Date()));
  };

  const isToday = startOfDay(new Date()).getTime() === currentDay.getTime();

  return (
    <div className="mobile-availability">
      <div className="availability-header">
        <Button variant="ghost" className="back-button" onClick={onClose}>
          <ChevronLeft size={24} />
        </Button>
        <h2>Disponibilités</h2>
      </div>

      {/* Navigation par jour */}
      <div className="day-navigation">
        <Button variant="ghost" className="nav-button" onClick={goToPreviousDay}>
          <ChevronLeft size={20} />
        </Button>
        
        <div className="current-day">
          <div className="day-name">
            {format(currentDay, 'EEEE', { locale: fr })}
          </div>
          <div className="day-date">
            {format(currentDay, 'd MMMM yyyy', { locale: fr })}
          </div>
        </div>

        <Button variant="ghost" className="nav-button" onClick={goToNextDay}>
          <ChevronRight size={20} />
        </Button>
      </div>

      {!isToday && (
        <Button variant="ghost" className="today-button" onClick={goToToday}>
          Aujourd'hui
        </Button>
      )}

      {/* Statistiques */}
      <div className="availability-stats">
        <div className="stat available">
          <span className="stat-value">{availableVehicles.length}</span>
          <span className="stat-label">disponibles</span>
        </div>
        <div className="stat total">
          <span className="stat-value">{ownVehicles.length}</span>
          <span className="stat-label">total</span>
        </div>
      </div>

      {/* Liste des véhicules */}
      <div className="vehicles-list">
        {availableVehicles.length === 0 ? (
          <div className="empty-state">
            <Car size={48} />
            <p>Aucun véhicule disponible ce jour</p>
          </div>
        ) : (
          availableVehicles.map(vehicle => (
            <div key={vehicle.id} className="vehicle-card">
              <div className="vehicle-photo-thumb">
                {vehicle.photo ? (
                  <img
                    src={`/Photos/${vehicle.photo}`}
                    alt={vehicle.name}
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                  />
                ) : (
                  <img src={getVehicleAvatar(vehicle.type)} alt={vehicle.name} className="vehicle-avatar" />
                )}
              </div>
              <div className="vehicle-info">
                <div className="vehicle-name">{vehicle.name}</div>
                <div className="vehicle-meta-line">
                  {vehicle.brand && <span className="vehicle-brand-tag">{vehicle.brand}</span>}
                  <span className="vehicle-type-tag">{vehicle.type}</span>
                </div>
                <div className="vehicle-registration">{vehicle.registration}</div>
              </div>
              
              {onCreateReservation && (
                <Button variant="ghost" 
                  className="reserve-button"
                  onClick={() => onCreateReservation(vehicle.id, currentDay)}
                >
                  <Calendar size={18} />
                  Réserver
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Véhicules occupés */}
      {ownVehicles.length > availableVehicles.length && (
        <div className="unavailable-section">
          <h3>Véhicules occupés ({ownVehicles.length - availableVehicles.length})</h3>
          <div className="unavailable-list">
            {ownVehicles
              .filter(v => !isVehicleAvailable(v.id, currentDay))
              .map(vehicle => {
                // Trouver la raison
                const reservation = reservations.find(r => {
                  if (r.vehicleId !== vehicle.id) return false;
                  const dayStart = startOfDay(currentDay);
                  const dayEnd = new Date(dayStart);
                  dayEnd.setHours(23, 59, 59, 999);
                  const resStart = new Date(r.date);
                  const resEnd = r.endDate ? new Date(r.endDate) : resStart;
                  return dayStart <= resEnd && dayEnd >= resStart;
                });

                const maintenance = maintenances.find(m => {
                  if (m.vehicleId !== vehicle.id) return false;
                  if (!m.startDate || m.status === STATUS.COMPLETED) return false;
                  const dayStart = startOfDay(currentDay);
                  const dayEnd = new Date(dayStart);
                  dayEnd.setHours(23, 59, 59, 999);
                  const maintStart = new Date(m.startDate);
                  const maintEnd = m.endDate ? new Date(m.endDate) : maintStart;
                  return dayStart <= maintEnd && dayEnd >= maintStart;
                });

                const reason = maintenance 
                  ? `Intervention: ${maintenance.description}`
                  : reservation
                  ? 'Réservé'
                  : 'Occupé';

                return (
                  <div key={vehicle.id} className="unavailable-item">
                    <div className="vehicle-photo-thumb small">
                      {vehicle.photo ? (
                        <img
                          src={`/Photos/${vehicle.photo}`}
                          alt={vehicle.name}
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                      ) : (
                        <img src={getVehicleAvatar(vehicle.type)} alt={vehicle.name} className="vehicle-avatar" />
                      )}
                    </div>
                    <div className="vehicle-info">
                      <div className="vehicle-name">{vehicle.name}</div>
                      <div className="vehicle-registration">{vehicle.registration}</div>
                    </div>
                    <div className="unavailable-reason">{reason}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileAvailability;
