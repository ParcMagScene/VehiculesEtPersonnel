// apps/api/v2/savRoutes.js
//
// Ticket : T-P1-07 (Equipements v2 - SAV enrichi).
//
// Namespace `/api/v2/sav/*` :
//   - GET   /api/v2/sav/protocol
//   - GET   /api/v2/sav/tickets/:id/parts
//   - POST  /api/v2/sav/tickets/:id/parts
//   - PATCH /api/v2/sav/parts/:id/status
//   - POST  /api/v2/sav/tickets/:id/transition
//
// Coexistence stricte avec `/api/sav/*` v1 (savRoutes.js). Le v2
// ajoute la machine d'etat + pieces detachees. Aucune modification
// du v1.

import db from '../database.js';
import logger from '../logger.js';
import { createFeatureFlagGuard } from '../middleware/featureFlag.js';
import {
  addPart,
  ALLOWED_TRANSITIONS,
  assertTransition,
  listPartsForTicket,
  SAV_PART_STATUSES,
  SavV2ConflictError,
  SavV2NotFoundError,
  SavV2ValidationError,
  updatePartStatus,
} from '../services/sav/index.js';
import { sendV2Error, sendV2Success } from '../utils/apiV2Response.js';

/** @type {string} */
export const SAV_PROTOCOL_VERSION = '2.0.0';
/** @type {string} */
export const SAV_V2_FLAG = 'FEATURE_V2_SAV';
/** @type {ReadonlyArray<string>} */
export const SAV_V2_CAPABILITIES = Object.freeze([
  'protocol-discovery',
  'parts-list-v1',
  'parts-add-v1',
  'parts-status-update-v1',
  'ticket-transition-v1',
]);

function handleServiceError(res, err) {
  if (err instanceof SavV2ValidationError) {
    return sendV2Error(res, err.message, {
      status: 400,
      code: 'VALIDATION_ERROR',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  if (err instanceof SavV2NotFoundError) {
    return sendV2Error(res, err.message, {
      status: 404,
      code: 'NOT_FOUND',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  if (err instanceof SavV2ConflictError) {
    return sendV2Error(res, err.message, {
      status: 409,
      code: 'CONFLICT',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  logger.error('SAV v2 service error:', err);
  return sendV2Error(res, 'Erreur serveur interne', {
    status: 500,
    code: 'INTERNAL_ERROR',
  });
}

/**
 * @param {import('express').Express} app
 * @param {import('express').RequestHandler} authenticateToken
 */
export function setupSavV2Routes(app, authenticateToken) {
  if (!app || typeof app.get !== 'function') {
    throw new TypeError('setupSavV2Routes: application Express requise');
  }
  if (typeof authenticateToken !== 'function') {
    throw new TypeError('setupSavV2Routes: authenticateToken requis');
  }

  const flagGuard = createFeatureFlagGuard(SAV_V2_FLAG);

  // ─── GET /api/v2/sav/protocol ───
  app.get('/api/v2/sav/protocol', flagGuard, (_req, res) => {
    // Serialiser Set -> array pour ALLOWED_TRANSITIONS.
    const transitions = {};
    for (const [from, set] of Object.entries(ALLOWED_TRANSITIONS)) {
      transitions[from] = [...set];
    }
    sendV2Success(res, {
      protocol_version: SAV_PROTOCOL_VERSION,
      capabilities: [...SAV_V2_CAPABILITIES],
      part_statuses: [...SAV_PART_STATUSES],
      allowed_ticket_transitions: transitions,
      legacy_endpoints: ['/api/sav/*'],
      docs: '/docs/api/v2/sav.md',
    });
  });

  // ─── GET /api/v2/sav/tickets/:id/parts ───
  app.get('/api/v2/sav/tickets/:id/parts', flagGuard, authenticateToken, (req, res) => {
    try {
      const result = listPartsForTicket({ db, ticketId: Number(req.params.id) });
      sendV2Success(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── POST /api/v2/sav/tickets/:id/parts ───
  app.post('/api/v2/sav/tickets/:id/parts', flagGuard, authenticateToken, (req, res) => {
    try {
      const part = addPart({
        db,
        ticketId: Number(req.params.id),
        data: req.body || {},
        createdBy: req.user?.id ?? null,
      });
      sendV2Success(res, { part }, { status: 201 });
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── PATCH /api/v2/sav/parts/:id/status ───
  app.patch('/api/v2/sav/parts/:id/status', flagGuard, authenticateToken, (req, res) => {
    try {
      const body = req.body || {};
      const part = updatePartStatus({
        db,
        partId: Number(req.params.id),
        newStatus: body.status,
        modifiedBy: req.user?.id ?? null,
      });
      sendV2Success(res, { part });
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── POST /api/v2/sav/tickets/:id/transition ───
  //
  // Valide la transition via `assertTransition` puis applique le
  // nouveau statut sur `sav_tickets.status`. Ne touche pas aux
  // autres colonnes du ticket.
  app.post('/api/v2/sav/tickets/:id/transition', flagGuard, authenticateToken, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new SavV2ValidationError('id de ticket invalide');
      }
      const body = req.body || {};
      const to = typeof body.status === 'string' ? body.status : null;
      if (!to) throw new SavV2ValidationError('body.status requis');

      const ticket = db.prepare('SELECT id, status FROM sav_tickets WHERE id = ?').get(id);
      if (!ticket) {
        throw new SavV2NotFoundError(`Ticket SAV introuvable (id=${id})`, { ticketId: id });
      }
      assertTransition(ticket.status, to);

      db.prepare('UPDATE sav_tickets SET status = ? WHERE id = ?').run(to, id);
      const refreshed = db.prepare('SELECT id, status FROM sav_tickets WHERE id = ?').get(id);
      sendV2Success(res, {
        ticket_id: id,
        previous_status: ticket.status,
        new_status: refreshed.status,
        changed: ticket.status !== to,
      });
    } catch (err) {
      handleServiceError(res, err);
    }
  });
}
