import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Header from './components/Header';
import GoogleCalendarBanner from './components/GoogleCalendarBanner';
import { VehicleSlidePanel } from './components/VehicleDetailPanel';
import LoginForm from './components/LoginForm';
import PlanningView from './components/PlanningView';
import ErrorBoundary from './components/ErrorBoundary';
import api from './utils/api';
import { saveToIndexedDB, STORES } from './utils/indexedDB';
import { getPeriodTimestamp } from './utils/dateUtils';
import logger from './utils/logger';
import { playNotificationSound, requestNotificationPermission, showBrowserNotification, setVolume } from './utils/notificationSound';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useFeedback } from './hooks/useFeedback';
import './App.css';

const ToastContainer = lazy(() => import('./components/ToastContainer'));

// Code splitting - Lazy loading des composants lourds
const Calendar = lazy(() => import('./components/Calendar'));
const VehicleDetailsModal = lazy(() => import('./components/VehicleDetailsModal'));
const MobileApp = lazy(() => import('./components/mobile/MobileApp'));
const ManagementPanel = lazy(() => import('./components/ManagementPanel'));
const MaintenanceDialog = lazy(() => import('./components/MaintenanceDialog'));
const VehicleMaintenanceModal = lazy(() => import('./components/VehicleMaintenanceModal'));
const PersonnelPanel = lazy(() => import('./components/PersonnelPanel'));
const AffairesPanel = lazy(() => import('./components/AffairesPanel'));
const EquipmentPanel = lazy(() => import('./components/EquipmentPanel'));
const OrdersPanel = lazy(() => import('./components/OrdersPanel'));
const CataloguePanel = lazy(() => import('./components/CataloguePanel'));
const TruckModelPanel = lazy(() => import('./components/TruckModelPanel'));
const MessagingPanel = lazy(() => import('./components/MessagingPanel'));
const UserPreferencesModal = lazy(() => import('./components/UserPreferencesModal'));
const HelpModal = lazy(() => import('./components/HelpModal'));

// Fonction utilitaire pour formater une date en YYYY-MM-DD
const formatDateToString = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Détection fiable d'un appareil mobile
const detectMobile = () => {
  // 1. Vérifier le hash ou le pathname
  if (window.location.pathname === '/mobile' || window.location.hash.startsWith('#/mobile')) {
    return true;
  }
  // 2. Vérifier si l'utilisateur a explicitement choisi desktop (stocké en sessionStorage)
  if (sessionStorage.getItem('forceDesktop') === 'true') {
    return false;
  }
  // 3. Auto-détection : user-agent + écran tactile + largeur d'écran
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  return isMobileUA && (isTouchDevice || isSmallScreen);
};

function App() {
  // Détection mobile réactive (hash, user-agent, taille écran)
  const [isMobile, setIsMobile] = useState(() => detectMobile());

  useEffect(() => {
    const handleHashChange = () => setIsMobile(detectMobile());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Si mobile détecté et hash pas encore mis, rediriger
  useEffect(() => {
    if (isMobile && !window.location.hash.startsWith('#/mobile')) {
      window.location.hash = '#/mobile';
    }
  }, [isMobile]);
  
  const [view, setView] = useState('week'); // 'week', 'month', 'year'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [vehicles, setVehicles] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [clients, setClients] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [persons, setPersons] = useState([]);
  const [calendarConfig, setCalendarConfig] = useState({ apiKey: '', calendarId: '' });
  const [showManagement, setShowManagement] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeModule, setActiveModule] = useState('vehicles');
  const [showEquipmentManagement, setShowEquipmentManagement] = useState(false);
  const [personnelRefreshKey, setPersonnelRefreshKey] = useState(0);
  const [navigateToPersonId, setNavigateToPersonId] = useState(null);
  const [quickReservationSlot, setQuickReservationSlot] = useState(null);
  const [quickAssignmentSlot, setQuickAssignmentSlot] = useState(null);
  const [showMessaging, setShowMessaging] = useState(false);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [googleEventForReservation, setGoogleEventForReservation] = useState(null);
  const [googleEvents, setGoogleEvents] = useState([]);
  const allGoogleEventsRef = useRef(new Map());

  // Accumuler les events Google Calendar (dédupliqués par ID) pour avoir un pool complet
  const handleGoogleEventsChange = useCallback((newEvents) => {
    setGoogleEvents(newEvents);
    if (newEvents && newEvents.length > 0) {
      newEvents.forEach(ev => {
        if (ev.id) allGoogleEventsRef.current.set(ev.id, ev);
      });
    }
  }, []);

  const allGoogleEvents = useMemo(() => {
    // Recalculer quand googleEvents change (trigger)
    return Array.from(allGoogleEventsRef.current.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleEvents]);
  const [hoveredEventId, setHoveredEventId] = useState(null);
  const [reservationToEdit, setReservationToEdit] = useState(null);
  const [garages, setGarages] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [selectedVehicleForMaintenance, setSelectedVehicleForMaintenance] = useState(null);
  const [maintenanceToEdit, setMaintenanceToEdit] = useState(null);
  const [selectedVehicleForDetails, setSelectedVehicleForDetails] = useState(null);
  const [vehicleForDialog, setVehicleForDialog] = useState(null);
  const [selectedVehicleForKilometrageControl, setSelectedVehicleForKilometrageControl] = useState(null);
  const [maintenanceActionType, setMaintenanceActionType] = useState(null); // 'schedule', 'request', 'breakdown'
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const openEventDetailsModalRef = useRef(null); // Référence à la fonction pour ouvrir EventDetailsModal
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPwaInstall, setShowPwaInstall] = useState(false);
  const prevUnreadRef = useRef(0); // Compteur précédent pour détecter les nouveaux messages
  const userPrefsRef = useRef({ notificationsEnabled: true, soundEnabled: true }); // Préférences notification
  const [tabPrefs, setTabPrefs] = useState({ tabOrder: null, hiddenTabs: [] }); // Préférences onglets
  const showMessagingRef = useRef(false); // Ref pour éviter de re-créer le polling
  const { toastRef, toast } = useFeedback();

  // Raccourcis clavier globaux avec détection OS
  useKeyboardShortcuts({
    mod_vehicles: () => { setActiveModule('vehicles'); setShowManagement(false); setShowSettings(false); },
    mod_personnel: () => { setActiveModule('personnel'); setShowManagement(false); setShowSettings(false); },
    mod_affaires: () => { setActiveModule('affaires'); setShowManagement(false); setShowSettings(false); },
    mod_equipment: () => { setActiveModule('equipment'); setShowManagement(false); setShowSettings(false); },
    mod_orders: () => { setActiveModule('orders'); setShowManagement(false); setShowSettings(false); },
    mod_catalog: () => { setActiveModule('catalog'); setShowManagement(false); setShowSettings(false); },
    mod_trucks: () => { setActiveModule('trucks'); setShowManagement(false); setShowSettings(false); },
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
      // Fermer dans l'ordre de priorité (le plus récent d'abord)
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
      if (view === 'week') d.setDate(d.getDate() - 7);
      else if (view === 'month') d.setMonth(d.getMonth() - 1);
      else d.setFullYear(d.getFullYear() - 1);
      setCurrentDate(d);
    },
    nav_next: () => {
      if (activeModule !== 'vehicles') return;
      const d = new Date(currentDate);
      if (view === 'week') d.setDate(d.getDate() + 7);
      else if (view === 'month') d.setMonth(d.getMonth() + 1);
      else d.setFullYear(d.getFullYear() + 1);
      setCurrentDate(d);
    },
    nav_today: () => {
      if (activeModule === 'vehicles') setCurrentDate(new Date());
    },
  }, isAuthenticated && !isMobile);

  // Calculer les réservations à surligner en fonction de l'événement survolé
  const highlightedReservationIds = useMemo(() => {
    if (!hoveredEventId) return [];
    return reservations
      .filter(r => r.googleEventId === hoveredEventId)
      .map(r => r.id);
  }, [hoveredEventId, reservations]);

  // Vérifier l'authentification au démarrage
  useEffect(() => {
    const checkAuth = async () => {
      if (api.isAuthenticated()) {
        const user = api.getCurrentUser();
        setIsAuthenticated(true);
        setCurrentUser(user);
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  // Enregistrement Service Worker + PWA install prompt
  useEffect(() => {
    // Service Worker désactivé temporairement (purge en cours via index.html)
    // Capturer l'événement beforeinstallprompt
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

  // Charger les données depuis l'API après authentification
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    const loadDataFromAPI = async () => {
      try {
        setIsLoading(true);
        
        // Charger toutes les données en parallèle
        const [
          vehiclesData,
          reservationsData,
          clientsData,
          driversData,
          locationsData,
          garagesData,
          maintenancesData,
          configData,
          usersData,
          personsData
        ] = await Promise.all([
          api.getVehicles(),
          api.getReservations(),
          api.getClients(),
          api.getDrivers(),
          api.getLocations(),
          api.getGarages(),
          api.getMaintenances(),
          api.getConfig('googleCalendar'),
          api.getUsersNames(),
          api.getPersons()
        ]);

        // Trier les véhicules par ordre
        const sortedVehicles = vehiclesData.sort((a, b) => (a.order || 0) - (b.order || 0));

        setVehicles(sortedVehicles);
        setReservations(reservationsData);
        setClients(clientsData);
        setDrivers(driversData);
        setLocations(locationsData);
        setGarages(garagesData);
        setMaintenances(maintenancesData);
        setUsers(usersData);
        setPersons(personsData || []);
        
        // Parser la configuration du calendrier
        if (configData && configData.value) {
          try {
            const parsedConfig = JSON.parse(configData.value);
            setCalendarConfig(parsedConfig);
          } catch (e) {
            setCalendarConfig({ apiKey: '', calendarId: '' });
          }
        }
      } catch (error) {
        console.error('❌ Erreur lors du chargement des données:', error);
        // Si erreur d'authentification, déconnecter
        if (error.message.includes('authentification') || error.message.includes('401')) {
          handleLogout();
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadDataFromAPI();
  }, [isAuthenticated]);

  // Fonction pour recharger uniquement les maintenances
  const loadMaintenances = async () => {
    try {
      const maintenancesData = await api.getMaintenances();
      setMaintenances(maintenancesData);
    } catch (error) {
      console.error('Erreur lors du rechargement des maintenances:', error);
    }
  };

  // Sauvegarder automatiquement (débounce 500ms pour éviter les écritures excessives)
  useEffect(() => {
    if (isLoading) return;
    
    const timer = setTimeout(() => {
      saveToIndexedDB(STORES.vehicles, vehicles);
      saveToIndexedDB(STORES.reservations, reservations);
      saveToIndexedDB(STORES.clients, clients);
      saveToIndexedDB(STORES.drivers, drivers);
      saveToIndexedDB(STORES.locations, locations);
      if (calendarConfig && (calendarConfig.apiKey || calendarConfig.calendarId)) {
        saveToIndexedDB(STORES.calendarConfig, calendarConfig);
      }
      saveToIndexedDB(STORES.garages, garages);
      saveToIndexedDB(STORES.maintenances, maintenances);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [vehicles, reservations, clients, drivers, locations, calendarConfig, garages, maintenances, isLoading]);

  // NOTE: Cette sauvegarde IndexedDB est conservée temporairement pour la compatibilité
  // pendant la migration. Elle sera supprimée une fois la migration terminée.

  // Mettre à jour automatiquement les statuts des interventions selon les dates
  useEffect(() => {
    const updateMaintenanceStatuses = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      setMaintenances(prev => {
        let hasChanges = false;
        const updatedMaintenances = prev.map(maintenance => {
          // Ne pas modifier les interventions signalées ou complétées
          if (maintenance.status === 'reported' || maintenance.status === 'completed' || !maintenance.startDate) {
            return maintenance;
          }

          const startDate = new Date(maintenance.startDate);
          startDate.setHours(0, 0, 0, 0);
          
          const endDate = new Date(maintenance.endDate || maintenance.startDate);
          endDate.setHours(0, 0, 0, 0);

          let newStatus = maintenance.status;

          // Logique de mise à jour du statut
          if (today < startDate) {
            newStatus = 'scheduled';
          } else if (today >= startDate && today <= endDate) {
            newStatus = 'in_progress';
          } else if (today > endDate) {
            newStatus = 'completed';
          }

          if (newStatus !== maintenance.status) {
            hasChanges = true;
            return { ...maintenance, status: newStatus };
          }

          return maintenance;
        });

        return hasChanges ? updatedMaintenances : prev;
      });
    };

    // Vérifier au chargement et toutes les heures
    if (!isLoading) {
      updateMaintenanceStatuses();
      const interval = setInterval(updateMaintenanceStatuses, 3600000); // 1 heure
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  const checkOverlap = (vehicleId, startDate, startPeriod, endDate, endPeriod, excludeId = null) => {
    // Calculer les timestamps de début et fin de la nouvelle réservation
    const newStart = getPeriodTimestamp(startDate, startPeriod);
    const newEnd = getPeriodTimestamp(endDate, endPeriod);
    
    // Vérifier les chevauchements avec les réservations existantes
    const conflicts = [];
    
    for (const r of reservations) {
      // Exclure la réservation en cours de modification
      if (excludeId !== null && String(r.id) === String(excludeId)) continue;
      
      // Vérifier uniquement les réservations du même véhicule (avec conversion de type)
      if (String(r.vehicleId) !== String(vehicleId)) continue;
      
      // Calculer les timestamps de la réservation existante
      const existingStart = getPeriodTimestamp(r.date, r.period);
      const existingEnd = getPeriodTimestamp(
        r.endDate || r.date,
        r.endPeriod || r.period
      );
      
      // Vérifier si les intervalles se chevauchent
      // Deux intervalles [a,b] et [c,d] se chevauchent si max(a,c) <= min(b,d)
      if (Math.max(newStart, existingStart) <= Math.min(newEnd, existingEnd)) {
        conflicts.push({
          date: r.date,
          period: r.period,
          reservation: r
        });
      }
    }
    
    return conflicts;
  };

  const addReservation = async (reservationData) => {
    // Gérer la création multiple (tableau) ou simple (objet)
    const reservationsToAdd = Array.isArray(reservationData) ? reservationData : [reservationData];
    
    const newReservations = [];
    
    for (const data of reservationsToAdd) {
      const { vehicleId, date, period, endDate, endPeriod, ...otherData } = data;

      // Vérifier les chevauchements
      const conflicts = checkOverlap(vehicleId, date, period, endDate, endPeriod);
      if (conflicts.length > 0) {
        const vehicle = vehicles.find(v => v.id === vehicleId);
        const conflictInfo = conflicts[0];
        alert(`⚠️ Chevauchement détecté !\n\nLe véhicule "${vehicle?.name}" est déjà réservé pour :\n- ${conflictInfo.reservation.clientName || conflictInfo.reservation.prestationName}\n- Le ${format(new Date(conflictInfo.date), 'd MMMM yyyy', { locale: fr })} (${conflictInfo.period})\n\nVeuillez modifier les dates ou choisir un autre véhicule.`);
        return false;
      }
      
      // Si l'utilisateur n'est pas admin, créer une demande au lieu d'une réservation
      if (!currentUser?.isAdmin) {
        try {
          await api.createReservationRequest({
            id: `${Date.now()}.${Math.random()}`,
            vehicleId,
            startDate: date,
            startPeriod: period,
            endDate,
            endPeriod,
            ...otherData
          });
          
          alert(`✅ Demande de réservation envoyée !\n\nVotre demande a été transmise aux administrateurs pour validation.\nVous serez notifié une fois qu'elle sera traitée.`);
          return true;
        } catch (error) {
          console.error('❌ Erreur création demande:', error);
          alert(`Erreur lors de la création de la demande: ${error.message}`);
          return false;
        }
      }
      
      // Créer la réservation via l'API (admin uniquement)
      try {
        const createdReservation = await api.createReservation({
          id: `${Date.now()}.${Math.random()}`,
          vehicleId,
          startDate: date,
          startPeriod: period,
          endDate,
          endPeriod,
          ...otherData
        });
        newReservations.push(createdReservation);
      } catch (error) {
        console.error('❌ Erreur création réservation:', error);
        alert(`Erreur lors de la création de la réservation: ${error.message}`);
        return false;
      }
    }
    
    setReservations([...reservations, ...newReservations]);
    return true;
  };

  const updateReservation = async (id, updatedReservation) => {
    logger.log('📝 updateReservation appelé - ID:', id, 'Objet:', updatedReservation);
    
    // Seuls les admins peuvent modifier des réservations
    if (!currentUser?.isAdmin) {
      alert('⛔ Seuls les administrateurs peuvent modifier des réservations.');
      return false;
    }
    
    // Vérifier que l'objet a un ID valide
    if (!id || (!updatedReservation.id && id)) {
      logger.warn('⚠️ Objet sans ID détecté, ajout de l\'ID:', id);
      updatedReservation = { ...updatedReservation, id };
    }
    
    // Trouver la réservation à modifier
    const oldReservation = reservations.find(r => r.id === id);
    if (!oldReservation) {
      console.error('❌ Réservation introuvable:', id);
      return false;
    }

    // Vérifier les chevauchements (en excluant la réservation en cours de modification)
    const { vehicleId, date, period, endDate, endPeriod } = updatedReservation;
    
    if (!vehicleId) {
      console.error('❌ vehicleId manquant dans updatedReservation:', updatedReservation);
      return false;
    }
    
    const conflicts = checkOverlap(vehicleId, date, period, endDate, endPeriod, id);
    
    if (conflicts.length > 0) {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      const conflictList = conflicts.map(c => 
        `  • ${c.reservation.clientName || c.reservation.prestationName} - ${format(new Date(c.date), 'd MMM', { locale: fr })} (${c.period})`
      ).join('\n');
      
      alert(`⚠️ Chevauchement détecté !\n\nLe véhicule "${vehicle?.name}" a déjà ${conflicts.length} réservation(s) sur cette période :\n\n${conflictList}\n\nVeuillez choisir d'autres dates ou un autre véhicule.`);
      return false;
    }

    // Mettre à jour via l'API
    try {
      const finalReservation = { ...updatedReservation, id };
      logger.log('✅ Envoi API - Objet final:', finalReservation);
      
      await api.updateReservation(id, finalReservation);
      
      // Mettre à jour localement
      const updatedReservations = reservations.map(r => 
        r.id === id ? finalReservation : r
      );

      setReservations(updatedReservations);
      return true;
    } catch (error) {
      console.error('❌ Erreur mise à jour réservation:', error);
      alert(`Erreur lors de la mise à jour: ${error.message}`);
      return false;
    }
  };

  const deleteReservation = async (id) => {
    logger.log('🗑️ deleteReservation appelé - ID:', id);
    
    // Seuls les admins peuvent supprimer des réservations
    if (!currentUser?.isAdmin) {
      alert('⛔ Seuls les administrateurs peuvent supprimer des réservations.');
      return false;
    }
    
    try {
      const result = await api.deleteReservation(id);
      logger.log('✅ Suppression API réussie:', result);
      setReservations(reservations.filter(r => r.id !== id));
      logger.log('✅ État local mis à jour');
    } catch (error) {
      console.error('❌ Erreur suppression réservation:', error);
      alert(`Erreur lors de la suppression: ${error.message}`);
    }
  };

  // Fonction wrapper pour la mise à jour des maintenances depuis le resize
  const updateMaintenanceFromResize = async (id, updatedData) => {
    try {
      // Trouver la maintenance existante pour conserver toutes ses propriétés
      const existingMaintenance = maintenances.find(m => m.id === id);
      if (!existingMaintenance) {
        console.error('❌ Maintenance introuvable:', id);
        return false;
      }
      
      // Fusionner les données existantes avec les nouvelles
      // Assurer que startDate met à jour date pour la DB
      const fullMaintenance = {
        ...existingMaintenance,
        ...updatedData,
        id, // S'assurer que l'id est bien présent
        date: updatedData.startDate || updatedData.date, // Utiliser startDate pour date (DB)
        end_date: updatedData.endDate // Mapper endDate vers end_date (DB)
      };
      
      logger.log('🔄 Mise à jour maintenance - Dates:', {
        avant: { date: existingMaintenance.date, endDate: existingMaintenance.endDate },
        après: { date: fullMaintenance.date, endDate: fullMaintenance.endDate }
      });
      
      await handleMaintenanceSave(fullMaintenance);
      return true;
    } catch (error) {
      console.error('❌ Erreur mise à jour maintenance:', error);
      alert(`Erreur lors de la mise à jour: ${error.message}`);
      return false;
    }
  };

  const handleMaintenanceSave = async (maintenance) => {
    try {
      logger.log('🔧 handleMaintenanceSave appelé avec:', maintenance);
      
      if (maintenance._deleted) {
        // Suppression
        await api.deleteMaintenance(maintenance.id);
        setMaintenances(maintenances.filter(m => String(m.id) !== String(maintenance.id)));
      } else if (maintenances.find(m => String(m.id) === String(maintenance.id))) {
        // Mise à jour
        logger.log('✅ Mise à jour de la maintenance existante:', maintenance.id);
        await api.updateMaintenance(maintenance.id, maintenance);
        // Rafraîchir depuis le serveur pour avoir les données à jour
        const maintenancesData = await api.getMaintenances();
        setMaintenances(maintenancesData);
      } else {
        // Ajout
        logger.log('➕ Création d\'une nouvelle maintenance:', maintenance.id);
        const created = await api.createMaintenance(maintenance);
        // Rafraîchir depuis le serveur
        const maintenancesData = await api.getMaintenances();
        setMaintenances(maintenancesData);
      }
    } catch (error) {
      console.error('❌ Erreur gestion maintenance:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleUpdateIntervention = async (updatedIntervention) => {
    try {
      logger.log('🔧 Mise à jour intervention:', updatedIntervention);
      await api.updateMaintenance(updatedIntervention.id, updatedIntervention);
      setMaintenances(maintenances.map(m => 
        m.id === updatedIntervention.id ? updatedIntervention : m
      ));
      // Rafraîchir les maintenances
      const maintenancesData = await api.getMaintenances();
      setMaintenances(maintenancesData);
    } catch (error) {
      console.error('❌ Erreur mise à jour intervention:', error);
      alert(`Erreur lors de la mise à jour: ${error.message}`);
    }
  };

  const handleDeleteIntervention = async (interventionId) => {
    try {
      logger.log('🗑️ Suppression intervention:', interventionId);
      await api.deleteMaintenance(interventionId);
      setMaintenances(maintenances.filter(m => m.id !== interventionId));
    } catch (error) {
      console.error('❌ Erreur suppression intervention:', error);
      alert(`Erreur lors de la suppression: ${error.message}`);
    }
  };

  const handleLogin = async (email, password) => {
    try {
      const result = await api.login(email, password);
      setIsAuthenticated(true);
      setCurrentUser(result.user);
      // Appliquer les préférences utilisateur au login
      try {
        const prefs = await api.getPreferences();
        if (prefs.defaultModule) setActiveModule(prefs.defaultModule);
        if (prefs.defaultView) setView(prefs.defaultView);
        // Stocker les préférences de notification pour le polling
        userPrefsRef.current = {
          notificationsEnabled: prefs.notificationsEnabled !== false,
          soundEnabled: prefs.soundEnabled !== false,
        };
        // Appliquer le volume
        setVolume((prefs.soundVolume ?? 70) / 100);
        // Charger les préférences d'onglets
        setTabPrefs({
          tabOrder: prefs.tabOrder || null,
          hiddenTabs: prefs.hiddenTabs || [],
        });
        // Demander la permission navigateur si notifications activées
        if (prefs.notificationsEnabled !== false) {
          requestNotificationPermission();
        }
      } catch (e) { /* silencieux */ }
      return result;
    } catch (error) {
      throw error;
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setVehicles([]);
    setReservations([]);
    setClients([]);
    setDrivers([]);
    setLocations([]);
    setGarages([]);
    setMaintenances([]);
    // Ne pas effacer calendarConfig pour conserver la configuration Google Calendar
  };

  // ═══ Navigation croisée entre modules ═══
  const handleNavigateToEntity = useCallback((type, data) => {
    if (type === 'vehicle') {
      const v = vehicles.find(v => v.id === data.id);
      if (v) {
        setActiveModule('vehicles');
        setShowManagement(false);
        setShowSettings(false);
        setSelectedVehicleForDetails(v);
      }
    } else if (type === 'person') {
      setActiveModule('personnel');
      setShowManagement(false);
      setShowSettings(false);
      setNavigateToPersonId(data.id);
    } else if (type === 'reservation') {
      setActiveModule('vehicles');
      setShowManagement(false);
      setShowSettings(false);
      setReservationToEdit(data.id);
    }
  }, [vehicles]);

  // Synchro ref showMessaging
  useEffect(() => { showMessagingRef.current = showMessaging; }, [showMessaging]);

  // Polling compteur de messages non lus + notifications
  useEffect(() => {
    if (!currentUser) return;

    // Demander la permission notification dès que possible
    requestNotificationPermission();

    const fetchUnread = async () => {
      try {
        const data = await api.getUnreadCount();
        const newCount = data.unread || 0;
        const prevCount = prevUnreadRef.current;

        // Nouveau message détecté (compteur augmente, et pas le polling initial)
        if (newCount > prevCount && prevCount !== -1) {
          const prefs = userPrefsRef.current;
          const diff = newCount - prevCount;

          // Toast in-app + son (sauf si panneau messagerie ouvert)
          if (prefs.notificationsEnabled !== false && !showMessagingRef.current) {
            toast.info(`💬 ${diff} nouveau${diff > 1 ? 'x' : ''} message${diff > 1 ? 's' : ''}`, {
              sound: prefs.soundEnabled !== false,
            });
          } else if (prefs.soundEnabled) {
            playNotificationSound();
          }

          // Notification navigateur (si le panneau messagerie n'est pas ouvert)
          if (prefs.notificationsEnabled && !showMessagingRef.current) {
            showBrowserNotification(
              `${diff} nouveau${diff > 1 ? 'x' : ''} message${diff > 1 ? 's' : ''}`,
              { body: 'Cliquez pour ouvrir la messagerie eM@g' }
            );
          }
        }

        prevUnreadRef.current = newCount;
        setUnreadMsgCount(newCount);
      } catch (e) { /* silencieux */ }
    };
    // Marquer -1 au premier appel pour ne pas notifier au chargement initial
    prevUnreadRef.current = -1;
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  if (isMobile) {
    return (
      <ErrorBoundary>
        <MobileApp onSwitchToDesktop={() => {
          sessionStorage.setItem('forceDesktop', 'true');
          window.location.hash = '';
          setIsMobile(false);
        }} />
      </ErrorBoundary>
    );
  }

  if (isLoading) {
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

  // Fonction pour synchroniser le scroll entre GoogleCalendarBanner et Calendar
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

  const handleUserUpdate = (updatedUser) => {
    setCurrentUser(updatedUser);
    // Mettre à jour le localStorage pour la persistance
    api.user = updatedUser;
    localStorage.setItem('auth_user', JSON.stringify(updatedUser));
  };

  return (
    <div className="app">
      <Header
        view={view}
        setView={setView}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        onOpenManagement={() => {
          if (activeModule === 'equipment') {
            setShowEquipmentManagement(true);
          } else {
            setShowManagement(true);
          }
        }}
        onOpenSettings={() => setShowSettings(true)}
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        maintenances={maintenances}
        vehicles={vehicles}
        reservations={reservations}
        onOpenVehicleMaintenance={setSelectedVehicleForMaintenance}
        onOpenMaintenance={(vehicle, maintenanceId) => {
          setSelectedVehicleForMaintenance(vehicle);
          setMaintenanceToEdit(maintenanceId);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
        onUserUpdate={handleUserUpdate}
        onUpdateMaintenance={handleUpdateIntervention}
        onRefreshMaintenances={loadMaintenances}
        onReservationUpdate={async () => {
          try {
            const data = await api.getReservations();
            setReservations(data);
          } catch (e) { console.error('Erreur rechargement réservations:', e); }
        }}
        onToggleMessaging={() => setShowMessaging(v => !v)}
        unreadMsgCount={unreadMsgCount}
        onOpenPreferences={() => setShowPreferences(true)}
        onOpenHelp={() => setShowHelp(true)}
        tabPrefs={tabPrefs}
      />

      {/* Bannière installation PWA */}
      {showPwaInstall && (
        <div className="pwa-install-banner">
          <span>📱 Installer eM@g sur votre appareil pour un accès rapide</span>
          <button className="pwa-install-btn" onClick={handlePwaInstall}>Installer</button>
          <button className="pwa-dismiss-btn" onClick={() => setShowPwaInstall(false)}>✕</button>
        </div>
      )}
      
      {activeModule !== 'affaires' && activeModule !== 'equipment' && activeModule !== 'orders' && activeModule !== 'catalog' && activeModule !== 'trucks' && (
      <GoogleCalendarBanner 
        calendarConfig={calendarConfig} 
        view={view}
        activeModule={activeModule}
        currentDate={currentDate}
        currentUser={currentUser}
        onScroll={handleBannerScroll}
        onEventClick={(event) => setGoogleEventForReservation(event)}
        onEventsChange={handleGoogleEventsChange}
        clients={clients}
        locations={locations}
        reservations={reservations}
        onEventHover={setHoveredEventId}
        onRequestEditReservation={setReservationToEdit}
        onRequestViewEvent={(fn) => { openEventDetailsModalRef.current = fn; }}
        onReservationsRefresh={async () => {
          try {
            const data = await api.getReservations();
            setReservations(data);
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
          setActiveModule('personnel');
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

      {activeModule === 'vehicles' && (
        <>
          {view === 'planning' ? (
            <PlanningView
              vehicles={vehicles}
              reservations={reservations}
              maintenances={maintenances}
              currentDate={currentDate}
              onOpenReservation={(reservation) => {
                const vehicle = vehicles.find(v => v.id === reservation.vehicleId);
                if (vehicle) {
                  logger.log('Open reservation', reservation);
                }
              }}
              onOpenMaintenance={setSelectedVehicleForMaintenance}
              clients={clients}
              drivers={drivers}
            />
          ) : (
            <div className="calendar-with-vehicle-panel">
              <Calendar
                view={view}
                setView={setView}
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                vehicles={vehicles}
                reservations={reservations}
                maintenances={maintenances}
                onAddReservation={addReservation}
                onUpdateReservation={updateReservation}
                onUpdateMaintenance={updateMaintenanceFromResize}
                onScroll={handleCalendarScroll}
                onDeleteReservation={deleteReservation}
                clients={clients}
                drivers={drivers}
                persons={persons}
                locations={locations}
                users={users}
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
              <VehicleSlidePanel
                vehicle={selectedVehicleForDetails}
                maintenances={maintenances}
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

      {activeModule === 'personnel' && (
        <Suspense fallback={
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Chargement du module personnel...</p>
          </div>
        }>
          <PersonnelPanel
            key={personnelRefreshKey}
            currentUser={currentUser}
            mode="planning"
            view={view}
            setView={setView}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            googleEvents={allGoogleEvents}
            navigateToPersonId={navigateToPersonId}
            onNavigateToPersonHandled={() => setNavigateToPersonId(null)}
            quickAssignmentSlot={quickAssignmentSlot}
            onQuickAssignmentHandled={() => setQuickAssignmentSlot(null)}
          />
        </Suspense>
      )}

      {activeModule === 'affaires' && (
        <Suspense fallback={
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Chargement du module affaires...</p>
          </div>
        }>
          <AffairesPanel
            reservations={reservations}
            onNavigateToEntity={handleNavigateToEntity}
          />
        </Suspense>
      )}

      {activeModule === 'equipment' && (
        <Suspense fallback={
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Chargement du parc matériel...</p>
          </div>
        }>
          <EquipmentPanel
            currentUser={currentUser}
            showManagement={showEquipmentManagement}
            onCloseManagement={() => setShowEquipmentManagement(false)}
          />
        </Suspense>
      )}

      {activeModule === 'orders' && (
        <Suspense fallback={
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Chargement des commandes...</p>
          </div>
        }>
          <OrdersPanel
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {activeModule === 'catalog' && (
        <Suspense fallback={
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Chargement du catalogue matériel...</p>
          </div>
        }>
          <CataloguePanel
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {activeModule === 'trucks' && (
        <Suspense fallback={
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Chargement des modèles de camions...</p>
          </div>
        }>
          <TruckModelPanel
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {showManagement && (
        <Suspense fallback={
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Chargement du panneau de gestion...</p>
          </div>
        }>
          <ManagementPanel
            vehicles={vehicles}
            setVehicles={setVehicles}
            reservations={reservations}
            setReservations={setReservations}
            clients={clients}
            setClients={setClients}
            drivers={drivers}
            setDrivers={setDrivers}
            locations={locations}
            setLocations={setLocations}
            calendarConfig={calendarConfig}
            setCalendarConfig={setCalendarConfig}
            garages={garages}
            setGarages={setGarages}
            maintenances={maintenances}
            setMaintenances={setMaintenances}
            currentUser={currentUser}
            activeModule={activeModule}
            panelType="management"
            onClose={() => {
              setShowManagement(false);
              if (activeModule === 'personnel') {
                setPersonnelRefreshKey(k => k + 1);
              }
            }}
          />
        </Suspense>
      )}

      {showSettings && (
        <Suspense fallback={
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Chargement des paramètres...</p>
          </div>
        }>
          <ManagementPanel
            vehicles={vehicles}
            setVehicles={setVehicles}
            reservations={reservations}
            setReservations={setReservations}
            clients={clients}
            setClients={setClients}
            drivers={drivers}
            setDrivers={setDrivers}
            locations={locations}
            setLocations={setLocations}
            calendarConfig={calendarConfig}
            setCalendarConfig={setCalendarConfig}
            garages={garages}
            setGarages={setGarages}
            maintenances={maintenances}
            setMaintenances={setMaintenances}
            currentUser={currentUser}
            panelType="settings"
            onClose={() => setShowSettings(false)}
            onNavigateToPersonnel={(person) => {
              setShowSettings(false);
              setActiveModule('personnel');
              setShowManagement(true);
            }}
          />
        </Suspense>
      )}

      {selectedVehicleForMaintenance && (
        <Suspense fallback={
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Chargement...</p>
          </div>
        }>
          <MaintenanceDialog
            vehicle={selectedVehicleForMaintenance}
            maintenances={maintenances}
            garages={garages}
            reservations={reservations}
            maintenanceToEdit={maintenanceToEdit}
            actionType={maintenanceActionType}
            currentUser={currentUser}
            onSave={handleMaintenanceSave}
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
          maintenances={maintenances}
          currentUser={currentUser}
          onClose={() => setVehicleForDialog(null)}
          onRequestMaintenance={handleRequestMaintenance}
          onReportBreakdown={handleReportBreakdown}
          onScheduleMaintenance={handleScheduleMaintenance}
          onUpdateIntervention={handleUpdateIntervention}
          onDeleteIntervention={handleDeleteIntervention}
          onOpenMaintenance={(vehicle) => {
            setSelectedVehicleForKilometrageControl(vehicle);
            setVehicleForDialog(null);
          }}
        />
      )}

      {selectedVehicleForKilometrageControl && (
        <Suspense fallback={
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Chargement...</p>
          </div>
        }>
          <VehicleMaintenanceModal
            vehicle={selectedVehicleForKilometrageControl}
            onSave={async (updatedVehicle) => {
              try {
                const response = await api.updateVehicle(updatedVehicle.id, updatedVehicle);
                setVehicles(prevVehicles => 
                  prevVehicles.map(v => v.id === response.id ? response : v)
                );
                // Mettre à jour le véhicule sélectionné avec la réponse pour que le modal affiche les nouvelles données
                setSelectedVehicleForKilometrageControl(response);
              } catch (error) {
                console.error('Erreur lors de la mise à jour du véhicule:', error);
                alert('Erreur lors de la mise à jour du véhicule');
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

      {/* Préférences utilisateur */}
      <Suspense fallback={null}>
        <UserPreferencesModal
          isOpen={showPreferences}
          onClose={() => setShowPreferences(false)}
          onPreferencesChange={(prefs) => {
            // Mettre à jour les préférences de notification en temps réel
            userPrefsRef.current = {
              notificationsEnabled: prefs.notificationsEnabled !== false,
              soundEnabled: prefs.soundEnabled !== false,
            };
            // Volume
            setVolume((prefs.soundVolume ?? 70) / 100);
            // Mettre à jour les préférences d'onglets
            setTabPrefs({
              tabOrder: prefs.tabOrder || null,
              hiddenTabs: prefs.hiddenTabs || [],
            });
            // Demander la permission si notifications activées
            if (prefs.notificationsEnabled !== false) {
              requestNotificationPermission();
            }
          }}
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
    </div>
  );
}

export default App;
