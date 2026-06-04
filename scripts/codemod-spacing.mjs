#!/usr/bin/env node
// codemod-spacing.mjs — Remplace dans les déclarations CSS gap/padding/margin
// les valeurs Npx connues par var(--space-N).
//
// Usage:
//   node scripts/codemod-spacing.mjs            # affiche les changements
//   node scripts/codemod-spacing.mjs --write    # écrit les fichiers
//   node scripts/codemod-spacing.mjs --root=apps/web/src/components

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const ROOT = (args.find((a) => a.startsWith('--root=')) || '--root=apps/web/src/components').slice(7);
const EXCLUDE = ['/ui/', '/mobile/', '/DisplayDashboard/', '/node_modules/'];

// Mapping px → var(--space-N)
const PX_TO_TOKEN = new Map([
  [0, '0'],
  [4, 'var(--space-1)'],
  [8, 'var(--space-2)'],
  [12, 'var(--space-3)'],
  [16, 'var(--space-4)'],
  [20, 'var(--space-5)'],
  [24, 'var(--space-6)'],
  [28, 'var(--space-7)'],
  [32, 'var(--space-8)'],
  [36, 'var(--space-9)'],
  [40, 'var(--space-10)'],
  [48, 'var(--space-12)'],
  [56, 'var(--space-14)'],
  [64, 'var(--space-16)'],
  [80, 'var(--space-20)'],
  [96, 'var(--space-24)'],
]);

const PROP_RE = /^(\s*)(gap|column-gap|row-gap|padding(?:-top|-right|-bottom|-left|-inline|-block|-inline-start|-inline-end|-block-start|-block-end)?|margin(?:-top|-right|-bottom|-left|-inline|-block|-inline-start|-inline-end|-block-start|-block-end)?)(\s*:\s*)([^;]+?)(\s*;.*)?$/;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const rel = '/' + relative(process.cwd(), p);
    if (EXCLUDE.some((x) => rel.includes(x))) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (e.endsWith('.css')) out.push(p);
  }
  return out;
}

function transformValue(value) {
  // Tokens séparés par espace (ex: "8px 12px"). Conserve le reste tel quel.
  return value.replace(/\b(-?)(\d+)px\b/g, (m, sign, n) => {
    if (sign === '-') return m; // ne touche pas aux valeurs négatives
    const v = Number(n);
    if (!PX_TO_TOKEN.has(v)) return m;
    if (v === 0) return '0';
    return PX_TO_TOKEN.get(v);
  });
}

function processFile(file) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  let changed = 0;
  const out = lines.map((line) => {
    const m = line.match(PROP_RE);
    if (!m) return line;
    const [, indent, prop, sep, value, tail = ''] = m;
    // ne pas toucher aux valeurs déjà tokenisées ou contenant calc/var/percentage seuls
    if (!/\d+px/.test(value)) return line;
    const newValue = transformValue(value);
    if (newValue === value) return line;
    changed++;
    return `${indent}${prop}${sep}${newValue}${tail}`;
  });
  return { changed, output: out.join('\n') };
}

const files = walk(resolve(ROOT));
let totalChanged = 0;
let filesChanged = 0;
for (const f of files) {
  const { changed, output } = processFile(f);
  if (!changed) continue;
  filesChanged++;
  totalChanged += changed;
  if (WRITE) writeFileSync(f, output);
  console.log(`${WRITE ? '✏️ ' : '🔍'} ${relative(process.cwd(), f)} — ${changed} substitutions`);
}
console.log(`\n${WRITE ? 'Écrit' : 'Dry-run'}: ${totalChanged} substitutions dans ${filesChanged} fichiers (sur ${files.length}).`);
