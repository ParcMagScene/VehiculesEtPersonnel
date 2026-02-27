// ═══════════════════════════════════════════════════════════════
// server/displayRoutes.js — Routes API pour le module Dashboard
// (Affichage dynamique : écrans, playlists, médias, messages, templates, logs)
// ═══════════════════════════════════════════════════════════════

import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import db from './database.js';
import logger from './logger.js';
import { randomBytes } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Multer : stockage des médias ──────────────────────────────
const mediaDir = join(__dirname, '..', 'public', 'display-media');
if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

const mediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, mediaDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname).toLowerCase();
    // Sanitize original filename
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_');
    cb(null, `display-${unique}-${safeName}`);
  },
});

const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'video/mp4', 'video/webm', 'video/ogg',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Type MIME non autorisé : ${file.mimetype}`));
    }
  },
});

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
  app.post('/api/display/screens', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, location, resolution, orientation, playlistId, config } = req.body;
      if (!name) return res.status(400).json({ error: 'Le nom est requis' });

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
  app.put('/api/display/screens/:id', authenticateToken, requireAdmin, (req, res) => {
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

  // POST /api/display/playlists
  app.post('/api/display/playlists', authenticateToken, (req, res) => {
    try {
      const { name, description, transition, defaultDuration, items } = req.body;
      if (!name) return res.status(400).json({ error: 'Le nom est requis' });

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

  // PUT /api/display/playlists/:id
  app.put('/api/display/playlists/:id', authenticateToken, (req, res) => {
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

  // PUT /api/display/playlists/:id/items — Réordonner / remplacer les items
  app.put('/api/display/playlists/:id/items', authenticateToken, (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ error: 'items doit être un tableau' });

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

  // POST /api/display/media — Upload média
  app.post('/api/display/media', authenticateToken, uploadMedia.single('file'), (req, res) => {
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
      const fullPath = join(__dirname, '..', 'public', media.file_path);
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
  app.post('/api/display/messages', authenticateToken, (req, res) => {
    try {
      const { title, body, priority, style, templateId, dateStart, dateEnd } = req.body;
      if (!title) return res.status(400).json({ error: 'Le titre est requis' });

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
  app.put('/api/display/messages/:id', authenticateToken, (req, res) => {
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
  app.post('/api/display/templates', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, category, description, layout } = req.body;
      if (!name) return res.status(400).json({ error: 'Le nom est requis' });
      if (!layout) return res.status(400).json({ error: 'Le layout est requis' });

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
  app.put('/api/display/templates/:id', authenticateToken, requireAdmin, (req, res) => {
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
      params.push(parseInt(limit), parseInt(offset));

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
}
