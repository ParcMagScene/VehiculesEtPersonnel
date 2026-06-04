#!/usr/bin/env node
// codemod-colors.mjs — Remplace les hex neutres par des tokens --theme-*
// avec une analyse propriété-contextuelle (color/background/border/brand).
//
// Règles de sécurité :
//   1. Ne jamais toucher aux hex placés dans un fallback `var(...)` (sémantique
//      différente en dark mode).
//   2. Le mapping dépend de la propriété CSS (color → text-*, background → bg-*,
//      border → border-*) ; les couleurs de marque s'appliquent partout.
//   3. Les fichiers theme.css / tokens.css sont exclus.
//
// Usage :
//   node scripts/codemod-colors.mjs            # dry-run
//   node scripts/codemod-colors.mjs --write    # écrit
//   node scripts/codemod-colors.mjs --root=apps/web/src

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const ROOT = (args.find((a) => a.startsWith('--root=')) || '--root=apps/web/src').slice(7);

const EXCLUDE_FILES = ['theme.css', 'tokens.css'];
const EXCLUDE_DIRS = ['/node_modules/', '/dist/', '/.vite/'];

const TEXT_MAP = {
  '#1e293b': 'var(--theme-text-primary)',
  '#64748b': 'var(--theme-text-secondary)',
  '#657686': 'var(--theme-text-muted)',
  '#111827': 'var(--theme-text-heading)',
  '#334155': 'var(--theme-text-dark)',
  '#374151': 'var(--theme-text-body)',
  '#475569': 'var(--theme-text-subtle)',
  '#6b7280': 'var(--theme-text-gray)',
};

const BG_MAP = {
  '#f9fafb': 'var(--theme-bg-secondary)',
  '#f3f4f6': 'var(--theme-bg-tertiary)',
  '#1f2937': 'var(--theme-bg-dark)',
  '#111827': 'var(--theme-bg-darker)',
  '#f8fafc': 'var(--theme-bg-page)',
  '#cbd5e1': 'var(--theme-bg-muted)',
};

const BORDER_MAP = {
  '#e5e7eb': 'var(--theme-border-medium)',
  '#d1d5db': 'var(--theme-border-muted)',
  '#e2e8f0': 'var(--theme-border)',
  '#f1f5f9': 'var(--theme-border-light)',
};

const BRAND_MAP = {
  '#667eea': 'var(--theme-primary)',
  '#3b82f6': 'var(--theme-info)',
  '#2563eb': 'var(--theme-info-dark)',
  '#f59e0b': 'var(--theme-warning)',
  '#d97706': 'var(--theme-warning-dark)',
};

function classify(prop) {
  const p = prop.toLowerCase();
  if (p === 'color') return 'text';
  if (p === 'background' || p === 'background-color') return 'bg';
  if (p === 'border' || p.startsWith('border-')) return 'border';
  return 'other';
}

function pickToken(hex, kind) {
  const k = hex.toLowerCase();
  if (BRAND_MAP[k]) return BRAND_MAP[k];
  if (kind === 'text') return TEXT_MAP[k];
  if (kind === 'bg') return BG_MAP[k];
  if (kind === 'border') return BORDER_MAP[k];
  return null;
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const norm = '/' + relative(process.cwd(), p);
    if (EXCLUDE_DIRS.some((x) => norm.includes(x))) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (e.endsWith('.css') && !EXCLUDE_FILES.includes(e)) out.push(p);
  }
  return out;
}

const HEX_RE = /#([0-9a-fA-F]{6})\b/g;
const PROP_RE = /^(\s*)([a-z-]+)(\s*:\s*)(.+)$/;

function processFile(file) {
  const src = readFileSync(file, 'utf8');
  let count = 0;
  const lines = src.split('\n').map((line) => {
    if (!line.includes('#')) return line;
    const m = line.match(PROP_RE);
    if (!m) return line;
    const [, indent, prop, sep, rest] = m;
    const kind = classify(prop);
    if (kind === 'other') return line;
    const masks = [];
    const masked = rest.replace(/var\([^)]*\)/g, (mm) => {
      masks.push(mm);
      return `\u0000${masks.length - 1}\u0000`;
    });
    const replaced = masked.replace(HEX_RE, (mm) => {
      const tok = pickToken(mm, kind);
      if (!tok) return mm;
      count++;
      return tok;
    });
    const restored = replaced.replace(/\u0000(\d+)\u0000/g, (_, i) => masks[Number(i)]);
    return `${indent}${prop}${sep}${restored}`;
  });
  return { count, output: lines.join('\n') };
}

const files = walk(resolve(ROOT));
let total = 0;
let touched = 0;
for (const f of files) {
  const { count, output } = processFile(f);
  if (!count) continue;
  touched++;
  total += count;
  if (WRITE) writeFileSync(f, output);
  console.log(`${WRITE ? '✏️ ' : '🔍'} ${relative(process.cwd(), f)} — ${count}`);
}
console.log(`\n${WRITE ? 'Écrit' : 'Dry-run'}: ${total} substitutions dans ${touched} fichiers (sur ${files.length}).`);
