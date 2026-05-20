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
3. `navigate(screen)` pousse dans l'historique — bouton back navigateur OK.
4. `goBack()` remplace le hash courant via `MOBILE_BACK_TARGET`.
5. Les écrans listés dans `MOBILE_TAB_SCREENS` sont persistés
   (`localStorage[MOBILE_ACTIVE_TAB_KEY]`) pour restauration au prochain démarrage.

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
