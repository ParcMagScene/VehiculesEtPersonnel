#!/usr/bin/env node
/**
 * scripts/affaires-v2-backfill.mjs
 *
 * Ticket : T-P0-07 (Affaires v2 — backfill matérialisation, DRY-RUN).
 *
 * Recense toutes les affaires "implicites" (référencées par
 * `numero_affaire` dans reservations/missions/orders/bl_imports mais
 * absentes de la table `affaires`) et propose un payload de
 * matérialisation minimal.
 *
 * Modes :
 *   - dry-run (défaut) : rapport JSON, aucune écriture.
 *   - --apply : réservé au ticket T-P0-08 (matérialisation stricte
 *     + FK strictes). NON IMPLÉMENTÉ ici pour rester safe. Si passé,
 *     le script se contente d'un message d'avertissement et sort en
 *     mode dry-run.
 *
 * Sortie stdout : JSON structuré.
 * Exit codes :
 *   0 : aucune affaire implicite détectée.
 *   1 : implicites détectées (décision utilisateur requise).
 *   2 : environnement invalide.
 *
 * Usage :
 *   node scripts/affaires-v2-backfill.mjs
 *   DB_PATH=/tmp/vehicules-copy.db node scripts/affaires-v2-backfill.mjs
 */

import process from 'node:process';

import db from '../apps/api/database.js';

const APPLY_REQUESTED = process.argv.includes('--apply');

function tableExists(name) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name),
  );
}

function columnExists(table, column) {
  try {
    const cols = db.pragma(`table_info(${table})`).map((c) => c.name);
    return cols.includes(column);
  } catch (_error) {
    return false;
  }
}

/**
 * Recense les affaires implicites depuis une table source. Une affaire
 * est implicite si son `numero_affaire` (référencé via `colName`) est
 * non vide et n'existe pas dans la table `affaires`.
 */
function collectImplicitFrom(table, colName) {
  if (!tableExists(table) || !columnExists(table, colName)) return [];
  const rows = db
    .prepare(
      `SELECT DISTINCT src.${colName} AS numero_affaire, COUNT(*) AS ref_count
       FROM ${table} src
       LEFT JOIN affaires a ON a.numero_affaire = src.${colName}
       WHERE src.${colName} IS NOT NULL
         AND src.${colName} <> ''
         AND a.id IS NULL
       GROUP BY src.${colName}
       ORDER BY src.${colName}`,
    )
    .all();
  return rows.map((r) => ({
    numero_affaire: r.numero_affaire,
    source: table,
    ref_count: r.ref_count,
  }));
}

/**
 * Pour un numero d'affaire donné, propose un payload minimal en
 * extrayant le premier `client_name`, date_debut = min(start_date)
 * et date_fin = max(end_date) depuis reservations si disponible.
 */
function suggestPayload(numeroAffaire) {
  const payload = {
    numero_affaire: numeroAffaire,
    type: 'Prestation',
    client: null,
    date_debut: null,
    date_fin: null,
    nom: null,
    source: null,
  };
  try {
    const row = db
      .prepare(
        `SELECT MIN(client_name) AS client,
                MIN(start_date) AS date_debut,
                MAX(end_date) AS date_fin,
                MIN(prestation_name) AS prestation
         FROM reservations WHERE affaire = ?`,
      )
      .get(numeroAffaire);
    if (row) {
      payload.client = row.client || null;
      payload.date_debut = row.date_debut || null;
      payload.date_fin = row.date_fin || null;
      payload.nom = row.prestation || null;
      payload.source = 'reservations';
    }
  } catch (_error) {
    /* ignore */
  }
  return payload;
}

function main() {
  const report = {
    ticket: 'T-P0-07',
    mode: APPLY_REQUESTED ? 'apply-requested-but-refused' : 'dry-run',
    apply_note:
      "--apply n'est pas implémenté ici. La matérialisation réelle relève de T-P0-08 " +
      '(migration transactionnelle avec FK strictes + backup). Ce script reste toujours read-only.',
    generated_at: new Date().toISOString(),
  };

  if (!tableExists('affaires')) {
    report.error = 'table affaires manquante';
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    db.close();
    process.exit(2);
  }
  if (!tableExists('reservations')) {
    report.error = 'table reservations manquante';
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    db.close();
    process.exit(2);
  }

  // Recensement multi-source
  const sources = [
    { table: 'reservations', column: 'affaire' },
    { table: 'missions', column: 'affaire' },
    { table: 'orders', column: 'affaire_id' },
    { table: 'bl_imports', column: 'affaire_id' },
    { table: 'dynamic_display_events', column: 'affaire_id' },
    { table: 'equipment_assignments', column: 'affaire_id' },
  ];

  const bySource = {};
  const allNumeros = new Map(); // numero_affaire → { sources: Set, total_refs: number }
  for (const src of sources) {
    const rows = collectImplicitFrom(src.table, src.column);
    bySource[`${src.table}.${src.column}`] = {
      count: rows.length,
      total_refs: rows.reduce((s, r) => s + r.ref_count, 0),
    };
    for (const row of rows) {
      const entry = allNumeros.get(row.numero_affaire) || {
        numero_affaire: row.numero_affaire,
        sources: new Set(),
        total_refs: 0,
      };
      entry.sources.add(src.table);
      entry.total_refs += row.ref_count;
      allNumeros.set(row.numero_affaire, entry);
    }
  }

  const implicits = Array.from(allNumeros.values())
    .map((entry) => ({
      numero_affaire: entry.numero_affaire,
      sources: Array.from(entry.sources).sort(),
      total_refs: entry.total_refs,
      suggested_payload: suggestPayload(entry.numero_affaire),
    }))
    .sort((a, b) => a.numero_affaire.localeCompare(b.numero_affaire));

  report.by_source = bySource;
  report.implicit_affaires_distinct = implicits.length;
  report.implicit_affaires = implicits;
  report.verdict =
    implicits.length === 0
      ? 'OK — aucune affaire implicite'
      : `${implicits.length} affaire(s) implicite(s) — matérialisation \u00e0 planifier (T-P0-08)`;

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  db.close();
  process.exit(implicits.length === 0 ? 0 : 1);
}

main();
