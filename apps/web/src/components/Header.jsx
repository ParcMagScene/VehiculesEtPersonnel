import './Header.css';

import { format } from 'date-fns';
import { HelpCircle, Moon, Sun } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Button, Tooltip } from '@/design-system';

import { STATUS } from '../constants';
import { useToast } from '../hooks/useToast';
import { DESKTOP_MODULES } from '../router/routes.config';
import api from '../utils/api';
import { isApiCoolingDown } from '../utils/api/base';
import { getPeriodTimestamp } from '../utils/dateUtils';
import { refreshBus } from '../utils/refresh-bus';
import HeaderActions from './header/HeaderActions';
import HeaderNotifications from './header/HeaderNotifications';
import OverdueInterventionModal from './planning/OverdueInterventionModal';

const Header = ({
  _view,
  _setView,
  _currentDate,
  _setCurrentDate,
  onOpenSettings,
  activeModule,
  setActiveModule,
  maintenances = [],
  vehicles = [],
  _onOpenVehicleMaintenance,
  onOpenMaintenance,
  reservations = [],
  currentUser,
  onLogout,
  onUpdateMaintenance,
  onRefreshMaintenances,
  onReservationUpdate,
  onUserUpdate,
  onToggleMessaging,
  onToggleMailing,
  onDetachSonos,
  unreadMsgCount = 0,
  onOpenPreferences,
  onOpenHelp,
  tabPrefs = {},
  theme,
  onToggleTheme,
}) => {
  const toast = useToast();
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState('all');
  const [selectedOverdueIntervention, setSelectedOverdueIntervention] = useState(null);
  const [showRequestsPopup, setShowRequestsPopup] = useState(false);
  const [pendingAccessRequests, setPendingAccessRequests] = useState(0);
  const [pendingRequestsCounts, setPendingRequestsCounts] = useState({
    interventionRequests: 0,
    reservationRequests: 0,
    total: 0,
  });
  const [pendingReservationRequests, setPendingReservationRequests] = useState([]);
  // #8 Notifications onglets : compteur demandes matériel en attente (badge sur l'onglet Commandes)
  const [pendingMaterialRequests, setPendingMaterialRequests] = useState(0);
  // Badge sur l'onglet Contrôles : rouge = au moins un contrôle dépassé (EN_RETARD/MANQUE),
  // orange = sinon « sous 7 j ». Visible à tous les utilisateurs (pas uniquement admin).
  const [controlsBadge, setControlsBadge] = useState({ late: 0, soon: 0 });

  // [PERF Sprint 2] Fusion de deux setInterval(30s) en un seul, avec Promise.all
  // pour grouper les requêtes (compteur demandes interventions/réservations + compteur
  // demandes d'accès admin). Évite un timer redondant et déclenche les 2 fetch en parallèle.
  useEffect(() => {
    const loadAdminBadges = async () => {
      if (!currentUser?.isAdmin) return;
      if (isApiCoolingDown()) return;
      const [countsRes, accessRes, matStatsRes] = await Promise.allSettled([
        api.getPendingRequestsCount(),
        api.getPendingAccessRequestsCount(),
        api.getMaterialRequestsStats(),
      ]);
      if (countsRes.status === 'fulfilled' && countsRes.value) {
        setPendingRequestsCounts(countsRes.value);
      }
      if (accessRes.status === 'fulfilled' && accessRes.value) {
        setPendingAccessRequests(accessRes.value.count || 0);
      }
      if (matStatsRes.status === 'fulfilled' && matStatsRes.value) {
        setPendingMaterialRequests(Number(matStatsRes.value.pending) || 0);
      }
      // Erreurs silencieuses : valeurs initiales conservées (badges = 0)
    };

    loadAdminBadges();
    const interval = setInterval(loadAdminBadges, 30000);
    return () => clearInterval(interval);
  }, [currentUser, maintenances]);

  // Badge onglet Contrôles : rechargé à l'ouverture, périodiquement, et sur
  // événement refreshBus('controls') publié après création/édition/effectuation.
  useEffect(() => {
    let cancelled = false;
    const loadControlsBadge = async () => {
      if (!currentUser) return;
      if (isApiCoolingDown()) return;
      try {
        const r = await api.getControlsDashboard();
        if (cancelled || !r?.success) return;
        const s = r.stats || {};
        setControlsBadge({
          late: (Number(s.en_retard) || 0) + (Number(s.manque) || 0),
          soon: Number(s.within_7) || 0,
        });
      } catch {
        // silencieux : badge inchangé
      }
    };
    loadControlsBadge();
    const interval = setInterval(loadControlsBadge, 60000);
    const unsub = refreshBus.subscribe('controls', loadControlsBadge);
    return () => {
      cancelled = true;
      clearInterval(interval);
      unsub();
    };
  }, [currentUser]);

  // Charger les demandes de réservation en attente (au démarrage + quand un popup s'ouvre)
  useEffect(() => {
    const loadPendingReservations = async () => {
      if (currentUser?.isAdmin) {
        if (isApiCoolingDown()) return;
        try {
          const data = await api.getPendingReservationRequests();
          setPendingReservationRequests(data);
        } catch {
          // Silencieux : liste vide conservée
        }
      }
    };
    loadPendingReservations();
  }, [showRequestsPopup, showNotificationsPopup, currentUser]);

  // Fonction pour détecter les conflits entre une intervention et les réservations
  const getMaintenanceConflicts = (maintenance) => {
    if (!maintenance.startDate || !maintenance.endDate) return [];

    const newStart = getPeriodTimestamp(maintenance.startDate, 'AM');
    const newEnd = getPeriodTimestamp(maintenance.endDate, 'PM');

    const conflicts = [];
    for (const r of reservations) {
      if (String(r.vehicleId) !== String(maintenance.vehicleId)) continue;

      const existingStart = getPeriodTimestamp(r.date, r.period);
      const existingEnd = getPeriodTimestamp(r.endDate || r.date, r.endPeriod || r.period);

      if (Math.max(newStart, existingStart) <= Math.min(newEnd, existingEnd)) {
        conflicts.push(r);
      }
    }
    return conflicts;
  };

  // Compter les pannes signalées, interventions programmées et demandes d'intervention
  const reportedMaintenances = maintenances.filter((m) => m.status === 'reported');
  const scheduledMaintenances = maintenances.filter((m) => m.status === STATUS.SCHEDULED);
  const pendingMaintenances = maintenances.filter((m) => m.status === STATUS.PENDING);
  const inProgressMaintenances = maintenances.filter((m) => m.status === 'in_progress');
  const immobilizedVehicles = reportedMaintenances.filter((m) => m.isImmobilized);

  // Détecter les interventions en retard (date de fin dépassée)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueInterventions = scheduledMaintenances.filter((m) => {
    if (!m.endDate) return false;
    const endDate = new Date(m.endDate);
    endDate.setHours(23, 59, 59, 999);
    return endDate < today;
  });

  // Détecter les interventions en conflit avec des réservations
  const conflictingMaintenances = scheduledMaintenances.filter((m) => {
    const conflicts = getMaintenanceConflicts(m);
    return conflicts.length > 0;
  });

  // Notifications d'interventions actives (cloche) - sans les demandes/pannes qui ont leur propre badge
  const activeInterventions = [
    ...scheduledMaintenances,
    ...inProgressMaintenances,
    ...overdueInterventions,
  ];

  // Handlers pour les interventions en retard
  const handleMarkCompleted = async (intervention) => {
    try {
      await onUpdateMaintenance(intervention.id, {
        ...intervention,
        status: STATUS.COMPLETED,
      });
      if (onRefreshMaintenances) {
        await onRefreshMaintenances();
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error("Erreur lors de la mise à jour de l'intervention");
    }
  };

  const handleMarkNotCompleted = async (intervention, reason) => {
    try {
      await onUpdateMaintenance(intervention.id, {
        ...intervention,
        status: STATUS.CANCELLED,
        notes: (intervention.notes ? intervention.notes + '\n\n' : '') + `[Annulée] ${reason}`,
      });
      if (onRefreshMaintenances) {
        await onRefreshMaintenances();
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error("Erreur lors de la mise à jour de l'intervention");
    }
  };

  const handleMarkPending = async (intervention, reason) => {
    try {
      await onUpdateMaintenance(intervention.id, {
        ...intervention,
        status: STATUS.PENDING,
        notes: (intervention.notes ? intervention.notes + '\n\n' : '') + `[En attente] ${reason}`,
      });
      if (onRefreshMaintenances) {
        await onRefreshMaintenances();
      }
    } catch (error) {
      console.error('Erreur lors de la mise en attente:', error);
      toast.error("Erreur lors de la mise en attente de l'intervention");
    }
  };

  const handleReschedule = async (intervention) => {
    try {
      await onUpdateMaintenance(intervention.id, {
        ...intervention,
        status: 'rescheduled',
        notes:
          (intervention.notes ? intervention.notes + '\n\n' : '') +
          `[Reportée] Intervention reportée le ${format(new Date(), 'dd/MM/yyyy')}`,
      });
      if (onRefreshMaintenances) {
        await onRefreshMaintenances();
      }
    } catch (error) {
      console.error('Erreur lors du report:', error);
      toast.error("Erreur lors du report de l'intervention");
    }
    setSelectedOverdueIntervention(null);
  };

  return (
    <>
      <div className="header">
        <div className="header-content">
          <div className="header-title-container">
            <div className="header-logo-area">
              <img src="/Logos/LogoEmagTransp.png" alt="eM@g Scene" className="header-logo" />
              <Tooltip content="Aide — Guide d'utilisation" position="bottom">
                <Button
                  variant="ghost"
                  className="help-trigger-btn"
                  onClick={onOpenHelp}
                  aria-label="Aide"
                >
                  <HelpCircle size={18} />
                  <span>Aide</span>
                </Button>
              </Tooltip>
              <Button
                variant="ghost"
                className="theme-toggle-btn"
                onClick={onToggleTheme}
                title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                aria-label="Basculer le thème"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </Button>
            </div>
            <div className="module-tabs" role="tablist" aria-label="Module principal">
              {(() => {
                // [Sprint B] Source unique : routes.config.js (évite la dérive entre Header,
                // UserPreferencesModal et la validation URL).
                const allTabs = DESKTOP_MODULES;
                const hiddenTabs = tabPrefs.hiddenTabs || [];
                const tabOrder = tabPrefs.tabOrder || allTabs.map((t) => t.id);
                const orderedTabs = tabOrder
                  .map((id) => allTabs.find((t) => t.id === id))
                  .filter((t) => t && !hiddenTabs.includes(t.id));
                allTabs.forEach((t) => {
                  if (!orderedTabs.find((ot) => ot.id === t.id) && !hiddenTabs.includes(t.id)) {
                    orderedTabs.push(t);
                  }
                });
                // #8 Compteurs de notifications par onglet (admin uniquement)
                const tabBadges = currentUser?.isAdmin
                  ? {
                      vehicles: pendingRequestsCounts.reservationRequests || 0,
                      orders: pendingMaterialRequests || 0,
                    }
                  : {};
                // Badge onglet Contrôles (tous utilisateurs) : rouge si
                // échéances dépassées, sinon orange si échéances dans 7 jours.
                const controlsCount =
                  controlsBadge.late > 0 ? controlsBadge.late : controlsBadge.soon;
                const controlsVariant = controlsBadge.late > 0 ? 'is-late' : 'is-soon';
                return orderedTabs.map((tab) => {
                  const Icon = tab.icon;
                  const badgeCount = tabBadges[tab.id] || 0;
                  const isControls = tab.id === 'controles';
                  const ctrlBadge = isControls && controlsCount > 0;
                  const ctrlTitle = isControls
                    ? controlsBadge.late > 0
                      ? `${controlsBadge.late} contrôle(s) dépassé(s)`
                      : `${controlsBadge.soon} contrôle(s) sous 7 jours`
                    : '';
                  return (
                    <Button
                      variant="ghost"
                      key={tab.id}
                      className={`module-tab ${activeModule === tab.id ? 'active' : ''}`}
                      onClick={() => setActiveModule(tab.id)}
                      role="tab"
                      aria-selected={activeModule === tab.id}
                    >
                      <Icon size={18} />
                      <span>{tab.label}</span>
                      {badgeCount > 0 && (
                        <span
                          className="module-tab-badge"
                          aria-label={`${badgeCount} demande(s) en attente`}
                          title={`${badgeCount} demande(s) en attente`}
                        >
                          {badgeCount > 9 ? '9+' : badgeCount}
                        </span>
                      )}
                      {ctrlBadge && (
                        <span
                          className={`module-tab-badge ${controlsVariant}`}
                          aria-label={ctrlTitle}
                          title={ctrlTitle}
                        >
                          {controlsCount > 9 ? '9+' : controlsCount}
                        </span>
                      )}
                    </Button>
                  );
                });
              })()}
            </div>
          </div>

          <HeaderNotifications
            showNotificationsPopup={showNotificationsPopup}
            setShowNotificationsPopup={setShowNotificationsPopup}
            showRequestsPopup={showRequestsPopup}
            setShowRequestsPopup={setShowRequestsPopup}
            notificationFilter={notificationFilter}
            overdueInterventions={overdueInterventions}
            scheduledMaintenances={scheduledMaintenances}
            inProgressMaintenances={inProgressMaintenances}
            pendingMaintenances={pendingMaintenances}
            reportedMaintenances={reportedMaintenances}
            activeInterventions={activeInterventions}
            vehicles={vehicles}
            onOpenMaintenance={onOpenMaintenance}
            currentUser={currentUser}
            pendingReservationRequests={pendingReservationRequests}
            setPendingReservationRequests={setPendingReservationRequests}
            pendingRequestsCounts={pendingRequestsCounts}
            setPendingRequestsCounts={setPendingRequestsCounts}
            reservations={reservations}
            onReservationUpdate={onReservationUpdate}
            setSelectedOverdueIntervention={setSelectedOverdueIntervention}
          />

          <HeaderActions
            currentUser={currentUser}
            reportedMaintenances={reportedMaintenances}
            immobilizedVehicles={immobilizedVehicles}
            pendingMaintenances={pendingMaintenances}
            activeInterventions={activeInterventions}
            overdueInterventions={overdueInterventions}
            conflictingMaintenances={conflictingMaintenances}
            pendingRequestsCounts={pendingRequestsCounts}
            pendingAccessRequests={pendingAccessRequests}
            unreadMsgCount={unreadMsgCount}
            onToggleMessaging={onToggleMessaging}
            onToggleMailing={onToggleMailing}
            onDetachSonos={onDetachSonos}
            onOpenSettings={onOpenSettings}
            onOpenPreferences={onOpenPreferences}
            onLogout={onLogout}
            onUserUpdate={onUserUpdate}
            setNotificationFilter={setNotificationFilter}
            setShowNotificationsPopup={setShowNotificationsPopup}
          />
        </div>
      </div>

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
    </>
  );
};

export default React.memo(Header);
