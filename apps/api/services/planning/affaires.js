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

import { PlanningV2NotImplementedError, PlanningV2ValidationError } from './tasks.js';

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
 * Bornes de pagination v2 pour les affaires planning.
 * Volumétrie faible (<1000) : offset-based simple sans cursor pour
 * l'instant.
 */
export const PLANNING_AFFAIRES_LIMIT_DEFAULT = 200;
export const PLANNING_AFFAIRES_LIMIT_MAX = 1000;

function isIsoDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function clampLimit(raw) {
  if (raw === undefined || raw === null || raw === '') return PLANNING_AFFAIRES_LIMIT_DEFAULT;
  const num = Number.parseInt(raw, 10);
  if (!Number.isFinite(num) || num < 1) return PLANNING_AFFAIRES_LIMIT_DEFAULT;
  if (num > PLANNING_AFFAIRES_LIMIT_MAX) return PLANNING_AFFAIRES_LIMIT_MAX;
  return num;
}

/**
 * Liste les affaires côté planning avec leur statut cycle
 * (`planning_affaire_status`) et l'indicateur de visibilité
 * (`planning_hidden_affaires`). Optionnellement filtré par plage de
 * dates (chevauchement `date_debut`/`date_fin`).
 *
 * Note : les compteurs consolidés (réservations, personnel, matériel,
 * BL, commandes) ne sont pas calculés à ce stade — ils seront ajoutés
 * par un ticket ultérieur (T-P0-05 étendu bis) via la future vue
 * `v_planning_affaires_status`.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {string} [params.dateFrom] YYYY-MM-DD (chevauchement inclusif)
 * @param {string} [params.dateTo]   YYYY-MM-DD
 * @param {boolean} [params.includeHidden=false] inclure les affaires masquées
 * @param {number|string} [params.limit]
 * @param {number|string} [params.offset]
 * @returns {{ items: Array<Record<string, unknown>>, total: number, limit: number, offset: number }}
 */
export function listPlanningAffaires({
  db,
  dateFrom = null,
  dateTo = null,
  includeHidden = false,
  limit,
  offset = 0,
} = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new PlanningV2ValidationError('db requis (better-sqlite3)', 'db');
  }
  if (dateFrom !== null && dateFrom !== undefined && dateFrom !== '' && !isIsoDate(dateFrom)) {
    throw new PlanningV2ValidationError('dateFrom doit être au format YYYY-MM-DD', 'dateFrom');
  }
  if (dateTo !== null && dateTo !== undefined && dateTo !== '' && !isIsoDate(dateTo)) {
    throw new PlanningV2ValidationError('dateTo doit être au format YYYY-MM-DD', 'dateTo');
  }
  const effectiveLimit = clampLimit(limit);
  const effectiveOffset = Math.max(0, Number.parseInt(offset, 10) || 0);

  const wheres = ['1=1'];
  const bindings = [];

  if (dateFrom) {
    // affaire dont date_fin >= dateFrom (ou date_fin NULL pour englobant)
    wheres.push('(a.date_fin IS NULL OR a.date_fin >= ?)');
    bindings.push(dateFrom);
  }
  if (dateTo) {
    wheres.push('(a.date_debut IS NULL OR a.date_debut <= ?)');
    bindings.push(dateTo);
  }
  if (!includeHidden) {
    wheres.push('h.numero_affaire IS NULL');
  }

  const whereSql = `WHERE ${wheres.join(' AND ')}`;

  const totalRow = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM affaires a
       LEFT JOIN planning_hidden_affaires h ON h.numero_affaire = a.numero_affaire
       ${whereSql}`,
    )
    .get(...bindings);

  const items = db
    .prepare(
      `SELECT a.id, a.numero_affaire, a.type, a.client, a.nom, a.titre,
              a.date_debut, a.date_fin, a.status AS affaire_status,
              s.status AS cycle_status,
              CASE WHEN h.numero_affaire IS NULL THEN 0 ELSE 1 END AS is_hidden
       FROM affaires a
       LEFT JOIN planning_affaire_status s ON s.numero_affaire = a.numero_affaire
       LEFT JOIN planning_hidden_affaires h ON h.numero_affaire = a.numero_affaire
       ${whereSql}
       ORDER BY a.date_debut DESC, a.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...bindings, effectiveLimit, effectiveOffset);

  return {
    items,
    total: totalRow.n,
    limit: effectiveLimit,
    offset: effectiveOffset,
  };
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
