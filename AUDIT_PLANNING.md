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

| # | Sévérité | Problème | Statut |
|---|----------|----------|--------|
| P1 | CRIT | Aucune validation format date YYYY-MM-DD sur POST/PUT display-events | ✅ FIXÉ |
| P2 | CRIT | Aucune validation date/time/end_time sur POST/PUT tasks | ✅ FIXÉ |
| P3 | CRIT | Batch tasks ignore silencieusement les dates invalides | ✅ FIXÉ |
| P4 | HIGH | new Date() sans garde isNaN → "Invalid Date" affiché (6 occurrences, 3 fichiers) | ✅ FIXÉ |
| P5 | HIGH | GCal fetch() sans timeout AbortController → blocage indéfini | ✅ FIXÉ |
| P6 | HIGH | GCal pas de retry sur erreurs transitoires (502/503/504) | ✅ FIXÉ |
| P7 | MED | GCal POST /token expiresAt non validé comme nombre/futur | ✅ FIXÉ |
| P8 | HIGH | GCal pas de refresh_token → reconnexion manuelle à chaque expiration | 📋 NOTÉ (redesign OAuth requis) |

## Plan d'action

| Étape | Action | État |
|-------|--------|------|
| 1 | Scan complet routes planning + GCal | ✅ DONE |
| 2 | Ajout isValidDate/isValidTime helpers backend | ✅ DONE |
| 3 | Validation date/time sur POST/PUT display-events et tasks | ✅ DONE |
| 4 | safeParseDate() helper frontend (dateUtils.js) | ✅ DONE |
| 5 | Gardes Invalid Date (6 occurrences dans 3 composants) | ✅ DONE |
| 6 | GCal AbortController timeout 10s + retry 1x (502/503/504) | ✅ DONE |
| 7 | Validation expiresAt POST /token | ✅ DONE |

## Tests à effectuer

- `node --test tests/unit.test.js` — ✅ 21/21, 0 fail
- Aucune erreur lint/syntaxe (6 fichiers vérifiés)
- Test manuel sync GCal (token valide + expiré) — à valider

## Notes de validation

- Commit `a25df74` sur `audit/planning`
- Merge `audit/planning → dev` le 2026-04-08
- refresh_token GCal : nécessite redesign OAuth (scope, backend-side flow) — reporté à phase dédiée
- Aucune régression détectée
