# 🎨 DESIGN SYSTEM eM@g — Spécification Complète

> **Date** : 15 avril 2026
> **Branche** : `feature/sonos-full-gui`
> **Objectif** : Cartographie exhaustive du Design System existant + identification des lacunes

---

## TABLE DES MATIÈRES

1. [Architecture du Design System](#1-architecture-du-design-system)
2. [Tokens de design — Inventaire complet](#2-tokens-de-design--inventaire-complet)
3. [Composants — Catalogue](#3-composants--catalogue)
4. [Système de thèmes & palettes](#4-système-de-thèmes--palettes)
5. [Typographie](#5-typographie)
6. [Espacement (Spacing)](#6-espacement-spacing)
7. [Couleurs & sémantique](#7-couleurs--sémantique)
8. [Ombres, rayons, z-index](#8-ombres-rayons-z-index)
9. [Animations & transitions](#9-animations--transitions)
10. [Utilitaires CSS](#10-utilitaires-css)
11. [Responsive & breakpoints](#11-responsive--breakpoints)
12. [Patterns d'usage dans les features](#12-patterns-dusage-dans-les-features)
13. [Lacunes identifiées](#13-lacunes-identifiées)
14. [Matrice d'adoption](#14-matrice-dadoption)
15. [Score & synthèse](#15-score--synthèse)

---

## 1. ARCHITECTURE DU DESIGN SYSTEM

### 1.1 Structure des fichiers

```
apps/web/src/
├── theme.css                    ← Primitifs (couleurs, espacement, typo, ombres, boutons)
├── theme-palettes.css           ← 10 palettes thématiques
├── theme-density.css            ← Variantes compact / normal
├── index.css                    ← Reset global, scrollbars, curseurs
├── design/
│   ├── tokens.css               ← Tokens sémantiques (surfaces, textes, feedback, layouts)
│   └── utilities.css            ← Classes utilitaires (u-flex, u-gap-*, u-text-*, u-font-*)
├── design-system/
│   └── index.js                 ← Barrel export unique (point d'entrée)
├── components/ui/
│   ├── Button.jsx / Button.css
│   ├── Input.jsx / Input.css
│   ├── Modal.jsx / Modal.css
│   ├── ui.css                   ← Card, Panel, ScrollArea, SectionHeader, FormLayout, Table
│   └── ... (35+ composants)
└── hooks/
    └── useTheme.js              ← Hook de gestion light/dark + palette + densité
```

### 1.2 Architecture à 3 niveaux

| Niveau | Fichier | Rôle | Exemple |
|--------|---------|------|---------|
| **1. Primitifs** | `theme.css` | Valeurs brutes | `--space-4: 16px`, `--font-base: 0.875rem` |
| **2. Sémantique** | `design/tokens.css` | Abstraction contextuelle | `--surface-primary: var(--theme-bg-card)` |
| **3. Composants** | `Button.css`, etc. | Variables spécifiques composant | `--btn-primary-bg: var(--theme-gradient)` |

### 1.3 Flux d'application des thèmes

```
html[data-theme="light|dark"][data-palette="flat-pastel|..."][data-density="normal|compact"]
    ↓
:root → [data-theme="dark"] → [data-palette="..."] → [data-density="compact"]
    ↓
Composants .ui-* + var(--token)
```

---

## 2. TOKENS DE DESIGN — INVENTAIRE COMPLET

### 2.1 Couleurs primitives

| Variable | Light | Dark | Usage |
|----------|-------|------|-------|
| `--theme-primary` | `#667eea` | `#818cf8` | Actions principales |
| `--theme-secondary` | `#764ba2` | `#a78bfa` | Actions secondaires |
| `--theme-accent` | `#a855f7` | `#c084fc` | Accentuation |
| `--theme-indigo` | `#6366f1` | `#818cf8` | Badges, liens |
| `--theme-danger` | `#ef4444` | `#ef4444` | Erreurs, suppressions |
| `--theme-success` | `#22c55e` | `#10b981` | Validations, succès |
| `--theme-warning` | `#f59e0b` | `#f59e0b` | Alertes |
| `--theme-info` | `#3b82f6` | `#3b82f6` | Informations |

### 2.2 Dégradés

```css
--theme-gradient:          linear-gradient(135deg, #667eea 0%, #764ba2 100%)
--theme-gradient-reverse:  linear-gradient(135deg, #764ba2 0%, #667eea 100%)
--theme-gradient-subtle:   linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%)
--theme-gradient-alt:      linear-gradient(135deg, #6366f1, #8b5cf6)
```

### 2.3 Surfaces (fond)

| Variable | Light | Usage |
|----------|-------|-------|
| `--theme-bg-page` | `#f8fafc` | Fond de page |
| `--theme-bg-card` | `white` | Cartes, panels |
| `--theme-bg-card-translucent` | `rgba(255,255,255,0.95)` | Cartes semi-transparentes |
| `--theme-bg-secondary` | `#f9fafb` | Fond secondaire |
| `--theme-bg-tertiary` | `#f3f4f6` | Fond tertiaire |
| `--theme-bg-dark` | `#1f2937` | Fond sombre |
| `--theme-bg-darker` | `#111827` | Fond très sombre |
| `--theme-bg-hover` | `#eef2ff` | Survol |
| `--theme-bg-active` | `#e0e7ff` | État actif |
| `--theme-bg-selected` | `#eef2ff` | Sélection |
| `--theme-bg-code` | `#f1f5f9` | Blocs de code |
| `--theme-bg-muted` | `#cbd5e1` | Fond atténué |

### 2.4 Textes

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--theme-text-heading` | `#111827` | Titres |
| `--theme-text-body` | `#374151` | Corps de texte |
| `--theme-text-primary` | `#1e293b` | Texte principal |
| `--theme-text-secondary` | `#64748b` | Texte secondaire |
| `--theme-text-muted` | `#94a3b8` | Texte atténué |
| `--theme-text-subtle` | `#475569` | Texte subtil |
| `--theme-text-gray` | `#6b7280` | Texte gris |
| `--theme-text-inverse` | `#ffffff` | Texte sur fond sombre |
| `--theme-text-disabled` | `#9ca3b8` | Texte désactivé |
| `--theme-text-link` | `var(--theme-primary)` | Liens |

### 2.5 Bordures

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--theme-border` | `#e2e8f0` | Bordure par défaut |
| `--theme-border-light` | `#f1f5f9` | Subtile |
| `--theme-border-medium` | `#e5e7eb` | Moyenne |
| `--theme-border-muted` | `#d1d5db` | Atténuée |
| `--theme-border-focus` | `#8b5cf6` | Focus |
| `--theme-border-disabled` | `#e5e7eb` | Désactivé |

### 2.6 Overlays & Glass

```css
/* Glass (white overlays) */
--glass-subtle:      rgba(255,255,255, 0.1)
--glass-light:       rgba(255,255,255, 0.2)
--glass-medium:      rgba(255,255,255, 0.35)
--glass:             rgba(255,255,255, 0.4)
--glass-heavy:       rgba(255,255,255, 0.5)
--glass-strong:      rgba(255,255,255, 0.6)
--glass-opaque:      rgba(255,255,255, 0.7)
--glass-bright:      rgba(255,255,255, 0.8)

/* Dark overlays */
--overlay-subtle → --overlay-opaque   (0.03 → 0.85)

/* Primary tints */
--primary-tint-faint → --primary-tint-bold   (0.04 → 0.4)

/* Accent tints */
--accent-tint-muted → --accent-tint-bold     (0.03 → 0.4)

/* Status tints */
--success-tint-subtle → --success-tint-bold   (0.06 → 0.4)
--danger-tint-light → --danger-tint-strong    (0.12 → 0.5)
--warning-tint-light → --warning-tint-medium  (0.1 → 0.3)
```

### 2.7 Tokens sémantiques (design/tokens.css)

| Catégorie | Variables | Mapping |
|-----------|-----------|---------|
| **Surfaces** | `--surface-page`, `--surface-primary`, `--surface-secondary`, `--surface-tertiary`, `--surface-elevated`, `--surface-overlay`, `--surface-active`, `--surface-selected`, `--surface-hover`, `--surface-code` | → `var(--theme-bg-*)` |
| **Feedback** | `--feedback-{success,error,warning,info}`, chacune avec `-bg`, `-text`, `-border` | → `var(--theme-{success,danger,warning,info}-*)` |
| **Entités** | `--entity-{client,supplier,prestataire,sous-traitant}-{bg,text}` | Couleurs hardcodées par type |
| **Status** | `--status-{success,danger,warning,info,pending,neutral}` | Couleurs sémantiques globales |

---

## 3. COMPOSANTS — CATALOGUE

### 3.1 Inventaire complet (44 composants)

#### Atomes (16)

| Composant | Props clés | CSS dédié | Tests |
|-----------|-----------|-----------|-------|
| **Button** | `variant` (6), `size` (4), `loading`, `iconOnly` | ✅ Button.css | ✅ 10 tests |
| **Input** | `size` (3), `error`, `prefix`, `suffix` | ✅ Input.css | ✅ 18 tests |
| **Textarea** | `error`, `rows`, `resize` | via Input.css | ✅ 9 tests |
| **Select** | `size`, `error`, `options` | via Input.css | ✅ 19 tests |
| **Checkbox** | `checked`, `indeterminate`, `disabled` | ✅ Checkbox.css | ✅ 11 tests |
| **Toggle** | `checked`, `disabled`, `size` | via Checkbox.css | ✅ (avec Checkbox) |
| **Tag** | `variant`, `closable`, `size` | ✅ Tag.css | ✅ 17 tests |
| **Badge** | `variant`, `dot`, `count` | via Tag.css | ✅ (avec Tag) |
| **StatusBadge** | `status`, `size`, `pulse` | ✅ StatusBadge.css | ✅ 7 tests |
| **Avatar** | `src`, `name`, `size`, `initials` | ✅ Avatar.css | ✅ 5 tests |
| **Tooltip** | `content`, `placement`, `delay` | ✅ Tooltip.css | ✅ 9 tests |
| **Spinner** | `size`, `color` | ✅ Spinner.css | ✅ (avec Loader) |
| **LoadingOverlay** | `visible`, `text` | via Spinner.css | ✅ 11 tests |
| **ProgressBar** | `value`, `max`, `variant`, `animated` | ✅ ProgressBar.css | ✅ 13 tests |
| **EmptyState** | `icon`, `title`, `description`, `action` | ✅ EmptyState.css | ✅ 5 tests |
| **InlineAlert** | `variant`, `dismissible`, `icon` | ✅ InlineAlert.css | ✅ 8 tests |

#### Molécules (7)

| Composant | Props clés | CSS dédié | Tests |
|-----------|-----------|-----------|-------|
| **DropdownMenu** | `items`, `trigger`, `placement` | ✅ DropdownMenu.css | ✅ 9 tests |
| **Tabs** | `items`, `activeKey`, `onChange` | ✅ Tabs.css | ✅ 9 tests |
| **Accordion** | `items`, `multiple`, `defaultOpen` | ✅ Accordion.css | ✅ 10 tests |
| **Divider** | `orientation`, `label` | via ui.css | ✅ 6 tests |
| **SearchBar** | `value`, `onChange`, `placeholder`, `debounce` | ✅ SearchBar.css | ✅ 6 tests |
| **FilterBar** | `filters`, `values`, `onChange` | via ui.css | ✅ 8 tests |
| **ListItem** | `title`, `subtitle`, `prefix`, `suffix`, `active` | via ui.css | ✅ 10 tests |
| **EntityCombobox** | `items`, `value`, `onChange`, `renderItem` | ✅ EntityCombobox.css | ✅ 11 tests |

#### Organismes (6)

| Composant | Props clés | CSS dédié | Tests |
|-----------|-----------|-----------|-------|
| **Modal** | `open`, `onClose`, `size` (5), sous-composants: `ModalHeader`, `ModalBody`, `ModalFooter` | ✅ Modal.css | ✅ 13 tests |
| **Dialog** | `open`, `onConfirm`, `onCancel`, `variant` | via Modal.css | ✅ 10 tests |
| **Drawer** | `open`, `onClose`, `position`, `size` | ✅ Drawer.css | ✅ 8 tests |
| **PageHeader** | `title`, `subtitle`, `breadcrumbs`, `actions` | via ui.css | ✅ 10 tests |
| **FormLayout** | `onSubmit`, sous-composants: `FormSection`, `FormRow`, `FormActions` | via ui.css | ✅ 12 tests |
| **ModuleLayout** | `header`, `sidebar`, `content` / `ModuleContent` | via ui.css | ✅ 10 tests |

#### Layout (7)

| Composant | Props clés | CSS dédié | Tests |
|-----------|-----------|-----------|-------|
| **Card** | `flat`, `compact`, `onClick` | via ui.css | ✅ 11 tests |
| **Panel** | `title`, `collapsible`, `defaultOpen` | via ui.css | ✅ 8 tests |
| **SectionHeader** | `title`, `subtitle`, `action` | via ui.css | ✅ 8 tests |
| **Table** | `columns`, `data`, `striped`, `compact`, `maxHeight`, `onRowClick` | via ui.css | ✅ 20 tests |
| **ScrollArea** | `maxHeight`, `direction` | via ui.css | ✅ 9 tests |
| **FormField** | `label`, `error`, `required`, `hint` | via ui.css | ✅ 10 tests |
| **DetailRow** | `label`, `value`, `copyable` | via ui.css | ✅ 6 tests |

### 3.2 Résumé

| Métrique | Valeur |
|----------|--------|
| Total composants DS | **44** |
| Tests unitaires | **355 tests / 34 suites** |
| Couverture DS | **100%** (34/34 composants avec JSX testés) |
| Variants Button | 6 (primary, secondary, danger, success, warning, ghost) |
| Sizes communs | 4 (xs, sm, md, lg) |
| CSS dédiés | 15 fichiers + 1 ui.css partagé |

---

## 4. SYSTÈME DE THÈMES & PALETTES

### 4.1 Hook `useTheme`

```javascript
const {
  theme,       // 'light' | 'dark'
  palette,     // 'default' | 'flat-pastel' | ...
  density,     // 'normal' | 'compact'
  isDark,      // boolean helper
  isCompact,   // boolean helper
  toggleTheme, // () => void
  setTheme,    // (t: string) => void
  setPalette,  // (p: string) => void
  setDensity,  // (d: string) => void
} = useTheme();
```

| Axe | Stockage | Attribut HTML |
|-----|----------|---------------|
| theme | `localStorage('emag-theme')` | `data-theme="light\|dark"` |
| palette | `localStorage('emag-palette')` | `data-palette="flat-pastel\|..."` |
| density | `localStorage('emag-density')` | `data-density="normal\|compact"` |

### 4.2 Palettes disponibles (10)

| # | Palette | Description | Accent |
|---|---------|-------------|--------|
| 1 | **default** | Violet classique eM@g | `#667eea` / `#764ba2` |
| 2 | **flat-pastel** | Tons doux et chaleureux | Pastel |
| 3 | **flat-material** | Google Material Design | Material |
| 4 | **flat-minimal** | Monochrome épuré, accent rouge | Rouge |
| 5 | **flat-neon-soft** | Cyberpunk adouci | Néon |
| 6 | **flat-warm** | Terracotta et tons chauds | Chaud |
| 7 | **flat-cold** | Acier bleu, tons froids | Froid |
| 8 | **vscode-dark** | Thème VS Code sombre | VS Code |
| 9 | **vscode-light** | Thème VS Code clair | VS Code |
| 10 | **tv-display** | Contraste élevé pour écrans distants | Cyan |

### 4.3 Mode densité

| Mode | Effet |
|------|-------|
| `normal` | Padding et espacement standards |
| `compact` | Padding réduit, espacement diminué, hauteurs réduites |

---

## 5. TYPOGRAPHIE

### 5.1 Échelle de tailles

| Token | Valeur | ~px @ 14px base | Usage typique |
|-------|--------|-----------------|---------------|
| `--font-2xs` | `0.65rem` | 9px | Labels très petits |
| `--font-xs` | `0.72rem` | 10px | Captions, timestamps |
| `--font-sm` | `0.8rem` | 11px | Labels, secondary text |
| `--font-base` | `0.875rem` | **12px — DÉFAUT** | Corps de texte |
| `--font-md` | `1rem` | 14px | Titres de section |
| `--font-lg` | `1.125rem` | 16px | Titres de panel |
| `--font-xl` | `1.25rem` | 18px | Titres de page |
| `--font-2xl` | `1.5rem` | 21px | Gros titres |
| `--font-3xl` | `1.875rem` | 26px | Headers |
| `--font-4xl` | `2.25rem` | 32px | Hero |

### 5.2 Poids

| Token | Valeur | Usage |
|-------|--------|-------|
| `--weight-normal` | 400 | Corps de texte |
| `--weight-medium` | 500 | Labels, sous-titres |
| `--weight-semibold` | 600 | Boutons, headers de table |
| `--weight-bold` | 700 | Titres, accentuation |

### 5.3 Hauteur de ligne & espacement

| Token | Valeur |
|-------|--------|
| `--leading-tight` | 1.25 |
| `--leading-snug` | 1.375 |
| `--leading-normal` | **1.5** (défaut) |
| `--leading-relaxed` | 1.625 |
| `--tracking-tight` | -0.025em |
| `--tracking-snug` | -0.015em |
| `--tracking-normal` | 0 (défaut) |
| `--tracking-wide` | 0.05em |
| `--tracking-wider` | 0.1em |

### 5.4 Police

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
/* Monospace */
font-family: 'SF Mono', 'Monaco', 'Fira Code', monospace;
```

---

## 6. ESPACEMENT (SPACING)

### 6.1 Échelle complète

| Token | Valeur | Usage typique |
|-------|--------|---------------|
| `--space-0` | 0 | Reset |
| `--space-px` | 1px | Bordures fines |
| `--space-0-5` | 2px | Micro-espace |
| `--space-1` | 4px | Padding icônes |
| `--space-1-5` | 6px | Gaps serrés |
| `--space-2` | 8px | Padding compact |
| `--space-2-5` | 10px | — |
| `--space-3` | 12px | Padding standard petit |
| `--space-3-5` | 14px | — |
| `--space-4` | **16px** | Padding standard |
| `--space-5` | 20px | Gap moyen |
| `--space-6` | **24px** | Gap section, padding page |
| `--space-7` | 28px | — |
| `--space-8` | 32px | Gap large |
| `--space-9` | 36px | — |
| `--space-10` | 40px | Gap très large |
| `--space-12` | 48px | — |
| `--space-14` | 56px | — |
| `--space-16` | 64px | Espacement page |
| `--space-20` | 80px | — |
| `--space-24` | 96px | — |

### 6.2 Tokens de layout

| Token | Valeur | Usage |
|-------|--------|-------|
| `--page-padding` | `var(--space-6)` (24px) | Padding de page desktop |
| `--page-padding-mobile` | `var(--space-4)` (16px) | Padding de page mobile |
| `--section-gap` | `var(--space-6)` | Gap entre sections |
| `--content-max-width` | 1400px | Largeur max contenu |
| `--sidebar-width` | 280px | Barre latérale |
| `--toolbar-height` | 56px | Toolbars |
| `--header-height` | 64px | Header principal |

---

## 7. COULEURS & SÉMANTIQUE

### 7.1 Feedback (4 variantes × 4 props)

| Contexte | Couleur | Background | Texte | Bordure |
|----------|---------|------------|-------|---------|
| **Success** | `--feedback-success` | `--feedback-success-bg` | `--feedback-success-text` | `--feedback-success-border` |
| **Error** | `--feedback-error` | `--feedback-error-bg` | `--feedback-error-text` | `--feedback-error-border` |
| **Warning** | `--feedback-warning` | `--feedback-warning-bg` | `--feedback-warning-text` | `--feedback-warning-border` |
| **Info** | `--feedback-info` | `--feedback-info-bg` | `--feedback-info-text` | `--feedback-info-border` |

### 7.2 Entités métier

| Entité | Background | Texte |
|--------|------------|-------|
| Client | `#dbeafe` | `#1d4ed8` |
| Fournisseur | `#d1fae5` | `#047857` |
| Prestataire | `#ede9fe` | `#6d28d9` |
| Sous-traitant | `#fce7f3` | `#9d174d` |

### 7.3 Couleurs de boutons (5 variantes complètes)

| Variante | Background | Couleur | Bordure | Hover |
|----------|------------|---------|---------|-------|
| **primary** | Gradient | white | — | Shadow accrue |
| **secondary** | `#f3f4f6` | `#374151` | `1px #e5e7eb` | `#e5e7eb` |
| **danger** | `#fee2e2` | `#dc2626` | `2px #fca5a5` | `#fecaca` |
| **success** | `#d1fae5` | `#059669` | `2px #86efac` | `#a7f3d0` |
| **warning** | `#fef3c7` | `#d97706` | `2px #fde68a` | `#fde68a` |

---

## 8. OMBRES, RAYONS, Z-INDEX

### 8.1 Ombres

| Token | Valeur | Usage |
|-------|--------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | Boutons plats |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | Cartes au repos |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | Cartes survolées |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.12)` | Dropdowns, panels |
| `--shadow-xl` | `0 12px 40px rgba(0,0,0,0.15)` | Éléments flottants |
| `--shadow-inner` | `inset 0 2px 4px rgba(0,0,0,0.06)` | Inputs pressés |
| `--shadow-dropdown` | `0 4px 16px rgba(0,0,0,0.12)` | Menus déroulants |
| `--shadow-toast` | `0 8px 30px rgba(0,0,0,0.18)` | Notifications |
| `--shadow-card` | `0 2px 8px rgba(0,0,0,0.08)` | Cartes standard |
| `--shadow-modal` | `0 20px 60px rgba(0,0,0,0.25)` | Modales |
| `--shadow-hover` | `0 4px 16px rgba(102,126,234,0.2)` | Hover accent |

### 8.2 Border Radius

| Token | Valeur | Usage |
|-------|--------|-------|
| `--radius-xs` | 4px | Badges, petits éléments |
| `--radius-sm` | 6px | — |
| `--radius-md` | **8px** | Inputs, selects, boutons |
| `--radius-md-lg` | 10px | — |
| `--radius-lg` | **12px** | Cartes, panels |
| `--radius-xl` | **16px** | Modales, dropdowns |
| `--radius-2xl` | 20px | Grands containers |
| `--radius-full` | 9999px | Avatars, badges ronds |

### 8.3 Z-Index

| Token | Valeur | Usage |
|-------|--------|-------|
| `--z-base` | 1 | Éléments de base |
| `--z-dropdown` | 100 | Menus déroulants |
| `--z-sticky` | 200 | Headers sticky |
| `--z-overlay` | 1000 | Overlays génériques |
| `--z-modal` | 2000 | Modales |
| `--z-modal-nested` | 2500 | Modales imbriquées |
| `--z-popover` | 3000 | Popovers |
| `--z-draggable` | 4000 | Éléments draggables |
| `--z-toast` | 5000 | Notifications toast |
| `--z-tooltip` | 9999 | Tooltips |

**Anomalies détectées** (hors tokens) :
- `AnnuairePanel.css` : `z-index: 20` (devrait être `var(--z-dropdown)`)
- `App.css` : `z-index: 25` (valeur orpheline)
- `MobileApp.css` : `z-index: 100` (devrait être `var(--z-dropdown)`)

---

## 9. ANIMATIONS & TRANSITIONS

### 9.1 Durées

| Token | Valeur | Usage |
|-------|--------|-------|
| `--duration-fast` | 150ms | Hover, toggle |
| `--duration-normal` | 200ms | Transitions standard |
| `--duration-smooth` | 300ms | Ouverture panels |
| `--duration-slow` | 400ms | Modales, transitions longues |

### 9.2 Transitions prédéfinies

| Token | Valeur |
|-------|--------|
| `--transition-fast` | `0.15s ease` |
| `--transition-normal` | `0.2s ease` |
| `--transition-smooth` | `0.3s cubic-bezier(0.4, 0, 0.2, 1)` |
| `--transition-slow` | `0.4s cubic-bezier(0.4, 0, 0.2, 1)` |

### 9.3 Easing

| Token | Valeur | Type |
|-------|--------|------|
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard Material |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Décélération |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Rebond |

### 9.4 Focus ring

```css
--focus-ring:    0 0 0 3px rgba(102,126,234, 0.15)
--focus-border:  var(--theme-border-focus)
```

### 9.5 Keyframes définis

| Animation | Usage | Fichier |
|-----------|-------|---------|
| `ui-modal-fade-in` | Overlay modal | Modal.css |
| `ui-modal-slide-up` | Contenu modal | Modal.css |

---

## 10. UTILITAIRES CSS

### 10.1 Classes disponibles (design/utilities.css)

| Catégorie | Classes | Exemple |
|-----------|---------|---------|
| **Flexbox** | `u-flex`, `u-flex-center`, `u-flex-between`, `u-flex-col`, `u-flex-wrap` | `<div className="u-flex u-flex-between">` |
| **Gap** | `u-gap-1`, `u-gap-2`, `u-gap-3`, `u-gap-4`, `u-gap-6`, `u-gap-8` | `<div className="u-flex u-gap-4">` |
| **Alignement** | `u-items-center`, `u-items-start`, `u-items-end` | — |
| **Justification** | `u-justify-center`, `u-justify-end`, `u-justify-between` | — |
| **Texte** | `u-text-center`, `u-text-right`, `u-text-left`, `u-text-muted`, `u-text-secondary`, `u-text-success`, `u-text-danger`, `u-text-warning`, `u-text-info` | — |
| **Typographie** | `u-font-xs`, `u-font-sm`, `u-font-base`, `u-font-md`, `u-font-lg`, `u-font-bold` | — |

### 10.2 Classes manquantes (patterns répétés dans le code sans utilitaire)

| Pattern trouvé dans le code | Classe utilitaire absente |
|-----------------------------|---------------------------|
| `display: grid` | `u-grid` |
| `overflow: hidden` | `u-overflow-hidden` |
| `position: relative` | `u-relative` |
| `white-space: nowrap` | `u-nowrap` |
| `text-overflow: ellipsis` | `u-truncate` |
| `width: 100%` | `u-full-width` |
| `margin: 0 auto` | `u-mx-auto` |
| `opacity: 0.6` | `u-opacity-muted` |
| `cursor: pointer` | `u-pointer` |

---

## 11. RESPONSIVE & BREAKPOINTS

### 11.1 Breakpoints (conventions, pas de CSS variables)

| Nom | Valeur | Cible |
|-----|--------|-------|
| xs | 480px | Mobile petit |
| sm | 640px | Mobile grand |
| md | 768px | Tablette portrait |
| lg | 1024px | Tablette paysage / desktop petit |
| xl | 1200px | Desktop large |

**Exception** : MobileApp → `380px` (ultra-petit)

### 11.2 Patterns responsives

| Breakpoint | Comportement |
|------------|-------------|
| `≤ 768px` | SplitLayout → stack vertical, sidebar ≤ 40vh |
| `≤ 640px` | Drawers full-width, grilles → 1 colonne, FormActions stackées |
| `≤ 480px` | Paddings réduits, toasts bottom-center, font-size réduites |

### 11.3 Constats

- Les breakpoints ne sont pas définis comme CSS custom properties (limitation CSS : `@media` ne supporte pas `var()`)
- Chaque composant défintnt ses propres `@media` — pas de mixin/abstraction
- Le TV client utilise des breakpoints spécifiques (1920×1080 / 1360×768)

---

## 12. PATTERNS D'USAGE DANS LES FEATURES

### 12.1 API des composants — Convention commune

```jsx
// Import centralisé depuis le barrel
import { Button, Input, Modal, ModalHeader, ModalBody, Card, Table } from '@/design-system';

// Composition typique d'un écran
<ModuleLayout>
  <PageHeader title="Équipement" actions={<Button variant="primary">Ajouter</Button>} />
  <ModuleContent>
    <FilterBar filters={...} values={...} onChange={...} />
    <Table columns={columns} data={data} onRowClick={handleClick} />
  </ModuleContent>
</ModuleLayout>

// Formulaire typique
<Modal open={isOpen} onClose={close} size="lg">
  <ModalHeader icon={<Edit />} title="Modifier" />
  <ModalBody>
    <FormLayout onSubmit={handleSubmit}>
      <FormSection title="Informations">
        <FormField label="Nom" required error={errors.name}>
          <Input value={name} onChange={setName} />
        </FormField>
      </FormSection>
      <FormActions>
        <Button variant="secondary" onClick={close}>Annuler</Button>
        <Button variant="primary" type="submit">Enregistrer</Button>
      </FormActions>
    </FormLayout>
  </ModalBody>
</Modal>
```

### 12.2 Adoption par module feature

| Module | Utilise DS Button | DS Input/Form | DS Modal | DS Table | DS Card | Score |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|
| UserManagement | ✅ | ✅ | ✅ | ✅ | ✅ | A |
| EquipmentPanel | ✅ | ✅ | ✅ | ⚠️ custom | ✅ | B+ |
| PersonnelPanel | ✅ | ✅ | ✅ | ⚠️ custom | ✅ | B+ |
| OrdersPanel | ✅ | ✅ | ✅ | ⚠️ custom | ✅ | B |
| Calendar | ⚠️ partiel | ❌ custom | ❌ custom | N/A | ❌ | C |
| TaskPlanningPanel | ✅ | ✅ | ✅ | ⚠️ custom | ✅ | B |
| AffaireDetail | ✅ | ✅ | ✅ | ✅ | ✅ | A |
| AnnuairePanel | ✅ | ✅ | ✅ | ⚠️ custom | ✅ | B+ |
| MessagingPanel | ✅ | ✅ | ❌ N/A | ❌ N/A | ✅ | B |
| LeaveRequests | ✅ | ✅ | ✅ | ✅ | ✅ | A |
| SonosPanel | ✅ | ✅ | ❌ N/A | ❌ N/A | ✅ | B+ |
| Mobile (42 comp.) | ✅ | ✅ | ❌ sheets | ❌ listes | ❌ | C+ |
| TV Client | ❌ Vanilla | ❌ | ❌ | ❌ | ❌ | N/A |

---

## 13. LACUNES IDENTIFIÉES

### 13.1 Composants manquants dans le DS (patterns répétés non abstraits)

| Pattern observé | Fréquence | Composant DS absent |
|-----------------|-----------|---------------------|
| Bottom sheet mobile (slide-up panel) | 8+ écrans mobile | `BottomSheet` |
| Stepper / Wizard multi-étapes | OrdersPanel, AffaireDetail | `Stepper` |
| Timeline / historique vertical | Maintenances, SAV, stock_movements | `Timeline` |
| Chip / Pill sélectionnable | Sonos zones, filtres, tags | `Chip` |
| Skeleton loading placeholder | 0 instances (flash blanc) | `Skeleton` |
| Toast / notification système | Pattern custom dans Header | `Toast` (système global) |
| Date picker | Réservations, congés, commandes | `DatePicker` (wrappers variés) |
| Breadcrumb | PageHeader le supporte mais pas de composant dédié | `Breadcrumb` |
| File upload / dropzone | Messagerie, imports, photos | `FileUpload` |
| Color picker | Catégories, affaires, planning | `ColorPicker` |
| Confirmation inline | Suppressions avec Dialog | `ConfirmButton` (bouton + confirm intégré) |

### 13.2 Tokens manquants

| Catégorie | Manquant | État actuel |
|-----------|----------|-------------|
| **Breakpoints** | Pas de variables CSS (limitation @media) | Convention textuelle |
| **Container queries** | Aucun | N/A |
| **Transitions page** | Pas de tokens route-transition | Transitions manuelles |
| **Scrollbar dark** | Token scrollbar non adapté au dark mode | Même couleur |
| **Print** | Aucun token d'impression | N/A |

### 13.3 Anomalies CSS détectées

| # | Anomalie | Fichier(s) | Détail |
|---|---------|------------|--------|
| 1 | Couleurs hex brutes non tokenisées | InventoryPanel.css | `rgba(255,152,0,0.15)`, `#2a6cb5`, `#7b1fa2` |
| 2 | Fallbacks CSS var imbriqués | AnnuairePanel.css, ContactsCSVImportDialog.css | `var(--x, var(--y))` au lieu de valeur directe |
| 3 | Font-size en rem brut | AnnuairePanel.css | `0.82rem`, `1.15rem`, `0.65rem` |
| 4 | z-index hardcodé | AnnuairePanel.css, App.css, MobileApp.css | 20, 25, 100 hors tokens |
| 5 | ErrorBoundary inline px | ErrorBoundary.jsx | `fontSize: '18px'`, `padding: '10px'` |
| 6 | ~130 inline styles statiques | 24+ composants features | Migrables vers classes |
| 7 | ~510 hex résiduels | 59 fichiers | Post Phase D (non-sémantiques) |

### 13.4 Accessibilité composants DS

| Contrôle | Status |
|----------|--------|
| `aria-label` sur Button iconOnly | ✅ |
| `role="dialog"` sur Modal | ✅ |
| `aria-modal="true"` sur Modal | ✅ |
| `tabIndex={0}` sur éléments interactifs | ✅ |
| Focus trap dans Modal | ✅ |
| `aria-pressed` sur Toggle | ❌ Manquant |
| `aria-live` sur notifications | ❌ Manquant |
| `aria-expanded` sur Accordion | ✅ |
| `role="tablist"` sur Tabs | ✅ |
| Keyboard navigation Dropdown | ✅ |
| Skip-to-content global | ❌ Manquant |

---

## 14. MATRICE D'ADOPTION

### 14.1 Par catégorie de tokens

| Catégorie | Tokens définis | Adoption dans features | Score |
|-----------|:--:|:--:|:--:|
| Couleurs primitives | 8+ | ~85% | A- |
| Surfaces / backgrounds | 12+ | ~90% | A |
| Textes | 10+ | ~85% | A- |
| Bordures | 6 | ~80% | B+ |
| Espacement | 22 tokens | ~75% | B |
| Typographie | 10 tailles + 4 poids | ~80% | B+ |
| Ombres | 11 | ~90% | A |
| Z-index | 10 | ~85% (3 anomalies) | B+ |
| Border-radius | 8 | ~90% | A |
| Transitions | 4 durées + 3 easing | ~70% | B |
| Layout | 7 tokens | ~80% | B+ |
| Feedback | 4×4 = 16 | ~90% | A |
| Formulaires | 7 | ~85% | A- |
| Tableaux | 11 | ~70% (tables custom) | B- |

### 14.2 Par type de composant

| Type | Total composants | Utilise DS | Adoption |
|------|:--:|:--:|:--:|
| Atomes DS | 16 | 16/16 | 100% |
| Molécules DS | 7+1 | 8/8 | 100% |
| Organismes DS | 6 | 6/6 | 100% |
| Layout DS | 7 | 7/7 | 100% |
| Features desktop | 131 | ~90/131 | ~69% |
| Mobile | 42 | ~15/42 | ~36% |
| TV Client | 4 | 0/4 | 0% (attendu) |

---

## 15. SCORE & SYNTHÈSE

### 15.1 Score Design System

```
╔══════════════════════════════════════════════════╗
║                                                  ║
║   SCORE DESIGN SYSTEM :  A-  (85/100)            ║
║                                                  ║
╚══════════════════════════════════════════════════╝
```

### 15.2 Détail par axe

| Axe | Score | Commentaire |
|-----|-------|-------------|
| **Tokens (exhaustivité)** | A (92%) | 150+ tokens bien structurés sur 3 niveaux |
| **Composants DS (qualité)** | A+ (98%) | 44 composants, 100% testés, API cohérente |
| **Thèmes & palettes** | A (90%) | 10 palettes, dark/light, densité, persistance |
| **Adoption desktop** | B (72%) | Bonne sur modules récents, partielle sur legacy |
| **Adoption mobile** | C+ (58%) | Button/Input OK, patterns spécifiques non abstraits |
| **Utilitaires CSS** | B- (65%) | Bases flex/gap/text OK, grilles/overflow manquants |
| **Accessibilité DS** | B+ (78%) | ARIA bien implémenté, 3 lacunes identifiées |
| **Documentation** | C (50%) | Pas de Storybook ni de doc interactive |
| **Animations** | B (70%) | Tokens définis, peu de keyframes réutilisables |
| **Cohérence globale** | B+ (78%) | 3 anomalies z-index, quelques hex bruts résiduels |

### 15.3 Forces

1. **Architecture 3 niveaux** (primitifs → sémantique → composants) — exemplaire
2. **44 composants DS, 100% testés** (355 tests) — qualité industrielle
3. **10 palettes thématiques** avec hook de persistence — flexibilité maximale
4. **150+ tokens CSS** couvrant couleurs, espacement, typo, ombres, layout, feedback
5. **Barrel export unique** (`@/design-system`) — DX excellent
6. **Mode compact** fonctionnel — adaptabilité densité d'information

### 15.4 Faiblesses

1. **11 patterns récurrents** non abstraits en composants DS (BottomSheet, Stepper, Skeleton...)
2. **Adoption mobile ~36%** — la plupart des composants mobiles n'utilisent pas le DS
3. **Pas de documentation interactive** (Storybook, docs, playground)
4. **~510 hex résiduels** dans les features (post Phase D)
5. **3 z-index hors tokens** à corriger
6. **Breakpoints non centralisés** — chaque composant définit ses propres `@media`

---

> ⚠️ Ce document est un constat descriptif. Il servira de base aux étapes suivantes (Plan de Refonte & Roadmap).

*Spécification rédigée le 15 avril 2026 — Branche `feature/sonos-full-gui`*
