// apps/web/src/utils/locations/fetchDepotZones.js
//
// Ticket : T-P0-12b (Locations v2 — UI EquipmentPanel).
//
// Chemin unifie de recuperation des zones de depot pour
// `useEquipment`. Bascule entre v1 et v2 en fonction d'un flag
// `useV2` (client). Le shape retourne est **toujours** le shape v1
// consomme par `DepotMap` et les composants existants.
//
// Fallback strict : si un appel v2 echoue OU si le namespace v2 est
// desactive cote serveur (404 FEATURE_DISABLED), on retombe
// silencieusement sur l'endpoint v1. Zero regression fonctionnelle
// pendant la coexistence.

import { adaptDepotV2ToV1 } from './v2Adapters';

/**
 * Detecte si une erreur remontee par le client API correspond a un
 * flag serveur eteint (404 FEATURE_DISABLED). Comportement aligne
 * sur `useLocationsV2` cote hooks React.
 * @param {unknown} err
 */
function isFeatureDisabled(err) {
  if (!err || typeof err !== 'object') return false;
  const code = err.code || err.details?.code;
  return code === 'FEATURE_DISABLED';
}

/**
 * Recupere le detail d'un depot en respectant le shape v1.
 *
 * @param {object} api - Client API (`apps/web/src/utils/api`).
 * @param {object} [options]
 * @param {boolean} [options.useV2=false] - Active le chemin v2.
 * @param {string|number} [options.depotId] - Id du depot (defaut : 1).
 * @returns {Promise<object|null>} Payload shape v1 ou null si echec.
 */
export async function fetchDepotZones(api, { useV2 = false, depotId } = {}) {
  const resolvedId = depotId ?? 1;

  if (useV2 && typeof api?.v2GetDepot === 'function') {
    try {
      const response = await api.v2GetDepot(resolvedId);
      const depotV2 = response?.data?.depot;
      if (depotV2) return adaptDepotV2ToV1(depotV2);
    } catch (err) {
      if (!isFeatureDisabled(err)) {
        // eslint-disable-next-line no-console
        console.warn('[locations v2] fetchDepotZones: fallback v1', err);
      }
    }
  }

  try {
    return await api.getEquipmentDepotZones(resolvedId);
  } catch {
    return null;
  }
}

/**
 * Recupere la liste complete des depots avec leur contenu
 * (zones/floors/categories) au shape v1. En mode v2 : combine
 * `v2ListDepots` + `v2GetDepot` par depot puis adapte chaque
 * detail. Fallback v1 : `api.getAllDepotZones`.
 *
 * @param {object} api - Client API.
 * @param {object} [options]
 * @param {boolean} [options.useV2=false]
 * @returns {Promise<{ depots: object[] } | null>}
 */
export async function fetchAllDepotZones(api, { useV2 = false } = {}) {
  if (useV2 && typeof api?.v2ListDepots === 'function' && typeof api?.v2GetDepot === 'function') {
    try {
      const listResponse = await api.v2ListDepots();
      const compact = Array.isArray(listResponse?.data?.depots) ? listResponse.data.depots : null;
      if (compact) {
        const details = await Promise.all(
          compact.map(async (d) => {
            try {
              const detail = await api.v2GetDepot(d.depot_id);
              const adapted = adaptDepotV2ToV1(detail?.data?.depot);
              if (adapted && !adapted.id) adapted.id = d.depot_id ?? null;
              return adapted;
            } catch {
              return null;
            }
          }),
        );
        const filtered = details.filter(Boolean);
        if (filtered.length === compact.length) {
          return { depots: filtered };
        }
      }
    } catch (err) {
      if (!isFeatureDisabled(err)) {
        // eslint-disable-next-line no-console
        console.warn('[locations v2] fetchAllDepotZones: fallback v1', err);
      }
    }
  }

  try {
    return await api.getAllDepotZones();
  } catch {
    return null;
  }
}

/**
 * Lit le flag client v2 pour Locations. Convention Vite :
 * `VITE_FEATURE_V2_LOCATIONS=1` -> true, sinon false.
 *
 * @param {Record<string, string|undefined>} [env] - Injection facultative
 *   (utile pour les tests unitaires). Par defaut lit `import.meta.env`.
 * @returns {boolean}
 */
export function readLocationsV2ClientFlag(env) {
  const source = env ?? (typeof import.meta !== 'undefined' ? import.meta.env : {});
  const raw = source?.VITE_FEATURE_V2_LOCATIONS;
  if (raw === undefined || raw === null) return false;
  const value = String(raw).trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'yes';
}
