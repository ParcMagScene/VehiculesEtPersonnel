# EMAG TOTAL SYSTEM OVERVIEW

Document de synthèse totale du système eM@g.

Portée : ce document reprend, complète et dépasse [EMAG_MASTER_OVERVIEW.md](EMAG_MASTER_OVERVIEW.md). Il est conçu pour permettre à un assistant externe de comprendre l’intégralité du produit sans accès au code source, avec un niveau de détail par module explicitement plus fin (rôle, flux, endpoints, tables, interactions, risques techniques, risques métier, dette, opportunités).

État observable au 8 juillet 2026. Les métriques citées sont issues de la documentation interne, des manifests applicatifs, des workflows GitHub Actions, des guides opérationnels et de la structure monorepo. Certaines valeurs numériques (nombre exact de tables, de routes, de composants) varient d’un rapport à l’autre selon la date et l’environnement observés. La lecture convergente du dépôt situe la base autour de 86 tables, l’API autour de 430 à 460 endpoints, et le frontend au-delà de 130 composants React. Le présent document conserve cette prudence documentaire volontaire.

---

## 1. Résumé exécutif global

### 1.1 Vision métier complète

eM@g est une plateforme unifiée de gestion opérationnelle pour une entreprise de prestations événementielles, techniques et logistiques. Elle rassemble en un seul système :

- la flotte de véhicules et son exploitation (réservations, trajets, entretien, contrôles) ;
- le personnel (permanents, intermittents, prestataires) avec compétences, missions, disponibilités et congés (conformité IDCC 3252) ;
- les affaires (dossiers projets multi-ressources) et leurs liens ;
- le parc matériel individualisé (UID unique, numéro de série, SAV, localisation multi-dépôt) ;
- le catalogue équipement, les flight-cases, les modèles de camions et le deep linking chargement 3D ;
- le stock consommable et pièces SAV ;
- les commandes fournisseurs, devis, demandes de matériel, documents fournisseurs ;
- l’annuaire (clients, fournisseurs, prestataires, contacts) avec validation SIRET, TVA intra, normalisation téléphone ;
- la communication interne (notes, événements, affichage) ;
- la messagerie temps réel avec pièces jointes ;
- le mailing par templates et campagnes ;
- la vidéosurveillance intégrée (RTSP, WebRTC, NVR, MediaMTX) ;
- le dashboard TV et le TV-client dédié (playlists, médias, messages, couleurs, alarme sonore) ;
- le contrôle Sonos LAN (zones, favoris, seek, shuffle, repeat) ;
- une interface mobile PWA avec écrans dédiés et QR codes matériel.

Le fil directeur est la continuité métier : une affaire relie réservations, missions, tâches, BL, BP, commandes, matériel et affichage.

### 1.2 Positionnement technique

- Monorepo pragmatique (apps/api, apps/web, apps/tv-client, public partagé, scripts, tests, docs).
- Backend Express, SQLite locale WAL, better-sqlite3, migrations hybrides SQL et dynamiques.
- Frontend React 18 + Vite 5, Design System documenté, hooks métier, IndexedDB de continuité.
- TV-client autonome, léger, indépendant du frontend principal.
- Déploiement local via PM2 orchestré par script sécurisé, avec rollback et smoke test santé.
- Sécurité backend robuste : prepared statements, JWT httpOnly + sessions DB, rate limiting, validation Zod, sanitation XSS, chiffrement AES-256-GCM pour secrets ciblés (Google, RTSP).
- Roadmap 3.0.0 orientée fiabilité durable : API v2 versionnée, pagination cursor-based, WebSocket, refactor modules lourds, PWA offline-first, i18n, Design System complet, optimisation DB.

### 1.3 Maturité du système

- Maturité fonctionnelle : élevée. Peu de systèmes internes couvrent autant de domaines aussi intégrés.
- Maturité documentaire : élevée. Documentation dense, indexée, versionnée, avec changelogs par axe (API, DB, UI, docs).
- Maturité sécurité : intermédiaire à élevée. Audits historiques (juillet 2025, mars 2026, mai 2026) suivis d’actions correctives significatives.
- Maturité architecture lourde : intermédiaire. Plusieurs modules restent monolithiques (planning, display, personnel, équipements, commandes).
- Maturité temps réel et offline : intermédiaire basse. Polling dominant, PWA activée mais offline-first non finalisé.

### 1.4 Forces globales

- Couverture métier remarquable pour une seule plateforme.
- Séparation apps/api, apps/web, apps/tv-client claire.
- Design System documenté, avec tokens, thèmes, composants et règles UX.
- SQLite bien configurée (WAL, FK ON, busy_timeout, checkpoint auto).
- CI GitHub Actions différenciant bloquant/informatif.
- Déploiement sécurisé avec rollback et smoke test santé automatiques.
- Intégrations externes correctement encapsulées côté serveur (Google, Sonos, vidéo).
- Deux mécanismes d’authentification personnelle complémentaires (session personnelle + action éphémère PIN/password).

### 1.5 Faiblesses globales

- Routeurs volumineux : planningRoutes, displayRoutes, personnelRoutes, equipmentRoutes, ordersRoutes.
- Concepts métier parallèles : localisation (equipment_locations, inventory_locations, assignation), identité (drivers/persons), affaires implicites vs affaires explicites.
- Absence de WebSocket : dépendance forte au polling.
- PWA activée via `sw-register.js` mais offline-first non stabilisé fonctionnellement.
- Historique de deux tv-client (client TV gelé) versus API display en évolution : risque de dérive contractuelle.
- Couverture accessibilité et responsive encore hétérogènes.

### 1.6 Synthèse de l’état réel

eM@g est un monolithe métier documenté, robuste sur ses fondamentaux, entré en phase de consolidation architecturale. Les correctifs sécurité historiques ont été traités, la base est saine, la CI est stricte sur les points essentiels, mais la dette structurelle des modules lourds devient le principal frein à la vitesse d’évolution.

---

## 2. Architecture complète

### 2.1 Monorepo

- **apps/api** : backend Express + SQLite, logique métier, routes REST par domaine, middlewares, migrations, cache, services d’intégration.
- **apps/web** : frontend React principal, navigation desktop et mobile, Design System, hooks, contextes, client API modulaire, IndexedDB.
- **apps/tv-client** : client TV autonome (index.html + main.js + styles.css + manifest.json), token TV via URL ou localStorage, cache offline minimal.
- **public** : assets partagés (photos, avatars, plans de dépôts, manifest PWA, sw.js, sw-register.js, uploads).
- **scripts** : scripts d’exploitation, migration, audit, déploiement, sync.
- **tests** : suites Node natives + Vitest.
- **docs** : documentation technique et fonctionnelle (index, API, architecture, sécurité, guides, opérations, specs, Design System, changelogs).

### 2.2 Organisation interne détaillée

- Backend segmenté par domaine : auth, admin, véhicules, affaires, personnel, planning, équipements, catalogue, commandes, stock, annuaire, display, Sonos, vidéo, mailing, messagerie, pièces jointes, profil, Google, TOTP, actions personnelles, inventaire, imports Locmat, SAV.
- Frontend organisé par composants (atomes/molécules/organismes/panneaux/mobile), hooks métier, contextes (`AuthContext`, `PersonalAuthContext`), router custom (`RouterCompat`), utils/api modulaires, thèmes CSS.
- TV-client volontairement minimal : polling `/api/display/tv-public-state`, cache localStorage, alarme sonore locale synchronisée par timestamp serveur.
- Public : plans SVG dépôts en JSON, uploads segmentés par contexte (attachments, avatars, messaging-uploads, display-media, supplier-docs, radio-logos, pv, photos, catalogues).

### 2.3 Flux de données complets

- Frontend → Backend : requêtes HTTP REST via un client API centralisé, cookie JWT httpOnly, refresh silencieux.
- Backend → SQLite : better-sqlite3 synchrone, prepared statements, transactions ciblées, cache LRU/TTL.
- Backend → Intégrations : Google Calendar (OAuth2 Authorization Code), Sonos (UPnP/SOAP LAN via lib `sonos`), MediaMTX (API REST + WHEP), SMTP (Nodemailer), NVR Dahua (recherche enregistrements).
- Frontend → IndexedDB : caches locaux (auth, affaires, équipements, personnes, inventaire, Google sync).
- TV-client → Backend : fetch dédié avec header `X-TV-Token`, cache local, mode offline dégradé.
- Mobile → Backend : mêmes endpoints REST, routeur hash `#/mobile/<screen>`, QR codes physiques matériel.

### 2.4 Communication frontend ↔ backend

- Client API central (`utils/api/base.js`) : gestion auth, refresh, propagation d’un statut réseau observable, IDB recovery.
- Modules d’API par domaine (`utils/api/{auth,vehicles,affaires,personnel,equipment,orders,stock,annuaire,display,sonos,video,mailing,messaging,google,...}`), ~15 à 19 modules selon la version.
- Payloads homogènes : succès/erreur, données, message.
- Rate limits gérés côté serveur, avec propagation d’erreurs typées côté client.
- Invalidation ciblée du cache backend après mutations, refresh bus côté frontend pour ré-alimenter les vues.

### 2.5 Navigation desktop et mobile

- Desktop : `useSearchParamState('module', ...)` fait de l’URL la source de vérité (module, vue calendrier, sous-onglet stock, filtres). Fallback localStorage uniquement au premier chargement.
- Mobile : `useMobileRouter()` maison basé sur hash `#/mobile/<screen>`. Écrans dédiés : `MobileHome`, `MobilePlanning`, `MobileAffaires`, `MobileAvailability`, `MobileEquipment`, `MobileInventory`, `MobileMessaging`, `MobileDashboardAdmin`, `MobileControlsScreen`.
- Détection mobile : `matchMedia('(pointer: coarse)')` + `max-width: 768px`. Basculement possible vers desktop via `sessionStorage.forceDesktop`.
- Sonos détaché : ouverture d’une fenêtre pop-up dédiée pour contrôle multi-écran.

### 2.6 Architecture TV-client

- Point d’entrée `apps/tv-client/main.js`, servi par le backend eM@g.
- Auth par token TV (paramètre URL `?token=` ou `localStorage['tv-token']`), envoyé en header `X-TV-Token`.
- État global rafraîchi via `/api/display/tv-public-state` (endpoint agrégé : config, welcomeMessage, colorRules, iconRules, completedEvents, logoUrl, sneakyPhoto, sonos, events, alarmTest).
- Cache localStorage segmenté (`tv-cache-state`, `tv-cache-weather`, `tv-cache-sonos`).
- Alarme sonore locale synchronisée : file SNCF.wav, déclenchement à `end_time` des tâches, flash rouge, réinitialisation quotidienne.
- Validation stricte des valeurs CSS injectées (regex safe pour couleurs et tokens).
- Absence de bundler : HTML/CSS/JS natifs pour maximiser stabilité et lisibilité.

### 2.7 Architecture Google Calendar sync

- Flux OAuth2 Authorization Code piloté côté serveur (`googleRoutes.js`).
- Endpoints : `/api/google/auth`, `/api/google/callback`, `/api/google/status`, `/api/google/disconnect`, `/api/google/configured`, `/api/google/calendars`, `/api/google/events`, `/api/google/events/:eventId`, `/api/google/sync/pull-reservations`.
- Refresh tokens chiffrés AES-256-GCM (clé `GOOGLE_ENCRYPTION_KEY`).
- Callback protégé par state anti-CSRF.
- Sync automatique côté client : polling ~5 min, élection d’un onglet leader via BroadcastChannel, cache IndexedDB (`STORES.googleSync`).
- Utilisation : lecture d’événements, création de réservations depuis Google, création d’événements Google depuis affaires.

### 2.8 Architecture Sonos

- Bibliothèque `sonos@1.14.3` côté backend, communication UPnP/SOAP LAN directe.
- IP Sonos stockée dans `display_config` (clé `sonosIP`), résolution automatique du coordinateur de groupe.
- Endpoints `/api/sonos/*` : config, now-playing, zones, state, play/pause/next/previous, volume/mute/unmute, favorites, radio-stations, browse/:objectId, music-services, queue, favorite, seek, shuffle, repeat.
- Sécurité : JWT + `requireAdmin` pour commandes ; `optionalTvToken` pour lecture TV ; rate limit 120 req/min lecture, 60 req/min commandes ; validation stricte IPv4 et URI ; blocage SSRF sur IP privées pour favicon radio.
- Routes historiques dépréciées (`/api/display/sonos-*`) conservées avec sunset 2026-07-01.
- Widget TV Sonos : polling `/api/sonos/now-playing`, album art, volume, animation slide-up.

### 2.9 Architecture vidéo / MediaMTX / NVR

- **MediaMTX** : proxy vidéo entre RTSP caméras et WebRTC frontend.
  - Configuration : `mediamtx.yml` (dérivé de `mediamtx.yml.example`), API `:9997`, WebRTC/WHEP `:8889`, RTSP `:8554`.
  - Sources caméras : `paths.cam-{id}` avec `sourceOnDemand`, `sourceOnDemandStartTimeout`, `sourceOnDemandCloseAfter`.
  - Processus PM2 dédié (`mediamtx` dans `ecosystem.config.js`).
- **Backend vidéo** (`videoRoutes.js`, `videoProxyService.js`) :
  - CRUD caméras : `/api/video/cameras`, chiffrement AES-256-GCM des mots de passe RTSP.
  - Streaming WHEP : `/api/video/cameras/:id/stream`, `whepExchange`, `whepDelete`, `whepPlaybackExchange`.
  - Snapshot HTTP, commandes PTZ, recherche d’enregistrements NVR Dahua.
  - Journal d’accès `video_access_logs`.
  - Rate limit dédié 120 req/min/utilisateur.
- **TV-client vidéo** : endpoints `/api/video/tv/cameras`, `/api/video/tv/cameras/:id/whep` protégés par `verifyTvToken`.
- **Sécurité** : masquage des credentials, aucune URL RTSP complète renvoyée, extraction contrôlée du password, canal Dahua détecté pour indiquer support playback.
- **Fragilités** : dépendance à MediaMTX local, sensibilité au réseau LAN, gestion opérationnelle des NVR/caméras.

### 2.10 Architecture planning / tâches / récurrence

- Cœur porté par `planningRoutes.js` (~2600 lignes) et le composant `TaskPlanningPanel`.
- Concepts :
  - **Événements display** (`dynamic_display_events`) : type/category/affaire_id/date/period/assigned_person_id/status/visible.
  - **Tâches** (`task_assignments`) : 15 sections métier (`rdv`, `prep_locations`, `prep_prestations`, `prep_ventes`, `prep_installations`, `chargement`, `depart`, `enlevement`, `retour`, `recuperation`, `installation`, `evenements`, `taches_prioritaires`, `taches_secondaires`, `courses`, `manual`), source_type multiple, statuts.
  - **Récurrence** : templates (daily/weekly/monthly), génération programmée.
  - **Rollover** : report automatique des tâches incomplètes au lendemain (minuit).
  - **iCal** : abonnements et export flux tâches/réservations.
  - **BL / BP** : imports PDF/image, parsing structuré, sections_data JSON, field_confidence JSON, doc_type, affaire_type.
- Endpoints principaux : `/api/planning/display-events`, `/api/planning/bl-imports`, `/api/planning/bp-items`, `/api/planning/tasks`, `/api/planning/recurring-tasks`, `/api/planning/planning-assignments`, `/api/planning/stats`, `/api/planning/planning-affaires`, `/api/planning/ical-calendars`, `/api/planning/ical-events`.
- Tables : `dynamic_display_events`, `task_assignments`, `bl_imports`, `bp_items`, `planning_hidden_affaires`, `planning_affaire_status`, `planning_event_status`, `planning_assignments`.
- Cache backend spécifique planning (stats 20s, planning-affaires 15s, iCal 5min).

### 2.11 Architecture équipements / Locmat / UID / serials

- Concept central : équipement individualisé avec UID unique (`EMAG-00001` généré, migré via `crypto.randomUUID()`), numéro de série, statut, localisation structurée.
- Localisation multi-dépôt en cascade : `location_depot` → `location_floor` → `location_zone` → `location_code`, avec plans SVG interactifs (`depot-zones.json`, `depot2-zones.json`, 2 dépôts Événementiel/Structure).
- **Module Import intelligent Locmat** :
  - Sources CSV Locmat : `Locations.csv` + `Serialise.csv`.
  - Migration dédiée : `apps/api/migrations/locmat-import-v1.js`.
  - Routes : `POST /api/import/locmat/preview`, `POST /api/import/locmat/confirm`, `GET /api/import/locmat/logs`.
  - Détections : doublons stricts, collisions intra-CSV, collisions DB cross-équipement, suppressions.
  - UI : `LocmatImportModal` avec onglets Suppressions, Doublons, Collisions (consultatifs).
  - Schéma Zod `locmatConfirmSchema` (`missingProducts`, `duplicates`, `collisions`).
- **Synchronisation SAV eM@g ↔ LocMat** (`savRoutes.js`, `savComparator.js`) : parser CSV LocMat (`;` ou `,`), mapping statut Locmat → interne, parse dates FR (`DD/MM/YYYY AM|PM` → ISO).
- Endpoints équipement : `/api/equipment`, `/api/equipment-categories`, `/api/equipment-assignments`, `/api/sav-tickets`, `/api/equipment-lists`.
- Tables : `equipment`, `equipment_categories`, `equipment_assignments`, `sav_tickets`, `equipment_serials`, `flightcases`, `truck_models`, `equipment_to_vehicle`, `bp_items`.
- Deep linking chargement 3D : intégration bidirectionnelle avec application externe (drag-drop matériel dans camion).

### 2.12 Architecture stock / commandes / fournisseurs

- **Stock** : catégories hiérarchiques, articles vendables (STK-*) ou pièces SAV (SAV-*), mouvements typés (in/out/adjustment/return), alertes bas stock (`quantity ≤ min_quantity`), import CSV batch.
- **Commandes** : cycle draft → sent → confirmed → partial → received, ref auto PO-YYYY-###, réception partielle par ligne, transitions validées côté serveur (`ORDER_TRANSITIONS`).
- **Devis** : cycle draft → sent → accepted/refused, ref auto QUOTE-YYYY-###, conversion vers commande.
- **Demandes matériel** : pending → needs_review → approved → ordered.
- **Fournisseurs enrichis** : annuaire enrichi (SIRET, TVA, code NAF, secteur, service_types).
- **Documents fournisseurs** : contrats, catalogues, upload et suppression admin.
- **Catalogue fournisseurs** : synchronisation avec eShop partenaire (`eshopCatalogSync.js`), diff prix, suggestions d’achat.
- Tables : `stock_categories`, `stock_items`, `stock_movements`, `orders`, `order_items`, `quotes`, `quote_items`, `material_requests`, `suppliers`, `supplier_articles`, `catalog_imports`, `supplier_documents` (selon état documentaire).

### 2.13 Architecture affaires / BL / BP / liens

- Table centrale `affaires` (numero_affaire UNIQUE, type, dates, client, google_event_id, event_name, nom).
- **Enrichissement automatique** : le GET liste détecte les affaires depuis `reservations.affaire` sans exiger de ligne `affaires` explicite. Cela permet un enrichissement progressif mais crée des affaires virtuelles.
- **Liens** : `affaire_links` (parent_affaire_id, child_affaire_id) pour relier tournées et affaires filles.
- **BL / BP** :
  - `bl_imports` : PDF/image, parsed_data JSON, sections_data JSON, field_confidence JSON, doc_type, affaire_type, confidence_score.
  - `bp_items` : items du BP, item_type (`materiel`/`article`), match_status, match_confidence, liaison optionnelle vers `equipment_catalog`, `equipment`, `stock_items`.
  - Import batch (max 50 fichiers).
- Endpoints : `/api/affaires`, `/api/affaires/:id`, `/api/affaires/personnel-counts`, `/api/planning/bl-imports`, `/api/planning/bp-items`.
- Interactions : planning, commandes, personnel, équipements, Google Calendar, pièces jointes.
- Risque connu : soft delete affaire ne casse pas les liens textuels dans reservations/missions.

### 2.14 Architecture communication / display / couleurs / messages

- Périmètre réparti entre planning et display, selon la nature de l’information.
- Écrans TV : `display_screens` (token UNIQUE, config JSON, last_heartbeat), `display_playlists`, `display_playlist_items` (type: media/message/template/url/event), `display_templates`, `display_messages`, `display_media`, `display_logs`, `display_config`.
- Apparence dynamique : `display_welcome_messages` (day+slot UNIQUE), `display_color_rules` (keyword → color), `display_location_icon_rules` (keyword → GIF).
- Événements toggle : `display_completed_events` (event_id + event_date UNIQUE).
- Endpoint agrégé public TV : `/api/display/tv-public-state` (config, welcomeMessage, colorRules, iconRules, completedEvents, logoUrl, sneakyPhoto, sonos, events, alarmTest).
- Endpoint admin d’alarme : `/api/display/alarm/test` déclenche un signal `alarmTest` timestamp que le TV-client détecte.
- Path traversal historiquement critique sur `/api/display/gifs/:filename` (corrigé via sanitizePath).

### 2.15 Architecture messagerie interne

- Modèle conversationnel : 1:1 (direct) ou groupe (group).
- Déduplication automatique des conversations directes (paire d’utilisateurs).
- Uploads sécurisés : MIME allowlist (image/jpeg, image/png, image/gif, image/webp, application/pdf, video/mp4, video/webm), taille max 25 Mo, blocage SVG, sanitation nom de fichier (alphanum + tirets), stockage dans `public/messaging-uploads/`.
- Endpoints : `/api/messaging/conversations`, `/api/messaging/conversations/:id/messages`, `/api/messaging/conversations/:id/messages/file`, `/api/messaging/unread-count`.
- Tables : `conversations`, `conversation_participants` (last_read_at), `messages` (soft delete via edited_at ou is_deleted), `message_attachments`.
- Polling `/api/messaging/unread-count` toutes les 10 secondes côté frontend.

### 2.16 Architecture mobile / PWA / QR codes

- Détection mobile fiable, écrans dédiés.
- Manifest PWA : `public/manifest.json` (name eM@g, standalone, orientation any, theme_color #1e3a5f, icons 192/512 + maskable).
- Service Worker :
  - `public/sw.js` (implémenté avec placeholder `__BUILD_VERSION__` remplacé au build par `scripts/inject-sw-version.mjs`).
  - `public/sw-register.js` : enregistre `/sw.js`, écoute `controllerchange` (reload contrôlé après update), re-check `updatefound` au retour visibility, message `SKIP_WAITING` pour activer le nouveau SW.
  - `public/sw-cleanup.js` conservé comme kill switch historique (désenregistrement de tous les SW et purge caches).
- QR codes matériel : accès direct à une fiche véhicule via `/mobile` + hash, pattern `EMAG-XXXXX`.
- Contexte réseau propagé à l’UI via `subscribeApiNetworkStatus()`.

### 2.17 Architecture sécurité

- **Auth JWT** : token dans cookie httpOnly `auth_token`, SameSite=lax, Secure en production, algorithme HS256, expiration configurable.
- **Sessions** : table `active_sessions` (user_id, token_hash SHA-256, expires_at, last_activity), cascade delete au logout.
- **Refresh silencieux** : `POST /api/auth/refresh`, renouvellement automatique côté frontend, IDB fallback.
- **RBAC** : `is_admin`, permissions granulaires (`can_manage_catalog`, `can_manage_trucks`, `requireCatalogAccess`, `requireEquipmentMaintenanceAccess`, `requireAdmin`), middlewares dédiés.
- **Rate limiting** :
  - Auth : 5 req/15 min (prod), 50 (dev) via `authLimiter` avec `skipSuccessfulRequests: true`.
  - Sensible : 10 req/15 min (reset-password, access-requests) via `sensitiveEndpointLimiter`.
  - Global : 600 req/min via `generalLimiter`.
  - Vidéo stream : 120 req/min/user.
  - Sonos : 120 req/min lecture, 60 req/min commandes.
- **Sanitation** :
  - `xssSanitize` sur inputs.
  - `sanitizePath()` sur uploads.
  - `DOMPurify` côté client (MailingPanel).
  - Regex safe CSS TV-client.
- **Uploads** : configs Multer centralisées, MIME allowlist, taille max par contexte (25 Mo messagerie, 50 Mo attachments/BL, 5 Mo avatar).
- **Guard JWT_SECRET** : `process.exit(1)` en production si secret par défaut.
- **Chiffrement AES-256-GCM** : refresh tokens Google, mots de passe RTSP caméras.
- **Deux authentifications personnelles complémentaires** :
  - Session personnelle 15 min (`/api/suivi/personal-auth`) pour tablette Équipe.
  - Action éphémère PIN/password (`/api/personal-actions/perform`, uniquement pour le compte Équipe partagé `TEAM_ACCOUNT_EMAIL`, actions supportées : `create_assignment`, `request_leave`, `declare_unavailability`). Journalisation `personal_actions_log`.
- **2FA TOTP** : endpoints `/api/auth/2fa/*` (`totpRoutes.js`, lib `otpauth@9.5.0`).

---

## 3. Stack technique complète

### 3.1 Backend

- Node.js 22 (`engines: >=22 <23`), ESM natif.
- Express 4.18.
- better-sqlite3 9.2 (synchrone, prepared statements).
- jsonwebtoken 9.
- bcrypt 6 (12 rounds).
- helmet 8, cors 2, compression 1.8, cookie-parser 1.4, express-rate-limit 8, multer 2.
- googleapis 171, sonos 1.14, nodemailer 8, node-fetch 3, otpauth 9.5.
- pdf-parse, pdfkit, pngjs, qrcode, sharp.
- xss, zod 4.
- ESLint 10 flat config, Prettier 3, nodemon 3.

Middlewares principaux :
- `middleware/authenticate.js` (JWT + session DB, cache 30s).
- `middleware/authorize.js` (requireAdmin + permissions granulaires).
- `middleware/sanitize.js` (XSS).
- `middleware/upload.js` (Multer par contexte).
- `middleware/errorHandler.js` + classe `AppError`.
- `middleware/tvAuth.js` (`verifyTvToken`, `optionalTvToken`).

Cache backend (`cache.js`, 5 instances LRU/TTL) :
- `authCache` (1000 entrées, 30s).
- `statsCache` (100, 20s).
- `listCache` (200, 30s).
- `iCalCache` (5 min).
- `configCache` (long TTL).

Migrations :
- 17 fichiers `apps/api/migrations/*.sql` + migrations dynamiques dans `database.js`.
- Migration Locmat dédiée (`migrations/locmat-import-v1.js`).
- Migration vidéo (`migrations/video-v1.js`).
- Migration `personal-actions-log-v1.js`.
- Journal `migrations_log` (name PK, applied_at).

Intégrations serveur :
- Google (OAuth2 Authorization Code, refresh chiffrés).
- Sonos (UPnP/SOAP LAN).
- MediaMTX (API REST + WHEP).
- NVR Dahua (recherche enregistrements).
- SMTP (Nodemailer).
- eShop fournisseur (`eshopCatalogSync.js`).

### 3.2 Frontend

- React 18.3, react-dom 18.3.
- Vite 5.2 (build), Vitest 4 (tests), @vitejs/plugin-react.
- ESLint 9 flat config, Prettier 3, stylelint 17, jsx-a11y, unused-imports, simple-import-sort.
- Storybook 8.6.
- lucide-react, date-fns 3, papaparse 5, dompurify 3, jspdf 4 + autotable, pdfjs-dist 5, qrcode.react, leaflet + react-leaflet, react-virtuoso, react-router-dom 7.
- @testing-library (dom, react, jest-dom, user-event), jsdom, terser.

Design System :
- Tokens CSS (`theme.css`) : couleurs, sémantique, texte, fonds, bordures, spacing (space-0 à space-24), typographie (font-2xs à font-4xl), radius (radius-xs à radius-full), ombres (shadow-xs à shadow-modal), z-index dédiés (base, dropdown, sticky, overlay, modal, modal-nested, popover, draggable, toast, tooltip), transitions (durations et easings).
- Catalogue 43 exports (atomes/molécules/organismes).
- Règles UX : modaux via portail, backdrop mouseDown, Escape ferme la couche haute, focus restauré, `:focus-visible`, validation blur + submit, toasts (success 3.5s, error 6s, warning 5s, info 4s), raccourcis Mod+1..5, Mod+M/N/T, F1, Escape.

Router :
- `useSearchParamState` (module, view, tab).
- `useMobileRouter` (hash mobile).
- Legacy: normalisation `lieux` → `annuaire`.

IndexedDB :
- Stores : auth, affaires, équipements, personnes, inventaire, Google sync et autres selon les versions.
- Recovery : `loadAuthFromIDB()` au boot, `saveAuthToIDB()` sur login/refresh.
- Clear complet : `clearAllIndexedDB()`.

Contextes :
- `AuthContext` (login/logout, currentUser, prefs).
- `PersonalAuthContext` (auth personnelle, auto-logout).

Hooks structurants :
- `useAppData`, `useGoogleCalendar`, `useGoogleSync`, `useSilentRefresh`, `useMessagingPolling`, `useDraggableModals`, `useTheme`, `useVSCodeTheme`, `useFeedback`, `useToast`, `useKeyboardShortcuts`, `useRefreshOnFocus`, `useStoredListState`, `useDocumentBadge`, `useUnsavedChangesGuard`, `useInventory`, `usePersonalActionGuard`, `usePersonalAuthWithAutoLogout`.

### 3.3 Base de données

- SQLite (better-sqlite3), fichier local `apps/api/vehicules.db` (configurable `DB_PATH`).
- Pragmas :
  - `foreign_keys = ON` (intégrité référentielle activée).
  - `journal_mode = WAL` (Write-Ahead Logging).
  - `synchronous = NORMAL` (compromis durabilité/perfo).
  - `wal_autocheckpoint = 1000` (checkpoint auto tous les 1000 pages).
  - `busy_timeout = 5000` (5 s).
  - Checkpoint `wal_checkpoint(FULL)` à la fermeture.
- Environ 86 tables déclarées (fourchette 84–87 selon migrations dynamiques et dates de rapports).
- 50+ index (couverture bonne pour la taille du domaine).
- ~120 clés étrangères.
- ~35 contraintes UNIQUE, ~15 CHECK enums.
- Migrations hybrides (SQL formels + inline).
- Journal `migrations_log` pour idempotence.

### 3.4 CI/CD

- **GitHub Actions** :
  - `ci.yml` : Lint & format (bloquant), tests backend (syntaxe + smoke-boot + node --test, bloquant), tests frontend Vitest (bloquant), build production Vite (bloquant, dépend des tests), commitlint (informatif sur PR), docs:check (informatif), ui-debt (Stylelint warn-only, informatif).
  - `protect-prod.yml` : Aucun fichier DB dans le diff, détection de secrets, résumé changements, label `safe-to-merge` (informatif).
  - `notify.yml` : Notifications restreintes à `main`/`prod` en cas d’échec CI (pas de spam sur `dev`).
- **Husky + lint-staged** :
  - Pre-commit : Prettier + ESLint quiet fix sur `.js/.jsx/.css` par workspace.
  - Pre-push : lint + format:check + tests frontend a minima.
- **Scripts NPM** clés (racine) : `dev:start`, `dev:reset-db`, `deploy`, `lint`, `format:check`, `check:syntax`, `check:db`, `db:migrate`, `audit:routes`, `audit:bundle`, `docs:check`, `test`, `test:api`, `test:coverage`, `smoke-test`, `smoke-boot`.

### 3.5 Sécurité (rappel synthétique)

Voir §2.17 pour le détail. Points saillants :
- 100 % prepared statements (0 injection SQL possible).
- Cookie httpOnly + SameSite + Secure prod.
- JWT_SECRET guard prod.
- AES-256-GCM sur secrets ciblés.
- Rate limiting différencié par classe.
- RBAC granulaire.
- 2FA TOTP disponible.
- 2 auth personnelles complémentaires (session + action éphémère).

### 3.6 Performance

- Cache LRU/TTL backend (5 instances, invalidation ciblée).
- Prepared statements + index métier.
- Batch queries (affaires, personnel).
- Compression gzip ≥1 KB.
- Frontend : lazy loading, code splitting, cache IndexedDB, refresh debounce, Suspense.
- Vitest et cache Vite mis en cache dans la CI.
- Chargement d’images optimisé (sharp côté backend).
- Bundle audit (`audit:bundle`, `audit:bundle:strict`).

### 3.7 Observabilité

- Logger conditionnel backend (`logger.js`), suppression console.log/info/debug en build production frontend (`esbuild.drop`).
- Endpoint santé : `GET /api/health` (vérifie DB, uptime, retourne 503 si erreur).
- Smoke boot backend : `npm run smoke-boot` (démarre + arrête proprement, échec CI si non).
- Smoke test API : `npm run smoke-test` (curl santé, retry 3x, timeout 8s, HTTP puis HTTPS fallback).
- Journal `migrations_log` pour tracabilité des migrations one-time.
- Journal `video_access_logs` pour traçabilité caméras.
- Journal `personal_actions_log` pour actions personnelles éphémères (context_user_id, actionType, personId, payload_hash).
- Journal `mail_history` pour envois email.
- Journal `display_logs` pour audit dashboard TV.
- Manque : pas d’APM centralisé (Sentry, OpenTelemetry) déclaré dans le stack observable.

---

## 4. Modules fonctionnels (détail exhaustif)

Format pour chaque module : rôle, flux, composants, endpoints, tables, interactions, risques techniques, risques métier, dette, opportunités.

### 4.1 Véhicules

- **Rôle** : registre du parc roulant, métadonnées d’identification, photos, couleurs, statut.
- **Flux métier** : création véhicule → mise à jour continue (km, statut) → rattachement aux réservations → suivi contrôles techniques → historisation maintenances → export photos et fiches.
- **Composants clés** : Calendar.jsx, formulaires véhicule, fiches détail, VehiclePanel, VehicleDialog, KilometrageControlModal, GoogleCalendarBanner.
- **Endpoints** : `/api/vehicles` (CRUD, cache 30s).
- **Tables** : `vehicles` (id TEXT PK, controles_techniques JSON), `reservations`, `maintenances`, `trip_details`, `trip_pauses`.
- **Interactions** : réservations, maintenances, planning, Google Calendar, conducteurs, mobile QR (`EMAG-XXXXX`).
- **Risques techniques** : `vehicles.assigned_to` sans FK vers persons ; structure véhicule enrichie et hétérogène.
- **Risques métier** : divergence possible entre données photo/couleur et réalité terrain ; absence historique de validation forte sur immatriculation.
- **Dette technique** : liens textuels vers affaire, historique de contrôles techniques dans JSON (`controles_techniques`) à normaliser à terme.
- **Opportunités** : consolidation persons ↔ drivers, extraction d’une table `technical_controls` normalisée, indexation FTS sur immatriculation.

### 4.2 Réservations

- **Rôle** : réservation de véhicules par période avec gestion des conflits.
- **Flux métier** : sélection d’un créneau (demi-journée AM/PM) → validation chevauchement → création réservation → rattachement affaire/client/conducteur → suivi statut → clôture ou annulation → génération de trajet et pauses éventuelles.
- **Composants clés** : Calendar.jsx (semaine/mois/année/planning), ReservationModal, ConflictWarning, GoogleCalendarBanner, TripEditor.
- **Endpoints** : `/api/reservations` (CRUD, cache 30s), `/api/google/sync/pull-reservations`.
- **Tables** : `reservations` (id TEXT PK, start/end_period, google_event_id, linked_event_ids JSON), `reservation_requests`, `trip_details`, `trip_pauses`.
- **Interactions** : véhicules, affaires, Google Calendar, planning, mobile, personnel (conducteur).
- **Risques techniques** : `affaire` en TEXT (pas de FK), déclenchement d’enrichissement automatique côté API.
- **Risques métier** : conflits non validés au-delà du chevauchement horaire (compétences, préférences, capacités) ; workflow non-admin `demande → approbation` sensible à l’absence de valideur.
- **Dette technique** : logique de conflit dispersée, trip_details/pauses partiellement normalisées.
- **Opportunités** : passage à un contrat clair de réservation avec validation multi-critères, intégration WebSocket pour partage temps réel.

### 4.3 Maintenances

- **Rôle** : suivre entretien, réparations, contrôles techniques, signalements de pannes.
- **Flux métier** : signalement (reported) → planification (scheduled) → exécution (in_progress) → clôture (completed) ; alertes email possibles ; historisation des coûts et du kilométrage.
- **Composants clés** : MaintenanceDialog, ControlsDashboard, ControlEditorModal.
- **Endpoints** : `/api/maintenances` (CRUD, cache 30s), endpoints de contrôles périodiques.
- **Tables** : `maintenances` (id TEXT PK, garage_id FK SET NULL, reported_by/created_by/modified_by).
- **Interactions** : véhicules, garages, planning, alertes email, dashboards, mobile.
- **Risques techniques** : `maintenances.vehicle_id` non NOT NULL contraint (orphelins possibles) ; recouvrement documentaire avec contrôles périodiques.
- **Risques métier** : mauvaise saisie du coût ou du kilométrage impactant les analyses de flotte.
- **Dette technique** : coexistence historique de deux systèmes (maintenance véhicule et contrôles périodiques).
- **Opportunités** : unifier les workflows d’intervention véhicule sous un modèle unique, ajouter automation de rappel préventif.

### 4.4 Planning (événements, tâches, récurrence, PDF, iCal, display)

- **Rôle** : orchestrer événements, tâches, sections, statuts d’affaires, exports et diffusion écran.
- **Flux métier** : création d’événements display → génération et affectation de tâches → gestion récurrence → rollover minuit → statuts d’affaires (`prep → charge → depart → route → montage → exploitation → demontage → retour → decharge → cloture`) → export PDF planning → publication iCal → alimentation TV-client.
- **Composants clés** : TaskPlanningPanel, DynamicDisplayDialog, EventTaskModal, TaskEditModal (avec sélecteur d’affaire), BLMultiImportModal, PDF planning.
- **Endpoints** : `/api/planning/display-events`, `/api/planning/bl-imports`, `/api/planning/bl-imports/batch`, `/api/planning/bp-items`, `/api/planning/tasks`, `/api/planning/tasks/batch`, `/api/planning/tasks/clear-completed`, `/api/planning/tasks/rollover`, `/api/planning/recurring-tasks`, `/api/planning/recurring-tasks/generate`, `/api/planning/planning-assignments`, `/api/planning/stats`, `/api/planning/planning-affaires`, `/api/planning/planning-affaires/:num/cycle-status`, `/api/planning/ical-calendars`, `/api/planning/ical-events`.
- **Tables** : `dynamic_display_events`, `task_assignments` (50+ colonnes, CHECK strict sur 15 sections), `bl_imports`, `bp_items`, `planning_hidden_affaires`, `planning_affaire_status`, `planning_event_status`, `planning_assignments`.
- **Interactions** : affaires, personnel, display, TV-client, iCal, PDF, BL/BP, Google Calendar.
- **Risques techniques** : `task_assignments` volumineuse et large (candidate au partitionnement) ; mélange tâches métier / affichage / statuts ; routes très longues (~2600 lignes).
- **Risques métier** : cascade opérationnelle (une tâche non terminée impacte plusieurs sections) ; dépendance à la rigueur d’exécution.
- **Dette technique** : couplage fort entre planning et display, faible séparation entre pilotage opérationnel et communication.
- **Opportunités** : découpage en sous-domaines (tasks vs events vs affaire-status vs BL/BP), pagination cursor-based, WebSocket pour statuts.

### 4.5 Personnel (missions, compétences, disponibilités, congés)

- **Rôle** : registre du personnel + compétences + planning RH + congés.
- **Flux métier** : création personne → qualification (compétences 18 base, positions 75+) → disponibilités et missions → assignations avec conflits → congés (workflow IDCC 3252).
- **Composants clés** : PersonnelPanel, PersonForm, PlanningRHView, LeaveRequestModal, PersonalAuthProvider, MobilePlanning.
- **Endpoints** : `/api/persons`, `/api/skills`, `/api/positions`, `/api/availabilities`, `/api/missions`, `/api/assignments`, `/api/personnel/planning`, `/api/leaves/*` (types, holidays, calculate, create, mine, pending, decision, sign, cancel, justification, balances, stats, conflicts, history, pdf).
- **Tables** : `persons`, `skills`, `person_skills`/`person_competences`, `positions`, `availabilities`, `missions`, `mission_assignments`, `leave_requests`, `leave_request_history`, `leave_balances`, `leave_votes`, `public_holidays`.
- **Interactions** : affaires, planning, réservations, équipements, mobile, actions personnelles (PIN/password).
- **Risques techniques** : coexistence historique persons ↔ drivers ; validation de conflits horaires personne/mission partielle ; calcul de solde de congés parfois côté client.
- **Risques métier** : non-conformité potentielle si le workflow congés IDCC 3252 n’est pas rigoureusement respecté (préavis 30j, min 12j consécutifs, deadline 28 février, auto-approbation interdite).
- **Dette technique** : dualité identité personnel/drivers, complexité UI planning.
- **Opportunités** : unification `persons` comme seule entité, calcul de solde centralisé backend, ajout d’une vue collégiale de validation congés.

### 4.6 Affaires (BL, BP, liens, historique, intégrations)

- **Rôle** : dossier projet transverse reliant client, dates, opérations, réservations, personnel, matériel, commandes, imports.
- **Flux métier** : création affaire → enrichissement automatique depuis réservations → liaison à Google Calendar → attachement de BL/BP → génération d’événements planning → suivi de statut d’affaire → soft delete.
- **Composants clés** : AffairesPanel, AffaireDetailPanel, AffaireLinksModal, BLMultiImportModal.
- **Endpoints** : `/api/affaires`, `/api/affaires/:id`, `/api/affaires/personnel-counts`, `/api/planning/bl-imports*`, `/api/planning/bp-items`.
- **Tables** : `affaires`, `affaire_links`, dérivées de `reservations.affaire`, `missions.affaire_id`, `bl_imports`, `bp_items`, `orders.affaire_id`.
- **Interactions** : planning, commandes, personnel, équipements, Google Calendar, pièces jointes, PDF, mobile.
- **Risques techniques** : enrichissement automatique sans ligne `affaires` explicite → affaires « virtuelles » ; liens textuels vers affaire dans reservations/missions ; suppression logique.
- **Risques métier** : incohérence entre vue affaires et réservations si une réservation référence un numero d’affaire jamais créé côté `affaires` ; risque de perte d’intégrité en cas de renumérotation.
- **Dette technique** : absence d’intégrité référentielle stricte au niveau DB ; mélange affaire virtuelle / affaire réelle.
- **Opportunités** : matérialisation stricte des affaires, FK explicites, table `affaire_history` pour audit trail complet.

### 4.7 Équipements (UID, serials, SAV, localisation multi-dépôt, Locmat)

- **Rôle** : parc matériel individualisé + SAV + localisation + synchronisation Locmat.
- **Flux métier** : création équipement (auto UID + serial) → assignation temporaire (personne/affaire) → localisation multi-dépôt en cascade → détection anomalies inventaire → ouverture ticket SAV (open → in_progress → waiting_parts → closed) → import intelligent Locmat (preview → confirm → logs) → sync SAV eM@g ↔ LocMat.
- **Composants clés** : EquipmentPanel, EquipmentDialog, EquipmentAssignmentModal, SavPanel, LocmatImportModal (onglets Suppressions/Doublons/Collisions), InventoryPanel, DepotMap.
- **Endpoints** : `/api/equipment`, `/api/equipment-categories`, `/api/equipment-assignments`, `/api/sav-tickets`, `/api/equipment-lists`, `/api/import/locmat/preview`, `/api/import/locmat/confirm`, `/api/import/locmat/logs`, `/api/inventory-locations`, `/api/sav` (comparator Locmat).
- **Tables** : `equipment`, `equipment_categories`, `equipment_assignments`, `sav_tickets`, `equipment_serials`, `equipment_lists`, `equipment_list_items`, `flightcases`, `truck_models`, `equipment_to_vehicle`, `bp_items`, `inventory_locations`, `inventory_price_history`, `inventory_anomalies`.
- **Interactions** : catalogue, stock, affaires, personnel, mobile (scan QR), chargement 3D.
- **Risques techniques** : trois systèmes de localisation coexistants (equipment_locations, inventory_locations, equipment_assignments) ; import Locmat sensible à la qualité des CSV ; UID historique parfois régénéré.
- **Risques métier** : divergence entre inventaire réel et base (matériel perdu, non enregistré, dupliqué en série).
- **Dette technique** : redondance de champs localisation (`location` legacy + structuré) ; couplage historique catalogue/équipement/inventaire.
- **Opportunités** : unification en un seul modèle de localisation, vue diagnostic d’orphelins, workflow SAV avec pièces détachées automatiques.

### 4.8 Catalogue (familles, flight-cases, camions, imports)

- **Rôle** : référence descriptive du matériel et des éléments logistiques.
- **Flux métier** : gestion familles/sous-familles/catégories (13 seedées) → catalogue d’articles de référence → flight-cases (modèles conteneurs) → modèles camions (dimensions cargo, hayons, chargement 3D) → import PDF/CSV fournisseur → deep linking chargement.
- **Composants clés** : CataloguePanel, FlightcasesPanel, TruckModelsPanel, ChargementDeepLink.
- **Endpoints** : `/api/catalog/*`, `/api/supplier-catalog/*` (filters, stats, quote-pdf).
- **Tables** : `equipment_catalog` (id TEXT PK), `flightcases`, `truck_models`, `equipment_to_vehicle`, `bp_items`, `supplier_articles`, `catalog_imports`.
- **Interactions** : équipements, stock, commandes, imports fournisseurs, chargement 3D.
- **Risques techniques** : frontière floue entre article catalogue, équipement individualisé, article stock et item BP ; qualité de matching dépendante des imports.
- **Risques métier** : erreur de matching = mauvaise préparation matériel sur affaire.
- **Dette technique** : redondance conceptuelle catalogue vs stock vs équipement.
- **Opportunités** : contrat de matching unifié, IA/ViT pour matching BL/BP (spec `Annotations_PDF_ViT.md`).

### 4.9 Stock (mouvements, catégories, seuils, imports)

- **Rôle** : suivi quantitatif des consommables et pièces SAV.
- **Flux métier** : création article (STK-* ou SAV-*) → fixation seuil min → mouvement (in/out/adjustment/return) → alerte bas stock → import batch → stats.
- **Composants clés** : StockPanel, StockMovementModal, StockImportModal, StockStats.
- **Endpoints** : `/api/stock/categories`, `/api/stock/items`, `/api/stock/movements`, `/api/stock/imports`, `/api/stock/stats`.
- **Tables** : `stock_categories`, `stock_items` (stock_type `vente`/`sav`), `stock_movements`.
- **Interactions** : commandes fournisseurs, BP, SAV, inventaire, affaires.
- **Risques techniques** : mouvements potentiellement non transactionnels sur cas limites ; `linked_entity_id` générique (pas de FK).
- **Risques métier** : incohérence entre stock affiché et réalité physique si mouvements omis.
- **Dette technique** : dénormalisation `user_name` dans mouvements ; référence article partagée entre plusieurs domaines.
- **Opportunités** : transactions atomiques strictes autour de chaque mouvement, vue diagnostic d’écarts.

### 4.10 Commandes fournisseurs (devis, demandes, réception, documents)

- **Rôle** : cycle achat complet (demande → devis → commande → réception).
- **Flux métier** : demande matériel (pending → needs_review → approved → ordered) → devis (draft → sent → accepted/refused → converted_to_order) → commande PO-YYYY-### (draft → sent → confirmed → partial → received) → réception ligne à ligne → documents fournisseurs → PDF PO.
- **Composants clés** : OrdersPanel, OrderDetailPanel, QuoteEditor, MaterialRequestModal, SupplierDocumentsPanel.
- **Endpoints** : `/api/suppliers`, `/api/orders`, `/api/orders/stats`, `/api/orders/my-linked`, `/api/orders/:id/items`, `/api/quotes`, `/api/material-requests`, `/api/supplier-documents`.
- **Tables** : `suppliers`, `orders`, `order_items`, `quotes`, `quote_items`, `material_requests`, `supplier_documents` (selon état documentaire).
- **Interactions** : annuaire fournisseurs, stock, affaires, catalogue fournisseur, PDF, mailing.
- **Risques techniques** : transitions d’état validées server-side mais parfois divergentes de la doc ; couplage entre demande/devis/commande imparfait.
- **Risques métier** : réception partielle mal saisie → écart stock ; document fournisseur manquant → litige.
- **Dette technique** : mailing d’alerte fournisseur non automatisé, notifications faibles.
- **Opportunités** : notification e-mail automatique à chaque transition majeure, indicateurs fournisseurs (délai moyen, taux de conformité).

### 4.11 Annuaire (clients, fournisseurs, prestataires, contacts, validations)

- **Rôle** : carnet d’adresses unifié multilingue avec validations métier.
- **Flux métier** : création entité (client/fournisseur/prestataire) → validation SIRET Luhn 14 chiffres → validation TVA intra (FR + 11 chiffres) → normalisation téléphone → ajout contacts multiples → recherche FTS globale → import CSV UPSERT (dont Locmat Clients CSV).
- **Composants clés** : AnnuairePanel, EntityForm, ContactForm, ImportModal.
- **Endpoints** : `/api/annuaire/clients`, `/api/annuaire/suppliers`, `/api/annuaire/prestataires`, `/api/annuaire/contacts`, `/api/annuaire/lookups`, `/api/annuaire/search`, `/api/annuaire/import`, `/api/annuaire/import/clients-csv`.
- **Tables** : `clients` (enrichi), `suppliers` (enrichi), `prestataires`, `annuaire_contacts` (code_libre UNIQUE), `annuaire_legal_structures` (22 seedées), `annuaire_service_types` (24), `annuaire_activity_sectors` (16), `annuaire_contact_categories` (11).
- **Interactions** : affaires, commandes, stock, mailing, communication, mobile.
- **Risques techniques** : duplication assumée entre entités enrichies ; code_libre libre → risque collision métier.
- **Risques métier** : SIRET non cross-checké temps réel avec sources externes → validité seulement locale (Luhn).
- **Dette technique** : dénormalisation clients/suppliers/prestataires ; sanitisation XSS parfois localisée.
- **Opportunités** : intégration à INSEE Sirene API, factorisation d’une entité entreprise commune.

### 4.12 Communication (notes, événements, affichage)

- **Rôle** : coordination interne visible en app et sur écrans TV.
- **Flux métier** : création note interne → événement d’entreprise (visibilité toggle écran) → publication display → archivage.
- **Composants clés** : CommunicationPanel, EventEditor, NotesPanel.
- **Endpoints** : `/api/communication/*` (historique), `/api/planning/display-events`, `/api/display/messages`.
- **Tables** : `dynamic_display_events`, `communication_notes` (selon état documentaire), `display_messages`, `display_welcome_messages`, `display_color_rules`.
- **Interactions** : planning, display, TV-client, mailing, Sonos (alarme).
- **Risques techniques** : périmètre réparti entre planning et display (ambiguïté).
- **Risques métier** : information critique manquée si non diffusée sur les bons canaux.
- **Dette technique** : deux systèmes coexistants (planning display events + display messages).
- **Opportunités** : unification en une plateforme de communication interne unique avec canaux dédiés.

### 4.13 Messagerie interne

- **Rôle** : canal de conversation interne 1:1 ou groupe avec pièces jointes.
- **Flux métier** : création conversation (déduplication direct) → message texte ou fichier → marquage lu → badge non-lus.
- **Composants clés** : MessagingPanel, ChatWindow, AttachmentUploader, MessagingBadge.
- **Endpoints** : `/api/messaging/conversations`, `/api/messaging/conversations/:id/messages`, `/api/messaging/conversations/:id/messages/file`, `/api/messaging/unread-count`.
- **Tables** : `conversations`, `conversation_participants`, `messages`, `message_attachments`.
- **Interactions** : auth utilisateur, profils, mobile, notifications UI.
- **Risques techniques** : polling seulement, pas WebSocket ; latence 10s sur les non-lus ; charge fichiers vidéo max 25 Mo sans compression client.
- **Risques métier** : messages critiques perçus tardivement.
- **Dette technique** : pas de chiffrement E2E, pas de push notif.
- **Opportunités** : WebSocket, push, compression client, mentions et threads.

### 4.14 Mailing

- **Rôle** : envoi groupé d’emails via templates.
- **Flux métier** : création template (subject, html_body, variables JSON, category) → sélection destinataires (via annuaire) → envoi SMTP → journalisation dans mail_history.
- **Composants clés** : MailingPanel, TemplateEditor (avec DOMPurify), SendCampaignModal.
- **Endpoints** : `/api/mailing/templates`, `/api/mailing/send`, historique et config.
- **Tables** : `email_config`, `mail_templates`, `mail_history`.
- **Interactions** : annuaire, auth admin, notifications, SMTP.
- **Risques techniques** : `email_config.smtp_pass` historiquement en clair (audit) — vérifier statut actuel ; XSS possible sans DOMPurify côté rendu.
- **Risques métier** : envoi à mauvais destinataire, contenu incorrect.
- **Dette technique** : pas d’AB testing, pas de suivi ouverture/click natif.
- **Opportunités** : chiffrement SMTP en base, prévisualisation destinataires, statistiques d’ouverture.

### 4.15 Vidéo (caméras, RTSP, WebRTC, NVR, MediaMTX)

- **Rôle** : intégration vidéosurveillance avec streaming, snapshot, PTZ et recherche d’enregistrements.
- **Flux métier** : configuration caméra (chiffrement password RTSP) → construction URL RTSP profil marque → publication vers MediaMTX (paths cam-{id}, sourceOnDemand) → exchange WHEP côté frontend (WebRTC) → snapshot HTTP → PTZ → recherche enregistrements NVR (Dahua) → journalisation accès.
- **Composants clés** : VideoPanel, CameraStreamPlayer, PresetDetachedView, RecordingsSearchModal.
- **Endpoints** : `/api/video/cameras`, `/api/video/cameras/:id/stream`, `/api/video/cameras/:id/snapshot`, `/api/video/cameras/:id/ptz`, `/api/video/recordings/search`, `/api/video/access-logs`, `/api/video/tv/cameras`, `/api/video/tv/cameras/:id/whep`.
- **Tables** : `video_cameras` (rtsp_url, rtsp_port, http_port, ptz_supported, brand, model), `video_access_logs`.
- **Interactions** : MediaMTX, NVR Dahua, MediaMTX PM2, TV-client, auth admin.
- **Risques techniques** : dépendance forte au réseau local ; MediaMTX peut être un SPOF ; charge WebRTC sur proxy.
- **Risques métier** : traçabilité RGPD des accès vidéo à vérifier ; conservation d’enregistrements NVR à border juridiquement.
- **Dette technique** : profils RTSP par marque (Dahua/Ezviz/Hikvision) codés en dur.
- **Opportunités** : découverte automatique (ONVIF), gestion multi-NVR, indicateurs de santé caméra.

### 4.16 Display / TV-client (écrans, playlists, médias, messages, couleurs, Sonos)

- **Rôle** : affichage dynamique complet + intégration Sonos + alarme sonore.
- **Flux métier** : configuration écran (name, layout, orientation, playlist_id, token unique) → playlist (transition fade/slide/none, default_duration) → items multiples (media/message/template/url/event) → apparence (colorRules, iconRules, welcomeMessages) → publication événements du jour → widget Sonos → alarme (test admin + échéance tâche côté TV-client).
- **Composants clés** : DisplayDashboardPanel (21 composants), ScreensPanel, PlaylistsPanel, MediaLibrary, MessagesPanel, ColorRulesPanel, WelcomePanel, SonosTab, SneakyPanel.
- **Endpoints** : `/api/display/screens`, `/api/display/playlists`, `/api/display/media/upload`, `/api/display/messages`, `/api/display/alarm/test`, `/api/display/current-affaires` (TV token), `/api/display/tv-public-state` (agrégat public TV).
- **Tables** : `display_screens`, `display_playlists`, `display_playlist_items`, `display_templates`, `display_messages`, `display_media`, `display_logs`, `display_config`, `display_welcome_messages`, `display_color_rules`, `display_location_icon_rules`, `display_completed_events`.
- **Interactions** : planning, affaires, Sonos, TV-client, mailing (mailing des events), attachments.
- **Risques techniques** : API display très large ; TV-client gelé (drift possible) ; alarme sonore dépendante de l’autoplay.
- **Risques métier** : message critique non affiché si l’écran n’a plus de heartbeat.
- **Dette technique** : responsabilité mêlée information/habillage/signal ; historique de path traversal sur `/api/display/gifs/:filename`.
- **Opportunités** : versioning contractuel de `/api/display/tv-public-state`, séparation en modules `display-config`, `display-content`, `display-signals`.

### 4.17 Mobile (PWA, QR codes, écrans dédiés, navigation hash)

- **Rôle** : expérience terrain dédiée pour usages rapides.
- **Flux métier** : détection mobile → hash router `#/mobile/<screen>` → écrans dédiés (home, planning, réservations, équipement, inventaire, messagerie, dashboard admin, contrôles) → QR codes matériel (`EMAG-XXXXX`) → PWA installable.
- **Composants clés** : MobileApp, MobileHome, MobilePlanning, MobileAffaires, MobileAvailability, MobileEquipment, MobileInventory, MobileMessaging, MobileDashboardAdmin, MobileControlsScreen.
- **Endpoints** : réutilise les endpoints REST du frontend principal.
- **Tables** : identiques au desktop ; IndexedDB pour cache local ; manifest.json + sw.js + sw-register.js.
- **Interactions** : QR codes, IndexedDB, auth, planning, équipements, messagerie, contrôles véhicules.
- **Risques techniques** : couche mobile parallèle au desktop ; offline-first non stabilisé (`sw-cleanup.js` reste comme kill switch).
- **Risques métier** : rupture d’expérience entre desktop et terrain.
- **Dette technique** : duplication logique planning/réservations, hash router maison.
- **Opportunités** : convergence mobile-first, offline-first ciblé, queue de mutations debounced avec replay online.

---

## 5. Base de données complète

### 5.1 Schéma global

- Environ 86 tables opérationnelles (fourchette 84–87).
- ~2100 colonnes, ~120 clés étrangères, ~35 UNIQUE, ~15 CHECK enums, 50+ index.
- ~180 enregistrements de seed (skills, positions, jours fériés France 2025–2027, catégories équipement, lookups annuaire).

### 5.2 Domaines fonctionnels

- Authentification et sessions (7 tables).
- Véhicules, réservations, trajets (7 tables).
- Maintenance et contrôles (1 table principale + garages).
- Personnel et planning RH (14 tables).
- Congés (public_holidays, leave_balances, leave_requests, leave_request_history, leave_votes).
- Affaires (2 tables).
- Équipements et SAV (4 tables).
- Catalogue et logistique 3D (5 tables).
- Stock (3 tables).
- Commandes et fournisseurs (5 tables + documents fournisseurs).
- Annuaire (8 tables).
- Communication et display (17 tables).
- Messagerie (4 tables).
- Mailing (2 tables).
- Vidéo (2 tables selon la version).
- Inventaire (3 tables).
- Migrations, historique (2 tables).

### 5.3 PK, FK, index

- PK entières AUTOINCREMENT dominantes ; PK TEXT sur `vehicles`, `reservations`, `maintenances`, `equipment_catalog`, `flightcases`, `truck_models`.
- FK actives : CASCADE (vehicles → reservations/maintenances, persons → availabilities/leave_balances/mission_assignments/equipment_assignments, missions → mission_assignments, orders → order_items, quotes → quote_items).
- FK SET NULL : `maintenances.garage_id`, `orders.supplier_id`, `messages.sender_id`.
- Index critiques : email, reset_token, sessions user/expires, vehicles type/registration, reservations vehicle/dates/affaire, persons type/status/user_id, availabilities dates, missions dates, maintenances vehicle/status/date, equipment uid (UNIQUE), stock_items category/location_zone, stock_movements item, ta_date/person/section/status, dde_date/affaire/type, contacts/clients/suppliers/prestataires code_libre (UNIQUE).

### 5.4 Tables critiques

- `users`, `active_sessions` (auth).
- `vehicles`, `reservations`, `maintenances` (flotte).
- `persons`, `missions`, `mission_assignments`, `availabilities`, `leave_requests` (personnel/congés).
- `affaires`, `affaire_links` (colonne vertébrale).
- `equipment`, `equipment_assignments`, `sav_tickets` (parc).
- `stock_items`, `stock_movements` (stock).
- `orders`, `order_items` (commandes).
- `dynamic_display_events`, `task_assignments` (planning).
- `display_screens`, `display_playlists`, `display_media` (affichage).
- `conversations`, `messages` (messagerie).
- `bl_imports`, `bp_items` (imports).
- `inventory_locations`, `inventory_anomalies` (inventaire).
- `video_cameras`, `video_access_logs` (vidéo).
- `migrations_log` (idempotence).

### 5.5 Migrations formelles vs dynamiques

- Migrations formelles : `apps/api/migrations/*.sql` + modules `.js` (locmat-import-v1, video-v1, personal-actions-log-v1, etc.).
- Migrations dynamiques : détection colonnes via `PRAGMA table_info`, ajouts conditionnels, reconstructions de tables (task_assignments à plusieurs reprises).
- Journal `migrations_log` (name PK) empêche les rejeux.
- Reconstructions transactionnelles pour préserver la donnée (task_assignments notamment).

### 5.6 Intégrité référentielle

- Forces : FK activées, CASCADE cohérents, UNIQUE contraignant les identifiants métier, CHECK sur enums.
- Limites : liens texte (affaire, trip_group_id, source_id, linked_entity_id) → intégrité applicative uniquement ; `maintenances.vehicle_id` non NOT NULL contraint historiquement ; `equipment.category_id` SET NULL possible.

### 5.7 Risques DB

- Divergence documentation/schéma effectif si migrations dynamiques non re-documentées.
- Croissance de `task_assignments` (design smell : 50+ colonnes).
- Duplication persons ↔ drivers.
- Redondance localisation (equipment/inventory/stock).
- Absence de sauvegarde automatisée versionnée (script backup exist mais pas d’orchestration systématique).

### 5.8 Optimisations possibles

- Partitionnement vertical de `task_assignments` (sections dans tables filles).
- Vues matérialisées pour missions/task summaries.
- Vues de diagnostic d’orphelins métier.
- Index composites supplémentaires sur les plans de requêtes réels (planning, affaires, display).
- Playbook de migration versionné, généré à partir d’un manifeste unique.

### 5.9 Normalisation recommandée

- Un modèle personnes unifié.
- Une table `technical_controls` normalisée hors JSON.
- Une seule table de localisation avec vue de compatibilité.
- Un modèle affaire strictement matérialisé (fin de l’enrichissement virtuel).
- Un modèle générique de rattachement inter-domaines (au lieu de linked_entity_id texte).

---

## 6. API backend complète

### 6.1 Organisation des routes

- Route par domaine métier (auth, admin, véhicules, affaires, personnel, planning, équipements, catalogue, commandes, stock, annuaire, display, Sonos, vidéo, mailing, messagerie, pièces jointes, profil, Google, TOTP, actions personnelles, inventaire, Locmat, SAV).
- Fichiers principaux : `authRoutes.js`, `adminRoutes.js`, `vehicleRoutes.js`, `routes.js` (référentiels), `affairesRoutes.js`, `personnelRoutes.js`, `planningRoutes.js`, `catalogRoutes.js`, `equipmentRoutes.js`, `displayRoutes.js`, `sonosRoutes.js`, `annuaireRoutes.js`, `leaveRoutes.js`, `ordersRoutes.js`, `stockRoutes.js`, `mailingRoutes.js`, `messagingRoutes.js`, `attachmentsRoutes.js`, `profileRoutes.js`, `googleRoutes.js`, `totpRoutes.js`, `personalActionsRoutes.js`, `videoRoutes.js`, `inventoryRoutes.js`, `locmatImportRoutes.js`, `savRoutes.js`, `supplierCatalogRoutes.js`.

### 6.2 Middlewares transverses

- `compression` (gzip ≥1 KB).
- `helmet` (headers sécurité).
- `corsMiddleware` (whitelist ALLOWED_ORIGINS).
- `cookieParser`.
- `xssSanitize`.
- Rate limiters : `authLimiter`, `sensitiveEndpointLimiter`, `generalLimiter`, plus limiters spécialisés (video, sonos, personal-actions).
- `authenticateToken` (avec cache 30s dans `authCache`).
- `requireAdmin` / `requirePermission` / `verifyTvToken` / `optionalTvToken`.
- `validate(schema)` (Zod).
- `errorHandler` central.

### 6.3 Patterns API

- REST JSON.
- Réponses `{ success, data, message, error }`.
- Filtres via query string.
- Pagination majoritairement offset-based (cursor-based en roadmap).
- Cache avec invalidation ciblée post-mutation.
- Batch endpoints ponctuels (`/api/planning/tasks/batch`, `/api/planning/bl-imports/batch`).

### 6.4 Sécurité API

- Auth JWT httpOnly + session DB.
- Sanitation entrée + validation Zod pour flux sensibles (imports, actions personnelles, vidéo, annuaire).
- RBAC granulaire.
- Rate limits différenciés.
- Chiffrement AES-256-GCM pour secrets sensibles.
- TV token pour endpoints display/vidéo TV.

### 6.5 Endpoints critiques

- Auth : `login`, `logout`, `refresh`, `change-password`, `set-new-password`.
- Réservations : `POST /api/reservations`, `POST /api/google/sync/pull-reservations`.
- Personnel : `POST /api/persons`, `POST /api/assignments`, `PUT /api/availabilities/:id/approve`.
- Congés : `POST /api/leaves`, `PUT /api/leaves/:id/decision` (auto-approbation bloquée).
- Affaires : `GET /api/affaires`, `POST /api/planning/bl-imports/batch`.
- Équipements : `POST /api/import/locmat/confirm`, `POST /api/equipment-assignments`, `PUT /api/sav-tickets/:id`.
- Stock : `POST /api/stock/movements`.
- Commandes : `PUT /api/orders/:id` (validation transitions).
- Annuaire : `POST /api/annuaire/import`.
- Display : `GET /api/display/tv-public-state`, `POST /api/display/alarm/test`.
- Sonos : `GET /api/sonos/now-playing`, `POST /api/sonos/play/:zone`.
- Vidéo : `GET /api/video/cameras/:id/stream`, `GET /api/video/recordings/search`.
- Google : `GET /api/google/auth`, `POST /api/google/sync/pull-reservations`.
- Health : `GET /api/health`.

### 6.6 Cohérence des payloads

- Cohérence globale bonne, mais certains domaines évoluent plus vite que la doc. Les payloads critiques sont documentés dans `docs/api/*`.
- Contrat public TV agrégé (`tv-public-state`) : point de vigilance vis-à-vis du TV-client gelé.

### 6.7 Erreurs et validations

- Codes HTTP standards : 400, 401, 403, 404, 409, 500, 503 (santé).
- Erreurs typées via `AppError`.
- Validations Zod ciblées : imports (equipment, personnel, SAV, affaires, Locmat), video, actions personnelles.
- Transitions d’état validées server-side : SAV (`VALID_SAV_TRANSITIONS`), orders (`ORDER_TRANSITIONS`), missions, leaves.

### 6.8 Performance API

- Cache LRU/TTL, batch queries, prepared statements, index.
- Compression gzip.
- Absence de WebSocket → polling contrôlé par cache client.
- Rate limits garants d’une charge maîtrisée.

### 6.9 Recommandations

- Introduire un versioning API v2 avec deprecation contrôlée.
- Généraliser la pagination cursor-based sur les listes volumineuses.
- Formaliser un contrat schéma OpenAPI/Zod exportable.
- Ajouter WebSocket pour messagerie et display.
- Ajouter un endpoint d’état d’intégration global (Google, Sonos, MediaMTX, SMTP).

---

## 7. Frontend React complet

### 7.1 Architecture des composants

- `App.jsx` : orchestration (auth, thème, données, navigation, overlays, desktop/mobile).
- `AppChrome` (header + sidebar), `ModuleHost` (module actif), `GlobalOverlays` (modals, dialogs, drawers), `AppStatusBar`.
- Panneaux métier lazy-loadés : Calendar, PersonnelPanel, AffairesPanel, TaskPlanningPanel, OrdersPanel, StockPanel, AnnuairePanel, CommunicationPanel, DisplayDashboardPanel, MessagingPanel, MailingPanel, ManagementPanel, EquipmentPanel, CataloguePanel, InventoryPanel, VideoPanel, SonosTab.
- `MobileApp` : sous-application mobile complète.

### 7.2 Hooks principaux

- `useAppData` : batch fetch + IndexedDB sync (debounce).
- `useGoogleCalendar` + `useGoogleSync` : polling Google 5 min + leader election BroadcastChannel + cache IDB.
- `useSilentRefresh` : renouvellement JWT.
- `useMessagingPolling` : non-lus 10 s.
- `useSearchParamState` : sync état ↔ URL.
- `useMobileRouter` : hash mobile.
- `useDraggableModals` : modals draggables.
- `useTheme` / `useVSCodeTheme` : thèmes.
- `useFeedback` / `useToast` : retours utilisateur.
- `useKeyboardShortcuts` : Mod+1..5, Mod+M/N/T, F1.
- `useRefreshOnFocus` : recharge onglet retour focus (throttle).
- `useStoredListState` : useState + storage.
- `useDocumentBadge` : badge favicon.
- `useUnsavedChangesGuard` : beforeunload.
- `useInventory`, `usePersonalActionGuard`, `usePersonalAuthWithAutoLogout`.

### 7.3 Lazy loading

- Chargement lazy pour tous les gros panneaux et plusieurs overlays.
- Suspense + fallback `AppShellFallback`.
- Split explicite entre desktop et mobile (MobileApp lazy).

### 7.4 IndexedDB

- Stores : auth (recovery), affaires, équipements, personnes, inventaire, googleSync, éventuels caches complémentaires.
- Utilisation : reprise d’état + cache de continuité + fallback offline dégradé.
- Ce n’est pas encore un socle offline-first complet (pas de queue de mutations).

### 7.5 Navigation desktop/mobile

- Desktop : `?module=...&view=...&tab=...`.
- Mobile : hash `#/mobile/<screen>`.
- Deep links depuis QR codes matériel.
- Détachement Sonos en pop-up dédiée.

### 7.6 Modals et a11y

- Modal unifié `components/ui/Modal.jsx` : prop `open` (canonical), `useId` pour aria-labelledby, ModalManager global (portail unique `#emag-modal-root`, pile z-index, scroll lock compté).
- Constantes : `Z_BACKDROP_BASE=9000`, `Z_DIALOG_BASE=10000`, `Z_STEP=10`.
- Règle stricte : ne pas wrapper `<Modal>` dans un `createPortal` externe.
- Focus restauré à la fermeture, autofocus premier input, Tab séquentiel.
- Roll-back de scroll géré via useLayoutEffect.

### 7.7 Design System

- 43 exports UI documentés (atomes/molécules/organismes) + composants existants refactorisés (Card, Panel, SectionHeader, Table, ScrollArea, FormField).
- Tokens CSS : couleurs, sémantique, textes, fonds, bordures, spacing, typo, radius, ombres, z-index, transitions.
- Thèmes light/dark + palette configurable + thème VS Code.
- Règles UX explicites (voir §3.2).
- Adoption mesurée via Stylelint et `measure-ui-debt.mjs` (informatif CI).

### 7.8 Patterns React

- Composants fonctionnels + hooks.
- Suspense + lazy.
- Contextes limités et ciblés.
- Barrières d’erreur (`ErrorBoundary`).
- Client API en singleton avec bus d’événements réseau.
- Séparation présentation / orchestration / client API.

### 7.9 Points de fragilité

- Duplication logique desktop/mobile.
- Polling omniprésent (charge perçue).
- Panneaux monolithiques massifs.
- Coordination refresh + cache + IDB délicate.
- Accessibilité inégale sur anciens modules.

### 7.10 Recommandations

- Extraire des sous-modules autonomes (planning, personnel, affaires) chargés à la demande.
- Introduire un cadre WebSocket + refresh push.
- Aligner desktop et mobile sur les composants du Design System.
- Faire monter en gamme l’a11y (audit clavier, ARIA, contraste).
- Généraliser Storybook comme surface qualité UI.

---

## 8. Sécurité complète

### 8.1 JWT + sessions

- Token JWT signé HS256, cookie httpOnly `auth_token`, SameSite=lax, Secure en production.
- Guard `JWT_SECRET` : arrêt du serveur en production si secret par défaut.
- Sessions `active_sessions` (token_hash SHA-256, expires_at, last_activity).
- Nettoyage sessions expirées (à automatiser dans les scénarios de long terme).
- Silent refresh 12 h côté client.
- IDB recovery si cookie perdu (BroadcastChannel-friendly).

### 8.2 OAuth2 Google

- Authorization Code flow backend uniquement.
- state anti-CSRF validé côté callback.
- Refresh token chiffré AES-256-GCM en base.
- Scopes : `https://www.googleapis.com/auth/calendar`.
- Quota 60 req/min (120 en dev), gestion des erreurs `rate limit exceeded`.

### 8.3 Uploads

- Multer centralisé par contexte (attachments, avatars, messaging-uploads, display-media, supplier-docs, bl-imports, pv).
- MIME allowlist strict, SVG bloqué.
- Taille max : 25 Mo messagerie, 50 Mo attachments/BL, 5 Mo avatar.
- `sanitizePath()` sur tous les uploads (anti path traversal).
- Nettoyage périodique des fichiers orphelins.

### 8.4 Rate limiting

- Auth : 5 req/15 min (50 dev).
- Sensible : 10 req/15 min.
- Global : 600 req/min.
- Vidéo stream : 120 req/min/user.
- Sonos : 120 lecture, 60 commandes.
- Actions personnelles : `personalActionsLimiter` dédié.

### 8.5 XSS, CSRF, path traversal

- XSS : React échappe, DOMPurify sur HTML brut (MailingPanel), xssSanitize inputs, CSS TV-client validé par regex safe.
- CSRF : cookie httpOnly + SameSite ; renforcer par tokens explicites sur mutations critiques si non couvertes actuellement.
- Path traversal : `sanitizePath()`, correction historique sur `/api/display/gifs/:filename`.

### 8.6 Permissions (RBAC)

- Rôle admin `is_admin`.
- Permissions : `can_manage_catalog`, `can_manage_trucks`, `can_manage_equipment` (implicite via `requireEquipmentMaintenanceAccess`).
- Middleware `requireAdmin` sur mutations sensibles.
- Comptes spécialisés : `TEAM_ACCOUNT_EMAIL` (compte Équipe partagé, seul autorisé sur `/api/personal-actions/perform`).

### 8.7 Logs sensibles

- Console strip en production (log/info/debug).
- warn/error conservés côté client.
- Journal `personal_actions_log` avec hash de payload.
- Journal `video_access_logs`, `display_logs`, `mail_history`.
- Absence d’APM externalisé : recommandé pour la roadmap.

### 8.8 Risques résiduels

- Couverture CSRF explicite à confirmer sur toutes mutations.
- Nettoyage sessions expirées à automatiser.
- Alarme sonore TV : dépendance à l’autoplay et à la disponibilité audio.
- Gestion des secrets locaux (SMTP, RTSP, GOOGLE_ENCRYPTION_KEY, JWT_SECRET) : discipline opérationnelle nécessaire.

### 8.9 Recommandations

- Ajouter tests de régression sécurité sur endpoints fichiers/médias.
- Étendre TOTP à tous les comptes admin sensibles.
- Chiffrer `email_config.smtp_pass` en base.
- Rotation régulière des clés AES et JWT.
- Politique CORS documentée dans un manifeste versionné.

---

## 9. Performance complète

### 9.1 Backend

- Prepared statements 100 %.
- Cache LRU/TTL (auth, list, stats, iCal, config).
- Batch queries pour affaires/personnel.
- Compression gzip.
- Index métier ciblés.
- Cache 30s sur listes véhicules/reservations/maintenances.
- Cache 60s référentiels (clients, drivers, locations, garages).

### 9.2 Frontend

- Lazy loading + code splitting.
- IndexedDB comme cache de continuité.
- Debounce sur refresh.
- Suspense fallback léger.
- `console.log/info/debug` supprimés en production (esbuild).
- Bundle audit (`audit:bundle`, `--strict`).

### 9.3 DB

- SQLite WAL, checkpoint auto.
- Index couvrants pour la plupart des chemins chauds.
- Points de vigilance : task_assignments, dynamic_display_events, bl_imports, sav_tickets, orders, planning_affaires.

### 9.4 CI/CD

- Cache Node + cache Vite dans la CI.
- Concurrency cancel-in-progress sur push successifs.
- Séparation bloquant / informatif.
- Smoke boot rapide.

### 9.5 Modules lourds

- Planning, Personnel, Affaires, Équipements, Display, Orders.
- Enjeux : taille des routeurs, complexité des vues, densité des données.

### 9.6 Recommandations

- Pagination cursor-based sur listes de plus de 5 000 items.
- Introduction de WebSocket pour éviter le polling sur planning et messagerie.
- Extraction de vues matérialisées ou de tables filles pour task_assignments.
- Profiling ponctuel des plans de requêtes SQLite via `EXPLAIN QUERY PLAN`.

---

## 10. UX / UI complète

### 10.1 Cohérence visuelle

- Tokens Design System partagés.
- Thèmes light/dark cohérents.
- Modals unifiés.
- Iconographie lucide-react.

### 10.2 Flows critiques

- Réserver un véhicule.
- Créer / enrichir une affaire.
- Affecter personnel (mission + assignation).
- Localiser / assigner du matériel.
- Traiter une demande de congé.
- Créer une tâche ou événement display.
- Émettre une commande fournisseur.
- Opérer en mode terrain (mobile, QR, TV-client).

### 10.3 Responsive

- Desktop et mobile en couches parallèles.
- TV-client statique full HD.
- Modals adaptés (92–96 vw mobile).
- Cibles tactiles min 44×44 px.

### 10.4 Feedback utilisateur

- Toasts, badges, dialogues, overlays.
- Statuts colorés cohérents (danger, success, warning, info).
- Prompts de confirmations sur mutations sensibles.
- Alarme sonore TV pour tâches critiques.

### 10.5 Points de friction

- Charge cognitive élevée sur modules riches.
- Vocabulaire spécifique (BL, BP, Locmat, sections planning).
- Latence perçue sur polling (Google 5 min, non-lus 10 s).
- Densité de formulaires sur affaires/équipements.

### 10.6 Recommandations

- Simplification progressive des écrans les plus chargés.
- Onboarding contextuel (tooltips, guides).
- Vues résumées par affaire (« dashboard affaire »).
- Harmonisation des icônes et statuts entre modules.

---

## 11. Accessibilité complète

### 11.1 État actuel

- Modals unifiés, portail dédié, focus management.
- eslint-plugin-jsx-a11y en warn.
- Reduced-motion respecté sur transitions.
- Skip links possibles à généraliser.

### 11.2 Problèmes connus

- Couverture ARIA hétérogène sur anciens modules.
- Tables denses accessibles clavier partiellement.
- Contraste à vérifier dans tous les thèmes.
- Focus management dans cascades modal + drawer sensible.

### 11.3 Règles WCAG 2.1 AA concernées

- 1.4 Perception (contrastes).
- 2.1 Navigation clavier.
- 2.4 Navigation et focus.
- 3.3 Aide à la saisie et erreurs.
- 4.1 Robustesse ARIA.

### 11.4 Corrections nécessaires

- Audit clavier systématique par module.
- Harmonisation labels, descriptions, aria-invalid, aria-describedby.
- Attention aux tables lourdes (Planning, Personnel, Equipment).
- Renforcement des annonces d’erreur (live regions).

### 11.5 Priorisation

- Haute : auth, modals critiques, planning, personnel, mobile terrain.
- Moyenne : stock, commandes, annuaire, mailing.
- Continue : display admin, vidéo, écrans secondaires.

---

## 12. CI/CD & Gouvernance complète

### 12.1 Branches

- `main` : production, protégée.
- `dev` : intégration.
- `feature/*`, `bugfix/*`, `hotfix/*` : travail courant, conventional commits recommandés.

### 12.2 PR

- CI complète sur PR (`ci.yml`).
- Contrôles additionnels sur PR vers main (`protect-prod.yml`).
- Label `safe-to-merge` (informatif).
- Notifications restreintes aux branches critiques (`notify.yml`).

### 12.3 Tests

- Backend : `node --test` (unit, schemas, db-init, audit-fixes, sav-comparator, cache, sentry, pagination, captcha, bp-items-grouping, personal-actions, locmat-import(-integration), api-integration).
- Frontend : Vitest.
- Smoke boot backend : `smoke-boot` (démarrage propre sans scheduler).
- Smoke test API (post-deploy) : `smoke-test` + curl santé.

### 12.4 Lint

- Backend : ESLint 10, `--max-warnings=0`.
- Frontend : ESLint 9 flat + jsx-a11y + unused-imports + simple-import-sort.
- Prettier 3 : `format:check` bloquant en CI.
- Stylelint 17 : warn-only (dette UI mesurée, pas verrouillée).

### 12.5 Versioning

- SemVer.
- v2.5.0 côté racine, v2.0.0 côté apps/web.
- Roadmap 3.0.0 comme jalon d’architecture.

### 12.6 Changelogs

- `CHANGELOG.md` global.
- `docs/06-Changelog/CHANGELOG_API.md`.
- `docs/06-Changelog/CHANGELOG_DB.md`.
- `docs/06-Changelog/CHANGELOG_UI.md`.
- `docs/06-Changelog/CHANGELOG_DOCS.md`.

### 12.7 Workflows GitHub

- `ci.yml` (bloquant + informatif).
- `protect-prod.yml` (contrôles production, safety-checks).
- `notify.yml` (échecs main/prod uniquement).

### 12.8 Processus de release

- Local via `scripts/safe-deploy.sh` (npm run deploy) : backup dist, build, injection SW version, redémarrage PM2 frontend + backend, smoke test santé (HTTP puis HTTPS fallback), rollback automatique en cas d’échec.
- `pm2 list` en sortie de release.
- Frontend production sur port 4173, backend sur 3002.

### 12.9 Recommandations

- Ajouter tests d’intégration end-to-end (Playwright, référencé en spec).
- Ajouter une pipeline `release.yml` optionnelle (tags, artefacts).
- Intégrer un rapport de couverture dans la CI.
- Configurer Slack/Discord dans `notify.yml`.

---

## 13. Synthèse des risques

### 13.1 Techniques

- Routeurs et panneaux monolithiques.
- Migrations hybrides (SQL + dynamique).
- Concepts métier parallèles (localisation, identités, affaires implicites).
- Duplication desktop/mobile.
- TV-client gelé face à une API évolutive.

### 13.2 Sécurité

- Nécessité de maintenir la vigilance sur les endpoints servant des fichiers.
- Couverture CSRF à confirmer.
- Chiffrement SMTP à généraliser.
- Rotation des clés à automatiser.
- Discipline environnement (.env, secrets).

### 13.3 Performance

- Polling omniprésent.
- Offset pagination.
- Tables volumineuses sans partitionnement.
- Charge WebRTC/Sonos sur proxy local.

### 13.4 UX

- Charge cognitive élevée.
- Duplication d’expériences.
- Latence perceptible (Google, non-lus, display).
- Denses formulaires métiers.

### 13.5 Organisationnels

- Dépendance forte à la discipline documentaire.
- Risque de dispersion si trop de chantiers 3.0.0 sont ouverts en parallèle.
- Nécessité d’un socle non-régression étendu (multi-modules).

---

## 14. Axes de travail recommandés

### 14.1 Court terme

- Alléger Planning, Personnel, Affaires, Équipements, Display.
- Formaliser la matrice RBAC exhaustive.
- Ajouter tests de régression sécurité sur endpoints fichiers/médias.
- Documenter clairement les concepts affaires virtuelles vs explicites et les 3 systèmes de localisation.
- Automatiser la sauvegarde SQLite versionnée.

### 14.2 Moyen terme

- API v2 versionnée avec deprecation gouvernée.
- Pagination cursor-based sur listes volumineuses.
- Découpage planning/display/communication.
- Unification `persons` (fin de dualité drivers).
- Unification localisation (une seule source de vérité).
- Storybook + a11y automatisé.

### 14.3 Long terme

- WebSocket pour messagerie, planning, display.
- Offline-first sur mobile terrain.
- i18n complète.
- APM/observabilité centralisée.
- Migration progressive vers architecture modulaire (services internes par domaine).

### 14.4 Priorisation stratégique

1. Fiabilité et intégrité de données.
2. Sécurité et gouvernance.
3. Performance et pagination.
4. Convergence UX/a11y/Design System.
5. Temps réel, offline-first, i18n.

---

## 15. Roadmap eM@g 3.0.0 complète

### 15.1 Vision

Version de fiabilité durable et de préparation à l’échelle : plateforme plus contractuelle, plus prédictible, plus accessible et plus simple à faire évoluer. Pas seulement une addition de fonctionnalités, mais une amélioration structurelle.

### 15.2 API v2

- API versionnée `/api/v2/*`.
- Contrats stabilisés (OpenAPI/Zod).
- Deprecation progressive des routes historiques.
- Gouvernance des évolutions incompatibles.

### 15.3 WebSocket

- Bus temps réel pour messagerie, planning, display, statuts affaires.
- Élimination progressive du polling.
- Élection leader BroadcastChannel étendue.
- Reprise automatique après coupure.

### 15.4 Refactors majeurs

Cibles prioritaires : Planning, Personnel, Affaires, Équipements, Stock, Display.

- Composants et services plus petits.
- Séparation stricte tâches / événements / statuts affaires.
- Unification concepts (persons, localisation).
- Tests de non-régression renforcés.

### 15.5 PWA offline-first

- Service Worker maîtrisé (déjà présent via sw-register).
- Queue de mutations débouncée.
- Réplication IndexedDB avec merge.
- Résolution de conflits last-write-wins ou champ-par-champ.
- Kill switch conservé (`sw-cleanup.js`).

### 15.6 i18n

- Extraction des textes UI.
- Centralisation messages métier.
- Support FR/EN a minima.
- Formats dates/nombres/montants localisés.

### 15.7 DS complet

- Convergence obligatoire de tous les modules sur le Design System.
- Retrait des couleurs hex résiduelles (`HEX_RESIDUELS.md`).
- Storybook complet, tests visuels.
- Adoption a11y systématique.

### 15.8 Optimisation DB

- Revue index et plans de requêtes.
- Vues matérialisées ou tables filles pour `task_assignments`.
- FK explicites sur affaires quand faisable.
- Playbook migration versionné.
- Sauvegardes automatiques et vérifiées.

### 15.9 Modules à réécrire ou resegmenter

- Planning : découper en tasks/events/affaires.
- Personnel : unifier drivers/persons, moderniser planning RH.
- Affaires : matérialisation stricte, historique complet.
- Équipements : unification localisation, workflow SAV.
- Stock : transactions atomiques strictes, cohérence forte.
- Display : découpage config/content/signals + versioning contractuel TV.

### 15.10 Jalons

- Jalon 1 : socle qualité et stabilisation critique.
- Jalon 2 : API v2 et performance de base.
- Jalon 3 : temps réel et convergence Design System.
- Jalon 4 : mobile-first, PWA offline-first, préparation i18n.
- Jalon 5 : consolidation finale, préparation release 3.0.0.

### 15.11 Risques

- Sur-périmètre.
- Régressions sur modules lourds sans tests renforcés.
- Complexité du temps réel sans contrat strict.
- Coût de transformation élevé sans DS imposé.
- Retard 3.0.0 si dette critique non résorbée.

### 15.12 Livrables

- API v2 documentée et gouvernée.
- Modules critiques refactorés avec critères de sortie explicites.
- Design System consolidé et imposé.
- PWA offline-first ciblée.
- Pipeline qualité et stabilisation continue renforcé.
- i18n opérationnelle.
- Observabilité et qualité produit mieux pilotées.

---

## Conclusion opérationnelle

eM@g est un système métier dense, ambitieux et déjà largement structuré. Sa force est l’intégration entre des domaines habituellement traités dans des outils séparés. Son point de bascule actuel est la consolidation architecturale : passer d’un monolithe fonctionnel très riche à une plateforme plus contractuelle, plus temps réel, plus accessible et mieux instrumentée.

Un assistant externe doit raisonner sur eM@g comme sur :
- un monolithe métier documenté et solide sur ses fondamentaux ;
- un système en transition vers plus de contrat, plus de découplage et plus de temps réel ;
- une plateforme dont la valeur métier dépasse largement la complexité technique perçue ;
- un produit dont la trajectoire 3.0.0 est claire, séquencée et pilotée.
