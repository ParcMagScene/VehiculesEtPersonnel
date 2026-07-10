// apps/api/v2/ordersRoutes.js
//
// Ticket : T-P1-09 (Commandes v2 - cycle achat).
//
// Namespace `/api/v2/orders/*` + `/api/v2/quotes/*` :
//   - GET  /api/v2/orders/protocol
//   - POST /api/v2/orders/:id/transition
//   - POST /api/v2/quotes/:id/transition
//
// Coexistence stricte avec `/api/orders/*` et `/api/quotes/*` v1.

import db from '../database.js';
import logger from '../logger.js';
import { createFeatureFlagGuard } from '../middleware/featureFlag.js';
import {
  ORDER_TRANSITIONS,
  OrdersV2ConflictError,
  OrdersV2NotFoundError,
  OrdersV2ValidationError,
  QUOTE_TRANSITIONS,
  transitionOrder,
  transitionQuote,
} from '../services/orders/index.js';
import { sendV2Error, sendV2Success } from '../utils/apiV2Response.js';

/** @type {string} */
export const ORDERS_PROTOCOL_VERSION = '2.0.0';
/** @type {string} */
export const ORDERS_V2_FLAG = 'FEATURE_V2_ORDERS';
/** @type {ReadonlyArray<string>} */
export const ORDERS_V2_CAPABILITIES = Object.freeze([
  'protocol-discovery',
  'order-transition-v1',
  'quote-transition-v1',
]);

function handleServiceError(res, err) {
  if (err instanceof OrdersV2ValidationError) {
    return sendV2Error(res, err.message, {
      status: 400,
      code: 'VALIDATION_ERROR',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  if (err instanceof OrdersV2NotFoundError) {
    return sendV2Error(res, err.message, {
      status: 404,
      code: 'NOT_FOUND',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  if (err instanceof OrdersV2ConflictError) {
    return sendV2Error(res, err.message, {
      status: 409,
      code: 'CONFLICT',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  logger.error('Orders v2 service error:', err);
  return sendV2Error(res, 'Erreur serveur interne', {
    status: 500,
    code: 'INTERNAL_ERROR',
  });
}

/**
 * @param {import('express').Express} app
 * @param {import('express').RequestHandler} authenticateToken
 */
export function setupOrdersV2Routes(app, authenticateToken) {
  if (!app || typeof app.get !== 'function') {
    throw new TypeError('setupOrdersV2Routes: application Express requise');
  }
  if (typeof authenticateToken !== 'function') {
    throw new TypeError('setupOrdersV2Routes: authenticateToken requis');
  }

  const flagGuard = createFeatureFlagGuard(ORDERS_V2_FLAG);

  // ─── GET /api/v2/orders/protocol ───
  app.get('/api/v2/orders/protocol', flagGuard, (_req, res) => {
    sendV2Success(res, {
      protocol_version: ORDERS_PROTOCOL_VERSION,
      capabilities: [...ORDERS_V2_CAPABILITIES],
      order_transitions: { ...ORDER_TRANSITIONS },
      quote_transitions: { ...QUOTE_TRANSITIONS },
      legacy_endpoints: ['/api/orders/*', '/api/quotes/*'],
      docs: '/docs/api/v2/orders.md',
    });
  });

  // ─── POST /api/v2/orders/:id/transition ───
  app.post('/api/v2/orders/:id/transition', flagGuard, authenticateToken, (req, res) => {
    try {
      const body = req.body || {};
      const result = transitionOrder({
        db,
        orderId: Number(req.params.id),
        newStatus: body.status,
      });
      sendV2Success(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── POST /api/v2/quotes/:id/transition ───
  app.post('/api/v2/quotes/:id/transition', flagGuard, authenticateToken, (req, res) => {
    try {
      const body = req.body || {};
      const result = transitionQuote({
        db,
        quoteId: Number(req.params.id),
        newStatus: body.status,
      });
      sendV2Success(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  });
}
