// apps/api/services/affaires/history.js
//
// Services de lecture / ecriture sur `affaire_history` (T-P0-08).
// Le trail est alimente par le namespace v2 `patchAffaire` (T-P0-09)
// champ par champ. La lecture retourne un ordre chronologique
// decroissant, safe pour un usage timeline.
//
// [HOTFIX 2026-07-10] La table `affaire_history` existe deja depuis
// le ticket L6 (commit d31dc24b, mai 2026, alimentee par
// `services/affaireHistory.js` pour les imports BL/BP). Son schema
// est event-based : `event_type NOT NULL`, `source`, `source_ref`,
// `field_name`, `old_value`, `new_value`, `user_id`, `notes`,
// `created_at`. Aligne le service v2 sur ce schema existant :
//   - INSERT : `event_type='field_change'` + `source='v2_api'`.
//   - SELECT : filtre `event_type='field_change'` (n'expose pas les
//     evenements legacy import), alias `user_id AS changed_by`,
//     `created_at AS changed_at` pour conserver le contrat public
//     du service.
// Aucune modification de schema requise.

import { AffairesV2ValidationError } from './errors.js';

/**
 * Discriminant d'event pour les entrees v2 field-based. Valeur
 * autorisee par ALLOWED_EVENT_TYPES de `services/affaireHistory.js`.
 * @type {string}
 */
export const V2_FIELD_CHANGE_EVENT_TYPE = 'field_change';

/**
 * Source des entrees v2 field-based. Valeur autorisee par
 * ALLOWED_SOURCES de `services/affaireHistory.js`.
 * @type {string}
 */
export const V2_FIELD_CHANGE_SOURCE = 'v2_api';

/**
 * Retourne les entrees d'historique pour un `affaire_id` donne,
 * filtrees sur les entrees field-based v2 uniquement (les evenements
 * legacy import BL/BP ne polluent pas l'audit v2).
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.affaireId
 * @param {number} [params.limit=100] Cap max des entrees retournees.
 * @returns {{ entries: Array<{
 *   id: number,
 *   affaire_id: number,
 *   field_name: string,
 *   old_value: string|null,
 *   new_value: string|null,
 *   changed_by: number|null,
 *   changed_at: string,
 *   notes: string|null
 * }>, total: number }}
 */
export function getAffaireHistory({ db, affaireId, limit = 100 } = {}) {
  if (!db) throw new AffairesV2ValidationError('db requis');
  const id = Number(affaireId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AffairesV2ValidationError('affaireId doit etre un entier > 0');
  }
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const rows = db
    .prepare(
      `SELECT id,
              affaire_id,
              field_name,
              old_value,
              new_value,
              user_id  AS changed_by,
              created_at AS changed_at,
              notes
       FROM affaire_history
       WHERE affaire_id = ?
         AND event_type = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(id, V2_FIELD_CHANGE_EVENT_TYPE, cap);
  return { entries: rows, total: rows.length };
}

/**
 * Insere une entree d'audit pour un champ modifie. Reutilise le
 * schema legacy (event_type + source discriminants).
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.affaireId
 * @param {string} params.fieldName
 * @param {string|null} params.oldValue
 * @param {string|null} params.newValue
 * @param {number|null} [params.changedBy]
 * @param {string|null} [params.notes]
 * @returns {number} Rowid de l'entree inseree.
 */
export function appendHistoryEntry({
  db,
  affaireId,
  fieldName,
  oldValue,
  newValue,
  changedBy = null,
  notes = null,
} = {}) {
  if (!db) throw new AffairesV2ValidationError('db requis');
  const id = Number(affaireId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AffairesV2ValidationError('affaireId doit etre un entier > 0');
  }
  if (!fieldName || typeof fieldName !== 'string') {
    throw new AffairesV2ValidationError('fieldName requis');
  }
  const result = db
    .prepare(
      `INSERT INTO affaire_history
         (affaire_id, event_type, source, source_ref, field_name,
          old_value, new_value, user_id, notes)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      V2_FIELD_CHANGE_EVENT_TYPE,
      V2_FIELD_CHANGE_SOURCE,
      fieldName,
      oldValue,
      newValue,
      changedBy,
      notes,
    );
  return result.lastInsertRowid;
}
