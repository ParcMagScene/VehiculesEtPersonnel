// PlaylistFormModal — Création / édition d'une playlist
import React, { useState, useEffect, useCallback, memo } from 'react';
import { X, List, Save } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

function PlaylistFormModal({ playlist, onSave, onClose }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    transition: 'fade',
    defaultDuration: 10,
  });

  useEffect(() => {
    if (playlist) {
      setForm({
        name: playlist.name || '',
        description: playlist.description || '',
        transition: playlist.transition || 'fade',
        defaultDuration: playlist.default_duration || 10,
      });
    }
  }, [playlist]);

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
        description: form.description.trim() || null,
        transition: form.transition,
        defaultDuration: parseInt(form.defaultDuration) || 10,
      };
      if (playlist) {
        await api.updateDisplayPlaylist(playlist.id, data);
      } else {
        await api.createDisplayPlaylist(data);
      }
      onSave();
    } catch (err) {
      toast.error(err.message || 'Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  }, [form, playlist, toast, onSave]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><List size={18} /> {playlist ? 'Modifier la playlist' : 'Nouvelle playlist'}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Nom *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="Ex: Accueil – vidéos corporate"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={e => handleChange('description', e.target.value)}
              rows={3}
              placeholder="Description optionnelle…"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Transition</label>
              <select value={form.transition} onChange={e => handleChange('transition', e.target.value)}>
                <option value="fade">Fondu</option>
                <option value="slide">Glissement</option>
                <option value="none">Aucune</option>
              </select>
            </div>
            <div className="form-group">
              <label>Durée par défaut (sec)</label>
              <input
                type="number"
                min="1"
                max="300"
                value={form.defaultDuration}
                onChange={e => handleChange('defaultDuration', e.target.value)}
              />
            </div>
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

export default memo(PlaylistFormModal);
