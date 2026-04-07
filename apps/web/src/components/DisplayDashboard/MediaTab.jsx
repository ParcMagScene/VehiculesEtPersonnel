// MediaTab — Galerie de médias (images/vidéos)
import { useState, useEffect, useCallback, memo } from 'react';
import { Image, Film, Trash2, Eye } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import api from '../../utils/api';
import { Button, EmptyState, Tooltip } from '@/design-system';

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

  const handleDelete = useCallback((item) => {
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
  }, [confirm, toast, onRefresh]);

  if (loading) return <div className="display-loading">Chargement des médias…</div>;

  return (
    <div className="display-media-tab">
      {/* Filtres */}
      <div className="media-filters">
        {['all', 'image', 'video'].map(f => (
          <Button variant="ghost"             key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Tous' : f === 'image' ? '🖼 Images' : '🎬 Vidéos'}
          </Button>
        ))}
        <span className="media-count">{media.length} fichier(s)</span>
      </div>

      {media.length === 0 ? (
        <EmptyState icon={<Image size={48} strokeWidth={1} />} title="Aucun média" description="Uploadez des images ou vidéos pour vos écrans d'affichage." />
      ) : (
        <div className="media-grid">
          {media.map(item => (
            <div key={item.id} className="media-card">
              <div className="media-preview" onClick={() => setPreview(item)}>
                {item.media_type === 'video' ? (
                  <div className="media-video-thumb">
                    <Film size={32} />
                  </div>
                ) : (
                  <img src={item.file_path} alt={item.original_name} loading="lazy" />
                )}
              </div>
              <div className="media-info">
                <span className="media-name" title={item.original_name}>
                  {item.original_name}
                </span>
                <span className="media-size">{formatFileSize(item.file_size)}</span>
              </div>
              <div className="media-actions">
                <Tooltip content="Aperçu">
                  <Button variant="ghost" size="sm" iconOnly onClick={() => setPreview(item)}>
                    <Eye size={14} />
                  </Button>
                </Tooltip>
                <Tooltip content="Supprimer">
                  <Button variant="danger" size="sm" iconOnly onClick={() => handleDelete(item)}>
                    <Trash2 size={14} />
                  </Button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal aperçu */}
      {preview && (
        <div className="media-preview-overlay" onClick={() => setPreview(null)}>
          <div className="media-preview-content" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" className="media-preview-close" onClick={() => setPreview(null)}>✕</Button>
            {preview.media_type === 'video' ? (
              <video src={preview.file_path} controls autoPlay style={{ maxWidth: '100%', maxHeight: '80vh' }} />
            ) : (
              <img src={preview.file_path} alt={preview.original_name} style={{ maxWidth: '100%', maxHeight: '80vh' }} />
            )}
            <p className="preview-filename">{preview.original_name}</p>
          </div>
        </div>
      )}
      {ConfirmDialogRenderer}
    </div>
  );
}

export default memo(MediaTab);
