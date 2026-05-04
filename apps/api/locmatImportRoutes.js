// ═══════════════════════════════════════════════════════════════
// locmatImportRoutes.js
// Import intelligent Locmat (Locations.csv + Serialise.csv)
// → cible la table `equipment` + `equipment_serials`
//
// Flux :
//   1. POST /api/import/locmat/preview  → calcule le diff (read-only)
//   2. POST /api/import/locmat/confirm  → applique sous transaction
//                                          (création UID+QR pour newProducts,
//                                           upsert serials, log)
//   3. GET  /api/import/locmat/logs     → historique des imports
//
// Contraintes (cf. brief utilisateur §8) :
//   • Aucune écriture sans validation
//   • Suppression des numéros de série = soft (status='removed')
//   • Pas de génération d'UID pour une référence existante
// ═══════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto';

import QRCode from 'qrcode';

import db, { addToHistory } from './database.js';
import logger from './logger.js';
import { locmatConfirmSchema, locmatPreviewSchema, validate } from './schemas/imports.js';
import { diffWithDatabase } from './services/locmatImport.js';

// ─── Helpers DB ───
// On retourne les colonnes equipment renommées avec les clés génériques
// attendues par diffWithDatabase (unit_price/quantity/description/...).
function buildDbItemsByCode() {
  const rows = db
    .prepare(
      `SELECT id, reference, name,
              notes          AS description,
              purchase_price AS unit_price,
              NULL           AS sell_price,
              stock_quantity AS quantity,
              NULL           AS barcode,
              location, uid, qrcode, is_serialized
       FROM equipment
       WHERE reference IS NOT NULL AND reference != ''`,
    )
    .all();
  const map = new Map();
  for (const r of rows) map.set(String(r.reference || '').toUpperCase(), r);
  return map;
}

function buildDbSerialsByEquipmentId() {
  const rows = db
    .prepare("SELECT equipment_id, serial FROM equipment_serials WHERE status = 'active'")
    .all();
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.equipment_id)) map.set(r.equipment_id, new Set());
    map.get(r.equipment_id).add(r.serial);
  }
  return map;
}

// Index inverse : serial actif → equipment_id propriétaire (collision DB cross-équipement)
function buildDbSerialOwnerBySerial() {
  const rows = db
    .prepare("SELECT equipment_id, serial FROM equipment_serials WHERE status = 'active'")
    .all();
  const map = new Map();
  for (const r of rows) map.set(r.serial, r.equipment_id);
  return map;
}

export function setupLocmatImportRoutes(app, authenticateToken, requireAdmin) {
  // ─── 1. PREVIEW (read-only, calcule le diff) ───
  app.post(
    '/api/import/locmat/preview',
    authenticateToken,
    requireAdmin,
    validate(locmatPreviewSchema),
    (req, res) => {
      try {
        const { locations, serials } = req.body;

        const dbItemsByCode = buildDbItemsByCode();
        const dbSerialsByItemId = buildDbSerialsByEquipmentId();
        const dbSerialOwnerBySerial = buildDbSerialOwnerBySerial();

        const diff = diffWithDatabase({
          locations,
          serials,
          dbItemsByCode,
          dbSerialsByItemId,
          dbSerialOwnerBySerial,
        });

        res.json({
          success: true,
          counts: {
            newProducts: diff.newProducts.length,
            updatedProducts: diff.updatedProducts.length,
            quantityChanges: diff.quantityChanges.length,
            serializationChanges: diff.serializationChanges?.length || 0,
            newSerials: diff.newSerials.length,
            removedSerials: diff.removedSerials.length,
            missingProducts: diff.missingProducts?.length || 0,
            duplicates:
              (diff.duplicates?.locations?.length || 0) + (diff.duplicates?.serials?.length || 0),
            collisions: diff.collisions?.length || 0,
            errors: diff.errors.length,
          },
          ...diff,
        });
      } catch (error) {
        logger.error('Erreur preview Locmat:', error);
        res.status(500).json({ success: false, error: 'Erreur lors de la prévisualisation' });
      }
    },
  );

  // ─── 2. CONFIRM (applique transactionnellement) ───
  app.post(
    '/api/import/locmat/confirm',
    authenticateToken,
    requireAdmin,
    validate(locmatConfirmSchema),
    async (req, res) => {
      try {
        const {
          source = 'Locmat (Locations.csv + Serialise.csv)',
          newProducts,
          updatedProducts,
          quantityChanges,
          serializationChanges = [],
          newSerials,
          removedSerials,
          missingProducts = [],
          duplicates = { locations: [], serials: [] },
          collisions = [],
        } = req.body;

        // 1) Pré-générer UID + QR Code pour les newProducts (await hors transaction)
        const productsWithIds = [];
        for (const p of newProducts) {
          const uid = randomUUID();
          let qrcode = null;
          try {
            qrcode = await QRCode.toDataURL(uid, { errorCorrectionLevel: 'M', margin: 1 });
          } catch (e) {
            logger.warn(`QR generation failed for ${p.code}: ${e.message}`);
          }
          productsWithIds.push({ ...p, uid, qrcode });
        }

        const insertEquip = db.prepare(`
          INSERT INTO equipment
            (name, reference, notes, purchase_price, stock_quantity,
             location, status, uid, qrcode, is_serialized, created_by)
          VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?)
        `);
        const updateEquip = db.prepare(`
          UPDATE equipment SET
            name           = COALESCE(?, name),
            notes          = COALESCE(?, notes),
            purchase_price = COALESCE(?, purchase_price),
            location       = COALESCE(?, location),
            updated_at     = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        const updateQty = db.prepare(`
          UPDATE equipment SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `);
        const updateSerializedFlag = db.prepare(`
          UPDATE equipment SET is_serialized = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `);
        const insertSerial = db.prepare(`
          INSERT INTO equipment_serials (equipment_id, serial, status, source)
          VALUES (?, ?, 'active', 'locmat')
        `);
        const findSerial = db.prepare(
          'SELECT id, status FROM equipment_serials WHERE equipment_id = ? AND serial = ?',
        );
        const findSerialGlobal = db.prepare(
          "SELECT id, equipment_id FROM equipment_serials WHERE serial = ? AND status = 'active' LIMIT 1",
        );
        const reactivateSerial = db.prepare(
          "UPDATE equipment_serials SET status = 'active', removed_at = NULL WHERE id = ?",
        );
        const removeSerial = db.prepare(
          "UPDATE equipment_serials SET status = 'removed', removed_at = CURRENT_TIMESTAMP WHERE equipment_id = ? AND serial = ? AND status = 'active'",
        );
        const findEquipByCode = db.prepare(
          'SELECT id FROM equipment WHERE UPPER(reference) = UPPER(?) LIMIT 1',
        );

        const result = {
          createdProducts: 0,
          updatedProducts: 0,
          quantityAdjusted: 0,
          serializationActivated: 0,
          serialsAdded: 0,
          serialsRemoved: 0,
          serialsReactivated: 0,
          serialsSkippedCollision: 0,
          errors: [],
        };

        const newProductIdByCode = new Map(); // code → new id

        const apply = db.transaction(() => {
          // ── A. nouveaux produits ──
          for (const p of productsWithIds) {
            try {
              const insRes = insertEquip.run(
                p.name || p.code,
                p.code,
                p.description || (p.fromSerialiseOnly ? 'Créé depuis Serialise.csv' : null),
                p.price || 0,
                p.quantity || 0,
                p.location || null,
                p.uid,
                p.qrcode,
                p.isSerialized ? 1 : 0,
                req.user.id,
              );
              const newId = insRes.lastInsertRowid;
              newProductIdByCode.set(p.code.toUpperCase(), newId);
              result.createdProducts++;
            } catch (e) {
              result.errors.push(`Création ${p.code}: ${e.message}`);
            }
          }

          // ── B. produits modifiés (champs hors quantité) ──
          for (const u of updatedProducts) {
            try {
              const d = u.diffs || {};
              updateEquip.run(
                d.name?.to ?? null,
                d.description?.to ?? null,
                d.unit_price?.to ?? null,
                d.location?.to ?? null,
                u.id,
              );
              result.updatedProducts++;
            } catch (e) {
              result.errors.push(`MAJ ${u.code}: ${e.message}`);
            }
          }

          // ── C. quantités ──
          for (const q of quantityChanges) {
            try {
              updateQty.run(q.to, q.id);
              result.quantityAdjusted++;
            } catch (e) {
              result.errors.push(`Quantité ${q.code}: ${e.message}`);
            }
          }

          // ── C-bis. activation `is_serialized` (sérialisation externe via Locmat) ──
          // Cas : équipement existant dans eMag avec is_serialized=0 mais des numéros
          // de série fournis dans Serialise.csv → on bascule le flag à 1.
          // (La quantité a déjà été alignée sur le nombre de serials actifs en C.)
          for (const sc of serializationChanges) {
            try {
              const info = updateSerializedFlag.run(sc.id);
              if (info.changes > 0) result.serializationActivated++;
            } catch (e) {
              result.errors.push(`Sérialisation ${sc.code}: ${e.message}`);
            }
          }

          // ── D. nouveaux serials ──
          for (const s of newSerials) {
            try {
              let equipmentId = s.equipmentId;
              if (!equipmentId) {
                equipmentId = newProductIdByCode.get(String(s.code).toUpperCase());
                if (!equipmentId) {
                  const found = findEquipByCode.get(s.code);
                  equipmentId = found?.id;
                }
              }
              if (!equipmentId) {
                result.errors.push(`Serial ${s.serial}: équipement ${s.code} introuvable`);
                continue;
              }
              const existing = findSerial.get(equipmentId, s.serial);
              if (existing) {
                if (existing.status !== 'active') {
                  reactivateSerial.run(existing.id);
                  result.serialsReactivated++;
                }
              } else {
                // Vérifier qu'aucun autre équipement n'a déjà ce serial actif
                // (l'index UNIQUE partiel sur serial WHERE status='active' ferait sinon crasher l'INSERT)
                const conflict = findSerialGlobal.get(s.serial);
                if (conflict && conflict.equipment_id !== equipmentId) {
                  result.serialsSkippedCollision++;
                  result.errors.push(
                    `Serial ${s.serial} (code ${s.code}): déjà actif sur équipement #${conflict.equipment_id} — ignoré`,
                  );
                  continue;
                }
                insertSerial.run(equipmentId, s.serial);
                result.serialsAdded++;
              }
            } catch (e) {
              result.errors.push(`Ajout serial ${s.serial}: ${e.message}`);
            }
          }

          // ── E. serials supprimés (soft) ──
          for (const s of removedSerials) {
            try {
              const info = removeSerial.run(s.equipmentId, s.serial);
              if (info.changes > 0) result.serialsRemoved++;
            } catch (e) {
              result.errors.push(`Suppression serial ${s.serial}: ${e.message}`);
            }
          }

          // ── F. journal ──
          db.prepare(
            `INSERT INTO import_logs (type, source, summary, details, user_id, user_name)
             VALUES ('locmat', ?, ?, ?, ?, ?)`,
          ).run(
            source,
            JSON.stringify({
              createdProducts: result.createdProducts,
              updatedProducts: result.updatedProducts,
              quantityAdjusted: result.quantityAdjusted,
              serializationActivated: result.serializationActivated,
              serialsAdded: result.serialsAdded,
              serialsRemoved: result.serialsRemoved,
              serialsReactivated: result.serialsReactivated,
              missingProductsCount: missingProducts.length,
              duplicatesCount:
                (duplicates?.locations?.length || 0) + (duplicates?.serials?.length || 0),
              collisionsCount: collisions.length,
              errorsCount: result.errors.length,
            }),
            JSON.stringify({
              newProducts: productsWithIds.map((p) => ({ code: p.code, uid: p.uid })),
              updatedProducts: updatedProducts.map((u) => ({ id: u.id, code: u.code })),
              quantityChanges,
              serializationChanges,
              newSerials: newSerials.map((s) => ({ code: s.code, serial: s.serial })),
              removedSerials,
              missingProducts,
              duplicates,
              collisions,
              errors: result.errors,
            }),
            req.user.id,
            req.user.name,
          );
        });

        apply();

        addToHistory('locmat_import', null, 'import', result, req.user.id, req.user.name);
        logger.info(
          `Import Locmat (equipment): +${result.createdProducts} créés, ${result.updatedProducts} MAJ, ${result.quantityAdjusted} qtés, ${result.serializationActivated} sérialisations activées, +${result.serialsAdded} serials, -${result.serialsRemoved} serials`,
        );

        res.json({ success: true, ...result });
      } catch (error) {
        logger.error('Erreur confirm Locmat:', error);
        res.status(500).json({ success: false, error: "Erreur lors de l'import Locmat" });
      }
    },
  );

  // ─── 3. LOGS (historique des imports) ───
  app.get('/api/import/locmat/logs', authenticateToken, (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const rows = db
        .prepare(
          `SELECT id, type, source, summary, user_id, user_name, created_at
           FROM import_logs
           WHERE type = 'locmat'
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(limit);
      const logs = rows.map((r) => ({
        ...r,
        summary: r.summary ? JSON.parse(r.summary) : null,
      }));
      res.json({ success: true, logs });
    } catch (error) {
      logger.error('Erreur logs Locmat:', error);
      res.status(500).json({ success: false, error: 'Erreur lors du chargement des logs' });
    }
  });

  // ─── 4. LOG DETAIL ───
  app.get('/api/import/locmat/logs/:id', authenticateToken, (req, res) => {
    try {
      const id = Number(req.params.id);
      const row = db
        .prepare('SELECT * FROM import_logs WHERE id = ? AND type = ?')
        .get(id, 'locmat');
      if (!row) return res.status(404).json({ success: false, error: 'Import introuvable' });
      res.json({
        success: true,
        log: {
          ...row,
          summary: row.summary ? JSON.parse(row.summary) : null,
          details: row.details ? JSON.parse(row.details) : null,
        },
      });
    } catch (error) {
      logger.error('Erreur log detail Locmat:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });
}
