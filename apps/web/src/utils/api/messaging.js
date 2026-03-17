// API — Messagerie + Préférences utilisateur

export function registerMessagingMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {

    async getConversations() {
      return this.request('/messaging/conversations');
    },
    async createConversation(type, title, participantIds) {
      return this.request('/messaging/conversations', { method: 'POST', body: JSON.stringify({ type, title, participantIds }) });
    },
    async getMessages(conversationId, limit = 50, before = null) {
      let url = `/messaging/conversations/${conversationId}/messages?limit=${limit}`;
      if (before) url += `&before=${before}`;
      return this.request(url);
    },
    async sendMessage(conversationId, content, type = 'text') {
      return this.request(`/messaging/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ content, type }) });
    },
    async sendFileMessage(conversationId, filename, base64Data, mimeType) {
      return this.request(`/messaging/conversations/${conversationId}/messages/file`, { method: 'POST', body: JSON.stringify({ filename, data: base64Data, mimeType }) });
    },
    async markConversationRead(conversationId) {
      return this.request(`/messaging/conversations/${conversationId}/read`, { method: 'POST' });
    },
    async getUnreadCount() {
      return this.request('/messaging/unread-count');
    },

    // Préférences utilisateur
    async getPreferences() {
      return this.request('/users/me/preferences');
    },
    async savePreferences(prefs) {
      return this.request('/users/me/preferences', { method: 'PUT', body: JSON.stringify(prefs) });
    },
  });
}
