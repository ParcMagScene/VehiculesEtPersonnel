#!/usr/bin/env node
/**
 * audit-routes.mjs — Audit des routes API non consommées (heuristique).
 *
 * 1. Scanne apps/api/**\/*.js pour tout `app.METHOD('/api/...'` ou
 *    `router.METHOD('/...')` (les routers Express sont préfixés via app.use,
 *    on ne traite ici que les routes app.METHOD montées en absolu).
 * 2. Recherche chaque path dans apps/web/src/** + apps/tv-client/**.
 * 3. Liste celles jamais référencées.
 *
 * Heuristique — vérifier manuellement avant suppression.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';

const ROOT = process.cwd();
const API_DIR = join(ROOT, 'apps/api');
const WEB_DIR = join(ROOT, 'apps/web/src');
const TV_DIR = join(ROOT, 'apps/tv-client');

const IGNORE = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.vite',
  'database',
]);

async function* walk(dir, depth = 0) {
  if (depth > 12) return;
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (IGNORE.has(name)) continue;
    const full = join(dir, name);
    let s;
    try {
      s = await stat(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) yield* walk(full, depth + 1);
    else yield full;
  }
}

const routes = [];

for await (const file of walk(API_DIR)) {
  if (extname(file) !== '.js') continue;
  if (file.endsWith('.test.js')) continue;
  const src = await readFile(file, 'utf8');
  const lines = src.split('\n');
  const re =
    /\b(app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(re)) {
      const path = m[3];
      if (!path.startsWith('/api')) continue;
      routes.push({
        method: m[2].toUpperCase(),
        path,
        file: relative(ROOT, file),
        line: i + 1,
      });
    }
  }
}

console.log(
  `📋 ${routes.length} routes API absolues détectées (app|router.METHOD '/api/...')`
);

const frontendBlobs = [];
const exts = new Set(['.js', '.jsx', '.ts', '.tsx', '.html']);
for await (const f of walk(WEB_DIR)) {
  if (exts.has(extname(f))) frontendBlobs.push(await readFile(f, 'utf8'));
}
for await (const f of walk(TV_DIR)) {
  if (exts.has(extname(f))) frontendBlobs.push(await readFile(f, 'utf8'));
}
const haystack = frontendBlobs.join('\n');
console.log(`🔎 Recherche dans ${frontendBlobs.length} fichiers frontend\n`);

function isReferenced(routePath) {
  const stripped = routePath.replace(/^\/api/, '') || '/';
  if (
    haystack.includes(`'${stripped}'`) ||
    haystack.includes(`"${stripped}"`) ||
    haystack.includes(`\`${stripped}\``)
  )
    return true;
  const segments = stripped.split('/').filter(Boolean);
  if (segments.length === 0) return true;
  const firstParamIdx = segments.findIndex((s) => s.startsWith(':'));
  const staticPrefix =
    '/' +
    segments
      .slice(0, firstParamIdx === -1 ? segments.length : firstParamIdx)
      .join('/');
  if (staticPrefix.length > 1) {
    if (
      haystack.includes(`'${staticPrefix}`) ||
      haystack.includes(`"${staticPrefix}`) ||
      haystack.includes(`\`${staticPrefix}`)
    )
      return true;
  }
  return false;
}

const unused = routes.filter((r) => !isReferenced(r.path));

if (unused.length === 0) {
  console.log('✅ Toutes les routes API semblent référencées côté frontend');
  process.exit(0);
}

console.log(
  `⚠️  ${unused.length} route(s) non référencée(s) côté frontend :\n`
);
const byFile = new Map();
for (const r of unused) {
  if (!byFile.has(r.file)) byFile.set(r.file, []);
  byFile.get(r.file).push(r);
}
for (const [file, list] of [...byFile.entries()].sort()) {
  console.log(`  ${file}`);
  for (const r of list) {
    console.log(`    ${r.method.padEnd(6)} ${r.path}  (L${r.line})`);
  }
}
console.log(
  '\nℹ️  Audit heuristique — vérifier (mobile, scripts, intégrations externes) avant suppression.'
);
process.exit(0);
