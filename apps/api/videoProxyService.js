// ═══════════════════════════════════════════════════════════════
// videoProxyService.js — Service proxy WebRTC / RTSP / Snapshot
// Gère la communication avec MediaMTX et les caméras
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';
import logger from './logger.js';

// ── Chiffrement / déchiffrement des mots de passe caméras ──
const CIPHER_ALGO = 'aes-256-gcm';
const CIPHER_KEY = process.env.VIDEO_CIPHER_KEY || crypto.randomBytes(32).toString('hex');
const keyBuffer = Buffer.from(CIPHER_KEY.padEnd(64, '0').slice(0, 64), 'hex');

export function encryptPassword(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(CIPHER_ALGO, keyBuffer, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decryptPassword(encryptedStr) {
  if (!encryptedStr) return null;
  try {
    const [ivHex, tagHex, encrypted] = encryptedStr.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(CIPHER_ALGO, keyBuffer, iv);
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
  if (camera.rtsp_url) return camera.rtsp_url;
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

// ── Obtenir l'offre WebRTC depuis MediaMTX ──
export async function getWebRTCOffer(cameraId) {
  const streamName = `cam-${cameraId}`;
  try {
    const res = await fetch(`${MEDIAMTX_WEBRTC}/${streamName}/whep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: '', // Empty body triggers offer generation
    });
    if (!res.ok) return null;
    const sdp = await res.text();
    const location = res.headers.get('location');
    return { sdp, location, streamName };
  } catch (e) {
    logger.warn(`WebRTC offer failed for cam-${cameraId}: ${e.message}`);
    return null;
  }
}

// ── Envoyer la réponse WebRTC (WHEP answer) ──
export async function sendWebRTCAnswer(cameraId, answerSdp, sessionLocation) {
  try {
    const url = sessionLocation || `${MEDIAMTX_WEBRTC}/cam-${cameraId}/whep`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/sdp' },
      body: answerSdp,
    });
    return res.ok;
  } catch (e) {
    logger.warn(`WebRTC answer failed for cam-${cameraId}: ${e.message}`);
    return false;
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
