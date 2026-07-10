#!/usr/bin/env node
/**
 * Tests unitaires — services/conflicts/detector (T-P1-05).
 *
 * DB in-memory + fixtures minimales. Couvre :
 *   - Validation (dates, personId, periods).
 *   - Source availabilities (approved only, chevauchement).
 *   - Source missions via mission_assignments (status filter).
 *   - Source task_assignments (date unique, status).
 *   - Exclusion (self-check).
 *   - Aucune source -> pas de conflit.
 */

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import {
  ConflictsV2ValidationError,
  detectPersonConflicts,
} from '../../../apps/api/services/conflicts/index.js';

let db;

function setupSchema(database) {
  database.exec(`
    CREATE TABLE persons (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT);
    CREATE TABLE availabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      start_period TEXT DEFAULT 'AM',
      end_period TEXT DEFAULT 'PM',
      type TEXT NOT NULL DEFAULT 'unavailable',
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'approved'
    );
    CREATE TABLE missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT
    );
    CREATE TABLE mission_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL,
      person_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'proposed',
      position TEXT
    );
    CREATE TABLE task_assignments (
      id TEXT PRIMARY KEY,
      person_id INTEGER,
      date TEXT NOT NULL,
      period TEXT,
      time TEXT,
      end_time TEXT,
      section TEXT,
      title TEXT,
      status TEXT DEFAULT 'pending'
    );
  `);
  database
    .prepare('INSERT INTO persons (id, first_name, last_name) VALUES (?, ?, ?)')
    .run(1, 'Alice', 'Test');
  database
    .prepare('INSERT INTO persons (id, first_name, last_name) VALUES (?, ?, ?)')
    .run(2, 'Bob', 'Other');
}

before(() => {
  db = new Database(':memory:');
  setupSchema(db);
});

after(() => db.close());

beforeEach(() => {
  db.exec(
    'DELETE FROM availabilities; DELETE FROM mission_assignments; DELETE FROM missions; DELETE FROM task_assignments;',
  );
});

describe('conflicts/detector — validation', () => {
  it('personId invalide -> throw', () => {
    assert.throws(
      () =>
        detectPersonConflicts({ db, personId: 0, startDate: '2026-01-01', endDate: '2026-01-01' }),
      ConflictsV2ValidationError,
    );
    assert.throws(
      () =>
        detectPersonConflicts({
          db,
          personId: 'x',
          startDate: '2026-01-01',
          endDate: '2026-01-01',
        }),
      ConflictsV2ValidationError,
    );
  });

  it('dates non ISO -> throw', () => {
    assert.throws(
      () => detectPersonConflicts({ db, personId: 1, startDate: 'foo', endDate: '2026-01-01' }),
      ConflictsV2ValidationError,
    );
  });

  it('endDate < startDate -> throw', () => {
    assert.throws(
      () =>
        detectPersonConflicts({ db, personId: 1, startDate: '2026-05-10', endDate: '2026-05-01' }),
      ConflictsV2ValidationError,
    );
  });

  it('period hors AM/PM -> throw', () => {
    assert.throws(
      () =>
        detectPersonConflicts({
          db,
          personId: 1,
          startDate: '2026-01-01',
          endDate: '2026-01-01',
          startPeriod: 'FOO',
        }),
      ConflictsV2ValidationError,
    );
  });
});

describe('conflicts/detector — availabilities', () => {
  it('approved chevauchant -> conflit', () => {
    db.prepare(
      "INSERT INTO availabilities (person_id, start_date, end_date, type, status, reason) VALUES (1, '2026-01-05', '2026-01-10', 'unavailable', 'approved', 'Vacances')",
    ).run();
    const r = detectPersonConflicts({
      db,
      personId: 1,
      startDate: '2026-01-08',
      endDate: '2026-01-12',
    });
    assert.equal(r.has_conflict, true);
    assert.equal(r.conflicts.length, 1);
    assert.equal(r.conflicts[0].source, 'availability');
    assert.match(r.conflicts[0].description, /Vacances/);
  });

  it('pending -> pas de conflit', () => {
    db.prepare(
      "INSERT INTO availabilities (person_id, start_date, end_date, type, status) VALUES (1, '2026-01-05', '2026-01-10', 'unavailable', 'pending')",
    ).run();
    const r = detectPersonConflicts({
      db,
      personId: 1,
      startDate: '2026-01-08',
      endDate: '2026-01-12',
    });
    assert.equal(r.has_conflict, false);
  });

  it('autre person -> pas de conflit', () => {
    db.prepare(
      "INSERT INTO availabilities (person_id, start_date, end_date, type, status) VALUES (2, '2026-01-05', '2026-01-10', 'unavailable', 'approved')",
    ).run();
    const r = detectPersonConflicts({
      db,
      personId: 1,
      startDate: '2026-01-08',
      endDate: '2026-01-12',
    });
    assert.equal(r.has_conflict, false);
  });

  it('sans chevauchement -> pas de conflit', () => {
    db.prepare(
      "INSERT INTO availabilities (person_id, start_date, end_date, type, status) VALUES (1, '2026-01-05', '2026-01-10', 'unavailable', 'approved')",
    ).run();
    const r = detectPersonConflicts({
      db,
      personId: 1,
      startDate: '2026-02-01',
      endDate: '2026-02-05',
    });
    assert.equal(r.has_conflict, false);
  });
});

describe('conflicts/detector — missions', () => {
  it('mission proposed chevauchant -> conflit', () => {
    const mi = db
      .prepare(
        "INSERT INTO missions (title, start_date, end_date) VALUES ('Concert X', '2026-03-10', '2026-03-12')",
      )
      .run();
    db.prepare(
      'INSERT INTO mission_assignments (mission_id, person_id, status) VALUES (?, 1, ?)',
    ).run(mi.lastInsertRowid, 'proposed');
    const r = detectPersonConflicts({
      db,
      personId: 1,
      startDate: '2026-03-11',
      endDate: '2026-03-15',
    });
    assert.equal(r.has_conflict, true);
    assert.equal(r.conflicts[0].source, 'mission');
    assert.match(r.conflicts[0].description, /Concert X/);
  });

  it('mission declined -> pas de conflit', () => {
    const mi = db
      .prepare(
        "INSERT INTO missions (title, start_date, end_date) VALUES ('Concert Y', '2026-03-10', '2026-03-12')",
      )
      .run();
    db.prepare(
      'INSERT INTO mission_assignments (mission_id, person_id, status) VALUES (?, 1, ?)',
    ).run(mi.lastInsertRowid, 'declined');
    const r = detectPersonConflicts({
      db,
      personId: 1,
      startDate: '2026-03-11',
      endDate: '2026-03-15',
    });
    assert.equal(r.has_conflict, false);
  });
});

describe('conflicts/detector — task_assignments', () => {
  it('task dans la periode + status pending -> conflit', () => {
    db.prepare(
      "INSERT INTO task_assignments (id, person_id, date, period, title, status) VALUES ('t1', 1, '2026-04-15', 'AM', 'Chargement', 'pending')",
    ).run();
    const r = detectPersonConflicts({
      db,
      personId: 1,
      startDate: '2026-04-10',
      endDate: '2026-04-20',
    });
    assert.equal(r.has_conflict, true);
    assert.equal(r.conflicts[0].source, 'task');
    assert.match(r.conflicts[0].description, /Chargement/);
  });

  it('task cancelled -> pas de conflit', () => {
    db.prepare(
      "INSERT INTO task_assignments (id, person_id, date, title, status) VALUES ('t2', 1, '2026-04-15', 'Retour', 'cancelled')",
    ).run();
    const r = detectPersonConflicts({
      db,
      personId: 1,
      startDate: '2026-04-10',
      endDate: '2026-04-20',
    });
    assert.equal(r.has_conflict, false);
  });
});

describe('conflicts/detector — exclude (self-check)', () => {
  it('exclusion d une availability existante lors d un update', () => {
    const info = db
      .prepare(
        "INSERT INTO availabilities (person_id, start_date, end_date, type, status) VALUES (1, '2026-05-01', '2026-05-05', 'unavailable', 'approved')",
      )
      .run();
    const r = detectPersonConflicts({
      db,
      personId: 1,
      startDate: '2026-05-02',
      endDate: '2026-05-04',
      exclude: [{ entity_type: 'availability', entity_id: info.lastInsertRowid }],
    });
    assert.equal(r.has_conflict, false);
  });
});

describe('conflicts/detector — multi-source', () => {
  it('cumule tous les conflits des 3 sources', () => {
    db.prepare(
      "INSERT INTO availabilities (person_id, start_date, end_date, type, status, reason) VALUES (1, '2026-06-01', '2026-06-03', 'unavailable', 'approved', 'RTT')",
    ).run();
    const mi = db
      .prepare(
        "INSERT INTO missions (title, start_date, end_date) VALUES ('Mission Ete', '2026-06-02', '2026-06-04')",
      )
      .run();
    db.prepare(
      'INSERT INTO mission_assignments (mission_id, person_id, status) VALUES (?, 1, ?)',
    ).run(mi.lastInsertRowid, 'confirmed');
    db.prepare(
      "INSERT INTO task_assignments (id, person_id, date, title, status) VALUES ('t3', 1, '2026-06-02', 'Rappel', 'pending')",
    ).run();

    const r = detectPersonConflicts({
      db,
      personId: 1,
      startDate: '2026-06-01',
      endDate: '2026-06-05',
    });
    assert.equal(r.count, 3);
    const sources = r.conflicts.map((c) => c.source).sort();
    assert.deepEqual(sources, ['availability', 'mission', 'task']);
  });
});
