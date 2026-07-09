#!/usr/bin/env node
/**
 * Tests intégration — Planning v2 tasks batch/clear/rollover (T-P0-04 étendu).
 *
 * Vérifie createTasksBatch / clearCompletedTasks / rolloverIncompleteTasks
 * sur la vraie DB de dev, avec isolation par marqueur unique + cleanup
 * exhaustif en `after()`.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import db from '../../../apps/api/database.js';
import {
  clearCompletedTasks,
  createTask,
  createTasksBatch,
  PlanningV2ValidationError,
  rolloverIncompleteTasks,
} from '../../../apps/api/services/planning/tasks.js';

const TEST_MARKER = `T-P0-04ext::${randomUUID()}`;

function markerPayload(overrides = {}) {
  return {
    date: '2099-02-01',
    section: 'manual',
    title: 'Batch test',
    notes: TEST_MARKER,
    status: 'pending',
    ...overrides,
  };
}

before(() => {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_assignments'")
    .get();
  assert.ok(row, 'task_assignments requis');
});

after(() => {
  db.prepare('DELETE FROM task_assignments WHERE notes = ?').run(TEST_MARKER);
  db.close();
});

describe('createTasksBatch (T-P0-04 étendu)', () => {
  it('rejette items vide', () => {
    assert.throws(() => createTasksBatch({ db, items: [] }), PlanningV2ValidationError);
  });

  it('rejette items > 100', () => {
    const items = Array.from({ length: 101 }, () => markerPayload());
    assert.throws(() => createTasksBatch({ db, items }), PlanningV2ValidationError);
  });

  it('rejette item sans date (rollback complet)', () => {
    const items = [markerPayload(), { section: 'manual', notes: TEST_MARKER }];
    const before = db
      .prepare('SELECT COUNT(*) AS n FROM task_assignments WHERE notes = ?')
      .get(TEST_MARKER).n;
    assert.throws(() => createTasksBatch({ db, items }), PlanningV2ValidationError);
    const after2 = db
      .prepare('SELECT COUNT(*) AS n FROM task_assignments WHERE notes = ?')
      .get(TEST_MARKER).n;
    assert.equal(after2, before, 'batch atomique : rien créé si un item invalide');
  });

  it('crée un lot valide en transaction', () => {
    const items = [
      markerPayload({ title: 'batch-1' }),
      markerPayload({ title: 'batch-2', date: '2099-02-02' }),
      markerPayload({ title: 'batch-3', date: '2099-02-03' }),
    ];
    const result = createTasksBatch({ db, items });
    assert.equal(result.created, 3);
    assert.equal(result.ids.length, 3);
    for (const id of result.ids) {
      assert.equal(typeof id, 'string');
      assert.equal(id.length, 32);
    }
  });
});

describe('clearCompletedTasks (T-P0-04 étendu)', () => {
  it('supprime uniquement les tâches done avec le marker', () => {
    // Crée 2 tâches done + 1 tâche pending, toutes marquées
    const done1 = createTask({ db, data: markerPayload({ title: 'clr-done-1' }) });
    const done2 = createTask({
      db,
      data: markerPayload({ title: 'clr-done-2', date: '2099-02-05' }),
    });
    const pending = createTask({
      db,
      data: markerPayload({ title: 'clr-pending', date: '2099-02-06' }),
    });
    // Marque les deux premières done directement en DB (contourne la matrice)
    db.prepare("UPDATE task_assignments SET status = 'done' WHERE id IN (?, ?)").run(
      done1.id,
      done2.id,
    );

    const result = clearCompletedTasks({ db, section: 'manual' });
    assert.ok(result.deleted >= 2, `attendu >= 2 supprimées, obtenu ${result.deleted}`);

    // Vérifie que la tâche pending du marker existe toujours
    const stillThere = db.prepare('SELECT id FROM task_assignments WHERE id = ?').get(pending.id);
    assert.ok(stillThere, 'la tâche pending ne doit pas être supprimée');
  });

  it('rejette date au mauvais format', () => {
    assert.throws(() => clearCompletedTasks({ db, date: '01/01/2099' }), PlanningV2ValidationError);
  });

  it('rejette section invalide', () => {
    assert.throws(
      () => clearCompletedTasks({ db, section: 'section-inexistante' }),
      PlanningV2ValidationError,
    );
  });
});

describe('rolloverIncompleteTasks (T-P0-04 étendu)', () => {
  it('déplace les tâches pending vers le jour suivant par défaut', () => {
    const fromDate = '2099-03-10';
    const toDate = '2099-03-11';
    // Isolation : crée 3 tâches à fromDate (2 pending + 1 done)
    const p1 = createTask({ db, data: markerPayload({ title: 'roll-1', date: fromDate }) });
    const p2 = createTask({ db, data: markerPayload({ title: 'roll-2', date: fromDate }) });
    const doneTask = createTask({
      db,
      data: markerPayload({ title: 'roll-done', date: fromDate }),
    });
    db.prepare("UPDATE task_assignments SET status = 'done' WHERE id = ?").run(doneTask.id);

    const result = rolloverIncompleteTasks({ db, fromDate });
    assert.equal(result.to, toDate, 'destination = J+1 par défaut');
    assert.ok(result.moved >= 2, `attendu >= 2 déplacées, obtenu ${result.moved}`);

    // p1 et p2 doivent avoir la nouvelle date
    const p1After = db.prepare('SELECT date FROM task_assignments WHERE id = ?').get(p1.id);
    const p2After = db.prepare('SELECT date FROM task_assignments WHERE id = ?').get(p2.id);
    assert.equal(p1After.date, toDate);
    assert.equal(p2After.date, toDate);

    // La done reste à fromDate (non éligible)
    const doneAfter = db.prepare('SELECT date FROM task_assignments WHERE id = ?').get(doneTask.id);
    assert.equal(doneAfter.date, fromDate);
  });

  it('accepte une toDate explicite', () => {
    const created = createTask({
      db,
      data: markerPayload({ title: 'roll-custom', date: '2099-03-20' }),
    });
    const result = rolloverIncompleteTasks({
      db,
      fromDate: '2099-03-20',
      toDate: '2099-03-25',
    });
    assert.equal(result.to, '2099-03-25');
    assert.ok(result.moved >= 1);
    const after2 = db.prepare('SELECT date FROM task_assignments WHERE id = ?').get(created.id);
    assert.equal(after2.date, '2099-03-25');
  });

  it('rejette fromDate mal formée', () => {
    assert.throws(
      () => rolloverIncompleteTasks({ db, fromDate: '20-03-2099' }),
      PlanningV2ValidationError,
    );
  });

  it('rejette eligibleStatuses vide', () => {
    assert.throws(
      () => rolloverIncompleteTasks({ db, fromDate: '2099-03-30', eligibleStatuses: [] }),
      PlanningV2ValidationError,
    );
  });
});
