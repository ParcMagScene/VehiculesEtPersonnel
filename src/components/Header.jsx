import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Settings, Truck, XCircle, ClipboardList, AlertTriangle, CalendarCheck, Bell, QrCode, LayoutGrid } from 'lucide-react';
import { format, isSameWeek, isSameMonth, isSameYear, startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPeriodTimestamp } from '../utils/dateUtils';
import MonthSelector from './MonthSelector';
import WeekSelector from './WeekSelector';
import YearSelector from './YearSelector';
import QRCodeModal from './QRCodeModal';

// Générer les initiales à partir du nom
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Générer une couleur unique basée sur le nom
const getColorFromName = (name) => {
  if (!name) return '#6b7280';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', 
    '#10b981', '#06b6d4', '#6366f1', '#f97316',
    '#14b8a6', '#a855f7', '#ef4444', '#84cc16'
  ];
  return colors[Math.abs(hash) % colors.length];
};

// Ajuster la luminosité d'une couleur
const adjustColor = (color, percent) => {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255))
    .toString(16).slice(1);
};

const Header = ({ view, setView, currentDate, setCurrentDate, onOpenManagement, maintenances = [], vehicles = [], onOpenVehicleMaintenance, onOpenMaintenance, reservations = [], currentUser, onLogout }) => {
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState('all'); // 'all', 'scheduled', 'reported'
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [showWeekSelector, setShowWeekSelector] = useState(false);
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [showYearSelector, setShowYearSelector] = useState(false);
  
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
  const inProgressMaintenances = maintenances.filter(m => m.status === 'in_progress');
  const immobilizedVehicles = reportedMaintenances.filter(m => m.isImmobilized);
  
  // Détecter les interventions en conflit avec des réservations
  const conflictingMaintenances = scheduledMaintenances.filter(m => {
    const conflicts = getMaintenanceConflicts(m);
    return conflicts.length > 0;
  });
  
  const allNotifications = [...reportedMaintenances, ...scheduledMaintenances, ...pendingMaintenances, ...inProgressMaintenances];
  
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
    let label = '';
    if (view === 'week') {
      label = format(currentDate, "'Semaine du' d MMMM yyyy", { locale: fr });
    } else if (view === 'month') {
      label = format(currentDate, 'MMMM yyyy', { locale: fr });
    } else {
      label = format(currentDate, 'yyyy', { locale: fr });
    }
    // Mettre une majuscule à la première lettre
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  // Vérifier si on est dans la période actuelle
  const isCurrentPeriod = () => {
    const today = new Date();
    if (view === 'week') {
      return isSameWeek(currentDate, today, { weekStartsOn: 1 });
    } else if (view === 'month') {
      return isSameMonth(currentDate, today);
    } else {
      return isSameYear(currentDate, today);
    }
  };
  
  const showTodayHighlight = !isCurrentPeriod();

  return (
    <>
    <div className="header">
      <div className="header-content">
        <div className="header-title-container">
          <img src="/Logos/LogoMagSceneBLACK.gif" alt="Mag Scène" className="header-logo" />
          <h1 className="header-title"><Truck className="title-icon" strokeWidth={2.5} size={32} /> Véhicules</h1>
        </div>
        
        {/* Notifications de pannes */}
        {(reportedMaintenances.length > 0 || scheduledMaintenances.length > 0 || pendingMaintenances.length > 0 || inProgressMaintenances.length > 0) && (
          <div className="maintenance-notifications">
            {immobilizedVehicles.length > 0 && (
              <div 
                className="notification-badge immobilized"
                onClick={() => {
                  setNotificationFilter('reported');
                  setShowNotificationsPopup(true);
                }}
              >
                <XCircle size={18} strokeWidth={2.5} /> {immobilizedVehicles.length} véhicule{immobilizedVehicles.length > 1 ? 's' : ''} immobilisé{immobilizedVehicles.length > 1 ? 's' : ''}
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
                <ClipboardList size={18} strokeWidth={2.5} /> {pendingMaintenances.length} demande{pendingMaintenances.length > 1 ? 's' : ''} d'intervention
              </div>
            )}
            {inProgressMaintenances.length > 0 && (
              <div 
                className="notification-badge in-progress"
                onClick={() => {
                  setNotificationFilter('in_progress');
                  setShowNotificationsPopup(true);
                }}
              >
                <CalendarCheck size={18} strokeWidth={2.5} /> {inProgressMaintenances.length} intervention{inProgressMaintenances.length > 1 ? 's' : ''} en cours
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
                <AlertTriangle size={18} strokeWidth={2.5} /> {reportedMaintenances.length - immobilizedVehicles.length} panne{reportedMaintenances.length - immobilizedVehicles.length > 1 ? 's' : ''} signalée{reportedMaintenances.length - immobilizedVehicles.length > 1 ? 's' : ''}
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
                <CalendarCheck size={18} strokeWidth={2.5} /> {scheduledMaintenances.length} intervention{scheduledMaintenances.length > 1 ? 's' : ''} programmée{scheduledMaintenances.length > 1 ? 's' : ''}
                {conflictingMaintenances.length > 0 && (
                  <span className="conflict-badge"><AlertTriangle size={14} strokeWidth={2.5} /></span>
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
                <h3><Bell size={20} strokeWidth={2.5} className="popup-icon" /> Notifications</h3>
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
                        <h4 className="notification-section-title"><CalendarCheck size={18} strokeWidth={2.5} /> Interventions programmées</h4>
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

                    {/* Section Interventions en cours */}
                    {(notificationFilter === 'all' || notificationFilter === 'in_progress') && inProgressMaintenances.length > 0 && (
                      <div className="notification-section">
                        <h4 className="notification-section-title"><CalendarCheck size={18} strokeWidth={2.5} /> Interventions en cours</h4>
                        <div className="notifications-list">
                          {inProgressMaintenances.map(maintenance => {
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
                                  <span className="notification-status in-progress">
                                    En cours
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
                        <h4 className="notification-section-title"><ClipboardList size={18} strokeWidth={2.5} /> Demandes d'intervention</h4>
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
                        <h4 className="notification-section-title"><AlertTriangle size={18} strokeWidth={2.5} /> Pannes signalées</h4>
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
                                    {maintenance.isImmobilized && <XCircle size={16} strokeWidth={2.5} className="inline-icon" />}
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
            <button 
              className={`nav-button ${showTodayHighlight ? 'today-highlight' : ''}`}
              onClick={goToToday} 
              aria-label="Revenir à aujourd'hui"
              style={showTodayHighlight ? {
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                borderColor: '#3b82f6',
                fontWeight: 600
              } : {}}
            >
              Aujourd'hui
            </button>
            <button className="nav-button" onClick={goToNext} aria-label="Période suivante">
              <ChevronRight size={20} />
            </button>
            <div 
              className={`current-date ${(view === 'month' || view === 'week' || view === 'year') ? 'clickable' : ''}`}
              aria-live="polite" 
              aria-atomic="true"
              onClick={() => {
                if (view === 'month') setShowMonthSelector(true);
                if (view === 'week') setShowWeekSelector(true);
                if (view === 'year') setShowYearSelector(true);
              }}
              title={
                view === 'month' ? 'Cliquer pour sélectionner un mois' : 
                view === 'week' ? 'Cliquer pour sélectionner une semaine' : 
                view === 'year' ? 'Cliquer pour sélectionner une année' : 
                undefined
              }
            >
              {getDateLabel()}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {currentUser && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                fontSize: '14px',
                color: 'white',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${getColorFromName(currentUser.name)} 0%, ${adjustColor(getColorFromName(currentUser.name), -20)} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  color: 'white',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)'
                }}>
                  {getInitials(currentUser.name)}
                </div>
                <span style={{ fontWeight: '500' }}>{currentUser.name}</span>
                <button 
                  onClick={onLogout}
                  style={{
                    background: 'rgba(239, 68, 68, 0.9)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(220, 38, 38, 1)';
                    e.target.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(239, 68, 68, 0.9)';
                    e.target.style.transform = 'scale(1)';
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Déconnexion
                </button>
              </div>
            )}

            <button className="qr-button" onClick={() => setShowQRCodeModal(true)} aria-label="Afficher le QR code mobile">
              <QrCode size={20} />
            </button>

            <button className="management-button" onClick={onOpenManagement} aria-label="Ouvrir le panneau de gestion">
              <Settings size={20} />
              Gestion
            </button>
          </div>
        </div>
      </div>
    </div>

    {showQRCodeModal && (
      <QRCodeModal onClose={() => setShowQRCodeModal(false)} />
    )}

    {showMonthSelector && (
      <MonthSelector
        currentDate={currentDate}
        onSelectMonth={setCurrentDate}
        onClose={() => setShowMonthSelector(false)}
        reservations={reservations}
        vehicles={vehicles}
      />
    )}

    {showWeekSelector && (
      <WeekSelector
        currentDate={currentDate}
        onSelectWeek={setCurrentDate}
        onClose={() => setShowWeekSelector(false)}
        reservations={reservations}
        vehicles={vehicles}
      />
    )}

    {showYearSelector && (
      <YearSelector
        currentDate={currentDate}
        onSelectYear={setCurrentDate}
        onClose={() => setShowYearSelector(false)}
        reservations={reservations}
      />
    )}
  </>
  );
};

export default Header;
