import React, { useState, useMemo, useRef } from 'react';
import { Image as ImageIcon, Upload, Trash2, ZoomIn, Edit2, X, Link2, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../utils/api';
import { cleanName, APP_BASE_URL } from './equipmentConstants';
import { matchPhotoToEquipment } from './equipmentUtils';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { Button, Input, Tooltip, SearchBar } from '@/design-system';

const EquipmentMediaManager = ({ photosList, logosList, equipment, onRefresh }) => {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [mediaSearch, setMediaSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [renamingPhoto, setRenamingPhoto] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [linkingPhoto, setLinkingPhoto] = useState(null);
  const [linkSearch, setLinkSearch] = useState('');
  const { confirm: confirmMedia, ConfirmDialogRenderer: MediaConfirmRenderer } = useConfirmDialog();

  const filteredPhotos = useMemo(() => {
    if (!mediaSearch.trim()) return photosList;
    const q = mediaSearch.toLowerCase();
    return photosList.filter((p) => p.toLowerCase().includes(q));
  }, [photosList, mediaSearch]);

  const photoEquipmentMap = useMemo(() => {
    const map = {};
    for (const photo of photosList) {
      const match = equipment.find((eq) => matchPhotoToEquipment([photo], eq));
      if (match) map[photo] = match;
    }
    return map;
  }, [photosList, equipment]);

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const result = await api.uploadEquipmentPhotos(Array.from(files));
      toast.success(`${result.count} photo(s) uploadée(s)`);
      onRefresh();
    } catch (err) {
      toast.error('Erreur upload : ' + (err.message || 'inconnu'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = (filename) => {
    confirmMedia({
      title: 'Supprimer la photo',
      message: `Supprimer la photo "${filename}" ?\nCette action est irréversible.`,
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        try {
          await api.deleteEquipmentPhoto(filename);
          toast.success(`Photo "${filename}" supprimée`);
          onRefresh();
        } catch (err) {
          toast.error('Erreur suppression : ' + (err.message || 'inconnu'));
        }
      },
    });
  };

  const handleRename = async () => {
    if (!renamingPhoto || !renameValue.trim()) return;
    const ext = renamingPhoto.split('.').pop();
    const newName = renameValue.trim().endsWith(`.${ext}`)
      ? renameValue.trim()
      : `${renameValue.trim()}.${ext}`;
    if (newName === renamingPhoto) {
      setRenamingPhoto(null);
      return;
    }
    try {
      await api.renameEquipmentPhoto(renamingPhoto, newName);
      toast.success(`Renommé : ${newName}`);
      setRenamingPhoto(null);
      setRenameValue('');
      onRefresh();
    } catch (err) {
      toast.error('Erreur renommage : ' + (err.message || 'inconnu'));
    }
  };

  const handleManualLink = async (photoFilename, eq) => {
    try {
      await api.linkEquipmentPhoto(eq.id, photoFilename);
      toast.success(`Photo associée à ${cleanName(eq.name)}`);
      setLinkingPhoto(null);
      setLinkSearch('');
      onRefresh();
    } catch (err) {
      toast.error('Erreur association : ' + (err.message || 'inconnu'));
    }
  };

  const linkFilteredEquipment = useMemo(() => {
    if (!linkSearch.trim()) return equipment.slice(0, 20);
    const q = linkSearch.toLowerCase();
    return equipment
      .filter(
        (eq) =>
          (eq.name || '').toLowerCase().includes(q) ||
          (eq.reference || '').toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [equipment, linkSearch]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files?.length) handleUpload(files);
  };

  return (
    <div className="eq-management-section eq-media-manager">
      <div className="eq-media-header">
        <h3>
          <ImageIcon size={18} /> Gestion des Médias
        </h3>
        <div className="eq-media-counts">
          <span className="eq-media-count-badge">📸 {photosList.length} photos</span>
          <span className="eq-media-count-badge">🏷️ {logosList.length} logos</span>
        </div>
      </div>

      <div className="eq-media-toolbar">
        <SearchBar
          value={mediaSearch}
          onChange={setMediaSearch}
          placeholder="Rechercher une photo..."
          size="sm"
        />
        <Button
          variant="primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload size={16} /> {uploading ? 'Upload...' : 'Ajouter des photos'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="eq-media-file-input"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      <div
        className={`eq-media-dropzone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={24} />
        <span>Glissez-déposez des images ici ou cliquez pour sélectionner</span>
        <small>JPG, PNG, WebP, AVIF, SVG — Max 20 MB par fichier</small>
      </div>

      <div className="eq-media-section">
        <h4>
          📸 Photos matériel ({filteredPhotos.length}
          {mediaSearch ? ` / ${photosList.length}` : ''})
        </h4>
        {filteredPhotos.length === 0 ? (
          <p className="eq-detail-empty">
            {mediaSearch ? 'Aucune photo correspondante' : 'Aucune photo dans Photos/Matériel/'}
          </p>
        ) : (
          <div className="eq-media-photo-grid">
            {filteredPhotos.map((p) => {
              const linkedEq = photoEquipmentMap[p];
              return (
                <div key={p} className={`eq-media-card ${linkedEq ? 'linked' : ''}`}>
                  <div
                    className="eq-media-card-img"
                    role="button"
                    tabIndex={0}
                    onClick={() => setPreviewPhoto(p)}
                  >
                    <img src={`/Photos/Matériel/${p}`} alt={p} loading="lazy" />
                    <div className="eq-media-card-zoom">
                      <ZoomIn size={16} />
                    </div>
                  </div>
                  <div className="eq-media-card-info">
                    {renamingPhoto === p ? (
                      <div className="eq-media-rename-row">
                        <Input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename();
                            if (e.key === 'Escape') setRenamingPhoto(null);
                          }}
                          className="eq-media-rename-input"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          onClick={handleRename}
                          className="eq-media-rename-ok"
                        >
                          OK
                        </Button>
                      </div>
                    ) : (
                      <span className="eq-media-card-name" title={p}>
                        {p.length > 20 ? p.slice(0, 17) + '...' : p}
                      </span>
                    )}
                    {linkedEq ? (
                      <span
                        className="eq-media-card-link"
                        title={`Associé à : ${cleanName(linkedEq.name)}`}
                      >
                        <Link2 size={10} /> {cleanName(linkedEq.name).slice(0, 18)}
                      </span>
                    ) : linkingPhoto === p ? (
                      <div className="eq-media-link-picker">
                        <Input
                          type="text"
                          placeholder="Rechercher équipement..."
                          value={linkSearch}
                          onChange={(e) => setLinkSearch(e.target.value)}
                          className="eq-media-link-search"
                          autoFocus
                        />
                        <div className="eq-media-link-results">
                          {linkFilteredEquipment.map((eq) => (
                            <div
                              key={eq.id}
                              onClick={() => handleManualLink(p, eq)}
                              className="eq-media-link-item"
                            >
                              {eq.reference ? `${eq.reference} — ` : ''}
                              {cleanName(eq.name)}
                            </div>
                          ))}
                          {linkFilteredEquipment.length === 0 && (
                            <div className="eq-media-link-empty">Aucun résultat</div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setLinkingPhoto(null);
                            setLinkSearch('');
                          }}
                          className="eq-media-link-cancel"
                        >
                          Annuler
                        </Button>
                      </div>
                    ) : (
                      <Tooltip content="Cliquer pour associer manuellement" position="bottom">
                        <span
                          className="eq-media-card-nolink"
                          role="button"
                          tabIndex={0}
                          onClick={() => setLinkingPhoto(p)}
                        >
                          Non associé
                        </span>
                      </Tooltip>
                    )}
                  </div>
                  <div className="eq-media-card-actions">
                    <Tooltip content="Renommer">
                      <Button
                        variant="ghost"
                        className="eq-media-card-action-btn"
                        onClick={() => {
                          setRenamingPhoto(p);
                          setRenameValue(p.replace(/\.[^.]+$/, ''));
                        }}
                      >
                        <Edit2 size={12} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Associer manuellement">
                      <Button
                        variant="ghost"
                        className="eq-media-card-action-btn"
                        onClick={() => setLinkingPhoto(linkingPhoto === p ? null : p)}
                      >
                        <Link2 size={12} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Supprimer cette photo">
                      <Button
                        variant="ghost"
                        className="eq-media-card-delete"
                        onClick={() => handleDelete(p)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="eq-media-section">
        <h4>🏷️ Logos marques ({logosList.length})</h4>
        {logosList.length === 0 ? (
          <p className="eq-detail-empty">Aucun logo dans Logos/</p>
        ) : (
          <div className="eq-media-photo-grid">
            {logosList.map((l) => (
              <div key={l} className="eq-media-card logo-card">
                <div
                  className="eq-media-card-img"
                  role="button"
                  tabIndex={0}
                  onClick={() => setPreviewPhoto({ src: `/Logos/${l}`, name: l })}
                >
                  <img src={`/Logos/${l}`} alt={l} loading="lazy" />
                  <div className="eq-media-card-zoom">
                    <ZoomIn size={16} />
                  </div>
                </div>
                <div className="eq-media-card-info">
                  <span className="eq-media-card-name" title={l}>
                    {l.length > 20 ? l.slice(0, 17) + '...' : l}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="eq-mgmt-media-legend">
        <h4>
          <QrCode size={16} /> UID & QR Codes
        </h4>
        <p>
          Chaque équipement possède un UID unique (EMAG-XXXXX) et un QR Code qui renvoie vers
          l'interface mobile.
        </p>
        <div className="eq-mgmt-uid-example">
          <QRCodeSVG
            value={`${APP_BASE_URL}/#/mobile/equipment/EMAG-00001`}
            size={80}
            level="M"
            includeMargin
          />
          <div>
            <code>EMAG-00001</code>
            <span>→ Menu mobile : Fiche, Défaut, SAV, Intervention</span>
          </div>
        </div>
      </div>

      {previewPhoto && (
        <div
          className="eq-media-preview-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && setPreviewPhoto(null)}
        >
          <div className="eq-media-preview-content" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              className="eq-media-preview-close"
              onClick={() => setPreviewPhoto(null)}
            >
              <X size={22} />
            </Button>
            <img
              src={
                typeof previewPhoto === 'string'
                  ? `/Photos/Matériel/${previewPhoto}`
                  : previewPhoto.src
              }
              alt={typeof previewPhoto === 'string' ? previewPhoto : previewPhoto.name}
              loading="lazy"
            />
            <span className="eq-media-preview-name">
              {typeof previewPhoto === 'string' ? previewPhoto : previewPhoto.name}
            </span>
          </div>
        </div>
      )}

      {MediaConfirmRenderer}
    </div>
  );
};

export default EquipmentMediaManager;
