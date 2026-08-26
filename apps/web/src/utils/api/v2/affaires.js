// apps/web/src/utils/api/v2/affaires.js
//
// Ticket : T-P0-09 (Affaires v2 — client API).
//
// Enregistre sur `ApiClient.prototype` les methodes v2 Affaires.
// Aucun effet de bord au chargement du module.
//
// Feature flag client : `flags.v2Affaires` (lu via une couche UI). Si
// off, les composants doivent tomber sur les endpoints v1 existants
// (`/api/affaires`, `/api/affaires/:id`, `/api/affaires/:id/history`,
// `/api/affaires/:id/status`).

/**
 * @param {typeof import('../base.js').ApiClient} ApiClient
 * @returns {void}
 */
export function registerV2AffairesMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    /**
     * GET /api/v2/affaires/protocol
     * Discovery public (pas d'auth).
     */
    async v2AffairesProtocol() {
      return this.request('/v2/affaires/protocol', { skipCamelCase: true });
    },

    /**
     * GET /api/v2/affaires
     * Liste paginee cursor-based. Reponse :
     *   { data: { items, next_cursor, has_more, total_returned }, meta: { pagination } }.
     * @param {{ cursor?: string|null, limit?: number, type?: string, client?: string }} [options]
     */
    async v2ListAffaires(options = {}) {
      const params = new URLSearchParams();
      if (options.cursor) params.set('cursor', options.cursor);
      if (options.limit) params.set('limit', String(options.limit));
      if (options.type) params.set('type', options.type);
      if (options.client) params.set('client', options.client);
      const qs = params.toString();
      return this.request(`/v2/affaires${qs ? `?${qs}` : ''}`, { skipCamelCase: true });
    },

    /**
     * GET /api/v2/affaires/:numero_affaire
     * @param {string} numeroAffaire
     */
    async v2GetAffaire(numeroAffaire) {
      return this.request(`/v2/affaires/${encodeURIComponent(numeroAffaire)}`, {
        skipCamelCase: true,
      });
    },

    /**
     * GET /api/v2/affaires/:numero_affaire/history
     * @param {string} numeroAffaire
     * @param {{ limit?: number }} [options]
     */
    async v2GetAffaireHistory(numeroAffaire, options = {}) {
      const params = new URLSearchParams();
      if (options.limit) params.set('limit', String(options.limit));
      const qs = params.toString();
      return this.request(
        `/v2/affaires/${encodeURIComponent(numeroAffaire)}/history${qs ? `?${qs}` : ''}`,
        { skipCamelCase: true },
      );
    },

    /**
     * PATCH /api/v2/affaires/:numero_affaire
     * Met a jour les champs metier. Audit trail systematique via
     * `affaire_history`. Reponse :
     *   { data: { affaire, changed_fields, history_ids, changed } }.
     * @param {string} numeroAffaire
     * @param {Record<string, unknown>} patch
     */
    async v2PatchAffaire(numeroAffaire, patch) {
      return this.request(`/v2/affaires/${encodeURIComponent(numeroAffaire)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
        skipCamelCase: true,
      });
    },
  });
}
