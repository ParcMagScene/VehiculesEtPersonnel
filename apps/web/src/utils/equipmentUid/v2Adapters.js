// apps/web/src/utils/equipmentUid/v2Adapters.js
//
// Ticket : T-P1-06b (Equipment UID v2 — fondations UI admin).
//
// Adapters + flag reader pour les endpoints admin
// `/api/v2/equipment-uid/audit` et `/api/v2/equipment/:id/regenerate-uid`.

/**
 * Normalise une entree "doublon" (serial ou uid) : snake -> camel
 * + preservation de `ids` (Array<number>).
 * @param {object|null|undefined} entry
 * @returns {object|null}
 */
export function adaptDuplicateEntryV2ToV1(entry) {
  if (!entry || typeof entry !== 'object') return null;
  return {
    serialNumber: entry.serial_number ?? null,
    uid: entry.uid ?? null,
    count: Number(entry.count ?? 0),
    ids: Array.isArray(entry.ids) ? entry.ids.filter((n) => Number.isInteger(n)) : [],
  };
}

/**
 * Normalise la reponse `v2EquipmentUidAudit` :
 *   { data: {
 *       equipment_total, equipment_with_uid, equipment_without_uid,
 *       equipment_with_serial, duplicate_serials, duplicate_uids, verdict
 *     }, meta: {...} }
 * @param {object|null|undefined} v2Response
 * @returns {{
 *   equipmentTotal: number,
 *   equipmentWithUid: number,
 *   equipmentWithoutUid: number,
 *   equipmentWithSerial: number,
 *   duplicateSerials: Array<object>,
 *   duplicateUids: Array<object>,
 *   verdict: string|null,
 * } | null}
 */
export function adaptV2AuditResponse(v2Response) {
  if (!v2Response || typeof v2Response !== 'object') return null;
  const data = v2Response.data;
  if (!data || typeof data !== 'object') return null;
  return {
    equipmentTotal: Number(data.equipment_total ?? 0),
    equipmentWithUid: Number(data.equipment_with_uid ?? 0),
    equipmentWithoutUid: Number(data.equipment_without_uid ?? 0),
    equipmentWithSerial: Number(data.equipment_with_serial ?? 0),
    duplicateSerials: Array.isArray(data.duplicate_serials)
      ? data.duplicate_serials.map(adaptDuplicateEntryV2ToV1).filter(Boolean)
      : [],
    duplicateUids: Array.isArray(data.duplicate_uids)
      ? data.duplicate_uids.map(adaptDuplicateEntryV2ToV1).filter(Boolean)
      : [],
    verdict: typeof data.verdict === 'string' ? data.verdict : null,
  };
}

/**
 * Normalise la reponse `v2RegenerateEquipmentUid` :
 *   { data: { equipment_id, previous_uid, new_uid,
 *             regenerated_by, regenerated_at } }
 * @param {object|null|undefined} v2Response
 * @returns {{
 *   equipmentId: number,
 *   previousUid: string|null,
 *   newUid: string|null,
 *   regeneratedBy: number|null,
 *   regeneratedAt: string|null,
 * } | null}
 */
export function adaptV2RegenerateResponse(v2Response) {
  if (!v2Response || typeof v2Response !== 'object') return null;
  const data = v2Response.data;
  if (!data || typeof data !== 'object') return null;
  return {
    equipmentId: Number(data.equipment_id ?? 0) || null,
    previousUid: data.previous_uid ?? null,
    newUid: data.new_uid ?? null,
    regeneratedBy: data.regenerated_by ?? null,
    regeneratedAt: data.regenerated_at ?? null,
  };
}

/**
 * Lit le flag client v2 pour Equipment UID. Convention Vite :
 * `VITE_FEATURE_V2_EQUIPMENT_UID=1` -> true, sinon false.
 * @param {Record<string, string|undefined>} [env]
 * @returns {boolean}
 */
export function readEquipmentUidV2ClientFlag(env) {
  const source = env ?? (typeof import.meta !== 'undefined' ? import.meta.env : {});
  const raw = source?.VITE_FEATURE_V2_EQUIPMENT_UID;
  if (raw === undefined || raw === null) return false;
  const value = String(raw).trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'yes';
}
