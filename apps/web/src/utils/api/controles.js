// API — Module Contrôles Périodiques (équipements + véhicules)
//
// Toutes les routes de ce module utilisent skipCamelCase : le module entier
// (UI, hooks, helpers) lit les payloads en snake_case (entity_name,
// entity_subtitle, type_code, next_due_date, …). Sans ce flag, le
// transformeur global toCamelCase de ApiClient renommerait les clés et
// le rendu afficherait des `—` / `∅` partout (cf. bug 2026-05-28).

export function registerControlesMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    // ── Types de contrôle (référentiel) ──
    async getControlTypes(activeOnly = true) {
      return this.request(`/controls/types${activeOnly ? '' : '?active=false'}`, {
        skipCamelCase: true,
      });
    },
    async createControlType(data) {
      return this.request('/controls/types', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async updateControlType(id, data) {
      return this.request(`/controls/types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async deleteControlType(id) {
      return this.request(`/controls/types/${id}`, { method: 'DELETE', skipCamelCase: true });
    },

    // ── Contrôles attachés à une entité ──
    async getControlsForEntity(entityType, entityId) {
      return this.request(`/controls/equipment/${entityType}/${encodeURIComponent(entityId)}`, {
        skipCamelCase: true,
      });
    },
    async createControl(data) {
      return this.request('/controls', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async updateControl(id, data) {
      return this.request(`/controls/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async deleteControl(id) {
      return this.request(`/controls/${id}`, { method: 'DELETE', skipCamelCase: true });
    },

    // ── Effectuer un contrôle ──
    async performControl(id, data) {
      return this.request(`/controls/perform/${id}`, {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },

    // ── Historique ──
    async getControlHistory(controlId) {
      return this.request(`/controls/history/${controlId}`, { skipCamelCase: true });
    },

    // ── Dashboard ──
    async getControlsDashboard(filters = {}) {
      const qs = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v != null && v !== ''),
      ).toString();
      return this.request(`/controls/dashboard${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },

    // ── Recompute (admin) ──
    async recomputeControls() {
      return this.request('/controls/recompute', { method: 'POST', skipCamelCase: true });
    },
  });
}
