#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 *  SYNCHRONISATION BIDIRECTIONNELLE DEV ↔ PROD
 * ═══════════════════════════════════════════════════════════
 *
 *  🎯 Règles :
 *   - La PRODUCTION est la source de vérité
 *   - Aucune donnée prod ne sera écrasée
 *   - Aucun DELETE, aucun UPDATE destructif
 *   - INSERT WHERE NOT EXISTS uniquement
 *   - Transactions atomiques
 *
 *  Usage :
 *    node scripts/sync-dev-prod.js --dry-run          # Affiche le plan sans rien faire
 *    node scripts/sync-dev-prod.js --phase prod-to-dev # Sync prod → dev uniquement
 *    node scripts/sync-dev-prod.js --phase dev-to-prod # Sync dev → prod uniquement
 *    node scripts/sync-dev-prod.js --phase all         # Les deux phases
 *
 *  ⚠️  TOUJOURS exécuter backup-databases.sh AVANT ce script
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_DIR = join(__dirname, '..', 'apps', 'api');
const LOG_DIR = join(__dirname, '..', 'backups');

// ─── Arguments CLI ──────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const PHASE = (() => {
  const idx = args.indexOf('--phase');
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
})();

if (!PHASE && !DRY_RUN) {
  console.error('❌ Usage : node scripts/sync-dev-prod.js --phase <prod-to-dev|dev-to-prod|all> [--dry-run]');
  console.error('   ou   : node scripts/sync-dev-prod.js --dry-run');
  process.exit(1);
}

// ─── Tables à NE PAS synchroniser ───────────────────────
const SKIP_TABLES = new Set([
  'sqlite_sequence',       // auto-géré par SQLite
  'active_sessions',       // sessions éphémères
  'video_access_logs',     // logs vidéo
  'video_sessions',        // sessions vidéo
  'display_logs',          // logs affichage
  'modification_history',  // historique modifs (diverge par nature)
  'display_completed_events',
]);

// Tables à ne PAS synchroniser DEV → PROD (sensibles)
const SKIP_DEV_TO_PROD = new Set([
  'users',                 // mots de passe différents, compte TEST en dev
  'google_tokens',         // tokens OAuth env-spécifiques
  'access_requests',       // demandes d'accès env-spécifiques
  'authorized_emails',     // emails autorisés env-spécifiques
  '_migrations_log',       // timestamps de migrations
  'migrations_log',        // timestamps de migrations
  'config',                // config peut différer entre envs
]);

// Tables où seuls les timestamps diffèrent (conflits ignorables)
const TIMESTAMP_ONLY_CONFLICTS = new Set([
  'brand_aliases',
  'brands',
  'brand_family_mapping',
  'taxonomy_family_mapping',
  'equipment_categories',
  'inventory_locations',
  'stock_categories',
  'public_holidays',
]);

// ─── Connexion aux DBs ─────────────────────────────────
const PROD_PATH = join(API_DIR, 'vehicules.db');
const DEV_PATH = join(API_DIR, 'vehicules-dev.db');

function openDb(path, readonly) {
  const db = new Database(path, { readonly, fileMustExist: true });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

// ─── Helpers ────────────────────────────────────────────

function getTables(db) {
  return db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all().map(r => r.name);
}

function getPrimaryKeys(db, table) {
  return db.pragma(`table_info([${table}])`)
    .filter(c => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map(c => c.name);
}

function getColumns(db, table) {
  return db.pragma(`table_info([${table}])`).map(c => c.name);
}

function getAllRows(db, table) {
  return db.prepare(`SELECT * FROM [${table}]`).all();
}

function makeKey(row, pkCols) {
  return pkCols.map(c => String(row[c] ?? 'NULL')).join('|||');
}

// ─── Journal ────────────────────────────────────────────

const logLines = [];
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  logLines.push(line);
  console.log(msg);
}

function saveLog() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const logFile = join(LOG_DIR, `sync-log-${ts}.txt`);
  writeFileSync(logFile, logLines.join('\n') + '\n', 'utf8');
  console.log(`\n📝 Journal sauvegardé : ${logFile}`);
}

// ─── Synchronisation d'une table (direction unique) ─────

function syncTable(sourceDb, targetDb, table, direction, dryRun) {
  const pkCols = getPrimaryKeys(sourceDb, table);
  if (pkCols.length === 0) {
    log(`  ⏭️  [${table}] Pas de clé primaire — ignorée`);
    return { inserted: 0, skipped: 0 };
  }

  const sourceCols = getColumns(sourceDb, table);
  const targetCols = getColumns(targetDb, table);
  const commonCols = sourceCols.filter(c => targetCols.includes(c));

  if (commonCols.length === 0) {
    log(`  ⏭️  [${table}] Aucune colonne commune — ignorée`);
    return { inserted: 0, skipped: 0 };
  }

  // Récupérer toutes les lignes source et les PKs cibles
  const sourceRows = sourceDb.prepare(
    `SELECT ${commonCols.map(c => `[${c}]`).join(', ')} FROM [${table}]`
  ).all();
  const targetRows = targetDb.prepare(
    `SELECT ${pkCols.map(c => `[${c}]`).join(', ')} FROM [${table}]`
  ).all();

  const targetKeySet = new Set(targetRows.map(r => makeKey(r, pkCols)));

  // Lignes à insérer : présentes dans source mais pas dans target
  const toInsert = sourceRows.filter(r => !targetKeySet.has(makeKey(r, pkCols)));

  if (toInsert.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  if (dryRun) {
    log(`  📋 [${table}] ${direction} : ${toInsert.length} INSERT à effectuer`);
    return { inserted: toInsert.length, skipped: 0 };
  }

  // Préparer l'INSERT
  const colList = commonCols.map(c => `[${c}]`).join(', ');
  const placeholders = commonCols.map(() => '?').join(', ');
  const insertStmt = targetDb.prepare(
    `INSERT OR IGNORE INTO [${table}] (${colList}) VALUES (${placeholders})`
  );

  let inserted = 0;
  let skipped = 0;

  for (const row of toInsert) {
    const values = commonCols.map(c => row[c] ?? null);
    try {
      const result = insertStmt.run(...values);
      if (result.changes > 0) {
        inserted++;
      } else {
        skipped++;
      }
    } catch (err) {
      log(`  ⚠️  [${table}] Erreur INSERT PK=${makeKey(row, pkCols)} : ${err.message}`);
      skipped++;
    }
  }

  if (inserted > 0) {
    log(`  ✅ [${table}] ${direction} : ${inserted} lignes insérées${skipped > 0 ? `, ${skipped} ignorées` : ''}`);
  }

  return { inserted, skipped };
}

// ─── Phase 1 : PROD → DEV ──────────────────────────────

function syncProdToDev(dryRun) {
  log('');
  log('═══════════════════════════════════════════════════════');
  log('  PHASE 1 : PROD → DEV (import des données manquantes)');
  log('═══════════════════════════════════════════════════════');
  log('');

  const prodRead = openDb(PROD_PATH, true);
  // Dev en écriture si pas dry-run
  const devDb = dryRun ? openDb(DEV_PATH, true) : openDb(DEV_PATH, false);

  const tables = getTables(prodRead);
  let totalInserted = 0;
  let totalSkipped = 0;
  let tablesModified = 0;

  const runSync = dryRun ? null : devDb.transaction(() => {
    for (const table of tables) {
      if (SKIP_TABLES.has(table)) continue;
      const { inserted, skipped } = syncTable(prodRead, devDb, table, 'PROD→DEV', false);
      totalInserted += inserted;
      totalSkipped += skipped;
      if (inserted > 0) tablesModified++;
    }
  });

  if (dryRun) {
    for (const table of tables) {
      if (SKIP_TABLES.has(table)) continue;
      const { inserted } = syncTable(prodRead, devDb, table, 'PROD→DEV', true);
      totalInserted += inserted;
      if (inserted > 0) tablesModified++;
    }
  } else {
    runSync();
  }

  log('');
  log(`  📊 Bilan PROD→DEV : ${totalInserted} lignes insérées dans ${tablesModified} tables`);
  if (totalSkipped > 0) log(`     (${totalSkipped} lignes ignorées/erreurs)`);

  // Vérification intégrité
  if (!dryRun) {
    const integrity = devDb.pragma('integrity_check');
    const ok = integrity[0]?.integrity_check === 'ok';
    log(`  🔍 Intégrité DEV : ${ok ? '✅ OK' : '❌ PROBLÈME DÉTECTÉ'}`);
    if (!ok) {
      log('  ❌ INTÉGRITÉ COMPROMISE — vérifiez le backup');
    }
    const fkCheck = devDb.pragma('foreign_key_check');
    if (fkCheck.length === 0) {
      log('  🔍 Foreign keys DEV : ✅ OK');
    } else {
      log(`  ⚠️  Foreign keys DEV : ${fkCheck.length} violation(s) (non bloquant pour des données historiques)`);
    }
  }

  prodRead.close();
  devDb.close();

  return { totalInserted, tablesModified };
}

// ─── Phase 2 : DEV → PROD ──────────────────────────────

function syncDevToProd(dryRun) {
  log('');
  log('═══════════════════════════════════════════════════════');
  log('  PHASE 2 : DEV → PROD (import données dev manquantes)');
  log('  ⚠️  PROD PRIORITAIRE — aucun écrasement');
  log('═══════════════════════════════════════════════════════');
  log('');

  const devRead = openDb(DEV_PATH, true);
  const prodDb = dryRun ? openDb(PROD_PATH, true) : openDb(PROD_PATH, false);

  const tables = getTables(devRead);
  let totalInserted = 0;
  let totalSkipped = 0;
  let tablesModified = 0;
  const skippedTables = [];

  const runSync = dryRun ? null : prodDb.transaction(() => {
    for (const table of tables) {
      if (SKIP_TABLES.has(table)) continue;
      if (SKIP_DEV_TO_PROD.has(table)) {
        skippedTables.push(table);
        continue;
      }
      const { inserted, skipped } = syncTable(devRead, prodDb, table, 'DEV→PROD', false);
      totalInserted += inserted;
      totalSkipped += skipped;
      if (inserted > 0) tablesModified++;
    }
  });

  if (dryRun) {
    for (const table of tables) {
      if (SKIP_TABLES.has(table)) continue;
      if (SKIP_DEV_TO_PROD.has(table)) {
        skippedTables.push(table);
        continue;
      }
      const { inserted } = syncTable(devRead, prodDb, table, 'DEV→PROD', true);
      totalInserted += inserted;
      if (inserted > 0) tablesModified++;
    }
  } else {
    runSync();
  }

  if (skippedTables.length > 0) {
    log(`  🚫 Tables exclues (sensibles) : ${skippedTables.join(', ')}`);
  }

  log('');
  log(`  📊 Bilan DEV→PROD : ${totalInserted} lignes insérées dans ${tablesModified} tables`);
  if (totalSkipped > 0) log(`     (${totalSkipped} lignes ignorées/erreurs)`);

  // Vérification intégrité
  if (!dryRun) {
    const integrity = prodDb.pragma('integrity_check');
    const ok = integrity[0]?.integrity_check === 'ok';
    log(`  🔍 Intégrité PROD : ${ok ? '✅ OK' : '❌ PROBLÈME DÉTECTÉ'}`);
    if (!ok) {
      log('  ❌ INTÉGRITÉ COMPROMISE — RESTAURER LE BACKUP IMMÉDIATEMENT');
      log('  → pm2 stop vehicules-backend');
      log('  → cp backups/prod-*.db apps/api/vehicules.db');
      log('  → pm2 start vehicules-backend');
    }
    const fkCheck = prodDb.pragma('foreign_key_check');
    if (fkCheck.length === 0) {
      log('  🔍 Foreign keys PROD : ✅ OK');
    } else {
      log(`  ⚠️  Foreign keys PROD : ${fkCheck.length} violation(s)`);
      for (const fk of fkCheck.slice(0, 5)) {
        log(`     → table=${fk.table} rowid=${fk.rowid} ref=${fk.parent} fkid=${fk.fkid}`);
      }
    }
  }

  devRead.close();
  prodDb.close();

  return { totalInserted, tablesModified, skippedTables };
}

// ─── Main ───────────────────────────────────────────────

const sep = '═'.repeat(55);

log(sep);
log('  🔄 SYNCHRONISATION BIDIRECTIONNELLE DEV ↔ PROD');
log(`  📅 ${new Date().toLocaleString('fr-FR')}`);
log(`  Mode : ${DRY_RUN ? '🏷️  DRY-RUN (aucune modification)' : '⚡ EXÉCUTION RÉELLE'}`);
log(`  Phase : ${PHASE || 'dry-run seulement'}`);
log(sep);

// Vérifier que les backups existent
if (!DRY_RUN) {
  const backupDir = join(__dirname, '..', 'backups');
  if (!existsSync(backupDir)) {
    log('❌ Aucun dossier backups/ trouvé. Exécutez d\'abord :');
    log('   bash scripts/backup-databases.sh');
    process.exit(1);
  }
  const { readdirSync } = await import('fs');
  const backups = readdirSync(backupDir).filter(f => f.endsWith('.db'));
  if (backups.length === 0) {
    log('❌ Aucun backup .db trouvé. Exécutez d\'abord :');
    log('   bash scripts/backup-databases.sh');
    process.exit(1);
  }
  const latest = backups.sort().pop();
  log(`  💾 Dernier backup : ${latest}`);
}

let phase1Result = null;
let phase2Result = null;

try {
  if (DRY_RUN || PHASE === 'prod-to-dev' || PHASE === 'all') {
    phase1Result = syncProdToDev(DRY_RUN);
  }

  if (DRY_RUN || PHASE === 'dev-to-prod' || PHASE === 'all') {
    phase2Result = syncDevToProd(DRY_RUN);
  }

  // Résumé final
  log('');
  log(sep);
  log('  📋 RÉSUMÉ FINAL');
  log(sep);

  if (phase1Result) {
    log(`  PROD→DEV : ${phase1Result.totalInserted} lignes, ${phase1Result.tablesModified} tables`);
  }
  if (phase2Result) {
    log(`  DEV→PROD : ${phase2Result.totalInserted} lignes, ${phase2Result.tablesModified} tables`);
    if (phase2Result.skippedTables?.length > 0) {
      log(`  Exclues  : ${phase2Result.skippedTables.join(', ')}`);
    }
  }

  if (DRY_RUN) {
    log('');
    log('  🏷️  MODE DRY-RUN — Aucune donnée n\'a été modifiée.');
    log('  Pour exécuter réellement :');
    log('  1. bash scripts/backup-databases.sh');
    log('  2. node scripts/sync-dev-prod.js --phase prod-to-dev');
    log('  3. Vérifier l\'intégrité, valider');
    log('  4. node scripts/sync-dev-prod.js --phase dev-to-prod');
  }

  log(sep);

  // Sauver le journal
  if (!DRY_RUN) {
    saveLog();
  }

} catch (err) {
  log(`\n❌ ERREUR FATALE : ${err.message}`);
  log('   Si des modifications ont été faites, la transaction a été annulée (ROLLBACK automatique).');
  log('   En cas de doute, restaurez les backups :');
  log('   → Voir docs/04-Operations/ROLLBACK_PLAN.md');
  console.error(err.stack);
  process.exit(1);
}
