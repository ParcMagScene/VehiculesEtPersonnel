import logger from '../logger.js';

/**
 * @param {import('better-sqlite3').Database} db
 */
export function runAffaireOperationsMigration(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS affaire_operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        affaire_id INTEGER NOT NULL REFERENCES affaires(id) ON DELETE CASCADE,
        bl_import_id TEXT REFERENCES bl_imports(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_affaire_operations_affaire
        ON affaire_operations(affaire_id);
      CREATE INDEX IF NOT EXISTS idx_affaire_operations_bl
        ON affaire_operations(bl_import_id);
    `);

    for (const table of ['task_assignments', 'reservations']) {
      const columns = db.pragma(`table_info(${table})`).map((column) => column.name);
      if (!columns.includes('operation_id')) {
        db.exec(
          `ALTER TABLE ${table} ADD COLUMN operation_id INTEGER REFERENCES affaire_operations(id) ON DELETE SET NULL`,
        );
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_operation ON ${table}(operation_id)`);
    }

    logger.info('✅ Migration affaire_operations vérifiée/créée');
  } catch (error) {
    logger.error('❌ Migration affaire_operations:', error.message);
    throw error;
  }
}
