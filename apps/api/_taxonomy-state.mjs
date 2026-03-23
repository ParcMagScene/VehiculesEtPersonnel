import Database from 'better-sqlite3';
import { writeFileSync } from 'fs';

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'vehicules-dev.db'), { readonly: true });
const outPath = join(__dirname, '_taxonomy-state.txt');
const out = [];
const log = (...args) => out.push(args.join(' '));

// 1. equipment_categories tree
const cats = db.prepare('SELECT id, name, level, parent_id FROM equipment_categories ORDER BY parent_id, id').all();
log('=== EQUIPMENT CATEGORIES TREE ===');
const families = cats.filter(c => c.level === 'family');
for (const f of families) {
  log(`F [${f.id}] ${f.name}`);
  const subs = cats.filter(c => c.parent_id === f.id && c.level === 'subfamily');
  for (const s of subs) {
    log(`  SF [${s.id}] ${s.name}`);
    const types = cats.filter(c => c.parent_id === s.id);
    for (const t of types) {
      log(`    C [${t.id}] ${t.name}`);
    }
  }
}

// 2. Brands in supplier_articles NOT in equipment
log('\n=== MARQUES supplier_articles ABSENTES de equipment ===');
const saB = db.prepare("SELECT DISTINCT brand FROM supplier_articles WHERE brand IS NOT NULL AND brand != ''").all().map(r => r.brand);
const eqB = db.prepare("SELECT DISTINCT brand FROM equipment WHERE brand IS NOT NULL AND brand != ''").all().map(r => r.brand);
const eqSet = new Set(eqB.map(b => b.toUpperCase()));
const missing = saB.filter(b => !eqSet.has(b.toUpperCase()));
log(missing.join(', '));

// 3. Brands in equipment NOT in supplier_articles
log('\n=== MARQUES equipment ABSENTES de supplier_articles ===');
const saSet = new Set(saB.map(b => b.toUpperCase()));
const missingEq = eqB.filter(b => !saSet.has(b.toUpperCase()));
log(missingEq.join(', '));
log('Total: ' + missingEq.length);

// 4. Brands in BL/BP parsed_data (fournisseur field in items)
log('\n=== MARQUES dans BL/BP (parsed items fournisseur) ===');
const bls = db.prepare("SELECT parsed_data FROM bl_imports WHERE parsed_data IS NOT NULL").all();
const blBrands = new Set();
for (const bl of bls) {
  try {
    const parsed = JSON.parse(bl.parsed_data);
    if (parsed.fournisseurs) parsed.fournisseurs.forEach(f => blBrands.add(f));
    if (parsed.items) {
      for (const item of parsed.items) {
        if (item.fournisseur && item.fournisseur !== 'STOCK') blBrands.add(item.fournisseur);
        // Also extract brand from "BRAND • description" pattern
        if (item.description) {
          const m = item.description.match(/^([A-ZÀ-Ü][A-ZÀ-Ü&' -]+?)\s*[•·]\s*/);
          if (m) blBrands.add(m[1].trim());
        }
      }
    }
  } catch(e) {}
}
log([...blBrands].sort().join(', '));

// 5. Equipment brand→category mapping (what families do brands typically belong to?)
log('\n=== TOP MARQUES equipment → famille ===');
const brandCatRows = db.prepare(`
  SELECT e.brand, ec.name as family, COUNT(*) as cnt
  FROM equipment e
  JOIN equipment_categories ec ON e.category_id IN (
    SELECT id FROM equipment_categories WHERE parent_id = ec.id OR id = ec.id
  )
  WHERE e.brand IS NOT NULL AND e.brand != '' AND ec.level = 'family'
  GROUP BY e.brand, ec.name
  ORDER BY cnt DESC
  LIMIT 60
`).all();
for (const r of brandCatRows) {
  log(`  ${r.cnt}x ${r.brand} → ${r.family}`);
}

// 6. Count of equipment per family
log('\n=== EQUIPMENT PAR FAMILLE ===');
const famCounts = db.prepare(`
  SELECT ec.name, ec.id, COUNT(e.id) as cnt
  FROM equipment_categories ec
  LEFT JOIN equipment e ON e.category_id IN (
    SELECT id FROM equipment_categories WHERE parent_id = ec.id
    UNION SELECT id FROM equipment_categories WHERE parent_id IN (SELECT id FROM equipment_categories WHERE parent_id = ec.id)
    UNION SELECT ec.id
  )
  WHERE ec.level = 'family'
  GROUP BY ec.id
  ORDER BY cnt DESC
`).all();
for (const r of famCounts) {
  log(`  [${r.id}] ${r.name}: ${r.cnt} équipements`);
}

db.close();

const content = out.join('\n');
writeFileSync(outPath, content);
console.log(content);
console.log('\n--- Written to', outPath);
writeFileSync(outPath, out.join('\n'), 'utf-8');
console.log(`Done: ${out.length} lines written`);
