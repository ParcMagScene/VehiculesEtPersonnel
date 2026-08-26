// apps/web/src/utils/equipmentUid/fetchEquipmentUidAudit.js
//
// Ticket : T-P1-06b (Equipment UID v2 — fondations UI admin).
//
// Helpers unifies pour l'audit (lecture) et la regeneration
// (mutation) d'UID equipement via le namespace v2 admin.
// Le v1 ne dispose pas d'endpoint standalone equivalent : c'est
// un `additive` strict. Retour null quand indisponible (flag off,
// FEATURE_DISABLED, methode client absente, erreur reseau).

import { adaptV2AuditResponse, adaptV2RegenerateResponse } from './v2Adapters.js';

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
 * @param {object} api - Client API.
 * @param {{ useV2?: boolean }} [options]
 * @returns {Promise<object|null>} Rapport d'audit shape camelCase ou null.
 */
export async function fetchEquipmentUidAuditUnified(api, { useV2 = false } = {}) {
  if (!useV2 || typeof api?.v2EquipmentUidAudit !== 'function') return null;
  try {
    const response = await api.v2EquipmentUidAudit();
    return adaptV2AuditResponse(response);
  } catch (err) {
    if (!isFeatureDisabled(err)) {
      // eslint-disable-next-line no-console
      console.warn('[equipment-uid v2] fetchEquipmentUidAuditUnified: retour null', err);
    }
    return null;
  }
}

/**
 * @param {object} api - Client API.
 * @param {number} equipmentId
 * @param {{ reason?: string|null, useV2?: boolean }} [options]
 * @returns {Promise<object|null>} Rapport regeneration shape camelCase ou null.
 */
export async function regenerateEquipmentUidUnified(
  api,
  equipmentId,
  { reason = null, useV2 = false } = {},
) {
  if (!useV2 || typeof api?.v2RegenerateEquipmentUid !== 'function') return null;
  const id = Number(equipmentId);
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    const response = await api.v2RegenerateEquipmentUid(id, reason ? { reason } : {});
    return adaptV2RegenerateResponse(response);
  } catch (err) {
    if (!isFeatureDisabled(err)) {
      // eslint-disable-next-line no-console
      console.warn('[equipment-uid v2] regenerateEquipmentUidUnified: retour null', err);
    }
    return null;
  }
}
