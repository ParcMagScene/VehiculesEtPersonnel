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

import { PlanningV2NotImplementedError } from './tasks.js';

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
 * Contrat cible : lister les événements d'affichage dynamique.
 * Non implémenté au stade T-P0-01.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function listEvents(_params) {
  throw new PlanningV2NotImplementedError('listEvents');
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
