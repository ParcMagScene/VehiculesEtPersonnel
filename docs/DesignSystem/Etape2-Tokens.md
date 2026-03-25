# 🎨 Étape 2 — Proposition de tokens de design

> Date : 23 mars 2026  
> Base : 147+ tokens existants dans `theme.css`  
> Objectif : Système de tokens complet, combler les lacunes, standardiser les incohérences

---

## 📐 Principes directeurs

1. **Rétro-compatible** — Aucun token existant n'est renommé ou supprimé
2. **Ajout uniquement** — Nouveaux tokens pour combler les manques identifiés à l'Étape 1
3. **Structure à 3 niveaux** : Primitives → Sémantiques → Composants
4. **Chaque palette** (6 + VS Code) doit pouvoir redéfinir les tokens sémantiques
5. **Dark mode** : tous les tokens sémantiques ont un override `[data-theme="dark"]`

---

## 1. 🎨 Couleurs

### 1.1 Primitives de couleurs (palette de base)

Les primitives ne sont **pas** destinées à être utilisées directement dans les composants.
Elles servent de référence pour les tokens sémantiques.

```
ACTUEL (déjà en place) :
  --theme-primary: #667eea       ← Indigo principal
  --theme-secondary: #764ba2     ← Violet secondaire
  --theme-primary-dark: #5b21b6
  --theme-primary-hover: #7c3aed
  --theme-primary-light: #8b5cf6
  --theme-accent: #a855f7
  --theme-indigo: #6366f1
```

#### ✅ Tokens couleurs existants — CONSERVÉS tels quels

| Groupe | Tokens | Statut |
|--------|--------|--------|
| Primaire | `--theme-primary`, `--theme-secondary`, `--theme-primary-dark`, `--theme-primary-hover`, `--theme-primary-light`, `--theme-accent`, `--theme-indigo` | ✅ OK |
| Danger | `--theme-danger`, `--theme-danger-dark`, `--theme-danger-bg`, `--theme-danger-border`, `--theme-danger-text`, `--theme-danger-text-alt` | ✅ OK |
| Success | `--theme-success`, `--theme-success-dark`, `--theme-success-alt`, `--theme-success-bg`, `--theme-success-bg-strong`, `--theme-success-border`, `--theme-success-text`, `--theme-success-text-alt` | ✅ OK |
| Warning | `--theme-warning`, `--theme-warning-dark`, `--theme-warning-bg`, `--theme-warning-text`, `--theme-warning-text-alt`, `--theme-warning-border` | ✅ OK |
| Info | `--theme-info`, `--theme-info-dark`, `--theme-info-bg`, `--theme-info-bg-strong`, `--theme-info-border`, `--theme-info-text`, `--theme-info-text-alt` | ✅ OK |
| Orange | `--theme-orange-bg`, `--theme-orange-text` | ✅ OK |
| Purple | `--theme-purple-bg`, `--theme-purple-bg-strong`, `--theme-purple-border`, `--theme-purple-accent`, `--theme-purple-text` | ✅ OK |

#### 🆕 Tokens couleurs À AJOUTER

```css
:root {
  /* ─── Cyan (Maps, tags, badges) ─── */
  --theme-cyan: #06b6d4;
  --theme-cyan-dark: #0891b2;
  --theme-cyan-bg: #ecfeff;
  --theme-cyan-text: #155e75;
  --theme-cyan-border: #67e8f9;

  /* ─── Amber (distincts de warning — pour badges, tags doré) ─── */
  --theme-amber: #f59e0b;
  --theme-amber-bg: #fffbeb;
  --theme-amber-text: #92400e;
  --theme-amber-border: #fde68a;

  /* ─── Danger (manquant : gradient pour le dark mode) ─── */
  --theme-danger-gradient: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  /* ^ Existait déjà en :root light, confirmé */

  /* ─── Success gradient ─── */
  --theme-success-gradient: linear-gradient(135deg, #10b981, #059669);
  /* ^ Existait déjà via --btn-success-gradient, aliasé ici */

  /* ─── Neutre explicite (pour les statuts "inactif", "annulé") ─── */
  --theme-neutral: #6b7280;
  --theme-neutral-bg: #f3f4f6;
  --theme-neutral-text: #374151;
  --theme-neutral-border: #d1d5db;
}
```

**Raison** : L'Étape 1 a identifié des couleurs cyan hardcodées (`#06b6d4`, `#05b6d4`) et des statuts neutres qui n'avaient pas de token dédié.

### 1.2 Surfaces, fonds et overlays

#### ✅ Tokens existants — CONSERVÉS

| Token | Valeur | Rôle |
|-------|--------|------|
| `--theme-bg-page` | `#f8fafc` | Fond de l'application |
| `--theme-bg-card` | `white` | Fond des cartes/modals |
| `--theme-bg-card-translucent` | `rgba(255,255,255,0.95)` | Carte semi-transparente |
| `--theme-bg-secondary` | `#f9fafb` | Fond secondaire (sidebar) |
| `--theme-bg-tertiary` | `#f3f4f6` | Fond tertiaire (stripe) |
| `--theme-bg-hover` | `#eef2ff` | Fond au survol |
| `--theme-bg-muted` | `#cbd5e1` | Fond atténué |
| `--theme-bg-dark` | `#1f2937` | Fond sombre |
| `--theme-bg-darker` | `#111827` | Fond très sombre |
| `--theme-bg-indigo-light` | `#e0e7ff` | Fond indigo clair |
| `--theme-bg-indigo-lighter` | `#c7d2fe` | Fond indigo très clair |
| `--theme-overlay` | `rgba(15,23,42,0.5)` | Overlay standard |
| `--theme-overlay-dark` | `rgba(0,0,0,0.6)` | Overlay sombre |

#### 🆕 Surfaces À AJOUTER

```css
:root {
  /* ─── Fond actif / sélectionné (manquant pour les listes) ─── */
  --theme-bg-active: #e0e7ff;
  --theme-bg-selected: #eef2ff;
  
  /* ─── Fond de code / preformatted ─── */
  --theme-bg-code: #f1f5f9;
}
```

### 1.3 Texte

#### ✅ Tokens existants — CONSERVÉS (10 niveaux)

| Token | Valeur | Usage |
|-------|--------|-------|
| `--theme-text-heading` | `#111827` | Titres H1-H3 |
| `--theme-text-primary` | `#1e293b` | Corps principal |
| `--theme-text-dark` | `#334155` | Texte sombre accent |
| `--theme-text-body` | `#374151` | Corps de texte |
| `--theme-text-subtle` | `#475569` | Texte subtil |
| `--theme-text-secondary` | `#64748b` | Labels, captions |
| `--theme-text-gray` | `#6b7280` | Texte grisé |
| `--theme-text-muted` | `#94a3b8` | Placeholder, disabled |
| `--theme-text-inverse` | `#ffffff` | Sur fond coloré |

> ✅ **10 niveaux suffisants** — pas de token manquant ici.

#### 🆕 Texte À AJOUTER

```css
:root {
  /* ─── Texte de lien (actuellement hardcodé #667eea ou --theme-primary) ─── */
  --theme-text-link: var(--theme-primary);
  --theme-text-link-hover: var(--theme-primary-hover);
  
  /* ─── Texte désactivé explicite ─── */
  --theme-text-disabled: #9ca3b8;
}
```

### 1.4 Bordures

#### ✅ Tokens existants — CONSERVÉS

| Token | Valeur | Rôle |
|-------|--------|------|
| `--theme-border` | `#e2e8f0` | Bordure standard |
| `--theme-border-light` | `#f1f5f9` | Bordure légère |
| `--theme-border-medium` | `#e5e7eb` | Bordure moyenne |
| `--theme-border-muted` | `#d1d5db` | Bordure marquée |
| `--theme-border-focus` | `#8b5cf6` | Bordure au focus |

#### 🆕 Bordures À AJOUTER

```css
:root {
  /* ─── Bordure désactivée (inputs disabled) ─── */
  --theme-border-disabled: #e5e7eb;
}
```

### 1.5 Dégradés

#### ✅ Tokens existants — CONSERVÉS

| Token | Rôle |
|-------|------|
| `--theme-gradient` | Header modals, bouton primaire |
| `--theme-gradient-reverse` | Variante inversée |
| `--theme-gradient-subtle` | Fond décoratif light |
| `--theme-gradient-alt` | Alternative |
| `--theme-danger-gradient` | Bouton danger rempli |
| `--btn-success-gradient` | Bouton succès gradient |

> ✅ **Suffisant** — pas d'ajout nécessaire.

---

## 2. 📝 Typographie

### 2.1 Famille de police

```
ACTUEL : font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
```

> ✅ **Inter** est un excellent choix — neutre, lisible, bons chiffres tabulaires.  
> Aucun changement recommandé.

### 2.2 Échelle de tailles

#### ✅ Tokens existants — CONSERVÉS

| Token | Valeur | Pixel equiv. | Usage recommandé |
|-------|--------|-------------|------------------|
| `--font-2xs` | `0.65rem` | ~10.4px | Micro-labels, badges |
| `--font-xs` | `0.72rem` | ~11.5px | Table headers, tags |
| `--font-sm` | `0.8rem` | ~12.8px | Labels, descriptions |
| `--font-base` | `0.875rem` | ~14px | Corps de texte, inputs |
| `--font-md` | `1rem` | 16px | Body, navigation |
| `--font-lg` | `1.125rem` | 18px | H4, sous-titres |
| `--font-xl` | `1.25rem` | 20px | H3, titres de section |
| `--font-2xl` | `1.5rem` | 24px | H2, titres de modal |
| `--font-3xl` | `1.875rem` | 30px | H1, titres principaux |

#### 🆕 Tailles À AJOUTER

L'audit a révélé des valeurs `22px`, `24px` et `2rem` hardcodées n'ayant pas de token exact.

```css
:root {
  /* ─── Taille display (titres hero / dashboard KPI) ─── */
  --font-4xl: 2.25rem;    /* 36px — titres hero, grands KPI */
}
```

> **Note** : Les valeurs 22px et 24px sont suffisamment proches de `--font-xl` (20px) et `--font-2xl` (24px) pour ne pas justifier de nouveau token. On recommande d'arrondir au token le plus proche lors de la migration.

### 2.3 Poids

#### ✅ Tokens existants — CONSERVÉS

| Token | Valeur | Usage |
|-------|--------|-------|
| `--weight-normal` | 400 | Corps de texte |
| `--weight-medium` | 500 | Labels, navigation |
| `--weight-semibold` | 600 | Sous-titres, boutons |
| `--weight-bold` | 700 | Titres, H1-H3 |

> ✅ **4 poids suffisants pour Inter** — pas d'ajout.

### 2.4 Interlignage (line-height)

#### ✅ Tokens existants — CONSERVÉS

| Token | Valeur | Usage |
|-------|--------|-------|
| `--leading-tight` | 1.25 | Titres |
| `--leading-snug` | 1.375 | Sous-titres compacts |
| `--leading-normal` | 1.5 | Corps de texte |
| `--leading-relaxed` | 1.625 | Texte aéré, descriptions |

> ✅ **4 niveaux suffisants.**

### 2.5 Mapping typographique recommandé (Heading → Token)

| Élément | Font-size | Weight | Leading | Letter-spacing |
|---------|-----------|--------|---------|----------------|
| **H1** | `--font-3xl` (1.875rem) | `--weight-bold` (700) | `--leading-tight` (1.25) | `-0.025em` |
| **H2** | `--font-2xl` (1.5rem) | `--weight-bold` (700) | `--leading-tight` (1.25) | `-0.02em` |
| **H3** | `--font-xl` (1.25rem) | `--weight-semibold` (600) | `--leading-snug` (1.375) | `-0.015em` |
| **H4** | `--font-lg` (1.125rem) | `--weight-semibold` (600) | `--leading-snug` (1.375) | 0 |
| **H5** | `--font-md` (1rem) | `--weight-semibold` (600) | `--leading-normal` (1.5) | 0 |
| **H6** | `--font-sm` (0.8rem) | `--weight-semibold` (600) | `--leading-normal` (1.5) | `0.05em` |
| **Body** | `--font-base` (0.875rem) | `--weight-normal` (400) | `--leading-normal` (1.5) | 0 |
| **Body small** | `--font-sm` (0.8rem) | `--weight-normal` (400) | `--leading-normal` (1.5) | 0 |
| **Caption** | `--font-xs` (0.72rem) | `--weight-medium` (500) | `--leading-normal` (1.5) | `0.02em` |
| **Overline** | `--font-2xs` (0.65rem) | `--weight-semibold` (600) | `--leading-normal` (1.5) | `0.1em` |

#### 🆕 Letter-spacing tokens À AJOUTER

```css
:root {
  --tracking-tight: -0.025em;    /* H1, titres display */
  --tracking-snug: -0.015em;     /* H2-H3 */
  --tracking-normal: 0;          /* Corps, H4-H5 */
  --tracking-wide: 0.05em;       /* H6, overlines */
  --tracking-wider: 0.1em;       /* Micro-labels, badges uppercase */
}
```

---

## 3. 📏 Espacements

### 3.1 Échelle d'espacement

#### ✅ Tokens existants — CONSERVÉS

| Token | Valeur | Usage type |
|-------|--------|-----------|
| `--space-0` | 0 |  |
| `--space-px` | 1px | Bordures, séparateurs fins |
| `--space-0-5` | 2px | Micro padding |
| `--space-1` | 4px | Gap icône-texte, padding badge |
| `--space-1-5` | 6px | Petit padding vertical |
| `--space-2` | 8px | Padding standard compact |
| `--space-2-5` | 10px | Padding intermédiaire |
| `--space-3` | 12px | Gap standard, padding horizontal |
| `--space-4` | 16px | Padding de conteneur |
| `--space-5` | 20px | Padding de section |
| `--space-6` | 24px | Espacement entre sections |
| `--space-8` | 32px | Grande marge |
| `--space-10` | 40px | XL marge |
| `--space-12` | 48px | XXL marge |
| `--space-16` | 64px | Spacing maximal |

#### 🆕 Espacements À AJOUTER

L'audit a identifié : `14px` utilisé dans `padding: 10px 14px` (10+ occurrences) et `28px` / `36px` observés.

```css
:root {
  --space-3-5: 14px;   /* 10+ usages — padding tooltip, tags étendus */
  --space-7: 28px;     /* Entre 24 et 32 — marge intermédiaire */
  --space-9: 36px;     /* Entre 32 et 40 — hauteur de barre */
  --space-14: 56px;    /* Entre 48 et 64 — espacement de layout */
  --space-20: 80px;    /* Grand espacement de page */
  --space-24: 96px;    /* Très grand espacement */
}
```

### 3.2 Patterns de padding composites recommandés

Pour standardiser les 400+ paddings hardcodés identifiés, voici les **combinaisons cibles** :

| Usage | Padding recommandé | Tokens |
|-------|-------------------|--------|
| Badge / Tag | `4px 8px` | `--space-1 --space-2` |
| Bouton xs | `4px 8px` | `--space-1 --space-2` |
| Bouton sm | `6px 12px` | `--space-1-5 --space-3` |
| Bouton md (default) | `10px 20px` | `--space-2-5 --space-5` |
| Bouton lg | `12px 24px` | `--space-3 --space-6` |
| Input | `8px 12px` | `--space-2 --space-3` |
| Cell de table | `8px 12px` | `--space-2 --space-3` |
| Card body | `16px` | `--space-4` |
| Modal header | `20px 24px` | `--space-5 --space-6` |
| Modal body | `24px` | `--space-6` |
| Panel body | `20px` | `--space-5` |
| Section gap | `24px` | `--space-6` |

---

## 4. 📐 Border Radius

### ✅ Tokens existants — CONSERVÉS

| Token | Valeur | Usage |
|-------|--------|-------|
| `--radius-xs` | 4px | Tags, badges, micro-éléments |
| `--radius-sm` | 6px | Menus déroulants, tooltips |
| `--radius-md` | 8px | Boutons, inputs, cartes standard |
| `--radius-lg` | 12px | Grands conteneurs, modals internes |
| `--radius-xl` | 16px | Modals, slide panels |
| `--radius-2xl` | 20px | Grandes modals hero |
| `--radius-full` | 9999px | Avatars, pills, toggle |

> ✅ **7 niveaux couvrent 95% des usages.**  
> Les valeurs aberrantes (`7px`, `5px`, `3px`, `9px`, `10px`) devront être arrondies au token le plus proche lors de la migration.

#### Convention de correspondance

| Valeur hardcodée trouvée | Token cible |
|--------------------------|-------------|
| 3px | `--radius-xs` (4px) |
| 5px | `--radius-xs` (4px) |
| 7px | `--radius-md` (8px) |
| 9px | `--radius-md` (8px) |
| 10px | `--radius-lg` (12px) |

---

## 5. 🌑 Ombres

### ✅ Tokens existants — CONSERVÉS

| Token | Valeur | Usage |
|-------|--------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | Éléments plats subtils |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | Boutons, tags |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | Cartes, dropdowns |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.12)` | Panels, slide-overs |
| `--shadow-xl` | `0 12px 40px rgba(0,0,0,0.15)` | Grands éléments flottants |
| `--shadow-modal` | `0 20px 60px rgba(0,0,0,0.25)` | Modales |
| `--shadow-card` | `0 2px 8px rgba(0,0,0,0.08)` | Cartes standard |
| `--shadow-hover` | `0 4px 16px rgba(102,126,234,0.2)` | Élévation au survol |

> ✅ **8 niveaux couvrent tous les besoins.**

#### 🆕 Ombres À AJOUTER

```css
:root {
  /* ─── Ombre intérieure (inputs focus, champs actifs) ─── */
  --shadow-inner: inset 0 2px 4px rgba(0, 0, 0, 0.06);
  
  /* ─── Ombre de dropdown (menu contextuel) ─── */
  --shadow-dropdown: 0 4px 16px rgba(0, 0, 0, 0.12);
  
  /* ─── Ombre de toast (notification flottante) ─── */
  --shadow-toast: 0 8px 30px rgba(0, 0, 0, 0.18);
}
```

**Raison** : L'audit a identifié des ombres hardcodées spécifiques pour les dropdowns et toasts qui ne correspondaient pas exactement aux tokens existants.

---

## 6. ⏱ Transitions & Animations

### ✅ Tokens existants — CONSERVÉS

| Token | Valeur | Usage |
|-------|--------|-------|
| `--transition-fast` | `0.15s ease` | Hover, toggle, micro-interactions |
| `--transition-normal` | `0.2s ease` | Changements d'état standard |
| `--transition-smooth` | `0.3s cubic-bezier(0.4, 0, 0.2, 1)` | Ouvertures, slide, modals |

#### 🆕 Transitions À AJOUTER

```css
:root {
  /* ─── Transition longue (pour les slides, collapses) ─── */
  --transition-slow: 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  
  /* ─── Durées brutes (pour animation-duration) ─── */
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-smooth: 300ms;
  --duration-slow: 400ms;
  
  /* ─── Easing curves nommées ─── */
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

**Raison** : L'Étape 1 a trouvé 4+ durées différentes (`0.1s`, `0.15s`, `0.2s`, `0.3s`, `0.4s`). Le `0.4s` n'avait pas de token. Les durées brutes et easings nommés facilitent les animations CSS pures et les keyframes.

---

## 7. 📏 Z-Index

### ✅ Tokens existants — CONSERVÉS

| Token | Valeur | Usage |
|-------|--------|-------|
| `--z-base` | 1 | Éléments positionnés de base |
| `--z-dropdown` | 100 | Menus déroulants |
| `--z-sticky` | 200 | Headers sticky |
| `--z-overlay` | 1000 | Overlay de fond |
| `--z-modal` | 2000 | Modales |
| `--z-popover` | 3000 | Popovers sur modales |
| `--z-toast` | 5000 | Toasts/notifications |
| `--z-tooltip` | 9999 | Tooltips |

#### 🆕 Z-Index À AJOUTER

```css
:root {
  /* ─── Modal au-dessus d'un overlay (empilement) ─── */
  --z-modal-nested: 2500;
  
  /* ─── Draggable modals (actuellement z-index: 100001 !) ─── */
  --z-draggable: 4000;
}
```

**Raison** : L'audit a trouvé `z-index: 100001` dans `draggable-modals.css` et `z-index: 2100` dans MailingPanel — des valeurs anarchiques à canaliser.

---

## 8. 🖼 Icônes (Lucide React)

### Convention actuelle

- **Bibliothèque** : Lucide React (standardisée)
- **Import** : `import { Icon } from 'lucide-react'`
- **Tailles** : $16 \times 16$, $18 \times 18$, $20 \times 20$, $24 \times 24$ observées

### 🆕 Tokens de taille d'icône À AJOUTER

```css
:root {
  --icon-xs: 14px;    /* Dans les badges, micro-labels */
  --icon-sm: 16px;    /* Dans les boutons sm, tags */
  --icon-md: 18px;    /* Taille standard (body) */
  --icon-lg: 20px;    /* Boutons md, navigation */
  --icon-xl: 24px;    /* Headers, titres, actions principales */
  --icon-2xl: 32px;   /* Empty states, illustrations */
}
```

**Mapping recommandé :**

| Contexte | Token icône | Paire avec |
|----------|-------------|------------|
| Bouton xs / Badge | `--icon-xs` (14px) | `--font-xs` |
| Bouton sm / Tag | `--icon-sm` (16px) | `--font-sm` |
| Bouton md / Liste | `--icon-md` (18px) | `--font-base` |
| Bouton lg / Nav | `--icon-lg` (20px) | `--font-md` |
| Modal header / Action | `--icon-xl` (24px) | `--font-xl` |
| Empty state | `--icon-2xl` (32px) | `--font-2xl` |

---

## 9. 🧩 Tokens de composants existants — CONSERVÉS

### Boutons (20+ tokens)

| Token | Valeur | Rôle |
|-------|--------|------|
| `--btn-radius` | 8px | Rayon des boutons |
| `--btn-font-size` | 14px | Taille du texte |
| `--btn-font-weight` | 600 | Poids du texte |
| `--btn-padding` | 10px 20px | Padding standard |
| `--btn-height` | 40px | Hauteur standard |
| `--btn-transition` | all 0.2s ease | Transition |
| `--btn-primary-*` | ... | Primaire (6 tokens) |
| `--btn-secondary-*` | ... | Secondaire (5 tokens) |
| `--btn-danger-*` | ... | Danger (5 tokens) |
| `--btn-success-*` | ... | Succès (5 tokens) |
| `--btn-warning-*` | ... | Warning (4 tokens) |

#### 🆕 Tokens boutons À AJOUTER

```css
:root {
  /* ─── Tailles de bouton standardisées ─── */
  --btn-height-xs: 26px;
  --btn-height-sm: 32px;
  --btn-height-md: 40px;    /* = --btn-height existant */
  --btn-height-lg: 48px;
  
  --btn-padding-xs: 4px 8px;
  --btn-padding-sm: 6px 12px;
  --btn-padding-md: 10px 20px;  /* = --btn-padding existant */
  --btn-padding-lg: 12px 24px;
  
  --btn-font-size-xs: var(--font-xs);     /* 0.72rem */
  --btn-font-size-sm: var(--font-sm);     /* 0.8rem */
  --btn-font-size-md: var(--font-base);   /* 0.875rem */
  --btn-font-size-lg: var(--font-md);     /* 1rem */
  
  --btn-icon-size: 32px;    /* Bouton icône carré */
  --btn-icon-size-sm: 26px;
  --btn-icon-size-lg: 38px;
}
```

### Tables (10+ tokens)

> ✅ Déjà bien définis via `--table-*` tokens. Aucun ajout nécessaire.

### Cards / Panels (6+ tokens)

> ✅ Déjà définis via `--card-*` et `--panel-*`. Aucun ajout nécessaire.

### Modals / Close button (10+ tokens)

> ✅ `--modal-header-*`, `--close-btn-*` déjà en place. Aucun ajout.

### Scrollbar (7 tokens)

> ✅ Complets light + dark. Aucun ajout.

---

## 10. 📊 Récapitulatif des ajouts proposés

| Catégorie | Tokens existants | Tokens à ajouter | Total |
|-----------|-----------------|------------------|-------|
| **Couleurs** | ~55 | **+12** (cyan, amber, neutral, link, disabled, surfaces) | ~67 |
| **Typographie** | 17 | **+6** (tracking × 5, font-4xl) | 23 |
| **Espacement** | 16 | **+6** (3.5, 7, 9, 14, 20, 24) | 22 |
| **Radius** | 7 | **+0** | 7 |
| **Ombres** | 8 | **+3** (inner, dropdown, toast) | 11 |
| **Transitions** | 3 | **+8** (slow, durations × 4, easings × 3) | 11 |
| **Z-Index** | 8 | **+2** (nested, draggable) | 10 |
| **Icônes** | 0 | **+6** (xs→2xl) | 6 |
| **Boutons** | 20+ | **+12** (tailles xs/sm/md/lg × 3 + icon sizes) | 32+ |
| **TOTAL** | **~147** | **~55** | **~202** |

---

## 11. 🌙 Impact sur le Dark Mode

Tous les tokens **existants** ont déjà un override dans `[data-theme="dark"]`.

Pour les **nouveaux tokens**, voici les valeurs dark mode proposées :

```css
[data-theme="dark"] {
  /* ─── Cyan ─── */
  --theme-cyan: #22d3ee;
  --theme-cyan-dark: #06b6d4;
  --theme-cyan-bg: #164e63;
  --theme-cyan-text: #67e8f9;
  --theme-cyan-border: #0e7490;
  
  /* ─── Amber ─── */
  --theme-amber: #fbbf24;
  --theme-amber-bg: #451a03;
  --theme-amber-text: #fde68a;
  --theme-amber-border: #92400e;
  
  /* ─── Neutral ─── */
  --theme-neutral: #9ca3af;
  --theme-neutral-bg: #374151;
  --theme-neutral-text: #d1d5db;
  --theme-neutral-border: #4b5563;
  
  /* ─── Surfaces ─── */
  --theme-bg-active: #312e81;
  --theme-bg-selected: #2d3554;
  --theme-bg-code: #1e293b;
  
  /* ─── Text disabled ─── */
  --theme-text-disabled: #64748b;
  --theme-border-disabled: #334155;
  
  /* ─── Shadows ─── */
  --shadow-inner: inset 0 2px 4px rgba(0, 0, 0, 0.3);
  --shadow-dropdown: 0 4px 16px rgba(0, 0, 0, 0.4);
  --shadow-toast: 0 8px 30px rgba(0, 0, 0, 0.5);
}
```

Les **6 palettes** et les **2 palettes VS Code** hériteront automatiquement des nouveaux tokens, car ceux-ci sont définis en `:root` / `[data-theme="dark"]` (héritage CSS). Si une palette nécessite un override spécifique pour un nouveau token, ce sera traité à l'Étape 7 (Thèmes).

---

## 12. ✅ Ce qui ne change PAS

- **Aucun token existant n'est renommé ni supprimé**
- **Aucune valeur existante n'est changée**
- **Les aliases courts** (`--bg-primary`, `--text-primary`, etc.) restent inchangés
- **Les classes utilitaires** (`.theme-modal-header`, `.theme-btn-*`, `.theme-close-btn`) restent inchangées
- **Les 6 palettes** ne sont pas modifiées
- **L'architecture CSS** (colocation composant ↔ CSS) reste identique

---

## 13. 📋 Plan d'implémentation (Étape 2 → theme.css)

L'ajout des ~55 nouveaux tokens se fera dans `theme.css` en respectant la structure existante :

1. Ajouter les tokens dans `:root` (après les sections existantes correspondantes)
2. Ajouter les overrides dans `[data-theme="dark"]` (dans la section dark existante)
3. Pas de modification des fichiers palette — héritage automatique

**Aucun fichier composant n'est modifié à cette étape.** La migration des valeurs hardcodées se fera aux Étapes 3-5.

---

## 🔜 Prochaine étape

> **Étape 3 — Composants atomiques**  
> Créer les composants de base : `<Button>`, `<Input>`, `<Checkbox>`, `<Tag>`, `<Avatar>`, `<Tooltip>`, `<Loader>`, en s'appuyant sur les tokens existants + nouveaux.

**En attente de votre validation avant de continuer.**
