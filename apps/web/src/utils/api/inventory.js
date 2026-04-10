// API — Module Inventaire (emplacements, prix, anomalies, stats, ABC, exports)

export function registerInventoryMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {

    // ── Emplacements (Locations) ──
    async getInventoryLocations(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/inventory/locations${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async createInventoryLocation(data) {
      return this.request('/inventory/locations', { method: 'POST', body: JSON.stringify(data), skipCamelCase: true });
    },
    async updateInventoryLocation(id, data) {
      return this.request(`/inventory/locations/${id}`, { method: 'PUT', body: JSON.stringify(data), skipCamelCase: true });
    },
    async deleteInventoryLocation(id) {
      return this.request(`/inventory/locations/${id}`, { method: 'DELETE', skipCamelCase: true });
    },

    // ── Historique Prix ──
    async getItemPriceHistory(itemId) {
      return this.request(`/inventory/prices/${itemId}`, { skipCamelCase: true });
    },
    async addItemPrice(data) {
      return this.request('/inventory/prices', { method: 'POST', body: JSON.stringify(data), skipCamelCase: true });
    },

    // ── Moteur de Prix ──
    async getPriceAnalysis(itemId) {
      return this.request(`/inventory/price-engine/${itemId}`, { skipCamelCase: true });
    },
    async getBatchPriceAnalysis(itemIds) {
      return this.request('/inventory/price-engine/batch', { method: 'POST', body: JSON.stringify({ item_ids: itemIds }), skipCamelCase: true });
    },
    async fusionPrices(stockItemId, prices) {
      return this.request('/inventory/price-engine/fusion', { method: 'POST', body: JSON.stringify({ stock_item_id: stockItemId, prices }), skipCamelCase: true });
    },

    // ── Anomalies ──
    async getInventoryAnomalies(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/inventory/anomalies${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async updateAnomaly(id, data) {
      return this.request(`/inventory/anomalies/${id}`, { method: 'PUT', body: JSON.stringify(data), skipCamelCase: true });
    },
    async detectAnomalies() {
      return this.request('/inventory/anomalies/detect', { method: 'POST', skipCamelCase: true });
    },

    // ── Comptage inventaire ──
    async submitInventoryCount(items) {
      return this.request('/inventory/count', { method: 'POST', body: JSON.stringify({ items }), skipCamelCase: true });
    },

    // ── Alertes stock bas ──
    async getInventoryAlerts() {
      return this.request('/inventory/alerts', { skipCamelCase: true });
    },

    // ── Statistiques ──
    async getInventoryStats() {
      return this.request('/inventory/stats', { skipCamelCase: true });
    },
    async refreshInventoryStats() {
      return this.request('/inventory/stats/refresh', { method: 'POST', skipCamelCase: true });
    },

    // ── Classification ABC ──
    async runAbcClassification() {
      return this.request('/inventory/abc-classify', { method: 'POST', skipCamelCase: true });
    },

    // ── Exports ──
    async exportInventoryCSV() {
      return this.requestBlob('/inventory/export/csv');
    },
    async exportInventoryJSON() {
      return this.request('/inventory/export/json', { skipCamelCase: true });
    },
  });
}
