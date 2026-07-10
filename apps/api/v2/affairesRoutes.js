// apps/api/v2/affairesRoutes.js
//
// Ticket : T-P0-09 (P0 Affaires v2 — API v2 lecture + PATCH audite).
//
// Namespace `/api/v2/affaires/*` — endpoints livres :
//   - GET   /api/v2/affaires/protocol
//   - GET   /api/v2/affaires
//   - GET   /api/v2/affaires/:numero_affaire
//   - GET   /api/v2/affaires/:numero_affaire/history
//   - PATCH /api/v2/affaires/:numero_affaire
//
// Coexistence stricte avec le namespace v1 `/api/affaires/*` qui
// reste actif. La v2 se distingue par :
//   - aucune materialisation dynamique (les 12 implicites ont ete
//     materialisees en dur par T-P0-08 dans `affaires`).
//   - audit trail systematique par champ dans `affaire_history`.
//   - pagination cursor-based opaque (base64url).
//
// Voir docs/05-Specs/AFFAIRES_V2.md et docs/api/v2/affaires.md.

import db from '../database.js';
import logger from '../logger.js';
import { createFeatureFlagGuard } from '../middleware/featureFlag.js';
import {
  AFFAIRE_PATCH_FIELDS,
  AffairesV2ConflictError,
  AffairesV2NotFoundError,
  AffairesV2ValidationError,
  getAffaireByNumero,
  getAffaireHistory,
  listAffaires,
  patchAffaire,
} from '../services/affaires/index.js';
import { sendV2Error, sendV2Success } from '../utils/apiV2Response.js';

/**
 * Version du protocole Affaires v2.
 * @type {string}
 */
export const AFFAIRES_PROTOCOL_VERSION = '2.0.0';

/**
 * Nom canonique du feature flag serveur.
 * @type {string}
 */
export const AFFAIRES_V2_FLAG = 'FEATURE_V2_AFFAIRES';

/**
 * Capacites annoncees par le protocole v2. Kebab-case stables.
 * @type {ReadonlyArray<string>}
 */
export const AFFAIRES_V2_CAPABILITIES = Object.freeze([
  'protocol-discovery',
  'affaires-list-cursor-v1',
  'affaire-detail-v1',
  'affaire-history-v1',
  'affaire-patch-audited-v1',
]);

/**
 * Traduit une erreur typee du service en reponse HTTP v2.
 */
function handleServiceError(res, err) {
  if (err instanceof AffairesV2ValidationError) {
    return sendV2Error(res, err.message, {
      status: 400,
      code: 'VALIDATION_ERROR',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  if (err instanceof AffairesV2NotFoundError) {
    return sendV2Error(res, err.message, {
      status: 404,
      code: 'NOT_FOUND',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  if (err instanceof AffairesV2ConflictError) {
    return sendV2Error(res, err.message, {
      status: 409,
      code: 'CONFLICT',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  logger.error('Affaires v2 service error:', err);
  return sendV2Error(res, 'Erreur serveur interne', {
    status: 500,
    code: 'INTERNAL_ERROR',
  });
}

/**
 * Enregistre les routes v2 Affaires sur l'application Express.
 * @param {import('express').Express} app
 * @param {import('express').RequestHandler} authenticateToken
 * @returns {void}
 */
export function setupAffairesV2Routes(app, authenticateToken) {
  if (!app || typeof app.get !== 'function') {
    throw new TypeError('setupAffairesV2Routes: application Express requise');
  }
  if (typeof authenticateToken !== 'function') {
    throw new TypeError('setupAffairesV2Routes: authenticateToken requis');
  }

  const flagGuard = createFeatureFlagGuard(AFFAIRES_V2_FLAG);

  // ─── GET /api/v2/affaires/protocol ───
  app.get('/api/v2/affaires/protocol', flagGuard, (_req, res) => {
    sendV2Success(res, {
      protocol_version: AFFAIRES_PROTOCOL_VERSION,
      capabilities: [...AFFAIRES_V2_CAPABILITIES],
      legacy_endpoints: [
        '/api/affaires',
        '/api/affaires/:id',
        '/api/affaires/:id/history',
        '/api/affaires/:id/status',
      ],
      patch_fields: [...AFFAIRE_PATCH_FIELDS],
      docs: '/docs/api/v2/affaires.md',
    });
  });

  // ─── GET /api/v2/affaires ───
  app.get('/api/v2/affaires', flagGuard, authenticateToken, (req, res) => {
    try {
      const limitRaw = req.query.limit;
      const limit = limitRaw ? Number(limitRaw) : undefined;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
      const filters = {};
      if (typeof req.query.type === 'string' && req.query.type.trim() !== '') {
        filters.type = req.query.type.trim();
      }
      if (typeof req.query.client === 'string' && req.query.client.trim() !== '') {
        filters.client = req.query.client.trim();
      }
      const result = listAffaires({ db, cursor, limit, filters });
      sendV2Success(res, result, {
        meta: {
          pagination: {
            next_cursor: result.next_cursor,
            has_more: result.has_more,
            total_returned: result.total_returned,
          },
        },
      });
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── GET /api/v2/affaires/:numero_affaire ───
  app.get('/api/v2/affaires/:numero_affaire', flagGuard, authenticateToken, (req, res) => {
    try {
      const result = getAffaireByNumero({ db, numeroAffaire: req.params.numero_affaire });
      sendV2Success(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── GET /api/v2/affaires/:numero_affaire/history ───
  app.get('/api/v2/affaires/:numero_affaire/history', flagGuard, authenticateToken, (req, res) => {
    try {
      const { affaire } = getAffaireByNumero({ db, numeroAffaire: req.params.numero_affaire });
      const limitRaw = req.query.limit;
      const limit = limitRaw ? Number(limitRaw) : undefined;
      const result = getAffaireHistory({ db, affaireId: Number(affaire.id), limit });
      sendV2Success(res, {
        numero_affaire: affaire.numero_affaire,
        affaire_id: affaire.id,
        ...result,
      });
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── PATCH /api/v2/affaires/:numero_affaire ───
  app.patch('/api/v2/affaires/:numero_affaire', flagGuard, authenticateToken, (req, res) => {
    try {
      const body = req.body || {};
      const patch = {};
      for (const field of AFFAIRE_PATCH_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          patch[field] = body[field];
        }
      }
      const result = patchAffaire({
        db,
        numeroAffaire: req.params.numero_affaire,
        patch,
        modifiedBy: req.user?.id ?? null,
        notes: typeof body.notes === 'string' && body.notes.trim() !== '' ? body.notes : null,
      });
      sendV2Success(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  });
}
