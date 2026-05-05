// API — Configuration Email + Mailing Avancé

export function registerMailingMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    // Configuration Email
    async getEmailConfig() {
      return this.request('/email-config');
    },
    async updateEmailConfig(config) {
      return this.request('/email-config', { method: 'PUT', body: JSON.stringify(config) });
    },
    async testEmail() {
      return this.request('/email-config/test', { method: 'POST' });
    },

    // Mailing Avancé
    async getMailTemplates() {
      return this.request('/mail-templates');
    },
    async getMailTemplate(id) {
      return this.request(`/mail-templates/${id}`);
    },
    async createMailTemplate(data) {
      return this.request('/mail-templates', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateMailTemplate(id, data) {
      return this.request(`/mail-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteMailTemplate(id) {
      return this.request(`/mail-templates/${id}`, { method: 'DELETE' });
    },
    async sendMailing(data) {
      return this.request('/mailing/send', { method: 'POST', body: JSON.stringify(data) });
    },
    async previewMailing(data) {
      return this.request('/mailing/preview', { method: 'POST', body: JSON.stringify(data) });
    },
    async getMailingHistory(limit = 50, offset = 0) {
      return this.request(`/mailing/history?limit=${limit}&offset=${offset}`);
    },
    async getMailingContacts() {
      return this.request('/mailing/contacts');
    },
  });
}
