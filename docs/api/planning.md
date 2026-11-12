# 📅 API Planning & Tâches

> **Version** : 1.0.0  
> **Source** : `planningRoutes.js`  
> **Dernière MÀJ** : 7 avril 2026

---

## Événements d'affichage dynamique

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/planning/display-events` | ✅ | Événements: date, type, category, affaire_id (LEFT JOIN affaires) |
| POST | `/api/planning/display-events` | ✅ | Crée événement TV dashboard |
| PUT | `/api/planning/display-events/:id` | ✅ | MAJ événement |
| DELETE | `/api/planning/display-events/:id` | ✅ | Supprime événement |

---

## BL (Bons de Livraison)

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/planning/bl-imports` | ✅ | Liste BL (pending, validated, rejected) |
| POST | `/api/planning/bl-imports` | ✅ | Upload BL (PDF/image) + parsing items |
| PUT | `/api/planning/bl-imports/:id` | ✅ | MAJ statut + items liés |
| DELETE | `/api/planning/bl-imports/:id` | ✅ | Soft-delete BL |
| POST | `/api/planning/bl-imports/batch` | ✅ | Upload batch (max 50 fichiers) |
| GET | `/api/planning/bp-items` | ✅ | Items BL (statut matching inventaire) |
| PUT | `/api/planning/bp-items/:id/match` | ✅ | Lie item BP → article stock |

---

## Tâches

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/planning/tasks` | ✅ | Filtres: status, assigned_to, date_from/to, affaire_num, operation_id |
| POST | `/api/planning/tasks` | ✅ | Crée tâche; `operation_id` optionnel pour la rattacher à une opération |
| PUT | `/api/planning/tasks/:id` | ✅ | MAJ tâche, dont `operation_id` |
| DELETE | `/api/planning/tasks/:id` | ✅ | Supprime tâche |
| POST | `/api/planning/tasks/batch` | ✅ | Création batch |
| POST | `/api/planning/tasks/clear-completed` | ✅ | Archive en masse tâches terminées |
| POST | `/api/planning/tasks/rollover` | ✅ | Reporte tâches incomplètes au lendemain |

---

## Opérations d'affaire

Une opération appartient à une affaire et peut être liée à un BL importé de cette affaire.
Les tâches et réservations peuvent référencer son identifiant `operation_id`.

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/affaires/:id/operations` | ✅ | Liste les opérations et le BL lié |
| POST | `/api/affaires/:id/operations` | ✅ | Crée une opération (`name`, `blImportId` optionnel) |
| PUT | `/api/affaires/:id/operations/:operationId` | ✅ | Modifie son nom et son BL |
| DELETE | `/api/affaires/:id/operations/:operationId` | ✅ | Supprime l'opération et détache ses tâches/réservations |

---

## Tâches récurrentes

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/planning/recurring-tasks` | ✅ | Templates récurrents |
| POST | `/api/planning/recurring-tasks` | ✅ | Crée template (daily/weekly/monthly) |
| POST | `/api/planning/recurring-tasks/generate` | ✅ | Génère instances depuis templates |

---

## Affectations planning

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/planning/planning-assignments` | ✅ | Affectations tâches→personnel |
| POST | `/api/planning/planning-assignments` | ✅ | Affecte tâche à personne |
| DELETE | `/api/planning/planning-assignments/:id` | ✅ | Désaffecte |

---

## Planning affaires

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/planning/stats` | ✅ | Stats (cache 20s): total tâches, % complétées, par statut |
| GET | `/api/planning/planning-affaires` | ✅ | Affaires en date range (cache 15s) + counts événements |
| PATCH | `/api/planning/planning-affaires/:num/cycle-status` | ✅ | Cycle statut affaire (prep→charge→depart→etc.) |

---

## iCal

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/planning/ical-calendars` | ✅ | Abonnements iCal |
| POST | `/api/planning/ical-calendars` | ✅ | Crée abonnement |
| GET | `/api/planning/ical-events` | ✅ | Export tâches/réservations au format iCal (cache 5min) |

---

## Sections tâches

Les tâches sont classées par section (CHECK en DB) :
`rdv`, `prep_locations`, `prep_ventes`, `prep_installations`, `chargement`, `depart`, `enlevement`, `retour`, `recuperation`, `installation`, `evenements`, `taches_prioritaires`, `taches_secondaires`, `courses`
