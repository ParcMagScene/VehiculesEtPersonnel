// ═══════════════════════════════════════════════════════════════
// MapGeneral.jsx — Carte générale de tous les lieux géolocalisés
// ═══════════════════════════════════════════════════════════════

import { useMemo, useRef, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  TILE_LIGHT,
  TILE_DARK,
  DEFAULT_ZOOM,
  MAG_SCENE,
  BOUNDS_PADDING,
  filterGeoLocations,
} from './map-utils';
import { createLocationIcon, createHQIcon } from './MapMarkers';
import MapPopup from './MapPopup';
import MapSearchControl from './MapSearchControl';
import MapRouteControl from './MapRouteControl';
import MapOffScreenIndicators from './MapOffScreenIndicators';

function FitBoundsOnLoad({ locations }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) return;
    const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lng]));
    map.fitBounds(bounds, { padding: BOUNDS_PADDING, maxZoom: 14 });
  }, [locations, map]);

  return null;
}

export default function MapGeneral({ locations, darkMode = false, onEditLocation }) {
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const geoLocations = useMemo(() => filterGeoLocations(locations), [locations]);
  const tile = darkMode ? TILE_DARK : TILE_LIGHT;

  // Directions alternées pour éviter le chevauchement des bulles
  const DIRECTIONS = ['top', 'right', 'bottom', 'left'];
  const DIR_OFFSETS = { top: [0, -28], right: [14, -4], bottom: [0, 16], left: [-14, -4] };
  const sortedLocs = useMemo(() => [...geoLocations].sort((a, b) => b.lat - a.lat), [geoLocations]);

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

          {sortedLocs.map((loc, i) => {
            const dir = DIRECTIONS[i % DIRECTIONS.length];
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
