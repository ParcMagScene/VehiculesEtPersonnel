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
import logger from './logger.js';

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
      logger.error('GET /api/communication/display-events error:', error);
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
      logger.error('GET /api/communication/display-events/:id error:', error);
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
      logger.error('POST /api/communication/display-events error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── PUT /api/communication/display-events/:id ───
  app.put('/api/communication/display-events/:id', authenticateToken, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM dynamic_display_events WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Événement non trouvé' });

      const { affaire_id, bl_import_id, type, category, date, period, time, comment, client, location, visible } = req.body;

      const stmt = db.prepare(`
        UPDATE dynamic_display_events
        SET affaire_id = ?, bl_import_id = ?, type = ?, category = ?, date = ?, period = ?, time = ?, comment = ?, client = ?, location = ?, visible = ?, modified_by = ?, modified_at = datetime('now')
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
        visible !== undefined ? (visible ? 1 : 0) : (existing.visible ?? 1),
        req.user.id,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM dynamic_display_events WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (error) {
      logger.error('PUT /api/communication/display-events/:id error:', error);
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
      logger.error('DELETE /api/communication/display-events/:id error:', error);
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
      logger.error('GET /api/communication/bl-imports error:', error);
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
      logger.error('GET /api/communication/bl-imports/:id error:', error);
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
            const today = new Date().toISOString().slice(0, 10);
            db.prepare(`
              INSERT INTO affaires (numero_affaire, type, client, interlocuteur, tel, fax,
                date_debut, date_fin, devis, adresse_livraison, titre, description,
                created_by, modified_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              linkedAffaireId,
              affaireTypeResolved || 'Prestation',
              pd?.client || '',
              pd?.interlocuteur || '',
              pd?.tel || '',
              pd?.fax || '',
              pd?.date || today,
              '',
              pd?.devis || '',
              pd?.adresse || '',
              pd?.nomAffaire || pd?.objet || '',
              `Créée automatiquement depuis l'import BL ${file ? file.originalname : 'text-import'}`,
              req.user.id,
              req.user.id
            );
            affaireCreated = true;
          } catch (affaireErr) {
            // Si erreur UNIQUE constraint (race condition), l'affaire a été créée entre-temps → OK
            if (!affaireErr.message?.includes('UNIQUE')) {
              logger.error('Erreur création auto affaire:', affaireErr.message);
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

      // ═══ Auto-persist BP items with catalogue matching ═══
      let bpItemsCount = 0;
      if (pd && Array.isArray(pd.items) && pd.items.length > 0) {
        try {
          const insertItem = db.prepare(`
            INSERT INTO bp_items (bl_import_id, equipment_catalog_id, reference, description, section, quantity, poids, volume, match_status, match_confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          const findExact = db.prepare('SELECT id FROM equipment_catalog WHERE reference = ?');
          const findNorm = db.prepare("SELECT id FROM equipment_catalog WHERE REPLACE(REPLACE(reference, '-', ''), ' ', '') = REPLACE(REPLACE(?, '-', ''), ' ', '') LIMIT 1");

          const insertMany = db.transaction((items) => {
            for (const item of items) {
              const ref = (item.reference || item.code || '').trim();
              let catalogId = null;
              let matchStatus = 'unmatched';
              let matchConf = 0;

              if (ref) {
                const exact = findExact.get(ref);
                if (exact) {
                  catalogId = exact.id;
                  matchStatus = 'matched';
                  matchConf = 1.0;
                } else {
                  const norm = findNorm.get(ref);
                  if (norm) {
                    catalogId = norm.id;
                    matchStatus = 'matched';
                    matchConf = 0.8;
                  }
                }
              }

              insertItem.run(
                id,
                catalogId,
                ref || null,
                item.description || null,
                item.section || null,
                item.quantity || 1,
                item.poids || null,
                item.volume || null,
                matchStatus,
                matchConf
              );
            }
          });

          insertMany(pd.items);
          bpItemsCount = pd.items.length;
        } catch (bpErr) {
          logger.error('Erreur insertion bp_items:', bpErr.message);
        }
      }

      res.status(201).json({ ...created, affaire_created: affaireCreated, bp_items_count: bpItemsCount });
    } catch (error) {
      logger.error('POST /api/communication/bl-imports error:', error);
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
      logger.error('DELETE /api/communication/bl-imports/:id error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/communication/bp-items?affaire_id=AFxxxxx ───
  // Retourne les articles BP avec leur statut de matching catalogue
  app.get('/api/communication/bp-items', authenticateToken, (req, res) => {
    try {
      const { affaire_id, bl_import_id } = req.query;
      let query = `
        SELECT bp.*, 
               ec.name AS catalog_name, ec.family AS catalog_family, 
               ec.subfamily AS catalog_subfamily, ec.reference AS catalog_reference,
               ec.location_zone AS catalog_zone, ec.location_depot AS catalog_depot
        FROM bp_items bp
        LEFT JOIN equipment_catalog ec ON bp.equipment_catalog_id = ec.id
        JOIN bl_imports bi ON bp.bl_import_id = bi.id
      `;
      const params = [];

      if (affaire_id) {
        query += ' WHERE bi.affaire_id = ?';
        params.push(affaire_id);
      } else if (bl_import_id) {
        query += ' WHERE bp.bl_import_id = ?';
        params.push(bl_import_id);
      }

      query += ' ORDER BY bp.section, bp.id';
      const items = db.prepare(query).all(...params);

      // Agrégation stats
      const matched = items.filter(i => i.match_status === 'matched').length;
      res.json({ items, total: items.length, matched, unmatched: items.length - matched });
    } catch (error) {
      logger.error('GET /api/communication/bp-items error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── PUT /api/communication/bp-items/:id/match ───
  // Lier manuellement un article BP à un item du catalogue
  app.put('/api/communication/bp-items/:id/match', authenticateToken, (req, res) => {
    try {
      const { equipment_catalog_id } = req.body;
      const item = db.prepare('SELECT * FROM bp_items WHERE id = ?').get(req.params.id);
      if (!item) return res.status(404).json({ error: 'Article BP non trouvé' });

      if (equipment_catalog_id) {
        const catalogItem = db.prepare('SELECT id FROM equipment_catalog WHERE id = ?').get(equipment_catalog_id);
        if (!catalogItem) return res.status(404).json({ error: 'Article catalogue introuvable' });
        db.prepare('UPDATE bp_items SET equipment_catalog_id = ?, match_status = ?, match_confidence = 1.0 WHERE id = ?')
          .run(equipment_catalog_id, 'manual', req.params.id);
      } else {
        // Délier
        db.prepare('UPDATE bp_items SET equipment_catalog_id = NULL, match_status = ?, match_confidence = 0 WHERE id = ?')
          .run('unmatched', req.params.id);
      }

      const updated = db.prepare(`
        SELECT bp.*, ec.name AS catalog_name, ec.family AS catalog_family, ec.reference AS catalog_reference
        FROM bp_items bp LEFT JOIN equipment_catalog ec ON bp.equipment_catalog_id = ec.id
        WHERE bp.id = ?
      `).get(req.params.id);

      res.json(updated);
    } catch (error) {
      logger.error('PUT /api/communication/bp-items/:id/match error:', error);
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
      logger.error('GET /api/communication/tasks error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });


  // ═══════════════════════════════════════════════
  // EXPORT PDF — Fiche journalière complète
  // ═══════════════════════════════════════════════

  const handleExportPdf = (req, res) => {
    try {
      const { date, taskIds, affaireIds, eventIds } = req.query;
      const gcalEvents = req.body?.gcalEvents || [];
      if (!date) {
        return res.status(400).json({ error: 'Le paramètre date est requis' });
      }

      // ── 1) Charger les tâches ──
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

      if (taskIds) {
        const ids = taskIds.split(',').map(Number).filter(n => !isNaN(n));
        if (ids.length > 0) {
          const idSet = new Set(ids);
          tasks = tasks.filter(t => idSet.has(t.id));
        }
      }

      // ── 2) Charger les affaires ──
      let affaires = [];
      if (affaireIds) {
        const ids = affaireIds.split(',').map(Number).filter(n => !isNaN(n));
        if (ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          affaires = db.prepare(`SELECT * FROM affaires WHERE id IN (${placeholders})`).all(...ids);
        }
      }

      // ── 3) Charger les événements d'affichage ──
      let displayEvts = [];
      if (eventIds) {
        const ids = eventIds.split(',').map(Number).filter(n => !isNaN(n));
        if (ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          displayEvts = db.prepare(`SELECT * FROM dynamic_display_events WHERE id IN (${placeholders})`).all(...ids);
        }
      }

      // ── Sections & couleurs ──
      const SECTIONS = {
        rdv:                 { label: 'RDV du jour',          emoji: '📅' },
        prep_locations:      { label: 'Prépa Locations',      emoji: '📦' },
        prep_prestations:    { label: 'Prépa Prestations',    emoji: '🎤' },
        prep_ventes:         { label: 'Prépa Ventes',         emoji: '🏷' },
        prep_installations:  { label: 'Prépa Installations',  emoji: '⚙' },
        taches_prioritaires: { label: 'Tâches Prioritaires',  emoji: '🔴' },
        taches_secondaires:  { label: 'Tâches Secondaires',   emoji: '🟡' },
        courses:             { label: 'Courses',               emoji: '🚗' },
        manual:              { label: 'Autres',                emoji: '📋' },
      };

      const SECTION_COLORS = {
        rdv:                 [5, 150, 105],
        prep_locations:      [59, 130, 246],
        prep_prestations:    [245, 158, 11],
        prep_ventes:         [16, 185, 129],
        prep_installations:  [139, 92, 246],
        taches_prioritaires: [239, 68, 68],
        taches_secondaires:  [245, 158, 11],
        courses:             [139, 92, 246],
        manual:              [100, 116, 139],
      };

      const AFFAIRE_TYPE_MAP = {
        'Prestation': 'prep_prestations', 'Location': 'prep_locations',
        'Vente': 'prep_ventes', 'Installation': 'prep_installations',
      };

      const EVENT_TYPE_MAP = {
        preparation: 'prep_locations', livraison: 'taches_prioritaires',
        enlevement: 'taches_prioritaires', depart: 'taches_prioritaires',
        retour: 'taches_secondaires', recuperation: 'taches_secondaires',
      };

      const EVENT_TYPE_LABELS = {
        preparation: 'Préparation', enlevement: 'Enlèvement', livraison: 'Livraison',
        depart: 'Départ', retour: 'Retour', recuperation: 'Récupération',
      };

      const STATUS_LABELS = {
        pending: '○ À faire', in_progress: '◐ En cours',
        done: '● Fait', cancelled: '✕ Annulé',
      };

      // ── Regrouper tous les items par section ──
      const grouped = {};
      Object.keys(SECTIONS).forEach(k => { grouped[k] = []; });

      // Tasks
      tasks.forEach(t => {
        const sec = t.section || 'manual';
        if (!grouped[sec]) grouped[sec] = [];
        grouped[sec].push({ type: 'task', data: t });
      });

      // Affaires
      affaires.forEach(a => {
        const sec = AFFAIRE_TYPE_MAP[a.type] || 'manual';
        if (!grouped[sec]) grouped[sec] = [];
        grouped[sec].push({ type: 'affaire', data: a });
        // RDV
        if (a.titre && /rdv/i.test(a.titre)) {
          grouped.rdv.push({ type: 'affaire-rdv', data: a });
        }
      });

      // Display events
      const linkedEventIds = new Set(tasks.filter(t => t.display_event_id).map(t => t.display_event_id));
      displayEvts.filter(ev => !linkedEventIds.has(ev.id)).forEach(ev => {
        let sec = EVENT_TYPE_MAP[ev.type] || 'manual';
        if (ev.type === 'preparation') {
          if (ev.category === 'prestation') sec = 'prep_prestations';
          else if (ev.category === 'vente') sec = 'prep_ventes';
          else if (ev.category === 'installation') sec = 'prep_installations';
          else sec = 'prep_locations';
        }
        if (!grouped[sec]) grouped[sec] = [];
        grouped[sec].push({ type: 'event', data: ev });
      });

      // Google Calendar events
      (gcalEvents || []).forEach(ev => {
        grouped.rdv.push({ type: 'gcal', data: ev });
      });

      // Compter le total
      let totalItems = 0;
      Object.values(grouped).forEach(arr => { totalItems += arr.length; });

      // ── Date en français ──
      const dateObj = new Date(date + 'T00:00:00');
      const dateFr = dateObj.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });

      // ── Générer le PDF ──
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        info: {
          Title: `Fiche du jour — ${dateFr}`,
          Author: 'eM@g — Mag Scène',
          Subject: 'Planification journalière',
        }
      });

      const filename = `fiche-${date}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      doc.pipe(res);

      const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const leftX = doc.page.margins.left;

      // ── EN-TÊTE ──
      doc.fontSize(20).font('Helvetica-Bold').text('Fiche du jour', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(13).font('Helvetica').text(dateFr.charAt(0).toUpperCase() + dateFr.slice(1), { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(9).fillColor('#888888')
        .text(`${totalItems} élément${totalItems > 1 ? 's' : ''}`, { align: 'center' });
      doc.fillColor('#000000');
      doc.moveDown(0.8);

      doc.moveTo(leftX, doc.y).lineTo(leftX + pageW, doc.y)
        .strokeColor('#cccccc').lineWidth(0.5).stroke();
      doc.moveDown(0.6);

      // ── Helper: dessiner une ligne d'item ──
      const renderRow = (label, detail, rightInfo, idx) => {
        if (doc.y > doc.page.height - 60) doc.addPage();
        const rowY = doc.y;
        if (idx % 2 === 0) {
          doc.rect(leftX, rowY, pageW, 20).fillColor('#f8f9fa').fill();
        }
        // Label (gauche)
        doc.font('Helvetica').fontSize(9).fillColor('#333333')
          .text(label, leftX + 4, rowY + 4, { width: 80, lineBreak: false });
        // Detail (centre)
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
          .text(detail || '—', leftX + 84, rowY + 4, { width: pageW - 200, lineBreak: false });
        // Right info
        if (rightInfo) {
          doc.font('Helvetica').fontSize(8).fillColor('#555555')
            .text(rightInfo, leftX + pageW - 110, rowY + 5, { width: 105, lineBreak: false, align: 'right' });
        }
        doc.fillColor('#000000');
        doc.y = rowY + 22;
      };

      // ── SECTIONS ──
      Object.entries(SECTIONS).forEach(([key, info]) => {
        const items = grouped[key] || [];
        if (items.length === 0) return;

        if (doc.y > doc.page.height - 120) doc.addPage();

        const color = SECTION_COLORS[key] || [100, 100, 100];
        const hexColor = `#${color.map(c => c.toString(16).padStart(2, '0')).join('')}`;

        // Bandeau de section
        const bannerY = doc.y;
        doc.rect(leftX, bannerY, pageW, 22).fillColor(hexColor).fill();
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff')
          .text(`${info.label} (${items.length})`, leftX + 10, bannerY + 5, { width: pageW - 20 });
        doc.fillColor('#000000');
        doc.y = bannerY + 28;

        items.forEach((item, i) => {
          if (item.type === 'task') {
            const t = item.data;
            const statusLabel = STATUS_LABELS[t.status] || '○';
            const titleStr = t.title || '—';
            const personStr = (t.person_first_name || t.person_last_name)
              ? `${t.person_first_name || ''} ${t.person_last_name ? t.person_last_name.charAt(0) + '.' : ''}`.trim()
              : '';

            if (doc.y > doc.page.height - 60) doc.addPage();
            const rowY = doc.y;
            if (i % 2 === 0) {
              doc.rect(leftX, rowY, pageW, 18).fillColor('#f8f9fa').fill();
            }
            doc.font('Helvetica').fontSize(9).fillColor('#333333')
              .text(statusLabel, leftX + 4, rowY + 4, { width: 70 });
            const titleX = leftX + 74;
            const titleW = pageW - 240;
            if (t.status === 'done') {
              doc.font('Helvetica-Oblique').fillColor('#999999');
            } else {
              doc.font('Helvetica').fillColor('#111111');
            }
            doc.text(titleStr, titleX, rowY + 4, { width: titleW, lineBreak: false });
            if (t.status === 'done') {
              const tw = doc.widthOfString(titleStr, { width: titleW });
              doc.moveTo(titleX, rowY + 10).lineTo(titleX + Math.min(tw, titleW), rowY + 10)
                .strokeColor('#999999').lineWidth(0.5).stroke();
            }
            if (personStr) {
              doc.font('Helvetica').fontSize(8).fillColor('#555555')
                .text(personStr, leftX + pageW - 160, rowY + 5, { width: 90, lineBreak: false });
            }
            if (t.event_client) {
              doc.font('Helvetica').fontSize(7).fillColor('#888888')
                .text(t.event_client.slice(0, 15), leftX + pageW - 60, rowY + 3, { width: 55, lineBreak: false });
            }
            doc.fillColor('#000000');
            doc.y = rowY + 20;

          } else if (item.type === 'affaire' || item.type === 'affaire-rdv') {
            const a = item.data;
            const label = `📋 ${a.numero_affaire || '?'}`;
            const detail = `${a.type || ''} — ${a.client || 'Sans client'}${a.adresse_livraison ? ' — ' + a.adresse_livraison.split('\n')[0].slice(0, 40) : ''}`;
            const right = a.interlocuteur ? a.interlocuteur.slice(0, 20) : '';
            renderRow(label, detail, right, i);

          } else if (item.type === 'event') {
            const ev = item.data;
            const typeLabel = EVENT_TYPE_LABELS[ev.type] || ev.type || 'Événement';
            const label = typeLabel;
            const detail = `${ev.affaire_id ? ev.affaire_id + ' — ' : ''}${ev.client || ''}${ev.location ? ' — ' + ev.location.slice(0, 30) : ''}`;
            renderRow(label, detail, '', i);

          } else if (item.type === 'gcal') {
            const ev = item.data;
            const time = ev.start && ev.start.includes('T')
              ? new Date(ev.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              : '';
            const label = `📅 ${ev.affaire || 'RDV'}`;
            const detail = `${ev.summary || 'RDV Google'}${ev.location ? ' — ' + ev.location.slice(0, 30) : ''}`;
            renderRow(label, detail, time, i);
          }
        });

        doc.moveDown(0.5);
      });

      // ── PIED DE PAGE ──
      doc.moveDown(1);
      doc.moveTo(leftX, doc.y).lineTo(leftX + pageW, doc.y)
        .strokeColor('#cccccc').lineWidth(0.5).stroke();
      doc.moveDown(0.4);
      doc.fontSize(7).font('Helvetica').fillColor('#aaaaaa')
        .text(`Généré par eM@g — ${new Date().toLocaleString('fr-FR')}`, { align: 'center' });

      doc.end();

    } catch (error) {
      logger.error('GET /api/communication/tasks/export-pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erreur génération PDF' });
      }
    }
  };


  // ═══════════════════════════════════════════════

  app.get('/api/communication/tasks/export-pdf', authenticateToken, handleExportPdf);
  app.post('/api/communication/tasks/export-pdf', authenticateToken, handleExportPdf);

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
      logger.error('GET /api/communication/tasks/:id error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/communication/tasks ───
  app.post('/api/communication/tasks', authenticateToken, (req, res) => {
    try {
      const { display_event_id, person_id, date, period, time, end_time, section, title, notes, source_type, source_id, google_event_title, affaire_num, status } = req.body;

      if (!date) {
        return res.status(400).json({ error: 'Le champ date est obligatoire' });
      }

      const id = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex');

      const stmt = db.prepare(`
        INSERT INTO task_assignments (id, display_event_id, person_id, date, period, time, end_time, section, title, notes, source_type, source_id, google_event_title, affaire_num, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      stmt.run(
        id,
        display_event_id || null,
        person_id || null,
        date,
        period || null,
        time || null,
        end_time || null,
        section || 'manual',
        title || null,
        notes || '',
        source_type || 'manual',
        source_id || null,
        google_event_title || null,
        affaire_num || null,
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
      logger.error('POST /api/communication/tasks error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/communication/tasks/batch ───
  // Création en lot de tâches (pour workflow événement → tâches)
  app.post('/api/communication/tasks/batch', authenticateToken, (req, res) => {
    try {
      const { tasks: taskList } = req.body;
      if (!Array.isArray(taskList) || taskList.length === 0) {
        return res.status(400).json({ error: 'Un tableau de tâches est requis' });
      }

      const insertStmt = db.prepare(`
        INSERT INTO task_assignments (id, display_event_id, person_id, date, period, time, end_time, section, title, notes, source_type, source_id, google_event_title, affaire_num, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      const createdIds = [];
      const insertMany = db.transaction((items) => {
        for (const t of items) {
          if (!t.date) continue;
          const id = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex');
          insertStmt.run(
            id,
            t.display_event_id || null,
            t.person_id || null,
            t.date,
            t.period || null,
            t.time || null,
            t.end_time || null,
            t.section || 'manual',
            t.title || null,
            t.notes || '',
            t.source_type || 'manual',
            t.source_id || null,
            t.google_event_title || null,
            t.affaire_num || null,
            t.status || 'pending',
            req.user.id
          );
          createdIds.push(id);
        }
      });

      insertMany(taskList);

      // Retourner les tâches créées
      if (createdIds.length > 0) {
        const placeholders = createdIds.map(() => '?').join(',');
        const created = db.prepare(`
          SELECT ta.*, 
                 p.first_name AS person_first_name,
                 p.last_name AS person_last_name
          FROM task_assignments ta
          LEFT JOIN persons p ON ta.person_id = p.id
          WHERE ta.id IN (${placeholders})
          ORDER BY ta.date ASC, ta.time ASC
        `).all(...createdIds);
        res.status(201).json(created);
      } else {
        res.status(201).json([]);
      }
    } catch (error) {
      logger.error('POST /api/communication/tasks/batch error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── DELETE /api/communication/tasks/by-source/:sourceId ───
  // Supprimer toutes les tâches liées à un événement source
  app.delete('/api/communication/tasks/by-source/:sourceId', authenticateToken, (req, res) => {
    try {
      const result = db.prepare("DELETE FROM task_assignments WHERE source_type = 'google_event' AND source_id = ?").run(req.params.sourceId);
      res.json({ success: true, deleted: result.changes });
    } catch (error) {
      logger.error('DELETE /api/communication/tasks/by-source error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── PUT /api/communication/tasks/:id ───
  app.put('/api/communication/tasks/:id', authenticateToken, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM task_assignments WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Tâche non trouvée' });

      const { display_event_id, person_id, date, period, time, end_time, section, title, notes, source_type, source_id, google_event_title, affaire_num, status } = req.body;

      const stmt = db.prepare(`
        UPDATE task_assignments
        SET display_event_id = ?, person_id = ?, date = ?, period = ?, time = ?, end_time = ?, section = ?, title = ?, notes = ?, source_type = ?, source_id = ?, google_event_title = ?, affaire_num = ?, status = ?, modified_by = ?, modified_at = datetime('now')
        WHERE id = ?
      `);

      stmt.run(
        display_event_id !== undefined ? display_event_id : existing.display_event_id,
        person_id !== undefined ? person_id : existing.person_id,
        date || existing.date,
        period !== undefined ? period : existing.period,
        time !== undefined ? time : existing.time,
        end_time !== undefined ? end_time : existing.end_time,
        section || existing.section,
        title !== undefined ? title : existing.title,
        notes !== undefined ? notes : existing.notes,
        source_type || existing.source_type,
        source_id !== undefined ? source_id : existing.source_id,
        google_event_title !== undefined ? google_event_title : existing.google_event_title,
        affaire_num !== undefined ? affaire_num : existing.affaire_num,
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
      logger.error('PUT /api/communication/tasks/:id error:', error);
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
      logger.error('DELETE /api/communication/tasks/:id error:', error);
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
      logger.error('GET /api/communication/stats error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });


  // AFFAIRES POUR PLANNING — Filtrage par date
  // ═══════════════════════════════════════════════

  // ─── GET /api/communication/planning-affaires ───
  // Retourne les affaires actives pour une date ou plage de dates
  // Params: date (YYYY-MM-DD) ou dateFrom + dateTo
  app.get('/api/communication/planning-affaires', authenticateToken, (req, res) => {
    try {
      const { date, dateFrom, dateTo } = req.query;

      let query, params;

      if (date) {
        // Affaires dont la période couvre cette date
        // date_debut <= date AND (date_fin IS NULL OR date_fin = '' OR date_fin >= date)
        query = `
          SELECT a.*, 
            (SELECT COUNT(*) FROM bl_imports WHERE affaire_id = a.numero_affaire) as bl_count,
            (SELECT COUNT(*) FROM dynamic_display_events WHERE affaire_id = a.numero_affaire) as events_count
          FROM affaires a
          WHERE a.date_debut <= ?
            AND (a.date_fin IS NULL OR a.date_fin = '' OR a.date_fin >= ?)
          ORDER BY a.type, a.date_debut
        `;
        params = [date, date];
      } else if (dateFrom && dateTo) {
        // Affaires dont la période chevauche la plage
        // date_debut <= dateTo AND (date_fin IS NULL OR date_fin = '' OR date_fin >= dateFrom)
        query = `
          SELECT a.*, 
            (SELECT COUNT(*) FROM bl_imports WHERE affaire_id = a.numero_affaire) as bl_count,
            (SELECT COUNT(*) FROM dynamic_display_events WHERE affaire_id = a.numero_affaire) as events_count
          FROM affaires a
          WHERE a.date_debut <= ?
            AND (a.date_fin IS NULL OR a.date_fin = '' OR a.date_fin >= ?)
          ORDER BY a.type, a.date_debut
        `;
        params = [dateTo, dateFrom];
      } else {
        // Sans filtre de date : toutes les affaires actives (non archivées)
        const today = new Date().toISOString().slice(0, 10);
        query = `
          SELECT a.*, 
            (SELECT COUNT(*) FROM bl_imports WHERE affaire_id = a.numero_affaire) as bl_count,
            (SELECT COUNT(*) FROM dynamic_display_events WHERE affaire_id = a.numero_affaire) as events_count
          FROM affaires a
          WHERE a.date_fin IS NULL OR a.date_fin = '' OR a.date_fin >= ?
          ORDER BY a.type, a.date_debut
        `;
        params = [today];
      }

      const affaires = db.prepare(query).all(...params);
      res.json(affaires);
    } catch (error) {
      logger.error('GET /api/communication/planning-affaires error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── PATCH /api/communication/tasks/:id/toggle-visible ───
  // Basculer la visibilité d'une tâche (affichage écran dynamique)
  app.patch('/api/communication/tasks/:id/toggle-visible', authenticateToken, (req, res) => {
    try {
      const task = db.prepare('SELECT * FROM task_assignments WHERE id = ?').get(req.params.id);
      if (!task) return res.status(404).json({ error: 'Tâche non trouvée' });

      const newVisible = (task.visible === 0) ? 1 : 0;
      db.prepare('UPDATE task_assignments SET visible = ?, modified_by = ?, modified_at = datetime(\'now\') WHERE id = ?')
        .run(newVisible, req.user.id, req.params.id);

      const updated = db.prepare(`
        SELECT ta.*, p.first_name AS person_first_name, p.last_name AS person_last_name
        FROM task_assignments ta
        LEFT JOIN persons p ON ta.person_id = p.id
        WHERE ta.id = ?
      `).get(req.params.id);
      res.json(updated);
    } catch (error) {
      logger.error('PATCH /api/communication/tasks/:id/toggle-visible error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── PATCH /api/communication/display-events/:id/toggle-visible ───
  // Basculer la visibilité d'un événement d'affichage
  app.patch('/api/communication/display-events/:id/toggle-visible', authenticateToken, (req, res) => {
    try {
      const event = db.prepare('SELECT * FROM dynamic_display_events WHERE id = ?').get(req.params.id);
      if (!event) return res.status(404).json({ error: 'Événement non trouvé' });

      const newVisible = event.visible === 0 ? 1 : 0;
      db.prepare('UPDATE dynamic_display_events SET visible = ?, modified_by = ?, modified_at = datetime(\'now\') WHERE id = ?')
        .run(newVisible, req.user.id, req.params.id);

      const updated = db.prepare('SELECT * FROM dynamic_display_events WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (error) {
      logger.error('PATCH /api/communication/display-events/:id/toggle-visible error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── PUT /api/communication/display-events/:id/assign ───
  // Affecter un personnel à un événement d'affichage
  app.put('/api/communication/display-events/:id/assign', authenticateToken, (req, res) => {
    try {
      const { person_id } = req.body;
      const event = db.prepare('SELECT * FROM dynamic_display_events WHERE id = ?').get(req.params.id);
      if (!event) return res.status(404).json({ error: 'Événement non trouvé' });

      // Vérifier si la colonne assigned_person_id existe, sinon la créer
      const columns = db.pragma('table_info(dynamic_display_events)');
      if (!columns.find(c => c.name === 'assigned_person_id')) {
        db.exec('ALTER TABLE dynamic_display_events ADD COLUMN assigned_person_id INTEGER DEFAULT NULL');
      }

      db.prepare('UPDATE dynamic_display_events SET assigned_person_id = ? WHERE id = ?')
        .run(person_id || null, req.params.id);

      const updated = db.prepare(`
        SELECT de.*, p.prenom as assigned_person_first_name, p.nom as assigned_person_last_name
        FROM dynamic_display_events de
        LEFT JOIN persons p ON p.id = de.assigned_person_id
        WHERE de.id = ?
      `).get(req.params.id);

      res.json(updated);
    } catch (error) {
      logger.error('PUT /api/communication/display-events/:id/assign error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

}
