# AUDIT_TESTS.md — Tests & CI

> **Branche** : `audit/tests` | **Phase** : E | **Priorité** : P2

---

## Objectif

Atteindre les objectifs roadmap v2.1.0 : coverage >60%, tests d'intégration API, CI renforcée.

## Modules impactés

- Tests unitaires (tests/)
- Tests d'intégration API (nouveau)
- CI GitHub Actions (.github/workflows/)
- Configuration (vitest, supertest)

## Fichiers impactés

| Fichier | Modification prévue |
|---------|-------------------|
| `tests/` | Nouveaux tests |
| `package.json` | Dépendances test (vitest, supertest) |
| `.github/workflows/` | CI renforcée |
| `vitest.config.js` | Configuration coverage |

## État actuel

| Métrique | Valeur |
|----------|--------|
| Tests existants | 56 (21 dans unit.test.js) |
| Suites | 9 |
| Échecs | 0 |
| Coverage | Non mesuré |
| CI | Workflow dev basique (lint+test+build) |

## Problèmes détectés

| # | Sévérité | Problème | Source |
|---|----------|----------|--------|
| T1 | HIGH | Coverage non mesuré | Roadmap |
| T2 | HIGH | Pas de tests d'intégration API | Roadmap |
| T3 | MED | Pas de tests composants React | Roadmap |
| T4 | MED | CI ne bloque pas sur coverage minimum | Roadmap |
| T5 | LOW | Pas de hooks pre-commit (husky) | Roadmap |

## Plan d'action

| Étape | Action | État |
|-------|--------|------|
| 1 | Installer vitest + @testing-library/react | ⬜ TODO |
| 2 | Configurer coverage avec seuil 60% | ⬜ TODO |
| 3 | Écrire tests intégration API (supertest) | ⬜ TODO |
| 4 | Écrire tests composants critiques | ⬜ TODO |
| 5 | Renforcer CI (coverage gate, lint strict) | ⬜ TODO |
| 6 | Ajouter husky pre-commit | ⬜ TODO |

## Tests à effectuer

- Tous les tests existants passent
- Nouveaux tests passent
- Coverage ≥ 60%
- CI verte

## Notes de validation

_(à remplir après chaque étape)_
