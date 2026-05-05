# 🗄️ Documentation Base de Données — eM@g

> **Version** : 1.0.0  
> **Dernière MÀJ** : 7 avril 2026  
> **Moteur** : SQLite (better-sqlite3 ^9.2.2)  
> **Mode** : WAL (Write-Ahead Logging) + Synchronisation FULL  
> **Fichier** : `apps/api/vehicules.db`

---

## Vue d'ensemble

- **87 tables** réparties en 21 domaines fonctionnels
- **Clés étrangères** : Activées (`PRAGMA foreign_keys = ON`)
- **Migrations** : Idempotentes (`IF NOT EXISTS` + `PRAGMA table_info()`)

→ Schéma détaillé : [SCHEMA.md](SCHEMA.md)

---

## Domaines fonctionnels

| # | Domaine | Tables | Tables principales |
|:-:|---------|:------:|-------------------|
| 1 | Authentification | 5 | `users`, `access_requests`, `active_sessions`, `authorized_emails`, `migrations_log` |
| 2 | Véhicules & Réservations | 6 | `vehicles`, `reservations`, `maintenances`, `trip_details` |
| 3 | Personnel & Planning | 9 | `persons`, `skills`, `missions`, `mission_assignments`, `positions` |
| 4 | Congés | 3 | `leave_requests`, `leave_request_history`, `public_holidays` |
| 5 | Affaires | 2 | `affaires`, `affaire_links` |
| 6 | Messagerie | 4 | `conversations`, `messages`, `message_attachments` |
| 7 | Matériel & SAV | 5 | `equipment`, `sav_tickets`, `equipment_assignments` |
| 8 | Stock & Pièces | 3 | `stock_items`, `stock_movements`, `stock_categories` |
| 9 | Commandes | 5 | `suppliers`, `orders`, `quotes`, `order_items` |
| 10 | Catalogue Matériel | 4 | `equipment_catalog`, `flightcases`, `truck_models` |
| 11 | Communication | 7 | `dynamic_display_events`, `bl_imports`, `task_assignments`, `planning_*` |
| 12 | Dashboard | 7 | `display_screens`, `display_playlists`, `display_media`, `display_templates` |
| 13 | Dashboard TV | 5 | `display_config`, `display_welcome_messages`, `display_color_rules` |
| 14 | Annuaire | 6 | `prestataires`, `annuaire_contacts`, lookup tables |
| 15 | Articles Fournisseurs | 2 | `supplier_articles`, `catalog_imports` |
| 16 | Mailing | 2 | `mail_templates`, `mail_history` |
| 17 | Inventaire Avancé | 4 | `inventory_locations`, `inventory_price_history`, `inventory_anomalies` |
| 18 | Référentiels | 4 | `clients`, `drivers`, `locations`, `garages` |
| 19 | Historique | 2 | `modification_history`, `config` |
| 20 | BP Items | 1 | `bp_items` |
| 21 | Email Config | 1 | `email_config` |

---

## Contraintes d'intégrité

### Foreign Keys — Actions ON DELETE

| Action | Usage |
|--------|-------|
| **CASCADE** | `reservations` ← `vehicles`, `missions` ← `affaires` |
| **SET NULL** | `created_by`, `modified_by` (conservation audit trail) |

### Contraintes UNIQUE

| Table | Colonne(s) |
|-------|------------|
| `users` | `email` |
| `clients` | `code_libre` |
| `affaires` | `numero_affaire` |
| `equipment` | `uid` |
| `stock_items` | `reference` |

### Contraintes CHECK

| Table | Colonne | Valeurs |
|-------|---------|---------|
| `task_assignments` | `section` | rdv, prep_locations, prep_ventes, prep_installations, chargement, depart, enlevement, retour, recuperation, installation, evenements, taches_prioritaires, taches_secondaires, courses |
| `display_screens` | `orientation` | landscape, portrait |

---

## Index de performance

| Table | Colonnes indexées | Usage |
|-------|------------------|-------|
| `vehicles` | `type`, `registration` | Recherche |
| `reservations` | `vehicle_id`, `start_date`, `end_date`, `affaire` | Filtrage temporel |
| `persons` | `type`, `status`, `user_id` | Filtrage |
| `missions` | `start_date`, `end_date`, `status` | Planning |
| `active_sessions` | `expires_at` | Nettoyage |
| `stock_items` | `barcode`, `depot_id`, `abc_class` | Inventaire |
| `leave_requests` | `person_id`, `status`, dates | Congés |

---

## Architecture notable

- **JSON** : `controles_techniques`, `required_skills`, `metadata`, `config`, `day_states` — pour flexibilité schéma
- **Audit trail** : `modification_history` sur toutes les entités critiques
- **Multi-localisation** : `depot` / `zone` / `floor` (3 niveaux de géolocalisation)
- **Soft deletes** : `is_active` booléen (données conservées pour audit)
- **Lookup tables seedées** : 70+ entrées par défaut (skills, positions, categories, structures)

---

## Sources de migration

| Fichier | Contenu |
|---------|---------|
| `database.js` | Schéma principal (toutes les tables core) |
| `inventory-v1.js` | Extensions stock (barcode, lifecycle_status, abc_class) |
| `taxonomy-*.js` | Taxonomie unifiée (familles, catégories) |
