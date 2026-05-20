// ============================================================
// MODULE PARC MATÉRIEL + SAV — eM@g
// Routes REST : equipment, categories, assignments, SAV tickets
// ============================================================

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import multer from 'multer';
import { dirname, extname, join } from 'path';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';

import { normalizeBrand } from './brandHelpers.js';
import {
  cacheMiddleware,
  equipmentListCache,
  equipmentTreeCache,
  invalidateOnSuccess,
} from './cache.js';
import db, { addToHistory } from './database.js';
import { alertSavTicketCreated } from './emailService.js';
import logger from './logger.js';
import { equipmentSchema } from './schemas/crud.js';
import { equipmentImportSchema, validate } from './schemas/imports.js';
import { getNextUid } from './services/uidCounter.js';
import { parsePagination, sendPaginated } from './utils/pagination.js';
import { safeContentDispositionName } from './utils/safeFilename.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============ CATÉGORIES ============

export function setupEquipmentCategoriesRoutes(app, authenticateToken, requireAdmin) {
  // GET /api/equipment-categories
  app.get('/api/equipment-categories', authenticateToken, (req, res) => {
    try {
      const categories = db
        .prepare('SELECT * FROM equipment_categories ORDER BY level, name')
        .all();
      res.json(categories);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // GET /api/equipment-categories/tree — hiérarchie complète
  // [PERF Sprint 3] Construction O(n) via Map<parent_id, children[]> au lieu de
  // 2 .filter() imbriqués (O(n²) sur n catégories : ~150 actuellement, mais croissance).
  // [S2-3] Cache 5 min — invalidé sur POST/PUT/DELETE /api/equipment-categories
  app.get(
    '/api/equipment-categories/tree',
    authenticateToken,
    cacheMiddleware(equipmentTreeCache, () => 'tree'),
    (req, res) => {
      try {
        const all = db.prepare('SELECT * FROM equipment_categories ORDER BY name').all();

        // Index 1 passe : parent_id -> liste d'enfants
        const byParent = new Map();
        for (const c of all) {
          const k = c.parent_id == null ? '__root__' : c.parent_id;
          let bucket = byParent.get(k);
          if (!bucket) {
            bucket = [];
            byParent.set(k, bucket);
          }
          bucket.push(c);
        }

        const families = all.filter((c) => c.level === 'family');
        const tree = families.map((f) => ({
          ...f,
          children: (byParent.get(f.id) || [])
            .filter((sf) => sf.level === 'subfamily')
            .map((sf) => ({
              ...sf,
              children: (byParent.get(sf.id) || []).filter((cat) => cat.level === 'category'),
            })),
        }));
        res.json(tree);
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // POST /api/equipment-categories (admin)
  app.post('/api/equipment-categories', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, icon, color, description, parent_id, level } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'Nom requis' });

      const result = db
        .prepare(
          'INSERT INTO equipment_categories (name, icon, color, description, parent_id, level) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(
          name,
          icon || '📦',
          color || '#6366f1',
          description || null,
          parent_id || null,
          level || 'category',
        );

      equipmentTreeCache.clear();
      res
        .status(201)
        .json({ id: result.lastInsertRowid, name, icon, color, description, parent_id, level });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // PUT /api/equipment-categories/:id (admin)
  app.put('/api/equipment-categories/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
      const exists = db
        .prepare('SELECT id FROM equipment_categories WHERE id = ?')
        .get(req.params.id);
      if (!exists) return res.status(404).json({ success: false, error: 'Catégorie non trouvée' });

      const { name, icon, color, description, parent_id, level } = req.body;
      db.prepare(
        'UPDATE equipment_categories SET name = ?, icon = ?, color = ?, description = ?, parent_id = ?, level = ? WHERE id = ?',
      ).run(name, icon, color, description, parent_id || null, level || 'category', req.params.id);
      equipmentTreeCache.clear();
      const saved = db
        .prepare('SELECT * FROM equipment_categories WHERE id = ?')
        .get(req.params.id);
      res.json({ success: true, ...(saved || {}) });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // DELETE /api/equipment-categories/:id (admin)
  app.delete('/api/equipment-categories/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      // Vérification existence (cf. AUDIT-MUTATIONS-BACKEND-2026-05-18 §4.1)
      const exists = db
        .prepare('SELECT id FROM equipment_categories WHERE id = ?')
        .get(req.params.id);
      if (!exists) return res.status(404).json({ success: false, error: 'Catégorie non trouvée' });

      // Vérifier qu'aucun équipement n'utilise cette catégorie
      const count = db
        .prepare('SELECT COUNT(*) as c FROM equipment WHERE category_id = ?')
        .get(req.params.id);
      if (count.c > 0) {
        return res
          .status(400)
          .json({ success: false, error: `${count.c} équipement(s) utilisent cette catégorie` });
      }
      db.prepare('DELETE FROM equipment_categories WHERE id = ?').run(req.params.id);
      equipmentTreeCache.clear();
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}

// ============ ÉQUIPEMENTS ============

export function setupEquipmentRoutes(app, authenticateToken, requireAdmin) {
  // GET /api/equipment
  // [S2-3] Cache 60s — clé = query string ; invalidé sur mutations equipment/assignments
  app.get(
    '/api/equipment',
    authenticateToken,
    cacheMiddleware(equipmentListCache, (req) => {
      const q = req.query || {};
      // clé déterministe sur les filtres connus (pas req.url — ordre des params instable)
      return [
        q.status || '',
        q.category_id || '',
        q.search || '',
        q.location_zone || '',
        q.location_depot || '',
        q.limit || '',
        q.offset || '',
        q.page || '',
        q.pageSize || '',
        q.includeRemoved ? '1' : '0',
      ].join('|');
    }),
    (req, res) => {
      try {
        const { status, category_id, search, location_zone, location_depot, limit } = req.query;
        // [BUG-DOUBLONS] Par défaut, masquer les lignes status='removed' (lignes legacy
        // archivées après import LocMat). Elles apparaissaient en double dans
        // l'inventaire. Pour les voir : passer ?status=removed ou ?includeRemoved=1.
        const includeRemoved =
          req.query.includeRemoved === '1' ||
          req.query.includeRemoved === 'true' ||
          status === 'removed';
        let sql = `
        SELECT e.*, ec.name as category_name, ec.icon as category_icon, ec.color as category_color,
               u.name as created_by_name,
               b.name as brand_canonical, b.slug as brand_slug
        FROM equipment e
        LEFT JOIN equipment_categories ec ON e.category_id = ec.id
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN brands b ON e.brand_id = b.id
        WHERE 1=1
      `;
        const params = [];

        if (status) {
          sql += ' AND e.status = ?';
          params.push(status);
        } else if (!includeRemoved) {
          sql += " AND (e.status IS NULL OR e.status != 'removed')";
        }
        if (category_id) {
          sql += ' AND e.category_id = ?';
          params.push(category_id);
        }
        if (location_zone) {
          sql += ' AND e.location_zone = ?';
          params.push(location_zone);
        }
        if (location_depot) {
          sql += ' AND e.location_depot = ?';
          params.push(location_depot);
        }
        if (search) {
          sql +=
            ' AND (e.name LIKE ? OR e.reference LIKE ? OR e.serial_number LIKE ? OR e.location LIKE ? OR e.location_zone LIKE ? OR e.numero_mag LIKE ?)';
          const like = `%${search}%`;
          params.push(like, like, like, like, like, like);
        }

        sql += ' ORDER BY e.name';

        const hasPagination =
          req.query.limit !== undefined ||
          req.query.offset !== undefined ||
          req.query.page !== undefined ||
          req.query.pageSize !== undefined;

        if (hasPagination) {
          const parsePositiveInt = (value, fallback) => {
            const parsed = Number.parseInt(value, 10);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
          };
          const parseNonNegativeInt = (value, fallback) => {
            const parsed = Number.parseInt(value, 10);
            return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
          };

          const pageSize = Math.min(parsePositiveInt(req.query.pageSize ?? limit, 200), 5000);
          const page = parsePositiveInt(req.query.page, 1);
          const hasOffset = req.query.offset !== undefined;
          const offset = hasOffset
            ? parseNonNegativeInt(req.query.offset, 0)
            : (page - 1) * pageSize;

          sql += ' LIMIT ? OFFSET ?';
          params.push(pageSize, offset);
        }

        const equipment = db.prepare(sql).all(...params);

        // Enrichir avec le dernier assignment actif — requête unique au lieu de N+1.
        // [PERF] Scopé aux IDs effectivement renvoyés (au lieu de charger tous les
        // assignments actifs de la base) — bénéfique surtout en mode paginé.
        let activeAssignments = [];
        if (equipment.length > 0) {
          const ids = equipment.map((e) => e.id);
          const placeholders = ids.map(() => '?').join(',');
          activeAssignments = db
            .prepare(
              `
        SELECT ea.*, p.first_name, p.last_name
        FROM equipment_assignments ea
        LEFT JOIN persons p ON ea.assigned_to = p.id
        WHERE ea.status = 'active' AND ea.equipment_id IN (${placeholders})
        ORDER BY ea.start_date DESC
      `,
            )
            .all(...ids);
        }

        const assignMap = {};
        for (const a of activeAssignments) {
          if (!assignMap[a.equipment_id]) assignMap[a.equipment_id] = a;
        }

        for (const eq of equipment) {
          eq.currentAssignment = assignMap[eq.id] || null;
        }

        res.json(equipment);
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // GET /api/equipment/:id
  app.get('/api/equipment/:id', authenticateToken, (req, res) => {
    try {
      const eq = db
        .prepare(
          `
        SELECT e.*, ec.name as category_name, ec.icon as category_icon, ec.color as category_color,
               b.name as brand_canonical, b.slug as brand_slug
        FROM equipment e
        LEFT JOIN equipment_categories ec ON e.category_id = ec.id
        LEFT JOIN brands b ON e.brand_id = b.id
        WHERE e.id = ?
      `,
        )
        .get(req.params.id);

      if (!eq) return res.status(404).json({ success: false, error: 'Équipement non trouvé' });

      // Historique des assignments
      eq.assignments = db
        .prepare(
          `
        SELECT ea.*, p.first_name, p.last_name, u.name as assigned_by_name
        FROM equipment_assignments ea
        LEFT JOIN persons p ON ea.assigned_to = p.id
        LEFT JOIN users u ON ea.assigned_by = u.id
        WHERE ea.equipment_id = ?
        ORDER BY ea.start_date DESC
      `,
        )
        .all(req.params.id);

      // Tickets SAV
      eq.savTickets = db
        .prepare(
          `
        SELECT st.*, u.name as reported_by_name, p.first_name as tech_first_name, p.last_name as tech_last_name
        FROM sav_tickets st
        LEFT JOIN users u ON st.reported_by = u.id
        LEFT JOIN persons p ON st.assigned_to = p.id
        WHERE st.equipment_id = ?
        ORDER BY st.created_at DESC
      `,
        )
        .all(req.params.id);

      res.json(eq);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // POST /api/equipment
  app.post(
    '/api/equipment',
    authenticateToken,
    validate(equipmentSchema),
    invalidateOnSuccess(equipmentListCache),
    (req, res) => {
      try {
        const {
          name,
          reference,
          serial_number,
          category_id,
          status,
          location,
          location_depot,
          location_zone,
          location_code,
          location_floor,
          purchase_date,
          purchase_price,
          warranty_end,
          notes,
          photo,
          brand,
          stock_quantity,
          numero_mag,
        } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Nom requis' });

        // Normaliser la marque → brand_id
        const resolved = normalizeBrand(brand);

        const result = db
          .prepare(
            `
        INSERT INTO equipment (name, reference, serial_number, category_id, status, location, location_depot, location_zone, location_code, location_floor, purchase_date, purchase_price, warranty_end, notes, photo, brand, brand_id, stock_quantity, numero_mag, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
          )
          .run(
            name,
            reference,
            serial_number,
            category_id,
            status || 'available',
            location,
            location_depot || null,
            location_zone || null,
            location_code || null,
            location_floor || null,
            purchase_date,
            purchase_price,
            warranty_end,
            notes,
            photo,
            resolved.brand,
            resolved.brand_id,
            stock_quantity || 1,
            numero_mag || null,
            req.user.id,
          );

        // Générer l'UID unique (ou synchroniser avec le serial si c'est un EMAG)
        const emagMatch = serial_number && serial_number.match(/EMAG-\d{5}/i);
        const uid = emagMatch ? emagMatch[0].toUpperCase() : getNextUid(db);
        db.prepare('UPDATE equipment SET uid = ? WHERE id = ?').run(uid, result.lastInsertRowid);

        addToHistory(
          'equipment',
          result.lastInsertRowid,
          'create',
          { name, reference, serial_number },
          req.user.id,
          req.user.name,
        );

        const created = db
          .prepare('SELECT * FROM equipment WHERE id = ?')
          .get(result.lastInsertRowid);
        res.status(201).json(created);
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // PUT /api/equipment/:id
  app.put(
    '/api/equipment/:id',
    authenticateToken,
    validate(equipmentSchema),
    invalidateOnSuccess(equipmentListCache),
    (req, res) => {
      try {
        const {
          name,
          reference,
          serial_number,
          category_id,
          status,
          location,
          location_depot,
          location_zone,
          location_code,
          location_floor,
          purchase_date,
          purchase_price,
          warranty_end,
          notes,
          photo,
          brand,
          stock_quantity,
          numero_mag,
        } = req.body;

        // Normaliser la marque → brand_id
        const resolved = normalizeBrand(brand);

        db.prepare(
          `
        UPDATE equipment SET name = ?, reference = ?, serial_number = ?, category_id = ?, status = ?, location = ?, location_depot = ?, location_zone = ?, location_code = ?, location_floor = ?, purchase_date = ?, purchase_price = ?, warranty_end = ?, notes = ?, photo = ?, brand = ?, brand_id = ?, stock_quantity = ?, numero_mag = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        ).run(
          name,
          reference,
          serial_number,
          category_id,
          status,
          location,
          location_depot || null,
          location_zone || null,
          location_code || null,
          location_floor || null,
          purchase_date,
          purchase_price,
          warranty_end,
          notes,
          photo,
          resolved.brand,
          resolved.brand_id,
          stock_quantity,
          numero_mag || null,
          req.params.id,
        );

        // Si le serial contient un UID EMAG, synchroniser le champ uid
        if (serial_number) {
          const emagMatch = serial_number.match(/EMAG-\d{5}/i);
          if (emagMatch) {
            db.prepare('UPDATE equipment SET uid = ? WHERE id = ?').run(
              emagMatch[0].toUpperCase(),
              req.params.id,
            );
          }
        }
        // S'assurer que le uid n'est jamais vide
        const currentEquip = db
          .prepare('SELECT uid FROM equipment WHERE id = ?')
          .get(req.params.id);
        if (!currentEquip?.uid) {
          const autoUid = getNextUid(db);
          db.prepare('UPDATE equipment SET uid = ? WHERE id = ?').run(autoUid, req.params.id);
        }

        // Propager la photo aux équipements ayant la même référence
        if (photo !== undefined && reference) {
          db.prepare(
            'UPDATE equipment SET photo = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ? AND id != ?',
          ).run(photo, reference, req.params.id);
        }

        // Propager la marque aux équipements ayant la même référence
        if (resolved.brand && reference) {
          db.prepare(
            'UPDATE equipment SET brand = ?, brand_id = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ? AND id != ?',
          ).run(resolved.brand, resolved.brand_id ?? null, reference, req.params.id);
        }

        addToHistory('equipment', req.params.id, 'update', req.body, req.user.id, req.user.name);

        const saved = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
        res.json({ success: true, ...(saved || {}) });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // PATCH /api/equipment/:id/photo — Mettre à jour uniquement la photo
  app.patch(
    '/api/equipment/:id/photo',
    authenticateToken,
    invalidateOnSuccess(equipmentListCache),
    (req, res) => {
      try {
        const { photo } = req.body;
        const eq = db
          .prepare('SELECT id, reference FROM equipment WHERE id = ?')
          .get(req.params.id);
        if (!eq) return res.status(404).json({ success: false, error: 'Équipement introuvable' });

        db.prepare(
          'UPDATE equipment SET photo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ).run(photo || null, req.params.id);

        // Propager aux équipements de même référence
        if (photo && eq.reference) {
          db.prepare(
            'UPDATE equipment SET photo = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ? AND id != ?',
          ).run(photo, eq.reference, req.params.id);
        }

        addToHistory('equipment', req.params.id, 'update', { photo }, req.user.id, req.user.name);
        const saved = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
        res.json({ success: true, ...(saved || {}) });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // DELETE /api/equipment/:id (admin)
  app.delete(
    '/api/equipment/:id',
    authenticateToken,
    requireAdmin,
    invalidateOnSuccess(equipmentListCache),
    (req, res) => {
      try {
        // Supprimer les assignments et tickets associés
        db.prepare('DELETE FROM equipment_assignments WHERE equipment_id = ?').run(req.params.id);
        db.prepare('DELETE FROM sav_tickets WHERE equipment_id = ?').run(req.params.id);
        db.prepare('DELETE FROM equipment WHERE id = ?').run(req.params.id);

        addToHistory('equipment', req.params.id, 'delete', {}, req.user.id, req.user.name);

        res.json({ success: true });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ═══ POST /api/equipment/:id/serialize — Sérialisation : attribuer UID (qty=1) ou scinder qty > 1 en entités individuelles UID ═══
  app.post(
    '/api/equipment/:id/serialize',
    authenticateToken,
    requireAdmin,
    invalidateOnSuccess(equipmentListCache),
    (req, res) => {
      try {
        const original = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
        if (!original)
          return res.status(404).json({ success: false, error: 'Équipement introuvable' });

        const qty = original.stock_quantity || 1;

        if (original.uid && qty <= 1)
          return res.status(400).json({
            success: false,
            error: 'Cet équipement possède déjà un UID et sa quantité est de 1',
          });

        // Cas qty = 1 : attribution simple d'un UID sans duplication
        if (qty <= 1) {
          const uid = getNextUid(db);
          db.prepare(
            'UPDATE equipment SET uid = ?, stock_quantity = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ).run(uid, original.id);

          const updated = db
            .prepare(
              `
          SELECT e.*, ec.name as category_name, ec.icon as category_icon, ec.color as category_color
          FROM equipment e
          LEFT JOIN equipment_categories ec ON e.category_id = ec.id
          WHERE e.id = ?
        `,
            )
            .get(original.id);

          addToHistory(
            'equipment',
            original.id,
            'serialize',
            {
              originalName: original.name,
              originalQty: 1,
              createdItems: [uid],
            },
            req.user.id,
            req.user.name,
          );

          return res.json({
            success: true,
            message: `${original.name} sérialisé — UID ${uid}`,
            created: [{ id: original.id, uid, name: original.name }],
            items: [updated],
            deletedId: null,
          });
        }

        // Cas qty > 1 : scinder en N entités individuelles
        // Si la ligne porte déjà un numéro de série, le client DOIT fournir N numéros
        // de série distincts (un par exemplaire) afin d'éviter la création de doublons
        // synthétiques type "<SN>-001" qui ne correspondent à aucun matériel réel.
        const rawSerials = Array.isArray(req.body?.serials) ? req.body.serials : null;
        const providedSerials = rawSerials
          ? rawSerials.map((s) => (s == null ? '' : String(s).trim())).filter((s) => s.length > 0)
          : null;

        if (original.serial_number) {
          if (
            !providedSerials ||
            providedSerials.length !== qty ||
            new Set(providedSerials).size !== qty
          ) {
            return res.status(400).json({
              success: false,
              error: `Cette ligne a déjà un numéro de série (${original.serial_number}). Le split en ${qty} exemplaires exige ${qty} numéros de série distincts et non vides (champ "serials").`,
            });
          }
        } else if (providedSerials) {
          // Pas de SN sur la ligne d'origine mais le client en fournit : valider quand même
          if (providedSerials.length !== qty || new Set(providedSerials).size !== qty) {
            return res.status(400).json({
              success: false,
              error: `Le tableau "serials" doit contenir ${qty} numéros de série distincts et non vides.`,
            });
          }
        }

        // Vérifier qu'aucun SN fourni n'entre en collision avec un équipement existant
        // (autre que la ligne d'origine, qui sera supprimée).
        if (providedSerials && providedSerials.length > 0) {
          const placeholders = providedSerials.map(() => '?').join(',');
          const collisions = db
            .prepare(
              `SELECT id, serial_number FROM equipment
             WHERE serial_number IN (${placeholders}) AND id != ?`,
            )
            .all(...providedSerials, original.id);
          if (collisions.length > 0) {
            return res.status(409).json({
              success: false,
              error: `Numéro(s) de série déjà utilisé(s) en base : ${collisions.map((c) => c.serial_number).join(', ')}`,
            });
          }
        }

        const insertStmt = db.prepare(`
        INSERT INTO equipment (name, reference, serial_number, category_id, brand, status, location, purchase_date, purchase_price, warranty_end, notes, photo, stock_quantity, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `);
        const updateUidStmt = db.prepare('UPDATE equipment SET uid = ? WHERE id = ?');

        const created = [];

        const run = db.transaction(() => {
          for (let i = 1; i <= qty; i++) {
            const name = original.name;
            const serial = providedSerials ? providedSerials[i - 1] : null;

            const result = insertStmt.run(
              name,
              original.reference,
              serial,
              original.category_id,
              original.brand,
              original.status || 'available',
              original.location,
              original.purchase_date,
              original.purchase_price ? (original.purchase_price / qty).toFixed(2) : null,
              original.warranty_end,
              original.notes,
              original.photo,
              req.user.id,
            );

            const newId = result.lastInsertRowid;
            const uid = getNextUid(db);
            updateUidStmt.run(uid, newId);

            created.push({ id: newId, uid, name });
          }

          // Réassigner les tickets SAV au premier exemplaire créé, puis supprimer l'original
          const firstNewId = created[0]?.id;
          if (firstNewId) {
            db.prepare('UPDATE sav_tickets SET equipment_id = ? WHERE equipment_id = ?').run(
              firstNewId,
              original.id,
            );
          }
          db.prepare('DELETE FROM equipment_assignments WHERE equipment_id = ?').run(original.id);
          db.prepare('DELETE FROM equipment WHERE id = ?').run(original.id);
        });

        run();

        // Récupérer les items complets pour le frontend
        const createdIds = created.map((c) => c.id);
        const fullItems = db
          .prepare(
            `SELECT e.*, ec.name as category_name, ec.icon as category_icon, ec.color as category_color
         FROM equipment e
         LEFT JOIN equipment_categories ec ON e.category_id = ec.id
         WHERE e.id IN (${createdIds.map(() => '?').join(',')})`,
          )
          .all(...createdIds);

        addToHistory(
          'equipment',
          original.id,
          'serialize',
          {
            originalName: original.name,
            originalQty: qty,
            createdItems: created.map((c) => c.uid),
          },
          req.user.id,
          req.user.name,
        );

        res.json({
          success: true,
          message: `${original.name} sérialisé en ${qty} entités individuelles`,
          created,
          items: fullItems,
          deletedId: original.id,
        });
      } catch (error) {
        logger.error('Erreur sérialisation:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur lors de la sérialisation' });
      }
    },
  );

  // POST /api/equipment/import-csv — Import CSV Locmat
  app.post(
    '/api/equipment/import-csv',
    authenticateToken,
    requireAdmin,
    validate(equipmentImportSchema),
    (req, res) => {
      try {
        const { data, mode } = req.body;
        // data = tableau d'objets [{code_libre, nom, famille, sous_famille, categorie, zone, stock, marque, numero_serie}, ...]
        // mode = 'preview' | 'import'

        if (!data || !Array.isArray(data) || data.length === 0) {
          return res.status(400).json({ success: false, error: 'Données CSV vides' });
        }

        // Filtre : ignorer les équipements en zone "Hors stock" (matériel déclassé)
        const isHorsStock = (zone) => {
          if (!zone) return false;
          const z = String(zone)
            .trim()
            .toLowerCase()
            .replace(/[\s_-]+/g, '');
          return z === 'horsstock';
        };

        // Collecter les familles, sous-familles, catégories uniques du CSV
        const familiesSet = new Map();
        const subfamiliesSet = new Map();
        const categoriesSet = new Map();

        for (const row of data) {
          if (isHorsStock(row.zone)) continue;
          if (row.famille && row.famille.trim()) {
            const normalizedFamily = row.famille.trim();
            familiesSet.set(normalizedFamily.toUpperCase(), normalizedFamily);
          }
          if (row.sous_famille && row.sous_famille.trim()) {
            const key = `${(row.famille || '').trim().toUpperCase()}||${row.sous_famille.trim()}`;
            subfamiliesSet.set(key, {
              name: row.sous_famille.trim(),
              family: (row.famille || '').trim(),
            });
          }
          if (row.categorie && row.categorie.trim()) {
            const key = `${(row.famille || '').trim().toUpperCase()}||${(row.sous_famille || '').trim()}||${row.categorie.trim()}`;
            categoriesSet.set(key, {
              name: row.categorie.trim(),
              family: (row.famille || '').trim(),
              subfamily: (row.sous_famille || '').trim(),
            });
          }
        }

        // Icons par famille (taxonomie uniformisée)
        const FAMILY_ICONS = {
          Sonorisation: '🔊',
          Éclairage: '💡',
          Structure: '🏗️',
          Audiovisuel: '🎥',
          'Distribution Électrique': '⚡',
          Backline: '🎸',
          Informatique: '💻',
          'Rideau-Machinerie': '🎭',
          Accroche: '🔗',
          Motorisation: '⚙️',
          Mobilier: '🪑',
          'Outillage & EPI': '🔧',
          Divers: '📋',
        };
        const FAMILY_COLORS = {
          Sonorisation: '#3b82f6',
          Éclairage: '#f59e0b',
          Structure: '#ef4444',
          Audiovisuel: '#8b5cf6',
          'Distribution Électrique': '#f97316',
          Backline: '#10b981',
          Informatique: '#06b6d4',
          'Rideau-Machinerie': '#ec4899',
          Accroche: '#14b8a6',
          Motorisation: '#f97316',
          Mobilier: '#6b7280',
          'Outillage & EPI': '#f59e0b',
          Divers: '#94a3b8',
        };

        if (mode === 'preview') {
          // Modèle A : matching prioritaire par serial_number (1 ligne = 1 unité).
          // Fallback reference uniquement si la référence est unique en DB.
          const findBySerial = db.prepare(
            'SELECT id, name, reference, serial_number FROM equipment' +
              " WHERE serial_number = ? AND serial_number IS NOT NULL AND serial_number != '' LIMIT 2",
          );
          const findByRef = db.prepare(
            'SELECT id, name, reference, serial_number FROM equipment' +
              " WHERE reference = ? AND reference IS NOT NULL AND reference != ''" +
              " AND (serial_number IS NULL OR serial_number = '') LIMIT 2",
          );
          const findExistingStrict = (reference, serialNumber) => {
            if (serialNumber) {
              const matches = findBySerial.all(serialNumber);
              if (matches.length === 1) return { row: matches[0], by: 'serial_number' };
              if (matches.length > 1) return null; // ambigu
            }
            if (reference) {
              const matches = findByRef.all(reference);
              if (matches.length === 1) return { row: matches[0], by: 'reference' };
            }
            return null;
          };

          let toCreate = 0,
            toUpdate = 0,
            toSkip = 0,
            toSkipHorsStock = 0;
          const collisions = [];

          for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (isHorsStock(row.zone)) {
              toSkipHorsStock++;
              continue;
            }
            const nom = (row.nom || '').trim();
            if (!nom) {
              toSkip++;
              continue;
            }

            const reference = (row.code_libre || '').trim() || null;
            const serialNumber = (row.numero_serie || '').trim() || null;
            const matched = findExistingStrict(reference, serialNumber);
            const existing = matched?.row || null;

            if (existing) {
              toUpdate++;
              collisions.push({
                index: i,
                csvName: nom,
                csvRef: reference,
                csvSerial: serialNumber,
                existingId: existing.id,
                existingName: existing.name,
                existingRef: existing.reference,
                existingSerial: existing.serial_number,
                action: 'update',
                matchedBy: matched.by,
              });
            } else {
              toCreate++;
            }
          }

          return res.json({
            totalRows: data.length,
            toCreate,
            toUpdate,
            toSkip,
            toSkipHorsStock,
            collisions,
            families: [...familiesSet.values()],
            subfamilies: [...subfamiliesSet.values()].map((v) => v.name),
            categories: [...categoriesSet.values()].map((v) => v.name),
            existingEquipmentCount: db.prepare('SELECT COUNT(*) as c FROM equipment').get().c,
            sample: data.slice(0, 10),
          });
        }

        // Mode import réel
        const insertFamily = db.prepare(
          'INSERT INTO equipment_categories (name, icon, color, level, parent_id) VALUES (?, ?, ?, ?, NULL)',
        );
        const insertSubfamily = db.prepare(
          'INSERT INTO equipment_categories (name, icon, color, level, parent_id) VALUES (?, ?, ?, ?, ?)',
        );
        const insertCategory = db.prepare(
          'INSERT INTO equipment_categories (name, icon, color, level, parent_id) VALUES (?, ?, ?, ?, ?)',
        );
        const findCat = db.prepare(
          'SELECT id FROM equipment_categories WHERE name = ? AND level = ? AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL))',
        );
        const insertEquip = db.prepare(`
        INSERT INTO equipment (name, reference, serial_number, category_id, brand, stock_quantity, location, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?)
      `);

        let created = 0,
          updated = 0,
          skipped = 0,
          skippedHorsStock = 0,
          familiesCreated = 0,
          subfamiliesCreated = 0,
          categoriesCreated = 0;

        const importAll = db.transaction(() => {
          // Phase 1 : Créer les familles
          const familyIdMap = {};
          for (const [key, name] of familiesSet) {
            let existing = findCat.get(name, 'family', null, null);
            if (!existing) {
              // Vérifier aussi par nom case-insensitive
              existing = db
                .prepare('SELECT id FROM equipment_categories WHERE UPPER(name) = ? AND level = ?')
                .get(key, 'family');
            }
            if (existing) {
              familyIdMap[key] = existing.id;
            } else {
              const icon = FAMILY_ICONS[name] || FAMILY_ICONS[key] || '📦';
              const color = FAMILY_COLORS[name] || FAMILY_COLORS[key] || '#6366f1';
              const result = insertFamily.run(name, icon, color, 'family');
              familyIdMap[key] = result.lastInsertRowid;
              familiesCreated++;
            }
          }

          // Phase 2 : Créer les sous-familles
          const subfamilyIdMap = {};
          for (const [key, { name, family }] of subfamiliesSet) {
            const familyKey = family.toUpperCase();
            const parentId = familyIdMap[familyKey] || null;
            let existing = findCat.get(name, 'subfamily', parentId, parentId);
            if (existing) {
              subfamilyIdMap[key] = existing.id;
            } else {
              const result = insertSubfamily.run(name, '📁', '#64748b', 'subfamily', parentId);
              subfamilyIdMap[key] = result.lastInsertRowid;
              subfamiliesCreated++;
            }
          }

          // Phase 3 : Créer les catégories
          const categoryIdMap = {};
          for (const [key, { name, family, subfamily }] of categoriesSet) {
            const sfKey = `${family.toUpperCase()}||${subfamily}`;
            const parentId = subfamilyIdMap[sfKey] || null;
            let existing = findCat.get(name, 'category', parentId, parentId);
            if (existing) {
              categoryIdMap[key] = existing.id;
            } else {
              const result = insertCategory.run(name, '📦', '#94a3b8', 'category', parentId);
              categoryIdMap[key] = result.lastInsertRowid;
              categoriesCreated++;
            }
          }

          // Phase 4 : Insérer ou mettre à jour les équipements
          // Modèle A : matching prioritaire par serial_number ; reference fallback si unique.
          const findBySerialApply = db.prepare(
            "SELECT id FROM equipment WHERE serial_number = ? AND serial_number IS NOT NULL AND serial_number != '' LIMIT 2",
          );
          const findByRefApply = db.prepare(
            "SELECT id FROM equipment WHERE reference = ? AND reference IS NOT NULL AND reference != ''" +
              " AND (serial_number IS NULL OR serial_number = '') LIMIT 2",
          );
          const findExistingApply = (reference, serialNumber) => {
            if (serialNumber) {
              const m = findBySerialApply.all(serialNumber);
              if (m.length === 1) return m[0];
              if (m.length > 1) return null;
            }
            if (reference) {
              const m = findByRefApply.all(reference);
              if (m.length === 1) return m[0];
            }
            return null;
          };
          const updateEquip = db.prepare(`
          UPDATE equipment SET name = ?, category_id = ?, brand = ?, stock_quantity = ?, location = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);

          for (const row of data) {
            if (isHorsStock(row.zone)) {
              skippedHorsStock++;
              continue;
            }
            const nom = (row.nom || '').trim();
            if (!nom) {
              skipped++;
              continue;
            }

            // Trouver la catégorie
            const catKey = `${(row.famille || '').trim().toUpperCase()}||${(row.sous_famille || '').trim()}||${(row.categorie || '').trim()}`;
            const categoryId = categoryIdMap[catKey] || null;

            const reference = (row.code_libre || '').trim() || null;
            const serialNumber = (row.numero_serie || '').trim() || null;
            const rawBrand = (row.marque || '').trim() || null;
            const resolved = normalizeBrand(rawBrand);
            const stock = parseInt(row.stock) || 1;
            const zone = (row.zone || '').trim() || null;

            // Détecter un équipement existant (matching strict modèle A)
            const existing =
              reference || serialNumber ? findExistingApply(reference, serialNumber) : null;

            if (existing) {
              updateEquip.run(nom, categoryId, resolved.brand, stock, zone, existing.id);
              if (resolved.brand_id) {
                db.prepare('UPDATE equipment SET brand_id = ? WHERE id = ?').run(
                  resolved.brand_id,
                  existing.id,
                );
              }
              // Synchroniser UID si le serial contient un EMAG
              if (serialNumber) {
                const emagMatch = serialNumber.match(/EMAG-\d{5}/i);
                if (emagMatch) {
                  db.prepare('UPDATE equipment SET uid = ? WHERE id = ?').run(
                    emagMatch[0].toUpperCase(),
                    existing.id,
                  );
                }
              }
              // S'assurer que l'uid n'est jamais vide
              const existUid = db
                .prepare('SELECT uid FROM equipment WHERE id = ?')
                .get(existing.id);
              if (!existUid?.uid) {
                db.prepare('UPDATE equipment SET uid = ? WHERE id = ?').run(
                  getNextUid(db),
                  existing.id,
                );
              }
              updated++;
            } else {
              const insResult = insertEquip.run(
                nom,
                reference,
                serialNumber,
                categoryId,
                resolved.brand,
                stock,
                zone,
                req.user.id,
              );
              // Générer UID (ou synchroniser avec serial EMAG)
              const newId = insResult.lastInsertRowid;
              const emagMatch = serialNumber && serialNumber.match(/EMAG-\d{5}/i);
              const uid = emagMatch ? emagMatch[0].toUpperCase() : getNextUid(db);
              db.prepare('UPDATE equipment SET uid = ? WHERE id = ?').run(uid, newId);
              if (resolved.brand_id) {
                db.prepare('UPDATE equipment SET brand_id = ? WHERE id = ?').run(
                  resolved.brand_id,
                  newId,
                );
              }
              created++;
            }
          }
        });

        importAll();

        addToHistory(
          'equipment',
          null,
          'import_csv',
          {
            created,
            updated,
            skipped,
            skippedHorsStock,
            familiesCreated,
            subfamiliesCreated,
            categoriesCreated,
            total: data.length,
          },
          req.user.id,
          req.user.name,
        );

        res.json({
          success: true,
          created,
          updated,
          skipped,
          skippedHorsStock,
          familiesCreated,
          subfamiliesCreated,
          categoriesCreated,
          message: `Import terminé : ${created} créé(s), ${updated} mis à jour, ${skipped} ignoré(s)${skippedHorsStock ? `, ${skippedHorsStock} hors stock ignoré(s)` : ''}, ${familiesCreated} famille(s), ${subfamiliesCreated} sous-famille(s), ${categoriesCreated} catégorie(s) créée(s)`,
        });
      } catch (error) {
        logger.error('Erreur import CSV:', error);
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );
}

// ============ ASSIGNMENTS ============

export function setupEquipmentAssignmentsRoutes(app, authenticateToken) {
  // GET /api/equipment-assignments
  app.get('/api/equipment-assignments', authenticateToken, (req, res) => {
    try {
      const { equipment_id, person_id, status } = req.query;
      let sql = `
        SELECT ea.*, e.name as equipment_name, e.reference, 
               p.first_name, p.last_name, u.name as assigned_by_name
        FROM equipment_assignments ea
        LEFT JOIN equipment e ON ea.equipment_id = e.id
        LEFT JOIN persons p ON ea.assigned_to = p.id
        LEFT JOIN users u ON ea.assigned_by = u.id
        WHERE 1=1
      `;
      const params = [];
      if (equipment_id) {
        sql += ' AND ea.equipment_id = ?';
        params.push(equipment_id);
      }
      if (person_id) {
        sql += ' AND ea.assigned_to = ?';
        params.push(person_id);
      }
      if (status) {
        sql += ' AND ea.status = ?';
        params.push(status);
      }
      sql += ' ORDER BY ea.start_date DESC';

      // [S2-2] Pagination retro-compat (?page= et/ou ?limit= sinon array legacy)
      const p = parsePagination(req);
      return sendPaginated(res, db.prepare(sql).all(...params), p);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // POST /api/equipment-assignments
  app.post(
    '/api/equipment-assignments',
    authenticateToken,
    invalidateOnSuccess(equipmentListCache),
    (req, res) => {
      try {
        const { equipment_id, assigned_to, start_date, end_date, affaire_id, notes } = req.body;
        if (!equipment_id || !start_date)
          return res
            .status(400)
            .json({ success: false, error: 'Équipement et date de début requis' });

        // [AUDIT FIX MED-W4] Empêcher la double affectation active
        const existing = db
          .prepare(
            "SELECT id, assigned_to, start_date FROM equipment_assignments WHERE equipment_id = ? AND status = 'active'",
          )
          .get(equipment_id);
        if (existing) {
          return res.status(409).json({
            error: 'Cet équipement est déjà affecté',
            existing: {
              id: existing.id,
              assigned_to: existing.assigned_to,
              start_date: existing.start_date,
            },
          });
        }

        const result = db
          .prepare(
            `
        INSERT INTO equipment_assignments (equipment_id, assigned_to, assigned_by, start_date, end_date, affaire_id, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `,
          )
          .run(equipment_id, assigned_to, req.user.id, start_date, end_date, affaire_id, notes);

        // Mettre à jour le statut de l'équipement
        db.prepare(
          "UPDATE equipment SET status = 'in_use', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(equipment_id);

        res.status(201).json({ id: result.lastInsertRowid });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // PUT /api/equipment-assignments/:id/return
  app.put(
    '/api/equipment-assignments/:id/return',
    authenticateToken,
    invalidateOnSuccess(equipmentListCache),
    (req, res) => {
      try {
        const assignment = db
          .prepare('SELECT * FROM equipment_assignments WHERE id = ?')
          .get(req.params.id);
        if (!assignment)
          return res.status(404).json({ success: false, error: 'Assignation non trouvée' });

        const returnDate = new Date().toISOString().slice(0, 10);
        db.prepare(
          "UPDATE equipment_assignments SET status = 'returned', end_date = ? WHERE id = ?",
        ).run(returnDate, req.params.id);

        // Vérifier s'il y a d'autres assignments actifs
        const otherActive = db
          .prepare(
            "SELECT COUNT(*) as c FROM equipment_assignments WHERE equipment_id = ? AND status = 'active' AND id != ?",
          )
          .get(assignment.equipment_id, req.params.id);
        if (otherActive.c === 0) {
          db.prepare(
            "UPDATE equipment SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          ).run(assignment.equipment_id);
        }

        const saved = db
          .prepare('SELECT * FROM equipment_assignments WHERE id = ?')
          .get(req.params.id);
        res.json({ success: true, ...(saved || {}) });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );
}

// ============ TICKETS SAV ============

export function setupSavTicketsRoutes(
  app,
  authenticateToken,
  requireAdmin,
  requireEquipmentMaintenanceAccess,
) {
  // GET /api/sav-tickets
  app.get('/api/sav-tickets', authenticateToken, (req, res) => {
    try {
      const { equipment_id, status, priority } = req.query;
      let sql = `
        SELECT st.*, e.name as equipment_name, e.reference as equipment_reference,
               e.uid as equipment_uid, e.serial_number as equipment_serial_number,
               ec.icon as category_icon, ec.color as category_color,
               u.name as reported_by_name,
               p.first_name as tech_first_name, p.last_name as tech_last_name
        FROM sav_tickets st
        LEFT JOIN equipment e ON st.equipment_id = e.id
        LEFT JOIN equipment_categories ec ON e.category_id = ec.id
        LEFT JOIN users u ON st.reported_by = u.id
        LEFT JOIN persons p ON st.assigned_to = p.id
        WHERE 1=1
      `;
      const params = [];
      if (equipment_id) {
        sql += ' AND st.equipment_id = ?';
        params.push(equipment_id);
      }
      if (status) {
        sql += ' AND st.status = ?';
        params.push(status);
      }
      if (priority) {
        sql += ' AND st.priority = ?';
        params.push(priority);
      }
      sql += ' ORDER BY st.created_at DESC';

      // [S2-2] Pagination retro-compat
      const p = parsePagination(req);
      return sendPaginated(res, db.prepare(sql).all(...params), p);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // GET /api/sav-tickets/stats
  app.get('/api/sav-tickets/stats', authenticateToken, (req, res) => {
    try {
      const stats = {
        open: db.prepare("SELECT COUNT(*) as c FROM sav_tickets WHERE status = 'open'").get().c,
        in_progress: db
          .prepare("SELECT COUNT(*) as c FROM sav_tickets WHERE status = 'in_progress'")
          .get().c,
        waiting_parts: db
          .prepare("SELECT COUNT(*) as c FROM sav_tickets WHERE status = 'waiting_parts'")
          .get().c,
        resolved: db
          .prepare("SELECT COUNT(*) as c FROM sav_tickets WHERE status = 'resolved'")
          .get().c,
        closed: db.prepare("SELECT COUNT(*) as c FROM sav_tickets WHERE status = 'closed'").get().c,
        total_cost: db
          .prepare('SELECT COALESCE(SUM(cost), 0) as total FROM sav_tickets WHERE cost IS NOT NULL')
          .get().total,
      };
      res.json(stats);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // GET /api/sav-tickets/report — Rapport maintenance matériel (journalier/hebdo/mensuel)
  // Query params: start (YYYY-MM-DD), end (YYYY-MM-DD), type ('entries'|'exits'|'all')
  app.get('/api/sav-tickets/report', authenticateToken, (req, res) => {
    try {
      const { start, end, type } = req.query;
      if (!start || !end)
        return res.status(400).json({ success: false, error: 'Paramètres start et end requis' });

      let sql = `
        SELECT st.id, st.title, st.description, st.cost, st.status, st.type as ticket_type,
               st.created_at, st.resolved_at, st.updated_at,
               e.name as equipment_name, e.reference as equipment_reference,
               e.uid as equipment_uid, e.serial_number as equipment_serial_number,
               u.name as reported_by_name
        FROM sav_tickets st
        LEFT JOIN equipment e ON st.equipment_id = e.id
        LEFT JOIN users u ON st.reported_by = u.id
        WHERE 1=1
      `;
      const params = [];

      if (type === 'entries') {
        sql += ' AND DATE(st.created_at) >= ? AND DATE(st.created_at) <= ?';
        params.push(start, end);
      } else if (type === 'exits') {
        sql +=
          ' AND st.resolved_at IS NOT NULL AND DATE(st.resolved_at) >= ? AND DATE(st.resolved_at) <= ?';
        params.push(start, end);
      } else {
        // 'all' : entrées OU sorties dans la période
        sql +=
          ' AND (DATE(st.created_at) BETWEEN ? AND ? OR (st.resolved_at IS NOT NULL AND DATE(st.resolved_at) BETWEEN ? AND ?))';
        params.push(start, end, start, end);
      }
      sql += ' ORDER BY st.created_at DESC';

      const rows = db.prepare(sql).all(...params);
      res.json(rows);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Helper : recalcule le statut d'un équipement en fonction de ses tickets SAV et assignments
  const refreshEquipmentStatus = (equipmentId) => {
    if (!equipmentId) return;
    const activeTickets = db
      .prepare(
        "SELECT COUNT(*) as c FROM sav_tickets WHERE equipment_id = ? AND status IN ('open', 'in_progress', 'waiting_parts')",
      )
      .get(equipmentId);
    if (activeTickets.c > 0) {
      db.prepare(
        "UPDATE equipment SET status = 'maintenance', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(equipmentId);
    } else {
      const hasAssignment = db
        .prepare(
          "SELECT COUNT(*) as c FROM equipment_assignments WHERE equipment_id = ? AND status = 'active'",
        )
        .get(equipmentId);
      const newStatus = hasAssignment.c > 0 ? 'in_use' : 'available';
      db.prepare(
        'UPDATE equipment SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ).run(newStatus, equipmentId);
    }
  };

  // POST /api/sav-tickets/request — Demande SAV (tous utilisateurs authentifiés)
  app.post('/api/sav-tickets/request', authenticateToken, (req, res) => {
    try {
      const { equipment_id, title, description, type, priority } = req.body;
      if (!equipment_id || !title)
        return res.status(400).json({ success: false, error: 'Équipement et titre requis' });

      const result = db
        .prepare(
          `
        INSERT INTO sav_tickets (equipment_id, reported_by, assigned_to, type, priority, status, title, description)
        VALUES (?, ?, NULL, ?, ?, 'open', ?, ?)
      `,
        )
        .run(equipment_id, req.user.id, type || 'panne', priority || 'medium', title, description);

      // Alerte email aux admins
      try {
        alertSavTicketCreated(
          db,
          { equipment_id, title, type, priority, description },
          req.user.name,
        );
      } catch (emailErr) {
        logger.warn('Alerte email SAV:', emailErr.message);
      }

      res.status(201).json({ id: result.lastInsertRowid });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // POST /api/sav-tickets
  app.post('/api/sav-tickets', authenticateToken, requireEquipmentMaintenanceAccess, (req, res) => {
    try {
      const { equipment_id, assigned_to, type, priority, title, description } = req.body;
      if (!equipment_id || !title)
        return res.status(400).json({ success: false, error: 'Équipement et titre requis' });

      const result = db
        .prepare(
          `
        INSERT INTO sav_tickets (equipment_id, reported_by, assigned_to, type, priority, status, title, description)
        VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
      `,
        )
        .run(
          equipment_id,
          req.user.id,
          assigned_to,
          type || 'panne',
          priority || 'medium',
          title,
          description,
        );

      // Mettre l'équipement en maintenance
      refreshEquipmentStatus(equipment_id);

      // Alerte email aux admins
      try {
        alertSavTicketCreated(
          db,
          { equipment_id, title, type, priority, description },
          req.user.name,
        );
      } catch (emailErr) {
        logger.warn('Alerte email SAV:', emailErr.message);
      }

      res.status(201).json({ id: result.lastInsertRowid });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // PUT /api/sav-tickets/:id
  // [AUDIT FIX MED-W1] Transitions d'état SAV autorisées
  const VALID_SAV_TRANSITIONS = {
    open: ['in_progress', 'waiting_parts', 'closed'],
    in_progress: ['waiting_parts', 'resolved', 'closed'],
    waiting_parts: ['in_progress', 'resolved', 'closed'],
    resolved: ['closed', 'open'], // réouverture possible
    closed: ['open'], // réouverture uniquement
  };

  app.put(
    '/api/sav-tickets/:id',
    authenticateToken,
    requireEquipmentMaintenanceAccess,
    (req, res) => {
      try {
        const { assigned_to, type, priority, status, title, description, resolution, cost } =
          req.body;

        const oldTicket = db.prepare('SELECT * FROM sav_tickets WHERE id = ?').get(req.params.id);
        if (!oldTicket) return res.status(404).json({ success: false, error: 'Ticket non trouvé' });

        // [AUDIT FIX MED-W1] Valider la transition d'état
        if (status && status !== oldTicket.status) {
          const allowed = VALID_SAV_TRANSITIONS[oldTicket.status];
          if (!allowed || !allowed.includes(status)) {
            return res.status(400).json({
              error: `Transition de statut invalide : ${oldTicket.status} → ${status}`,
              allowed: allowed || [],
            });
          }
        }

        const resolvedAt =
          (status === 'resolved' || status === 'closed') &&
          oldTicket.status !== 'resolved' &&
          oldTicket.status !== 'closed'
            ? new Date().toISOString()
            : oldTicket.resolved_at;

        db.prepare(
          `
        UPDATE sav_tickets SET assigned_to = ?, type = ?, priority = ?, status = ?, title = ?, description = ?, resolution = ?, cost = ?, resolved_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        ).run(
          assigned_to,
          type,
          priority,
          status,
          title,
          description,
          resolution,
          cost,
          resolvedAt,
          req.params.id,
        );

        // Recalculer le statut de l'équipement (maintenance ↔ available/in_use)
        refreshEquipmentStatus(oldTicket.equipment_id);

        const saved = db.prepare('SELECT * FROM sav_tickets WHERE id = ?').get(req.params.id);
        res.json({ success: true, ...(saved || {}) });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // DELETE /api/sav-tickets/duplicates — Supprimer les doublons existants (garder le plus ancien)
  // NOTE: route spécifique AVANT la route paramétrique /:id
  app.delete(
    '/api/sav-tickets/duplicates',
    authenticateToken,
    requireAdmin,
    invalidateOnSuccess(equipmentListCache),
    (req, res) => {
      try {
        // Doublons = même title (N° intervention + nom article)
        const dupes = db
          .prepare(
            `
        SELECT id FROM sav_tickets WHERE id NOT IN (
          SELECT MIN(id) FROM sav_tickets GROUP BY LOWER(TRIM(title))
        )
      `,
          )
          .all();
        if (dupes.length === 0) {
          return res.json({ removed: 0, message: 'Aucun doublon trouvé' });
        }
        const ids = dupes.map((d) => d.id);
        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`DELETE FROM sav_tickets WHERE id IN (${placeholders})`).run(...ids);
        addToHistory(
          'sav_tickets',
          null,
          'remove_duplicates',
          { removed: ids.length },
          req.user.id,
          req.user.name,
        );
        res.json({ removed: ids.length, message: `${ids.length} doublon(s) supprimé(s)` });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // DELETE /api/sav-tickets/:id
  app.delete(
    '/api/sav-tickets/:id',
    authenticateToken,
    requireEquipmentMaintenanceAccess,
    invalidateOnSuccess(equipmentListCache),
    (req, res) => {
      try {
        const ticket = db
          .prepare('SELECT equipment_id FROM sav_tickets WHERE id = ?')
          .get(req.params.id);
        db.prepare('DELETE FROM sav_tickets WHERE id = ?').run(req.params.id);
        // Recalculer le statut de l'équipement après suppression
        if (ticket) refreshEquipmentStatus(ticket.equipment_id);
        res.json({ success: true });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // GET /api/sav-tickets/unlinked — Tickets SAV importés non liés à un équipement
  app.get('/api/sav-tickets/unlinked', authenticateToken, (req, res) => {
    try {
      const tickets = db
        .prepare(
          `
        SELECT id, title, description, status, cost, import_code, import_serial, import_name, created_at, resolved_at
        FROM sav_tickets WHERE equipment_id IS NULL
        ORDER BY created_at DESC
      `,
        )
        .all();
      res.json(tickets);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // PUT /api/sav-tickets/:id/link — Lier manuellement un ticket à un équipement
  app.put(
    '/api/sav-tickets/:id/link',
    authenticateToken,
    requireAdmin,
    invalidateOnSuccess(equipmentListCache),
    (req, res) => {
      try {
        const { equipment_id } = req.body;
        if (!equipment_id)
          return res.status(400).json({ success: false, error: 'equipment_id requis' });

        const ticket = db.prepare('SELECT * FROM sav_tickets WHERE id = ?').get(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, error: 'Ticket non trouvé' });

        db.prepare(
          'UPDATE sav_tickets SET equipment_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ).run(equipment_id, req.params.id);
        const saved = db.prepare('SELECT * FROM sav_tickets WHERE id = ?').get(req.params.id);
        res.json({ success: true, ...(saved || {}) });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ── Helper PDF : dessiner un tableau SAV sur un document PDFKit ──
  const drawSavPdfTable = (doc, rows, title, subtitle) => {
    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const leftX = doc.page.margins.left;

    // En-tête
    doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(0.2);
    if (subtitle) {
      doc.fontSize(10).font('Helvetica').fillColor('#666666').text(subtitle, { align: 'center' });
      doc.fillColor('#000000');
    }
    doc.moveDown(0.2);
    const now = new Date();
    doc
      .fontSize(7)
      .fillColor('#999999')
      .text(
        `Généré le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — ${rows.length} élément${rows.length > 1 ? 's' : ''}`,
        { align: 'center' },
      );
    doc.fillColor('#000000');
    doc.moveDown(0.5);

    if (rows.length === 0) {
      doc.fontSize(11).font('Helvetica').text('Aucune intervention trouvée.', { align: 'center' });
      return;
    }

    // Colonnes
    const cols = [
      { label: 'Référence', width: 60, key: 'equipment_reference' },
      { label: 'Matériel', width: 90, key: 'equipment_name' },
      { label: 'UID', width: 45, key: 'equipment_uid' },
      { label: 'N° Série', width: 55, key: 'equipment_serial_number' },
      { label: 'Intervention', width: 120, key: 'title' },
      { label: 'Statut', width: 50, key: 'status' },
      { label: 'Entrée', width: 55, key: 'created_at' },
      { label: 'Sortie', width: 55, key: 'resolved_at' },
      { label: 'Coût', width: 45, key: 'cost' },
    ];
    const totalColW = cols.reduce((s, c) => s + c.width, 0);
    const scale = pageW / totalColW;
    cols.forEach((c) => {
      c.width = Math.floor(c.width * scale);
    });

    const STATUS_LABELS = {
      open: 'Ouvert',
      in_progress: 'En cours',
      waiting_parts: 'Att. pièces',
      resolved: 'Résolu',
      closed: 'Fermé',
    };
    const fmtDate = (d) => {
      if (!d) return '—';
      try {
        return new Date(d).toLocaleDateString('fr-FR');
      } catch {
        return '—';
      }
    };
    const fmtCost = (c) => {
      if (c == null) return '—';
      return parseFloat(c).toFixed(2) + ' €';
    };

    const fs = 7;
    const rowH = 14;
    const headerH = 16;

    // Header
    let x = leftX;
    const headerY = doc.y;
    doc.rect(leftX, headerY, pageW, headerH).fillColor('#374151').fill();
    doc.font('Helvetica-Bold').fontSize(fs).fillColor('#ffffff');
    cols.forEach((col) => {
      doc.text(col.label, x + 2, headerY + 4, { width: col.width - 4, lineBreak: false });
      x += col.width;
    });
    doc.fillColor('#000000');
    doc.y = headerY + headerH;

    // Rows
    let totalCost = 0;
    rows.forEach((row, i) => {
      if (doc.y + rowH > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
      }
      const rowY = doc.y;
      if (i % 2 === 0) {
        doc.rect(leftX, rowY, pageW, rowH).fillColor('#f9fafb').fill();
      }
      doc.font('Helvetica').fontSize(fs).fillColor('#333333');
      x = leftX;
      cols.forEach((col) => {
        let val;
        if (col.key === 'cost') {
          val = fmtCost(row.cost);
          if (row.cost) totalCost += parseFloat(row.cost);
        } else if (col.key === 'created_at') val = fmtDate(row.created_at);
        else if (col.key === 'resolved_at') val = fmtDate(row.resolved_at);
        else if (col.key === 'status') val = STATUS_LABELS[row.status] || row.status || '—';
        else if (col.key === 'title')
          val = (row.title || '') + (row.description ? ` — ${row.description}` : '');
        else val = row[col.key] || '—';
        doc.text(String(val).substring(0, 40), x + 2, rowY + 3, {
          width: col.width - 4,
          lineBreak: false,
        });
        x += col.width;
      });
      doc.y = rowY + rowH;
    });

    // Footer
    doc.moveDown(0.3);
    doc
      .moveTo(leftX, doc.y)
      .lineTo(leftX + pageW, doc.y)
      .strokeColor('#333333')
      .lineWidth(1)
      .stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(`Total : ${rows.length} intervention${rows.length > 1 ? 's' : ''}`, leftX, doc.y);
    doc.text(
      `Coût total : ${fmtCost(totalCost)}`,
      leftX + pageW / 2,
      doc.y - doc.currentLineHeight(),
      { width: pageW / 2, align: 'right' },
    );
  };

  // GET /api/sav-tickets/report/pdf — Rapport maintenance en PDF (par période)
  app.get('/api/sav-tickets/report/pdf', authenticateToken, (req, res) => {
    try {
      const { start, end, type } = req.query;
      if (!start || !end)
        return res.status(400).json({ success: false, error: 'Paramètres start et end requis' });

      let sql = `
        SELECT st.id, st.title, st.description, st.cost, st.status, st.type as ticket_type,
               st.created_at, st.resolved_at,
               e.name as equipment_name, e.reference as equipment_reference,
               e.uid as equipment_uid, e.serial_number as equipment_serial_number,
               u.name as reported_by_name
        FROM sav_tickets st
        LEFT JOIN equipment e ON st.equipment_id = e.id
        LEFT JOIN users u ON st.reported_by = u.id
        WHERE 1=1
      `;
      const params = [];
      if (type === 'entries') {
        sql += ' AND DATE(st.created_at) >= ? AND DATE(st.created_at) <= ?';
        params.push(start, end);
      } else if (type === 'exits') {
        sql +=
          ' AND st.resolved_at IS NOT NULL AND DATE(st.resolved_at) >= ? AND DATE(st.resolved_at) <= ?';
        params.push(start, end);
      } else {
        sql +=
          ' AND (DATE(st.created_at) BETWEEN ? AND ? OR (st.resolved_at IS NOT NULL AND DATE(st.resolved_at) BETWEEN ? AND ?))';
        params.push(start, end, start, end);
      }
      sql += ' ORDER BY st.created_at DESC';
      const rows = db.prepare(sql).all(...params);

      const TYPE_LABELS = { entries: 'Entrées', exits: 'Sorties', all: 'Entrées & Sorties' };
      const subtitle = `Du ${start} au ${end} — ${TYPE_LABELS[type] || 'Tous'}`;

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 25, bottom: 20, left: 20, right: 20 },
        info: { Title: `Rapport Maintenance - ${start} au ${end}`, Author: 'eM@g' },
      });
      const filename = safeContentDispositionName(
        `rapport-maintenance-${start}-${end}.pdf`,
        'rapport-maintenance.pdf',
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      doc.pipe(res);
      drawSavPdfTable(doc, rows, 'Rapport Maintenance Matériel', subtitle);
      doc.end();
    } catch (error) {
      logger.error('GET /api/sav-tickets/report/pdf error:', error);
      res.status(500).json({ success: false, error: 'Erreur génération PDF' });
    }
  });

  // GET /api/sav-tickets/active/pdf — PDF de tout le matériel en SAV (tickets actifs)
  app.get('/api/sav-tickets/active/pdf', authenticateToken, (req, res) => {
    try {
      const rows = db
        .prepare(
          `
        SELECT st.id, st.title, st.description, st.cost, st.status, st.type as ticket_type,
               st.created_at, st.resolved_at,
               e.name as equipment_name, e.reference as equipment_reference,
               e.uid as equipment_uid, e.serial_number as equipment_serial_number,
               u.name as reported_by_name
        FROM sav_tickets st
        LEFT JOIN equipment e ON st.equipment_id = e.id
        LEFT JOIN users u ON st.reported_by = u.id
        WHERE st.status IN ('open', 'in_progress', 'waiting_parts')
        ORDER BY st.created_at DESC
      `,
        )
        .all();

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 25, bottom: 20, left: 20, right: 20 },
        info: { Title: 'Matériel en SAV / Maintenance', Author: 'eM@g' },
      });
      const today = new Date().toISOString().slice(0, 10);
      const filename = `materiel-en-sav-${today}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      doc.pipe(res);
      drawSavPdfTable(
        doc,
        rows,
        'Matériel en SAV / Maintenance',
        'Tickets actifs (ouverts, en cours, en attente de pièces)',
      );
      doc.end();
    } catch (error) {
      logger.error('GET /api/sav-tickets/active/pdf error:', error);
      res.status(500).json({ success: false, error: 'Erreur génération PDF' });
    }
  });
}

// ═══ LISTES FAVORIS / SURVEILLANCE ═══
export function setupEquipmentListsRoutes(app, authenticateToken, requireAdmin) {
  // GET /api/equipment-lists — Listes de l'utilisateur courant
  app.get('/api/equipment-lists', authenticateToken, (req, res) => {
    try {
      const lists = db
        .prepare(
          `
        SELECT el.*, e.name as equipment_name, e.reference, e.uid, e.serial_number, e.brand, e.status,
               ec.name as category_name, ec.icon as category_icon, ec.color as category_color
        FROM equipment_lists el
        JOIN equipment e ON el.equipment_id = e.id
        LEFT JOIN equipment_categories ec ON e.category_id = ec.id
        WHERE el.user_id = ?
        ORDER BY el.list_type, el.created_at DESC
      `,
        )
        .all(req.user.id);
      res.json(lists);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // POST /api/equipment-lists — Ajouter à une liste
  app.post('/api/equipment-lists', authenticateToken, (req, res) => {
    try {
      const { equipment_id, list_type } = req.body;
      if (!equipment_id || !list_type)
        return res.status(400).json({ success: false, error: 'equipment_id et list_type requis' });
      if (!['favorite', 'watch'].includes(list_type))
        return res
          .status(400)
          .json({ success: false, error: 'list_type doit être favorite ou watch' });

      db.prepare(
        'INSERT OR IGNORE INTO equipment_lists (equipment_id, user_id, list_type) VALUES (?, ?, ?)',
      ).run(equipment_id, req.user.id, list_type);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // DELETE /api/equipment-lists — Retirer d'une liste
  app.delete('/api/equipment-lists', authenticateToken, (req, res) => {
    try {
      const { equipment_id, list_type } = req.body;
      if (!equipment_id || !list_type)
        return res.status(400).json({ success: false, error: 'equipment_id et list_type requis' });

      db.prepare(
        'DELETE FROM equipment_lists WHERE equipment_id = ? AND user_id = ? AND list_type = ?',
      ).run(equipment_id, req.user.id, list_type);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // GET /api/equipment/by-uid/:uid — Lookup par UID (pour QR codes)
  // Modèle A : 1 ligne equipment = 1 unité physique avec uid+serial uniques.
  app.get('/api/equipment/by-uid/:uid', authenticateToken, (req, res) => {
    try {
      const uid = req.params.uid;
      const eq = db
        .prepare(
          `
        SELECT e.*, ec.name as category_name, ec.icon as category_icon, ec.color as category_color
        FROM equipment e
        LEFT JOIN equipment_categories ec ON e.category_id = ec.id
        WHERE e.uid = ?
      `,
        )
        .get(uid);

      if (!eq) return res.status(404).json({ success: false, error: 'Équipement non trouvé' });

      eq.assignments = db
        .prepare(
          `
        SELECT ea.*, p.first_name, p.last_name
        FROM equipment_assignments ea LEFT JOIN persons p ON ea.assigned_to = p.id
        WHERE ea.equipment_id = ? ORDER BY ea.start_date DESC
      `,
        )
        .all(eq.id);

      eq.savTickets = db
        .prepare(
          `
        SELECT st.*, u.name as reported_by_name, p.first_name as tech_first_name, p.last_name as tech_last_name
        FROM sav_tickets st LEFT JOIN users u ON st.reported_by = u.id LEFT JOIN persons p ON st.assigned_to = p.id
        WHERE st.equipment_id = ? ORDER BY st.created_at DESC
      `,
        )
        .all(eq.id);

      res.json(eq);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // GET /api/equipment-photos — Liste des photos/logos disponibles
  app.get('/api/equipment-photos', authenticateToken, (req, res) => {
    try {
      const photosDir = join(__dirname, '..', '..', 'public', 'Photos', 'Matériel');
      const logosDir = join(__dirname, '..', '..', 'public', 'Logos');

      let photos = [];
      let logos = [];

      try {
        photos = readdirSync(photosDir)
          .filter((f) => /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(f))
          .slice(0, 500);
      } catch (_e) {
        /* dossier inexistant */
      }

      try {
        logos = readdirSync(logosDir)
          .filter((f) => /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(f))
          .slice(0, 500);
      } catch (_e) {
        /* dossier inexistant */
      }

      res.json({ photos, logos });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ═══ UPLOAD PHOTO MATÉRIEL ═══
  const photosDir = join(__dirname, '..', '..', 'public', 'Photos', 'Matériel');
  if (!existsSync(photosDir)) mkdirSync(photosDir, { recursive: true });

  const photoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, photosDir),
    filename: (req, file, cb) => {
      // Utiliser le nom original nettoyé (garder l'extension)
      const ext = extname(file.originalname).toLowerCase();
      const baseName = file.originalname
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_\-().]/g, '_');
      // Éviter les doublons : ajouter un suffixe si le fichier existe déjà
      let finalName = baseName + ext;
      let counter = 1;
      while (existsSync(join(photosDir, finalName))) {
        finalName = `${baseName}_${counter}${ext}`;
        counter++;
      }
      cb(null, finalName);
    },
  });

  const uploadPhoto = multer({
    storage: photoStorage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
      if (
        /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(file.originalname) &&
        allowedMimes.includes(file.mimetype)
      ) {
        cb(null, true);
      } else {
        cb(new Error('Format non supporté. Formats acceptés : jpg, png, gif, webp, avif'));
      }
    },
  });

  // POST /api/equipment-photos/upload — Upload une ou plusieurs photos
  app.post(
    '/api/equipment-photos/upload',
    authenticateToken,
    uploadPhoto.array('photos', 20),
    (req, res) => {
      try {
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ success: false, error: 'Aucun fichier reçu' });
        }
        const uploaded = req.files.map((f) => f.filename);
        res.json({ success: true, uploaded, count: uploaded.length });
      } catch (error) {
        logger.error('POST /api/equipment-photos/upload error:', error);
        res.status(500).json({ success: false, error: "Erreur lors de l'upload" });
      }
    },
  );

  // DELETE /api/equipment-photos/:filename — Supprimer une photo
  app.delete('/api/equipment-photos/:filename', authenticateToken, requireAdmin, (req, res) => {
    try {
      const filename = decodeURIComponent(req.params.filename);
      // Sécurité : interdire les chemins relatifs
      if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        return res.status(400).json({ success: false, error: 'Nom de fichier invalide' });
      }
      const filePath = join(photosDir, filename);
      try {
        unlinkSync(filePath);
      } catch (err) {
        if (err.code === 'ENOENT')
          return res.status(404).json({ success: false, error: 'Photo introuvable' });
        throw err;
      }
      // Nettoyer le champ photo en DB si un équipement pointait vers ce fichier
      db.prepare('UPDATE equipment SET photo = NULL WHERE photo LIKE ?').run(`%${filename}%`);
      res.json({ success: true, deleted: filename });
    } catch (error) {
      logger.error('DELETE /api/equipment-photos error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors de la suppression' });
    }
  });

  // PUT /api/equipment-photos/rename — Renommer une photo
  app.put('/api/equipment-photos/rename', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { oldName, newName } = req.body;
      if (!oldName || !newName)
        return res.status(400).json({ success: false, error: 'oldName et newName requis' });
      if (
        oldName.includes('/') ||
        newName.includes('/') ||
        oldName.includes('..') ||
        newName.includes('..')
      ) {
        return res.status(400).json({ success: false, error: 'Nom de fichier invalide' });
      }
      const oldPath = join(photosDir, oldName);
      const newPath = join(photosDir, newName);
      if (!existsSync(oldPath))
        return res.status(404).json({ success: false, error: 'Photo source introuvable' });
      if (existsSync(newPath))
        return res
          .status(409)
          .json({ success: false, error: 'Un fichier avec ce nom existe déjà' });

      renameSync(oldPath, newPath);
      // Mettre à jour le champ photo en DB
      db.prepare('UPDATE equipment SET photo = REPLACE(photo, ?, ?) WHERE photo LIKE ?').run(
        oldName,
        newName,
        `%${oldName}%`,
      );
      res.json({ success: true, oldName, newName });
    } catch (error) {
      logger.error('PUT /api/equipment-photos/rename error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors du renommage' });
    }
  });

  // Résolution du fichier zones — server/data/ (prioritaire), puis racine/data/, puis public/ (initial)
  const resolveZonesPath = (filename) => {
    const dataPath = join(__dirname, 'data', filename);
    if (existsSync(dataPath)) return dataPath;
    const rootDataPath = join(__dirname, '..', '..', 'data', filename);
    if (existsSync(rootDataPath)) return rootDataPath;
    return join(__dirname, '..', '..', 'public', filename);
  };

  // [PERF Sprint 2] Cache des fichiers zones par chemin + mtime.
  // Évite readFileSync + JSON.parse à chaque requête (zones JSON ~10-50 Ko, lus très souvent).
  // Invalidation auto par mtime → le PUT qui réécrit le fichier est détecté sans hook explicite.
  const _zonesCache = new Map(); // path -> { mtimeMs, data }
  const loadZonesCached = (filename) => {
    const fullPath = resolveZonesPath(filename);
    const stat = statSync(fullPath);
    const cached = _zonesCache.get(fullPath);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.data;
    const data = JSON.parse(readFileSync(fullPath, 'utf-8'));
    _zonesCache.set(fullPath, { mtimeMs: stat.mtimeMs, data });
    return data;
  };

  // ═══ GET /api/equipment-all-depot-zones — Toutes les zones des deux dépôts ═══
  app.get('/api/equipment-all-depot-zones', authenticateToken, (req, res) => {
    try {
      const depot1 = loadZonesCached('depot-zones.json');
      const depot2 = loadZonesCached('depot2-zones.json');
      res.json({
        depots: [
          { id: '1', ...depot1 },
          { id: '2', ...depot2 },
        ],
      });
    } catch (error) {
      logger.error('GET /api/equipment-all-depot-zones error:', error);
      res.status(500).json({ success: false, error: 'Erreur chargement zones dépôt' });
    }
  });

  // ═══ GET /api/equipment-depot-zones — Zones de dépôt (depot-zones.json / depot2-zones.json) ═══
  // ?depot=1 (défaut) ou ?depot=2
  app.get('/api/equipment-depot-zones', authenticateToken, (req, res) => {
    try {
      const depotId = parseInt(req.query.depot, 10) || 1;
      const filename = depotId === 2 ? 'depot2-zones.json' : 'depot-zones.json';
      const data = loadZonesCached(filename);
      res.json(data);
    } catch (error) {
      logger.error('GET /api/equipment-depot-zones error:', error);
      res.status(500).json({ success: false, error: 'Erreur chargement zones dépôt' });
    }
  });

  // ═══ GET /api/equipment-location-stats — Stats localisation par zone ═══
  app.get('/api/equipment-location-stats', authenticateToken, (req, res) => {
    try {
      const depot = req.query.depot || null;
      let statsQuery = `
        SELECT location_depot, location_zone, location_floor, COUNT(*) as count
        FROM equipment
        WHERE location_zone IS NOT NULL AND location_zone != ''
      `;
      const params = [];
      if (depot) {
        statsQuery += ' AND location_depot = ?';
        params.push(depot);
      }
      statsQuery +=
        ' GROUP BY location_depot, location_zone, location_floor ORDER BY location_depot, location_zone';
      const stats = db.prepare(statsQuery).all(...params);

      const unlocated = db
        .prepare(
          "SELECT COUNT(*) as count FROM equipment WHERE location_zone IS NULL OR location_zone = ''",
        )
        .get();

      res.json({ stats, unlocated: unlocated.count });
    } catch (error) {
      logger.error('GET /api/equipment-location-stats error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ═══ PUT /api/equipment-depot-zones — Sauvegarder les zones modifiées (admin) ═══
  app.put('/api/equipment-depot-zones', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { depot, zones } = req.body;
      const depotId = parseInt(depot, 10);
      if (![1, 2].includes(depotId)) {
        return res.status(400).json({ success: false, error: 'Dépôt invalide (1 ou 2)' });
      }
      if (!zones || !Array.isArray(zones.zones) || !zones.version) {
        return res.status(400).json({ success: false, error: 'Format de données invalide' });
      }
      const filename = depotId === 2 ? 'depot2-zones.json' : 'depot-zones.json';
      const dataDir = join(__dirname, 'data');
      if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
      const zonesPath = join(dataDir, filename);

      // Backup before overwrite
      const backupPath = zonesPath + '.backup';
      if (existsSync(zonesPath)) {
        writeFileSync(backupPath, readFileSync(zonesPath));
      }

      writeFileSync(zonesPath, JSON.stringify(zones, null, 2), 'utf-8');
      logger.info(
        `Depot ${depotId} zones updated by ${req.user.name} (${zones.zones.length} zones)`,
      );
      res.json({ success: true, zonesCount: zones.zones.length });
    } catch (error) {
      logger.error('PUT /api/equipment-depot-zones error:', error);
      res.status(500).json({ success: false, error: 'Erreur sauvegarde zones' });
    }
  });
}
