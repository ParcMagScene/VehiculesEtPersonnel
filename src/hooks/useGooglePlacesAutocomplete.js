import { useEffect, useRef, useState } from 'react';
import api from '../utils/api';
import { loadGoogleMapsAPI, isGoogleMapsLoaded } from '../utils/googleMapsLoader';

/**
 * Hook pour activer l'autocomplétion Google Places sur un champ input
 * @param {Function} onPlaceSelected - Callback appelé quand un lieu est sélectionné
 * @param {Object} options - Options pour l'autocomplete
 */
export const useGooglePlacesAutocomplete = (onPlaceSelected, options = {}) => {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadGoogleMaps = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Vérifier si l'API est déjà chargée
        if (isGoogleMapsLoaded()) {
          initAutocomplete();
          return;
        }

        // Récupérer la clé API
        const configData = await api.getGoogleMapsApiKey();
        const apiKey = configData?.value;

        if (!apiKey) {
          setError('Clé API Google Maps non configurée');
          setIsLoading(false);
          return;
        }

        // Charger l'API avec le loader centralisé
        await loadGoogleMapsAPI(apiKey);
        initAutocomplete();

      } catch (err) {
        setError('Erreur de chargement Google Maps');
        setIsLoading(false);
      }
    };

    const initAutocomplete = () => {
      if (!inputRef.current || !window.google?.maps?.places) {
        setIsLoading(false);
        return;
      }

      try {
        const defaultOptions = {
          types: ['address'],
          componentRestrictions: { country: 'fr' },
          fields: ['formatted_address', 'geometry', 'name', 'place_id']
        };

        const autocomplete = new window.google.maps.places.Autocomplete(
          inputRef.current,
          { ...defaultOptions, ...options }
        );

        autocompleteRef.current = autocomplete;

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();

          if (place.geometry && onPlaceSelected) {
            onPlaceSelected({
              address: place.formatted_address || place.name,
              name: place.name,
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              placeId: place.place_id
            });
          }
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Erreur initialisation autocomplete:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    loadGoogleMaps();
  }, [onPlaceSelected, options]);

  return { inputRef, isLoading, error };
};
