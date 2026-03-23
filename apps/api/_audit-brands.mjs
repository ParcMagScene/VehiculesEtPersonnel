import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'vehicules-dev.db');
const db = new Database(dbPath, { readonly: true });

const lines = [];
function log(s = '') { lines.push(s); }
function section(title) {
  log(`\n${'='.repeat(60)}`);
  log(`=== ${title} ===`);
  log('='.repeat(60));
}
function safeQuery(sql, label) {
  try { return db.prepare(sql).all(); }
  catch (e) { log(`  [ERREUR] ${label}: ${e.message}`); return []; }
}
function safeGet(sql) {
  try { return db.prepare(sql).get(); }
  catch (e) { return null; }
}

// 1. SUPPLIERS
section('1. TABLE suppliers');
const suppCols = db.prepare("PRAGMA table_info(suppliers)").all();
log('Colonnes: ' + suppCols.map(c => c.name).join(', '));
const suppCount = safeGet("SELECT COUNT(*) as c FROM suppliers");
log(`Total: ${suppCount?.c}`);
const suppDups = safeQuery("SELECT UPPER(name) as n, GROUP_CONCAT(name, ' / ') as variants, COUNT(*) as c FROM suppliers GROUP BY UPPER(name) HAVING c > 1 ORDER BY c DESC", 'dup suppliers');
if (suppDups.length) { log('DOUBLONS trouvés:'); suppDups.forEach(r => log(`  ${r.c}x | ${r.variants}`)); }
const suppAll = safeQuery("SELECT id, name FROM suppliers ORDER BY name", 'all suppliers');
log(`\nListe complète (${suppAll.length}):`);
suppAll.forEach(r => log(`  [${r.id}] ${r.name}`));

// 2. SUPPLIER_ARTICLES
section('2. TABLE supplier_articles');
const saCols = db.prepare("PRAGMA table_info(supplier_articles)").all();
log('Colonnes: ' + saCols.map(c => c.name).join(', '));
const saTotal = safeGet("SELECT COUNT(*) as c FROM supplier_articles")?.c || 0;
log(`Total articles: ${saTotal}`);
const saMapped = safeGet("SELECT COUNT(*) as c FROM supplier_articles WHERE unified_family IS NOT NULL AND unified_family != ''")?.c || 0;
log(`Mappés: ${saMapped} (${saTotal ? (saMapped/saTotal*100).toFixed(1) : 0}%)`);

// 2a. Par fournisseur
section('2a. supplier_articles par fournisseur');
const saBySupp = safeQuery(
  `SELECT s.name as supplier, COUNT(*) as c FROM supplier_articles sa LEFT JOIN suppliers s ON sa.supplier_id = s.id GROUP BY sa.supplier_id ORDER BY c DESC`, 'sa by supp');
log(`Fournisseurs distincts dans articles: ${saBySupp.length}`);
saBySupp.forEach(r => log(`  ${String(r.c).padStart(5)} | ${r.supplier || '(null)'}`));

// 2b. Marques
section('2b. supplier_articles — MARQUES');
const saBrandCount = safeGet("SELECT COUNT(DISTINCT brand) as c FROM supplier_articles WHERE brand IS NOT NULL AND brand != ''")?.c || 0;
log(`Marques distinctes: ${saBrandCount}`);
const saBrands = safeQuery(
  "SELECT brand, COUNT(*) as c FROM supplier_articles WHERE brand IS NOT NULL AND brand != '' GROUP BY brand ORDER BY c DESC", 'brands');
saBrands.forEach(r => log(`  ${String(r.c).padStart(5)} | ${r.brand}`));

// 2c. Modèles (top 100)
section('2c. supplier_articles — MODELES (top 100)');
const saModelCount = safeGet("SELECT COUNT(DISTINCT model) as c FROM supplier_articles WHERE model IS NOT NULL AND model != ''")?.c || 0;
log(`Modèles distincts: ${saModelCount}`);
const saModels = safeQuery(
  "SELECT model, COUNT(*) as c FROM supplier_articles WHERE model IS NOT NULL AND model != '' GROUP BY model ORDER BY c DESC LIMIT 100", 'models');
saModels.forEach(r => log(`  ${String(r.c).padStart(5)} | ${r.model}`));

// 2d. Familles
section('2d. supplier_articles — FAMILLES');
const saFamilies = safeQuery(
  "SELECT family, COUNT(*) as c FROM supplier_articles WHERE family IS NOT NULL AND family != '' GROUP BY family ORDER BY c DESC", 'sa families');
log(`Familles distinctes: ${saFamilies.length}`);
saFamilies.forEach(r => log(`  ${String(r.c).padStart(5)} | ${r.family}`));

// 2e. Sous-familles (top 50)
section('2e. supplier_articles — SOUS-FAMILLES (top 50)');
const saSubfamilies = safeQuery(
  "SELECT subfamily, COUNT(*) as c FROM supplier_articles WHERE subfamily IS NOT NULL AND subfamily != '' GROUP BY subfamily ORDER BY c DESC LIMIT 50", 'sa subfamilies');
log(`Sous-familles (top 50 de ${safeGet("SELECT COUNT(DISTINCT subfamily) as c FROM supplier_articles WHERE subfamily IS NOT NULL AND subfamily != ''")?.c || '?'}):`);
saSubfamilies.forEach(r => log(`  ${String(r.c).padStart(5)} | ${r.subfamily}`));

// 2f. Catégories (top 80)
section('2f. supplier_articles — CATEGORIES (top 80)');
const saCats = safeQuery(
  "SELECT category, COUNT(*) as c FROM supplier_articles WHERE category IS NOT NULL AND category != '' GROUP BY category ORDER BY c DESC LIMIT 80", 'sa categories');
log(`Catégories (top 80 de ${safeGet("SELECT COUNT(DISTINCT category) as c FROM supplier_articles WHERE category IS NOT NULL AND category != ''")?.c || '?'}):`);
saCats.forEach(r => log(`  ${String(r.c).padStart(5)} | ${r.category}`));

// 2g. unified_family
section('2g. supplier_articles — UNIFIED_FAMILY');
const saUF = safeQuery(
  "SELECT unified_family, COUNT(*) as c FROM supplier_articles WHERE unified_family IS NOT NULL AND unified_family != '' GROUP BY unified_family ORDER BY c DESC", 'uf');
log(`Familles unifiées: ${saUF.length}`);
saUF.forEach(r => log(`  ${String(r.c).padStart(5)} | ${r.unified_family}`));

// 3. EQUIPMENT
section('3. TABLE equipment');
const eqCols = db.prepare("PRAGMA table_info(equipment)").all();
log('Colonnes: ' + eqCols.map(c => c.name).join(', '));
const eqCount = safeGet("SELECT COUNT(*) as c FROM equipment")?.c || 0;
log(`Total: ${eqCount}`);

const eqBrands = safeQuery(
  "SELECT brand, COUNT(*) as c FROM equipment WHERE brand IS NOT NULL AND brand != '' GROUP BY brand ORDER BY c DESC", 'eq brands');
log(`\nMarques equipment (${eqBrands.length}):`);
eqBrands.forEach(r => log(`  ${String(r.c).padStart(5)} | ${r.brand}`));

const eqModels = safeQuery(
  "SELECT model, COUNT(*) as c FROM equipment WHERE model IS NOT NULL AND model != '' GROUP BY model ORDER BY c DESC LIMIT 60", 'eq models');
const eqModelTotal = safeGet("SELECT COUNT(DISTINCT model) as c FROM equipment WHERE model IS NOT NULL AND model != ''")?.c || 0;
log(`\nModèles equipment (top 60, total ${eqModelTotal}):`);
eqModels.forEach(r => log(`  ${String(r.c).padStart(5)} | ${r.model}`));

const eqMfrs = safeQuery(
  "SELECT manufacturer, COUNT(*) as c FROM equipment WHERE manufacturer IS NOT NULL AND manufacturer != '' GROUP BY manufacturer ORDER BY c DESC", 'eq mfr');
log(`\nFabricants equipment (${eqMfrs.length}):`);
eqMfrs.forEach(r => log(`  ${String(r.c).padStart(5)} | ${r.manufacturer}`));

// 4. EQUIPMENT_CATALOG
section('4. TABLE equipment_catalog');
try {
  const ecCols = db.prepare("PRAGMA table_info(equipment_catalog)").all();
  log('Colonnes: ' + ecCols.map(c => c.name).join(', '));
  const ecCount = safeGet("SELECT COUNT(*) as c FROM equipment_catalog")?.c || 0;
  log(`Total: ${ecCount}`);
  const ecBrands = safeQuery(
    "SELECT brand, COUNT(*) as c FROM equipment_catalog WHERE brand IS NOT NULL AND brand != '' GROUP BY brand ORDER BY c DESC", 'ec brands');
  log(`Marques catalogue (${ecBrands.length}):`);
  ecBrands.forEach(r => log(`  ${String(r.c).padStart(5)} | ${r.brand}`));
} catch (e) { log(`  Table inexistante: ${e.message}`); }

// 5. ORDERS
section('5. TABLE orders');
try {
  const ordCols = db.prepare("PRAGMA table_info(orders)").all();
  log('Colonnes: ' + ordCols.map(c => c.name).join(', '));
  const ordCount = safeGet("SELECT COUNT(*) as c FROM orders")?.c || 0;
  log(`Total: ${ordCount}`);
  const ordSupps = safeQuery(
    "SELECT supplier, COUNT(*) as c FROM orders WHERE supplier IS NOT NULL AND supplier != '' GROUP BY supplier ORDER BY c DESC", 'ord suppliers');
  log(`Fournisseurs dans orders (${ordSupps.length}):`);
  ordSupps.forEach(r => log(`  ${String(r.c).padStart(5)} | ${r.supplier}`));
} catch (e) { log(`  Table inexistante: ${e.message}`); }

// 6. ORDER_ITEMS
section('6. TABLE order_items');
try {
  const oiCols = db.prepare("PRAGMA table_info(order_items)").all();
  log('Colonnes: ' + oiCols.map(c => c.name).join(', '));
  const oiCount = safeGet("SELECT COUNT(*) as c FROM order_items")?.c || 0;
  log(`Total: ${oiCount}`);
  const oiSamples = safeQuery("SELECT * FROM order_items LIMIT 10", 'oi samples');
  log('Échantillons:');
  oiSamples.forEach(r => log(`  ${JSON.stringify(r)}`));
} catch (e) { log(`  Table inexistante: ${e.message}`); }

// 7. BL_IMPORTS
section('7. TABLE bl_imports');
try {
  const blCols = db.prepare("PRAGMA table_info(bl_imports)").all();
  log('Colonnes: ' + blCols.map(c => c.name).join(', '));
  const blCount = safeGet("SELECT COUNT(*) as c FROM bl_imports")?.c || 0;
  log(`Total: ${blCount}`);
  const blSamples = safeQuery("SELECT * FROM bl_imports LIMIT 5", 'bl samples');
  log('Échantillons:');
  blSamples.forEach(r => log(`  ${JSON.stringify(r)}`));
} catch (e) { log(`  Table inexistante: ${e.message}`); }

// 8. STOCK_MOVEMENTS
section('8. TABLE stock_movements');
try {
  const smCols = db.prepare("PRAGMA table_info(stock_movements)").all();
  log('Colonnes: ' + smCols.map(c => c.name).join(', '));
  const smSupps = safeQuery(
    "SELECT supplier, COUNT(*) as c FROM stock_movements WHERE supplier IS NOT NULL AND supplier != '' GROUP BY supplier ORDER BY c DESC LIMIT 30", 'sm supps');
  log(`Fournisseurs dans stock_movements:`);
  smSupps.forEach(r => log(`  ${String(r.c).padStart(5)} | ${r.supplier}`));
} catch (e) { log(`  Table inexistante: ${e.message}`); }

// 9. EQUIPMENT_LIST_ITEMS
section('9. TABLE equipment_list_items');
try {
  const eliCols = db.prepare("PRAGMA table_info(equipment_list_items)").all();
  log('Colonnes: ' + eliCols.map(c => c.name).join(', '));
  const eliCount = safeGet("SELECT COUNT(*) as c FROM equipment_list_items")?.c || 0;
  log(`Total: ${eliCount}`);
} catch (e) { log(`  Table inexistante: ${e.message}`); }

// 10. SAV_TICKETS
section('10. TABLE sav_tickets');
try {
  const savCols = db.prepare("PRAGMA table_info(sav_tickets)").all();
  log('Colonnes: ' + savCols.map(c => c.name).join(', '));
  const savCount = safeGet("SELECT COUNT(*) as c FROM sav_tickets")?.c || 0;
  log(`Total: ${savCount}`);
} catch (e) { log(`  Table inexistante: ${e.message}`); }

// 11. BP_ITEMS
section('11. TABLE bp_items — Designations');
try {
  const bpCols = db.prepare("PRAGMA table_info(bp_items)").all();
  log('Colonnes: ' + bpCols.map(c => c.name).join(', '));
  const bpCount = safeGet("SELECT COUNT(*) as c FROM bp_items")?.c || 0;
  log(`Total: ${bpCount}`);
  const bpSamples = safeQuery("SELECT designation, family FROM bp_items WHERE designation IS NOT NULL LIMIT 60", 'bp samples');
  log('Échantillons (60):');
  bpSamples.forEach(r => log(`  [${r.family || '-'}] ${r.designation}`));
} catch (e) { log(`  Table inexistante: ${e.message}`); }

// 12. EQUIPMENT_CATEGORIES
section('12. equipment_categories');
const ecatFamilies = safeQuery("SELECT id, name FROM equipment_categories WHERE level = 'family' ORDER BY name", 'families');
log(`Familles (${ecatFamilies.length}):`);
ecatFamilies.forEach(f => log(`  [${f.id}] ${f.name}`));
const ecatSubfamilies = safeQuery("SELECT id, name, parent_id FROM equipment_categories WHERE level = 'subfamily' ORDER BY parent_id, name", 'subfamilies');
log(`\nSous-familles (${ecatSubfamilies.length}):`);
ecatSubfamilies.forEach(f => log(`  [${f.id}] ${f.name} (parent: ${f.parent_id})`));
const ecatCats = safeQuery("SELECT id, name, parent_id FROM equipment_categories WHERE level = 'category' ORDER BY parent_id, name", 'categories');
log(`\nCatégories (${ecatCats.length}):`);
ecatCats.forEach(f => log(`  [${f.id}] ${f.name} (parent: ${f.parent_id})`));

// 13. TAXONOMY_FAMILY_MAPPING
section('13. taxonomy_family_mapping');
const tfmAll = safeQuery("SELECT * FROM taxonomy_family_mapping ORDER BY priority DESC", 'tfm');
log(`Total règles: ${tfmAll.length}`);
tfmAll.forEach(r => log(`  [p${r.priority}] ${r.is_regex ? 'REGEX' : 'EXACT'}: "${r.source_pattern}" → ${r.target_family}`));

// 14. STOCK_CATEGORIES
section('14. stock_categories');
try {
  const scAll = safeQuery("SELECT id, name, parent_id FROM stock_categories ORDER BY parent_id, name", 'sc');
  const roots = scAll.filter(r => !r.parent_id);
  log(`Racines (${roots.length}):`);
  roots.forEach(r => {
    const children = scAll.filter(c => c.parent_id === r.id);
    log(`  [${r.id}] ${r.name} (${children.length} enfants)`);
    children.slice(0, 10).forEach(c => log(`    └─ [${c.id}] ${c.name}`));
    if (children.length > 10) log(`    ... et ${children.length - 10} de plus`);
  });
} catch (e) { log(`  Table inexistante: ${e.message}`); }

// 15. CROSS: fournisseur → marques  
section('15. CROSS: fournisseur → marques (top 80)');
const combos = safeQuery(
  `SELECT s.name as supplier, sa.brand, COUNT(*) as c 
   FROM supplier_articles sa 
   LEFT JOIN suppliers s ON sa.supplier_id = s.id 
   WHERE sa.brand IS NOT NULL AND sa.brand != '' 
   GROUP BY sa.supplier_id, sa.brand 
   ORDER BY c DESC LIMIT 80`, 'combos');
combos.forEach(r => log(`  ${String(r.c).padStart(5)} | ${r.supplier} → ${r.brand}`));

// 16. VARIANTES ORTHOGRAPHIQUES
section('16. VARIANTES ORTHOGRAPHIQUES — Marques');
const allBrands = safeQuery(
  "SELECT DISTINCT brand FROM supplier_articles WHERE brand IS NOT NULL AND brand != '' UNION SELECT DISTINCT brand FROM equipment WHERE brand IS NOT NULL AND brand != ''", 'all brands');
const brandNames = allBrands.map(r => r.brand);
const brandNorm = {};
brandNames.forEach(b => {
  const key = b.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!brandNorm[key]) brandNorm[key] = [];
  brandNorm[key].push(b);
});
const variants = Object.entries(brandNorm).filter(([_, v]) => v.length > 1);
log(`Groupes avec variantes: ${variants.length}`);
variants.forEach(([key, vals]) => log(`  ${key} → ${vals.join(' / ')}`));

// 17. VARIANTES ORTHOGRAPHIQUES — Fournisseurs
section('17. VARIANTES ORTHOGRAPHIQUES — Fournisseurs');
const suppNameNorm = {};
suppAll.forEach(r => {
  const key = r.name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!suppNameNorm[key]) suppNameNorm[key] = [];
  suppNameNorm[key].push(`[${r.id}] ${r.name}`);
});
const suppVariants = Object.entries(suppNameNorm).filter(([_, v]) => v.length > 1);
log(`Groupes avec variantes: ${suppVariants.length}`);
suppVariants.forEach(([key, vals]) => log(`  ${key} → ${vals.join(' / ')}`));

// 18. RÉSUMÉ
section('RÉSUMÉ GLOBAL');
log(`suppliers: ${suppCount?.c} entrées, ${suppDups.length} groupes de doublons, ${suppVariants.length} variantes`);
log(`supplier_articles: ${saTotal} total, ${saMapped} mappés (${saTotal ? (saMapped/saTotal*100).toFixed(1) : 0}%)`);
log(`  - ${saBySupp.length} fournisseurs distincts`);
log(`  - ${saBrandCount} marques distinctes`);
log(`  - ${saModelCount} modèles distincts`);
log(`  - ${saFamilies.length} familles distinctes`);
log(`equipment: ${eqCount} entrées, ${eqBrands.length} marques, ${eqMfrs.length} fabricants`);
log(`equipment_categories: ${ecatFamilies.length} familles, ${ecatSubfamilies.length} sous-familles, ${ecatCats.length} catégories`);
log(`taxonomy_family_mapping: ${tfmAll.length} règles`);
log(`variantes marques: ${variants.length} groupes`);

db.close();

const output = lines.join('\n');
const outPath = join(__dirname, '_audit-output.txt');
writeFileSync(outPath, output);
console.log(`Audit terminé — ${lines.length} lignes écrites dans ${outPath}`);
console.log(`Taille: ${(Buffer.byteLength(output) / 1024).toFixed(1)} KB`);
