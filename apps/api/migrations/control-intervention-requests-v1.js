import { createControlInterventionRequest } from '../services/controlInterventionRequests.js';

export function runControlInterventionRequestsMigration(db) {
  const columns = db.pragma('table_info(control_history)').map((column) => column.name);
  if (!columns.includes('intervention_ticket_id')) {
    db.exec('ALTER TABLE control_history ADD COLUMN intervention_ticket_id INTEGER');
  }

  const historyIds = db
    .prepare(
      `SELECT h.id
         FROM control_history h
         JOIN equipment_controls ec ON ec.id = h.equipment_control_id
        WHERE h.status = 'MANQUE'
          AND ec.entity_type = 'equipment'
          AND h.documents IS NOT NULL
          AND COALESCE(TRIM(h.notes), '') != ''
          AND h.notes NOT LIKE '[auto]%'
          AND h.intervention_ticket_id IS NULL
        ORDER BY h.id`,
    )
    .all()
    .map((row) => row.id);

  const backfill = db.transaction(() => {
    let created = 0;
    for (const historyId of historyIds) {
      if (createControlInterventionRequest(db, historyId)) created += 1;
    }
    return created;
  });

  return backfill();
}
