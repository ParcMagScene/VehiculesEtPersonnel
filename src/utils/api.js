// API Client pour communiquer avec le backend

// Détection automatique de l'URL du backend
const getApiUrl = () => {
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // Si on est servi par Vite (dev port 5174 ou preview/production port 4173),
  // utiliser le chemin relatif → le proxy Vite redirige vers le backend
  // Cela évite les requêtes cross-origin qui peuvent échouer (PATCH notamment)
  if (port === '5174' || port === '4173') {
    return '/api';
  }
  
  // Accès direct DuckDNS (cas rare, sans Vite proxy)
  if (hostname === 'magsav.duckdns.org') {
    return 'http://magsav.duckdns.org:3002/api';
  }
  
  // Accès réseau local direct (sans Vite proxy) → backend port 3002
  return `http://${hostname}:3002/api`;
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
    // Si tous les éléments sont des primitives (strings, numbers, etc.), retourner tel quel
    if (obj.every(item => typeof item !== 'object' || item === null)) {
      return obj;
    }
    // Sinon convertir récursivement les objets du tableau
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

    // Ne pas traiter les erreurs 401/403 comme "session expirée" pour les endpoints de connexion
    const isAuthEndpoint = endpoint === '/auth/login' || endpoint === '/auth/register' || endpoint === '/auth/force-login';
    
    if ((response.status === 401 || response.status === 403) && !isAuthEndpoint) {
      this.clearAuth();
      window.location.reload();
      throw new Error('Session expirée');
    }

    const data = await response.json();
    
    if (!response.ok) {
      // Créer une erreur avec la réponse complète pour les erreurs spécifiques
      const error = new Error(data.error || 'Erreur serveur');
      error.response = { status: response.status, data };
      throw error;
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

  async logout() {
    // Appeler le endpoint backend pour supprimer la session
    if (this.token) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('✅ Déconnexion côté serveur réussie');
      } catch (err) {
        console.error('❌ Erreur lors de la déconnexion côté serveur:', err);
      }
    }
    
    this.clearAuth();
    // Pas de window.location.reload() - laisser React gérer le changement d'état
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
      body: JSON.stringify(toSnakeCase(vehicle)),
    });
  }

  async updateVehicle(id, vehicle) {
    return this.request(`/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnakeCase(vehicle)),
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

  // Demandes de réservation (pour non-admins)
  async getReservationRequests() {
    return this.request('/reservation-requests');
  }

  async getReservationRequests() {
    return this.request('/reservation-requests');
  }

  async createReservationRequest(request) {
    return this.request('/reservation-requests', {
      method: 'POST',
      body: JSON.stringify(toSnakeCase(request)),
    });
  }

  async approveReservationRequest(id) {
    return this.request(`/reservation-requests/${id}/approve`, {
      method: 'PUT',
    });
  }

  async rejectReservationRequest(id, reason) {
    return this.request(`/reservation-requests/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
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
    return this.request('/authorized-emails');
  }

  async addAuthorizedEmail(email) {
    return this.request('/authorized-emails', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async removeAuthorizedEmail(id) {
    return this.request(`/authorized-emails/${id}`, {
      method: 'DELETE',
    });
  }

  async getUsers() {
    return this.request('/users');
  }

  async updateUser(id, updates) {
    return this.request(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteUser(id) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async resetUserPassword(userId, newPassword) {
    return this.request('/users/reset-password', {
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

  async updateAccessRequest(requestId, status, isAdmin = false) {
    return this.request(`/access-requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, is_admin: isAdmin }),
    });
  }

  async getPendingAccessRequestsCount() {
    return this.request('/access-requests/count/pending');
  }

  async getPendingRequestsCount() {
    return this.request('/pending-requests-count');
  }

  async getPendingReservationRequests() {
    return this.request('/reservation-requests/pending');
  }

  // ============ PIÈCES JOINTES ============

  async getAttachmentsIndex() {
    return this.request('/attachments-index');
  }

  // ============ UTILISATEURS ============

  async getUsersNames() {
    return this.request('/users/names');
  }

  // ============ MODULE PLANNING PERSONNEL — MagLog 1.0 ============

  // — Personnes —

  async getPersons() {
    return this.request('/persons');
  }

  async getPerson(id) {
    return this.request(`/persons/${id}`);
  }

  async createPerson(person) {
    return this.request('/persons', {
      method: 'POST',
      body: JSON.stringify(person),
    });
  }

  async updatePerson(id, person) {
    return this.request(`/persons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(person),
    });
  }

  async deletePerson(id) {
    return this.request(`/persons/${id}`, {
      method: 'DELETE',
    });
  }

  // — Compétences —

  async getSkills() {
    return this.request('/skills');
  }

  async createSkill(skill) {
    return this.request('/skills', {
      method: 'POST',
      body: JSON.stringify(skill),
    });
  }

  async updateSkill(id, skill) {
    return this.request(`/skills/${id}`, {
      method: 'PUT',
      body: JSON.stringify(skill),
    });
  }

  async deleteSkill(id) {
    return this.request(`/skills/${id}`, {
      method: 'DELETE',
    });
  }

  // — Disponibilités —

  async getAvailabilities(params = {}) {
    const query = new URLSearchParams();
    if (params.personId) query.set('person_id', params.personId);
    if (params.startDate) query.set('start_date', params.startDate);
    if (params.endDate) query.set('end_date', params.endDate);
    const qs = query.toString();
    return this.request(`/availabilities${qs ? '?' + qs : ''}`);
  }

  async createAvailability(availability) {
    return this.request('/availabilities', {
      method: 'POST',
      body: JSON.stringify(availability),
    });
  }

  async updateAvailability(id, availability) {
    return this.request(`/availabilities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(availability),
    });
  }

  async deleteAvailability(id) {
    return this.request(`/availabilities/${id}`, {
      method: 'DELETE',
    });
  }

  // — Missions —

  async getMissions(params = {}) {
    const query = new URLSearchParams();
    if (params.startDate) query.set('start_date', params.startDate);
    if (params.endDate) query.set('end_date', params.endDate);
    if (params.status) query.set('status', params.status);
    if (params.reservationId) query.set('reservation_id', params.reservationId);
    const qs = query.toString();
    return this.request(`/missions${qs ? '?' + qs : ''}`);
  }

  async getMission(id) {
    return this.request(`/missions/${id}`);
  }

  async createMission(mission) {
    return this.request('/missions', {
      method: 'POST',
      body: JSON.stringify(mission),
    });
  }

  async updateMission(id, mission) {
    return this.request(`/missions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(mission),
    });
  }

  async deleteMission(id) {
    return this.request(`/missions/${id}`, {
      method: 'DELETE',
    });
  }

  // — Affectations —

  async getAssignments(params = {}) {
    const query = new URLSearchParams();
    if (params.personId) query.set('person_id', params.personId);
    if (params.missionId) query.set('mission_id', params.missionId);
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    return this.request(`/assignments${qs ? '?' + qs : ''}`);
  }

  async createAssignment(assignment) {
    return this.request('/assignments', {
      method: 'POST',
      body: JSON.stringify(assignment),
    });
  }

  async updateAssignment(id, assignment) {
    return this.request(`/assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(assignment),
    });
  }

  async deleteAssignment(id) {
    return this.request(`/assignments/${id}`, {
      method: 'DELETE',
    });
  }

  // — Planning global —

  async getPersonnelPlanning(params = {}) {
    const query = new URLSearchParams();
    if (params.startDate) query.set('start_date', params.startDate);
    if (params.endDate) query.set('end_date', params.endDate);
    if (params.personId) query.set('person_id', params.personId);
    if (params.skillId) query.set('skill_id', params.skillId);
    const qs = query.toString();
    return this.request(`/personnel/planning${qs ? '?' + qs : ''}`);
  }

  // ============ MODULE AFFAIRES ============

  async getAffaires() {
    return this.request('/affaires');
  }

  async createOrUpdateAffaire(affaire) {
    return this.request('/affaires', {
      method: 'POST',
      body: JSON.stringify(affaire),
    });
  }

  async updateAffaire(id, affaire) {
    return this.request(`/affaires/${id}`, {
      method: 'PUT',
      body: JSON.stringify(affaire),
    });
  }

  async deleteAffaire(id) {
    return this.request(`/affaires/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
export default api;
export { getApiUrl };
