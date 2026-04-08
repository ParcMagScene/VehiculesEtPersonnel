# 🔧 API Matériel & SAV

> **Version** : 1.0.0  
> **Source** : `equipmentRoutes.js`  
> **Dernière MÀJ** : 7 avril 2026

---

## Catégories matériel

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/equipment-categories` | ✅ | Catégories hiérarchiques (famille→sous-famille→catégorie) |
| GET | `/api/equipment-categories/tree` | ✅ | Arbre complet avec parent_id |
| POST | `/api/equipment-categories` | ✅🔑 | Crée catégorie |
| PUT | `/api/equipment-categories/:id` | ✅🔑 | MAJ catégorie |
| DELETE | `/api/equipment-categories/:id` | ✅🔑 | Supprime (empêche si matériel rattaché) |

---

## Matériel

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/equipment` | ✅ | Filtres: status, category_id, search, zone, depot + assignations actives |
| GET | `/api/equipment/:id` | ✅ | Détail + historique assignations + tickets SAV |
| POST | `/api/equipment` | ✅🔑 | Crée matériel (auto-génère référence) |
| PUT | `/api/equipment/:id` | ✅🔑 | MAJ métadonnées |
| DELETE | `/api/equipment/:id` | ✅🔑 | Supprime (vérifie assignations actives) |

---

## Assignations matériel

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/equipment-assignments` | ✅ | Liste assignations (personne→matériel) |
| POST | `/api/equipment-assignments` | ✅ | Assigne matériel (empêche double assignation — Phase 3) |
| PUT | `/api/equipment-assignments/:id` | ✅ | MAJ dates assignation |
| DELETE | `/api/equipment-assignments/:id` | ✅ | Termine assignation |

---

## Tickets SAV

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/sav-tickets` | ✅ | Liste tickets (open, in_progress, closed) |
| POST | `/api/sav-tickets` | ✅ | Crée ticket SAV (alerte email) |
| PUT | `/api/sav-tickets/:id` | ✅ | MAJ statut (machine d'état validée — Phase 3) |
| DELETE | `/api/sav-tickets/:id` | ✅🔑 | Admin supprime |

---

## Listes matériel

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/equipment-lists` | ✅ | Listes nommées (ex: "Tournée Tech") |
| POST | `/api/equipment-lists` | ✅🔑 | Crée liste |
| PUT | `/api/equipment-lists/:id` | ✅🔑 | MAJ contenu liste |
| DELETE | `/api/equipment-lists/:id` | ✅🔑 | Supprime liste |

---

## Machine d'état SAV

```
open → in_progress → waiting_parts → in_progress → closed
  ↘                                                   ↗
    → ───────────── closed ──────────────────────────
```

Transitions validées côté serveur (Phase 3 — MED-W1).
