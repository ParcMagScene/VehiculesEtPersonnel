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
| GET | `/api/v2/planning/tasks` | ✅ **Implémenté (T-P0-03)**. Liste cursor-based, filtres serveur. |
| GET | `/api/v2/planning/tasks/:id` | ✅ **Implémenté (T-P0-04)**. Détail par id (UUID hex). |
| POST | `/api/v2/planning/tasks` | ✅ **Implémenté (T-P0-04)**. Création (id auto-généré côté SQLite). |
| PUT | `/api/v2/planning/tasks/:id` | ✅ **Implémenté (T-P0-04)**. Mise à jour partielle, transitions de statut validées. |
| DELETE | `/api/v2/planning/tasks/:id` | ✅ **Implémenté (T-P0-04)**. Suppression. |
| POST | `/api/v2/planning/tasks/batch` | ✅ **Implémenté (T-P0-04 étendu)**. Batch atomique 1..100 items. |
| POST | `/api/v2/planning/tasks/clear-completed` | ✅ **Implémenté (T-P0-04 étendu)**. Filtres date / date_before / section. |
| POST | `/api/v2/planning/tasks/rollover` | ✅ **Implémenté (T-P0-04 étendu)**. from_date, to_date optionnel = J+1. |

#### `GET /api/v2/planning/tasks`

**Auth** : JWT cookie httpOnly (comme v1).
**Feature flag** : `FEATURE_V2_PLANNING` (env). 404 `FEATURE_DISABLED` si off.

**Query params** :

| Param | Type | Description |
|-------|------|-------------|
| `cursor` | string opaque | Curseur de la page précédente (`meta.pagination.next_cursor`). Absent = première page. |
| `limit` | int | Nombre max d'items (défaut 100, max 200). |
| `person_id` | int > 0 | Filtre par personnel assigné. |
| `section` | enum | Une des 20 valeurs de `TASK_SECTIONS`. |
| `date_from` | `YYYY-MM-DD` | Borne inclusive. |
| `date_to` | `YYYY-MM-DD` | Borne inclusive. |
| `status` | string | Statut de la tâche (`pending`, `in_progress`, `done`, `cancelled`, ...). |
| `visible` | bool flexible | `1/0`, `true/false`, `yes/no`, `on/off`. |
| `affaire_num` | string | Filtre par numéro d'affaire. |

**Ordre garanti** : `date DESC, id DESC`. Le curseur est un keyset opaque encapsulant `{ date, id }` du dernier item retourné.

**Réponse succès (200)** :

```
{
  "success": true,
  "data": [
    { "id": 1234, "date": "2026-07-08", "section": "manual", ... },
    ...
  ],
  "meta": {
    "protocol_version": 1,
    "pagination": {
      "cursor": null,
      "next_cursor": "eyJkIjoiMjAyNi0wNy0wMSIsImkiOjEyMDB9",
      "limit": 100,
      "has_more": true
    },
    "count": 100
  }
}
```

**Réponse erreur validation (400)** :

```
{
  "success": false,
  "error": "section invalide (valeurs autorisées : rdv, ...)",
  "code": "PLANNING_V2_VALIDATION",
  "meta": {
    "protocol_version": 1,
    "field": "section"
  }
}
```

**Réponse feature flag off (404)** :

```
{
  "success": false,
  "error": "Endpoint non disponible",
  "code": "FEATURE_DISABLED",
  "meta": { "flag": "FEATURE_V2_PLANNING" }
}
```

### Events

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v2/planning/events` | ✅ **Implémenté (T-P0-05 étendu)**. Liste cursor-based, filtres serveur. |
| POST | `/api/v2/planning/events` | Création (à venir) |
| PUT | `/api/v2/planning/events/:id` | Mise à jour (à venir) |
| DELETE | `/api/v2/planning/events/:id` | Suppression (à venir) |

### Affaires (planning)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v2/planning/affaires` | ✅ **Implémenté (T-P0-05 étendu)**. Liste offset-based + statut cycle + `is_hidden`. |
| PATCH | `/api/v2/planning/affaires/:num/cycle-status` | Progression du cycle statut (à venir) |
| PATCH | `/api/v2/planning/affaires/:num/visibility` | Toggle visibilité planning (à venir) |

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
