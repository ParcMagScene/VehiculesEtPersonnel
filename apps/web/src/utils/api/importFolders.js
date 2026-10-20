export function registerImportFoldersMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    async listImportFolder(sectionId, path = '') {
      const query = new URLSearchParams();
      if (path) query.set('path', path);
      const suffix = query.size ? `?${query.toString()}` : '';
      return this.request(`/import-folders/${encodeURIComponent(sectionId)}${suffix}`);
    },
  });
}
