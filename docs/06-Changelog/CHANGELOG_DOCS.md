# Changelog Documentation — eM@g

Suivi de toutes les modifications de documentation.  
Format : [Keep a Changelog](https://keepachangelog.com)

---

## [1.28.0] — 2026-07-10

### Added — Equipment UID v2 : section Dogfooding UI (T-P1-06b)

- **`docs/api/v2/equipment-uid.md`** : ajout section **Dogfooding
  UI Fondations (T-P1-06b)** documentant helpers admin
  (`fetchEquipmentUidAuditUnified`, `regenerateEquipmentUidUnified`)
  et l'inventaire des 21 tests. Note explicite : distinct du
  T-P1-06b renforcement UNIQUE DB.
- **`docs/06-Changelog/CHANGELOG_UI.md`** : entry 2.22.0.

---

## [1.27.0] — 2026-07-10

### Added — Conflicts v2 : section Dogfooding UI (T-P1-05b)

- **`docs/api/v2/conflicts.md`** : ajout section **Dogfooding UI
  (T-P1-05b)** documentant les fondations (helpers +
  `useConflictsPrecheck`), la stratégie `available=false` pour
  signaler l'indisponibilité du pré-check, et l'inventaire des
  21 tests unitaires.
- **`docs/06-Changelog/CHANGELOG_UI.md`** : entry 2.21.0.

---

## [1.26.0] — 2026-07-10

### Added — Leaves v2 : section Dogfooding UI (T-P1-04b)

- **`docs/api/v2/leaves.md`** : ajout section **Dogfooding UI
  (T-P1-04b)** documentant `fetchLeaveCalculationUnified`, le
  fallback silencieux v1, le périmètre restreint au calcul jours
  ouvrables et l'inventaire des 12 tests unitaires ajoutés.
- **`docs/06-Changelog/CHANGELOG_UI.md`** : entry 2.20.0.

---

## [1.25.0] — 2026-07-10

### Added — Affaires v2 : section Dogfooding UI (T-P0-09b)

- **`docs/api/v2/affaires.md`** : ajout section **Dogfooding UI
  (T-P0-09b)** documentant le chemin `affairesLoader` →
  `fetchAffairesListV2` → adapters, le fallback silencieux v1,
  la différence de comportement sur les affaires auto-détectées
  (`source='auto'`, `id=null`) et l'inventaire des 25 tests
  unitaires ajoutés.
- **`docs/06-Changelog/CHANGELOG_UI.md`** : entry 2.19.0.

---

## [1.24.0] — 2026-07-10

### Added — Orders v2 : sections T-P1-10 dans `docs/api/v2/orders.md`

- **`docs/api/v2/orders.md`** : ajout sections **T-P1-10 réception
  partielle détaillée** + **conversion devis → commande** (avec
  exemples 201/400/404/409 et section migration `order_receptions`).
- **`docs/06-Changelog/CHANGELOG_API.md`** : entry 1.22.0.
- **`docs/06-Changelog/CHANGELOG_DB.md`** : entry 1.9.0.

---

## [1.23.0] — 2026-07-10

### Added — Orders v2 : `docs/api/v2/orders.md` (T-P1-09)

- **`docs/api/v2/orders.md`** (nouveau) : matrices order/quote +
  exemples 200/400/404/409.
- **`docs/api/v2/README.md`** : ajout ligne **Orders** 🟢.
- **`apps/api/.env.example`** : documente `FEATURE_V2_ORDERS`.

---

## [1.22.0] — 2026-07-10

### Added — Equipment Assignments v2 : `docs/api/v2/equipment-assignments.md` (T-P1-08)

- **`docs/api/v2/equipment-assignments.md`** (nouveau) : contrat
  double-assign bloquée + audit trail + exemples 201/400/404/409.
- **`docs/api/v2/README.md`** : ajout ligne **Equipment
  Assignments** 🟢.
- **`apps/api/.env.example`** : documente
  `FEATURE_V2_EQUIPMENT_ASSIGNMENTS`.

---

## [1.21.0] — 2026-07-10

### Added — SAV v2 : `docs/api/v2/sav.md` (T-P1-07)

- **`docs/api/v2/sav.md`** (nouveau) : machine d'état + pièces
  détachées + exemples 200/201/400/404/409.
- **`docs/api/v2/README.md`** : ajout ligne **SAV** 🟢.
- **`apps/api/.env.example`** : documente `FEATURE_V2_SAV`.

---

## [1.20.0] — 2026-07-10

### Added — Equipment UID v2 : `docs/api/v2/equipment-uid.md` (T-P1-06)

- **`docs/api/v2/equipment-uid.md`** (nouveau) : référence complète
  du namespace `/api/v2/equipment-uid/*` (audit + regenerate).
- **`docs/api/v2/README.md`** : ajout ligne **Equipment UID** 🟢.
- **`apps/api/.env.example`** : documente
  `FEATURE_V2_EQUIPMENT_UID`.

---

## [1.19.0] — 2026-07-10

### Added — Conflicts v2 : `docs/api/v2/conflicts.md` (T-P1-05)

- **`docs/api/v2/conflicts.md`** (nouveau) : référence complète du
  namespace `/api/v2/conflicts/*` (2 endpoints + sources scannées +
  exclude self-check + exemples).
- **`docs/api/v2/README.md`** : ajout ligne **Conflicts** 🟢.
- **`apps/api/.env.example`** : documente `FEATURE_V2_CONFLICTS`.

---

## [1.18.0] — 2026-07-10

### Added — Leaves v2 : `docs/api/v2/leaves.md` (T-P1-04)

- **`docs/api/v2/leaves.md`** (nouveau) : référence complète du
  namespace `/api/v2/leaves/*` (4 endpoints + exemples).
- **`docs/api/v2/README.md`** : ajout ligne **Leaves** 🟢.
- **`apps/api/.env.example`** : documente `FEATURE_V2_LEAVES`.

---

## [1.17.0] — 2026-07-10

### Added — Personnel v2 : audit drivers ↔ persons (T-P1-03)

- **`scripts/personnel-v2-drivers-audit.mjs`** (nouveau) : script
  read-only dry-run recensant les drivers orphelins (aucune ligne
  `persons.driver_id` associée) et les persons rattachées via
  `driver_id`. Exit code 0 si sunset destructif safe, 1 si
  décision requise.
- **`tests/api-smoke/personnel-v2-drivers-audit.test.js`** (nouveau,
  4 subtests) : couvre orphelins détectés, exclusion des drivers
  liés, cas base vide.
- **`docs/05-Specs/UNIFICATION_PERSONS_DRIVERS.md`** : mise à jour
  statut v0.3.0. Audit prod 2026-07-10 : 0 driver, 0 orphelin, 0
  person liée. Sunset destructif safe techniquement, en attente
  décision utilisateur explicite (**T-P1-03b**).

---

## [1.16.0] — 2026-07-10

### Added — WebSocket core : `docs/api/v2/websocket.md` (T-P1-02)

- **`docs/api/v2/websocket.md`** (nouveau) : référence complète du
  sous-système WebSocket eM@g (contrat URL, auth, cycle de vie,
  namespace `meta`, bus interne `eventBus`, client
  `ReconnectingWebSocket`, non couvert).
- **`docs/api/v2/README.md`** : ajout ligne **WebSocket** 🟢.
- **`apps/api/.env.example`** : documente `FEATURE_V2_WEBSOCKET`
  (off par défaut).

---

## [1.15.0] — 2026-07-10

### Added — API v2 core : `docs/api/v2/core.md` (T-P1-01)

- **`docs/api/v2/core.md`** (nouveau) : contrat commun transverse
  aux 4 namespaces v2. Sections : payload commun (`success/data/meta/
  error` + codes normalisés), pagination cursor-based (curseur
  opaque), feature flag serveur, discovery par namespace
  (`/protocol`) + discovery globale (`GET /api/v2/meta`),
  référence, non couvert.
- **`docs/api/v2/README.md`** : ajout ligne **Core** 🟢 en tête du
  tableau des modules.

---

## [1.14.0] — 2026-07-10

### Added — Affaires v2 : `docs/api/v2/affaires.md` (T-P0-09)

- **`docs/api/v2/affaires.md`** (nouveau) : référence complète des
  5 endpoints du namespace `/api/v2/affaires/*` avec exemples
  200/400/404/409. Section dédiée au rappel de l'audit trail
  systématique via `affaire_history` et au comportement no-op.
- **`docs/api/v2/README.md`** : Affaires passe 🟢 (T-P0-09 livré).
- **`apps/api/.env.example`** : documente `FEATURE_V2_AFFAIRES`
  (off par défaut).

---

## [1.13.0] — 2026-07-10

### Added — Locations v2 : `docs/api/v2/locations.md` (T-P0-12)

- **`docs/api/v2/locations.md`** (nouveau) : reference complète du
  namespace `/api/v2/locations/*`. 4 endpoints documentés avec
  exemples de payloads 200 + réponses d'erreur 400/404/409. Section
  dédiée au rappel de l'enrichissement `equipment_location_history`
  (T-P0-10).
- **`docs/api/v2/README.md`** : Locations passe 🟢 (T-P0-12
  livré).
- **`apps/api/.env.example`** : documente `FEATURE_V2_LOCATIONS`
  (off par défaut).

---

## [1.12.0] — 2026-07-09

### Added — Localisation v2 : script backfill diagnostic (T-P0-11)

- **`scripts/locations-v2-backfill.mjs`** (nouveau) : script dry-run
  qui produit un rapport JSON de cohérence sur les localisations
  équipements (totaux, locations partielles, zones inconnues dans
  `depot_svg_maps`, zones SVG orphelines, doublons de codes). Le
  flag `--apply` est refusé (dry-run uniquement). Exit codes
  0/1/2 selon écarts.
- **`docs/05-Specs/LOCATIONS_V2.md`** passe à v0.2.0 :
  - Nouvelle section §5 documentant les 5 contrôles du script, le
    format de sortie, l'usage et le rapport dev (DB fraîche : 0
    équipements, 2 dépôts seedés, 66 zones orphelines).
  - Précision sur ce que T-P0-11 NE fait PAS (pas de seed
    `equipment_location_history` — reporté à T-P0-12).
- **`tests/api-smoke/locations-v2-backfill.test.js`** (nouveau) :
  3 tests d'invocation `child_process.spawnSync` du script sur des DB
  SQLite dédiées (via `DB_PATH` relatif à `apps/api/`), cleanup
  automatique des fichiers `_test-locations-backfill-*.db`.

Aucun endpoint HTTP ajouté. Aucune modification du code exécutable
en production. Le seul effet de bord de l'exécution du script est
l'appel de `initializeDatabase()` qui crée les tables T-P0-10 si
elles n'existent pas déjà (idempotent, additif).

---

## [1.11.0] — 2026-07-09

### Changed — Display v2 : `DISPLAY_V2.md` v0.3.0 + section SSE + TV-client v2 (T-P0-16)

- **`docs/05-Specs/DISPLAY_V2.md`** passe à v0.3.0 :
  - Statut ajusté (mention TV-client v2 opt-in `/tv-client/v2/`).
  - §2.1 ajoute la ligne `signals/stream` (SSE, T-P0-16 ✅).
  - §5 renommée "Ce que T-P0-16 a livré" (SSE + TV-client v2
    architecturé).
  - §6 nouvelle "Sunset TV-client v1" (conditionné P0-DECISION-2).
- **`docs/api/v2/display.md`** : nouvelle section
  `GET /api/v2/display/signals/stream?screen_id=<id>` (T-P0-16) —
  contrat SSE complet, format events, exemple `EventSource`, capability,
  réponses d'erreur.
- **`docs/api/v2/README.md`** : Display passe 🟢 avec mention SSE +
  TV-client v2.

---

## [1.10.0] — 2026-07-09

### Changed — Display v2 : `DISPLAY_V2.md` v0.2.0 + `display.md` complet (T-P0-15)

- **`docs/05-Specs/DISPLAY_V2.md`** passe à v0.2.0 :
  - Statut réajusté (`T-P0-14 discovery + T-P0-15 DisplayService interne`).
  - Section §2.1 : les 3 endpoints `/config` `/content` `/signals` sont
    marqués ✅ (implémentés en T-P0-15, plus des skeletons 501).
  - Section §2.3 renommée en "Skeletons remplacés par les services en
    T-P0-15" : explique la traduction erreurs typées → HTTP.
  - Section §4 fusionnée T-P0-14 + T-P0-15 (livrés). Section §5 devient
    "Ce que T-P0-16 fera".
- **`docs/api/v2/display.md`** : ajout des exemples de payload 200
  détaillés pour `/config`, `/content`, `/signals` (remplace les
  descriptions 501). Documentation des réponses d'erreur 400/404 par
  endpoint.
- **`docs/api/v2/README.md`** : module Display passe de 🟡 à 🟢
  (endpoints implémentés).

Aucune modification des endpoints v1. La documentation reflète
maintenant l'état réel des services v2.

---

## [1.9.0] — 2026-07-09

### Added — Display v2 : `DISPLAY_V2.md` + `docs/api/v2/display.md` (T-P0-14)

- **`docs/05-Specs/DISPLAY_V2.md`** (nouveau) : spec complète du
  namespace `/api/v2/display/*` — modèle actuel v1 (55+ endpoints),
  modèle cible (discovery + config/content/signals), enrichissement
  `display_logs`, roadmap T-P0-14 → T-P0-16 (T-P0-15 DisplayService,
  T-P0-16 TV-client v2 + SSE), rollback documenté.
- **`docs/api/v2/display.md`** (nouveau) : référence des 4 endpoints
  livrés en T-P0-14 avec exemples de réponses 200 / 404 / 501.
- **`docs/api/v2/README.md`** : ajout du module Display dans l'index.

Coexistence stricte : le module v1 (`/api/display/*`, 2333 lignes)
reste actif et intact. Les endpoints v2 skeleton renvoient 501 avec
un pointeur `meta.legacy_endpoints` vers les équivalents v1.

---

## [1.8.0] — 2026-07-09

### Added — Localisation v2 : `LOCATIONS_V2.md` (T-P0-10 scaffold)

- **`docs/05-Specs/LOCATIONS_V2.md`** (nouveau) : spec du modèle unique
  de rangement équipements — table `depot_svg_maps` (source de vérité
  DB pour les définitions dépôt/floors/categories/zones actuellement
  éparpillées dans `public/depot*-zones.json`) et
  `equipment_location_history` (audit trail des déplacements).
  Roadmap T-P0-10 → T-P0-13, compatibilité totale coexistence,
  rollback documenté.

Coexistence stricte : les endpoints inventaire existants continuent
de lire les JSON statiques. La migration DB est non-destructive et
idempotente. La bascule des lectures vers la DB (endpoint `GET
/api/v2/locations/depots`) est reportée à T-P0-12.

---

## [1.7.0] — 2026-07-09

### Added — Sécurité Vidéo : `VIDEO_HARDENING.md` (T-P0-17 sous-tâche 1)

- **`docs/02-Securite/VIDEO_HARDENING.md`** (nouveau) : spec sécurité du
  module Vidéo (MediaMTX + proxy backend). Modèle de menaces (SSRF,
  cred leak, publish arbitraire, fuite URI, abus de rate, traçabilité
  insuffisante), contrôles en place, contrôles à ajouter, checklist
  déploiement, plan de rollback.
- **`mediamtx.yml.example`** durci : `apiAddress: 127.0.0.1:9997` et
  `rtspAddress: 127.0.0.1:8554` (loopback only) au lieu de `:9997` /
  `:8554` (toutes interfaces). Bloc `authInternalUsers` documenté en
  commentaire pour le cas `publish` légitime.
- **`apps/api/.env.example`** : ajout d'un rappel pointant vers
  `VIDEO_HARDENING.md` sous la section MediaMTX.

Aucun changement de code exécutable ni de config production. Les sous-
tâches suivantes (enrichissement `video_access_logs`, rate limit,
tests unitaires validation URI RTSP) feront l'objet de commits dédiés.

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
