# AUDIT_PLANNING.md — Planning & Google Calendar

> **Branche** : `audit/planning` | **Phase** : A | **Priorité** : P1

---

## Objectif

Fiabiliser le module Planning et la synchronisation Google Calendar. Corriger les guards Invalid Date et les edge cases.

## Modules impactés

- Planning personnel (frontend + backend)
- Google Calendar sync
- Composants calendrier

## Fichiers impactés

| Fichier | Modification prévue |
|---------|-------------------|
| `apps/api/planningRoutes.js` | Validation dates |
| `apps/api/googleCalendarRoutes.js` | Robustesse sync |
| `apps/web/src/components/planning/` | Guards UI |
| `apps/web/src/utils/api/planning.js` | Error handling |

## Problèmes détectés

| # | Sévérité | Problème | Source |
|---|----------|----------|--------|
| P1 | HIGH | Sync GCal silencieuse en cas d'erreur token expiré | PLAN_ACTION_EMAG |
| P2 | MED | Invalid Date possible sur événements sans date fin | Commit `dab447d` (partiellement corrigé) |
| P3 | MED | Pas de retry sur erreur réseau GCal | PLAN_ACTION_EMAG |
| P4 | MED | Catégories planning non validées côté backend | PLAN_ACTION_EMAG |
| P5 | LOW | Tooltip tronqué sur événements longs | PLAN_ACTION_EMAG |

## Analyse UI → API → DB

- **UI** : `PlanningPanel.jsx` → `PlanningView.jsx` → affiche événements
- **API** : `api.planning.getEvents()` → `GET /api/planning/events`
- **DB** : Table `planning_events` (id, title, start_date, end_date, category, ...)
- **GCal** : `googleCalendarRoutes.js` → OAuth2 → fetch events → upsert DB

## Plan d'action

| Étape | Action | État |
|-------|--------|------|
| 1 | Scan complet des routes planning + GCal | ⬜ TODO |
| 2 | Identifier tous les chemins sans validation de date | ⬜ TODO |
| 3 | Ajouter guards Invalid Date backend | ⬜ TODO |
| 4 | Ajouter retry GCal avec backoff | ⬜ TODO |
| 5 | Valider catégories backend | ⬜ TODO |

## Tests à effectuer

- Tests unitaires existants
- Test manuel sync GCal (token valide + expiré)
- Test création événement sans date fin

## Notes de validation

_(à remplir après chaque étape)_
