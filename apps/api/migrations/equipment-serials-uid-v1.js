// ═══════════════════════════════════════════════════════════════
// apps/api/migrations/equipment-serials-uid-v1.js
//
// Ajoute UNIQUEMENT la colonne `uid` UNIQUE sur equipment_serials.
//
// IMPORTANT : le backfill et la normalisation des UID sont désormais
// effectués par la migration v2 (`equipment-serials-uid-v2.js`) qui
// utilise un compteur global garantissant l'unicité au format strict
// EMAG-XXXXX (5 chiffres) entre equipment.uid et equipment_serials.uid.
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

export function runEquipmentSerialsUidMigration(db) {
  try {
    const cols = db.pragma('table_info(equipment_serials)').map((c) => c.name);
    if (!cols.includes('uid')) {
      db.exec('ALTER TABLE equipment_serials ADD COLUMN uid TEXT');
      logger.info('  ✅ Migration: equipment_serials.uid ajouté');
    }
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_serials_uid ON equipment_serials(uid) WHERE uid IS NOT NULL',
    );
  } catch (e) {
    logger.warn('Migration equipment_serials.uid (column):', e.message);
  }
}
