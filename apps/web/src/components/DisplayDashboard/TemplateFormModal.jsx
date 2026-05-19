// TemplateFormModal — Création / édition d'un template d'affichage
import { Layout, Plus, Save, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';

import { Button, FormField, Input, ModalLayout, Select, Textarea, Tooltip } from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

const DEFAULT_ZONE = { name: 'Zone 1', x: 0, y: 0, width: 100, height: 100, type: 'content' };

function TemplateFormModal({ template, onSave, onClose }) {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'general',
    description: '',
    zones: [{ ...DEFAULT_ZONE }],
  });
  const { resetDirty, guardClose } = useDirtyForm(form, { confirmer: confirm });
  const handleSafeClose = guardClose(onClose);

  useEffect(() => {
    if (template) {
      let layout = {};
      try {
        layout = JSON.parse(template.layout || '{}');
      } catch {
        /* ignore */
      }
      setForm({
        name: template.name || '',
        category: template.category || 'general',
        description: template.description || '',
        zones: layout.zones || [{ ...DEFAULT_ZONE }],
      });
    }
  }, [template]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateZone = (idx, field, value) => {
    setForm((prev) => ({
      ...prev,
      zones: prev.zones.map((z, i) => (i === idx ? { ...z, [field]: value } : z)),
    }));
  };

  const addZone = () => {
    setForm((prev) => ({
      ...prev,
      zones: [...prev.zones, { ...DEFAULT_ZONE, name: `Zone ${prev.zones.length + 1}` }],
    }));
  };

  const removeZone = (idx) => {
    setForm((prev) => ({
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
      resetDirty();
      onSave();
    } catch (err) {
      toast.error(err.message || 'Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  }, [form, template, toast, onSave]);

  return (
    <>
      <ModalLayout
        open
        onClose={handleSafeClose}
        title={template ? 'Modifier le template' : 'Nouveau template'}
        icon={<Layout size={18} />}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={handleSafeClose}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </>
        }
      >
        <div className="form-row">
          <FormField className="form-group form-group-flex2" label="Nom" required>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Ex: Deux colonnes"
              autoFocus
            />
          </FormField>
          <FormField className="form-group form-group-flex1" label="Catégorie">
            <Select
              value={form.category}
              onChange={(e) => handleChange('category', e.target.value)}
            >
              <option value="general">Général</option>
              <option value="event">Événement</option>
              <option value="info">Information</option>
              <option value="alert">Alerte</option>
              <option value="welcome">Accueil</option>
            </Select>
          </FormField>
        </div>
        <FormField className="form-group" label="Description">
          <Textarea
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={2}
            placeholder="Description du template…"
          />
        </FormField>

        {/* Zones */}
        <div className="template-zones-editor">
          <div className="zones-header">
            <h4>Zones de contenu</h4>
            <Button variant="primary" size="sm" onClick={addZone}>
              <Plus size={12} /> Ajouter une zone
            </Button>
          </div>
          {form.zones.map((zone, idx) => (
            <div key={idx} className="zone-row">
              <Input
                type="text"
                value={zone.name}
                onChange={(e) => updateZone(idx, 'name', e.target.value)}
                placeholder="Nom"
                className="zone-name"
              />
              <Select
                value={zone.type}
                onChange={(e) => updateZone(idx, 'type', e.target.value)}
                className="zone-type"
              >
                <option value="content">Contenu</option>
                <option value="header">En-tête</option>
                <option value="footer">Pied</option>
                <option value="sidebar">Barre latérale</option>
                <option value="ticker">Bandeau défilant</option>
              </Select>
              <div className="zone-position">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={zone.x}
                  onChange={(e) => updateZone(idx, 'x', parseInt(e.target.value) || 0)}
                  title="X (%)"
                />
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={zone.y}
                  onChange={(e) => updateZone(idx, 'y', parseInt(e.target.value) || 0)}
                  title="Y (%)"
                />
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={zone.width}
                  onChange={(e) => updateZone(idx, 'width', parseInt(e.target.value) || 1)}
                  title="Largeur (%)"
                />
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={zone.height}
                  onChange={(e) => updateZone(idx, 'height', parseInt(e.target.value) || 1)}
                  title="Hauteur (%)"
                />
              </div>
              {form.zones.length > 1 && (
                <Tooltip content="Supprimer">
                  <Button
                    variant="danger"
                    size="sm"
                    iconOnly
                    aria-label="Supprimer la zone"
                    onClick={() => removeZone(idx)}
                  >
                    <Trash2 size={12} />
                  </Button>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      </ModalLayout>
      {ConfirmDialogRenderer}
    </>
  );
}

export default memo(TemplateFormModal);
