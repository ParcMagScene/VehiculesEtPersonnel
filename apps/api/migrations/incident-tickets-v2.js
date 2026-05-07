// ═══════════════════════════════════════════════════════════════
// migrations/incident-tickets-v2.js
//
// Évolution Suivi/Incidents :
//   - ajoute la colonne `incident_date` (date de l'incident, nullable)
//   - retire la contrainte UNIQUE(week_key, affaire_num) pour autoriser
//     plusieurs tickets pour la même affaire/semaine
//
// Idempotent. Détecte la contrainte UNIQUE via pragma index_list.
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

export function runIncidentTicketsV2Migration(db) {
  // 1. Ajouter incident_date si absente
  try {
    const cols = db.pragma('table_info(tracking_incident_tickets)').map((c) => c.name);
    if (!cols.includes('incident_date')) {
      db.exec('ALTER TABLE tracking_incident_tickets ADD COLUMN incident_date TEXT');
      // Backfill : utiliser period_start_date comme valeur initiale
      db.exec(
        'UPDATE tracking_incident_tickets SET incident_date = period_start_date WHERE incident_date IS NULL',
      );
      logger.info('  ✅ Incident tickets v2: colonne incident_date ajoutée + backfill');
    }
  } catch (e) {
    logger.warn('Incident tickets v2 (incident_date):', e.message);
  }

  // 2. Détecter la contrainte UNIQUE sur (week_key, affaire_num)
  try {
    const indexes = db.pragma('index_list(tracking_incident_tickets)');
    let uniqueIdxToDrop = null;
    for (const idx of indexes) {
      if (!idx.unique) continue;
      const info = db.pragma(`index_info(${JSON.stringify(idx.name)})`);
      const colNames = info
        .map((c) => c.name)
        .sort()
        .join(',');
      if (colNames === 'affaire_num,week_key') {
        uniqueIdxToDrop = idx.name;
        break;
      }
    }

    if (uniqueIdxToDrop) {
      // SQLite : si l'index est nommé sqlite_autoindex_*, il ne peut pas être DROP
      // → nécessite recréation de la table.
      if (uniqueIdxToDrop.startsWith('sqlite_autoindex_')) {
        logger.info('  ⏳ Incident tickets v2: recréation table pour retirer UNIQUE...');

        const tx = db.transaction(() => {
          db.exec(`
            CREATE TABLE tracking_incident_tickets_new (
              id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
              week_key TEXT NOT NULL,
              period_start_date TEXT NOT NULL,
              period_end_date TEXT NOT NULL,
              affaire_num TEXT NOT NULL,
              affaire_name TEXT DEFAULT '',
              affaire_start_date TEXT,
              affaire_end_date TEXT,
              is_tournee INTEGER DEFAULT 0,
              linked_reservations_json TEXT DEFAULT '[]',
              linked_personnel_json TEXT DEFAULT '[]',
              notes TEXT DEFAULT '',
              incident_date TEXT,
              created_by INTEGER REFERENCES users(id),
              created_at TEXT DEFAULT (datetime('now')),
              modified_by INTEGER REFERENCES users(id),
              modified_at TEXT
            )
          `);

          db.exec(`
            INSERT INTO tracking_incident_tickets_new (
              id, week_key, period_start_date, period_end_date,
              affaire_num, affaire_name, affaire_start_date, affaire_end_date,
              is_tournee, linked_reservations_json, linked_personnel_json, notes,
              incident_date, created_by, created_at, modified_by, modified_at
            )
            SELECT id, week_key, period_start_date, period_end_date,
                   affaire_num, affaire_name, affaire_start_date, affaire_end_date,
                   is_tournee, linked_reservations_json, linked_personnel_json, notes,
                   COALESCE(incident_date, period_start_date),
                   created_by, created_at, modified_by, modified_at
            FROM tracking_incident_tickets
          `);

          db.exec('DROP TABLE tracking_incident_tickets');
          db.exec('ALTER TABLE tracking_incident_tickets_new RENAME TO tracking_incident_tickets');

          // Recréer les index non-uniques utiles
          db.exec(`
            CREATE INDEX IF NOT EXISTS idx_tracking_incident_tickets_week
              ON tracking_incident_tickets(week_key);
            CREATE INDEX IF NOT EXISTS idx_tracking_incident_tickets_affaire
              ON tracking_incident_tickets(affaire_num);
            CREATE INDEX IF NOT EXISTS idx_tracking_incident_tickets_start
              ON tracking_incident_tickets(period_start_date);
            CREATE INDEX IF NOT EXISTS idx_tracking_incident_tickets_date
              ON tracking_incident_tickets(incident_date);
          `);
        });
        tx();
        logger.info('  ✅ Incident tickets v2: contrainte UNIQUE retirée (multi-tickets autorisé)');
      } else {
        db.exec(`DROP INDEX IF EXISTS ${JSON.stringify(uniqueIdxToDrop)}`);
        logger.info(`  ✅ Incident tickets v2: index unique ${uniqueIdxToDrop} supprimé`);
      }
    }
  } catch (e) {
    logger.warn('Incident tickets v2 (drop UNIQUE):', e.message);
  }

  // 3. S'assurer que l'index sur incident_date existe
  try {
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_tracking_incident_tickets_date ON tracking_incident_tickets(incident_date)',
    );
  } catch (e) {
    logger.warn('Incident tickets v2 (index date):', e.message);
  }

  logger.info('✅ Migration incident-tickets-v2 terminée');
}
