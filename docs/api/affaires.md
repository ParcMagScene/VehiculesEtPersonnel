# 📁 API Affaires

> **Version** : 1.0.0  
> **Source** : `affairesRoutes.js`  
> **Dernière MÀJ** : 7 avril 2026

---

## Endpoints

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/affaires` | ✅ | Liste affaires (cache 30s) + enrichissement automatique depuis réservations + counts batch (réservations, véhicules, personnel, BL, commandes) |
| GET | `/api/affaires/:id` | ✅ | Détail affaire + counts enrichis + BL/commandes liés |
| POST | `/api/affaires` | ✅🔑 | Crée affaire (link Google Calendar si fourni) |
| PUT | `/api/affaires/:id` | ✅🔑 | MAJ affaire (dates, client, contact) |
| DELETE | `/api/affaires/:id` | ✅🔑 | Soft delete (marque inactive) |
| GET | `/api/affaires/personnel-counts` | ✅ | Comptage personnel assigné par affaire (toutes affaires) |

---

## Enrichissement automatique

Le GET liste détecte automatiquement les affaires depuis les réservations qui ont un numéro d'affaire, même si aucune entrée n'existe dans la table `affaires`. Cela permet un enrichissement progressif.

---

## Tables associées

| Table | Rôle |
|-------|------|
| `affaires` | Données affaires |
| `affaire_links` | Liens inter-affaires |
| `reservations` | Réservations liées (via `affaire` field) |
| `bl_imports` | Bons de livraison importés |
| `orders` | Commandes liées |
