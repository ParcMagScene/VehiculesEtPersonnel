#!/usr/bin/env node
/**
 * Tests intégration — services/planning/tasks.js::listTasks (T-P0-03)
 *
 * Vérifie la pagination cursor-based, les filtres serveur et la
 * validation des paramètres, en utilisant la vraie DB de dev via
 * `apps/api/database.js` (task_assignments existant).
 *
 * Usage : node --test tests/api-smoke/v2/planning-tasks-service.test.js
 */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import db from '../../../apps/api/database.js';
import {
  listTasks,
  PlanningV2ValidationError,
  TASKS_LIMIT_DEFAULT,
  TASKS_LIMIT_MAX,
} from '../../../apps/api/services/planning/tasks.js';
import { decodeCursor } from '../../../apps/api/utils/cursor.js';

after(() => db.close());

describe('services/planning/tasks.listTasks (T-P0-03)', () => {
  it('rejette absence de db', () => {
    assert.throws(() => listTasks({}), PlanningV2ValidationError);
  });

  it("renvoie une page ≤ limit et l'ordre est date DESC, id DESC", () => {
    const result = listTasks({ db, limit: 10 });
    assert.ok(Array.isArray(result.items));
    assert.ok(result.items.length <= 10);
    assert.equal(result.limit, 10);
    // Vérification tri stable (uniquement si >= 2 items)
    for (let i = 1; i < result.items.length; i += 1) {
      const prev = result.items[i - 1];
      const curr = result.items[i];
      if (prev.date === curr.date) {
        assert.ok(prev.id > curr.id, `id order broken at ${i}`);
      } else {
        assert.ok(prev.date > curr.date, `date order broken at ${i}`);
      }
    }
  });

  it('limit invalide → défaut', () => {
    assert.equal(listTasks({ db, limit: 'foo' }).limit, TASKS_LIMIT_DEFAULT);
    assert.equal(listTasks({ db, limit: -5 }).limit, TASKS_LIMIT_DEFAULT);
    assert.equal(listTasks({ db, limit: 0 }).limit, TASKS_LIMIT_DEFAULT);
  });

  it('limit borné par TASKS_LIMIT_MAX', () => {
    assert.equal(listTasks({ db, limit: 9999 }).limit, TASKS_LIMIT_MAX);
  });

  it('section invalide → PlanningV2ValidationError', () => {
    assert.throws(
      () => listTasks({ db, filters: { section: 'section-inconnue' } }),
      PlanningV2ValidationError,
    );
  });

  it('date_from mal formée → PlanningV2ValidationError', () => {
    assert.throws(
      () => listTasks({ db, filters: { date_from: '08/07/2026' } }),
      PlanningV2ValidationError,
    );
  });

  it('person_id non-entier → PlanningV2ValidationError', () => {
    assert.throws(
      () => listTasks({ db, filters: { person_id: 'abc' } }),
      PlanningV2ValidationError,
    );
  });

  it('curseur invalide est ignoré silencieusement (première page)', () => {
    const withBadCursor = listTasks({ db, cursor: '###invalid###', limit: 5 });
    const withoutCursor = listTasks({ db, limit: 5 });
    assert.deepEqual(
      withBadCursor.items.map((t) => t.id),
      withoutCursor.items.map((t) => t.id),
    );
  });

  it('pagination : deux pages successives sans doublon', () => {
    const page1 = listTasks({ db, limit: 5 });
    if (!page1.has_more) return; // rien à tester en dev vide
    assert.ok(page1.next_cursor, 'next_cursor requis quand has_more=true');
    const key = decodeCursor(page1.next_cursor);
    assert.ok(key, 'next_cursor doit être décodable');

    const page2 = listTasks({ db, cursor: page1.next_cursor, limit: 5 });
    const ids1 = new Set(page1.items.map((t) => t.id));
    for (const t of page2.items) {
      assert.ok(!ids1.has(t.id), `doublon détecté id=${t.id}`);
      // t doit être strictement après (date, id) de la fin de page1
      const last = page1.items[page1.items.length - 1];
      assert.ok(
        t.date < last.date || (t.date === last.date && t.id < last.id),
        `page2 item mal ordonné id=${t.id}`,
      );
    }
  });

  it('filtre section valide ne casse rien (renvoie <= limit)', () => {
    const result = listTasks({
      db,
      filters: { section: 'manual' },
      limit: 3,
    });
    for (const t of result.items) {
      assert.equal(t.section, 'manual');
    }
    assert.ok(result.items.length <= 3);
  });
});
