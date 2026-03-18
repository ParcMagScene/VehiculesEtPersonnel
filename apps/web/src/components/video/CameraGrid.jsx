// ═══════════════════════════════════════════════════════════════
// CameraGrid.jsx — Grille multi-caméras (1/4/9/16)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import CameraPlayerWebRTC from './CameraPlayerWebRTC';
import { Grid, LayoutGrid, Maximize2, RotateCw } from 'lucide-react';

const GRID_LAYOUTS = [
  { id: 1, label: '1', cols: 1 },
  { id: 4, label: '4', cols: 2 },
  { id: 9, label: '9', cols: 3 },
  { id: 16, label: '16', cols: 4 },
];

const CameraGrid = ({ cameras = [], autoRotate = false, rotateInterval = 15 }) => {
  const [gridSize, setGridSize] = useState(4);
  const [page, setPage] = useState(0);
  const [fullscreenCamera, setFullscreenCamera] = useState(null);
  const [isRotating, setIsRotating] = useState(autoRotate);
  const rotateTimer = useRef(null);

  const layout = GRID_LAYOUTS.find(l => l.id === gridSize) || GRID_LAYOUTS[1];
  const enabledCameras = cameras.filter(c => c.enabled);
  const totalPages = Math.ceil(enabledCameras.length / gridSize);
  const visibleCameras = enabledCameras.slice(page * gridSize, (page + 1) * gridSize);

  // Rotation automatique
  useEffect(() => {
    if (isRotating && totalPages > 1) {
      rotateTimer.current = setInterval(() => {
        setPage(prev => (prev + 1) % totalPages);
      }, rotateInterval * 1000);
    }
    return () => clearInterval(rotateTimer.current);
  }, [isRotating, totalPages, rotateInterval]);

  const handleFullscreen = useCallback((camera) => {
    setFullscreenCamera(prev => prev?.id === camera.id ? null : camera);
  }, []);

  if (fullscreenCamera) {
    return (
      <div className="camera-grid camera-grid--fullscreen">
        <CameraPlayerWebRTC
          camera={fullscreenCamera}
          autoConnect
          onFullscreen={handleFullscreen}
          isFullscreen
        />
      </div>
    );
  }

  return (
    <div className="camera-grid">
      <div className="camera-grid__toolbar">
        <div className="camera-grid__layout-btns">
          {GRID_LAYOUTS.map(l => (
            <button
              key={l.id}
              className={`camera-grid__layout-btn ${gridSize === l.id ? 'active' : ''}`}
              onClick={() => { setGridSize(l.id); setPage(0); }}
              title={`Grille ${l.label} caméras`}
            >
              {l.label === '1' ? <Maximize2 size={16} /> : <LayoutGrid size={16} />}
              <span>{l.label}</span>
            </button>
          ))}
        </div>
        <div className="camera-grid__controls">
          {totalPages > 1 && (
            <>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="camera-grid__page-btn">◀</button>
              <span className="camera-grid__page-info">{page + 1}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="camera-grid__page-btn">▶</button>
            </>
          )}
          <button
            className={`camera-grid__rotate-btn ${isRotating ? 'active' : ''}`}
            onClick={() => setIsRotating(v => !v)}
            title={isRotating ? 'Arrêter la rotation' : 'Rotation auto'}
          >
            <RotateCw size={16} />
          </button>
        </div>
      </div>
      <div
        className="camera-grid__grid"
        style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)` }}
      >
        {visibleCameras.map(cam => (
          <CameraPlayerWebRTC
            key={cam.id}
            camera={cam}
            autoConnect
            onFullscreen={handleFullscreen}
          />
        ))}
        {/* Remplir les slots vides */}
        {Array.from({ length: Math.max(0, gridSize - visibleCameras.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="camera-player camera-player--empty">
            <div className="camera-player__viewport">
              <div className="camera-player__overlay">
                <span style={{ opacity: 0.4 }}>Aucune caméra</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CameraGrid;
