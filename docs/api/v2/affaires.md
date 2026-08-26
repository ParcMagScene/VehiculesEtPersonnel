# API v2 — Affaires

**Ticket** : T-P0-09 (Affaires v2 — API v2 lecture + PATCH audité).
**Feature flag serveur** : `FEATURE_V2_AFFAIRES` (off par défaut).
**Coexistence** : namespace `/api/affaires/*` v1 reste actif.

---

## Discovery

### `GET /api/v2/affaires/protocol`

Public (pas d'authentification). Retourne :

```json
{
  "success": true,
  "data": {
    "protocol_version": "2.0.0",
    "capabilities": [
      "protocol-discovery",
      "affaires-list-cursor-v1",
      "affaire-detail-v1",
      "affaire-history-v1",
      "affaire-patch-audited-v1"
    ],
    "legacy_endpoints": [
      "/api/affaires",
      "/api/affaires/:id",
      "/api/affaires/:id/history",
      "/api/affaires/:id/status"
    ],
    "patch_fields": [
      "nom", "type", "client", "interlocuteur", "tel", "fax",
      "date_debut", "date_fin", "devis", "adresse_livraison",
      "titre", "description", "google_event_id", "event_name"
    ],
    "docs": "/docs/api/v2/affaires.md"
  },
  "meta": { "protocol_version": 1 }
}
```

Si `FEATURE_V2_AFFAIRES` est off : `404` avec `code=FEATURE_DISABLED`.

---

## Liste — `GET /api/v2/affaires`

Authentifié. Pagination cursor-based sur `created_at DESC, id DESC`.

### Query params

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `cursor` | string (base64url opaque) | `null` | Cursor retourné par la page précédente. |
| `limit` | int | `50` | 1–200. Cap serveur. |
| `type` | string | — | Filtre exact sur `affaires.type` (`Prestation`, `Location`, …). |
| `client` | string | — | Filtre `LIKE %value%` sur `affaires.client`. |

### Réponse 200

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 42,
        "numero_affaire": "AF-2026-042",
        "nom": "Prestation Scarabé",
        "type": "Prestation",
        "client": "C'Kel Prod",
        "date_debut": "2026-01-21",
        "date_fin": "2026-01-23",
        "titre": null,
        "description": null,
        "google_event_id": null,
        "event_name": null,
        "created_by": null,
        "created_at": "2026-07-10 05:17:01",
        "modified_by": null,
        "modified_at": "2026-07-10 05:17:01"
      }
    ],
    "next_cursor": "eyJkIjoiMjAyNi0wNy0xMCIsImkiOjQyfQ",
    "has_more": true,
    "total_returned": 1
  },
  "meta": {
    "protocol_version": 1,
    "pagination": {
      "next_cursor": "eyJkIjoiMjAyNi0wNy0xMCIsImkiOjQyfQ",
      "has_more": true,
      "total_returned": 1
    }
  }
}
```

Le cursor est **opaque** (base64url). Ne pas le décoder côté client.

---

## Détail — `GET /api/v2/affaires/:numero_affaire`

Authentifié. Retourne l'affaire par sa clé métier (unique).

### Réponse 200

```json
{
  "success": true,
  "data": {
    "affaire": {
      "id": 42,
      "numero_affaire": "AF-2026-042",
      "nom": "Prestation Scarabé",
      "type": "Prestation",
      "client": "C'Kel Prod",
      ...
    }
  }
}
```

### Erreurs

- `404 NOT_FOUND` : `numero_affaire` inconnu.
- `400 VALIDATION_ERROR` : paramètre invalide.

---

## Historique — `GET /api/v2/affaires/:numero_affaire/history`

Authentifié. Retourne les entrées de `affaire_history` en ordre
chronologique décroissant.

### Query params

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `limit` | int | `100` | 1–500. Cap serveur. |

### Réponse 200

```json
{
  "success": true,
  "data": {
    "numero_affaire": "AF-2026-042",
    "affaire_id": 42,
    "entries": [
      {
        "id": 17,
        "affaire_id": 42,
        "field_name": "client",
        "old_value": "Ancien Client",
        "new_value": "Nouveau Client",
        "changed_by": 3,
        "changed_at": "2026-07-10 08:15:00",
        "notes": "Correction saisie"
      }
    ],
    "total": 1
  }
}
```

### Erreurs

- `404 NOT_FOUND` : `numero_affaire` inconnu (l'affaire elle-même).
- `400 VALIDATION_ERROR`.

---

## PATCH — `PATCH /api/v2/affaires/:numero_affaire`

Authentifié. Applique un patch partiel. **Chaque champ effectivement
modifié génère une entrée `affaire_history`** (audit trail
systématique, T-P0-08).

### Body

Sous-ensemble des champs listés dans `data.patch_fields` (discovery).
Les champs non patchables (`id`, `numero_affaire`, `created_*`,
`modified_*`) sont **ignorés silencieusement**.

Un champ `notes` optionnel est propagé à chaque entrée history.

```json
{
  "client": "Client A - update",
  "titre": "Nouveau titre",
  "notes": "Correction retour utilisateur"
}
```

### Normalisation

- `null` / `undefined` → `null`.
- Chaîne trimée → `null` si vide, sinon la valeur trimée.
- Autres types conservés tels quels.

### Réponse 200 — modification effective

```json
{
  "success": true,
  "data": {
    "affaire": { "id": 42, "numero_affaire": "AF-2026-042", ... },
    "changed_fields": ["client", "titre"],
    "history_ids": [17, 18],
    "changed": true
  }
}
```

### Réponse 200 — no-op

Un patch identique aux valeurs actuelles ne génère **aucune** ligne
d'audit :

```json
{
  "success": true,
  "data": {
    "affaire": { ... },
    "changed_fields": [],
    "history_ids": [],
    "changed": false
  }
}
```

### Erreurs

- `400 VALIDATION_ERROR` :
  - `patch vide (aucun champ patchable fourni)`.
  - `numeroAffaire requis`.
- `404 NOT_FOUND` : `numero_affaire` inconnu.
- `409 CONFLICT` : violation contrainte UNIQUE (peu probable
  vu l'exclusion de `numero_affaire` du patch).

---

## Rappels

- **Aucune matérialisation dynamique** en v2 : les 12 affaires
  "implicites" détectées par T-P0-07 ont été matérialisées en dur
  dans la table `affaires` par la migration T-P0-08. La lecture v2
  ne fait donc jamais de fallback vers les colonnes TEXT `affaire`
  des tables filles.
- **Coexistence stricte** : le namespace `/api/affaires/*` v1 reste
  actif et enrichit dynamiquement les réponses (comportement legacy
  inchangé). Le sunset TEXT est prévu en ticket ultérieur, après
  validation zéro-consommateur v1 sur ≥ 7 jours.
- **Audit** : la table `affaire_history` est **exclusivement**
  alimentée par le PATCH v2 dans ce ticket. Aucun trigger DB.

---

## Dogfooding UI (T-P0-09b — 2026-07-10)

Le loader front `apps/web/src/utils/affairesLoader.js` bascule
sur le namespace v2 lorsque le flag Vite `VITE_FEATURE_V2_AFFAIRES`
est activé (`=1` / `true` / `on` / `yes`, case-insensitive).

Chemin technique côté client :

- `apps/web/src/utils/affaires/v2Adapters.js` : mapping shape v2
  snake_case → v1 camelCase (`adaptAffaireV2ToV1`,
  `adaptAffairesListV2ToV1`, `adaptHistoryEntryV2ToV1`,
  `adaptHistoryListV2ToV1`) et lecture du flag
  (`readAffairesV2ClientFlag`).
- `apps/web/src/utils/affaires/fetchAffairesV2.js` : itère les
  pages `cursor` du `v2ListAffaires` jusqu'à `has_more=false`
  (garde-fou `MAX_PAGES=100`, `limit=200` par défaut).
- `apps/web/src/utils/affairesLoader.js` : appel v2 en amont, en
  cas de `FEATURE_DISABLED` (404) ou d'erreur réseau, fallback
  silencieux sur `api.getAffaires()` v1. Le shape retourné à
  `AffairesPanel`, `useAffairesList`, `MobileAffaires`,
  `ReportsPanel` et `DashboardTasksSidebar` reste **identique**
  (camelCase).

Différence de comportement à connaître :

- La v2 ne renvoie que les affaires **matérialisées** en base
  (post T-P0-08). Les affaires auto-détectées à la volée
  (`source='auto'`, `id=null`) que le v1 ajoutait dynamiquement
  à partir des réservations Google Calendar **n'apparaissent pas**
  dans le chemin v2. C'est un objectif du dogfooding : après
  matérialisation complète, il ne doit rester aucune
  auto-détectée à combler.

Tests de non-régression :

- `apps/web/src/utils/affaires/v2Adapters.test.js` (13 cas).
- `apps/web/src/utils/affaires/fetchAffairesV2.test.js` (6 cas).
- `apps/web/src/utils/affairesLoader.test.js` (6 cas — v1 seul,
  v2 seul, fallback FEATURE_DISABLED sans warn, fallback erreur
  avec warn, fallback si méthode client absente).
