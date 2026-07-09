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
import { addOneDayToDateStr } from '../planningRolloverHelpers.js';

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
 * Transitions autorisées du statut d'une tâche.
 * Clé = statut courant. Valeur = ensemble des statuts cibles autorisés.
 *
 * @type {Readonly<Record<string, ReadonlyArray<string>>>}
 */
export const TASK_STATUS_TRANSITIONS = Object.freeze({
  pending: Object.freeze(['in_progress', 'done', 'cancelled']),
  in_progress: Object.freeze(['pending', 'done', 'cancelled']),
  done: Object.freeze(['in_progress', 'pending']),
  cancelled: Object.freeze(['pending', 'in_progress']),
});

/**
 * Colonnes de `task_assignments` que le service v2 autorise à écrire
 * (create/update). L'`id` et les colonnes d'audit gérées côté serveur
 * (`created_at`, `modified_at`) ne figurent JAMAIS ici.
 *
 * @type {ReadonlyArray<string>}
 */
const WRITABLE_TASK_COLUMNS = Object.freeze([
  'display_event_id',
  'person_id',
  'date',
  'period',
  'time',
  'end_time',
  'section',
  'title',
  'notes',
  'source_type',
  'source_id',
  'affaire_num',
  'status',
  'visible',
]);

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
 * Lit une tâche par identifiant.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {string} params.id identifiant TEXT (UUID hex) — auto-généré à la création.
 * @returns {Record<string, unknown> | null}
 */
export function getTaskById({ db, id } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new PlanningV2ValidationError('db requis (better-sqlite3)', 'db');
  }
  if (typeof id !== 'string' || id.length === 0) {
    throw new PlanningV2ValidationError('id requis (string)', 'id');
  }
  const row = db.prepare('SELECT * FROM task_assignments WHERE id = ?').get(id);
  return row || null;
}

/**
 * Convertit `visible` (boolean/0/1) en INTEGER 0/1 attendu par SQLite.
 *
 * @param {unknown} value
 * @returns {0 | 1 | undefined}
 */
function visibleToInt(value) {
  if (value === undefined) return undefined;
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  return undefined;
}

/**
 * Prépare un payload validé pour SQLite : filtre les colonnes
 * autorisées, coerce `visible`. Ne fabrique pas de valeurs par
 * défaut — les defaults SQLite s'appliquent aux colonnes omises.
 *
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
function pickWritableTaskFields(input) {
  const out = {};
  for (const col of WRITABLE_TASK_COLUMNS) {
    if (!(col in input)) continue;
    if (col === 'visible') {
      const coerced = visibleToInt(input[col]);
      if (coerced !== undefined) out[col] = coerced;
      continue;
    }
    out[col] = input[col];
  }
  return out;
}

/**
 * Crée une tâche v2. L'`id` est auto-généré côté SQLite
 * (`lower(hex(randomblob(16)))`) et retourné dans le résultat.
 * Les colonnes omises prennent leurs defaults SQLite.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {Record<string, unknown>} params.data payload déjà validé Zod.
 * @param {number|null} [params.createdBy] user.id à écrire dans `created_by`.
 * @returns {Record<string, unknown>} la tâche complète telle que persistée.
 */
export function createTask({ db, data, createdBy = null } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new PlanningV2ValidationError('db requis (better-sqlite3)', 'db');
  }
  if (!data || typeof data !== 'object') {
    throw new PlanningV2ValidationError('data requis (object)', 'data');
  }
  if (!data.date) {
    throw new PlanningV2ValidationError('date requis à la création', 'date');
  }
  if (data.section !== undefined && !TASK_SECTIONS.includes(data.section)) {
    throw new PlanningV2ValidationError('section invalide', 'section');
  }
  if (data.status !== undefined && !TASK_STATUSES.includes(data.status)) {
    throw new PlanningV2ValidationError('status invalide', 'status');
  }

  const fields = pickWritableTaskFields(data);
  if (createdBy !== null && Number.isInteger(createdBy)) {
    fields.created_by = createdBy;
  }

  const columns = Object.keys(fields);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((c) => fields[c]);
  const sql = `INSERT INTO task_assignments (${columns.join(', ')}) VALUES (${placeholders})`;

  const insertTxn = db.transaction((row) => {
    const info = db.prepare(sql).run(...row);
    // lastInsertRowid ne fonctionne pas pour PK TEXT ; on relit via ROWID.
    return db.prepare('SELECT * FROM task_assignments WHERE ROWID = ?').get(info.lastInsertRowid);
  });

  const inserted = insertTxn(values);
  if (!inserted) {
    throw new Error('Planning v2: création tâche : row introuvable après INSERT');
  }
  return inserted;
}

/**
 * Met à jour une tâche v2. Refuse toute transition de statut non
 * déclarée dans `TASK_STATUS_TRANSITIONS`.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {string} params.id identifiant TEXT.
 * @param {Record<string, unknown>} params.data payload validé Zod (partial).
 * @param {number|null} [params.modifiedBy]
 * @returns {Record<string, unknown> | null} la tâche mise à jour, ou null si absente.
 */
export function updateTask({ db, id, data, modifiedBy = null } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new PlanningV2ValidationError('db requis (better-sqlite3)', 'db');
  }
  if (typeof id !== 'string' || id.length === 0) {
    throw new PlanningV2ValidationError('id requis (string)', 'id');
  }
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    throw new PlanningV2ValidationError('data requis (au moins un champ)', 'data');
  }

  if (data.section !== undefined && !TASK_SECTIONS.includes(data.section)) {
    throw new PlanningV2ValidationError('section invalide', 'section');
  }
  if (data.status !== undefined && !TASK_STATUSES.includes(data.status)) {
    throw new PlanningV2ValidationError('status invalide', 'status');
  }

  const existing = db.prepare('SELECT * FROM task_assignments WHERE id = ?').get(id);
  if (!existing) return null;

  if (data.status !== undefined && data.status !== existing.status) {
    const currentStatus = existing.status || 'pending';
    const allowed = TASK_STATUS_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(data.status)) {
      throw new PlanningV2ValidationError(
        `transition de statut invalide : ${currentStatus} → ${data.status}`,
        'status',
      );
    }
  }

  const fields = pickWritableTaskFields(data);
  if (Object.keys(fields).length === 0) {
    throw new PlanningV2ValidationError('aucun champ persistable après filtrage', 'data');
  }

  const setSql = Object.keys(fields)
    .map((c) => `${c} = ?`)
    .join(', ');
  const values = Object.keys(fields).map((c) => fields[c]);

  // Colonnes d'audit gérées côté serveur, hors WRITABLE_TASK_COLUMNS.
  const auditParts = ["modified_at = datetime('now')"];
  const auditValues = [];
  if (modifiedBy !== null && Number.isInteger(modifiedBy)) {
    auditParts.push('modified_by = ?');
    auditValues.push(modifiedBy);
  }

  const sql = `UPDATE task_assignments SET ${setSql}, ${auditParts.join(', ')} WHERE id = ?`;

  const updateTxn = db.transaction(() => {
    db.prepare(sql).run(...values, ...auditValues, id);
    return db.prepare('SELECT * FROM task_assignments WHERE id = ?').get(id);
  });

  return updateTxn();
}

/**
 * Supprime une tâche v2.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {string} params.id
 * @returns {boolean} true si une ligne a été supprimée.
 */
export function deleteTask({ db, id } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new PlanningV2ValidationError('db requis (better-sqlite3)', 'db');
  }
  if (typeof id !== 'string' || id.length === 0) {
    throw new PlanningV2ValidationError('id requis (string)', 'id');
  }
  const info = db.prepare('DELETE FROM task_assignments WHERE id = ?').run(id);
  return info.changes > 0;
}

/**
 * Bornes du batch de création. Aligné sur les batchs BL existants
 * (max 50) et laissé à 100 pour les tâches où la charge unitaire est
 * moindre. Passer au-delà relève d'une intégration d'import dédié.
 */
export const CREATE_TASKS_BATCH_MAX = 100;

/**
 * Crée un lot de tâches dans une seule transaction. Refuse et rollback
 * si un item invalide est rencontré (tout ou rien).
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {Array<Record<string, unknown>>} params.items payloads déjà
 *   validés (chaque item respecte le contrat de createTaskSchema).
 * @param {number|null} [params.createdBy]
 * @returns {{ created: number, ids: string[] }}
 */
export function createTasksBatch({ db, items, createdBy = null } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new PlanningV2ValidationError('db requis (better-sqlite3)', 'db');
  }
  if (!Array.isArray(items)) {
    throw new PlanningV2ValidationError('items doit être un tableau', 'items');
  }
  if (items.length === 0) {
    throw new PlanningV2ValidationError('items ne peut pas être vide', 'items');
  }
  if (items.length > CREATE_TASKS_BATCH_MAX) {
    throw new PlanningV2ValidationError(
      `items limité à ${CREATE_TASKS_BATCH_MAX} par batch`,
      'items',
    );
  }
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item || typeof item !== 'object') {
      throw new PlanningV2ValidationError(`items[${i}] invalide (object requis)`, 'items');
    }
    if (!item.date) {
      throw new PlanningV2ValidationError(`items[${i}].date requis`, 'items');
    }
    if (item.section !== undefined && !TASK_SECTIONS.includes(item.section)) {
      throw new PlanningV2ValidationError(`items[${i}].section invalide`, 'items');
    }
    if (item.status !== undefined && !TASK_STATUSES.includes(item.status)) {
      throw new PlanningV2ValidationError(`items[${i}].status invalide`, 'items');
    }
  }

  const runBatch = db.transaction((rows) => {
    const insertedIds = [];
    for (const row of rows) {
      const created = createTask({ db, data: row, createdBy });
      insertedIds.push(created.id);
    }
    return insertedIds;
  });

  const ids = runBatch(items);
  return { created: ids.length, ids };
}

/**
 * Archive (supprime) les tâches terminées. Filtres optionnels par date
 * et par section. Toujours en transaction atomique.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {string} [params.date] YYYY-MM-DD (borne exacte, optionnelle)
 * @param {string} [params.dateBefore] YYYY-MM-DD (borne haute exclusive)
 * @param {string} [params.section]
 * @returns {{ deleted: number }}
 */
export function clearCompletedTasks({ db, date, dateBefore, section } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new PlanningV2ValidationError('db requis (better-sqlite3)', 'db');
  }
  const wheres = ["status = 'done'"];
  const bindings = [];
  if (date !== undefined && date !== null && date !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      throw new PlanningV2ValidationError('date doit être au format YYYY-MM-DD', 'date');
    }
    wheres.push('date = ?');
    bindings.push(String(date));
  }
  if (dateBefore !== undefined && dateBefore !== null && dateBefore !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateBefore))) {
      throw new PlanningV2ValidationError(
        'dateBefore doit être au format YYYY-MM-DD',
        'dateBefore',
      );
    }
    wheres.push('date < ?');
    bindings.push(String(dateBefore));
  }
  if (section !== undefined && section !== null && section !== '') {
    if (!TASK_SECTIONS.includes(String(section))) {
      throw new PlanningV2ValidationError('section invalide', 'section');
    }
    wheres.push('section = ?');
    bindings.push(String(section));
  }
  const sql = `DELETE FROM task_assignments WHERE ${wheres.join(' AND ')}`;
  const runClear = db.transaction(() => db.prepare(sql).run(...bindings));
  const info = runClear();
  return { deleted: info.changes };
}

/**
 * Rollover : déplace les tâches non-terminées d'une date source vers
 * une date cible. Réutilise `addOneDayToDateStr` pour le calcul par
 * défaut (jour suivant). Toujours en transaction atomique.
 * Toutes les tâches déplacées voient leur `modified_at` mis à jour.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {string} params.fromDate YYYY-MM-DD (source).
 * @param {string} [params.toDate] YYYY-MM-DD (destination). Défaut = J+1.
 * @param {number|null} [params.modifiedBy]
 * @param {ReadonlyArray<string>} [params.eligibleStatuses] statuts éligibles
 *   au rollover (défaut : `['pending', 'in_progress']`).
 * @returns {{ moved: number, from: string, to: string }}
 */
export function rolloverIncompleteTasks({
  db,
  fromDate,
  toDate,
  modifiedBy = null,
  eligibleStatuses = ['pending', 'in_progress'],
} = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new PlanningV2ValidationError('db requis (better-sqlite3)', 'db');
  }
  if (typeof fromDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    throw new PlanningV2ValidationError('fromDate requis (YYYY-MM-DD)', 'fromDate');
  }
  let target = toDate;
  if (target === undefined || target === null || target === '') {
    target = addOneDayToDateStr(fromDate);
  } else if (typeof target !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(target)) {
    throw new PlanningV2ValidationError('toDate doit être au format YYYY-MM-DD', 'toDate');
  }
  if (!Array.isArray(eligibleStatuses) || eligibleStatuses.length === 0) {
    throw new PlanningV2ValidationError(
      'eligibleStatuses doit être un tableau non vide',
      'eligibleStatuses',
    );
  }
  for (const s of eligibleStatuses) {
    if (!TASK_STATUSES.includes(s)) {
      throw new PlanningV2ValidationError(`status éligible invalide: ${s}`, 'eligibleStatuses');
    }
  }

  const placeholders = eligibleStatuses.map(() => '?').join(', ');
  const setParts = ['date = ?', "modified_at = datetime('now')"];
  const bindings = [target];
  if (modifiedBy !== null && Number.isInteger(modifiedBy)) {
    setParts.push('modified_by = ?');
    bindings.push(modifiedBy);
  }
  const sql = `UPDATE task_assignments SET ${setParts.join(', ')} WHERE date = ? AND status IN (${placeholders})`;
  const runRollover = db.transaction(() =>
    db.prepare(sql).run(...bindings, fromDate, ...eligibleStatuses),
  );
  const info = runRollover();
  return { moved: info.changes, from: fromDate, to: target };
}
