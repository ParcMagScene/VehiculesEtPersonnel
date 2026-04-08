# AUDIT_IMPORTS.md — Validation Imports CSV/JSON

> **Branche** : `audit/imports` | **Phase** : B ✅ TERMINÉ | **Priorité** : P1
> **Commit** : `537fe60` | **Merge dev** : 8 avril 2026

---

## Objectif

Étendre la validation Zod aux imports restants. Uniformiser le traitement d'erreur et le feedback utilisateur.

## Modules impactés

- Routes d'import backend
- Schémas Zod (schemas/imports.js)
- Composants d'import frontend

## Fichiers impactés

| Fichier | Modification prévue |
|---------|-------------------|
| `apps/api/schemas/imports.js` | Nouveaux schémas |
| `apps/api/equipmentRoutes.js` | Étendre validation |
| `apps/api/vehicleRoutes.js` | Ajouter validation import |
| `apps/web/src/components/*/Import*.jsx` | Feedback erreurs |

## Problèmes détectés

| # | Sévérité | Problème | Source |
|---|----------|----------|--------|
| I1 | HIGH | Import véhicules CSV sans validation Zod | PLAN_ACTION_EMAG |
| I2 | HIGH | Import BL sans vérification colonnes | PLAN_ACTION_EMAG |
| I3 | HIGH | Pas de limite nombre de lignes CSV | PLAN_ACTION_EMAG |

## ⚠️ Dépendance avec audit/securite

Cet audit dépend de audit/securite (même fichier `schemas/imports.js`).
→ **Résolution** : attendre merge de audit/securite avant de commencer.

## Plan d'action

| Étape | Action | État |
|-------|--------|------|
| 1 | Lister tous les endpoints d'import | ⬜ TODO |
| 2 | Créer schémas Zod manquants | ⬜ TODO |
| 3 | Appliquer validation + limite lignes | ⬜ TODO |
| 4 | Améliorer feedback frontend | ⬜ TODO |

## Tests à effectuer

- Import CSV valide → OK
- Import CSV colonnes manquantes → erreur claire
- Import CSV > 10 000 lignes → rejeté avec message

## Notes de validation

_(à remplir après chaque étape)_
