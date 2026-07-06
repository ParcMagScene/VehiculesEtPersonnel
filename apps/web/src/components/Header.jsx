import './Header.css';

import { HelpCircle, Moon, Sun, Upload } from 'lucide-react';
import React, { lazy, Suspense, useEffect, useState } from 'react';

import { Button, TabBadge, Tooltip } from '@/design-system';

const ImportsHubModal = lazy(() => import('./imports/ImportsHubModal'));

import { STATUS } from '../constants';
import { useToast } from '../hooks/useToast';
import { preloadModule } from '../router/moduleLoaders';
import { DESKTOP_MODULES } from '../router/routes.config';
import api from '../utils/api';
import { isApiCoolingDown } from '../utils/api/base';
import { getPeriodTimestamp } from '../utils/dateUtils';
import { refreshBus } from '../utils/refresh-bus';
import HeaderActions from './header/HeaderActions';
import HeaderNotifications from './header/HeaderNotifications';
import OverdueInterventionModal from './planning/OverdueInterventionModal';

const Header = ({
  onOpenSettings,
  activeModule,
  setActiveModule,
  maintenances = [],
  vehicles = [],
  onOpenMaintenance,
  onScheduleMaintenance,
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
  const [showImportsHub, setShowImportsHub] = useState(false);
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
    let interval = null;

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

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        loadAdminBadges();
      }, 30000);
    };

    const stopPolling = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    };

    const refreshOnVisible = () => {
      if (document.visibilityState !== 'visible') {
        stopPolling();
        return;
      }
      loadAdminBadges();
      startPolling();
    };

    const refreshOnFocus = () => {
      if (document.visibilityState !== 'visible') return;
      loadAdminBadges();
      startPolling();
    };

    loadAdminBadges();
    if (document.visibilityState === 'visible') {
      startPolling();
    }
    document.addEventListener('visibilitychange', refreshOnVisible);
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', refreshOnVisible);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [currentUser?.isAdmin]);

  // Badge onglet Contrôles : rechargé à l'ouverture, périodiquement, et sur
  // événement refreshBus('controls') publié après création/édition/effectuation.
  useEffect(() => {
    let cancelled = false;
    let interval = null;

    const loadControlsBadge = async () => {
      if (!currentUser?.id) return;
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

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        loadControlsBadge();
      }, 60000);
    };

    const stopPolling = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    };

    const refreshOnVisible = () => {
      if (document.visibilityState !== 'visible') {
        stopPolling();
        return;
      }
      loadControlsBadge();
      startPolling();
    };

    const refreshOnFocus = () => {
      if (document.visibilityState !== 'visible') return;
      loadControlsBadge();
      startPolling();
    };

    loadControlsBadge();
    if (document.visibilityState === 'visible') {
      startPolling();
    }
    document.addEventListener('visibilitychange', refreshOnVisible);
    window.addEventListener('focus', refreshOnFocus);
    const unsub = refreshBus.subscribe('controls', loadControlsBadge);
    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener('visibilitychange', refreshOnVisible);
      window.removeEventListener('focus', refreshOnFocus);
      unsub();
    };
  }, [currentUser?.id]);

  // Charger les demandes de réservation en attente (au démarrage + quand un popup s'ouvre)
  useEffect(() => {
    const loadPendingReservations = async () => {
      if (!currentUser?.isAdmin) return;
      if (!showRequestsPopup && !showNotificationsPopup) return;
      if (isApiCoolingDown()) return;
      try {
        const data = await api.getPendingReservationRequests();
        setPendingReservationRequests(data);
      } catch {
        // Silencieux : liste vide conservée
      }
    };
    loadPendingReservations();
  }, [showRequestsPopup, showNotificationsPopup, currentUser?.isAdmin]);

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

  const handleDeleteSignalement = async (intervention) => {
    try {
      await api.deleteMaintenance(intervention.id);
      if (onRefreshMaintenances) {
        await onRefreshMaintenances();
      }
      refreshBus.publish('planning');
      toast.success('Signalement supprimé');
    } catch (error) {
      console.error('Erreur lors de la suppression du signalement:', error);
      toast.error('Impossible de supprimer le signalement');
      throw error;
    }
  };

  const handleCloseSignalement = async (intervention, description) => {
    try {
      await onUpdateMaintenance(intervention.id, {
        ...intervention,
        status: STATUS.COMPLETED,
        notes: (intervention.notes ? `${intervention.notes}\n\n` : '') + `[Clôturé] ${description}`,
      });
      if (onRefreshMaintenances) {
        await onRefreshMaintenances();
      }
      refreshBus.publish('planning');
      toast.success('Signalement clôturé');
    } catch (error) {
      console.error('Erreur lors de la clôture du signalement:', error);
      toast.error('Impossible de clôturer le signalement');
      throw error;
    }
  };

  return (
    <>
      <div className="header">
        <div className="header-content">
          <div className="header-title-container">
            <div className="header-logo-area">
              <img src="/Logos/LogoEmagTransp.png" alt="eM@g Scene" className="header-logo" />
              <Tooltip content="Aide — Guide d'utilisation" position="bottom">
                <Button variant="ghost" className="help-trigger-btn" onClick={onOpenHelp}>
                  <HelpCircle size={18} />
                  <span>Aide</span>
                </Button>
              </Tooltip>
              <Tooltip content="Imports & Documents" position="bottom">
                <Button
                  variant="ghost"
                  className="header-imports-btn"
                  onClick={() => setShowImportsHub(true)}
                  aria-label="Ouvrir le hub d'imports"
                >
                  <Upload size={18} />
                </Button>
              </Tooltip>
              <Tooltip
                content={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                position="bottom"
              >
                <Button
                  variant="ghost"
                  className="theme-toggle-btn"
                  onClick={onToggleTheme}
                  aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </Button>
              </Tooltip>
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
                const controlsVariant = controlsBadge.late > 0 ? 'late' : 'soon';
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
                      onMouseEnter={() => preloadModule(tab.id)}
                      onFocus={() => preloadModule(tab.id)}
                      role="tab"
                      aria-selected={activeModule === tab.id}
                    >
                      <Icon size={18} />
                      <span>{tab.label}</span>
                      {badgeCount > 0 && (
                        <TabBadge
                          count={badgeCount}
                          label={`${badgeCount} demande(s) en attente`}
                        />
                      )}
                      {ctrlBadge && (
                        <TabBadge
                          variant={controlsVariant}
                          count={controlsCount}
                          label={ctrlTitle}
                        />
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
            onDeleteSignalement={handleDeleteSignalement}
            onCloseSignalement={handleCloseSignalement}
            onScheduleMaintenance={onScheduleMaintenance}
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
          onPlanIntervention={onScheduleMaintenance}
          onDeleteSignalement={handleDeleteSignalement}
          onCloseSignalement={handleCloseSignalement}
        />
      )}

      {showImportsHub && (
        <Suspense fallback={null}>
          <ImportsHubModal onClose={() => setShowImportsHub(false)} />
        </Suspense>
      )}
    </>
  );
};

export default React.memo(Header);
