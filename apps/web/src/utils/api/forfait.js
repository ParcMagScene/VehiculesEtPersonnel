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
// ─── Extension : forfait couches 4 & 5 (poses, entretiens, alertes) ───
export function registerForfaitLayer45(ApiClient) {
  Object.assign(ApiClient.prototype, {
    async validateForfaitPose(payload) {
      return this.request('/forfait/validate-pose', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async listForfaitPoses(personId, params = {}) {
      const q = new URLSearchParams(params).toString();
      return this.request(`/forfait/poses/${personId}${q ? `?${q}` : ''}`);
    },
    async createForfaitPose(payload) {
      return this.request('/forfait/poses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async listForfaitEntretiens(personId, year) {
      const q = year ? `?year=${year}` : '';
      return this.request(`/forfait/entretiens/${personId}${q}`);
    },
    async createForfaitEntretien(payload) {
      return this.request('/forfait/entretiens', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async updateForfaitEntretien(id, payload) {
      return this.request(`/forfait/entretiens/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    async listForfaitAlerts(personId, params = {}) {
      const q = new URLSearchParams(params).toString();
      return this.request(`/forfait/alerts/${personId}${q ? `?${q}` : ''}`);
    },
    async createForfaitAlert(payload) {
      return this.request('/forfait/alerts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async resolveForfaitAlert(id, payload) {
      return this.request(`/forfait/alerts/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async getForfaitCompliance(personId, year) {
      return this.request(`/forfait/compliance/${personId}/${year}`);
    },
  });
}
