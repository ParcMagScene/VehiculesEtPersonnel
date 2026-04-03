// API — Parc Matériel (Catégories, Items, SAV, Listes, Photos, Assignments)
import { API_URL } from './base.js';

export function registerEquipmentMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {

    // Catégories
    async getEquipmentCategories() {
      return this.request('/equipment-categories');
    },
    async createEquipmentCategory(data) {
      return this.request('/equipment-categories', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateEquipmentCategory(id, data) {
      return this.request(`/equipment-categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteEquipmentCategory(id) {
      return this.request(`/equipment-categories/${id}`, { method: 'DELETE' });
    },

    // Équipements
    async getEquipment(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/equipment${qs ? '?' + qs : ''}`);
    },
    async getEquipmentById(id) {
      return this.request(`/equipment/${id}`);
    },
    async createEquipment(data) {
      return this.request('/equipment', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateEquipment(id, data) {
      return this.request(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteEquipment(id) {
      return this.request(`/equipment/${id}`, { method: 'DELETE' });
    },
    async serializeEquipment(id) {
      return this.request(`/equipment/${id}/serialize`, { method: 'POST' });
    },
    async linkEquipmentPhoto(id, photo) {
      return this.request(`/equipment/${id}/photo`, { method: 'PATCH', body: JSON.stringify({ photo }) });
    },
    async importEquipmentCsv(data, mode = 'import') {
      return this.request('/equipment/import-csv', { method: 'POST', body: JSON.stringify({ data, mode }) });
    },
    async getEquipmentCategoriesTree() {
      return this.request('/equipment-categories/tree');
    },
    async getEquipmentByUid(uid) {
      return this.request(`/equipment/by-uid/${uid}`);
    },

    // Assignments matériel
    async getEquipmentAssignments(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/equipment-assignments${qs ? '?' + qs : ''}`);
    },
    async createEquipmentAssignment(data) {
      return this.request('/equipment-assignments', { method: 'POST', body: JSON.stringify(data) });
    },
    async returnEquipmentAssignment(id) {
      return this.request(`/equipment-assignments/${id}/return`, { method: 'PUT' });
    },

    // Tickets SAV
    async getSavTickets(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/sav-tickets${qs ? '?' + qs : ''}`);
    },
    async getSavTicketStats() {
      return this.request('/sav-tickets/stats');
    },
    async getSavTicketReport(start, end, type = 'all') {
      const qs = new URLSearchParams({ start, end, type }).toString();
      return this.request(`/sav-tickets/report?${qs}`);
    },
    async createSavTicket(data) {
      return this.request('/sav-tickets', { method: 'POST', body: JSON.stringify(data) });
    },
    async createSavRequest(data) {
      return this.request('/sav-tickets/request', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateSavTicket(id, data) {
      return this.request(`/sav-tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteSavTicket(id) {
      return this.request(`/sav-tickets/${id}`, { method: 'DELETE' });
    },
    async importSavTicketsCsv(data, mode = 'import', manualLinks = null, skipDuplicates = false, updateDuplicates = false) {
      return this.request('/sav-tickets/import-csv', { method: 'POST', body: JSON.stringify({ data, mode, manualLinks, skipDuplicates, updateDuplicates }) });
    },
    async removeSavDuplicates() {
      return this.request('/sav-tickets/duplicates', { method: 'DELETE' });
    },
    async getUnlinkedSavTickets() {
      return this.request('/sav-tickets/unlinked');
    },
    async linkSavTicket(ticketId, equipmentId) {
      return this.request(`/sav-tickets/${ticketId}/link`, { method: 'PUT', body: JSON.stringify({ equipment_id: equipmentId }) });
    },

    // PDF SAV
    async exportSavReportPdf(start, end, type = 'all') {
      const qs = new URLSearchParams({ start, end, type }).toString();
      const resp = await fetch(`${API_URL}/sav-tickets/report/pdf?${qs}`, { credentials: 'include' });
      if (!resp.ok) throw new Error('Erreur export PDF rapport maintenance');
      return resp.blob();
    },
    async exportSavActivePdf() {
      const resp = await fetch(`${API_URL}/sav-tickets/active/pdf`, { credentials: 'include' });
      if (!resp.ok) throw new Error('Erreur export PDF matériel en SAV');
      return resp.blob();
    },

    // Listes Favoris / Surveillance
    async getEquipmentLists() {
      return this.request('/equipment-lists');
    },
    async addToEquipmentList(equipment_id, list_type) {
      return this.request('/equipment-lists', { method: 'POST', body: JSON.stringify({ equipment_id, list_type }) });
    },
    async removeFromEquipmentList(equipment_id, list_type) {
      return this.request('/equipment-lists', { method: 'DELETE', body: JSON.stringify({ equipment_id, list_type }) });
    },

    // Photos
    async getEquipmentPhotos() {
      return this.request('/equipment-photos');
    },
    async uploadEquipmentPhotos(files) {
      const formData = new FormData();
      for (const file of files) {
        formData.append('photos', file);
      }
      const res = await fetch(`${API_URL}/equipment-photos/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur upload');
      }
      return res.json();
    },
    async deleteEquipmentPhoto(filename) {
      return this.request(`/equipment-photos/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    },
    async renameEquipmentPhoto(oldName, newName) {
      return this.request('/equipment-photos/rename', { method: 'PUT', body: JSON.stringify({ oldName, newName }) });
    },

    // Zones de dépôt
    async getEquipmentDepotZones(depotId) {
      const qs = depotId ? `?depot=${depotId}` : '';
      return this.request(`/equipment-depot-zones${qs}`);
    },
    async updateEquipmentDepotZones(zones, depotId) {
      return this.request('/equipment-depot-zones', { method: 'PUT', body: JSON.stringify({ zones, depot: depotId }) });
    },
    async getAllDepotZones() {
      return this.request('/equipment-all-depot-zones');
    },
    async getEquipmentLocationStats() {
      return this.request('/equipment-location-stats');
    },
  });
}
