// ═══════════════════════════════════════════════════════════════
// PresetDetachedView.jsx — Vue preset détachée (fenêtre indépendante)
// ═══════════════════════════════════════════════════════════════

import './VideoPanel.css';

import { useEffect, useState } from 'react';

import api from '../../utils/api';
import CameraPlayerWebRTC from './CameraPlayerWebRTC';

const PresetDetachedView = ({ presetId }) => {
  const [preset, setPreset] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [proxyAvailable, setProxyAvailable] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setError(null);
      try {
        const [allPresets, allCameras, proxyStatus] = await Promise.all([
          api.getVideoPresets(),
          api.getVideoCameras(),
          api.getVideoProxyStatus().catch(() => ({ running: false })),
        ]);
        if (cancelled) return;

        const found = allPresets.find((p) => p.id === Number(presetId));
        if (!found) {
          setPreset(null);
          setError('Preset introuvable');
          return;
        }

        setPreset(found);
        setCameras(allCameras);
        setProxyAvailable(proxyStatus?.running === true);
        document.title = `Preset — ${found.name}`;
      } catch (err) {
        if (cancelled) return;
        setPreset(null);
        setError(err.message || 'Erreur de chargement');
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [presetId]);

  if (error) {
    return (
      <div className="preset-detached">
        <div className="preset-detached__error">{error}</div>
      </div>
    );
  }

  if (!preset) {
    return (
      <div className="preset-detached">
        <div className="preset-detached__loading">Chargement du preset...</div>
      </div>
    );
  }

  const presetCameras = preset.cameraIds
    .map((id) => cameras.find((c) => c.id === id))
    .filter(Boolean);
  const cols = presetCameras.length <= 1 ? 1 : 2;

  return (
    <div className="preset-detached">
      <div className="preset-detached__header">
        <span className="preset-detached__title">{preset.name}</span>
        <span className="preset-detached__count">
          {presetCameras.length} caméra{presetCameras.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div
        className="preset-detached__grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {presetCameras.map((cam, idx) => (
          <CameraPlayerWebRTC
            key={cam.id}
            camera={cam}
            autoConnect={proxyAvailable}
            connectDelay={idx * 500}
          />
        ))}
      </div>
    </div>
  );
};

export default PresetDetachedView;
