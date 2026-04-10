# Changelog API — eM@g

Toutes les modifications d'endpoints API sont listées ici.  
Format : [Keep a Changelog](https://keepachangelog.com)

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
