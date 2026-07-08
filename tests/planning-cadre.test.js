#!/usr/bin/env node
/**
 * Tests de non-régression — Planning v2 (cadrage T-P0-01)
 *
 * Vérifie que le squelette des services v2 est en place :
 *   - existence des namespaces
 *   - présence des constantes de vérité
 *   - PlanningV2NotImplementedError levée par les fonctions squelette
 *
 * Aucun test runtime (pas de DB, pas de réseau).
 *
 * Usage : node --test tests/planning-cadre.test.js
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AFFAIRE_CYCLE_STATUSES } from '../apps/api/services/planning/affaires.js';
import {
  BL_IMPORT_STATUSES,
  BP_ITEM_MATCH_STATUSES,
} from '../apps/api/services/planning/imports.js';
import {
  EVENT_CATEGORIES,
  EVENT_STATUSES,
  EVENT_TYPES,
} from '../apps/api/services/planning/events.js';
import { ICAL_MIME_TYPE } from '../apps/api/services/planning/ical.js';
import {
  getPlanningV2Namespaces,
  PLANNING_V2_NAMESPACES,
} from '../apps/api/services/planning/index.js';
import { RECURRENCE_FREQUENCIES } from '../apps/api/services/planning/recurrence.js';
import {
  createTask,
  PlanningV2NotImplementedError,
  TASK_SECTIONS,
  TASK_STATUSES,
} from '../apps/api/services/planning/tasks.js';

describe('Planning v2 — cadrage (T-P0-01)', () => {
  it("expose les 6 namespaces attendus dans l'ordre canonique", () => {
    assert.deepEqual(Array.from(PLANNING_V2_NAMESPACES), [
      'tasks',
      'events',
      'affaires',
      'imports',
      'recurrence',
      'ical',
    ]);
  });

  it('getPlanningV2Namespaces renvoie un objet avec chaque namespace', () => {
    const ns = getPlanningV2Namespaces();
    for (const name of PLANNING_V2_NAMESPACES) {
      assert.ok(ns[name], `namespace manquant : ${name}`);
    }
  });

  it('TASK_SECTIONS contient les 15 sections métier + "manual"', () => {
    assert.equal(TASK_SECTIONS.length, 16);
    assert.ok(TASK_SECTIONS.includes('rdv'));
    assert.ok(TASK_SECTIONS.includes('manual'));
    assert.ok(TASK_SECTIONS.includes('taches_prioritaires'));
  });

  it('TASK_STATUSES canonique', () => {
    assert.deepEqual(Array.from(TASK_STATUSES), ['pending', 'in_progress', 'done', 'cancelled']);
  });

  it('EVENT_TYPES / EVENT_CATEGORIES / EVENT_STATUSES canoniques', () => {
    assert.equal(EVENT_TYPES.length, 6);
    assert.equal(EVENT_CATEGORIES.length, 4);
    assert.deepEqual(Array.from(EVENT_STATUSES), ['pending', 'in_progress', 'done']);
  });

  it('AFFAIRE_CYCLE_STATUSES a 10 étapes ordonnées', () => {
    assert.equal(AFFAIRE_CYCLE_STATUSES.length, 10);
    assert.equal(AFFAIRE_CYCLE_STATUSES[0], 'prep');
    assert.equal(AFFAIRE_CYCLE_STATUSES.at(-1), 'cloture');
  });

  it('BL_IMPORT_STATUSES et BP_ITEM_MATCH_STATUSES canoniques', () => {
    assert.deepEqual(Array.from(BL_IMPORT_STATUSES), ['pending', 'validated', 'rejected']);
    assert.deepEqual(Array.from(BP_ITEM_MATCH_STATUSES), [
      'unmatched',
      'matched',
      'manual',
      'ignored',
    ]);
  });

  it('RECURRENCE_FREQUENCIES canoniques', () => {
    assert.deepEqual(Array.from(RECURRENCE_FREQUENCIES), ['daily', 'weekly', 'monthly']);
  });

  it('ICAL_MIME_TYPE est bien text/calendar; charset=utf-8', () => {
    assert.equal(ICAL_MIME_TYPE, 'text/calendar; charset=utf-8');
  });

  it('createTask (squelette) lève PlanningV2NotImplementedError', async () => {
    await assert.rejects(
      () => createTask({}),
      (err) => {
        assert.ok(err instanceof PlanningV2NotImplementedError, "type d'erreur attendu");
        assert.equal(err.code, 'PLANNING_V2_NOT_IMPLEMENTED');
        assert.equal(err.fn, 'createTask');
        return true;
      },
    );
  });
});
