# Changelog API — eM@g

Toutes les modifications d'endpoints API sont listées ici.  
Format : [Keep a Changelog](https://keepachangelog.com)

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
