// ScreenFormModal — Création / édition d'un écran d'affichage
import { useState, useEffect, useCallback, memo } from 'react';
import { Monitor, Save } from 'lucide-react';
import { Button, FormField, ModalLayout, Input, Select } from '@/design-system';
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
    api
      .getDisplayPlaylists()
      .then((data) => {
        setPlaylists(Array.isArray(data) ? data.filter((p) => p.is_active) : []);
      })
      .catch(() => {});
  }, [screen]);

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
    <ModalLayout
      open
      onClose={onClose}
      title={screen ? "Modifier l'\u00e9cran" : 'Nouvel \u00e9cran'}
      icon={<Monitor size={18} />}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
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
          placeholder="Ex: Écran Hall d'entrée"
          autoFocus
        />
      </FormField>
      <FormField className="form-group" label="Emplacement">
        <Input
          type="text"
          value={form.location}
          onChange={(e) => handleChange('location', e.target.value)}
          placeholder="Ex: Hall principal"
        />
      </FormField>
      <div className="form-row">
        <FormField className="form-group" label="Résolution">
          <Select
            value={form.resolution}
            onChange={(e) => handleChange('resolution', e.target.value)}
          >
            <option value="1920x1080">1920×1080 (Full HD)</option>
            <option value="3840x2160">3840×2160 (4K)</option>
            <option value="1280x720">1280×720 (HD)</option>
            <option value="1080x1920">1080×1920 (Full HD portrait)</option>
          </Select>
        </FormField>
        <FormField className="form-group" label="Orientation">
          <Select
            value={form.orientation}
            onChange={(e) => handleChange('orientation', e.target.value)}
          >
            <option value="landscape">Paysage</option>
            <option value="portrait">Portrait</option>
          </Select>
        </FormField>
      </div>
      <FormField className="form-group" label="Playlist assignée">
        <Select
          value={form.playlistId}
          onChange={(e) => handleChange('playlistId', e.target.value)}
        >
          <option value="">— Aucune —</option>
          {playlists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormField>
    </ModalLayout>
  );
}

export default memo(ScreenFormModal);
