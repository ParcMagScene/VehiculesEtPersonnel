# 📱 Audit complet — Persistance de la GUI Mobile eM@g

> **Date** : 2026-05-20  
> **Périmètre** : `apps/web/src/components/mobile/**`, `apps/web/src/hooks/useMobileRouter.js`, `apps/web/src/router/routes.config.js`  
> **Exclu** : `apps/tv-client/**` (interdit), `apps/api/**` (hors scope frontend)  
> **Objectif** : garantir que l'interface mobile conserve toujours l'état utilisateur — navigation, page courante, filtres, sélections, modals — et qu'un refresh (F5) ou une navigation interne ne casse jamais un workflow.

---

## 0. Synthèse exécutive

| Indicateur | Valeur |
|---|---|
| Écrans mobiles | **19** (`MOBILE_ROUTES`) |
| Écran courant restauré au refresh | ✅ (hash router `#/mobile/<screen>`) |
| Onglet principal mémorisé | ⚠️ Partiel — 5 écrans sur 19 (`MOBILE_TAB_SCREENS`) |
| Sous-vue interne restaurée (`view`, `screen`) | ❌ Aucun écran |
| Sélection en cours (`selectedX`) restaurée | ❌ Aucun écran |
| Filtres / recherche / date courante | ❌ Aucun écran (zéro usage de `useStoredListState` côté mobile) |
| Formulaires en cours de saisie | ❌ Aucun écran |
| Modals / BottomSheets restaurés | ❌ Aucun |
| Patterns desktop déjà disponibles | `useStoredListState`, `useSearchParamState`, `useUnsavedChangesGuard` |
| Gravité globale | 🟠 **HIGH** — frustration utilisateur garantie sur tablette / smartphone en cas de F5 accidentel, switch d'onglet OS, ou redémarrage du navigateur. |

**Conclusion** : la fondation routing est saine (PR Sprint C). Il manque une **deuxième couche** de persistance par écran : sous-vue + filtres + sélection. Le hook `useStoredListState` (présent dans le repo, utilisé par `AffairesPanel` / `AnnuairePanel` desktop) doit être propagé aux 14 écrans mobiles qui en ont besoin.

---

## 1. Recensement — Architecture et inventaire

### 1.1 Localisation

| Élément | Fichier |
|---|---|
| Shell mobile | [apps/web/src/components/mobile/MobileApp.jsx](../../../apps/web/src/components/mobile/MobileApp.jsx) (621 LOC) |
| Routeur hash custom | [apps/web/src/hooks/useMobileRouter.js](../../../apps/web/src/hooks/useMobileRouter.js) (98 LOC) |
| Source unique routes | [apps/web/src/router/routes.config.js](../../../apps/web/src/router/routes.config.js) |
| Source de vérité doc | [docs/01-Architecture/NAVIGATION.md](../../01-Architecture/NAVIGATION.md) |
| Hook de persistance générique | [apps/web/src/hooks/useStoredListState.js](../../../apps/web/src/hooks/useStoredListState.js) ✅ existe |
| Hook URL search params (desktop) | [apps/web/src/router/RouterCompat.jsx](../../../apps/web/src/router/RouterCompat.jsx) — `useSearchParamState` |
| Garde formulaire non sauvegardé | [apps/web/src/hooks/useUnsavedChangesGuard.js](../../../apps/web/src/hooks/useUnsavedChangesGuard.js) ✅ existe |
| Bus refresh cross-module | [apps/web/src/utils/refresh-bus.js](../../../apps/web/src/utils/refresh-bus.js) ✅ existe |

### 1.2 Inventaire des écrans (19)

Source : `MOBILE_ROUTES` dans [routes.config.js](../../../apps/web/src/router/routes.config.js).

| Écran | Hash | Fichier | TAB_SCREENS | BACK_TARGET |
|---|---|---|:---:|---|
| home | `#/mobile` | `MobileHome.jsx` | ✅ | — |
| parc-dashboard | `/mobile/parc` | `MobileParcDashboard.jsx` | ✅ | home |
| planning | `/mobile/planning` | `MobilePlanning.jsx` | ✅ | parc-dashboard |
| reservations | `/mobile/reservations` | `MobileReservations.jsx` | ❌ | parc-dashboard |
| maintenances | `/mobile/maintenances` | `MobileMaintenances.jsx` | ❌ | parc-dashboard |
| availability | `/mobile/availability` | `MobileAvailability.jsx` | ❌ | parc-dashboard |
| affaires | `/mobile/affaires` | `MobileAffaires.jsx` | ❌ | home |
| tasks | `/mobile/tasks` | `MobileTasks.jsx` | ❌ | home |
| personnel | `/mobile/personnel` | `MobilePersonnel.jsx` | ❌ | home |
| messaging | `/mobile/messaging` | `MobileMessaging.jsx` | ❌ | home |
| equipment | `/mobile/equipment` | `MobileEquipment.jsx` (wrapper) | ❌ | home |
| sav | `/mobile/sav` | `MobileEquipment.jsx` (wrapper, `initialTab='sav'`) | ❌ | home |
| equipment-qr | `/mobile/equipment-qr` | `MobileEquipmentQR.jsx` | ❌ | equipment |
| orders | `/mobile/orders` | `MobileOrders.jsx` (wrapper) | ✅ | home |
| leaves | `/mobile/leaves` | `MobileLeaves.jsx` | ❌ | home |
| inventory | `/mobile/inventory` | `MobileInventory.jsx` (wrapper) | ❌ | home |
| location | `/mobile/location` | `MobileLocation.jsx` | ❌ | home |
| sonos | `/mobile/sonos` | `MobileSonos.jsx` | ❌ | home |
| suivi | `/mobile/suivi` | `MobileSuivi.jsx` | ✅ | home |
| dashboard-admin | `/mobile/dashboard-admin` | `MobileDashboardAdmin.jsx` | ❌ | home |

### 1.3 Pattern QR (figé, ne PAS modifier)

```
#/mobile/equipment/EMAG-XXXXX   → écran qr-landing puis equipment-qr
```
Regex `MOBILE_QR_PATTERN` — étiquettes physiques imprimées, immuable.

---

## 2. Mécanismes de persistance existants

### 2.1 Vue d'ensemble

| Couche | Mécanisme | État |
|---|---|---|
| **URL hash** | `#/mobile/<screen>` géré par `useMobileRouter` | ✅ Robuste — bookmark + back navigateur OK |
| **localStorage `mobileActiveTab`** | Dernier onglet « principal » visité (5 écrans) | ⚠️ Restauré uniquement si hash vide au boot |
| **sessionStorage `forceDesktop`** | Override mode tablette → desktop | ✅ Mais non documenté côté UX |
| **IndexedDB** (`STORES.*`) | Cache offline des entités métier via `useAppData` (desktop) | ⚠️ Désactivé sur mobile : `MobileApp` n'utilise PAS `useAppData`, il refait `api.getVehicles()` à chaque mount |
| **useStoredListState** | Filtres / tri / pagination dans sessionStorage | ❌ **0 usage côté mobile** (utilisé par 2 panels desktop) |
| **useSearchParamState** | Sous-onglet / vue calendrier via search params | ❌ Inapplicable au mobile (hash router pur, pas de query string) |
| **Service Worker / PWA** | Désactivé via `public/sw-cleanup.js` | 🔒 Décision opérationnelle — ne pas réactiver sans audit dédié |

### 2.2 Cycle de vie au boot mobile (refresh F5)

```
1. index.html charge App.jsx
2. detectMobile() → vrai si hash commence par #/mobile ou si pointer coarse + écran ≤ 768px
3. MobileApp se monte
4. useMobileRouter parse window.location.hash :
   • Hash QR ?      → screen='qr-landing', qrUid=EMAG-XXXX
   • Hash mobile ?  → REVERSE_ROUTES[path] || 'home'
   • Hash vide ?    → restaure localStorage.mobileActiveTab si ∈ TAB_SCREENS
5. checkAuth() (api.isAuthenticated)
6. Si auth ok : loadCoreParcData() → vehicles/reservations/maintenances (toujours, même pour modules non-parc)
7. Écran lazy-loadé monté → useEffect interne → loadData()
8. Tous les useState locaux de l'écran reviennent à leur valeur initiale → ❌ perte de contexte
```

### 2.3 Données IndexedDB côté mobile

`MobileApp.loadCoreParcData()` ne lit jamais IndexedDB → pas de mode offline. Acceptable pour MVP, mais à noter dans la roadmap (cf. §6 Roadmap).

---

## 3. Détection des problèmes par module

Légende :
- 🔴 = perte de workflow critique (formulaire / sélection / modal)
- 🟠 = perte de confort (filtre, vue, position dans la liste)
- 🟡 = perte mineure (préférence d'affichage)

### 3.1 MobileApp (shell)

| État local | Valeur init | Persistance | Sévérité |
|---|---|---|---|
| `showUserMenu` | `false` | ❌ — BottomSheet user fermé au refresh | 🟡 |
| `qrEquipmentUid` | `null` | ⚠️ Récupéré via `routerQrUid` (hash) — OK | — |
| `vehicles/reservations/maintenances` | `[]` | ⚠️ Refetch systématique (pas de cache mémoire) | 🟡 |
| `msgToast` | `null` | ❌ Toast disparaît | 🟢 acceptable |

### 3.2 MobileLogin

| État local | Persistance | Sévérité |
|---|---|---|
| `mode` ('login'/'register') | ❌ | 🟡 |
| `email` (champ saisi) | ❌ | 🟠 (UX irritant) |
| `showAccessRequest` (Modal) | ❌ | 🟠 |
| `showResetPassword` + champs reset | ❌ | 🟠 — un utilisateur en cours de reset perd tout |

### 3.3 MobileHome

Aucun état persistant nécessaire (grille statique).

### 3.4 MobilePlanning

| État local | Persistance | Sévérité |
|---|---|---|
| `selectedMonth` (mois affiché) | ❌ | 🟠 — retour à mois courant à chaque refresh |
| Position scroll Gantt | ❌ | 🟡 |

### 3.5 MobileAvailability

| État local | Persistance | Sévérité |
|---|---|---|
| Plage de dates affichée | ❌ | 🟠 |

### 3.6 MobileReservations

| État local | Persistance | Sévérité |
|---|---|---|
| `showForm` (formulaire ouvert) | ❌ | 🔴 **perte du formulaire en cours** |
| `openedDirectly` | ❌ | 🟡 |
| `showVehiclePicker` (BottomSheet) | ❌ | 🟠 |
| `formData` (vehicleId, dates, client, notes…) | ❌ | 🔴 **perte de saisie** |
| `error` | ❌ | 🟡 |

### 3.7 MobileMaintenances

Pattern similaire à `MobileReservations` (formulaire `ref.openForm()`). Risque identique → 🔴 sur `formData`.

### 3.8 MobileAffaires

| État local | Persistance | Sévérité |
|---|---|---|
| `selectedAffaire` (fiche ouverte) | ❌ | 🔴 — F5 ferme la fiche, retour à la liste |
| `detailData` (détails) | ❌ | 🟡 (refetch automatique) |
| `currentDate` (date filtre) | ❌ | 🟠 |
| `searchTerm` | ❌ | 🟠 |
| `filterType` (type d'affaire) | ❌ | 🟠 |
| ✅ `useAffairesList` (IDB cache + `refreshBus`) | — | (RAS) |

### 3.9 MobileTasks

| État local | Persistance | Sévérité |
|---|---|---|
| `collapsedSections` (Set) | ❌ | 🟡 |
| `showAllTasks` (admin) | ❌ | 🟠 |

### 3.10 MobilePersonnel

| État local | Persistance | Sévérité |
|---|---|---|
| `selectedPerson` (fiche détaillée) | ❌ | 🔴 |
| `viewMode` ('day'/'week') | ❌ | 🟠 |
| `currentDate` | ❌ | 🟠 |

### 3.11 MobileMessaging

| État local | Persistance | Sévérité |
|---|---|---|
| `activeConversation` (conversation ouverte) | ❌ | 🔴 — F5 dans une discussion → retour à la liste |
| `inputText` (brouillon de message) | ❌ | 🔴 **perte de saisie en cours** |
| `showNewConv` + `selectedUserId` | ❌ | 🟠 |

### 3.12 MobileEquipment / MobileSAV (wrappers)

| État | Persistance | Sévérité |
|---|---|---|
| `initialTab` ('inventory' / 'sav') | ✅ via deux routes distinctes `/mobile/equipment` et `/mobile/sav` | OK |
| États internes d'`EquipmentPanel` (filtres, sélection, recherche) | ❌ — composant desktop monté sans contexte mobile | 🟠 (hors scope mobile pur — à traiter dans audit desktop) |

### 3.13 MobileEquipmentQR

| État local | Persistance | Sévérité |
|---|---|---|
| `screen` ('menu'/'fiche'/'defaut'/'sav'/'intervention') | ❌ | 🔴 — l'utilisateur qui scanne un QR puis ouvre "Signaler un défaut" puis F5 retombe sur le menu et perd son brouillon |
| `defautForm` / `savForm` / `interventionForm` | ❌ | 🔴 **perte de saisie** |
| `submitSuccess` | ❌ | 🟢 |

### 3.14 MobileOrders (wrapper)

Voir MobileEquipment — délègue à `OrdersPanel`. États internes non traités.

### 3.15 MobileLeaves

| État local | Persistance | Sévérité |
|---|---|---|
| `view` ('list'/'form'/'detail'/'admin') | ❌ | 🔴 — F5 dans le formulaire ou la vue admin = retour à 'list' |
| `filter` ('all'/'pending'/...) | ❌ | 🟠 |
| `selectedLeave` (demande ouverte) | ❌ | 🔴 |
| ✅ `useRefreshSubscription('leaves')` | — | OK |

### 3.16 MobileInventory (wrapper)

Idem MobileEquipment.

### 3.17 MobileLocation

| État local | Persistance | Sévérité |
|---|---|---|
| Zone sélectionnée sur le plan SVG | ❌ | 🟠 |
| Zoom / pan SVG | ❌ | 🟡 |

### 3.18 MobileSonos

| État local | Persistance | Sévérité |
|---|---|---|
| Zone Sonos sélectionnée | ❌ | 🟠 |

### 3.19 MobileSuivi

À auditer en détail (lecture pas encore réalisée — pattern probablement similaire : sélection + filtres).

### 3.20 MobileDashboardAdmin

| État local | Persistance | Sévérité |
|---|---|---|
| Aucun état critique identifié (vue présente du jour, données refetched) | — | 🟢 |

### 3.21 Récap chiffré

| Module | États critiques perdus (🔴) | Sévérité globale |
|---|:---:|---|
| MobileReservations | 2 | 🔴 |
| MobileMaintenances | 2 | 🔴 |
| MobileEquipmentQR | 4 | 🔴 |
| MobileMessaging | 2 | 🔴 |
| MobileLeaves | 2 | 🔴 |
| MobileAffaires | 1 | 🔴 |
| MobilePersonnel | 1 | 🔴 |
| MobilePlanning | 0 | 🟠 |
| MobileAvailability | 0 | 🟠 |
| MobileLocation | 0 | 🟠 |
| MobileSonos | 0 | 🟠 |
| MobileTasks | 0 | 🟠 |
| MobileLogin | 0 | 🟠 |
| MobileHome | 0 | 🟢 |
| MobileDashboardAdmin | 0 | 🟢 |

**Total** : 14 pertes critiques de workflow réparties sur 7 écrans.

---

## 4. Architecture cible

### 4.1 Principes directeurs

1. **Hash router = source de vérité de l'écran** (déjà en place, ne pas casser).
2. **URL hash enrichi par des query params** pour les sélections « publiques » :
   - `#/mobile/affaires?sel=AF-2026-001` — fiche affaire ouverte
   - `#/mobile/leaves?view=admin` — sous-vue
   - `#/mobile/messaging?conv=42` — conversation active
   - `#/mobile/equipment-qr?step=defaut` (UID déjà dans le path)
   
   Avantage : bookmark partageable, back navigateur natif, restauration automatique.
3. **sessionStorage pour les filtres** via `useStoredListState` (déjà éprouvé desktop) :
   - `mobile:affaires:filters` `{ searchTerm, filterType, currentDate }`
   - `mobile:personnel:filters` `{ viewMode, currentDate }`
   - `mobile:leaves:filter`
   - `mobile:planning:selectedMonth`
   - `mobile:tasks:showAllTasks`
   - `mobile:tasks:collapsedSections`
4. **sessionStorage pour les brouillons de formulaire** (clé dédiée par écran) :
   - `mobile:reservations:draft`
   - `mobile:maintenances:draft`
   - `mobile:equipment-qr:<uid>:draft-defaut` / `draft-sav` / `draft-intervention`
   - `mobile:messaging:<convId>:input`
   
   Avantage : pas de fuite cross-utilisateur (sessionStorage = onglet), brouillon nettoyé au logout via `softReload('user-switch')`.
5. **localStorage uniquement pour les préférences durables** (déjà : `mobileActiveTab`, thème, palette).
6. **Bus `refreshBus`** déjà en place — ne pas dupliquer.

### 4.2 Helpers à ajouter

#### `useMobileHashParam(key, defaultValue, { allowed })`

Équivalent de `useSearchParamState` mais pour le hash mobile (`#/mobile/affaires?sel=...`). Le hash router custom doit être étendu pour parser la partie après `?` dans le hash.

#### `useDraftStorage(key, initialDraft, { ttlMs })`

Wrapper de `useStoredListState` avec :
- backend = `'session'`
- nettoyage automatique au submit ou à l'annulation
- TTL optionnel (24h par défaut) pour éviter les drafts fantômes

#### `useScreenContext(screen)` (optionnel, sprint 2)

Hook unifié qui agrège : URL hash params + sessionStorage filtres + drafts. À discuter — utile uniquement si on multiplie les écrans.

### 4.3 Évolution de `useMobileRouter`

Le hook actuel ne parse pas les query params du hash. À étendre :

```js
// Avant : navigate('affaires')         → #/mobile/affaires
// Après : navigate('affaires', { sel: 'AF-2026-001', q: 'truc' })
//                                     → #/mobile/affaires?sel=AF-2026-001&q=truc
```

API proposée :
- `navigate(screen, paramsObj?)`
- `setParams(paramsObj | updaterFn)` — mise à jour partielle (replaceState)
- `currentParams` (objet décodé)
- `goBack()` conserve le comportement existant + reset les params à `{}` au passage au parent

Compatible avec les QR codes (path-style `EMAG-XXX` non impacté).

### 4.4 Garde formulaire non sauvegardé

`useUnsavedChangesGuard(isDirty)` existe déjà côté desktop. Brancher sur :
- `MobileReservations` (formData rempli)
- `MobileMaintenances`
- `MobileEquipmentQR` (defautForm / savForm / interventionForm)
- `MobileMessaging` (inputText non vide)
- `MobileLeaves` (LeaveForm)

Effet : confirmation native du navigateur sur F5 / fermeture / navigation externe.

---

## 5. Plan de patches (corrections proposées)

> Détaillé dans le document compagnon [PLAN-CORRECTION-MOBILE-PERSISTENCE-2026-05-20.md](PLAN-CORRECTION-MOBILE-PERSISTENCE-2026-05-20.md).

Découpage en lots réversibles, chacun livrable indépendamment, ordre suggéré :

| Lot | Périmètre | Effort | Risque |
|---|---|:---:|:---:|
| **L0** | Extension `useMobileRouter` (params hash) + tests | S | 🟢 |
| **L1** | Hook `useDraftStorage` + tests | XS | 🟢 |
| **L2** | `MobileReservations` / `MobileMaintenances` : draft + guard | M | 🟡 |
| **L3** | `MobileEquipmentQR` : screen + drafts persistés | M | 🟡 |
| **L4** | `MobileMessaging` : convId dans hash + draft input | M | 🟡 |
| **L5** | `MobileLeaves` : view + filter + selectedLeave dans hash | S | 🟢 |
| **L6** | `MobileAffaires` : sel + filtres dans hash + storage | S | 🟢 |
| **L7** | `MobilePersonnel` / `MobilePlanning` / `MobileTasks` : viewMode + date + collapsed | S | 🟢 |
| **L8** | Ajout `MOBILE_TAB_SCREENS` étendu (affaires, personnel, leaves, tasks, messaging) | XS | 🟢 |
| **L9** | Documentation `docs/01-Architecture/NAVIGATION.md` + tests E2E manuels | S | 🟢 |

**Aucun lot ne touche** : `apps/api/`, `apps/tv-client/`, le pattern QR, le PWA/SW, le routeur React Router desktop, `useAppData`.

---

## 6. Validation — Plan de tests

### 6.1 Checklist manuelle (par écran modifié)

Pour chaque écran touché, **un testeur** déroule :

1. Ouvrir l'écran, saisir / sélectionner / ouvrir un sous-état.
2. **F5** → état restauré à l'identique.
3. **Fermer l'onglet, rouvrir** → état restauré (selon le storage choisi : session = perdu volontairement, local = restauré).
4. **Back navigateur** → retour à l'écran parent **avec son propre état préservé**.
5. **Avant un changement d'utilisateur** (`softReload('user-switch')`) → drafts vidés (nettoyage explicite).
6. **Scan QR** d'un équipement → toujours fonctionnel (path-style intact).
7. **Mode privé navigateur** → fallback silencieux (pas d'erreur, retour à valeurs par défaut).

### 6.2 Tests automatisés à ajouter

| Fichier | Couverture |
|---|---|
| `apps/web/src/test/useMobileRouter.test.jsx` | Étendre : params hash, navigate avec params, setParams partiel, goBack reset params |
| `apps/web/src/test/useDraftStorage.test.js` | Nouveau — clé, TTL, clear, mode privé |
| `apps/web/src/test/MobileReservations.persistence.test.jsx` | Render → saisie → unmount/remount → draft restauré |
| `apps/web/src/test/MobileMessaging.persistence.test.jsx` | Param `?conv=` → conversation rouverte, input restauré |
| `apps/web/src/test/MobileEquipmentQR.persistence.test.jsx` | `?step=defaut` + draft form |

Commande :
```bash
cd apps/web && npx vitest run src/test/useMobileRouter src/test/useDraftStorage src/test/Mobile*persistence
```

### 6.3 Tests d'intégration cross-écrans

Scénario complet :
```
1. Login mobile
2. Aller dans Affaires → ouvrir AF-2026-001 → filtrer par type
3. F5
   → toujours sur AF-2026-001 avec le bon filtre
4. Back → retour liste Affaires avec filtres préservés
5. Aller dans Réservations → ouvrir formulaire → saisir véhicule + dates
6. F5
   → formulaire toujours ouvert avec saisie préservée + warning beforeunload
7. Soumettre → draft nettoyé → toast OK
8. Changement d'utilisateur (softReload user-switch)
   → tous les drafts nettoyés (sessionStorage purgé)
9. Re-login autre user → écrans vierges (pas de fuite cross-user)
```

### 6.4 Non-régression

| Critère | Vérification |
|---|---|
| QR codes physiques | Scanner un QR `EMAG-12345` → `equipment-qr` chargé avec UID ✅ |
| Back navigateur | Sur chaque écran, bouton ‹ navigateur retourne au parent attendu |
| Hash bookmark | Coller `#/mobile/affaires?sel=AF-2026-001` dans la barre d'adresse → restauré |
| Mode desktop forcé | `sessionStorage.forceDesktop=true` → bascule desktop, pas de hash mobile résiduel parasite |
| Auth expirée | `softReload('auth-session-expired')` purge bien session storage des drafts |
| Tests existants | `npx vitest run` doit rester vert sur `useMobileRouter`, `useSearchParamState`, `modalManager` |

---

## 7. Décisions explicites (ne PAS faire)

- ❌ **PWA / Service Worker** : pas de réactivation. Décision opérationnelle (cf. `public/sw-cleanup.js`, `docs/01-Architecture/NAVIGATION.md`).
- ❌ **Migration React Router pour mobile** : casserait les QR codes physiques imprimés.
- ❌ **Redux / Zustand / Jotai** : aucun store global ne sera introduit (cf. AUDIT général §8.2 — choix architectural eM@g).
- ❌ **localStorage pour les brouillons de formulaire** : trop persistant, risque de fuite cross-utilisateur ; sessionStorage uniquement.
- ❌ **Modifications dans `apps/tv-client/`** : interdit par contrat.
- ❌ **Backend** : aucun endpoint à ajouter pour cet audit.

---

## 8. Métriques de succès post-implémentation

| Métrique | Cible |
|---|---|
| % d'écrans mobiles avec persistance complète (vue + filtre + sélection) | ≥ 90% (17/19) |
| Workflow critique (formulaire) avec draft + guard | 100% (5/5 : reservations, maintenances, equipment-qr ×3, messaging, leaves) |
| Test E2E manuel "F5 ne casse jamais un workflow" | ✅ vert sur 19 écrans |
| Régression QR code | 0 |
| Régression tests vitest existants | 0 |

---

## 9. Annexes

### 9.1 Fichiers existants à NE PAS modifier sans justification

- `apps/web/src/hooks/useMobileRouter.js` lignes 32-55 — bloc de bootstrap localStorage : déjà testé, à étendre sans réécrire.
- `apps/web/src/router/routes.config.js` lignes 137-141 — `MOBILE_QR_PATTERN` : ÉTIQUETTES PHYSIQUES.
- `public/sw-cleanup.js` : décision opérationnelle.

### 9.2 Références internes

- [docs/01-Architecture/NAVIGATION.md](../../01-Architecture/NAVIGATION.md)
- [docs/03-Guides/navigation-patterns.md](../../03-Guides/navigation-patterns.md)
- [docs/04-Operations/AUDIT-REFETCH-INVALIDATION-2026-05-18.md](../AUDIT-REFETCH-INVALIDATION-2026-05-18.md)
- [docs/04-Operations/AUDIT-UPDATES-MODALS-2026-05-18.md](../AUDIT-UPDATES-MODALS-2026-05-18.md)
- [docs/02-Securite/AUDIT.md](../../02-Securite/AUDIT.md) §11 (UX mobile)

### 9.3 Glossaire

| Terme | Définition |
|---|---|
| **Écran** | Vue plein écran mobile mappée à un hash (`#/mobile/<screen>`) |
| **Sous-vue** | Sous-état d'un écran (ex: `view='form'` dans MobileLeaves) |
| **Draft** | Brouillon de saisie de formulaire, persisté en sessionStorage |
| **Workflow critique** | Action utilisateur en plusieurs étapes avec saisie (perte = frustration majeure) |
| **TAB_SCREENS** | Set des écrans dont la visite est mémorisée en localStorage pour restauration au boot |

---

*Rapport généré par audit automatique le 2026-05-20. Lecture seule — aucune modification de code n'a été effectuée. Les patches sont détaillés dans le document compagnon `PLAN-CORRECTION-MOBILE-PERSISTENCE-2026-05-20.md`.*
