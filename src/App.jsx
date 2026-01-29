import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Calendar from './components/Calendar';
import Header from './components/Header';
import ManagementPanel from './components/ManagementPanel';
import GoogleCalendarBanner from './components/GoogleCalendarBanner';
import MaintenanceDialog from './components/MaintenanceDialog';
import VehicleDetailsModal from './components/VehicleDetailsModal';
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

  // Calculer les réservations à surligner en fonction de l'événement survolé
  const highlightedReservationIds = useMemo(() => {
    if (!hoveredEventId) return [];
    return reservations
      .filter(r => r.googleEventId === hoveredEventId)
      .map(r => r.id);
  }, [hoveredEventId, reservations]);

  // Charger les données au démarrage
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Charger depuis IndexedDB
        let savedVehicles = await loadFromIndexedDB(STORES.vehicles, []);
        let savedReservations = await loadFromIndexedDB(STORES.reservations, []);
        let savedClients = await loadFromIndexedDB(STORES.clients, []);
        let savedDrivers = await loadFromIndexedDB(STORES.drivers, []);
        let savedLocations = await loadFromIndexedDB(STORES.locations, []);
        let savedCalendarConfig = await loadFromIndexedDB(STORES.calendarConfig, { apiKey: '', calendarId: '' });
        let savedGarages = await loadFromIndexedDB(STORES.garages, []);
        let savedMaintenances = await loadFromIndexedDB(STORES.maintenances, []);

        // Charger les données initiales depuis initial_data.json SEULEMENT pour ce qui manque
        if (savedVehicles.length === 0 || savedClients.length === 0 || savedDrivers.length === 0 || savedGarages.length === 0) {
          console.log('📦 Chargement des données initiales manquantes...');
          try {
            const response = await fetch('/initial_data.json');
            const initialData = await response.json();
            
            // Charger les véhicules SEULEMENT si vide
            if (savedVehicles.length === 0 && initialData.vehicles && initialData.vehicles.length > 0) {
              console.log(`✅ ${initialData.vehicles.length} véhicules chargés depuis initial_data.json`);
              savedVehicles = initialData.vehicles;
              await saveToIndexedDB(STORES.vehicles, savedVehicles);
            }
            
            // NE PAS écraser les réservations existantes - garder celles de la DB
            // (on ne charge initial_data.reservations que si vraiment vide ET qu'on veut les données de démo)
            
            // Charger les clients SEULEMENT si vide
            if (savedClients.length === 0 && initialData.clients) {
              console.log(`✅ ${initialData.clients.length} clients chargés`);
              savedClients = initialData.clients;
              await saveToIndexedDB(STORES.clients, savedClients);
            }
            
            // Charger les conducteurs SEULEMENT si vide
            if (savedDrivers.length === 0 && initialData.drivers) {
              console.log(`✅ ${initialData.drivers.length} conducteurs chargés`);
              savedDrivers = initialData.drivers;
              await saveToIndexedDB(STORES.drivers, savedDrivers);
            }
            
            // Charger les garages SEULEMENT si vide
            if (savedGarages.length === 0 && initialData.garages) {
              console.log(`✅ ${initialData.garages.length} garages chargés`);
              savedGarages = initialData.garages;
              await saveToIndexedDB(STORES.garages, savedGarages);
            }
          } catch (fetchError) {
            console.error('❌ Erreur chargement initial_data.json:', fetchError);
          }
        }

        // Trier les véhicules par ordre
        const sortedVehicles = savedVehicles.sort((a, b) => (a.order || 0) - (b.order || 0));

        setVehicles(sortedVehicles);
        setReservations(savedReservations);
        setClients(savedClients);
        setDrivers(savedDrivers);
        setLocations(savedLocations);
        setCalendarConfig(savedCalendarConfig);
        setGarages(savedGarages);
        setMaintenances(savedMaintenances);
      } catch (error) {
        console.error('❌ Erreur lors du chargement des données:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

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

  const addReservation = (reservationData) => {
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
      
      // Créer une seule réservation avec date de début et de fin
      newReservations.push({
        id: Date.now() + Math.random(),
        vehicleId,
        date,
        period,
        endDate,
        endPeriod,
        ...otherData
      });
    }
    
    setReservations([...reservations, ...newReservations]);
    return true;
  };

  const updateReservation = (id, updatedReservation) => {
    // Trouver la réservation à modifier
    const oldReservation = reservations.find(r => r.id === id);
    if (!oldReservation) return false;

    // Vérifier les chevauchements (en excluant la réservation en cours de modification)
    const { vehicleId, date, period, endDate, endPeriod } = updatedReservation;
    const conflicts = checkOverlap(vehicleId, date, period, endDate, endPeriod, id);
    
    if (conflicts.length > 0) {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      const conflictList = conflicts.map(c => 
        `  • ${c.reservation.clientName || c.reservation.prestationName} - ${format(new Date(c.date), 'd MMM', { locale: fr })} (${c.period})`
      ).join('\n');
      
      alert(`⚠️ Chevauchement détecté !\n\nLe véhicule "${vehicle?.name}" a déjà ${conflicts.length} réservation(s) sur cette période :\n\n${conflictList}\n\nVeuillez choisir d'autres dates ou un autre véhicule.`);
      return false;
    }

    // Remplacer la réservation existante par la version mise à jour
    const updatedReservations = reservations.map(r => 
      r.id === id ? { ...updatedReservation, id } : r
    );

    setReservations(updatedReservations);
    return true;
  };

  const deleteReservation = (id) => {
    setReservations(reservations.filter(r => r.id !== id));
  };

  const handleMaintenanceSave = (maintenance) => {
    if (maintenance._deleted) {
      // Suppression
      setMaintenances(maintenances.filter(m => m.id !== maintenance.id));
    } else if (maintenances.find(m => m.id === maintenance.id)) {
      // Mise à jour
      setMaintenances(maintenances.map(m => m.id === maintenance.id ? maintenance : m));
    } else {
      // Ajout
      setMaintenances([...maintenances, maintenance]);
    }
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
      />

      {showManagement && (
        <ManagementPanel
          vehicles={vehicles}
          setVehicles={setVehicles}
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
