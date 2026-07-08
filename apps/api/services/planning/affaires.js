// ─────────────────────────────────────────────────────────────
// services/planning/affaires.js
// Sous-domaine "affaires" du PlanningService v2.
//
// Ticket : T-P0-01 (cadrage) — SQUELETTE PUR, aucun accès DB.
//
// Portée métier :
//   - Cycle statut des affaires côté planning :
//       prep → charge → depart → route → montage → exploitation
//       → demontage → retour → decharge → cloture
//   - Consolidation des compteurs par affaire (réservations,
//     personnel, matériel, BL, commandes) exposés par la vue
//     future v_planning_affaires_status (T-P0-02).
//   - Toggle de visibilité (planning_hidden_affaires).
//
// Voir : docs/api/v2/planning.md
// ─────────────────────────────────────────────────────────────

import { PlanningV2NotImplementedError } from './tasks.js';

/**
 * Cycle des statuts d'une affaire côté planning (ordre significatif).
 *
 * @type {ReadonlyArray<'prep' | 'charge' | 'depart' | 'route' | 'montage' | 'exploitation' | 'demontage' | 'retour' | 'decharge' | 'cloture'>}
 */
export const AFFAIRE_CYCLE_STATUSES = Object.freeze([
  'prep',
  'charge',
  'depart',
  'route',
  'montage',
  'exploitation',
  'demontage',
  'retour',
  'decharge',
  'cloture',
]);

/**
 * Contrat cible : lister les affaires du planning (avec compteurs et
 * statut de cycle) sur une plage de dates.
 * Non implémenté au stade T-P0-01.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function listPlanningAffaires(_params) {
  throw new PlanningV2NotImplementedError('listPlanningAffaires');
}

/**
 * Contrat cible : faire progresser le statut de cycle d'une affaire.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function cycleAffaireStatus(_params) {
  throw new PlanningV2NotImplementedError('cycleAffaireStatus');
}

/**
 * Contrat cible : masquer / réafficher une affaire côté planning
 * (sans altérer l'affaire elle-même).
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function toggleAffaireVisibility(_params) {
  throw new PlanningV2NotImplementedError('toggleAffaireVisibility');
}
