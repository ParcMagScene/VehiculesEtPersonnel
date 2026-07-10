# Changelog API — eM@g

Toutes les modifications d'endpoints API sont listées ici.  
Format : [Keep a Changelog](https://keepachangelog.com)

---

## [1.17.0] — 2026-07-10

### Added — Personnel v2 : conflicts detector (T-P1-05)

- **`GET /api/v2/conflicts/protocol`** : discovery public.
- **`POST /api/v2/conflicts/check`** : détection de conflits agenda
  pour une personne sur une période. Sources scannées :
  - `availabilities` avec `status='approved'`,
  - `missions` + `mission_assignments` avec `status IN
    ('proposed', 'confirmed', 'accepted')`,
  - `task_assignments` avec `status != 'cancelled'`.
- Support `exclude` (self-check lors d'un update, types :
  `availability`, `mission`, `task_assignment`).
- Réponse typée : `{conflicts: [], has_conflict, count}` avec
  `source`/`entity_type`/`entity_id`/`start_date`/`end_date`/`period`
  /`description`/`meta` par entrée.

Gate par `FEATURE_V2_CONFLICTS` (off par défaut). **Aucune écriture,
aucun bloquage** sur les endpoints v1 (POST availabilities /
mission_assignments / task_assignments continuent d'accepter les
entrées même en cas de conflit). Le v2 est un pré-check optionnel
pour l'UI.

### Changed — `GET /api/v2/meta` : ajout du namespace `conflicts`

Le registre `V2_NAMESPACES` compte désormais **6 namespaces** :
`affaires`, **`conflicts`**, `display`, `leaves`, `locations`,
`planning` (ordre alphabétique). `total_namespaces=6`.

### Reference

- `apps/api/services/conflicts/detector.js` (nouveau) :
  `detectPersonConflicts`.
- `apps/api/services/conflicts/errors.js` (nouveau) :
  `ConflictsV2ValidationError`.
- `apps/api/v2/conflictsRoutes.js` (nouveau) : namespace + gate.
- `docs/api/v2/conflicts.md` (nouveau) : référence complète.

### Non couvert

- Blocage serveur des mutations v1 en cas de conflit (le v2 est
  strictement lecture, pas d'interception).
- Notification temps réel via WebSocket : hors scope.

---

## [1.16.0] — 2026-07-10

### Added — Personnel v2 : leaves API namespace (T-P1-04)

- **`GET /api/v2/leaves/protocol`** : discovery public. `capabilities`
  (4 kebab-case), `legacy_endpoints`, `docs`.
- **`POST /api/v2/leaves/calculate`** : miroir strict du POST v1
  `/api/leaves/calculate` avec payload standardisé `{success, data,
  meta}`. Body : `startDate`, `endDate`, `startPeriod`/`endPeriod`
  (AM/PM), `leaveType`, `exceptionalType`, `requestDate`. Réponse :
  `workingDays`, `holidaysInPeriod`, `warnings` (deadline, fermeture
  annuelle, règle 12 jours consécutifs), `referencePeriod`.
- **`GET /api/v2/leaves/balance/mine`** : self-service (nouveau,
  n'existe pas en v1). Résolution `req.user.id → persons.user_id`.
  Query : `year`, `type`. Réponse : `days_entitled`, `days_taken`,
  `days_remaining`, `exists`.
- **`GET /api/v2/leaves/balance/:person_id`** : admin (via
  `requireAdmin` optionnel). Même contrat que `/mine`.

Toutes les routes gate par `FEATURE_V2_LEAVES` (off par défaut, 404
`FEATURE_DISABLED`). Coexistence stricte avec `/api/leaves/*` v1
(déjà côté serveur depuis Phase 2 — pas de calcul client à retirer).

### Changed — `GET /api/v2/meta` : ajout du namespace `leaves`

Le registre `V2_NAMESPACES` compte désormais **5 namespaces** :
`affaires`, `display`, **`leaves`**, `locations`, `planning` (ordre
alphabétique). `total_namespaces=5`.

### Reference

- `apps/api/services/leaves/` (nouveau) : `rules.js` (constantes +
  helpers légaux dupliqués du v1 pour isolation), `calculate.js`
  (orchestration), `balance.js` (lecture `leave_balances` +
  résolution user→person), `errors.js`, `index.js`.
- `apps/api/v2/leavesRoutes.js` (nouveau) : 4 endpoints + gate.
- `docs/api/v2/leaves.md` (nouveau) : référence complète.

### Non couvert

- Écritures (POST demandes, PUT statut, calcul acquisition
  automatique) : le v1 reste seul propriétaire. Migration écritures
  reportée à un ticket ultérieur.
- Historique des balances (audit trail) : hors scope.

---

## [1.15.0] — 2026-07-10

### Added — WebSocket core (T-P1-02)

Introduction du **sous-système WebSocket** sur `/api/v2/ws/*`. Gate
par `FEATURE_V2_WEBSOCKET` (off par défaut, upgrade refusé avec
`404` sinon).

- **`WebSocketServer` (bibliothèque `ws@^8.21.0`)** attaché à
  l'événement `upgrade` du serveur HTTP/HTTPS principal.
  Coexistence stricte avec les routes REST et le TV-client v2
  (SSE) livrés en P0.
- **Auth handshake** : priorité `?token=<jwt>` (URL) > header
  `Authorization: Bearer` > cookie httpOnly `auth_token`. JWT
  HS256 vérifié + session `active_sessions` non expirée
  (alignement strict avec `middleware/authenticate.js`).
- **URL contract** : `ws(s)://host/api/v2/ws/<namespace>`.
- **Namespaces livrés** :
  - `meta` — heartbeat serveur (30 s par défaut, désactivable),
    ping/pong applicatif, whoami, broadcast via topic
    `ws:meta:announce`.
- **Namespaces déclarés (T-P1-02b)** : `messaging`, `display` —
  acceptent l'upgrade mais renvoient
  `{ type:'error', code:'NAMESPACE_NOT_READY' }` puis close 1013.
- **Bus interne** `apps/api/services/eventBus.js` : singleton
  EventEmitter typé (`publish`/`subscribe`/`topics`/
  `listenerCount`/`removeAllListeners`), `MAX_LISTENERS_PER_TOPIC=100`,
  utilisable par tout module métier pour signaler un événement au
  socle WS.
- **Constantes exportées** : `WEBSOCKET_PROTOCOL_VERSION='1.0.0'`,
  `WEBSOCKET_V2_FLAG='FEATURE_V2_WEBSOCKET'`,
  `WEBSOCKET_KNOWN_NAMESPACES` (frozen),
  `WEBSOCKET_URL_PREFIX='/api/v2/ws/'`.

### Non couvert

- Namespaces métier `messaging` + `display` (T-P1-02b, nécessite
  refactor du domaine messaging + intégration avec le pipeline SSE
  Display existant).
- Persistence des messages non délivrés (approche "state-heavy" :
  le client re-lit l'état complet à la reconnexion).
- Broker distribué (Redis / NATS) — hors scope P1, viser P4.

### Reference

- `apps/api/ws/index.js` (nouveau) : `attachWebSocketServer`,
  `parseWebSocketUrl`, `safeSendJson`.
- `apps/api/ws/auth.js` (nouveau) : `verifyWebSocketRequest`,
  `extractTokenFromRequest`, `parseCookieHeader`.
- `apps/api/ws/namespaces/meta.js` (nouveau) : `handleMetaMessage`,
  `buildHeartbeatPayload`.
- `apps/api/services/eventBus.js` (nouveau) : bus in-process.
- `apps/api/server.js` : `attachWebSocketServer(httpsServer, {…})`
  (SSL) et `attachWebSocketServer(httpServer, {…})` (HTTP fallback).
- `docs/api/v2/websocket.md` (nouveau) : reference complète.

---

## [1.14.0] — 2026-07-10

### Added — API v2 core : discovery global `/api/v2/meta` (T-P1-01)

- **`GET /api/v2/meta`** : discovery **publique** (pas d'auth, pas
  de feature flag). Agrège les 4 namespaces v2 (`affaires`,
  `display`, `locations`, `planning`) avec pour chacun :
  `protocol_version`, `capabilities`, `flag`, `enabled` (état réel
  du flag serveur), `docs`, `base_path`.
- Champs de discovery globale : `meta_protocol_version` (SemVer du
  format meta lui-même, `1.0.0`), `response_protocol_version` (int
  du wrapper `API_V2_PROTOCOL_VERSION`), `generated_at` (ISO),
  `total_namespaces`, `enabled_count`.
- Utile pour éviter les N appels `/api/v2/<domaine>/protocol` (qui
  sont chacun gate par leur flag) : `/meta` donne un snapshot
  complet en un seul aller-retour.

### Changed — Planning v2 : constantes protocole exportées

- **`apps/api/v2/planningRoutes.js`** : exporte désormais
  `PLANNING_PROTOCOL_VERSION` (`2.0.0`), `PLANNING_V2_FLAG`
  (`FEATURE_V2_PLANNING`) et `PLANNING_V2_CAPABILITIES` (6
  kebab-case, frozen). Alignement avec Display / Locations /
  Affaires. Ces constantes sont consommées par le registre statique
  du meta et n'ajoutent aucun comportement runtime.

### Reference

- `apps/api/v2/metaRoutes.js` (nouveau) : `setupV2MetaRoutes`,
  `V2_NAMESPACES` (registre frozen), `buildMetaPayload`,
  `isFlagEnabled`, `META_PROTOCOL_VERSION`.
- `docs/api/v2/core.md` (nouveau) : contrat commun payload +
  pagination + feature flag + discovery, référence transverse.

### Non couvert

- **Export OpenAPI depuis les schémas Zod** : reporté en ticket
  ultérieur T-P1-01b (chantier significatif nécessitant un audit
  complet des routes v2 et l'introduction d'un pipeline
  Zod → JSON Schema → OpenAPI).

---

## [1.13.0] — 2026-07-10

### Added — Affaires v2 API namespace (T-P0-09)

- **`GET /api/v2/affaires/protocol`** : discovery public.
  Retourne `protocol_version=2.0.0`, `capabilities` (5 kebab-case),
  `legacy_endpoints`, `patch_fields`, `docs`.
- **`GET /api/v2/affaires`** : liste paginée cursor-based (ordre
  `created_at DESC, id DESC`). Query : `cursor`, `limit` (1–200,
  défaut 50), `type`, `client` (LIKE). Réponse enrichie de
  `meta.pagination`.
- **`GET /api/v2/affaires/:numero_affaire`** : détail par clé métier
  (unique).
- **`GET /api/v2/affaires/:numero_affaire/history`** : lecture de
  `affaire_history` (audit trail T-P0-08) en ordre chronologique
  décroissant. Query : `limit` (1–500, défaut 100).
- **`PATCH /api/v2/affaires/:numero_affaire`** : patch partiel.
  Champs patchables : `nom`, `type`, `client`, `interlocuteur`,
  `tel`, `fax`, `date_debut`, `date_fin`, `devis`,
  `adresse_livraison`, `titre`, `description`, `google_event_id`,
  `event_name`. Champs non patchables (`id`, `numero_affaire`,
  `created_*`, `modified_*`) ignorés silencieusement.
  - **Audit systématique** : chaque champ effectivement modifié
    génère une ligne `affaire_history` (`field_name`, `old_value`,
    `new_value`, `changed_by`, `notes`).
  - **Détection no-op** : patch identique aux valeurs actuelles
    → `changed=false`, `history_ids=[]`, aucune ligne d'audit.
  - **Normalisation** : chaîne trimée, `''` → `null`.

Toutes les routes sont gate par `FEATURE_V2_AFFAIRES` (off par
défaut, 404 `FEATURE_DISABLED`). Coexistence stricte avec
`/api/affaires/*` v1 (enrichissement dynamique legacy inchangé,
sunset TEXT reporté à un ticket ultérieur après validation
zéro-consommateur).

Erreurs typées :
- **400 VALIDATION_ERROR** (patch vide, id invalide, `numeroAffaire`
  manquant).
- **404 NOT_FOUND** (`numero_affaire` inconnu).
- **409 CONFLICT** (violation UNIQUE).
- **500 INTERNAL_ERROR** (erreur non-typée).

### Reference

- `apps/api/services/affaires/` (nouveau) : `errors.js`,
  `affaires.js` (listAffaires, getAffaireByNumero, getAffaireById,
  patchAffaire), `history.js` (getAffaireHistory,
  appendHistoryEntry), `index.js`.
- `apps/api/v2/affairesRoutes.js` (nouveau) : 5 endpoints + gate.
- `docs/api/v2/affaires.md` (nouveau) : référence complète avec
  exemples 200/400/404/409.
- `EXECUTION_PLAN_EMAG_3_0.md` — T-P0-09 · Affaires v2 API v2.

---

## [1.12.0] — 2026-07-10

### Added — Locations v2 API namespace (T-P0-12)

- **`GET /api/v2/locations/protocol`** : discovery public. Retourne
  `protocol_version=2.0.0`, `capabilities` (4 kebab-case),
  `legacy_endpoints` (pointeurs vers v1), `docs`.
- **`GET /api/v2/locations/depots`** : liste compacte des dépôts
  depuis `depot_svg_maps` (metadonnées + counts).
- **`GET /api/v2/locations/depots/:depot_id`** : détail d'un dépôt
  (svg_width/height + floors + categories + zones parsés).
- **`PATCH /api/v2/equipment/:id/location`** : mise à jour de la
  localisation d'un équipement. Champs acceptés :
  `location_depot`, `location_floor`, `location_zone`, `location_code`,
  `notes`, `strict`.
  - Transactionnel : UPDATE `equipment.location_*` + INSERT
    `equipment_location_history` dans la même transaction.
  - Détection **no-op** : si aucun champ ne change effectivement,
    `changed=false` + `history_id=null`, aucune ligne dans l'audit
    trail (évite le bruit).
  - Mode `strict: true` : refuse si `location_zone` inconnue dans
    `depot_svg_maps.zones_json` du dépôt cible → 409 CONFLICT.
  - Réponse : `{ equipment_id, previous, next, history_id, changed }`.

Toutes les routes sont gate par `FEATURE_V2_LOCATIONS` (off par défaut,
404 `FEATURE_DISABLED`). Coexistence stricte avec les endpoints v1
(`/api/equipment-depot-zones`, `/api/equipment-all-depot-zones`,
`/api/catalog/equipment/zones`).

Erreurs typées :
- **400 VALIDATION_ERROR** (patch vide, id invalide, champs hors liste).
- **404 NOT_FOUND** (dépôt/équipement inexistant).
- **409 CONFLICT** (mode strict + zone inconnue).
- **500 INTERNAL_ERROR** (erreur non-typée).

### Reference

- `apps/api/services/locations/` (nouveau) — 4 fichiers services +
  errors + barrel : `listDepots`, `getDepotById`, `isZoneKnown`,
  `updateEquipmentLocation` (avec `LOCATION_FIELDS` immutable).
- `apps/api/v2/locationsRoutes.js` (nouveau) — 4 endpoints + gate.
- `docs/api/v2/locations.md` — reference endpoints complète avec
  exemples 200/400/404/409.
- `EXECUTION_PLAN_EMAG_3_0.md` — T-P0-12 · Localisation v2 API + UI.

---

## [1.11.0] — 2026-07-09

### Added — Display v2 SSE stream + TV-client v2 (T-P0-16)

- **`GET /api/v2/display/signals/stream?screen_id=<id>`** :
  Server-Sent Events push. Snapshot initial immédiat, puis :
  - `event: snapshot` toutes les 10 s (payload identique à
    `/api/v2/display/signals`).
  - `event: ping` toutes les 15 s (keep-alive TCP).
  - Validation `screen_id` avant ouverture du flux → 400
    `VALIDATION_ERROR` si invalide (client reçoit JSON standard, pas
    un stream).
  - En-têtes : `Content-Type: text/event-stream`, `Cache-Control:
    no-cache, no-transform`, `X-Accel-Buffering: no` (désactive le
    buffering Nginx/Caddy).
  - Cleanup automatique des timers via `req.on('close')` (aucun leak
    sur rupture réseau ou fermeture client).
  - Constantes exportées `SSE_HEARTBEAT_INTERVAL_MS = 15000` et
    `SSE_SNAPSHOT_INTERVAL_MS = 10000`.

### Changed — Display v2 : nouvelle capability

- `DISPLAY_V2_CAPABILITIES` ajoute `screen-signals-stream-v1` (5e
  capability). Le TV-client v2 dégrade sur polling `/signals` si le
  stream n'est pas annoncé.

### Reference

- `docs/api/v2/display.md` — nouvelle section SSE avec contrat +
  exemple de client `EventSource`.
- `apps/tv-client/v2/` — client de référence (voir CHANGELOG_UI.md).
- `EXECUTION_PLAN_EMAG_3_0.md` — T-P0-16 · TV-client v2.

---

## [1.10.0] — 2026-07-09

### Changed — Display v2 : `/config` `/content` `/signals` implémentés (T-P0-15)

Les 3 endpoints livrés en 501 `NOT_IMPLEMENTED` par T-P0-14 sont
maintenant implémentés via `apps/api/services/display/*` :

- **`GET /api/v2/display/config?screen_id=<id>`** :
  - Payload : `{ screen: {...}, playlist: {id, name}|null, appearance: {...} }`.
  - Screen : row `display_screens` (id, name, location, resolution,
    orientation, status, is_active, last_heartbeat, config JSON parsé).
  - Playlist : `{id, name}` de la playlist affectée (`null` si aucune).
  - Appearance : merge des overrides `display_config` avec les 9
    defaults (primaryColor, secondaryColor, eventBgColor,
    eventTextColor, fontFamily, showWeather, autoScroll, weatherApiKey,
    weatherCity). Toujours complet.
  - Erreurs : `400 VALIDATION_ERROR` si `screen_id` manquant/invalide,
    `404 NOT_FOUND` si écran inexistant.

- **`GET /api/v2/display/content?playlist_id=<id>`** :
  - Payload : `{ playlist: {id, name, description, is_active}, items: [...], total }`.
  - Items triés par `sort_order` avec `item_name` résolu par jointure
    conditionnelle sur `item_type` (media → original_name, message →
    title, template → name).
  - Chaque item : `{ id, playlist_id, item_type, item_id, item_name,
    duration, sort_order, config }`.
  - Erreurs : `400 VALIDATION_ERROR`, `404 NOT_FOUND`.

- **`GET /api/v2/display/signals?screen_id=<id>`** :
  - Payload : `{ screen, messages, welcome_message, generated_at }`.
  - Messages : filtre `is_active=1 AND (date_end IS NULL OR date_end >= today)`.
    Tri `urgent > high > normal > low` puis `created_at DESC`.
  - Welcome message : mapping `(day, slot)` de `display_welcome_messages`.
    `day` = nom court FR (`lun`..`dim`), `slot` = `morning`
    (<12h) / `afternoon` (<18h) / `evening` (≥18h). `null` si non défini.
  - `generated_at` : timestamp ISO du serveur pour permettre au client
    de calculer la fraîcheur (migration SSE prévue T-P0-16).
  - Erreurs : `400 VALIDATION_ERROR`, `404 NOT_FOUND`.

### Changed — Display v2 : capabilities renommées

`DISPLAY_V2_CAPABILITIES` mis à jour dans le discovery endpoint :

- `protocol-discovery` (inchangé)
- ~~`config-skeleton`~~ → `screen-config-v1`
- ~~`content-skeleton`~~ → `playlist-content-v1`
- ~~`signals-skeleton`~~ → `screen-signals-v1`

Le suffixe `-v1` indique la version stable du contrat (le préfixe `v2`
du namespace suffit pour la version d'API). Les clients TV doivent
matcher sur la capability exacte, pas sur un préfixe.

### Reference

- `apps/api/services/display/` (nouveau) — 4 fichiers services + errors + barrel.
- `docs/05-Specs/DISPLAY_V2.md` — spec mise à jour (v0.2.0).
- `docs/api/v2/display.md` — reference endpoints complète avec exemples 200/400/404.
- `EXECUTION_PLAN_EMAG_3_0.md` — T-P0-15 · Display v2 — DisplayService interne.

---

## [1.9.0] — 2026-07-09

### Added — Display v2 API namespace + discovery (T-P0-14)

- **`GET /api/v2/display/protocol`** : discovery endpoint public (pas
  d'authentification). Retourne `data.protocol_version` (version
  protocole Display TV, `2.0.0`), `data.capabilities` (kebab-case),
  `data.legacy_namespace`, `data.docs`. Enveloppe `meta.protocol_version`
  (wrapper API v2 = 1).
- **`GET /api/v2/display/config`** : skeleton 501 `NOT_IMPLEMENTED`
  (`meta.legacy_endpoints`, `meta.ticket=T-P0-15`).
- **`GET /api/v2/display/content`** : skeleton 501 `NOT_IMPLEMENTED`
  (`meta.legacy_endpoints`, `meta.ticket=T-P0-15`).
- **`GET /api/v2/display/signals`** : skeleton 501 `NOT_IMPLEMENTED`
  (`meta.legacy_endpoints`, `meta.ticket=T-P0-16`).

Toutes les routes sont gate par `FEATURE_V2_DISPLAY` (off par défaut,
404 `FEATURE_DISABLED` si off). `displayRoutes.js` v1 reste intact et
actif sur `/api/display/*` (55+ endpoints inchangés).

### Changed — `display_logs` enrichi (T-P0-14)

Migration additive idempotente : ajout de 5 colonnes contextuelles
pour l'audit trail TV-client v2.

- `client_ip` TEXT
- `client_user_agent` TEXT
- `protocol_version` TEXT
- `request_id` TEXT
- `response_status` INTEGER

Les inserts v1 existants n'écrivent pas dans ces colonnes (valeurs NULL,
rétro-compat totale).

### Reference

- `docs/05-Specs/DISPLAY_V2.md` — spec complète modèle + roadmap.
- `docs/api/v2/display.md` — reference endpoints.
- `EXECUTION_PLAN_EMAG_3_0.md` — T-P0-14 → T-P0-16.

---

## [1.8.0] — 2026-07-09

### Changed — Planning v2 : activation Phase B (dogfooding dev)

- `FEATURE_V2_PLANNING=1` activé sur l'environnement de développement
  (`apps/api/.env.development`, fichier gitignored). La production reste
  sur v1 (`FEATURE_V2_PLANNING` non défini => OFF par défaut).
- Toutes les routes `POST/GET/PUT/DELETE /api/v2/planning/tasks*` répondent
  désormais en dev (auparavant 404 `FEATURE_DISABLED`).
- `planningRoutes.js` v1 reste intact et actif sur toutes les routes
  `/api/planning/*`.
- Parity-check `scripts/planning-v2-parity-check.mjs` ré-exécuté sur la
  base dev fusionnée : **19/19 scénarios en parité stricte**, 0 divergence
  non expliquée, verdict `OK (parité attendue)`.

### Reference

- `docs/05-Specs/PLANNING_V2_SUNSET_PLAN.md` — protocole Phase A → D.
- `EXECUTION_PLAN_EMAG_3_0.md` — T-P0-06 point de contrôle P0-DECISION-1.

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
