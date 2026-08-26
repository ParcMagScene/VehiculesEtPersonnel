# EMAG 3.0 — ACTION PLAN

Plan d’action complet, structuré, priorisé et opérationnel pour la transformation d’eM@g vers la version 3.0.

Ce document s’appuie sur [EMAG_TOTAL_SYSTEM_OVERVIEW.md](EMAG_TOTAL_SYSTEM_OVERVIEW.md) et sur [EMAG_MASTER_OVERVIEW.md](EMAG_MASTER_OVERVIEW.md). Il est conçu pour être exécuté séquentiellement par Copilot, avec une granularité suffisante pour permettre l’assignation directe des lots de travail.

---

## 1. Introduction

### 1.1 Objectif du plan d’action

- Résorber la dette structurelle des modules lourds.
- Introduire un socle temps réel maîtrisé et un cadre offline-first.
- Contractualiser l’API et le protocole TV.
- Uniformiser l’UX, l’accessibilité et le Design System.
- Industrialiser la qualité (tests, migrations, observabilité).
- Préparer une architecture modulaire cible, l’i18n et un profil cloud-ready.

### 1.2 Contexte

- Modules lourds monolithiques : Planning, Personnel, Affaires, Équipements, Commandes, Display.
- Concepts métier parallèles : localisation matériel (equipment/inventory/assignation), identités (persons/drivers), affaires implicites vs explicites.
- Absence de WebSocket : dépendance forte au polling (Google 5 min, non-lus 10 s).
- PWA activée via `sw-register.js`, mais offline-first non stabilisé, kill switch `sw-cleanup.js` conservé.
- TV-client volontairement gelé face à une API display qui évolue → risque de dérive contractuelle.
- SQLite mono-instance WAL performante mais pas conçue pour la scalabilité horizontale.
- Sécurité globalement solide (JWT httpOnly, sessions DB, sanitation, rate limit, AES-256-GCM ciblé) mais quelques axes restent à renforcer (CSRF explicite, chiffrement SMTP, rotation clés).

### 1.3 Vision eM@g 3.0

- Plateforme **modulaire** avec services internes par domaine.
- Plateforme **temps réel** via WebSocket contrôlé.
- Plateforme **scalable** grâce à une DB versionnée, une API v2 contractuelle et un stockage abstractible.
- Plateforme **offline-first** ciblée sur le mobile et les usages terrain.
- Plateforme **cohérente** grâce à un Design System 3.0 imposé sur l’ensemble des surfaces (desktop, mobile, TV).
- Plateforme **durable** : observabilité continue, non-régression multi-couches, gouvernance de versions.

---

## 2. Synthèse des priorités

- **Priorité 0 — Fondations critiques** : refactor Planning v2, normalisation Affaires v2, unification localisation v2, stabilisation Display v2 avec contrat TV, TV-client v2 compatible, sécurisation vidéo/MediaMTX.
- **Priorité 1 — Modernisation technique** : API v2 versionnée, WebSocket temps réel, refactor Personnel v2, refactor Équipements v2, refactor Commandes v2.
- **Priorité 2 — Expérience utilisateur** : PWA offline-first v2, responsive complet v2, accessibilité WCAG 2.1 AA.
- **Priorité 3 — Industrialisation** : Design System 3.0, CI/CD 3.0, Observabilité 3.0.
- **Priorité 4 — Vision long terme** : architecture modulaire, i18n complet, cloud-ready.

---

## 3. Plan d’action détaillé par priorité

### 3.1 Priorité 0 — Fondations critiques

#### 3.1.1 Refactor Planning v2

Objectif : sortir Planning de son monolithisme (routeur ~2600 lignes, table `task_assignments` à 50+ colonnes, mélange tâches / événements / statuts affaires / affichage TV).

- **Séparation des concepts** :
  - Sous-domaine `planning-tasks` (tâches opérationnelles par section).
  - Sous-domaine `planning-events` (événements dynamic_display_events).
  - Sous-domaine `planning-affaires` (statuts cycle prep→cloture).
  - Sous-domaine `planning-imports` (BL/BP).
  - Sous-domaine `planning-recurrence` (templates + génération).
  - Sous-domaine `planning-ical` (abonnements + export).
- **Normalisation DB** :
  - Partitionnement vertical de `task_assignments` (colonnes de sources → tables filles ou colonnes JSON typées).
  - Table `task_sections_ref` alignée sur le CHECK actuel.
  - Vue matérialisée `v_planning_affaires_status` pour agrégats.
  - Suppression progressive des reconstructions de `task_assignments` au boot.
- **API v2** :
  - Namespace `/api/v2/planning/*` avec payloads normalisés.
  - Pagination cursor-based sur listes volumineuses.
  - Filtrage/tri serveur documenté par sous-domaine.
- **DB v2** :
  - Migration formelle `planning-v2-*.sql` + `planning-v2-*.js`.
  - Journalisation dans `migrations_log`.
  - Backfill idempotent.
- **UI** :
  - Séparation `TaskPlanningPanel` en sous-panneaux (`TasksPanel`, `EventsPanel`, `AffairesStatusPanel`, `BlBpImportsPanel`, `RecurrencePanel`).
  - Feature flag `planning_v2` côté frontend pour bascule progressive.
- **Sortie** : latence GET planning divisée, code planning découpé, tests dédiés par sous-domaine, taux d’occurrence des reconstructions au boot = 0.

#### 3.1.2 Normalisation Affaires v2

Objectif : mettre fin aux « affaires virtuelles » enrichies depuis `reservations.affaire` et matérialiser strictement les affaires.

- **Matérialisation stricte** :
  - Backfill des affaires implicites vers `affaires` (une ligne par `numero_affaire` distinct).
  - Suppression de l’enrichissement automatique une fois le backfill validé.
- **FK strictes** :
  - `reservations.affaire_id` (INTEGER, FK `affaires.id`).
  - `missions.affaire_id` déjà présente ; renforcer la contrainte.
  - `orders.affaire_id` en FK explicite.
  - `equipment_assignments.affaire_id` normalisé.
- **Suppression progressive des références textuelles** :
  - Colonnes historiques `affaire` (TEXT) marquées dépréciées avec vue de compatibilité.
  - Migration en 2 temps : ajout FK à côté, puis retrait des colonnes texte.
- **Audit trail** :
  - Table `affaire_history` (evenement, before/after JSON, user_id, created_at).
  - Endpoint `GET /api/v2/affaires/:id/history`.
- **UI** :
  - Vue « dashboard affaire » (comptes ressources en temps réel via WebSocket dès §3.2.2).
  - Alerte visuelle sur affaires en incohérence détectée.
- **Sortie** : zéro affaire virtuelle en production, 100 % des mutations liées auditées, cascade delete cohérente.

#### 3.1.3 Unification localisation matériel v2

Objectif : mettre fin aux trois systèmes parallèles (`equipment_locations`, `inventory_locations`, `equipment_assignments`) au profit d’un modèle unique.

- **Modèle unique** :
  - Table `locations` (id, depot_id, floor, zone, code, svg_ref) source de vérité.
  - Table `equipment_current_location` (equipment_id, location_id, valid_from) pour la localisation courante.
  - Historique `equipment_location_history` (equipment_id, location_id, moved_by, moved_at).
- **Plans SVG** :
  - Migration des JSON `public/depot-zones.json` et `public/depot2-zones.json` vers DB (`depot_svg_maps`) avec versioning.
  - Endpoint `GET /api/v2/locations/svg?depot_id=` retournant le SVG et les zones.
- **Assignations v2** :
  - `equipment_assignments` reste focalisé sur affectation personne/affaire, sans champ localisation.
  - Séparation stricte : « où est le matériel » vs « à qui est-il rattaché » vs « à quelle affaire ».
- **Migration Locmat** :
  - Adaptation de l’import intelligent Locmat au nouveau modèle `locations`.
  - Refonte de l’onglet Suppressions/Doublons/Collisions pour référer aux `location_id`.
- **Sortie** : suppression du champ `location` legacy TEXT, un seul chemin de mise à jour de localisation, cohérence garantie par vue de diagnostic.

#### 3.1.4 Stabilisation Display v2

Objectif : découpler l’API display, sécuriser le contrat TV et rendre l’écosystème d’affichage évolutif.

- **API versionnée** :
  - Namespace `/api/v2/display/*`.
  - Découpage explicite : `display-config`, `display-content`, `display-signals`.
  - `GET /api/v2/display/tv-public-state` versionné (`?protocol=1`).
- **Protocole de compatibilité** :
  - Champ `protocol_version` renvoyé par le backend.
  - Politique de compatibilité : rétro sur `N-1` protocole.
  - Log serveur des protocoles clients rencontrés.
- **Séparation contenu vs signal** :
  - Séparation stricte messages informatifs, alarmes, sneaky.
  - Endpoint alarme distinct `POST /api/v2/display/signals/alarm/test`.
- **Sécurité** :
  - Consolidation `sanitizePath()` sur toutes routes servant des fichiers display.
  - Audit systématique des uploads médias display.
  - Rotation périodique des `display_screens.token`.
- **Sortie** : contrat TV formalisé, endpoints display réduits en taille moyenne, journal `display_logs` enrichi.

#### 3.1.5 TV-client v2

Objectif : produire un nouveau client TV moderne mais compatible, prêt à consommer l’API display v2.

- **Nouveau client** :
  - Réécriture `apps/tv-client-v2/` en HTML/CSS/JS natifs (pas de bundler).
  - Mode strict : validation `protocol_version`, fallback si mismatch.
  - Cache localStorage segmenté (state, weather, sonos, alarms).
- **Compatibilité API** :
  - Support des deux endpoints (v1 legacy + v2) le temps de la transition.
  - Détection automatique du protocole via `GET /api/v2/display/protocol`.
- **Mode debug** :
  - Panneau debug caché (touche `D`) affichant état interne, dernier polling, protocol_version.
  - Log `console.info` reactivé conditionnellement.
- **Fonctionnalités reprises** :
  - Alarme SNCF, sneaky photo/message, welcome messages, color rules, icon rules, widget Sonos, offline dégradé.
- **Sortie** : TV-client v2 déployable en parallèle du gelé, période de coexistence contrôlée, retrait du gelé au terme du jalon 3.

#### 3.1.6 Sécurisation vidéo / MediaMTX

Objectif : renforcer la sécurité et la résilience de la chaîne vidéo (RTSP → MediaMTX → WebRTC).

- **Flux** :
  - Séparation stricte des flux publication (RTSP sortant caméras) et lecture (WHEP WebRTC).
  - `sourceOnDemand` généralisé pour économiser la bande passante.
  - Contrôle strict des paths `cam-{id}` alignés avec `video_cameras.id`.
- **Réseau** :
  - Isolation MediaMTX en réseau LAN dédié caméras.
  - Filtrage pare-feu explicite sur ports 8554/8889/9997.
  - Blocage sortie internet du process MediaMTX.
- **Proxy** :
  - Validation stricte des URI RTSP (regex `^rtsps?://`).
  - Extraction sécurisée du mot de passe via helper dédié.
  - Rate limit lecture `120 req/min/user`, ajout d’un rate limit publication.
- **Logs** :
  - `video_access_logs` enrichi (user_id, camera_id, action, timestamp, IP, résultat).
  - Alerte sur pic d’échecs WHEP.
- **Sortie** : audit RGPD réalisable, credentials jamais renvoyés, résilience validée par tests de coupure.

### 3.2 Priorité 1 — Modernisation technique

#### 3.2.1 API v2 versionnée

Objectif : contractualiser durablement l’API pour tous les consommateurs internes et externes.

- **Payloads normalisés** :
  - Format unifié `{ success, data, meta, error }`.
  - `meta.pagination` structuré (`cursor`, `next_cursor`, `limit`, `has_more`).
  - `meta.protocol_version` sur endpoints critiques.
- **Pagination cursor-based** :
  - Généralisation aux listes >5 000 items (persons, equipment, tasks, orders, bl_imports).
  - Index composites nécessaires ajoutés côté DB.
- **Filtrage/tri serveur** :
  - Grammaire de filtres `?filter[field]=op:value` uniforme.
  - Tri `?sort=field:asc|desc`, whitelist par ressource.
  - Documentation OpenAPI/Zod exportable.
- **Gouvernance** :
  - Politique deprecation `Sunset` header + `Deprecation` header.
  - Rétro `N-1` minimum.
- **Sortie** : documentation contractuelle générée automatiquement, endpoint `/api/v2/meta` recensant les versions supportées.

#### 3.2.2 WebSocket temps réel

Objectif : éliminer le polling coûteux, unifier les canaux temps réel.

- **Bus temps réel** :
  - Serveur WebSocket monté sur `/ws` (auth via JWT cookie).
  - Namespaces : `planning`, `messaging`, `display`, `sonos`, `video`.
- **Planning** :
  - Push sur `dynamic_display_events`, `task_assignments`, statuts affaires.
  - Élection leader BroadcastChannel côté client (déjà utilisée pour Google) étendue.
- **Messaging** :
  - Push messages, unread-count, statuts lus.
  - Fin du polling `unread-count` toutes les 10 s.
- **Display** :
  - Push signaux (alarme, sneaky, welcome updates) vers TV-client v2.
  - Fallback polling conservé pour le gelé.
- **Sonos** :
  - Push now-playing (déclenché par un polling backend maîtrisé).
- **Video** :
  - Notifications d’état caméra (online, offline, PTZ) via WebSocket.
- **Résilience** :
  - Reconnexion automatique exponentielle.
  - Reprise état après coupure.
- **Sortie** : latence perçue < 1 s sur canaux critiques, polling résiduel réduit d’au moins 80 %.

#### 3.2.3 Refactor Personnel v2

Objectif : unifier les identités, clarifier missions, disponibilités, congés et conflits.

- **Unification `persons` ↔ `drivers`** :
  - Migration `drivers` → `persons` (rôle `driver`).
  - Vue de compatibilité `v_drivers` pour code legacy.
- **Missions** :
  - Table `mission_positions` (mission_id, position_id, count_required).
  - Machine d’état validée serveur (`draft → published → in_progress → completed / cancelled`).
- **Disponibilités** :
  - Types normalisés (`unavailable`, `leave`, `sick`, `training`).
  - Conflits calculés côté serveur avant validation.
- **Congés** :
  - Calcul de solde 100 % serveur (fin du calcul frontend).
  - Vue collégiale de validation (`leave_votes`).
  - Blocage stricte auto-approbation, y compris via API.
- **UI** :
  - `PlanningRHView` refactorisé en composants plus fins.
  - Détection conflits en direct via WebSocket §3.2.2.
- **Sortie** : fin des ambiguïtés identité, solde congés fiable, réduction >50 % des lignes `personnelRoutes.js`.

#### 3.2.4 Refactor Équipements v2

Objectif : stabiliser UID, serials, localisation, SAV et assignations.

- **UID / serials** :
  - Génération strictement contrôlée (`EMAG-XXXXX` incrémental, `crypto.randomUUID()` optionnel).
  - Contrainte UNIQUE renforcée sur `serial_number`.
  - Endpoint `POST /api/v2/equipment/regenerate-uid` limité admin.
- **Localisation** :
  - Bascule complète sur `locations` v2 (§3.1.3).
  - Suppression `equipment.location` legacy après migration.
- **SAV** :
  - Machine d’état complète (`open → in_progress → waiting_parts → in_progress → closed`).
  - Table `sav_parts` (ticket_id, stock_item_id, qty) pour pièces détachées.
  - Sync eM@g ↔ LocMat renforcée (parsing dates, mapping statuts, journal `sav_sync_log`).
- **Assignations** :
  - Contrôle strict double-assignation (409 Conflict).
  - Historisation `equipment_assignment_history`.
- **Listes** :
  - `equipment_lists` + `equipment_list_items` avec drag-drop UI.
- **Sortie** : réduction significative du code equipmentRoutes, cohérence localisation garantie, SAV auditable.

#### 3.2.5 Refactor Commandes v2

Objectif : rendre le cycle achat complet, fiable et traçable.

- **Cycle achat** :
  - Sous-domaines `material-requests`, `quotes`, `orders`, `receptions`, `supplier-documents`.
  - Endpoint dédié réception `/api/v2/orders/:id/receptions`.
- **Transitions** :
  - Machine d’état formalisée `ORDER_TRANSITIONS` avec matrice complète.
  - Refus explicite des transitions invalides (400).
- **Réception partielle** :
  - Table `order_receptions` (order_id, item_id, qty_received, received_at, received_by).
  - Recalcul automatique du statut commande.
- **Devis → commande** :
  - Endpoint `POST /api/v2/quotes/:id/convert-to-order`.
  - Copie automatique lignes + traçabilité (`orders.converted_from_quote_id`).
- **Documents fournisseurs** :
  - Uploads centralisés Multer.
  - Rétention configurée par type (contrat, catalogue, PV).
- **Sortie** : cycle achat traçable de bout en bout, notifications transitions par mail (via mailing).

### 3.3 Priorité 2 — Expérience utilisateur

#### 3.3.1 PWA offline-first v2

Objectif : rendre l’expérience mobile terrain résiliente à la coupure réseau.

- **Cache structuré** :
  - Stratégies Workbox : `NetworkFirst` (données), `StaleWhileRevalidate` (assets), `CacheFirst` (icônes, fonts).
  - Version cache incrémentée à chaque build (`__BUILD_VERSION__`).
- **Stratégies SW** :
  - `sw.js` v2 avec routing explicite par domaine.
  - Skip waiting contrôlé (déjà en place dans `sw-register.js`).
  - Kill switch conservé (`sw-cleanup.js`).
- **Sync différée** :
  - Queue IndexedDB `outbox_mutations` (endpoint, payload, timestamp, retries).
  - Rejeu automatique au retour online avec conflict resolution (last-write-wins ou champ-par-champ selon domaine).
  - UI notification « X mutations en attente ».
- **Mobile offline** :
  - Écrans `MobileHome`, `MobilePlanning`, `MobileEquipment`, `MobileInventory` fonctionnels en offline.
  - Scan QR équipement en offline (lecture cache IndexedDB).
- **Sortie** : PWA installable, mode offline stable sur mobile terrain, kill switch documenté.

#### 3.3.2 Responsive complet v2

Objectif : converger vers un modèle responsive cohérent sans doubler la logique.

- **Layout global** :
  - Grid principal responsive avec zones nommées.
  - Sidebar rétractable ≤ 1024 px.
- **Navigation mobile** :
  - Convergence progressive `useMobileRouter` → route unique basée sur search params.
  - Conservation du hash router pour QR codes physiques (rétrocompat).
- **Modals** :
  - Tailles adaptatives 92-96 vw mobile, 60-80 vw desktop.
  - BottomSheet mobile pour actions rapides.
- **Tables** :
  - `react-virtuoso` généralisé sur listes >200 lignes.
  - Vue « cartes » alternative mobile.
- **Panneaux** :
  - Panneaux modules mobile-friendly (Personnel, Affaires, Equipment).
  - Suppression progressive des duplications desktop/mobile.
- **Sortie** : cibles tactiles ≥ 44 px, densité UI adaptée au form factor, base commune de composants desktop/mobile.

#### 3.3.3 Accessibilité WCAG 2.1 AA

Objectif : atteindre un niveau AA sur les modules critiques.

- **Correction warnings** :
  - Passage `eslint-plugin-jsx-a11y` de `warn` à `error` module par module.
  - Résorption progressive des warnings existants.
- **ARIA** :
  - Rôles explicites sur tables, tabs, modals, dialogs, drawers, toasts.
  - `aria-live` pour zones dynamiques (toasts, non-lus, planning updates).
- **Focus** :
  - Trap focus modal + drawer testés.
  - `:focus-visible` généralisé.
  - Skip links en tête de page.
- **Contrastes** :
  - Audit contrastes thèmes light/dark + palette VS Code.
  - Correction des couleurs hex résiduelles (`HEX_RESIDUELS.md`).
- **Sortie** : audit AA validé sur auth, planning, personnel, mobile terrain ; suivi CI via `measure-ui-debt.mjs` étendu à l’a11y.

### 3.4 Priorité 3 — Industrialisation

#### 3.4.1 Design System 3.0

Objectif : faire du DS la source de vérité UI, UX, API, navigation et tests.

- **DS technique** :
  - Monorepo `apps/design-system/` extractible en package interne.
  - Tokens versionnés (`tokens/v3/*.json` → `theme.css`).
- **DS UI** :
  - Catalogue étendu (43 → cible 60+ composants).
  - Storybook complet + tests visuels (Chromatic ou équivalent).
- **DS API** :
  - Contrats client API standardisés (`utils/api/base.js` v2).
  - Générateur d’hooks CRUD à partir de la spec OpenAPI.
- **DS navigation** :
  - Router unifié (URL first, hash secondaire pour QR).
  - Conventions `?module=&view=&tab=` documentées.
- **DS modals** :
  - `ModalManager` v2 (event bus, portails multiples, focus stack).
  - Convention stricte : jamais de `createPortal` externe autour de `<Modal>`.
- **DS hooks** :
  - Hooks partagés `useCrudResource`, `useRealtimeChannel`, `useOfflineQueue`.
- **DS tests** :
  - Tests unitaires + intégration + accessibilité par composant.
  - Coverage minimal `85%` sur composants publics.
- **Sortie** : adoption DS mesurable via CI, retrait des couleurs et composants hors DS.

#### 3.4.2 CI/CD 3.0

Objectif : renforcer les garde-fous automatisés à chaque niveau.

- **Tests DB** :
  - Suite `tests/db/*.test.js` (schéma, contraintes, index, migrations).
  - Vérification `PRAGMA foreign_keys=ON` runtime.
- **Tests migrations** :
  - Rejeu séquentiel de toutes les migrations depuis DB vierge.
  - Rejeu à partir d’une DB fixture réaliste.
- **Tests API smoke** :
  - Suite `tests/api-smoke/*.test.js` contre serveur démarré.
  - Health, auth, CRUD lecture par domaine.
- **Tests UI smoke** :
  - Playwright sur parcours critiques (login, réserver véhicule, créer tâche, envoyer message).
  - Exécution nocturne.
- **Audit mensuel** :
  - Workflow `monthly-audit.yml` : `npm audit`, bundle, docs, dette UI, tests coverage.
- **Monitoring qualité** :
  - Publication dans `docs/dashboards/quality.md` généré automatiquement.
- **Sortie** : CI plus stricte, feedback rapide, tendances qualité tracées.

#### 3.4.3 Observabilité 3.0

Objectif : rendre le fonctionnement observable au-delà du log console.

- **Logs structurés** :
  - Backend : logger JSON (level, msg, module, request_id, user_id).
  - Corrélation request_id de bout en bout (frontend → backend).
- **Dashboard qualité** :
  - Génération automatique `docs/dashboards/quality.md` (couverture, dette UI, warnings a11y, health).
- **Alertes** :
  - Notification Slack/Discord sur échec CI main/prod (déjà prévu dans `notify.yml`, à activer).
  - Alerte sur `health` renvoyant 503 en production.
- **Tendances** :
  - Historisation `docs/dashboards/history.jsonl` (build_id, metrics).
  - Graphes générés à partir de l’historique.
- **APM optionnel** :
  - Intégration Sentry (frontend + backend) en environnement contrôlé.
  - Traces OpenTelemetry pour requêtes critiques (planning, display).
- **Sortie** : diagnostic incident < 5 min via logs corrélés, KPIs qualité pilotés.

### 3.5 Priorité 4 — Vision long terme

#### 3.5.1 Architecture modulaire

Objectif : ouvrir la voie à une décomposition en services internes.

- **Découpage** :
  - `PlanningService` (tasks, events, affaires status, recurrence, ical).
  - `PersonnelService` (persons, skills, positions, availabilities, missions, leaves).
  - `EquipmentService` (equipment, categories, assignments, sav, lists, locations, locmat).
  - `OrdersService` (material requests, quotes, orders, receptions, supplier documents).
  - `DisplayService` (screens, playlists, media, messages, config, signals).
  - `MessagingService` (conversations, messages, attachments, presence).
- **Modalités** :
  - Extraction progressive en modules JavaScript internes (interfaces claires).
  - Contrats d’événements internes (bus interne) préfigurant WebSocket externe.
  - Persistance encore partagée (SQLite) au début, découpe possible ensuite.
- **Sortie** : baisse du couplage transverse, meilleure testabilité, base pour éventuel split process.

#### 3.5.2 Internationalisation (i18n)

Objectif : rendre eM@g multilingue tout en préservant la cohérence métier.

- **i18n complet** :
  - Extraction textes UI vers `apps/web/src/i18n/{fr,en}.json`.
  - Framework `react-i18next` ou équivalent.
  - Fallback FR par défaut.
- **Formats date/heure** :
  - Utilisation `Intl.DateTimeFormat` généralisée.
  - Conservation formats FR spécifiques métier (jours ouvrés, semaine ISO).
- **Numéraires** :
  - Formats montants EUR par défaut, extensible.
  - Séparateurs de milliers/décimales localisés.
- **Traductions** :
  - Glossaire métier bilingue (BL, BP, affaire, mission, prestataire).
  - Revue linguistique pour spécificités FR (IDCC 3252, SIRET).
- **Sortie** : bascule FR/EN sans redéploiement, contenus mailing traduisibles.

#### 3.5.3 Cloud-ready

Objectif : rendre eM@g apte à un déploiement cloud contrôlé.

- **Abstraction DB** :
  - Couche `db/adapter.js` isolant `better-sqlite3`.
  - Cible optionnelle Postgres via adapter équivalent.
- **Abstraction storage** :
  - Couche `storage/adapter.js` (local FS ↔ S3 compatible).
  - Uploads Multer via adapter pluggable.
- **Abstraction vidéo** :
  - Interface `videoProxyAdapter` (MediaMTX local ↔ service SFU distant).
  - Config par ENV.
- **Abstraction Sonos** :
  - Interface `sonosAdapter` (LAN direct ↔ pont Sonos cloud si disponible).
- **Abstraction TV-client** :
  - Config runtime via `GET /api/v2/tv-client/config` (endpoint API display).
  - Distribution CDN possible.
- **Sortie** : eM@g déployable en environnement cloud maîtrisé sans refactor majeur.

---

## 4. Dépendances entre tâches

### 4.1 Graphe logique global

```
Priorité 0
  Planning v2 ──► API v2 (§3.2.1)
  Affaires v2 ──► API v2
  Localisation v2 ──► Équipements v2 (§3.2.4)
  Display v2 ──► TV-client v2 (§3.1.5)
  Vidéo sécurisée ──► Observabilité 3.0 (§3.4.3)

Priorité 1
  API v2 ──► WebSocket (§3.2.2)
  API v2 ──► Personnel v2 (§3.2.3)
  API v2 ──► Équipements v2 (§3.2.4)
  API v2 ──► Commandes v2 (§3.2.5)
  WebSocket ──► PWA v2 (§3.3.1) (sync signaux temps réel)
  WebSocket ──► Display v2 (canal signals)

Priorité 2
  PWA v2 ──► Responsive v2 (§3.3.2)
  Responsive v2 ──► A11y v2 (§3.3.3)
  DS 3.0 (§3.4.1) alimente Responsive v2 et A11y v2

Priorité 3
  DS 3.0 ──► CI/CD 3.0 (§3.4.2)
  CI/CD 3.0 ──► Observabilité 3.0 (§3.4.3)

Priorité 4
  Modulaire (§3.5.1) ──► Cloud-ready (§3.5.3)
  i18n (§3.5.2) ──► DS 3.0
```

### 4.2 Contraintes techniques

- **SQLite** : garder mono-instance tant que WebSocket et modularité ne sont pas stabilisés ; envisager Postgres après §3.5.3.
- **MediaMTX** : reste process PM2 local ; toute abstraction vidéo doit préserver la configuration `mediamtx.yml`.
- **Sonos** : dépend du LAN et de la lib `sonos` ; l’abstraction Sonos ne doit pas casser le pilotage direct UPnP.
- **TV-client** : le gelé doit continuer à fonctionner pendant toute la période de coexistence TV v2.
- **Mobile hash router** : conservé pour compatibilité QR codes physiques ; migration URL-first uniquement là où c’est sans risque.

### 4.3 Contraintes métier

- **Affaires** : leur normalisation doit être invisible côté utilisateur (aucune rupture de flux métier).
- **Missions** : la refonte Personnel v2 doit préserver les affectations en cours.
- **Réservations** : les migrations vers `reservations.affaire_id` doivent être transactionnelles.
- **BL/BP** : les changements de matching ne doivent pas altérer les imports historiques.

---

## 5. Risques et mesures de mitigation

### 5.1 Risques techniques

- **Modules lourds** : refactor risque de régressions massives. Mitigation : feature flags + coexistence v1/v2, tests intégration par domaine, migration progressive écran par écran.
- **Dérive TV-client** : contrat évolue plus vite que le client. Mitigation : `protocol_version` explicite, coexistence TV v1/v2, retrait strict après validation.
- **Charge SQLite** : croissance planning, display, messagerie. Mitigation : index composites, partitionnement `task_assignments`, checkpoint suivi, préparation Postgres.
- **Duplication métier** : ajout de v2 sans retrait v1 peut prolonger la dette. Mitigation : plan de retrait clair par domaine, dates de sunset publiées, contrôle CI.

### 5.2 Risques organisationnels

- **Charge de refactor** : trop de fronts simultanés. Mitigation : séquencement strict par phase, capacité limitée à 2-3 chantiers en parallèle.
- **Dépendances** : Planning v2 bloque API v2 bloque WebSocket. Mitigation : découpage en jalons atomiques livrables indépendamment (ex : API v2 sur un premier domaine simple avant Planning v2 complet).
- **Migration DB** : rejeu risqué en production. Mitigation : migrations idempotentes, backup automatique avant `npm run deploy`, script `dev-reset-db.sh` pour valider en local, rejeu en CI.

### 5.3 Mesures transverses

- **Versioning** : SemVer strict, `v3.0.0` réservé au terme du plan.
- **Migrations progressives** : chaque migration en 2 temps (ajout compatible, retrait ultérieur).
- **Compatibilité ascendante** : API v1 maintenue pendant `N-1` protocole minimum.
- **Monitoring** : dashboards qualité tracés, alertes CI activées.
- **Documentation** : mise à jour synchrone (`docs/06-Changelog/*` à chaque livraison majeure).
- **Non-régression** : tests smoke + intégration bloquants sur main.

---

## 6. Planning prévisionnel (12 à 24 mois)

### 6.1 Phase 1 — Stabilisation structurelle (0-3 mois)

- Planning v2 (découpage domaine, DB v2 partiel).
- Affaires v2 (matérialisation stricte + FK ajoutées).
- Localisation v2 (nouveau modèle + backfill).
- Display v2 (versioning contrat TV).
- Sécurisation vidéo / MediaMTX.
- Livrables : bases saines pour v2.

### 6.2 Phase 2 — Modernisation technique (3-6 mois)

- API v2 sur premier domaine (affaires) puis planning.
- WebSocket : bootstrap `messaging` et `display signals` d’abord.
- Refactor Personnel v2 (unification identité + solde congés serveur).
- TV-client v2 en coexistence.
- Livrables : API v2 partielle, WebSocket opérationnel, TV v2 déployable.

### 6.3 Phase 3 — Expérience utilisateur (6-9 mois)

- PWA offline-first v2 sur mobile terrain (planning + équipement).
- Responsive v2 (convergence layout, modals, tables).
- A11y AA sur auth, planning, personnel, mobile.
- Refactor Équipements v2 et Commandes v2.
- Livrables : mobile résilient, UX cohérente, modules refondés.

### 6.4 Phase 4 — Industrialisation (9-12 mois)

- Design System 3.0 (extraction, Storybook, hooks partagés).
- CI/CD 3.0 (tests DB, migrations, smoke API + UI, audit mensuel).
- Observabilité 3.0 (logs structurés, dashboards, alertes).
- Sortie TV-client v1 (retrait progressif).
- Livrables : socle qualité automatisé, DS imposé.

### 6.5 Phase 5 — Vision long terme (12-24 mois)

- Architecture modulaire (services internes).
- i18n complet (FR/EN).
- Cloud-ready (abstractions DB, storage, vidéo, Sonos, TV-client).
- Préparation release `v3.0.0`.
- Livrables : plateforme prête pour scalabilité et internationalisation.

---

## 7. Livrables attendus

- **Planning v2** : sous-domaines séparés, DB normalisée, API v2, UI découpée.
- **Affaires v2** : matérialisation stricte, FK renforcées, historique auditable.
- **Localisation v2** : modèle unique `locations`, plans SVG en DB, migration Locmat.
- **Display v2** : API versionnée `/api/v2/display/*`, `protocol_version`, séparation contenu/signal.
- **TV-client v2** : nouveau client compatible, mode debug, coexistence contrôlée.
- **API v2** : payloads normalisés, pagination cursor-based, filtrage/tri serveur, OpenAPI/Zod exporté.
- **WebSocket** : bus temps réel `/ws`, namespaces planning/messaging/display/sonos/video.
- **Personnel v2** : unification identités, solde congés serveur, conflits calculés serveur.
- **Équipements v2** : UID sécurisés, localisation unifiée, SAV enrichi (pièces détachées), assignations auditées.
- **Commandes v2** : cycle achat complet, réception partielle, conversion devis → commande, documents fournisseurs.
- **PWA v2** : SW v2 avec stratégies dédiées, queue mutations offline, mobile terrain résilient.
- **Responsive v2** : layout global, navigation convergée, modals adaptatifs, tables virtualisées.
- **A11y v2** : conformité WCAG 2.1 AA sur modules critiques, contrastes validés, focus contrôlé.
- **DS 3.0** : tokens versionnés, Storybook complet, hooks partagés, contrats API standardisés.
- **CI/CD 3.0** : tests DB/migrations/API/UI, audit mensuel, monitoring qualité.
- **Observabilité 3.0** : logs structurés, dashboards, alertes, tendances, APM optionnel.
- **Architecture modulaire** : services internes PlanningService, PersonnelService, EquipmentService, OrdersService, DisplayService, MessagingService.
- **i18n** : bascule FR/EN sans redéploiement, formats localisés, glossaire métier bilingue.
- **Cloud-ready** : abstractions DB, storage, vidéo, Sonos, TV-client ; déployabilité cloud maîtrisée.

---

## Note d’exécution

Chaque livrable ci-dessus doit être traité comme un chantier autonome, avec :

- une note d’objectif métier ;
- un cadrage technique aligné sur ce plan ;
- des critères d’acceptation vérifiables ;
- une migration progressive documentée ;
- une couverture de tests conforme au socle CI/CD 3.0 ;
- une entrée dédiée dans les changelogs `docs/06-Changelog/*`.

Aucun livrable ne doit passer en production sans validation des contrôles CI (lint, format, tests backend, tests frontend, build, docs:check) et sans un smoke test santé réussi (`GET /api/health` + `pm2 status` verts).
