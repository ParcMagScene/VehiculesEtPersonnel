// API Client pour communiquer avec le backend

// Détection automatique de l'URL du backend
const getApiUrl = () => {
  const hostname = window.location.hostname;
  
  // Si on accède via DuckDNS, utiliser DuckDNS pour le backend aussi
  if (hostname === 'magsav.duckdns.org') {
    return 'http://magsav.duckdns.org:3002/api';
  }
  
  // Sinon utiliser l'IP locale
  return 'http://192.168.205.75:3002/api';
};

const API_URL = getApiUrl();

// Convertir snake_case en camelCase
function toCamelCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCase(item));
  }
  
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  const camelObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    camelObj[camelKey] = toCamelCase(obj[key]);
  }
  return camelObj;
}

// Convertir camelCase en snake_case
function toSnakeCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => toSnakeCase(item));
  }
  
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  const snakeObj = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    snakeObj[snakeKey] = toSnakeCase(obj[key]);
  }
  return snakeObj;
}

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('auth_token');
    this.user = JSON.parse(localStorage.getItem('auth_user') || 'null');
  }

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  }

  clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 || response.status === 403) {
      this.clearAuth();
      window.location.reload();
      throw new Error('Session expirée');
    }

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Erreur serveur');
    }

    // Convertir les données de snake_case en camelCase
    return toCamelCase(data);
  }

  // Authentification
  async register(email, name, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, name, password }),
    });
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setAuth(data.token, data.user);
    return data;
  }

  logout() {
    this.clearAuth();
    window.location.reload();
  }

  isAuthenticated() {
    return !!this.token;
  }

  getCurrentUser() {
    return this.user;
  }

  // Véhicules
  async getVehicles() {
    return this.request('/vehicles');
  }

  async createVehicle(vehicle) {
    return this.request('/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicle),
    });
  }

  async updateVehicle(id, vehicle) {
    return this.request(`/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(vehicle),
    });
  }

  async deleteVehicle(id) {
    return this.request(`/vehicles/${id}`, {
      method: 'DELETE',
    });
  }

  // Réservations
  async getReservations() {
    return this.request('/reservations');
  }

  async createReservation(reservation) {
    return this.request('/reservations', {
      method: 'POST',
      body: JSON.stringify(toSnakeCase(reservation)),
    });
  }

  async updateReservation(id, reservation) {
    return this.request(`/reservations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnakeCase(reservation)),
    });
  }

  async deleteReservation(id) {
    return this.request(`/reservations/${id}`, {
      method: 'DELETE',
    });
  }

  // Maintenances
  async getMaintenances() {
    return this.request('/maintenances');
  }

  async createMaintenance(maintenance) {
    return this.request('/maintenances', {
      method: 'POST',
      body: JSON.stringify(toSnakeCase(maintenance)),
    });
  }

  async updateMaintenance(id, maintenance) {
    return this.request(`/maintenances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnakeCase(maintenance)),
    });
  }

  async deleteMaintenance(id) {
    return this.request(`/maintenances/${id}`, {
      method: 'DELETE',
    });
  }

  // Historique
  async getHistory(entityType, entityId) {
    return this.request(`/history/${entityType}/${entityId}`);
  }

  // Clients
  async getClients() {
    return this.request('/clients');
  }

  async createClient(client) {
    return this.request('/clients', {
      method: 'POST',
      body: JSON.stringify(client),
    });
  }

  async updateClient(id, client) {
    return this.request(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(client),
    });
  }

  async deleteClient(id) {
    return this.request(`/clients/${id}`, {
      method: 'DELETE',
    });
  }

  // Conducteurs
  async getDrivers() {
    return this.request('/drivers');
  }

  async createDriver(driver) {
    return this.request('/drivers', {
      method: 'POST',
      body: JSON.stringify(driver),
    });
  }

  async updateDriver(id, driver) {
    return this.request(`/drivers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(driver),
    });
  }

  async deleteDriver(id) {
    return this.request(`/drivers/${id}`, {
      method: 'DELETE',
    });
  }

  // Lieux
  async getLocations() {
    return this.request('/locations');
  }

  async createLocation(location) {
    return this.request('/locations', {
      method: 'POST',
      body: JSON.stringify(location),
    });
  }

  async updateLocation(id, location) {
    return this.request(`/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(location),
    });
  }

  async deleteLocation(id) {
    return this.request(`/locations/${id}`, {
      method: 'DELETE',
    });
  }

  // Garages
  async getGarages() {
    return this.request('/garages');
  }

  async createGarage(garage) {
    return this.request('/garages', {
      method: 'POST',
      body: JSON.stringify(garage),
    });
  }

  async updateGarage(id, garage) {
    return this.request(`/garages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(garage),
    });
  }

  async deleteGarage(id) {
    return this.request(`/garages/${id}`, {
      method: 'DELETE',
    });
  }

  // Configuration
  async getConfig(key) {
    return this.request(`/config/${key}`);
  }

  async saveConfig(key, value) {
    return this.request(`/config/${key}`, {
      method: 'POST',
      body: JSON.stringify(value),
    });
  }

  // Gestion des utilisateurs (admin)
  async getAuthorizedEmails() {
    return this.request('/admin/authorized-emails');
  }

  async addAuthorizedEmail(email) {
    return this.request('/admin/authorized-emails', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async removeAuthorizedEmail(id) {
    return this.request(`/admin/authorized-emails/${id}`, {
      method: 'DELETE',
    });
  }

  async getUsers() {
    return this.request('/admin/users');
  }

  async resetUserPassword(userId, newPassword) {
    return this.request('/admin/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId, newPassword }),
    });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Configuration Google Calendar
  async getGoogleClientId() {
    return this.request('/config/google/client-id');
  }

  async getGoogleCalendarId() {
    return this.request('/config/google/calendar-id');
  }

  async getGoogleMapsApiKey() {
    return this.request('/config/google/maps-api-key');
  }

  async saveGoogleClientId(value) {
    return this.request('/config/google/client-id', {
      method: 'POST',
      body: JSON.stringify({ value }),
    });
  }

  async saveGoogleCalendarId(value) {
    return this.request('/config/google/calendar-id', {
      method: 'POST',
      body: JSON.stringify({ value }),
    });
  }

  async saveGoogleMapsApiKey(value) {
    return this.request('/config/google/maps-api-key', {
      method: 'POST',
      body: JSON.stringify({ value }),
    });
  }

  // ============ DEMANDES D'ACCÈS ============

  async getAccessRequests() {
    return this.request('/access-requests');
  }

  async updateAccessRequest(requestId, status) {
    return this.request(`/access-requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getPendingAccessRequestsCount() {
    return this.request('/access-requests/count/pending');
  }
}

export const api = new ApiClient();
export default api;
