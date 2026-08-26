// apps/web/src/utils/sav/fetchSavParts.js
//
// Ticket : T-P1-07b (SAV v2 — fondations UI).
//
// Helpers unifies pour :
//   - lister les pieces d'un ticket SAV
//   - ajouter une piece
//   - changer le statut d'une piece
//   - transitionner un ticket vers un nouveau statut
//
// Le v1 ne dispose pas d'endpoint standalone equivalent pour les
// `sav_parts` (nouvelle table T-P1-07). Retour `null` quand
// indisponible (flag off, FEATURE_DISABLED, methode absente,
// erreur reseau).

import {
  adaptSavPartV2ToV1,
  adaptV2SavPartsList,
  adaptV2TicketTransitionResponse,
} from './v2Adapters.js';

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isFeatureDisabled(err) {
  if (!err || typeof err !== 'object') return false;
  const code = err.code || err.details?.code;
  return code === 'FEATURE_DISABLED';
}

/**
 * @param {object} api
 * @param {number} ticketId
 * @param {{ useV2?: boolean }} [options]
 * @returns {Promise<{ parts: Array<object>, total: number } | null>}
 */
export async function fetchSavPartsUnified(api, ticketId, { useV2 = false } = {}) {
  if (!useV2 || typeof api?.v2ListSavParts !== 'function') return null;
  const id = Number(ticketId);
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    const response = await api.v2ListSavParts(id);
    return adaptV2SavPartsList(response);
  } catch (err) {
    if (!isFeatureDisabled(err)) {
      // eslint-disable-next-line no-console
      console.warn('[sav v2] fetchSavPartsUnified: retour null', err);
    }
    return null;
  }
}

/**
 * Ajoute une piece (POST). Le payload cote v2 attend du snake_case.
 * @param {object} api
 * @param {number} ticketId
 * @param {object} data - Champs UI (camelCase ou snake_case).
 * @param {{ useV2?: boolean }} [options]
 * @returns {Promise<object|null>} Piece creee shape camelCase.
 */
export async function addSavPartUnified(api, ticketId, data, { useV2 = false } = {}) {
  if (!useV2 || typeof api?.v2AddSavPart !== 'function') return null;
  const id = Number(ticketId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const body = {
    part_name: data?.partName ?? data?.part_name,
    part_reference: data?.partReference ?? data?.part_reference ?? null,
    quantity: data?.quantity ?? 1,
    unit_price: data?.unitPrice ?? data?.unit_price ?? null,
    supplier: data?.supplier ?? null,
    notes: data?.notes ?? null,
  };
  try {
    const response = await api.v2AddSavPart(id, body);
    const part = response?.data?.part;
    return adaptSavPartV2ToV1(part);
  } catch (err) {
    if (!isFeatureDisabled(err)) {
      // eslint-disable-next-line no-console
      console.warn('[sav v2] addSavPartUnified: retour null', err);
    }
    return null;
  }
}

/**
 * PATCH statut d'une piece.
 * @param {object} api
 * @param {number} partId
 * @param {string} status
 * @param {{ useV2?: boolean }} [options]
 * @returns {Promise<object|null>} Piece a jour shape camelCase.
 */
export async function updateSavPartStatusUnified(api, partId, status, { useV2 = false } = {}) {
  if (!useV2 || typeof api?.v2UpdateSavPartStatus !== 'function') return null;
  const id = Number(partId);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (typeof status !== 'string' || status === '') return null;
  try {
    const response = await api.v2UpdateSavPartStatus(id, status);
    return adaptSavPartV2ToV1(response?.data?.part);
  } catch (err) {
    if (!isFeatureDisabled(err)) {
      // eslint-disable-next-line no-console
      console.warn('[sav v2] updateSavPartStatusUnified: retour null', err);
    }
    return null;
  }
}

/**
 * Transition d'un ticket vers un nouveau statut.
 * @param {object} api
 * @param {number} ticketId
 * @param {string} newStatus
 * @param {{ useV2?: boolean }} [options]
 * @returns {Promise<object|null>} Payload transition shape camelCase.
 */
export async function transitionSavTicketUnified(api, ticketId, newStatus, { useV2 = false } = {}) {
  if (!useV2 || typeof api?.v2TransitionSavTicket !== 'function') return null;
  const id = Number(ticketId);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (typeof newStatus !== 'string' || newStatus === '') return null;
  try {
    const response = await api.v2TransitionSavTicket(id, newStatus);
    return adaptV2TicketTransitionResponse(response);
  } catch (err) {
    if (!isFeatureDisabled(err)) {
      // eslint-disable-next-line no-console
      console.warn('[sav v2] transitionSavTicketUnified: retour null', err);
    }
    return null;
  }
}
