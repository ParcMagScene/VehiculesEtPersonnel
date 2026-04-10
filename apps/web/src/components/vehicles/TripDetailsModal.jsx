import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, MapPin, Clock, User, ArrowDown } from 'lucide-react';
import './TripDetailsModal.css';
import { loadGoogleMapsAPI, isGoogleMapsLoaded as checkGoogleMapsLoaded } from '../../utils/googleMapsLoader';
import LocationDialog from './LocationDialog';
import { Button, Dialog, Input, FormField } from '@/design-system';
import DriverSelect from './DriverSelect';
import api from '../../utils/api';
import AddressAutocomplete from '../AddressAutocomplete';
import { useToast } from '../../hooks/useToast';

import { STATUS } from '../../constants';

const TripDetailsModal = ({
  event,
  tripDetail,
  onSave,
  onClose,
  drivers,
  persons = [],
  vehicle,
  _nextEvent, // Pour les jonctions
  googleMapsApiKey,
  companyAddress = '',
  initialLocations = [],
  combinedEvents = null // [{event, tripDetail}, ...] pour le mode combiné
}) => {
  const isCombinedMode = combinedEvents && combinedEvents.length > 1;
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(0); // Onglet actif en mode combiné
  
  // En mode combiné, utiliser l'événement/trip du tab actif
  const currentEvent = isCombinedMode ? combinedEvents[activeTab].event : event;
  const currentTripDetail = isCombinedMode ? combinedEvents[activeTab].tripDetail : tripDetail;
  const [formData, setFormData] = useState({
    // ALLER
    departureLocation: currentTripDetail?.departureLocation || currentEvent?.location || '',
    departureDate: currentTripDetail?.departureDate || currentEvent?.start?.date || '',
    departureTime: currentTripDetail?.departureTime || '08:00',
    arrivalLocation: currentTripDetail?.arrivalLocation || currentEvent?.location || '',
    arrivalDate: currentTripDetail?.arrivalDate || currentEvent?.start?.date || '',
    arrivalTime: currentTripDetail?.arrivalTime || '10:00',
    
    // RETOUR
    returnDepartureLocation: currentTripDetail?.returnDepartureLocation || currentEvent?.location || '',
    returnDepartureDate: currentTripDetail?.returnDepartureDate || currentEvent?.end?.date || '',
    returnDepartureTime: currentTripDetail?.returnDepartureTime || '18:00',
    returnArrivalLocation: currentTripDetail?.returnArrivalLocation || '',
    returnArrivalDate: currentTripDetail?.returnArrivalDate || currentEvent?.end?.date || '',
    returnArrivalTime: currentTripDetail?.returnArrivalTime || '20:00',
    
    // Conducteur
    driverName: currentTripDetail?.driverName || '',
    
    // Jonction
    hasJunctionWithNext: currentTripDetail?.hasJunctionWithNext || false,
    junctionLocation: currentTripDetail?.junctionLocation || '',
    
    // Temps calculés
    outboundDuration: currentTripDetail?.outboundDuration || null,
    returnDuration: currentTripDetail?.returnDuration || null
  });

  const [pauses, setPauses] = useState([]);
  const [pausesWithValidatedLocation, setPausesWithValidatedLocation] = useState(new Set());
  const [isCalculating, setIsCalculating] = useState(false);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const initialFormDataRef = useRef(JSON.stringify(formData));

  const handleSafeClose = () => {
    if (JSON.stringify(formData) !== initialFormDataRef.current) {
      setShowUnsavedWarning(true);
      return;
    }
    onClose();
  };
  const [isSaved, setIsSaved] = useState(!!currentTripDetail);
  const [_locations, setLocations] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingLocationField, setEditingLocationField] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  // Recharger le formulaire quand on change d'onglet en mode combiné
  useEffect(() => {
    if (isCombinedMode) {
      const td = combinedEvents[activeTab].tripDetail;
      const ev = combinedEvents[activeTab].event;
      setFormData({
        departureLocation: td?.departureLocation || ev?.location || '',
        departureDate: td?.departureDate || ev?.start?.date || '',
        departureTime: td?.departureTime || '08:00',
        arrivalLocation: td?.arrivalLocation || ev?.location || '',
        arrivalDate: td?.arrivalDate || ev?.start?.date || '',
        arrivalTime: td?.arrivalTime || '10:00',
        returnDepartureLocation: td?.returnDepartureLocation || ev?.location || '',
        returnDepartureDate: td?.returnDepartureDate || ev?.end?.date || '',
        returnDepartureTime: td?.returnDepartureTime || '18:00',
        returnArrivalLocation: td?.returnArrivalLocation || '',
        returnArrivalDate: td?.returnArrivalDate || ev?.end?.date || '',
        returnArrivalTime: td?.returnArrivalTime || '20:00',
        driverName: td?.driverName || '',
        hasJunctionWithNext: td?.hasJunctionWithNext || false,
        junctionLocation: td?.junctionLocation || '',
        outboundDuration: td?.outboundDuration || null,
        returnDuration: td?.returnDuration || null
      });
      setIsSaved(!!td);
      
      // Charger les pauses de l'onglet actif
      if (td?.pauses && Array.isArray(td.pauses)) {
        const loadedPauses = td.pauses.map(p => ({
          id: p.id || Date.now() + Math.random(),
          pauseType: p.pause_type || p.pauseType,
          location: p.location || '',
          startTime: p.start_time || p.startTime || '',
          duration: p.duration || '',
          notes: p.notes || ''
        }));
        setPauses(loadedPauses);
      } else {
        setPauses([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isCombinedMode]);

  // Fonctions pour gérer l'historique des lieux
  const saveLocationToHistory = (address) => {
    if (!address) return;
    try {
      const history = JSON.parse(localStorage.getItem('locationHistory') || '[]');
      // Éviter les doublons
      if (!history.includes(address)) {
        history.unshift(address);
        // Garder seulement les 20 derniers
        if (history.length > 20) history.pop();
        localStorage.setItem('locationHistory', JSON.stringify(history));
      }
    } catch (error) {
      console.error('Erreur sauvegarde historique:', error);
    }
  };

  const _getLocationHistory = () => {
    try {
      return JSON.parse(localStorage.getItem('locationHistory') || '[]');
    } catch (error) {
      return [];
    }
  };

  // Obtenir la géolocalisation de l'utilisateur
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (_error) => {
        }
      );
    }
  }, []);

  // Charger les lieux et l'adresse du siège
  useEffect(() => {
    
    // Si on a déjà les lieux depuis le parent, les utiliser directement
    if (initialLocations.length > 0) {
      setAllLocations(initialLocations);
      setLocations(initialLocations.filter(loc => !loc.isCompanyLocation));
      return;
    }
    
    // Sinon charger depuis l'API
    const loadLocationsAndCompanyAddress = async () => {
      try {
        // Charger les lieux
        const locationsData = await api.getLocations();
        setLocations(locationsData);
        
        // Utiliser companyAddress si fourni, sinon charger depuis l'API
        let address = companyAddress;
        if (!address) {
          try {
            const data = await api.getConfig('calendarConfig');
            address = data?.companyAddress || '';
          } catch {
            // ignore
          }
        }
        
        
        // Créer un lieu virtuel pour le siège si une adresse existe
        if (address) {
          const companyLocation = {
            id: 'company-hq',
            name: 'Siège',
            address: address,
            type: 'Dépôt'
          };
          setAllLocations([companyLocation, ...locationsData]);
        } else {
          setAllLocations(locationsData);
        }
      } catch (error) {
        console.error('🚗 TripDetails: Erreur chargement lieux:', error);
        setAllLocations([]);
      }
    };
    loadLocationsAndCompanyAddress();
  }, [event, initialLocations, companyAddress]);

  // Charger les pauses depuis currentTripDetail au montage
  useEffect(() => {
    if (currentTripDetail?.pauses && Array.isArray(currentTripDetail.pauses)) {
      const loadedPauses = currentTripDetail.pauses.map(p => ({
        id: p.id || Date.now() + Math.random(),
        pauseType: p.pause_type || p.pauseType,
        location: p.location || '',
        startTime: p.start_time || p.startTime || '',
        duration: p.duration || '',
        notes: p.notes || ''
      }));
      setPauses(loadedPauses);
      
      // Marquer les pauses avec location comme validées
      const validatedIds = new Set();
      loadedPauses.forEach(pause => {
        if (pause.location) {
          validatedIds.add(pause.id);
        }
      });
      setPausesWithValidatedLocation(validatedIds);
    }
  }, [currentTripDetail]);

  // Charger le script Google Maps si nécessaire
  useEffect(() => {
    if (!googleMapsApiKey) {
      setIsGoogleMapsLoaded(false);
      return;
    }

    if (checkGoogleMapsLoaded()) {
      setIsGoogleMapsLoaded(true);
      return;
    }

    loadGoogleMapsAPI(googleMapsApiKey)
      .then(() => {
        setIsGoogleMapsLoaded(true);
      })
      .catch((error) => {
        console.error('Erreur lors du chargement de Google Maps:', error);
        setIsGoogleMapsLoaded(false);
      });
  }, [googleMapsApiKey]);

  // Initialiser l'autocomplétion Google Maps pour les champs de pause
  useEffect(() => {
    if (!isGoogleMapsLoaded || !window.google?.maps?.places?.Autocomplete) return;

    pauses.forEach(pause => {
      const inputElement = document.getElementById(`pause-location-${pause.id}`);
      if (!inputElement) return;

      // Vérifier si l'autocomplétion n'est pas déjà initialisée
      if (inputElement.hasAttribute('data-autocomplete-initialized')) return;

      // Options de configuration pour prioriser les lieux proches
      const autocompleteOptions = {
        componentRestrictions: { country: 'fr' },
        fields: ['formatted_address', 'geometry', 'name']
      };

      // Si on a la position de l'utilisateur, prioriser les résultats autour
      if (userLocation) {
        autocompleteOptions.locationBias = {
          center: userLocation,
          radius: 50000 // 50km autour
        };
      }

      const autocomplete = new window.google.maps.places.Autocomplete(inputElement, autocompleteOptions);

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address) {
          updatePause(pause.id, 'location', place.formatted_address);
          // Marquer cette pause comme ayant une location validée
          setPausesWithValidatedLocation(prev => new Set(prev).add(pause.id));
          // Sauvegarder dans l'historique
          saveLocationToHistory(place.formatted_address);
        }
      });

      inputElement.setAttribute('data-autocomplete-initialized', 'true');
    });
  }, [isGoogleMapsLoaded, pauses, userLocation]);

  // Calculer automatiquement la durée ALLER quand les conditions changent
  useEffect(() => {
    if (formData.departureLocation && formData.arrivalLocation && isGoogleMapsLoaded && googleMapsApiKey) {
      calculateDuration(formData.departureLocation, formData.arrivalLocation, 'outbound');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.departureLocation, formData.arrivalLocation, isGoogleMapsLoaded, googleMapsApiKey, vehicle?.type, pauses, pausesWithValidatedLocation]);

  // Calculer automatiquement la durée RETOUR quand les conditions changent
  useEffect(() => {
    if (formData.returnDepartureLocation && formData.returnArrivalLocation && isGoogleMapsLoaded && googleMapsApiKey) {
      calculateDuration(formData.returnDepartureLocation, formData.returnArrivalLocation, 'return');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.returnDepartureLocation, formData.returnArrivalLocation, isGoogleMapsLoaded, googleMapsApiKey, vehicle?.type, pauses, pausesWithValidatedLocation]);

  // Initialiser l'autocomplétion Google Maps sur les champs principaux
  useEffect(() => {
    if (!isGoogleMapsLoaded || !window.google?.maps?.places?.Autocomplete) return;

    const fieldsToAutocomplete = [
      'departureLocation',
      'arrivalLocation',
      'returnDepartureLocation',
      'returnArrivalLocation'
    ];

    fieldsToAutocomplete.forEach(fieldName => {
      const inputElement = document.querySelector(`input[name="${fieldName}"]`);
      if (!inputElement || inputElement.hasAttribute('data-autocomplete-initialized')) return;

      const autocompleteOptions = {
        componentRestrictions: { country: 'fr' },
        fields: ['formatted_address', 'geometry', 'name']
      };

      if (userLocation) {
        autocompleteOptions.locationBias = {
          center: userLocation,
          radius: 50000
        };
      }

      const autocomplete = new window.google.maps.places.Autocomplete(inputElement, autocompleteOptions);

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address) {
          setFormData(prev => ({
            ...prev,
            [fieldName]: place.formatted_address
          }));
          saveLocationToHistory(place.formatted_address);
        }
      });

      inputElement.setAttribute('data-autocomplete-initialized', 'true');
    });
  }, [isGoogleMapsLoaded, userLocation]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleOpenLocationDialog = (field) => {
    setEditingLocationField(field);
    setIsLocationDialogOpen(true);
  };

  const handleLocationSave = async (locationData) => {
    try {
      // LocationDialog gère maintenant la sauvegarde en interne
      // On reçoit juste l'objet sauvegardé pour mettre à jour la liste locale
      const savedLocation = locationData;
      setLocations(prev => [...prev, savedLocation]);
      
      // Mettre à jour le champ avec le nouveau lieu
      if (editingLocationField) {
        setFormData(prev => ({
          ...prev,
          [editingLocationField]: savedLocation.name
        }));
      }
      
      // Ne PAS fermer le dialog - LocationDialog le gère lui-même
    } catch (error) {
      console.error('Erreur mise à jour locale lieu:', error);
    }
  };

  const handleLocationDialogClose = () => {
    setIsLocationDialogOpen(false);
    setEditingLocationField(null);
  };

  const calculateDuration = async (origin, destination, type) => {
    if (!origin || !destination || !googleMapsApiKey || !isGoogleMapsLoaded) {
      if (!googleMapsApiKey) {
        toast.info('Clé API Google Maps non configurée');
      } else if (!isGoogleMapsLoaded) {
        toast.warning('Google Maps est en cours de chargement, veuillez réessayer dans quelques instants');
      }
      return;
    }
    
    setIsCalculating(true);
    try {
      // Déterminer si c'est un Poids Lourd (PL) ou Véhicule Léger (VL)
      const isPL = vehicle?.type?.toUpperCase().includes('PL') || 
                   vehicle?.type?.toUpperCase().includes('PORTEUR') ||
                   vehicle?.type?.toUpperCase().includes('SEMI');
      
      // Récupérer les pauses avec location pour ce type de trajet
      const relevantPauses = pauses
        .filter(p => p.pauseType === type && p.location && pausesWithValidatedLocation.has(p.id))
        .map(p => ({ location: p.location }));
      
      const service = new window.google.maps.DirectionsService();
      const request = {
        origin: origin,
        destination: destination,
        travelMode: 'DRIVING',
        unitSystem: window.google.maps.UnitSystem.METRIC,
        // Ajouter les pauses comme waypoints si présentes
        ...(relevantPauses.length > 0 && {
          waypoints: relevantPauses,
          optimizeWaypoints: false // Garder l'ordre des pauses
        }),
        // Pour les PL, éviter les péages et autoroutes (restrictions possibles)
        ...(isPL && {
          avoidTolls: false,
          avoidHighways: false
        })
      };

      service.route(request, (response, status) => {
        if (status === 'OK') {
          // Calculer la durée totale en additionnant toutes les étapes
          let totalDurationSeconds = 0;
          response.routes[0].legs.forEach(leg => {
            totalDurationSeconds += leg.duration.value;
          });
          
          // Appliquer un coefficient pour les PL (vitesse réduite, limitations, pauses réglementaires)
          // PL: vitesse max 90 km/h vs VL 130 km/h + temps de manœuvre supplémentaires
          const plCoefficient = isPL ? 1.25 : 1.0; // +25% pour les PL
          
          const durationMinutes = Math.round((totalDurationSeconds / 60) * plCoefficient);
          
          setFormData(prev => ({
            ...prev,
            [type === 'outbound' ? 'outboundDuration' : 'returnDuration']: durationMinutes
          }));
        } else {
          toast.info('Impossible de calculer la durée du trajet. Vérifiez les adresses.');
        }
        setIsCalculating(false);
      });
    } catch (error) {
      console.error('Erreur calcul durée:', error);
      setIsCalculating(false);
    }
  };

  const handleCalculateOutbound = () => {
    calculateDuration(
      formData.departureLocation,
      formData.arrivalLocation,
      'outbound'
    );
  };

  const handleCalculateReturn = () => {
    calculateDuration(
      formData.returnDepartureLocation,
      formData.returnArrivalLocation,
      'return'
    );
  };

  const addPause = (type) => {
    setPauses(prev => [...prev, {
      id: Date.now(),
      pauseType: type,
      location: '',
      startTime: '',
      duration: 30,
      notes: ''
    }]);
  };

  const removePause = (id) => {
    setPauses(prev => prev.filter(p => p.id !== id));
  };

  const updatePause = (id, field, value) => {
    setPauses(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Calculer automatiquement les durées si elles ne sont pas définies
    let updatedFormData = { ...formData };
    
    // Calculer la durée aller si pas déjà fait
    if (!formData.outboundDuration && formData.departureLocation && formData.arrivalLocation && googleMapsApiKey && isGoogleMapsLoaded) {
      try {
        setIsCalculating(true);
        
        // Récupérer les pauses aller avec location validée
        const outboundPauses = pauses
          .filter(p => p.pauseType === 'outbound' && p.location && pausesWithValidatedLocation.has(p.id))
          .map(p => ({ location: p.location }));
        
        const service = new window.google.maps.DirectionsService();
        const isPL = vehicle?.type?.toUpperCase().includes('PL') || 
                     vehicle?.type?.toUpperCase().includes('PORTEUR') ||
                     vehicle?.type?.toUpperCase().includes('SEMI');
        
        const request = {
          origin: formData.departureLocation,
          destination: formData.arrivalLocation,
          travelMode: 'DRIVING',
          unitSystem: window.google.maps.UnitSystem.METRIC,
          ...(outboundPauses.length > 0 && {
            waypoints: outboundPauses,
            optimizeWaypoints: false
          }),
          ...(isPL && {
            avoidTolls: false,
            avoidHighways: false
          })
        };
        
        const outboundResult = await new Promise((resolve, _reject) => {
          service.route(request, (response, status) => {
            if (status === 'OK') {
              let totalDurationSeconds = 0;
              response.routes[0].legs.forEach(leg => {
                totalDurationSeconds += leg.duration.value;
              });
              // Appliquer coefficient PL (+25%)
              const plCoefficient = isPL ? 1.25 : 1.0;
              resolve(Math.round((totalDurationSeconds / 60) * plCoefficient));
            } else {
              resolve(null);
            }
          });
        });
        
        if (outboundResult) {
          updatedFormData.outboundDuration = outboundResult;
        }
      } catch (error) {
        console.error('Erreur calcul durée aller:', error);
      }
    }
    
    // Calculer la durée retour si pas déjà fait
    if (!formData.returnDuration && formData.returnDepartureLocation && formData.returnArrivalLocation && googleMapsApiKey && isGoogleMapsLoaded) {
      try {
        // Récupérer les pauses retour avec location validée
        const returnPauses = pauses
          .filter(p => p.pauseType === 'return' && p.location && pausesWithValidatedLocation.has(p.id))
          .map(p => ({ location: p.location }));
        
        const service = new window.google.maps.DirectionsService();
        const isPL = vehicle?.type?.toUpperCase().includes('PL') || 
                     vehicle?.type?.toUpperCase().includes('PORTEUR') ||
                     vehicle?.type?.toUpperCase().includes('SEMI');
        
        const request = {
          origin: formData.returnDepartureLocation,
          destination: formData.returnArrivalLocation,
          travelMode: 'DRIVING',
          unitSystem: window.google.maps.UnitSystem.METRIC,
          ...(returnPauses.length > 0 && {
            waypoints: returnPauses,
            optimizeWaypoints: false
          }),
          ...(isPL && {
            avoidTolls: false,
            avoidHighways: false
          })
        };
        
        const returnResult = await new Promise((resolve, _reject) => {
          service.route(request, (response, status) => {
            if (status === 'OK') {
              let totalDurationSeconds = 0;
              response.routes[0].legs.forEach(leg => {
                totalDurationSeconds += leg.duration.value;
              });
              // Appliquer coefficient PL (+25%)
              const plCoefficient = isPL ? 1.25 : 1.0;
              resolve(Math.round((totalDurationSeconds / 60) * plCoefficient));
            } else {
              resolve(null);
            }
          });
        });
        
        if (returnResult) {
          updatedFormData.returnDuration = returnResult;
        }
      } catch (error) {
        console.error('Erreur calcul durée retour:', error);
      }
    }

    setIsCalculating(false);
    
    // Enregistrer avec les durées calculées
    const savedData = await onSave({
      ...updatedFormData,
      pauses
    });
    
    // Si les données ont été sauvegardées avec succès, mettre à jour le formulaire
    if (savedData) {
      setFormData({
        departureLocation: savedData.departure_location || '',
        departureDate: savedData.departure_date || '',
        departureTime: savedData.departure_time || '',
        arrivalLocation: savedData.arrival_location || '',
        arrivalDate: savedData.arrival_date || '',
        arrivalTime: savedData.arrival_time || '',
        returnDepartureLocation: savedData.return_departure_location || '',
        returnDepartureDate: savedData.return_departure_date || '',
        returnDepartureTime: savedData.return_departure_time || '',
        returnArrivalLocation: savedData.return_arrival_location || '',
        returnArrivalDate: savedData.return_arrival_date || '',
        returnArrivalTime: savedData.return_arrival_time || '',
        driverName: savedData.driver_name || '',
        hasJunctionWithNext: !!savedData.has_junction_with_next,
        junctionLocation: savedData.junction_location || '',
        outboundDuration: savedData.outbound_duration || null,
        returnDuration: savedData.return_duration || null
      });
      
      if (savedData.pauses) {
        setPauses(savedData.pauses.map(p => ({
          id: p.id || Date.now(),
          pauseType: p.pause_type,
          location: p.location,
          startTime: p.start_time,
          duration: p.duration,
          notes: p.notes
        })));
      }
      
      // Marquer comme sauvegardé
      setIsSaved(true);
    }
  };

  // Style pour les champs sauvegardés
  const savedFieldStyle = isSaved ? {
    background: 'var(--theme-success-bg)',
    borderColor: '#10b981',
    borderWidth: '2px'
  } : {};

  // Générer la timeline chronologique pour le mode combiné
  const renderCombinedTimeline = () => {
    if (!isCombinedMode) return null;
    
    const events = combinedEvents;
    const totalEvents = events.length;
    const steps = [];
    
    events.forEach((ce, idx) => {
      const td = ce.tripDetail;
      const ev = ce.event;
      const isFirst = idx === 0;
      const isLast = idx === totalEvents - 1;
      const evTitle = ev.summary?.replace(/\baf\s*\d+\b/gi, '').trim().replace(/\s+/g, ' ').replace(/^\s*-\s*|\s*-\s*$/g, '').trim() || '(Sans titre)';
      const evPauses = td?.pauses || [];
      const outboundPauses = evPauses.filter(p => (p.pause_type || p.pauseType) === 'outbound');
      const returnPauses = evPauses.filter(p => (p.pause_type || p.pauseType) === 'return');
      
      if (isFirst) {
        // === PREMIER ÉVÉNEMENT : DÉPART ALLER ===
        steps.push({
          type: 'departure',
          icon: '🚗',
          label: 'Départ ALLER',
          location: td?.departureLocation || '—',
          date: td?.departureDate || '',
          time: td?.departureTime || '',
          duration: td?.outboundDuration,
          eventTitle: evTitle,
          eventAffaire: ev.affaire,
          eventIdx: idx
        });
        
        // Pauses aller
        outboundPauses.forEach(p => {
          steps.push({
            type: 'pause',
            icon: '☕',
            label: 'Pause',
            location: p.location || '',
            time: p.start_time || p.startTime || '',
            duration: p.duration,
            eventIdx: idx
          });
        });
        
        // Arrivée sur le premier événement
        steps.push({
          type: 'arrival',
          icon: '📍',
          label: `Arrivée - ${evTitle}`,
          location: td?.arrivalLocation || ev.location || '—',
          date: td?.arrivalDate || '',
          time: td?.arrivalTime || '',
          eventIdx: idx
        });
      }
      
      if (!isFirst) {
        // === TRANSFERT depuis l'événement précédent ===
        const prevCe = events[idx - 1];
        const prevTd = prevCe.tripDetail;
        const prevEv = prevCe.event;
        const prevTitle = prevEv.summary?.replace(/\baf\s*\d+\b/gi, '').trim().replace(/\s+/g, ' ').replace(/^\s*-\s*|\s*-\s*$/g, '').trim() || '(Sans titre)';
        
        // Départ transfert = retour du précédent ou arrivée du précédent
        steps.push({
          type: 'transfer',
          icon: '🔄',
          label: `Transfert : ${prevTitle} → ${evTitle}`,
          fromLocation: prevTd?.returnDepartureLocation || prevTd?.arrivalLocation || prevEv.location || '—',
          toLocation: td?.departureLocation || td?.arrivalLocation || ev.location || '—',
          fromTime: prevTd?.returnDepartureTime || '',
          toTime: td?.arrivalTime || td?.departureTime || '',
          fromDate: prevTd?.returnDepartureDate || '',
          toDate: td?.arrivalDate || td?.departureDate || '',
          eventIdx: idx
        });
        
        // Pauses aller (transfert) de cet événement
        outboundPauses.forEach(p => {
          steps.push({
            type: 'pause',
            icon: '☕',
            label: 'Pause',
            location: p.location || '',
            time: p.start_time || p.startTime || '',
            duration: p.duration,
            eventIdx: idx
          });
        });
        
        // Arrivée sur cet événement
        steps.push({
          type: 'arrival',
          icon: '📍',
          label: `Arrivée - ${evTitle}`,
          location: td?.arrivalLocation || ev.location || '—',
          date: td?.arrivalDate || '',
          time: td?.arrivalTime || '',
          eventIdx: idx
        });
      }
      
      if (isLast) {
        // === DERNIER ÉVÉNEMENT : DÉPART RETOUR ===
        steps.push({
          type: 'return-departure',
          icon: '🏠',
          label: 'Départ RETOUR',
          location: td?.returnDepartureLocation || ev.location || '—',
          date: td?.returnDepartureDate || '',
          time: td?.returnDepartureTime || '',
          duration: td?.returnDuration,
          eventIdx: idx
        });
        
        // Pauses retour
        returnPauses.forEach(p => {
          steps.push({
            type: 'pause',
            icon: '☕',
            label: 'Pause retour',
            location: p.location || '',
            time: p.start_time || p.startTime || '',
            duration: p.duration,
            eventIdx: idx
          });
        });
        
        // Arrivée retour
        steps.push({
          type: 'final-arrival',
          icon: '🏁',
          label: 'Arrivée RETOUR',
          location: td?.returnArrivalLocation || '—',
          date: td?.returnArrivalDate || '',
          time: td?.returnArrivalTime || '',
          eventIdx: idx
        });
      }
    });
    
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      } catch { return dateStr; }
    };
    
    const formatDuration = (min) => {
      if (!min) return '';
      const h = Math.floor(min / 60);
      const m = min % 60;
      return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}` : `${m} min`;
    };
    
    return (
      <div className="combined-timeline">
        <h3 className="timeline-title">📋 Itinéraire complet</h3>
        <div className="timeline-steps">
          {steps.map((step, i) => (
            <div 
              key={i} 
              className={`timeline-step timeline-step--${step.type}`}
              onClick={() => setActiveTab(step.eventIdx)}
            >
              <div className="timeline-step-marker">
                <span className="timeline-step-icon">{step.icon}</span>
                {i < steps.length - 1 && <div className="timeline-step-line" />}
              </div>
              <div className="timeline-step-content">
                <div className="timeline-step-header">
                  <span className="timeline-step-label">{step.label}</span>
                  {step.eventAffaire && (
                    <span className="timeline-step-affaire">{step.eventAffaire}</span>
                  )}
                </div>
                {step.type === 'transfer' ? (
                  <div className="timeline-transfer-detail">
                    <div className="timeline-transfer-from">
                      <span className="timeline-loc">{step.fromLocation}</span>
                      {(step.fromDate || step.fromTime) && (
                        <span className="timeline-datetime">
                          {formatDate(step.fromDate)} {step.fromTime}
                        </span>
                      )}
                    </div>
                    <ArrowDown size={14} className="timeline-transfer-arrow" />
                    <div className="timeline-transfer-to">
                      <span className="timeline-loc">{step.toLocation}</span>
                      {(step.toDate || step.toTime) && (
                        <span className="timeline-datetime">
                          {formatDate(step.toDate)} {step.toTime}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {step.location && step.location !== '—' && (
                      <span className="timeline-loc">{step.location}</span>
                    )}
                    <div className="timeline-step-meta">
                      {(step.date || step.time) && (
                        <span className="timeline-datetime">
                          {formatDate(step.date)} {step.time}
                        </span>
                      )}
                      {step.duration && (
                        <span className="timeline-duration">⏱️ {formatDuration(step.duration)}</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="timeline-hint">Cliquez sur une étape pour éditer l'événement correspondant</p>
      </div>
    );
  };

  return (
    <div className="td-overlay" onMouseDown={(e) => {
      // Fermer uniquement si on clique sur l'overlay (arrière-plan)
      if (e.target.className === 'td-overlay') {
        handleSafeClose();
      }
    }}>
      <div className="trip-details-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="u-flex-1">
            <h2>📍 {isCombinedMode ? 'Trajets liés' : 'Détails du trajet'}</h2>
            {/* Événement info (mode simple) */}
            {!isCombinedMode && (
              <div className="event-info" style={{ margin: '0.5rem 0 0 0', background: 'transparent', padding: 0 }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>{currentEvent.summary}</h3>
                <div className="u-flex-center u-flex-wrap u-gap-2 u-mt-1">
                  {currentEvent.affaire && <span className="u-font-sm">{currentEvent.affaire}</span>}
                  {vehicle && (
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      background: vehicle.type?.toUpperCase().includes('PL') || 
                                 vehicle.type?.toUpperCase().includes('PORTEUR') ||
                                 vehicle.type?.toUpperCase().includes('SEMI') 
                        ? 'var(--btn-warning-bg)' 
                        : 'var(--theme-info-bg-strong)',
                      color: vehicle.type?.toUpperCase().includes('PL') || 
                             vehicle.type?.toUpperCase().includes('PORTEUR') ||
                             vehicle.type?.toUpperCase().includes('SEMI')
                        ? 'var(--theme-warning-text)'
                        : 'var(--theme-info-text)',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      🚛 {vehicle.name} ({vehicle.type})
                    </span>
                  )}
                </div>
              </div>
            )}
            {/* Véhicule info (mode combiné) */}
            {isCombinedMode && vehicle && (
              <span style={{
                display: 'inline-flex',
                padding: '0.25rem 0.5rem',
                background: vehicle.type?.toUpperCase().includes('PL') || 
                           vehicle.type?.toUpperCase().includes('PORTEUR') ||
                           vehicle.type?.toUpperCase().includes('SEMI') 
                  ? 'var(--btn-warning-bg)' 
                  : 'var(--theme-info-bg-strong)',
                color: vehicle.type?.toUpperCase().includes('PL') || 
                       vehicle.type?.toUpperCase().includes('PORTEUR') ||
                       vehicle.type?.toUpperCase().includes('SEMI')
                  ? 'var(--theme-warning-text)'
                  : 'var(--theme-info-text)',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                fontWeight: '600',
                marginTop: '0.375rem'
              }}>
                🚛 {vehicle.name} ({vehicle.type})
              </span>
            )}
          </div>
          {/* Bandeau de confirmation si sauvegardé */}
          {isSaved && (
            <div style={{
              padding: '0.5rem 0.75rem',
              background: 'var(--theme-success-bg)',
              border: '2px solid #10b981',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--theme-success-text)',
              fontWeight: '600',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              marginLeft: '1rem',
              alignSelf: 'flex-start'
            }}>
              ✅ Détails du trajet enregistrés
            </div>
          )}
          <Button variant="ghost" onClick={handleSafeClose} className="close-button">
            <X size={24} />
          </Button>
        </div>

        {/* Timeline chronologique pour les trajets liés */}
        {isCombinedMode && renderCombinedTimeline()}

        {/* Onglets d'édition en mode combiné */}
        {isCombinedMode && (
          <div className="combined-edit-tabs">
            <span className="combined-edit-label">Éditer :</span>
            {combinedEvents.map((ce, idx) => {
              let tabTitle = ce.event.summary || '(Sans titre)';
              if (ce.event.affaire) {
                tabTitle = tabTitle.replace(/\baf\s*\d+\b/gi, '').trim().replace(/\s+/g, ' ').replace(/^\s*-\s*|\s*-\s*$/g, '').trim();
              }
              if (!tabTitle) tabTitle = '(Sans titre)';
              const hasData = !!ce.tripDetail;
              const isFirst = idx === 0;
              const isLast = idx === combinedEvents.length - 1;
              
              return (
                <Button variant="ghost"                   key={ce.event.id}
                  type="button"
                  className={`combined-edit-tab ${activeTab === idx ? 'active' : ''} ${hasData ? 'has-data' : ''}`}
                  onClick={() => setActiveTab(idx)}
                >
                  <span className="tab-number">{idx + 1}</span>
                  <span className="tab-title">{tabTitle}</span>
                  {ce.event.affaire && <span className="tab-affaire">{ce.event.affaire}</span>}
                  <span className="tab-role">
                    {isFirst ? '(Aller)' : isLast ? '(Retour)' : '(Transfert)'}
                  </span>
                  {hasData && <span className="tab-saved">✓</span>}
                </Button>
              );
            })}
          </div>
        )}

        {/* Bandeau info événement en cours d'édition - mode combiné */}
        {isCombinedMode && (
          <div className="combined-editing-banner">
            <span className="editing-badge">
              Événement {activeTab + 1}/{combinedEvents.length}
            </span>
            <strong>{currentEvent.summary}</strong>
            {currentEvent.affaire && <span className="editing-affaire">{currentEvent.affaire}</span>}
            {activeTab === 0 && <span className="editing-role-tag editing-role-aller">Aller</span>}
            {activeTab === combinedEvents.length - 1 && activeTab > 0 && <span className="editing-role-tag editing-role-retour">Retour</span>}
            {activeTab > 0 && activeTab < combinedEvents.length - 1 && <span className="editing-role-tag editing-role-transfert">Transfert</span>}
          </div>
        )}

        <form onSubmit={handleSubmit} className="trip-details-form">

          {/* Conducteur */}
          <div className="trip-row">
            <FormField className="form-group" label={<><User size={18} style={{marginRight: '0.25rem'}} /> Conducteur pour ce trajet</>}>
              {(() => {
                const vehicleType = vehicle?.type?.toUpperCase() || '';
                let requiredSkill = 'Conduite VL';
                if (['PL', 'CAMION', 'PORTEUR', 'PORTEUR MOYEN', 'TRACTEUR'].some(t => vehicleType.includes(t))) requiredSkill = 'Conduite PL';
                else if (['SPL', 'SEMI', 'SEMI-REMORQUE'].some(t => vehicleType.includes(t))) requiredSkill = 'Conduite SPL';
                const hierarchy = ['Conduite VL', 'Conduite PL', 'Conduite SPL'];
                const reqLevel = hierarchy.indexOf(requiredSkill);
                const qualified = (persons || []).filter(p => p.status === STATUS.ACTIVE && p.skills?.some(s => {
                  const sL = hierarchy.indexOf(s.name);
                  return sL >= 0 && sL >= reqLevel;
                })).map(p => ({ id: p.id, name: `${p.firstName || p.first_name || ''} ${p.lastName || p.last_name || ''}`.trim() || `Personnel #${p.id}`, photo: p.photo || null, skills: p.skills?.filter(s => s.category === 'conduite').map(s => s.name) || [] }));
                const otherDriverNames = drivers?.filter(d => !qualified.some(q => q.name === d.name)).map(d => d.name) || [];
                return (
                  <DriverSelect
                    value={formData.driverName}
                    onChange={(name) => handleChange({ target: { name: 'driverName', value: name } })}
                    qualifiedDrivers={qualified}
                    historySuggestions={otherDriverNames}
                  />
                );
              })()}
            </FormField>
          </div>

          {/* TRAJET ALLER */}
          <div className="trip-section outbound">
            <h3>🚗 ALLER</h3>
            
            {/* Départ ALLER */}
            <div className="trip-row">
              <FormField className="form-group" label="Départ">
                <div className="location-input-wrapper">
                  <AddressAutocomplete
                    name="departureLocation"
                    value={formData.departureLocation}
                    onChange={(val) => setFormData(prev => ({ ...prev, departureLocation: val }))}
                    list="locations-list"
                    placeholder="Tapez une adresse..."
                    required
                  />
                  <Button variant="ghost"                     type="button"
                    className="new-location-btn"
                    onClick={() => handleOpenLocationDialog('departureLocation')}
                    title="Enregistrer comme lieu"
                  >
                    <MapPin size={16} />
                    Nouveau lieu
                  </Button>
                </div>
                <small className="help-text">Saisissez librement ou choisissez un lieu enregistré</small>
              </FormField>
              <FormField className="form-group" label="Date">
                <input
                  type="date"
                  name="departureDate"
                  value={formData.departureDate}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </FormField>
              <FormField className="form-group" label="Heure">
                <input
                  type="time"
                  name="departureTime"
                  value={formData.departureTime}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </FormField>
            </div>

            {/* Pauses ALLER */}
            {pauses.filter(p => p.pauseType === 'outbound').map(pause => {
              const pauseStyle = pausesWithValidatedLocation.has(pause.id) ? {
                background: 'var(--theme-info-bg)',
                borderColor: 'var(--theme-primary)',
                borderWidth: '2px'
              } : {};
              
              return (
                <div key={pause.id} className="trip-row" style={{gridTemplateColumns: '2fr 1fr 1fr auto'}}>
                  <FormField className="form-group" label="Pause">
                    <Input
                      id={`pause-location-${pause.id}`}
                      type="text"
                      placeholder="Lieu de la pause"
                      value={pause.location}
                      onChange={(e) => updatePause(pause.id, 'location', e.target.value)}
                      list="locations-list"
                      style={pauseStyle}
                    />
                  </FormField>
                  <FormField className="form-group" label="Heure">
                    <input
                      type="time"
                      value={pause.startTime}
                      onChange={(e) => updatePause(pause.id, 'startTime', e.target.value)}
                      style={pauseStyle}
                    />
                  </FormField>
                  <FormField className="form-group" label="Durée (min)">
                    <Input
                      type="number"
                      placeholder="30"
                      value={pause.duration}
                      onChange={(e) => updatePause(pause.id, 'duration', parseInt(e.target.value))}
                      min="5"
                      step="5"
                      style={pauseStyle}
                    />
                  </FormField>
                  <FormField className="form-group" label="-">
                    <Button variant="ghost"                       type="button"
                      onClick={() => removePause(pause.id)}
                      className="remove-pause-btn"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </FormField>
                </div>
              );
            })}
            <div className="trip-row">
              <div className="form-group">
                <Button variant="ghost"                   type="button"
                  onClick={() => addPause('outbound')}
                  className="add-pause-btn"
                >
                  <Plus size={16} />
                  Ajouter une pause
                </Button>
              </div>
            </div>

            {/* Arrivée ALLER */}
            <div className="trip-row">
              <FormField className="form-group" label="Arrivée">
                <div className="location-input-wrapper">
                  <AddressAutocomplete
                    name="arrivalLocation"
                    value={formData.arrivalLocation}
                    onChange={(val) => setFormData(prev => ({ ...prev, arrivalLocation: val }))}
                    list="locations-list"
                    placeholder="Tapez une adresse..."
                    required
                  />
                  <Button variant="ghost"                     type="button"
                    className="new-location-btn"
                    onClick={() => handleOpenLocationDialog('arrivalLocation')}
                    title="Enregistrer comme lieu"
                  >
                    <MapPin size={16} />
                    Nouveau lieu
                  </Button>
                </div>
                <small className="help-text">Saisissez librement ou choisissez un lieu enregistré</small>
              </FormField>
              <FormField className="form-group" label="Date">
                <input
                  type="date"
                  name="arrivalDate"
                  value={formData.arrivalDate}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </FormField>
              <FormField className="form-group" label="Heure">
                <input
                  type="time"
                  name="arrivalTime"
                  value={formData.arrivalTime}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </FormField>
            </div>

            <div className="duration-section">
              <Button variant="ghost"                 type="button"
                onClick={handleCalculateOutbound}
                disabled={isCalculating}
                className="calculate-btn"
              >
                <Clock size={18} />
                {isCalculating ? 'Calcul...' : 'Calculer le temps de trajet'}
              </Button>
              {formData.outboundDuration && (() => {
                const pauseDurations = pauses
                  .filter(p => p.pauseType === 'outbound' && p.duration)
                  .reduce((sum, p) => sum + parseInt(p.duration || 0), 0);
                const pausesWithLocation = pauses.filter(p => p.pauseType === 'outbound' && p.location && pausesWithValidatedLocation.has(p.id)).length;
                return (
                  <span className="duration-result">
                    ⏱️ Trajet: {formData.outboundDuration} min{pausesWithLocation > 0 && ` (via ${pausesWithLocation} pause${pausesWithLocation > 1 ? 's' : ''})`}
                    {pauseDurations > 0 && ` + Arrêts: ${pauseDurations} min = Total: ${formData.outboundDuration + pauseDurations} min`}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* TRAJET RETOUR */}
          <div className="trip-section return">
            <h3>🏠 RETOUR</h3>
            
            {/* Départ RETOUR */}
            <div className="trip-row">
              <FormField className="form-group" label="Départ">
                <div className="location-input-wrapper">
                  <AddressAutocomplete
                    name="returnDepartureLocation"
                    value={formData.returnDepartureLocation}
                    onChange={(val) => setFormData(prev => ({ ...prev, returnDepartureLocation: val }))}
                    list="locations-list"
                    placeholder="Tapez une adresse..."
                    required
                  />
                  <Button variant="ghost"                     type="button"
                    className="new-location-btn"
                    onClick={() => handleOpenLocationDialog('returnDepartureLocation')}
                    title="Enregistrer comme lieu"
                  >
                    <MapPin size={16} />
                    Nouveau lieu
                  </Button>
                </div>
                <small className="help-text">Saisissez librement ou choisissez un lieu enregistré</small>
              </FormField>
              <FormField className="form-group" label="Date">
                <input
                  type="date"
                  name="returnDepartureDate"
                  value={formData.returnDepartureDate}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </FormField>
              <FormField className="form-group" label="Heure">
                <input
                  type="time"
                  name="returnDepartureTime"
                  value={formData.returnDepartureTime}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </FormField>
            </div>

            {/* Pauses RETOUR */}
            {pauses.filter(p => p.pauseType === 'return').map(pause => {
              const pauseStyle = pausesWithValidatedLocation.has(pause.id) ? {
                background: 'var(--theme-info-bg)',
                borderColor: 'var(--theme-primary)',
                borderWidth: '2px'
              } : {};
              
              return (
                <div key={pause.id} className="trip-row" style={{gridTemplateColumns: '2fr 1fr 1fr auto'}}>
                  <FormField className="form-group" label="Pause">
                    <Input
                      id={`pause-location-${pause.id}`}
                      type="text"
                      placeholder="Lieu de la pause"
                      value={pause.location}
                      onChange={(e) => updatePause(pause.id, 'location', e.target.value)}
                      list="locations-list"
                      style={pauseStyle}
                    />
                  </FormField>
                  <FormField className="form-group" label="Heure">
                    <input
                      type="time"
                      value={pause.startTime}
                      onChange={(e) => updatePause(pause.id, 'startTime', e.target.value)}
                      style={pauseStyle}
                    />
                  </FormField>
                  <FormField className="form-group" label="Durée (min)">
                    <Input
                      type="number"
                      placeholder="30"
                      value={pause.duration}
                      onChange={(e) => updatePause(pause.id, 'duration', parseInt(e.target.value))}
                      min="5"
                      step="5"
                      style={pauseStyle}
                    />
                  </FormField>
                  <FormField className="form-group" label="-">
                    <Button variant="ghost"                       type="button"
                      onClick={() => removePause(pause.id)}
                      className="remove-pause-btn"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </FormField>
                </div>
              );
            })}
            <div className="trip-row">
              <div className="form-group">
                <Button variant="ghost"                   type="button"
                  onClick={() => addPause('return')}
                  className="add-pause-btn"
                >
                  <Plus size={16} />
                  Ajouter une pause
                </Button>
              </div>
            </div>

            {/* Arrivée RETOUR */}
            <div className="trip-row">
              <FormField className="form-group" label="Arrivée">
                <div className="location-input-wrapper">
                  <AddressAutocomplete
                    name="returnArrivalLocation"
                    value={formData.returnArrivalLocation}
                    onChange={(val) => setFormData(prev => ({ ...prev, returnArrivalLocation: val }))}
                    list="locations-list"
                    placeholder="Tapez une adresse..."
                    required
                  />
                  <Button variant="ghost"                     type="button"
                    className="new-location-btn"
                    onClick={() => handleOpenLocationDialog('returnArrivalLocation')}
                    title="Enregistrer comme lieu"
                  >
                    <MapPin size={16} />
                    Nouveau lieu
                  </Button>
                </div>
                <small className="help-text">Saisissez librement ou choisissez un lieu enregistré</small>
              </FormField>
              <FormField className="form-group" label="Date">
                <input
                  type="date"
                  name="returnArrivalDate"
                  value={formData.returnArrivalDate}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </FormField>
              <FormField className="form-group" label="Heure">
                <input
                  type="time"
                  name="returnArrivalTime"
                  value={formData.returnArrivalTime}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </FormField>
            </div>

            <div className="duration-section">
              <Button variant="ghost"                 type="button"
                onClick={handleCalculateReturn}
                disabled={isCalculating}
                className="calculate-btn"
              >
                <Clock size={18} />
                {isCalculating ? 'Calcul...' : 'Calculer le temps de trajet'}
              </Button>
              {formData.returnDuration && (() => {
                const pauseDurations = pauses
                  .filter(p => p.pauseType === 'return' && p.duration)
                  .reduce((sum, p) => sum + parseInt(p.duration || 0), 0);
                const pausesWithLocation = pauses.filter(p => p.pauseType === 'return' && p.location && pausesWithValidatedLocation.has(p.id)).length;
                return (
                  <span className="duration-result">
                    ⏱️ Trajet: {formData.returnDuration} min{pausesWithLocation > 0 && ` (via ${pausesWithLocation} pause${pausesWithLocation > 1 ? 's' : ''})`}
                    {pauseDurations > 0 && ` + Arrêts: ${pauseDurations} min = Total: ${formData.returnDuration + pauseDurations} min`}
                  </span>
                );
              })()}
            </div>
          </div>

          <div className="modal-actions">
            <Button variant="ghost" onClick={handleSafeClose}>
              Annuler
            </Button>
            <Button variant="primary" type="submit">
              Enregistrer
            </Button>
          </div>

          {/* Datalist pour suggestions de lieux */}
          <datalist id="locations-list">
            {allLocations.map((loc) => (
              <option key={loc.id} value={loc.name}>
                {loc.address}
              </option>
            ))}
          </datalist>
        </form>
      </div>

      {/* Modal LocationDialog */}
      {isLocationDialogOpen && (
        <LocationDialog
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

export default React.memo(TripDetailsModal);
