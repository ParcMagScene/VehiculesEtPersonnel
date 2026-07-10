// apps/api/v2/locationsRoutes.js
//
// Ticket : T-P0-12 (P0 Localisation v2 - API + UI EquipmentPanel v2).
//
// Namespace `/api/v2/locations/*` — endpoints livres :
//   - GET   /api/v2/locations/protocol
//   - GET   /api/v2/locations/depots
//   - GET   /api/v2/locations/depots/:depot_id
//   - PATCH /api/v2/equipment/:id/location
//
// Coexistence stricte avec les endpoints inventaire v1
// (`/api/equipment-depot-zones`, `/api/equipment-all-depot-zones`,
// `/api/catalog/equipment/zones`) qui restent actifs.
//
// Voir docs/05-Specs/LOCATIONS_V2.md et docs/api/v2/locations.md.

import db from '../database.js';
import logger from '../logger.js';
import { createFeatureFlagGuard } from '../middleware/featureFlag.js';
import {
  getDepotById,
  listDepots,
  LOCATION_FIELDS,
  LocationsV2ConflictError,
  LocationsV2NotFoundError,
  LocationsV2ValidationError,
  updateEquipmentLocation,
} from '../services/locations/index.js';
import { sendV2Error, sendV2Success } from '../utils/apiV2Response.js';

/**
 * Version du protocole Locations v2. Distincte de
 * `API_V2_PROTOCOL_VERSION` (wrapper API v2 commun) et de
 * `DISPLAY_PROTOCOL_VERSION` (protocole TV).
 * @type {string}
 */
export const LOCATIONS_PROTOCOL_VERSION = '2.0.0';

/**
 * Nom canonique du feature flag serveur.
 * @type {string}
 */
export const LOCATIONS_V2_FLAG = 'FEATURE_V2_LOCATIONS';

/**
 * Capacites annoncees par le protocole v2. Kebab-case stables.
 * @type {ReadonlyArray<string>}
 */
export const LOCATIONS_V2_CAPABILITIES = Object.freeze([
  'protocol-discovery', // GET /protocol repond
  'depots-list-v1', // GET /depots retourne la liste compacte
  'depot-detail-v1', // GET /depots/:id retourne floors/categories/zones
  'equipment-location-patch-v1', // PATCH /equipment/:id/location + history
]);

/**
 * Traduit une erreur typee du service en reponse HTTP v2.
 */
function handleServiceError(res, err) {
  if (err instanceof LocationsV2ValidationError) {
    return sendV2Error(res, err.message, {
      status: 400,
      code: 'VALIDATION_ERROR',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  if (err instanceof LocationsV2NotFoundError) {
    return sendV2Error(res, err.message, {
      status: 404,
      code: 'NOT_FOUND',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  if (err instanceof LocationsV2ConflictError) {
    return sendV2Error(res, err.message, {
      status: 409,
      code: 'CONFLICT',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  logger.error('Locations v2 service error:', err);
  return sendV2Error(res, 'Erreur serveur interne', {
    status: 500,
    code: 'INTERNAL_ERROR',
  });
}

/**
 * Enregistre les routes v2 Locations sur l'application Express.
 * @param {import('express').Express} app
 * @param {import('express').RequestHandler} authenticateToken
 * @param {import('express').RequestHandler} [requireAdmin]  Optionnel :
 *   si fourni, le PATCH equipment/:id/location est gate.
 * @returns {void}
 */
export function setupLocationsV2Routes(app, authenticateToken, requireAdmin) {
  if (!app || typeof app.get !== 'function') {
    throw new TypeError('setupLocationsV2Routes: application Express requise');
  }
  if (typeof authenticateToken !== 'function') {
    throw new TypeError('setupLocationsV2Routes: authenticateToken requis');
  }

  const flagGuard = createFeatureFlagGuard(LOCATIONS_V2_FLAG);

  // ─── GET /api/v2/locations/protocol ───
  app.get('/api/v2/locations/protocol', flagGuard, (_req, res) => {
    sendV2Success(res, {
      protocol_version: LOCATIONS_PROTOCOL_VERSION,
      capabilities: [...LOCATIONS_V2_CAPABILITIES],
      legacy_endpoints: [
        '/api/equipment-depot-zones',
        '/api/equipment-all-depot-zones',
        '/api/catalog/equipment/zones',
      ],
      docs: '/docs/api/v2/locations.md',
    });
  });

  // ─── GET /api/v2/locations/depots ───
  app.get('/api/v2/locations/depots', flagGuard, authenticateToken, (_req, res) => {
    try {
      const result = listDepots({ db });
      sendV2Success(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── GET /api/v2/locations/depots/:depot_id ───
  app.get('/api/v2/locations/depots/:depot_id', flagGuard, authenticateToken, (req, res) => {
    try {
      const result = getDepotById({ db, depotId: req.params.depot_id });
      sendV2Success(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── PATCH /api/v2/equipment/:id/location ───
  // Autorisation minimum : authenticateToken. Requeurir admin est
  // deliberement optionnel pour permettre un mode "self-serve" ou un
  // profil equipe modifie sa propre localisation, si autorise dans le
  // ticket UI dedie (T-P0-12b).
  const patchMiddlewares = [flagGuard, authenticateToken];
  if (typeof requireAdmin === 'function') patchMiddlewares.push(requireAdmin);

  app.patch('/api/v2/equipment/:id/location', ...patchMiddlewares, (req, res) => {
    try {
      const body = req.body || {};
      const patch = {};
      for (const field of LOCATION_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          patch[field] = body[field];
        }
      }
      const result = updateEquipmentLocation({
        db,
        equipmentId: req.params.id,
        patch,
        movedBy: req.user?.id ?? null,
        notes: typeof body.notes === 'string' ? body.notes : null,
        options: { strict: body.strict === true },
      });
      sendV2Success(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  });
}
