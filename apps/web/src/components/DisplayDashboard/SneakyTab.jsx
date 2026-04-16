// ═══════════════════════════════════════════════════════════════
// SneakyTab — Gestion de la photo furtive
// Upload, statut, prévisualisation, désactivation
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, memo } from 'react';
import { Camera, Trash2, Clock, Upload } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { Button, Select, SectionHeader } from '@/design-system';

const DURATION_OPTIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 heure' },
  { value: '240', label: '4 heures' },
  { value: 'endOfDay', label: "Jusqu'à la fin de la journée" },
  { value: 'endOfWeek', label: "Jusqu'à la fin de la semaine" },
];

function SneakyTab({ _currentUser, refreshKey }) {
  const toast = useToast();
  const [status, setStatus] = useState({ active: false });
  const [duration, setDuration] = useState('60');
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDisplaySneakyPhotoStatus();
      setStatus(data);
    } catch {
      toast.error('Erreur chargement statut');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus, refreshKey]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      toast.error('Veuillez sélectionner une photo');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('photo', selectedFile);
      formData.append('duration', duration);
      await api.uploadDisplaySneakyPhoto(formData);
      toast.success('Photo furtive activée !');
      setSelectedFile(null);
      setPreviewUrl(null);
      const data = await api.getDisplaySneakyPhotoStatus();
      setStatus(data);
    } catch {
      toast.error('Erreur activation');
    }
  }, [selectedFile, duration, toast]);

  const handleDisable = useCallback(async () => {
    try {
      await api.deleteDisplaySneakyPhoto();
      toast.success('Photo furtive désactivée');
      setStatus({ active: false });
    } catch {
      toast.error('Erreur désactivation');
    }
  }, [toast]);

  if (loading) return <div className="display-loading">Chargement…</div>;

  return (
    <div className="dtv-sneaky-photo">
      <div className="dtv-section">
        <SectionHeader
          className="dtv-section-title"
          icon={<Camera size={16} />}
          title="Photo furtive"
        />
        <p className="dtv-hint">
          Uploadez une photo qui défilera en bas de l'écran TV pendant la durée choisie.
        </p>

        {/* Formulaire upload */}
        <div className="dtv-sneaky-upload">
          <div className="dtv-form-group">
            <label>Sélectionner une photo</label>
            <input type="file" accept="image/*" onChange={handleFileSelect} />
          </div>

          {previewUrl && (
            <div className="dtv-sneaky-local-preview">
              <img src={previewUrl} alt="Prévisualisation" />
            </div>
          )}

          <div className="dtv-form-group">
            <label>Durée d'affichage</label>
            <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
              {DURATION_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>

          <Button variant="primary" size="sm" onClick={handleUpload} disabled={!selectedFile}>
            <Upload size={14} /> Activer la photo furtive
          </Button>
        </div>
      </div>

      {/* Statut */}
      <div className="dtv-section">
        <SectionHeader className="dtv-section-title" title="Photo furtive active" />

        {status.active ? (
          <div className="dtv-sneaky-status">
            <div className="dtv-sneaky-active">
              <span className="dtv-badge-active">✅ Active</span>
              <span className="dtv-sneaky-expires">
                <Clock size={12} /> Expire: {new Date(status.expiresAt).toLocaleString('fr-FR')}
              </span>
            </div>
            {status.path && (
              <div className="dtv-sneaky-current-preview">
                <img src={`${status.path}?t=${Date.now()}`} alt="Photo furtive active" />
              </div>
            )}
            <Button variant="danger" size="sm" onClick={handleDisable}>
              <Trash2 size={14} /> Désactiver la photo
            </Button>
          </div>
        ) : (
          <div className="dtv-empty-hint">❌ Aucune photo furtive active</div>
        )}
      </div>
    </div>
  );
}

export default memo(SneakyTab);
