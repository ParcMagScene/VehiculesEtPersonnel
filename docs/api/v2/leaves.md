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

---

## Dogfooding UI (T-P1-04b — 2026-07-10)

Le composant `apps/web/src/components/leaves/LeaveRequestForm.jsx`
bascule sur `POST /api/v2/leaves/calculate` lorsque le flag Vite
`VITE_FEATURE_V2_LEAVES` est activé (`=1` / `true` / `on` / `yes`,
case-insensitive). Fallback silencieux v1 sur `FEATURE_DISABLED`
(404) ou erreur réseau.

Chemin technique côté client :

- `apps/web/src/utils/leaves/v2Adapters.js` :
  `readLeavesV2ClientFlag(env)` + `adaptV2CalculationToV1` (identity
  passthrough — le service v2 retourne déjà camelCase).
- `apps/web/src/utils/leaves/fetchLeaveCalculation.js` :
  `fetchLeaveCalculationUnified(api, data, { useV2 })` avec
  fallback strict v1 en cas d'échec v2.
- `LeaveRequestForm.jsx` : appel unique passé de
  `api.calculateLeaveWorkingDays(...)` à
  `fetchLeaveCalculationUnified(api, ..., { useV2: readLeavesV2ClientFlag() })`.

Périmètre :

- **Uniquement le calcul jours ouvrables** (`POST /calculate`) est
  dogfoodé. Les soldes (`GET /balance/mine`, `GET /balance/:id`)
  restent sur v1 : les composants tolèrent déjà les deux shapes
  (`balance.daysEntitled ?? balance.days_entitled`,
  `balance.carryOver ?? balance.carry_over`), et l'affichage
  fonctionne sans changement. Un T-P1-04c ultérieur pourra
  dogfooder les balances explicitement.
- Aucune modification du flow POST (création de demande), qui
  reste sur `api.createLeaveRequest` v1.

Tests de non-régression :

- `apps/web/src/utils/leaves/v2Adapters.test.js` (6 cas).
- `apps/web/src/utils/leaves/fetchLeaveCalculation.test.js` (6 cas).
