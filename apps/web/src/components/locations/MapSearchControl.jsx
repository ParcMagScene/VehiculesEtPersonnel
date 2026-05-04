// ═══════════════════════════════════════════════════════════════
// MapSearchControl.jsx — Recherche de lieux et adresses sur la carte
// ═══════════════════════════════════════════════════════════════

import { Globe, MapPin, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';

import { filterGeoLocations } from './map-utils';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function MapSearchControl({ locations }) {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const abortRef = useRef(null);

  const debouncedQuery = useDebounce(query, 300);

  // Fermer au clic extérieur
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Recherche combinée : lieux locaux + Nominatim
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);

      // 1. Lieux locaux correspondants
      const q = debouncedQuery.toLowerCase();
      const geoLocs = filterGeoLocations(locations);
      const localResults = geoLocs
        .filter(
          (loc) =>
            loc.name?.toLowerCase().includes(q) ||
            loc.address?.toLowerCase().includes(q) ||
            loc.type?.toLowerCase().includes(q),
        )
        .slice(0, 5)
        .map((loc) => ({
          type: 'local',
          id: loc.id,
          name: loc.name,
          detail: loc.address || loc.type || '',
          lat: loc.lat,
          lng: loc.lng,
        }));

      // 2. Geocoding Nominatim (adresses externes)
      let nominatimResults = [];
      try {
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debouncedQuery)}&limit=5&countrycodes=fr&accept-language=fr`;
        const resp = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'eM@g-app' },
        });
        const data = await resp.json();

        nominatimResults = data.map((item) => ({
          type: 'nominatim',
          id: `nom-${item.place_id}`,
          name: item.display_name.split(',')[0],
          detail: item.display_name.split(',').slice(1, 3).join(',').trim(),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }));
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('Nominatim search error:', err);
      }

      setResults([...localResults, ...nominatimResults]);
      setLoading(false);
      setOpen(true);
    };

    search();
  }, [debouncedQuery, locations]);

  const handleSelect = useCallback(
    (result) => {
      map.flyTo([result.lat, result.lng], 15, { duration: 0.8 });
      setQuery(result.name);
      setOpen(false);
    },
    [map],
  );

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="map-search-control" ref={wrapperRef}>
      <div className="map-search-input-wrapper">
        <Search size={16} className="map-search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="map-search-input"
          placeholder="Rechercher un lieu ou une adresse…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="map-search-clear"
            onClick={handleClear}
            aria-label="Effacer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="map-search-results" role="listbox">
          {results.map((r) => (
            <li
              key={r.id}
              className="map-search-result-item"
              role="option"
              aria-selected={false}
              onClick={() => handleSelect(r)}
            >
              {r.type === 'local' ? (
                <MapPin size={14} className="map-search-result-icon local" />
              ) : (
                <Globe size={14} className="map-search-result-icon nominatim" />
              )}
              <div className="map-search-result-text">
                <span className="map-search-result-name">{r.name}</span>
                {r.detail && <span className="map-search-result-detail">{r.detail}</span>}
              </div>
              {r.type === 'local' && <span className="map-search-result-badge">Enregistré</span>}
            </li>
          ))}
          {loading && <li className="map-search-loading">Recherche…</li>}
        </ul>
      )}

      {open && results.length === 0 && query.length >= 2 && !loading && (
        <div className="map-search-results">
          <div className="map-search-empty">Aucun résultat</div>
        </div>
      )}
    </div>
  );
}
