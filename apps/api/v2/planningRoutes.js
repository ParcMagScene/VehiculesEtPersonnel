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
import { listTasks, PlanningV2ValidationError } from '../services/planning/tasks.js';
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

  logger.info(
    `  ✅ Planning v2 API mounted at /api/v2/planning/tasks (guarded by ${PLANNING_V2_FLAG})`,
  );
}
