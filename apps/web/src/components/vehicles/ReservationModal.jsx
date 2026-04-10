import React, { useState, useEffect, lazy, Suspense } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Trash2, MapPin, Link2, Unlink, Paperclip } from 'lucide-react';
import { Button, Dialog, FormField, Input, Textarea, Select, Checkbox, SectionHeader } from '@/design-system';
import { useAutocomplete } from '../../hooks/useAutocomplete';

import TripDetailsModal from './TripDetailsModal';
import LocationDialog from './LocationDialog';
import VehiclePickerCards from './VehiclePickerCards';
import DriverSelect from './DriverSelect';
import api from '../../utils/api';
import AffaireBadge from '../AffaireBadge';
import { loadFromIndexedDB } from '../../utils/indexedDB';
import './ReservationModal.css';
import { useToast } from '../../hooks/useToast';
import { useDirtyForm } from '../../hooks/useDirtyForm';

import { STATUS } from '../../constants';

const ReservationEquipment = lazy(() => import('./ReservationEquipment'));

const ReservationModal = ({
  slot,
  reservation,
  vehicles,
  clients,
  drivers,
  persons = [],
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
  
  // Mode lecture seule : non-admin qui consulte une réservation existante
  const isReadOnly = isEdit && !currentUser?.isAdmin;
  
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

  const toast = useToast();

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

  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const { isDirty } = useDirtyForm(formData);

  // Fermeture sécurisée avec avertissement si modifications
  const handleSafeClose = () => {
    // En mode création, vérifier si des champs ont été remplis
    if (!isEdit) {
      const hasContent = formData.clientName || formData.driverName || formData.locationName || formData.prestationName || formData.notes || formData.affaires.length > 0;
      if (hasContent) {
        setShowUnsavedWarning(true);
        return;
      }
    } else if (isDirty) {
      setShowUnsavedWarning(true);
      return;
    }
    onClose();
  };

  // Ref pour le champ lieu (autocomplétion custom sur les lieux enregistrés)
  const locationInputRef = React.useRef(null);

  // Hooks pour l'autocomplétion
  const { suggestions: clientSuggestions, addToHistory: addClient } = useAutocomplete('clients');
  const { suggestions: driverSuggestions, addToHistory: addDriver } = useAutocomplete('drivers');
  const { suggestions: _locationSuggestions, addToHistory: addLocation } = useAutocomplete('locations');
  const { suggestions: prestationSuggestions, addToHistory: addPrestation } = useAutocomplete('prestations');
  const { suggestions: _affaireSuggestions, addToHistory: addAffaire } = useAutocomplete('affaires');

  // États pour TripDetailsModal
  const [selectedEventForTrip, setSelectedEventForTrip] = useState(null);
  const [selectedEventsForCombinedTrip, setSelectedEventsForCombinedTrip] = useState(null);
  const [tripDetails, setTripDetails] = useState({});
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  
  // État pour la liaison de trajets
  const [linkEventComboboxOpen, setLinkEventComboboxOpen] = useState(null); // eventId source ou null
  
  // Index des affaires ayant des pièces jointes
  const [affairesWithAttachments, setAffairesWithAttachments] = useState([]);
  const [attachmentCounts, setAttachmentCounts] = useState({});
  
  // État pour LocationDialog
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  
  // État pour l'adresse du siège
  const [companyAddress, setCompanyAddress] = useState('');
  const [allLocations, setAllLocations] = useState(locations);

  // État pour l'autocomplétion lieu custom (sans accents)
  const [locationSearch, setLocationSearch] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationTypeFilter, setLocationTypeFilter] = useState('');
  const locationDropdownRef = React.useRef(null);

  const normalize = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Types uniques extraits des lieux
  const locationTypes = React.useMemo(() => {
    const types = new Set();
    allLocations.forEach(l => { if (l.type) types.add(l.type); });
    return [...types].sort();
  }, [allLocations]);

  // Conducteurs qualifiés (personnel avec compétence de conduite adaptée au véhicule)
  const qualifiedDrivers = React.useMemo(() => {
    if (!persons || persons.length === 0) return [];
    const selectedVehicle = vehicles?.find(v => v.id === formData.vehicleId);
    const vehicleType = selectedVehicle?.type?.toUpperCase() || '';
    
    // Déterminer la compétence requise
    let requiredSkill = 'Conduite VL'; // par défaut
    if (['PL', 'CAMION', 'PORTEUR', 'PORTEUR MOYEN', 'TRACTEUR'].some(t => vehicleType.includes(t))) {
      requiredSkill = 'Conduite PL';
    } else if (['SPL', 'SEMI', 'SEMI-REMORQUE'].some(t => vehicleType.includes(t))) {
      requiredSkill = 'Conduite SPL';
    }
    
    // Filtrer les personnes avec la compétence requise + celles avec compétence supérieure
    const skillHierarchy = ['Conduite VL', 'Conduite PL', 'Conduite SPL'];
    const requiredLevel = skillHierarchy.indexOf(requiredSkill);
    
    return persons
      .filter(p => p.status === STATUS.ACTIVE && p.skills?.some(s => {
        const sLevel = skillHierarchy.indexOf(s.name);
        return sLevel >= 0 && sLevel >= requiredLevel;
      }))
      .map(p => ({
        id: p.id,
        name: `${p.firstName || p.first_name || ''} ${p.lastName || p.last_name || ''}`.trim() || `Personnel #${p.id}`,
        photo: p.photo || null,
        skills: p.skills?.filter(s => s.category === 'conduite').map(s => s.name) || []
      }));
  }, [persons, vehicles, formData.vehicleId]);

  const filteredLocations = React.useMemo(() => {
    let result = allLocations;
    if (locationTypeFilter) {
      result = result.filter(l => l.type === locationTypeFilter);
    }
    if (locationSearch) {
      const search = normalize(locationSearch);
      result = result.filter(l =>
        normalize(l.name).includes(search) ||
        (l.address && normalize(l.address).includes(search))
      );
    }
    return result;
  }, [locationSearch, locationTypeFilter, allLocations]);

  // Fermer le dropdown lieu quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        locationDropdownRef.current && !locationDropdownRef.current.contains(e.target) &&
        locationInputRef.current && !locationInputRef.current.contains(e.target)
      ) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Charger l'adresse du siège et créer la liste complète des lieux
  useEffect(() => {
    const fetchCompanyAddress = async () => {
      try {
        
        // Charger depuis IndexedDB au lieu de l'API
        const config = await loadFromIndexedDB('calendarConfig', {});
        const address = config.companyAddress || '';
        
        setCompanyAddress(address);
        
        // Créer un lieu virtuel pour le siège si une adresse existe
        if (address) {
          // Vérifier si le siège n'est pas déjà dans la liste
          const hasCompanyHQ = locations.some(l => l.id === 'company-hq' || l.id === 'mag-scene');
          
          if (!hasCompanyHQ) {
            const companyLocation = {
              id: 'company-hq',
              name: 'Siège',
              address: address,
              type: 'Dépôt'
            };
            setAllLocations([companyLocation, ...locations]);
          } else {
            setAllLocations(locations);
          }
        } else {
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
        const config = await loadFromIndexedDB('calendarConfig', {});
        const apiKey = config.googleMapsApiKey || '';
        setGoogleMapsApiKey(apiKey);
      } catch (error) {
        console.error('Erreur lors du chargement de la clé API Google Maps:', error);
      }
    };
    
    fetchGoogleMapsApiKey();
  }, []);

  // Charger l'index des pièces jointes
  useEffect(() => {
    const loadAttachmentsIndex = async () => {
      try {
        const data = await api.getAttachmentsIndex();
        setAffairesWithAttachments(data.affaires || []);
        setAttachmentCounts(data.counts || {});
      } catch (e) {
        // silencieux
      }
    };
    loadAttachmentsIndex();
  }, []);

  // Charger les détails de trajet existants lors de l'édition
  useEffect(() => {
    const loadTripDetails = async () => {
      if (isEdit && reservation?.id) {
        try {
          const details = await api.getTripDetails(reservation.id);
          if (details) {
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
                returnDuration: detail.return_duration,
                tripGroupId: detail.trip_group_id
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const _handleGoogleEventSelect = (e) => {
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
      if (!reservation?.id) {
        toast.warning('Vous devez d\'abord enregistrer la réservation avant d\'ajouter des détails du trajet');
        return null;
      }
      
      const savedData = await api.saveTripDetails({
        reservationId: reservation?.id,
        eventId: selectedEventForTrip.event.id,
        eventOrder: selectedEventForTrip.eventIndex,
        ...tripData
      });
      
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
        returnDuration: savedData.return_duration,
        tripGroupId: savedData.trip_group_id
      };
      
      // Mettre à jour l'état local avec les données transformées
      setTripDetails(prev => {
        const updated = {
          ...prev,
          [selectedEventForTrip.event.id]: transformedData
        };
        return updated;
      });
      
      toast.success('Détails du trajet enregistrés avec succès !');
      
      // Retourner les données sauvegardées (déjà en snake_case pour TripDetailsModal)
      return savedData;
      
    } catch (error) {
      console.error('Erreur sauvegarde trip details:', error);
      toast.error(`Erreur technique: ${error.message}`);
      return null;
    }
  };

  // Helper: convertir les trip_details snake_case en camelCase
  const transformTripDetail = (detail) => ({
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
    returnDuration: detail.return_duration,
    tripGroupId: detail.trip_group_id
  });

  // Lier deux événements (leurs trajets partagent le même groupe)
  const handleLinkTrips = async (eventId1, eventId2) => {
    if (!reservation?.id) {
      toast.warning('Vous devez d\'abord enregistrer la réservation');
      return;
    }
    
    try {
      const data = await api.linkTrips({
        reservationId: reservation.id,
        eventId1,
        eventId2
      });
      // Mettre à jour tripDetails avec les données retournées
      const detailsMap = {};
      data.tripDetails.forEach(detail => {
        detailsMap[detail.event_id] = transformTripDetail(detail);
      });
      setTripDetails(detailsMap);
    } catch (error) {
      console.error('Erreur liaison trajets:', error);
    }
  };

  // Délier un événement de son groupe
  const handleUnlinkTrip = async (eventId) => {
    if (!reservation?.id) return;
    
    try {
      const data = await api.unlinkTrip({
        reservationId: reservation.id,
        eventId
      });
      const detailsMap = {};
      data.tripDetails.forEach(detail => {
        detailsMap[detail.event_id] = transformTripDetail(detail);
      });
      setTripDetails(detailsMap);
    } catch (error) {
      console.error('Erreur déliaison trajet:', error);
    }
  };

  // Lier un événement du banner (et l'ajouter à la tournée si nécessaire)
  const handleLinkBannerEvent = async (sourceEventId, targetEvent) => {
    // Vérifier si l'événement cible est déjà dans la tournée
    if (!formData.linkedEventIds.includes(targetEvent.id)) {
      // L'ajouter à la tournée
      setFormData(prev => {
        const newLinkedEventIds = [...prev.linkedEventIds, targetEvent.id];
        const newAffaires = [...prev.affaires];
        if (targetEvent.affaire && !newAffaires.includes(targetEvent.affaire)) {
          newAffaires.push(targetEvent.affaire);
        }
        return {
          ...prev,
          linkedEventIds: newLinkedEventIds,
          affaires: newAffaires,
          isTournee: true
        };
      });
    }
    
    // Puis lier les trajets
    if (reservation?.id) {
      await handleLinkTrips(sourceEventId, targetEvent.id);
    }
    setLinkEventComboboxOpen(null);
  };

  // Obtenir les groupes de trajets liés
  const getTripGroups = () => {
    const groups = {};
    const ungrouped = [];
    
    const sortedEventIds = formData.linkedEventIds
      .map(eventId => {
        const event = googleEvents.find(e => e.id === eventId);
        if (!event) return null;
        const startDate = event.start?.dateTime 
          ? new Date(event.start.dateTime) 
          : event.start?.date 
            ? new Date(event.start.date) 
            : null;
        return { eventId, event, startDate };
      })
      .filter(item => item !== null)
      .sort((a, b) => {
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return a.startDate - b.startDate;
      });
    
    sortedEventIds.forEach(item => {
      const td = tripDetails[item.eventId];
      const groupId = td?.tripGroupId || td?.trip_group_id;
      
      if (groupId) {
        if (!groups[groupId]) groups[groupId] = [];
        groups[groupId].push(item);
      } else {
        ungrouped.push(item);
      }
    });
    
    return { groups, ungrouped, sortedEventIds };
  };

  // Ouvrir le modal de trajet combiné pour un groupe
  const handleOpenCombinedTripDetails = (groupEventItems) => {
    setSelectedEventsForCombinedTrip(groupEventItems.map((item, _index) => ({
      event: item.event,
      eventIndex: formData.linkedEventIds.indexOf(item.eventId)
    })));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Bloquer la soumission en mode lecture seule
    if (isReadOnly) return;
    
    // Ajouter les valeurs à l'historique d'autocomplétion
    if (formData.clientName) addClient(formData.clientName);
    if (formData.driverName) addDriver(formData.driverName);
    if (formData.locationName) addLocation(formData.locationName);
    if (formData.prestationName) addPrestation(formData.prestationName);
    formData.affaires.forEach(affaire => addAffaire(affaire));
    
    if (isMultiVehicle) {
      // Mode multi-véhicules : créer une réservation par véhicule sélectionné
      if (selectedVehicleIds.length === 0) {
        toast.warning('Veuillez sélectionner au moins un véhicule');
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

  const _formatEventOption = (event) => {
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

  const _selectedVehicle = vehicles.find(v => v.id === parseInt(formData.vehicleId));
  const displayDate = formData.date 
    ? format(new Date(formData.date), "EEEE d MMMM yyyy", { locale: fr })
    : '';

  return (
    <div className="reservation-overlay" onMouseDown={(e) => e.target === e.currentTarget && handleSafeClose()} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content reservation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-content">
            <h2 id="modal-title">
              {isReadOnly ? '📋 Détails de la réservation' : (formData.prestationName || (currentUser?.isAdmin ? 'Nouvelle réservation' : 'Nouvelle demande'))} {formData.isTournee && '🚐'}
            </h2>
            {(formData.date || formData.endDate) && (
              <div className="reservation-header-subtitle">
                {formData.date && format(new Date(formData.date + 'T00:00:00'), 'dd MMMM yyyy', { locale: fr })}
                {formData.endDate && formData.endDate !== formData.date && (
                  <> → {format(new Date(formData.endDate + 'T00:00:00'), 'dd MMMM yyyy', { locale: fr })}</>
                )}
              </div>
            )}
            {formData.affaires.length > 0 && (
              <div className="modal-affaires-badges">
                {formData.affaires.map((affaire, index) => (
                  <AffaireBadge key={index} numero={affaire} size="sm" className="inverted" />
                ))}
              </div>
            )}
          </div>
          <label 
            className="checkbox-label reservation-tournee-toggle" 
            title="En mode tournée, les détails (client, conducteur, lieu) seront définis individuellement pour chaque événement lié."
          >
            <Checkbox
              checked={formData.isTournee}
              onChange={(e) => setFormData(prev => ({ ...prev, isTournee: e.target.checked }))}
              style={{ margin: 0, cursor: isReadOnly ? 'default' : 'pointer' }}
              disabled={isReadOnly}
            />
            <span className="reservation-tournee-label">🚐 Tournée</span>
          </label>
          <Button variant="ghost" className="close-button" onClick={handleSafeClose} aria-label="Fermer la fenêtre">
            <X size={24} />
          </Button>
        </div>

        <form id="reservation-form" onSubmit={handleSubmit} className="modal-form">
          <fieldset disabled={isReadOnly} className="reservation-fieldset">
          {googleEvent && (
            <div className="google-event-badge">
              📅 Lié à : <strong>{googleEvent.summary}</strong>
              {googleEvent.location && <span> - {googleEvent.location}</span>}
            </div>
          )}

          {/* SECTION RÉSERVATION */}
          <div className="form-section">
            <SectionHeader title="📋 Réservation" className="section-title" />

          {isMultiVehicle ? (
            <FormField className="form-group" label="Véhicules * (Sélectionnez un ou plusieurs véhicules)">
              <VehiclePickerCards
                vehicles={vehicles}
                selectedIds={selectedVehicleIds}
                onSelect={(id) => !isReadOnly && handleVehicleToggle(id)}
                multiple
                disabled={isReadOnly}
                variant="desktop"
              />
              {selectedVehicleIds.length > 0 && (
                <div className="multi-vehicle-preview">
                  <strong>{selectedVehicleIds.length}</strong> véhicule(s) sélectionné(s)
                </div>
              )}
            </FormField>
          ) : (
            <>
            <FormField className="form-group" label="Véhicule" htmlFor="vehicleId" required>
              <VehiclePickerCards
                vehicles={vehicles}
                selectedId={formData.vehicleId}
                onSelect={(id) => !isReadOnly && handleChange({ target: { name: 'vehicleId', value: id } })}
                disabled={isReadOnly}
                variant="desktop"
              />
            </FormField>

            <FormField className="form-group" label="Conducteur" htmlFor="driverName">
              <DriverSelect
                value={formData.driverName}
                onChange={(name) => handleChange({ target: { name: 'driverName', value: name } })}
                qualifiedDrivers={qualifiedDrivers}
                historySuggestions={driverSuggestions}
                disabled={isReadOnly}
              />
            </FormField>
            </>
          )}

          {/* Champs conditionnels (masqués si tournée) */}
          {!formData.isTournee && (
            <>
              <FormField className="form-group" label="Client / Prestation" htmlFor="clientName">
                <Input
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
              </FormField>

              <FormField className="form-group" label="Nom de prestation" htmlFor="prestationName">
                <Input
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
              </FormField>

              <div className="form-row">
                <FormField className="form-group" label="Lieu" htmlFor="locationName" style={{ flex: 'initial', width: 'auto' }}>
                  {/* Filtre par type de lieu */}
                  {locationTypes.length > 1 && (
                    <div className="reservation-location-filter-wrap">
                      <Select
                        value={locationTypeFilter}
                        onChange={(e) => setLocationTypeFilter(e.target.value)}
                        className="reservation-location-filter-select"
                      >
                        <option value="">Tous les types</option>
                        {locationTypes.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </Select>
                    </div>
                  )}
                  <div className="reservation-location-row">
                    <div className="reservation-location-search-wrap">
                      <Input
                        ref={locationInputRef}
                        id="locationName"
                        type="text"
                        name="locationName"
                        value={showLocationDropdown ? locationSearch : formData.locationName}
                        onChange={(e) => {
                          setLocationSearch(e.target.value);
                          setShowLocationDropdown(true);
                          setFormData(prev => ({ ...prev, locationName: e.target.value }));
                        }}
                        onFocus={() => {
                          setLocationSearch(formData.locationName || '');
                          setShowLocationDropdown(true);
                        }}
                        placeholder="Rechercher un lieu..."
                        autoComplete="off"
                        className="reservation-location-input-full"
                      />
                      {showLocationDropdown && filteredLocations.length > 0 && (
                        <div
                          ref={locationDropdownRef}
                          className="reservation-location-dropdown"
                        >
                          {filteredLocations.map((location) => (
                            <div
                              key={location.id}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, locationName: location.name }));
                                setLocationSearch('');
                                setShowLocationDropdown(false);
                              }}
                              className="reservation-location-item"
                            >
                              <div className="reservation-location-item-name">{location.name}</div>
                              {location.address && (
                                <div className="reservation-location-item-address">{location.address}</div>
                              )}
                              {location.type && (
                                <div className="reservation-location-item-type">{location.type}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost"                       type="button"
                      onClick={handleOpenLocationDialog}
                      className="add-location-button reservation-add-location-btn"
                      title="Créer ou rechercher un lieu avec Google Maps"
                    >
                      <MapPin size={16} />
                      Nouveau lieu
                    </Button>
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
                </FormField>
              </div>
            </>
          )}

          {/* Dates et périodes */}
          <div className="form-row">
            <FormField className="form-group" label="Date de début" htmlFor="date" required>
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
            </FormField>

            <FormField className="form-group" label="Période de début" htmlFor="period" required>
              <Select
                id="period"
                name="period"
                value={formData.period}
                onChange={handleChange}
                required
                aria-required="true"
              >
                <option value="AM">🌅 AM</option>
                <option value="PM">🌆 PM</option>
              </Select>
            </FormField>
          </div>

          <div className="form-row">
            <FormField className="form-group" label="Date de fin" htmlFor="endDate" required>
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
            </FormField>

            <FormField className="form-group" label="Période de fin" htmlFor="endPeriod" required>
              <Select
                id="endPeriod"
                name="endPeriod"
                value={formData.endPeriod}
                onChange={handleChange}
                required
                aria-required="true"
              >
                <option value="AM">🌅 AM</option>
                <option value="PM">🌆 PM</option>
              </Select>
            </FormField>
          </div>
          </div>
          {/* Fin de la section RÉSERVATION */}

          {/* SECTION ÉVÉNEMENTS LIÉS */}
          <div className="form-section">
            <SectionHeader title="🔗 Événements liés" className="section-title" />

            {!isMultiVehicle && googleEvents.length > 0 && (
              <FormField className="form-group" label="Lier à un événement Google (optionnel)" htmlFor="googleEventSelect">
                <div className="custom-dropdown">
                  <div 
                    className="custom-dropdown-trigger"
                    onClick={() => setIsEventDropdownOpen(!isEventDropdownOpen)}
                  >
                    {formData.isTournee ? (
                      // Mode tournée : afficher tous les événements liés
                      formData.linkedEventIds.length > 0 ? (
                        <div className="reservation-tournee-events">
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
                                <span className="event-dates reservation-event-date-xs">{dateRange}</span>
                                {event.affaire && <span className="event-affaire reservation-event-date-xs">{event.affaire}</span>}
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
                        <Button variant="ghost" 
                          type="button"
                          className="dropdown-close-button"
                          onClick={() => setIsEventDropdownOpen(false)}
                        >
                          Terminé
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </FormField>
            )}

            {formData.isTournee && formData.linkedEventIds.length > 0 && (() => {
              const { _groups, _ungrouped, sortedEventIds } = getTripGroups();
              
              // Préparer les données enrichies pour chaque event
              const enrichedEvents = sortedEventIds.map((item, idx) => {
                const { eventId, event, startDate } = item;
                const endDate = event.end?.dateTime 
                  ? new Date(event.end.dateTime) 
                  : event.end?.date ? new Date(event.end.date) : null;
                
                const dateRange = startDate && endDate
                  ? `${format(startDate, 'dd/MM/yy', { locale: fr })} → ${format(endDate, 'dd/MM/yy', { locale: fr })}`
                  : startDate ? format(startDate, 'dd/MM/yy', { locale: fr }) : '';
                
                let cleanTitle = event.summary || '(Sans titre)';
                if (event.affaire) {
                  cleanTitle = cleanTitle.replace(/\baf\s*\d+\b/gi, '').trim();
                  cleanTitle = cleanTitle.replace(/\s+/g, ' ').replace(/^\s*-\s*|\s*-\s*$/g, '').trim();
                }
                if (!cleanTitle) cleanTitle = '(Sans titre)';
                
                const td = tripDetails[eventId];
                const groupId = td?.tripGroupId || td?.trip_group_id;
                
                return { ...item, dateRange, cleanTitle, groupId, originalIndex: idx };
              });
              
              // Construire les segments : chaque segment est soit un groupe, soit un item solo
              const segments = [];
              let currentGroupId = null;
              let currentGroupItems = [];
              
              enrichedEvents.forEach((item, _idx) => {
                if (item.groupId) {
                  if (item.groupId === currentGroupId) {
                    currentGroupItems.push(item);
                  } else {
                    // Terminer le groupe précédent
                    if (currentGroupId && currentGroupItems.length > 0) {
                      segments.push({ type: 'group', groupId: currentGroupId, items: currentGroupItems });
                    }
                    currentGroupId = item.groupId;
                    currentGroupItems = [item];
                  }
                } else {
                  // Terminer le groupe précédent si nécessaire
                  if (currentGroupId && currentGroupItems.length > 0) {
                    segments.push({ type: 'group', groupId: currentGroupId, items: currentGroupItems });
                    currentGroupId = null;
                    currentGroupItems = [];
                  }
                  segments.push({ type: 'solo', items: [item] });
                }
              });
              // Terminer le dernier groupe
              if (currentGroupId && currentGroupItems.length > 0) {
                segments.push({ type: 'group', groupId: currentGroupId, items: currentGroupItems });
              }
              
              // Fonction pour rendre une event card
              const renderEventCard = (item, isInGroup = false) => {
                const { eventId, event, dateRange, cleanTitle, originalIndex } = item;
                const hasTripDetails = !!tripDetails[event.id];
                
                return (
                  <div 
                    key={eventId}
                    className={`event-card-with-trip ${isInGroup ? 'in-group' : ''}`}
                    style={{ 
                      backgroundColor: hasTripDetails ? 'var(--theme-success-bg)' : getEventColor(event) + '20',
                      padding: '0.75rem',
                      borderRadius: isInGroup ? '0' : '0.375rem',
                      border: hasTripDetails ? '2px solid #10b981' : '1px solid ' + getEventColor(event) + '40',
                      borderBottom: isInGroup ? 'none' : undefined,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.375rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div 
                      className="clickable-event reservation-event-clickable"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onRequestViewEvent) {
                          onRequestViewEvent(event);
                          onClose();
                        }
                      }}
                      title="Cliquer pour voir l'événement"
                    >
                      <div className="reservation-event-header">
                        <span className="reservation-event-date-badge">
                          📅 {dateRange}
                        </span>
                        {event.affaire && (
                          <span className="reservation-event-affaire-badge">
                            {affairesWithAttachments.includes(event.affaire) && (
                              <Paperclip size={11} className="u-opacity-70" title={`${attachmentCounts[event.affaire] || ''} pièce(s) jointe(s)`} />
                            )}
                            {affairesWithAttachments.includes(event.affaire) && attachmentCounts[event.affaire] && (
                              <span className="u-opacity-70" style={{ fontSize: '0.6rem' }}>{attachmentCounts[event.affaire]}</span>
                            )}
                            {event.affaire}
                          </span>
                        )}
                      </div>
                      <div className="reservation-event-title">
                        {cleanTitle}
                      </div>
                      {event.location && (
                        <div className="reservation-event-location">
                          📍 {event.location}
                        </div>
                      )}
                    </div>
                    {/* Bouton trajet solo (seulement si pas dans un groupe) */}
                    {!isInGroup && (
                      <Button variant="ghost"                         type="button"
                        className="trip-details-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTripDetails(event, originalIndex);
                        }}
                      >
                        <MapPin size={16} />
                        Détails du trajet
                      </Button>
                    )}
                    {/* Boutons de liaison (seulement si solo et en mode édition) */}
                    {!isInGroup && isEdit && (
                      <div className="trip-link-actions">
                        {originalIndex < sortedEventIds.length - 1 && (
                          <Button variant="ghost"                             type="button"
                            className="link-next-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              const nextItem = sortedEventIds[originalIndex + 1];
                              handleLinkTrips(eventId, nextItem.eventId);
                            }}
                            title="Lier à l'événement suivant de la tournée"
                          >
                            <Link2 size={14} />
                            Lier au suivant
                          </Button>
                        )}
                        <Button variant="ghost"                           type="button"
                          className="link-event-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLinkEventComboboxOpen(linkEventComboboxOpen === eventId ? null : eventId);
                          }}
                          title="Lier à un autre événement du calendrier"
                        >
                          <Link2 size={14} />
                          Lier à un événement
                        </Button>
                        {linkEventComboboxOpen === eventId && (
                          <div className="link-event-combobox" onClick={(e) => e.stopPropagation()}>
                            <div className="combobox-header">Choisir un événement à lier</div>
                            <div className="combobox-list">
                              {/* Événements déjà dans la tournée mais pas liés */}
                              {formData.linkedEventIds
                                .filter(eid => eid !== eventId)
                                .map(eid => googleEvents.find(e => e.id === eid))
                                .filter(Boolean)
                                .filter(ge => {
                                  const geTd = tripDetails[ge.id];
                                  const geGroup = geTd?.tripGroupId || geTd?.trip_group_id;
                                  const myTd = tripDetails[eventId];
                                  const myGroup = myTd?.tripGroupId || myTd?.trip_group_id;
                                  return !(geGroup && myGroup && geGroup === myGroup);
                                })
                                .map(ge => {
                                  let geTitle = ge.summary || '(Sans titre)';
                                  if (ge.affaire) geTitle = geTitle.replace(/\baf\s*\d+\b/gi, '').trim().replace(/\s+/g, ' ').replace(/^\s*-\s*|\s*-\s*$/g, '').trim();
                                  if (!geTitle) geTitle = '(Sans titre)';
                                  const geStart = ge.start?.dateTime ? new Date(ge.start.dateTime) : ge.start?.date ? new Date(ge.start.date) : null;
                                  
                                  return (
                                    <div key={ge.id} className="combobox-item combobox-item-tournee"
                                      onClick={() => { handleLinkTrips(eventId, ge.id); setLinkEventComboboxOpen(null); }}>
                                      <span className="combobox-date">🚐 {geStart ? format(geStart, 'dd/MM', { locale: fr }) : ''}</span>
                                      <span className="combobox-title">{geTitle}</span>
                                      {ge.affaire && <span className="combobox-affaire">{ge.affaire}</span>}
                                    </div>
                                  );
                                })}
                              {/* Séparateur si les deux listes ont des éléments */}
                              {formData.linkedEventIds.filter(eid => eid !== eventId).length > 0 && 
                               googleEvents.filter(ge => ge.id !== eventId && !formData.linkedEventIds.includes(ge.id)).length > 0 && (
                                <div className="combobox-separator">Autres événements</div>
                              )}
                              {/* Événements du banner pas encore dans la tournée */}
                              {googleEvents
                                .filter(ge => ge.id !== eventId && !formData.linkedEventIds.includes(ge.id))
                                .slice(0, 10)
                                .map(ge => {
                                  const geStart = ge.start?.dateTime ? new Date(ge.start.dateTime) : ge.start?.date ? new Date(ge.start.date) : null;
                                  let geTitle = ge.summary || '(Sans titre)';
                                  if (ge.affaire) geTitle = geTitle.replace(/\baf\s*\d+\b/gi, '').trim().replace(/\s+/g, ' ').replace(/^\s*-\s*|\s*-\s*$/g, '').trim();
                                  if (!geTitle) geTitle = '(Sans titre)';
                                  
                                  return (
                                    <div key={ge.id} className="combobox-item"
                                      onClick={() => handleLinkBannerEvent(eventId, ge)}>
                                      <span className="combobox-date">{geStart ? format(geStart, 'dd/MM', { locale: fr }) : '—'}</span>
                                      <span className="combobox-title">{geTitle}</span>
                                      {ge.affaire && <span className="combobox-affaire">{ge.affaire}</span>}
                                    </div>
                                  );
                                })}
                            </div>
                            <Button variant="ghost" type="button" className="combobox-close" onClick={() => setLinkEventComboboxOpen(null)}>
                              Fermer
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              };

              // Rendu d'un bouton de liaison entre deux segments
              const renderLinkButton = (lastEventId, firstEventId, key) => {
                const td1 = tripDetails[lastEventId];
                const td2 = tripDetails[firstEventId];
                const g1 = td1?.tripGroupId || td1?.trip_group_id;
                const g2 = td2?.tripGroupId || td2?.trip_group_id;
                const areLinked = g1 && g1 === g2;
                
                return (
                  <div key={key} className="trip-link-separator">
                    {areLinked ? (
                      <Button variant="ghost" type="button" className="unlink-btn"
                        onClick={(e) => { e.stopPropagation(); handleUnlinkTrip(firstEventId); }}
                        title="Délier ces événements">
                        <Unlink size={14} />
                        <span className="link-label">Liés</span>
                      </Button>
                    ) : isEdit ? (
                      <Button variant="ghost" type="button" className="link-btn"
                        onClick={(e) => { e.stopPropagation(); handleLinkTrips(lastEventId, firstEventId); }}
                        title="Lier les trajets de ces événements">
                        <Link2 size={14} />
                        <span className="link-label">Lier</span>
                      </Button>
                    ) : (
                      <div className="link-separator-line" />
                    )}
                  </div>
                );
              };
              
              return (
                <div className="linked-events-display reservation-linked-section">
                  <div className="reservation-linked-header">
                    <span>🗓️ Événements liés à cette tournée</span>
                    <span className="reservation-linked-count">
                      ({formData.linkedEventIds.length})
                    </span>
                  </div>
                  <div className="reservation-events-stack">
                    {segments.map((segment, segIdx) => {
                      const elements = [];
                      
                      // Bouton de liaison entre segments
                      if (segIdx > 0) {
                        const prevSegment = segments[segIdx - 1];
                        const prevLastEventId = prevSegment.items[prevSegment.items.length - 1].eventId;
                        const currFirstEventId = segment.items[0].eventId;
                        elements.push(renderLinkButton(prevLastEventId, currFirstEventId, `link-seg-${segIdx}`));
                      }
                      
                      if (segment.type === 'group') {
                        // Rendu d'un groupe lié
                        elements.push(
                          <div key={`group-${segment.groupId}`} className="trip-group-wrapper">
                            <div className="trip-group-header">
                              <Link2 size={14} />
                              <span>Trajets liés</span>
                            </div>
                            <div className="trip-group-cards">
                              {segment.items.map((item, itemIdx) => (
                                <React.Fragment key={item.eventId}>
                                  {itemIdx > 0 && (
                                    <div className="group-inner-separator">
                                      <Unlink size={12} />
                                      <Button variant="ghost" type="button" className="unlink-inner-btn"
                                        onClick={(e) => { e.stopPropagation(); handleUnlinkTrip(item.eventId); }}
                                        title="Délier cet événement du groupe">
                                        Délier
                                      </Button>
                                    </div>
                                  )}
                                  {renderEventCard(item, true)}
                                </React.Fragment>
                              ))}
                            </div>
                            <Button variant="ghost"                               type="button"
                              className="trip-details-btn combined-trip-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCombinedTripDetails(segment.items);
                              }}
                            >
                              <MapPin size={16} />
                              Détails du trajet combiné ({segment.items.length} événements)
                            </Button>
                          </div>
                        );
                      } else {
                        // Rendu d'un event solo
                        elements.push(renderEventCard(segment.items[0], false));
                      }
                      
                      return <React.Fragment key={`seg-${segIdx}`}>{elements}</React.Fragment>;
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
          {/* Fin de la section ÉVÉNEMENTS LIÉS */}

          {/* SECTION NOTES */}
          <FormField className="form-group" label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Notes supplémentaires..."
              rows="3"
            />
          </FormField>

          {/* SECTION MATÉRIEL (uniquement en édition) */}
          {isEdit && reservation?.id && (
            <>
              <Suspense fallback={<div className="reservation-loading-fallback">Chargement matériel...</div>}>
                <ReservationEquipment
                  reservationId={reservation.id}
                  currentUser={currentUser}
                />
              </Suspense>
            </>
          )}

          </fieldset>
        </form>

        <div className="modal-actions">
          {isEdit && currentUser?.isAdmin && (
            <Button variant="ghost"               type="button"
              className="delete-button"
              onClick={onDelete}
            >
              <Trash2 size={18} />
              Supprimer
            </Button>
          )}
          <Button variant="ghost" onClick={isReadOnly ? onClose : handleSafeClose}>
            {isReadOnly ? 'Fermer' : 'Annuler'}
          </Button>
          {!isEdit && (
            <Button variant="ghost" type="submit" form="reservation-form" className="submit-button">
              {currentUser?.isAdmin ? 'Créer' : 'Demander'}
            </Button>
          )}
          {isEdit && !isReadOnly && (isDirty || formData.isTournee) && (
            <Button variant="ghost" type="submit" form="reservation-form" className="submit-button">
              Valider les modifications
            </Button>
          )}
        </div>
      </div>

      {selectedEventForTrip && (() => {
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

      {/* Modal trajet combiné pour les événements liés */}
      {selectedEventsForCombinedTrip && (() => {
        const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);
        // Le premier événement du groupe sert d'événement principal
        const primaryEvent = selectedEventsForCombinedTrip[0].event;
        
        return (
          <TripDetailsModal
            event={primaryEvent}
            tripDetail={tripDetails[primaryEvent.id]}
            onSave={handleSaveTripDetails}
            onClose={() => setSelectedEventsForCombinedTrip(null)}
            drivers={drivers}
            vehicle={selectedVehicle}
            nextEvent={selectedEventsForCombinedTrip.length > 1 ? selectedEventsForCombinedTrip[1].event : null}
            googleMapsApiKey={googleMapsApiKey}
            companyAddress={companyAddress}
            initialLocations={allLocations}
            combinedEvents={selectedEventsForCombinedTrip.map(item => ({
              event: item.event,
              tripDetail: tripDetails[item.event.id]
            }))}
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

      <Dialog
        open={showUnsavedWarning}
        onClose={() => setShowUnsavedWarning(false)}
        onConfirm={() => { setShowUnsavedWarning(false); onClose(); }}
        title="Modifications non enregistrées"
        variant="warning"
        confirmLabel="Ne pas enregistrer"
        cancelLabel="Continuer l'édition"
        confirmVariant="danger"
      >
        Vous avez des modifications non enregistrées. Que souhaitez-vous faire ?
      </Dialog>
    </div>
  );
};

export default React.memo(ReservationModal);
