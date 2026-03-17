// PlaylistsTab — Liste et gestion des playlists
import React, { useState, useEffect, useCallback, memo } from 'react';
import { List, Play, Monitor, Clock, Trash2, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

function PlaylistsTab({ currentUser, refreshKey, onEdit, onRefresh }) {
  const toast = useToast();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleDelete = useCallback(async (playlist) => {
    if (!confirm(`Supprimer la playlist « ${playlist.name} » ?`)) return;
    try {
      await api.deleteDisplayPlaylist(playlist.id);
      toast.success('Playlist supprimée');
      onRefresh();
    } catch {
      toast.error('Erreur suppression');
    }
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
      <div className="display-empty">
        <List size={48} strokeWidth={1} />
        <h3>Aucune playlist</h3>
        <p>Créez une playlist pour organiser vos contenus d'affichage.</p>
      </div>
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
            <button className="btn-icon-sm" onClick={() => onEdit(pl)} title="Modifier">
              <Settings size={14} />
            </button>
            <button className="btn-icon-sm" onClick={() => handleToggle(pl)} title={pl.is_active ? 'Désactiver' : 'Activer'}>
              {pl.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            </button>
            {currentUser?.isAdmin && (
              <button className="btn-icon-sm danger" onClick={() => handleDelete(pl)} title="Supprimer">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default memo(PlaylistsTab);
