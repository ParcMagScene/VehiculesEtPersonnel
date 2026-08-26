// API — Stock & Pièces + Demandes de matériel

const MATERIAL_REQUESTS_STATS_CACHE_TTL_MS = 5000;

export function registerStockMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    // Catégories stock
    async getStockCategories() {
      return this.request('/stock/categories', { skipCamelCase: true });
    },
    async createStockCategory(data) {
      return this.request('/stock/categories', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async updateStockCategory(id, data) {
      return this.request(`/stock/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async deleteStockCategory(id) {
      return this.request(`/stock/categories/${id}`, { method: 'DELETE', skipCamelCase: true });
    },

    // Items stock
    async getStockItems(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/stock/items${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async getStockItem(id) {
      return this.request(`/stock/items/${id}`, { skipCamelCase: true });
    },
    async createStockItem(data) {
      return this.request('/stock/items', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async updateStockItem(id, data) {
      return this.request(`/stock/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async deleteStockItem(id) {
      return this.request(`/stock/items/${id}`, { method: 'DELETE' });
    },

    // Mouvements
    async createStockMovement(data) {
      return this.request('/stock/movements', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async getStockMovements(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/stock/movements${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async getStockStats(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/stock/stats${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },

    // Import stock
    async getStockCategoryMap() {
      return this.request('/stock/import/category-map', { skipCamelCase: true });
    },
    async importStockItems(data) {
      return this.request('/stock/import', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },

    // Demandes de matériel
    async getMaterialRequests(params = {}) {
      const query = new URLSearchParams(params).toString();
      return this.request(`/material-requests?${query}`, { skipCamelCase: true });
    },
    async getMaterialRequestsStats() {
      if (!this._shortLivedCountersCache) this._shortLivedCountersCache = new Map();
      const cacheKey = 'material-requests-stats';
      const cached = this._shortLivedCountersCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }

      const data = await this.request('/material-requests/stats', { skipCamelCase: true });
      this._shortLivedCountersCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + MATERIAL_REQUESTS_STATS_CACHE_TTL_MS,
      });
      return data;
    },
    async createMaterialRequest(data) {
      const result = await this.request('/material-requests', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
      this._shortLivedCountersCache?.delete('material-requests-stats');
      return result;
    },
    async updateMaterialRequest(id, data) {
      const result = await this.request(`/material-requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
      this._shortLivedCountersCache?.delete('material-requests-stats');
      return result;
    },
    async deleteMaterialRequest(id) {
      const result = await this.request(`/material-requests/${id}`, {
        method: 'DELETE',
        skipCamelCase: true,
      });
      this._shortLivedCountersCache?.delete('material-requests-stats');
      return result;
    },
    async detachMaterialRequest(id) {
      return this.request(`/material-requests/${id}/detach`, {
        method: 'POST',
        skipCamelCase: true,
      });
    },
    async validateMaterialRequest(id, action, rejection_reason = null, assignments = null) {
      const result = await this.request(`/material-requests/${id}/validate`, {
        method: 'POST',
        body: JSON.stringify({ action, rejection_reason, assignments }),
        skipCamelCase: true,
      });
      this._shortLivedCountersCache?.delete('material-requests-stats');
      return result;
    },
    async getEligibleOrdersForRequest(id) {
      return this.request(`/material-requests/${id}/eligible-orders`, { skipCamelCase: true });
    },
    async batchValidateMaterialRequests(request_ids, action) {
      const result = await this.request('/material-requests/batch-validate', {
        method: 'POST',
        body: JSON.stringify({ request_ids, action }),
        skipCamelCase: true,
      });
      this._shortLivedCountersCache?.delete('material-requests-stats');
      return result;
    },
  });
}
