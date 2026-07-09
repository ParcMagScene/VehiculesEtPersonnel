# SPEC — Display v2 (TV-client + API versionnée)

> **Version** : 0.1.0 (T-P0-14 : scaffold API + protocol discovery)
> **Statut** : `Coexistence — namespace v2 gate par FEATURE_V2_DISPLAY`
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
| `GET /api/v2/display/config` | oui | Config par écran (theme, layout, playlist active) | T-P0-15 (skeleton 501 en T-P0-14) |
| `GET /api/v2/display/content` | oui | Contenu playlist active (media list, timings) | T-P0-15 (skeleton 501 en T-P0-14) |
| `GET /api/v2/display/signals` | oui | Signaux temps réel (messages, alertes, heartbeat) | T-P0-16 (skeleton 501 en T-P0-14, SSE prévu) |

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

### 2.3 Skeletons (T-P0-14)

Les 3 endpoints `config`, `content`, `signals` sont livrés en 501
`NOT_IMPLEMENTED` avec un `meta.legacy_endpoints` pointant vers les
équivalents v1. Cela permet :

- Au TV-client v2 (T-P0-16) de découvrir l'API sans tests conditionnels.
- Aux tests automatiques de vérifier que le canal v2 est monté.
- À l'équipe backend (T-P0-15) de renseigner ces endpoints
  progressivement sans casser le contract discovery.

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

## 4. Ce que T-P0-14 fait (ce commit)

- Fichier `apps/api/v2/displayRoutes.js` (nouveau) :
  - Constantes `DISPLAY_PROTOCOL_VERSION = '2.0.0'`, `DISPLAY_V2_FLAG =
    'FEATURE_V2_DISPLAY'`, `DISPLAY_V2_CAPABILITIES` (4 kebab-case).
  - Fonction `setupDisplayV2Routes(app, authenticateToken)`.
  - 4 endpoints : 1 discovery + 3 skeletons 501.
- Enregistrement dans `apps/api/server.js` après `setupPlanningV2Routes`.
- Migration `display_logs` +5 colonnes dans `apps/api/database.js`.
- Variable `FEATURE_V2_DISPLAY=0` documentée dans `apps/api/.env.example`.
- Tests smoke : montage endpoints, réponses attendues, gate flag.

Aucune modification du code v1 ni de la TV-client existante.

---

## 5. Ce que T-P0-14 NE fait PAS (tickets suivants)

- **T-P0-15 (DisplayService interne)** : refonte métier — extraction
  de la logique `screens/playlists/media/appearance` en `services/
  display/*`, implémentation des 3 endpoints skeleton (config, content).
- **T-P0-16 (TV-client v2)** :
  - Client TV nouvelle génération qui parse `protocol_version` et
    dégrade gracieusement selon `capabilities`.
  - SSE pour `signals` (au lieu de polling heartbeat v1).
- **Sunset v1** : conditionné à `P0-DECISION-2`, comme Planning v2.

---

## 6. Rollback

- **`FEATURE_V2_DISPLAY=0`** (défaut) : tous les endpoints v2 renvoient
  404 `FEATURE_DISABLED`. TV-client v1 continue de fonctionner
  exclusivement via `/api/display/*`.
- **Colonnes `display_logs`** additives : ne cassent aucun code
  existant. `DROP COLUMN` faisable via SQLite 3.35+ si besoin.

Ref : [`EXECUTION_PLAN_EMAG_3_0.md`](../../EXECUTION_PLAN_EMAG_3_0.md) —
T-P0-14 · Display v2 — API versionnée & protocole TV.
