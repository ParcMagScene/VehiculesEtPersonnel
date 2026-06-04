# Audit UI/UX — eM@g

> **Date** : 4 juin 2026
> **Branche** : `main` (HEAD `3a37d5bb`)
> **Périmètre** : `apps/web/src/` (desktop + mobile React)
> **Méthode** : analyse statique du code (260+ `.jsx`, 158+ `.css`), inspection des tokens, cartographie des modals/boutons/formulaires.
> **Préalable** : un design system canonique existe ([apps/web/src/components/ui/](../../apps/web/src/components/ui), exposé via [@/design-system](../../apps/web/src/design-system/index.js)) avec tokens centralisés ([apps/web/src/design/tokens.css](../../apps/web/src/design/tokens.css)). Le présent audit mesure son **adoption réelle** et liste les écarts.

---

## TL;DR

| Indicateur | Valeur | Verdict |
|---|---|---|
| Adoption `<Button>` (DS) vs `<button>` HTML | ~85 % / 15 % | 🟢 bon |
| Adoption `<Input/Select/Textarea>` (DS) | ~90–95 % | 🟢 bon |
| Couleurs hex hardcodées (hors theme) | 200+ | 🟠 à réduire |
| Styles inline `style={{ color/background }}` | 150+ | 🟠 à réduire |
| Spacings `px;` au lieu de `var(--space-*)` | 200+ | 🟠 à réduire |
| Composants > 2 000 lignes | 6 | 🔴 critique |
| Couche mobile dupliquée | 35 fichiers | 🟠 refactor |
| Breakpoints non canoniques | 4 valeurs distinctes | 🟠 normaliser |
| Modals "maison" `position: fixed; inset: 0` | 0 vrais | 🟢 |

**Verdict global** : les fondations (DS + tokens) sont saines. Les régressions viennent de **5 mega-composants** qui concentrent l'essentiel des écarts, et d'une **couche mobile parallèle** non factorisée.

---

## 1. Cartographie UI/UX

### 1.1 Composants par module

| Module | `.jsx` | `.css` | Composants principaux |
|---|---:|---:|---|
| `components/ui/` | **39** | 30 | source de vérité du DS |
| `components/mobile/` | 35 | 20 | couche mobile parallèle |
| `components/vehicles/` | 24 | 18 | Calendar, ReservationModal, VehicleDetailPanel |
| `components/equipment/` | 21+ | 10+ | EquipmentPanel, EquipmentFormModal |
| `components/personnel/` | 15+ | 8 | PersonnelPanel, AssignmentDialog |
| `components/planning/` | 13 | 8 | TaskPlanningPanel, EventTaskModal |
| `components/affaires/` | 10+ | 10 | AffaireDetailPanel, BLImportModal |
| `components/orders/` | 10+ | 5 | OrdersPanel, StockPanel |
| `components/management/` | 7 | 7 | ManagementPanel, ReportsPanel |
| `components/controles/` | 5 | 3 | ControlsDashboard, ControlPerformModal |

### 1.2 Top des fichiers par taille (complexité)

| Fichier | Lignes | Risque |
|---|---:|---|
| [AffaireDetailPanel.jsx](../../apps/web/src/components/affaires/AffaireDetailPanel.jsx) | ~3 500 | 🔴 mega-component, 5+ modals lazy |
| [EquipmentPanel.jsx](../../apps/web/src/components/equipment/EquipmentPanel.jsx) | ~2 800 | 🔴 10+ modals imbriquées |
| [PersonnelPanel.jsx](../../apps/web/src/components/personnel/PersonnelPanel.jsx) | ~2 500 | 🔴 agenda + modals dans un seul JSX |
| [ManagementPanel.jsx](../../apps/web/src/components/management/ManagementPanel.jsx) | ~2 300 | 🔴 palette 40 couleurs hardcodées |
| [TaskPlanningPanel.jsx](../../apps/web/src/components/planning/TaskPlanningPanel.jsx) | ~2 200 | 🟠 mais déjà extrait (PlanningEventRows, PlanningTaskRow) |
| [OrdersPanel.jsx](../../apps/web/src/components/orders/OrdersPanel.jsx) | ~2 100 | 🔴 4+ dialogs nested |

> **Note** : ces 6 fichiers concentrent à eux seuls la majorité des écarts détectés.

---

## 2. Audit visuel

### 2.1 Palette & couleurs

**Tokens** : ✅ structure 3 niveaux saine (primitifs `theme.css` → sémantiques `tokens.css` → composants).

**Écarts** :

| Source | Fichiers | Exemples concrets |
|---|---|---|
| **Hex hardcodés** | 200+ matches | [ManagementPanel.jsx](../../apps/web/src/components/management/ManagementPanel.jsx) palette de 40 couleurs en JS (L729-775), [ControlsDashboard.css](../../apps/web/src/components/controles/ControlsDashboard.css) `#fef2f2`/`#991b1b` au lieu de `--feedback-error-*`, [PersonnelPanel.css](../../apps/web/src/components/personnel/PersonnelPanel.css) `#9d174d`/`#0d9488` |
| **rgba bruts** | 100+ matches | [EquipmentGrid.jsx](../../apps/web/src/components/equipment/EquipmentGrid.jsx) `rgba(59,130,246,0.18)` ×6, [BLMultiImportModal.jsx](../../apps/web/src/components/affaires/BLMultiImportModal.jsx) 40+ `rgba()` pour statuts |
| **Styles inline** | 150+ instances | [ControlPerformModal.jsx](../../apps/web/src/components/controles/ControlPerformModal.jsx) `style={{ color: '#991b1b', background: '#fee2e2' }}`, [AffaireDashboard.jsx](../../apps/web/src/components/affaires/AffaireDashboard.jsx) `style={{ borderColor: '#3b82f6' }}` |
| **Couleurs Google non tokenisées** | [TaskPlanningPanel.css](../../apps/web/src/components/planning/TaskPlanningPanel.css), [EventTaskModal.css](../../apps/web/src/components/planning/EventTaskModal.css) | `#4285f4`, `#ea4335` répétés |

**Contraste / accessibilité** : non auditable de manière statique sans rendu — à valider avec axe DevTools (cf. § 5).

### 2.2 Typographies

Tokens présents (`--font-xs/sm/base/lg`, `--font-weight-*`). **Problème** : ~30 fichiers utilisent encore `font-size: 0.78rem`, `0.92rem`, `1.05rem` en valeurs brutes (cf. [TaskPlanningPanel.css](../../apps/web/src/components/planning/TaskPlanningPanel.css#L295), [PersonnelPanel.css](../../apps/web/src/components/personnel/PersonnelPanel.css#L1278)) — hiérarchie non garantie.

### 2.3 Espacements

**200+ `px;`** dans CSS hors design-system. Top concentrations : `MailingPanel.css` (70+), `PersonnelPanel.css` (50+), `EquipmentPanel.css` (40+).
Exemples d'incohérence dans le **même contexte fonctionnel** :
- [MailingPanel.css#L29](../../apps/web/src/components/mailing/MailingPanel.css#L29) : `gap: 10px`
- [EventTaskModal.css#L78](../../apps/web/src/components/planning/EventTaskModal.css#L78) : `gap: 4px`
- [Modal.css](../../apps/web/src/components/ui/Modal.css) : mix `var(--space-*)` et `padding: 16px 20px` dans un même fichier (le DS lui-même triche).

### 2.4 Icônes

`lucide-react` adopté partout (✅), tailles cohérentes (12/14/16/18). Une exception : icônes inline custom dans `DisplayDashboard/` (non bloquant — usage TV).

---

## 3. Audit comportemental

### 3.1 Modals

- **Aucune modal "maison"** avec `position: fixed; inset: 0` détectée hors DS — tout passe par `<Modal>`/`<ModalLayout>`/`<Dialog>`. ✅
- **Mais** : usage **incohérent** des deux APIs `<Modal>` (atomique : `Modal + ModalHeader + ModalBody + ModalFooter`) vs `<ModalLayout>` (composite). Ex. [StockPanel.jsx#L431](../../apps/web/src/components/orders/StockPanel.jsx#L431) imbrique `<Modal><ModalLayout>` — double wrapping.
- **`closeOnBackdrop`** : aucune modal ne passe explicitement la prop, donc la valeur par défaut s'applique partout (✅ cohérent, mais à documenter).
- **`onClose`** : pattern systématique ✅.
- **Risque** : 6 mega-components hébergent 5–10 modals lazy chacun → couplage parent/enfant fort, perte de focus management quand on ouvre/ferme rapidement.

### 3.2 Feedback utilisateur

- **Toasts** : `ToastContainer` présent et utilisé ([apps/web/src/components/ToastContainer.jsx](../../apps/web/src/components/ToastContainer.jsx)). ✅
- **Loading** : `Spinner` + `LoadingOverlay` + `Skeleton` exposés par DS, mais **adoption hétérogène** : `MailingPanel`, `OrdersPanel` affichent des spinners ad-hoc.
- **Erreurs** : `InlineAlert` peu utilisé en dehors des formulaires d'auth. Beaucoup de modules affichent les erreurs via `toast.error()` sans contexte champ.

### 3.3 Synchronisation

- **Refresh bus** (`utils/refresh-bus.js`) : pattern propre, utilisé dans Header et plusieurs panels (✅).
- **Mais** : certains panneaux ne s'abonnent pas (`OrdersPanel`, `AffaireDetailPanel`) → l'utilisateur doit recharger la page après une mutation parente.

### 3.4 Hover / active / disabled

Définis dans le DS (`Button.css`, `Input.css`). Les `<button>` HTML bruts (cf. § 6) ne reçoivent **pas** ces états → expérience irrégulière.

---

## 4. Audit structurel

### 4.1 Navigation & terminologie

| Module | Label onglet | Label dans le panel | Cohérence |
|---|---|---|---|
| Vehicles | « Véhicules » | « Véhicules » | ✅ |
| Equipment | « Équipements » | « Équipements / Matériel » mélangé | 🟠 |
| Orders | « Commandes » | « Commandes / Demandes de matériel / Stock » | 🔴 (3 termes pour un onglet) |
| Personnel | « Personnel » | « Personnels / Permanents / Intérimaires » | 🟠 |
| Controles | « Contrôles » | « Contrôles techniques / Contrôles périodiques » | 🟠 |

> Recommandation : extraire un glossaire (`docs/UI-GLOSSARY.md`) pour figer le vocabulaire et brancher sur i18n.

### 4.2 Formulaires

- Adoption `FormField` : ~70 % des formulaires l'utilisent (✅).
- **`aria-describedby` jamais branché** ([apps/web/src/components/ui/FormField.jsx](../../apps/web/src/components/ui/FormField.jsx) ne le génère pas) → les messages d'erreur ne sont pas annoncés au lecteur d'écran.
- **`aria-invalid`** : absent.
- Champs sans label visible identifiés dans [DynamicDisplayDialog.jsx#L254](../../apps/web/src/components/DynamicDisplayDialog.jsx#L254), [ManagementPanel.jsx#L906](../../apps/web/src/components/management/ManagementPanel.jsx#L906).

### 4.3 Tableaux

- Composant `Table` du DS sous-utilisé : la plupart des modules définissent leurs propres `<table>` HTML avec CSS local (`.equipment-table`, `.orders-table`…).
- Pas de pagination unifiée.
- Tri : ad-hoc dans chaque module.

### 4.4 Panneaux / pages

Pas de `PageHeader` du DS systématique. Chaque module a son entête custom (titre + actions). Refactor possible vers `<PageHeader title actions>` exposé déjà par le DS.

---

## 5. Audit responsive

### 5.1 Breakpoints

| Valeur | Occurrences | Statut |
|---|---:|---|
| 480 px | 15+ | exotique |
| 640 px | 25+ | exotique |
| 768 px | 30+ | exotique |
| 900 px | qq | canonique (token `--bp-md`) |
| 1024 px | 10+ | exotique |
| 1200 px | ~5 | canonique (`--bp-lg`) |
| 1600 px | ~2 | canonique (`--bp-xl`) |

> Les tokens canoniques `--bp-sm/md/lg/xl` (600/900/1200/1600) sont définis ([tokens.css#L88](../../apps/web/src/design/tokens.css)) **mais quasi jamais respectés** dans les media queries.

### 5.2 Mobile

- **35 fichiers** dans [components/mobile/](../../apps/web/src/components/mobile/) qui dupliquent partiellement les modules desktop (`MobileAffaires.jsx` ≈ 400 lignes vs `AffairesPanel.jsx` ≈ 3000).
- `MobileSheet.css` réinvente un BottomSheet alors que le DS expose déjà `BottomSheet` ([apps/web/src/components/ui/BottomSheet.jsx](../../apps/web/src/components/ui/BottomSheet.jsx)).
- Cibles tactiles : token `--tap-min: 44px` présent mais peu appliqué (audit visuel à compléter).

### 5.3 Overflows connus

- Calendar véhicules : `width: calc(100% - 10px)` brut.
- AssignmentDialog personnel : badges flexibles non testés < 380 px.
- TaskPlanningPanel colonne « Personnels » 200 px : OK desktop, à valider mobile.

---

## 6. Audit des modules clés

### 6.1 Planning
- 3 modals de tâche/événement ([TaskEditModal](../../apps/web/src/components/planning/TaskEditModal.jsx), [EventDetailsModal](../../apps/web/src/components/planning/EventDetailsModal.jsx), [AddTaskModal](../../apps/web/src/components/planning/AddTaskModal.jsx)) avec headers et champs divergents.
- Banner Google Calendar : alignement avec la grille restauré récemment (commit `fa9153a6`), à surveiller.
- Couleurs Google `#4285f4` / `#ea4335` répétées non tokenisées.

### 6.2 Personnel
- [AssignmentDialog.jsx](../../apps/web/src/components/personnel/AssignmentDialog.jsx) : 12+ couleurs `rgba()` hardcodées pour catégories.
- Bilingue résiduel : label « Prénom » avec placeholder « First name » dans certaines fiches.
- Bouton « Nouveau » désormais visible (ajouté commit `b1ea9603`, à confirmer ergonomiquement).

### 6.3 Véhicules
- [LocationDialog.jsx](../../apps/web/src/components/vehicles/LocationDialog.jsx) et [ReservationModal.jsx](../../apps/web/src/components/vehicles/ReservationModal.jsx) : deux workflows de sélection de lieu différents → unifier sur `EntityCombobox` + `AddressAutocomplete`.
- [Calendar.jsx](../../apps/web/src/components/vehicles/Calendar.jsx) : spacings en px bruts.

### 6.4 Parc / Équipements
- Mega-component [EquipmentPanel.jsx](../../apps/web/src/components/equipment/EquipmentPanel.jsx) : 10+ modals lazy.
- [EquipmentDetail.jsx](../../apps/web/src/components/equipment/EquipmentDetail.jsx) exporte **deux** variantes (`EquipmentDetailDialog` ET `EquipmentSlidePanel`) → ambiguïté pour les consommateurs.
- [CategoryCascadePicker.jsx](../../apps/web/src/components/equipment/CategoryCascadePicker.jsx) : trois `Select` imbriqués sans hiérarchie visuelle.

### 6.5 Affaires
- [AffaireDetailPanel.jsx](../../apps/web/src/components/affaires/AffaireDetailPanel.jsx) : 3 500 lignes, 5+ modals → décomposition prioritaire.
- [BLImportModal.jsx](../../apps/web/src/components/affaires/BLImportModal.jsx) : `style={{ border: \`1px solid ${...}\` }}` (CSS-in-string) → fragile.
- [AffaireDashboard.jsx](../../apps/web/src/components/affaires/AffaireDashboard.jsx) : badges colorés dynamiquement sans fallback.

### 6.6 Commandes / Stock
- [OrdersPanel.jsx](../../apps/web/src/components/orders/OrdersPanel.jsx) : 2 100 lignes, 4 dialogs.
- [OrdersDialogs.jsx](../../apps/web/src/components/orders/OrdersDialogs.jsx) : trois dialogs quasi-identiques (OrderDetail, SupplierOrder, RequestDetail) → factorisable.
- [StockPanel.jsx](../../apps/web/src/components/orders/StockPanel.jsx) : `<Modal><ModalLayout>` (double wrapping).

### 6.7 Contrôles
- [ControlsDashboard.css](../../apps/web/src/components/controles/ControlsDashboard.css) : 12 hex hardcodés pour statuts (à mapper sur `--feedback-*`).
- [ControlPerformModal.jsx](../../apps/web/src/components/controles/ControlPerformModal.jsx) : `style` inline avec couleurs danger.

### 6.8 Imports
- 3 modals d'import distinctes (BLImportModal, PersonnelImportModal, EquipmentImportModal) avec workflows similaires (drop zone + preview + diff + apply) → opportunité de factorisation en `<ImportWizard>` générique.
- [ImportsHubModal.jsx](../../apps/web/src/components/imports/ImportsHubModal.jsx) : onglets stylés comme cartes radio, à clarifier.

### 6.9 Header (vu dans cette session)
- Pastilles d'alerte : style `.module-tab-badge` ajouté ce jour (commit `e95f5f6e`) — à généraliser via un composant `<TabBadge variant="info|late|soon">` plutôt que CSS dans App.css.

---

## 7. Normalisation proposée — Design System eM@g

Le DS existe déjà — l'enjeu est l'**adoption**. Quatre conventions à figer :

### 7.1 Règles d'or

1. **Aucune valeur brute** dans `apps/web/src/components/` hors `ui/` :
   - couleurs → `var(--theme-*)` ou `var(--feedback-*)`
   - espacements → `var(--space-*)`
   - polices → `var(--font-*)`
   - rayons → `var(--radius-*)`
2. **Aucun `<button>` HTML** hors `ui/` (tolérance : éléments visuellement non interactifs).
3. **Aucun `style={{ color/background/borderColor/padding/margin/gap }}` inline** : utiliser des classes CSS.
4. **`@media (min-width: …)`** uniquement avec les valeurs canoniques **600 / 900 / 1200 / 1600** (cf. tokens `--bp-*`).

### 7.2 Composants à introduire / consolider

| Nouveau / consolider | Remplace | Bénéfice |
|---|---|---|
| `<TabBadge variant>` | `.module-tab-badge` ad-hoc, badges divers | Uniformise les pastilles compteurs |
| `<ImportWizard>` | 3 modals d'import dupliquées | Factorise drop-zone + preview + diff |
| `<ColorChip color>` | inline `style={{ background: catColor }}` | API unique pour chips colorées |
| `<DataTable>` (extension de `Table`) | tables HTML custom dans 6+ modules | Tri/filtre/pagination unifiés |
| `<PageHeader>` (déjà DS) | en-têtes custom de chaque module | Adoption à généraliser |

### 7.3 ESLint custom rules à activer

Ajouter dans `apps/web/.eslintrc` :
- `no-restricted-syntax` : interdire `JSXAttribute[name.name='style']` hors `ui/` (warn d'abord, error ensuite).
- `react/forbid-elements` : `[{ element: 'button', message: 'Utiliser <Button> du DS' }]` hors `ui/`.
- Stylelint : `declaration-property-value-disallowed-list` pour `color: /#/`.

---

## 8. Plan d'action priorisé

### P1 — Critique (régressions visibles)

| # | Action | Effort | Fichiers |
|---|---|---|---|
| P1.1 | Sortir la palette des 40 couleurs hardcodées de `ManagementPanel.jsx` vers `tokens.css` | M | [ManagementPanel.jsx#L729-775](../../apps/web/src/components/management/ManagementPanel.jsx) |
| P1.2 | Mapper les hex de `ControlsDashboard.css` sur `--feedback-error/warning/info-*` | S | [ControlsDashboard.css](../../apps/web/src/components/controles/ControlsDashboard.css) |
| P1.3 | Remplacer les `style={{ color: '#991b1b' }}` de [ControlPerformModal.jsx](../../apps/web/src/components/controles/ControlPerformModal.jsx) | S | 1 fichier |
| P1.4 | Corriger le double-wrapping `<Modal><ModalLayout>` de [StockPanel.jsx#L431](../../apps/web/src/components/orders/StockPanel.jsx#L431) | S | 1 fichier |
| P1.5 | Composant `<TabBadge>` dans le DS + migrer `.module-tab-badge` | S | DS + Header.jsx |

### P2 — Normalisation des composants

| # | Action | Effort | Cible |
|---|---|---|---|
| P2.1 | Migrer les 70+ `<button>` HTML restants vers `<Button>` (hors ui/) | M | tous modules |
| P2.2 | Brancher `aria-describedby` + `aria-invalid` dans `FormField` | S | DS |
| P2.3 | Factoriser `OrdersDialogs.jsx` (3 dialogs jumeaux) | M | orders/ |
| P2.4 | Décider entre `EquipmentDetailDialog` et `EquipmentSlidePanel`, supprimer le perdant | M | equipment/ |
| P2.5 | Normaliser placeholders bilingues résiduels | S | personnel/, vehicles/ |

### P3 — Refactorisation UI/UX (mega-components)

| # | Action | Effort | Cible |
|---|---|---|---|
| P3.1 | Découper [AffaireDetailPanel.jsx](../../apps/web/src/components/affaires/AffaireDetailPanel.jsx) (3 500 → 5 fichiers de ≤ 800) | XL | affaires/ |
| P3.2 | Découper [EquipmentPanel.jsx](../../apps/web/src/components/equipment/EquipmentPanel.jsx) (10+ modals lazy → sous-dossier) | L | equipment/ |
| P3.3 | Découper [PersonnelPanel.jsx](../../apps/web/src/components/personnel/PersonnelPanel.jsx) (agenda vs management) | L | personnel/ |
| P3.4 | Extraire `<ImportWizard>` réutilisable | L | imports/, affaires/, personnel/, equipment/ |
| P3.5 | Extraire `<DataTable>` enrichi (tri/filtre/pagination) | L | DS |

### P4 — Responsive

| # | Action | Effort |
|---|---|---|
| P4.1 | Remplacer toutes les media-queries 480/640/768/1024 par 600/900/1200/1600 (script de migration) | M |
| P4.2 | Auditer les cibles tactiles < 44 px sur mobile (axe + manuel) | M |
| P4.3 | Migrer `MobileSheet.css` vers le `BottomSheet` du DS | S |
| P4.4 | Évaluer la suppression progressive de `components/mobile/` au profit de composants responsive | XL |

### P5 — Accessibilité

| # | Action | Effort |
|---|---|---|
| P5.1 | Brancher `aria-describedby` / `aria-invalid` (cf. P2.2) | S |
| P5.2 | Audit axe-core sur les 10 vues principales | M |
| P5.3 | Vérifier le focus-trap des modals (`Modal` du DS le fait déjà ?) | S |
| P5.4 | Passer un check-list contraste WCAG AA sur les badges/pastilles | M |

### P6 — Design System complet

| # | Action | Effort |
|---|---|---|
| P6.1 | Activer les ESLint/Stylelint rules de § 7.3 | S |
| P6.2 | Storybook : compléter `Button.stories`, `Forms.stories`, ajouter Modal/Dialog/Drawer | M |
| P6.3 | Page « Design System » in-app (route `/design-system`) | M |
| P6.4 | `docs/UI-GLOSSARY.md` (terminologie figée) | S |

---

## 9. Mesures continues

À mettre en place pour figer les acquis :

1. **CI** : ajouter un job `npm run lint:css` (Stylelint avec `declaration-property-value-disallowed-list` couleurs hardcodées).
2. **CI** : ajouter un test `tests/no-inline-style.test.js` qui parse le diff et fait échouer un nouveau `style={{ color/background/border|padding|margin|gap }}` hors `components/ui/`.
3. **Métriques** : tracker l'évolution dans `docs/dashboards/ui-debt.md` (compte hex/inline/px par release).

---

## 10. Annexes

- **Tokens** : [apps/web/src/design/tokens.css](../../apps/web/src/design/tokens.css)
- **DS index** : [apps/web/src/design-system/index.js](../../apps/web/src/design-system/index.js)
- **DS source** : [apps/web/src/components/ui/](../../apps/web/src/components/ui/)
- **Spec DS existante** : [docs/05-Specs/design-system.md](./design-system.md)
- **Audits archivés** : [docs/07-Archive/AUDIT_CSS.md](../07-Archive/AUDIT_CSS.md), [docs/07-Archive/AUDIT_MOBILE_UI.md](../07-Archive/AUDIT_MOBILE_UI.md), [docs/07-Archive/AUDIT_COMPLET.md](../07-Archive/AUDIT_COMPLET.md)
