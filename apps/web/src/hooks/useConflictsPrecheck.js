// apps/web/src/hooks/useConflictsPrecheck.js
//
// Ticket : T-P1-05b (Conflicts v2 — hook UI pre-check).
//
// Hook React de pre-check des conflits agenda personnel :
//   const { conflicts, hasConflict, count, loading, available } =
//     useConflictsPrecheck(api, {
//       personId, startDate, endDate, startPeriod, endPeriod, exclude,
//     }, { debounceMs: 300, enabled: true });
//
// Retourne `available=false` quand :
//   - le flag `VITE_FEATURE_V2_CONFLICTS` est off
//   - le namespace v2 est desactive cote serveur (FEATURE_DISABLED)
//   - `api.v2CheckConflicts` n'est pas enregistre
//   - toute erreur reseau
// C'est un signal au composant amont : "pre-check indisponible,
// on garde le comportement legacy" (POST createAssignment reste la
// source de verite).

import { useEffect, useRef, useState } from 'react';

import { checkPersonConflictsUnified } from '../utils/conflicts/checkPersonConflicts.js';
import { readConflictsV2ClientFlag } from '../utils/conflicts/v2Adapters.js';

/**
 * @param {object} api - Client API (`utils/api`).
 * @param {object} params - Cf `PersonConflictParams`.
 * @param {{
 *   debounceMs?: number,
 *   enabled?: boolean,
 *   useV2Override?: boolean|null,
 * }} [options]
 * @returns {{
 *   conflicts: Array<object>,
 *   hasConflict: boolean,
 *   count: number,
 *   loading: boolean,
 *   available: boolean,
 * }}
 */
export function useConflictsPrecheck(api, params, options = {}) {
  const { debounceMs = 300, enabled = true, useV2Override = null } = options;
  const [state, setState] = useState({
    conflicts: [],
    hasConflict: false,
    count: 0,
    loading: false,
    available: false,
  });
  const cancelRef = useRef({ cancelled: false });

  useEffect(() => {
    if (!enabled) {
      setState({
        conflicts: [],
        hasConflict: false,
        count: 0,
        loading: false,
        available: false,
      });
      return undefined;
    }

    const useV2 = useV2Override !== null ? Boolean(useV2Override) : readConflictsV2ClientFlag();
    const control = { cancelled: false };
    cancelRef.current.cancelled = true;
    cancelRef.current = control;

    setState((prev) => ({ ...prev, loading: true }));
    const timer = setTimeout(async () => {
      const result = await checkPersonConflictsUnified(api, params, { useV2 });
      if (control.cancelled) return;
      if (result === null) {
        setState({
          conflicts: [],
          hasConflict: false,
          count: 0,
          loading: false,
          available: false,
        });
        return;
      }
      setState({ ...result, loading: false, available: true });
    }, debounceMs);

    return () => {
      control.cancelled = true;
      clearTimeout(timer);
    };
    // Serialisation params : la stringification garantit la
    // reexecution uniquement quand une des cles change de valeur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, JSON.stringify(params), enabled, debounceMs, useV2Override]);

  return state;
}
