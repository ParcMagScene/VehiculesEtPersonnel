// apps/web/src/utils/sav/v2Adapters.js
//
// Ticket : T-P1-07b (SAV v2 — fondations UI).
//
// Adapters + flag reader pour les endpoints v2 SAV enrichis :
//   - GET   /api/v2/sav/tickets/:id/parts
//   - POST  /api/v2/sav/tickets/:id/parts
//   - PATCH /api/v2/sav/parts/:id/status
//   - POST  /api/v2/sav/tickets/:id/transition

/**
 * Statuts pieces (miroir cote serveur, cf `SAV_PART_STATUSES`).
 * Duplique intentionnellement pour eviter tout import du backend.
 * @type {ReadonlyArray<string>}
 */
export const SAV_PART_STATUSES = Object.freeze([
  'requested',
  'ordered',
  'received',
  'installed',
  'cancelled',
]);

/**
 * Statuts ticket (miroir cote serveur, cf `SAV_STATUS`).
 * @type {ReadonlyArray<string>}
 */
export const SAV_TICKET_STATUSES = Object.freeze([
  'open',
  'in_progress',
  'waiting_parts',
  'resolved',
  'closed',
  'sortie_sav',
]);

/**
 * Normalise une piece SAV (snake -> camel).
 * @param {object|null|undefined} part
 * @returns {object|null}
 */
export function adaptSavPartV2ToV1(part) {
  if (!part || typeof part !== 'object') return null;
  return {
    id: part.id ?? null,
    ticketId: part.ticket_id ?? null,
    partName: part.part_name ?? null,
    partReference: part.part_reference ?? null,
    quantity: part.quantity ?? 1,
    unitPrice: part.unit_price ?? null,
    supplier: part.supplier ?? null,
    status: part.status ?? null,
    requestedAt: part.requested_at ?? null,
    orderedAt: part.ordered_at ?? null,
    receivedAt: part.received_at ?? null,
    installedAt: part.installed_at ?? null,
    cancelledAt: part.cancelled_at ?? null,
    notes: part.notes ?? null,
    createdBy: part.created_by ?? null,
    createdAt: part.created_at ?? null,
    modifiedBy: part.modified_by ?? null,
    modifiedAt: part.modified_at ?? null,
  };
}

/**
 * Normalise la reponse `v2ListSavParts` :
 *   { data: { parts: [...], total: N }, meta: {...} }
 * @param {object|null|undefined} v2Response
 * @returns {{ parts: Array<object>, total: number } | null}
 */
export function adaptV2SavPartsList(v2Response) {
  if (!v2Response || typeof v2Response !== 'object') return null;
  const data = v2Response.data;
  if (!data || typeof data !== 'object') return null;
  const raw = Array.isArray(data.parts) ? data.parts : [];
  const parts = raw.map(adaptSavPartV2ToV1).filter(Boolean);
  return { parts, total: Number(data.total ?? parts.length) };
}

/**
 * Normalise la reponse `v2TransitionSavTicket` (payload
 * `{ ticket: {...}, previous_status, new_status, transitioned_at }`).
 * Passthrough conservatif : renvoie `data` tel quel.
 * @param {object|null|undefined} v2Response
 * @returns {object|null}
 */
export function adaptV2TicketTransitionResponse(v2Response) {
  if (!v2Response || typeof v2Response !== 'object') return null;
  const data = v2Response.data;
  if (!data || typeof data !== 'object') return null;
  return data;
}

/**
 * Lit le flag client v2 pour SAV. Convention Vite :
 * `VITE_FEATURE_V2_SAV=1` -> true, sinon false.
 * @param {Record<string, string|undefined>} [env]
 * @returns {boolean}
 */
export function readSavV2ClientFlag(env) {
  const source = env ?? (typeof import.meta !== 'undefined' ? import.meta.env : {});
  const raw = source?.VITE_FEATURE_V2_SAV;
  if (raw === undefined || raw === null) return false;
  const value = String(raw).trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'yes';
}
