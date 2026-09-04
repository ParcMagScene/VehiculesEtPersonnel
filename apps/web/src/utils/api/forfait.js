// API client — module forfait-jours.
export function registerForfaitMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    async getForfaitConfig(personId) {
      return this.request(`/forfait/config/${personId}`);
    },
    async updateForfaitConfig(personId, config) {
      return this.request(`/forfait/config/${personId}`, {
        method: 'PUT',
        body: JSON.stringify(config),
      });
    },
    async getForfaitHolidays(year) {
      return this.request(`/forfait/holidays/${year}`);
    },
    async getForfaitReferenceTable() {
      return this.request('/forfait/reference-table');
    },
    async calcForfaitEntree(payload) {
      return this.request('/forfait/calc/entree', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async calcForfaitSortie(payload) {
      return this.request('/forfait/calc/sortie', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async calcForfaitReposAnnuels(payload) {
      return this.request('/forfait/calc/repos-annuels', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async calcForfaitRachat(payload) {
      return this.request('/forfait/calc/rachat', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async calcForfaitReduit(payload) {
      return this.request('/forfait/calc/reduit', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async getForfaitBilan(personId, year) {
      return this.request(`/forfait/bilan/${personId}/${year}`);
    },
  });
}
