#!/usr/bin/env node
/**
 * Tests unitaires — services/orders/* (T-P1-09).
 */

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import {
  assertTransition,
  getAllowedNext,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  OrdersV2ConflictError,
  OrdersV2NotFoundError,
  OrdersV2ValidationError,
  QUOTE_STATUSES,
  QUOTE_TRANSITIONS,
  transitionOrder,
  transitionQuote,
} from '../../../apps/api/services/orders/index.js';

let db;

function setupSchema(database) {
  database.exec(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

before(() => {
  db = new Database(':memory:');
  setupSchema(db);
});
after(() => db.close());
beforeEach(() => {
  db.exec('DELETE FROM orders; DELETE FROM quotes;');
});

describe('orders/stateMachine', () => {
  it('ORDER_STATUSES + QUOTE_STATUSES frozen + non vide', () => {
    assert.ok(Object.isFrozen(ORDER_STATUSES));
    assert.ok(ORDER_STATUSES.length > 0);
    assert.ok(Object.isFrozen(QUOTE_STATUSES));
    assert.ok(QUOTE_STATUSES.includes('accepted'));
  });

  it('assertTransition order : draft -> sent OK', () => {
    assert.doesNotThrow(() => assertTransition('draft', 'sent', 'order'));
  });

  it('assertTransition order : draft -> received interdit', () => {
    assert.throws(() => assertTransition('draft', 'received', 'order'), OrdersV2ConflictError);
  });

  it('assertTransition order : from === to autorise (idempotent)', () => {
    // validateStatusTransition retourne true si from===to.
    assert.doesNotThrow(() => assertTransition('draft', 'draft', 'order'));
  });

  it('assertTransition statut inconnu -> Validation', () => {
    assert.throws(() => assertTransition('foo', 'sent', 'order'), OrdersV2ValidationError);
    assert.throws(() => assertTransition('draft', 'foo', 'order'), OrdersV2ValidationError);
  });

  it('assertTransition quote : sent -> accepted OK', () => {
    assert.doesNotThrow(() => assertTransition('sent', 'accepted', 'quote'));
  });

  it('assertTransition quote : draft -> accepted interdit', () => {
    assert.throws(() => assertTransition('draft', 'accepted', 'quote'), OrdersV2ConflictError);
  });

  it('getAllowedNext contient les transitions attendues', () => {
    const nextFromDraft = getAllowedNext('draft', 'order');
    assert.ok(nextFromDraft.includes('sent'));
    assert.ok(nextFromDraft.includes('cancelled'));
    assert.equal(getAllowedNext('unknown', 'order').length, 0);
  });

  it('ORDER_TRANSITIONS.received = [] (etat final)', () => {
    assert.equal(ORDER_TRANSITIONS.received.length, 0);
  });

  it('QUOTE_TRANSITIONS.accepted = [] (etat final)', () => {
    assert.equal(QUOTE_TRANSITIONS.accepted.length, 0);
  });
});

describe('orders/transitions/transitionOrder', () => {
  it('draft -> sent : succes + changed:true', () => {
    const info = db
      .prepare("INSERT INTO orders (reference, status) VALUES ('CMD-001', 'draft')")
      .run();
    const r = transitionOrder({ db, orderId: info.lastInsertRowid, newStatus: 'sent' });
    assert.equal(r.previous_status, 'draft');
    assert.equal(r.new_status, 'sent');
    assert.equal(r.changed, true);
    const persisted = db
      .prepare('SELECT status FROM orders WHERE id = ?')
      .get(info.lastInsertRowid);
    assert.equal(persisted.status, 'sent');
  });

  it('idempotent : draft -> draft ne persiste rien mais renvoie changed:false', () => {
    const info = db
      .prepare("INSERT INTO orders (reference, status) VALUES ('CMD-002', 'draft')")
      .run();
    const r = transitionOrder({ db, orderId: info.lastInsertRowid, newStatus: 'draft' });
    assert.equal(r.changed, false);
  });

  it('transition interdite -> Conflict', () => {
    const info = db
      .prepare("INSERT INTO orders (reference, status) VALUES ('CMD-003', 'draft')")
      .run();
    assert.throws(
      () => transitionOrder({ db, orderId: info.lastInsertRowid, newStatus: 'received' }),
      OrdersV2ConflictError,
    );
  });

  it('order inexistant -> NotFound', () => {
    assert.throws(
      () => transitionOrder({ db, orderId: 999, newStatus: 'sent' }),
      OrdersV2NotFoundError,
    );
  });

  it('validation orderId + newStatus', () => {
    assert.throws(
      () => transitionOrder({ db, orderId: 0, newStatus: 'sent' }),
      OrdersV2ValidationError,
    );
    assert.throws(
      () => transitionOrder({ db, orderId: 1, newStatus: null }),
      OrdersV2ValidationError,
    );
  });
});

describe('orders/transitions/transitionQuote', () => {
  it('sent -> accepted : succes', () => {
    const info = db
      .prepare("INSERT INTO quotes (reference, status) VALUES ('DEV-001', 'sent')")
      .run();
    const r = transitionQuote({ db, quoteId: info.lastInsertRowid, newStatus: 'accepted' });
    assert.equal(r.new_status, 'accepted');
    assert.equal(r.changed, true);
  });

  it('draft -> accepted -> Conflict', () => {
    const info = db
      .prepare("INSERT INTO quotes (reference, status) VALUES ('DEV-002', 'draft')")
      .run();
    assert.throws(
      () => transitionQuote({ db, quoteId: info.lastInsertRowid, newStatus: 'accepted' }),
      OrdersV2ConflictError,
    );
  });

  it('quote inexistant -> NotFound', () => {
    assert.throws(
      () => transitionQuote({ db, quoteId: 999, newStatus: 'sent' }),
      OrdersV2NotFoundError,
    );
  });
});
