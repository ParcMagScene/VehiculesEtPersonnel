import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef } from 'react';
import { format } from 'date-fns';
import Header from './components/Header';
const GoogleCalendarBanner = lazy(() => import('./components/vehicles/GoogleCalendarBanner'));
import { VehicleSlidePanel } from './components/vehicles/VehicleDetailPanel';
import LoginForm from './components/auth/LoginForm';
import ErrorBoundary from './components/ErrorBoundary';
const PlanningView = lazy(() => import('./components/vehicles/PlanningView'));
import api from './utils/api';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useFeedback } from './hooks/useFeedback';
import { useTheme } from './hooks/useTheme';
import { useVSCodeTheme } from './hooks/useVSCodeTheme';
import { useDraggableModals } from './hooks/useDraggableModals';
import { ToastProvider } from './hooks/useToast';
import { NavigationProvider } from './contexts/NavigationContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useAppData } from './hooks/useAppData';
import { useSilentRefresh } from './hooks/useSilentRefresh';
import { useGoogleCalendar } from './hooks/useGoogleCalendar';
import { useMessagingPolling } from './hooks/useMessagingPolling';
import { LoadingOverlay } from './design-system';
import './App.css';
import './styles/draggable-modals.css';

const ToastContainer = lazy(() => import('./components/ToastContainer'));

// Code splitting - Lazy loading des composants lourds
const Calendar = lazy(() => import('./components/vehicles/Calendar'));
const VehicleDetailsModal = lazy(() => import('./components/vehicles/VehicleDetailsModal'));
const MobileApp = lazy(() => import('./components/mobile/MobileApp'));
const ManagementPanel = lazy(() => import('./components/management/ManagementPanel'));
const MaintenanceDialog = lazy(() => import('./components/vehicles/MaintenanceDialog'));
const VehicleMaintenanceModal = lazy(() => import('./components/vehicles/VehicleMaintenanceModal'));
const PersonnelPanel = lazy(() => import('./components/personnel/PersonnelPanel'));
const AffairesPanel = lazy(() => import('./components/affaires/AffairesPanel'));
const EquipmentPanel = lazy(() => import('./components/equipment/EquipmentPanel'));
const OrdersPanel = lazy(() => import('./components/orders/OrdersPanel'));
const StockPanel = lazy(() => import('./components/orders/StockPanel'));
const InventoryPanel = lazy(() => import('./components/inventory/InventoryPanel'));
const PlanningPanel = lazy(() => import('./components/planning/PlanningPanel'));
const MessagingPanel = lazy(() => import('./components/messaging/MessagingPanel'));
const MailingPanel = lazy(() => import('./components/mailing/MailingPanel'));
const AnnuairePanel = lazy(() => import('./components/annuaire/AnnuairePanel'));
const VideoPanel = lazy(() => import('./components/video/VideoPanel'));
const AffaireDetailDialog = lazy(() => import('./components/affaires/AffaireDetailPanel').then(m => ({ default: m.AffaireDetailDialog })));
const UserPreferencesModal = lazy(() => import('./components/auth/UserPreferencesModal'));
const HelpModal = lazy(() => import('./components/HelpModal'));

// Détection fiable d'un appareil mobile
const detectMobile = () => {
  if (window.location.pathname === '/mobile' || window.location.hash.startsWith('#/mobile')) {
    return true;
  }
  if (sessionStorage.getItem('forceDesktop') === 'true') {
    return false;
  }
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  return isMobileUA && (isTouchDevice || isSmallScreen);
};

function AppContent() {
  // ═══ Auth (contexte) ═══
  const {
    isAuthenticated, currentUser, isAuthLoading,
    login, logout, updateUser,
    tabPrefs, userPrefsRef, updatePreferences,
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
  const [view, setView] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeModule, setActiveModule] = useState('vehicles');
  const [showManagement, setShowManagement] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEquipmentManagement, setShowEquipmentManagement] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [showMailing, setShowMailing] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [stockSubTab, setStockSubTab] = useState('vente');
  const [showStockManagement, setShowStockManagement] = useState(false);
  const [personnelRefreshKey, setPersonnelRefreshKey] = useState(0);
  const [navigateToPersonId, setNavigateToPersonId] = useState(null);
  const [quickReservationSlot, setQuickReservationSlot] = useState(null);
  const [quickAssignmentSlot, setQuickAssignmentSlot] = useState(null);
  const [hoveredEventId, setHoveredEventId] = useState(null);
  const [reservationToEdit, setReservationToEdit] = useState(null);
  const [selectedVehicleForMaintenance, setSelectedVehicleForMaintenance] = useState(null);
  const [maintenanceToEdit, setMaintenanceToEdit] = useState(null);
  const [maintenanceActionType, setMaintenanceActionType] = useState(null);
  const [selectedVehicleForDetails, setSelectedVehicleForDetails] = useState(null);
  const [vehicleForDialog, setVehicleForDialog] = useState(null);
  const [selectedVehicleForKilometrageControl, setSelectedVehicleForKilometrageControl] = useState(null);
  const [googleEventForReservation, setGoogleEventForReservation] = useState(null);
  const [globalAffaireDialog, setGlobalAffaireDialog] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPwaInstall, setShowPwaInstall] = useState(false);
  const openEventDetailsModalRef = useRef(null);

  // ═══ Messaging polling (hook) ═══
  const showMessagingRef = useRef(false);
  useEffect(() => { showMessagingRef.current = showMessaging; }, [showMessaging]);

  const { unreadMsgCount } = useMessagingPolling({
    currentUser, userPrefsRef, showMessagingRef, toast,
  });

  // ═══ Mobile detection ═══
  useEffect(() => {
    const handleHashChange = () => setIsMobile(detectMobile());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (isMobile && !window.location.hash.startsWith('#/mobile')) {
      window.location.hash = '#/mobile';
    }
  }, [isMobile]);

  // ═══ PWA install prompt ═══
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPwaInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handlePwaInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPwaInstall(false);
    }
    setDeferredPrompt(null);
  };

  // ═══ Raccourcis clavier ═══
  useKeyboardShortcuts({
    mod_vehicles: () => { setActiveModule('vehicles'); setShowManagement(false); setShowSettings(false); },
    mod_personnel: () => { setActiveModule('planning'); setShowManagement(false); setShowSettings(false); },
    mod_affaires: () => { setActiveModule('affaires'); setShowManagement(false); setShowSettings(false); },
    mod_equipment: () => { setActiveModule('equipment'); setShowManagement(false); setShowSettings(false); },
    mod_orders: () => { setActiveModule('orders'); setShowManagement(false); setShowSettings(false); },
    mod_catalog: () => { setActiveModule('catalog'); setShowManagement(false); setShowSettings(false); },  // Catalogue Fournisseurs
    open_messaging: () => setShowMessaging(v => !v),
    open_help: () => setShowHelp(v => !v),
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
      if (showHelp) { setShowHelp(false); return; }
      if (showPreferences) { setShowPreferences(false); return; }
      if (showMessaging) { setShowMessaging(false); return; }
      if (selectedVehicleForMaintenance) { setSelectedVehicleForMaintenance(null); setMaintenanceToEdit(null); setMaintenanceActionType(null); return; }
      if (vehicleForDialog) { setVehicleForDialog(null); return; }
      if (selectedVehicleForDetails) { setSelectedVehicleForDetails(null); return; }
      if (showManagement) { setShowManagement(false); return; }
      if (showSettings) { setShowSettings(false); return; }
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
  }, isAuthenticated && !isMobile);

  // ═══ Valeurs calculées ═══
  const highlightedReservationIds = useMemo(() => {
    if (!hoveredEventId) return [];
    return data.reservations
      .filter(r => r.googleEventId === hoveredEventId)
      .map(r => r.id);
  }, [hoveredEventId, data.reservations]);

  // ═══ Login : appliquer les préférences UI ═══
  const handleLogin = useCallback(async (email, password) => {
    const result = await login(email, password);
    const prefs = result.prefs || {};
    if (prefs.defaultModule === 'trucks') setActiveModule('vehicles');
    else if (prefs.defaultModule === 'communication' || prefs.defaultModule === 'personnel') setActiveModule('planning');
    else if (prefs.defaultModule === 'inventory') setActiveModule('stock');
    else if (prefs.defaultModule) setActiveModule(prefs.defaultModule);
    if (prefs.defaultView) setView(prefs.defaultView);
    return result;
  }, [login]);

  // ═══ Navigation croisée entre modules ═══
  const handleNavigateToEntity = useCallback((type, entityData) => {
    if (type === 'vehicle') {
      const v = data.vehicles.find(v => v.id === entityData.id);
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
      api.getAffaires().then(all => {
        const affairesArr = Array.isArray(all) ? all : (all?.affaires || []);
        const found = affairesArr.find(
          a => a.numeroAffaire === numero || a.numero_affaire === numero
        );
        if (found) setGlobalAffaireDialog(found);
      }).catch(() => {});
    }
  }, [data.vehicles]);

  // ═══ Actions maintenance ═══
  const handleRequestMaintenance = (vehicle) => {
    setMaintenanceActionType('request');
    setSelectedVehicleForMaintenance(vehicle);
  };

  const handleReportBreakdown = (vehicle) => {
    setMaintenanceActionType('breakdown');
    setSelectedVehicleForMaintenance(vehicle);
  };

  const handleScheduleMaintenance = (vehicle) => {
    setMaintenanceActionType('schedule');
    setSelectedVehicleForMaintenance(vehicle);
  };

  // ═══ Synchronisation scroll Calendar ↔ GoogleCalendarBanner ═══
  const handleBannerScroll = (scrollLeft) => {
    const calendarScrollArea = document.querySelector('.calendar-scroll-area');
    if (calendarScrollArea && Math.abs(calendarScrollArea.scrollLeft - scrollLeft) > 1) {
      calendarScrollArea.scrollLeft = scrollLeft;
    }
  };

  const handleCalendarScroll = (scrollLeft) => {
    const bannerScrollArea = document.querySelector('.banner-scroll-area');
    if (bannerScrollArea && Math.abs(bannerScrollArea.scrollLeft - scrollLeft) > 1) {
      bannerScrollArea.scrollLeft = scrollLeft;
    }
  };

  // ═══ Render ═══

  if (isMobile) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingOverlay label="Chargement..." />}>
          <MobileApp onSwitchToDesktop={() => {
            sessionStorage.setItem('forceDesktop', 'true');
            window.location.hash = '';
            setIsMobile(false);
          }} />
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
        <LoginForm onLogin={handleLogin} />
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

  return (
    <ErrorBoundary>
    <ToastProvider toast={toast}>
    <NavigationProvider value={handleNavigateToEntity}>
    <div className="app">
      <a href="#main-content" className="skip-link">Aller au contenu principal</a>
      <Header
        view={view}
        setView={setView}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        onOpenManagement={() => {
          if (activeModule === 'equipment') {
            setShowEquipmentManagement(true);
          } else if (activeModule === 'stock') {
            setShowStockManagement(true);
          } else {
            setShowManagement(true);
          }
        }}
        onOpenSettings={() => setShowSettings(true)}
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        maintenances={data.maintenances}
        vehicles={data.vehicles}
        reservations={data.reservations}
        onOpenVehicleMaintenance={setSelectedVehicleForMaintenance}
        onOpenMaintenance={(vehicle, maintenanceId) => {
          setSelectedVehicleForMaintenance(vehicle);
          setMaintenanceToEdit(maintenanceId);
        }}
        currentUser={currentUser}
        onLogout={logout}
        onUserUpdate={updateUser}
        onUpdateMaintenance={data.handleUpdateIntervention}
        onRefreshMaintenances={data.loadMaintenances}
        onReservationUpdate={async () => {
          try {
            const res = await api.getReservations();
            data.setReservations(res);
          } catch (e) { console.error('Erreur rechargement réservations:', e); }
        }}
        onToggleMessaging={() => setShowMessaging(v => !v)}
        onToggleMailing={() => setShowMailing(v => !v)}
        unreadMsgCount={unreadMsgCount}
        onOpenPreferences={() => setShowPreferences(true)}
        onOpenHelp={() => setShowHelp(true)}
        tabPrefs={tabPrefs}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Bannière installation PWA */}
      {showPwaInstall && (
        <div className="pwa-install-banner">
          <span>📱 Installer eM@g sur votre appareil pour un accès rapide</span>
          <button className="pwa-install-btn" onClick={handlePwaInstall}>Installer</button>
          <button className="pwa-dismiss-btn" onClick={() => setShowPwaInstall(false)}>✕</button>
        </div>
      )}
      
      {activeModule === 'vehicles' && (
      <GoogleCalendarBanner 
        calendarConfig={data.calendarConfig} 
        view={view}
        activeModule={activeModule}
        currentDate={currentDate}
        currentUser={currentUser}
        onScroll={handleBannerScroll}
        onEventClick={(event) => setGoogleEventForReservation(event)}
        onEventsChange={handleGoogleEventsChange}
        clients={data.clients}
        locations={data.locations}
        reservations={data.reservations}
        onEventHover={setHoveredEventId}
        onRequestEditReservation={setReservationToEdit}
        onRequestViewEvent={(fn) => { openEventDetailsModalRef.current = fn; }}
        onReservationsRefresh={async () => {
          try {
            const res = await api.getReservations();
            data.setReservations(res);
          } catch (e) { console.error('Erreur rechargement réservations:', e); }
        }}
        onNewReservation={() => {
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
        }}
        onNewAssignment={() => {
          setActiveModule('planning');
          setShowManagement(false);
          setShowSettings(false);
          setQuickAssignmentSlot({
            day: new Date().toISOString().slice(0, 10),
            period: 'AM',
          });
        }}
        onNewAffaire={async () => {
          try {
            const newAffaire = {
              numeroAffaire: `AF${Date.now().toString().slice(-5)}`,
              client: '',
              interlocuteur: '',
              tel: '',
              type: 'Prestation',
              dateDebut: format(new Date(), 'yyyy-MM-dd'),
              dateFin: '',
              adresseLivraison: '',
              description: '',
              devis: '',
              source: 'db',
            };
            await api.createOrUpdateAffaire(newAffaire);
            setActiveModule('affaires');
          } catch (err) {
            console.error('Erreur création affaire:', err);
          }
        }}
      />
      )}

      <main id="main-content">

      {activeModule === 'vehicles' && (
        <>
          {view === 'planning' ? (
            <PlanningView
              vehicles={data.vehicles}
              reservations={data.reservations}
              maintenances={data.maintenances}
              currentDate={currentDate}
              onOpenReservation={(reservation) => {
                const vehicle = data.vehicles.find(v => v.id === reservation.vehicleId);
                if (vehicle) {
                  // Open reservation (legacy handler preserved)
                }
              }}
              onOpenMaintenance={setSelectedVehicleForMaintenance}
              clients={data.clients}
              drivers={data.drivers}
              persons={data.persons}
            />
          ) : (
            <div className="calendar-with-vehicle-panel">
              <ErrorBoundary moduleName="Calendrier">
              <Suspense fallback={<LoadingOverlay label="Chargement du calendrier..." />}>
              <Calendar
                view={view}
                setView={setView}
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                vehicles={data.vehicles}
                reservations={data.reservations}
                maintenances={data.maintenances}
                onAddReservation={data.addReservation}
                onUpdateReservation={data.updateReservation}
                onUpdateMaintenance={data.updateMaintenanceFromResize}
                onScroll={handleCalendarScroll}
                onDeleteReservation={data.deleteReservation}
                clients={data.clients}
                drivers={data.drivers}
                persons={data.persons}
                locations={data.locations}
                users={data.users}
                googleEvent={googleEventForReservation}
                onCloseGoogleEvent={() => setGoogleEventForReservation(null)}
                googleEvents={googleEvents}
                highlightedReservationIds={highlightedReservationIds}
                reservationToEdit={reservationToEdit}
                onReservationEditComplete={() => setReservationToEdit(null)}
                onVehicleClick={setSelectedVehicleForDetails}
                onVehicleDoubleClick={(v) => { setSelectedVehicleForDetails(null); setVehicleForDialog(v); }}
                onMaintenanceClick={(vehicle, maintenanceId) => {
                  setSelectedVehicleForMaintenance(vehicle);
                  setMaintenanceToEdit(maintenanceId);
                }}
                onRequestViewEvent={(event) => openEventDetailsModalRef.current?.(event)}
                currentUser={currentUser}
                quickReservationSlot={quickReservationSlot}
                onQuickReservationHandled={() => setQuickReservationSlot(null)}
              />
              </Suspense>
              </ErrorBoundary>
              <VehicleSlidePanel
                vehicle={selectedVehicleForDetails}
                maintenances={data.maintenances}
                currentUser={currentUser}
                onClose={() => setSelectedVehicleForDetails(null)}
                onOpenDialog={(v) => { setSelectedVehicleForDetails(null); setVehicleForDialog(v); }}
                onAction={(action) => {
                  const v = selectedVehicleForDetails;
                  if (!v) return;
                  if (action === 'schedule') { handleScheduleMaintenance(v); setSelectedVehicleForDetails(null); }
                  else if (action === 'request') { handleRequestMaintenance(v); setSelectedVehicleForDetails(null); }
                  else if (action === 'km') { setSelectedVehicleForKilometrageControl(v); setSelectedVehicleForDetails(null); }
                  else if (action === 'breakdown') { handleReportBreakdown(v); setSelectedVehicleForDetails(null); }
                }}
              />
            </div>
          )}
        </>
      )}

      {activeModule === 'affaires' && (
        <ErrorBoundary moduleName="Affaires">
        <Suspense fallback={<LoadingOverlay label="Chargement du module affaires..." />}>
          <AffairesPanel
            reservations={data.reservations}
            onNavigateToEntity={handleNavigateToEntity}
          />
        </Suspense>
        </ErrorBoundary>
      )}

      {activeModule === 'equipment' && (
        <ErrorBoundary moduleName="Équipement">
        <Suspense fallback={<LoadingOverlay label="Chargement du parc matériel..." />}>
          <EquipmentPanel
            currentUser={currentUser}
            showManagement={showEquipmentManagement}
            onCloseManagement={() => setShowEquipmentManagement(false)}
          />
        </Suspense>
        </ErrorBoundary>
      )}

      {activeModule === 'orders' && (
        <ErrorBoundary moduleName="Commandes">
        <Suspense fallback={<LoadingOverlay label="Chargement des commandes..." />}>
          <OrdersPanel
            currentUser={currentUser}
          />
        </Suspense>
        </ErrorBoundary>
      )}

      {activeModule === 'stock' && (
        <ErrorBoundary moduleName="Stocks">
          <div className="stocks-container">
            <div className="sub-tabs">
              <button className={`sub-tab ${stockSubTab === 'vente' ? 'active' : ''}`} onClick={() => setStockSubTab('vente')}>
                📦 Stock Vente
              </button>
              <button className={`sub-tab ${stockSubTab === 'sav' ? 'active' : ''}`} onClick={() => setStockSubTab('sav')}>
                🔧 SAV (Pièces)
              </button>
              <button className={`sub-tab ${stockSubTab === 'inventory' ? 'active' : ''}`} onClick={() => setStockSubTab('inventory')}>
                📋 Inventaire
              </button>
            </div>
            {(stockSubTab === 'vente' || stockSubTab === 'sav') && (
              <Suspense fallback={<LoadingOverlay label="Chargement du stock..." />}>
                <StockPanel
                  currentUser={currentUser}
                  stockType={stockSubTab}
                  showManagement={showStockManagement}
                  onCloseManagement={() => setShowStockManagement(false)}
                />
              </Suspense>
            )}
            {stockSubTab === 'inventory' && (
              <Suspense fallback={<LoadingOverlay label="Chargement de l'inventaire..." />}>
                <InventoryPanel currentUser={currentUser} />
              </Suspense>
            )}
          </div>
        </ErrorBoundary>
      )}

      {activeModule === 'planning' && (
        <ErrorBoundary moduleName="Planning">
        <Suspense fallback={<LoadingOverlay label="Chargement du module Planning..." />}>
          <PlanningPanel
            currentUser={currentUser}
            googleEvents={allGoogleEvents}
            onNavigateToEntity={handleNavigateToEntity}
            personnelRefreshKey={personnelRefreshKey}
            view={view}
            setView={setView}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            navigateToPersonId={navigateToPersonId}
            onNavigateToPersonHandled={() => setNavigateToPersonId(null)}
            quickAssignmentSlot={quickAssignmentSlot}
            onQuickAssignmentHandled={() => setQuickAssignmentSlot(null)}
          />
        </Suspense>
        </ErrorBoundary>
      )}

      {activeModule === 'annuaire' && (
        <ErrorBoundary moduleName="Annuaire">
        <Suspense fallback={<LoadingOverlay label="Chargement de l'Annuaire..." />}>
          <AnnuairePanel currentUser={currentUser} />
        </Suspense>
        </ErrorBoundary>
      )}

      {activeModule === 'video' && (
        <ErrorBoundary moduleName="Vidéo">
        <Suspense fallback={<LoadingOverlay label="Chargement de la surveillance vidéo..." />}>
          <VideoPanel currentUser={currentUser} />
        </Suspense>
        </ErrorBoundary>
      )}



      {showManagement && (
        <Suspense fallback={<LoadingOverlay label="Chargement du panneau de gestion..." />}>
          <ManagementPanel
            vehicles={data.vehicles}
            setVehicles={data.setVehicles}
            reservations={data.reservations}
            setReservations={data.setReservations}
            clients={data.clients}
            setClients={data.setClients}
            drivers={data.drivers}
            setDrivers={data.setDrivers}
            locations={data.locations}
            setLocations={data.setLocations}
            calendarConfig={data.calendarConfig}
            setCalendarConfig={data.setCalendarConfig}
            garages={data.garages}
            setGarages={data.setGarages}
            maintenances={data.maintenances}
            setMaintenances={data.setMaintenances}
            currentUser={currentUser}
            activeModule={activeModule}
            panelType="management"
            onClose={() => {
              setShowManagement(false);
              if (activeModule === 'planning') {
                setPersonnelRefreshKey(k => k + 1);
              }
            }}
          />
        </Suspense>
      )}

      {showSettings && (
        <Suspense fallback={<LoadingOverlay label="Chargement des paramètres..." />}>
          <ManagementPanel
            vehicles={data.vehicles}
            setVehicles={data.setVehicles}
            reservations={data.reservations}
            setReservations={data.setReservations}
            clients={data.clients}
            setClients={data.setClients}
            drivers={data.drivers}
            setDrivers={data.setDrivers}
            locations={data.locations}
            setLocations={data.setLocations}
            calendarConfig={data.calendarConfig}
            setCalendarConfig={data.setCalendarConfig}
            garages={data.garages}
            setGarages={data.setGarages}
            maintenances={data.maintenances}
            setMaintenances={data.setMaintenances}
            currentUser={currentUser}
            panelType="settings"
            onClose={() => setShowSettings(false)}
            onNavigateToPersonnel={(person) => {
              setShowSettings(false);
              setActiveModule('planning');
            }}
          />
        </Suspense>
      )}

      {selectedVehicleForMaintenance && (
        <Suspense fallback={<LoadingOverlay label="Chargement..." />}>
          <MaintenanceDialog
            vehicle={selectedVehicleForMaintenance}
            maintenances={data.maintenances}
            garages={data.garages}
            reservations={data.reservations}
            maintenanceToEdit={maintenanceToEdit}
            actionType={maintenanceActionType}
            currentUser={currentUser}
            onSave={data.handleMaintenanceSave}
            onClose={() => {
              setSelectedVehicleForMaintenance(null);
              setMaintenanceToEdit(null);
              setMaintenanceActionType(null);
            }}
          />
        </Suspense>
      )}

      {vehicleForDialog && (
        <VehicleDetailsModal
          vehicle={vehicleForDialog}
          maintenances={data.maintenances}
          currentUser={currentUser}
          onClose={() => setVehicleForDialog(null)}
          onRequestMaintenance={handleRequestMaintenance}
          onReportBreakdown={handleReportBreakdown}
          onScheduleMaintenance={handleScheduleMaintenance}
          onUpdateIntervention={data.handleUpdateIntervention}
          onDeleteIntervention={data.handleDeleteIntervention}
          onOpenMaintenance={(vehicle) => {
            setSelectedVehicleForKilometrageControl(vehicle);
            setVehicleForDialog(null);
          }}
        />
      )}

      {selectedVehicleForKilometrageControl && (
        <Suspense fallback={<LoadingOverlay label="Chargement..." />}>
          <VehicleMaintenanceModal
            vehicle={selectedVehicleForKilometrageControl}
            onSave={async (updatedVehicle) => {
              try {
                const response = await api.updateVehicle(updatedVehicle.id, updatedVehicle);
                data.setVehicles(prevVehicles => 
                  prevVehicles.map(v => v.id === response.id ? response : v)
                );
                setSelectedVehicleForKilometrageControl(response);
              } catch (error) {
                console.error('Erreur lors de la mise à jour du véhicule:', error);
                toast.error('Erreur lors de la mise à jour du véhicule');
                throw error;
              }
            }}
            onClose={() => setSelectedVehicleForKilometrageControl(null)}
          />
        </Suspense>
      )}

      {/* Messagerie interne */}
      <Suspense fallback={null}>
        <MessagingPanel
          isOpen={showMessaging}
          onClose={() => setShowMessaging(false)}
          currentUser={currentUser}
        />
      </Suspense>

      {/* Mailing avancé */}
      <Suspense fallback={null}>
        <MailingPanel
          isOpen={showMailing}
          onClose={() => setShowMailing(false)}
        />
      </Suspense>

      {/* Préférences utilisateur */}
      <Suspense fallback={null}>
        <UserPreferencesModal
          isOpen={showPreferences}
          onClose={() => setShowPreferences(false)}
          palette={palette}
          onPaletteChange={setPalette}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onPreferencesChange={updatePreferences}
        />
      </Suspense>

      {/* Module d'aide */}
      <Suspense fallback={null}>
        <HelpModal
          isOpen={showHelp}
          onClose={() => setShowHelp(false)}
        />
      </Suspense>

      {/* Toast notification global */}
      <Suspense fallback={null}>
        <ToastContainer ref={toastRef} />
      </Suspense>

      {/* Modal global de détail d'affaire (ouvert depuis n'importe quel badge) */}
      {globalAffaireDialog && (
        <Suspense fallback={null}>
          <AffaireDetailDialog
            affaire={globalAffaireDialog}
            reservations={data.reservations}
            onClose={() => setGlobalAffaireDialog(null)}
            onDataChanged={(updatedAffaire) => { if (updatedAffaire) setGlobalAffaireDialog(updatedAffaire); }}
            onNavigateToEntity={handleNavigateToEntity}
          />
        </Suspense>
      )}
      </main>

      {/* Status bar VS Code */}
      {isVSCode && (
        <div className="vsc-statusbar">
          <span>{activeModule === 'vehicles' ? '📋' : activeModule === 'planning' ? '👥' : activeModule === 'affaires' ? '📁' : activeModule === 'equipment' ? '🔧' : activeModule === 'orders' ? '📦' : '📊'} {activeModule}</span>
          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>eM@g v2.0</span>
        </div>
      )}
    </div>
    </NavigationProvider>
    </ToastProvider>
    </ErrorBoundary>
  );
}



function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
