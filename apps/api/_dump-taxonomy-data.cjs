// Dump all taxonomy + brands data for documentation
const db = require('better-sqlite3')('vehicules-dev.db');

console.log('=== FAMILIES ===');
const families = db.prepare("SELECT id, name, icon FROM equipment_categories WHERE level='family' ORDER BY name").all();
families.forEach(f => console.log(`  ${f.icon || '📦'} ${f.name} (id:${f.id})`));

console.log('\n=== SUBFAMILIES ===');
const subs = db.prepare("SELECT c.id, c.name, p.name as parent FROM equipment_categories c JOIN equipment_categories p ON c.parent_id=p.id WHERE c.level='subfamily' ORDER BY p.name, c.name").all();
subs.forEach(s => console.log(`  ${s.parent} → ${s.name} (id:${s.id})`));

console.log('\n=== CATEGORIES (leaf) ===');
const cats = db.prepare(`
  SELECT c.id, c.name, sf.name as subfamily, f.name as family
  FROM equipment_categories c
  JOIN equipment_categories sf ON c.parent_id=sf.id
  JOIN equipment_categories f ON sf.parent_id=f.id
  WHERE c.level='category'
  ORDER BY f.name, sf.name, c.name
`).all();
cats.forEach(c => console.log(`  ${c.family} > ${c.subfamily} > ${c.name} (id:${c.id})`));

console.log('\n=== TAXONOMY FAMILY MAPPING RULES ===');
const rules = db.prepare("SELECT id, pattern, unified_family, priority FROM taxonomy_family_mapping ORDER BY priority DESC, id").all();
rules.forEach(r => console.log(`  [${r.priority}] /${r.pattern}/ → ${r.unified_family}`));

console.log('\n=== BRANDS (87) ===');
const brands = db.prepare("SELECT b.id, b.name, b.slug, b.domain FROM brands b ORDER BY b.name").all();
brands.forEach(b => console.log(`  ${b.name} (${b.domain}) [${b.slug}]`));

console.log('\n=== BRAND ALIASES ===');
const aliases = db.prepare("SELECT ba.alias, b.name as brand FROM brand_aliases ba JOIN brands b ON ba.brand_id=b.id ORDER BY b.name, ba.alias").all();
aliases.forEach(a => console.log(`  ${a.brand} ← "${a.alias}"`));

console.log('\n=== BRAND FAMILY MAPPING ===');
const bfm = db.prepare("SELECT b.name as brand, bfm.family FROM brand_family_mapping bfm JOIN brands b ON bfm.brand_id=b.id ORDER BY bfm.family, b.name").all();
const byFamily = {};
bfm.forEach(r => { (byFamily[r.family] = byFamily[r.family] || []).push(r.brand); });
Object.entries(byFamily).sort().forEach(([f, bs]) => console.log(`  ${f}: ${bs.join(', ')}`));

console.log('\n=== STATS ===');
const eqCount = db.prepare("SELECT COUNT(*) as c FROM equipment").get().c;
const eqWithBrand = db.prepare("SELECT COUNT(*) as c FROM equipment WHERE brand_id IS NOT NULL").get().c;
const artCount = db.prepare("SELECT COUNT(*) as c FROM supplier_articles").get().c;
const artWithBrand = db.prepare("SELECT COUNT(*) as c FROM supplier_articles WHERE brand_id IS NOT NULL").get().c;
const artMapped = db.prepare("SELECT COUNT(*) as c FROM supplier_articles WHERE unified_family IS NOT NULL AND unified_family != ''").get().c;
console.log(`  Equipment: ${eqCount} total, ${eqWithBrand} with brand_id (${(eqWithBrand/eqCount*100).toFixed(1)}%)`);
console.log(`  Articles: ${artCount} total, ${artWithBrand} with brand_id (${(artWithBrand/artCount*100).toFixed(1)}%), ${artMapped} mapped to unified_family (${(artMapped/artCount*100).toFixed(1)}%)`);

const topBrands = db.prepare(`
  SELECT b.name, b.domain,
    (SELECT COUNT(*) FROM equipment e WHERE e.brand_id=b.id) as eq,
    (SELECT COUNT(*) FROM supplier_articles sa WHERE sa.brand_id=b.id) as art
  FROM brands b ORDER BY eq+art DESC LIMIT 20
`).all();
console.log('\n=== TOP 20 BRANDS BY USAGE ===');
topBrands.forEach(b => console.log(`  ${b.name} (${b.domain}): ${b.eq} eq + ${b.art} art = ${b.eq+b.art}`));

db.close();
