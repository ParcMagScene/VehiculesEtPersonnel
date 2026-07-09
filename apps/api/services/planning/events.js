// ─────────────────────────────────────────────────────────────
// services/planning/events.js
// Sous-domaine "events" du PlanningService v2.
//
// Ticket : T-P0-01 (cadrage) — SQUELETTE PUR, aucun accès DB.
//
// Portée métier :
//   - CRUD des événements d'affichage dynamique (dynamic_display_events)
//     et de leur relation avec les affaires.
//   - Types : preparation, enlevement, livraison, depart, retour,
//     recuperation.
//   - Catégories : vente, location, prestation, installation.
//   - Statut opérationnel : pending, in_progress, done.
//
// Voir : docs/api/v2/planning.md
// ─────────────────────────────────────────────────────────────

import { decodeCursor, encodeCursor } from '../../utils/cursor.js';
import { PlanningV2NotImplementedError, PlanningV2ValidationError } from './tasks.js';

/**
 * Types d'événements d'affichage dynamique v2.
 *
 * @type {ReadonlyArray<'preparation' | 'enlevement' | 'livraison' | 'depart' | 'retour' | 'recuperation'>}
 */
export const EVENT_TYPES = Object.freeze([
  'preparation',
  'enlevement',
  'livraison',
  'depart',
  'retour',
  'recuperation',
]);

/**
 * Catégories métier valides pour un événement.
 *
 * @type {ReadonlyArray<'vente' | 'location' | 'prestation' | 'installation'>}
 */
export const EVENT_CATEGORIES = Object.freeze(['vente', 'location', 'prestation', 'installation']);

/**
 * Statuts opérationnels valides d'un événement.
 *
 * @type {ReadonlyArray<'pending' | 'in_progress' | 'done'>}
 */
export const EVENT_STATUSES = Object.freeze(['pending', 'in_progress', 'done']);

/**
 * Bornes de pagination v2 pour les événements.
 */
export const EVENTS_LIMIT_DEFAULT = 100;
export const EVENTS_LIMIT_MAX = 200;

function clampEventsLimit(raw) {
  if (raw === undefined || raw === null || raw === '') return EVENTS_LIMIT_DEFAULT;
  const num = Number.parseInt(raw, 10);
  if (!Number.isFinite(num) || num < 1) return EVENTS_LIMIT_DEFAULT;
  if (num > EVENTS_LIMIT_MAX) return EVENTS_LIMIT_MAX;
  return num;
}

function isIsoDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * Lecture cursor-based des événements d'affichage dynamique (T-P0-05 étendu).
 * Miroir du contrat listTasks : ordre `date DESC, id DESC`, cursor keyset,
 * filtres serveur, limite bornée.
 *
 * Filtres : `type`, `category`, `status`, `affaire_id`, `visible`,
 * `date_from`, `date_to`.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {object} [params.filters={}]
 * @param {string|null} [params.cursor]
 * @param {number|string} [params.limit]
 * @returns {{
 *   items: Array<Record<string, unknown>>,
 *   next_cursor: string|null,
 *   has_more: boolean,
 *   limit: number,
 * }}
 */
export function listEvents({ db, filters = {}, cursor = null, limit } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new PlanningV2ValidationError('db requis (better-sqlite3)', 'db');
  }

  const effectiveLimit = clampEventsLimit(limit);
  const wheres = ["dde.date IS NOT NULL AND dde.date <> ''"];
  const bindings = [];

  if (filters.type !== undefined && filters.type !== null && filters.type !== '') {
    const t = String(filters.type);
    if (!EVENT_TYPES.includes(t)) {
      throw new PlanningV2ValidationError(
        `type invalide (valeurs autorisées : ${EVENT_TYPES.join(', ')})`,
        'type',
      );
    }
    wheres.push('dde.type = ?');
    bindings.push(t);
  }

  if (filters.category !== undefined && filters.category !== null && filters.category !== '') {
    const c = String(filters.category);
    if (!EVENT_CATEGORIES.includes(c)) {
      throw new PlanningV2ValidationError(
        `category invalide (valeurs autorisées : ${EVENT_CATEGORIES.join(', ')})`,
        'category',
      );
    }
    wheres.push('dde.category = ?');
    bindings.push(c);
  }

  if (filters.status !== undefined && filters.status !== null && filters.status !== '') {
    const s = String(filters.status);
    if (!EVENT_STATUSES.includes(s)) {
      throw new PlanningV2ValidationError(
        `status invalide (valeurs autorisées : ${EVENT_STATUSES.join(', ')})`,
        'status',
      );
    }
    wheres.push('dde.status = ?');
    bindings.push(s);
  }

  if (
    filters.affaire_id !== undefined &&
    filters.affaire_id !== null &&
    filters.affaire_id !== ''
  ) {
    wheres.push('dde.affaire_id = ?');
    bindings.push(String(filters.affaire_id));
  }

  if (filters.date_from !== undefined && filters.date_from !== null && filters.date_from !== '') {
    if (!isIsoDate(filters.date_from)) {
      throw new PlanningV2ValidationError('date_from doit être au format YYYY-MM-DD', 'date_from');
    }
    wheres.push('dde.date >= ?');
    bindings.push(filters.date_from);
  }

  if (filters.date_to !== undefined && filters.date_to !== null && filters.date_to !== '') {
    if (!isIsoDate(filters.date_to)) {
      throw new PlanningV2ValidationError('date_to doit être au format YYYY-MM-DD', 'date_to');
    }
    wheres.push('dde.date <= ?');
    bindings.push(filters.date_to);
  }

  if (filters.visible !== undefined && filters.visible !== null && filters.visible !== '') {
    const raw = String(filters.visible).trim().toLowerCase();
    const isTrue = raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
    const isFalse = raw === '0' || raw === 'false' || raw === 'no' || raw === 'off';
    if (!isTrue && !isFalse) {
      throw new PlanningV2ValidationError('visible doit être un booléen', 'visible');
    }
    wheres.push('dde.visible = ?');
    bindings.push(isTrue ? 1 : 0);
  }

  const decoded = decodeCursor(cursor);
  if (decoded) {
    wheres.push('(dde.date < ? OR (dde.date = ? AND dde.id < ?))');
    bindings.push(decoded.date, decoded.date, decoded.id);
  }

  const whereSql = `WHERE ${wheres.join(' AND ')}`;
  const sql = `SELECT dde.* FROM dynamic_display_events dde
               ${whereSql}
               ORDER BY dde.date DESC, dde.id DESC
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
 * Contrat cible : créer un événement.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function createEvent(_params) {
  throw new PlanningV2NotImplementedError('createEvent');
}

/**
 * Contrat cible : mettre à jour un événement.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function updateEvent(_params) {
  throw new PlanningV2NotImplementedError('updateEvent');
}

/**
 * Contrat cible : supprimer un événement.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function deleteEvent(_params) {
  throw new PlanningV2NotImplementedError('deleteEvent');
}
