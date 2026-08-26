// apps/web/src/utils/equipmentAssignments/fetchEquipmentAssignments.js
//
// Ticket : T-P1-08b (Equipment Assignments v2 — fondations UI).
//
// Helpers unifies pour les 3 endpoints v2 assignations equipement.
// Sur la creation, distingue conflit metier (double-assign, 409)
// des autres erreurs pour permettre a l'UI de bloquer et afficher
// un message dedie.

import {
  adaptV2AssignmentMutationResponse,
  adaptV2AssignmentsHistoryList,
  isDoubleAssignConflict,
} from './v2Adapters.js';

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isFeatureDisabled(err) {
  if (!err || typeof err !== 'object') return false;
  const code = err.code || err.details?.code;
  return code === 'FEATURE_DISABLED';
}

/**
 * @typedef {object} CreateAssignmentInput
 * @property {number|null} [assignedTo]
 * @property {string} startDate
 * @property {string} [endDate]
 * @property {string|null} [affaireId]
 * @property {string} [notes]
 */

/**
 * Cree une assignation via v2.
 *
 * Contrat de retour (extended pattern) :
 *   - `{ ok: true, assignment, historyId }` sur succes.
 *   - `{ ok: false, conflict: true, error }` sur double-assign
 *     bloquee (409). L'UI doit afficher un message + refuser la
 *     mutation.
 *   - `null` si v2 indisponible (flag off, FEATURE_DISABLED,
 *     methode client absente, id invalide). L'UI doit fallback
 *     sur son chemin legacy (createAssignment v1) sans etre
 *     bloquee.
 *   - `{ ok: false, conflict: false, error }` sur toute autre
 *     erreur (network, 500). L'UI decide (retry / abort).
 *
 * @param {object} api
 * @param {number} equipmentId
 * @param {CreateAssignmentInput} data
 * @param {{ useV2?: boolean }} [options]
 * @returns {Promise<
 *   | { ok: true, assignment: object|null, historyId: number|null }
 *   | { ok: false, conflict: boolean, error: unknown }
 *   | null
 * >}
 */
export async function createEquipmentAssignmentUnified(
  api,
  equipmentId,
  data,
  { useV2 = false } = {},
) {
  if (!useV2 || typeof api?.v2CreateEquipmentAssignment !== 'function') return null;
  const id = Number(equipmentId);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!data || typeof data !== 'object' || !data.startDate) return null;

  const body = {
    assigned_to: data.assignedTo ?? null,
    start_date: String(data.startDate),
    end_date: data.endDate ?? null,
    affaire_id: data.affaireId ?? null,
    notes: data.notes ?? null,
  };

  try {
    const response = await api.v2CreateEquipmentAssignment(id, body);
    const adapted = adaptV2AssignmentMutationResponse(response);
    return {
      ok: true,
      assignment: adapted?.assignment ?? null,
      historyId: adapted?.historyId ?? null,
    };
  } catch (err) {
    if (isFeatureDisabled(err)) return null;
    return { ok: false, conflict: isDoubleAssignConflict(err), error: err };
  }
}

/**
 * @param {object} api
 * @param {number} assignmentId
 * @param {{ releaseDate?: string, notes?: string }} [data]
 * @param {{ useV2?: boolean }} [options]
 * @returns {Promise<{ assignment: object|null, historyId: number|null } | null>}
 */
export async function releaseEquipmentAssignmentUnified(
  api,
  assignmentId,
  data = {},
  { useV2 = false } = {},
) {
  if (!useV2 || typeof api?.v2ReleaseEquipmentAssignment !== 'function') return null;
  const id = Number(assignmentId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const body = {};
  if (data.releaseDate) body.release_date = String(data.releaseDate);
  if (data.notes) body.notes = String(data.notes);

  try {
    const response = await api.v2ReleaseEquipmentAssignment(id, body);
    return adaptV2AssignmentMutationResponse(response);
  } catch (err) {
    if (!isFeatureDisabled(err)) {
      // eslint-disable-next-line no-console
      console.warn(
        '[equipment-assignments v2] releaseEquipmentAssignmentUnified: retour null',
        err,
      );
    }
    return null;
  }
}

/**
 * @param {object} api
 * @param {number} equipmentId
 * @param {{ limit?: number, useV2?: boolean }} [options]
 * @returns {Promise<{ entries: Array<object>, total: number } | null>}
 */
export async function fetchAssignmentsHistoryUnified(
  api,
  equipmentId,
  { limit, useV2 = false } = {},
) {
  if (!useV2 || typeof api?.v2GetEquipmentAssignmentsHistory !== 'function') return null;
  const id = Number(equipmentId);
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    const response = await api.v2GetEquipmentAssignmentsHistory(id, limit ? { limit } : undefined);
    return adaptV2AssignmentsHistoryList(response);
  } catch (err) {
    if (!isFeatureDisabled(err)) {
      // eslint-disable-next-line no-console
      console.warn('[equipment-assignments v2] fetchAssignmentsHistoryUnified: retour null', err);
    }
    return null;
  }
}
