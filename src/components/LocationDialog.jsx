import React, { useState, useEffect, useRef } from 'react';
import logger from "../utils/logger";
import { X, MapPin, Navigation, Clock, Route } from 'lucide-react';
import api from '../utils/api';
import './LocationDialog.css';

const LocationDialog = ({ location, onSave, onClose, companyAddress }) => {
  const [formData, setFormData] = useState({
    name: location?.name || '',
    address: location?.address || '',
    lat: location?.lat || null,
    lng: location?.lng || null,
    placeId: location?.placeId || ''
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
      if (window.google && window.google.maps) {
        return Promise.resolve();
      }

      try {
        // Charger la clé API depuis la configuration
        const configData = await api.getGoogleMapsApiKey();
        const apiKey = configData.value;
        
        if (!apiKey) {
          throw new Error('Clé API Google Maps non configurée.\n\nAllez dans:\nGestion → Config Google → Clé API Google Maps\n\nPuis ajoutez votre clé API.');
        }

        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=fr&callback=Function.prototype`;
          script.async = true;
          script.defer = true;
          script.onload = () => {
            // Vérifier si l'API est bien chargée
            if (window.google && window.google.maps) {
              resolve();
            } else {
              reject(new Error('Google Maps API chargée mais non disponible'));
            }
          };
          script.onerror = () => {
            reject(new Error('Échec du chargement de Google Maps.\n\nVérifiez:\n1. Votre connexion internet\n2. Que la clé API est valide\n3. Que Maps JavaScript API est activée dans Google Cloud Console'));
          };
          document.head.appendChild(script);
        });
      } catch (error) {
        throw new Error(`Erreur configuration: ${error.message}`);
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

          markerRef.current = marker;
        }
      });

      autocompleteRef.current = autocomplete;
    }

      })
      .catch(error => {
        console.error('❌ Erreur chargement Google Maps:', error);
        setError(error.message || 'Impossible de charger Google Maps');
        
        // Afficher un message détaillé
        const errorMsg = error.message.includes('ApiNotActivatedMapError') 
          ? '⚠️ L\'API Maps JavaScript n\'est pas activée pour votre clé API.\n\nConsultez le fichier GOOGLE_MAPS_ACTIVATION.md pour les instructions.'
          : error.message;
        
        alert(errorMsg);
      });

    // Nettoyage
    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
  }, []);

  // Calculer la distance et le temps depuis MagScène
  useEffect(() => {
    if (!formData.lat || !formData.lng || !companyAddress) return;

    setIsLoadingRoute(true);

    const service = new window.google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      {
        origins: [companyAddress],
        destinations: [{ lat: formData.lat, lng: formData.lng }],
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
      },
      (response, status) => {
        setIsLoadingRoute(false);
        
        if (status === 'OK' && response.rows[0]?.elements[0]?.status === 'OK') {
          const element = response.rows[0].elements[0];
          setDistance(element.distance.text);
          setDuration(element.duration.text);
        } else {
          console.error('Erreur calcul distance:', status);
        }
      }
    );
  }, [formData.lat, formData.lng, companyAddress]);

  // Géocodage inverse pour obtenir l'adresse depuis les coordonnées
  const reverseGeocode = (lat, lng) => {
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Le nom du lieu est obligatoire');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="location-dialog-overlay" onClick={onClose}>
      <div className="location-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="location-dialog-header">
          <h2>
            <MapPin size={24} />
            {location ? 'Modifier le lieu' : 'Nouveau lieu'}
          </h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="error-banner">
              <strong>⚠️ Erreur Google Maps</strong>
              <p>{error}</p>
              <small>Consultez le fichier <code>GOOGLE_MAPS_ACTIVATION.md</code> pour activer l'API.</small>
            </div>
          )}

          <div className="location-dialog-content">
            <div className="form-section">
              <div className="form-group">
                <label htmlFor="location-name">Nom du lieu *</label>
                <input
                  id="location-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Théâtre de la Ville, Palais des Congrès..."
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="location-address">Adresse</label>
                <input
                  id="location-address"
                  ref={inputRef}
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Tapez une adresse et sélectionnez dans la liste..."
                />
                <small className="help-text">
                  Utilisez l'autocomplétion ou déplacez le marqueur sur la carte
                </small>
              </div>

              {formData.lat && formData.lng && (
                <div className="coordinates-info">
                  <div className="coordinate-item">
                    <strong>Latitude:</strong> {formData.lat.toFixed(6)}
                  </div>
                  <div className="coordinate-item">
                    <strong>Longitude:</strong> {formData.lng.toFixed(6)}
                  </div>
                </div>
              )}

              {companyAddress && formData.lat && formData.lng && (
                <div className="route-info">
                  <h3>
                    <Navigation size={18} />
                    Depuis MagScène
                  </h3>
                  {isLoadingRoute ? (
                    <div className="loading">Calcul en cours...</div>
                  ) : (
                    <>
                      {distance && (
                        <div className="route-item">
                          <Route size={16} />
                          <span><strong>Distance:</strong> {distance}</span>
                        </div>
                      )}
                      {duration && (
                        <div className="route-item">
                          <Clock size={16} />
                          <span><strong>Temps de trajet:</strong> {duration}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="map-preview-container">
                <h4 className="map-preview-title">
                  <MapPin size={16} />
                  Aperçu de la localisation
                </h4>
                <div className="map-preview-wrapper">
                  <div ref={mapRef} className="google-map"></div>
                </div>
                <small className="help-text">
                  Déplacez le marqueur pour ajuster la position
                </small>
              </div>
            </div>
          </div>

          <div className="location-dialog-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn-save">
              {location ? 'Mettre à jour' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LocationDialog;
