import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPeriodTimestamp } from '../utils/dateUtils';

const Header = ({ view, setView, currentDate, setCurrentDate, onOpenManagement, maintenances = [], vehicles = [], onOpenVehicleMaintenance, onOpenMaintenance, reservations = [] }) => {
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState('all'); // 'all', 'scheduled', 'reported'
  
  // Fonction pour détecter les conflits entre une intervention et les réservations
  const getMaintenanceConflicts = (maintenance) => {
    if (!maintenance.startDate || !maintenance.endDate) return [];
    
    const newStart = getPeriodTimestamp(maintenance.startDate, 'AM');
    const newEnd = getPeriodTimestamp(maintenance.endDate, 'PM');
    
    const conflicts = [];
    for (const r of reservations) {
      if (String(r.vehicleId) !== String(maintenance.vehicleId)) continue;
      
      const existingStart = getPeriodTimestamp(r.date, r.period);
      const existingEnd = getPeriodTimestamp(
        r.endDate || r.date,
        r.endPeriod || r.period
      );
      
      if (Math.max(newStart, existingStart) <= Math.min(newEnd, existingEnd)) {
        conflicts.push(r);
      }
    }
    return conflicts;
  };
  
  // Compter les pannes signalées, interventions programmées et demandes d'intervention
  const reportedMaintenances = maintenances.filter(m => m.status === 'reported');
  const scheduledMaintenances = maintenances.filter(m => m.status === 'scheduled');
  const pendingMaintenances = maintenances.filter(m => m.status === 'pending');
  const immobilizedVehicles = reportedMaintenances.filter(m => m.isImmobilized);
  
  // Détecter les interventions en conflit avec des réservations
  const conflictingMaintenances = scheduledMaintenances.filter(m => {
    const conflicts = getMaintenanceConflicts(m);
    return conflicts.length > 0;
  });
  
  const allNotifications = [...reportedMaintenances, ...scheduledMaintenances, ...pendingMaintenances];
  
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (view === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDateLabel = () => {
    if (view === 'week') {
      return format(currentDate, "'Semaine du' d MMMM yyyy", { locale: fr });
    } else if (view === 'month') {
      return format(currentDate, 'MMMM yyyy', { locale: fr });
    } else {
      return format(currentDate, 'yyyy', { locale: fr });
    }
  };

  return (
    <div className="header">
      <div className="header-content">
        <h1 className="header-title">🚛 Véhicules</h1>
        
        {/* Notifications de pannes */}
        {(reportedMaintenances.length > 0 || scheduledMaintenances.length > 0 || pendingMaintenances.length > 0) && (
          <div className="maintenance-notifications">
            {immobilizedVehicles.length > 0 && (
              <div 
                className="notification-badge immobilized"
                onClick={() => {
                  setNotificationFilter('reported');
                  setShowNotificationsPopup(true);
                }}
              >
                🚫 {immobilizedVehicles.length} véhicule{immobilizedVehicles.length > 1 ? 's' : ''} immobilisé{immobilizedVehicles.length > 1 ? 's' : ''}
              </div>
            )}
            {pendingMaintenances.length > 0 && (
              <div 
                className="notification-badge pending"
                onClick={() => {
                  setNotificationFilter('pending');
                  setShowNotificationsPopup(true);
                }}
              >
                📝 {pendingMaintenances.length} demande{pendingMaintenances.length > 1 ? 's' : ''} d'intervention
              </div>
            )}
            {reportedMaintenances.length > immobilizedVehicles.length && (
              <div 
                className="notification-badge reported"
                onClick={() => {
                  setNotificationFilter('reported');
                  setShowNotificationsPopup(true);
                }}
              >
                ⚠️ {reportedMaintenances.length - immobilizedVehicles.length} panne{reportedMaintenances.length - immobilizedVehicles.length > 1 ? 's' : ''} signalée{reportedMaintenances.length - immobilizedVehicles.length > 1 ? 's' : ''}
              </div>
            )}
            {scheduledMaintenances.length > 0 && (
              <div 
                className={`notification-badge ${conflictingMaintenances.length > 0 ? 'conflict' : 'scheduled'}`}
                onClick={() => {
                  setNotificationFilter('scheduled');
                  setShowNotificationsPopup(true);
                }}
                style={{ position: 'relative' }}
              >
                📅 {scheduledMaintenances.length} intervention{scheduledMaintenances.length > 1 ? 's' : ''} programmée{scheduledMaintenances.length > 1 ? 's' : ''}
                {conflictingMaintenances.length > 0 && (
                  <span className="conflict-badge">⚠️</span>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Popup des notifications */}
        {showNotificationsPopup && (
          <div className="notifications-popup-overlay" onClick={() => setShowNotificationsPopup(false)}>
            <div className="notifications-popup" onClick={(e) => e.stopPropagation()}>
              <div className="notifications-popup-header">
                <h3>🔔 Notifications</h3>
                <button className="close-popup-button" onClick={() => setShowNotificationsPopup(false)}>✕</button>
              </div>
              <div className="notifications-popup-content">
                {allNotifications.length === 0 ? (
                  <p className="no-notifications">Aucune notification</p>
                ) : (
                  <>
                    {/* Section Interventions programmées */}
                    {(notificationFilter === 'all' || notificationFilter === 'scheduled') && scheduledMaintenances.length > 0 && (
                      <div className="notification-section">
                        <h4 className="notification-section-title">📅 Interventions programmées</h4>
                        <div className="notifications-list">
                          {scheduledMaintenances.map(maintenance => {
                            const vehicle = vehicles.find(v => v.id === maintenance.vehicleId);
                            
                            return (
                              <div 
                                key={maintenance.id} 
                                className="notification-item"
                                onClick={() => {
                                  setShowNotificationsPopup(false);
                                  if (onOpenMaintenance && vehicle) {
                                    onOpenMaintenance(vehicle, maintenance.id);
                                  }
                                }}
                              >
                                <div className="notification-item-header">
                                  <span className="notification-vehicle-name">
                                    {vehicle?.name || 'Véhicule inconnu'}
                                  </span>
                                  <span className="notification-status scheduled">
                                    Programmée
                                  </span>
                                </div>
                                <p className="notification-description">{maintenance.description}</p>
                                {maintenance.startDate && (
                                  <span className="notification-date">
                                    {maintenance.startDate === maintenance.endDate 
                                      ? format(new Date(maintenance.startDate), 'dd/MM/yyyy')
                                      : `${format(new Date(maintenance.startDate), 'dd/MM')} - ${format(new Date(maintenance.endDate), 'dd/MM/yyyy')}`
                                    }
                                  </span>
                                )}
                                {vehicle?.registration && (
                                  <span className="notification-registration">{vehicle.registration}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Section Demandes d'intervention */}
                    {(notificationFilter === 'all' || notificationFilter === 'pending') && pendingMaintenances.length > 0 && (
                      <div className="notification-section">
                        <h4 className="notification-section-title">📝 Demandes d'intervention</h4>
                        <div className="notifications-list">
                          {pendingMaintenances.map(maintenance => {
                            const vehicle = vehicles.find(v => v.id === maintenance.vehicleId);
                            
                            return (
                              <div 
                                key={maintenance.id} 
                                className="notification-item"
                                onClick={() => {
                                  setShowNotificationsPopup(false);
                                  if (onOpenMaintenance && vehicle) {
                                    onOpenMaintenance(vehicle, maintenance.id);
                                  }
                                }}
                              >
                                <div className="notification-item-header">
                                  <span className="notification-vehicle-name">
                                    {vehicle?.name || 'Véhicule inconnu'}
                                  </span>
                                  <span className="notification-status pending">
                                    En attente
                                  </span>
                                </div>
                                <p className="notification-description">{maintenance.description}</p>
                                {vehicle?.registration && (
                                  <span className="notification-registration">{vehicle.registration}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Section Pannes signalées */}
                    {(notificationFilter === 'all' || notificationFilter === 'reported') && reportedMaintenances.length > 0 && (
                      <div className="notification-section">
                        <h4 className="notification-section-title">⚠️ Pannes signalées</h4>
                        <div className="notifications-list">
                          {reportedMaintenances.map(maintenance => {
                            const vehicle = vehicles.find(v => v.id === maintenance.vehicleId);
                            
                            return (
                              <div 
                                key={maintenance.id} 
                                className="notification-item"
                                onClick={() => {
                                  setShowNotificationsPopup(false);
                                  if (onOpenMaintenance && vehicle) {
                                    onOpenMaintenance(vehicle, maintenance.id);
                                  }
                                }}
                              >
                                <div className="notification-item-header">
                                  <span className="notification-vehicle-name">
                                    {maintenance.isImmobilized && '🚫 '}
                                    {vehicle?.name || 'Véhicule inconnu'}
                                  </span>
                                  <span className="notification-status reported">
                                    {maintenance.isImmobilized ? 'Immobilisé' : 'Signalée'}
                                  </span>
                                </div>
                                <p className="notification-description">{maintenance.description}</p>
                                {vehicle?.registration && (
                                  <span className="notification-registration">{vehicle.registration}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="header-controls">
          <div className="view-selector" role="group" aria-label="Sélection de la vue">
            <button
              className={`view-button ${view === 'week' ? 'active' : ''}`}
              onClick={() => setView('week')}
              aria-label="Afficher la vue semaine"
              aria-pressed={view === 'week'}
            >
              Semaine
            </button>
            <button
              className={`view-button ${view === 'month' ? 'active' : ''}`}
              onClick={() => setView('month')}
              aria-label="Afficher la vue mois"
              aria-pressed={view === 'month'}
            >
              Mois
            </button>
            <button
              className={`view-button ${view === 'year' ? 'active' : ''}`}
              onClick={() => setView('year')}
              aria-label="Afficher la vue année"
              aria-pressed={view === 'year'}
            >
              Année
            </button>
          </div>

          <div className="date-navigation" role="navigation" aria-label="Navigation de dates">
            <button className="nav-button" onClick={goToPrevious} aria-label="Période précédente">
              <ChevronLeft size={20} />
            </button>
            <button className="nav-button" onClick={goToToday} aria-label="Revenir à aujourd'hui">
              Aujourd'hui
            </button>
            <button className="nav-button" onClick={goToNext} aria-label="Période suivante">
              <ChevronRight size={20} />
            </button>
            <div className="current-date" aria-live="polite" aria-atomic="true">{getDateLabel()}</div>
          </div>

          <button className="management-button" onClick={onOpenManagement} aria-label="Ouvrir le panneau de gestion">
            <Settings size={20} />
            Gestion
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header;
