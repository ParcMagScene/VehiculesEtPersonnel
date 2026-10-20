export function createControlInterventionRequest(db, historyId) {
  const history = db
    .prepare(
      `SELECT h.id, h.performed_at, h.status, h.notes, h.documents,
              h.intervention_ticket_id, ec.entity_type, ec.entity_id,
              ct.name AS control_type_name, e.id AS equipment_id, e.name AS equipment_name
         FROM control_history h
         JOIN equipment_controls ec ON ec.id = h.equipment_control_id
         JOIN control_types ct ON ct.id = ec.control_type_id
         JOIN equipment e ON ec.entity_type = 'equipment'
                         AND e.id = CAST(ec.entity_id AS INTEGER)
        WHERE h.id = ?`,
    )
    .get(historyId);

  if (
    !history ||
    history.status !== 'MANQUE' ||
    history.entity_type !== 'equipment' ||
    !history.notes?.trim() ||
    history.notes.startsWith('[auto]')
  ) {
    return null;
  }

  if (history.intervention_ticket_id) return history.intervention_ticket_id;

  const marker = `[control_history_id:${history.id}]`;
  const existing = db
    .prepare(
      `SELECT id FROM sav_tickets
        WHERE equipment_id = ? AND instr(COALESCE(description, ''), ?) > 0
        LIMIT 1`,
    )
    .get(history.equipment_id, marker);
  if (existing) {
    db.prepare('UPDATE control_history SET intervention_ticket_id = ? WHERE id = ?').run(
      existing.id,
      history.id,
    );
    return existing.id;
  }

  const docs = history.documents ? JSON.parse(history.documents) : [];
  const reportUrls = docs.filter((document) => document?.url).map((document) => document.url);
  const description = [
    marker,
    `Demande créée automatiquement après le contrôle ${history.control_type_name} du ${history.performed_at}.`,
    `Observation : ${history.notes.trim()}`,
    ...reportUrls.map((url) => `Rapport : ${url}`),
  ].join('\n');
  const result = db
    .prepare(
      `INSERT INTO sav_tickets
        (equipment_id, reported_by, assigned_to, type, priority, status, title, description)
       VALUES (?, NULL, NULL, 'panne', 'high', 'open', ?, ?)`,
    )
    .run(
      history.equipment_id,
      `Intervention après contrôle périodique — ${history.equipment_name}`,
      description,
    );

  db.prepare('UPDATE control_history SET intervention_ticket_id = ? WHERE id = ?').run(
    result.lastInsertRowid,
    history.id,
  );
  return result.lastInsertRowid;
}
