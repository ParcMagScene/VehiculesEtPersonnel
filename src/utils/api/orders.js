// API — Commandes, Fournisseurs, Devis, Catalogue, Flight-cases, Modèles Camions, Réservation-Équipement, Documents fournisseurs

export function registerOrdersMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {

    // Fournisseurs
    async getSuppliers(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/suppliers${qs ? '?' + qs : ''}`);
    },
    async createSupplier(data) {
      return this.request('/suppliers', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateSupplier(id, data) {
      return this.request(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteSupplier(id) {
      return this.request(`/suppliers/${id}`, { method: 'DELETE' });
    },

    // Commandes
    async getOrders(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/orders${qs ? '?' + qs : ''}`);
    },
    async getOrdersStats() {
      return this.request('/orders/stats');
    },
    async getOrderById(id) {
      return this.request(`/orders/${id}`);
    },
    async createOrder(data) {
      return this.request('/orders', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateOrder(id, data) {
      return this.request(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteOrder(id) {
      return this.request(`/orders/${id}`, { method: 'DELETE' });
    },
    async generateOrdersFromBL(data) {
      return this.request('/orders/generate-from-bl', { method: 'POST', body: JSON.stringify(data) });
    },
    async addItemsToOrder(orderId, items) {
      return this.request(`/orders/${orderId}/add-items`, { method: 'POST', body: JSON.stringify({ items }) });
    },

    // Devis
    async getQuotes(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/quotes${qs ? '?' + qs : ''}`);
    },
    async getQuoteById(id) {
      return this.request(`/quotes/${id}`);
    },
    async createQuote(data) {
      return this.request('/quotes', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateQuote(id, data) {
      return this.request(`/quotes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async convertQuoteToOrder(id) {
      return this.request(`/quotes/${id}/convert`, { method: 'POST' });
    },
    async deleteQuote(id) {
      return this.request(`/quotes/${id}`, { method: 'DELETE' });
    },

    // Catalogue d'équipements
    async getCatalogEquipment(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/catalog/equipment${qs ? '?' + qs : ''}`);
    },
    async getCatalogEquipmentById(id) {
      return this.request(`/catalog/equipment/${id}`);
    },
    async getCatalogFamilies() {
      return this.request('/catalog/equipment/families');
    },
    async getCatalogCategories() {
      return this.request('/catalog/equipment/categories');
    },
    async matchCatalogReferences(references) {
      return this.request('/catalog/equipment/match-references', { method: 'POST', body: JSON.stringify({ references }) });
    },
    async createCatalogEquipment(data) {
      return this.request('/catalog/equipment', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateCatalogEquipment(id, data) {
      return this.request(`/catalog/equipment/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteCatalogEquipment(id) {
      return this.request(`/catalog/equipment/${id}`, { method: 'DELETE' });
    },

    // Zones de dépôt
    async getDepotZones() {
      return this.request('/catalog/equipment/zones');
    },
    async getLocationStats() {
      return this.request('/catalog/equipment/location-stats');
    },
    async getEquipmentDepotZones(depot = 1) {
      return this.request(`/equipment-depot-zones?depot=${depot}`);
    },
    async getAllDepotZones() {
      return this.request('/equipment-all-depot-zones');
    },
    async getEquipmentLocationStats(depot = null) {
      return this.request(`/equipment-location-stats${depot ? `?depot=${depot}` : ''}`);
    },

    // Flight-cases
    async getFlightcases(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/flightcases${qs ? '?' + qs : ''}`);
    },
    async getFlightcaseById(id) {
      return this.request(`/flightcases/${id}`);
    },
    async createFlightcase(data) {
      return this.request('/flightcases', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateFlightcase(id, data) {
      return this.request(`/flightcases/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteFlightcase(id) {
      return this.request(`/flightcases/${id}`, { method: 'DELETE' });
    },

    // Modèles de camions
    async getTruckModels(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/trucks/models${qs ? '?' + qs : ''}`);
    },
    async getTruckModelById(id) {
      return this.request(`/trucks/models/${id}`);
    },
    async createTruckModel(data) {
      return this.request('/trucks/models', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateTruckModel(id, data) {
      return this.request(`/trucks/models/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteTruckModel(id) {
      return this.request(`/trucks/models/${id}`, { method: 'DELETE' });
    },

    // Équipements liés aux réservations
    async getReservationEquipment(reservationId) {
      return this.request(`/reservations/${reservationId}/equipment`);
    },
    async assignEquipmentToReservation(reservationId, data) {
      return this.request(`/reservations/${reservationId}/equipment`, { method: 'POST', body: JSON.stringify(data) });
    },
    async removeEquipmentFromReservation(reservationId, linkId) {
      return this.request(`/reservations/${reservationId}/equipment/${linkId}`, { method: 'DELETE' });
    },
    async getChargementExport(reservationId) {
      return this.request(`/reservations/${reservationId}/chargement-export`);
    },

    // Documents fournisseurs
    async getSupplierDocuments(params = {}) {
      const query = new URLSearchParams(params).toString();
      return this.request(`/supplier-documents?${query}`);
    },
    async uploadSupplierDocument(data) {
      return this.request('/supplier-documents', { method: 'POST', body: JSON.stringify(data) });
    },
    async deleteSupplierDocument(id) {
      return this.request(`/supplier-documents/${id}`, { method: 'DELETE' });
    },

    // Fournisseurs enrichis
    async getSuppliersWithOrders(includeArchived = false) {
      return this.request(`/suppliers/with-orders?include_archived=${includeArchived}`);
    },
    async getSupplierOrders(supplierId, includeArchived = false) {
      return this.request(`/suppliers/${supplierId}/orders?include_archived=${includeArchived}`);
    },
    async getSupplierFullDetail(supplierId) {
      return this.request(`/suppliers/${supplierId}/full-detail`);
    },
  });
}
