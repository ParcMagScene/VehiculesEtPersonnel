# Architecture — Module Catalogue & Chargement 3D

## Vue d'ensemble

Le module **Catalogue** étend l'application eM@g avec :

- Un **catalogue d'équipements** référençant tout le matériel (backline, audiovisuel, câbles, armoires…)
- Des **flight-cases** (modèles de conteneurs réutilisables)
- Des **modèles de camions** (semi, porteur, utilitaire) pour le chargement 3D
- L'**association équipement ↔ réservation** pour la planification logistique
- Un **deep linking** bidirectionnel avec l'application Chargement 3D

## Structure des fichiers

```
server/
  catalogRoutes.js          ← Routes API (CRUD catalogue, FC, camions, résa-équip.)
  migrations/
    add_catalog_tables.sql  ← DDL de référence
src/
  components/
    CataloguePanel.jsx      ← Panneau principal du catalogue
    CataloguePanel.css      ← Styles partagés
    FlightcasePanel.jsx     ← Gestion des modèles de flight-cases
    TruckModelPanel.jsx     ← Gestion des modèles de camions
    ReservationEquipment.jsx← Section matériel dans le modal réservation
  utils/
    deepLinking.js          ← URL builders, ouverture protocole 3D
scripts/
  sync_inventory_to_catalog.js  ← Import CSV/XLSX → catalogue
```

## Modèle de données

### Tables SQLite

| Table | Description | Clé primaire |
|---|---|---|
| `equipment_catalog` | Catalogue d'équipements (matériel, câbles, etc.) | UUID (TEXT) |
| `flightcases` | Modèles de flight-cases | UUID (TEXT) |
| `truck_models` | Modèles de véhicules de transport | UUID (TEXT) |
| `equipment_to_vehicle` | Association réservation ↔ équipement | UUID (TEXT) |

### Relations

```
equipment_catalog
  └─ default_flightcase_id → flightcases.id (optionnel)

equipment_to_vehicle
  ├─ equipment_id → equipment_catalog.id
  ├─ flightcase_id → flightcases.id (optionnel)
  └─ reservation_id → reservations.id
```

## Navigations & Onglets

Deux nouveaux onglets sont ajoutés dans le `Header.jsx` :

| Onglet | Icône | Module (activeModule) | Panneau |
|---|---|---|---|
| Catalogue | BookOpen | `catalog` | `CataloguePanel` |
| Camions | Container | `trucks` | `TruckModelPanel` |

Le `FlightcasePanel` est accessible depuis le `CataloguePanel` (sous-section).

## Permissions

Le système de permissions JSON existant (`users.permissions`) est étendu avec :

| Permission | Accès |
|---|---|
| `can_manage_catalog` | CRUD catalogue + flight-cases |
| `can_manage_trucks` | CRUD modèles de camions |

Les admins (`is_admin = 1`) ont tous les droits.

Les **middleware** correspondants sont :
- `requireCatalogAccess` — pour les routes `/api/catalog/*` et `/api/flightcases/*`
- `requireTruckAccess` — pour les routes `/api/trucks/*`

Les routes en lecture (GET) ne nécessitent que `authenticateToken`.

## Deep Linking

L'intégration avec Chargement 3D utilise un protocole custom `chargement3d://` :

```
chargement3d://load?reservation=<id>&source=emag
chargement3d://preview?equipment=<ref>&dimensions=LxWxH
chargement3d://truck?model=<id>&source=emag
```

Voir [DEEP_LINKS.md](DEEP_LINKS.md) pour la documentation complète.

## Flux de données typique

1. Admin crée des équipements dans le Catalogue
2. Admin crée des modèles de camions dans l'onglet Camions
3. Lors d'une réservation, l'utilisateur assigne du matériel (section « Matériel »)
4. Le bouton « Ouvrir dans Chargement 3D » génère l'URL et ouvre l'application
5. Chargement 3D récupère les données via l'API REST `/api/reservations/:id/chargement-export`
