// apps/api/services/affaires/history.js
//
// Services de lecture / ecriture sur `affaire_history` (T-P0-08).
// Le trail est alimente par le namespace v2 `patchAffaire` (T-P0-09)
// champ par champ. La lecture retourne un ordre chronologique
// decroissant, safe pour un usage timeline.

import { AffairesV2ValidationError } from './errors.js';

/**
 * Retourne les entrees d'historique pour un `affaire_id` donne.
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
      `SELECT id, affaire_id, field_name, old_value, new_value, changed_by,
              changed_at, notes
       FROM affaire_history
       WHERE affaire_id = ?
       ORDER BY changed_at DESC, id DESC
       LIMIT ?`,
    )
    .all(id, cap);
  return { entries: rows, total: rows.length };
}

/**
 * Insere une entree d'audit pour un champ modifie.
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
         (affaire_id, field_name, old_value, new_value, changed_by, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, fieldName, oldValue, newValue, changedBy, notes);
  return result.lastInsertRowid;
}
