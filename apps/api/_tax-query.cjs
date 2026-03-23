const Database = require('better-sqlite3');
const { writeFileSync } = require('fs');
const { join } = require('path');

const dbPath = join(__dirname, 'vehicules-dev.db');
const outPath = join(__dirname, '_taxonomy-state.txt');

try {
  const db = new Database(dbPath, { readonly: true });
  const out = [];
  const log = (...a) => out.push(a.join(' '));

  // 1. equipment_categories tree
  const cats = db.prepare('SELECT id, name, level, parent_id FROM equipment_categories ORDER BY parent_id, id').all();
  log('=== EQUIPMENT CATEGORIES TREE ===');
  const families = cats.filter(c => c.level === 'family');
  for (const f of families) {
    log('F [' + f.id + '] ' + f.name);
    const subs = cats.filter(c => c.parent_id === f.id && c.level === 'subfamily');
    for (const s of subs) {
      log('  SF [' + s.id + '] ' + s.name);
      const types = cats.filter(c => c.parent_id === s.id);
      for (const t of types) {
        log('    C [' + t.id + '] ' + t.name);
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

  // 4. Equipment count per family
  log('\n=== EQUIPMENT PAR FAMILLE (via category tree) ===');
  for (const f of families) {
    const allIds = [f.id];
    const children = cats.filter(c => c.parent_id === f.id);
    for (const ch of children) {
      allIds.push(ch.id);
      const grandchildren = cats.filter(c => c.parent_id === ch.id);
      for (const gc of grandchildren) allIds.push(gc.id);
    }
    const placeholders = allIds.map(() => '?').join(',');
    const cnt = db.prepare('SELECT COUNT(*) as c FROM equipment WHERE category_id IN (' + placeholders + ')').get(...allIds);
    log('  [' + f.id + '] ' + f.name + ': ' + cnt.c);
  }

  // 5. Top brand->family associations in equipment
  log('\n=== TOP MARQUES -> FAMILLE (equipment) ===');
  for (const f of families) {
    const allIds = [f.id];
    const children = cats.filter(c => c.parent_id === f.id);
    for (const ch of children) {
      allIds.push(ch.id);
      const grandchildren = cats.filter(c => c.parent_id === ch.id);
      for (const gc of grandchildren) allIds.push(gc.id);
    }
    const placeholders = allIds.map(() => '?').join(',');
    const brands = db.prepare(
      "SELECT brand, COUNT(*) as cnt FROM equipment WHERE category_id IN (" + placeholders + ") AND brand IS NOT NULL AND brand != '' GROUP BY brand ORDER BY cnt DESC LIMIT 10"
    ).all(...allIds);
    if (brands.length > 0) {
      log('  ' + f.name + ':');
      for (const b of brands) log('    ' + b.cnt + 'x ' + b.brand);
    }
  }

  // 6. supplier_articles unified_family distribution
  log('\n=== SUPPLIER_ARTICLES PAR unified_family ===');
  const ufRows = db.prepare("SELECT unified_family, COUNT(*) as cnt FROM supplier_articles GROUP BY unified_family ORDER BY cnt DESC").all();
  for (const r of ufRows) log('  ' + (r.unified_family || '(null)') + ': ' + r.cnt);

  // 7. taxonomy_family_mapping rules summary
  log('\n=== TAXONOMY_FAMILY_MAPPING ===');
  const rules = db.prepare("SELECT * FROM taxonomy_family_mapping ORDER BY target_family, priority DESC").all();
  log('Total rules: ' + rules.length);
  const byFamily = {};
  for (const r of rules) {
    if (!byFamily[r.target_family]) byFamily[r.target_family] = [];
    byFamily[r.target_family].push(r);
  }
  for (const [fam, rs] of Object.entries(byFamily)) {
    log('  ' + fam + ' (' + rs.length + ' rules):');
    for (const r of rs) log('    [' + r.priority + '] ' + r.source_type + '/' + r.match_field + ': /' + r.match_pattern + '/');
  }

  db.close();
  writeFileSync(outPath, out.join('\n'));
  console.log('OK - wrote ' + out.length + ' lines to ' + outPath);
} catch (err) {
  console.error('ERREUR:', err.message);
  console.error(err.stack);
  process.exit(1);
}
