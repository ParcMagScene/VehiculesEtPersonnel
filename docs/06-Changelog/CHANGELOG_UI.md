# Changelog UI / Frontend — eM@g

Toutes les modifications de l'interface utilisateur et des composants React.  
Format : [Keep a Changelog](https://keepachangelog.com)

---

## [2.15.0] — 2026-07-10

### Added — SAV v2 client API (T-P1-07)

- **`apps/web/src/utils/api/v2/sav.js`** (nouveau) : 5 méthodes
  `v2SavProtocol`, `v2ListSavParts`, `v2AddSavPart`,
  `v2UpdateSavPartStatus`, `v2TransitionSavTicket`.
- **`apps/web/src/utils/api/index.js`** : enregistrement client
  SAV sur le singleton (après Equipment UID).

---

## [2.14.0] — 2026-07-10

### Added — Equipment UID v2 client API (T-P1-06)

- **`apps/web/src/utils/api/v2/equipmentUid.js`** (nouveau) : 3
  méthodes `v2EquipmentUidProtocol`, `v2EquipmentUidAudit`,
  `v2RegenerateEquipmentUid(equipmentId, {reason?})`.
- **`apps/web/src/utils/api/index.js`** : enregistrement client
  Equipment UID sur le singleton (après Conflicts).

---

## [2.13.0] — 2026-07-10

### Added — Conflicts v2 client API (T-P1-05)

- **`apps/web/src/utils/api/v2/conflicts.js`** (nouveau) : 2
  méthodes `v2ConflictsProtocol()`, `v2CheckConflicts(body)`.
- **`apps/web/src/utils/api/index.js`** : enregistrement du client
  Conflicts sur le singleton (après Leaves).

Aucun composant UI refactoré. La méthode `v2CheckConflicts` sera
consommée en pré-check par les formulaires v2 de création
d'availability / mission / task après dogfooding
(`FEATURE_V2_CONFLICTS=1`).

---

## [2.12.0] — 2026-07-10

### Added — Leaves v2 client API (T-P1-04)

- **`apps/web/src/utils/api/v2/leaves.js`** (nouveau) : 4 méthodes
  `v2LeavesProtocol()`, `v2CalculateLeaves(data)`,
  `v2GetMyLeaveBalance({year, type})`,
  `v2GetLeaveBalance(personId, {year, type})`. Toutes avec
  `skipCamelCase: true`.
- **`apps/web/src/utils/api/index.js`** : enregistrement des
  méthodes v2 Leaves sur le singleton (après Affaires v2).

Aucun composant UI refactoré. Le refactor `LeaveRequestForm` /
`LeaveBalancesPanel` pour consommer les endpoints v2 est reporté à
T-P1-04b après dogfooding via `FEATURE_V2_LEAVES=1`.

---

## [2.11.0] — 2026-07-10

### Added — Client `ReconnectingWebSocket` (T-P1-02)

- **`apps/web/src/utils/ws/reconnectingWebSocket.js`** (nouveau) :
  client WebSocket avec reconnexion exponentielle bornée
  (`initialRetryMs=500`, `backoffFactor=2`, `maxRetryMs=30_000`,
  `jitterRatio=0.2`), queue de messages (`maxQueueSize=100`),
  événements `open`/`message`/`close`/`error`/`reconnect`.
  Zéro dépendance externe. Injection possible du constructor
  WebSocket via `webSocketFactory` (tests unitaires).
- **`apps/web/src/utils/ws/reconnectingWebSocket.test.js`** (nouveau)
  : 12 tests unitaires (jitter, backoff, queue, reconnexion,
  close volontaire, off).

Aucun composant UI n'utilise encore la classe. Elle sera consommée
par le refactor `MessagingPanel` et par un futur `DisplayLiveStatus`
en T-P1-02b.

---

## [2.10.0] — 2026-07-10

### Added — API v2 core : client `v2Meta()` (T-P1-01)

- **`apps/web/src/utils/api/v2/meta.js`** (nouveau) :
  `registerV2MetaMethods(ApiClient)` avec la méthode `v2Meta()`
  (GET `/api/v2/meta` — public, `skipCamelCase: true`).
- **`apps/web/src/utils/api/index.js`** : enregistrement de la
  méthode meta sur le singleton (après Affaires v2).

Aucun composant UI n'utilise encore `v2Meta()` — la méthode est mise
à disposition pour un pilotage centralisé des flags client
`flags.v2<Domaine>` en fonction de l'état réel du flag serveur (à
implémenter dans un ticket UI dédié).

---

## [2.9.0] — 2026-07-10

### Added — Affaires v2 client API (T-P0-09)

- **`apps/web/src/utils/api/v2/affaires.js`** (nouveau) :
  enregistrement sur `ApiClient.prototype` de 5 méthodes v2 :
  `v2AffairesProtocol()`, `v2ListAffaires({cursor, limit, type,
  client})`, `v2GetAffaire(numeroAffaire)`,
  `v2GetAffaireHistory(numeroAffaire, {limit})`,
  `v2PatchAffaire(numeroAffaire, patch)`. Toutes avec
  `skipCamelCase: true`.
- **`apps/web/src/utils/api/index.js`** : enregistrement des
  méthodes v2 Affaires sur le singleton ApiClient (après Locations
  v2).

Aucun composant UI refactoré dans ce commit. Le refactor
`AffairesPanel` / `AffaireDetailDrawer` pour consommer les hooks
v2 (au lieu de `/api/affaires/*` v1) est reporté à un ticket dédié
T-P0-09b après validation qualitative du contrat v2 (dogfooding via
`FEATURE_V2_AFFAIRES=1` en dev).

---

## [2.8.0] — 2026-07-10

### Added — EquipmentPanel : bascule v1/v2 via flag client (T-P0-12b)

- **`apps/web/src/utils/locations/v2Adapters.js`** (nouveau) :
  - `adaptDepotV2ToV1(depotV2)` : convertit un dépôt v2
    (`{depot_id, svg_width, svg_height, ...}`) vers le shape v1
    (`{depotId, svgWidth, svgHeight, ...}`) consommé par `DepotMap`.
  - `adaptDepotsListV2ToV1(listV2)` : conversion de la liste
    compacte.
- **`apps/web/src/utils/locations/fetchDepotZones.js`** (nouveau) :
  - `fetchDepotZones(api, {useV2, depotId})` : bascule
    v1 (`api.getEquipmentDepotZones`) / v2
    (`api.v2GetDepot` + adaptation). Fallback strict v1 en cas
    d'erreur ou de 404 `FEATURE_DISABLED`.
  - `fetchAllDepotZones(api, {useV2})` : combinateur
    `v2ListDepots` + `v2GetDepot` (n appels parallèles) ou
    `api.getAllDepotZones` v1. Fallback strict v1 si un détail
    manque.
  - `readLocationsV2ClientFlag(env?)` : lit
    `VITE_FEATURE_V2_LOCATIONS` (1/true/on/yes) → bool.
- **`apps/web/src/components/equipment/useEquipment.js`** :
  `loadData` remplace les deux appels v1 par les nouveaux
  helpers, en lisant le flag client à chaque exécution
  (rechargement immédiat après bascule sans reload de page).

Coexistence stricte : off par défaut, aucun changement fonctionnel.
Aucun refactor de `DepotMap`, `EquipmentGrid` ou `InventoryPanel`
(inventaire = table `locations` legacy, hors périmètre T-P0-10).
Le PATCH `/api/v2/equipment/:id/location` reste consommé côté
frontend uniquement via la méthode `api.v2PatchEquipmentLocation`
livrée en T-P0-12 (aucun appelant UI dans ce commit).

### Tests

- `apps/web/src/utils/locations/v2Adapters.test.js` : 6 tests
  (mapping, defaults, tableaux invalides).
- `apps/web/src/utils/locations/fetchDepotZones.test.js` : 11 tests
  (bascule v1/v2, fallback FEATURE_DISABLED, fallback erreur
  arbitraire, defaults, flag parsing).

---

## [2.7.0] — 2026-07-10

### Added — Locations v2 client API + hooks (T-P0-12 backend & client)

- **`apps/web/src/utils/api/v2/locations.js`** (nouveau) :
  enregistrement sur `ApiClient.prototype` de 4 méthodes v2 :
  `v2LocationsProtocol()`, `v2ListDepots()`, `v2GetDepot(depotId)`,
  `v2PatchEquipmentLocation(equipmentId, patch)`. Toutes utilisent
  `skipCamelCase: true` pour préserver la casse snake_case des
  réponses v2.
- **`apps/web/src/hooks/v2/useLocationsV2.js`** (nouveau) :
  - `useV2DepotsList()` : liste compacte des dépôts, expose
    `{ depots, loading, error, featureDisabled, refresh }`.
  - `useV2DepotDetail(depotId)` : détail complet, no-op si
    `depotId` falsy, distingue `featureDisabled` (404
    FEATURE_DISABLED serveur) de `error` réseau/404 dépôt
    inexistant.
- **`apps/web/src/utils/api/index.js`** : enregistrement des méthodes
  v2 Locations sur le singleton ApiClient (après Planning v2).

Aucun composant UI refactoré dans ce commit. Le refactor de
`EquipmentPanel.jsx` (1080 lignes) + `InventoryPanel.jsx` (946 lignes)
pour consommer les hooks v2 (au lieu de charger `depot-zones.json`
statique) est reporté à un ticket T-P0-12b dédié.

---

## [2.6.0] — 2026-07-09

### Added — TV-client v2 (T-P0-16)

- **`apps/tv-client/v2/index.html`** (nouveau) : HTML minimaliste,
  styles inline autonomes (aucun import de `apps/tv-client/styles.css`
  v1). Layout deux colonnes : playlist active + signaux (welcome
  message + liste de messages).
- **`apps/tv-client/v2/main.js`** (nouveau, ~260 lignes vanilla JS
  sans dépendance) :
  - Discovery `GET /api/v2/display/protocol` au boot.
  - Bootstrap `GET /api/v2/display/config?screen_id=<id>`.
  - Chargement conditionnel `GET /api/v2/display/content?playlist_id=
    <id>` selon capability `playlist-content-v1`.
  - **`EventSource`** sur `/api/v2/display/signals/stream` si
    capability `screen-signals-stream-v1`, sinon fallback polling
    `/signals` toutes les 10 s (capability `screen-signals-v1`).
  - Auto-reconnexion SSE après 3 s en cas d'erreur.
  - Application dynamique des couleurs `appearance.*` via CSS custom
    properties (`--tvv2-accent`, `--tvv2-bg`, `--tvv2-fg`,
    `--tvv2-font`).
  - Rétro-compat TV-token : lu depuis URL (`?token=…`) ou
    `localStorage['tv-token']`. En-tête `X-TV-Token` sur toutes les
    requêtes API.
  - Banner d'erreur rouge si feature flag off ou reconnexion en cours.
- **Accès** : `/tv-client/v2/index.html?screen_id=<id>&token=<tv-token>`.
  Lien retour vers v1 dans le footer.

Le TV-client v1 (`apps/tv-client/index.html`, 735 lignes vanilla JS,
55+ endpoints `/api/display/*`) reste actif et inchangé. Aucune
redirection automatique n'est configurée : le TV-client v2 est
strictement opt-in via URL.

### Reference

- `docs/05-Specs/DISPLAY_V2.md` §5 — spec TV-client v2.
- `docs/api/v2/display.md` — SSE contrat + exemple `EventSource`.
- `EXECUTION_PLAN_EMAG_3_0.md` — T-P0-16 · TV-client v2 (client nouveau).

---

## [2.5.2] — 2026-07-09

### Added — Planning v2 client web (events + affaires) — T-P0-05 étendu

- **`apps/web/src/utils/api/v2/planning.js`** : ajout des méthodes
  `listV2Events`, `listV2PlanningAffaires`, `createV2TasksBatch`,
  `clearV2CompletedTasks`, `rolloverV2Tasks` sur `ApiClient.prototype`.
- **`apps/web/src/hooks/v2/usePlanningEventsV2.js`** : hook cursor-based
  miroir de `usePlanningTasksV2` (loadMore, refresh, hasMore,
  featureDisabled).
- **`apps/web/src/hooks/v2/usePlanningAffairesV2.js`** : hook
  offset-based (`total`, `hasMore`, incrément offset). Support
  `includeHidden`.
- Aucun composant UI livré à ce stade — dialogs et panels events
  seront traités par un ticket ultérieur.

Voir aussi : [../api/v2/planning.md](../api/v2/planning.md),
[EXECUTION_PLAN_EMAG_3_0.md](../../EXECUTION_PLAN_EMAG_3_0.md) T-P0-05
(étendu).

---

## [2.5.1] — 2026-07-09

### Added — Planning v2 UI mutations — T-P0-05b

- **`apps/web/src/components/planning-v2/planningV2Constants.js`** :
  constantes miroir côté client (`TASK_SECTIONS`, `TASK_STATUSES`, labels FR).
- **`apps/web/src/components/planning-v2/TaskFormDialog.jsx`** : modale
  create/edit unifiée sur Design System (`Modal`, `FormField`, `Input`,
  `Select`, `Textarea`, `Button`). Champs : date (requise),
  period (AM/PM), section (20 valeurs), title, notes, status,
  affaire_num, person_id, visible. Validation locale minimale
  (date required) — la validation Zod backend reste la source de vérité.
  Payload nettoyé (trim, coerce int, `null` explicite pour vider un
  champ en mode edit).
- **`apps/web/src/components/planning-v2/TasksPanelV2.jsx`** :
  - Bouton « Nouvelle tâche » dans le header.
  - Colonne « Actions » avec boutons « Modifier » / « Supprimer » par
    ligne (aria-labels détaillés).
  - `Dialog` de confirmation destructive pour DELETE.
  - Extraction propre des erreurs API v2 (`meta.issues[]`, `error`,
    `message`) via `extractApiError()`.
  - Refresh automatique après chaque mutation réussie.
- **`apps/web/src/components/planning-v2/TasksPanelV2.css`** : styles
  `__row-actions` et `__checkbox` (tokens DS).

### Tests Vitest — 10 assertions additionnelles

- `apps/web/src/test/planning-v2/TaskFormDialog.test.jsx` :
  rendu create / edit, validation locale, payload propre, affichage
  erreur backend.
- `apps/web/src/test/planning-v2/TasksPanelV2.mutations.test.jsx` :
  intégration Create → refresh, Edit → refresh, Delete → refresh,
  gestion erreur backend.

### Coexistence

- Aucune intégration à `ModuleHost` / `App.jsx` (réservé T-P0-06).
- `FEATURE_V2_PLANNING` off côté serveur ⇒ bannière info dégradation
  gracieuse.
- Aucune modification v1 (`planningRoutes.js`, `TaskPlanningPanel.jsx`).

Voir aussi : [../api/v2/planning.md](../api/v2/planning.md),
[EXECUTION_PLAN_EMAG_3_0.md](../../EXECUTION_PLAN_EMAG_3_0.md) T-P0-05b.

---

## [2.5.0] — 2026-07-08

### Added — Planning v2 UI (lecture) — T-P0-05

- **`apps/web/src/utils/api/v2/planning.js`** : registrar `registerPlanningV2Methods`
  qui expose sur `ApiClient.prototype` les méthodes `listV2Tasks`, `getV2Task`,
  `createV2Task`, `updateV2Task`, `deleteV2Task`.
- **`apps/web/src/utils/api/index.js`** : enregistrement de `PlanningV2Methods`
  après tous les registrars v1.
- **`apps/web/src/router/featureFlags.js`** : détection client des flags v2 :
  - Query string `?v=2` sur le module correspondant.
  - `localStorage.emag_flag_<name>` = `"1"`.
  - Hook React `useFeatureFlag(name)` réactif (popstate + storage event).
- **`apps/web/src/hooks/v2/usePlanningTasksV2.js`** : hook cursor-based
  (`loadMore`, `refresh`, `hasMore`, `featureDisabled`, `error`). Détecte
  automatiquement le 404 `FEATURE_DISABLED` côté serveur.
- **`apps/web/src/components/planning-v2/TasksPanelV2.jsx`** + `.css` :
  composant lecture minimal (table Design System, Loader, InlineAlert),
  dégradation gracieuse si feature flag off.
- Aucune intégration à `ModuleHost` / `App.jsx` à ce stade : la bascule
  est réservée à T-P0-06 après `P0-DECISION-1`.

### Tests

- `apps/web/src/test/planning-v2/featureFlags.test.jsx` : 6 assertions
  (URL, localStorage, hook réactif).
- `apps/web/src/test/planning-v2/TasksPanelV2.smoke.test.jsx` : 3 scénarios
  (FEATURE_DISABLED, succès + rangs, has_more + bouton "Charger plus").

Voir aussi : [../api/v2/planning.md](../api/v2/planning.md),
[EXECUTION_PLAN_EMAG_3_0.md](../../EXECUTION_PLAN_EMAG_3_0.md) T-P0-05.

---

## [2.4.0] — 2026-06-XX

### Added
- **Auth éphémère par action** côté frontend (compagnon backend `1.3.0`) :
  - `contexts/AuthContext.jsx` : détection compte Équipe via
    `isTeamAccountEmail(email)` (`VITE_TEAM_ACCOUNT_EMAIL`).
  - `components/auth/PersonalActionDialog.jsx` : modal PIN/mot de passe,
    accepte une prop `title` (défaut « Authentification personnelle »).
  - `hooks/usePersonalActionGuard.js` : hook décidant entre appel API
    direct (compte perso) et ouverture de la modal (compte Équipe).
    Callback `onCancel` pour rollback côté appelant si PIN annulé.
  - `utils/api/personalActions.js` : client `personalActions.perform()`.
- Wiring dans 3 composants existants :
  - `LeaveRequestForm` → `request_leave` (compte Équipe : PIN avant POST congé).
  - `PeriodCalendarModal` → `declare_unavailability`.
  - `AssignmentDialog` → `create_assignment`. Compte Équipe : crée d'abord
    la mission (action neutre), puis PIN éphémère pour l'affectation.
    Rollback `deleteMission` si annulé. Multi-affectation bloquée depuis
    le compte Équipe (PIN authentifie une seule personne).
- Tests : `usePersonalActionGuard.test.jsx` (7), `isTeamAccountEmail.test.js` (3).
  Suite frontend : 653/653.

### Notes
- Coexiste avec la **session personnelle** historique
  (`PersonalAuthContext` / `PersonalSuiviWrapper` / `PersonalPlanningWrapper`)
  utilisée pour la consultation/modification libre du Suivi et du Planning
  par un personnel sur tablette compte Équipe. Cas d'usage différents :
  l'auth éphémère est par action ponctuelle, la session est persistante.
- `MobileLeaves` n'est volontairement pas câblé sur l'auth éphémère
  (mobile = compte personnel typiquement, pas la tablette Équipe).

---

## [2.3.0] — 2026-04-11

### Added
- `GoogleCalendarConfig.jsx` : section « Synchronisation bidirectionnelle » avec bouton « Réconcilier depuis Google » et badges résultat (updated/orphaned/errors)
- `GoogleCalendarConfig.css` : styles `.btn-pull-sync`, `.pull-result`, `.pull-stat`, `.pull-stat--warn/muted/error`
- `admin.js` : méthode `syncPullReservations(days)` pour l'API client

### Changed
- `GoogleCalendarBanner.jsx` : session Google persistante via `localStorage` (clé `emag_google_state`) — initialisation instantanée, plus de flash au chargement
- `GoogleCalendarConfig.jsx` : nettoyage `localStorage` lors de la révocation OAuth

---

## [2.2.1] — 2026-04-10

### Fixed
- `useAppData.js` : normalisation payload `updateReservation` (`startDate/startPeriod` depuis `date/period`) pour supprimer les `400 Données invalides` côté production.
- `DepotMap.jsx` : suppression de l'attribut `className` dupliqué sur un élément `<g>` (warning build).
- `ManagementPanel.css` : suppression d'une accolade fermante en trop (erreur CSS minification `Unexpected "}"`).

### Changed
- Édition réservation côté UI alignée sur le backend : autorisée pour utilisateurs non `read_only` (et non uniquement admins).

---

## [2.2.0] — 2026-04-08

### Added
- Hook `useDirtyForm` — détection modifications non sauvegardées avec confirmation fermeture
- Catégorie "Dépôt" (🏠) dans le planning (TaskPlanningPanel + TaskEditModal)
- Champ "Channel" (1-64) dans CameraSettingsModal
- RBAC mobile : filtrage modules selon permissions (Matériel, Commandes, Inventaire)

### Fixed
- `EventTaskModal.jsx` : guard `isNaN` sur parsing dates Google Calendar (Invalid Date)
- `AnnuairePanel.css` : toolbar référentiels aligné (flex-end → align-items center + gap)
- `tv-client/main.js` : sections vides masquées (display:none) au lieu du message "Aucune tâche"

### Changed
- `Button.jsx` : auto `aria-label` depuis `title` quand `iconOnly`
- `VideoPanel.jsx` : aria-labels sur boutons vue (grid, list, playback, admin)

---

## [2.1.8] — 2026-04-07

### Changed
- **Phase K** : Nettoyage dead code — 523 avertissements `no-unused-vars` → 0 (152 fichiers, -71 lignes nettes)
  - 122 `import React` inutiles supprimés (JSX transform React 17+)
  - 214 imports inutilisés retirés (icônes Lucide, hooks, utilitaires non référencés)
  - 110 variables/fonctions mortes préfixées `_` (dead code conservé mais silencieux)
  - 73 arguments de fonction inutilisés préfixés `_` (props, callbacks, catch params)
  - 4 `useState` complets supprimés (loading/setLoading, isResizing, newAffaire, showActions)

---

## [2.1.7] — 2026-04-07

### Changed
- **Phase J** : Audit accessibilité (a11y) — ~90 corrections dans 36 fichiers
  - 1 `<img>` sans `alt` corrigé (BPAnnotationViewer)
  - 6 `aria-label` ajoutés sur champs formulaire (Textarea/Input sans label)
  - 20 boutons fermer : `aria-label="Fermer"` ajouté
  - ~30 modals custom : `role="dialog" aria-modal="true"` ajouté
  - DropdownMenu DS : `role="button" tabIndex={0} aria-haspopup aria-expanded` + navigation clavier
  - MessagingPanel : conversations navigables au clavier (`role="button" tabIndex={0} onKeyDown`)
  - 2 bugs JSX corrigés (OrdersPanel, MobileMaintenances — accolade en trop)

---

## [2.1.6] — 2026-04-08

### Changed
- **Phase H** : 3 `<input>` natifs → `<Input>` DS dans ChangePassword.jsx (champs password avec toggle show/hide)
  - 60 `<input>` natifs restants sont date/time/file/color/radio/range (pas d'équivalent DS)
- **Phase I** : Nettoyage console.log — 2 `console.log` de debug supprimés dans EquipmentPanel.jsx
  - 213 `console.error` + 16 `console.warn` conservés (gestion d'erreurs légitime)

---

## [2.1.5] — 2026-04-07

### Changed
- **Phase G** : 902 `<button>` natifs → `<Button variant="ghost">` dans 112 fichiers
  - Adoption DS Button : 26% → 100%
  - Vérification visuelle recommandée (les styles CSS existants via className sont préservés)

---

## [2.1.4] — 2026-04-07

### Changed
- **Phase F** : 252 magic strings → constantes centralisées dans 57 fichiers
  - `=== 'pending'` / `'active'` / `'completed'` etc. → `STATUS.PENDING` / `STATUS.ACTIVE` / `STATUS.COMPLETED`
  - `=== 'admin'` / `'manager'` → `ROLES.ADMIN` / `ROLES.MANAGER`
  - `setTimeout(fn, 350)` → `setTimeout(fn, TIMING.PANEL_CLOSE)`

---

## [2.1.3] — 2026-04-07

### Changed
- **Phase E** : Validation formulaires + alignement password policy
  - maxLength ajouté sur 31 champs : AnnuairePanel (20), PersonnelPanel (6), AccessRequestModal (3), InterventionModal (2)
  - Password minLength aligné sur backend policy (10 chars + 1 maj + 1 chiffre + 1 spécial)
  - InterventionModal : min="0" sur coût

### Added
- `constants/index.js` : constantes centralisées (STATUS, ROLES, TIMING, VALIDATION)

---

## [2.1.2] — 2026-04-07

### Changed
- **Phase D** : Migration de 2 355 valeurs CSS hardcodées → design tokens (109 fichiers)
  - border-radius : 4/6/8/10/12/16/20px → var(--radius-*)
  - font-size : 10-24px et 0.8-1rem → var(--font-*)
  - z-index : 2000/3001 → var(--z-modal/popover)
  - Nouveau token : --radius-md-lg: 10px

---

## [2.1.1] — 2026-04-07

### Changed
- **Phase C** : Extraction de 155 styles inline → classes CSS dans 6 composants
  - 3 nouveaux fichiers CSS : BLBatchAnalysis.css, SavImportModal.css, ProfileEditModal.css
  - 3 fichiers CSS enrichis : LoginForm.css (+17 classes), ReservationModal.css (+25), SupplierCatalogPanel.css (+8)
  - Handlers hover JS (onMouseEnter/onMouseLeave) remplacés par CSS :hover
  - Pseudo-classe :disabled utilisée pour remplacer les ternaires cursor/opacity

---

## [2.0.0] — 2026-04-07

### Security
- DOMPurify intégré pour sanitisation HTML (Phase 3)
- IndexedDB nettoyé au logout (Phase 3)
- Politique mot de passe renforcée : ≥10 chars, maj, chiffre, symbole (Phase 2)

### Changed
- Migration monorepo : frontend déplacé dans `apps/web/`
- Design System : 43 composants (10 atomes, 11 molécules, 16 organismes)
- 3 thèmes (principal, compact, TV) avec 380+ tokens CSS

---

## [1.0.0] — 2025

### Added
- Interface initiale React 18 + Vite 5.4
- 16 modules fonctionnels (panels, modals, hooks, services)
- Hash-based routing (activeModule)
- 3 contextes (Auth, Navigation, Toast)
