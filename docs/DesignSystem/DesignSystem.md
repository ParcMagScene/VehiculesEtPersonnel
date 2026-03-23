# 📖 eM@g Design System — Documentation Complète

> Généré automatiquement — Étape 8  
> Date : 23 mars 2026  
> Version : 1.0

---

## Table des matières

1. [Tokens de design](#1--tokens-de-design)
2. [Composants](#2--composants)
3. [Règles UX](#3--règles-ux)
4. [Thèmes](#4--thèmes)
5. [Exemples](#5--exemples)
6. [Bonnes pratiques](#6--bonnes-pratiques)
7. [Anti-patterns](#7--anti-patterns)
8. [Roadmap d'intégration](#8--roadmap-dintégration)

---

## 1. 🎨 Tokens de design

Les tokens sont définis dans `apps/web/src/theme.css` et consommés via `var(--token)`.

### 1.1 Couleurs principales

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--theme-primary` | `#667eea` | `#818cf8` | Accent principal, liens, boutons CTA |
| `--theme-secondary` | `#764ba2` | `#a78bfa` | Dégradé secondaire |
| `--theme-primary-dark` | `#5b21b6` | `#7c3aed` | Variation sombre |
| `--theme-primary-hover` | `#7c3aed` | `#a78bfa` | État hover |
| `--theme-primary-light` | `#8b5cf6` | `#c4b5fd` | Variation claire |
| `--theme-accent` | `#a855f7` | `#c084fc` | Accent fort |

### 1.2 Couleurs sémantiques

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--theme-danger` | `#ef4444` | `#f87171` | Erreurs, suppression |
| `--theme-success` | `#22c55e` | `#4ade80` | Confirmation, validation |
| `--theme-warning` | `#f59e0b` | `#fbbf24` | Avertissements |
| `--theme-info` | `#3b82f6` | `#60a5fa` | Information |

Chaque couleur sémantique dispose de variantes : `-dark`, `-bg`, `-border`, `-text`.

### 1.3 Texte

| Token | Light | Dark |
|-------|-------|------|
| `--theme-text-primary` | `#1e293b` | `#f1f5f9` |
| `--theme-text-secondary` | `#64748b` | `#94a3b8` |
| `--theme-text-muted` | `#94a3b8` | `#64748b` |
| `--theme-text-heading` | `#111827` | `#f8fafc` |

### 1.4 Fonds

| Token | Light | Dark |
|-------|-------|------|
| `--theme-bg-page` | `#f8fafc` | `#0f172a` |
| `--theme-bg-card` | `white` | `#1e293b` |
| `--theme-bg-secondary` | `#f9fafb` | `#1e293b` |
| `--theme-bg-tertiary` | `#f3f4f6` | `#334155` |
| `--theme-bg-hover` | `#eef2ff` | `#2d3554` |

### 1.5 Bordures

| Token | Light | Dark |
|-------|-------|------|
| `--theme-border` | `#e2e8f0` | `#334155` |
| `--theme-border-light` | `#f1f5f9` | `#1e293b` |
| `--theme-border-medium` | `#e5e7eb` | `#374151` |
| `--theme-border-focus` | `#8b5cf6` | `#a78bfa` |

### 1.6 Espacement (Spacing)

| Token | Valeur | Token | Valeur |
|-------|--------|-------|--------|
| `--space-0` | `0` | `--space-8` | `32px` |
| `--space-1` | `4px` | `--space-10` | `40px` |
| `--space-2` | `8px` | `--space-12` | `48px` |
| `--space-3` | `12px` | `--space-14` | `56px` |
| `--space-4` | `16px` | `--space-16` | `64px` |
| `--space-5` | `20px` | `--space-20` | `80px` |
| `--space-6` | `24px` | `--space-24` | `96px` |

### 1.7 Typographie

| Token | Valeur | Usage |
|-------|--------|-------|
| `--font-2xs` | `0.65rem` | Labels micro |
| `--font-xs` | `0.72rem` | Tags, badges |
| `--font-sm` | `0.8rem` | Texte petit |
| `--font-base` | `0.875rem` | Texte courant |
| `--font-md` | `1rem` | Sous-titres |
| `--font-lg` | `1.125rem` | Titres section |
| `--font-xl` | `1.25rem` | Titres page |
| `--font-2xl` | `1.5rem` | Titres modaux |
| `--font-3xl` | `1.875rem` | Hero |
| `--font-4xl` | `2.25rem` | Display |

**Poids** : `--weight-normal` (400), `--weight-medium` (500), `--weight-semibold` (600), `--weight-bold` (700)

**Interlignage** : `--leading-tight` (1.25), `--leading-snug` (1.375), `--leading-normal` (1.5), `--leading-relaxed` (1.625)

### 1.8 Border Radius

| Token | Valeur | Usage |
|-------|--------|-------|
| `--radius-xs` | `4px` | Badges, tags |
| `--radius-sm` | `6px` | Inputs, boutons sm |
| `--radius-md` | `8px` | Boutons, cartes |
| `--radius-lg` | `12px` | Modaux, panneaux |
| `--radius-xl` | `16px` | Grandes cartes |
| `--radius-2xl` | `20px` | Hero sections |
| `--radius-full` | `9999px` | Avatars, pills |

### 1.9 Ombres

| Token | Light | Usage |
|-------|-------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | Cards |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | Dropdowns |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.12)` | Modaux |
| `--shadow-xl` | `0 12px 40px rgba(0,0,0,0.15)` | Overlays |
| `--shadow-modal` | `0 20px 60px rgba(0,0,0,0.25)` | Modal principal |

### 1.10 Z-Index

| Token | Valeur | Usage |
|-------|--------|-------|
| `--z-base` | `1` | Éléments normaux |
| `--z-dropdown` | `100` | Menus déroulants |
| `--z-sticky` | `200` | Headers fixes |
| `--z-overlay` | `1000` | Overlays page |
| `--z-modal` | `2000` | Modaux |
| `--z-modal-nested` | `2500` | Modal dans modal |
| `--z-popover` | `3000` | Popovers |
| `--z-draggable` | `4000` | Éléments en drag |
| `--z-toast` | `5000` | Toasts |
| `--z-tooltip` | `9999` | Tooltips |

### 1.11 Transitions

| Token | Valeur | Usage |
|-------|--------|-------|
| `--duration-fast` | `150ms` | Hover, toggle |
| `--duration-normal` | `200ms` | Boutons, onglets |
| `--duration-smooth` | `300ms` | Modaux, drawers |
| `--duration-slow` | `400ms` | Transitions page |
| `--ease-in-out` | `cubic-bezier(0.4,0,0.2,1)` | Standard |
| `--ease-out` | `cubic-bezier(0,0,0.2,1)` | Apparitions |
| `--ease-spring` | `cubic-bezier(0.34,1.56,0.64,1)` | Modaux |

---

## 2. 🧱 Composants

### 2.1 Import

```jsx
import { Button, Input, Modal, Tabs, Tab } from '../components/ui';
```

Tous les composants sont disponibles depuis le barrel `components/ui/index.js`.

### 2.2 Catalogue complet (43 exports)

#### Atomes (10)

| Composant | Props principales | Description |
|-----------|-------------------|-------------|
| `Button` | `variant`, `size`, `icon`, `loading`, `disabled` | Bouton universel. Variants : primary, secondary, danger, success, warning, ghost, outline |
| `Input` | `size`, `icon`, `error`, `clearable` | Champ texte. Supporte type, prefix icon, clear button |
| `Checkbox` | `checked`, `onChange`, `label`, `disabled` | Case à cocher accessible |
| `Toggle` | `checked`, `onChange`, `label`, `disabled` | Interrupteur on/off |
| `Tag` | `variant`, `size`, `removable`, `onRemove` | Étiquette colorée. 8 variantes sémantiques |
| `Badge` | `variant`, `size`, `dot`, `pulse` | Pastille de compteur / statut |
| `Avatar` | `src`, `name`, `size` | Photo de profil ou initiales |
| `Tooltip` | `content`, `position`, `delay` | Info-bulle au survol (4 positions) |
| `Spinner` | `size`, `color` | Indicateur de chargement rotatif |
| `LoadingOverlay` | `message` | Overlay avec spinner et texte |

#### Molécules (11)

| Composant | Props principales | Description |
|-----------|-------------------|-------------|
| `DropdownMenu` | `trigger`, `align`, `width` | Menu contextuel via portal |
| `DropdownItem` | `icon`, `onClick`, `disabled`, `danger` | Entrée du menu |
| `DropdownDivider` | — | Séparateur visuel |
| `Tabs` | `value`, `onChange` | Conteneur d'onglets contrôlé |
| `TabList` | — | Barre d'onglets (role=tablist) |
| `Tab` | `value`, `icon`, `disabled` | Onglet individuel |
| `TabPanel` | `value` | Panneau de contenu d'onglet |
| `Accordion` | `items`, `multiple`, `defaultOpen` | Sections repliables |
| `SearchBar` | `value`, `onChange`, `placeholder` | Barre de recherche avec icône et clear |
| `FilterBar` | `filters`, `values`, `onChange` | Barre de filtres multi-critères |
| `ListItem` | `icon`, `title`, `subtitle`, `actions`, `selected` | Ligne de liste interactive |

#### Organismes (16)

| Composant | Props principales | Description |
|-----------|-------------------|-------------|
| `Modal` | `open`, `onClose`, `size` | Modal portail. Tailles : sm, md, lg, xl, full |
| `ModalHeader` | `icon`, `title`, `onClose` | En-tête gradient avec bouton X |
| `ModalBody` | — | Corps scrollable |
| `ModalFooter` | `align` | Pied avec boutons d'action |
| `Dialog` | `open`, `onClose`, `onConfirm`, `variant`, `title` | Dialogue de confirmation (5 variantes) |
| `Drawer` | `open`, `onClose`, `side`, `width`, `title` | Panneau latéral glissant (gauche/droite) |
| `PageHeader` | `icon`, `title`, `subtitle`, `badge`, `actions` | En-tête de page avec breadcrumb |
| `FormLayout` | `onSubmit` | Conteneur de formulaire sémantique |
| `FormSection` | `title`, `description` | Section de formulaire (fieldset/legend) |
| `FormRow` | — | Ligne CSS grid auto-fit |
| `FormActions` | `align` | Boutons de fin de formulaire |
| `ModuleLayout` | — | Layout pleine hauteur pour module |
| `ModuleToolbar` | — | Barre d'outils avec wrapping |
| `ModuleContent` | `noPadding` | Zone scrollable principale |
| `ModuleFooter` | — | Barre de statut/pagination |
| `SplitLayout` | `sidebarWidth`, `side` | Layout sidebar + contenu |

#### Existants refactorisés (6)

| Composant | Description |
|-----------|-------------|
| `Card` | Carte générique avec en-tête et corps |
| `Panel` | Panneau avec forwardRef, header/body/footer |
| `SectionHeader` | Titre de section avec icône |
| `Table` | Tableau avec tri, sélection, pagination |
| `ScrollArea` | Zone de scroll personnalisée |
| `FormField` | Champ de formulaire avec label, error, hint |

---

## 3. 🎭 Règles UX

### 3.1 Modaux & Overlays

| Règle | Comportement |
|-------|-------------|
| Contrôle | Via prop `open` (boolean) + callback `onClose` |
| Rendu | Portal (`createPortal` → `document.body`) |
| Backdrop | `mouseDown` pour fermer (pas click) |
| Escape | Ferme toujours la couche la plus haute |
| Scroll | `body.overflow = 'hidden'` quand ouvert |
| Focus | Sauvegardé à l'ouverture, restauré à la fermeture |

### 3.2 Transitions

| Interaction | Durée | Easing |
|------------|-------|--------|
| Hover, toggle | `--duration-fast` (150ms) | ease |
| Boutons, inputs | `--duration-normal` (200ms) | ease |
| Modaux, drawers | `--duration-smooth` (300ms) | spring/ease-in-out |
| Page transitions | `--duration-slow` (400ms) | ease-in-out |

**Toujours respecter** `@media (prefers-reduced-motion: reduce)`.

### 3.3 Focus

- `:focus-visible` uniquement (pas `:focus`)
- Ring : `--focus-ring: 0 0 0 3px rgba(102, 126, 234, 0.15)`
- Autofocus sur le premier input dans les modaux
- Tab navigue séquentiellement dans les overlays

### 3.4 Validation

| Moment | Quoi | Feedback |
|--------|------|----------|
| Saisie | Rien tant que le champ n'a pas été touché | — |
| Blur | Validation complète du champ | Bordure rouge + message sous l'input |
| Submit | Re-validation globale | Toast error si échec ; scroll vers la première erreur |

- `aria-invalid="true"` sur les inputs en erreur
- `aria-describedby` reliant l'input au message

### 3.5 Toasts

```jsx
const { toast } = useFeedback();
toast.success('Sauvegardé');
toast.error('Erreur serveur');
toast.warning('Stock bas');
toast.info('Import disponible');
```

| Type | Durée | Icône |
|------|-------|-------|
| success | 3.5s | CheckCircle |
| error | 6s | XCircle |
| warning | 5s | AlertTriangle |
| info | 4s | Info |

Position : bottom-right (desktop), bottom-center (mobile). Stack max : 5.

### 3.6 Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `Mod+1–5` | Navigation modules |
| `Mod+M` | Messagerie |
| `Mod+N` | Nouvelle réservation |
| `Mod+,` | Préférences |
| `Mod+T` | Aujourd'hui |
| `F1` | Aide |
| `Escape` | Fermer fenêtre active |
| `←` / `→` | Navigation calendrier |

`Mod` = `⌘` (Mac) / `Ctrl` (Windows). Désactivés dans les zones de saisie (sauf Escape).

### 3.7 Mobile & tactile

- Cibles tactiles min 44×44px
- Breakpoints : 768px (tablette), 640px (mobile), 480px (petit)
- Pas de fonctionnalité cachée derrière un hover
- Drawer → pleine largeur sur mobile
- Modal → 92-96vw sur mobile

---

## 4. 🎡 Thèmes

### 4.1 Architecture 3 axes

```html
<html data-theme="dark" data-palette="flat-material" data-density="compact">
```

| Axe | Attribut | Valeurs | localStorage |
|-----|----------|---------|-------------|
| Mode | `data-theme` | `light`, `dark` | `emag-theme` |
| Palette | `data-palette` | `default`, 7 flat, 2 vscode, `tv-display` | `emag-palette` |
| Densité | `data-density` | `normal`, `compact` | `emag-density` |

**40 combinaisons** possibles (2 × 10 × 2).

### 4.2 Hook useTheme

```jsx
import { useTheme, PALETTES, DENSITIES } from '../hooks/useTheme';

const { 
  theme,           // 'light' | 'dark'
  isDark,          // boolean
  toggleTheme,     // () => void
  setTheme,        // (theme) => void
  palette,         // 'default' | 'flat-*' | 'vscode-*' | 'tv-display'
  setPalette,      // (id) => void
  density,         // 'normal' | 'compact'
  isCompact,       // boolean
  setDensity,      // (density) => void
  toggleDensity,   // () => void
} = useTheme();
```

### 4.3 Palettes disponibles

| ID | Nom | Caractère |
|----|-----|-----------|
| `default` | Violet | Thème classique eM@g |
| `flat-pastel` | Flat Pastel | Tons doux et chaleureux |
| `flat-material` | Flat Material | Google Material Design |
| `flat-minimal` | Flat Minimal | Monochrome, accent rouge |
| `flat-neon-soft` | Flat Néon | Cyberpunk adouci |
| `flat-warm` | Flat Warm | Terracotta, tons chauds |
| `flat-cold` | Flat Cold | Acier bleu, tons froids |
| `vscode-dark` | VS Code Dark+ | IDE sombre, dense, monospace |
| `vscode-light` | VS Code Light+ | IDE clair |
| `tv-display` | TV Display | Noir/cyan, contraste élevé AAA |

### 4.4 Fichiers CSS

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `theme.css` | 1223 | Tokens de base + dark mode + classes utilitaires |
| `theme-palettes.css` | 868 | 6 palettes flat × 2 modes |
| `theme-vscode.css` | 1187 | 2 palettes VS Code + overrides complets |
| `theme-density.css` | 195 | Mode compact (densité réduite) |
| `theme-tv.css` | 232 | Palette TV haute visibilité |

---

## 5. 📝 Exemples

### 5.1 Formulaire complet

```jsx
import { 
  Modal, ModalHeader, ModalBody, ModalFooter,
  FormLayout, FormSection, FormRow, FormActions,
  Input, Checkbox, Button 
} from '../components/ui';

function CreateVehicleModal({ open, onClose }) {
  const [form, setForm] = useState({});
  const { toast } = useFeedback();

  const handleSubmit = async () => {
    try {
      await api.post('/vehicles', form);
      toast.success('Véhicule créé');
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader icon={Truck} title="Nouveau véhicule" onClose={onClose} />
      <ModalBody>
        <FormLayout onSubmit={handleSubmit}>
          <FormSection title="Identification">
            <FormRow>
              <Input label="Immatriculation" required value={form.plate} 
                     onChange={e => setForm({...form, plate: e.target.value})} />
              <Input label="Marque" value={form.brand} 
                     onChange={e => setForm({...form, brand: e.target.value})} />
            </FormRow>
          </FormSection>
          <FormSection title="Options">
            <Checkbox label="Véhicule actif" checked={form.active} 
                      onChange={e => setForm({...form, active: e.target.checked})} />
          </FormSection>
          <FormActions>
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
            <Button variant="primary" type="submit" loading={saving}>Créer</Button>
          </FormActions>
        </FormLayout>
      </ModalBody>
    </Modal>
  );
}
```

### 5.2 Page module

```jsx
import {
  ModuleLayout, ModuleToolbar, ModuleContent, ModuleFooter,
  PageHeader, SearchBar, FilterBar, Button, Table
} from '../components/ui';

function VehiclesModule() {
  return (
    <ModuleLayout>
      <PageHeader icon={Truck} title="Parc véhicules" badge={count} 
                  actions={<Button icon={Plus}>Ajouter</Button>} />
      <ModuleToolbar>
        <SearchBar value={search} onChange={setSearch} />
        <FilterBar filters={FILTERS} values={filters} onChange={setFilters} />
      </ModuleToolbar>
      <ModuleContent>
        <Table columns={columns} data={vehicles} />
      </ModuleContent>
      <ModuleFooter>
        <span>{count} véhicules</span>
      </ModuleFooter>
    </ModuleLayout>
  );
}
```

### 5.3 Confirmation de suppression

```jsx
import { Dialog } from '../components/ui';

<Dialog
  open={showDelete}
  onClose={() => setShowDelete(false)}
  onConfirm={handleDelete}
  variant="danger"
  title="Supprimer ce véhicule ?"
  confirmLabel="Supprimer"
  loading={deleting}
>
  Cette action est irréversible. Le véhicule sera définitivement supprimé.
</Dialog>
```

### 5.4 Layout avec sidebar

```jsx
import { SplitLayout, ModuleContent } from '../components/ui';

<SplitLayout sidebarWidth="280px">
  <nav>Sidebar navigation</nav>
  <ModuleContent>
    Contenu principal
  </ModuleContent>
</SplitLayout>
```

### 5.5 Thème switching

```jsx
import { useTheme, PALETTES, DENSITIES } from '../hooks/useTheme';

function ThemeSelector() {
  const { isDark, toggleTheme, palette, setPalette, isCompact, toggleDensity } = useTheme();

  return (
    <div>
      <Button onClick={toggleTheme}>{isDark ? '☀️' : '🌙'}</Button>
      <Button onClick={toggleDensity}>{isCompact ? 'Normal' : 'Compact'}</Button>
      <select value={palette} onChange={e => setPalette(e.target.value)}>
        {PALETTES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  );
}
```

---

## 6. ✅ Bonnes pratiques

### Tokens

| ✅ Faire | ❌ Ne pas faire |
|----------|----------------|
| `color: var(--theme-text-primary)` | `color: #1e293b` |
| `padding: var(--space-4)` | `padding: 16px` |
| `border-radius: var(--radius-md)` | `border-radius: 8px` |
| `transition: var(--duration-fast)` | `transition: 0.15s` |
| `z-index: var(--z-modal)` | `z-index: 99999` |

### Composants

| ✅ Faire | ❌ Ne pas faire |
|----------|----------------|
| `<Button variant="danger">` | `<button className="red-btn">` |
| `<Modal>` (portail) | `<div className="custom-overlay">` |
| `<Dialog variant="confirm">` | `window.confirm()` |
| `<Input error="msg" />` | Erreurs CSS manuelles |
| `<Spinner />` pendant le chargement | Texte "Loading..." brut |

### Structure

| ✅ Faire | ❌ Ne pas faire |
|----------|----------------|
| Importer depuis `components/ui` | Importer chaque fichier individuellement |
| Un seul `useTheme()` par arbre | Plusieurs providers imbriqués |
| `data-density="compact"` | Classes `.compact` ad-hoc |
| `FormLayout` + `FormSection` | `<div>` sans sémantique |

### Accessibilité

| ✅ Faire | ❌ Ne pas faire |
|----------|----------------|
| `:focus-visible` | `:focus` (ring au clic) |
| `aria-invalid` sur erreur | Couleur seule comme indicateur |
| `role="dialog"` + `aria-modal` | Overlay sans rôle ARIA |
| Cibles ≥ 44×44px (mobile) | Boutons 24px sur tactile |
| `prefers-reduced-motion` | Animations forcées |

---

## 7. 🚫 Anti-patterns

### AP-1 : Hardcoded colors
```css
/* ❌ */ .my-card { background: #f8fafc; color: #1e293b; }
/* ✅ */ .my-card { background: var(--theme-bg-page); color: var(--theme-text-primary); }
```
**Pourquoi** : Casse le dark mode et toutes les palettes.

### AP-2 : Z-index anarchique
```css
/* ❌ */ .my-modal { z-index: 999999; }
/* ✅ */ .my-modal { z-index: var(--z-modal); }
```
**Pourquoi** : Empêche les toasts et tooltips de s'afficher au-dessus.

### AP-3 : Modal sans portail
```jsx
// ❌ Inline dans le composant
<div className="overlay">{children}</div>

// ✅ Portal vers body
createPortal(<div className="overlay">{children}</div>, document.body)
```
**Pourquoi** : Le modal hérite du `overflow: hidden` du parent et est coupé.

### AP-4 : Confirmation avec window.confirm
```jsx
// ❌ 
if (window.confirm('Supprimer ?')) { ... }

// ✅
<Dialog variant="danger" title="Supprimer ?" onConfirm={handleDelete} />
```
**Pourquoi** : Bloque le thread, pas stylisable, pas d'animation.

### AP-5 : Fragment de formulaire sans FormField
```jsx
// ❌ Label flottant sans liaison
<label>Email</label>
<input value={email} />
<span className="error">{error}</span>

// ✅ Lié par aria-describedby
<FormField label="Email" error={error} required>
  <Input error={!!error} value={email} onChange={...} />
</FormField>
```
**Pourquoi** : Pas d'association label/input, pas d'aria-invalid automatique.

### AP-6 : Ombre personnalisée
```css
/* ❌ */ box-shadow: 0 10px 30px rgba(0,0,0,0.2);
/* ✅ */ box-shadow: var(--shadow-lg);
```
**Pourquoi** : Les ombres sont ajustées par thème (plus lourdes en dark mode).

### AP-7 : Transition sans token
```css
/* ❌ */ transition: all 0.3s ease;
/* ✅ */ transition: all var(--duration-smooth) var(--ease-in-out);
```
**Pourquoi** : Ignore `prefers-reduced-motion` et les overrides VS Code.

### AP-8 : Spinner fait maison
```jsx
// ❌ 
<div className="my-spinner">Chargement...</div>

// ✅
<Spinner size="md" />
// ou
<LoadingOverlay message="Chargement des données..." />
```
**Pourquoi** : Chaque spinner réinvente l'animation et l'accessibilité (`role="status"`).

---

## 8. 🗺️ Roadmap d'intégration

### Phase A — Fondations (fait ✅)

| Tâche | Statut |
|-------|--------|
| Définir les tokens dans theme.css | ✅ |
| Créer les composants atomiques | ✅ 10 composants |
| Créer les composants moléculaires | ✅ 11 composants |
| Créer les composants organismes | ✅ 16 composants |
| Documenter les règles UX | ✅ |
| Implémenter les 5 thèmes | ✅ |
| Barrel export dans index.js | ✅ 43 exports |

### Phase B — Migration progressive

| Priorité | Module | Effort | Impact |
|----------|--------|--------|--------|
| 🔴 P0 | Modaux existants → `<Modal>` / `<Dialog>` | Moyen | 30+ fichiers |
| 🔴 P0 | `window.confirm` → `<Dialog>` | Faible | ~10 occurrences |
| 🟠 P1 | Slide-panels → `<Drawer>` | Moyen | 5+ composants |
| 🟠 P1 | Boutons legacy → `<Button>` | Élevé | ~200 boutons |
| 🟡 P2 | Headers → `<PageHeader>` | Faible | 8 modules |
| 🟡 P2 | Formulaires → `<FormLayout>` | Moyen | 20+ formulaires |
| 🟢 P3 | Layout modules → `<ModuleLayout>` | Faible | 8 modules |
| 🟢 P3 | Listes → `<ListItem>` | Faible | ~15 listes |
| 🔵 P4 | Inputs legacy → `<Input>` | Élevé | ~150 inputs |
| 🔵 P4 | Tags/badges inline → `<Tag>` / `<Badge>` | Moyen | ~50 occurrences |

### Phase C — Nettoyage

| Tâche | Quand |
|-------|-------|
| Supprimer les classes `.theme-btn-*` legacy | Après migration P1 |
| Supprimer `ConfirmDialog.jsx` (legacy) | Après migration P0 |
| Supprimer les CSS inline hardcodés | Après migration P4 |
| Audit accessibilité automatisé (axe-core) | Après Phase B |
| Tests visuels (Chromatic/Percy) | Après Phase B |

### Phase D — Évolutions futures

| Fonctionnalité | Description |
|----------------|-------------|
| Storybook | Catalogue interactif de composants |
| Tests de régression visuelle | Screenshot testing automatisé |
| Tokens design → Figma | Sync bidirectionnelle tokens ↔ design |
| Composants avancés | DatePicker, Select, Combobox, DataGrid |
| Animations orchestrées | Framer Motion / CSS view transitions |

---

## Annexe : Arbre des fichiers

```
apps/web/src/
├── theme.css                    # Tokens + dark + utils (1223 lignes)
├── theme-palettes.css           # Palettes flat (868 lignes)
├── theme-vscode.css             # VS Code mode (1187 lignes)
├── theme-density.css            # Compact mode (195 lignes)
├── theme-tv.css                 # TV display (232 lignes)
├── hooks/
│   ├── useTheme.js              # Hook 3 axes (mode/palette/densité)
│   ├── useFeedback.js           # API toast impérative
│   └── useKeyboardShortcuts.js  # 13 raccourcis globaux
└── components/ui/
    ├── index.js                 # Barrel (43 exports)
    ├── Button.jsx + .css        # Atome
    ├── Input.jsx + .css         # Atome
    ├── Checkbox.jsx + .css      # Atome (Checkbox + Toggle)
    ├── Tag.jsx + .css           # Atome (Tag + Badge)
    ├── Avatar.jsx + .css        # Atome
    ├── Tooltip.jsx + .css       # Atome
    ├── Loader.jsx + .css        # Atome (Spinner + LoadingOverlay)
    ├── DropdownMenu.jsx + .css  # Molécule
    ├── Tabs.jsx + .css          # Molécule (Tabs/TabList/Tab/TabPanel)
    ├── Accordion.jsx + .css     # Molécule
    ├── SearchBar.jsx + .css     # Molécule
    ├── FilterBar.jsx + .css     # Molécule
    ├── ListItem.jsx + .css      # Molécule
    ├── Modal.jsx + .css         # Organisme
    ├── Dialog.jsx + .css        # Organisme
    ├── Drawer.jsx + .css        # Organisme
    ├── PageHeader.jsx + .css    # Organisme
    ├── FormLayout.jsx + .css    # Organisme
    ├── ModuleLayout.jsx + .css  # Organisme
    ├── Card.jsx                 # Existant
    ├── Panel.jsx                # Existant
    ├── SectionHeader.jsx        # Existant
    ├── Table.jsx                # Existant
    ├── ScrollArea.jsx           # Existant
    └── FormField.jsx            # Existant
```
