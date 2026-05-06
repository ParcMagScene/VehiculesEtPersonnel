// ═══════════════════════════════════════════════════════════════
// locmatImportRoutes.js
// Import intelligent Locmat (Locations.csv + Serialise.csv) — Modèle A pur :
// 1 ligne `equipment` = 1 unité physique (ref + serial_number + uid uniques).
// La table `equipment_serials` n'est plus utilisée.
//
// Flux :
//   1. POST /api/import/locmat/preview  → calcule le diff (read-only)
//   2. POST /api/import/locmat/confirm  → applique sous transaction
//                                          (création UID+QR pour newProducts
//                                           et chaque newSerial = 1 equipment)
//   3. GET  /api/import/locmat/logs     → historique des imports
//
// Contraintes :
//   • Aucune écriture sans validation
//   • Suppression = soft (status='removed')
// ═══════════════════════════════════════════════════════════════

import db, { addToHistory } from './database.js';
import logger from './logger.js';
import { locmatConfirmSchema, locmatPreviewSchema, validate } from './schemas/imports.js';
import { diffWithDatabase } from './services/locmatImport.js';
import { buildEquipmentQrPayload, generateQrDataUrl } from './services/qrcodeGenerator.js';
import { getNextUid } from './services/uidCounter.js';

// ─── Helpers DB (Modèle A) ───
// Représentant equipment par reference (UPPER) — choisit en priorité une ligne
// "catalogue" (sans serial_number), sinon la 1ère unité trouvée. Les lignes
// `[archive]` issues de la migration sont ignorées.
function buildDbCatalogByCode() {
  const rows = db
    .prepare(
      `SELECT id, reference, name,
              notes          AS description,
              purchase_price AS unit_price,
              stock_quantity AS quantity,
              location, serial_number
       FROM equipment
       WHERE reference IS NOT NULL AND reference != ''
         AND (name IS NULL OR name NOT LIKE '%[archive]%')`,
    )
    .all();
  const map = new Map();
  for (const r of rows) {
    const key = String(r.reference || '').toUpperCase();
    const prev = map.get(key);
    // priorité au "catalogue" (serial_number vide)
    if (!prev || (!r.serial_number && prev.serial_number)) {
      map.set(key, r);
    }
  }
  return map;
}

// Index serials existants par code de référence
function buildDbSerialsByCode() {
  const rows = db
    .prepare(
      `SELECT reference, serial_number FROM equipment
       WHERE serial_number IS NOT NULL AND serial_number != ''
         AND reference IS NOT NULL AND reference != ''
         AND (status IS NULL OR status != 'removed')`,
    )
    .all();
  const map = new Map();
  for (const r of rows) {
    const key = String(r.reference || '').toUpperCase();
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(r.serial_number);
  }
  return map;
}

// Index inverse : serial → refUpper propriétaire (collision cross-ref)
function buildDbOwnerCodeBySerial() {
  const rows = db
    .prepare(
      `SELECT reference, serial_number FROM equipment
       WHERE serial_number IS NOT NULL AND serial_number != ''
         AND reference IS NOT NULL AND reference != ''
         AND (status IS NULL OR status != 'removed')`,
    )
    .all();
  const map = new Map();
  for (const r of rows) map.set(r.serial_number, String(r.reference).toUpperCase());
  return map;
}

// Index serial → { magNumber, equipmentId } (pour détecter MAJ N° MAG)
function buildDbMagBySerial() {
  const rows = db
    .prepare(
      `SELECT id, serial_number, numero_mag FROM equipment
       WHERE serial_number IS NOT NULL AND serial_number != ''
         AND (status IS NULL OR status != 'removed')`,
    )
    .all();
  const map = new Map();
  for (const r of rows) {
    map.set(r.serial_number, {
      magNumber: r.numero_mag || null,
      equipmentId: r.id,
    });
  }
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

        const dbCatalogByCode = buildDbCatalogByCode();
        const dbSerialsByCode = buildDbSerialsByCode();
        const dbOwnerCodeBySerial = buildDbOwnerCodeBySerial();
        const dbMagBySerial = buildDbMagBySerial();

        const diff = diffWithDatabase({
          locations,
          serials,
          dbCatalogByCode,
          dbSerialsByCode,
          dbOwnerCodeBySerial,
          dbMagBySerial,
        });

        res.json({
          success: true,
          counts: {
            newProducts: diff.newProducts.length,
            updatedProducts: diff.updatedProducts.length,
            quantityChanges: diff.quantityChanges.length,
            newSerials: diff.newSerials.length,
            serialUpdates: diff.serialUpdates?.length || 0,
            removedSerials: diff.removedSerials.length,
            legacyCatalogToDelete: diff.legacyCatalogToDelete?.length || 0,
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
          newSerials,
          serialUpdates = [],
          removedSerials,
          legacyCatalogToDelete = [],
          missingProducts = [],
          duplicates = { locations: [], serials: [] },
          collisions = [],
        } = req.body;

        // INSERT pour un "catalogue" (1 ligne sans serial — produit non sérialisé
        // ou tête de gondole d'une famille sérialisée).
        const insertCatalog = db.prepare(`
          INSERT INTO equipment
            (name, reference, notes, purchase_price, stock_quantity,
             location, status, uid, qrcode, is_serialized, serial_number, created_by)
          VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?, 0, NULL, ?)
        `);
        // INSERT pour une unité sérialisée (1 ligne = 1 SN, stock=1).
        const insertUnit = db.prepare(`
          INSERT INTO equipment
            (name, reference, notes, purchase_price, stock_quantity,
             location, status, uid, qrcode, is_serialized, serial_number, numero_mag, created_by)
          VALUES (?, ?, ?, ?, 1, ?, 'available', ?, ?, 0, ?, ?, ?)
        `);
        // MAJ N° MAG (et force qty=1 pour nettoyer toute ligne legacy qty>1)
        const updateMagAndForceQty1 = db.prepare(`
          UPDATE equipment SET
            numero_mag     = ?,
            stock_quantity = 1,
            is_serialized  = 0,
            updated_at     = CURRENT_TIMESTAMP
          WHERE UPPER(reference) = UPPER(?) AND serial_number = ?
            AND (status IS NULL OR status != 'removed')
        `);
        // Suppression définitive d'une ligne catalogue legacy (modèle A pur).
        // FK pointant vers equipment.id :
        //   - equipment_lists      (NOT NULL, CASCADE)         → géré par SQLite
        //   - bp_items             (nullable, SET NULL)        → géré par SQLite
        //   - equipment_serials    (NOT NULL, CASCADE)         → géré par SQLite
        //   - sav_tickets          (nullable, NO ACTION)       → SET NULL manuel
        //   - equipment_assignments(NOT NULL, NO ACTION)       → DELETE manuel
        const detachSavTicketsLegacy = db.prepare(
          'UPDATE sav_tickets SET equipment_id = NULL WHERE equipment_id = ?',
        );
        const deleteAssignmentsLegacy = db.prepare(
          'DELETE FROM equipment_assignments WHERE equipment_id = ?',
        );
        const deleteLegacyCatalog = db.prepare('DELETE FROM equipment WHERE id = ?');
        const updateEquipUid = db.prepare('UPDATE equipment SET uid = ? WHERE id = ?');
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
        // Recherche d'un "catalogue parent" pour cloner les champs lors d'une
        // création d'unité (priorité au catalogue sans serial, sinon n'importe
        // quelle unité de la même reference).
        const findParentByCode = db.prepare(
          `SELECT id, name, reference, notes, purchase_price, location
           FROM equipment
           WHERE UPPER(reference) = UPPER(?)
             AND (name IS NULL OR name NOT LIKE '%[archive]%')
           ORDER BY (CASE WHEN serial_number IS NULL OR serial_number = '' THEN 0 ELSE 1 END), id
           LIMIT 1`,
        );
        // Soft-delete d'une unité par (ref, serial)
        const softRemoveUnit = db.prepare(
          `UPDATE equipment SET status = 'removed', updated_at = CURRENT_TIMESTAMP
           WHERE UPPER(reference) = UPPER(?) AND serial_number = ?
             AND (status IS NULL OR status != 'removed')`,
        );
        // Vérifier qu'une (ref, serial) n'existe pas déjà avant INSERT unité
        const findUnitByRefSerial = db.prepare(
          `SELECT id, status FROM equipment
           WHERE UPPER(reference) = UPPER(?) AND serial_number = ? LIMIT 1`,
        );
        const reactivateUnit = db.prepare(
          `UPDATE equipment SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        );

        const result = {
          createdProducts: 0,
          updatedProducts: 0,
          quantityAdjusted: 0,
          serialsAdded: 0,
          serialsRemoved: 0,
          serialsReactivated: 0,
          serialsMagUpdated: 0,
          legacyCatalogDeleted: 0,
          serialsSkippedCollision: 0,
          errors: [],
        };

        // Map code → données catalogue (utile pour cloner lors des newSerials)
        const newCatalogByCode = new Map();
        const newEquipmentIds = []; // pour QR async post-transaction

        const apply = db.transaction(() => {
          // ── A. nouveaux produits ──
          // Un newProduct sérialisé ne crée PAS de ligne catalogue ; les unités
          // seront créées dans la phase D (newSerials). On mémorise juste les
          // métadonnées pour le clone.
          for (const p of newProducts) {
            try {
              if (p.isSerialized) {
                newCatalogByCode.set(String(p.code).toUpperCase(), p);
                continue;
              }
              const insRes = insertCatalog.run(
                p.name || p.code,
                p.code,
                p.description || (p.fromSerialiseOnly ? 'Créé depuis Serialise.csv' : null),
                p.price || 0,
                p.quantity || 0,
                p.location || null,
                null, // uid attribué juste après
                null, // qrcode généré après transaction
                req.user.id,
              );
              const newId = insRes.lastInsertRowid;
              const uid = getNextUid(db);
              updateEquipUid.run(uid, newId);
              newEquipmentIds.push({ id: newId, uid });
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

          // ── C. quantités (uniquement pour produits non sérialisés) ──
          for (const q of quantityChanges) {
            try {
              updateQty.run(q.to, q.id);
              result.quantityAdjusted++;
            } catch (e) {
              result.errors.push(`Quantité ${q.code}: ${e.message}`);
            }
          }

          // ── D. nouveaux serials → 1 ligne equipment / SN ──
          for (const s of newSerials) {
            try {
              // Vérifier idempotence : (ref, serial) déjà présent ?
              const existingUnit = findUnitByRefSerial.get(s.code, s.serial);
              if (existingUnit) {
                if (existingUnit.status === 'removed') {
                  reactivateUnit.run(existingUnit.id);
                  result.serialsReactivated++;
                }
                continue;
              }
              // Récupérer le catalogue parent (DB existant ou newCatalogByCode)
              let parent = findParentByCode.get(s.code);
              if (!parent) {
                const newCat = newCatalogByCode.get(String(s.code).toUpperCase());
                if (newCat) {
                  parent = {
                    id: null,
                    name: newCat.name || newCat.code,
                    reference: newCat.code,
                    notes: newCat.description || 'Créé depuis Serialise.csv',
                    purchase_price: newCat.price || 0,
                    location: newCat.location || null,
                  };
                }
              }
              if (!parent) {
                result.errors.push(`Serial ${s.serial}: référence ${s.code} introuvable`);
                continue;
              }
              const insRes = insertUnit.run(
                parent.name || s.code,
                parent.reference || s.code,
                parent.notes || null,
                parent.purchase_price || 0,
                parent.location || null,
                null, // uid alloué juste après
                null, // qrcode async
                s.serial,
                s.magNumber || null,
                req.user.id,
              );
              const newId = insRes.lastInsertRowid;
              const uid = getNextUid(db);
              updateEquipUid.run(uid, newId);
              newEquipmentIds.push({ id: newId, uid });
              result.serialsAdded++;
            } catch (e) {
              if (/UNIQUE/i.test(e.message || '')) {
                result.serialsSkippedCollision++;
                result.errors.push(`Serial ${s.serial} (${s.code}): collision unicité — ignoré`);
              } else {
                result.errors.push(`Ajout serial ${s.serial}: ${e.message}`);
              }
            }
          }

          // ── E. serials supprimés (soft) ──
          for (const s of removedSerials) {
            try {
              const info = softRemoveUnit.run(s.code, s.serial);
              if (info.changes > 0) result.serialsRemoved++;
            } catch (e) {
              result.errors.push(`Suppression serial ${s.serial}: ${e.message}`);
            }
          }

          // ── E2. mises à jour N° MAG (+ force stock_quantity=1) ──
          for (const u of serialUpdates) {
            try {
              const info = updateMagAndForceQty1.run(u.magNumber || null, u.code, u.serial);
              if (info.changes > 0) result.serialsMagUpdated++;
            } catch (e) {
              result.errors.push(`MAJ N° MAG ${u.serial} (${u.code}): ${e.message}`);
            }
          }

          // ── E3. suppression des lignes catalogue legacy (modèle A pur) ──
          for (const l of legacyCatalogToDelete) {
            try {
              if (!l.equipmentId) continue;
              // Détacher / nettoyer FK non-cascade avant DELETE
              detachSavTicketsLegacy.run(l.equipmentId);
              deleteAssignmentsLegacy.run(l.equipmentId);
              const info = deleteLegacyCatalog.run(l.equipmentId);
              if (info.changes > 0) result.legacyCatalogDeleted++;
            } catch (e) {
              result.errors.push(`Suppression catalogue legacy ${l.code}: ${e.message}`);
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
              serialsAdded: result.serialsAdded,
              serialsRemoved: result.serialsRemoved,
              serialsReactivated: result.serialsReactivated,
              serialsMagUpdated: result.serialsMagUpdated,
              legacyCatalogDeleted: result.legacyCatalogDeleted,
              missingProductsCount: missingProducts.length,
              duplicatesCount:
                (duplicates?.locations?.length || 0) + (duplicates?.serials?.length || 0),
              collisionsCount: collisions.length,
              errorsCount: result.errors.length,
            }),
            JSON.stringify({
              newProducts: newProducts.map((p) => ({ code: p.code })),
              updatedProducts: updatedProducts.map((u) => ({ id: u.id, code: u.code })),
              quantityChanges,
              newSerials: newSerials.map((s) => ({
                code: s.code,
                serial: s.serial,
                magNumber: s.magNumber || null,
              })),
              serialUpdates,
              removedSerials,
              legacyCatalogToDelete,
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

        // Génération asynchrone des QR Codes pour les nouveaux équipements
        // (basée sur l'UID EMAG-XXXXX final, hors transaction).
        if (newEquipmentIds.length > 0) {
          const updateQr = db.prepare('UPDATE equipment SET qrcode = ? WHERE id = ?');
          for (const { id, uid } of newEquipmentIds) {
            try {
              const qr = generateQrDataUrl(buildEquipmentQrPayload(uid));
              updateQr.run(qr, id);
            } catch (e) {
              logger.warn(`QR generation failed for equipment #${id} (${uid}): ${e.message}`);
            }
          }
        }

        addToHistory('locmat_import', null, 'import', result, req.user.id, req.user.name);
        logger.info(
          `Import Locmat (equipment): +${result.createdProducts} créés, ${result.updatedProducts} MAJ, ${result.quantityAdjusted} qtés, +${result.serialsAdded} serials, -${result.serialsRemoved} serials, ${result.serialsMagUpdated} N°MAG, -${result.legacyCatalogDeleted} catalogues legacy`,
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
