import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ChevronLeft, MapPin, Package, Layers, X, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import api from '../../utils/api';
import { getZonePoints, hasSkew, computeZonesBounds } from '../vehicles/DepotMapEditor';
import './MobileLocation.css';
import { Button, SearchBar } from '@/design-system';

import { STATUS } from '../../constants';

function MobileLocation({ onBack }) {
  const [zones, setZones] = useState(null);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);
  const [zoneEquipments, setZoneEquipments] = useState([]);
  const [loadingEquipments, setLoadingEquipments] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [viewMode, setViewMode] = useState('map'); // map | list
  const [floor, setFloor] = useState('RDC');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [depot, _setDepot] = useState(1);
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // Chargement des zones et stats
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [zonesData, statsData] = await Promise.all([
        fetch(`/depot${depot === 1 ? '' : depot}-zones.json`).then(r => r.json()).catch(() => null),
        api.getEquipmentLocationStats(depot).catch(() => []),
      ]);
      setZones(zonesData);
      setStats(Array.isArray(statsData) ? statsData : statsData?.stats || []);
    } catch (e) { console.error('Erreur chargement localisations:', e); }
    setLoading(false);
  }, [depot]);

  useEffect(() => { loadData(); }, [loadData]);

  // Charger les équipements d'une zone sélectionnée
  useEffect(() => {
    if (!selectedZone) { setZoneEquipments([]); return; }
    let cancelled = false;
    const load = async () => {
      setLoadingEquipments(true);
      try {
        const eqs = await api.getEquipment({ location_zone: selectedZone });
        if (!cancelled) setZoneEquipments(Array.isArray(eqs) ? eqs : []);
      } catch (e) { if (!cancelled) setZoneEquipments([]); }
      if (!cancelled) setLoadingEquipments(false);
    };
    load();
    return () => { cancelled = true; };
  }, [selectedZone]);

  // Recherche d'équipement
  useEffect(() => {
    if (!search.trim()) { setSearchResults(null); return; }
    const timer = setTimeout(async () => {
      try {
        const results = await api.getEquipment({ search: search.trim() });
        const arr = Array.isArray(results) ? results : [];
        // Grouper par zone
        const zoneMap = {};
        arr.forEach(eq => {
          const z = eq.location_zone || eq.locationZone || 'non_localise';
          if (!zoneMap[z]) zoneMap[z] = [];
          zoneMap[z].push(eq);
        });
        setSearchResults({ total: arr.length, byZone: zoneMap });
      } catch (e) { setSearchResults(null); }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const getZoneCount = useCallback((zoneId) => {
    const codes = zones?.zones?.find(z => z.id === zoneId)?.codes || [zoneId];
    return stats.reduce((sum, s) => {
      if (codes.includes(s.location_zone || s.locationZone)) return sum + (s.count || 0);
      return sum;
    }, 0);
  }, [zones, stats]);

  const totalEquipments = stats.reduce((s, st) => s + (st.count || 0), 0);
  const unlocated = stats.find(s => (s.location_zone || s.locationZone) === '' || s.location_zone === null);
  const unlocatedCount = unlocated?.count || 0;

  const floorZones = zones?.zones?.filter(z => z.floor === floor) || [];
  const floors = zones?.floors || [{ id: 'RDC', label: 'RDC' }];
  const bounds = computeZonesBounds(floorZones, 15);

  const handleZoneClick = (zoneId) => {
    setSelectedZone(prev => prev === zoneId ? null : zoneId);
  };

  // Zoom
  const handleZoomIn = () => setZoom(z => Math.min(z * 1.3, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.3, 0.5));
  const handleResetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Touch pan (simplified)
  const lastTouchRef = useRef(null);
  const handleTouchStart = (e) => {
    if (e.touches.length === 1 && zoom > 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && lastTouchRef.current && zoom > 1) {
      const dx = e.touches[0].clientX - lastTouchRef.current.x;
      const dy = e.touches[0].clientY - lastTouchRef.current.y;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const handleTouchEnd = () => { lastTouchRef.current = null; };

  if (loading) {
    return (
      <div className="mobile-location">
        <div className="mobile-module-header">
          <Button variant="ghost" className="mobile-back-btn" onClick={onBack}><ChevronLeft size={20} /></Button>
          <h2>📍 Localisation</h2>
        </div>
        <div className="mobile-module-loading">Chargement du plan...</div>
      </div>
    );
  }

  return (
    <div className="mobile-location">
      <div className="mobile-module-header">
        <Button variant="ghost" className="mobile-back-btn" onClick={onBack}><ChevronLeft size={20} /></Button>
        <h2>📍 Localisation</h2>
        <div className="mloc-view-toggle">
          <Button variant="ghost" className={viewMode === 'map' ? 'active' : ''} onClick={() => setViewMode('map')}>
            <MapPin size={16} />
          </Button>
          <Button variant="ghost" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>
            <Layers size={16} />
          </Button>
        </div>
      </div>

      {/* Barre de recherche */}
      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un équipement..." />

      {/* Résultats de recherche */}
      {searchResults && (
        <div className="mloc-search-results">
          <div className="mloc-search-count">{searchResults.total} résultat{searchResults.total > 1 ? 's' : ''}</div>
          {Object.entries(searchResults.byZone).map(([zone, eqs]) => {
            const zoneInfo = zones?.zones?.find(z => z.id === zone || z.codes?.includes(zone));
            return (
              <div key={zone} className="mloc-search-group">
                <div 
                  className="mloc-search-zone" 
                  style={{ borderLeftColor: zoneInfo?.color || '#6b7280' }}
                  onClick={() => { setSelectedZone(zone); setSearch(''); setSearchResults(null); }}
                >
                  <MapPin size={14} />
                  <span>{zoneInfo?.label || zone || 'Non localisé'}</span>
                  <span className="mloc-search-zone-count">{eqs.length}</span>
                </div>
                <div className="mloc-search-items">
                  {eqs.slice(0, 5).map(eq => (
                    <div key={eq.id} className="mloc-search-item">
                      <Package size={14} />
                      <span>{eq.name || eq.designation}</span>
                      {eq.uid && <span className="mloc-uid">{eq.uid}</span>}
                    </div>
                  ))}
                  {eqs.length > 5 && <div className="mloc-search-more">+{eqs.length - 5} autres</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats résumé */}
      <div className="mloc-stats-bar">
        <div className="mloc-stat">
          <Package size={14} />
          <span>{totalEquipments} localisés</span>
        </div>
        {unlocatedCount > 0 && (
          <div className="mloc-stat warning">
            <span>{unlocatedCount} non localisés</span>
          </div>
        )}
      </div>

      {viewMode === 'map' ? (
        <>
          {/* Sélecteur d'étage */}
          {floors.length > 1 && (
            <div className="mloc-floor-selector">
              {floors.map(f => (
                <Button variant="ghost" 
                  key={f.id} 
                  className={`mloc-floor-btn ${floor === f.id ? 'active' : ''}`}
                  onClick={() => setFloor(f.id)}
                >
                  {f.label || f.id}
                </Button>
              ))}
            </div>
          )}

          {/* Plan SVG */}
          <div 
            className="mloc-map-container" 
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="mloc-zoom-controls">
              <Button variant="ghost" onClick={handleZoomIn}><ZoomIn size={18} /></Button>
              <Button variant="ghost" onClick={handleZoomOut}><ZoomOut size={18} /></Button>
              <Button variant="ghost" onClick={handleResetView}><RotateCcw size={18} /></Button>
            </div>

            <svg
              ref={svgRef}
              viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
              className="mloc-svg"
              style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)` }}
            >
              {/* Fond */}
              <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} fill="var(--theme-bg-secondary)" rx="8" />
              
              {floorZones.map(zone => {
                const { x, y, width, height } = zone.bbox;
                const count = getZoneCount(zone.id);
                const isSelected = selectedZone === zone.id;
                const hasSearchResult = searchResults?.byZone?.[zone.id];
                const opacity = searchResults 
                  ? (hasSearchResult ? 1 : 0.3) 
                  : (isSelected ? 1 : 0.85);

                const hasClip = zone.clipPoints && zone.clipPoints.length >= 3;
                const isTrapezoid = !hasClip && zone.shape === 'trapezoid' && hasSkew(zone);
                const isPolygon = hasClip || isTrapezoid;
                const polyPoints = isPolygon
                  ? (hasClip ? zone.clipPoints : getZonePoints(zone.bbox, zone.skew)).map(p => `${p.x},${p.y}`).join(' ')
                  : null;

                const shapeProps = {
                  fill: zone.color || '#6b7280',
                  opacity,
                  stroke: isSelected ? '#ffffff' : 'rgba(255,255,255,0.3)',
                  strokeWidth: isSelected ? 3 : 1,
                };

                return (
                  <g key={zone.id} onClick={() => handleZoneClick(zone.id)} style={{ cursor: 'pointer' }}>
                    {/* Zone shape */}
                    {isPolygon ? (
                      <polygon points={polyPoints} {...shapeProps} />
                    ) : (
                      <rect x={x} y={y} width={width} height={height} rx={4} {...shapeProps} />
                    )}
                    {/* Label */}
                    <text
                      x={x + width / 2}
                      y={y + height / 2 - (count > 0 ? 4 : 0)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={zone.textColor || '#ffffff'}
                      fontSize={Math.min(12, width / 8)}
                      fontWeight="600"
                    >
                      {zone.label}
                    </text>
                    {/* Count */}
                    {count > 0 && (
                      <text
                        x={x + width / 2}
                        y={y + height / 2 + 12}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={zone.textColor || '#ffffff'}
                        fontSize={10}
                        opacity={0.8}
                      >
                        {count} éq.
                      </text>
                    )}
                    {/* Selection highlight */}
                    {isSelected && (
                      isPolygon ? (
                        <polygon
                          points={polyPoints}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={2}
                          strokeDasharray="6,3"
                          opacity={0.8}
                        />
                      ) : (
                        <rect
                          x={x - 2} y={y - 2}
                          width={width + 4} height={height + 4}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={2}
                          strokeDasharray="6,3"
                          rx={6}
                          opacity={0.8}
                        />
                      )
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </>
      ) : (
        /* Vue liste des zones */
        <div className="mloc-zone-list">
          {(zones?.zones || [])
            .filter(z => {
              const count = getZoneCount(z.id);
              return count > 0;
            })
            .sort((a, b) => getZoneCount(b.id) - getZoneCount(a.id))
            .map(zone => {
              const count = getZoneCount(zone.id);
              const isSelected = selectedZone === zone.id;
              return (
                <div 
                  key={zone.id} 
                  className={`mloc-zone-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleZoneClick(zone.id)}
                >
                  <div className="mloc-zone-color" style={{ background: zone.color || '#6b7280' }} />
                  <div className="mloc-zone-info">
                    <div className="mloc-zone-name">{zone.label}</div>
                    <div className="mloc-zone-floor">{zone.floor} · {zone.id}</div>
                  </div>
                  <div className="mloc-zone-count">{count}</div>
                </div>
              );
            })}
        </div>
      )}

      {/* Panel équipements de la zone sélectionnée */}
      {selectedZone && (
        <div className="mloc-equipment-panel">
          <div className="mloc-panel-header">
            <div>
              <h3>
                {zones?.zones?.find(z => z.id === selectedZone)?.label || selectedZone}
              </h3>
              <span className="mloc-panel-count">{zoneEquipments.length} équipement{zoneEquipments.length > 1 ? 's' : ''}</span>
            </div>
            <Button variant="ghost" onClick={() => setSelectedZone(null)}><X size={20} /></Button>
          </div>
          <div className="mloc-panel-list">
            {loadingEquipments ? (
              <div className="mloc-panel-loading">Chargement...</div>
            ) : zoneEquipments.length === 0 ? (
              <div className="mloc-panel-empty">Aucun équipement dans cette zone</div>
            ) : zoneEquipments.map(eq => (
              <div key={eq.id} className="mloc-equipment-item">
                <Package size={16} />
                <div className="mloc-eq-info">
                  <div className="mloc-eq-name">{eq.name || eq.designation}</div>
                  <div className="mloc-eq-details">
                    {eq.uid && <span className="mloc-uid">{eq.uid}</span>}
                    {eq.brand && <span>{eq.brand}</span>}
                    {eq.serial_number && <span>S/N: {eq.serial_number}</span>}
                  </div>
                </div>
                <div className={`mloc-eq-status ${eq.status || 'unknown'}`}>
                  {eq.status === 'available' ? 'Dispo' : eq.status === 'in_use' ? 'En cours' : eq.status === STATUS.MAINTENANCE ? 'SAV' : eq.status || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileLocation;
