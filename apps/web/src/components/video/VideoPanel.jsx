// ═══════════════════════════════════════════════════════════════
// VideoPanel.jsx — Module principal de surveillance vidéo
// ═══════════════════════════════════════════════════════════════

import React, { useState, useCallback, Suspense, lazy } from 'react';
import { useCameraList } from '../../hooks/useCameraList';
import CameraGrid from './CameraGrid';
import CameraPTZControls from './CameraPTZControls';
import { Plus, Settings, RefreshCw, Video, List, Grid, Activity, Shield } from 'lucide-react';
import './VideoPanel.css';

const CameraSettingsModal = lazy(() => import('./CameraSettingsModal'));

const VideoPanel = ({ currentUser }) => {
  const { cameras, loading, error, refresh, createCamera, updateCamera, deleteCamera, testCamera, testAll } = useCameraList();
  const [viewMode, setViewMode] = useState('grid'); // grid | list | admin
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [testingAll, setTestingAll] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const enabledCameras = cameras.filter(c => c.enabled);

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
      {/* Toolbar */}
      <div className="video-panel__toolbar">
        <div className="video-panel__title">
          <Video size={20} />
          <h2>Surveillance Vidéo</h2>
          <span className="video-panel__count">{enabledCameras.length} caméra{enabledCameras.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="video-panel__actions">
          <div className="video-panel__view-toggle">
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Vue grille">
              <Grid size={18} />
            </button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="Vue liste">
              <List size={18} />
            </button>
            {isAdmin && (
              <button className={viewMode === 'admin' ? 'active' : ''} onClick={() => setViewMode('admin')} title="Administration">
                <Settings size={18} />
              </button>
            )}
          </div>
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
              <CameraGrid cameras={cameras} />
              {selectedCamera?.ptzSupported && (
                <div className="video-panel__ptz-sidebar">
                  <CameraPTZControls camera={selectedCamera} />
                </div>
              )}
            </>
          )}
        </div>
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
