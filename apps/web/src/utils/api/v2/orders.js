// apps/web/src/utils/api/v2/orders.js
//
// Ticket : T-P1-09 (Commandes v2 - cycle achat).

/**
 * @param {typeof import('../base.js').ApiClient} ApiClient
 */
export function registerV2OrdersMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    async v2OrdersProtocol() {
      return this.request('/v2/orders/protocol', { skipCamelCase: true });
    },

    /**
     * POST /api/v2/orders/:id/transition
     * @param {number} orderId
     * @param {string} status
     */
    async v2TransitionOrder(orderId, status) {
      return this.request(`/v2/orders/${encodeURIComponent(orderId)}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status }),
        skipCamelCase: true,
      });
    },

    /**
     * POST /api/v2/quotes/:id/transition
     * @param {number} quoteId
     * @param {string} status
     */
    async v2TransitionQuote(quoteId, status) {
      return this.request(`/v2/quotes/${encodeURIComponent(quoteId)}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status }),
        skipCamelCase: true,
      });
    },
  });
}
