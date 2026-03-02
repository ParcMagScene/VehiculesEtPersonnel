// ═══════════════════════════════════════════════════════════════
// SonosTab — Configuration et monitoring Sonos
// Affichage du titre en cours, et configuration IP
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { Music, Wifi, RefreshCw, Disc } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

function SonosTab({ currentUser, refreshKey }) {
  const toast = useToast();
  const [sonosIP, setSonosIP] = useState('');
  const [nowPlaying, setNowPlaying] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const intervalRef = useRef(null);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDisplaySonosConfig();
      setSonosIP(data.sonosIP || '');
    } catch {
      toast.error('Erreur chargement config Sonos');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadNowPlaying = useCallback(async () => {
    try {
      const data = await api.getDisplaySonosNowPlaying();
      setNowPlaying(data);
    } catch {
      setNowPlaying({ playing: false, error: 'Erreur de connexion' });
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig, refreshKey]);

  // Polling toutes les 5s quand activé
  useEffect(() => {
    if (polling) {
      loadNowPlaying();
      intervalRef.current = setInterval(loadNowPlaying, 5000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [polling, loadNowPlaying]);

  const handleSave = useCallback(async () => {
    try {
      await api.saveDisplaySonosConfig(sonosIP);
      toast.success('Configuration Sonos enregistrée');
    } catch {
      toast.error('Erreur enregistrement');
    }
  }, [sonosIP, toast]);

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="display-loading">Chargement config Sonos…</div>;

  return (
    <div className="dtv-sonos">
      {/* Configuration IP */}
      <div className="dtv-section">
        <h3 className="dtv-section-title">
          <Wifi size={16} /> Configuration Sonos
        </h3>
        <p className="dtv-hint">Entrez l'adresse IP de votre enceinte Sonos sur le réseau local.</p>

        <div className="dtv-form-row">
          <div className="dtv-form-group" style={{ flex: 1 }}>
            <label>Adresse IP Sonos</label>
            <input type="text" value={sonosIP} onChange={e => setSonosIP(e.target.value)}
              placeholder="192.168.1.xxx" />
          </div>
          <button className="btn-primary-sm" onClick={handleSave} style={{ alignSelf: 'flex-end' }}>
            Enregistrer
          </button>
        </div>
      </div>

      {/* Monitoring */}
      <div className="dtv-section">
        <h3 className="dtv-section-title">
          <Music size={16} /> Lecture en cours
        </h3>

        <div className="dtv-form-group dtv-toggle-row">
          <label>
            <input type="checkbox" checked={polling} onChange={e => setPolling(e.target.checked)} />
            Activer le monitoring temps réel (polling 5s)
          </label>
        </div>

        <button className="btn-secondary-sm" onClick={loadNowPlaying} style={{ marginBottom: 12 }}>
          <RefreshCw size={14} /> Rafraîchir maintenant
        </button>

        {nowPlaying && (
          <div className="dtv-sonos-widget">
            {nowPlaying.error ? (
              <div className="dtv-sonos-error">
                <Wifi size={20} />
                <span>{nowPlaying.error}</span>
              </div>
            ) : nowPlaying.playing ? (
              <div className="dtv-sonos-playing">
                {nowPlaying.albumArtURI && (
                  <img src={nowPlaying.albumArtURI} alt="Album art" className="dtv-sonos-art" />
                )}
                <div className="dtv-sonos-info">
                  <div className="dtv-sonos-title">{nowPlaying.title}</div>
                  <div className="dtv-sonos-artist">{nowPlaying.artist}</div>
                  {nowPlaying.album && <div className="dtv-sonos-album">{nowPlaying.album}</div>}
                  <div className="dtv-sonos-time">
                    {formatTime(nowPlaying.position)} / {formatTime(nowPlaying.duration)}
                  </div>
                </div>
                <div className="dtv-sonos-state">
                  <Disc size={18} className="dtv-sonos-spinning" />
                  <span>En lecture</span>
                </div>
              </div>
            ) : (
              <div className="dtv-sonos-stopped">
                <Music size={24} />
                <span>Aucune lecture en cours ({nowPlaying.state || 'arrêté'})</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(SonosTab);
