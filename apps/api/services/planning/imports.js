// ─────────────────────────────────────────────────────────────
// services/planning/imports.js
// Sous-domaine "imports" (BL / BP) du PlanningService v2.
//
// Ticket : T-P0-01 (cadrage) — SQUELETTE PUR, aucun accès DB.
//
// Portée métier :
//   - Import de bons de livraison (PDF / image) et parsing structuré
//     (bl_imports.parsed_data, sections_data, field_confidence).
//   - Manipulation des items BP (bp_items) et matching avec
//     equipment_catalog / equipment / stock_items.
//   - Batch d'import (max 50 fichiers, HIGH-5 audit sécurité).
//
// Voir : docs/api/v2/planning.md
// ─────────────────────────────────────────────────────────────

import { PlanningV2NotImplementedError } from './tasks.js';

/**
 * Statuts valides d'un import BL v2.
 *
 * @type {ReadonlyArray<'pending' | 'validated' | 'rejected'>}
 */
export const BL_IMPORT_STATUSES = Object.freeze(['pending', 'validated', 'rejected']);

/**
 * Statuts de matching valides pour un item BP v2.
 *
 * @type {ReadonlyArray<'unmatched' | 'matched' | 'manual' | 'ignored'>}
 */
export const BP_ITEM_MATCH_STATUSES = Object.freeze(['unmatched', 'matched', 'manual', 'ignored']);

/**
 * Contrat cible : lister les imports BL avec filtres.
 * Non implémenté au stade T-P0-01.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function listBlImports(_params) {
  throw new PlanningV2NotImplementedError('listBlImports');
}

/**
 * Contrat cible : créer un import BL à partir d'un upload.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function createBlImport(_params) {
  throw new PlanningV2NotImplementedError('createBlImport');
}

/**
 * Contrat cible : créer un lot d'imports BL (max 50).
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function createBlImportBatch(_params) {
  throw new PlanningV2NotImplementedError('createBlImportBatch');
}

/**
 * Contrat cible : mettre à jour le statut / items liés d'un BL.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function updateBlImport(_params) {
  throw new PlanningV2NotImplementedError('updateBlImport');
}

/**
 * Contrat cible : lister les items BP (matching inventaire).
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function listBpItems(_params) {
  throw new PlanningV2NotImplementedError('listBpItems');
}

/**
 * Contrat cible : rattacher un item BP à un article inventaire.
 *
 * @param {object} _params
 * @returns {Promise<never>}
 */
export async function matchBpItem(_params) {
  throw new PlanningV2NotImplementedError('matchBpItem');
}
