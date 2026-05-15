// [S2-1] Helpers partages des modules commandes/devis/material-requests
// Extrait de ordersRoutes.js (transitions de statut + generateur de reference)

import db from '../database.js';

export const ORDER_TRANSITIONS = {
  draft: ['sent', 'cancelled'],
  sent: ['confirmed', 'cancelled'],
  confirmed: ['partial', 'received', 'cancelled'],
  partial: ['received'],
  received: [],
  cancelled: ['draft'],
};

export const QUOTE_TRANSITIONS = {
  draft: ['sent', 'cancelled'],
  sent: ['accepted', 'refused', 'cancelled'],
  accepted: [],
  refused: ['draft'],
  cancelled: ['draft'],
};

export function validateStatusTransition(transitions, from, to) {
  if (from === to) return true;
  const allowed = transitions[from];
  return allowed && allowed.includes(to);
}

// Genere une reference "PREFIX-YYYY-NNN" basee sur la derniere reference orders
export function generateReference(prefix) {
  const year = new Date().getFullYear();
  const last = db
    .prepare(`SELECT reference FROM orders WHERE reference LIKE ? ORDER BY reference DESC LIMIT 1`)
    .get(`${prefix}-${year}-%`);
  let num = 1;
  if (last) {
    const parts = last.reference.split('-');
    num = parseInt(parts[parts.length - 1] || '0', 10) + 1;
  }
  return `${prefix}-${year}-${String(num).padStart(3, '0')}`;
}
