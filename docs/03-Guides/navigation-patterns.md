# Guide — Patterns de navigation eM@g (frontend)

> **Statut** : Vivant. Mis à jour suite à l'audit navigation 2026-05-20 (lots N1→N6).
> **Portée** : `apps/web` uniquement. `apps/tv-client` est gelé (interdiction de modification).

## 1. Architecture de navigation

### Desktop
- **Pas de `<Routes>` React Router** : la "page courante" est exprimée par le search param `?module=xxx`.
- Source de vérité : `useSearchParamState('module', DEFAULT_MODULE, { allowed: ALLOWED_MODULES })` dans `App.jsx`.
- Catalogue : `apps/web/src/router/routes.config.js` (`DESKTOP_MODULES`, `ALLOWED_MODULES`, `STOCK_SUBTABS`, `CALENDAR_VIEWS`).
- Fallback : `localStorage['emag_last_module']` réappliqué une seule fois au premier mount sans `?module=`.

### Mobile
- Custom hash router : `useMobileRouter` (`#/mobile/<screen>`).
- Écrans listés dans `routes.config.js` (`MOBILE_SCREENS`).

### Modals / Drawers
- Composant racine `Modal` (`components/ui/Modal.jsx`) : prop **`open`** (canonique). `isOpen` est accepté en rétrocompat avec `console.warn` en dev.
- ModalManager (`utils/modalManager.js`) : pile + z-index calculé + scroll lock.

## 2. Helpers à utiliser

### `softReload(reason, { delayMs })` — `utils/softReload.js`
Remplace tout `window.location.reload()`. Trace la raison, émet un `CustomEvent('app:soft-reload')`.

Raisons connues : `auth-session-expired`, `auth-token-invalid`, `auth-access-denied`, `error-boundary`, `account-created`, `backup-restored`, `user-switch`.

```js
import { softReload } from '../utils/softReload';
softReload('user-switch');
softReload('backup-restored', { delayMs: 500 });
```

**Seule exception légitime** : `TVPreviewPanel` recharge son iframe interne (pas l'app).

### `useSearchParamState(key, defaultValue, { allowed, onInvalid })` — `router/RouterCompat.jsx`
Synchronise un état avec un search param. Valide contre un `Set`, nettoie l'URL si la valeur est invalide, invoque `onInvalid(raw)`.

```js
const [tab, setTab] = useSearchParamState('tab', 'vente', {
  allowed: STOCK_SUBTABS,
  onInvalid: (raw) => toast.warning(`Onglet "${raw}" inconnu.`),
});
```

### `useRefreshOnFocus(refreshFn, { minIntervalMs, enabled })` — `hooks/useRefreshOnFocus.js`
Recharge les données quand l'onglet redevient visible (couvre veille machine, multi-tabs). Throttle par défaut 30 s. À combiner avec `refreshBus.subscribe(key, fn)` pour les mutations intra-app.

```js
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

const loadAffaires = useCallback(async () => { /* ... */ }, []);
useRefreshOnFocus(loadAffaires, { minIntervalMs: 60_000 });
```

### `useStoredListState(key, defaultValue, { backend })` — `hooks/useStoredListState.js`
Variante de `useState` qui persiste dans `sessionStorage` (par défaut) ou `localStorage`. Convention de clé : `<module>:<topic>`.

```js
const [filters, setFilters, resetFilters] = useStoredListState('affaires:filters', {
  search: '', type: 'all', dateStart: null, dateEnd: null,
});
```

### `refreshBus` — `utils/refresh-bus.js`
Bus d'évènements global pour signaler "telle entité a changé, recharge". Utilisé par les modals de mutation pour invalider les listes.

```js
// Côté mutation
await api.affaires.update(id, payload);
refreshBus.publish('affaires');

// Côté liste
useRefreshSubscription('affaires', loadAffaires);
```

## 3. Anti-patterns à éviter

| ❌ Anti-pattern | ✅ Alternative |
|---|---|
| `window.location.reload()` | `softReload('reason')` |
| `window.location.href = '/?module=xxx'` | `setActiveModule('xxx')` (desktop) ou `navigate('screen')` (mobile) |
| `<a href="/?module=xxx">` interne | `<button onClick={() => setActiveModule(...)}>` |
| `<Modal isOpen={x}>` (depuis composant qui wrap `Modal`) | `<Modal open={x}>` (`isOpen` toléré en rétrocompat) |
| `useEffect(() => fetch(), [])` sans bus ni focus refresh | + `useRefreshOnFocus` et/ou `useRefreshSubscription` |
| Filtres listes en `useState` local perdus à chaque navigation | `useStoredListState('module:filters', ...)` |
| `navigate(-1)` dans une liste | Préférer un bouton "Retour" explicite vers la vue parente connue |

## 4. Checklist de validation manuelle (scénarios)

Pour chaque livraison touchant la navigation :

1. **F5 sur une vue filtrée** → filtres restaurés (si module utilise `useStoredListState` ou search params).
2. **URL `?module=valeurBidon`** → toast warning + redirection module par défaut + URL nettoyée.
3. **Tab inactif > 1 min puis retour** → listes principales rechargent (modules instrumentés avec `useRefreshOnFocus`).
4. **Mutation depuis modal (créer/éditer/supprimer)** → liste sous-jacente reflète le changement sans F5 (via `refreshBus`).
5. **Session expirée (token JWT révoqué)** → `softReload('auth-session-expired')` → écran login propre.
6. **ErrorBoundary déclenchée** → bouton "Réessayer" reset le sous-arbre (mode inline) OU `softReload('error-boundary')` (mode page).
7. **Mobile : back du navigateur** → revient à l'écran précédent via hash router (`#/mobile/...`).
8. **Mobile : changement d'utilisateur** → `softReload('user-switch')` → écran login.

## 5. Roadmap (lots restants ou à venir)

- Brancher `useRefreshOnFocus` sur `AffairesPanel`, `EquipmentPanel`, `AnnuairePanel`, `OrdersPanel`.
- Migrer les filtres locaux des panels ci-dessus vers `useStoredListState`.
- Ajouter une page `NotFound` accessible via fenêtre détachée (`?module=sonos&detached=1` style) si périmètre élargi.
- Étendre `softReload()` pour qu'à terme il invalide les caches React Query / stores au lieu d'un hard reload.

## 6. Historique

| Date | Lot | Auteur | Description |
|---|---|---|---|
| 2026-05-20 | N2 | audit nav | `softReload()` centralisé, 8 `window.location.reload()` migrés |
| 2026-05-20 | N3 | audit nav | `useSearchParamState` accepte `onInvalid`, toast + URL clean |
| 2026-05-20 | N4 | audit nav | Hook `useRefreshOnFocus` (non branché par défaut) |
| 2026-05-20 | N5 | audit nav | Hook `useStoredListState` (non branché par défaut) |
| 2026-05-20 | N6 | audit nav | Création de ce guide |
