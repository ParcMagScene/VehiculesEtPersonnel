// apps/api/v2/conflictsRoutes.js
//
// Ticket : T-P1-05 (Personnel v2 - moteur de conflits).
//
// Namespace `/api/v2/conflicts/*` - endpoints livres :
//   - GET  /api/v2/conflicts/protocol
//   - POST /api/v2/conflicts/check
//
// Aucune ecriture, aucun bloquage sur les endpoints v1
// existants (POST availabilities, POST mission_assignments,
// POST task_assignments continuent d'accepter les entrees meme
// en cas de conflit). Le v2 offre uniquement la **detection**
// pour permettre a l'UI de pre-checker et alerter l'utilisateur.

import db from '../database.js';
import logger from '../logger.js';
import { createFeatureFlagGuard } from '../middleware/featureFlag.js';
import { ConflictsV2ValidationError, detectPersonConflicts } from '../services/conflicts/index.js';
import { sendV2Error, sendV2Success } from '../utils/apiV2Response.js';

/** Version protocolaire. @type {string} */
export const CONFLICTS_PROTOCOL_VERSION = '2.0.0';

/** Nom canonique du feature flag. @type {string} */
export const CONFLICTS_V2_FLAG = 'FEATURE_V2_CONFLICTS';

/** Capacites. @type {ReadonlyArray<string>} */
export const CONFLICTS_V2_CAPABILITIES = Object.freeze([
  'protocol-discovery',
  'person-conflict-check-v1',
]);

function handleServiceError(res, err) {
  if (err instanceof ConflictsV2ValidationError) {
    return sendV2Error(res, err.message, {
      status: 400,
      code: 'VALIDATION_ERROR',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  logger.error('Conflicts v2 service error:', err);
  return sendV2Error(res, 'Erreur serveur interne', {
    status: 500,
    code: 'INTERNAL_ERROR',
  });
}

/**
 * @param {import('express').Express} app
 * @param {import('express').RequestHandler} authenticateToken
 */
export function setupConflictsV2Routes(app, authenticateToken) {
  if (!app || typeof app.get !== 'function') {
    throw new TypeError('setupConflictsV2Routes: application Express requise');
  }
  if (typeof authenticateToken !== 'function') {
    throw new TypeError('setupConflictsV2Routes: authenticateToken requis');
  }

  const flagGuard = createFeatureFlagGuard(CONFLICTS_V2_FLAG);

  // ─── GET /api/v2/conflicts/protocol ───
  app.get('/api/v2/conflicts/protocol', flagGuard, (_req, res) => {
    sendV2Success(res, {
      protocol_version: CONFLICTS_PROTOCOL_VERSION,
      capabilities: [...CONFLICTS_V2_CAPABILITIES],
      legacy_endpoints: [],
      sources_scanned: ['availabilities', 'missions/mission_assignments', 'task_assignments'],
      docs: '/docs/api/v2/conflicts.md',
    });
  });

  // ─── POST /api/v2/conflicts/check ───
  //
  // Body attendu :
  //   {
  //     person_id: number,
  //     start_date: 'YYYY-MM-DD',
  //     end_date: 'YYYY-MM-DD',
  //     start_period?: 'AM'|'PM',
  //     end_period?: 'AM'|'PM',
  //     exclude?: [{ entity_type, entity_id }]
  //   }
  app.post('/api/v2/conflicts/check', flagGuard, authenticateToken, (req, res) => {
    try {
      const body = req.body || {};
      const result = detectPersonConflicts({
        db,
        personId: body.person_id,
        startDate: body.start_date,
        endDate: body.end_date,
        startPeriod: body.start_period,
        endPeriod: body.end_period,
        exclude: Array.isArray(body.exclude) ? body.exclude : undefined,
      });
      sendV2Success(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  });
}
