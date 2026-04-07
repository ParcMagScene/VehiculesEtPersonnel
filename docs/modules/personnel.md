# 👥 Module Personnel

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

## Composants

| Composant | Rôle |
|-----------|------|
| PersonnelPanel | Panel principal (liste, filtres, onglets) |
| PersonnelImportModal | Import CSV |
| AssignmentDialog | Assignation missions |
| LeaveRequestsPanel | Demandes de congés |
| LeaveValidationPanel | Validation congés (admin) |
| LeavesTab | Onglet congés |
| MonEspacePanel | Espace personnel du salarié |

## Hooks

- `useAppData` — Personnel, compétences, missions

## Service API

- `utils/api/personnel.js` — Personnes, skills, postes, missions, affectations
- `utils/api/leaves.js` — Congés (IDCC 3252)

## Règles métier

- Validation compétences personne vs requirements mission
- Workflow approbation disponibilités
- Machine d'état missions (pending→confirmed→in_progress→completed→cancelled)
- Auto-approbation congés bloquée (Phase 1)
