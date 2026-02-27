// MediaUploadModal — Upload de médias (images/vidéos)
import React, { useState, useCallback, useRef, memo } from 'react';
import { X, Upload, Image, Film, Loader } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml,video/mp4,video/webm,video/ogg';
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

function formatFileSize(bytes) {
  if (!bytes) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function MediaUploadModal({ onSave, onClose }) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [tags, setTags] = useState('');

  const handleFileSelect = useCallback((e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > MAX_SIZE) {
      toast.error(`Fichier trop volumineux (max ${formatFileSize(MAX_SIZE)})`);
      return;
    }

    setFile(selected);

    // Générer un aperçu
    if (selected.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }
  }, [toast]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      // Simuler via l'input
      const dt = new DataTransfer();
      dt.items.add(dropped);
      if (fileInputRef.current) {
        fileInputRef.current.files = dt.files;
        handleFileSelect({ target: fileInputRef.current });
      }
    }
  }, [handleFileSelect]);

  const handleUpload = useCallback(async () => {
    if (!file) {
      toast.warning('Sélectionnez un fichier');
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      if (tags.trim()) {
        formData.append('tags', JSON.stringify(tags.split(',').map(t => t.trim()).filter(Boolean)));
      }
      await api.uploadDisplayMedia(formData);
      onSave();
    } catch (err) {
      toast.error(err.message || 'Erreur upload');
    } finally {
      setUploading(false);
    }
  }, [file, tags, toast, onSave]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><Upload size={18} /> Upload média</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {/* Zone de drop */}
          <div
            className="media-drop-zone"
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {file ? (
              <div className="drop-zone-preview">
                {preview ? (
                  <img src={preview} alt="Aperçu" className="drop-preview-img" />
                ) : (
                  <Film size={48} />
                )}
                <div className="drop-file-info">
                  <span className="drop-filename">{file.name}</span>
                  <span className="drop-filesize">{formatFileSize(file.size)}</span>
                </div>
              </div>
            ) : (
              <div className="drop-zone-empty">
                <Image size={48} strokeWidth={1} />
                <p>Glissez un fichier ici ou cliquez pour sélectionner</p>
                <span className="drop-hint">Images (JPEG, PNG, GIF, WebP, SVG) — Vidéos (MP4, WebM, OGG) — Max 50 Mo</span>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label>Tags (séparés par des virgules)</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="Ex: logo, corporate, vidéo promo"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? (
              <><Loader size={14} className="spin" /> Upload en cours…</>
            ) : (
              <><Upload size={14} /> Uploader</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(MediaUploadModal);
