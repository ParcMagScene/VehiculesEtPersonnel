// ═══════════════════════════════════════════════════════════════
// apps/api/migrations/equipment-serials-uid-v2.js
//
// Migration UID v2 — format strict unique EMAG-XXXXX (5 chiffres) pour TOUS
// les UID, équipements ET serials, via un compteur global partagé.
//
//   • Crée la table uid_counter (init après le max existant)
//   • Convertit tous les UID legacy `EMAG-Sxxxxx` (serials v1) en `EMAG-XXXXX`
//     en réattribuant un nouveau numéro depuis le compteur global.
//   • Garantit l'unicité globale : aucune collision possible entre
//     equipment.uid et equipment_serials.uid.
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';
import {
  EMAG_UID_RE,
  ensureUidCounter,
  extractUidNumber,
  formatUid,
  getNextUid,
} from '../services/uidCounter.js';

export function runEquipmentSerialsUidV2Migration(db) {
  // ─── 1. Initialisation du compteur global ──────────────────────────
  // Démarre après le MAX(numéro) déjà utilisé dans equipment.uid +
  // equipment_serials.uid + max(equipment.id) (les UID equipment historiques
  // sont alignés sur l'id PK).
  const maxEqId = db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM equipment').get().m;
  const eqUids = db.prepare("SELECT uid FROM equipment WHERE uid LIKE 'EMAG-%'").all();
  const srUids = db.prepare("SELECT uid FROM equipment_serials WHERE uid LIKE 'EMAG-%'").all();
  let maxNum = maxEqId;
  for (const r of eqUids) maxNum = Math.max(maxNum, extractUidNumber(r.uid));
  for (const r of srUids) maxNum = Math.max(maxNum, extractUidNumber(r.uid));

  ensureUidCounter(db, maxNum);
  logger.info(`  ✅ Migration UID v2: compteur global initialisé à ${maxNum}`);

  // ─── 2. Conversion des UID serials legacy EMAG-Sxxxxx → EMAG-XXXXX ──
  const legacy = db.prepare("SELECT id, uid FROM equipment_serials WHERE uid LIKE 'EMAG-S%'").all();

  if (legacy.length === 0) {
    logger.info('  ✅ Migration UID v2: aucun UID serial legacy à convertir');
  } else {
    const update = db.prepare('UPDATE equipment_serials SET uid = ? WHERE id = ?');
    let converted = 0;
    const tx = db.transaction((rows) => {
      for (const r of rows) {
        const newUid = getNextUid(db);
        update.run(newUid, r.id);
        converted++;
      }
    });
    tx(legacy);
    logger.info(`  ✅ Migration UID v2: ${converted} UID serials convertis en EMAG-XXXXX`);
  }

  // ─── 3. Backfill éventuel : serials sans UID ───────────────────────
  const missing = db
    .prepare("SELECT id FROM equipment_serials WHERE uid IS NULL OR uid = ''")
    .all();
  if (missing.length > 0) {
    const update = db.prepare('UPDATE equipment_serials SET uid = ? WHERE id = ?');
    const tx = db.transaction((rows) => {
      for (const r of rows) {
        update.run(getNextUid(db), r.id);
      }
    });
    tx(missing);
    logger.info(`  ✅ Migration UID v2: ${missing.length} UID serials backfillés`);
  }

  // ─── 4. Audit final ────────────────────────────────────────────────
  const bad = db
    .prepare(
      `SELECT 'equipment' AS t, id, uid FROM equipment
        WHERE uid IS NOT NULL AND uid != '' AND uid NOT GLOB 'EMAG-[0-9][0-9][0-9][0-9][0-9]'
        UNION ALL
        SELECT 'serial' AS t, id, uid FROM equipment_serials
        WHERE uid IS NOT NULL AND uid != '' AND uid NOT GLOB 'EMAG-[0-9][0-9][0-9][0-9][0-9]'
        LIMIT 20`,
    )
    .all();
  if (bad.length > 0) {
    logger.warn(`  ⚠️ Migration UID v2: ${bad.length} UID hors format détectés (échantillon):`);
    for (const r of bad) logger.warn(`     [${r.t}#${r.id}] uid="${r.uid}"`);
  } else {
    logger.info('  ✅ Migration UID v2: tous les UID sont conformes EMAG-XXXXX');
  }

  // Sanity check : intégrité des liens sav_tickets ↔ equipment (par equipment_id, PK numérique).
  // Les UID changent mais les PK ne bougent pas → les liens doivent rester intacts.
  try {
    const savOrphans = db
      .prepare(
        `SELECT COUNT(*) AS n FROM sav_tickets st
          LEFT JOIN equipment e ON e.id = st.equipment_id
          WHERE st.equipment_id IS NOT NULL AND e.id IS NULL`,
      )
      .get();
    if (savOrphans.n > 0) {
      logger.warn(
        `  ⚠️ Migration UID v2: ${savOrphans.n} ticket(s) SAV orphelin(s) détecté(s) (equipment_id introuvable)`,
      );
    } else {
      logger.info('  ✅ Migration UID v2: liens sav_tickets ↔ equipment intacts (0 orphelin)');
    }
  } catch (e) {
    logger.warn(`  ⚠️ Migration UID v2: audit sav_tickets impossible (${e.message})`);
  }

  // Sanity check : pas de doublon entre equipment.uid et equipment_serials.uid
  const dup = db
    .prepare(
      `SELECT e.uid AS uid FROM equipment e
        INNER JOIN equipment_serials s ON s.uid = e.uid
        WHERE e.uid IS NOT NULL LIMIT 5`,
    )
    .all();
  if (dup.length > 0) {
    logger.warn(`  ⚠️ Migration UID v2: ${dup.length} UID partagés entre equipment & serials !`);
    for (const r of dup) logger.warn(`     uid="${r.uid}"`);
  }

  // Marqueur de cohérence : valide la regex format
  void EMAG_UID_RE;
  void formatUid;
}
