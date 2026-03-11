// API — Administration, Config, Utilisateurs, Accès, Pièces jointes, Google Config

export function registerAdminMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {

    // Configuration
    async getConfig(key) {
      return this.request(`/config/${key}`);
    },
    async saveConfig(key, value) {
      return this.request(`/config/${key}`, { method: 'POST', body: JSON.stringify(value) });
    },

    // Gestion des utilisateurs (admin)
    async getAuthorizedEmails() {
      return this.request('/authorized-emails');
    },
    async addAuthorizedEmail(email) {
      return this.request('/authorized-emails', { method: 'POST', body: JSON.stringify({ email }) });
    },
    async removeAuthorizedEmail(id) {
      return this.request(`/authorized-emails/${id}`, { method: 'DELETE' });
    },
    async getUsers() {
      return this.request('/users');
    },
    async updateUser(id, updates) {
      return this.request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    },
    async deleteUser(id) {
      return this.request(`/users/${id}`, { method: 'DELETE' });
    },
    async resetUserPassword(userId, newPassword) {
      return this.request('/admin/reset-password', { method: 'POST', body: JSON.stringify({ userId, newPassword }) });
    },
    async changePassword(currentPassword, newPassword) {
      return this.request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
    },

    // Configuration Google Calendar
    async getGoogleClientId() {
      return this.request('/config/google/client-id');
    },
    async getGoogleCalendarId() {
      return this.request('/config/google/calendar-id');
    },
    async getGoogleMapsApiKey() {
      return this.request('/config/google/maps-api-key');
    },
    async saveGoogleClientId(value) {
      return this.request('/config/google/client-id', { method: 'POST', body: JSON.stringify({ value }) });
    },
    async saveGoogleCalendarId(value) {
      return this.request('/config/google/calendar-id', { method: 'POST', body: JSON.stringify({ value }) });
    },
    async saveGoogleMapsApiKey(value) {
      return this.request('/config/google/maps-api-key', { method: 'POST', body: JSON.stringify({ value }) });
    },

    // Demandes d'accès
    async getAccessRequests() {
      return this.request('/access-requests');
    },
    async updateAccessRequest(requestId, status, isAdmin = false) {
      return this.request(`/access-requests/${requestId}`, { method: 'PATCH', body: JSON.stringify({ status, is_admin: isAdmin }) });
    },
    async getPendingAccessRequestsCount() {
      return this.request('/access-requests/count/pending');
    },
    async getPendingRequestsCount() {
      return this.request('/pending-requests-count');
    },
    async getPendingReservationRequests() {
      return this.request('/reservation-requests/pending');
    },

    // Pièces jointes
    async getAttachmentsIndex() {
      return this.request('/attachments-index');
    },

    // Utilisateurs
    async getUsersNames() {
      return this.request('/users/names');
    },

    // Alertes de complétion
    async getCompletionAlerts(unreadOnly = false) {
      return this.request(`/completion-alerts?unread_only=${unreadOnly}`);
    },
    async markAlertRead(id) {
      return this.request(`/completion-alerts/${id}/read`, { method: 'PUT' });
    },
    async markAllAlertsRead() {
      return this.request('/completion-alerts/mark-all-read', { method: 'PUT' });
    },
  });
}
