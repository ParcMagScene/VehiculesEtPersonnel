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
const BLOCKED_RANGES = [/^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./, /^255\./];
function isBlockedIP(ip) {
  if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return true;
  return BLOCKED_RANGES.some(r => r.test(ip));
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
      } catch {}
    }
  }
  if (!process.env.VIDEO_CIPHER_KEY) {
    logger.warn('⚠️  VIDEO_CIPHER_KEY non défini — les mots de passe caméra seront perdus au redémarrage');
  }
  const key = process.env.VIDEO_CIPHER_KEY || crypto.randomBytes(32).toString('hex');
  logger.info(`🔑 Cipher key initialisée (source: ${process.env.VIDEO_CIPHER_KEY ? 'env' : 'random'})`);
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

export function storeSession(token, data) {
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
    if (!/^rtsp[s]?:\/\//.test(camera.rtsp_url)) throw new Error('rtsp_url doit commencer par rtsp:// ou rtsps://');
    return camera.rtsp_url;
  }
  if (isBlockedIP(camera.ip)) throw new Error('Adresse IP bloquée (SSRF)');
  const port = camera.rtsp_port || 554;
  const user = camera.username || 'admin';
  const pass = password || '';
  const brand = (camera.brand || '').toLowerCase();

  // Profils RTSP par marque
  let path = '/Streaming/Channels/101'; // Hikvision par défaut
  if (brand.includes('dahua') || brand.includes('amcrest')) {
    path = '/cam/realmonitor?channel=1&subtype=0';
  } else if (brand.includes('ezviz')) {
    path = '/Streaming/Channels/101';
  } else if (brand.includes('axis')) {
    path = '/axis-media/media.amp';
  } else if (brand.includes('onvif') || brand === 'generic') {
    path = '/stream1';
  }

  if (camera.stream_profile === 'sub') {
    if (brand.includes('dahua') || brand.includes('amcrest')) {
      path = '/cam/realmonitor?channel=1&subtype=1';
    } else if (brand.includes('hikvision') || brand.includes('ezviz')) {
      path = '/Streaming/Channels/102';
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
  } catch { /* ignore */ }
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
    url = `http://${ip}:${httpPort}/ISAPI/Streaming/channels/101/picture`;
  } else if (brand.includes('dahua') || brand.includes('amcrest')) {
    url = `http://${ip}:${httpPort}/cgi-bin/snapshot.cgi?channel=1`;
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
      headers: { 'Authorization': authHeader },
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
    let url, method = 'GET', body = null, headers = { 'Authorization': authHeader };

    if (brand.includes('dahua') || brand.includes('amcrest')) {
      // Dahua CGI PTZ
      const codeMap = {
        left: 'Left', right: 'Right', up: 'Up', down: 'Down',
        zoomin: 'ZoomTele', zoomout: 'ZoomWide',
        stop: 'Stop',
      };
      const code = codeMap[command] || 'Stop';
      url = `http://${ip}:${httpPort}/cgi-bin/ptz.cgi?action=start&channel=1&code=${code}&arg1=0&arg2=${speed}&arg3=0`;
    } else if (brand.includes('hikvision') || brand.includes('ezviz')) {
      // Hikvision ISAPI PTZ continuous
      method = 'PUT';
      headers['Content-Type'] = 'application/xml';
      const panSpeed = command === 'left' ? -speed * 30 : command === 'right' ? speed * 30 : 0;
      const tiltSpeed = command === 'up' ? speed * 30 : command === 'down' ? -speed * 30 : 0;
      const zoomSpeed = command === 'zoomin' ? speed * 10 : command === 'zoomout' ? -speed * 10 : 0;
      body = `<PTZData><pan>${panSpeed}</pan><tilt>${tiltSpeed}</tilt><zoom>${zoomSpeed}</zoom></PTZData>`;
      url = `http://${ip}:${httpPort}/ISAPI/PTZCtrl/channels/1/continuous`;
    } else {
      // ONVIF fallback — basic HTTP PTZ
      const codeMap = {
        left: 'left', right: 'right', up: 'up', down: 'down',
        zoomin: 'zoomin', zoomout: 'zoomout', stop: 'stop',
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
