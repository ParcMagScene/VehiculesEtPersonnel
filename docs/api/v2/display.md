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

## `GET /api/v2/display/config`

**Authentification requise.**

Retournera la config d'un écran (theme, layout, playlist active) après
refonte T-P0-15. Skeleton renvoyant 501 tant que non implémenté.

### Réponse 501

```json
{
  "success": false,
  "error": "Not implemented — voir /api/display/screens/:id et /api/display/appearance",
  "code": "NOT_IMPLEMENTED",
  "meta": {
    "protocol_version": 1,
    "legacy_endpoints": ["/api/display/screens/:id", "/api/display/appearance"],
    "ticket": "T-P0-15"
  }
}
```

---

## `GET /api/v2/display/content`

**Authentification requise.**

Retournera le contenu de la playlist active pour un écran (media list,
timings, transitions). Skeleton 501 — T-P0-15.

`meta.legacy_endpoints` : `[/api/display/playlists, /api/display/playlists/:id]`.

---

## `GET /api/v2/display/signals`

**Authentification requise.**

Signaux temps réel (heartbeat, messages, alertes) pour un écran.
Skeleton 501 — T-P0-16 (migration SSE prévue).

`meta.legacy_endpoints` : `[/api/display/messages, /api/display/screens/:id/heartbeat, /api/display/welcome-messages]`.

---

## Enrichissement `display_logs`

T-P0-14 ajoute 5 colonnes additives à la table `display_logs` (audit
trail) : `client_ip`, `client_user_agent`, `protocol_version`,
`request_id`, `response_status`. Les inserts v1 existants n'écrivent
pas dans ces colonnes (valeurs NULL, rétro-compat totale).

Voir [../../05-Specs/DISPLAY_V2.md §3](../../05-Specs/DISPLAY_V2.md).
