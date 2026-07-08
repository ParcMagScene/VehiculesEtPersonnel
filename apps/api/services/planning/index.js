// ─────────────────────────────────────────────────────────────
// services/planning/index.js
// Point d'agrégation des sous-domaines Planning v2.
//
// Ticket : T-P0-01 (cadrage & séparation des sous-domaines)
// Statut : SQUELETTE — aucune route n'est câblée ici. Ce module
// n'a AUCUN effet de bord (pas de DB, pas de log, pas d'IO).
// Il documente l'API cible v2 et prépare l'extraction progressive
// depuis apps/api/planningRoutes.js.
//
// Le câblage effectif des sous-services est réservé aux tickets :
//   - T-P0-02 (DB v2)
//   - T-P0-03 (API v2 lecture)
//   - T-P0-04 (API v2 mutations)
//
// Voir : docs/api/v2/planning.md et docs/05-Specs/PLANNING_V2.md
// ─────────────────────────────────────────────────────────────

import * as affaires from './affaires.js';
import * as events from './events.js';
import * as ical from './ical.js';
import * as imports from './imports.js';
import * as recurrence from './recurrence.js';
import * as tasks from './tasks.js';

/**
 * Namespaces exposés par le futur PlanningService v2.
 * Chaque namespace regroupe des opérations pures (fonctions),
 * consommées à terme par les routes /api/v2/planning/*.
 *
 * @typedef {object} PlanningV2Namespaces
 * @property {typeof tasks} tasks
 * @property {typeof events} events
 * @property {typeof affaires} affaires
 * @property {typeof imports} imports
 * @property {typeof recurrence} recurrence
 * @property {typeof ical} ical
 */

/**
 * Liste ordonnée et gelée des noms de sous-domaines Planning v2.
 * Sert de source de vérité aux tests de non-régression et à la
 * documentation générée.
 *
 * @type {ReadonlyArray<'tasks' | 'events' | 'affaires' | 'imports' | 'recurrence' | 'ical'>}
 */
export const PLANNING_V2_NAMESPACES = Object.freeze([
  'tasks',
  'events',
  'affaires',
  'imports',
  'recurrence',
  'ical',
]);

/**
 * Assemble le PlanningService v2 sous forme d'objet {namespace → module}.
 * N'effectue aucun câblage runtime. Utilisable à des fins de
 * documentation, de tests d'existence d'API et d'introspection.
 *
 * @returns {PlanningV2Namespaces}
 */
export function getPlanningV2Namespaces() {
  return { tasks, events, affaires, imports, recurrence, ical };
}
