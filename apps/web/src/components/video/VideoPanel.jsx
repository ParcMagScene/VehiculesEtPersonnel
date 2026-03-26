// ═══════════════════════════════════════════════════════════════
// VideoPanel.jsx — Module principal de surveillance vidéo
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { useCameraList } from '../../hooks/useCameraList';
import { usePTZ } from '../../hooks/usePTZ';
import CameraGrid from './CameraGrid';
import CameraPTZControls from './CameraPTZControls';
import PlaybackPanel from './PlaybackPanel';
import { Plus, Settings, RefreshCw, Video, List, Grid, Activity, Shield, LayoutGrid, Maximize2, RotateCw, ChevronLeft, ChevronRight, Film } from 'lucide-react';
import api from '../../utils/api';
import './VideoPanel.css';

const GRID_LAYOUTS = [
  { id: 1, label: '1', cols: 1 },
  { id: 4, label: '4', cols: 2 },
  { id: 9, label: '9', cols: 3 },
  { id: 16, label: '16', cols: 4 },
];

const CameraSettingsModal = lazy(() => import('./CameraSettingsModal'));

const VideoPanel = ({ currentUser }) => {
  const { cameras, loading, error, refresh, createCamera, updateCamera, deleteCamera, testCamera, testAll } = useCameraList();
  const [viewMode, setViewMode] = useState('grid'); // grid | list | admin
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [testingAll, setTestingAll] = useState(false);
  const [proxyAvailable, setProxyAvailable] = useState(false);
  const [playbackCameraId, setPlaybackCameraId] = useState(null);

  // État grille (remonté de CameraGrid)
  const [gridSize, setGridSize] = useState(4);
  const [gridPage, setGridPage] = useState(0);
  const [isRotating, setIsRotating] = useState(false);
  const rotateTimer = useRef(null);

  // PTZ clavier
  const { startMove, stopMove, moving } = usePTZ(selectedCamera);
  const activeKeys = useRef(new Set());

  // Vérifier si MediaMTX est disponible au chargement
  useEffect(() => {
    api.getVideoProxyStatus()
      .then(status => setProxyAvailable(status?.running === true))
      .catch(() => setProxyAvailable(false));
  }, []);

  const isAdmin = currentUser?.role === 'admin';
  const enabledCameras = cameras.filter(c => c.enabled);
  const totalPages = Math.ceil(enabledCameras.length / gridSize);

  // Reset page si hors limites
  useEffect(() => {
    if (gridPage >= totalPages && totalPages > 0) setGridPage(totalPages - 1);
  }, [gridPage, totalPages]);

  // Rotation automatique des pages
  useEffect(() => {
    if (isRotating && totalPages > 1) {
      rotateTimer.current = setInterval(() => {
        setGridPage(prev => (prev + 1) % totalPages);
      }, 15000);
    }
    return () => clearInterval(rotateTimer.current);
  }, [isRotating, totalPages]);

  // Contrôle PTZ au clavier
  useEffect(() => {
    if (!selectedCamera?.ptzSupported) return;
    const KEY_MAP = {
      ArrowUp: 'up', ArrowDown: 'down',
      ArrowLeft: 'left', ArrowRight: 'right',
      '+': 'zoomin', '=': 'zoomin',
      '-': 'zoomout',
    };
    const onKeyDown = (e) => {
      const cmd = KEY_MAP[e.key];
      if (!cmd || activeKeys.current.has(e.key)) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      e.preventDefault();
      activeKeys.current.add(e.key);
      startMove(cmd);
    };
    const onKeyUp = (e) => {
      const cmd = KEY_MAP[e.key];
      if (!cmd) return;
      activeKeys.current.delete(e.key);
      if (activeKeys.current.size === 0) stopMove();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      activeKeys.current.clear();
    };
  }, [selectedCamera, startMove, stopMove]);

  const handleSelectCamera = useCallback((cam) => {
    setSelectedCamera(prev => prev?.id === cam.id ? null : cam);
  }, []);

  const handlePlayback = useCallback((cam) => {
    setPlaybackCameraId(String(cam.id));
    setViewMode('playback');
  }, []);

  const handleSaveCamera = useCallback(async (formData) => {
    if (editingCamera?.id) {
      await updateCamera(editingCamera.id, formData);
    } else {
      await createCamera(formData);
    }
    setEditingCamera(null);
    setShowSettings(false);
  }, [editingCamera, updateCamera, createCamera]);

  const handleDeleteCamera = useCallback(async (id) => {
    if (!confirm('Supprimer cette caméra ?')) return;
    await deleteCamera(id);
    setEditingCamera(null);
    setShowSettings(false);
  }, [deleteCamera]);

  const handleTestAll = useCallback(async () => {
    setTestingAll(true);
    try { await testAll(); } finally { setTestingAll(false); }
  }, [testAll]);

  if (loading) {
    return (
      <div className="video-panel">
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>Chargement du module vidéo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-panel">
      {/* Toolbar unifiée */}
      <div className="video-panel__toolbar">
        <div className="video-panel__title">
          <Video size={20} />
          <h2>Surveillance Vidéo</h2>
          <span className="video-panel__count">{enabledCameras.length} caméra{enabledCameras.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="video-panel__actions">
          {/* Vues */}
          <div className="video-panel__view-toggle">
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Vue grille">
              <Grid size={18} />
            </button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="Vue liste">
              <List size={18} />
            </button>
            <button className={viewMode === 'playback' ? 'active' : ''} onClick={() => setViewMode('playback')} title="Enregistrements">
              <Film size={18} />
            </button>
            {isAdmin && (
              <button className={viewMode === 'admin' ? 'active' : ''} onClick={() => setViewMode('admin')} title="Administration">
                <Settings size={18} />
              </button>
            )}
          </div>

          {/* Layout grille (visible en mode grille) */}
          {viewMode === 'grid' && enabledCameras.length > 0 && (
            <>
              <div className="video-panel__separator" />
              <div className="video-panel__layout-btns">
                {GRID_LAYOUTS.map(l => (
                  <button
                    key={l.id}
                    className={`video-panel__layout-btn ${gridSize === l.id ? 'active' : ''}`}
                    onClick={() => { setGridSize(l.id); setGridPage(0); }}
                    title={`Grille ${l.label} caméras`}
                  >
                    {l.label === '1' ? <Maximize2 size={14} /> : <LayoutGrid size={14} />}
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="video-panel__page-controls">
                  <button onClick={() => setGridPage(p => Math.max(0, p - 1))} disabled={gridPage === 0} title="Page précédente">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="video-panel__page-info">{gridPage + 1}/{totalPages}</span>
                  <button onClick={() => setGridPage(p => Math.min(totalPages - 1, p + 1))} disabled={gridPage >= totalPages - 1} title="Page suivante">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* Rotation auto */}
              {totalPages > 1 && (
                <button
                  className={`btn btn-secondary btn-sm ${isRotating ? 'active' : ''}`}
                  onClick={() => setIsRotating(v => !v)}
                  title={isRotating ? 'Arrêter la rotation' : 'Rotation automatique'}
                >
                  <RotateCw size={16} />
                </button>
              )}
            </>
          )}

          <div className="video-panel__separator" />

          <button className="btn btn-secondary btn-sm" onClick={refresh} title="Rafraîchir">
            <RefreshCw size={16} />
          </button>
          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => { setEditingCamera({}); setShowSettings(true); }}>
              <Plus size={16} /> Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Indicateur PTZ clavier */}
      {selectedCamera?.ptzSupported && (
        <div className="video-panel__ptz-indicator">
          🎮 PTZ clavier actif — <strong>{selectedCamera.name}</strong>
          {moving && <span className="video-panel__ptz-moving">● En mouvement</span>}
        </div>
      )}

      {error && <div className="video-panel__error">⚠ {error}</div>}

      {/* Contenu principal */}
      {viewMode === 'grid' && (
        <div className="video-panel__content">
          {enabledCameras.length === 0 ? (
            <div className="video-panel__empty">
              <Video size={48} style={{ opacity: 0.3 }} />
              <p>Aucune caméra configurée</p>
              {isAdmin && <button className="btn btn-primary" onClick={() => { setEditingCamera({}); setShowSettings(true); }}>Ajouter une caméra</button>}
            </div>
          ) : (
            <>
              <CameraGrid
                cameras={cameras}
                proxyAvailable={proxyAvailable}
                gridSize={gridSize}
                page={gridPage}
                onSelectCamera={handleSelectCamera}
                selectedCameraId={selectedCamera?.id}
                onPlayback={handlePlayback}
              />
              {selectedCamera?.ptzSupported && (
                <div className="video-panel__ptz-sidebar">
                  <CameraPTZControls camera={selectedCamera} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {viewMode === 'playback' && (
        <PlaybackPanel cameras={cameras} initialCameraId={playbackCameraId} />
      )}

      {viewMode === 'list' && (
        <div className="video-panel__list">
          <table className="video-panel__table">
            <thead>
              <tr>
                <th>Statut</th>
                <th>Nom</th>
                <th>Marque</th>
                <th>IP</th>
                <th>Emplacement</th>
                <th>PTZ</th>
                <th>Dernière vue</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {cameras.map(cam => (
                <tr key={cam.id} className={cam.enabled ? '' : 'disabled-row'}>
                  <td>
                    <span className={`status-dot status-dot--${cam.status || 'offline'}`} />
                  </td>
                  <td>{cam.name}</td>
                  <td>{cam.brand}</td>
                  <td><code>{cam.ip}</code></td>
                  <td>{cam.location || '—'}</td>
                  <td>{cam.ptzSupported ? '✓' : '—'}</td>
                  <td>{cam.lastSeen ? new Date(cam.lastSeen).toLocaleString('fr-FR') : '—'}</td>
                  {isAdmin && (
                    <td>
                      <button className="btn btn-ghost btn-xs" onClick={() => { setEditingCamera(cam); setShowSettings(true); }}>
                        <Settings size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'admin' && isAdmin && (
        <div className="video-panel__admin">
          <div className="video-panel__admin-section">
            <h3><Shield size={18} /> Administration des caméras</h3>
            <div className="video-panel__admin-actions">
              <button className="btn btn-secondary" onClick={handleTestAll} disabled={testingAll}>
                <Activity size={16} /> {testingAll ? 'Test en cours...' : 'Tester toutes les caméras'}
              </button>
              <button className="btn btn-primary" onClick={() => { setEditingCamera({}); setShowSettings(true); }}>
                <Plus size={16} /> Ajouter une caméra
              </button>
            </div>
          </div>
          <table className="video-panel__table">
            <thead>
              <tr>
                <th>Statut</th>
                <th>Nom</th>
                <th>Marque / Modèle</th>
                <th>IP</th>
                <th>Port RTSP</th>
                <th>Emplacement</th>
                <th>Zone</th>
                <th>PTZ</th>
                <th>Flux</th>
                <th>Activée</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cameras.map(cam => (
                <tr key={cam.id}>
                  <td><span className={`status-dot status-dot--${cam.status || 'offline'}`} /></td>
                  <td>{cam.name}</td>
                  <td>{cam.brand}{cam.model ? ` / ${cam.model}` : ''}</td>
                  <td><code>{cam.ip}</code></td>
                  <td>{cam.rtspPort || 554}</td>
                  <td>{cam.location || '—'}</td>
                  <td>{cam.zone || '—'}</td>
                  <td>{cam.ptzSupported ? '✓' : '—'}</td>
                  <td>{cam.streamProfile || 'main'}</td>
                  <td>{cam.enabled ? '✅' : '❌'}</td>
                  <td>
                    <button className="btn btn-ghost btn-xs" onClick={() => { setEditingCamera(cam); setShowSettings(true); }} title="Modifier">
                      <Settings size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {cameras.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: 'center', opacity: 0.5 }}>Aucune caméra</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal paramètres */}
      {showSettings && (
        <Suspense fallback={null}>
          <CameraSettingsModal
            camera={editingCamera}
            onSave={handleSaveCamera}
            onDelete={isAdmin ? handleDeleteCamera : null}
            onTest={isAdmin ? testCamera : null}
            onClose={() => { setShowSettings(false); setEditingCamera(null); }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default VideoPanel;
