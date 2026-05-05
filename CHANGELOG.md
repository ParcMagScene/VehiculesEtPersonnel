# Changelog — eM@g

Changelog global unifié du projet eM@g.  
Format : [Keep a Changelog](https://keepachangelog.com) + [Semantic Versioning](https://semver.org/)

> Changelogs détaillés :  
> [API](docs/06-Changelog/CHANGELOG_API.md) · [DB](docs/06-Changelog/CHANGELOG_DB.md) · [UI](docs/06-Changelog/CHANGELOG_UI.md) · [Docs](docs/06-Changelog/CHANGELOG_DOCS.md) · [Prompts](prompts/CHANGELOG_PROMPTS.md) · [Sécurité](CHANGELOG_SECURITY.md)

---

## [Unreleased]

### Added
- **Locmat — Détections additionnelles** : doublons stricts dans `Serialise.csv`, collisions intra-CSV (même serial sur 2 codes), collisions DB cross-équipement, suppressions (refs en DB absentes des CSV). Trois nouveaux onglets dans `LocmatImportModal` : **Suppressions**, **Doublons**, **Collisions** (consultatifs, n'écrivent rien automatiquement). Schéma `locmatConfirmSchema` étendu (`missingProducts`, `duplicates`, `collisions`). 4 tests supplémentaires (13/13 ✅).
- **Équipements — `Numéro MAG`** : nouvelle propriété libre par équipement, visible dans le formulaire, le détail (dialog + volet), la grille (colonne triable) et la fiche imprimable. Migration idempotente `apps/api/migrations/equipment-numero-mag-v1.js` ajoutant `equipment.numero_mag TEXT` + `idx_equipment_numero_mag`. Recherche serveur étendue (`e.numero_mag LIKE ?`). Schéma Zod et routes `POST/PUT /api/equipment` mis à jour.

---

## [2.8.0] — 2026-05-04

### Added — Module Import intelligent Locmat (Locations.csv + Serialise.csv) → Equipement

Nouveau module d'import différentiel reliant les exports Locmat à la table
`equipment` / `equipment_serials` (parc matériel inventoriel). Aucune écriture
sans validation utilisateur, suppression soft-only des numéros de série,
génération d'UID + QR Code par référence créée.

- **Migration** `apps/api/migrations/locmat-import-v1.js` (idempotente) :
  - `equipment` ← colonnes `qrcode`, `is_serialized` + index unique partiel `idx_equipment_uid_unique` (la colonne `uid` existait déjà)
  - Nouvelle table `equipment_serials (id, equipment_id, serial, status='active'|'removed', source, notes, created_at, removed_at)`
  - Nouvelle table `import_logs (type, source, summary, details, user_id, user_name, created_at)`
  - Cleanup best-effort des colonnes/tables ajoutées par erreur sur `stock_items` (v1 initiale)
- **Service backend** `apps/api/services/locmatImport.js` (logique pure testée) :
  `normalizeLocationRow`, `normalizeSerialRow`, `diffWithDatabase`
- **Routes API** `apps/api/locmatImportRoutes.js` (admin only) :
  - `POST /api/import/locmat/preview` — calcule le diff (read-only)
  - `POST /api/import/locmat/confirm` — applique sous transaction (UID + QR
    générés pour les nouveautés, quantités ajustées, serials soft-removed)
  - `GET  /api/import/locmat/logs[/{id}]` — historique + détail
- **Schémas Zod** `locmatPreviewSchema`, `locmatConfirmSchema`
- **Client API** `apps/web/src/utils/api/locmatImport.js` :
  `previewLocmatImport`, `confirmLocmatImport`, `getLocmatImportLogs`,
  `getLocmatImportLogDetail`
- **UI** `apps/web/src/components/equipment/import/LocmatImportModal.jsx` (lazy) :
  parsing CSV client (PapaParse) → preview multi-onglets (nouveaux équipements /
  modifiés / quantités / nouveaux N° série / N° série retirés / erreurs) →
  validation + téléchargement rapport JSON. Bouton "Import intelligent Locmat"
  ajouté dans `EquipmentPanel` → onglet *Gestion → Imports*.
- **Tests** `tests/locmat-import.test.js` (7/7 ✅)
- **Dépendance** `papaparse@^5` (front)

### Garanties (cf. cahier des charges §8)

- Aucune écriture avant validation utilisateur (étape preview obligatoire)
- Suppression de numéro de série = soft (`status = 'removed'`, `removed_at` daté)
- Aucun UID régénéré pour une référence existante
- Aucun impact sur les modules existants (Catalogue, Commandes, Stock, TV client,
  SAV) — extensions uniquement, pas de breaking change



### Added — Sprint accessibilité (a11y) WCAG 2.1 AA

Première passe d'audit et corrections accessibilité, posant les fondations
pour un suivi pérenne via ESLint.

#### L1 — Reduced motion + skip link
- Classes globales `.a11y-skip-link`, `.sr-only` dans `apps/web/src/App.css`
- `@media (prefers-reduced-motion: reduce)` neutralise animations/transitions

#### L2 — Alt text sur images critiques
- `TVScreenMini.jsx` : alt dynamique basé sur `task.sectionLabel`
- `EquipmentFormModal.jsx` : alt photo + image générique catégorie
- `EquipmentBatchLabels.jsx` : alt logo (template HTML + JSX)

#### L3 — Modal `aria-labelledby` automatique
- Refonte `Modal.jsx` avec `useId()` + contexte interne
- `ModalHeader > h3` reçoit automatiquement l'`id` partagé
- Nouvelles props `ariaLabel` / `ariaLabelledBy`

#### L4 — FormField `aria-describedby` + `aria-invalid`
- Refonte `FormField.jsx` : `useId()` + `Children.map` + `cloneElement`
- Le premier enfant valide reçoit auto `aria-describedby` + `aria-invalid`
- Span d'erreur porte `role="alert"`

#### L5 — Labels associés StockPanel
- `StockPanel.jsx` : 35 → 0 warnings `label-has-associated-control`
- 20 champs : `<label htmlFor>` + `id` injectés (codemod)
- 9 zones lecture-seule : `<label>` → `<span class="stock-detail-label">`
- 6 groupes de boutons : `<span class="stock-form-group-label">`

#### L6 — eslint-plugin-jsx-a11y
- Plugin installé en dev (`eslint-plugin-jsx-a11y`)
- `apps/web/.eslintrc.cjs` étendu avec `plugin:jsx-a11y/recommended`
- Posture permissive : `warn` par défaut, `error` strict pour `aria-props`,
  `aria-proptypes`, `aria-unsupported-elements`, `role-has-required-aria-props`
- Désactivés : `no-autofocus` (modales), `media-has-caption` (flux NVR live)
- 4 erreurs initiales corrigées (`MapSearchControl.jsx`, `Drawer.jsx`)

### Documentation
- Nouveau guide [docs/02-Securite/A11Y.md](docs/02-Securite/A11Y.md)

### Tests
- 530 tests Vitest verts après refonte FormField + Modal

### Métriques
- Erreurs `jsx-a11y` : 4 → 0
- Warnings a11y globaux : 730 → 693 (chantier itératif pour la suite)

---

## [2.7.0] — 2026-05-04

### Added — Refonte navigation (Sprints A → D)

Migration de la navigation desktop vers React Router 6 + URL = source de vérité,
unification des tables de routes desktop/mobile, garde formulaires anti-perte.

#### Sprint A — Fondation
- Ajout `react-router-dom@6.30.3` + `<BrowserRouter>` racine
- Suppression du module mort `catalog` (raccourci, `VALID_TABS`, préférences)
- Nouveau hook `ScrollToTopOnModuleChange` (skip mobile)

#### Sprint B — Routes desktop
- Nouveau fichier [`apps/web/src/router/routes.config.js`](apps/web/src/router/routes.config.js) — table unique
  des modules desktop (`DESKTOP_MODULES`, `ALLOWED_MODULES`, `STOCK_SUBTABS`,
  `CALENDAR_VIEWS`)
- Nouveau hook `useSearchParamState(key, default, { allowed, replace })` —
  remplace `useState` + sync `window.history.replaceState` manuelle
- `?module=`, `?tab=`, `?view=` deviennent la source de vérité (F5 sûr)
- Header consomme `DESKTOP_MODULES` (plus de liste hardcodée inline)
- `localStorage.emag_last_module` rétrogradé à fallback nouvel onglet

#### Sprint C — Routes mobile (consolidation)
- `MOBILE_ROUTES`, `MOBILE_TAB_SCREENS`, `MOBILE_BACK_TARGET`,
  `MOBILE_QR_PATTERN`, `MOBILE_ACTIVE_TAB_KEY` migrés dans `routes.config.js`
- `useMobileRouter` consomme la table centrale (back-compat des exports nommés
  préservée pour les tests)
- Pattern QR `EMAG-XXXXX` documenté et importable par les scripts d'étiquettes
- Listener `hashchange` redondant retiré dans `App.jsx` (matchMedia suffit)
- Hash router conservé : QR codes physiques imprimés non cassés

#### Sprint D — Garde + tests + doc
- Nouveau hook [`useUnsavedChangesGuard`](apps/web/src/hooks/useUnsavedChangesGuard.js)
  (listener `beforeunload`) branché sur `UserPreferencesModal`,
  `MaintenanceDialog`, `TripDetailsModal`
- 7 tests Vitest sur `useSearchParamState`
  (validation hostile, setter, updater, propreté URL)
- Documentation centralisée [`docs/01-Architecture/NAVIGATION.md`](docs/01-Architecture/NAVIGATION.md)
- PWA volontairement non réactivée (cf. `public/sw-cleanup.js`)

### Changed
- `apps/web/src/main.jsx` — racine wrappée dans `<BrowserRouter>`
- `apps/web/src/App.jsx` — `activeModule` / `view` / `stockSubTab` migrés vers
  `useSearchParamState`
- `apps/web/src/components/Header.jsx` — `module-tabs` consomme `DESKTOP_MODULES`

### Removed
- Module `catalog` (mort) : raccourci clavier, `VALID_TABS`, option préférences
- Liste de modules hardcodée inline dans `Header.jsx`
- Listener `hashchange` desktop redondant

### Tests
- 13 tests `useMobileRouter` (préexistants, toujours verts)
- 7 nouveaux tests `useSearchParamState`
- 0 régression ESLint introduite

---

## [2.6.0] — 2026-04-13

### Added — GUI Sonos complète (Desktop + Mobile)

Refactoring complet du module Sonos : architecture modulaire, hook partagé, composants desktop et mobile dédiés.

#### Architecture
- **`useSonos.js`** (nouveau hook) : logique centralisée (config, zones, polling 5s, contrôles, favoris, busy-lock)
- **Barrel `sonos/index.js`** : export unifié des 7 composants desktop
- **`SonosPanel.css`** : CSS dédié (migration `dtv-sonos-*` → `sonos-*`)

#### Desktop (7 composants)
- `SonosPanel` — Container principal, orchestre le hook + sous-composants
- `SonosZoneSelector` — Sélecteur de zones avec cards expandable
- `SonosNowPlaying` — Pochette, titre, artiste, progression, disque animé
- `SonosControls` — Transport (play/pause/prev/next), seek bar, shuffle/repeat
- `SonosVolumeSlider` — Volume + mute, état local synchronisé
- `SonosFavorites` — Liste pliable avec recherche et indicateur lecture
- `SonosSources` — Catégorisation Radio/Playlist/Autre par heuristique URI

#### Mobile (5 composants)
- `MobileSonos` — Shell mobile avec header, zone pills scroll-snap, refresh
- `MobileSonosNowPlaying` — Pochette 70vw, swipe gauche/droite pour next/prev
- `MobileSonosControls` — Touch targets 48px+, bouton principal 64px, seek
- `MobileSonosVolume` — Slider pleine largeur, mute 40px
- `MobileSonosFavorites` — Liste scrollable, chargement auto, recherche

#### Tests
- 47 nouveaux tests Vitest (hook + composants desktop + composants mobile)
- Suite complète : 402 tests, 0 échec

---

## [2.5.0] — 2026-04-11

### Added — Synchronisation bidirectionnelle Google Calendar

Implémentation complète de la synchronisation bidirectionnelle entre les réservations eM@g et Google Calendar, avec session persistante pour une expérience sans flash.

#### Phase 2.9.1 — Push eM@g → Google Calendar
- **`googleBidirectionalSync.js`** (nouveau) : service de synchronisation bidirectionnelle avec feature flag `GOOGLE_BIDIRECTIONAL_SYNC`
- `syncReservationToGoogle()` : création/mise à jour automatique d'événements Google Calendar lors du CRUD réservations
- `deleteReservationFromGoogle()` : suppression de l'événement Google lié lors de la suppression d'une réservation
- `buildGoogleEventPayload()` : mapping intelligent réservation → événement Google (all-day vs dateTime, périodes AM/PM)
- Propriétés privées `emagReservationId` + `emagSource` pour traçabilité
- Intégration best-effort (try/catch) dans `vehicleRoutes.js` — un échec Google ne bloque pas le CRUD local

#### Phase 2.9.2 — Pull Google → eM@g (réconciliation)
- `pullReservationsFromGoogle()` : moteur de réconciliation — fenêtre -7j / +90j avec pagination
- Stratégie Google-wins : si les dates divergent, la réservation locale est mise à jour
- Nettoyage d'orphelins : si l'événement Google a été supprimé, le `google_event_id` est effacé sans supprimer la réservation
- Endpoint `POST /api/google/sync/pull-reservations` avec authentification
- Bouton « Réconcilier depuis Google » dans `GoogleCalendarConfig.jsx` avec badges de résultat (updated/orphaned/errors)
- Client API `syncPullReservations(days)` dans `admin.js`

#### Phase 2.10 — Session Google persistante
- Persistance `isSignedIn` / `googleEmail` / `calendarId` dans `localStorage` (clé `emag_google_state`)
- `GoogleCalendarBanner.jsx` : initialisation instantanée depuis le cache, confirmation async via `/api/google/status`
- Plus de flash « Connectez-vous à Google » au chargement de page
- Nettoyage du cache lors de la révocation OAuth

### Changed
- Plan d'action complet (12 étapes, 49 findings) marqué 100% terminé
- Bump version 2.4.1 → 2.5.0

---

## [2.4.1] — 2026-04-10

### Fixed
- Réservations véhicules : correction du crash backend sur validation (`error.issues` avec fallback `error.errors`) dans `apps/api/schemas/imports.js`.
- Réservations véhicules : correction du `400 Données invalides` à la modification via normalisation du payload (`startDate/startPeriod`) dans `apps/web/src/hooks/useAppData.js`.
- Droits collaborateurs : édition des réservations autorisée aux comptes non `read_only` (backend `requireNotReadOnly` + garde frontend alignée).
- Build frontend : suppression warning JSX `Duplicate className` (`apps/web/src/components/vehicles/DepotMap.jsx`).
- Build frontend : suppression erreur CSS de minification (`Unexpected "}"`) dans `apps/web/src/components/management/ManagementPanel.css`.

### Changed
- Plan de phases mis à jour : vérification infra TV `magsav.duckdns.org:3003/tv` validée (`curl` + `nc`).
- Plan vidéo actualisé : onglet Preset multi-caméras et vue détachable marqués implémentés.

---

## [2.4.0] — 2026-04-09

### Added — Module Sonos complet

Extraction et enrichissement complet du module Sonos : passage d'un simple « now playing » lecture seule à un module autonome avec contrôles complets, gestion multi-zone, favoris, et widget TV enrichi.

#### Phase A — Backend (`sonosRoutes.js`, ~730 lignes)
- **`apps/api/sonosRoutes.js`** (nouveau) : module autonome extrait de `displayRoutes.js`
- 18 endpoints dédiés `/api/sonos/*` : config, now-playing, zones, state, play/pause/next/previous, volume, mute/unmute, seek, shuffle, repeat, favorites
- Rate limiting : `sonosReadLimiter` (120/min), `sonosCommandLimiter` (60/min)
- Auth : `requireAdmin` pour commandes, `authenticateToken` pour config, `optionalTvToken` pour now-playing
- Export `getSonosNowPlaying()` partagé avec `displayRoutes.js` (tv-state)
- Routes compat `/api/display/sonos-*` conservées avec headers `X-Deprecated` + `Sunset: 2026-07-01`

#### Phase B — API Client (`api/sonos.js`)
- **`apps/web/src/utils/api/sonos.js`** (nouveau) : 20 méthodes client
- Enregistrement via `registerSonosMethods(ApiClient)` dans `index.js`
- Suppression des 3 méthodes legacy de `display.js`

#### Phase C — Frontend
- **`SonosTab.jsx`** : réécriture complète (139→290 lignes) — `PlaybackControls`, `ZoneCard`, `FavoritesList`
- Contrôles transport (play/pause/next/prev), volume slider, mute/unmute, sélection de zone, favoris 1-click
- **`AppearanceTab.jsx`** : suppression section Sonos IP (doublon éliminé)
- CSS : ~170 lignes ajoutées (contrôles, zones, favoris, responsive)

#### Phase D — TV-client & Dashboard
- **`tv-client/main.js`** : migration vers `/api/sonos/now-playing`, gestion volume
- **`tv-client/index.html`** + **`styles.css`** : barre de volume verticale animée dans le widget Sonos
- **`sonosRoutes.js`** : `getSonosNowPlaying()` retourne maintenant le volume
- **`DashboardTasksSidebar.jsx`** : migration `getDisplaySonosNowPlaying` → `getSonosNowPlaying`

#### Phase E — Sécurité & robustesse
- Validation IPv4 stricte (`isValidIPv4` regex, bloque `999.999`, `1.2.3.4.5`)
- Timeout UPnP 8s (`withTimeout()`) sur tous les appels Sonos — plus de hang
- Parsing radio « Artiste - Titre » centralisé backend, supprimé de TV-client et TVScreenMini
- Limites entrées : URI favori 2048 car., titre 256 car., seek 0-86400s
- Protection SSRF sur `getRadioFavicon()` (IP privées/locales bloquées)

### Changed
- `displayRoutes.js` : ~250 lignes Sonos retirées, import `getSonosNowPlaying` depuis `sonosRoutes`
- `server.js` : enregistrement `setupSonosRoutes`

### Removed
- 3 méthodes API legacy Sonos dans `display.js` (`getDisplaySonosConfig`, `saveDisplaySonosConfig`, `getDisplaySonosNowPlaying`)
- Section config IP Sonos dans `AppearanceTab.jsx` (doublon)
- Parsing radio dupliqué côté client (TV-client, TVScreenMini)

---

## [2.3.0] — 2026-04-09

### Changed — Refactoring Google Calendar OAuth2

Migration complète du flux d'authentification Google Calendar : passage du flux implicite GIS (frontend) à l'Authorization Code Flow (backend). Les tokens sont désormais gérés côté serveur avec chiffrement AES-256-GCM.

#### Phase A — Infrastructure
- **`apps/api/googleTokenManager.js`** (nouveau) : chiffrement AES-256-GCM des refresh_tokens, OAuth2 client factory via `googleapis`, cache access_token en mémoire (5 min), auto-refresh transparent
- **`apps/api/migrations.js`** : table `google_oauth_tokens` (user_id PK, refresh_token chiffré, email, scopes, timestamps)
- **`apps/api/config/rateLimiter.js`** : `googleCalendarLimiter` — 60 req/min (120 en dev)
- Dépendance : `googleapis@^171.4.0`

#### Phase B — Backend Authorization Code Flow
- **`apps/api/googleRoutes.js`** (nouveau) : 10 routes `/api/google/*`
  - `/auth` — URL d'autorisation avec state CSRF (TTL 10 min)
  - `/callback` — échange code, stockage refresh_token, redirect `/?google_connected=true`
  - `/status`, `/configured` — état de connexion et configuration
  - `/disconnect` — révocation + suppression tokens
  - `/events`, `/events/:id`, `/calendars` — proxy avec auto-refresh

#### Phase C — Simplification frontend
- **`GoogleCalendarBanner.jsx`** : supprimé ~120 lignes (chargement script GIS, tokenClient, renewAccessToken, initializeGIS, retry 401, 6 refs). Nouveau flux : redirect OAuth2 backend
- **`GoogleCalendarConfig.jsx`** : v2 disconnect, URI redirect backend
- **`admin.js`** : 12 méthodes API v2 ajoutées

#### Phase D — Sync intelligente multi-tab
- **`apps/web/src/hooks/useGoogleSync.js`** (nouveau, ~300 lignes) :
  - Leader election via `BroadcastChannel` (heartbeat 15s, timeout 30s)
  - Cache IndexedDB dédié (`emagGoogleSync`) — survit aux reloads
  - Diff engine : pas de re-render si les événements n'ont pas changé
  - Polling silencieux toutes les 5 min (leader seulement)
  - Broadcast des événements frais aux autres onglets
- **`GoogleCalendarBanner.jsx`** : intégration du hook, suppression du fetchEvents interne, enrichissement via `useMemo`

#### Phase E — Stabilisation & sécurité
- Migration des 4 consommateurs restants (`PeriodCalendarModal`, `AffairesPanel`, `AffaireDetailPanel`, `GoogleCalendarConfig`) de legacy → v2
- Suppression des 11 méthodes API legacy (`storeGoogleToken`, `getGoogleTokenStatus`, etc.)
- Retrait de `googleCalendarRoutes.js` du serveur (archivé en `.legacy.js`)
- Migration : suppression automatique de la table `google_tokens` (remplacée par `google_oauth_tokens`)
- Hardening routes v2 : sanitisation `calendarId` (regex email), validation `eventId` (path traversal), nettoyage périodique states CSRF

### Removed
- Flux implicite GIS (Google Identity Services) frontend
- Table `google_tokens` (access_token en clair, non chiffré)
- 11 méthodes API legacy `/api/google-calendar/*`
- `oauthLogger` (références orphelines nettoyées)

### Security
- Refresh tokens chiffrés AES-256-GCM (IV + auth tag) — plus jamais de tokens en clair en DB
- CSRF state sur le callback OAuth2 (TTL 10 min, in-memory)
- Validation `eventId` contre path traversal
- Sanitisation `calendarId` (format email ou 'primary')

---

## [2.2.0] — 2026-04-08

### Added
- **Module Cartographie des lieux** — nouvelle fonctionnalité complète
  - **Carte générale** : affichage de tous les lieux géolocalisés avec `fitBounds` automatique
  - **Carte locale** : vue centrée sur le dépôt Mag Scène dans un rayon de 2 km (Haversine)
  - **Marqueurs SVG stylisés** : icônes colorées par type de lieu (Dépôt, Salle de spectacle, Prestataire, Garage, Autre) + marqueur gradient pour le siège
  - **Popups DS** : affichage nom, type, adresse, coordonnées, lien Google Maps, bouton modifier
  - **Impression/Export** : impression A4/A3 (portrait/paysage) avec en-tête eM@g, export PNG
  - **Mode sombre** : bascule entre tiles OpenStreetMap (clair) et CartoDB dark matter
  - **Légende** intégrée, responsive mobile
  - **Intégration ManagementPanel** : bouton 🗺️ dans l'onglet Lieux pour ouvrir la cartographie
- Dépendances : `leaflet@^1.9.4`, `react-leaflet@^4.2.1`
- 8 fichiers créés dans `apps/web/src/components/locations/`

---

## [2.1.12] — 2026-04-07

### Changed
- **Phase O (ROBUSTESSE)** : Error boundaries + gestion d'erreurs, 4 fichiers
  - ErrorBoundary ajouté sur 8 modules lazy manquants (ManagementPanel ×2, MaintenanceDialog, VehicleMaintenanceModal, MessagingPanel, MailingPanel, AffaireDetailDialog)
  - `Promise.all` → `Promise.allSettled` dans useAppData : si 1 endpoint fail, les 9 autres chargent quand même
  - Timeout fetch 30s (AbortController) dans api/base.js : plus de requêtes bloquées indéfiniment
  - Handler global `unhandledrejection` dans main.jsx

---

## [2.1.11] — 2026-04-07

### Changed
- **Phase N (PERF)** : Optimisation performance — lazy loading et images, 19 fichiers
  - `VehicleSlidePanel` lazy dans App.jsx — bundle initial −9.2 kB (193→184 kB)
  - `PersonnelPanel` lazy dans ManagementPanel — chargé uniquement à l'onglet Personnel
  - `pdfjs-dist` (438 kB) en import dynamique — chargé au premier import PDF, plus au montage des panels
  - `loading="lazy"` ajouté sur 33 images (`<img>`) dans 16 composants (listes, modals, mobile)

---

## [2.1.10] — 2026-04-07

### Changed
- **Phase M (DRY)** : Élimination des duplications de code — 39 fichiers, −307 lignes nettes
  - **useConfirmDialog hook** : nouveau hook `useConfirmDialog()` extrait du boilerplate confirmDialog
    - 22 composants migrés, ~40 appels `setConfirmDialog` remplacés, ~22 blocs `<Dialog>` JSX supprimés
  - **formatDate → formatUtils** : 6 fichiers, 8 fonctions locales `formatDate`/`formatDateShort` supprimées → import centralisé
  - **Dates inline → formatUtils** : 11 fichiers, 18 occurrences `toLocaleDateString('fr-FR')` → `formatDateSimple()`/`formatDateTime()`

---

## [2.1.9] — 2026-04-07

### Changed
- **Phase L (QUALITY)** : Audit backend — 7 imports inutilisés supprimés dans 5 fichiers
  - `server.js` : suppression `_join` (path) et `requireTruckAccess` (non utilisé)
  - `routes.js` : suppression `invalidateEntity` (cache)
  - `messagingRoutes.js` : suppression `unlinkSync` (fs)
  - `middleware/authenticate.js` : suppression import `logger`
  - `supplierCatalogRoutes.js` : suppression `resolveUnifiedFamily`
  - Backend validé : 0 console.log dans les fichiers de production, logger structuré utilisé partout

---

## [2.1.8] — 2026-04-07

### Changed
- **Phase K (QUALITY)** : Nettoyage dead code — 523 avertissements ESLint `no-unused-vars` éliminés (152 fichiers)
  - 122 `import React` supprimés (React 17+ JSX transform les rend inutiles)
  - 214 imports inutilisés supprimés (icônes Lucide, hooks React, utilitaires)
  - 110 variables/fonctions mortes préfixées `_` (fonctions jamais appelées, state inutilisé)
  - 73 arguments de fonction inutilisés préfixés `_` (props destructurés, callbacks)
  - 4 useState complets supprimés (paires value+setter jamais utilisées)
  - Résultat : 0 avertissement `no-unused-vars` restant

---

## [2.1.5] — 2026-04-07

### Changed
- **Phase G (QUALITY)** : Migration de 902 `<button>` natifs → `<Button>` Design System (112 fichiers)
  - Adoption DS Button : 26% → 100% (zéro `<button>` natif restant hors DS)
  - `variant="ghost"` appliqué pour préserver les styles existants via className
  - Import `Button` ajouté à 61 fichiers, fusionné dans 51 imports existants
  - Script `migrate-buttons.mjs` inclus

---

## [2.1.4] — 2026-04-07

### Changed
- **Phase F (QUALITY)** : Migration de 252 magic strings → constantes centralisées (57 fichiers)
  - 196 comparaisons de statuts (`=== 'pending'` etc.) → `STATUS.*`
  - 12 vérifications de rôles → `ROLES.*`
  - 16 valeurs setTimeout → `TIMING.*`
  - 5 nouveaux statuts ajoutés : VALIDATED, CONFIRMED, ACCEPTED, DONE, DISPONIBLE
  - Script `migrate-magic-strings.mjs` inclus pour reproductibilité

---

## [2.1.3] — 2026-04-07

### Changed
- **Phase E (QUALITY)** : Validation formulaires, alignement password policy, constantes
  - Créé `constants/index.js` : STATUS, ROLES, TIMING, VALIDATION centralisés
  - Alignement password policy frontend ↔ backend (10 chars + complexité)
    - ChangePassword.jsx : minLength 4→10, hints mis à jour
    - LoginForm.jsx : reset password minLength 6→10
    - AccessRequestModal.jsx : minLength 6→10, validation + disabled state
  - Ajout maxLength sur 31 champs formulaires (3 fichiers)
    - AnnuairePanel.jsx : 20 inputs (noms=100, emails=254, phones=20, SIRET=17, etc.)
    - PersonnelPanel.jsx : 6 inputs (noms=100, emails=254)
    - AccessRequestModal.jsx : 3 inputs (nom=100, email=254)
  - InterventionModal.jsx : maxLength description=1000, garage=200, min=0 sur coût

---

## [2.1.2] — 2026-04-07

### Changed
- **Phase D (QUALITY)** : Migration de 2 355 valeurs CSS hardcodées vers design tokens
  - 1 298 border-radius → var(--radius-*) dans 109 fichiers
  - 1 054 font-size → var(--font-*) (px et rem)
  - 3 z-index → var(--z-modal), var(--z-popover)
  - Nouveau token créé : --radius-md-lg: 10px (212 occurrences)

---

## [2.1.1] — 2026-04-07

### Changed
- **Phase C (QUALITY)** : Extraction des styles inline vers CSS — 6 composants, 155 styles extraits
  - LoginForm.jsx : 30→0 inline styles, 17+ classes CSS ajoutées
  - BLBatchAnalysis.jsx : 44→10 inline styles, 35+ classes CSS (nouveau fichier)
  - SavImportModal.jsx : 46→15 inline styles, 26 classes CSS (nouveau fichier)
  - CatalogSettingsPanel.jsx : 41→18 inline styles, 8 classes utilitaires
  - ReservationModal.jsx : 37→8 inline styles, 25+ classes CSS
  - ProfileEditModal.jsx : 20→2 inline styles, 18 classes CSS (nouveau fichier)
  - Remplacement des handlers onMouseEnter/onMouseLeave par CSS :hover
  - Styles dynamiques (couleurs conditionnelles, largeurs calculées) conservés inline

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
