import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, MapPin, Clock, User } from 'lucide-react';
import './TripDetailsModal.css';
import { loadGoogleMapsAPI, isGoogleMapsLoaded as checkGoogleMapsLoaded } from '../utils/googleMapsLoader';
import LocationDialog from './LocationDialog';
import api from '../utils/api';

const TripDetailsModal = ({
  event,
  tripDetail,
  onSave,
  onClose,
  drivers,
  vehicle,
  nextEvent, // Pour les jonctions
  googleMapsApiKey,
  companyAddress = '',
  initialLocations = []
}) => {
  const [formData, setFormData] = useState({
    // ALLER
    departureLocation: tripDetail?.departureLocation || event?.location || '',
    departureDate: tripDetail?.departureDate || event?.start?.date || '',
    departureTime: tripDetail?.departureTime || '08:00',
    arrivalLocation: tripDetail?.arrivalLocation || event?.location || '',
    arrivalDate: tripDetail?.arrivalDate || event?.start?.date || '',
    arrivalTime: tripDetail?.arrivalTime || '10:00',
    
    // RETOUR
    returnDepartureLocation: tripDetail?.returnDepartureLocation || event?.location || '',
    returnDepartureDate: tripDetail?.returnDepartureDate || event?.end?.date || '',
    returnDepartureTime: tripDetail?.returnDepartureTime || '18:00',
    returnArrivalLocation: tripDetail?.returnArrivalLocation || '',
    returnArrivalDate: tripDetail?.returnArrivalDate || event?.end?.date || '',
    returnArrivalTime: tripDetail?.returnArrivalTime || '20:00',
    
    // Conducteur
    driverName: tripDetail?.driverName || '',
    
    // Jonction
    hasJunctionWithNext: tripDetail?.hasJunctionWithNext || false,
    junctionLocation: tripDetail?.junctionLocation || '',
    
    // Temps calculés
    outboundDuration: tripDetail?.outboundDuration || null,
    returnDuration: tripDetail?.returnDuration || null
  });

  const [pauses, setPauses] = useState([]);
  const [pausesWithValidatedLocation, setPausesWithValidatedLocation] = useState(new Set());
  const [isCalculating, setIsCalculating] = useState(false);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [isSaved, setIsSaved] = useState(!!tripDetail);
  const [locations, setLocations] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingLocationField, setEditingLocationField] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

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

  const getLocationHistory = () => {
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
        (error) => {
          console.log('Géolocalisation non disponible:', error.message);
        }
      );
    }
  }, []);

  // Charger les lieux et l'adresse de Mag Scène
  useEffect(() => {
    console.log('🚗 TripDetails: useEffect déclenché');
    console.log('🚗 TripDetails: initialLocations reçus:', initialLocations.length);
    console.log('🚗 TripDetails: companyAddress reçu:', companyAddress);
    
    // Si on a déjà les lieux depuis le parent, les utiliser directement
    if (initialLocations.length > 0) {
      console.log('🚗 TripDetails: Utilisation des lieux du parent');
      setAllLocations(initialLocations);
      setLocations(initialLocations.filter(loc => !loc.isCompanyLocation));
      return;
    }
    
    // Sinon charger depuis l'API
    const loadLocationsAndCompanyAddress = async () => {
      try {
        // Charger les lieux
        console.log('🚗 TripDetails: Chargement des lieux depuis API...');
        const locationsData = await api.getLocations();
        console.log('🚗 TripDetails: Lieux chargés:', locationsData.length);
        setLocations(locationsData);
        
        // Utiliser companyAddress si fourni, sinon charger depuis l'API
        let address = companyAddress;
        if (!address) {
          const token = localStorage.getItem('token');
          console.log('🚗 TripDetails: Token présent:', !!token);
          if (token) {
            const response = await fetch('/api/config/calendarConfig', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              address = data?.companyAddress || '';
            }
          }
        }
        
        console.log('🚗 TripDetails: Adresse Mag Scène:', address);
        
        // Créer un lieu virtuel pour Mag Scène si une adresse existe
        if (address) {
          const magSceneLocation = {
            id: 'mag-scene',
            name: 'Mag Scène',
            address: address,
            type: 'Dépôt'
          };
          console.log('🚗 TripDetails: Mag Scène ajouté, total lieux:', [magSceneLocation, ...locationsData].length);
          setAllLocations([magSceneLocation, ...locationsData]);
        } else {
          console.log('🚗 TripDetails: Pas d\'adresse Mag Scène');
          setAllLocations(locationsData);
        }
      } catch (error) {
        console.error('🚗 TripDetails: Erreur chargement lieux:', error);
        setAllLocations([]);
      }
    };
    loadLocationsAndCompanyAddress();
  }, [event, initialLocations, companyAddress]);

  // Charger les pauses depuis tripDetail au montage
  useEffect(() => {
    if (tripDetail?.pauses && Array.isArray(tripDetail.pauses)) {
      const loadedPauses = tripDetail.pauses.map(p => ({
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
  }, [tripDetail]);

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
    if (!isGoogleMapsLoaded || !window.google?.maps?.places) return;

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
  }, [formData.departureLocation, formData.arrivalLocation, isGoogleMapsLoaded, googleMapsApiKey, vehicle?.type, pauses, pausesWithValidatedLocation]);

  // Calculer automatiquement la durée RETOUR quand les conditions changent
  useEffect(() => {
    if (formData.returnDepartureLocation && formData.returnArrivalLocation && isGoogleMapsLoaded && googleMapsApiKey) {
      calculateDuration(formData.returnDepartureLocation, formData.returnArrivalLocation, 'return');
    }
  }, [formData.returnDepartureLocation, formData.returnArrivalLocation, isGoogleMapsLoaded, googleMapsApiKey, vehicle?.type, pauses, pausesWithValidatedLocation]);

  // Initialiser l'autocomplétion Google Maps sur les champs principaux
  useEffect(() => {
    if (!isGoogleMapsLoaded || !window.google?.maps?.places) return;

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
        alert('Clé API Google Maps non configurée');
      } else if (!isGoogleMapsLoaded) {
        alert('Google Maps est en cours de chargement, veuillez réessayer dans quelques instants');
      }
      return;
    }
    
    setIsCalculating(true);
    try {
      // Déterminer si c'est un Poids Lourd (PL) ou Véhicule Léger (VL)
      const isPL = vehicle?.type?.toUpperCase().includes('PL') || 
                   vehicle?.type?.toUpperCase().includes('PORTEUR') ||
                   vehicle?.type?.toUpperCase().includes('SEMI');
      
      console.log('🚛 Calcul durée trajet:', {
        vehicleType: vehicle?.type,
        isPL: isPL,
        coefficient: isPL ? 1.25 : 1.0
      });
      
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
          
          console.log('⏱️ Résultat calcul:', {
            durationSeconds: totalDurationSeconds,
            durationMinutesBase: Math.round(totalDurationSeconds / 60),
            coefficient: plCoefficient,
            durationFinal: durationMinutes
          });
          
          setFormData(prev => ({
            ...prev,
            [type === 'outbound' ? 'outboundDuration' : 'returnDuration']: durationMinutes
          }));
        } else {
          alert('Impossible de calculer la durée du trajet. Vérifiez les adresses.');
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
        
        const outboundResult = await new Promise((resolve, reject) => {
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
        
        const returnResult = await new Promise((resolve, reject) => {
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
    background: '#ecfdf5',
    borderColor: '#10b981',
    borderWidth: '2px'
  } : {};

  return (
    <div className="modal-overlay" onClick={(e) => {
      // Fermer uniquement si on clique sur l'overlay (arrière-plan)
      if (e.target.className === 'modal-overlay') {
        onClose();
      }
    }}>
      <div className="trip-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ flex: 1 }}>
            <h2>📍 Détails du trajet</h2>
            {/* Événement info */}
            <div className="event-info" style={{ margin: '0.5rem 0 0 0', background: 'transparent', padding: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{event.summary}</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {event.affaire && <span style={{ fontSize: '0.875rem' }}>{event.affaire}</span>}
                {vehicle && (
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    background: vehicle.type?.toUpperCase().includes('PL') || 
                               vehicle.type?.toUpperCase().includes('PORTEUR') ||
                               vehicle.type?.toUpperCase().includes('SEMI') 
                      ? '#fef3c7' 
                      : '#dbeafe',
                    color: vehicle.type?.toUpperCase().includes('PL') || 
                           vehicle.type?.toUpperCase().includes('PORTEUR') ||
                           vehicle.type?.toUpperCase().includes('SEMI')
                      ? '#92400e'
                      : '#1e40af',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    🚛 {vehicle.name} ({vehicle.type})
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Bandeau de confirmation si sauvegardé */}
          {isSaved && (
            <div style={{
              padding: '0.5rem 0.75rem',
              background: '#ecfdf5',
              border: '2px solid #10b981',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#065f46',
              fontWeight: '600',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              marginLeft: '1rem',
              alignSelf: 'flex-start'
            }}>
              ✅ Détails du trajet enregistrés
            </div>
          )}
          <button onClick={onClose} className="close-button">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="trip-details-form">

          {/* Conducteur */}
          <div className="trip-row">
            <div className="form-group">
              <label>
                <User size={18} style={{marginRight: '0.25rem'}} />
                Conducteur pour ce trajet
              </label>
              <select
                name="driverName"
                value={formData.driverName}
                onChange={handleChange}
                style={{padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem'}}
              >
                <option value="">Sélectionner un conducteur</option>
                {drivers?.map((driver) => (
                  <option key={driver.id} value={driver.name}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* TRAJET ALLER */}
          <div className="trip-section outbound">
            <h3>🚗 ALLER</h3>
            
            {/* Départ ALLER */}
            <div className="trip-row">
              <div className="form-group">
                <label>Départ</label>
                <div className="location-input-wrapper">
                  <input
                    type="text"
                    name="departureLocation"
                    value={formData.departureLocation}
                    onChange={handleChange}
                    list="locations-list"
                    placeholder="Tapez une adresse..."
                    required
                    style={savedFieldStyle}
                  />
                  <button
                    type="button"
                    className="new-location-btn"
                    onClick={() => handleOpenLocationDialog('departureLocation')}
                    title="Enregistrer comme lieu"
                  >
                    <MapPin size={16} />
                    Nouveau lieu
                  </button>
                </div>
                <small className="help-text">Saisissez librement ou choisissez un lieu enregistré</small>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  name="departureDate"
                  value={formData.departureDate}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </div>
              <div className="form-group">
                <label>Heure</label>
                <input
                  type="time"
                  name="departureTime"
                  value={formData.departureTime}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </div>
            </div>

            {/* Pauses ALLER */}
            {pauses.filter(p => p.pauseType === 'outbound').map(pause => {
              const pauseStyle = pausesWithValidatedLocation.has(pause.id) ? {
                background: '#eff6ff',
                borderColor: '#3b82f6',
                borderWidth: '2px'
              } : {};
              
              return (
                <div key={pause.id} className="trip-row" style={{gridTemplateColumns: '2fr 1fr 1fr auto'}}>
                  <div className="form-group">
                    <label>Pause</label>
                    <input
                      id={`pause-location-${pause.id}`}
                      type="text"
                      placeholder="Lieu de la pause"
                      value={pause.location}
                      onChange={(e) => updatePause(pause.id, 'location', e.target.value)}
                      list="locations-list"
                      style={pauseStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label>Heure</label>
                    <input
                      type="time"
                      value={pause.startTime}
                      onChange={(e) => updatePause(pause.id, 'startTime', e.target.value)}
                      style={pauseStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label>Durée (min)</label>
                    <input
                      type="number"
                      placeholder="30"
                      value={pause.duration}
                      onChange={(e) => updatePause(pause.id, 'duration', parseInt(e.target.value))}
                      min="5"
                      step="5"
                      style={pauseStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{opacity: 0, height: '1.25rem'}}>-</label>
                    <button
                      type="button"
                      onClick={() => removePause(pause.id)}
                      className="remove-pause-btn"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="trip-row">
              <div className="form-group">
                <button
                  type="button"
                  onClick={() => addPause('outbound')}
                  className="add-pause-btn"
                >
                  <Plus size={16} />
                  Ajouter une pause
                </button>
              </div>
            </div>

            {/* Arrivée ALLER */}
            <div className="trip-row">
              <div className="form-group">
                <label>Arrivée</label>
                <div className="location-input-wrapper">
                  <input
                    type="text"
                    name="arrivalLocation"
                    value={formData.arrivalLocation}
                    onChange={handleChange}
                    list="locations-list"
                    placeholder="Tapez une adresse..."
                    required
                    style={savedFieldStyle}
                  />
                  <button
                    type="button"
                    className="new-location-btn"
                    onClick={() => handleOpenLocationDialog('arrivalLocation')}
                    title="Enregistrer comme lieu"
                  >
                    <MapPin size={16} />
                    Nouveau lieu
                  </button>
                </div>
                <small className="help-text">Saisissez librement ou choisissez un lieu enregistré</small>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  name="arrivalDate"
                  value={formData.arrivalDate}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </div>
              <div className="form-group">
                <label>Heure</label>
                <input
                  type="time"
                  name="arrivalTime"
                  value={formData.arrivalTime}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </div>
            </div>

            <div className="duration-section">
              <button
                type="button"
                onClick={handleCalculateOutbound}
                disabled={isCalculating}
                className="calculate-btn"
              >
                <Clock size={18} />
                {isCalculating ? 'Calcul...' : 'Calculer le temps de trajet'}
              </button>
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
              <div className="form-group">
                <label>Départ</label>
                <div className="location-input-wrapper">
                  <input
                    type="text"
                    name="returnDepartureLocation"
                    value={formData.returnDepartureLocation}
                    onChange={handleChange}
                    list="locations-list"
                    placeholder="Tapez une adresse..."
                    required
                    style={savedFieldStyle}
                  />
                  <button
                    type="button"
                    className="new-location-btn"
                    onClick={() => handleOpenLocationDialog('returnDepartureLocation')}
                    title="Enregistrer comme lieu"
                  >
                    <MapPin size={16} />
                    Nouveau lieu
                  </button>
                </div>
                <small className="help-text">Saisissez librement ou choisissez un lieu enregistré</small>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  name="returnDepartureDate"
                  value={formData.returnDepartureDate}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </div>
              <div className="form-group">
                <label>Heure</label>
                <input
                  type="time"
                  name="returnDepartureTime"
                  value={formData.returnDepartureTime}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </div>
            </div>

            {/* Pauses RETOUR */}
            {pauses.filter(p => p.pauseType === 'return').map(pause => {
              const pauseStyle = pausesWithValidatedLocation.has(pause.id) ? {
                background: '#eff6ff',
                borderColor: '#3b82f6',
                borderWidth: '2px'
              } : {};
              
              return (
                <div key={pause.id} className="trip-row" style={{gridTemplateColumns: '2fr 1fr 1fr auto'}}>
                  <div className="form-group">
                    <label>Pause</label>
                    <input
                      id={`pause-location-${pause.id}`}
                      type="text"
                      placeholder="Lieu de la pause"
                      value={pause.location}
                      onChange={(e) => updatePause(pause.id, 'location', e.target.value)}
                      list="locations-list"
                      style={pauseStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label>Heure</label>
                    <input
                      type="time"
                      value={pause.startTime}
                      onChange={(e) => updatePause(pause.id, 'startTime', e.target.value)}
                      style={pauseStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label>Durée (min)</label>
                    <input
                      type="number"
                      placeholder="30"
                      value={pause.duration}
                      onChange={(e) => updatePause(pause.id, 'duration', parseInt(e.target.value))}
                      min="5"
                      step="5"
                      style={pauseStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{opacity: 0, height: '1.25rem'}}>-</label>
                    <button
                      type="button"
                      onClick={() => removePause(pause.id)}
                      className="remove-pause-btn"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="trip-row">
              <div className="form-group">
                <button
                  type="button"
                  onClick={() => addPause('return')}
                  className="add-pause-btn"
                >
                  <Plus size={16} />
                  Ajouter une pause
                </button>
              </div>
            </div>

            {/* Arrivée RETOUR */}
            <div className="trip-row">
              <div className="form-group">
                <label>Arrivée</label>
                <div className="location-input-wrapper">
                  <input
                    type="text"
                    name="returnArrivalLocation"
                    value={formData.returnArrivalLocation}
                    onChange={handleChange}
                    list="locations-list"
                    placeholder="Tapez une adresse..."
                    required
                    style={savedFieldStyle}
                  />
                  <button
                    type="button"
                    className="new-location-btn"
                    onClick={() => handleOpenLocationDialog('returnArrivalLocation')}
                    title="Enregistrer comme lieu"
                  >
                    <MapPin size={16} />
                    Nouveau lieu
                  </button>
                </div>
                <small className="help-text">Saisissez librement ou choisissez un lieu enregistré</small>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  name="returnArrivalDate"
                  value={formData.returnArrivalDate}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </div>
              <div className="form-group">
                <label>Heure</label>
                <input
                  type="time"
                  name="returnArrivalTime"
                  value={formData.returnArrivalTime}
                  onChange={handleChange}
                  required
                  style={savedFieldStyle}
                />
              </div>
            </div>

            <div className="duration-section">
              <button
                type="button"
                onClick={handleCalculateReturn}
                disabled={isCalculating}
                className="calculate-btn"
              >
                <Clock size={18} />
                {isCalculating ? 'Calcul...' : 'Calculer le temps de trajet'}
              </button>
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

          {/* Jonction avec événement suivant */}
          {nextEvent && (
            <div className="junction-section">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="hasJunctionWithNext"
                  checked={formData.hasJunctionWithNext}
                  onChange={handleChange}
                />
                <span>
                  🔗 Jonction directe avec l'événement suivant ({nextEvent.summary})
                </span>
              </label>
              {formData.hasJunctionWithNext && (
                <input
                  type="text"
                  name="junctionLocation"
                  value={formData.junctionLocation}
                  onChange={handleChange}
                  placeholder="Lieu de jonction"
                />
              )}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Annuler
            </button>
            <button type="submit" className="save-button">
              Enregistrer
            </button>
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
    </div>
  );
};

export default TripDetailsModal;
