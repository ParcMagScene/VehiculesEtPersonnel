// ============================================================
// DepotMap.jsx — Plan interactif du dépôt (SVG)
// Affiche les zones de stockage avec compteurs, sélection,
// zoom/pan, recherche visuelle et tooltip détaillé
// ============================================================

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MapPin, Layers, BarChart3, Search, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import api from '../utils/api';
import './DepotMap.css';

const SVG_WIDTH = 770;
const SVG_HEIGHT = 510;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.3;

export default function DepotMap({ zones, stats, selectedZone, onZoneSelect, onZoneFilter }) {
  const [activeFloor, setActiveFloor] = useState('RDC');
  const [hoveredZone, setHoveredZone] = useState(null);
  
  // Zoom/Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

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
    return zones.zones.filter(z => z.floor === activeFloor);
  }, [zones, activeFloor]);

  // Construire une map des stats par zone
  const statsMap = useMemo(() => {
    const map = {};
    if (stats?.stats) {
      stats.stats.forEach(s => {
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

  // Computed viewBox for zoom/pan
  const viewBox = useMemo(() => {
    const w = SVG_WIDTH / zoom;
    const h = SVG_HEIGHT / zoom;
    const x = (SVG_WIDTH - w) / 2 - pan.x;
    const y = (SVG_HEIGHT - h) / 2 - pan.y;
    return `${x} ${y} ${w} ${h}`;
  }, [zoom, pan]);

  // Zoom handlers
  const handleZoomIn = () => setZoom(z => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  const handleZoomOut = () => setZoom(z => Math.max(z - ZOOM_STEP, MIN_ZOOM));
  const handleZoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
  }, []);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (svgEl) {
      svgEl.addEventListener('wheel', handleWheel, { passive: false });
      return () => svgEl.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // Pan handlers
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

  // Recherche visuelle
  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    if (!query || query.length < 2) {
      setSearchResults(null);
      setHighlightedZone(null);
      return;
    }
    try {
      const results = await api.getCatalogEquipment({ search: query, limit: 200 });
      const items = results?.data || results || [];
      const zoneMap = {};
      items.forEach(item => {
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
  const onSearchInput = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => handleSearch(val), 400);
  };

  // Tooltip au survol enrichi
  const handleZoneHover = useCallback(async (zone, event) => {
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
      const results = await api.getCatalogEquipment({ 
        location_zone: zone.id, limit: 8 
      });
      const items = results?.data || results || [];
      setTooltip(prev => prev?.zone?.id === zone.id 
        ? { ...prev, items: items.slice(0, 8), loading: false }
        : prev
      );
    } catch {
      setTooltip(prev => prev?.zone?.id === zone.id 
        ? { ...prev, loading: false, items: [] }
        : prev
      );
    }
  }, [statsMap]);

  const handleZoneLeave = () => {
    setHoveredZone(null);
    tooltipTimeoutRef.current = setTimeout(() => setTooltip(null), 200);
  };

  // Zoom-to-zone on double click
  const handleZoneDblClick = (zone) => {
    const { x, y, width, height } = zone.bbox;
    const centerX = x + width / 2 - SVG_WIDTH / 2;
    const centerY = y + height / 2 - SVG_HEIGHT / 2;
    setZoom(2.5);
    setPan({ x: -centerX, y: -centerY });
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
            <Search size={14} />
            <input
              type="text"
              placeholder="Rechercher un équipement..."
              value={searchQuery}
              onChange={onSearchInput}
            />
            {searchResults && Object.keys(searchResults).length > 0 && (
              <span className="depot-search-count">
                {Object.values(searchResults).reduce((s, c) => s + c, 0)} trouvé(s)
              </span>
            )}
          </div>
          {/* Zoom */}
          <div className="depot-zoom-controls">
            <button onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM} title="Dézoomer">
              <ZoomOut size={16} />
            </button>
            <span className="depot-zoom-level">{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM} title="Zoomer">
              <ZoomIn size={16} />
            </button>
            <button onClick={handleZoomReset} title="Réinitialiser">
              <Maximize2 size={14} />
            </button>
          </div>
          {/* Étage */}
          <div className="depot-floor-selector">
            {floors.map(f => (
              <button
                key={f.id}
                className={`depot-floor-btn ${activeFloor === f.id ? 'active' : ''}`}
                onClick={() => setActiveFloor(f.id)}
              >
                <Layers size={14} />
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Map */}
      <div className="depot-map-svg-wrapper" style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className={`depot-map-svg ${isPanning ? 'panning' : ''}`}
          aria-label={`Plan ${activeFloor}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Background */}
          <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} rx="8" fill="#1e1e2e" stroke="#334155" strokeWidth="2" />

          {/* Grille deco */}
          {Array.from({ length: 11 }, (_, i) => (
            <line key={`gv-${i}`} x1={i * 77} y1="0" x2={i * 77} y2={SVG_HEIGHT} stroke="#ffffff08" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <line key={`gh-${i}`} x1="0" y1={i * 73} x2={SVG_WIDTH} y2={i * 73} stroke="#ffffff08" strokeWidth="0.5" />
          ))}

          {/* Zones */}
          {floorZones.map(zone => {
            const { x, y, width, height } = zone.bbox;
            const count = statsMap[zone.id] || 0;
            const isSelected = selectedZone === zone.id;
            const isHovered = hoveredZone === zone.id;
            const isHighlighted = highlightedZone === zone.id;
            const hasSearchResult = searchResults && searchResults[zone.id] > 0;
            const isSearchDimmed = searchResults && !hasSearchResult;
            
            let opacity = isSelected ? 1 : isHovered ? 0.85 : 0.6;
            if (isHighlighted) opacity = 1;
            if (isSearchDimmed) opacity = 0.2;
            if (hasSearchResult && !isHighlighted) opacity = 0.8;

            return (
              <g
                key={zone.id}
                className={`depot-zone-group ${isHighlighted ? 'highlighted' : ''} ${hasSearchResult ? 'has-result' : ''}`}
                onClick={() => {
                  if (onZoneSelect) onZoneSelect(zone.id === selectedZone ? null : zone.id);
                  if (onZoneFilter) onZoneFilter(zone.id === selectedZone ? '' : zone.id);
                }}
                onDoubleClick={() => handleZoneDblClick(zone)}
                onMouseEnter={(e) => handleZoneHover(zone, e)}
                onMouseLeave={handleZoneLeave}
                style={{ cursor: 'pointer' }}
              >
                {/* Highlight glow for search results */}
                {(isHighlighted || hasSearchResult) && (
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
                )}

                {/* Zone rect */}
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx="6"
                  fill={zone.color}
                  fillOpacity={opacity}
                  stroke={isSelected ? '#ffffff' : isHighlighted ? '#fbbf24' : isHovered ? '#e2e8f0' : zone.color}
                  strokeWidth={isSelected ? 3 : isHighlighted ? 2.5 : isHovered ? 2 : 1}
                  className="depot-zone-rect"
                />

                {/* Zone label */}
                <text
                  x={x + width / 2}
                  y={y + height / 2 - 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={zone.textColor || '#ffffff'}
                  fontSize="13"
                  fontWeight="600"
                  className="depot-zone-label"
                  style={{ pointerEvents: 'none' }}
                >
                  {zone.label}
                </text>

                {/* Zone ID */}
                <text
                  x={x + width / 2}
                  y={y + height / 2 + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={zone.textColor || '#ffffff'}
                  fontSize="10"
                  opacity="0.7"
                  style={{ pointerEvents: 'none' }}
                >
                  {zone.id}
                </text>

                {/* Counter badge */}
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
                      style={{ pointerEvents: 'none' }}
                    />
                    <text
                      x={x + width - 19}
                      y={y + 15}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#fbbf24"
                      fontSize="10"
                      fontWeight="700"
                      style={{ pointerEvents: 'none' }}
                    >
                      {count}
                    </text>
                  </>
                )}

                {/* Search result count badge */}
                {hasSearchResult && (
                  <>
                    <rect
                      x={x + 6}
                      y={y + 6}
                      width="30"
                      height="18"
                      rx="9"
                      fill="#fbbf24"
                      style={{ pointerEvents: 'none' }}
                    />
                    <text
                      x={x + 21}
                      y={y + 15}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#0f172a"
                      fontSize="10"
                      fontWeight="700"
                      style={{ pointerEvents: 'none' }}
                    >
                      {searchResults[zone.id]}
                    </text>
                  </>
                )}

                {/* Codes indicator */}
                <text
                  x={x + width / 2}
                  y={y + height - 12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={zone.textColor || '#ffffff'}
                  fontSize="9"
                  opacity="0.5"
                  style={{ pointerEvents: 'none' }}
                >
                  {zone.codes.join(' · ')}
                </text>
              </g>
            );
          })}

          {/* Floor label */}
          <text x="12" y={SVG_HEIGHT - 8} fill="#475569" fontSize="11" fontWeight="500">
            {floors.find(f => f.id === activeFloor)?.label || activeFloor}
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
            onMouseLeave={() => { setTooltip(null); setHoveredZone(null); }}
          >
            <div className="depot-tooltip-header" style={{ borderLeftColor: tooltip.zone.color }}>
              <strong>{tooltip.zone.label}</strong>
              <span className="depot-tooltip-count">{tooltip.count} éq.</span>
            </div>
            <div className="depot-tooltip-codes">
              {tooltip.zone.codes.map(c => (
                <span key={c} className="depot-tooltip-code">{c}</span>
              ))}
            </div>
            {tooltip.loading ? (
              <div className="depot-tooltip-loading">Chargement...</div>
            ) : tooltip.items && tooltip.items.length > 0 ? (
              <div className="depot-tooltip-items">
                {tooltip.items.map(item => (
                  <div key={item.id} className="depot-tooltip-item">
                    <span className="tooltip-item-ref">{item.reference}</span>
                    <span className="tooltip-item-name">{item.name}</span>
                  </div>
                ))}
                {tooltip.count > 8 && (
                  <div className="depot-tooltip-more">
                    +{tooltip.count - 8} autres...
                  </div>
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
        {floorZones.map(zone => (
          <button
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
            {searchResults?.[zone.id] > 0 
              ? <span className="legend-count search-count">{searchResults[zone.id]}</span>
              : statsMap[zone.id] > 0 && <span className="legend-count">{statsMap[zone.id]}</span>
            }
          </button>
        ))}
      </div>
    </div>
  );
}
