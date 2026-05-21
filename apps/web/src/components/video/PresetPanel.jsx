// ═══════════════════════════════════════════════════════════════
// PresetPanel.jsx — Vue preset multi-caméras (1-4 caméras)
// ═══════════════════════════════════════════════════════════════

import { Edit2, ExternalLink, Plus, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, Input, Select, Tooltip } from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useRefreshSubscription } from '../../hooks/useRefreshSubscription';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';
import CameraPlayerWebRTC from './CameraPlayerWebRTC';

const PresetPanel = ({ cameras = [], proxyAvailable = false, onDetach }) => {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [presets, setPresets] = useState([]);
  const [activePresetId, setActivePresetId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCameraIds, setEditCameraIds] = useState([]);
  const [creating, setCreating] = useState(false);
  const isMountedRef = useRef(true);

  const enabledCameras = cameras.filter((c) => c.enabled);

  // Charger les presets
  const loadPresets = useCallback(async () => {
    try {
      const data = await api.getVideoPresets();
      if (!isMountedRef.current) return;

      setPresets(data);
      setActivePresetId((currentId) => {
        if (data.length === 0) return null;
        const hasCurrent = data.some((preset) => preset.id === currentId);
        return hasCurrent ? currentId : data[0].id;
      });
    } catch (err) {
      console.error('Erreur chargement presets:', err);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadPresets();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadPresets]);

  // Synchronisation cross-vues (fenêtre détachée ↔ panneau principal)
  useRefreshSubscription('video-presets', loadPresets);

  const activePreset = presets.find((p) => p.id === activePresetId);
  const presetCameras = activePreset
    ? activePreset.cameraIds.map((id) => cameras.find((c) => c.id === id)).filter(Boolean)
    : [];

  const cols = presetCameras.length <= 1 ? 1 : 2;

  // Créer / mettre à jour un preset
  const handleSave = useCallback(async () => {
    if (!editName.trim() || editCameraIds.length === 0) return;
    try {
      if (creating) {
        const created = await api.createVideoPreset({ name: editName, cameraIds: editCameraIds });
        setActivePresetId(created.id);
      } else {
        await api.updateVideoPreset(activePresetId, { name: editName, cameraIds: editCameraIds });
      }
      await loadPresets();
      refreshBus.publish('video-presets');
      setEditing(false);
      setCreating(false);
      toast.success(creating ? 'Preset créé' : 'Preset mis à jour');
    } catch (err) {
      console.error('Erreur sauvegarde preset:', err);
      toast.error('Erreur lors de la sauvegarde');
    }
  }, [editName, editCameraIds, creating, activePresetId, loadPresets, toast]);

  const handleDelete = useCallback(() => {
    if (!activePresetId) return;
    confirm({
      title: 'Supprimer le preset',
      message: 'Supprimer ce preset vidéo ?',
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        try {
          await api.deleteVideoPreset(activePresetId);
          setActivePresetId(null);
          await loadPresets();
          refreshBus.publish('video-presets');
          toast.success('Preset supprimé');
        } catch (err) {
          console.error('Erreur suppression preset:', err);
          toast.error('Erreur lors de la suppression');
        }
      },
    });
  }, [activePresetId, loadPresets, confirm, toast]);

  const startCreate = () => {
    setEditName('');
    setEditCameraIds([]);
    setCreating(true);
    setEditing(true);
  };

  const startEdit = () => {
    if (!activePreset) return;
    setEditName(activePreset.name);
    setEditCameraIds([...activePreset.cameraIds]);
    setCreating(false);
    setEditing(true);
  };

  const toggleCameraInEdit = (camId) => {
    setEditCameraIds((prev) =>
      prev.includes(camId)
        ? prev.filter((id) => id !== camId)
        : prev.length < 4
          ? [...prev, camId]
          : prev,
    );
  };

  // Mode édition
  if (editing) {
    return (
      <div className="preset-panel">
        <div className="preset-panel__editor">
          <div className="preset-panel__editor-header">
            <h3>{creating ? 'Nouveau preset' : 'Modifier le preset'}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setCreating(false);
              }}
            >
              <X size={16} />
            </Button>
          </div>

          <div className="preset-panel__editor-name">
            <label>Nom</label>
            <Input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Ex: Entrée principale"
              maxLength={50}
              autoFocus
            />
          </div>

          <div className="preset-panel__editor-cameras">
            <label>Caméras ({editCameraIds.length}/4)</label>
            <div className="preset-panel__camera-list">
              {enabledCameras.map((cam) => (
                <Button
                  key={cam.id}
                  variant="ghost"
                  size="sm"
                  className={`preset-panel__camera-chip ${editCameraIds.includes(cam.id) ? 'selected' : ''}`}
                  onClick={() => toggleCameraInEdit(cam.id)}
                  disabled={!editCameraIds.includes(cam.id) && editCameraIds.length >= 4}
                >
                  {cam.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="preset-panel__editor-actions">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!editName.trim() || editCameraIds.length === 0}
            >
              <Save size={14} /> Sauvegarder
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Aucun preset
  if (presets.length === 0) {
    return (
      <div className="preset-panel">
        {ConfirmDialogRenderer}
        <div className="preset-panel__empty">
          <p>Aucun preset configuré</p>
          <Button variant="primary" size="sm" onClick={startCreate}>
            <Plus size={16} /> Créer un preset
          </Button>
        </div>
      </div>
    );
  }

  // Affichage normal
  return (
    <div className="preset-panel">
      {ConfirmDialogRenderer}
      {/* Barre de sélection / actions */}
      <div className="preset-panel__bar">
        <Select
          className="preset-panel__select"
          value={activePresetId || ''}
          onChange={(e) => {
            const nextId = Number.parseInt(e.target.value, 10);
            setActivePresetId(Number.isInteger(nextId) && nextId > 0 ? nextId : null);
          }}
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.cameraIds.length} cam)
            </option>
          ))}
        </Select>
        <div className="preset-panel__bar-actions">
          <Tooltip content="Modifier le preset" position="bottom">
            <Button variant="ghost" size="sm" onClick={startEdit} disabled={!activePreset}>
              <Edit2 size={14} />
            </Button>
          </Tooltip>
          <Tooltip content="Supprimer le preset" position="bottom">
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={!activePreset}>
              <Trash2 size={14} />
            </Button>
          </Tooltip>
          <Tooltip content="Nouveau preset" position="bottom">
            <Button variant="ghost" size="sm" onClick={startCreate}>
              <Plus size={14} />
            </Button>
          </Tooltip>
          {onDetach && (
            <Tooltip content="Détacher dans une fenêtre" position="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDetach(activePresetId)}
                disabled={!activePresetId}
              >
                <ExternalLink size={14} />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Grille 2×2 des caméras du preset */}
      <div className="preset-panel__grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {presetCameras.map((cam, idx) => (
          <CameraPlayerWebRTC
            key={cam.id}
            camera={cam}
            autoConnect={proxyAvailable}
            connectDelay={idx * 500}
          />
        ))}
        {Array.from({
          length: Math.max(0, (activePreset?.cameraIds?.length || 0) - presetCameras.length),
        }).map((_, i) => (
          <div key={`missing-${i}`} className="camera-player camera-player--empty">
            <div className="camera-player__viewport">
              <div className="camera-player__overlay">
                <span style={{ opacity: 0.4 }}>Caméra introuvable</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PresetPanel;
