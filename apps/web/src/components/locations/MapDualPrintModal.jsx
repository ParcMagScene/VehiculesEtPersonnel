// ═══════════════════════════════════════════════════════════════
// MapDualPrintModal.jsx — Modal d'impression double carte
// Carte générale (principale) + Carte locale (encart bas-droite)
// Les deux cartes sont zoomables/glissables avant l'impression
// ═══════════════════════════════════════════════════════════════

import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { X, Printer, Download } from 'lucide-react';
import {
  TILE_LIGHT,
  DEFAULT_ZOOM,
  MAG_SCENE,
  BOUNDS_PADDING,
  filterGeoLocations,
  filterNearby,
} from './map-utils';
import { createLocationIcon, createHQIcon } from './MapMarkers';
import { STATUS_COLORS } from '../../constants/colors';

// ── Composant interne : ajuster les bounds automatiquement ──
function FitBounds({ locations }) {
  const map = useMap();
  useEffect(() => {
    if (!locations.length) return;
    const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lng]));
    map.fitBounds(bounds, { padding: BOUNDS_PADDING, maxZoom: 14 });
  }, [locations, map]);
  return null;
}

function FitToRadius({ radius }) {
  const map = useMap();
  useEffect(() => {
    const center = MAG_SCENE;
    const metersPerDeg = 40075016.686 / 360;
    const latDelta = (radius / metersPerDeg) * 1.3;
    const bounds = [
      [center[0] - latDelta, center[1] - latDelta / Math.cos(center[0] * Math.PI / 180)],
      [center[0] + latDelta, center[1] + latDelta / Math.cos(center[0] * Math.PI / 180)],
    ];
    map.fitBounds(bounds, { padding: [20, 20], animate: false });
  }, [radius, map]);
  return null;
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
        img.complete ? Promise.resolve() : new Promise((res) => {
          img.onload = res;
          img.onerror = res;
        })
      )
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
export default function MapDualPrintModal({ locations, onClose }) {
  const generalRef = useRef(null);
  const localRef = useRef(null);
  const [printing, setPrinting] = useState(false);

  const geoLocations = useMemo(() => filterGeoLocations(locations), [locations]);
  const nearbyLocations = useMemo(
    () => filterNearby(locations, MAG_SCENE, 10000),
    [locations]
  );

  const tile = TILE_LIGHT;

  // ── Fermeture par Escape ──
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
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
        alert('Impossible de capturer la carte. Vérifiez que les tuiles sont bien chargées et réessayez.');
        return;
      }

      const now = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
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
    ${localImg ? `
    <div class="map-inset">
      <div class="map-inset-label">Autour du dépôt (10 km)</div>
      <img src="${localImg}" alt="Carte locale" />
    </div>` : ''}
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
  }, []);

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
      await new Promise((res) => { mainImg.onload = res; mainImg.src = generalImg; });

      const canvas = document.createElement('canvas');
      canvas.width = mainImg.width;
      canvas.height = mainImg.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(mainImg, 0, 0);

      if (localImg) {
        const insetImg = new Image();
        insetImg.crossOrigin = 'anonymous';
        await new Promise((res) => { insetImg.onload = res; insetImg.src = localImg; });

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

  // ── Marqueurs communs avec tooltip permanent (anti-chevauchement) ──
  const DIRECTIONS = ['top', 'right', 'bottom', 'left', 'top'];
  const DIR_OFFSETS = {
    top:    [0, -24],
    right:  [14, -4],
    bottom: [0, 16],
    left:   [-14, -4],
  };

  const renderMarkers = (locs, showHQ = false) => {
    // Trier par latitude décroissante pour distribuer intelligemment
    const sorted = [...locs].sort((a, b) => b.lat - a.lat);
    // Pour chaque lieu, alterner les directions en fonction de l'index
    const getDirection = (index) => DIRECTIONS[index % DIRECTIONS.length];

    return (
      <>
        {showHQ && (
          <Marker position={MAG_SCENE} icon={createHQIcon()} zIndexOffset={1000}>
            <Tooltip permanent direction="top" offset={[0, -30]} className="map-name-tooltip">
              Mag Scène
            </Tooltip>
          </Marker>
        )}
        {sorted.map((loc, i) => {
          const dir = getDirection(i);
          return (
            <Marker
              key={loc.id}
              position={[loc.lat, loc.lng]}
              icon={loc.isCompanyLocation ? createHQIcon(32) : createLocationIcon(loc.type, { size: 30 })}
            >
              <Tooltip permanent direction={dir} offset={DIR_OFFSETS[dir]} className="map-name-tooltip">
                {loc.name}
              </Tooltip>
            </Marker>
          );
        })}
      </>
    );
  };

  return (
    <div className="dual-print-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* data-draggable-enhanced="skip" + no-drag : empêcher useDraggableModals */}
      <div className="dual-print-modal no-drag" data-draggable-enhanced="skip">
        {/* En-tête */}
        <div className="dual-print-header">
          <h2>Impression double carte</h2>
          <p className="dual-print-subtitle">
            Positionnez et zoomez les deux cartes avant d'imprimer
          </p>
          <div className="dual-print-header-actions">
            <button className="dual-print-btn-action" onClick={handleExportPNG} disabled={printing} title="Exporter en PNG">
              <Download size={16} /> PNG
            </button>
            <button className="dual-print-btn-print" onClick={handlePrint} disabled={printing} title="Imprimer">
              <Printer size={16} /> {printing ? 'Capture…' : 'Imprimer'}
            </button>
            <button className="dual-print-close" onClick={onClose} aria-label="Fermer">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Corps : les deux cartes */}
        <div className="dual-print-body">
          {/* Carte générale (principale) */}
          <div className="dual-print-main" ref={generalRef}>
            <div className="dual-print-map-label">Carte générale</div>
            <MapContainer
              center={MAG_SCENE}
              zoom={DEFAULT_ZOOM}
              className="emag-leaflet-map"
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom
              zoomControl={false}
              attributionControl={false}
              zoomSnap={0.25}
              zoomDelta={0.25}
            >
              <TileLayer url={tile.url} attribution={tile.attribution} crossOrigin="anonymous" />
              <FitBounds locations={geoLocations} />
              {renderMarkers(geoLocations)}
            </MapContainer>
          </div>

          {/* Carte locale (encart) */}
          <div className="dual-print-inset" ref={localRef}>
            <div className="dual-print-map-label">Autour du dépôt (10 km)</div>
            <MapContainer
              center={MAG_SCENE}
              zoom={12}
              className="emag-leaflet-map"
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom
              zoomControl={false}
              attributionControl={false}
              zoomSnap={0.25}
              zoomDelta={0.25}
            >
              <TileLayer url={tile.url} attribution={tile.attribution} crossOrigin="anonymous" />
              <FitToRadius radius={10000} />
              <Circle
                center={MAG_SCENE}
                radius={10000}
                pathOptions={{
                  color: '#667eea',
                  fillColor: '#667eea',
                  fillOpacity: 0.06,
                  weight: 2,
                  dashArray: '8 4',
                }}
              />
              {renderMarkers(nearbyLocations, true)}
            </MapContainer>
          </div>
        </div>

        {/* Légende */}
        <div className="dual-print-legend">
          <span className="dual-print-legend-dot" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }} /> Siège
          <span className="dual-print-legend-dot" style={{ background: STATUS_COLORS.successSoft }} /> Dépôt
          <span className="dual-print-legend-dot" style={{ background: STATUS_COLORS.info }} /> Salle de spectacle
          <span className="dual-print-legend-dot" style={{ background: STATUS_COLORS.warning }} /> Prestataire
          <span className="dual-print-legend-dot" style={{ background: STATUS_COLORS.danger }} /> Garage
          <span className="dual-print-legend-dot" style={{ background: '#94a3b8' }} /> Autre
        </div>
      </div>
    </div>
  );
}
