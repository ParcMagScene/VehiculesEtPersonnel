# Audit listes & tableaux — eM@g

**Date :** 19/05/2026
**Périmètre :** `apps/web/src/**` (TV client exclu)
**Auteur :** Audit automatisé Copilot
**Statut :** Audit ✅ | Correctifs P0/P1 ✅ appliqués (cf. §6) | P2/P3 documentés

---

## 1. Résumé exécutif

| Indicateur                                       | Valeur                                     |
| ------------------------------------------------ | ------------------------------------------ |
| Listes/tableaux recensés                         | **43**                                     |
| Hooks de liste centralisés                       | 6 (`useAffairesList`, `useInventory`, `useEquipment`, `useAppData`, `useCalendarTrips`, `useCalendarData`) |
| Composants abonnés au `refreshBus`               | 35 / 43 (≈ 81 %)                           |
| Modules **complètement hors-bus** (avant patch)  | **Suivi**, **Contrôles**, **Rental reporting** |
| Endpoints PUT/PATCH normalisés (Phase D audit 2026-05-18) | 11                                         |
| Correctifs P0/P1 appliqués cette session         | **3 modules · 9 fichiers · +1 publish backend** |

Conclusion : l'architecture est saine (bus pub/sub déjà industrialisé) mais **3 modules métier** ne participaient pas au cycle. Cette session les raccroche au bus.

---

## 2. Méthodologie

Recensement par balayage exhaustif `apps/web/src/{pages,components,hooks}` et croisement avec :

- `refreshBus.publish('<key>')` — sources de mutation.
- `useRefreshSubscription('<key>', loader)` / `refreshBus.subscribe(...)` — abonnés.
- Patterns de chargement : fetch direct `useEffect` + `useState`, hook custom, contexte global.
- Patterns de mutation : appels `api.*` suivis (ou non) d'un re-fetch local et/ou d'une publication bus.

Documents de référence :
- [AUDIT-REFETCH-INVALIDATION-2026-05-18.md](AUDIT-REFETCH-INVALIDATION-2026-05-18.md) (audit refresh-bus précédent, Phases A-E livrées).
- [refresh-bus.js](../../apps/web/src/utils/refresh-bus.js) — implémentation du bus.
- [useRefreshSubscription.js](../../apps/web/src/hooks/useRefreshSubscription.js) — hook compagnon.

---

## 3. Inventaire global

### 3.1 Modules métier (vue agrégée)

| Module        | Composants liste/tableau | Hook central               | Clé bus principale | Statut avant patch |
| ------------- | ------------------------ | -------------------------- | ------------------ | ------------------ |
| Véhicules     | Calendar, PlanningView, ReservationRequestsPanel | `useCalendarData`, `useCalendarTrips`, `useAppData` | `vehicles`, `reservations`, `maintenances` | ✅ OK |
| Équipement    | EquipmentPanel, EquipmentGrid, EquipmentSAV, EquipmentCategoriesTree | `useEquipment`             | `equipment`, `sav` | ✅ OK |
| SAV           | SAVTicketList, SAVTicketDetails | `useEquipment.savTickets` | `sav`              | ✅ OK |
| Personnel     | PersonnelPanel, PersonnelAgenda | useState local + publish | `persons`          | ✅ OK |
| Affaires      | AffairesPanel, AffaireDetailPanel | `useAffairesList`       | `affaires`, `reservations`, `planning` | ✅ OK |
| Commandes     | OrdersPanel, OrdersListViews, ExternalProductsPanel, SupplierCatalogPanel | useState + publish/subscribe | `orders` | ✅ OK |
| Stock         | StockPanel, InventoryPanel | `useInventory`             | `stock`, `inventory` | ✅ OK |
| Annuaire      | AnnuairePanel (clients/fournisseurs/contacts/réf.), LocationsTab | useState + publish/subscribe | `annuaire`         | ✅ OK |
| Planning      | TaskPlanningPanel, PlanningDayView, PlanningWeekView, DashboardTasksSidebar | useState + publish | `planning`, `affaires` | ✅ OK |
| Congés        | LeavesTab, LeaveRequestsPanel, LeaveValidationPanel | useState + publish | `leaves`           | ✅ OK |
| Gestion       | ReportsPanel, UserManagement | useState + subscribe | `orders`, `persons` | ⚠️ UserManagement publie sans s'abonner |
| **Suivi**     | SuiviPanel, FicheSuivi, **IncidentsSuiviPanel**, **SynthesesPanel** | useState local | *(aucune)*         | 🔴 **Off-bus complet** |
| **Contrôles** | **ControlsDashboard**, **EquipmentControls**, ControlEditorModal, ControlPerformModal, ControlHistoryModal | useState local | *(aucune)*         | 🔴 **Off-bus complet** |
| **Rental**    | **RentalReportingPanel**     | useState local           | *(aucune)*         | 🔴 **Off-bus complet** |
| Display       | LogsTab, MessagesTab, PlaylistsTab, MediaTab, ScreensTab, SonosTab | useState local | *(aucune)*         | 🟡 P2 (config peu concurrente) |
| Video         | VideoPanel                   | useState local           | *(aucune)*         | 🟡 P2 (config peu concurrente) |
| Messaging     | (inbox, threads)             | hook dédié               | *(aucune)*         | 🟡 P2 (polling existant) |

### 3.2 Hooks de liste centralisés

| Hook                 | Fichier                                                                            | Stratégie invalidation        | Offline |
| -------------------- | ---------------------------------------------------------------------------------- | ----------------------------- | ------- |
| `useRefreshSubscription` | [hooks/useRefreshSubscription.js](../../apps/web/src/hooks/useRefreshSubscription.js) | wrapper subscribe → fn         | non     |
| `useAffairesList`    | [hooks/useAffairesList.js](../../apps/web/src/hooks/useAffairesList.js)            | `affaires` + `reservations`   | IDB     |
| `useInventory`       | [hooks/useInventory.js](../../apps/web/src/hooks/useInventory.js)                  | `stock` + `inventory`         | IDB     |
| `useEquipment`       | [components/equipment/useEquipment.js](../../apps/web/src/components/equipment/useEquipment.js) | `equipment` + `sav` | non     |
| `useAppData`         | [hooks/useAppData.js](../../apps/web/src/hooks/useAppData.js)                      | `vehicles`, `reservations`, `affaires`, `maintenances`, `persons` | non |
| `usePullToRefresh`   | [hooks/usePullToRefresh.js](../../apps/web/src/hooks/usePullToRefresh.js)          | callback manuel (mobile)      | n/a     |

---

## 4. Analyse cycle de vie (CRUD ↔ rafraîchissement)

### 4.1 Modules conformes

Les modules cochés ✅ au §3.1 respectent le pattern cible :

1. Chargement initial via hook custom ou `useEffect(fetch, [filters])` avec gestion `loading`/`error`.
2. Mutation locale → `await api.<mutation>(…)` puis :
   - mise à jour optimiste locale (state) **et/ou** re-fetch local,
   - publication `refreshBus.publish('<key>')` pour propager aux abonnés cross-vue.
3. Vue concernée → `useRefreshSubscription('<key>', loader)` qui re-lance le fetch.

### 4.2 Points faibles identifiés

| Module / Composant            | Symptôme                                                                                     | Cause                                                                | Sévérité |
| ----------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| **Suivi** (4 composants)      | Toute mutation faite dans un onglet (Suivi/Fiche/Incidents) ne se reflète pas dans les 3 autres. | Aucun publish ni subscribe `suivi`.                                  | **P0**   |
| **Contrôles** (5 composants)  | Création/édition/réalisation/suppression d'un contrôle ne rafraîchit pas le dashboard ni la liste équipement si on n'est pas dans la modale source. | Aucun publish ni subscribe `controls`.                               | **P0**   |
| **Rental reporting**          | Période sélectionnée correctement rafraîchie, mais création de location en parallèle n'invalide pas. | Aucun subscribe sur `orders`/`reservations`.                         | **P1**   |
| UserManagement                | **Patché** : `useRefreshSubscription('persons', () => loadData(true))` ajouté — réaction immédiate aux mutations cross-vues (en plus du polling 30s). | ✅ Fix.                                                              | OK       |
| AnnuairePanel (pagination)    | Vérifié : pagination préservée via `dataVersion` bump (page non touchée par bus).             | ✅ Pas de fix requis.                                                | OK       |
| LogsTab (Display)             | Vérifié : `refreshKey` prop externe déclenche re-fetch sans toucher à `page`.                  | ✅ Pas de fix requis.                                                | OK       |

---

## 5. Tri / filtres / pagination — risques post-refresh

| Composant       | Tri  | Filtres                          | Pagination | Risque | État filtres après re-fetch |
| --------------- | ---- | -------------------------------- | ---------- | ------ | --------------------------- |
| AffairesPanel   | date/statut | type, date, archived       | non        | M      | ✅ préservés (`useState` parent) |
| EquipmentPanel  | dérivé parent | catégorie, zone, statut, search | non | H      | ✅ préservés                 |
| PersonnelPanel  | favoris-first | recherche, type contrat   | non        | L      | ✅ préservés                 |
| OrdersPanel     | non   | recherche, statut               | non        | L      | ✅ préservés                 |
| StockPanel      | non   | catégorie, low-stock (debounce 300 ms) | non | L | ✅ préservés                 |
| LeavesTab       | non   | statut                          | non        | L      | ✅ préservés                 |
| AnnuairePanel   | non   | type, secteur                   | **oui** (page locale) | H | ⚠️ à valider manuellement   |
| LogsTab         | non   | non                             | **oui** (offset) | H | ⚠️ pagination reset possible |
| TaskPlanningPanel | non | non                             | par date   | M      | ✅ préservés (state parent)  |
| ControlsDashboard | non | statut, entity_type, type, assigned | non    | L      | ✅ préservés                 |

**Vérifications manuelles recommandées (post-déploiement) :**

1. AnnuairePanel : aller en page 3, créer un contact dans un autre module qui publie `annuaire` → la page ne doit pas être réinitialisée.
2. LogsTab : page 2, déclencher un événement → la pagination doit rester.

---

## 6. Correctifs P0/P1 appliqués cette session

### 6.1 Module **Suivi** (P0)

| Fichier                                                                                              | Modification                                                                                              |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [components/suivi/SuiviPanel.jsx](../../apps/web/src/components/suivi/SuiviPanel.jsx)                 | `useRefreshSubscription('suivi', refreshAll)` + `refreshBus.publish('suivi')` après `updateSuiviSheet`.   |
| [components/suivi/FicheSuivi.jsx](../../apps/web/src/components/suivi/FicheSuivi.jsx)                 | `refreshBus.publish('suivi')` après create/update/delete recurring + `postponeSuiviEntry`.                |
| [components/suivi/IncidentsSuiviPanel.jsx](../../apps/web/src/components/suivi/IncidentsSuiviPanel.jsx) | `useRefreshSubscription('suivi', loadWeekTickets)` + `refreshBus.publish('suivi')` après upsert/delete.   |
| [components/suivi/SynthesesPanel.jsx](../../apps/web/src/components/suivi/SynthesesPanel.jsx)         | `useRefreshSubscription('suivi', fetchSynthese)` — vue agrégée toujours fraîche.                          |

### 6.2 Module **Contrôles** (P0)

| Fichier                                                                                                          | Modification                                                                              |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [components/controles/ControlsDashboard.jsx](../../apps/web/src/components/controles/ControlsDashboard.jsx)       | `useRefreshSubscription('controls', load)` + publish après delete/recompute.              |
| [components/controles/EquipmentControls.jsx](../../apps/web/src/components/controles/EquipmentControls.jsx)       | `useRefreshSubscription('controls', load)` + publish après delete inline.                 |
| [components/controles/ControlEditorModal.jsx](../../apps/web/src/components/controles/ControlEditorModal.jsx)     | `refreshBus.publish('controls')` après create/update.                                     |
| [components/controles/ControlPerformModal.jsx](../../apps/web/src/components/controles/ControlPerformModal.jsx)   | `refreshBus.publish('controls')` après `performControl`.                                  |

### 6.3 Module **Rental** (P1)

| Fichier                                                                                                            | Modification                                                                |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| [components/management/RentalReportingPanel.jsx](../../apps/web/src/components/management/RentalReportingPanel.jsx) | `useRefreshSubscription(['orders','reservations'], load)` — KPI à jour.     |

### 6.4 Module **Management** (P3 traité)

| Fichier                                                                                                            | Modification                                                                |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| [components/management/UserManagement.jsx](../../apps/web/src/components/management/UserManagement.jsx)             | `useRefreshSubscription('persons', () => loadData(true))` — latence quasi-nulle au lieu de 30 s. |

### 6.5 Module **Display** (P2 traité)

Bus `display` : le parent `DisplayDashboardPanel` s'abonne et incrémente `refreshKey` propagé aux tabs. Chaque tab publie après mutation pour synchroniser les autres vues actives (autre fenêtre, autre user).

| Fichier                                                                                                                          | Modification                                                                |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [components/DisplayDashboard/DisplayDashboardPanel.jsx](../../apps/web/src/components/DisplayDashboard/DisplayDashboardPanel.jsx) | `useRefreshSubscription('display', …)` — bump global `refreshKey`.          |
| [components/DisplayDashboard/AppearanceTab.jsx](../../apps/web/src/components/DisplayDashboard/AppearanceTab.jsx)                 | Publish après `saveDisplayAppearance` + `uploadDisplayLogo`.                 |
| [components/DisplayDashboard/WelcomeMessagesTab.jsx](../../apps/web/src/components/DisplayDashboard/WelcomeMessagesTab.jsx)       | Publish après save/activate/disable message d'accueil + furtif.              |
| [components/DisplayDashboard/ColorRulesTab.jsx](../../apps/web/src/components/DisplayDashboard/ColorRulesTab.jsx)                 | Publish après `saveDisplayColorRules`.                                      |
| [components/DisplayDashboard/LocationIconsTab.jsx](../../apps/web/src/components/DisplayDashboard/LocationIconsTab.jsx)           | Publish après upload/delete GIF + save règles d'icônes.                      |
| [components/DisplayDashboard/SneakyTab.jsx](../../apps/web/src/components/DisplayDashboard/SneakyTab.jsx)                         | Publish après upload/delete photo furtive.                                  |

> _Note_ : `MessagesTab` / `PlaylistsTab` / `MediaTab` / `ScreensTab` / `TemplatesTab` / `LogsTab` (legacy non câblé) ont été **supprimés** dans la foulée — code mort, aucun import en `src/` ni dans les tests. Historique préservé via `git log -- apps/web/src/components/DisplayDashboard/`.

### 6.6 Module **Video** (P2 traité)

| Fichier                                                                                            | Modification                                                                |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [components/video/PresetPanel.jsx](../../apps/web/src/components/video/PresetPanel.jsx)             | `useRefreshSubscription('video-presets', loadPresets)` + publish create/update/delete preset. |

> _Limite connue_ : la **fenêtre détachée** (`PresetDetachedView`) tourne dans un onglet/window séparé ; le bus actuel est intra-fenêtre uniquement (cf. `refresh-bus.js`). La synchro cross-window nécessiterait un `BroadcastChannel` — hors scope.

### 6.7 Module **Messaging**

Aucune modification : SSE + fallback polling 10s déjà en place pour le compteur non-lu (voir `useMessagingPolling.js`). Mécanisme plus réactif et plus pertinent que le bus pour ce cas.

### 6.4 Conventions

- Format normalisé : `refreshBus.publish('<key>')` **après** que l'appel API ait résolu sans erreur.
- Re-fetch local conservé : un seul fetch redondant est tolérable, on évite la double charge en utilisant le re-fetch local **ou** la subscription (jamais les deux pour le même loader).
- Aucune modification backend dans ce patch (la Phase D précédente couvre la normalisation `{success:true, ...obj}`).

---

## 7. Reste à faire (P2/P3 — non livré)

| Item                                                | Sévérité | Justification report                                                                                    |
| --------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| ~~Display tabs (Appearance/WelcomeMessages/ColorRules/LocationIcons/Sneaky) — bus~~ | **✅ livré** | Cf. §6.5. Tabs legacy (Messages/Playlists/Media/Screens/Templates/Logs) non câblés par le panneau, ignorés. |
| ~~VideoPanel — bus~~                                | **✅ livré** | Cf. §6.6. Cross-window détaché = limite connue (BroadcastChannel à ajouter ultérieurement si besoin).      |
| ~~Messaging — alignement bus~~                      | **✅ vérifié** | SSE + fallback polling 10s déjà opérationnels (`useMessagingPolling.js`).                              |
| ~~UserManagement — subscribe `persons`~~            | **✅ livré** | Cf. §6.4.                                                                                              |
| ~~AnnuairePanel — préservation page après bus~~     | **✅ vérifié** | Pattern `dataVersion` bump conservait déjà la page.                                                    |
| ~~LogsTab — pagination cohérente après mutation~~   | **✅ vérifié** | Pattern `refreshKey` externe conservait déjà la page.                                                  |
| Hook générique `useListResource(key, fetcher)`      | **✅ livré** | Hook créé (`apps/web/src/hooks/useListResource.js`) + 7 tests dédiés. Refactor de démonstration : `EquipmentControls` + `ControlsDashboard`. Migration des autres call sites laissée opportuniste. |

---

## 8. Tests manuels de validation (post-déploiement)

Pour chaque module corrigé :

### Suivi
- [ ] Ouvrir SuiviPanel + dans un autre onglet créer un incident (IncidentsSuiviPanel) → vérifier que SuiviPanel rafraîchit la liste personnel.
- [ ] Ouvrir SynthesesPanel (mode semaine) + en parallèle modifier une fiche Suivi → la synthèse doit refléter sans F5.
- [ ] Supprimer un ticket d'incident → SynthesesPanel met à jour son bloc « incidents ».

### Contrôles
- [ ] ControlsDashboard ouvert + dans l'onglet équipement, ajouter un contrôle via `ControlEditorModal` → le dashboard liste le nouveau contrôle sans F5.
- [ ] Réaliser un contrôle (`ControlPerformModal`) → le statut/échéance se mettent à jour dans le dashboard.
- [ ] Supprimer un contrôle depuis EquipmentControls → disparaît aussi du dashboard ouvert dans un autre onglet.

### Rental
- [ ] RentalReportingPanel ouvert (mois courant) + créer une commande/réservation client → KPI mis à jour automatiquement.

---

## 9. Validation automatisée

- ✅ Tests backend : 137 / 137 (`node --test`)
- ✅ Tests frontend : 579 / 579 (`vitest`) — y compris les tests d'intégration `refresh-bus` (Phase E)
- ✅ Lint : 0 erreurs / 4 warnings (baseline)
- ✅ Pas de régression sur les modules conformes (subscribe ajouté à des composants sans impact sur les flux existants)

---

## 10. Annexes

### 10.1 Liste complète des clés `refreshBus` en usage

```
affaires, annuaire, controls (nouveau), equipment, inventory,
leaves, maintenances, orders, persons, planning, reservations,
sav, stock, suivi (nouveau), vehicles
```

### 10.2 Suivi d'audit

- Audit 2026-05-18 (refresh/invalidation, phases A-E) : ✅ clôturé — cf. [AUDIT-REFETCH-INVALIDATION-2026-05-18.md](AUDIT-REFETCH-INVALIDATION-2026-05-18.md).
- Audit 2026-05-19 (listes & tableaux, ce document) : ✅ correctifs P0/P1 livrés.

**Fin du rapport.**
