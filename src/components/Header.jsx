import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Settings, Truck, XCircle, ClipboardList, AlertTriangle, CalendarCheck, Bell, QrCode, LayoutGrid, Users, Clock, Check, X, Wrench, Calendar, UserCog } from 'lucide-react';
import api from '../utils/api';
import { format, isSameWeek, isSameMonth, isSameYear, startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPeriodTimestamp } from '../utils/dateUtils';
import MonthSelector from './MonthSelector';
import WeekSelector from './WeekSelector';
import YearSelector from './YearSelector';
import QRCodeModal from './QRCodeModal';
import OverdueInterventionModal from './OverdueInterventionModal';
import UserAvatar from './UserAvatar';
import ProfileEditModal from './ProfileEditModal';

const Header = ({ view, setView, currentDate, setCurrentDate, onOpenManagement, onOpenSettings, activeModule, setActiveModule, maintenances = [], vehicles = [], onOpenVehicleMaintenance, onOpenMaintenance, reservations = [], currentUser, onLogout, onUpdateMaintenance, onRefreshMaintenances, onReservationUpdate, onUserUpdate }) => {
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState('all'); // 'all', 'scheduled', 'reported'
  const [selectedOverdueIntervention, setSelectedOverdueIntervention] = useState(null);
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [showWeekSelector, setShowWeekSelector] = useState(false);
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [showYearSelector, setShowYearSelector] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [pendingAccessRequests, setPendingAccessRequests] = useState(0);
  const [showRequestsPopup, setShowRequestsPopup] = useState(false);
  const [pendingRequestsCounts, setPendingRequestsCounts] = useState({ interventionRequests: 0, reservationRequests: 0, total: 0 });
  const [pendingReservationRequests, setPendingReservationRequests] = useState([]);
  const [expandedReportedId, setExpandedReportedId] = useState(null);
  const [rejectingRequestId, setRejectingRequestId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Charger les demandes en attente (interventions + réservations) pour le badge admin
  useEffect(() => {
    const loadPendingRequestsCounts = async () => {
      if (currentUser?.isAdmin) {
        try {
          const data = await api.getPendingRequestsCount();
          setPendingRequestsCounts(data);
        } catch (error) {
          console.error('Erreur chargement comptage demandes:', error);
        }
      }
    };
    
    loadPendingRequestsCounts();
    const interval = setInterval(loadPendingRequestsCounts, 30000);
    return () => clearInterval(interval);
  }, [currentUser, maintenances]);

  // Charger les demandes de réservation en attente (au démarrage + quand un popup s'ouvre)
  useEffect(() => {
    const loadPendingReservations = async () => {
      if (currentUser?.isAdmin) {
        try {
          const data = await api.getPendingReservationRequests();
          setPendingReservationRequests(data);
        } catch (error) {
          console.error('Erreur chargement demandes de réservation:', error);
        }
      }
    };
    loadPendingReservations();
  }, [showRequestsPopup, showNotificationsPopup, currentUser]);

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
  
  // Détecter les conflits pour une demande de réservation
  const getRequestConflicts = (request) => {
    if (!request.startDate || !request.endDate) return [];
    const reqStart = getPeriodTimestamp(request.startDate, request.startPeriod || 'AM');
    const reqEnd = getPeriodTimestamp(request.endDate, request.endPeriod || 'PM');
    
    const conflicts = [];
    for (const r of reservations) {
      if (String(r.vehicleId) !== String(request.vehicleId)) continue;
      const existingStart = getPeriodTimestamp(r.date, r.period);
      const existingEnd = getPeriodTimestamp(r.endDate || r.date, r.endPeriod || r.period);
      if (Math.max(reqStart, existingStart) <= Math.min(reqEnd, existingEnd)) {
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
  
  // Détecter les interventions en retard (date de fin dépassée)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueInterventions = scheduledMaintenances.filter(m => {
    if (!m.endDate) return false;
    const endDate = new Date(m.endDate);
    endDate.setHours(23, 59, 59, 999);
    return endDate < today;
  });
  
  // Détecter les interventions en conflit avec des réservations
  const conflictingMaintenances = scheduledMaintenances.filter(m => {
    const conflicts = getMaintenanceConflicts(m);
    return conflicts.length > 0;
  });
  
  // Notifications d'interventions actives (cloche) - sans les demandes/pannes qui ont leur propre badge
  const activeInterventions = [...scheduledMaintenances, ...inProgressMaintenances, ...overdueInterventions];
  
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

  // Handlers pour les interventions en retard
  const handleMarkCompleted = async (intervention) => {
    try {
      await onUpdateMaintenance(intervention.id, {
        ...intervention,
        status: 'completed'
      });
      if (onRefreshMaintenances) {
        await onRefreshMaintenances();
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      alert('Erreur lors de la mise à jour de l\'intervention');
    }
  };

  const handleMarkNotCompleted = async (intervention, reason) => {
    try {
      await onUpdateMaintenance(intervention.id, {
        ...intervention,
        status: 'cancelled',
        notes: (intervention.notes ? intervention.notes + '\n\n' : '') + `[Annulée] ${reason}`
      });
      if (onRefreshMaintenances) {
        await onRefreshMaintenances();
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      alert('Erreur lors de la mise à jour de l\'intervention');
    }
  };

  const handleMarkPending = async (intervention, reason) => {
    try {
      await onUpdateMaintenance(intervention.id, {
        ...intervention,
        status: 'pending',
        notes: (intervention.notes ? intervention.notes + '\n\n' : '') + `[En attente] ${reason}`
      });
      if (onRefreshMaintenances) {
        await onRefreshMaintenances();
      }
    } catch (error) {
      console.error('Erreur lors de la mise en attente:', error);
      alert('Erreur lors de la mise en attente de l\'intervention');
    }
  };

  const handleReschedule = async (intervention) => {
    try {
      // Marquer l'intervention comme "Reportée"
      await onUpdateMaintenance(intervention.id, {
        ...intervention,
        status: 'rescheduled',
        notes: (intervention.notes ? intervention.notes + '\n\n' : '') + `[Reportée] Intervention reportée le ${format(new Date(), 'dd/MM/yyyy')}`
      });
      if (onRefreshMaintenances) {
        await onRefreshMaintenances();
      }
    } catch (error) {
      console.error('Erreur lors du report:', error);
      alert('Erreur lors du report de l\'intervention');
    }
    setSelectedOverdueIntervention(null);
  };

  return (
    <>
    <div className="header">
      <div className="header-content">
        <div className="header-title-container">
          <div className="header-logo-area">
            <img src="/Logos/LogoMagSav.svg" alt="Mag Scène" className="header-logo" />
          </div>
          <div className="module-tabs" role="tablist" aria-label="Module principal">
            <button
              className={`module-tab ${activeModule === 'vehicles' ? 'active' : ''}`}
              onClick={() => setActiveModule('vehicles')}
              role="tab"
              aria-selected={activeModule === 'vehicles'}
            >
              <Truck size={18} />
              <span>Véhicules</span>
            </button>
            <button
              className={`module-tab ${activeModule === 'personnel' ? 'active' : ''}`}
              onClick={() => setActiveModule('personnel')}
              role="tab"
              aria-selected={activeModule === 'personnel'}
            >
              <Users size={18} />
              <span>Personnel</span>
            </button>
          </div>
        </div>
        
        {/* Popup des notifications */}
        {showNotificationsPopup && (
          <div className="notifications-popup-overlay" onClick={() => setShowNotificationsPopup(false)}>
            <div className="notifications-popup" onClick={(e) => e.stopPropagation()}>
              <div className="notifications-popup-header">
                <h3><Bell size={20} strokeWidth={2.5} className="popup-icon" /> {
                  notificationFilter === 'reported' ? 'Pannes signalées' :
                  notificationFilter === 'pending' ? "Demandes d'intervention / CT" :
                  notificationFilter === 'active' ? 'Interventions actives' :
                  notificationFilter === 'reservations' ? 'Demandes de réservation' :
                  'Notifications'
                }</h3>
                <button className="close-popup-button" onClick={() => setShowNotificationsPopup(false)}>✕</button>
              </div>
              <div className="notifications-popup-content">
                {((notificationFilter === 'reported' && reportedMaintenances.length === 0) ||
                  (notificationFilter === 'pending' && pendingMaintenances.length === 0) ||
                  (notificationFilter === 'active' && activeInterventions.length === 0)) ? (
                  <p className="no-notifications">Aucune notification</p>
                ) : (
                  <>
                    {/* Section Interventions en retard */}
                    {(notificationFilter === 'all' || notificationFilter === 'active' || notificationFilter === 'overdue') && overdueInterventions.length > 0 && (
                      <div className="notification-section">
                        <h4 className="notification-section-title"><Clock size={18} strokeWidth={2.5} /> Interventions en retard</h4>
                        <div className="notifications-list">
                          {overdueInterventions.map(maintenance => {
                            const vehicle = vehicles.find(v => v.id === maintenance.vehicleId);
                            const daysOverdue = Math.floor((today - new Date(maintenance.endDate)) / (1000 * 60 * 60 * 24));
                            
                            return (
                              <div 
                                key={maintenance.id} 
                                className="notification-item overdue"
                                onClick={() => {
                                  setShowNotificationsPopup(false);
                                  setSelectedOverdueIntervention({ intervention: maintenance, vehicle });
                                }}
                              >
                                <div className="notification-item-header">
                                  <span className="notification-vehicle-name">
                                    {vehicle?.name || 'Véhicule inconnu'}
                                  </span>
                                  <span className="notification-status overdue">
                                    En retard
                                  </span>
                                </div>
                                <p className="notification-description">{maintenance.description}</p>
                                <span className="notification-date overdue-date">
                                  Fin prévue: {format(new Date(maintenance.endDate), 'dd/MM/yyyy')}
                                  {daysOverdue > 0 && ` • ${daysOverdue} jour${daysOverdue > 1 ? 's' : ''} de retard`}
                                </span>
                                {vehicle?.registration && (
                                  <span className="notification-registration">{vehicle.registration}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Section Interventions programmées */}
                    {(notificationFilter === 'all' || notificationFilter === 'active' || notificationFilter === 'scheduled') && scheduledMaintenances.length > 0 && (
                      <div className="notification-section">
                        <h4 className="notification-section-title"><CalendarCheck size={18} strokeWidth={2.5} /> Interventions programmées</h4>
                        <div className="notifications-list">
                          {scheduledMaintenances.map(maintenance => {
                            const vehicle = vehicles.find(v => v.id === maintenance.vehicleId)
                              || { id: maintenance.vehicleId, name: maintenance.vehicleName || 'Véhicule inconnu' };
                            
                            return (
                              <div 
                                key={maintenance.id} 
                                className="notification-item"
                                onClick={() => {
                                  setShowNotificationsPopup(false);
                                  if (onOpenMaintenance) {
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
                    {(notificationFilter === 'all' || notificationFilter === 'active' || notificationFilter === 'in_progress') && inProgressMaintenances.length > 0 && (
                      <div className="notification-section">
                        <h4 className="notification-section-title"><CalendarCheck size={18} strokeWidth={2.5} /> Interventions en cours</h4>
                        <div className="notifications-list">
                          {inProgressMaintenances.map(maintenance => {
                            const vehicle = vehicles.find(v => v.id === maintenance.vehicleId)
                              || { id: maintenance.vehicleId, name: maintenance.vehicleName || 'Véhicule inconnu' };
                            
                            return (
                              <div 
                                key={maintenance.id} 
                                className="notification-item"
                                onClick={() => {
                                  setShowNotificationsPopup(false);
                                  if (onOpenMaintenance) {
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
                            const vehicle = vehicles.find(v => v.id === maintenance.vehicleId)
                              || { id: maintenance.vehicleId, name: maintenance.vehicleName || 'Véhicule inconnu' };
                            
                            return (
                              <div 
                                key={maintenance.id} 
                                className="notification-item"
                                onClick={() => {
                                  setShowNotificationsPopup(false);
                                  if (onOpenMaintenance) {
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
                            const isExpanded = expandedReportedId === maintenance.id;
                            
                            return (
                              <div 
                                key={maintenance.id} 
                                className={`notification-item ${isExpanded ? 'expanded' : ''}`}
                                onClick={() => setExpandedReportedId(isExpanded ? null : maintenance.id)}
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
                                {maintenance.reportedBy && (
                                  <span className="notification-requester">
                                    <Users size={12} /> Signalée par {maintenance.reportedBy}
                                  </span>
                                )}
                                {vehicle?.registration && (
                                  <span className="notification-registration">{vehicle.registration}</span>
                                )}
                                <div className="notification-actions" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    className="notif-action-btn create-intervention"
                                    onClick={() => {
                                      setShowNotificationsPopup(false);
                                      setExpandedReportedId(null);
                                      if (onOpenMaintenance && vehicle) {
                                        onOpenMaintenance(vehicle, maintenance.id);
                                      }
                                    }}
                                  >
                                    <Wrench size={14} />
                                    Créer une intervention
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Section Demandes de réservation - uniquement via badge réservation */}
                    {notificationFilter === 'reservations' && currentUser?.isAdmin && pendingReservationRequests.length === 0 && (
                      <p className="no-notifications">Aucune demande de réservation en attente</p>
                    )}
                    {notificationFilter === 'reservations' && currentUser?.isAdmin && pendingReservationRequests.length > 0 && (
                      <div className="notification-section">
                        <h4 className="notification-section-title">
                          <CalendarCheck size={18} strokeWidth={2.5} /> 
                          Demandes de réservation 
                          <span className="section-count">{pendingReservationRequests.length}</span>
                        </h4>
                        <div className="notifications-list">
                          {pendingReservationRequests.map(request => {
                            const isRejecting = rejectingRequestId === request.id;
                            const conflicts = getRequestConflicts(request);
                            const periodLabel = (p) => p === 'AM' ? 'Matin' : 'Après-midi';
                            
                            return (
                            <div 
                              key={`notif-resreq-${request.id}`}
                              className={`notification-item reservation-request ${conflicts.length > 0 ? 'has-conflict' : ''}`}
                            >
                              <div className="notification-item-header">
                                <span className="notification-vehicle-name">
                                  {request.vehicleName || 'Véhicule inconnu'}
                                </span>
                                <span className={`notification-status ${conflicts.length > 0 ? 'conflict' : 'pending'}`}>
                                  {conflicts.length > 0 ? `⚠️ ${conflicts.length} conflit${conflicts.length > 1 ? 's' : ''}` : 'En attente'}
                                </span>
                              </div>
                              {/* Demandeur */}
                              {request.requesterName && (
                                <div className="notification-requester-line">
                                  <Users size={13} /> Demandé par <strong>{request.requesterName}</strong>
                                </div>
                              )}
                              {/* Période demandée */}
                              {request.startDate && (
                                <div className="request-period-info">
                                  <Calendar size={13} className="request-period-icon" />
                                  <span className="request-period-dates">
                                    {request.startDate === request.endDate 
                                      ? (
                                        <>
                                          <strong>{format(new Date(request.startDate), 'EEEE d MMMM yyyy', { locale: fr })}</strong>
                                          <span className="request-period-tag">{periodLabel(request.startPeriod)}{request.startPeriod !== request.endPeriod ? ` → ${periodLabel(request.endPeriod)}` : ''}</span>
                                        </>
                                      ) : (
                                        <>
                                          <strong>{format(new Date(request.startDate), 'EEE d MMM', { locale: fr })}</strong>
                                          <span className="request-period-tag">{periodLabel(request.startPeriod)}</span>
                                          <span className="request-period-arrow">→</span>
                                          <strong>{format(new Date(request.endDate), 'EEE d MMM yyyy', { locale: fr })}</strong>
                                          <span className="request-period-tag">{periodLabel(request.endPeriod)}</span>
                                        </>
                                      )
                                    }
                                  </span>
                                </div>
                              )}
                              {/* Conflits détectés */}
                              {conflicts.length > 0 && (
                                <div className="request-conflicts-box">
                                  <div className="request-conflicts-title">
                                    <AlertTriangle size={13} /> Conflits avec réservations existantes :
                                  </div>
                                  {conflicts.slice(0, 3).map((c, ci) => (
                                    <div key={ci} className="request-conflict-item">
                                      <span className="conflict-client">{c.clientName || c.prestationName || 'Réservation'}</span>
                                      <span className="conflict-dates">
                                        {format(new Date(c.startDate), 'dd/MM')} {c.startPeriod}
                                        {(c.endDate && c.endDate !== c.startDate) ? ` → ${format(new Date(c.endDate), 'dd/MM')} ${c.endPeriod}` : ''}
                                      </span>
                                    </div>
                                  ))}
                                  {conflicts.length > 3 && (
                                    <span className="conflict-more">+ {conflicts.length - 3} autre(s)…</span>
                                  )}
                                </div>
                              )}
                              <p className="notification-description">
                                {request.clientName && `Client: ${request.clientName}`}
                                {request.prestationName && ` • ${request.prestationName}`}
                              </p>
                              {request.registration && (
                                <span className="notification-registration">{request.registration}</span>
                              )}
                              {isRejecting ? (
                                <div className="notification-actions reject-form" onClick={(e) => e.stopPropagation()}>
                                  <textarea
                                    className="reject-reason-input"
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Motif du refus..."
                                    rows={2}
                                    autoFocus
                                  />
                                  <div className="reject-form-buttons">
                                    <button
                                      className="notif-action-btn confirm-reject"
                                      disabled={!rejectionReason.trim()}
                                      onClick={async () => {
                                        try {
                                          await api.rejectReservationRequest(request.id, rejectionReason);
                                          setPendingReservationRequests(prev => prev.filter(r => r.id !== request.id));
                                          setPendingRequestsCounts(prev => ({ ...prev, reservationRequests: prev.reservationRequests - 1, total: prev.total - 1 }));
                                          setRejectingRequestId(null);
                                          setRejectionReason('');
                                        } catch (error) {
                                          console.error('Erreur refus:', error);
                                          alert('Erreur lors du refus de la demande');
                                        }
                                      }}
                                    >
                                      Confirmer le refus
                                    </button>
                                    <button
                                      className="notif-action-btn cancel-reject"
                                      onClick={() => {
                                        setRejectingRequestId(null);
                                        setRejectionReason('');
                                      }}
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="notification-actions" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    className="notif-action-btn approve"
                                    onClick={async () => {
                                      try {
                                        await api.approveReservationRequest(request.id);
                                        setPendingReservationRequests(prev => prev.filter(r => r.id !== request.id));
                                        setPendingRequestsCounts(prev => ({ ...prev, reservationRequests: prev.reservationRequests - 1, total: prev.total - 1 }));
                                        if (onReservationUpdate) onReservationUpdate();
                                      } catch (error) {
                                        console.error('Erreur approbation:', error);
                                        alert('Erreur lors de l\'approbation');
                                      }
                                    }}
                                  >
                                    <Check size={14} />
                                    Approuver
                                  </button>
                                  <button
                                    className="notif-action-btn reject"
                                    onClick={() => setRejectingRequestId(request.id)}
                                  >
                                    <X size={14} />
                                    Refuser
                                  </button>
                                </div>
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

        {/* Popup des demandes de réservation */}
        {showRequestsPopup && (
          <div className="notifications-popup-overlay" onClick={() => setShowRequestsPopup(false)}>
            <div className="notifications-popup" onClick={(e) => e.stopPropagation()}>
              <div className="notifications-popup-header">
                <h3><CalendarCheck size={20} strokeWidth={2.5} className="popup-icon" /> Demandes de réservation</h3>
                <button className="close-popup-button" onClick={() => setShowRequestsPopup(false)}>✕</button>
              </div>
              <div className="notifications-popup-content">
                {pendingReservationRequests.length === 0 ? (
                  <p className="no-notifications">Aucune demande de réservation en attente</p>
                ) : (
                  <>
                    {/* Section Demandes de réservation */}
                    {pendingReservationRequests.length > 0 && (
                      <div className="notification-section">
                        <h4 className="notification-section-title">
                          <CalendarCheck size={18} strokeWidth={2.5} /> 
                          Demandes de réservation 
                          <span className="section-count">{pendingReservationRequests.length}</span>
                        </h4>
                        <div className="notifications-list">
                          {pendingReservationRequests.map(request => {
                            const isRejecting = rejectingRequestId === request.id;
                            const conflicts = getRequestConflicts(request);
                            const periodLabel = (p) => p === 'AM' ? 'Matin' : 'Après-midi';
                            
                            return (
                            <div 
                              key={`resreq-${request.id}`}
                              className={`notification-item reservation-request ${conflicts.length > 0 ? 'has-conflict' : ''}`}
                            >
                              <div className="notification-item-header">
                                <span className="notification-vehicle-name">
                                  {request.vehicleName || 'Véhicule inconnu'}
                                </span>
                                <span className={`notification-status ${conflicts.length > 0 ? 'conflict' : 'pending'}`}>
                                  {conflicts.length > 0 ? `⚠️ ${conflicts.length} conflit${conflicts.length > 1 ? 's' : ''}` : 'En attente'}
                                </span>
                              </div>
                              {/* Demandeur */}
                              {request.requesterName && (
                                <div className="notification-requester-line">
                                  <Users size={13} /> Demandé par <strong>{request.requesterName}</strong>
                                </div>
                              )}
                              {/* Période demandée */}
                              {request.startDate && (
                                <div className="request-period-info">
                                  <Calendar size={13} className="request-period-icon" />
                                  <span className="request-period-dates">
                                    {request.startDate === request.endDate 
                                      ? (
                                        <>
                                          <strong>{format(new Date(request.startDate), 'EEEE d MMMM yyyy', { locale: fr })}</strong>
                                          <span className="request-period-tag">{periodLabel(request.startPeriod)}{request.startPeriod !== request.endPeriod ? ` → ${periodLabel(request.endPeriod)}` : ''}</span>
                                        </>
                                      ) : (
                                        <>
                                          <strong>{format(new Date(request.startDate), 'EEE d MMM', { locale: fr })}</strong>
                                          <span className="request-period-tag">{periodLabel(request.startPeriod)}</span>
                                          <span className="request-period-arrow">→</span>
                                          <strong>{format(new Date(request.endDate), 'EEE d MMM yyyy', { locale: fr })}</strong>
                                          <span className="request-period-tag">{periodLabel(request.endPeriod)}</span>
                                        </>
                                      )
                                    }
                                  </span>
                                </div>
                              )}
                              {/* Conflits détectés */}
                              {conflicts.length > 0 && (
                                <div className="request-conflicts-box">
                                  <div className="request-conflicts-title">
                                    <AlertTriangle size={13} /> Conflits avec réservations existantes :
                                  </div>
                                  {conflicts.slice(0, 3).map((c, ci) => (
                                    <div key={ci} className="request-conflict-item">
                                      <span className="conflict-client">{c.clientName || c.prestationName || 'Réservation'}</span>
                                      <span className="conflict-dates">
                                        {format(new Date(c.startDate), 'dd/MM')} {c.startPeriod}
                                        {(c.endDate && c.endDate !== c.startDate) ? ` → ${format(new Date(c.endDate), 'dd/MM')} ${c.endPeriod}` : ''}
                                      </span>
                                    </div>
                                  ))}
                                  {conflicts.length > 3 && (
                                    <span className="conflict-more">+ {conflicts.length - 3} autre(s)…</span>
                                  )}
                                </div>
                              )}
                              <p className="notification-description">
                                {request.clientName && `Client: ${request.clientName}`}
                                {request.prestationName && ` • ${request.prestationName}`}
                              </p>
                              {request.registration && (
                                <span className="notification-registration">{request.registration}</span>
                              )}
                              {isRejecting ? (
                                <div className="notification-actions reject-form" onClick={(e) => e.stopPropagation()}>
                                  <textarea
                                    className="reject-reason-input"
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Motif du refus..."
                                    rows={2}
                                    autoFocus
                                  />
                                  <div className="reject-form-buttons">
                                    <button
                                      className="notif-action-btn confirm-reject"
                                      disabled={!rejectionReason.trim()}
                                      onClick={async () => {
                                        try {
                                          await api.rejectReservationRequest(request.id, rejectionReason);
                                          setPendingReservationRequests(prev => prev.filter(r => r.id !== request.id));
                                          setPendingRequestsCounts(prev => ({ ...prev, reservationRequests: prev.reservationRequests - 1, total: prev.total - 1 }));
                                          setRejectingRequestId(null);
                                          setRejectionReason('');
                                        } catch (error) {
                                          alert('Erreur lors du refus');
                                        }
                                      }}
                                    >
                                      <X size={14} /> Confirmer le refus
                                    </button>
                                    <button
                                      className="notif-action-btn dismiss"
                                      onClick={() => { setRejectingRequestId(null); setRejectionReason(''); }}
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="notification-actions" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    className="notif-action-btn approve"
                                    onClick={async () => {
                                      if (!confirm('Approuver cette demande et créer la réservation ?')) return;
                                      try {
                                        await api.approveReservationRequest(request.id);
                                        setPendingReservationRequests(prev => prev.filter(r => r.id !== request.id));
                                        setPendingRequestsCounts(prev => ({ ...prev, reservationRequests: prev.reservationRequests - 1, total: prev.total - 1 }));
                                        alert('Demande approuvée ! La réservation a été créée.');
                                      } catch (error) {
                                        alert('Erreur lors de la validation');
                                      }
                                    }}
                                  >
                                    <Check size={14} />
                                    Valider
                                  </button>
                                  <button
                                    className="notif-action-btn reject"
                                    onClick={() => { setRejectingRequestId(request.id); setRejectionReason(''); }}
                                  >
                                    <X size={14} />
                                    Refuser
                                  </button>
                                </div>
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

          {/* Sélecteur de vue (véhicules uniquement) */}
          {activeModule === 'vehicles' && (
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
          )}

          {/* Navigation de dates (véhicules uniquement) */}
          {activeModule === 'vehicles' && (
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
          )}

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginRight: '8px' }}>
            {/* Badge 1: Pannes signalées (reported) */}
            {currentUser?.isAdmin && reportedMaintenances.length > 0 && (
              <div 
                className="notification-badge unified has-reported"
                onClick={() => {
                  setNotificationFilter('reported');
                  setShowNotificationsPopup(true);
                }}
                style={{ position: 'relative' }}
                title={`${reportedMaintenances.length} panne(s) signalée(s)`}
              >
                <AlertTriangle size={16} strokeWidth={2.5} />
                <span className="notification-count">{reportedMaintenances.length}</span>
                {immobilizedVehicles.length > 0 && (
                  <span className="notification-alert-badge">
                    <XCircle size={10} strokeWidth={3} />
                  </span>
                )}
              </div>
            )}

            {/* Badge 2: Demandes d'intervention / CT (pending) */}
            {currentUser?.isAdmin && pendingMaintenances.length > 0 && (
              <div 
                className="notification-badge unified has-pending"
                onClick={() => {
                  setNotificationFilter('pending');
                  setShowNotificationsPopup(true);
                }}
                style={{ position: 'relative' }}
                title={`${pendingMaintenances.length} demande(s) d'intervention/CT`}
              >
                <ClipboardList size={16} strokeWidth={2.5} />
                <span className="notification-count">{pendingMaintenances.length}</span>
              </div>
            )}

            {/* Badge 3: Demandes de réservation (admin) */}
            {currentUser?.isAdmin && pendingRequestsCounts.reservationRequests > 0 && (
              <div 
                className="notification-badge unified requests-badge"
                onClick={() => {
                  setNotificationFilter('reservations');
                  setShowNotificationsPopup(true);
                }}
                style={{ position: 'relative' }}
                title={`${pendingRequestsCounts.reservationRequests} demande(s) de réservation`}
              >
                <CalendarCheck size={16} strokeWidth={2.5} />
                <span className="notification-count">{pendingRequestsCounts.reservationRequests}</span>
              </div>
            )}

            {/* Badge 4: Interventions actives (programmées, en cours, en retard) */}
            {activeInterventions.length > 0 && (
              <div 
                className={`notification-badge unified ${
                  overdueInterventions.length > 0 ? 'has-overdue' : 
                  conflictingMaintenances.length > 0 ? 'has-conflict' : 
                  'has-scheduled'
                }`}
                onClick={() => {
                  setNotificationFilter('active');
                  setShowNotificationsPopup(true);
                }}
                style={{ position: 'relative' }}
                title={`${activeInterventions.length} intervention(s) active(s)`}
              >
                <Bell size={16} strokeWidth={2.5} />
                <span className="notification-count">{activeInterventions.length}</span>
                {overdueInterventions.length > 0 && (
                  <span className="notification-alert-badge">
                    <Clock size={10} strokeWidth={3} />
                  </span>
                )}
              </div>
            )}
            </div>
            
            <button className="qr-button" onClick={() => setShowQRCodeModal(true)} aria-label="Afficher le QR code mobile">
              <QrCode size={20} />
            </button>

            <button 
              className="management-button" 
              onClick={onOpenManagement} 
              aria-label="Ouvrir le panneau de gestion"
              style={{ position: 'relative' }}
            >
              {activeModule === 'vehicles' ? <Truck size={18} /> : <Users size={18} />}
              Gestion
            </button>

            <button 
              className="settings-button" 
              onClick={onOpenSettings} 
              aria-label="Ouvrir les paramètres"
              style={{ position: 'relative' }}
            >
              <Settings size={18} />
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    padding: 0,
                    background: 'transparent',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.2)';
                  }}
                >
                  <UserAvatar name={currentUser.name} avatar={currentUser.avatar} size={36} />
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
                        background: '#f9fafb',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <UserAvatar name={currentUser.name} avatar={currentUser.avatar} size={40} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#1f2937' }}>{currentUser.name}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                            {currentUser.isAdmin ? 'Administrateur' : 'Utilisateur'}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowProfileModal(true);
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
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        <UserCog size={16} />
                        Mon profil
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

    {selectedOverdueIntervention && (
      <OverdueInterventionModal
        intervention={selectedOverdueIntervention.intervention}
        vehicle={selectedOverdueIntervention.vehicle}
        onClose={() => setSelectedOverdueIntervention(null)}
        onMarkCompleted={handleMarkCompleted}
        onMarkNotCompleted={handleMarkNotCompleted}
        onMarkPending={handleMarkPending}
        onReschedule={handleReschedule}
      />
    )}

    {showProfileModal && (
      <ProfileEditModal
        currentUser={currentUser}
        onClose={() => setShowProfileModal(false)}
        onUserUpdate={(updatedUser) => {
          if (onUserUpdate) onUserUpdate(updatedUser);
          setShowProfileModal(false);
        }}
      />
    )}
  </>
  );
};

export default Header;
