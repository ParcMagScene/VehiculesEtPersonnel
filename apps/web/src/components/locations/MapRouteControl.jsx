// ═══════════════════════════════════════════════════════════════
// MapRouteControl.jsx — Calcul et affichage de trajet entre lieux
// ═══════════════════════════════════════════════════════════════

import L from 'leaflet';
import { ArrowDown, Clock, Navigation, RotateCcw, Ruler, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Polyline, useMap } from 'react-leaflet';

import { filterGeoLocations, haversineDistance, MAG_SCENE } from './map-utils';

function decodePolyline(encoded) {
  const points = [];
  let lat = 0,
    lng = 0,
    index = 0;
  while (index < encoded.length) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function MapRouteControl({ locations }) {
  const map = useMap();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState('hq');
  const [destination, setDestination] = useState('');
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  const geoLocations = useMemo(() => {
    const hq = { id: 'hq', name: 'Mag Scène — Siège', lat: MAG_SCENE[0], lng: MAG_SCENE[1] };
    return [hq, ...filterGeoLocations(locations).filter((l) => !l.isCompanyLocation)];
  }, [locations]);

  const getCoords = useCallback(
    (id) => {
      const loc = geoLocations.find((l) => String(l.id) === String(id));
      return loc ? [loc.lng, loc.lat] : null;
    },
    [geoLocations],
  );

  const calculateRoute = useCallback(async () => {
    const coordsA = getCoords(origin);
    const coordsB = getCoords(destination);
    if (!coordsA || !coordsB) {
      setError('Sélectionnez deux lieux');
      return;
    }

    setLoading(true);
    setError('');
    setRoute(null);

    try {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const url = `https://router.project-osrm.org/route/v1/driving/${coordsA[0]},${coordsA[1]};${coordsB[0]},${coordsB[1]}?overview=full&geometries=polyline`;
      const resp = await fetch(url, { signal: controller.signal });
      const data = await resp.json();

      if (data.code !== 'Ok' || !data.routes?.length) {
        setError('Aucun itinéraire trouvé');
        return;
      }

      const r = data.routes[0];
      const polyline = decodePolyline(r.geometry);
      const straightLine = haversineDistance(coordsA[1], coordsA[0], coordsB[1], coordsB[0]);

      setRoute({
        polyline,
        distance: r.distance,
        duration: r.duration,
        straightLine,
        originName: geoLocations.find((l) => String(l.id) === String(origin))?.name,
        destName: geoLocations.find((l) => String(l.id) === String(destination))?.name,
      });

      // Fit bounds to route
      const bounds = L.latLngBounds(polyline);
      map.fitBounds(bounds, { padding: [60, 60], animate: true });
    } catch (err) {
      if (err.name !== 'AbortError') setError('Erreur de calcul du trajet');
    } finally {
      setLoading(false);
    }
  }, [origin, destination, getCoords, geoLocations, map]);

  const handleSwap = () => {
    setOrigin(destination);
    setDestination(origin);
    setRoute(null);
  };

  const handleReset = () => {
    setOrigin('hq');
    setDestination('');
    setRoute(null);
    setError('');
  };

  // Nettoyage au démontage
  useEffect(
    () => () => {
      if (abortRef.current) abortRef.current.abort();
    },
    [],
  );

  return (
    <>
      {/* Bouton toggle */}
      <div className="map-route-toggle">
        <button
          type="button"
          className={`map-route-toggle-btn ${open ? 'active' : ''}`}
          onClick={() => setOpen(!open)}
          title="Calcul de trajet"
          aria-label="Calcul de trajet"
        >
          <Navigation size={18} />
        </button>
      </div>

      {/* Panneau de configuration */}
      {open && (
        <div className="map-route-panel">
          <div className="map-route-panel-header">
            <span>Calculer un trajet</span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                handleReset();
              }}
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="map-route-form">
            <div className="map-route-field">
              <label>Départ</label>
              <select
                value={origin}
                onChange={(e) => {
                  setOrigin(e.target.value);
                  setRoute(null);
                }}
              >
                <option value="">— Choisir —</option>
                {geoLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <button type="button" className="map-route-swap" onClick={handleSwap} title="Inverser">
              <ArrowDown size={14} />
            </button>

            <div className="map-route-field">
              <label>Arrivée</label>
              <select
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setRoute(null);
                }}
              >
                <option value="">— Choisir —</option>
                {geoLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="map-route-actions">
              <button
                type="button"
                className="map-route-calc-btn"
                onClick={calculateRoute}
                disabled={!origin || !destination || origin === destination || loading}
              >
                {loading ? 'Calcul…' : 'Calculer'}
              </button>
              {route && (
                <button type="button" className="map-route-reset-btn" onClick={handleReset}>
                  <RotateCcw size={14} /> Effacer
                </button>
              )}
            </div>

            {error && <div className="map-route-error">{error}</div>}
          </div>

          {/* Résultat */}
          {route && (
            <div className="map-route-result">
              <div className="map-route-result-row">
                <Ruler size={14} />
                <span>
                  Distance routière : <strong>{formatDistance(route.distance)}</strong>
                </span>
              </div>
              <div className="map-route-result-row">
                <Clock size={14} />
                <span>
                  Durée estimée : <strong>{formatDuration(route.duration)}</strong>
                </span>
              </div>
              <div className="map-route-result-row straight">
                <span>Vol d'oiseau : {formatDistance(route.straightLine)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tracé du trajet sur la carte */}
      {route && (
        <Polyline
          positions={route.polyline}
          pathOptions={{
            color: '#667eea',
            weight: 5,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}
    </>
  );
}
