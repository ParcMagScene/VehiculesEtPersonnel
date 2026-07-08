# EMAG 3.0 — EXECUTION PLAN

Plan d’exécution opérationnel du plan d’action eM@g 3.0.

Ce document est le pilote d’exécution du plan décrit dans [EMAG_3_0_ACTION_PLAN.md](EMAG_3_0_ACTION_PLAN.md), à la lumière de l’état système décrit dans [EMAG_TOTAL_SYSTEM_OVERVIEW.md](EMAG_TOTAL_SYSTEM_OVERVIEW.md). Il découpe le plan en tickets atomiques, donne l’ordre d’exécution, les branches, la stratégie de coexistence v1/v2, les critères d’acceptation et les points d’arrêt de contrôle.

Point critique préalable : ce dépôt sert la production. Aucun ticket n’est démarré sans validation utilisateur explicite. Aucune migration DB n’est appliquée sans backup préalable et sans dry-run local sur la base de développement.

---

## 0. Cadre d’exécution

### 0.1 Règles opérationnelles

- Périmètre = uniquement le ticket autorisé (règle utilisateur `git-add-scope.md`).
- Une branche par ticket, préfixée `emag30/<priorite>/<ticket>`.
- Coexistence v1/v2 systématique : jamais de suppression d’endpoint ou de colonne sans période de transition.
- Feature flag serveur `FEATURE_V2_<DOMAINE>` obligatoire pour toute route v2.
- Feature flag client `flags.v2<Domaine>` obligatoire pour toute UI v2.
- Aucun `git add -A` ni `git add .` (règle utilisateur). Toujours `git status --short` avant `git add <chemins ciblés>`.
- Aucune push production sans validation utilisateur explicite.
- Chaque ticket ferme sur : lint + format:check + tests backend + tests frontend + build + docs:check verts en local, avant PR.

### 0.2 Structure des branches proposée

- `emag30/prep/execution-plan` : branche technique de préparation (ce document + éventuels fichiers structurants).
- `emag30/p0/planning-v2-*` : sous-tickets Planning v2.
- `emag30/p0/affaires-v2-*` : sous-tickets Affaires v2.
- `emag30/p0/localisation-v2-*` : sous-tickets Localisation v2.
- `emag30/p0/display-v2-*` : sous-tickets Display v2.
- `emag30/p0/tv-client-v2` : nouveau TV-client.
- `emag30/p0/video-hardening` : sécurisation vidéo/MediaMTX.
- `emag30/p1/api-v2-core` : socle API v2 (base + pagination + payloads).
- `emag30/p1/websocket-core` : socle WebSocket.
- `emag30/p1/personnel-v2-*`, `emag30/p1/equipment-v2-*`, `emag30/p1/orders-v2-*`.
- `emag30/p2/pwa-offline-first`, `emag30/p2/responsive-v2`, `emag30/p2/a11y-v2`.
- `emag30/p3/ds-3-*`, `emag30/p3/cicd-3-*`, `emag30/p3/observability-3`.
- `emag30/p4/modular-*`, `emag30/p4/i18n`, `emag30/p4/cloud-ready-*`.

### 0.3 Conventions techniques imposées

- **Backend** : Node 22 ESM, Express 4, better-sqlite3, prepared statements uniquement.
- **DB** : chaque migration ajoutée dans `apps/api/migrations/` avec entrée `migrations_log`. Migration idempotente. Backfill séparé de la migration de schéma.
- **API v2** : sous-namespace `/api/v2/<domaine>/*`. Format réponse `{ success, data, meta, error }`. Pagination cursor-based. Documentation `docs/api/v2/<domaine>.md`.
- **Frontend** : React 18 + Vite, hooks + composants fonctionnels, Design System `components/ui/*`, tests Vitest. Utilisation obligatoire de `<Modal>` unifié (aucun `createPortal` externe). URL first pour la navigation desktop.
- **TV-client** : `apps/tv-client-v2/` autonome (index.html + main.js + styles.css + manifest.json), aucun bundler.
- **Docs** : mise à jour synchronisée `docs/06-Changelog/*` et `docs/api/v2/*`.
- **Tests** : Vitest côté web, `node --test` côté API. Aucun test avec effet réseau sortant.

### 0.4 Points d’arrêt de contrôle

Un point d’arrêt = décision explicite utilisateur avant d’engager l’étape suivante. Ils sont :

- P0-DECISION-1 : choix du premier ticket P0 à démarrer.
- P0-DECISION-2 : passage de la coexistence à la suppression legacy sur chaque domaine P0.
- P1-DECISION-1 : activation feature flag serveur `FEATURE_V2_*` en production.
- P1-DECISION-2 : bascule client sur v2.
- P3-DECISION-1 : passage `eslint-plugin-jsx-a11y` de `warn` à `error` par domaine.
- P4-DECISION-1 : extraction des services internes.
- RELEASE-3.0.0 : décision finale.

Aucun de ces points n’est franchi sans validation utilisateur.

---

## 1. Ordre global d’exécution

### 1.1 Vue synthétique

```
Phase 1 (P0 — 0-3 mois)
  1. Planning v2       (dépend de rien)
  2. Affaires v2       (peut démarrer en parallèle)
  3. Localisation v2   (dépend de Affaires v2 uniquement pour cascade)
  4. Display v2        (dépend de Planning v2 partiellement)
  5. TV-client v2      (dépend de Display v2 §versioning contrat)
  6. Video hardening   (indépendant, peut démarrer en parallèle)

Phase 2 (P1 — 3-6 mois)
  7.  API v2 core         (dépend de Planning v2 et Affaires v2)
  8.  WebSocket core      (dépend de API v2 core)
  9.  Personnel v2        (dépend de API v2 core)
  10. Equipment v2        (dépend de Localisation v2 + API v2 core)
  11. Orders v2           (dépend de API v2 core)

Phase 3 (P2 — 6-9 mois)
  12. PWA offline-first v2
  13. Responsive v2
  14. Accessibilité v2

Phase 4 (P3 — 9-12 mois)
  15. Design System 3.0
  16. CI/CD 3.0
  17. Observabilité 3.0

Phase 5 (P4 — 12-24 mois)
  18. Architecture modulaire
  19. i18n
  20. Cloud-ready
```

### 1.2 Règles de parallélisme

- Maximum 2 tickets P0 ouverts en parallèle.
- Maximum 3 tickets P1 ouverts en parallèle.
- Un seul ticket touchant une même table DB à la fois.

---

## 2. Tickets détaillés

Chaque ticket suit le même format : ID, objectif, branche, périmètre, sous-tâches, critères d’acceptation, tests, docs, points de contrôle, sortie.

### 2.1 Priorité 0 — Fondations critiques

#### T-P0-01 · Planning v2 — Cadrage & séparation des sous-domaines

- **Objectif** : préparer la séparation `planning-tasks`, `planning-events`, `planning-affaires`, `planning-imports`, `planning-recurrence`, `planning-ical` sans casser l’existant.
- **Branche** : `emag30/p0/planning-v2-cadre`.
- **Périmètre** : conception + squelette de services backend + docs.
- **Sous-tâches** :
  1. Créer `apps/api/services/planning/` avec fichiers `tasks.js`, `events.js`, `affaires.js`, `imports.js`, `recurrence.js`, `ical.js` (interfaces + JSDoc, aucun endpoint câblé).
  2. Ajouter `docs/api/v2/planning.md` (structure, endpoints cibles, pagination cursor-based, payloads normalisés).
  3. Ajouter `docs/05-Specs/PLANNING_V2.md` (design doc).
- **Critères d’acceptation** :
  - Aucune régression `planningRoutes.js` (aucun changement fonctionnel côté v1).
  - CI verte.
  - Docs `docs:check` OK.
- **Tests** : aucun ajout runtime, ajout d’un test de non-régression `tests/planning-cadre.test.js` (import des services vide).
- **Sortie** : squelette prêt pour T-P0-02.

#### T-P0-02 · Planning v2 — DB v2 (schéma + backfill)

- **Objectif** : introduire les tables normalisées (`task_sections_ref`, éventuelles filles) sans altérer `task_assignments`.
- **Branche** : `emag30/p0/planning-v2-db`.
- **Périmètre** : migrations + backfill scripts.
- **Sous-tâches** :
  1. Migration `apps/api/migrations/planning-v2-000-ref.sql` (création `task_sections_ref` seed 15 sections).
  2. Migration `apps/api/migrations/planning-v2-010-cursor-indexes.sql` (index composites cursor-based).
  3. Script `scripts/planning-v2-backfill.mjs` (dry-run par défaut).
- **Critères d’acceptation** :
  - Migration idempotente.
  - Rejeu propre en local (`npm run db:migrate:status`, `dev-reset-db.sh`).
  - Aucune altération v1 des lectures existantes.
- **Tests** : `tests/db/planning-v2-schema.test.js` (existence tables, seed, index).
- **Point de contrôle** : P0-DECISION-2 avant tout retrait ultérieur v1.

#### T-P0-03 · Planning v2 — API v2 lecture

- **Objectif** : exposer les endpoints v2 lecture avec feature flag `FEATURE_V2_PLANNING`.
- **Branche** : `emag30/p0/planning-v2-api-read`.
- **Périmètre** : routes lecture v2 + pagination cursor-based.
- **Sous-tâches** :
  1. `apps/api/v2/planningRoutes.js` (GET tasks, events, affaires-status, ical, avec `?cursor=`).
  2. Middleware feature flag.
  3. Documentation `docs/api/v2/planning.md` (payloads exemples).
- **Critères d’acceptation** :
  - v1 inchangée.
  - v2 renvoie données identiques à v1 (comparaison snapshot).
  - Pagination cursor-based validée sur >5 000 items.
- **Tests** : `tests/api-smoke/v2/planning.read.test.js`.

#### T-P0-04 · Planning v2 — API v2 mutations + coexistence

- **Objectif** : endpoints mutations v2 + double-écriture vers v1 pendant coexistence.
- **Branche** : `emag30/p0/planning-v2-api-write`.
- **Sous-tâches** :
  1. Endpoints POST/PUT/DELETE v2 (tasks/events/affaires-status).
  2. Adaptateur double-écriture temporaire.
  3. Transitions d’état validées serveur.
- **Critères d’acceptation** : parité fonctionnelle avec v1, tests d’intégration verts.

#### T-P0-05 · Planning v2 — UI TaskPlanningPanel v2

- **Objectif** : nouveau panneau v2 sous flag `flags.v2Planning`.
- **Branche** : `emag30/p0/planning-v2-ui`.
- **Sous-tâches** :
  1. `apps/web/src/components/planning-v2/` (TasksPanel, EventsPanel, AffairesStatusPanel, BlBpImportsPanel, RecurrencePanel).
  2. Router : `?module=planning&v=2`.
  3. Tests Vitest.
- **Critères d’acceptation** : parité fonctionnelle, adoption DS, a11y AA sur ce panneau.

#### T-P0-06 · Planning v2 — Migration data + sunset v1

- **Objectif** : bascule complète et déprécation v1 (uniquement après P0-DECISION-2).
- **Branche** : `emag30/p0/planning-v2-sunset`.
- **Sous-tâches** :
  1. Passage prod sur v2 (feature flag on).
  2. Suppression endpoints v1 + colonnes obsolètes.
  3. Nettoyage frontend.
- **Point de contrôle** : validation utilisateur explicite avant chaque étape.

---

#### T-P0-07 · Affaires v2 — Backfill matérialisation stricte

- **Objectif** : matérialiser toutes les affaires implicites (`reservations.affaire` sans ligne `affaires`).
- **Branche** : `emag30/p0/affaires-v2-backfill`.
- **Sous-tâches** :
  1. Script `scripts/affaires-v2-backfill.mjs` (dry-run par défaut, rapport JSON).
  2. Migration `apps/api/migrations/affaires-v2-000-materialize.sql` (INSERT OR IGNORE dans `affaires`).
  3. Documentation `docs/05-Specs/AFFAIRES_V2.md`.
- **Critères d’acceptation** :
  - Zéro affaire implicite après exécution.
  - Vue `v_affaires_implicites_residuelles` vide.
  - Aucun impact fonctionnel côté v1.

#### T-P0-08 · Affaires v2 — FK strictes

- **Objectif** : ajouter `reservations.affaire_id`, `orders.affaire_id`, renforcer `missions.affaire_id`, historiser via `affaire_history`.
- **Branche** : `emag30/p0/affaires-v2-fk`.
- **Sous-tâches** :
  1. Migration ajout colonnes FK (nullable au départ).
  2. Backfill des FK depuis `affaire` TEXT.
  3. Table `affaire_history`.
- **Critères d’acceptation** :
  - Lecture v1 identique.
  - Toutes lignes ont désormais `affaire_id` renseigné là où `affaire` existait.
  - Historique alimenté sur mutations.

#### T-P0-09 · Affaires v2 — API v2 + suppression progressive TEXT

- **Objectif** : exposer `/api/v2/affaires/*` avec FK et retirer progressivement `reservations.affaire` TEXT.
- **Branche** : `emag30/p0/affaires-v2-api`.
- **Sous-tâches** :
  1. Endpoints v2 + docs.
  2. Fin de l’enrichissement automatique côté v2.
  3. Étape 2 (après validation) : DROP colonne TEXT.
- **Point de contrôle** : P0-DECISION-2.

---

#### T-P0-10 · Localisation v2 — Modèle unique `locations`

- **Objectif** : créer la table de vérité et déplacer les JSON `depot*-zones.json` en DB.
- **Branche** : `emag30/p0/localisation-v2-model`.
- **Sous-tâches** :
  1. Migration `locations`, `depot_svg_maps`, `equipment_current_location`, `equipment_location_history`.
  2. Import initial des JSON dans `depot_svg_maps`.
  3. Documentation `docs/05-Specs/LOCATIONS_V2.md`.

#### T-P0-11 · Localisation v2 — Backfill équipements

- **Branche** : `emag30/p0/localisation-v2-backfill`.
- **Sous-tâches** :
  1. Backfill `equipment_current_location` depuis champs structurés existants.
  2. Vue diagnostic d’écarts.
  3. Rapport final.

#### T-P0-12 · Localisation v2 — API + UI EquipmentPanel v2

- **Branche** : `emag30/p0/localisation-v2-ui`.
- **Sous-tâches** :
  1. Endpoint `GET /api/v2/locations`, `GET /api/v2/locations/svg`.
  2. Refactor `EquipmentPanel` pour consommer la nouvelle source.
  3. Adaptation `LocmatImportModal`.

#### T-P0-13 · Localisation v2 — Sunset legacy

- Suppression des colonnes `equipment.location` legacy après P0-DECISION-2.

---

#### T-P0-14 · Display v2 — API versionnée & protocole TV

- **Objectif** : `/api/v2/display/*` + `protocol_version`.
- **Branche** : `emag30/p0/display-v2-api`.
- **Sous-tâches** :
  1. Nouveaux endpoints découpés (`config`, `content`, `signals`).
  2. Endpoint `GET /api/v2/display/protocol`.
  3. Enrichissement `display_logs`.

#### T-P0-15 · Display v2 — DisplayService interne

- **Objectif** : extraire la logique en service dédié.
- **Branche** : `emag30/p0/display-v2-service`.
- **Sous-tâches** : création `apps/api/services/display/*`, tests, docs.

---

#### T-P0-16 · TV-client v2 — Client nouveau

- **Objectif** : `apps/tv-client-v2/` compatible v1 + v2, mode debug.
- **Branche** : `emag30/p0/tv-client-v2`.
- **Sous-tâches** :
  1. Structure minimale (index.html, main.js, styles.css, manifest.json).
  2. Auth `X-TV-Token`, détection `protocol_version`.
  3. Widgets : événements, welcome, colorRules, iconRules, sneaky, Sonos, alarme SNCF.
  4. Mode debug (touche `D`).
- **Coexistence** : TV v1 gelé conservé jusqu’au sunset.

---

#### T-P0-17 · Vidéo — Sécurisation MediaMTX + logs enrichis

- **Branche** : `emag30/p0/video-hardening`.
- **Sous-tâches** :
  1. Isolation réseau documentée (config `mediamtx.yml`, rappel `.env.example`).
  2. Enrichissement `video_access_logs`.
  3. Rate limit publication ajouté.
  4. Tests unit `videoProxyService` (validation URI RTSP).

### 2.2 Priorité 1 — Modernisation technique

#### T-P1-01 · API v2 core

- **Objectif** : socle commun (payload `{ success, data, meta, error }`, pagination cursor-based, feature flags, documentation OpenAPI/Zod exportable).
- **Branche** : `emag30/p1/api-v2-core`.
- **Sous-tâches** :
  1. Middleware `apiV2Response.js` (mise en forme réponse).
  2. Helper cursor-based (encodage base64 opaque).
  3. Endpoint `GET /api/v2/meta`.
  4. Export OpenAPI depuis les schémas Zod.

#### T-P1-02 · WebSocket core

- **Branche** : `emag30/p1/websocket-core`.
- **Sous-tâches** :
  1. Serveur `/ws` monté sur Express (bibliothèque `ws`).
  2. Auth via cookie JWT.
  3. Bus interne `apps/api/services/eventBus.js`.
  4. Namespaces initiaux : `messaging`, `display`.
  5. Reconnexion exponentielle côté client.

#### T-P1-03 · Personnel v2 — Unification identités

- **Sous-tâches** : migration `drivers` → `persons`, vue de compatibilité, tests.

#### T-P1-04 · Personnel v2 — Solde congés côté serveur

- **Sous-tâches** : endpoint `POST /api/v2/leaves/calculate` + calcul central, retrait progressif du calcul client.

#### T-P1-05 · Personnel v2 — Moteur de conflits

- **Sous-tâches** : validation serveur avant `POST /api/v2/availabilities` et `POST /api/v2/assignments`.

#### T-P1-06 · Équipements v2 — UID/serials contrôlés

- **Sous-tâches** : renforcement UNIQUE `serial_number`, endpoint admin de regénération UID.

#### T-P1-07 · Équipements v2 — SAV enrichi

- **Sous-tâches** : `sav_parts`, machine d’état renforcée, sync LocMat auditée.

#### T-P1-08 · Équipements v2 — Assignations auditées

- **Sous-tâches** : `equipment_assignment_history`, double-assignation strictement bloquée.

#### T-P1-09 · Commandes v2 — Cycle achat

- **Sous-tâches** : sous-domaines API, matrice transitions, tests.

#### T-P1-10 · Commandes v2 — Réception partielle & devis → commande

- **Sous-tâches** : `order_receptions`, endpoint conversion.

### 2.3 Priorité 2 — Expérience utilisateur

#### T-P2-01 · PWA offline-first — Stratégies SW

- **Branche** : `emag30/p2/pwa-offline-first`.
- **Sous-tâches** : `sw.js` v2, stratégies Workbox, invalidation contrôlée.

#### T-P2-02 · PWA offline-first — Queue de mutations

- **Sous-tâches** : `outbox_mutations` IndexedDB, replay online, UI notification.

#### T-P2-03 · Responsive v2 — Layout global

- **Sous-tâches** : refonte layout, sidebar rétractable, convergence progressive du router mobile.

#### T-P2-04 · Responsive v2 — Composants adaptatifs

- **Sous-tâches** : `BottomSheet`, virtualisation généralisée, cartes mobiles.

#### T-P2-05 · A11y v2 — Auth & modals critiques

- **Sous-tâches** : audit clavier, ARIA, focus trap, correction contrastes.

#### T-P2-06 · A11y v2 — Planning & Personnel

- **Sous-tâches** : reprise des tables lourdes, `aria-live`, tests.

### 2.4 Priorité 3 — Industrialisation

#### T-P3-01 · DS 3.0 — Extraction

- **Sous-tâches** : `apps/design-system/`, tokens v3, migration progressive des composants.

#### T-P3-02 · DS 3.0 — Storybook + tests visuels

- **Sous-tâches** : Storybook complet, tests visuels.

#### T-P3-03 · CI/CD 3.0 — Tests DB & migrations

- **Sous-tâches** : suite dédiée, rejeu séquentiel + fixture réaliste.

#### T-P3-04 · CI/CD 3.0 — Tests smoke API/UI

- **Sous-tâches** : Playwright parcours critiques, workflow nocturne.

#### T-P3-05 · Observabilité 3.0 — Logs structurés & dashboards

- **Sous-tâches** : logger JSON, `request_id`, dashboards `docs/dashboards/quality.md`.

### 2.5 Priorité 4 — Vision long terme

#### T-P4-01..06 · Extraction services internes

- Un ticket par service (PlanningService, PersonnelService, EquipmentService, OrdersService, DisplayService, MessagingService).

#### T-P4-07 · i18n

- Framework, extraction textes UI, glossaire métier bilingue.

#### T-P4-08..12 · Cloud-ready

- Un ticket par abstraction (DB, storage, video, sonos, tv-client).

---

## 3. Dépendances récapitulatives

- T-P0-02 dépend de T-P0-01.
- T-P0-03/04/05 dépendent de T-P0-02.
- T-P0-06 dépend de T-P0-03/04/05 + P0-DECISION-2.
- T-P0-08 dépend de T-P0-07.
- T-P0-09 dépend de T-P0-08.
- T-P0-11 dépend de T-P0-10.
- T-P0-12 dépend de T-P0-11.
- T-P0-13 dépend de T-P0-12 + P0-DECISION-2.
- T-P0-15 dépend de T-P0-14.
- T-P0-16 dépend de T-P0-14 (protocole).
- T-P1-01 dépend d’un premier domaine P0 stabilisé (Affaires v2 ou Planning v2).
- T-P1-02 dépend de T-P1-01.
- T-P1-03..05 dépendent de T-P1-01.
- T-P1-06..08 dépendent de T-P0-10..12 + T-P1-01.
- T-P1-09..10 dépendent de T-P1-01.
- T-P2-01..02 dépendent partiellement de T-P1-02 pour signaux temps réel.
- T-P2-03..04 dépendent du DS 3.0 (T-P3-01/02).
- T-P2-05..06 dépendent du DS 3.0.
- T-P4 dépend de P1 stabilisé.

---

## 4. Critères de sortie par phase

- **Phase 1 (P0)** : Planning v2 UI en coexistence, Affaires matérialisées, Localisation v2 déployée, Display v2 avec `protocol_version`, TV-client v2 fonctionnel en parallèle, MediaMTX audité. Zéro régression v1.
- **Phase 2 (P1)** : API v2 core adoptée, WebSocket sur messaging + display, refactor Personnel/Équipements/Commandes livrés.
- **Phase 3 (P2)** : PWA offline-first sur mobile terrain, responsive convergé, WCAG AA sur modules critiques.
- **Phase 4 (P3)** : DS 3.0 imposé, CI/CD 3.0 étendu, observabilité pilotée.
- **Phase 5 (P4)** : services internes découpés, i18n opérationnelle, abstractions cloud-ready en place, release `v3.0.0` prête.

---

## 5. Stratégie de coexistence v1 / v2

- Tout endpoint v2 ajouté vit à côté de son équivalent v1.
- Un feature flag serveur (variable env `FEATURE_V2_<DOMAINE>`) permet de désactiver v2 en production.
- Un feature flag client (préférence utilisateur ou build-time) permet de basculer l’UI.
- La double écriture est autorisée temporairement pendant les phases de bascule (documentée dans le changelog).
- Le sunset d’une v1 (route ou colonne) ne peut être exécuté qu’après :
  1. Bascule client v2 stabilisée pendant au moins 1 sprint.
  2. Journalisation démontrant qu’aucun consommateur v1 ne subsiste.
  3. Décision utilisateur explicite (`P0-DECISION-2`).

---

## 6. Stratégie de migration DB

- Une migration = une opération isolée, idempotente, versionnée, tracée dans `migrations_log`.
- Aucune migration destructive sans backup préalable (`apps/api/backup-database.sh`).
- Aucune migration destructive sans dry-run local sur `vehicules-dev.db`.
- Toute migration ajoutée est testée dans `tests/db/*.test.js`.
- La CI rejoue toutes les migrations depuis une base vierge (à intégrer dans CI/CD 3.0 §T-P3-03).

---

## 7. Stratégie de tests

- Backend : `node --test`, suites dédiées par ticket.
- Frontend : Vitest, tests par composant + tests d’intégration ciblés.
- Smoke API : à ajouter en Phase 4 (T-P3-04).
- Smoke UI : Playwright, à ajouter en Phase 4 (T-P3-04).
- Aucun test dépendant du réseau externe (Google, Sonos, MediaMTX) sans mock.

---

## 8. Stratégie de documentation

- Chaque ticket ajoute ou met à jour :
  - `docs/api/v2/<domaine>.md` si nouvel endpoint.
  - `docs/05-Specs/<DOMAINE>_V2.md` si design doc.
  - `docs/06-Changelog/CHANGELOG_API.md`, `CHANGELOG_DB.md`, `CHANGELOG_UI.md`, `CHANGELOG_DOCS.md` selon l’impact.
  - Table de correspondance v1 → v2 dans `docs/api/v2/MIGRATION.md`.

---

## 9. Livrables opérationnels

Voir liste des 19 livrables dans [EMAG_3_0_ACTION_PLAN.md §7](EMAG_3_0_ACTION_PLAN.md). Chaque livrable est ici décomposé en tickets T-P?-??.

---

## 10. Prochaine action

Le prochain pas est une décision utilisateur : quel ticket P0 démarrer en premier (parmi T-P0-01, T-P0-07, T-P0-10, T-P0-14, T-P0-17). Aucun ticket ne sera démarré tant que ce choix n’aura pas été validé explicitement.

---

## Annexe A · Rappel des points de vigilance issus des mémoires internes

- **Périmètre strict** : `git-add-scope.md` impose de ne jamais utiliser `git add -A` sur ce dépôt. Chaque ticket ajoute uniquement les fichiers qu’il concerne.
- **Régle de protection production** : aucune migration ni bascule production sans validation explicite. `regle-protection-production.md` est la référence.
- **CI pré-flight obligatoire** : `ci-preflight.md` détaille les commandes minimales à passer avant `git push`.
- **Portails modaux** : `modal-system.md` interdit l’usage de `createPortal` externe autour de `<Modal>`.
- **Duplication conducteurs/persons** : la refonte doit se conclure par une unification stricte.
- **TV-client** : le client gelé actuel doit continuer à fonctionner pendant toute la période de coexistence.
