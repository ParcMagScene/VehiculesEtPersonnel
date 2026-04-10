// API — Planning (Events, BL Imports, Tâches, Récurrences, Affaires Planning, Assignments, iCal)
import { toCamelCase } from './base.js';

export function registerPlanningMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {

    // Affichage dynamique (display events)
    async getDisplayEvents(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/planning/display-events${qs ? '?' + qs : ''}`);
    },
    async getDisplayEvent(id) {
      return this.request(`/planning/display-events/${id}`);
    },
    async createDisplayEvent(data) {
      return this.request('/planning/display-events', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateDisplayEvent(id, data) {
      return this.request(`/planning/display-events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteDisplayEvent(id) {
      return this.request(`/planning/display-events/${id}`, { method: 'DELETE' });
    },
    async toggleDisplayEventVisibility(id) {
      return this.request(`/planning/display-events/${id}/toggle-visible`, { method: 'PATCH' });
    },
    async cycleDisplayEventStatus(id) {
      return this.request(`/planning/display-events/${id}/cycle-status`, { method: 'PATCH' });
    },

    // Import BL
    async getBLImports(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/planning/bl-imports${qs ? '?' + qs : ''}`);
    },
    async getBLImport(id) {
      return this.request(`/planning/bl-imports/${id}`);
    },
    async uploadBLImport(formData) {
      const data = await this.requestFormData('/planning/bl-imports', formData);
      return toCamelCase(data);
    },
    async deleteBLImport(id) {
      return this.request(`/planning/bl-imports/${id}`, { method: 'DELETE' });
    },
    async uploadBLImportBatch(formData) {
      return this.requestFormData('/planning/bl-imports/batch', formData);
    },

    // Articles BP (liaison matériel)
    async getBPItems(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/planning/bp-items${qs ? '?' + qs : ''}`);
    },
    async matchBPItem(id, equipmentId) {
      return this.request(`/planning/bp-items/${id}/match`, { method: 'PUT', body: JSON.stringify({ equipment_id: equipmentId }) });
    },
    async matchBPArticle(id, { supplierArticleId, stockItemId } = {}) {
      return this.request(`/planning/bp-items/${id}/match-article`, {
        method: 'PUT',
        body: JSON.stringify({ supplier_article_id: supplierArticleId || null, stock_item_id: stockItemId || null })
      });
    },

    // Tâches
    async getTasks(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/planning/tasks${qs ? '?' + qs : ''}`);
    },
    async getTask(id) {
      return this.request(`/planning/tasks/${id}`);
    },
    async createTask(data) {
      return this.request('/planning/tasks', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateTask(id, data) {
      return this.request(`/planning/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteTask(id) {
      return this.request(`/planning/tasks/${id}`, { method: 'DELETE' });
    },
    async createTasksBatch(tasks) {
      return this.request('/planning/tasks/batch', { method: 'POST', body: JSON.stringify({ tasks }) });
    },
    async deleteTasksBySource(sourceId) {
      return this.request(`/planning/tasks/by-source/${sourceId}`, { method: 'DELETE' });
    },
    async toggleTaskVisibility(id) {
      return this.request(`/planning/tasks/${id}/toggle-visible`, { method: 'PATCH' });
    },
    async createDisplayEventsBatch(events) {
      const results = [];
      for (const ev of events) {
        const created = await this.request('/planning/display-events', { method: 'POST', body: JSON.stringify(ev) });
        results.push(created);
      }
      return results;
    },

    // Stats Planning
    async getPlanningStats() {
      return this.request('/planning/stats');
    },

    // Export PDF tâches
    async exportTasksPdf(date, taskIds, affaireIds, eventIds, gcalEvents) {
      let endpoint = `/planning/tasks/export-pdf?date=${date}`;
      if (taskIds && taskIds.length > 0) endpoint += `&taskIds=${taskIds.join(',')}`;
      if (affaireIds && affaireIds.length > 0) endpoint += `&affaireIds=${affaireIds.join(',')}`;
      if (eventIds && eventIds.length > 0) endpoint += `&eventIds=${eventIds.join(',')}`;
      const body = (gcalEvents && gcalEvents.length > 0) ? JSON.stringify({ gcalEvents }) : undefined;
      return this.requestBlob(endpoint, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        ...(body ? { body } : {}),
      });
    },

    // Affaires pour planning
    async getPlanningAffaires(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/planning/planning-affaires${qs ? '?' + qs : ''}`);
    },
    async hidePlanningAffaire(numeroAffaire) {
      return this.request(`/planning/planning-hidden-affaires/${encodeURIComponent(numeroAffaire)}`, { method: 'POST' });
    },
    async cycleAffaireStatus(numeroAffaire) {
      return this.request(`/planning/planning-affaires/${encodeURIComponent(numeroAffaire)}/cycle-status`, { method: 'PATCH' });
    },
    async cyclePlanningEventStatus(eventType, eventId) {
      return this.request(`/planning/planning-events/${encodeURIComponent(eventType)}/${encodeURIComponent(eventId)}/cycle-status`, { method: 'PATCH' });
    },
    async getPlanningEventStatuses() {
      return this.request('/planning/planning-event-statuses');
    },
    async unhidePlanningAffaire(numeroAffaire) {
      return this.request(`/planning/planning-hidden-affaires/${encodeURIComponent(numeroAffaire)}`, { method: 'DELETE' });
    },

    // Affecter personnel à un événement
    async assignDisplayEvent(id, personId) {
      return this.request(`/planning/display-events/${id}/assign`, { method: 'PUT', body: JSON.stringify({ person_id: personId }) });
    },

    // Multi-affectation personnel (planning_assignments)
    async getPlanningAssignments(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/planning/planning-assignments${qs ? '?' + qs : ''}`);
    },
    async addPlanningAssignment(entityType, entityId, personId) {
      return this.request('/planning/planning-assignments', { method: 'POST', body: JSON.stringify({ entity_type: entityType, entity_id: entityId, person_id: personId }) });
    },
    async removePlanningAssignment(id) {
      return this.request(`/planning/planning-assignments/${id}`, { method: 'DELETE' });
    },
    async clearPlanningAssignments(entityType, entityId) {
      return this.request(`/planning/planning-assignments/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`, { method: 'DELETE' });
    },

    // Tâches récurrentes
    async getRecurringTasks() {
      return this.request('/planning/recurring-tasks');
    },
    async createRecurringTask(data) {
      return this.request('/planning/recurring-tasks', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateRecurringTask(id, data) {
      return this.request(`/planning/recurring-tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteRecurringTask(id) {
      return this.request(`/planning/recurring-tasks/${id}`, { method: 'DELETE' });
    },
    async generateRecurringTasks(date) {
      return this.request('/planning/recurring-tasks/generate', { method: 'POST', body: JSON.stringify({ date }) });
    },
    async rolloverTasks(fromDate) {
      return this.request('/planning/tasks/rollover', { method: 'POST', body: JSON.stringify({ fromDate }) });
    },
    async clearCompletedTasks(date) {
      return this.request('/planning/tasks/clear-completed', { method: 'POST', body: JSON.stringify({ date }) });
    },

    // iCal Calendars
    async getIcalCalendars() {
      return this.request('/planning/ical-calendars');
    },
    async createIcalCalendar(data) {
      return this.request('/planning/ical-calendars', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateIcalCalendar(id, data) {
      return this.request(`/planning/ical-calendars/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteIcalCalendar(id) {
      return this.request(`/planning/ical-calendars/${id}`, { method: 'DELETE' });
    },
    async getIcalEvents({ dateFrom, dateTo }) {
      return this.request(`/planning/ical-events?dateFrom=${dateFrom}&dateTo=${dateTo}`);
    },
  });
}
