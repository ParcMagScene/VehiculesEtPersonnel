# 📅 Module Planning

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

## Composants

| Composant | Rôle |
|-----------|------|
| PlanningPanel | Panel principal planning |
| AddTaskModal | Création tâche |
| TaskEditModal | Édition tâche |
| EventDetailsModal | Détails événement |
| EventTaskModal | Assignation tâche→événement |
| InterventionModal | Modal intervention |
| OverdueInterventionModal | Alerte interventions en retard |
| PeriodCalendarModal | Sélection plage horaire |
| TaskPDFExportModal | Export PDF planning |

## Service API

`utils/api/planning.js` — Tâches, interventions, planning, export PDF/BL, iCal

## Fonctionnalités clés

- 14 sections de tâches (rdv, prep_locations, chargement, etc.)
- Tâches récurrentes (daily/weekly/monthly)
- Rollover tâches incomplètes
- Export iCal pour calendrier externe
- Cycle statut affaires (prep→charge→depart→etc.)
