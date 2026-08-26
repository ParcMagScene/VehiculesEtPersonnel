// apps/api/services/orders/receptions.js
//
// Ticket : T-P1-10 (Commandes v2 - reception partielle detaillee).
//
// Contrat :
//   - recordItemReception : insere une ligne dans order_receptions,
//     incremente `order_items.received_qty`. Ne modifie PAS le
//     statut `orders.status` automatiquement (transition manuelle
//     via /api/v2/orders/:id/transition selon la matrice T-P1-09).
//   - Verifie que received_qty (cumul) ne depasse pas
//     order_items.quantity (409 CONFLICT si sur-reception).

import { OrdersV2ConflictError, OrdersV2NotFoundError, OrdersV2ValidationError } from './errors.js';

/**
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.orderId
 * @param {number} params.orderItemId
 * @param {number} params.receivedQty > 0.
 * @param {number|null} [params.receivedBy]
 * @param {string|null} [params.notes]
 * @returns {{
 *   reception: object,
 *   order_item: { id: number, quantity: number, received_qty: number, remaining: number, fully_received: boolean },
 * }}
 */
export function recordItemReception({
  db,
  orderId,
  orderItemId,
  receivedQty,
  receivedBy = null,
  notes = null,
} = {}) {
  if (!db) throw new OrdersV2ValidationError('db requis');
  const oid = Number(orderId);
  const iid = Number(orderItemId);
  if (!Number.isInteger(oid) || oid <= 0) {
    throw new OrdersV2ValidationError('orderId doit etre un entier > 0');
  }
  if (!Number.isInteger(iid) || iid <= 0) {
    throw new OrdersV2ValidationError('orderItemId doit etre un entier > 0');
  }
  const qty = Number(receivedQty);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new OrdersV2ValidationError('receivedQty doit etre un nombre > 0');
  }

  const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(oid);
  if (!order) throw new OrdersV2NotFoundError(`Commande introuvable (id=${oid})`, { orderId: oid });
  const item = db
    .prepare('SELECT id, order_id, quantity, received_qty FROM order_items WHERE id = ?')
    .get(iid);
  if (!item) {
    throw new OrdersV2NotFoundError(`Ligne commande introuvable (id=${iid})`, { orderItemId: iid });
  }
  if (item.order_id !== oid) {
    throw new OrdersV2ValidationError('order_item n appartient pas a cette commande', {
      order_item_owner: item.order_id,
    });
  }
  const alreadyReceived = Number(item.received_qty ?? 0);
  const totalExpected = Number(item.quantity ?? 0);
  const newTotal = alreadyReceived + qty;
  if (newTotal > totalExpected + 1e-9) {
    throw new OrdersV2ConflictError(
      `Sur-reception refusee : cumul ${newTotal} > commande ${totalExpected}`,
      {
        already_received: alreadyReceived,
        attempting_to_add: qty,
        max_allowed: totalExpected - alreadyReceived,
      },
    );
  }

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO order_receptions (order_id, order_item_id, received_qty, received_by, notes)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(oid, iid, qty, receivedBy, notes);
    db.prepare('UPDATE order_items SET received_qty = ? WHERE id = ?').run(newTotal, iid);
    return Number(info.lastInsertRowid);
  });
  const receptionId = tx();

  const reception = db.prepare('SELECT * FROM order_receptions WHERE id = ?').get(receptionId);
  return {
    reception,
    order_item: {
      id: iid,
      quantity: totalExpected,
      received_qty: newTotal,
      remaining: Math.max(0, totalExpected - newTotal),
      fully_received: newTotal >= totalExpected - 1e-9,
    },
  };
}

/**
 * Verifie l'etat global de reception d'une commande : toutes les
 * lignes fully_received -> `all_received=true` (proposition de
 * transition manuelle vers `received`).
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.orderId
 * @returns {{
 *   order_id: number,
 *   items_total: number,
 *   items_fully_received: number,
 *   items_partial: number,
 *   items_pending: number,
 *   all_received: boolean,
 *   any_received: boolean,
 * }}
 */
export function summarizeOrderReceptions({ db, orderId } = {}) {
  if (!db) throw new OrdersV2ValidationError('db requis');
  const oid = Number(orderId);
  if (!Number.isInteger(oid) || oid <= 0) {
    throw new OrdersV2ValidationError('orderId doit etre un entier > 0');
  }
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(oid);
  if (!order) throw new OrdersV2NotFoundError(`Commande introuvable (id=${oid})`, { orderId: oid });
  const items = db
    .prepare('SELECT id, quantity, received_qty FROM order_items WHERE order_id = ?')
    .all(oid);

  let fully = 0;
  let partial = 0;
  let pending = 0;
  for (const it of items) {
    const q = Number(it.quantity ?? 0);
    const r = Number(it.received_qty ?? 0);
    if (r >= q - 1e-9) fully += 1;
    else if (r > 0) partial += 1;
    else pending += 1;
  }
  return {
    order_id: oid,
    items_total: items.length,
    items_fully_received: fully,
    items_partial: partial,
    items_pending: pending,
    all_received: items.length > 0 && fully === items.length,
    any_received: fully > 0 || partial > 0,
  };
}
