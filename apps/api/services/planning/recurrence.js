// ─────────────────────────────────────────────────────────────
// services/planning/recurrence.js
// Sous-domaine "recurrence" du PlanningService v2.
//
// Ticket : T-P0-01 (cadrage) — SQUELETTE PUR, aucun accès DB.
//
// Portée métier :
//   - Gestion des templates de tâches récurrentes.
//   - Génération programmée d'instances à partir des templates
//     (daily / weekly / monthly).
//
// Voir : docs/api/v2/planning.md
// ─────────────────────────────────────────────────────────────

import { PlanningV2NotImplementedError } from './tasks.js';

/**
 * Fréquences valides pour une récurrence.
 *
 * @type {ReadonlyArray<'daily' | 'weekly' | 'monthly'>}
 */
export const RECURRENCE_FREQUENCIES = Object.freeze(['daily', 'weekly', 'monthly']);

/**
 * Contrat cible : lister les templates de tâches récurrentes.
 * Non implémenté au stade T-P0-01.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function listRecurringTaskTemplates(_params) {
  throw new PlanningV2NotImplementedError('listRecurringTaskTemplates');
}

/**
 * Contrat cible : créer un template récurrent.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function createRecurringTaskTemplate(_params) {
  throw new PlanningV2NotImplementedError('createRecurringTaskTemplate');
}

/**
 * Contrat cible : générer les instances de tâches à partir des templates
 * pour une plage de dates donnée.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function generateRecurringTasks(_params) {
  throw new PlanningV2NotImplementedError('generateRecurringTasks');
}
