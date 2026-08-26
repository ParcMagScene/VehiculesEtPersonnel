# 🔑 API Personal Actions — Authentification éphémère

> **Version** : 1.0.0
> **Sources** : `apps/api/personalActionsRoutes.js`, `apps/api/services/personalAuth.js`,
> `apps/api/services/personalActionHandlers.js`, `apps/api/schemas/auth.js`
> **Migration** : `apps/api/migrations/personal-actions-log-v1.js`
> **Dernière MÀJ** : voir CHANGELOG

---

## Vue d'ensemble

Permet au compte **Équipe partagé** (`commun@magsav.com` par défaut, configurable via
`TEAM_ACCOUNT_EMAIL`) de déclencher une **action personnelle** au nom d'un membre du
personnel, en se ré-authentifiant ponctuellement avec son **PIN** ou **mot de passe**.

Diffère de la session personnelle (`/api/suivi/personal-auth`) :

| | Session personnelle | Action éphémère |
|---|---|---|
| Endpoint | `POST /api/suivi/personal-auth` | `POST /api/personal-actions/perform` |
| Cas d'usage | Personnel consulte/modifie ses données librement sur tablette Équipe | Action ponctuelle (1 PIN = 1 action) depuis n'importe quel formulaire |
| Durée | Session 15 min, auto-logout après save | Aucune session, action puis terminé |
| Identité côté DB | `created_by` = utilisateur du personnel | `created_by` = utilisateur du personnel, `context_user_id` = compte Équipe loggé dans `personal_actions_log` |

Les deux mécanismes coexistent — choisir selon le besoin UX.

---

## Endpoint

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| POST | `/api/personal-actions/perform` | ✅ Équipe + PIN | Exécute une action au nom d'un personnel |

### Pré-requis serveur

- L'utilisateur connecté (cookie JWT) doit avoir `email === TEAM_ACCOUNT_EMAIL`
  → sinon `403 Cette opération est réservée au compte Equipe`.
- Rate limit dédié (`personalActionsLimiter` dans `config/rateLimiter.js`).
- Un handler doit être enregistré pour le `actionType` demandé.

---

## Requête

```jsonc
POST /api/personal-actions/perform
Content-Type: application/json
Cookie: token=<JWT compte Équipe>

{
  "personId": 42,             // entier > 0, id du membre du personnel
  "pin": "1234",              // OU
  "password": "monMotDePasse",// (l'un des deux est obligatoire)
  "actionType": "request_leave",
  "payload": { ... }          // dépend de actionType (voir handlers)
}
```

Schéma Zod : `personalActionPerformSchema` (`apps/api/schemas/auth.js`).

### Action types supportés

| `actionType` | Handler | Effet |
|---|---|---|
| `create_assignment` | `handleCreateAssignment` | Crée une `mission_assignments` confirmée pour la mission `payload.mission_id` |
| `request_leave` | `handleRequestLeave` | Crée une `leave_requests` (workflow approbation) |
| `declare_unavailability` | `handleDeclareUnavailability` | Crée une `availabilities` (auto-approuvée selon type) |

#### Payload — `create_assignment`

```jsonc
{
  "mission_id": 123,           // requis, entier > 0
  "status": "confirmed",       // ou "option" (défaut: "confirmed")
  "position": "Chef de projet",// optionnel
  "comment": "..."             // optionnel
}
```

#### Payload — `request_leave`

```jsonc
{
  "leaveType": "conge_paye",     // clé de LEAVE_TYPES
  "startDate": "2026-08-01",
  "endDate": "2026-08-15",
  "startPeriod": "AM",           // "AM" ou "PM"
  "endPeriod": "PM",             // "AM" ou "PM"
  "exceptionalType": null,       // requis si leaveType="exceptionnel"
  "employeeComment": "Vacances",
  "signatureEmployee": "data:image/png;base64,..."
}
```

#### Payload — `declare_unavailability`

```jsonc
{
  "type": "absence",            // VALID_AVAILABILITY_TYPES
  "startDate": "2026-08-01",
  "endDate": "2026-08-02",
  "startPeriod": "AM",
  "endPeriod": "PM",
  "comment": "RDV médical"
}
```

---

## Réponse

### Succès — `200 OK`

```jsonc
{
  "success": true,
  "person": {
    "id": 42,
    "first_name": "Alice",
    "last_name": "Martin"
  },
  "actionType": "request_leave",
  "result": { /* entité créée par le handler */ }
}
```

### Erreurs

| Code HTTP | Cas |
|---|---|
| `400` | Payload invalide (validation Zod, dates incohérentes, type de congé inconnu) |
| `401` | PIN ou mot de passe incorrect (message générique « Identifiants incorrects ») |
| `401` | Compte personnel verrouillé (trop de tentatives) |
| `403` | Le compte appelant n'est pas le compte Équipe |
| `403` | Compte personnel en lecture seule |
| `404` | Personne ou mission introuvable |
| `409` | Conflit : affectation existante / chevauchement de congés |
| `422` | `actionType` non supporté (aucun handler enregistré) |
| `429` | Rate limit dépassé |
| `500` | Erreur handler inattendue |

Toutes les erreurs renvoient `{ "success": false, "error": "..." }`.

---

## 🔒 Sécurité — invariant clé

> **Tous les handlers FORCENT `person_id` depuis le contexte d'authentification PIN.**
> Le `payload` ne peut **jamais** surcharger cette valeur.

Conséquence : un opérateur sur le compte Équipe ne peut pas :
- créer un congé pour un autre personnel que celui dont il a saisi le PIN ;
- déclarer une indisponibilité au nom d'un tiers ;
- s'auto-affecter à une mission au nom de quelqu'un d'autre.

Voir aussi `SECURITY.md` (§ Personal Actions Audit).

### Audit

Chaque tentative (succès ou échec) est journalisée dans `personal_actions_log` :

| Colonne | Description |
|---|---|
| `context_user_id` | ID de l'utilisateur compte Équipe loggé |
| `personal_user_id` | ID du compte utilisateur du personnel (si identifié) |
| `person_id` | ID `personnel.id` cible |
| `action_type` | `create_assignment` / `request_leave` / `declare_unavailability` |
| `target_type`, `target_id` | Entité créée (en cas de succès) |
| `payload_summary` | JSON tronqué à 1000 chars, sans `pin`/`password` |
| `success` | 0 ou 1 |
| `error_code` | `INVALID_CREDENTIALS`, `READ_ONLY`, `NOT_IMPLEMENTED`, `LEAVE_OVERLAP`, etc. |
| `ip`, `user_agent` | Origine de la requête |
| `created_at` | Timestamp UTC |

Les payloads sensibles (`pin`, `password`, `password_hash`) sont **toujours retirés** avant log.

---

## Côté frontend

- Hook `usePersonalActionGuard` (`apps/web/src/hooks/usePersonalActionGuard.js`) :
  - Si compte personnel → exécute la callback `direct` (action directe).
  - Si compte Équipe → ouvre `PersonalActionDialog` (PIN), puis appelle `personalActions.perform()`.
  - Callback `onCancel` pour rollback côté appelant si l'utilisateur ferme la modal.
- Composant `PersonalActionDialog` (`apps/web/src/components/auth/PersonalActionDialog.jsx`).
- Client API : `apps/web/src/utils/api/personalActions.js`.

### Composants câblés

| Composant | Action(s) déclenchée(s) |
|---|---|
| `LeaveRequestForm` | `request_leave` |
| `PeriodCalendarModal` | `declare_unavailability` |
| `AssignmentDialog` | `create_assignment` (rollback `deleteMission` si PIN annulé ; multi-affectation bloquée) |

---

## Tests

- Backend : `tests/personal-actions.test.js` — 30 tests (20 infra + 10 handlers).
- Frontend : `apps/web/src/test/usePersonalActionGuard.test.jsx` — 7 tests.
- Détection compte Équipe : `apps/web/src/test/isTeamAccountEmail.test.js` — 3 tests.

---

## Configuration

| Variable | Défaut | Description |
|---|---|---|
| `TEAM_ACCOUNT_EMAIL` | `commun@magsav.com` | Email du compte Équipe partagé |

Côté frontend : `VITE_TEAM_ACCOUNT_EMAIL` (lu dans `AuthContext.jsx`).
