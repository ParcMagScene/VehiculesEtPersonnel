// apps/api/migrations/sav-parts-v1.js
//
// Ticket : T-P1-07 (Equipements v2 - SAV enrichi).
//
// Cree la table `sav_parts` : pieces detachees commandees / utilisees
// pour reparer un ticket SAV. Additive, idempotente, coexiste avec
// le schema existant (`sav_tickets` inchange).

import logger from '../logger.js';

/**
 * Statuts d'une piece dans son cycle de vie.
 * @type {ReadonlyArray<string>}
 */
export const SAV_PART_STATUSES = Object.freeze([
  'requested', // besoin identifie
  'ordered', // commande passee
  'received', // recue au depot
  'installed', // installee sur l'equipement
  'cancelled', // besoin annule
]);

/**
 * @param {import('better-sqlite3').Database} db
 */
export function runSavPartsMigration(db) {
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS sav_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES sav_tickets(id) ON DELETE CASCADE,
      part_name TEXT NOT NULL,
      part_reference TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL,
      supplier TEXT,
      status TEXT NOT NULL DEFAULT 'requested'
        CHECK(status IN ('requested', 'ordered', 'received', 'installed', 'cancelled')),
      requested_at DATETIME NOT NULL DEFAULT (datetime('now')),
      ordered_at DATETIME,
      received_at DATETIME,
      installed_at DATETIME,
      cancelled_at DATETIME,
      notes TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      modified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      modified_at DATETIME NOT NULL DEFAULT (datetime('now'))
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_sav_parts_ticket ON sav_parts(ticket_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_sav_parts_status ON sav_parts(status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_sav_parts_supplier ON sav_parts(supplier)');
    logger.info('  ✅ SAV v2: table sav_parts OK');
  } catch (err) {
    logger.warn(`  ⚠️ SAV v2: table sav_parts — ${err.message}`);
  }
}
