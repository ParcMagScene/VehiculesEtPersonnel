// API — Module Contrôles Périodiques (équipements + véhicules)

export function registerControlesMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    // ── Types de contrôle (référentiel) ──
    async getControlTypes(activeOnly = true) {
      return this.request(`/controls/types${activeOnly ? '' : '?active=false'}`);
    },
    async createControlType(data) {
      return this.request('/controls/types', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateControlType(id, data) {
      return this.request(`/controls/types/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteControlType(id) {
      return this.request(`/controls/types/${id}`, { method: 'DELETE' });
    },

    // ── Contrôles attachés à une entité ──
    async getControlsForEntity(entityType, entityId) {
      return this.request(`/controls/equipment/${entityType}/${encodeURIComponent(entityId)}`);
    },
    async createControl(data) {
      return this.request('/controls', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateControl(id, data) {
      return this.request(`/controls/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteControl(id) {
      return this.request(`/controls/${id}`, { method: 'DELETE' });
    },

    // ── Effectuer un contrôle ──
    async performControl(id, data) {
      return this.request(`/controls/perform/${id}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    // ── Historique ──
    async getControlHistory(controlId) {
      return this.request(`/controls/history/${controlId}`);
    },

    // ── Dashboard ──
    async getControlsDashboard(filters = {}) {
      const qs = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v != null && v !== ''),
      ).toString();
      return this.request(`/controls/dashboard${qs ? '?' + qs : ''}`);
    },

    // ── Recompute (admin) ──
    async recomputeControls() {
      return this.request('/controls/recompute', { method: 'POST' });
    },
  });
}
