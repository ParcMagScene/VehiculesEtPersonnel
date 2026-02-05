import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Settings, Truck, XCircle, ClipboardList, AlertTriangle, CalendarCheck, Bell, QrCode, LayoutGrid, Users } from 'lucide-react';
import api from '../utils/api';
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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [pendingAccessRequests, setPendingAccessRequests] = useState(0);

  // Charger le nombre de demandes d'accès en attente (pour admins uniquement)
  useEffect(() => {
    const loadPendingRequests = async () => {
      if (currentUser?.isAdmin) {
        try {
          const data = await api.getPendingAccessRequestsCount();
          setPendingAccessRequests(data.count || 0);
        } catch (error) {
          console.error('Erreur chargement demandes:', error);
        }
      }
    };
    
    loadPendingRequests();
    // Recharger toutes les 30 secondes
    const interval = setInterval(loadPendingRequests, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);
  
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
          <img src="/Logos/LogoMagSav.svg" alt="Mag Scène" className="header-logo" />
          <h1 className="header-title"><Truck className="title-icon" strokeWidth={2.5} size={32} /> Véhicules</h1>
        </div>
        
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
            {/* Badge de notification unifié */}
            {allNotifications.length > 0 && (
              <div 
                className={`notification-badge unified ${
                  immobilizedVehicles.length > 0 ? 'has-critical' : 
                  conflictingMaintenances.length > 0 ? 'has-conflict' : 
                  reportedMaintenances.length > 0 ? 'has-reported' : 
                  pendingMaintenances.length > 0 ? 'has-pending' : 
                  'has-scheduled'
                }`}
                onClick={() => {
                  setNotificationFilter('all');
                  setShowNotificationsPopup(true);
                }}
                style={{ position: 'relative' }}
              >
                <Bell size={16} strokeWidth={2.5} />
                <span className="notification-count">{allNotifications.length}</span>
                {(immobilizedVehicles.length > 0 || conflictingMaintenances.length > 0) && (
                  <span className="notification-alert-badge">
                    <AlertTriangle size={10} strokeWidth={3} />
                  </span>
                )}
              </div>
            )}
            
            {currentUser && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  title={currentUser.name}
                  aria-label={`Menu utilisateur (${currentUser.name})`}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${getColorFromName(currentUser.name)} 0%, ${adjustColor(getColorFromName(currentUser.name), -20)} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    color: 'white',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    padding: 0
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'scale(1.1)';
                    e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'scale(1)';
                    e.target.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.2)';
                  }}
                >
                  {getInitials(currentUser.name)}
                </button>

                {showUserMenu && (
                  <>
                    <div 
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 999
                      }}
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '50px',
                        right: 0,
                        background: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                        overflow: 'hidden',
                        minWidth: '200px',
                        zIndex: 1000
                      }}
                    >
                      <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        background: '#f9fafb'
                      }}>
                        <div style={{ fontWeight: 600, color: '#1f2937' }}>{currentUser.name}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                          {currentUser.isAdmin ? 'Administrateur' : 'Utilisateur'}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onLogout();
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          background: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#374151',
                          transition: 'background 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
                        onMouseLeave={(e) => e.target.style.background = 'white'}
                      >
                        <LayoutGrid size={16} />
                        Changer d'utilisateur
                      </button>

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onLogout();
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          background: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#dc2626',
                          transition: 'background 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontWeight: 500
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#fef2f2'}
                        onMouseLeave={(e) => e.target.style.background = 'white'}
                      >
                        <XCircle size={16} />
                        Se déconnecter
                      </button>

                      <button
                        onClick={() => setShowUserMenu(false)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          borderTop: '1px solid #e5e7eb',
                          background: '#f9fafb',
                          textAlign: 'center',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#6b7280',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                        onMouseLeave={(e) => e.target.style.background = '#f9fafb'}
                      >
                        Annuler
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <button className="qr-button" onClick={() => setShowQRCodeModal(true)} aria-label="Afficher le QR code mobile">
              <QrCode size={20} />
            </button>

            <button 
              className="management-button" 
              onClick={onOpenManagement} 
              aria-label="Ouvrir le panneau de gestion"
              style={{ position: 'relative' }}
            >
              <Settings size={20} />
              Gestion
              {currentUser?.isAdmin && pendingAccessRequests > 0 && (
                <span 
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: '#ef4444',
                    color: 'white',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  {pendingAccessRequests}
                </span>
              )}
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
