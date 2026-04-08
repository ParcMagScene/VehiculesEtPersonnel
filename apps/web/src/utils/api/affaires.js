// API — Module Affaires + Liaisons + Pièces jointes
import { API_URL } from './base.js';

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
      const response = await fetch(`${API_URL}/upload-attachment`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Échec de l'upload de ${file.name}`);
      }
      return response.json();
    },
    async deleteAttachment(affaireId, filename) {
      return this.request(`/attachments/${encodeURIComponent(affaireId)}/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    },
    async uploadBL(file, affaireId) {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('affaireId', affaireId);
      const response = await fetch(`${API_URL}/upload-bl`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur upload BL');
      }
      return response.json();
    },
  });
}
