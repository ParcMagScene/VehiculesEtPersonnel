// ═══════════════════════════════════════════════════════════════
// VideoPanel.jsx — Module principal de surveillance vidéo
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { useCameraList } from '../../hooks/useCameraList';
import { usePTZ } from '../../hooks/usePTZ';
import CameraGrid from './CameraGrid';
import CameraPTZControls from './CameraPTZControls';
import PlaybackPanel from './PlaybackPanel';
import PresetPanel from './PresetPanel';
import { Plus, Settings, RefreshCw, Video, List, Grid, Activity, Shield, LayoutGrid, Maximize2, RotateCw, ChevronLeft, ChevronRight, Film, Monitor } from 'lucide-react';
import api from '../../utils/api';
import './VideoPanel.css';
import { Button, Table, InlineAlert, Tooltip, Divider, LoadingOverlay } from '@/design-system';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

import { ROLES } from '../../constants';

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
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
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

  const isAdmin = currentUser?.role === ROLES.ADMIN;
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

  const handleDeleteCamera = useCallback((id) => {
    confirm({
      title: 'Supprimer',
      message: 'Supprimer cette caméra ?',
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        await deleteCamera(id);
        setEditingCamera(null);
        setShowSettings(false);
      },
    });
  }, [deleteCamera]);

  const handleTestAll = useCallback(async () => {
    setTestingAll(true);
    try { await testAll(); } finally { setTestingAll(false); }
  }, [testAll]);

  const handleDetachPreset = useCallback((presetId) => {
    const url = `${window.location.origin}?detached-preset=${presetId}`;
    window.open(url, `preset-${presetId}`, 'width=960,height=720,menubar=no,toolbar=no,location=no,status=no');
  }, []);

  if (loading) {
    return (
      <div className="video-panel">
        <LoadingOverlay label="Chargement du module vidéo..." />
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
            <Button variant="ghost" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Vue grille" aria-label="Vue grille">
              <Grid size={18} />
            </Button>
            <Button variant="ghost" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="Vue liste" aria-label="Vue liste">
              <List size={18} />
            </Button>
            <Button variant="ghost" className={viewMode === 'playback' ? 'active' : ''} onClick={() => setViewMode('playback')} title="Enregistrements" aria-label="Enregistrements">
              <Film size={18} />
            </Button>
            <Button variant="ghost" className={viewMode === 'preset' ? 'active' : ''} onClick={() => setViewMode('preset')} title="Presets multi-caméras" aria-label="Presets multi-caméras">
              <Monitor size={18} />
            </Button>
            {isAdmin && (
              <Button variant="ghost" className={viewMode === ROLES.ADMIN ? 'active' : ''} onClick={() => setViewMode('admin')} title="Administration" aria-label="Administration">
                <Settings size={18} />
              </Button>
            )}
          </div>

          {/* Layout grille (visible en mode grille) */}
          {viewMode === 'grid' && enabledCameras.length > 0 && (
            <>
              <Divider orientation="vertical" />
              <div className="video-panel__layout-btns">
                {GRID_LAYOUTS.map(l => (
                  <Button variant="ghost"                     key={l.id}
                    className={`video-panel__layout-btn ${gridSize === l.id ? 'active' : ''}`}
                    onClick={() => { setGridSize(l.id); setGridPage(0); }}
                    title={`Grille ${l.label} caméras`}
                  >
                    {l.label === '1' ? <Maximize2 size={14} /> : <LayoutGrid size={14} />}
                    <span>{l.label}</span>
                  </Button>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="video-panel__page-controls">
                  <Tooltip content="Page précédente"><Button variant="ghost" onClick={() => setGridPage(p => Math.max(0, p - 1))} disabled={gridPage === 0}>
                    <ChevronLeft size={16} />
                  </Button></Tooltip>
                  <span className="video-panel__page-info">{gridPage + 1}/{totalPages}</span>
                  <Tooltip content="Page suivante"><Button variant="ghost" onClick={() => setGridPage(p => Math.min(totalPages - 1, p + 1))} disabled={gridPage >= totalPages - 1}>
                    <ChevronRight size={16} />
                  </Button></Tooltip>
                </div>
              )}

              {/* Rotation auto */}
              {totalPages > 1 && (
                <Tooltip content={isRotating ? 'Arrêter la rotation' : 'Rotation automatique'}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className={isRotating ? 'active' : ''}
                    onClick={() => setIsRotating(v => !v)}
                  >
                    <RotateCw size={16} />
                  </Button>
                </Tooltip>
              )}
            </>
          )}

          <Divider orientation="vertical" />

          <Tooltip content="Rafraîchir">
            <Button variant="secondary" size="sm" onClick={refresh}>
              <RefreshCw size={16} />
            </Button>
          </Tooltip>
          {isAdmin && (
            <Button variant="primary" size="sm" onClick={() => { setEditingCamera({}); setShowSettings(true); }}>
              <Plus size={16} /> Ajouter
            </Button>
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

      {error && <InlineAlert>{error}</InlineAlert>}

      {/* Contenu principal */}
      {viewMode === 'grid' && (
        <div className="video-panel__content">
          {enabledCameras.length === 0 ? (
            <div className="video-panel__empty">
              <Video size={48} style={{ opacity: 0.3 }} />
              <p>Aucune caméra configurée</p>
              {isAdmin && <Button variant="primary" onClick={() => { setEditingCamera({}); setShowSettings(true); }}>Ajouter une caméra</Button>}
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

      {viewMode === 'preset' && (
        <div className="video-panel__content">
          <PresetPanel
            cameras={cameras}
            proxyAvailable={proxyAvailable}
            onDetach={handleDetachPreset}
          />
        </div>
      )}

      {viewMode === 'list' && (
        <div className="video-panel__list">
          <Table className="video-panel__table">
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
                      <Button variant="ghost" size="xs" iconOnly onClick={() => { setEditingCamera(cam); setShowSettings(true); }} title="Configurer la caméra">
                        <Settings size={14} />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {viewMode === ROLES.ADMIN && isAdmin && (
        <div className="video-panel__admin">
          <div className="video-panel__admin-section">
            <h3><Shield size={18} /> Administration des caméras</h3>
            <div className="video-panel__admin-actions">
              <Button variant="secondary" onClick={handleTestAll} disabled={testingAll}>
                <Activity size={16} /> {testingAll ? 'Test en cours...' : 'Tester toutes les caméras'}
              </Button>
              <Button variant="primary" onClick={() => { setEditingCamera({}); setShowSettings(true); }}>
                <Plus size={16} /> Ajouter une caméra
              </Button>
            </div>
          </div>
          <Table className="video-panel__table">
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
                    <Tooltip content="Modifier">
                      <Button variant="ghost" size="xs" iconOnly onClick={() => { setEditingCamera(cam); setShowSettings(true); }}>
                        <Settings size={14} />
                      </Button>
                    </Tooltip>
                  </td>
                </tr>
              ))}
              {cameras.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: 'center', opacity: 0.5 }}>Aucune caméra</td></tr>
              )}
            </tbody>
          </Table>
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
      {ConfirmDialogRenderer}
    </div>
  );
};

export default VideoPanel;
