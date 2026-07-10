// apps/api/v2/metaRoutes.js
//
// Ticket : T-P1-01 (API v2 core — discovery global).
//
// Endpoint : `GET /api/v2/meta`
//
// Discovery global du namespace v2. Agrege les protocoles des
// 4 domaines livres en P0 (Planning, Display, Locations, Affaires)
// en un seul payload consommable par un client v2 pour :
//   1. Detecter les namespaces disponibles cote serveur (feature
//      flag activé ou non).
//   2. Connaitre la version protocolaire et les capacites de
//      chacun sans multiplier les appels /protocol.
//   3. Piloter la bascule client v2 (ne monter la UI v2 que si le
//      namespace est `enabled=true`).
//
// Public (pas d'auth). Toujours servi (contrairement aux endpoints
// /protocol de chaque namespace qui sont eux-memes gate par leur
// flag). Cela permet un client `read_only` de decouvrir l'etat des
// flags sans avoir a tester chaque namespace individuellement.

import { API_V2_PROTOCOL_VERSION, sendV2Success } from '../utils/apiV2Response.js';
import {
  AFFAIRES_PROTOCOL_VERSION,
  AFFAIRES_V2_CAPABILITIES,
  AFFAIRES_V2_FLAG,
} from './affairesRoutes.js';
import {
  DISPLAY_PROTOCOL_VERSION,
  DISPLAY_V2_CAPABILITIES,
  DISPLAY_V2_FLAG,
} from './displayRoutes.js';
import { LEAVES_PROTOCOL_VERSION, LEAVES_V2_CAPABILITIES, LEAVES_V2_FLAG } from './leavesRoutes.js';
import {
  LOCATIONS_PROTOCOL_VERSION,
  LOCATIONS_V2_CAPABILITIES,
  LOCATIONS_V2_FLAG,
} from './locationsRoutes.js';
import {
  PLANNING_PROTOCOL_VERSION,
  PLANNING_V2_CAPABILITIES,
  PLANNING_V2_FLAG,
} from './planningRoutes.js';

/**
 * Version protocolaire du meta lui-meme. A incrementer si le format
 * de la reponse `/api/v2/meta` change de maniere incompatible.
 * @type {string}
 */
export const META_PROTOCOL_VERSION = '1.0.0';

/**
 * Registre statique des namespaces v2. Ordre alphabetique par
 * `name`. Chaque entree contient les constantes exportees par le
 * module de routes correspondant + le chemin de la doc endpoint.
 * @type {ReadonlyArray<{
 *   name: string,
 *   base_path: string,
 *   protocol_version: string,
 *   capabilities: ReadonlyArray<string>,
 *   flag: string,
 *   docs: string,
 * }>}
 */
export const V2_NAMESPACES = Object.freeze([
  Object.freeze({
    name: 'affaires',
    base_path: '/api/v2/affaires',
    protocol_version: AFFAIRES_PROTOCOL_VERSION,
    capabilities: AFFAIRES_V2_CAPABILITIES,
    flag: AFFAIRES_V2_FLAG,
    docs: '/docs/api/v2/affaires.md',
  }),
  Object.freeze({
    name: 'display',
    base_path: '/api/v2/display',
    protocol_version: DISPLAY_PROTOCOL_VERSION,
    capabilities: DISPLAY_V2_CAPABILITIES,
    flag: DISPLAY_V2_FLAG,
    docs: '/docs/api/v2/display.md',
  }),
  Object.freeze({
    name: 'leaves',
    base_path: '/api/v2/leaves',
    protocol_version: LEAVES_PROTOCOL_VERSION,
    capabilities: LEAVES_V2_CAPABILITIES,
    flag: LEAVES_V2_FLAG,
    docs: '/docs/api/v2/leaves.md',
  }),
  Object.freeze({
    name: 'locations',
    base_path: '/api/v2/locations',
    protocol_version: LOCATIONS_PROTOCOL_VERSION,
    capabilities: LOCATIONS_V2_CAPABILITIES,
    flag: LOCATIONS_V2_FLAG,
    docs: '/docs/api/v2/locations.md',
  }),
  Object.freeze({
    name: 'planning',
    base_path: '/api/v2/planning',
    protocol_version: PLANNING_PROTOCOL_VERSION,
    capabilities: PLANNING_V2_CAPABILITIES,
    flag: PLANNING_V2_FLAG,
    docs: '/docs/api/v2/planning.md',
  }),
]);

/**
 * Interprete la valeur brute d'une variable d'environnement de
 * feature flag. Aligne sur le comportement de
 * `middleware/featureFlag.js#createFeatureFlagGuard` : toute valeur
 * non `"1"` / `"true"` / `"on"` / `"yes"` (case-insensitive) est
 * consideree comme `false`.
 *
 * Isole dans une fonction pour permettre l'injection d'un getEnv
 * personnalise dans les tests.
 *
 * @param {Record<string, string|undefined>} env
 * @param {string} flagName
 * @returns {boolean}
 */
export function isFlagEnabled(env, flagName) {
  const raw = env?.[flagName];
  if (raw === undefined || raw === null) return false;
  const value = String(raw).trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'yes';
}

/**
 * Construit le payload du meta a partir d'un snapshot env.
 *
 * @param {Record<string, string|undefined>} env
 * @param {{ now?: () => string }} [options]
 * @returns {{
 *   meta_protocol_version: string,
 *   response_protocol_version: number,
 *   generated_at: string,
 *   total_namespaces: number,
 *   enabled_count: number,
 *   namespaces: Array<{
 *     name: string,
 *     base_path: string,
 *     protocol_version: string,
 *     capabilities: string[],
 *     flag: string,
 *     enabled: boolean,
 *     docs: string,
 *   }>,
 * }}
 */
export function buildMetaPayload(env, options = {}) {
  const now = typeof options.now === 'function' ? options.now : () => new Date().toISOString();
  const namespaces = V2_NAMESPACES.map((ns) => ({
    name: ns.name,
    base_path: ns.base_path,
    protocol_version: ns.protocol_version,
    capabilities: [...ns.capabilities],
    flag: ns.flag,
    enabled: isFlagEnabled(env, ns.flag),
    docs: ns.docs,
  }));
  const enabledCount = namespaces.reduce((s, ns) => s + (ns.enabled ? 1 : 0), 0);
  return {
    meta_protocol_version: META_PROTOCOL_VERSION,
    response_protocol_version: API_V2_PROTOCOL_VERSION,
    generated_at: now(),
    total_namespaces: namespaces.length,
    enabled_count: enabledCount,
    namespaces,
  };
}

/**
 * Enregistre la route `GET /api/v2/meta` sur l'application Express.
 * Route publique (aucun middleware d'auth).
 *
 * @param {import('express').Express} app
 * @returns {void}
 */
export function setupV2MetaRoutes(app) {
  if (!app || typeof app.get !== 'function') {
    throw new TypeError('setupV2MetaRoutes: application Express requise');
  }

  app.get('/api/v2/meta', (_req, res) => {
    sendV2Success(res, buildMetaPayload(process.env));
  });
}
