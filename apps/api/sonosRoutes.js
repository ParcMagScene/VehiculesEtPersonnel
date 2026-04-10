// ═══════════════════════════════════════════════════════════════
// server/sonosRoutes.js — Routes API pour le module Sonos
// (Contrôle d'enceintes Sonos sur le réseau local via lib sonos npm)
// ═══════════════════════════════════════════════════════════════

import { execFile } from 'child_process';
import { promisify } from 'util';
import db from './database.js';
import logger from './logger.js';
import rateLimit from 'express-rate-limit';
import { optionalTvToken } from './middleware/tvAuth.js';

const execFileAsync = promisify(execFile);

// ── Validation IPv4 stricte ─────────────────────────────────────
const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
function isValidIPv4(ip) {
  return typeof ip === 'string' && IPV4_RE.test(ip);
}

// ── Timeout wrapper pour appels Sonos UPnP ──────────────────────
const SONOS_TIMEOUT_MS = 8000;
function withTimeout(promise, ms = SONOS_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Sonos timeout — appareil injoignable')), ms)
    ),
  ]);
}

// ── Rate limiters ───────────────────────────────────────────────
const sonosReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes Sonos (lecture), réessayez dans un instant' },
});

const sonosCommandLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de commandes Sonos, réessayez dans un instant' },
});

// ── Logos locaux connus (évite la recherche favicon pour ces radios) ──
const KNOWN_RADIO_LOGOS = {
  'radiomeuh': '/display-logo/logo.png',
};

// ── Cache favicon radio ──
const radioFaviconCache = new Map();

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

/**
 * Charge dynamiquement le package sonos (import dynamique → pas de crash si absent)
 * @returns {{ Sonos: Function } | null}
 */
async function loadSonosLib() {
  try {
    const sonosModule = await import('sonos');
    const Sonos = sonosModule.Sonos || sonosModule.default?.Sonos;
    if (!Sonos) throw new Error('Sonos class not found in module');
    return { Sonos };
  } catch {
    return null;
  }
}

/**
 * Récupère l'IP Sonos configurée en BDD
 */
function getSonosIP() {
  const row = db.prepare("SELECT value FROM display_config WHERE key = 'sonosIP'").get();
  return row ? JSON.parse(row.value) : '';
}

/**
 * Crée un device Sonos et résout le coordinateur de groupe
 */
async function getSonosDevice(Sonos, ip) {
  let device = new Sonos(ip);
  let coordinatorIP = ip;

  try {
    const groups = await withTimeout(device.getAllGroups(), 6000);
    if (groups && groups.length > 0) {
      for (const group of groups) {
        const members = group.ZoneGroupMember || [];
        const isMember = members.some(m => m.Location && m.Location.includes(ip));
        if (isMember && group.host && group.host !== ip) {
          coordinatorIP = group.host;
          device = new Sonos(coordinatorIP);
          break;
        }
      }
    }
  } catch { /* ignore group discovery errors */ }

  return { device, coordinatorIP };
}

/**
 * Récupérer le favicon d'une radio via les headers ICY
 * Protection SSRF intégrée
 */
async function getRadioFavicon(streamUrl) {
  if (radioFaviconCache.has(streamUrl)) {
    return radioFaviconCache.get(streamUrl);
  }

  // Protection SSRF — bloquer appels vers services internes
  try {
    const parsedUrl = new URL(streamUrl);
    const BLOCKED_HOSTS = ['127.0.0.1', 'localhost', '0.0.0.0', '::1', '[::1]'];
    if (BLOCKED_HOSTS.includes(parsedUrl.hostname) || parsedUrl.hostname.endsWith('.local')) {
      logger.warn(`[RadioFavicon] Blocked internal URL: ${streamUrl}`);
      radioFaviconCache.set(streamUrl, null);
      return null;
    }
    const ip = parsedUrl.hostname;
    if (/^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || /^169\.254\./.test(ip)) {
      logger.warn(`[RadioFavicon] Blocked private IP: ${streamUrl}`);
      radioFaviconCache.set(streamUrl, null);
      return null;
    }
  } catch {
    radioFaviconCache.set(streamUrl, null);
    return null;
  }

  // Vérifier les logos locaux connus
  const urlLower = streamUrl.toLowerCase();
  for (const [keyword, logoPath] of Object.entries(KNOWN_RADIO_LOGOS)) {
    if (urlLower.includes(keyword)) {
      radioFaviconCache.set(streamUrl, logoPath);
      return logoPath;
    }
  }

  try {
    const { stdout } = await execFileAsync('curl', [
      '-s', '-o', '/dev/null', '-D', '-',
      '-H', 'Icy-MetaData: 1', '--max-time', '5', streamUrl,
    ]);
    const icyHeaders = {};
    for (const line of stdout.split('\n')) {
      const m = line.match(/^(icy-\w+):(.+)/i);
      if (m) icyHeaders[m[1].toLowerCase()] = m[2].trim();
    }

    let homepage = (icyHeaders['icy-url'] || '').trim();
    if (!homepage) {
      radioFaviconCache.set(streamUrl, null);
      return null;
    }
    if (!homepage.startsWith('http')) homepage = 'https://' + homepage;
    homepage = homepage.replace(/\/+$/, '');

    const bases = [homepage];
    const parsed = new URL(homepage);
    if (!parsed.hostname.startsWith('www.')) {
      bases.push(`${parsed.protocol}//www.${parsed.hostname}`);
    }

    const iconPaths = ['/apple-touch-icon.png', '/favicon.ico'];
    for (const base of bases) {
      for (const path of iconPaths) {
        try {
          const url = base + path;
          const { stdout: headOut } = await execFileAsync('curl', [
            '-s', '-o', '/dev/null', '-w', '%{http_code} %{content_type}',
            '-L', '--max-time', '4', url,
          ]);
          const [code, ctype] = headOut.trim().split(' ');
          if (code === '200' && ctype && ctype.startsWith('image')) {
            radioFaviconCache.set(streamUrl, url);
            return url;
          }
        } catch { /* suivant */ }
      }
    }

    radioFaviconCache.set(streamUrl, null);
    return null;
  } catch {
    radioFaviconCache.set(streamUrl, null);
    return null;
  }
}

/**
 * Résout l'artwork pour un morceau/radio
 */
async function resolveArtwork(track, coordinatorIP) {
  let artUrl = track.albumArtURL
    || (track.albumArtURI ? `http://${coordinatorIP}:1400${track.albumArtURI}` : '');

  const isRadio = track.uri && (
    track.uri.startsWith('x-rincon-mp3radio://') ||
    track.uri.startsWith('x-sonosapi-stream:') ||
    track.uri.startsWith('x-sonosapi-hls-static:') ||
    track.uri.startsWith('aac:') ||
    track.uri.startsWith('x-rincon-stream:')
  );

  if (isRadio) {
    let streamUrl = track.uri;
    if (streamUrl.startsWith('x-rincon-mp3radio://')) {
      streamUrl = streamUrl.replace('x-rincon-mp3radio://', '');
      if (!streamUrl.startsWith('http')) streamUrl = 'http://' + streamUrl;
    } else if (streamUrl.startsWith('aac://')) {
      streamUrl = streamUrl.replace('aac://', '');
      if (!streamUrl.startsWith('http')) streamUrl = 'http://' + streamUrl;
    } else {
      streamUrl = '';
    }
    if (streamUrl) {
      try {
        const favicon = await getRadioFavicon(streamUrl);
        artUrl = favicon || '';
      } catch { artUrl = ''; }
    } else {
      artUrl = '';
    }
  }

  return artUrl;
}

/**
 * Obtenir les infos Now Playing (gère les groupes)
 * Exporté pour que displayRoutes puisse l'appeler dans tv-state
 */
export async function getSonosNowPlaying() {
  const sonosIP = getSonosIP();
  if (!sonosIP) return { playing: false, error: 'IP Sonos non configurée' };

  const lib = await loadSonosLib();
  if (!lib) return { playing: false, error: 'Package sonos non installé' };

  const { device, coordinatorIP } = await getSonosDevice(lib.Sonos, sonosIP);

  const [track, state, volume] = await Promise.all([
    withTimeout(device.currentTrack()).catch(() => null),
    withTimeout(device.getCurrentState()).catch(() => 'stopped'),
    withTimeout(device.getVolume()).catch(() => null),
  ]);

  if (!track) return { playing: false, state };

  const artUrl = await resolveArtwork(track, coordinatorIP);

  // Centralisation du parsing radio : "Artiste - Titre" dans le champ title
  let title = track.title || '';
  let artist = track.artist || '';
  if (!artist && title.includes(' - ')) {
    const parts = title.split(' - ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  }

  return {
    playing: state === 'playing',
    state,
    title,
    artist,
    album: track.album || '',
    albumArtURI: artUrl,
    duration: track.duration || 0,
    position: track.position || 0,
    ...(typeof volume === 'number' ? { volume } : {}),
  };
}

// ══════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════

export function setupSonosRoutes(app, authenticateToken, requireAdmin) {

  // ── Validation zone (IP) ──
  function validateZone(req, res) {
    const zone = req.params.zone;
    if (!zone || !isValidIPv4(zone)) {
      res.status(400).json({ error: 'Zone invalide (IPv4 attendue, ex: 192.168.1.10)' });
      return null;
    }
    return zone;
  }

  // ── Helper: obtenir un device Sonos par zone ou IP par défaut ──
  async function getDeviceForZone(zone) {
    const lib = await loadSonosLib();
    if (!lib) return { error: 'Package sonos non installé' };
    const ip = zone || getSonosIP();
    if (!ip) return { error: 'IP Sonos non configurée' };
    try {
      const { device, coordinatorIP } = await getSonosDevice(lib.Sonos, ip);
      return { device, coordinatorIP, ip };
    } catch (err) {
      return { error: `Impossible de joindre Sonos (${ip}): ${err.message}` };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CONFIG
  // ─────────────────────────────────────────────────────────────

  // GET /api/sonos/config — Lecture config Sonos
  app.get('/api/sonos/config', authenticateToken, sonosReadLimiter, (_req, res) => {
    try {
      const sonosIP = getSonosIP();
      res.json({ sonosIP });
    } catch (error) {
      logger.error('Sonos config get:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/sonos/config — Sauver config Sonos
  app.post('/api/sonos/config', authenticateToken, requireAdmin, sonosCommandLimiter, (req, res) => {
    try {
      const { sonosIP } = req.body;
      if (sonosIP && !isValidIPv4(sonosIP)) {
        return res.status(400).json({ error: 'IPv4 invalide (ex: 192.168.1.10)' });
      }
      db.prepare(`
        INSERT INTO display_config (key, value, updated_at) VALUES ('sonosIP', ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `).run(JSON.stringify(sonosIP || ''));
      logger.info(`[Sonos] Config updated: sonosIP=${sonosIP}`, { userId: req.user?.id });
      res.json({ success: true });
    } catch (error) {
      logger.error('Sonos config save:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // NOW PLAYING (lecture seule — accessible TV + users)
  // ─────────────────────────────────────────────────────────────

  // GET /api/sonos/now-playing — Now Playing (TV-client + frontend)
  app.get('/api/sonos/now-playing', optionalTvToken, sonosReadLimiter, async (_req, res) => {
    try {
      const result = await getSonosNowPlaying();
      res.json(result);
    } catch (error) {
      const isTimeout = error.message?.includes('timeout');
      logger.error(`Sonos now-playing${isTimeout ? ' (timeout)' : ''}:`, error);
      res.json({ playing: false, error: isTimeout ? 'Sonos injoignable' : error.message });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // ZONES
  // ─────────────────────────────────────────────────────────────

  // GET /api/sonos/zones — Liste des zones/rooms réseau
  app.get('/api/sonos/zones', authenticateToken, sonosReadLimiter, async (_req, res) => {
    try {
      const lib = await loadSonosLib();
      if (!lib) return res.status(503).json({ error: 'Package sonos non installé' });

      const sonosIP = getSonosIP();
      if (!sonosIP) return res.status(400).json({ error: 'IP Sonos non configurée' });

      const device = new lib.Sonos(sonosIP);
      const groups = await device.getAllGroups();

      const zones = (groups || []).map(g => {
        const members = (g.ZoneGroupMember || []).map(m => ({
          name: m.ZoneName || m.zoneName || '',
          ip: m.Location ? m.Location.match(/\/\/([\d.]+):/)?.[1] || '' : '',
          uuid: m.UUID || '',
        }));
        return {
          name: g.Name || members[0]?.name || 'Zone inconnue',
          coordinator: g.host || members[0]?.ip || '',
          members,
          isPlaying: false, // sera enrichi par state
        };
      });

      res.json({ zones });
    } catch (error) {
      logger.error('Sonos zones:', error);
      res.status(500).json({ error: 'Impossible de lister les zones Sonos' });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // STATE (état complet d'une zone)
  // ─────────────────────────────────────────────────────────────

  // GET /api/sonos/state/:zone — État complet d'une zone
  app.get('/api/sonos/state/:zone', authenticateToken, sonosReadLimiter, async (req, res) => {
    const zone = validateZone(req, res);
    if (!zone) return;

    try {
      const result = await getDeviceForZone(zone);
      if (result.error) return res.status(503).json({ error: result.error });

      const { device, coordinatorIP } = result;

      const [track, state, volume, muted, playMode] = await Promise.all([
        withTimeout(device.currentTrack()).catch(() => null),
        withTimeout(device.getCurrentState()).catch(() => 'stopped'),
        withTimeout(device.getVolume()).catch(() => null),
        withTimeout(device.getMuted()).catch(() => null),
        withTimeout(device.getPlayMode()).catch(() => null),
      ]);

      let artUrl = '';
      if (track) {
        artUrl = await resolveArtwork(track, coordinatorIP);
      }

      // Parse playMode pour shuffle/repeat
      const shuffle = playMode ? playMode.includes('SHUFFLE') : false;
      let repeat = 'none';
      if (playMode === 'REPEAT_ALL' || playMode === 'SHUFFLE_REPEAT_ONE') repeat = 'all';
      else if (playMode === 'REPEAT_ONE') repeat = 'one';

      res.json({
        playing: state === 'playing',
        state,
        title: track?.title || '',
        artist: track?.artist || '',
        album: track?.album || '',
        albumArtURI: artUrl,
        duration: track?.duration || 0,
        position: track?.position || 0,
        volume: volume ?? null,
        muted: muted ?? null,
        shuffle,
        repeat,
        zone,
      });
    } catch (error) {
      logger.error(`Sonos state ${zone}:`, error);
      res.status(500).json({ error: 'Erreur lecture état Sonos' });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // CONTRÔLES DE LECTURE (admin uniquement)
  // ─────────────────────────────────────────────────────────────

  // POST /api/sonos/play/:zone
  app.post('/api/sonos/play/:zone', authenticateToken, requireAdmin, sonosCommandLimiter, async (req, res) => {
    const zone = validateZone(req, res);
    if (!zone) return;
    try {
      const result = await getDeviceForZone(zone);
      if (result.error) return res.status(503).json({ error: result.error });
      await result.device.play();
      logger.info(`[Sonos] Play on ${zone}`, { userId: req.user?.id });
      res.json({ success: true, action: 'play', zone });
    } catch (error) {
      logger.error(`Sonos play ${zone}:`, error);
      res.status(500).json({ error: 'Erreur commande play' });
    }
  });

  // POST /api/sonos/pause/:zone
  app.post('/api/sonos/pause/:zone', authenticateToken, requireAdmin, sonosCommandLimiter, async (req, res) => {
    const zone = validateZone(req, res);
    if (!zone) return;
    try {
      const result = await getDeviceForZone(zone);
      if (result.error) return res.status(503).json({ error: result.error });
      await result.device.pause();
      logger.info(`[Sonos] Pause on ${zone}`, { userId: req.user?.id });
      res.json({ success: true, action: 'pause', zone });
    } catch (error) {
      logger.error(`Sonos pause ${zone}:`, error);
      res.status(500).json({ error: 'Erreur commande pause' });
    }
  });

  // POST /api/sonos/next/:zone
  app.post('/api/sonos/next/:zone', authenticateToken, requireAdmin, sonosCommandLimiter, async (req, res) => {
    const zone = validateZone(req, res);
    if (!zone) return;
    try {
      const result = await getDeviceForZone(zone);
      if (result.error) return res.status(503).json({ error: result.error });
      await result.device.next();
      logger.info(`[Sonos] Next on ${zone}`, { userId: req.user?.id });
      res.json({ success: true, action: 'next', zone });
    } catch (error) {
      logger.error(`Sonos next ${zone}:`, error);
      res.status(500).json({ error: 'Erreur commande next' });
    }
  });

  // POST /api/sonos/previous/:zone
  app.post('/api/sonos/previous/:zone', authenticateToken, requireAdmin, sonosCommandLimiter, async (req, res) => {
    const zone = validateZone(req, res);
    if (!zone) return;
    try {
      const result = await getDeviceForZone(zone);
      if (result.error) return res.status(503).json({ error: result.error });
      await result.device.previous();
      logger.info(`[Sonos] Previous on ${zone}`, { userId: req.user?.id });
      res.json({ success: true, action: 'previous', zone });
    } catch (error) {
      logger.error(`Sonos previous ${zone}:`, error);
      res.status(500).json({ error: 'Erreur commande previous' });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // VOLUME (admin uniquement)
  // ─────────────────────────────────────────────────────────────

  // POST /api/sonos/volume/:zone — body: { value: 0-100 }
  app.post('/api/sonos/volume/:zone', authenticateToken, requireAdmin, sonosCommandLimiter, async (req, res) => {
    const zone = validateZone(req, res);
    if (!zone) return;
    const { value } = req.body;
    if (typeof value !== 'number' || value < 0 || value > 100) {
      return res.status(400).json({ error: 'Volume invalide (0-100 attendu)' });
    }
    try {
      const result = await getDeviceForZone(zone);
      if (result.error) return res.status(503).json({ error: result.error });
      await result.device.setVolume(Math.round(value));
      logger.info(`[Sonos] Volume ${value} on ${zone}`, { userId: req.user?.id });
      res.json({ success: true, action: 'volume', zone, value: Math.round(value) });
    } catch (error) {
      logger.error(`Sonos volume ${zone}:`, error);
      res.status(500).json({ error: 'Erreur commande volume' });
    }
  });

  // POST /api/sonos/mute/:zone
  app.post('/api/sonos/mute/:zone', authenticateToken, requireAdmin, sonosCommandLimiter, async (req, res) => {
    const zone = validateZone(req, res);
    if (!zone) return;
    try {
      const result = await getDeviceForZone(zone);
      if (result.error) return res.status(503).json({ error: result.error });
      await result.device.setMuted(true);
      logger.info(`[Sonos] Mute on ${zone}`, { userId: req.user?.id });
      res.json({ success: true, action: 'mute', zone });
    } catch (error) {
      logger.error(`Sonos mute ${zone}:`, error);
      res.status(500).json({ error: 'Erreur commande mute' });
    }
  });

  // POST /api/sonos/unmute/:zone
  app.post('/api/sonos/unmute/:zone', authenticateToken, requireAdmin, sonosCommandLimiter, async (req, res) => {
    const zone = validateZone(req, res);
    if (!zone) return;
    try {
      const result = await getDeviceForZone(zone);
      if (result.error) return res.status(503).json({ error: result.error });
      await result.device.setMuted(false);
      logger.info(`[Sonos] Unmute on ${zone}`, { userId: req.user?.id });
      res.json({ success: true, action: 'unmute', zone });
    } catch (error) {
      logger.error(`Sonos unmute ${zone}:`, error);
      res.status(500).json({ error: 'Erreur commande unmute' });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // FAVORIS / PRESETS
  // ─────────────────────────────────────────────────────────────

  // GET /api/sonos/favorites — Liste des favoris Sonos
  app.get('/api/sonos/favorites', authenticateToken, sonosReadLimiter, async (_req, res) => {
    try {
      const lib = await loadSonosLib();
      if (!lib) return res.status(503).json({ error: 'Package sonos non installé' });

      const sonosIP = getSonosIP();
      if (!sonosIP) return res.status(400).json({ error: 'IP Sonos non configurée' });

      const device = new lib.Sonos(sonosIP);
      const favs = await device.getFavorites();

      const favorites = (favs?.items || []).map(f => ({
        title: f.title || '',
        uri: f.uri || '',
        albumArtURI: f.albumArtURI || '',
        description: f.description || '',
      }));

      res.json({ favorites });
    } catch (error) {
      logger.error('Sonos favorites:', error);
      res.status(500).json({ error: 'Impossible de lister les favoris Sonos' });
    }
  });

  // POST /api/sonos/favorite/:zone — body: { uri, title? }
  app.post('/api/sonos/favorite/:zone', authenticateToken, requireAdmin, sonosCommandLimiter, async (req, res) => {
    const zone = validateZone(req, res);
    if (!zone) return;
    const { uri, title } = req.body;
    if (!uri || typeof uri !== 'string' || uri.length > 2048) {
      return res.status(400).json({ error: 'URI du favori requis (max 2048 car.)' });
    }
    if (title && (typeof title !== 'string' || title.length > 256)) {
      return res.status(400).json({ error: 'Titre invalide (max 256 car.)' });
    }
    try {
      const result = await getDeviceForZone(zone);
      if (result.error) return res.status(503).json({ error: result.error });
      await result.device.setAVTransportURI(uri);
      await result.device.play();
      logger.info(`[Sonos] Play favorite "${title || uri}" on ${zone}`, { userId: req.user?.id });
      res.json({ success: true, action: 'favorite', zone, title: title || uri });
    } catch (error) {
      logger.error(`Sonos favorite ${zone}:`, error);
      res.status(500).json({ error: 'Erreur lecture favori' });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // SEEK / SHUFFLE / REPEAT (admin uniquement)
  // ─────────────────────────────────────────────────────────────

  // POST /api/sonos/seek/:zone — body: { position: seconds }
  app.post('/api/sonos/seek/:zone', authenticateToken, requireAdmin, sonosCommandLimiter, async (req, res) => {
    const zone = validateZone(req, res);
    if (!zone) return;
    const { position } = req.body;
    if (typeof position !== 'number' || position < 0 || position > 86400) {
      return res.status(400).json({ error: 'Position invalide (0-86400 secondes)' });
    }
    try {
      const result = await getDeviceForZone(zone);
      if (result.error) return res.status(503).json({ error: result.error });
      await result.device.seek(position);
      logger.info(`[Sonos] Seek ${position}s on ${zone}`, { userId: req.user?.id });
      res.json({ success: true, action: 'seek', zone, position });
    } catch (error) {
      logger.error(`Sonos seek ${zone}:`, error);
      res.status(500).json({ error: 'Erreur commande seek' });
    }
  });

  // POST /api/sonos/shuffle/:zone — body: { enabled: boolean }
  app.post('/api/sonos/shuffle/:zone', authenticateToken, requireAdmin, sonosCommandLimiter, async (req, res) => {
    const zone = validateZone(req, res);
    if (!zone) return;
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled: boolean attendu' });
    }
    try {
      const result = await getDeviceForZone(zone);
      if (result.error) return res.status(503).json({ error: result.error });
      const mode = await result.device.getPlayMode();
      let newMode = enabled ? 'SHUFFLE' : 'NORMAL';
      if (mode === 'REPEAT_ALL' && enabled) newMode = 'SHUFFLE_REPEAT_ONE';
      else if (mode === 'SHUFFLE' && !enabled) newMode = 'NORMAL';
      else if (mode === 'SHUFFLE_NOREPEAT' && !enabled) newMode = 'NORMAL';
      await result.device.setPlayMode(newMode);
      logger.info(`[Sonos] Shuffle ${enabled} on ${zone}`, { userId: req.user?.id });
      res.json({ success: true, action: 'shuffle', zone, enabled });
    } catch (error) {
      logger.error(`Sonos shuffle ${zone}:`, error);
      res.status(500).json({ error: 'Erreur commande shuffle' });
    }
  });

  // POST /api/sonos/repeat/:zone — body: { mode: 'none' | 'all' | 'one' }
  app.post('/api/sonos/repeat/:zone', authenticateToken, requireAdmin, sonosCommandLimiter, async (req, res) => {
    const zone = validateZone(req, res);
    if (!zone) return;
    const { mode } = req.body;
    const MODES = { none: 'NORMAL', all: 'REPEAT_ALL', one: 'REPEAT_ONE' };
    if (!mode || !MODES[mode]) {
      return res.status(400).json({ error: "mode: 'none' | 'all' | 'one' attendu" });
    }
    try {
      const result = await getDeviceForZone(zone);
      if (result.error) return res.status(503).json({ error: result.error });
      await result.device.setPlayMode(MODES[mode]);
      logger.info(`[Sonos] Repeat ${mode} on ${zone}`, { userId: req.user?.id });
      res.json({ success: true, action: 'repeat', zone, mode });
    } catch (error) {
      logger.error(`Sonos repeat ${zone}:`, error);
      res.status(500).json({ error: 'Erreur commande repeat' });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // COMPATIBILITÉ — Anciennes routes /api/display/sonos-*
  // Redirigent vers les nouveaux endpoints
  // ─────────────────────────────────────────────────────────────

  // ── Middleware de dépréciation pour routes compat ──
  function deprecatedSonosRoute(preferred) {
    return (_req, res, next) => {
      res.set('X-Deprecated', `Use ${preferred} instead`);
      res.set('Sunset', '2026-07-01');
      next();
    };
  }

  app.get('/api/display/sonos-config', deprecatedSonosRoute('/api/sonos/config'), authenticateToken, sonosReadLimiter, (_req, res) => {
    try {
      res.json({ sonosIP: getSonosIP() });
    } catch (error) {
      logger.error('Compat sonos-config get:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.post('/api/display/sonos-config', deprecatedSonosRoute('/api/sonos/config'), authenticateToken, requireAdmin, sonosCommandLimiter, (req, res) => {
    try {
      const { sonosIP } = req.body;
      if (sonosIP && !isValidIPv4(sonosIP)) {
        return res.status(400).json({ error: 'IPv4 invalide' });
      }
      db.prepare(`
        INSERT INTO display_config (key, value, updated_at) VALUES ('sonosIP', ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `).run(JSON.stringify(sonosIP || ''));
      res.json({ success: true });
    } catch (error) {
      logger.error('Compat sonos-config save:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.get('/api/display/sonos-now-playing', deprecatedSonosRoute('/api/sonos/now-playing'), optionalTvToken, sonosReadLimiter, async (_req, res) => {
    try {
      const result = await getSonosNowPlaying();
      res.json(result);
    } catch (error) {
      logger.error('Compat sonos-now-playing:', error);
      res.json({ playing: false, error: error.message });
    }
  });

  // Legacy sans auth → sécurisé avec optionalTvToken + déprécié
  app.get('/api/sonos-now-playing', deprecatedSonosRoute('/api/sonos/now-playing'), optionalTvToken, sonosReadLimiter, async (_req, res) => {
    try {
      const result = await getSonosNowPlaying();
      res.json(result);
    } catch (error) {
      logger.error('Compat legacy sonos-now-playing:', error);
      res.json({ playing: false, error: error.message });
    }
  });
}
