// apps/api/v2/equipmentAssignmentsRoutes.js
//
// Ticket : T-P1-08 (Equipements v2 - assignations auditees).
//
// Namespace `/api/v2/equipment-assignments/*` :
//   - GET  /api/v2/equipment-assignments/protocol
//   - POST /api/v2/equipment/:id/assignments             (create safe)
//   - POST /api/v2/equipment-assignments/:aid/release    (libere)
//   - GET  /api/v2/equipment/:id/assignments/history     (audit)
//   - GET  /api/v2/equipment-assignments/:aid/history    (audit ciblee)
//
// Coexistence stricte avec `/api/equipment-assignments/*` v1
// (aucun bloquage sur le v1 : celui-ci accepte les
// double-assignations sans erreur, comportement historique
// conserve).

import db from '../database.js';
import logger from '../logger.js';
import { createFeatureFlagGuard } from '../middleware/featureFlag.js';
import {
  createAssignmentSafe,
  EqAssignV2ConflictError,
  EqAssignV2NotFoundError,
  EqAssignV2ValidationError,
  getAssignmentHistory,
  releaseAssignment,
} from '../services/equipment-assignments/index.js';
import { sendV2Error, sendV2Success } from '../utils/apiV2Response.js';

/** @type {string} */
export const EQ_ASSIGN_PROTOCOL_VERSION = '2.0.0';
/** @type {string} */
export const EQ_ASSIGN_V2_FLAG = 'FEATURE_V2_EQUIPMENT_ASSIGNMENTS';
/** @type {ReadonlyArray<string>} */
export const EQ_ASSIGN_V2_CAPABILITIES = Object.freeze([
  'protocol-discovery',
  'assignment-create-audited-v1',
  'assignment-release-audited-v1',
  'assignment-history-v1',
  'double-assignment-blocked-v1',
]);

function handleServiceError(res, err) {
  if (err instanceof EqAssignV2ValidationError) {
    return sendV2Error(res, err.message, {
      status: 400,
      code: 'VALIDATION_ERROR',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  if (err instanceof EqAssignV2NotFoundError) {
    return sendV2Error(res, err.message, {
      status: 404,
      code: 'NOT_FOUND',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  if (err instanceof EqAssignV2ConflictError) {
    return sendV2Error(res, err.message, {
      status: 409,
      code: 'CONFLICT',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  logger.error('EquipmentAssignments v2 service error:', err);
  return sendV2Error(res, 'Erreur serveur interne', {
    status: 500,
    code: 'INTERNAL_ERROR',
  });
}

/**
 * @param {import('express').Express} app
 * @param {import('express').RequestHandler} authenticateToken
 */
export function setupEquipmentAssignmentsV2Routes(app, authenticateToken) {
  if (!app || typeof app.get !== 'function') {
    throw new TypeError('setupEquipmentAssignmentsV2Routes: application Express requise');
  }
  if (typeof authenticateToken !== 'function') {
    throw new TypeError('setupEquipmentAssignmentsV2Routes: authenticateToken requis');
  }

  const flagGuard = createFeatureFlagGuard(EQ_ASSIGN_V2_FLAG);

  // ─── GET /api/v2/equipment-assignments/protocol ───
  app.get('/api/v2/equipment-assignments/protocol', flagGuard, (_req, res) => {
    sendV2Success(res, {
      protocol_version: EQ_ASSIGN_PROTOCOL_VERSION,
      capabilities: [...EQ_ASSIGN_V2_CAPABILITIES],
      legacy_endpoints: ['/api/equipment-assignments/*'],
      docs: '/docs/api/v2/equipment-assignments.md',
    });
  });

  // ─── POST /api/v2/equipment/:id/assignments ───
  app.post('/api/v2/equipment/:id/assignments', flagGuard, authenticateToken, (req, res) => {
    try {
      const body = req.body || {};
      const result = createAssignmentSafe({
        db,
        equipmentId: Number(req.params.id),
        assignedTo: body.assigned_to != null ? Number(body.assigned_to) : null,
        startDate: body.start_date,
        endDate: body.end_date ?? null,
        affaireId: body.affaire_id ?? null,
        notes: typeof body.notes === 'string' && body.notes.trim() !== '' ? body.notes : null,
        assignedBy: req.user?.id ?? null,
      });
      sendV2Success(res, result, { status: 201 });
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── POST /api/v2/equipment-assignments/:aid/release ───
  app.post(
    '/api/v2/equipment-assignments/:aid/release',
    flagGuard,
    authenticateToken,
    (req, res) => {
      try {
        const body = req.body || {};
        const result = releaseAssignment({
          db,
          assignmentId: Number(req.params.aid),
          releaseDate: body.release_date ?? null,
          releasedBy: req.user?.id ?? null,
          notes: typeof body.notes === 'string' && body.notes.trim() !== '' ? body.notes : null,
        });
        sendV2Success(res, result);
      } catch (err) {
        handleServiceError(res, err);
      }
    },
  );

  // ─── GET /api/v2/equipment/:id/assignments/history ───
  app.get('/api/v2/equipment/:id/assignments/history', flagGuard, authenticateToken, (req, res) => {
    try {
      const result = getAssignmentHistory({
        db,
        equipmentId: Number(req.params.id),
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      sendV2Success(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── GET /api/v2/equipment-assignments/:aid/history ───
  app.get(
    '/api/v2/equipment-assignments/:aid/history',
    flagGuard,
    authenticateToken,
    (req, res) => {
      try {
        const result = getAssignmentHistory({
          db,
          assignmentId: Number(req.params.aid),
          limit: req.query.limit ? Number(req.query.limit) : undefined,
        });
        sendV2Success(res, result);
      } catch (err) {
        handleServiceError(res, err);
      }
    },
  );
}
