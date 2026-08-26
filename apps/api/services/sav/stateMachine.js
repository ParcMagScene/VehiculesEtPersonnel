// apps/api/services/sav/stateMachine.js
//
// Ticket : T-P1-07 (Equipements v2 - machine d'etat SAV renforcee).
//
// Machine d'etat explicite des tickets SAV. Utilisee par le v2 pour
// valider chaque transition avant UPDATE. Le v1 (savRoutes.js) ne
// consomme pas cette machine (il accepte toute transition texte
// entre les 6 statuts). Un futur ticket pourra migrer le v1 vers
// cette validation stricte.
//
// Statuts source : services/savComparator.js#SAV_STATUS.

import { SAV_STATUS, SAV_STATUS_VALUES } from '../savComparator.js';
import { SavV2ConflictError, SavV2ValidationError } from './errors.js';

/**
 * Transitions autorisees. Chaque cle = etat source, valeur = Set
 * d'etats cibles atteignables. Une auto-transition (from === to)
 * est autorisee (idempotence : re-emit du meme statut = no-op cote
 * business).
 *
 * @type {Readonly<Record<string, ReadonlySet<string>>>}
 */
export const ALLOWED_TRANSITIONS = Object.freeze({
  [SAV_STATUS.OPEN]: new Set([
    SAV_STATUS.OPEN,
    SAV_STATUS.IN_PROGRESS,
    SAV_STATUS.WAITING_PARTS,
    SAV_STATUS.SORTIE_SAV,
    SAV_STATUS.CLOSED, // cas rare : ticket ouvert par erreur
  ]),
  [SAV_STATUS.IN_PROGRESS]: new Set([
    SAV_STATUS.IN_PROGRESS,
    SAV_STATUS.WAITING_PARTS,
    SAV_STATUS.RESOLVED,
    SAV_STATUS.SORTIE_SAV,
  ]),
  [SAV_STATUS.WAITING_PARTS]: new Set([
    SAV_STATUS.WAITING_PARTS,
    SAV_STATUS.IN_PROGRESS, // pieces recues -> retour en cours
    SAV_STATUS.SORTIE_SAV, // abandon
  ]),
  [SAV_STATUS.RESOLVED]: new Set([
    SAV_STATUS.RESOLVED,
    SAV_STATUS.CLOSED,
    SAV_STATUS.IN_PROGRESS, // re-ouverture apres retour du client
  ]),
  [SAV_STATUS.SORTIE_SAV]: new Set([
    SAV_STATUS.SORTIE_SAV,
    SAV_STATUS.CLOSED, // finalisation admin
  ]),
  [SAV_STATUS.CLOSED]: new Set([
    SAV_STATUS.CLOSED,
    SAV_STATUS.IN_PROGRESS, // re-ouverture exceptionnelle
  ]),
});

/**
 * Vrai si la transition `from -> to` est autorisee.
 *
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function isTransitionAllowed(from, to) {
  if (!SAV_STATUS_VALUES.includes(from)) return false;
  if (!SAV_STATUS_VALUES.includes(to)) return false;
  const set = ALLOWED_TRANSITIONS[from];
  return set ? set.has(to) : false;
}

/**
 * Retourne la liste des transitions possibles depuis `from`.
 *
 * @param {string} from
 * @returns {string[]}
 */
export function getAllowedNext(from) {
  const set = ALLOWED_TRANSITIONS[from];
  return set ? [...set] : [];
}

/**
 * Valide une transition et throw en cas de rejet.
 *
 * @param {string} from
 * @param {string} to
 * @throws {SavV2ValidationError} si un des statuts n'est pas connu.
 * @throws {SavV2ConflictError} si la transition n'est pas autorisee.
 */
export function assertTransition(from, to) {
  if (!SAV_STATUS_VALUES.includes(from)) {
    throw new SavV2ValidationError(`Statut source inconnu : ${from}`, { from });
  }
  if (!SAV_STATUS_VALUES.includes(to)) {
    throw new SavV2ValidationError(`Statut cible inconnu : ${to}`, { to });
  }
  if (!isTransitionAllowed(from, to)) {
    throw new SavV2ConflictError(`Transition SAV interdite : ${from} -> ${to}`, {
      from,
      to,
      allowed: getAllowedNext(from),
    });
  }
}
