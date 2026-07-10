// apps/web/src/utils/api/v2/conflicts.js
//
// Ticket : T-P1-05 (Personnel v2 - moteur de conflits).

/**
 * @param {typeof import('../base.js').ApiClient} ApiClient
 */
export function registerV2ConflictsMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    /** GET /api/v2/conflicts/protocol (public). */
    async v2ConflictsProtocol() {
      return this.request('/v2/conflicts/protocol', { skipCamelCase: true });
    },

    /**
     * POST /api/v2/conflicts/check — detection de conflits agenda.
     * @param {{
     *   person_id: number,
     *   start_date: string,
     *   end_date: string,
     *   start_period?: 'AM'|'PM',
     *   end_period?: 'AM'|'PM',
     *   exclude?: Array<{ entity_type: string, entity_id: string|number }>,
     * }} body
     */
    async v2CheckConflicts(body) {
      return this.request('/v2/conflicts/check', {
        method: 'POST',
        body: JSON.stringify(body),
        skipCamelCase: true,
      });
    },
  });
}
