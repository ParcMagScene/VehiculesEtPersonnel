#!/usr/bin/env node
// Fix imports of root-level components from domain subfolders
// e.g. ./UserAvatar → ../UserAvatar when called from components/auth/

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const COMP = join(ROOT, 'src/components');

// Root-level components (not moved)
const ROOT_NAMES = new Set([
  'AddressAutocomplete', 'AffaireBadge', 'ConfirmDialog', 'DynamicDisplayDialog',
  'ErrorBoundary', 'Header', 'HelpModal', 'MonthSelector', 'PhoneInput',
  'QRCodeModal', 'ToastContainer', 'UnsavedChangesDialog', 'UserAvatar',
  'WeekSelector', 'YearSelector'
]);

const DOMAIN_FOLDERS = [
  'vehicles', 'affaires', 'personnel', 'leaves', 'equipment',
  'planning', 'messaging', 'mailing', 'annuaire', 'orders',
  'management', 'auth'
];

// Build complete map of all components and their folders
const COMPONENT_FOLDER = new Map();
for (const name of ROOT_NAMES) COMPONENT_FOLDER.set(name, null); // root
for (const folder of DOMAIN_FOLDERS) {
  try {
    for (const f of readdirSync(join(COMP, folder))) {
      if (f.endsWith('.jsx') || (f.endsWith('.js') && !f.endsWith('.css'))) {
        COMPONENT_FOLDER.set(f.replace(/\.(jsx|js)$/, ''), folder);
      }
    }
  } catch {}
}

let totalFixes = 0;

for (const folder of DOMAIN_FOLDERS) {
  const dir = join(COMP, folder);
  let files;
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.jsx') || (f.endsWith('.js') && !f.endsWith('.css')));
  } catch { continue; }

  for (const file of files) {
    const filePath = join(dir, file);
    let content = readFileSync(filePath, 'utf8');
    let modified = false;

    const importRegex = /(from\s+['"]|import\s*\(\s*['"]|import\s+['"])(\.[^'"]+)(['"])/g;

    const newContent = content.replace(importRegex, (match, prefix, importPath, suffix) => {
      if (!importPath.startsWith('./')) return match;
      
      const pathParts = importPath.split('/');
      const lastName = pathParts[pathParts.length - 1].replace(/\.(jsx?|css)$/, '');
      const isCss = importPath.endsWith('.css');
      
      const targetFolder = COMPONENT_FOLDER.get(lastName);
      
      if (targetFolder === undefined) return match;
      
      if (targetFolder === null) {
        // Component at root — need ../ComponentName
        let newPath = isCss ? `../${lastName}.css` : `../${lastName}`;
        if (importPath !== newPath) {
          modified = true;
          return `${prefix}${newPath}${suffix}`;
        }
      } else if (targetFolder !== folder) {
        // Component in a DIFFERENT domain folder
        let newPath = isCss ? `../${targetFolder}/${lastName}.css` : `../${targetFolder}/${lastName}`;
        if (importPath !== newPath) {
          modified = true;
          return `${prefix}${newPath}${suffix}`;
        }
      }
      
      return match;
    });

    if (modified) {
      writeFileSync(filePath, newContent, 'utf8');
      console.log(`  ✏️  ${relative(ROOT, filePath)}`);
      totalFixes++;
    }
  }
}

console.log(`\n✅ ${totalFixes} fichiers corrigés`);
