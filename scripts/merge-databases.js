#!/usr/bin/env node
/**
 * Fusion bidirectionnelle des données entre vehicules.db (prod) et vehicules-dev.db (dev)
 *
 * Stratégie :
 *   - Lignes absentes d'un côté → INSERT dans la base qui ne les a pas
 *   - Lignes communes (même PK) → la version avec modified_at le plus récent gagne
 *
 * Tables fusionnées :
 *   reservations, task_assignments, dynamic_display_events,
 *   affaires, planning_affaire_status, persons
 *
 * Usage : node scripts/merge-databases.js [--dry-run]
 */

import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverDir = join(__dirname, '..', 'apps', 'api');

// Resolve better-sqlite3 from apps/api/node_modules
const require = createRequire(join(serverDir, 'package.json'));
const Database = require('better-sqlite3');

const DRY_RUN = process.argv.includes('--dry-run');

const prodPath = join(serverDir, 'vehicules.db');
const devPath = join(serverDir, 'vehicules-dev.db');

const prod = new Database(prodPath);
const dev = new Database(devPath);

prod.pragma('journal_mode = WAL');
dev.pragma('journal_mode = WAL');
prod.pragma('foreign_keys = OFF');
dev.pragma('foreign_keys = OFF');

const stats = { inserted: { prod: 0, dev: 0 }, updated: { prod: 0, dev: 0 }, skipped: 0 };

// ─────────────────────────────────────────
// Helper: get column names for a table
// ─────────────────────────────────────────
function getCols(db, table) {
  return db.pragma(`table_info("${table}")`).map(c => c.name);
}

// ─────────────────────────────────────────
// Helper: build INSERT OR REPLACE statement
// ─────────────────────────────────────────
function buildUpsert(table, cols) {
  const placeholders = cols.map(() => '?').join(', ');
  return `INSERT OR REPLACE INTO "${table}" (${cols.join(', ')}) VALUES (${placeholders})`;
}

// ─────────────────────────────────────────
// Merge a table bidirectionally
// ─────────────────────────────────────────
function mergeTable(table, pkCol, tsCol) {
  console.log(`\n━━━ ${table} (PK: ${pkCol}, TS: ${tsCol || 'none'}) ━━━`);

  const cols = getCols(prod, table);
  const devCols = getCols(dev, table);

  // Use intersection of columns (in case schemas differ slightly)
  const commonCols = cols.filter(c => devCols.includes(c));

  const colList = commonCols.join(', ');
  const prodRows = prod.prepare(`SELECT ${colList} FROM "${table}"`).all();
  const devRows = dev.prepare(`SELECT ${colList} FROM "${table}"`).all();

  const prodMap = new Map(prodRows.map(r => [String(r[pkCol]), r]));
  const devMap = new Map(devRows.map(r => [String(r[pkCol]), r]));

  const upsertProd = buildUpsert(table, commonCols);
  const upsertDev = buildUpsert(table, commonCols);

  let insertedDev = 0, insertedProd = 0, updatedDev = 0, updatedProd = 0, skipped = 0;

  // PROD → DEV : rows only in prod, or newer in prod
  for (const [pk, prodRow] of prodMap) {
    const devRow = devMap.get(pk);
    if (!devRow) {
      // Missing in dev → insert
      if (!DRY_RUN) dev.prepare(upsertDev).run(...commonCols.map(c => prodRow[c]));
      insertedDev++;
    } else if (tsCol && prodRow[tsCol] && devRow[tsCol] && prodRow[tsCol] > devRow[tsCol]) {
      // Prod is newer → update dev
      if (!DRY_RUN) dev.prepare(upsertDev).run(...commonCols.map(c => prodRow[c]));
      updatedDev++;
    } else {
      skipped++;
    }
  }

  // DEV → PROD : rows only in dev, or newer in dev
  for (const [pk, devRow] of devMap) {
    const prodRow = prodMap.get(pk);
    if (!prodRow) {
      // Missing in prod → insert
      if (!DRY_RUN) prod.prepare(upsertProd).run(...commonCols.map(c => devRow[c]));
      insertedProd++;
    } else if (tsCol && devRow[tsCol] && prodRow[tsCol] && devRow[tsCol] > prodRow[tsCol]) {
      // Dev is newer → update prod
      if (!DRY_RUN) prod.prepare(upsertProd).run(...commonCols.map(c => devRow[c]));
      updatedProd++;
    }
    // (equal or no timestamp → already handled above or skipped)
  }

  console.log(`  → DEV : +${insertedDev} inserts, ~${updatedDev} updates`);
  console.log(`  → PROD: +${insertedProd} inserts, ~${updatedProd} updates`);
  console.log(`  → ${skipped} identiques/skipped`);

  stats.inserted.dev += insertedDev;
  stats.inserted.prod += insertedProd;
  stats.updated.dev += updatedDev;
  stats.updated.prod += updatedProd;
  stats.skipped += skipped;
}

// ─────────────────────────────────────────
// Execute
// ─────────────────────────────────────────
console.log(`🔄 Fusion bidirectionnelle${DRY_RUN ? ' (DRY RUN)' : ''}`);
console.log(`   PROD: ${prodPath}`);
console.log(`   DEV:  ${devPath}`);

const prodTx = prod.transaction(() => {
  const devTx = dev.transaction(() => {
    mergeTable('persons',                 'id',               'modified_at');
    mergeTable('affaires',                'id',               'modified_at');
    mergeTable('reservations',            'id',               'modified_at');
    mergeTable('dynamic_display_events',  'id',               'modified_at');
    mergeTable('task_assignments',        'id',               'modified_at');
    mergeTable('planning_affaire_status', 'numero_affaire',   'updated_at');
  });
  devTx();
});
prodTx();

console.log('\n══════════════════════════════════');
console.log('📊 Résumé :');
console.log(`   → DEV : +${stats.inserted.dev} inserts, ~${stats.updated.dev} updates`);
console.log(`   → PROD: +${stats.inserted.prod} inserts, ~${stats.updated.prod} updates`);
console.log(`   ${stats.skipped} lignes identiques`);
console.log(DRY_RUN ? '\n⚠️  Mode dry-run — aucune modification appliquée' : '\n✅ Fusion terminée !');

prod.close();
dev.close();
