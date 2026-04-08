# ⚙️ Workflows & Machines d'état — eM@g

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

---

## 1. Commandes fournisseurs

```
draft ──→ sent ──→ confirmed ──→ partial ──→ received
  │                    │                        │
  └── cancelled ◄─────┘────── cancelled ◄──────┘
```

| Transition | Condition |
|------------|-----------|
| draft → sent | Validation manuelle |
| sent → confirmed | Confirmation fournisseur |
| confirmed → partial | Réception partielle items |
| partial → received | Tous items reçus |
| * → cancelled | Action admin (sauf `received`) |

---

## 2. Devis

```
draft ──→ sent ──→ accepted
                └──→ refused
```

---

## 3. Tickets SAV

```
open ──→ in_progress ──→ waiting_parts ──→ closed
  │         │                │               ▲
  │         └── closed ──────┘───────────────┘
  └── cancelled
```

**Validation serveur** (Phase 3 — MED-W1) : Les transitions sont vérifiées côté backend via `VALID_SAV_TRANSITIONS`. Toute transition invalide → 400.

---

## 4. Missions personnel

```
pending ──→ confirmed ──→ in_progress ──→ completed
  │            │              │
  └── cancelled ◄────────────┘
```

---

## 5. Demandes de congé

```
draft ──→ pending ──→ approved ──→ taken
  │          │
  │          └── refused
  └── cancelled
```

**Règle** : Un valideur ne peut pas approuver sa propre demande (Phase 1 — CRIT-4).

---

## 6. Demandes matériel

```
pending ──→ needs_review ──→ approved ──→ ordered
  │                             │
  └── rejected ◄───────────────┘
```

---

## 7. Demandes d'accès

```
pending ──→ approved ──→ (compte créé)
  │
  └── rejected
```

---

## 8. Cycle affaire (planning)

```
prep → charge → depart → route → montage → exploitation 
  → demontage → retour → decharge → cloture
```

14 sections de tâches accompagnent ce cycle.

---

## 9. Réservations véhicules

```
pending ──→ confirmed ──→ in_progress ──→ completed
  │            │
  │            └── cancelled
  └── cancelled
```

**Détection conflits** (Phase 2 — HIGH-3) : Toute réservation chevauchante pour le même véhicule est refusée.
