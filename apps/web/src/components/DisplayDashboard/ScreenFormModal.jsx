// ScreenFormModal — Création / édition d'un écran d'affichage
import React, { useState, useEffect, useCallback, memo } from 'react';
import { X, Monitor, Save } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

function ScreenFormModal({ screen, onSave, onClose }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [form, setForm] = useState({
    name: '',
    location: '',
    resolution: '1920x1080',
    orientation: 'landscape',
    playlistId: '',
  });

  useEffect(() => {
    if (screen) {
      setForm({
        name: screen.name || '',
        location: screen.location || '',
        resolution: screen.resolution || '1920x1080',
        orientation: screen.orientation || 'landscape',
        playlistId: screen.playlist_id || '',
      });
    }
    // Charger les playlists pour le select
    api.getDisplayPlaylists().then(data => {
      setPlaylists(Array.isArray(data) ? data.filter(p => p.is_active) : []);
    }).catch(() => {});
  }, [screen]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      toast.warning('Le nom est requis');
      return;
    }
    try {
      setSaving(true);
      const data = {
        name: form.name.trim(),
        location: form.location.trim() || null,
        resolution: form.resolution,
        orientation: form.orientation,
        playlistId: form.playlistId ? parseInt(form.playlistId) : null,
      };
      if (screen) {
        await api.updateDisplayScreen(screen.id, data);
      } else {
        await api.createDisplayScreen(data);
      }
      onSave();
    } catch (err) {
      toast.error(err.message || 'Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  }, [form, screen, toast, onSave]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><Monitor size={18} /> {screen ? 'Modifier l\'écran' : 'Nouvel écran'}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Nom *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="Ex: Écran Hall d'entrée"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Emplacement</label>
            <input
              type="text"
              value={form.location}
              onChange={e => handleChange('location', e.target.value)}
              placeholder="Ex: Hall principal"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Résolution</label>
              <select value={form.resolution} onChange={e => handleChange('resolution', e.target.value)}>
                <option value="1920x1080">1920×1080 (Full HD)</option>
                <option value="3840x2160">3840×2160 (4K)</option>
                <option value="1280x720">1280×720 (HD)</option>
                <option value="1080x1920">1080×1920 (Full HD portrait)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Orientation</label>
              <select value={form.orientation} onChange={e => handleChange('orientation', e.target.value)}>
                <option value="landscape">Paysage</option>
                <option value="portrait">Portrait</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Playlist assignée</label>
            <select value={form.playlistId} onChange={e => handleChange('playlistId', e.target.value)}>
              <option value="">— Aucune —</option>
              {playlists.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ScreenFormModal);
