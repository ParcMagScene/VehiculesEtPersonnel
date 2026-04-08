# AUDIT_CSS.md — Audit CSS Global eM@g

> **Date** : 8 avril 2026 | **Branche** : `dev`  
> **Statut** : 🔍 SCAN TERMINÉ — EN ATTENTE VALIDATION PLAN  
> **Historique** : Phase C (commit `49ad2d8`) a corrigé C1-C2 z-index + M10 dark mode. Ce document couvre le **backlog restant + scan exhaustif**.

---

## 1. Résumé global

| Métrique | Valeur |
|----------|--------|
| Fichiers CSS (composants) | **132** |
| Fichiers JSX (composants) | **174** |
| Lignes CSS totales | **72 571** |
| Fichiers design tokens | 3 (theme.css, tokens.css, theme-palettes.css) |
| Composants Design System (ui/) | **32** (Button, Input, Select, Modal, Dialog, etc.) |
| Violations magiques détectées | **~1 000+** |
| Fichiers mobile CSS | **18** |
| Fichier TV-client CSS | **1** (+ theme-tv.css) |

### Verdicts par domaine

| Domaine | Sévérité | Commentaire |
|---------|----------|-------------|
| Valeurs magiques (couleurs) | 🔴 CRIT | 119 hex + 200+ rgba hardcodées dans 33+ fichiers |
| Valeurs magiques (font-size) | 🔴 CRIT | 200+ violations dans 40+ fichiers |
| Valeurs magiques (border-radius) | 🟠 HIGH | 200+ violations dans 50+ fichiers |
| Valeurs magiques (z-index) | 🟡 MED | 27 violations dans 14 fichiers |
| Styles inline | 🔴 CRIT | 200+ `style={{}}` dans JSX |
| Classes dupliquées/collisions | 🔴 CRIT | `.form-group` dans 20+ fichiers, `.modal-header` dans 11 |
| Modals incohérentes | 🟠 HIGH | 10+ variations de nommage, padding non tokenisé |
| Toolbars incohérentes | 🟠 HIGH | 7+ patterns de toolbar différents |
| Headers non unifiés | 🟡 MED | `.panel-header`, `.header-content`, `.header-stats` fragmentés |
| Breakpoints incohérents | 🟠 HIGH | 10 breakpoints différents au lieu de 4-5 |
| TV-client isolement | 🔴 CRIT | Zéro tokens, classes génériques non namespaced |
| Mobile namespacing | 🟠 HIGH | Classes sans préfixe `mobile-` (`.back-button`, `.form-group`) |
| Éléments natifs hors DS | 🟡 MED | ~25 `<input>` natifs, 1 `<select>` natif |
| Design System adoption | 🟢 OK | `<Button>` 98%, `<Select>` 99%, `<Textarea>` 100% |

---

## 2. Liste des modules impactés

| Module | Fichiers CSS | Lignes CSS | Sévérité |
|--------|-------------|-----------|----------|
| equipment/ | EquipmentPanel.css + EquipmentImportModal.css | 3 501+ | 🔴 |
| DisplayDashboard/ | DisplayDashboardPanel.css | 3 179 | 🔴 |
| planning/ | TaskPlanningPanel + PlanningPanel + modals | 4 691+ | 🔴 |
| personnel/ | PersonnelPanel + AssignmentDialog + modals | 3 177+ | 🔴 |
| orders/ | OrdersPanel + StockPanel + SupplierCatalog | 3 297+ | 🟠 |
| vehicles/ | Calendar + Reservation + Maintenance + Location | 5 817+ | 🔴 |
| affaires/ | AffairesPanel + AffaireDetail + imports | 2 909+ | 🟠 |
| management/ | ManagementPanel + Dashboard + Users | 1 197+ | 🟡 |
| annuaire/ | AnnuairePanel + ContactsCSVImport | 912+ | 🟡 |
| mobile/ | 18 fichiers CSS | 7 000+ | 🔴 |
| tv-client/ | styles.css | ~300 | 🔴 |
| auth/ | LoginForm + Profile + ChangePassword | 500+ | 🟡 |
| mailing/ | MailingPanel.css | ~500 | 🟡 |
| video/ | VideoPanel + PlaybackPanel | ~800 | 🟡 |
| leaves/ | LeaveRequestsPanel + LeavesTab + forms | ~700 | 🟡 |
| ui/ (Design System) | 32 fichiers CSS | ~3 000 | 🟢 |

---

## 3. Top 20 fichiers CSS les plus volumineux

| # | Fichier | Lignes |
|---|---------|--------|
| 1 | components/equipment/EquipmentPanel.css | 3 501 |
| 2 | components/DisplayDashboard/DisplayDashboardPanel.css | 3 179 |
| 3 | components/planning/TaskPlanningPanel.css | 2 458 |
| 4 | components/personnel/PersonnelPanel.css | 2 061 |
| 5 | App.css | 1 899 |
| 6 | components/orders/StockPanel.css | 1 844 |
| 7 | components/affaires/AffaireDetailPanel.css | 1 785 |
| 8 | components/vehicles/Calendar.css | 1 488 |
| 9 | components/vehicles/ReservationModal.css | 1 469 |
| 10 | components/orders/OrdersPanel.css | 1 453 |
| 11 | components/management/ManagementPanel.css | 1 197 |
| 12 | components/affaires/AffairesPanel.css | 1 124 |
| 13 | components/planning/PlanningPanel.css | 1 118 |
| 14 | components/personnel/AssignmentDialog.css | 1 116 |
| 15 | components/planning/EventDetailsModal.css | 1 115 |
| 16 | components/vehicles/MaintenanceDialog.css | 1 075 |
| 17 | components/mobile/MobileApp.css | 999 |
| 18 | components/mobile/MobilePersonnel.css | 951 |
| 19 | components/annuaire/AnnuairePanel.css | 912 |
| 20 | components/mobile/MobileTasks.css | ~800 |

---

## 4. Problèmes détectés

### 4.1 Couleurs hex hardcodées (119 occurrences, 33+ fichiers)

| Fichier | Couleurs |
|---------|----------|
| PersonnelPanel.css | `#f3e8ff` `#9d174d` `#0d9488` `#ccfbf1` `#be123c` |
| PersonnelImportModal.css | `#3a3a3a` `#34d399` `#f472b6` |
| EquipmentPanel.css | `#1a1a2e` |
| Calendar.css | `#4338ca` `#4c1d95` `#3b0764` `#581c87` |
| VideoPanel.css | `#1a1a2e` `#e0e0e0` `#16213e` `#333` |
| DisplayDashboardPanel.css | `#ecfdf5` `#ff6600` `#2ecc40` |
| AnnuairePanel.css | `#ede9fe` `#fce7f3` `#9d174d` `#3730a3` |
| GenerateOrdersModal.css | `#f3f3f3` `#e67e22` `#28a745` |
| SavImportModal.css | `#f59e0b` `#ef4444` `#10b981` `#eff6ff` |
| LocationDialog.css | `#0ea5e9` `#34d399` `#7dd3fc` |
| InlineAlert.css (DS!) | `#fef2f2` `#991b1b` `#fecaca` etc. (12 hex) |
| ProgressBar.css (DS!) | `#e5e7eb` `#3b82f6` `#10b981` `#f59e0b` `#ef4444` |
| EmptyState.css (DS!) | `#6b7280` `#374151` |
| + 20 autres fichiers | voir scan détaillé |

### 4.2 Z-index hardcodés (27 occurrences, 14 fichiers)

| Fichier | Valeurs | Token cible |
|---------|---------|------------|
| ReservationModal.css | `100` | `var(--z-dropdown)` |
| Calendar.css | `16` `20` `60` | `var(--z-base)` à `var(--z-dropdown)` |
| GoogleCalendarBanner.css | `3` `150` | `var(--z-base)` / `var(--z-sticky)` |
| DepotMapEditor.css | `20` `30` | `var(--z-base)` |
| AddTaskModal.css | `20` | `var(--z-base)` |
| ManagementPanel.css | `9` | `var(--z-base)` |
| PersonnelPanel.css | `0` `3` `15` `20` | `var(--z-base)` |
| AssignmentDialog.css | `55` | `var(--z-dropdown)` |
| LoginForm.css | `10` | `var(--z-base)` |

### 4.3 Border-radius hardcodés (200+, 50+ fichiers)

| Valeur | Token cible | Occurrences |
|--------|-----------|-------------|
| `50%` | `var(--radius-full)` | 60+ |
| `3px` | `var(--radius-xs)` | 30+ |
| `5px` `6px` | `var(--radius-sm)` | 20+ |
| `7px` `8px` | `var(--radius-md)` | 15+ |
| `10px` `12px` | `var(--radius-lg)` | 20+ |
| `14px` `16px` | `var(--radius-xl)` | 35+ |
| `20px` `22px` | `var(--radius-2xl)` | 15+ |

### 4.4 Font-size hardcodés (200+, 40+ fichiers)

| Valeur | Token cible | Fichiers principaux |
|--------|-----------|-------------------|
| `8px` `9px` `0.6rem` `0.65rem` | `var(--font-2xs)` | Mobile, planning |
| `0.7rem` `0.72rem` `0.75rem` | `var(--font-xs)` | 20+ fichiers |
| `0.78rem` `0.82rem` `0.85rem` | `var(--font-sm)` | 25+ fichiers |
| `0.88rem` `0.9rem` `0.95rem` | `var(--font-base)` | 15+ fichiers |
| `1rem` `15px` `17px` | `var(--font-md)` | 10+ fichiers |
| `1.1rem` `1.125rem` `1.2rem` | `var(--font-lg)` | 10+ fichiers |
| `1.25rem` `1.3rem` | `var(--font-xl)` | 8+ fichiers |
| `1.5rem` `1.8rem` `22px` `28px` | `var(--font-2xl)` + | Dashboards, mobile |

### 4.5 Styles inline JSX (200+, 30+ fichiers)

| Fichier | Occurrences | Exemples |
|---------|------------|----------|
| StockPanel.jsx | ~15 | `color: '#f59e0b'`, `marginBottom: 16` |
| ReportsPanel.jsx | ~12 | Couleurs et margins hardcodés |
| PersonnelPanel.jsx | ~10 | Couleurs et dimensions |
| LeavesTab.jsx | ~8 | Couleurs de statut |
| VideoPanel.jsx | ~5 | Layout vidéo |
| + 25 autres fichiers | ~150 | ... |

### 4.6 Classes CSS dupliquées / collisions

| Classe | Fichiers affectés | Risque |
|--------|------------------|--------|
| `.form-group` | **20+ fichiers** (desktop + mobile + modals) | 🔴 CRIT |
| `.modal-header` | **11 fichiers** (chacun le redéfinit) | 🔴 CRIT |
| `.btn-primary` | **11 fichiers** (redéfinitions) | 🔴 CRIT |
| `.active` | 140 usages croisés | 🟠 HIGH |
| `.form-actions` | 24 usages dans 10+ fichiers | 🟠 HIGH |
| `.btn-secondary` | 28 usages dans 8+ fichiers | 🟠 HIGH |
| `.back-button` | 4+ fichiers mobiles + desktop | 🟠 HIGH |
| `.close-button` | Mobile + Modal.css | 🟡 MED |
| `.today-btn` | MobilePersonnel + MobilePlanning | 🟡 MED |
| `.selected` | 40 usages croisés | 🟡 MED |

---

## 5. Analyse par module

### Equipment (3 501 lignes)
- 🔴 Plus gros fichier CSS du projet
- 30+ border-radius, 40+ font-size hardcodés
- `.eq-modal-header/body/footer` : nomenclature custom
- `.eq-toolbar` : toolbar non standard
- Padding modaux : `20px 24px` au lieu de tokens

### Planning (4 691 lignes combinées)
- 🔴 `.task-planning-panel` : 276 usages (classe la plus fréquente)
- `z-index: 20` hardcodé dans AddTaskModal
- Couleur `#ea4335` hardcodée (rouge Google)
- 3 breakpoints différents dans le même module (600px, 640px, 768px)

### Personnel (3 177 lignes combinées)
- 🔴 12 tailles de font différentes dans PersonnelPanel
- 5 z-index hardcodés (0, 3, 15, 20)
- AssignmentDialog : `z-index: 55` hardcodé

### Vehicles (5 817 lignes combinées)
- 🔴 Module CSS le plus volumineux
- Calendar.css : 6 z-index, 4 couleurs hex
- ReservationModal : `z-index: 100`, classes `.form-group` non scopées
- DepotMapEditor : `z-index: 20/30` hardcodés

### Orders (3 297 lignes combinées)
- 🟠 Padding modal `20px 24px` / `1.5rem` hardcodé
- `.stock-modal-header/body` : nomenclature custom

### Affaires (2 909 lignes combinées)
- 🟠 SavImportModal : 5 couleurs hex
- GenerateOrdersModal : `#e67e22`, `#28a745` hardcodés

### DisplayDashboard (3 179 lignes)
- 🔴 `#ecfdf5`, `#ff6600`, `#2ecc40` hardcodées

---

## 6. Analyse Design System (ui/)

### Adoption par composant

| Composant DS | Tokens | Usage projet |
|-------------|--------|-------------|
| Button | ✅ | 98% |
| Input | ✅ | 89% (date/file/radio manquent) |
| Select | ✅ | 99% |
| Textarea | ✅ | 100% |
| Checkbox | ✅ | ~90% |
| Modal | ✅ | ~70% (30% classes custom) |
| Dialog | ✅ | ~60% |
| PageHeader | ✅ | ~40% ⚠️ |
| ModuleLayout | ✅ | ~50% ⚠️ |
| FilterBar | ✅ | ~60% |
| FormLayout | ✅ | ~50% ⚠️ |
| Tabs | ✅ | ~80% |

### Composants DS avec valeurs hardcodées (à corriger en premier)
- ⚠️ **InlineAlert.css** : 12 couleurs hex → tokens
- ⚠️ **ProgressBar.css** : 6 couleurs hex → tokens
- ⚠️ **EmptyState.css** : 2 couleurs hex → tokens

---

## 7. Analyse mobile (18 fichiers, ~7 000 lignes)

### Namespacing

| ✅ Préfixées | 🔴 Non préfixées (collision) |
|-------------|---------------------------|
| `.mobile-app`, `.mobile-affaires` | `.back-button`, `.add-button` |
| `.mobile-equipment-qr`, `.mobile-location` | `.form-group`, `.btn-cancel` |
| `.mobile-messaging`, `.mobile-personnel` | `.btn-submit`, `.screen-header` |
| `.mobile-planning`, `.mobile-tasks` | `.today-btn`, `.close-button` |

### Font-size chaos
- MobilePersonnel : **12 tailles** (`0.65rem` → `1.2rem`)
- MobileLeaves : **13 tailles** (`0.72rem` → `1.1rem`)
- Aucun token `--font-*` utilisé dans les fichiers mobiles
- Aucun token `--space-*` utilisé (padding hardcodé partout)

---

## 8. Analyse TV-client

### apps/tv-client/styles.css — 🔴 CRITIQUE
- **Zéro token CSS** utilisé
- Classes non namespaced : `header`, `main`, `.tab-btn`, `.event-columns`
- Font-sizes en `em` : `3.4em`, `2.5em`, `2.2em`, `1.4em`
- `border-top: 2px solid #00e1ff` hardcodé

### apps/web/src/theme-tv.css — ✅ OK
- Correctement scopé via `[data-palette="tv-display"]`
- Palette dédiée bien définie

---

## 9. Analyse tokens

### Architecture 3 niveaux ✅ SOLIDE

```
3. Composants (Button.css) → var(--btn-primary-bg)
2. Sémantique (tokens.css) → var(--surface-primary)
1. Primitifs  (theme.css)  → var(--theme-primary)
```

### Tokens existants : **complets**
- Spacing (22), Radius (8), Typography (14+), Z-index (10), Shadows (8+), Buttons (4 tailles × 5 variantes), Icons (6), Tables (11), Modals (7), Transitions (4+3)

### Tokens manquants proposés
- `--size-xs/sm/md/lg/xl` (tailles éléments : badges, avatars)
- `--breakpoint-sm/md/lg/xl` (breakpoints unifiés)

---

## 10. Analyse responsive — Breakpoints

| Breakpoint | Occurrences | Fichiers |
|-----------|------------|----------|
| `380px` | 1 | MobileApp |
| `480px` | 12+ | Multiples |
| `500px` | 2 | Rares |
| `560px` | 1 | AssignmentDialog |
| `600px` | 15+ | Multiples |
| `640px` | 18+ | Multiples |
| `700px` | 2 | Rares |
| **`768px`** | **35+** | **Le plus utilisé** |
| `900px` | 6+ | Desktop reflow |
| `1024px` | 7+ | Large desktop |

**Problèmes** : 10 breakpoints au lieu de 4, overlap 600/640px, desktop-first partout.

---

## 11. Analyse modals/dialogs

### Variantes de nommage (10+)

| Pattern | Source |
|---------|--------|
| `.modal-header/body/footer` | Standard (Modal.css) — redéfini dans 11 fichiers |
| `.eq-modal-header/body/footer` | EquipmentPanel |
| `.catalog-modal-header/body/footer` | SupplierCatalog |
| `.stock-modal-header/body` | StockPanel |
| `.qr-modal-header/footer` | QRCodeModal |
| `.assignment-dialog-header/body/footer` | AssignmentDialog |
| `.create-personnel-modal-header` | PersonnelPanel |
| `.affaire-modal-content` | AffaireImportModal |

### Padding incohérent

| Fichier | Header | Body | Conforme |
|---------|--------|------|----------|
| Modal.css (DS) | `var(--space-4) var(--space-5)` | `var(--space-5)` | ✅ Référence |
| OrdersPanel | `20px 24px` | `1.5rem` | ❌ |
| EquipmentPanel | `20px 24px` | `16px` | ❌ |
| VehicleMaintenanceModal | tokens | tokens | ✅ |

---

## 12. Analyse toolbars

### 7+ patterns détectés

| Classe | Module | Standard |
|--------|--------|----------|
| `.ui-module-toolbar` | ModuleLayout.css | ✅ |
| `.ui-page-header-toolbar` | PageHeader.css | ✅ |
| `.eq-toolbar` | EquipmentPanel | ❌ Custom |
| `.orders-toolbar` | OrdersPanel | ❌ Custom |
| `.personnel-toolbar` | PersonnelPanel | ❌ Custom |
| `.annuaire-toolbar` | AnnuairePanel | ❌ Custom |
| `.video-panel__toolbar` | VideoPanel | ❌ Custom |

---

## 13. Analyse headers

| Classe | Source | Standard DS |
|--------|--------|------------|
| `.ui-page-header` | PageHeader.css | ✅ Référence |
| `.panel-header` | SupplierCatalog + | ❌ |
| `.header-stats` | PlanningPanel | ❌ |
| `.header-content` | VehicleDetailsModal | ❌ |
| `.screen-header` | Mobiles (non préfixé) | ❌ Collision |

---

## 14. Plan d'unification CSS

### Header standard
- Hauteur : `var(--header-height)` = 64px
- Padding : `var(--space-4) var(--space-5)`
- Alignement : `display: flex; align-items: center; gap: var(--space-3)`
- Scroll : `position: sticky; top: 0; z-index: var(--z-sticky)`
- Responsive : hauteur auto sous `768px`

### Toolbar standard
- Hauteur : `var(--toolbar-height)` = 56px
- Icônes : `var(--icon-md)` = 18px
- Labels : `var(--font-sm)` = 0.8rem
- Actions : alignement `flex-end` avec `gap: var(--space-2)`
- Stats : `var(--font-xs)` + `var(--text-muted)`
- Responsive : wrap sous `768px`, stack sous `480px`

### Modal/Dialog standard
- Header : `var(--space-4) var(--space-5)`, gradient `var(--modal-header-bg)`
- Footer : `var(--space-3) var(--space-5)`, `border-top: 1px solid var(--border-subtle)`
- Bouton Fermer : 36px × 36px (via `--close-btn-size`)
- Padding body : `var(--space-5)`
- Overflow body : `overflow-y: auto; max-height: var(--modal-max-height)`
- Largeurs : `--modal-width-sm/md/lg/xl`

### Spacing system
- `var(--space-1)` = 4px → `var(--space-24)` = 96px
- **Déjà complet dans theme.css** ✅
- Problème : non utilisé dans 70+ fichiers

### Typographie
- `var(--font-2xs)` = 0.65rem → `var(--font-4xl)` = 2.25rem
- **Déjà complet dans theme.css** ✅
- Problème : non utilisé dans 40+ fichiers

### Couleurs
- Primitives : `var(--theme-primary)` etc.
- Sémantiques : `var(--surface-*)`, `var(--text-*)`, `var(--feedback-*)`
- Tints : `var(--primary-tint-*)`, `var(--accent-tint-*)` etc.
- **Déjà complet** ✅ — non utilisé dans 33+ fichiers

---

## 15. Plan d'action détaillé (12 phases)

| Phase | Nom | Priorité | Effort | Fichiers | Risque visuel |
|-------|-----|----------|--------|----------|--------------|
| U1 | DS tokens purge | P0 | Faible | 3 | Nul |
| U2 | Z-index migration | P1 | Faible | 14 | Nul |
| U3 | Breakpoints unification | P1 | Moyen | 70+ | Moyen |
| U4 | Modals unification | P1 | Moyen | 10+ | Moyen |
| U5 | Toolbars/Headers adoption DS | P2 | Moyen-Élevé | 7+ | Moyen |
| U6 | Border-radius → tokens | P2 | Moyen | 50+ | Faible |
| U7 | Font-size → tokens | P2 | Élevé | 40+ | Élevé |
| U8 | Couleurs → tokens | P2 | Élevé | 33+ | Élevé |
| U9 | Inline styles extraction | P3 | Très élevé | 30+ | Moyen |
| U10 | Collisions namespacing | P2 | Élevé | 20+ | Élevé |
| U11 | Mobile → tokens + namespace | P3 | Élevé | 18 | Moyen |
| U12 | TV-client isolation + tokens | P3 | Moyen | 1 | Faible |

---

## 16. Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|-----------|
| Régression visuelle | Élevée | Élevé | Tests visuels après chaque phase |
| Collision CSS en renommant | Moyenne | Élevé | Grep exhaustif avant renommage |
| Breakpoints cassent responsive | Moyenne | Élevé | Test sur 4 tailles d'écran |
| Modals scroll cassé | Moyenne | Moyen | Test chaque modal |
| Font-size lisibilité | Moyenne | Moyen | Validation comparative |
| Effort total très élevé (72K lignes) | Certaine | Moyen | Phases incrémentales |

---

## 17. Tests visuels à effectuer

| Phase | Tests |
|-------|-------|
| U1 | InlineAlert, ProgressBar, EmptyState |
| U2 | Modals, dropdowns, tooltips (superposition) |
| U3 | 380px, 480px, 768px, 1024px, 1440px |
| U4 | Chaque modal : header/body/footer/scroll |
| U5 | Chaque module : toolbar visible, actions cliquables |
| U6 | Spot-check cards, badges, modals, buttons |
| U7 | Comparaison avant/après chaque module |
| U8 | Comparaison avant/après + dark mode |
| U9 | Dynamique couleurs de statut |
| U10 | Toutes les pages, vérifier pas de style cassé |
| U11 | iPhone/Android réels ou DevTools mobile |
| U12 | Écran TV ou theme-tv actif |

### Tailles d'écran
375px (iPhone SE) · 480px · 768px · 1024px · 1440px · 1920px (TV)

---

## 18. État d'avancement

| Phase | État | Commit |
|-------|------|--------|
| U1 — DS tokens purge | ✅ DONE | `4839820` |
| U2 — Z-index migration | ⬜ TODO | — |
| U3 — Breakpoints unification | ⬜ TODO | — |
| U4 — Modals unification | ⬜ TODO | — |
| U5 — Toolbars/Headers | ⬜ TODO | — |
| U6 — Border-radius tokens | ⬜ TODO | — |
| U7 — Font-size tokens | ⬜ TODO | — |
| U8 — Couleurs tokens | ⬜ TODO | — |
| U9 — Inline styles extraction | ⬜ TODO | — |
| U10 — Collisions namespacing | ⬜ TODO | — |
| U11 — Mobile tokens | ⬜ TODO | — |
| U12 — TV-client isolation | ⬜ TODO | — |
