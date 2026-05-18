import { useEffect } from 'react';

import { refreshBus } from '../utils/refresh-bus';

/**
 * useRefreshSubscription
 * ----------------------
 * Abonne le composant courant aux événements `key` du bus `refreshBus`.
 * Le handler reçoit le nom de la clé (compatible avec `() => loadData()`).
 *
 * Le désabonnement est automatique au démontage et lors d'un changement de
 * `key` ou `handler` (effet React standard).
 *
 * @param {string}   key      Nom de l'entité (ex. 'reservations').
 * @param {Function} handler  Callback à exécuter à chaque publication.
 */
export function useRefreshSubscription(key, handler) {
  useEffect(() => {
    if (!key || typeof handler !== 'function') return undefined;
    return refreshBus.subscribe(key, handler);
  }, [key, handler]);
}

export default useRefreshSubscription;
