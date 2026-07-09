// apps/api/v2/displayRoutes.js
//
// Ticket : EXECUTION_PLAN_EMAG_3_0.md T-P0-14 (P0 Display v2 API versionnee).
//
// Namespace `/api/v2/display/*` — scaffold minimal. Coexistence stricte
// avec `displayRoutes.js` v1 (2333 lignes, 55+ endpoints) qui reste
// inchange et actif sur `/api/display/*`.
//
// Endpoints livres ici (T-P0-14, gates par FEATURE_V2_DISPLAY) :
//   - GET /api/v2/display/protocol   (public : discovery, pas d'auth)
//   - GET /api/v2/display/config     (auth : config par ecran)
//   - GET /api/v2/display/content    (auth : contenu playlist courante)
//   - GET /api/v2/display/signals    (auth : signaux temps reel screen)
//
// Les 3 endpoints config/content/signals sont livres en "read-only
// skeleton" : ils repondent 501 NotImplemented avec un pointeur vers
// les endpoints v1 correspondants tant que la refonte metier (T-P0-15
// DisplayService) n'est pas faite. Cela permet aux consommateurs
// (TV-client v2, T-P0-16) de decouvrir l'API et de tester le canal
// v2 sans casser v1.
//
// Voir docs/05-Specs/DISPLAY_V2.md.

import { createFeatureFlagGuard } from '../middleware/featureFlag.js';
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
  'config-skeleton', // GET /config accessible (501 tant que non implemente)
  'content-skeleton', // GET /content accessible (501 tant que non implemente)
  'signals-skeleton', // GET /signals accessible (501 tant que non implemente)
]);

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

  // ─── GET /api/v2/display/config ───
  // Skeleton — retournera la config d'un ecran (theme, layout, playlist)
  // apres refonte T-P0-15. Pour l'instant renvoie 501 avec pointeur v1.
  app.get('/api/v2/display/config', flagGuard, authenticateToken, (_req, res) => {
    sendV2Error(res, 'Not implemented — voir /api/display/screens/:id et /api/display/appearance', {
      status: 501,
      code: 'NOT_IMPLEMENTED',
      meta: {
        legacy_endpoints: ['/api/display/screens/:id', '/api/display/appearance'],
        ticket: 'T-P0-15',
      },
    });
  });

  // ─── GET /api/v2/display/content ───
  // Skeleton — retournera le contenu de la playlist active pour un
  // ecran (media list, timings, transitions). T-P0-15.
  app.get('/api/v2/display/content', flagGuard, authenticateToken, (_req, res) => {
    sendV2Error(res, 'Not implemented — voir /api/display/playlists/:id', {
      status: 501,
      code: 'NOT_IMPLEMENTED',
      meta: {
        legacy_endpoints: ['/api/display/playlists', '/api/display/playlists/:id'],
        ticket: 'T-P0-15',
      },
    });
  });

  // ─── GET /api/v2/display/signals ───
  // Skeleton — signaux temps reel (heartbeat, messages, alertes) pour
  // un ecran. Migration vers SSE prevue en T-P0-16.
  app.get('/api/v2/display/signals', flagGuard, authenticateToken, (_req, res) => {
    sendV2Error(res, 'Not implemented — voir /api/display/messages et heartbeat legacy', {
      status: 501,
      code: 'NOT_IMPLEMENTED',
      meta: {
        legacy_endpoints: [
          '/api/display/messages',
          '/api/display/screens/:id/heartbeat',
          '/api/display/welcome-messages',
        ],
        ticket: 'T-P0-16',
      },
    });
  });
}
