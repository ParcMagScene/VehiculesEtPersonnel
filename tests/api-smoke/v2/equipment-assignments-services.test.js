#!/usr/bin/env node
/**
 * Tests unitaires — services/equipment-assignments/* (T-P1-08).
 */

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import {
  createAssignmentSafe,
  EqAssignV2ConflictError,
  EqAssignV2NotFoundError,
  EqAssignV2ValidationError,
  findConflictingActiveAssignments,
  getAssignmentHistory,
  releaseAssignment,
} from '../../../apps/api/services/equipment-assignments/index.js';

let db;

function setupSchema(database) {
  database.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);
    CREATE TABLE persons (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);
    CREATE TABLE equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
    CREATE TABLE equipment_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL,
      assigned_to INTEGER,
      assigned_by INTEGER,
      start_date TEXT NOT NULL,
      end_date TEXT,
      affaire_id TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE equipment_assignment_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      equipment_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      previous_assigned_to INTEGER,
      new_assigned_to INTEGER,
      previous_start_date TEXT,
      new_start_date TEXT,
      previous_end_date TEXT,
      new_end_date TEXT,
      notes TEXT,
      changed_by INTEGER,
      changed_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );
  `);
  database.prepare('INSERT INTO equipment (id, name) VALUES (1, ?)').run('Console');
  database.prepare('INSERT INTO equipment (id, name) VALUES (2, ?)').run('Micro');
  database.prepare('INSERT INTO persons (id, name) VALUES (?, ?)').run(10, 'Alice');
  database.prepare('INSERT INTO persons (id, name) VALUES (?, ?)').run(20, 'Bob');
}

before(() => {
  db = new Database(':memory:');
  setupSchema(db);
});

after(() => db.close());

beforeEach(() => {
  db.exec('DELETE FROM equipment_assignment_history; DELETE FROM equipment_assignments;');
});

describe('assignments/createAssignmentSafe', () => {
  it('validation stricte', () => {
    assert.throws(
      () => createAssignmentSafe({ db, equipmentId: 0, startDate: '2026-01-01' }),
      EqAssignV2ValidationError,
    );
    assert.throws(
      () => createAssignmentSafe({ db, equipmentId: 1, startDate: 'foo' }),
      EqAssignV2ValidationError,
    );
    assert.throws(
      () =>
        createAssignmentSafe({
          db,
          equipmentId: 1,
          startDate: '2026-05-10',
          endDate: '2026-05-01',
        }),
      EqAssignV2ValidationError,
    );
  });

  it('equipment inexistant -> NotFound', () => {
    assert.throws(
      () => createAssignmentSafe({ db, equipmentId: 999, startDate: '2026-01-01' }),
      EqAssignV2NotFoundError,
    );
  });

  it('cree une assignation ACTIVE + entree history "created"', () => {
    const r = createAssignmentSafe({
      db,
      equipmentId: 1,
      assignedTo: 10,
      startDate: '2026-01-01',
      endDate: '2026-01-10',
      affaireId: 'AF-001',
      notes: 'Test',
      assignedBy: 42,
    });
    assert.equal(r.assignment.equipment_id, 1);
    assert.equal(r.assignment.assigned_to, 10);
    assert.equal(r.assignment.status, 'active');
    assert.ok(r.history_id);
    const hist = db
      .prepare('SELECT * FROM equipment_assignment_history WHERE id = ?')
      .get(r.history_id);
    assert.equal(hist.event_type, 'created');
    assert.equal(hist.new_status, 'active');
    assert.equal(hist.new_assigned_to, 10);
    assert.equal(hist.changed_by, 42);
  });

  it('bloque une double-assignation ACTIVE sur plage chevauchante', () => {
    createAssignmentSafe({
      db,
      equipmentId: 1,
      assignedTo: 10,
      startDate: '2026-01-01',
      endDate: '2026-01-10',
    });
    assert.throws(
      () =>
        createAssignmentSafe({
          db,
          equipmentId: 1,
          assignedTo: 20,
          startDate: '2026-01-05',
          endDate: '2026-01-15',
        }),
      EqAssignV2ConflictError,
    );
  });

  it('permet une nouvelle assignation sur plage sans chevauchement', () => {
    createAssignmentSafe({
      db,
      equipmentId: 1,
      assignedTo: 10,
      startDate: '2026-01-01',
      endDate: '2026-01-10',
    });
    assert.doesNotThrow(() =>
      createAssignmentSafe({
        db,
        equipmentId: 1,
        assignedTo: 20,
        startDate: '2026-02-01',
        endDate: '2026-02-10',
      }),
    );
  });

  it('permet une assignation sur un autre equipment sur meme plage', () => {
    createAssignmentSafe({
      db,
      equipmentId: 1,
      assignedTo: 10,
      startDate: '2026-01-01',
      endDate: '2026-01-10',
    });
    assert.doesNotThrow(() =>
      createAssignmentSafe({
        db,
        equipmentId: 2,
        assignedTo: 10,
        startDate: '2026-01-05',
        endDate: '2026-01-15',
      }),
    );
  });

  it('endDate null (ouverte) bloque toute autre creation ACTIVE', () => {
    createAssignmentSafe({
      db,
      equipmentId: 1,
      assignedTo: 10,
      startDate: '2026-01-01',
      endDate: null,
    });
    assert.throws(
      () =>
        createAssignmentSafe({
          db,
          equipmentId: 1,
          assignedTo: 20,
          startDate: '2027-06-15',
          endDate: '2027-06-20',
        }),
      EqAssignV2ConflictError,
    );
  });
});

describe('assignments/releaseAssignment', () => {
  it('release ACTIVE -> status released + history event released', () => {
    const c = createAssignmentSafe({
      db,
      equipmentId: 1,
      assignedTo: 10,
      startDate: '2026-01-01',
      endDate: '2026-01-10',
    });
    const r = releaseAssignment({
      db,
      assignmentId: c.assignment.id,
      releaseDate: '2026-01-05',
      releasedBy: 99,
      notes: 'Rendu tot',
    });
    assert.equal(r.assignment.status, 'released');
    assert.equal(r.assignment.end_date, '2026-01-05');
    const hist = db
      .prepare('SELECT * FROM equipment_assignment_history WHERE id = ?')
      .get(r.history_id);
    assert.equal(hist.event_type, 'released');
    assert.equal(hist.previous_status, 'active');
    assert.equal(hist.new_status, 'released');
    assert.equal(hist.changed_by, 99);
  });

  it('release non-active -> Conflict', () => {
    const c = createAssignmentSafe({
      db,
      equipmentId: 1,
      startDate: '2026-01-01',
      endDate: '2026-01-10',
    });
    releaseAssignment({ db, assignmentId: c.assignment.id });
    assert.throws(
      () => releaseAssignment({ db, assignmentId: c.assignment.id }),
      EqAssignV2ConflictError,
    );
  });

  it('release NotFound', () => {
    assert.throws(() => releaseAssignment({ db, assignmentId: 999 }), EqAssignV2NotFoundError);
  });
});

describe('assignments/getAssignmentHistory', () => {
  it('history par equipmentId', () => {
    const c = createAssignmentSafe({
      db,
      equipmentId: 1,
      startDate: '2026-01-01',
      endDate: '2026-01-10',
    });
    releaseAssignment({ db, assignmentId: c.assignment.id });
    const h = getAssignmentHistory({ db, equipmentId: 1 });
    assert.equal(h.total, 2);
    // Ordre desc.
    assert.equal(h.entries[0].event_type, 'released');
    assert.equal(h.entries[1].event_type, 'created');
  });

  it('history par assignmentId cible', () => {
    const c = createAssignmentSafe({
      db,
      equipmentId: 1,
      startDate: '2026-01-01',
      endDate: '2026-01-10',
    });
    const h = getAssignmentHistory({ db, assignmentId: c.assignment.id });
    assert.equal(h.total, 1);
    assert.equal(h.entries[0].event_type, 'created');
  });

  it('requiert au moins un filtre', () => {
    assert.throws(() => getAssignmentHistory({ db }), EqAssignV2ValidationError);
  });
});

describe('assignments/findConflictingActiveAssignments', () => {
  it('excludeAssignmentId ignore self-check', () => {
    const c = createAssignmentSafe({
      db,
      equipmentId: 1,
      startDate: '2026-01-01',
      endDate: '2026-01-10',
    });
    const conflicts = findConflictingActiveAssignments({
      db,
      equipmentId: 1,
      startDate: '2026-01-05',
      endDate: '2026-01-08',
      excludeAssignmentId: c.assignment.id,
    });
    assert.equal(conflicts.length, 0);
  });
});
