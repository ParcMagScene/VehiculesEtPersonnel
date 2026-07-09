// router/featureFlags.js
//
// Ticket : T-P0-05 (UI TaskPlanningPanel v2).
//
// Détection des feature flags client. Priorité :
//   1. Query string `?v=2` sur le module courant → active `v2Planning`.
//   2. localStorage `emag_flag_<name>` = "1" → activation persistante.
//   3. Défaut = off.
//
// Aucun effet de bord global. Les composants qui consomment un flag
// utilisent `useFeatureFlag(name)`. Le flag serveur correspondant
// (`FEATURE_V2_<DOMAINE>`) contrôle la disponibilité effective des
// endpoints ; côté client, un flag off signifie simplement "afficher la
// UI v1".

import { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'emag_flag_';
const QUERY_PARAM_V = 'v';

/**
 * @param {string} name Nom canonique du flag (ex: 'v2Planning').
 * @returns {string}    Clé localStorage `emag_flag_v2Planning`.
 */
function storageKey(name) {
  return `${STORAGE_PREFIX}${name}`;
}

/**
 * Vrai si le flag `v2Planning` est actif à un instant t. Fonction pure,
 * safe SSR (renvoie false si `window`/`localStorage` indisponibles).
 *
 * @param {string} name Ex: 'v2Planning'.
 * @param {object} [opts]
 * @param {string} [opts.moduleParam] valeur courante du query param `module`.
 *   Si présent et correspond au préfixe du flag, active le flag via `?v=2`.
 * @returns {boolean}
 */
export function readFeatureFlag(name, opts = {}) {
  if (typeof window === 'undefined') return false;

  // 1. Query string ?v=2 quand le module vise le domaine du flag
  //    (ex: name='v2Planning' + moduleParam='planning' → check ?v=2).
  try {
    const params = new URLSearchParams(window.location.search);
    const version = params.get(QUERY_PARAM_V);
    if (version === '2' && name.startsWith('v2')) {
      const domain = name.slice(2).toLowerCase(); // 'v2Planning' → 'planning'
      const moduleParam = opts.moduleParam ?? params.get('module');
      if (!moduleParam || moduleParam.toLowerCase() === domain) return true;
    }
  } catch (_error) {
    /* URL parsing gracieux */
  }

  // 2. localStorage persistant
  try {
    return window.localStorage?.getItem(storageKey(name)) === '1';
  } catch (_error) {
    return false;
  }
}

/**
 * Force la valeur du flag (persisté localStorage). Utile pour toggler
 * un flag depuis une DevTool interne. Safe SSR.
 *
 * @param {string} name
 * @param {boolean} value
 * @returns {void}
 */
export function setFeatureFlag(name, value) {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.localStorage?.setItem(storageKey(name), '1');
    } else {
      window.localStorage?.removeItem(storageKey(name));
    }
  } catch (_error) {
    /* quota / private mode */
  }
}

/**
 * Hook React qui expose la valeur d'un feature flag et se met à jour
 * quand l'URL change (popstate) ou quand `setFeatureFlag` est appelé
 * depuis une autre onglet (storage event).
 *
 * @param {string} name
 * @returns {boolean}
 */
export function useFeatureFlag(name) {
  const [enabled, setEnabled] = useState(() => readFeatureFlag(name));

  useEffect(() => {
    const refresh = () => setEnabled(readFeatureFlag(name));
    window.addEventListener('popstate', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('popstate', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [name]);

  return enabled;
}
