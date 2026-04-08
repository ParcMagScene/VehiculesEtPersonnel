# Changelog Documentation — eM@g

Suivi de toutes les modifications de documentation.  
Format : [Keep a Changelog](https://keepachangelog.com)

---

## [1.1.0] — 2026-04-08

### Added
- `PLAN_ACTION_EMAG.md` — Plan d'action global 49 issues (5 CRIT, 21 HIGH, 18 MED, 5 LOW)
- Section « Routes dépréciées » dans `API-INDEX.md` (legacy `/api/clients`, `/api/drivers`, `/api/locations`, `/api/garages`)
- 4 variables manquantes dans `.env.example` (DB_PATH, ALLOW_HTTP, MEDIAMTX_API_URL, MEDIAMTX_WEBRTC_URL)

### Changed
- `VERSION.md` — Version alignée sur package.json (2.1.9 → 2.0.0)
- `SECURITY_AUDIT.md` — Marqué comme déprécié (supplanté par AUDIT.md Partie II)

### Security
- Rate limiter ajouté sur `/api/auth/check-reset` (commit `3f89572`)
- Réponse anti-énumération sur `/api/auth/check-reset`
- Blocage SSRF IPv6 dans videoProxyService.js
- Validation base64 des champs signature dans sanitize.js
- Whitelist des champs SQL dynamiques dans planningRoutes.js

---

## [1.0.0] — 2026-04-07

### Added
- `docs/api/` — 16 fichiers documentant ~243 endpoints API
- `docs/database/` — 2 fichiers (README + SCHEMA détaillé 87 tables)
- `docs/modules/` — 16 fichiers documentant les modules frontend React
- `docs/workflows/` — Machines d'état (commandes, SAV, missions, congés, etc.)
- `docs/business-rules/` — Règles métier consolidées (IDCC 3252, SIRET, mdp, etc.)
- `docs/06-Changelog/CHANGELOG_API.md` — Changelog API
- `docs/06-Changelog/CHANGELOG_DB.md` — Changelog DB
- `docs/06-Changelog/CHANGELOG_UI.md` — Changelog UI
- `docs/06-Changelog/CHANGELOG_DOCS.md` — Ce fichier
- `docs/docs-index.json` — Index machine-readable
- **Gouvernance** : GOVERNANCE.md, CODE_OF_CONDUCT.md, CODING_STANDARDS.md, ROADMAP.md
- **Templates GitHub** : bug_report.md, feature_request.md, security_report.md, PR template, CODEOWNERS
- **Versioning** : VERSION.md, CHANGELOG.md, versions.json
