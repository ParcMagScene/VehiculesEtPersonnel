// apps/web/src/utils/orders/v2Adapters.js
//
// Ticket : T-P1-09b / T-P1-10b (Orders v2 — fondations UI).
//
// Adapters + flag reader + matrices statuts pour les endpoints v2 :
//   - POST /api/v2/orders/:id/transition          (T-P1-09)
//   - POST /api/v2/quotes/:id/transition          (T-P1-09)
//   - POST /api/v2/orders/:id/receptions          (T-P1-10)
//   - GET  /api/v2/orders/:id/receptions/summary  (T-P1-10)
//   - POST /api/v2/quotes/:id/convert-to-order    (T-P1-10)

/**
 * Matrice ORDER_TRANSITIONS (miroir cote serveur,
 * cf `apps/api/orders/_helpers.js`). Duplique intentionnellement
 * pour eviter tout import backend cote frontend.
 * @type {Readonly<Record<string, ReadonlyArray<string>>>}
 */
export const ORDER_TRANSITIONS = Object.freeze({
  draft: Object.freeze(['sent', 'cancelled']),
  sent: Object.freeze(['confirmed', 'cancelled']),
  confirmed: Object.freeze(['partial', 'received', 'cancelled']),
  partial: Object.freeze(['received']),
  received: Object.freeze([]),
  cancelled: Object.freeze(['draft']),
});

/**
 * Matrice QUOTE_TRANSITIONS.
 * @type {Readonly<Record<string, ReadonlyArray<string>>>}
 */
export const QUOTE_TRANSITIONS = Object.freeze({
  draft: Object.freeze(['sent', 'cancelled']),
  sent: Object.freeze(['accepted', 'refused', 'cancelled']),
  accepted: Object.freeze([]),
  refused: Object.freeze(['draft']),
  cancelled: Object.freeze(['draft']),
});

/** @type {ReadonlyArray<string>} */
export const ORDER_STATUSES = Object.freeze(Object.keys(ORDER_TRANSITIONS));
/** @type {ReadonlyArray<string>} */
export const QUOTE_STATUSES = Object.freeze(Object.keys(QUOTE_TRANSITIONS));

/**
 * Retourne la liste des transitions autorisees depuis `from`.
 * @param {string} from
 * @param {'order'|'quote'} kind
 * @returns {string[]}
 */
export function getAllowedNext(from, kind = 'order') {
  const table = kind === 'quote' ? QUOTE_TRANSITIONS : ORDER_TRANSITIONS;
  const arr = table[from];
  return Array.isArray(arr) ? [...arr] : [];
}

/**
 * Verifie si une transition est autorisee (mirror serveur).
 * @param {string} from
 * @param {string} to
 * @param {'order'|'quote'} kind
 * @returns {boolean}
 */
export function isTransitionAllowed(from, to, kind = 'order') {
  if (from === to) return true;
  return getAllowedNext(from, kind).includes(to);
}

/**
 * Normalise la reponse `v2TransitionOrder` / `v2TransitionQuote`.
 * Passthrough conservatif : renvoie `data` tel quel.
 * @param {object|null|undefined} v2Response
 * @returns {object|null}
 */
export function adaptV2TransitionResponse(v2Response) {
  if (!v2Response || typeof v2Response !== 'object') return null;
  const data = v2Response.data;
  if (!data || typeof data !== 'object') return null;
  return data;
}

/**
 * Adapte la reponse `v2RecordOrderReception` :
 *   { data: { reception, order_items: [...], order: {...} } }
 * On extrait le triplet + normalisation snake->camel pour la
 * reception seule (order_item_id, received_qty, notes).
 * @param {object|null|undefined} v2Response
 * @returns {{
 *   reception: object|null,
 *   orderItems: Array<object>,
 *   order: object|null
 * } | null}
 */
export function adaptV2ReceptionResponse(v2Response) {
  if (!v2Response || typeof v2Response !== 'object') return null;
  const data = v2Response.data;
  if (!data || typeof data !== 'object') return null;
  const raw = data.reception;
  const reception =
    raw && typeof raw === 'object'
      ? {
          id: raw.id ?? null,
          orderId: raw.order_id ?? null,
          orderItemId: raw.order_item_id ?? null,
          receivedQty: raw.received_qty ?? 0,
          notes: raw.notes ?? null,
          receivedBy: raw.received_by ?? null,
          receivedAt: raw.received_at ?? null,
        }
      : null;
  return {
    reception,
    orderItems: Array.isArray(data.order_items) ? data.order_items : [],
    order: data.order ?? null,
  };
}

/**
 * Adapte la reponse `v2GetOrderReceptionsSummary` :
 *   { data: { summary: [...], all_received: bool, total_ordered, total_received } }
 * @param {object|null|undefined} v2Response
 * @returns {{
 *   summary: Array<object>,
 *   allReceived: boolean,
 *   totalOrdered: number,
 *   totalReceived: number,
 * } | null}
 */
export function adaptV2ReceptionsSummary(v2Response) {
  if (!v2Response || typeof v2Response !== 'object') return null;
  const data = v2Response.data;
  if (!data || typeof data !== 'object') return null;
  return {
    summary: Array.isArray(data.summary) ? data.summary : [],
    allReceived: Boolean(data.all_received),
    totalOrdered: Number(data.total_ordered ?? 0),
    totalReceived: Number(data.total_received ?? 0),
  };
}

/**
 * Adapte la reponse `v2ConvertQuoteToOrder` :
 *   { data: { quote: {...}, order: {...} } }
 * Passthrough : les 2 objets sont deja shape complet.
 * @param {object|null|undefined} v2Response
 * @returns {{ quote: object|null, order: object|null } | null}
 */
export function adaptV2ConvertResponse(v2Response) {
  if (!v2Response || typeof v2Response !== 'object') return null;
  const data = v2Response.data;
  if (!data || typeof data !== 'object') return null;
  return { quote: data.quote ?? null, order: data.order ?? null };
}

/**
 * Detecte le conflit metier serveur (409 CONFLICT). Utilise pour
 * la transition interdite (ex : `received` -> `draft`).
 * @param {unknown} err
 * @returns {boolean}
 */
export function isTransitionConflict(err) {
  if (!err || typeof err !== 'object') return false;
  const code = err.code || err.details?.code;
  const status = err.status || err.details?.status;
  return code === 'CONFLICT' || status === 409;
}

/**
 * Lit le flag client v2 pour Orders. Convention Vite :
 * `VITE_FEATURE_V2_ORDERS=1` -> true, sinon false.
 * @param {Record<string, string|undefined>} [env]
 * @returns {boolean}
 */
export function readOrdersV2ClientFlag(env) {
  const source = env ?? (typeof import.meta !== 'undefined' ? import.meta.env : {});
  const raw = source?.VITE_FEATURE_V2_ORDERS;
  if (raw === undefined || raw === null) return false;
  const value = String(raw).trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'yes';
}
