#!/usr/bin/env node

/**
 * audit-css.js — Audit de conformité Design System
 * 
 * Scanne le codebase frontend pour détecter les déviations
 * par rapport au design system (tokens, composants, styles inline).
 * 
 * Usage :
 *   node scripts/audit-css.js              # Rapport complet
 *   node scripts/audit-css.js --summary    # Résumé uniquement
 *   node scripts/audit-css.js --json       # Sortie JSON
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';

const WEB_SRC = join(import.meta.dirname, '..', 'apps', 'web', 'src');
const SUMMARY_ONLY = process.argv.includes('--summary');
const JSON_OUTPUT = process.argv.includes('--json');

/* ═══════════════════════════════════════════════════════
   1. Collecte des fichiers
   ═══════════════════════════════════════════════════════ */

function walk(dir, exts) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full, exts));
    } else if (exts.includes(extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

/* ═══════════════════════════════════════════════════════
   2. Détection des déviations CSS
   ═══════════════════════════════════════════════════════ */

// Patterns de valeurs non tokenisées
const HEX_COLOR = /#(?:[0-9a-fA-F]{3,8})\b/g;
const RGBA_FUNC = /rgba?\s*\(/g;
const HSLA_FUNC = /hsla?\s*\(/g;
const HARDCODED_PX = /(?<!var\([^)]*)\b(\d{2,})px\b/g;
const NAMED_COLORS = /\b(red|blue|green|yellow|orange|purple|pink|gray|grey|black|white|cyan|magenta|brown|olive|navy|teal|silver|maroon)\b/gi;

// Fichiers exemptés (tokens eux-mêmes)
const EXEMPT_FILES = ['theme.css', 'theme-palettes.css', 'theme-vscode.css', 'theme-density.css', 'theme-tv.css', 'tokens.css'];

function auditCssFile(filePath, content) {
  const issues = [];
  const rel = relative(WEB_SRC, filePath);
  
  if (EXEMPT_FILES.some(f => rel.endsWith(f))) return issues;

  const lines = content.split('\n');
  
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();
    
    // Skip comments
    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) return;
    // Skip custom property definitions
    if (trimmed.startsWith('--')) return;

    // Hex colors
    let match;
    while ((match = HEX_COLOR.exec(line)) !== null) {
      // Skip inside var()
      const before = line.slice(0, match.index);
      if (before.includes('var(') && !before.slice(before.lastIndexOf('var(')).includes(')')) continue;
      issues.push({ file: rel, line: lineNum, rule: 'color-no-hex', value: match[0], suggestion: 'Utiliser var(--theme-*)' });
    }

    // rgba/rgb functions
    while ((match = RGBA_FUNC.exec(line)) !== null) {
      const before = line.slice(0, match.index);
      if (before.includes('var(') && !before.slice(before.lastIndexOf('var(')).includes(')')) continue;
      issues.push({ file: rel, line: lineNum, rule: 'function-disallowed', value: 'rgba()', suggestion: 'Utiliser var(--shadow-*) ou var(--theme-*-bg)' });
    }
    while ((match = HSLA_FUNC.exec(line)) !== null) {
      issues.push({ file: rel, line: lineNum, rule: 'function-disallowed', value: 'hsla()', suggestion: 'Utiliser var(--theme-*)' });
    }

    // Named colors (hors custom properties)
    while ((match = NAMED_COLORS.exec(line)) !== null) {
      // Skip in selectors and comments
      if (trimmed.includes('{') || trimmed.startsWith('.') || trimmed.startsWith('#')) continue;
      // Skip in custom property values or names
      if (trimmed.startsWith('--')) continue;
      issues.push({ file: rel, line: lineNum, rule: 'color-named', value: match[0], suggestion: 'Utiliser var(--theme-*) ou var(--theme-text-inverse) pour white' });
    }

    // Hardcoded z-index
    const zMatch = line.match(/z-index\s*:\s*(\d+)/);
    if (zMatch) {
      issues.push({ file: rel, line: lineNum, rule: 'z-index-no-literal', value: `z-index: ${zMatch[1]}`, suggestion: 'Utiliser var(--z-*)' });
    }
  });

  return issues;
}

/* ═══════════════════════════════════════════════════════
   3. Détection des styles inline (.jsx)
   ═══════════════════════════════════════════════════════ */

const INLINE_STYLE = /style\s*=\s*\{\s*\{/g;
const INLINE_STYLE_VAR = /style\s*=\s*\{[^}]*\}/g;

function auditJsxFile(filePath, content) {
  const issues = [];
  const rel = relative(WEB_SRC, filePath);
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    
    // Detect style={{ ... }} with hardcoded values
    if (/style\s*=\s*\{\s*\{/.test(line)) {
      // Check if it contains hardcoded colors
      if (HEX_COLOR.test(line) || /['"](?:red|blue|green|white|black|gray|grey|#[0-9a-f]{3,8})[']/i.test(line)) {
        issues.push({ file: rel, line: lineNum, rule: 'no-inline-hardcoded-color', value: line.trim().slice(0, 80), suggestion: 'Utiliser une classe CSS avec var(--token)' });
      }
      // Check for hardcoded spacing
      if (/['"]?\d+px['"]?/.test(line) && !/var\(/.test(line)) {
        issues.push({ file: rel, line: lineNum, rule: 'no-inline-hardcoded-spacing', value: line.trim().slice(0, 80), suggestion: 'Utiliser une classe CSS avec var(--space-*)' });
      }
    }
  });

  return issues;
}

/* ═══════════════════════════════════════════════════════
   4. Détection des composants locaux dupliquant le DS
   ═══════════════════════════════════════════════════════ */

const DS_COMPONENTS = ['Button', 'Input', 'Select', 'Modal', 'Panel', 'Card', 'Table', 'Tabs', 'Tag', 'Badge', 'Drawer', 'Dialog', 'Checkbox', 'Accordion', 'Tooltip'];
const DS_IMPORT_PATH = /from\s+['"]\.\.\/.*ui['"]/;

function auditComponentImports(filePath, content) {
  const issues = [];
  const rel = relative(WEB_SRC, filePath);
  
  // Skip design-system files themselves
  if (rel.includes('components/ui/') || rel.includes('design-system/')) return issues;

  for (const comp of DS_COMPONENTS) {
    // Local re-implementation detection: check for `function CompName` or `const CompName =` 
    // that isn't importing from ui
    const localDef = new RegExp(`(?:function|const)\\s+${comp}\\s*[=(]`, 'g');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (localDef.test(line)) {
        issues.push({
          file: rel,
          line: idx + 1,
          rule: 'no-local-ds-duplicate',
          value: comp,
          suggestion: `import { ${comp} } from '@/design-system'`
        });
      }
    });
  }

  return issues;
}

/* ═══════════════════════════════════════════════════════
   5. Exécution
   ═══════════════════════════════════════════════════════ */

const cssFiles = walk(WEB_SRC, ['.css']);
const jsxFiles = walk(WEB_SRC, ['.jsx', '.js']).filter(f => !f.includes('node_modules'));

const allIssues = [];

for (const f of cssFiles) {
  const content = readFileSync(f, 'utf-8');
  allIssues.push(...auditCssFile(f, content));
}

for (const f of jsxFiles) {
  const content = readFileSync(f, 'utf-8');
  allIssues.push(...auditJsxFile(f, content));
  allIssues.push(...auditComponentImports(f, content));
}

/* ═══════════════════════════════════════════════════════
   6. Rapport
   ═══════════════════════════════════════════════════════ */

if (JSON_OUTPUT) {
  console.log(JSON.stringify({ total: allIssues.length, issues: allIssues }, null, 2));
  process.exit(allIssues.length > 0 ? 1 : 0);
}

// Regrouper par règle
const byRule = {};
for (const issue of allIssues) {
  byRule[issue.rule] = byRule[issue.rule] || [];
  byRule[issue.rule].push(issue);
}

// Regrouper par fichier
const byFile = {};
for (const issue of allIssues) {
  byFile[issue.file] = byFile[issue.file] || [];
  byFile[issue.file].push(issue);
}

console.log('');
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║        AUDIT CSS — CONFORMITÉ DESIGN SYSTEM         ║');
console.log('╠══════════════════════════════════════════════════════╣');
console.log(`║  Fichiers CSS scannés  : ${String(cssFiles.length).padStart(5)}                    ║`);
console.log(`║  Fichiers JSX scannés  : ${String(jsxFiles.length).padStart(5)}                    ║`);
console.log(`║  Violations totales    : ${String(allIssues.length).padStart(5)}                    ║`);
console.log('╚══════════════════════════════════════════════════════╝');
console.log('');

// Par règle
console.log('┌──────────────────────────────────────────────────────┐');
console.log('│  VIOLATIONS PAR RÈGLE                                │');
console.log('├──────────────────────────────────────────────────────┤');
const sortedRules = Object.entries(byRule).sort((a, b) => b[1].length - a[1].length);
for (const [rule, items] of sortedRules) {
  console.log(`│  ${String(items.length).padStart(5)}  ${rule.padEnd(44)} │`);
}
console.log('└──────────────────────────────────────────────────────┘');
console.log('');

// Top fichiers non conformes
console.log('┌──────────────────────────────────────────────────────┐');
console.log('│  TOP 20 FICHIERS NON CONFORMES                       │');
console.log('├──────────────────────────────────────────────────────┤');
const sortedFiles = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length).slice(0, 20);
for (const [file, items] of sortedFiles) {
  const display = file.length > 44 ? '…' + file.slice(-43) : file;
  console.log(`│  ${String(items.length).padStart(5)}  ${display.padEnd(44)} │`);
}
console.log('└──────────────────────────────────────────────────────┘');
console.log('');

// Détails (sauf --summary)
if (!SUMMARY_ONLY) {
  console.log('┌──────────────────────────────────────────────────────┐');
  console.log('│  DÉTAILS (premiers 50)                                │');
  console.log('├──────────────────────────────────────────────────────┤');
  for (const issue of allIssues.slice(0, 50)) {
    console.log(`│  ${issue.file}:${issue.line}`);
    console.log(`│    ⚠ [${issue.rule}] ${issue.value}`);
    console.log(`│    → ${issue.suggestion}`);
    console.log('│');
  }
  console.log('└──────────────────────────────────────────────────────┘');
}

// Recommandations
console.log('');
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║  RECOMMANDATIONS                                     ║');
console.log('╠══════════════════════════════════════════════════════╣');
if (byRule['color-no-hex']?.length) {
  console.log(`║  • ${byRule['color-no-hex'].length} couleurs hex → migrer vers var(--theme-*)    ║`);
}
if (byRule['function-disallowed']?.length) {
  console.log(`║  • ${byRule['function-disallowed'].length} rgba/rgb() → migrer vers tokens shadow/bg    ║`);
}
if (byRule['z-index-no-literal']?.length) {
  console.log(`║  • ${byRule['z-index-no-literal'].length} z-index littéraux → var(--z-*)            ║`);
}
if (byRule['no-inline-hardcoded-color']?.length) {
  console.log(`║  • ${byRule['no-inline-hardcoded-color'].length} styles inline avec couleurs hard-codées  ║`);
}
if (byRule['no-local-ds-duplicate']?.length) {
  console.log(`║  • ${byRule['no-local-ds-duplicate'].length} composants locaux dupliquant le DS         ║`);
}
console.log('║                                                      ║');
console.log('║  Priorité de migration :                              ║');
console.log('║  1. components/ui/ (source DS) → 0 violations        ║');
console.log('║  2. layouts/ → 0 violations                          ║');
console.log('║  3. Modules les plus utilisés en premier              ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log('');

process.exit(allIssues.length > 0 ? 1 : 0);
