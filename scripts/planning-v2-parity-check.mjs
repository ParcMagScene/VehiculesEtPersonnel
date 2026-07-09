#!/usr/bin/env node
/**
 * scripts/planning-v2-parity-check.mjs
 *
 * Ticket : T-P0-06 (préparation cutover Planning v2).
 *
 * Compare la parité de lecture entre :
 *   - v1 : SELECT direct sur `task_assignments` avec les filtres v1
 *   - v2 : service `listTasks({ db, filters, cursor, limit })` de
 *          `apps/api/services/planning/tasks.js`
 *
 * DRY-RUN uniquement : aucune écriture DB. Aucune requête HTTP.
 *
 * Filtres testés par défaut :
 *   - sans filtre (tri global)
 *   - par section (chaque section utilisée en base)
 *   - par tranche de date (mois courant, mois précédent)
 *
 * Comptabilise les items communs, en delta v1 seul (visibles v1, absents v2)
 * et en delta v2 seul (visibles v2, absents v1). Une parité stricte
 * exige un delta cumul == 0.
 *
 * Note : v2 exclut volontairement les tâches sans date (contrat cursor-based).
 * Elles apparaissent donc dans le rapport comme delta v1 seul. C'est le
 * comportement attendu ; ces tâches sont explicitement documentées comme
 * non-cursor dans docs/api/v2/planning.md.
 *
 * Usage :
 *   node scripts/planning-v2-parity-check.mjs
 *   node scripts/planning-v2-parity-check.mjs --verbose
 *   DB_PATH=/tmp/vehicules-copy.db node scripts/planning-v2-parity-check.mjs
 *
 * Exit codes :
 *   0 : parité stricte OU seules divergences = tâches sans date (attendu)
 *   1 : divergences non expliquées détectées
 *   2 : environnement invalide (DB absente, table manquante)
 */

import process from 'node:process';

import db from '../apps/api/database.js';
import { listTasks } from '../apps/api/services/planning/tasks.js';

const VERBOSE = process.argv.includes('--verbose');

function log(...args) {
  if (VERBOSE) console.error('[parity]', ...args);
}

function tableExists(name) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name),
  );
}

/**
 * Récupère TOUTES les tâches côté v1 pour un filtre donné, sans pagination.
 * Trié `date DESC, id DESC` pour comparaison cohérente avec v2.
 */
function fetchV1Tasks({ section = null, dateFrom = null, dateTo = null } = {}) {
  const wheres = [];
  const bindings = [];
  if (section) {
    wheres.push('ta.section = ?');
    bindings.push(section);
  }
  if (dateFrom) {
    wheres.push('ta.date >= ?');
    bindings.push(dateFrom);
  }
  if (dateTo) {
    wheres.push('ta.date <= ?');
    bindings.push(dateTo);
  }
  const whereSql = wheres.length > 0 ? `WHERE ${wheres.join(' AND ')}` : '';
  const sql = `SELECT ta.* FROM task_assignments ta ${whereSql} ORDER BY ta.date DESC, ta.id DESC`;
  return db.prepare(sql).all(...bindings);
}

/**
 * Récupère TOUTES les tâches côté v2 pour un filtre donné en boucle cursor-based.
 */
function fetchV2Tasks(filters = {}) {
  const all = [];
  let cursor = null;
  let iterations = 0;
  const HARD_LIMIT = 100;
  while (true) {
    iterations += 1;
    if (iterations > HARD_LIMIT) {
      throw new Error(`parity: safety break after ${HARD_LIMIT} v2 pages (potential cursor loop)`);
    }
    const result = listTasks({ db, filters, cursor, limit: 200 });
    all.push(...result.items);
    if (!result.has_more || !result.next_cursor) break;
    cursor = result.next_cursor;
  }
  return all;
}

/**
 * Compare deux ensembles v1 / v2. Retourne un rapport par filtre.
 */
function diffSets(v1Items, v2Items) {
  const v1Ids = new Set(v1Items.map((t) => t.id));
  const v2Ids = new Set(v2Items.map((t) => t.id));

  const onlyV1 = v1Items.filter((t) => !v2Ids.has(t.id));
  const onlyV2 = v2Items.filter((t) => !v1Ids.has(t.id));

  // Sous-catégorisation des onlyV1 : sans date (attendu) vs autres (anormal).
  const onlyV1WithoutDate = onlyV1.filter(
    (t) => t.date === null || t.date === undefined || t.date === '',
  );
  const onlyV1WithDate = onlyV1.filter(
    (t) => t.date !== null && t.date !== undefined && t.date !== '',
  );

  return {
    v1_count: v1Items.length,
    v2_count: v2Items.length,
    only_v1_count: onlyV1.length,
    only_v1_expected_no_date: onlyV1WithoutDate.length,
    only_v1_unexpected: onlyV1WithDate.length,
    only_v2_count: onlyV2.length,
    parity_strict: onlyV1.length === 0 && onlyV2.length === 0,
    parity_expected: onlyV1WithDate.length === 0 && onlyV2.length === 0,
  };
}

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function main() {
  const report = {
    ticket: 'T-P0-06',
    mode: 'dry-run',
    generated_at: new Date().toISOString(),
    checks: [],
  };

  if (!tableExists('task_assignments')) {
    report.error = 'task_assignments manquante';
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    db.close();
    process.exit(2);
  }

  // Sections effectivement utilisées en base
  const sectionsInUse = db
    .prepare(
      "SELECT DISTINCT section AS s FROM task_assignments WHERE section IS NOT NULL AND section <> '' ORDER BY section",
    )
    .all()
    .map((r) => r.s);
  report.sections_in_use = sectionsInUse;

  const now = new Date();
  const startCurrent = new Date(now.getFullYear(), now.getMonth(), 1);
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endPrev = new Date(now.getFullYear(), now.getMonth(), 0);

  const filterMatrix = [
    { name: 'no-filter', filters: {} },
    ...sectionsInUse.map((s) => ({ name: `section=${s}`, filters: { section: s } })),
    {
      name: 'current-month',
      filters: { date_from: isoDate(startCurrent), date_to: isoDate(now) },
    },
    {
      name: 'previous-month',
      filters: { date_from: isoDate(startPrev), date_to: isoDate(endPrev) },
    },
  ];

  let unexplainedDivergences = 0;

  for (const scenario of filterMatrix) {
    log(`running ${scenario.name}`);
    const v1 = fetchV1Tasks({
      section: scenario.filters.section ?? null,
      dateFrom: scenario.filters.date_from ?? null,
      dateTo: scenario.filters.date_to ?? null,
    });
    const v2 = fetchV2Tasks(scenario.filters);
    const diff = diffSets(v1, v2);
    report.checks.push({ name: scenario.name, ...diff });
    if (!diff.parity_expected) {
      unexplainedDivergences += 1;
      log(`⚠ divergence non expliquée sur ${scenario.name}`);
    }
  }

  report.total_checks = filterMatrix.length;
  report.unexpected_divergences = unexplainedDivergences;
  report.verdict =
    unexplainedDivergences === 0 ? 'OK (parité attendue)' : 'DIVERGENCES NON EXPLIQUÉES';

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  db.close();
  process.exit(unexplainedDivergences === 0 ? 0 : 1);
}

main();
