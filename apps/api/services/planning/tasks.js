// ─────────────────────────────────────────────────────────────
// services/planning/tasks.js
// Sous-domaine "tasks" du PlanningService v2.
//
// Ticket : T-P0-01 (cadrage) — SQUELETTE PUR, aucun accès DB.
//
// Portée métier :
//   - CRUD des tâches opérationnelles réparties en 15 sections
//     (rdv, prep_locations, prep_prestations, prep_ventes,
//     prep_installations, chargement, depart, enlevement, retour,
//     recuperation, installation, evenements, taches_prioritaires,
//     taches_secondaires, courses, manual).
//   - Batch (création, clear-completed, rollover minuit).
//   - Filtres serveur, pagination cursor-based (T-P1-01).
//
// Toutes les fonctions ci-dessous sont des points d'ancrage
// documentaires ; leur implémentation réelle est réservée au
// ticket T-P0-03 (lecture) puis T-P0-04 (mutations).
// ─────────────────────────────────────────────────────────────

/**
 * Sections valides pour une tâche v2. Aligné sur le CHECK réel côté v1
 * (incluant `montage`, `demontage`, `intervention`) et sur les sections
 * observées dans `task_assignments` (`prep_tournees` legacy).
 * Cette constante devient la source de vérité côté v2 et pilote la
 * future table `task_sections_ref` créée par T-P0-02.
 *
 * @type {ReadonlyArray<string>}
 */
export const TASK_SECTIONS = Object.freeze([
  'rdv',
  'prep_locations',
  'prep_prestations',
  'prep_ventes',
  'prep_installations',
  'prep_tournees',
  'chargement',
  'depart',
  'enlevement',
  'retour',
  'recuperation',
  'installation',
  'montage',
  'demontage',
  'intervention',
  'evenements',
  'taches_prioritaires',
  'taches_secondaires',
  'courses',
  'manual',
]);

/**
 * Statuts valides d'une tâche v2.
 *
 * @type {ReadonlyArray<'pending' | 'in_progress' | 'done' | 'cancelled'>}
 */
export const TASK_STATUSES = Object.freeze(['pending', 'in_progress', 'done', 'cancelled']);

/**
 * Erreur "cadre" levée par les fonctions du squelette Planning v2.
 * Permet aux tests de vérifier que le service est bien scaffoldé
 * sans être encore câblé à une source de données.
 */
export class PlanningV2NotImplementedError extends Error {
  /**
   * @param {string} name Nom logique de la fonction non implémentée.
   */
  constructor(name) {
    super(`Planning v2: ${name} n'est pas encore implémenté (ticket T-P0-03/T-P0-04).`);
    this.name = 'PlanningV2NotImplementedError';
    this.code = 'PLANNING_V2_NOT_IMPLEMENTED';
    this.fn = name;
  }
}

/**
 * Contrat cible : lister les tâches avec filtres et pagination cursor-based.
 * Non implémenté au stade T-P0-01 (voir T-P0-03).
 *
 * @param {object} _params Paramètres opaques au stade cadre.
 * @returns {Promise<never>} Rejette systématiquement (cadre).
 */
export async function listTasks(_params) {
  throw new PlanningV2NotImplementedError('listTasks');
}

/**
 * Contrat cible : lire une tâche par identifiant.
 * Non implémenté au stade T-P0-01.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function getTaskById(_params) {
  throw new PlanningV2NotImplementedError('getTaskById');
}

/**
 * Contrat cible : créer une tâche (mutation).
 * Non implémenté au stade T-P0-01 (voir T-P0-04).
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function createTask(_params) {
  throw new PlanningV2NotImplementedError('createTask');
}

/**
 * Contrat cible : mettre à jour une tâche (mutation).
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function updateTask(_params) {
  throw new PlanningV2NotImplementedError('updateTask');
}

/**
 * Contrat cible : supprimer une tâche (mutation).
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function deleteTask(_params) {
  throw new PlanningV2NotImplementedError('deleteTask');
}

/**
 * Contrat cible : créer un lot de tâches (batch mutation).
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function createTasksBatch(_params) {
  throw new PlanningV2NotImplementedError('createTasksBatch');
}

/**
 * Contrat cible : archiver / nettoyer les tâches terminées.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function clearCompletedTasks(_params) {
  throw new PlanningV2NotImplementedError('clearCompletedTasks');
}

/**
 * Contrat cible : rollover minuit des tâches incomplètes.
 * S'appuiera sur les helpers purs de `planningRolloverHelpers.js`.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function rolloverIncompleteTasks(_params) {
  throw new PlanningV2NotImplementedError('rolloverIncompleteTasks');
}
