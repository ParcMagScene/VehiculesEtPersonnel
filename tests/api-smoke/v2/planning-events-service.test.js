#!/usr/bin/env node
/**
 * Tests intégration — services/planning/events.js::listEvents (T-P0-05 étendu).
 *
 * Vérifie la pagination cursor-based, les filtres serveur et la
 * validation des paramètres sur la DB de dev réelle.
 */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import db from '../../../apps/api/database.js';
import { listEvents } from '../../../apps/api/services/planning/events.js';
import { PlanningV2ValidationError } from '../../../apps/api/services/planning/tasks.js';
import { decodeCursor } from '../../../apps/api/utils/cursor.js';

after(() => db.close());

describe('services/planning/events.listEvents (T-P0-05 étendu)', () => {
  it('rejette absence de db', () => {
    assert.throws(() => listEvents({}), PlanningV2ValidationError);
  });

  it("renvoie une page ≤ limit et l'ordre est date DESC, id DESC", () => {
    const result = listEvents({ db, limit: 10 });
    assert.ok(Array.isArray(result.items));
    assert.ok(result.items.length <= 10);
    assert.equal(result.limit, 10);
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

  it('type invalide → PlanningV2ValidationError', () => {
    assert.throws(
      () => listEvents({ db, filters: { type: 'type-inexistant' } }),
      PlanningV2ValidationError,
    );
  });

  it('category invalide → PlanningV2ValidationError', () => {
    assert.throws(() => listEvents({ db, filters: { category: 'x' } }), PlanningV2ValidationError);
  });

  it('status invalide → PlanningV2ValidationError', () => {
    assert.throws(() => listEvents({ db, filters: { status: 'x' } }), PlanningV2ValidationError);
  });

  it('date_from mal formée → PlanningV2ValidationError', () => {
    assert.throws(
      () => listEvents({ db, filters: { date_from: '08/07/2026' } }),
      PlanningV2ValidationError,
    );
  });

  it('curseur invalide est ignoré silencieusement', () => {
    const withBad = listEvents({ db, cursor: '###bad###', limit: 5 });
    const without = listEvents({ db, limit: 5 });
    assert.deepEqual(
      withBad.items.map((e) => e.id),
      without.items.map((e) => e.id),
    );
  });

  it('pagination : deux pages successives sans doublon', () => {
    const page1 = listEvents({ db, limit: 5 });
    if (!page1.has_more) return;
    assert.ok(page1.next_cursor);
    const key = decodeCursor(page1.next_cursor);
    assert.ok(key);
    const page2 = listEvents({ db, cursor: page1.next_cursor, limit: 5 });
    const ids1 = new Set(page1.items.map((e) => e.id));
    for (const e of page2.items) {
      assert.ok(!ids1.has(e.id), `doublon detecte id=${e.id}`);
    }
  });
});
