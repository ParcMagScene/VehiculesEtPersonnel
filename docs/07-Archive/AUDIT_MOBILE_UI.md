# AUDIT MOBILE UI — eM@g v2.4.0

> **Date** : Juillet 2025  
> **Périmètre** : GUI mobile complète (composants `mobile/`, modules desktop responsive, CSS, Design System)  
> **Méthode** : Scan exhaustif de 10 répertoires, 130+ fichiers, ~70 000 lignes

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Inventaire détaillé par module](#2-inventaire-détaillé-par-module)
3. [Architecture CSS & Design System](#3-architecture-css--design-system)
4. [Problèmes critiques](#4-problèmes-critiques)
5. [Accessibilité (a11y)](#5-accessibilité-a11y)
6. [Inline styles & couleurs hardcodées](#6-inline-styles--couleurs-hardcodées)
7. [Touch & interactions mobiles](#7-touch--interactions-mobiles)
8. [Permissions & sécurité](#8-permissions--sécurité)
9. [Matrice de conformité](#9-matrice-de-conformité)
10. [Plan d'action proposé](#10-plan-daction-proposé)

---

## 1. Vue d'ensemble

### 1.1 Périmètre scanné

| Répertoire | Fichiers | Lignes | Statut |
|---|---|---|---|
| `components/mobile/` | 34 (17 JSX + 17 CSS) | 12 947 | ✅ Scanné |
| `components/planning/` | 20 (10 JSX + 10 CSS) | 13 795 | ✅ Scanné |
| `components/vehicles/` | 41 (21 JSX + 20 CSS) | 26 545 | ✅ Scanné |
| `components/equipment/` | 9 (5 JSX + 4 CSS) | 8 993 | ✅ Scanné |
| `components/affaires/` | 20 (10 JSX + 10 CSS) | 14 758 | ✅ Scanné |
| `components/annuaire/` | 5 (3 JSX + 2 CSS) | 3 113 | ✅ Scanné |
| `components/sav/` | — | — | ❌ Inexistant (intégré dans `equipment/`) |
| `components/stock/` | — | — | ❌ Inexistant |
| `components/settings/` | — | — | ❌ Inexistant |
| CSS & Design System | ~50 fichiers | ~5 000+ | ✅ Scanné |
| **TOTAL** | **~130 fichiers** | **~80 000 lignes** | |

### 1.2 Architecture mobile actuelle

L'application eM@g utilise une **architecture duale** :

- **Mode mobile** : Shell dédié `MobileApp.jsx` (616 lignes) avec routing interne, 17 composants mobile-spécifiques, CSS mobile-first
- **Mode desktop** : Modules complets (planning, vehicles, equipment, affaires, annuaire) avec **media queries CSS desktop-first** (`max-width`)
- **Pont** : 3 wrappers lazy-load (`MobileEquipment`, `MobileOrders`, `MobileInventory`) qui chargent les composants desktop dans le shell mobile

**Approche CSS** : Desktop-first (`max-width` exclusivement), 7 breakpoints documentés dans `theme.css`.

### 1.3 Scores par module

| Module | Responsive | Touch | a11y | DS | Permissions | Score |
|---|---|---|---|---|---|---|
| mobile/ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | **7/10** |
| planning/ | ⭐⭐⭐ | ⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐ | **6/10** |
| vehicles/ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐ | **7/10** |
| equipment/ | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐ | **7/10** |
| affaires/ | ⭐⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐ | **6/10** |
| annuaire/ | ⭐⭐ | ⭐ | ⭐ | ⭐⭐⭐⭐ | ⭐ | **5/10** |

---

## 2. Inventaire détaillé par module

### 2.1 `components/mobile/` — 34 fichiers, 12 947 lignes

| Composant | JSX | CSS | Rôle | DS |
|---|---|---|---|---|
| MobileApp | 616 | 999 | Shell principal, auth, routing, menu | ✅ |
| MobileHome | 51 | 219 | Grille d'accueil 3×3 | ✅ |
| MobileLogin | 279 | 211 | Login/inscription/reset | ✅ |
| MobileAffaires | 494 | 669 | Affaires + détail | ✅ |
| MobileAvailability | 219 | 364 | Disponibilité véhicules | ✅ |
| MobileEquipment | 26 | — | Wrapper lazy-load EquipmentPanel | ✅ |
| MobileEquipmentQR | 408 | 603 | Scan QR multi-écrans | ✅ |
| MobileQRLanding | 101 | 185 | Page d'atterrissage QR | ✅ |
| MobileLeaves | 512 | 643 | Gestion congés 4 sous-composants | ✅ |
| MobileLocation | 396 | 444 | Plan SVG interactif dépôt | ✅ |
| MobileMaintenances | 292 | 252 | Interventions | ✅ |
| MobileMessaging | 375 | 472 | Messagerie + fichiers | ✅ |
| MobileOrders | 25 | — | Wrapper lazy-load OrdersPanel | ✅ |
| MobileParcDashboard | 147 | 211 | Dashboard parc véhicules | ✅ |
| MobilePersonnel | 587 | 951 | Planning personnel jour/semaine | ✅ |
| MobilePlanning | 391 | 428 | Planning Gantt mensuel | ✅ |
| MobileReservations | 372 | 538 | Création/liste réservations | ✅ |
| MobileTasks | 206 | 236 | Tâches du jour | ✅ |
| MobileInventory | 25 | — | Wrapper lazy-load InventoryPanel | ✅ |

**Points positifs** :
- ✅ 100% des composants utilisent le Design System (`@/design-system`)
- ✅ Lazy loading pour 3 modules lourds (Equipment, Orders, Inventory)
- ✅ CSS séparé par composant, classes préfixées (BEM-like)
- ✅ `useCallback`/`useMemo` pour performance
- ✅ Constantes centralisées (`../../constants`)

### 2.2 `components/planning/` — 20 fichiers, 13 795 lignes

| Composant | JSX | CSS | @media |
|---|---|---|---|
| TaskPlanningPanel | 2 611 | 2 458 | 480, 768, 1024 |
| EventDetailsModal | 894 | 1 115 | 768 |
| AddTaskModal | 545 | 300 | 640 |
| TaskPDFExportModal | 592 | 496 | 768 |
| PeriodCalendarModal | 460 | 534 | 480 |
| InterventionModal | 409 | 303 | 640 |
| TaskEditModal | 374 | 368 | 480 |
| PlanningPanel | 107 | 1 118 | 768 |
| EventTaskModal | 378 | 324 | 640 |
| OverdueInterventionModal | 117 | 292 | 640 |

**Problèmes** :
- ❌ 0 composants Design System importés — 100% composants locaux
- ❌ 0 touch handlers (pas de swipe, pas de gestes)
- ⚠️ 32 inline styles dans TaskPlanningPanel (pire du module)
- ⚠️ 40+ couleurs hardcodées en hex dans les JSX
- ✅ 1 444 `var()` CSS tokens utilisés (bonne base)

### 2.3 `components/vehicles/` — 41 fichiers, 26 545 lignes

| Composant | JSX | CSS | @media |
|---|---|---|---|
| Calendar | 2 744 | 1 498 | Oui |
| ReservationModal | 1 754 | 1 469 | Oui |
| TripDetailsModal | 1 474 | 786 | Oui |
| DepotMapEditor | 1 371 | 631 | ❌ |
| GoogleCalendarBanner | 990 | 748 | Oui |
| MaintenanceDialog | 1 210 | 1 075 | Oui |
| DepotMap | 764 | 551 | Oui |
| LocationDialog | 566 | 750 | Oui |
| ClientDialog | 502 | — | — |
| VehicleDetailsModal | 449 | 774 | Oui |
| ... | ... | ... | ... |

**6 fichiers CSS SANS media queries** : DepotMapEditor.css, DriverSelect.css, GoogleCalendarConfig.css, ReservationEquipment.css, ReservationRequestsPanel.css, VehiclePickerCards.css

**Points forts** :
- ✅ Touch complet dans DepotMap (pinch-to-zoom, pan tactile)
- ✅ 2 432 `var()` CSS tokens
- ✅ Permissions granulaires (`canManageMaintenance`, `isReadOnly`)

**Problèmes** :
- ❌ 0 composants Design System
- ❌ 0 `tabIndex` — inaccessible au clavier
- ⚠️ Nombreux inline styles (MaintenanceDialog 22, Calendar 19)

### 2.4 `components/equipment/` — 9 fichiers, 8 993 lignes

| Composant | JSX | CSS | @media |
|---|---|---|---|
| EquipmentPanel | 3 157 | 3 510 | 480, 640, 768, 1024 |
| EquipmentImportModal | 357 | 374 | dark-mode uniquement |
| EquipmentBatchLabels | 343 | 352 | ❌ |
| EquipmentLabelPrint | 275 | 377 | 480 |
| EquipmentSheetPrint | 248 | — | — |

**Unique module avec `isMobile` prop** (17 occurrences) — ajuste le comportement JS (slide panel, pas de print, cascade adaptée).

**Problèmes** :
- ❌ **75 inline styles** dans EquipmentPanel.jsx (pire fichier du projet)
- ⚠️ 50+ couleurs hardcodées (EquipmentSheetPrint justifiable pour impression)
- ❌ 0 composants Design System

### 2.5 `components/affaires/` — 20 fichiers, 14 758 lignes

| Composant | JSX | CSS | @media |
|---|---|---|---|
| AffaireDetailPanel | 2 140 | 1 785 | 768 |
| AffairesPanel | 1 203 | 1 124 | 768, 480 |
| AffaireImportModal | 1 173 | 636 | 640 |
| BLImportLocPrestaModal | 716 | 764 | 640 |
| BPAnnotationViewer | 651 | 329 | 768 |
| BLMultiImportModal | 595 | 788 | ❌ |
| BLImportModal | 580 | 471 | 640 |
| SavImportModal | 487 | 193 | ❌ |
| GenerateOrdersModal | 295 | 278 | 640 |
| BLBatchAnalysis | 279 | 271 | ❌ |

**Points forts** : Bonne adoption DS (Button, Input, Select, Table, Tooltip...), `safe-area-inset-bottom` sur FAB

**Problèmes** :
- ❌ 3 CSS sans media queries (BLBatchAnalysis, BLMultiImportModal, SavImportModal)
- ❌ 0 touch handling
- ❌ 0 vérification de permissions
- ⚠️ ~25 couleurs hardcodées dans JSX

### 2.6 `components/annuaire/` — 5 fichiers, 3 113 lignes

| Composant | JSX | CSS | @media |
|---|---|---|---|
| AnnuairePanel | 1 245 | 1 031 | 768 |
| ContactsCSVImportDialog | 292 | 352 | dark-mode uniquement |
| LocationsTab | 193 | — | — |

**Points forts** : Excellente adoption DS (12 composants utilisés)

**Problèmes** :
- ❌ 18 couleurs hardcodées dans AnnuairePanel.css (entity-tags/type-badges)
- ❌ ContactsCSVImportDialog sans responsive mobile
- ❌ 0 touch, 0 permissions, quasi 0 a11y

---

## 3. Architecture CSS & Design System

### 3.1 Tokens — Architecture 3 niveaux

```
3. Composants (Button.css)  → var(--btn-primary-bg)
2. Sémantique (tokens.css)  → var(--surface-primary)
1. Primitifs  (theme.css)   → var(--theme-primary)
```

| Fichier | Rôle | Lignes |
|---|---|---|
| `theme.css` | Tokens primitifs `:root` — couleurs, spacing, radius, typo, ombres, z-index | ~300+ |
| `design/tokens.css` | Tokens sémantiques — surfaces, feedback, layout, glass | ~300 |
| `theme-palettes.css` | 6 palettes + dark variants | ~200 |
| `theme-density.css` | Mode `data-density="compact"` (~75%) | ~100 |
| `theme-tv.css` | Palette TV haute visibilité WCAG AAA | ~100 |

### 3.2 Breakpoints officiels (documentés dans theme.css)

| Breakpoint | Token | Occurrences totales | Description |
|---|---|---|---|
| `1200px` | `xl` | 1 | Exception rare (calendrier) |
| `1024px` | `lg` | 16 | Tablette paysage |
| `768px` | `md` | 52 | **Principal** — tablette portrait |
| `640px` | `sm` | 40 | Mobile grand / bottom-sheets |
| `480px` | `xs` | 26 | Mobile petit |
| `380px` | `xxs` | 1 | Ultra-petit (MobileApp) |
| `900px` | — | 1 | **Non-standard** (LocationsMapPanel) |

### 3.3 Design System — 32 composants exportés

| Catégorie | Composants |
|---|---|
| **Atomes** | Button, Input, Textarea, Select, Checkbox, Toggle, Tag, Badge, StatusBadge, Avatar, Tooltip, Spinner, LoadingOverlay, ProgressBar, EmptyState, InlineAlert |
| **Molécules** | DropdownMenu, DropdownItem, Tabs, TabList, Tab, TabPanel, Accordion, Divider, SearchBar, FilterBar, ListItem, EntityCombobox |
| **Organismes** | Modal, ModalLayout, Dialog, Drawer, PageHeader, FormLayout, FormSection, FormRow, FormActions, ModuleLayout, ModuleToolbar, ModuleContent, ModuleFooter, SplitLayout |
| **Layout** | Card, Panel, SectionHeader, Table, ScrollArea, FormField, DetailRow |

**Composants UI avec responsive** (5/32) : FormLayout (640px), Drawer (640px), ModuleLayout (768px), Modal (640px), PageHeader (640px)

### 3.4 Adoption du Design System

| Module | Composants DS importés | Score |
|---|---|---|
| mobile/ | ⭐⭐⭐⭐ 15+ composants | **Excellent** |
| affaires/ | ⭐⭐⭐⭐ 12+ composants | **Excellent** |
| annuaire/ | ⭐⭐⭐⭐ 12+ composants | **Excellent** |
| planning/ | ⭐ 0 composant | **Critique** |
| vehicles/ | ⭐ 0 composant | **Critique** |
| equipment/ | ⭐ 0 composant | **Critique** |

### 3.5 Utilisation des tokens CSS `var()`

| Module | Nbr `var()` | Valeurs px hardcodées | Ratio |
|---|---|---|---|
| mobile/ CSS | 1 986 | ~558 | **78%** tokenisé |
| planning/ CSS | 1 444 | ~200 | **88%** tokenisé |
| vehicles/ CSS | 2 432 | ~300 | **89%** tokenisé |
| equipment/ CSS | 1 001 | ~150 | **87%** tokenisé |
| affaires/ CSS | ~1 500 | ~200 | **88%** tokenisé |
| annuaire/ CSS | ~500 | ~50 | **91%** tokenisé |

---

## 4. Problèmes critiques

### 🔴 P0 — Sécurité / Fonctionnel

| # | Problème | Fichier | Ligne | Impact |
|---|---|---|---|---|
| C1 | **MobileHome affiche 9 modules sans vérifier les permissions** alors que le menu latéral MobileApp les filtre — incohérence permettant l'accès à des écrans non autorisés | `MobileHome.jsx` | L7-45 | Sécurité |
| C2 | **Reset mot de passe sans token** : `selfResetPasswordWithNewPassword(email, name, password)` — seuls email + nom comme vérification, pas de token email | `MobileLogin.jsx` | L202 | Sécurité |
| C3 | **Upload fichier sans limite de taille** côté client — fichiers arbitrairement gros envoyés en base64 | `MobileMessaging.jsx` | L153 | Performance/DoS |
| C4 | **`EQUIPMENT_STATUS` dupliqué** dans 2 fichiers — risque de divergence | `MobileEquipmentQR.jsx` + `MobileQRLanding.jsx` | L14-19 | Maintenabilité |

### 🔴 P0 — UX Mobile

| # | Problème | Fichier(s) | Impact |
|---|---|---|---|
| C5 | **0 touch handling** dans planning/ (13 795 lignes) — aucun swipe, pas de gestes | Tout `planning/` | UX mobile |
| C6 | **0 `tabIndex`** dans vehicles/ (26 545 lignes) — éléments `role="button"` non-focusables | Tout `vehicles/` | Accessibilité |
| C7 | **75 inline styles** dans EquipmentPanel.jsx — maintenance impossible | `EquipmentPanel.jsx` | Maintenabilité |
| C8 | **6 fichiers CSS sans `@media` responsive** dans vehicles/ | DepotMapEditor, DriverSelect, GoogleCalendarConfig, ReservationEquipment, ReservationRequestsPanel, VehiclePickerCards | Responsive |

---

## 5. Accessibilité (a11y)

### 5.1 Inventaire des attributs ARIA

| Module | `role=` | `aria-*` | `tabIndex` | Score |
|---|---|---|---|---|
| mobile/ | ~12 | ~10 | ~8 | ⭐⭐ |
| planning/ | 15 | 12 | 13 | ⭐⭐ |
| vehicles/ | 11 | 27 | **0** | ⭐⭐ |
| equipment/ | 15 | 8 | 14 | ⭐⭐⭐ |
| affaires/ | ~8 | ~6 | ~6 | ⭐⭐ |
| annuaire/ | ~1 | ~1 | ~0 | ⭐ |

### 5.2 Problèmes récurrents

| Problème | Occurrences | Fichiers |
|---|---|---|
| **Boutons icon-only sans `aria-label`** | ~15+ | MobileApp, MobileAvailability, MobileMaintenances, MobileReservations, MobileParcDashboard, MobileInventory |
| **`role="button" tabIndex={0}` sans `onKeyDown`** | ~10+ | MobileAffaires, MobileLeaves, MobilePersonnel, MobileParcDashboard, vehicles/* |
| **Overlays fermés via `onMouseDown` uniquement** (pas Escape) | ~5 | MobileApp (menu, user-sheet), MobileReservations, MobileLogin |
| **Menu latéral sans `role="navigation"`** | 1 | MobileApp L305 |
| **Conversations messagerie en `<div>` cliquables** sans role/tabIndex | 1 | MobileMessaging L287 |
| **Zones SVG du plan** sans attributs a11y | 1 | MobileLocation |
| **`role="checkbox"` sans `aria-checked`** | ~3 | TaskPDFExportModal |
| **Inputs `type="date"` natifs sans `<label htmlFor>`** | ~5+ | MobileMaintenances, MobileReservations, MobileLeaves |

---

## 6. Inline styles & couleurs hardcodées

### 6.1 Top 10 — Inline styles (nombre d'occurrences JSX)

| # | Fichier | Inline styles | Priorité |
|---|---|---|---|
| 1 | EquipmentPanel.jsx | **75** | 🔴 |
| 2 | TaskPlanningPanel.jsx | **32** | 🔴 |
| 3 | MaintenanceDialog.jsx | 22 | 🟡 |
| 4 | BLImportModal.jsx | ~20 | 🟡 |
| 5 | Calendar.jsx | 19 | 🟡 |
| 6 | ReservationEquipment.jsx | 18 | 🟡 |
| 7 | DepotMapEditor.jsx | 15 | 🟡 |
| 8 | AffairesPanel.jsx | ~15 | 🟡 |
| 9 | DepotMap.jsx | 14 | ⚪ (SVG, légitime) |
| 10 | TripDetailsModal.jsx | 11 | 🟡 |

### 6.2 Couleurs hardcodées (non-tokens)

**Couleurs récurrentes hors Design System** :

| Couleur | Hex | Occurrences | Usage |
|---|---|---|---|
| Green | `#10b981` | ~15 | Statuts OK, disponible |
| Blue | `#3b82f6` | ~12 | Statuts info, liens |
| Amber | `#f59e0b` | ~10 | Avertissements, en cours |
| Red | `#ef4444` / `#dc2626` | ~10 | Erreurs, indisponible |
| Purple | `#8b5cf6` / `#6366f1` | ~8 | Catégories spéciales |
| Pink | `#ec4899` | ~5 | Tags, catégories |
| Gray | `#6b7280` / `#64748b` | ~8 | Fallbacks, texte muted |
| Cyan | `#06b6d4` | ~3 | Highlights |
| Lime | `#84cc16` | ~2 | Indicateurs positifs |
| White | `#fff` / `#ffffff` | ~5 | Contrastes sur couleurs |

**Fichiers CSS les plus touchés** :
- AnnuairePanel.css : 18 couleurs hardcodées (entity-tags)
- DepotMapEditor.css : 7
- TaskEditModal.css : 6
- EventTaskModal.css : 4

### 6.3 Variables mortes / code mort

| Problème | Fichier | Ligne |
|---|---|---|
| `_getClient`, `_getDriver`, `_monthReservationsCount` — préfixés `_` | MobilePlanning.jsx | L184-186, L266 |
| `gap: 8` sans unité CSS | MobileLeaves.jsx | L140 |
| `WebkitOverflowScrolling: 'touch'` — propriété obsolète | EquipmentPanel.jsx | — |

---

## 7. Touch & interactions mobiles

### 7.1 Matrice touch handling

| Module | Touch handlers | Gestes | Swipe | Pinch-zoom |
|---|---|---|---|---|
| mobile/MobileLocation | ✅ | Pan + zoom tactile | ❌ | ❌ |
| vehicles/DepotMap | ✅✅ | Pan + pinch-to-zoom complet | ❌ | ✅ |
| vehicles/DepotMapEditor | ✅ | Drag zones + resize handles | ❌ | ❌ |
| equipment/EquipmentPanel | ⚠️ | 1 `onTouchMove` (anti-scroll dropdown) | ❌ | ❌ |
| **planning/** | ❌ | **Aucun** | ❌ | ❌ |
| **affaires/** | ❌ | **Aucun** | ❌ | ❌ |
| **annuaire/** | ❌ | **Aucun** | ❌ | ❌ |
| **mobile/ (hors Location)** | ❌ | **Aucun** | ❌ | ❌ |

### 7.2 Gestes manquants critiques

| Geste | Contexte | Fichier(s) concerné(s) |
|---|---|---|
| **Swipe retour** | Navigation entre vues dans le shell mobile | MobileApp.jsx |
| **Swipe listes** | Supprimer/archiver des éléments | MobileAffaires, MobileLeaves, MobileTasks |
| **Pull-to-refresh** | Rafraîchir données mobiles | Tous les écrans mobile/ |
| **Swipe onglets** | Navigation entre onglets planning jour/semaine | MobilePersonnel, MobilePlanning |

### 7.3 Polling vs Push

| Composant | Mécanisme | Intervalle | Recommandation |
|---|---|---|---|
| MobileApp | `setInterval(fetchUnread)` | 10s | SSE/WebSocket |
| MobileMessaging | `setInterval` conversations + messages | 5s | WebSocket (priorité haute) |

---

## 8. Permissions & sécurité

### 8.1 Vérifications de permissions par module

| Module | Pattern | Détail |
|---|---|---|
| mobile/MobileApp | ✅ `isAdmin \|\| permissions.can_manage_*` | Menu latéral filtre Equipment, Orders, Inventory |
| mobile/MobileHome | ❌ **AUCUNE** | Affiche 9 modules à tous — **INCOHÉRENT** avec MobileApp |
| mobile/MobileEquipmentQR | ✅ `isAdmin` | Bouton "Intervention directe" admin-only |
| mobile/MobileLeaves | ✅ `ROLES.ADMIN \|\| ROLES.MANAGER` | Admin list séparée |
| mobile/MobilePersonnel | ✅ `isSimpleUser` | "Mon planning" vs liste complète |
| mobile/MobileTasks | ✅ `isAdmin` | Toggle "Mes tâches / Toutes" |
| mobile/MobileReservations | ✅ | Admin crée direct, non-admin fait demande |
| planning/ | ✅ `currentUser?.isAdmin` | Modals conditionnels (modifier, supprimer) |
| vehicles/ | ✅ `isAdmin` + `canManageMaintenance` + `isReadOnly` | Granulaire |
| equipment/ | ✅ `isAdmin` + `canManageEquipmentMaintenance` | Le plus complet |
| **affaires/** | ❌ **AUCUNE** | Tous les utilisateurs voient tout |
| **annuaire/** | ❌ **AUCUNE** | Tous les utilisateurs voient tout |

### 8.2 Problèmes de sécurité identifiés

| # | Problème | Sévérité | Fichier |
|---|---|---|---|
| S1 | Reset mot de passe sans token email (email + nom suffit) | 🔴 Haute | MobileLogin.jsx L202 |
| S2 | Upload fichier sans validation taille max côté client | 🟡 Moyenne | MobileMessaging.jsx L153 |
| S3 | MobileHome bypass permissions du menu latéral | 🟡 Moyenne | MobileHome.jsx |
| S4 | Password `minLength={6}` — insuffisant | 🟡 Basse | MobileLogin.jsx |

---

## 9. Matrice de conformité

### 9.1 Conformité globale

| Critère | mobile/ | planning/ | vehicles/ | equipment/ | affaires/ | annuaire/ |
|---|---|---|---|---|---|---|
| **@media responsive** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Touch handling** | ⭐⭐ | ❌ | ⭐⭐⭐ | ⭐ | ❌ | ❌ |
| **Design System** | ⭐⭐⭐⭐ | ❌ | ❌ | ❌ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Accessibilité** | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| **Permissions** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ | ❌ |
| **Tokens CSS var()** | 78% | 88% | 89% | 87% | 88% | 91% |
| **Inline styles** | Faible | Moyen | Moyen | 🔴 Massif | Moyen | Faible |
| **Couleurs hardcodées** | ~20 | ~40+ | ~13 | ~50+ | ~25 | ~18 |
| **isMobile JS** | ❌ | ❌ | ❌ | ✅ (prop) | ❌ | ❌ |

### 9.2 CSS sans media queries (à corriger)

| Fichier | Module | Lignes |
|---|---|---|
| DepotMapEditor.css | vehicles/ | 631 |
| DriverSelect.css | vehicles/ | 213 |
| GoogleCalendarConfig.css | vehicles/ | 424 |
| ReservationEquipment.css | vehicles/ | 85 |
| ReservationRequestsPanel.css | vehicles/ | 296 |
| VehiclePickerCards.css | vehicles/ | 259 |
| EquipmentBatchLabels.css | equipment/ | 352 |
| BLBatchAnalysis.css | affaires/ | 271 |
| BLMultiImportModal.css | affaires/ | 788 |
| SavImportModal.css | affaires/ | 193 |
| ContactsCSVImportDialog.css | annuaire/ | 352 |

**Total : 11 fichiers CSS, ~3 864 lignes sans aucun responsive mobile.**

---

## 10. Plan d'action proposé

### Phase A — Sécurité & corrections critiques (Priorité P0)

| # | Action | Fichier(s) | Effort |
|---|---|---|---|
| A1 | Filtrer MobileHome selon les mêmes permissions que le menu latéral MobileApp | MobileHome.jsx | S |
| A2 | Ajouter validation taille max fichier dans MobileMessaging (ex: 10 MB) | MobileMessaging.jsx | S |
| A3 | Extraire `EQUIPMENT_STATUS` dans `constants.js` (dé-duplication) | MobileEquipmentQR.jsx, MobileQRLanding.jsx, constants.js | S |
| A4 | Supprimer code mort (`_getClient`, `_getDriver`, `_monthReservationsCount`) | MobilePlanning.jsx | S |

### Phase B — Accessibilité (WCAG 2.1 AA)

| # | Action | Fichier(s) | Effort | Statut |
|---|---|---|---|---|
| B1 | Ajouter `aria-label` sur tous les boutons icon-only (~15) | mobile/*.jsx | S | ✅ Done |
| B2 | Ajouter `onKeyDown` (Enter/Space) sur tous `role="button" tabIndex={0}` | mobile/*.jsx, vehicles/*.jsx | M | ✅ Déjà OK |
| B3 | Ajouter fermeture Escape sur overlays/modales | MobileApp, MobileReservations, MobileLogin | S | ✅ Déjà OK |
| B4 | Ajouter `role="navigation"` au menu latéral | MobileApp.jsx | S | ⬜ |
| B5 | Ajouter `tabIndex={0}` sur les éléments interactifs de vehicles/ | vehicles/*.jsx | M | ⬜ |
| B6 | Corriger `role="checkbox"` + `aria-checked` | TaskPDFExportModal.jsx | S | ⬜ |
| B7 | Associer `<label htmlFor>` aux inputs date natifs | Mobile*.jsx (5+ fichiers) | S | ⬜ |

### Phase C — CSS responsive (11 fichiers manquants)

| # | Action | Fichier(s) | Effort |
|---|---|---|---|
| C1 | Ajouter @media 768px + 480px aux 6 CSS vehicles/ manquants | DepotMapEditor, DriverSelect, GoogleCalendarConfig, ReservationEquipment, ReservationRequestsPanel, VehiclePickerCards | M |
| C2 | Ajouter @media 640px aux 3 CSS affaires/ manquants | BLBatchAnalysis, BLMultiImportModal, SavImportModal | M |
| C3 | Ajouter @media 768px pour annuaire/ | ContactsCSVImportDialog | S |
| C4 | Ajouter @media 480px pour equipment/ | EquipmentBatchLabels | S |

### Phase D — Migration inline styles → CSS

| # | Action | Fichier | Effort |
|---|---|---|---|
| D1 | Migrer 75 inline styles vers EquipmentPanel.css | EquipmentPanel.jsx | L |
| D2 | Migrer 32 inline styles vers TaskPlanningPanel.css | TaskPlanningPanel.jsx | M |
| D3 | Migrer les inline styles layout des composants mobile/ | MobileApp, MobileLogin, MobileLeaves | S |
| D4 | Migrer les ~20 inline styles de BLImportModal | BLImportModal.jsx | S |

### Phase E — Couleurs → tokens Design System

| # | Action | Fichier(s) | Effort |
|---|---|---|---|
| E1 | Définir tokens sémantiques dans `tokens.css` : `--status-success`, `--status-warning`, `--status-danger`, `--status-info`, `--status-neutral` | tokens.css | S |
| E2 | Remplacer les ~100 couleurs hex des JSX par les tokens CSS | Tous les modules | L |
| E3 | Migrer les 18 couleurs hardcodées AnnuairePanel.css → tokens | AnnuairePanel.css | S |
| E4 | Créer constante `AVATAR_COLORS` centralisée | MobileMessaging.jsx → constants.js | S |

### Phase F — Touch & UX mobile

| # | Action | Fichier(s) | Effort | Statut |
|---|---|---|---|---|
| F1 | Ajouter pull-to-refresh hook (`usePullToRefresh`) | Hook partagé + tous les écrans mobile/ | M | ✅ Done (Affaires, Tasks, Leaves, Personnel, Reservations, Maintenances, Planning) |
| F2 | Ajouter swipe-back navigation dans MobileApp | MobileApp.jsx | M | ✅ Déjà OK |
| F3 | Remplacer polling messagerie 5s par WebSocket/SSE | MobileMessaging.jsx + backend | L | ✅ Déjà OK (useMessagingSSE) |
| F4 | Ajouter gestes swipe sur listes (slide-to-action) | MobileAffaires, MobileLeaves, MobileTasks | M | ✅ Done |

### Phase G — Adoption Design System (modules desktop)

| # | Action | Module | Effort |
|---|---|---|---|
| G1 | Migrer planning/ vers composants DS (Button, Input, Select, Modal) | planning/*.jsx (10 fichiers) | L |
| G2 | Migrer vehicles/ vers composants DS | vehicles/*.jsx (21 fichiers) | XL |
| G3 | Migrer equipment/ vers composants DS | equipment/*.jsx (5 fichiers) | L |
| G4 | Standardiser les modals avec `ModalLayout` DS | affaires/ (BLImportModal, BLImportLocPrestaModal, BLMultiImportModal, GenerateOrdersModal) | M |

### Phase H — Permissions & guards

| # | Action | Module | Effort |
|---|---|---|---|
| H1 | Ajouter vérification permissions dans affaires/ | affaires/*.jsx | S |
| H2 | Ajouter vérification permissions dans annuaire/ | annuaire/*.jsx | S |

---

### Récapitulatif effort

| Phase | Thème | Effort total | Priorité |
|---|---|---|---|
| **A** | Sécurité & critiques | S | 🔴 P0 |
| **B** | Accessibilité | M | 🔴 P0 |
| **C** | CSS responsive | M-L | 🟡 P1 |
| **D** | Migration inline styles | L | 🟡 P1 |
| **E** | Couleurs → tokens | M-L | 🟡 P1 |
| **F** | Touch & UX mobile | L | 🟠 P2 |
| **G** | Adoption Design System | XL | 🟠 P2 |
| **H** | Permissions | S | 🟡 P1 |

**Légende effort** : S = < 1h, M = 1-3h, L = 3-8h, XL = 8h+

---

*Audit généré automatiquement — eM@g v2.4.0*
