import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Trash2, MapPin } from 'lucide-react';
import { useAutocomplete } from '../hooks/useAutocomplete';
import { useGooglePlacesAutocomplete } from '../hooks/useGooglePlacesAutocomplete';
import TripDetailsModal from './TripDetailsModal';
import LocationDialog from './LocationDialog';
import api from '../utils/api';
import { loadFromIndexedDB } from '../utils/indexedDB';
import './ReservationModal.css';

const ReservationModal = ({
  slot,
  reservation,
  vehicles,
  clients,
  drivers,
  locations,
  onSave,
  onDelete,
  onClose,
  googleEvent, // Événement Google pour mode multi-véhicules
  googleEvents = [], // Liste de tous les événements Google disponibles
  currentUser,
  onRequestViewEvent, // Callback pour ouvrir l'EventDetailsModal
}) => {
  const isEdit = !!reservation;
  const isMultiVehicle = !!googleEvent && !isEdit; // Mode multi-véhicules seulement en création
  
  // Helper pour formater une date en YYYY-MM-DD sans décalage de fuseau horaire
  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Initialiser les affaires en tant que tableau (compatibilité avec l'ancien format)
  const initAffaires = () => {
    if (reservation?.affaires && Array.isArray(reservation.affaires)) {
      return reservation.affaires;
    } else if (reservation?.affaire) {
      return [reservation.affaire];
    } else if (googleEvent?.affaire) {
      return [googleEvent.affaire];
    }
    return [];
  };

  // Initialiser les événements liés
  const initLinkedEvents = () => {
    if (reservation?.linkedEventIds && Array.isArray(reservation.linkedEventIds)) {
      return reservation.linkedEventIds;
    } else if (reservation?.googleEventId) {
      return [reservation.googleEventId];
    } else if (googleEvent?.id) {
      return [googleEvent.id];
    }
    return [];
  };

  const [formData, setFormData] = useState({
    vehicleId: reservation?.vehicleId || slot?.vehicle?.id || '',
    date: reservation?.date || formatDateForInput(slot?.startDate || slot?.date) || '',
    period: reservation?.period || slot?.startPeriod || slot?.period || 'AM',
    endDate: reservation?.endDate || formatDateForInput(slot?.endDate || slot?.date) || '',
    endPeriod: reservation?.endPeriod || slot?.endPeriod || slot?.period || 'AM',
    clientName: reservation?.clientName || googleEvent?.detectedClient || '',
    driverName: reservation?.driverName || '',
    locationName: reservation?.locationName || googleEvent?.detectedLocation || googleEvent?.location || '',
    prestationName: reservation?.prestationName || googleEvent?.summary || '',
    notes: reservation?.notes || '',
    googleEventId: reservation?.googleEventId || googleEvent?.id || '', // Pour compatibilité
    linkedEventIds: initLinkedEvents(), // Nouveau tableau pour les événements multiples
    affaires: initAffaires(),
    isTournee: reservation?.isTournee || false, // Nouvelle option Tournée
  });

  const [initialFormData, setInitialFormData] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const [newAffaire, setNewAffaire] = useState('');

  // Autocomplétion Google Places pour le champ lieu
  const { inputRef: locationInputRef } = useGooglePlacesAutocomplete(
    (place) => {
      setFormData(prev => ({
        ...prev,
        locationName: place.address || place.name
      }));
      if (place.address) {
        addLocation(place.address);
      }
    },
    { types: ['geocode'] }
  );

  // Hooks pour l'autocomplétion
  const { suggestions: clientSuggestions, addToHistory: addClient } = useAutocomplete('clients');
  const { suggestions: driverSuggestions, addToHistory: addDriver } = useAutocomplete('drivers');
  const { suggestions: locationSuggestions, addToHistory: addLocation } = useAutocomplete('locations');
  const { suggestions: prestationSuggestions, addToHistory: addPrestation } = useAutocomplete('prestations');
  const { suggestions: affaireSuggestions, addToHistory: addAffaire } = useAutocomplete('affaires');

  // États pour TripDetailsModal
  const [selectedEventForTrip, setSelectedEventForTrip] = useState(null);
  const [tripDetails, setTripDetails] = useState({});
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  
  // État pour LocationDialog
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  
  // État pour l'adresse de Mag Scène
  const [companyAddress, setCompanyAddress] = useState('');
  const [allLocations, setAllLocations] = useState(locations);

  // Charger l'adresse de Mag Scène et créer la liste complète des lieux
  useEffect(() => {
    const fetchCompanyAddress = async () => {
      try {
        console.log('📝 ReservationModal: Chargement adresse depuis IndexedDB...');
        
        // Charger depuis IndexedDB au lieu de l'API
        const config = await loadFromIndexedDB('calendarConfig', {});
        const address = config.companyAddress || '';
        
        console.log('📝 ReservationModal: Adresse IndexedDB:', address);
        setCompanyAddress(address);
        
        // Créer un lieu virtuel pour Mag Scène si une adresse existe
        if (address) {
          // Vérifier si Mag Scène n'est pas déjà dans la liste
          const hasMagScene = locations.some(l => l.id === 'mag-scene' || l.name === 'Mag Scène');
          
          if (!hasMagScene) {
            const magSceneLocation = {
              id: 'mag-scene',
              name: 'Mag Scène',
              address: address,
              type: 'Dépôt'
            };
            console.log('📝 ReservationModal: Mag Scène ajouté, total lieux:', [magSceneLocation, ...locations].length);
            setAllLocations([magSceneLocation, ...locations]);
          } else {
            console.log('📝 ReservationModal: Mag Scène déjà présent');
            setAllLocations(locations);
          }
        } else {
          console.log('📝 ReservationModal: Pas d\'adresse Mag Scène');
          setAllLocations(locations);
        }
      } catch (error) {
        console.error('📝 ReservationModal: Erreur lors du chargement:', error);
        setAllLocations(locations);
      }
    };
    
    fetchCompanyAddress();
  }, [locations]);

  // Charger la clé API Google Maps
  useEffect(() => {
    const fetchGoogleMapsApiKey = async () => {
      try {
        console.log('📝 ReservationModal: Chargement clé Google Maps depuis IndexedDB...');
        const config = await loadFromIndexedDB('calendarConfig', {});
        const apiKey = config.googleMapsApiKey || '';
        console.log('📝 ReservationModal: Clé API chargée:', apiKey ? 'Oui' : 'Non');
        setGoogleMapsApiKey(apiKey);
      } catch (error) {
        console.error('Erreur lors du chargement de la clé API Google Maps:', error);
      }
    };
    
    fetchGoogleMapsApiKey();
  }, []);

  // Charger les détails de trajet existants lors de l'édition
  useEffect(() => {
    const loadTripDetails = async () => {
      if (isEdit && reservation?.id) {
        try {
          const token = localStorage.getItem('auth_token');
          if (!token) return;
          
          const response = await fetch(`/api/trip-details/${reservation.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const details = await response.json();
            const detailsMap = {};
            details.forEach(detail => {
              // Transformer les noms snake_case en camelCase
              detailsMap[detail.event_id] = {
                ...detail,
                departureLocation: detail.departure_location,
                departureDate: detail.departure_date,
                departureTime: detail.departure_time,
                arrivalLocation: detail.arrival_location,
                arrivalDate: detail.arrival_date,
                arrivalTime: detail.arrival_time,
                returnDepartureLocation: detail.return_departure_location,
                returnDepartureDate: detail.return_departure_date,
                returnDepartureTime: detail.return_departure_time,
                returnArrivalLocation: detail.return_arrival_location,
                returnArrivalDate: detail.return_arrival_date,
                returnArrivalTime: detail.return_arrival_time,
                driverName: detail.driver_name,
                hasJunctionWithNext: detail.has_junction_with_next,
                junctionLocation: detail.junction_location,
                outboundDuration: detail.outbound_duration,
                returnDuration: detail.return_duration
              };
            });
            setTripDetails(detailsMap);
          }
        } catch (error) {
          console.error('Erreur lors du chargement des détails de trajet:', error);
        }
      }
    };
    
    loadTripDetails();
  }, [isEdit, reservation?.id]);

  // État pour la sélection multiple de véhicules
  const [selectedVehicleIds, setSelectedVehicleIds] = useState(
    isMultiVehicle ? [] : []
  );

  // État pour le dropdown personnalisé des événements Google
  const [isEventDropdownOpen, setIsEventDropdownOpen] = useState(false);

  // Initialiser initialFormData au montage pour la réservation en édition
  useEffect(() => {
    if (isEdit && reservation && !initialFormData) {
      console.log('🔵 Initialisation initialFormData:', formData);
      console.log('🔵 reservation.linkedEventIds:', reservation.linkedEventIds);
      console.log('🔵 reservation.isTournee:', reservation.isTournee);
      setInitialFormData({...formData});
    }
  }, [isEdit, reservation]);

  // Détecter les changements
  useEffect(() => {
    if (isEdit && initialFormData) {
      const changed = JSON.stringify(formData) !== JSON.stringify(initialFormData);
      console.log('🟢 Détection changements:', {
        changed,
        formDataLinkedEventIds: formData.linkedEventIds,
        initialLinkedEventIds: initialFormData.linkedEventIds
      });
      setHasChanges(changed);
    }
  }, [formData, initialFormData, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGoogleEventSelect = (e) => {
    const eventId = e.target.value;
    if (eventId) {
      const selectedEvent = googleEvents.find(ev => ev.id === eventId);
      if (selectedEvent) {
        setFormData((prev) => {
          const newAffaires = [...prev.affaires];
          if (selectedEvent.affaire && !newAffaires.includes(selectedEvent.affaire)) {
            newAffaires.push(selectedEvent.affaire);
          }
          return {
            ...prev,
            googleEventId: selectedEvent.id,
            googleEventTitle: selectedEvent.summary || '(Sans titre)',
            locationName: selectedEvent.detectedLocation || selectedEvent.location || prev.locationName,
            prestationName: selectedEvent.summary || prev.prestationName,
            clientName: selectedEvent.detectedClient || prev.clientName,
            affaires: newAffaires,
          };
        });
      }
    } else {
      // Désélectionner l'événement
      setFormData((prev) => ({
        ...prev,
        googleEventId: '',
        googleEventTitle: '',
      }));
    }
    setIsEventDropdownOpen(false);
  };

  const selectGoogleEvent = (event) => {
    if (event) {
      setFormData((prev) => {
        if (prev.isTournee) {
          // Mode tournée : ajouter/retirer l'événement de la liste
          const newLinkedEventIds = [...prev.linkedEventIds];
          const eventIndex = newLinkedEventIds.indexOf(event.id);
          
          console.log('🟡 selectGoogleEvent (tournée):', {
            eventId: event.id,
            currentLinkedEventIds: prev.linkedEventIds,
            eventIndex,
            action: eventIndex > -1 ? 'retirer' : 'ajouter'
          });
          
          if (eventIndex > -1) {
            // L'événement est déjà sélectionné, le retirer
            newLinkedEventIds.splice(eventIndex, 1);
          } else {
            // Ajouter l'événement
            newLinkedEventIds.push(event.id);
          }
          
          // Mettre à jour les affaires
          const newAffaires = [];
          newLinkedEventIds.forEach(eventId => {
            const e = googleEvents.find(ev => ev.id === eventId);
            if (e?.affaire && !newAffaires.includes(e.affaire)) {
              newAffaires.push(e.affaire);
            }
          });
          
          console.log('🟡 Nouveaux linkedEventIds:', newLinkedEventIds);
          
          return {
            ...prev,
            linkedEventIds: newLinkedEventIds,
            googleEventId: newLinkedEventIds[0] || '',
            affaires: newAffaires,
          };
        } else {
          // Mode normal : un seul événement
          const newAffaires = [...prev.affaires];
          if (event.affaire && !newAffaires.includes(event.affaire)) {
            newAffaires.push(event.affaire);
          }
          
          setIsEventDropdownOpen(false);
          
          return {
            ...prev,
            linkedEventIds: [event.id],
            googleEventId: event.id,
            locationName: event.detectedLocation || event.location || prev.locationName,
            prestationName: prev.prestationName || event.summary,
            clientName: prev.clientName || event.detectedClient,
            affaires: newAffaires,
          };
        }
      });
      // Ne fermer le dropdown qu'en mode normal
    } else {
      // Désélectionner tous les événements
      setFormData((prev) => ({
        ...prev,
        googleEventId: '',
        linkedEventIds: [],
      }));
      setIsEventDropdownOpen(false);
    }
  };

  const handleVehicleToggle = (vehicleId) => {
    setSelectedVehicleIds(prev => 
      prev.includes(vehicleId) 
        ? prev.filter(id => id !== vehicleId)
        : [...prev, vehicleId]
    );
  };

  // Fonctions pour gérer les détails de trajet
  const handleOpenTripDetails = (event, eventIndex) => {
    setSelectedEventForTrip({ event, eventIndex });
  };

  const handleSaveTripDetails = async (tripData) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        alert('Vous devez être connecté pour enregistrer les détails du trajet');
        return null;
      }
      
      if (!reservation?.id) {
        alert('Vous devez d\'abord enregistrer la réservation avant d\'ajouter des détails de trajet');
        return null;
      }
      
      const response = await fetch('/api/trip-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reservationId: reservation?.id,
          eventId: selectedEventForTrip.event.id,
          eventOrder: selectedEventForTrip.eventIndex,
          ...tripData
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur serveur:', response.status, errorText);
        alert(`Erreur lors de l'enregistrement: ${response.status} - ${errorText}`);
        return null;
      }
      
      const savedData = await response.json();
      
      // Transformer les noms snake_case en camelCase pour cohérence
      const transformedData = {
        ...savedData,
        departureLocation: savedData.departure_location,
        departureDate: savedData.departure_date,
        departureTime: savedData.departure_time,
        arrivalLocation: savedData.arrival_location,
        arrivalDate: savedData.arrival_date,
        arrivalTime: savedData.arrival_time,
        returnDepartureLocation: savedData.return_departure_location,
        returnDepartureDate: savedData.return_departure_date,
        returnDepartureTime: savedData.return_departure_time,
        returnArrivalLocation: savedData.return_arrival_location,
        returnArrivalDate: savedData.return_arrival_date,
        returnArrivalTime: savedData.return_arrival_time,
        driverName: savedData.driver_name,
        hasJunctionWithNext: savedData.has_junction_with_next,
        junctionLocation: savedData.junction_location,
        outboundDuration: savedData.outbound_duration,
        returnDuration: savedData.return_duration
      };
      
      // Mettre à jour l'état local avec les données transformées
      setTripDetails(prev => {
        const updated = {
          ...prev,
          [selectedEventForTrip.event.id]: transformedData
        };
        console.log('✅ Trip details mis à jour pour event:', selectedEventForTrip.event.id);
        console.log('✅ Données sauvegardées:', transformedData);
        console.log('✅ État complet tripDetails:', updated);
        return updated;
      });
      
      alert('Détails du trajet enregistrés avec succès !');
      
      // Retourner les données sauvegardées (déjà en snake_case pour TripDetailsModal)
      return savedData;
      
    } catch (error) {
      console.error('Erreur sauvegarde trip details:', error);
      alert(`Erreur technique: ${error.message}`);
      return null;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Ajouter les valeurs à l'historique d'autocomplétion
    if (formData.clientName) addClient(formData.clientName);
    if (formData.driverName) addDriver(formData.driverName);
    if (formData.locationName) addLocation(formData.locationName);
    if (formData.prestationName) addPrestation(formData.prestationName);
    formData.affaires.forEach(affaire => addAffaire(affaire));
    
    if (isMultiVehicle) {
      // Mode multi-véhicules : créer une réservation par véhicule sélectionné
      if (selectedVehicleIds.length === 0) {
        alert('Veuillez sélectionner au moins un véhicule');
        return;
      }
      
      const reservations = selectedVehicleIds.map(vehicleId => ({
        ...formData,
        vehicleId,
      }));
      
      onSave(reservations);
    } else {
      // Mode normal : une seule réservation
      onSave(formData);
    }
  };

  // Handlers pour LocationDialog
  const handleOpenLocationDialog = () => {
    // Si un lieu est déjà sélectionné, le charger pour édition
    const existingLocation = allLocations.find(l => l.name === formData.locationName);
    setEditingLocation(existingLocation || null);
    setIsLocationDialogOpen(true);
  };

  const handleLocationSave = async (locationData) => {
    try {
      // LocationDialog gère maintenant la sauvegarde en interne
      // On reçoit juste l'objet sauvegarder pour mettre à jour la liste locale
      const savedLocation = locationData;
      
      // Mettre à jour la liste des lieux localement
      if (editingLocation) {
        setAllLocations(prev => prev.map(l => l.id === savedLocation.id ? savedLocation : l));
      } else {
        setAllLocations(prev => [...prev, savedLocation]);
      }
      
      // Mettre à jour le formulaire avec le nom du lieu
      setFormData(prev => ({
        ...prev,
        locationName: savedLocation.name
      }));
      
      // Ne PAS fermer le dialog - LocationDialog le gère lui-même
    } catch (error) {
      console.error('Erreur lors de la mise à jour locale:', error);
    }
  };

  const handleLocationDialogClose = () => {
    setIsLocationDialogOpen(false);
    setEditingLocation(null);
  };

  // Filtrer les événements Google qui couvrent la période de réservation
  const getFilteredGoogleEvents = () => {
    if (!formData.date || !formData.endDate) return googleEvents;
    
    const reservationStart = new Date(formData.date);
    const reservationEnd = new Date(formData.endDate);
    
    // Ajouter un jour après la fin de réservation pour inclure les événements adjacents
    const extendedEnd = new Date(reservationEnd);
    extendedEnd.setDate(extendedEnd.getDate() + 1);
    
    return googleEvents.filter(event => {
      const eventStart = event.start?.dateTime 
        ? new Date(event.start.dateTime) 
        : event.start?.date 
          ? new Date(event.start.date) 
          : null;
      
      const eventEnd = event.end?.dateTime 
        ? new Date(event.end.dateTime) 
        : event.end?.date 
          ? new Date(event.end.date) 
          : null;
      
      if (!eventStart || !eventEnd) return false;
      
      // Vérifier si les périodes se chevauchent ou si l'événement est le lendemain
      return eventStart <= extendedEnd && eventEnd >= reservationStart;
    });
  };

  const formatEventOption = (event) => {
    const startDate = event.start?.dateTime 
      ? new Date(event.start.dateTime) 
      : event.start?.date 
        ? new Date(event.start.date) 
        : null;
    
    const endDate = event.end?.dateTime 
      ? new Date(event.end.dateTime) 
      : event.end?.date 
        ? new Date(event.end.date) 
        : null;
    
    const dateRange = startDate && endDate
      ? `${format(startDate, 'dd/MM', { locale: fr })} → ${format(endDate, 'dd/MM', { locale: fr })}`
      : '';
    
    const title = event.summary || '(Sans titre)';
    const affaire = event.affaire ? ` [${event.affaire}]` : '';
    const client = event.detectedClient ? ` • ${event.detectedClient}` : '';
    const location = event.detectedLocation ? ` • ${event.detectedLocation}` : '';
    
    return `${dateRange} | ${title}${affaire}${client}${location}`;
  };

  // Obtenir la couleur de l'événement
  const getEventColor = (event) => {
    const googleColorMap = {
      '1': '#a4bdfc',
      '2': '#7ae7bf',
      '3': '#dbadff',
      '4': '#ff887c',
      '5': '#fbd75b',
      '6': '#ffb878',
      '7': '#46d6db',
      '8': '#e1e1e1',
      '9': '#5484ed',
      '10': '#51b749',
      '11': '#dc2127',
    };
    
    return event.colorId && googleColorMap[event.colorId] 
      ? googleColorMap[event.colorId]
      : '#3b82f6';
  };

  const selectedVehicle = vehicles.find(v => v.id === parseInt(formData.vehicleId));
  const displayDate = formData.date 
    ? format(new Date(formData.date), "EEEE d MMMM yyyy", { locale: fr })
    : '';

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-content">
            <h2 id="modal-title">
              {formData.prestationName || 'Nouvelle réservation'} {formData.isTournee && '🚐'}
            </h2>
            {(formData.date || formData.endDate) && (
              <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.9)', marginTop: '0.25rem' }}>
                {formData.date && format(new Date(formData.date + 'T00:00:00'), 'dd MMMM yyyy', { locale: fr })}
                {formData.endDate && formData.endDate !== formData.date && (
                  <> → {format(new Date(formData.endDate + 'T00:00:00'), 'dd MMMM yyyy', { locale: fr })}</>
                )}
              </div>
            )}
            {formData.affaires.length > 0 && (
              <div className="modal-affaires-badges">
                {formData.affaires.map((affaire, index) => (
                  <span key={index} className="affaire-badge-header">{affaire}</span>
                ))}
              </div>
            )}
          </div>
          <label 
            className="checkbox-label" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.25rem', 
              cursor: 'pointer',
              padding: '0.375rem 0.625rem',
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              whiteSpace: 'nowrap',
              marginLeft: '0.75rem',
              alignSelf: 'flex-start',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}
            title="En mode tournée, les détails (client, conducteur, lieu) seront définis individuellement pour chaque événement lié."
          >
            <input
              type="checkbox"
              checked={formData.isTournee}
              onChange={(e) => setFormData(prev => ({ ...prev, isTournee: e.target.checked }))}
              style={{ margin: 0, cursor: 'pointer' }}
            />
            <span style={{ fontWeight: '500', color: 'rgba(255, 255, 255, 0.95)' }}>🚐 Tournée</span>
          </label>
          <button className="close-button" onClick={onClose} aria-label="Fermer la fenêtre">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {googleEvent && (
            <div className="google-event-badge">
              📅 Lié à : <strong>{googleEvent.summary}</strong>
              {googleEvent.location && <span> - {googleEvent.location}</span>}
            </div>
          )}

          {/* SECTION RÉSERVATION */}
          <div className="form-section">
            <h3 className="section-title">📋 Réservation</h3>

          {isMultiVehicle ? (
            <div className="form-group">
              <label>Véhicules * (Sélectionnez un ou plusieurs véhicules)</label>
              <div className="vehicle-checkboxes">
                {vehicles.map((vehicle) => (
                  <label key={vehicle.id} className="vehicle-checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedVehicleIds.includes(vehicle.id)}
                      onChange={() => handleVehicleToggle(vehicle.id)}
                    />
                    <div
                      className="vehicle-color-indicator"
                      style={{ backgroundColor: vehicle.displayColor || vehicle.color }}
                    />
                    <span>{vehicle.name} - {vehicle.type}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="vehicleId">Véhicule *</label>
                <select
                  id="vehicleId"
                  name="vehicleId"
                  value={formData.vehicleId}
                  onChange={handleChange}
                  required
                  aria-required="true"
                >
                  <option value="">Sélectionner un véhicule</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} - {vehicle.type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="driverName">Conducteur</label>
                <select
                  id="driverName"
                  name="driverName"
                  value={formData.driverName}
                  onChange={handleChange}
                >
                  <option value="">Sélectionner un conducteur</option>
                  {drivers && drivers.map((driver) => (
                    <option key={`driver-${driver.id}`} value={driver.name}>
                      {driver.name}
                    </option>
                  ))}
                  {driverSuggestions.filter(s => !drivers?.some(d => d.name === s)).map((suggestion, idx) => (
                    <option key={`history-${idx}`} value={suggestion}>
                      {suggestion} (historique)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {selectedVehicle && !isMultiVehicle && (
            <div className="vehicle-preview">
              <div
                className="vehicle-color-preview"
                style={{ backgroundColor: selectedVehicle.color }}
              />
              <span>{selectedVehicle.name}</span>
            </div>
          )}

          {isMultiVehicle && selectedVehicleIds.length > 0 && (
            <div className="multi-vehicle-preview">
              <strong>{selectedVehicleIds.length}</strong> véhicule(s) sélectionné(s)
            </div>
          )}

          <div className="form-divider" />

          {/* Champs conditionnels (masqués si tournée) */}
          {!formData.isTournee && (
            <>
              <div className="form-group">
                <label htmlFor="clientName">Client / Prestation</label>
                <input
                  id="clientName"
                  type="text"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleChange}
                  placeholder="Nom du client ou de la prestation"
                  list="clients-autocomplete"
                />
                <datalist id="clients-autocomplete">
                  {clientSuggestions.map((suggestion, idx) => (
                    <option key={idx} value={suggestion} />
                  ))}
                  {clients.map((client) => (
                    <option key={client.id} value={client.name} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label htmlFor="prestationName">Nom de prestation</label>
                <input
                  id="prestationName"
                  type="text"
                  name="prestationName"
                  value={formData.prestationName}
                  onChange={handleChange}
                  placeholder="Nom de la prestation"
                  list="prestations-autocomplete"
                />
                <datalist id="prestations-autocomplete">
                  {prestationSuggestions.map((suggestion, idx) => (
                    <option key={idx} value={suggestion} />
                  ))}
                </datalist>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 'initial', width: 'auto' }}>
                  <label htmlFor="locationName">Lieu</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: '300px' }}>
                      <select
                        id="locationName"
                        name="locationName"
                        value={formData.locationName}
                        onChange={handleChange}
                        style={{ width: '100%' }}
                      >
                        <option value="">Sélectionner un lieu...</option>
                        {allLocations.map((location) => (
                          <option key={location.id} value={location.name}>
                            {location.name} {location.address ? `(${location.address})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenLocationDialog}
                      className="add-location-button"
                      title="Créer ou rechercher un lieu avec Google Maps"
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <MapPin size={16} />
                      Nouveau lieu
                    </button>
                  </div>
                  {formData.locationName && (() => {
                    const location = locations.find(l => l.name === formData.locationName);
                    if (location && location.lat && location.lng) {
                      return (
                        <div className="location-map-preview">
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="map-preview-link"
                          >
                            🗺️ Voir sur Google Maps
                          </a>
                          {location.address && (
                            <span className="location-address">📍 {location.address}</span>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </>
          )}

          {/* Dates et périodes */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="date">Date de début *</label>
              <input
                id="date"
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                aria-required="true"
              />
              {displayDate && (
                <div className="date-display">{displayDate}</div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="period">Période de début *</label>
              <select
                id="period"
                name="period"
                value={formData.period}
                onChange={handleChange}
                required
                aria-required="true"
              >
                <option value="AM">🌅 AM</option>
                <option value="PM">🌆 PM</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="endDate">Date de fin *</label>
              <input
                id="endDate"
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                required
                aria-required="true"
                min={formData.date}
              />
            </div>

            <div className="form-group">
              <label htmlFor="endPeriod">Période de fin *</label>
              <select
                id="endPeriod"
                name="endPeriod"
                value={formData.endPeriod}
                onChange={handleChange}
                required
                aria-required="true"
              >
                <option value="AM">🌅 AM</option>
                <option value="PM">🌆 PM</option>
              </select>
            </div>
          </div>
          </div>
          {/* Fin de la section RÉSERVATION */}

          {/* SECTION ÉVÉNEMENTS LIÉS */}
          <div className="form-divider" />
          <div className="form-section">
            <h3 className="section-title">🔗 Événements liés</h3>

            {!isMultiVehicle && googleEvents.length > 0 && (
              <div className="form-group">
                <label htmlFor="googleEventSelect">Lier à un événement Google (optionnel)</label>
                <div className="custom-dropdown">
                  <div 
                    className="custom-dropdown-trigger"
                    onClick={() => setIsEventDropdownOpen(!isEventDropdownOpen)}
                  >
                    {formData.isTournee ? (
                      // Mode tournée : afficher tous les événements liés
                      formData.linkedEventIds.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
                          {formData.linkedEventIds.map(eventId => {
                            const event = googleEvents.find(e => e.id === eventId);
                            if (!event) return null;
                            
                            const startDate = event.start?.dateTime 
                              ? new Date(event.start.dateTime) 
                              : event.start?.date 
                                ? new Date(event.start.date) 
                                : null;
                            
                            const dateRange = startDate ? format(startDate, 'dd/MM', { locale: fr }) : '';
                            
                            return (
                              <div 
                                key={eventId} 
                                className="selected-event-display clickable-event" 
                                style={{ backgroundColor: getEventColor(event) + '20', padding: '0.25rem 0.5rem', cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onRequestViewEvent) {
                                    onRequestViewEvent(event);
                                    onClose(); // Fermer le modal de réservation
                                  }
                                }}
                                title="Cliquer pour voir l'événement"
                              >
                                <span className="event-dates" style={{ fontSize: '0.7rem' }}>{dateRange}</span>
                                {event.affaire && <span className="event-affaire" style={{ fontSize: '0.7rem' }}>{event.affaire}</span>}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="placeholder">Aucun événement sélectionné</span>
                      )
                    ) : (
                      // Mode normal : un seul événement
                      formData.googleEventId ? (
                        (() => {
                          const event = googleEvents.find(e => e.id === formData.googleEventId);
                          if (!event) return <span className="placeholder">Aucun événement</span>;
                          
                          const startDate = event.start?.dateTime 
                            ? new Date(event.start.dateTime) 
                            : event.start?.date 
                              ? new Date(event.start.date) 
                              : null;
                          
                          const endDate = event.end?.dateTime 
                            ? new Date(event.end.dateTime) 
                            : event.end?.date 
                              ? new Date(event.end.date) 
                              : null;
                          
                          const dateRange = startDate && endDate
                            ? `${format(startDate, 'dd/MM', { locale: fr })} → ${format(endDate, 'dd/MM', { locale: fr })}`
                            : '';
                          
                          let cleanTitle = event.summary || '(Sans titre)';
                          if (event.affaire) {
                            cleanTitle = cleanTitle.replace(/\baf\s*\d+\b/gi, '').trim();
                            cleanTitle = cleanTitle.replace(/\s+/g, ' ').replace(/^\s*-\s*|\s*-\s*$/g, '').trim();
                          }
                          if (!cleanTitle) cleanTitle = '(Sans titre)';
                          
                          return (
                            <div 
                              className="selected-event-display clickable-event" 
                              style={{ backgroundColor: getEventColor(event) + '20', cursor: 'pointer' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onRequestViewEvent) {
                                  onRequestViewEvent(event);
                                  onClose(); // Fermer le modal de réservation
                                }
                              }}
                              title="Cliquer pour voir l'événement"
                            >
                              <span className="event-dates">{dateRange}</span>
                              <span className="event-title">{cleanTitle}</span>
                              {event.affaire && <span className="event-affaire">{event.affaire}</span>}
                            </div>
                          );
                        })()
                      ) : (
                        <span className="placeholder">Aucun événement</span>
                      )
                    )}
                    <span className="dropdown-arrow">▼</span>
                  </div>
                  
                  {isEventDropdownOpen && (
                    <div className="custom-dropdown-menu">
                      <div 
                        className="custom-dropdown-item"
                        onClick={() => selectGoogleEvent(null)}
                      >
                        <span className="event-dates">—</span>
                        <span className="event-title">Aucun événement</span>
                      </div>
                      
                      <div className="dropdown-header">
                        <span className="header-dates">Dates</span>
                        <span className="header-title">Titre</span>
                        <span className="header-affaire">Affaire</span>
                      </div>
                      
                      {getFilteredGoogleEvents().map((event) => {
                        const startDate = event.start?.dateTime 
                          ? new Date(event.start.dateTime) 
                          : event.start?.date 
                            ? new Date(event.start.date) 
                            : null;
                        
                        const endDate = event.end?.dateTime 
                          ? new Date(event.end.dateTime) 
                          : event.end?.date 
                            ? new Date(event.end.date) 
                            : null;
                        
                        const dateRange = startDate && endDate
                          ? `${format(startDate, 'dd/MM', { locale: fr })} → ${format(endDate, 'dd/MM', { locale: fr })}`
                          : '';
                        
                        // Nettoyer le titre en retirant le numéro d'affaire
                        let cleanTitle = event.summary || '(Sans titre)';
                        if (event.affaire) {
                          // Retirer toutes les occurrences du pattern "af XXXXX" ou "af XXXXX" (case insensitive)
                          cleanTitle = cleanTitle.replace(/\baf\s*\d+\b/gi, '').trim();
                          // Nettoyer les espaces multiples et les tirets orphelins
                          cleanTitle = cleanTitle.replace(/\s+/g, ' ').replace(/^\s*-\s*|\s*-\s*$/g, '').trim();
                        }
                        if (!cleanTitle) cleanTitle = '(Sans titre)';
                        
                        const isEventLinked = formData.linkedEventIds.includes(event.id);
                        
                        return (
                          <div 
                            key={event.id}
                            className={`custom-dropdown-item ${isEventLinked ? 'affaire-added' : ''}`}
                            onClick={() => selectGoogleEvent(event)}
                            style={{ backgroundColor: getEventColor(event) + '20' }}
                          >
                            <span className="event-dates">{dateRange}</span>
                            <span className="event-title">
                              {isEventLinked && '✓ '}
                              {cleanTitle}
                            </span>
                            <span className="event-affaire">{event.affaire || '—'}</span>
                          </div>
                        );
                      })}
                      
                      <div className="dropdown-footer">
                        <button 
                          type="button"
                          className="dropdown-close-button"
                          onClick={() => setIsEventDropdownOpen(false)}
                        >
                          Terminé
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {formData.isTournee && formData.linkedEventIds.length > 0 && (
              <div className="linked-events-display" style={{ 
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ 
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  color: '#374151',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>🗓️ Événements liés à cette tournée</span>
                  <span style={{ 
                    fontWeight: 'normal',
                    color: '#6b7280',
                    fontSize: '0.8rem'
                  }}>({formData.linkedEventIds.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {formData.linkedEventIds
                    .map(eventId => {
                      const event = googleEvents.find(e => e.id === eventId);
                      if (!event) return null;
                      
                      const startDate = event.start?.dateTime 
                        ? new Date(event.start.dateTime) 
                        : event.start?.date 
                          ? new Date(event.start.date) 
                          : null;
                      
                      const endDate = event.end?.dateTime 
                        ? new Date(event.end.dateTime) 
                        : event.end?.date 
                          ? new Date(event.end.date) 
                          : null;
                      
                      const dateRange = startDate && endDate
                        ? `${format(startDate, 'dd/MM/yy', { locale: fr })} → ${format(endDate, 'dd/MM/yy', { locale: fr })}`
                        : startDate
                          ? format(startDate, 'dd/MM/yy', { locale: fr })
                          : '';
                      
                      let cleanTitle = event.summary || '(Sans titre)';
                      if (event.affaire) {
                        cleanTitle = cleanTitle.replace(/\baf\s*\d+\b/gi, '').trim();
                        cleanTitle = cleanTitle.replace(/\s+/g, ' ').replace(/^\s*-\s*|\s*-\s*$/g, '').trim();
                      }
                      if (!cleanTitle) cleanTitle = '(Sans titre)';
                      
                      return {
                        eventId,
                        event,
                        startDate,
                        dateRange,
                        cleanTitle
                      };
                    })
                    .filter(item => item !== null)
                    .sort((a, b) => {
                      if (!a.startDate) return 1;
                      if (!b.startDate) return -1;
                      return a.startDate - b.startDate;
                    })
                    .map(({ eventId, event, dateRange, cleanTitle }, eventIndex) => {
                      // Vérifier si les détails du trajet sont enregistrés
                      const hasTripDetails = !!tripDetails[event.id];
                      
                      return (
                        <div 
                          key={eventId}
                          className="event-card-with-trip"
                          style={{ 
                            backgroundColor: hasTripDetails ? '#ecfdf5' : getEventColor(event) + '20',
                            padding: '0.75rem',
                            borderRadius: '0.375rem',
                            border: hasTripDetails ? '2px solid #10b981' : '1px solid ' + getEventColor(event) + '40',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.375rem',
                            transition: 'all 0.2s ease'
                          }}
                        >
                      );
                        <div 
                          className="clickable-event"
                          style={{ 
                            cursor: 'pointer',
                            flex: 1
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onRequestViewEvent) {
                              onRequestViewEvent(event);
                              onClose();
                            }
                          }}
                          title="Cliquer pour voir l'événement"
                        >
                          <div style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            marginBottom: '0.375rem'
                          }}>
                            <span style={{ 
                              fontSize: '0.75rem',
                              color: '#6b7280',
                              fontWeight: '500'
                            }}>
                              📅 {dateRange}
                            </span>
                            {event.affaire && (
                              <span style={{ 
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                color: '#6366f1',
                                backgroundColor: '#eef2ff',
                                padding: '0.125rem 0.5rem',
                                borderRadius: '0.25rem'
                              }}>
                                {event.affaire}
                              </span>
                            )}
                          </div>
                          <div style={{ 
                            fontSize: '0.875rem',
                            color: '#111827',
                            fontWeight: '500',
                            marginBottom: '0.375rem'
                          }}>
                            {cleanTitle}
                          </div>
                          {event.location && (
                            <div style={{ 
                              fontSize: '0.75rem',
                              color: '#6b7280',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
                              📍 {event.location}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="trip-details-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTripDetails(event, eventIndex);
                          }}
                        >
                          <MapPin size={16} />
                          Détails du trajet
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {/* Fin de la section ÉVÉNEMENTS LIÉS */}

          {/* SECTION NOTES */}
          <div className="form-divider" />
          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Notes supplémentaires..."
              rows="3"
            />
          </div>

          <div className="modal-actions">
            {isEdit && (
              <button
                type="button"
                className="delete-button"
                onClick={onDelete}
              >
                <Trash2 size={18} />
                Supprimer
              </button>
            )}
            <button type="button" className="cancel-button" onClick={onClose}>
              Annuler
            </button>
            {!isEdit && (
              <button type="submit" className="submit-button">
                {currentUser?.isAdmin ? 'Créer' : 'Demander'}
              </button>
            )}
            {isEdit && (hasChanges || formData.isTournee) && (
              <button type="submit" className="submit-button">
                Valider les modifications
              </button>
            )}
          </div>
        </form>
      </div>

      {selectedEventForTrip && (() => {
        console.log('📝 ReservationModal: Ouverture TripDetails, companyAddress:', companyAddress);
        console.log('📝 ReservationModal: allLocations à transmettre:', allLocations.length, allLocations.map(l => l.name));
        const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);
        return (
          <TripDetailsModal
            event={selectedEventForTrip.event}
            tripDetail={tripDetails[selectedEventForTrip.event.id]}
            onSave={handleSaveTripDetails}
            onClose={() => setSelectedEventForTrip(null)}
            drivers={drivers}
            vehicle={selectedVehicle}
            nextEvent={(() => {
              const eventIds = formData.linkedEventIds || [];
              const currentIdx = selectedEventForTrip.eventIndex;
              return currentIdx < eventIds.length - 1 ? eventIds[currentIdx + 1] : null;
            })()}
            googleMapsApiKey={googleMapsApiKey}
            companyAddress={companyAddress}
            initialLocations={allLocations}
          />
        );
      })()}

      {isLocationDialogOpen && (
        <LocationDialog
          location={editingLocation}
          onSave={handleLocationSave}
          onClose={handleLocationDialogClose}
          companyAddress={companyAddress}
        />
      )}
    </div>
  );
};

export default ReservationModal;
