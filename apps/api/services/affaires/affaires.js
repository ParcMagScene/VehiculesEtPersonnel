// apps/api/services/affaires/affaires.js
//
// Services metier du namespace `/api/v2/affaires/*` (T-P0-09).
//
// Contrat v2 :
//   - Lecture stricte : aucune creation implicite d'affaire depuis les
//     colonnes TEXT legacy (contrairement au namespace v1 qui enrichit
//     dynamiquement les reponses en materiaisant a la volee).
//     La matérialisation reelle a ete faite par la migration T-P0-08.
//   - Mutation : PATCH champ-par-champ. Chaque modification effective
//     genere une entree `affaire_history` (audit trail T-P0-08).
//   - Pagination cursor-based sur `created_at DESC, id DESC` via
//     l'encodage opaque de `apps/api/utils/cursor.js`.
//
// Volumetrie affaires : ordre de grandeur 200-5000 lignes. Le cursor
// keyset garantit un ordre stable meme sous mutations concurrentes.

import { decodeCursor, encodeCursor } from '../../utils/cursor.js';
import {
  AffairesV2ConflictError,
  AffairesV2NotFoundError,
  AffairesV2ValidationError,
} from './errors.js';
import { appendHistoryEntry } from './history.js';

/**
 * Champs de `affaires` exposes en lecture v2.
 * @type {ReadonlyArray<string>}
 */
export const AFFAIRE_READ_FIELDS = Object.freeze([
  'id',
  'numero_affaire',
  'nom',
  'type',
  'client',
  'interlocuteur',
  'tel',
  'fax',
  'date_debut',
  'date_fin',
  'devis',
  'adresse_livraison',
  'titre',
  'description',
  'google_event_id',
  'event_name',
  'created_by',
  'created_at',
  'modified_by',
  'modified_at',
]);

/**
 * Champs `affaires` acceptes en mutation via PATCH v2. Volontairement
 * plus restrictif que la lecture : `id`, `numero_affaire`, `created_by`,
 * `created_at`, `modified_by`, `modified_at` ne sont pas patchables
 * (identite / audit).
 * @type {ReadonlyArray<string>}
 */
export const AFFAIRE_PATCH_FIELDS = Object.freeze([
  'nom',
  'type',
  'client',
  'interlocuteur',
  'tel',
  'fax',
  'date_debut',
  'date_fin',
  'devis',
  'adresse_livraison',
  'titre',
  'description',
  'google_event_id',
  'event_name',
]);

/** Limite max pour `limit`. @type {number} */
const LIST_LIMIT_MAX = 200;
/** Limite par defaut si non specifiee. @type {number} */
const LIST_LIMIT_DEFAULT = 50;

/**
 * @param {string|null|undefined} value
 * @returns {string} `YYYY-MM-DD` extrait d'un timestamp SQLite.
 */
function toIsoDate(value) {
  if (!value || typeof value !== 'string') return '1970-01-01';
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '1970-01-01';
}

/**
 * Selectionne les champs exposes en lecture depuis une ligne DB
 * brute.
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>|null}
 */
function pickReadFields(row) {
  if (!row) return null;
  const out = {};
  for (const field of AFFAIRE_READ_FIELDS) {
    out[field] = row[field] ?? null;
  }
  return out;
}

/**
 * Recupere une affaire par cle metier `numero_affaire`.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {string} params.numeroAffaire
 * @returns {{ affaire: Record<string, unknown> }}
 * @throws {AffairesV2ValidationError} si numeroAffaire manquant.
 * @throws {AffairesV2NotFoundError} si aucune ligne ne correspond.
 */
export function getAffaireByNumero({ db, numeroAffaire } = {}) {
  if (!db) throw new AffairesV2ValidationError('db requis');
  if (!numeroAffaire || typeof numeroAffaire !== 'string') {
    throw new AffairesV2ValidationError('numeroAffaire requis');
  }
  const row = db
    .prepare(
      `SELECT id, numero_affaire, nom, type, client, interlocuteur, tel, fax,
              date_debut, date_fin, devis, adresse_livraison, titre, description,
              google_event_id, event_name, created_by, created_at,
              modified_by, modified_at
       FROM affaires
       WHERE numero_affaire = ?`,
    )
    .get(numeroAffaire);
  if (!row) {
    throw new AffairesV2NotFoundError(`Affaire introuvable (numero_affaire=${numeroAffaire})`, {
      numeroAffaire,
    });
  }
  return { affaire: pickReadFields(row) };
}

/**
 * Recupere une affaire par id primaire.
 * Interne : utilise par la route history (URL parametree par numero).
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.affaireId
 * @returns {Record<string, unknown>|null}
 */
export function getAffaireById({ db, affaireId } = {}) {
  if (!db) throw new AffairesV2ValidationError('db requis');
  const id = Number(affaireId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AffairesV2ValidationError('affaireId invalide');
  }
  const row = db
    .prepare(
      `SELECT id, numero_affaire, nom, type, client, interlocuteur, tel, fax,
              date_debut, date_fin, devis, adresse_livraison, titre, description,
              google_event_id, event_name, created_by, created_at,
              modified_by, modified_at
       FROM affaires
       WHERE id = ?`,
    )
    .get(id);
  return pickReadFields(row);
}

/**
 * Liste paginee des affaires (cursor-based, ordre `created_at DESC, id DESC`).
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {string|null} [params.cursor] Curseur opaque (base64url).
 * @param {number} [params.limit=50]
 * @param {object} [params.filters]
 * @param {string} [params.filters.type] Filtre exact sur `type`.
 * @param {string} [params.filters.client] Filtre LIKE (contient) sur `client`.
 * @returns {{
 *   items: Array<Record<string, unknown>>,
 *   next_cursor: string|null,
 *   total_returned: number,
 *   has_more: boolean
 * }}
 */
export function listAffaires({ db, cursor = null, limit = LIST_LIMIT_DEFAULT, filters = {} } = {}) {
  if (!db) throw new AffairesV2ValidationError('db requis');
  const cap = Math.min(Math.max(Number(limit) || LIST_LIMIT_DEFAULT, 1), LIST_LIMIT_MAX);

  const where = [];
  const params = [];
  if (filters?.type && typeof filters.type === 'string') {
    where.push('type = ?');
    params.push(filters.type);
  }
  if (filters?.client && typeof filters.client === 'string') {
    where.push('client LIKE ?');
    params.push(`%${filters.client}%`);
  }

  const decoded = decodeCursor(cursor);
  if (decoded) {
    // Ordre `created_at DESC, id DESC` -> (created_at < cursor.date)
    // OR (created_at = cursor.date AND id < cursor.id).
    where.push('((substr(created_at, 1, 10) < ?) OR (substr(created_at, 1, 10) = ? AND id < ?))');
    params.push(decoded.date, decoded.date, decoded.id);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT id, numero_affaire, nom, type, client, interlocuteur, tel, fax,
              date_debut, date_fin, devis, adresse_livraison, titre, description,
              google_event_id, event_name, created_by, created_at,
              modified_by, modified_at
       FROM affaires
       ${whereSql}
       ORDER BY substr(created_at, 1, 10) DESC, id DESC
       LIMIT ?`,
    )
    .all(...params, cap + 1);

  const hasMore = rows.length > cap;
  const items = rows.slice(0, cap).map(pickReadFields);
  let nextCursor = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1];
    nextCursor = encodeCursor({ date: toIsoDate(String(last.created_at)), id: Number(last.id) });
  }

  return {
    items,
    next_cursor: nextCursor,
    total_returned: items.length,
    has_more: hasMore,
  };
}

/**
 * Applique un patch partiel a une affaire, ecrit une entree
 * `affaire_history` par champ effectivement modifie.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {string} params.numeroAffaire Cle metier.
 * @param {Record<string, unknown>} params.patch Sous-ensemble des
 *   champs `AFFAIRE_PATCH_FIELDS`. Les autres cles sont ignorees.
 * @param {number|null} [params.modifiedBy] User id (audit).
 * @param {string|null} [params.notes] Note associee aux entrees history.
 * @returns {{
 *   affaire: Record<string, unknown>,
 *   changed_fields: string[],
 *   history_ids: number[],
 *   changed: boolean
 * }}
 * @throws {AffairesV2ValidationError} si patch invalide.
 * @throws {AffairesV2NotFoundError} si l'affaire n'existe pas.
 */
export function patchAffaire({ db, numeroAffaire, patch, modifiedBy = null, notes = null } = {}) {
  if (!db) throw new AffairesV2ValidationError('db requis');
  if (!numeroAffaire || typeof numeroAffaire !== 'string') {
    throw new AffairesV2ValidationError('numeroAffaire requis');
  }
  if (!patch || typeof patch !== 'object') {
    throw new AffairesV2ValidationError('patch requis (objet)');
  }

  // Normalisation : trim chaines, null pour chaine vide (aligne
  // avec `updateEquipmentLocation` T-P0-12).
  const normalized = {};
  for (const field of AFFAIRE_PATCH_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      const raw = patch[field];
      if (raw === null || raw === undefined) {
        normalized[field] = null;
      } else if (typeof raw === 'string') {
        const trimmed = raw.trim();
        normalized[field] = trimmed === '' ? null : trimmed;
      } else {
        normalized[field] = raw;
      }
    }
  }

  const patchKeys = Object.keys(normalized);
  if (patchKeys.length === 0) {
    throw new AffairesV2ValidationError('patch vide (aucun champ patchable fourni)');
  }

  const current = db.prepare('SELECT * FROM affaires WHERE numero_affaire = ?').get(numeroAffaire);
  if (!current) {
    throw new AffairesV2NotFoundError(`Affaire introuvable (numero_affaire=${numeroAffaire})`, {
      numeroAffaire,
    });
  }

  // Comparaison ancien / nouveau. Un patch inchangé (valeur identique)
  // n'est pas considere comme un changement.
  const changedFields = patchKeys.filter((k) => {
    const oldVal = current[k] === undefined ? null : current[k];
    const newVal = normalized[k];
    return oldVal !== newVal;
  });

  if (changedFields.length === 0) {
    return {
      affaire: pickReadFields(current),
      changed_fields: [],
      history_ids: [],
      changed: false,
    };
  }

  const setSql = changedFields.map((k) => `${k} = ?`).join(', ');
  const setValues = changedFields.map((k) => normalized[k]);

  const historyIds = [];
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE affaires
       SET ${setSql}, modified_by = ?, modified_at = datetime('now')
       WHERE numero_affaire = ?`,
    ).run(...setValues, modifiedBy, numeroAffaire);

    for (const field of changedFields) {
      const oldVal = current[field] === undefined ? null : current[field];
      const historyId = appendHistoryEntry({
        db,
        affaireId: current.id,
        fieldName: field,
        oldValue: oldVal === null ? null : String(oldVal),
        newValue: normalized[field] === null ? null : String(normalized[field]),
        changedBy: modifiedBy,
        notes,
      });
      historyIds.push(Number(historyId));
    }
  });

  try {
    tx();
  } catch (err) {
    if (err && typeof err.message === 'string' && err.message.includes('UNIQUE')) {
      throw new AffairesV2ConflictError('Conflit UNIQUE sur affaires', { cause: err.message });
    }
    throw err;
  }

  const refreshed = db
    .prepare('SELECT * FROM affaires WHERE numero_affaire = ?')
    .get(numeroAffaire);
  return {
    affaire: pickReadFields(refreshed),
    changed_fields: changedFields,
    history_ids: historyIds,
    changed: true,
  };
}
