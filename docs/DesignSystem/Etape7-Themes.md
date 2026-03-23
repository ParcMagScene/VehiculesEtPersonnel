# 🧩 Étape 7 — Thèmes

> Date : 23 mars 2026  
> Fichiers créés : 2 CSS  
> Fichiers modifiés : 2 (useTheme.js, main.jsx)

---

## Vue d'ensemble

Le système de theming eM@g repose sur **3 axes indépendants** :

| Axe | Attribut DOM | Valeurs | Persistance |
|-----|-------------|---------|-------------|
| **Mode** | `data-theme` | `light` \| `dark` | `emag-theme` |
| **Palette** | `data-palette` | `default`, 8 palettes flat/vscode, `tv-display` | `emag-palette` |
| **Densité** | `data-density` | `normal` \| `compact` | `emag-density` |

---

## Inventaire des 5 thèmes demandés

### 1. ☀️ Thème Clair (light)

**Statut** : ✅ Existait déjà  
**Fichier** : `theme.css` (`:root`)  
**Activation** : `data-theme="light"` (défaut)

Fond blanc/gris clair, texte slate foncé, accent violet indigo.

### 2. 🌙 Thème Sombre (dark)

**Statut** : ✅ Existait déjà  
**Fichier** : `theme.css` (`[data-theme="dark"]`)  
**Activation** : `data-theme="dark"`

Fond slate foncé, texte clair, accent indigo clair. ~80 tokens redéfinis.

### 3. 📐 Thème Compact (densité réduite)

**Statut** : 🆕 Créé  
**Fichier** : `theme-density.css`  
**Activation** : `data-density="compact"`

| Catégorie | Changement |
|-----------|-----------|
| **Espacement** | Scale réduit ~75% (ex: space-4: 16px → 12px) |
| **Typographie** | Font scale -1 cran (base: 0.875rem → 0.8rem) |
| **Line-height** | Resserré (normal: 1.5 → 1.375) |
| **Boutons** | Hauteur 40px → 32px, padding réduit |
| **Tables** | Cellules 8px au lieu de 12px |
| **Icônes** | Scale -2px par niveau |
| **Radius** | Réduits de 2px par niveau |
| **Scrollbar** | 6px au lieu de 8px |
| **Composants** | Overrides pour Modal, Panel, Form, Card, Tabs, Accordion, Drawer, Dropdown, PageHeader, SearchBar, ListItem, ModuleLayout |

Fonctionne avec **n'importe quelle palette** et **n'importe quel mode** (light/dark).

### 4. 💻 Thème VS Code (flat, dense, productif)

**Statut** : ✅ Existait déjà  
**Fichier** : `theme-vscode.css` (1187 lignes)  
**Activation** : `data-palette="vscode-dark"` ou `data-palette="vscode-light"`

| Aspect | Valeur |
|--------|--------|
| Ombres | Toutes `none` |
| Radius | Tous `0` |
| Typo | Cascadia Code / Fira Code, monospace, 13px |
| Boutons | Plats, 28px, weight 400 |
| Header | Titlebar plat, pas de gradient |
| Tables | Bordures fines, pas de zebra |
| 150+ selectors | Override complet de tous les modules |

### 5. 📺 Thème TV (contraste élevé, lisibilité)

**Statut** : 🆕 Créé  
**Fichier** : `theme-tv.css`  
**Activation** : `data-palette="tv-display"`

| Aspect | Valeur |
|--------|--------|
| **Fond** | Noir profond `#000000` |
| **Texte** | Blanc pur `#ffffff`, poids renforcés (+100) |
| **Accent** | Cyan néon `#00e1ff` (cohérent avec tv-client) |
| **Font scale** | +1-2 crans (base: 1.05rem, 2xl: 2rem) |
| **Ombres** | Toutes `none` (perf Raspberry Pi) |
| **Dégradés** | Couleurs plates (pas de gradient) |
| **Bordures** | 2px sur cards et inputs |
| **Icônes** | +4px par niveau |
| **Boutons** | 48px (touch-friendly TV remote) |
| **Tables** | Cellules agrandies 10-12px |
| **Ratio contraste** | ≥ 7:1 (WCAG AAA) |
| **Sémantiques** | Couleurs saturées (ff5252, 69f0ae, ffd740, 40c4ff) |

---

## Fichiers modifiés

### `useTheme.js` — Nouvel axe densité

```javascript
// Avant : 2 axes (mode, palette)
// Après : 3 axes (mode, palette, densité)

export const DENSITIES = [
  { id: 'normal', name: 'Normal', description: 'Espacement standard' },
  { id: 'compact', name: 'Compact', description: 'Densité réduite' },
];

// Nouveaux retours du hook
const { density, isCompact, setDensity, toggleDensity } = useTheme();
```

| Export | Type | Description |
|--------|------|-------------|
| `PALETTES` | Array | 10 palettes (9 existantes + tv-display) |
| `DENSITIES` | Array | 2 densités (normal, compact) |
| `density` | string | `'normal'` ou `'compact'` |
| `isCompact` | boolean | `density === 'compact'` |
| `setDensity(d)` | function | Applique une densité |
| `toggleDensity()` | function | Bascule normal ↔ compact |

### `main.jsx` — Imports CSS ajoutés

```javascript
import './theme-density.css'  // 🆕
import './theme-tv.css'       // 🆕
```

---

## Architecture du système

```
<html data-theme="dark" data-palette="flat-material" data-density="compact">

┌─ :root ──────────────────────────────────────────────────┐
│  Tokens de base (light mode)                             │
│  ~200 custom properties                                  │
├─ [data-theme="dark"] ────────────────────────────────────┤
│  Override ~80 couleurs + shadows                         │
├─ [data-palette="flat-material"] ─────────────────────────┤
│  Override couleurs primaires/secondaires/accents         │
├─ [data-palette="..."][data-theme="dark"] ────────────────┤
│  Override palette × dark                                 │
├─ [data-density="compact"] ───────────────────────────────┤
│  Override spacings, fonts, heights (indép. palette/mode) │
└──────────────────────────────────────────────────────────┘
```

### Combinaisons possibles

| Mode | Palette | Densité | Exemple d'usage |
|------|---------|---------|-----------------|
| light | default | normal | Utilisation standard |
| dark | default | normal | Mode nuit classique |
| light | flat-minimal | compact | Dashboard dense, lumière du jour |
| dark | vscode-dark | normal | Développeur, VS Code mode |
| dark | tv-display | normal | Prévisualisation écran TV |
| light | flat-warm | compact | Terracotta compact |

**Total combinaisons** : 2 modes × 10 palettes × 2 densités = **40 combinaisons**

---

## Fichiers CSS du système complet

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `theme.css` | 1223 | Tokens de base + dark mode + classes utilitaires |
| `theme-palettes.css` | 868 | 6 palettes flat design × 2 modes |
| `theme-vscode.css` | 1187 | 2 palettes VS Code + overrides complets |
| `theme-density.css` | 195 | 🆕 Densité compacte |
| `theme-tv.css` | 232 | 🆕 Palette TV haute visibilité |
| **Total** | **3705** | |

---

## Prochaine étape

**Étape 8 — Documentation automatique** : Générer la documentation complète du Design System.
