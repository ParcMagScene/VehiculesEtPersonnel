// ─────────────────────────────────────────────────────────────
// services/planning/ical.js
// Sous-domaine "ical" du PlanningService v2.
//
// Ticket : T-P0-01 (cadrage) — SQUELETTE PUR, aucun accès DB.
//
// Portée métier :
//   - Gestion des abonnements iCal externes (lecture uniquement
//     pour intégration dans le planning eM@g).
//   - Export du planning eM@g (tâches, réservations) au format iCal.
//
// Voir : docs/api/v2/planning.md
// ─────────────────────────────────────────────────────────────

import { PlanningV2NotImplementedError } from './tasks.js';

/**
 * Type MIME cible d'un flux iCal v2.
 *
 * @type {string}
 */
export const ICAL_MIME_TYPE = 'text/calendar; charset=utf-8';

/**
 * Contrat cible : lister les abonnements iCal.
 * Non implémenté au stade T-P0-01.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function listIcalCalendars(_params) {
  throw new PlanningV2NotImplementedError('listIcalCalendars');
}

/**
 * Contrat cible : enregistrer un nouvel abonnement iCal.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function createIcalCalendar(_params) {
  throw new PlanningV2NotImplementedError('createIcalCalendar');
}

/**
 * Contrat cible : produire un export iCal (chaîne ICS) sur une plage
 * de dates donnée.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function exportIcalFeed(_params) {
  throw new PlanningV2NotImplementedError('exportIcalFeed');
}
