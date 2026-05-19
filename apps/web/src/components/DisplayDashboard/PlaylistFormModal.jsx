// PlaylistFormModal — Création / édition d'une playlist
import { List, Save } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';

import { Button, FormField, Input, ModalLayout, Select, Textarea } from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

function PlaylistFormModal({ playlist, onSave, onClose }) {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    transition: 'fade',
    defaultDuration: 10,
  });
  const { resetDirty, guardClose } = useDirtyForm(form, { confirmer: confirm });
  const handleSafeClose = guardClose(onClose);

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
    setForm((prev) => ({ ...prev, [field]: value }));
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
      resetDirty();
      onSave();
    } catch (err) {
      toast.error(err.message || 'Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  }, [form, playlist, toast, onSave]);

  return (
    <>
      <ModalLayout
        open
        onClose={handleSafeClose}
        title={playlist ? 'Modifier la playlist' : 'Nouvelle playlist'}
        icon={<List size={18} />}
        size="md"
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
        <FormField className="form-group" label="Nom" required>
          <Input
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Ex: Accueil – vidéos corporate"
            autoFocus
          />
        </FormField>
        <FormField className="form-group" label="Description">
          <Textarea
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            placeholder="Description optionnelle…"
          />
        </FormField>
        <div className="form-row">
          <FormField className="form-group" label="Transition">
            <Select
              value={form.transition}
              onChange={(e) => handleChange('transition', e.target.value)}
            >
              <option value="fade">Fondu</option>
              <option value="slide">Glissement</option>
              <option value="none">Aucune</option>
            </Select>
          </FormField>
          <FormField className="form-group" label="Durée par défaut (sec)">
            <Input
              type="number"
              min="1"
              max="300"
              value={form.defaultDuration}
              onChange={(e) => handleChange('defaultDuration', e.target.value)}
            />
          </FormField>
        </div>
      </ModalLayout>
      {ConfirmDialogRenderer}
    </>
  );
}

export default memo(PlaylistFormModal);
