#!/usr/bin/env node
/**
 * Tests unitaires — services/sav/* (T-P1-07).
 */

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import {
  addPart,
  ALLOWED_TRANSITIONS,
  assertTransition,
  getAllowedNext,
  isTransitionAllowed,
  listPartsForTicket,
  SAV_PART_STATUSES,
  SavV2ConflictError,
  SavV2NotFoundError,
  SavV2ValidationError,
  updatePartStatus,
} from '../../../apps/api/services/sav/index.js';

let db;

function setupSchema(database) {
  database.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);
    CREATE TABLE sav_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL DEFAULT 'open'
    );
    CREATE TABLE sav_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES sav_tickets(id) ON DELETE CASCADE,
      part_name TEXT NOT NULL,
      part_reference TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL,
      supplier TEXT,
      status TEXT NOT NULL DEFAULT 'requested',
      requested_at DATETIME NOT NULL DEFAULT (datetime('now')),
      ordered_at DATETIME,
      received_at DATETIME,
      installed_at DATETIME,
      cancelled_at DATETIME,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      modified_by INTEGER,
      modified_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

before(() => {
  db = new Database(':memory:');
  setupSchema(db);
});

after(() => db.close());

beforeEach(() => {
  db.exec('DELETE FROM sav_parts; DELETE FROM sav_tickets;');
});

describe('sav/stateMachine', () => {
  it('ALLOWED_TRANSITIONS est un dict frozen (top) avec Sets', () => {
    assert.ok(Object.isFrozen(ALLOWED_TRANSITIONS));
    for (const [from, set] of Object.entries(ALLOWED_TRANSITIONS)) {
      assert.ok(set instanceof Set, `${from} value is Set`);
    }
  });

  it('isTransitionAllowed : cas nominaux', () => {
    assert.equal(isTransitionAllowed('open', 'in_progress'), true);
    assert.equal(isTransitionAllowed('in_progress', 'waiting_parts'), true);
    assert.equal(isTransitionAllowed('waiting_parts', 'in_progress'), true);
    assert.equal(isTransitionAllowed('resolved', 'closed'), true);
    // Auto-transition autorisee (idempotent).
    assert.equal(isTransitionAllowed('open', 'open'), true);
  });

  it('isTransitionAllowed : cas interdits', () => {
    // open -> resolved directement : non (doit passer par in_progress).
    assert.equal(isTransitionAllowed('open', 'resolved'), false);
    // closed -> resolved : non.
    assert.equal(isTransitionAllowed('closed', 'resolved'), false);
    // Statut inconnu.
    assert.equal(isTransitionAllowed('foo', 'open'), false);
    assert.equal(isTransitionAllowed('open', 'foo'), false);
  });

  it('getAllowedNext', () => {
    const nextFromOpen = getAllowedNext('open');
    assert.ok(nextFromOpen.includes('in_progress'));
    assert.ok(nextFromOpen.includes('waiting_parts'));
    assert.equal(getAllowedNext('unknown').length, 0);
  });

  it('assertTransition : throw pour statut inconnu ou transition invalide', () => {
    assert.throws(() => assertTransition('foo', 'open'), SavV2ValidationError);
    assert.throws(() => assertTransition('open', 'foo'), SavV2ValidationError);
    assert.throws(() => assertTransition('open', 'resolved'), SavV2ConflictError);
    assert.doesNotThrow(() => assertTransition('open', 'in_progress'));
  });
});

describe('sav/parts — validation + CRUD', () => {
  it('SAV_PART_STATUSES est frozen', () => {
    assert.ok(Object.isFrozen(SAV_PART_STATUSES));
    assert.ok(SAV_PART_STATUSES.includes('requested'));
    assert.ok(SAV_PART_STATUSES.includes('installed'));
  });

  it('addPart : ticket inexistant -> NotFound', () => {
    assert.throws(
      () => addPart({ db, ticketId: 999, data: { part_name: 'X' } }),
      SavV2NotFoundError,
    );
  });

  it('addPart : validation part_name / quantity / unit_price', () => {
    const info = db.prepare("INSERT INTO sav_tickets (status) VALUES ('open')").run();
    const id = info.lastInsertRowid;
    assert.throws(() => addPart({ db, ticketId: id, data: {} }), SavV2ValidationError);
    assert.throws(
      () => addPart({ db, ticketId: id, data: { part_name: 'X', quantity: 0 } }),
      SavV2ValidationError,
    );
    assert.throws(
      () => addPart({ db, ticketId: id, data: { part_name: 'X', unit_price: 'not a number' } }),
      SavV2ValidationError,
    );
  });

  it('addPart : insere avec defaults + trim', () => {
    const info = db.prepare("INSERT INTO sav_tickets (status) VALUES ('open')").run();
    const id = info.lastInsertRowid;
    const p = addPart({
      db,
      ticketId: id,
      data: { part_name: '  Ampoule LED  ', part_reference: 'REF-01', supplier: 'ACME' },
      createdBy: 3,
    });
    assert.equal(p.part_name, 'Ampoule LED');
    assert.equal(p.part_reference, 'REF-01');
    assert.equal(p.quantity, 1);
    assert.equal(p.status, 'requested');
    assert.equal(p.created_by, 3);
  });

  it('listPartsForTicket : ordre desc + total', () => {
    const info = db.prepare("INSERT INTO sav_tickets (status) VALUES ('open')").run();
    const id = info.lastInsertRowid;
    addPart({ db, ticketId: id, data: { part_name: 'A' } });
    addPart({ db, ticketId: id, data: { part_name: 'B' } });
    const r = listPartsForTicket({ db, ticketId: id });
    assert.equal(r.total, 2);
    // Ordre desc par id (les 2 sont crees au meme datetime).
    assert.equal(r.parts[0].part_name, 'B');
  });
});

describe('sav/parts — updatePartStatus', () => {
  it('updatePartStatus : cycle requested -> ordered -> received -> installed', () => {
    const info = db.prepare("INSERT INTO sav_tickets (status) VALUES ('open')").run();
    const p = addPart({ db, ticketId: info.lastInsertRowid, data: { part_name: 'X' } });
    let updated = updatePartStatus({ db, partId: p.id, newStatus: 'ordered', modifiedBy: 5 });
    assert.equal(updated.status, 'ordered');
    assert.ok(updated.ordered_at);
    updated = updatePartStatus({ db, partId: p.id, newStatus: 'received' });
    assert.equal(updated.status, 'received');
    assert.ok(updated.received_at);
    updated = updatePartStatus({ db, partId: p.id, newStatus: 'installed' });
    assert.equal(updated.status, 'installed');
    assert.ok(updated.installed_at);
  });

  it('updatePartStatus : validation newStatus', () => {
    const info = db.prepare("INSERT INTO sav_tickets (status) VALUES ('open')").run();
    const p = addPart({ db, ticketId: info.lastInsertRowid, data: { part_name: 'X' } });
    assert.throws(
      () => updatePartStatus({ db, partId: p.id, newStatus: 'foo' }),
      SavV2ValidationError,
    );
  });

  it('updatePartStatus : NotFound si partId invalide', () => {
    assert.throws(
      () => updatePartStatus({ db, partId: 999, newStatus: 'ordered' }),
      SavV2NotFoundError,
    );
  });
});
