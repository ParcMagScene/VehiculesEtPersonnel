// API — Display Dashboard (Écrans, Playlists, Médias, Messages, Templates, Logs, Stats, TV Config)
import { API_URL } from './base.js';

export function registerDisplayMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {

    // Écrans
    async getDisplayScreens() {
      return this.request('/display/screens');
    },
    async getDisplayScreen(id) {
      return this.request(`/display/screens/${id}`);
    },
    async createDisplayScreen(data) {
      return this.request('/display/screens', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateDisplayScreen(id, data) {
      return this.request(`/display/screens/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteDisplayScreen(id) {
      return this.request(`/display/screens/${id}`, { method: 'DELETE' });
    },
    async heartbeatDisplayScreen(id) {
      return this.request(`/display/screens/${id}/heartbeat`, { method: 'PATCH' });
    },

    // Playlists
    async getDisplayPlaylists() {
      return this.request('/display/playlists');
    },
    async getDisplayPlaylist(id) {
      return this.request(`/display/playlists/${id}`);
    },
    async createDisplayPlaylist(data) {
      return this.request('/display/playlists', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateDisplayPlaylist(id, data) {
      return this.request(`/display/playlists/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteDisplayPlaylist(id) {
      return this.request(`/display/playlists/${id}`, { method: 'DELETE' });
    },
    async updateDisplayPlaylistItems(id, items) {
      return this.request(`/display/playlists/${id}/items`, { method: 'PUT', body: JSON.stringify({ items }) });
    },

    // Médias
    async getDisplayMedia(params) {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return this.request(`/display/media${query}`);
    },
    async uploadDisplayMedia(formData) {
      const response = await fetch(`${API_URL}/display/media`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${response.status}`);
      }
      return response.json();
    },
    async deleteDisplayMedia(id) {
      return this.request(`/display/media/${id}`, { method: 'DELETE' });
    },

    // Messages
    async getDisplayMessages(params) {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return this.request(`/display/messages${query}`);
    },
    async createDisplayMessage(data) {
      return this.request('/display/messages', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateDisplayMessage(id, data) {
      return this.request(`/display/messages/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteDisplayMessage(id) {
      return this.request(`/display/messages/${id}`, { method: 'DELETE' });
    },

    // Templates
    async getDisplayTemplates() {
      return this.request('/display/templates');
    },
    async createDisplayTemplate(data) {
      return this.request('/display/templates', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateDisplayTemplate(id, data) {
      return this.request(`/display/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteDisplayTemplate(id) {
      return this.request(`/display/templates/${id}`, { method: 'DELETE' });
    },

    // Logs & Stats
    async getDisplayLogs(params) {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return this.request(`/display/logs${query}`);
    },
    async getDisplayStats() {
      return this.request('/display/stats');
    },

    // Apparence
    async getDisplayAppearance() {
      return this.request('/display/appearance');
    },
    async saveDisplayAppearance(data) {
      return this.request('/display/appearance', { method: 'POST', body: JSON.stringify(data) });
    },

    // Messages d'accueil
    async getDisplayWelcomeMessages() {
      return this.request('/display/welcome-messages');
    },
    async saveDisplayWelcomeMessages(data) {
      return this.request('/display/welcome-messages', { method: 'POST', body: JSON.stringify(data) });
    },
    async getDisplayWelcomeMessage() {
      return this.request('/display/welcome-message');
    },

    // Règles de couleurs
    async getDisplayColorRules() {
      return this.request('/display/color-rules');
    },
    async saveDisplayColorRules(rules) {
      return this.request('/display/color-rules', { method: 'POST', body: JSON.stringify({ rules }) });
    },

    // Sidebar config
    async getDisplaySidebarConfig() {
      return this.request('/display/sidebar-config');
    },
    async saveDisplaySidebarConfig(sections) {
      return this.request('/display/sidebar-config', { method: 'POST', body: JSON.stringify({ sections }) });
    },

    // GIFs / Icônes de lieux
    async getDisplayLocationGifs() {
      return this.request('/display/location-gifs');
    },
    async uploadDisplayLocationGif(formData) {
      const response = await fetch(`${API_URL}/display/location-gifs`, { method: 'POST', credentials: 'include', body: formData });
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `Erreur ${response.status}`); }
      return response.json();
    },
    async deleteDisplayLocationGif(filename) {
      return this.request(`/display/location-gifs/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    },
    async getDisplayLocationIconRules() {
      return this.request('/display/location-icon-rules');
    },
    async saveDisplayLocationIconRules(rules) {
      return this.request('/display/location-icon-rules', { method: 'POST', body: JSON.stringify({ rules }) });
    },

    // Logo
    async getDisplayLogo() {
      return this.request('/display/logo');
    },
    async uploadDisplayLogo(formData) {
      const response = await fetch(`${API_URL}/display/logo`, { method: 'POST', credentials: 'include', body: formData });
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `Erreur ${response.status}`); }
      return response.json();
    },

    // Photo furtive
    async uploadDisplaySneakyPhoto(formData) {
      const response = await fetch(`${API_URL}/display/sneaky-photo`, { method: 'POST', credentials: 'include', body: formData });
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `Erreur ${response.status}`); }
      return response.json();
    },
    async getDisplaySneakyPhotoStatus() {
      return this.request('/display/sneaky-photo/status');
    },
    async deleteDisplaySneakyPhoto() {
      return this.request('/display/sneaky-photo', { method: 'DELETE' });
    },

    // Message furtif
    async activateDisplaySneakyMessage(message, duration) {
      return this.request('/display/sneaky-message', { method: 'POST', body: JSON.stringify({ message, duration }) });
    },
    async getDisplaySneakyMessageStatus() {
      return this.request('/display/sneaky-message/status');
    },
    async deleteDisplaySneakyMessage() {
      return this.request('/display/sneaky-message', { method: 'DELETE' });
    },

    // Météo
    async getDisplayWeather() {
      return this.request('/display/weather');
    },

    // Sonos → voir api/sonos.js

    async getDisplayTVState() {
      return this.request('/display/tv-state');
    },
    async triggerTVAlarmTest() {
      return this.request('/display/tv/test-alarm', { method: 'POST' });
    },
  });
}
