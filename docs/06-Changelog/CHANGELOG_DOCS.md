# Changelog Documentation — eM@g

Suivi de toutes les modifications de documentation.  
Format : [Keep a Changelog](https://keepachangelog.com)

---

## [1.6.0] — 2026-07-09

### Changed — Planning v2 : bascule Phase B (dogfooding dev)

- `docs/05-Specs/PLANNING_V2_SUNSET_PLAN.md` (version 0.2.0) :
  - En-tête : statut `Préparation — non appliqué` → `Phase B — dogfooding
    dev en cours (depuis 2026-07-09)`.
  - §2 État actuel : ajout des lignes `FEATURE_V2_PLANNING dev = 1` et
    `FEATURE_V2_PLANNING prod = OFF (P0-DECISION-1 non validée)`.
  - Mention de la ré-exécution du parity-check (19/19 OK) sur la DB dev
    fusionnée après le merge des 11 branches `emag30/p0/*` dans `dev`.

Aucun changement de contenu métier ou de protocole. La Phase C (activation
prod) reste conditionnée à `P0-DECISION-1` explicite.

Voir aussi : [../05-Specs/PLANNING_V2_SUNSET_PLAN.md](../05-Specs/PLANNING_V2_SUNSET_PLAN.md).

---

## [1.5.0] — 2026-07-09

### Added — Affaires v2 backfill dry-run (T-P0-07, non-destructif)

- `docs/05-Specs/AFFAIRES_V2.md` : design doc du plan Affaires v2
  (backfill dry-run T-P0-07 → matérialisation T-P0-08 → sunset TEXT T-P0-09).
  Sources d'implicites recensées : `reservations.affaire`, `missions.affaire`,
  `orders.affaire_id`, `bl_imports.affaire_id`,
  `dynamic_display_events.affaire_id`, `equipment_assignments.affaire_id`.
- `scripts/affaires-v2-backfill.mjs` : script read-only qui recense les
  affaires implicites (référencées ailleurs, absentes de `affaires`) et
  propose un payload de matérialisation minimal (client, dates min/max,
  prestation). Rapport JSON. Exit 1 si implicites détectées.
  Le flag `--apply` est refusé volontairement — la matérialisation
  transactionnelle relève du ticket T-P0-08.

Exécution dev : 12 affaires implicites détectées, payloads cohérents.
Aucune modification code exécutable prod. Aucun INSERT.

Voir aussi : [../05-Specs/AFFAIRES_V2.md](../05-Specs/AFFAIRES_V2.md),
[EXECUTION_PLAN_EMAG_3_0.md](../../EXECUTION_PLAN_EMAG_3_0.md) T-P0-07.

---

## [1.4.0] — 2026-07-09

### Added — Planning v2 Sunset Plan (T-P0-06, préparation non-destructive)

- `docs/05-Specs/PLANNING_V2_SUNSET_PLAN.md` : protocole de bascule
  progressive v1 → v2 en 4 phases (parity-check, dogfooding, activation
  prod, sunset v1). Documente les prérequis `P0-DECISION-1` et
  `P0-DECISION-2`, les critères de sortie de chaque phase, la
  checklist pré-cutover, la checklist pré-sunset et le rollback plan.
- `scripts/planning-v2-parity-check.mjs` : script dry-run de
  vérification de parité de lecture v1 ↔ v2 sur la DB courante.
  Aucune écriture. Exit 1 si divergences non expliquées.

Aucune modification code exécutable de production.
`FEATURE_V2_PLANNING` reste OFF par défaut. `planningRoutes.js` v1 intact.

Voir aussi : [../05-Specs/PLANNING_V2.md](../05-Specs/PLANNING_V2.md),
[../api/v2/planning.md](../api/v2/planning.md),
[EXECUTION_PLAN_EMAG_3_0.md](../../EXECUTION_PLAN_EMAG_3_0.md) T-P0-06.

---

## [1.3.0] — 2026-06-XX

### Added
- `docs/api/personal-actions.md` — Documentation complète de l'endpoint
  `POST /api/personal-actions/perform` (auth éphémère par action) :
  pré-requis serveur, schéma de requête, payloads des 3 handlers
  (`create_assignment`, `request_leave`, `declare_unavailability`),
  codes d'erreur, invariant de sécurité, audit `personal_actions_log`,
  intégration frontend.
- `docs/api/README.md` — Référencement du nouveau module dans l'index.

### Changed
- `SECURITY.md` — Section « Authentification éphémère » : invariant
  `person_id` forcé depuis le contexte PIN, mesures associées (rate
  limit dédié, comptes read-only rejetés, audit obligatoire avec
  expurgation `pin`/`password`/`password_hash`).
- `CHANGELOG_API.md` — Entrée [1.3.0].
- `CHANGELOG_UI.md` — Entrée [2.4.0].

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
