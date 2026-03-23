# 🧩 Étape 4 — Composants moléculaires (Molecules)

> Date : 23 mars 2026  
> Fichiers créés : 12 (6 .jsx + 6 .css)  
> Composants existants conservés : Card, Table, FormField, EntityCombobox, SectionHeader, ScrollArea

---

## 📦 Résumé des livrables

### Composants existants (inchangés)

| Composant | Fichier | Rôle |
|-----------|---------|------|
| **Card** | `ui/Card.jsx` | Conteneur avec fond, ombre, flat/compact/clickable |
| **Table** | `ui/Table.jsx` | Tableau avec colonnes, striping, hover, scroll |
| **FormField** | `ui/FormField.jsx` | Label + input + hint/error |
| **EntityCombobox** | `ui/EntityCombobox.jsx` | Dropdown select avec recherche |
| **SectionHeader** | `ui/SectionHeader.jsx` | En-tête de section avec titre + actions |
| **ScrollArea** | `ui/ScrollArea.jsx` | Zone scrollable stylisée |

### Nouveaux composants moléculaires

| Composant | Fichier JSX | Fichier CSS | Export |
|-----------|-------------|-------------|--------|
| **DropdownMenu** | `ui/DropdownMenu.jsx` | `ui/DropdownMenu.css` | `named: DropdownMenu, DropdownItem, DropdownDivider` |
| **Tabs** | `ui/Tabs.jsx` | `ui/Tabs.css` | `named: Tabs, TabList, Tab, TabPanel` |
| **Accordion** | `ui/Accordion.jsx` | `ui/Accordion.css` | `default` |
| **SearchBar** | `ui/SearchBar.jsx` | `ui/SearchBar.css` | `default` |
| **FilterBar** | `ui/FilterBar.jsx` | `ui/FilterBar.css` | `default` |
| **ListItem** | `ui/ListItem.jsx` | `ui/ListItem.css` | `default` |

---

## 1. 📋 DropdownMenu

### Structure
```jsx
<DropdownMenu
  trigger={<Button variant="ghost" iconOnly><MoreVertical size={16}/></Button>}
  align="end"
>
  <DropdownItem icon={<Edit size={14}/>} onClick={handleEdit}>Modifier</DropdownItem>
  <DropdownItem icon={<Copy size={14}/>} onClick={handleCopy}>Dupliquer</DropdownItem>
  <DropdownDivider />
  <DropdownItem icon={<Trash size={14}/>} danger onClick={handleDelete}>Supprimer</DropdownItem>
</DropdownMenu>
```

### DropdownMenu — Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `trigger` | `ReactNode` | — | Élément déclencheur (bouton) |
| `align` | `'start' \| 'end'` | `'end'` | Alignement horizontal |
| `className` | `string` | `''` | Sur le menu |

### DropdownItem — Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `icon` | `ReactNode` | — | Icône à gauche |
| `danger` | `boolean` | `false` | Variante danger (rouge) |
| `disabled` | `boolean` | `false` | Désactivé |

### Comportement
- **Positionnement** : Portal (`createPortal`) en `position: fixed`, calculé depuis le trigger
- **Fermeture** : Click extérieur + touche Escape
- **Propagation** : Click sur un item ferme le menu automatiquement
- **Animation** : Slide-down 0.15s avec scale

### Accessibilité
- `role="menu"` sur le conteneur
- `role="menuitem"` sur chaque item
- `role="separator"` sur le divider
- Fermeture au `Escape`

### Migration existante
Remplace les dropdown patterns manuels dans Header.jsx (user menu), PersonnelContextMenu.jsx, et les menus contextuels ad-hoc.

### Tokens utilisés
`--theme-bg-card`, `--theme-border`, `--radius-lg`, `--shadow-dropdown`, `--space-{1,2,3}`, `--font-sm`, `--theme-text-primary/secondary`, `--theme-bg-hover`, `--theme-danger`, `--theme-danger-bg`, `--theme-border-light`, `--duration-fast`, `--ease-out`

---

## 2. 🗂️ Tabs

### Structure
```jsx
<Tabs defaultValue="general" onChange={v => console.log(v)}>
  <TabList>
    <Tab value="general" icon={<Settings size={16}/>}>Général</Tab>
    <Tab value="stock" badge={12}>Stock</Tab>
    <Tab value="history">Historique</Tab>
  </TabList>
  <TabPanel value="general">…contenu général…</TabPanel>
  <TabPanel value="stock">…contenu stock…</TabPanel>
  <TabPanel value="history">…contenu historique…</TabPanel>
</Tabs>
```

### Tabs — Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `defaultValue` | `string` | — | Onglet actif initial (non contrôlé) |
| `value` | `string` | — | Onglet actif (contrôlé) |
| `onChange` | `function` | — | `(value) => void` |

### Tab — Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `value` | `string` | — | Identifiant unique |
| `icon` | `ReactNode` | — | Icône avant le label |
| `badge` | `number\|string` | — | Badge compteur |
| `disabled` | `boolean` | `false` | Désactivé |

### Variantes visuelles
- **Underline** (par défaut) : Bordure inférieure 2px couleur primary sur l'onglet actif
- **Badge** : Compteur arrondi qui change de couleur quand actif
- **Scrollable** : Overflow horizontal auto + scrollbar caché (mobile)

### États
- **Active** : Texte primary + underline
- **Hover** : Texte s'assombrit
- **Disabled** : Opacité 50%

### Modes
- **Non contrôlé** : `defaultValue` — état interne
- **Contrôlé** : `value` + `onChange` — état parent

### Accessibilité
- `role="tablist"` sur le conteneur
- `role="tab"` + `aria-selected` + `aria-controls` sur chaque tab
- `role="tabpanel"` sur chaque panel
- IDs uniques via `useId()`

### Migration existante
Remplace les 6+ implémentations ad-hoc : `.eq-tab` (Equipment), `.orders-tab` (Orders), annuaire tabs, leaves tabs, planning tabs, display dashboard tabs.

### Tokens utilisés
`--space-{1,1-5,2,3,4}`, `--theme-border-light`, `--font-{sm,2xs}`, `--weight-{medium,semibold}`, `--theme-text-{secondary,primary}`, `--theme-primary`, `--theme-bg-{tertiary,indigo-light}`, `--duration-fast`

---

## 3. 📂 Accordion

### Structure
```jsx
<Accordion title="Informations détaillées" icon={<Info size={16}/>} defaultOpen>
  <p>Contenu dépliable avec texte, listes, etc.</p>
</Accordion>

{/* Accordions empilés */}
<Accordion title="Section 1">…</Accordion>
<Accordion title="Section 2">…</Accordion>
<Accordion title="Section 3">…</Accordion>
```

### Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `title` | `string\|ReactNode` | — | Titre de la section |
| `icon` | `ReactNode` | — | Icône avant le titre |
| `defaultOpen` | `boolean` | `false` | Ouvert initialement (non contrôlé) |
| `open` | `boolean` | — | État contrôlé |
| `onToggle` | `function` | — | `(isOpen) => void` |

### Comportement
- **Chevron** : Lucide `ChevronDown` avec rotation 180° quand ouvert
- **Empilage** : CSS `:has()` pour fusionner visuellement les bordures des accordions consécutifs
- **Modes** : Non contrôlé (état interne) ou contrôlé (prop `open`)

### Accessibilité
- `aria-expanded` sur le trigger
- `aria-controls` liant le trigger au contenu
- `role="region"` sur le contenu
- `:focus-visible` avec focus ring

### Migration existante
Remplace les patterns FaqItem (HelpModal), section collapse (Planning), detail sections (AffaireDetail), cascade filter expand (Equipment).

### Tokens utilisés
`--theme-border-light`, `--radius-md`, `--theme-bg-card`, `--space-{2,3,4}`, `--font-base`, `--weight-semibold`, `--theme-text-{primary,secondary,muted,body}`, `--theme-bg-hover`, `--focus-ring`, `--duration-fast`, `--ease-out`, `--leading-normal`

---

## 4. 🔍 SearchBar

### Structure
```jsx
<SearchBar
  value={search}
  onChange={setSearch}
  placeholder="Rechercher un véhicule…"
  size="sm"
/>
```

### Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `value` | `string` | `''` | Texte de recherche |
| `onChange` | `function` | — | `(value: string) => void` |
| `placeholder` | `string` | `'Rechercher…'` | Placeholder |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Taille |

Tous les attributs `<input>` natifs sont transmis. Ref forwarded.

### Éléments intégrés
- **Icône loupe** (Lucide `Search`) à gauche, automatique
- **Bouton clear** (Lucide `X`) à droite, visible seulement quand `value` non vide
- **Focus ring** au `:focus-within`

### Tailles
| Taille | Hauteur | Icon | Font |
|--------|---------|------|------|
| sm | 32px | 14px | `--font-sm` |
| md | 40px | 16px | `--font-sm` |
| lg | 48px | 16px | `--font-base` |

### Accessibilité
- `aria-label="Effacer la recherche"` sur le bouton clear
- Ref forwarded pour autofocus
- Label via composition avec `<FormField>` si besoin

### Migration existante
Remplace les 6+ barres de recherche dupliquées : `.affaires-tb-search`, `.eq-search`, `.stock-search`, `.personnel-search`, `.annuaire-search`, etc.

### Tokens utilisés
`--theme-bg-card`, `--theme-border`, `--theme-border-focus`, `--radius-md`, `--btn-height-{sm,md,lg}`, `--space-{1,1-5,2,3,4}`, `--font-{sm,base}`, `--theme-text-{primary,muted}`, `--theme-bg-hover`, `--radius-sm`, `--focus-ring`, `--duration-fast`

---

## 5. 🏷️ FilterBar

### Structure
```jsx
<FilterBar
  value={filter}
  onChange={setFilter}
  size="sm"
  options={[
    { value: 'all', label: 'Tous', count: 42 },
    { value: 'active', label: 'Actifs', icon: <CheckCircle size={14}/>, count: 30 },
    { value: 'archived', label: 'Archivés', count: 12 },
  ]}
/>
```

### FilterBar — Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `value` | `string` | — | Valeur du filtre actif |
| `onChange` | `function` | — | `(value) => void` |
| `options` | `Array<{value, label, icon?, count?, disabled?}>` | `[]` | Options disponibles |
| `size` | `'sm' \| 'md'` | `'md'` | Taille |

### Variantes visuelles
- **Normal** : Boutons arrondis (pill), bordure, fond card
- **Active** : Fond primary, texte inverse
- **Count badge** : Fond semi-transparent, adapté selon état actif/inactif

### Accessibilité
- `role="radiogroup"` sur le conteneur
- `role="radio"` + `aria-checked` sur chaque bouton
- Navigation au clavier standard (Tab entre les options)

### Migration existante
Remplace les patterns `.filter-btn`, `.lt-filter-btn`, `.mep-filter-btn`, `.orders-filter`, `.dash-filter-chip`.

### Tokens utilisés
`--space-{0-5,1,1-5,2,3}`, `--theme-border`, `--theme-border-medium`, `--radius: 999px (pill)`, `--theme-bg-card`, `--theme-bg-hover`, `--theme-text-{secondary,primary,inverse}`, `--theme-primary`, `--theme-primary-hover`, `--font-{sm,xs,2xs}`, `--weight-{medium,semibold}`, `--duration-fast`

---

## 6. 📝 ListItem

### Structure
```jsx
<ListItem
  icon={<Package size={18} />}
  title="Perceuse Bosch GSR 18V"
  description="Référence catalogue #1234-A"
  meta="Ajouté il y a 2h par Jean"
  actions={
    <>
      <Button variant="ghost" iconOnly size="xs"><Edit size={14}/></Button>
      <Button variant="ghost" iconOnly size="xs"><Trash size={14}/></Button>
    </>
  }
  onClick={() => openDetail(1234)}
  selected={selectedId === 1234}
/>
```

### Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `icon` | `ReactNode` | — | Icône à gauche |
| `avatar` | `ReactNode` | — | Avatar à gauche (alternatif à icon) |
| `title` | `string\|ReactNode` | — | Titre principal |
| `description` | `string\|ReactNode` | — | Description (clamp 2 lignes) |
| `meta` | `string\|ReactNode` | — | Métadonnées (date, auteur…) |
| `actions` | `ReactNode` | — | Actions à droite |
| `selected` | `boolean` | `false` | État sélectionné |
| `onClick` | `function` | — | Rend l'item cliquable (rendu en `<button>`) |

### États
- **Default** : Fond card, bordure légère
- **Hover** : Fond hover (si clickable)
- **Selected** : Fond selected + bordure primary
- **Focus-visible** : Focus ring (si clickable)

### Empilage
Les ListItems consécutifs fusionnent visuellement (bordures partagées, radius aux extrémités seulement) via CSS `:has()` + `+ .ui-list-item`.

### Accessibilité
- Rendu en `<button>` si `onClick`, sinon `<div>`
- `stopPropagation` sur la zone actions (évite double-clic)
- `:focus-visible` pour navigation clavier

### Migration existante
Remplace `.detail-list-item`, `.display-list-item`, `.pdp-chip` (partiellement), `.ebl-group-header`.

### Tokens utilisés
`--space-{1,2,3,4,px}`, `--theme-bg-{card,hover,selected}`, `--theme-border-{light}`, `--theme-primary`, `--radius-md`, `--font-{base,sm,xs}`, `--weight-medium`, `--theme-text-{primary,secondary,muted}`, `--leading-{snug,normal}`, `--focus-ring`, `--duration-fast`

---

## 📊 Inventaire complet du Design System

### Barrel export — 28 composants

```jsx
import {
  // Existants
  Card, Panel, SectionHeader, Table, ScrollArea, FormField,
  // Atomes (Étape 3)
  Button, Input, Checkbox, Toggle, Tag, Badge,
  Avatar, Tooltip, Spinner, LoadingOverlay,
  // Molécules (Étape 4)
  DropdownMenu, DropdownItem, DropdownDivider,
  Tabs, TabList, Tab, TabPanel,
  Accordion, SearchBar, FilterBar, ListItem
} from '../components/ui';
```

### Composants non centralisés (à migrer progressivement)
- **EntityCombobox** : Déjà dans ui/, fonctionne — envisager évolution vers un `Select` plus générique
- **Pagination** : Pas encore standardisé — défini dans Table mais pas standalone  
- **Breadcrumb** : Non implémenté

---

## 🚀 Prochaine étape

**Étape 5 — Organisms & Templates** : Assembler les molécules en organismes (Header, Sidebar, PanelLayout, ModalDialog, DataGrid, Form complet…).
