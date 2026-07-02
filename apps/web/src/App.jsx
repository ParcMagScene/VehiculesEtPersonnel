import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import AppChrome from './components/app/AppChrome';
import AppStatusBar from './components/app/AppStatusBar';
import GlobalOverlays from './components/app/GlobalOverlays';
import ModuleHost from './components/app/ModuleHost';
const GoogleCalendarBanner = lazy(() => import('./components/vehicles/GoogleCalendarBanner'));
import './App.css';
import './styles/draggable-modals.css';

import LoginForm from './components/auth/LoginForm';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PersonalAuthProvider } from './contexts/PersonalAuthContext.jsx';
import { LoadingOverlay } from './design-system';
import { useAppData } from './hooks/useAppData';
import { useDocumentBadge } from './hooks/useDocumentBadge';
import { useDraggableModals } from './hooks/useDraggableModals';
import { useFeedback } from './hooks/useFeedback';
import useGoogleBannerOrchestration from './hooks/useGoogleBannerOrchestration';
import { useGoogleCalendar } from './hooks/useGoogleCalendar';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useMessagingPolling } from './hooks/useMessagingPolling';
import { useSilentRefresh } from './hooks/useSilentRefresh';
import { useTheme } from './hooks/useTheme';
import { ToastProvider } from './hooks/useToast';
import { useVSCodeTheme } from './hooks/useVSCodeTheme';
import { useSearchParamState } from './router/RouterCompat';
import {
  ALLOWED_MODULES,
  CALENDAR_VIEWS,
  DEFAULT_CALENDAR_VIEW,
  DEFAULT_MODULE,
  DEFAULT_STOCK_SUBTAB,
  STOCK_SUBTABS,
} from './router/routes.config';
import api from './utils/api';
import { getApiNetworkStatus, subscribeApiNetworkStatus } from './utils/api/base';

const PresetDetachedView = lazy(() => import('./components/video/PresetDetachedView'));

const MobileApp = lazy(() => import('./components/mobile/MobileApp'));

// Détection fiable d'un appareil mobile (matchMedia)
const detectMobile = () => {
  if (window.location.pathname === '/mobile' || window.location.hash.startsWith('#/mobile')) {
    return true;
  }
  if (sessionStorage.getItem('forceDesktop') === 'true') {
    return false;
  }
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
  return isCoarsePointer && isSmallScreen;
};

const normalizeLegacyModule = (moduleId) => {
  if (moduleId === 'lieux') return 'annuaire';
  return moduleId;
};

function AppContent() {
  // ═══ Auth (contexte) ═══
  const {
    isAuthenticated,
    currentUser,
    isAuthLoading,
    login,
    loginPin,
    logout,
    updateUser,
    tabPrefs,
    userPrefsRef,
    updatePreferences,
  } = useAuth();

  // ═══ Silent Refresh (renouvellement automatique du token JWT) ═══
  useSilentRefresh(isAuthenticated, updateUser);

  // ═══ Feedback & Theme ═══
  const { toastRef, toast } = useFeedback();
  const { theme, toggleTheme, isDark, palette, setPalette } = useTheme();
  const { isVSCode } = useVSCodeTheme();
  useDraggableModals();

  // ═══ Données métier (hook) ═══
  const data = useAppData({
    isAuthenticated,
    isAuthLoading,
    currentUser,
    toast,
    onAuthError: logout,
  });

  // ═══ Google Calendar (hook) ═══
  const { googleEvents, allGoogleEvents, handleGoogleEventsChange } = useGoogleCalendar();

  // ═══ UI State ═══
  const [isMobile, setIsMobile] = useState(() => detectMobile());
  // [Sprint B] view calendrier persistée dans URL (?view=week|month|day)
  const [view, setView] = useSearchParamState('view', DEFAULT_CALENDAR_VIEW, {
    allowed: CALENDAR_VIEWS,
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  // [Sprint B] activeModule = URL search param ?module=xxx (source de vérité)
  // - refresh F5 → module restauré gratuitement
  // - replace history (clic d'onglet ne pollue pas le bouton "Précédent")
  // - fallback localStorage uniquement au TOUT premier chargement (cf. effet plus bas)
  const [activeModule, _setActiveModule] = useSearchParamState('module', DEFAULT_MODULE, {
    allowed: ALLOWED_MODULES,
  });
  const [, startModuleTransition] = useTransition();
  const setActiveModule = useCallback(
    (mod) => {
      const normalizedModule = normalizeLegacyModule(mod);
      // Fermer les panneaux véhicules à chaque changement de module
      setVehicleForDialog(null);
      setSelectedVehicleForDetails(null);
      setSelectedVehicleForMaintenance(null);
      setSelectedVehicleForKilometrageControl(null);
      setMaintenanceToEdit(null);
      setMaintenanceActionType(null);
      startModuleTransition(() => _setActiveModule(normalizedModule));
    },
    [_setActiveModule],
  );

  // [Sprint B] Restauration unique au tout premier chargement :
  // si l'URL n'a PAS de ?module= mais que localStorage en a un, on le réapplique.
  // Ensuite l'URL devient l'unique source de vérité.
  const restoredFromStorageRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || restoredFromStorageRef.current) return;
    restoredFromStorageRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const legacyUrlModule = params.get('module');
    if (legacyUrlModule === 'lieux') {
      _setActiveModule('annuaire');
      return;
    }
    if (!params.get('module')) {
      const stored = localStorage.getItem('emag_last_module');
      const normalizedStored = normalizeLegacyModule(stored);
      if (
        normalizedStored &&
        ALLOWED_MODULES.has(normalizedStored) &&
        normalizedStored !== DEFAULT_MODULE
      ) {
        _setActiveModule(normalizedStored);
      }
    }
  }, [isAuthenticated, _setActiveModule]);

  // [Sprint B] Miroir localStorage (utile si l'utilisateur ouvre un nouvel onglet
  // depuis un bookmark sans search param). N'est PLUS la source de vérité.
  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      localStorage.setItem('emag_last_module', normalizeLegacyModule(activeModule));
    } catch {
      /* quota / private mode : ignoré */
    }
  }, [activeModule, isAuthenticated]);
  const [showManagement, setShowManagement] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEquipmentManagement, setShowEquipmentManagement] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [showMailing, setShowMailing] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // [Sprint B] sous-onglet Stock persisté dans URL (?tab=vente|sav|inventory)
  const [stockSubTab, setStockSubTab] = useSearchParamState('tab', DEFAULT_STOCK_SUBTAB, {
    allowed: STOCK_SUBTABS,
  });
  const [showStockManagement, setShowStockManagement] = useState(false);
  const [personnelRefreshKey, setPersonnelRefreshKey] = useState(0);
  const [navigateToPersonId, setNavigateToPersonId] = useState(null);
  const [quickReservationSlot, setQuickReservationSlot] = useState(null);
  const [quickAssignmentSlot, setQuickAssignmentSlot] = useState(null);
  const [hoveredEventId, setHoveredEventId] = useState(null);
  const [apiNetworkStatus, setApiNetworkStatus] = useState(() => getApiNetworkStatus());
  const [reservationToEdit, setReservationToEdit] = useState(null);
  const [selectedVehicleForMaintenance, setSelectedVehicleForMaintenance] = useState(null);
  const [maintenanceToEdit, setMaintenanceToEdit] = useState(null);
  const [maintenanceActionType, setMaintenanceActionType] = useState(null);
  const [selectedVehicleForDetails, setSelectedVehicleForDetails] = useState(null);
  const [vehicleForDialog, setVehicleForDialog] = useState(null);
  const [vehicleForManagementEdit, setVehicleForManagementEdit] = useState(null);
  const [selectedVehicleForKilometrageControl, setSelectedVehicleForKilometrageControl] =
    useState(null);
  const [googleEventForReservation, setGoogleEventForReservation] = useState(null);
  const [globalAffaireDialog, setGlobalAffaireDialog] = useState(null);
  // Demande d'ouverture du modal KM & CT (édition contrôles véhicule) depuis
  // le tableau Contrôles. Les modals d'édition sont rendus au niveau App donc
  // pas besoin de basculer de module.
  const openEventDetailsModalRef = useRef(null);
  const sonosDetachedWindowRef = useRef(null);

  useEffect(() => {
    return subscribeApiNetworkStatus((status) => {
      setApiNetworkStatus(status);
    });
  }, []);

  // Cross-module : ouverture demandée depuis le tableau Contrôles via
  // CustomEvent `emag:open-entity` { type: 'vehicle' | 'equipment', id }.
  // - Véhicule : ouvre directement le modal KM & CT (édition des contrôles).
  //   Le modal est full-screen donc pas besoin de basculer de module.
  // - Équipement : géré localement par ControlsDashboard (ControlEditorModal),
  //   pas traité ici.
  useEffect(() => {
    const onOpen = (e) => {
      const { type, id } = e.detail || {};
      if (type !== 'vehicle' || id == null) return;
      const target = data?.vehicles?.find((v) => String(v.id) === String(id));
      if (target) setSelectedVehicleForKilometrageControl(target);
    };
    window.addEventListener('emag:open-entity', onOpen);
    return () => window.removeEventListener('emag:open-entity', onOpen);
  }, [data?.vehicles]);

  const handleDetachSonos = useCallback(() => {
    const sonosUrl = `${window.location.origin}${window.location.pathname}?module=sonos&detached=1`;
    const existing = sonosDetachedWindowRef.current;

    if (existing && !existing.closed) {
      try {
        existing.location.href = sonosUrl;
        existing.focus();
      } catch {
        // Ignore cross-window focus errors and fallback to a new window.
      }
      return;
    }

    const popup = window.open(
      sonosUrl,
      'emag-sonos-detached',
      'width=1320,height=860,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes',
    );

    if (popup) {
      sonosDetachedWindowRef.current = popup;
      popup.focus();
    } else {
      toast.error(
        'Popup bloquee. Autorisez les popups pour ouvrir Sonos dans une fenetre detachee.',
      );
    }
  }, [toast]);

  // ═══ Messaging polling (hook) ═══
  const showMessagingRef = useRef(false);
  useEffect(() => {
    showMessagingRef.current = showMessaging;
  }, [showMessaging]);

  const { unreadMsgCount } = useMessagingPolling({
    currentUser,
    userPrefsRef,
    showMessagingRef,
    toast,
  });

  // Badge titre + favicon (visible meme si l'onglet est en arriere-plan).
  useDocumentBadge(unreadMsgCount);

  // ═══ Mobile detection ═══
  // [Sprint C] Le hashchange listener a été retiré : `detectMobile()` se base
  // d'abord sur `pathname === '/mobile'` ou `hash startsWith '#/mobile'`, mais
  // ces deux valeurs ne changent qu'au premier chargement (hashchange déclenché
  // par useMobileRouter) ou sur resize. Le matchMedia couvre déjà le cas
  // viewport, l'effet ci-dessous (qui pose le hash si isMobile) couvre le reste.
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handleResize = () => setIsMobile(detectMobile());
    mql.addEventListener('change', handleResize);
    return () => {
      mql.removeEventListener('change', handleResize);
    };
  }, []);

  useEffect(() => {
    if (isMobile && !window.location.hash.startsWith('#/mobile')) {
      window.location.hash = '#/mobile';
    }
  }, [isMobile]);

  // ═══ Raccourcis clavier ═══
  useKeyboardShortcuts(
    {
      mod_vehicles: () => {
        setActiveModule('vehicles');
        setShowManagement(false);
        setShowSettings(false);
      },
      mod_personnel: () => {
        setActiveModule('planning');
        setShowManagement(false);
        setShowSettings(false);
      },
      mod_affaires: () => {
        setActiveModule('affaires');
        setShowManagement(false);
        setShowSettings(false);
      },
      mod_equipment: () => {
        setActiveModule('equipment');
        setShowManagement(false);
        setShowSettings(false);
      },
      mod_orders: () => {
        setActiveModule('orders');
        setShowManagement(false);
        setShowSettings(false);
      },
      // [Sprint A] Raccourci `mod_catalog` supprimé — module orphelin (cf. audit nav).
      open_messaging: () => setShowMessaging((v) => !v),
      open_help: () => setShowHelp((v) => !v),
      open_preferences: () => setShowPreferences(true),
      new_reservation: () => {
        setActiveModule('vehicles');
        setShowManagement(false);
        setShowSettings(false);
        setQuickReservationSlot({
          vehicleId: null,
          date: new Date().toISOString().slice(0, 10),
          period: 'morning',
          endDate: new Date().toISOString().slice(0, 10),
          endPeriod: 'afternoon',
        });
      },
      close_modal: () => {
        if (showHelp) {
          setShowHelp(false);
          return;
        }
        if (showPreferences) {
          setShowPreferences(false);
          return;
        }
        if (showMessaging) {
          setShowMessaging(false);
          return;
        }
        if (selectedVehicleForMaintenance) {
          setSelectedVehicleForMaintenance(null);
          setMaintenanceToEdit(null);
          setMaintenanceActionType(null);
          return;
        }
        if (vehicleForDialog) {
          setVehicleForDialog(null);
          return;
        }
        if (selectedVehicleForDetails) {
          setSelectedVehicleForDetails(null);
          return;
        }
        if (showManagement) {
          setShowManagement(false);
          return;
        }
        if (showSettings) {
          setShowSettings(false);
          return;
        }
      },
      nav_prev: () => {
        if (activeModule !== 'vehicles') return;
        const d = new Date(currentDate);
        if (view === 'day') d.setDate(d.getDate() - 1);
        else if (view === 'week') d.setDate(d.getDate() - 7);
        else if (view === 'month') d.setMonth(d.getMonth() - 1);
        else d.setFullYear(d.getFullYear() - 1);
        setCurrentDate(d);
      },
      nav_next: () => {
        if (activeModule !== 'vehicles') return;
        const d = new Date(currentDate);
        if (view === 'day') d.setDate(d.getDate() + 1);
        else if (view === 'week') d.setDate(d.getDate() + 7);
        else if (view === 'month') d.setMonth(d.getMonth() + 1);
        else d.setFullYear(d.getFullYear() + 1);
        setCurrentDate(d);
      },
      nav_today: () => {
        if (activeModule === 'vehicles') setCurrentDate(new Date());
      },
    },
    isAuthenticated && !isMobile,
  );

  // ═══ Valeurs calculées ═══
  const highlightedReservationIds = useMemo(() => {
    if (!hoveredEventId) return [];
    return data.reservations.filter((r) => r.googleEventId === hoveredEventId).map((r) => r.id);
  }, [hoveredEventId, data.reservations]);

  // ═══ Login : appliquer les préférences UI ═══
  const handleLogin = useCallback(
    async (email, password) => {
      const result = await login(email, password);
      const prefs = result.prefs || {};
      if (prefs.defaultModule === 'trucks') setActiveModule('vehicles');
      else if (prefs.defaultModule === 'communication' || prefs.defaultModule === 'personnel')
        setActiveModule('planning');
      else if (prefs.defaultModule === 'inventory') setActiveModule('stock');
      else if (prefs.defaultModule) setActiveModule(normalizeLegacyModule(prefs.defaultModule));
      if (prefs.defaultView) setView(prefs.defaultView);
      return result;
    },
    [login, setActiveModule, setView],
  );

  const handleLoginPin = useCallback(
    async (email, pin) => {
      const result = await loginPin(email, pin);
      const prefs = result.prefs || {};
      if (prefs.defaultModule === 'trucks') setActiveModule('vehicles');
      else if (prefs.defaultModule === 'communication' || prefs.defaultModule === 'personnel')
        setActiveModule('planning');
      else if (prefs.defaultModule === 'inventory') setActiveModule('stock');
      else if (prefs.defaultModule) setActiveModule(normalizeLegacyModule(prefs.defaultModule));
      if (prefs.defaultView) setView(prefs.defaultView);
      return result;
    },
    [loginPin, setActiveModule, setView],
  );

  // ═══ Navigation croisée entre modules ═══
  const handleNavigateToEntity = useCallback(
    (type, entityData) => {
      if (type === 'vehicle') {
        const v = data.vehicles.find((v) => v.id === entityData.id);
        if (v) {
          setActiveModule('vehicles');
          setShowManagement(false);
          setShowSettings(false);
          setSelectedVehicleForDetails(v);
        }
      } else if (type === 'person') {
        setActiveModule('planning');
        setShowManagement(false);
        setShowSettings(false);
        setNavigateToPersonId(entityData.id);
      } else if (type === 'reservation') {
        setActiveModule('vehicles');
        setShowManagement(false);
        setShowSettings(false);
        setReservationToEdit(entityData.id);
      } else if (type === 'affaire') {
        const numero = entityData.numero || entityData.numeroAffaire;
        if (!numero) return;
        api
          .getAffaires()
          .then((all) => {
            const affairesArr = Array.isArray(all) ? all : all?.affaires || [];
            const found = affairesArr.find(
              (a) => a.numeroAffaire === numero || a.numero_affaire === numero,
            );
            if (found) setGlobalAffaireDialog(found);
          })
          .catch(() => {});
      }
    },
    [data.vehicles, setActiveModule],
  );

  // ═══ Actions maintenance ═══
  const handleRequestMaintenance = (vehicle) => {
    setMaintenanceToEdit(null);
    setMaintenanceActionType('request');
    setSelectedVehicleForMaintenance(vehicle);
  };

  const handleReportBreakdown = (vehicle) => {
    setMaintenanceToEdit(null);
    setMaintenanceActionType('breakdown');
    setSelectedVehicleForMaintenance(vehicle);
  };

  const handleScheduleMaintenance = (vehicle) => {
    setMaintenanceToEdit(null);
    setMaintenanceActionType('schedule');
    setSelectedVehicleForMaintenance(vehicle);
  };

  const { showGoogleBanner, handleCalendarScroll, googleBannerProps } =
    useGoogleBannerOrchestration({
      activeModule,
      view,
      currentDate,
      currentUser,
      data,
      handleGoogleEventsChange,
      setActiveModule,
      setShowManagement,
      setShowSettings,
      setQuickReservationSlot,
      setQuickAssignmentSlot,
      setGoogleEventForReservation,
      setHoveredEventId,
      setReservationToEdit,
      openEventDetailsModalRef,
      toast,
    });

  // ═══ Render ═══

  if (isMobile) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingOverlay label="Chargement..." />}>
          <MobileApp
            onSwitchToDesktop={() => {
              sessionStorage.setItem('forceDesktop', 'true');
              window.location.hash = '';
              setIsMobile(false);
            }}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (isAuthLoading) {
    return (
      <div className="app loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Chargement des données...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app">
        <LoginForm onLogin={handleLogin} onLoginPin={handleLoginPin} />
      </div>
    );
  }

  if (data.isDataLoading) {
    return (
      <div className="app loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Chargement des données...</p>
        </div>
      </div>
    );
  }

  const headerProps = {
    onOpenSettings: () => setShowSettings(true),
    activeModule,
    setActiveModule,
    maintenances: data.maintenances,
    vehicles: data.vehicles,
    reservations: data.reservations,
    onOpenMaintenance: (vehicle, maintenanceId) => {
      setSelectedVehicleForMaintenance(vehicle);
      setMaintenanceActionType(null);
      setMaintenanceToEdit(maintenanceId);
    },
    onScheduleMaintenance: handleScheduleMaintenance,
    currentUser,
    onLogout: logout,
    onUserUpdate: updateUser,
    onUpdateMaintenance: data.handleUpdateIntervention,
    onRefreshMaintenances: data.loadMaintenances,
    onReservationUpdate: async () => {
      try {
        const res = await api.getReservations();
        data.setReservations(res);
      } catch (e) {
        console.error('Erreur rechargement réservations:', e);
      }
    },
    onToggleMessaging: () => setShowMessaging((v) => !v),
    onToggleMailing: () => setShowMailing((v) => !v),
    onDetachSonos: handleDetachSonos,
    unreadMsgCount,
    onOpenPreferences: () => setShowPreferences(true),
    onOpenHelp: () => setShowHelp(true),
    tabPrefs,
    theme,
    onToggleTheme: toggleTheme,
  };

  return (
    <ErrorBoundary>
      <ToastProvider toast={toast}>
        <AppChrome
          onNavigateToEntity={handleNavigateToEntity}
          apiNetworkStatus={apiNetworkStatus}
          headerProps={headerProps}
          showGoogleBanner={showGoogleBanner}
          googleBannerProps={googleBannerProps}
          GoogleCalendarBanner={GoogleCalendarBanner}
        >
          <main id="main-content">
            <ModuleHost
              activeModule={activeModule}
              view={view}
              setView={setView}
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              data={data}
              currentUser={currentUser}
              showEquipmentManagement={showEquipmentManagement}
              setShowEquipmentManagement={setShowEquipmentManagement}
              stockSubTab={stockSubTab}
              setStockSubTab={setStockSubTab}
              showStockManagement={showStockManagement}
              setShowStockManagement={setShowStockManagement}
              allGoogleEvents={allGoogleEvents}
              handleNavigateToEntity={handleNavigateToEntity}
              personnelRefreshKey={personnelRefreshKey}
              navigateToPersonId={navigateToPersonId}
              setNavigateToPersonId={setNavigateToPersonId}
              quickAssignmentSlot={quickAssignmentSlot}
              setQuickAssignmentSlot={setQuickAssignmentSlot}
              googleBannerSlot={
                <Suspense fallback={null}>
                  <GoogleCalendarBanner {...googleBannerProps} />
                </Suspense>
              }
              handleCalendarScroll={handleCalendarScroll}
              googleEventForReservation={googleEventForReservation}
              setGoogleEventForReservation={setGoogleEventForReservation}
              googleEvents={googleEvents}
              highlightedReservationIds={highlightedReservationIds}
              reservationToEdit={reservationToEdit}
              setReservationToEdit={setReservationToEdit}
              setSelectedVehicleForDetails={setSelectedVehicleForDetails}
              setVehicleForDialog={setVehicleForDialog}
              setMaintenanceActionType={setMaintenanceActionType}
              setSelectedVehicleForMaintenance={setSelectedVehicleForMaintenance}
              setMaintenanceToEdit={setMaintenanceToEdit}
              openEventDetailsModalRef={openEventDetailsModalRef}
              quickReservationSlot={quickReservationSlot}
              setQuickReservationSlot={setQuickReservationSlot}
              selectedVehicleForDetails={selectedVehicleForDetails}
              handleScheduleMaintenance={handleScheduleMaintenance}
              handleRequestMaintenance={handleRequestMaintenance}
              setSelectedVehicleForKilometrageControl={setSelectedVehicleForKilometrageControl}
              handleReportBreakdown={handleReportBreakdown}
              setShowManagement={setShowManagement}
              setVehicleForManagementEdit={setVehicleForManagementEdit}
              toast={toast}
            />

            <GlobalOverlays
              showManagement={showManagement}
              setShowManagement={setShowManagement}
              activeModule={activeModule}
              setPersonnelRefreshKey={setPersonnelRefreshKey}
              showSettings={showSettings}
              setShowSettings={setShowSettings}
              setActiveModule={setActiveModule}
              selectedVehicleForMaintenance={selectedVehicleForMaintenance}
              setSelectedVehicleForMaintenance={setSelectedVehicleForMaintenance}
              maintenanceToEdit={maintenanceToEdit}
              setMaintenanceToEdit={setMaintenanceToEdit}
              maintenanceActionType={maintenanceActionType}
              setMaintenanceActionType={setMaintenanceActionType}
              vehicleForDialog={vehicleForDialog}
              setVehicleForDialog={setVehicleForDialog}
              vehicleForManagementEdit={vehicleForManagementEdit}
              setVehicleForManagementEdit={setVehicleForManagementEdit}
              selectedVehicleForKilometrageControl={selectedVehicleForKilometrageControl}
              setSelectedVehicleForKilometrageControl={setSelectedVehicleForKilometrageControl}
              showMessaging={showMessaging}
              setShowMessaging={setShowMessaging}
              showMailing={showMailing}
              setShowMailing={setShowMailing}
              showPreferences={showPreferences}
              setShowPreferences={setShowPreferences}
              palette={palette}
              setPalette={setPalette}
              isDark={isDark}
              toggleTheme={toggleTheme}
              updatePreferences={updatePreferences}
              showHelp={showHelp}
              setShowHelp={setShowHelp}
              globalAffaireDialog={globalAffaireDialog}
              setGlobalAffaireDialog={setGlobalAffaireDialog}
              data={data}
              currentUser={currentUser}
              handleRequestMaintenance={handleRequestMaintenance}
              handleReportBreakdown={handleReportBreakdown}
              handleScheduleMaintenance={handleScheduleMaintenance}
              toast={toast}
              handleNavigateToEntity={handleNavigateToEntity}
              toastRef={toastRef}
            />
          </main>

          {/* Status bar VS Code */}
          {isVSCode && <AppStatusBar activeModule={activeModule} />}
        </AppChrome>
      </ToastProvider>
    </ErrorBoundary>
  );
}

function App() {
  // Fenêtre détachée preset vidéo
  const detachedPresetIdParam = new URLSearchParams(window.location.search).get('detached-preset');
  const detachedPresetId = Number.parseInt(detachedPresetIdParam || '', 10);
  if (Number.isInteger(detachedPresetId) && detachedPresetId > 0) {
    return (
      <AuthProvider>
        <Suspense
          fallback={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
              }}
            >
              Chargement...
            </div>
          }
        >
          <PresetDetachedView presetId={detachedPresetId} />
        </Suspense>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <PersonalAuthProvider>
        <AppContent />
      </PersonalAuthProvider>
    </AuthProvider>
  );
}

export default App;
