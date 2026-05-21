// ═══════════════════════════════════════════════════════════════
// SonosTab — Configuration, contrôles et monitoring Sonos
// Zones, lecture en cours, volume, favoris
// ═══════════════════════════════════════════════════════════════

import {
  ChevronDown,
  ChevronUp,
  Disc,
  Heart,
  Layers,
  Music,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { Button, Checkbox, InlineAlert, Input, SectionHeader } from '@/design-system';

import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

// ── Helpers ──
const formatTime = (seconds) => {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ── Sous-composant : Contrôles de lecture ──
function PlaybackControls({
  zone,
  state,
  volume,
  muted,
  position,
  duration,
  shuffleActive,
  repeatMode,
  onRefresh,
  isAdmin,
}) {
  const toast = useToast();
  const [vol, setVol] = useState(volume ?? 50);
  const [isMuted, setIsMuted] = useState(muted ?? false);
  const [seekPos, setSeekPos] = useState(position ?? 0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (volume != null) setVol(volume);
  }, [volume]);
  useEffect(() => {
    if (muted != null) setIsMuted(muted);
  }, [muted]);
  useEffect(() => {
    if (!isSeeking && position != null) setSeekPos(position);
  }, [position, isSeeking]);

  const exec = useCallback(
    async (fn, label) => {
      if (busy) return;
      setBusy(true);
      try {
        await fn();
        setTimeout(onRefresh, 400);
      } catch {
        toast.error(`Erreur ${label}`);
      } finally {
        setBusy(false);
      }
    },
    [busy, onRefresh, toast],
  );

  const nextRepeatMode = () => {
    const modes = ['none', 'all', 'one'];
    const current = modes.indexOf(repeatMode || 'none');
    return modes[(current + 1) % 3];
  };

  if (!isAdmin) return null;

  return (
    <div className="dtv-sonos-controls">
      {/* Barre de progression / seek */}
      {duration > 0 && (
        <div className="dtv-sonos-progress">
          <span className="dtv-sonos-progress-time">{formatTime(seekPos)}</span>
          <Input
            type="range"
            min={0}
            max={duration}
            value={seekPos}
            className="dtv-sonos-slider dtv-sonos-seek"
            onChange={(e) => {
              setIsSeeking(true);
              setSeekPos(Number(e.target.value));
            }}
            onMouseUp={() => {
              setIsSeeking(false);
              exec(() => api.sonosSeek(zone, seekPos), 'seek');
            }}
            onTouchEnd={() => {
              setIsSeeking(false);
              exec(() => api.sonosSeek(zone, seekPos), 'seek');
            }}
          />
          <span className="dtv-sonos-progress-time">{formatTime(duration)}</span>
        </div>
      )}
      <div className="dtv-sonos-transport">
        <button
          type="button"
          className={`dtv-sonos-btn dtv-sonos-btn-sm${shuffleActive ? ' dtv-sonos-active' : ''}`}
          onClick={() => exec(() => api.sonosShuffle(zone, !shuffleActive), 'shuffle')}
          disabled={busy}
          title="Aléatoire"
        >
          <Shuffle size={14} />
        </button>
        <button
          type="button"
          className="dtv-sonos-btn"
          onClick={() => exec(() => api.sonosPrevious(zone), 'previous')}
          disabled={busy}
          title="Précédent"
        >
          <SkipBack size={16} />
        </button>
        {state === 'playing' ? (
          <button
            type="button"
            className="dtv-sonos-btn dtv-sonos-btn-main"
            onClick={() => exec(() => api.sonosPause(zone), 'pause')}
            disabled={busy}
            title="Pause"
          >
            <Pause size={20} />
          </button>
        ) : (
          <button
            type="button"
            className="dtv-sonos-btn dtv-sonos-btn-main"
            onClick={() => exec(() => api.sonosPlay(zone), 'play')}
            disabled={busy}
            title="Lecture"
          >
            <Play size={20} />
          </button>
        )}
        <button
          type="button"
          className="dtv-sonos-btn"
          onClick={() => exec(() => api.sonosNext(zone), 'next')}
          disabled={busy}
          title="Suivant"
        >
          <SkipForward size={16} />
        </button>
        <button
          type="button"
          className={`dtv-sonos-btn dtv-sonos-btn-sm${repeatMode && repeatMode !== 'none' ? ' dtv-sonos-active' : ''}`}
          onClick={() => exec(() => api.sonosRepeat(zone, nextRepeatMode()), 'repeat')}
          disabled={busy}
          title={`Répétition : ${repeatMode || 'off'}`}
        >
          {repeatMode === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
        </button>
      </div>
      <div className="dtv-sonos-volume">
        <button
          type="button"
          className={`dtv-sonos-btn dtv-sonos-btn-sm${isMuted ? ' dtv-sonos-muted' : ''}`}
          onClick={() => {
            const fn = isMuted ? () => api.sonosUnmute(zone) : () => api.sonosMute(zone);
            setIsMuted(!isMuted);
            exec(fn, 'mute');
          }}
          disabled={busy}
          title={isMuted ? 'Réactiver le son' : 'Couper le son'}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <Input
          type="range"
          min={0}
          max={100}
          value={vol}
          className="dtv-sonos-slider"
          onChange={(e) => setVol(Number(e.target.value))}
          onMouseUp={() => exec(() => api.sonosSetVolume(zone, vol), 'volume')}
          onTouchEnd={() => exec(() => api.sonosSetVolume(zone, vol), 'volume')}
        />
        <span className="dtv-sonos-vol-label">{vol}%</span>
      </div>
    </div>
  );
}

// ── Sous-composant : Carte zone ──
function ZoneCard({ zone, isActive, onClick }) {
  return (
    <button
      type="button"
      className={`dtv-sonos-zone${isActive ? ' dtv-sonos-zone-active' : ''}`}
      onClick={() => onClick(zone.coordinator)}
    >
      <Layers size={14} />
      <span className="dtv-sonos-zone-name">{zone.name}</span>
      <span className="dtv-sonos-zone-members">
        {zone.members?.length || 1} enceinte{(zone.members?.length || 1) > 1 ? 's' : ''}
      </span>
    </button>
  );
}

// ── Sous-composant : Favoris ──
function FavoritesList({ zone, isAdmin }) {
  const toast = useToast();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getSonosFavorites();
      setFavorites(data.favorites || []);
    } catch {
      toast.error('Erreur chargement favoris');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open && favorites.length === 0) loadFavorites();
  }, [open, favorites.length, loadFavorites]);

  const playFavorite = useCallback(
    async (fav) => {
      try {
        await api.sonosPlayFavorite(zone, fav.uri, fav.title);
        toast.success(`Lecture : ${fav.title}`);
      } catch {
        toast.error('Erreur lecture favori');
      }
    },
    [zone, toast],
  );

  if (!isAdmin) return null;

  return (
    <div className="dtv-sonos-favorites">
      <button
        type="button"
        className="dtv-sonos-fav-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Heart size={14} />
        <span>Favoris Sonos</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="dtv-sonos-fav-list">
          {loading ? (
            <span className="dtv-sonos-fav-empty">Chargement…</span>
          ) : favorites.length === 0 ? (
            <span className="dtv-sonos-fav-empty">Aucun favori Sonos configuré</span>
          ) : (
            favorites.map((fav, i) => (
              <button
                type="button"
                key={i}
                className="dtv-sonos-fav-item"
                onClick={() => playFavorite(fav)}
                title={`Lire : ${fav.title}`}
              >
                {fav.albumArtURI ? (
                  <img
                    src={fav.albumArtURI}
                    alt=""
                    className="dtv-sonos-fav-art"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <Music size={14} />
                )}
                <span className="dtv-sonos-fav-title">{fav.title}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Composant principal
// ══════════════════════════════════════════════════════════════
function SonosTab({ currentUser, _currentUser, refreshKey }) {
  const toast = useToast();
  const [sonosIP, setSonosIP] = useState('');
  const [nowPlaying, setNowPlaying] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [zones, setZones] = useState([]);
  const [activeZone, setActiveZone] = useState(null);
  const [zoneState, setZoneState] = useState(null);
  const [zonesOpen, setZonesOpen] = useState(false);
  const intervalRef = useRef(null);

  const isAdmin = !!currentUser?.isAdmin || !!_currentUser?.isAdmin;

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getSonosConfig();
      setSonosIP(data.sonosIP || '');
    } catch {
      toast.error('Erreur chargement config Sonos');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadNowPlaying = useCallback(async () => {
    try {
      const data = await api.getSonosNowPlaying();
      setNowPlaying(data);
    } catch {
      setNowPlaying({ playing: false, error: 'Erreur de connexion' });
    }
  }, []);

  const loadZones = useCallback(async () => {
    try {
      const data = await api.getSonosZones();
      setZones(data.zones || []);
    } catch {
      /* zones indisponibles */
    }
  }, []);

  const loadZoneState = useCallback(async (zoneIP) => {
    if (!zoneIP) return;
    try {
      const data = await api.getSonosState(zoneIP);
      setZoneState(data);
    } catch {
      setZoneState(null);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig, refreshKey]);

  // Quand l'IP est configurée, charger les zones et activer le polling auto
  useEffect(() => {
    if (sonosIP) {
      loadZones();
      setPolling(true);
    }
  }, [sonosIP, loadZones]);

  // Polling toutes les 5s quand activé
  useEffect(() => {
    if (polling) {
      loadNowPlaying();
      if (activeZone) loadZoneState(activeZone);
      intervalRef.current = setInterval(() => {
        loadNowPlaying();
        if (activeZone) loadZoneState(activeZone);
      }, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [polling, loadNowPlaying, activeZone, loadZoneState]);

  const handleSave = useCallback(async () => {
    try {
      await api.saveSonosConfig(sonosIP);
      toast.success('Configuration Sonos enregistrée');
      if (sonosIP) loadZones();
    } catch {
      toast.error('Erreur enregistrement');
    }
  }, [sonosIP, toast, loadZones]);

  const handleZoneSelect = useCallback(
    (zoneIP) => {
      setActiveZone(zoneIP);
      loadZoneState(zoneIP);
    },
    [loadZoneState],
  );

  const handleRefresh = useCallback(() => {
    loadNowPlaying();
    if (activeZone) loadZoneState(activeZone);
  }, [loadNowPlaying, activeZone, loadZoneState]);

  if (loading) return <div className="display-loading">Chargement config Sonos…</div>;

  const displayState = activeZone && zoneState ? zoneState : nowPlaying;
  const controlZone = activeZone || sonosIP;

  return (
    <div className="dtv-sonos">
      {/* Configuration IP */}
      <div className="dtv-section">
        <SectionHeader
          className="dtv-section-title"
          icon={<Wifi size={16} />}
          title="Configuration Sonos"
        />
        <p className="dtv-hint">Entrez l'adresse IP de votre enceinte Sonos sur le réseau local.</p>
        <div className="dtv-form-row">
          <div className="dtv-form-group dtv-form-group-fill">
            <label>Adresse IP Sonos</label>
            <Input
              type="text"
              value={sonosIP}
              onChange={(e) => setSonosIP(e.target.value)}
              placeholder="192.168.1.xxx"
            />
          </div>
          <Button variant="primary" size="sm" onClick={handleSave} className="dtv-align-end">
            Enregistrer
          </Button>
        </div>
      </div>

      {/* Zones */}
      {zones.length > 0 && (
        <div className="dtv-section">
          <SectionHeader
            className="dtv-section-title"
            icon={<Layers size={16} />}
            title={`Zones (${zones.length})`}
            action={
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                className="dtv-sonos-btn dtv-sonos-btn-sm"
                aria-label={zonesOpen ? 'Masquer les zones' : 'Afficher les zones'}
                onClick={() => setZonesOpen((o) => !o)}
              >
                {zonesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </Button>
            }
          />
          {zonesOpen && (
            <div className="dtv-sonos-zones">
              {zones.map((z, i) => (
                <ZoneCard
                  key={i}
                  zone={z}
                  isActive={activeZone === z.coordinator}
                  onClick={handleZoneSelect}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Monitoring + Contrôles */}
      <div className="dtv-section">
        <SectionHeader
          className="dtv-section-title"
          icon={<Music size={16} />}
          title="Lecture en cours"
        />
        <div className="dtv-form-group dtv-toggle-row">
          <label>
            <Checkbox checked={polling} onChange={(e) => setPolling(e.target.checked)} />
            Monitoring temps réel (5s)
          </label>
        </div>
        <Button variant="secondary" size="sm" onClick={handleRefresh} className="dtv-btn-mb-sm">
          <RefreshCw size={14} /> Rafraîchir
        </Button>

        {displayState && (
          <div className="dtv-sonos-widget">
            {displayState.error ? (
              <InlineAlert>{displayState.error}</InlineAlert>
            ) : displayState.playing || displayState.state === 'paused' ? (
              <>
                <div className="dtv-sonos-playing">
                  {displayState.albumArtURI && (
                    <img
                      src={displayState.albumArtURI}
                      alt="Album art"
                      loading="lazy"
                      className="dtv-sonos-art"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="dtv-sonos-info">
                    <div className="dtv-sonos-title">{displayState.title}</div>
                    <div className="dtv-sonos-artist">{displayState.artist}</div>
                    {displayState.album && (
                      <div className="dtv-sonos-album">{displayState.album}</div>
                    )}
                    <div className="dtv-sonos-time">
                      {formatTime(displayState.position)} / {formatTime(displayState.duration)}
                    </div>
                  </div>
                  <div className="dtv-sonos-state">
                    {displayState.playing ? (
                      <>
                        <Disc size={18} className="dtv-sonos-spinning" />
                        <span>En lecture</span>
                      </>
                    ) : (
                      <>
                        <Pause size={18} />
                        <span>En pause</span>
                      </>
                    )}
                  </div>
                </div>
                <PlaybackControls
                  zone={controlZone}
                  state={displayState.state}
                  volume={displayState.volume ?? zoneState?.volume}
                  muted={displayState.muted ?? zoneState?.muted}
                  position={displayState.position}
                  duration={displayState.duration}
                  shuffleActive={displayState.shuffle}
                  repeatMode={displayState.repeat}
                  onRefresh={handleRefresh}
                  isAdmin={isAdmin}
                />
              </>
            ) : (
              <div className="dtv-sonos-stopped">
                <Music size={24} />
                <span>Aucune lecture en cours ({displayState.state || 'arrêté'})</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Favoris */}
      {sonosIP && (
        <div className="dtv-section">
          <FavoritesList zone={controlZone} isAdmin={isAdmin} />
        </div>
      )}
    </div>
  );
}

export default memo(SonosTab);
