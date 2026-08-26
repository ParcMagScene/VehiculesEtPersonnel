#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const assetsDir = path.join(root, 'apps', 'web', 'dist', 'assets');

const strict = process.argv.includes('--strict');

const BUDGETS = {
  indexJsMax: 300_000,
  indexCssMax: 230_000,
  totalJsMax: 4_300_000,
  totalCssMax: 1_550_000,
};

function fmt(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

if (!fs.existsSync(assetsDir)) {
  console.error('Bundle introuvable: exécutez d\'abord le build web.');
  process.exit(2);
}

const entries = fs.readdirSync(assetsDir);
const js = entries
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ file: f, size: fs.statSync(path.join(assetsDir, f)).size }));
const css = entries
  .filter((f) => f.endsWith('.css'))
  .map((f) => ({ file: f, size: fs.statSync(path.join(assetsDir, f)).size }));

const totalJs = js.reduce((acc, cur) => acc + cur.size, 0);
const totalCss = css.reduce((acc, cur) => acc + cur.size, 0);

const indexJs = js
  .filter((f) => f.file.startsWith('index-'))
  .sort((a, b) => b.size - a.size)[0];
const indexCss = css
  .filter((f) => f.file.startsWith('index-'))
  .sort((a, b) => b.size - a.size)[0];

const checks = [
  {
    name: 'index JS',
    actual: indexJs?.size || 0,
    budget: BUDGETS.indexJsMax,
    file: indexJs?.file || 'N/A',
  },
  {
    name: 'index CSS',
    actual: indexCss?.size || 0,
    budget: BUDGETS.indexCssMax,
    file: indexCss?.file || 'N/A',
  },
  { name: 'total JS', actual: totalJs, budget: BUDGETS.totalJsMax, file: 'dist/assets/*.js' },
  {
    name: 'total CSS',
    actual: totalCss,
    budget: BUDGETS.totalCssMax,
    file: 'dist/assets/*.css',
  },
];

let failed = 0;

console.log('Bundle budget report');
console.log('====================');
for (const c of checks) {
  const ok = c.actual <= c.budget;
  const state = ok ? 'OK' : 'OVER';
  if (!ok) failed += 1;
  console.log(
    `${state.padEnd(4)} ${c.name.padEnd(10)} ${fmt(c.actual).padStart(10)} / ${fmt(c.budget).padStart(10)}  (${c.file})`,
  );
}

if (failed > 0) {
  const msg = `${failed} budget(s) dépassé(s).`;
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
}
