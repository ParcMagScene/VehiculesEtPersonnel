# Design System — Prompt Maître
Version: 1.0.0
Statut: stable
Dernière mise à jour: 2026-03-30
Auteur: Alexandre + Copilot
Description: Système de design d'eM@g — tokens, composants atomiques, molécules, thèmes et conventions CSS.

---

## Contexte

eM@g utilise un Design System à **3 niveaux de tokens** (Primitives → Sémantiques → Composants), implémenté en **CSS Custom Properties** dans `theme.css`. Pas de framework CSS externe — tout est natif.

---

## Architecture des tokens (147+)

### Primitives — Palette de couleurs
```css
--theme-primary: #667eea        /* Indigo — couleur principale */
--theme-primary-dark: #5a67d8
--theme-primary-light: #a3b1ff
/* + Violet, Orange, palettes étendues */
```

### Sémantiques — Statuts
```css
--theme-danger-default: #ef4444
--theme-danger-dark / -bg / -text / -border
--theme-success-default: #22c55e
--theme-warning-default: #f59e0b
--theme-info-default: #3b82f6
/* Même schéma pour chaque statut */
```

### Sémantiques — Texte et fonds
```css
--text-primary / --text-secondary / --text-muted / --text-heading
--text-body / --text-subtle / --text-gray / --text-inverse
--theme-bg-primary / --theme-bg-card / --theme-bg-hover
```

### Composants — Boutons (4 tailles)
```css
--btn-height-xs: 28px   --btn-padding-xs: 0 8px    --btn-font-size-xs: 0.75rem
--btn-height-sm: 32px   --btn-padding-sm: 0 12px   --btn-font-size-sm: 0.8125rem
--btn-height-md: 38px   --btn-padding-md: 0 16px   --btn-font-size-md: 0.875rem
--btn-height-lg: 44px   --btn-padding-lg: 0 20px   --btn-font-size-lg: 1rem
```

### Composants — Spacing, ombres, rayons
```css
--space-1: 4px  --space-1-5: 6px  --space-2: 8px  --space-3: 12px  --space-4: 16px
--shadow-sm / --shadow-md / --shadow-lg / --shadow-dropdown
--radius-xs: 4px  --radius-sm: 6px  --radius-md: 8px  --radius-lg: 12px
--scrollbar-width / --scrollbar-track / --scrollbar-thumb / --scrollbar-radius
```

---

## Composants UI

### Atomes
| Composant | Variantes |
|-----------|-----------|
| Button | primary, secondary, danger, ghost, outline, icon-only × 4 tailles |
| Input | text, number, search, select, textarea |
| Checkbox, Toggle | standard, disabled |
| Badge, Tag | status colors |
| Avatar | image, initiales |
| Spinner, LoadingOverlay | — |

### Molécules
| Composant | Fonction |
|-----------|----------|
| DropdownMenu | Menu contextuel positionné |
| Tabs | Onglets avec compteurs |
| Accordion | Sections pliables |
| SearchBar | Input + icône + clear |
| FilterBar | Filtres combinés |
| ListItem | Ligne cliquable avec actions |

### Organismes
| Composant | Fonction |
|-----------|----------|
| Panel | Conteneur principal avec toolbar |
| Card | Carte avec header, body, actions |
| Table | Headers triables, sélection, actions inline |
| Dialog / Modal | Overlay avec formulaire |
| Drawer | Panneau latéral glissant |
| ConfirmDialog | Confirmation avec message + actions |

---

## Thèmes

| Fichier | Fonction |
|---------|----------|
| `apps/web/src/theme.css` | Thème principal (147+ tokens) |
| `apps/web/src/theme-density.css` | Mode compact |
| `apps/web/src/theme-tv.css` | Override pour kiosk/TV |

---

## Règles impératives

1. **Toujours utiliser les tokens CSS** — jamais de valeurs en dur
2. **Respecter la hiérarchie** : Primitives → Sémantiques → Composants
3. **Pas de framework CSS externe** (pas de Tailwind, Bootstrap, etc.)
4. **Classes en kebab-case** : `.panel-toolbar`, `.btn-danger`
5. **Icônes via lucide-react** : `<Edit2 size={14} />`
6. **Animations** : préférer `transition` CSS, éviter les animations JavaScript
7. **Responsive** : utiliser `isMobile` prop + media queries
8. **Mode sombre** : déjà supporté via les tokens sémantiques

---

## Fichiers de référence

| Fichier | Rôle |
|---------|------|
| `apps/web/src/theme.css` | Tokens et thème principal |
| `apps/web/src/theme-density.css` | Mode compact |
| `apps/web/src/theme-tv.css` | Thème kiosk |
| `docs/DesignSystem/Etape2-Tokens.md` | Documentation tokens |
| `docs/DesignSystem/Etape3-Atomes.md` | Documentation atomes |
| `docs/DesignSystem/Etape4-Molecules.md` | Documentation molécules |
