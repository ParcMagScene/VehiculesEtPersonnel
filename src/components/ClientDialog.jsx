import React, { useState, useEffect, useRef } from 'react';
import logger from "../utils/logger";
import { X, MapPin, Navigation, Clock, Route, Mail, Phone, User } from 'lucide-react';
import api from '../utils/api';
import './LocationDialog.css';
import { loadGoogleMapsAPI, isGoogleMapsLoaded } from '../utils/googleMapsLoader';

const ClientDialog = ({ client, onSave, onClose, companyAddress }) => {
  const [formData, setFormData] = useState({
    name: client?.name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    address: client?.address || '',
    lat: client?.lat || null,
    lng: client?.lng || null,
    placeId: client?.placeId || ''
  });

  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [error, setError] = useState(null);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const autocompleteRef = useRef(null);
  const inputRef = useRef(null);

  // Initialiser Google Maps
  useEffect(() => {
    // Fonction pour charger Google Maps
    const loadGoogleMaps = async () => {
      if (isGoogleMapsLoaded()) {
        return Promise.resolve();
      }

      try {
        // Charger la clé API depuis la configuration
        const configData = await api.getGoogleMapsApiKey();
        const apiKey = configData.value;
        
        if (!apiKey) {
          throw new Error('Clé API Google Maps non configurée.\n\nAllez dans:\nGestion → Config Google → Clé API Google Maps\n\nPuis ajoutez votre clé API.');
        }

        await loadGoogleMapsAPI(apiKey);
      } catch (error) {
        console.error('Erreur chargement Google Maps:', error);
        throw error;
      }
    };

    loadGoogleMaps()
      .then(() => {
        if (!window.google || !window.google.maps) {
          console.error('❌ Google Maps API non disponible');
          setError('Google Maps API non disponible');
          return;
        }

        logger.log('✅ Google Maps API chargée avec succès');

        // Créer la carte
        const map = new window.google.maps.Map(mapRef.current, {
          center: formData.lat && formData.lng 
            ? { lat: formData.lat, lng: formData.lng }
            : { lat: 48.8566, lng: 2.3522 }, // Paris par défaut
          zoom: formData.lat ? 15 : 6,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
        });

        mapInstanceRef.current = map;

        // Ajouter un marqueur si position existe
        if (formData.lat && formData.lng) {
          const marker = new window.google.maps.Marker({
            position: { lat: formData.lat, lng: formData.lng },
            map: map,
            draggable: true,
            title: formData.name
          });

          markerRef.current = marker;

          // Permettre de déplacer le marqueur
          marker.addListener('dragend', (event) => {
            const newLat = event.latLng.lat();
            const newLng = event.latLng.lng();
            setFormData(prev => ({
              ...prev,
              lat: newLat,
              lng: newLng
            }));
            reverseGeocode(newLat, newLng);
          });
        }

        // Configurer l'autocomplétion
        if (inputRef.current) {
          const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
            types: ['address'],
            componentRestrictions: { country: 'fr' },
            fields: ['formatted_address', 'geometry', 'name', 'place_id']
          });

          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            
            if (!place.geometry) {
              console.error('Pas de géométrie pour ce lieu');
              return;
            }

            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();

            setFormData(prev => ({
              ...prev,
              address: place.formatted_address,
              lat: lat,
              lng: lng,
              placeId: place.place_id
            }));

            // Mettre à jour la carte et le marqueur
            map.setCenter({ lat, lng });
            map.setZoom(15);

            if (markerRef.current) {
              markerRef.current.setPosition({ lat, lng });
            } else {
              const marker = new window.google.maps.Marker({
                position: { lat, lng },
                map: map,
                draggable: true,
                title: formData.name
              });

              markerRef.current = marker;

              marker.addListener('dragend', (event) => {
                const newLat = event.latLng.lat();
                const newLng = event.latLng.lng();
                setFormData(prev => ({
                  ...prev,
                  lat: newLat,
                  lng: newLng
                }));
                reverseGeocode(newLat, newLng);
              });
            }

            // Calculer la distance si on a l'adresse de l'entreprise
            if (companyAddress && lat && lng) {
              calculateRoute(companyAddress, { lat, lng });
            }
          });

          autocompleteRef.current = autocomplete;
        }

        // Calculer la distance initiale si les données sont complètes
        if (companyAddress && formData.lat && formData.lng) {
          calculateRoute(companyAddress, { lat: formData.lat, lng: formData.lng });
        }
      })
      .catch(error => {
        console.error('❌ Erreur chargement Google Maps:', error);
        setError(error.message);
      });

    return () => {
      // Cleanup
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
  }, []);

  // Fonction de géocodage inverse
  const reverseGeocode = (lat, lng) => {
    if (!window.google || !window.google.maps) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        setFormData(prev => ({
          ...prev,
          address: results[0].formatted_address,
          placeId: results[0].place_id
        }));
      }
    });
  };

  // Calculer l'itinéraire et la distance
  const calculateRoute = (origin, destination) => {
    if (!window.google || !window.google.maps) {
      console.error('Google Maps non chargé');
      return;
    }

    setIsLoadingRoute(true);
    setError(null);

    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route({
      origin: origin,
      destination: destination,
      travelMode: window.google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      setIsLoadingRoute(false);
      
      if (status === 'OK') {
        const route = result.routes[0].legs[0];
        setDistance(route.distance.text);
        setDuration(route.duration.text);
        logger.log(`📍 Distance: ${route.distance.text}, Durée: ${route.duration.text}`);
      } else {
        console.error('Erreur calcul itinéraire:', status);
        setError('Impossible de calculer l\'itinéraire');
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Le nom du client est obligatoire');
      return;
    }
    onSave(formData);
  };

  const handleGeolocalise = () => {
    if (!navigator.geolocation) {
      alert('La géolocalisation n\'est pas supportée par votre navigateur');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setFormData(prev => ({
          ...prev,
          lat: lat,
          lng: lng
        }));

        // Mettre à jour la carte
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter({ lat, lng });
          mapInstanceRef.current.setZoom(15);
        }

        // Mettre à jour ou créer le marqueur
        if (markerRef.current) {
          markerRef.current.setPosition({ lat, lng });
        } else if (mapInstanceRef.current) {
          const marker = new window.google.maps.Marker({
            position: { lat, lng },
            map: mapInstanceRef.current,
            draggable: true,
            title: formData.name
          });

          markerRef.current = marker;

          marker.addListener('dragend', (event) => {
            const newLat = event.latLng.lat();
            const newLng = event.latLng.lng();
            setFormData(prev => ({
              ...prev,
              lat: newLat,
              lng: newLng
            }));
            reverseGeocode(newLat, newLng);
          });
        }

        // Géocodage inverse pour obtenir l'adresse
        reverseGeocode(lat, lng);

        // Calculer la distance
        if (companyAddress) {
          calculateRoute(companyAddress, { lat, lng });
        }
      },
      (error) => {
        console.error('Erreur géolocalisation:', error);
        alert('Impossible d\'obtenir votre position');
      }
    );
  };

  return (
    <div className="location-dialog-overlay">
      <div className="location-dialog">
        <div className="location-dialog-header">
          <h2>{client ? 'Modifier le client' : 'Nouveau client'}</h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="location-error" style={{ whiteSpace: 'pre-line' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="location-form">
          {error && (
            <div className="location-error" style={{ whiteSpace: 'pre-line' }}>
              ⚠️ {error}
            </div>
          )}

          <div className="location-dialog-content">
            <div className="form-section">
              <h3>
                <User size={18} />
                Informations du client
              </h3>
              
              <div className="form-group">
                <label htmlFor="client-name">Nom *</label>
                <input
                  id="client-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nom du client"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="client-email">
                  <Mail size={16} />
                  Email
                </label>
                <input
                  id="client-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemple.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="client-phone">
                  <Phone size={16} />
                  Téléphone
                </label>
                <input
                  id="client-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="06 12 34 56 78"
                />
              </div>

              <h3 style={{ marginTop: '2rem' }}>
                <MapPin size={18} />
                Adresse
              </h3>
              
              <div className="form-group">
                <label htmlFor="client-address">Adresse complète</label>
                <input
                  id="client-address"
                  ref={inputRef}
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rechercher une adresse..."
                />
                <small className="help-text">
                  Commencez à taper pour rechercher une adresse
                </small>
              </div>

              <button 
                type="button" 
                className="geolocate-button"
                onClick={handleGeolocalise}
              >
                <Navigation size={16} />
                Me géolocaliser
              </button>

              {formData.lat && formData.lng && (
                <div className="coordinates-info">
                  <p>Latitude: {formData.lat.toFixed(6)}</p>
                  <p>Longitude: {formData.lng.toFixed(6)}</p>
                </div>
              )}

              {(distance || duration) && (
                <div className="route-info">
                  <h3>
                    <Route size={18} />
                    Distance depuis Mag Scène
                  </h3>
                  <div className="route-info">
                    {distance && (
                      <div className="route-detail">
                        <MapPin size={16} />
                        <span>{distance}</span>
                      </div>
                    )}
                    {duration && (
                      <div className="route-detail">
                        <Clock size={16} />
                        <span>{duration}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isLoadingRoute && (
                <div className="loading-route">
                  Calcul de l'itinéraire...
                </div>
              )}

              <div className="map-preview-container">
                <h4 className="map-preview-title">
                  <MapPin size={16} />
                  Aperçu de la localisation
                </h4>
                <div className="map-preview-wrapper">
                  <div ref={mapRef} className="map" />
                </div>
                <small className="help-text">
                  Déplacez le marqueur pour ajuster la position
                </small>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Annuler
            </button>
            <button type="submit" className="save-button">
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientDialog;
