// ═══════════════════════════════════════════════════════════════
// server/displayRoutes.js — Routes API pour le module Dashboard
// (Affichage dynamique : écrans, playlists, médias, messages, templates, logs)
// ═══════════════════════════════════════════════════════════════

import { dirname, join, extname, basename, resolve } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import { execFile } from 'child_process';
import { promisify } from 'util';
import db from './database.js';
import logger from './logger.js';
import { validate } from './schemas/imports.js';
import {
  screenSchema, screenUpdateSchema,
  playlistSchema, playlistUpdateSchema, playlistItemsSchema,
  messageSchema, messageUpdateSchema,
  templateSchema, templateUpdateSchema,
  appearanceSchema, welcomeMessagesSchema,
  sidebarConfigSchema, colorRulesSchema, locationIconRulesSchema,
  sneakyMessageSchema, eventIdSchema
} from './schemas/display.js';
import { randomBytes } from 'node:crypto';
import { uploadMedia } from './middleware/upload.js';
import { validateFileType } from './middleware/validateFileType.js';
import rateLimit from 'express-rate-limit';

// Rate limiter dédié pour les endpoints TV publics (écriture)
const tvWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes TV, réessayez dans un instant' }
});

// Validation stricte d'eventId (alphanumérique + tirets/underscores, max 200 chars)
function isValidEventId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 200 && /^[a-zA-Z0-9_\-:.]+$/.test(id);
}

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Flag en mémoire pour déclencher l'alarme sonore à distance depuis l'admin
let alarmTestTimestamp = 0;

// ── Répertoires Dashboard TV ──────────────────────────────────
const displayDataDir = join(__dirname, 'display-data');
const gifsDir = join(__dirname, '..', '..', 'public', 'display-gifs');
const logoDir = join(__dirname, '..', '..', 'public', 'display-logo');
const sneakyDir = join(__dirname, '..', '..', 'public', 'display-sneaky');
[displayDataDir, gifsDir, logoDir, sneakyDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Nettoyage titre tâche pour affichage TV (retire emojis, label section, numéro AF) ──
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u2700-\u27BF]/gu;
const SECTION_LABEL_RE = /^(Pr[eé]paration|Chargement|D[eé]part|Enl[eè]vement|Retour|R[eé]cup[eé]ration|Installation|Livraison|Montage|D[eé]montage|Prioritaires?|Secondaires?|Courses?|Divers)\s*[—–\-:]?\s*/i;

function cleanTvTitle(t) {
  // Priorité : titre édité par l'utilisateur > titre Google
  let title = (t.title || t.google_event_title || '').replace(EMOJI_RE, '').trim();
  title = title.replace(SECTION_LABEL_RE, '').trim();
  const affNum = t.affaire_num || '';
  if (affNum) {
    const digits = affNum.replace(/^AF/i, '');
    if (digits) {
      const flexDigits = digits.split('').join('\\s*');
      const pattern = new RegExp('\\bAF\\s*' + flexDigits + '\\b', 'gi');
      title = title.replace(pattern, '');
    }
  }
  title = title.replace(/\s*[—–\-]\s*(?=[—–\-]|$)/g, '').replace(/^[\s—–\-]+/, '').replace(/\s{2,}/g, ' ').trim();
  // Fallback : nom de l'affaire > client de l'événement > notes
  if (!title) title = (t.affaire_nom || '').trim() || (t.affaire_titre || '').trim() || (t.affaire_client || '').trim() || (t.event_client || '').trim() || t.notes || '-';
  // Auto-majuscule
  return title.charAt(0).toUpperCase() + title.slice(1);
}

// ── Multer : upload GIF icônes ────────────────────────────────
const gifStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, gifsDir),
  // [AUDIT FIX I6] Sanitiser le nom de fichier — empêche path traversal
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
    cb(null, safe);
  },
});
const uploadGif = multer({
  storage: gifStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/gif', 'image/png'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Seuls les fichiers GIF et PNG sont autorisés'));
  },
});

// ── Multer : upload logo ──────────────────────────────────────
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, logoDir),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `logo${ext}`);
  },
});
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont autorisées'));
  },
});

// ── Multer : upload photo furtive ─────────────────────────────
const sneakyStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, sneakyDir),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `sneaky-photo${ext}`);
  },
});
const uploadSneaky = multer({
  storage: sneakyStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont autorisées'));
  },
});

// ── Helper : lire/écrire fichier JSON config ──────────────────
function readJsonFile(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) { logger.warn('JSON read error:', e.message); }
  return fallback;
}
function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ── Helper : calcul expiration ────────────────────────────────
function computeExpiration(duration) {
  const now = new Date();
  if (duration === 'endOfDay') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  }
  if (duration === 'endOfWeek') {
    const dayOfWeek = now.getDay();
    const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 0;
    const friday = new Date(now);
    friday.setDate(friday.getDate() + daysUntilFriday);
    friday.setHours(23, 59, 59, 0);
    return friday.toISOString();
  }
  const minutes = parseInt(duration, 10) || 60;
  return new Date(now.getTime() + minutes * 60 * 1000).toISOString();
}

// ── Helper : écriture log ──────────────────────────────────────
function logAction(screenId, action, details, userId) {
  try {
    db.prepare(`
      INSERT INTO display_logs (screen_id, action, details, user_id)
      VALUES (?, ?, ?, ?)
    `).run(screenId, action, JSON.stringify(details), userId);
  } catch (e) {
    logger.warn('Display log write error:', e.message);
  }
}

import { verifyTvToken, optionalTvToken } from './middleware/tvAuth.js';
import { getSonosNowPlaying } from './sonosRoutes.js';

// ════════════════════════════════════════════════════════════════
export function setupDisplayRoutes(app, authenticateToken, requireAdmin) {

  // ─────────────────────────── ÉCRANS ───────────────────────────

  // GET /api/display/screens — Lister les écrans
  app.get('/api/display/screens', authenticateToken, (_req, res) => {
    try {
      const screens = db.prepare(`
        SELECT s.*, p.name as playlist_name
        FROM display_screens s
        LEFT JOIN display_playlists p ON p.id = s.playlist_id
        ORDER BY s.name
      `).all();
      res.json(screens);
    } catch (error) {
      logger.error('Display screens list:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/display/screens/:id — Détail d'un écran
  app.get('/api/display/screens/:id', authenticateToken, (req, res) => {
    try {
      const screen = db.prepare(`
        SELECT s.*, p.name as playlist_name
        FROM display_screens s
        LEFT JOIN display_playlists p ON p.id = s.playlist_id
        WHERE s.id = ?
      `).get(req.params.id);
      if (!screen) return res.status(404).json({ error: 'Écran introuvable' });
      res.json(screen);
    } catch (error) {
      logger.error('Display screen detail:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/display/screens — Créer un écran (admin)
  app.post('/api/display/screens', authenticateToken, requireAdmin, validate(screenSchema), (req, res) => {
    try {
      const { name, location, resolution, orientation, playlistId, config } = req.body;

      // Générer un token unique pour l'écran
      const token = randomBytes(32).toString('hex');

      const result = db.prepare(`
        INSERT INTO display_screens (name, location, resolution, orientation, playlist_id, config, token, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name,
        location || null,
        resolution || '1920x1080',
        orientation || 'landscape',
        playlistId || null,
        JSON.stringify(config || {}),
        token,
        req.user.id
      );

      logAction(result.lastInsertRowid, 'screen_created', { name }, req.user.id);

      const screen = db.prepare('SELECT * FROM display_screens WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(screen);
    } catch (error) {
      logger.error('Display screen create:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // PUT /api/display/screens/:id — Modifier un écran (admin)
  app.put('/api/display/screens/:id', authenticateToken, requireAdmin, validate(screenUpdateSchema), (req, res) => {
    try {
      const { name, location, resolution, orientation, playlistId, config, isActive } = req.body;
      const existing = db.prepare('SELECT * FROM display_screens WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Écran introuvable' });

      db.prepare(`
        UPDATE display_screens
        SET name = ?, location = ?, resolution = ?, orientation = ?,
            playlist_id = ?, config = ?, is_active = ?,
            modified_by = ?, modified_at = datetime('now')
        WHERE id = ?
      `).run(
        name ?? existing.name,
        location ?? existing.location,
        resolution ?? existing.resolution,
        orientation ?? existing.orientation,
        playlistId !== undefined ? playlistId : existing.playlist_id,
        config ? JSON.stringify(config) : existing.config,
        isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
        req.user.id,
        req.params.id
      );

      logAction(req.params.id, 'screen_updated', { name: name ?? existing.name }, req.user.id);

      const updated = db.prepare('SELECT * FROM display_screens WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (error) {
      logger.error('Display screen update:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // DELETE /api/display/screens/:id — Supprimer un écran (admin)
  app.delete('/api/display/screens/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM display_screens WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Écran introuvable' });

      db.prepare('DELETE FROM display_screens WHERE id = ?').run(req.params.id);
      logAction(null, 'screen_deleted', { id: req.params.id, name: existing.name }, req.user.id);

      res.json({ success: true });
    } catch (error) {
      logger.error('Display screen delete:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // PATCH /api/display/screens/:id/heartbeat — Heartbeat écran
  app.patch('/api/display/screens/:id/heartbeat', authenticateToken, (req, res) => {
    try {
      db.prepare(`
        UPDATE display_screens
        SET status = 'online', last_heartbeat = datetime('now')
        WHERE id = ?
      `).run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Display screen heartbeat:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ─────────────────────────── PLAYLISTS ────────────────────────

  // GET /api/display/playlists
  app.get('/api/display/playlists', authenticateToken, (_req, res) => {
    try {
      const playlists = db.prepare(`
        SELECT p.*,
          (SELECT COUNT(*) FROM display_playlist_items pi WHERE pi.playlist_id = p.id) as item_count,
          (SELECT COUNT(*) FROM display_screens s WHERE s.playlist_id = p.id) as screen_count
        FROM display_playlists p
        ORDER BY p.name
      `).all();
      res.json(playlists);
    } catch (error) {
      logger.error('Display playlists list:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/display/playlists/:id — Détail + items
  app.get('/api/display/playlists/:id', authenticateToken, (req, res) => {
    try {
      const playlist = db.prepare('SELECT * FROM display_playlists WHERE id = ?').get(req.params.id);
      if (!playlist) return res.status(404).json({ error: 'Playlist introuvable' });

      const items = db.prepare(`
        SELECT pi.*,
          CASE
            WHEN pi.item_type = 'media' THEN (SELECT dm.original_name FROM display_media dm WHERE dm.id = pi.item_id)
            WHEN pi.item_type = 'message' THEN (SELECT dmsg.title FROM display_messages dmsg WHERE dmsg.id = pi.item_id)
            WHEN pi.item_type = 'template' THEN (SELECT dt.name FROM display_templates dt WHERE dt.id = pi.item_id)
            ELSE NULL
          END as item_name
        FROM display_playlist_items pi
        WHERE pi.playlist_id = ?
        ORDER BY pi.sort_order
      `).all(req.params.id);

      res.json({ ...playlist, items });
    } catch (error) {
      logger.error('Display playlist detail:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/display/playlists (admin)
  app.post('/api/display/playlists', authenticateToken, requireAdmin, validate(playlistSchema), (req, res) => {
    try {
      const { name, description, transition, defaultDuration, items } = req.body;

      const result = db.prepare(`
        INSERT INTO display_playlists (name, description, transition, default_duration, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(name, description || null, transition || 'fade', defaultDuration || 10, req.user.id);

      const playlistId = result.lastInsertRowid;

      // Insérer les items si fournis
      if (items && Array.isArray(items)) {
        const insertItem = db.prepare(`
          INSERT INTO display_playlist_items (playlist_id, item_type, item_id, url, duration, sort_order, config)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const insertMany = db.transaction((list) => {
          list.forEach((item, idx) => {
            insertItem.run(
              playlistId,
              item.itemType || 'media',
              item.itemId || null,
              item.url || null,
              item.duration || 10,
              item.sortOrder ?? idx,
              JSON.stringify(item.config || {})
            );
          });
        });
        insertMany(items);
      }

      logAction(null, 'playlist_created', { id: playlistId, name }, req.user.id);

      const playlist = db.prepare('SELECT * FROM display_playlists WHERE id = ?').get(playlistId);
      res.status(201).json(playlist);
    } catch (error) {
      logger.error('Display playlist create:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // PUT /api/display/playlists/:id (admin)
  app.put('/api/display/playlists/:id', authenticateToken, requireAdmin, validate(playlistUpdateSchema), (req, res) => {
    try {
      const { name, description, transition, defaultDuration, isActive } = req.body;
      const existing = db.prepare('SELECT * FROM display_playlists WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Playlist introuvable' });

      db.prepare(`
        UPDATE display_playlists
        SET name = ?, description = ?, transition = ?, default_duration = ?,
            is_active = ?, modified_by = ?, modified_at = datetime('now')
        WHERE id = ?
      `).run(
        name ?? existing.name,
        description ?? existing.description,
        transition ?? existing.transition,
        defaultDuration ?? existing.default_duration,
        isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
        req.user.id,
        req.params.id
      );

      logAction(null, 'playlist_updated', { id: req.params.id, name: name ?? existing.name }, req.user.id);

      const updated = db.prepare('SELECT * FROM display_playlists WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (error) {
      logger.error('Display playlist update:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // DELETE /api/display/playlists/:id (admin)
  app.delete('/api/display/playlists/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM display_playlists WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Playlist introuvable' });

      // Dissocier les écrans liés
      db.prepare('UPDATE display_screens SET playlist_id = NULL WHERE playlist_id = ?').run(req.params.id);
      // Les items sont supprimés en cascade
      db.prepare('DELETE FROM display_playlists WHERE id = ?').run(req.params.id);

      logAction(null, 'playlist_deleted', { id: req.params.id, name: existing.name }, req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Display playlist delete:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // PUT /api/display/playlists/:id/items — Réordonner / remplacer les items (admin)
  app.put('/api/display/playlists/:id/items', authenticateToken, requireAdmin, validate(playlistItemsSchema), (req, res) => {
    try {
      const { items } = req.body;

      const existing = db.prepare('SELECT * FROM display_playlists WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Playlist introuvable' });

      const replaceItems = db.transaction(() => {
        db.prepare('DELETE FROM display_playlist_items WHERE playlist_id = ?').run(req.params.id);
        const insert = db.prepare(`
          INSERT INTO display_playlist_items (playlist_id, item_type, item_id, url, duration, sort_order, config)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        items.forEach((item, idx) => {
          insert.run(
            req.params.id,
            item.itemType || 'media',
            item.itemId || null,
            item.url || null,
            item.duration || 10,
            item.sortOrder ?? idx,
            JSON.stringify(item.config || {})
          );
        });
      });
      replaceItems();

      logAction(null, 'playlist_items_updated', { id: req.params.id, count: items.length }, req.user.id);

      // Retourner la playlist mise à jour
      const playlist = db.prepare('SELECT * FROM display_playlists WHERE id = ?').get(req.params.id);
      const updatedItems = db.prepare('SELECT * FROM display_playlist_items WHERE playlist_id = ? ORDER BY sort_order').all(req.params.id);
      res.json({ ...playlist, items: updatedItems });
    } catch (error) {
      logger.error('Display playlist items update:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ─────────────────────────── MÉDIAS ───────────────────────────

  // GET /api/display/media
  app.get('/api/display/media', authenticateToken, (req, res) => {
    try {
      const { type } = req.query;
      let query = 'SELECT * FROM display_media WHERE is_active = 1';
      const params = [];
      if (type) {
        query += ' AND media_type = ?';
        params.push(type);
      }
      query += ' ORDER BY created_at DESC';
      const media = db.prepare(query).all(...params);
      res.json(media);
    } catch (error) {
      logger.error('Display media list:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // [AUDIT FIX C1] MIME réels pour médias display
  const DISPLAY_MEDIA_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg'];
  const DISPLAY_GIF_MIMES = ['image/gif', 'image/png'];
  const DISPLAY_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  // POST /api/display/media — Upload média
  app.post('/api/display/media', authenticateToken, uploadMedia.single('file'), validateFileType(DISPLAY_MEDIA_MIMES), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

      const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
      const filePath = `/display-media/${req.file.filename}`;
      const tags = req.body.tags ? req.body.tags : '[]';

      const result = db.prepare(`
        INSERT INTO display_media (filename, original_name, file_path, mime_type, file_size, media_type, tags, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.file.filename,
        req.file.originalname,
        filePath,
        req.file.mimetype,
        req.file.size,
        mediaType,
        tags,
        req.user.id
      );

      logAction(null, 'media_uploaded', {
        id: result.lastInsertRowid,
        filename: req.file.originalname,
        type: mediaType,
        size: req.file.size,
      }, req.user.id);

      const media = db.prepare('SELECT * FROM display_media WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(media);
    } catch (error) {
      logger.error('Display media upload:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // DELETE /api/display/media/:id
  app.delete('/api/display/media/:id', authenticateToken, (req, res) => {
    try {
      const media = db.prepare('SELECT * FROM display_media WHERE id = ?').get(req.params.id);
      if (!media) return res.status(404).json({ error: 'Média introuvable' });

      // Supprimer le fichier physique
      const fullPath = join(__dirname, '..', '..', 'public', media.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      // Retirer des playlists
      db.prepare('DELETE FROM display_playlist_items WHERE item_type = ? AND item_id = ?').run('media', req.params.id);
      db.prepare('DELETE FROM display_media WHERE id = ?').run(req.params.id);

      logAction(null, 'media_deleted', { id: req.params.id, filename: media.original_name }, req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Display media delete:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ─────────────────────────── MESSAGES ─────────────────────────

  // GET /api/display/messages
  app.get('/api/display/messages', authenticateToken, (req, res) => {
    try {
      const { active } = req.query;
      let query = 'SELECT * FROM display_messages';
      const params = [];
      if (active === '1') {
        query += ' WHERE is_active = 1 AND (date_end IS NULL OR date_end >= date("now"))';
      }
      query += ' ORDER BY created_at DESC';
      const messages = db.prepare(query).all(...params);
      res.json(messages);
    } catch (error) {
      logger.error('Display messages list:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/display/messages
  app.post('/api/display/messages', authenticateToken, validate(messageSchema), (req, res) => {
    try {
      const { title, body, priority, style, templateId, dateStart, dateEnd } = req.body;

      const result = db.prepare(`
        INSERT INTO display_messages (title, body, priority, style, template_id, date_start, date_end, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        title,
        body || null,
        priority || 'normal',
        JSON.stringify(style || {}),
        templateId || null,
        dateStart || null,
        dateEnd || null,
        req.user.id
      );

      logAction(null, 'message_created', { id: result.lastInsertRowid, title }, req.user.id);

      const message = db.prepare('SELECT * FROM display_messages WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(message);
    } catch (error) {
      logger.error('Display message create:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // PUT /api/display/messages/:id
  app.put('/api/display/messages/:id', authenticateToken, validate(messageUpdateSchema), (req, res) => {
    try {
      const { title, body, priority, style, templateId, dateStart, dateEnd, isActive } = req.body;
      const existing = db.prepare('SELECT * FROM display_messages WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Message introuvable' });

      db.prepare(`
        UPDATE display_messages
        SET title = ?, body = ?, priority = ?, style = ?, template_id = ?,
            date_start = ?, date_end = ?, is_active = ?,
            modified_by = ?, modified_at = datetime('now')
        WHERE id = ?
      `).run(
        title ?? existing.title,
        body ?? existing.body,
        priority ?? existing.priority,
        style ? JSON.stringify(style) : existing.style,
        templateId !== undefined ? templateId : existing.template_id,
        dateStart !== undefined ? dateStart : existing.date_start,
        dateEnd !== undefined ? dateEnd : existing.date_end,
        isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
        req.user.id,
        req.params.id
      );

      logAction(null, 'message_updated', { id: req.params.id, title: title ?? existing.title }, req.user.id);

      const updated = db.prepare('SELECT * FROM display_messages WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (error) {
      logger.error('Display message update:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // DELETE /api/display/messages/:id
  app.delete('/api/display/messages/:id', authenticateToken, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM display_messages WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Message introuvable' });

      db.prepare('DELETE FROM display_playlist_items WHERE item_type = ? AND item_id = ?').run('message', req.params.id);
      db.prepare('DELETE FROM display_messages WHERE id = ?').run(req.params.id);

      logAction(null, 'message_deleted', { id: req.params.id, title: existing.title }, req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Display message delete:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ─────────────────────────── TEMPLATES ────────────────────────

  // GET /api/display/templates
  app.get('/api/display/templates', authenticateToken, (_req, res) => {
    try {
      const templates = db.prepare('SELECT * FROM display_templates WHERE is_active = 1 ORDER BY name').all();
      res.json(templates);
    } catch (error) {
      logger.error('Display templates list:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/display/templates
  app.post('/api/display/templates', authenticateToken, requireAdmin, validate(templateSchema), (req, res) => {
    try {
      const { name, category, description, layout } = req.body;

      const result = db.prepare(`
        INSERT INTO display_templates (name, category, description, layout, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(name, category || 'general', description || null, JSON.stringify(layout), req.user.id);

      logAction(null, 'template_created', { id: result.lastInsertRowid, name }, req.user.id);

      const template = db.prepare('SELECT * FROM display_templates WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(template);
    } catch (error) {
      logger.error('Display template create:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // PUT /api/display/templates/:id
  app.put('/api/display/templates/:id', authenticateToken, requireAdmin, validate(templateUpdateSchema), (req, res) => {
    try {
      const { name, category, description, layout, isActive } = req.body;
      const existing = db.prepare('SELECT * FROM display_templates WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Template introuvable' });

      db.prepare(`
        UPDATE display_templates
        SET name = ?, category = ?, description = ?, layout = ?, is_active = ?,
            modified_by = ?, modified_at = datetime('now')
        WHERE id = ?
      `).run(
        name ?? existing.name,
        category ?? existing.category,
        description ?? existing.description,
        layout ? JSON.stringify(layout) : existing.layout,
        isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
        req.user.id,
        req.params.id
      );

      logAction(null, 'template_updated', { id: req.params.id, name: name ?? existing.name }, req.user.id);

      const updated = db.prepare('SELECT * FROM display_templates WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (error) {
      logger.error('Display template update:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // DELETE /api/display/templates/:id (admin)
  app.delete('/api/display/templates/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM display_templates WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Template introuvable' });

      db.prepare('UPDATE display_messages SET template_id = NULL WHERE template_id = ?').run(req.params.id);
      db.prepare('DELETE FROM display_playlist_items WHERE item_type = ? AND item_id = ?').run('template', req.params.id);
      db.prepare('DELETE FROM display_templates WHERE id = ?').run(req.params.id);

      logAction(null, 'template_deleted', { id: req.params.id, name: existing.name }, req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Display template delete:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ─────────────────────────── LOGS ─────────────────────────────

  // GET /api/display/logs
  app.get('/api/display/logs', authenticateToken, (req, res) => {
    try {
      const { screenId, limit = 100, offset = 0 } = req.query;
      let query = `
        SELECT l.*, u.name as user_name, s.name as screen_name
        FROM display_logs l
        LEFT JOIN users u ON u.id = l.user_id
        LEFT JOIN display_screens s ON s.id = l.screen_id
      `;
      const params = [];
      if (screenId) {
        query += ' WHERE l.screen_id = ?';
        params.push(screenId);
      }
      query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
      params.push(Math.max(1, Math.min(parseInt(limit, 10) || 100, 1000)), Math.max(0, parseInt(offset, 10) || 0));

      const logs = db.prepare(query).all(...params);
      const total = db.prepare(
        `SELECT COUNT(*) as c FROM display_logs${screenId ? ' WHERE screen_id = ?' : ''}`
      ).get(...(screenId ? [screenId] : []));

      res.json({ logs, total: total.c });
    } catch (error) {
      logger.error('Display logs list:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ─────────────────────────── STATS ────────────────────────────

  // GET /api/display/stats
  app.get('/api/display/stats', authenticateToken, (_req, res) => {
    try {
      const screens = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN status = \'online\' THEN 1 ELSE 0 END) as online FROM display_screens WHERE is_active = 1').get();
      const playlists = db.prepare('SELECT COUNT(*) as total FROM display_playlists WHERE is_active = 1').get();
      const media = db.prepare('SELECT COUNT(*) as total, SUM(file_size) as totalSize FROM display_media WHERE is_active = 1').get();
      const messages = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 AND (date_end IS NULL OR date_end >= date(\'now\')) THEN 1 ELSE 0 END) as active FROM display_messages').get();
      const templates = db.prepare('SELECT COUNT(*) as total FROM display_templates WHERE is_active = 1').get();

      res.json({
        screens: { total: screens.total, online: screens.online || 0 },
        playlists: { total: playlists.total },
        media: { total: media.total, totalSize: media.totalSize || 0 },
        messages: { total: messages.total, active: messages.active || 0 },
        templates: { total: templates.total },
      });
    } catch (error) {
      logger.error('Display stats:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  logger.info('✅ Routes Display (Dashboard) configurées');

  // ═══════════════════════════════════════════════════════════════
  //  DASHBOARD TV — Routes intégrées depuis calendar-dashboard
  // ═══════════════════════════════════════════════════════════════

  // ─────────────────── APPARENCE (config) ───────────────────────

  // GET /api/display/appearance — Lire la config d'apparence
  app.get('/api/display/appearance', authenticateToken, (_req, res) => {
    try {
      const rows = db.prepare('SELECT key, value FROM display_config').all();
      const config = {};
      rows.forEach(r => {
        try { config[r.key] = JSON.parse(r.value); } catch { config[r.key] = r.value; }
      });
      // Valeurs par défaut
      res.json({
        primaryColor: config.primaryColor || '#00e1ff',
        secondaryColor: config.secondaryColor || '#000000',
        eventBgColor: config.eventBgColor || '#000000',
        eventTextColor: config.eventTextColor || '#ffffff',
        fontFamily: config.fontFamily || 'Arial, sans-serif',
        showWeather: config.showWeather ?? false,
        autoScroll: config.autoScroll ?? true,
        weatherApiKey: config.weatherApiKey || '',
        weatherCity: config.weatherCity || 'Saint-Denis,RE,FR',
      });
    } catch (error) {
      logger.error('Display appearance get:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/display/appearance — Enregistrer la config
  app.post('/api/display/appearance', authenticateToken, requireAdmin, validate(appearanceSchema), (req, res) => {
    try {
      const upsert = db.prepare(`
        INSERT INTO display_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `);
      const allowed = ['primaryColor', 'secondaryColor', 'eventBgColor', 'eventTextColor',
                        'fontFamily', 'showWeather', 'autoScroll', 'weatherApiKey', 'weatherCity'];
      const t = db.transaction(() => {
        for (const key of allowed) {
          if (req.body[key] !== undefined) {
            upsert.run(key, JSON.stringify(req.body[key]));
          }
        }
      });
      t();
      logAction(null, 'appearance_updated', req.body, req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Display appearance save:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ────────────────── MESSAGES D'ACCUEIL ────────────────────────

  // GET /api/display/welcome-messages — Tous les messages par jour/créneau
  app.get('/api/display/welcome-messages', authenticateToken, (_req, res) => {
    try {
      const rows = db.prepare('SELECT day, slot, message FROM display_welcome_messages').all();
      const messages = {};
      rows.forEach(r => {
        if (!messages[r.day]) messages[r.day] = {};
        messages[r.day][r.slot] = r.message;
      });
      res.json({ welcomeMessages: messages });
    } catch (error) {
      logger.error('Display welcome messages get:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/display/welcome-messages — Enregistrer tous les messages
  app.post('/api/display/welcome-messages', authenticateToken, requireAdmin, validate(welcomeMessagesSchema), (req, res) => {
    try {
      const { welcomeMessages } = req.body;

      const upsert = db.prepare(`
        INSERT INTO display_welcome_messages (day, slot, message) VALUES (?, ?, ?)
        ON CONFLICT(day, slot) DO UPDATE SET message = excluded.message
      `);
      const t = db.transaction(() => {
        for (const [day, slots] of Object.entries(welcomeMessages)) {
          for (const [slot, message] of Object.entries(slots)) {
            upsert.run(day, slot, message || '');
          }
        }
      });
      t();
      logAction(null, 'welcome_messages_updated', {}, req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Display welcome messages save:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/display/welcome-message — Message dynamique actuel (pour l'écran TV)
  app.get('/api/display/welcome-message', authenticateToken, (_req, res) => {
    try {
      // Vérifier d'abord le message furtif
      const sneakyFile = join(displayDataDir, 'sneaky-message.json');
      const sneaky = readJsonFile(sneakyFile, null);
      if (sneaky && sneaky.active && new Date(sneaky.expiresAt) > new Date()) {
        return res.json({ message: sneaky.message, isSneaky: true });
      }

      // Message par jour/créneau
      const now = new Date();
      const joursFR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      const day = joursFR[now.getDay()];
      const hour = now.getHours();
      const minutes = now.getMinutes();
      const timeMinutes = hour * 60 + minutes;

      let slot;
      if (timeMinutes < 570) slot = 'matin';           // avant 9h30
      else if (timeMinutes < 720) slot = 'matinee';     // 9h30 - 12h
      else if (timeMinutes < 780) slot = 'midi';         // 12h - 13h
      else if (timeMinutes < 1080) slot = 'apres_midi';  // 13h - 18h
      else slot = 'soir';                                 // après 18h

      const row = db.prepare('SELECT message FROM display_welcome_messages WHERE day = ? AND slot = ?').get(day, slot);
      res.json({ message: row?.message || '', isSneaky: false });
    } catch (error) {
      logger.error('Display welcome message:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ────────────────── RÈGLES DE COULEURS ────────────────────────

  // GET /api/display/sidebar-config — Config du sidebar tâches (sections visibles)
  app.get('/api/display/sidebar-config', authenticateToken, (_req, res) => {
    try {
      const row = db.prepare("SELECT value FROM display_config WHERE key = 'sidebarSections'").get();
      const sections = row ? JSON.parse(row.value) : null; // null = toutes visibles
      res.json({ sections });
    } catch (error) {
      logger.error('Display sidebar-config get:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/display/sidebar-config — Sauvegarder les sections visibles
  app.post('/api/display/sidebar-config', authenticateToken, requireAdmin, validate(sidebarConfigSchema), (req, res) => {
    try {
      const { sections } = req.body; // string[] | null
      const upsert = db.prepare(`
        INSERT INTO display_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `);
      upsert.run('sidebarSections', JSON.stringify(sections));
      logAction(null, 'sidebar_config_updated', { sections }, req.user?.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Display sidebar-config save:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/display/color-rules
  app.get('/api/display/color-rules', authenticateToken, (_req, res) => {
    try {
      const rules = db.prepare('SELECT * FROM display_color_rules ORDER BY sort_order, id').all();
      res.json({ rules });
    } catch (error) {
      logger.error('Display color rules get:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/display/color-rules — Remplacer toutes les règles
  app.post('/api/display/color-rules', authenticateToken, requireAdmin, validate(colorRulesSchema), (req, res) => {
    try {
      const { rules } = req.body;

      const t = db.transaction(() => {
        db.prepare('DELETE FROM display_color_rules').run();
        const insert = db.prepare('INSERT INTO display_color_rules (keyword, color, description, sort_order) VALUES (?, ?, ?, ?)');
        rules.forEach((r, i) => {
          if (r.keyword) insert.run(r.keyword, r.color || '#00e1ff', r.description || '', i);
        });
      });
      t();
      logAction(null, 'color_rules_updated', { count: rules.length }, req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Display color rules save:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ─────────────── ICÔNES DE LIEUX (GIF) ───────────────────────

  // GET /api/display/location-gifs — Liste des GIFs disponibles
  app.get('/api/display/location-gifs', authenticateToken, (_req, res) => {
    try {
      const files = fs.readdirSync(gifsDir).filter(f => /\.(gif|png)$/i.test(f));
      res.json({ gifs: files });
    } catch (error) {
      logger.error('Display gifs list:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/display/location-gifs — Upload d'un GIF
  app.post('/api/display/location-gifs', authenticateToken, requireAdmin, uploadGif.single('gif'), validateFileType(DISPLAY_GIF_MIMES), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
      logAction(null, 'gif_uploaded', { filename: req.file.filename }, req.user.id);
      res.json({ success: true, filename: req.file.filename });
    } catch (error) {
      logger.error('Display gif upload:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // DELETE /api/display/location-gifs/:filename — Supprimer un GIF
  // [AUDIT FIX CRIT-2 + B3] Protection path traversal renforcée (path.resolve)
  app.delete('/api/display/location-gifs/:filename', authenticateToken, requireAdmin, (req, res) => {
    try {
      const sanitized = basename(req.params.filename);
      const normalizedBase = resolve(gifsDir);
      const filePath = resolve(gifsDir, sanitized);
      if (!filePath.startsWith(normalizedBase + '/') && filePath !== normalizedBase) return res.status(403).json({ error: 'Accès interdit' });
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier introuvable' });
      fs.unlinkSync(filePath);
      logAction(null, 'gif_deleted', { filename: req.params.filename }, req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Display gif delete:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/display/location-icon-rules — Règles d'association lieu → icône
  app.get('/api/display/location-icon-rules', authenticateToken, (_req, res) => {
    try {
      const rules = db.prepare('SELECT * FROM display_location_icon_rules ORDER BY sort_order, id').all();
      res.json({ rules });
    } catch (error) {
      logger.error('Display location icon rules get:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/display/location-icon-rules — Remplacer toutes les règles
  app.post('/api/display/location-icon-rules', authenticateToken, requireAdmin, validate(locationIconRulesSchema), (req, res) => {
    try {
      const { rules } = req.body;

      const t = db.transaction(() => {
        db.prepare('DELETE FROM display_location_icon_rules').run();
        const insert = db.prepare('INSERT INTO display_location_icon_rules (keyword, gif_filename, sort_order) VALUES (?, ?, ?)');
        rules.forEach((r, i) => {
          if (r.keyword && r.gifFilename) insert.run(r.keyword, r.gifFilename, i);
        });
      });
      t();
      logAction(null, 'location_icon_rules_updated', { count: rules.length }, req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Display location icon rules save:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ──────────────────── LOGO ────────────────────────────────────

  // POST /api/display/logo — Upload du logo
  app.post('/api/display/logo', authenticateToken, requireAdmin, uploadLogo.single('logo'), validateFileType(DISPLAY_IMAGE_MIMES), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
      // Stocker le chemin dans la config
      const upsert = db.prepare(`
        INSERT INTO display_config (key, value, updated_at) VALUES ('logoPath', ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `);
      upsert.run(JSON.stringify(`/display-logo/${req.file.filename}`));
      logAction(null, 'logo_uploaded', { filename: req.file.filename }, req.user.id);
      res.json({ success: true, path: `/display-logo/${req.file.filename}` });
    } catch (error) {
      logger.error('Display logo upload:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/display/logo — Récupérer le chemin du logo
  app.get('/api/display/logo', authenticateToken, (_req, res) => {
    try {
      const row = db.prepare("SELECT value FROM display_config WHERE key = 'logoPath'").get();
      if (row) {
        res.json({ path: JSON.parse(row.value) });
      } else {
        // Chercher un fichier logo existant
        const files = fs.readdirSync(logoDir).filter(f => /\.(png|jpg|jpeg|svg|webp)$/i.test(f));
        if (files.length > 0) {
          res.json({ path: `/display-logo/${files[0]}` });
        } else {
          res.json({ path: null });
        }
      }
    } catch (error) {
      logger.error('Display logo get:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ─────────────── PHOTO FURTIVE ────────────────────────────────

  // POST /api/display/sneaky-photo — Activer une photo furtive
  app.post('/api/display/sneaky-photo', authenticateToken, requireAdmin, uploadSneaky.single('photo'), validateFileType(DISPLAY_IMAGE_MIMES), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Photo requise' });
      const duration = req.body.duration || '60';
      const expiresAt = computeExpiration(duration);
      const config = {
        active: true,
        filename: req.file.filename,
        path: `/display-sneaky/${req.file.filename}`,
        expiresAt,
        uploadedAt: new Date().toISOString(),
      };
      writeJsonFile(join(displayDataDir, 'sneaky-photo.json'), config);
      logAction(null, 'sneaky_photo_activated', { duration, expiresAt }, req.user.id);
      res.json({ success: true, expiresAt });
    } catch (error) {
      logger.error('Display sneaky photo upload:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/display/sneaky-photo/status — Statut de la photo furtive
  app.get('/api/display/sneaky-photo/status', (_req, res) => {
    try {
      const config = readJsonFile(join(displayDataDir, 'sneaky-photo.json'), null);
      if (config && config.active && new Date(config.expiresAt) > new Date()) {
        res.json({ active: true, expiresAt: config.expiresAt, path: config.path });
      } else {
        res.json({ active: false });
      }
    } catch (error) {
      logger.error('Display sneaky photo status:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // DELETE /api/display/sneaky-photo — Désactiver la photo furtive
  app.delete('/api/display/sneaky-photo', authenticateToken, requireAdmin, (_req, res) => {
    try {
      const configFile = join(displayDataDir, 'sneaky-photo.json');
      const config = readJsonFile(configFile, null);
      if (config && config.filename) {
        const filePath = join(sneakyDir, config.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      writeJsonFile(configFile, { active: false });
      logAction(null, 'sneaky_photo_disabled', {}, _req.user?.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Display sneaky photo delete:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ─────────────── MESSAGE FURTIF ───────────────────────────────

  // POST /api/display/sneaky-message — Activer un message furtif
  app.post('/api/display/sneaky-message', authenticateToken, requireAdmin, validate(sneakyMessageSchema), (req, res) => {
    try {
      const { message, duration } = req.body;
      const expiresAt = computeExpiration(duration || '60');
      const config = { active: true, message: message.trim(), expiresAt, createdAt: new Date().toISOString() };
      writeJsonFile(join(displayDataDir, 'sneaky-message.json'), config);
      logAction(null, 'sneaky_message_activated', { duration, expiresAt }, req.user.id);
      res.json({ success: true, expiresAt });
    } catch (error) {
      logger.error('Display sneaky message create:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/display/sneaky-message/status — Statut du message furtif
  app.get('/api/display/sneaky-message/status', (_req, res) => {
    try {
      const config = readJsonFile(join(displayDataDir, 'sneaky-message.json'), null);
      if (config && config.active && new Date(config.expiresAt) > new Date()) {
        res.json({ active: true, message: config.message, expiresAt: config.expiresAt });
      } else {
        res.json({ active: false });
      }
    } catch (error) {
      logger.error('Display sneaky message status:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // DELETE /api/display/sneaky-message — Désactiver le message furtif
  app.delete('/api/display/sneaky-message', authenticateToken, requireAdmin, (_req, res) => {
    try {
      writeJsonFile(join(displayDataDir, 'sneaky-message.json'), { active: false });
      logAction(null, 'sneaky_message_disabled', {}, _req.user?.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Display sneaky message delete:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ──────────────────── MÉTÉO ───────────────────────────────────

  // GET /api/display/weather — Proxy OpenWeatherMap (auth TV ou admin)
  app.get('/api/display/weather', optionalTvToken, async (_req, res) => {
    try {
      const apiKeyRow = db.prepare("SELECT value FROM display_config WHERE key = 'weatherApiKey'").get();
      const cityRow = db.prepare("SELECT value FROM display_config WHERE key = 'weatherCity'").get();
      const apiKey = apiKeyRow ? JSON.parse(apiKeyRow.value) : '';
      const city = cityRow ? JSON.parse(cityRow.value) : 'Saint-Denis,RE,FR';

      if (!apiKey) return res.status(503).json({ error: 'Clé API météo non configurée' });

      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=fr`;
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);
      res.json(data);
    } catch (error) {
      logger.error('Display weather:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ──────────────────── SONOS → voir sonosRoutes.js ──────────

  // GET /api/display/tv-state — État complet pour l'aperçu TV dans l'admin
  app.get('/api/display/tv-state', authenticateToken, async (req, res) => {
    try {
      // Config apparence
      const configRows = db.prepare('SELECT key, value FROM display_config').all();
      const config = {};
      configRows.forEach(r => {
        try { config[r.key] = JSON.parse(r.value); } catch { config[r.key] = r.value; }
      });

      // Message d'accueil courant
      const now = new Date();
      const joursFR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      const day = joursFR[now.getDay()];
      const hh = now.getHours();
      const mm = now.getMinutes();
      let slot = 'soir';
      if (hh >= 6 && (hh < 9 || (hh === 9 && mm < 30))) slot = 'matin';
      else if ((hh === 9 && mm >= 30) || (hh >= 10 && hh < 12)) slot = 'matinee';
      else if (hh >= 12 && hh < 13) slot = 'midi';
      else if (hh >= 13 && hh < 18) slot = 'apres_midi';

      // Sneaky message prioritaire
      let welcomeMessage = 'Bienvenue !';
      const sneakyPath = join(displayDataDir, 'sneaky-message.json');
      if (fs.existsSync(sneakyPath)) {
        try {
          const sneaky = JSON.parse(fs.readFileSync(sneakyPath, 'utf8'));
          if (sneaky.active && sneaky.expiresAt && new Date(sneaky.expiresAt) > now) {
            welcomeMessage = sneaky.message;
          } else {
            const row = db.prepare('SELECT message FROM display_welcome_messages WHERE day = ? AND slot = ?').get(day, slot);
            if (row?.message) welcomeMessage = row.message;
          }
        } catch {
          const row = db.prepare('SELECT message FROM display_welcome_messages WHERE day = ? AND slot = ?').get(day, slot);
          if (row?.message) welcomeMessage = row.message;
        }
      } else {
        const row = db.prepare('SELECT message FROM display_welcome_messages WHERE day = ? AND slot = ?').get(day, slot);
        if (row?.message) welcomeMessage = row.message;
      }

      // Règles couleurs
      const colorRules = db.prepare('SELECT keyword, color, description FROM display_color_rules ORDER BY sort_order').all();

      // Règles icônes
      const iconRules = db.prepare('SELECT keyword, gif_filename FROM display_location_icon_rules ORDER BY sort_order').all();

      // Logo
      let logoUrl = null;
      if (config.logoPath) {
        logoUrl = config.logoPath;
      } else {
        const files = fs.readdirSync(logoDir).filter(f => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f));
        if (files.length > 0) logoUrl = `/display-logo/${files[0]}`;
      }

      // Sneaky photo
      let sneakyPhoto = { active: false };
      const photoPath = join(displayDataDir, 'sneaky-photo.json');
      if (fs.existsSync(photoPath)) {
        try {
          const sp = JSON.parse(fs.readFileSync(photoPath, 'utf8'));
          if (sp.active && sp.expiresAt && new Date(sp.expiresAt) > now) {
            sneakyPhoto = { active: true, path: sp.path };
          }
        } catch { /* ignore */ }
      }

      // Messages actifs du display (comme événements pour l'aperçu)
      const displayMessages = db.prepare(
        "SELECT title, body, priority FROM display_messages WHERE is_active = 1 AND (date_end IS NULL OR date_end >= date('now')) ORDER BY priority DESC LIMIT 8"
      ).all();

      // ── Tâches du jour visibles (planification → écran TV) ──
      // Par défaut seules les tâches opérationnelles sont affichées.
      // Les RDV/événements ne s'affichent que si l'utilisateur les active (visible=1 via eye toggle).
      const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const dayTasks = db.prepare(
        `SELECT ta.id, ta.title, ta.time, ta.end_time, ta.section, ta.period,
                ta.notes, ta.status, ta.source_type, ta.google_event_title, ta.affaire_num,
                dde.client AS event_client, dde.location AS event_location,
                dde.type AS event_type, dde.category AS event_category,
                aff.type AS affaire_type,
                COALESCE(NULLIF(aff.nom, ''), '') AS affaire_nom,
                COALESCE(NULLIF(aff.titre, ''), '') AS affaire_titre,
                COALESCE(NULLIF(aff.client, ''), '') AS affaire_client
         FROM task_assignments ta
         LEFT JOIN dynamic_display_events dde ON ta.display_event_id = dde.id
         LEFT JOIN affaires aff ON ta.affaire_num != '' AND ta.affaire_num = aff.numero_affaire
         WHERE ta.date = ? AND ta.visible = 1
           AND ta.status != 'cancelled'
           AND ta.deleted_at IS NULL
         ORDER BY ta.time ASC, ta.created_at ASC`
      ).all(todayISO);

      // Transformer en format compatible TVScreenMini
      // Format enrichi : { time, period, title, section, sectionLabel, status, description, is_recurrent }
      const SECTION_LABELS = {
        rdv: 'RDV', evenements: 'Événement',
        taches_prioritaires: 'Prioritaire', courses: 'Courses',
        prep_locations: 'Prépa Location', prep_prestations: 'Prépa Prestation',
        prep_ventes: 'Prépa Vente', prep_installations: 'Prépa Installation',
        prep_tournees: 'Prépa Tournée',
        chargement: 'Chargement', depart: 'Départ', enlevement: 'Enlèvement',
        retour: 'Retour', recuperation: 'Récupération', installation: 'Installation',
        taches_secondaires: 'Secondaire', manual: 'Divers',
      };

      const events = dayTasks.map(t => ({
        id: String(t.id),
        time: t.time ? t.time.substring(0, 5) : '',
        period: t.period || '',
        title: cleanTvTitle(t),
        section: t.section || 'manual',
        sectionLabel: SECTION_LABELS[t.section] || t.section || 'Divers',
        status: t.status || 'pending',
        location: t.event_location || '',
        client: t.event_client || '',
        notes: t.notes || '',
        affaire_num: t.affaire_num || '',
        affaire_type: t.affaire_type || '',
        description: [t.affaire_num ? `Affaire ${t.affaire_num}` : '', t.notes || ''].filter(Boolean).join(' — ') || '',
        is_recurrent: t.source_type === 'recurring' ? 1 : 0,
      }));

      // Trier par heure (événements sans heure en fin)
      events.sort((a, b) => {
        if (!a.time && !b.time) return 0;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      });

      // Événements terminés du jour
      const completedRows = db.prepare(
        'SELECT event_id FROM display_completed_events WHERE event_date = ?'
      ).all(todayISO);

      // ── Sonos now-playing (réutilise le helper avec gestion de groupe) ──
      let sonos = { playing: false };
      try {
        sonos = await getSonosNowPlaying();
      } catch (e) {
        logger.error('Sonos in tv-state:', e.message);
      }

      res.json({
        config: {
          primaryColor: config.primaryColor || '#00e1ff',
          secondaryColor: config.secondaryColor || '#000000',
          eventBgColor: config.eventBgColor || '#000000',
          eventTextColor: config.eventTextColor || '#ffffff',
          fontFamily: config.fontFamily || 'Arial, sans-serif',
          showWeather: config.showWeather ?? false,
          autoScroll: config.autoScroll ?? true,
        },
        welcomeMessage,
        colorRules,
        iconRules,
        logoUrl,
        sneakyPhoto,
        displayMessages,
        events,
        completedEvents: completedRows.map(r => r.event_id),
        sonos,
      });
    } catch (error) {
      logger.error('Display tv-state:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Servir les GIFs statiques (accès public pour l'écran TV) ──
  // [AUDIT FIX CRIT-2 + B3] Protection path traversal renforcée (path.resolve)
  app.get('/api/display/gifs/:filename', (req, res) => {
    const sanitized = basename(req.params.filename);
    const normalizedBase = resolve(gifsDir);
    const filePath = resolve(gifsDir, sanitized);
    // Vérifier que le chemin résolu reste dans gifsDir
    if (!filePath.startsWith(normalizedBase + '/') && filePath !== normalizedBase) {
      return res.status(403).json({ error: 'Accès interdit' });
    }
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'Fichier introuvable' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // ENDPOINTS PUBLICS — Client TV standalone (ex calendar-dashboard)
  // Accessible sans authentification pour les écrans TV
  // ═══════════════════════════════════════════════════════════════

  // GET /api/display/tv-public-state — État complet pour l'écran TV (authentifié par token TV)
  app.get('/api/display/tv-public-state', optionalTvToken, async (_req, res) => {
    try {
      // Config apparence
      const configRows = db.prepare('SELECT key, value FROM display_config').all();
      const config = {};
      configRows.forEach(r => {
        try { config[r.key] = JSON.parse(r.value); } catch { config[r.key] = r.value; }
      });

      // Message d'accueil courant
      const now = new Date();
      const joursFR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      const day = joursFR[now.getDay()];
      const hh = now.getHours();
      const mm = now.getMinutes();
      let slot = 'soir';
      if (hh >= 6 && (hh < 9 || (hh === 9 && mm < 30))) slot = 'matin';
      else if ((hh === 9 && mm >= 30) || (hh >= 10 && hh < 12)) slot = 'matinee';
      else if (hh >= 12 && hh < 13) slot = 'midi';
      else if (hh >= 13 && hh < 18) slot = 'apres_midi';

      // Sneaky message prioritaire
      let welcomeMessage = 'Bienvenue !';
      const sneakyMsgPath = join(displayDataDir, 'sneaky-message.json');
      if (fs.existsSync(sneakyMsgPath)) {
        try {
          const sneaky = JSON.parse(fs.readFileSync(sneakyMsgPath, 'utf8'));
          if (sneaky.active && sneaky.expiresAt && new Date(sneaky.expiresAt) > now) {
            welcomeMessage = sneaky.message;
          } else {
            const row = db.prepare('SELECT message FROM display_welcome_messages WHERE day = ? AND slot = ?').get(day, slot);
            if (row?.message) welcomeMessage = row.message;
          }
        } catch {
          const row = db.prepare('SELECT message FROM display_welcome_messages WHERE day = ? AND slot = ?').get(day, slot);
          if (row?.message) welcomeMessage = row.message;
        }
      } else {
        const row = db.prepare('SELECT message FROM display_welcome_messages WHERE day = ? AND slot = ?').get(day, slot);
        if (row?.message) welcomeMessage = row.message;
      }

      // Règles couleurs + icônes
      const colorRules = db.prepare('SELECT keyword, color, description FROM display_color_rules ORDER BY sort_order').all();
      const iconRules = db.prepare('SELECT keyword, gif_filename FROM display_location_icon_rules ORDER BY sort_order').all();

      // Logo
      let logoUrl = null;
      if (config.logoPath) {
        logoUrl = config.logoPath;
      } else {
        const files = fs.readdirSync(logoDir).filter(f => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f));
        if (files.length > 0) logoUrl = `/display-logo/${files[0]}`;
      }

      // Sneaky photo
      let sneakyPhoto = { active: false };
      const photoPath = join(displayDataDir, 'sneaky-photo.json');
      if (fs.existsSync(photoPath)) {
        try {
          const sp = JSON.parse(fs.readFileSync(photoPath, 'utf8'));
          if (sp.active && sp.expiresAt && new Date(sp.expiresAt) > now) {
            sneakyPhoto = { active: true, path: sp.path };
          }
        } catch { /* ignore */ }
      }

      // ── Tâches du jour visibles (planification → écran TV) ──
      const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const dayTasks = db.prepare(
        `SELECT ta.id, ta.title, ta.time, ta.end_time, ta.section, ta.period,
                ta.notes, ta.status, ta.source_type, ta.google_event_title, ta.affaire_num,
                dde.client AS event_client, dde.location AS event_location,
                dde.type AS event_type, dde.category AS event_category,
                aff.type AS affaire_type,
                COALESCE(NULLIF(aff.nom, ''), '') AS affaire_nom,
                COALESCE(NULLIF(aff.titre, ''), '') AS affaire_titre,
                COALESCE(NULLIF(aff.client, ''), '') AS affaire_client
         FROM task_assignments ta
         LEFT JOIN dynamic_display_events dde ON ta.display_event_id = dde.id
         LEFT JOIN affaires aff ON ta.affaire_num != '' AND ta.affaire_num = aff.numero_affaire
         WHERE ta.date = ? AND ta.visible = 1
           AND ta.status != 'cancelled'
           AND ta.deleted_at IS NULL
         ORDER BY ta.time ASC, ta.created_at ASC`
      ).all(todayISO);

      const SECTION_LABELS = {
        rdv: 'RDV', evenements: 'Événement',
        taches_prioritaires: 'Prioritaire', courses: 'Courses',
        prep_locations: 'Prépa Location', prep_prestations: 'Prépa Prestation',
        prep_ventes: 'Prépa Vente', prep_installations: 'Prépa Installation',
        prep_tournees: 'Prépa Tournée',
        chargement: 'Chargement', depart: 'Départ', enlevement: 'Enlèvement',
        retour: 'Retour', recuperation: 'Récupération', installation: 'Installation',
        taches_secondaires: 'Secondaire', manual: 'Divers',
      };

      const events = dayTasks.map(t => ({
        id: String(t.id),
        time: t.time ? t.time.substring(0, 5) : '',
        end_time: t.end_time ? t.end_time.substring(0, 5) : '',
        period: t.period || '',
        title: cleanTvTitle(t),
        section: t.section || 'manual',
        sectionLabel: SECTION_LABELS[t.section] || t.section || 'Divers',
        status: t.status || 'pending',
        location: t.event_location || '',
        client: t.event_client || '',
        notes: t.notes || '',
        affaire_num: t.affaire_num || '',
        affaire_type: t.affaire_type || '',
        description: [t.affaire_num ? `Affaire ${t.affaire_num}` : '', t.notes || ''].filter(Boolean).join(' — ') || '',
        is_recurrent: t.source_type === 'recurring' ? 1 : 0,
      }));

      events.sort((a, b) => {
        if (!a.time && !b.time) return 0;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      });

      // Événements terminés du jour
      const completedRows = db.prepare(
        'SELECT event_id FROM display_completed_events WHERE event_date = ?'
      ).all(todayISO);
      const completedEvents = completedRows.map(r => r.event_id);

      // Sonos
      let sonos = { playing: false };
      try {
        sonos = await getSonosNowPlaying();
      } catch (e) {
        logger.error('Sonos in tv-public-state:', e.message);
      }

      res.json({
        config: {
          primaryColor: config.primaryColor || '#00e1ff',
          secondaryColor: config.secondaryColor || '#000000',
          eventBgColor: config.eventBgColor || '#000000',
          eventTextColor: config.eventTextColor || '#ffffff',
          fontFamily: config.fontFamily || 'Arial, sans-serif',
          showWeather: config.showWeather ?? false,
          autoScroll: config.autoScroll ?? true,
        },
        welcomeMessage,
        colorRules,
        iconRules,
        logoUrl,
        sneakyPhoto,
        events,
        completedEvents,
        sonos,
        alarmTest: alarmTestTimestamp,
      });
    } catch (error) {
      logger.error('Display tv-public-state:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/display/tv/test-alarm — Déclencher l'alarme sonore sur l'écran TV distant
  app.post('/api/display/tv/test-alarm', authenticateToken, (_req, res) => {
    alarmTestTimestamp = Date.now();
    logger.info('🔔 Alarme test déclenchée depuis l\'admin');
    res.json({ success: true, timestamp: alarmTestTimestamp });
  });

  // ── Completed events toggle (public pour écran TV) ──

  // GET /api/display/tv/completed-events — Liste des tâches terminées du jour
  app.get('/api/display/tv/completed-events', optionalTvToken, (_req, res) => {
    try {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const rows = db.prepare('SELECT event_id FROM display_completed_events WHERE event_date = ?').all(dateStr);
      res.json({ completed: rows.map(r => r.event_id) });
    } catch (error) {
      logger.error('Display completed-events:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/display/tv/complete-event — Marquer une tâche comme terminée
  app.post('/api/display/tv/complete-event', optionalTvToken, tvWriteLimiter, validate(eventIdSchema), (req, res) => {
    try {
      const { eventId } = req.body;
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      db.prepare('INSERT OR IGNORE INTO display_completed_events (event_id, event_date) VALUES (?, ?)').run(String(eventId), dateStr);
      res.json({ success: true, eventId });
    } catch (error) {
      logger.error('Display complete-event:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/display/tv/uncomplete-event — Démarquer une tâche
  app.post('/api/display/tv/uncomplete-event', optionalTvToken, tvWriteLimiter, validate(eventIdSchema), (req, res) => {
    try {
      const { eventId } = req.body;
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      db.prepare('DELETE FROM display_completed_events WHERE event_id = ? AND event_date = ?').run(String(eventId), dateStr);
      res.json({ success: true, eventId });
    } catch (error) {
      logger.error('Display uncomplete-event:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ══════════════════════════════════════════════════════════════════
  //  ROUTES DE COMPATIBILITÉ — ancien client calendar-dashboard
  //  Ces routes redirigent les anciens endpoints (/api/xxx) vers les
  //  endpoints eM@g (/api/display/xxx), permettant à l'ancien JS
  //  en cache de fonctionner le temps que le navigateur se rafraîchisse.
  // ══════════════════════════════════════════════════════════════════

  // /api/events → Tâches du jour au format { regular, recurrent }
  app.get('/api/events', optionalTvToken, async (_req, res) => {
    try {
      const now = new Date();
      const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const dayTasks = db.prepare(
        `SELECT ta.id, ta.title, ta.time, ta.end_time, ta.section, ta.period,
                ta.notes, ta.status, ta.source_type, ta.google_event_title, ta.affaire_num,
                dde.client AS event_client, dde.location AS event_location
         FROM task_assignments ta
         LEFT JOIN dynamic_display_events dde ON ta.display_event_id = dde.id
         WHERE ta.date = ? AND ta.visible = 1
           AND ta.status != 'cancelled'
           AND ta.deleted_at IS NULL
         ORDER BY ta.time ASC, ta.created_at ASC`
      ).all(todayISO);

      const SECTION_LABELS = {
        rdv: 'RDV', evenements: 'Événement',
        taches_prioritaires: 'Prioritaire', courses: 'Courses',
        prep_locations: 'Prépa Location', prep_prestations: 'Prépa Prestation',
        prep_ventes: 'Prépa Vente', prep_installations: 'Prépa Installation',
        prep_tournees: 'Prépa Tournée',
        chargement: 'Chargement', depart: 'Départ', enlevement: 'Enlèvement',
        retour: 'Retour', recuperation: 'Récupération', installation: 'Installation',
        taches_secondaires: 'Secondaire', manual: 'Divers',
      };

      const events = dayTasks.map(t => ({
        id: String(t.id),
        start: t.time ? `${todayISO}T${t.time}` : todayISO,
        end: t.end_time ? `${todayISO}T${t.end_time}` : '',
        summary: t.google_event_title || t.title || '',
        title: t.google_event_title || t.title || '',
        section: t.section || 'manual',
        sectionLabel: SECTION_LABELS[t.section] || t.section || 'Divers',
        status: t.status || 'pending',
        location: t.event_location || '',
        client: t.event_client || '',
        description: t.affaire_num ? `Affaire ${t.affaire_num}` : (t.notes || ''),
        is_recurrent: t.source_type === 'recurring' ? 1 : 0,
      }));

      events.sort((a, b) => a.start.localeCompare(b.start));

      res.json({
        regular: events.filter(e => !e.is_recurrent),
        recurrent: events.filter(e => e.is_recurrent),
        all: events,
      });
    } catch (error) {
      logger.error('Compat /api/events:', error);
      res.status(500).json({ error: 'Impossible de récupérer les événements' });
    }
  });

  // /api/config → config apparence
  app.get('/api/config', optionalTvToken, (_req, res) => {
    try {
      const rows = db.prepare('SELECT key, value FROM display_config').all();
      const config = {};
      rows.forEach(r => {
        try { config[r.key] = JSON.parse(r.value); } catch { config[r.key] = r.value; }
      });
      res.json(config);
    } catch (error) {
      logger.error('Compat /api/config:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // /api/welcome-message → message d'accueil
  app.get('/api/welcome-message', optionalTvToken, (_req, res) => {
    try {
      const sneakyFile = join(displayDataDir, 'sneaky-message.json');
      const sneaky = readJsonFile(sneakyFile, null);
      if (sneaky && sneaky.active && new Date(sneaky.expiresAt) > new Date()) {
        return res.json({ message: sneaky.message });
      }
      const now = new Date();
      const joursFR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      const day = joursFR[now.getDay()];
      const hh = now.getHours();
      const mm = now.getMinutes();
      let slot = 'soir';
      if (hh >= 6 && (hh < 9 || (hh === 9 && mm < 30))) slot = 'matin';
      else if ((hh === 9 && mm >= 30) || (hh >= 10 && hh < 12)) slot = 'matinee';
      else if (hh >= 12 && hh < 13) slot = 'midi';
      else if (hh >= 13 && hh < 18) slot = 'apres_midi';
      const row = db.prepare('SELECT message FROM display_welcome_messages WHERE day = ? AND slot = ?').get(day, slot);
      res.json({ message: row?.message || '' });
    } catch (error) {
      logger.error('Compat /api/welcome-message:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // /api/completed-events → événements terminés du jour
  app.get('/api/completed-events', optionalTvToken, (_req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const rows = db.prepare('SELECT event_id FROM display_completed_events WHERE event_date = ?').all(today);
      res.json({ completed: rows.map(r => r.event_id) });
    } catch (error) {
      logger.error('Compat /api/completed-events:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // /api/complete-event → marquer terminé
  app.post('/api/complete-event', optionalTvToken, tvWriteLimiter, (req, res) => {
    try {
      const { eventId } = req.body;
      if (!eventId || !isValidEventId(String(eventId))) return res.status(400).json({ error: 'eventId invalide' });
      const today = new Date().toISOString().split('T')[0];
      db.prepare('INSERT OR IGNORE INTO display_completed_events (event_id, event_date) VALUES (?, ?)').run(String(eventId), today);
      res.json({ success: true, eventId });
    } catch (error) {
      logger.error('Compat /api/complete-event:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // /api/uncomplete-event → démarquer
  app.post('/api/uncomplete-event', optionalTvToken, tvWriteLimiter, (req, res) => {
    try {
      const { eventId } = req.body;
      if (!eventId || !isValidEventId(String(eventId))) return res.status(400).json({ error: 'eventId invalide' });
      const today = new Date().toISOString().split('T')[0];
      db.prepare('DELETE FROM display_completed_events WHERE event_id = ? AND event_date = ?').run(String(eventId), today);
      res.json({ success: true, eventId });
    } catch (error) {
      logger.error('Compat /api/uncomplete-event:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // /api/event-color-rules → règles de couleurs
  app.get('/api/event-color-rules', optionalTvToken, (_req, res) => {
    try {
      const rules = db.prepare('SELECT keyword, color, description FROM display_color_rules ORDER BY sort_order').all();
      res.json(rules);
    } catch (error) {
      logger.error('Compat /api/event-color-rules:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // /api/location-icons → icônes de lieux
  app.get('/api/location-icons', optionalTvToken, (_req, res) => {
    try {
      const rules = db.prepare('SELECT keyword, gif_filename FROM display_location_icon_rules ORDER BY sort_order').all();
      res.json(rules);
    } catch (error) {
      logger.error('Compat /api/location-icons:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // /api/weather → météo (proxy)
  app.get('/api/weather', optionalTvToken, async (_req, res) => {
    try {
      const apiKeyRow = db.prepare("SELECT value FROM display_config WHERE key = 'weatherApiKey'").get();
      const cityRow = db.prepare("SELECT value FROM display_config WHERE key = 'weatherCity'").get();
      const apiKey = apiKeyRow ? JSON.parse(apiKeyRow.value) : '';
      const city = cityRow ? JSON.parse(cityRow.value) : 'Saint-Denis,RE,FR';
      if (!apiKey) return res.status(503).json({ error: 'Clé API météo non configurée' });
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=fr`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      logger.error('Compat /api/weather:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // /api/sonos-now-playing → déplacé dans sonosRoutes.js

  // /api/sneaky-photo/status → photo furtive
  app.get('/api/sneaky-photo/status', (_req, res) => {
    try {
      const config = readJsonFile(join(displayDataDir, 'sneaky-photo.json'), null);
      if (config && config.active && new Date(config.expiresAt) > new Date()) {
        res.json({ active: true, expiresAt: config.expiresAt, path: config.path });
      } else {
        res.json({ active: false });
      }
    } catch (error) {
      logger.error('Compat /api/sneaky-photo/status:', error);
      res.json({ active: false });
    }
  });

  // /api/sneaky-photo/image → image furtive
  app.get('/api/sneaky-photo/image', (_req, res) => {
    try {
      const config = readJsonFile(join(displayDataDir, 'sneaky-photo.json'), null);
      if (config && config.active && config.filename) {
        const filePath = join(sneakyDir, config.filename);
        if (fs.existsSync(filePath)) return res.sendFile(filePath);
      }
      res.status(404).json({ error: 'Aucune photo active' });
    } catch (error) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // /api/logo → logo
  app.get('/api/logo', (_req, res) => {
    try {
      const files = fs.readdirSync(logoDir).filter(f => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f));
      if (files.length > 0) {
        return res.sendFile(join(logoDir, files[0]));
      }
      res.status(404).json({ error: 'Aucun logo trouvé' });
    } catch (error) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  logger.info('✅ Routes Dashboard TV (apparence, messages, couleurs, icônes, Sonos, TV public, compat legacy) configurées');
}
