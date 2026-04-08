/**
 * Passe D3 — Migration <select> → <Select> (design system)
 *
 * Ce script :
 * 1. Parcourt tous les .jsx dans src/components/
 * 2. Ignore ui/Select.jsx et ui/EntityCombobox.jsx
 * 3. Remplace <select → <Select et </select> → </Select>
 * 4. Garde les enfants <option>/<optgroup> tels quels (mode bare)
 * 5. Ajoute l'import { Select } from '@/design-system' si absent
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

const ROOT = join(import.meta.dirname, '..', 'apps', 'web', 'src', 'components');

// Fichiers à exclure (composants UI source)
const EXCLUDE = ['ui/Select.jsx', 'ui/EntityCombobox.jsx'];

// Trouver tous les .jsx
const allFiles = execSync(`find "${ROOT}" -name "*.jsx" -type f`, { encoding: 'utf-8' })
  .trim().split('\n').filter(Boolean);

let totalFiles = 0;
let totalSelects = 0;
const report = [];

for (const filePath of allFiles) {
  const rel = relative(ROOT, filePath);

  // Exclure les composants UI source
  if (EXCLUDE.some(e => rel === e || rel.endsWith('/' + e))) continue;

  let content = readFileSync(filePath, 'utf-8');
  const original = content;

  // Compter les <select ouvrantes (pas <Select déjà migré)
  let count = 0;

  // Replace opening tags: <select → <Select (but not <Select already)
  content = content.replace(/<select(\s|>)/g, (match, after) => {
    count++;
    return `<Select${after}`;
  });

  // Replace closing tags: </select> → </Select>
  content = content.replace(/<\/select>/g, '</Select>');

  if (count === 0) continue;

  // Ajouter l'import Select
  if (content.includes("from '@/design-system'")) {
    // Vérifier si Select est déjà importé
    const dsImportRegex = /(import\s*\{)([^}]*)(}\s*from\s*'@\/design-system')/;
    const dsMatch = content.match(dsImportRegex);
    if (dsMatch) {
      const imports = dsMatch[2];
      if (!imports.includes('Select')) {
        // Ajouter Select à l'import existant
        const cleaned = imports.trimEnd();
        content = content.replace(dsMatch[0], `${dsMatch[1]}${cleaned}, Select ${dsMatch[3]}`);
      }
    }
  } else {
    // Pas encore d'import design-system — en ajouter un
    const lines = content.split('\n');
    let lastImportLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^import\s/)) lastImportLine = i;
    }
    if (lastImportLine >= 0) {
      lines.splice(lastImportLine + 1, 0, "import { Select } from '@/design-system';");
      content = lines.join('\n');
    }
  }

  if (content !== original) {
    writeFileSync(filePath, content, 'utf-8');
    totalFiles++;
    totalSelects += count;
    report.push(`  ✅ ${rel} — ${count} select(s)`);
  }
}

console.log(`\n🔄 Passe D3 — Migration <select> → <Select>`);
console.log(`   Fichiers modifiés : ${totalFiles}`);
console.log(`   Selects migrés    : ${totalSelects}\n`);
report.forEach(r => console.log(r));
console.log('');
