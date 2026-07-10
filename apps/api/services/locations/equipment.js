// apps/api/services/locations/equipment.js
//
// Ticket : T-P0-12 (Localisation v2 - API + services).
//
// Service `updateEquipmentLocation({ db, equipmentId, patch, movedBy })` :
// - Charge la localisation actuelle depuis `equipment.location_*`.
// - Valide la nouvelle localisation (zone connue dans depot_svg_maps
//   si `strict=true` en options, sinon warning stocke dans notes).
// - UPDATE `equipment.location_*` avec les nouvelles valeurs.
// - INSERT dans `equipment_location_history` avec previous_* / new_*.
//
// L'operation est transactionnelle (UPDATE + INSERT dans la meme
// transaction better-sqlite3).

import { isZoneKnown } from './depots.js';
import {
  LocationsV2ConflictError,
  LocationsV2NotFoundError,
  LocationsV2ValidationError,
} from './errors.js';

/**
 * Champs de localisation reconnus. Tout autre champ dans `patch` est
 * ignore.
 * @type {ReadonlyArray<string>}
 */
export const LOCATION_FIELDS = Object.freeze([
  'location_depot',
  'location_floor',
  'location_zone',
  'location_code',
]);

/**
 * Normalise une valeur de champ location : trim + null si vide.
 * @param {*} val
 * @returns {string|null}
 */
function normalizeField(val) {
  if (val === null || val === undefined) return null;
  const trimmed = String(val).trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Met a jour la localisation d'un equipement et enregistre un audit
 * trail dans `equipment_location_history`. Transactionnel.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number|string} params.equipmentId
 * @param {object} params.patch  Sous-ensemble de LOCATION_FIELDS.
 * @param {number|null} [params.movedBy]  User id (audit trail).
 * @param {string|null} [params.notes]    Note libre (audit trail).
 * @param {object} [params.options]
 * @param {boolean} [params.options.strict=false]  Refuse si la zone
 *   cible n'est pas dans le referentiel du depot (409 CONFLICT).
 * @returns {{
 *   equipment_id: number,
 *   previous: Record<string, string|null>,
 *   next: Record<string, string|null>,
 *   history_id: number,
 *   changed: boolean
 * }}
 * @throws {LocationsV2ValidationError|LocationsV2NotFoundError|LocationsV2ConflictError}
 */
export function updateEquipmentLocation({
  db,
  equipmentId,
  patch = {},
  movedBy = null,
  notes = null,
  options = {},
} = {}) {
  if (!db) throw new LocationsV2ValidationError('db requis');
  if (equipmentId === undefined || equipmentId === null || equipmentId === '') {
    throw new LocationsV2ValidationError('equipmentId requis');
  }
  const id = Number.parseInt(equipmentId, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new LocationsV2ValidationError('equipmentId doit etre un entier positif');
  }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new LocationsV2ValidationError('patch doit etre un objet');
  }
  const cleanPatch = {};
  for (const field of LOCATION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      cleanPatch[field] = normalizeField(patch[field]);
    }
  }
  if (Object.keys(cleanPatch).length === 0) {
    throw new LocationsV2ValidationError(
      `patch doit contenir au moins un champ parmi : ${LOCATION_FIELDS.join(', ')}`,
    );
  }

  // Charge l'etat courant.
  const current = db
    .prepare(
      `SELECT id, location_depot, location_floor, location_zone, location_code
       FROM equipment WHERE id = ?`,
    )
    .get(id);
  if (!current) {
    throw new LocationsV2NotFoundError(`Equipement introuvable (id=${id})`, { equipmentId: id });
  }

  const previous = {
    location_depot: current.location_depot ?? null,
    location_floor: current.location_floor ?? null,
    location_zone: current.location_zone ?? null,
    location_code: current.location_code ?? null,
  };
  const next = { ...previous, ...cleanPatch };

  // Validation stricte optionnelle : zone doit exister dans le SVG
  // du depot cible. Le champ location_depot est requis pour la
  // verification (sans depot, on ne peut pas resoudre le referentiel).
  const strict = options.strict === true;
  if (strict && next.location_zone && next.location_depot) {
    if (!isZoneKnown(db, next.location_depot, next.location_zone)) {
      throw new LocationsV2ConflictError(
        `Zone '${next.location_zone}' inconnue dans le referentiel du depot '${next.location_depot}'`,
        {
          depot: next.location_depot,
          zone: next.location_zone,
          hint: 'Verifier depot_svg_maps.zones_json ou desactiver strict',
        },
      );
    }
  }

  // Detection no-op : si aucun champ ne change effectivement, on
  // n'insere PAS de ligne d'historique (evite le bruit).
  const changed = LOCATION_FIELDS.some((field) => previous[field] !== next[field]);
  if (!changed) {
    return {
      equipment_id: id,
      previous,
      next,
      history_id: null,
      changed: false,
    };
  }

  // Transaction : UPDATE + INSERT.
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE equipment SET
         location_depot = ?, location_floor = ?, location_zone = ?, location_code = ?
       WHERE id = ?`,
    ).run(next.location_depot, next.location_floor, next.location_zone, next.location_code, id);
    const insertRes = db
      .prepare(
        `INSERT INTO equipment_location_history (
           equipment_id, previous_depot, previous_floor, previous_zone, previous_code,
           new_depot, new_floor, new_zone, new_code, moved_by, notes
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        previous.location_depot,
        previous.location_floor,
        previous.location_zone,
        previous.location_code,
        next.location_depot,
        next.location_floor,
        next.location_zone,
        next.location_code,
        movedBy,
        notes,
      );
    return Number(insertRes.lastInsertRowid);
  });

  const historyId = tx();
  return { equipment_id: id, previous, next, history_id: historyId, changed: true };
}
