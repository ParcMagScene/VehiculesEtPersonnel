# Migrations — eM@g Backend

## Rôle de ce dossier

Ce dossier contient les **archives de référence** des évolutions du schéma SQLite.

> ⚠️ Ces fichiers **ne sont pas appliqués automatiquement** au démarrage.  
> Toutes les migrations sont intégrées directement dans `apps/api/database.js` sous forme de blocs `db.exec()` ou `db.prepare()` protégés par des vérifications d'existence de colonne/table.

## Format des fichiers

| Extension | Type | Usage |
|-----------|------|-------|
| `.sql` | DDL — `ALTER TABLE`, `CREATE TABLE` | Schéma, colonnes, index |
| `.js` | Seeding initial — données de référence | Taxonomies, inventaire, vidéo |

## Fichiers présents

### DDL — Schéma

| Fichier | Description |
|---------|-------------|
| `add_affaire_to_missions.sql` | Colonne `affaire` sur la table `missions` |
| `add_catalog_tables.sql` | Tables `supplier_articles`, `catalog_imports` |
| `add_day_states_to_missions.sql` | Colonnes `day_state_*` sur `missions` |
| `add_equipment_uid.sql` | Colonne `uid` (UUID) sur `equipments` |
| `add_leave_management.sql` | Tables module Congés (v1) |
| `add_leave_requests_module.sql` | Tables module Congés (v2 — soldes, historique) |
| `add_messaging.sql` | Tables messagerie interne |
| `add_personnel_module.sql` | Tables `persons`, `skills`, `availabilities`, `missions`, `assignments` |
| `add_planning_module.sql` | Tables `task_assignments`, `display_events` |
| `add_technical_control_type_to_maintenances.sql` | Type `controle_technique` dans `maintenances` |
| `add_trip_details.sql` | Colonnes détails tournée sur `reservations` |
| `add_trip_group_id.sql` | Colonne `trip_group_id` pour regroupement tournées |
| `add_vehicle_maintenance_info.sql` | Colonnes infos maintenance sur `vehicles` |
| `fix_trip_details_reservation_id_type.sql` | Correction type `reservation_id` dans `trip_details` |
| `recreate_task_assignments.sql` | Recréation complète de `task_assignments` (CHECK constraints) |
| `update_category_icons.sql` | Mise à jour icônes catégories équipements |
| `update_sav_tickets_import.sql` | Extension schéma import tickets SAV |

### Seeding — Données initiales JS

| Fichier | Description |
|---------|-------------|
| `inventory-v1.js` | Données initiales module Inventaire |
| `taxonomy-v1.js` | Taxonomie familles/sous-familles articles |
| `taxonomy-brands-v1.js` | Marques initiales (taxonomie) |
| `taxonomy-maintenance-v1.js` | Types de maintenance (taxonomie) |
| `video-v1.js` | Données initiales module Vidéo |

## Comment ajouter une migration

1. Écrire le DDL SQL dans `database.js` dans la section `// ── Migrations ──`
2. Protéger par un test d'existence :
   ```js
   const hasCol = db.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('ma_table') WHERE name='ma_colonne'").get();
   if (!hasCol.n) {
     db.exec("ALTER TABLE ma_table ADD COLUMN ma_colonne TEXT DEFAULT ''");
     logger.info('Migration: ajout colonne ma_colonne');
   }
   ```
3. Archiver le SQL brut ici pour référence historique.

## Restauration

Voir `docs/04-Operations/backup-strategy.md` pour le runbook de restauration.
