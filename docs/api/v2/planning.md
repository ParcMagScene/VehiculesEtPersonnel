# 📅 API v2 — Planning

> **Version doc** : 0.1.0 (cadrage T-P0-01)
> **Statut** : squelette services publié — aucun endpoint monté à ce stade
> **Namespace cible** : `/api/v2/planning/*`
> **Feature flag serveur** : `FEATURE_V2_PLANNING`
> **Sources internes** : `apps/api/services/planning/{index,tasks,events,affaires,imports,recurrence,ical}.js`
> **Spec** : [../../05-Specs/PLANNING_V2.md](../../05-Specs/PLANNING_V2.md)

---

## Vue d'ensemble

Le PlanningService v2 décompose l'actuel `planningRoutes.js` (routeur monolithique
~2600 lignes) en 6 sous-domaines fonctionnels autonomes :

| Sous-domaine | Rôle métier | Ticket d'implémentation |
|--------------|-------------|-------------------------|
| `tasks`      | Tâches opérationnelles réparties en 20 sections (alignées sur le CHECK v1) | T-P0-03 / T-P0-04 |
| `events`     | Événements d'affichage dynamique (dynamic_display_events) | T-P0-03 / T-P0-04 |
| `affaires`   | Cycle statut affaires côté planning + compteurs consolidés | T-P0-03 / T-P0-04 |
| `imports`    | BL / BP (import PDF, matching inventaire, batch) | T-P0-04 |
| `recurrence` | Templates de tâches récurrentes + génération | T-P0-04 |
| `ical`       | Abonnements iCal et export flux | T-P0-04 |

Chaque sous-domaine expose des fonctions pures côté service. Aucun accès direct
à `better-sqlite3` n'est effectué dans le squelette — le câblage réel est
réservé aux tickets T-P0-02 (DB v2), T-P0-03 (routes lecture) et T-P0-04
(routes mutations).

---

## Constantes de vérité

Les constantes suivantes deviennent la source de vérité v2. Elles seront
adossées à des tables `_ref` créées par T-P0-02 pour cohérence DB ↔ code.

- `TASK_SECTIONS` (20 valeurs alignées sur le CHECK v1 : `rdv`, `prep_locations`, `prep_prestations`, `prep_ventes`, `prep_installations`, `prep_tournees`, `chargement`, `depart`, `enlevement`, `retour`, `recuperation`, `installation`, `montage`, `demontage`, `intervention`, `evenements`, `taches_prioritaires`, `taches_secondaires`, `courses`, `manual`, voir `services/planning/tasks.js`).
- `TASK_STATUSES` : `pending`, `in_progress`, `done`, `cancelled`.
- `EVENT_TYPES` : `preparation`, `enlevement`, `livraison`, `depart`, `retour`, `recuperation`.
- `EVENT_CATEGORIES` : `vente`, `location`, `prestation`, `installation`.
- `EVENT_STATUSES` : `pending`, `in_progress`, `done`.
- `AFFAIRE_CYCLE_STATUSES` (10 valeurs) : `prep`, `charge`, `depart`, `route`, `montage`, `exploitation`, `demontage`, `retour`, `decharge`, `cloture`.
- `BL_IMPORT_STATUSES` : `pending`, `validated`, `rejected`.
- `BP_ITEM_MATCH_STATUSES` : `unmatched`, `matched`, `manual`, `ignored`.
- `RECURRENCE_FREQUENCIES` : `daily`, `weekly`, `monthly`.
- `ICAL_MIME_TYPE` : `text/calendar; charset=utf-8`.

---

## Endpoints cibles (indicatifs — non montés au stade T-P0-01)

### Tasks

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v2/planning/tasks` | Liste (filtres serveur, pagination cursor-based) |
| GET | `/api/v2/planning/tasks/:id` | Détail |
| POST | `/api/v2/planning/tasks` | Création |
| PUT | `/api/v2/planning/tasks/:id` | Mise à jour |
| DELETE | `/api/v2/planning/tasks/:id` | Suppression |
| POST | `/api/v2/planning/tasks/batch` | Création en lot |
| POST | `/api/v2/planning/tasks/clear-completed` | Archive tâches terminées |
| POST | `/api/v2/planning/tasks/rollover` | Rollover minuit |

### Events

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v2/planning/events` | Liste |
| POST | `/api/v2/planning/events` | Création |
| PUT | `/api/v2/planning/events/:id` | Mise à jour |
| DELETE | `/api/v2/planning/events/:id` | Suppression |

### Affaires (planning)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v2/planning/affaires` | Liste affaires + compteurs consolidés |
| PATCH | `/api/v2/planning/affaires/:num/cycle-status` | Progression du cycle statut |
| PATCH | `/api/v2/planning/affaires/:num/visibility` | Toggle visibilité planning |

### Imports (BL / BP)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v2/planning/bl-imports` | Liste BL |
| POST | `/api/v2/planning/bl-imports` | Upload BL (PDF / image) |
| POST | `/api/v2/planning/bl-imports/batch` | Upload batch (max 50) |
| PUT | `/api/v2/planning/bl-imports/:id` | Mise à jour |
| GET | `/api/v2/planning/bp-items` | Liste items BP |
| PUT | `/api/v2/planning/bp-items/:id/match` | Rattachement inventaire |

### Recurrence

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v2/planning/recurring-tasks` | Liste templates |
| POST | `/api/v2/planning/recurring-tasks` | Création template |
| POST | `/api/v2/planning/recurring-tasks/generate` | Génération d'instances |

### iCal

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v2/planning/ical-calendars` | Liste abonnements |
| POST | `/api/v2/planning/ical-calendars` | Création abonnement |
| GET | `/api/v2/planning/ical-events` | Export flux iCal (`text/calendar`) |

---

## Coexistence v1 / v2

Tant que ce document est en statut `Cadrage`, toutes les routes ci-dessus
restent servies exclusivement par la v1 (`/api/planning/*`) via
`planningRoutes.js`. Aucun basculement n'est effectué sans ticket dédié et
sans validation utilisateur (points de contrôle `P0-DECISION-2` puis
`P1-DECISION-2`).

Voir aussi :

- [../README.md](../README.md) (index API général).
- [../planning.md](../planning.md) (référence v1 courante).
- [../../workflows/state-machines.md](../../workflows/state-machines.md).
- [../../05-Specs/PLANNING_V2.md](../../05-Specs/PLANNING_V2.md).
