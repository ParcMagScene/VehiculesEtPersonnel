// apps/web/src/hooks/v2/useLocationsV2.js
//
// Ticket : T-P0-12 (Localisation v2 - hooks).
//
// Hooks React minimaux consommant `/api/v2/locations/*`. Un ticket UI
// dedie (T-P0-12b) refactorera EquipmentPanel pour utiliser ces hooks
// au lieu de charger `depot-zones.json` statique.
//
// Comportement en cas de FEATURE_V2_LOCATIONS off cote serveur : le
// backend renvoie 404 avec code FEATURE_DISABLED — le hook expose
// `featureDisabled=true` et un data vide, sans throw.

import { useCallback, useEffect, useState } from 'react';

import api from '../../utils/api';

/**
 * @typedef {Object} DepotSummary
 * @property {string} depot_id
 * @property {string} name
 * @property {string} version
 * @property {number|null} svg_width
 * @property {number|null} svg_height
 * @property {number} floors_count
 * @property {number} categories_count
 * @property {number} zones_count
 * @property {string|null} imported_at
 * @property {string|null} updated_at
 */

/**
 * Charge la liste compacte des depots via `GET /api/v2/locations/depots`.
 *
 * @returns {{
 *   depots: DepotSummary[],
 *   loading: boolean,
 *   error: Error|null,
 *   featureDisabled: boolean,
 *   refresh: () => Promise<void>,
 * }}
 */
export function useV2DepotsList() {
  const [depots, setDepots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFeatureDisabled(false);
    try {
      const raw = await api.v2ListDepots();
      // Reponse v2 : { success, data: { depots, total }, meta }.
      setDepots(Array.isArray(raw?.data?.depots) ? raw.data.depots : []);
    } catch (err) {
      if (err?.response?.status === 404 && err?.response?.data?.code === 'FEATURE_DISABLED') {
        setFeatureDisabled(true);
        setDepots([]);
      } else {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { depots, loading, error, featureDisabled, refresh };
}

/**
 * Charge le detail d'un depot via `GET /api/v2/locations/depots/:depot_id`.
 * Aucun fetch tant que `depotId` est falsy.
 *
 * @param {string|number|null} depotId
 * @returns {{
 *   depot: object|null,
 *   loading: boolean,
 *   error: Error|null,
 *   featureDisabled: boolean,
 *   refresh: () => Promise<void>,
 * }}
 */
export function useV2DepotDetail(depotId) {
  const [depot, setDepot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);

  const refresh = useCallback(async () => {
    if (depotId === null || depotId === undefined || depotId === '') {
      setDepot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setFeatureDisabled(false);
    try {
      const raw = await api.v2GetDepot(depotId);
      setDepot(raw?.data?.depot ?? null);
    } catch (err) {
      if (err?.response?.status === 404 && err?.response?.data?.code === 'FEATURE_DISABLED') {
        setFeatureDisabled(true);
        setDepot(null);
      } else if (err?.response?.status === 404) {
        // Depot inconnu — reste distinct de FEATURE_DISABLED.
        setDepot(null);
        setError(err);
      } else {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [depotId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { depot, loading, error, featureDisabled, refresh };
}
