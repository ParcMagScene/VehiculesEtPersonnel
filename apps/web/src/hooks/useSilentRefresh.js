import { useEffect, useRef } from 'react';
import api from '../utils/api';

// Intervalle de rafraîchissement : toutes les 12 heures
const REFRESH_INTERVAL = 12 * 60 * 60 * 1000;

/**
 * Hook de renouvellement silencieux du token JWT.
 * - Déclenche un refresh périodique (toutes les 12h)
 * - Déclenche un refresh au retour de veille/tab inactive
 * - Met à jour les infos utilisateur côté client
 * - Ne provoque aucun redirect, popup, ni effet visible
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
      try {
        const data = await api.request('/auth/refresh', { method: 'POST' });
        if (data?.user) {
          updateUser(data.user);
          lastRefreshRef.current = Date.now();
        }
      } catch {
        // Silencieux — si le refresh échoue (session expirée, réseau…),
        // la prochaine requête API déclenchera le mécanisme standard (401 → reload)
      }
    }

    // Timer périodique
    intervalId = setInterval(doRefresh, REFRESH_INTERVAL);

    // Refresh au retour de tab/veille (si > 1h depuis le dernier refresh)
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastRefreshRef.current;
        if (elapsed > 60 * 60 * 1000) {
          doRefresh();
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, updateUser]);
}
