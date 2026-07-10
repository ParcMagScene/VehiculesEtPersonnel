// apps/api/services/orders/transitions.js
//
// Ticket : T-P1-09. Applique une transition sur `orders.status` ou
// `quotes.status` en validant via la machine d'etat.

import { OrdersV2NotFoundError, OrdersV2ValidationError } from './errors.js';
import { assertTransition } from './stateMachine.js';

/**
 * Applique une transition sur une commande.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.orderId
 * @param {string} params.newStatus
 * @returns {{ order_id: number, previous_status: string, new_status: string, changed: boolean }}
 */
export function transitionOrder({ db, orderId, newStatus } = {}) {
  if (!db) throw new OrdersV2ValidationError('db requis');
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new OrdersV2ValidationError('orderId doit etre un entier > 0');
  }
  if (!newStatus || typeof newStatus !== 'string') {
    throw new OrdersV2ValidationError('newStatus requis');
  }
  const current = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(id);
  if (!current) {
    throw new OrdersV2NotFoundError(`Commande introuvable (id=${id})`, { orderId: id });
  }
  assertTransition(current.status, newStatus, 'order');
  const changed = current.status !== newStatus;
  if (changed) {
    db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
      newStatus,
      id,
    );
  }
  return {
    order_id: id,
    previous_status: current.status,
    new_status: newStatus,
    changed,
  };
}

/**
 * Applique une transition sur un devis.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.quoteId
 * @param {string} params.newStatus
 * @returns {{ quote_id: number, previous_status: string, new_status: string, changed: boolean }}
 */
export function transitionQuote({ db, quoteId, newStatus } = {}) {
  if (!db) throw new OrdersV2ValidationError('db requis');
  const id = Number(quoteId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new OrdersV2ValidationError('quoteId doit etre un entier > 0');
  }
  if (!newStatus || typeof newStatus !== 'string') {
    throw new OrdersV2ValidationError('newStatus requis');
  }
  const current = db.prepare('SELECT id, status FROM quotes WHERE id = ?').get(id);
  if (!current) {
    throw new OrdersV2NotFoundError(`Devis introuvable (id=${id})`, { quoteId: id });
  }
  assertTransition(current.status, newStatus, 'quote');
  const changed = current.status !== newStatus;
  if (changed) {
    db.prepare("UPDATE quotes SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
      newStatus,
      id,
    );
  }
  return {
    quote_id: id,
    previous_status: current.status,
    new_status: newStatus,
    changed,
  };
}
