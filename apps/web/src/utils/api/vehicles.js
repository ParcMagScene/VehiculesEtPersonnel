// API — Véhicules, Réservations, Maintenances, Historique, Clients, Conducteurs, Lieux, Garages
import { toSnakeCase } from './base.js';

export function registerVehicleMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    // Véhicules
    async getVehicles() {
      return this.request('/vehicles');
    },
    async createVehicle(vehicle) {
      return this.request('/vehicles', {
        method: 'POST',
        body: JSON.stringify(toSnakeCase(vehicle)),
      });
    },
    async updateVehicle(id, vehicle) {
      return this.request(`/vehicles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(toSnakeCase(vehicle)),
      });
    },
    async deleteVehicle(id) {
      return this.request(`/vehicles/${id}`, { method: 'DELETE' });
    },

    // Réservations
    async getReservations() {
      return this.request('/reservations');
    },
    async createReservation(reservation) {
      return this.request('/reservations', {
        method: 'POST',
        body: JSON.stringify(toSnakeCase(reservation)),
      });
    },
    async updateReservation(id, reservation) {
      return this.request(`/reservations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(toSnakeCase(reservation)),
      });
    },
    async deleteReservation(id) {
      return this.request(`/reservations/${id}`, { method: 'DELETE' });
    },
    async patchReservation(id, data) {
      return this.request(`/reservations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },

    // Demandes de réservation (pour non-admins)
    async getReservationRequests() {
      return this.request('/reservation-requests');
    },
    async createReservationRequest(request) {
      return this.request('/reservation-requests', {
        method: 'POST',
        body: JSON.stringify(toSnakeCase(request)),
      });
    },
    async approveReservationRequest(id) {
      return this.request(`/reservation-requests/${id}/approve`, { method: 'PUT' });
    },
    async rejectReservationRequest(id, reason) {
      return this.request(`/reservation-requests/${id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ reason }),
      });
    },

    // Maintenances
    async getMaintenances() {
      return this.request('/maintenances');
    },
    async createMaintenance(maintenance) {
      return this.request('/maintenances', {
        method: 'POST',
        body: JSON.stringify(toSnakeCase(maintenance)),
      });
    },
    async updateMaintenance(id, maintenance) {
      return this.request(`/maintenances/${id}`, {
        method: 'PUT',
        body: JSON.stringify(toSnakeCase(maintenance)),
      });
    },
    async deleteMaintenance(id) {
      return this.request(`/maintenances/${id}`, { method: 'DELETE' });
    },

    // Historique
    async getHistory(entityType, entityId) {
      return this.request(`/history/${entityType}/${entityId}`);
    },

    // Clients — unifié vers annuaire
    async getClients() {
      const result = await this.request('/annuaire/clients?limit=9999');
      return result.data || result;
    },
    async createClient(client) {
      return this.request('/annuaire/clients', { method: 'POST', body: JSON.stringify(client) });
    },
    async updateClient(id, client) {
      return this.request(`/annuaire/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(client),
      });
    },
    async deleteClient(id) {
      return this.request(`/annuaire/clients/${id}`, { method: 'DELETE' });
    },

    // Conducteurs
    async getDrivers() {
      return this.request('/drivers');
    },
    async createDriver(driver) {
      return this.request('/drivers', { method: 'POST', body: JSON.stringify(driver) });
    },
    async updateDriver(id, driver) {
      return this.request(`/drivers/${id}`, { method: 'PUT', body: JSON.stringify(driver) });
    },
    async deleteDriver(id) {
      return this.request(`/drivers/${id}`, { method: 'DELETE' });
    },

    // Lieux
    async getLocations() {
      return this.request('/locations');
    },
    async createLocation(location) {
      return this.request('/locations', { method: 'POST', body: JSON.stringify(location) });
    },
    async updateLocation(id, location) {
      return this.request(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(location) });
    },
    async deleteLocation(id) {
      return this.request(`/locations/${id}`, { method: 'DELETE' });
    },

    // Garages
    async getGarages() {
      return this.request('/garages');
    },

    // Trip Details (détails de trajet)
    async getTripDetails(reservationId) {
      return this.request(`/trip-details/${reservationId}`, { skipCamelCase: true });
    },
    async saveTripDetails(data) {
      return this.request('/trip-details', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async linkTrips(data) {
      return this.request('/trip-details/link', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async unlinkTrip(data) {
      return this.request('/trip-details/unlink', {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
  });
}
