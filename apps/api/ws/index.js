// apps/api/ws/index.js
//
// Ticket : T-P1-02 (WebSocket core — socle serveur).
//
// Attache un serveur WebSocket (bibliotheque `ws`) au serveur HTTP
// Express existant via l'evenement `upgrade`. Coexiste avec l'HTTP
// standard (aucune interception des routes REST/SSE existantes) et
// avec le TV-client v2 (SSE).
//
// Contrat URL :
//   ws(s)://host/api/v2/ws/<namespace>
//
// Gate par `FEATURE_V2_WEBSOCKET` (variable env). Si off, aucun
// upgrade n'est traite (le socket est ferme immediatement avec 400
// Bad Request — comportement HTTP normal quand rien n'ecoute).
//
// Auth : cookie httpOnly `auth_token` (JWT HS256) OU header
// `Authorization: Bearer <token>` OU query `?token=...` (fallback
// pour les cas ou le navigateur ne peut pas passer le cookie sur
// l'upgrade, ex WSS via API cross-origin).
//
// Namespaces livres : `meta` (T-P1-02). `messaging` et `display`
// prevus en T-P1-02b.

import { WebSocketServer } from 'ws';

import logger from '../logger.js';
import { eventBus as defaultEventBus } from '../services/eventBus.js';
import { verifyWebSocketRequest } from './auth.js';
import {
  buildHeartbeatPayload,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  handleMetaMessage,
  META_NAMESPACE_NAME,
  META_WS_PROTOCOL_VERSION,
} from './namespaces/meta.js';

/**
 * Version protocolaire globale du sous-systeme WebSocket. A
 * incrementer a chaque changement incompatible du contrat de
 * handshake ou du routage namespace.
 * @type {string}
 */
export const WEBSOCKET_PROTOCOL_VERSION = '1.0.0';

/**
 * Nom canonique du feature flag serveur.
 * @type {string}
 */
export const WEBSOCKET_V2_FLAG = 'FEATURE_V2_WEBSOCKET';

/**
 * Prefixe des URLs WS. Toutes les URLs qui ne commencent PAS par
 * ce prefixe sont ignorees (autres upgrades HTTP potentiels laisses
 * intacts).
 * @type {string}
 */
export const WEBSOCKET_URL_PREFIX = '/api/v2/ws/';

/**
 * Namespaces autorises. `messaging` et `display` sont declares mais
 * ne servent qu'en 404 tant que T-P1-02b n'a pas livre leur
 * handler metier (client reçoit `{type:'error', code:'NAMESPACE_NOT_READY'}`
 * puis le socket est ferme).
 * @type {ReadonlyArray<string>}
 */
export const WEBSOCKET_KNOWN_NAMESPACES = Object.freeze(['meta', 'messaging', 'display']);

/**
 * @param {string} name
 * @returns {boolean}
 */
function isFlagOn(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

/**
 * Parse l'URL de l'upgrade pour extraire `namespace` + `queryToken`.
 * Retourne `{ namespace, queryToken }` ou null si l'URL n'est pas
 * un WS eM@g.
 *
 * @param {string|undefined} rawUrl
 * @returns {{ namespace: string, queryToken: string|null } | null}
 */
export function parseWebSocketUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  // Base fictive pour parser une URL relative.
  let parsed;
  try {
    parsed = new URL(rawUrl, 'http://internal.local');
  } catch {
    return null;
  }
  if (!parsed.pathname.startsWith(WEBSOCKET_URL_PREFIX)) return null;
  const namespace = parsed.pathname.slice(WEBSOCKET_URL_PREFIX.length).replace(/\/+$/, '');
  if (!namespace || namespace.includes('/')) return null;
  const queryToken = parsed.searchParams.get('token');
  return { namespace, queryToken: queryToken || null };
}

/**
 * Envoie un objet JSON en toute securite sur un socket WS. No-op
 * si le socket n'est plus ouvert.
 *
 * @param {import('ws').WebSocket} ws
 * @param {object} payload
 */
export function safeSendJson(ws, payload) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch (err) {
    // On log mais on ne throw pas — un socket casse ne doit pas
    // faire tomber le serveur.
    logger.warn(`WS send failed: ${err?.message || err}`);
  }
}

/**
 * @typedef {object} WsCoreOptions
 * @property {string} jwtSecret
 * @property {import('better-sqlite3').Database} db
 * @property {ReturnType<typeof import('../services/eventBus.js').createEventBus>} [eventBus]
 * @property {number} [heartbeatIntervalMs]
 * @property {() => number} [uptimeMs]
 */

/**
 * Attache un serveur WebSocket au serveur HTTP fourni. Retourne un
 * objet avec des methodes de shutdown / introspection pour les
 * tests.
 *
 * @param {import('node:http').Server | import('node:https').Server} httpServer
 * @param {WsCoreOptions} options
 * @returns {{
 *   wss: import('ws').WebSocketServer,
 *   close: () => Promise<void>,
 *   clientsByNamespace: () => Record<string, number>,
 * }}
 */
export function attachWebSocketServer(httpServer, options = {}) {
  if (!httpServer || typeof httpServer.on !== 'function') {
    throw new TypeError('attachWebSocketServer: httpServer requis');
  }
  const { jwtSecret, db } = options;
  if (!jwtSecret || typeof jwtSecret !== 'string') {
    throw new TypeError('attachWebSocketServer: jwtSecret requis');
  }
  if (!db) {
    throw new TypeError('attachWebSocketServer: db requis');
  }
  const bus = options.eventBus || defaultEventBus;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const uptimeMs =
    typeof options.uptimeMs === 'function' ? options.uptimeMs : () => process.uptime() * 1000;

  const wss = new WebSocketServer({ noServer: true });

  /**
   * clients suivis par namespace pour introspection + broadcast.
   * @type {Map<string, Set<import('ws').WebSocket>>}
   */
  const clientsByNs = new Map();

  function addClient(namespace, ws) {
    let set = clientsByNs.get(namespace);
    if (!set) {
      set = new Set();
      clientsByNs.set(namespace, set);
    }
    set.add(ws);
  }

  function removeClient(namespace, ws) {
    const set = clientsByNs.get(namespace);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) clientsByNs.delete(namespace);
  }

  function snapshotCounts() {
    /** @type {Record<string, number>} */
    const out = {};
    for (const [ns, set] of clientsByNs.entries()) out[ns] = set.size;
    return out;
  }

  // ── Handler upgrade HTTP -> WebSocket ─────────────────────────
  httpServer.on('upgrade', (req, socket, head) => {
    // Ignorer les URLs qui ne nous concernent pas.
    const parsed = parseWebSocketUrl(req.url);
    if (!parsed) return;

    // Gate feature flag : refus immediat, socket ferme proprement.
    if (!isFlagOn(WEBSOCKET_V2_FLAG)) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    // Namespace inconnu = 404.
    if (!WEBSOCKET_KNOWN_NAMESPACES.includes(parsed.namespace)) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    // Auth. Si echec, 401 avant handshake.
    const authResult = verifyWebSocketRequest({ req, jwtSecret, db });
    if (!authResult) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      handleConnection(ws, parsed.namespace, authResult.user);
    });
  });

  // ── Handler connection ────────────────────────────────────────
  function handleConnection(ws, namespace, user) {
    // Namespaces metier pas encore livres (T-P1-02b).
    if (namespace !== META_NAMESPACE_NAME) {
      safeSendJson(ws, {
        type: 'error',
        code: 'NAMESPACE_NOT_READY',
        message: `Namespace "${namespace}" declare mais pas encore implemente (T-P1-02b).`,
      });
      ws.close(1013, 'Namespace not ready');
      return;
    }

    addClient(namespace, ws);
    logger.info(`WS connect ns=${namespace} user=${user?.id}`);

    // Handshake ok — message d'accueil applicatif.
    safeSendJson(ws, {
      type: 'welcome',
      namespace,
      protocol_version: WEBSOCKET_PROTOCOL_VERSION,
      meta_protocol_version: META_WS_PROTOCOL_VERSION,
      user: { id: user.id, email: user.email },
      server_ts: new Date().toISOString(),
    });

    ws.on('message', (rawBuf) => {
      const raw = rawBuf?.toString?.('utf8') ?? '';
      const reply = handleMetaMessage(raw, { user });
      if (reply) safeSendJson(ws, reply);
    });

    ws.on('close', () => {
      removeClient(namespace, ws);
      logger.info(`WS disconnect ns=${namespace} user=${user?.id}`);
    });

    ws.on('error', (err) => {
      logger.warn(`WS error ns=${namespace} user=${user?.id}: ${err?.message || err}`);
    });
  }

  // ── Bus subscription : broadcast a partir d'evenements internes ──
  // Convention : les modules metier publient sur `ws:<namespace>:<event>`
  // avec un payload serializable. Ex :
  //   eventBus.publish('ws:meta:announce', { kind: 'admin', message: '…' });
  // Le socle boucle sur les clients du namespace et emet le message.
  const unsubscribeAnnounce = bus.subscribe('ws:meta:announce', (payload) => {
    const set = clientsByNs.get(META_NAMESPACE_NAME);
    if (!set) return;
    const message = { type: 'announce', payload, ts: new Date().toISOString() };
    for (const ws of set) safeSendJson(ws, message);
  });

  // ── Heartbeat periodique ──────────────────────────────────────
  let heartbeatTimer = null;
  if (heartbeatIntervalMs > 0) {
    heartbeatTimer = setInterval(() => {
      const payload = buildHeartbeatPayload({
        uptimeMs: uptimeMs(),
        namespaceClientCounts: snapshotCounts(),
      });
      const set = clientsByNs.get(META_NAMESPACE_NAME);
      if (!set) return;
      for (const ws of set) safeSendJson(ws, payload);
    }, heartbeatIntervalMs);
    // Ne pas empecher un shutdown propre du process.
    heartbeatTimer.unref?.();
  }

  logger.info(
    `🔌 WebSocket core attache (namespaces=${WEBSOCKET_KNOWN_NAMESPACES.join(',')}, flag=${WEBSOCKET_V2_FLAG})`,
  );

  return {
    wss,
    clientsByNamespace: snapshotCounts,
    async close() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      unsubscribeAnnounce();
      // Fermer proprement chaque socket ouvert.
      for (const set of clientsByNs.values()) {
        for (const ws of set) {
          try {
            ws.close(1001, 'Server shutting down');
          } catch {
            // ignore
          }
        }
      }
      clientsByNs.clear();
      await new Promise((resolve) => wss.close(() => resolve()));
    },
  };
}
