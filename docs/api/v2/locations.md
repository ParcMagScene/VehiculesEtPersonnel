# 📙 API v2 — Locations

> Base URL : `/api/v2/locations/*` + `/api/v2/equipment/:id/location`
> Feature flag serveur : `FEATURE_V2_LOCATIONS` (off par défaut, 404 `FEATURE_DISABLED` si off).
> Ticket : [T-P0-12](../../../EXECUTION_PLAN_EMAG_3_0.md).
> Spec complète : [../../05-Specs/LOCATIONS_V2.md](../../05-Specs/LOCATIONS_V2.md).

Namespace pour la nouvelle source de rangement (table `depot_svg_maps`
introduite en T-P0-10) et la mise à jour transactionnelle de la
localisation d'un équipement avec audit trail (`equipment_location_history`).

Coexistence stricte : les endpoints v1 restent actifs
(`/api/equipment-depot-zones`, `/api/equipment-all-depot-zones`,
`/api/catalog/equipment/zones`).

---

## `GET /api/v2/locations/protocol`

**Discovery — aucune authentification requise.**

Retourne la version du protocole Locations v2 et les capacités
annoncées par le serveur.

### Réponse 200

```json
{
  "success": true,
  "data": {
    "protocol_version": "2.0.0",
    "capabilities": [
      "protocol-discovery",
      "depots-list-v1",
      "depot-detail-v1",
      "equipment-location-patch-v1"
    ],
    "legacy_endpoints": [
      "/api/equipment-depot-zones",
      "/api/equipment-all-depot-zones",
      "/api/catalog/equipment/zones"
    ],
    "docs": "/docs/api/v2/locations.md"
  },
  "meta": { "protocol_version": 1 }
}
```

---

## `GET /api/v2/locations/depots`

**Authentification requise.**

Liste compacte des dépôts (métadonnées + counts). Utile pour un
sélecteur ou un menu déroulant.

### Réponse 200

```json
{
  "success": true,
  "data": {
    "depots": [
      {
        "depot_id": "1",
        "name": "Entreprise — Dépôt 1",
        "version": "2.0",
        "svg_width": 900,
        "svg_height": 1000,
        "floors_count": 2,
        "categories_count": 8,
        "zones_count": 49,
        "imported_at": "2026-07-09 10:30:00",
        "updated_at": "2026-07-09 10:30:00"
      }
    ],
    "total": 1
  },
  "meta": { "protocol_version": 1 }
}
```

---

## `GET /api/v2/locations/depots/:depot_id`

**Authentification requise.**

Détail complet d'un dépôt : dimensions SVG + `floors[]` +
`categories[]` + `zones[]`. Les tableaux sont parsés depuis les
colonnes JSON de `depot_svg_maps`.

### Réponse 200

```json
{
  "success": true,
  "data": {
    "depot": {
      "depot_id": "1",
      "name": "Entreprise — Dépôt 1",
      "version": "2.0",
      "svg_width": 900,
      "svg_height": 1000,
      "floors": [ { "id": "RDC", "label": "Rez-de-chaussée", "order": 0 } ],
      "categories": [ { "key": "stockage", "label": "Stockage" } ],
      "zones": [ { "id": "H1", "floor": "RDC", "x": 100, "y": 200 } ],
      "source_file": "depot-zones.json",
      "imported_at": "2026-07-09 10:30:00",
      "updated_at": "2026-07-09 10:30:00"
    }
  },
  "meta": { "protocol_version": 1 }
}
```

La structure exacte de chaque zone reste opaque au serveur (le JSON
d'origine est passé tel quel). Le client peut compter sur `id`, `code`,
`name` pour l'identification (voir `isZoneKnown` côté serveur).

### Réponses d'erreur

- **400 VALIDATION_ERROR** : `depot_id` manquant.
- **404 NOT_FOUND** : dépôt inexistant.

---

## `PATCH /api/v2/equipment/:id/location`

**Authentification requise. Admin requis si `requireAdmin` est monté.**

Met à jour la localisation d'un équipement + insère une ligne dans
`equipment_location_history`. L'opération est **transactionnelle**
(UPDATE + INSERT dans une seule transaction better-sqlite3).

### Corps de requête

```json
{
  "location_depot": "1",
  "location_floor": "RDC",
  "location_zone": "H1",
  "location_code": "A01",
  "notes": "Déplacement quotidien",
  "strict": false
}
```

- Tous les champs de localisation sont optionnels — seuls ceux passés
  sont modifiés (les autres restent inchangés).
- `notes` : chaîne libre stockée dans `equipment_location_history.notes`.
- `strict: true` : refuse si `location_zone` n'existe pas dans le
  référentiel `depot_svg_maps.zones_json` du dépôt cible → 409 CONFLICT.
  Par défaut (`strict: false`), la mise à jour passe même sur zones
  inconnues (utile pour import de données legacy).

### Réponse 200

```json
{
  "success": true,
  "data": {
    "equipment_id": 42,
    "previous": {
      "location_depot": "1",
      "location_floor": null,
      "location_zone": "H1",
      "location_code": "A01"
    },
    "next": {
      "location_depot": "1",
      "location_floor": "RDC",
      "location_zone": "H2",
      "location_code": "A01"
    },
    "history_id": 128,
    "changed": true
  },
  "meta": { "protocol_version": 1 }
}
```

Cas particulier **no-op** : si aucun champ ne change effectivement
(même valeur qu'avant), le service retourne `changed: false` +
`history_id: null` — **aucune ligne n'est insérée** dans l'audit trail
(évite le bruit).

### Réponses d'erreur

- **400 VALIDATION_ERROR** : `id` invalide, `patch` vide, champs
  hors `[location_depot, location_floor, location_zone, location_code]`.
- **404 NOT_FOUND** : équipement inexistant.
- **409 CONFLICT** (mode strict) : `location_zone` inconnue dans
  `depot_svg_maps` du dépôt cible.

---

## Enrichissement `equipment_location_history` (rappel T-P0-10)

Chaque `PATCH` réussi et effectif (`changed=true`) insère une ligne :

| Colonne | Contenu |
|---------|---------|
| `equipment_id` | ID de l'équipement modifié. FK CASCADE. |
| `previous_depot`, `previous_floor`, `previous_zone`, `previous_code` | Snapshot des 4 champs `equipment.location_*` avant modification. |
| `new_depot`, `new_floor`, `new_zone`, `new_code` | Snapshot après. |
| `moved_by` | `req.user.id` (auteur du PATCH). |
| `moved_at` | `datetime('now')` (auto). |
| `notes` | Note libre transmise dans le body du PATCH. |

Voir [../../05-Specs/LOCATIONS_V2.md](../../05-Specs/LOCATIONS_V2.md).
