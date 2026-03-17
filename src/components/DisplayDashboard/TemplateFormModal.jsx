// TemplateFormModal — Création / édition d'un template d'affichage
import React, { useState, useEffect, useCallback, memo } from 'react';
import { X, Layout, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

const DEFAULT_ZONE = { name: 'Zone 1', x: 0, y: 0, width: 100, height: 100, type: 'content' };

function TemplateFormModal({ template, onSave, onClose }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'general',
    description: '',
    zones: [{ ...DEFAULT_ZONE }],
  });

  useEffect(() => {
    if (template) {
      let layout = {};
      try { layout = JSON.parse(template.layout || '{}'); } catch { /* ignore */ }
      setForm({
        name: template.name || '',
        category: template.category || 'general',
        description: template.description || '',
        zones: layout.zones || [{ ...DEFAULT_ZONE }],
      });
    }
  }, [template]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateZone = (idx, field, value) => {
    setForm(prev => ({
      ...prev,
      zones: prev.zones.map((z, i) => i === idx ? { ...z, [field]: value } : z),
    }));
  };

  const addZone = () => {
    setForm(prev => ({
      ...prev,
      zones: [...prev.zones, { ...DEFAULT_ZONE, name: `Zone ${prev.zones.length + 1}` }],
    }));
  };

  const removeZone = (idx) => {
    setForm(prev => ({
      ...prev,
      zones: prev.zones.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      toast.warning('Le nom est requis');
      return;
    }
    if (form.zones.length === 0) {
      toast.warning('Au moins une zone est requise');
      return;
    }
    try {
      setSaving(true);
      const data = {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim() || null,
        layout: { zones: form.zones },
      };
      if (template) {
        await api.updateDisplayTemplate(template.id, data);
      } else {
        await api.createDisplayTemplate(data);
      }
      onSave();
    } catch (err) {
      toast.error(err.message || 'Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  }, [form, template, toast, onSave]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><Layout size={18} /> {template ? 'Modifier le template' : 'Nouveau template'}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group form-group-flex2">
              <label>Nom *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder="Ex: Deux colonnes"
                autoFocus
              />
            </div>
            <div className="form-group form-group-flex1">
              <label>Catégorie</label>
              <select value={form.category} onChange={e => handleChange('category', e.target.value)}>
                <option value="general">Général</option>
                <option value="event">Événement</option>
                <option value="info">Information</option>
                <option value="alert">Alerte</option>
                <option value="welcome">Accueil</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={e => handleChange('description', e.target.value)}
              rows={2}
              placeholder="Description du template…"
            />
          </div>

          {/* Zones */}
          <div className="template-zones-editor">
            <div className="zones-header">
              <h4>Zones de contenu</h4>
              <button className="btn-sm" onClick={addZone}>
                <Plus size={12} /> Ajouter une zone
              </button>
            </div>
            {form.zones.map((zone, idx) => (
              <div key={idx} className="zone-row">
                <input
                  type="text"
                  value={zone.name}
                  onChange={e => updateZone(idx, 'name', e.target.value)}
                  placeholder="Nom"
                  className="zone-name"
                />
                <select value={zone.type} onChange={e => updateZone(idx, 'type', e.target.value)} className="zone-type">
                  <option value="content">Contenu</option>
                  <option value="header">En-tête</option>
                  <option value="footer">Pied</option>
                  <option value="sidebar">Barre latérale</option>
                  <option value="ticker">Bandeau défilant</option>
                </select>
                <div className="zone-position">
                  <input type="number" min="0" max="100" value={zone.x} onChange={e => updateZone(idx, 'x', parseInt(e.target.value) || 0)} title="X (%)" />
                  <input type="number" min="0" max="100" value={zone.y} onChange={e => updateZone(idx, 'y', parseInt(e.target.value) || 0)} title="Y (%)" />
                  <input type="number" min="1" max="100" value={zone.width} onChange={e => updateZone(idx, 'width', parseInt(e.target.value) || 1)} title="Largeur (%)" />
                  <input type="number" min="1" max="100" value={zone.height} onChange={e => updateZone(idx, 'height', parseInt(e.target.value) || 1)} title="Hauteur (%)" />
                </div>
                {form.zones.length > 1 && (
                  <button className="btn-icon-sm danger" onClick={() => removeZone(idx)} title="Supprimer">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
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

export default memo(TemplateFormModal);
