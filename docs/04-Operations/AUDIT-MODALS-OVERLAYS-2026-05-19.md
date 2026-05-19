# Audit complet — Modals & Overlays eM@g (2026-05-19)

> Audit exhaustif et automatique du système d'affichage par couches (modals,
> drawers, popovers, bottom-sheets, dropdowns, tooltips) pour `apps/web/`.
>
> Périmètre exclu : `apps/tv-client/` (consigne).

## TL;DR

- **État global : conforme.** Le socle introduit par la PR #24 (ModalManager
  singleton + portail unique `#emag-modal-root` + `Modal` / `ModalLayout` /
  `Drawer`) est utilisé par ~95 % des modaux et drawers de l'app.
- **1 violation P1 corrigée** dans le cadre de cet audit : `BottomSheet`
  (mobile) gérait son propre `document.body.style.overflow` et avait une
  inversion potentielle backdrop/panel via `var(--z-modal, 2000)` /
  `var(--z-base)`. Migré vers le `ModalManager` (portail + push/pop + z-index
  inline cohérents avec la pile globale).
- **Popovers header (Notifications, UserMenu) conservés tels quels** : leur
  z-index volontairement situé entre `--z-overlay` (1000) et le seuil modal
  (9000) est documenté inline et constitue un overlay non bloquant attendu.
- **Aucun usage bugué `<Modal isOpen={…}>`** : la prop canonique `open` est
  utilisée partout. Le filet de sécurité `isOpen` → `open` (avec
  `console.warn` en dev) reste en place dans `Modal.jsx`.

---

## 1. Recensement global

### 1.1 Socle (ne pas modifier sans audit dédié)

| Fichier | Rôle |
| --- | --- |
| [apps/web/src/utils/modalManager.js](apps/web/src/utils/modalManager.js) | Singleton : pile de modaux, scroll-lock par compteur, allocation z-index, portail `#emag-modal-root`. |
| [apps/web/src/components/ui/Modal.jsx](apps/web/src/components/ui/Modal.jsx) | Wrapper bas-niveau (createPortal unique, focus trap, Escape, click backdrop). Prop canonique : `open`. |
| [apps/web/src/layouts/ModalLayout.jsx](apps/web/src/layouts/ModalLayout.jsx) | Wrapper haut-niveau standard (titre, icône, footer, taille). |
| [apps/web/src/components/ui/Drawer.jsx](apps/web/src/components/ui/Drawer.jsx) | Panneau latéral inscrit dans la même pile. |
| [apps/web/src/components/ui/BottomSheet.jsx](apps/web/src/components/ui/BottomSheet.jsx) | Sheet mobile — **migré ce jour** vers ModalManager. |

Hiérarchie z-index normalisée (constantes exportées) :

- `Z_BACKDROP_BASE = 9000`, `Z_DIALOG_BASE = 10000`, `Z_STEP = 10`.
- Couche `i` (0-based) → overlay `9000 + i*10`, dialog `10000 + i*10`.
- Tout est appliqué **inline** sur le DOM portalisé → invulnérable aux
  conflits CSS.

### 1.2 Couches conformes (panel pris en charge par ModalManager)

`ModalLayout` (haut-niveau) est utilisé par 30+ composants, parmi lesquels :

- Personnel : `PersonnelImportModal`, `PersonnelPanel`.
- Annuaire : `AnnuairePanel`, `MatchingEntitiesModal`,
  `MatchingContactEntitiesModal`, `MatchingLocationsModal`,
  `ContactsCSVImportDialog`.
- Planning : `TaskEditModal`, `EventDetailsModal`, `InterventionModal`,
  `OverdueInterventionModal`.
- Display : `MessageFormModal`, `MediaUploadModal`, `TemplateFormModal`,
  `PlaylistFormModal`, `ScreenFormModal`.
- Équipement : `EquipmentFormModal`, `EquipmentImportModal`,
  `LocmatImportModal`, `EquipmentPanel`.
- Commandes : `OrderFormModals`, `StockPanel` (4 layouts),
  `SupplierCatalogPanel`, `ExternalProductsPanel`.
- Véhicules : `GoogleEventFormModal`, `ReservationEquipment`,
  `ReservationRequestsPanel`.
- Auth : `ProfileEditModal`, `AccessRequestModal`.
- SAV : `SAVManagerModal`.
- Vidéo : `CameraSettingsModal`.
- Divers : `QRCodeModal`, `BLBatchAnalysis`, `MailingPanel`,
  `UserManagement`, `MobileMessaging`.

`Modal` (bas-niveau) — utilisations conformes (prop `open`, contenu confiné
au portail) :

- `AddTaskModal`, `EventTaskModal`, `PeriodCalendarModal`, `TaskPDFExportModal`
  (planning).
- `ControlPerformModal`, `ControlEditorModal`, `ControlHistoryModal`
  (contrôles).
- `BLImportModal`, `BLMultiImportModal`, `BLImportLocPrestaModal`,
  `GenerateOrdersModal`, `BPAnnotationViewer`, `AffaireImportModal`
  (affaires).
- `SupplierModals` (5 dialogues), `OrdersDialogs` (3 dialogues), `StockPanel`
  (gestion).
- `TripDetailsModal`, `VehicleDetailsModal`, `VehicleMaintenanceModal`,
  `MaintenanceDialog`, `MaintenanceReportModal`, `ReservationModal`,
  `LocationDialog`, `ClientDialog`, `DepotMapEditor` (véhicules).
- `MapDualPrintModal`, `LocationsMapPanel` (lieux).
- `IncidentsSuiviPanel` (suivi).
- `WeekSelector`, `MonthSelector`, `ManagementPanel`, `HelpModal`,
  `UserPreferencesModal`, `MailingPanel`.

`Drawer` (pile partagée) : composants `*SlidePanel` / `*DetailPanel`
internes — délégation au `ModalManager` via `push/pop` (sauf option explicite
`overlay={false}` qui rend le drawer non bloquant et reste hors pile).

### 1.3 Exceptions techniques légitimes

Composants utilisant `createPortal` sans passer par `Modal`, **par
construction** :

| Composant | Justification |
| --- | --- |
| [apps/web/src/components/ui/Tooltip.jsx](apps/web/src/components/ui/Tooltip.jsx) | Overlay non bloquant attaché au curseur. |
| [apps/web/src/components/ui/DropdownMenu.jsx](apps/web/src/components/ui/DropdownMenu.jsx) | Menu flottant position calculée. |
| [apps/web/src/components/locations/MapOffScreenIndicators.jsx](apps/web/src/components/locations/MapOffScreenIndicators.jsx) | Repères off-screen sur carte Leaflet. |
| [apps/web/src/components/header/HeaderNotifications.jsx](apps/web/src/components/header/HeaderNotifications.jsx#L802) | Popover header (z-index 8000/8001) — sous le seuil modal. |
| [apps/web/src/components/header/HeaderActions.jsx](apps/web/src/components/header/HeaderActions.jsx#L265) | Menu utilisateur header (z-index 8000/8001) — sous le seuil modal. |

Ces composants restent volontairement hors du `ModalManager` car ils ne sont
pas bloquants et n'introduisent pas de stacking concurrent avec les modaux
(z-index plafonnés à 8 999 < 9 000).

---

## 2. Analyse affichage

### 2.1 Portail global

- DOM : `<div id="emag-modal-root">` déclaré dans `apps/web/index.html`.
- Fallback création à la volée via `getModalRoot()` (utile pour jsdom + SSR).
- Anciens nœuds `#modal-root` / `#task-modal-root` conservés pour
  rétro-compatibilité (allowlist `useDraggableModals`).

### 2.2 Hiérarchie z-index recensée

| Zone | Constante / valeur | Source |
| --- | --- | --- |
| Base | `--z-base = 1` | [theme.css](apps/web/src/theme.css#L275) |
| Header sticky, panneaux non bloquants | `--z-overlay = 1000` | [theme.css](apps/web/src/theme.css#L278) |
| Tooltips applicatifs | `--z-tooltip = 9999` | theme.css |
| Popovers header (notifications, user menu) | 8000–8001 | [App.css](apps/web/src/App.css#L494), [Header.css](apps/web/src/components/Header.css#L5) |
| Skip-link a11y | 8500 | [App.css](apps/web/src/App.css#L1944) |
| Modals — backdrop | `9000 + i*10` | ModalManager |
| Modals — dialog | `10000 + i*10` | ModalManager |

Tokens `--z-modal`, `--z-modal-nested` historisés dans `theme.css` mais
documentés comme **réservés** : les modaux applicatifs passent par
`ModalManager` (priorité inline > CSS).

### 2.3 Backdrops

- `Modal` : `.ui-modal-overlay` (inline `style.zIndex`).
- `Drawer` : `.ui-drawer-backdrop` (inline `style.zIndex` quand
  `overlay=true`).
- `BottomSheet` : `.ui-bottomsheet-backdrop` (inline `style.zIndex` —
  désormais aligné).
- Popovers header : backdrop transparent dédié pour la fermeture clic
  extérieur.

### 2.4 Focus & scroll-lock

- Focus trap, Escape, restore-focus : gérés par `Modal`.
- Scroll-lock : `document.body.style.overflow = 'hidden'` posé par
  `modalManager.push` au premier modal, restauré par `pop` du dernier.
- Aucun composant applicatif ne touche `document.body.style.overflow` après
  la migration `BottomSheet` (vérifié `grep -RIn`).

### 2.5 Z-index inline et `position: fixed` audités

Les seules occurrences `style={{ zIndex: … }}` détectées hors socle :

- [renderReservationAffaires.jsx#L327](apps/web/src/components/vehicles/renderReservationAffaires.jsx#L327) — z=10, contexte calendrier interne (badges au-dessus des cases).
- [GoogleCalendarBanner.jsx#L1000](apps/web/src/components/vehicles/GoogleCalendarBanner.jsx#L1000) — z=200, bannière de status synchronisation.

Aucun ne concerne la couche modale → pas d'interférence.

---

## 3. Cycle de vie

### 3.1 Ouverture

| Acteur | Mécanisme |
| --- | --- |
| `Modal` | `useEffect(open)` → `push()` + `setStackToken`. Auto-focus du premier focusable. |
| `Drawer` | Idem + animation `requestAnimationFrame` 320 ms. Skip si `overlay=false`. |
| `BottomSheet` | Idem `Modal` (migration audit). |
| Popovers header | State local, calcul `getBoundingClientRect` du trigger, fermeture clic extérieur via `mouseDown` sur backdrop transparent. |

### 3.2 Fermeture

Hooks utilitaires confirmés :
- [useModalDialogClose.js](apps/web/src/hooks/useModalDialogClose.js) — pattern de fermeture avec sauvegarde dirty.
- [useSlidePanelClose.js](apps/web/src/hooks/useSlidePanelClose.js) — équivalent pour les slide-panels métier.
- [useConfirmDialog.jsx](apps/web/src/hooks/useConfirmDialog.jsx) — confirmation modale.
- [useDirtyForm](apps/web/src/hooks/useDirtyForm.js) — bloque la fermeture brutale.

Tous les modaux importants délèguent leur fermeture via `onClose` (Escape /
clic backdrop / bouton X) → `pop(token)` → la pile reprend son état précédent.
Aucun composant ne retire son token manuellement.

### 3.3 Re-fetch & cohérence des listes

Pattern unifié : `refreshBus.emit(topic)` après mutation, abonnement via
`useRefreshSubscription` / `useListResource` (cf. audit listes 2026-05-19).
Aucun modal n'a été identifié comme oubliant d'émettre l'événement après
mutation (échantillon contrôlé : ControlPerformModal, ControlEditorModal,
TaskEditModal, AddTaskModal, EventTaskModal, ReservationModal,
MaintenanceDialog, OrderFormModals, AccessRequestModal).

---

## 4. Architecture cible — état observé

L'architecture cible définie dans la PR #24 est **déjà en place** :

```
                ┌──────────────────────────────────────┐
                │   document.body                      │
                │  ┌───────────────────────────────┐   │
                │  │  #emag-modal-root  (portail)  │   │
                │  │   ├─ overlay 9000  ◄──── backdrop  │
                │  │   │   └─ dialog 10000           │   │
                │  │   ├─ overlay 9010  ◄── nested │   │
                │  │   │   └─ dialog 10010           │   │
                │  └───────────────────────────────┘   │
                │  #modal-root, #task-modal-root (legacy) │
                └──────────────────────────────────────┘
                          ▲
                          │ ModalManager (singleton)
                          │  push() / pop() / zIndexFor()
                          │  scroll-lock par compteur
                          ▼
                Modal · ModalLayout · Drawer · BottomSheet
```

Aucune refonte structurelle n'est nécessaire. Les seules dérives détectées
sont **comportementales** (scroll-lock dupliqué, z-index CSS) — corrigées
par les patches ci-dessous.

---

## 5. Corrections appliquées

### 5.1 P1 — `BottomSheet` migré sur ModalManager (ce commit)

Diff résumé :

- `apps/web/src/components/ui/BottomSheet.jsx` :
  - import de `createPortal` + `getModalRoot/push/pop/zIndexFor`.
  - inscription dans la pile (`push` / `pop`) ⇒ scroll-lock délégué.
  - rendu via `createPortal(content, #emag-modal-root)` ⇒ partage du portail.
  - z-index inline (`overlay` + `dialog`) cohérent avec `Modal` / `Drawer`.
  - suppression du `document.body.style.overflow = 'hidden'` manuel.
- `apps/web/src/components/ui/BottomSheet.css` :
  - retrait de `z-index: var(--z-modal, 2000)` sur le backdrop et
    `z-index: var(--z-base)` (= 1) sur le panel — supprime un risque
    d'inversion de superposition quand `--z-base` est redéfini ailleurs.

Impact : empilable proprement avec un `Modal` desktop (cas messagerie
mobile + alerte modale, par exemple).

### 5.2 Pas de patch — décisions documentées

- **HeaderNotifications / HeaderActions** : popovers volontairement non
  modaux (header reste cliquable, page reste scrollable). Leur z-index
  (8000/8001) est documenté inline et reste sous le seuil modal (9000).
  Migrer vers `ModalLayout` introduirait un backdrop bloquant non désiré.
- **Tooltip / DropdownMenu / MapOffScreenIndicators** : portails légitimes
  (overlays non bloquants), aucun conflit avec la pile modale.

### 5.3 Patches non requis (déjà conformes)

- Aucun usage bugué `<Modal isOpen={…}>` détecté (`grep` retourne 0).
- Aucun composant n'utilise `document.body.style.overflow` en dehors du
  `ModalManager` et des tests (après migration `BottomSheet`).

---

## 6. Validation

### 6.1 Tests automatisés

- `apps/web/src/test/modalManager.test.js` (7 tests) — pile, scroll-lock,
  ordre LIFO, `zIndexFor`.
- `apps/web/src/test/Modal.integration.test.jsx` (6 tests) — portail unique,
  empilement, focus, Escape.
- `apps/web/src/test/Modal.test.jsx` — props, fermeture, tailles.
- `apps/web/src/test/Drawer.test.jsx` — animation, focus, side L/R, footer.
- `apps/web/src/test/Dialog.test.jsx`, `EventDetailsModal.test.jsx`.

Exécution : `npm test --workspace=apps/web` (baseline 586/586 verts).

### 6.2 Checklist visuelle (manuelle)

À rejouer après tout changement touchant Modal/Drawer/BottomSheet :

- [ ] Ouverture d'un modal simple : backdrop visible, panel centré,
      `body` non scrollable.
- [ ] Ouverture d'un second modal (nested) : second backdrop plus opaque,
      z-index croissant.
- [ ] Fermeture du modal top → scroll restauré uniquement si pile vide.
- [ ] Tab cycle interne au modal (focus trap).
- [ ] Escape ferme le modal top sans toucher au modal sous-jacent.
- [ ] Drawer + Modal empilés : Drawer reste interactif au-dessus si ouvert
      après.
- [ ] BottomSheet mobile : se ferme via swipe-handle (Escape), backdrop
      cliquable, panel au-dessus du backdrop.
- [ ] Popover notifications header : ne bloque pas la page, click extérieur
      ferme, n'apparaît jamais au-dessus d'un modal ouvert.

### 6.3 Lint / Build

- `npm run lint --workspace=apps/web` (baseline 0 erreurs, 4 warnings).
- `npm run build --workspace=apps/web` (n/a — pas de TS, build Vite).

---

## Conclusion

Le système d'overlays d'eM@g est **mature et homogène**. L'unique violation
résiduelle (BottomSheet mobile) est corrigée par ce commit. Les exceptions
techniques restantes (popovers header, tooltip, dropdown, indicateurs carte)
sont volontaires et documentées par leur z-index plafonné sous le seuil
modal.

**Aucune refactorisation structurelle additionnelle n'est requise.**

---

_Audit produit le 2026-05-19 par GitHub Copilot dans le cadre du programme de
fiabilisation continue. Commit associé : voir CHANGELOG._
