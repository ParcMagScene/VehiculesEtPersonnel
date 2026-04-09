#!/usr/bin/env node

/**
 * migrate-css-tokens.js — Migration automatique des valeurs brutes vers tokens
 * 
 * Remplace les patterns les plus courants (couleurs, z-index, spacings)
 * par leurs équivalents tokenisés.
 *
 * Usage :
 *   node scripts/migrate-css-tokens.js                    # Dry run (affiche les changements)
 *   node scripts/migrate-css-tokens.js --apply            # Applique les changements
 *   node scripts/migrate-css-tokens.js --file <path>      # Un seul fichier
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';

const WEB_SRC = join(import.meta.dirname, '..', 'apps', 'web', 'src');
const APPLY = process.argv.includes('--apply');
const FILE_FILTER = process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : null;

// Fichiers exemptés
const EXEMPT = ['theme.css', 'theme-palettes.css', 'theme-vscode.css', 'theme-density.css', 'theme-tv.css', 'tokens.css'];

/* ═══════════════════════════════════════════════════════
   Mappings couleurs hex → tokens
   ═══════════════════════════════════════════════════════ */
const HEX_MAP = {
  // Blancs
  '#ffffff': 'var(--theme-bg-card)',
  '#fff':    'var(--theme-bg-card)',
  // Noirs
  '#000000': 'var(--theme-text-heading)',
  '#000':    'var(--theme-text-heading)',
  // Gris (du plus clair au plus foncé)
  '#f8fafc': 'var(--theme-bg-page)',
  '#f9fafb': 'var(--theme-bg-secondary)',
  '#f3f4f6': 'var(--theme-bg-tertiary)',
  '#f1f5f9': 'var(--theme-border-light)',
  '#e5e7eb': 'var(--theme-border-medium)',
  '#e2e8f0': 'var(--theme-border)',
  '#d1d5db': 'var(--theme-border-muted)',
  '#cbd5e1': 'var(--theme-bg-muted)',
  '#9ca3af': 'var(--theme-text-muted)',
  '#94a3b8': 'var(--theme-text-muted)',
  '#6b7280': 'var(--theme-neutral)',
  '#64748b': 'var(--theme-text-secondary)',
  '#475569': 'var(--theme-text-subtle)',
  '#374151': 'var(--theme-text-body)',
  '#334155': 'var(--theme-text-dark)',
  '#1e293b': 'var(--theme-text-primary)',
  '#1f2937': 'var(--theme-bg-dark)',
  '#111827': 'var(--theme-bg-darker)',
  // Primaire / Indigo / Violet
  '#667eea': 'var(--theme-primary)',
  '#764ba2': 'var(--theme-secondary)',
  '#6366f1': 'var(--theme-indigo)',
  '#818cf8': 'var(--theme-indigo)',
  '#8b5cf6': 'var(--theme-primary-light)',
  '#7c3aed': 'var(--theme-primary-hover)',
  '#5b21b6': 'var(--theme-primary-dark)',
  '#a855f7': 'var(--theme-accent)',
  '#c4b5fd': 'var(--theme-purple-accent)',
  '#ddd6fe': 'var(--theme-purple-bg-strong)',
  '#e0e7ff': 'var(--theme-bg-indigo-light)',
  '#c7d2fe': 'var(--theme-bg-indigo-lighter)',
  '#eef2ff': 'var(--theme-bg-selected)',
  '#faf5ff': 'var(--theme-purple-bg)',
  // Rouge / Danger
  '#ef4444': 'var(--theme-danger)',
  '#dc2626': 'var(--theme-danger-dark)',
  '#b91c1c': 'var(--theme-danger-text-alt)',
  '#991b1b': 'var(--theme-danger-text)',
  '#fef2f2': 'var(--theme-danger-bg)',
  '#fee2e2': 'var(--theme-danger-bg)',
  '#fecaca': 'var(--theme-danger-border)',
  '#fca5a5': 'var(--theme-danger-border)',
  '#f87171': 'var(--theme-danger)',
  // Vert / Succès
  '#22c55e': 'var(--theme-success)',
  '#16a34a': 'var(--theme-success-dark)',
  '#10b981': 'var(--theme-success-alt)',
  '#059669': 'var(--theme-success-text)',
  '#065f46': 'var(--theme-success-text)',
  '#166534': 'var(--theme-success-text-alt)',
  '#f0fdf4': 'var(--theme-success-bg)',
  '#dcfce7': 'var(--theme-success-bg-strong)',
  '#86efac': 'var(--theme-success-border)',
  '#d1fae5': 'var(--theme-success-bg-strong)',
  '#a7f3d0': 'var(--theme-success-border)',
  '#bbf7d0': 'var(--theme-success-border)',
  // Bleu / Info
  '#3b82f6': 'var(--theme-info)',
  '#2563eb': 'var(--theme-info-dark)',
  '#1d4ed8': 'var(--theme-info-text)',
  '#eff6ff': 'var(--theme-info-bg)',
  '#dbeafe': 'var(--theme-info-bg-strong)',
  '#bfdbfe': 'var(--theme-info-border)',
  '#60a5fa': 'var(--theme-info)',
  '#93c5fd': 'var(--theme-info-border)',
  // Orange / Warning
  '#f59e0b': 'var(--theme-warning)',
  '#d97706': 'var(--theme-warning-dark)',
  '#92400e': 'var(--theme-warning-text)',
  '#78350f': 'var(--theme-warning-text-alt)',
  '#fffbeb': 'var(--theme-warning-bg)',
  '#fef3c7': 'var(--theme-warning-bg)',
  '#fde68a': 'var(--theme-warning-border)',
  '#fed7aa': 'var(--theme-warning-border)',
  '#fb923c': 'var(--theme-warning)',
  // Cyan
  '#06b6d4': 'var(--theme-cyan)',
  '#0891b2': 'var(--theme-cyan-dark)',
  '#ecfeff': 'var(--theme-cyan-bg)',
  '#155e75': 'var(--theme-cyan-text)',
  '#67e8f9': 'var(--theme-cyan-border)',
  // Orange étendu
  '#fff7ed': 'var(--theme-orange-bg)',
  '#9a3412': 'var(--theme-orange-text)',
  // Gris supplémentaires (shorthand et standard)
  '#e0e0e0': 'var(--theme-border)',
  '#d0d0d0': 'var(--theme-border-muted)',
  '#f5f5f5': 'var(--theme-bg-secondary)',
  '#f9f9f9': 'var(--theme-bg-secondary)',
  '#f0f0f0': 'var(--theme-bg-tertiary)',
  '#333':    'var(--theme-text-body)',
  '#333333': 'var(--theme-text-body)',
  '#666':    'var(--theme-text-secondary)',
  '#666666': 'var(--theme-text-secondary)',
  '#888':    'var(--theme-text-muted)',
  '#888888': 'var(--theme-text-muted)',
  '#999':    'var(--theme-text-muted)',
  '#999999': 'var(--theme-text-muted)',
  '#0f172a': 'var(--theme-bg-darker)',
  '#1e1b4b': 'var(--theme-bg-darker)',
  '#1e3a5f': 'var(--theme-text-dark)',
  // Rouge / Danger supplémentaires
  '#dc3545': 'var(--theme-danger)',
  '#e74c3c': 'var(--theme-danger)',
  '#451a1a': 'var(--theme-danger-text)',
  // Vert supplémentaires
  '#2e7d32': 'var(--theme-success-text)',
  '#047857': 'var(--theme-success-text)',
  // Bleu / Info supplémentaires
  '#1e40af': 'var(--theme-info-text)',
  '#007bff': 'var(--theme-info)',
  '#4285f4': 'var(--theme-info)',
  '#4a90d9': 'var(--theme-info)',
  // Violet supplémentaires
  '#6d28d9': 'var(--theme-primary-dark)',
  '#312e81': 'var(--theme-primary-dark)',
  // Rose
  '#db2777': 'var(--theme-danger)',
  '#ec4899': 'var(--theme-danger)',
  // Jaune / Warning supplémentaires
  '#fcd34d': 'var(--theme-warning-border)',
  '#fbbf24': 'var(--theme-warning)',
  // Orange profond
  '#e65100': 'var(--theme-warning-text)',
  // Cyan supplémentaires
  '#e0f2fe': 'var(--theme-info-bg)',
  '#a5f3fc': 'var(--theme-cyan-border)',
};

/* ═══════════════════════════════════════════════════════
   Mappings rgba → tokens
   ═══════════════════════════════════════════════════════ */
const RGBA_MAP = {
  // Dark overlays (from most opaque to least)
  'rgba(17, 24, 39, 0.95)':'var(--overlay-text)',
  'rgba(0, 0, 0, 0.85)':  'var(--overlay-opaque)',
  'rgba(0, 0, 0, 0.8)':   'var(--overlay-deep)',
  'rgba(0, 0, 0, 0.7)':   'var(--overlay-darker)',
  'rgba(0, 0, 0, 0.6)':   'var(--theme-overlay-dark)',
  'rgba(0, 0, 0, 0.5)':   'var(--overlay-heavy)',
  'rgba(0, 0, 0, 0.45)':  'var(--overlay-medium)',
  'rgba(0, 0, 0, 0.4)':   'var(--overlay-light)',
  'rgba(0, 0, 0, 0.3)':   'var(--shadow-modal)',
  'rgba(0, 0, 0, 0.25)':  'var(--shadow-modal)',
  'rgba(0, 0, 0, 0.2)':   'var(--shadow-xl)',
  'rgba(0, 0, 0, 0.15)':  'var(--shadow-xl)',
  'rgba(0, 0, 0, 0.12)':  'var(--shadow-dropdown)',
  'rgba(0, 0, 0, 0.1)':   'var(--shadow-sm)',
  'rgba(0, 0, 0, 0.08)':  'var(--shadow-sm)',
  'rgba(0, 0, 0, 0.06)':  'var(--overlay-faint)',
  'rgba(0, 0, 0, 0.05)':  'var(--shadow-xs)',
  'rgba(0, 0, 0, 0.04)':  'var(--shadow-xs)',
  'rgba(0, 0, 0, 0.03)':  'var(--overlay-subtle)',
  'rgba(15, 23, 42, 0.5)': 'var(--theme-overlay)',
  // White overlays (glass)
  'rgba(255, 255, 255, 0.95)': 'var(--theme-bg-card-translucent)',
  'rgba(255, 255, 255, 0.9)':  'var(--theme-bg-card-translucent)',
  'rgba(255, 255, 255, 0.8)':  'var(--glass-bright)',
  'rgba(255, 255, 255, 0.7)':  'var(--glass-opaque)',
  'rgba(255, 255, 255, 0.6)':  'var(--glass-strong)',
  'rgba(255, 255, 255, 0.5)':  'var(--glass-heavy)',
  'rgba(255, 255, 255, 0.4)':  'var(--glass)',
  'rgba(255, 255, 255, 0.35)': 'var(--glass-medium)',
  'rgba(255, 255, 255, 0.3)':  'var(--close-btn-hover-bg)',
  'rgba(255, 255, 255, 0.25)': 'var(--close-btn-border)',
  'rgba(255, 255, 255, 0.2)':  'var(--glass-light)',
  'rgba(255, 255, 255, 0.15)': 'var(--close-btn-bg)',
  'rgba(255, 255, 255, 0.1)':  'var(--glass-subtle)',
  // Primary tints (blue 59,130,246)
  'rgba(59, 130, 246, 0.4)':   'var(--primary-tint-bold)',
  'rgba(59, 130, 246, 0.3)':   'var(--primary-tint-strong)',
  'rgba(59, 130, 246, 0.25)':  'var(--primary-tint-vivid)',
  'rgba(59, 130, 246, 0.15)':  'var(--primary-tint-medium)',
  'rgba(59, 130, 246, 0.12)':  'var(--primary-tint)',
  'rgba(59, 130, 246, 0.1)':   'var(--primary-tint-light)',
  'rgba(59, 130, 246, 0.08)':  'var(--primary-tint-subtle)',
  'rgba(59, 130, 246, 0.04)':  'var(--primary-tint-faint)',
  // Accent tints (indigo 99,102,241)
  'rgba(99, 102, 241, 0.5)':   'var(--accent-tint-heavy)',
  'rgba(99, 102, 241, 0.4)':   'var(--accent-tint-bold)',
  'rgba(99, 102, 241, 0.3)':   'var(--accent-tint-strong)',
  'rgba(99, 102, 241, 0.2)':   'var(--accent-tint-vivid)',
  'rgba(99, 102, 241, 0.15)':  'var(--accent-tint-medium)',
  'rgba(99, 102, 241, 0.12)':  'var(--accent-tint)',
  'rgba(99, 102, 241, 0.1)':   'var(--accent-tint-light)',
  'rgba(99, 102, 241, 0.08)':  'var(--accent-tint-subtle)',
  'rgba(99, 102, 241, 0.06)':  'var(--accent-tint-extra)',
  'rgba(99, 102, 241, 0.04)':  'var(--accent-tint-faint)',
  'rgba(99, 102, 241, 0.03)':  'var(--accent-tint-muted)',
  // Accent alt (102,126,234)
  'rgba(102, 126, 234, 0.1)':  'var(--accent-tint-alt)',
  'rgba(102, 126, 234, 0.15)': 'var(--focus-ring)',
  'rgba(102, 126, 234, 0.2)':  'var(--shadow-hover)',
  'rgba(102, 126, 234, 0.3)':  'var(--btn-primary-shadow)',
  'rgba(102, 126, 234, 0.4)':  'var(--btn-primary-hover-shadow)',
  // Success tints (green 16,185,129)
  'rgba(16, 185, 129, 0.45)':  'var(--success-tint-strong)',
  'rgba(16, 185, 129, 0.4)':   'var(--success-tint-bold)',
  'rgba(16, 185, 129, 0.3)':   'var(--success-tint-medium)',
  'rgba(16, 185, 129, 0.2)':   'var(--success-tint-vivid)',
  'rgba(16, 185, 129, 0.15)':  'var(--success-tint-accent)',
  'rgba(16, 185, 129, 0.12)':  'var(--success-tint)',
  'rgba(16, 185, 129, 0.1)':   'var(--success-tint-light)',
  'rgba(16, 185, 129, 0.08)':  'var(--success-tint-faint)',
  'rgba(16, 185, 129, 0.06)':  'var(--success-tint-subtle)',
  // Danger tints (red 239,68,68)
  'rgba(239, 68, 68, 0.3)':    'var(--danger-tint-medium)',
  'rgba(239, 68, 68, 0.25)':   'var(--danger-tint-accent)',
  'rgba(239, 68, 68, 0.2)':    'var(--danger-tint)',
  'rgba(239, 68, 68, 0.15)':   'var(--theme-danger-border)',
  'rgba(239, 68, 68, 0.12)':   'var(--danger-tint-light)',
  'rgba(239, 68, 68, 0.1)':    'var(--theme-danger-bg)',
  // Danger dark (220,38,38)
  'rgba(220, 38, 38, 0.4)':    'var(--danger-tint-dark)',
  // Warning tints (amber 245,158,11)
  'rgba(245, 158, 11, 0.3)':   'var(--warning-tint-medium)',
  'rgba(245, 158, 11, 0.12)':  'var(--warning-tint)',
  'rgba(245, 158, 11, 0.1)':   'var(--warning-tint-light)',
  // Violet (139,92,246)
  'rgba(139, 92, 246, 0.15)':  'var(--violet-tint)',
  // Info tints
  'rgba(66, 133, 244, 0.04)':  'var(--info-tint-faint)',
  'rgba(96, 165, 250, 0.1)':   'var(--info-tint-light)',
  // Gray overlay
  'rgba(120, 120, 120, 0.6)':  'var(--gray-overlay)',
};

/* ═══════════════════════════════════════════════════════
   Named colors → tokens
   ═══════════════════════════════════════════════════════ */
const NAMED_COLOR_MAP = {
  'white':       'var(--theme-text-inverse)',
  'black':       'var(--theme-text-heading)',
  'transparent': null, // keep as-is
  'inherit':     null,
  'currentColor': null,
};

/* ═══════════════════════════════════════════════════════
   Z-index → tokens
   ═══════════════════════════════════════════════════════ */
const ZINDEX_MAP = {
  '1':     'var(--z-base)',
  '2':     'var(--z-base)',
  '5':     'var(--z-base)',
  '10':    'var(--z-dropdown)',
  '11':    'var(--z-dropdown)',
  '50':    'var(--z-dropdown)',
  '100':   'var(--z-dropdown)',
  '200':   'var(--z-sticky)',
  '500':   'var(--z-overlay)',
  '999':   'var(--z-overlay)',
  '1000':  'var(--z-overlay)',
  '1001':  'var(--z-overlay)',
  '2000':  'var(--z-modal)',
  '2001':  'var(--z-modal-nested)',
  '2500':  'var(--z-modal-nested)',
  '3000':  'var(--z-popover)',
  '4000':  'var(--z-draggable)',
  '5000':  'var(--z-toast)',
  '9999':  'var(--z-tooltip)',
  '10000': 'var(--z-tooltip)',
  '99999': 'var(--z-tooltip)',
};

/* ═══════════════════════════════════════════════════════
   Remplacement
   ═══════════════════════════════════════════════════════ */

function walk(dir, exts) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full, exts));
    else if (exts.includes(extname(entry.name))) results.push(full);
  }
  return results;
}

function migrateFile(filePath) {
  const rel = relative(WEB_SRC, filePath);
  if (EXEMPT.some(f => rel.endsWith(f))) return { file: rel, changes: 0, details: [] };

  let content = readFileSync(filePath, 'utf-8');
  const original = content;
  const details = [];

  // 1. Remplacer les rgba connues (faire AVANT les hex car certaines rgba contiennent des chiffres)
  for (const [rgba, token] of Object.entries(RGBA_MAP)) {
    const escaped = rgba.replace(/[().,]/g, c => '\\' + c).replace(/ /g, '\\s*');
    const re = new RegExp(escaped, 'gi');
    const count = (content.match(re) || []).length;
    if (count > 0) {
      content = content.replace(re, token);
      details.push(`  ${count}× ${rgba} → ${token}`);
    }
  }

  // 2. Remplacer les box-shadow complets courants avec rgba
  // Pattern: N N N rgba(...) → var(--shadow-*)
  const shadowPatterns = [
    [/0\s+1px\s+2px\s+var\(--shadow-xs\)/g, 'var(--shadow-xs)'],
    [/0\s+1px\s+3px\s+var\(--shadow-sm\)/g, 'var(--shadow-sm)'],
    [/0\s+4px\s+12px\s+var\(--shadow-sm\)/g, 'var(--shadow-md)'],
    [/0\s+8px\s+24px\s+var\(--shadow-dropdown\)/g, 'var(--shadow-lg)'],
    [/0\s+12px\s+40px\s+var\(--shadow-xl\)/g, 'var(--shadow-xl)'],
    [/0\s+20px\s+60px\s+var\(--shadow-modal\)/g, 'var(--shadow-modal)'],
  ];
  for (const [re, token] of shadowPatterns) {
    const count = (content.match(re) || []).length;
    if (count > 0) {
      content = content.replace(re, token);
      details.push(`  ${count}× shadow → ${token}`);
    }
  }

  // 3. Remplacer les hex (en respectant les limites de mot, insensible à la casse)
  // Trier par longueur décroissante pour matcher les 6-char avant les 3-char
  const sortedHex = Object.entries(HEX_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [hex, token] of sortedHex) {
    // Match hex NOT inside var() and NOT as part of a longer hex
    const re = new RegExp(hex.replace('#', '#') + '\\b', 'gi');
    const count = (content.match(re) || []).length;
    if (count > 0) {
      content = content.replace(re, token);
      details.push(`  ${count}× ${hex} → ${token}`);
    }
  }

  // 4. Named colors (uniquement dans les valeurs de propriétés, pas dans les sélecteurs)
  const lines = content.split('\n');
  const newLines = lines.map(line => {
    const trimmed = line.trim();
    // Skip si c'est un sélecteur, un commentaire ou une var definition
    if (!trimmed.includes(':') || trimmed.startsWith('.') || trimmed.startsWith('#') || 
        trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('--') ||
        trimmed.startsWith('@') || trimmed.includes('{')) return line;
    
    let modified = line;
    // white dans les valeurs (pas dans préfixes/suffixes comme background-color)
    if (/:\s*.*\bwhite\b/.test(modified) && !modified.includes('var(') && !modified.includes('white-space')) {
      // Cas spécial: couleur white → token
      // Mais attention: "color: white" → "color: var(--theme-text-inverse)"
      // et "background: white" → "background: var(--theme-bg-card)"
      if (/\bbackground(?:-color)?\s*:/.test(modified)) {
        modified = modified.replace(/\bwhite\b/g, 'var(--theme-bg-card)');
      } else if (/\bcolor\s*:/.test(modified)) {
        modified = modified.replace(/\bwhite\b/g, 'var(--theme-text-inverse)');
      } else if (/\bborder[^:]*:/.test(modified)) {
        modified = modified.replace(/\bwhite\b/g, 'var(--theme-bg-card)');
      }
    }
    
    return modified;
  });
  content = newLines.join('\n');

  // Count named colors changes
  const namedChanges = original.split('\n').filter((l, i) => l !== newLines[i]).length;
  if (namedChanges > 0) details.push(`  ${namedChanges}× named color → token`);

  // 5. z-index littéraux
  content = content.replace(/z-index\s*:\s*(\d+)/g, (match, val) => {
    const token = ZINDEX_MAP[val];
    if (token) {
      details.push(`  z-index: ${val} → ${token}`);
      return `z-index: ${token}`;
    }
    return match;
  });

  const totalChanges = content !== original ? details.length : 0;

  if (APPLY && content !== original) {
    writeFileSync(filePath, content, 'utf-8');
  }

  return { file: rel, changes: totalChanges, details, modified: content !== original };
}

/* ═══════════════════════════════════════════════════════
   Exécution
   ═══════════════════════════════════════════════════════ */

let files;
if (FILE_FILTER) {
  files = [join(WEB_SRC, FILE_FILTER)];
} else {
  files = walk(WEB_SRC, ['.css']);
}

let totalChanges = 0;
let modifiedFiles = 0;
const results = [];

for (const f of files) {
  const result = migrateFile(f);
  if (result.modified) {
    modifiedFiles++;
    totalChanges += result.changes;
    results.push(result);
  }
}

// Rapport
console.log('');
console.log('╔══════════════════════════════════════════════════════╗');
console.log(`║  MIGRATION CSS → TOKENS ${APPLY ? '(APPLIQUÉ)' : '(DRY RUN)'}`.padEnd(55) + '║');
console.log('╠══════════════════════════════════════════════════════╣');
console.log(`║  Fichiers modifiés   : ${String(modifiedFiles).padStart(5)}                     ║`);
console.log(`║  Remplacements       : ${String(totalChanges).padStart(5)}                     ║`);
console.log('╚══════════════════════════════════════════════════════╝');

if (!APPLY) {
  console.log('\n  ⚠ Mode dry-run — Relancer avec --apply pour appliquer\n');
}

for (const r of results.sort((a, b) => b.changes - a.changes)) {
  console.log(`\n📄 ${r.file} (${r.changes} changements)`);
  for (const d of r.details) {
    console.log(d);
  }
}

console.log('');
