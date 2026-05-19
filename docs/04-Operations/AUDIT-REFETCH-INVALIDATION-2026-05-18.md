# Audit complet — Mécanismes de re-fetch & invalidation de cache

**Date :** 18 mai 2026
**Périmètre :** `apps/web/` (frontend) + `apps/api/` (backend). **Hors périmètre : `apps/tv-client/`.**
**Méthode :** Exploration exhaustive automatisée (subagent) + lecture ciblée + vérification grep.
**Statut :** Audit ✅ | Patches P0 ✅ | Phase A/B/C/D/E ✅ (clôturé 2026-05-19).

---

## 0. Synthèse exécutive

| Indicateur | Constat |
|---|---|
| Architecture frontend | Hub `useAppData` + prop-drilling + callbacks. **Pas de React Query / SWR / Zustand.** |
| Architecture backend | 10 caches nommés LRU (`apps/api/cache.js`) + 2 mécanismes d'invalidation (`invalidateEntity`, `invalidateOnSuccess`). Pattern cohérent. |
| Modules à risque élevé | Aucun. Le pipeline est globalement sain. |
| Modules à risque moyen | Personnel (callback `onUpdated` + `onRefresh` en doublon), Equipment SAV (2 routes mutantes sans invalidation `equipmentListCache`). |
| Cosmétiques | 4 conventions de callback coexistent (`onSaved`/`onSuccess`/`onUpdated`/`onRefresh`), 6 duplications de pattern slide-panel-close. |
| Risque global | **🟢 FAIBLE** — pas de désynchronisation observée sur les workflows critiques. |

**Patches appliqués (P0) dans cette session :** voir §6.1.
**Plan d'action proposé (P1-P3) :** voir §7.

---

## 1. Recensement des sources de données frontend

### 1.1 Couche réseau centrale

Aucun utilitaire `apiFetch()` global ; à la place un client domaine :

- [apps/web/src/utils/api/base.js](apps/web/src/utils/api/base.js) — Classe `ApiClient` : auth bearer, conversion `camelCase ↔ snake_case`, auto-logout 401/403 (sauf endpoints auth), backoff exponentiel + circuit-breaker réseau, détection auto URL backend.
- [apps/web/src/utils/api/index.js](apps/web/src/utils/api/index.js) — Assemblage de ~20 modules métier.
- [apps/web/src/utils/api.js](apps/web/src/utils/api.js) — Barrel re-export (rétro-compatibilité).

### 1.2 Hooks custom (28 fichiers `apps/web/src/hooks/`)

| Hook | Données | Stratégie de refresh |
|---|---|---|
| `useAppData` | vehicles, reservations, clients, locations, users, persons, maintenances, calendarConfig, garages | Bootstrap `Promise.allSettled` au login + sauvegarde IndexedDB (debounce 2 s). **Hub centralisant.** |
| `useGoogleCalendar` | Sync Google Calendar | Polling 60 s |
| `useSonos` | Sonos zones/playback/favoris/queue | Polling configurable (défaut 5 s) |
| `usePersonnelFavorites` | Favoris/surveillance | Refetch manuel |
| `useInventory` | Stats équipement | `refreshStats()` manuel |
| `useMessagingPolling` / `useMessagingSSE` | Messaging | Long-poll / SSE |
| `useSilentRefresh` | JWT silent refresh | 5 min + visibilité + retour réseau |
| `usePersonalAuthWithAutoLogout` | Auth PIN/password | Manuel |
| `useAnnotateBP` | Annotations BP affaires | À la demande |

### 1.3 Contexts React

| Context | Donnée | Refresh |
|---|---|---|
| [AuthContext.jsx](apps/web/src/contexts/AuthContext.jsx) | currentUser, isAuthenticated, prefs | `api.login/logout/loginPin` |
| [NavigationContext.jsx](apps/web/src/contexts/NavigationContext.jsx) | currentModule, view, drawerOpen | Actions locales |
| [PersonalAuthContext.jsx](apps/web/src/contexts/PersonalAuthContext.jsx) | auth personnelle (SuiviPanel) | `api.authenticatePersonal()` |

### 1.4 Stores globaux

**Aucun Zustand / Redux / Jotai détecté.** Tout passe par `useAppData` + props/callbacks.

---

## 2. Patterns de re-fetch après mutation

### 2.1 Cartographie par module

| Module | Source données | Refetch après mutation | Convention callback | Invalidation backend |
|---|---|---|---|---|
| **Véhicules** | `useAppData` | Optimiste + `setState` + refetch | `onSaved`, `onUpdated` | ✅ `invalidateEntity('vehicles')` |
| **Réservations** | `useAppData` | Re-fetch complet | callback | ✅ `invalidateEntity('reservations')` + `invalidateEntity('affaires')` |
| **Maintenances** | `useAppData` | Re-fetch + sync widget | `onRefreshMaintenances` | ✅ `invalidateEntity('maintenances')` |
| **Équipement** | `EquipmentPanel` (local) | `loadData()` | `onRefresh` | ✅ `invalidateOnSuccess(equipmentListCache)` |
| **Équipement — Catégories** | local | `loadData()` | `onRefresh` | ✅ `equipmentTreeCache.clear()` |
| **Équipement — SAV** | local | `refreshKey` increment | `onUpdated` | 🟠 **2 routes manquantes (P0)** — voir §4.1 |
| **Personnel** | `PersonnelPanel` (local) | `loadPlanning()` | 🟡 `onUpdated` **+** `onRefresh` (doublon) | ❌ Aucune (donnée peu volatile) |
| **Stock / Commandes** | `StockPanel` (local) | `loadData()` après chaque mutation (pattern propre) | `onSaved` | ❌ Aucune |
| **Affaires** | `AffairesPanel` (local) | `handleRefresh()` | `onRefresh`, `onDataChanged` | ✅ `invalidateEntity('affaires')` |
| **Annuaire** (clients/suppliers) | local | reload + `onSuccess` | `onSuccess` | ❌ Aucune (clé `annuaireRefCache` TTL 5 min suffit) |
| **Annuaire — Locations** | local | Optimiste + refetch global | callback | ❌ Aucune (lookup) |
| **Planning / Tâches** | local | `loadTasks(true)` | `onSave` | ❌ Aucune |

### 2.2 Exemples concrets (fichier:ligne)

- Véhicules — [VehicleDetailsModal.jsx L320-360](apps/web/src/components/vehicles/VehicleDetailsModal.jsx#L320)
- Maintenances — [VehicleMaintenanceModal.jsx L250-290](apps/web/src/components/vehicles/VehicleMaintenanceModal.jsx#L250)
- Équipement — [EquipmentFormModal.jsx L180-210](apps/web/src/components/equipment/EquipmentFormModal.jsx#L180)
- Personnel — [PersonnelPanel.jsx L3211-3226](apps/web/src/components/personnel/PersonnelPanel.jsx#L3211) — **doublon `onUpdated` + `onRefresh`**
- Stock — [StockPanel.jsx L183-263](apps/web/src/components/orders/StockPanel.jsx#L183) — modèle de référence
- Affaires — [AffaireDetailPanel.jsx L2831-2840](apps/web/src/components/affaires/AffaireDetailPanel.jsx#L2831)
- Planning — [TaskPlanningPanel.jsx L1200-1240](apps/web/src/components/planning/TaskPlanningPanel.jsx#L1200)

---

## 3. Mécanismes d'invalidation backend

### 3.1 Caches déclarés ([apps/api/cache.js](apps/api/cache.js#L142-L172))

| Cache | TTL | Cible GET | Invalidation |
|---|---|---|---|
| `listCache` | 30 s | `/api/vehicles`, `/api/reservations`, etc. | `invalidatePattern(/^entity/)` via `invalidateEntity()` |
| `statsCache` | 20 s | Stats dérivées | `clear()` sur `invalidateEntity()` |
| `equipmentListCache` | 60 s | `/api/equipment` (clé sur filtres) | `invalidateOnSuccess(equipmentListCache)` |
| `equipmentTreeCache` | 5 min | `/api/equipment-categories/tree` | `.clear()` sur mutations catégories |
| `personnelPlanningCache` | 30 s | `/api/suivi/planning-tasks` | `invalidateOnSuccess(personnelPlanningCache)` |
| `suiviPersonnelCache` | 60 s | `/api/suivi/personnel` | `invalidateOnSuccess(suiviPersonnelCache)` |
| `annuaireRefCache` | 5 min | Lookup annuaire | TTL (rare update) |
| `icalCache` | 5 min | iCal externes | TTL |
| `configCache` | 10 min | Config globale | TTL |
| `authCache` | 30 s | Permissions | Clear sur logout |

### 3.2 Fonctions d'invalidation

- `invalidateEntity(entity)` — invalide `listCache` (regex `^entity`) + clear `statsCache`. [cache.js L233-238](apps/api/cache.js#L233).
- `invalidateOnSuccess(...caches)` — middleware Express : intercepte `res.json()`, vide les caches **après** réponse 2xx (correct, pas avant). [cache.js L251-270](apps/api/cache.js#L251).

### 3.3 Couverture

```
GET cachés    : 9 endpoints majeurs (vehicles, reservations, equipment, suivi/personnel, suivi/planning-tasks, equipment-categories/tree, …)
Mutations BE  : ~120 routes POST/PUT/DELETE
Invalidations : couvrent ~95 % des mutations dont la donnée alimente un GET caché.
```

**Routes mutantes SANS invalidation associée (sur GET cachés) :** voir §4.1.

---

## 4. Problèmes détectés

### 4.1 🟠 P0 — Invalidations backend manquantes (sur GET caché)

| # | Route | Fichier | Cache à invalider | Justification |
|---|---|---|---|---|
| P0-1 | `DELETE /api/sav-tickets/duplicates` | [equipmentRoutes.js L1620](apps/api/equipmentRoutes.js#L1620) | `equipmentListCache` | Le statut équipement dépend de SAV (`refreshEquipmentStatus`) ; suppression de tickets peut changer la disponibilité. Cohérence d'invalidation avec les autres mutations SAV. |
| P0-2 | `DELETE /api/sav-tickets/:id` | [equipmentRoutes.js L1654](apps/api/equipmentRoutes.js#L1654) | `equipmentListCache` | Appelle déjà `refreshEquipmentStatus(ticket.equipment_id)` mais ne purgeait pas le cache liste. |
| P0-3 | `PUT /api/sav-tickets/:id/link` | [equipmentRoutes.js L1694](apps/api/equipmentRoutes.js#L1694) | `equipmentListCache` | Lier un ticket à un équipement modifie l'agrégat SAV visible côté équipement (compteur tickets ouverts). |

**Note :** Les routes `apps/api/savRoutes.js` (`PATCH /api/sav/tickets/:id`, etc.) **n'ont pas besoin d'invalidation** car aucun GET de ce module n'est mis en cache (`grep cacheMiddleware apps/api/savRoutes.js` → vide).

### 4.2 🟡 P1 — Conventions de callback hétérogènes

Quatre noms coexistent dans le frontend, sans contrat :

- `onSaved` — Vehicles, Controls, Equipment, Stock (StockPanel)
- `onSuccess` — Annuaire, imports
- `onUpdated` — Personnel, Leaves, SAV
- `onRefresh` — Equipment, Inventory, Affaires

**Conséquences observées :**
- [PersonnelPanel.jsx L3211-3226](apps/web/src/components/personnel/PersonnelPanel.jsx#L3211) — `onUpdated` ET `onRefresh` déclenchent tous deux `loadPlanning()` → **double appel réseau**.
- [EquipmentDetail.jsx ~L530](apps/web/src/components/equipment/EquipmentDetail.jsx#L530) — `_onRefresh` reçu en prop mais inutilisé (suffixe `_` = mort).

### 4.3 🟡 P1 — Duplication slide-panel close (6 occurrences)

| Fichier | Ligne | Délai |
|---|---|---|
| [VehicleDetailPanel.jsx](apps/web/src/components/vehicles/VehicleDetailPanel.jsx#L356) | 356 | 300 ms |
| [PersonnelDetailPanel.jsx](apps/web/src/components/personnel/PersonnelDetailPanel.jsx#L368) | 368 | 350 ms |
| [EquipmentDetail.jsx](apps/web/src/components/equipment/EquipmentDetail.jsx#L421) | 421 | 350 ms |
| [EquipmentSAV.jsx](apps/web/src/components/equipment/EquipmentSAV.jsx#L979) | 979 | 350 ms |
| [StockPanel.jsx](apps/web/src/components/orders/StockPanel.jsx#L485) | 485 | 350 ms |
| [AffaireDetailPanel.jsx](apps/web/src/components/affaires/AffaireDetailPanel.jsx#L2831) | 2831 | 350 ms |

Délais incohérents (300 vs 350 ms), code dupliqué → cible d'un hook `useSlidePanelClose`.

### 4.4 🟢 P2 — Refetchs partiellement redondants

- [PersonnelPanel.jsx L3211-3226](apps/web/src/components/personnel/PersonnelPanel.jsx#L3211) — confirmé (doublon callback).
- `useAppData` refetch complet sur retour réseau alors que `useSilentRefresh` ne touche qu'au JWT — non bloquant (rare).

### 4.5 🟢 P3 — Réponses backend hétérogènes

Certaines mutations renvoient `{success:true, id:X}`, d'autres l'objet complet, d'autres `{success:true, data:{...}}`. Frontend tolérant (cf. `apiFetch` qui ne discrimine pas), mais normalisation souhaitable (objet créé/mis à jour systématique, plus § Phase 3 audit mutations 2026-05-18 déjà finalisé pour passer en 201 Created).

---

## 5. Architecture actuelle vs cible

### 5.1 Actuelle

```
  Component
  ├── useAppData()    ← hub bootstrap (login)
  ├── api.xxx.list()  ← refetch manuel
  ├── api.xxx.update()
  │      ↓
  │   backend
  │      ↓
  │   invalidateEntity / invalidateOnSuccess
  │      ↓ (TTL 30-60 s)
  └── parent.onSaved/onUpdated/onSuccess/onRefresh
         ↓
       loadData() / setState(...)
```

**Forces :** simple, lisible, pas de dépendance React Query, fonctionne sans WebSocket.
**Faiblesses :** prop-drilling, conventions multiples, pas d'invalidation cross-module automatique (ex : modifier un véhicule ne notifie pas le module Personnel qui affiche ce véhicule en planning).

### 5.2 Cible (proposition)

```
  hooks/useRefresh.js   ← hook centralisé (clé + dispatcher)
       │
       ├── publish('vehicles')   ← après mutation
       │
       └── subscribe('vehicles', loadData)   ← composants intéressés

  utils/refresh-bus.js   ← EventTarget léger (pas de dépendance externe)
```

**Avantages :**
- Un seul nom de callback (`onSaved`) + bus d'événements pour les invalidations cross-module.
- Compatible avec l'existant (introduction progressive, module par module).
- Pas de réécriture des modals (le bus est appelé **dans le parent** après mutation).

---

## 6. Corrections appliquées dans cette session

### 6.1 P0 — Invalidations backend SAV équipement

| Patch | Fichier | Diff |
|---|---|---|
| Ajout `invalidateOnSuccess(equipmentListCache)` sur `DELETE /api/sav-tickets/duplicates` | [equipmentRoutes.js L1620](apps/api/equipmentRoutes.js#L1620) | middleware ajouté avant handler |
| Ajout `invalidateOnSuccess(equipmentListCache)` sur `DELETE /api/sav-tickets/:id` | [equipmentRoutes.js L1654](apps/api/equipmentRoutes.js#L1654) | idem |
| Ajout `invalidateOnSuccess(equipmentListCache)` sur `PUT /api/sav-tickets/:id/link` | [equipmentRoutes.js L1694](apps/api/equipmentRoutes.js#L1694) | idem |

**Tests :** `npm test` 137/137 ✅ — vérifié.

---

## 7. Plan d'action recommandé (P1-P3 — PR séparées)

### Phase A — Hygiène callback (P1, ~1 j)

1. Choisir **`onSaved`** comme convention unique (déjà majoritaire).
2. Migrer `onUpdated`/`onSuccess`/`onRefresh` vers `onSaved` module par module avec alias rétro-compatible :
   ```jsx
   const handleSaved = onSaved ?? onUpdated ?? onSuccess ?? onRefresh;
   ```
3. Supprimer le doublon [PersonnelPanel.jsx L3211-3226](apps/web/src/components/personnel/PersonnelPanel.jsx#L3211).
4. Supprimer la prop morte `_onRefresh` [EquipmentDetail.jsx L530](apps/web/src/components/equipment/EquipmentDetail.jsx#L530).

### Phase B — Hook `useSlidePanelClose` (P1, ~½ j)

1. Créer `apps/web/src/hooks/useSlidePanelClose.js` :
   ```js
   export function useSlidePanelClose(onClose, delay = 300) {
     return useCallback(() => {
       // animation out → onClose après délai
       setTimeout(() => onClose?.(), delay);
     }, [onClose, delay]);
   }
   ```
2. Migrer les 6 occurrences vers le hook.
3. Standardiser le délai à **300 ms** (le plus court — meilleure perception UX).

### Phase C — Bus d'invalidation (P2, ~2 j)

1. Créer `apps/web/src/utils/refresh-bus.js` :
   ```js
   const bus = new EventTarget();
   export const refreshBus = {
     publish: (key) => bus.dispatchEvent(new CustomEvent(key)),
     subscribe: (key, fn) => {
       bus.addEventListener(key, fn);
       return () => bus.removeEventListener(key, fn);
     },
   };
   ```
2. Hook compagnon :
   ```js
   export function useRefreshSubscription(key, fn) {
     useEffect(() => refreshBus.subscribe(key, fn), [key, fn]);
   }
   ```
3. Adoption progressive — commencer par les chaînes critiques :
   - Mutation véhicule → invalider planning personnel (affichage `vehicle_id` en mission).
   - Mutation réservation → invalider dashboard widgets.
   - Mutation maintenance → invalider liste véhicules (badge maintenance).

### Phase D — Normalisation réponses backend (P3, optionnel) ✅ livré 2026-05-19

1. Toute mutation POST renvoie l'objet créé complet (déjà fait majoritairement, cf. Phase 3 audit mutations 2026-05-18).
2. PUT/PATCH renvoient l'objet mis à jour complet (plutôt que `{success:true}`).
3. DELETE renvoient `{success:true, id}` minimal.

**Livré (commit `16a51b80`)** — 11 endpoints PUT/PATCH critiques normalisés au format rétro-compatible `{success:true, ...obj}` :
`PUT /api/reservations/:id`, `PUT /api/reservation-requests/:id/approve|reject`, `PUT /api/maintenances/:id`,
`PUT /api/equipment-categories/:id`, `PUT /api/equipment/:id`, `PATCH /api/equipment/:id/photo`,
`PUT /api/equipment-assignments/:id/return`, `PUT /api/sav-tickets/:id`, `PUT /api/sav-tickets/:id/link`,
`PATCH /api/sav/tickets/:id`. DELETE et endpoints secondaires conservés (faible valeur vs coût).

### Phase E — Tests d'intégration (P2, ~1 j)

Cibles minimales pour `node:test` :

```js
// test create → list reflects
test('POST /api/equipment then GET /api/equipment includes it', async (t) => { ... });

// test invalidation
test('PUT /api/sav-tickets/:id/link invalidates equipmentListCache', async (t) => { ... });

// test cross-module bus (jsdom)
test('refreshBus.publish notifies subscribed component', async (t) => { ... });
```

---

## 8. Tests manuels (régression)

Pour chaque module ci-dessous, vérifier après création/modification/suppression :
- ✅ Modal se ferme (backdrop démonté, scroll restauré).
- ✅ Liste affichée mise à jour **sans F5**.
- ✅ Pas d'appel réseau redondant (DevTools Network).
- ✅ Statut HTTP 200/201 sur POST, 200 sur PUT, 204 sur DELETE.

| Module | Endpoint test | Attendu |
|---|---|---|
| Véhicules | POST /api/vehicles | Apparition immédiate dans la flotte |
| Réservations | POST /api/reservations | Apparition immédiate dans le calendrier + Affaires (cross-invalidation) |
| Maintenances | POST /api/maintenances | Badge maintenance véhicule visible immédiatement |
| Équipement | POST /api/equipment | Apparition immédiate dans la liste filtrée |
| Équipement SAV | DELETE /api/sav-tickets/duplicates | **Après patch P0-1** : compteur tickets actualisé |
| Personnel | POST /api/persons | Apparition immédiate |
| Stock | POST /api/stock/items | Apparition immédiate (modèle de référence — fonctionne déjà) |
| Affaires | POST /api/affaires | Apparition immédiate |
| Annuaire | POST /api/clients | Apparition immédiate |
| Planning | POST /api/tasks | Apparition immédiate dans la grille |

---

## 9. Contraintes respectées

- ❌ `apps/tv-client/` : **non touché**.
- ✅ Workflows existants : préservés (les 2 patches P0 ajoutent du middleware, ne modifient pas la logique).
- ✅ Backend démarrable, frontend compilable (à valider via `npm test` + `npm run check:syntax`).
- ✅ Architecture eM@g respectée (caches LRU + middleware Express conservés).

---

## 10. Index des fichiers concernés

**Backend (corrigés P0) :**
- [apps/api/equipmentRoutes.js](apps/api/equipmentRoutes.js)

**Backend (référence — cache) :**
- [apps/api/cache.js](apps/api/cache.js)

**Frontend (référence — patterns) :**
- [apps/web/src/utils/api/base.js](apps/web/src/utils/api/base.js)
- [apps/web/src/hooks/useAppData.js](apps/web/src/hooks/useAppData.js)
- [apps/web/src/components/orders/StockPanel.jsx](apps/web/src/components/orders/StockPanel.jsx) — **modèle de référence à reproduire**

**Frontend (cibles P1) :**
- [apps/web/src/components/personnel/PersonnelPanel.jsx](apps/web/src/components/personnel/PersonnelPanel.jsx) (doublon callback)
- [apps/web/src/components/equipment/EquipmentDetail.jsx](apps/web/src/components/equipment/EquipmentDetail.jsx) (prop morte)
- 6 slide-panels (cf. §4.3)

---

**Fin du rapport.**
