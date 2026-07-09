# Changelog UI / Frontend — eM@g

Toutes les modifications de l'interface utilisateur et des composants React.  
Format : [Keep a Changelog](https://keepachangelog.com)

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
