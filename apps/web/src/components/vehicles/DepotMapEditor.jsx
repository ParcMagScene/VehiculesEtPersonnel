// ============================================================
// DepotMapEditor.jsx — Éditeur visuel des zones de dépôt
// Permet de déplacer, redimensionner les zones avec une image
// de référence en overlay pour aligner précisément
// ============================================================

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Save, X, Undo2, Redo2, Maximize2, Plus, Trash2, RotateCcw, Eye, EyeOff, Grid3X3, Copy, ZoomIn, ZoomOut, Scissors } from 'lucide-react';
import api from '../../utils/api';
import './DepotMapEditor.css';
import { Button, Input, Select, Tooltip } from '@/design-system';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

const HANDLE_SIZE = 8;
const SNAP_GRID = 5;
const MIN_ZONE_SIZE = 20;

function snapToGrid(val, grid) {
  return Math.round(val / grid) * grid;
}

/**
 * Normalise une valeur de skew : nombre → {x, y}
 */
function skewVal(v) {
  if (v == null) return { x: 0, y: 0 };
  if (typeof v === 'number') return { x: v, y: 0 };
  return { x: v.x || 0, y: v.y || 0 };
}

/**
 * Calcule les 4 coins d'une zone (rectangle ou trapèze)
 * skew: { tl, tr, bl, br } = décalage {x,y} de chaque coin (ou nombre = x seulement)
 * Retourne les points dans l'ordre: haut-gauche, haut-droit, bas-droit, bas-gauche
 */
export function getZonePoints(bbox, skew) {
  const { x, y, width, height } = bbox;
  const s = skew || {};
  const tl = skewVal(s.tl), tr = skewVal(s.tr), br = skewVal(s.br), bl = skewVal(s.bl);
  return [
    { x: x + tl.x,         y: y + tl.y },
    { x: x + width + tr.x, y: y + tr.y },
    { x: x + width + br.x, y: y + height + br.y },
    { x: x + bl.x,         y: y + height + bl.y },
  ];
}

function pointsToSvg(points) {
  return points.map(p => `${p.x},${p.y}`).join(' ');
}

export function hasSkew(zone) {
  const s = zone.skew;
  if (!s) return false;
  const v = (k) => { const sv = skewVal(s[k]); return sv.x !== 0 || sv.y !== 0; };
  return v('tl') || v('tr') || v('bl') || v('br');
}

// ── Polygon geometry utilities for boolean operations ──

/** Get polygon points from zone (clipPoints if present, else computed from bbox/skew) */
export function getZonePoly(zone) {
  if (zone.clipPoints && zone.clipPoints.length >= 3) return zone.clipPoints;
  return getZonePoints(zone.bbox, zone.skew);
}

/** Test if a point is inside a polygon (ray casting) */
function ptInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i].y, yj = poly[j].y;
    if ((yi > pt.y) !== (yj > pt.y)) {
      const xi = poly[i].x + (pt.y - yi) / (yj - yi) * (poly[j].x - poly[i].x);
      if (pt.x < xi) inside = !inside;
    }
  }
  return inside;
}

/** Intersection of two segments [a1,a2] and [b1,b2] */
function segIntersect(a1, a2, b1, b2) {
  const dx1 = a2.x - a1.x, dy1 = a2.y - a1.y;
  const dx2 = b2.x - b1.x, dy2 = b2.y - b1.y;
  const d = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(d) < 1e-9) return null;
  const t = ((b1.x - a1.x) * dy2 - (b1.y - a1.y) * dx2) / d;
  const u = ((b1.x - a1.x) * dy1 - (b1.y - a1.y) * dx1) / d;
  const EPS = 1e-6;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { point: { x: a1.x + t * dx1, y: a1.y + t * dy1 }, tA: t, tB: u };
}

/** Signed polygon area (positive = CCW in math coords / CW on screen) */
function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return a / 2;
}

/** Ensure polygon has consistent winding (positive area) */
function ensureCCW(pts) {
  return polyArea(pts) < 0 ? [...pts].reverse() : pts;
}

/** Compute bbox from arbitrary points */
function bboxFromPoints(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: Math.round(minX), y: Math.round(minY), width: Math.round(maxX - minX), height: Math.round(maxY - minY) };
}

/**
 * Boolean subtraction: subject minus clip (convex polygons).
 * Returns new polygon points, null (empty), or subject (no overlap).
 */
function subtractConvexPolygons(subject, clip) {
  subject = ensureCCW(subject);
  clip = ensureCCW(clip);
  const n = subject.length, m = clip.length;

  const sInC = subject.map(p => ptInPoly(p, clip));
  const cInS = clip.map(p => ptInPoly(p, subject));

  if (sInC.every(v => v)) return null; // subject entirely inside clip
  if (cInS.every(v => v)) return subject; // clip entirely inside subject — skip (would create hole)

  // Find edge intersections
  const ixs = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      const ix = segIntersect(subject[i], subject[(i + 1) % n], clip[j], clip[(j + 1) % m]);
      if (ix) ixs.push({ ...ix, si: i, ci: j });
    }

  // Deduplicate close points
  const deduped = [];
  for (const ix of ixs)
    if (!deduped.some(d => Math.abs(d.point.x - ix.point.x) < 0.5 && Math.abs(d.point.y - ix.point.y) < 0.5))
      deduped.push(ix);

  if (deduped.length < 2) {
    // Check if they overlap at all even without 2 clean crossings
    if (!sInC.some(v => v) && !cInS.some(v => v)) return subject; // no overlap
    return subject; // edge case (tangent/collinear), return unchanged
  }

  deduped.sort((a, b) => a.si !== b.si ? a.si - b.si : a.tA - b.tA);
  const [p1, p2] = deduped;

  // Determine entry (into clip) vs exit (out of clip)
  const nextVert = subject[(p1.si + 1) % n];
  const p1IsEntry = ptInPoly(nextVert, clip);
  const entry = p1IsEntry ? p1 : p2;
  const exit_ = p1IsEntry ? p2 : p1;

  const rnd = p => ({ x: Math.round(p.x), y: Math.round(p.y) });
  const result = [];

  // Start at exit, walk subject outside clip to entry
  result.push(rnd(exit_.point));
  let si = (exit_.si + 1) % n;
  const stopSi = (entry.si + 1) % n;
  let safety = 0;
  while (si !== stopSi && safety++ < n + 2) {
    result.push(rnd(subject[si]));
    si = (si + 1) % n;
  }

  // Add entry point, walk clip backward (inside subject) to exit
  result.push(rnd(entry.point));
  let ci = entry.ci;
  safety = 0;
  while (ci !== exit_.ci && safety++ < m + 2) {
    if (cInS[ci]) result.push(rnd(clip[ci]));
    ci = (ci - 1 + m) % m;
  }

  return result.length >= 3 ? result : subject;
}

/** Compute bounding box encompassing all zones (accounting for skew) + padding */
export function computeZonesBounds(zones, padding = 20) {
  if (!zones || zones.length === 0) return { x: 0, y: 0, w: 400, h: 300 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const zone of zones) {
    if (zone.clipPoints && zone.clipPoints.length >= 3) {
      for (const p of zone.clipPoints) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    } else if (zone.shape === 'trapezoid' && hasSkew(zone)) {
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
  const [redoStack, setRedoStack] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Boolean subtraction mode
  const [subtractMode, setSubtractMode] = useState(null); // null | 'pick-target' | 'choose'
  const [subtractSourceId, setSubtractSourceId] = useState(null);
  const [subtractTargetId, setSubtractTargetId] = useState(null);

  // Overlay image
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.35);
  const [showGrid, setShowGrid] = useState(true);

  // Drag state
  const [dragMode, setDragMode] = useState(null); // 'move' | 'resize-*' | 'skew-*' | null
  const [dragStart, setDragStart] = useState(null);
  const [dragZoneStart, setDragZoneStart] = useState(null);
  const [dragSkewStart, setDragSkewStart] = useState(null);
  const [dragClipPointsStart, setDragClipPointsStart] = useState(null);

  const svgRef = useRef(null);
  const canvasRef = useRef(null);

  // Zoom/Pan state for editor
  const [editorZoom, setEditorZoom] = useState(1);
  const [editorPan, setEditorPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();

  const EDITOR_MIN_ZOOM = 0.3;
  const EDITOR_MAX_ZOOM = 6;
  const EDITOR_ZOOM_STEP = 0.15;

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
    ? '/images/ZonesDepôt2.png'
    : '/images/ZonesDepôt1.png';
  
  // Which part of the image to show for the current floor
  // Depot 1: image is landscape with RDC left, MEZZ right
  // Depot 2: image is portrait with RDC top, MEZZ bottom
  const _overlayClip = useMemo(() => {
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

  // Zoom/Pan handlers for editor canvas
  const handleEditorWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -EDITOR_ZOOM_STEP : EDITOR_ZOOM_STEP;
    setEditorZoom(z => Math.max(EDITOR_MIN_ZOOM, Math.min(EDITOR_MAX_ZOOM, z + delta)));
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (el) {
      el.addEventListener('wheel', handleEditorWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleEditorWheel);
    }
  }, [handleEditorWheel]);

  // Space key for pan mode
  useEffect(() => {
    const onKeyDown = (e) => { if (e.code === 'Space' && !e.repeat) { setSpaceHeld(true); } };
    const onKeyUp = (e) => { if (e.code === 'Space') { setSpaceHeld(false); setIsPanning(false); } };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  const handleCanvasMouseDown = useCallback((e) => {
    // Middle mouse button OR space held = start panning
    if (e.button === 1 || spaceHeld) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - editorPan.x, y: e.clientY - editorPan.y });
    }
  }, [spaceHeld, editorPan]);

  const handleCanvasMouseMove = useCallback((e) => {
    if (!isPanning) return;
    setEditorPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleEditorZoomIn = () => setEditorZoom(z => Math.min(EDITOR_MAX_ZOOM, z + EDITOR_ZOOM_STEP * 2));
  const handleEditorZoomOut = () => setEditorZoom(z => Math.max(EDITOR_MIN_ZOOM, z - EDITOR_ZOOM_STEP * 2));
  const handleEditorZoomReset = () => { setEditorZoom(1); setEditorPan({ x: 0, y: 0 }); };
  const handleEditorZoomFit = () => {
    const container = canvasRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const scaleX = (rect.width - 32) / bounds.w;
    const scaleY = (rect.height - 32) / bounds.h;
    setEditorZoom(Math.max(EDITOR_MIN_ZOOM, Math.min(EDITOR_MAX_ZOOM, Math.min(scaleX, scaleY))));
    setEditorPan({ x: 0, y: 0 });
  };

  // Save snapshot for undo
  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-30), JSON.stringify(zonesData)]);
    setRedoStack([]); // Clear redo on new action
  }, [zonesData]);

  const handleUndo = () => {
    if (history.length === 0) return;
    setRedoStack(r => [...r.slice(-30), JSON.stringify(zonesData)]);
    const last = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setZonesData(JSON.parse(last));
    setDirty(true);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    setHistory(h => [...h.slice(-30), JSON.stringify(zonesData)]);
    const next = redoStack[redoStack.length - 1];
    setRedoStack(r => r.slice(0, -1));
    setZonesData(JSON.parse(next));
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

  // Update a zone's skew value
  const updateZoneSkew = useCallback((zoneId, corner, value) => {
    setZonesData(prev => ({
      ...prev,
      zones: prev.zones.map(z => z.id === zoneId
        ? { ...z, skew: { ...(z.skew || { tl: {x:0,y:0}, tr: {x:0,y:0}, bl: {x:0,y:0}, br: {x:0,y:0} }), [corner]: value } }
        : z
      ),
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
    if (spaceHeld) return; // Pan mode — don't drag zones
    // Boolean subtraction: intercept clicks in pick-target mode
    if (subtractMode === 'pick-target' && zone.id !== subtractSourceId) {
      e.stopPropagation();
      e.preventDefault();
      handleSubtractZoneClick(zone.id);
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    pushHistory();
    setSelectedZoneId(zone.id);
    setDragMode('move');
    const pt = getSvgPoint(e);
    setDragStart(pt);
    setDragZoneStart({ ...zone.bbox });
    if (zone.clipPoints) setDragClipPointsStart(zone.clipPoints.map(p => ({ ...p })));
    else setDragClipPointsStart(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getSvgPoint, pushHistory, spaceHeld, subtractMode, subtractSourceId]);

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
      setDragSkewStart({ ...(zone.skew || { tl: {x:0,y:0}, tr: {x:0,y:0}, bl: {x:0,y:0}, br: {x:0,y:0} }) });
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
      const newBbox = {
        x: snapToGrid(Math.max(0, Math.min(SVG_WIDTH - dragZoneStart.width, dragZoneStart.x + dx)), SNAP_GRID),
        y: snapToGrid(Math.max(0, Math.min(SVG_HEIGHT - dragZoneStart.height, dragZoneStart.y + dy)), SNAP_GRID),
      };
      updateZoneBbox(selectedZoneId, newBbox);
      // Translate clipPoints too
      if (dragClipPointsStart) {
        const tdx = newBbox.x - dragZoneStart.x;
        const tdy = newBbox.y - dragZoneStart.y;
        setZonesData(prev => ({
          ...prev,
          zones: prev.zones.map(z => z.id === selectedZoneId
            ? { ...z, clipPoints: dragClipPointsStart.map(p => ({ x: p.x + tdx, y: p.y + tdy })) }
            : z),
        }));
      }
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
        const prev = skewVal(dragSkewStart[skewKey]);
        const newVal = {
          x: snapToGrid(prev.x + dx, SNAP_GRID),
          y: snapToGrid(prev.y + dy, SNAP_GRID),
        };
        updateZoneSkew(selectedZoneId, skewKey, newVal);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragMode, dragStart, dragZoneStart, dragSkewStart, selectedZoneId, getSvgPoint, updateZoneBbox, updateZoneSkew, SVG_WIDTH, SVG_HEIGHT]);

  const handleMouseUp = useCallback(() => {
    setDragMode(null);
    setDragStart(null);
    setDragZoneStart(null);
    setDragSkewStart(null);
    setDragClipPointsStart(null);
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
        if (subtractMode) { cancelSubtract(); return; }
        if (selectedZoneId) setSelectedZoneId(null);
        else onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const result = await api.updateEquipmentDepotZones(zonesData, depotId);
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
    confirm({
      title: 'Supprimer',
      message: `Supprimer la zone "${selectedZoneId}" ?`,
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: () => {
        pushHistory();
        setZonesData(prev => ({
          ...prev,
          zones: prev.zones.filter(z => z.id !== selectedZoneId),
        }));
        setSelectedZoneId(null);
        setDirty(true);
      },
    });
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

  // ── Boolean subtraction ──
  const startSubtractMode = () => {
    if (!selectedZoneId) return;
    setSubtractSourceId(selectedZoneId);
    setSubtractTargetId(null);
    setSubtractMode('pick-target');
  };

  const cancelSubtract = () => {
    setSubtractMode(null);
    setSubtractSourceId(null);
    setSubtractTargetId(null);
  };

  const handleSubtractZoneClick = (zoneId) => {
    if (subtractMode !== 'pick-target' || zoneId === subtractSourceId) return;
    setSubtractTargetId(zoneId);
    setSubtractMode('choose');
  };

  const executeSubtract = (keepIn) => {
    // keepIn = 'source' | 'target'
    // The zone NOT keeping the overlap gets clipped
    const srcZone = zonesData.zones.find(z => z.id === subtractSourceId);
    const tgtZone = zonesData.zones.find(z => z.id === subtractTargetId);
    if (!srcZone || !tgtZone) { cancelSubtract(); return; }

    const srcPoly = getZonePoly(srcZone);
    const tgtPoly = getZonePoly(tgtZone);

    // Zone to clip = the one NOT keeping the overlap
    const clipZoneId = keepIn === 'source' ? subtractTargetId : subtractSourceId;
    const subjectPoly = keepIn === 'source' ? tgtPoly : srcPoly;
    const clipperPoly = keepIn === 'source' ? srcPoly : tgtPoly;

    const result = subtractConvexPolygons(subjectPoly, clipperPoly);
    if (result === null) {
      alert(`La zone ${clipZoneId} serait entièrement supprimée. Opération annulée.`);
      cancelSubtract();
      return;
    }
    if (result === subjectPoly) {
      alert('Les zones ne se chevauchent pas, ou le découpage créerait un trou. Opération annulée.');
      cancelSubtract();
      return;
    }

    pushHistory();
    setZonesData(prev => ({
      ...prev,
      zones: prev.zones.map(z => {
        if (z.id !== clipZoneId) return z;
        return {
          ...z,
          clipPoints: result,
          bbox: bboxFromPoints(result),
          shape: 'polygon',
          skew: undefined,
        };
      }),
    }));
    setDirty(true);
    cancelSubtract();
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
 <Tooltip content="Annuler (⌘Z)" position="bottom">
   <Button variant="ghost" className="dep-ed-btn" onClick={handleUndo} disabled={history.length === 0}>
              <Undo2 size={16} /> Annuler
            </Button>
 </Tooltip>
 <Tooltip content="Rétablir (⌘⇧Z)" position="bottom">
   <Button variant="ghost" className="dep-ed-btn" onClick={handleRedo} disabled={redoStack.length === 0}>
              <Redo2 size={16} /> Rétablir
            </Button>
 </Tooltip>
 <Tooltip content="Sauvegarder (⌘S)" position="bottom">
   <Button variant="primary" onClick={handleSave} disabled={saving || !dirty}>
              <Save size={16} /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
 </Tooltip>
            <Tooltip content="Fermer (Esc)"><Button variant="ghost" className="dep-ed-btn dep-ed-btn-close" onClick={onClose}>
              <X size={16} />
            </Button></Tooltip>
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
                  <Button variant="ghost" key={f.id} className={`dep-ed-floor-btn ${activeFloor === f.id ? 'active' : ''}`}
                    onClick={() => setActiveFloor(f.id)}>
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Overlay controls */}
            <div className="dep-ed-section">
              <label>Image de référence</label>
              <div className="dep-ed-overlay-controls">
                <Button variant="ghost" className={`dep-ed-btn-sm ${overlayVisible ? 'active' : ''}`}
                  onClick={() => setOverlayVisible(!overlayVisible)}>
                  {overlayVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                  {overlayVisible ? 'Visible' : 'Masquée'}
                </Button>
                <div className="dep-ed-slider-row">
                  <span>Opacité :</span>
                  <input type="range" min="0" max="100" value={overlayOpacity * 100}
                    onChange={e => setOverlayOpacity(e.target.value / 100)} />
                  <span>{Math.round(overlayOpacity * 100)}%</span>
                </div>
              </div>
              <Button variant="ghost" className={`dep-ed-btn-sm ${showGrid ? 'active' : ''}`}
                onClick={() => setShowGrid(!showGrid)} style={{ marginTop: 4 }}>
                <Grid3X3 size={14} /> Grille
              </Button>
            </div>

            {/* SVG dimensions */}
            <div className="dep-ed-section">
              <label>Dimensions SVG</label>
              <div className="dep-ed-dim-inputs">
                <Input type="number" value={SVG_WIDTH} min={200} max={2000} step={10}
                  onChange={e => updateSvgDimensions(parseInt(e.target.value) || SVG_WIDTH, SVG_HEIGHT)} />
                <span>×</span>
                <Input type="number" value={SVG_HEIGHT} min={200} max={2000} step={10}
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
                          <Button variant="ghost" key={c} className={`dep-ed-swatch${c === cat.color?.toLowerCase() ? ' active' : ''}`}
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
              <Button variant="ghost" className="dep-ed-btn-sm" onClick={handleAddZone}>
                <Plus size={14} /> Nouvelle zone
              </Button>
              {selectedZone && (
                <>
                  <Button variant="ghost" className="dep-ed-btn-sm" onClick={handleDuplicateZone}>
                    <Copy size={14} /> Dupliquer
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleDeleteZone}>
                    <Trash2 size={14} /> Supprimer
                  </Button>
                  <Tooltip content="Soustraction booléenne — Découper le chevauchement entre deux zones" position="bottom">
                    <Button variant="ghost"                     className={`dep-ed-btn-sm ${subtractMode ? 'active' : ''}`}
                    onClick={subtractMode ? cancelSubtract : startSubtractMode}
 
                  >
                    <Scissors size={14} /> {subtractMode ? 'Annuler soustraction' : 'Soustraire'}
                  </Button>
                  </Tooltip>
                </>
              )}
            </div>

            {/* Selected zone properties */}
            {selectedZone && (
              <div className="dep-ed-section dep-ed-props">
                <label>Zone : {selectedZone.id}</label>
                <div className="dep-ed-field">
                  <span>Label</span>
                  <Input type="text" value={selectedZone.label}
                    onChange={e => handleZonePropertyChange('label', e.target.value)} />
                </div>
                <div className="dep-ed-field">
                  <span>Catégorie</span>
                  <Select value={selectedZone.category}
                    onChange={e => handleZoneCategoryChange(e.target.value)}>
                    {zonesData.categories?.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="dep-ed-field dep-ed-color-field">
                  <span>Couleur</span>
                  <input type="color" value={selectedZone.color}
                    onChange={e => { pushHistory(); handleZonePropertyChange('color', e.target.value); }} />
                  <Input type="text" value={selectedZone.color} className="dep-ed-hex-input"
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
                      <Button variant="ghost" key={c} className={`dep-ed-swatch${c === selectedZone.color?.toLowerCase() ? ' active' : ''}`}
                        style={{ background: c }} title={c}
                        onClick={() => { pushHistory(); handleZonePropertyChange('color', c); }} />
                    ))}
                  </div>
                )}
                <div className="dep-ed-coords">
                  <div className="dep-ed-field">
                    <span>X</span>
                    <Input type="number" value={selectedZone.bbox.x} step={SNAP_GRID}
                      onChange={e => { pushHistory(); updateZoneBbox(selectedZone.id, { x: parseInt(e.target.value) || 0 }); }} />
                  </div>
                  <div className="dep-ed-field">
                    <span>Y</span>
                    <Input type="number" value={selectedZone.bbox.y} step={SNAP_GRID}
                      onChange={e => { pushHistory(); updateZoneBbox(selectedZone.id, { y: parseInt(e.target.value) || 0 }); }} />
                  </div>
                  <div className="dep-ed-field">
                    <span>L</span>
                    <Input type="number" value={selectedZone.bbox.width} step={SNAP_GRID} min={MIN_ZONE_SIZE}
                      onChange={e => { pushHistory(); updateZoneBbox(selectedZone.id, { width: parseInt(e.target.value) || MIN_ZONE_SIZE }); }} />
                  </div>
                  <div className="dep-ed-field">
                    <span>H</span>
                    <Input type="number" value={selectedZone.bbox.height} step={SNAP_GRID} min={MIN_ZONE_SIZE}
                      onChange={e => { pushHistory(); updateZoneBbox(selectedZone.id, { height: parseInt(e.target.value) || MIN_ZONE_SIZE }); }} />
                  </div>
                </div>

                {/* Forme */}
                <div className="dep-ed-field">
                  <span>Forme</span>
                  {selectedZone.clipPoints ? (
                    <div className="dep-ed-clip-info">
                      <span className="dep-ed-clip-badge">Polygone ({selectedZone.clipPoints.length} pts)</span>
                      <Button variant="ghost" className="dep-ed-btn-sm" onClick={() => {
                        pushHistory();
                        setZonesData(prev => ({
                          ...prev,
                          zones: prev.zones.map(z => z.id === selectedZoneId
                            ? { ...z, clipPoints: undefined, shape: 'rect' }
                            : z),
                        }));
                        setDirty(true);
                      }}>
                        <RotateCcw size={12} /> Réinitialiser rect
                      </Button>
                    </div>
                  ) : (
                    <Select value={selectedZone.shape || 'rect'}
                      onChange={e => {
                        pushHistory();
                        const newShape = e.target.value;
                        handleZonePropertyChange('shape', newShape);
                        if (newShape === 'trapezoid' && !selectedZone.skew) {
                          handleZonePropertyChange('skew', { tl: {x:0,y:0}, tr: {x:0,y:0}, bl: {x:0,y:0}, br: {x:0,y:0} });
                        }
                      }}>
                      <option value="rect">Rectangle</option>
                      <option value="trapezoid">Trapèze</option>
                    </Select>
                  )}
                </div>

                {/* Contrôles trapèze */}
                {(selectedZone.shape === 'trapezoid') && (() => {
                  const sk = selectedZone.skew || {};
                  const corners = [
                    { key: 'tl', label: '↖ HG' },
                    { key: 'tr', label: '↗ HD' },
                    { key: 'bl', label: '↙ BG' },
                    { key: 'br', label: '↘ BD' },
                  ];
                  return (
                    <div className="dep-ed-skew-controls">
                      <label>Décalage coins (px)</label>
                      <div className="dep-ed-skew-grid">
                        {corners.map(c => {
                          const sv = skewVal(sk[c.key]);
                          return (
                            <div className="dep-ed-field dep-ed-skew-corner" key={c.key}>
                              <span>{c.label}</span>
                              <div className="dep-ed-skew-xy">
                                <label>X</label>
                                <Input type="number" value={sv.x} step={5}
                                  onChange={e => { pushHistory(); updateZoneSkew(selectedZone.id, c.key, { x: parseInt(e.target.value) || 0, y: sv.y }); }} />
                                <label>Y</label>
                                <Input type="number" value={sv.y} step={5}
                                  onChange={e => { pushHistory(); updateZoneSkew(selectedZone.id, c.key, { x: sv.x, y: parseInt(e.target.value) || 0 }); }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <Button variant="ghost" className="dep-ed-btn-sm" onClick={() => {
                        pushHistory();
                        handleZonePropertyChange('skew', { tl: {x:0,y:0}, tr: {x:0,y:0}, bl: {x:0,y:0}, br: {x:0,y:0} });
                      }}>Réinitialiser</Button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Zone list */}
            <div className="dep-ed-section dep-ed-zone-list">
              <label>{floorZones.length} zones — {activeFloor}</label>
              {floorZones.map(zone => (
                <Button variant="ghost" key={zone.id}
                  className={`dep-ed-zone-item ${selectedZoneId === zone.id ? 'active' : ''}`}
                  onClick={() => setSelectedZoneId(zone.id)}>
                  <span className="dep-ed-zone-dot" style={{ background: zone.color }} />
                  <span className="dep-ed-zone-name">{zone.id}</span>
                  <span className="dep-ed-zone-dim">{zone.bbox.width}×{zone.bbox.height}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Main canvas */}
          <div className="depot-editor-canvas"
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            style={{ cursor: isPanning ? 'grabbing' : spaceHeld ? 'grab' : undefined }}
          >
            {/* Zoom controls floating */}
            <div className="dep-ed-zoom-controls">
              <Tooltip content="Dézoomer"><Button variant="ghost" onClick={handleEditorZoomOut} className="dep-ed-btn-sm" aria-label="Dézoomer"><ZoomOut size={14} /></Button></Tooltip>
              <span className="dep-ed-zoom-level">{Math.round(editorZoom * 100)}%</span>
              <Tooltip content="Zoomer"><Button variant="ghost" onClick={handleEditorZoomIn} className="dep-ed-btn-sm" aria-label="Zoomer"><ZoomIn size={14} /></Button></Tooltip>
              <Tooltip content="100%"><Button variant="ghost" onClick={handleEditorZoomReset} className="dep-ed-btn-sm">1:1</Button></Tooltip>
              <Tooltip content="Ajuster"><Button variant="ghost" onClick={handleEditorZoomFit} className="dep-ed-btn-sm" aria-label="Ajuster à l'écran"><Maximize2 size={14} /></Button></Tooltip>
            </div>

            {/* Subtract mode banner */}
            {subtractMode === 'pick-target' && (
              <div className="dep-ed-subtract-banner">
                <Scissors size={16} />
                <span>Cliquez sur la zone à soustraire de <strong>{subtractSourceId}</strong></span>
                <Button variant="ghost" className="dep-ed-btn-sm" onClick={cancelSubtract}>Annuler</Button>
              </div>
            )}

            {/* Subtract choice dialog */}
            {subtractMode === 'choose' && (
              <div className="dep-ed-subtract-dialog">
                <div className="dep-ed-subtract-dialog-inner">
                  <h4>Soustraction booléenne</h4>
                  <p>Garder le chevauchement dans :</p>
                  <div className="dep-ed-subtract-choices">
                    <Button variant="primary" onClick={() => executeSubtract('source')}>
                      {subtractSourceId}
                    </Button>
                    <span>ou</span>
                    <Button variant="primary" onClick={() => executeSubtract('target')}>
                      {subtractTargetId}
                    </Button>
                  </div>
                  <Button variant="ghost" className="dep-ed-btn-sm" onClick={cancelSubtract} style={{ marginTop: 8 }}>Annuler</Button>
                </div>
              </div>
            )}
            <div className="depot-editor-svg-container"
              style={{
                transform: `scale(${editorZoom}) translate(${editorPan.x / editorZoom}px, ${editorPan.y / editorZoom}px)`,
                transformOrigin: 'center center',
              }}
            >
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
                  const hasClip = zone.clipPoints && zone.clipPoints.length >= 3;
                  const isTrapezoid = !hasClip && zone.shape === 'trapezoid' && hasSkew(zone);
                  const isSubtractHighlight = subtractMode === 'pick-target' && zone.id !== subtractSourceId;
                  const shapeProps = {
                    fill: zone.color,
                    fillOpacity: isSelected ? 0.7 : 0.5,
                    stroke: isSubtractHighlight ? '#f59e0b' : isSelected ? '#ffffff' : zone.color,
                    strokeWidth: isSubtractHighlight ? 2.5 : isSelected ? 2 : 1,
                    strokeDasharray: isSubtractHighlight ? '6 3' : undefined,
                    style: { cursor: subtractMode === 'pick-target' && zone.id !== subtractSourceId ? 'crosshair' : 'move' },
                    onMouseDown: (e) => handleZoneMouseDown(e, zone),
                    onTouchStart: (e) => handleZoneMouseDown(e, zone),
                  };

                  return (
                    <g key={zone.id}>
                      {/* Zone shape (rect, trapèze ou polygone découpé) */}
                      {hasClip ? (
                        <polygon
                          points={pointsToSvg(zone.clipPoints)}
                          {...shapeProps}
                        />
                      ) : isTrapezoid ? (
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
              <span>Zoom: {Math.round(editorZoom * 100)}%</span>
              <span>|</span>
              <span>Vue: {Math.round(bounds.w)}×{Math.round(bounds.h)}</span>
              <span>|</span>
              <span>Zones: {floorZones.length}</span>
              {selectedZone && (
                <>
                  <span>|</span>
                  <span>{selectedZone.id}: ({selectedZone.bbox.x}, {selectedZone.bbox.y}) {selectedZone.bbox.width}×{selectedZone.bbox.height}</span>
                  {selectedZone.clipPoints && (
                    <span> polygone: {selectedZone.clipPoints.length} pts</span>
                  )}
                  {selectedZone.shape === 'trapezoid' && !selectedZone.clipPoints && (() => {
                    const s = selectedZone.skew || {};
                    const fmt = k => { const v = skewVal(s[k]); return `${v.x},${v.y}`; };
                    return <span> skew: ↖{fmt('tl')} ↗{fmt('tr')} ↙{fmt('bl')} ↘{fmt('br')}</span>;
                  })()}
                </>
              )}
              <span className="depot-editor-info-hints">
                Molette: zoom · Espace+drag / Clic milieu: déplacer la vue · Flèches: déplacer · ⌘Z: annuler · ⌘S: sauvegarder
              </span>
            </div>
          </div>
        </div>
      </div>
      {ConfirmDialogRenderer}
    </div>
  );
}
