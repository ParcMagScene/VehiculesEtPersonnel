# Changelog API — eM@g

Toutes les modifications d'endpoints API sont listées ici.  
Format : [Keep a Changelog](https://keepachangelog.com)

---

## [1.7.0] — 2026-07-09

### Added — Planning v2 events + affaires (lecture) — T-P0-05 étendu

- **`GET /api/v2/planning/events`** : lecture cursor-based des événements
  d'affichage dynamique (`dynamic_display_events`). Filtres serveur :
  `type`, `category`, `status`, `affaire_id`, `visible`, `date_from`,
  `date_to`. Ordre `date DESC, id DESC`. Limite défaut 100, max 200.
  Service `listEvents({ db, filters, cursor, limit })`. Exclut les
  événements sans date (cohérent avec le contrat cursor-based tasks).
- **`GET /api/v2/planning/affaires`** : liste offset-based des affaires
  côté planning avec statut cycle (`planning_affaire_status.status`) et
  indicateur de visibilité (`is_hidden`). Filtres : `date_from`,
  `date_to` (chevauchement), `include_hidden`. Limite défaut 200,
  max 1000. Service `listPlanningAffaires({ db, dateFrom, dateTo, includeHidden, limit, offset })`.
  Ne calcule pas les compteurs consolidés (réservations, personnel,
  matériel, BL, commandes) — à venir dans un ticket ultérieur.
- Constantes exportées : `EVENTS_LIMIT_DEFAULT`, `EVENTS_LIMIT_MAX`,
  `PLANNING_AFFAIRES_LIMIT_DEFAULT`, `PLANNING_AFFAIRES_LIMIT_MAX`.

### Coexistence

Mêmes règles qu'en T-P0-03 : `FEATURE_V2_PLANNING` off = 404. Tables v1
partagées (aucune duplication).

Voir aussi : [../api/v2/planning.md](../api/v2/planning.md),
[EXECUTION_PLAN_EMAG_3_0.md](../../EXECUTION_PLAN_EMAG_3_0.md) T-P0-05
(étendu).

---

## [1.6.0] — 2026-07-09

### Added — Planning v2 batch / clear-completed / rollover (T-P0-04 étendu)

- **`POST /api/v2/planning/tasks/batch`** : création atomique d'un lot de
  tâches (1..100 items). Rollback complet si un item est invalide.
  Zod `createTasksBatchSchema`. Service `createTasksBatch({ db, items, createdBy })`.
- **`POST /api/v2/planning/tasks/clear-completed`** : suppression des tâches
  `status='done'`. Filtres optionnels `date` (borne exacte), `date_before`
  (borne haute exclusive), `section`. Sans filtre = purge globale des
  tâches done (admin uniquement). Zod `clearCompletedTasksSchema`.
  Service `clearCompletedTasks({ db, date, dateBefore, section })`.
- **`POST /api/v2/planning/tasks/rollover`** : déplace les tâches
  non-terminées d'une date source vers une date cible (défaut = J+1 via
  `addOneDayToDateStr` de `services/planningRolloverHelpers.js`).
  Statuts éligibles par défaut : `pending`, `in_progress`. Zod
  `rolloverTasksSchema`. Service `rolloverIncompleteTasks({ db, fromDate, toDate, eligibleStatuses, modifiedBy })`.
- Constante `CREATE_TASKS_BATCH_MAX = 100` exportée.
- Toutes les mutations en transaction atomique (`db.transaction`).

### Coexistence

Mêmes règles qu'en T-P0-04 : `FEATURE_V2_PLANNING` off = 404 pour les 3
endpoints. `task_assignments` partagée v1/v2.

Voir aussi : [../api/v2/planning.md](../api/v2/planning.md),
[EXECUTION_PLAN_EMAG_3_0.md](../../EXECUTION_PLAN_EMAG_3_0.md) T-P0-04.

---

## [1.5.0] — 2026-07-08

### Added — Planning v2 API mutations tasks (T-P0-04)

- **`POST /api/v2/planning/tasks`** : création. `id` auto-généré côté SQLite
  (`lower(hex(randomblob(16)))`). `date` requis. `section` défault `manual`,
  `status` défault `pending`, `visible` défault `1`. Renvoie 201 + payload
  complet.
- **`GET /api/v2/planning/tasks/:id`** : détail. 404 si absent.
- **`PUT /api/v2/planning/tasks/:id`** : mise à jour partielle. Validation
  Zod stricte (schemas/planningV2.js). Transitions de statut validées
  serveur via `TASK_STATUS_TRANSITIONS` :
  - `pending` → `in_progress`, `done`, `cancelled`
  - `in_progress` → `pending`, `done`, `cancelled`
  - `done` → `in_progress`, `pending`
  - `cancelled` → `pending`, `in_progress`
  Toute transition non déclarée renvoie 400 `PLANNING_V2_VALIDATION` +
  `meta.field = "status"`. `modified_at` et `modified_by` mis à jour
  automatiquement.
- **`DELETE /api/v2/planning/tasks/:id`** : suppression. Idempotent (404
  si déjà supprimée).

### Coexistence

Mêmes règles qu'en T-P0-03 : `FEATURE_V2_PLANNING` off = 404
`FEATURE_DISABLED`. Table `task_assignments` partagée avec v1 (double-écriture
naturelle, pas de duplication de table à ce stade). Les mutations v2 sont
donc visibles en v1 immédiatement.

Voir aussi : [../api/v2/planning.md](../api/v2/planning.md),
[EXECUTION_PLAN_EMAG_3_0.md](../../EXECUTION_PLAN_EMAG_3_0.md) T-P0-04.

---

## [1.4.0] — 2026-07-08

### Added — Planning v2 API lecture (T-P0-03)

- **Nouveau namespace** `/api/v2/*` (coexistence stricte avec `/api/*` v1).
- **Nouvel endpoint** `GET /api/v2/planning/tasks` :
  - Pagination **cursor-based** (opaque base64url, keyset sur `(date, id)`).
  - Ordre `date DESC, id DESC`. Limite : défaut 100, max 200.
  - Filtres serveur : `person_id`, `section`, `date_from`, `date_to`,
    `status`, `visible`, `affaire_num`. Validation stricte serveur.
  - Format réponse v2 unifié : `{ success, data, meta }` avec
    `meta.protocol_version`, `meta.pagination.{cursor,next_cursor,limit,has_more}`,
    `meta.count`.
- **Feature flag serveur** `FEATURE_V2_PLANNING` (env, off par défaut).
  Route renvoie **404 `FEATURE_DISABLED`** si le flag est off — l'existence
  de la route n'est pas divulguée derrière le flag. Voir
  `apps/api/middleware/featureFlag.js`.
- **Nouveaux utilitaires backend** :
  - `apps/api/utils/cursor.js` — encode/decode cursor opaque.
  - `apps/api/utils/apiV2Response.js` — helpers `sendV2Success`,
    `sendV2Error`, `buildV2Pagination`, `API_V2_PROTOCOL_VERSION`.
  - `apps/api/middleware/featureFlag.js` — guard générique env-driven.
- **Nouveau routeur** `apps/api/v2/planningRoutes.js` monté après
  `setupPlanningRoutes` v1 dans `server.js` (jamais avant, pour préserver
  l'ordre de chargement v1).
- **Service** `listTasks` implémenté dans `apps/api/services/planning/tasks.js`
  (fonction pure, `db` injecté, validation via `PlanningV2ValidationError`).

### Coexistence

- Aucune route v1 modifiée ou supprimée.
- Aucun champ v1 renommé.
- La v2 est totalement inerte tant que `FEATURE_V2_PLANNING` n'est pas
  explicitement activé côté environnement.

Voir aussi : [../api/v2/planning.md](../api/v2/planning.md),
[../05-Specs/PLANNING_V2.md](../05-Specs/PLANNING_V2.md),
[EXECUTION_PLAN_EMAG_3_0.md](../../EXECUTION_PLAN_EMAG_3_0.md) T-P0-03.

---

## [1.3.0] — 2026-06-XX

### Added
- **Auth éphémère « actions personnelles »** :
  `POST /api/personal-actions/perform` — permet au compte Équipe partagé
  (`commun@magsav.com`, configurable via `TEAM_ACCOUNT_EMAIL`) d'exécuter
  une action au nom d'un personnel via PIN/mot de passe ponctuel, sans
  changer de session JWT.
  Voir [docs/api/personal-actions.md](../api/personal-actions.md).
- Migration `personal-actions-log-v1.js` — table `personal_actions_log`
  (audit succès/échec : `context_user_id`, `personal_user_id`, `person_id`,
  `action_type`, `target_type`, `target_id`, `payload_summary`, `success`,
  `error_code`, `ip`, `user_agent`).
- Schéma Zod `personalActionPerformSchema` (`apps/api/schemas/auth.js`)
  validant `actionType ∈ {create_assignment, request_leave, declare_unavailability}`
  et exigeant PIN OU password.
- Service `services/personalAuth.js` (`verifyPersonalCredentials`) :
  vérification PIN/mot de passe avec verrouillage compte.
- Service `services/personalActionHandlers.js` :
  3 handlers (`handleCreateAssignment`, `handleRequestLeave`,
  `handleDeclareUnavailability`).
- Rate limiter dédié `personalActionsLimiter` (`config/rateLimiter.js`).

### Security
- **Invariant clé** : tous les handlers forcent `person_id` depuis le
  contexte d'authentification PIN — le `payload` ne peut jamais surcharger
  cette valeur. Voir `SECURITY.md`.
- Le compte appelant doit être `TEAM_ACCOUNT_EMAIL` (sinon `403`).
- Comptes en lecture seule rejetés (`READ_ONLY`).
- Audit obligatoire (succès et échec) ; payloads expurgés de `pin`,
  `password`, `password_hash` avant log, tronqués à 1000 chars.
- Message d'erreur générique « Identifiants incorrects » pour brute-force.

### Tests
- `tests/personal-actions.test.js` — 30 tests
  (20 infrastructure + 10 handlers métier). Suite backend : 171/171.

---

## [1.2.0] — 2026-04-11

### Added
- `googleBidirectionalSync.js` : service complet de synchronisation bidirectionnelle Google Calendar (push + pull)
- `syncReservationToGoogle()` / `deleteReservationFromGoogle()` — push automatique sur CRUD réservations
- `pullReservationsFromGoogle()` — réconciliation Google → eM@g avec fenêtre -7j/+90j et pagination
- `buildGoogleEventPayload()` — mapping réservation → événement Google (all-day vs dateTime, AM/PM)
- `listGoogleEventsInWindow()` — fetch paginé des événements Google Calendar
- `parseGoogleEventDates()` / `parsePeriodFromDateTime()` — parsing dates Google vers format eM@g
- Endpoint `POST /api/google/sync/pull-reservations` dans `googleRoutes.js`
- Feature flag `GOOGLE_BIDIRECTIONAL_SYNC` (défaut `false`) pour activation contrôlée
- Propriétés privées Google `emagReservationId` + `emagSource` pour traçabilité

### Changed
- `vehicleRoutes.js` : hooks async `syncReservationToGoogle` / `deleteReservationFromGoogle` sur POST/PUT/DELETE réservations (best-effort)

---

## [1.1.1] — 2026-04-10

### Fixed
- `schemas/imports.js` : middleware `validate()` rendu compatible Zod (`error.issues` + fallback `error.errors`) pour éviter `TypeError: undefined.map` sur `PUT /api/reservations/:id`.
- `vehicleRoutes.js` : mise à jour réservation non bloquée admin-only, accès ouvert aux utilisateurs non `read_only` via middleware dédié.

### Added
- `authorize.js` : nouveau middleware `requireNotReadOnly`.
- `authorize.js` : ajout de `read_only` à la whitelist des permissions validées.

---

## [1.1.0] — 2026-04-08

### Security
- Rate limiter `sensitiveEndpointLimiter` sur `/api/auth/check-reset`
- Réponse anti-énumération sur check-reset (masque l'existence du compte)
- Blocage SSRF IPv6 dans `videoProxyService.js`
- Validation base64 des signatures dans `sanitize.js`
- Whitelist SQL champs dynamiques dans `planningRoutes.js`

### Changed
- Import équipement preview : retourne détail collisions par item (toCreate/toUpdate/toSkip)
- Routes vidéo : champ `channel` ajouté dans SELECT/INSERT/UPDATE caméras
- Channel caméra configurable (1-64) au lieu de hardcodé à 1

---

## [1.0.0] — 2026-04-07

### Initial
- Documentation initiale de ~243 endpoints répartis sur 16 modules
- Phase 1 (CRIT) : TV auth, JWT validation, SMTP chiffrement, anti-self-approval, Bearer fix
- Phase 2 (HIGH) : PII removal users-public, password policy, reservation conflicts, bcrypt 6.0
- Phase 3 (MED) : DOMPurify, rate limiters, SAV state machine, double equipment assign, VIDEO_CIPHER_KEY
- Phase 4 (LOW) : getHistory LIMIT, SVG blocked, messaging fileFilter (MIME allowlist + 25Mo + sanitize)

## [1.0.1] — 2026-04-07

### Security
- `stockRoutes.js` : LIKE query paramétrisée (template literal → prepared statement)
- `displayRoutes.js` : authenticateToken ajouté sur GET /api/display/welcome-message
