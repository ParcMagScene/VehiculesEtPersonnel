// ═══════════════════════════════════════════════════════════════
// server/inventoryRoutes.js — Module Inventaire Unifié eM@g
// Gère : emplacements multi-dépôts, historique prix, anomalies,
//         comptages inventaire, alertes stock bas, stats avancées,
//         moteur de prix intelligent (IQR, σ, score confiance)
// ═══════════════════════════════════════════════════════════════

import db from './database.js';
import logger from './logger.js';
import { validate } from './schemas/imports.js';
import {
  anomalyUpdateSchema,
  inventoryCountSchema,
  locationSchema,
  locationUpdateSchema,
  priceBatchSchema,
  priceFusionSchema,
  priceSchema,
} from './schemas/inventory.js';

// ═══════════════════════════════════════════════════════════════
// MOTEUR DE PRIX INTELLIGENT
// ═══════════════════════════════════════════════════════════════

/**
 * Calcule les statistiques IQR (Interquartile Range) sur un tableau de nombres.
 * Retourne: { median, q1, q3, iqr, lowerFence, upperFence, outliers, clean }
 */
function computeIQR(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  const lower = sorted.slice(0, Math.floor(n / 2));
  const upper = sorted.slice(Math.ceil(n / 2));

  const q1 = lower.length ? lower[Math.floor(lower.length / 2)] : sorted[0];
  const q3 = upper.length ? upper[Math.floor(upper.length / 2)] : sorted[n - 1];
  const iqr = q3 - q1;

  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);
  const clean = sorted.filter((v) => v >= lowerFence && v <= upperFence);

  return { median, q1, q3, iqr, lowerFence, upperFence, outliers, clean };
}

/**
 * Calcule l'écart-type σ et la moyenne.
 */
function computeStdDev(values) {
  if (values.length < 2) return { mean: values[0] || 0, stddev: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return { mean, stddev: Math.sqrt(variance) };
}

/**
 * Score de confiance 0-100 basé sur :
 * - Nombre de sources (30%)
 * - Fraîcheur des données (30%)
 * - Cohérence des prix / faible variance (40%)
 */
function computeConfidence(priceEntries) {
  if (!priceEntries.length) return 0;

  // Score nombre de sources (max à 5+)
  const sourceScore = Math.min(priceEntries.length / 5, 1) * 30;

  // Score fraîcheur (entrée la plus récente < 30j = 100%, > 365j = 0%)
  const newest = priceEntries.reduce((max, e) => {
    const d = new Date(e.created_at).getTime();
    return d > max ? d : max;
  }, 0);
  const daysSinceNewest = (Date.now() - newest) / 86400000;
  const freshnessScore = Math.max(0, 1 - daysSinceNewest / 365) * 30;

  // Score cohérence (faible coefficient de variation = bon)
  const prices = priceEntries.map((e) => e.price_ht);
  const { mean, stddev } = computeStdDev(prices);
  const cv = mean > 0 ? stddev / mean : 0;
  const coherenceScore = Math.max(0, 1 - cv * 2) * 40;

  return Math.round(sourceScore + freshnessScore + coherenceScore);
}

/**
 * Analyse de prix complète pour un article.
 */
function analyzePrices(priceEntries) {
  if (!priceEntries.length) {
    return { status: 'no_data', confidence: 0 };
  }

  const prices = priceEntries.map((e) => e.price_ht);
  const iqr = computeIQR(prices);
  const { mean, stddev } = computeStdDev(prices);
  const confidence = computeConfidence(priceEntries);

  // Prix recommandé = médiane des prix non-outliers
  const cleanPrices = iqr.clean.length > 0 ? iqr.clean : prices;
  const { mean: cleanMean } = computeStdDev(cleanPrices);

  return {
    status: 'ok',
    count: prices.length,
    recommended_price: Math.round(cleanMean * 100) / 100,
    price_low: Math.round(iqr.q1 * 100) / 100,
    price_median: Math.round(iqr.median * 100) / 100,
    price_high: Math.round(iqr.q3 * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    stddev: Math.round(stddev * 100) / 100,
    iqr: Math.round(iqr.iqr * 100) / 100,
    outlier_count: iqr.outliers.length,
    outliers: iqr.outliers,
    confidence,
    sources: priceEntries.map((e) => ({
      supplier_id: e.supplier_id,
      price_ht: e.price_ht,
      source: e.source,
      date: e.created_at,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════
// SETUP ROUTES
// ═══════════════════════════════════════════════════════════════

export function setupInventoryRoutes(app, authenticate) {
  // ────────────────────────────────────────
  // EMPLACEMENTS (LOCATIONS MULTI-DÉPÔTS)
  // ────────────────────────────────────────

  // GET /api/inventory/locations — Liste tous les emplacements
  app.get('/api/inventory/locations', authenticate, (req, res) => {
    try {
      const { depot, type, active } = req.query;
      let sql = 'SELECT * FROM inventory_locations WHERE 1=1';
      const params = [];
      if (depot) {
        sql += ' AND depot_number = ?';
        params.push(depot);
      }
      if (type) {
        sql += ' AND type = ?';
        params.push(type);
      }
      if (active !== undefined) {
        sql += ' AND is_active = ?';
        params.push(active === 'true' ? 1 : 0);
      }
      sql += ' ORDER BY depot_number, name';
      res.json(db.prepare(sql).all(...params));
    } catch (err) {
      logger.error('GET /api/inventory/locations:', err.message);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /api/inventory/locations — Créer un emplacement
  app.post('/api/inventory/locations', authenticate, validate(locationSchema), (req, res) => {
    try {
      const {
        name,
        code,
        depot_number,
        type,
        zone,
        floor,
        capacity,
        address,
        gps_lat,
        gps_lon,
        parent_id,
      } = req.body;

      const result = db
        .prepare(
          `
        INSERT INTO inventory_locations (name, code, depot_number, type, zone, floor, capacity, address, gps_lat, gps_lon, parent_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          name,
          code,
          depot_number || 1,
          type || 'storage',
          zone,
          floor,
          capacity,
          address,
          gps_lat,
          gps_lon,
          parent_id,
        );

      const loc = db
        .prepare('SELECT * FROM inventory_locations WHERE id = ?')
        .get(result.lastInsertRowid);
      res.status(201).json(loc);
    } catch (err) {
      if (err.message.includes('UNIQUE'))
        return res.status(409).json({ success: false, error: 'Code emplacement déjà utilisé' });
      logger.error('POST /api/inventory/locations:', err.message);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // PUT /api/inventory/locations/:id — Modifier un emplacement
  app.put(
    '/api/inventory/locations/:id',
    authenticate,
    validate(locationUpdateSchema),
    (req, res) => {
      try {
        const {
          name,
          code,
          depot_number,
          type,
          zone,
          floor,
          capacity,
          address,
          gps_lat,
          gps_lon,
          parent_id,
          is_active,
        } = req.body;
        const existing = db
          .prepare('SELECT * FROM inventory_locations WHERE id = ?')
          .get(req.params.id);
        if (!existing)
          return res.status(404).json({ success: false, error: 'Emplacement non trouvé' });

        db.prepare(
          `
        UPDATE inventory_locations SET name=?, code=?, depot_number=?, type=?, zone=?, floor=?, capacity=?, 
        address=?, gps_lat=?, gps_lon=?, parent_id=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
      `,
        ).run(
          name || existing.name,
          code || existing.code,
          depot_number ?? existing.depot_number,
          type || existing.type,
          zone ?? existing.zone,
          floor ?? existing.floor,
          capacity ?? existing.capacity,
          address ?? existing.address,
          gps_lat ?? existing.gps_lat,
          gps_lon ?? existing.gps_lon,
          parent_id ?? existing.parent_id,
          is_active ?? existing.is_active,
          req.params.id,
        );

        res.json(db.prepare('SELECT * FROM inventory_locations WHERE id = ?').get(req.params.id));
      } catch (err) {
        logger.error('PUT /api/inventory/locations/:id:', err.message);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // DELETE /api/inventory/locations/:id
  app.delete('/api/inventory/locations/:id', authenticate, (req, res) => {
    try {
      const usage = db
        .prepare('SELECT COUNT(*) as c FROM stock_items WHERE depot_id = ?')
        .get(req.params.id);
      if (usage.c > 0)
        return res
          .status(409)
          .json({ success: false, error: `${usage.c} article(s) utilisent cet emplacement` });

      const result = db.prepare('DELETE FROM inventory_locations WHERE id = ?').run(req.params.id);
      if (!result.changes) return res.status(404).json({ success: false, error: 'Non trouvé' });
      res.json({ success: true });
    } catch (err) {
      logger.error('DELETE /api/inventory/locations/:id:', err.message);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ────────────────────────────────────────
  // HISTORIQUE PRIX
  // ────────────────────────────────────────

  // GET /api/inventory/prices/:itemId — Historique prix d'un article
  app.get('/api/inventory/prices/:itemId', authenticate, (req, res) => {
    try {
      const prices = db
        .prepare(
          `
        SELECT ph.*, s.name as supplier_name 
        FROM inventory_price_history ph
        LEFT JOIN suppliers s ON ph.supplier_id = s.id
        WHERE ph.stock_item_id = ?
        ORDER BY ph.created_at DESC
      `,
        )
        .all(req.params.itemId);
      res.json(prices);
    } catch (err) {
      logger.error('GET /api/inventory/prices:', err.message);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /api/inventory/prices — Ajouter un prix
  app.post('/api/inventory/prices', authenticate, validate(priceSchema), (req, res) => {
    try {
      const {
        stock_item_id,
        supplier_id,
        source,
        price_ht,
        currency,
        quantity_break,
        valid_from,
        valid_to,
        reference,
      } = req.body;

      const result = db
        .prepare(
          `
        INSERT INTO inventory_price_history (stock_item_id, supplier_id, source, price_ht, currency, quantity_break, valid_from, valid_to, reference)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          stock_item_id,
          supplier_id,
          source || 'manual',
          price_ht,
          currency || 'EUR',
          quantity_break || 1,
          valid_from,
          valid_to,
          reference,
        );

      res
        .status(201)
        .json(
          db
            .prepare('SELECT * FROM inventory_price_history WHERE id = ?')
            .get(result.lastInsertRowid),
        );
    } catch (err) {
      logger.error('POST /api/inventory/prices:', err.message);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ────────────────────────────────────────
  // MOTEUR DE PRIX INTELLIGENT
  // ────────────────────────────────────────

  // GET /api/inventory/price-engine/:itemId — Analyse prix complète
  app.get('/api/inventory/price-engine/:itemId', authenticate, (req, res) => {
    try {
      const item = db
        .prepare('SELECT id, name, reference, unit_price FROM stock_items WHERE id = ?')
        .get(req.params.itemId);
      if (!item) return res.status(404).json({ success: false, error: 'Article non trouvé' });

      const priceEntries = db
        .prepare(
          `
        SELECT * FROM inventory_price_history 
        WHERE stock_item_id = ?
        ORDER BY created_at DESC
      `,
        )
        .all(req.params.itemId);

      const analysis = analyzePrices(priceEntries);

      res.json({
        item: {
          id: item.id,
          name: item.name,
          reference: item.reference,
          current_price: item.unit_price,
        },
        analysis,
      });
    } catch (err) {
      logger.error('GET /api/inventory/price-engine:', err.message);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /api/inventory/price-engine/batch — Analyse prix en masse
  app.post(
    '/api/inventory/price-engine/batch',
    authenticate,
    validate(priceBatchSchema),
    (req, res) => {
      try {
        const { item_ids } = req.body;

        const sanitizedIds = item_ids.filter((id) => Number.isInteger(Number(id))).slice(0, 100);
        const placeholders = sanitizedIds.map(() => '?').join(',');

        const allPrices = db
          .prepare(
            `
        SELECT * FROM inventory_price_history 
        WHERE stock_item_id IN (${placeholders})
        ORDER BY stock_item_id, created_at DESC
      `,
          )
          .all(...sanitizedIds);

        // Grouper par item
        const grouped = {};
        for (const p of allPrices) {
          if (!grouped[p.stock_item_id]) grouped[p.stock_item_id] = [];
          grouped[p.stock_item_id].push(p);
        }

        const results = {};
        for (const id of sanitizedIds) {
          results[id] = analyzePrices(grouped[id] || []);
        }

        res.json(results);
      } catch (err) {
        logger.error('POST /api/inventory/price-engine/batch:', err.message);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // POST /api/inventory/price-engine/fusion — Fusion multi-sources
  app.post(
    '/api/inventory/price-engine/fusion',
    authenticate,
    validate(priceFusionSchema),
    (req, res) => {
      try {
        const { stock_item_id, prices } = req.body;

        const insert = db.prepare(`
        INSERT INTO inventory_price_history (stock_item_id, supplier_id, source, price_ht, reference)
        VALUES (?, ?, ?, ?, ?)
      `);

        const insertMany = db.transaction((entries) => {
          for (const e of entries) {
            insert.run(
              stock_item_id,
              e.supplier_id || null,
              e.source || 'import',
              e.price_ht,
              e.reference || null,
            );
          }
        });
        insertMany(prices);

        // Recalculer après insertion
        const allPrices = db
          .prepare(
            'SELECT * FROM inventory_price_history WHERE stock_item_id = ? ORDER BY created_at DESC',
          )
          .all(stock_item_id);
        const analysis = analyzePrices(allPrices);

        // Si confiance > 70, mettre à jour le prix de l'article
        if (analysis.confidence >= 70 && analysis.recommended_price > 0) {
          db.prepare(
            'UPDATE stock_items SET unit_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ).run(analysis.recommended_price, stock_item_id);
        }

        res.json({ inserted: prices.length, analysis });
      } catch (err) {
        logger.error('POST /api/inventory/price-engine/fusion:', err.message);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // ────────────────────────────────────────
  // ANOMALIES
  // ────────────────────────────────────────

  // GET /api/inventory/anomalies — Liste des anomalies
  app.get('/api/inventory/anomalies', authenticate, (req, res) => {
    try {
      const { status, severity, type } = req.query;
      let sql = `SELECT a.*, si.name as item_name, si.reference as item_reference
                 FROM inventory_anomalies a
                 LEFT JOIN stock_items si ON a.stock_item_id = si.id
                 WHERE 1=1`;
      const params = [];
      if (status) {
        sql += ' AND a.status = ?';
        params.push(status);
      }
      if (severity) {
        sql += ' AND a.severity = ?';
        params.push(severity);
      }
      if (type) {
        sql += ' AND a.type = ?';
        params.push(type);
      }
      sql += ' ORDER BY a.created_at DESC';

      res.json(db.prepare(sql).all(...params));
    } catch (err) {
      logger.error('GET /api/inventory/anomalies:', err.message);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // PUT /api/inventory/anomalies/:id — Résoudre/ignorer anomalie
  app.put(
    '/api/inventory/anomalies/:id',
    authenticate,
    validate(anomalyUpdateSchema),
    (req, res) => {
      try {
        const { status } = req.body;

        const updates =
          status === 'resolved'
            ? { resolved_by: req.user?.id, resolved_at: new Date().toISOString() }
            : {};

        db.prepare(
          `UPDATE inventory_anomalies SET status = ?, resolved_by = ?, resolved_at = ? WHERE id = ?`,
        ).run(status, updates.resolved_by || null, updates.resolved_at || null, req.params.id);

        res.json(db.prepare('SELECT * FROM inventory_anomalies WHERE id = ?').get(req.params.id));
      } catch (err) {
        logger.error('PUT /api/inventory/anomalies/:id:', err.message);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // POST /api/inventory/anomalies/detect — Lancer la détection automatique
  app.post('/api/inventory/anomalies/detect', authenticate, (req, res) => {
    try {
      const detected = [];
      const insertAnomaly = db.prepare(`
        INSERT INTO inventory_anomalies (stock_item_id, type, severity, description, expected_value, actual_value, deviation_pct)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      // 1. Détection anomalies de prix (IQR outliers)
      const items = db
        .prepare(
          `
        SELECT si.id, si.name, si.unit_price FROM stock_items si
        WHERE si.is_active = 1 AND si.unit_price > 0
      `,
        )
        .all();

      for (const item of items) {
        const prices = db
          .prepare('SELECT price_ht FROM inventory_price_history WHERE stock_item_id = ?')
          .all(item.id);
        if (prices.length < 3) continue;

        const values = prices.map((p) => p.price_ht);
        const iqr = computeIQR(values);
        if (!iqr) continue;

        if (item.unit_price < iqr.lowerFence || item.unit_price > iqr.upperFence) {
          const deviation =
            iqr.median > 0 ? ((item.unit_price - iqr.median) / iqr.median) * 100 : 0;
          // Éviter les doublons
          const existing = db
            .prepare(
              `
            SELECT id FROM inventory_anomalies 
            WHERE stock_item_id = ? AND type = 'price_outlier' AND status = 'open'
          `,
            )
            .get(item.id);

          if (!existing) {
            insertAnomaly.run(
              item.id,
              'price_outlier',
              Math.abs(deviation) > 100 ? 'critical' : Math.abs(deviation) > 50 ? 'high' : 'medium',
              `Prix actuel ${item.unit_price}€ hors IQR [${iqr.lowerFence.toFixed(2)}, ${iqr.upperFence.toFixed(2)}]`,
              iqr.median,
              item.unit_price,
              Math.round(deviation * 100) / 100,
            );
            detected.push({ type: 'price_outlier', item: item.name });
          }
        }
      }

      // 2. Détection écarts de stock (quantity < 0 ou incohérence)
      const negatives = db
        .prepare(
          `
        SELECT id, name, quantity FROM stock_items WHERE quantity < 0 AND is_active = 1
      `,
        )
        .all();

      for (const item of negatives) {
        const existing = db
          .prepare(
            `
          SELECT id FROM inventory_anomalies 
          WHERE stock_item_id = ? AND type = 'stock_drift' AND status = 'open'
        `,
          )
          .get(item.id);
        if (!existing) {
          insertAnomaly.run(
            item.id,
            'stock_drift',
            'high',
            `Stock négatif: ${item.quantity}`,
            0,
            item.quantity,
            null,
          );
          detected.push({ type: 'stock_drift', item: item.name });
        }
      }

      res.json({ detected_count: detected.length, anomalies: detected });
    } catch (err) {
      logger.error('POST /api/inventory/anomalies/detect:', err.message);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ────────────────────────────────────────
  // COMPTAGE INVENTAIRE
  // ────────────────────────────────────────

  // POST /api/inventory/count — Enregistrer un comptage
  app.post('/api/inventory/count', authenticate, validate(inventoryCountSchema), (req, res) => {
    try {
      const { items } = req.body;
      // items = [{ stock_item_id, counted_qty }, ...]

      const updateItem = db.prepare(`
        UPDATE stock_items SET last_counted_at = datetime('now'), last_counted_qty = ? WHERE id = ?
      `);
      const insertMovement = db.prepare(`
        INSERT INTO stock_movements (stock_item_id, type, quantity, previous_quantity, new_quantity, reason, user_id, user_name)
        VALUES (?, 'adjustment', ?, ?, ?, ?, ?, ?)
      `);
      const insertAnomaly = db.prepare(`
        INSERT INTO inventory_anomalies (stock_item_id, type, severity, description, expected_value, actual_value, deviation_pct)
        VALUES (?, 'stock_drift', ?, ?, ?, ?, ?)
      `);

      const doCount = db.transaction((entries) => {
        const results = [];
        for (const { stock_item_id, counted_qty } of entries) {
          const item = db
            .prepare('SELECT id, name, quantity FROM stock_items WHERE id = ?')
            .get(stock_item_id);
          if (!item) continue;

          const diff = counted_qty - item.quantity;
          updateItem.run(counted_qty, stock_item_id);

          if (diff !== 0) {
            // Ajuster le stock
            db.prepare(
              'UPDATE stock_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ).run(counted_qty, stock_item_id);

            insertMovement.run(
              stock_item_id,
              diff,
              item.quantity,
              counted_qty,
              `Comptage inventaire (écart: ${diff > 0 ? '+' : ''}${diff})`,
              req.user?.id,
              req.user?.name || 'Système',
            );

            // Si écart > 10%, créer une anomalie
            const pct = item.quantity > 0 ? Math.abs((diff / item.quantity) * 100) : 100;
            if (pct > 10) {
              insertAnomaly.run(
                stock_item_id,
                pct > 50 ? 'critical' : pct > 25 ? 'high' : 'medium',
                `Écart inventaire: attendu ${item.quantity}, compté ${counted_qty} (${diff > 0 ? '+' : ''}${diff})`,
                item.quantity,
                counted_qty,
                Math.round(pct * 100) / 100,
              );
            }

            results.push({
              id: stock_item_id,
              name: item.name,
              previous: item.quantity,
              counted: counted_qty,
              diff,
            });
          } else {
            results.push({
              id: stock_item_id,
              name: item.name,
              previous: item.quantity,
              counted: counted_qty,
              diff: 0,
            });
          }
        }
        return results;
      });

      const results = doCount(items);
      res.json({
        counted: results.length,
        adjustments: results.filter((r) => r.diff !== 0).length,
        details: results,
      });
    } catch (err) {
      logger.error('POST /api/inventory/count:', err.message);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ────────────────────────────────────────
  // ALERTES STOCK BAS
  // ────────────────────────────────────────

  // GET /api/inventory/alerts — Articles sous seuil
  app.get('/api/inventory/alerts', authenticate, (req, res) => {
    try {
      const alerts = db
        .prepare(
          `
        SELECT si.*, 
               COALESCE(sc.name, pc.name) as category_name,
               COALESCE(sc.color, pc.color) as category_color,
               COALESCE(sc.icon, pc.icon) as category_icon,
               il.name as location_name, il.code as location_code,
               s.name as supplier_name
        FROM stock_items si
        LEFT JOIN stock_categories sc ON si.category_id = sc.id
        LEFT JOIN stock_categories pc ON sc.parent_id = pc.id
        LEFT JOIN inventory_locations il ON si.depot_id = il.id
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        WHERE si.is_active = 1 
          AND si.min_quantity > 0 
          AND si.quantity <= si.min_quantity
        ORDER BY (si.quantity / NULLIF(si.min_quantity, 0)) ASC
      `,
        )
        .all();

      res.json(alerts);
    } catch (err) {
      logger.error('GET /api/inventory/alerts:', err.message);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ────────────────────────────────────────
  // STATISTIQUES AVANCÉES
  // ────────────────────────────────────────

  // GET /api/inventory/stats — Stats globales inventaire
  app.get('/api/inventory/stats', authenticate, (req, res) => {
    try {
      // Vérifier le cache (5 min)
      const cached = db
        .prepare(
          `
        SELECT data FROM inventory_stats_cache 
        WHERE cache_key = 'global_stats' AND expires_at > datetime('now')
      `,
        )
        .get();
      if (cached) return res.json(JSON.parse(cached.data));

      const totalItems = db
        .prepare('SELECT COUNT(*) as c FROM stock_items WHERE is_active = 1')
        .get().c;
      const totalValue = db
        .prepare(
          'SELECT COALESCE(SUM(unit_price * quantity), 0) as v FROM stock_items WHERE is_active = 1',
        )
        .get().v;
      const lowStock = db
        .prepare(
          'SELECT COUNT(*) as c FROM stock_items WHERE is_active = 1 AND min_quantity > 0 AND quantity <= min_quantity',
        )
        .get().c;
      const zeroStock = db
        .prepare('SELECT COUNT(*) as c FROM stock_items WHERE is_active = 1 AND quantity = 0')
        .get().c;
      const categories = db.prepare('SELECT COUNT(*) as c FROM stock_categories').get().c;
      const locations = db
        .prepare('SELECT COUNT(*) as c FROM inventory_locations WHERE is_active = 1')
        .get().c;
      const openAnomalies = db
        .prepare("SELECT COUNT(*) as c FROM inventory_anomalies WHERE status = 'open'")
        .get().c;
      const priceEntries = db.prepare('SELECT COUNT(*) as c FROM inventory_price_history').get().c;

      // Mouvements derniers 30 jours
      const movements30d = db
        .prepare(
          `
        SELECT type, COUNT(*) as c, COALESCE(SUM(ABS(quantity)), 0) as qty
        FROM stock_movements 
        WHERE created_at >= datetime('now', '-30 days')
        GROUP BY type
      `,
        )
        .all();

      // Top 10 articles par valeur
      const topByValue = db
        .prepare(
          `
        SELECT id, name, reference, unit_price, quantity, (unit_price * quantity) as total_value
        FROM stock_items WHERE is_active = 1
        ORDER BY total_value DESC LIMIT 10
      `,
        )
        .all();

      // Répartition ABC
      const abcDistribution = db
        .prepare(
          `
        SELECT abc_class, COUNT(*) as count, COALESCE(SUM(unit_price * quantity), 0) as value
        FROM stock_items WHERE is_active = 1
        GROUP BY abc_class
      `,
        )
        .all();

      // Répartition par dépôt
      const byDepot = db
        .prepare(
          `
        SELECT il.depot_number, il.name as depot_name, COUNT(si.id) as items, COALESCE(SUM(si.quantity), 0) as total_qty
        FROM stock_items si
        LEFT JOIN inventory_locations il ON si.depot_id = il.id
        WHERE si.is_active = 1
        GROUP BY il.depot_number
      `,
        )
        .all();

      const stats = {
        summary: {
          totalItems,
          totalValue: Math.round(totalValue * 100) / 100,
          lowStock,
          zeroStock,
          categories,
          locations,
          openAnomalies,
          priceEntries,
        },
        movements30d,
        topByValue,
        abcDistribution,
        byDepot,
        computed_at: new Date().toISOString(),
      };

      // Cacher 5 minutes
      db.prepare(
        `
        INSERT OR REPLACE INTO inventory_stats_cache (cache_key, data, computed_at, expires_at)
        VALUES ('global_stats', ?, datetime('now'), datetime('now', '+5 minutes'))
      `,
      ).run(JSON.stringify(stats));

      res.json(stats);
    } catch (err) {
      logger.error('GET /api/inventory/stats:', err.message);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /api/inventory/stats/refresh — Forcer le recalcul
  app.post('/api/inventory/stats/refresh', authenticate, (req, res) => {
    try {
      db.prepare("DELETE FROM inventory_stats_cache WHERE cache_key = 'global_stats'").run();
      res.json({ success: true, message: 'Cache invalidé' });
    } catch (_err) {
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ────────────────────────────────────────
  // CLASSIFICATION ABC
  // ────────────────────────────────────────

  // POST /api/inventory/abc-classify — Recalculer classification ABC
  app.post('/api/inventory/abc-classify', authenticate, (req, res) => {
    try {
      const items = db
        .prepare(
          `
        SELECT id, unit_price, quantity, (unit_price * quantity) as value
        FROM stock_items WHERE is_active = 1
        ORDER BY value DESC
      `,
        )
        .all();

      const totalValue = items.reduce((s, i) => s + i.value, 0);
      if (totalValue === 0) return res.json({ classified: 0 });

      let cumulative = 0;
      const update = db.prepare('UPDATE stock_items SET abc_class = ? WHERE id = ?');

      const classify = db.transaction(() => {
        let a = 0,
          b = 0,
          c = 0;
        for (const item of items) {
          cumulative += item.value;
          const pct = cumulative / totalValue;
          const cls = pct <= 0.8 ? 'A' : pct <= 0.95 ? 'B' : 'C';
          update.run(cls, item.id);
          if (cls === 'A') a++;
          else if (cls === 'B') b++;
          else c++;
        }
        return { a, b, c, total: items.length };
      });

      const result = classify();
      // Invalider le cache
      db.prepare("DELETE FROM inventory_stats_cache WHERE cache_key = 'global_stats'").run();

      res.json({
        classified: result.total,
        distribution: { A: result.a, B: result.b, C: result.c },
      });
    } catch (err) {
      logger.error('POST /api/inventory/abc-classify:', err.message);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ────────────────────────────────────────
  // EXPORTS
  // ────────────────────────────────────────

  // GET /api/inventory/export/csv — Export CSV inventaire complet
  app.get('/api/inventory/export/csv', authenticate, (req, res) => {
    try {
      const items = db
        .prepare(
          `
        SELECT si.*, 
               COALESCE(sc.name, pc.name) as category_name,
               il.name as location_name, il.code as location_code,
               s.name as supplier_name
        FROM stock_items si
        LEFT JOIN stock_categories sc ON si.category_id = sc.id
        LEFT JOIN stock_categories pc ON sc.parent_id = pc.id
        LEFT JOIN inventory_locations il ON si.depot_id = il.id
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        WHERE si.is_active = 1
        ORDER BY si.name
      `,
        )
        .all();

      const headers = [
        'Référence',
        'Nom',
        'Catégorie',
        'Emplacement',
        'Fournisseur',
        'Quantité',
        'Unité',
        'Prix HT',
        'Prix Vente',
        'Valeur Stock',
        'Seuil Min',
        'Classe ABC',
        'Marque',
        'Modèle',
        'Code-barres',
      ];
      const rows = items.map((i) => [
        i.reference || '',
        i.name || '',
        i.category_name || '',
        i.location_name || '',
        i.supplier_name || '',
        i.quantity ?? 0,
        i.unit || 'u',
        i.unit_price ?? 0,
        i.sell_price ?? 0,
        Math.round((i.unit_price || 0) * (i.quantity || 0) * 100) / 100,
        i.min_quantity ?? 0,
        i.abc_class || 'C',
        i.brand || '',
        i.model || '',
        i.barcode || '',
      ]);

      const escapeCSV = (v) => {
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      };
      const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCSV).join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="inventaire_${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send('\uFEFF' + csv); // BOM pour Excel
    } catch (err) {
      logger.error('GET /api/inventory/export/csv:', err.message);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // GET /api/inventory/export/json — Export JSON
  app.get('/api/inventory/export/json', authenticate, (req, res) => {
    try {
      const items = db
        .prepare(
          `
        SELECT si.*, 
               COALESCE(sc.name, pc.name) as category_name,
               il.name as location_name,
               s.name as supplier_name
        FROM stock_items si
        LEFT JOIN stock_categories sc ON si.category_id = sc.id
        LEFT JOIN stock_categories pc ON sc.parent_id = pc.id
        LEFT JOIN inventory_locations il ON si.depot_id = il.id
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        WHERE si.is_active = 1
        ORDER BY si.name
      `,
        )
        .all();

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="inventaire_${new Date().toISOString().slice(0, 10)}.json"`,
      );
      res.json({ exported_at: new Date().toISOString(), count: items.length, items });
    } catch (err) {
      logger.error('GET /api/inventory/export/json:', err.message);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  logger.info('  📦 Routes Inventaire enregistrées');
}
