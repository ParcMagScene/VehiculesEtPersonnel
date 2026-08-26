// API — Administration, Config, Utilisateurs, Accès, Pièces jointes, Google Config

const PENDING_COUNTERS_CACHE_TTL_MS = 5000;

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
      return this.request('/authorized-emails', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },
    async removeAuthorizedEmail(id) {
      return this.request(`/authorized-emails/${id}`, { method: 'DELETE' });
    },
    async getUsers() {
      return this.request('/users');
    },
    async createUser(
      email,
      name,
      password,
      { isAdmin = false, readOnly = false, permissions } = {},
    ) {
      return this.request('/users', {
        method: 'POST',
        body: JSON.stringify({ email, name, password, isAdmin, readOnly, permissions }),
      });
    },
    async updateUser(id, updates) {
      return this.request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    },
    async deleteUser(id) {
      return this.request(`/users/${id}`, { method: 'DELETE' });
    },
    async resetUserPassword(userId, newPassword) {
      return this.request('/admin/reset-password', {
        method: 'POST',
        body: JSON.stringify({ userId, newPassword }),
      });
    },
    async changePassword(currentPassword, newPassword) {
      return this.request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
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
      return this.request('/config/google/client-id', {
        method: 'POST',
        body: JSON.stringify({ value }),
      });
    },
    async saveGoogleCalendarId(value) {
      return this.request('/config/google/calendar-id', {
        method: 'POST',
        body: JSON.stringify({ value }),
      });
    },
    async saveGoogleMapsApiKey(value) {
      return this.request('/config/google/maps-api-key', {
        method: 'POST',
        body: JSON.stringify({ value }),
      });
    },

    // Google Calendar — Service Account (serveur uniquement, sans OAuth utilisateur)
    async getGoogleOAuthConfigured() {
      const status = await this.request('/calendar/status');
      return { configured: !!status?.configured };
    },
    async getGoogleOAuthStatus() {
      const status = await this.request('/calendar/status');
      return {
        connected: !!status?.configured,
        configured: !!status?.configured,
        mode: status?.mode,
        serviceAccountEmail: status?.serviceAccountEmail,
        calendarId: status?.calendarId,
        canWrite: !!status?.canWrite,
        scopes: status?.scopes || [],
      };
    },
    async getGoogleOAuthUrl() {
      throw new Error(
        'Flux OAuth utilisateur supprimé: configuration via Service Account uniquement',
      );
    },
    async disconnectGoogle() {
      throw new Error('Flux OAuth utilisateur supprimé: aucune déconnexion utilisateur nécessaire');
    },
    async getCalendarServiceStatus() {
      return this.request('/calendar/status');
    },
    async getGoogleCalendarsV2() {
      return this.request('/google/calendars');
    },
    async addGoogleCalendarV2(body) {
      return this.request('/google/calendars', { method: 'POST', body: JSON.stringify(body) });
    },
    async getGoogleEventsV2(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/calendar/events${qs ? '?' + qs : ''}`);
    },
    async getGoogleEventV2(eventId, calendarId) {
      const qs = calendarId ? `?calendarId=${encodeURIComponent(calendarId)}` : '';
      return this.request(`/calendar/events/${encodeURIComponent(eventId)}${qs}`);
    },
    async createGoogleEventV2(eventData, calendarId) {
      const qs = calendarId ? `?calendarId=${encodeURIComponent(calendarId)}` : '';
      return this.request(`/google/events${qs}`, {
        method: 'POST',
        body: JSON.stringify(eventData),
      });
    },
    async updateGoogleEventV2(eventId, eventData, calendarId) {
      const qs = calendarId ? `?calendarId=${encodeURIComponent(calendarId)}` : '';
      return this.request(`/google/events/${encodeURIComponent(eventId)}${qs}`, {
        method: 'PATCH',
        body: JSON.stringify(eventData),
      });
    },
    async deleteGoogleEventV2(eventId, calendarId) {
      const qs = calendarId ? `?calendarId=${encodeURIComponent(calendarId)}` : '';
      return this.request(`/google/events/${encodeURIComponent(eventId)}${qs}`, {
        method: 'DELETE',
      });
    },
    async syncPullReservations(days = 90) {
      throw new Error(
        `Synchronisation pull désactivée en mode Service Account readonly (days=${days})`,
      );
    },

    // Demandes d'accès
    async getAccessRequests() {
      return this.request('/access-requests');
    },
    async checkEmailAccessRequest(email) {
      return this.request('/access-requests/check-email', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },
    async createAccessRequest(data) {
      const result = await this.request('/access-requests', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      this._shortLivedCountersCache?.delete('pending-access-requests-count');
      this._shortLivedCountersCache?.delete('pending-requests-count');
      return result;
    },
    async updateAccessRequest(requestId, status, isAdmin = false) {
      const result = await this.request(`/access-requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, is_admin: isAdmin }),
      });
      this._shortLivedCountersCache?.delete('pending-access-requests-count');
      this._shortLivedCountersCache?.delete('pending-requests-count');
      return result;
    },
    async getPendingAccessRequestsCount() {
      if (!this._shortLivedCountersCache) this._shortLivedCountersCache = new Map();
      const cacheKey = 'pending-access-requests-count';
      const cached = this._shortLivedCountersCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }
      const data = await this.request('/access-requests/count/pending');
      this._shortLivedCountersCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + PENDING_COUNTERS_CACHE_TTL_MS,
      });
      return data;
    },
    async getPendingRequestsCount() {
      if (!this._shortLivedCountersCache) this._shortLivedCountersCache = new Map();
      const cacheKey = 'pending-requests-count';
      const cached = this._shortLivedCountersCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }
      const data = await this.request('/pending-requests-count');
      this._shortLivedCountersCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + PENDING_COUNTERS_CACHE_TTL_MS,
      });
      return data;
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
