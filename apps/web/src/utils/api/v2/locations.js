// apps/web/src/utils/api/v2/locations.js
//
// Ticket : T-P0-12 (Localisation v2 - client API).
//
// Enregistre sur `ApiClient.prototype` les methodes v2 Locations.
// Aucun effet de bord au chargement du module.
//
// Feature flag client : `flags.v2Locations` (lu via
// router/featureFlags.js). Si off, les composants doivent tomber sur
// les endpoints v1 existants (`/api/equipment-depot-zones`, etc.).

/**
 * @param {typeof import('../base.js').ApiClient} ApiClient
 * @returns {void}
 */
export function registerV2LocationsMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    /**
     * GET /api/v2/locations/protocol
     * Discovery public (pas d'auth).
     */
    async v2LocationsProtocol() {
      return this.request('/v2/locations/protocol', { skipCamelCase: true });
    },

    /**
     * GET /api/v2/locations/depots
     * Liste compacte des depots (metadonnees + counts).
     */
    async v2ListDepots() {
      return this.request('/v2/locations/depots', { skipCamelCase: true });
    },

    /**
     * GET /api/v2/locations/depots/:depot_id
     * Detail complet d'un depot (floors + categories + zones).
     * @param {string|number} depotId
     */
    async v2GetDepot(depotId) {
      return this.request(`/v2/locations/depots/${encodeURIComponent(depotId)}`, {
        skipCamelCase: true,
      });
    },

    /**
     * PATCH /api/v2/equipment/:id/location
     * Met a jour la localisation d'un equipement. Champs acceptes :
     * location_depot, location_floor, location_zone, location_code.
     * @param {number|string} equipmentId
     * @param {{
     *   location_depot?: string|null,
     *   location_floor?: string|null,
     *   location_zone?: string|null,
     *   location_code?: string|null,
     *   notes?: string,
     *   strict?: boolean,
     * }} patch
     */
    async v2PatchEquipmentLocation(equipmentId, patch) {
      return this.request(`/v2/equipment/${encodeURIComponent(equipmentId)}/location`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
        skipCamelCase: true,
      });
    },
  });
}
