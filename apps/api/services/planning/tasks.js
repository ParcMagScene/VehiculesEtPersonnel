// ─────────────────────────────────────────────────────────────
// services/planning/tasks.js
// Sous-domaine "tasks" du PlanningService v2.
//
// Tickets : T-P0-01 (cadrage), T-P0-03 (lecture cursor-based).
//
// Portée métier :
//   - CRUD des tâches opérationnelles réparties en 20 sections
//     (rdv, prep_locations, prep_prestations, prep_ventes,
//     prep_installations, prep_tournees, chargement, depart,
//     enlevement, retour, recuperation, installation, montage,
//     demontage, intervention, evenements, taches_prioritaires,
//     taches_secondaires, courses, manual).
//   - Batch (création, clear-completed, rollover minuit) — T-P0-04.
//   - Filtres serveur + pagination cursor-based (T-P0-03 implementé).
//
// Fonctions pures : `db` est TOUJOURS injecté en paramètre, jamais
// importé au niveau module. Cela facilite les tests avec des bases
// SQLite in-memory.
// ────────────────────────────────────────────────────────────

import { decodeCursor, encodeCursor } from '../../utils/cursor.js';

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
 * Bornes de pagination v2 pour les tâches.
 */
export const TASKS_LIMIT_DEFAULT = 100;
export const TASKS_LIMIT_MAX = 200;

/**
 * Erreur "cadre" levée par les fonctions du squelette Planning v2
 * qui ne sont pas encore implémentées.
 * Permet aux tests de vérifier que le service est bien scaffoldé
 * sans être encore câblé à une source de données.
 */
export class PlanningV2NotImplementedError extends Error {
  /**
   * @param {string} name Nom logique de la fonction non implémentée.
   */
  constructor(name) {
    super(`Planning v2: ${name} n'est pas encore implémenté (ticket T-P0-04).`);
    this.name = 'PlanningV2NotImplementedError';
    this.code = 'PLANNING_V2_NOT_IMPLEMENTED';
    this.fn = name;
  }
}

/**
 * Erreur levée lorsqu'un paramètre de filtre ou de pagination est invalide.
 */
export class PlanningV2ValidationError extends Error {
  /**
   * @param {string} message
   * @param {string} field
   */
  constructor(message, field) {
    super(message);
    this.name = 'PlanningV2ValidationError';
    this.code = 'PLANNING_V2_VALIDATION';
    this.field = field;
  }
}

/**
 * Coerce et valide `limit` dans les bornes acceptées.
 *
 * @param {unknown} raw
 * @returns {number}
 */
function clampLimit(raw) {
  if (raw === undefined || raw === null || raw === '') return TASKS_LIMIT_DEFAULT;
  const num = Number.parseInt(raw, 10);
  if (!Number.isFinite(num) || num < 1) return TASKS_LIMIT_DEFAULT;
  if (num > TASKS_LIMIT_MAX) return TASKS_LIMIT_MAX;
  return num;
}

/**
 * Coerce et valide un booléen "flexible" issu de query string.
 *
 * @param {unknown} raw
 * @returns {0 | 1 | null}
 */
function coerceBool(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return 1;
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return 0;
  return null;
}

/**
 * Vérifie qu'une date est au format `YYYY-MM-DD` (validation légère).
 *
 * @param {unknown} v
 * @returns {boolean}
 */
function isIsoDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * Lecture cursor-based des tâches (T-P0-03).
 *
 * Contrat :
 *   - Ordre : `date DESC, id DESC` (page la plus récente en premier).
 *   - Curseur opaque : encapsule `{ date, id }` du dernier item retourné.
 *     La page suivante démarre STRICTEMENT après ce couple (au sens de
 *     l'ordre décroissant), ce qui garantit l'absence de doublon et
 *     l'absence de saut même en cas de mutation concurrente.
 *   - Filtres serveur : `person_id`, `section`, `date_from`, `date_to`,
 *     `status`, `visible`, `affaire_num`. Tous facultatifs.
 *   - Limite : `limit` (défaut 100, max 200).
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {object} [params.filters={}]
 * @param {number|string} [params.filters.person_id]
 * @param {string} [params.filters.section]
 * @param {string} [params.filters.date_from] `YYYY-MM-DD` inclusif
 * @param {string} [params.filters.date_to]   `YYYY-MM-DD` inclusif
 * @param {string} [params.filters.status]
 * @param {boolean|string|number} [params.filters.visible]
 * @param {string} [params.filters.affaire_num]
 * @param {string|null} [params.cursor] curseur opaque (null pour première page)
 * @param {number|string} [params.limit]
 * @returns {{
 *   items: Array<Record<string, unknown>>,
 *   next_cursor: string|null,
 *   has_more: boolean,
 *   limit: number,
 * }}
 */
export function listTasks({ db, filters = {}, cursor = null, limit } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new PlanningV2ValidationError('db requis (better-sqlite3)', 'db');
  }

  const effectiveLimit = clampLimit(limit);
  const wheres = [];
  const bindings = [];

  // Contrat v2 : les tâches sans date sont exclues du flux cursor-based
  // (une clé keyset (date, id) ne peut pas se comparer si date est NULL).
  // Les tâches sans date restent visibles via les endpoints v1.
  wheres.push("ta.date IS NOT NULL AND ta.date <> ''");

  if (filters.person_id !== undefined && filters.person_id !== null && filters.person_id !== '') {
    const pid = Number.parseInt(filters.person_id, 10);
    if (!Number.isFinite(pid) || pid <= 0) {
      throw new PlanningV2ValidationError('person_id doit être un entier positif', 'person_id');
    }
    wheres.push('ta.person_id = ?');
    bindings.push(pid);
  }

  if (filters.section !== undefined && filters.section !== null && filters.section !== '') {
    const section = String(filters.section);
    if (!TASK_SECTIONS.includes(section)) {
      throw new PlanningV2ValidationError(
        `section invalide (valeurs autorisées : ${TASK_SECTIONS.join(', ')})`,
        'section',
      );
    }
    wheres.push('ta.section = ?');
    bindings.push(section);
  }

  if (filters.date_from !== undefined && filters.date_from !== null && filters.date_from !== '') {
    if (!isIsoDate(filters.date_from)) {
      throw new PlanningV2ValidationError('date_from doit être au format YYYY-MM-DD', 'date_from');
    }
    wheres.push('ta.date >= ?');
    bindings.push(filters.date_from);
  }

  if (filters.date_to !== undefined && filters.date_to !== null && filters.date_to !== '') {
    if (!isIsoDate(filters.date_to)) {
      throw new PlanningV2ValidationError('date_to doit être au format YYYY-MM-DD', 'date_to');
    }
    wheres.push('ta.date <= ?');
    bindings.push(filters.date_to);
  }

  if (filters.status !== undefined && filters.status !== null && filters.status !== '') {
    const status = String(filters.status);
    wheres.push('ta.status = ?');
    bindings.push(status);
  }

  const visibleCoerced = coerceBool(filters.visible);
  if (visibleCoerced !== null) {
    wheres.push('ta.visible = ?');
    bindings.push(visibleCoerced);
  }

  if (
    filters.affaire_num !== undefined &&
    filters.affaire_num !== null &&
    filters.affaire_num !== ''
  ) {
    wheres.push('ta.affaire_num = ?');
    bindings.push(String(filters.affaire_num));
  }

  // ─── Curseur keyset (date DESC, id DESC) ───
  const decoded = decodeCursor(cursor);
  if (decoded) {
    // Page suivante : STRICTEMENT après (date, id) en ordre décroissant
    // → (date < cursor.date) OR (date = cursor.date AND id < cursor.id)
    wheres.push('(ta.date < ? OR (ta.date = ? AND ta.id < ?))');
    bindings.push(decoded.date, decoded.date, decoded.id);
  }

  const whereSql = wheres.length > 0 ? `WHERE ${wheres.join(' AND ')}` : '';
  // On demande limit+1 pour détecter s'il reste des pages
  const sql = `SELECT ta.*
               FROM task_assignments ta
               ${whereSql}
               ORDER BY ta.date DESC, ta.id DESC
               LIMIT ?`;

  const rows = db.prepare(sql).all(...bindings, effectiveLimit + 1);

  const hasMore = rows.length > effectiveLimit;
  const items = hasMore ? rows.slice(0, effectiveLimit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore &&
    last &&
    last.date &&
    (last.id || last.id === 0) &&
    (typeof last.id === 'number' || typeof last.id === 'string')
      ? encodeCursor({ date: last.date, id: last.id })
      : null;

  return {
    items,
    next_cursor: nextCursor,
    has_more: hasMore,
    limit: effectiveLimit,
  };
}

/**
 * Contrat cible : lire une tâche par identifiant.
 * Non implémenté au stade T-P0-03 (voir T-P0-04).
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
