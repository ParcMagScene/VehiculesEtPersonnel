# 🔧 Plan de correction — Persistance GUI Mobile eM@g

> **Date** : 2026-05-20  
> **Document compagnon de** : [AUDIT-MOBILE-PERSISTENCE-2026-05-20.md](AUDIT-MOBILE-PERSISTENCE-2026-05-20.md)  
> **Statut** : 📋 Plan — à valider avant exécution  
> **Contraintes** :
> - ❌ Ne pas toucher `apps/tv-client/`
> - ❌ Ne pas casser le pattern QR `#/mobile/equipment/EMAG-XXXXX`
> - ❌ Ne pas introduire de store global (Redux/Zustand/Jotai)
> - ✅ Backend toujours démarrable, frontend toujours compilable
> - ✅ Chaque lot indépendamment livrable et réversible

---

## Vue d'ensemble des lots

| Lot | Titre | Fichiers | Tests | Risque |
|---|---|---|---|:---:|
| L0 | `useMobileRouter` — query params dans hash | 1 modif + 1 test | ✅ | 🟡 |
| L1 | `useDraftStorage` — wrapper sessionStorage | 1 nouveau + 1 test | ✅ | 🟢 |
| L2 | Drafts formulaires Réservations / Maintenances | 2 modifs | ✅ | 🟡 |
| L3 | Sous-écran + drafts EquipmentQR | 1 modif | ✅ | 🟡 |
| L4 | Conversation + brouillon Messaging | 1 modif | ✅ | 🟡 |
| L5 | view/filter/selection Leaves | 1 modif | ✅ | 🟢 |
| L6 | Sélection + filtres Affaires | 1 modif | ✅ | 🟢 |
| L7 | Préférences Personnel / Planning / Tasks | 3 modifs | partiel | 🟢 |
| L8 | Élargir `MOBILE_TAB_SCREENS` | 1 modif | ✅ | 🟢 |
| L9 | Doc + tests E2E manuels | 1 modif | manuel | 🟢 |

---

## L0 — Étendre `useMobileRouter` avec query params

### Objectif
Permettre `navigate('affaires', { sel: 'AF-2026-001' })` → `#/mobile/affaires?sel=AF-2026-001`. Conserver 100 % de la compatibilité existante (signature 1-arg).

### Fichiers
- ✏️ `apps/web/src/hooks/useMobileRouter.js`
- ➕ `apps/web/src/test/useMobileRouter.params.test.jsx`

### Patch (esquisse)

```js
// apps/web/src/hooks/useMobileRouter.js
//
// Ajout :
// - parseHash(hash) → { path, params }
// - buildHash(screen, params) → "#/mobile/<screen>?k=v"
// - navigate(screen, params?) : signature étendue, params optionnel (rétrocompat)
// - setParams(updater) : merge partiel + history.replaceState
// - currentParams : objet { [key]: string }
//
// Règles :
// - Pattern QR (path EMAG-XXX) prioritaire — params ignorés si match QR
// - Valeurs string uniquement (sérialisation décidée côté appelant)
// - Suppression d'une clé : setParams({ key: null })
```

### Tests à ajouter (vitest)
- `navigate('affaires')` → hash sans `?`
- `navigate('affaires', { sel: 'AF-1' })` → `#/mobile/affaires?sel=AF-1`
- `setParams({ q: 'truc' })` → fusion avec params existants, `replaceState` (pas de pushState)
- `setParams({ sel: null })` → clé supprimée
- `goBack()` depuis `affaires?sel=AF-1` → retour `home` avec params vides
- Hash QR `#/mobile/equipment/EMAG-12345?foo=bar` → params **ignorés**, comportement QR intact

### Critères d'acceptation
- `npx vitest run useMobileRouter` reste vert sur les tests existants.
- Nouveau fichier `.params.test.jsx` ≥ 6 cas passe.
- `MobileApp` continue de fonctionner sans modification (signature 1-arg toujours valable).

---

## L1 — Hook `useDraftStorage`

### Objectif
Wrapper de `useStoredListState` dédié aux brouillons de formulaire, avec API explicite (`clear`, `commit`).

### Fichier
- ➕ `apps/web/src/hooks/useDraftStorage.js`
- ➕ `apps/web/src/test/useDraftStorage.test.js`

### API

```js
const [draft, setDraft, { clear, commit }] = useDraftStorage(
  'mobile:reservations:draft',
  { vehicleId: null, startDate: '', endDate: '', notes: '' },
  { ttlMs: 24 * 60 * 60 * 1000 } // optionnel, défaut 24h
);
```

- `clear()` : supprime la clé sessionStorage et reset à `initialDraft`
- `commit()` : alias sémantique de `clear` (à appeler après submit OK)
- TTL : si timestamp stocké > ttlMs, retour à initialDraft (évite drafts fantômes)

### Notes d'implémentation
- Stockage : `{ value: T, savedAt: number }`
- Réutilise `useStoredListState` en interne (pas de duplication)
- Mode privé → fallback silencieux (déjà géré par `useStoredListState`)

---

## L2 — Drafts Réservations & Maintenances

### Fichiers
- ✏️ `apps/web/src/components/mobile/MobileReservations.jsx`
- ✏️ `apps/web/src/components/mobile/MobileMaintenances.jsx`

### Modifications

#### MobileReservations.jsx

1. Remplacer `useState({...})` initial du `formData` par :
   ```js
   const [formData, setFormData, draftCtl] = useDraftStorage(
     'mobile:reservations:draft',
     { vehicleId: null, startDate: '', endDate: '', client: '', notes: '' }
   );
   ```
2. Persister `showForm` :
   ```js
   const [showForm, setShowForm] = useStoredListState(
     'mobile:reservations:showForm', false
   );
   ```
3. Brancher `useUnsavedChangesGuard(showForm && hasDirtyDraft(formData))`.
4. Sur submit OK : `draftCtl.commit()` + `setShowForm(false)`.
5. Sur annulation explicite : confirmation puis `draftCtl.clear()`.

#### MobileMaintenances.jsx
Mêmes étapes avec clés `mobile:maintenances:draft` et `mobile:maintenances:showForm`.

### Tests
- `MobileReservations.persistence.test.jsx` :
  - Saisir véhicule + date → unmount → remount → champs restaurés
  - Submit OK → sessionStorage vide
  - F5 simulé → `showForm=true` restauré

---

## L3 — MobileEquipmentQR

### Fichier
- ✏️ `apps/web/src/components/mobile/MobileEquipmentQR.jsx`

### Modifications

1. `screen` ('menu'/'fiche'/'defaut'/'sav'/'intervention') → query param hash :
   ```js
   const { currentParams, setParams } = useMobileRouter();
   const screen = currentParams.step || 'menu';
   const setScreen = (next) => setParams({ step: next === 'menu' ? null : next });
   ```
2. Drafts par UID + section :
   ```js
   const [defautForm, setDefautForm, dCtl] = useDraftStorage(
     `mobile:equipment-qr:${uid}:draft-defaut`, initialDefaut
   );
   // idem savForm, interventionForm
   ```
3. Sur submit OK : `dCtl.commit()` puis `setScreen('menu')`.
4. `useUnsavedChangesGuard` actif si un draft est non vide.

### Tests
- URL `#/mobile/equipment/EMAG-123?step=defaut` → écran défaut chargé direct.
- F5 dans formulaire défaut → saisie restaurée.

---

## L4 — MobileMessaging

### Fichier
- ✏️ `apps/web/src/components/mobile/MobileMessaging.jsx`

### Modifications

1. `activeConversation` → query param `?conv=<id>` :
   ```js
   const convId = currentParams.conv ? Number(currentParams.conv) : null;
   const activeConversation = useMemo(
     () => conversations.find(c => c.id === convId) || null,
     [conversations, convId]
   );
   const openConversation = (c) => setParams({ conv: String(c.id) });
   const closeConversation = () => setParams({ conv: null });
   ```
2. Brouillon input par conversation :
   ```js
   const draftKey = convId ? `mobile:messaging:${convId}:input` : null;
   const [inputText, setInputText, draftCtl] = useDraftStorage(
     draftKey || 'mobile:messaging:_inactive:input', ''
   );
   ```
3. Sur envoi OK : `draftCtl.commit()`.
4. `showNewConv` + `selectedUserId` → `useStoredListState('mobile:messaging:newConv', {...})`.

### Tests
- Ouvrir conv #42, taper "bonjour", F5 → conv #42 toujours ouverte, "bonjour" restauré.

---

## L5 — MobileLeaves

### Fichier
- ✏️ `apps/web/src/components/mobile/MobileLeaves.jsx`

### Modifications

```js
const { currentParams, setParams } = useMobileRouter();
const view = currentParams.view || 'list';
const setView = (v) => setParams({ view: v === 'list' ? null : v });

const selectedLeaveId = currentParams.sel ? Number(currentParams.sel) : null;
const selectedLeave = useMemo(
  () => leaves.find(l => l.id === selectedLeaveId) || null,
  [leaves, selectedLeaveId]
);
const openLeave = (l) => setParams({ sel: String(l.id), view: 'detail' });

const [filter, setFilter] = useStoredListState('mobile:leaves:filter', 'all');
```

### Tests
- `#/mobile/leaves?view=admin&filter=pending` → vue admin + filtre actif.
- Ouvrir une demande, F5 → fiche détail toujours ouverte.

---

## L6 — MobileAffaires

### Fichier
- ✏️ `apps/web/src/components/mobile/MobileAffaires.jsx`

### Modifications

```js
// Sélection dans le hash (deep link)
const selectedId = currentParams.sel || null;
const openAffaire = (a) => setParams({ sel: a.id });
const closeAffaire = () => setParams({ sel: null });

// Filtres en sessionStorage (pas d'URL → moins de bruit)
const [filters, setFilters] = useStoredListState('mobile:affaires:filters', {
  searchTerm: '',
  filterType: 'all',
  currentDate: today(),
});
```

Note : `currentDate` peut alternativement aller dans le hash si on veut partage de vue, à arbitrer avec produit.

### Tests
- `#/mobile/affaires?sel=AF-2026-001` → fiche chargée direct.
- Filtres restaurés après F5.

---

## L7 — Préférences Personnel / Planning / Tasks

### Fichiers
- ✏️ `apps/web/src/components/mobile/MobilePersonnel.jsx`
- ✏️ `apps/web/src/components/mobile/MobilePlanning.jsx`
- ✏️ `apps/web/src/components/mobile/MobileTasks.jsx`

### Modifications

#### Personnel
```js
const [prefs, setPrefs] = useStoredListState('mobile:personnel:prefs', {
  viewMode: 'day',
  currentDate: todayISO(),
});
const selectedId = currentParams.sel || null; // hash pour deep-link
```

#### Planning
```js
const [selectedMonth, setSelectedMonth] = useStoredListState(
  'mobile:planning:selectedMonth', currentMonthISO()
);
```

#### Tasks
```js
const [collapsedSections, setCollapsedSections] = useStoredListState(
  'mobile:tasks:collapsed', [] // tableau, pas Set (JSON-sérialisable)
);
const collapsedSet = useMemo(() => new Set(collapsedSections), [collapsedSections]);

const [showAllTasks, setShowAllTasks] = useStoredListState(
  'mobile:tasks:showAll', false
);
```

⚠️ **Set non sérialisable** : convertir en `Array` à la frontière du storage.

---

## L8 — Élargir `MOBILE_TAB_SCREENS`

### Fichier
- ✏️ `apps/web/src/router/routes.config.js`

### Modification

```js
export const MOBILE_TAB_SCREENS = new Set([
  'home',
  'planning',
  'parc-dashboard',
  'orders',
  'suivi',
  // Ajouts :
  'affaires',
  'personnel',
  'leaves',
  'tasks',
  'messaging',
]);
```

### Impact
Au boot avec hash vide, l'utilisateur retombe sur le dernier écran « principal » visité (y compris affaires, personnel, etc.).

⚠️ Vérifier que ces écrans gèrent bien un mount sans contexte de navigation préalable (pas de dépendance à `goBack` immédiat).

---

## L9 — Documentation & validation manuelle

### Fichiers
- ✏️ `docs/01-Architecture/NAVIGATION.md` (section « Persistance d'état mobile »)
- ➕ `docs/04-Operations/CHECKLIST-PERSISTANCE-MOBILE.md` (à créer après L0-L8 mergés)

### Checklist manuelle finale

Tableau 19 écrans × 7 scénarios (cf. AUDIT §6.1) à dérouler manuellement et archiver dans la PR finale.

---

## Ordre d'exécution recommandé

```
L1 (hook) ─┐
           ├─ L0 (router) ──┬─ L2 (réservations / maintenances)
           │                ├─ L3 (equipment-qr)
           │                ├─ L4 (messaging)
           │                ├─ L5 (leaves)
           │                ├─ L6 (affaires)
           │                └─ L7 (personnel / planning / tasks)
           │                       │
           │                       └─ L8 (tab screens élargis)
           │                              │
           │                              └─ L9 (doc + manuel)
```

L0 et L1 sont **indépendants**, peuvent être parallélisés.  
L2-L7 sont **indépendants entre eux** une fois L0 + L1 mergés.

---

## Critères Definition of Done (global)

- ✅ `npx vitest run` vert (apps/web)
- ✅ `npm run build` vert (frontend compile)
- ✅ `npm run lint` 0 erreur sur les fichiers modifiés
- ✅ `npm run dev:start` démarre sans crash
- ✅ Checklist manuelle 19×7 archivée dans la PR
- ✅ QR code physique scanné → écran equipment-qr OK
- ✅ Aucune modification dans `apps/tv-client/`
- ✅ Aucun nouveau endpoint API
- ✅ `CHANGELOG.md` mis à jour
- ✅ `docs/01-Architecture/NAVIGATION.md` mis à jour
- ✅ Test E2E manuel « F5 ne casse jamais un workflow » validé sur les 7 écrans 🔴

---

## Risques résiduels

| Risque | Mitigation |
|---|---|
| Fuite de draft entre 2 utilisateurs sur même appareil | sessionStorage = onglet uniquement + nettoyage explicite à `softReload('user-switch')` |
| Quota storage atteint sur appareil ancien | Try/catch silencieux (déjà dans `useStoredListState`) + TTL 24h pour drafts |
| URL trop longue (hash + params) | Pas de risque < 2KB en pratique ; surveiller `MobileEquipmentQR` (UID + step) |
| Hash params parasites partagés (privacy) | Pas de données sensibles dans le hash — uniquement IDs déjà visibles dans l'UI |
| Régression QR code | Tests dédiés + check manuel obligatoire en DoD |
| Tablette qui force desktop puis revient mobile | `sessionStorage.forceDesktop` orthogonal — non impacté |

---

*Plan de correction — à valider avant ouverture des PRs. Chaque lot ouvrira sa propre PR pour faciliter la revue.*
