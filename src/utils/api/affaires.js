// API — Module Affaires + Liaisons

export function registerAffairesMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {

    async getAffaires() {
      return this.request('/affaires');
    },
    async getAffairesPersonnelCounts() {
      return this.request('/affaires/personnel-counts');
    },
    async createOrUpdateAffaire(affaire) {
      return this.request('/affaires', { method: 'POST', body: JSON.stringify(affaire) });
    },
    async updateAffaire(id, affaire) {
      return this.request(`/affaires/${id}`, { method: 'PUT', body: JSON.stringify(affaire) });
    },
    async deleteAffaire(id) {
      return this.request(`/affaires/${id}`, { method: 'DELETE' });
    },
    async syncGoogleEventsToAffaires(events) {
      return this.request('/affaires/sync-google-events', { method: 'POST', body: JSON.stringify({ events }) });
    },

    // Liaisons entre affaires
    async getAffaireLinks(affaireId) {
      return this.request(`/affaires/${affaireId}/links`);
    },
    async createAffaireLink(parentId, childAffaireId) {
      return this.request(`/affaires/${parentId}/links`, { method: 'POST', body: JSON.stringify({ childAffaireId }) });
    },
    async deleteAffaireLink(affaireId, linkId) {
      return this.request(`/affaires/${affaireId}/links/${linkId}`, { method: 'DELETE' });
    },
  });
}
