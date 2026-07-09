# Changelog Base de Données — eM@g

Toutes les modifications de schéma SQLite sont listées ici.  
Format : [Keep a Changelog](https://keepachangelog.com)

---

## [1.4.0] — 2026-07-09

### Added — Localisation v2 (T-P0-10, additive & idempotente)

- **Table `depot_svg_maps`** (`id` INTEGER PK, `depot_id` TEXT UNIQUE,
  `name`, `version`, `svg_width`, `svg_height`, `floors_json`,
  `categories_json`, `zones_json`, `source_file`, `imported_at`,
  `updated_at`). Source de vérité DB des définitions de dépôts
  actuellement dans `public/depot-zones.json` / `depot2-zones.json`.
  Index `idx_depot_svg_maps_depot` sur `depot_id`.
- **Table `equipment_location_history`** (`id` INTEGER PK,
  `equipment_id` FK CASCADE, `previous_*` / `new_*` (depot/floor/zone/
  code), `moved_by` FK, `moved_at`, `notes`). Audit trail des
  déplacements équipements. 2 index (`equipment_id`, `moved_at`).
- **Import initial idempotent** : si la table `depot_svg_maps` est
  vide et que les fichiers JSON existent, la migration importe
  `public/depot-zones.json` → `depot_id='1'` et `depot2-zones.json`
  → `depot_id='2'`. Skip gracieux si absent (dev fraîche).

Coexistence totale : les endpoints inventaire existants continuent
de servir les JSON statiques. La bascule des lectures est reportée à
T-P0-12. Aucune modification des colonnes `equipment.location_*`
existantes.

Fichier : `apps/api/migrations/locations-v2-schema-v1.js`.
Voir aussi : [../05-Specs/LOCATIONS_V2.md](../05-Specs/LOCATIONS_V2.md).

---

## [1.2.0] — 2026-07-08

### Added — Planning v2 (T-P0-02, additive & idempotente)

- **Table `task_sections_ref`** (`code` TEXT PK, `label` TEXT NOT NULL, `sort_order` INTEGER NOT NULL DEFAULT 0)
  seedée avec les 20 sections métier canoniques Planning v2 alignées sur le CHECK v1 et les données réelles :
  `rdv`, `prep_locations`, `prep_prestations`, `prep_ventes`, `prep_installations`, `prep_tournees`,
  `chargement`, `depart`, `enlevement`, `retour`, `recuperation`, `installation`, `montage`, `demontage`,
  `intervention`, `evenements`, `taches_prioritaires`, `taches_secondaires`, `courses`, `manual`.
- **Index composites cursor-based** sur `task_assignments` :
  - `idx_ta_v2_date_id` (`date`, `id`)
  - `idx_ta_v2_person_date_id` (`person_id`, `date`, `id`)
  - `idx_ta_v2_section_date_id` (`section`, `date`, `id`)

Aucune colonne existante n'est renommée, modifiée ou supprimée.
La v1 (`planningRoutes.js`) reste 100 % fonctionnelle.

Source : `apps/api/migrations/planning-v2-schema-v1.js` (appelée par `runPostInitMigrations` avant `ANALYZE`).
Rapport de contrôle : `scripts/planning-v2-backfill.mjs` (dry-run par défaut, exit 1 si sections orphelines).
Tests DB : `tests/db/planning-v2-schema.test.js`.

Voir aussi : [../05-Specs/PLANNING_V2.md](../05-Specs/PLANNING_V2.md), [../api/v2/planning.md](../api/v2/planning.md),
[EXECUTION_PLAN_EMAG_3_0.md](../../EXECUTION_PLAN_EMAG_3_0.md) T-P0-02.

---

## [1.1.0] — 2026-04-08

### Added
- Colonne `channel` (INTEGER DEFAULT 1) sur table `cameras` — support multi-channel par caméra

---

## [1.0.0] — 2026-04-07

### Initial
- Documentation initiale de 87 tables réparties sur 21 domaines fonctionnels
- WAL mode, FK ON, idempotent migrations documented
- Domaines : Auth, Véhicules, Personnel, Congés, Affaires, Messagerie, Matériel, Stock, Commandes, Planning, Annuaire, Vidéo, Display, Inventaire, Mailing, BL, Devis, Alertes, Récurrence, Maintenance, Catalogue
