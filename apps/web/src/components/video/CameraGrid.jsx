// ═══════════════════════════════════════════════════════════════
// CameraGrid.jsx — Grille multi-caméras (1/4/9/16)
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import CameraPlayerWebRTC from './CameraPlayerWebRTC';

const GRID_LAYOUTS = [
  { id: 1, cols: 1 },
  { id: 4, cols: 2 },
  { id: 9, cols: 3 },
  { id: 16, cols: 4 },
];

const CameraGrid = ({
  cameras = [],
  proxyAvailable = false,
  gridSize = 4,
  page = 0,
  onSelectCamera,
  selectedCameraId,
  onPlayback,
}) => {
  const [fullscreenCamera, setFullscreenCamera] = useState(null);

  const layout = GRID_LAYOUTS.find((l) => l.id === gridSize) || GRID_LAYOUTS[1];
  const enabledCameras = cameras.filter((c) => c.enabled);
  const visibleCameras = enabledCameras.slice(page * gridSize, (page + 1) * gridSize);

  const handleFullscreen = useCallback((camera) => {
    setFullscreenCamera((prev) => (prev?.id === camera.id ? null : camera));
  }, []);

  if (fullscreenCamera) {
    return (
      <div className="camera-grid camera-grid--fullscreen">
        <CameraPlayerWebRTC
          camera={fullscreenCamera}
          autoConnect={proxyAvailable}
          onFullscreen={handleFullscreen}
          isFullscreen
          onPlayback={onPlayback}
        />
      </div>
    );
  }

  return (
    <div className="camera-grid">
      <div
        className="camera-grid__grid"
        style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)` }}
      >
        {visibleCameras.map((cam, idx) => (
          <CameraPlayerWebRTC
            key={cam.id}
            camera={cam}
            autoConnect={proxyAvailable}
            connectDelay={idx * 500}
            onFullscreen={handleFullscreen}
            onSelect={onSelectCamera}
            isSelected={selectedCameraId === cam.id}
            onPlayback={onPlayback}
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
