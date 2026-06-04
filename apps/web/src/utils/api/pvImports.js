// API — Module Import PV (Procès-Verbaux PDF)
//
// Toutes les routes utilisent skipCamelCase pour conserver les clés
// snake_case telles que renvoyées par le backend (cohérent avec le
// module controles : parsed_data, file_path, matched_count, ...).

export function registerPvImportsMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    /**
     * Upload un ou plusieurs PDFs (multipart).
     * @param {File[]} files
     * @returns {Promise<{success, created, skipped}>}
     */
    async uploadPvImports(files) {
      const form = new FormData();
      for (const f of files) form.append('files', f);
      return this.requestFormData('/pv-imports/upload', form, { skipCamelCase: true });
    },

    async listPvImports({ status = null, limit = 50, offset = 0 } = {}) {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      qs.set('limit', String(limit));
      qs.set('offset', String(offset));
      return this.request(`/pv-imports?${qs.toString()}`, { skipCamelCase: true });
    },

    async getPvImport(id) {
      return this.request(`/pv-imports/${id}`, { skipCamelCase: true });
    },

    async applyPvImport(id, mapping) {
      return this.request(`/pv-imports/${id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ mapping }),
        skipCamelCase: true,
      });
    },

    async deletePvImport(id, { hard = false } = {}) {
      return this.request(`/pv-imports/${id}${hard ? '?hard=1' : ''}`, {
        method: 'DELETE',
        skipCamelCase: true,
      });
    },

    async getPvByEquipment(equipmentId) {
      return this.request(`/pv-imports/by-equipment/${equipmentId}`, { skipCamelCase: true });
    },

    async getPvByVehicle(vehicleId) {
      return this.request(`/pv-imports/by-vehicle/${vehicleId}`, { skipCamelCase: true });
    },
  });
}
