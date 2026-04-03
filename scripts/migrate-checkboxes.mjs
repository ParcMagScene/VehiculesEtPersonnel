/**
 * Passe F — Migration <input type="checkbox"> → <Checkbox> (design system)
 *
 * Ce script :
 * 1. Parcourt tous les .jsx dans src/components/
 * 2. Ignore ui/Checkbox.jsx
 * 3. Remplace <input type="checkbox" → <Checkbox (mode bare)
 * 4. Le <label> wrapper existant reste intact
 * 5. Ajoute l'import { Checkbox } from '@/design-system' si absent
 *
 * Le composant Checkbox en mode bare (sans prop label) rend un <span>
 * au lieu d'un <label>, ce qui permet l'imbrication dans le <label> existant.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

const ROOT = join(import.meta.dirname, '..', 'apps', 'web', 'src', 'components');

// Fichiers à exclure
const EXCLUDE = ['ui/Checkbox.jsx'];

// Trouver tous les .jsx
const allFiles = execSync(`find "${ROOT}" -name "*.jsx" -type f`, { encoding: 'utf-8' })
  .trim().split('\n').filter(Boolean);

let totalFiles = 0;
let totalCheckboxes = 0;
const report = [];

for (const filePath of allFiles) {
  const rel = relative(ROOT, filePath);
  if (EXCLUDE.some(e => rel === e || rel.endsWith('/' + e))) continue;

  let content = readFileSync(filePath, 'utf-8');
  const original = content;

  let count = 0;

  // Pattern 1: type="checkbox" comme premier attribut (cas dominant)
  // <input type="checkbox" checked={...} ... /> → <Checkbox checked={...} ... />
  content = content.replace(/<input\s+type="checkbox"(\s)/g, (match, after) => {
    count++;
    return `<Checkbox${after}`;
  });

  // Pattern 2a: type="checkbox" pas premier attribut
  // <input checked={...} type="checkbox" ... /> → <Checkbox checked={...} ... />
  content = content.replace(/<input(\s+[^>]*?)\s+type="checkbox"(\s*[^>]*?)\s*\/>/g,
    (match, before, after) => {
      // Vérifier que c'est bien un input qu'on n'a pas déjà traité
      if (match.includes('<Checkbox')) return match;
      count++;
      return `<Checkbox${before}${after} />`;
    }
  );

  if (count === 0) continue;

  // Ajouter l'import Checkbox
  if (content.includes("from '@/design-system'")) {
    const dsImportRegex = /(import\s*\{)([^}]*)(}\s*from\s*'@\/design-system')/;
    const dsMatch = content.match(dsImportRegex);
    if (dsMatch) {
      const imports = dsMatch[2];
      if (!imports.includes('Checkbox')) {
        const cleaned = imports.trimEnd();
        content = content.replace(dsMatch[0], `${dsMatch[1]}${cleaned}, Checkbox ${dsMatch[3]}`);
      }
    }
  } else {
    const lines = content.split('\n');
    let lastImportLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^import\s/)) lastImportLine = i;
    }
    if (lastImportLine >= 0) {
      lines.splice(lastImportLine + 1, 0, "import { Checkbox } from '@/design-system';");
      content = lines.join('\n');
    }
  }

  if (content !== original) {
    writeFileSync(filePath, content, 'utf-8');
    totalFiles++;
    totalCheckboxes += count;
    report.push(`  ✅ ${rel} — ${count} checkbox(es)`);
  }
}

console.log(`\n🔄 Passe F — Migration <input type="checkbox"> → <Checkbox>`);
console.log(`   Fichiers modifiés : ${totalFiles}`);
console.log(`   Checkboxes migrés : ${totalCheckboxes}\n`);
report.forEach(r => console.log(r));

// Vérification résiduelle
const remaining = execSync(
  `grep -rc 'type="checkbox"' --include="*.jsx" "${ROOT}" | grep -v ':0$' | grep -v 'ui/Checkbox.jsx'`,
  { encoding: 'utf-8' }
).trim();
if (remaining) {
  console.log('\n⚠️  Résidus à traiter manuellement :');
  console.log(remaining);
}
console.log('');
