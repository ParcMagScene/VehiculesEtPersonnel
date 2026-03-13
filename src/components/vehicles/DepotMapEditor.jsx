// ============================================================
// DepotMapEditor.jsx — Éditeur visuel des zones de dépôt
// Permet de déplacer, redimensionner les zones avec une image
// de référence en overlay pour aligner précisément
// ============================================================

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Save, X, Undo2, Image, Move, Maximize2, Plus, Trash2, RotateCcw, Eye, EyeOff, Grid3X3, Copy } from 'lucide-react';
import api from '../../utils/api';
import './DepotMapEditor.css';

const HANDLE_SIZE = 8;
const SNAP_GRID = 5;
const MIN_ZONE_SIZE = 20;

function snapToGrid(val, grid) {
  return Math.round(val / grid) * grid;
}

/**
 * Calcule les 4 coins d'une zone (rectangle ou trapèze)
 * skew: { tl, tr, bl, br } = décalage horizontal de chaque coin
 * Retourne les points dans l'ordre: haut-gauche, haut-droit, bas-droit, bas-gauche
 */
export function getZonePoints(bbox, skew) {
  const { x, y, width, height } = bbox;
  const s = skew || { tl: 0, tr: 0, bl: 0, br: 0 };
  return [
    { x: x + (s.tl || 0),         y: y },
    { x: x + width + (s.tr || 0), y: y },
    { x: x + width + (s.br || 0), y: y + height },
    { x: x + (s.bl || 0),         y: y + height },
  ];
}

function pointsToSvg(points) {
  return points.map(p => `${p.x},${p.y}`).join(' ');
}

export function hasSkew(zone) {
  const s = zone.skew;
  if (!s) return false;
  return (s.tl || 0) !== 0 || (s.tr || 0) !== 0 || (s.bl || 0) !== 0 || (s.br || 0) !== 0;
}

/** Compute bounding box encompassing all zones (accounting for skew) + padding */
export function computeZonesBounds(zones, padding = 20) {
  if (!zones || zones.length === 0) return { x: 0, y: 0, w: 400, h: 300 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const zone of zones) {
    if (zone.shape === 'trapezoid' && hasSkew(zone)) {
      const pts = getZonePoints(zone.bbox, zone.skew);
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    } else {
      const { x, y, width, height } = zone.bbox;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + width > maxX) maxX = x + width;
      if (y + height > maxY) maxY = y + height;
    }
  }
  return {
    x: minX - padding,
    y: minY - padding,
    w: maxX - minX + padding * 2,
    h: maxY - minY + padding * 2,
  };
}

export default function DepotMapEditor({ zones, depotId, onClose, onSaved }) {
  const [zonesData, setZonesData] = useState(() => JSON.parse(JSON.stringify(zones)));
  const [activeFloor, setActiveFloor] = useState('RDC');
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Overlay image
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.35);
  const [showGrid, setShowGrid] = useState(true);

  // Drag state
  const [dragMode, setDragMode] = useState(null); // 'move' | 'resize-*' | 'skew-*' | null
  const [dragStart, setDragStart] = useState(null);
  const [dragZoneStart, setDragZoneStart] = useState(null);
  const [dragSkewStart, setDragSkewStart] = useState(null);

  const svgRef = useRef(null);

  const SVG_WIDTH = zonesData.svgWidth || 900;
  const SVG_HEIGHT = zonesData.svgHeight || 520;

  const floors = zonesData.floors || [
    { id: 'RDC', label: 'Rez-de-chaussée' },
    { id: 'MEZZ', label: 'Mezzanine' },
  ];

  const floorZones = useMemo(() => {
    return (zonesData.zones || []).filter(z => z.floor === activeFloor);
  }, [zonesData, activeFloor]);

  // Bounding box auto-fit sur les zones de l'étage actif
  const bounds = useMemo(() => computeZonesBounds(floorZones, 25), [floorZones]);

  const selectedZone = useMemo(() => {
    return zonesData.zones?.find(z => z.id === selectedZoneId) || null;
  }, [zonesData, selectedZoneId]);

  // Unique colors used across all zones (for palette picker)
  const usedColors = useMemo(() => {
    const set = new Set();
    (zonesData.zones || []).forEach(z => { if (z.color) set.add(z.color.toLowerCase()); });
    (zonesData.categories || []).forEach(c => { if (c.color) set.add(c.color.toLowerCase()); });
    return [...set].sort();
  }, [zonesData]);

  const overlayImage = depotId === '2' || depotId === 2
    ? '/ZonesDepôt2.png'
    : '/ZonesDepôt1.png';
  
  // Which part of the image to show for the current floor
  // Depot 1: image is landscape with RDC left, MEZZ right
  // Depot 2: image is portrait with RDC top, MEZZ bottom
  const overlayClip = useMemo(() => {
    if (depotId === '1' || depotId === 1) {
      // Depot 1 image: 3506x4959 — Both floors side by side
      // RDC = left half (approx 0-47%), MEZZ = right half (approx 50-97%)
      // Legend at bottom ~89-100%
      if (activeFloor === 'RDC') return { x: '1%', y: '1%', w: '46%', h: '87%' };
      return { x: '50%', y: '1%', w: '47%', h: '87%' };
    }
    // Depot 2 image: 1123x1587, portrait, RDC takes most of image
    if (activeFloor === 'RDC') return { x: '0%', y: '0%', w: '100%', h: '85%' };
    return { x: '0%', y: '85%', w: '100%', h: '15%' };
  }, [depotId, activeFloor]);

  // Save snapshot for undo
  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-30), JSON.stringify(zonesData)]);
  }, [zonesData]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setZonesData(JSON.parse(last));
    setDirty(true);
  };

  // Update a zone's bbox
  const updateZoneBbox = useCallback((zoneId, newBbox) => {
    setZonesData(prev => ({
      ...prev,
      zones: prev.zones.map(z => z.id === zoneId ? { ...z, bbox: { ...z.bbox, ...newBbox } } : z),
    }));
    setDirty(true);
  }, []);

  // Update SVG dimensions
  const updateSvgDimensions = useCallback((width, height) => {
    pushHistory();
    setZonesData(prev => ({ ...prev, svgWidth: width, svgHeight: height }));
    setDirty(true);
  }, [pushHistory]);

  // Get SVG coordinates from mouse/touch event
  const getSvgPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * bounds.w + bounds.x,
      y: ((clientY - rect.top) / rect.height) * bounds.h + bounds.y,
    };
  }, [bounds]);

  // Mouse down on a zone (move)
  const handleZoneMouseDown = useCallback((e, zone) => {
    e.stopPropagation();
    e.preventDefault();
    pushHistory();
    setSelectedZoneId(zone.id);
    setDragMode('move');
    const pt = getSvgPoint(e);
    setDragStart(pt);
    setDragZoneStart({ ...zone.bbox });
  }, [getSvgPoint, pushHistory]);

  // Mouse down on resize handle
  const handleHandleMouseDown = useCallback((e, zone, handle) => {
    e.stopPropagation();
    e.preventDefault();
    pushHistory();
    setSelectedZoneId(zone.id);
    const pt = getSvgPoint(e);
    setDragStart(pt);
    setDragZoneStart({ ...zone.bbox });

    // En mode trapèze, les coins (nw/ne/se/sw) déplacent le skew
    const isCorner = ['nw', 'ne', 'se', 'sw'].includes(handle);
    if (zone.shape === 'trapezoid' && isCorner) {
      setDragSkewStart({ ...(zone.skew || { tl: 0, tr: 0, bl: 0, br: 0 }) });
      setDragMode(`skew-${handle}`);
    } else {
      setDragMode(`resize-${handle}`);
    }
  }, [getSvgPoint, pushHistory]);

  // Mouse move
  const handleMouseMove = useCallback((e) => {
    if (!dragMode || !dragStart || !dragZoneStart || !selectedZoneId) return;
    const pt = getSvgPoint(e);
    const dx = pt.x - dragStart.x;
    const dy = pt.y - dragStart.y;

    if (dragMode === 'move') {
      updateZoneBbox(selectedZoneId, {
        x: snapToGrid(Math.max(0, Math.min(SVG_WIDTH - dragZoneStart.width, dragZoneStart.x + dx)), SNAP_GRID),
        y: snapToGrid(Math.max(0, Math.min(SVG_HEIGHT - dragZoneStart.height, dragZoneStart.y + dy)), SNAP_GRID),
      });
    } else if (dragMode.startsWith('resize-')) {
      const handle = dragMode.replace('resize-', '');
      let { x, y, width, height } = dragZoneStart;
      
      if (handle.includes('e')) {
        width = Math.max(MIN_ZONE_SIZE, snapToGrid(width + dx, SNAP_GRID));
      }
      if (handle.includes('w')) {
        const newX = snapToGrid(x + dx, SNAP_GRID);
        width = Math.max(MIN_ZONE_SIZE, width - (newX - x));
        x = newX;
      }
      if (handle.includes('s')) {
        height = Math.max(MIN_ZONE_SIZE, snapToGrid(height + dy, SNAP_GRID));
      }
      if (handle.includes('n')) {
        const newY = snapToGrid(y + dy, SNAP_GRID);
        height = Math.max(MIN_ZONE_SIZE, height - (newY - y));
        y = newY;
      }

      // Clamp to svg bounds
      x = Math.max(0, x);
      y = Math.max(0, y);
      if (x + width > SVG_WIDTH) width = SVG_WIDTH - x;
      if (y + height > SVG_HEIGHT) height = SVG_HEIGHT - y;

      updateZoneBbox(selectedZoneId, { x, y, width, height });
    } else if (dragMode.startsWith('skew-') && dragSkewStart) {
      const corner = dragMode.replace('skew-', '');
      // Mapping handle → skew key
      const cornerMap = { nw: 'tl', ne: 'tr', se: 'br', sw: 'bl' };
      const skewKey = cornerMap[corner];
      if (skewKey) {
        const newVal = snapToGrid((dragSkewStart[skewKey] || 0) + dx, SNAP_GRID);
        updateZoneSkew(selectedZoneId, skewKey, newVal);
      }
    }
  }, [dragMode, dragStart, dragZoneStart, dragSkewStart, selectedZoneId, getSvgPoint, updateZoneBbox, updateZoneSkew, SVG_WIDTH, SVG_HEIGHT]);

  const handleMouseUp = useCallback(() => {
    setDragMode(null);
    setDragStart(null);
    setDragZoneStart(null);
    setDragSkewStart(null);
  }, []);

  // Click on empty space deselects
  const handleSvgClick = (e) => {
    if (e.target === svgRef.current || e.target.tagName === 'rect' && e.target.dataset.bg) {
      setSelectedZoneId(null);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (selectedZoneId) setSelectedZoneId(null);
        else onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Arrow keys to nudge selected zone
      if (selectedZoneId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const zone = zonesData.zones.find(z => z.id === selectedZoneId);
        if (!zone) return;
        const step = e.shiftKey ? 10 : SNAP_GRID;
        pushHistory();
        const { x, y, width, height } = zone.bbox;
        switch (e.key) {
          case 'ArrowLeft':  updateZoneBbox(selectedZoneId, { x: Math.max(0, x - step) }); break;
          case 'ArrowRight': updateZoneBbox(selectedZoneId, { x: Math.min(SVG_WIDTH - width, x + step) }); break;
          case 'ArrowUp':    updateZoneBbox(selectedZoneId, { y: Math.max(0, y - step) }); break;
          case 'ArrowDown':  updateZoneBbox(selectedZoneId, { y: Math.min(SVG_HEIGHT - height, y + step) }); break;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedZoneId, zonesData, SVG_WIDTH, SVG_HEIGHT]);

  // Global mouse events for drag
  useEffect(() => {
    if (dragMode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleMouseMove);
        window.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [dragMode, handleMouseMove, handleMouseUp]);

  // Save
  const [saveMsg, setSaveMsg] = useState(null);
  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const result = await api.saveDepotZones(depotId, zonesData);
      setDirty(false);
      setSaveMsg({ type: 'success', text: `✅ Sauvegardé (${result?.zonesCount || zonesData.zones?.length} zones)` });
      // Notify parent to reload data (but DON'T close editor)
      if (onSaved) onSaved(zonesData);
      // Auto-dismiss message
      setTimeout(() => setSaveMsg(null), 4000);
    } catch (err) {
      console.error('Save error:', err);
      setSaveMsg({ type: 'error', text: `❌ Erreur: ${err.message || err}` });
    } finally {
      setSaving(false);
    }
  };

  // Delete selected zone
  const handleDeleteZone = () => {
    if (!selectedZoneId) return;
    if (!confirm(`Supprimer la zone "${selectedZoneId}" ?`)) return;
    pushHistory();
    setZonesData(prev => ({
      ...prev,
      zones: prev.zones.filter(z => z.id !== selectedZoneId),
    }));
    setSelectedZoneId(null);
    setDirty(true);
  };

  // Duplicate selected zone
  const handleDuplicateZone = () => {
    if (!selectedZone) return;
    pushHistory();
    const newId = selectedZone.id + '_copy';
    const newZone = {
      ...JSON.parse(JSON.stringify(selectedZone)),
      id: newId,
      label: selectedZone.label + ' (copie)',
      codes: [newId],
      bbox: {
        ...selectedZone.bbox,
        x: selectedZone.bbox.x + 20,
        y: selectedZone.bbox.y + 20,
      },
    };
    setZonesData(prev => ({
      ...prev,
      zones: [...prev.zones, newZone],
    }));
    setSelectedZoneId(newId);
    setDirty(true);
  };

  // Add new zone
  const handleAddZone = () => {
    const id = prompt('Identifiant de la nouvelle zone (ex: A6, K5):');
    if (!id) return;
    if (zonesData.zones.some(z => z.id === id)) {
      alert('Cette zone existe déjà !');
      return;
    }
    pushHistory();
    const cat = zonesData.categories?.[0];
    const newZone = {
      id,
      label: id,
      category: cat?.id || 'divers',
      color: cat?.color || '#94a3b8',
      textColor: '#ffffff',
      floor: activeFloor,
      codes: [id],
      bbox: { x: 50, y: 50, width: 100, height: 60 },
      shape: 'rect',
      skew: { tl: 0, tr: 0, bl: 0, br: 0 },
    };
    setZonesData(prev => ({
      ...prev,
      zones: [...prev.zones, newZone],
    }));
    setSelectedZoneId(id);
    setDirty(true);
  };

  // Edit zone properties
  const handleZonePropertyChange = (field, value) => {
    if (!selectedZoneId) return;
    setZonesData(prev => ({
      ...prev,
      zones: prev.zones.map(z => z.id === selectedZoneId ? { ...z, [field]: value } : z),
    }));
    setDirty(true);
  };

  // Edit zone color from categories
  const handleZoneCategoryChange = (catId) => {
    const cat = zonesData.categories?.find(c => c.id === catId);
    if (!cat) return;
    pushHistory();
    setZonesData(prev => ({
      ...prev,
      zones: prev.zones.map(z => z.id === selectedZoneId ? { ...z, category: catId, color: cat.color } : z),
    }));
    setDirty(true);
  };

  // Update a zone's skew value
  const updateZoneSkew = useCallback((zoneId, corner, value) => {
    setZonesData(prev => ({
      ...prev,
      zones: prev.zones.map(z => z.id === zoneId
        ? { ...z, skew: { ...(z.skew || { tl: 0, tr: 0, bl: 0, br: 0 }), [corner]: value } }
        : z
      ),
    }));
    setDirty(true);
  }, []);

  // Resize handles for a zone
  const renderHandles = (zone) => {
    if (zone.id !== selectedZoneId) return null;
    const { x, y, width, height } = zone.bbox;
    const hs = HANDLE_SIZE / 2;
    const isTrapezoid = zone.shape === 'trapezoid';
    const pts = isTrapezoid ? getZonePoints(zone.bbox, zone.skew) : null;
    const handles = isTrapezoid ? [
      { id: 'nw', cx: pts[0].x, cy: pts[0].y },
      { id: 'n',  cx: (pts[0].x + pts[1].x) / 2, cy: y },
      { id: 'ne', cx: pts[1].x, cy: pts[1].y },
      { id: 'e',  cx: x + width, cy: y + height / 2 },
      { id: 'se', cx: pts[2].x, cy: pts[2].y },
      { id: 's',  cx: (pts[3].x + pts[2].x) / 2, cy: y + height },
      { id: 'sw', cx: pts[3].x, cy: pts[3].y },
      { id: 'w',  cx: x, cy: y + height / 2 },
    ] : [
      { id: 'nw', cx: x, cy: y },
      { id: 'n',  cx: x + width / 2, cy: y },
      { id: 'ne', cx: x + width, cy: y },
      { id: 'e',  cx: x + width, cy: y + height / 2 },
      { id: 'se', cx: x + width, cy: y + height },
      { id: 's',  cx: x + width / 2, cy: y + height },
      { id: 'sw', cx: x, cy: y + height },
      { id: 'w',  cx: x, cy: y + height / 2 },
    ];

    const cursors = {
      nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize',
      e: 'ew-resize', se: 'nwse-resize', s: 'ns-resize',
      sw: 'nesw-resize', w: 'ew-resize',
    };

    const isCornerHandle = (id) => ['nw', 'ne', 'se', 'sw'].includes(id);
    const isTrapCorner = (id) => zone.shape === 'trapezoid' && isCornerHandle(id);

    return handles.map(h => (
      isTrapCorner(h.id) ? (
        <g key={h.id}>
          <rect
            x={h.cx - hs - 1}
            y={h.cy - hs - 1}
            width={HANDLE_SIZE + 2}
            height={HANDLE_SIZE + 2}
            fill="#fbbf24"
            stroke="#f59e0b"
            strokeWidth="1.5"
            rx="2"
            style={{ cursor: 'grab' }}
            onMouseDown={(e) => handleHandleMouseDown(e, zone, h.id)}
            onTouchStart={(e) => handleHandleMouseDown(e, zone, h.id)}
          />
          <text x={h.cx} y={h.cy + 1} textAnchor="middle" dominantBaseline="middle"
            fill="#000" fontSize="6" fontWeight="700" style={{ pointerEvents: 'none' }}>◆</text>
        </g>
      ) : (
        <rect
          key={h.id}
          x={h.cx - hs}
          y={h.cy - hs}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth="1.5"
          style={{ cursor: cursors[h.id] }}
          onMouseDown={(e) => handleHandleMouseDown(e, zone, h.id)}
          onTouchStart={(e) => handleHandleMouseDown(e, zone, h.id)}
        />
      )
    ));
  };

  return (
    <div className="depot-editor-overlay">
      <div className="depot-editor-panel">
        {/* Header */}
        <div className="depot-editor-header">
          <div className="depot-editor-title">
            <Grid3X3 size={18} />
            <span>Éditeur de plan — {zonesData.name || `Dépôt ${depotId}`}</span>
            {dirty && <span className="depot-editor-dirty">● Modifié</span>}
            {saveMsg && <span className={`depot-editor-msg depot-editor-msg-${saveMsg.type}`}>{saveMsg.text}</span>}
          </div>
          <div className="depot-editor-actions">
            <button className="dep-ed-btn" onClick={handleUndo} disabled={history.length === 0} title="Annuler (⌘Z)">
              <Undo2 size={16} /> Annuler
            </button>
            <button className="dep-ed-btn dep-ed-btn-save" onClick={handleSave} disabled={saving || !dirty} title="Sauvegarder (⌘S)">
              <Save size={16} /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
            <button className="dep-ed-btn dep-ed-btn-close" onClick={onClose} title="Fermer (Esc)">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="depot-editor-body">
          {/* Sidebar */}
          <div className="depot-editor-sidebar">
            {/* Floor selector */}
            <div className="dep-ed-section">
              <label>Étage</label>
              <div className="dep-ed-floor-btns">
                {floors.map(f => (
                  <button key={f.id} className={`dep-ed-floor-btn ${activeFloor === f.id ? 'active' : ''}`}
                    onClick={() => setActiveFloor(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Overlay controls */}
            <div className="dep-ed-section">
              <label>Image de référence</label>
              <div className="dep-ed-overlay-controls">
                <button className={`dep-ed-btn-sm ${overlayVisible ? 'active' : ''}`}
                  onClick={() => setOverlayVisible(!overlayVisible)}>
                  {overlayVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                  {overlayVisible ? 'Visible' : 'Masquée'}
                </button>
                <div className="dep-ed-slider-row">
                  <span>Opacité :</span>
                  <input type="range" min="0" max="100" value={overlayOpacity * 100}
                    onChange={e => setOverlayOpacity(e.target.value / 100)} />
                  <span>{Math.round(overlayOpacity * 100)}%</span>
                </div>
              </div>
              <button className={`dep-ed-btn-sm ${showGrid ? 'active' : ''}`}
                onClick={() => setShowGrid(!showGrid)} style={{ marginTop: 4 }}>
                <Grid3X3 size={14} /> Grille
              </button>
            </div>

            {/* SVG dimensions */}
            <div className="dep-ed-section">
              <label>Dimensions SVG</label>
              <div className="dep-ed-dim-inputs">
                <input type="number" value={SVG_WIDTH} min={200} max={2000} step={10}
                  onChange={e => updateSvgDimensions(parseInt(e.target.value) || SVG_WIDTH, SVG_HEIGHT)} />
                <span>×</span>
                <input type="number" value={SVG_HEIGHT} min={200} max={2000} step={10}
                  onChange={e => updateSvgDimensions(SVG_WIDTH, parseInt(e.target.value) || SVG_HEIGHT)} />
              </div>
            </div>

            {/* Couleurs des catégories */}
            {zonesData.categories?.length > 0 && (
              <div className="dep-ed-section">
                <label>Couleurs catégories</label>
                {zonesData.categories.map(cat => (
                  <div key={cat.id} className="dep-ed-cat-block">
                    <div className="dep-ed-field dep-ed-cat-color">
                      <input type="color" value={cat.color}
                        onChange={e => {
                          pushHistory();
                          const newColor = e.target.value;
                          setZonesData(prev => ({
                            ...prev,
                            categories: prev.categories.map(c => c.id === cat.id ? { ...c, color: newColor } : c),
                            zones: prev.zones.map(z => z.category === cat.id ? { ...z, color: newColor } : z),
                          }));
                          setDirty(true);
                        }} />
                      <span className="dep-ed-cat-label">{cat.label}</span>
                    </div>
                    {usedColors.length > 1 && (
                      <div className="dep-ed-palette dep-ed-palette-sm">
                        {usedColors.map(c => (
                          <button key={c} className={`dep-ed-swatch${c === cat.color?.toLowerCase() ? ' active' : ''}`}
                            style={{ background: c }} title={c}
                            onClick={() => {
                              pushHistory();
                              setZonesData(prev => ({
                                ...prev,
                                categories: prev.categories.map(ct => ct.id === cat.id ? { ...ct, color: c } : ct),
                                zones: prev.zones.map(z => z.category === cat.id ? { ...z, color: c } : z),
                              }));
                              setDirty(true);
                            }} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Zone actions */}
            <div className="dep-ed-section">
              <label>Zones</label>
              <button className="dep-ed-btn-sm" onClick={handleAddZone}>
                <Plus size={14} /> Nouvelle zone
              </button>
              {selectedZone && (
                <>
                  <button className="dep-ed-btn-sm" onClick={handleDuplicateZone}>
                    <Copy size={14} /> Dupliquer
                  </button>
                  <button className="dep-ed-btn-sm dep-ed-btn-danger" onClick={handleDeleteZone}>
                    <Trash2 size={14} /> Supprimer
                  </button>
                </>
              )}
            </div>

            {/* Selected zone properties */}
            {selectedZone && (
              <div className="dep-ed-section dep-ed-props">
                <label>Zone : {selectedZone.id}</label>
                <div className="dep-ed-field">
                  <span>Label</span>
                  <input type="text" value={selectedZone.label}
                    onChange={e => handleZonePropertyChange('label', e.target.value)} />
                </div>
                <div className="dep-ed-field">
                  <span>Catégorie</span>
                  <select value={selectedZone.category}
                    onChange={e => handleZoneCategoryChange(e.target.value)}>
                    {zonesData.categories?.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div className="dep-ed-field dep-ed-color-field">
                  <span>Couleur</span>
                  <input type="color" value={selectedZone.color}
                    onChange={e => { pushHistory(); handleZonePropertyChange('color', e.target.value); }} />
                  <input type="text" value={selectedZone.color} className="dep-ed-hex-input"
                    onChange={e => {
                      const v = e.target.value;
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) { pushHistory(); handleZonePropertyChange('color', v); }
                    }}
                    onBlur={e => {
                      let v = e.target.value.trim();
                      if (!v.startsWith('#')) v = '#' + v;
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) { pushHistory(); handleZonePropertyChange('color', v); }
                    }} />
                </div>
                {usedColors.length > 1 && (
                  <div className="dep-ed-palette">
                    {usedColors.map(c => (
                      <button key={c} className={`dep-ed-swatch${c === selectedZone.color?.toLowerCase() ? ' active' : ''}`}
                        style={{ background: c }} title={c}
                        onClick={() => { pushHistory(); handleZonePropertyChange('color', c); }} />
                    ))}
                  </div>
                )}
                <div className="dep-ed-coords">
                  <div className="dep-ed-field">
                    <span>X</span>
                    <input type="number" value={selectedZone.bbox.x} step={SNAP_GRID}
                      onChange={e => { pushHistory(); updateZoneBbox(selectedZone.id, { x: parseInt(e.target.value) || 0 }); }} />
                  </div>
                  <div className="dep-ed-field">
                    <span>Y</span>
                    <input type="number" value={selectedZone.bbox.y} step={SNAP_GRID}
                      onChange={e => { pushHistory(); updateZoneBbox(selectedZone.id, { y: parseInt(e.target.value) || 0 }); }} />
                  </div>
                  <div className="dep-ed-field">
                    <span>L</span>
                    <input type="number" value={selectedZone.bbox.width} step={SNAP_GRID} min={MIN_ZONE_SIZE}
                      onChange={e => { pushHistory(); updateZoneBbox(selectedZone.id, { width: parseInt(e.target.value) || MIN_ZONE_SIZE }); }} />
                  </div>
                  <div className="dep-ed-field">
                    <span>H</span>
                    <input type="number" value={selectedZone.bbox.height} step={SNAP_GRID} min={MIN_ZONE_SIZE}
                      onChange={e => { pushHistory(); updateZoneBbox(selectedZone.id, { height: parseInt(e.target.value) || MIN_ZONE_SIZE }); }} />
                  </div>
                </div>

                {/* Forme */}
                <div className="dep-ed-field">
                  <span>Forme</span>
                  <select value={selectedZone.shape || 'rect'}
                    onChange={e => {
                      pushHistory();
                      const newShape = e.target.value;
                      handleZonePropertyChange('shape', newShape);
                      if (newShape === 'trapezoid' && !selectedZone.skew) {
                        handleZonePropertyChange('skew', { tl: 0, tr: 0, bl: 0, br: 0 });
                      }
                    }}>
                    <option value="rect">Rectangle</option>
                    <option value="trapezoid">Trapèze</option>
                  </select>
                </div>

                {/* Contrôles trapèze */}
                {(selectedZone.shape === 'trapezoid') && (() => {
                  const sk = selectedZone.skew || { tl: 0, tr: 0, bl: 0, br: 0 };
                  return (
                    <div className="dep-ed-skew-controls">
                      <label>Décalage coins (px)</label>
                      <div className="dep-ed-skew-grid">
                        <div className="dep-ed-field">
                          <span>↖ HG</span>
                          <input type="number" value={sk.tl || 0} step={5}
                            onChange={e => { pushHistory(); updateZoneSkew(selectedZone.id, 'tl', parseInt(e.target.value) || 0); }} />
                        </div>
                        <div className="dep-ed-field">
                          <span>↗ HD</span>
                          <input type="number" value={sk.tr || 0} step={5}
                            onChange={e => { pushHistory(); updateZoneSkew(selectedZone.id, 'tr', parseInt(e.target.value) || 0); }} />
                        </div>
                        <div className="dep-ed-field">
                          <span>↙ BG</span>
                          <input type="number" value={sk.bl || 0} step={5}
                            onChange={e => { pushHistory(); updateZoneSkew(selectedZone.id, 'bl', parseInt(e.target.value) || 0); }} />
                        </div>
                        <div className="dep-ed-field">
                          <span>↘ BD</span>
                          <input type="number" value={sk.br || 0} step={5}
                            onChange={e => { pushHistory(); updateZoneSkew(selectedZone.id, 'br', parseInt(e.target.value) || 0); }} />
                        </div>
                      </div>
                      <button className="dep-ed-btn-sm" onClick={() => {
                        pushHistory();
                        handleZonePropertyChange('skew', { tl: 0, tr: 0, bl: 0, br: 0 });
                      }}>Réinitialiser</button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Zone list */}
            <div className="dep-ed-section dep-ed-zone-list">
              <label>{floorZones.length} zones — {activeFloor}</label>
              {floorZones.map(zone => (
                <button key={zone.id}
                  className={`dep-ed-zone-item ${selectedZoneId === zone.id ? 'active' : ''}`}
                  onClick={() => setSelectedZoneId(zone.id)}>
                  <span className="dep-ed-zone-dot" style={{ background: zone.color }} />
                  <span className="dep-ed-zone-name">{zone.id}</span>
                  <span className="dep-ed-zone-dim">{zone.bbox.width}×{zone.bbox.height}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main canvas */}
          <div className="depot-editor-canvas">
            <div className="depot-editor-svg-container">
              <svg
                ref={svgRef}
                viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
                className="depot-editor-svg"
                onClick={handleSvgClick}
                overflow="hidden"
                style={{ width: '100%', height: 'auto', aspectRatio: `${bounds.w} / ${bounds.h}` }}
              >
                {/* Background */}
                <rect data-bg="true" x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} rx="4"
                  fill={overlayVisible ? 'transparent' : '#1e1e2e'} stroke="#334155" strokeWidth="2" />

                {/* Reference image overlay inside SVG — preserveAspectRatio keeps proportions */}
                {overlayVisible && (
                  <image
                    href={overlayImage}
                    x="0" y="0"
                    width={SVG_WIDTH} height={SVG_HEIGHT}
                    opacity={overlayOpacity}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* Grid */}
                {showGrid && Array.from({ length: Math.floor(bounds.w / 50) + 1 }, (_, i) => {
                  const gx = bounds.x + i * 50;
                  return <line key={`gv${i}`} x1={gx} y1={bounds.y} x2={gx} y2={bounds.y + bounds.h}
                    stroke="#ffffff" strokeWidth="0.3" strokeOpacity="0.15" strokeDasharray="2 4" />;
                })}
                {showGrid && Array.from({ length: Math.floor(bounds.h / 50) + 1 }, (_, i) => {
                  const gy = bounds.y + i * 50;
                  return <line key={`gh${i}`} x1={bounds.x} y1={gy} x2={bounds.x + bounds.w} y2={gy}
                    stroke="#ffffff" strokeWidth="0.3" strokeOpacity="0.15" strokeDasharray="2 4" />;
                })}

                {/* Zones */}
                {floorZones.map(zone => {
                  const { x, y, width, height } = zone.bbox;
                  const isSelected = zone.id === selectedZoneId;
                  const isTrapezoid = zone.shape === 'trapezoid' && hasSkew(zone);
                  const shapeProps = {
                    fill: zone.color,
                    fillOpacity: isSelected ? 0.7 : 0.5,
                    stroke: isSelected ? '#ffffff' : zone.color,
                    strokeWidth: isSelected ? 2 : 1,
                    style: { cursor: 'move' },
                    onMouseDown: (e) => handleZoneMouseDown(e, zone),
                    onTouchStart: (e) => handleZoneMouseDown(e, zone),
                  };

                  return (
                    <g key={zone.id}>
                      {/* Zone shape (rect ou trapèze) */}
                      {isTrapezoid ? (
                        <polygon
                          points={pointsToSvg(getZonePoints(zone.bbox, zone.skew))}
                          {...shapeProps}
                        />
                      ) : (
                        <rect
                          x={x} y={y} width={width} height={height} rx="4"
                          {...shapeProps}
                        />
                      )}

                      {/* Zone label */}
                      <text
                        x={x + width / 2} y={y + height / 2}
                        textAnchor="middle" dominantBaseline="middle"
                        fill={zone.textColor || '#ffffff'}
                        fontSize={Math.min(13, width / 5)}
                        fontWeight="600"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {zone.id}
                      </text>

                      {/* Resize handles */}
                      {renderHandles(zone)}
                    </g>
                  );
                })}

                {/* Axis labels */}
                {showGrid && (
                  <>
                    {Array.from({ length: Math.floor(bounds.w / 100) + 1 }, (_, i) => {
                      const lx = Math.round((bounds.x + i * 100) / 100) * 100;
                      return <text key={`lx${i}`} x={lx + 2} y={bounds.y + 12}
                        fill="#9ca3af" fontSize="8" style={{ pointerEvents: 'none' }}>
                        {lx}
                      </text>;
                    })}
                    {Array.from({ length: Math.floor(bounds.h / 100) + 1 }, (_, i) => {
                      const ly = Math.round((bounds.y + i * 100) / 100) * 100;
                      return <text key={`ly${i}`} x={bounds.x + 2} y={ly + 10}
                        fill="#9ca3af" fontSize="8" style={{ pointerEvents: 'none' }}>
                        {ly}
                      </text>;
                    })}
                  </>
                )}
              </svg>
            </div>

            {/* Info bar */}
            <div className="depot-editor-info">
              <span>Vue: {Math.round(bounds.w)}×{Math.round(bounds.h)}</span>
              <span>|</span>
              <span>Zones: {floorZones.length}</span>
              {selectedZone && (
                <>
                  <span>|</span>
                  <span>{selectedZone.id}: ({selectedZone.bbox.x}, {selectedZone.bbox.y}) {selectedZone.bbox.width}×{selectedZone.bbox.height}</span>
                  {selectedZone.shape === 'trapezoid' && (
                    <span> skew: ↖{(selectedZone.skew?.tl||0)} ↗{(selectedZone.skew?.tr||0)} ↙{(selectedZone.skew?.bl||0)} ↘{(selectedZone.skew?.br||0)}</span>
                  )}
                </>
              )}
              <span className="depot-editor-info-hints">
                Flèches: déplacer · Shift+Flèches: ×10 · ⌘Z: annuler · ⌘S: sauvegarder
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
