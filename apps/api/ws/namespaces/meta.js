// apps/api/ws/namespaces/meta.js
//
// Ticket : T-P1-02 (WebSocket core — namespace `meta`).
//
// Namespace de smoke-test et d'introspection du serveur WS. Fournit :
//   - un heartbeat serveur (`meta:heartbeat`) toutes les
//     `HEARTBEAT_INTERVAL_MS` millisecondes, contenant l'uptime,
//     le nombre de clients connectes par namespace, la version
//     protocolaire.
//   - un echo `ping` -> `pong` applicatif (independant du ping/pong
//     WebSocket bas niveau).
//   - un `whoami` qui renvoie l'identite du client authentifie.
//
// Aucun couplage metier. Utilise uniquement pour verifier de bout
// en bout l'infra WebSocket avant que T-P1-02b ajoute les
// namespaces metier (`messaging`, `display`).

/**
 * Version protocolaire du namespace meta.
 * @type {string}
 */
export const META_WS_PROTOCOL_VERSION = '1.0.0';

/**
 * Nom canonique du namespace.
 * @type {string}
 */
export const META_NAMESPACE_NAME = 'meta';

/**
 * Interval par defaut du heartbeat (ms).
 * @type {number}
 */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Traite un message client texte JSON. Retourne le payload de
 * reponse a serializer, ou null si aucun echo attendu (par exemple
 * pour un message invalide qu'on prefere ignorer silencieusement).
 *
 * Contrat des messages entrant :
 *   { type: 'ping'    } -> { type: 'pong', ts }
 *   { type: 'whoami'  } -> { type: 'whoami', user: { id, email } }
 *   inconnu           -> { type: 'error', code: 'UNKNOWN_TYPE' }
 *
 * @param {unknown} raw Message texte brut recu du client.
 * @param {{ user?: { id: number, email?: string } }} ctx
 * @returns {object|null}
 */
export function handleMetaMessage(raw, ctx = {}) {
  let msg;
  try {
    msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return { type: 'error', code: 'INVALID_JSON' };
  }
  if (!msg || typeof msg !== 'object') {
    return { type: 'error', code: 'INVALID_MESSAGE' };
  }
  switch (msg.type) {
    case 'ping':
      return { type: 'pong', ts: new Date().toISOString() };
    case 'whoami':
      return { type: 'whoami', user: ctx.user ? { id: ctx.user.id, email: ctx.user.email } : null };
    default:
      return { type: 'error', code: 'UNKNOWN_TYPE', received_type: msg.type };
  }
}

/**
 * Construit un payload heartbeat.
 *
 * @param {object} params
 * @param {number} params.uptimeMs Uptime process en ms.
 * @param {Record<string, number>} params.namespaceClientCounts
 * @returns {object}
 */
export function buildHeartbeatPayload({ uptimeMs, namespaceClientCounts } = {}) {
  return {
    type: 'heartbeat',
    namespace: META_NAMESPACE_NAME,
    protocol_version: META_WS_PROTOCOL_VERSION,
    ts: new Date().toISOString(),
    uptime_ms: Number.isFinite(uptimeMs) ? uptimeMs : null,
    namespace_client_counts: namespaceClientCounts || {},
  };
}
