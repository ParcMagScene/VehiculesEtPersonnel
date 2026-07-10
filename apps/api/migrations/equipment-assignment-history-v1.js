// apps/api/migrations/equipment-assignment-history-v1.js
//
// Ticket : T-P1-08 (Equipements v2 - assignations auditees).
//
// Table `equipment_assignment_history` : trace des mutations sur
// `equipment_assignments` (CREATE, UPDATE de status/dates,
// TRANSFER, RELEASE). Additive, idempotente.

import logger from '../logger.js';

export function runEquipmentAssignmentHistoryMigration(db) {
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS equipment_assignment_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES equipment_assignments(id) ON DELETE CASCADE,
      equipment_id INTEGER NOT NULL,
      event_type TEXT NOT NULL
        CHECK(event_type IN ('created', 'updated', 'released', 'transferred')),
      previous_status TEXT,
      new_status TEXT,
      previous_assigned_to INTEGER,
      new_assigned_to INTEGER,
      previous_start_date TEXT,
      new_start_date TEXT,
      previous_end_date TEXT,
      new_end_date TEXT,
      notes TEXT,
      changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      changed_at DATETIME NOT NULL DEFAULT (datetime('now'))
    )`);
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_eq_ah_assignment ON equipment_assignment_history(assignment_id)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_eq_ah_equipment ON equipment_assignment_history(equipment_id)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_eq_ah_changed_at ON equipment_assignment_history(changed_at)',
    );
    logger.info('  ✅ Equipment v2: table equipment_assignment_history OK');
  } catch (err) {
    logger.warn(`  ⚠️ Equipment v2: equipment_assignment_history — ${err.message}`);
  }
}
