#!/usr/bin/env node
/**
 * Tests unitaires — services/orders/receptions + conversion (T-P1-10).
 */

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import {
  convertQuoteToOrder,
  OrdersV2ConflictError,
  OrdersV2NotFoundError,
  OrdersV2ValidationError,
  recordItemReception,
  summarizeOrderReceptions,
} from '../../../apps/api/services/orders/index.js';

let db;

function setupSchema(database) {
  database.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'purchase',
      affaire_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      order_date TEXT,
      total_ht REAL DEFAULT 0,
      tva_rate REAL DEFAULT 20,
      total_ttc REAL DEFAULT 0,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      designation TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT DEFAULT 'u',
      unit_price_ht REAL NOT NULL DEFAULT 0,
      tva_rate REAL DEFAULT 20,
      total_ht REAL DEFAULT 0,
      received_qty REAL DEFAULT 0,
      notes TEXT
    );
    CREATE TABLE order_receptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      order_item_id INTEGER NOT NULL,
      received_qty REAL NOT NULL,
      received_at DATETIME NOT NULL DEFAULT (datetime('now')),
      received_by INTEGER,
      notes TEXT,
      created_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL,
      affaire_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      total_ht REAL DEFAULT 0,
      tva_rate REAL DEFAULT 20,
      total_ttc REAL DEFAULT 0,
      converted_to_order_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE quote_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      designation TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT DEFAULT 'u',
      unit_price_ht REAL NOT NULL DEFAULT 0,
      tva_rate REAL DEFAULT 20,
      total_ht REAL DEFAULT 0,
      notes TEXT
    );
  `);
}

before(() => {
  db = new Database(':memory:');
  setupSchema(db);
});
after(() => db.close());
beforeEach(() => {
  db.exec(
    'DELETE FROM order_receptions; DELETE FROM order_items; DELETE FROM orders; DELETE FROM quote_items; DELETE FROM quotes;',
  );
});

function seedOrder({ items }) {
  const info = db
    .prepare("INSERT INTO orders (reference, status) VALUES ('BC-2026-001', 'draft')")
    .run();
  const orderId = info.lastInsertRowid;
  const itemIds = [];
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, designation, quantity) VALUES (?, ?, ?)',
  );
  for (const it of items) {
    const r = insertItem.run(orderId, it.designation, it.quantity);
    itemIds.push(Number(r.lastInsertRowid));
  }
  return { orderId, itemIds };
}

describe('orders/receptions/recordItemReception', () => {
  it('cree une reception partielle et incremente order_items.received_qty', () => {
    const { orderId, itemIds } = seedOrder({ items: [{ designation: 'A', quantity: 10 }] });
    const r = recordItemReception({
      db,
      orderId,
      orderItemId: itemIds[0],
      receivedQty: 3,
      receivedBy: 5,
      notes: 'Livraison 1',
    });
    assert.equal(r.reception.received_qty, 3);
    assert.equal(r.order_item.received_qty, 3);
    assert.equal(r.order_item.remaining, 7);
    assert.equal(r.order_item.fully_received, false);
    const persisted = db
      .prepare('SELECT received_qty FROM order_items WHERE id = ?')
      .get(itemIds[0]);
    assert.equal(persisted.received_qty, 3);
  });

  it('reception complete -> fully_received:true', () => {
    const { orderId, itemIds } = seedOrder({ items: [{ designation: 'A', quantity: 5 }] });
    const r = recordItemReception({ db, orderId, orderItemId: itemIds[0], receivedQty: 5 });
    assert.equal(r.order_item.fully_received, true);
    assert.equal(r.order_item.remaining, 0);
  });

  it('sur-reception -> Conflict', () => {
    const { orderId, itemIds } = seedOrder({ items: [{ designation: 'A', quantity: 5 }] });
    recordItemReception({ db, orderId, orderItemId: itemIds[0], receivedQty: 4 });
    assert.throws(
      () => recordItemReception({ db, orderId, orderItemId: itemIds[0], receivedQty: 2 }),
      OrdersV2ConflictError,
    );
  });

  it('item n appartient pas a la commande -> Validation', () => {
    const { itemIds } = seedOrder({ items: [{ designation: 'A', quantity: 5 }] });
    const other = seedOrder({ items: [{ designation: 'B', quantity: 5 }] });
    assert.throws(
      () =>
        recordItemReception({
          db,
          orderId: other.orderId,
          orderItemId: itemIds[0], // owned by first order
          receivedQty: 1,
        }),
      OrdersV2ValidationError,
    );
  });

  it('validation : receivedQty <= 0 -> Validation', () => {
    const { orderId, itemIds } = seedOrder({ items: [{ designation: 'A', quantity: 5 }] });
    assert.throws(
      () => recordItemReception({ db, orderId, orderItemId: itemIds[0], receivedQty: 0 }),
      OrdersV2ValidationError,
    );
  });

  it('order inexistant -> NotFound', () => {
    assert.throws(
      () => recordItemReception({ db, orderId: 999, orderItemId: 1, receivedQty: 1 }),
      OrdersV2NotFoundError,
    );
  });
});

describe('orders/receptions/summarizeOrderReceptions', () => {
  it('base 2 items, l un fully l autre partial', () => {
    const { orderId, itemIds } = seedOrder({
      items: [
        { designation: 'A', quantity: 5 },
        { designation: 'B', quantity: 10 },
      ],
    });
    recordItemReception({ db, orderId, orderItemId: itemIds[0], receivedQty: 5 });
    recordItemReception({ db, orderId, orderItemId: itemIds[1], receivedQty: 3 });
    const s = summarizeOrderReceptions({ db, orderId });
    assert.equal(s.items_total, 2);
    assert.equal(s.items_fully_received, 1);
    assert.equal(s.items_partial, 1);
    assert.equal(s.items_pending, 0);
    assert.equal(s.all_received, false);
    assert.equal(s.any_received, true);
  });

  it('all_received quand tout est complet', () => {
    const { orderId, itemIds } = seedOrder({ items: [{ designation: 'A', quantity: 2 }] });
    recordItemReception({ db, orderId, orderItemId: itemIds[0], receivedQty: 2 });
    const s = summarizeOrderReceptions({ db, orderId });
    assert.equal(s.all_received, true);
  });
});

describe('orders/conversion/convertQuoteToOrder', () => {
  function seedQuote({ status = 'accepted', converted = null, items = [] } = {}) {
    const info = db
      .prepare(
        "INSERT INTO quotes (reference, status, total_ht, tva_rate, total_ttc, converted_to_order_id) VALUES ('DEV-2026-001', ?, 100, 20, 120, ?)",
      )
      .run(status, converted);
    const qid = Number(info.lastInsertRowid);
    const insertItem = db.prepare(
      'INSERT INTO quote_items (quote_id, designation, quantity, unit_price_ht) VALUES (?, ?, ?, ?)',
    );
    for (const it of items) insertItem.run(qid, it.designation, it.quantity, it.price);
    return qid;
  }

  it('convertit devis accepted -> order draft + items copies', () => {
    const qid = seedQuote({
      items: [
        { designation: 'A', quantity: 2, price: 30 },
        { designation: 'B', quantity: 1, price: 40 },
      ],
    });
    const r = convertQuoteToOrder({ db, quoteId: qid, createdBy: 7 });
    assert.equal(r.quote_id, qid);
    assert.ok(r.order_id > 0);
    assert.match(r.order_reference, /^BC-\d{4}-\d{3}$/);
    assert.equal(r.items_copied, 2);
    // quote.converted_to_order_id mis a jour.
    const q = db.prepare('SELECT converted_to_order_id FROM quotes WHERE id = ?').get(qid);
    assert.equal(q.converted_to_order_id, r.order_id);
    // Items copies.
    const items = db
      .prepare('SELECT designation FROM order_items WHERE order_id = ?')
      .all(r.order_id);
    assert.equal(items.length, 2);
  });

  it('devis non accepted -> Conflict', () => {
    const qid = seedQuote({ status: 'draft' });
    assert.throws(() => convertQuoteToOrder({ db, quoteId: qid }), OrdersV2ConflictError);
  });

  it('devis deja converti -> Conflict', () => {
    const qid = seedQuote({ converted: 999 });
    assert.throws(() => convertQuoteToOrder({ db, quoteId: qid }), OrdersV2ConflictError);
  });

  it('devis inexistant -> NotFound', () => {
    assert.throws(() => convertQuoteToOrder({ db, quoteId: 9999 }), OrdersV2NotFoundError);
  });

  it('validation quoteId', () => {
    assert.throws(() => convertQuoteToOrder({ db, quoteId: 0 }), OrdersV2ValidationError);
  });
});
