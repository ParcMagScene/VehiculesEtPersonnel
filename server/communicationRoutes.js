// ═══════════════════════════════════════════════════════════════
// Module Communication — Routes API
// Affichage dynamique + Import BL + Planification des tâches
// ═══════════════════════════════════════════════════════════════

import db from './database.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

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
  // Auto-crée l'affaire si elle n'existe pas, ou lie au BL si elle existe
  app.post('/api/communication/bl-imports', authenticateToken, uploadBL.single('file'), (req, res) => {
    try {
      const { affaire_id, affaire_type, raw_text, parsed_data, status } = req.body;
      const file = req.file;

      if (!file && !raw_text) {
        return res.status(400).json({ error: 'Un fichier ou du texte extrait est requis' });
      }

      const id = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex');

      // Extraire les métadonnées enrichies du parsed_data
      let pd = null;
      let affaireTypeResolved = affaire_type || null;
      let docType = null, confidenceScore = null, sectionsData = null, fieldConfidence = null;
      if (parsed_data) {
        try {
          pd = typeof parsed_data === 'string' ? JSON.parse(parsed_data) : parsed_data;
          if (!affaireTypeResolved) affaireTypeResolved = pd.type || null;
          docType = pd.docType || null;
          confidenceScore = pd.confidence || null;
          sectionsData = pd.sections && pd.sections.length > 0 ? JSON.stringify(pd.sections) : null;
          fieldConfidence = pd._fieldConfidence ? JSON.stringify(pd._fieldConfidence) : null;
        } catch (_) { /* ignore parse errors */ }
      }

      // ── Auto-création / liaison affaire ──
      let linkedAffaireId = affaire_id || null;
      let affaireCreated = false;
      if (linkedAffaireId) {
        const existingAffaire = db.prepare('SELECT id, numero_affaire FROM affaires WHERE numero_affaire = ?').get(linkedAffaireId);
        if (!existingAffaire) {
          // Créer l'affaire automatiquement à partir des données parsées
          try {
            db.prepare(`
              INSERT INTO affaires (numero_affaire, type, client, interlocuteur, tel, fax,
                date_debut, devis, adresse_livraison, titre, description,
                created_by, modified_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              linkedAffaireId,
              affaireTypeResolved || 'Prestation',
              pd?.client || '',
              pd?.interlocuteur || '',
              pd?.tel || '',
              pd?.fax || '',
              pd?.date || '',
              pd?.devis || '',
              pd?.adresse || '',
              pd?.nomAffaire || pd?.objet || '',
              `Créée automatiquement depuis l'import BL ${file ? file.originalname : 'text-import'}`,
              req.user.id,
              req.user.id
            );
            affaireCreated = true;
            console.log(`✅ Affaire ${linkedAffaireId} créée automatiquement depuis BL import`);
          } catch (affaireErr) {
            // Si erreur UNIQUE constraint (race condition), l'affaire a été créée entre-temps → OK
            if (!affaireErr.message?.includes('UNIQUE')) {
              console.error('Erreur création auto affaire:', affaireErr.message);
            }
          }
        }
      }

      const stmt = db.prepare(`
        INSERT INTO bl_imports (id, affaire_id, filename, file_path, mime_type, raw_text, parsed_data, status, affaire_type, doc_type, confidence_score, sections_data, field_confidence, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      stmt.run(
        id,
        linkedAffaireId,
        file ? file.originalname : 'text-import',
        file ? file.filename : null,
        file ? file.mimetype : 'text/plain',
        raw_text || null,
        parsed_data ? (typeof parsed_data === 'string' ? parsed_data : JSON.stringify(parsed_data)) : null,
        status || 'validated',
        affaireTypeResolved,
        docType,
        confidenceScore,
        sectionsData,
        fieldConfidence,
        req.user.id
      );

      const created = db.prepare('SELECT * FROM bl_imports WHERE id = ?').get(id);
      res.status(201).json({ ...created, affaire_created: affaireCreated });
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


  // ═══════════════════════════════════════════════
  // EXPORT PDF — Fiche de tâches journalière
  // ═══════════════════════════════════════════════

  app.get('/api/communication/tasks/export-pdf', authenticateToken, (req, res) => {
    try {
      const { date, taskIds } = req.query;
      if (!date) {
        return res.status(400).json({ error: 'Le paramètre date est requis' });
      }

      // Charger les tâches du jour avec joints
      let tasks = db.prepare(`
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
        WHERE ta.date = ?
        ORDER BY ta.section ASC, ta.period ASC, ta.time ASC
      `).all(date);

      // Filtrage optionnel par IDs
      if (taskIds) {
        const ids = taskIds.split(',').map(Number).filter(n => !isNaN(n));
        if (ids.length > 0) {
          const idSet = new Set(ids);
          tasks = tasks.filter(t => idSet.has(t.id));
        }
      }

      // Regrouper par section
      const SECTIONS = {
        prep_locations:     { label: 'Prépa Locations',    emoji: '📦' },
        prep_prestations:   { label: 'Prépa Prestations',  emoji: '🎤' },
        prep_ventes:        { label: 'Prépa Ventes',       emoji: '🏷' },
        taches_prioritaires:{ label: 'Tâches Prioritaires', emoji: '🔴' },
        taches_secondaires: { label: 'Tâches Secondaires', emoji: '🟡' },
        courses:            { label: 'Courses',             emoji: '🚗' },
        manual:             { label: 'Autres',              emoji: '📋' },
      };

      const grouped = {};
      Object.keys(SECTIONS).forEach(k => { grouped[k] = []; });
      tasks.forEach(t => {
        const sec = t.section || 'manual';
        if (!grouped[sec]) grouped[sec] = [];
        grouped[sec].push(t);
      });

      // Formater la date en français
      const dateObj = new Date(date + 'T00:00:00');
      const dateFr = dateObj.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });

      // Couleurs par section
      const SECTION_COLORS = {
        prep_locations:      [59, 130, 246],
        prep_prestations:    [245, 158, 11],
        prep_ventes:         [16, 185, 129],
        taches_prioritaires: [239, 68, 68],
        taches_secondaires:  [245, 158, 11],
        courses:             [139, 92, 246],
        manual:              [100, 116, 139],
      };

      const STATUS_LABELS = {
        pending: '○ À faire',
        in_progress: '◐ En cours',
        done: '● Fait',
        cancelled: '✕ Annulé',
      };

      // ── Générer le PDF ──
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        info: {
          Title: `Fiche de tâches — ${dateFr}`,
          Author: 'eM@g — Mag Scène',
          Subject: 'Planification des tâches',
        }
      });

      // Envoyer comme stream
      const filename = `taches-${date}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      doc.pipe(res);

      // ── EN-TÊTE ──
      doc.fontSize(20).font('Helvetica-Bold').text('Fiche de tâches', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(13).font('Helvetica').text(dateFr.charAt(0).toUpperCase() + dateFr.slice(1), { align: 'center' });
      doc.moveDown(0.2);

      const totalTasks = tasks.length;
      const doneTasks = tasks.filter(t => t.status === 'done').length;
      doc.fontSize(9).fillColor('#888888')
        .text(`${totalTasks} tâche${totalTasks > 1 ? 's' : ''} — ${doneTasks} terminée${doneTasks > 1 ? 's' : ''}`, { align: 'center' });
      doc.fillColor('#000000');

      doc.moveDown(0.8);

      // Ligne de séparation
      const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.margins.left + pageW, doc.y)
        .strokeColor('#cccccc').lineWidth(0.5).stroke();
      doc.moveDown(0.6);

      // ── SECTIONS ──
      Object.entries(SECTIONS).forEach(([key, info]) => {
        const sectionTasks = grouped[key] || [];
        if (sectionTasks.length === 0) return;

        // Vérifier espace restant
        if (doc.y > doc.page.height - 120) {
          doc.addPage();
        }

        const color = SECTION_COLORS[key] || [100, 100, 100];
        const hexColor = `#${color.map(c => c.toString(16).padStart(2, '0')).join('')}`;

        // Bandeau de section
        const bannerY = doc.y;
        doc.rect(doc.page.margins.left, bannerY, pageW, 22)
          .fillColor(hexColor).fill();
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff')
          .text(`${info.label} (${sectionTasks.length})`, doc.page.margins.left + 10, bannerY + 5, { width: pageW - 20 });
        doc.fillColor('#000000');
        doc.y = bannerY + 28;

        // Lignes de tâches
        sectionTasks.forEach((task, i) => {
          if (doc.y > doc.page.height - 60) {
            doc.addPage();
          }

          const rowY = doc.y;
          const leftX = doc.page.margins.left;

          // Fond alternée
          if (i % 2 === 0) {
            doc.rect(leftX, rowY, pageW, 18).fillColor('#f8f9fa').fill();
          }

          // Checkbox statut
          const statusLabel = STATUS_LABELS[task.status] || '○';
          doc.font('Helvetica').fontSize(9).fillColor('#333333')
            .text(statusLabel, leftX + 4, rowY + 4, { width: 70 });

          // Titre (barré si done)
          const titleX = leftX + 74;
          const titleW = pageW - 240;
          if (task.status === 'done') {
            doc.font('Helvetica-Oblique').fillColor('#999999');
          } else {
            doc.font('Helvetica').fillColor('#111111');
          }
          doc.text(task.title || '—', titleX, rowY + 4, { width: titleW, lineBreak: false });
          if (task.status === 'done') {
            // Ligne barrée
            const textWidth = doc.widthOfString(task.title || '—', { width: titleW });
            doc.moveTo(titleX, rowY + 10)
              .lineTo(titleX + Math.min(textWidth, titleW), rowY + 10)
              .strokeColor('#999999').lineWidth(0.5).stroke();
          }

          // Personne assignée
          const personX = leftX + pageW - 160;
          if (task.person_first_name || task.person_last_name) {
            const personStr = `${task.person_first_name || ''} ${task.person_last_name ? task.person_last_name.charAt(0) + '.' : ''}`.trim();
            doc.font('Helvetica').fontSize(8).fillColor('#555555')
              .text(personStr, personX, rowY + 5, { width: 90, lineBreak: false });
          }

          // Détails événement (client, lieu)
          const extraX = leftX + pageW - 60;
          if (task.event_client) {
            doc.font('Helvetica').fontSize(7).fillColor('#888888')
              .text(task.event_client.slice(0, 12), extraX, rowY + 3, { width: 55, lineBreak: false });
          }
          if (task.event_location) {
            doc.font('Helvetica').fontSize(7).fillColor('#888888')
              .text(task.event_location.slice(0, 12), extraX, rowY + 11, { width: 55, lineBreak: false });
          }

          doc.fillColor('#000000');
          doc.y = rowY + 20;
        });

        doc.moveDown(0.5);
      });

      // ── PIED DE PAGE ──
      doc.moveDown(1);
      doc.moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.margins.left + pageW, doc.y)
        .strokeColor('#cccccc').lineWidth(0.5).stroke();
      doc.moveDown(0.4);
      doc.fontSize(7).font('Helvetica').fillColor('#aaaaaa')
        .text(`Généré par eM@g — ${new Date().toLocaleString('fr-FR')}`, { align: 'center' });

      doc.end();

    } catch (error) {
      console.error('GET /api/communication/tasks/export-pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erreur génération PDF' });
      }
    }
  });

}
