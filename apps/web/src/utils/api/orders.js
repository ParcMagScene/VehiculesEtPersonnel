// API — Commandes, Fournisseurs, Devis, Catalogue, Flight-cases, Modèles Camions, Réservation-Équipement, Documents fournisseurs

export function registerOrdersMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {

    // Fournisseurs
    async getSuppliers(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/suppliers${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async createSupplier(data) {
      return this.request('/suppliers', { method: 'POST', body: JSON.stringify(data), skipCamelCase: true });
    },
    async updateSupplier(id, data) {
      return this.request(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data), skipCamelCase: true });
    },
    async deleteSupplier(id) {
      return this.request(`/suppliers/${id}`, { method: 'DELETE', skipCamelCase: true });
    },

    // Commandes
    async getOrders(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/orders${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async getMyLinkedOrders() {
      return this.request('/orders/my-linked', { skipCamelCase: true });
    },
    async getOrdersStats() {
      return this.request('/orders/stats', { skipCamelCase: true });
    },
    async getOrderById(id) {
      return this.request(`/orders/${id}`, { skipCamelCase: true });
    },
    async createOrder(data) {
      return this.request('/orders', { method: 'POST', body: JSON.stringify(data), skipCamelCase: true });
    },
    async updateOrder(id, data) {
      return this.request(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data), skipCamelCase: true });
    },
    async deleteOrder(id) {
      return this.request(`/orders/${id}`, { method: 'DELETE', skipCamelCase: true });
    },
    async generateOrdersFromBL(data) {
      return this.request('/orders/generate-from-bl', { method: 'POST', body: JSON.stringify(data), skipCamelCase: true });
    },
    async prepareOrdersFromAffaire(affaire_id) {
      return this.request('/orders/prepare-from-affaire', { method: 'POST', body: JSON.stringify({ affaire_id }), skipCamelCase: true });
    },
    async addItemsToOrder(orderId, items) {
      return this.request(`/orders/${orderId}/add-items`, { method: 'POST', body: JSON.stringify({ items }), skipCamelCase: true });
    },

    // Devis
    async getQuotes(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/quotes${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async getQuoteById(id) {
      return this.request(`/quotes/${id}`, { skipCamelCase: true });
    },
    async createQuote(data) {
      return this.request('/quotes', { method: 'POST', body: JSON.stringify(data), skipCamelCase: true });
    },
    async updateQuote(id, data) {
      return this.request(`/quotes/${id}`, { method: 'PUT', body: JSON.stringify(data), skipCamelCase: true });
    },
    async convertQuoteToOrder(id) {
      return this.request(`/quotes/${id}/convert`, { method: 'POST', skipCamelCase: true });
    },
    async deleteQuote(id) {
      return this.request(`/quotes/${id}`, { method: 'DELETE', skipCamelCase: true });
    },

    // Équipements liés aux réservations
    async getReservationEquipment(reservationId) {
      return this.request(`/reservations/${reservationId}/equipment`, { skipCamelCase: true });
    },
    async assignEquipmentToReservation(reservationId, data) {
      return this.request(`/reservations/${reservationId}/equipment`, { method: 'POST', body: JSON.stringify(data), skipCamelCase: true });
    },
    async removeEquipmentFromReservation(reservationId, linkId) {
      return this.request(`/reservations/${reservationId}/equipment/${linkId}`, { method: 'DELETE', skipCamelCase: true });
    },
    async getChargementExport(reservationId) {
      return this.request(`/reservations/${reservationId}/chargement-export`, { skipCamelCase: true });
    },

    // Documents fournisseurs
    async getSupplierDocuments(params = {}) {
      const query = new URLSearchParams(params).toString();
      return this.request(`/supplier-documents?${query}`, { skipCamelCase: true });
    },
    async uploadSupplierDocument(data) {
      return this.request('/supplier-documents', { method: 'POST', body: JSON.stringify(data), skipCamelCase: true });
    },
    async deleteSupplierDocument(id) {
      return this.request(`/supplier-documents/${id}`, { method: 'DELETE', skipCamelCase: true });
    },

    // Fournisseurs enrichis
    async getSuppliersWithOrders(includeArchived = false) {
      return this.request(`/suppliers/with-orders?include_archived=${includeArchived}`, { skipCamelCase: true });
    },
    async getSupplierOrders(supplierId, includeArchived = false) {
      return this.request(`/suppliers/${supplierId}/orders?include_archived=${includeArchived}`, { skipCamelCase: true });
    },
    async getSupplierFullDetail(supplierId) {
      return this.request(`/suppliers/${supplierId}/full-detail`, { skipCamelCase: true });
    },

    // ── Articles fournisseurs (catalogues PDF) ──
    async getSupplierArticles(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/supplier-articles${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async getSupplierArticle(id) {
      return this.request(`/supplier-articles/${id}`, { skipCamelCase: true });
    },
    async importSupplierArticles(data) {
      return this.request('/supplier-articles/import', { method: 'POST', body: JSON.stringify(data), skipCamelCase: true });
    },
    async deleteSupplierArticle(id) {
      return this.request(`/supplier-articles/${id}`, { method: 'DELETE', skipCamelCase: true });
    },
    async purgeSupplierArticles() {
      return this.request('/supplier-articles', { method: 'DELETE', skipCamelCase: true });
    },
    async getSupplierArticleFilters(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/supplier-articles/filters${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async getSupplierArticleStats() {
      return this.request('/supplier-articles/stats', { skipCamelCase: true });
    },
    async refreshSupplierArticleBrands() {
      return this.request('/supplier-articles/refresh-brands', { method: 'POST', skipCamelCase: true });
    },
    async getCatalogImports(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/catalog-imports${qs ? '?' + qs : ''}`, { skipCamelCase: true });
    },
    async deleteCatalogImport(id) {
      return this.request(`/catalog-imports/${id}`, { method: 'DELETE', skipCamelCase: true });
    },

    // ── Apprentissage parsers ──
    async analyzeParserResults(data) {
      return this.request('/supplier-articles/analyze', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },

    // ── Taxonomie (familles/catégories) ──
    async getTaxonomy() {
      return this.request('/supplier-articles/taxonomy', { skipCamelCase: true });
    },
    async applyTaxonomyRules(rules) {
      return this.request('/supplier-articles/taxonomy/apply', {
        method: 'POST',
        body: JSON.stringify({ rules }),
        skipCamelCase: true,
      });
    },

    // ── Marques (brands) ──
    async getBrands() {
      return this.request('/brands', { skipCamelCase: true });
    },
    async getBrandById(id) {
      return this.request(`/brands/${id}`, { skipCamelCase: true });
    },
    async resolveBrand(text) {
      return this.request('/brands/resolve', { method: 'POST', body: JSON.stringify({ text }), skipCamelCase: true });
    },
    async addBrandAlias(brandId, alias) {
      return this.request(`/brands/${brandId}/aliases`, { method: 'POST', body: JSON.stringify({ alias }), skipCamelCase: true });
    },
    async linkBrandIds() {
      return this.request('/supplier-articles/link-brand-ids', { method: 'POST', skipCamelCase: true });
    },
    async applyUnifiedFamily() {
      return this.request('/supplier-articles/apply-unified-family', { method: 'POST', skipCamelCase: true });
    },
  });
}
