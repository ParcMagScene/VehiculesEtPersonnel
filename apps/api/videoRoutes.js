// ═══════════════════════════════════════════════════════════════
// MODULE SURVEILLANCE VIDÉO — eM@g
// Routes REST : cameras CRUD, WebRTC, PTZ, snapshots, logs
// ═══════════════════════════════════════════════════════════════

import db from './database.js';
import logger from './logger.js';
import {
  encryptPassword, decryptPassword,
  buildRtspUrl, registerStreamInProxy,
  whepExchange, whepDelete,
  fetchSnapshot, sendPTZCommand,
  generateSessionToken, storeSession, getSession, removeSession,
  getProxyStatus,
} from './videoProxyService.js';

// Rate limiting simple pour les flux vidéo
const streamRateMap = new Map();
const STREAM_RATE_WINDOW = 60_000; // 1 min
const STREAM_RATE_MAX = 30; // max 30 requêtes/min par user

function checkStreamRate(userId) {
  const now = Date.now();
  const key = `stream_${userId}`;
  const entry = streamRateMap.get(key);
  if (!entry || now - entry.windowStart > STREAM_RATE_WINDOW) {
    streamRateMap.set(key, { windowStart: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= STREAM_RATE_MAX;
}

// Helper log d'accès vidéo
function logVideoAccess(userId, userName, cameraId, cameraName, action, ipAddress, details = null) {
  try {
    db.prepare(`INSERT INTO video_access_logs (user_id, user_name, camera_id, camera_name, action, ip_address, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(userId, userName, cameraId, cameraName, action, ipAddress, details);
  } catch (e) {
    logger.warn('Log vidéo:', e.message);
  }
}

export function setupVideoRoutes(app, authenticateToken, requireAdmin) {

  // ════════════════════════════════════════
  // CAMERAS CRUD
  // ════════════════════════════════════════

  // GET /api/video/cameras — Liste toutes les caméras
  app.get('/api/video/cameras', authenticateToken, requireAdmin, (_req, res) => {
    try {
      const cameras = db.prepare(`
        SELECT id, name, brand, model, ip, rtsp_port, http_port, ptz_supported,
               location, affaire_id, zone, enabled, stream_profile, status,
               sort_order, notes, last_seen, created_at, updated_at
        FROM cameras ORDER BY sort_order, name
      `).all();
      // Ne jamais exposer username/password
      res.json(cameras);
    } catch (error) {
      logger.error('GET /api/video/cameras:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/video/cameras/:id
  app.get('/api/video/cameras/:id', authenticateToken, (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });
      const camera = db.prepare(`
        SELECT id, name, brand, model, ip, rtsp_url, rtsp_port, http_port,
               username, ptz_supported, location, affaire_id, zone, enabled,
               stream_profile, snapshot_path, status, sort_order, notes,
               last_seen, created_at, updated_at
        FROM cameras WHERE id = ?
      `).get(id);
      if (!camera) return res.status(404).json({ error: 'Caméra introuvable' });
      // Masquer le mot de passe, indiquer seulement s'il existe
      camera.hasPassword = !!db.prepare('SELECT password_encrypted FROM cameras WHERE id = ?').get(id)?.password_encrypted;
      res.json(camera);
    } catch (error) {
      logger.error('GET /api/video/cameras/:id:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/video/cameras — Créer une caméra
  app.post('/api/video/cameras', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, brand, model, ip, rtsp_url, rtsp_port, http_port,
              username, password, ptz_supported, location, affaire_id,
              zone, enabled, stream_profile, snapshot_path, notes } = req.body;

      if (!name || !ip) return res.status(400).json({ error: 'name et ip sont requis' });

      // Validation IP basique
      if (!/^[\d.]+$/.test(ip) && !/^[a-zA-Z0-9.-]+$/.test(ip)) {
        return res.status(400).json({ error: 'Adresse IP invalide' });
      }

      const passwordEncrypted = password ? encryptPassword(password) : null;

      const result = db.prepare(`
        INSERT INTO cameras (name, brand, model, ip, rtsp_url, rtsp_port, http_port,
          username, password_encrypted, ptz_supported, location, affaire_id, zone,
          enabled, stream_profile, snapshot_path, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name, brand || 'generic', model || null, ip, rtsp_url || null,
        rtsp_port || 554, http_port || 80, username || 'admin',
        passwordEncrypted, ptz_supported ? 1 : 0, location || null,
        affaire_id || null, zone || null, enabled !== false ? 1 : 0,
        stream_profile || 'main', snapshot_path || null, notes || null
      );

      const camera = db.prepare('SELECT * FROM cameras WHERE id = ?').get(result.lastInsertRowid);
      // Enregistrer dans le proxy si activée
      if (camera.enabled) {
        const pwd = password || '';
        const rtsp = buildRtspUrl(camera, pwd);
        registerStreamInProxy(camera.id, rtsp).catch(() => {});
      }

      logger.info(`📹 Caméra créée: ${name} (${ip})`);
      res.status(201).json({ ...camera, password_encrypted: undefined });
    } catch (error) {
      logger.error('POST /api/video/cameras:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // PUT /api/video/cameras/:id — Modifier une caméra
  app.put('/api/video/cameras/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

      const existing = db.prepare('SELECT * FROM cameras WHERE id = ?').get(id);
      if (!existing) return res.status(404).json({ error: 'Caméra introuvable' });

      const { name, brand, model, ip, rtsp_url, rtsp_port, http_port,
              username, password, ptz_supported, location, affaire_id,
              zone, enabled, stream_profile, snapshot_path, notes, sort_order } = req.body;

      // Chiffrer le nouveau mot de passe seulement s'il est fourni
      let passwordEncrypted = existing.password_encrypted;
      if (password !== undefined && password !== null && password !== '') {
        passwordEncrypted = encryptPassword(password);
      }

      db.prepare(`
        UPDATE cameras SET
          name = ?, brand = ?, model = ?, ip = ?, rtsp_url = ?, rtsp_port = ?,
          http_port = ?, username = ?, password_encrypted = ?, ptz_supported = ?,
          location = ?, affaire_id = ?, zone = ?, enabled = ?, stream_profile = ?,
          snapshot_path = ?, notes = ?, sort_order = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        name ?? existing.name, brand ?? existing.brand, model ?? existing.model,
        ip ?? existing.ip, rtsp_url ?? existing.rtsp_url, rtsp_port ?? existing.rtsp_port,
        http_port ?? existing.http_port, username ?? existing.username, passwordEncrypted,
        ptz_supported !== undefined ? (ptz_supported ? 1 : 0) : existing.ptz_supported,
        location ?? existing.location, affaire_id ?? existing.affaire_id,
        zone ?? existing.zone, enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        stream_profile ?? existing.stream_profile, snapshot_path ?? existing.snapshot_path,
        notes ?? existing.notes, sort_order ?? existing.sort_order, id
      );

      // Re-enregistrer dans le proxy
      const updated = db.prepare('SELECT * FROM cameras WHERE id = ?').get(id);
      if (updated.enabled) {
        const pwd = password || decryptPassword(passwordEncrypted) || '';
        const rtsp = buildRtspUrl(updated, pwd);
        registerStreamInProxy(id, rtsp).catch(() => {});
      }

      logger.info(`📹 Caméra modifiée: ${updated.name} (id=${id})`);
      res.json({ ...updated, password_encrypted: undefined });
    } catch (error) {
      logger.error('PUT /api/video/cameras/:id:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // DELETE /api/video/cameras/:id
  app.delete('/api/video/cameras/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

      const camera = db.prepare('SELECT name FROM cameras WHERE id = ?').get(id);
      if (!camera) return res.status(404).json({ error: 'Caméra introuvable' });

      db.prepare('DELETE FROM cameras WHERE id = ?').run(id);
      logger.info(`📹 Caméra supprimée: ${camera.name} (id=${id})`);
      res.json({ success: true });
    } catch (error) {
      logger.error('DELETE /api/video/cameras/:id:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ════════════════════════════════════════
  // WEBRTC SESSIONS (WHEP proxy)
  // ════════════════════════════════════════

  // POST /api/video/cameras/:id/whep — Négociation WHEP complète (offre client → réponse serveur)
  app.post('/api/video/cameras/:id/whep', authenticateToken, (req, res) => {
    (async () => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });
        if (!checkStreamRate(req.user.id)) return res.status(429).json({ error: 'Trop de requêtes vidéo' });

        const { sdp: clientOffer } = req.body;
        if (!clientOffer) return res.status(400).json({ error: 'SDP offer requis' });

        const camera = db.prepare('SELECT * FROM cameras WHERE id = ? AND enabled = 1').get(id);
        if (!camera) return res.status(404).json({ error: 'Caméra introuvable ou désactivée' });

        // S'assurer que le stream est enregistré dans MediaMTX
        const pwd = decryptPassword(camera.password_encrypted) || '';
        const rtspUrl = buildRtspUrl(camera, pwd);
        await registerStreamInProxy(id, rtspUrl);

        // Négociation WHEP : envoyer l'offre client, recevoir la réponse
        const result = await whepExchange(id, clientOffer);
        if (!result) return res.status(502).json({ error: 'Proxy vidéo indisponible — MediaMTX non démarré ?' });

        // Créer la session
        const token = generateSessionToken();
        storeSession(token, { cameraId: id, userId: req.user.id, location: result.location });

        db.prepare(`INSERT INTO video_sessions (camera_id, user_id, session_token, status)
          VALUES (?, ?, ?, 'active')`).run(id, req.user.id, token);

        // Mettre à jour le statut de la caméra
        db.prepare(`UPDATE cameras SET status = 'online', last_seen = datetime('now') WHERE id = ?`).run(id);

        logVideoAccess(req.user.id, req.user.name, id, camera.name, 'start_stream', req.ip);

        res.json({ answerSdp: result.answerSdp, sessionToken: token });
      } catch (error) {
        logger.error('POST whep:', error);
        res.status(500).json({ error: 'Erreur serveur' });
      }
    })();
  });

  // POST /api/video/sessions/:token/close — Fermer une session
  app.post('/api/video/sessions/:token/close', authenticateToken, (req, res) => {
    try {
      const { token } = req.params;
      const session = getSession(token);
      if (session) {
        removeSession(token);
        db.prepare(`UPDATE video_sessions SET status = 'closed', ended_at = datetime('now') WHERE session_token = ?`).run(token);
        logVideoAccess(req.user.id, req.user.name, session.cameraId, null, 'stop_stream', req.ip);
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('POST session/close:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ════════════════════════════════════════
  // PTZ
  // ════════════════════════════════════════

  // POST /api/video/cameras/:id/ptz — Commande PTZ
  app.post('/api/video/cameras/:id/ptz', authenticateToken, (req, res) => {
    (async () => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

        const { command, speed } = req.body;
        const validCommands = ['left', 'right', 'up', 'down', 'zoomin', 'zoomout', 'stop'];
        if (!validCommands.includes(command)) return res.status(400).json({ error: 'Commande PTZ invalide' });

        const camera = db.prepare('SELECT * FROM cameras WHERE id = ? AND enabled = 1').get(id);
        if (!camera) return res.status(404).json({ error: 'Caméra introuvable' });
        if (!camera.ptz_supported) return res.status(400).json({ error: 'Cette caméra ne supporte pas le PTZ' });

        const pwd = decryptPassword(camera.password_encrypted) || '';
        const ok = await sendPTZCommand(camera, pwd, command, speed || 1);

        logVideoAccess(req.user.id, req.user.name, id, camera.name, 'ptz', req.ip, command);

        res.json({ success: ok });
      } catch (error) {
        logger.error('POST ptz:', error);
        res.status(500).json({ error: 'Erreur serveur' });
      }
    })();
  });

  // ════════════════════════════════════════
  // SNAPSHOT
  // ════════════════════════════════════════

  // GET /api/video/cameras/:id/snapshot — Capture instantanée
  app.get('/api/video/cameras/:id/snapshot', authenticateToken, (req, res) => {
    (async () => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });
        if (!checkStreamRate(req.user.id)) return res.status(429).json({ error: 'Trop de requêtes' });

        const camera = db.prepare('SELECT * FROM cameras WHERE id = ? AND enabled = 1').get(id);
        if (!camera) return res.status(404).json({ error: 'Caméra introuvable' });

        const pwd = decryptPassword(camera.password_encrypted) || '';
        const snapshot = await fetchSnapshot(camera, pwd);

        if (!snapshot) return res.status(502).json({ error: 'Impossible de capturer le snapshot' });

        logVideoAccess(req.user.id, req.user.name, id, camera.name, 'snapshot', req.ip);

        res.set('Content-Type', snapshot.contentType);
        res.set('Cache-Control', 'no-cache');
        res.send(snapshot.buffer);
      } catch (error) {
        logger.error('GET snapshot:', error);
        res.status(500).json({ error: 'Erreur serveur' });
      }
    })();
  });

  // ════════════════════════════════════════
  // LOGS & ADMIN
  // ════════════════════════════════════════

  // GET /api/video/logs — Logs d'accès vidéo
  app.get('/api/video/logs', authenticateToken, requireAdmin, (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
      const offset = parseInt(req.query.offset, 10) || 0;
      const cameraId = req.query.camera_id ? parseInt(req.query.camera_id, 10) : null;

      let sql = 'SELECT * FROM video_access_logs';
      const params = [];
      if (cameraId) {
        sql += ' WHERE camera_id = ?';
        params.push(cameraId);
      }
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const logs = db.prepare(sql).all(...params);
      const total = db.prepare(
        cameraId ? 'SELECT COUNT(*) as count FROM video_access_logs WHERE camera_id = ?' : 'SELECT COUNT(*) as count FROM video_access_logs'
      ).get(...(cameraId ? [cameraId] : []));

      res.json({ logs, total: total.count, limit, offset });
    } catch (error) {
      logger.error('GET /api/video/logs:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/video/sessions — Sessions actives
  app.get('/api/video/sessions', authenticateToken, requireAdmin, (req, res) => {
    try {
      const sessions = db.prepare(`
        SELECT vs.*, c.name as camera_name
        FROM video_sessions vs
        LEFT JOIN cameras c ON c.id = vs.camera_id
        WHERE vs.status = 'active'
        ORDER BY vs.started_at DESC
      `).all();
      res.json(sessions);
    } catch (error) {
      logger.error('GET /api/video/sessions:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/video/proxy-status — Statut de MediaMTX (accessible à tous les utilisateurs authentifiés)
  app.get('/api/video/proxy-status', authenticateToken, (_req, res) => {
    (async () => {
      try {
        const status = await getProxyStatus();
        res.json(status);
      } catch (error) {
        logger.error('GET /api/video/proxy-status:', error);
        res.status(500).json({ error: 'Erreur serveur' });
      }
    })();
  });

  // POST /api/video/cameras/:id/test — Tester la connexion
  app.post('/api/video/cameras/:id/test', authenticateToken, requireAdmin, (req, res) => {
    (async () => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

        const camera = db.prepare('SELECT * FROM cameras WHERE id = ?').get(id);
        if (!camera) return res.status(404).json({ error: 'Caméra introuvable' });

        const pwd = decryptPassword(camera.password_encrypted) || '';
        const snapshot = await fetchSnapshot(camera, pwd);

        const newStatus = snapshot ? 'online' : 'error';
        db.prepare(`UPDATE cameras SET status = ?, last_seen = datetime('now') WHERE id = ?`).run(newStatus, id);

        res.json({ reachable: !!snapshot, status: newStatus });
      } catch (error) {
        logger.error('POST test:', error);
        res.status(500).json({ error: 'Erreur serveur' });
      }
    })();
  });

  // POST /api/video/cameras/test-all — Tester toutes les caméras
  app.post('/api/video/cameras/test-all', authenticateToken, requireAdmin, (_req, res) => {
    (async () => {
      try {
        const cameras = db.prepare('SELECT * FROM cameras WHERE enabled = 1').all();
        const results = [];
        for (const camera of cameras) {
          const pwd = decryptPassword(camera.password_encrypted) || '';
          const snapshot = await fetchSnapshot(camera, pwd);
          const status = snapshot ? 'online' : 'error';
          db.prepare(`UPDATE cameras SET status = ?, last_seen = datetime('now') WHERE id = ?`).run(status, camera.id);
          results.push({ id: camera.id, name: camera.name, status });
        }
        res.json(results);
      } catch (error) {
        logger.error('POST test-all:', error);
        res.status(500).json({ error: 'Erreur serveur' });
      }
    })();
  });

  // ════════════════════════════════════════
  // ROUTES TV PUBLIQUES (sans auth)
  // Pour l'écran TV : affichage passif
  // ════════════════════════════════════════

  // GET /api/video/tv/cameras — Caméras activées (pas de mot de passe)
  app.get('/api/video/tv/cameras', (_req, res) => {
    try {
      const cameras = db.prepare(
        `SELECT id, name, brand, model, location, zone, ptz_supported,
                stream_profile, status, sort_order, last_seen
         FROM cameras WHERE enabled = 1 ORDER BY sort_order ASC, name ASC`
      ).all();
      res.json(cameras);
    } catch (error) {
      logger.error('TV cameras:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/video/tv/cameras/:id/whep — WHEP public (TV)
  app.post('/api/video/tv/cameras/:id/whep', (req, res) => {
    const camera = db.prepare('SELECT * FROM cameras WHERE id = ? AND enabled = 1').get(req.params.id);
    if (!camera) return res.status(404).json({ error: 'Caméra introuvable' });

    (async () => {
      try {
        const { sdp: clientOffer } = req.body;
        if (!clientOffer) return res.status(400).json({ error: 'SDP offer requis' });

        const password = decryptPassword(camera.password_encrypted) || '';
        const rtspUrl = buildRtspUrl(camera, password);
        await registerStreamInProxy(camera.id, rtspUrl);
        const result = await whepExchange(camera.id, clientOffer);
        if (!result) return res.status(502).json({ error: 'Proxy vidéo indisponible' });
        logVideoAccess(0, 'TV-Client', camera.id, camera.name, 'start_stream', req.ip);
        res.json({ answerSdp: result.answerSdp });
      } catch (error) {
        logger.error('TV whep:', error);
        res.status(500).json({ error: 'Erreur WebRTC' });
      }
    })();
  });
}
