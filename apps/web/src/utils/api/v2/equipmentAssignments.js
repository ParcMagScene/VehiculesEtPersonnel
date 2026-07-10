// apps/web/src/utils/api/v2/equipmentAssignments.js
//
// Ticket : T-P1-08 (Equipements v2 - assignations auditees).

/**
 * @param {typeof import('../base.js').ApiClient} ApiClient
 */
export function registerV2EquipmentAssignmentsMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    async v2EquipmentAssignmentsProtocol() {
      return this.request('/v2/equipment-assignments/protocol', { skipCamelCase: true });
    },

    /**
     * POST /api/v2/equipment/:id/assignments
     * @param {number} equipmentId
     * @param {{ assigned_to?: number|null, start_date: string, end_date?: string|null, affaire_id?: string|null, notes?: string }} data
     */
    async v2CreateEquipmentAssignment(equipmentId, data) {
      return this.request(`/v2/equipment/${encodeURIComponent(equipmentId)}/assignments`, {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },

    /**
     * POST /api/v2/equipment-assignments/:aid/release
     * @param {number} assignmentId
     * @param {{ release_date?: string, notes?: string }} [data]
     */
    async v2ReleaseEquipmentAssignment(assignmentId, data = {}) {
      return this.request(`/v2/equipment-assignments/${encodeURIComponent(assignmentId)}/release`, {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },

    /**
     * GET /api/v2/equipment/:id/assignments/history
     * @param {number} equipmentId
     * @param {{ limit?: number }} [options]
     */
    async v2GetEquipmentAssignmentsHistory(equipmentId, options = {}) {
      const params = new URLSearchParams();
      if (options.limit) params.set('limit', String(options.limit));
      const qs = params.toString();
      return this.request(
        `/v2/equipment/${encodeURIComponent(equipmentId)}/assignments/history${qs ? `?${qs}` : ''}`,
        { skipCamelCase: true },
      );
    },
  });
}
