# Changelog Base de Données — eM@g

Toutes les modifications de schéma SQLite sont listées ici.  
Format : [Keep a Changelog](https://keepachangelog.com)

---

## [1.7.0] — 2026-07-10

### Added — SAV v2 : table `sav_parts` (T-P1-07)

- **Migration `sav-parts-v1`** : nouvelle table `sav_parts`
  (idempotente, additive).
  - Colonnes : `id`, `ticket_id` (FK `sav_tickets(id)` ON DELETE
    CASCADE), `part_name`, `part_reference`, `quantity`,
    `unit_price`, `supplier`, `status` (CHECK IN `requested`,
    `ordered`, `received`, `installed`, `cancelled`),
    `requested_at`, `ordered_at`, `received_at`, `installed_at`,
    `cancelled_at`, `notes`, `created_by`/`at`, `modified_by`/`at`.
  - Index : `idx_sav_parts_ticket`, `idx_sav_parts_status`,
    `idx_sav_parts_supplier`.
- Aucune modification de `sav_tickets` (coexistence stricte).

### Reference

- `apps/api/migrations/sav-parts-v1.js` (nouveau).
- `apps/api/migrations.js` : wire après T-P0-08.
- `docs/api/v2/sav.md` : usage complet.

---

## [1.6.0] — 2026-07-10

### Added — Affaires v2 : matérialisation + FK ref + audit trail (T-P0-08)

**Autorisé par P0-DECISION-2 du 2026-07-10** (cf.
`EXECUTION_PLAN_EMAG_3_0.md §0.5`). Strictement additif, idempotent,
zéro modification des colonnes existantes.

- Migration : `apps/api/migrations/affaires-v2-schema-v1.js`.
  - **Matérialisation** : `INSERT OR IGNORE` dans `affaires` pour
    chaque `numero_affaire` référencé par une table fille mais absent
    de `affaires`. Payload enrichi depuis `reservations`
    (client / date_debut min / date_fin max / prestation). En prod
    au moment de la décision : 12 affaires implicites recensées par
    le dry-run T-P0-07.
  - **Ajout colonnes FK ref** : `affaire_ref_id INTEGER` nullable +
    index `idx_<table>_affaire_ref_id` sur 6 tables :
    - `reservations`
    - `missions`
    - `orders`
    - `bl_imports`
    - `dynamic_display_events`
    - `equipment_assignments`
  - **Backfill** : `UPDATE ... SET affaire_ref_id = (SELECT id FROM
    affaires WHERE numero_affaire = <text_column>) WHERE
    affaire_ref_id IS NULL AND <text_column> IS NOT NULL AND
    <text_column> <> ''`.
  - **Table `affaire_history`** : audit trail des modifications sur
    `affaires` (`field_name`, `old_value`, `new_value`, `changed_by`
    FK users, `changed_at`, `notes`). Index sur `affaire_id` et
    `changed_at`.

Cohabitation stricte : les colonnes TEXT existantes (`reservations.
affaire`, `missions.affaire`, `orders.affaire_id`, `bl_imports.
affaire_id`, `dynamic_display_events.affaire_id`, `equipment_
assignments.affaire_id`) sont conservées intactes. Le sunset TEXT
sera opéré par T-P0-09 (nécessite validation d'absence totale de
consommateur v1).

Aucune API modifiée dans ce ticket : le namespace `/api/v2/affaires`
sera livré en T-P0-09.

### Reference

- `apps/api/migrations/affaires-v2-schema-v1.js` — migration.
- `apps/api/migrations.js` — wiring.
- `tests/db/affaires-v2-schema.test.js` — 7 tests idempotence +
  backfill + INSERT OR IGNORE.
- `docs/05-Specs/AFFAIRES_V2.md` — spec mise à jour §3 (T-P0-08 livré).
- `EXECUTION_PLAN_EMAG_3_0.md §0.5` — registre P0-DECISION-2.

---

## [1.5.0] — 2026-07-09

### Added — Display v2 : enrichissement `display_logs` (T-P0-14)

Migration additive idempotente (via `pragma table_info` sur
`display_logs`, dans `apps/api/database.js` section Module Dashboard) :

- `client_ip` TEXT — IP source de la requête.
- `client_user_agent` TEXT — User-Agent client (versionnage TV-client).
- `protocol_version` TEXT — protocole négocié (ex. `2.0.0` v2, NULL v1).
- `request_id` TEXT — UUID de corrélation cross-service.
- `response_status` INTEGER — code HTTP de la réponse.

Rétro-compat totale : les inserts existants dans `displayRoutes.js` v1
n'écrivent pas dans ces colonnes → valeurs NULL. Le populate se fera
au fur et à mesure des touches naturelles ou lors de T-P0-15.

Voir aussi : [../05-Specs/DISPLAY_V2.md](../05-Specs/DISPLAY_V2.md) §3.

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
