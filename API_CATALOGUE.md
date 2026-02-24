# API Catalogue — Documentation des endpoints

Base URL : `/api`  
Authentification : Header `Authorization: Bearer <jwt>`

---

## Catalogue d'équipements

### `GET /api/catalog/equipment`

Liste les équipements paginés avec filtres optionnels.

| Paramètre | Type | Description |
|---|---|---|
| `search` | query | Recherche texte (nom, référence, famille) |
| `family` | query | Filtre par famille |
| `subfamily` | query | Filtre par sous-famille |
| `category` | query | Filtre par catégorie |
| `limit` | query | Nombre max de résultats (défaut : tout) |
| `offset` | query | Décalage pour pagination |

**Réponse** : `{ items: [...], total: number }`

### `GET /api/catalog/equipment/:id`

Détail d'un équipement. Inclut `defaultFlightcase` si `default_flightcase_id` est défini.

### `GET /api/catalog/equipment/families`

Retourne `string[]` — liste des familles distinctes.

### `GET /api/catalog/equipment/categories`

Retourne `string[]` — liste des catégories distinctes.

### `POST /api/catalog/equipment` 🔒 `can_manage_catalog`

Créer un équipement.

```json
{
  "reference": "MIC-SM58",
  "name": "Shure SM58",
  "family": "Backline",
  "subfamily": "Microphones",
  "category": "Micro dynamique",
  "dimensions": { "length": 162, "width": 51, "height": 51 },
  "weight": 0.33,
  "default_flightcase_id": null,
  "metadata": { "brand": "Shure" }
}
```

### `PUT /api/catalog/equipment/:id` 🔒 `can_manage_catalog`

Mise à jour partielle. Seuls les champs fournis sont modifiés.

### `DELETE /api/catalog/equipment/:id` 🔒 `can_manage_catalog`

Supprime si non utilisé dans des réservations (sinon erreur 409).

---

## Flight-Cases

### `GET /api/flightcases`

| Paramètre | Type | Description |
|---|---|---|
| `search` | query | Recherche nom/référence |
| `category` | query | Filtre par catégorie |

**Réponse** : `FlightCase[]`

### `GET /api/flightcases/:id`

Détail d'un flight-case.

### `POST /api/flightcases` 🔒 `can_manage_catalog`

```json
{
  "reference": "FC-SM58-6",
  "name": "Flight 6x SM58",
  "category": "Microphones",
  "interior_dimensions": { "length": 500, "width": 300, "height": 200 },
  "exterior_dimensions": { "length": 550, "width": 350, "height": 250 },
  "empty_weight": 4.5,
  "max_load": 15,
  "metadata": {}
}
```

### `PUT /api/flightcases/:id` 🔒 `can_manage_catalog`

### `DELETE /api/flightcases/:id` 🔒 `can_manage_catalog`

Supprime si non référencé par un équipement (sinon erreur 409).

---

## Modèles de camions

### `GET /api/trucks/models`

| Paramètre | Type | Description |
|---|---|---|
| `search` | query | Recherche nom/marque |
| `type` | query | `semi`, `porteur` ou `utilitaire` |

### `GET /api/trucks/models/:id`

### `POST /api/trucks/models` 🔒 `can_manage_trucks`

```json
{
  "name": "Renault Master L3H2",
  "type": "utilitaire",
  "brand": "Renault",
  "cargo_dimensions": { "length": 3700, "width": 1765, "height": 1900 },
  "max_payload": 1200,
  "cargo_volume": 13,
  "door_dimensions": { "width": 1580, "height": 1860 },
  "has_tailgate": true,
  "axle_count": 2,
  "metadata": {}
}
```

### `PUT /api/trucks/models/:id` 🔒 `can_manage_trucks`

### `DELETE /api/trucks/models/:id` 🔒 `can_manage_trucks`

---

## Équipements de réservation

### `GET /api/reservations/:id/equipment`

Retourne les équipements assignés avec résumé.

```json
{
  "items": [
    {
      "id": "uuid",
      "equipment_id": "uuid",
      "quantity": 2,
      "name": "Shure SM58",
      "reference": "MIC-SM58",
      "weight": 0.33,
      "dimensions": "{...}"
    }
  ],
  "summary": {
    "count": 1,
    "totalQuantity": 2,
    "totalWeight": 0.66,
    "totalVolume": 0.00084
  }
}
```

### `POST /api/reservations/:id/equipment`

Assigner un équipement à une réservation.

```json
{
  "equipment_id": "uuid",
  "flightcase_id": "uuid (optionnel)",
  "quantity": 2,
  "notes": "Avec bonnettes"
}
```

### `DELETE /api/reservations/:id/equipment/:equipmentId`

Retirer un équipement d'une réservation.

### `GET /api/reservations/:id/chargement-export`

Export structuré pour Chargement 3D. Inclut items avec dimensions parsées + résumé.

---

## Codes d'erreur

| Code | Signification |
|---|---|
| 400 | Paramètre manquant ou invalide |
| 401 | Token JWT manquant |
| 403 | Permission insuffisante |
| 404 | Ressource non trouvée |
| 409 | Conflit (doublon référence, suppression impossible) |
| 500 | Erreur serveur |
