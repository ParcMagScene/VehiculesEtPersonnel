const db = require('better-sqlite3')('vehicules-dev.db');

// BRANDS
const brands = db.prepare('SELECT b.id, b.name, b.slug, b.primary_domain FROM brands b ORDER BY b.name').all();
console.log('=== BRANDS (' + brands.length + ') ===');
brands.forEach(b => console.log(b.name + ' | ' + b.primary_domain + ' | ' + b.slug));

// ALIASES
const aliases = db.prepare('SELECT ba.alias, b.name as brand FROM brand_aliases ba JOIN brands b ON ba.brand_id=b.id ORDER BY b.name, ba.alias').all();
console.log('\n=== BRAND ALIASES (' + aliases.length + ') ===');
aliases.forEach(a => console.log(a.brand + ' <- ' + a.alias));

// BRAND-FAMILY MAP
const bfm = db.prepare('SELECT b.name as brand, ec.name as family, bfm.is_primary FROM brand_family_mapping bfm JOIN brands b ON bfm.brand_id=b.id JOIN equipment_categories ec ON bfm.family_id=ec.id ORDER BY ec.name, b.name').all();
console.log('\n=== BRAND FAMILY MAP (' + bfm.length + ') ===');
const byF = {};
bfm.forEach(r => { (byF[r.family] = byF[r.family] || []).push(r.brand); });
Object.entries(byF).sort().forEach(([f, bs]) => console.log(f + ': ' + bs.join(', ')));

// STATS
const eqCount = db.prepare('SELECT COUNT(*) as c FROM equipment').get().c;
const eqBrand = db.prepare('SELECT COUNT(*) as c FROM equipment WHERE brand_id IS NOT NULL').get().c;
const artCount = db.prepare('SELECT COUNT(*) as c FROM supplier_articles').get().c;
const artBrand = db.prepare('SELECT COUNT(*) as c FROM supplier_articles WHERE brand_id IS NOT NULL').get().c;
const artMapped = db.prepare("SELECT COUNT(*) as c FROM supplier_articles WHERE unified_family IS NOT NULL AND unified_family != ''").get().c;
console.log('\n=== STATS ===');
console.log('Equipment: ' + eqCount + ' total, ' + eqBrand + ' with brand_id (' + (eqBrand / eqCount * 100).toFixed(1) + '%)');
console.log('Articles: ' + artCount + ' total, ' + artBrand + ' with brand_id (' + (artBrand / artCount * 100).toFixed(1) + '%), ' + artMapped + ' with unified_family (' + (artMapped / artCount * 100).toFixed(1) + '%)');

// TOP BRANDS
const top = db.prepare(`
  SELECT b.name, b.primary_domain,
    (SELECT COUNT(*) FROM equipment e WHERE e.brand_id=b.id) as eq,
    (SELECT COUNT(*) FROM supplier_articles sa WHERE sa.brand_id=b.id) as art
  FROM brands b ORDER BY eq+art DESC LIMIT 20
`).all();
console.log('\n=== TOP 20 BRANDS ===');
top.forEach(b => console.log(b.name + ' (' + b.primary_domain + '): ' + b.eq + ' eq + ' + b.art + ' art = ' + (b.eq + b.art)));

db.close();
