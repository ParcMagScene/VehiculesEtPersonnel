# 🚗 Module Véhicules

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

## Composants

| Composant | Rôle |
|-----------|------|
| Calendar | Calendrier des réservations |
| VehicleDetailPanel | Panneau détail véhicule |
| PlanningView | Vue planning Gantt |
| DepotMap / DepotMapEditor | Carte des dépôts (lecture/édition) |
| ReservationModal | Création/édition réservation |
| VehicleDetailsModal | Modal détails véhicule |
| VehicleMaintenanceModal | Modal maintenance |
| MaintenanceDialog | Dialog actions maintenance |
| TripDetailsModal | Détails trajet |
| GoogleEventFormModal | Lien Google Calendar |
| LocationDialog / LocationSelector | Gestion lieux |
| ClientDialog | Sélection client |
| ReservationEquipment | Matériel lié réservation |
| GoogleCalendarBanner / Config | Intégration Google Calendar |

## Hooks

- `useGoogleCalendar` — Sync Google Calendar
- `useAppData` — Cache données véhicules/réservations

## Service API

`utils/api/vehicles.js` — Véhicules, réservations, maintenances, conducteurs, lieux, garages
