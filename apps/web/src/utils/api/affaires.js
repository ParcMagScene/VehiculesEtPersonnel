// API — Module Affaires + Liaisons + Pièces jointes

export function registerAffairesMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    async getAffaires() {
      // Depuis le passage à la pagination cursor-based (commit 8e77b2e5), la
      // route GET /api/affaires renvoie systématiquement un objet
      //   { data: [...], nextCursor, total, hasMore }
      // alors que tous les callsites (AffairesPanel via fetchAffaires,
      // MobileAffaires, ReportsPanel, EventDetailsModal, AssignmentDialog,
      // AffaireDetailPanel, IncidentsSuiviPanel, useAffairesList) attendent
      // un tableau brut. Sans cet unwrap, `dbAffaires` restait vide côté
      // AffairesPanel et la liste n'affichait que les affaires détectées
      // depuis Google Calendar (dont le type est deviné à partir du titre,
      // défaut « Location »), ce qui masquait toute modification de type
      // persistée en base après un save.
      const raw = await this.request('/affaires');
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw?.data)) return raw.data;
      return [];
    },
    async getAffairesPersonnelCounts() {
      return this.request('/affaires/personnel-counts');
    },
    async getAffaireMobileDetail(numeroAffaire) {
      return this.request(`/affaires/mobile/${encodeURIComponent(numeroAffaire)}/detail`);
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
