import './Header.css';

import { format } from 'date-fns';
import {
  Boxes,
  Briefcase,
  Building2,
  HelpCircle,
  MapPin,
  Moon,
  Music,
  Package,
  Radio,
  ShoppingCart,
  Sun,
  Truck,
  Video,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Button, Tooltip } from '@/design-system';

import { STATUS } from '../constants';
import { useToast } from '../hooks/useToast';
import api from '../utils/api';
import { getPeriodTimestamp } from '../utils/dateUtils';
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

  // Charger les demandes en attente (interventions + réservations) pour le badge admin
  useEffect(() => {
    const loadPendingRequestsCounts = async () => {
      if (currentUser?.isAdmin) {
        try {
          const data = await api.getPendingRequestsCount();
          setPendingRequestsCounts(data);
        } catch {
          // Silencieux : valeurs initiales conservées (badge = 0)
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
        } catch {
          // Silencieux : liste vide conservée
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
        } catch {
          // Silencieux : compteur à 0 conservé
        }
      }
    };

    loadPendingRequests();
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
                const allTabs = [
                  { id: 'vehicles', label: 'Parc', icon: Truck },
                  { id: 'equipment', label: 'Équipements', icon: Package },
                  { id: 'affaires', label: 'Affaires', icon: Briefcase },
                  { id: 'orders', label: 'Commandes', icon: ShoppingCart },
                  { id: 'stock', label: 'Stocks', icon: Boxes },
                  { id: 'planning', label: 'Planning', icon: Radio },
                  { id: 'annuaire', label: 'Annuaire', icon: Building2 },
                  { id: 'lieux', label: 'Lieux', icon: MapPin },
                  { id: 'video', label: 'Vidéo', icon: Video },
                  { id: 'sonos', label: 'Sonos', icon: Music },
                ];
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
                return orderedTabs.map((tab) => {
                  const Icon = tab.icon;
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
