// ═══════════════════════════════════════════════════════════════
// utils/apiV2Response.js
//
// Ticket : T-P0-03 (Planning v2 — API v2 lecture)
//
// Format de réponse standardisé pour l'API v2 :
//   { success: true,  data, meta? }
//   { success: false, error, code?, meta? }
//
// Différent du helper v1 (`utils/apiResponse.js`) par la présence
// systématique du bloc `meta` (protocol_version, pagination, ...).
//
// Ne se substitue PAS à `apiResponse.js` côté v1 pour préserver la
// rétrocompatibilité (T-P0-06 / P0-DECISION-2 uniquement).
// ═══════════════════════════════════════════════════════════════

/**
 * Version protocolaire courante de l'API v2. À incrémenter à chaque
 * évolution incompatible du format.
 *
 * @type {number}
 */
export const API_V2_PROTOCOL_VERSION = 1;

/**
 * Envoie une réponse succès v2.
 *
 * @param {import('express').Response} res
 * @param {*} data payload principal
 * @param {object} [options]
 * @param {number} [options.status=200]
 * @param {Record<string, unknown>} [options.meta] fusionné dans `meta`
 * @returns {import('express').Response}
 */
export function sendV2Success(res, data, options = {}) {
  const status = typeof options.status === 'number' ? options.status : 200;
  const meta = {
    protocol_version: API_V2_PROTOCOL_VERSION,
    ...(options.meta || {}),
  };
  return res.status(status).json({ success: true, data, meta });
}

/**
 * Envoie une réponse erreur v2.
 *
 * @param {import('express').Response} res
 * @param {string} message
 * @param {object} [options]
 * @param {number} [options.status=400]
 * @param {string} [options.code]
 * @param {Record<string, unknown>} [options.meta]
 * @returns {import('express').Response}
 */
export function sendV2Error(res, message, options = {}) {
  const status = typeof options.status === 'number' ? options.status : 400;
  const body = {
    success: false,
    error: message,
    meta: {
      protocol_version: API_V2_PROTOCOL_VERSION,
      ...(options.meta || {}),
    },
  };
  if (options.code) body.code = options.code;
  return res.status(status).json(body);
}

/**
 * Construit un bloc `pagination` cursor-based à intégrer dans `meta`.
 *
 * @param {object} params
 * @param {string|null} params.cursor curseur reçu (opaque, peut être null).
 * @param {string|null} params.nextCursor curseur pour la page suivante, ou null si aucune.
 * @param {number} params.limit
 * @param {boolean} params.hasMore
 * @returns {{ pagination: { cursor: string|null, next_cursor: string|null, limit: number, has_more: boolean } }}
 */
export function buildV2Pagination({ cursor, nextCursor, limit, hasMore }) {
  return {
    pagination: {
      cursor: cursor ?? null,
      next_cursor: nextCursor ?? null,
      limit,
      has_more: Boolean(hasMore),
    },
  };
}
