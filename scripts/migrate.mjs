#!/usr/bin/env node
/**
 * migrate.mjs — Runner de migrations DB versionnées.
 *
 * Convention :
 *   apps/api/migrations/versioned/NNNN_description.{sql,js}
 *   - NNNN = numéro 4 chiffres croissant (0001, 0002, …)
 *   - .sql : exécuté tel quel via db.exec()
 *   - .js  : module ESM exportant `export default function up(db) { … }`
 *
 * Le runner :
 *  - garantit la table `_migrations(name PK, hash, applied_at)`
 *  - applique en ordre lexicographique tout fichier non encore appliqué
 *  - vérifie le hash : un fichier déjà appliqué dont le contenu a changé
 *    bloque le runner (édition rétroactive interdite).
 *  - chaque migration tourne dans une transaction (rollback en cas d'erreur).
 *
 * Usage :
 *   node scripts/migrate.mjs           # applique
 *   node scripts/migrate.mjs --status  # liste l'état
 *   node scripts/migrate.mjs --dry     # liste ce qui serait appliqué
 *
 * Ne touche PAS aux migrations historiques inline dans apps/api/migrations.js.
 */
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const STATUS = args.has('--status');

const ROOT = process.cwd();
const DB_PATH = resolve(
  process.env.DB_PATH || join(ROOT, 'apps/api/vehicules.db')
);
const MIG_DIR = join(ROOT, 'apps/api/migrations/versioned');

if (!existsSync(MIG_DIR)) {
  mkdirSync(MIG_DIR, { recursive: true });
  console.log(`📁 Création du dossier ${MIG_DIR}`);
}

if (!existsSync(DB_PATH)) {
  console.error(`❌ DB introuvable : ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    hash TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// État courant
const applied = new Map(
  db.prepare('SELECT name, hash, applied_at FROM _migrations').all()
    .map((r) => [r.name, r])
);

// Liste des fichiers
let files;
try {
  files = (await readdir(MIG_DIR))
    .filter((f) => /^\d{4}_.+\.(sql|js|mjs)$/.test(f))
    .sort();
} catch (e) {
  console.error(`❌ Lecture ${MIG_DIR} : ${e.message}`);
  process.exit(1);
}

if (STATUS) {
  console.log(`📂 DB : ${DB_PATH}`);
  console.log(`📋 ${files.length} migration(s) sur disque, ${applied.size} appliquée(s)\n`);
  for (const f of files) {
    const r = applied.get(f);
    if (r) console.log(`  ✅ ${f}  (${r.applied_at})`);
    else console.log(`  ⏳ ${f}  (en attente)`);
  }
  // orphelines (en DB mais plus sur disque)
  const onDisk = new Set(files);
  for (const name of applied.keys()) {
    if (!onDisk.has(name)) console.log(`  ⚠️  ${name}  (appliquée mais fichier absent)`);
  }
  process.exit(0);
}

// Vérification d'intégrité : hash des migrations déjà appliquées
let driftDetected = false;
for (const f of files) {
  const r = applied.get(f);
  if (!r) continue;
  const content = await readFile(join(MIG_DIR, f), 'utf8');
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
  if (hash !== r.hash) {
    console.error(`❌ Migration éditée rétroactivement : ${f}`);
    console.error(`   hash DB    : ${r.hash}`);
    console.error(`   hash actuel: ${hash}`);
    driftDetected = true;
  }
}
if (driftDetected) {
  console.error('\n💡 Créer une nouvelle migration au lieu de modifier une migration appliquée.');
  process.exit(2);
}

// Migrations à appliquer
const pending = files.filter((f) => !applied.has(f));
if (pending.length === 0) {
  console.log('✅ Aucune migration en attente');
  process.exit(0);
}

console.log(`📋 ${pending.length} migration(s) à appliquer :`);
for (const f of pending) console.log(`   - ${f}`);

if (DRY) {
  console.log('\nℹ️  --dry : aucune migration n’a été exécutée');
  process.exit(0);
}

const insert = db.prepare(
  'INSERT INTO _migrations (name, hash) VALUES (?, ?)'
);

for (const name of pending) {
  const file = join(MIG_DIR, name);
  const content = await readFile(file, 'utf8');
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
  console.log(`\n▶️  ${name}`);
  const start = Date.now();
  try {
    if (extname(name) === '.sql') {
      const tx = db.transaction(() => {
        db.exec(content);
        insert.run(name, hash);
      });
      tx();
    } else {
      const mod = await import(pathToFileURL(file).href);
      const up = mod.default || mod.up;
      if (typeof up !== 'function') {
        throw new Error(`pas d'export default ou export up(db)`);
      }
      const tx = db.transaction(() => {
        up(db);
        insert.run(name, hash);
      });
      tx();
    }
    console.log(`   ✅ appliquée en ${Date.now() - start}ms`);
  } catch (e) {
    console.error(`   ❌ échec : ${e.message}`);
    db.close();
    process.exit(1);
  }
}

db.close();
console.log('\n✅ Toutes les migrations sont appliquées');
process.exit(0);
