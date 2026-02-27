// ScreensTab — Liste et gestion des écrans d'affichage
import React, { useState, useEffect, useCallback, memo } from 'react';
import { Monitor, Wifi, WifiOff, MapPin, Settings, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

function ScreensTab({ currentUser, refreshKey, onEdit, onRefresh }) {
  const toast = useToast();
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleDelete = useCallback(async (screen) => {
    if (!confirm(`Supprimer l'écran « ${screen.name} » ?`)) return;
    try {
      await api.deleteDisplayScreen(screen.id);
      toast.success('Écran supprimé');
      onRefresh();
    } catch {
      toast.error('Erreur suppression');
    }
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

  if (loading) return <div className="display-loading">Chargement des écrans…</div>;

  if (screens.length === 0) {
    return (
      <div className="display-empty">
        <Monitor size={48} strokeWidth={1} />
        <h3>Aucun écran configuré</h3>
        <p>Ajoutez votre premier écran d'affichage dynamique pour commencer.</p>
      </div>
    );
  }

  return (
    <div className="display-screens-grid">
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
              <button className="btn-icon-sm" onClick={() => onEdit(screen)} title="Modifier">
                <Settings size={14} />
              </button>
              <button className="btn-icon-sm" onClick={() => handleToggle(screen)} title={screen.is_active ? 'Désactiver' : 'Activer'}>
                {screen.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              </button>
              <button className="btn-icon-sm danger" onClick={() => handleDelete(screen)} title="Supprimer">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default memo(ScreensTab);
