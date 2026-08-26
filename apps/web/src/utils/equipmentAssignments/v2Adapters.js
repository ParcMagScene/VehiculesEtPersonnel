// apps/web/src/utils/equipmentAssignments/v2Adapters.js
//
// Ticket : T-P1-08b (Equipment Assignments v2 — fondations UI).
//
// Adapters + flag reader pour les endpoints v2 :
//   - POST /api/v2/equipment/:id/assignments        (create safe)
//   - POST /api/v2/equipment-assignments/:aid/release
//   - GET  /api/v2/equipment/:id/assignments/history

/**
 * Statuts d'assignation (miroir cote serveur).
 * @type {ReadonlyArray<string>}
 */
export const ASSIGNMENT_STATUSES = Object.freeze(['active', 'released', 'cancelled']);

/**
 * Types d'evenement history (miroir cote serveur).
 * @type {ReadonlyArray<string>}
 */
export const ASSIGNMENT_EVENT_TYPES = Object.freeze(['assign', 'release', 'reassign', 'cancel']);

/**
 * Adapte une assignation v2 (snake -> camel).
 * @param {object|null|undefined} assignment
 * @returns {object|null}
 */
export function adaptAssignmentV2ToV1(assignment) {
  if (!assignment || typeof assignment !== 'object') return null;
  return {
    id: assignment.id ?? null,
    equipmentId: assignment.equipment_id ?? null,
    assignedTo: assignment.assigned_to ?? null,
    assignedBy: assignment.assigned_by ?? null,
    startDate: assignment.start_date ?? null,
    endDate: assignment.end_date ?? null,
    releaseDate: assignment.release_date ?? null,
    affaireId: assignment.affaire_id ?? null,
    status: assignment.status ?? null,
    notes: assignment.notes ?? null,
    createdAt: assignment.created_at ?? null,
    updatedAt: assignment.updated_at ?? null,
  };
}

/**
 * Adapte une entree d'historique v2.
 * @param {object|null|undefined} entry
 * @returns {object|null}
 */
export function adaptAssignmentHistoryEntryV2ToV1(entry) {
  if (!entry || typeof entry !== 'object') return null;
  return {
    id: entry.id ?? null,
    assignmentId: entry.assignment_id ?? null,
    equipmentId: entry.equipment_id ?? null,
    eventType: entry.event_type ?? null,
    source: entry.source ?? null,
    previousAssignedTo: entry.previous_assigned_to ?? null,
    newAssignedTo: entry.new_assigned_to ?? null,
    changedBy: entry.changed_by ?? null,
    changedAt: entry.changed_at ?? null,
    notes: entry.notes ?? null,
  };
}

/**
 * Normalise la reponse `v2GetEquipmentAssignmentsHistory` :
 *   { data: { entries: [...], total: N }, meta: {...} }
 * @param {object|null|undefined} v2Response
 * @returns {{ entries: Array<object>, total: number } | null}
 */
export function adaptV2AssignmentsHistoryList(v2Response) {
  if (!v2Response || typeof v2Response !== 'object') return null;
  const data = v2Response.data;
  if (!data || typeof data !== 'object') return null;
  const raw = Array.isArray(data.entries) ? data.entries : [];
  const entries = raw.map(adaptAssignmentHistoryEntryV2ToV1).filter(Boolean);
  return { entries, total: Number(data.total ?? entries.length) };
}

/**
 * Normalise la reponse create/release :
 *   { data: { assignment: {...}, history_id: N }, meta: {...} }
 * @param {object|null|undefined} v2Response
 * @returns {{ assignment: object|null, historyId: number|null } | null}
 */
export function adaptV2AssignmentMutationResponse(v2Response) {
  if (!v2Response || typeof v2Response !== 'object') return null;
  const data = v2Response.data;
  if (!data || typeof data !== 'object') return null;
  return {
    assignment: adaptAssignmentV2ToV1(data.assignment),
    historyId: data.history_id ?? null,
  };
}

/**
 * Detecte l'erreur "double-assign bloquee" du service v2.
 * Le service utilise `EquipmentAssignmentsV2ConflictError` avec
 * code applicatif `CONFLICT` et statut HTTP 409. Cette fonction
 * permet a l'UI de distinguer un conflit metier d'une erreur
 * technique pour afficher un message dedie.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isDoubleAssignConflict(err) {
  if (!err || typeof err !== 'object') return false;
  const code = err.code || err.details?.code;
  const status = err.status || err.details?.status;
  return code === 'CONFLICT' || status === 409;
}

/**
 * Lit le flag client v2 pour Equipment Assignments. Convention
 * Vite : `VITE_FEATURE_V2_EQUIPMENT_ASSIGNMENTS=1` -> true.
 * @param {Record<string, string|undefined>} [env]
 * @returns {boolean}
 */
export function readEquipmentAssignmentsV2ClientFlag(env) {
  const source = env ?? (typeof import.meta !== 'undefined' ? import.meta.env : {});
  const raw = source?.VITE_FEATURE_V2_EQUIPMENT_ASSIGNMENTS;
  if (raw === undefined || raw === null) return false;
  const value = String(raw).trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'yes';
}
