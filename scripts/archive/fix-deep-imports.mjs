#!/usr/bin/env node
// Fix: Ajuster les imports relatifs non-composant dans les fichiers déplacés
// Les fichiers sont passés de components/X.jsx à components/domain/X.jsx
// donc ../utils/ doit devenir ../../utils/, etc.

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const COMP = join(ROOT, 'src/components');

// Dossiers domaine créés
const DOMAIN_FOLDERS = [
  'vehicles', 'affaires', 'personnel', 'leaves', 'equipment',
  'planning', 'messaging', 'mailing', 'annuaire', 'orders',
  'management', 'auth'
];

// Fichiers restant à la racine de components/
const ROOT_COMPONENTS = new Set();
for (const entry of readdirSync(COMP)) {
  if (entry.endsWith('.jsx') || entry.endsWith('.js')) {
    ROOT_COMPONENTS.add(entry.replace(/\.(jsx?|js)$/, ''));
  }
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

    // Pattern: any relative import/from
    const importRegex = /(from\s+['"]|import\s*\(\s*['"]|import\s+['"])(\.\.[^'"]*|\.\/[^'"]*?)(['"])/g;

    const newContent = content.replace(importRegex, (match, prefix, importPath, suffix) => {
      // Fix imports that go UP from components/ to other src/ dirs
      // Old: ../utils/api → was resolving from components/ to src/utils/api
      // New: needs ../../utils/api from components/domain/ to src/utils/api
      if (importPath.startsWith('../') && !importPath.startsWith('../../')) {
        // Check: is this referencing something OUTSIDE components/?
        // ../utils/, ../hooks/, ../contexts/, ../styles/, ../App.css, ../theme.css, etc.
        const afterDotDot = importPath.substring(3); // everything after ../
        
        // If it starts with a known src-level dir or file, it needs depth fix
        const srcLevelDirs = ['utils', 'hooks', 'contexts', 'styles', 'App', 'theme', 'index'];
        const isUpToSrc = srcLevelDirs.some(d => afterDotDot.startsWith(d));
        
        if (isUpToSrc) {
          modified = true;
          return `${prefix}../../${afterDotDot}${suffix}`;
        }
        
        // It could also be referencing a root-level component: ../ComponentName
        // This was a sibling import from components/X.jsx to components/Y.jsx
        // Now it should be: check if Y is at root or in a domain folder
        const refName = afterDotDot.replace(/\.(jsx?|css)$/, '').split('/').pop();
        if (ROOT_COMPONENTS.has(refName)) {
          // Component stayed at root, now need ../ to go up from domain/ to components/
          // Current: components/domain/X.jsx importing ../Y → resolves to components/../Y = src/Y (wrong!)
          // Should be: ../Y → components/Y (but we're in components/domain/, so it's already ../Y = components/Y) 
          // Wait, from components/domain/X.jsx: ../Y resolves to components/Y ✓ CORRECT!
          // Actually no: the original import was ./Y (sibling) now needs ../Y
          // But if original was already ../Y, it pointed OUTSIDE components. Hmm.
          // Let's check the context: in original flat layout, component X imported sibling Y as './Y'
          // The migration script already handled component-to-component imports.
          // If we see ../ComponentName here, the original was ../ComponentName from flat components/
          // which means it was pointing to src/ComponentName — which makes no sense.
          // This case shouldn't happen. Leave it alone.
          return match;
        }
      }
      
      // Fix CSS imports that were co-located: ./ComponentName.css stays correct
      // since the CSS file was moved with the JSX file
      
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
