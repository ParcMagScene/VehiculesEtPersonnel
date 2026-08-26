// ═══════════════════════════════════════════════════════════════
// useSonos — Hook partagé pour la logique Sonos (desktop + mobile)
// Config, zones, playback, volume, favoris, polling
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';

import api from '../utils/api';
import { useToast } from './useToast';

const formatTime = (seconds) => {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export { formatTime };

export default function useSonos({ autoPolling = true, pollInterval = 15000 } = {}) {
  const toast = useToast();

  // ── Config ──
  const [sonosIP, setSonosIP] = useState('');
  const [configLoading, setConfigLoading] = useState(true);

  // ── Zones ──
  const [zones, setZones] = useState([]);
  const [activeZone, setActiveZone] = useState(null);
  const [zoneState, setZoneState] = useState(null);
  const [zonesOpen, setZonesOpen] = useState(false);

  // ── Now Playing ──
  const [nowPlaying, setNowPlaying] = useState(null);

  // ── Polling ──
  const [polling, setPolling] = useState(false);
  const intervalRef = useRef(null);
  const isMountedRef = useRef(true);
  const [isPageVisible, setIsPageVisible] = useState(() => document.visibilityState !== 'hidden');

  // ── Favoris ──
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  // ── Sources / Browse ──
  const [musicServices, setMusicServices] = useState([]);
  const [browseStack, setBrowseStack] = useState([]); // [{id, title}]
  const [browseData, setBrowseData] = useState(null); // { containers, items }
  const [browseLoading, setBrowseLoading] = useState(false);

  // ── Queue (file de lecture) ──
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // ── Busy lock (contrôles) ──
  const [busy, setBusy] = useState(false);

  // ── Derived ──
  const displayState = activeZone && zoneState ? zoneState : nowPlaying;
  const controlZone = activeZone || sonosIP;

  // ── Loaders ──
  const loadConfig = useCallback(async () => {
    try {
      setConfigLoading(true);
      const data = await api.getSonosConfig();
      setSonosIP(data.sonosIP || '');
    } catch {
      toast.error('Erreur chargement config Sonos');
    } finally {
      setConfigLoading(false);
    }
  }, [toast]);

  const loadNowPlaying = useCallback(async () => {
    try {
      const data = await api.getSonosNowPlaying();
      if (isMountedRef.current) setNowPlaying(data);
    } catch {
      if (isMountedRef.current) {
        setNowPlaying({ playing: false, error: 'Erreur de connexion' });
      }
    }
  }, []);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

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

  const loadFavorites = useCallback(async () => {
    setFavoritesLoading(true);
    try {
      const data = await api.getSonosFavorites();
      setFavorites(data.favorites || []);
    } catch {
      toast.error('Erreur chargement favoris');
    } finally {
      setFavoritesLoading(false);
    }
  }, [toast]);

  const loadMusicServices = useCallback(async () => {
    try {
      const data = await api.getSonosMusicServices();
      setMusicServices(data.sources || []);
    } catch {
      /* silencieux */
    }
  }, []);

  const browseSource = useCallback(
    async (objectId, title) => {
      setBrowseLoading(true);
      try {
        const data = await api.browseSonos(objectId);
        setBrowseData(data);
        setBrowseStack((prev) => [...prev, { id: objectId, title: title || objectId }]);
      } catch {
        toast.error('Erreur navigation sources');
      } finally {
        setBrowseLoading(false);
      }
    },
    [toast],
  );

  const browseBack = useCallback(async () => {
    if (browseStack.length <= 1) {
      // Retour à la liste des services
      setBrowseStack([]);
      setBrowseData(null);
      return;
    }
    const newStack = browseStack.slice(0, -1);
    const parent = newStack[newStack.length - 1];
    setBrowseLoading(true);
    try {
      const data = await api.browseSonos(parent.id);
      setBrowseData(data);
      setBrowseStack(newStack);
    } catch {
      toast.error('Erreur navigation');
    } finally {
      setBrowseLoading(false);
    }
  }, [browseStack, toast]);

  const browseReset = useCallback(() => {
    setBrowseStack([]);
    setBrowseData(null);
  }, []);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const data = await api.getSonosQueue();
      setQueue(data.items || []);
    } catch {
      /* silencieux */
    } finally {
      setQueueLoading(false);
    }
  }, []);

  // ── Init ──
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (sonosIP) {
      loadZones();
      loadMusicServices();
      loadQueue();
      if (autoPolling) setPolling(true);
    }
  }, [sonosIP, loadZones, loadMusicServices, loadQueue, autoPolling]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState !== 'hidden');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // ── Polling ──
  useEffect(() => {
    if (polling && isPageVisible) {
      loadNowPlaying();
      loadQueue();
      if (activeZone) loadZoneState(activeZone);
      intervalRef.current = setInterval(() => {
        loadNowPlaying();
        loadQueue();
        if (activeZone) loadZoneState(activeZone);
      }, pollInterval);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [polling, pollInterval, loadNowPlaying, loadQueue, activeZone, loadZoneState, isPageVisible]);

  // ── Config save ──
  const saveConfig = useCallback(async () => {
    try {
      await api.saveSonosConfig(sonosIP);
      toast.success('Configuration Sonos enregistrée');
      if (sonosIP) loadZones();
    } catch {
      toast.error('Erreur enregistrement');
    }
  }, [sonosIP, toast, loadZones]);

  // ── Zone select ──
  const handleZoneSelect = useCallback(
    (zoneIP) => {
      setActiveZone(zoneIP);
      loadZoneState(zoneIP);
    },
    [loadZoneState],
  );

  // ── Refresh ──
  const refresh = useCallback(() => {
    loadNowPlaying();
    if (activeZone) loadZoneState(activeZone);
  }, [loadNowPlaying, activeZone, loadZoneState]);

  // ── Command executor (with busy lock + auto-refresh) ──
  const exec = useCallback(
    async (fn, label) => {
      if (busy) return;
      setBusy(true);
      try {
        await fn();
        setTimeout(refresh, 400);
      } catch {
        toast.error(`Erreur ${label}`);
      } finally {
        setBusy(false);
      }
    },
    [busy, refresh, toast],
  );

  // ── Contrôles ──
  const play = useCallback(
    () => exec(() => api.sonosPlay(controlZone), 'play'),
    [exec, controlZone],
  );
  const pause = useCallback(
    () => exec(() => api.sonosPause(controlZone), 'pause'),
    [exec, controlZone],
  );
  const next = useCallback(
    () => exec(() => api.sonosNext(controlZone), 'next'),
    [exec, controlZone],
  );
  const previous = useCallback(
    () => exec(() => api.sonosPrevious(controlZone), 'previous'),
    [exec, controlZone],
  );
  const setVolume = useCallback(
    (val) => exec(() => api.sonosSetVolume(controlZone, val), 'volume'),
    [exec, controlZone],
  );
  const mute = useCallback(
    () => exec(() => api.sonosMute(controlZone), 'mute'),
    [exec, controlZone],
  );
  const unmute = useCallback(
    () => exec(() => api.sonosUnmute(controlZone), 'unmute'),
    [exec, controlZone],
  );
  const seek = useCallback(
    (pos) => exec(() => api.sonosSeek(controlZone, pos), 'seek'),
    [exec, controlZone],
  );
  const setShuffle = useCallback(
    (enabled) => exec(() => api.sonosShuffle(controlZone, enabled), 'shuffle'),
    [exec, controlZone],
  );
  const setRepeat = useCallback(
    (mode) => exec(() => api.sonosRepeat(controlZone, mode), 'repeat'),
    [exec, controlZone],
  );

  // ── Play favorite ──
  const playFavorite = useCallback(
    async (fav) => {
      try {
        await api.sonosPlayFavorite(controlZone, fav.uri, fav.title);
        toast.success(`Lecture : ${fav.title}`);
      } catch {
        toast.error('Erreur lecture favori');
      }
    },
    [controlZone, toast],
  );

  return {
    // Config
    sonosIP,
    setSonosIP,
    saveConfig,
    configLoading,
    // Zones
    zones,
    activeZone,
    setActiveZone: handleZoneSelect,
    zoneState,
    zonesOpen,
    setZonesOpen,
    // Now Playing
    nowPlaying,
    displayState,
    // Polling
    polling,
    setPolling,
    refresh,
    // Contrôles
    play,
    pause,
    next,
    previous,
    setVolume,
    mute,
    unmute,
    seek,
    setShuffle,
    setRepeat,
    busy,
    // Favoris
    favorites,
    loadFavorites,
    playFavorite,
    favoritesLoading,
    // Sources / Browse
    musicServices,
    loadMusicServices,
    browseSource,
    browseBack,
    browseReset,
    browseStack,
    browseData,
    browseLoading,
    // Queue
    queue,
    queueLoading,
    loadQueue,
    // Derived
    controlZone,
  };
}
