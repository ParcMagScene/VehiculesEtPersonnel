#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/measure-ui-debt.mjs
// Mesure la dette UI/UX (audit Sprint 2) :
//   • Hex colors hardcodées dans CSS hors theme/tokens
//   • rgb()/rgba() hors theme/tokens
//   • Styles inline color/background/border/padding/margin/gap dans JSX
//     hors components/ui/, components/mobile/, DisplayDashboard/
//   • <button> HTML brut hors components/ui/, mobile/, DisplayDashboard/
//   • Px hardcodés (gap/padding/margin: Npx) hors ui/
//
// Usage :
//   node scripts/measure-ui-debt.mjs              → tableau lisible
//   node scripts/measure-ui-debt.mjs --format=summary
//   node scripts/measure-ui-debt.mjs --format=json
//   node scripts/measure-ui-debt.mjs --update     → met à jour
//                                                  docs/dashboards/ui-debt.md
//
// Code 0 toujours (informatif). La CI l'invoque en continue-on-error.
// ─────────────────────────────────────────────────────────────────────────────

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const webRoot = path.join(repoRoot, 'apps/web/src');

const args = new Set(process.argv.slice(2));
const formatArg = [...args].find((a) => a.startsWith('--format='));
const format = formatArg ? formatArg.split('=')[1] : 'table';
const update = args.has('--update');

// Helpers ────────────────────────────────────────────────────────────────────
function grepCount(pattern, opts = {}) {
  const { paths = ['src/components'], exts = ['*.jsx'], excludes = [] } = opts;
  const include = exts.map((e) => `--include=${e}`).join(' ');
  const exclude = excludes.map((p) => `| grep -v '${p}'`).join(' ');
  try {
    const cmd = `grep -rE "${pattern}" ${paths.join(' ')} ${include} ${exclude} | wc -l`;
    const out = execSync(cmd, { cwd: path.join(repoRoot, 'apps/web'), shell: '/bin/bash' });
    return parseInt(String(out).trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function stylelintCount() {
  try {
    const out = execSync(
      'npx stylelint "src/**/*.css" --formatter compact 2>&1 || true',
      { cwd: path.join(repoRoot, 'apps/web'), shell: '/bin/bash', stdio: 'pipe' },
    );
    const lines = String(out).split('\n');
    const hexCount = lines.filter((l) => l.includes('color-no-hex')).length;
    const rgbCount = lines.filter((l) => l.includes('function-disallowed-list')).length;
    return { hexCount, rgbCount };
  } catch {
    return { hexCount: 0, rgbCount: 0 };
  }
}

// Collecte ───────────────────────────────────────────────────────────────────
const stylelint = stylelintCount();

const inlineStyleColor = grepCount(
  'style=\\{\\{[^}]*(color|background|backgroundColor|border|borderColor)',
  {
    paths: ['src/components'],
    exts: ['*.jsx'],
    excludes: ['/ui/', '/mobile/', '/DisplayDashboard/'],
  },
);

const inlineStyleSpacing = grepCount(
  'style=\\{\\{[^}]*(padding|margin|gap)',
  {
    paths: ['src/components'],
    exts: ['*.jsx'],
    excludes: ['/ui/', '/mobile/', '/DisplayDashboard/'],
  },
);

const buttonHtml = grepCount('<button\\b', {
  paths: ['src/components'],
  exts: ['*.jsx'],
  excludes: ['/ui/', '/mobile/', '/DisplayDashboard/'],
});

const pxInCss = grepCount('(gap|padding|margin)[^:]*:\\s*[^;{]*[0-9]+px', {
  paths: ['src/components'],
  exts: ['*.css'],
  excludes: ['/ui/'],
});

const exoticBreakpoints = grepCount(
  '@media[^{]*(480|640|768|1024)px',
  { paths: ['src'], exts: ['*.css'], excludes: [] },
);

const data = {
  generatedAt: new Date().toISOString(),
  stylelint,
  jsx: {
    inlineStyleColorOrBorder: inlineStyleColor,
    inlineStyleSpacing,
    buttonHtmlBrut: buttonHtml,
  },
  css: {
    pxHardcoded: pxInCss,
    exoticBreakpoints,
  },
};

// Sortie ─────────────────────────────────────────────────────────────────────
function renderTable(d) {
  const rows = [
    ['Métrique', 'Valeur', 'Cible'],
    ['─────────────────────────────────────────', '─────', '─────'],
    ['Stylelint hex hors theme (color-no-hex)', d.stylelint.hexCount, '0'],
    ['Stylelint rgb/rgba hors theme', d.stylelint.rgbCount, '0'],
    ['JSX style inline color/border', d.jsx.inlineStyleColorOrBorder, '0'],
    ['JSX style inline padding/margin/gap', d.jsx.inlineStyleSpacing, '0'],
    ['JSX <button> HTML brut hors ui/mobile/dashboard', d.jsx.buttonHtmlBrut, '0'],
    ['CSS gap/padding/margin Npx hors ui/', d.css.pxHardcoded, '<200'],
    ['Media-queries breakpoints exotiques', d.css.exoticBreakpoints, '0'],
  ];
  return rows.map((r) => r.map((c) => String(c).padEnd(50)).join('')).join('\n');
}

function renderSummary(d) {
  return [
    `📊 UI debt @ ${d.generatedAt.split('T')[0]}`,
    `   Stylelint  : ${d.stylelint.hexCount} hex • ${d.stylelint.rgbCount} rgb()`,
    `   JSX inline : ${d.jsx.inlineStyleColorOrBorder} color/border • ${d.jsx.inlineStyleSpacing} spacing`,
    `   <button>   : ${d.jsx.buttonHtmlBrut}`,
    `   CSS px     : ${d.css.pxHardcoded}`,
    `   BP exotic  : ${d.css.exoticBreakpoints}`,
  ].join('\n');
}

if (format === 'json') {
  console.log(JSON.stringify(data, null, 2));
} else if (format === 'summary') {
  console.log(renderSummary(data));
} else {
  console.log(renderTable(data));
}

// --update : injecte un snapshot dans le dashboard MD ────────────────────────
if (update) {
  const dashboardPath = path.join(repoRoot, 'docs/dashboards/ui-debt.md');
  let content;
  try {
    content = readFileSync(dashboardPath, 'utf8');
  } catch {
    content = `# UI Debt Dashboard\n\nGénéré par scripts/measure-ui-debt.mjs.\n\n<!-- snapshots -->\n`;
  }

  const date = data.generatedAt.split('T')[0];
  const snapshot = [
    `## Snapshot ${date}`,
    '',
    '| Métrique | Valeur | Cible |',
    '|---|---:|---:|',
    `| Stylelint hex (color-no-hex) | ${data.stylelint.hexCount} | 0 |`,
    `| Stylelint rgb/rgba | ${data.stylelint.rgbCount} | 0 |`,
    `| JSX inline color/border | ${data.jsx.inlineStyleColorOrBorder} | 0 |`,
    `| JSX inline padding/margin/gap | ${data.jsx.inlineStyleSpacing} | 0 |`,
    `| JSX <button> HTML brut | ${data.jsx.buttonHtmlBrut} | 0 |`,
    `| CSS gap/padding/margin Npx hors ui/ | ${data.css.pxHardcoded} | <200 |`,
    `| Breakpoints exotiques (480/640/768/1024) | ${data.css.exoticBreakpoints} | 0 |`,
    '',
  ].join('\n');

  if (content.includes('<!-- snapshots -->')) {
    content = content.replace('<!-- snapshots -->', `<!-- snapshots -->\n\n${snapshot}`);
  } else {
    content += `\n${snapshot}`;
  }
  writeFileSync(dashboardPath, content);
  console.log(`\n✏️  ${path.relative(repoRoot, dashboardPath)} mis à jour.`);
}
