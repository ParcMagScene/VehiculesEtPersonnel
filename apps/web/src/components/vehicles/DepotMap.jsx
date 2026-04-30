// ============================================================
// DepotMap.jsx — Plan interactif du dépôt (SVG)
// Affiche les zones de stockage avec compteurs, sélection,
// zoom/pan, recherche visuelle et tooltip détaillé
// ============================================================

import './DepotMap.css';

import { BarChart3, Layers, MapPin, Maximize2, Settings2, ZoomIn, ZoomOut } from 'lucide-react';
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, SearchBar, Tooltip } from '@/design-system';

import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { computeZonesBounds, getZonePoints, hasSkew } from './DepotMapEditor';

const DepotMapEditor = lazy(() => import('./DepotMapEditor'));

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.3;
const DEFAULT_BOUNDS_PADDING = 25;

// ─── DepotZoneGroup ──────────────────────────────────────────────────────────
// Sous-composant mémoïsé pour le rendu SVG d'une zone.
const DepotZoneGroup = memo(function DepotZoneGroup({
  zone,
  isSelected,
  isHovered,
  isHighlighted,
  hasSearchResult,
  searchResults,
  statsMap,
  onZoneSelect,
  onZoneFilter,
  onZoneDblClick,
  onZoneHover,
  onZoneLeave,
}) {
  const { x, y, width, height } = zone.bbox;
  const count = statsMap[zone.id] || 0;
  const isSearchDimmed = searchResults && !hasSearchResult;

  let opacity = isSelected ? 1 : isHovered ? 0.85 : 0.6;
  if (isHighlighted) opacity = 1;
  if (isSearchDimmed) opacity = 0.2;
  if (hasSearchResult && !isHighlighted) opacity = 0.8;

  const hasClip = zone.clipPoints && zone.clipPoints.length >= 3;
  const isTrapezoid = !hasClip && zone.shape === 'trapezoid' && hasSkew(zone);
  const zoneShapeProps = {
    fill: zone.color,
    fillOpacity: opacity,
    stroke: isSelected ? '#ffffff' : isHighlighted ? '#fbbf24' : isHovered ? '#e2e8f0' : zone.color,
    strokeWidth: isSelected ? 3 : isHighlighted ? 2.5 : isHovered ? 2 : 1,
    className: 'depot-zone-rect',
  };

  return (
    <g
      className={`depot-zone-group u-cursor-pointer ${isHighlighted ? 'highlighted' : ''} ${hasSearchResult ? 'has-result' : ''}`}
      onClick={() => {
        if (onZoneSelect) onZoneSelect(zone.id === (isSelected ? zone.id : null) ? null : zone.id);
        if (onZoneFilter) onZoneFilter(isSelected ? '' : zone.id);
      }}
      onDoubleClick={() => onZoneDblClick(zone)}
      onMouseEnter={(e) => onZoneHover(zone, e)}
      onMouseLeave={onZoneLeave}
    >
      {/* Glow pour résultats de recherche et zone surlignée */}
      {(isHighlighted || hasSearchResult) &&
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
            stroke={isHighlighted ? '#fbbf24' : '#60a5fa'}
            strokeWidth={isHighlighted ? 3 : 2}
            strokeDasharray={isHighlighted ? '0' : '6 3'}
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
            stroke={isHighlighted ? '#fbbf24' : '#60a5fa'}
            strokeWidth={isHighlighted ? 3 : 2}
            strokeDasharray={isHighlighted ? '0' : '6 3'}
            className="zone-highlight-glow"
          />
        ))}

      {/* Forme de la zone */}
      {hasClip || isTrapezoid ? (
        <polygon
          points={(hasClip ? zone.clipPoints : getZonePoints(zone.bbox, zone.skew))
            .map((p) => `${p.x},${p.y}`)
            .join(' ')}
          {...zoneShapeProps}
        />
      ) : (
        <rect x={x} y={y} width={width} height={height} rx="6" {...zoneShapeProps} />
      )}

      {/* Libellé principal */}
      <text
        x={x + width / 2}
        y={y + height / 2 - 8}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={zone.textColor || '#ffffff'}
        fontSize="13"
        fontWeight="600"
        className="depot-zone-label u-pointer-events-none"
      >
        {zone.label}
      </text>

      {/* ID secondaire */}
      <text
        x={x + width / 2}
        y={y + height / 2 + 10}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={zone.textColor || '#ffffff'}
        fontSize="10"
        opacity="0.7"
        className="u-pointer-events-none"
      >
        {zone.id}
      </text>

      {/* Badge compteur d'équipements */}
      {count > 0 && (
        <>
          <rect
            x={x + width - 32}
            y={y + 6}
            width="26"
            height="18"
            rx="9"
            fill="#0f172a"
            fillOpacity="0.8"
            className="u-pointer-events-none"
          />
          <text
            x={x + width - 19}
            y={y + 15}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#fbbf24"
            fontSize="10"
            fontWeight="700"
            className="u-pointer-events-none"
          >
            {count}
          </text>
        </>
      )}

      {/* Badge résultat de recherche */}
      {hasSearchResult && (
        <>
          <rect
            x={x + 6}
            y={y + 6}
            width="30"
            height="18"
            rx="9"
            fill="#fbbf24"
            className="u-pointer-events-none"
          />
          <text
            x={x + 21}
            y={y + 15}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#0f172a"
            fontSize="10"
            fontWeight="700"
            className="u-pointer-events-none"
          >
            {searchResults[zone.id]}
          </text>
        </>
      )}

      {/* Codes courts */}
      {(zone.codes || []).join(' · ') && (
        <text
          x={x + width / 2}
          y={y + height - 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={zone.textColor || '#ffffff'}
          fontSize="9"
          opacity="0.5"
          className="u-pointer-events-none"
        >
          {(zone.codes || []).join(' · ')}
        </text>
      )}
    </g>
  );
});

export default function DepotMap({
  zones,
  stats,
  selectedZone,
  onZoneSelect,
  onZoneFilter,
  onZonesUpdated,
}) {
  const { currentUser } = useAuth();
  const [showEditor, setShowEditor] = useState(false);
  const [activeFloor, setActiveFloor] = useState('RDC');
  const [hoveredZone, setHoveredZone] = useState(null);

  // Zoom/Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);
  const lastTouchRef = useRef(null);
  const lastPinchRef = useRef(null);
  const animFrameRef = useRef(null);

  // Animated zoom-to-zone: progressive zoom from current state to target
  const animateToZone = useCallback((targetZoom, targetPan, duration = 900) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    // Capture start values via refs to avoid stale closures
    const startZoom = 1;
    const startPan = { x: 0, y: 0 };
    // Reset to wide view first
    setZoom(startZoom);
    setPan(startPan);
    const startTime = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // easeInOutCubic
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const t = ease(progress);
      setZoom(startZoom + (targetZoom - startZoom) * t);
      setPan({
        x: startPan.x + (targetPan.x - startPan.x) * t,
        y: startPan.y + (targetPan.y - startPan.y) * t,
      });
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        animFrameRef.current = null;
      }
    };
    // Small delay so the wide view renders first
    setTimeout(() => {
      animFrameRef.current = requestAnimationFrame(step);
    }, 80);
  }, []);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Recherche d'équipement
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null); // { zoneId: count } or null
  const [highlightedZone, setHighlightedZone] = useState(null);

  // Tooltip
  const [tooltip, setTooltip] = useState(null); // { zone, x, y, items }
  const tooltipTimeoutRef = useRef(null);

  // Grouper zones par étage
  const floorZones = useMemo(() => {
    if (!zones?.zones) return [];
    return zones.zones.filter((z) => z.floor === activeFloor);
  }, [zones, activeFloor]);

  // Bounding box auto-fit sur les zones de l'étage actif
  const bounds = useMemo(
    () => computeZonesBounds(floorZones, DEFAULT_BOUNDS_PADDING),
    [floorZones],
  );

  // Construire une map des stats par zone
  const statsMap = useMemo(() => {
    const map = {};
    if (stats?.stats) {
      stats.stats.forEach((s) => {
        map[s.location_zone] = (map[s.location_zone] || 0) + s.count;
      });
    }
    return map;
  }, [stats]);

  const totalEquipments = useMemo(() => {
    return Object.values(statsMap).reduce((sum, c) => sum + c, 0);
  }, [statsMap]);

  const floors = zones?.floors || [
    { id: 'RDC', label: 'Rez-de-chaussée' },
    { id: 'MEZZ', label: 'Mezzanine' },
  ];

  // Computed viewBox for zoom/pan (basé sur le bounding box des zones)
  const viewBox = useMemo(() => {
    const w = bounds.w / zoom;
    const h = bounds.h / zoom;
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    const x = cx - w / 2 - pan.x;
    const y = cy - h / 2 - pan.y;
    return `${x} ${y} ${w} ${h}`;
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

  // Touch handlers (mobile pan + pinch-to-zoom)
  const handleTouchStart = useCallback(
    (e) => {
      if (e.touches.length === 2) {
        // Pinch start
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchRef.current = Math.hypot(dx, dy);
        lastTouchRef.current = null;
      } else if (e.touches.length === 1 && zoom > 1) {
        // Pan start
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
        const scale = dist / lastPinchRef.current;
        setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * scale)));
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

  // Recherche visuelle
  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    if (!query || query.length < 2) {
      setSearchResults(null);
      setHighlightedZone(null);
      return;
    }
    try {
      const results = await api.getEquipment({ search: query, limit: 200 });
      const items = Array.isArray(results) ? results : results?.items || results?.data || [];
      const zoneMap = {};
      items.forEach((item) => {
        const zone = item.location_zone || item.locationZone;
        if (zone) {
          zoneMap[zone] = (zoneMap[zone] || 0) + 1;
        }
      });
      setSearchResults(zoneMap);
      // Auto-select la zone avec le plus de résultats
      const topZone = Object.entries(zoneMap).sort((a, b) => b[1] - a[1])[0];
      setHighlightedZone(topZone?.[0] || null);
    } catch (err) {
      console.error('[DepotMap] Search error:', err);
      setSearchResults(null);
    }
  }, []);

  // Debounced search
  const searchTimeoutRef = useRef(null);
  const onSearchInput = (val) => {
    setSearchQuery(val);
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => handleSearch(val), 400);
  };

  // Tooltip au survol enrichi
  const handleZoneHover = useCallback(
    async (zone, event) => {
      clearTimeout(tooltipTimeoutRef.current);
      setHoveredZone(zone.id);

      const rect = svgRef.current?.getBoundingClientRect();
      const x = event.clientX - (rect?.left || 0);
      const y = event.clientY - (rect?.top || 0);

      // Afficher tooltip basique immédiatement
      setTooltip({
        zone,
        x,
        y,
        count: statsMap[zone.id] || 0,
        items: null,
        loading: true,
      });

      // Charger les équipements de la zone en background
      try {
        const results = await api.getEquipment({
          location_zone: zone.id,
          limit: 8,
        });
        const items = Array.isArray(results) ? results : results?.items || results?.data || [];
        setTooltip((prev) =>
          prev?.zone?.id === zone.id ? { ...prev, items: items.slice(0, 8), loading: false } : prev,
        );
      } catch {
        setTooltip((prev) =>
          prev?.zone?.id === zone.id ? { ...prev, loading: false, items: [] } : prev,
        );
      }
    },
    [statsMap],
  );

  const handleZoneLeave = () => {
    setHoveredZone(null);
    tooltipTimeoutRef.current = setTimeout(() => setTooltip(null), 200);
  };

  // Zoom-to-zone on double click
  const handleZoneDblClick = (zone) => {
    const { x, y, width, height } = zone.bbox;
    const centerX = x + width / 2 - (bounds.x + bounds.w / 2);
    const centerY = y + height / 2 - (bounds.y + bounds.h / 2);
    animateToZone(2.5, { x: -centerX, y: -centerY });
  };

  return (
    <div className="depot-map-container">
      {/* Header avec sélecteur d'étage */}
      <div className="depot-map-header">
        <div className="depot-map-title">
          <MapPin size={18} />
          <span>Plan du dépôt</span>
          <span className="depot-map-count">{totalEquipments} éq. localisés</span>
          {stats?.unlocated > 0 && (
            <span className="depot-map-unlocated">{stats.unlocated} non localisés</span>
          )}
        </div>
        <div className="depot-map-controls">
          {/* Recherche */}
          <div className="depot-search">
            <SearchBar
              value={searchQuery}
              onChange={onSearchInput}
              placeholder="Rechercher un équipement..."
              size="sm"
            />
            {searchResults && Object.keys(searchResults).length > 0 && (
              <span className="depot-search-count">
                {Object.values(searchResults).reduce((s, c) => s + c, 0)} trouvé(s)
              </span>
            )}
          </div>
          {/* Éditer le plan (admin uniquement) */}
          {currentUser?.isAdmin && (
            <Tooltip content="Éditer le plan" position="bottom">
              <Button
                variant="ghost"
                type="button"
                className="depot-edit-btn"
                onClick={() => setShowEditor(true)}
              >
                <Settings2 size={14} />
                Éditer
              </Button>
            </Tooltip>
          )}
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
            <Tooltip content="Réinitialiser">
              <Button variant="ghost" type="button" onClick={handleZoomReset}>
                <Maximize2 size={14} />
              </Button>
            </Tooltip>
          </div>
          {/* Étage */}
          <div className="depot-floor-selector">
            {floors.map((f) => (
              <Button
                variant="ghost"
                type="button"
                key={f.id}
                className={`depot-floor-btn ${activeFloor === f.id ? 'active' : ''}`}
                onClick={() => setActiveFloor(f.id)}
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
          aria-label={`Plan ${activeFloor}`}
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
          {Array.from({ length: Math.floor(bounds.w / 77) + 1 }, (_, i) => {
            const gx = bounds.x + i * 77;
            return (
              <line
                key={`gv-${i}`}
                x1={gx}
                y1={bounds.y}
                x2={gx}
                y2={bounds.y + bounds.h}
                stroke="#ffffff08"
                strokeWidth="0.5"
              />
            );
          })}
          {Array.from({ length: Math.floor(bounds.h / 73) + 1 }, (_, i) => {
            const gy = bounds.y + i * 73;
            return (
              <line
                key={`gh-${i}`}
                x1={bounds.x}
                y1={gy}
                x2={bounds.x + bounds.w}
                y2={gy}
                stroke="#ffffff08"
                strokeWidth="0.5"
              />
            );
          })}

          {/* Zones */}
          {floorZones.map((zone) => (
            <DepotZoneGroup
              key={zone.id}
              zone={zone}
              isSelected={selectedZone === zone.id}
              isHovered={hoveredZone === zone.id}
              isHighlighted={highlightedZone === zone.id}
              hasSearchResult={!!(searchResults && searchResults[zone.id] > 0)}
              searchResults={searchResults}
              statsMap={statsMap}
              onZoneSelect={onZoneSelect}
              onZoneFilter={onZoneFilter}
              onZoneDblClick={handleZoneDblClick}
              onZoneHover={handleZoneHover}
              onZoneLeave={handleZoneLeave}
            />
          ))}

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

        {/* Tooltip HTML overlay */}
        {tooltip && (
          <div
            className="depot-tooltip"
            style={{
              left: Math.min(tooltip.x + 12, (svgRef.current?.clientWidth || 500) - 250),
              top: tooltip.y - 10,
            }}
            onMouseEnter={() => clearTimeout(tooltipTimeoutRef.current)}
            onMouseLeave={() => {
              setTooltip(null);
              setHoveredZone(null);
            }}
          >
            <div className="depot-tooltip-header" style={{ borderLeftColor: tooltip.zone.color }}>
              <strong>{tooltip.zone.label}</strong>
              <span className="depot-tooltip-count">{tooltip.count} éq.</span>
            </div>
            <div className="depot-tooltip-codes">
              {(tooltip.zone.codes || []).map((c) => (
                <span key={c} className="depot-tooltip-code">
                  {c}
                </span>
              ))}
            </div>
            {tooltip.loading ? (
              <div className="depot-tooltip-loading">Chargement...</div>
            ) : tooltip.items && tooltip.items.length > 0 ? (
              <div className="depot-tooltip-items">
                {tooltip.items.map((item) => (
                  <div key={item.id} className="depot-tooltip-item">
                    <span className="tooltip-item-ref">{item.reference}</span>
                    <span className="tooltip-item-name">{item.name}</span>
                  </div>
                ))}
                {tooltip.count > 8 && (
                  <div className="depot-tooltip-more">+{tooltip.count - 8} autres...</div>
                )}
              </div>
            ) : tooltip.count === 0 ? (
              <div className="depot-tooltip-empty">Zone vide</div>
            ) : null}
          </div>
        )}
      </div>

      {/* Légende */}
      <div className="depot-map-legend">
        <BarChart3 size={14} />
        <span className="legend-label">Zones :</span>
        {floorZones.map((zone) => (
          <Button
            variant="ghost"
            type="button"
            key={zone.id}
            className={`legend-chip ${selectedZone === zone.id ? 'active' : ''} ${highlightedZone === zone.id ? 'highlighted' : ''}`}
            style={{ '--chip-color': zone.color }}
            onClick={() => {
              if (onZoneSelect) onZoneSelect(zone.id === selectedZone ? null : zone.id);
              if (onZoneFilter) onZoneFilter(zone.id === selectedZone ? '' : zone.id);
            }}
          >
            <span className="legend-dot" style={{ backgroundColor: zone.color }} />
            {zone.label}
            {searchResults?.[zone.id] > 0 ? (
              <span className="legend-count search-count">{searchResults[zone.id]}</span>
            ) : (
              statsMap[zone.id] > 0 && <span className="legend-count">{statsMap[zone.id]}</span>
            )}
          </Button>
        ))}
      </div>

      {/* Éditeur de plan */}
      {showEditor && (
        <Suspense fallback={null}>
          <DepotMapEditor
            zones={zones}
            depotId={zones?.depotId || 1}
            onClose={() => {
              setShowEditor(false);
              if (onZonesUpdated) onZonesUpdated();
            }}
            onSaved={() => {
              if (onZonesUpdated) onZonesUpdated();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
