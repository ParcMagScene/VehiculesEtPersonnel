// apps/api/services/leaves/balance.js
//
// Ticket : T-P1-04. Service de lecture des soldes conges depuis
// la table `leave_balances`.

import { LeavesV2NotFoundError, LeavesV2ValidationError } from './errors.js';

/**
 * Retourne un solde specifique (person_id, year, type). Type par
 * defaut : `conge_paye`. Retourne un objet meme si aucune ligne
 * n'existe (entitled=0, taken=0, remaining=0) : c'est l'etat
 * legitime d'un nouveau salarie avant le premier calcul d'acquisition.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.personId
 * @param {number} [params.year] Annee (defaut : annee courante).
 * @param {string} [params.type='conge_paye']
 * @returns {{
 *   person_id: number,
 *   year: number,
 *   type: string,
 *   days_entitled: number,
 *   days_taken: number,
 *   days_remaining: number,
 *   exists: boolean,
 * }}
 */
export function getBalanceForPerson({ db, personId, year, type = 'conge_paye' } = {}) {
  if (!db) throw new LeavesV2ValidationError('db requis');
  const pid = Number(personId);
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new LeavesV2ValidationError('personId invalide');
  }
  const y = Number.isInteger(year) && year > 0 ? year : new Date().getFullYear();

  const row = db
    .prepare(
      'SELECT days_entitled, days_taken FROM leave_balances WHERE person_id = ? AND year = ? AND type = ?',
    )
    .get(pid, y, String(type));

  const daysEntitled = row?.days_entitled ?? 0;
  const daysTaken = row?.days_taken ?? 0;
  return {
    person_id: pid,
    year: y,
    type: String(type),
    days_entitled: Number(daysEntitled),
    days_taken: Number(daysTaken),
    days_remaining: Math.max(0, Number(daysEntitled) - Number(daysTaken)),
    exists: Boolean(row),
  };
}

/**
 * Retourne l'id `persons.id` associe a un `users.id`. Requis pour
 * les endpoints "mine" ou l'user authentifie doit etre resolu en
 * personne pour lire son solde.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.userId
 * @returns {number}
 * @throws {LeavesV2NotFoundError} si aucune ligne persons ne pointe vers l'user.
 */
export function resolvePersonIdFromUser({ db, userId } = {}) {
  if (!db) throw new LeavesV2ValidationError('db requis');
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0) {
    throw new LeavesV2ValidationError('userId invalide');
  }
  const row = db.prepare('SELECT id FROM persons WHERE user_id = ?').get(uid);
  if (!row) {
    throw new LeavesV2NotFoundError("Aucune fiche persons associee a l'utilisateur", {
      userId: uid,
    });
  }
  return Number(row.id);
}
