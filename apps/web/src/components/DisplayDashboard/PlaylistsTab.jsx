// PlaylistsTab — Liste et gestion des playlists
import React, { useState, useEffect, useCallback, memo } from 'react';
import { List, Play, Monitor, Clock, Trash2, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { Button, Dialog, EmptyState, Tooltip } from '@/design-system';

function PlaylistsTab({ currentUser, refreshKey, onEdit, onRefresh }) {
  const toast = useToast();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const loadPlaylists = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDisplayPlaylists();
      setPlaylists(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Erreur chargement playlists');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists, refreshKey]);

  const handleDelete = useCallback((playlist) => {
    setConfirmDialog({
      title: 'Supprimer',
      message: `Supprimer la playlist \xAB ${playlist.name} \xBB ?`,
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.deleteDisplayPlaylist(playlist.id);
          toast.success('Playlist supprim\xE9e');
          onRefresh();
        } catch {
          toast.error('Erreur suppression');
        }
      },
    });
  }, [toast, onRefresh]);

  const handleToggle = useCallback(async (playlist) => {
    try {
      await api.updateDisplayPlaylist(playlist.id, { isActive: !playlist.is_active });
      toast.success(playlist.is_active ? 'Playlist désactivée' : 'Playlist activée');
      onRefresh();
    } catch {
      toast.error('Erreur modification');
    }
  }, [toast, onRefresh]);

  if (loading) return <div className="display-loading">Chargement des playlists…</div>;

  if (playlists.length === 0) {
    return (
      <EmptyState icon={<List size={48} strokeWidth={1} />} title="Aucune playlist" description="Créez une playlist pour organiser vos contenus d'affichage." />
    );
  }

  return (
    <div className="display-list">
      {playlists.map(pl => (
        <div key={pl.id} className={`display-list-item ${!pl.is_active ? 'inactive' : ''}`}>
          <div className="list-item-icon">
            <Play size={18} />
          </div>
          <div className="list-item-content">
            <h4>{pl.name}</h4>
            {pl.description && <p className="list-item-desc">{pl.description}</p>}
            <div className="list-item-meta">
              <span><Clock size={12} /> {pl.default_duration}s par défaut</span>
              <span>Transition : {pl.transition}</span>
              <span>{pl.item_count || 0} item(s)</span>
              <span><Monitor size={12} /> {pl.screen_count || 0} écran(s)</span>
            </div>
          </div>
          <div className="list-item-actions">
            <Tooltip content="Modifier">
              <Button variant="ghost" size="sm" iconOnly onClick={() => onEdit(pl)}>
                <Settings size={14} />
              </Button>
            </Tooltip>
            <Tooltip content={pl.is_active ? 'Désactiver' : 'Activer'}>
              <Button variant="ghost" size="sm" iconOnly onClick={() => handleToggle(pl)}>
                {pl.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              </Button>
            </Tooltip>
            {currentUser?.isAdmin && (
              <Tooltip content="Supprimer">
                <Button variant="danger" size="sm" iconOnly onClick={() => handleDelete(pl)}>
                  <Trash2 size={14} />
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
      ))}
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

export default memo(PlaylistsTab);
