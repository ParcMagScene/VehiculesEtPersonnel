# Changelog — eM@g

Changelog global unifié du projet eM@g.  
Format : [Keep a Changelog](https://keepachangelog.com) + [Semantic Versioning](https://semver.org/)

> Changelogs détaillés :  
> [API](docs/06-Changelog/CHANGELOG_API.md) · [DB](docs/06-Changelog/CHANGELOG_DB.md) · [UI](docs/06-Changelog/CHANGELOG_UI.md) · [Docs](docs/06-Changelog/CHANGELOG_DOCS.md) · [Prompts](prompts/CHANGELOG_PROMPTS.md) · [Sécurité](CHANGELOG_SECURITY.md)

---

## [2.1.0] — 2026-04-07

### Changed
- **Phase B (QUALITY)** : Migration de 28 appels `fetch()` directs vers la couche de service API centralisée
  - 10 composants migrés : Calendar, ReservationModal, EventDetailsModal, LoginForm, AccessRequestModal, ProfileEditModal, AffaireDetailPanel, AffaireImportModal, MobileLogin, TripDetailsModal
  - 14 nouvelles méthodes API ajoutées (vehicles, affaires, admin, base)
  - Suppression des imports `getApiUrl` inutilisés dans 5 fichiers
  - Gestion d'erreurs unifiée via le client API (auth, 401/403, camelCase)

---

## [2.0.0] — 2026-04-07

### Added
- **Gouvernance Open-Source** — GOVERNANCE.md, CODE_OF_CONDUCT.md, CODING_STANDARDS.md, ROADMAP.md
- **Templates GitHub** — Bug report, feature request, security report, PR template, CODEOWNERS
- **Versioning Continu** — Protocole 9 étapes pour suivi automatique des versions
- **Documentation Continue** — 41 fichiers de documentation technique (API, DB, modules, workflows, règles métier)
- **Audit sécurité** — 88 vulnérabilités identifiées, 19 corrigées (Phases 1-4)
- VERSION.md — Fichier de version globale
- versions.json — Index centralisé des versions
- CHANGELOG.md — Ce fichier (changelog global unifié)
- CHANGELOG_UI.md — Changelog frontend

### Changed
- Migration monorepo (apps/api + apps/web + apps/tv-client)
- package.json → v2.0.0
- docs/README.md enrichi avec sections API, DB, modules, workflows, règles

### Security
- **Phase 1 (CRIT)** : TV auth, JWT_SECRET validation, SMTP chiffrement, anti-self-approval, Bearer fix
- **Phase 2 (HIGH)** : PII removal, password policy ≥10, reservation conflicts, bcrypt 6.0
- **Phase 3 (MED)** : DOMPurify, IndexedDB cleanup, rate limiters, SAV state machine, double assign, VIDEO_CIPHER_KEY
- **Phase 4 (LOW)** : getHistory LIMIT, SVG blocked, messaging fileFilter MIME allowlist
- **Phase A (QUALITY)** : Paramétrage LIKE stockRoutes (template literal → prepared), auth ajoutée sur GET /api/display/welcome-message

### Modules impactés
- auth, vehicles, personnel, equipment, affaires, orders, stock, planning
- messaging, leaves, annuaire, video, display, attachments, supplier-catalog, mailing, inventory

---

## [1.0.0] — 2025

### Added
- Version initiale — Gestion véhicules, personnel, matériel pour le spectacle vivant
- Stack : Express.js ESM + better-sqlite3 + React + Vite
- 87 tables SQLite, ~243 endpoints API
- Design System (43 composants, 380+ tokens CSS)
- 9 prompts maîtres versionnés
