// apps/web/src/utils/api/v2/leaves.js
//
// Ticket : T-P1-04 (Personnel v2 - solde conges).
//
// Enregistre les methodes v2 Leaves sur ApiClient.prototype.

/**
 * @param {typeof import('../base.js').ApiClient} ApiClient
 */
export function registerV2LeavesMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    /** GET /api/v2/leaves/protocol (public). */
    async v2LeavesProtocol() {
      return this.request('/v2/leaves/protocol', { skipCamelCase: true });
    },

    /**
     * POST /api/v2/leaves/calculate — miroir v2 du calcul jours ouvrables.
     * @param {{
     *   startDate: string, endDate: string,
     *   startPeriod?: 'AM'|'PM', endPeriod?: 'AM'|'PM',
     *   leaveType?: string, exceptionalType?: string, requestDate?: string,
     * }} data
     */
    async v2CalculateLeaves(data) {
      return this.request('/v2/leaves/calculate', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },

    /**
     * GET /api/v2/leaves/balance/mine — self-service.
     * @param {{ year?: number, type?: string }} [options]
     */
    async v2GetMyLeaveBalance(options = {}) {
      const params = new URLSearchParams();
      if (options.year) params.set('year', String(options.year));
      if (options.type) params.set('type', options.type);
      const qs = params.toString();
      return this.request(`/v2/leaves/balance/mine${qs ? `?${qs}` : ''}`, {
        skipCamelCase: true,
      });
    },

    /**
     * GET /api/v2/leaves/balance/:person_id — admin.
     * @param {number} personId
     * @param {{ year?: number, type?: string }} [options]
     */
    async v2GetLeaveBalance(personId, options = {}) {
      const params = new URLSearchParams();
      if (options.year) params.set('year', String(options.year));
      if (options.type) params.set('type', options.type);
      const qs = params.toString();
      return this.request(
        `/v2/leaves/balance/${encodeURIComponent(personId)}${qs ? `?${qs}` : ''}`,
        {
          skipCamelCase: true,
        },
      );
    },
  });
}
