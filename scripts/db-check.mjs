#!/usr/bin/env node
/**
 * db-check.mjs — Audit DB read-only.
 *
 * Vérifie sans toucher aux données :
 *  - intégrité physique (PRAGMA integrity_check)
 *  - intégrité référentielle (PRAGMA foreign_key_check)
 *  - colonnes FK sans index (perf + risque corruption)
 *  - tables sans PRIMARY KEY (perf + risque doublon)
 *
 * Usage : node scripts/db-check.mjs [chemin/db.sqlite]
 * Default : apps/api/vehicules.db (ou $DB_PATH)
 */
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const dbArg = process.argv[2];
const dbPath = resolve(
  dbArg || process.env.DB_PATH || 'apps/api/vehicules.db'
);

if (!existsSync(dbPath)) {
  console.error(`❌ DB introuvable : ${dbPath}`);
  process.exit(1);
}

console.log(`📂 Audit : ${dbPath}\n`);
const db = new Database(dbPath, { readonly: true, fileMustExist: true });

let problems = 0;

// 1. integrity_check
process.stdout.write('🔍 PRAGMA integrity_check… ');
const integrity = db.pragma('integrity_check');
const integrityOk =
  integrity.length === 1 && integrity[0].integrity_check === 'ok';
if (integrityOk) {
  console.log('✅ ok');
} else {
  console.log('❌');
  for (const row of integrity) console.log(`   ${JSON.stringify(row)}`);
  problems++;
}

// 2. foreign_key_check (warning only — dette historique tolérée)
process.stdout.write('🔍 PRAGMA foreign_key_check… ');
const fkErrors = db.pragma('foreign_key_check');
if (fkErrors.length === 0) {
  console.log('✅ aucune violation');
} else {
  console.log(`⚠️  ${fkErrors.length} violation(s) (non bloquant — dette technique)`);
  const sample = fkErrors.slice(0, 10);
  for (const row of sample) console.log(`   ${JSON.stringify(row)}`);
  if (fkErrors.length > 10) console.log(`   … +${fkErrors.length - 10}`);
}

// 3. FK sans index
console.log('\n🔍 Colonnes FK sans index couvrant…');
const tables = db
  .prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  )
  .all();

const fkMissingIndex = [];
for (const { name: table } of tables) {
  const fks = db.pragma(`foreign_key_list(${JSON.stringify(table)})`);
  if (fks.length === 0) continue;
  const indexes = db.pragma(`index_list(${JSON.stringify(table)})`);
  const indexedCols = new Set();
  for (const idx of indexes) {
    const cols = db.pragma(`index_info(${JSON.stringify(idx.name)})`);
    if (cols.length > 0) indexedCols.add(cols[0].name); // 1ère colonne suffit
  }
  for (const fk of fks) {
    if (!indexedCols.has(fk.from)) {
      fkMissingIndex.push(`${table}.${fk.from} → ${fk.table}.${fk.to}`);
    }
  }
}
if (fkMissingIndex.length === 0) {
  console.log('   ✅ toutes les FK sont indexées');
} else {
  console.log(`   ⚠️  ${fkMissingIndex.length} FK sans index :`);
  for (const f of fkMissingIndex) console.log(`      - ${f}`);
  // perf only — pas un échec
}

// 4. Tables sans PK
console.log('\n🔍 Tables sans PRIMARY KEY…');
const noPk = [];
for (const { name: table } of tables) {
  const cols = db.pragma(`table_info(${JSON.stringify(table)})`);
  if (!cols.some((c) => c.pk > 0)) noPk.push(table);
}
if (noPk.length === 0) {
  console.log('   ✅ toutes les tables ont une PK');
} else {
  console.log(`   ⚠️  ${noPk.length} table(s) sans PK :`);
  for (const t of noPk) console.log(`      - ${t}`);
}

db.close();

console.log('');
if (problems > 0) {
  console.error(`❌ ${problems} problème(s) bloquant(s)`);
  process.exit(1);
}
console.log('✅ DB saine (warnings perf éventuels ci-dessus)');
process.exit(0);
