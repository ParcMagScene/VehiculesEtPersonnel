// MediaTab — Galerie de médias (images/vidéos)
import { Eye, Film, Image, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';

import { Button, EmptyState, Modal, ModalBody, Tooltip } from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

function formatFileSize(bytes) {
  if (!bytes) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function MediaTab({ _currentUser, refreshKey, _onUpload, onRefresh }) {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | image | video
  const [preview, setPreview] = useState(null);

  const loadMedia = useCallback(async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { type: filter } : undefined;
      const data = await api.getDisplayMedia(params);
      setMedia(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Erreur chargement médias');
    } finally {
      setLoading(false);
    }
  }, [toast, filter]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia, refreshKey]);

  const handleDelete = useCallback(
    (item) => {
      confirm({
        title: 'Supprimer',
        message: `Supprimer \xAB ${item.original_name} \xBB ?`,
        variant: 'danger',
        confirmLabel: 'Supprimer',
        onConfirm: async () => {
          try {
            await api.deleteDisplayMedia(item.id);
            toast.success('M\xE9dia supprim\xE9');
            onRefresh();
          } catch {
            toast.error('Erreur suppression');
          }
        },
      });
    },
    [confirm, toast, onRefresh],
  );

  if (loading) return <div className="display-loading">Chargement des médias…</div>;

  return (
    <div className="display-media-tab">
      {/* Filtres */}
      <div className="display-media-filters">
        {['all', 'image', 'video'].map((f) => (
          <Button
            variant="ghost"
            key={f}
            className={filter === f ? 'active' : ''}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Tous' : f === 'image' ? '🖼 Images' : '🎬 Vidéos'}
          </Button>
        ))}
        <span className="count">{media.length} fichier(s)</span>
      </div>

      {media.length === 0 ? (
        <EmptyState
          icon={<Image size={48} strokeWidth={1} />}
          title="Aucun média"
          description="Uploadez des images ou vidéos pour vos écrans d'affichage."
        />
      ) : (
        <div className="display-media-grid">
          {media.map((item) => (
            <div key={item.id} className="display-media-card">
              <div
                className="display-media-thumb"
                role="button"
                tabIndex={0}
                onClick={() => setPreview(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setPreview(item);
                  }
                }}
                aria-label={`Aperçu du média ${item.original_name}`}
              >
                {item.media_type === 'video' ? (
                  <div className="display-media-video-thumb">
                    <Film size={32} />
                  </div>
                ) : (
                  <img src={item.file_path} alt={item.original_name} loading="lazy" />
                )}
              </div>
              <div className="display-media-info">
                <span className="display-media-name" title={item.original_name}>
                  {item.original_name}
                </span>
                <span className="display-media-size">{formatFileSize(item.file_size)}</span>
              </div>
              <div className="display-media-actions">
                <Tooltip content="Aperçu">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label="Aperçu du média"
                    onClick={() => setPreview(item)}
                  >
                    <Eye size={14} />
                  </Button>
                </Tooltip>
                <Tooltip content="Supprimer">
                  <Button
                    variant="danger"
                    size="sm"
                    iconOnly
                    aria-label="Supprimer le média"
                    onClick={() => handleDelete(item)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal aperçu */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        size="lg"
        className="media-preview-content"
      >
        <ModalBody>
          {preview?.media_type === 'video' ? (
            <video
              src={preview?.file_path}
              controls
              autoPlay
              className="display-media-preview-asset"
            />
          ) : (
            <img
              src={preview?.file_path}
              alt={preview?.original_name}
              loading="lazy"
              className="display-media-preview-asset"
            />
          )}
          {preview && <p className="display-preview-filename">{preview.original_name}</p>}
        </ModalBody>
      </Modal>
      {ConfirmDialogRenderer}
    </div>
  );
}

export default memo(MediaTab);
