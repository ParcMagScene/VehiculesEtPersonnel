# Changelog Documentation — eM@g

Suivi de toutes les modifications de documentation.  
Format : [Keep a Changelog](https://keepachangelog.com)

---

## [1.2.1] — 2026-04-20

### Added
- `docs/api/sonos.md` — Documentation module Sonos (`/api/sonos`)
- `docs/api/suivi.md` — Documentation module Suivi personnel (`/api/suivi`)
- `docs/api/google.md` — Documentation module Google OAuth2 (`/api/google`)
- `docs/api/totp.md` — Documentation module 2FA TOTP (`/api/auth/2fa`)
- `scripts/check-doc-coherence.mjs` — Vérification automatisée docs ↔ code

### Changed
- `docs/API-INDEX.md` — Alignement des préfixes API actifs, modules manquants, stack et métriques
- `docs/api/README.md` — Ajout modules API actifs manquants + total endpoints mis à jour
- `README.md` — Structure monorepo corrigée (`apps/web`, `apps/api`) et commande de tests clarifiée
- `docs/03-Guides/GUIDE_DEVELOPPEUR.md` — Compteurs backend harmonisés
- `docs/01-Architecture/ARCHITECTURE.md` — Cohérence monorepo/API/DB, métriques et chemins ajustés
- `docs/02-Securite/SECURITY.md` — Historique sécurité harmonisé sur les métriques actuelles
- `docs/docs-index.json` — Regénération des métadonnées globales (date, modules, compteurs)
- `package.json` — Script `npm run docs:check`
- `docs/04-Operations/PLAN_MAINTENANCE.md` — Ajout de la vérification documentaire automatisée
- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/protect-prod.yml` — Exécution automatique de `npm run docs:check`
- `.husky/pre-push` — Blocage local du push si `npm run docs:check` échoue

### Notes
- La référence API exhaustive est désormais `docs/api/README.md` et les pages `docs/api/*.md`.

---

## [1.2.0] — 2026-04-08

### Changed
- `VERSION.md` — Version bump 2.0.0 → 2.1.0
- `PLAN_ACTION_EMAG.md` — 10 étapes exécutées, tâches cochées, faux positifs annotés
- `CHANGELOG_API.md` — Entrée [1.1.0] (sécurité + vidéo + imports)
- `CHANGELOG_UI.md` — Entrée [2.2.0] (useDirtyForm, RBAC mobile, planning, a11y, TV-client)
- `CHANGELOG_DB.md` — Entrée [1.1.0] (colonne channel cameras)
- `.github/workflows/ci.yml` créé (lint + test + build sur push/PR dev)

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
