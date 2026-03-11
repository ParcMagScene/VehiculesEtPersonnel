// API — Stock & Pièces + Demandes de matériel

export function registerStockMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {

    // Catégories stock
    async getStockCategories() {
      return this.request('/stock/categories');
    },
    async createStockCategory(data) {
      return this.request('/stock/categories', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateStockCategory(id, data) {
      return this.request(`/stock/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteStockCategory(id) {
      return this.request(`/stock/categories/${id}`, { method: 'DELETE' });
    },

    // Items stock
    async getStockItems(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/stock/items${qs ? '?' + qs : ''}`);
    },
    async getStockItem(id) {
      return this.request(`/stock/items/${id}`);
    },
    async createStockItem(data) {
      return this.request('/stock/items', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateStockItem(id, data) {
      return this.request(`/stock/items/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteStockItem(id) {
      return this.request(`/stock/items/${id}`, { method: 'DELETE' });
    },

    // Mouvements
    async createStockMovement(data) {
      return this.request('/stock/movements', { method: 'POST', body: JSON.stringify(data) });
    },
    async getStockMovements(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/stock/movements${qs ? '?' + qs : ''}`);
    },
    async getStockStats() {
      return this.request('/stock/stats');
    },

    // Demandes de matériel
    async getMaterialRequests(params = {}) {
      const query = new URLSearchParams(params).toString();
      return this.request(`/material-requests?${query}`);
    },
    async getMaterialRequestsStats() {
      return this.request('/material-requests/stats');
    },
    async createMaterialRequest(data) {
      return this.request('/material-requests', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateMaterialRequest(id, data) {
      return this.request(`/material-requests/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteMaterialRequest(id) {
      return this.request(`/material-requests/${id}`, { method: 'DELETE' });
    },
    async validateMaterialRequest(id, action, rejection_reason = null) {
      return this.request(`/material-requests/${id}/validate`, { method: 'POST', body: JSON.stringify({ action, rejection_reason }) });
    },
    async batchValidateMaterialRequests(request_ids, action) {
      return this.request('/material-requests/batch-validate', { method: 'POST', body: JSON.stringify({ request_ids, action }) });
    },
  });
}
