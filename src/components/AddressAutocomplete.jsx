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
  const placeElRef = useRef(null);
  const isInitializedRef = useRef(false);
  const usesLegacyRef = useRef(false);

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

      const countries = Array.isArray(country) ? country : [country];

      // 1) Nouvelle API PlaceAutocompleteElement (recommandée par Google depuis mars 2025)
      if (window.google.maps.places.PlaceAutocompleteElement) {
        try {
          const placeAC = new window.google.maps.places.PlaceAutocompleteElement();
          placeAC.includedRegionCodes = countries;

          // Connecter à notre input existant (supporté depuis la v3.59+)
          if ('inputElement' in placeAC || placeAC.inputElement !== undefined) {
            placeAC.inputElement = inputRef.current;
          }

          placeAC.addEventListener('gmp-placeselect', async ({ place }) => {
            try {
              await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
              const address = place.formattedAddress || place.displayName;
              if (address) {
                onChange(address);
                if (onPlaceSelect) {
                  // Format compatible avec l'ancien Autocomplete
                  onPlaceSelect({
                    formatted_address: place.formattedAddress,
                    name: place.displayName,
                    geometry: place.location ? { location: place.location } : undefined,
                  });
                }
              }
            } catch (fetchErr) {
              console.warn('PlaceAutocomplete fetchFields error:', fetchErr);
            }
          });

          // L'élément doit être dans le DOM pour fonctionner
          placeAC.style.position = 'absolute';
          placeAC.style.width = '0';
          placeAC.style.height = '0';
          placeAC.style.overflow = 'hidden';
          placeAC.style.opacity = '0';
          placeAC.style.pointerEvents = 'none';
          inputRef.current.parentElement?.appendChild(placeAC);

          placeElRef.current = placeAC;
          autocompleteInstanceRef.current = placeAC;
          isInitializedRef.current = true;
          return; // Succès — pas besoin du fallback
        } catch (e) {
          console.warn('PlaceAutocompleteElement init error, fallback to legacy:', e.message);
        }
      }

      // 2) Fallback : ancienne API Autocomplete (toujours fonctionnelle)
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
        usesLegacyRef.current = true;
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
      // Retirer le PlaceAutocompleteElement du DOM s'il existe
      if (placeElRef.current) {
        placeElRef.current.remove();
        placeElRef.current = null;
      }
      // Nettoyer les listeners pour l'ancienne API
      if (usesLegacyRef.current && autocompleteInstanceRef.current) {
        window.google?.maps?.event?.clearInstanceListeners?.(autocompleteInstanceRef.current);
      }
      autocompleteInstanceRef.current = null;
      isInitializedRef.current = false;
      usesLegacyRef.current = false;
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
