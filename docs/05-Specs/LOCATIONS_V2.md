# SPEC — Localisation v2 (dépôts, zones, rangement équipements)

> **Version** : 0.1.0 (T-P0-10 : scaffold minimal)
> **Statut** : `Coexistence — non-destructif`
> **Ticket source** : [`EXECUTION_PLAN_EMAG_3_0.md`](../../EXECUTION_PLAN_EMAG_3_0.md) — T-P0-10 → T-P0-13.

---

## 1. État actuel (avant T-P0-10)

Les définitions de rangement sont éclatées :

- **JSON statiques** : `public/depot-zones.json` (dépôt 1, 902 lignes, 49
  zones, 2 étages) et `public/depot2-zones.json` (dépôt 2, 366 lignes).
  Servis en lecture par `apps/api/equipmentRoutes.js` via
  `loadZonesCached()` et l'endpoint `GET /api/equipment-depot-zones`.
  Aussi consommés par le frontend (`apps/web/src/components/inventory/`)
  pour rendre l'interface de rangement.
- **Colonnes `equipment.location_*`** (TEXT libre) : `location_depot`,
  `location_floor`, `location_zone`, `location_code`. Aucun contrôle
  référentiel — un typo dans `location_zone` casse le lien silencieusement.
- **`equipment_catalog.location_*`** : mêmes colonnes pour le catalogue
  centralisé (article référence, pas instance individuelle).
- **Table `locations`** (existante) : dédiée aux **lieux d'événements**
  (salles de spectacle, adresses avec `lat`/`lng`/`place_id`). **Aucun
  rapport avec le rangement dépôt** — juste un conflit de nom malheureux.

Sources de vérité multiples → dérive facile, backup / restore compliqué,
impossible d'historiser un déplacement d'équipement.

---

## 2. Modèle cible (roadmap T-P0-10 → T-P0-13)

### 2.1 Tables

| Table | Rôle | Ticket |
|-------|------|--------|
| **`depot_svg_maps`** | Source de vérité DB des définitions de dépôts (structure floors / categories / zones + SVG width/height + version). Import initial depuis les JSON existants. | **T-P0-10** (ce commit) |
| **`equipment_location_history`** | Historique complet des déplacements. Une ligne par changement de `equipment.location_*`. | **T-P0-10** (ce commit) |
| `equipment.location_*` (existant) | Localisation courante. Reste tel quel. | — |
| `depot_svg_maps` accessible via API | `GET /api/v2/locations/depots` retourne la version DB des zones (fallback JSON si absent). | T-P0-12 |

### 2.2 Colonnes `depot_svg_maps`

```sql
CREATE TABLE depot_svg_maps (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  depot_id      TEXT UNIQUE NOT NULL,     -- "1", "2", ... aligné avec public/depot*-zones.json
  name          TEXT NOT NULL,            -- "Entreprise — Dépôt 1"
  version       TEXT DEFAULT '1.0',       -- version du schéma zones (JSON.version)
  svg_width     INTEGER,
  svg_height    INTEGER,
  floors_json   TEXT NOT NULL DEFAULT '[]',
  categories_json TEXT NOT NULL DEFAULT '[]',
  zones_json    TEXT NOT NULL DEFAULT '[]',
  source_file   TEXT,                     -- nom du JSON importé initialement
  imported_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Choix design :

- **JSON dénormalisé** dans `floors_json/categories_json/zones_json` :
  la structure imbriquée (zones → sous-zones → codes) est mieux servie
  par un blob que par un pivot relationnel. Requêtes typées : lecture
  entière du dépôt + parsing JS côté application.
- **`depot_id` en TEXT** : cohérence avec `equipment.location_depot`
  (TEXT libre existant). Migration future potentielle en INTEGER.
- **Idempotence** : `UNIQUE(depot_id)` + import via `INSERT OR IGNORE`
  au boot. Ré-exécuter la migration après modification du JSON ne
  ré-écrase pas la DB : ce sera un endpoint admin dédié (T-P0-12).

### 2.3 Colonnes `equipment_location_history`

```sql
CREATE TABLE equipment_location_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id  INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  previous_depot TEXT, previous_floor TEXT, previous_zone TEXT, previous_code TEXT,
  new_depot     TEXT, new_floor TEXT, new_zone TEXT, new_code TEXT,
  moved_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  moved_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes         TEXT
);
```

Alimentation :

- **T-P0-10 (ce commit)** : table créée vide.
- **T-P0-12** : le endpoint `PATCH /api/v2/equipment/:id/location`
  insère une ligne à chaque déplacement.
- **Backfill optionnel** (T-P0-11) : reconstitution partielle depuis
  `equipment.modified_at` si utile.

---

## 3. Ce que T-P0-10 fait (ce commit)

- Migration `apps/api/migrations/locations-v2-schema-v1.js` idempotente :
  - Crée `depot_svg_maps` + index.
  - Crée `equipment_location_history` + 2 index (equipment_id, moved_at).
  - Importe `public/depot-zones.json` → `depot_id='1'` si table vide.
  - Importe `public/depot2-zones.json` → `depot_id='2'` si table vide.
  - Skip gracieux si un JSON est absent (dev fraîche possible).
- Enregistrement de la migration dans le boot (`apps/api/migrations.js`).
- Aucune modification de `equipmentRoutes.js`, `catalogRoutes.js` ni
  du frontend. Les endpoints existants continuent de servir les JSON.

Zéro risque de régression : ce sont exclusivement des créations idempotentes.

---

## 4. Ce que T-P0-10 NE fait PAS (tickets suivants)

- **T-P0-11 (Backfill équipements)** : reconstitution facultative de
  `equipment_location_history` depuis les données existantes.
- **T-P0-12 (API + UI EquipmentPanel v2)** :
  - `GET /api/v2/locations/depots` (lit DB, fallback JSON).
  - `PATCH /api/v2/equipment/:id/location` (INSERT dans history).
  - Refonte UI pour lire depuis l'API au lieu du JSON.
- **T-P0-13 (Sunset legacy)** : suppression des colonnes libres
  `equipment.location_*` remplacées par une FK vers un pivot dédié
  — **conditionné à `P0-DECISION-2`**.

---

## 5. Compatibilité et rollback

- **Aucun impact fonctionnel** immédiat : les endpoints inventaire et
  l'UI de rangement continuent de fonctionner exactement à l'identique.
- **Rollback** : `DROP TABLE IF EXISTS depot_svg_maps;` et
  `DROP TABLE IF EXISTS equipment_location_history;` restaurent l'état
  antérieur (les JSON statiques sont intacts).
- **Backup** : les 2 nouvelles tables sont incluses automatiquement
  dans `apps/api/backup-database.sh` (dump SQLite complet).

Ref : [`EXECUTION_PLAN_EMAG_3_0.md`](../../EXECUTION_PLAN_EMAG_3_0.md) —
T-P0-10 · Localisation v2 — Modèle unique `locations`.
