# Changelog API — eM@g

Toutes les modifications d'endpoints API sont listées ici.  
Format : [Keep a Changelog](https://keepachangelog.com)

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
