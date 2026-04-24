// API — Module Annuaire (Clients, Fournisseurs, Prestataires, Contacts, Référentiels)

export function registerAnnuaireMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    // Clients (enrichi)
    async getAnnuaireClients(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/annuaire/clients${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async getAnnuaireClient(id) {
      return this.request(`/annuaire/clients/${id}`, { skipCamelCase: true });
    },
    async createAnnuaireClient(data) {
      return this.request('/annuaire/clients', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async updateAnnuaireClient(id, data) {
      return this.request(`/annuaire/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async deleteAnnuaireClient(id) {
      return this.request(`/annuaire/clients/${id}`, { method: 'DELETE', skipCamelCase: true });
    },

    // Fournisseurs (enrichi)
    async getAnnuaireSuppliers(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/annuaire/suppliers${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async getAnnuaireSupplier(id) {
      return this.request(`/annuaire/suppliers/${id}`, { skipCamelCase: true });
    },
    async createAnnuaireSupplier(data) {
      return this.request('/annuaire/suppliers', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async updateAnnuaireSupplier(id, data) {
      return this.request(`/annuaire/suppliers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async deleteAnnuaireSupplier(id) {
      return this.request(`/annuaire/suppliers/${id}`, { method: 'DELETE', skipCamelCase: true });
    },

    // Prestataires
    async getAnnuairePrestataires(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/annuaire/prestataires${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async getAnnuairePrestataire(id) {
      return this.request(`/annuaire/prestataires/${id}`, { skipCamelCase: true });
    },
    async createAnnuairePrestataire(data) {
      return this.request('/annuaire/prestataires', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async updateAnnuairePrestataire(id, data) {
      return this.request(`/annuaire/prestataires/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async deleteAnnuairePrestataire(id) {
      return this.request(`/annuaire/prestataires/${id}`, {
        method: 'DELETE',
        skipCamelCase: true,
      });
    },

    // Contacts
    async getAnnuaireContacts(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/annuaire/contacts${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async createAnnuaireContact(data) {
      return this.request('/annuaire/contacts', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async updateAnnuaireContact(id, data) {
      return this.request(`/annuaire/contacts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async deleteAnnuaireContact(id) {
      return this.request(`/annuaire/contacts/${id}`, { method: 'DELETE', skipCamelCase: true });
    },

    // Référentiels
    async getAnnuaireRefAll() {
      return this.request('/annuaire/ref/all', { skipCamelCase: true });
    },
    async getAnnuaireRef(slug, params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/annuaire/ref/${slug}${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async createAnnuaireRef(slug, data) {
      return this.request(`/annuaire/ref/${slug}`, {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async updateAnnuaireRef(slug, id, data) {
      return this.request(`/annuaire/ref/${slug}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async deleteAnnuaireRef(slug, id) {
      return this.request(`/annuaire/ref/${slug}/${id}`, { method: 'DELETE', skipCamelCase: true });
    },

    // Recherche globale & Stats
    async searchAnnuaire(query) {
      return this.request(`/annuaire/search?q=${encodeURIComponent(query)}`, {
        skipCamelCase: true,
      });
    },
    async getAnnuaireStats() {
      return this.request('/annuaire/stats', { skipCamelCase: true });
    },

    // Import CSV
    async importClientsCsv() {
      return this.request('/annuaire/import/clients-csv', { method: 'POST', skipCamelCase: true });
    },
    async importSuppliersCsv() {
      return this.request('/annuaire/import/suppliers-csv', {
        method: 'POST',
        skipCamelCase: true,
      });
    },
    async importContactsCsv(data, mode = 'import') {
      return this.request('/annuaire/import/contacts-csv', {
        method: 'POST',
        body: JSON.stringify({ data, mode }),
        skipCamelCase: true,
      });
    },

    // Matching lieux ↔ entités
    async getMatchingLocations() {
      return this.request('/annuaire/matching-locations', { skipCamelCase: true });
    },
    async bulkLinkLocations(links) {
      return this.request('/annuaire/bulk-link-locations', {
        method: 'POST',
        body: JSON.stringify({ links }),
        skipCamelCase: true,
      });
    },

    // Matching entités client ↔ fournisseur ↔ prestataire
    async getMatchingEntities() {
      return this.request('/annuaire/matching-entities', { skipCamelCase: true });
    },
    async getAnnuaireEntityLinks(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/annuaire/entity-links${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async createAnnuaireEntityLink(data) {
      return this.request('/annuaire/entity-links', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async bulkLinkEntities(links) {
      return this.request('/annuaire/bulk-link-entities', {
        method: 'POST',
        body: JSON.stringify({ links }),
        skipCamelCase: true,
      });
    },
    async getMatchingContactEntities() {
      return this.request('/annuaire/matching-contact-entities', { skipCamelCase: true });
    },
    async bulkLinkContactEntities(links) {
      return this.request('/annuaire/bulk-link-contact-entities', {
        method: 'POST',
        body: JSON.stringify({ links }),
        skipCamelCase: true,
      });
    },
    async deleteAnnuaireEntityLink(id) {
      return this.request(`/annuaire/entity-links/${id}`, {
        method: 'DELETE',
        skipCamelCase: true,
      });
    },
  });
}
