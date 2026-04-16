// API — Module Affaires + Liaisons + Pièces jointes

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
      return this.request('/affaires/sync-google-events', {
        method: 'POST',
        body: JSON.stringify({ events }),
      });
    },

    // Liaisons entre affaires
    async getAffaireLinks(affaireId) {
      return this.request(`/affaires/${affaireId}/links`);
    },
    async createAffaireLink(parentId, childAffaireId) {
      return this.request(`/affaires/${parentId}/links`, {
        method: 'POST',
        body: JSON.stringify({ childAffaireId }),
      });
    },
    async deleteAffaireLink(affaireId, linkId) {
      return this.request(`/affaires/${affaireId}/links/${linkId}`, { method: 'DELETE' });
    },

    // Annotation BP
    async getAnnotationData(affaireId, blImportId) {
      return this.request(`/affaires/${affaireId}/bp/annotate`, {
        method: 'POST',
        body: JSON.stringify({ blImportId }),
      });
    },

    // Pièces jointes
    async getAttachments(affaireId) {
      return this.request(`/attachments/${encodeURIComponent(affaireId)}`);
    },
    async uploadAttachment(file, affaireId) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('affaireId', affaireId);
      return this.requestFormData('/upload-attachment', formData);
    },
    async deleteAttachment(affaireId, filename) {
      return this.request(
        `/attachments/${encodeURIComponent(affaireId)}/${encodeURIComponent(filename)}`,
        { method: 'DELETE' },
      );
    },
    async uploadBL(file, affaireId) {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('affaireId', affaireId);
      return this.requestFormData('/upload-bl', formData);
    },

    // ═══ Phase 9 — Workflow ═══
    async changeAffaireStatus(id, status, { notes, force } = {}) {
      return this.request(`/affaires/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes, force }),
      });
    },
    async getAffaireHistory(id) {
      return this.request(`/affaires/${id}/history`);
    },
    async applyStepTemplate(id, { replace } = {}) {
      return this.request(`/affaires/${id}/apply-template`, {
        method: 'POST',
        body: JSON.stringify({ replace }),
      });
    },
    async getAffaireDashboard() {
      return this.request('/affaires/dashboard');
    },
  });
}
