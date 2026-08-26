// migrations/locations-v2-schema-v1.js — T-P0-10
//
// Ticket : EXECUTION_PLAN_EMAG_3_0.md T-P0-10 (P0 Localisation v2).
//
// Objectifs :
//   1. Créer la table `depot_svg_maps` : stockage centralisé en DB des
//      définitions SVG des dépôts (structure floors / categories / zones)
//      qui vivent actuellement dans `public/depot-zones.json` et
//      `public/depot2-zones.json`. La DB devient la source de vérité,
//      les JSON statiques restent servis en lecture (compat descendante).
//   2. Créer la table `equipment_location_history` : historique des
//      déplacements d'équipements. `equipment.location_zone/code/floor/
//      depot` reste la localisation courante (pas de doublon).
//   3. Import initial : si `depot_svg_maps` est vide et que les fichiers
//      JSON existent dans `public/`, importer leur contenu (INSERT OR
//      IGNORE, idempotent au niveau depot_id).
//
// Coexistence totale avec le code existant. Aucune modification des
// colonnes `equipment.location_*` (utilisées par tous les endpoints
// inventaire). Les endpoints `/api/equipment-depot-zones` continuent
// de lire les JSON statiques. Un ticket ultérieur (T-P0-12) fera
// pivoter les lectures vers la DB.
//
// Voir docs/05-Specs/LOCATIONS_V2.md.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import logger from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

export function runLocationsV2SchemaMigration(db) {
  // ─── 1. Table `depot_svg_maps` ───
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS depot_svg_maps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      depot_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      version TEXT DEFAULT '1.0',
      svg_width INTEGER,
      svg_height INTEGER,
      floors_json TEXT NOT NULL DEFAULT '[]',
      categories_json TEXT NOT NULL DEFAULT '[]',
      zones_json TEXT NOT NULL DEFAULT '[]',
      source_file TEXT,
      imported_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_depot_svg_maps_depot ON depot_svg_maps(depot_id)`);
    logger.info('  ✅ Migration locations-v2: table depot_svg_maps OK');
  } catch (e) {
    logger.warn('Migration depot_svg_maps:', e.message);
  }

  // ─── 2. Table `equipment_location_history` ───
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS equipment_location_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL,
      previous_depot TEXT,
      previous_floor TEXT,
      previous_zone TEXT,
      previous_code TEXT,
      new_depot TEXT,
      new_floor TEXT,
      new_zone TEXT,
      new_code TEXT,
      moved_by INTEGER,
      moved_at DATETIME DEFAULT (datetime('now')),
      notes TEXT,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
      FOREIGN KEY (moved_by) REFERENCES users(id) ON DELETE SET NULL
    )`);
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_eqloc_hist_equipment ON equipment_location_history(equipment_id)`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_eqloc_hist_moved_at ON equipment_location_history(moved_at)`,
    );
    logger.info('  ✅ Migration locations-v2: table equipment_location_history OK');
  } catch (e) {
    logger.warn('Migration equipment_location_history:', e.message);
  }

  // ─── 3. Import initial des JSON dépôts ───
  //     Idempotent : ne réimporte pas si depot_id déjà présent.
  try {
    importDepotJsonIfMissing(db, path.join(PROJECT_ROOT, 'public/depot-zones.json'), '1');
    importDepotJsonIfMissing(db, path.join(PROJECT_ROOT, 'public/depot2-zones.json'), '2');
  } catch (e) {
    logger.warn('Import initial depot JSON:', e.message);
  }
}

/**
 * Insère un dépôt depuis un JSON si `depot_id` n'existe pas encore.
 * Le fichier peut être absent (dev fraîche) — dans ce cas on skip.
 * @param {import('better-sqlite3').Database} db
 * @param {string} filePath   Chemin absolu du JSON.
 * @param {string} depotId    Identifiant `depot_id` de la ligne (fallback si
 *                            le JSON n'en contient pas).
 */
function importDepotJsonIfMissing(db, filePath, depotId) {
  if (!fs.existsSync(filePath)) {
    logger.info(`  ℹ️  Migration locations-v2: ${path.basename(filePath)} absent, import skippé`);
    return;
  }

  const existing = db.prepare('SELECT 1 FROM depot_svg_maps WHERE depot_id = ?').get(depotId);
  if (existing) return;

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (parseErr) {
    logger.warn(
      `  ⚠️  ${path.basename(filePath)}: JSON invalide, import skippé (${parseErr.message})`,
    );
    return;
  }

  const resolvedDepotId = String(payload.depotId ?? depotId);
  const name = String(payload.name ?? `Dépôt ${resolvedDepotId}`);
  const version = String(payload.version ?? '1.0');
  const svgWidth = Number.isFinite(payload.svgWidth) ? payload.svgWidth : null;
  const svgHeight = Number.isFinite(payload.svgHeight) ? payload.svgHeight : null;
  const floorsJson = JSON.stringify(payload.floors ?? []);
  const categoriesJson = JSON.stringify(payload.categories ?? []);
  const zonesJson = JSON.stringify(payload.zones ?? []);

  db.prepare(
    `INSERT INTO depot_svg_maps (
      depot_id, name, version, svg_width, svg_height,
      floors_json, categories_json, zones_json, source_file
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    resolvedDepotId,
    name,
    version,
    svgWidth,
    svgHeight,
    floorsJson,
    categoriesJson,
    zonesJson,
    path.basename(filePath),
  );

  logger.info(
    `  ✅ Migration locations-v2: depot_id=${resolvedDepotId} importé depuis ${path.basename(filePath)}`,
  );
}
