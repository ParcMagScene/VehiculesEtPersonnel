import { format } from 'date-fns';
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

import Header from './components/Header';
import { PlanningModalProvider } from './components/planning/PlanningModalContext';
const GoogleCalendarBanner = lazy(() => import('./components/vehicles/GoogleCalendarBanner'));
const VehicleSlidePanel = lazy(() =>
  import('./components/vehicles/VehicleDetailPanel').then((m) => ({
    default: m.VehicleSlidePanel,
  })),
);
import LoginForm from './components/auth/LoginForm';
import ErrorBoundary from './components/ErrorBoundary';
const PlanningView = lazy(() => import('./components/vehicles/PlanningView'));
import './App.css';
import './styles/draggable-modals.css';

import { Button } from '@/design-system';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { PersonalAuthProvider } from './contexts/PersonalAuthContext.jsx';
import { LoadingOverlay } from './design-system';
import { useAppData } from './hooks/useAppData';
import { useDraggableModals } from './hooks/useDraggableModals';
import { useFeedback } from './hooks/useFeedback';
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

const ToastContainer = lazy(() => import('./components/ToastContainer'));
const PresetDetachedView = lazy(() => import('./components/video/PresetDetachedView'));

// Code splitting - Lazy loading des composants lourds
const Calendar = lazy(() => import('./components/vehicles/Calendar'));
const VehicleDetailsModal = lazy(() => import('./components/vehicles/VehicleDetailsModal'));
const MobileApp = lazy(() => import('./components/mobile/MobileApp'));
const ManagementPanel = lazy(() => import('./components/management/ManagementPanel'));
const MaintenanceDialog = lazy(() => import('./components/vehicles/MaintenanceDialog'));
const VehicleMaintenanceModal = lazy(() => import('./components/vehicles/VehicleMaintenanceModal'));
const AffairesPanel = lazy(() => import('./components/affaires/AffairesPanel'));
const EquipmentPanel = lazy(() => import('./components/equipment/EquipmentPanel'));
const OrdersPanel = lazy(() =>
  import('./components/orders/OrdersPanel').then((m) => ({
    default: m.default || m.OrdersPanel,
  })),
);
const StockPanel = lazy(() => import('./components/orders/StockPanel'));
const InventoryPanel = lazy(() => import('./components/inventory/InventoryPanel'));
const PlanningPanel = lazy(() => import('./components/planning/PlanningPanel'));
const MessagingPanel = lazy(() => import('./components/messaging/MessagingPanel'));
const MailingPanel = lazy(() => import('./components/mailing/MailingPanel'));
const AnnuairePanel = lazy(() => import('./components/annuaire/AnnuairePanel'));
const LocationsTab = lazy(() => import('./components/annuaire/LocationsTab'));
const VideoPanel = lazy(() => import('./components/video/VideoPanel'));
const SonosPanel = lazy(() => import('./components/sonos/SonosPanel'));
const ControlsDashboard = lazy(() => import('./components/controles/ControlsDashboard'));
const AffaireDetailModal = lazy(() =>
  import('./components/affaires/AffaireDetailPanel').then((m) => ({
    default: m.AffaireDetailModal,
  })),
);
const UserPreferencesModal = lazy(() => import('./components/auth/UserPreferencesModal'));
const HelpModal = lazy(() => import('./components/HelpModal'));

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
      // Fermer les panneaux véhicules à chaque changement de module
      setVehicleForDialog(null);
      setSelectedVehicleForDetails(null);
      setSelectedVehicleForMaintenance(null);
      setSelectedVehicleForKilometrageControl(null);
      setMaintenanceToEdit(null);
      setMaintenanceActionType(null);
      startModuleTransition(() => _setActiveModule(mod));
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
    if (!params.get('module')) {
      const stored = localStorage.getItem('emag_last_module');
      if (stored && ALLOWED_MODULES.has(stored) && stored !== DEFAULT_MODULE) {
        _setActiveModule(stored);
      }
    }
  }, [isAuthenticated, _setActiveModule]);

  // [Sprint B] Miroir localStorage (utile si l'utilisateur ouvre un nouvel onglet
  // depuis un bookmark sans search param). N'est PLUS la source de vérité.
  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      localStorage.setItem('emag_last_module', activeModule);
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
      else if (prefs.defaultModule) setActiveModule(prefs.defaultModule);
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
      else if (prefs.defaultModule) setActiveModule(prefs.defaultModule);
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
  // [L3] Sync centralisee : RAF (1 ecriture max par frame) + sourceRef
  // (anti-boucle ping-pong) + ResizeObserver (re-aligne quand la sidebar
  // Planning resize, switch de vue, scrollbar verticale qui apparait,
  // etc.). Le banner et le Calendar remontent leur scrollLeft via leur
  // prop onScroll respective ; aucun listener DOM duplique cote banner.
  const scrollSyncSourceRef = useRef(null);
  const scrollSyncFrameRef = useRef(null);
  const scrollSyncLastLeftRef = useRef(0);

  const findScrollers = useCallback(
    () => ({
      grid:
        document.querySelector('.calendar-scroll-area') ||
        document.querySelector('.pp-scroll-area'),
      banner: document.querySelector('.banner-scroll-area'),
    }),
    [],
  );

  const flushScrollSync = useCallback(() => {
    scrollSyncFrameRef.current = null;
    if (document.hidden) return;
    const { grid, banner } = findScrollers();
    if (!grid || !banner) return;
    const left = scrollSyncLastLeftRef.current;
    const source = scrollSyncSourceRef.current;
    if (source === 'banner') {
      if (Math.abs(grid.scrollLeft - left) > 1) {
        grid.scrollLeft = left;
      }
    } else if (source === 'grid') {
      if (Math.abs(banner.scrollLeft - left) > 1) {
        banner.scrollLeft = left;
      }
    }
  }, [findScrollers]);

  const scheduleScrollSync = useCallback(
    (source, left) => {
      scrollSyncSourceRef.current = source;
      scrollSyncLastLeftRef.current = left;
      if (scrollSyncFrameRef.current != null) return;
      scrollSyncFrameRef.current = requestAnimationFrame(flushScrollSync);
    },
    [flushScrollSync],
  );

  const handleBannerScroll = useCallback(
    (scrollLeft) => {
      scheduleScrollSync('banner', scrollLeft);
    },
    [scheduleScrollSync],
  );

  const handleCalendarScroll = useCallback(
    (scrollLeft) => {
      scheduleScrollSync('grid', scrollLeft);
    },
    [scheduleScrollSync],
  );

  const showGoogleBanner = useMemo(
    () => ['planning', 'vehicles', 'parc', 'google'].includes(activeModule),
    [activeModule],
  );

  // ResizeObserver : re-aligne la banner sur la grille principale quand
  // l'une des deux change de taille (sidebar Planning resize, switch
  // de vue, apparition/disparition de la scrollbar verticale, etc.).
  // Sans ca, scroller la grille puis resizer la sidebar laissait la
  // banner desyncronisee jusqu'au prochain scroll.
  useEffect(() => {
    if (!showGoogleBanner) return undefined;
    let attachTimer = null;
    let frameId = null;
    let observer = null;
    let observed = [];

    const realign = () => {
      if (frameId != null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        if (document.hidden) return;
        const { grid, banner } = findScrollers();
        if (!grid || !banner) return;
        if (Math.abs(banner.scrollLeft - grid.scrollLeft) > 1) {
          banner.scrollLeft = grid.scrollLeft;
        }
      });
    };

    const tryAttach = () => {
      const { grid, banner } = findScrollers();
      if (!grid || !banner) {
        attachTimer = setTimeout(tryAttach, 120);
        return;
      }
      observer = new ResizeObserver(realign);
      observer.observe(grid);
      observer.observe(banner);
      observed = [grid, banner];
      // Alignement initial des l'attache.
      realign();
    };
    tryAttach();

    return () => {
      if (attachTimer) clearTimeout(attachTimer);
      if (frameId != null) cancelAnimationFrame(frameId);
      if (observer) {
        observed.forEach((el) => {
          try {
            observer.unobserve(el);
          } catch {
            /* element peut deja etre detache du DOM */
          }
        });
        observer.disconnect();
      }
    };
  }, [showGoogleBanner, view, activeModule, findScrollers]);

  // Cleanup global du frame en cours au demontage.
  useEffect(
    () => () => {
      if (scrollSyncFrameRef.current != null) {
        cancelAnimationFrame(scrollSyncFrameRef.current);
        scrollSyncFrameRef.current = null;
      }
    },
    [],
  );

  const handleBannerEventClick = useCallback((event) => {
    setGoogleEventForReservation(event);
  }, []);

  const handleBannerRequestViewEvent = useCallback((fn) => {
    openEventDetailsModalRef.current = fn;
  }, []);

  const handleBannerReservationsRefresh = useCallback(async () => {
    try {
      const res = await api.getReservations();
      data.setReservations(res);
    } catch (e) {
      console.error('Erreur rechargement réservations:', e);
    }
  }, [data]);

  const handleBannerNewReservation = useCallback(() => {
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
  }, [setActiveModule]);

  const handleBannerNewAssignment = useCallback(
    (event) => {
      setActiveModule('planning');
      setShowManagement(false);
      setShowSettings(false);
      setQuickAssignmentSlot({
        day: event?.start
          ? new Date(event.start).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        period: 'AM',
        title: event?.summary || '',
        affaire: event?.affaire || '',
      });
    },
    [setActiveModule],
  );

  const handleBannerNewAffaire = useCallback(async () => {
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
      toast.error("Erreur lors de la création de l'affaire");
    }
  }, [setActiveModule, toast]);

  const handleBannerNavigateToAffaire = useCallback(
    (affaireNum) => {
      setActiveModule('affaires');
      setShowManagement(false);
      setShowSettings(false);
      // Le numéro d'affaire sera traité par AffairesPanel comme filtre/sélection
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('emag:navigate-affaire', { detail: { affaireNum } }));
      }, 100);
    },
    [setActiveModule],
  );

  const googleBannerProps = useMemo(
    () => ({
      calendarConfig: data.calendarConfig,
      view,
      activeModule,
      currentDate,
      currentUser,
      onScroll: handleBannerScroll,
      onEventClick: handleBannerEventClick,
      onEventsChange: handleGoogleEventsChange,
      clients: data.clients,
      locations: data.locations,
      reservations: data.reservations,
      onEventHover: setHoveredEventId,
      onRequestEditReservation: setReservationToEdit,
      onRequestViewEvent: handleBannerRequestViewEvent,
      onReservationsRefresh: handleBannerReservationsRefresh,
      onNewReservation: handleBannerNewReservation,
      onNewAssignment: handleBannerNewAssignment,
      onNewAffaire: handleBannerNewAffaire,
      onNavigateToAffaire: handleBannerNavigateToAffaire,
    }),
    [
      data.calendarConfig,
      view,
      activeModule,
      currentDate,
      currentUser,
      handleBannerScroll,
      handleBannerEventClick,
      handleGoogleEventsChange,
      data.clients,
      data.locations,
      data.reservations,
      handleBannerRequestViewEvent,
      handleBannerReservationsRefresh,
      handleBannerNewReservation,
      handleBannerNewAssignment,
      handleBannerNewAffaire,
      handleBannerNavigateToAffaire,
    ],
  );

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

  return (
    <ErrorBoundary>
      <ToastProvider toast={toast}>
        <NavigationProvider value={handleNavigateToEntity}>
          <div className="app">
            <a href="#main-content" className="skip-link">
              Aller au contenu principal
            </a>
            {apiNetworkStatus.unavailable && (
              <div className="api-offline-banner" role="status" aria-live="polite">
                <strong>Service local indisponible.</strong>
                <span>
                  Les requêtes automatiques sont ralenties temporairement pour éviter les erreurs en
                  cascade.
                </span>
              </div>
            )}
            <Header
              view={view}
              setView={setView}
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
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
                } catch (e) {
                  console.error('Erreur rechargement réservations:', e);
                }
              }}
              onToggleMessaging={() => setShowMessaging((v) => !v)}
              onToggleMailing={() => setShowMailing((v) => !v)}
              onDetachSonos={handleDetachSonos}
              unreadMsgCount={unreadMsgCount}
              onOpenPreferences={() => setShowPreferences(true)}
              onOpenHelp={() => setShowHelp(true)}
              tabPrefs={tabPrefs}
              theme={theme}
              onToggleTheme={toggleTheme}
            />

            {showGoogleBanner && (
              <Suspense fallback={null}>
                <GoogleCalendarBanner {...googleBannerProps} />
              </Suspense>
            )}

            <main id="main-content">
              {activeModule === 'vehicles' && (
                <>
                  {view === 'planning' ? (
                    <Suspense fallback={<LoadingOverlay label="Chargement du planning..." />}>
                      <PlanningView
                        vehicles={data.vehicles}
                        reservations={data.reservations}
                        maintenances={data.maintenances}
                        currentDate={currentDate}
                        onOpenReservation={(reservation) => {
                          const vehicle = data.vehicles.find((v) => v.id === reservation.vehicleId);
                          if (vehicle) {
                            // Open reservation (legacy handler preserved)
                          }
                        }}
                        onOpenMaintenance={setSelectedVehicleForMaintenance}
                        clients={data.clients}
                        drivers={[]}
                        persons={data.persons}
                      />
                    </Suspense>
                  ) : (
                    <div className="calendar-with-vehicle-panel">
                      <ErrorBoundary moduleName="Calendrier">
                        <Suspense fallback={<LoadingOverlay label="Chargement du calendrier..." />}>
                          <Calendar
                            view={view}
                            setView={setView}
                            currentDate={currentDate}
                            setCurrentDate={setCurrentDate}
                            onOpenManagement={() => setShowManagement(true)}
                            vehicles={data.vehicles}
                            reservations={data.reservations}
                            maintenances={data.maintenances}
                            onAddReservation={data.addReservation}
                            onUpdateReservation={data.updateReservation}
                            onUpdateMaintenance={data.updateMaintenanceFromResize}
                            onScroll={handleCalendarScroll}
                            onDeleteReservation={data.deleteReservation}
                            clients={data.clients}
                            drivers={[]}
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
                            onVehicleDoubleClick={(v) => {
                              setSelectedVehicleForDetails(null);
                              setVehicleForDialog(v);
                            }}
                            onMaintenanceClick={(vehicle, maintenanceId) => {
                              setSelectedVehicleForMaintenance(vehicle);
                              setMaintenanceToEdit(maintenanceId);
                            }}
                            onRequestViewEvent={(event) =>
                              openEventDetailsModalRef.current?.(event)
                            }
                            currentUser={currentUser}
                            quickReservationSlot={quickReservationSlot}
                            onQuickReservationHandled={() => setQuickReservationSlot(null)}
                          />
                        </Suspense>
                      </ErrorBoundary>
                      <Suspense fallback={null}>
                        <VehicleSlidePanel
                          vehicle={selectedVehicleForDetails}
                          maintenances={data.maintenances}
                          currentUser={currentUser}
                          onClose={() => setSelectedVehicleForDetails(null)}
                          onOpenDialog={(v) => {
                            setSelectedVehicleForDetails(null);
                            setVehicleForDialog(v);
                          }}
                          onAction={(action) => {
                            const v = selectedVehicleForDetails;
                            if (!v) return;
                            if (action === 'schedule') {
                              handleScheduleMaintenance(v);
                              setSelectedVehicleForDetails(null);
                            } else if (action === 'request') {
                              handleRequestMaintenance(v);
                              setSelectedVehicleForDetails(null);
                            } else if (action === 'km') {
                              setSelectedVehicleForKilometrageControl(v);
                              setSelectedVehicleForDetails(null);
                            } else if (action === 'breakdown') {
                              handleReportBreakdown(v);
                              setSelectedVehicleForDetails(null);
                            }
                          }}
                        />
                      </Suspense>
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
                      currentUser={currentUser}
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
                      onOpenManagement={() => setShowEquipmentManagement(true)}
                      onCloseManagement={() => setShowEquipmentManagement(false)}
                    />
                  </Suspense>
                </ErrorBoundary>
              )}

              {activeModule === 'orders' && (
                <ErrorBoundary moduleName="Commandes">
                  <Suspense fallback={<LoadingOverlay label="Chargement des commandes..." />}>
                    <OrdersPanel currentUser={currentUser} />
                  </Suspense>
                </ErrorBoundary>
              )}

              {activeModule === 'stock' && (
                <ErrorBoundary moduleName="Stocks">
                  <div className="stocks-container">
                    <div className="sub-tabs">
                      <Button
                        variant="ghost"
                        className={`sub-tab ${stockSubTab === 'vente' ? 'active' : ''}`}
                        onClick={() => setStockSubTab('vente')}
                      >
                        📦 Stock Vente
                      </Button>
                      <Button
                        variant="ghost"
                        className={`sub-tab ${stockSubTab === 'sav' ? 'active' : ''}`}
                        onClick={() => setStockSubTab('sav')}
                      >
                        🔧 SAV (Pièces)
                      </Button>
                      <Button
                        variant="ghost"
                        className={`sub-tab ${stockSubTab === 'inventory' ? 'active' : ''}`}
                        onClick={() => setStockSubTab('inventory')}
                      >
                        📋 Inventaire
                      </Button>
                    </div>
                    {(stockSubTab === 'vente' || stockSubTab === 'sav') && (
                      <Suspense fallback={<LoadingOverlay label="Chargement du stock..." />}>
                        <StockPanel
                          currentUser={currentUser}
                          stockType={stockSubTab}
                          showManagement={showStockManagement}
                          onOpenManagement={() => setShowStockManagement(true)}
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
                  <PlanningModalProvider>
                    <Suspense
                      fallback={<LoadingOverlay label="Chargement du module Planning..." />}
                    >
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
                  </PlanningModalProvider>
                </ErrorBoundary>
              )}

              {activeModule === 'annuaire' && (
                <ErrorBoundary moduleName="Annuaire">
                  <Suspense fallback={<LoadingOverlay label="Chargement de l'Annuaire..." />}>
                    <AnnuairePanel currentUser={currentUser} />
                  </Suspense>
                </ErrorBoundary>
              )}

              {activeModule === 'lieux' && (
                <ErrorBoundary moduleName="Lieux">
                  <Suspense fallback={<LoadingOverlay label="Chargement des Lieux..." />}>
                    <LocationsTab currentUser={currentUser} />
                  </Suspense>
                </ErrorBoundary>
              )}

              {activeModule === 'video' && (
                <ErrorBoundary moduleName="Vidéo">
                  <Suspense
                    fallback={<LoadingOverlay label="Chargement de la surveillance vidéo..." />}
                  >
                    <VideoPanel currentUser={currentUser} />
                  </Suspense>
                </ErrorBoundary>
              )}

              {activeModule === 'sonos' && (
                <ErrorBoundary moduleName="Sonos">
                  <Suspense fallback={<LoadingOverlay label="Chargement du module Sonos..." />}>
                    <SonosPanel currentUser={currentUser} />
                  </Suspense>
                </ErrorBoundary>
              )}

              {activeModule === 'controles' && (
                <ErrorBoundary moduleName="Contrôles">
                  <Suspense
                    fallback={<LoadingOverlay label="Chargement des contrôles périodiques..." />}
                  >
                    <ControlsDashboard user={currentUser} />
                  </Suspense>
                </ErrorBoundary>
              )}

              {showManagement && (
                <ErrorBoundary moduleName="Gestion">
                  <Suspense
                    fallback={<LoadingOverlay label="Chargement du panneau de gestion..." />}
                  >
                    <ManagementPanel
                      vehicles={data.vehicles}
                      setVehicles={data.setVehicles}
                      reservations={data.reservations}
                      setReservations={data.setReservations}
                      clients={data.clients}
                      setClients={data.setClients}
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
                          setPersonnelRefreshKey((k) => k + 1);
                        }
                      }}
                    />
                  </Suspense>
                </ErrorBoundary>
              )}

              {showSettings && (
                <ErrorBoundary moduleName="Paramètres">
                  <Suspense fallback={<LoadingOverlay label="Chargement des paramètres..." />}>
                    <ManagementPanel
                      vehicles={data.vehicles}
                      setVehicles={data.setVehicles}
                      reservations={data.reservations}
                      setReservations={data.setReservations}
                      clients={data.clients}
                      setClients={data.setClients}
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
                      onNavigateToPersonnel={(_person) => {
                        setShowSettings(false);
                        setActiveModule('planning');
                      }}
                    />
                  </Suspense>
                </ErrorBoundary>
              )}

              {selectedVehicleForMaintenance && (
                <ErrorBoundary moduleName="Maintenance">
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
                </ErrorBoundary>
              )}

              {vehicleForDialog && (
                <Suspense fallback={<LoadingOverlay label="Chargement..." />}>
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
                </Suspense>
              )}

              {selectedVehicleForKilometrageControl && (
                <ErrorBoundary moduleName="Kilométrage">
                  <Suspense fallback={<LoadingOverlay label="Chargement..." />}>
                    <VehicleMaintenanceModal
                      vehicle={selectedVehicleForKilometrageControl}
                      onSave={async (updatedVehicle) => {
                        try {
                          const response = await api.updateVehicle(
                            updatedVehicle.id,
                            updatedVehicle,
                          );
                          data.setVehicles((prevVehicles) =>
                            prevVehicles.map((v) => (v.id === response.id ? response : v)),
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
                </ErrorBoundary>
              )}

              {/* Messagerie interne */}
              <ErrorBoundary moduleName="Messagerie">
                <Suspense fallback={null}>
                  <MessagingPanel
                    isOpen={showMessaging}
                    onClose={() => setShowMessaging(false)}
                    currentUser={currentUser}
                  />
                </Suspense>
              </ErrorBoundary>

              {/* Mailing avancé */}
              <ErrorBoundary moduleName="Mailing">
                <Suspense fallback={null}>
                  <MailingPanel isOpen={showMailing} onClose={() => setShowMailing(false)} />
                </Suspense>
              </ErrorBoundary>

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
                <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
              </Suspense>

              {/* Toast notification global */}
              <Suspense fallback={null}>
                <ToastContainer ref={toastRef} />
              </Suspense>

              {/* Modal global de détail d'affaire (ouvert depuis n'importe quel badge) */}
              {globalAffaireDialog && (
                <ErrorBoundary moduleName="Détail Affaire">
                  <Suspense fallback={null}>
                    <AffaireDetailModal
                      affaire={globalAffaireDialog}
                      reservations={data.reservations}
                      onClose={() => setGlobalAffaireDialog(null)}
                      onDataChanged={(updatedAffaire) => {
                        if (updatedAffaire) setGlobalAffaireDialog(updatedAffaire);
                      }}
                      onNavigateToEntity={handleNavigateToEntity}
                    />
                  </Suspense>
                </ErrorBoundary>
              )}
            </main>

            {/* Status bar VS Code */}
            {isVSCode && (
              <div className="vsc-statusbar">
                <span>
                  {activeModule === 'vehicles'
                    ? '📋'
                    : activeModule === 'planning'
                      ? '👥'
                      : activeModule === 'affaires'
                        ? '📁'
                        : activeModule === 'equipment'
                          ? '🔧'
                          : activeModule === 'orders'
                            ? '📦'
                            : '📊'}{' '}
                  {activeModule}
                </span>
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
