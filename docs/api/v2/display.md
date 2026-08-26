# 📙 API v2 — Display

> Base URL : `/api/v2/display/*`
> Feature flag serveur : `FEATURE_V2_DISPLAY` (off par défaut, 404 `FEATURE_DISABLED` si off).
> Ticket : [T-P0-14](../../../EXECUTION_PLAN_EMAG_3_0.md).
> Spec complète : [../../05-Specs/DISPLAY_V2.md](../../05-Specs/DISPLAY_V2.md).

Namespace de scaffold pour la refonte progressive du module Display v1
(`apps/api/displayRoutes.js`, 2333 lignes, 55+ endpoints). L'objectif
T-P0-14 est d'exposer un endpoint de **discovery** stable et 3
skeletons signés pour permettre au futur TV-client v2 (T-P0-16) de
négocier le protocole avant l'implémentation métier (T-P0-15).

---

## `GET /api/v2/display/protocol`

**Discovery — aucune authentification requise.**

Retourne la version du protocole TV/Display v2 et les capacités
annoncées par le serveur. Le TV-client doit interroger cet endpoint
au démarrage pour négocier son comportement.

### Réponse 200

```json
{
  "success": true,
  "data": {
    "protocol_version": "2.0.0",
    "capabilities": [
      "protocol-discovery",
      "config-skeleton",
      "content-skeleton",
      "signals-skeleton"
    ],
    "legacy_namespace": "/api/display",
    "docs": "/docs/api/v2/display.md"
  },
  "meta": {
    "protocol_version": 1
  }
}
```

- `data.protocol_version` : version du **protocole Display TV** (`2.0.0`).
- `data.capabilities` : kebab-case stables. Le client peut ignorer une
  capability inconnue et dégrader gracieusement.
- `data.legacy_namespace` : rappel pointant sur l'API v1 pour les
  fonctionnalités non encore migrées.
- `meta.protocol_version` : version du **wrapper API v2** (`1`), commune
  à tous les endpoints `/api/v2/*`.

### Réponse 404 (feature flag off)

```json
{
  "success": false,
  "error": "Endpoint non disponible",
  "code": "FEATURE_DISABLED",
  "meta": { "flag": "FEATURE_V2_DISPLAY" }
}
```

---

## `GET /api/v2/display/config?screen_id=<id>`

**Authentification requise.**

Retourne la configuration complète d'un écran : row `display_screens`
+ playlist affectée + appearance mergée avec les defaults.

### Réponse 200

```json
{
  "success": true,
  "data": {
    "screen": {
      "id": 1,
      "name": "Ecran hall",
      "location": "Hall entrée",
      "resolution": "1920x1080",
      "orientation": "landscape",
      "status": "online",
      "is_active": true,
      "last_heartbeat": "2026-07-09T10:15:30Z",
      "config": { "theme": "dark" }
    },
    "playlist": { "id": 3, "name": "Playlist par défaut" },
    "appearance": {
      "primaryColor": "#00e1ff",
      "secondaryColor": "#000000",
      "eventBgColor": "#000000",
      "eventTextColor": "#ffffff",
      "fontFamily": "Arial, sans-serif",
      "showWeather": false,
      "autoScroll": true,
      "weatherApiKey": "",
      "weatherCity": "Saint-Denis,RE,FR"
    }
  },
  "meta": { "protocol_version": 1 }
}
```

- `screen.config` : JSON parsed depuis la colonne TEXT `display_screens.config`.
- `playlist` : `null` si l'écran n'a pas de playlist affectée.
- `appearance` : merge des overrides de `display_config` avec les
  valeurs par défaut. Toujours complet (jamais partiel).

### Réponses d'erreur

- **400 VALIDATION_ERROR** : `screen_id` manquant ou invalide.
- **404 NOT_FOUND** : écran inexistant.

---

## `GET /api/v2/display/content?playlist_id=<id>`

**Authentification requise.**

Retourne le contenu ordonné d'une playlist avec métadonnées enrichies
(`item_name` résolu par jointure conditionnelle sur `item_type`).

### Réponse 200

```json
{
  "success": true,
  "data": {
    "playlist": {
      "id": 3,
      "name": "Playlist par défaut",
      "description": "Rotation matinée",
      "is_active": true
    },
    "items": [
      {
        "id": 42,
        "playlist_id": 3,
        "item_type": "media",
        "item_id": 10,
        "item_name": "video1.mp4",
        "duration": 30,
        "sort_order": 1,
        "config": {}
      },
      {
        "id": 43,
        "playlist_id": 3,
        "item_type": "message",
        "item_id": 20,
        "item_name": "Bienvenue",
        "duration": 10,
        "sort_order": 2,
        "config": {}
      }
    ],
    "total": 2
  },
  "meta": { "protocol_version": 1 }
}
```

- `items` : trié par `sort_order` croissant.
- `item_name` : `original_name` pour `media`, `title` pour `message`,
  `name` pour `template`.

### Réponses d'erreur

- **400 VALIDATION_ERROR** : `playlist_id` manquant ou invalide.
- **404 NOT_FOUND** : playlist inexistante.

---

## `GET /api/v2/display/signals?screen_id=<id>`

**Authentification requise.**

Retourne les signaux temps-réel pour un écran : messages actifs triés
par priorité, welcome message du créneau courant, heartbeat de
référence.

### Réponse 200

```json
{
  "success": true,
  "data": {
    "screen": {
      "id": 1,
      "name": "Ecran hall",
      "status": "online",
      "last_heartbeat": "2026-07-09T10:15:30Z"
    },
    "messages": [
      {
        "id": 21,
        "title": "Alerte incendie",
        "body": "Évacuation en cours",
        "priority": "urgent",
        "date_start": null,
        "date_end": null
      }
    ],
    "welcome_message": {
      "day": "lun",
      "slot": "morning",
      "message": "Bonjour lundi"
    },
    "generated_at": "2026-07-09T09:00:00.000Z"
  },
  "meta": { "protocol_version": 1 }
}
```

- `messages` : filtre `is_active=1 AND (date_end IS NULL OR date_end >=
  today)`. Trié `urgent > high > normal > low`.
- `welcome_message` : `null` si pas de mapping `(day, slot)` défini.
  `day` = nom court FR (`lun`, `mar`, ...), `slot` = `morning` /
  `afternoon` / `evening` selon l'heure locale du serveur.
- `generated_at` : timestamp ISO pour permettre au client de calculer
  la fraîcheur.

**Migration prévue T-P0-16** : SSE au lieu du polling pour push
serveur→client (heartbeat + messages push).

### Réponses d'erreur

- **400 VALIDATION_ERROR** : `screen_id` manquant ou invalide.
- **404 NOT_FOUND** : écran inexistant.

---

## `GET /api/v2/display/signals/stream?screen_id=<id>` (T-P0-16)

**Authentification requise. Réponse Server-Sent Events (SSE).**

Ouvre un flux SSE qui pousse un snapshot initial immédiat puis :

- un **heartbeat** `event: ping` toutes les **15 s** (keep-alive TCP,
  détection de rupture côté client).
- un **snapshot** `event: snapshot` toutes les **10 s** (permet aux
  nouveaux messages / changements de créneau d'atteindre le client
  sans reload).

### Contrat SSE

- `Content-Type: text/event-stream` (+ `charset=utf-8` ajouté par
  Express — le client doit matcher avec `startsWith` ou regex).
- `Cache-Control: no-cache, no-transform`.
- `X-Accel-Buffering: no` (Nginx/Caddy : désactive le buffering
  reverse proxy qui empêcherait le flush immédiat).

### Format des events

```
event: snapshot
data: {"screen":{...},"messages":[...],"welcome_message":{...},"generated_at":"..."}

event: ping
data: {"at":"2026-07-09T10:15:30Z"}
```

Le payload `snapshot` est identique à celui de `GET /api/v2/display/
signals` (partagé via le service `getSignalsForScreen`).

### Client TV-client v2 (`/tv-client/v2/`)

Le client de référence utilise `EventSource` :

```js
const es = new EventSource('/api/v2/display/signals/stream?screen_id=1');
es.addEventListener('snapshot', (evt) => renderSignals(JSON.parse(evt.data)));
es.addEventListener('ping', () => { /* keep-alive noop */ });
es.onerror = () => { es.close(); setTimeout(reconnect, 3000); };
```

Voir [../../../apps/tv-client/v2/main.js](../../../apps/tv-client/v2/main.js).

### Réponses d'erreur

- **400 VALIDATION_ERROR** : `screen_id` manquant ou invalide (répondu
  AVANT l'ouverture du flux SSE — le client reçoit JSON standard, pas
  un stream).
- **404 NOT_FOUND** : écran inexistant.
- **Fermeture réseau** : le serveur libère les timers via `req.on
  ('close')`. Aucun leak.

### Capability

`screen-signals-stream-v1` doit être présent dans
`GET /api/v2/display/protocol` → `data.capabilities`. Le client
dégrade sur polling `/signals` (capability `screen-signals-v1`) si
le stream n'est pas annoncé.

---

## Enrichissement `display_logs`

T-P0-14 ajoute 5 colonnes additives à la table `display_logs` (audit
trail) : `client_ip`, `client_user_agent`, `protocol_version`,
`request_id`, `response_status`. Les inserts v1 existants n'écrivent
pas dans ces colonnes (valeurs NULL, rétro-compat totale).

Voir [../../05-Specs/DISPLAY_V2.md §3](../../05-Specs/DISPLAY_V2.md).
