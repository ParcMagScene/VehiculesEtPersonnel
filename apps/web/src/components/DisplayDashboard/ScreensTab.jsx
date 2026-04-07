// ScreensTab — Liste et gestion des écrans d'affichage
import { useState, useEffect, useCallback, lazy, Suspense, memo } from 'react';
import { Monitor, Wifi, WifiOff, MapPin, Settings, Trash2, ToggleLeft, ToggleRight, Plus } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { Button, Dialog, EmptyState, Tooltip } from '@/design-system';

const ScreenFormModal = lazy(() => import('./ScreenFormModal'));

function ScreensTab({ currentUser, refreshKey, onRefresh }) {
  const toast = useToast();
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScreenModal, setShowScreenModal] = useState(false);
  const [editingScreen, setEditingScreen] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const loadScreens = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDisplayScreens();
      setScreens(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Erreur chargement écrans');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadScreens();
  }, [loadScreens, refreshKey]);

  const handleDelete = useCallback((screen) => {
    setConfirmDialog({
      title: 'Supprimer',
      message: `Supprimer l'\xE9cran \xAB ${screen.name} \xBB ?`,
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.deleteDisplayScreen(screen.id);
          toast.success('\xC9cran supprim\xE9');
          onRefresh();
        } catch {
          toast.error('Erreur suppression');
        }
      },
    });
  }, [toast, onRefresh]);

  const handleToggle = useCallback(async (screen) => {
    try {
      await api.updateDisplayScreen(screen.id, { isActive: !screen.is_active });
      toast.success(screen.is_active ? 'Écran désactivé' : 'Écran activé');
      onRefresh();
    } catch {
      toast.error('Erreur modification');
    }
  }, [toast, onRefresh]);

  const isAdmin = currentUser?.isAdmin;

  const handleScreenSaved = useCallback(() => {
    setShowScreenModal(false);
    setEditingScreen(null);
    onRefresh();
    toast.success('Écran enregistré');
  }, [onRefresh, toast]);

  if (loading) return <div className="display-loading">Chargement des écrans…</div>;

  if (screens.length === 0) {
    return (
      <EmptyState icon={<Monitor size={48} strokeWidth={1} />} title="Aucun écran configuré" description="Ajoutez votre premier écran d'affichage dynamique pour commencer." />
    );
  }

  return (
    <div className="display-screens-list">
      {isAdmin && (
        <div className="screens-toolbar">
          <Button variant="primary" size="sm" onClick={() => { setEditingScreen(null); setShowScreenModal(true); }}>
            <Plus size={14} /> Nouvel écran
          </Button>
        </div>
      )}
      <div className="display-grid">
      {screens.map(screen => (
        <div key={screen.id} className={`display-screen-card ${screen.status === 'online' ? 'online' : 'offline'}`}>
          <div className="screen-card-header">
            <div className="screen-status">
              {screen.status === 'online' ? (
                <Wifi size={14} className="status-online" />
              ) : (
                <WifiOff size={14} className="status-offline" />
              )}
              <span className={`status-badge ${screen.status}`}>{screen.status}</span>
            </div>
            {!screen.is_active && <span className="badge-inactive">Inactif</span>}
          </div>

          <h4 className="screen-name">{screen.name}</h4>

          <div className="screen-meta">
            {screen.location && (
              <span className="screen-location">
                <MapPin size={12} /> {screen.location}
              </span>
            )}
            <span className="screen-resolution">{screen.resolution || '1920×1080'}</span>
            <span className="screen-orientation">{screen.orientation === 'portrait' ? '↕ Portrait' : '↔ Paysage'}</span>
          </div>

          {screen.playlist_name && (
            <div className="screen-playlist">
              🎵 {screen.playlist_name}
            </div>
          )}

          {screen.last_heartbeat && (
            <div className="screen-heartbeat">
              Dernier signal : {new Date(screen.last_heartbeat).toLocaleString('fr-FR')}
            </div>
          )}

          {isAdmin && (
            <div className="screen-actions">
              <Tooltip content="Modifier">
                <Button variant="ghost" size="sm" iconOnly onClick={() => { setEditingScreen(screen); setShowScreenModal(true); }}>
                  <Settings size={14} />
                </Button>
              </Tooltip>
              <Tooltip content={screen.is_active ? 'Désactiver' : 'Activer'}>
                <Button variant="ghost" size="sm" iconOnly onClick={() => handleToggle(screen)}>
                  {screen.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                </Button>
              </Tooltip>
              <Tooltip content="Supprimer">
                <Button variant="danger" size="sm" iconOnly onClick={() => handleDelete(screen)}>
                  <Trash2 size={14} />
                </Button>
              </Tooltip>
            </div>
          )}
        </div>
      ))}
      </div>

      {showScreenModal && (
        <Suspense fallback={null}>
          <ScreenFormModal
            screen={editingScreen}
            onSave={handleScreenSaved}
            onClose={() => { setShowScreenModal(false); setEditingScreen(null); }}
          />
        </Suspense>
      )}
      <Dialog
        open={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        title={confirmDialog?.title || 'Confirmation'}
        variant={confirmDialog?.variant || 'confirm'}
        onConfirm={confirmDialog?.onConfirm}
        confirmLabel={confirmDialog?.confirmLabel || 'Confirmer'}
        cancelLabel="Annuler"
      >
        {confirmDialog?.message}
      </Dialog>
    </div>
  );
}

export default memo(ScreensTab);
