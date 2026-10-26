import logger from '../logger.js';

export function runEquipmentUsageHistoryMigration(db) {
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS equipment_usage_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
      usage_date TEXT NOT NULL,
      hours REAL NOT NULL CHECK(hours >= 0),
      recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_equipment_usage_history_equipment_date ON equipment_usage_history(equipment_id, usage_date DESC, id DESC)',
    );
    const backfill = db
      .prepare(
        `UPDATE equipment
         SET is_serialized = 1
         WHERE TRIM(COALESCE(serial_number, '')) <> ''
           AND COALESCE(is_serialized, 0) <> 1`,
      )
      .run();
    if (backfill.changes > 0) {
      logger.info(`  ✅ Equipment usage: ${backfill.changes} équipements sérialisés régularisés`);
    }
    logger.info('  ✅ Equipment usage: table equipment_usage_history OK');
  } catch (error) {
    logger.warn(`Equipment usage history migration: ${error.message}`);
  }
}
