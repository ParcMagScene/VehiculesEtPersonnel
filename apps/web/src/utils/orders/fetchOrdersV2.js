// apps/web/src/utils/orders/fetchOrdersV2.js
//
// Ticket : T-P1-09b / T-P1-10b (Orders v2 — fondations UI).
//
// Helpers unifies pour les 5 endpoints v2 orders :
//   - transitionOrder / transitionQuote (contrat etendu conflict/error)
//   - recordOrderReception (T-P1-10)
//   - fetchOrderReceptionsSummary (T-P1-10)
//   - convertQuoteToOrder (T-P1-10)

import {
  adaptV2ConvertResponse,
  adaptV2ReceptionResponse,
  adaptV2ReceptionsSummary,
  adaptV2TransitionResponse,
  isTransitionConflict,
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
 * Transitionne un devis ou une commande via v2.
 * Contrat de retour aligne sur `createEquipmentAssignmentUnified`
 * (T-P1-08b) : distinction conflit metier / autres erreurs.
 *
 *   - `{ ok: true, data }` sur succes (payload adapte).
 *   - `{ ok: false, conflict: true, error }` sur 409 CONFLICT
 *     (transition interdite).
 *   - `{ ok: false, conflict: false, error }` sur autre erreur.
 *   - `null` si v2 indisponible.
 *
 * @param {object} api
 * @param {number} id
 * @param {string} status
 * @param {{ kind?: 'order'|'quote', useV2?: boolean }} [options]
 * @returns {Promise<
 *   | { ok: true, data: object|null }
 *   | { ok: false, conflict: boolean, error: unknown }
 *   | null
 * >}
 */
export async function transitionOrderOrQuoteUnified(
  api,
  id,
  status,
  { kind = 'order', useV2 = false } = {},
) {
  const method = kind === 'quote' ? 'v2TransitionQuote' : 'v2TransitionOrder';
  if (!useV2 || typeof api?.[method] !== 'function') return null;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  if (typeof status !== 'string' || status === '') return null;

  try {
    const response = await api[method](n, status);
    return { ok: true, data: adaptV2TransitionResponse(response) };
  } catch (err) {
    if (isFeatureDisabled(err)) return null;
    return { ok: false, conflict: isTransitionConflict(err), error: err };
  }
}

/**
 * Enregistre une reception partielle ou totale sur un item de
 * commande.
 * @param {object} api
 * @param {number} orderId
 * @param {{ orderItemId: number, receivedQty: number, notes?: string }} data
 * @param {{ useV2?: boolean }} [options]
 * @returns {Promise<
 *   | { ok: true, reception: object|null, orderItems: Array<object>, order: object|null }
 *   | { ok: false, conflict: boolean, error: unknown }
 *   | null
 * >}
 */
export async function recordOrderReceptionUnified(api, orderId, data, { useV2 = false } = {}) {
  if (!useV2 || typeof api?.v2RecordOrderReception !== 'function') return null;
  const oid = Number(orderId);
  if (!Number.isInteger(oid) || oid <= 0) return null;
  if (!data || !Number.isInteger(Number(data.orderItemId)) || Number(data.orderItemId) <= 0) {
    return null;
  }
  const qty = Number(data.receivedQty);
  if (!Number.isFinite(qty) || qty <= 0) return null;

  const body = {
    order_item_id: Number(data.orderItemId),
    received_qty: qty,
  };
  if (data.notes) body.notes = String(data.notes);

  try {
    const response = await api.v2RecordOrderReception(oid, body);
    const adapted = adaptV2ReceptionResponse(response);
    return {
      ok: true,
      reception: adapted?.reception ?? null,
      orderItems: adapted?.orderItems ?? [],
      order: adapted?.order ?? null,
    };
  } catch (err) {
    if (isFeatureDisabled(err)) return null;
    return { ok: false, conflict: isTransitionConflict(err), error: err };
  }
}

/**
 * @param {object} api
 * @param {number} orderId
 * @param {{ useV2?: boolean }} [options]
 * @returns {Promise<{
 *   summary: Array<object>,
 *   allReceived: boolean,
 *   totalOrdered: number,
 *   totalReceived: number,
 * } | null>}
 */
export async function fetchOrderReceptionsSummaryUnified(api, orderId, { useV2 = false } = {}) {
  if (!useV2 || typeof api?.v2GetOrderReceptionsSummary !== 'function') return null;
  const oid = Number(orderId);
  if (!Number.isInteger(oid) || oid <= 0) return null;
  try {
    const response = await api.v2GetOrderReceptionsSummary(oid);
    return adaptV2ReceptionsSummary(response);
  } catch (err) {
    if (!isFeatureDisabled(err)) {
      // eslint-disable-next-line no-console
      console.warn('[orders v2] fetchOrderReceptionsSummaryUnified: retour null', err);
    }
    return null;
  }
}

/**
 * @param {object} api
 * @param {number} quoteId
 * @param {{ useV2?: boolean }} [options]
 * @returns {Promise<
 *   | { ok: true, quote: object|null, order: object|null }
 *   | { ok: false, conflict: boolean, error: unknown }
 *   | null
 * >}
 */
export async function convertQuoteToOrderUnified(api, quoteId, { useV2 = false } = {}) {
  if (!useV2 || typeof api?.v2ConvertQuoteToOrder !== 'function') return null;
  const qid = Number(quoteId);
  if (!Number.isInteger(qid) || qid <= 0) return null;
  try {
    const response = await api.v2ConvertQuoteToOrder(qid);
    const adapted = adaptV2ConvertResponse(response);
    return {
      ok: true,
      quote: adapted?.quote ?? null,
      order: adapted?.order ?? null,
    };
  } catch (err) {
    if (isFeatureDisabled(err)) return null;
    return { ok: false, conflict: isTransitionConflict(err), error: err };
  }
}
