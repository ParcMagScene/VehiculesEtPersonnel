# API v2 — Core

**Ticket** : T-P1-01 (API v2 core — payload commun + pagination cursor + discovery global).

Ce document normalise les conventions transverses partagées par tous
les namespaces v2 (`planning`, `display`, `locations`, `affaires`).

---

## 1. Payload commun

Tous les endpoints v2 servent un format uniforme via les helpers de
`apps/api/utils/apiV2Response.js`.

### Succès

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "protocol_version": 1,
    "pagination": { ... }
  }
}
```

- `protocol_version` (entier) : version du wrapper de réponse v2
  (`API_V2_PROTOCOL_VERSION`). Ne pas confondre avec la
  `protocol_version` (string SemVer) exposée par chaque namespace
  dans `data.protocol_version` de son endpoint `/protocol`.
- Le bloc `pagination` n'est présent que pour les endpoints de
  liste.

### Erreur

```json
{
  "success": false,
  "error": "Message humain",
  "code": "VALIDATION_ERROR",
  "meta": {
    "protocol_version": 1,
    "details": { ... }
  }
}
```

Codes normalisés utilisés à travers les 4 namespaces :

| Code | HTTP | Signification |
|------|------|---------------|
| `VALIDATION_ERROR` | 400 | Entrée invalide (champ manquant, format). |
| `FEATURE_DISABLED` | 404 | Feature flag serveur `FEATURE_V2_<DOMAINE>` off. |
| `NOT_FOUND` | 404 | Ressource inexistante. |
| `CONFLICT` | 409 | Violation contrainte (UNIQUE, état incompatible). |
| `INTERNAL_ERROR` | 500 | Erreur non typée (log serveur). |

---

## 2. Pagination cursor-based

Les endpoints de liste utilisent un curseur opaque encodé en base64url
(voir `apps/api/utils/cursor.js`).

### Query params

| Nom | Type | Description |
|-----|------|-------------|
| `cursor` | string base64url | Curseur retourné par `meta.pagination.next_cursor` de la page précédente. Absent pour la première page. |
| `limit` | int | Cap serveur (borné à un maximum par domaine, typiquement 200). |

### Bloc `meta.pagination`

```json
{
  "cursor": null,
  "next_cursor": "eyJkIjoiMjAyNi0wNy0xMCIsImkiOjQyfQ",
  "limit": 50,
  "has_more": true
}
```

Le format interne du curseur `{ "d": "YYYY-MM-DD", "i": <id> }` est
**opaque** : ne jamais le décoder côté client, il évoluera sans
préavis.

---

## 3. Feature flag serveur

Chaque namespace v2 est gate par une variable d'environnement
canoniquement nommée `FEATURE_V2_<DOMAINE>`. Off par défaut. Une
requête vers un namespace off répond `404` avec
`code=FEATURE_DISABLED`.

Le middleware `apps/api/middleware/featureFlag.js#createFeatureFlagGuard`
accepte `1`, `true`, `on`, `yes` (case-insensitive) comme valeur
"active", tout le reste est considéré inactif.

---

## 4. Discovery

### 4.1 Discovery par namespace (`/protocol`)

Chaque namespace expose `GET /api/v2/<domaine>/protocol` (public) qui
retourne :

```json
{
  "protocol_version": "2.0.0",
  "capabilities": [...],
  "legacy_endpoints": [...],
  "docs": "/docs/api/v2/<domaine>.md"
}
```

Cet endpoint est lui-même gate par le flag `FEATURE_V2_<DOMAINE>`.

### 4.2 Discovery globale (`/api/v2/meta`) — T-P1-01

Discovery agrégée **toujours servie** (pas de flag). Agrège
`protocol_version` + `capabilities` + état `enabled` de chaque
namespace v2. Utile pour :

- Détecter la liste des namespaces v2 sans multiplier les requêtes
  `/protocol`.
- Piloter la bascule client `flags.v2<Domaine>` selon l'état réel
  du flag serveur.

Réponse type :

```json
{
  "success": true,
  "data": {
    "meta_protocol_version": "1.0.0",
    "response_protocol_version": 1,
    "generated_at": "2026-07-10T09:00:00.000Z",
    "total_namespaces": 4,
    "enabled_count": 1,
    "namespaces": [
      {
        "name": "affaires",
        "base_path": "/api/v2/affaires",
        "protocol_version": "2.0.0",
        "capabilities": [
          "protocol-discovery",
          "affaires-list-cursor-v1",
          "affaire-detail-v1",
          "affaire-history-v1",
          "affaire-patch-audited-v1"
        ],
        "flag": "FEATURE_V2_AFFAIRES",
        "enabled": false,
        "docs": "/docs/api/v2/affaires.md"
      },
      { "name": "display", "flag": "FEATURE_V2_DISPLAY", "enabled": false, ... },
      { "name": "locations", "flag": "FEATURE_V2_LOCATIONS", "enabled": false, ... },
      { "name": "planning", "flag": "FEATURE_V2_PLANNING", "enabled": true, ... }
    ]
  },
  "meta": { "protocol_version": 1 }
}
```

Les namespaces sont ordonnés alphabétiquement (`affaires`, `display`,
`locations`, `planning`).

`meta_protocol_version` (SemVer) versionne le format de `/api/v2/meta`
lui-même. À incrémenter à chaque évolution incompatible.

---

## 5. Reference

- `apps/api/utils/apiV2Response.js` : `sendV2Success`, `sendV2Error`,
  `buildV2Pagination`, `API_V2_PROTOCOL_VERSION`.
- `apps/api/utils/cursor.js` : `encodeCursor`, `decodeCursor`.
- `apps/api/middleware/featureFlag.js` : `createFeatureFlagGuard`.
- `apps/api/v2/metaRoutes.js` : `setupV2MetaRoutes`,
  `V2_NAMESPACES`, `buildMetaPayload`, `isFlagEnabled`,
  `META_PROTOCOL_VERSION`.
- `docs/api/v2/README.md` : index des namespaces.

---

## 6. Non couvert par T-P1-01

- **Export OpenAPI depuis les schémas Zod** : chantier séparé
  (ticket ultérieur T-P1-01b). Le schéma OpenAPI généré devra
  refléter les 4 namespaces + le meta.
- **WebSocket core** : ticket T-P1-02 dédié.
