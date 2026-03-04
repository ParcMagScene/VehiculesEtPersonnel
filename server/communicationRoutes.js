// ═══════════════════════════════════════════════════════════════
// Module Communication — Routes API
// Affichage dynamique + Import BL + Planification des tâches
// ═══════════════════════════════════════════════════════════════

import db from './database.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import logger from './logger.js';
import { statsCache, listCache, icalCache, cacheMiddleware } from './cache.js';

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

      const id = crypto.randomUUID().replace(/-/g, '');

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

      const id = crypto.randomUUID().replace(/-/g, '');

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
      // Fallback : utiliser pd.numero si affaire_id non fourni
      let linkedAffaireId = affaire_id || pd?.numero || null;
      let affaireCreated = false;
      if (linkedAffaireId) {
        const existingAffaire = db.prepare('SELECT id, numero_affaire FROM affaires WHERE numero_affaire = ?').get(linkedAffaireId);
        if (!existingAffaire) {
          // Créer l'affaire automatiquement à partir des données parsées
          try {
            const today = new Date().toISOString().slice(0, 10);

            // Extraire date_debut et date_fin depuis les sections si disponibles
            let dateDebut = pd?.date || pd?.dateLivraison || pd?.dateDebut || null;
            let dateFin = pd?.dateFin || null;
            if (pd?.sections && Array.isArray(pd.sections) && pd.sections.length > 0) {
              for (const sec of pd.sections) {
                const dmDebut = sec.dateDebut?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                if (dmDebut) {
                  const iso = `${dmDebut[3]}-${dmDebut[2]}-${dmDebut[1]}`;
                  if (!dateDebut || iso < dateDebut) dateDebut = iso;
                }
                const dmFin = sec.dateFin?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                if (dmFin) {
                  const iso = `${dmFin[3]}-${dmFin[2]}-${dmFin[1]}`;
                  if (!dateFin || iso > dateFin) dateFin = iso;
                }
              }
            }

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
              dateDebut || today,
              dateFin || '',
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
      if (req.query.affaire_num) {
        query += ' AND ta.affaire_num = ?';
        params.push(req.query.affaire_num);
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

      // ── Index affaires par numéro (pour enrichir les titres de tâches) ──
      const affaireByNum = new Map();
      affaires.forEach(a => {
        if (a.numero_affaire) affaireByNum.set(a.numero_affaire.toUpperCase(), a);
      });
      // Inclure aussi les affaires de la date (pour enrichir les tâches même si affaire non sélectionnée)
      const allDateAffaires = db.prepare(`
        SELECT * FROM affaires
        WHERE date_debut <= ? AND (date_fin IS NULL OR date_fin = '' OR date_fin >= ?)
      `).all(date, date);
      allDateAffaires.forEach(a => {
        if (a.numero_affaire && !affaireByNum.has(a.numero_affaire.toUpperCase())) {
          affaireByNum.set(a.numero_affaire.toUpperCase(), a);
        }
      });

      // ── Helper: Nettoyer les caractères non supportés par Helvetica (emojis, symboles) ──
      const stripEmoji = (str) => {
        if (!str) return '';
        return str
          .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
          .replace(/[\u2700-\u27BF]/g, '')
          .replace(/[\u2190-\u21FF]/g, '->')  // flèches
          .replace(/\u2014|\u2013/g, '-')      // tirets longs
          .replace(/\u2018|\u2019/g, "'")     // apostrophes courbes
          .replace(/\u201C|\u201D/g, '"')     // guillemets courbes
          .replace(/\u2026/g, '...')            // ellipse
          .replace(/\u00A0/g, ' ')              // espace insécable
          .replace(/\s{2,}/g, ' ')
          .trim();
      };

      // ── Sections & couleurs ──
      const SECTIONS = {
        rdv:                 { label: 'RDV du jour' },
        taches_prioritaires: { label: 'Tâches Prioritaires' },
        courses:             { label: 'Courses' },
        prep_locations:      { label: 'Préparations Locations' },
        prep_prestations:    { label: 'Préparations Prestations' },
        prep_ventes:         { label: 'Préparations Ventes' },
        prep_installations:  { label: 'Préparations Installations' },
        chargement:          { label: 'Chargement' },
        depart:              { label: 'Départ' },
        enlevement:          { label: 'Enlèvement' },
        retour:              { label: 'Retour' },
        recuperation:        { label: 'Récupération' },
        installation:        { label: 'Installation' },
        evenements:          { label: 'Autres Événements' },
        taches_secondaires:  { label: 'Tâches Secondaires' },
        manual:              { label: 'Autres' },
      };

      const SECTION_COLORS = {
        rdv:                 [5, 150, 105],
        evenements:          [100, 116, 139],
        prep_locations:      [245, 158, 11],
        prep_prestations:    [59, 130, 246],
        prep_ventes:         [16, 185, 129],
        prep_installations:  [139, 92, 246],
        chargement:          [245, 158, 11],
        depart:              [59, 130, 246],
        enlevement:          [16, 185, 129],
        retour:              [139, 92, 246],
        recuperation:        [239, 68, 68],
        installation:        [16, 185, 129],
        taches_prioritaires: [239, 68, 68],
        taches_secondaires:  [245, 158, 11],
        prep_tournees:       [236, 72, 153],
        courses:             [139, 92, 246],
        manual:              [100, 116, 139],
      };

      const AFFAIRE_TYPE_MAP = {
        'Prestation': 'prep_prestations', 'Location': 'prep_locations',
        'Vente': 'prep_ventes', 'Installation': 'prep_installations',
        'Tournée': 'prep_tournees',
      };

      const EVENT_TYPE_MAP = {
        preparation: 'prep_locations', livraison: 'taches_prioritaires',
        enlevement: 'taches_prioritaires', depart: 'taches_prioritaires',
        retour: 'taches_secondaires', recuperation: 'taches_secondaires',
        montage: 'montage', demontage: 'demontage',
      };

      const EVENT_TYPE_LABELS = {
        preparation: 'Préparation', enlevement: 'Enlèvement', livraison: 'Livraison',
        depart: 'Départ', retour: 'Retour', recuperation: 'Récupération',
        montage: 'Montage', demontage: 'Démontage',
      };

      const STATUS_LABELS = {
        pending: 'Effectué', in_progress: 'En cours',
        done: 'Fait', cancelled: 'Annulé',
      };

      // Helper: dessiner une case à cocher carrée
      const drawCheckbox = (x, y, checked = false, size = 10) => {
        doc.save();
        doc.rect(x, y, size, size)
          .strokeColor('#333333').lineWidth(0.8).stroke();
        if (checked) {
          // Coche à l'intérieur
          doc.moveTo(x + 2, y + size / 2)
            .lineTo(x + size / 2 - 0.5, y + size - 2.5)
            .lineTo(x + size - 1.5, y + 2)
            .strokeColor('#333333').lineWidth(1.2).stroke();
        }
        doc.restore();
      };

      // ── Sections qui sont "affaire only" (le label est redondant dans le titre des tâches) ──
      const AFFAIRE_ONLY_SECTIONS = new Set([
        'prep_locations', 'prep_prestations', 'prep_ventes', 'prep_installations',
        'chargement', 'depart', 'enlevement', 'retour', 'recuperation', 'installation',
        'montage', 'demontage',
      ]);

      // Nettoyer le titre d'une tâche pour le PDF (supprimer doublons avec section/affaire)
      const cleanTaskTitle = (task, sectionKey) => {
        let title = stripEmoji(task.title || '-');
        const googleTitle = task.google_event_title || '';
        // Extraire le N° d'affaire depuis le champ OU depuis le titre/google_event_title
        const affNum = task.affaire_num
          || ((task.title || '').match(/\bAF\s*\d{3,}/i) || [''])[0].toUpperCase().replace(/\s+/g, '')
          || ((task.google_event_title || '').match(/\bAF\s*\d{3,}/i) || [''])[0].toUpperCase().replace(/\s+/g, '')
          || '';

        // 1. Retirer le suffixe " - eventSummary" (tâches Google: "Label - Summary")
        if (googleTitle) {
          const dashIdx = title.indexOf(' - ');
          if (dashIdx >= 0) {
            const suffix = title.slice(dashIdx + 3).trim();
            if (suffix.toLowerCase() === stripEmoji(googleTitle).trim().toLowerCase()) {
              title = title.slice(0, dashIdx).trim();
            }
          }
        }
        // 2. Retirer le label de section (redondant avec le bandeau)
        if (AFFAIRE_ONLY_SECTIONS.has(sectionKey)) {
          title = title
            .replace(/^(Preparation|Préparation|Chargement|Depart|Départ|Enlevement|Enlèvement|Retour|Recuperation|Récupération|Installation|Livraison)\s*-?\s*/i, '')
            .trim();
          // Si vide, utiliser le google_event_title ou les notes
          if (!title) {
            title = stripEmoji(googleTitle) || task.notes || '-';
          }
        }
        // 3. Retirer le N° d'affaire du titre (déjà affiché en badge)
        if (affNum) {
          const escaped = affNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          title = title.replace(new RegExp(escaped, 'gi'), '').replace(/\s{2,}/g, ' ').trim();
        }
        // 4. Enrichir avec client/titre de l'affaire si titre trop générique
        const linkedAffaire = affNum ? affaireByNum.get(affNum.toUpperCase()) : null;
        if (linkedAffaire && (!title || /^(Location|Prestation|Vente|Installation|Livraison)\s*$/i.test(title))) {
          title = stripEmoji(linkedAffaire.client || linkedAffaire.titre || linkedAffaire.event_name || title || '-');
        }
        return title || '-';
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

      // ── Générer le PDF (tout sur 1 page) ──
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 25, bottom: 20, left: 25, right: 25 },
        info: {
          Title: `Fiche du jour - ${dateFr}`,
          Author: 'eM@g - Mag Scène',
          Subject: 'Planification journalière',
        }
      });

      const filename = `fiche-${date}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      doc.pipe(res);

      const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const leftX = doc.page.margins.left;
      const pageH = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;

      // ── Calcul dynamique pour tenir en 1 page ──
      const nonEmptySections = Object.entries(SECTIONS).filter(([key]) => (grouped[key] || []).length > 0);
      const totalSections = nonEmptySections.length;
      const FREE_LINES = Math.max(2, Math.min(5, 6 - Math.floor(totalItems / 12)));
      const HEADER_H = 38;
      const FOOTER_H = 12;
      const BANNER_H = 15;
      const SECTION_GAP = 2;
      const FREE_LINE_H = 16;
      const sectionOverhead = totalSections * (BANNER_H + SECTION_GAP);
      const notesH = BANNER_H + FREE_LINES * FREE_LINE_H + 6;
      const availableForItems = pageH - HEADER_H - FOOTER_H - sectionOverhead - notesH - 8;
      const rowH = Math.max(10, Math.min(17, Math.floor(availableForItems / Math.max(totalItems, 1))));
      const fs = rowH <= 11 ? 6.5 : rowH <= 13 ? 7.5 : 8;
      const fsSmall = fs - 1;
      const cbSize = Math.min(7, rowH - 3);

      // ── Badge helper ──
      const drawBadge = (text, x, y, color = '#f59e0b') => {
        if (!text) return 0;
        doc.save();
        const bfs = Math.max(5, fs - 1);
        doc.font('Helvetica-Bold').fontSize(bfs);
        const tw = doc.widthOfString(text);
        const bw = tw + 6;
        const bh = bfs + 4;
        const by = y + Math.max(0, (rowH - bh) / 2);
        doc.roundedRect(x, by, bw, bh, 2).fillColor(color).fill();
        doc.fillColor('#ffffff').text(text, x + 3, by + 1.5, { width: tw + 2, lineBreak: false });
        doc.restore();
        return bw + 3;
      };

      // Couleur badge selon section
      const getBadgeColor = (sectionKey) => {
        if (sectionKey.includes('location')) return '#d97706';
        if (sectionKey.includes('prestation')) return '#2563eb';
        if (sectionKey.includes('vente')) return '#7c3aed';
        if (sectionKey.includes('installation')) return '#059669';
        if (sectionKey === 'chargement') return '#d97706';
        if (sectionKey === 'depart') return '#2563eb';
        if (sectionKey === 'enlevement' || sectionKey === 'recuperation') return '#059669';
        if (sectionKey === 'retour') return '#7c3aed';
        return '#6b7280';
      };

      // ── EN-TÊTE (compact) ──
      doc.fontSize(16).font('Helvetica-Bold').text('Fiche du jour', { align: 'center' });
      doc.moveDown(0.15);
      doc.fontSize(10).font('Helvetica').text(dateFr.charAt(0).toUpperCase() + dateFr.slice(1), { align: 'center' });
      doc.moveDown(0.1);
      doc.fontSize(7).fillColor('#999999')
        .text(`${totalItems} élément${totalItems > 1 ? 's' : ''}`, { align: 'center' });
      doc.fillColor('#000000');
      doc.moveDown(0.3);
      doc.moveTo(leftX, doc.y).lineTo(leftX + pageW, doc.y)
        .strokeColor('#cccccc').lineWidth(0.5).stroke();
      doc.moveDown(0.3);

      // ── SECTIONS ──
      nonEmptySections.forEach(([key, info]) => {
        const items = grouped[key] || [];
        const color = SECTION_COLORS[key] || [100, 100, 100];
        const hexColor = `#${color.map(c => c.toString(16).padStart(2, '0')).join('')}`;
        const badgeColor = getBadgeColor(key);

        // Bandeau de section (compact)
        const bannerY = doc.y;
        doc.rect(leftX, bannerY, pageW, BANNER_H).fillColor(hexColor).fill();
        doc.fontSize(fs + 1).font('Helvetica-Bold').fillColor('#ffffff')
          .text(`${info.label} (${items.length})`, leftX + 6, bannerY + 3, { width: pageW - 12 });
        doc.fillColor('#000000');
        doc.y = bannerY + BANNER_H + 1;

        items.forEach((item, i) => {
          if (item.type === 'task') {
            const t = item.data;
            const statusLabel = STATUS_LABELS[t.status] || '[ ]';
            const titleStr = cleanTaskTitle(t, key);
            // Extraire le N° d'affaire depuis le champ OU depuis le titre/google_event_title
            const affNum = t.affaire_num
              || ((t.title || '').match(/\bAF\s*\d{3,}/i) || [''])[0].toUpperCase().replace(/\s+/g, '')
              || ((t.google_event_title || '').match(/\bAF\s*\d{3,}/i) || [''])[0].toUpperCase().replace(/\s+/g, '')
              || '';
            const personStr = (t.person_first_name || t.person_last_name)
              ? `${t.person_first_name || ''} ${t.person_last_name ? t.person_last_name.charAt(0) + '.' : ''}`.trim()
              : '';

            const rowY = doc.y;
            if (i % 2 === 0) {
              doc.rect(leftX, rowY, pageW, rowH).fillColor('#f8f9fa').fill();
            }
            // Case à cocher
            const cbX = leftX + 3;
            const cbY = rowY + Math.max(1, (rowH - cbSize) / 2);
            drawCheckbox(cbX, cbY, t.status === 'done', cbSize);
            // Statut
            doc.font('Helvetica').fontSize(fsSmall).fillColor('#777777')
              .text(statusLabel, cbX + cbSize + 3, rowY + 2, { width: 44, lineBreak: false });
            // Badge N° affaire
            let titleX = leftX + 56;
            if (affNum) {
              const badgeW = drawBadge(affNum, titleX, rowY, badgeColor);
              titleX += badgeW;
            }
            // Titre
            const titleW = leftX + pageW - titleX - 110;
            if (t.status === 'done') {
              doc.font('Helvetica-Oblique').fontSize(fs).fillColor('#999999');
            } else {
              doc.font('Helvetica').fontSize(fs).fillColor('#111111');
            }
            doc.text(titleStr, titleX, rowY + 2, { width: Math.max(titleW, 60), lineBreak: false });
            if (t.status === 'done') {
              const tw = doc.widthOfString(titleStr, { width: titleW });
              doc.moveTo(titleX, rowY + rowH / 2).lineTo(titleX + Math.min(tw, titleW), rowY + rowH / 2)
                .strokeColor('#999999').lineWidth(0.4).stroke();
            }
            // Personne (droite)
            if (personStr) {
              doc.font('Helvetica').fontSize(fsSmall).fillColor('#555555')
                .text(personStr, leftX + pageW - 105, rowY + 2, { width: 60, lineBreak: false });
            }
            // Client (extrême droite)
            if (t.event_client) {
              doc.font('Helvetica').fontSize(fsSmall).fillColor('#888888')
                .text(t.event_client.slice(0, 12), leftX + pageW - 45, rowY + 2, { width: 42, lineBreak: false, align: 'right' });
            }
            doc.fillColor('#000000');
            doc.y = rowY + rowH;

          } else if (item.type === 'affaire' || item.type === 'affaire-rdv') {
            const a = item.data;
            const rowY = doc.y;
            if (i % 2 === 0) {
              doc.rect(leftX, rowY, pageW, rowH).fillColor('#f8f9fa').fill();
            }
            // Badge N° affaire
            let contentX = leftX + 4;
            if (a.numero_affaire) {
              const badgeW = drawBadge(a.numero_affaire, contentX, rowY, badgeColor);
              contentX += badgeW;
            }
            // Détail
            const detail = `${a.type || ''} - ${a.client || 'Sans client'}${a.adresse_livraison ? ' - ' + a.adresse_livraison.split('\n')[0].slice(0, 35) : ''}`;
            doc.font('Helvetica').fontSize(fs).fillColor('#111111')
              .text(stripEmoji(detail), contentX, rowY + 2, { width: leftX + pageW - contentX - 60, lineBreak: false });
            if (a.interlocuteur) {
              doc.font('Helvetica').fontSize(fsSmall).fillColor('#555555')
                .text(a.interlocuteur.slice(0, 18), leftX + pageW - 55, rowY + 2, { width: 52, lineBreak: false, align: 'right' });
            }
            doc.fillColor('#000000');
            doc.y = rowY + rowH;

          } else if (item.type === 'event') {
            const ev = item.data;
            const typeLabel = EVENT_TYPE_LABELS[ev.type] || ev.type || 'Evenement';
            const isRedundant = AFFAIRE_ONLY_SECTIONS.has(key);
            const rowY = doc.y;
            if (i % 2 === 0) {
              doc.rect(leftX, rowY, pageW, rowH).fillColor('#f8f9fa').fill();
            }
            // Badge affaire_id si présent
            let contentX = leftX + 4;
            if (ev.affaire_id) {
              const badgeW = drawBadge(ev.affaire_id, contentX, rowY, badgeColor);
              contentX += badgeW;
            }
            // Label + detail
            let detail;
            if (isRedundant) {
              const parts = [];
              if (ev.client) parts.push(ev.client);
              if (ev.location) parts.push(ev.location.slice(0, 25));
              detail = parts.join(' - ') || '-';
            } else {
              if (!ev.affaire_id) {
                detail = `${typeLabel} - ${ev.client || ''}${ev.location ? ' - ' + ev.location.slice(0, 25) : ''}`;
              } else {
                detail = `${typeLabel}${ev.client ? ' - ' + ev.client : ''}${ev.location ? ' - ' + ev.location.slice(0, 25) : ''}`;
              }
            }
            doc.font('Helvetica').fontSize(fs).fillColor('#111111')
              .text(stripEmoji(detail) || '-', contentX, rowY + 2, { width: leftX + pageW - contentX - 10, lineBreak: false });
            doc.fillColor('#000000');
            doc.y = rowY + rowH;

          } else if (item.type === 'gcal') {
            const ev = item.data;
            const time = ev.start && ev.start.includes('T')
              ? new Date(ev.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              : '';
            const rowY = doc.y;
            if (i % 2 === 0) {
              doc.rect(leftX, rowY, pageW, rowH).fillColor('#f8f9fa').fill();
            }
            // Badge affaire si présent
            let contentX = leftX + 4;
            if (ev.affaire) {
              const badgeW = drawBadge(ev.affaire, contentX, rowY, badgeColor);
              contentX += badgeW;
            }
            const detail = `${stripEmoji(ev.summary) || 'RDV Google'}${ev.location ? ' - ' + ev.location.slice(0, 25) : ''}`;
            doc.font('Helvetica').fontSize(fs).fillColor('#111111')
              .text(detail, contentX, rowY + 2, { width: leftX + pageW - contentX - 50, lineBreak: false });
            if (time) {
              doc.font('Helvetica').fontSize(fsSmall).fillColor('#555555')
                .text(time, leftX + pageW - 40, rowY + 2, { width: 38, lineBreak: false, align: 'right' });
            }
            doc.fillColor('#000000');
            doc.y = rowY + rowH;
          }
        });

        doc.y += SECTION_GAP;
      });

      // ── SECTION LIBRE : lignes pour notes manuscrites ──
      const freeY = doc.y;
      doc.rect(leftX, freeY, pageW, BANNER_H).fillColor('#6b7280').fill();
      doc.fontSize(fs + 1).font('Helvetica-Bold').fillColor('#ffffff')
        .text('Notes / Tâches supplémentaires', leftX + 6, freeY + 3, { width: pageW - 12 });
      doc.fillColor('#000000');
      doc.y = freeY + BANNER_H + 2;

      for (let i = 0; i < FREE_LINES; i++) {
        const ly = doc.y;
        drawCheckbox(leftX + 3, ly + Math.max(1, (FREE_LINE_H - cbSize) / 2), false, cbSize);
        doc.moveTo(leftX + cbSize + 8, ly + FREE_LINE_H - 3)
          .lineTo(leftX + pageW, ly + FREE_LINE_H - 3)
          .strokeColor('#cccccc').lineWidth(0.3).dash(3, { space: 2 }).stroke();
        doc.undash();
        doc.y = ly + FREE_LINE_H;
      }

      // ── PIED DE PAGE ──
      doc.moveDown(0.4);
      doc.moveTo(leftX, doc.y).lineTo(leftX + pageW, doc.y)
        .strokeColor('#cccccc').lineWidth(0.4).stroke();
      doc.moveDown(0.2);
      doc.fontSize(6).font('Helvetica').fillColor('#bbbbbb')
        .text(`Généré par eM@g - ${new Date().toLocaleString('fr-FR')}`, { align: 'center' });

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

      const id = crypto.randomUUID().replace(/-/g, '');

      // RDV/événements masqués par défaut sur l'écran TV (visible=0)
      const effectiveSection = section || 'manual';
      const EVENT_SECTIONS = ['rdv', 'evenements'];
      const defaultVisible = EVENT_SECTIONS.includes(effectiveSection) ? 0 : 1;

      const stmt = db.prepare(`
        INSERT INTO task_assignments (id, display_event_id, person_id, date, period, time, end_time, section, title, notes, source_type, source_id, google_event_title, affaire_num, status, visible, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      stmt.run(
        id,
        display_event_id || null,
        person_id || null,
        date,
        period || null,
        time || null,
        end_time || null,
        effectiveSection,
        title || null,
        notes || '',
        source_type || 'manual',
        source_id || null,
        google_event_title || null,
        affaire_num || null,
        status || 'pending',
        defaultVisible,
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

      const EVENT_SECTIONS_BATCH = ['rdv', 'evenements'];
      const insertStmt = db.prepare(`
        INSERT INTO task_assignments (id, display_event_id, person_id, date, period, time, end_time, section, title, notes, source_type, source_id, google_event_title, affaire_num, status, visible, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      const createdIds = [];
      const insertMany = db.transaction((items) => {
        for (const t of items) {
          if (!t.date) continue;
          const id = crypto.randomUUID().replace(/-/g, '');
          const sect = t.section || 'manual';
          const vis = EVENT_SECTIONS_BATCH.includes(sect) ? 0 : 1;
          insertStmt.run(
            id,
            t.display_event_id || null,
            t.person_id || null,
            t.date,
            t.period || null,
            t.time || null,
            t.end_time || null,
            sect,
            t.title || null,
            t.notes || '',
            t.source_type || 'manual',
            t.source_id || null,
            t.google_event_title || null,
            t.affaire_num || null,
            t.status || 'pending',
            vis,
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

  // ─── GET /api/communication/stats ─── [PERF] Cache 20s
  app.get('/api/communication/stats', authenticateToken, cacheMiddleware(statsCache, () => 'comm-stats', 20_000), (req, res) => {
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

  // ─── GET /api/communication/planning-affaires ─── [PERF] Cache 15s par clé date
  // Retourne les affaires actives pour une date ou plage de dates
  // Params: date (YYYY-MM-DD) ou dateFrom + dateTo
  app.get('/api/communication/planning-affaires', authenticateToken, cacheMiddleware(listCache, (req) => `planning-affaires-${req.query.date || ''}-${req.query.dateFrom || ''}-${req.query.dateTo || ''}`, 15_000), (req, res) => {
    try {
      const { date, dateFrom, dateTo } = req.query;

      let query, params;

      if (date) {
        // Affaires dont la période couvre cette date ET qui ont des tâches, BL ou événements
        query = `
          SELECT a.*, 
            (SELECT COUNT(*) FROM bl_imports WHERE affaire_id = a.numero_affaire) as bl_count,
            (SELECT COUNT(*) FROM dynamic_display_events WHERE affaire_id = a.numero_affaire) as events_count,
            (SELECT COUNT(*) FROM task_assignments WHERE affaire_num = a.numero_affaire) as task_count
          FROM affaires a
          WHERE a.date_debut <= ?
            AND (a.date_fin IS NULL OR a.date_fin = '' OR a.date_fin >= ?)
            AND (
              EXISTS (SELECT 1 FROM bl_imports WHERE affaire_id = a.numero_affaire)
              OR EXISTS (SELECT 1 FROM dynamic_display_events WHERE affaire_id = a.numero_affaire)
              OR EXISTS (SELECT 1 FROM task_assignments WHERE affaire_num = a.numero_affaire)
            )
          ORDER BY a.type, a.date_debut
        `;
        params = [date, date];
      } else if (dateFrom && dateTo) {
        // Affaires dont la période chevauche la plage ET qui ont des tâches, BL ou événements
        query = `
          SELECT a.*, 
            (SELECT COUNT(*) FROM bl_imports WHERE affaire_id = a.numero_affaire) as bl_count,
            (SELECT COUNT(*) FROM dynamic_display_events WHERE affaire_id = a.numero_affaire) as events_count,
            (SELECT COUNT(*) FROM task_assignments WHERE affaire_num = a.numero_affaire) as task_count
          FROM affaires a
          WHERE a.date_debut <= ?
            AND (a.date_fin IS NULL OR a.date_fin = '' OR a.date_fin >= ?)
            AND (
              EXISTS (SELECT 1 FROM bl_imports WHERE affaire_id = a.numero_affaire)
              OR EXISTS (SELECT 1 FROM dynamic_display_events WHERE affaire_id = a.numero_affaire)
              OR EXISTS (SELECT 1 FROM task_assignments WHERE affaire_num = a.numero_affaire)
            )
          ORDER BY a.type, a.date_debut
        `;
        params = [dateTo, dateFrom];
      } else {
        // Sans filtre de date : toutes les affaires actives (non archivées) avec activité
        const today = new Date().toISOString().slice(0, 10);
        query = `
          SELECT a.*, 
            (SELECT COUNT(*) FROM bl_imports WHERE affaire_id = a.numero_affaire) as bl_count,
            (SELECT COUNT(*) FROM dynamic_display_events WHERE affaire_id = a.numero_affaire) as events_count,
            (SELECT COUNT(*) FROM task_assignments WHERE affaire_num = a.numero_affaire) as task_count
          FROM affaires a
          WHERE (a.date_fin IS NULL OR a.date_fin = '' OR a.date_fin >= ?)
            AND (
              EXISTS (SELECT 1 FROM bl_imports WHERE affaire_id = a.numero_affaire)
              OR EXISTS (SELECT 1 FROM dynamic_display_events WHERE affaire_id = a.numero_affaire)
              OR EXISTS (SELECT 1 FROM task_assignments WHERE affaire_num = a.numero_affaire)
            )
          ORDER BY a.type, a.date_debut
        `;
        params = [today];
      }

      const affaires = db.prepare(query).all(...params);

      // Filtrer les affaires masquées de la planification
      const hiddenSet = new Set(
        db.prepare('SELECT numero_affaire FROM planning_hidden_affaires').all().map(r => r.numero_affaire)
      );
      const visible = affaires.filter(a => !hiddenSet.has(a.numero_affaire));

      res.json(visible);
    } catch (error) {
      logger.error('GET /api/communication/planning-affaires error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/communication/planning-hidden-affaires/:id ───
  // Masquer une affaire de la planification
  app.post('/api/communication/planning-hidden-affaires/:id', authenticateToken, (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('INSERT OR IGNORE INTO planning_hidden_affaires (numero_affaire) VALUES (?)').run(id);
      res.json({ success: true, hidden: id });
    } catch (error) {
      logger.error('POST /api/communication/planning-hidden-affaires error:', error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ─── DELETE /api/communication/planning-hidden-affaires/:id ───
  // Réafficher une affaire dans la planification
  app.delete('/api/communication/planning-hidden-affaires/:id', authenticateToken, (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM planning_hidden_affaires WHERE numero_affaire = ?').run(id);
      res.json({ success: true, unhidden: id });
    } catch (error) {
      logger.error('DELETE /api/communication/planning-hidden-affaires error:', error);
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

      db.prepare('UPDATE dynamic_display_events SET assigned_person_id = ? WHERE id = ?')
        .run(person_id || null, req.params.id);

      const updated = db.prepare(`
        SELECT de.*, p.first_name as assigned_person_first_name, p.last_name as assigned_person_last_name
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

  // ═══════════════════════════════════════════════════════════════
  // ──────── TÂCHES RÉCURRENTES ─────────────────────────────────
  // ═══════════════════════════════════════════════════════════════

  // GET /api/communication/recurring-tasks
  app.get('/api/communication/recurring-tasks', authenticateToken, (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM recurring_tasks ORDER BY created_at DESC').all();
      res.json({ recurringTasks: rows });
    } catch (error) {
      logger.error('GET /api/communication/recurring-tasks error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/communication/recurring-tasks
  app.post('/api/communication/recurring-tasks', authenticateToken, (req, res) => {
    try {
      const { title, section, time, period, recurrence, day_of_week, day_of_month, notes } = req.body;
      if (!title || !title.trim()) return res.status(400).json({ error: 'Titre requis' });
      const id = crypto.randomUUID().replace(/-/g, '');
      db.prepare(`
        INSERT INTO recurring_tasks (id, title, section, time, period, recurrence, day_of_week, day_of_month, notes, active, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
      `).run(id, title.trim(), section || 'manual', time || null, period || null, recurrence || 'daily', day_of_week ?? null, day_of_month ?? null, notes || '', req.user.id);
      const created = db.prepare('SELECT * FROM recurring_tasks WHERE id = ?').get(id);
      res.json(created);
    } catch (error) {
      logger.error('POST /api/communication/recurring-tasks error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // PUT /api/communication/recurring-tasks/:id
  app.put('/api/communication/recurring-tasks/:id', authenticateToken, (req, res) => {
    try {
      const { title, section, time, period, recurrence, day_of_week, day_of_month, notes, active } = req.body;
      db.prepare(`
        UPDATE recurring_tasks SET title = ?, section = ?, time = ?, period = ?, recurrence = ?, day_of_week = ?, day_of_month = ?, notes = ?, active = ?
        WHERE id = ?
      `).run(title, section || 'manual', time || null, period || null, recurrence || 'daily', day_of_week ?? null, day_of_month ?? null, notes || '', active ?? 1, req.params.id);
      const updated = db.prepare('SELECT * FROM recurring_tasks WHERE id = ?').get(req.params.id);
      if (!updated) return res.status(404).json({ error: 'Tâche récurrente introuvable' });
      res.json(updated);
    } catch (error) {
      logger.error('PUT /api/communication/recurring-tasks/:id error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // DELETE /api/communication/recurring-tasks/:id
  app.delete('/api/communication/recurring-tasks/:id', authenticateToken, (req, res) => {
    try {
      const result = db.prepare('DELETE FROM recurring_tasks WHERE id = ?').run(req.params.id);
      if (result.changes === 0) return res.status(404).json({ error: 'Introuvable' });
      res.json({ success: true });
    } catch (error) {
      logger.error('DELETE /api/communication/recurring-tasks error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/communication/recurring-tasks/generate
  // Génère les tâches récurrentes pour une date donnée
  app.post('/api/communication/recurring-tasks/generate', authenticateToken, (req, res) => {
    try {
      const { date } = req.body;
      if (!date) return res.status(400).json({ error: 'Date requise' });
      const count = generateRecurringTasks(date);
      res.json({ generated: count });
    } catch (error) {
      logger.error('POST /api/communication/recurring-tasks/generate error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/communication/tasks/rollover
  // Reporter les tâches non terminées au lendemain
  app.post('/api/communication/tasks/rollover', authenticateToken, (req, res) => {
    try {
      const { fromDate } = req.body;
      if (!fromDate) return res.status(400).json({ error: 'Date requise' });
      const count = rolloverPendingTasks(fromDate);
      res.json({ rolled: count });
    } catch (error) {
      logger.error('POST /api/communication/tasks/rollover error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ═══════════════════════════════════════════════════════
  // iCal Calendars — CRUD + synchronisation
  // ═══════════════════════════════════════════════════════

  // GET /api/communication/ical-calendars
  app.get('/api/communication/ical-calendars', authenticateToken, (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM ical_calendars ORDER BY name ASC').all();
      res.json({ calendars: rows });
    } catch (error) {
      logger.error('GET ical-calendars error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/communication/ical-calendars
  app.post('/api/communication/ical-calendars', authenticateToken, (req, res) => {
    try {
      const { name, url, color } = req.body;
      if (!name?.trim() || !url?.trim()) return res.status(400).json({ error: 'Nom et URL requis' });
      const id = crypto.randomUUID().replace(/-/g, '');
      db.prepare('INSERT INTO ical_calendars (id, name, url, color) VALUES (?, ?, ?, ?)').run(id, name.trim(), url.trim(), color || '#3b82f6');
      const created = db.prepare('SELECT * FROM ical_calendars WHERE id = ?').get(id);
      res.json(created);
    } catch (error) {
      logger.error('POST ical-calendars error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // PUT /api/communication/ical-calendars/:id
  app.put('/api/communication/ical-calendars/:id', authenticateToken, (req, res) => {
    try {
      const { name, url, color, enabled } = req.body;
      db.prepare('UPDATE ical_calendars SET name = ?, url = ?, color = ?, enabled = ? WHERE id = ?')
        .run(name, url, color || '#3b82f6', enabled ?? 1, req.params.id);
      const updated = db.prepare('SELECT * FROM ical_calendars WHERE id = ?').get(req.params.id);
      if (!updated) return res.status(404).json({ error: 'Calendrier introuvable' });
      res.json(updated);
    } catch (error) {
      logger.error('PUT ical-calendars error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // DELETE /api/communication/ical-calendars/:id
  app.delete('/api/communication/ical-calendars/:id', authenticateToken, (req, res) => {
    try {
      const result = db.prepare('DELETE FROM ical_calendars WHERE id = ?').run(req.params.id);
      if (result.changes === 0) return res.status(404).json({ error: 'Introuvable' });
      res.json({ success: true });
    } catch (error) {
      logger.error('DELETE ical-calendars error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/communication/ical-events — récupère les événements iCal dans une plage de dates [PERF] Cache 5min
  app.get('/api/communication/ical-events', authenticateToken, cacheMiddleware(icalCache, (req) => `ical-${req.query.dateFrom}-${req.query.dateTo}`, 5 * 60_000), async (req, res) => {
    try {
      const { dateFrom, dateTo } = req.query;
      if (!dateFrom || !dateTo) return res.status(400).json({ error: 'dateFrom et dateTo requis' });

      const calendars = db.prepare('SELECT * FROM ical_calendars WHERE enabled = 1').all();
      const allEvents = [];
      const syncErrors = [];

      for (const cal of calendars) {
        try {
          const response = await fetch(cal.url, { signal: AbortSignal.timeout(10000) });
          if (!response.ok) {
            const msg = `${cal.name}: HTTP ${response.status}`;
            logger.warn(`iCal fetch failed — ${msg}`);
            syncErrors.push(msg);
            db.prepare('UPDATE ical_calendars SET last_sync_error = ? WHERE id = ?').run(`HTTP ${response.status}`, cal.id);
            continue;
          }
          const icalData = await response.text();
          const events = parseICalData(icalData, dateFrom, dateTo);
          events.forEach(ev => {
            ev.calendarId = cal.id;
            ev.calendarName = cal.name;
            ev.calendarColor = cal.color;
          });
          allEvents.push(...events);

          // Mettre à jour last_sync + reset erreur
          db.prepare('UPDATE ical_calendars SET last_sync = datetime(\'now\'), last_sync_error = NULL WHERE id = ?').run(cal.id);
        } catch (fetchErr) {
          const msg = `${cal.name}: ${fetchErr.message}`;
          logger.warn(`iCal sync error — ${msg}`);
          syncErrors.push(msg);
          try { db.prepare('UPDATE ical_calendars SET last_sync_error = ? WHERE id = ?').run(fetchErr.message, cal.id); } catch {}
        }
      }

      // Trier par date de début
      allEvents.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
      res.json({ events: allEvents, syncErrors: syncErrors.length ? syncErrors : undefined });
    } catch (error) {
      logger.error('GET ical-events error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Parser iCal simplifié ──
  function parseICalData(icalData, dateFrom, dateTo) {
    const events = [];
    // Unfold continuation lines (RFC 5545: lines starting with space/tab are continuation of previous line)
    const rawLines = icalData.split(/\r?\n/);
    const lines = [];
    for (const raw of rawLines) {
      if (/^[ \t]/.test(raw) && lines.length > 0) {
        lines[lines.length - 1] += raw.substring(1);
      } else {
        lines.push(raw);
      }
    }
    let currentEvent = null;

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        currentEvent = {};
      } else if (line === 'END:VEVENT' && currentEvent) {
        // Filtrer par plage de dates
        const evDate = (currentEvent.dtstart || '').slice(0, 10);
        if (evDate >= dateFrom && evDate <= dateTo && currentEvent.summary) {
          events.push({
            id: currentEvent.uid || `ical-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            summary: cleanICalText(currentEvent.summary),
            start: currentEvent.dtstart || '',
            end: currentEvent.dtend || '',
            location: cleanICalText(currentEvent.location || ''),
            description: cleanICalText(currentEvent.description || ''),
          });
        }
        currentEvent = null;
      } else if (currentEvent) {
        const colonIdx = line.indexOf(':');
        if (colonIdx < 0) continue;
        const keyPart = line.substring(0, colonIdx);
        const value = line.substring(colonIdx + 1);
        // Strip parameters (e.g., DTSTART;TZID=Europe/Paris)
        const baseKey = keyPart.split(';')[0].toLowerCase();

        if (baseKey === 'dtstart') {
          currentEvent.dtstart = formatICalDate(value);
        } else if (baseKey === 'dtend') {
          currentEvent.dtend = formatICalDate(value);
        } else if (baseKey === 'summary') {
          currentEvent.summary = value;
        } else if (baseKey === 'location') {
          currentEvent.location = value;
        } else if (baseKey === 'description') {
          currentEvent.description = value;
        } else if (baseKey === 'uid') {
          currentEvent.uid = value;
        }
      }
    }
    return events;
  }

  function formatICalDate(dateStr) {
    // Formats: 20260303T140000Z, 20260303T140000, 20260303
    const clean = dateStr.replace(/[^0-9TZ]/g, '');
    if (clean.length >= 15) {
      // YYYYMMDDTHHMMSS
      const y = clean.slice(0, 4), m = clean.slice(4, 6), d = clean.slice(6, 8);
      const hh = clean.slice(9, 11), mm = clean.slice(11, 13);
      return `${y}-${m}-${d}T${hh}:${mm}`;
    }
    if (clean.length >= 8) {
      return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
    }
    return dateStr;
  }

  function cleanICalText(text) {
    if (!text) return '';
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\')
      .trim();
  }

  // ═══ Fonctions internes ═══

  // Générer les tâches récurrentes pour une date donnée
  function generateRecurringTasks(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = d.getDay(); // 0=dim, 1=lun...
    const dayOfMonth = d.getDate();

    const recurring = db.prepare('SELECT * FROM recurring_tasks WHERE active = 1').all();
    const insertStmt = db.prepare(`
      INSERT INTO task_assignments (id, date, period, time, section, title, notes, source_type, source_id, status, visible, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'recurring', ?, 'pending', 1, datetime('now'))
    `);

    let count = 0;
    for (const rt of recurring) {
      let shouldGenerate = false;
      if (rt.recurrence === 'daily') shouldGenerate = true;
      else if (rt.recurrence === 'weekly' && rt.day_of_week === dayOfWeek) shouldGenerate = true;
      else if (rt.recurrence === 'monthly' && rt.day_of_month === dayOfMonth) shouldGenerate = true;

      if (!shouldGenerate) continue;

      // Vérifier qu'on n'a pas déjà créé cette tâche (source_type=recurring, source_id=rt.id, date=dateStr)
      const existing = db.prepare(
        "SELECT 1 FROM task_assignments WHERE source_type = 'recurring' AND source_id = ? AND date = ?"
      ).get(rt.id, dateStr);
      if (existing) continue;

      const id = crypto.randomUUID().replace(/-/g, '');
      insertStmt.run(id, dateStr, rt.period, rt.time, rt.section, rt.title, rt.notes, rt.id);
      count++;
    }
    return count;
  }

  // Reporter les tâches non terminées au lendemain
  function rolloverPendingTasks(fromDate) {
    const d = new Date(fromDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const nextDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Tâches pending/in_progress du jour qui ne sont pas des RDV/événements
    const pending = db.prepare(`
      SELECT * FROM task_assignments
      WHERE date = ? AND status IN ('pending', 'in_progress')
        AND section NOT IN ('rdv', 'evenements')
    `).all(fromDate);

    const insertStmt = db.prepare(`
      INSERT INTO task_assignments (id, display_event_id, person_id, date, period, time, end_time, section, title, notes, source_type, source_id, google_event_title, affaire_num, status, visible, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
    `);

    let count = 0;
    for (const t of pending) {
      // Vérifier pas de doublon (même titre + section + date cible)
      const dup = db.prepare(
        "SELECT 1 FROM task_assignments WHERE date = ? AND section = ? AND title = ? AND status != 'cancelled'"
      ).get(nextDate, t.section, t.title);
      if (dup) continue;

      const id = crypto.randomUUID().replace(/-/g, '');
      insertStmt.run(id, t.display_event_id, t.person_id, nextDate, t.period, t.time, t.end_time, t.section, t.title, t.notes || '', t.source_type, t.source_id, t.google_event_title, t.affaire_num, t.visible ?? 1);
      count++;
    }
    return count;
  }

  // ═══ Cron automatique : tous les jours à 18h ═══
  function scheduleRolloverCron() {
    const check = () => {
      const now = new Date();
      if (now.getHours() === 18 && now.getMinutes() === 0) {
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const tomorrowD = new Date(now);
        tomorrowD.setDate(tomorrowD.getDate() + 1);
        const tomorrowStr = `${tomorrowD.getFullYear()}-${String(tomorrowD.getMonth() + 1).padStart(2, '0')}-${String(tomorrowD.getDate()).padStart(2, '0')}`;

        // 1. Reporter les tâches non terminées d'aujourd'hui
        const rolled = rolloverPendingTasks(todayStr);
        logger.info(`⏰ Cron 18h : ${rolled} tâche(s) reportée(s) au ${tomorrowStr}`);

        // 2. Générer les tâches récurrentes de demain
        const generated = generateRecurringTasks(tomorrowStr);
        logger.info(`⏰ Cron 18h : ${generated} tâche(s) récurrente(s) générée(s) pour ${tomorrowStr}`);
      }
    };
    // Vérifier toutes les 30 secondes (pour capter 18:00 sans timer compliqué)
    setInterval(check, 30000);
    logger.info('⏰ Cron report tâches 18h activé');

    // Au démarrage : reporter les tâches pending des jours précédents + générer récurrentes
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 1. Reporter les tâches pending de tous les jours passés vers aujourd'hui
    try {
      const pendingDays = db.prepare(`
        SELECT DISTINCT date FROM task_assignments
        WHERE date < ? AND status IN ('pending', 'in_progress')
          AND section NOT IN ('rdv', 'evenements')
        ORDER BY date ASC
      `).all(todayStr).map(r => r.date);

      let totalRolled = 0;
      for (const pastDate of pendingDays) {
        // Reporter directement vers aujourd'hui (pas jour par jour)
        const pending = db.prepare(`
          SELECT * FROM task_assignments
          WHERE date = ? AND status IN ('pending', 'in_progress')
            AND section NOT IN ('rdv', 'evenements')
        `).all(pastDate);

        const insertStmt = db.prepare(`
          INSERT INTO task_assignments (id, display_event_id, person_id, date, period, time, end_time, section, title, notes, source_type, source_id, google_event_title, affaire_num, status, visible, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
        `);

        for (const t of pending) {
          // Pas de doublon : même titre + section + date cible
          const dup = db.prepare(
            "SELECT 1 FROM task_assignments WHERE date = ? AND section = ? AND title = ? AND status != 'cancelled'"
          ).get(todayStr, t.section, t.title);
          if (dup) continue;

          const id = crypto.randomUUID().replace(/-/g, '');
          insertStmt.run(id, t.display_event_id, t.person_id, todayStr, t.period, t.time, t.end_time, t.section, t.title, t.notes || '', t.source_type, t.source_id, t.google_event_title, t.affaire_num, t.visible ?? 1);
          totalRolled++;
        }
      }
      if (totalRolled > 0) logger.info(`🔄 Démarrage : ${totalRolled} tâche(s) en attente reportée(s) des jours passés vers aujourd'hui`);
    } catch (err) {
      logger.error('Erreur rollover au démarrage:', err);
    }

    // 2. Générer les tâches récurrentes d'aujourd'hui si pas encore fait
    const generated = generateRecurringTasks(todayStr);
    if (generated > 0) logger.info(`🔄 Démarrage : ${generated} tâche(s) récurrente(s) générée(s) pour aujourd'hui`);
  }

  scheduleRolloverCron();

}
