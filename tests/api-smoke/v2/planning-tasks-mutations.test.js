#!/usr/bin/env node
/**
 * Tests intégration — mutations Planning v2 tasks (T-P0-04)
 *
 * Vérifie createTask / getTaskById / updateTask / deleteTask sur la
 * base de développement (isolation par marqueur `notes = 'T-P0-04::<uuid>'`).
 *
 * Hygiène : les tâches créées par le test sont supprimées en `after()`
 * pour ne pas polluer la base dev.
 *
 * Usage : node --test tests/api-smoke/v2/planning-tasks-mutations.test.js
 */

import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import db from '../../../apps/api/database.js';
import {
  createTask,
  deleteTask,
  getTaskById,
  PlanningV2ValidationError,
  TASK_SECTIONS,
  TASK_STATUS_TRANSITIONS,
  updateTask,
} from '../../../apps/api/services/planning/tasks.js';

const TEST_MARKER = `T-P0-04::${randomUUID()}`;
const createdIds = new Set();

function makeTaskPayload(overrides = {}) {
  return {
    date: '2099-01-15',
    section: 'manual',
    title: 'Test T-P0-04',
    notes: TEST_MARKER,
    period: 'AM',
    status: 'pending',
    visible: 1,
    ...overrides,
  };
}

before(() => {
  // Assure que la table cible est là.
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_assignments'")
    .get();
  assert.ok(row, 'task_assignments requis pour ce test');
});

after(() => {
  // Cleanup — supprime toutes les tâches créées par ce test.
  const stmt = db.prepare('DELETE FROM task_assignments WHERE id = ?');
  for (const id of createdIds) {
    try {
      stmt.run(id);
    } catch (_) {
      /* best effort */
    }
  }
  // Filet de sécurité par marqueur.
  db.prepare('DELETE FROM task_assignments WHERE notes = ?').run(TEST_MARKER);
  db.close();
});

describe('services/planning/tasks mutations (T-P0-04)', () => {
  it('TASK_STATUS_TRANSITIONS couvre les 4 statuts et refuse identité', () => {
    for (const status of ['pending', 'in_progress', 'done', 'cancelled']) {
      assert.ok(TASK_STATUS_TRANSITIONS[status], `manque ${status}`);
      assert.ok(!TASK_STATUS_TRANSITIONS[status].includes(status), `${status}→${status} interdit`);
    }
  });

  it('createTask persiste et renvoie la ligne complète', () => {
    const created = createTask({ db, data: makeTaskPayload() });
    assert.ok(created);
    assert.equal(typeof created.id, 'string');
    assert.equal(created.id.length, 32); // UUID hex
    assert.equal(created.date, '2099-01-15');
    assert.equal(created.section, 'manual');
    assert.equal(created.title, 'Test T-P0-04');
    assert.equal(created.notes, TEST_MARKER);
    assert.equal(created.status, 'pending');
    assert.equal(created.visible, 1);
    createdIds.add(created.id);
  });

  it('createTask refuse un section hors TASK_SECTIONS', () => {
    assert.throws(
      () => createTask({ db, data: makeTaskPayload({ section: 'inconnue' }) }),
      PlanningV2ValidationError,
    );
  });

  it('createTask exige date', () => {
    const payload = makeTaskPayload();
    delete payload.date;
    assert.throws(() => createTask({ db, data: payload }), PlanningV2ValidationError);
  });

  it('getTaskById renvoie la tâche persistée', () => {
    const created = createTask({ db, data: makeTaskPayload({ title: 'Get me' }) });
    createdIds.add(created.id);
    const fetched = getTaskById({ db, id: created.id });
    assert.ok(fetched);
    assert.equal(fetched.id, created.id);
    assert.equal(fetched.title, 'Get me');
  });

  it('getTaskById renvoie null pour id inconnu', () => {
    const fetched = getTaskById({ db, id: 'ffffffffffffffffffffffffffffffff' });
    assert.equal(fetched, null);
  });

  it('updateTask met à jour un champ non-statut et bump modified_at', () => {
    const created = createTask({ db, data: makeTaskPayload({ title: 'Before' }) });
    createdIds.add(created.id);
    const updated = updateTask({ db, id: created.id, data: { title: 'After' } });
    assert.ok(updated);
    assert.equal(updated.title, 'After');
    assert.ok(updated.modified_at, 'modified_at doit être renseigné');
  });

  it('updateTask autorise pending → in_progress → done', () => {
    const created = createTask({ db, data: makeTaskPayload({ status: 'pending' }) });
    createdIds.add(created.id);
    const step1 = updateTask({ db, id: created.id, data: { status: 'in_progress' } });
    assert.equal(step1.status, 'in_progress');
    const step2 = updateTask({ db, id: created.id, data: { status: 'done' } });
    assert.equal(step2.status, 'done');
  });

  it('updateTask refuse pending → done directement ? (dépend matrice)', () => {
    // La matrice actuelle autorise pending → done. Ce test documente ce contrat.
    const created = createTask({ db, data: makeTaskPayload({ status: 'pending' }) });
    createdIds.add(created.id);
    const step = updateTask({ db, id: created.id, data: { status: 'done' } });
    assert.equal(step.status, 'done', 'pending → done doit être autorisé par la matrice');
  });

  it('updateTask refuse cancelled → done (transition non déclarée)', () => {
    const created = createTask({ db, data: makeTaskPayload({ status: 'cancelled' }) });
    createdIds.add(created.id);
    assert.throws(
      () => updateTask({ db, id: created.id, data: { status: 'done' } }),
      PlanningV2ValidationError,
    );
  });

  it('updateTask renvoie null si id inconnu', () => {
    const result = updateTask({
      db,
      id: 'ffffffffffffffffffffffffffffffff',
      data: { title: 'x' },
    });
    assert.equal(result, null);
  });

  it('updateTask refuse payload vide', () => {
    const created = createTask({ db, data: makeTaskPayload() });
    createdIds.add(created.id);
    assert.throws(() => updateTask({ db, id: created.id, data: {} }), PlanningV2ValidationError);
  });

  it('deleteTask supprime réellement et est idempotent', () => {
    const created = createTask({ db, data: makeTaskPayload({ title: 'Delete me' }) });
    createdIds.add(created.id);
    assert.equal(deleteTask({ db, id: created.id }), true);
    assert.equal(getTaskById({ db, id: created.id }), null);
    assert.equal(deleteTask({ db, id: created.id }), false);
  });

  it('TASK_SECTIONS reste stable (20 valeurs)', () => {
    assert.equal(TASK_SECTIONS.length, 20);
  });
});
