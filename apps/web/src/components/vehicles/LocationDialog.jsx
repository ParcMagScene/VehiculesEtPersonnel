import { useState, useEffect, useRef } from 'react';
import logger from "../../utils/logger";
import { X, MapPin, Navigation, Clock, Route } from 'lucide-react';
import api from '../../utils/api';
import { Button, Dialog, FormField, Input, Select, InlineAlert , Tooltip} from '@/design-system';
import './LocationDialog.css';
import { loadGoogleMapsAPI, isGoogleMapsLoaded } from '../../utils/googleMapsLoader';
import { useToast } from '../../hooks/useToast';

const LocationDialog = ({ location, onSave, onClose, companyAddress }) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    name: location?.name || '',
    address: location?.address || '',
    lat: location?.lat || null,
    lng: location?.lng || null,
    placeId: location?.placeId || '',
    type: location?.type || 'Salle de spectacle'
  });

  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const initialFormDataRef = useRef(JSON.stringify({
    name: location?.name || '',
    address: location?.address || '',
    lat: location?.lat || null,
    lng: location?.lng || null,
    placeId: location?.placeId || '',
    type: location?.type || 'Salle de spectacle'
  }));

  const handleSafeClose = () => {
    if (JSON.stringify(formData) !== initialFormDataRef.current) {
      setShowUnsavedWarning(true);
      return;
    }
    onClose();
  };

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const addressAutocompleteContainerRef = useRef(null);

  // Initialiser Google Maps avec la nouvelle API PlaceAutocompleteElement
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
      .then(async () => {
        if (!window.google || !window.google.maps || !window.google.maps.Map) {
          console.error('❌ Google Maps API non disponible');
          setError('Google Maps API non disponible');
          return;
        }

        // Vérifier que toutes les classes nécessaires sont disponibles
        if (!window.google.maps.Marker || !window.google.maps.places || !window.google.maps.places.Autocomplete) {
          console.error('❌ Classes Google Maps non disponibles');
          setError('Erreur de chargement de Google Maps. Veuillez recharger la page.');
          return;
        }

        logger.log('✅ Google Maps API chargée avec succès');

        // Vérifier que mapRef.current existe
        if (!mapRef.current) {
          console.error('❌ Référence carte non disponible');
          return;
        }

        // Importer l'API Places (Autocomplete classique)
        // Note: on n'a plus besoin d'importLibrary pour l'ancienne API
        
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

    // === API PLACES : Autocomplete classique (fonctionne partout) ===
    // Attendre que le DOM soit prêt avec un setTimeout
    setTimeout(() => {
      if (!addressAutocompleteContainerRef.current) {
        console.error('❌ Conteneur autocomplete non trouvé dans le DOM');
        return;
      }
      
      if (!window.google?.maps?.places) {
        console.error('❌ Google Places API non disponible');
        return;
      }
      
      try {
        
        // Vérifier si un input existe déjà
        let input = addressAutocompleteContainerRef.current.querySelector('#address-autocomplete-input');
        
        if (!input) {
          addressAutocompleteContainerRef.current.innerHTML = '';
          input = document.createElement('input');
          input.type = 'text';
          input.placeholder = 'Rechercher une adresse...';
          input.className = 'autocomplete-input';
          input.id = 'address-autocomplete-input';
          input.style.cssText = 'width: 100%; padding: 0.75rem; border: 2px solid #3b82f6; border-radius: 8px; font-size: 1rem; display: block; box-sizing: border-box; margin-bottom: 0.5rem; background: var(--theme-bg-card); color: var(--theme-text-primary); font-family: inherit;';
          addressAutocompleteContainerRef.current.appendChild(input);
        }
        
        const autocomplete = new window.google.maps.places.Autocomplete(input, {
          componentRestrictions: { country: 'fr' },
          fields: ['name', 'formatted_address', 'geometry', 'place_id']
        });
        
        
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          
          if (!place.geometry || !place.geometry.location) {
            console.error('Pas de localisation pour ce lieu');
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

          // Mettre à jour la carte
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter({ lat, lng });
            mapInstanceRef.current.setZoom(15);
          }

          // Mettre à jour le marqueur
          if (markerRef.current) {
            markerRef.current.setPosition({ lat, lng });
          } else if (mapInstanceRef.current) {
            const marker = new window.google.maps.Marker({
              position: { lat, lng },
              map: mapInstanceRef.current,
              draggable: true,
              title: place.name
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

          logger.log('📍 Lieu sélectionné:', place.formatted_address);
        });
        
        logger.log('✅ Autocomplete initialisé avec succès');
      } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de l\'autocomplétion:', error);
        setError('Erreur lors de l\'initialisation de l\'autocomplétion');
      }
    }, 500); // Délai de 500ms pour attendre que le DOM soit monté

      })
      .catch(error => {
        console.error('❌ Erreur chargement Google Maps:', error);
        setError(error.message || 'Impossible de charger Google Maps');
        
        // Afficher un message détaillé
        const errorMsg = error.message.includes('ApiNotActivatedMapError') 
          ? '⚠️ L\'API Maps JavaScript n\'est pas activée pour votre clé API.\n\nConsultez le fichier GOOGLE_MAPS_ACTIVATION.md pour les instructions.'
          : error.message;
        
        toast.error(errorMsg);
      });

    // Nettoyage
    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mettre à jour la carte et le marqueur quand les coordonnées changent
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    const map = mapInstanceRef.current;
    
    if (formData.lat && formData.lng) {
      const position = { lat: formData.lat, lng: formData.lng };
      
      // Centrer la carte sur la nouvelle position avec zoom
      map.setCenter(position);
      map.setZoom(15);
      
      // Mettre à jour ou créer le marqueur
      if (markerRef.current) {
        markerRef.current.setPosition(position);
        markerRef.current.setTitle(formData.name);
      } else {
        const marker = new window.google.maps.Marker({
          position,
          map,
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
    }
  }, [formData.lat, formData.lng, formData.name]);

  // Calculer la distance et le temps depuis le siège
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    
    if (!formData.name.trim()) {
      toast.warning('Le nom du lieu est obligatoire');
      return;
    }
    
    setIsSaving(true);
    setSuccessMessage(null);
    setError(null);
    
    try {
      // Mapper placeId → place_id pour l'API backend
      const locationData = {
        name: formData.name,
        address: formData.address,
        lat: formData.lat,
        lng: formData.lng,
        place_id: formData.placeId,
        type: formData.type
      };
      
      
      let savedLocation;
      if (location?.id) {
        // Mise à jour d'un lieu existant
        savedLocation = await api.updateLocation(location.id, locationData);
        setSuccessMessage('✅ Lieu mis à jour avec succès !');
      } else {
        // Création d'un nouveau lieu
        const response = await api.createLocation(locationData);
        // Transformer place_id en placeId pour compatibilité frontend
        savedLocation = {
          ...response,
          placeId: response.place_id
        };
        setSuccessMessage('✅ Lieu créé avec succès !');
      }
      
      // Mettre à jour formData avec l'ID pour permettre des modifications ultérieures
      setFormData(prev => ({
        ...prev,
        id: savedLocation.id
      }));
      
      // Appeler onSave pour mettre à jour le parent
      if (onSave) {
        onSave(savedLocation);
      }
      
      // Effacer le message après 3 secondes
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du lieu:', error);
      setError('Erreur lors de la sauvegarde du lieu : ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="location-dialog-overlay" onMouseDown={(e) => {
      // Fermer seulement si on clique sur l'overlay, pas sur le contenu
      if (e.target === e.currentTarget) {
        handleSafeClose();
      }
    }}>
      <div className="location-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="location-dialog-header">
          <h2>
            <MapPin size={24} />
            {location ? 'Modifier le lieu' : 'Nouveau lieu'}
            {formData.lat && formData.lng && (
 <Tooltip content="Position GPS enregistrée" position="bottom">
   <span className="gps-badge">
                <Navigation size={16} />
                GPS
              </span>
 </Tooltip>
            )}
          </h2>
          <Button variant="ghost" className="close-button" onClick={handleSafeClose}>
            <X size={24} />
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <InlineAlert>{error}</InlineAlert>
          )}
          
          {successMessage && (
            <InlineAlert variant="success">{successMessage}</InlineAlert>
          )}

          <div className="location-dialog-content">
            <div className="form-section">
              <FormField className="form-group" label="Nom du lieu" htmlFor="location-name" required>
                <Input
                  id="location-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Théâtre de la Ville, Palais des Congrès..."
                  required
                />
              </FormField>

              <FormField className="form-group" label="Type de lieu" htmlFor="location-type" required>
                <Select
                  id="location-type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                >
                  <option value="Salle de spectacle">Salle de spectacle</option>
                  <option value="Prestataire">Prestataire</option>
                  <option value="Dépôt">Dépôt</option>
                  <option value="Garage">Garage</option>
                  <option value="Autre">Autre</option>
                </Select>
              </FormField>

              <FormField className="form-group" label="Rechercher une adresse" htmlFor="location-address">
                <div ref={addressAutocompleteContainerRef} className="autocomplete-container"></div>
                <small className="help-text">
                  Utilisez l'autocomplétion pour trouver une adresse précise
                </small>
              </FormField>

              {formData.address && (
                <FormField className="form-group" label="Adresse sélectionnée" htmlFor="location-address-display">
                  <Input
                    id="location-address-display"
                    type="text"
                    value={formData.address}
                    readOnly
                    className="readonly-input"
                  />
                </FormField>
              )}

              <div className="form-group">
                {formData.lat && formData.lng ? (
                  <div className="coordinates-badge success">
                    <Navigation size={16} />
                    <span>
                      <strong>Position GPS enregistrée</strong>
                      <small>Lat: {formData.lat.toFixed(6)}, Lng: {formData.lng.toFixed(6)}</small>
                    </span>
                  </div>
                ) : (
                  <small className="help-text warning">
                    ⚠️ Recherchez une adresse pour enregistrer les coordonnées GPS
                  </small>
                )}
              </div>

              {companyAddress && formData.lat && formData.lng && (
                <div className="route-info">
                  <h3>
                    <Navigation size={18} />
                    Depuis le siège
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
            <Button variant="ghost" onClick={handleSafeClose}>
              Fermer
            </Button>
            <Button variant="primary" type="submit" disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : (location ? 'Mettre à jour' : 'Ajouter')}
            </Button>
          </div>
        </form>
      </div>

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

export default LocationDialog;
