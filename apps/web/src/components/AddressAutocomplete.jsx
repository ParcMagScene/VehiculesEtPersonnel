import './AddressAutocomplete.css';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/design-system';

import { TIMING } from '../constants';
import api from '../utils/api';
import { isGoogleMapsLoaded, loadGoogleMapsAPI } from '../utils/googleMapsLoader';

/**
 * Composant reutilisable d'autocompletion d'adresse via Google Places API moderne.
 * - Utilise AutocompleteSuggestion (nouvelle API) au lieu de l'ancienne classe Autocomplete.
 * - Fallback gracieux: l'input reste pleinement editable meme sans API.
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
  prioritySuggestions = [],
}) {
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const requestTimerRef = useRef(null);
  const predictionByLabelRef = useRef(new Map());
  const datalistIdRef = useRef(
    list || `address-autocomplete-${Math.random().toString(36).slice(2, 10)}`,
  );

  const [placesReady, setPlacesReady] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  // Le dropdown custom n'est utilisé que pour <Input> sans `list` externe.
  const useCustomDropdown = as === 'input' && !list;

  const getPrioritySuggestions = useCallback(
    (query) => {
      const q = String(query || '')
        .trim()
        .toLowerCase();
      const all = Array.isArray(prioritySuggestions) ? prioritySuggestions : [];
      const cleaned = all
        .map((s) => String(s || '').trim())
        .filter(Boolean)
        .filter((s, i, arr) => arr.indexOf(s) === i);
      if (!q) return cleaned.slice(0, 8);
      return cleaned.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
    },
    [prioritySuggestions],
  );

  const ensurePlacesApi = useCallback(async () => {
    try {
      if (!isGoogleMapsLoaded()) {
        const configData = await api.getGoogleMapsApiKey();
        const apiKey = configData?.value;
        if (!apiKey) return false;
        await loadGoogleMapsAPI(apiKey);
      }

      if (!window.google?.maps) return false;
      if (!window.google.maps.places?.AutocompleteSuggestion && window.google.maps.importLibrary) {
        await window.google.maps.importLibrary('places');
      }

      return Boolean(window.google.maps.places?.AutocompleteSuggestion);
    } catch (error) {
      console.error('Erreur init autocomplete adresse:', error);
      return false;
    }
  }, []);

  const getPredictionLabel = useCallback((prediction) => {
    if (!prediction) return '';
    if (typeof prediction.text?.toString === 'function') return prediction.text.toString();
    if (typeof prediction.text?.text === 'string') return prediction.text.text;
    if (typeof prediction.mainText?.text === 'string') return prediction.mainText.text;
    if (typeof prediction.description === 'string') return prediction.description;
    return '';
  }, []);

  const fetchSuggestions = useCallback(
    async (query) => {
      const local = getPrioritySuggestions(query);

      if (!placesReady || !query || query.length < 3 || as !== 'input') {
        predictionByLabelRef.current.clear();
        setSuggestions(local.map((value) => ({ value, kind: 'saved' })));
        return;
      }

      try {
        const regions = Array.isArray(country) ? country : [country];
        const request = {
          input: query,
          language: 'fr',
          includedRegionCodes: regions,
        };

        const { AutocompleteSuggestion } = window.google.maps.places;
        const { suggestions: raw = [] } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

        const nextMap = new Map();
        const nextLabels = [];

        raw.forEach((item) => {
          const prediction = item?.placePrediction;
          const label = getPredictionLabel(prediction);
          if (!label || nextMap.has(label)) return;
          nextMap.set(label, prediction);
          nextLabels.push(label);
        });

        predictionByLabelRef.current = nextMap;

        // Priorité aux lieux enregistrés en DB, puis Google Places.
        const savedSet = new Set(local);
        const merged = local.map((value) => ({ value, kind: 'saved' }));
        for (const label of nextLabels) {
          if (savedSet.has(label)) continue;
          merged.push({ value: label, kind: 'place' });
          if (merged.length >= 12) break;
        }
        setSuggestions(merged);
      } catch (error) {
        console.warn('Autocomplete suggestions indisponibles:', error?.message || error);
        setSuggestions(local.map((value) => ({ value, kind: 'saved' })));
      }
    },
    [as, country, getPredictionLabel, getPrioritySuggestions, placesReady],
  );

  useEffect(() => {
    const timer = setTimeout(async () => {
      const ready = await ensurePlacesApi();
      setPlacesReady(ready);
    }, TIMING.DOUBLE_CLICK);

    return () => clearTimeout(timer);
  }, [ensurePlacesApi]);

  useEffect(() => {
    return () => {
      if (requestTimerRef.current) clearTimeout(requestTimerRef.current);
      predictionByLabelRef.current.clear();
    };
  }, []);

  // Fermer le dropdown au clic extérieur.
  useEffect(() => {
    if (!dropdownOpen) return undefined;
    const handle = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setHighlightIndex(-1);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [dropdownOpen]);

  // Reset highlight quand la liste change.
  useEffect(() => {
    setHighlightIndex(-1);
  }, [suggestions]);

  const tryEmitPlaceDetails = useCallback(
    async (label) => {
      if (!onPlaceSelect) return;
      const prediction = predictionByLabelRef.current.get(label);
      if (!prediction || typeof prediction.toPlace !== 'function') return;

      try {
        const place = prediction.toPlace();
        await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });

        const payload = {
          name: place.displayName || null,
          formatted_address: place.formattedAddress || label,
          geometry:
            place.location &&
            typeof place.location.lat === 'function' &&
            typeof place.location.lng === 'function'
              ? {
                  location: {
                    lat: () => place.location.lat(),
                    lng: () => place.location.lng(),
                  },
                }
              : null,
        };

        onPlaceSelect(payload);

        if (payload.formatted_address && payload.formatted_address !== label) {
          onChange(payload.formatted_address);
        }
      } catch (error) {
        console.warn('Impossible de charger les details du lieu:', error?.message || error);
      }
    },
    [onChange, onPlaceSelect],
  );

  const handleChange = async (e) => {
    const nextValue = e.target.value;
    onChange(nextValue);

    if (useCustomDropdown) setDropdownOpen(true);

    if (requestTimerRef.current) clearTimeout(requestTimerRef.current);
    requestTimerRef.current = setTimeout(() => {
      fetchSuggestions(nextValue);
    }, 180);

    // Si l'utilisateur choisit une suggestion (datalist), on enrichit eventuellement le lieu.
    if (predictionByLabelRef.current.has(nextValue)) {
      await tryEmitPlaceDetails(nextValue);
    }
  };

  const selectSuggestion = useCallback(
    async (item) => {
      if (!item) return;
      onChange(item.value);
      setDropdownOpen(false);
      setHighlightIndex(-1);
      if (item.kind === 'place' && predictionByLabelRef.current.has(item.value)) {
        await tryEmitPlaceDetails(item.value);
      }
    },
    [onChange, tryEmitPlaceDetails],
  );

  const handleKeyDown = (e) => {
    if (!useCustomDropdown) return;
    if (e.key === 'ArrowDown') {
      if (!dropdownOpen) {
        setDropdownOpen(true);
        fetchSuggestions(value || '');
        return;
      }
      if (suggestions.length === 0) return;
      e.preventDefault();
      setHighlightIndex((idx) => (idx + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      if (!dropdownOpen || suggestions.length === 0) return;
      e.preventDefault();
      setHighlightIndex((idx) => (idx <= 0 ? suggestions.length - 1 : idx - 1));
    } else if (e.key === 'Enter') {
      if (dropdownOpen && highlightIndex >= 0 && suggestions[highlightIndex]) {
        e.preventDefault();
        selectSuggestion(suggestions[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      if (dropdownOpen) {
        setDropdownOpen(false);
        setHighlightIndex(-1);
      }
    }
  };

  const handleFocus = () => {
    if (!useCustomDropdown) return;
    if (suggestions.length === 0) fetchSuggestions(value || '');
    setDropdownOpen(true);
  };

  const Tag = as === 'textarea' ? 'textarea' : 'input';
  const tagProps = {
    ref: inputRef,
    id,
    name,
    type: as === 'input' ? 'text' : undefined,
    value: value || '',
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onFocus: handleFocus,
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
  } else if (as === 'input' && !useCustomDropdown) {
    // eslint-disable-next-line react-hooks/refs
    tagProps.list = datalistIdRef.current;
  }

  const savedCount = suggestions.filter((s) => s.kind === 'saved').length;
  const placeCount = suggestions.length - savedCount;

  return (
    <div className="address-autocomplete-wrapper" ref={wrapperRef}>
      <Tag {...tagProps} />
      {useCustomDropdown && dropdownOpen && suggestions.length > 0 && (
        <div className="address-autocomplete-dropdown" role="listbox">
          {savedCount > 0 && (
            <div className="address-autocomplete-section-header">★ Lieux enregistrés</div>
          )}
          {suggestions.map((item, idx) => {
            const isFirstPlace =
              item.kind === 'place' && idx > 0 && suggestions[idx - 1].kind === 'saved';
            return (
              <div key={`${item.kind}-${item.value}`}>
                {isFirstPlace && (
                  <div className="address-autocomplete-section-header address-autocomplete-section-header--place">
                    Suggestions Google
                  </div>
                )}
                <Button
                  type="button"
                  role="option"
                  aria-selected={idx === highlightIndex}
                  className={`address-autocomplete-option address-autocomplete-option--${item.kind} ${
                    idx === highlightIndex ? 'is-highlighted' : ''
                  }`}
                  onMouseDown={(e) => {
                    // mousedown avant blur de l'input pour ne pas perdre la s\u00e9lection
                    e.preventDefault();
                    selectSuggestion(item);
                  }}
                  onMouseEnter={() => setHighlightIndex(idx)}
                >
                  <span className="address-autocomplete-option-icon" aria-hidden="true">
                    {item.kind === 'saved' ? '★' : '📍'}
                  </span>
                  <span className="address-autocomplete-option-label">{item.value}</span>
                </Button>
              </div>
            );
          })}
          {placeCount === 0 && savedCount > 0 && (value || '').length >= 3 && !placesReady && (
            <div className="address-autocomplete-hint">Suggestions Google indisponibles</div>
          )}
        </div>
      )}
      {!useCustomDropdown && as === 'input' && !list && suggestions.length > 0 && (
        <datalist id={datalistIdRef.current}>
          {suggestions.map((item) => (
            <option
              key={item.value}
              value={item.value}
              label={item.kind === 'saved' ? '★ Lieu enregistré' : 'Suggestion Google'}
            />
          ))}
        </datalist>
      )}
      {children}
    </div>
  );
}
