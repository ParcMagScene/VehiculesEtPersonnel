// apps/api/services/orders/conversion.js
//
// Ticket : T-P1-10 (Commandes v2 - conversion devis -> commande).
//
// Reprend la logique v1 (`orders/quotesRoutes.js#POST /convert`)
// en pure fonction transactionnelle avec typed errors et payload
// standardise. Le v1 reste actif.

import { OrdersV2ConflictError, OrdersV2NotFoundError, OrdersV2ValidationError } from './errors.js';

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {string} "BC-YYYY-NNN" nouvelle reference bon de commande.
 */
function generateOrderReference(db) {
  const year = new Date().getFullYear();
  const last = db
    .prepare('SELECT reference FROM orders WHERE reference LIKE ? ORDER BY id DESC LIMIT 1')
    .get(`BC-${year}-%`);
  let num = 1;
  if (last) {
    const parts = String(last.reference).split('-');
    num = parseInt(parts[2] || '0', 10) + 1;
  }
  return `BC-${year}-${String(num).padStart(3, '0')}`;
}

/**
 * Convertit un devis `accepted` en commande `draft`. Marque le
 * devis via `converted_to_order_id`.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.quoteId
 * @param {number|null} [params.createdBy]
 * @returns {{
 *   quote_id: number,
 *   order_id: number,
 *   order_reference: string,
 *   items_copied: number,
 * }}
 * @throws {OrdersV2ValidationError} si quoteId invalide.
 * @throws {OrdersV2NotFoundError} si devis absent.
 * @throws {OrdersV2ConflictError} si devis non-accepted ou deja
 *   converti.
 */
export function convertQuoteToOrder({ db, quoteId, createdBy = null } = {}) {
  if (!db) throw new OrdersV2ValidationError('db requis');
  const qid = Number(quoteId);
  if (!Number.isInteger(qid) || qid <= 0) {
    throw new OrdersV2ValidationError('quoteId doit etre un entier > 0');
  }
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(qid);
  if (!quote) {
    throw new OrdersV2NotFoundError(`Devis introuvable (id=${qid})`, { quoteId: qid });
  }
  if (quote.status !== 'accepted') {
    throw new OrdersV2ConflictError(
      `Seul un devis 'accepted' peut etre converti (actuel : '${quote.status}')`,
      { currentStatus: quote.status },
    );
  }
  if (quote.converted_to_order_id) {
    throw new OrdersV2ConflictError('Ce devis a deja ete converti en commande', {
      existingOrderId: quote.converted_to_order_id,
    });
  }

  const items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(qid);

  const tx = db.transaction(() => {
    const reference = generateOrderReference(db);
    const orderResult = db
      .prepare(
        `INSERT INTO orders (reference, type, affaire_id, status, order_date,
                              total_ht, tva_rate, total_ttc, notes, created_by)
         VALUES (?, 'purchase', ?, 'draft', ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        reference,
        quote.affaire_id ?? null,
        new Date().toISOString().slice(0, 10),
        quote.total_ht ?? 0,
        quote.tva_rate ?? 20,
        quote.total_ttc ?? 0,
        `Converti depuis devis ${quote.reference}`,
        createdBy,
      );
    const orderId = Number(orderResult.lastInsertRowid);
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, designation, quantity, unit,
                                unit_price_ht, tva_rate, total_ht, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const it of items) {
      insertItem.run(
        orderId,
        it.designation,
        it.quantity ?? 1,
        it.unit ?? 'u',
        it.unit_price_ht ?? 0,
        it.tva_rate ?? 20,
        it.total_ht ?? 0,
        it.notes ?? null,
      );
    }
    db.prepare(
      "UPDATE quotes SET converted_to_order_id = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(orderId, qid);
    return { orderId, reference };
  });

  const { orderId, reference } = tx();
  return {
    quote_id: qid,
    order_id: orderId,
    order_reference: reference,
    items_copied: items.length,
  };
}
