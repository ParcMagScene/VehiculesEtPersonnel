# API v2 — Leaves (Congés)

**Ticket** : T-P1-04 (Personnel v2 — solde congés côté serveur).
**Feature flag serveur** : `FEATURE_V2_LEAVES` (off par défaut).
**Coexistence** : `/api/leaves/*` v1 reste actif (endpoint POST
`/api/leaves/calculate` déjà côté serveur depuis Phase 2, self-service
`/api/leaves/mine`, admin `/api/leaves/balances`).

---

## Discovery

### `GET /api/v2/leaves/protocol`

Public (pas d'auth). Retourne `protocol_version`, `capabilities`,
`legacy_endpoints`, `docs`.

Si `FEATURE_V2_LEAVES` off : `404 FEATURE_DISABLED`.

---

## Calcul jours ouvrables — `POST /api/v2/leaves/calculate`

Authentifié. Miroir strict du POST v1 `/api/leaves/calculate` avec
payload standardisé `{success, data, meta}`.

### Body

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `startDate` | ISO date (YYYY-MM-DD) | ✅ | Début de la période. |
| `endDate` | ISO date | ✅ | Fin. |
| `startPeriod` | `AM`/`PM` | — | Défaut `AM`. |
| `endPeriod` | `AM`/`PM` | — | Défaut `PM`. |
| `leaveType` | string | — | Ex : `conge_paye`, `exceptionnel`. |
| `exceptionalType` | string | — | Ex : `mariage_salarie` (si `leaveType=exceptionnel`). |
| `requestDate` | ISO date | — | Défaut : aujourd'hui (pour `checkDeadline`). |

### Réponse 200

Cas standard :

```json
{
  "success": true,
  "data": {
    "workingDays": 5,
    "holidaysInPeriod": [{ "date": "2026-05-01", "name": "Fête du travail" }],
    "warnings": ["Cette période chevauche la fermeture annuelle (24/12 → 01/01)…"],
    "referencePeriod": { "start": "2025-06-01", "end": "2026-05-31", "label": "2025/2026" }
  },
  "meta": { "protocol_version": 1 }
}
```

Cas congé exceptionnel (durée légale fixe, aucun calcul de plage) :

```json
{
  "success": true,
  "data": {
    "workingDays": 4,
    "holidaysInPeriod": [],
    "warnings": [],
    "referencePeriod": { … },
    "isExceptional": true,
    "fixedDuration": true,
    "label": "Mariage du salarié",
    "requiresJustification": true
  }
}
```

### Erreurs

- `400 VALIDATION_ERROR` : `startDate` / `endDate` absent ou format
  non ISO, `startPeriod` / `endPeriod` hors {AM, PM}.

---

## Solde self-service — `GET /api/v2/leaves/balance/mine`

Authentifié. Retourne le solde de l'utilisateur connecté. Résolution
automatique `req.user.id → persons.user_id`.

### Query params

| Nom | Défaut | Description |
|-----|--------|-------------|
| `year` | année courante | Année du solde. |
| `type` | `conge_paye` | Type parmi `conge_paye`, `sans_solde`, `exceptionnel`, `maladie`, `parental`, etc. |

### Réponse 200

```json
{
  "success": true,
  "data": {
    "balance": {
      "person_id": 100,
      "year": 2026,
      "type": "conge_paye",
      "days_entitled": 30,
      "days_taken": 12,
      "days_remaining": 18,
      "exists": true
    }
  }
}
```

Si aucune ligne `leave_balances` n'existe encore pour ce couple
(nouveau salarié avant premier calcul d'acquisition) : `exists=false`
+ `days_entitled=0` + `days_taken=0` + `days_remaining=0` (au lieu de
404, comportement idempotent).

### Erreurs

- `404 NOT_FOUND` : l'utilisateur n'a pas de fiche `persons`
  associée (aucune `persons.user_id = req.user.id`).

---

## Solde admin — `GET /api/v2/leaves/balance/:person_id`

Authentifié + admin (si `requireAdmin` fourni au setup — la route est
publique aux authentifiés dans les tests).

Même contrat de query params et de réponse que `/balance/mine`. La
person_id doit être un entier > 0 sinon `400 VALIDATION_ERROR`.

---

## Reference

- `apps/api/services/leaves/rules.js` : constantes légales +
  `calcWorkingDays` + `checkDeadline` + `checkMainLeaveRule` +
  `isInClosurePeriod` + `getReferencePeriod` +
  `EXCEPTIONAL_LEAVE_DURATIONS`.
- `apps/api/services/leaves/calculate.js` : `calculateLeavePeriod`
  (orchestration).
- `apps/api/services/leaves/balance.js` : `getBalanceForPerson`,
  `resolvePersonIdFromUser`.
- `apps/api/v2/leavesRoutes.js` : namespace + gate + handler.
- `apps/api/leaveRoutes.js` : chemin v1 legacy conservé.

---

## Non couvert par T-P1-04

- **Écritures** (POST demandes, PUT statut, calcul acquisition
  automatique) : le v1 reste seul propriétaire pour éviter tout
  risque de double-écriture sur `leave_requests` et `leave_balances`.
  Un ticket ultérieur pourra migrer ces écritures en v2 avec
  transactions strictes.
- **Historique** des balances (audit trail) : hors scope.
- **Refactor UI** consommant les hooks v2 : ticket T-P1-04b
  (dogfooding via `FEATURE_V2_LEAVES=1` en dev requis d'abord).
