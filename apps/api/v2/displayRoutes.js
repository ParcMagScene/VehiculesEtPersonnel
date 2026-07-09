// apps/api/v2/displayRoutes.js
//
// Ticket : EXECUTION_PLAN_EMAG_3_0.md T-P0-14 (P0 Display v2 API versionnee).
//          EXECUTION_PLAN_EMAG_3_0.md T-P0-15 (P0 DisplayService interne).
//
// Namespace `/api/v2/display/*` — endpoints livres :
//   - GET /api/v2/display/protocol       (T-P0-14, public discovery)
//   - GET /api/v2/display/config         (T-P0-15, auth, service `getScreenConfig`)
//   - GET /api/v2/display/content        (T-P0-15, auth, service `getPlaylistContent`)
//   - GET /api/v2/display/signals        (T-P0-15, auth, service `getSignalsForScreen`)
//
// Coexistence stricte avec `displayRoutes.js` v1 : les endpoints v1
// (`/api/display/*`) restent intacts et actifs. Le TV-client v1
// continue de les consommer directement.
//
// Voir docs/05-Specs/DISPLAY_V2.md.

import db from '../database.js';
import logger from '../logger.js';
import { createFeatureFlagGuard } from '../middleware/featureFlag.js';
import {
  DisplayV2NotFoundError,
  DisplayV2ValidationError,
  getPlaylistContent,
  getScreenConfig,
  getSignalsForScreen,
} from '../services/display/index.js';
import { sendV2Error, sendV2Success } from '../utils/apiV2Response.js';

/**
 * Version du protocole TV/Display v2. Utilisee par le TV-client pour
 * negocier les capacites. **Ne pas confondre** avec
 * `API_V2_PROTOCOL_VERSION` (numero de protocole des reponses API v2
 * en general).
 *
 * @type {string}
 */
export const DISPLAY_PROTOCOL_VERSION = '2.0.0';

/**
 * Nom canonique du feature flag serveur qui gate le namespace v2.
 * @type {string}
 */
export const DISPLAY_V2_FLAG = 'FEATURE_V2_DISPLAY';

/**
 * Capacites annoncees par le protocole v2 pour negociation client.
 * Chaque entree est un capability key stable (kebab-case). Le client
 * TV peut degrader gracieusement si une capability manque.
 *
 * @type {ReadonlyArray<string>}
 */
export const DISPLAY_V2_CAPABILITIES = Object.freeze([
  'protocol-discovery', // GET /protocol repond
  'screen-config-v1', // GET /config?screen_id retourne screen + playlist + appearance
  'playlist-content-v1', // GET /content?playlist_id retourne items ordonnes avec item_name
  'screen-signals-v1', // GET /signals?screen_id retourne messages actifs + welcome + heartbeat
]);

/**
 * Traduit une erreur typee du service Display en reponse HTTP v2.
 * @param {import('express').Response} res
 * @param {Error} err
 */
function handleServiceError(res, err) {
  if (err instanceof DisplayV2ValidationError) {
    return sendV2Error(res, err.message, {
      status: 400,
      code: 'VALIDATION_ERROR',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  if (err instanceof DisplayV2NotFoundError) {
    return sendV2Error(res, err.message, {
      status: 404,
      code: 'NOT_FOUND',
      meta: err.details ? { details: err.details } : undefined,
    });
  }
  logger.error('Display v2 service error:', err);
  return sendV2Error(res, 'Erreur serveur interne', {
    status: 500,
    code: 'INTERNAL_ERROR',
  });
}

/**
 * Enregistre les routes v2 Display sur l'application Express.
 * @param {import('express').Express} app
 * @param {import('express').RequestHandler} authenticateToken
 * @returns {void}
 */
export function setupDisplayV2Routes(app, authenticateToken) {
  if (!app || typeof app.get !== 'function') {
    throw new TypeError('setupDisplayV2Routes: application Express requise');
  }
  if (typeof authenticateToken !== 'function') {
    throw new TypeError('setupDisplayV2Routes: authenticateToken requis');
  }

  const flagGuard = createFeatureFlagGuard(DISPLAY_V2_FLAG);

  // ─── GET /api/v2/display/protocol ───
  // Discovery endpoint public : pas d'authentification requise.
  // Permet a un TV-client de negocier le protocole et connaitre les
  // capacites avant meme d'avoir un token.
  app.get('/api/v2/display/protocol', flagGuard, (_req, res) => {
    sendV2Success(res, {
      protocol_version: DISPLAY_PROTOCOL_VERSION,
      capabilities: [...DISPLAY_V2_CAPABILITIES],
      legacy_namespace: '/api/display',
      docs: '/docs/api/v2/display.md',
    });
  });

  // ─── GET /api/v2/display/config?screen_id=<id> ───
  // T-P0-15 : retourne la config complete d'un ecran (screen + playlist
  // affectee + appearance). Le TV-client v2 negocie son affichage a
  // partir de cette reponse.
  app.get('/api/v2/display/config', flagGuard, authenticateToken, (req, res) => {
    try {
      const result = getScreenConfig({ db, screenId: req.query.screen_id });
      sendV2Success(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── GET /api/v2/display/content?playlist_id=<id> ───
  // T-P0-15 : retourne le contenu ordonne d'une playlist (items +
  // item_name resolu selon item_type).
  app.get('/api/v2/display/content', flagGuard, authenticateToken, (req, res) => {
    try {
      const result = getPlaylistContent({ db, playlistId: req.query.playlist_id });
      sendV2Success(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  // ─── GET /api/v2/display/signals?screen_id=<id> ───
  // T-P0-15 : retourne les signaux temps-reel (messages actifs, welcome
  // message du creneau courant, heartbeat de reference).
  app.get('/api/v2/display/signals', flagGuard, authenticateToken, (req, res) => {
    try {
      const result = getSignalsForScreen({ db, screenId: req.query.screen_id });
      sendV2Success(res, result);
    } catch (err) {
      handleServiceError(res, err);
    }
  });
}
