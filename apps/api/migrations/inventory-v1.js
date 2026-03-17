// ═══════════════════════════════════════════════════════════════
// server/migrations/inventory-v1.js
// Migration idempotente: Module Inventaire Unifié Mag Scène
// Tables: inventory_locations, inventory_movements_ext, inventory_price_history,
//         inventory_anomalies, inventory_stats_cache
// Extensions: stock_items (depot, zone, barcode, etc.)
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

export function runInventoryMigrations(db) {

  // ─── 1. Étendre stock_items avec colonnes inventaire ───
  try {
    const cols = db.pragma('table_info(stock_items)').map(c => c.name);
    const additions = [
      ['barcode',          'TEXT'],
      ['brand',            'TEXT'],
      ['model',            'TEXT'],
      ['serial_number',    'TEXT'],
      ['depot_id',         'INTEGER'],
      ['zone',             'TEXT'],
      ['sub_location',     'TEXT'],
      ['weight',           'REAL'],
      ['dimensions',       'TEXT'],          // JSON {w,h,d}
      ['warranty_end',     'TEXT'],
      ['purchase_date',    'TEXT'],
      ['lifecycle_status', "TEXT DEFAULT 'active'"],  // active|deprecated|obsolete
      ['reorder_point',    'REAL DEFAULT 0'],
      ['reorder_qty',      'REAL DEFAULT 0'],
      ['last_counted_at',  'TEXT'],
      ['last_counted_qty', 'REAL'],
      ['abc_class',        "TEXT DEFAULT 'C'"],       // A/B/C classification
    ];
    for (const [col, type] of additions) {
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE stock_items ADD COLUMN ${col} ${type}`);
        logger.info(`  ✅ Inventory migration: stock_items.${col} ajouté`);
      }
    }
  } catch (e) {
    logger.warn('⚠️ Migration stock_items extensions:', e.message);
  }

  // ─── 2. Table inventory_locations (entrepôts multi-dépôts) ───
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS inventory_locations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      code        TEXT UNIQUE NOT NULL,
      depot_number INTEGER DEFAULT 1,
      type        TEXT DEFAULT 'storage' CHECK(type IN ('storage','workshop','truck','external')),
      zone        TEXT,
      floor       TEXT,
      capacity    INTEGER,
      address     TEXT,
      gps_lat     REAL,
      gps_lon     REAL,
      parent_id   INTEGER REFERENCES inventory_locations(id),
      is_active   INTEGER DEFAULT 1,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (e) {
    logger.warn('⚠️ Migration inventory_locations:', e.message);
  }

  // ─── 3. Table inventory_price_history (historique prix multi-source) ───
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS inventory_price_history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_item_id   INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
      supplier_id     INTEGER REFERENCES suppliers(id),
      source          TEXT DEFAULT 'manual' CHECK(source IN ('manual','import','catalog','order','api')),
      price_ht        REAL NOT NULL,
      currency        TEXT DEFAULT 'EUR',
      quantity_break   REAL DEFAULT 1,
      valid_from      TEXT,
      valid_to        TEXT,
      reference       TEXT,
      confidence      REAL DEFAULT 50,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (e) {
    logger.warn('⚠️ Migration inventory_price_history:', e.message);
  }

  // ─── 4. Table inventory_anomalies (détection anomalies prix/stock) ───
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS inventory_anomalies (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_item_id   INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
      type            TEXT NOT NULL CHECK(type IN ('price_outlier','stock_drift','missing_count','duplicate','price_spike')),
      severity        TEXT DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
      description     TEXT,
      expected_value  REAL,
      actual_value    REAL,
      deviation_pct   REAL,
      status          TEXT DEFAULT 'open' CHECK(status IN ('open','acknowledged','resolved','ignored')),
      resolved_by     INTEGER REFERENCES users(id),
      resolved_at     DATETIME,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (e) {
    logger.warn('⚠️ Migration inventory_anomalies:', e.message);
  }

  // ─── 5. Table inventory_stats_cache (cache stats aggrégées) ───
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS inventory_stats_cache (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key    TEXT UNIQUE NOT NULL,
      data         TEXT NOT NULL,
      computed_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at   DATETIME
    )`);
  } catch (e) {
    logger.warn('⚠️ Migration inventory_stats_cache:', e.message);
  }

  // ─── 6. Index de performance Inventaire ───
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_stock_items_barcode ON stock_items(barcode)',
    'CREATE INDEX IF NOT EXISTS idx_stock_items_depot ON stock_items(depot_id)',
    'CREATE INDEX IF NOT EXISTS idx_stock_items_lifecycle ON stock_items(lifecycle_status)',
    'CREATE INDEX IF NOT EXISTS idx_stock_items_abc ON stock_items(abc_class)',
    'CREATE INDEX IF NOT EXISTS idx_stock_items_reorder ON stock_items(quantity, min_quantity) WHERE is_active = 1',
    'CREATE INDEX IF NOT EXISTS idx_inv_price_history_item ON inventory_price_history(stock_item_id)',
    'CREATE INDEX IF NOT EXISTS idx_inv_price_history_supplier ON inventory_price_history(supplier_id)',
    'CREATE INDEX IF NOT EXISTS idx_inv_anomalies_item ON inventory_anomalies(stock_item_id)',
    'CREATE INDEX IF NOT EXISTS idx_inv_anomalies_status ON inventory_anomalies(status) WHERE status = \'open\'',
    'CREATE INDEX IF NOT EXISTS idx_inv_locations_depot ON inventory_locations(depot_number)',
    'CREATE INDEX IF NOT EXISTS idx_inv_locations_code ON inventory_locations(code)',
    'CREATE INDEX IF NOT EXISTS idx_inv_stats_cache_key ON inventory_stats_cache(cache_key)',
  ];
  for (const idx of indexes) {
    try { db.exec(idx); } catch (e) { /* index exists */ }
  }

  // ─── 7. Seed: Emplacements par défaut (Dépôt 1+2) ───
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM inventory_locations').get().c;
    if (count === 0) {
      const ins = db.prepare(`INSERT INTO inventory_locations (name, code, depot_number, type, zone) VALUES (?, ?, ?, ?, ?)`);
      const locations = [
        ['Dépôt 1 — Stockage principal', 'DEP1-MAIN',  1, 'storage',  'A'],
        ['Dépôt 1 — Atelier',            'DEP1-WORK',  1, 'workshop', 'B'],
        ['Dépôt 2 — Stockage',           'DEP2-MAIN',  2, 'storage',  'A'],
        ['Dépôt 2 — Atelier',            'DEP2-WORK',  2, 'workshop', 'B'],
        ['Camion — En tournée',           'TRUCK-01',   0, 'truck',    null],
        ['Externe — Chez prestataire',    'EXT-PRESTA', 0, 'external', null],
      ];
      for (const [name, code, depot, type, zone] of locations) {
        ins.run(name, code, depot, type, zone);
      }
      logger.info(`  ✅ Inventory: ${locations.length} emplacements par défaut créés`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration seed inventory_locations:', e.message);
  }

  logger.info('  ✅ Migrations Inventaire v1 terminées');
}
