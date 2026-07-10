// apps/web/src/utils/api/v2/sav.js
//
// Ticket : T-P1-07 (Equipements v2 - SAV enrichi).

/**
 * @param {typeof import('../base.js').ApiClient} ApiClient
 */
export function registerV2SavMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    /** GET /api/v2/sav/protocol (public). */
    async v2SavProtocol() {
      return this.request('/v2/sav/protocol', { skipCamelCase: true });
    },

    /**
     * GET /api/v2/sav/tickets/:id/parts
     * @param {number} ticketId
     */
    async v2ListSavParts(ticketId) {
      return this.request(`/v2/sav/tickets/${encodeURIComponent(ticketId)}/parts`, {
        skipCamelCase: true,
      });
    },

    /**
     * POST /api/v2/sav/tickets/:id/parts
     * @param {number} ticketId
     * @param {{ part_name, part_reference?, quantity?, unit_price?, supplier?, notes? }} data
     */
    async v2AddSavPart(ticketId, data) {
      return this.request(`/v2/sav/tickets/${encodeURIComponent(ticketId)}/parts`, {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },

    /**
     * PATCH /api/v2/sav/parts/:id/status
     * @param {number} partId
     * @param {'requested'|'ordered'|'received'|'installed'|'cancelled'} status
     */
    async v2UpdateSavPartStatus(partId, status) {
      return this.request(`/v2/sav/parts/${encodeURIComponent(partId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        skipCamelCase: true,
      });
    },

    /**
     * POST /api/v2/sav/tickets/:id/transition
     * @param {number} ticketId
     * @param {string} newStatus
     */
    async v2TransitionSavTicket(ticketId, newStatus) {
      return this.request(`/v2/sav/tickets/${encodeURIComponent(ticketId)}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
        skipCamelCase: true,
      });
    },
  });
}
