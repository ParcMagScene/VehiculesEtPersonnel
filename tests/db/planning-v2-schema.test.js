#!/usr/bin/env node
/**
 * Tests DB — Planning v2 schéma (T-P0-02)
 *
 * Vérifie l'application de la migration planning-v2-schema-v1 :
 *   - table `task_sections_ref` présente
 *   - seed complet (16 sections)
 *   - alignement code ↔ constante TASK_SECTIONS
 *   - index composites cursor-based présents sur task_assignments
 *   - v1 non altérée (task_assignments toujours présente et lisible)
 *
 * Utilise la DB de développement (importée via apps/api/database.js).
 *
 * Usage : node --test tests/db/planning-v2-schema.test.js
 */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import db from '../../apps/api/database.js';
import { PLANNING_V2_EXPECTED_SECTIONS } from '../../apps/api/migrations/planning-v2-schema-v1.js';
import { TASK_SECTIONS } from '../../apps/api/services/planning/tasks.js';

after(() => db.close());

describe('Planning v2 — DB v2 (T-P0-02)', () => {
  it('table task_sections_ref existe', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_sections_ref'")
      .get();
    assert.ok(row, 'task_sections_ref manquante');
  });

  it('task_sections_ref contient les 16 sections seedées', () => {
    const rows = db
      .prepare('SELECT code, label, sort_order FROM task_sections_ref ORDER BY sort_order')
      .all();
    assert.equal(rows.length, PLANNING_V2_EXPECTED_SECTIONS);
    assert.equal(rows.length, TASK_SECTIONS.length);
  });

  it('les codes de task_sections_ref correspondent EXACTEMENT à TASK_SECTIONS (ordre inclus)', () => {
    const codes = db
      .prepare('SELECT code FROM task_sections_ref ORDER BY sort_order')
      .all()
      .map((r) => r.code);
    assert.deepEqual(codes, Array.from(TASK_SECTIONS));
  });

  it('chaque section a un label non vide', () => {
    const emptyLabels = db
      .prepare("SELECT code FROM task_sections_ref WHERE label IS NULL OR label = ''")
      .all();
    assert.equal(emptyLabels.length, 0, `sections sans label: ${JSON.stringify(emptyLabels)}`);
  });

  it('les index cursor-based v2 existent sur task_assignments', () => {
    const expected = [
      'idx_ta_v2_date_id',
      'idx_ta_v2_person_date_id',
      'idx_ta_v2_section_date_id',
    ];
    const present = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type='index' AND name IN (${expected.map(() => '?').join(', ')})`,
      )
      .all(...expected)
      .map((r) => r.name)
      .sort();
    assert.deepEqual(present, expected.sort());
  });

  it('la v1 est intacte : task_assignments existe et est requêtable', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_assignments'")
      .get();
    assert.ok(row, 'task_assignments manquante — v1 cassée');
    // La lecture doit fonctionner (peu importe le compte).
    const countRow = db.prepare('SELECT COUNT(*) AS n FROM task_assignments').get();
    assert.equal(typeof countRow.n, 'number');
  });

  it('aucune section utilisée n\'est absente de task_sections_ref (préparation T-P0-03)', () => {
    const orphans = db
      .prepare(
        `SELECT DISTINCT ta.section AS section
         FROM task_assignments ta
         LEFT JOIN task_sections_ref r ON r.code = ta.section
         WHERE ta.section IS NOT NULL
           AND ta.section <> ''
           AND r.code IS NULL`,
      )
      .all();
    assert.equal(
      orphans.length,
      0,
      `sections orphelines detectees: ${JSON.stringify(orphans)}`,
    );
  });
});
