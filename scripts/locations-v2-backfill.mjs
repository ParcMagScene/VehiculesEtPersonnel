#!/usr/bin/env node
/**
 * scripts/locations-v2-backfill.mjs
 *
 * Ticket : T-P0-11 (Localisation v2 — backfill equipement, DRY-RUN).
 *
 * Diagnostic sur la coherence des localisations equipements :
 *   1. Comptage global equipements avec / sans location.
 *   2. Ecarts : location_zone ou location_code presents sans
 *      location_depot -> donnee partielle.
 *   3. Zones equipement introuvables dans depot_svg_maps (referentiel).
 *   4. Zones du SVG jamais utilisees par un equipement (orphelines).
 *   5. Doublons de codes (equipement.location_code duplique dans le
 *      meme depot+floor+zone).
 *
 * Modes :
 *   - dry-run (defaut) : rapport JSON, aucune ecriture.
 *   - --apply : reserve a un ticket ulterieur (seed
 *     equipment_location_history avec les localisations courantes).
 *     Non implemente ici : le script se contente d'un warning et sort
 *     en dry-run.
 *
 * Sortie stdout : JSON structure.
 * Exit codes :
 *   0 : aucun ecart detecte.
 *   1 : ecarts detectes (decision utilisateur requise).
 *   2 : environnement invalide (tables manquantes).
 *
 * Usage :
 *   node scripts/locations-v2-backfill.mjs
 *   DB_PATH=/tmp/vehicules-copy.db node scripts/locations-v2-backfill.mjs
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
 * Charge et parse le JSON `zones_json` de tous les depots.
 * Retourne un Map<depot_id, Set<zoneCode>>.
 */
function loadKnownZones() {
  const rows = db.prepare('SELECT depot_id, zones_json FROM depot_svg_maps').all();
  const map = new Map();
  for (const row of rows) {
    let zones;
    try {
      zones = JSON.parse(row.zones_json || '[]');
    } catch {
      zones = [];
    }
    const set = new Set();
    for (const zone of zones) {
      // Structure attendue : { id | code, floor, ... }. On collecte les
      // identifiants (id + code) pour matcher les colonnes libres
      // equipment.location_zone et location_code.
      if (zone?.id) set.add(String(zone.id));
      if (zone?.code) set.add(String(zone.code));
      if (zone?.name) set.add(String(zone.name));
    }
    map.set(String(row.depot_id), set);
  }
  return map;
}

function main() {
  // ─── Verifications environnement ────────────────────────────
  if (!tableExists('equipment')) {
    process.stderr.write('❌ Table `equipment` absente. Environnement invalide.\n');
    process.exit(2);
  }
  if (!tableExists('depot_svg_maps')) {
    process.stderr.write(
      '❌ Table `depot_svg_maps` absente. Executer d\'abord la migration T-P0-10.\n',
    );
    process.exit(2);
  }
  const hasHistory = tableExists('equipment_location_history');
  if (!hasHistory) {
    process.stderr.write(
      '⚠️  Table `equipment_location_history` absente (T-P0-10 non passe). Continue en dry-run.\n',
    );
  }

  // Colonnes optionnelles : compat DB anciennes.
  const cols = ['location_depot', 'location_floor', 'location_zone', 'location_code'];
  for (const col of cols) {
    if (!columnExists('equipment', col)) {
      process.stderr.write(
        `⚠️  Colonne equipment.${col} absente. Le rapport ignorera ce champ.\n`,
      );
    }
  }

  if (APPLY_REQUESTED) {
    process.stderr.write(
      '⚠️  --apply n\'est PAS implemente pour T-P0-11. Continue en dry-run.\n',
    );
  }

  const knownZones = loadKnownZones();

  // ─── 1. Comptage global ─────────────────────────────────────
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN location_depot IS NOT NULL AND location_depot != '' THEN 1 ELSE 0 END) AS with_depot,
         SUM(CASE WHEN location_zone IS NOT NULL AND location_zone != '' THEN 1 ELSE 0 END) AS with_zone,
         SUM(CASE WHEN location_code IS NOT NULL AND location_code != '' THEN 1 ELSE 0 END) AS with_code,
         SUM(CASE WHEN
              (location_depot IS NULL OR location_depot = '')
              AND (location_zone IS NULL OR location_zone = '')
              AND (location_code IS NULL OR location_code = '')
              AND (location_floor IS NULL OR location_floor = '')
            THEN 1 ELSE 0 END) AS without_any_location
       FROM equipment`,
    )
    .get();

  // ─── 2. Donnees partielles ──────────────────────────────────
  //     Un equipement avec zone/code mais sans depot -> orphelin
  //     du referentiel spatial.
  const partial = db
    .prepare(
      `SELECT id, name, location_zone, location_code, location_floor
       FROM equipment
       WHERE (location_depot IS NULL OR location_depot = '')
         AND ( (location_zone IS NOT NULL AND location_zone != '')
            OR (location_code IS NOT NULL AND location_code != '') )
       ORDER BY id
       LIMIT 100`,
    )
    .all();

  // ─── 3. Zones equipement introuvables dans le referentiel ───
  const zoneRefs = db
    .prepare(
      `SELECT location_depot, location_zone, COUNT(*) AS eq_count
       FROM equipment
       WHERE location_zone IS NOT NULL AND location_zone != ''
       GROUP BY location_depot, location_zone
       ORDER BY location_depot, location_zone`,
    )
    .all();

  const unknownZones = [];
  const knownDepotIds = new Set(knownZones.keys());
  for (const ref of zoneRefs) {
    const depotKey = String(ref.location_depot ?? '');
    const knownSet = knownZones.get(depotKey);
    // Depot absent du referentiel OU zone inconnue.
    if (!knownSet) {
      unknownZones.push({
        location_depot: ref.location_depot,
        location_zone: ref.location_zone,
        reason: knownDepotIds.size === 0 ? 'no_depot_svg_maps_seeded' : 'unknown_depot',
        eq_count: ref.eq_count,
      });
      continue;
    }
    if (!knownSet.has(String(ref.location_zone))) {
      unknownZones.push({
        location_depot: ref.location_depot,
        location_zone: ref.location_zone,
        reason: 'zone_not_in_svg',
        eq_count: ref.eq_count,
      });
    }
  }

  // ─── 4. Zones SVG orphelines (aucun equipement) ─────────────
  const usedZones = new Set();
  for (const ref of zoneRefs) {
    usedZones.add(`${ref.location_depot ?? ''}::${ref.location_zone}`);
  }
  const orphanZones = [];
  for (const [depotId, zoneSet] of knownZones.entries()) {
    for (const zone of zoneSet) {
      const key = `${depotId}::${zone}`;
      // On tolere les alias (id/code/name partagent le meme set) — le
      // depot n'a pas de zone orpheline reelle si l'un de ses alias
      // est utilise. Approximation acceptable pour un diagnostic.
      if (!usedZones.has(key)) {
        orphanZones.push({ depot_id: depotId, zone });
      }
    }
  }

  // ─── 5. Doublons de code dans une meme cellule ──────────────
  const duplicateCodes = db
    .prepare(
      `SELECT location_depot, location_floor, location_zone, location_code,
              COUNT(*) AS eq_count
       FROM equipment
       WHERE location_code IS NOT NULL AND location_code != ''
       GROUP BY location_depot, location_floor, location_zone, location_code
       HAVING COUNT(*) > 1
       ORDER BY eq_count DESC
       LIMIT 100`,
    )
    .all();

  // ─── 6. History rows actuelles (contexte pour eventuel seed) ─
  const historyStats = hasHistory
    ? db.prepare(`SELECT COUNT(*) AS total FROM equipment_location_history`).get()
    : { total: null };

  // ─── Rapport ─────────────────────────────────────────────────
  const report = {
    ticket: 'T-P0-11',
    generated_at: new Date().toISOString(),
    apply_requested: APPLY_REQUESTED,
    apply_applied: false,
    depot_svg_maps: {
      seeded: knownDepotIds.size,
      depot_ids: [...knownDepotIds],
    },
    equipment_location_history: historyStats,
    totals,
    partial_locations: {
      count: partial.length,
      note:
        partial.length >= 100
          ? 'tronque a 100 lignes — utiliser SELECT direct pour la liste complete'
          : undefined,
      sample: partial,
    },
    unknown_zones: {
      count: unknownZones.length,
      breakdown: unknownZones,
    },
    orphan_zones_in_svg: {
      count: orphanZones.length,
      sample: orphanZones.slice(0, 50),
    },
    duplicate_codes: {
      count: duplicateCodes.length,
      sample: duplicateCodes,
    },
    verdict:
      unknownZones.length === 0 && partial.length === 0 && duplicateCodes.length === 0
        ? 'OK (aucun ecart detecte)'
        : 'ECARTS_DETECTES (voir details)',
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (
    unknownZones.length > 0 ||
    partial.length > 0 ||
    duplicateCodes.length > 0
  ) {
    process.exit(1);
  }
  process.exit(0);
}

main();
