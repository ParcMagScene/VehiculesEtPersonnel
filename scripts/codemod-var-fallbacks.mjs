#!/usr/bin/env node
// codemod-var-fallbacks.mjs — Supprime les hex servant de fallback dans
// `var(--token, #hex)`. Les tokens sont toujours définis à `:root`,
// donc ces fallbacks sont du bruit qui fait remonter Stylelint color-no-hex.
//
// Avant : color: var(--theme-text-primary, #1e293b);
// Après : color: var(--theme-text-primary);
//
// Usage:
//   node scripts/codemod-var-fallbacks.mjs            # dry-run
//   node scripts/codemod-var-fallbacks.mjs --write    # écrit

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const ROOT = (args.find((a) => a.startsWith('--root=')) || '--root=apps/web/src').slice(7);

const EXCLUDE_FILES = ['theme.css', 'tokens.css'];
const EXCLUDE_DIRS = ['/node_modules/', '/dist/', '/.vite/'];

// Capture `var(--token, FALLBACK)` quand FALLBACK est un hex ou un rgba()/rgb().
// Les tokens étant définis à `:root`, ces fallbacks sont du bruit qui fait
// remonter Stylelint color-no-hex et function-disallowed-list.
const RE_HEX = /var\((--[a-z0-9-]+),\s*#[0-9a-fA-F]{3,8}\)/g;
const RE_RGB = /var\((--[a-z0-9-]+),\s*rgba?\([^)]*\)\)/g;

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

const files = walk(resolve(ROOT));
let total = 0;
let touched = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  let count = 0;
  let out = src.replace(RE_HEX, (_, tok) => {
    count++;
    return `var(${tok})`;
  });
  out = out.replace(RE_RGB, (_, tok) => {
    count++;
    return `var(${tok})`;
  });
  if (!count) continue;
  touched++;
  total += count;
  if (WRITE) writeFileSync(f, out);
  console.log(`${WRITE ? '✏️ ' : '🔍'} ${relative(process.cwd(), f)} — ${count}`);
}
console.log(`\n${WRITE ? 'Écrit' : 'Dry-run'}: ${total} substitutions dans ${touched} fichiers (sur ${files.length}).`);
