#!/usr/bin/env node
/**
 * Phase G — Migrate native <button> → DS <Button variant="ghost">
 * 
 * Strategy:
 *   - Replace <button → <Button variant="ghost" and </button> → </Button>
 *   - Add Button to existing @/design-system import, or create one
 *   - Preserve all existing attributes (className, onClick, disabled, etc.)
 *   - Skip files in components/ui/ (the DS itself)
 *   - Skip files that already import Button from DS (they made intentional choices)
 * 
 * Usage:
 *   node scripts/migrate-buttons.mjs --dry-run
 *   node scripts/migrate-buttons.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, relative } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const ONLY_NO_IMPORT = process.argv.includes('--only-new');
const ROOT = resolve(import.meta.dirname, '..', 'apps', 'web', 'src');

function findFilesSync(dir) {
  const results = [];
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = resolve(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        // Skip the DS itself
        if (full.endsWith('/components/ui')) continue;
        walk(full);
      } else if (/\.jsx$/.test(entry.name)) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

function hasButtonDSImport(content) {
  // Check if file imports Button from design-system or ../ui or components/ui
  return /import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s*['"](@\/design-system|[^'"]*\/ui[^'"]*)['"]/m.test(content);
}

function addButtonImport(content) {
  // Case 1: Existing @/design-system import WITHOUT Button
  const dsImportRegex = /(import\s*\{)([^}]*?)(\}\s*from\s*['"]@\/design-system['"])/m;
  const match = content.match(dsImportRegex);
  if (match) {
    const existingNames = match[2];
    // Add Button alphabetically
    const names = existingNames.split(',').map(s => s.trim()).filter(Boolean);
    if (!names.includes('Button')) {
      names.push('Button');
      names.sort();
      const newNames = names.join(', ');
      // Preserve multiline format if the original was multiline
      if (existingNames.includes('\n')) {
        const formatted = '\n  ' + names.join(',\n  ') + '\n';
        content = content.replace(dsImportRegex, `$1${formatted}$3`);
      } else {
        content = content.replace(dsImportRegex, `$1 ${newNames} $3`);
      }
    }
    return content;
  }

  // Case 2: No @/design-system import -> create one
  // Place after last import
  const importRegex = /^import\s.+from\s+['"][^'"]+['"];?\s*$/gm;
  let lastImportEnd = 0;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    lastImportEnd = m.index + m[0].length;
  }

  const importLine = `\nimport { Button } from '@/design-system';`;
  if (lastImportEnd > 0) {
    content = content.slice(0, lastImportEnd) + importLine + content.slice(lastImportEnd);
  } else {
    content = importLine + '\n' + content;
  }
  return content;
}

function migrateButtons(content) {
  let count = 0;
  
  // Replace opening <button tags
  // Handle both self-closing and normal opening tags
  // Pattern: <button followed by whitespace, > or /
  // Add variant="ghost" right after <Button
  content = content.replace(/<button(\s|>|\/)/g, (match, after) => {
    count++;
    // Don't add variant="ghost" if we're about to close immediately
    if (after === '>') {
      return '<Button variant="ghost">';
    } else if (after === '/') {
      return '<Button variant="ghost"/';
    } else {
      return '<Button variant="ghost" ';
    }
  });

  // Replace closing </button> tags
  content = content.replace(/<\/button>/g, '</Button>');

  return { content, count };
}

// ─── Main ───
const files = findFilesSync(ROOT);
let totalFiles = 0;
let totalButtons = 0;
const summary = [];

for (const filePath of files) {
  let content = readFileSync(filePath, 'utf-8');
  
  // Skip if file already imports Button from DS (unless --only-new is not set)
  const alreadyHasButton = hasButtonDSImport(content);
  if (ONLY_NO_IMPORT && alreadyHasButton) continue;
  
  // Check if there are native <button elements
  const nativeCount = (content.match(/<button[\s>/]/g) || []).length;
  if (nativeCount === 0) continue;

  const { content: migrated, count } = migrateButtons(content);
  if (count === 0) continue;

  // Ensure Button import exists
  let final = addButtonImport(migrated);

  const relPath = relative(resolve(ROOT, '..', '..', '..'), filePath);
  summary.push({ file: relPath, count, alreadyHadImport: alreadyHasButton });
  totalFiles++;
  totalButtons += count;

  if (DRY_RUN) {
    console.log(`  [DRY] ${relPath}: ${count} buttons migrated${alreadyHasButton ? ' (already had Button import)' : ''}`);
  } else {
    writeFileSync(filePath, final, 'utf-8');
    console.log(`  ✓ ${relPath}: ${count} buttons`);
  }
}

console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Total: ${totalButtons} <button> → <Button> in ${totalFiles} files`);

const withImport = summary.filter(s => s.alreadyHadImport).length;
const withoutImport = summary.filter(s => !s.alreadyHadImport).length;
console.log(`  Files that already had Button import: ${withImport}`);
console.log(`  Files that needed Button import added: ${withoutImport}`);
