// apps/api/services/locations/depots.js
//
// Ticket : T-P0-12 (Localisation v2 - API + services).
//
// Service `listDepots({ db })` — retourne la liste des depots depuis
// depot_svg_maps avec parsing JSON safe des sections floors /
// categories / zones.
//
// Service `getDepotById({ db, depotId })` — retourne un depot complet.
// Le client (EquipmentPanel v2) utilise cette reponse pour rendre le
// plan interactif.
//
// Aucune ecriture DB.

import { LocationsV2NotFoundError, LocationsV2ValidationError } from './errors.js';

/**
 * Parse un blob JSON stocke en TEXT en tolerant les erreurs.
 * @param {string|null|undefined} raw
 * @param {*} fallback
 */
function safeJsonParse(raw, fallback) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Retourne la liste (compacte) des depots — utile pour un selecteur
 * d'ecran ou un menu deroulant. Chaque depot expose ses metadonnees
 * mais **pas** le contenu des zones (utiliser `getDepotById` pour
 * le detail).
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @returns {{
 *   depots: Array<{
 *     depot_id: string,
 *     name: string,
 *     version: string,
 *     svg_width: number|null,
 *     svg_height: number|null,
 *     floors_count: number,
 *     categories_count: number,
 *     zones_count: number,
 *     imported_at: string|null,
 *     updated_at: string|null
 *   }>,
 *   total: number
 * }}
 */
export function listDepots({ db } = {}) {
  if (!db) throw new LocationsV2ValidationError('db requis');
  const rows = db
    .prepare(
      `SELECT depot_id, name, version, svg_width, svg_height,
              floors_json, categories_json, zones_json,
              imported_at, updated_at
       FROM depot_svg_maps
       ORDER BY depot_id`,
    )
    .all();

  const depots = rows.map((row) => {
    const floors = safeJsonParse(row.floors_json, []);
    const categories = safeJsonParse(row.categories_json, []);
    const zones = safeJsonParse(row.zones_json, []);
    return {
      depot_id: row.depot_id,
      name: row.name,
      version: row.version,
      svg_width: row.svg_width ?? null,
      svg_height: row.svg_height ?? null,
      floors_count: Array.isArray(floors) ? floors.length : 0,
      categories_count: Array.isArray(categories) ? categories.length : 0,
      zones_count: Array.isArray(zones) ? zones.length : 0,
      imported_at: row.imported_at ?? null,
      updated_at: row.updated_at ?? null,
    };
  });

  return { depots, total: depots.length };
}

/**
 * Retourne le contenu complet d'un depot pour le rendu client :
 * dimensions SVG + floors + categories + zones (les zones sont un
 * tableau libre defini par depot_svg_maps.zones_json, la structure
 * exacte reste opaque au serveur).
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {string} params.depotId
 * @returns {{
 *   depot: {
 *     depot_id: string,
 *     name: string,
 *     version: string,
 *     svg_width: number|null,
 *     svg_height: number|null,
 *     floors: unknown[],
 *     categories: unknown[],
 *     zones: unknown[],
 *     source_file: string|null,
 *     imported_at: string|null,
 *     updated_at: string|null
 *   }
 * }}
 * @throws {LocationsV2ValidationError} si db ou depotId manquant.
 * @throws {LocationsV2NotFoundError} si le depot n'existe pas.
 */
export function getDepotById({ db, depotId } = {}) {
  if (!db) throw new LocationsV2ValidationError('db requis');
  if (depotId === undefined || depotId === null || depotId === '') {
    throw new LocationsV2ValidationError('depotId requis');
  }
  const id = String(depotId);
  const row = db
    .prepare(
      `SELECT depot_id, name, version, svg_width, svg_height,
              floors_json, categories_json, zones_json,
              source_file, imported_at, updated_at
       FROM depot_svg_maps
       WHERE depot_id = ?`,
    )
    .get(id);
  if (!row) {
    throw new LocationsV2NotFoundError(`Depot introuvable (depot_id=${id})`, { depotId: id });
  }

  return {
    depot: {
      depot_id: row.depot_id,
      name: row.name,
      version: row.version,
      svg_width: row.svg_width ?? null,
      svg_height: row.svg_height ?? null,
      floors: safeJsonParse(row.floors_json, []),
      categories: safeJsonParse(row.categories_json, []),
      zones: safeJsonParse(row.zones_json, []),
      source_file: row.source_file ?? null,
      imported_at: row.imported_at ?? null,
      updated_at: row.updated_at ?? null,
    },
  };
}

/**
 * Verifie si une zone `zoneKey` est presente dans le referentiel du
 * depot `depotId`. Retourne `true` si connue, `false` sinon. La
 * comparaison couvre les alias id / code / name (comportement aligne
 * avec le script T-P0-11).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} depotId
 * @param {string} zoneKey
 * @returns {boolean}
 */
export function isZoneKnown(db, depotId, zoneKey) {
  if (!db || !depotId || !zoneKey) return false;
  const row = db
    .prepare('SELECT zones_json FROM depot_svg_maps WHERE depot_id = ?')
    .get(String(depotId));
  if (!row) return false;
  const zones = safeJsonParse(row.zones_json, []);
  if (!Array.isArray(zones)) return false;
  const key = String(zoneKey);
  for (const zone of zones) {
    if (!zone) continue;
    if (String(zone.id ?? '') === key) return true;
    if (String(zone.code ?? '') === key) return true;
    if (String(zone.name ?? '') === key) return true;
  }
  return false;
}
