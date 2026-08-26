import './PlanningView.css';

import { addDays, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, Ban, Briefcase, Calendar, Clock, Users, Wrench } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/design-system';

import { STATUS } from '../../constants';
import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import api from '../../utils/api';

function PlanningView({
  vehicles = [],
  reservations = [],
  maintenances = [],
  currentDate,
  onVehicleClick,
  onVehicleContextMenu,
  onOpenReservation,
  onOpenMaintenance,
  clients = [],
  drivers = [],
  persons = [],
}) {
  const [planningMode, setPlanningMode] = useState('vehicles'); // 'vehicles' | 'personnel'
  const [personnelData, setPersonnelData] = useState({ missions: [], availabilities: [] });
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);
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

  // Charger les données planning personnel
  const loadPersonnelPlanning = useCallback(async () => {
    if (planningMode !== 'personnel' || weekDays.length === 0) return;
    setLoadingPersonnel(true);
    try {
      const data = await api.getPersonnelPlanning({
        start_date: format(weekDays[0], 'yyyy-MM-dd'),
        end_date: format(weekDays[weekDays.length - 1], 'yyyy-MM-dd'),
      });
      setPersonnelData(data);
    } catch (error) {
      console.error('Erreur chargement planning personnel:', error);
    } finally {
      setLoadingPersonnel(false);
    }
  }, [planningMode, weekDays]);

  useEffect(() => {
    loadPersonnelPlanning();
  }, [loadPersonnelPlanning]);

  // Missions par personne par jour
  const getMissionsForPersonDay = useCallback(
    (personId, day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      return personnelData.missions.filter((m) => {
        if (!m.assignments?.some((a) => a.person_id === personId)) return false;
        return m.start_date <= dayStr && m.end_date >= dayStr;
      });
    },
    [personnelData.missions],
  );

  // Indisponibilités par personne par jour
  const getUnavailabilitiesForPersonDay = useCallback(
    (personId, day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      return personnelData.availabilities.filter((a) => {
        return (
          a.person_id === personId &&
          a.start_date <= dayStr &&
          a.end_date >= dayStr &&
          (a.type || '').toLowerCase() !== 'entreprise'
        );
      });
    },
    [personnelData.availabilities],
  );

  const getEnterprisePresenceForPersonDay = useCallback(
    (personId, day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      return personnelData.availabilities.filter((a) => {
        return (
          a.person_id === personId &&
          a.start_date <= dayStr &&
          a.end_date >= dayStr &&
          (a.type || '').toLowerCase() === 'entreprise'
        );
      });
    },
    [personnelData.availabilities],
  );

  const vehicleDayReservations = useMemo(() => {
    const grouped = new Map();

    for (const reservation of reservations) {
      if (reservation.vehicleId == null || !reservation.date) continue;
      const startDate = parseISO(reservation.date);
      const endDate = reservation.endDate ? parseISO(reservation.endDate) : startDate;
      for (let day = startDate; day <= endDate; day = addDays(day, 1)) {
        const dayKey = format(day, 'yyyy-MM-dd');
        if (!grouped.has(reservation.vehicleId)) grouped.set(reservation.vehicleId, new Map());
        const vehicleMap = grouped.get(reservation.vehicleId);
        if (!vehicleMap.has(dayKey)) vehicleMap.set(dayKey, []);
        vehicleMap.get(dayKey).push(reservation);
      }
    }

    return grouped;
  }, [reservations]);

  const vehicleDayMaintenances = useMemo(() => {
    const grouped = new Map();

    for (const maintenance of maintenances) {
      if (maintenance.vehicleId == null || !maintenance.startDate) continue;
      const startDate = parseISO(maintenance.startDate);
      const endDate = maintenance.endDate ? parseISO(maintenance.endDate) : startDate;
      for (let day = startDate; day <= endDate; day = addDays(day, 1)) {
        const dayKey = format(day, 'yyyy-MM-dd');
        if (!grouped.has(maintenance.vehicleId)) grouped.set(maintenance.vehicleId, new Map());
        const vehicleMap = grouped.get(maintenance.vehicleId);
        if (!vehicleMap.has(dayKey)) vehicleMap.set(dayKey, []);
        vehicleMap.get(dayKey).push(maintenance);
      }
    }

    return grouped;
  }, [maintenances]);

  const getReservationsForDay = useCallback(
    (vehicleId, day) => {
      return vehicleDayReservations.get(vehicleId)?.get(format(day, 'yyyy-MM-dd')) || [];
    },
    [vehicleDayReservations],
  );

  const getMaintenancesForDay = useCallback(
    (vehicleId, day) => {
      return vehicleDayMaintenances.get(vehicleId)?.get(format(day, 'yyyy-MM-dd')) || [];
    },
    [vehicleDayMaintenances],
  );

  // Obtenir le client
  const getClient = (clientId) => {
    return clients.find((c) => c.id === clientId);
  };

  // Obtenir le conducteur
  const getDriver = (driverId) => {
    return drivers.find((d) => d.id === driverId);
  };

  // Obtenir la couleur de statut
  const getStatusColor = (status) => {
    switch (status) {
      case 'reported':
        return STATUS_COLORS.danger;
      case 'scheduled':
        return STATUS_COLORS.warning;
      case 'in_progress':
        return STATUS_COLORS.info;
      case 'pending':
        return ACCENT_COLORS.violet;
      case 'completed':
        return STATUS_COLORS.success;
      case 'rescheduled':
        return ACCENT_COLORS.orange;
      default:
        return 'var(--theme-text-gray)';
    }
  };

  // Couleur par type de mission
  const getMissionColor = (type) => {
    switch (type) {
      case 'intervention':
        return STATUS_COLORS.info;
      case 'livraison':
        return STATUS_COLORS.success;
      case 'installation':
        return ACCENT_COLORS.violet;
      case 'maintenance':
        return STATUS_COLORS.warning;
      case 'depannage':
        return STATUS_COLORS.danger;
      default:
        return 'var(--theme-text-gray)';
    }
  };

  const getMissionLabel = (type) => {
    switch (type) {
      case 'intervention':
        return 'Intervention';
      case 'livraison':
        return 'Livraison';
      case 'installation':
        return 'Installation';
      case 'maintenance':
        return 'Maintenance';
      case 'depannage':
        return 'Dépannage';
      default:
        return type || 'Mission';
    }
  };

  return (
    <div className="planning-view">
      <div className="planning-header">
        <div className="planning-week-title">
          {format(weekDays[0], "'Semaine du' d MMMM yyyy", { locale: fr })}
        </div>
        <div className="planning-mode-toggle">
          <Button
            variant="ghost"
            className={`planning-mode-btn ${planningMode === 'vehicles' ? 'active' : ''}`}
            onClick={() => setPlanningMode('vehicles')}
          >
            <Calendar size={16} />
            <span>Véhicules</span>
          </Button>
          <Button
            variant="ghost"
            className={`planning-mode-btn ${planningMode === 'personnel' ? 'active' : ''}`}
            onClick={() => setPlanningMode('personnel')}
          >
            <Users size={16} />
            <span>Personnel</span>
          </Button>
        </div>
      </div>

      <div className="planning-container">
        {/* Colonne fixe */}
        <div className="planning-vehicles-column">
          <div className="planning-column-header">
            {planningMode === 'vehicles' ? 'Véhicules' : 'Personnel'}
          </div>
          <div className="planning-vehicles-list">
            {planningMode === 'vehicles'
              ? vehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className={`planning-vehicle-row ${onVehicleContextMenu || onVehicleClick ? 'vehicle-editable' : ''}`}
                    onClick={() => {
                      if (!onVehicleClick) return;
                      onVehicleClick(vehicle);
                    }}
                    onContextMenu={(e) => {
                      if (!onVehicleContextMenu) return;
                      e.preventDefault();
                      e.stopPropagation();
                      onVehicleContextMenu(vehicle);
                    }}
                    title={
                      onVehicleContextMenu || onVehicleClick
                        ? 'Clic pour modifier, clic droit pour accès contextuel'
                        : undefined
                    }
                  >
                    <div className="planning-vehicle-name">{vehicle.name}</div>
                    <div className="planning-vehicle-registration">{vehicle.registration}</div>
                  </div>
                ))
              : persons.map((person) => (
                  <div key={person.id} className="planning-vehicle-row planning-person-row">
                    <div className="planning-vehicle-name">
                      {person.first_name} {person.last_name}
                    </div>
                    <div className="planning-vehicle-registration">
                      {person.role || person.position || ''}
                    </div>
                  </div>
                ))}
          </div>
        </div>

        {/* Grille scrollable */}
        <div className="planning-grid-container">
          <div className="planning-days-header">
            {weekDays.map((day) => (
              <div key={day.toString()} className="planning-day-header">
                <div className="planning-day-name">{format(day, 'EEEE', { locale: fr })}</div>
                <div className="planning-day-date">{format(day, 'd MMM', { locale: fr })}</div>
              </div>
            ))}
          </div>

          <div className="planning-grid">
            {planningMode === 'vehicles' ? (
              /* === GRILLE VÉHICULES === */
              vehicles.map((vehicle) => (
                <div key={vehicle.id} className="planning-grid-row">
                  {weekDays.map((day) => {
                    const dayReservations = getReservationsForDay(vehicle.id, day);
                    const dayMaintenances = getMaintenancesForDay(vehicle.id, day);

                    return (
                      <div key={day.toString()} className="planning-cell">
                        {dayReservations.map((reservation) => {
                          const client = getClient(reservation.clientId);
                          const driver = getDriver(reservation.driverId);

                          return (
                            <div
                              key={reservation.id}
                              className="planning-reservation"
                              role="button"
                              tabIndex={0}
                              onClick={() => onOpenReservation && onOpenReservation(reservation)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onOpenReservation?.(reservation);
                                }
                              }}
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
                                  {reservation.period === 'AM'
                                    ? 'Matin'
                                    : reservation.period === 'PM'
                                      ? 'Après-midi'
                                      : 'Journée'}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {dayMaintenances.map((maintenance) => (
                          <div
                            key={maintenance.id}
                            className={`planning-maintenance planning-maintenance-${maintenance.status}`}
                            role="button"
                            tabIndex={0}
                            style={{ borderLeftColor: getStatusColor(maintenance.status) }}
                            onClick={() =>
                              onOpenMaintenance && onOpenMaintenance(vehicle, maintenance.id)
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onOpenMaintenance?.(vehicle, maintenance.id);
                              }
                            }}
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
                                {maintenance.status === 'reported'
                                  ? 'Panne'
                                  : maintenance.status === STATUS.SCHEDULED
                                    ? 'Programmée'
                                    : maintenance.status === 'in_progress'
                                      ? 'En cours'
                                      : maintenance.status === STATUS.PENDING
                                        ? 'Demande'
                                        : 'Terminée'}
                              </div>
                            </div>
                          </div>
                        ))}

                        {dayReservations.length === 0 && dayMaintenances.length === 0 && (
                          <div className="planning-cell-empty"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : /* === GRILLE PERSONNEL === */
            loadingPersonnel ? (
              <div className="planning-loading">
                <Clock size={20} className="spinning" />
                <span>Chargement du planning personnel...</span>
              </div>
            ) : (
              persons.map((person) => (
                <div key={person.id} className="planning-grid-row">
                  {weekDays.map((day) => {
                    const missions = getMissionsForPersonDay(person.id, day);
                    const unavailabilities = getUnavailabilitiesForPersonDay(person.id, day);
                    const enterprisePresences = getEnterprisePresenceForPersonDay(person.id, day);
                    const isUnavailable = unavailabilities.length > 0;

                    return (
                      <div
                        key={day.toString()}
                        className={`planning-cell ${isUnavailable ? 'planning-cell-unavailable' : ''}`}
                      >
                        {/* Indisponibilités */}
                        {unavailabilities.map((ua, i) => (
                          <div key={`ua-${i}`} className="planning-unavailability">
                            <Ban size={12} />
                            <span>{ua.reason || 'Indisponible'}</span>
                          </div>
                        ))}

                        {enterprisePresences.map((ep, i) => (
                          <div key={`ep-${i}`} className="planning-enterprise">
                            <Briefcase size={12} />
                            <span>{ep.reason || 'Présence entreprise'}</span>
                          </div>
                        ))}

                        {/* Missions */}
                        {missions.map((mission) => (
                          <div
                            key={mission.id}
                            className="planning-mission"
                            style={{ borderLeftColor: getMissionColor(mission.type) }}
                            title={`${getMissionLabel(mission.type)} — ${mission.description || ''}`}
                          >
                            <div className="planning-mission-icon">
                              <Briefcase size={14} />
                            </div>
                            <div className="planning-mission-info">
                              <div
                                className="planning-mission-type"
                                style={{ color: getMissionColor(mission.type) }}
                              >
                                {getMissionLabel(mission.type)}
                              </div>
                              {mission.client_name && (
                                <div className="planning-mission-client">{mission.client_name}</div>
                              )}
                              {mission.location && (
                                <div className="planning-mission-location">{mission.location}</div>
                              )}
                            </div>
                          </div>
                        ))}

                        {missions.length === 0 &&
                          !isUnavailable &&
                          enterprisePresences.length === 0 && (
                            <div className="planning-cell-empty planning-cell-available">
                              <span className="available-dot"></span>
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlanningView;
