import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CalendarCheck,
  Check,
  ClipboardList,
  Clock,
  Users,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button, Textarea } from '@/design-system';

import { STATUS } from '../../constants';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { getPeriodTimestamp } from '../../utils/dateUtils';
import { getModalRoot } from '../../utils/modalManager';

// ─── Shared internal card for reservation requests (used in both popups) ───
// [PERF Phase 4.G] Memo : la card est rendue par .map() x N (jusqu'à ~20
// demandes en attente) depuis HeaderNotifications. Sans memo, chaque
// re-render du parent (frappe textarea, ouverture popup, MAJ liste)
// reconstruit toutes les cartes.
const ReservationRequestCard = React.memo(
  ({
    request,
    conflicts,
    isRejecting,
    rejectionReason,
    setRejectionReason,
    onApprove,
    onReject,
    onCancelReject,
    onConfirmReject,
    keyPrefix: _keyPrefix,
    approveLabel = 'Approuver',
    confirmRejectIcon = false,
    cancelRejectClassName = 'cancel-reject',
  }) => {
    const periodLabel = (p) => (p === 'AM' ? 'Matin' : 'Après-midi');

    return (
      <div
        className={`notification-item reservation-request ${conflicts.length > 0 ? 'has-conflict' : ''}`}
      >
        <div className="notification-item-header">
          <span className="notification-vehicle-name">
            {request.vehicleName || 'Véhicule inconnu'}
          </span>
          <span className={`notification-status ${conflicts.length > 0 ? 'conflict' : 'pending'}`}>
            {conflicts.length > 0
              ? `⚠️ ${conflicts.length} conflit${conflicts.length > 1 ? 's' : ''}`
              : 'En attente'}
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
              {request.startDate === request.endDate ? (
                <>
                  <strong>
                    {format(new Date(request.startDate), 'EEEE d MMMM yyyy', { locale: fr })}
                  </strong>
                  <span className="request-period-tag">
                    {periodLabel(request.startPeriod)}
                    {request.startPeriod !== request.endPeriod
                      ? ` → ${periodLabel(request.endPeriod)}`
                      : ''}
                  </span>
                </>
              ) : (
                <>
                  <strong>
                    {format(new Date(request.startDate), 'EEE d MMM', { locale: fr })}
                  </strong>
                  <span className="request-period-tag">{periodLabel(request.startPeriod)}</span>
                  <span className="request-period-arrow">→</span>
                  <strong>
                    {format(new Date(request.endDate), 'EEE d MMM yyyy', { locale: fr })}
                  </strong>
                  <span className="request-period-tag">{periodLabel(request.endPeriod)}</span>
                </>
              )}
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
                <span className="conflict-client">
                  {c.clientName || c.prestationName || 'Réservation'}
                </span>
                <span className="conflict-dates">
                  {format(new Date(c.startDate), 'dd/MM')} {c.startPeriod}
                  {c.endDate && c.endDate !== c.startDate
                    ? ` → ${format(new Date(c.endDate), 'dd/MM')} ${c.endPeriod}`
                    : ''}
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
            <Textarea
              className="reject-reason-input"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Motif du refus..."
              aria-label="Motif du refus"
              rows={2}
              autoFocus
            />
            <div className="reject-form-buttons">
              <Button
                variant="ghost"
                className="notif-action-btn confirm-reject"
                disabled={!rejectionReason.trim()}
                onClick={onConfirmReject}
              >
                {confirmRejectIcon && <X size={14} />} Confirmer le refus
              </Button>
              <Button
                variant="ghost"
                className={`notif-action-btn ${cancelRejectClassName}`}
                onClick={onCancelReject}
              >
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="notification-actions" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" className="notif-action-btn approve" onClick={onApprove}>
              <Check size={14} />
              {approveLabel}
            </Button>
            <Button variant="ghost" className="notif-action-btn reject" onClick={onReject}>
              <X size={14} />
              Refuser
            </Button>
          </div>
        )}
      </div>
    );
  },
);
ReservationRequestCard.displayName = 'ReservationRequestCard';

// ─── Main component ───────────────────────────────────────────────────────────
const HeaderNotifications = ({
  showNotificationsPopup,
  setShowNotificationsPopup,
  showRequestsPopup,
  setShowRequestsPopup,
  notificationFilter,
  overdueInterventions,
  scheduledMaintenances,
  inProgressMaintenances,
  pendingMaintenances,
  reportedMaintenances,
  activeInterventions,
  immobilizedVehicles: _immobilizedVehicles,
  vehicles,
  onOpenMaintenance,
  onScheduleMaintenance,
  onDeleteSignalement,
  onCloseSignalement,
  currentUser,
  pendingReservationRequests,
  setPendingReservationRequests,
  pendingRequestsCounts: _pendingRequestsCounts,
  setPendingRequestsCounts,
  reservations,
  onReservationUpdate,
  setSelectedOverdueIntervention,
}) => {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();

  const [expandedReportedId, setExpandedReportedId] = useState(null);
  const [closingReportedId, setClosingReportedId] = useState(null);
  const [closureDescription, setClosureDescription] = useState('');
  const [rejectingRequestId, setRejectingRequestId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [popoverStyle, setPopoverStyle] = useState({});

  const isAnyPopupOpen = showNotificationsPopup || showRequestsPopup;

  const updatePopoverPosition = useCallback(() => {
    const anchor = document.querySelector('.header-notification-badges');
    const fallbackTop = 64;
    const preferredWidth = 480;
    const viewportPadding = 8;

    if (!anchor) {
      const width = Math.min(preferredWidth, window.innerWidth - viewportPadding * 2);
      setPopoverStyle({
        top: `${fallbackTop}px`,
        left: `${Math.max(viewportPadding, window.innerWidth - width - viewportPadding)}px`,
        width: `${width}px`,
        maxHeight: `${Math.max(220, window.innerHeight - fallbackTop - 12)}px`,
      });
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const width = Math.min(preferredWidth, window.innerWidth - viewportPadding * 2);
    const top = Math.round(rect.bottom + 8);
    const left = Math.round(
      Math.max(
        viewportPadding,
        Math.min(window.innerWidth - width - viewportPadding, rect.right - width),
      ),
    );

    setPopoverStyle({
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: `${Math.max(220, window.innerHeight - top - 12)}px`,
    });
  }, []);

  useEffect(() => {
    if (!isAnyPopupOpen) return;

    updatePopoverPosition();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowNotificationsPopup(false);
        setShowRequestsPopup(false);
      }
    };

    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isAnyPopupOpen, setShowNotificationsPopup, setShowRequestsPopup, updatePopoverPosition]);

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Portail unique #emag-modal-root : empêche le header (sticky + backdrop-filter
  // = stacking context) de couper le popover et garantit qu'un modal bloquant
  // (z-index 9000+ via ModalManager) passe automatiquement par-dessus.
  const portalTarget = isAnyPopupOpen ? getModalRoot() : null;

  const popoverContent = isAnyPopupOpen ? (
    <>
      <div
        className="notifications-popover-backdrop"
        onMouseDown={() => {
          setShowNotificationsPopup(false);
          setShowRequestsPopup(false);
        }}
      />

      {/* Popup des notifications */}
      {showNotificationsPopup && (
        <div
          className="notifications-popup notifications-popover"
          style={popoverStyle}
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="false"
          aria-label="Notifications"
        >
          <div className="notifications-popup-header">
            <h3>
              <Bell size={20} strokeWidth={2.5} className="popup-icon" />
              {notificationFilter === 'reported'
                ? 'Pannes signalées'
                : notificationFilter === STATUS.PENDING
                  ? "Demandes d'intervention / CT"
                  : notificationFilter === STATUS.ACTIVE
                    ? 'Interventions actives'
                    : notificationFilter === 'reservations'
                      ? 'Demandes de réservation'
                      : 'Notifications'}
            </h3>
            <Button
              type="button"
              className="close-popup-button"
              onClick={() => setShowNotificationsPopup(false)}
              aria-label="Fermer"
            >
              <X size={18} />
            </Button>
          </div>
          <div className="notifications-popup-content">
            {(notificationFilter === 'reported' && reportedMaintenances.length === 0) ||
            (notificationFilter === STATUS.PENDING && pendingMaintenances.length === 0) ||
            (notificationFilter === STATUS.ACTIVE && activeInterventions.length === 0) ? (
              <p className="no-notifications">Aucune notification</p>
            ) : (
              <>
                {/* Section Interventions en retard */}
                {(notificationFilter === 'all' ||
                  notificationFilter === STATUS.ACTIVE ||
                  notificationFilter === 'overdue') &&
                  overdueInterventions.length > 0 && (
                    <div className="notification-section">
                      <h4 className="notification-section-title">
                        <Clock size={18} strokeWidth={2.5} /> Interventions en retard
                      </h4>
                      <div className="notifications-list">
                        {overdueInterventions.map((maintenance) => {
                          const vehicle = vehicles.find((v) => v.id === maintenance.vehicleId);
                          const daysOverdue = Math.floor(
                            (today - new Date(maintenance.endDate)) / (1000 * 60 * 60 * 24),
                          );

                          return (
                            <div
                              key={maintenance.id}
                              className="notification-item overdue"
                              onClick={() => {
                                setShowNotificationsPopup(false);
                                setSelectedOverdueIntervention({
                                  intervention: maintenance,
                                  vehicle,
                                });
                              }}
                            >
                              <div className="notification-item-header">
                                <span className="notification-vehicle-name">
                                  {vehicle?.name || 'Véhicule inconnu'}
                                </span>
                                <span className="notification-status overdue">En retard</span>
                              </div>
                              <p className="notification-description">{maintenance.description}</p>
                              <span className="notification-date overdue-date">
                                Fin prévue: {format(new Date(maintenance.endDate), 'dd/MM/yyyy')}
                                {daysOverdue > 0 &&
                                  ` • ${daysOverdue} jour${daysOverdue > 1 ? 's' : ''} de retard`}
                              </span>
                              {vehicle?.registration && (
                                <span className="notification-registration">
                                  {vehicle.registration}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Section Interventions programmées */}
                {(notificationFilter === 'all' ||
                  notificationFilter === STATUS.ACTIVE ||
                  notificationFilter === STATUS.SCHEDULED) &&
                  scheduledMaintenances.length > 0 && (
                    <div className="notification-section">
                      <h4 className="notification-section-title">
                        <CalendarCheck size={18} strokeWidth={2.5} /> Interventions programmées
                      </h4>
                      <div className="notifications-list">
                        {scheduledMaintenances.map((maintenance) => {
                          const vehicle = vehicles.find((v) => v.id === maintenance.vehicleId) || {
                            id: maintenance.vehicleId,
                            name: maintenance.vehicleName || 'Véhicule inconnu',
                          };

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
                                <span className="notification-status scheduled">Programmée</span>
                              </div>
                              <p className="notification-description">{maintenance.description}</p>
                              {maintenance.startDate && (
                                <span className="notification-date">
                                  {maintenance.startDate === maintenance.endDate
                                    ? format(new Date(maintenance.startDate), 'dd/MM/yyyy')
                                    : `${format(new Date(maintenance.startDate), 'dd/MM')} - ${format(new Date(maintenance.endDate), 'dd/MM/yyyy')}`}
                                </span>
                              )}
                              {vehicle?.registration && (
                                <span className="notification-registration">
                                  {vehicle.registration}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Section Interventions en cours */}
                {(notificationFilter === 'all' ||
                  notificationFilter === STATUS.ACTIVE ||
                  notificationFilter === 'in_progress') &&
                  inProgressMaintenances.length > 0 && (
                    <div className="notification-section">
                      <h4 className="notification-section-title">
                        <CalendarCheck size={18} strokeWidth={2.5} /> Interventions en cours
                      </h4>
                      <div className="notifications-list">
                        {inProgressMaintenances.map((maintenance) => {
                          const vehicle = vehicles.find((v) => v.id === maintenance.vehicleId) || {
                            id: maintenance.vehicleId,
                            name: maintenance.vehicleName || 'Véhicule inconnu',
                          };

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
                                <span className="notification-status in-progress">En cours</span>
                              </div>
                              <p className="notification-description">{maintenance.description}</p>
                              {maintenance.startDate && (
                                <span className="notification-date">
                                  {maintenance.startDate === maintenance.endDate
                                    ? format(new Date(maintenance.startDate), 'dd/MM/yyyy')
                                    : `${format(new Date(maintenance.startDate), 'dd/MM')} - ${format(new Date(maintenance.endDate), 'dd/MM/yyyy')}`}
                                </span>
                              )}
                              {vehicle?.registration && (
                                <span className="notification-registration">
                                  {vehicle.registration}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Section Demandes d'intervention */}
                {(notificationFilter === 'all' || notificationFilter === STATUS.PENDING) &&
                  pendingMaintenances.length > 0 && (
                    <div className="notification-section">
                      <h4 className="notification-section-title">
                        <ClipboardList size={18} strokeWidth={2.5} /> Demandes d'intervention
                      </h4>
                      <div className="notifications-list">
                        {pendingMaintenances.map((maintenance) => {
                          const vehicle = vehicles.find((v) => v.id === maintenance.vehicleId) || {
                            id: maintenance.vehicleId,
                            name: maintenance.vehicleName || 'Véhicule inconnu',
                          };

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
                                <span className="notification-status pending">En attente</span>
                              </div>
                              <p className="notification-description">{maintenance.description}</p>
                              {vehicle?.registration && (
                                <span className="notification-registration">
                                  {vehicle.registration}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Section Pannes signalées */}
                {(notificationFilter === 'all' || notificationFilter === 'reported') &&
                  reportedMaintenances.length > 0 && (
                    <div className="notification-section">
                      <h4 className="notification-section-title">
                        <AlertTriangle size={18} strokeWidth={2.5} /> Pannes signalées
                      </h4>
                      <div className="notifications-list">
                        {reportedMaintenances.map((maintenance) => {
                          const vehicle = vehicles.find((v) => v.id === maintenance.vehicleId);
                          const isExpanded = expandedReportedId === maintenance.id;
                          const isClosing = closingReportedId === maintenance.id;

                          return (
                            <div
                              key={maintenance.id}
                              className={`notification-item ${isExpanded ? 'expanded' : ''}`}
                              onClick={() =>
                                setExpandedReportedId(isExpanded ? null : maintenance.id)
                              }
                            >
                              <div className="notification-item-header">
                                <span className="notification-vehicle-name">
                                  {maintenance.isImmobilized && (
                                    <XCircle size={16} strokeWidth={2.5} className="inline-icon" />
                                  )}
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
                                <span className="notification-registration">
                                  {vehicle.registration}
                                </span>
                              )}
                              {isExpanded && (
                                <div
                                  className="notification-actions reported-actions"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    variant="ghost"
                                    className="notif-action-btn create-intervention"
                                    onClick={() => {
                                      setShowNotificationsPopup(false);
                                      setExpandedReportedId(null);
                                      if (onScheduleMaintenance && vehicle) {
                                        onScheduleMaintenance(vehicle);
                                      } else if (onOpenMaintenance && vehicle) {
                                        onOpenMaintenance(vehicle, maintenance.id);
                                      }
                                    }}
                                  >
                                    <Wrench size={14} />
                                    Planifier une intervention
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="notif-action-btn delete-intervention"
                                    onClick={() => {
                                      confirm({
                                        title: 'Supprimer le signalement',
                                        message: 'Supprimer ce signalement de panne ?',
                                        confirmLabel: 'Supprimer',
                                        variant: 'danger',
                                        onConfirm: async () => {
                                          try {
                                            if (onDeleteSignalement) {
                                              await onDeleteSignalement(maintenance);
                                            }
                                            setExpandedReportedId(null);
                                            setShowNotificationsPopup(false);
                                          } catch {
                                            // toast déjà géré par le handler parent
                                          }
                                        },
                                      });
                                    }}
                                  >
                                    <XCircle size={14} />
                                    Supprimer
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="notif-action-btn close-signalement"
                                    onClick={() => {
                                      setClosingReportedId(isClosing ? null : maintenance.id);
                                      setClosureDescription('');
                                    }}
                                  >
                                    <Clock size={14} />
                                    Clôturer le signalement
                                  </Button>
                                </div>
                              )}
                              {isClosing && (
                                <div
                                  className="notification-actions reject-form"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Textarea
                                    className="reject-reason-input"
                                    value={closureDescription}
                                    onChange={(e) => setClosureDescription(e.target.value)}
                                    placeholder="Description de l'intervention..."
                                    aria-label="Description de l'intervention"
                                    rows={3}
                                    autoFocus
                                  />
                                  <div className="reject-form-buttons">
                                    <Button
                                      variant="ghost"
                                      className="notif-action-btn confirm-reject"
                                      disabled={!closureDescription.trim()}
                                      onClick={async () => {
                                        if (!onCloseSignalement) return;
                                        try {
                                          await onCloseSignalement(
                                            maintenance,
                                            closureDescription.trim(),
                                          );
                                          setClosingReportedId(null);
                                          setExpandedReportedId(null);
                                          setShowNotificationsPopup(false);
                                          setClosureDescription('');
                                        } catch {
                                          // toast déjà géré par le handler parent
                                        }
                                      }}
                                    >
                                      <Check size={14} /> Confirmer la clôture
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      className="notif-action-btn dismiss"
                                      onClick={() => {
                                        setClosingReportedId(null);
                                        setClosureDescription('');
                                      }}
                                    >
                                      Annuler
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Section Demandes de réservation - uniquement via badge réservation */}
                {notificationFilter === 'reservations' &&
                  currentUser?.isAdmin &&
                  pendingReservationRequests.length === 0 && (
                    <p className="no-notifications">Aucune demande de réservation en attente</p>
                  )}
                {notificationFilter === 'reservations' &&
                  currentUser?.isAdmin &&
                  pendingReservationRequests.length > 0 && (
                    <div className="notification-section">
                      <h4 className="notification-section-title">
                        <CalendarCheck size={18} strokeWidth={2.5} />
                        Demandes de réservation
                        <span className="section-count">{pendingReservationRequests.length}</span>
                      </h4>
                      <div className="notifications-list">
                        {pendingReservationRequests.map((request) => {
                          const conflicts = getRequestConflicts(request);
                          return (
                            <ReservationRequestCard
                              key={`notif-resreq-${request.id}`}
                              keyPrefix="notif-resreq"
                              request={request}
                              conflicts={conflicts}
                              isRejecting={rejectingRequestId === request.id}
                              rejectionReason={rejectionReason}
                              setRejectionReason={setRejectionReason}
                              approveLabel="Approuver"
                              confirmRejectIcon={false}
                              cancelRejectClassName="cancel-reject"
                              onApprove={() => {
                                setPendingReservationRequests((prev) =>
                                  prev.filter((r) => r.id !== request.id),
                                );
                                setPendingRequestsCounts((prev) => ({
                                  ...prev,
                                  reservationRequests: prev.reservationRequests - 1,
                                  total: prev.total - 1,
                                }));
                                if (onReservationUpdate) onReservationUpdate();
                                api.approveReservationRequest(request.id).catch(() => {
                                  toast.error("Erreur lors de l'approbation");
                                });
                              }}
                              onReject={() => setRejectingRequestId(request.id)}
                              onCancelReject={() => {
                                setRejectingRequestId(null);
                                setRejectionReason('');
                              }}
                              onConfirmReject={() => {
                                const reason = rejectionReason;
                                setPendingReservationRequests((prev) =>
                                  prev.filter((r) => r.id !== request.id),
                                );
                                setPendingRequestsCounts((prev) => ({
                                  ...prev,
                                  reservationRequests: prev.reservationRequests - 1,
                                  total: prev.total - 1,
                                }));
                                setRejectingRequestId(null);
                                setRejectionReason('');
                                api.rejectReservationRequest(request.id, reason).catch(() => {
                                  toast.error('Impossible de refuser la demande de réservation.');
                                });
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Popup des demandes de réservation */}
      {showRequestsPopup && (
        <div
          className="notifications-popup notifications-popover"
          style={popoverStyle}
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="false"
          aria-label="Demandes de réservation"
        >
          <div className="notifications-popup-header">
            <h3>
              <CalendarCheck size={20} strokeWidth={2.5} className="popup-icon" />
              Demandes de réservation
            </h3>
            <Button
              type="button"
              className="close-popup-button"
              onClick={() => setShowRequestsPopup(false)}
              aria-label="Fermer"
            >
              <X size={18} />
            </Button>
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
                      {pendingReservationRequests.map((request) => {
                        const conflicts = getRequestConflicts(request);
                        return (
                          <ReservationRequestCard
                            key={`resreq-${request.id}`}
                            keyPrefix="resreq"
                            request={request}
                            conflicts={conflicts}
                            isRejecting={rejectingRequestId === request.id}
                            rejectionReason={rejectionReason}
                            setRejectionReason={setRejectionReason}
                            approveLabel="Valider"
                            confirmRejectIcon={true}
                            cancelRejectClassName="dismiss"
                            onApprove={() => {
                              confirm({
                                title: 'Approuver la demande',
                                message: 'Approuver cette demande et créer la réservation ?',
                                variant: 'confirm',
                                confirmLabel: 'Approuver',
                                onConfirm: () => {
                                  setPendingReservationRequests((prev) =>
                                    prev.filter((r) => r.id !== request.id),
                                  );
                                  setPendingRequestsCounts((prev) => ({
                                    ...prev,
                                    reservationRequests: prev.reservationRequests - 1,
                                    total: prev.total - 1,
                                  }));
                                  toast.success('Demande approuvée ! La réservation a été créée.');
                                  api.approveReservationRequest(request.id).catch(() => {
                                    toast.error('Impossible de valider la demande de réservation.');
                                  });
                                },
                              });
                            }}
                            onReject={() => {
                              setRejectingRequestId(request.id);
                              setRejectionReason('');
                            }}
                            onCancelReject={() => {
                              setRejectingRequestId(null);
                              setRejectionReason('');
                            }}
                            onConfirmReject={() => {
                              const reason = rejectionReason;
                              setPendingReservationRequests((prev) =>
                                prev.filter((r) => r.id !== request.id),
                              );
                              setPendingRequestsCounts((prev) => ({
                                ...prev,
                                reservationRequests: prev.reservationRequests - 1,
                                total: prev.total - 1,
                              }));
                              setRejectingRequestId(null);
                              setRejectionReason('');
                              api.rejectReservationRequest(request.id, reason).catch(() => {
                                toast.error('Impossible de refuser la demande de réservation.');
                              });
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  ) : null;

  return (
    <>
      {portalTarget && popoverContent && createPortal(popoverContent, portalTarget)}
      {ConfirmDialogRenderer}
    </>
  );
};

export default React.memo(HeaderNotifications);
