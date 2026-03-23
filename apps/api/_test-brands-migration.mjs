// Test runner for taxonomy-brands-v1.js migrations
import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { runBrandsMigrations } from './migrations/taxonomy-brands-v1.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'vehicules-dev.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Running brands migrations...\n');

try {
  runBrandsMigrations(db);
  console.log('\n--- VERIFICATION ---');
  
  const brands = db.prepare('SELECT COUNT(*) as c FROM brands').get();
  console.log(`brands: ${brands.c} rows`);
  
  const aliases = db.prepare('SELECT COUNT(*) as c FROM brand_aliases').get();
  console.log(`brand_aliases: ${aliases.c} rows`);
  
  const bfm = db.prepare('SELECT COUNT(*) as c FROM brand_family_mapping').get();
  console.log(`brand_family_mapping: ${bfm.c} rows`);
  
  // Check new columns
  const eqCols = db.pragma('table_info(equipment)').map(c => c.name);
  console.log(`equipment.brand_id: ${eqCols.includes('brand_id') ? '✅' : '❌'}`);
  console.log(`equipment.model: ${eqCols.includes('model') ? '✅' : '❌'}`);
  
  const saCols = db.pragma('table_info(supplier_articles)').map(c => c.name);
  console.log(`supplier_articles.brand_id: ${saCols.includes('brand_id') ? '✅' : '❌'}`);
  
  const ecCols = db.pragma('table_info(equipment_catalog)').map(c => c.name);
  console.log(`equipment_catalog.brand_id: ${ecCols.includes('brand_id') ? '✅' : '❌'}`);
  
  // Check supplier fusions
  const deactivated = db.prepare('SELECT COUNT(*) as c FROM suppliers WHERE is_active = 0').get();
  console.log(`suppliers deactivated: ${deactivated.c}`);
  
  // Check brand_id linking
  const eqLinked = db.prepare('SELECT COUNT(*) as c FROM equipment WHERE brand_id IS NOT NULL').get();
  console.log(`equipment with brand_id: ${eqLinked.c}`);
  
  const saLinked = db.prepare('SELECT COUNT(*) as c FROM supplier_articles WHERE brand_id IS NOT NULL').get();
  console.log(`supplier_articles with brand_id: ${saLinked.c}`);
  
  // Check category renames
  const renamed = db.prepare("SELECT id, name FROM equipment_categories WHERE id IN (75, 154, 105, 145, 178)").all();
  console.log('\nRenamed categories:');
  renamed.forEach(r => console.log(`  [${r.id}] ${r.name}`));
  
  // Check new categories
  const newCats = db.prepare("SELECT name, level FROM equipment_categories WHERE name IN ('Stroboscope','Barre LED','Switcheur réseau','Encodeur/Décodeur','Caméra','Objectif','Dante/AES67','Interface réseau','Piano numérique','Synthétiseur','Réseau vidéo','Captation','Réseau audio','Instruments')").all();
  console.log('\nNew categories/subfamilies:');
  newCats.forEach(r => console.log(`  ${r.name} (${r.level})`));
  
  // Check mapping rules count
  const rules = db.prepare('SELECT COUNT(*) as c FROM taxonomy_family_mapping').get();
  console.log(`\ntaxonomy_family_mapping rules: ${rules.c}`);
  
  // Check unified_family mapping
  const mapped = db.prepare("SELECT COUNT(*) as c FROM supplier_articles WHERE unified_family IS NOT NULL").get();
  const total = db.prepare("SELECT COUNT(*) as c FROM supplier_articles").get();
  console.log(`supplier_articles mapped: ${mapped.c}/${total.c} (${(mapped.c/total.c*100).toFixed(1)}%)`);
  
  // Check migrations log
  const logs = db.prepare("SELECT key FROM _migrations_log WHERE key LIKE 'brands_%' ORDER BY key").all();
  console.log('\nMigration keys applied:');
  logs.forEach(l => console.log(`  ✅ ${l.key}`));
  
} catch (err) {
  console.error('ERROR:', err.message);
  console.error(err.stack);
} finally {
  db.close();
}
