# API v2 — WebSocket

**Ticket** : T-P1-02 (WebSocket core).
**Feature flag serveur** : `FEATURE_V2_WEBSOCKET` (off par défaut).
**Coexistence** : le TV-client v2 (SSE `/api/v2/display/signals/stream`,
T-P0-16) reste actif indépendamment. Le sous-système WebSocket est un
canal parallèle.

---

## 1. Contrat URL

```
ws(s)://<host>/api/v2/ws/<namespace>
```

- Prefixe : `/api/v2/ws/` (tout autre chemin `Upgrade: websocket` est
  ignoré par le socle WS eM@g).
- Namespaces livrés en T-P1-02 :
  - `meta` — heartbeat + ping/pong + whoami (smoke-test).
- Namespaces déclarés mais **pas encore implémentés** (T-P1-02b) :
  - `messaging`
  - `display`

Un namespace inconnu répond `404` avant l'upgrade.

Un namespace déclaré mais non prêt (`messaging`, `display`) accepte
l'upgrade puis envoie immédiatement `{ type: 'error', code:
'NAMESPACE_NOT_READY' }` et ferme le socket avec `code=1013`.

---

## 2. Auth

Priorité :

1. Query string : `?token=<jwt>` (utile pour l'upgrade quand le
   cookie ne peut pas être transmis, ex cross-origin).
2. Header : `Authorization: Bearer <jwt>`.
3. Cookie httpOnly : `auth_token` (nom paramétrable via
   `COOKIE_NAME`).

Vérifications alignées avec le middleware HTTP
`middleware/authenticate.js` :

- JWT signé HS256 avec `JWT_SECRET`.
- Session correspondante dans `active_sessions` non expirée.

En cas d'échec : upgrade refusé avec `401 Unauthorized`, socket
détruit immédiatement.

---

## 3. Cycle de vie

### Handshake

Après upgrade réussi, le serveur envoie un message d'accueil :

```json
{
  "type": "welcome",
  "namespace": "meta",
  "protocol_version": "1.0.0",
  "meta_protocol_version": "1.0.0",
  "user": { "id": 42, "email": "user@e.mag" },
  "server_ts": "2026-07-10T09:15:00.000Z"
}
```

### Messages entrants (namespace `meta`)

| Type | Payload attendu | Réponse |
|------|-----------------|---------|
| `ping` | `{"type":"ping"}` | `{"type":"pong","ts":"…"}` |
| `whoami` | `{"type":"whoami"}` | `{"type":"whoami","user":{"id","email"}}` |
| inconnu | — | `{"type":"error","code":"UNKNOWN_TYPE","received_type":"…"}` |
| JSON invalide | — | `{"type":"error","code":"INVALID_JSON"}` |

### Heartbeat serveur (namespace `meta`)

Le serveur envoie automatiquement toutes les
`DEFAULT_HEARTBEAT_INTERVAL_MS` (30 s par défaut, désactivable via
`heartbeatIntervalMs: 0` dans `attachWebSocketServer`) :

```json
{
  "type": "heartbeat",
  "namespace": "meta",
  "protocol_version": "1.0.0",
  "ts": "2026-07-10T09:15:30.000Z",
  "uptime_ms": 15304,
  "namespace_client_counts": { "meta": 3 }
}
```

---

## 4. Bus interne `eventBus`

Le module `apps/api/services/eventBus.js` expose un singleton
EventEmitter typé (`publish` / `subscribe` / `topics` /
`listenerCount` / `removeAllListeners`) utilisé pour découpler les
modules métier du serveur WS.

**Convention topic → broadcast namespace** :

```
ws:<namespace>:<event>
```

Exemple T-P1-02 : `ws:meta:announce` — tout payload publié sur ce
topic est broadcasté aux clients `meta` sous la forme
`{ type: 'announce', payload: <original>, ts: <ISO> }`.

Les topics `ws:messaging:*` et `ws:display:*` sont réservés à
T-P1-02b.

---

## 5. Client — `ReconnectingWebSocket`

Fichier : `apps/web/src/utils/ws/reconnectingWebSocket.js`.

- Reconnexion exponentielle bornée : `initialRetryMs=500`,
  `backoffFactor=2`, `maxRetryMs=30_000`, `jitterRatio=0.2`.
- Queue de messages avec cap `maxQueueSize=100` (drop les plus
  anciens quand plein).
- Événements : `open`, `message`, `close`, `error`, `reconnect`
  (avec `{ attempt, delay }`).
- `close()` volontaire : aucune reconnexion.

Exemple d'usage :

```js
import { ReconnectingWebSocket } from '@/utils/ws/reconnectingWebSocket';

const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/v2/ws/meta`;
const ws = new ReconnectingWebSocket(wsUrl);

ws.on('open', () => ws.send(JSON.stringify({ type: 'ping' })));
ws.on('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type === 'pong') console.log('server ts', msg.ts);
});
ws.on('reconnect', ({ attempt, delay }) => {
  console.log(`reconnect #${attempt} dans ${delay}ms`);
});
```

Le token JWT doit être injecté dans l'URL sous forme `?token=…` si
le cookie httpOnly n'est pas partagé (cross-origin).

---

## 6. Reference

- `apps/api/ws/index.js` : `attachWebSocketServer`,
  `parseWebSocketUrl`, `safeSendJson`, `WEBSOCKET_PROTOCOL_VERSION`,
  `WEBSOCKET_V2_FLAG`, `WEBSOCKET_KNOWN_NAMESPACES`,
  `WEBSOCKET_URL_PREFIX`.
- `apps/api/ws/auth.js` : `verifyWebSocketRequest`,
  `extractTokenFromRequest`, `parseCookieHeader`.
- `apps/api/ws/namespaces/meta.js` : `handleMetaMessage`,
  `buildHeartbeatPayload`, `META_NAMESPACE_NAME`,
  `META_WS_PROTOCOL_VERSION`, `DEFAULT_HEARTBEAT_INTERVAL_MS`.
- `apps/api/services/eventBus.js` : `createEventBus`, `eventBus`
  singleton, `MAX_LISTENERS_PER_TOPIC`.
- `apps/web/src/utils/ws/reconnectingWebSocket.js` : classe +
  `computeBackoffDelay`, `applyJitter`.

---

## 7. Non couvert par T-P1-02

- **Namespaces `messaging` et `display`** : logique métier reportée
  à **T-P1-02b** (nécessite refactor du domaine `messaging` +
  intégration avec le pipeline SSE Display existant).
- **Persistence des messages non délivrés** : hors scope core.
  Si un client est offline, il perd les événements. Le pipeline
  métier peut re-lire l'état complet à la reconnexion (approche
  "state-heavy").
- **Broker distribué** (Redis / NATS) : hors scope P1 (viser P4
  cloud-ready).
