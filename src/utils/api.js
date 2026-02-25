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
    // Option pour désactiver la conversion camelCase (utile pour les clés-identifiants)
    const skipCamelCase = options.skipCamelCase;
    if (skipCamelCase) delete options.skipCamelCase;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let response;
    try {
      response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (networkError) {
      // Erreur réseau (pas de connexion, DNS, CORS, etc.)
      const error = new Error('Erreur réseau — vérifiez votre connexion');
      error.isNetworkError = true;
      throw error;
    }

    // Ne pas traiter les erreurs 401/403 comme "session expirée" pour les endpoints de connexion
    const isAuthEndpoint = endpoint === '/auth/login' || endpoint === '/auth/register' || endpoint === '/auth/force-login';
    
    // 401 = Token invalide/expiré → déconnexion
    if (response.status === 401 && !isAuthEndpoint) {
      this.clearAuth();
      window.location.reload();
      throw new Error('Session expirée');
    }

    // 403 = Permission insuffisante (pas admin, etc.) → NE PAS déconnecter
    if (response.status === 403 && !isAuthEndpoint) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.error || 'Accès refusé');
      error.response = { status: 403, data };
      throw error;
    }

    // Parser la réponse JSON avec gestion des réponses non-JSON (502, 503, HTML)
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      if (!response.ok) {
        const error = new Error(`Erreur serveur (${response.status})`);
        error.response = { status: response.status, data: null };
        throw error;
      }
      // Réponse OK mais pas de body JSON (204 No Content, etc.)
      return null;
    }
    
    if (!response.ok) {
      // Créer une erreur avec la réponse complète pour les erreurs spécifiques
      const error = new Error(data.error || 'Erreur serveur');
      error.response = { status: response.status, data };
      throw error;
    }

    // Convertir les données de snake_case en camelCase (sauf si skipCamelCase)
    return skipCamelCase ? data : toCamelCase(data);
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

  async importPersonnelCsv(data, mode = 'import') {
    return this.request('/persons/import-csv', { method: 'POST', body: JSON.stringify({ data, mode }) });
  }

  async bulkDeletePersons(ids) {
    return this.request('/persons/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
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

  // — Postes —

  async getPositions() {
    return this.request('/positions');
  }

  async createPosition(position) {
    return this.request('/positions', {
      method: 'POST',
      body: JSON.stringify(position),
    });
  }

  async updatePosition(id, position) {
    return this.request(`/positions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(position),
    });
  }

  async deletePosition(id) {
    return this.request(`/positions/${id}`, {
      method: 'DELETE',
    });
  }

  // — Disponibilités / Congés —

  async getAvailabilities(params = {}) {
    const query = new URLSearchParams();
    if (params.personId) query.set('person_id', params.personId);
    if (params.startDate) query.set('start_date', params.startDate);
    if (params.endDate) query.set('end_date', params.endDate);
    if (params.status) query.set('status', params.status);
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

  async approveLeaveRequest(id) {
    return this.request(`/availabilities/${id}/approve`, { method: 'POST' });
  }

  async rejectLeaveRequest(id, reason) {
    return this.request(`/availabilities/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // — Module Congés (Code du travail / IDCC 3252) —

  async getLeaveTypes() {
    // Les clés (conge_paye, mariage_salarie, etc.) sont des identifiants métier, pas des propriétés
    // Ne pas les convertir en camelCase sinon le formulaire et le backend ne les reconnaissent plus
    return this.request('/leaves/types', { skipCamelCase: true });
  }

  async getPublicHolidays(year) {
    const qs = year ? `?year=${year}` : '';
    return this.request(`/leaves/holidays${qs}`);
  }

  async addPublicHoliday(date, name) {
    return this.request('/leaves/holidays', {
      method: 'POST',
      body: JSON.stringify({ date, name }),
    });
  }

  async deletePublicHoliday(id) {
    return this.request(`/leaves/holidays/${id}`, { method: 'DELETE' });
  }

  async calculateLeaveWorkingDays(data) {
    return this.request('/leaves/calculate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createLeaveRequest(data) {
    return this.request('/leaves', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyLeaves() {
    return this.request('/leaves/mine');
  }

  async getAllLeaves(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.personId) query.set('personId', params.personId);
    if (params.leaveType) query.set('leaveType', params.leaveType);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const qs = query.toString();
    return this.request(`/leaves${qs ? '?' + qs : ''}`);
  }

  async getPendingLeaves() {
    return this.request('/leaves/pending');
  }

  async getPendingLeavesCount() {
    return this.request('/leaves/pending/count');
  }

  async getLeaveDetail(id) {
    return this.request(`/leaves/${id}`);
  }

  async makeLeaveDecision(id, data) {
    return this.request(`/leaves/${id}/decision`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async signLeave(id, signature, role) {
    return this.request(`/leaves/${id}/sign`, {
      method: 'PUT',
      body: JSON.stringify({ signature, role }),
    });
  }

  async cancelLeave(id) {
    return this.request(`/leaves/${id}/cancel`, { method: 'PUT' });
  }

  async uploadLeaveJustification(id, filename, data) {
    return this.request(`/leaves/${id}/justification`, {
      method: 'POST',
      body: JSON.stringify({ filename, data }),
    });
  }

  async getLeaveBalances(params = {}) {
    const query = new URLSearchParams();
    if (params.personId) query.set('personId', params.personId);
    if (params.year) query.set('year', params.year);
    const qs = query.toString();
    return this.request(`/leaves/balances${qs ? '?' + qs : ''}`);
  }

  async updateLeaveBalance(data) {
    return this.request('/leaves/balances', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getLeavePdf(id) {
    return this.request(`/leaves/${id}/pdf`);
  }

  async getLeaveStats(year) {
    const qs = year ? `?year=${year}` : '';
    return this.request(`/leaves/stats${qs}`);
  }

  async getLeaveConflicts() {
    return this.request('/leaves/conflicts');
  }

  async getLeaveHistory(id) {
    return this.request(`/leaves/${id}/history`);
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

  async getAffairesPersonnelCounts() {
    return this.request('/affaires/personnel-counts');
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

  // ============ MESSAGERIE ============

  async getConversations() {
    return this.request('/messaging/conversations');
  }

  async createConversation(type, title, participantIds) {
    return this.request('/messaging/conversations', {
      method: 'POST',
      body: JSON.stringify({ type, title, participantIds }),
    });
  }

  async getMessages(conversationId, limit = 50, before = null) {
    let url = `/messaging/conversations/${conversationId}/messages?limit=${limit}`;
    if (before) url += `&before=${before}`;
    return this.request(url);
  }

  async sendMessage(conversationId, content, type = 'text') {
    return this.request(`/messaging/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, type }),
    });
  }

  async sendFileMessage(conversationId, filename, base64Data, mimeType) {
    return this.request(`/messaging/conversations/${conversationId}/messages/file`, {
      method: 'POST',
      body: JSON.stringify({ filename, data: base64Data, mimeType }),
    });
  }

  async markConversationRead(conversationId) {
    return this.request(`/messaging/conversations/${conversationId}/read`, {
      method: 'POST',
    });
  }

  async getUnreadCount() {
    return this.request('/messaging/unread-count');
  }

  // ===== PRÉFÉRENCES UTILISATEUR =====
  async getPreferences() {
    return this.request('/users/me/preferences');
  }

  async savePreferences(prefs) {
    return this.request('/users/me/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  }

  // ═══ Configuration Email ═══
  async getEmailConfig() {
    return this.request('/email-config');
  }

  async updateEmailConfig(config) {
    return this.request('/email-config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async testEmail() {
    return this.request('/email-config/test', { method: 'POST' });
  }

  // ═══ Mailing Avancé ═══
  async getMailTemplates() {
    return this.request('/mail-templates');
  }
  async getMailTemplate(id) {
    return this.request(`/mail-templates/${id}`);
  }
  async createMailTemplate(data) {
    return this.request('/mail-templates', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateMailTemplate(id, data) {
    return this.request(`/mail-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteMailTemplate(id) {
    return this.request(`/mail-templates/${id}`, { method: 'DELETE' });
  }
  async sendMailing(data) {
    return this.request('/mailing/send', { method: 'POST', body: JSON.stringify(data) });
  }
  async previewMailing(data) {
    return this.request('/mailing/preview', { method: 'POST', body: JSON.stringify(data) });
  }
  async getMailingHistory(limit = 50, offset = 0) {
    return this.request(`/mailing/history?limit=${limit}&offset=${offset}`);
  }
  async getMailingContacts() {
    return this.request('/mailing/contacts');
  }

  // ═══ Parc Matériel ═══
  async getEquipmentCategories() {
    return this.request('/equipment-categories');
  }
  async createEquipmentCategory(data) {
    return this.request('/equipment-categories', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateEquipmentCategory(id, data) {
    return this.request(`/equipment-categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteEquipmentCategory(id) {
    return this.request(`/equipment-categories/${id}`, { method: 'DELETE' });
  }

  async getEquipment(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/equipment${qs ? '?' + qs : ''}`);
  }
  async getEquipmentById(id) {
    return this.request(`/equipment/${id}`);
  }
  async createEquipment(data) {
    return this.request('/equipment', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateEquipment(id, data) {
    return this.request(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteEquipment(id) {
    return this.request(`/equipment/${id}`, { method: 'DELETE' });
  }

  async serializeEquipment(id) {
    return this.request(`/equipment/${id}/serialize`, { method: 'POST' });
  }

  async importEquipmentCsv(data, mode = 'import') {
    return this.request('/equipment/import-csv', { method: 'POST', body: JSON.stringify({ data, mode }) });
  }

  async importSavTicketsCsv(data, mode = 'import', manualLinks = null, skipDuplicates = false) {
    return this.request('/sav-tickets/import-csv', { method: 'POST', body: JSON.stringify({ data, mode, manualLinks, skipDuplicates }) });
  }

  async removeSavDuplicates() {
    return this.request('/sav-tickets/duplicates', { method: 'DELETE' });
  }

  async getUnlinkedSavTickets() {
    return this.request('/sav-tickets/unlinked');
  }

  async linkSavTicket(ticketId, equipmentId) {
    return this.request(`/sav-tickets/${ticketId}/link`, { method: 'PUT', body: JSON.stringify({ equipment_id: equipmentId }) });
  }

  async getEquipmentCategoriesTree() {
    return this.request('/equipment-categories/tree');
  }

  // ═══ Assignments matériel ═══
  async getEquipmentAssignments(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/equipment-assignments${qs ? '?' + qs : ''}`);
  }
  async createEquipmentAssignment(data) {
    return this.request('/equipment-assignments', { method: 'POST', body: JSON.stringify(data) });
  }
  async returnEquipmentAssignment(id) {
    return this.request(`/equipment-assignments/${id}/return`, { method: 'PUT' });
  }

  // ═══ Tickets SAV ═══
  async getSavTickets(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/sav-tickets${qs ? '?' + qs : ''}`);
  }
  async getSavTicketStats() {
    return this.request('/sav-tickets/stats');
  }
  async getSavTicketReport(start, end, type = 'all') {
    const qs = new URLSearchParams({ start, end, type }).toString();
    return this.request(`/sav-tickets/report?${qs}`);
  }
  async createSavTicket(data) {
    return this.request('/sav-tickets', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateSavTicket(id, data) {
    return this.request(`/sav-tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteSavTicket(id) {
    return this.request(`/sav-tickets/${id}`, { method: 'DELETE' });
  }

  // ═══ Listes Favoris / Surveillance ═══
  async getEquipmentLists() {
    return this.request('/equipment-lists');
  }
  async addToEquipmentList(equipment_id, list_type) {
    return this.request('/equipment-lists', { method: 'POST', body: JSON.stringify({ equipment_id, list_type }) });
  }
  async removeFromEquipmentList(equipment_id, list_type) {
    return this.request('/equipment-lists', { method: 'DELETE', body: JSON.stringify({ equipment_id, list_type }) });
  }
  async getEquipmentByUid(uid) {
    return this.request(`/equipment/by-uid/${uid}`);
  }
  async getEquipmentPhotos() {
    return this.request('/equipment-photos');
  }

  // ═══════════════════════════════════════════════════════════
  // Commandes & Ventes
  // ═══════════════════════════════════════════════════════════

  // Fournisseurs
  async getSuppliers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/suppliers${qs ? '?' + qs : ''}`);
  }
  async createSupplier(data) {
    return this.request('/suppliers', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateSupplier(id, data) {
    return this.request(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteSupplier(id) {
    return this.request(`/suppliers/${id}`, { method: 'DELETE' });
  }

  // Commandes
  async getOrders(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/orders${qs ? '?' + qs : ''}`);
  }
  async getOrdersStats() {
    return this.request('/orders/stats');
  }
  async getOrderById(id) {
    return this.request(`/orders/${id}`);
  }
  async createOrder(data) {
    return this.request('/orders', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateOrder(id, data) {
    return this.request(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteOrder(id) {
    return this.request(`/orders/${id}`, { method: 'DELETE' });
  }

  // Devis
  async getQuotes(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/quotes${qs ? '?' + qs : ''}`);
  }
  async getQuoteById(id) {
    return this.request(`/quotes/${id}`);
  }
  async createQuote(data) {
    return this.request('/quotes', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateQuote(id, data) {
    return this.request(`/quotes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async convertQuoteToOrder(id) {
    return this.request(`/quotes/${id}/convert`, { method: 'POST' });
  }
  async deleteQuote(id) {
    return this.request(`/quotes/${id}`, { method: 'DELETE' });
  }

  // ═══════════════════════════════════════════════════════════
  // Catalogue Matériel + Flight-Cases + Modèles Camions
  // ═══════════════════════════════════════════════════════════

  // Catalogue d'équipements
  async getCatalogEquipment(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/catalog/equipment${qs ? '?' + qs : ''}`);
  }
  async getCatalogEquipmentById(id) {
    return this.request(`/catalog/equipment/${id}`);
  }
  async getCatalogFamilies() {
    return this.request('/catalog/equipment/families');
  }
  async getCatalogCategories() {
    return this.request('/catalog/equipment/categories');
  }
  async createCatalogEquipment(data) {
    return this.request('/catalog/equipment', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateCatalogEquipment(id, data) {
    return this.request(`/catalog/equipment/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteCatalogEquipment(id) {
    return this.request(`/catalog/equipment/${id}`, { method: 'DELETE' });
  }

  // Zones de dépôt (localisation)
  async getDepotZones() {
    return this.request('/catalog/equipment/zones');
  }
  async getLocationStats() {
    return this.request('/catalog/equipment/location-stats');
  }

  // Zones dépôt pour matériel inventaire
  async getEquipmentDepotZones() {
    return this.request('/equipment-depot-zones');
  }
  async getEquipmentLocationStats() {
    return this.request('/equipment-location-stats');
  }

  // Flight-cases
  async getFlightcases(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/flightcases${qs ? '?' + qs : ''}`);
  }
  async getFlightcaseById(id) {
    return this.request(`/flightcases/${id}`);
  }
  async createFlightcase(data) {
    return this.request('/flightcases', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateFlightcase(id, data) {
    return this.request(`/flightcases/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteFlightcase(id) {
    return this.request(`/flightcases/${id}`, { method: 'DELETE' });
  }

  // Modèles de camions
  async getTruckModels(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/trucks/models${qs ? '?' + qs : ''}`);
  }
  async getTruckModelById(id) {
    return this.request(`/trucks/models/${id}`);
  }
  async createTruckModel(data) {
    return this.request('/trucks/models', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateTruckModel(id, data) {
    return this.request(`/trucks/models/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteTruckModel(id) {
    return this.request(`/trucks/models/${id}`, { method: 'DELETE' });
  }

  // Équipements liés aux réservations
  async getReservationEquipment(reservationId) {
    return this.request(`/reservations/${reservationId}/equipment`);
  }
  async assignEquipmentToReservation(reservationId, data) {
    return this.request(`/reservations/${reservationId}/equipment`, { method: 'POST', body: JSON.stringify(data) });
  }
  async removeEquipmentFromReservation(reservationId, linkId) {
    return this.request(`/reservations/${reservationId}/equipment/${linkId}`, { method: 'DELETE' });
  }
  async getChargementExport(reservationId) {
    return this.request(`/reservations/${reservationId}/chargement-export`);
  }

  // ============ STOCK & PIÈCES ============
  async getStockCategories() {
    return this.request('/stock/categories');
  }
  async createStockCategory(data) {
    return this.request('/stock/categories', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateStockCategory(id, data) {
    return this.request(`/stock/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteStockCategory(id) {
    return this.request(`/stock/categories/${id}`, { method: 'DELETE' });
  }
  async getStockItems(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/stock/items${qs ? '?' + qs : ''}`);
  }
  async getStockItem(id) {
    return this.request(`/stock/items/${id}`);
  }
  async createStockItem(data) {
    return this.request('/stock/items', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateStockItem(id, data) {
    return this.request(`/stock/items/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteStockItem(id) {
    return this.request(`/stock/items/${id}`, { method: 'DELETE' });
  }
  async createStockMovement(data) {
    return this.request('/stock/movements', { method: 'POST', body: JSON.stringify(data) });
  }
  async getStockMovements(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/stock/movements${qs ? '?' + qs : ''}`);
  }
  async getStockStats() {
    return this.request('/stock/stats');
  }

  // ============ COMMUNICATION ============

  // --- Affichage dynamique (display events) ---
  async getDisplayEvents(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/communication/display-events${qs ? '?' + qs : ''}`);
  }
  async getDisplayEvent(id) {
    return this.request(`/communication/display-events/${id}`);
  }
  async createDisplayEvent(data) {
    return this.request('/communication/display-events', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateDisplayEvent(id, data) {
    return this.request(`/communication/display-events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteDisplayEvent(id) {
    return this.request(`/communication/display-events/${id}`, { method: 'DELETE' });
  }

  // --- Import BL ---
  async getBLImports(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/communication/bl-imports${qs ? '?' + qs : ''}`);
  }
  async getBLImport(id) {
    return this.request(`/communication/bl-imports/${id}`);
  }
  async uploadBLImport(formData) {
    // Utilise fetch directement car multipart/form-data (pas JSON)
    const headers = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const response = await fetch(`${API_URL}/communication/bl-imports`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Erreur upload BL');
    }
    const data = await response.json();
    return toCamelCase(data);
  }
  async deleteBLImport(id) {
    return this.request(`/communication/bl-imports/${id}`, { method: 'DELETE' });
  }

  // --- Tâches / Planning ---
  async getTasks(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/communication/tasks${qs ? '?' + qs : ''}`);
  }
  async getTask(id) {
    return this.request(`/communication/tasks/${id}`);
  }
  async createTask(data) {
    return this.request('/communication/tasks', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateTask(id, data) {
    return this.request(`/communication/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteTask(id) {
    return this.request(`/communication/tasks/${id}`, { method: 'DELETE' });
  }

  // --- Stats Communication ---
  async getCommunicationStats() {
    return this.request('/communication/stats');
  }
}

export const api = new ApiClient();
export default api;
export { getApiUrl };
