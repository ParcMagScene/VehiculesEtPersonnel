// apps/api/v2/equipmentUidRoutes.js
//
// Ticket : T-P1-06 (Equipements v2 - UID / serials controles).
//
// Namespace `/api/v2/equipment-uid/*` :
//   - GET  /api/v2/equipment-uid/protocol
//   - GET  /api/v2/equipment-uid/audit                          (admin)
//   - POST /api/v2/equipment/:id/regenerate-uid                 (admin)
//
// Note nommage : le premier bloc utilise le prefixe
// `/api/v2/equipment-uid/*` pour eviter la collision avec le
// namespace `/api/v2/equipment/:id/location` livre en T-P0-12.
// Le POST regenerate reste sous /api/v2/equipment/:id/... pour
// coherence avec la ressource equipment.
//
// Coexistence stricte avec les endpoints v1 equipment (aucune
// modification, aucun bloquage).

import db from '../database.js';
import logger from '../logger.js';
import { createFeatureFlagGuard } from '../middleware/featureFlag.js';
import {
  auditUidState,
  EquipmentUidV2ConflictError,
  EquipmentUidV2NotFoundError,
  EquipmentUidV2ValidationError,
  regenerateEquipmentUid,
} from '../services/equipment-uid/index.js';
import { sendV2Error, sendV2Success } from '../utils/apiV2Response.js';

/** @type {string} */
export const EQUIPMENT_UID_PROTOCOL_VERSION = '2.0.0';

/** @type {string} */
export const EQUIPMENT_UID_V2_FLAG = 'FEATURE_V2_EQUIPMENT_UID';

/** @type {ReadonlyArray<string>} */
export const EQUIPMENT_UID_V2_CAPABILITIES = Object.freeze([
  'protocol-discovery',
  'uid-audit-v1',
  'uid-regenerate-v1',
]);

function handleServiceError(res, err) {
  if (err instanceof EquipmentUidV2ValidationError) {
    return sendV2Error(res, err.message, {
      status: 400,
      code: 'VALIDATION_ERROR',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  if (err instanceof EquipmentUidV2NotFoundError) {
    return sendV2Error(res, err.message, {
      status: 404,
      code: 'NOT_FOUND',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  if (err instanceof EquipmentUidV2ConflictError) {
    return sendV2Error(res, err.message, {
      status: 409,
      code: 'CONFLICT',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  logger.error('EquipmentUid v2 service error:', err);
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
export function setupEquipmentUidV2Routes(app, authenticateToken, requireAdmin) {
  if (!app || typeof app.get !== 'function') {
    throw new TypeError('setupEquipmentUidV2Routes: application Express requise');
  }
  if (typeof authenticateToken !== 'function') {
    throw new TypeError('setupEquipmentUidV2Routes: authenticateToken requis');
  }

  const flagGuard = createFeatureFlagGuard(EQUIPMENT_UID_V2_FLAG);

  // ─── GET /api/v2/equipment-uid/protocol ───
  app.get('/api/v2/equipment-uid/protocol', flagGuard, (_req, res) => {
    sendV2Success(res, {
      protocol_version: EQUIPMENT_UID_PROTOCOL_VERSION,
      capabilities: [...EQUIPMENT_UID_V2_CAPABILITIES],
      legacy_endpoints: [],
      docs: '/docs/api/v2/equipment-uid.md',
    });
  });

  // ─── GET /api/v2/equipment-uid/audit ───
  const auditMw = [flagGuard, authenticateToken];
  if (typeof requireAdmin === 'function') auditMw.push(requireAdmin);
  app.get('/api/v2/equipment-uid/audit', ...auditMw, (_req, res) => {
    try {
      const audit = auditUidState(db);
      sendV2Success(res, audit);
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── POST /api/v2/equipment/:id/regenerate-uid ───
  const regenMw = [flagGuard, authenticateToken];
  if (typeof requireAdmin === 'function') regenMw.push(requireAdmin);
  app.post('/api/v2/equipment/:id/regenerate-uid', ...regenMw, (req, res) => {
    try {
      const body = req.body || {};
      const result = regenerateEquipmentUid({
        db,
        equipmentId: req.params.id,
        regeneratedBy: req.user?.id ?? null,
        reason: typeof body.reason === 'string' && body.reason.trim() !== '' ? body.reason : null,
      });
      sendV2Success(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  });
}
