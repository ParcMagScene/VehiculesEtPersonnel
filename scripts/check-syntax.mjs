#!/usr/bin/env node
/**
 * check-syntax.mjs — Vérifie la syntaxe ESM de tous les fichiers JS backend
 * via `node --check`.
 *
 * Bloque les corruptions courantes côté API :
 *  - accolades non fermées
 *  - blocs incomplets / fragments orphelins
 *  - imports cassés
 *
 * Côté frontend (.jsx), c'est ESLint+Babel parser qui couvre déjà la syntaxe.
 *
 * Usage : node scripts/check-syntax.mjs
 * Exit 0 si tout OK, 1 sinon.
 */
import { readdir, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.vite',
  '_backups_local',
  'backups',
  'archive',
  'data',
  'database',
  'display',
  'display-data',
]);

async function* walk(dir) {
  const entries = await readdir(dir);
  for (const name of entries) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    let s;
    try {
      s = await stat(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const errors = [];
const backendFiles = [];

for await (const file of walk(join(ROOT, 'apps/api'))) {
  if (extname(file) === '.js') backendFiles.push(file);
}

console.log(`🔍 Backend : ${backendFiles.length} fichiers .js`);

for (const file of backendFiles) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) {
    errors.push({ file: relative(ROOT, file), msg: r.stderr.trim() });
  }
}

if (errors.length === 0) {
  console.log('✅ Aucune erreur de syntaxe détectée');
  process.exit(0);
}

console.error(`\n❌ ${errors.length} erreur(s) de syntaxe :\n`);
for (const e of errors) {
  console.error(`  ${e.file}`);
  console.error(`    ${e.msg.split('\n').slice(0, 3).join('\n    ')}\n`);
}
process.exit(1);
