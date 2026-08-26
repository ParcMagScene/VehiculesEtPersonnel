#!/usr/bin/env node
/**
 * scripts/planning-v2-backfill.mjs
 *
 * Ticket : T-P0-02 (Planning v2 — DB v2)
 *
 * Rapport de contrôle NON destructif : vérifie l'alignement entre
 * `task_assignments.section` et `task_sections_ref.code`, et signale
 * toute section utilisée en base qui ne serait pas seedée.
 *
 * Modes :
 *   - dry-run (défaut) : n'écrit rien, imprime un rapport JSON.
 *   - --apply          : réservé aux évolutions futures (T-P0-04+).
 *                        À ce stade, --apply reste equivalent au dry-run
 *                        car aucun backfill data n'est nécessaire
 *                        (seed complet fourni par la migration).
 *
 * Usage :
 *   node scripts/planning-v2-backfill.mjs
 *   node scripts/planning-v2-backfill.mjs --apply
 *   DB_PATH=/tmp/vehicules-copy.db node scripts/planning-v2-backfill.mjs
 *
 * Sortie : rapport JSON sur stdout.
 * Exit codes :
 *   0 : rapport OK (aucune anomalie)
 *   1 : anomalie détectée (sections orphelines) — investigation requise
 *   2 : environnement invalide (DB absente, tables manquantes, etc.)
 */

import process from 'node:process';

import db from '../apps/api/database.js';

const APPLY = process.argv.includes('--apply');

function tableExists(name) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
  return Boolean(row);
}

function main() {
  const report = {
    ticket: 'T-P0-02',
    mode: APPLY ? 'apply' : 'dry-run',
    apply_note:
      'Aucune action destructive prévue à ce stade — --apply équivalent au dry-run.',
    checks: {},
  };

  if (!tableExists('task_sections_ref')) {
    report.checks.task_sections_ref = 'MISSING';
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    db.close();
    process.exit(2);
  }
  report.checks.task_sections_ref = 'OK';

  const seededCount = db
    .prepare('SELECT COUNT(*) AS n FROM task_sections_ref')
    .get().n;
  report.task_sections_ref_count = seededCount;

  if (!tableExists('task_assignments')) {
    report.checks.task_assignments = 'MISSING';
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    db.close();
    process.exit(0);
  }
  report.checks.task_assignments = 'OK';

  // Recensement des sections effectivement utilisées côté v1
  const usedSections = db
    .prepare(
      `SELECT section, COUNT(*) AS n
       FROM task_assignments
       WHERE section IS NOT NULL AND section <> ''
       GROUP BY section
       ORDER BY section`,
    )
    .all();
  report.used_sections_distinct = usedSections.length;
  report.used_sections = usedSections;

  // Sections utilisées mais absentes de task_sections_ref
  const orphanSections = db
    .prepare(
      `SELECT DISTINCT ta.section AS section
       FROM task_assignments ta
       LEFT JOIN task_sections_ref r ON r.code = ta.section
       WHERE ta.section IS NOT NULL
         AND ta.section <> ''
         AND r.code IS NULL
       ORDER BY ta.section`,
    )
    .all()
    .map((row) => row.section);
  report.orphan_sections = orphanSections;

  // Vérification index cursor-based (informative)
  const cursorIndexes = ['idx_ta_v2_date_id', 'idx_ta_v2_person_date_id', 'idx_ta_v2_section_date_id'];
  const indexRows = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'index' AND name IN (${cursorIndexes.map(() => '?').join(', ')})`,
    )
    .all(...cursorIndexes)
    .map((row) => row.name);
  report.cursor_indexes_present = indexRows.sort();
  report.cursor_indexes_missing = cursorIndexes.filter(
    (name) => !indexRows.includes(name),
  );

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  db.close();
  process.exit(orphanSections.length === 0 ? 0 : 1);
}

main();
