// API — Module Labels (étiquettes laser LightBurn)

import { getApiUrl } from './base.js';

export function registerLabelsMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    /**
     * Liste les serials avec equipment associé.
     * @param {object} [filters] { equipmentId, withoutMag, search }
     */
    async getSerializedLabels(filters = {}) {
      const params = new URLSearchParams();
      if (filters.equipmentId) params.set('equipmentId', String(filters.equipmentId));
      if (filters.withoutMag) params.set('withoutMag', '1');
      if (filters.search) params.set('search', String(filters.search));
      const qs = params.toString();
      return this.request(`/labels/serialized${qs ? `?${qs}` : ''}`, { skipCamelCase: true });
    },

    /**
     * Met à jour le numéro Mag d'un serial. Passez null pour effacer.
     * @param {number} id
     * @param {string|null} magNumber
     */
    async updateSerialMagNumber(id, magNumber) {
      return this.request(`/labels/serial/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ mag_number: magNumber }),
        skipCamelCase: true,
      });
    },

    /**
     * Génère le SVG plaque (200×200 mm). Retourne un Blob.
     * @param {Array<number>} serialIds  IDs equipment_serials, ordre conservé
     * @returns {Promise<Blob>} svg blob
     */
    async generateLabelsPlate(serialIds, filename = 'plaque-etiquettes-200x200.svg') {
      const apiUrl = getApiUrl();
      // Route LightBurn stricte : 3 calques (QR_IMAGE / TEXT_FILL / FRAME_LINE)
      // avec PNG QR+logo MagScene fusionné. Cf. apps/api/services/LIGHTBURN-LABELS.md.
      const res = await fetch(`${apiUrl}/labels/lightburn/plate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialIds, filename }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          msg = j.error || j.detail || msg;
        } catch {
          /* svg garanti côté success uniquement */
        }
        throw new Error(`Génération étiquettes échouée : ${msg}`);
      }
      return res.blob();
    },
  });
}
