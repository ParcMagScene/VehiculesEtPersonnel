// ═══════════════════════════════════════════════════════════════
// apps/api/migrations/equipment-serials-mag-number-v1.js
// Migration idempotente — ajoute la colonne `mag_number` à equipment_serials.
//
//   • Numéro Mag spécifique à chaque numéro de série (lettre + 2 ou 3 chiffres
//     typiquement, ex: A12, B003), saisi librement par les administrateurs.
//   • Distinct du `numero_mag` de la table equipment (qui est au niveau produit).
//   • Utilisé notamment pour la gravure laser via LightBurn (étiquettes 50×33,33mm).
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

export function runEquipmentSerialsMagNumberMigration(db) {
  try {
    const cols = db.pragma('table_info(equipment_serials)').map((c) => c.name);
    if (!cols.includes('mag_number')) {
      db.exec('ALTER TABLE equipment_serials ADD COLUMN mag_number TEXT');
      logger.info('  ✅ Migration: equipment_serials.mag_number ajouté');
    }
    // Index non unique pour accélérer la recherche / filtre par numéro Mag.
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_equipment_serials_mag_number ON equipment_serials(mag_number) WHERE mag_number IS NOT NULL',
    );
  } catch (e) {
    logger.warn('Migration equipment_serials.mag_number:', e.message);
  }
}
