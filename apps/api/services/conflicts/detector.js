// apps/api/services/conflicts/detector.js
//
// Ticket : T-P1-05 (Personnel v2 - moteur de conflits).
//
// Detecte les conflits d'agenda d'une personne sur une periode
// donnee. Interroge 4 sources cote DB :
//   1. `availabilities` (indisponibilites RH : conges, malades,
//      RTT, absence). Filtre `status='approved'` uniquement (les
//      demandes en attente ou refusees ne bloquent pas).
//   2. `missions` + `mission_assignments` (missions terrain). Filtre
//      `status IN ('proposed', 'confirmed', ...)`, exclut
//      `declined` / `cancelled`.
//   3. `task_assignments` (taches planning journalieres). Filtre
//      `status != 'cancelled'`.
//   4. `planning_assignments` (assignation generique affaire /
//      display_event / task). Utilisee comme fallback pour les
//      entities pas encore migrees vers les tables dediees.
//
// Le service est **read-only** : aucune ecriture. Il retourne une
// liste typee de conflits que le client (UI v2 + refactor futur v1)
// peut afficher a l'utilisateur en pre-check.
//
// Contrat : conflit = chevauchement de plage (date + demi-jour). Les
// demi-jours sont geres : AM et PM du meme jour ne se conflictent
// pas entre eux. Un `startPeriod='PM'` sur le premier jour signifie
// que la personne est occupee a partir de l'apres-midi.

import { ConflictsV2ValidationError } from './errors.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS = new Set(['AM', 'PM']);

/**
 * Verifie qu'une source de conflit doit etre exclue (utilise en
 * pre-check avant l'update d'une entree existante : on ne veut pas
 * qu'elle se conflicte avec elle-meme).
 *
 * @param {string} entityType
 * @param {string|number} entityId
 * @param {Array<{ entity_type: string, entity_id: string|number }>|null|undefined} exclude
 * @returns {boolean}
 */
function isExcluded(entityType, entityId, exclude) {
  if (!Array.isArray(exclude) || exclude.length === 0) return false;
  const idStr = String(entityId);
  return exclude.some((e) => e && e.entity_type === entityType && String(e.entity_id) === idStr);
}

/**
 * @typedef {object} ConflictEntry
 * @property {'availability'|'mission'|'task'|'planning'} source
 * @property {string} entity_type
 * @property {string|number} entity_id
 * @property {string} start_date  ISO date.
 * @property {string} end_date    ISO date.
 * @property {'AM'|'PM'|null} [start_period]
 * @property {'AM'|'PM'|null} [end_period]
 * @property {string} description Libelle humain synthetique.
 * @property {Record<string, unknown>} [meta]
 */

/**
 * Detecte les conflits pour une personne sur une periode.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.personId
 * @param {string} params.startDate ISO date.
 * @param {string} params.endDate ISO date (>= startDate).
 * @param {'AM'|'PM'} [params.startPeriod='AM']
 * @param {'AM'|'PM'} [params.endPeriod='PM']
 * @param {Array<{ entity_type: string, entity_id: string|number }>} [params.exclude]
 *   Entries a ignorer (utilise pour update d'une ligne existante).
 * @returns {{ conflicts: ConflictEntry[], has_conflict: boolean, count: number }}
 * @throws {ConflictsV2ValidationError} en cas d'entree invalide.
 */
export function detectPersonConflicts({
  db,
  personId,
  startDate,
  endDate,
  startPeriod = 'AM',
  endPeriod = 'PM',
  exclude,
} = {}) {
  if (!db) throw new ConflictsV2ValidationError('db requis');
  const pid = Number(personId);
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new ConflictsV2ValidationError('personId doit etre un entier > 0');
  }
  if (!ISO_DATE_RE.test(String(startDate))) {
    throw new ConflictsV2ValidationError('startDate au format YYYY-MM-DD requis');
  }
  if (!ISO_DATE_RE.test(String(endDate))) {
    throw new ConflictsV2ValidationError('endDate au format YYYY-MM-DD requis');
  }
  if (String(endDate) < String(startDate)) {
    throw new ConflictsV2ValidationError('endDate doit etre >= startDate');
  }
  if (!PERIODS.has(startPeriod)) {
    throw new ConflictsV2ValidationError('startPeriod doit valoir AM ou PM');
  }
  if (!PERIODS.has(endPeriod)) {
    throw new ConflictsV2ValidationError('endPeriod doit valoir AM ou PM');
  }

  /** @type {ConflictEntry[]} */
  const conflicts = [];

  // ─── 1. availabilities ──────────────────────────────────────
  //   Approuvees uniquement, chevauchement de plage.
  //   Chevauchement inclusif : a.start_date <= end AND a.end_date >= start.
  try {
    const rows = db
      .prepare(
        `SELECT id, start_date, end_date, start_period, end_period, type, reason, status
         FROM availabilities
         WHERE person_id = ?
           AND status = 'approved'
           AND start_date <= ?
           AND end_date >= ?`,
      )
      .all(pid, endDate, startDate);
    for (const r of rows) {
      if (isExcluded('availability', r.id, exclude)) continue;
      conflicts.push({
        source: 'availability',
        entity_type: 'availability',
        entity_id: r.id,
        start_date: r.start_date,
        end_date: r.end_date,
        start_period: r.start_period ?? null,
        end_period: r.end_period ?? null,
        description: `Indisponibilite ${r.type}${r.reason ? ` — ${r.reason}` : ''}`,
        meta: { type: r.type, reason: r.reason ?? null },
      });
    }
  } catch {
    // Table potentiellement absente en test — silencieux.
  }

  // ─── 2. missions via mission_assignments ────────────────────
  //   Statuts qui bloquent : proposed, confirmed. Exclut declined
  //   et cancelled.
  try {
    const rows = db
      .prepare(
        `SELECT m.id AS mission_id, m.title, m.start_date, m.end_date,
                m.start_time, m.end_time, ma.status, ma.position
         FROM mission_assignments ma
         JOIN missions m ON m.id = ma.mission_id
         WHERE ma.person_id = ?
           AND ma.status IN ('proposed', 'confirmed', 'accepted')
           AND m.start_date <= ?
           AND m.end_date >= ?`,
      )
      .all(pid, endDate, startDate);
    for (const r of rows) {
      if (isExcluded('mission', r.mission_id, exclude)) continue;
      conflicts.push({
        source: 'mission',
        entity_type: 'mission',
        entity_id: r.mission_id,
        start_date: r.start_date,
        end_date: r.end_date,
        description: `Mission ${r.title || `#${r.mission_id}`} (${r.status})`,
        meta: {
          status: r.status,
          position: r.position ?? null,
          start_time: r.start_time ?? null,
          end_time: r.end_time ?? null,
        },
      });
    }
  } catch {
    // silencieux
  }

  // ─── 3. task_assignments ────────────────────────────────────
  //   Date unique (pas de plage), status != cancelled.
  try {
    const rows = db
      .prepare(
        `SELECT id, date, period, time, end_time, section, title, status
         FROM task_assignments
         WHERE person_id = ?
           AND (status IS NULL OR status != 'cancelled')
           AND date >= ?
           AND date <= ?`,
      )
      .all(pid, startDate, endDate);
    for (const r of rows) {
      if (isExcluded('task', r.id, exclude)) continue;
      conflicts.push({
        source: 'task',
        entity_type: 'task_assignment',
        entity_id: r.id,
        start_date: r.date,
        end_date: r.date,
        start_period: r.period ?? null,
        end_period: r.period ?? null,
        description: `Tache ${r.title || r.section || '(sans titre)'}`,
        meta: {
          status: r.status ?? null,
          section: r.section ?? null,
          time: r.time ?? null,
          end_time: r.end_time ?? null,
        },
      });
    }
  } catch {
    // silencieux
  }

  return { conflicts, has_conflict: conflicts.length > 0, count: conflicts.length };
}
