// API — Parc Matériel (Catégories, Items, SAV, Listes, Photos, Assignments)

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
      return this.request(`/equipment-categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
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
      return this.request(`/equipment/${id}/photo`, {
        method: 'PATCH',
        body: JSON.stringify({ photo }),
      });
    },
    async getEquipmentCategoriesTree() {
      return this.request('/equipment-categories/tree');
    },
    async getEquipmentByUid(uid) {
      return this.request(`/equipment/by-uid/${uid}`);
    },
    async getEquipmentByReference(reference) {
      return this.request(`/equipment/by-reference/${encodeURIComponent(reference)}`);
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
    async removeSavDuplicates() {
      return this.request('/sav-tickets/duplicates', { method: 'DELETE' });
    },
    async getUnlinkedSavTickets() {
      return this.request('/sav-tickets/unlinked');
    },
    async linkSavTicket(ticketId, equipmentId) {
      return this.request(`/sav-tickets/${ticketId}/link`, {
        method: 'PUT',
        body: JSON.stringify({ equipment_id: equipmentId }),
      });
    },

    // PDF SAV
    async exportSavReportPdf(start, end, type = 'all') {
      const qs = new URLSearchParams({ start, end, type }).toString();
      return this.requestBlob(`/sav-tickets/report/pdf?${qs}`);
    },
    async exportSavActivePdf() {
      return this.requestBlob('/sav-tickets/active/pdf');
    },

    // ───────────────────────────────────────────────────────
    // Module SAV unifié — synchro LocMat (Phase 3)
    // ───────────────────────────────────────────────────────
    async savImportPreview(file) {
      const formData = new FormData();
      formData.append('file', file);
      return this.requestFormData('/sav/import/preview', formData);
    },
    async savImportConfirm(file, decisions) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('decisions', JSON.stringify(decisions || {}));
      return this.requestFormData('/sav/import/confirm', formData);
    },
    async getSavImports() {
      return this.request('/sav/imports');
    },
    async getSavImport(id) {
      return this.request(`/sav/imports/${id}`);
    },
    async exportSavImportPdf(id) {
      return this.requestBlob(`/sav/imports/${id}/pdf`);
    },
    async getSavTicketsV2(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/sav/tickets${qs ? '?' + qs : ''}`);
    },
    async getSavTicketV2(id) {
      return this.request(`/sav/tickets/${id}`);
    },
    async patchSavTicket(id, data) {
      return this.request(`/sav/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    // Listes Favoris / Surveillance
    async getEquipmentLists() {
      return this.request('/equipment-lists');
    },
    async addToEquipmentList(equipment_id, list_type) {
      return this.request('/equipment-lists', {
        method: 'POST',
        body: JSON.stringify({ equipment_id, list_type }),
      });
    },
    async removeFromEquipmentList(equipment_id, list_type) {
      return this.request('/equipment-lists', {
        method: 'DELETE',
        body: JSON.stringify({ equipment_id, list_type }),
      });
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
      return this.requestFormData('/equipment-photos/upload', formData);
    },
    async deleteEquipmentPhoto(filename) {
      return this.request(`/equipment-photos/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
    },
    async renameEquipmentPhoto(oldName, newName) {
      return this.request('/equipment-photos/rename', {
        method: 'PUT',
        body: JSON.stringify({ oldName, newName }),
      });
    },

    // Zones de dépôt
    async getEquipmentDepotZones(depotId) {
      const qs = depotId ? `?depot=${depotId}` : '';
      return this.request(`/equipment-depot-zones${qs}`);
    },
    async updateEquipmentDepotZones(zones, depotId) {
      return this.request('/equipment-depot-zones', {
        method: 'PUT',
        body: JSON.stringify({ zones, depot: depotId }),
      });
    },
    async getAllDepotZones() {
      return this.request('/equipment-all-depot-zones');
    },
    async getEquipmentLocationStats() {
      return this.request('/equipment-location-stats');
    },
  });
}
