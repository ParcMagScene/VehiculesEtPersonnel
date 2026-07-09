# SPEC — Display v2 (TV-client + API versionnée)

> **Version** : 0.3.0 (T-P0-14 discovery + T-P0-15 services + T-P0-16 TV-client v2 & SSE)
> **Statut** : `Coexistence — namespace v2 gate par FEATURE_V2_DISPLAY, TV-client v2 opt-in via /tv-client/v2/`
> **Ticket source** : [`EXECUTION_PLAN_EMAG_3_0.md`](../../EXECUTION_PLAN_EMAG_3_0.md) — T-P0-14 → T-P0-16.

---

## 1. État actuel (avant T-P0-14)

Module Display v1 : `apps/api/displayRoutes.js` — **2333 lignes**,
**55+ endpoints** `/api/display/*` regroupant :

- **Screens** (écrans TV) : CRUD + heartbeat.
- **Playlists** (contenu diffusé) : CRUD + assignment.
- **Media** (fichiers image/vidéo) : upload + suppression.
- **Messages** (messages ponctuels overlay) : CRUD.
- **Templates** (mise en page) : CRUD.
- **Logs** : lecture, statistiques.
- **Appearance** (thème, couleurs, icônes) : config clé/valeur.
- **Welcome messages** (accueil par jour/créneau) : CRUD.
- **Sonos, TV public, TV legacy** : endpoints spécifiques.

TV-client (`apps/tv-client/`) consomme ces endpoints directement, sans
protocol negotiation. Aucun versioning d'API. Tout changement de
schéma casse le TV-client déployé.

`display_logs` (audit trail) : `id`, `screen_id`, `action`, `details`,
`user_id`, `created_at`. Aucun contexte client (IP, user-agent,
protocole, request-id, response status).

---

## 2. Modèle cible (T-P0-14 → T-P0-16)

### 2.1 Namespace v2

`/api/v2/display/*` gate par `FEATURE_V2_DISPLAY` (env). Coexistence
stricte avec v1. Endpoints livrés :

| Endpoint | Auth | Rôle | Ticket |
|----------|------|------|--------|
| `GET /api/v2/display/protocol` | non | **Discovery** : version protocole + capabilities | **T-P0-14** |
| `GET /api/v2/display/config?screen_id=<id>` | oui | Config par écran (screen + playlist + appearance) | **T-P0-15** ✅ |
| `GET /api/v2/display/content?playlist_id=<id>` | oui | Contenu playlist ordonné (items + `item_name` résolu) | **T-P0-15** ✅ |
| `GET /api/v2/display/signals?screen_id=<id>` | oui | Signaux temps réel (snapshot ponctuel) | **T-P0-15** ✅ |
| `GET /api/v2/display/signals/stream?screen_id=<id>` | oui | **SSE** — snapshot initial + ping 15s + snapshot 10s | **T-P0-16** ✅ |

### 2.2 Discovery endpoint

`GET /api/v2/display/protocol` — accessible sans authentification pour
permettre au TV-client de négocier avant d'obtenir un token.

Réponse :

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

Deux versions de protocole coexistent volontairement :

- `data.protocol_version` : **version du protocole TV Display** (client
  TV négocie ses capacités). Actuellement `2.0.0`.
- `meta.protocol_version` : **version du wrapper API v2** (commun à
  tous les endpoints `/api/v2/*`). Actuellement `1`.

Le client TV lit `data.capabilities` pour dégrader gracieusement si
une capability manque. Les capabilities sont des kebab-case stables.

### 2.3 Skeletons (T-P0-14) — remplacés par les services en T-P0-15

Les endpoints `config`, `content`, `signals` ont été livrés en 501
`NOT_IMPLEMENTED` en T-P0-14 puis **implémentés en T-P0-15** via
`apps/api/services/display/*` :

- `getScreenConfig({ db, screenId })` → screen + playlist + appearance.
- `getPlaylistContent({ db, playlistId })` → items ordonnés avec
  `item_name` résolu par jointure conditionnelle sur `item_type`.
- `getSignalsForScreen({ db, screenId, now })` → messages actifs triés
  par priorité + welcome message du créneau courant + heartbeat de
  référence.

Réponses HTTP standardisées via `handleServiceError` :
- Erreur `DisplayV2ValidationError` → **400** avec code `VALIDATION_ERROR`.
- Erreur `DisplayV2NotFoundError` → **404** avec code `NOT_FOUND`.
- Erreur non-typée → **500** avec code `INTERNAL_ERROR`.

Capabilities mises à jour en T-P0-15 : `protocol-discovery`,
`screen-config-v1`, `playlist-content-v1`, `screen-signals-v1`.

---

## 3. Enrichissement `display_logs`

Migration additive idempotente (dans `apps/api/database.js`, section
Module Dashboard) :

| Colonne | Type | Description |
|---------|------|-------------|
| `client_ip` | TEXT | IP source de la requête (utile debug TV distant) |
| `client_user_agent` | TEXT | User-Agent client (versionnage TV-client) |
| `protocol_version` | TEXT | Version protocole négociée (ex. `2.0.0` v2, `null` v1) |
| `request_id` | TEXT | UUID de corrélation cross-service |
| `response_status` | INTEGER | Code HTTP de la réponse |

Rétro-compat : les inserts existants dans `displayRoutes.js` v1
n'écrivent pas dans ces colonnes → valeurs NULL. Le populate se fera
au fur et à mesure des touches naturelles ou lors de T-P0-15.

---

## 4. Ce que T-P0-14 + T-P0-15 font (livré)

**T-P0-14** :
- Fichier `apps/api/v2/displayRoutes.js` (nouveau) : constantes
  (`DISPLAY_PROTOCOL_VERSION`, `DISPLAY_V2_FLAG`, `DISPLAY_V2_CAPABILITIES`),
  `setupDisplayV2Routes(app, authenticateToken)`, 4 endpoints.
- Enregistrement dans `apps/api/server.js` après `setupPlanningV2Routes`.
- Migration `display_logs` +5 colonnes dans `apps/api/database.js`.
- Variable `FEATURE_V2_DISPLAY=0` documentée dans `.env.example`.
- 11 tests smoke montage endpoints.

**T-P0-15** :
- Répertoire `apps/api/services/display/` (nouveau) :
  - `errors.js` : `DisplayV2ValidationError`, `DisplayV2NotFoundError`.
  - `config.js` : `getScreenConfig`, `readAppearance`.
  - `content.js` : `getPlaylistContent`.
  - `signals.js` : `getSignalsForScreen`, `slotForHour`.
  - `index.js` : barrel exports.
- Réécriture des 3 endpoints `/config`, `/content`, `/signals` dans
  `apps/api/v2/displayRoutes.js` : appel des services, gestion typée
  des erreurs.
- Capabilities renommées `screen-config-v1`, `playlist-content-v1`,
  `screen-signals-v1` (versionnées).
- 15 tests services (DB in-memory + fixtures).
- Tests smoke montage mis à jour (endpoints répondent 400/404/200
  au lieu de 501).

Aucune modification du code v1 ni de la TV-client existante.

---

## 5. Ce que T-P0-16 a livré

- **SSE endpoint** `GET /api/v2/display/signals/stream?screen_id=<id>` :
  snapshot initial immédiat + heartbeat `event: ping` toutes les 15 s
  + snapshot périodique `event: snapshot` toutes les 10 s. Cleanup
  automatique des timers à `req.on('close')`. Validation
  `screen_id` **avant** ouverture du flux (400 VALIDATION_ERROR si
  invalide). Nouvelle capability `screen-signals-stream-v1`.
- **TV-client v2** dans `apps/tv-client/v2/` (nouveau) :
  - `index.html` — HTML minimaliste, styles inline autonomes, aucun
    import de `styles.css` v1.
  - `main.js` — vanilla JS sans dépendance :
    - Discovery `GET /protocol` au boot.
    - Bootstrap `GET /config?screen_id=<id>`.
    - Chargement `GET /content?playlist_id=<id>` si playlist affectée.
    - `EventSource` sur `/signals/stream` si capability
      `screen-signals-stream-v1`, sinon fallback polling `/signals`
      toutes les 10 s si `screen-signals-v1` disponible.
    - Auto-reconnexion SSE après 3 s en cas d'erreur.
    - Application des couleurs `appearance.*` via CSS custom properties.
  - Accès : `/tv-client/v2/index.html?screen_id=<id>&token=<tv-token>`.
  - Rétro-compat TV-token : lu depuis URL ou `localStorage['tv-token']`.
- Le TV-client v1 (`/tv-client/index.html`, 735 lignes vanilla JS)
  reste actif et inchangé.

## 6. Sunset TV-client v1 (à venir)

- Conditionné à `P0-DECISION-2`.
- Migration progressive : rediriger `/tv` vers `/tv-client/v2/index.html`
  après dogfooding suffisant en dev.
- Retrait de `apps/tv-client/main.js` v1 (735 lignes) et `styles.css`
  v1 (665 lignes) une fois v2 stable en prod.

---

## 6. Rollback

- **`FEATURE_V2_DISPLAY=0`** (défaut) : tous les endpoints v2 renvoient
  404 `FEATURE_DISABLED`. TV-client v1 continue de fonctionner
  exclusivement via `/api/display/*`.
- **Colonnes `display_logs`** additives : ne cassent aucun code
  existant. `DROP COLUMN` faisable via SQLite 3.35+ si besoin.

Ref : [`EXECUTION_PLAN_EMAG_3_0.md`](../../EXECUTION_PLAN_EMAG_3_0.md) —
T-P0-14 · Display v2 — API versionnée & protocole TV.
