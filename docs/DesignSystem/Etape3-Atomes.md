# 🧱 Étape 3 — Composants atomiques (Atoms)

> Date : 23 mars 2026  
> Fichiers créés : 14 (7 .jsx + 7 .css)  
> Tokens ajoutés : ~55 nouveaux tokens + dark mode overrides

---

## 📦 Résumé des livrables

| Composant | Fichier JSX | Fichier CSS | Export |
|-----------|-------------|-------------|--------|
| **Button** | `components/ui/Button.jsx` | `components/ui/Button.css` | `default` |
| **Input** | `components/ui/Input.jsx` | `components/ui/Input.css` | `default` |
| **Checkbox** | `components/ui/Checkbox.jsx` | `components/ui/Checkbox.css` | `named: Checkbox` |
| **Toggle** | `components/ui/Checkbox.jsx` | `components/ui/Checkbox.css` | `named: Toggle` |
| **Tag** | `components/ui/Tag.jsx` | `components/ui/Tag.css` | `named: Tag` |
| **Badge** | `components/ui/Tag.jsx` | `components/ui/Tag.css` | `named: Badge` |
| **Avatar** | `components/ui/Avatar.jsx` | `components/ui/Avatar.css` | `default` |
| **Tooltip** | `components/ui/Tooltip.jsx` | `components/ui/Tooltip.css` | `default` |
| **Spinner** | `components/ui/Loader.jsx` | `components/ui/Loader.css` | `named: Spinner` |
| **LoadingOverlay** | `components/ui/Loader.jsx` | `components/ui/Loader.css` | `named: LoadingOverlay` |

Tous les CSS sont importés automatiquement via `components/ui/index.js`.

---

## 1. 🔘 Button

### Structure
```jsx
<Button variant="primary" size="md" iconOnly loading disabled>
  <Save size={16} /> Enregistrer
</Button>
```

### Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'success' \| 'warning' \| 'ghost'` | `'primary'` | Style visuel |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` | `'md'` | Taille |
| `iconOnly` | `boolean` | `false` | Mode bouton carré (icône seule) |
| `loading` | `boolean` | `false` | Affiche un spinner, désactive les clics |
| `disabled` | `boolean` | `false` | État désactivé |
| `type` | `string` | `'button'` | Type HTML (button/submit/reset) |
| `className` | `string` | `''` | Classes CSS additionnelles |

### Variantes
- **primary** : Fond gradient indigo, texte blanc, shadow au hover
- **secondary** : Fond neutre, bordure, texte sombre
- **danger** : Fond rouge pâle, texte rouge, bordure rouge
- **success** : Fond vert pâle, texte vert, bordure verte
- **warning** : Fond orange pâle, texte orange, bordure orange
- **ghost** : Transparent, texte grisé, fond hover

### États
- **hover** : Transform translateY(-1px) + shadow (primary), bg-change (autres)
- **active** : Transform retour (primary)
- **disabled** : Opacité 0.55, cursor not-allowed
- **loading** : Spinner Lucide + enfants semi-transparents, `aria-busy="true"`
- **focus-visible** : Focus ring violet (`--focus-ring`)

### Accessibilité
- `type="button"` par défaut (évite les soumissions accidentelles)
- `aria-busy` quand loading
- `disabled` natif + `pointer-events: none`
- `:focus-visible` pour navigation clavier uniquement

### Tokens utilisés
`--btn-radius`, `--btn-font-weight`, `--btn-transition`, `--btn-height-{xs,sm,md,lg}`, `--btn-padding-{xs,sm,md,lg}`, `--btn-font-size-{xs,sm,md,lg}`, `--btn-primary-bg/color/shadow/hover-shadow`, `--btn-secondary-*`, `--btn-danger-*`, `--btn-success-*`, `--btn-warning-*`, `--focus-ring`

### Migration existante
Remplace les 200+ instances de `.theme-btn-primary`, `.theme-btn-secondary`, etc. Les anciennes classes restent fonctionnelles pendant la transition.

---

## 2. ✏️ Input

### Structure
```jsx
<Input
  size="md"
  error={!!errors.name}
  prefix={<Search size={16} />}
  suffix={<X size={16} />}
  placeholder="Rechercher…"
/>
```

### Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Taille |
| `error` | `boolean` | `false` | État d'erreur (bordure rouge) |
| `prefix` | `ReactNode` | — | Icône/élément en début |
| `suffix` | `ReactNode` | — | Icône/élément en fin |
| `className` | `string` | `''` | Sur le wrapper |

Tous les attributs `<input>` natifs sont transmis (`type`, `value`, `onChange`, `placeholder`, `disabled`…).

### Variantes de taille
- **sm** : 32px de haut, font-sm, padding réduit
- **md** : 40px de haut, font-base, padding standard
- **lg** : 48px de haut, font-md, padding large

### États
- **focus** : Bordure `--theme-border-focus` + focus ring
- **error** : Bordure `--theme-danger`, focus ring rouge
- **disabled** : Opacité 0.6, fond grisé, cursor not-allowed

### Accessibilité
- `aria-invalid` automatique quand `error=true`
- Focus natif sur `<input>` interne
- Labels via `<FormField>` existant (composition)
- ref forwarded sur l'input

### Tokens utilisés
`--theme-border`, `--theme-border-focus`, `--theme-danger`, `--radius-md`, `--theme-bg-card`, `--theme-bg-tertiary`, `--theme-border-disabled`, `--theme-text-primary`, `--theme-text-muted`, `--theme-text-disabled`, `--btn-height-{sm,md,lg}`, `--font-{sm,base,md}`, `--space-{1,2,3,4}`, `--focus-ring`, `--duration-fast`

---

## 3. ☑️ Checkbox

### Structure
```jsx
<Checkbox
  checked={isChecked}
  onChange={(e) => setChecked(e.target.checked)}
  label="Accepter les conditions"
  indeterminate={someSelected}
/>
```

### Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `checked` | `boolean` | `false` | État coché |
| `onChange` | `function` | — | Handler de changement |
| `label` | `string` | — | Texte du label |
| `disabled` | `boolean` | `false` | État désactivé |
| `indeterminate` | `boolean` | `false` | État partiel (tiret) |

### États
- **unchecked** : Boîte blanche avec bordure grise
- **checked** : Fond `--theme-primary`, coche SVG blanche
- **indeterminate** : Fond `--theme-primary`, tiret SVG
- **disabled** : Opacité 0.55
- **focus-visible** : Focus ring sur la boîte

### Accessibilité
- `<input type="checkbox">` caché visuellement (sr-only pattern)
- `aria-checked="mixed"` pour indeterminate
- `<label>` cliquable associée via `useId()`
- Checkbox de 18×18px (>= minimum 24px touch target via label)

### Tokens utilisés
`--theme-border-muted`, `--radius-sm`, `--theme-bg-card`, `--theme-primary`, `--focus-ring`, `--font-base`, `--theme-text-primary`, `--duration-fast`, `--space-2`

---

## 4. 🔀 Toggle

### Structure
```jsx
<Toggle
  checked={isDark}
  onChange={(e) => setDark(e.target.checked)}
  label="Mode sombre"
  size="sm"
/>
```

### Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `checked` | `boolean` | `false` | État activé |
| `onChange` | `function` | — | Handler de changement |
| `label` | `string` | — | Texte du label |
| `disabled` | `boolean` | `false` | État désactivé |
| `size` | `'sm' \| 'md'` | `'md'` | Taille du switch |

### États
- **off** : Track gris, thumb à gauche
- **on** : Track `--theme-primary`, thumb translateX à droite
- **disabled** : Opacité 0.55
- **focus-visible** : Focus ring sur le track

### Dimensions
| Taille | Track | Thumb | Déplacement |
|--------|-------|-------|-------------|
| sm | 32×18 | 14×14 | 14px |
| md | 40×22 | 18×18 | 18px |

### Accessibilité
- `role="switch"` sur l'input
- `aria-checked` explicite
- Transition spring (`--ease-spring`) pour le thumb
- Label cliquable

### Tokens utilisés
`--theme-border-muted`, `--theme-primary`, `--shadow-xs`, `--focus-ring`, `--duration-fast`, `--ease-spring`, `--font-base`, `--theme-text-primary`, `--space-2`

---

## 5. 🏷️ Tag

### Structure
```jsx
<Tag color="success" size="sm">Validé</Tag>
<Tag color="danger" closeable onClose={() => remove(id)}>Erreur</Tag>
```

### Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `color` | `'primary' \| 'success' \| 'danger' \| 'warning' \| 'info' \| 'cyan' \| 'amber' \| 'neutral'` | `'primary'` | Couleur |
| `size` | `'sm' \| 'md'` | `'md'` | Taille |
| `closeable` | `boolean` | `false` | Affiche un bouton X |
| `onClose` | `function` | — | Callback quand fermé |

### Dimensions
| Taille | Hauteur | Font | Padding |
|--------|---------|------|---------|
| sm | 20px | `--font-2xs` | 2px 8px |
| md | 24px | `--font-xs` | 3px 10px |

### Couleurs (8 variantes × light/dark)
Chaque couleur utilise `--theme-{color}-bg` (fond) + `--theme-{color}-text` (texte) via les tokens sémantiques, adaptés automatiquement en dark mode.

### Accessibilité
- Bouton close avec `aria-label="Supprimer"`
- Contraste suffisant garanti par le système de tokens

### Tokens utilisés
`--theme-{color}-bg`, `--theme-{color}-text`, `--font-2xs`, `--font-xs`, `--weight-medium`, `--space-1`, `--duration-fast`

---

## 6. 🔴 Badge

### Structure
```jsx
<Badge count={5} color="danger">
  <Bell size={20} />
</Badge>
<Badge dot color="success">
  <Avatar name="Jean" size="sm" />
</Badge>
```

### Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `color` | `'primary' \| 'danger' \| 'success' \| 'warning' \| 'neutral'` | `'danger'` | Couleur |
| `count` | `number` | — | Nombre affiché |
| `dot` | `boolean` | `false` | Point sans nombre |
| `max` | `number` | `99` | Valeur max avant "99+" |

### Modes
- **count** : Pastille numérique 18px, min-width 18px, positionnée en haut à droite
- **dot** : Point 8px, bordé par la couleur du fond pour le détacher visuellement

### Accessibilité
- Le composant enveloppe son enfant sans modifier sa sémantique
- Le badge est visuellement descriptif (à compléter via aria-label sur le parent si nécessaire)

### Tokens utilisés
`--theme-danger`, `--theme-primary`, `--theme-success`, `--theme-warning`, `--theme-neutral`, `--theme-bg-card`, `--weight-bold`

---

## 7. 👤 Avatar

### Structure
```jsx
<Avatar name="Jean Dupont" avatar="/avatars/jean.jpg" size="lg" />
<Avatar name="Marie" size="xs" /> {/* Initiales avec gradient */}
```

### Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `name` | `string` | — | Nom (pour initiales et couleur) |
| `avatar` | `string` | — | URL de l'image |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| number` | `'md'` | Taille |
| `gradient` | `boolean` | `true` | Gradient sur initiales |

### Tailles prédéfinies
| Clé | Pixels | Usage |
|-----|--------|-------|
| xs | 24 | Listes denses, badges |
| sm | 32 | Sidebar, messages |
| md | 40 | Cards, formulaires |
| lg | 56 | Profils |
| xl | 80 | Page profil |

### Implémentation
Le composant `Avatar` est un wrapper standardisé de `UserAvatar.jsx` existant. Il ajoute :
- Des tailles prédéfinies par nom (xs→xl)
- Un wrapper `<span class="ui-avatar">` pour l'intégration dans le DS
- La rétro-compatibilité totale (size en nombre toujours accepté)

### Accessibilité
- `alt` sur l'image (nom de la personne)
- Fallback automatique vers initiales si l'image échoue
- `flexShrink: 0` pour éviter l'écrasement en flex

### Tokens utilisés (via UserAvatar)
`--theme-text-inverse`, `--theme-text-gray` + 12 couleurs hash-based

---

## 8. 💬 Tooltip

### Structure
```jsx
<Tooltip content="Enregistrer les modifications" position="bottom">
  <Button variant="primary" iconOnly>
    <Save size={16} />
  </Button>
</Tooltip>
```

### Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `content` | `string \| ReactNode` | — | Contenu du tooltip |
| `position` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'top'` | Position |
| `delay` | `number` | `200` | Délai d'apparition (ms) |

### Comportement
- Apparaît au `mouseenter` / `focus` après le délai
- Disparaît au `mouseleave` / `blur` instantanément
- Si `content` est falsy, le children est rendu seul (pas de wrapper superflu)
- Animation fade-in 150ms

### Flèche
Chaque position a une flèche CSS (`::after`) pointant vers le déclencheur.

### Cohabitation avec l'existant
Le système CSS existant (`data-emag-tooltip` + `.emag-tooltip` JS) reste fonctionnel. Ce composant React est pour les nouveaux développements et la migration progressive.

### Accessibilité
- `role="tooltip"` sur le contenu
- Déclenché par `focus`/`blur` (navigation clavier)
- `pointer-events: none` sur le tooltip (pas d'interférence)

### Tokens utilisés
`--radius-md`, `--font-xs`, `--shadow-dropdown`, `--leading-normal`

---

## 9. ⏳ Spinner & LoadingOverlay

### Spinner
```jsx
<Spinner size="md" />
<Button variant="primary" loading><Save size={16} /> Sauver</Button>
```

### Props Spinner
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| number` | `'md'` | Taille |

### Tailles Spinner
| Clé | Pixels | Usage |
|-----|--------|-------|
| sm | 16 | Dans les boutons |
| md | 24 | Inline |
| lg | 32 | Overlay conteneur |
| xl | 48 | Overlay plein écran |

### LoadingOverlay
```jsx
<div style={{ position: 'relative' }}>
  <DataTable />
  <LoadingOverlay visible={loading} label="Chargement des données…" />
</div>
```

### Props LoadingOverlay
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `visible` | `boolean` | `true` | Affichage conditionnel |
| `label` | `string` | — | Texte sous le spinner |

### États
- **visible** : Fond semi-transparent + blur, centré, z-index 10
- **hidden** : Non rendu (return null)
- **dark mode** : Fond adapté automatiquement

### Accessibilité
- `role="status"` sur le container
- `aria-hidden` sur le SVG décoratif
- Texte `.sr-only` "Chargement…" pour les lecteurs d'écran

### Tokens utilisés
`--theme-primary`, `--font-sm`, `--theme-text-secondary`, `--weight-medium`, `--space-3`

---

## 📐 Tokens ajoutés (Étape 2 → implémentés)

### theme.css `:root` — ~55 tokens ajoutés

| Catégorie | Tokens |
|-----------|--------|
| Couleurs cyan | `--theme-cyan`, `--theme-cyan-dark`, `--theme-cyan-bg`, `--theme-cyan-text`, `--theme-cyan-border` |
| Couleurs amber | `--theme-amber`, `--theme-amber-bg`, `--theme-amber-text`, `--theme-amber-border` |
| Couleurs neutral | `--theme-neutral`, `--theme-neutral-bg`, `--theme-neutral-text`, `--theme-neutral-border` |
| Texte | `--theme-text-link`, `--theme-text-link-hover`, `--theme-text-disabled`, `--theme-border-disabled` |
| Surfaces | `--theme-bg-active`, `--theme-bg-selected`, `--theme-bg-code` |
| Spacing | `--space-3-5`, `--space-7`, `--space-9`, `--space-14`, `--space-20`, `--space-24` |
| Typography | `--font-4xl`, `--tracking-{tight,snug,normal,wide,wider}` |
| Shadows | `--shadow-inner`, `--shadow-dropdown`, `--shadow-toast` |
| Transitions | `--transition-slow`, `--duration-{fast,normal,smooth,slow}`, `--ease-{in-out,out,spring}` |
| Z-index | `--z-modal-nested`, `--z-draggable` |
| Icons | `--icon-{xs,sm,md,lg,xl,2xl}` |
| Buttons | `--btn-height-{xs,sm,md,lg}`, `--btn-padding-{xs,sm,md,lg}`, `--btn-font-size-{xs,sm,md,lg}`, `--btn-icon-size{,sm,lg}` |

### Dark mode — overrides ajoutés
Tous les tokens cyan, amber, neutral, text-link, text-disabled, border-disabled, bg-active, bg-selected, bg-code, shadow-inner, shadow-dropdown, shadow-toast sont redéfinis dans `[data-theme="dark"]`.

---

## 🔗 Import unifié

```jsx
import {
  Button, Input, Checkbox, Toggle,
  Tag, Badge, Avatar, Tooltip,
  Spinner, LoadingOverlay,
  Card, Panel, FormField, Table, SectionHeader, ScrollArea
} from '../components/ui';
```

Total : **16 composants** exportés depuis le barrel `components/ui/index.js`.

---

## 📋 Convention d'écriture

| Aspect | Convention |
|--------|-----------|
| Nommage CSS | BEM : `.ui-{composant}`, `.ui-{composant}--{variante}`, `.ui-{composant}__{élément}` |
| Props | `className` pour extension, `variant`/`size`/`color` pour les variantes |
| Ref | `forwardRef` pour Button et Input (composants interactifs natifs) |
| États | `disabled` natif, `loading`/`error` via props |
| Accessibilité | ARIA intégré, `focus-visible`, labels cliquables |

---

## 🚀 Prochaine étape

**Étape 4 — Composants moléculaires** : Combiner les atomes en molécules (FormGroup, SearchInput, ActionBar, AlertMessage, ConfirmDialog…).
