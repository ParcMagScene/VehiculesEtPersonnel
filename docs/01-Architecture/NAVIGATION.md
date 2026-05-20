# Navigation eM@g — desktop & mobile

> Sprints A → D (mai 2026). Cette page est la **source unique** d'explication
> du système de navigation. Toute évolution doit être tracée ici + dans le
> `CHANGELOG.md` racine.

## Vue d'ensemble

| Surface | Routeur | URL pattern | Source de vérité |
|---|---|---|---|
| Desktop | React Router 6 (`BrowserRouter`) | `/?module=stock&tab=sav&view=week` | search params |
| Mobile  | Hash router custom ([`useMobileRouter`](../../apps/web/src/hooks/useMobileRouter.js)) | `#/mobile/<screen>` | `window.location.hash` |
| QR matériel | hash custom | `#/mobile/equipment/EMAG-12345` | pattern figé `MOBILE_QR_PATTERN` |

## Source unique : `apps/web/src/router/routes.config.js`

Toutes les routes (desktop + mobile) sont déclarées dans **un seul fichier**.
Aucune liste de modules ne doit être hardcodée ailleurs.

| Export | Usage |
|---|---|
| `DESKTOP_MODULES` | Tableau ordonné `{ id, label, icon }` consommé par le `Header` desktop |
| `ALLOWED_MODULES` | Set des `?module=` valides (validation entrée URL) |
| `DEFAULT_MODULE` | Module affiché si URL et localStorage vides |
| `STOCK_SUBTABS` / `DEFAULT_STOCK_SUBTAB` | Validation `?tab=` du module Stocks |
| `CALENDAR_VIEWS` / `DEFAULT_CALENDAR_VIEW` | Validation `?view=` du calendrier |
| `MOBILE_ROUTES` | Mapping screen → path hash mobile |
| `MOBILE_REVERSE_ROUTES` | Index inverse path → screen |
| `MOBILE_TAB_SCREENS` | Set des écrans mobile persistés en `localStorage` |
| `MOBILE_BACK_TARGET` | Hiérarchie parentale pour `goBack()` |
| `MOBILE_QR_PATTERN` | Regex QR code matériel `EMAG-XXXXX` (⚠️ figé : étiquettes physiques) |
| `MOBILE_ACTIVE_TAB_KEY` | Clé `localStorage` du dernier onglet mobile |

## Hook commun : `useSearchParamState`

Défini dans [`apps/web/src/router/RouterCompat.jsx`](../../apps/web/src/router/RouterCompat.jsx).

```js
const [view, setView] = useSearchParamState('view', 'week', {
  allowed: CALENDAR_VIEWS, // valeurs hostiles → defaultValue
  replace: true,           // par défaut : pas de pollution historique
});
```

API style `useState`. Particularités :
- Si `value === defaultValue`, le param est **retiré** de l'URL → URLs propres.
- `replace: true` par défaut : un clic d'onglet ne remplit pas le bouton "Précédent".
- Setter accepte une valeur ou un updater `(prev) => next`.

## Cycle de vie desktop (Sprint B)

1. **Au chargement** — `App.jsx` lit `?module` via `useSearchParamState`.
   Si absent ET `localStorage.emag_last_module` présent → restauration unique
   (puis l'URL prend la main). Géré par `restoredFromStorageRef`.
2. **Clic sur onglet** — `Header` appelle `setActiveModule(id)`. La fonction :
   - ferme les panneaux véhicules (dialogues, slides, maintenance modals),
   - met à jour `?module=` (replace history),
   - écrit en miroir dans `localStorage` (fallback nouvel onglet sans param).
3. **Sous-onglets** — `?tab=vente|sav|inventory` (Stocks), `?view=day|week|month`
   (calendrier). Mêmes règles : URL = vérité, validation par set `allowed`.

## Cycle de vie mobile (Sprint C)

1. `useMobileRouter` parse `window.location.hash`.
2. Hash QR (`MOBILE_QR_PATTERN`) → écran spécial `qr-landing` + `qrUid`.
3. `navigate(screen, params?)` pousse dans l'historique — bouton back navigateur OK.
   Les paramètres optionnels sont sérialisés en query string après le path
   (`#/mobile/equipment-qr?uid=EMAG-123`).
4. `goBack()` remplace le hash courant via `MOBILE_BACK_TARGET`.
5. Les écrans listés dans `MOBILE_TAB_SCREENS` sont persistés
   (`localStorage[MOBILE_ACTIVE_TAB_KEY]`) pour restauration au prochain démarrage.

## Persistance UI mobile (audit 2026-05-20)

Objectif : aucun travail perdu sur F5, retour navigateur, ou réveil d'onglet.
Trois primitives complémentaires, **toutes basées sur Web Storage natif**
(pas de Redux/Zustand/Jotai). Chaque clé est documentée pour audit RGPD.

| Hook | Backend | Usage |
|---|---|---|
| [`useDraftStorage(key, initial, {ttlMs})`](../../apps/web/src/hooks/useDraftStorage.js) | `sessionStorage` | Brouillons de formulaires (TTL 24 h par défaut). API `[value, setValue, {clear, commit, isDirty}]`. `key=null` désactive la persistance. Recharge automatiquement quand la clé change (chat multi-conversation, équipement multi-UID). |
| [`useStoredListState(key, default, {backend})`](../../apps/web/src/hooks/useStoredListState.js) | `session` ou `local` | Préférences UI sérialisables JSON (filtres, mode d'affichage, sélection par id). |
| [`useUnsavedChangesGuard(isDirty)`](../../apps/web/src/hooks/useUnsavedChangesGuard.js) | listener `beforeunload` | Dialogue natif si formulaire dirty au moment d'un F5 ou close. |

### Clés sessionStorage / localStorage utilisées

| Clé | Hook | Composant | Contenu |
|---|---|---|---|
| `mobile:reservations:draft` | `useDraftStorage` | `MobileReservations` | Brouillon formulaire réservation |
| `mobile:reservations:showForm` | `useStoredListState` | `MobileReservations` | `bool` — formulaire ouvert |
| `mobile:maintenances:draft` | `useDraftStorage` | `MobileMaintenances` | Brouillon maintenance |
| `mobile:maintenances:showForm` | `useStoredListState` | `MobileMaintenances` | `bool` |
| `mobile:maintenances:formType` | `useStoredListState` | `MobileMaintenances` | Type sélectionné dans le formulaire |
| `mobile:equipment-qr:<uid>:screen` | `useStoredListState` | `MobileEquipmentQR` | Écran actif par équipement |
| `mobile:equipment-qr:<uid>:draft:<type>` | `useDraftStorage` | `MobileEquipmentQR` | Brouillon défaut/SAV/intervention par UID |
| `mobile:messaging:<conversationId>:input` | `useDraftStorage` | `MobileMessaging` | Message en cours de saisie par conversation |
| `mobile:leaves:view` / `:filter` / `:selectedId` | `useStoredListState` | `MobileLeaves` | Vue, filtre, demande sélectionnée |
| `mobile:affaires:selectedNum` / `:search` / `:filterType` | `useStoredListState` | `MobileAffaires` | Affaire ouverte, recherche, filtre |
| `mobile:personnel:selectedId` / `:viewMode` | `useStoredListState` | `MobilePersonnel` | Personne sélectionnée, jour/semaine |
| `mobile:planning:selectedMonth` | `useStoredListState` | `MobilePlanning` | Mois visualisé (ISO string) |
| `mobile:tasks:collapsedSections` / `:showAll` | `useStoredListState` | `MobileTasks` | Sections repliées (Array sérialisé en Set), filtre "toutes" |
| `mobileActiveTab` (`MOBILE_ACTIVE_TAB_KEY`) | `useMobileRouter` | (global) | Dernier onglet visité dans `MOBILE_TAB_SCREENS` |

### Conventions

- **Préfixe `mobile:` obligatoire** pour les clés rattachées à l'app mobile.
- **Sélection persistée = identifiant uniquement** (jamais l'objet métier).
  Le composant reconstruit l'objet depuis la collection courante au mount —
  évite stale data et fuite RGPD (les objets contiennent souvent du PII).
- **Objets non sérialisables JSON** (Set, Date) : convertir au boundary du
  hook (Set ↔ Array, Date ↔ ISO string). Exemple : `MobileTasks`.
- **TTL drafts = 24 h** : un brouillon plus ancien est ignoré au reload pour
  éviter de réinjecter un état périmé (équipement supprimé, formulaire
  modifié côté backend, etc.).

### Compromis assumés

- **`MobileMessaging` — `activeConversation` non persisté** dans le hash.
  Le draft est lié à `conversationId` (donc bien restauré une fois la
  conversation rouverte) mais l'utilisateur retombe sur la liste après F5.
  Persistance via query param refusée à ce stade : refactor trop invasif
  pour un gain marginal (l'utilisateur retrouve immédiatement la conversation
  via la liste, et le brouillon réapparaît).
- **`currentDate` de `MobilePersonnel`** non persisté : voulu — revient
  systématiquement à aujourd'hui (cohérent avec un outil de planification
  journalier).

## Garde formulaires (Sprint D)

[`useUnsavedChangesGuard(isDirty)`](../../apps/web/src/hooks/useUnsavedChangesGuard.js)
pose un listener `beforeunload` quand un formulaire est dirty → dialogue natif
du navigateur sur F5 / fermeture onglet / navigation externe.

Branché sur :
- [`UserPreferencesModal`](../../apps/web/src/components/auth/UserPreferencesModal.jsx)
- [`MaintenanceDialog`](../../apps/web/src/components/vehicles/MaintenanceDialog.jsx)
- [`TripDetailsModal`](../../apps/web/src/components/vehicles/TripDetailsModal.jsx)

> Le cas "fermeture modale via X / Esc" reste géré par les patterns
> `showUnsavedWarning` internes des composants — `useUnsavedChangesGuard`
> ne couvre QUE les actions navigateur.

## Tests

- [`apps/web/src/test/useSearchParamState.test.jsx`](../../apps/web/src/test/useSearchParamState.test.jsx) — 7 tests : validation, setter, mode replace
- [`apps/web/src/test/useMobileRouter.test.jsx`](../../apps/web/src/test/useMobileRouter.test.jsx) — 13 tests : parseHash, navigate, goBack, QR

```bash
cd apps/web && npx vitest run src/test/useSearchParamState.test.jsx src/test/useMobileRouter.test.jsx
```

## Décisions volontairement écartées

- **PWA / service worker** — actuellement désactivé via `public/sw-cleanup.js`
  (choix opérationnel passé suite à un bug). Ne pas réactiver sans audit dédié.
- **React Router pour mobile** — casserait les QR codes physiques imprimés.
- **`useBlocker` React Router** — non nécessaire : les modales d'édition sont
  des overlays bloquants, donc l'utilisateur ne peut pas changer de module
  sans d'abord fermer la modale (qui a déjà son propre `showUnsavedWarning`).
