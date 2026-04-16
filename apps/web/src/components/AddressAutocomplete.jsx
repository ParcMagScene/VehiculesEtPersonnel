import './AddressAutocomplete.css';

import { useCallback, useEffect, useRef } from 'react';

import { TIMING } from '../constants';
import api from '../utils/api';
import { isGoogleMapsLoaded, loadGoogleMapsAPI } from '../utils/googleMapsLoader';

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

      const countries = Array.isArray(country) ? country : [country];

      // API Autocomplete classique — stable et compatible avec notre input React
      // Note: PlaceAutocompleteElement crée son propre input (inputElement read-only)
      // et ne peut pas s'intégrer dans un composant React contrôlé existant.
      // L'Autocomplete classique reste supporté avec bugfixes garantis par Google.
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
        isInitializedRef.current = true;
      }
    } catch (error) {
      console.error('Erreur init autocomplete adresse:', error);
    }
  }, [country, onChange, onPlaceSelect]);

  useEffect(() => {
    // Petit délai pour que le DOM soit prêt
    const timer = setTimeout(initAutocomplete, TIMING.DOUBLE_CLICK);
    return () => clearTimeout(timer);
  }, [initAutocomplete]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autocompleteInstanceRef.current) {
        window.google?.maps?.event?.clearInstanceListeners?.(autocompleteInstanceRef.current);
      }
      autocompleteInstanceRef.current = null;
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
    // eslint-disable-next-line react-hooks/refs
    tagProps.rows = rows || 3;
  }
  if (list) {
    // eslint-disable-next-line react-hooks/refs
    tagProps.list = list;
  }

  return (
    <div className="address-autocomplete-wrapper">
      <Tag {...tagProps} />
      {children}
    </div>
  );
}
