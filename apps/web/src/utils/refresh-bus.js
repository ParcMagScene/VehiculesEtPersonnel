/**
 * refresh-bus
 * -----------
 * Bus d'événements ultra-léger (basé sur `EventTarget`) pour propager des
 * notifications de rafraîchissement entre modules React eM@g, sans dépendance
 * externe (pas de React Query, pas de Zustand).
 *
 * Usage typique :
 *
 *   // Côté mutation (ex. après création d'une réservation)
 *   import { refreshBus } from '../utils/refresh-bus';
 *   await api.reservations.create(payload);
 *   refreshBus.publish('reservations');
 *   refreshBus.publish('affaires'); // cross-module
 *
 *   // Côté consommateur (composant qui affiche la liste)
 *   import { useRefreshSubscription } from '../hooks/useRefreshSubscription';
 *   useRefreshSubscription('reservations', loadReservations);
 *
 * Conventions de clés (à enrichir au fil de l'adoption) :
 *   - 'vehicles', 'reservations', 'maintenances', 'persons', 'leaves',
 *     'equipment', 'sav', 'stock', 'orders', 'affaires', 'planning',
 *     'annuaire', 'inventory'
 *
 * Notes :
 *   - Le bus n'embarque aucun payload : il signale uniquement « cette
 *     entité a changé, recharge ». Les souscripteurs décident quoi recharger.
 *   - Adoption progressive : un module peut publier sans qu'aucun ne souscrive
 *     (et inversement) sans erreur.
 *   - `publish()` est synchrone (les handlers sont invoqués dans l'ordre
 *     d'abonnement, sans micro-task supplémentaire).
 */

const target = new EventTarget();

function publish(key) {
  if (typeof key !== 'string' || key.length === 0) return;
  target.dispatchEvent(new Event(key));
}

function subscribe(key, handler) {
  if (typeof key !== 'string' || typeof handler !== 'function') {
    return () => {};
  }
  target.addEventListener(key, handler);
  return () => target.removeEventListener(key, handler);
}

export const refreshBus = { publish, subscribe };

export default refreshBus;
