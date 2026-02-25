// ═══════════════════════════════════════════════════════════════
// Module Communication — Routes API
// Affichage dynamique + Import BL + Planification des tâches
// ═══════════════════════════════════════════════════════════════

import db from './database.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Stockage des fichiers BL importés
const blStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'public', 'bl-imports');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `bl-${uniqueSuffix}${ext}`);
  }
});

const uploadBL = multer({
  storage: blStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (req, file, cb) => {
    const allowed = /\.(pdf|jpg|jpeg|png|gif|webp|tiff?)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Formats acceptés : PDF, JPG, PNG, GIF, WEBP, TIFF'));
    }
  }
});


// ═══════════════════════════════════════════════
// AFFICHAGE DYNAMIQUE — CRUD
// ═══════════════════════════════════════════════

export function setupCommunicationRoutes(app, authenticateToken, requireAdmin) {

  // ─── GET /api/communication/display-events ───
  // Liste avec filtres optionnels : date, dateFrom, dateTo, type, category, affaire_id
  app.get('/api/communication/display-events', authenticateToken, (req, res) => {
    try {
      let query = 'SELECT * FROM dynamic_display_events WHERE 1=1';
      const params = [];

      if (req.query.date) {
        query += ' AND date = ?';
        params.push(req.query.date);
      }
      if (req.query.dateFrom) {
        query += ' AND date >= ?';
        params.push(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        query += ' AND date <= ?';
        params.push(req.query.dateTo);
      }
      if (req.query.type) {
        query += ' AND type = ?';
        params.push(req.query.type);
      }
      if (req.query.category) {
        query += ' AND category = ?';
        params.push(req.query.category);
      }
      if (req.query.affaire_id) {
        query += ' AND affaire_id = ?';
        params.push(req.query.affaire_id);
      }

      query += ' ORDER BY date DESC, created_at DESC';

      const events = db.prepare(query).all(...params);
      res.json(events);
    } catch (error) {
      console.error('GET /api/communication/display-events error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/communication/display-events/:id ───
  app.get('/api/communication/display-events/:id', authenticateToken, (req, res) => {
    try {
      const event = db.prepare('SELECT * FROM dynamic_display_events WHERE id = ?').get(req.params.id);
      if (!event) return res.status(404).json({ error: 'Événement non trouvé' });
      res.json(event);
    } catch (error) {
      console.error('GET /api/communication/display-events/:id error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/communication/display-events ───
  app.post('/api/communication/display-events', authenticateToken, (req, res) => {
    try {
      const { affaire_id, bl_import_id, type, category, date, period, time, comment, client, location } = req.body;

      if (!type || !category || !date) {
        return res.status(400).json({ error: 'Champs obligatoires : type, category, date' });
      }

      const id = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex');

      const stmt = db.prepare(`
        INSERT INTO dynamic_display_events (id, affaire_id, bl_import_id, type, category, date, period, time, comment, client, location, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      stmt.run(id, affaire_id || null, bl_import_id || null, type, category, date, period || null, time || null, comment || '', client || '', location || '', req.user.id);

      const created = db.prepare('SELECT * FROM dynamic_display_events WHERE id = ?').get(id);
      res.status(201).json(created);
    } catch (error) {
      console.error('POST /api/communication/display-events error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── PUT /api/communication/display-events/:id ───
  app.put('/api/communication/display-events/:id', authenticateToken, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM dynamic_display_events WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Événement non trouvé' });

      const { affaire_id, bl_import_id, type, category, date, period, time, comment, client, location } = req.body;

      const stmt = db.prepare(`
        UPDATE dynamic_display_events
        SET affaire_id = ?, bl_import_id = ?, type = ?, category = ?, date = ?, period = ?, time = ?, comment = ?, client = ?, location = ?, modified_by = ?, modified_at = datetime('now')
        WHERE id = ?
      `);

      stmt.run(
        affaire_id ?? existing.affaire_id,
        bl_import_id ?? existing.bl_import_id,
        type || existing.type,
        category || existing.category,
        date || existing.date,
        period !== undefined ? period : existing.period,
        time !== undefined ? time : existing.time,
        comment !== undefined ? comment : existing.comment,
        client !== undefined ? client : existing.client,
        location !== undefined ? location : existing.location,
        req.user.id,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM dynamic_display_events WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error('PUT /api/communication/display-events/:id error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── DELETE /api/communication/display-events/:id ───
  app.delete('/api/communication/display-events/:id', authenticateToken, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM dynamic_display_events WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Événement non trouvé' });

      db.prepare('DELETE FROM dynamic_display_events WHERE id = ?').run(req.params.id);
      res.json({ success: true, message: 'Événement supprimé' });
    } catch (error) {
      console.error('DELETE /api/communication/display-events/:id error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });


  // ═══════════════════════════════════════════════
  // IMPORTS BL — CRUD
  // ═══════════════════════════════════════════════

  // ─── GET /api/communication/bl-imports ───
  app.get('/api/communication/bl-imports', authenticateToken, (req, res) => {
    try {
      let query = 'SELECT * FROM bl_imports WHERE 1=1';
      const params = [];

      if (req.query.affaire_id) {
        query += ' AND affaire_id = ?';
        params.push(req.query.affaire_id);
      }
      if (req.query.status) {
        query += ' AND status = ?';
        params.push(req.query.status);
      }

      query += ' ORDER BY created_at DESC';

      const imports = db.prepare(query).all(...params);
      res.json(imports);
    } catch (error) {
      console.error('GET /api/communication/bl-imports error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/communication/bl-imports/:id ───
  app.get('/api/communication/bl-imports/:id', authenticateToken, (req, res) => {
    try {
      const blImport = db.prepare('SELECT * FROM bl_imports WHERE id = ?').get(req.params.id);
      if (!blImport) return res.status(404).json({ error: 'Import BL non trouvé' });
      res.json(blImport);
    } catch (error) {
      console.error('GET /api/communication/bl-imports/:id error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/communication/bl-imports ───
  // Multipart : fichier BL + champs parsed_data, affaire_id, etc.
  app.post('/api/communication/bl-imports', authenticateToken, uploadBL.single('file'), (req, res) => {
    try {
      const { affaire_id, raw_text, parsed_data, status } = req.body;
      const file = req.file;

      if (!file && !raw_text) {
        return res.status(400).json({ error: 'Un fichier ou du texte extrait est requis' });
      }

      const id = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex');

      const stmt = db.prepare(`
        INSERT INTO bl_imports (id, affaire_id, filename, file_path, mime_type, raw_text, parsed_data, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      stmt.run(
        id,
        affaire_id || null,
        file ? file.originalname : 'text-import',
        file ? file.filename : null,
        file ? file.mimetype : 'text/plain',
        raw_text || null,
        parsed_data ? (typeof parsed_data === 'string' ? parsed_data : JSON.stringify(parsed_data)) : null,
        status || 'validated',
        req.user.id
      );

      const created = db.prepare('SELECT * FROM bl_imports WHERE id = ?').get(id);
      res.status(201).json(created);
    } catch (error) {
      console.error('POST /api/communication/bl-imports error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── DELETE /api/communication/bl-imports/:id ───
  app.delete('/api/communication/bl-imports/:id', authenticateToken, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM bl_imports WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Import BL non trouvé' });

      // Supprimer le fichier physique s'il existe
      if (existing.file_path) {
        const filePath = path.join(__dirname, '..', 'public', 'bl-imports', existing.file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      db.prepare('DELETE FROM bl_imports WHERE id = ?').run(req.params.id);
      res.json({ success: true, message: 'Import BL supprimé' });
    } catch (error) {
      console.error('DELETE /api/communication/bl-imports/:id error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });


  // ═══════════════════════════════════════════════
  // PLANIFICATION — TÂCHES — CRUD
  // ═══════════════════════════════════════════════

  // ─── GET /api/communication/tasks ───
  // Filtres : date, dateFrom, dateTo, person_id, section, status
  app.get('/api/communication/tasks', authenticateToken, (req, res) => {
    try {
      let query = `
        SELECT ta.*, 
               dde.affaire_id AS event_affaire_id,
               dde.type AS event_type,
               dde.category AS event_category,
               dde.client AS event_client,
               dde.location AS event_location,
               p.first_name AS person_first_name,
               p.last_name AS person_last_name
        FROM task_assignments ta
        LEFT JOIN dynamic_display_events dde ON ta.display_event_id = dde.id
        LEFT JOIN persons p ON ta.person_id = p.id
        WHERE 1=1
      `;
      const params = [];

      if (req.query.date) {
        query += ' AND ta.date = ?';
        params.push(req.query.date);
      }
      if (req.query.dateFrom) {
        query += ' AND ta.date >= ?';
        params.push(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        query += ' AND ta.date <= ?';
        params.push(req.query.dateTo);
      }
      if (req.query.person_id) {
        query += ' AND ta.person_id = ?';
        params.push(req.query.person_id);
      }
      if (req.query.section) {
        query += ' AND ta.section = ?';
        params.push(req.query.section);
      }
      if (req.query.status) {
        query += ' AND ta.status = ?';
        params.push(req.query.status);
      }

      query += ' ORDER BY ta.date ASC, ta.period ASC, ta.time ASC';

      const tasks = db.prepare(query).all(...params);
      res.json(tasks);
    } catch (error) {
      console.error('GET /api/communication/tasks error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/communication/tasks/:id ───
  app.get('/api/communication/tasks/:id', authenticateToken, (req, res) => {
    try {
      const task = db.prepare(`
        SELECT ta.*, 
               dde.affaire_id AS event_affaire_id,
               dde.type AS event_type,
               dde.category AS event_category,
               p.first_name AS person_first_name,
               p.last_name AS person_last_name
        FROM task_assignments ta
        LEFT JOIN dynamic_display_events dde ON ta.display_event_id = dde.id
        LEFT JOIN persons p ON ta.person_id = p.id
        WHERE ta.id = ?
      `).get(req.params.id);

      if (!task) return res.status(404).json({ error: 'Tâche non trouvée' });
      res.json(task);
    } catch (error) {
      console.error('GET /api/communication/tasks/:id error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/communication/tasks ───
  app.post('/api/communication/tasks', authenticateToken, (req, res) => {
    try {
      const { display_event_id, person_id, date, period, time, section, title, notes, source_type, source_id, status } = req.body;

      if (!date) {
        return res.status(400).json({ error: 'Le champ date est obligatoire' });
      }

      const id = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex');

      const stmt = db.prepare(`
        INSERT INTO task_assignments (id, display_event_id, person_id, date, period, time, section, title, notes, source_type, source_id, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      stmt.run(
        id,
        display_event_id || null,
        person_id || null,
        date,
        period || null,
        time || null,
        section || 'manual',
        title || null,
        notes || '',
        source_type || 'manual',
        source_id || null,
        status || 'pending',
        req.user.id
      );

      // Retourner avec les JOINs
      const created = db.prepare(`
        SELECT ta.*, 
               dde.affaire_id AS event_affaire_id,
               dde.type AS event_type,
               p.first_name AS person_first_name,
               p.last_name AS person_last_name
        FROM task_assignments ta
        LEFT JOIN dynamic_display_events dde ON ta.display_event_id = dde.id
        LEFT JOIN persons p ON ta.person_id = p.id
        WHERE ta.id = ?
      `).get(id);

      res.status(201).json(created);
    } catch (error) {
      console.error('POST /api/communication/tasks error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── PUT /api/communication/tasks/:id ───
  app.put('/api/communication/tasks/:id', authenticateToken, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM task_assignments WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Tâche non trouvée' });

      const { display_event_id, person_id, date, period, time, section, title, notes, source_type, source_id, status } = req.body;

      const stmt = db.prepare(`
        UPDATE task_assignments
        SET display_event_id = ?, person_id = ?, date = ?, period = ?, time = ?, section = ?, title = ?, notes = ?, source_type = ?, source_id = ?, status = ?, modified_by = ?, modified_at = datetime('now')
        WHERE id = ?
      `);

      stmt.run(
        display_event_id !== undefined ? display_event_id : existing.display_event_id,
        person_id !== undefined ? person_id : existing.person_id,
        date || existing.date,
        period !== undefined ? period : existing.period,
        time !== undefined ? time : existing.time,
        section || existing.section,
        title !== undefined ? title : existing.title,
        notes !== undefined ? notes : existing.notes,
        source_type || existing.source_type,
        source_id !== undefined ? source_id : existing.source_id,
        status || existing.status,
        req.user.id,
        req.params.id
      );

      // Retourner avec les JOINs
      const updated = db.prepare(`
        SELECT ta.*, 
               dde.affaire_id AS event_affaire_id,
               dde.type AS event_type,
               p.first_name AS person_first_name,
               p.last_name AS person_last_name
        FROM task_assignments ta
        LEFT JOIN dynamic_display_events dde ON ta.display_event_id = dde.id
        LEFT JOIN persons p ON ta.person_id = p.id
        WHERE ta.id = ?
      `).get(req.params.id);

      res.json(updated);
    } catch (error) {
      console.error('PUT /api/communication/tasks/:id error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── DELETE /api/communication/tasks/:id ───
  app.delete('/api/communication/tasks/:id', authenticateToken, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM task_assignments WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Tâche non trouvée' });

      db.prepare('DELETE FROM task_assignments WHERE id = ?').run(req.params.id);
      res.json({ success: true, message: 'Tâche supprimée' });
    } catch (error) {
      console.error('DELETE /api/communication/tasks/:id error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });


  // ═══════════════════════════════════════════════
  // STATS — Résumé pour le tableau de bord
  // ═══════════════════════════════════════════════

  // ─── GET /api/communication/stats ───
  app.get('/api/communication/stats', authenticateToken, (req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);

      const displayEventsToday = db.prepare(
        'SELECT COUNT(*) as count FROM dynamic_display_events WHERE date = ?'
      ).get(today);

      const displayEventsTotal = db.prepare(
        'SELECT COUNT(*) as count FROM dynamic_display_events'
      ).get();

      const tasksToday = db.prepare(
        'SELECT COUNT(*) as count FROM task_assignments WHERE date = ?'
      ).get(today);

      const tasksPending = db.prepare(
        "SELECT COUNT(*) as count FROM task_assignments WHERE status = 'pending'"
      ).get();

      const blImportsTotal = db.prepare(
        'SELECT COUNT(*) as count FROM bl_imports'
      ).get();

      const displayByType = db.prepare(`
        SELECT type, COUNT(*) as count 
        FROM dynamic_display_events 
        WHERE date >= ? 
        GROUP BY type 
        ORDER BY count DESC
      `).all(today);

      res.json({
        displayEventsToday: displayEventsToday.count,
        displayEventsTotal: displayEventsTotal.count,
        tasksToday: tasksToday.count,
        tasksPending: tasksPending.count,
        blImportsTotal: blImportsTotal.count,
        displayByType
      });
    } catch (error) {
      console.error('GET /api/communication/stats error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

}
