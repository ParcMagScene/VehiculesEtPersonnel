import { useEffect, useRef } from 'react';

import api from '../utils/api';
import { isApiCoolingDown } from '../utils/api/base';

// Intervalle de rafraîchissement : toutes les 4 heures
const REFRESH_INTERVAL = 4 * 60 * 60 * 1000;

/**
 * Hook de renouvellement silencieux du token JWT.
 * - Déclenche un refresh périodique (toutes les 4h)
 * - Déclenche un refresh au retour de veille/tab inactive (> 30 min)
 * - Déclenche un refresh au retour réseau (navigator.onLine)
 * - Met à jour les infos utilisateur côté client
 * - Ne provoque aucun redirect, popup, ni effet visible
 * - Utilise _tryRefreshToken (fetch direct) pour éviter le pipeline 401/403 de request()
 *
 * @param {boolean} isAuthenticated - Est-ce que l'utilisateur est connecté
 * @param {function} updateUser - Callback pour mettre à jour le user dans le contexte
 */
export function useSilentRefresh(isAuthenticated, updateUser) {
  const lastRefreshRef = useRef(Date.now());

  useEffect(() => {
    if (!isAuthenticated) return;

    let intervalId;

    async function doRefresh() {
      if (isApiCoolingDown()) {
        return;
      }
      try {
        // Utilise _tryRefreshToken (fetch direct, pas api.request)
        // pour ne JAMAIS déclencher clearAuth/reload depuis le refresh silencieux
        const refreshed = await api._tryRefreshToken();
        if (refreshed) {
          const user = api.getCurrentUser();
          if (user) {
            updateUser(user);
            lastRefreshRef.current = Date.now();
          }
        }
      } catch {
        // Silencieux — si le refresh échoue (session expirée, réseau…),
        // la prochaine requête API déclenchera le mécanisme standard (401 → refresh → retry → reload)
      }
    }

    // Timer périodique
    intervalId = setInterval(doRefresh, REFRESH_INTERVAL);

    // Refresh au retour de tab/veille (si > 30 min depuis le dernier refresh)
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastRefreshRef.current;
        if (elapsed > 30 * 60 * 1000) {
          doRefresh();
        }
      }
    }

    // Refresh au retour réseau
    function handleOnline() {
      const elapsed = Date.now() - lastRefreshRef.current;
      if (elapsed > 5 * 60 * 1000) {
        doRefresh();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [isAuthenticated, updateUser]);
}
