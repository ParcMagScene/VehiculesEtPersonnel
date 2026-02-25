/**
 * Script de migration : alert() → toast (useToast)
 * 
 * Pour chaque fichier JSX contenant des alert() :
 * 1. Ajoute l'import useToast si absent
 * 2. Ajoute const toast = useToast(); après le premier useState/useEffect/useRef
 * 3. Remplace les alert() par toast.error/success/warning/info selon le contenu
 * 
 * Usage: node scripts/migrate-alerts-to-toast.cjs [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

// Files to skip (already handled or special cases)
const SKIP_FILES = ['App.jsx'];

function classifyAlert(alertContent) {
  const content = alertContent.toLowerCase();
  
  // Success patterns
  if (content.includes('✅') || content.includes('succès') || content.includes('success') ||
      content.includes('enregistré') || content.includes('sauvegardé') || content.includes('copié') ||
      content.includes('approuvée') || content.includes('rejetée') || content.includes('déconnexion effectuée') ||
      content.includes('supprimé avec succès') || content.includes('uploadé')) {
    return 'success';
  }
  
  // Warning patterns
  if (content.includes('⚠️') || content.includes('⛔') || content.includes('chevauchement') ||
      content.includes('veuillez') || content.includes('requis') || content.includes('obligatoire') ||
      content.includes('bloqué') || content.includes('existe déjà') || content.includes('accès refusé') ||
      content.includes('seuls les admin') || content.includes('devez') ||
      content.includes('sélectionner') || content.includes('indiquer') ||
      content.includes('choisir') || content.includes('pas supporté') ||
      content.includes('quantité de 1') || content.includes('remplir')) {
    return 'warning';
  }
  
  // Info patterns  
  if (content.includes('ℹ️') || content.includes('info') || content.includes('autorisez') ||
      content.includes('uid créés')) {
    return 'info';
  }
  
  // Error (default for "Erreur" messages)
  if (content.includes('erreur') || content.includes('error') || content.includes('❌')) {
    return 'error';
  }
  
  // Fallback: info
  return 'info';
}

function simplifyMessage(alertContent) {
  // Remove emoji prefixes
  let msg = alertContent.replace(/^['"`]?[⚠️✅⛔❌ℹ️🔔]+\s*/u, '');
  
  // Remove \n for multi-line alerts, replace with '. '
  msg = msg.replace(/\\n\\n/g, ' ').replace(/\\n/g, ' ');
  
  // Clean up multiple spaces
  msg = msg.replace(/\s+/g, ' ').trim();
  
  return msg;
}

function processFile(filePath) {
  const basename = path.basename(filePath);
  if (SKIP_FILES.includes(basename)) return null;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check for alert() calls (not AlertCircle, AlertTriangle, etc.)
  const alertRegex = /\balert\s*\(/g;
  const matches = content.match(alertRegex);
  if (!matches) return null;
  
  // Filter false positives
  const lines = content.split('\n');
  const alertLines = [];
  lines.forEach((line, i) => {
    if (/\balert\s*\(/.test(line) && 
        !/AlertCircle|AlertTriangle|alert-|\/\/\s*alert/.test(line)) {
      alertLines.push(i + 1);
    }
  });
  
  if (alertLines.length === 0) return null;
  
  let modified = content;
  let changes = 0;
  
  // 1. Add useToast import if not present
  if (!modified.includes('useToast')) {
    // Figure out relative path
    const dir = path.dirname(filePath);
    const srcDir = path.resolve(__dirname, '..', 'src');
    const relativeToSrc = path.relative(dir, path.join(srcDir, 'hooks', 'useToast'));
    const importPath = relativeToSrc.startsWith('.') ? relativeToSrc : './' + relativeToSrc;
    const importStatement = `import { useToast } from '${importPath.replace(/\\/g, '/')}';\n`;
    
    // Add after last import statement
    const lastImportIndex = modified.lastIndexOf('\nimport ');
    if (lastImportIndex >= 0) {
      const endOfImport = modified.indexOf('\n', lastImportIndex + 1);
      // Find end of the import (could be multi-line)
      let insertPos = endOfImport;
      // Handle multi-line imports
      const afterImport = modified.substring(endOfImport);
      const nextLineMatch = afterImport.match(/\n/);
      if (nextLineMatch) {
        insertPos = endOfImport;
      }
      modified = modified.substring(0, insertPos + 1) + importStatement + modified.substring(insertPos + 1);
    } else {
      modified = importStatement + modified;
    }
  }
  
  // 2. Add const toast = useToast(); if not present
  if (!modified.includes('useToast()')) {
    // Find first useState, useEffect, useRef, useCallback, useMemo call
    const hookMatch = modified.match(/^(\s*)(const\s+\[?\w+.*=\s*use(?:State|Effect|Ref|Callback|Memo)\s*\()/m);
    if (hookMatch) {
      const insertBefore = modified.indexOf(hookMatch[0]);
      const indent = hookMatch[1];
      modified = modified.substring(0, insertBefore) + 
        `${indent}const toast = useToast();\n` + 
        modified.substring(insertBefore);
    } else {
      // Fallback: find function component body
      const funcMatch = modified.match(/(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:\([^)]*\)|[^=])\s*=>)\s*\{/);
      if (funcMatch) {
        const funcStart = modified.indexOf(funcMatch[0]) + funcMatch[0].length;
        modified = modified.substring(0, funcStart) + '\n  const toast = useToast();\n' + modified.substring(funcStart);
      }
    }
  }
  
  // 3. Replace alert() calls with toast
  // This regex handles simple and template literal alert() calls
  modified = modified.replace(/\balert\s*\(([^)]*(?:\([^)]*\))*[^)]*)\)/g, (match, args) => {
    // Skip false positives
    if (/AlertCircle|AlertTriangle/.test(match)) return match;
    
    const type = classifyAlert(args);
    
    // Clean up multi-line \n from the message for toast
    let cleanArgs = args;
    // Remove \n sequences from string content (they don't render in toast)
    cleanArgs = cleanArgs.replace(/\\n\\n/g, ' ');
    cleanArgs = cleanArgs.replace(/\\n/g, ' ');
    // Remove emoji prefixes from string literals
    cleanArgs = cleanArgs.replace(/(['"`])([⚠️✅⛔❌ℹ️🔔]+\s*)/gu, '$1');
    
    changes++;
    return `toast.${type}(${cleanArgs})`;
  });
  
  if (changes === 0) return null;
  
  if (!DRY_RUN) {
    fs.writeFileSync(filePath, modified, 'utf8');
  }
  
  return { file: basename, changes, alertLines };
}

// Main
const srcDir = path.resolve(__dirname, '..', 'src');
const componentDir = path.join(srcDir, 'components');

// Get all JSX/JS files
function getAllFiles(dir, ext = ['.jsx', '.js']) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, ext));
    } else if (ext.some(e => entry.name.endsWith(e))) {
      files.push(fullPath);
    }
  }
  return files;
}

const allFiles = getAllFiles(componentDir);
console.log(`\n${DRY_RUN ? '🔍 DRY RUN - ' : ''}Migration alert() → toast\n`);
console.log(`Fichiers scannés: ${allFiles.length}`);

let totalChanges = 0;
const results = [];

for (const file of allFiles) {
  const result = processFile(file);
  if (result) {
    results.push(result);
    totalChanges += result.changes;
  }
}

if (results.length > 0) {
  console.log(`\nFichiers modifiés: ${results.length}`);
  console.log(`Total replacements: ${totalChanges}\n`);
  for (const r of results) {
    console.log(`  ✅ ${r.file}: ${r.changes} alert() → toast`);
  }
} else {
  console.log('\nAucun alert() trouvé à migrer.');
}

console.log(DRY_RUN ? '\n🔍 Mode dry-run terminé. Relancer sans --dry-run pour appliquer.' : '\n✅ Migration terminée.');
