# UI/UX Top 10 — Priorites 2026-06-30

Source: `node scripts/measure-ui-debt.mjs --format=summary` + `docs/05-Specs/AUDIT_UI_UX.md`.

## Objectif sprint
- Reduire la dette visuelle et d'accessibilite sans casser les flux metier.
- Prioriser les actions a fort impact utilisateur et faible/moyen effort.

## Top 10 priorise

| # | Action | Impact | Effort | Cible principale |
|---|---|---|---|---|
| 1 | Remplacer les boutons HTML bruts par le DS (`Button`) | Eleve | M | `apps/web/src/components/**` |
| 2 | Eliminer les couleurs hardcodees de `ManagementPanel` (palette JS -> tokens) | Eleve | M | `apps/web/src/components/management/ManagementPanel.jsx` |
| 3 | Tokeniser les couleurs Google (planning) | Eleve | S | `apps/web/src/components/planning/TaskPlanningPanel.css`, `apps/web/src/components/planning/EventTaskModal.css` |
| 4 | Supprimer styles inline `color/background/border` (passage classes/tokens) | Eleve | M | `apps/web/src/components/controles/ControlPerformModal.jsx` + autres modals |
| 5 | Normaliser spacing CSS (`px` -> `--space-*`) sur panneaux lourds | Eleve | L | `apps/web/src/components/mailing/MailingPanel.css`, `apps/web/src/components/personnel/PersonnelPanel.css`, `apps/web/src/components/equipment/EquipmentPanel.css` |
| 6 | Uniformiser breakpoints (retirer exotiques) | Moyen | M | `apps/web/src/**/*.css` |
| 7 | Decouper `AffaireDetailPanel` (mega-component) | Eleve | XL | `apps/web/src/components/affaires/AffaireDetailPanel.jsx` |
| 8 | Decouper `EquipmentPanel` (modals imbriques) | Eleve | L | `apps/web/src/components/equipment/EquipmentPanel.jsx` |
| 9 | Decouper `PersonnelPanel` (agenda vs management) | Moyen | L | `apps/web/src/components/personnel/PersonnelPanel.jsx` |
| 10 | Harmoniser loaders/skeletons via DS (suppression spinners ad-hoc) | Moyen | M | `apps/web/src/components/mailing/MailingPanel.jsx`, `apps/web/src/components/orders/OrdersPanel.jsx` |

## KPIs de sortie (DoD)
- `Stylelint hex`: < 120
- `Stylelint rgb/rgba`: < 300
- `JSX inline color/border`: < 180
- `JSX inline spacing`: < 90
- `JSX <button> brut`: < 30
- `CSS px hors ui/`: < 1800
- `Breakpoints exotiques`: < 100

## Commandes de suivi
- Mesure rapide: `node scripts/measure-ui-debt.mjs --format=summary`
- Snapshot dashboard: `node scripts/measure-ui-debt.mjs --update`
