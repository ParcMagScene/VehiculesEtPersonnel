# AUDIT_UI.md — UI / UX

> **Branche** : `audit/ui` | **Phase** : C | **Priorité** : P1

---

## Objectif

Corriger les problèmes d'expérience utilisateur identifiés : formulaires, feedback, accessibilité, états de chargement.

## Modules impactés

- Composants React (formulaires, listes, modals)
- États de chargement / erreur
- Accessibilité (a11y)

## Fichiers impactés

| Fichier | Modification prévue |
|---------|-------------------|
| `apps/web/src/components/` | Corrections UX |
| `apps/web/src/styles/` | Ajustements visuels |

## Problèmes détectés

| # | Sévérité | Problème | Source |
|---|----------|----------|--------|
| U1 | CRIT | Formulaires sans feedback d'erreur visible | PLAN_ACTION_EMAG |
| U2 | CRIT | Actions destructives sans confirmation | PLAN_ACTION_EMAG |
| U3 | HIGH | États de chargement manquants sur certaines vues | PLAN_ACTION_EMAG |
| U4 | HIGH | Pas de skeleton/placeholder au chargement | PLAN_ACTION_EMAG |
| U5 | HIGH | Toast notifications incohérentes | PLAN_ACTION_EMAG |
| U6 | HIGH | Pagination absente sur listes longues | PLAN_ACTION_EMAG |
| U7 | HIGH | Recherche sans debounce | PLAN_ACTION_EMAG |
| U8 | MED | Contraste insuffisant sur certains éléments | PLAN_ACTION_EMAG |
| U9 | MED | Focus trap manquant dans certains modals | PLAN_ACTION_EMAG |
| U10 | MED | Labels manquants sur inputs | PLAN_ACTION_EMAG |

## ⚠️ Dépendance avec audit/css

Cet audit rebase sur audit/css une fois celui-ci mergé.

## Plan d'action

| Étape | Action | État |
|-------|--------|------|
| 1 | Inventorier les formulaires sans feedback | ⬜ TODO |
| 2 | Ajouter confirmations sur actions destructives | ⬜ TODO |
| 3 | Ajouter loading states manquants | ⬜ TODO |
| 4 | Uniformiser toast notifications | ⬜ TODO |
| 5 | Ajouter debounce sur recherches | ⬜ TODO |
| 6 | Corriger a11y (contraste, labels, focus trap) | ⬜ TODO |

## Tests à effectuer

- Vérification visuelle sur desktop + mobile
- Test formulaire avec erreur → feedback visible
- Test suppression → confirmation demandée
- Audit Lighthouse accessibilité

## Notes de validation

_(à remplir après chaque étape)_
