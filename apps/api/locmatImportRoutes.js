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
import { parseMagSerial } from './services/magNumber.js';
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

// Index serials existants par code de référence.
// On indexe par **coreSerial** (résultat de parseMagSerial) pour matcher
// correctement les lignes legacy dont le serial_number contient encore
// le numéro MAG (ex: "VX14 - 2115080074074" → coreSerial "2115080074074").
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
    const { coreSerial } = parseMagSerial(r.serial_number);
    const indexed = coreSerial || r.serial_number;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(indexed);
  }
  return map;
}

// Index inverse : coreSerial → refUpper propriétaire (collision cross-ref).
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
  for (const r of rows) {
    const { coreSerial } = parseMagSerial(r.serial_number);
    const indexed = coreSerial || r.serial_number;
    map.set(indexed, String(r.reference).toUpperCase());
  }
  return map;
}

// Index coreSerial → { magNumber, equipmentId, rawSerial } (pour détecter MAJ N° MAG
// et normaliser un serial_number legacy contenant le MAG).
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
    const { coreSerial, magNumber: legacyMag } = parseMagSerial(r.serial_number);
    const indexed = coreSerial || r.serial_number;
    map.set(indexed, {
      // Priorité au champ numero_mag explicite ; fallback sur le MAG legacy
      // extrait du serial_number historique.
      magNumber: r.numero_mag || legacyMag || null,
      equipmentId: r.id,
      rawSerial: r.serial_number,
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
        // Hérite category_id/brand/brand_id/model/photo + champs localisation
        // depuis le "parent" (ligne existante de la même reference).
        const insertUnit = db.prepare(`
          INSERT INTO equipment
            (name, reference, notes, purchase_price, stock_quantity,
             location, status, uid, qrcode, is_serialized, serial_number, numero_mag,
             category_id, brand, brand_id, model, photo,
             location_zone, location_code, location_floor, location_depot,
             created_by)
          VALUES (?, ?, ?, ?, 1, ?, 'available', ?, ?, 0, ?, ?,
                  ?, ?, ?, ?, ?,
                  ?, ?, ?, ?,
                  ?)
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
        // MAJ N° MAG + normalisation du serial_number (par id).
        // Utilisée quand la ligne DB a un serial_number legacy contenant le MAG
        // (ex: "VX14 - 2115080074074") : on remet à plat numero_mag + serial_number
        // au coreSerial fourni par le CSV.
        const updateMagAndSerialById = db.prepare(`
          UPDATE equipment SET
            numero_mag     = ?,
            serial_number  = ?,
            stock_quantity = 1,
            is_serialized  = 0,
            updated_at     = CURRENT_TIMESTAMP
          WHERE id = ?
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
        // création d'unité. Priorité :
        //  1) ligne avec category_id renseignée (la mieux décrite)
        //  2) catalogue sans serial
        //  3) plus petit id (la plus ancienne, souvent la "référence")
        const findParentByCode = db.prepare(
          `SELECT id, name, reference, notes, purchase_price, location,
                  category_id, brand, brand_id, model, photo,
                  location_zone, location_code, location_floor, location_depot
           FROM equipment
           WHERE UPPER(reference) = UPPER(?)
             AND (name IS NULL OR name NOT LIKE '%[archive]%')
             AND (status IS NULL OR status != 'removed')
           ORDER BY
             (CASE WHEN category_id IS NOT NULL THEN 0 ELSE 1 END),
             (CASE WHEN serial_number IS NULL OR serial_number = '' THEN 0 ELSE 1 END),
             id
           LIMIT 1`,
        );
        // Backfill : propage category/brand/model/photo/location vers toutes
        // les unités d'une même reference qui ont ces champs vides.
        const backfillUnitsByRef = db.prepare(`
          UPDATE equipment SET
            category_id     = COALESCE(category_id, ?),
            brand           = COALESCE(NULLIF(brand, ''), ?),
            brand_id        = COALESCE(brand_id, ?),
            model           = COALESCE(NULLIF(model, ''), ?),
            photo           = COALESCE(NULLIF(photo, ''), ?),
            location        = COALESCE(NULLIF(location, ''), ?),
            location_zone   = COALESCE(NULLIF(location_zone, ''), ?),
            location_code   = COALESCE(NULLIF(location_code, ''), ?),
            location_floor  = COALESCE(NULLIF(location_floor, ''), ?),
            location_depot  = COALESCE(NULLIF(location_depot, ''), ?),
            updated_at      = CURRENT_TIMESTAMP
          WHERE UPPER(reference) = UPPER(?)
            AND (status IS NULL OR status != 'removed')
        `);
        // Soft-delete d'une unité par (ref, serial)
        const softRemoveUnit = db.prepare(
          `UPDATE equipment SET status = 'removed', updated_at = CURRENT_TIMESTAMP
           WHERE UPPER(reference) = UPPER(?) AND serial_number = ?
             AND (status IS NULL OR status != 'removed')`,
        );
        // Soft-delete par id (utilisé quand le diff fournit equipmentId,
        // notamment pour les serials legacy au format "MAG - SN").
        const softRemoveUnitById = db.prepare(
          `UPDATE equipment SET status = 'removed', updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND (status IS NULL OR status != 'removed')`,
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
          backfilled: 0,
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
                parent.category_id ?? null,
                parent.brand || null,
                parent.brand_id ?? null,
                parent.model || null,
                parent.photo || null,
                parent.location_zone || null,
                parent.location_code || null,
                parent.location_floor || null,
                parent.location_depot || null,
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
              // Préférer la suppression par id (robuste face aux SN legacy
              // contenant le MAG dans serial_number).
              const info = s.equipmentId
                ? softRemoveUnitById.run(s.equipmentId)
                : softRemoveUnit.run(s.code, s.serial);
              if (info.changes > 0) result.serialsRemoved++;
            } catch (e) {
              result.errors.push(`Suppression serial ${s.serial}: ${e.message}`);
            }
          }

          // ── E2. mises à jour N° MAG (et normalisation serial_number legacy) ──
          // Si equipmentId est fourni : UPDATE par id + normalise serial_number
          // au coreSerial du CSV (résout le cas "VX14 - 2115080074074" → "I14" + SN propre).
          // Sinon : fallback par (reference, serial_number).
          for (const u of serialUpdates) {
            try {
              const info = u.equipmentId
                ? updateMagAndSerialById.run(u.magNumber || null, u.serial, u.equipmentId)
                : updateMagAndForceQty1.run(u.magNumber || null, u.code, u.serial);
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

          // ── E4. backfill catégorie/marque/localisation pour toutes les
          //       références touchées (newSerials + serialUpdates). On relit
          //       le parent APRÈS les suppressions legacy pour être certain
          //       de prendre la meilleure source disponible.
          const refsToBackfill = new Set();
          for (const s of newSerials) refsToBackfill.add(String(s.code).toUpperCase());
          for (const u of serialUpdates) refsToBackfill.add(String(u.code).toUpperCase());
          for (const ref of refsToBackfill) {
            try {
              const parent = findParentByCode.get(ref);
              if (!parent) continue;
              const info = backfillUnitsByRef.run(
                parent.category_id ?? null,
                parent.brand || null,
                parent.brand_id ?? null,
                parent.model || null,
                parent.photo || null,
                parent.location || null,
                parent.location_zone || null,
                parent.location_code || null,
                parent.location_floor || null,
                parent.location_depot || null,
                ref,
              );
              if (info.changes > 0) result.backfilled += info.changes;
            } catch (e) {
              result.errors.push(`Backfill catégorie ${ref}: ${e.message}`);
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
              backfilled: result.backfilled,
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
          `Import Locmat (equipment): +${result.createdProducts} créés, ${result.updatedProducts} MAJ, ${result.quantityAdjusted} qtés, +${result.serialsAdded} serials, -${result.serialsRemoved} serials, ${result.serialsMagUpdated} N°MAG, -${result.legacyCatalogDeleted} catalogues legacy, ${result.backfilled} backfillés`,
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

  // ─── 5. BACKFILL — propage cat/marque/loc depuis la "meilleure" unité
  //        existante vers toutes les unités vides de la même reference,
  //        sans aucun import CSV.
  app.post(
    '/api/import/locmat/backfill-references',
    authenticateToken,
    requireAdmin,
    (req, res) => {
      try {
        const findParent = db.prepare(
          `SELECT category_id, brand, brand_id, model, photo,
                  location, location_zone, location_code, location_floor, location_depot
           FROM equipment
           WHERE UPPER(reference) = UPPER(?)
             AND (name IS NULL OR name NOT LIKE '%[archive]%')
             AND (status IS NULL OR status != 'removed')
           ORDER BY
             (CASE WHEN category_id IS NOT NULL THEN 0 ELSE 1 END),
             (CASE WHEN serial_number IS NULL OR serial_number = '' THEN 0 ELSE 1 END),
             id
           LIMIT 1`,
        );
        const backfill = db.prepare(`
          UPDATE equipment SET
            category_id     = COALESCE(category_id, ?),
            brand           = COALESCE(NULLIF(brand, ''), ?),
            brand_id        = COALESCE(brand_id, ?),
            model           = COALESCE(NULLIF(model, ''), ?),
            photo           = COALESCE(NULLIF(photo, ''), ?),
            location        = COALESCE(NULLIF(location, ''), ?),
            location_zone   = COALESCE(NULLIF(location_zone, ''), ?),
            location_code   = COALESCE(NULLIF(location_code, ''), ?),
            location_floor  = COALESCE(NULLIF(location_floor, ''), ?),
            location_depot  = COALESCE(NULLIF(location_depot, ''), ?),
            updated_at      = CURRENT_TIMESTAMP
          WHERE UPPER(reference) = UPPER(?)
            AND (status IS NULL OR status != 'removed')
        `);
        const refsRows = db
          .prepare(
            `SELECT DISTINCT UPPER(reference) AS ref
             FROM equipment
             WHERE reference IS NOT NULL AND reference != ''
               AND (status IS NULL OR status != 'removed')`,
          )
          .all();

        let processedRefs = 0;
        let updatedRows = 0;
        let normalizedSerials = 0;
        const errors = [];

        // Invariant: 1 numéro de série = 1 unité, indépendamment du status
        // (les lignes 'removed' restent visibles dans les listings et doivent
        // également respecter qty=1).
        const fixSerialQty = db.prepare(`
          UPDATE equipment
             SET stock_quantity = 1,
                 is_serialized  = 1,
                 updated_at     = CURRENT_TIMESTAMP
           WHERE serial_number IS NOT NULL
             AND TRIM(serial_number) != ''
             AND (stock_quantity != 1 OR is_serialized != 1)
        `);

        const apply = db.transaction(() => {
          // 5a. Normaliser toutes les unités sérialisées : qty=1 + is_serialized=1
          //     (corrige héritage de l'ancien modèle agrégé)
          const fixInfo = fixSerialQty.run();
          normalizedSerials = fixInfo.changes || 0;

          for (const { ref } of refsRows) {
            try {
              const parent = findParent.get(ref);
              if (!parent) continue;
              // Inutile d'écrire si le parent n'a rien à propager
              const hasAny =
                parent.category_id ||
                parent.brand ||
                parent.brand_id ||
                parent.model ||
                parent.photo ||
                parent.location ||
                parent.location_zone ||
                parent.location_code ||
                parent.location_floor ||
                parent.location_depot;
              if (!hasAny) continue;
              processedRefs++;
              const info = backfill.run(
                parent.category_id ?? null,
                parent.brand || null,
                parent.brand_id ?? null,
                parent.model || null,
                parent.photo || null,
                parent.location || null,
                parent.location_zone || null,
                parent.location_code || null,
                parent.location_floor || null,
                parent.location_depot || null,
                ref,
              );
              if (info.changes > 0) updatedRows += info.changes;
            } catch (e) {
              errors.push(`Ref ${ref}: ${e.message}`);
            }
          }
        });
        apply();

        logger.info(
          `Backfill cat/marque/loc: ${processedRefs} refs traitées, ${updatedRows} lignes MAJ, ${normalizedSerials} sérialisés normalisés (qty=1)`,
        );
        res.json({
          success: true,
          totalRefs: refsRows.length,
          processedRefs,
          updatedRows,
          normalizedSerials,
          errors,
        });
      } catch (error) {
        logger.error('Erreur backfill references:', error);
        res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
      }
    },
  );
}
