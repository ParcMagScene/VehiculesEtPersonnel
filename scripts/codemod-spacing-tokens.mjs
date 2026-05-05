#!/usr/bin/env node
/**
 * Codemod: remplace `padding`/`margin` Npx par tokens spacing dans un .css
 * - Ne touche QUE les déclarations padding|margin (incl. variantes -top/-bottom/-left/-right/-inline/-block/-block-start/...)
 * - Ne remplace QUE les valeurs présentes dans MAP (autres valeurs px préservées)
 * - Préserve formatting/commentaires/règles non concernées
 *
 * Usage: node scripts/codemod-spacing-tokens.mjs <file1.css> [file2.css...]
 */
import fs from 'node:fs';
import path from 'node:path';

const MAP = {
  '0px': '0',
  '2px': 'var(--space-0-5)',
  '4px': 'var(--space-1)',
  '6px': 'var(--space-1-5)',
  '8px': 'var(--space-2)',
  '10px': 'var(--space-2-5)',
  '12px': 'var(--space-3)',
  '14px': 'var(--space-3-5)',
  '16px': 'var(--space-4)',
  '20px': 'var(--space-5)',
  '24px': 'var(--space-6)',
  '28px': 'var(--space-7)',
  '32px': 'var(--space-8)',
  '36px': 'var(--space-9)',
  '40px': 'var(--space-10)',
  '48px': 'var(--space-12)',
  '56px': 'var(--space-14)',
  '64px': 'var(--space-16)',
  '80px': 'var(--space-20)',
  '96px': 'var(--space-24)',
};

// Matche une déclaration padding/margin (et variantes) : capture nom, valeur, ;
const DECL_RE =
  /\b(padding|margin)(-(?:top|bottom|left|right|inline|block|inline-start|inline-end|block-start|block-end))?\s*:\s*([^;{}\n]+?)\s*(;|\}|$)/g;

// Tokenise une valeur shorthand et remplace les Npx mappables
function rewriteValue(value) {
  // Tokens séparés par espaces (ne casse pas calc(...) car on évite si présent)
  if (/calc\s*\(/i.test(value) || /var\s*\(/i.test(value) || /[+\-*/]/.test(value.replace(/-?\d/g, ''))) {
    // Présence d'opérateurs / calc / var → on ne touche pas
    return { value, changed: 0 };
  }
  let changed = 0;
  const parts = value.split(/(\s+|\/)/); // garde séparateurs
  const out = parts.map((p) => {
    const t = p.trim();
    if (!t) return p;
    if (Object.prototype.hasOwnProperty.call(MAP, t)) {
      changed += 1;
      return p.replace(t, MAP[t]);
    }
    // Valeurs avec décimales (ex 0.5px) ou en em/rem/% : non touchées
    return p;
  });
  return { value: out.join(''), changed };
}

function processFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  let totalChanges = 0;
  const out = src.replace(DECL_RE, (match, prop, suffix, value, term) => {
    const { value: newValue, changed } = rewriteValue(value);
    if (!changed) return match;
    totalChanges += changed;
    return `${prop}${suffix || ''}: ${newValue}${term}`;
  });
  if (totalChanges > 0) {
    fs.writeFileSync(file, out, 'utf8');
  }
  return totalChanges;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/codemod-spacing-tokens.mjs <file.css> [...]');
  process.exit(1);
}

let grand = 0;
for (const f of files) {
  const abs = path.resolve(f);
  if (!fs.existsSync(abs)) {
    console.error(`SKIP: ${f} introuvable`);
    continue;
  }
  const n = processFile(abs);
  grand += n;
  console.log(`${n.toString().padStart(4)} remplacements  ${f}`);
}
console.log(`---\nTotal: ${grand}`);
