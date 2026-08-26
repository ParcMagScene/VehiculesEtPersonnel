// apps/web/src/utils/leaves/fetchLeaveCalculation.js
//
// Ticket : T-P1-04b (Leaves v2 — dogfooding UI calcul jours ouvrables).
//
// Chemin unifie de calcul du nombre de jours ouvrables :
// POST /api/v2/leaves/calculate (v2) ou POST /api/leaves/calculate
// (v1), avec fallback silencieux vers v1 en cas d'echec v2
// (FEATURE_DISABLED ou erreur reseau).
//
// Contrat : les deux chemins renvoient un shape camelCase
// (`{ workingDays, holidaysInPeriod, warnings, referencePeriod, ... }`)
// consomme par `LeaveRequestForm` et `MobileLeaves`. Zero regression
// fonctionnelle attendue.

import { adaptV2CalculationToV1 } from './v2Adapters.js';

/**
 * Detecte si une erreur remontee par le client API correspond a un
 * flag serveur eteint (404 FEATURE_DISABLED). Comportement aligne
 * sur `fetchAffairesV2` (T-P0-09b) et `fetchDepotZones` (T-P0-12b).
 * @param {unknown} err
 * @returns {boolean}
 */
export function isFeatureDisabled(err) {
  if (!err || typeof err !== 'object') return false;
  const code = err.code || err.details?.code;
  return code === 'FEATURE_DISABLED';
}

/**
 * Appelle le calcul jours ouvrables avec bascule v2/v1.
 *
 * @param {object} api - Client API (`apps/web/src/utils/api`).
 * @param {{
 *   startDate: string, endDate: string,
 *   startPeriod?: 'AM'|'PM', endPeriod?: 'AM'|'PM',
 *   leaveType?: string, exceptionalType?: string, requestDate?: string,
 * }} data
 * @param {{ useV2?: boolean }} [options]
 * @returns {Promise<object>} Objet camelCase (workingDays, warnings, ...).
 * @throws Toute erreur v1 : le composant amont doit catcher.
 */
export async function fetchLeaveCalculationUnified(api, data, { useV2 = false } = {}) {
  if (useV2 && typeof api?.v2CalculateLeaves === 'function') {
    try {
      const response = await api.v2CalculateLeaves(data);
      const adapted = adaptV2CalculationToV1(response);
      if (adapted) return adapted;
    } catch (err) {
      if (!isFeatureDisabled(err)) {
        // eslint-disable-next-line no-console
        console.warn('[leaves v2] fetchLeaveCalculationUnified: fallback v1', err);
      }
    }
  }
  return api.calculateLeaveWorkingDays(data);
}
