// ═══════════════════════════════════════════════════════════════
// MapOffScreenIndicators — Flèches directionnelles pour les
// marqueurs hors champ visible de la carte
// ═══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap, useMapEvents } from 'react-leaflet';

export default function MapOffScreenIndicators({ locations }) {
  const map = useMap();
  const [revision, setRevision] = useState(0);

  const bump = useCallback(() => setRevision((r) => r + 1), []);

  useMapEvents({ moveend: bump, zoomend: bump });
  useEffect(() => {
    bump();
  }, [bump]);

  const offScreen = useMemo(() => {
    if (!locations.length) return [];
    const bounds = map.getBounds();
    const size = map.getSize();
    const center = { x: size.x / 2, y: size.y / 2 };
    const margin = 48;

    return locations
      .filter((loc) => !bounds.contains([loc.lat, loc.lng]))
      .map((loc) => {
        const pt = map.latLngToContainerPoint([loc.lat, loc.lng]);
        const dx = pt.x - center.x;
        const dy = pt.y - center.y;
        const angle = Math.atan2(dy, dx);

        const hw = size.x / 2;
        const hh = size.y / 2;
        const tanA = Math.tan(angle);
        let ex, ey;

        const xEdge = dx > 0 ? hw : -hw;
        const yAtX = xEdge * tanA;

        if (Math.abs(yAtX) <= hh) {
          ex = center.x + xEdge;
          ey = center.y + yAtX;
        } else {
          const yEdge = dy > 0 ? hh : -hh;
          ex = center.x + yEdge / tanA;
          ey = center.y + yEdge;
        }

        ex = Math.max(margin, Math.min(size.x - margin, ex));
        ey = Math.max(margin, Math.min(size.y - margin, ey));

        return { id: loc.id, name: loc.name, lat: loc.lat, lng: loc.lng, x: ex, y: ey, angle };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, map, revision]);

  if (!offScreen.length) return null;

  return createPortal(
    <div className="map-offscreen-layer">
      {offScreen.map((loc) => (
        <button
          key={loc.id}
          className="map-offscreen-pill"
          style={{ left: loc.x, top: loc.y }}
          onClick={() => map.flyTo([loc.lat, loc.lng], 14)}
          title={`Aller vers ${loc.name}`}
        >
          <span
            className="map-offscreen-arrow"
            style={{ transform: `rotate(${loc.angle * (180 / Math.PI)}deg)` }}
          >
            ▸
          </span>
          <span className="map-offscreen-label">{loc.name}</span>
        </button>
      ))}
    </div>,
    map.getContainer(),
  );
}
