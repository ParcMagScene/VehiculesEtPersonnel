import React, { useEffect, useRef, useCallback } from 'react';
import { loadGoogleMapsAPI, isGoogleMapsLoaded } from '../utils/googleMapsLoader';
import api from '../utils/api';
import './AddressAutocomplete.css';

/**
 * Composant réutilisable d'autocomplétion d'adresse via Google Maps Places API
 * 
 * Props:
 * - value: string - valeur actuelle
 * - onChange: (value: string) => void - callback appelé avec la nouvelle valeur
 * - placeholder: string - placeholder de l'input
 * - id: string - id de l'input
 * - name: string - name de l'input
 * - required: boolean - champ obligatoire
 * - className: string - classes CSS additionnelles
 * - disabled: boolean - désactivé
 * - country: string|string[] - restriction pays (défaut: ['fr', 're'])  
 * - onPlaceSelect: (place) => void - callback optionnel avec le place complet
 * - as: 'input'|'textarea' - type d'élément (défaut: 'input')
 * - rows: number - nombre de lignes pour textarea
 * - list: string - datalist id for fallback
 */
export default function AddressAutocomplete({
  value,
  onChange,
  placeholder,
  id,
  name,
  required,
  className,
  disabled,
  country = ['fr', 're'],
  onPlaceSelect,
  as = 'input',
  rows,
  list,
  children,
}) {
  const inputRef = useRef(null);
  const autocompleteInstanceRef = useRef(null);
  const isInitializedRef = useRef(false);

  const initAutocomplete = useCallback(async () => {
    if (isInitializedRef.current || !inputRef.current) return;

    try {
      // Charger Google Maps si nécessaire
      if (!isGoogleMapsLoaded()) {
        const configData = await api.getGoogleMapsApiKey();
        const apiKey = configData.value;
        if (!apiKey) return;
        await loadGoogleMapsAPI(apiKey);
      }

      if (!window.google?.maps?.places) return;
      if (!inputRef.current) return;

      // Utiliser la nouvelle API PlaceAutocompleteElement si disponible
      if (window.google.maps.places.PlaceAutocompleteElement) {
        const countries = Array.isArray(country) ? country : [country];
        const placeEl = new window.google.maps.places.PlaceAutocompleteElement({
          componentRestrictions: { country: countries },
          fields: ['formattedAddress', 'displayName', 'location'],
        });

        // Styler l'élément pour qu'il soit invisible — on l'utilise comme source
        placeEl.style.position = 'absolute';
        placeEl.style.opacity = '0';
        placeEl.style.pointerEvents = 'none';
        placeEl.style.height = '0';
        placeEl.style.overflow = 'hidden';
        inputRef.current.parentElement?.appendChild(placeEl);

        // Créer un Autocomplete classique en fallback (toujours supporté)
        if (window.google.maps.places.Autocomplete) {
          const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
            componentRestrictions: { country: countries },
            fields: ['formatted_address', 'geometry', 'name'],
          });

          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place.formatted_address) {
              onChange(place.formatted_address);
              if (onPlaceSelect) onPlaceSelect(place);
            } else if (place.name) {
              onChange(place.name);
              if (onPlaceSelect) onPlaceSelect(place);
            }
          });

          autocompleteInstanceRef.current = autocomplete;
        }

        isInitializedRef.current = true;
      } else if (window.google.maps.places.Autocomplete) {
        // Fallback : ancienne API
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: Array.isArray(country) ? country : [country] },
          fields: ['formatted_address', 'geometry', 'name'],
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.formatted_address) {
            onChange(place.formatted_address);
            if (onPlaceSelect) onPlaceSelect(place);
          } else if (place.name) {
            onChange(place.name);
            if (onPlaceSelect) onPlaceSelect(place);
          }
        });

        autocompleteInstanceRef.current = autocomplete;
        isInitializedRef.current = true;
      }
    } catch (error) {
      console.error('Erreur init autocomplete adresse:', error);
    }
  }, [country, onChange, onPlaceSelect]);

  useEffect(() => {
    // Petit délai pour que le DOM soit prêt
    const timer = setTimeout(initAutocomplete, 200);
    return () => clearTimeout(timer);
  }, [initAutocomplete]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autocompleteInstanceRef.current) {
        window.google?.maps?.event?.clearInstanceListeners?.(autocompleteInstanceRef.current);
        autocompleteInstanceRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, []);

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const Tag = as === 'textarea' ? 'textarea' : 'input';
  const tagProps = {
    ref: inputRef,
    id,
    name,
    type: as === 'input' ? 'text' : undefined,
    value: value || '',
    onChange: handleChange,
    placeholder,
    required,
    disabled,
    className: `address-autocomplete-input ${className || ''}`,
    autoComplete: 'off',
  };

  if (as === 'textarea') {
    tagProps.rows = rows || 3;
  }
  if (list) {
    tagProps.list = list;
  }

  return (
    <div className="address-autocomplete-wrapper">
      <Tag {...tagProps} />
      {children}
    </div>
  );
}
