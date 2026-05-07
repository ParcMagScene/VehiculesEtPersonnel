#!/usr/bin/env node
/**
 * Backfill planning_assignments depuis task_assignments.person_id (FIX 3).
 *
 * Détecte les tâches actives ayant person_id défini mais aucune entrée
 * correspondante dans planning_assignments, et insère INSERT OR IGNORE.
 *
 * Mode par défaut : DRY-RUN (n'écrit rien). Passer --apply pour appliquer.
 *
 * Usage :
 *   node scripts/backfill-task-assignments.mjs            # dry-run
 *   node scripts/backfill-task-assignments.mjs --apply    # exécute
 */

import path from 'node:path';
import url from 'node:url';

import Database from 'better-sqlite3';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
// Par défaut, on cible la DB de l'API (apps/api/vehicules.db).
const DB_PATH =
  process.env.DB_PATH || path.resolve(__dirname, '..', 'apps', 'api', 'vehicules.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const missing = db
  .prepare(
    `SELECT ta.id AS task_id, ta.person_id
       FROM task_assignments ta
      WHERE ta.person_id IS NOT NULL
        AND ta.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM planning_assignments pa
           WHERE pa.entity_type = 'task'
             AND pa.entity_id = ta.id
             AND pa.person_id = ta.person_id
        )`,
  )
  .all();

console.log(`[backfill] ${missing.length} tâche(s) sans entrée planning_assignments.`);

if (!missing.length) {
  console.log('[backfill] Rien à faire.');
  process.exit(0);
}

if (!APPLY) {
  console.log('[backfill] DRY-RUN — aucune écriture. Premières lignes :');
  for (const r of missing.slice(0, 10)) console.log(`  • task=${r.task_id} person=${r.person_id}`);
  console.log('[backfill] Relancer avec --apply pour exécuter.');
  process.exit(0);
}

const insert = db.prepare(
  `INSERT OR IGNORE INTO planning_assignments (id, entity_type, entity_id, person_id)
   VALUES (lower(hex(randomblob(16))), 'task', ?, ?)`,
);

const tx = db.transaction((rows) => {
  let inserted = 0;
  for (const r of rows) {
    const info = insert.run(r.task_id, r.person_id);
    if (info.changes > 0) inserted += 1;
  }
  return inserted;
});

const inserted = tx(missing);
console.log(`[backfill] ✅ ${inserted} ligne(s) insérée(s).`);
