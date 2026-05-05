// ═══════════════════════════════════════════════════════════════
// videoProxyService.js — Service proxy WebRTC / RTSP / Snapshot
// Gère la communication avec MediaMTX et les caméras
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import logger from './logger.js';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Protection SSRF — bloquer les IPs internes sauf le LAN local ──
const BLOCKED_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^255\./,
];
// [SEC FIX] Bloque aussi IPv6 loopback et link-local
const BLOCKED_IPV6 = ['::1', '::ffff:127.0.0.1', 'fe80::', 'fc00::', 'fd00::'];
function isBlockedIP(ip) {
  if (!ip) return true;
  // Bloquer IPv6 dangereuses
  if (ip.includes(':')) return BLOCKED_IPV6.some((prefix) => ip.startsWith(prefix));
  // IPv4 : vérifier format + ranges
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return true;
  return BLOCKED_RANGES.some((r) => r.test(ip));
}

// ── Chiffrement / déchiffrement des mots de passe caméras ──
const CIPHER_ALGO = 'aes-256-gcm';
let _keyBuffer = null;

function getKeyBuffer() {
  if (_keyBuffer) return _keyBuffer;
  // Fallback : lire la clé directement depuis le fichier .env si dotenv n'a pas chargé
  if (!process.env.VIDEO_CIPHER_KEY) {
    for (const envName of ['.env.development', '.env']) {
      try {
        const content = fs.readFileSync(join(__dir, envName), 'utf8');
        const match = content.match(/^VIDEO_CIPHER_KEY=(.+)$/m);
        if (match) {
          process.env.VIDEO_CIPHER_KEY = match[1].trim();
          break;
        }
      } catch {
        /* ignored */
      }
    }
  }
  if (!process.env.VIDEO_CIPHER_KEY) {
    // [AUDIT FIX B4] En production, la clé DOIT être configurée
    if (process.env.NODE_ENV === 'production') {
      logger.error('❌ FATAL: VIDEO_CIPHER_KEY non défini en production. Configurez-la dans .env');
      logger.error(
        "   Générez une clé: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
      process.exit(1);
    }
    // En dev uniquement : générer et persister
    const generated = crypto.randomBytes(32).toString('hex');
    const envPath = join(__dir, '.env');
    try {
      try {
        fs.readFileSync(envPath, 'utf8');
      } catch {
        /* ignored */
      }
      const line = `\nVIDEO_CIPHER_KEY=${generated}\n`;
      fs.appendFileSync(envPath, line);
      process.env.VIDEO_CIPHER_KEY = generated;
      logger.info('🔑 VIDEO_CIPHER_KEY générée et sauvegardée dans .env (dev uniquement)');
    } catch (_writeErr) {
      logger.warn(
        "⚠️  VIDEO_CIPHER_KEY non défini et impossible d'écrire dans .env — les mots de passe caméra seront perdus au redémarrage",
      );
    }
  }
  const key = process.env.VIDEO_CIPHER_KEY || crypto.randomBytes(32).toString('hex');
  logger.info(
    `🔑 Cipher key initialisée (source: ${process.env.VIDEO_CIPHER_KEY ? 'env' : 'random'})`,
  );
  _keyBuffer = Buffer.from(key.padEnd(64, '0').slice(0, 64), 'hex');
  return _keyBuffer;
}

export function encryptPassword(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(CIPHER_ALGO, getKeyBuffer(), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decryptPassword(encryptedStr) {
  if (!encryptedStr) return null;
  try {
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(CIPHER_ALGO, getKeyBuffer(), iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    logger.warn('Erreur déchiffrement mot de passe caméra:', e.message);
    return null;
  }
}

// ── Configuration MediaMTX ──
const MEDIAMTX_API = process.env.MEDIAMTX_API_URL || 'http://127.0.0.1:9997';
const MEDIAMTX_WEBRTC = process.env.MEDIAMTX_WEBRTC_URL || 'http://127.0.0.1:8889';

// ── Session tokens ──
const activeSessions = new Map();

export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

const MAX_ACTIVE_SESSIONS = 500;

export function storeSession(token, data) {
  // [AUDIT FIX V4] Purger les sessions les plus anciennes si cap atteint
  if (activeSessions.size >= MAX_ACTIVE_SESSIONS) {
    let oldest = null,
      oldestKey = null;
    for (const [k, v] of activeSessions) {
      if (!oldest || v.createdAt < oldest) {
        oldest = v.createdAt;
        oldestKey = k;
      }
    }
    if (oldestKey) activeSessions.delete(oldestKey);
  }
  activeSessions.set(token, { ...data, createdAt: Date.now() });
  // Auto-expiration après 4h
  setTimeout(() => activeSessions.delete(token), 4 * 60 * 60 * 1000);
}

export function getSession(token) {
  return activeSessions.get(token) || null;
}

export function removeSession(token) {
  activeSessions.delete(token);
}

// ── Construire l'URL RTSP ──
export function buildRtspUrl(camera, password) {
  if (camera.rtsp_url) {
    if (!/^rtsp[s]?:\/\//.test(camera.rtsp_url))
      throw new Error('rtsp_url doit commencer par rtsp:// ou rtsps://');
    return camera.rtsp_url;
  }
  if (isBlockedIP(camera.ip)) throw new Error('Adresse IP bloquée (SSRF)');
  const port = camera.rtsp_port || 554;
  const user = camera.username || 'admin';
  const pass = password || '';
  const brand = (camera.brand || '').toLowerCase();

  // Profils RTSP par marque — channel configurable (défaut: 1)
  const ch = camera.channel || 1;
  let path = `/Streaming/Channels/${ch}01`; // Hikvision par défaut
  if (brand.includes('dahua') || brand.includes('amcrest')) {
    path = `/cam/realmonitor?channel=${ch}&subtype=0`;
  } else if (brand.includes('ezviz')) {
    path = `/Streaming/Channels/${ch}01`;
  } else if (brand.includes('axis')) {
    path = '/axis-media/media.amp';
  } else if (brand.includes('onvif') || brand === 'generic') {
    path = '/stream1';
  }

  if (camera.stream_profile === 'sub') {
    if (brand.includes('dahua') || brand.includes('amcrest')) {
      path = `/cam/realmonitor?channel=${ch}&subtype=1`;
    } else if (brand.includes('hikvision') || brand.includes('ezviz')) {
      path = `/Streaming/Channels/${ch}02`;
    }
  }

  return `rtsp://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${camera.ip}:${port}${path}`;
}

// ── Enregistrer une source RTSP dans MediaMTX ──
export async function registerStreamInProxy(cameraId, rtspUrl) {
  const streamName = `cam-${cameraId}`;
  try {
    // Ajouter le path dans MediaMTX via son API
    const res = await fetch(`${MEDIAMTX_API}/v3/config/paths/add/${streamName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: rtspUrl,
        sourceOnDemand: true,
        sourceOnDemandStartTimeout: '10s',
        sourceOnDemandCloseAfter: '30s',
      }),
    });
    if (!res.ok) {
      // Peut-être déjà existant, essayer PATCH
      const res2 = await fetch(`${MEDIAMTX_API}/v3/config/paths/edit/${streamName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: rtspUrl }),
      });
      if (!res2.ok) {
        logger.warn(`MediaMTX: impossible d'enregistrer cam-${cameraId}: ${res2.status}`);
        return false;
      }
    }
    logger.info(`📹 Stream cam-${cameraId} enregistré dans MediaMTX`);
    return true;
  } catch (e) {
    logger.warn(`MediaMTX non disponible pour cam-${cameraId}: ${e.message}`);
    return false;
  }
}

// ── Négociation WHEP : envoyer l'offre SDP du client, recevoir la réponse ──
export async function whepExchange(cameraId, clientOfferSdp) {
  const streamName = `cam-${cameraId}`;
  try {
    const res = await fetch(`${MEDIAMTX_WEBRTC}/${streamName}/whep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: clientOfferSdp,
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      logger.warn(`WHEP ${streamName} HTTP ${res.status}: ${errBody}`);
      return null;
    }
    const answerSdp = await res.text();
    const location = res.headers.get('location');
    return { answerSdp, location, streamName };
  } catch (e) {
    logger.warn(`WHEP exchange failed for ${streamName}: ${e.message}`);
    return null;
  }
}

// ── Fermer une session WHEP ──
export async function whepDelete(sessionLocation) {
  if (!sessionLocation) return;
  try {
    await fetch(sessionLocation, { method: 'DELETE' });
  } catch {
    /* ignore */
  }
}

// ── Snapshot via HTTP ──
export async function fetchSnapshot(camera, password) {
  const brand = (camera.brand || '').toLowerCase();
  const user = camera.username || 'admin';
  const pass = password || '';
  const ip = camera.ip;
  const httpPort = camera.http_port || 80;

  let url;
  if (camera.snapshot_path) {
    url = `http://${ip}:${httpPort}${camera.snapshot_path}`;
  } else if (brand.includes('hikvision') || brand.includes('ezviz')) {
    const ch = camera.channel || 1;
    url = `http://${ip}:${httpPort}/ISAPI/Streaming/channels/${ch}01/picture`;
  } else if (brand.includes('dahua') || brand.includes('amcrest')) {
    const ch = camera.channel || 1;
    url = `http://${ip}:${httpPort}/cgi-bin/snapshot.cgi?channel=${ch}`;
  } else if (brand.includes('axis')) {
    url = `http://${ip}:${httpPort}/axis-cgi/jpg/image.cgi`;
  } else {
    url = `http://${ip}:${httpPort}/snapshot.jpg`;
  }

  const authHeader = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      headers: { Authorization: authHeader },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return { buffer, contentType };
  } catch (e) {
    clearTimeout(timeout);
    logger.warn(`Snapshot failed for ${camera.name}: ${e.message}`);
    return null;
  }
}

// ── Commandes PTZ ──
export async function sendPTZCommand(camera, password, command, speed = 1) {
  const brand = (camera.brand || '').toLowerCase();
  const user = camera.username || 'admin';
  const pass = password || '';
  const ip = camera.ip;
  const httpPort = camera.http_port || 80;
  const authHeader = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    let url,
      method = 'GET',
      body = null,
      headers = { Authorization: authHeader };

    if (brand.includes('dahua') || brand.includes('amcrest')) {
      // Dahua CGI PTZ
      const codeMap = {
        left: 'Left',
        right: 'Right',
        up: 'Up',
        down: 'Down',
        zoomin: 'ZoomTele',
        zoomout: 'ZoomWide',
        stop: 'Stop',
      };
      const code = codeMap[command] || 'Stop';
      const ch = camera.channel || 1;
      url = `http://${ip}:${httpPort}/cgi-bin/ptz.cgi?action=start&channel=${ch}&code=${code}&arg1=0&arg2=${speed}&arg3=0`;
    } else if (brand.includes('hikvision') || brand.includes('ezviz')) {
      // Hikvision ISAPI PTZ continuous
      method = 'PUT';
      headers['Content-Type'] = 'application/xml';
      const panSpeed = command === 'left' ? -speed * 30 : command === 'right' ? speed * 30 : 0;
      const tiltSpeed = command === 'up' ? speed * 30 : command === 'down' ? -speed * 30 : 0;
      const zoomSpeed = command === 'zoomin' ? speed * 10 : command === 'zoomout' ? -speed * 10 : 0;
      body = `<PTZData><pan>${panSpeed}</pan><tilt>${tiltSpeed}</tilt><zoom>${zoomSpeed}</zoom></PTZData>`;
      const ch = camera.channel || 1;
      url = `http://${ip}:${httpPort}/ISAPI/PTZCtrl/channels/${ch}/continuous`;
    } else {
      // ONVIF fallback — basic HTTP PTZ
      const codeMap = {
        left: 'left',
        right: 'right',
        up: 'up',
        down: 'down',
        zoomin: 'zoomin',
        zoomout: 'zoomout',
        stop: 'stop',
      };
      url = `http://${ip}:${httpPort}/ptz/${codeMap[command] || 'stop'}?speed=${speed}`;
    }

    const res = await fetch(url, { method, headers, body, signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch (e) {
    clearTimeout(timeout);
    logger.warn(`PTZ command ${command} failed for ${camera.name}: ${e.message}`);
    return false;
  }
}

// ── NVR Recordings (Dahua) ──

/** Extraire le numéro de channel (1-based) depuis l'URL RTSP de la caméra */
export function extractDahuaChannel(camera) {
  if (!camera.rtsp_url) return null;
  const match = camera.rtsp_url.match(/channel=(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/** Extraire le mot de passe embarqué dans l'URL RTSP (fallback si password_encrypted est null) */
export function extractPasswordFromRtspUrl(camera) {
  if (!camera.rtsp_url) return '';
  const match = camera.rtsp_url.match(/:\/\/[^:]+:([^@]+)@/);
  return match ? decodeURIComponent(match[1]) : '';
}

/** Chercher les enregistrements NVR via l'API mediaFileFind de Dahua */
export async function searchNvrRecordings(camera, password, channel, startTime, endTime) {
  const user = camera.username || '888888';
  const auth = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
  const baseUrl = `http://${camera.ip}:${camera.http_port || 80}`;
  const ch = channel - 1; // API Dahua = channel 0-based

  // 1. Créer un finder
  const createRes = await fetch(`${baseUrl}/cgi-bin/mediaFileFind.cgi?action=factory.create`, {
    headers: { Authorization: auth },
    signal: AbortSignal.timeout(5000),
  });
  const createText = await createRes.text();
  const idMatch = createText.match(/result=(\d+)/);
  if (!idMatch) throw new Error('Impossible de créer la session de recherche NVR');
  const finderId = idMatch[1];

  try {
    // 2. Lancer la recherche
    const startEnc = encodeURIComponent(startTime);
    const endEnc = encodeURIComponent(endTime);
    const findUrl =
      `${baseUrl}/cgi-bin/mediaFileFind.cgi?action=findFile&object=${finderId}` +
      `&condition.Channel=${ch}&condition.StartTime=${startEnc}&condition.EndTime=${endEnc}` +
      `&condition.Types[0]=dav&condition.Flags[0]=Timing`;

    await fetch(findUrl, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(10000),
    });

    // 3. Récupérer les résultats par blocs de 30
    const allRecordings = [];
    let hasMore = true;
    while (hasMore) {
      const nextRes = await fetch(
        `${baseUrl}/cgi-bin/mediaFileFind.cgi?action=findNextFile&object=${finderId}&count=30`,
        { headers: { Authorization: auth }, signal: AbortSignal.timeout(5000) },
      );
      const nextText = await nextRes.text();
      const foundMatch = nextText.match(/found=(\d+)/);
      const count = foundMatch ? parseInt(foundMatch[1], 10) : 0;
      if (count === 0) {
        hasMore = false;
        break;
      }

      for (let i = 0; i < count; i++) {
        const sM = nextText.match(new RegExp(`items\\[${i}\\]\\.StartTime=(.+)`));
        const eM = nextText.match(new RegExp(`items\\[${i}\\]\\.EndTime=(.+)`));
        const lM = nextText.match(new RegExp(`items\\[${i}\\]\\.Length=(\\d+)`));
        if (sM && eM) {
          allRecordings.push({
            startTime: sM[1].trim(),
            endTime: eM[1].trim(),
            size: lM ? parseInt(lM[1].trim(), 10) : 0,
          });
        }
      }
    }

    return allRecordings;
  } finally {
    // Nettoyage
    fetch(`${baseUrl}/cgi-bin/mediaFileFind.cgi?action=close&object=${finderId}`, {
      headers: { Authorization: auth },
    }).catch(() => {});
    fetch(`${baseUrl}/cgi-bin/mediaFileFind.cgi?action=destroy&object=${finderId}`, {
      headers: { Authorization: auth },
    }).catch(() => {});
  }
}

/** Construire l'URL RTSP de playback pour une caméra Dahua/NVR */
export function buildPlaybackRtspUrl(camera, password, channel, startTime, endTime) {
  const user = camera.username || '888888';
  const pass = password || '';
  const fmt = (t) => t.replace(/[-: ]/g, '_'); // 2026-03-25 10:00:00 → 2026_03_25_10_00_00
  return (
    `rtsp://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${camera.ip}:554` +
    `/cam/playback?channel=${channel}&starttime=${fmt(startTime)}&endtime=${fmt(endTime)}`
  );
}

/** Enregistrer le stream playback dans MediaMTX (path séparé) */
export async function registerPlaybackInProxy(cameraId, rtspUrl) {
  const streamName = `playback-${cameraId}`;
  const pathConfig = {
    source: rtspUrl,
    sourceOnDemand: true,
    sourceOnDemandStartTimeout: '15s',
    sourceOnDemandCloseAfter: '60s',
  };
  try {
    // Supprimer l'ancien path (force reconnexion propre si le précédent est en erreur)
    const delRes = await fetch(`${MEDIAMTX_API}/v3/config/paths/remove/${streamName}`, {
      method: 'DELETE',
    }).catch(() => null);
    if (delRes?.ok) {
      await new Promise((r) => setTimeout(r, 500));
    }

    // Créer le path frais
    const res = await fetch(`${MEDIAMTX_API}/v3/config/paths/add/${streamName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pathConfig),
    });
    if (res.ok) {
      logger.info(`🎬 Playback ${streamName} enregistré dans MediaMTX`);
      return true;
    }

    // Si le runtime path existe encore (DELETE config ≠ runtime cleanup),
    // mettre à jour via PATCH pour changer l'URL source
    if (res.status === 400) {
      const patchRes = await fetch(`${MEDIAMTX_API}/v3/config/paths/edit/${streamName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pathConfig),
      });
      if (patchRes.ok) {
        logger.info(`🎬 Playback ${streamName} mis à jour dans MediaMTX`);
        return true;
      }
    }

    const errText = await res.text().catch(() => '');
    logger.warn(`MediaMTX: impossible d'enregistrer ${streamName}: ${res.status} ${errText}`);
    return false;
  } catch (e) {
    logger.warn(`MediaMTX non disponible pour ${streamName}: ${e.message}`);
    return false;
  }
}

/** WHEP exchange pour un stream playback */
export async function whepPlaybackExchange(cameraId, clientOfferSdp) {
  const streamName = `playback-${cameraId}`;
  try {
    const res = await fetch(`${MEDIAMTX_WEBRTC}/${streamName}/whep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: clientOfferSdp,
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      logger.warn(`WHEP playback ${streamName} HTTP ${res.status}: ${errBody}`);
      return null;
    }
    const answerSdp = await res.text();
    const location = res.headers.get('location');
    return { answerSdp, location, streamName };
  } catch (e) {
    logger.warn(`WHEP playback exchange failed for ${streamName}: ${e.message}`);
    return null;
  }
}

// ── Statut MediaMTX ──
export async function getProxyStatus() {
  try {
    const res = await fetch(`${MEDIAMTX_API}/v3/paths/list`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { running: false, paths: [] };
    const data = await res.json();
    return { running: true, paths: data.items || [] };
  } catch {
    return { running: false, paths: [] };
  }
}
