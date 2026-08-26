// apps/api/services/eventBus.js
//
// Ticket : T-P1-02 (WebSocket core — bus evenements interne).
//
// Bus applicatif in-process fonde sur `node:events` EventEmitter.
// Utilise par le serveur WebSocket pour diffuser des evenements
// metier aux clients abonnes a un namespace. Peut aussi etre
// utilise par tout autre module backend (workers, jobs, routes)
// pour signaler un changement d'etat.
//
// Contrat :
//   - `publish(topic, payload)` : emet un evenement typé.
//   - `subscribe(topic, listener)` : renvoie un unsubscribe() safe
//     (idempotent).
//   - `topics()` : retourne la liste des topics reels ecoutés
//     (introspection).
//
// Ce bus est **strictement local** au process. Aucune persistence,
// aucun broker externe. Un ticket ulterieur (P4 cloud-ready) pourra
// remplacer ce module par un adapter Redis / NATS sans changer le
// contrat.

import { EventEmitter } from 'node:events';

/**
 * Nombre max de listeners par topic avant warning EventEmitter.
 * On monte a 100 pour supporter une centaine de clients
 * WebSocket concurrents sur un meme namespace.
 * @type {number}
 */
export const MAX_LISTENERS_PER_TOPIC = 100;

/**
 * Cree une instance de bus (utile pour les tests unitaires isolés).
 * Le singleton `eventBus` exporte est cree pour l'usage runtime.
 *
 * @returns {{
 *   publish: (topic: string, payload: unknown) => boolean,
 *   subscribe: (topic: string, listener: (payload: unknown) => void) => () => void,
 *   topics: () => string[],
 *   listenerCount: (topic: string) => number,
 *   removeAllListeners: (topic?: string) => void,
 * }}
 */
export function createEventBus() {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(MAX_LISTENERS_PER_TOPIC);

  return {
    /**
     * Emet un evenement synchrone. Retourne `true` si au moins un
     * listener a ete appele, `false` sinon.
     * @param {string} topic
     * @param {unknown} payload
     * @returns {boolean}
     */
    publish(topic, payload) {
      if (typeof topic !== 'string' || topic.length === 0) {
        throw new TypeError('eventBus.publish: topic string non vide requis');
      }
      return emitter.emit(topic, payload);
    },

    /**
     * Enregistre un listener sur un topic. Renvoie une fonction
     * d'unsubscribe idempotente (safe a appeler N fois).
     * @param {string} topic
     * @param {(payload: unknown) => void} listener
     * @returns {() => void}
     */
    subscribe(topic, listener) {
      if (typeof topic !== 'string' || topic.length === 0) {
        throw new TypeError('eventBus.subscribe: topic string non vide requis');
      }
      if (typeof listener !== 'function') {
        throw new TypeError('eventBus.subscribe: listener function requis');
      }
      emitter.on(topic, listener);
      let removed = false;
      return () => {
        if (removed) return;
        emitter.off(topic, listener);
        removed = true;
      };
    },

    /**
     * @returns {string[]} Liste des topics ayant au moins 1 listener.
     */
    topics() {
      return emitter.eventNames().map((n) => (typeof n === 'string' ? n : String(n)));
    },

    /**
     * @param {string} topic
     * @returns {number}
     */
    listenerCount(topic) {
      return emitter.listenerCount(topic);
    },

    /**
     * @param {string} [topic] Si omis, retire tous les listeners de tous les topics.
     */
    removeAllListeners(topic) {
      if (topic === undefined) emitter.removeAllListeners();
      else emitter.removeAllListeners(topic);
    },
  };
}

/**
 * Singleton bus utilise en runtime par le serveur WS + les modules
 * metier.
 * @type {ReturnType<typeof createEventBus>}
 */
export const eventBus = createEventBus();
