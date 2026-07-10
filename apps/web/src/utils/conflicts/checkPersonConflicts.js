// apps/web/src/utils/conflicts/checkPersonConflicts.js
//
// Ticket : T-P1-05b (Conflicts v2 — helpers UI pre-check).
//
// Helper de pre-check des conflits agenda personnel :
//   POST /api/v2/conflicts/check
//
// Aucun equivalent v1 standalone n'existe : la v1 remonte les
// conflits en POST-check via `createAssignment(...).warnings.conflicts`.
// Ce helper est donc un vrai `additive` v2 (comble un gap) : quand
// le flag est off ou le namespace v2 desactive, il retourne `null`
// pour signaler "pre-check indisponible" (le caller doit alors
// fallback sur le check POST via l'API v1).

import { adaptV2ConflictsResponse } from './v2Adapters.js';

/**
 * Detecte si une erreur remontee par le client API correspond a un
 * flag serveur eteint (404 FEATURE_DISABLED).
 * @param {unknown} err
 * @returns {boolean}
 */
export function isFeatureDisabled(err) {
  if (!err || typeof err !== 'object') return false;
  const code = err.code || err.details?.code;
  return code === 'FEATURE_DISABLED';
}

/**
 * @typedef {object} PersonConflictParams
 * @property {number} personId
 * @property {string} startDate  ISO date `YYYY-MM-DD`.
 * @property {string} endDate    ISO date `YYYY-MM-DD`.
 * @property {'AM'|'PM'} [startPeriod]
 * @property {'AM'|'PM'} [endPeriod]
 * @property {Array<{ entityType: string, entityId: string|number }>} [exclude]
 *   Entites a exclure de la detection (ex : la mission en cours
 *   d'edition). Serialise vers snake_case avant appel v2.
 */

/**
 * Verifie les conflits agenda d'une personne via le namespace v2.
 * Retourne `null` si le flag v2 est off, le namespace desactive
 * cote serveur, la methode client absente ou toute erreur reseau
 * : c'est un signal au caller que le pre-check n'a pas pu etre
 * effectue (le POST cree/updateAssignment reste la source de
 * verite).
 *
 * @param {object} api - Client API.
 * @param {PersonConflictParams} params
 * @param {{ useV2?: boolean }} [options]
 * @returns {Promise<{ conflicts: Array<object>, hasConflict: boolean, count: number } | null>}
 */
export async function checkPersonConflictsUnified(
  api,
  { personId, startDate, endDate, startPeriod, endPeriod, exclude } = {},
  { useV2 = false } = {},
) {
  if (!useV2 || typeof api?.v2CheckConflicts !== 'function') return null;
  if (!personId || !startDate || !endDate) return null;

  const body = {
    person_id: Number(personId),
    start_date: String(startDate),
    end_date: String(endDate),
  };
  if (startPeriod) body.start_period = startPeriod;
  if (endPeriod) body.end_period = endPeriod;
  if (Array.isArray(exclude) && exclude.length > 0) {
    body.exclude = exclude.map((e) => ({
      entity_type: e.entityType ?? e.entity_type,
      entity_id: e.entityId ?? e.entity_id,
    }));
  }

  try {
    const response = await api.v2CheckConflicts(body);
    return adaptV2ConflictsResponse(response);
  } catch (err) {
    if (!isFeatureDisabled(err)) {
      // eslint-disable-next-line no-console
      console.warn('[conflicts v2] checkPersonConflictsUnified: retour null', err);
    }
    return null;
  }
}
