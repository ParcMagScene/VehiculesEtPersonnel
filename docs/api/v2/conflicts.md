# API v2 — Conflicts (Moteur de conflits agenda)

**Ticket** : T-P1-05 (Personnel v2 — moteur de conflits).
**Feature flag serveur** : `FEATURE_V2_CONFLICTS` (off par défaut).
**Coexistence** : aucune écriture, aucun bloquage sur les mutations
v1 (`POST /api/availabilities`, `POST /api/mission_assignments`,
`POST /api/task_assignments` acceptent toujours les entrées même en
cas de conflit).

Ce namespace **détecte** les conflits d'agenda pour permettre à l'UI
d'alerter l'utilisateur en pré-check avant validation. La logique
métier v1 reste inchangée.

---

## Discovery

### `GET /api/v2/conflicts/protocol`

Public. Retourne `protocol_version`, `capabilities`,
`legacy_endpoints` (vide — aucun équivalent v1), `sources_scanned`,
`docs`.

---

## Check — `POST /api/v2/conflicts/check`

Authentifié.

### Body

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `person_id` | int > 0 | ✅ | ID `persons.id`. |
| `start_date` | ISO date | ✅ | Début de la période à vérifier. |
| `end_date` | ISO date | ✅ | Fin (>= `start_date`). |
| `start_period` | `AM`/`PM` | — | Défaut `AM`. |
| `end_period` | `AM`/`PM` | — | Défaut `PM`. |
| `exclude` | array | — | Liste `{entity_type, entity_id}` à ignorer (self-check lors d'un update). |

### Sources scannées

1. **`availabilities`** : indisponibilités RH avec `status='approved'`
   (les demandes en attente ou refusées ne bloquent pas).
2. **`missions`** + **`mission_assignments`** : missions terrain avec
   `status IN ('proposed', 'confirmed', 'accepted')`.
3. **`task_assignments`** : tâches planning avec `status != 'cancelled'`.

### Réponse 200 — pas de conflit

```json
{
  "success": true,
  "data": {
    "conflicts": [],
    "has_conflict": false,
    "count": 0
  },
  "meta": { "protocol_version": 1 }
}
```

### Réponse 200 — conflits détectés

```json
{
  "success": true,
  "data": {
    "conflicts": [
      {
        "source": "availability",
        "entity_type": "availability",
        "entity_id": 42,
        "start_date": "2026-06-01",
        "end_date": "2026-06-03",
        "start_period": "AM",
        "end_period": "PM",
        "description": "Indisponibilité unavailable — RTT",
        "meta": { "type": "unavailable", "reason": "RTT" }
      },
      {
        "source": "mission",
        "entity_type": "mission",
        "entity_id": 17,
        "start_date": "2026-06-02",
        "end_date": "2026-06-04",
        "description": "Mission Concert Ete (confirmed)",
        "meta": { "status": "confirmed", "position": "regie" }
      },
      {
        "source": "task",
        "entity_type": "task_assignment",
        "entity_id": "t-abc123",
        "start_date": "2026-06-02",
        "end_date": "2026-06-02",
        "start_period": "AM",
        "end_period": "AM",
        "description": "Tâche Chargement",
        "meta": { "status": "pending", "section": "chargement", "time": "08:00" }
      }
    ],
    "has_conflict": true,
    "count": 3
  }
}
```

### Erreurs

- `400 VALIDATION_ERROR` : `person_id` <= 0, dates non ISO,
  `end_date < start_date`, période hors {AM, PM}.

---

## Exclude (self-check lors d'un update)

Pour vérifier si un update d'une entrée existante crée un conflit,
il faut ignorer l'entrée elle-même :

```json
{
  "person_id": 1,
  "start_date": "2026-05-02",
  "end_date": "2026-05-04",
  "exclude": [
    { "entity_type": "availability", "entity_id": 42 }
  ]
}
```

Types d'entités supportés dans `exclude` :
- `availability`
- `mission`
- `task_assignment`

---

## Reference

- `apps/api/services/conflicts/detector.js` : `detectPersonConflicts`.
- `apps/api/services/conflicts/errors.js` : `ConflictsV2ValidationError`.
- `apps/api/v2/conflictsRoutes.js` : namespace + gate + handler.

---

## Non couvert par T-P1-05

- **Blocage serveur** des mutations v1 en cas de conflit : le v2 est
  strictement en lecture (aucun bloquage). Un ticket ultérieur pourra
  intercepter les POST v1 pour appliquer un pré-check systématique
  (avec possibilité de `force=true` en admin).
- **Notification temps réel** aux consommateurs (WebSocket) sur
  détection : hors scope.
- **Namespace `planning_assignments`** (assignation générique
  affaire/display_event/task) : pas encore inclus dans les sources
  scannées (redondant avec `task_assignments` pour la plupart des
  cas), à ajouter si besoin métier.

---

## Dogfooding UI (T-P1-05b — 2026-07-10)

Fondations UI livrées pour l'intégration future d'un pré-check
conflits dans les formulaires d'affectation. Aucune modification
d'`AssignmentDialog`, `LeaveRequestForm` ou `MissionForm` dans ce
ticket : les composants existants restent sur le comportement
post-check via `api.createAssignment(...).warnings.conflicts` v1.

Chemin technique livré :

- `apps/web/src/utils/conflicts/v2Adapters.js` :
  `adaptConflictV2ToV1` (snake → camel),
  `adaptV2ConflictsResponse` (normalisation `{ conflicts,
  hasConflict, count }`), `readConflictsV2ClientFlag(env)`.
- `apps/web/src/utils/conflicts/checkPersonConflicts.js` :
  `checkPersonConflictsUnified(api, params, { useV2 })` — retourne
  `null` quand le pré-check n'est pas disponible (flag off,
  FEATURE_DISABLED, méthode client absente, erreur réseau). C'est
  un signal au composant amont : "on garde le comportement
  legacy". Sérialisation `exclude` camelCase → snake_case
  automatique.
- `apps/web/src/hooks/useConflictsPrecheck.js` : hook React
  autonome avec debounce (300ms par défaut). Retourne
  `{ conflicts, hasConflict, count, loading, available }`.
  `available=false` signale "pré-check indisponible".

Note : le v1 n'a **pas** d'endpoint standalone équivalent — le v2
comble un vrai gap (`additive` strict). Le fallback n'est donc pas
"v1 endpoint" mais "aucun pré-check, laisser le POST créer et
lire `warnings.conflicts`".

Tests de non-régression :

- `apps/web/src/utils/conflicts/v2Adapters.test.js` (7 cas).
- `apps/web/src/utils/conflicts/checkPersonConflicts.test.js`
  (9 cas).
- `apps/web/src/hooks/useConflictsPrecheck.test.jsx` (5 cas).

Consommation UI prévue (T-P1-05c à venir) :

- `AssignmentDialog` : afficher un badge "N conflit(s) détecté(s)"
  au-dessus du bouton Créer.
- `LeaveRequestForm` : optionnel — les conflits congés vs missions
  sont déjà remontés par `getLeaveConflicts` v1.
