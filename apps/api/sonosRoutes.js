// ═══════════════════════════════════════════════════════════════
// server/sonosRoutes.js — Routes API pour le module Sonos
// (Contrôle d'enceintes Sonos sur le réseau local via lib sonos npm)
// ═══════════════════════════════════════════════════════════════

import { execFile } from 'child_process';
import rateLimit from 'express-rate-limit';
import { promisify } from 'util';

import db from './database.js';
import logger from './logger.js';
import { optionalTvToken } from './middleware/tvAuth.js';
import { validate } from './schemas/imports.js';
import {
  sonosConfigSchema,
  sonosFavoriteSchema,
  sonosRepeatSchema,
  sonosSeekSchema,
  sonosShuffleSchema,
  sonosVolumeSchema,
} from './schemas/sonos.js';

const execFileAsync = promisify(execFile);

// ── Validation IPv4 stricte ─────────────────────────────────────
const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
function isValidIPv4(ip) {
  return typeof ip === 'string' && IPV4_RE.test(ip);
}

function isPrivateIPv4(ip) {
  if (!isValidIPv4(ip)) return false;
  return ip.startsWith('10.') || ip.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

// ── Timeout wrapper pour appels Sonos UPnP ──────────────────────
const SONOS_TIMEOUT_MS = 8000;
function withTimeout(promise, ms = SONOS_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Sonos timeout — appareil injoignable')), ms),
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
// Matching par mot-clé dans l'URI stream OU le titre du favori (case-insensitive)
const KNOWN_RADIO_LOGOS = {
  radiomeuh: '/radio-logos/radiomeuh.svg',
  fip: '/radio-logos/fip.svg',
  franceinter: '/radio-logos/franceinter.svg',
  'france inter': '/radio-logos/franceinter.svg',
  franceinfo: '/radio-logos/franceinfo.svg',
  'france info': '/radio-logos/franceinfo.svg',
  franceculture: '/radio-logos/franceculture.svg',
  'france culture': '/radio-logos/franceculture.svg',
  francemusique: '/radio-logos/francemusique.svg',
  'france musique': '/radio-logos/francemusique.svg',
  nova: '/radio-logos/nova.svg',
  'radio nova': '/radio-logos/nova.svg',
  rtl: '/radio-logos/rtl.svg',
  nrj: '/radio-logos/nrj.svg',
  nostalgie: '/radio-logos/nostalgie.svg',
  rfm: '/radio-logos/rfm.svg',
  skyrock: '/radio-logos/skyrock.svg',
  cherie: '/radio-logos/cheriefm.svg',
  chérie: '/radio-logos/cheriefm.svg',
  rmc: '/radio-logos/rmc.svg',
  'europe 1': '/radio-logos/europe1.svg',
  europe1: '/radio-logos/europe1.svg',
  'tsf jazz': '/radio-logos/tsfjazz.svg',
  tsfjazz: '/radio-logos/tsfjazz.svg',
  'jazz radio': '/radio-logos/jazzradio.svg',
  jazzradio: '/radio-logos/jazzradio.svg',
  mouv: '/radio-logos/mouv.svg',
  'oui fm': '/radio-logos/ouifm.svg',
  ouifm: '/radio-logos/ouifm.svg',
  rtl2: '/radio-logos/rtl2.svg',
  virgin: '/radio-logos/virgin.svg',
  funradio: '/radio-logos/funradio.svg',
  'fun radio': '/radio-logos/funradio.svg',
  'rire et chansons': '/radio-logos/rireetchansons.svg',
  'sud radio': '/radio-logos/sudradio.svg',
};

// ── Cache favicon radio ──
const radioFaviconCache = new Map();

/**
 * Cherche un logo local connu en matchant uri et/ou titre (case-insensitive)
 * @returns {string|null} chemin local du logo ou null
 */
function matchKnownRadioLogo(uri, title) {
  const haystack = `${(uri || '').toLowerCase()} ${(title || '').toLowerCase()}`;
  for (const [keyword, logoPath] of Object.entries(KNOWN_RADIO_LOGOS)) {
    if (haystack.includes(keyword)) return logoPath;
  }
  return null;
}

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
    const Services = sonosModule.Services || sonosModule.default?.Services;
    if (!Sonos) throw new Error('Sonos class not found in module');
    return { Sonos, Services };
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

function toSonosArtworkUrl(rawUrl, coordinatorIP) {
  if (!rawUrl) return '';

  if (rawUrl.startsWith('/radio-logos/')) return rawUrl;

  if (rawUrl.startsWith('http://')) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.port === '1400' && isPrivateIPv4(parsed.hostname)) {
        return `/api/sonos/artwork?src=${encodeURIComponent(rawUrl)}`;
      }
    } catch {
      return rawUrl;
    }
    return rawUrl;
  }

  if (rawUrl.startsWith('https://')) return rawUrl;

  if (rawUrl.startsWith('/')) {
    const sourceUrl = `http://${coordinatorIP}:1400${rawUrl}`;
    return `/api/sonos/artwork?src=${encodeURIComponent(sourceUrl)}`;
  }

  return rawUrl;
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
        const isMember = members.some((m) => m.Location && m.Location.includes(ip));
        if (isMember && group.host && group.host !== ip) {
          coordinatorIP = group.host;
          device = new Sonos(coordinatorIP);
          break;
        }
      }
    }
  } catch {
    /* ignore group discovery errors */
  }

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
  const knownLogo = matchKnownRadioLogo(streamUrl, null);
  if (knownLogo) {
    radioFaviconCache.set(streamUrl, knownLogo);
    return knownLogo;
  }

  try {
    const { stdout } = await execFileAsync('curl', [
      '-s',
      '-o',
      '/dev/null',
      '-D',
      '-',
      '-H',
      'Icy-MetaData: 1',
      '--max-time',
      '5',
      streamUrl,
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
            '-s',
            '-o',
            '/dev/null',
            '-w',
            '%{http_code} %{content_type}',
            '-L',
            '--max-time',
            '4',
            url,
          ]);
          const [code, ctype] = headOut.trim().split(' ');
          if (code === '200' && ctype && ctype.startsWith('image')) {
            radioFaviconCache.set(streamUrl, url);
            return url;
          }
        } catch {
          /* suivant */
        }
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
  let artUrl =
    track.albumArtURL ||
    (track.albumArtURI ? `http://${coordinatorIP}:1400${track.albumArtURI}` : '');

  const isRadio =
    track.uri &&
    (track.uri.startsWith('x-rincon-mp3radio://') ||
      track.uri.startsWith('x-sonosapi-stream:') ||
      track.uri.startsWith('x-sonosapi-hls-static:') ||
      track.uri.startsWith('aac:') ||
      track.uri.startsWith('x-rincon-stream:'));

  if (isRadio) {
    // 1) Essayer le matching local par URI + titre
    const knownLogo = matchKnownRadioLogo(track.uri, track.title);
    if (knownLogo) return knownLogo;

    // 2) Tenter le favicon ICY via le stream URL
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
      } catch {
        artUrl = '';
      }
    } else {
      artUrl = '';
    }
  }

  return toSonosArtworkUrl(artUrl, coordinatorIP);
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
  app.get('/api/sonos/artwork', optionalTvToken, sonosReadLimiter, async (req, res) => {
    try {
      const src = String(req.query?.src || '').trim();
      if (!src || src.length > 1024) {
        return res.status(400).json({ success: false, error: 'src invalide' });
      }

      let parsed;
      try {
        parsed = new URL(src);
      } catch {
        return res.status(400).json({ success: false, error: 'URL invalide' });
      }

      if (
        parsed.protocol !== 'http:' ||
        parsed.port !== '1400' ||
        !isPrivateIPv4(parsed.hostname)
      ) {
        return res.status(400).json({ success: false, error: 'Source artwork non autorisee' });
      }

      const upstream = await withTimeout(
        fetch(parsed.toString(), {
          method: 'GET',
          redirect: 'error',
          headers: { Accept: 'image/*,*/*;q=0.8' },
        }),
        5000,
      );

      if (!upstream.ok) {
        return res
          .status(upstream.status === 404 ? 404 : 502)
          .json({ success: false, error: 'Artwork indisponible' });
      }

      const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) {
        return res.status(415).json({ success: false, error: 'Format artwork invalide' });
      }

      const bytes = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).send(bytes);
    } catch (error) {
      logger.warn('Sonos artwork proxy error:', error?.message || error);
      return res.status(502).json({ success: false, error: 'Proxy artwork indisponible' });
    }
  });

  // ── Validation zone (IP) ──
  function validateZone(req, res) {
    const zone = req.params.zone;
    if (!zone || !isValidIPv4(zone)) {
      res
        .status(400)
        .json({ success: false, error: 'Zone invalide (IPv4 attendue, ex: 192.168.1.10)' });
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
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /api/sonos/config — Sauver config Sonos
  app.post(
    '/api/sonos/config',
    authenticateToken,
    requireAdmin,
    sonosCommandLimiter,
    validate(sonosConfigSchema),
    (req, res) => {
      try {
        const { sonosIP } = req.body;
        db.prepare(
          `
        INSERT INTO display_config (key, value, updated_at) VALUES ('sonosIP', ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `,
        ).run(JSON.stringify(sonosIP || ''));
        logger.info(`[Sonos] Config updated: sonosIP=${sonosIP}`, { userId: req.user?.id });
        res.json({ success: true });
      } catch (error) {
        logger.error('Sonos config save:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

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
      if (!lib)
        return res.status(503).json({ success: false, error: 'Package sonos non installé' });

      const sonosIP = getSonosIP();
      if (!sonosIP)
        return res.status(400).json({ success: false, error: 'IP Sonos non configurée' });

      const device = new lib.Sonos(sonosIP);
      const groups = await device.getAllGroups();

      const zones = (groups || []).map((g) => {
        const members = (g.ZoneGroupMember || []).map((m) => ({
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
      res.status(500).json({ success: false, error: 'Impossible de lister les zones Sonos' });
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
      if (result.error) return res.status(503).json({ success: false, error: result.error });

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
      res.status(500).json({ success: false, error: 'Erreur lecture état Sonos' });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // CONTRÔLES DE LECTURE (admin uniquement)
  // ─────────────────────────────────────────────────────────────

  // POST /api/sonos/play/:zone
  app.post(
    '/api/sonos/play/:zone',
    authenticateToken,
    requireAdmin,
    sonosCommandLimiter,
    async (req, res) => {
      const zone = validateZone(req, res);
      if (!zone) return;
      try {
        const result = await getDeviceForZone(zone);
        if (result.error) return res.status(503).json({ success: false, error: result.error });
        await result.device.play();
        logger.info(`[Sonos] Play on ${zone}`, { userId: req.user?.id });
        res.json({ success: true, action: 'play', zone });
      } catch (error) {
        logger.error(`Sonos play ${zone}:`, error);
        res.status(500).json({ success: false, error: 'Erreur commande play' });
      }
    },
  );

  // POST /api/sonos/pause/:zone
  app.post(
    '/api/sonos/pause/:zone',
    authenticateToken,
    requireAdmin,
    sonosCommandLimiter,
    async (req, res) => {
      const zone = validateZone(req, res);
      if (!zone) return;
      try {
        const result = await getDeviceForZone(zone);
        if (result.error) return res.status(503).json({ success: false, error: result.error });
        await result.device.pause();
        logger.info(`[Sonos] Pause on ${zone}`, { userId: req.user?.id });
        res.json({ success: true, action: 'pause', zone });
      } catch (error) {
        logger.error(`Sonos pause ${zone}:`, error);
        res.status(500).json({ success: false, error: 'Erreur commande pause' });
      }
    },
  );

  // POST /api/sonos/next/:zone
  app.post(
    '/api/sonos/next/:zone',
    authenticateToken,
    requireAdmin,
    sonosCommandLimiter,
    async (req, res) => {
      const zone = validateZone(req, res);
      if (!zone) return;
      try {
        const result = await getDeviceForZone(zone);
        if (result.error) return res.status(503).json({ success: false, error: result.error });
        await result.device.next();
        logger.info(`[Sonos] Next on ${zone}`, { userId: req.user?.id });
        res.json({ success: true, action: 'next', zone });
      } catch (error) {
        logger.error(`Sonos next ${zone}:`, error);
        res.status(500).json({ success: false, error: 'Erreur commande next' });
      }
    },
  );

  // POST /api/sonos/previous/:zone
  app.post(
    '/api/sonos/previous/:zone',
    authenticateToken,
    requireAdmin,
    sonosCommandLimiter,
    async (req, res) => {
      const zone = validateZone(req, res);
      if (!zone) return;
      try {
        const result = await getDeviceForZone(zone);
        if (result.error) return res.status(503).json({ success: false, error: result.error });
        await result.device.previous();
        logger.info(`[Sonos] Previous on ${zone}`, { userId: req.user?.id });
        res.json({ success: true, action: 'previous', zone });
      } catch (error) {
        logger.error(`Sonos previous ${zone}:`, error);
        res.status(500).json({ success: false, error: 'Erreur commande previous' });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────
  // VOLUME (admin uniquement)
  // ─────────────────────────────────────────────────────────────

  // POST /api/sonos/volume/:zone — body: { value: 0-100 }
  app.post(
    '/api/sonos/volume/:zone',
    authenticateToken,
    requireAdmin,
    sonosCommandLimiter,
    validate(sonosVolumeSchema),
    async (req, res) => {
      const zone = validateZone(req, res);
      if (!zone) return;
      const { value } = req.body;
      try {
        const result = await getDeviceForZone(zone);
        if (result.error) return res.status(503).json({ success: false, error: result.error });
        await result.device.setVolume(Math.round(value));
        logger.info(`[Sonos] Volume ${value} on ${zone}`, { userId: req.user?.id });
        res.json({ success: true, action: 'volume', zone, value: Math.round(value) });
      } catch (error) {
        logger.error(`Sonos volume ${zone}:`, error);
        res.status(500).json({ success: false, error: 'Erreur commande volume' });
      }
    },
  );

  // POST /api/sonos/mute/:zone
  app.post(
    '/api/sonos/mute/:zone',
    authenticateToken,
    requireAdmin,
    sonosCommandLimiter,
    async (req, res) => {
      const zone = validateZone(req, res);
      if (!zone) return;
      try {
        const result = await getDeviceForZone(zone);
        if (result.error) return res.status(503).json({ success: false, error: result.error });
        await result.device.setMuted(true);
        logger.info(`[Sonos] Mute on ${zone}`, { userId: req.user?.id });
        res.json({ success: true, action: 'mute', zone });
      } catch (error) {
        logger.error(`Sonos mute ${zone}:`, error);
        res.status(500).json({ success: false, error: 'Erreur commande mute' });
      }
    },
  );

  // POST /api/sonos/unmute/:zone
  app.post(
    '/api/sonos/unmute/:zone',
    authenticateToken,
    requireAdmin,
    sonosCommandLimiter,
    async (req, res) => {
      const zone = validateZone(req, res);
      if (!zone) return;
      try {
        const result = await getDeviceForZone(zone);
        if (result.error) return res.status(503).json({ success: false, error: result.error });
        await result.device.setMuted(false);
        logger.info(`[Sonos] Unmute on ${zone}`, { userId: req.user?.id });
        res.json({ success: true, action: 'unmute', zone });
      } catch (error) {
        logger.error(`Sonos unmute ${zone}:`, error);
        res.status(500).json({ success: false, error: 'Erreur commande unmute' });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────
  // FAVORIS / PRESETS
  // ─────────────────────────────────────────────────────────────

  // GET /api/sonos/favorites — Liste des favoris Sonos
  app.get('/api/sonos/favorites', authenticateToken, sonosReadLimiter, async (_req, res) => {
    try {
      const lib = await loadSonosLib();
      if (!lib)
        return res.status(503).json({ success: false, error: 'Package sonos non installé' });

      const sonosIP = getSonosIP();
      if (!sonosIP)
        return res.status(400).json({ success: false, error: 'IP Sonos non configurée' });

      const { device, coordinatorIP } = await getSonosDevice(lib.Sonos, sonosIP);
      const favs = await device.getFavorites();

      const items = favs?.items || [];
      const favorites = await Promise.all(
        items.map(async (f) => {
          const uri = f.uri || '';
          const title = f.title || '';
          let albumArtURI = f.albumArtURI || '';

          // Détection radio
          const isRadio =
            uri.startsWith('x-rincon-mp3radio://') ||
            uri.startsWith('x-sonosapi-stream:') ||
            uri.startsWith('x-sonosapi-hls-static:') ||
            uri.startsWith('aac:') ||
            uri.startsWith('x-rincon-stream:');

          if (isRadio) {
            // 1) Logo local connu (par URI + titre)
            const knownLogo = matchKnownRadioLogo(uri, title);
            if (knownLogo) {
              albumArtURI = knownLogo;
            } else {
              // 2) Tenter getRadioFavicon via le stream URL
              let streamUrl = uri;
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
                  if (favicon) albumArtURI = favicon;
                } catch {
                  /* garder albumArtURI d'origine */
                }
              }
            }
          } else if (albumArtURI) {
            albumArtURI = toSonosArtworkUrl(albumArtURI, coordinatorIP);
          }

          return { title, uri, albumArtURI, description: f.description || '' };
        }),
      );

      res.json({ favorites });
    } catch (error) {
      logger.error('Sonos favorites:', error);
      res.status(500).json({ success: false, error: 'Impossible de lister les favoris Sonos' });
    }
  });

  // GET /api/sonos/radio-stations — Stations radio configurées (TuneIn / My Radio Stations)
  app.get('/api/sonos/radio-stations', authenticateToken, sonosReadLimiter, async (_req, res) => {
    try {
      const lib = await loadSonosLib();
      if (!lib)
        return res.status(503).json({ success: false, error: 'Package sonos non installé' });
      const sonosIP = getSonosIP();
      if (!sonosIP)
        return res.status(400).json({ success: false, error: 'IP Sonos non configurée' });

      const { device, coordinatorIP } = await getSonosDevice(lib.Sonos, sonosIP);

      const stations = await device.getFavoritesRadioStations().catch(() => ({ items: [] }));
      const items = (stations?.items || []).map((s) => {
        let albumArtURI = s.albumArtURI || '';
        const knownLogo = matchKnownRadioLogo(s.uri || '', s.title || '');
        if (knownLogo) {
          albumArtURI = knownLogo;
        } else if (albumArtURI) {
          albumArtURI = toSonosArtworkUrl(albumArtURI, coordinatorIP);
        }
        return {
          title: s.title || '',
          uri: s.uri || '',
          albumArtURI,
        };
      });

      res.json({ stations: items });
    } catch (error) {
      logger.error('Sonos radio-stations:', error);
      res.status(500).json({ success: false, error: 'Impossible de lister les stations radio' });
    }
  });

  // GET /api/sonos/browse/:objectId — Parcourir le ContentDirectory Sonos
  // objectId exemples: "R:0/0" (radios), "SQ:" (saved queues), "A:" (music library), "FV:2" (favorites)
  app.get(
    '/api/sonos/browse/:objectId(*)',
    authenticateToken,
    sonosReadLimiter,
    async (req, res) => {
      try {
        const lib = await loadSonosLib();
        if (!lib)
          return res.status(503).json({ success: false, error: 'Package sonos non installé' });
        const sonosIP = getSonosIP();
        if (!sonosIP)
          return res.status(400).json({ success: false, error: 'IP Sonos non configurée' });

        const objectId = req.params.objectId;
        if (!objectId || objectId.length > 256) {
          return res.status(400).json({ success: false, error: 'objectId requis (max 256 car.)' });
        }

        // Les services musicaux (MS:xxx) ne sont pas browsables via ContentDirectory
        if (objectId.startsWith('MS:')) {
          return res.json({
            containers: [],
            items: [],
            total: 0,
            message:
              "Ce service est disponible sur votre Sonos. Utilisez l'application Sonos officielle pour naviguer dans son contenu.",
          });
        }

        const { device, coordinatorIP } = await getSonosDevice(lib.Sonos, sonosIP);
        const cds = device.contentDirectoryService();

        const result = await new Promise((resolve, reject) => {
          cds.Browse(
            {
              ObjectID: objectId,
              BrowseFlag: 'BrowseDirectChildren',
              Filter: '*',
              StartingIndex: 0,
              RequestedCount: 100,
              SortCriteria: '',
            },
            (err, data) => {
              if (err) reject(err);
              else resolve(data);
            },
          );
        });

        // Parse le XML DIDL-Lite retourné
        const { parseString } = await import('xml2js');
        const parsed = await new Promise((resolve, reject) => {
          parseString(result.Result, { explicitArray: false }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });

        const containers = [];
        const items = [];
        const root = parsed?.['DIDL-Lite'];
        if (!root) return res.json({ containers, items, total: 0 });

        // Conteneurs (dossiers / catégories)
        const rawContainers = root.container
          ? Array.isArray(root.container)
            ? root.container
            : [root.container]
          : [];
        for (const c of rawContainers) {
          containers.push({
            id: c.$?.id || '',
            title: c['dc:title'] || '',
            albumArtURI: c['upnp:albumArtURI'] || '',
            childCount: parseInt(c.$?.childCount, 10) || 0,
          });
        }

        // Items (morceaux / stations)
        const rawItems = root.item ? (Array.isArray(root.item) ? root.item : [root.item]) : [];
        for (const it of rawItems) {
          let albumArtURI = it['upnp:albumArtURI'] || '';
          const uri = it.res?._ || it.res || '';
          const title = it['dc:title'] || '';

          // Résoudre les logos radio
          const knownLogo = matchKnownRadioLogo(typeof uri === 'string' ? uri : '', title);
          if (knownLogo) {
            albumArtURI = knownLogo;
          } else if (albumArtURI) {
            albumArtURI = toSonosArtworkUrl(albumArtURI, coordinatorIP);
          }

          items.push({
            title,
            uri: typeof uri === 'string' ? uri : '',
            albumArtURI,
            artist: it['dc:creator'] || '',
            album: it['upnp:album'] || '',
            class: it['upnp:class'] || '',
          });
        }

        res.json({
          containers,
          items,
          total: parseInt(result.TotalMatches, 10) || containers.length + items.length,
        });
      } catch (error) {
        logger.error('Sonos browse:', error);
        res
          .status(500)
          .json({ success: false, error: 'Impossible de parcourir les sources Sonos' });
      }
    },
  );

  // GET /api/sonos/music-services — Liste des services musicaux disponibles sur le Sonos
  app.get('/api/sonos/music-services', authenticateToken, sonosReadLimiter, async (_req, res) => {
    try {
      const lib = await loadSonosLib();
      if (!lib)
        return res.status(503).json({ success: false, error: 'Package sonos non installé' });
      const sonosIP = getSonosIP();
      if (!sonosIP)
        return res.status(400).json({ success: false, error: 'IP Sonos non configurée' });

      const { device, coordinatorIP } = await getSonosDevice(lib.Sonos, sonosIP);
      const activeIP = coordinatorIP || sonosIP;

      // Sources de base toujours disponibles
      const sources = [
        { id: 'FV:2', title: 'Favoris Sonos', icon: 'star' },
        { id: 'SQ:', title: 'Playlists Sonos', icon: 'list-music' },
        { id: 'R:0/0', title: 'Radios TuneIn', icon: 'radio' },
      ];

      const { parseString } = await import('xml2js');
      const parseXmlAsync = (xml) =>
        new Promise((resolve, reject) => {
          parseString(xml, { explicitArray: false }, (err, data) =>
            err ? reject(err) : resolve(data),
          );
        });

      // Lancer les 2 enrichissements en parallèle pour réduire le temps de réponse
      const enrichMusicServices = async () => {
        const MusicServices = lib.Services?.MusicServices;
        if (!MusicServices) return;
        const ms = new MusicServices(activeIP, 1400);
        const msResult = await withTimeout(ms.ListAvailableServices({}), 5000);

        if (!msResult?.AvailableServiceDescriptorList) return;
        const parsed = await parseXmlAsync(msResult.AvailableServiceDescriptorList);
        const services = parsed?.Services?.Service;
        const serviceList = Array.isArray(services) ? services : services ? [services] : [];

        // Whitelist : services pertinents à afficher (ID → icône)
        // ListAvailableServices retourne ~90 services, on ne garde que les principaux
        const knownServices = {
          303: 'radio', // Sonos Radio
          585: 'radio', // Radio France
          266: 'radio', // Les Indés Radios
          308: 'radio', // Radio Paradise
          174: 'music', // TIDAL
          9: 'music', // Spotify
          2: 'music', // Deezer
          204: 'music', // Apple Music
          201: 'music', // Amazon Music
          284: 'music', // YouTube Music
          31: 'music', // Qobuz
          160: 'music', // SoundCloud
          212: 'server', // Plex
          239: 'book', // Audible
          233: 'podcast', // Pocket Casts
        };

        for (const svc of serviceList) {
          const attrs = svc.$ || svc;
          const name = attrs.Name || '';
          const id = attrs.Id || '';
          if (!name || !id) continue;

          const numId = parseInt(id, 10);
          const icon = knownServices[numId];
          if (!icon) continue; // service non dans la whitelist

          sources.push({
            id: `MS:${id}`,
            title: name,
            icon,
            serviceId: id,
            type: 'music-service',
          });
        }
      };

      const enrichRadioCategories = async () => {
        const cds = device.contentDirectoryService();
        const result = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), 4000);
          cds.Browse(
            {
              ObjectID: 'R:',
              BrowseFlag: 'BrowseDirectChildren',
              Filter: '*',
              StartingIndex: 0,
              RequestedCount: 100,
              SortCriteria: '',
            },
            (err, data) => {
              clearTimeout(timer);
              if (err) reject(err);
              else resolve(data);
            },
          );
        });

        const parsed = await parseXmlAsync(result.Result);
        const root = parsed?.['DIDL-Lite'];
        const rawContainers = root?.container
          ? Array.isArray(root.container)
            ? root.container
            : [root.container]
          : [];

        if (rawContainers.length > 0) {
          const idx = sources.findIndex((s) => s.id === 'R:0/0');
          if (idx >= 0) sources.splice(idx, 1);

          for (const c of rawContainers) {
            const id = c.$?.id || '';
            const title = c['dc:title'] || '';
            if (id && title) {
              sources.push({
                id,
                title,
                icon: 'radio',
                childCount: parseInt(c.$?.childCount, 10) || 0,
              });
            }
          }
        }
      };

      // Lancer les 2 enrichissements en parallèle (non-bloquant)
      const results = await Promise.allSettled([enrichMusicServices(), enrichRadioCategories()]);
      for (const r of results) {
        if (r.status === 'rejected') {
          logger.warn('Sonos music-services enrichment failed:', r.reason?.message);
        }
      }

      res.json({ sources });
    } catch (error) {
      logger.error('Sonos music-services:', error);
      res.status(500).json({ success: false, error: 'Impossible de lister les services musicaux' });
    }
  });
  // GET /api/sonos/queue — File de lecture actuelle
  app.get('/api/sonos/queue', authenticateToken, sonosReadLimiter, async (_req, res) => {
    try {
      const lib = await loadSonosLib();
      if (!lib)
        return res.status(503).json({ success: false, error: 'Package sonos non installé' });
      const sonosIP = getSonosIP();
      if (!sonosIP)
        return res.status(400).json({ success: false, error: 'IP Sonos non configurée' });

      const { device, coordinatorIP } = await getSonosDevice(lib.Sonos, sonosIP);
      const queue = await withTimeout(device.getQueue(), 8000).catch(() => null);

      if (!queue || !Array.isArray(queue)) {
        return res.json({ items: [] });
      }

      const items = queue.map((item) => ({
        title: item.title || '',
        artist: item.artist || '',
        album: item.album || '',
        albumArtURI: item.albumArtURI ? toSonosArtworkUrl(item.albumArtURI, coordinatorIP) : null,
        uri: item.uri || '',
      }));

      res.json({ items });
    } catch (error) {
      logger.error('Sonos queue:', error);
      res.status(500).json({ success: false, error: 'Impossible de récupérer la file de lecture' });
    }
  });

  app.post(
    '/api/sonos/favorite/:zone',
    authenticateToken,
    requireAdmin,
    sonosCommandLimiter,
    validate(sonosFavoriteSchema),
    async (req, res) => {
      const zone = validateZone(req, res);
      if (!zone) return;
      const { uri, title } = req.body;
      try {
        const result = await getDeviceForZone(zone);
        if (result.error) return res.status(503).json({ success: false, error: result.error });
        await result.device.setAVTransportURI(uri);
        await result.device.play();
        logger.info(`[Sonos] Play favorite "${title || uri}" on ${zone}`, { userId: req.user?.id });
        res.json({ success: true, action: 'favorite', zone, title: title || uri });
      } catch (error) {
        logger.error(`Sonos favorite ${zone}:`, error);
        res.status(500).json({ success: false, error: 'Erreur lecture favori' });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────
  // SEEK / SHUFFLE / REPEAT (admin uniquement)
  // ─────────────────────────────────────────────────────────────

  // POST /api/sonos/seek/:zone — body: { position: seconds }
  app.post(
    '/api/sonos/seek/:zone',
    authenticateToken,
    requireAdmin,
    sonosCommandLimiter,
    validate(sonosSeekSchema),
    async (req, res) => {
      const zone = validateZone(req, res);
      if (!zone) return;
      const { position } = req.body;
      try {
        const result = await getDeviceForZone(zone);
        if (result.error) return res.status(503).json({ success: false, error: result.error });
        await result.device.seek(position);
        logger.info(`[Sonos] Seek ${position}s on ${zone}`, { userId: req.user?.id });
        res.json({ success: true, action: 'seek', zone, position });
      } catch (error) {
        logger.error(`Sonos seek ${zone}:`, error);
        res.status(500).json({ success: false, error: 'Erreur commande seek' });
      }
    },
  );

  // POST /api/sonos/shuffle/:zone — body: { enabled: boolean }
  app.post(
    '/api/sonos/shuffle/:zone',
    authenticateToken,
    requireAdmin,
    sonosCommandLimiter,
    validate(sonosShuffleSchema),
    async (req, res) => {
      const zone = validateZone(req, res);
      if (!zone) return;
      const { enabled } = req.body;
      try {
        const result = await getDeviceForZone(zone);
        if (result.error) return res.status(503).json({ success: false, error: result.error });
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
        res.status(500).json({ success: false, error: 'Erreur commande shuffle' });
      }
    },
  );

  // POST /api/sonos/repeat/:zone — body: { mode: 'none' | 'all' | 'one' }
  app.post(
    '/api/sonos/repeat/:zone',
    authenticateToken,
    requireAdmin,
    sonosCommandLimiter,
    validate(sonosRepeatSchema),
    async (req, res) => {
      const zone = validateZone(req, res);
      if (!zone) return;
      const { mode } = req.body;
      const MODES = { none: 'NORMAL', all: 'REPEAT_ALL', one: 'REPEAT_ONE' };
      try {
        const result = await getDeviceForZone(zone);
        if (result.error) return res.status(503).json({ success: false, error: result.error });
        await result.device.setPlayMode(MODES[mode]);
        logger.info(`[Sonos] Repeat ${mode} on ${zone}`, { userId: req.user?.id });
        res.json({ success: true, action: 'repeat', zone, mode });
      } catch (error) {
        logger.error(`Sonos repeat ${zone}:`, error);
        res.status(500).json({ success: false, error: 'Erreur commande repeat' });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────
  // COMPATIBILITÉ — Anciennes routes /api/display/sonos-*
  // Redirigent vers les nouveaux endpoints
  // ─────────────────────────────────────────────────────────────

  // ── Middleware de dépréciation pour routes compat ──
  function deprecatedSonosRoute(preferred) {
    return (req, res) => {
      logger.warn(
        `⛔ ${req.method} ${req.originalUrl} (legacy) → 410 Gone — utiliser ${preferred}`,
      );
      res.set('X-Deprecated', `Use ${preferred} instead`);
      res.set('Sunset', '2026-07-01');
      res.status(410).json({
        success: false,
        error: 'Endpoint supprimé',
        code: 'DEPRECATED_ENDPOINT',
        replacement: preferred,
      });
    };
  }

  app.get(
    '/api/display/sonos-config',
    authenticateToken,
    deprecatedSonosRoute('/api/sonos/config'),
  );

  app.post(
    '/api/display/sonos-config',
    authenticateToken,
    deprecatedSonosRoute('/api/sonos/config'),
  );

  app.get(
    '/api/display/sonos-now-playing',
    optionalTvToken,
    deprecatedSonosRoute('/api/sonos/now-playing'),
  );

  // Legacy sans auth → sécurisé avec optionalTvToken + déprécié
  app.get(
    '/api/sonos-now-playing',
    optionalTvToken,
    deprecatedSonosRoute('/api/sonos/now-playing'),
  );
}
