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
    const edgePadding = 14;
    // Espacement minimal entre pills :
    // - bords gauche/droite : empilement vertical (hauteur ~26px + marge)
    // - bords haut/bas : empilement horizontal (pill ~140px de large)
    const minGapVertical = 32;
    const minGapHorizontal = 148;

    const withEdge = (x, y) => {
      const distances = {
        left: x,
        right: size.x - x,
        top: y,
        bottom: size.y - y,
      };
      let edge = 'left';
      let min = distances.left;
      Object.entries(distances).forEach(([key, value]) => {
        if (value < min) {
          min = value;
          edge = key;
        }
      });
      return edge;
    };

    const clampToFrame = (value, max) => Math.max(edgePadding, Math.min(max - edgePadding, value));

    const spreadOnEdge = (items, axis, max, minGap) => {
      const sorted = [...items].sort((a, b) => a[axis] - b[axis]);
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i][axis] - sorted[i - 1][axis] < minGap) {
          sorted[i][axis] = sorted[i - 1][axis] + minGap;
        }
      }
      for (let i = sorted.length - 2; i >= 0; i -= 1) {
        if (sorted[i][axis] > max - edgePadding) {
          sorted[i][axis] = max - edgePadding;
        }
        if (sorted[i + 1][axis] - sorted[i][axis] < minGap) {
          sorted[i][axis] = sorted[i + 1][axis] - minGap;
        }
      }
      sorted.forEach((item) => {
        item[axis] = clampToFrame(item[axis], max);
      });
    };

    const raw = locations
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

        ex = clampToFrame(ex, size.x);
        ey = clampToFrame(ey, size.y);

        return {
          id: loc.id,
          name: loc.name,
          lat: loc.lat,
          lng: loc.lng,
          x: ex,
          y: ey,
          angle,
          edge: withEdge(ex, ey),
        };
      });

    const byEdge = {
      left: raw.filter((item) => item.edge === 'left'),
      right: raw.filter((item) => item.edge === 'right'),
      top: raw.filter((item) => item.edge === 'top'),
      bottom: raw.filter((item) => item.edge === 'bottom'),
    };

    spreadOnEdge(byEdge.left, 'y', size.y, minGapVertical);
    spreadOnEdge(byEdge.right, 'y', size.y, minGapVertical);
    spreadOnEdge(byEdge.top, 'x', size.x, minGapHorizontal);
    spreadOnEdge(byEdge.bottom, 'x', size.x, minGapHorizontal);

    return [...byEdge.left, ...byEdge.right, ...byEdge.top, ...byEdge.bottom];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, map, revision]);

  if (!offScreen.length) return null;

  return createPortal(
    <div className="map-offscreen-layer">
      {offScreen.map((loc) => (
        <button
          type="button"
          key={loc.id}
          className={`map-offscreen-pill edge-${loc.edge}`}
          style={{ left: loc.x, top: loc.y }}
          onClick={() => map.flyTo([loc.lat, loc.lng], 14)}
          title={`Aller vers ${loc.name}`}
        >
          <svg
            className="map-offscreen-arrow"
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden="true"
            style={{ transform: `rotate(${loc.angle * (180 / Math.PI)}deg)` }}
          >
            {/* Flèche pointant vers la droite (référence 0°) */}
            <path
              d="M2 8 L11 8 M11 8 L7 4 M11 8 L7 12"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span className="map-offscreen-label">{loc.name}</span>
        </button>
      ))}
    </div>,
    map.getContainer(),
  );
}
