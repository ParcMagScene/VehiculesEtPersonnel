#!/usr/bin/env node
/**
 * Migration: Merge PROD-only data into DEV-based merged DB
 * Uses SQLite backup API + transaction for safety
 */
const path = require('path');
const fs = require('fs');
const serverDir = path.join(__dirname, '..', 'server');
const Database = require(path.join(serverDir, 'node_modules', 'better-sqlite3'));

const devPath = path.join(serverDir, 'vehicules-dev.db');
const prodPath = path.join(serverDir, 'vehicules.db');
const mergedPath = path.join(serverDir, 'vehicules-merged.db');

async function main() {
  console.log('=== Migration: Fusion DEV + PROD ===\n');

  // 1. Verify sources
  console.log('1. Verification des bases source...');
  let db = new Database(devPath, { readonly: true });
  console.log('   DEV integrity:', db.pragma('integrity_check')[0].integrity_check);
  db.close();

  db = new Database(prodPath, { readonly: true });
  console.log('   PROD integrity:', db.pragma('integrity_check')[0].integrity_check);
  db.close();

  // 2. Copy dev via SQLite backup API (safe, atomic)
  console.log('\n2. Copie de la base DEV via backup API...');
  if (fs.existsSync(mergedPath)) fs.unlinkSync(mergedPath);

  const srcDb = new Database(devPath, { readonly: true });
  await srcDb.backup(mergedPath);
  srcDb.close();
  console.log('   OK - copie terminee');

  // 3. Verify copy
  const merged = new Database(mergedPath);
  const copyCheck = merged.pragma('integrity_check')[0].integrity_check;
  console.log('   Copie integrity:', copyCheck);
  if (copyCheck !== 'ok') {
    console.error('ERREUR: copie corrompue!');
    merged.close();
    process.exit(1);
  }

  // 4. Merge prod data
  console.log('\n3. Injection des donnees PROD manquantes...');
  merged.pragma('journal_mode = WAL');
  merged.exec("ATTACH DATABASE '" + prodPath + "' AS old_prod");

  const SKIP = new Set(['active_sessions', 'migrations_log', 'sqlite_sequence']);

  const tables = merged.prepare(
    "SELECT name FROM old_prod.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all();

  let total = 0;
  const enriched = [];

  const tx = merged.transaction(() => {
    for (const { name } of tables) {
      if (SKIP.has(name)) { console.log('  SKIP  ' + name); continue; }
      try {
        const before = merged.prepare('SELECT COUNT(*) as c FROM main."' + name + '"').get().c;
        merged.prepare('INSERT OR IGNORE INTO main."' + name + '" SELECT * FROM old_prod."' + name + '"').run();
        const after = merged.prepare('SELECT COUNT(*) as c FROM main."' + name + '"').get().c;
        const added = after - before;
        if (added > 0) {
          console.log('  +' + String(added).padStart(4) + '  ' + name + ' (' + before + ' -> ' + after + ')');
          total += added;
          enriched.push({ name, before, after, added });
        }
      } catch (e) {
        console.error('  ERR   ' + name + ': ' + e.message);
      }
    }
  });

  tx();
  merged.exec('DETACH DATABASE old_prod');

  // 5. Final integrity check
  console.log('\n4. Verification finale...');
  const finalCheck = merged.pragma('integrity_check')[0].integrity_check;
  console.log('   Integrity:', finalCheck);
  merged.close();

  if (finalCheck !== 'ok') {
    console.error('ERREUR: base fusionnee corrompue!');
    process.exit(1);
  }

  // Summary
  console.log('\n=== Resultat ===');
  console.log('Total records ajoutes depuis PROD: ' + total);
  if (enriched.length > 0) {
    console.log('\nTables enrichies:');
    enriched.forEach(r => console.log('  ' + r.name + ': ' + r.before + ' -> ' + r.after + ' (+' + r.added + ')'));
  }
  console.log('\nBase fusionnee prete: apps/api/vehicules-merged.db');
}

main().catch(err => { console.error(err); process.exit(1); });
