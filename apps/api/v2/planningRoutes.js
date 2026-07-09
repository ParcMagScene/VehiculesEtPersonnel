// ═══════════════════════════════════════════════════════════════
// v2/planningRoutes.js
//
// Ticket : T-P0-03 (Planning v2 — API v2 lecture)
//
// Routes REST du namespace `/api/v2/planning/*`. Chaque route est
// protégée par :
//   1. `featureFlagGuard('FEATURE_V2_PLANNING')` — 404 si le flag
//      serveur est off. Placé AVANT `authenticateToken` pour ne
//      jamais exposer l'existence de la route derrière le flag.
//   2. `authenticateToken` — JWT httpOnly + session DB.
//
// À ce stade (T-P0-03), seule la lecture est exposée. Les mutations
// arriveront avec T-P0-04.
//
// La v1 (`/api/planning/*` via `planningRoutes.js`) n'est jamais
// modifiée ni contournée. Coexistence stricte v1 / v2.
// ═══════════════════════════════════════════════════════════════

import db from '../database.js';
import logger from '../logger.js';
import { createFeatureFlagGuard } from '../middleware/featureFlag.js';
import {
  clearCompletedTasksSchema,
  createTasksBatchSchema,
  createTaskSchema,
  rolloverTasksSchema,
  updateTaskSchema,
} from '../schemas/planningV2.js';
import {
  clearCompletedTasks,
  createTask,
  createTasksBatch,
  deleteTask,
  getTaskById,
  listTasks,
  PlanningV2ValidationError,
  rolloverIncompleteTasks,
  updateTask,
} from '../services/planning/tasks.js';
import { buildV2Pagination, sendV2Error, sendV2Success } from '../utils/apiV2Response.js';

const PLANNING_V2_FLAG = 'FEATURE_V2_PLANNING';

/**
 * Monte les routes v2 lecture du Planning sur l'application Express.
 * Aucune route côté v1 n'est touchée.
 *
 * @param {import('express').Application} app
 * @param {import('express').RequestHandler} authenticateToken Middleware d'auth
 *   (celui utilisé pour les routes v1). Injecté pour éviter tout couplage
 *   circulaire avec `middleware/authenticate.js`.
 * @returns {void}
 */
export function setupPlanningV2Routes(app, authenticateToken) {
  if (!app || typeof app.get !== 'function') {
    throw new TypeError('setupPlanningV2Routes: application Express requise');
  }
  if (typeof authenticateToken !== 'function') {
    throw new TypeError('setupPlanningV2Routes: authenticateToken requis');
  }

  const flagGuard = createFeatureFlagGuard(PLANNING_V2_FLAG);

  // ─── GET /api/v2/planning/tasks ───
  // Lecture cursor-based des tâches. Filtres serveur, tri stable,
  // limit borné. Format réponse v2 : { success, data, meta }.
  app.get('/api/v2/planning/tasks', flagGuard, authenticateToken, (req, res) => {
    const cursorParam =
      typeof req.query.cursor === 'string' && req.query.cursor.length > 0 ? req.query.cursor : null;

    let result;
    try {
      result = listTasks({
        db,
        filters: {
          person_id: req.query.person_id,
          section: req.query.section,
          date_from: req.query.date_from,
          date_to: req.query.date_to,
          status: req.query.status,
          visible: req.query.visible,
          affaire_num: req.query.affaire_num,
        },
        cursor: cursorParam,
        limit: req.query.limit,
      });
    } catch (error) {
      if (error instanceof PlanningV2ValidationError) {
        return sendV2Error(res, error.message, {
          status: 400,
          code: error.code,
          meta: { field: error.field },
        });
      }
      logger.error('GET /api/v2/planning/tasks error:', error);
      return sendV2Error(res, 'Erreur serveur interne', {
        status: 500,
        code: 'INTERNAL_ERROR',
      });
    }

    return sendV2Success(res, result.items, {
      meta: {
        ...buildV2Pagination({
          cursor: cursorParam,
          nextCursor: result.next_cursor,
          limit: result.limit,
          hasMore: result.has_more,
        }),
        count: result.items.length,
      },
    });
  });

  // ─── GET /api/v2/planning/tasks/:id ───
  // Détail d'une tâche par identifiant (TEXT UUID hex).
  app.get('/api/v2/planning/tasks/:id', flagGuard, authenticateToken, (req, res) => {
    try {
      const task = getTaskById({ db, id: req.params.id });
      if (!task) {
        return sendV2Error(res, 'Tâche introuvable', { status: 404, code: 'NOT_FOUND' });
      }
      return sendV2Success(res, task);
    } catch (error) {
      if (error instanceof PlanningV2ValidationError) {
        return sendV2Error(res, error.message, {
          status: 400,
          code: error.code,
          meta: { field: error.field },
        });
      }
      logger.error('GET /api/v2/planning/tasks/:id error:', error);
      return sendV2Error(res, 'Erreur serveur interne', { status: 500, code: 'INTERNAL_ERROR' });
    }
  });

  // ─── POST /api/v2/planning/tasks ───
  // Création d'une tâche. L'id est généré côté SQLite (UUID hex).
  app.post('/api/v2/planning/tasks', flagGuard, authenticateToken, (req, res) => {
    const parsed = createTaskSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'root',
        message: issue.message,
      }));
      return sendV2Error(res, 'Payload invalide', {
        status: 400,
        code: 'VALIDATION_ERROR',
        meta: { issues },
      });
    }
    try {
      const created = createTask({
        db,
        data: parsed.data,
        createdBy: req.user && Number.isInteger(req.user.id) ? req.user.id : null,
      });
      return sendV2Success(res, created, { status: 201 });
    } catch (error) {
      if (error instanceof PlanningV2ValidationError) {
        return sendV2Error(res, error.message, {
          status: 400,
          code: error.code,
          meta: { field: error.field },
        });
      }
      logger.error('POST /api/v2/planning/tasks error:', error);
      return sendV2Error(res, 'Erreur serveur interne', { status: 500, code: 'INTERNAL_ERROR' });
    }
  });

  // ─── PUT /api/v2/planning/tasks/:id ───
  // Mise à jour partielle. Rejette les transitions de statut invalides (400).
  app.put('/api/v2/planning/tasks/:id', flagGuard, authenticateToken, (req, res) => {
    const parsed = updateTaskSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'root',
        message: issue.message,
      }));
      return sendV2Error(res, 'Payload invalide', {
        status: 400,
        code: 'VALIDATION_ERROR',
        meta: { issues },
      });
    }
    try {
      const updated = updateTask({
        db,
        id: req.params.id,
        data: parsed.data,
        modifiedBy: req.user && Number.isInteger(req.user.id) ? req.user.id : null,
      });
      if (!updated) {
        return sendV2Error(res, 'Tâche introuvable', { status: 404, code: 'NOT_FOUND' });
      }
      return sendV2Success(res, updated);
    } catch (error) {
      if (error instanceof PlanningV2ValidationError) {
        return sendV2Error(res, error.message, {
          status: 400,
          code: error.code,
          meta: { field: error.field },
        });
      }
      logger.error('PUT /api/v2/planning/tasks/:id error:', error);
      return sendV2Error(res, 'Erreur serveur interne', { status: 500, code: 'INTERNAL_ERROR' });
    }
  });

  // ─── DELETE /api/v2/planning/tasks/:id ───
  app.delete('/api/v2/planning/tasks/:id', flagGuard, authenticateToken, (req, res) => {
    try {
      const deleted = deleteTask({ db, id: req.params.id });
      if (!deleted) {
        return sendV2Error(res, 'Tâche introuvable', { status: 404, code: 'NOT_FOUND' });
      }
      return sendV2Success(res, { id: req.params.id, deleted: true });
    } catch (error) {
      if (error instanceof PlanningV2ValidationError) {
        return sendV2Error(res, error.message, {
          status: 400,
          code: error.code,
          meta: { field: error.field },
        });
      }
      logger.error('DELETE /api/v2/planning/tasks/:id error:', error);
      return sendV2Error(res, 'Erreur serveur interne', { status: 500, code: 'INTERNAL_ERROR' });
    }
  });

  // ─── POST /api/v2/planning/tasks/batch ───
  // Création en lot (1..100 items). Transaction atomique : rollback si un
  // item invalide est détecté par le service.
  app.post('/api/v2/planning/tasks/batch', flagGuard, authenticateToken, (req, res) => {
    const parsed = createTasksBatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'root',
        message: issue.message,
      }));
      return sendV2Error(res, 'Payload invalide', {
        status: 400,
        code: 'VALIDATION_ERROR',
        meta: { issues },
      });
    }
    try {
      const result = createTasksBatch({
        db,
        items: parsed.data.items,
        createdBy: req.user && Number.isInteger(req.user.id) ? req.user.id : null,
      });
      return sendV2Success(res, result, { status: 201 });
    } catch (error) {
      if (error instanceof PlanningV2ValidationError) {
        return sendV2Error(res, error.message, {
          status: 400,
          code: error.code,
          meta: { field: error.field },
        });
      }
      logger.error('POST /api/v2/planning/tasks/batch error:', error);
      return sendV2Error(res, 'Erreur serveur interne', { status: 500, code: 'INTERNAL_ERROR' });
    }
  });

  // ─── POST /api/v2/planning/tasks/clear-completed ───
  // Archive/supprime les tâches terminées (status='done'). Filtres
  // optionnels (date, date_before, section). Sans filtre = purge globale
  // des tâches done (opération d'administration).
  app.post('/api/v2/planning/tasks/clear-completed', flagGuard, authenticateToken, (req, res) => {
    const parsed = clearCompletedTasksSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'root',
        message: issue.message,
      }));
      return sendV2Error(res, 'Payload invalide', {
        status: 400,
        code: 'VALIDATION_ERROR',
        meta: { issues },
      });
    }
    try {
      const result = clearCompletedTasks({
        db,
        date: parsed.data.date,
        dateBefore: parsed.data.date_before,
        section: parsed.data.section,
      });
      return sendV2Success(res, result);
    } catch (error) {
      if (error instanceof PlanningV2ValidationError) {
        return sendV2Error(res, error.message, {
          status: 400,
          code: error.code,
          meta: { field: error.field },
        });
      }
      logger.error('POST /api/v2/planning/tasks/clear-completed error:', error);
      return sendV2Error(res, 'Erreur serveur interne', { status: 500, code: 'INTERNAL_ERROR' });
    }
  });

  // ─── POST /api/v2/planning/tasks/rollover ───
  // Rollover : déplace les tâches non-terminées (pending, in_progress)
  // d'une date source vers J+1 (ou une date cible explicite). Réutilise
  // addOneDayToDateStr (services/planningRolloverHelpers.js) via le service.
  app.post('/api/v2/planning/tasks/rollover', flagGuard, authenticateToken, (req, res) => {
    const parsed = rolloverTasksSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'root',
        message: issue.message,
      }));
      return sendV2Error(res, 'Payload invalide', {
        status: 400,
        code: 'VALIDATION_ERROR',
        meta: { issues },
      });
    }
    try {
      const result = rolloverIncompleteTasks({
        db,
        fromDate: parsed.data.from_date,
        toDate: parsed.data.to_date,
        eligibleStatuses: parsed.data.eligible_statuses,
        modifiedBy: req.user && Number.isInteger(req.user.id) ? req.user.id : null,
      });
      return sendV2Success(res, result);
    } catch (error) {
      if (error instanceof PlanningV2ValidationError) {
        return sendV2Error(res, error.message, {
          status: 400,
          code: error.code,
          meta: { field: error.field },
        });
      }
      logger.error('POST /api/v2/planning/tasks/rollover error:', error);
      return sendV2Error(res, 'Erreur serveur interne', { status: 500, code: 'INTERNAL_ERROR' });
    }
  });

  logger.info(
    `  ✅ Planning v2 API mounted at /api/v2/planning/tasks (guarded by ${PLANNING_V2_FLAG})`,
  );
}
