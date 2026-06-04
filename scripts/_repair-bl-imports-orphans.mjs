#!/usr/bin/env node
/**
 * Rattrapage des bl_imports orphelins (affaire_id NULL ou '').
 *
 * Stratégie :
 *   1. Sélectionne tous les imports dont affaire_id IS NULL ou ''.
 *   2. Tente d'extraire AFxxxxx du nom de fichier (pattern /AF[-_\s]?(\d{4,6})/i).
 *   3. Vérifie que l'affaire AFxxxxx existe dans la table `affaires`.
 *   4. En mode --apply : UPDATE bl_imports SET affaire_id = ? WHERE id = ?.
 *
 * Dry-run par défaut. --apply pour exécuter. Backup auto avant --apply.
 *
 * Usage :
 *   node scripts/_repair-bl-imports-orphans.mjs            # dry-run (DB par défaut)
 *   node scripts/_repair-bl-imports-orphans.mjs --apply    # exécute, avec backup
 *   node scripts/_repair-bl-imports-orphans.mjs --db=apps/api/vehicules-dev.db --apply
 *   node scripts/_repair-bl-imports-orphans.mjs --no-backup --apply   # déconseillé
 *
 * Sortie : stats nb total / matchés / affaires existantes / appliqués / skip / erreurs.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// ─── Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const NO_BACKUP = args.includes('--no-backup');
const dbArg = args.find((a) => a.startsWith('--db='));
const DB_PATH = path.resolve(
  repoRoot,
  dbArg ? dbArg.slice('--db='.length) : 'apps/api/vehicules.db',
);

// ─── Helper ──────────────────────────────────────────────────────────────
function extractAFFromFilename(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const m = filename.match(/AF[-_\s]?(\d{4,6})/i);
  return m ? `AF${m[1]}` : null;
}

// ─── Sanity checks ───────────────────────────────────────────────────────
if (!fs.existsSync(DB_PATH)) {
  console.error(`✗ DB introuvable : ${DB_PATH}`);
  process.exit(2);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Rattrapage bl_imports orphelins`);
console.log(`  DB    : ${DB_PATH}`);
console.log(`  Mode  : ${APPLY ? 'APPLY (écriture)' : 'DRY-RUN (lecture seule)'}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ─── Backup auto si --apply ──────────────────────────────────────────────
if (APPLY && !NO_BACKUP) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(repoRoot, 'backups', 'db');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `${path.basename(DB_PATH, '.db')}.pre-repair-bp-orphans.${stamp}.db`,
  );
  // sqlite .backup pour une copie cohérente même si DB en cours d'utilisation
  try {
    execSync(`sqlite3 "${DB_PATH}" ".backup '${backupPath}'"`, { stdio: 'pipe' });
  } catch (_) {
    // fallback copie brute
    fs.copyFileSync(DB_PATH, backupPath);
  }
  console.log(`✓ Backup créé : ${path.relative(repoRoot, backupPath)}`);
  console.log('');
}

// ─── Ouverture DB ────────────────────────────────────────────────────────
const db = new Database(DB_PATH, { readonly: !APPLY });

const orphans = db
  .prepare(
    `SELECT id, filename, affaire_id, doc_type, created_at
     FROM bl_imports
     WHERE affaire_id IS NULL OR TRIM(COALESCE(affaire_id, '')) = ''
     ORDER BY created_at DESC`,
  )
  .all();

if (orphans.length === 0) {
  console.log('✓ Aucun orphelin trouvé. Rien à faire.');
  db.close();
  process.exit(0);
}

console.log(`Orphelins détectés : ${orphans.length}\n`);

const affaireExists = db.prepare(
  'SELECT 1 FROM affaires WHERE numero_affaire = ? LIMIT 1',
);
const updateStmt = db.prepare('UPDATE bl_imports SET affaire_id = ? WHERE id = ?');

let matched = 0;
let unmatched = 0;
let missingAffaire = 0;
let applied = 0;
const noMatchSamples = [];
const missingSamples = [];

const applyAll = db.transaction((rows) => {
  for (const row of rows) {
    const af = extractAFFromFilename(row.filename);
    if (!af) {
      unmatched++;
      if (noMatchSamples.length < 10) noMatchSamples.push(row.filename);
      continue;
    }
    matched++;
    const exists = affaireExists.get(af);
    if (!exists) {
      missingAffaire++;
      if (missingSamples.length < 10) {
        missingSamples.push(`${af} ← ${row.filename}`);
      }
      continue;
    }
    if (APPLY) {
      updateStmt.run(af, row.id);
      applied++;
    }
  }
});

applyAll(orphans);

// ─── Rapport ─────────────────────────────────────────────────────────────
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Résumé :');
console.log(`  Orphelins              : ${orphans.length}`);
console.log(`  Filename → AFxxxxx OK  : ${matched}`);
console.log(`  Filename sans AF       : ${unmatched}`);
console.log(`  AF inconnu en DB       : ${missingAffaire}`);
const eligibles = matched - missingAffaire;
console.log(`  Éligibles UPDATE       : ${eligibles}`);
if (APPLY) {
  console.log(`  ✓ Appliqués            : ${applied}`);
} else {
  console.log(`  (dry-run, aucun UPDATE — relancer avec --apply)`);
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (noMatchSamples.length > 0) {
  console.log('\nÉchantillons filename sans AF :');
  for (const s of noMatchSamples) console.log(`  - ${s}`);
}
if (missingSamples.length > 0) {
  console.log('\nÉchantillons AF inconnu :');
  for (const s of missingSamples) console.log(`  - ${s}`);
}

db.close();
process.exit(0);
