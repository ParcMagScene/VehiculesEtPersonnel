// ═══════════════════════════════════════════════════════════════
// apps/api/migrations/equipment-numero-mag-v1.js
// Migration idempotente — ajoute la propriété "Numéro MAG" à equipment.
//   • Champ libre (texte) saisi par l'utilisateur, indépendant de l'UID interne
//     et de la référence fournisseur. Visible sur fiches, volets et lignes.
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

export function runEquipmentNumeroMagMigration(db) {
  try {
    const cols = db.pragma('table_info(equipment)').map((c) => c.name);
    if (!cols.includes('numero_mag')) {
      db.exec('ALTER TABLE equipment ADD COLUMN numero_mag TEXT');
      logger.info('  ✅ Migration: equipment.numero_mag ajouté');
    }
    // Index non unique pour accélérer la recherche / filtre
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_equipment_numero_mag ON equipment(numero_mag) WHERE numero_mag IS NOT NULL',
    );
  } catch (e) {
    logger.warn('Migration equipment.numero_mag:', e.message);
  }
}
