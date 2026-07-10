// apps/web/src/utils/api/v2/meta.js
//
// Ticket : T-P1-01 (API v2 core — client discovery global).
//
// Enregistre sur `ApiClient.prototype` la methode `v2Meta()` qui
// interroge `/api/v2/meta` (endpoint public). Utile pour :
//   - detecter cote client quels namespaces v2 sont actifs cote
//     serveur sans multiplier les tests d'endpoints /protocol.
//   - piloter la bascule flag client (`flags.v2<Domaine>`) en
//     fonction de l'etat reel du flag serveur.

/**
 * @param {typeof import('../base.js').ApiClient} ApiClient
 * @returns {void}
 */
export function registerV2MetaMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    /**
     * GET /api/v2/meta
     * Discovery global des namespaces v2. Public (pas d'auth).
     * Reponse :
     *   {
     *     data: {
     *       meta_protocol_version: string,
     *       response_protocol_version: number,
     *       generated_at: string,
     *       total_namespaces: number,
     *       enabled_count: number,
     *       namespaces: Array<{
     *         name, base_path, protocol_version, capabilities,
     *         flag, enabled, docs
     *       }>
     *     }
     *   }
     */
    async v2Meta() {
      return this.request('/v2/meta', { skipCamelCase: true });
    },
  });
}
