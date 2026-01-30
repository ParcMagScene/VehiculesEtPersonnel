// API Client pour communiquer avec le backend

const API_URL = 'http://localhost:3000/api';

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

    return data;
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
      body: JSON.stringify(reservation),
    });
  }

  async updateReservation(id, reservation) {
    return this.request(`/reservations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(reservation),
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
      body: JSON.stringify(maintenance),
    });
  }

  async updateMaintenance(id, maintenance) {
    return this.request(`/maintenances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(maintenance),
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
}

export const api = new ApiClient();
export default api;
