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

    /**
     * POST /api/v2/orders/:id/receptions (T-P1-10)
     * @param {number} orderId
     * @param {{ order_item_id: number, received_qty: number, notes?: string }} data
     */
    async v2RecordOrderReception(orderId, data) {
      return this.request(`/v2/orders/${encodeURIComponent(orderId)}/receptions`, {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },

    /**
     * GET /api/v2/orders/:id/receptions/summary (T-P1-10)
     * @param {number} orderId
     */
    async v2GetOrderReceptionsSummary(orderId) {
      return this.request(`/v2/orders/${encodeURIComponent(orderId)}/receptions/summary`, {
        skipCamelCase: true,
      });
    },

    /**
     * POST /api/v2/quotes/:id/convert-to-order (T-P1-10)
     * @param {number} quoteId
     */
    async v2ConvertQuoteToOrder(quoteId) {
      return this.request(`/v2/quotes/${encodeURIComponent(quoteId)}/convert-to-order`, {
        method: 'POST',
        body: JSON.stringify({}),
        skipCamelCase: true,
      });
    },
  });
}
