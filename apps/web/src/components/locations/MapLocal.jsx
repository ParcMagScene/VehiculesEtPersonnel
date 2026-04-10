// ═══════════════════════════════════════════════════════════════
// MapLocal.jsx — Carte locale autour du dépôt Mag Scène (rayon ajustable)
// ═══════════════════════════════════════════════════════════════

import { useMemo, useRef, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Tooltip, useMap } from 'react-leaflet';
import {
  TILE_LIGHT,
  TILE_DARK,
  MAG_SCENE,
  filterNearby,
} from './map-utils';
import { createLocationIcon, createHQIcon } from './MapMarkers';
import MapPopup from './MapPopup';
import MapSearchControl from './MapSearchControl';
import MapRouteControl from './MapRouteControl';

const RADIUS_PRESETS = [2, 5, 10, 25, 50, 100];

function FitToRadius({ radius }) {
  const map = useMap();
  useEffect(() => {
    // Ajuste le zoom pour que le cercle rentre dans la vue
    const center = MAG_SCENE;
    const earthCircumference = 40075016.686;
    const metersPerDeg = earthCircumference / 360;
    const latDelta = (radius / metersPerDeg) * 1.3;
    const bounds = [
      [center[0] - latDelta, center[1] - latDelta / Math.cos(center[0] * Math.PI / 180)],
      [center[0] + latDelta, center[1] + latDelta / Math.cos(center[0] * Math.PI / 180)],
    ];
    map.fitBounds(bounds, { padding: [20, 20], animate: true });
  }, [radius, map]);
  return null;
}

export default function MapLocal({ locations, darkMode = false, onEditLocation }) {
  const mapRef = useRef(null);
  const [radius, setRadius] = useState(5000); // 5 km par défaut
  const tile = darkMode ? TILE_DARK : TILE_LIGHT;

  const nearbyLocations = useMemo(
    () => filterNearby(locations, MAG_SCENE, radius),
    [locations, radius]
  );

  // Directions alternées pour éviter le chevauchement des bulles
  const DIRECTIONS = ['top', 'right', 'bottom', 'left'];
  const DIR_OFFSETS = { top: [0, -24], right: [14, -4], bottom: [0, 16], left: [-14, -4] };
  const sortedNearby = useMemo(
    () => [...nearbyLocations].sort((a, b) => b.lat - a.lat),
    [nearbyLocations]
  );

  const formatRadius = (r) => r >= 1000 ? `${r / 1000} km` : `${r} m`;

  return (
    <div className="map-wrapper">
      {/* Contrôle du rayon */}
      <div className="map-radius-control">
        <label className="map-radius-label">Rayon : <strong>{formatRadius(radius)}</strong></label>
        <input
          type="range"
          className="map-radius-slider"
          min={500}
          max={100000}
          step={500}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
        />
        <div className="map-radius-presets">
          {RADIUS_PRESETS.map((km) => (
            <button
              key={km}
              className={`map-radius-preset ${radius === km * 1000 ? 'active' : ''}`}
              onClick={() => setRadius(km * 1000)}
            >
              {km} km
            </button>
          ))}
        </div>
      </div>

      <MapContainer
        ref={mapRef}
        center={MAG_SCENE}
        zoom={12}
        className="emag-leaflet-map"
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom
        zoomControl
      >
        <TileLayer url={tile.url} attribution={tile.attribution} crossOrigin="anonymous" />
        <FitToRadius radius={radius} />
        <MapSearchControl locations={locations} />
        <MapRouteControl locations={locations} />

        <Circle
          center={MAG_SCENE}
          radius={radius}
          pathOptions={{
            color: '#667eea',
            fillColor: '#667eea',
            fillOpacity: 0.06,
            weight: 2,
            dashArray: '8 4',
          }}
        />

        <Marker position={MAG_SCENE} icon={createHQIcon()}>
          <Tooltip permanent direction="top" offset={[0, -30]} className="map-name-tooltip">
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
          const dir = DIRECTIONS[i % DIRECTIONS.length];
          return (
            <Marker
              key={loc.id}
              position={[loc.lat, loc.lng]}
              icon={loc.isCompanyLocation ? createHQIcon() : createLocationIcon(loc.type)}
            >
              <Tooltip permanent direction={dir} offset={DIR_OFFSETS[dir]} className="map-name-tooltip">
                {loc.name}
              </Tooltip>
              <MapPopup location={loc} onEdit={onEditLocation} />
            </Marker>
          );
        })}
      </MapContainer>

      <div className="map-local-info">
        {nearbyLocations.length} lieu{nearbyLocations.length !== 1 ? 'x' : ''} dans un rayon de {formatRadius(radius)}
      </div>
    </div>
  );
}
