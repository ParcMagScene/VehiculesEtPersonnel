// ═══════════════════════════════════════════════════════════════
// MapGeneral.jsx — Carte générale de tous les lieux géolocalisés
// ═══════════════════════════════════════════════════════════════

import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';

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

function FitBoundsOnLoad({ locations }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) return;
    const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lng]));
    map.fitBounds(bounds, { padding: BOUNDS_PADDING, maxZoom: 10 });
  }, [locations, map]);

  return null;
}

export default function MapGeneral({ locations, darkMode = false, onEditLocation }) {
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const geoLocations = useMemo(() => filterGeoLocations(locations), [locations]);
  const tile = darkMode ? TILE_DARK : TILE_LIGHT;

  // Directions intelligentes pour éviter le chevauchement des bulles
  const DIRECTIONS = ['top', 'right', 'bottom', 'left'];
  const DIR_OFFSETS = { top: [0, -28], right: [14, -4], bottom: [0, 16], left: [-14, -4] };
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
          center={MAG_SCENE}
          zoom={DEFAULT_ZOOM}
          className="emag-leaflet-map"
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom
          zoomControl
        >
          <TileLayer url={tile.url} attribution={tile.attribution} crossOrigin="anonymous" />
          <FitBoundsOnLoad locations={geoLocations} />
          <MapSearchControl locations={locations} />
          <MapRouteControl locations={locations} />
          <MapOffScreenIndicators locations={geoLocations} />

          {sortedLocs.map((loc) => {
            const dir = labelDirections[loc.id] || 'top';
            return (
              <Marker
                key={loc.id}
                position={[loc.lat, loc.lng]}
                icon={loc.isCompanyLocation ? createHQIcon() : createLocationIcon(loc.type)}
              >
                <Tooltip
                  permanent
                  direction={dir}
                  offset={DIR_OFFSETS[dir]}
                  className="map-name-tooltip"
                >
                  {loc.name}
                </Tooltip>
                <MapPopup location={loc} onEdit={onEditLocation} />
              </Marker>
            );
          })}
        </MapContainer>
      )}
    </div>
  );
}
