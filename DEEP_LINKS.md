# Deep Linking — eM@g ↔ Chargement 3D

## Principe

Le deep linking permet l'ouverture croisée entre eM@g (application web) et Chargement 3D (application desktop ou web) via des URL construites dynamiquement.

## Module utilitaire

Fichier : `src/utils/deepLinking.js`

### Fonctions exportées

#### Construire des URL Chargement 3D

```js
import {
  buildChargementUrlForReservation,
  buildChargementUrlForEquipment,
  buildChargementUrlForTruck,
  openInChargement
} from '../utils/deepLinking';

// URL pour charger une réservation complète
buildChargementUrlForReservation(reservationId)
// → "chargement3d://load?reservation=<id>&source=emag"

// URL pour prévisualiser un équipement
buildChargementUrlForEquipment(reference, dimensions)
// → "chargement3d://preview?equipment=<ref>&dimensions=100x50x30"

// URL pour charger un modèle de camion
buildChargementUrlForTruck(modelId)
// → "chargement3d://truck?model=<id>&source=emag"

// Ouvrir dans Chargement 3D (avec détection fallback)
await openInChargement(url);
```

#### Construire des URL eM@g (pour Chargement 3D → eM@g)

```js
import { buildEmagReservationUrl, buildEmagCatalogUrl } from '../utils/deepLinking';

buildEmagReservationUrl(reservationId)
// → "https://emag.example.com/reservation/<id>"

buildEmagCatalogUrl(reference)
// → "https://emag.example.com/catalog/<ref>"
```

#### Parser les liens entrants

```js
import { parseIncomingDeepLink } from '../utils/deepLinking';

const result = parseIncomingDeepLink();
// { type: 'reservation', id: '123' }
// { type: 'catalog', reference: 'MIC-SM58' }
// null si pas de deep link
```

#### Utilitaires

```js
import { formatDimensions, calculateVolume } from '../utils/deepLinking';

formatDimensions({ length: 100, width: 50, height: 30 })
// → "100 × 50 × 30 mm"

calculateVolume({ length: 1000, width: 500, height: 300 })
// → 0.15  (m³)
```

## Protocole `chargement3d://`

### Format des URL

| Action | URL | Description |
|---|---|---|
| Charger réservation | `chargement3d://load?reservation=<id>&source=emag` | Ouvre le plan de chargement d'une réservation |
| Prévisualiser équipement | `chargement3d://preview?equipment=<ref>&dimensions=LxWxH` | Affiche un équipement en 3D |
| Charger modèle camion | `chargement3d://truck?model=<id>&source=emag` | Charge un modèle de véhicule |

### Mécanisme d'ouverture

La fonction `openInChargement(url)` tente d'ouvrir le protocole custom :

1. Crée un `<iframe>` caché avec l'URL `chargement3d://…`
2. Surveille le `blur` de la fenêtre pendant 2 secondes
3. Si la fenêtre perd le focus → l'app 3D s'est ouverte ✅
4. Si pas de blur → affiche un message d'avertissement (app non installée)
5. Nettoie l'iframe après le timeout

## API d'export pour Chargement 3D

### `GET /api/reservations/:id/chargement-export`

Endpoint exposé par eM@g pour que Chargement 3D puisse récupérer les données d'une réservation.

**Réponse :**

```json
{
  "reservationId": 42,
  "items": [
    {
      "equipmentId": "uuid",
      "reference": "MIC-SM58",
      "name": "Shure SM58",
      "quantity": 6,
      "dimensions": { "length": 162, "width": 51, "height": 51 },
      "weight": 0.33,
      "flightcaseId": "uuid",
      "flightcaseName": "Flight 6x SM58",
      "notes": ""
    }
  ],
  "summary": {
    "count": 1,
    "totalQuantity": 6,
    "totalWeight": 1.98,
    "totalVolume": 0.0025
  }
}
```

## Intégration frontend

### Depuis le Catalogue

Chaque ligne du tableau d'équipements a un bouton « 3D » qui appelle :
```js
openInChargement(buildChargementUrlForEquipment(item.reference, parsedDimensions))
```

### Depuis les Modèles de Camions

Bouton « Charger dans Chargement 3D » :
```js
openInChargement(buildChargementUrlForTruck(model.id))
```

### Depuis une Réservation

La section « Matériel » (`ReservationEquipment`) affiche un bouton « Ouvrir dans Chargement 3D » :
```js
openInChargement(buildChargementUrlForReservation(reservationId))
```

## Configuration

Le préfixe de base de Chargement 3D est configuré dans `deepLinking.js` :

```js
const CHARGEMENT_BASE = 'chargement3d://';
const EMAG_BASE = window.location.origin;
```

Pour un environnement de production avec une URL spécifique, modifier `EMAG_BASE` ou le passer en variable d'environnement via Vite (`import.meta.env.VITE_EMAG_BASE_URL`).
