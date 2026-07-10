// apps/web/src/utils/api/v2/equipmentUid.js
//
// Ticket : T-P1-06 (Equipements v2 - UID/serials).

/**
 * @param {typeof import('../base.js').ApiClient} ApiClient
 */
export function registerV2EquipmentUidMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    /** GET /api/v2/equipment-uid/protocol (public). */
    async v2EquipmentUidProtocol() {
      return this.request('/v2/equipment-uid/protocol', { skipCamelCase: true });
    },

    /** GET /api/v2/equipment-uid/audit (admin). */
    async v2EquipmentUidAudit() {
      return this.request('/v2/equipment-uid/audit', { skipCamelCase: true });
    },

    /**
     * POST /api/v2/equipment/:id/regenerate-uid (admin).
     * @param {number} equipmentId
     * @param {{ reason?: string }} [options]
     */
    async v2RegenerateEquipmentUid(equipmentId, options = {}) {
      const body = options.reason ? { reason: options.reason } : {};
      return this.request(`/v2/equipment/${encodeURIComponent(equipmentId)}/regenerate-uid`, {
        method: 'POST',
        body: JSON.stringify(body),
        skipCamelCase: true,
      });
    },
  });
}
