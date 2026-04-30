// ═══════════════════════════════════════════════════════════════
// MapLocal.jsx — Carte locale autour du dépôt Mag Scène (rayon ajustable)
// ═══════════════════════════════════════════════════════════════

import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';

import {
  filterNearby,
  getLocationTypeClass,
  haversineDistance,
  MAG_SCENE,
  TILE_DARK,
  TILE_LIGHT,
} from './map-utils';
import { createHQIcon, createLocationIcon } from './MapMarkers';
import MapOffScreenIndicators from './MapOffScreenIndicators';
import MapPopup from './MapPopup';
import MapRouteControl from './MapRouteControl';
import MapSearchControl from './MapSearchControl';

const RADIUS_PRESETS = [2, 5, 10, 25, 50, 100];
const MIN_RADIUS = 500;
const MAX_RADIUS = 100000;
const DIRECTIONS = ['top', 'right', 'bottom', 'left'];
const DIR_OFFSETS = { top: [0, -12], right: [12, 0], bottom: [0, 12], left: [-12, 0] };

function destinationEast([lat, lng], distanceMeters) {
  const earthRadius = 6371000;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const angularDistance = distanceMeters / earthRadius;
  const eastBearing = Math.PI / 2;

  const lat2 = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(eastBearing),
  );
  const lng2 =
    lngRad +
    Math.atan2(
      Math.sin(eastBearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(lat2),
    );

  return [(lat2 * 180) / Math.PI, (((lng2 * 180) / Math.PI + 540) % 360) - 180];
}

function FitToRadius({ center, radius, enabled = true }) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (!enabled || hasFittedRef.current) return;
    // Ajuste le zoom pour que le cercle rentre dans la vue
    const earthCircumference = 40075016.686;
    const metersPerDeg = earthCircumference / 360;
    const latDelta = (radius / metersPerDeg) * 1.3;
    const bounds = [
      [center[0] - latDelta, center[1] - latDelta / Math.cos((center[0] * Math.PI) / 180)],
      [center[0] + latDelta, center[1] + latDelta / Math.cos((center[0] * Math.PI) / 180)],
    ];
    map.fitBounds(bounds, { padding: [20, 20], animate: true });
    hasFittedRef.current = true;
  }, [center, radius, map, enabled]);
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

function LabelCollisionManager({ locations, getDirection, offsets, onChange }) {
  const map = useMap();
  const [revision, setRevision] = useState(0);

  useMapEvents({
    moveend: () => setRevision((r) => r + 1),
    zoomend: () => setRevision((r) => r + 1),
    resize: () => setRevision((r) => r + 1),
  });

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

export default function MapLocal({
  locations,
  darkMode = false,
  onEditLocation,
  initialView = null,
  onViewChange,
  zoneCenter = MAG_SCENE,
  zoneRadius = 5000,
  onZoneChange,
}) {
  const mapRef = useRef(null);
  const [bootView] = useState(() => initialView);
  const hasInitialView = Boolean(bootView?.center && Number.isFinite(bootView?.zoom));
  const mapCenter = hasInitialView ? bootView.center : zoneCenter;
  const mapZoom = hasInitialView ? bootView.zoom : 12;
  const tile = darkMode ? TILE_DARK : TILE_LIGHT;
  const radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, Number(zoneRadius) || 5000));

  const applyZoneChange = (nextCenter, nextRadius = radius) => {
    if (!onZoneChange) return;
    onZoneChange({ center: nextCenter, radius: nextRadius });
  };

  const nearbyLocations = useMemo(
    () => filterNearby(locations, zoneCenter, radius),
    [locations, zoneCenter, radius],
  );

  const centerHandleIcon = useMemo(
    () =>
      L.divIcon({
        className: 'map-zone-center-handle',
        html: '<span></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    [],
  );

  const radiusHandleIcon = useMemo(
    () =>
      L.divIcon({
        className: 'map-zone-radius-handle',
        html: '<span></span>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    [],
  );

  const radiusHandlePosition = useMemo(
    () => destinationEast(zoneCenter, radius),
    [zoneCenter, radius],
  );

  // Directions alternées pour éviter le chevauchement des bulles
  const sortedNearby = useMemo(
    () => [...nearbyLocations].sort((a, b) => b.lat - a.lat),
    [nearbyLocations],
  );
  const [visibleLabelIds, setVisibleLabelIds] = useState(() => new Set());
  const labelDirections = useMemo(() => {
    const dirs = {};
    sortedNearby.forEach((loc, i) => {
      dirs[loc.id] = DIRECTIONS[i % DIRECTIONS.length];
    });
    return dirs;
  }, [sortedNearby]);

  const resolveDirection = useMemo(
    () => (loc, i) => labelDirections[loc.id] || DIRECTIONS[i % DIRECTIONS.length],
    [labelDirections],
  );

  const formatRadius = (r) => {
    if (r < 1000) return `${Math.round(r)} m`;
    const km = r / 1000;
    const rounded = km >= 10 ? km.toFixed(1) : km.toFixed(2);
    return `${Number(rounded)} km`;
  };

  return (
    <div className="map-wrapper">
      {/* Contrôle du rayon */}
      <div className="map-radius-control">
        <label className="map-radius-label">
          Rayon : <strong>{formatRadius(radius)}</strong>
        </label>
        <input
          type="range"
          className="map-radius-slider"
          min={MIN_RADIUS}
          max={MAX_RADIUS}
          step={500}
          value={radius}
          onChange={(e) => applyZoneChange(zoneCenter, Number(e.target.value))}
        />
        <div className="map-radius-presets">
          {RADIUS_PRESETS.map((km) => (
            <button
              type="button"
              key={km}
              className={`map-radius-preset ${radius === km * 1000 ? 'active' : ''}`}
              onClick={() => applyZoneChange(zoneCenter, km * 1000)}
            >
              {km} km
            </button>
          ))}
        </div>
      </div>

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
        <RefreshMapOnRender
          deps={[darkMode, nearbyLocations.length, radius, zoneCenter[0], zoneCenter[1]]}
        />
        <FitToRadius center={zoneCenter} radius={radius} enabled={!hasInitialView} />
        <ViewportSync onViewChange={onViewChange} />
        <MapSearchControl locations={locations} />
        <MapRouteControl locations={locations} />
        <MapOffScreenIndicators locations={nearbyLocations} />
        <LabelCollisionManager
          locations={sortedNearby}
          getDirection={resolveDirection}
          offsets={DIR_OFFSETS}
          onChange={setVisibleLabelIds}
        />

        <Circle
          center={zoneCenter}
          radius={radius}
          pathOptions={{
            color: '#667eea',
            fillColor: '#667eea',
            fillOpacity: 0.06,
            weight: 2,
            dashArray: '8 4',
          }}
        />

        <Marker
          position={zoneCenter}
          icon={centerHandleIcon}
          draggable
          zIndexOffset={1200}
          eventHandlers={{
            dragend: (event) => {
              const { lat, lng } = event.target.getLatLng();
              applyZoneChange([lat, lng], radius);
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -12]}>
            Déplacer la zone
          </Tooltip>
        </Marker>

        <Marker
          position={radiusHandlePosition}
          icon={radiusHandleIcon}
          draggable
          zIndexOffset={1200}
          eventHandlers={{
            drag: (event) => {
              const { lat, lng } = event.target.getLatLng();
              const nextRadius = Math.round(
                haversineDistance(zoneCenter[0], zoneCenter[1], lat, lng),
              );
              applyZoneChange(zoneCenter, Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, nextRadius)));
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            Redimensionner la zone
          </Tooltip>
        </Marker>

        <Marker position={MAG_SCENE} icon={createHQIcon()}>
          <Tooltip
            permanent
            direction="top"
            offset={DIR_OFFSETS.top}
            className="map-name-tooltip map-name-tooltip--siege"
          >
            Mag Scène
          </Tooltip>
          <MapPopup
            location={{
              id: 'mag-scene-hq',
              name: 'Mag Scène — Siège',
              type: 'Dépôt',
              address: 'Dépôt principal',
              lat: MAG_SCENE[0],
              lng: MAG_SCENE[1],
              isCompanyLocation: true,
            }}
          />
        </Marker>

        {sortedNearby.map((loc, i) => {
          const dir = labelDirections[loc.id] || DIRECTIONS[i % DIRECTIONS.length];
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

      <div className="map-local-info">
        {nearbyLocations.length} lieu{nearbyLocations.length !== 1 ? 'x' : ''} dans un rayon de{' '}
        {formatRadius(radius)} autour de la zone sélectionnée
      </div>
    </div>
  );
}
