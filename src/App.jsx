import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Calendar from './components/Calendar';
import Header from './components/Header';
import ManagementPanel from './components/ManagementPanel';
import GoogleCalendarBanner from './components/GoogleCalendarBanner';
import MaintenanceDialog from './components/MaintenanceDialog';
import VehicleDetailsModal from './components/VehicleDetailsModal';
import LoginForm from './components/LoginForm';
import MobileApp from './components/mobile/MobileApp';
import PlanningView from './components/PlanningView';
import ErrorBoundary from './components/ErrorBoundary';
import api from './utils/api';
import { saveToIndexedDB, loadFromIndexedDB, STORES } from './utils/indexedDB';
import { getPeriodTimestamp } from './utils/dateUtils';
import './App.css';

// Fonction utilitaire pour formater une date en YYYY-MM-DD
const formatDateToString = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function App() {
  // Vérifier si on est sur l'interface mobile
  const isMobilePath = window.location.pathname === '/mobile' || window.location.hash === '#/mobile';
  
  // Si mobile, afficher uniquement MobileApp
  if (isMobilePath) {
    return (
      <ErrorBoundary>
        <MobileApp />
      </ErrorBoundary>
    );
  }
  
  const [view, setView] = useState('week'); // 'week', 'month', 'year'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [vehicles, setVehicles] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [clients, setClients] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [calendarConfig, setCalendarConfig] = useState({ apiKey: '', calendarId: '' });
  const [showManagement, setShowManagement] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [googleEventForReservation, setGoogleEventForReservation] = useState(null);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [hoveredEventId, setHoveredEventId] = useState(null);
  const [reservationToEdit, setReservationToEdit] = useState(null);
  const [garages, setGarages] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [selectedVehicleForMaintenance, setSelectedVehicleForMaintenance] = useState(null);
  const [maintenanceToEdit, setMaintenanceToEdit] = useState(null);
  const [selectedVehicleForDetails, setSelectedVehicleForDetails] = useState(null);
  const [maintenanceActionType, setMaintenanceActionType] = useState(null); // 'schedule', 'request', 'breakdown'
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

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
          configData
        ] = await Promise.all([
          api.getVehicles(),
          api.getReservations(),
          api.getClients(),
          api.getDrivers(),
          api.getLocations(),
          api.getGarages(),
          api.getMaintenances(),
          api.getConfig('googleCalendar')
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

  // Sauvegarder automatiquement
  useEffect(() => {
    if (!isLoading) {
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
    }
  }, [vehicles, reservations, clients, drivers, locations, calendarConfig, garages, maintenances, isLoading]);

  // NOTE: Cette sauvegarde IndexedDB est conservée temporairement pour la compatibilité
  // pendant la migration. Elle sera supprimée une fois la migration terminée.

  // Mettre à jour automatiquement les statuts des interventions selon les dates
  useEffect(() => {
    const updateMaintenanceStatuses = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let hasChanges = false;
      const updatedMaintenances = maintenances.map(maintenance => {
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
          // Avant la date de début -> Programmée
          newStatus = 'scheduled';
        } else if (today >= startDate && today <= endDate) {
          // Entre début et fin -> En cours
          newStatus = 'in_progress';
        } else if (today > endDate) {
          // Après la date de fin -> Effectuée
          newStatus = 'completed';
        }

        if (newStatus !== maintenance.status) {
          hasChanges = true;
          return { ...maintenance, status: newStatus };
        }

        return maintenance;
      });

      if (hasChanges) {
        setMaintenances(updatedMaintenances);
      }
    };

    // Vérifier au chargement et toutes les heures
    if (!isLoading && maintenances.length > 0) {
      updateMaintenanceStatuses();
      const interval = setInterval(updateMaintenanceStatuses, 3600000); // 1 heure
      return () => clearInterval(interval);
    }
  }, [maintenances, isLoading]);

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
    console.log('📝 updateReservation appelé - ID:', id, 'Objet:', updatedReservation);
    
    // Vérifier que l'objet a un ID valide
    if (!id || (!updatedReservation.id && id)) {
      console.warn('⚠️ Objet sans ID détecté, ajout de l\'ID:', id);
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
      console.log('✅ Envoi API - Objet final:', finalReservation);
      
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
    try {
      await api.deleteReservation(id);
      setReservations(reservations.filter(r => r.id !== id));
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
      
      console.log('🔄 Mise à jour maintenance - Dates:', {
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
      console.log('🔧 handleMaintenanceSave appelé avec:', maintenance);
      console.log('🔧 Maintenances actuelles:', maintenances.map(m => ({ id: m.id, name: m.prestationName })));
      
      if (maintenance._deleted) {
        // Suppression
        await api.deleteMaintenance(maintenance.id);
        setMaintenances(maintenances.filter(m => m.id !== maintenance.id));
      } else if (maintenances.find(m => m.id === maintenance.id)) {
        // Mise à jour
        console.log('✅ Mise à jour de la maintenance existante:', maintenance.id);
        await api.updateMaintenance(maintenance.id, maintenance);
        setMaintenances(maintenances.map(m => m.id === maintenance.id ? maintenance : m));
      } else {
        // Ajout
        console.log('➕ Création d\'une nouvelle maintenance:', maintenance.id);
        const created = await api.createMaintenance(maintenance);
        setMaintenances([...maintenances, created]);
      }
    } catch (error) {
      console.error('❌ Erreur gestion maintenance:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleLogin = async (email, password) => {
    try {
      const result = await api.login(email, password);
      setIsAuthenticated(true);
      setCurrentUser(result.user);
      return result;
    } catch (error) {
      throw error;
    }
  };

  const handleLogout = () => {
    api.logout();
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

  return (
    <div className="app">
      <Header
        view={view}
        setView={setView}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        onOpenManagement={() => setShowManagement(true)}
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
      />
      
      <GoogleCalendarBanner 
        calendarConfig={calendarConfig} 
        view={view}
        currentDate={currentDate}
        onScroll={handleBannerScroll}
        onEventClick={(event) => setGoogleEventForReservation(event)}
        onEventsChange={setGoogleEvents}
        clients={clients}
        locations={locations}
        reservations={reservations}
        onEventHover={setHoveredEventId}
        onRequestEditReservation={setReservationToEdit}
      />

      {view === 'planning' ? (
        <PlanningView
          vehicles={vehicles}
          reservations={reservations}
          maintenances={maintenances}
          currentDate={currentDate}
          onOpenReservation={(reservation) => {
            const vehicle = vehicles.find(v => v.id === reservation.vehicleId);
            if (vehicle) {
              // TODO: Ouvrir modal de réservation si besoin
              console.log('Open reservation', reservation);
            }
          }}
          onOpenMaintenance={setSelectedVehicleForMaintenance}
          clients={clients}
          drivers={drivers}
        />
      ) : (
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
          locations={locations}
          googleEvent={googleEventForReservation}
          onCloseGoogleEvent={() => setGoogleEventForReservation(null)}
          googleEvents={googleEvents}
          highlightedReservationIds={highlightedReservationIds}
          reservationToEdit={reservationToEdit}
          onReservationEditComplete={() => setReservationToEdit(null)}
          onVehicleClick={setSelectedVehicleForDetails}
          onMaintenanceClick={(vehicle, maintenanceId) => {
            setSelectedVehicleForMaintenance(vehicle);
            setMaintenanceToEdit(maintenanceId);
          }}
          currentUser={currentUser}
        />
      )}

      {showManagement && (
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
          onClose={() => setShowManagement(false)}
        />
      )}

      {selectedVehicleForMaintenance && (
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
      )}

      {selectedVehicleForDetails && (
        <VehicleDetailsModal
          vehicle={selectedVehicleForDetails}
          maintenances={maintenances}
          currentUser={currentUser}
          onClose={() => setSelectedVehicleForDetails(null)}
          onRequestMaintenance={handleRequestMaintenance}
          onReportBreakdown={handleReportBreakdown}
          onScheduleMaintenance={handleScheduleMaintenance}
        />
      )}
    </div>
  );
}

export default App;
