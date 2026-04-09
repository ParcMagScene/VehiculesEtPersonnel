/**
 * Passe E — Migration <table> → <Table> (design system)
 *
 * Ce script :
 * 1. Parcourt tous les .jsx dans src/components/
 * 2. Ignore ui/Table.jsx
 * 3. Remplace <table → <Table et </table> → </Table>
 * 4. Garde les enfants <thead>/<tbody>/<tr>/<td>/<th> tels quels (mode bare)
 * 5. Ajoute l'import { Table } from '@/design-system' si absent
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

const ROOT = join(import.meta.dirname, '..', 'apps', 'web', 'src', 'components');

// Fichiers à exclure (composants UI source)
const EXCLUDE = ['ui/Table.jsx'];

// Trouver tous les .jsx
const allFiles = execSync(`find "${ROOT}" -name "*.jsx" -type f`, { encoding: 'utf-8' })
  .trim().split('\n').filter(Boolean);

let totalFiles = 0;
let totalTables = 0;
const report = [];

for (const filePath of allFiles) {
  const rel = relative(ROOT, filePath);

  // Exclure les composants UI source
  if (EXCLUDE.some(e => rel === e || rel.endsWith('/' + e))) continue;

  let content = readFileSync(filePath, 'utf-8');
  const original = content;

  // Compter les <table ouvrantes (pas <Table déjà migré)
  let count = 0;

  // Replace opening tags: <table → <Table (but not <Table, <thead, <tbody, <td, <th, <tr)
  content = content.replace(/<table(\s|>)/g, (match, after) => {
    count++;
    return `<Table${after}`;
  });

  // Replace closing tags: </table> → </Table>
  content = content.replace(/<\/table>/g, '</Table>');

  if (count === 0) continue;

  // Ajouter l'import Table
  if (content.includes("from '@/design-system'")) {
    // Vérifier si Table est déjà importé
    const dsImportRegex = /(import\s*\{)([^}]*)(}\s*from\s*'@\/design-system')/;
    const dsMatch = content.match(dsImportRegex);
    if (dsMatch) {
      const imports = dsMatch[2];
      if (!imports.includes('Table')) {
        // Ajouter Table à l'import existant
        const cleaned = imports.trimEnd();
        content = content.replace(dsMatch[0], `${dsMatch[1]}${cleaned}, Table ${dsMatch[3]}`);
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
      lines.splice(lastImportLine + 1, 0, "import { Table } from '@/design-system';");
      content = lines.join('\n');
    }
  }

  if (content !== original) {
    writeFileSync(filePath, content, 'utf-8');
    totalFiles++;
    totalTables += count;
    report.push(`  ✅ ${rel} — ${count} table(s)`);
  }
}

console.log(`\n🔄 Passe E — Migration <table> → <Table>`);
console.log(`   Fichiers modifiés : ${totalFiles}`);
console.log(`   Tables migrées    : ${totalTables}\n`);
report.forEach(r => console.log(r));
console.log('');
