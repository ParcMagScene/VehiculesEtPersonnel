/**
 * Passe D2 — Migration <input> → <Input> (design system)
 *
 * Ce script :
 * 1. Parcourt tous les .jsx dans src/components/
 * 2. Ignore les composants ui/ (source du design system)
 * 3. Remplace <input .../> par <Input .../> pour les types textuels
 * 4. Ne touche PAS aux checkbox, radio, file, range, color, hidden, date, time
 * 5. Ajoute l'import { Input } from '@/design-system' si absent
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

const ROOT = join(import.meta.dirname, '..', 'apps', 'web', 'src', 'components');

// Types à NE PAS migrer
const SKIP_TYPES = [
  'checkbox', 'radio', 'file', 'range', 'color',
  'hidden', 'date', 'time', 'datetime-local', 'month', 'week'
];

// Fichiers à exclure (composants UI source)
const EXCLUDE = ['ui/Input.jsx', 'ui/SearchBar.jsx', 'ui/EntityCombobox.jsx'];

// Trouver tous les .jsx
const allFiles = execSync(`find "${ROOT}" -name "*.jsx" -type f`, { encoding: 'utf-8' })
  .trim().split('\n').filter(Boolean);

let totalFiles = 0;
let totalInputs = 0;
const report = [];

for (const filePath of allFiles) {
  const rel = relative(ROOT, filePath);

  // Exclure les composants UI source
  if (EXCLUDE.some(e => rel === e || rel.endsWith('/' + e))) continue;

  let content = readFileSync(filePath, 'utf-8');
  const original = content;

  // Regex : match <input suivi d'attributs jusqu'à />
  // Le flag s (dotAll) permet au . de matcher les sauts de ligne
  const inputRegex = /<input\b([\s\S]*?)\/>/g;

  let count = 0;

  content = content.replace(inputRegex, (match, attrs) => {
    // Vérifier le type
    const typeMatch = attrs.match(/type\s*=\s*["']([^"']+)["']/);
    if (typeMatch && SKIP_TYPES.includes(typeMatch[1])) {
      return match; // Garder tel quel
    }
    // Type dynamique type={...} → on ne migre pas (incertain)
    if (attrs.match(/type\s*=\s*\{/)) {
      return match;
    }
    count++;
    return `<Input${attrs}/>`;
  });

  if (count === 0) continue;

  // Ajouter l'import Input
  if (content.includes("from '@/design-system'")) {
    // Vérifier si Input est déjà importé
    const dsImportRegex = /(import\s*\{)([^}]*)(}\s*from\s*'@\/design-system')/;
    const dsMatch = content.match(dsImportRegex);
    if (dsMatch) {
      const imports = dsMatch[2];
      if (!imports.includes('Input')) {
        // Ajouter Input à l'import existant
        const cleaned = imports.trimEnd();
        content = content.replace(dsMatch[0], `${dsMatch[1]}${cleaned}, Input ${dsMatch[3]}`);
      }
    }
  } else {
    // Pas encore d'import design-system — en ajouter un
    // Chercher la dernière ligne d'import pour insérer après
    const lines = content.split('\n');
    let lastImportLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^import\s/)) lastImportLine = i;
    }
    if (lastImportLine >= 0) {
      lines.splice(lastImportLine + 1, 0, "import { Input } from '@/design-system';");
      content = lines.join('\n');
    }
  }

  if (content !== original) {
    writeFileSync(filePath, content, 'utf-8');
    totalFiles++;
    totalInputs += count;
    report.push(`  ✅ ${rel} — ${count} input(s)`);
  }
}

console.log(`\n🔄 Passe D2 — Migration <input> → <Input>`);
console.log(`   Fichiers modifiés : ${totalFiles}`);
console.log(`   Inputs migrés     : ${totalInputs}\n`);
report.forEach(r => console.log(r));
console.log('');
