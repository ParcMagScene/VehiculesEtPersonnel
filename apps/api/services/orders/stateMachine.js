// apps/api/services/orders/stateMachine.js
//
// Ticket : T-P1-09 (Commandes v2 - cycle achat).
//
// Reutilise les matrices `ORDER_TRANSITIONS` et `QUOTE_TRANSITIONS`
// deja definies dans `orders/_helpers.js` (v1). Fournit un wrapper
// avec typed errors pour le namespace v2.
//
// La v1 (`ordersRoutes.js`) applique deja les memes transitions
// via `validateStatusTransition`. Le v2 rejoue la validation mais
// avec un contrat de reponse standardise `{success, data, meta}`.

import {
  ORDER_TRANSITIONS,
  QUOTE_TRANSITIONS,
  validateStatusTransition,
} from '../../orders/_helpers.js';
import { OrdersV2ConflictError, OrdersV2ValidationError } from './errors.js';

export { ORDER_TRANSITIONS, QUOTE_TRANSITIONS };

/** Statuts valides d'une commande. @type {ReadonlyArray<string>} */
export const ORDER_STATUSES = Object.freeze(Object.keys(ORDER_TRANSITIONS));

/** Statuts valides d'un devis. @type {ReadonlyArray<string>} */
export const QUOTE_STATUSES = Object.freeze(Object.keys(QUOTE_TRANSITIONS));

/**
 * @param {string} from
 * @param {string} to
 * @param {'order'|'quote'} kind
 * @returns {string[]} Liste des transitions autorisees (vide si inconnu).
 */
export function getAllowedNext(from, kind) {
  const table = kind === 'quote' ? QUOTE_TRANSITIONS : ORDER_TRANSITIONS;
  const arr = table[from];
  return Array.isArray(arr) ? [...arr] : [];
}

/**
 * @param {string} from
 * @param {string} to
 * @param {'order'|'quote'} kind
 * @throws {OrdersV2ValidationError} statut inconnu.
 * @throws {OrdersV2ConflictError} transition interdite.
 */
export function assertTransition(from, to, kind = 'order') {
  const table = kind === 'quote' ? QUOTE_TRANSITIONS : ORDER_TRANSITIONS;
  const validStatuses = Object.keys(table);
  if (!validStatuses.includes(from)) {
    throw new OrdersV2ValidationError(`Statut source ${kind} inconnu : ${from}`, { from, kind });
  }
  if (!validStatuses.includes(to)) {
    throw new OrdersV2ValidationError(`Statut cible ${kind} inconnu : ${to}`, { to, kind });
  }
  if (!validateStatusTransition(table, from, to)) {
    throw new OrdersV2ConflictError(`Transition ${kind} interdite : ${from} -> ${to}`, {
      from,
      to,
      kind,
      allowed: getAllowedNext(from, kind),
    });
  }
}
