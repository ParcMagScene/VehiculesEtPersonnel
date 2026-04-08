#!/usr/bin/env node
/**
 * Phase F — Migrate magic strings → centralized constants
 * Replaces status/role string literals and timing magic numbers with imports from constants/index.js
 * 
 * Usage:
 *   node scripts/migrate-magic-strings.mjs --dry-run   # preview changes
 *   node scripts/migrate-magic-strings.mjs              # apply changes
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, relative } from 'path';
import { globSync } from 'fs';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = resolve(import.meta.dirname, '..', 'apps', 'web', 'src');

// ─── Mapping: string literal → constant expression ───
const STATUS_MAP = {
  active: 'STATUS.ACTIVE',
  inactive: 'STATUS.INACTIVE',
  pending: 'STATUS.PENDING',
  approved: 'STATUS.APPROVED',
  rejected: 'STATUS.REJECTED',
  refused: 'STATUS.REFUSED',
  completed: 'STATUS.COMPLETED',
  cancelled: 'STATUS.CANCELLED',
  scheduled: 'STATUS.SCHEDULED',
  maintenance: 'STATUS.MAINTENANCE',
  validated: 'STATUS.VALIDATED',
  confirmed: 'STATUS.CONFIRMED',
  accepted: 'STATUS.ACCEPTED',
  done: 'STATUS.DONE',
  disponible: 'STATUS.DISPONIBLE',
};

const ROLE_MAP = {
  admin: 'ROLES.ADMIN',
  manager: 'ROLES.MANAGER',
};

const TIMING_MAP = {
  350: 'TIMING.PANEL_CLOSE',
  300: 'TIMING.DEBOUNCE_SEARCH',
  200: 'TIMING.DOUBLE_CLICK',
  2000: 'TIMING.TOAST_DURATION',
  3000: 'TIMING.STATUS_CLEAR',
  500: 'TIMING.PRINT_DELAY',
};

// ─── Files to process ───
import { readdirSync } from 'fs';

function findFilesSync(dir) {
  const results = [];
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = resolve(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'constants') continue;
        walk(full);
      } else if (/\.(jsx?|mjs)$/.test(entry.name)) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

// ─── Safe replacement patterns ───
// Only replace in code contexts, not in JSX attributes like className="active"

function migrateStatusStrings(content) {
  let count = 0;
  const needed = new Set();

  for (const [literal, constant] of Object.entries(STATUS_MAP)) {
    // Pattern: === 'status' or !== 'status' (single or double quotes)
    const eqRegex = new RegExp(`(===?|!==?)\\s*['"]${literal}['"]`, 'g');
    if (eqRegex.test(content)) {
      content = content.replace(new RegExp(`(===?|!==?)\\s*['"]${literal}['"]`, 'g'), (match, op) => {
        count++;
        needed.add('STATUS');
        return `${op} ${constant}`;
      });
    }

    // Pattern: 'status' === or 'status' !== 
    const revRegex = new RegExp(`['"]${literal}['"]\\s*(===?|!==?)`, 'g');
    if (revRegex.test(content)) {
      content = content.replace(new RegExp(`['"]${literal}['"]\\s*(===?|!==?)`, 'g'), (match, op) => {
        count++;
        needed.add('STATUS');
        return `${constant} ${op}`;
      });
    }

    // Pattern: status: 'value' (object property initializer)
    const propRegex = new RegExp(`(status\\s*:\\s*)['"]${literal}['"]`, 'g');
    if (propRegex.test(content)) {
      content = content.replace(new RegExp(`(status\\s*:\\s*)['"]${literal}['"]`, 'g'), (match, prefix) => {
        count++;
        needed.add('STATUS');
        return `${prefix}${constant}`;
      });
    }

    // Pattern: .filter(x => x.status === ... already covered above
    // Pattern: .includes('status') — more risky, skip for safety
  }

  return { content, count, needed };
}

function migrateRoleStrings(content) {
  let count = 0;
  const needed = new Set();

  for (const [literal, constant] of Object.entries(ROLE_MAP)) {
    // Pattern: === 'role' or !== 'role'
    const eqRegex = new RegExp(`(===?|!==?)\\s*['"]${literal}['"]`, 'g');
    if (eqRegex.test(content)) {
      content = content.replace(new RegExp(`(===?|!==?)\\s*['"]${literal}['"]`, 'g'), (match, op) => {
        count++;
        needed.add('ROLES');
        return `${op} ${constant}`;
      });
    }

    // Reverse pattern
    const revRegex = new RegExp(`['"]${literal}['"]\\s*(===?|!==?)`, 'g');
    if (revRegex.test(content)) {
      content = content.replace(new RegExp(`['"]${literal}['"]\\s*(===?|!==?)`, 'g'), (match, op) => {
        count++;
        needed.add('ROLES');
        return `${constant} ${op}`;
      });
    }

    // Pattern: role: 'admin'
    const propRegex = new RegExp(`(role\\s*:\\s*)['"]${literal}['"]`, 'g');
    if (propRegex.test(content)) {
      content = content.replace(new RegExp(`(role\\s*:\\s*)['"]${literal}['"]`, 'g'), (match, prefix) => {
        count++;
        needed.add('ROLES');
        return `${prefix}${constant}`;
      });
    }
  }

  return { content, count, needed };
}

function migrateTimingNumbers(content) {
  let count = 0;
  const needed = new Set();

  for (const [num, constant] of Object.entries(TIMING_MAP)) {
    // Pattern: setTimeout(fn, NUMBER) or setInterval(fn, NUMBER)
    const timerRegex = new RegExp(`(setTimeout|setInterval)\\(([^)]*),\\s*${num}\\s*\\)`, 'g');
    if (timerRegex.test(content)) {
      content = content.replace(new RegExp(`(setTimeout|setInterval)\\(([^)]*),\\s*${num}\\s*\\)`, 'g'), (match, fn, args) => {
        count++;
        needed.add('TIMING');
        return `${fn}(${args}, ${constant})`;
      });
    }
  }

  return { content, count, needed };
}

function addImport(content, neededImports, filePath) {
  const importNames = [...neededImports].sort().join(', ');
  
  // Calculate relative path from file to constants
  const fileDir = resolve(filePath, '..');
  const constDir = resolve(ROOT, 'constants');
  let rel = relative(fileDir, constDir).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  
  // Check if there's already an import from constants
  const existingImport = content.match(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]*constants[^'"]*)['"]/);
  if (existingImport) {
    const existingNames = existingImport[1].split(',').map(s => s.trim()).filter(Boolean);
    const allNames = [...new Set([...existingNames, ...neededImports])].sort();
    const newImportLine = `import { ${allNames.join(', ')} } from '${existingImport[2]}'`;
    content = content.replace(existingImport[0], newImportLine);
  } else {
    // Add import after last existing import, or at top
    const importLine = `import { ${importNames} } from '${rel}';\n`;
    
    // Find the last import statement
    const importRegex = /^import\s.+from\s+['"][^'"]+['"];?\s*$/gm;
    let lastImportEnd = 0;
    let m;
    while ((m = importRegex.exec(content)) !== null) {
      lastImportEnd = m.index + m[0].length;
    }
    
    if (lastImportEnd > 0) {
      content = content.slice(0, lastImportEnd) + '\n' + importLine + content.slice(lastImportEnd);
    } else {
      content = importLine + content;
    }
  }
  
  return content;
}

// ─── Main ───
const files = findFilesSync(ROOT);
let totalFiles = 0;
let totalReplacements = 0;
const summary = [];

for (const filePath of files) {
  let content = readFileSync(filePath, 'utf-8');
  const original = content;
  const allNeeded = new Set();
  let fileCount = 0;

  // Apply status migrations
  let result = migrateStatusStrings(content);
  content = result.content;
  fileCount += result.count;
  result.needed.forEach(n => allNeeded.add(n));

  // Apply role migrations
  result = migrateRoleStrings(content);
  content = result.content;
  fileCount += result.count;
  result.needed.forEach(n => allNeeded.add(n));

  // Apply timing migrations
  result = migrateTimingNumbers(content);
  content = result.content;
  fileCount += result.count;
  result.needed.forEach(n => allNeeded.add(n));

  if (fileCount === 0) continue;

  // Add imports
  content = addImport(content, allNeeded, filePath);

  const relPath = relative(resolve(ROOT, '..', '..', '..'), filePath);
  summary.push({ file: relPath, count: fileCount, imports: [...allNeeded] });
  totalFiles++;
  totalReplacements += fileCount;

  if (DRY_RUN) {
    console.log(`  [DRY] ${relPath}: ${fileCount} replacements (import: ${[...allNeeded].join(', ')})`);
  } else {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`  ✓ ${relPath}: ${fileCount} replacements`);
  }
}

console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Total: ${totalReplacements} replacements in ${totalFiles} files`);

if (summary.length > 0) {
  console.log('\nPar catégorie d\'import:');
  const byImport = {};
  for (const s of summary) {
    for (const imp of s.imports) {
      byImport[imp] = (byImport[imp] || 0) + s.count;
    }
  }
  for (const [imp, count] of Object.entries(byImport)) {
    console.log(`  ${imp}: ~${count} replacements`);
  }
}
