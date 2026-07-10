// apps/api/v2/leavesRoutes.js
//
// Ticket : T-P1-04 (Personnel v2 - solde conges cote serveur).
//
// Namespace `/api/v2/leaves/*` - endpoints livres :
//   - GET  /api/v2/leaves/protocol
//   - POST /api/v2/leaves/calculate           (miroir v1 avec payload v2)
//   - GET  /api/v2/leaves/balance/mine        (self-service)
//   - GET  /api/v2/leaves/balance/:person_id  (admin)
//
// Coexistence stricte avec `/api/leaves/*` v1 (endpoint POST
// /api/leaves/calculate reste actif, ainsi que /api/leaves/mine et
// /api/leaves/balances). La v2 introduit un self-service `balance/mine`
// qui n'existe pas en v1 (le v1 admin-only `balances` retourne tous
// les soldes).

import db from '../database.js';
import logger from '../logger.js';
import { createFeatureFlagGuard } from '../middleware/featureFlag.js';
import {
  calculateLeavePeriod,
  getBalanceForPerson,
  LeavesV2NotFoundError,
  LeavesV2ValidationError,
  resolvePersonIdFromUser,
} from '../services/leaves/index.js';
import { sendV2Error, sendV2Success } from '../utils/apiV2Response.js';

/** Version protocolaire du namespace Leaves v2. @type {string} */
export const LEAVES_PROTOCOL_VERSION = '2.0.0';

/** Nom canonique du feature flag. @type {string} */
export const LEAVES_V2_FLAG = 'FEATURE_V2_LEAVES';

/** Capacites annoncees. @type {ReadonlyArray<string>} */
export const LEAVES_V2_CAPABILITIES = Object.freeze([
  'protocol-discovery',
  'calculate-period-v1',
  'balance-self-service-v1',
  'balance-admin-v1',
]);

function handleServiceError(res, err) {
  if (err instanceof LeavesV2ValidationError) {
    return sendV2Error(res, err.message, {
      status: 400,
      code: 'VALIDATION_ERROR',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  if (err instanceof LeavesV2NotFoundError) {
    return sendV2Error(res, err.message, {
      status: 404,
      code: 'NOT_FOUND',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  logger.error('Leaves v2 service error:', err);
  return sendV2Error(res, 'Erreur serveur interne', {
    status: 500,
    code: 'INTERNAL_ERROR',
  });
}

/**
 * @param {import('express').Express} app
 * @param {import('express').RequestHandler} authenticateToken
 * @param {import('express').RequestHandler} [requireAdmin]
 */
export function setupLeavesV2Routes(app, authenticateToken, requireAdmin) {
  if (!app || typeof app.get !== 'function') {
    throw new TypeError('setupLeavesV2Routes: application Express requise');
  }
  if (typeof authenticateToken !== 'function') {
    throw new TypeError('setupLeavesV2Routes: authenticateToken requis');
  }

  const flagGuard = createFeatureFlagGuard(LEAVES_V2_FLAG);

  // ─── GET /api/v2/leaves/protocol ───
  app.get('/api/v2/leaves/protocol', flagGuard, (_req, res) => {
    sendV2Success(res, {
      protocol_version: LEAVES_PROTOCOL_VERSION,
      capabilities: [...LEAVES_V2_CAPABILITIES],
      legacy_endpoints: ['/api/leaves/calculate', '/api/leaves/mine', '/api/leaves/balances'],
      docs: '/docs/api/v2/leaves.md',
    });
  });

  // ─── POST /api/v2/leaves/calculate ───
  app.post('/api/v2/leaves/calculate', flagGuard, authenticateToken, (req, res) => {
    try {
      const body = req.body || {};
      const result = calculateLeavePeriod({
        db,
        startDate: body.startDate,
        endDate: body.endDate,
        startPeriod: body.startPeriod,
        endPeriod: body.endPeriod,
        leaveType: body.leaveType,
        exceptionalType: body.exceptionalType,
        requestDate: body.requestDate,
      });
      sendV2Success(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── GET /api/v2/leaves/balance/mine ───
  // Query : ?year=YYYY&type=conge_paye (defauts : annee courante,
  // type conge_paye).
  app.get('/api/v2/leaves/balance/mine', flagGuard, authenticateToken, (req, res) => {
    try {
      const personId = resolvePersonIdFromUser({ db, userId: req.user?.id });
      const balance = getBalanceForPerson({
        db,
        personId,
        year: req.query.year ? Number(req.query.year) : undefined,
        type: typeof req.query.type === 'string' ? req.query.type : undefined,
      });
      sendV2Success(res, { balance });
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── GET /api/v2/leaves/balance/:person_id ───
  // Admin uniquement (requireAdmin optionnel : si absent, retombe
  // sur authenticateToken pour permettre les tests unitaires).
  const balancePersonMiddlewares = [flagGuard, authenticateToken];
  if (typeof requireAdmin === 'function') balancePersonMiddlewares.push(requireAdmin);
  app.get('/api/v2/leaves/balance/:person_id', ...balancePersonMiddlewares, (req, res) => {
    try {
      const personId = Number(req.params.person_id);
      if (!Number.isInteger(personId) || personId <= 0) {
        throw new LeavesV2ValidationError('person_id doit etre un entier > 0');
      }
      const balance = getBalanceForPerson({
        db,
        personId,
        year: req.query.year ? Number(req.query.year) : undefined,
        type: typeof req.query.type === 'string' ? req.query.type : undefined,
      });
      sendV2Success(res, { balance });
    } catch (err) {
      handleServiceError(res, err);
    }
  });
}
