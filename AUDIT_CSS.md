# AUDIT_CSS.md — CSS & Design System

> **Branche** : `audit/css` | **Phase** : C | **Priorité** : P2
> **Statut** : ✅ TERMINÉ — commit `49ad2d8`

---

## Objectif

Auditer la cohérence du Design System : tokens CSS utilisés, valeurs magiques restantes, composants non migrés.

## Scan (143 fichiers, 72 582 lignes)

- 288 primitive tokens (theme.css), 132 semantic tokens (tokens.css)
- 27 z-index hardcodés, ~132 hex couleurs, 77 font-size px, 179 border-radius, 225 !important

## Corrections appliquées (commit `49ad2d8`)

| # | Sev | Problème | Fix | Fichiers |
|---|-----|----------|-----|----------|
| C1 | CRIT | z-index: 10000 dans ProfileEditModal | → var(--z-tooltip) | 1 |
| C2 | CRIT | z-index anarchique (1100-100001) dans 11 fichiers | → tokens (17 remplacements) | 11 |
| M10 | MED | Couleurs dark mode hardcodées (#451a03, #064e3b, #1a2332, #2d2b55) | → tokens sémantiques | 2 |
| M11 | MED | Double déclaration tokens (--text-primary vs --theme-text-primary) | Reporté backlog (34 occurrences actives) | — |
| L14 | LOW | .modal-overlay conflit AnnuairePanel vs index.css | Dead CSS supprimé | 1 |

## Backlog progressif

| # | Sev | Problème | Occurrences |
|---|-----|----------|-------------|
| H3 | HIGH | ~132 couleurs hex hardcodées | 132 |
| H4 | HIGH | 77 font-size en px | 77 |
| H5 | HIGH | 225 !important | 225 |
| H6 | HIGH | Tokens sémantiques définis non utilisés | ~20 tokens |
| H7 | HIGH | CSS monolithiques (EquipmentPanel 3501 lignes) | 5 fichiers |
| M8 | MED | 179 border-radius hardcodés | 179 |
| M9 | MED | Google Calendar couleurs non thémables | — |
| M12 | MED | 0% CSS modules | architectural |
| M13 | MED | box-shadow raw au lieu de tokens | — |
| L15 | LOW | Styles badge dupliqués PersonnelPanel | — |
- Aucun changement fonctionnel

## Notes de validation

_(à remplir après chaque étape)_
