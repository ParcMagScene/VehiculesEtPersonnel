#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 *  SIMULATEUR DE SYNCHRONISATION DEV ↔ PROD  —  DRY-RUN
 * ═══════════════════════════════════════════════════════════
 *
 *  ⚠️  Ce script est 100% LECTURE SEULE.
 *      Il ne modifie AUCUNE base de données.
 *      Il ouvre les deux DB en mode readonly.
 *
 *  Usage :
 *    node scripts/simulate-sync-dev-prod.js
 *    node scripts/simulate-sync-dev-prod.js --verbose
 *    node scripts/simulate-sync-dev-prod.js --table equipment
 *    node scripts/simulate-sync-dev-prod.js --json
 *
 *  Sortie : rapport texte comparant les données DEV et PROD
 *           table par table, avec les actions qui seraient
 *           effectuées lors d'une synchronisation réelle.
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_DIR = join(__dirname, '..', 'apps', 'api');

// ─── Arguments CLI ──────────────────────────────────────
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose') || args.includes('-v');
const JSON_OUTPUT = args.includes('--json');
const TABLE_FILTER = (() => {
  const idx = args.indexOf('--table');
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
})();

// ─── Tables à ignorer (transient / cache / logs) ───────
const SKIP_TABLES = new Set([
  'sqlite_sequence',
  'active_sessions',        // sessions éphémères
  'video_access_logs',      // logs d'accès vidéo
  'video_sessions',         // sessions vidéo temporaires
  'display_logs',           // logs affichage
  'modification_history',   // historique modifs (diverge par nature)
  'display_completed_events', // événements terminés
]);

// Tables de configuration (sync par clé texte, pas par id)
const CONFIG_TABLES = new Set([
  'config',
  'display_config',
  '_migrations_log',
  'migrations_log',
]);

// ─── Connexion READONLY ─────────────────────────────────
const PROD_PATH = join(API_DIR, 'vehicules.db');
const DEV_PATH = join(API_DIR, 'vehicules-dev.db');

let prod, dev;
try {
  prod = new Database(PROD_PATH, { readonly: true, fileMustExist: true });
  dev  = new Database(DEV_PATH,  { readonly: true, fileMustExist: true });
} catch (err) {
  console.error('❌ Impossible d\'ouvrir les bases de données :', err.message);
  process.exit(1);
}

// Pas de WAL lock en lecture
prod.pragma('journal_mode = WAL');
dev.pragma('journal_mode = WAL');

// ─── Helpers ────────────────────────────────────────────

function getTables(db) {
  return db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all().map(r => r.name);
}

function getColumns(db, table) {
  return db.pragma(`table_info([${table}])`);
}

function getPrimaryKeys(db, table) {
  return db.pragma(`table_info([${table}])`)
    .filter(c => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map(c => c.name);
}

function getRowCount(db, table) {
  return db.prepare(`SELECT count(*) as c FROM [${table}]`).get().c;
}

function getAllIds(db, table, pkCols) {
  const select = pkCols.map(c => `[${c}]`).join(', ');
  return db.prepare(`SELECT ${select} FROM [${table}]`).all();
}

function makeKey(row, pkCols) {
  return pkCols.map(c => String(row[c] ?? 'NULL')).join('|||');
}

function getRowByPk(db, table, pkCols, pkValues) {
  const where = pkCols.map(c => `[${c}] = ?`).join(' AND ');
  return db.prepare(`SELECT * FROM [${table}] WHERE ${where}`).get(...pkValues);
}

// ─── Comparaison de schéma ──────────────────────────────

function compareSchema(table) {
  const prodCols = getColumns(prod, table);
  const devCols  = getColumns(dev, table);

  const prodNames = new Set(prodCols.map(c => c.name));
  const devNames  = new Set(devCols.map(c => c.name));

  const onlyInProd = prodCols.filter(c => !devNames.has(c.name));
  const onlyInDev  = devCols.filter(c => !prodNames.has(c.name));

  // Différences de type pour colonnes communes
  const typeDiffs = [];
  for (const pc of prodCols) {
    const dc = devCols.find(c => c.name === pc.name);
    if (dc && pc.type !== dc.type) {
      typeDiffs.push({ col: pc.name, prodType: pc.type, devType: dc.type });
    }
  }

  return { onlyInProd, onlyInDev, typeDiffs };
}

// ─── Comparaison de données ─────────────────────────────

function compareData(table) {
  const pkCols = getPrimaryKeys(prod, table);
  if (pkCols.length === 0) {
    return { skipped: true, reason: 'pas de clé primaire' };
  }

  const prodCount = getRowCount(prod, table);
  const devCount  = getRowCount(dev, table);

  // Optimisation : si les deux sont vides, rien à faire
  if (prodCount === 0 && devCount === 0) {
    return { prodCount: 0, devCount: 0, onlyInProd: 0, onlyInDev: 0, conflicts: 0, samples: {} };
  }

  const prodIds = getAllIds(prod, table, pkCols);
  const devIds  = getAllIds(dev, table, pkCols);

  const prodKeySet = new Map();
  for (const row of prodIds) {
    prodKeySet.set(makeKey(row, pkCols), pkCols.map(c => row[c]));
  }

  const devKeySet = new Map();
  for (const row of devIds) {
    devKeySet.set(makeKey(row, pkCols), pkCols.map(c => row[c]));
  }

  // Lignes seulement dans prod (à insérer dans dev)
  const onlyInProdKeys = [];
  for (const [key, vals] of prodKeySet) {
    if (!devKeySet.has(key)) onlyInProdKeys.push(vals);
  }

  // Lignes seulement dans dev (à insérer dans prod)
  const onlyInDevKeys = [];
  for (const [key, vals] of devKeySet) {
    if (!prodKeySet.has(key)) onlyInDevKeys.push(vals);
  }

  // Conflits : même PK mais données différentes
  let conflicts = 0;
  const conflictSamples = [];
  for (const [key, vals] of prodKeySet) {
    if (devKeySet.has(key)) {
      const prodRow = getRowByPk(prod, table, pkCols, vals);
      const devRow  = getRowByPk(dev, table, pkCols, devKeySet.get(key));
      if (prodRow && devRow) {
        const diffs = [];
        for (const col of Object.keys(prodRow)) {
          const pv = prodRow[col];
          const dv = devRow[col];
          if (String(pv ?? '') !== String(dv ?? '')) {
            diffs.push(col);
          }
        }
        if (diffs.length > 0) {
          conflicts++;
          if (conflictSamples.length < 3) {
            conflictSamples.push({
              pk: Object.fromEntries(pkCols.map((c, i) => [c, vals[i]])),
              diffCols: diffs,
              prod: Object.fromEntries(diffs.map(c => [c, prodRow[c]])),
              dev:  Object.fromEntries(diffs.map(c => [c, devRow[c]])),
            });
          }
        }
      }
    }
  }

  // Échantillons des lignes manquantes (pour le verbose)
  const samples = {};
  if (VERBOSE) {
    if (onlyInProdKeys.length > 0) {
      samples.prodSamples = onlyInProdKeys.slice(0, 5).map(vals =>
        getRowByPk(prod, table, pkCols, vals)
      );
    }
    if (onlyInDevKeys.length > 0) {
      samples.devSamples = onlyInDevKeys.slice(0, 5).map(vals =>
        getRowByPk(dev, table, pkCols, vals)
      );
    }
  }

  return {
    prodCount,
    devCount,
    onlyInProd: onlyInProdKeys.length,
    onlyInDev: onlyInDevKeys.length,
    conflicts,
    conflictSamples,
    samples,
  };
}

// ─── Exécution principale ───────────────────────────────

function run() {
  const allTables = getTables(prod);
  const devTables = new Set(getTables(dev));

  const results = [];
  const summary = {
    tablesAnalyzed: 0,
    tablesSkipped: 0,
    tablesWithDiffs: 0,
    totalInsertProdToDev: 0,  // prod → dev
    totalInsertDevToProd: 0,  // dev → prod
    totalConflicts: 0,
    schemaDiffs: 0,
  };

  for (const table of allTables) {
    if (TABLE_FILTER && table !== TABLE_FILTER) continue;
    if (SKIP_TABLES.has(table)) {
      summary.tablesSkipped++;
      continue;
    }
    if (!devTables.has(table)) {
      results.push({ table, missing: 'dev' });
      summary.schemaDiffs++;
      continue;
    }

    summary.tablesAnalyzed++;

    const schema = compareSchema(table);
    const data = compareData(table);

    if (schema.onlyInProd.length || schema.onlyInDev.length || schema.typeDiffs.length) {
      summary.schemaDiffs++;
    }

    if (!data.skipped) {
      summary.totalInsertProdToDev += data.onlyInProd;
      summary.totalInsertDevToProd += data.onlyInDev;
      summary.totalConflicts += data.conflicts;
      if (data.onlyInProd > 0 || data.onlyInDev > 0 || data.conflicts > 0) {
        summary.tablesWithDiffs++;
      }
    }

    results.push({ table, schema, data });
  }

  // Vérifier tables seulement dans dev
  for (const table of devTables) {
    if (!allTables.includes(table) && !SKIP_TABLES.has(table)) {
      results.push({ table, missing: 'prod' });
      summary.schemaDiffs++;
    }
  }

  return { results, summary };
}

// ─── Formatage du rapport ───────────────────────────────

function formatReport({ results, summary }) {
  const lines = [];
  const sep = '═'.repeat(65);
  const sep2 = '─'.repeat(65);

  lines.push('');
  lines.push(sep);
  lines.push('  🔍 SIMULATEUR DE SYNCHRONISATION DEV ↔ PROD — DRY-RUN');
  lines.push('  📅 ' + new Date().toLocaleString('fr-FR'));
  lines.push('  ⚠️  AUCUNE MODIFICATION EFFECTUÉE');
  lines.push(sep);
  lines.push('');

  // ── Résumé global ──
  lines.push('┌─────────────────────────────────────────────────────────┐');
  lines.push('│                    RÉSUMÉ GLOBAL                       │');
  lines.push('├─────────────────────────────────────────────────────────┤');
  lines.push(`│  Tables analysées      : ${String(summary.tablesAnalyzed).padStart(6)}                      │`);
  lines.push(`│  Tables ignorées       : ${String(summary.tablesSkipped).padStart(6)}                      │`);
  lines.push(`│  Tables avec diffs     : ${String(summary.tablesWithDiffs).padStart(6)}                      │`);
  lines.push(`│  Diffs de schéma       : ${String(summary.schemaDiffs).padStart(6)}                      │`);
  lines.push('├─────────────────────────────────────────────────────────┤');
  lines.push(`│  INSERT prod → dev     : ${String(summary.totalInsertProdToDev).padStart(6)} lignes               │`);
  lines.push(`│  INSERT dev → prod     : ${String(summary.totalInsertDevToProd).padStart(6)} lignes               │`);
  lines.push(`│  Conflits (même PK)    : ${String(summary.totalConflicts).padStart(6)}                      │`);
  lines.push('└─────────────────────────────────────────────────────────┘');
  lines.push('');

  // ── Détail par table ──
  lines.push(sep);
  lines.push('  DÉTAIL PAR TABLE');
  lines.push(sep);

  for (const r of results) {
    if (r.missing) {
      lines.push('');
      lines.push(`  ⚠️  TABLE [${r.table}] — manquante en ${r.missing.toUpperCase()}`);
      continue;
    }

    const { schema, data } = r;
    const hasSchemaDiff = schema.onlyInProd.length || schema.onlyInDev.length || schema.typeDiffs.length;
    const hasDataDiff = data && !data.skipped && (data.onlyInProd > 0 || data.onlyInDev > 0 || data.conflicts > 0);

    if (!hasSchemaDiff && !hasDataDiff && !VERBOSE) continue;

    lines.push('');
    lines.push(sep2);
    lines.push(`  📊 TABLE: ${r.table}`);
    if (data && !data.skipped) {
      lines.push(`     PROD: ${data.prodCount} lignes | DEV: ${data.devCount} lignes`);
    }

    // Schéma
    if (hasSchemaDiff) {
      lines.push('');
      lines.push('     🔧 DIFFÉRENCES DE SCHÉMA :');
      for (const c of schema.onlyInProd) {
        lines.push(`        ⊖ Colonne [${c.name}] (${c.type}) — seulement en PROD`);
      }
      for (const c of schema.onlyInDev) {
        lines.push(`        ⊕ Colonne [${c.name}] (${c.type}) — seulement en DEV`);
      }
      for (const d of schema.typeDiffs) {
        lines.push(`        ⚡ Colonne [${d.col}] — type PROD: ${d.prodType} vs DEV: ${d.devType}`);
      }
    }

    // Données
    if (data && !data.skipped) {
      if (data.onlyInProd > 0) {
        lines.push(`     🔵 ${data.onlyInProd} lignes seulement en PROD → seraient INSERT dans DEV`);
        if (VERBOSE && data.samples?.prodSamples) {
          for (const s of data.samples.prodSamples) {
            const preview = Object.entries(s).slice(0, 4).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
            lines.push(`        ex: { ${preview} … }`);
          }
        }
      }
      if (data.onlyInDev > 0) {
        lines.push(`     🟢 ${data.onlyInDev} lignes seulement en DEV → seraient INSERT dans PROD`);
        if (VERBOSE && data.samples?.devSamples) {
          for (const s of data.samples.devSamples) {
            const preview = Object.entries(s).slice(0, 4).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
            lines.push(`        ex: { ${preview} … }`);
          }
        }
      }
      if (data.conflicts > 0) {
        lines.push(`     🟡 ${data.conflicts} conflits (même PK, données différentes) → PROD PRIORITAIRE`);
        if (data.conflictSamples?.length > 0) {
          for (const cs of data.conflictSamples) {
            const pk = Object.entries(cs.pk).map(([k, v]) => `${k}=${v}`).join(', ');
            lines.push(`        PK(${pk}) — colonnes divergentes: ${cs.diffCols.join(', ')}`);
            if (VERBOSE) {
              for (const col of cs.diffCols.slice(0, 3)) {
                lines.push(`          ${col}: PROD=${JSON.stringify(cs.prod[col])} | DEV=${JSON.stringify(cs.dev[col])}`);
              }
            }
          }
        }
      }
    } else if (data?.skipped) {
      lines.push(`     ⏭️  Ignorée : ${data.reason}`);
    }
  }

  // ── Recommandations ──
  lines.push('');
  lines.push(sep);
  lines.push('  📋 RECOMMANDATIONS');
  lines.push(sep);
  lines.push('');

  if (summary.totalInsertProdToDev > 0) {
    lines.push(`  1. PROD → DEV : ${summary.totalInsertProdToDev} lignes à copier depuis prod vers dev`);
    lines.push('     (données de référence manquantes en dev)');
  }
  if (summary.totalInsertDevToProd > 0) {
    lines.push(`  2. DEV → PROD : ${summary.totalInsertDevToProd} lignes à copier depuis dev vers prod`);
    lines.push('     ⚠️  Vérifier chaque table avant insertion en production');
  }
  if (summary.totalConflicts > 0) {
    lines.push(`  3. CONFLITS : ${summary.totalConflicts} lignes avec même PK mais données différentes`);
    lines.push('     → La PROD est prioritaire — les valeurs DEV seront ignorées');
  }
  if (summary.schemaDiffs > 0) {
    lines.push(`  4. SCHÉMA : ${summary.schemaDiffs} différence(s) de schéma détectées`);
    lines.push('     → Résoudre avant la synchronisation des données');
  }
  if (summary.tablesWithDiffs === 0) {
    lines.push('  ✅ Aucune différence de données détectée — les bases sont synchronisées.');
  }

  lines.push('');
  lines.push(sep);
  lines.push('  FIN DU RAPPORT DRY-RUN — Aucune donnée n\'a été modifiée.');
  lines.push(sep);
  lines.push('');

  return lines.join('\n');
}

// ─── Main ───────────────────────────────────────────────

try {
  console.log('🔍 Ouverture des bases en LECTURE SEULE…');
  console.log(`   PROD : ${PROD_PATH}`);
  console.log(`   DEV  : ${DEV_PATH}`);
  console.log('');

  const result = run();

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatReport(result));
  }
} catch (err) {
  console.error('❌ Erreur lors de la simulation :', err.message);
  if (VERBOSE) console.error(err.stack);
  process.exit(1);
} finally {
  prod.close();
  dev.close();
}
