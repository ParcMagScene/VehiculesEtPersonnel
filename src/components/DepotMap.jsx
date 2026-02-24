// ============================================================
// DepotMap.jsx — Plan interactif du dépôt (SVG)
// Affiche les zones de stockage avec compteurs et sélection
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Layers, BarChart3 } from 'lucide-react';
import './DepotMap.css';

const SVG_WIDTH = 770;
const SVG_HEIGHT = 510;

export default function DepotMap({ zones, stats, selectedZone, onZoneSelect, onZoneFilter }) {
  const [activeFloor, setActiveFloor] = useState('RDC');
  const [hoveredZone, setHoveredZone] = useState(null);

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

      {/* SVG Map */}
      <div className="depot-map-svg-wrapper">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="depot-map-svg"
          aria-label={`Plan ${activeFloor}`}
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
            const opacity = isSelected ? 1 : isHovered ? 0.85 : 0.6;

            return (
              <g
                key={zone.id}
                className="depot-zone-group"
                onClick={() => {
                  if (onZoneSelect) onZoneSelect(zone.id === selectedZone ? null : zone.id);
                  if (onZoneFilter) onZoneFilter(zone.id === selectedZone ? '' : zone.id);
                }}
                onMouseEnter={() => setHoveredZone(zone.id)}
                onMouseLeave={() => setHoveredZone(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Zone rect */}
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx="6"
                  fill={zone.color}
                  fillOpacity={opacity}
                  stroke={isSelected ? '#ffffff' : isHovered ? '#e2e8f0' : zone.color}
                  strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
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
      </div>

      {/* Légende */}
      <div className="depot-map-legend">
        <BarChart3 size={14} />
        <span className="legend-label">Zones :</span>
        {floorZones.map(zone => (
          <button
            key={zone.id}
            className={`legend-chip ${selectedZone === zone.id ? 'active' : ''}`}
            style={{ '--chip-color': zone.color }}
            onClick={() => {
              if (onZoneSelect) onZoneSelect(zone.id === selectedZone ? null : zone.id);
              if (onZoneFilter) onZoneFilter(zone.id === selectedZone ? '' : zone.id);
            }}
          >
            <span className="legend-dot" style={{ backgroundColor: zone.color }} />
            {zone.label}
            {statsMap[zone.id] > 0 && <span className="legend-count">{statsMap[zone.id]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
