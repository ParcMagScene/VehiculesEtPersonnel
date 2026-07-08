// API — Planning v2 (namespace /api/v2/planning/*)
//
// Ticket : T-P0-05 (UI TaskPlanningPanel v2 — lecture).
//
// Conventions v2 :
//   - Payload standardisé { success, data, meta, error }.
//   - Pagination cursor-based (meta.pagination.{cursor,next_cursor,limit,has_more}).
//   - `this.request(...)` renvoie déjà le JSON désérialisé ; en v2 on garde
//     l'objet entier pour exposer `data` ET `meta` aux consommateurs.
//   - Feature flag SERVEUR : FEATURE_V2_PLANNING (env). Si off → 404
//     FEATURE_DISABLED renvoyé par le backend. Les hooks/composants v2
//     doivent gérer ce cas explicitement (dégradation gracieuse vers v1).

export function registerPlanningV2Methods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    /**
     * GET /api/v2/planning/tasks — liste cursor-based.
     * @param {object} [params]
     * @param {string} [params.cursor]      Curseur opaque de la page suivante.
     * @param {number} [params.limit]       1..200, défaut 100.
     * @param {number} [params.person_id]
     * @param {string} [params.section]     Une des 20 sections canoniques.
     * @param {string} [params.date_from]   YYYY-MM-DD.
     * @param {string} [params.date_to]     YYYY-MM-DD.
     * @param {string} [params.status]
     * @param {boolean|number|string} [params.visible]
     * @param {string} [params.affaire_num]
     * @returns {Promise<{ success: boolean, data: Array, meta: object }>}
     */
    async listV2Tasks(params = {}) {
      const clean = {};
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue;
        clean[key] = String(value);
      }
      const qs = new URLSearchParams(clean).toString();
      return this.request(`/v2/planning/tasks${qs ? `?${qs}` : ''}`);
    },

    /**
     * GET /api/v2/planning/tasks/:id — détail.
     * @param {string} id UUID hex.
     * @returns {Promise<{ success: boolean, data: object, meta: object }>}
     */
    async getV2Task(id) {
      return this.request(`/v2/planning/tasks/${encodeURIComponent(id)}`);
    },

    /**
     * POST /api/v2/planning/tasks — création.
     * @param {object} data
     * @returns {Promise<{ success: boolean, data: object, meta: object }>}
     */
    async createV2Task(data) {
      return this.request('/v2/planning/tasks', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    /**
     * PUT /api/v2/planning/tasks/:id — mise à jour partielle.
     * @param {string} id
     * @param {object} data
     * @returns {Promise<{ success: boolean, data: object, meta: object }>}
     */
    async updateV2Task(id, data) {
      return this.request(`/v2/planning/tasks/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    /**
     * DELETE /api/v2/planning/tasks/:id — suppression.
     * @param {string} id
     * @returns {Promise<{ success: boolean, data: object, meta: object }>}
     */
    async deleteV2Task(id) {
      return this.request(`/v2/planning/tasks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
  });
}
