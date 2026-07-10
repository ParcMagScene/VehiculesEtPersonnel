// apps/api/services/equipment-assignments/assignments.js
//
// Ticket : T-P1-08 (Equipements v2 - assignations auditees).
//
// Contrat :
//   - Double-assignation strictement bloquee : impossible d'ecrire
//     une nouvelle ligne ACTIVE (status='active') sur un equipment
//     deja assigne sur une plage qui chevauche. Retour 409 CONFLICT.
//   - Chaque mutation (create/update/release) genere une ligne
//     equipment_assignment_history via appendHistoryEntry.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

import {
  EqAssignV2ConflictError,
  EqAssignV2NotFoundError,
  EqAssignV2ValidationError,
} from './errors.js';

/**
 * Detecte si `equipmentId` a deja une assignation ACTIVE qui
 * chevauche la plage `[startDate, endDate]`. Exclut `excludeAssignmentId`
 * (utile pour un update qui ne doit pas se conflicter avec lui-meme).
 *
 * end_date NULL est traite comme "ouverte" (encore active).
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.equipmentId
 * @param {string} params.startDate ISO date.
 * @param {string|null} [params.endDate] ISO date ou null.
 * @param {number} [params.excludeAssignmentId]
 * @returns {Array<object>} liste des assignments en conflit.
 */
export function findConflictingActiveAssignments({
  db,
  equipmentId,
  startDate,
  endDate,
  excludeAssignmentId,
} = {}) {
  const stmt = db.prepare(
    `SELECT id, equipment_id, assigned_to, start_date, end_date, status, notes
     FROM equipment_assignments
     WHERE equipment_id = ?
       AND status = 'active'
       AND (? IS NULL OR id != ?)
       AND (
         end_date IS NULL
         OR (
           start_date <= ?
           AND end_date >= ?
         )
       )`,
  );
  return stmt.all(
    equipmentId,
    excludeAssignmentId ?? null,
    excludeAssignmentId ?? null,
    endDate ?? '9999-12-31',
    startDate,
  );
}

/**
 * Insere une entree d'historique.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.assignmentId
 * @param {number} params.equipmentId
 * @param {'created'|'updated'|'released'|'transferred'} params.eventType
 * @param {object} [params.diff] {previous_*, new_*} pour audit.
 * @param {number|null} [params.changedBy]
 * @param {string|null} [params.notes]
 * @returns {number} rowid.
 */
export function appendHistoryEntry({
  db,
  assignmentId,
  equipmentId,
  eventType,
  diff = {},
  changedBy = null,
  notes = null,
} = {}) {
  const result = db
    .prepare(
      `INSERT INTO equipment_assignment_history
         (assignment_id, equipment_id, event_type,
          previous_status, new_status,
          previous_assigned_to, new_assigned_to,
          previous_start_date, new_start_date,
          previous_end_date, new_end_date,
          notes, changed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      assignmentId,
      equipmentId,
      eventType,
      diff.previous_status ?? null,
      diff.new_status ?? null,
      diff.previous_assigned_to ?? null,
      diff.new_assigned_to ?? null,
      diff.previous_start_date ?? null,
      diff.new_start_date ?? null,
      diff.previous_end_date ?? null,
      diff.new_end_date ?? null,
      notes,
      changedBy,
    );
  return Number(result.lastInsertRowid);
}

/**
 * Cree une assignation en verifiant l'absence de conflit ACTIVE.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.equipmentId
 * @param {number|null} params.assignedTo
 * @param {string} params.startDate ISO date.
 * @param {string|null} [params.endDate] ISO date ou null (ouverte).
 * @param {string|null} [params.affaireId]
 * @param {string|null} [params.notes]
 * @param {number|null} [params.assignedBy] User id (audit).
 * @returns {{ assignment: object, history_id: number }}
 */
export function createAssignmentSafe({
  db,
  equipmentId,
  assignedTo,
  startDate,
  endDate = null,
  affaireId = null,
  notes = null,
  assignedBy = null,
} = {}) {
  if (!db) throw new EqAssignV2ValidationError('db requis');
  const eid = Number(equipmentId);
  if (!Number.isInteger(eid) || eid <= 0) {
    throw new EqAssignV2ValidationError('equipmentId doit etre un entier > 0');
  }
  if (!ISO_DATE_RE.test(String(startDate))) {
    throw new EqAssignV2ValidationError('startDate au format YYYY-MM-DD requis');
  }
  if (endDate !== null && !ISO_DATE_RE.test(String(endDate))) {
    throw new EqAssignV2ValidationError('endDate au format YYYY-MM-DD ou null requis');
  }
  if (endDate !== null && String(endDate) < String(startDate)) {
    throw new EqAssignV2ValidationError('endDate doit etre >= startDate');
  }

  const equipment = db.prepare('SELECT id FROM equipment WHERE id = ?').get(eid);
  if (!equipment) {
    throw new EqAssignV2NotFoundError(`Equipment introuvable (id=${eid})`, { equipmentId: eid });
  }

  const conflicts = findConflictingActiveAssignments({
    db,
    equipmentId: eid,
    startDate,
    endDate,
  });
  if (conflicts.length > 0) {
    throw new EqAssignV2ConflictError(
      `Double-assignation refusee : ${conflicts.length} assignation(s) ACTIVE deja en cours`,
      { conflicts: conflicts.map((c) => c.id) },
    );
  }

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO equipment_assignments
           (equipment_id, assigned_to, assigned_by, start_date, end_date,
            affaire_id, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      )
      .run(eid, assignedTo ?? null, assignedBy ?? null, startDate, endDate, affaireId, notes);
    const assignmentId = Number(info.lastInsertRowid);
    const historyId = appendHistoryEntry({
      db,
      assignmentId,
      equipmentId: eid,
      eventType: 'created',
      diff: {
        new_status: 'active',
        new_assigned_to: assignedTo ?? null,
        new_start_date: startDate,
        new_end_date: endDate,
      },
      changedBy: assignedBy,
      notes,
    });
    return { assignmentId, historyId };
  });

  const { assignmentId, historyId } = tx();
  const assignment = db
    .prepare('SELECT * FROM equipment_assignments WHERE id = ?')
    .get(assignmentId);
  return { assignment, history_id: historyId };
}

/**
 * Libere une assignation ACTIVE (status=released + end_date=today
 * si non fourni). Ecrit une entree history.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.assignmentId
 * @param {string|null} [params.releaseDate] ISO date (defaut : today).
 * @param {number|null} [params.releasedBy]
 * @param {string|null} [params.notes]
 * @returns {{ assignment: object, history_id: number }}
 */
export function releaseAssignment({
  db,
  assignmentId,
  releaseDate = null,
  releasedBy = null,
  notes = null,
} = {}) {
  if (!db) throw new EqAssignV2ValidationError('db requis');
  const aid = Number(assignmentId);
  if (!Number.isInteger(aid) || aid <= 0) {
    throw new EqAssignV2ValidationError('assignmentId doit etre un entier > 0');
  }
  if (releaseDate !== null && !ISO_DATE_RE.test(String(releaseDate))) {
    throw new EqAssignV2ValidationError('releaseDate au format YYYY-MM-DD ou null requis');
  }

  const current = db.prepare('SELECT * FROM equipment_assignments WHERE id = ?').get(aid);
  if (!current) {
    throw new EqAssignV2NotFoundError(`Assignment introuvable (id=${aid})`, { assignmentId: aid });
  }
  if (current.status !== 'active') {
    throw new EqAssignV2ConflictError(
      `Assignment ${aid} deja en statut '${current.status}' (release impossible)`,
      { currentStatus: current.status },
    );
  }
  const endDate = releaseDate || new Date().toISOString().split('T')[0];

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE equipment_assignments SET status = 'released', end_date = ? WHERE id = ?",
    ).run(endDate, aid);
    const historyId = appendHistoryEntry({
      db,
      assignmentId: aid,
      equipmentId: current.equipment_id,
      eventType: 'released',
      diff: {
        previous_status: current.status,
        new_status: 'released',
        previous_end_date: current.end_date,
        new_end_date: endDate,
      },
      changedBy: releasedBy,
      notes,
    });
    return historyId;
  });
  const historyId = tx();
  const refreshed = db.prepare('SELECT * FROM equipment_assignments WHERE id = ?').get(aid);
  return { assignment: refreshed, history_id: historyId };
}

/**
 * Retourne les entrees d'historique pour un `equipment_id` ou un
 * `assignment_id` (au moins l'un des 2 requis).
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} [params.equipmentId]
 * @param {number} [params.assignmentId]
 * @param {number} [params.limit=100] Cap max.
 * @returns {{ entries: object[], total: number }}
 */
export function getAssignmentHistory({ db, equipmentId, assignmentId, limit = 100 } = {}) {
  if (!db) throw new EqAssignV2ValidationError('db requis');
  const where = [];
  const params = [];
  if (equipmentId !== undefined) {
    const eid = Number(equipmentId);
    if (!Number.isInteger(eid) || eid <= 0) {
      throw new EqAssignV2ValidationError('equipmentId invalide');
    }
    where.push('equipment_id = ?');
    params.push(eid);
  }
  if (assignmentId !== undefined) {
    const aid = Number(assignmentId);
    if (!Number.isInteger(aid) || aid <= 0) {
      throw new EqAssignV2ValidationError('assignmentId invalide');
    }
    where.push('assignment_id = ?');
    params.push(aid);
  }
  if (where.length === 0) {
    throw new EqAssignV2ValidationError('equipmentId ou assignmentId requis');
  }
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const rows = db
    .prepare(
      `SELECT id, assignment_id, equipment_id, event_type,
              previous_status, new_status,
              previous_assigned_to, new_assigned_to,
              previous_start_date, new_start_date,
              previous_end_date, new_end_date,
              notes, changed_by, changed_at
       FROM equipment_assignment_history
       WHERE ${where.join(' AND ')}
       ORDER BY changed_at DESC, id DESC
       LIMIT ?`,
    )
    .all(...params, cap);
  return { entries: rows, total: rows.length };
}
