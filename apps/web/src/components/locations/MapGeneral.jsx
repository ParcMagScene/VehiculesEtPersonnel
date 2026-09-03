// ═══════════════════════════════════════════════════════════════
// MapGeneral.jsx — Carte générale de tous les lieux géolocalisés
// ═══════════════════════════════════════════════════════════════

import L from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';

import { computeLabelPlacements } from './map-label-placement';
import {
  BOUNDS_PADDING,
  DEFAULT_ZOOM,
  filterGeoLocations,
  getLocationTypeClass,
  MAG_SCENE,
  TILE_DARK,
  TILE_LIGHT,
} from './map-utils';
import { createHQIcon, createLocationIcon } from './MapMarkers';
import MapOffScreenIndicators from './MapOffScreenIndicators';
import MapPopup from './MapPopup';
import MapRouteControl from './MapRouteControl';
import MapSearchControl from './MapSearchControl';

const DIRECTIONS = ['top', 'right', 'bottom', 'left'];

function sameMap(a, b) {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    const other = b.get(key);
    if (!other) return false;
    if (other.dir !== value.dir) return false;
    if (other.offset[0] !== value.offset[0] || other.offset[1] !== value.offset[1]) return false;
  }
  return true;
}

function FitBoundsOnLoad({ locations, enabled = true }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    if (locations.length === 0) return;
    const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lng]));
    map.fitBounds(bounds, { padding: BOUNDS_PADDING, maxZoom: 10 });
  }, [locations, map, enabled]);

  return null;
}

function ViewportSync({ onViewChange }) {
  const map = useMap();

  useEffect(() => {
    if (!onViewChange) return undefined;

    const emit = () => {
      const center = map.getCenter();
      onViewChange({ center: [center.lat, center.lng], zoom: map.getZoom() });
    };

    map.on('moveend', emit);
    map.on('zoomend', emit);
    emit();

    return () => {
      map.off('moveend', emit);
      map.off('zoomend', emit);
    };
  }, [map, onViewChange]);

  return null;
}

function RefreshMapOnRender({ deps = [] }) {
  const map = useMap();
  const depsKey = useMemo(() => JSON.stringify(deps), [deps]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => map.invalidateSize());
    const timer = setTimeout(() => map.invalidateSize(), 120);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [map, depsKey]);

  return null;
}

function LabelPlacementManager({ locations, preferredDirections, onChange }) {
  const map = useMap();
  const [revision, setRevision] = useState(0);

  useMapEvents({
    moveend: () => setRevision((r) => r + 1),
    zoomend: () => setRevision((r) => r + 1),
    resize: () => setRevision((r) => r + 1),
  });

  useEffect(() => {
    const placements = computeLabelPlacements({
      map,
      locations,
      preferredDirections,
      frameInset: 32,
    });
    onChange(placements);
  }, [map, locations, preferredDirections, onChange, revision]);

  return null;
}

export default function MapGeneral({
  locations,
  darkMode = false,
  onEditLocation,
  initialView = null,
  onViewChange,
}) {
  const mapRef = useRef(null);
  const [bootView] = useState(() => initialView);
  const [ready, setReady] = useState(false);
  const geoLocations = useMemo(() => filterGeoLocations(locations), [locations]);
  const tile = darkMode ? TILE_DARK : TILE_LIGHT;
  const hasInitialView = Boolean(bootView?.center && Number.isFinite(bootView?.zoom));
  const mapCenter = hasInitialView ? bootView.center : MAG_SCENE;
  const mapZoom = hasInitialView ? bootView.zoom : DEFAULT_ZOOM;
  const [labelPlacements, setLabelPlacements] = useState(() => new Map());
  const sortedLocs = useMemo(() => [...geoLocations].sort((a, b) => b.lat - a.lat), [geoLocations]);

  // Calcul de la meilleure direction pour chaque label (évite les voisins proches)
  const labelDirections = useMemo(() => {
    const dirs = {};
    const locs = sortedLocs;
    for (let i = 0; i < locs.length; i++) {
      const loc = locs[i];
      // Scores par direction : plus le score est élevé, moins il y a de conflit
      const scores = { top: 0, right: 0, bottom: 0, left: 0 };
      for (let j = 0; j < locs.length; j++) {
        if (i === j) continue;
        const other = locs[j];
        const dlat = other.lat - loc.lat;
        const dlng = other.lng - loc.lng;
        const dist = Math.sqrt(dlat * dlat + dlng * dlng);
        if (dist > 0.02) continue; // ignorer les marqueurs éloignés
        const weight = 1 / (dist + 0.0001);
        // Pénaliser la direction vers le voisin
        if (dlat > 0) scores.top -= weight; // voisin au-dessus → éviter top
        if (dlat < 0) scores.bottom -= weight;
        if (dlng > 0) scores.right -= weight;
        if (dlng < 0) scores.left -= weight;
      }
      // Pénaliser les directions déjà utilisées par les voisins proches
      for (let j = 0; j < locs.length; j++) {
        if (i === j || !dirs[locs[j].id]) continue;
        const other = locs[j];
        const dist = Math.sqrt((other.lat - loc.lat) ** 2 + (other.lng - loc.lng) ** 2);
        if (dist > 0.01) continue;
        scores[dirs[other.id]] -= 2;
      }
      const best = DIRECTIONS.reduce((a, b) => (scores[a] >= scores[b] ? a : b));
      dirs[loc.id] = best;
    }
    return dirs;
  }, [sortedLocs]);

  const handlePlacementsChange = useCallback((nextPlacements) => {
    setLabelPlacements((prev) => (sameMap(prev, nextPlacements) ? prev : nextPlacements));
  }, []);

  return (
    <div
      className="map-wrapper"
      ref={(el) => {
        if (el && !ready) setReady(true);
      }}
    >
      {geoLocations.length === 0 ? (
        <div className="map-empty-state">
          <p>Aucun lieu géolocalisé à afficher.</p>
          <p>Ajoutez des coordonnées GPS à vos lieux pour les voir sur la carte.</p>
        </div>
      ) : (
        <MapContainer
          ref={mapRef}
          center={mapCenter}
          zoom={mapZoom}
          className="emag-leaflet-map"
          style={{ width: '100%', height: '100%' }}
          markerZoomAnimation={false}
          zoomAnimation={false}
          scrollWheelZoom
          wheelPxPerZoomLevel={180}
          zoomSnap={0.1}
          zoomDelta={0.1}
          zoomControl
        >
          <TileLayer url={tile.url} attribution={tile.attribution} crossOrigin="anonymous" />
          <RefreshMapOnRender deps={[darkMode, geoLocations.length]} />
          <FitBoundsOnLoad locations={geoLocations} enabled={!hasInitialView} />
          <ViewportSync onViewChange={onViewChange} />
          <MapSearchControl locations={locations} />
          <MapRouteControl locations={locations} />
          <MapOffScreenIndicators locations={geoLocations} />
          <LabelPlacementManager
            locations={sortedLocs}
            preferredDirections={labelDirections}
            onChange={handlePlacementsChange}
          />

          {sortedLocs.map((loc) => {
            const placement = labelPlacements.get(loc.id);
            return (
              <Marker
                key={loc.id}
                position={[loc.lat, loc.lng]}
                icon={loc.isCompanyLocation ? createHQIcon() : createLocationIcon(loc.type)}
              >
                {placement && (
                  <Tooltip
                    permanent
                    direction={placement.dir}
                    offset={placement.offset}
                    className={`map-name-tooltip map-name-tooltip--${getLocationTypeClass(loc.type, { isCompanyLocation: loc.isCompanyLocation })}`}
                  >
                    {loc.name}
                  </Tooltip>
                )}
                <MapPopup location={loc} onEdit={onEditLocation} />
              </Marker>
            );
          })}
        </MapContainer>
      )}
    </div>
  );
}
