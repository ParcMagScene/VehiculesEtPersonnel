// API — Personnel (Personnes, Compétences, Postes, Disponibilités, Missions, Affectations, Planning)

export function registerPersonnelMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    // Personnes
    async getPersons() {
      return this.request('/persons');
    },
    async getPerson(id) {
      return this.request(`/persons/${id}`);
    },
    async createPerson(person) {
      return this.request('/persons', { method: 'POST', body: JSON.stringify(person) });
    },
    async updatePerson(id, person) {
      return this.request(`/persons/${id}`, { method: 'PUT', body: JSON.stringify(person) });
    },
    async deletePerson(id) {
      return this.request(`/persons/${id}`, { method: 'DELETE' });
    },
    async importPersonnelCsv(data, mode = 'import') {
      return this.request('/persons/import-csv', {
        method: 'POST',
        body: JSON.stringify({ data, mode }),
      });
    },
    async bulkDeletePersons(ids) {
      return this.request('/persons/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
    },

    // Compétences
    async getSkills() {
      return this.request('/skills');
    },
    async createSkill(skill) {
      return this.request('/skills', { method: 'POST', body: JSON.stringify(skill) });
    },
    async updateSkill(id, skill) {
      return this.request(`/skills/${id}`, { method: 'PUT', body: JSON.stringify(skill) });
    },
    async deleteSkill(id) {
      return this.request(`/skills/${id}`, { method: 'DELETE' });
    },

    // Postes
    async getPositions() {
      return this.request('/positions');
    },
    async createPosition(position) {
      return this.request('/positions', { method: 'POST', body: JSON.stringify(position) });
    },
    async updatePosition(id, position) {
      return this.request(`/positions/${id}`, { method: 'PUT', body: JSON.stringify(position) });
    },
    async deletePosition(id) {
      return this.request(`/positions/${id}`, { method: 'DELETE' });
    },

    // Disponibilités
    async getAvailabilities(params = {}) {
      const query = new URLSearchParams();
      if (params.personId) query.set('person_id', params.personId);
      if (params.startDate) query.set('start_date', params.startDate);
      if (params.endDate) query.set('end_date', params.endDate);
      if (params.status) query.set('status', params.status);
      const qs = query.toString();
      return this.request(`/availabilities${qs ? '?' + qs : ''}`);
    },
    async createAvailability(availability) {
      return this.request('/availabilities', {
        method: 'POST',
        body: JSON.stringify(availability),
      });
    },
    async updateAvailability(id, availability) {
      return this.request(`/availabilities/${id}`, {
        method: 'PUT',
        body: JSON.stringify(availability),
      });
    },
    async deleteAvailability(id) {
      return this.request(`/availabilities/${id}`, { method: 'DELETE' });
    },
    async approveLeaveRequest(id) {
      return this.request(`/availabilities/${id}/approve`, { method: 'POST' });
    },
    async rejectLeaveRequest(id, reason) {
      return this.request(`/availabilities/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },

    // Missions
    async getMissions(params = {}) {
      const query = new URLSearchParams();
      if (params.startDate) query.set('start_date', params.startDate);
      if (params.endDate) query.set('end_date', params.endDate);
      if (params.status) query.set('status', params.status);
      if (params.reservationId) query.set('reservation_id', params.reservationId);
      const qs = query.toString();
      return this.request(`/missions${qs ? '?' + qs : ''}`);
    },
    async getMission(id) {
      return this.request(`/missions/${id}`);
    },
    async createMission(mission) {
      return this.request('/missions', { method: 'POST', body: JSON.stringify(mission) });
    },
    async updateMission(id, mission) {
      return this.request(`/missions/${id}`, { method: 'PUT', body: JSON.stringify(mission) });
    },
    async deleteMission(id) {
      return this.request(`/missions/${id}`, { method: 'DELETE' });
    },

    // Affectations
    async getAssignments(params = {}) {
      const query = new URLSearchParams();
      if (params.personId) query.set('person_id', params.personId);
      if (params.missionId) query.set('mission_id', params.missionId);
      if (params.status) query.set('status', params.status);
      const qs = query.toString();
      return this.request(`/assignments${qs ? '?' + qs : ''}`);
    },
    async createAssignment(assignment) {
      return this.request('/assignments', { method: 'POST', body: JSON.stringify(assignment) });
    },
    async updateAssignment(id, assignment) {
      return this.request(`/assignments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(assignment),
      });
    },
    async deleteAssignment(id) {
      return this.request(`/assignments/${id}`, { method: 'DELETE' });
    },

    // Planning global
    async getPersonnelPlanning(params = {}) {
      const query = new URLSearchParams();
      if (params.startDate) query.set('start_date', params.startDate);
      if (params.endDate) query.set('end_date', params.endDate);
      if (params.personId) query.set('person_id', params.personId);
      if (params.skillId) query.set('skill_id', params.skillId);
      const qs = query.toString();
      return this.request(`/personnel/planning${qs ? '?' + qs : ''}`);
    },
  });
}
