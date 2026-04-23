// ═══════════════════════════════════════════════════════════════
// MapGeneral.jsx — Carte générale de tous les lieux géolocalisés
// ═══════════════════════════════════════════════════════════════

import L from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';

import {
  BOUNDS_PADDING,
  DEFAULT_ZOOM,
  filterGeoLocations,
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
const DIR_OFFSETS = { top: [0, -11], right: [7, -1], bottom: [0, 9], left: [-7, -1] };

function sameSet(a, b) {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
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

  useEffect(() => {
    const raf = requestAnimationFrame(() => map.invalidateSize());
    const timer = setTimeout(() => map.invalidateSize(), 120);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [map, ...deps]);

  return null;
}

function LabelCollisionManager({ locations, getDirection, offsets, onChange }) {
  const map = useMap();
  const [revision, setRevision] = useState(0);

  useMapEvents({
    moveend: () => setRevision((r) => r + 1),
    zoomend: () => setRevision((r) => r + 1),
    resize: () => setRevision((r) => r + 1),
  });

  useEffect(() => {
    setRevision((r) => r + 1);
  }, [locations.length]);

  useEffect(() => {
    const bounds = map.getBounds();
    const size = map.getSize();
    const occupied = [];
    const visible = new Set();

    const intersects = (a, b) =>
      !(a.x + a.w + 6 < b.x || b.x + b.w + 6 < a.x || a.y + a.h + 4 < b.y || b.y + b.h + 4 < a.y);

    locations.forEach((loc, index) => {
      if (!bounds.contains([loc.lat, loc.lng])) return;

      const pt = map.latLngToContainerPoint([loc.lat, loc.lng]);
      const dir = getDirection(loc, index);
      const [ox, oy] = offsets[dir] || [0, -24];
      const width = Math.min(260, Math.max(88, (loc.name?.length || 0) * 8 + 24));
      const height = 28;

      let x = pt.x;
      let y = pt.y;
      if (dir === 'top') {
        x = pt.x + ox - width / 2;
        y = pt.y + oy - height;
      } else if (dir === 'bottom') {
        x = pt.x + ox - width / 2;
        y = pt.y + oy;
      } else if (dir === 'right') {
        x = pt.x + ox;
        y = pt.y + oy - height / 2;
      } else {
        x = pt.x + ox - width;
        y = pt.y + oy - height / 2;
      }

      const box = { x, y, w: width, h: height };

      if (box.x < 0 || box.y < 0 || box.x + box.w > size.x || box.y + box.h > size.y) return;
      if (occupied.some((other) => intersects(box, other))) return;

      occupied.push(box);
      visible.add(loc.id);
    });

    onChange(visible);
  }, [map, locations, getDirection, offsets, onChange, revision]);

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
  const initialViewRef = useRef(initialView);
  const [ready, setReady] = useState(false);
  const geoLocations = useMemo(() => filterGeoLocations(locations), [locations]);
  const tile = darkMode ? TILE_DARK : TILE_LIGHT;
  const bootView = initialViewRef.current;
  const hasInitialView = Boolean(bootView?.center && Number.isFinite(bootView?.zoom));
  const mapCenter = hasInitialView ? bootView.center : MAG_SCENE;
  const mapZoom = hasInitialView ? bootView.zoom : DEFAULT_ZOOM;
  const [visibleLabelIds, setVisibleLabelIds] = useState(() => new Set());
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

  const resolveDirection = useMemo(
    () => (loc) => labelDirections[loc.id] || 'top',
    [labelDirections],
  );

  const handleVisibleLabelsChange = useCallback((nextVisibleIds) => {
    setVisibleLabelIds((prevVisibleIds) =>
      sameSet(prevVisibleIds, nextVisibleIds) ? prevVisibleIds : nextVisibleIds,
    );
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
          <LabelCollisionManager
            locations={sortedLocs}
            getDirection={resolveDirection}
            offsets={DIR_OFFSETS}
            onChange={handleVisibleLabelsChange}
          />

          {sortedLocs.map((loc) => {
            const dir = labelDirections[loc.id] || 'top';
            return (
              <Marker
                key={loc.id}
                position={[loc.lat, loc.lng]}
                icon={loc.isCompanyLocation ? createHQIcon() : createLocationIcon(loc.type)}
              >
                {visibleLabelIds.has(loc.id) && (
                  <Tooltip
                    permanent
                    direction={dir}
                    offset={DIR_OFFSETS[dir]}
                    className="map-name-tooltip"
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
