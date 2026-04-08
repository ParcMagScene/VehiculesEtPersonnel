# AUDIT_CSS.md — CSS & Design System

> **Branche** : `audit/css` | **Phase** : C | **Priorité** : P2

---

## Objectif

Auditer la cohérence du Design System : tokens CSS utilisés, valeurs magiques restantes, composants non migrés.

## Modules impactés

- Tous les fichiers CSS (143 fichiers)
- Tokens CSS (380+ tokens)
- Composants React (styles)

## Fichiers impactés

| Fichier | Modification prévue |
|---------|-------------------|
| `apps/web/src/styles/` | Tokens manquants |
| `apps/web/src/components/**/*.css` | Valeurs magiques → tokens |

## Problèmes détectés

| # | Sévérité | Problème | Source |
|---|----------|----------|--------|
| C1 | — | Scan à réaliser : valeurs magiques restantes | Nouveau |
| C2 | — | Scan à réaliser : tokens non utilisés | Nouveau |
| C3 | — | Scan à réaliser : composants sans classes DS | Nouveau |

## Plan d'action

| Étape | Action | État |
|-------|--------|------|
| 1 | Scanner toutes les valeurs CSS magiques (couleurs hex, px hardcodés) | ⬜ TODO |
| 2 | Identifier tokens définis mais non utilisés | ⬜ TODO |
| 3 | Identifier composants sans classes DS | ⬜ TODO |
| 4 | Proposer plan de migration | ⬜ TODO |
| 5 | Appliquer corrections (après validation) | ⬜ TODO |

## ⚠️ Conflit avec audit/ui

Les deux audits touchent les mêmes composants React et CSS.
→ **Résolution** : audit/css se merge d'abord, audit/ui rebase ensuite.

## Tests à effectuer

- Vérification visuelle (pas de régression UI)
- Build Vite sans erreur
- Aucun changement fonctionnel

## Notes de validation

_(à remplir après chaque étape)_
