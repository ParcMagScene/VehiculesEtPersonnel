# 🚗 API Véhicules & Réservations

> **Version** : 1.0.0  
> **Source** : `vehicleRoutes.js`  
> **Dernière MÀJ** : 7 avril 2026

---

## Véhicules

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/vehicles` | ✅ | Liste véhicules (cache 30s) + historique maintenance |
| GET | `/api/vehicles/:id` | ✅ | Détail véhicule + assignations liées |
| POST | `/api/vehicles` | ✅🔑 | Crée véhicule (auto-génère métriques trajet) |
| PUT | `/api/vehicles/:id` | ✅🔑 | MAJ véhicule (mapping camelCase→snake_case) |
| DELETE | `/api/vehicles/:id` | ✅🔑 | Supprime véhicule (cascade réservations) |

---

## Réservations

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/reservations` | ✅ | Liste réservations (cache 30s, LEFT JOIN vehicles) |
| POST | `/api/reservations` | ✅🔑 | Crée réservation (détection conflits chevauchement) |
| PUT | `/api/reservations/:id` | ✅🔑 | MAJ réservation + trip_details liés |
| DELETE | `/api/reservations/:id` | ✅🔑 | Supprime (cascade trip_details + trip_pauses) |

---

## Règles métier

- **Détection conflits** : Vérification chevauchement temporel avant approbation (Phase 2 sécurité)
- **Cache** : 30s sur GET listes, invalidé automatiquement sur mutation
- **Cascade** : Suppression véhicule → suppression réservations associées
- **trip_details** : Données trajet liées automatiquement à la réservation

---

## Tables associées

| Table | Rôle |
|-------|------|
| `vehicles` | Parc véhicules |
| `reservations` | Réservations véhicules |
| `trip_details` | Détails trajets |
| `trip_pauses` | Pauses trajets |
| `maintenances` | Historique maintenance |
