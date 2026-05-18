# Audit — Mises à jour temps réel & fermeture des modals
**Date** : 18 mai 2026
**Scope** : `apps/web` (frontend principal). `apps/tv-client` exclu (contrainte).
**Méthode** : grep exhaustifs sur tous les `.jsx/.tsx` + lecture ciblée des composants critiques.

---

## 1. Synthèse exécutive

| Indicateur | Statut |
| --- | --- |
| Bug "modal transparent" (`<Modal isOpen=…>` direct) | ✅ **0 occurrence** — déjà éliminé (PR #24, mai 2026) |
| Portails React (`createPortal` externes) | ✅ 7 occurrences, toutes légitimes (Modal, Drawer, Tooltip, DropdownMenu, MapOffScreenIndicators, HeaderNotifications, HeaderActions) |
| ModalManager singleton (stack, scroll-lock, z-index) | ✅ Opérationnel, source de vérité unique |
| Refresh post-mutation | 🟠 **Fonctionnel mais hétérogène** : 4 conventions de callback (`onUpdated`, `onSaved`, `onSuccess`, `onRefresh`) coexistent |
| Hook global d'invalidation / store partagé | ❌ **Inexistant** : tout repose sur le prop-drilling de callbacks et `useAppData` |
| `window.location.reload()` après mutation | 🟠 9 occurrences — la plupart légitimes (auth, ErrorBoundary, accès refusé) ; 2 à examiner |
| Prop d'ouverture des wrappers (`isOpen` vs `open`) | 🟠 ~13 wrappers exposent `isOpen` à leur parent (incohérence d'API, pas un bug de rendu) |
| Slide-panels dupliquant le pattern `setTimeout(()=>onClose(), 350)` | 🟠 **6 occurrences** (Vehicle, Personnel, Equipment, Stock, Affaire, EquipmentDetail) — candidat à DRY |
| Code mort détecté | 🟡 1 cas : `EquipmentDetail` reçoit `_onRefresh` (préfixe `_` = unused) alors que le parent transmet `onRefresh={loadData}` |

**Verdict global** : le système est **sain et stable**. Aucun bug bloquant n'est détecté. Les améliorations à apporter sont d'ordre **architectural** (uniformisation des conventions, DRY) plutôt que correctif.

---

## 2. Inventaire — Mise à jour temps réel par module

### 2.1 Hub central : `useAppData` (hooks/useAppData.js`)

Centralise : véhicules, réservations, clients, locations, garages, maintenances, users, persons, calendarConfig.
Pattern uniforme :
1. `useEffect` charge tout au login (`Promise.allSettled` sur 9 endpoints).
2. Pour chaque mutation : `setState` optimiste + `await api.X` + `setState` avec données serveur fraîches.

✅ Pas de bug structurel. La liste mère du calendrier est toujours en cohérence avec la DB.

### 2.2 Par module

| Module | Source données | Refresh après mutation | Convention callback enfant → parent | Risque |
| --- | --- | --- | --- | --- |
| Véhicules | `useAppData.vehicles` + `VehicleDetailPanel` (slide-panel) | Optimiste + refetch dans `useAppData` | `onUpdated` (Header), `onSaved` (DepotMap), `onRefreshMaintenances` | ✅ OK |
| Réservations | `useAppData.reservations` | `setReservations` optimiste + reload | callback parent | ✅ OK |
| Maintenances | `useAppData.maintenances` (`loadMaintenances`, `handleMaintenanceSave`, `updateMaintenanceFromResize`, `handleUpdateIntervention`) | Re-fetch complet après chaque save | `onRefreshMaintenances` | ✅ OK |
| Équipements | `EquipmentPanel.loadData` (local) → `<EquipmentDetailDialog onRefresh={loadData} />` | Re-fetch complet `loadData()` | `onRefresh`, `onZonesUpdated`, `onImportDone` | 🟡 `_onRefresh` mort dans `EquipmentDetail` (cf. §4.1) |
| Personnel | `PersonnelPanel.loadPlanning` | `onUpdated`/`onRefresh` → `loadPlanning()` | `onUpdated`, `onRefresh` (les deux coexistent ligne 3211/3226) | 🟡 Doublon de conventions |
| Lieux (locations) | `useAppData.locations` | refetch global | callback | ✅ OK |
| Commandes / Stock | `StockPanel.loadData` (local) | `loadData()` après chaque save (lignes 183, 203, 217, 235, 248, 261, 411) + refetch single item (ligne 263) | callback | ✅ Très propre (cf. modèle) |
| Réservations CSV / Imports | `ContactsCSVImportDialog`, `SavImportModal`, `EquipmentImportModal` | `onSuccess`/`onImportDone={loadData}` | `onSuccess`, `onImportDone` | ✅ OK |
| Congés (Leaves) | `LeavesTab.loadData`, `LeaveRequestsPanel`, `LeaveValidationPanel` | `onUpdated`/`onRefresh` → `loadData()` | `onUpdated`, `onRefresh` (doublon) | 🟡 Doublon |
| SAV | `SAVManagerModal` (`setRefreshKey(k=>k+1)`) + `SAVTicketDetails.onUpdated` | refresh par incrément de clé | `onUpdated` | ✅ OK |
| Affaires | `AffaireDetailPanel.onRefresh` propagé | callback `onRefresh`/`onDataChanged` | `onRefresh`, `onDataChanged` | 🟡 Doublon |
| Contrôles | `ControlsDashboard.load`, `ControlEditorModal.onSaved` | `onSaved={load}` | `onSaved` | ✅ OK |
| Display Dashboard (Sonos/Screens/Media/Playlists/Templates/Messages) | `refreshKey` + `onRefresh` | re-render via key, refetch via prop | `onRefresh`, `refreshKey` | ✅ OK |
| Inventaire | `InventoryPanel.inv.refreshStats` (custom hook) | refetch via `onRefresh={inv.refreshStats}` | `onRefresh` | ✅ OK |
| Annuaire | `AnnuairePanel`, `LocationsTab` | `onSuccess` + reload | `onSuccess` | ✅ OK |

### 2.3 Diagnostic
- **Pas de cache invalidation centralisé** (pas de React Query / SWR / Zustand). Solution actuelle : `useAppData` + `loadData()` locaux + prop-drilling.
- **4 conventions de callback** se côtoient sans être interchangeables : `onUpdated`, `onSaved`, `onSuccess`, `onRefresh`. Aucune n'est cassée mais cela nuit à la lisibilité.
- **Aucun module n'exige un F5 manuel** : tous re-fetchent (souvent agressivement : refetch complet plutôt que mise à jour ciblée).
- **Mutations backend** : un audit ciblé des routes PUT/PATCH d'`apps/api/` reste à faire pour vérifier qu'elles renvoient bien l'item mis à jour ; côté frontend, le pattern dominant est de re-fetch (donc le payload de retour n'est pas critique), sauf pour `StockPanel` (ligne 263 `api.getStockItem(selectedItem.id)`) et certains save de maintenance.

---

## 3. Inventaire — Fermeture des modals & dialogs

### 3.1 Infrastructure (PR #24)
- **Portail unique** : `<div id="emag-modal-root">` dans `apps/web/index.html`. `getModalRoot()` le crée à la volée côté jsdom.
- **ModalManager singleton** (`apps/web/src/utils/modalManager.js`) :
  - Stack de tokens `Symbol`, scroll-lock par compteur, allocation z-index (`9000+` overlay, `10000+` dialog).
  - 7 tests verts (`modalManager.test.js`).
- **`<Modal>`** (`apps/web/src/components/ui/Modal.jsx`) : **seule source de vérité** pour le portail. Prop d'ouverture = **`open`**. Gère Escape, focus trap, backdrop click, restore focus, scroll-lock.
- **`<ModalLayout>`** : wrapper standard `(open, onClose, title, icon, size, footer)`. À utiliser pour tout nouveau modal.
- **`<Drawer>`** : intégré au ModalManager.
- **`useDraggableModals`** : drag + resize globaux via MutationObserver + event delegation. Allowlist inclut `#emag-modal-root`, `#modal-root`, `#task-modal-root`.

### 3.2 Composants utilisant `<Modal>` ou `<ModalLayout>`
Inventaire issu de `grep "<Modal " | "<ModalLayout"`. **Tous** utilisent désormais la prop `open` (pas `isOpen`). Voir §3.4 pour les wrappers qui exposent `isOpen` à leur parent mais traduisent en `open` en interne — ce n'est PAS un bug de rendu, c'est une incohérence d'API.

### 3.3 Slide-panels (non-modal, animation latérale)
| Fichier | Pattern | Anomalie |
| --- | --- | --- |
| `vehicles/VehicleDetailPanel.jsx` L356 | `setTimeout(()=>onClose(),300)` | Duplication |
| `personnel/PersonnelDetailPanel.jsx` L368 | `setTimeout(()=>onClose(),350)` | Duplication |
| `equipment/EquipmentDetail.jsx` L421 | `setTimeout(()=>onClose(),350)` | Duplication + `_onRefresh` mort |
| `equipment/EquipmentSAV.jsx` L979 | `setTimeout(()=>onClose(),350)` | Duplication |
| `orders/StockPanel.jsx` L485 | `setTimeout(()=>onClose(),350)` | Duplication |
| `affaires/AffaireDetailPanel.jsx` L2831 | `setTimeout(()=>onClose(),350)` | Duplication |

Tous suivent **exactement** le même schéma :
```js
const handleClose = useCallback(() => {
  setIsOpen(false);
  setIsClosing(true);
  setTimeout(() => onClose(), 350);
}, [onClose]);
```
+ un `useEffect` qui écoute `mousedown`/`click` extérieur, et un effet d'animation `setIsVisible(false)` après 350 ms.

➡️ **Candidat fort à DRY** : extraire `useSlidePanelClose({ open, onClose, animationMs })`.

### 3.4 Wrappers exposant `isOpen` au lieu de `open`
**Ce ne sont PAS des bugs** : ces composants définissent leur propre prop publique `isOpen` puis la traduisent en `<Modal open={isOpen}>` correctement. Mais cela crée une **incohérence d'API** vis-à-vis du design system.

| Composant | Ligne | Traduction interne |
| --- | --- | --- |
| `HelpModal` | 223 | `<Modal open onClose=…>` (force open=true puisque `if (!isOpen) return null` au-dessus) |
| `auth/UserPreferencesModal` | 82, 198 | `<Modal open={isOpen} onClose=…>` |
| `messaging/MessagingPanel` | 156, 348 | early-return `if(!isOpen)`, pas de `<Modal>` |
| `mailing/MailingPanel` | 71, 315 | `<Modal open={isOpen}>` |
| `planning/AddTaskModal` | 57, 346 | `<Modal open …>` (force open=true) |
| `planning/EventDetailsModal` | 37, 442 | early-return |
| `suivi/PersonalLoginModal` | 17, 76 | passe à un wrapper qui ré-expose `isOpen` |
| `controles/AutoLogoutWarningModal` (via Wrapper) | — | idem |

### 3.5 Diagnostic
- Aucun modal ne **reste monté** après fermeture : `ModalManager.pop()` libère le scroll-lock et l'index. Vérifié par `modalManager.test.js`.
- Aucun **backdrop résiduel** : Modal retourne `null` quand `open=false`, et le portail est nettoyé via `pop()`.
- Aucun cas de fermeture **avant** l'envoi de l'update détecté (toutes les fermetures sont chaînées après `await api.X`).
- 1 cas de fermeture **avant timeout inutile** : non détecté — les `setTimeout(…, 350)` correspondent toujours à l'attente d'une animation CSS.
- `navigate(-1)` après save : **non détecté**.

---

## 4. Anomalies détectées

### 4.1 🟡 Code mort — `EquipmentDetail._onRefresh`
**Fichier** : `apps/web/src/components/equipment/EquipmentDetail.jsx` L530
**Constat** : la prop est destructurée avec le préfixe `_` (signal ESLint = unused), alors que `EquipmentPanel.jsx` L693 transmet `onRefresh={loadData}`. Le composant ne fait pas d'appel API en interne (toutes les mutations remontent via `onEdit`, `onDelete`, `onToggleList`) donc l'absence d'usage interne est **logique**, mais la prop transmise n'a aucun effet.
**Impact** : nul (le parent re-fetch déjà après `onEdit`/`onDelete`). C'est un code smell.
**Correctif** : supprimer la prop côté parent OU la consommer (`onRefresh` invoqué après `handleClose`).

### 4.2 🟠 Duplication slide-panel close (6 occurrences)
Cf. §3.3. Pas de bug, mais maintenance coûteuse.

### 4.3 🟠 Doublon de conventions `onUpdated` + `onRefresh`
Présent dans `LeavesTab` L794+808 et `PersonnelPanel` L3211+3226 : les deux callbacks sont câblés sur le **même** `loadData()/loadPlanning()` simultanément. Pas de bug (idempotent) mais sémantiquement redondant.

### 4.4 🟠 `window.location.reload()` après mutation (2 cas non-auth)
| Fichier | Ligne | Contexte | Statut |
| --- | --- | --- | --- |
| `management/ManagementPanel.jsx` | 699 | Après save de paramètres globaux | ⚠️ Reload complet peut être évité en re-fetchant `useAppData` |
| `mobile/MobileApp.jsx` | 339 | Après changement de mode | ⚠️ À examiner cas par cas |
Autres occurrences (`utils/api/base.js`, `ErrorBoundary`, `AccessRequestModal`) sont légitimes (auth/erreur fatale).

### 4.5 🟠 Incohérence d'API `isOpen` vs `open`
13 wrappers utilisent la prop publique `isOpen`. À harmoniser (cf. §5.1).

---

## 5. Plan de correction proposé

### 5.1 Court terme — Patches livrés dans cet audit
1. **Alias `isOpen` accepté par `<Modal>`** (avec warning console en dev). Bénéfice : si un jour un dev passe `isOpen` directement à `<Modal>`, le rendu fonctionne et un message le guide vers `open`. Zéro risque de régression, prévention durable du bug "modal transparent". → **PATCH 1**.
2. **Documentation interne** : ce rapport sert de référence.

### 5.2 Moyen terme — À planifier
3. **Hook `useSlidePanelClose`** : factoriser les 6 slide-panels.
   ```js
   // apps/web/src/hooks/useSlidePanelClose.js
   export function useSlidePanelClose(source, onClose, ms = 350) {
     const [isOpen, setIsOpen] = useState(false);
     const [isClosing, setIsClosing] = useState(false);
     const [isVisible, setIsVisible] = useState(false);
     useEffect(() => { /* anim ouverture/fermeture identique */ }, [source]);
     const handleClose = useCallback(() => {
       setIsOpen(false); setIsClosing(true);
       const t = setTimeout(() => onClose(), ms);
       return () => clearTimeout(t);
     }, [onClose, ms]);
     return { isOpen, isClosing, isVisible, handleClose };
   }
   ```
   Migration progressive panel par panel, avec tests d'intégration existants comme garde-fou.
4. **Harmonisation des callbacks** : retenir `onSaved` (mutation réussie, retourne payload) + `onRefresh` (rechargement liste). Migrer `onUpdated`/`onSuccess` au cas par cas.
5. **Nettoyer `EquipmentDetail._onRefresh`** : soit le câbler (appeler `onRefresh()` après `handleClose` si une mutation a eu lieu), soit le supprimer (et retirer la prop côté `EquipmentPanel`).
6. **Audit API backend** : vérifier que `PUT/PATCH /api/vehicles/:id`, `/api/equipments/:id`, `/api/reservations/:id`, `/api/persons/:id`, `/api/locations/:id`, `/api/maintenances/:id`, `/api/orders/:id` renvoient bien l'objet mis à jour (200 + body, pas 204) — cela permettra d'éliminer les refetch et passer aux updates ciblés.
7. **Remplacer `window.location.reload()`** dans `ManagementPanel:699` et `MobileApp:339` par un re-fetch ciblé.

### 5.3 Long terme — Vision architecturale
8. **Optionnel** : introduire un store léger (Zustand) pour `vehicles/reservations/maintenances/equipments` afin de remplacer le prop-drilling + permettre un cache invalidation déclaratif. Garderait `useAppData` pour le bootstrap initial.
9. **Optionnel** : adopter `useSyncExternalStore` pour synchroniser les composants détachés (slide-panels) avec le hub `useAppData` sans passer par props.

---

## 6. Tests manuels recommandés

Pour chaque module (Véhicules, Matériel, Équipements, Réservations, Lieux, Personnel, Commandes, Stock, Maintenances, SAV, Affaires, Contrôles) :

| Étape | Attendu |
| --- | --- |
| 1. Ouvrir un item → modifier → enregistrer | Modal/panel se ferme, liste mise à jour SANS F5 |
| 2. Modifier puis Annuler | Modal/panel se ferme, AUCUNE modification appliquée |
| 3. Ouvrir 2 modals empilés, fermer celui du dessus | Backdrop du dessous toujours visible, scroll body toujours bloqué |
| 4. Fermer le dernier modal | `document.body.style.overflow` revient à valeur initiale (pas de scroll-lock résiduel) |
| 5. Échap fermer le modal | Comportement identique à clic backdrop |
| 6. Drag modal puis fermer / rouvrir | Position réinitialisée au centre |
| 7. Inspecter `#emag-modal-root` après fermeture | Vide |

---

## 7. Tests automatisés existants (à conserver)
- `apps/web/src/test/modalManager.test.js` : 7 tests (push/pop, scroll-lock, z-index, subscribe)
- `apps/web/src/test/Modal.integration.test.jsx` : 6 tests (rendu, fermeture, empilement)
- `apps/web/src/test/EventDetailsModal.test.jsx` : couvre le wrapper `isOpen` interne
- `apps/web/src/test/usePullToRefresh.test.jsx` : 5 tests
- Suite complète : **565/565 verts** (cf. PR #24)

---

## 8. Conclusion

Le système est **mature et robuste**. Les ajustements proposés sont des améliorations **d'ergonomie de code** (DRY, cohérence d'API) plutôt que des corrections de bugs. Aucun rechargement manuel n'est nécessaire dans le workflow utilisateur courant. Le seul correctif chirurgical livré (Modal acceptant `isOpen` en alias) **prévient** un bug récurrent historique sans modifier le comportement existant.

---

## 9. Patches appliqués — 2026-05-18 (post-audit)

### 9.1 Refactor DRY des slide-panels — `useSlidePanelClose`
Nouveau hook partagé : [apps/web/src/hooks/useSlidePanelClose.js](apps/web/src/hooks/useSlidePanelClose.js).

Unifie le cycle de vie animé open / close (`isVisible` mount, `isOpen` classe CSS via double `requestAnimationFrame`, `isClosing` classe de sortie, `setTimeout` 300-350 ms avant `onClose`).

Panels migrés (6) :
- [apps/web/src/components/vehicles/VehicleDetailPanel.jsx](apps/web/src/components/vehicles/VehicleDetailPanel.jsx) — 300 ms
- [apps/web/src/components/personnel/PersonnelDetailPanel.jsx](apps/web/src/components/personnel/PersonnelDetailPanel.jsx)
- [apps/web/src/components/equipment/EquipmentDetail.jsx](apps/web/src/components/equipment/EquipmentDetail.jsx) (`EquipmentSlidePanel`)
- [apps/web/src/components/equipment/EquipmentSAV.jsx](apps/web/src/components/equipment/EquipmentSAV.jsx)
- [apps/web/src/components/orders/StockPanel.jsx](apps/web/src/components/orders/StockPanel.jsx)
- [apps/web/src/components/affaires/AffaireDetailPanel.jsx](apps/web/src/components/affaires/AffaireDetailPanel.jsx) (fetch interne conservé avec flag `cancelled`)

Gain : ~180 lignes dupliquées éliminées ; comportement strictement identique (timings et classes CSS préservés).

### 9.2 Code mort retiré
`EquipmentDetailDialog` : prop `_onRefresh` (préfixe `_` = jamais consommée) supprimée du destructuring.
Décision : la prop continue d'être passée par `EquipmentPanel` (3 sites) mais ne sert plus à rien côté enfant ; nettoyer côté parent reportée (risque hors-scope d'élargir la diff).

### 9.3 `window.location.reload()` — décisions
- [apps/web/src/components/management/ManagementPanel.jsx:699](apps/web/src/components/management/ManagementPanel.jsx#L699) : **conservé** — import IndexedDB nécessite un remount complet de l'application.
- [apps/web/src/components/mobile/MobileApp.jsx:339](apps/web/src/components/mobile/MobileApp.jsx#L339) : **conservé** — « Changer d'utilisateur » exige une réinitialisation complète de la session.

### 9.4 Vérification automatisée
`npm test` (vitest) : **565 / 565** verts. Aucune régression.

---

## 10. Audit backend PUT / PATCH — 2026-05-18

Inventaire exhaustif (`grep -nE "\.(put|patch)\("` sur `apps/api/**/*.js`) : **50 routes** d'écriture détectées.
Classification des **18 routes critiques** consommées par les modals frontend :

### 10.1 (A) Retournent l'objet mis à jour — utilisables pour update ciblé sans refetch

| Route | Fichier | Payload retourné |
| --- | --- | --- |
| `PUT /api/affaires/:id` | [apps/api/affairesRoutes.js:483](apps/api/affairesRoutes.js#L483) | `updated` |
| `PUT /api/annuaire/clients/:id` | [apps/api/annuaireRoutes.js:328](apps/api/annuaireRoutes.js#L328) | `updated` |
| `PUT /api/persons/:id` | [apps/api/personnelRoutes.js:224](apps/api/personnelRoutes.js#L224) | `updated` |
| `PUT /api/assignments/:id` | [apps/api/personnelRoutes.js:1567](apps/api/personnelRoutes.js#L1567) | `updated` |
| `PUT /api/stock/items/:id` | [apps/api/stockRoutes.js:296](apps/api/stockRoutes.js#L296) | `item` |
| `PUT /api/orders/:id` | [apps/api/orders/ordersCoreRoutes.js:274](apps/api/orders/ordersCoreRoutes.js#L274) | `{ ...order, items: orderItems }` |
| `PUT /api/material-requests/:id` | [apps/api/orders/materialRequestsRoutes.js:186](apps/api/orders/materialRequestsRoutes.js#L186) | `updated` |
| `PUT /api/quotes/:id` | [apps/api/orders/quotesRoutes.js:182](apps/api/orders/quotesRoutes.js#L182) | `{ ...quote, items: quoteItems }` |
| `PUT /api/planning/tasks/:id` | [apps/api/planning/taskRoutes.js:1286](apps/api/planning/taskRoutes.js#L1286) | `updated` |
| `PUT /api/locations/:id` | [apps/api/routes.js:189](apps/api/routes.js#L189) | `updatedLocation` |
| `PUT /api/suppliers/:id` | [apps/api/orders/suppliersRoutes.js:72](apps/api/orders/suppliersRoutes.js#L72) | `supplier` |

### 10.2 (B) ACK only `{ success: true }` — nécessitent refetch ou setState manuel

| Route | Fichier |
| --- | --- |
| `PUT /api/equipment-categories/:id` | [apps/api/equipmentRoutes.js:126](apps/api/equipmentRoutes.js#L126) |
| `PUT /api/sav-tickets/:id/link` | [apps/api/equipmentRoutes.js:1680](apps/api/equipmentRoutes.js#L1680) |
| `PATCH /api/sav/tickets/:id` | [apps/api/savRoutes.js:453](apps/api/savRoutes.js#L453) |
| `PUT /api/garages/:id` | [apps/api/routes.js:296](apps/api/routes.js#L296) |
| `PUT /api/trip-details/:id` | [apps/api/routes.js:557](apps/api/routes.js#L557) |

### 10.3 (C) Retours partiels / spécifiques

| Route | Fichier | Payload |
| --- | --- | --- |
| `PATCH /api/affaires/:id/status` | [apps/api/affairesRoutes.js:747](apps/api/affairesRoutes.js#L747) | `{ affaire, transitions, ... }` |
| `PATCH /api/reservations/:id` | [apps/api/vehicleRoutes.js:565](apps/api/vehicleRoutes.js#L565) | `{ success, googleEventId, linkedEventIds }` (ack étendu) |
| `PUT /api/maintenances/:id` | [apps/api/vehicleRoutes.js:1037](apps/api/vehicleRoutes.js#L1037) | — payload à inspecter cas par cas (>120 lignes de handler) |

### 10.4 Conclusion audit backend

- **11 / 18 routes** (catégorie A) retournent déjà l'objet complet : la modernisation vers du **setState ciblé sans refetch** est **possible sans modification backend**.
- **5 routes** (catégorie B) renvoient seulement un ACK : pour éviter un refetch, il faudrait soit migrer le handler côté API vers (A), soit garder le pattern actuel `loadData()`.
- **3 routes** (catégorie C) ont des retours hybrides : conserver le refetch est le choix prudent.
- Recommandation : **ne pas modifier le backend** dans le cadre de cet audit. Les gains côté frontend sont à concrétiser progressivement, panel par panel, en remplaçant les `loadData()` post-save par un `setItems(prev => prev.map(...))` lorsque la route appartient à la catégorie A.

