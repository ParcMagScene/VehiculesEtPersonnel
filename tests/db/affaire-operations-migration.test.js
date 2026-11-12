import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import { runAffaireOperationsMigration } from '../../apps/api/migrations/affaire-operations-v1.js';

let db;

before(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE affaires (id INTEGER PRIMARY KEY, numero_affaire TEXT NOT NULL UNIQUE);
    CREATE TABLE bl_imports (id TEXT PRIMARY KEY, affaire_id TEXT, affaire_ref_id INTEGER);
    CREATE TABLE task_assignments (id TEXT PRIMARY KEY);
    CREATE TABLE reservations (id TEXT PRIMARY KEY);
    INSERT INTO affaires (id, numero_affaire) VALUES (1, 'AF12345');
    INSERT INTO bl_imports (id, affaire_id, affaire_ref_id) VALUES ('bl-1', 'AF12345', 1);
    INSERT INTO task_assignments (id) VALUES ('task-1');
    INSERT INTO reservations (id) VALUES ('reservation-1');
  `);
});

after(() => db.close());

describe('affaire operations migration', () => {
  it('creates operation links and nullable operation references for planning records', () => {
    runAffaireOperationsMigration(db);
    const operationId = db
      .prepare('INSERT INTO affaire_operations (affaire_id, bl_import_id, name) VALUES (?, ?, ?)')
      .run(1, 'bl-1', 'Prestation sonorisation').lastInsertRowid;

    db.prepare('UPDATE task_assignments SET operation_id = ? WHERE id = ?').run(
      operationId,
      'task-1',
    );
    db.prepare('UPDATE reservations SET operation_id = ? WHERE id = ?').run(
      operationId,
      'reservation-1',
    );

    assert.equal(
      db.prepare('SELECT operation_id FROM task_assignments WHERE id = ?').get('task-1')
        .operation_id,
      operationId,
    );
    assert.equal(
      db.prepare('SELECT operation_id FROM reservations WHERE id = ?').get('reservation-1')
        .operation_id,
      operationId,
    );
    assert.equal(
      db.prepare('SELECT bl_import_id FROM affaire_operations WHERE id = ?').get(operationId)
        .bl_import_id,
      'bl-1',
    );
  });

  it('preserves existing rows, clears references on deletion, and is idempotent', () => {
    const existingTask = db.prepare('SELECT id FROM task_assignments WHERE id = ?').get('task-1');
    assert.ok(existingTask);
    const operationId = db
      .prepare('SELECT id FROM affaire_operations WHERE name = ?')
      .get('Prestation sonorisation').id;

    db.prepare('DELETE FROM affaire_operations WHERE id = ?').run(operationId);
    assert.equal(
      db.prepare('SELECT operation_id FROM task_assignments WHERE id = ?').get('task-1')
        .operation_id,
      null,
    );
    assert.equal(
      db.prepare('SELECT operation_id FROM reservations WHERE id = ?').get('reservation-1')
        .operation_id,
      null,
    );
    assert.doesNotThrow(() => runAffaireOperationsMigration(db));
  });
});
