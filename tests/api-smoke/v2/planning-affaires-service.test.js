#!/usr/bin/env node
/**
 * Tests intégration — services/planning/affaires.js::listPlanningAffaires
 * (T-P0-05 étendu).
 *
 * Vérifie l'offset-based simple, les filtres date et l'exclusion des
 * affaires masquées par défaut.
 */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import db from '../../../apps/api/database.js';
import { listPlanningAffaires } from '../../../apps/api/services/planning/affaires.js';
import { PlanningV2ValidationError } from '../../../apps/api/services/planning/tasks.js';

after(() => db.close());

describe('services/planning/affaires.listPlanningAffaires (T-P0-05 étendu)', () => {
  it('rejette absence de db', () => {
    assert.throws(() => listPlanningAffaires({}), PlanningV2ValidationError);
  });

  it('renvoie items + total + offset + limit', () => {
    const result = listPlanningAffaires({ db, limit: 10 });
    assert.ok(Array.isArray(result.items));
    assert.equal(typeof result.total, 'number');
    assert.equal(result.limit, 10);
    assert.equal(result.offset, 0);
    assert.ok(result.items.length <= 10);
    for (const row of result.items) {
      assert.ok(row.numero_affaire, 'numero_affaire requis');
      assert.equal(typeof row.is_hidden, 'number');
    }
  });

  it('dateFrom / dateTo mal formées → PlanningV2ValidationError', () => {
    assert.throws(
      () => listPlanningAffaires({ db, dateFrom: '08/07/2026' }),
      PlanningV2ValidationError,
    );
    assert.throws(() => listPlanningAffaires({ db, dateTo: 'x' }), PlanningV2ValidationError);
  });

  it("respecte l'offset (page 2 différente de page 1)", () => {
    const p1 = listPlanningAffaires({ db, limit: 5, offset: 0 });
    if (p1.total < 6) return;
    const p2 = listPlanningAffaires({ db, limit: 5, offset: 5 });
    const ids1 = p1.items.map((r) => r.id);
    const ids2 = p2.items.map((r) => r.id);
    for (const id of ids2) {
      assert.ok(!ids1.includes(id), `doublon id=${id}`);
    }
  });

  it('exclut les affaires masquées par défaut, includes si includeHidden=true', () => {
    const withoutHidden = listPlanningAffaires({ db, limit: 1000 });
    const withHidden = listPlanningAffaires({ db, limit: 1000, includeHidden: true });
    assert.ok(withHidden.total >= withoutHidden.total, 'withHidden >= withoutHidden');
    // Aucune ligne is_hidden=1 dans le résultat par défaut
    for (const row of withoutHidden.items) {
      assert.equal(row.is_hidden, 0, `is_hidden inattendu pour ${row.numero_affaire}`);
    }
  });
});
