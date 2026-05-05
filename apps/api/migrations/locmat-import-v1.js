// ═══════════════════════════════════════════════════════════════
// server/migrations/locmat-import-v1.js
// Migration idempotente — Module Import Intelligent Locmat (Equipement)
//   • equipment : +qrcode (data URL), +is_serialized
//     (uid existe déjà côté equipment)
//   • CREATE equipment_serials (1 equipment → N serials, soft-delete via status)
//   • CREATE import_logs (journal générique des imports)
//   • Cleanup best-effort : retire les colonnes ajoutées par erreur sur stock_items
//     lors de la v1 initiale (avant repositionnement vers equipment)
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

export function runLocmatImportMigrations(db) {
  // ─── 1. equipment : +qrcode +is_serialized ───
  try {
    const cols = db.pragma('table_info(equipment)').map((c) => c.name);
    if (!cols.includes('qrcode')) {
      db.exec('ALTER TABLE equipment ADD COLUMN qrcode TEXT');
      logger.info('  ✅ Locmat migration: equipment.qrcode ajouté');
    }
    if (!cols.includes('is_serialized')) {
      db.exec('ALTER TABLE equipment ADD COLUMN is_serialized INTEGER DEFAULT 0');
      logger.info('  ✅ Locmat migration: equipment.is_serialized ajouté');
    }
    // Index unique partiel sur uid (la colonne existe déjà)
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_uid_unique ON equipment(uid) WHERE uid IS NOT NULL',
    );
  } catch (e) {
    logger.warn('Locmat migration equipment:', e.message);
  }

  // ─── 2. equipment_serials ───
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS equipment_serials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
        serial TEXT NOT NULL,
        status TEXT DEFAULT 'active',          -- active | removed
        source TEXT DEFAULT 'locmat',          -- locmat | manual | other-import
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        removed_at DATETIME
      )
    `);
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_serials_serial_active ON equipment_serials(serial) WHERE status = 'active'",
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_equipment_serials_equipment ON equipment_serials(equipment_id)',
    );
    logger.info('  ✅ Locmat migration: table equipment_serials prête');
  } catch (e) {
    logger.warn('Locmat migration equipment_serials:', e.message);
  }

  // ─── 3. import_logs (journal générique imports — réutilisable) ───
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS import_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,                    -- locmat | sav | manual | ...
        source TEXT,                           -- nom logiciel/fichier (Locations.csv+Serialise.csv)
        summary TEXT,                          -- JSON {newProducts, updatedProducts, newSerials, ...}
        details TEXT,                          -- JSON détails ligne à ligne (peut être volumineux)
        user_id INTEGER REFERENCES users(id),
        user_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_import_logs_type_date ON import_logs(type, created_at)',
    );
    logger.info('  ✅ Locmat migration: table import_logs prête');
  } catch (e) {
    logger.warn('Locmat migration import_logs:', e.message);
  }

  // ─── 4. Cleanup best-effort des colonnes ajoutées à tort sur stock_items ───
  //     (présentes uniquement si la v1 originelle a déjà tourné — sinon no-op)
  try {
    const sCols = db.pragma('table_info(stock_items)').map((c) => c.name);
    db.exec('DROP INDEX IF EXISTS idx_stock_items_uid');
    if (sCols.includes('uid')) {
      try {
        db.exec('ALTER TABLE stock_items DROP COLUMN uid');
      } catch (_) {
        /* SQLite trop ancien */
      }
    }
    if (sCols.includes('qrcode')) {
      try {
        db.exec('ALTER TABLE stock_items DROP COLUMN qrcode');
      } catch (_) {
        /* SQLite trop ancien */
      }
    }
    if (sCols.includes('is_serialized')) {
      try {
        db.exec('ALTER TABLE stock_items DROP COLUMN is_serialized');
      } catch (_) {
        /* SQLite trop ancien */
      }
    }
    db.exec('DROP TABLE IF EXISTS stock_item_serials');
  } catch (e) {
    logger.warn('Locmat cleanup stock_items:', e.message);
  }
}
