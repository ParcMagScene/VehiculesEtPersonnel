// ═══════════════════════════════════════════════════════════════
// MapDualPrintModal.jsx — Modal d'impression double carte
// Carte générale (principale) + Carte locale (encart bas-droite)
// Les deux cartes sont zoomables/glissables avant l'impression
// ═══════════════════════════════════════════════════════════════

import L from 'leaflet';
import { Download, Printer } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';

import { Button, Modal, ModalBody, ModalHeader } from '@/design-system';

import { STATUS_COLORS } from '../../constants/colors';
import {
  BOUNDS_PADDING,
  DEFAULT_ZOOM,
  filterGeoLocations,
  filterNearby,
  getLocationTypeClass,
  haversineDistance,
  MAG_SCENE,
  TILE_LIGHT,
} from './map-utils';
import { createHQIcon, createLocationIcon } from './MapMarkers';
import MapOffScreenIndicators from './MapOffScreenIndicators';

const MIN_RADIUS = 500;
const MAX_RADIUS = 100000;

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

// ── Composant interne : ajuster les bounds automatiquement ──
function FitBounds({ locations, enabled = true }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    if (!locations.length) return;
    const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lng]));
    map.fitBounds(bounds, { padding: BOUNDS_PADDING, maxZoom: 14 });
  }, [locations, map, enabled]);
  return null;
}

function FitToRadius({ center, radius, enabled = true }) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (!enabled || hasFittedRef.current) return;
    const metersPerDeg = 40075016.686 / 360;
    const latDelta = (radius / metersPerDeg) * 1.3;
    const bounds = [
      [center[0] - latDelta, center[1] - latDelta / Math.cos((center[0] * Math.PI) / 180)],
      [center[0] + latDelta, center[1] + latDelta / Math.cos((center[0] * Math.PI) / 180)],
    ];
    map.fitBounds(bounds, { padding: [20, 20], animate: false });
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

function SmartMarkers({ locations, showHQ = false, hqPosition = MAG_SCENE }) {
  const map = useMap();
  const [revision, setRevision] = useState(0);
  const [visibleLabelIds, setVisibleLabelIds] = useState(() => new Set());

  const DIRECTIONS = ['top', 'right', 'bottom', 'left', 'top'];
  const DIR_OFFSETS = {
    top: [0, -12],
    right: [12, 0],
    bottom: [0, 12],
    left: [-12, 0],
  };

  const sorted = useMemo(() => [...locations].sort((a, b) => b.lat - a.lat), [locations]);
  const allItems = useMemo(() => {
    const base = sorted.map((loc) => ({ ...loc, _isHQ: false }));
    if (!showHQ) return base;
    return [
      { id: '__hq__', name: 'Mag Scène', lat: hqPosition[0], lng: hqPosition[1], _isHQ: true },
      ...base,
    ];
  }, [sorted, showHQ, hqPosition]);
  const directionById = useMemo(() => {
    const dirs = {};
    allItems.forEach((loc, index) => {
      dirs[loc.id] = DIRECTIONS[index % DIRECTIONS.length];
    });
    return dirs;
  }, [allItems]);

  useMapEvents({
    moveend: () => setRevision((r) => r + 1),
    zoomend: () => setRevision((r) => r + 1),
    resize: () => setRevision((r) => r + 1),
  });

  useEffect(() => {
    setRevision((r) => r + 1);
  }, [allItems.length]);

  useEffect(() => {
    const bounds = map.getBounds();
    const size = map.getSize();
    const occupied = [];
    const visible = new Set();

    const intersects = (a, b) =>
      !(a.x + a.w + 6 < b.x || b.x + b.w + 6 < a.x || a.y + a.h + 4 < b.y || b.y + b.h + 4 < a.y);

    allItems.forEach((loc) => {
      if (!bounds.contains([loc.lat, loc.lng])) return;

      const pt = map.latLngToContainerPoint([loc.lat, loc.lng]);
      const dir = directionById[loc.id] || 'top';
      const [ox, oy] = DIR_OFFSETS[dir] || [0, -24];
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

    setVisibleLabelIds(visible);
  }, [map, allItems, directionById, revision]);

  return (
    <>
      {showHQ && (
        <Marker position={hqPosition} icon={createHQIcon()} zIndexOffset={1000}>
          {visibleLabelIds.has('__hq__') && (
            <Tooltip
              permanent
              direction="top"
              offset={DIR_OFFSETS.top}
              className="map-name-tooltip map-name-tooltip--siege"
            >
              Mag Scène
            </Tooltip>
          )}
        </Marker>
      )}
      {sorted.map((loc) => {
        const dir = directionById[loc.id] || 'top';
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
          </Marker>
        );
      })}
    </>
  );
}

// ── Fonction utilitaire : capture via html2canvas ──
async function captureElement(element) {
  if (!element) return null;
  try {
    const { default: html2canvas } = await import('html2canvas');

    // Attendre que les tiles soient chargées
    const images = element.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => {
              img.onload = res;
              img.onerror = res;
            }),
      ),
    );
    await new Promise((r) => setTimeout(r, 300));

    // Masquer les éléments inutiles avant capture
    const hideSelectors = [
      '.leaflet-control-zoom',
      '.leaflet-control-attribution',
      '.dual-print-map-label',
      '.map-search-control',
      '.map-route-toggle',
      '.map-route-panel',
      '.map-radius-control',
    ];
    const hidden = [];
    for (const sel of hideSelectors) {
      element.querySelectorAll(sel).forEach((el) => {
        hidden.push({ el, prev: el.style.display });
        el.style.display = 'none';
      });
    }

    const canvas = await html2canvas(element, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      removeContainer: true,
      imageTimeout: 15000,
      foreignObjectRendering: false,
    });

    // Restaurer les éléments masqués
    for (const { el, prev } of hidden) {
      el.style.display = prev;
    }

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('[MapDualPrint] Capture failed:', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
export default function MapDualPrintModal({
  locations,
  onClose,
  initialGeneralView = null,
  onGeneralViewChange,
  initialLocalView = null,
  onLocalViewChange,
  zoneCenter = MAG_SCENE,
  zoneRadius = 5000,
  onZoneChange,
}) {
  const generalRef = useRef(null);
  const localRef = useRef(null);
  const initialGeneralViewRef = useRef(initialGeneralView);
  const initialLocalViewRef = useRef(initialLocalView);
  const [printing, setPrinting] = useState(false);
  const localRadius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, Number(zoneRadius) || 5000));
  const bootGeneralView = initialGeneralViewRef.current;
  const bootLocalView = initialLocalViewRef.current;
  const hasInitialGeneralView = Boolean(
    bootGeneralView?.center && Number.isFinite(bootGeneralView?.zoom),
  );
  const hasInitialLocalView = Boolean(
    bootLocalView?.center && Number.isFinite(bootLocalView?.zoom),
  );

  const localCenterHandleIcon = useMemo(
    () =>
      L.divIcon({
        className: 'map-zone-center-handle',
        html: '<span></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    [],
  );

  const localRadiusHandleIcon = useMemo(
    () =>
      L.divIcon({
        className: 'map-zone-radius-handle',
        html: '<span></span>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    [],
  );

  const localRadiusHandlePosition = useMemo(
    () => destinationEast(zoneCenter, localRadius),
    [zoneCenter, localRadius],
  );

  const formatRadius = (r) => {
    if (r < 1000) return `${Math.round(r)} m`;
    const km = r / 1000;
    return `${Number((km >= 10 ? km.toFixed(1) : km.toFixed(2)).toString())} km`;
  };

  const applyZoneChange = (nextCenter, nextRadius = localRadius) => {
    if (!onZoneChange) return;
    onZoneChange({
      center: nextCenter,
      radius: Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, Math.round(nextRadius))),
    });
  };

  const geoLocations = useMemo(() => filterGeoLocations(locations), [locations]);
  const nearbyLocations = useMemo(
    () => filterNearby(locations, zoneCenter, localRadius),
    [locations, zoneCenter, localRadius],
  );
  const generalLocations = useMemo(() => {
    const nearbyIds = new Set(nearbyLocations.map((loc) => loc.id));
    return geoLocations.filter((loc) => !nearbyIds.has(loc.id));
  }, [geoLocations, nearbyLocations]);

  const tile = TILE_LIGHT;

  // ── Fermeture par Escape ──
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Impression ──
  const handlePrint = useCallback(async () => {
    setPrinting(true);
    try {
      const [generalImg, localImg] = await Promise.all([
        captureElement(generalRef.current),
        captureElement(localRef.current),
      ]);

      if (!generalImg) {
        alert(
          'Impossible de capturer la carte. Vérifiez que les tuiles sont bien chargées et réessayez.',
        );
        return;
      }

      const now = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>eM@g — Double carte</title>
  <style>
    @page { size: A3 landscape; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; }
    .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 2px solid #667eea; margin-bottom: 10px; }
    .header h1 { font-size: 16px; font-weight: 600; color: #667eea; }
    .header .date { font-size: 11px; color: #64748b; }
    .map-container { position: relative; width: 100%; aspect-ratio: 16/9; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
    .map-main { width: 100%; height: 100%; object-fit: cover; display: block; }
    .map-inset { position: absolute; bottom: 12px; right: 12px; width: 30%; border: 3px solid white; border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.25); }
    .map-inset img { width: 100%; display: block; border-radius: 3px; }
    .map-inset-label { position: absolute; top: -20px; right: 0; font-size: 9px; color: #667eea; font-weight: 600; background: white; padding: 2px 6px; border-radius: 3px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
    .footer { margin-top: 10px; text-align: center; font-size: 10px; color: #94a3b8; }
    .legend { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 8px; font-size: 10px; }
    .legend-item { display: flex; align-items: center; gap: 4px; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>eM@g — Cartographie des lieux</h1>
    <span class="date">${now}</span>
  </div>
  <div class="map-container">
    <img class="map-main" src="${generalImg}" alt="Carte générale" />
    ${
      localImg
        ? `
    <div class="map-inset">
      <div class="map-inset-label">Autour du dépôt (${formatRadius(localRadius)})</div>
      <img src="${localImg}" alt="Carte locale" />
    </div>`
        : ''
    }
  </div>
  <div class="legend">
    <div class="legend-item"><div class="legend-dot" style="background:linear-gradient(135deg,#667eea,#764ba2)"></div>Siège</div>
    <div class="legend-item"><div class="legend-dot" style="background:#22c55e"></div>Dépôt</div>
    <div class="legend-item"><div class="legend-dot" style="background:#3b82f6"></div>Salle de spectacle</div>
    <div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div>Prestataire</div>
    <div class="legend-item"><div class="legend-dot" style="background:#ef4444"></div>Garage</div>
    <div class="legend-item"><div class="legend-dot" style="background:#94a3b8"></div>Autre</div>
  </div>
  <div class="footer">eM@g — Cartographie des lieux &bull; &copy; OpenStreetMap contributors</div>
</body>
</html>`);

      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    } finally {
      setPrinting(false);
    }
  }, [localRadius]);

  // ── Export PNG ──
  const handleExportPNG = useCallback(async () => {
    setPrinting(true);
    try {
      const [generalImg, localImg] = await Promise.all([
        captureElement(generalRef.current),
        captureElement(localRef.current),
      ]);

      if (!generalImg) return;

      // Composer sur un canvas
      const mainImg = new Image();
      mainImg.crossOrigin = 'anonymous';
      await new Promise((res) => {
        mainImg.onload = res;
        mainImg.src = generalImg;
      });

      const canvas = document.createElement('canvas');
      canvas.width = mainImg.width;
      canvas.height = mainImg.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(mainImg, 0, 0);

      if (localImg) {
        const insetImg = new Image();
        insetImg.crossOrigin = 'anonymous';
        await new Promise((res) => {
          insetImg.onload = res;
          insetImg.src = localImg;
        });

        const inW = Math.round(canvas.width * 0.3);
        const inH = Math.round(insetImg.height * (inW / insetImg.width));
        const inX = canvas.width - inW - 24;
        const inY = canvas.height - inH - 24;

        // Bordure blanche
        ctx.fillStyle = 'white';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 16;
        ctx.fillRect(inX - 4, inY - 4, inW + 8, inH + 8);
        ctx.shadowBlur = 0;
        ctx.drawImage(insetImg, inX, inY, inW, inH);
      }

      const link = document.createElement('a');
      link.download = `emag-double-carte-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setPrinting(false);
    }
  }, []);

  return (
    <Modal open onClose={onClose} size="full" className="dual-print-modal no-drag">
      <ModalHeader onClose={onClose}>
        <div>
          <span>Impression double carte</span>
          <p className="dual-print-subtitle">
            Positionnez et zoomez les deux cartes avant d'imprimer
          </p>
        </div>
        <div className="dual-print-header-actions">
          <Button
            variant="ghost"
            onClick={handleExportPNG}
            disabled={printing}
            title="Exporter en PNG"
          >
            <Download size={16} /> PNG
          </Button>
          <Button variant="primary" onClick={handlePrint} disabled={printing} title="Imprimer">
            <Printer size={16} /> {printing ? 'Capture…' : 'Imprimer'}
          </Button>
        </div>
      </ModalHeader>
      <ModalBody>
        {/* Corps : les deux cartes */}
        <div className="dual-print-body">
          {/* Carte générale (principale) */}
          <div className="dual-print-main" ref={generalRef}>
            <div className="dual-print-map-label">Carte générale</div>
            <MapContainer
              center={hasInitialGeneralView ? bootGeneralView.center : MAG_SCENE}
              zoom={hasInitialGeneralView ? bootGeneralView.zoom : DEFAULT_ZOOM}
              className="emag-leaflet-map"
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom
              wheelPxPerZoomLevel={180}
              zoomControl={false}
              attributionControl={false}
              zoomSnap={0.1}
              zoomDelta={0.1}
              markerZoomAnimation={false}
              zoomAnimation={false}
            >
              <TileLayer url={tile.url} attribution={tile.attribution} crossOrigin="anonymous" />
              <FitBounds locations={generalLocations} enabled={!hasInitialGeneralView} />
              <ViewportSync onViewChange={onGeneralViewChange} />
              <MapOffScreenIndicators locations={generalLocations} />
              <SmartMarkers locations={generalLocations} />
            </MapContainer>
          </div>

          {/* Carte locale (encart) */}
          <div className="dual-print-inset" ref={localRef}>
            <div className="dual-print-map-label">
              Autour du dépôt ({formatRadius(localRadius)})
            </div>
            <MapContainer
              center={hasInitialLocalView ? bootLocalView.center : zoneCenter}
              zoom={hasInitialLocalView ? bootLocalView.zoom : 12}
              className="emag-leaflet-map"
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom
              wheelPxPerZoomLevel={180}
              zoomControl={false}
              attributionControl={false}
              zoomSnap={0.1}
              zoomDelta={0.1}
              markerZoomAnimation={false}
              zoomAnimation={false}
            >
              <TileLayer url={tile.url} attribution={tile.attribution} crossOrigin="anonymous" />
              <FitToRadius
                center={zoneCenter}
                radius={localRadius}
                enabled={!hasInitialLocalView}
              />
              <ViewportSync onViewChange={onLocalViewChange} />
              <MapOffScreenIndicators locations={nearbyLocations} />
              <Circle
                center={zoneCenter}
                radius={localRadius}
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
                icon={localCenterHandleIcon}
                draggable
                zIndexOffset={1200}
                eventHandlers={{
                  dragend: (event) => {
                    const { lat, lng } = event.target.getLatLng();
                    applyZoneChange([lat, lng], localRadius);
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -12]}>
                  Déplacer la zone
                </Tooltip>
              </Marker>

              <Marker
                position={localRadiusHandlePosition}
                icon={localRadiusHandleIcon}
                draggable
                zIndexOffset={1200}
                eventHandlers={{
                  drag: (event) => {
                    const { lat, lng } = event.target.getLatLng();
                    const nextRadius = haversineDistance(zoneCenter[0], zoneCenter[1], lat, lng);
                    applyZoneChange(zoneCenter, nextRadius);
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  Redimensionner la zone
                </Tooltip>
              </Marker>

              <SmartMarkers locations={nearbyLocations} showHQ hqPosition={MAG_SCENE} />
            </MapContainer>
          </div>
        </div>

        {/* Légende */}
        <div className="dual-print-legend">
          <span
            className="dual-print-legend-dot"
            style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
          />{' '}
          Siège
          <span
            className="dual-print-legend-dot"
            style={{ background: STATUS_COLORS.successSoft }}
          />{' '}
          Dépôt
          <span className="dual-print-legend-dot" style={{ background: STATUS_COLORS.info }} />{' '}
          Salle de spectacle
          <span
            className="dual-print-legend-dot"
            style={{ background: STATUS_COLORS.warning }}
          />{' '}
          Prestataire
          <span
            className="dual-print-legend-dot"
            style={{ background: STATUS_COLORS.danger }}
          />{' '}
          Garage
          <span className="dual-print-legend-dot" style={{ background: '#94a3b8' }} /> Autre
        </div>
      </ModalBody>
    </Modal>
  );
}
