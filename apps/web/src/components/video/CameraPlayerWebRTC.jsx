// ═══════════════════════════════════════════════════════════════
// CameraPlayerWebRTC.jsx — Lecteur vidéo WebRTC pour une caméra
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { useWebRTCStream } from '../../hooks/useWebRTCStream';
import { Maximize, Minimize, Camera, RefreshCw, WifiOff, Film } from 'lucide-react';
import api from '../../utils/api';
import { Button, Spinner, Tooltip } from '@/design-system';

const CameraPlayerWebRTC = ({ camera, autoConnect = true, connectDelay = 0, onFullscreen, isFullscreen = false, onSelect, isSelected = false, onPlayback }) => {
  const { videoRef, status, error, connect, disconnect } = useWebRTCStream(camera);
  const [_snapshotUrl, setSnapshotUrl] = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  useEffect(() => {
    if (autoConnect && camera?.enabled) {
      if (connectDelay > 0) {
        const timer = setTimeout(() => connect(), connectDelay);
        return () => { clearTimeout(timer); disconnect(); };
      }
      connect();
    }
    return () => { disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera?.id, autoConnect]);

  const handleSnapshot = useCallback(async () => {
    if (!camera?.id) return;
    try {
      setSnapshotLoading(true);
      const url = await api.getSnapshot(camera.id);
      setSnapshotUrl(url);
      // Ouvrir dans un nouvel onglet
      window.open(url, '_blank');
    } catch {
      // Fallback: essayer de capturer le canvas vidéo
      if (videoRef.current && videoRef.current.videoWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        canvas.toBlob(blob => {
          if (blob && blob.size > 0) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `snapshot_${camera.name}_${new Date().toISOString().slice(0, 19)}.jpg`;
            a.click();
            URL.revokeObjectURL(url);
          }
        }, 'image/jpeg');
      }
    } finally {
      setSnapshotLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera?.id, camera?.name]);

  const statusLabel = {
    idle: 'En attente',
    connecting: 'Connexion...',
    streaming: 'En direct',
    error: error || 'Erreur',
  }[status];

  const statusColor = {
    idle: '#888',
    connecting: '#f59e0b',
    streaming: '#22c55e',
    error: '#ef4444',
  }[status];

  return (
    <div
      className={`camera-player ${isFullscreen ? 'camera-player--fullscreen' : ''} ${isSelected ? 'camera-player--selected' : ''}`}
      onClick={() => onSelect?.(camera)}
    >
      <div className="camera-player__header">
        <div className="camera-player__status">
          <span className="camera-player__dot" style={{ backgroundColor: statusColor }} />
          <span className="camera-player__name">{camera?.name || 'Caméra'}</span>
          <span className="camera-player__status-text">{statusLabel}</span>
        </div>
        <div className="camera-player__actions">
          {camera?.supportsPlayback && onPlayback && (
            <Tooltip content="Enregistrements"><Button variant="ghost" onClick={(e) => { e.stopPropagation(); onPlayback(camera); }} className="camera-player__btn">
              <Film size={16} />
            </Button></Tooltip>
          )}
          <Tooltip content="Snapshot"><Button variant="ghost" onClick={handleSnapshot} disabled={status !== 'streaming' || snapshotLoading} className="camera-player__btn">
            <Camera size={16} />
          </Button></Tooltip>
          {status === 'error' || status === 'idle' ? (
            <Tooltip content="Reconnecter"><Button variant="ghost" onClick={connect} className="camera-player__btn">
              <RefreshCw size={16} />
            </Button></Tooltip>
          ) : null}
          {onFullscreen && (
            <Tooltip content={isFullscreen ? 'Réduire' : 'Plein écran'}><Button variant="ghost" onClick={() => onFullscreen(camera)} className="camera-player__btn">
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </Button></Tooltip>
          )}
        </div>
      </div>
      <div className="camera-player__viewport">
        {status === 'connecting' && (
          <div className="camera-player__overlay">
            <Spinner size="lg" />
            <span>Connexion au flux...</span>
          </div>
        )}
        {status === 'error' && (
          <div className="camera-player__overlay camera-player__overlay--error">
            <WifiOff size={32} />
            <span>{error || 'Flux indisponible'}</span>
            <Button variant="ghost" onClick={connect} className="camera-player__retry-btn">Réessayer</Button>
          </div>
        )}
        {status === 'idle' && !autoConnect && (
          <div className="camera-player__overlay">
            <WifiOff size={24} style={{ opacity: 0.4 }} />
            <span style={{ opacity: 0.6, fontSize: '0.85em' }}>Proxy vidéo hors-ligne</span>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-player__video"
        />
      </div>
    </div>
  );
};

export default CameraPlayerWebRTC;
