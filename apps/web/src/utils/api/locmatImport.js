// API — Module Import Locmat (Locations.csv + Serialise.csv)

export function registerLocmatImportMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    /**
     * Calcule le diff entre les CSV et la base, sans rien écrire.
     * @param {{locations:Array, serials:Array, source?:string}} payload
     */
    async previewLocmatImport(payload) {
      return this.request('/import/locmat/preview', {
        method: 'POST',
        body: JSON.stringify(payload),
        skipCamelCase: true,
      });
    },

    /**
     * Applique le diff validé par l'utilisateur (transactionnel côté serveur).
     * @param {object} payload Diff retourné par previewLocmatImport (newProducts,
     *   updatedProducts, quantityChanges, newSerials, removedSerials, source).
     */
    async confirmLocmatImport(payload) {
      return this.request('/import/locmat/confirm', {
        method: 'POST',
        body: JSON.stringify(payload),
        skipCamelCase: true,
      });
    },

    async getLocmatImportLogs(limit = 50) {
      return this.request(`/import/locmat/logs?limit=${limit}`, { skipCamelCase: true });
    },

    async getLocmatImportLogDetail(id) {
      return this.request(`/import/locmat/logs/${id}`, { skipCamelCase: true });
    },
  });
}
