// apps/web/src/utils/affaires/fetchAffairesV2.js
//
// Ticket : T-P0-09b (Affaires v2 — dogfooding UI lecture).
//
// Fetcher unifie de la liste des affaires : itere sur toutes les
// pages du namespace v2 (`GET /api/v2/affaires`, cursor-based) et
// renvoie un tableau shape v1 (camelCase) drop-in pour les
// consommateurs existants (`AffairesPanel`, `useAffairesList`,
// `MobileAffaires`, `DashboardTasksSidebar`, `ReportsPanel`).
//
// Fallback strict : ne s'appelle que si le flag client v2 est on ET
// que le client API expose `v2ListAffaires`. Sinon le loader
// tombe silencieusement sur l'endpoint v1.
//
// Note : le v2 renvoie systematiquement `skipCamelCase: true`,
// c'est donc au niveau de l'adapter que le mapping snake -> camel
// est realise (cf `v2Adapters.js`).

import { adaptAffairesListV2ToV1 } from './v2Adapters.js';

/**
 * Nombre maximum de pages parcourues en une seule invocation.
 * Filet de securite pour eviter une boucle infinie en cas de
 * curseur mal formatte cote serveur. Avec `limit=200` cela couvre
 * jusqu'a 20 000 affaires.
 * @type {number}
 */
const MAX_PAGES = 100;

/**
 * Detecte si une erreur remontee par le client API correspond a un
 * flag serveur eteint (404 FEATURE_DISABLED). Comportement aligne
 * sur `fetchDepotZones` (T-P0-12b).
 * @param {unknown} err
 * @returns {boolean}
 */
export function isFeatureDisabled(err) {
  if (!err || typeof err !== 'object') return false;
  const code = err.code || err.details?.code;
  return code === 'FEATURE_DISABLED';
}

/**
 * Recupere la liste complete des affaires via le namespace v2, en
 * iterant sur les pages `cursor` jusqu'a `has_more=false`.
 *
 * @param {object} api - Client API (`apps/web/src/utils/api`).
 * @param {object} [options]
 * @param {number} [options.limit=200] - Taille de page v2 (bornee
 *   serveur a 200 max).
 * @param {number} [options.maxPages=MAX_PAGES] - Nombre maximum de
 *   pages a suivre. Filet de securite.
 * @returns {Promise<Array<object>>} Liste shape v1 (camelCase).
 * @throws Toute erreur reseau ou serveur : le loader amont doit
 *   catcher et tomber sur v1 en fallback.
 */
export async function fetchAffairesListV2(api, { limit = 200, maxPages = MAX_PAGES } = {}) {
  if (!api || typeof api.v2ListAffaires !== 'function') {
    throw new Error('api.v2ListAffaires non disponible');
  }

  const all = [];
  let cursor = null;
  let pages = 0;

  while (pages < maxPages) {
    const response = await api.v2ListAffaires({ cursor, limit });
    const items = response?.data?.items;
    if (Array.isArray(items) && items.length > 0) {
      all.push(...adaptAffairesListV2ToV1(items));
    }
    pages += 1;
    const hasMore = response?.data?.has_more === true;
    const nextCursor = response?.data?.next_cursor ?? null;
    if (!hasMore || !nextCursor) return all;
    cursor = nextCursor;
  }

  // Filet de securite atteint : on retourne ce qu'on a plutot que
  // de boucler indefiniment. Le consommateur voit une liste
  // possiblement tronquee, mais l'UI ne bloque pas.
  // eslint-disable-next-line no-console
  console.warn(`[affaires v2] fetchAffairesListV2: MAX_PAGES=${maxPages} atteint`);
  return all;
}
