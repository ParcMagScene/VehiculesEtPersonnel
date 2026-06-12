import './LocationDialog.css';

import { Clock, Mail, MapPin, Navigation, Phone, Route, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  Button,
  FormField,
  InlineAlert,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { isGoogleMapsLoaded, loadGoogleMapsAPI } from '../../utils/googleMapsLoader';
import logger from '../../utils/logger';
import PhoneInput from '../PhoneInput';

const ClientDialog = ({ client, onSave, onClose, companyAddress }) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    name: client?.name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    address: client?.address || '',
    lat: client?.lat || null,
    lng: client?.lng || null,
    placeId: client?.placeId || '',
  });

  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [error, setError] = useState(null);

  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const { guardClose } = useDirtyForm(formData, { confirmer: confirm });
  const handleSafeClose = guardClose(onClose);

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
          throw new Error(
            'Clé API Google Maps non configurée.\n\nAllez dans:\nGestion → Config Google → Clé API Google Maps\n\nPuis ajoutez votre clé API.',
          );
        }

        await loadGoogleMapsAPI(apiKey);
      } catch (error) {
        console.error('Erreur chargement Google Maps:', error);
        throw error;
      }
    };

    loadGoogleMaps()
      .then(() => {
        if (!window.google || !window.google.maps || !window.google.maps.Map) {
          console.error('❌ Google Maps API non disponible');
          setError('Google Maps API non disponible');
          return;
        }

        // Vérifier que les classes nécessaires sont disponibles
        if (!window.google.maps.Marker || !window.google.maps.places) {
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

        // Créer la carte
        const map = new window.google.maps.Map(mapRef.current, {
          center:
            formData.lat && formData.lng
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
            title: formData.name,
          });

          markerRef.current = marker;

          // Permettre de déplacer le marqueur
          marker.addListener('dragend', (event) => {
            const newLat = event.latLng.lat();
            const newLng = event.latLng.lng();
            setFormData((prev) => ({
              ...prev,
              lat: newLat,
              lng: newLng,
            }));
            reverseGeocode(newLat, newLng);
          });
        }

        // Configurer l'autocomplétion (nouvelle API Places)
        if (inputRef.current) {
          const DATALIST_ID = 'client-dialog-address-datalist';
          let datalist = document.getElementById(DATALIST_ID);
          if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = DATALIST_ID;
            document.body.appendChild(datalist);
          }
          inputRef.current.setAttribute('list', DATALIST_ID);

          const predictionMap = new Map();

          const fetchSuggestions = async (query) => {
            if (!query || query.length < 3) {
              datalist.replaceChildren();
              predictionMap.clear();
              return;
            }
            try {
              if (
                !window.google.maps.places.AutocompleteSuggestion &&
                window.google.maps.importLibrary
              ) {
                await window.google.maps.importLibrary('places');
              }
              const { AutocompleteSuggestion } = window.google.maps.places;
              const { suggestions = [] } =
                await AutocompleteSuggestion.fetchAutocompleteSuggestions({
                  input: query,
                  language: 'fr',
                  includedRegionCodes: ['fr'],
                });
              datalist.replaceChildren();
              predictionMap.clear();
              suggestions.slice(0, 8).forEach(({ placePrediction }) => {
                const label =
                  placePrediction.text?.toString?.() || placePrediction.text?.text || '';
                if (!label) return;
                predictionMap.set(label, placePrediction);
                const opt = document.createElement('option');
                opt.value = label;
                datalist.appendChild(opt);
              });
            } catch (e) {
              console.warn('Suggestions adresse indisponibles:', e?.message);
            }
          };

          const applyPlaceSelection = async (label) => {
            const prediction = predictionMap.get(label);
            if (!prediction) return;
            try {
              const place = prediction.toPlace();
              await place.fetchFields({ fields: ['formattedAddress', 'location', 'id'] });
              const lat = place.location.lat();
              const lng = place.location.lng();
              setFormData((prev) => ({
                ...prev,
                address: place.formattedAddress,
                lat,
                lng,
                placeId: place.id,
              }));
              map.setCenter({ lat, lng });
              map.setZoom(15);
              if (markerRef.current) {
                markerRef.current.setPosition({ lat, lng });
              } else {
                const marker = new window.google.maps.Marker({
                  position: { lat, lng },
                  map,
                  draggable: true,
                  title: formData.name,
                });
                markerRef.current = marker;
                marker.addListener('dragend', (event) => {
                  const newLat = event.latLng.lat();
                  const newLng = event.latLng.lng();
                  setFormData((prev) => ({ ...prev, lat: newLat, lng: newLng }));
                  reverseGeocode(newLat, newLng);
                });
              }
              if (companyAddress && lat && lng) {
                calculateRoute(companyAddress, { lat, lng });
              }
            } catch (e) {
              console.warn('Impossible de récupérer les détails du lieu:', e?.message);
            }
          };

          let debounceTimer;
          inputRef.current.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const val = e.target.value;
            if (predictionMap.has(val)) {
              applyPlaceSelection(val);
            } else {
              debounceTimer = setTimeout(() => fetchSuggestions(val), 300);
            }
          });

          autocompleteRef.current = null;
        }

        // Calculer la distance initiale si les données sont complètes
        if (companyAddress && formData.lat && formData.lng) {
          calculateRoute(companyAddress, { lat: formData.lat, lng: formData.lng });
        }
      })
      .catch((error) => {
        console.error('❌ Erreur chargement Google Maps:', error);
        setError(error.message);
      });

    return () => {
      // Cleanup
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fonction de géocodage inverse
  const reverseGeocode = (lat, lng) => {
    if (!window.google || !window.google.maps) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        setFormData((prev) => ({
          ...prev,
          address: results[0].formatted_address,
          placeId: results[0].place_id,
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

    directionsService.route(
      {
        origin: origin,
        destination: destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        setIsLoadingRoute(false);

        if (status === 'OK') {
          const route = result.routes[0].legs[0];
          setDistance(route.distance.text);
          setDuration(route.duration.text);
          logger.log(`📍 Distance: ${route.distance.text}, Durée: ${route.duration.text}`);
        } else {
          console.error('Erreur calcul itinéraire:', status);
          setError("Impossible de calculer l'itinéraire");
        }
      },
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.warning('Le nom du client est obligatoire');
      return;
    }
    onSave(formData);
  };

  const handleGeolocalise = () => {
    if (!navigator.geolocation) {
      toast.warning("La géolocalisation n'est pas supportée par votre navigateur");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setFormData((prev) => ({
          ...prev,
          lat: lat,
          lng: lng,
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
            title: formData.name,
          });

          markerRef.current = marker;

          marker.addListener('dragend', (event) => {
            const newLat = event.latLng.lat();
            const newLng = event.latLng.lng();
            setFormData((prev) => ({
              ...prev,
              lat: newLat,
              lng: newLng,
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
        toast.info("Impossible d'obtenir votre position");
      },
    );
  };

  return (
    <Modal open onClose={handleSafeClose} size="lg" className="location-dialog">
      <ModalHeader onClose={handleSafeClose}>
        {client ? 'Modifier le client' : 'Nouveau client'}
      </ModalHeader>

      <ModalBody>
        {error && <InlineAlert>{error}</InlineAlert>}

        <form id="client-dialog-form" onSubmit={handleSubmit} className="location-form">
          {error && <InlineAlert>{error}</InlineAlert>}

          <div className="location-dialog-content">
            <div className="form-section">
              <h3>
                <User size={18} />
                Informations du client
              </h3>

              <FormField className="form-group" label="Nom" htmlFor="client-name" required>
                <Input
                  id="client-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nom du client"
                  required
                />
              </FormField>

              <FormField
                className="form-group"
                label={
                  <>
                    <Mail size={16} /> Email
                  </>
                }
                htmlFor="client-email"
              >
                <Input
                  id="client-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemple.com"
                />
              </FormField>

              <FormField
                className="form-group"
                label={
                  <>
                    <Phone size={16} /> Téléphone
                  </>
                }
                htmlFor="client-phone"
              >
                <PhoneInput
                  id="client-phone"
                  value={formData.phone}
                  onChange={(val) => setFormData({ ...formData, phone: val })}
                />
              </FormField>

              <h3 style={{ marginTop: '2rem' }}>
                <MapPin size={18} />
                Adresse
              </h3>

              <FormField className="form-group" label="Adresse complète" htmlFor="client-address">
                <Input
                  id="client-address"
                  ref={inputRef}
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rechercher une adresse..."
                />
                <small className="help-text">Commencez à taper pour rechercher une adresse</small>
              </FormField>

              <Button
                variant="ghost"
                type="button"
                className="geolocate-button"
                onClick={handleGeolocalise}
              >
                <Navigation size={16} />
                Me géolocaliser
              </Button>

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
                    Distance depuis le siège
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

              {isLoadingRoute && <div className="loading-route">Calcul de l'itinéraire...</div>}

              <div className="map-preview-container">
                <h4 className="map-preview-title">
                  <MapPin size={16} />
                  Aperçu de la localisation
                </h4>
                <div className="map-preview-wrapper">
                  <div ref={mapRef} className="map" />
                </div>
                <small className="help-text">Déplacez le marqueur pour ajuster la position</small>
              </div>
            </div>
          </div>
        </form>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={handleSafeClose}>
          Annuler
        </Button>
        <Button variant="success" type="submit" form="client-dialog-form">
          Enregistrer
        </Button>
      </ModalFooter>

      {ConfirmDialogRenderer}
    </Modal>
  );
};

export default ClientDialog;
