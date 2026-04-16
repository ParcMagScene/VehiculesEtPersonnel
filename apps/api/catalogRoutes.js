// ============================================================
// MODULE CATALOGUE + FLIGHT-CASES + MODÈLES CAMIONS — eM@g
// Routes REST : catalog, flightcases, truck-models, reservation-equipment
// Intégration avec l'application Chargement 3D
// ============================================================

import db, { addToHistory } from './database.js';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import { validate } from './schemas/imports.js';
import {
  catalogEquipmentSchema,
  catalogEquipmentUpdateSchema,
  catalogMatchReferencesSchema,
  flightcaseSchema,
  flightcaseUpdateSchema,
  truckModelSchema,
  truckModelUpdateSchema,
  reservationEquipmentSchema,
} from './schemas/catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const generateId = () => crypto.randomUUID();

// ============ CATALOGUE D'ÉQUIPEMENTS ============

export function setupCatalogRoutes(app, authenticateToken, requireWriteAccess) {
  // GET /api/catalog/equipment — Liste avec filtres
  app.get('/api/catalog/equipment', authenticateToken, (req, res) => {
    try {
      const {
        family,
        subfamily,
        category,
        search,
        location_zone,
        location_code,
        location_floor,
        limit,
        offset,
      } = req.query;
      let query = 'SELECT * FROM equipment_catalog WHERE 1=1';
      const params = [];

      if (family) {
        query += ' AND family = ?';
        params.push(family);
      }
      if (subfamily) {
        query += ' AND subfamily = ?';
        params.push(subfamily);
      }
      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }
      if (location_zone) {
        query += ' AND location_zone = ?';
        params.push(location_zone);
      }
      if (location_code) {
        query += ' AND location_code = ?';
        params.push(location_code);
      }
      if (location_floor) {
        query += ' AND location_floor = ?';
        params.push(location_floor);
      }
      if (search) {
        query += ' AND (name LIKE ? OR reference LIKE ? OR family LIKE ? OR location_zone LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s, s);
      }

      query += ' ORDER BY family, subfamily, name';

      if (limit) {
        query += ' LIMIT ?';
        params.push(parseInt(limit));
        if (offset) {
          query += ' OFFSET ?';
          params.push(parseInt(offset));
        }
      }

      const items = db.prepare(query).all(...params);

      // Compter le total pour la pagination
      let countQuery = 'SELECT COUNT(*) as total FROM equipment_catalog WHERE 1=1';
      const countParams = [];
      if (family) {
        countQuery += ' AND family = ?';
        countParams.push(family);
      }
      if (subfamily) {
        countQuery += ' AND subfamily = ?';
        countParams.push(subfamily);
      }
      if (category) {
        countQuery += ' AND category = ?';
        countParams.push(category);
      }
      if (location_zone) {
        countQuery += ' AND location_zone = ?';
        countParams.push(location_zone);
      }
      if (location_code) {
        countQuery += ' AND location_code = ?';
        countParams.push(location_code);
      }
      if (location_floor) {
        countQuery += ' AND location_floor = ?';
        countParams.push(location_floor);
      }
      if (search) {
        countQuery +=
          ' AND (name LIKE ? OR reference LIKE ? OR family LIKE ? OR location_zone LIKE ?)';
        const s = `%${search}%`;
        countParams.push(s, s, s, s);
      }
      const { total } = db.prepare(countQuery).get(...countParams);

      res.json({ items, total });
    } catch (error) {
      logger.error('GET /api/catalog/equipment error:', error);
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // POST /api/catalog/equipment/match-references — Matching lot de références BP → catalogue
  app.post(
    '/api/catalog/equipment/match-references',
    authenticateToken,
    validate(catalogMatchReferencesSchema),
    (req, res) => {
      try {
        const { references } = req.body;
        // Recherche exacte + recherche partielle (sans tirets/espaces)
        const matches = {};
        const stmt = db.prepare(
          'SELECT id, reference, name, family, subfamily, category FROM equipment_catalog WHERE reference = ?',
        );
        const stmtLike = db.prepare(
          "SELECT id, reference, name, family, subfamily, category FROM equipment_catalog WHERE REPLACE(REPLACE(reference, '-', ''), ' ', '') = REPLACE(REPLACE(?, '-', ''), ' ', '') LIMIT 1",
        );

        for (const ref of references) {
          if (!ref) continue;
          const trimmed = ref.trim();
          let found = stmt.get(trimmed);
          if (!found) found = stmtLike.get(trimmed);
          if (found) {
            matches[ref] = {
              id: found.id,
              reference: found.reference,
              name: found.name,
              family: found.family,
              category: found.category,
            };
          }
        }
        res.json({ matches, total: references.length, matched: Object.keys(matches).length });
      } catch (error) {
        logger.error('POST /api/catalog/equipment/match-references error:', error);
        res.status(500).json({ success: false, error: 'Erreur matching références' });
      }
    },
  );

  // GET /api/catalog/equipment/zones — Données des zones de dépôt depuis depot-zones.json
  app.get('/api/catalog/equipment/zones', authenticateToken, (req, res) => {
    try {
      const zonesPath = join(__dirname, '..', '..', 'public', 'depot-zones.json');
      const data = JSON.parse(readFileSync(zonesPath, 'utf-8'));
      res.json(data);
    } catch (error) {
      logger.error('GET /api/catalog/equipment/zones error:', error);
      res.status(500).json({ success: false, error: 'Erreur chargement zones dépôt' });
    }
  });

  // GET /api/catalog/equipment/location-stats — Stats par zone
  app.get('/api/catalog/equipment/location-stats', authenticateToken, (req, res) => {
    try {
      const stats = db
        .prepare(
          `
        SELECT location_zone, location_floor, COUNT(*) as count
        FROM equipment_catalog
        WHERE location_zone IS NOT NULL
        GROUP BY location_zone, location_floor
        ORDER BY location_zone
      `,
        )
        .all();

      const unlocated = db
        .prepare('SELECT COUNT(*) as count FROM equipment_catalog WHERE location_zone IS NULL')
        .get();

      res.json({ stats, unlocated: unlocated.count });
    } catch (error) {
      logger.error('GET /api/catalog/equipment/location-stats error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // GET /api/catalog/equipment/families — Familles distinctes
  app.get('/api/catalog/equipment/families', authenticateToken, (req, res) => {
    try {
      const families = db
        .prepare(
          'SELECT DISTINCT family FROM equipment_catalog WHERE family IS NOT NULL ORDER BY family',
        )
        .all();
      res.json(families.map((f) => f.family));
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // GET /api/catalog/equipment/categories — Catégories distinctes
  app.get('/api/catalog/equipment/categories', authenticateToken, (req, res) => {
    try {
      const categories = db
        .prepare(
          'SELECT DISTINCT category FROM equipment_catalog WHERE category IS NOT NULL ORDER BY category',
        )
        .all();
      res.json(categories.map((c) => c.category));
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // GET /api/catalog/equipment/:id
  app.get('/api/catalog/equipment/:id', authenticateToken, (req, res) => {
    try {
      const item = db.prepare('SELECT * FROM equipment_catalog WHERE id = ?').get(req.params.id);
      if (!item)
        return res.status(404).json({ success: false, error: 'Équipement catalogue non trouvé' });

      // Charger le flight-case par défaut si existant
      if (item.default_flightcase_id) {
        item.defaultFlightcase = db
          .prepare('SELECT * FROM flightcases WHERE id = ?')
          .get(item.default_flightcase_id);
      }

      res.json(item);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // POST /api/catalog/equipment (admin)
  app.post(
    '/api/catalog/equipment',
    authenticateToken,
    requireWriteAccess,
    validate(catalogEquipmentSchema),
    (req, res) => {
      try {
        const {
          reference,
          name,
          family,
          subfamily,
          category,
          dimensions,
          weight,
          default_flightcase_id,
          metadata,
          location_depot,
          location_zone,
          location_code,
          location_floor,
        } = req.body;

        const id = generateId();
        const now = new Date().toISOString();

        db.prepare(
          `
        INSERT INTO equipment_catalog (id, reference, name, family, subfamily, category, dimensions, weight, default_flightcase_id, metadata, location_depot, location_zone, location_code, location_floor, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        ).run(
          id,
          reference || null,
          name,
          family || null,
          subfamily || null,
          category || null,
          dimensions ? JSON.stringify(dimensions) : null,
          weight || null,
          default_flightcase_id || null,
          metadata ? JSON.stringify(metadata) : null,
          location_depot || null,
          location_zone || null,
          location_code || null,
          location_floor || null,
          now,
          now,
        );

        addToHistory(
          'equipment_catalog',
          id,
          'create',
          { name, reference, family },
          req.user?.id,
          req.user?.name,
        );

        const created = db.prepare('SELECT * FROM equipment_catalog WHERE id = ?').get(id);
        res.status(201).json(created);
      } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
          return res.status(409).json({ success: false, error: 'Référence déjà existante' });
        }
        logger.error('POST /api/catalog/equipment error:', error);
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // PUT /api/catalog/equipment/:id
  app.put(
    '/api/catalog/equipment/:id',
    authenticateToken,
    requireWriteAccess,
    validate(catalogEquipmentUpdateSchema),
    (req, res) => {
      try {
        const {
          reference,
          name,
          family,
          subfamily,
          category,
          dimensions,
          weight,
          default_flightcase_id,
          metadata,
          location_depot,
          location_zone,
          location_code,
          location_floor,
        } = req.body;
        const existing = db
          .prepare('SELECT * FROM equipment_catalog WHERE id = ?')
          .get(req.params.id);
        if (!existing)
          return res.status(404).json({ success: false, error: 'Équipement catalogue non trouvé' });

        const now = new Date().toISOString();

        db.prepare(
          `
        UPDATE equipment_catalog SET
          reference = ?, name = ?, family = ?, subfamily = ?, category = ?,
          dimensions = ?, weight = ?, default_flightcase_id = ?, metadata = ?,
          location_depot = ?, location_zone = ?, location_code = ?, location_floor = ?,
          updated_at = ?
        WHERE id = ?
      `,
        ).run(
          reference ?? existing.reference,
          name ?? existing.name,
          family ?? existing.family,
          subfamily ?? existing.subfamily,
          category ?? existing.category,
          dimensions ? JSON.stringify(dimensions) : existing.dimensions,
          weight ?? existing.weight,
          default_flightcase_id ?? existing.default_flightcase_id,
          metadata ? JSON.stringify(metadata) : existing.metadata,
          location_depot !== undefined ? location_depot || null : existing.location_depot,
          location_zone !== undefined ? location_zone || null : existing.location_zone,
          location_code !== undefined ? location_code || null : existing.location_code,
          location_floor !== undefined ? location_floor || null : existing.location_floor,
          now,
          req.params.id,
        );

        addToHistory(
          'equipment_catalog',
          req.params.id,
          'update',
          req.body,
          req.user?.id,
          req.user?.name,
        );

        const updated = db
          .prepare('SELECT * FROM equipment_catalog WHERE id = ?')
          .get(req.params.id);
        res.json(updated);
      } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
          return res.status(409).json({ success: false, error: 'Référence déjà existante' });
        }
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // DELETE /api/catalog/equipment/:id
  app.delete('/api/catalog/equipment/:id', authenticateToken, requireWriteAccess, (req, res) => {
    try {
      const existing = db
        .prepare('SELECT * FROM equipment_catalog WHERE id = ?')
        .get(req.params.id);
      if (!existing)
        return res.status(404).json({ success: false, error: 'Équipement catalogue non trouvé' });

      // Vérifier s'il est utilisé dans des réservations
      const usageCount = db
        .prepare('SELECT COUNT(*) as count FROM equipment_to_vehicle WHERE equipment_id = ?')
        .get(req.params.id);
      if (usageCount.count > 0) {
        return res.status(409).json({
          success: false,
          error: `Impossible de supprimer : utilisé dans ${usageCount.count} réservation(s)`,
        });
      }

      db.prepare('DELETE FROM equipment_catalog WHERE id = ?').run(req.params.id);
      addToHistory(
        'equipment_catalog',
        req.params.id,
        'delete',
        { name: existing.name },
        req.user?.id,
        req.user?.name,
      );

      res.json({ success: true, message: 'Équipement catalogue supprimé' });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}

// ============ FLIGHT-CASES ============

export function setupFlightcasesRoutes(app, authenticateToken, requireWriteAccess) {
  // GET /api/flightcases
  app.get('/api/flightcases', authenticateToken, (req, res) => {
    try {
      const { category, search } = req.query;
      let query = 'SELECT * FROM flightcases WHERE 1=1';
      const params = [];

      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }
      if (search) {
        query += ' AND (name LIKE ? OR internal_code LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s);
      }

      query += ' ORDER BY category, name';
      const items = db.prepare(query).all(...params);
      res.json(items);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // GET /api/flightcases/:id
  app.get('/api/flightcases/:id', authenticateToken, (req, res) => {
    try {
      const item = db.prepare('SELECT * FROM flightcases WHERE id = ?').get(req.params.id);
      if (!item) return res.status(404).json({ success: false, error: 'Flight-case non trouvé' });
      res.json(item);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // POST /api/flightcases
  app.post(
    '/api/flightcases',
    authenticateToken,
    requireWriteAccess,
    validate(flightcaseSchema),
    (req, res) => {
      try {
        const { name, internal_code, dimensions, capacity, category, texture, metadata } = req.body;

        const id = generateId();
        const now = new Date().toISOString();

        db.prepare(
          `
        INSERT INTO flightcases (id, name, internal_code, dimensions, capacity, category, texture, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        ).run(
          id,
          name,
          internal_code || null,
          dimensions ? JSON.stringify(dimensions) : null,
          capacity || 1,
          category || null,
          texture || null,
          metadata ? JSON.stringify(metadata) : null,
          now,
          now,
        );

        addToHistory(
          'flightcase',
          id,
          'create',
          { name, internal_code },
          req.user?.id,
          req.user?.name,
        );

        const created = db.prepare('SELECT * FROM flightcases WHERE id = ?').get(id);
        res.status(201).json(created);
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // PUT /api/flightcases/:id
  app.put(
    '/api/flightcases/:id',
    authenticateToken,
    requireWriteAccess,
    validate(flightcaseUpdateSchema),
    (req, res) => {
      try {
        const { name, internal_code, dimensions, capacity, category, texture, metadata } = req.body;
        const existing = db.prepare('SELECT * FROM flightcases WHERE id = ?').get(req.params.id);
        if (!existing)
          return res.status(404).json({ success: false, error: 'Flight-case non trouvé' });

        const now = new Date().toISOString();

        db.prepare(
          `
        UPDATE flightcases SET
          name = ?, internal_code = ?, dimensions = ?, capacity = ?,
          category = ?, texture = ?, metadata = ?, updated_at = ?
        WHERE id = ?
      `,
        ).run(
          name ?? existing.name,
          internal_code ?? existing.internal_code,
          dimensions ? JSON.stringify(dimensions) : existing.dimensions,
          capacity ?? existing.capacity,
          category ?? existing.category,
          texture ?? existing.texture,
          metadata ? JSON.stringify(metadata) : existing.metadata,
          now,
          req.params.id,
        );

        addToHistory('flightcase', req.params.id, 'update', req.body, req.user?.id, req.user?.name);

        const updated = db.prepare('SELECT * FROM flightcases WHERE id = ?').get(req.params.id);
        res.json(updated);
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // DELETE /api/flightcases/:id
  app.delete('/api/flightcases/:id', authenticateToken, requireWriteAccess, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM flightcases WHERE id = ?').get(req.params.id);
      if (!existing)
        return res.status(404).json({ success: false, error: 'Flight-case non trouvé' });

      // Vérifier si utilisé dans des réservations
      const usageCount = db
        .prepare('SELECT COUNT(*) as count FROM equipment_to_vehicle WHERE flightcase_id = ?')
        .get(req.params.id);
      if (usageCount.count > 0) {
        return res.status(409).json({
          success: false,
          error: `Impossible de supprimer : utilisé dans ${usageCount.count} réservation(s)`,
        });
      }

      // Détacher du catalogue
      db.prepare(
        'UPDATE equipment_catalog SET default_flightcase_id = NULL WHERE default_flightcase_id = ?',
      ).run(req.params.id);

      db.prepare('DELETE FROM flightcases WHERE id = ?').run(req.params.id);
      addToHistory(
        'flightcase',
        req.params.id,
        'delete',
        { name: existing.name },
        req.user?.id,
        req.user?.name,
      );

      res.json({ success: true, message: 'Flight-case supprimé' });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}

// ============ MODÈLES DE CAMIONS ============

export function setupTruckModelsRoutes(app, authenticateToken, requireWriteAccess) {
  // GET /api/trucks/models
  app.get('/api/trucks/models', authenticateToken, (req, res) => {
    try {
      const { type, search } = req.query;
      let query = 'SELECT * FROM truck_models WHERE 1=1';
      const params = [];

      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }
      if (search) {
        query += ' AND (name LIKE ? OR internal_code LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s);
      }

      query += ' ORDER BY type, name';
      const items = db.prepare(query).all(...params);
      res.json(items);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // GET /api/trucks/models/:id
  app.get('/api/trucks/models/:id', authenticateToken, (req, res) => {
    try {
      const item = db.prepare('SELECT * FROM truck_models WHERE id = ?').get(req.params.id);
      if (!item)
        return res.status(404).json({ success: false, error: 'Modèle de camion non trouvé' });
      res.json(item);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // POST /api/trucks/models
  app.post(
    '/api/trucks/models',
    authenticateToken,
    requireWriteAccess,
    validate(truckModelSchema),
    (req, res) => {
      try {
        const { name, type, internal_code, dimensions, axle_config, metadata } = req.body;

        const id = generateId();
        const now = new Date().toISOString();

        db.prepare(
          `
        INSERT INTO truck_models (id, name, type, internal_code, dimensions, axle_config, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        ).run(
          id,
          name,
          type || null,
          internal_code || null,
          dimensions ? JSON.stringify(dimensions) : null,
          axle_config ? JSON.stringify(axle_config) : null,
          metadata ? JSON.stringify(metadata) : null,
          now,
          now,
        );

        addToHistory('truck_model', id, 'create', { name, type }, req.user?.id, req.user?.name);

        const created = db.prepare('SELECT * FROM truck_models WHERE id = ?').get(id);
        res.status(201).json(created);
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // PUT /api/trucks/models/:id
  app.put(
    '/api/trucks/models/:id',
    authenticateToken,
    requireWriteAccess,
    validate(truckModelUpdateSchema),
    (req, res) => {
      try {
        const { name, type, internal_code, dimensions, axle_config, metadata } = req.body;
        const existing = db.prepare('SELECT * FROM truck_models WHERE id = ?').get(req.params.id);
        if (!existing)
          return res.status(404).json({ success: false, error: 'Modèle de camion non trouvé' });

        const now = new Date().toISOString();

        db.prepare(
          `
        UPDATE truck_models SET
          name = ?, type = ?, internal_code = ?, dimensions = ?,
          axle_config = ?, metadata = ?, updated_at = ?
        WHERE id = ?
      `,
        ).run(
          name ?? existing.name,
          type ?? existing.type,
          internal_code ?? existing.internal_code,
          dimensions ? JSON.stringify(dimensions) : existing.dimensions,
          axle_config ? JSON.stringify(axle_config) : existing.axle_config,
          metadata ? JSON.stringify(metadata) : existing.metadata,
          now,
          req.params.id,
        );

        addToHistory(
          'truck_model',
          req.params.id,
          'update',
          req.body,
          req.user?.id,
          req.user?.name,
        );

        const updated = db.prepare('SELECT * FROM truck_models WHERE id = ?').get(req.params.id);
        res.json(updated);
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // DELETE /api/trucks/models/:id
  app.delete('/api/trucks/models/:id', authenticateToken, requireWriteAccess, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM truck_models WHERE id = ?').get(req.params.id);
      if (!existing)
        return res.status(404).json({ success: false, error: 'Modèle de camion non trouvé' });

      db.prepare('DELETE FROM truck_models WHERE id = ?').run(req.params.id);
      addToHistory(
        'truck_model',
        req.params.id,
        'delete',
        { name: existing.name },
        req.user?.id,
        req.user?.name,
      );

      res.json({ success: true, message: 'Modèle de camion supprimé' });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}

// ============ ÉQUIPEMENTS ATTACHÉS AUX RÉSERVATIONS ============

export function setupReservationEquipmentRoutes(app, authenticateToken) {
  // GET /api/reservations/:id/equipment — Liste équipements assignés
  app.get('/api/reservations/:id/equipment', authenticateToken, (req, res) => {
    try {
      const items = db
        .prepare(
          `
        SELECT etv.*, 
          ec.name as equipment_name, ec.reference, ec.family, ec.dimensions as equipment_dimensions, ec.weight,
          fc.name as flightcase_name, fc.dimensions as flightcase_dimensions
        FROM equipment_to_vehicle etv
        LEFT JOIN equipment_catalog ec ON etv.equipment_id = ec.id
        LEFT JOIN flightcases fc ON etv.flightcase_id = fc.id
        WHERE etv.reservation_id = ?
        ORDER BY ec.family, ec.name
      `,
        )
        .all(req.params.id);

      // Calculer totaux
      let totalWeight = 0;
      let totalVolume = 0;
      for (const item of items) {
        if (item.weight) totalWeight += item.weight * item.quantity;
        if (item.equipment_dimensions) {
          try {
            const dims = JSON.parse(item.equipment_dimensions);
            if (dims.w && dims.h && dims.d) {
              totalVolume += (dims.w * dims.h * dims.d * item.quantity) / 1000000; // cm³ → m³
            }
          } catch (_e) {
            /* ignore parse errors */
          }
        }
      }

      res.json({
        items,
        summary: {
          count: items.length,
          totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
          totalWeight: Math.round(totalWeight * 100) / 100,
          totalVolume: Math.round(totalVolume * 1000) / 1000,
        },
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // POST /api/reservations/:id/equipment — Assigner équipement
  app.post(
    '/api/reservations/:id/equipment',
    authenticateToken,
    validate(reservationEquipmentSchema),
    (req, res) => {
      try {
        const { equipment_id, quantity, flightcase_id, metadata } = req.body;

        // Vérifier que la réservation existe
        const reservation = db
          .prepare('SELECT id FROM reservations WHERE id = ?')
          .get(req.params.id);
        if (!reservation)
          return res.status(404).json({ success: false, error: 'Réservation non trouvée' });

        // Vérifier que l'équipement catalogue existe
        const equipment = db
          .prepare('SELECT * FROM equipment_catalog WHERE id = ?')
          .get(equipment_id);
        if (!equipment)
          return res.status(404).json({ success: false, error: 'Équipement catalogue non trouvé' });

        // Auto-suggest flight-case si non spécifié
        const effectiveFlightcaseId = flightcase_id || equipment.default_flightcase_id || null;

        const id = generateId();

        db.prepare(
          `
        INSERT INTO equipment_to_vehicle (id, reservation_id, equipment_id, quantity, flightcase_id, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        ).run(
          id,
          req.params.id,
          equipment_id,
          quantity || 1,
          effectiveFlightcaseId,
          metadata ? JSON.stringify(metadata) : null,
        );

        addToHistory(
          'reservation_equipment',
          id,
          'assign',
          {
            reservation_id: req.params.id,
            equipment_name: equipment.name,
            quantity: quantity || 1,
          },
          req.user?.id,
          req.user?.name,
        );

        // Retourner l'item complet avec les joins
        const created = db
          .prepare(
            `
        SELECT etv.*, 
          ec.name as equipment_name, ec.reference, ec.family, ec.dimensions as equipment_dimensions, ec.weight,
          fc.name as flightcase_name, fc.dimensions as flightcase_dimensions
        FROM equipment_to_vehicle etv
        LEFT JOIN equipment_catalog ec ON etv.equipment_id = ec.id
        LEFT JOIN flightcases fc ON etv.flightcase_id = fc.id
        WHERE etv.id = ?
      `,
          )
          .get(id);

        res.status(201).json(created);
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // DELETE /api/reservations/:reservationId/equipment/:equipmentLinkId — Retirer équipement
  app.delete(
    '/api/reservations/:reservationId/equipment/:linkId',
    authenticateToken,
    (req, res) => {
      try {
        const existing = db
          .prepare('SELECT * FROM equipment_to_vehicle WHERE id = ? AND reservation_id = ?')
          .get(req.params.linkId, req.params.reservationId);

        if (!existing)
          return res
            .status(404)
            .json({ success: false, error: 'Lien équipement-réservation non trouvé' });

        db.prepare('DELETE FROM equipment_to_vehicle WHERE id = ?').run(req.params.linkId);

        addToHistory(
          'reservation_equipment',
          req.params.linkId,
          'remove',
          {
            reservation_id: req.params.reservationId,
            equipment_id: existing.equipment_id,
          },
          req.user?.id,
          req.user?.name,
        );

        res.json({ success: true, message: 'Équipement retiré de la réservation' });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // GET /api/reservations/:id/chargement-export — Export JSON pour Chargement 3D
  app.get('/api/reservations/:id/chargement-export', authenticateToken, (req, res) => {
    try {
      const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
      if (!reservation)
        return res.status(404).json({ success: false, error: 'Réservation non trouvée' });

      // Charger le véhicule et trouver un modèle de camion associé
      const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(reservation.vehicle_id);

      // Charger les équipements assignés
      const equipments = db
        .prepare(
          `
        SELECT etv.*, 
          ec.name, ec.reference, ec.dimensions as equipment_dimensions, ec.weight,
          ec.location_zone, ec.location_code, ec.location_floor,
          fc.name as flightcase_name, fc.dimensions as flightcase_dimensions, fc.internal_code as flightcase_code
        FROM equipment_to_vehicle etv
        LEFT JOIN equipment_catalog ec ON etv.equipment_id = ec.id
        LEFT JOIN flightcases fc ON etv.flightcase_id = fc.id
        WHERE etv.reservation_id = ?
      `,
        )
        .all(req.params.id);

      // Trouver un modèle de camion par défaut basé sur le véhicule
      let truckModel = null;
      if (vehicle) {
        // Essayer de matcher par type / nom
        truckModel = db
          .prepare('SELECT * FROM truck_models WHERE name LIKE ? OR internal_code LIKE ? LIMIT 1')
          .get(`%${vehicle.name}%`, `%${vehicle.registration}%`);
      }

      // Format d'export pour Chargement 3D
      const exportData = {
        version: '1.0',
        source: 'emag',
        reservation_id: req.params.id,
        reservation: {
          id: reservation.id,
          start_date: reservation.start_date,
          end_date: reservation.end_date,
          client: reservation.client_name || '',
          description: reservation.description || '',
        },
        vehicle: vehicle
          ? {
              id: vehicle.id,
              name: vehicle.name,
              registration: vehicle.registration,
              type: vehicle.type,
            }
          : null,
        truck_model: truckModel,
        items: equipments.map((eq) => ({
          id: eq.equipment_id,
          name: eq.name,
          reference: eq.reference,
          quantity: eq.quantity,
          dimensions: eq.equipment_dimensions ? JSON.parse(eq.equipment_dimensions) : null,
          weight: eq.weight,
          location: eq.location_zone
            ? {
                zone: eq.location_zone,
                code: eq.location_code,
                floor: eq.location_floor,
              }
            : null,
          flightcase: eq.flightcase_id
            ? {
                id: eq.flightcase_id,
                name: eq.flightcase_name,
                code: eq.flightcase_code,
                dimensions: eq.flightcase_dimensions ? JSON.parse(eq.flightcase_dimensions) : null,
              }
            : null,
        })),
        generated_at: new Date().toISOString(),
      };

      res.json(exportData);
    } catch (error) {
      logger.error('GET /api/reservations/:id/chargement-export error:', error);
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}
