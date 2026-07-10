# API v2 — Equipment Assignments (Assignations auditées)

**Ticket** : T-P1-08.
**Feature flag serveur** : `FEATURE_V2_EQUIPMENT_ASSIGNMENTS` (off par défaut).
**Coexistence** : `/api/equipment-assignments/*` v1 inchangé (accepte
toujours les double-assignations sans erreur, comportement historique).

Ce namespace apporte deux garanties clés :

1. **Double-assignation strictement bloquée** — impossible de créer
   une nouvelle ligne ACTIVE (`status='active'`) si l'équipement a
   déjà une assignation ACTIVE qui chevauche la plage. Retour
   `409 CONFLICT`.
2. **Audit trail systématique** — chaque mutation (create, release)
   génère une ligne `equipment_assignment_history` avec le diff
   avant/après.

---

## Discovery — `GET /api/v2/equipment-assignments/protocol`

Public. Structure standard.

---

## Create — `POST /api/v2/equipment/:id/assignments`

Authentifié.

### Body

```json
{
  "assigned_to": 10,
  "start_date": "2026-01-01",
  "end_date": "2026-01-10",
  "affaire_id": "AF-001",
  "notes": "Prêt pour tournée"
}
```

- `start_date` requis (ISO date).
- `end_date` optionnel (`null` = ouverte).
- `assigned_to`, `affaire_id`, `notes` optionnels.

### Réponse 201

```json
{
  "success": true,
  "data": {
    "assignment": { "id": 42, "status": "active", ... },
    "history_id": 17
  }
}
```

### Erreurs

- `400 VALIDATION_ERROR` : dates invalides, `equipmentId` <= 0.
- `404 NOT_FOUND` : équipement introuvable.
- `409 CONFLICT` : double-assignation. `meta.details.conflicts` =
  liste des IDs d'assignations ACTIVE en conflit.

---

## Release — `POST /api/v2/equipment-assignments/:aid/release`

Authentifié. Passe l'assignation en `status='released'` avec
`end_date` fixée. Ecrit une entrée history.

### Body

```json
{
  "release_date": "2026-01-05",
  "notes": "Rendu tôt"
}
```

- `release_date` optionnel (défaut : aujourd'hui).

### Réponse 200

```json
{
  "success": true,
  "data": {
    "assignment": { "id": 42, "status": "released", "end_date": "2026-01-05", ... },
    "history_id": 18
  }
}
```

### Erreurs

- `404 NOT_FOUND` : assignation introuvable.
- `409 CONFLICT` : assignation déjà en statut non-active (release
  impossible).

---

## History — `GET /api/v2/equipment/:id/assignments/history`

Authentifié. Liste chronologique décroissante (`changed_at DESC`).

## History ciblée — `GET /api/v2/equipment-assignments/:aid/history`

Authentifié. Historique d'une assignation précise.

### Query params (les 2)

| Nom | Défaut | Description |
|-----|--------|-------------|
| `limit` | 100 | Cap 500. |

### Réponse 200

```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "id": 18,
        "assignment_id": 42,
        "equipment_id": 7,
        "event_type": "released",
        "previous_status": "active",
        "new_status": "released",
        "previous_end_date": null,
        "new_end_date": "2026-01-05",
        "notes": "Rendu tôt",
        "changed_by": 3,
        "changed_at": "2026-01-05 14:30:00"
      }
    ],
    "total": 1
  }
}
```

---

## Reference

- `apps/api/migrations/equipment-assignment-history-v1.js` :
  nouvelle table `equipment_assignment_history` additive.
- `apps/api/services/equipment-assignments/assignments.js` :
  `createAssignmentSafe`, `releaseAssignment`,
  `findConflictingActiveAssignments`, `appendHistoryEntry`,
  `getAssignmentHistory`.
- `apps/api/v2/equipmentAssignmentsRoutes.js` : namespace + gate.

---

## Non couvert par T-P1-08

- **Interception du POST v1** pour appliquer le check
  double-assignation : le v1 continue à accepter sans erreur.
- **Transfert** (`event_type='transferred'`) : réservé pour un
  ticket ultérieur (permutation d'assignation active vers un autre
  affaire/date sans release intermédiaire).
- **UI** consommant ces endpoints : ticket T-P1-08b.
