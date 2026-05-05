// ============================================================
// DepotMapFocused.jsx — Vue plan focalisée sur une zone
// Affichage en lecture seule : toutes les zones + marqueur de
// localisation (pin) sur la zone cible. Pas de recherche, pas
// d'éditeur, pas de légende interactive.
// ============================================================

import './DepotMap.css';

import { Layers, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Tooltip } from '@/design-system';

import { STATUS_COLORS } from '../../constants/colors';
import { computeZonesBounds, getZonePoints, hasSkew } from './DepotMapEditor';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.3;
const BOUNDS_PADDING = 40;

// Recherche flexible de zone : exact → codes → préfixe
function findZoneFlexible(zoneList, zoneId) {
  if (!zoneList || !zoneId) return null;
  const exact = zoneList.find((z) => z.id === zoneId || z.codes?.includes(zoneId));
  if (exact) return exact;
  const upper = zoneId.toUpperCase();
  return (
    zoneList.find(
      (z) => z.id.toUpperCase().startsWith(upper) || upper.startsWith(z.id.toUpperCase()),
    ) || null
  );
}

export default function DepotMapFocused({ zones, focusZoneId, focusEquipmentName }) {
  const [activeFloor, setActiveFloor] = useState('RDC');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const svgRef = useRef(null);
  const lastTouchRef = useRef(null);
  const lastPinchRef = useRef(null);

  // Auto-switch to the floor of the focused zone
  useEffect(() => {
    if (focusZoneId && zones?.zones) {
      const zone = findZoneFlexible(zones.zones, focusZoneId);
      if (zone?.floor) setActiveFloor(zone.floor);
    }
  }, [focusZoneId, zones]);

  const floors = zones?.floors || [
    { id: 'RDC', label: 'Rez-de-chaussée' },
    { id: 'MEZZ', label: 'Mezzanine' },
  ];

  const floorZones = useMemo(() => {
    if (!zones?.zones) return [];
    return zones.zones.filter((z) => z.floor === activeFloor);
  }, [zones, activeFloor]);

  const visibleZones = useMemo(() => {
    if (floorZones.length > 0) return floorZones;
    return zones?.zones || [];
  }, [floorZones, zones]);

  const bounds = useMemo(() => computeZonesBounds(visibleZones, BOUNDS_PADDING), [visibleZones]);

  const viewBox = useMemo(() => {
    const w = bounds.w / zoom;
    const h = bounds.h / zoom;
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    return `${cx - w / 2 - pan.x} ${cy - h / 2 - pan.y} ${w} ${h}`;
  }, [zoom, pan, bounds]);

  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  const handleZoomOut = () => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
  }, []);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (svgEl) {
      svgEl.addEventListener('wheel', handleWheel, { passive: false });
      return () => svgEl.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // Pan handlers (mouse)
  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };
  const handleMouseUp = () => setIsPanning(false);

  // Touch handlers
  const handleTouchStart = useCallback(
    (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchRef.current = Math.hypot(dx, dy);
        lastTouchRef.current = null;
      } else if (e.touches.length === 1 && zoom > 1) {
        lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        lastPinchRef.current = null;
      }
    },
    [zoom],
  );

  const handleTouchMove = useCallback(
    (e) => {
      e.preventDefault();
      if (e.touches.length === 2 && lastPinchRef.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * (dist / lastPinchRef.current))));
        lastPinchRef.current = dist;
      } else if (e.touches.length === 1 && lastTouchRef.current && zoom > 1) {
        const dx = e.touches[0].clientX - lastTouchRef.current.x;
        const dy = e.touches[0].clientY - lastTouchRef.current.y;
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    },
    [zoom],
  );

  const handleTouchEnd = useCallback(() => {
    lastTouchRef.current = null;
    lastPinchRef.current = null;
  }, []);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (svgEl) {
      svgEl.addEventListener('touchstart', handleTouchStart, { passive: false });
      svgEl.addEventListener('touchmove', handleTouchMove, { passive: false });
      svgEl.addEventListener('touchend', handleTouchEnd);
      return () => {
        svgEl.removeEventListener('touchstart', handleTouchStart);
        svgEl.removeEventListener('touchmove', handleTouchMove);
        svgEl.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const focusedZone = useMemo(
    () => findZoneFlexible(visibleZones, focusZoneId),
    [visibleZones, focusZoneId],
  );

  return (
    <div className="depot-map-container">
      {/* Header minimal */}
      <div className="depot-map-header">
        <div className="depot-map-title" />
        <div className="depot-map-controls">
          {/* Zoom */}
          <div className="depot-zoom-controls">
            <Tooltip content="Dézoomer">
              <Button
                variant="ghost"
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= MIN_ZOOM}
              >
                <ZoomOut size={16} />
              </Button>
            </Tooltip>
            <span className="depot-zoom-level">{Math.round(zoom * 100)}%</span>
            <Tooltip content="Zoomer">
              <Button
                variant="ghost"
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= MAX_ZOOM}
              >
                <ZoomIn size={16} />
              </Button>
            </Tooltip>
            <Tooltip content="Vue d'ensemble">
              <Button variant="ghost" type="button" onClick={handleZoomReset}>
                <Maximize2 size={14} />
              </Button>
            </Tooltip>
          </div>
          {/* Sélecteur d'étage */}
          <div className="depot-floor-selector">
            {floors.map((f) => (
              <Button
                variant="ghost"
                type="button"
                key={f.id}
                className={`depot-floor-btn ${activeFloor === f.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveFloor(f.id);
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
              >
                <Layers size={14} />
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Map */}
      <div className="depot-map-svg-wrapper u-relative">
        <svg
          ref={svgRef}
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          className={`depot-map-svg ${isPanning ? 'panning' : ''}`}
          aria-label={`Plan ${activeFloor} — Zone ${focusZoneId}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Background */}
          <rect
            x={bounds.x}
            y={bounds.y}
            width={bounds.w}
            height={bounds.h}
            rx="8"
            fill="#1e1e2e"
            stroke="#334155"
            strokeWidth="2"
          />

          {/* Grille deco */}
          {Array.from({ length: Math.floor(bounds.w / 77) + 1 }, (_, i) => (
            <line
              key={`gv-${i}`}
              x1={bounds.x + i * 77}
              y1={bounds.y}
              x2={bounds.x + i * 77}
              y2={bounds.y + bounds.h}
              stroke="#ffffff08"
              strokeWidth="0.5"
            />
          ))}
          {Array.from({ length: Math.floor(bounds.h / 73) + 1 }, (_, i) => (
            <line
              key={`gh-${i}`}
              x1={bounds.x}
              y1={bounds.y + i * 73}
              x2={bounds.x + bounds.w}
              y2={bounds.y + i * 73}
              stroke="#ffffff08"
              strokeWidth="0.5"
            />
          ))}

          {/* Zones — lecture seule */}
          {visibleZones.map((zone) => {
            const { x, y, width, height } = zone.bbox;
            const isHighlighted = focusedZone?.id === zone.id;
            const opacity = isHighlighted ? 1 : 0.45;

            const hasClip = zone.clipPoints && zone.clipPoints.length >= 3;
            const isTrapezoid = !hasClip && zone.shape === 'trapezoid' && hasSkew(zone);
            const shapeProps = {
              fill: zone.color,
              fillOpacity: opacity,
              stroke: isHighlighted ? '#fbbf24' : zone.color,
              strokeWidth: isHighlighted ? 2.5 : 1,
              className: 'depot-zone-rect',
            };

            const useShortLabel = width < 120 || height < 58;
            const labelText = useShortLabel ? zone.id : zone.label || zone.id;

            return (
              <g key={zone.id} className="depot-zone-group">
                {/* Highlight glow on focused zone */}
                {isHighlighted &&
                  (hasClip || isTrapezoid ? (
                    <polygon
                      points={(hasClip
                        ? zone.clipPoints
                        : getZonePoints(
                            { x: x - 3, y: y - 3, width: width + 6, height: height + 6 },
                            zone.skew,
                          )
                      )
                        .map((p) => `${p.x},${p.y}`)
                        .join(' ')}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="3"
                      className="zone-highlight-glow"
                    />
                  ) : (
                    <rect
                      x={x - 3}
                      y={y - 3}
                      width={width + 6}
                      height={height + 6}
                      rx="8"
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="3"
                      className="zone-highlight-glow"
                    />
                  ))}

                {/* Zone shape */}
                {hasClip || isTrapezoid ? (
                  <polygon
                    points={(hasClip ? zone.clipPoints : getZonePoints(zone.bbox, zone.skew))
                      .map((p) => `${p.x},${p.y}`)
                      .join(' ')}
                    {...shapeProps}
                  />
                ) : (
                  <rect x={x} y={y} width={width} height={height} rx="6" {...shapeProps} />
                )}

                {/* Label */}
                <text
                  x={x + width / 2}
                  y={y + height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={zone.textColor || '#ffffff'}
                  fontSize={useShortLabel ? 11 : 12}
                  fontWeight={isHighlighted ? '700' : '500'}
                  opacity={isHighlighted ? 1 : 0.7}
                  className="depot-zone-label u-pointer-events-none"
                >
                  {labelText}
                </text>
              </g>
            );
          })}

          {/* Focus pin — style Google Maps */}
          {focusedZone &&
            (() => {
              const { x, y, width, height } = focusedZone.bbox;
              const cx = x + width / 2;
              const pinTip = y + height / 2 + 2;
              const pinScale = 0.9;
              const labelText = focusEquipmentName
                ? focusEquipmentName.length > 32
                  ? focusEquipmentName.slice(0, 30) + '…'
                  : focusEquipmentName
                : null;
              const labelW = labelText ? Math.min(labelText.length * 7 + 28, 260) : 0;

              return (
                <g className="depot-focus-indicator u-pointer-events-none">
                  {/* Contour dashed sur la zone cible */}
                  <rect
                    x={x - 2}
                    y={y - 2}
                    width={width + 4}
                    height={height + 4}
                    rx="8"
                    fill="none"
                    stroke={STATUS_COLORS.danger}
                    strokeWidth="2.5"
                    strokeDasharray="8 4"
                    className="focus-zone-border"
                  />

                  {/* Ombre au sol */}
                  <ellipse
                    cx={cx}
                    cy={pinTip + 3}
                    rx={8 * pinScale}
                    ry={3 * pinScale}
                    fill="#000"
                    fillOpacity="0.3"
                    className="focus-pin-shadow"
                  />

                  {/* Pin drop */}
                  <g transform={`translate(${cx}, ${pinTip})`}>
                    <g className="focus-pin-bounce">
                      <g transform={`scale(${pinScale})`}>
                        <path
                          d="M0,0 C-2,-4 -11,-16 -11,-24 A11,11 0 1,1 11,-24 C11,-16 2,-4 0,0 Z"
                          fill={STATUS_COLORS.danger}
                          stroke="#fff"
                          strokeWidth="2"
                        />
                        <circle cx="0" cy="-24" r="5" fill="#fff" />
                        <circle cx="0" cy="-24" r="3" fill={STATUS_COLORS.danger} />
                      </g>
                    </g>
                  </g>

                  {/* Pulsing rings */}
                  <circle
                    cx={cx}
                    cy={pinTip}
                    r="5"
                    fill="none"
                    stroke={STATUS_COLORS.danger}
                    strokeWidth="2"
                    className="focus-pulse-ring"
                  />
                  <circle
                    cx={cx}
                    cy={pinTip}
                    r="10"
                    fill="none"
                    stroke={STATUS_COLORS.danger}
                    strokeWidth="1"
                    className="focus-pulse-ring-outer"
                  />

                  {/* Étiquette nom équipement */}
                  {labelText && (
                    <g className="focus-label-group">
                      <rect
                        x={cx - labelW / 2}
                        y={pinTip - 58 * pinScale - 26}
                        width={labelW}
                        height={22}
                        rx="11"
                        fill="#1e293b"
                        fillOpacity="0.95"
                        stroke={STATUS_COLORS.danger}
                        strokeWidth="1.5"
                      />
                      <polygon
                        points={`${cx - 5},${pinTip - 58 * pinScale - 4} ${cx + 5},${pinTip - 58 * pinScale - 4} ${cx},${pinTip - 58 * pinScale + 2}`}
                        fill="#1e293b"
                      />
                      <text
                        x={cx}
                        y={pinTip - 58 * pinScale - 12}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#fff"
                        fontSize="10"
                        fontWeight="700"
                      >
                        📍 {labelText}
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}

          {/* Étiquette étage */}
          <text
            x={bounds.x + 12}
            y={bounds.y + bounds.h - 8}
            fill="#475569"
            fontSize="11"
            fontWeight="500"
          >
            {floors.find((f) => f.id === activeFloor)?.label || activeFloor}
          </text>
        </svg>
      </div>
    </div>
  );
}
