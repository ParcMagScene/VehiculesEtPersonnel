// apps/web/src/utils/locations/v2Adapters.js
//
// Ticket : T-P0-12b (Locations v2 — UI EquipmentPanel).
//
// Adaptateurs shape v2 -> shape v1 pour permettre a `useEquipment`
// et `DepotMap` de consommer indifferemment le namespace v1
// (`/api/equipment-depot-zones`, `/api/equipment-all-depot-zones`)
// ou le namespace v2 (`/api/v2/locations/depots/:id`,
// `/api/v2/locations/depots`).
//
// Rappel des differences de nommage :
//   v1 (JSON legacy depot-zones.json) :
//     { version, name, depotId, svgWidth, svgHeight, floors,
//       categories, zones }
//   v2 (service getDepotById) :
//     { depot_id, name, version, svg_width, svg_height, floors,
//       categories, zones, source_file, imported_at, updated_at }
//
// Le contenu interne des zones est identique : le service v2 se
// contente de parser le blob JSON stocke dans
// `depot_svg_maps.zones_json` qui est le contenu du JSON legacy.

/**
 * Convertit un depot v2 (objet retourne par `v2GetDepot`) au shape
 * v1 consomme par le frontend.
 *
 * @param {object|null|undefined} depotV2
 * @returns {object|null}
 */
export function adaptDepotV2ToV1(depotV2) {
  if (!depotV2 || typeof depotV2 !== 'object') return null;
  return {
    version: depotV2.version ?? '2.0',
    name: depotV2.name ?? '',
    depotId: depotV2.depot_id ?? null,
    svgWidth: depotV2.svg_width ?? null,
    svgHeight: depotV2.svg_height ?? null,
    floors: Array.isArray(depotV2.floors) ? depotV2.floors : [],
    categories: Array.isArray(depotV2.categories) ? depotV2.categories : [],
    zones: Array.isArray(depotV2.zones) ? depotV2.zones : [],
  };
}

/**
 * Convertit une liste (compacte) de depots v2 au shape utilise par
 * `api.getAllDepotZones()` v1 : `{ depots: [{ id, ...detail }] }`.
 *
 * IMPORTANT : la reponse `v2ListDepots` ne contient PAS les zones
 * (seulement les compteurs). Cette fonction est utilisee pour la
 * partie meta uniquement. Pour rendre les plans, il faut charger
 * chaque depot avec `v2GetDepot` puis passer chaque detail
 * `adaptDepotV2ToV1` (cf `fetchAllDepotZonesUnified`).
 *
 * @param {{ depots?: Array<object> } | null | undefined} listV2
 * @returns {{ depots: Array<{ id: string|null, name: string, depotId: string|null, version: string }> }}
 */
export function adaptDepotsListV2ToV1(listV2) {
  const depots = Array.isArray(listV2?.depots) ? listV2.depots : [];
  return {
    depots: depots.map((d) => ({
      id: d.depot_id ?? null,
      name: d.name ?? '',
      depotId: d.depot_id ?? null,
      version: d.version ?? '2.0',
      // Pas de floors/categories/zones ici (payload compact v2).
      floors: [],
      categories: [],
      zones: [],
    })),
  };
}
