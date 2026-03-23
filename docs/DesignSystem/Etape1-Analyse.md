# 🧩 Étape 1 — Analyse complète de l'interface eM@g

> Date : 23 mars 2026  
> Périmètre : 198 fichiers React, 105 fichiers CSS, 3 cibles UI (Desktop, Mobile, TV)

---

## 📊 Vue d'ensemble du codebase

| Catégorie | Fichiers | % |
|-----------|----------|---|
| Desktop UI | 105 | 59,7% |
| Mobile UI | 26 | 14,8% |
| TV Display | 28 | 15,9% |
| Utils / Hooks | 19+ | 4,0% |
| API Layer | 12 | 6,8% |
| **TOTAL** | **~198** | **100%** |

### Entrées principales
- **Desktop** : `App.jsx` → routage vers les modules principaux
- **Mobile** : `mobile/MobileApp.jsx` → navigation par écran
- **TV** : `DisplayDashboard/DisplayDashboardPanel.jsx` → tabs de configuration

---

## 🧱 Inventaire des composants React

### Par domaine fonctionnel

| Domaine | Fichiers | Composant principal | Taille (lignes) |
|---------|----------|---------------------|------------------|
| Véhicules | 25 | VehicleDetailPanel | ~550 |
| Personnel | 8 | PersonnelPanel | **~2 141** |
| Planning | 9 | PlanningPanel / TaskPlanningPanel | ~280 / ~400 |
| Affaires | 9 | AffairesPanel | **~1 700** |
| Commandes / Stock | 4 | OrdersPanel / StockPanel | ~400 / **~1 767** |
| Équipement | 5 | EquipmentPanel | ~380 |
| Dashboard TV | 22 | DisplayDashboardPanel | ~300 |
| Vidéo | 6 | VideoPanel | ~250 |
| Auth | 6 | LoginForm / MonEspacePanel | ~200 |
| Congés | 4 | LeaveRequestsPanel | ~200 |
| Annuaire | 2 | AnnuairePanel | ~300 |
| Administration | 5 | ManagementPanel | ~350 |
| Messagerie | 1 | MessagingPanel | ~250 |
| Mailing | 1 | MailingPanel | ~200 |
| Inventaire | 1 | InventoryPanel | ~250 |
| Composants UI partagés | 8 | Card, Panel, Table, FormField… | — |
| Header / Navigation | 1 | **Header.jsx** | **~1 138** |

### Conventions de nommage

| Pattern | Rôle | Exemples |
|---------|------|----------|
| `*Panel.jsx` | Conteneur principal de module | PersonnelPanel, AffairesPanel, EquipmentPanel |
| `*Modal.jsx` | Fenêtre modale | ReservationModal, VehicleMaintenanceModal |
| `*Dialog.jsx` | Dialogue de confirmation/sélection | ConfirmDialog, LocationDialog, ClientDialog |
| `*Tab.jsx` | Onglet dans un panel | SkillsTab, PositionsTab, AppearanceTab |
| `*Form*.jsx` | Composant formulaire | LeaveRequestForm, LoginForm |
| `Mobile*.jsx` | Écran mobile | MobileHome, MobileReservations |

---

## 🎨 Analyse CSS

### Fichiers globaux
- `theme.css` — 147+ custom properties (tokens de design)
- `theme-palettes.css` — 6 palettes de couleurs
- `theme-vscode.css` — Palette VS Code
- `App.css` — Styles globaux de l'application
- `index.css` — Reset HTML/body

### Tokens existants (147+)

Le système de tokens est **déjà bien structuré** dans `theme.css` :

| Catégorie | Tokens | Exemples |
|-----------|--------|----------|
| Couleurs primaires | 6 | `--theme-primary`, `--theme-secondary`, `--theme-primary-dark` |
| Couleurs d'état | 4 | `--theme-danger`, `--theme-success`, `--theme-warning`, `--theme-info` |
| Texte | 5 | `--theme-text-primary`, `--theme-text-secondary`, `--theme-text-muted` |
| Backgrounds | 6 | `--theme-bg-page`, `--theme-bg-card`, `--theme-bg-secondary` |
| Bordures | 4 | `--theme-border`, `--theme-border-light`, `--theme-border-focus` |
| Gradients | 4 | `--theme-gradient`, `--theme-gradient-subtle` |
| Typographie | 9 tailles | `--font-2xs` (0.65rem) → `--font-3xl` (1.875rem) |
| Poids | 4 | `--weight-normal` (400) → `--weight-bold` (700) |
| Interlignage | 4 | `--leading-tight` (1.25) → `--leading-relaxed` (1.625) |
| Espacements | 16 | `--space-px` (1px) → `--space-16` (64px) |
| Border-radius | 7 | `--radius-xs` (4px) → `--radius-full` (9999px) |
| Ombres | 7 | `--shadow-xs` → `--shadow-modal` |
| Boutons | 20+ | `--btn-primary-bg`, `--btn-padding`, `--btn-radius` |
| Tables | 10+ | `--table-header-bg`, `--table-row-hover` |
| Transitions | 3 | `--transition-fast` (0.15s), `--transition-normal`, `--transition-smooth` |
| Z-index | 7 | `--z-base` (1) → `--z-tooltip` (9999) |
| Scrollbar | 4 | `--scrollbar-width`, `--scrollbar-thumb` |

### 6 palettes de couleurs

| Palette | Couleur primaire | Esthétique |
|---------|-----------------|------------|
| **default** | `#667eea` (Indigo) | Moderne, dégradé violet |
| **flat-pastel** | `#7b8fb2` (Slate) | Pastels doux |
| **flat-material** | `#1976d2` (Blue) | Material Design |
| **flat-minimal** | `#37474f` (Gray) | Monochrome + rouge |
| **flat-neon-soft** | `#00acc1` (Cyan) | Cyberpunk adouci |
| **flat-warm** | `#bf6530` (Brown) | Terracotta |
| **flat-cold** | `#0277bd` (Steel Blue) | Bleus froids |

### Breakpoints

| Breakpoint | Largeur | Usage |
|------------|---------|-------|
| Mobile S | ≤480px | Petits écrans |
| Mobile | ≤600px | Téléphones |
| Tablet | ≤768px | Tablettes |
| Desktop S | ≤1024px | Laptops |
| Print | `@media print` | Impression |

### Animations (15 keyframes)

`spin`, `pulse`, `bounce`, `slideDown`, `fadeIn`, `slideUp`, `overlayFadeIn`, `modalSlideUp`, `tooltipFadeIn`, `pulse-overdue`, `pulse-reported`, `badge-pulse`, `toast-slide-in`, `csvDialogIn`, `qrModalSlideUp`

---

## 🪟 Modales, Dialogues & Panneaux

### 33 Modales + 8 Dialogues

| Pattern | Nombre | Description |
|---------|--------|-------------|
| **Overlay classique** | 30+ | `.modal-overlay` + backdrop dismiss |
| **Portal (state parent)** | 8 | ConfirmDialog, UnsavedChangesDialog |
| **Slide panel latéral** | 7 | PersonnelDetailPanel, StockSlidePanel… |
| **Inline visibility toggle** | 5+ | VideoPanel, MailingPanel |

**Pattern modal standard (consistant)** :
```jsx
function MyModal({ onClose, onSave, data }) {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Overlay avec onMouseDown backdrop-dismiss
}
```

### 27 Panneaux identifiés

| Catégorie | Layout | Exemples |
|-----------|--------|----------|
| Slide Panel latéral | header + body + footer animé | PersonnelDetailPanel, StockSlidePanel |
| Tab-based | onglets + rendu conditionnel | MailingPanel, InventoryPanel |
| Table + Slide | liste + panneau de détail | AffairesPanel, StockPanel |
| Dashboard Grid | KPI cards + stats | InventoryPanel, DashboardPanel |

---

## 📝 Formulaires & Validation

### 8+ formulaires distincts + modales-formulaires

- **Aucun validateur centralisé** — chaque composant valide en inline
- **FormField.jsx existe** (`components/ui/FormField.jsx`) mais n'est utilisé que dans ~30% des formulaires
- **Pattern de validation** : `if (!field?.trim()) { setError('Requis'); return; }`
- **Pas de contraintes HTML5** (`required`, `pattern`) utilisées

### Patterns de formulaire

| Aspect | État actuel |
|--------|-------------|
| Gestion d'état | `useState()` local (consistant) |
| Validation | Inline, par composant (incohérent) |
| Erreurs | `[error, setError]` (consistant) |
| Loading | `setSaving(true/false)` (consistant) |
| FormField | Utilisé dans 30% des cas |
| Bouton submit | Pas de style unifié |

---

## 📊 Tables

### 20+ implémentations de tables

| Type | Utilisation | Fonctionnalités |
|------|-------------|-----------------|
| `<table>` sémantique hardcodé | 75% | ❌ tri, filtrage manuel, pagination manuelle |
| Composant `ui/Table.jsx` | **~5% (1 usage)** | ✅ columns, data, striped, compact |
| CSS Grid (pseudo-table) | 10% | CameraGrid (vidéo) |

**Ce qui manque** :
- ❌ Aucun tri par clic sur header  
- ❌ Aucun indicateur de direction de tri  
- ❌ Pas de filtrage par colonne  
- ❌ Pas de pagination standardisée  

---

## 🔴 Incohérences identifiées

### 1. Couleurs hardcodées vs tokens

| Problème | Exemple |
|----------|---------|
| 4+ nuances de vert pour "succès" | `#22c55e`, `#10b981`, `#16a34a`, `#059669` |
| 4+ nuances de rouge pour "danger" | `#ef4444`, `#dc2626`, `#b91c1c`, `#991b1b` |
| Couleurs écrites en dur dans les composants | `#3b82f6` dans EntityCombobox.css |
| `#000`/`#fff` au lieu de tokens | Multiples fichiers |

### 2. Border-radius non standard

Valeur `7px` trouvée dans certains composants au lieu du token `--radius-md` (8px).

### 3. Transitions incohérentes

4+ durées différentes (`0.1s`, `0.15s`, `0.2s`, `0.3s`, `0.4s`) au lieu des 3 tokens (`fast`, `normal`, `smooth`).

### 4. Espacements non standards

Valeurs hors-grille observées : `0.35rem`, `0.65rem`, `0.75rem`.

### 5. Box-shadow hardcodées

Certaines ombres sont en dur au lieu d'utiliser les tokens `--shadow-*`.

---

## 🔁 Doublons identifiés

### Critique : 7 Slide Panels quasi-identiques

| Slide Panel | Localisation |
|-------------|-------------|
| VehicleSlidePanel | vehicles/VehicleDetailPanel.jsx |
| PersonnelSlidePanel | personnel/PersonnelDetailPanel.jsx |
| AffaireSlidePanel | affaires/AffaireDetailPanel.jsx |
| StockSlidePanel | orders/StockPanel.jsx |
| EquipmentSlidePanel | equipment/EquipmentPanel.jsx |
| OrderSlidePanel | orders/OrdersPanel.jsx |
| SupplierSlidePanel | orders/OrdersPanel.jsx |

→ **~300 lignes de code dupliquées** au total.

### Modéré : 8+ Form Modals avec même structure

Toutes partagent : overlay, header/body/footer, formState, saving/error state, boutons Cancel/Save.

### Tab implementations réimplémentées

Chaque panel réimplémente ses onglets différemment au lieu d'un composant `Tabs` partagé.

---

## 📏 Composants surdimensionnés

| Composant | Lignes | Responsabilités | Extractions possibles |
|-----------|--------|-----------------|----------------------|
| **PersonnelPanel.jsx** | ~2 141 | 8 responsabilités (liste, planning, agenda, modals…) | PersonFormModal, PersonnelPlanningView, extraction des onglets |
| **StockPanel.jsx** | ~1 767 | 8 sous-composants internes | Déjà mieux décomposé, extraction possible |
| **AffairesPanel.jsx** | ~1 700 | 7 responsabilités (liste, Google Calendar, timeline, BL…) | AffaireTimeline, meilleure utilisation BLBatchAnalysis |
| **Header.jsx** | ~1 138 | 11 responsabilités | HeaderNotifications, HeaderUserMenu, HeaderModuleButtons |

---

## 🔍 Composants potentiellement inutilisés

| Composant | Statut | Note |
|-----------|--------|------|
| GoogleCalendarBanner.jsx | Chargé en lazy mais possiblement jamais rendu | À vérifier |
| SectionHeader.jsx (ui/) | Exporté, jamais importé | Candidat suppression |
| ScrollArea.jsx (ui/) | Probablement non utilisé | À vérifier |
| EntityCombobox.jsx (ui/) | 1 seul usage, alternatives custom ailleurs | Sous-utilisé |

---

## 🔘 Boutons : absence de composant partagé

### État actuel : 200+ `<button>` bruts

- **Aucun composant `<Button>` partagé**
- 15+ variantes de classes : `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-approve`, `.btn-danger`, `.rp-btn`, `.tem-btn`, `.mailing-btn`, `.eq-btn`…
- Certains boutons utilisent des styles inline
- États disabled/loading non uniformisés

---

## ✅ Points forts existants

| Aspect | Évaluation |
|--------|------------|
| Organisation par domaine | ✅ Claire et cohérente |
| Naming conventions (Panel, Modal, Tab, Dialog) | ✅ Consistante |
| CSS colocation (*.jsx ↔ *.css pairs) | ✅ Bonne pratique |
| Custom hooks library (19+) | ✅ Réutilisation efficace |
| API layer modulaire (12 modules) | ✅ Bien séparé |
| Système de thème (147+ tokens) | ✅ Fondation solide |
| 6 palettes + mode sombre | ✅ Flexible |
| ConfirmDialog réutilisé (18 usages) | ✅ Bon pattern de référence |
| Pattern modal consistant (onClose, overlay, backdrop) | ✅ Bonne base |
| Z-index scale structuré | ✅ Bien défini |

---

## 📌 Priorités de consolidation (pour les étapes suivantes)

| Priorité | Action | Impact |
|----------|--------|--------|
| 🔴 P1 | Créer `<Button>` unifié avec variantes | 200+ boutons, cohérence globale |
| 🔴 P1 | Extraire `<SlidePanel>` générique | 7 implémentations dupliquées |
| 🟠 P2 | Étendre adoption de `FormField` à 100% | 70% des formulaires à migrer |
| 🟠 P2 | Créer composant `<Tabs>` partagé | Chaque panel réimplémente les onglets |
| 🟠 P2 | Utiliser `ui/Table.jsx` partout | 95% des tables à migrer |
| 🟡 P3 | Décomposer Header.jsx (<1 138 lignes) | 3 sous-composants à extraire |
| 🟡 P3 | Décomposer PersonnelPanel.jsx (~2 141 lignes) | 3-4 vues à extraire |
| 🟡 P3 | Remplacer couleurs hardcodées par tokens | Cohérence thème |
| 🟢 P4 | Centraliser la validation formulaires | `useFormValidation()` hook |
| 🟢 P4 | Supprimer composants inutilisés | SectionHeader, ScrollArea… |

---

## 🔜 Prochaine étape

> **Étape 2 — Proposition de tokens de design**  
> Sur la base de cette analyse, proposer une base unifiée de tokens couvrant : couleurs, typographie, espacements, radius/ombres, icônes.  
> Les tokens existants dans `theme.css` seront la fondation — l'objectif est de combler les lacunes et standardiser les valeurs incohérentes.

**En attente de votre validation avant de continuer.**
