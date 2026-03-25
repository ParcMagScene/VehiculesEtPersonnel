# 🏗️ Étape 5 — Organismes & Templates

> Date : 23 mars 2026  
> Fichiers créés : 12 (6 .jsx + 6 .css)  
> Composants existants conservés : Panel, SectionHeader, Card

---

## 📦 Résumé des livrables

### Composants existants (inchangés)

| Composant | Fichier | Rôle |
|-----------|---------|------|
| **Panel** | `ui/Panel.jsx` | Conteneur structuré header/body/footer |
| **SectionHeader** | `ui/SectionHeader.jsx` | En-tête de section avec titre + badge + actions |
| **Card** | `ui/Card.jsx` | Conteneur générique avec ombre/bordure |

### Nouveaux organismes

| Composant | Fichier JSX | Fichier CSS | Exports |
|-----------|-------------|-------------|---------|
| **Modal** | `ui/Modal.jsx` | `ui/Modal.css` | `Modal, ModalHeader, ModalBody, ModalFooter` |
| **Dialog** | `ui/Dialog.jsx` | `ui/Dialog.css` | `default` |
| **Drawer** | `ui/Drawer.jsx` | `ui/Drawer.css` | `default` |
| **PageHeader** | `ui/PageHeader.jsx` | `ui/PageHeader.css` | `default` |
| **FormLayout** | `ui/FormLayout.jsx` | `ui/FormLayout.css` | `FormLayout, FormSection, FormRow, FormActions` |
| **ModuleLayout** | `ui/ModuleLayout.jsx` | `ui/ModuleLayout.css` | `ModuleLayout, ModuleToolbar, ModuleContent, ModuleFooter, SplitLayout` |

---

## 1. 🪟 Modal

### Structure
```jsx
<Modal open={showModal} onClose={() => setShowModal(false)} size="md">
  <ModalHeader icon={<Edit size={18}/>} onClose={() => setShowModal(false)}>
    Modifier l'équipement
  </ModalHeader>
  <ModalBody>
    <FormLayout>…formulaire…</FormLayout>
  </ModalBody>
  <ModalFooter>
    <Button variant="secondary" onClick={close}>Annuler</Button>
    <Button variant="primary" onClick={save}>Enregistrer</Button>
  </ModalFooter>
</Modal>
```

### Modal — Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `open` | `boolean` | `false` | Contrôle l'affichage |
| `onClose` | `function` | — | Callback fermeture |
| `size` | `'sm'\|'md'\|'lg'\|'xl'\|'full'` | `'md'` | Taille du modal |
| `className` | `string` | `''` | Classe CSS additionnelle |

### ModalHeader — Props
| Prop | Type | Description |
|------|------|-------------|
| `icon` | `ReactNode` | Icône avant le titre |
| `onClose` | `function` | Affiche le bouton ✕ |
| `children` | `ReactNode` | Titre |

### ModalBody — Props
| Prop | Type | Description |
|------|------|-------------|
| `className` | `string` | Classe CSS additionnelle |
| `children` | `ReactNode` | Contenu |

### ModalFooter — Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `align` | `'start'\|'end'\|'between'\|'center'` | `'end'` | Alignement des boutons |

### Tailles
| Size | Largeur max |
|------|------------|
| sm | 380px |
| md | 500px |
| lg | 700px |
| xl | 920px |
| full | 96vw + 90vh |

### Comportement
- **Portal** : Rendu via `createPortal` dans `document.body`
- **Fermeture** : Click sur l'overlay (sur mouseDown) + touche Escape
- **Scroll lock** : `body.overflow = 'hidden'` quand ouvert
- **Restore focus** : Le focus revient sur l'élément précédemment actif à la fermeture
- **Animation** : Overlay fade-in + container slide-up avec scale (spring easing)

### Accessibilité
- `role="dialog"` + `aria-modal="true"` sur le conteneur
- Fermeture au `Escape`
- `aria-label="Fermer"` sur le bouton close

### Migration existante
Centralise le pattern `.modal-overlay > .modal-container` utilisé dans 30+ modaux (MessageFormModal, TaskEditModal, ReservationModal, etc.) et le pattern `.confirm-dialog-overlay` de ConfirmDialog.

### Tokens utilisés
`--theme-bg-card`, `--shadow-modal`, `--radius-xl`, `--modal-header-bg`, `--modal-header-color`, `--modal-header-border-radius`, `--close-btn-*`, `--space-{3,4,5}`, `--font-lg`, `--weight-bold`, `--theme-border`, `--theme-bg-secondary`, `--duration-fast`, `--duration-normal`, `--ease-out`, `--z-modal`

---

## 2. ❓ Dialog

### Structure
```jsx
<Dialog
  open={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={handleDelete}
  variant="danger"
  title="Supprimer cet élément ?"
  confirmLabel="Supprimer"
>
  Cette action est irréversible. L'élément sera définitivement supprimé.
</Dialog>
```

### Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `open` | `boolean` | — | Contrôle l'affichage |
| `onClose` | `function` | — | Callback annulation/fermeture |
| `onConfirm` | `function` | — | Callback confirmation |
| `title` | `string` | — | Titre du dialogue |
| `children` | `ReactNode` | — | Message |
| `variant` | `'confirm'\|'danger'\|'info'\|'success'\|'warning'` | `'confirm'` | Type visuel |
| `confirmLabel` | `string` | `'Confirmer'` | Texte du bouton principal |
| `cancelLabel` | `string` | `'Annuler'` | Texte du bouton secondaire |
| `confirmVariant` | `string` | auto | Variante du bouton (déduite du variant) |
| `loading` | `boolean` | `false` | État loading sur le bouton confirm |
| `hideCancel` | `boolean` | `false` | Masquer le bouton annuler (mode alerte) |

### Variantes

| Variant | Icône | Couleur | Bouton par défaut |
|---------|-------|---------|-------------------|
| confirm | HelpCircle | primary | primary |
| danger | AlertTriangle | danger | danger |
| info | Info | primary | primary |
| success | CheckCircle | success | primary |
| warning | AlertTriangle | warning | primary |

### Architecture interne
Utilise `Modal` (size="sm") + `ModalBody` + `ModalFooter` en interne. Compose avec `Button` du Design System pour les actions.

### Migration existante
Remplace `ConfirmDialog.jsx` (20 LOC, pattern non-standardisé) et les dialogues ad-hoc (UnsavedChangesDialog, ClientDialog, LocationDialog simples).

---

## 3. 📑 Drawer (SlidePanel)

### Structure
```jsx
<Drawer
  open={showPanel}
  onClose={() => setShowPanel(false)}
  title="Détails du personnel"
  icon={<User size={18} />}
  width={440}
  footer={
    <>
      <Button variant="secondary" onClick={close}>Fermer</Button>
      <Button variant="primary" onClick={save}>Enregistrer</Button>
    </>
  }
>
  <Tabs defaultValue="infos">
    <TabList><Tab value="infos">Infos</Tab>…</TabList>
    <TabPanel value="infos">…</TabPanel>
  </Tabs>
</Drawer>
```

### Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `open` | `boolean` | — | Contrôle l'affichage |
| `onClose` | `function` | — | Callback fermeture |
| `side` | `'left'\|'right'` | `'right'` | Côté d'apparition |
| `width` | `number\|string` | `420` | Largeur (px ou CSS) |
| `title` | `string` | — | Titre dans le header |
| `icon` | `ReactNode` | — | Icône du header |
| `headerActions` | `ReactNode` | — | Actions supplémentaires dans le header |
| `footer` | `ReactNode` | — | Contenu du footer |
| `overlay` | `boolean` | `true` | Afficher le backdrop semi-transparent |
| `className` | `string` | `''` | Classe CSS additionnelle |

### Comportement
- **Portal** : Rendu via `createPortal` dans `document.body`
- **Animation** : CSS `transform: translateX(±100%)` → `translateX(0)` sur 300ms
- **Double rAF** : Garantit que le DOM est peint avant de déclencher la transition CSS
- **Fermeture** : Click backdrop + Escape, puis délai 320ms pour l'animation de sortie
- **Scroll lock** : Actif quand overlay=true

### Accessibilité
- `role="complementary"` sur l'aside
- `aria-label="Fermer"` sur le bouton close
- Fermeture au `Escape`

### Responsive
- Mobile (< 640px) : Pleine largeur (100vw), paddings réduits

### Migration existante
Centralise les 5+ implementations de slide-panel :
- `PersonnelSlidePanel` (personnel-slide-panel)
- `VehicleSlidePanel` (vehicle-slide-panel)
- `AffaireDetailPanel` (affaire-detail-panel)
- `StockSlidePanel` (stock-slide-panel)
- `OrderSlidePanel`, `QuoteSlidePanel`, `RequestSlidePanel`, `SupplierSlidePanel`

Le pattern `isOpen/isClosing/setTimeout` est remplacé par un seul Drawer réutilisable.

### Tokens utilisés
`--theme-bg-card`, `--shadow-modal`, `--theme-border`, `--modal-header-bg`, `--modal-header-color`, `--close-btn-*`, `--space-{3,4,5}`, `--font-lg`, `--weight-bold`, `--theme-bg-secondary`, `--duration-normal`, `--ease-out`, `--z-modal`

---

## 4. 📋 PageHeader

### Structure
```jsx
<PageHeader
  icon={<Package size={22} />}
  title="Équipements"
  badge={142}
  subtitle="Gestion du parc matériel"
  actions={
    <>
      <Button variant="secondary" size="sm"><Upload size={14}/> Importer</Button>
      <Button variant="primary" size="sm"><Plus size={14}/> Ajouter</Button>
    </>
  }
>
  <SearchBar value={search} onChange={setSearch} size="sm" />
  <FilterBar value={filter} onChange={setFilter} options={filterOptions} size="sm" />
</PageHeader>
```

### Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `icon` | `ReactNode` | — | Icône du module |
| `title` | `string` | — | Titre principal |
| `subtitle` | `string` | — | Sous-titre / description |
| `badge` | `number\|string` | — | Badge de comptage |
| `actions` | `ReactNode` | — | Boutons d'actions (droite) |
| `breadcrumb` | `ReactNode` | — | Fil d'Ariane |
| `children` | `ReactNode` | — | Toolbar (rendu sous le titre) |

### Zones
1. **Breadcrumb** (optionnel) : Navigation chapelée
2. **Title row** : Icône + Titre + Badge | Actions
3. **Toolbar** (optionnel, via children) : SearchBar, FilterBar, boutons de vue

### Responsive
- Mobile (< 640px) : Layout vertical (titre + actions empilés)

### Migration existante
Remplace les headers ad-hoc dans chaque module-panel qui réimplémentent `title + icon + buttons + search`.

### Tokens utilisés
`--space-{1,2,3,4}`, `--font-{xs,sm,xl}`, `--weight-{bold,semibold}`, `--theme-text-{heading,muted,secondary}`, `--theme-primary`, `--theme-bg-indigo-light`, `--radius-full`, `--leading-snug`, `--leading-normal`

---

## 5. 📝 FormLayout

### Structure
```jsx
<FormLayout onSubmit={handleSubmit}>
  <FormSection title="Informations générales" description="Données de base du véhicule">
    <FormRow columns={2}>
      <FormField label="Immatriculation" required>
        <Input value={form.plate} onChange={…} />
      </FormField>
      <FormField label="Marque">
        <Input value={form.brand} onChange={…} />
      </FormField>
    </FormRow>
    <FormField label="Description">
      <Input value={form.description} onChange={…} />
    </FormField>
  </FormSection>

  <FormSection title="Affectation">
    <FormRow columns={3}>…</FormRow>
  </FormSection>

  <FormActions>
    <Button variant="secondary" onClick={cancel}>Annuler</Button>
    <Button variant="primary" type="submit">Enregistrer</Button>
  </FormActions>
</FormLayout>
```

### FormLayout — Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `onSubmit` | `function` | — | Si fourni, rend un `<form>` avec `preventDefault` |
| `className` | `string` | `''` | Classe additionnelle |

### FormSection — Props
| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Titre de section (rendu en `<legend>`) |
| `description` | `string` | Description explicative |

### FormRow — Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `columns` | `number\|string` | auto-fit | Nombre de colonnes ou template CSS grid |
| `gap` | `string` | — | Gap personnalisé |

### FormActions — Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `align` | `'start'\|'end'\|'between'\|'center'` | `'end'` | Alignement des boutons |

### Grille responsive
- Desktop : `grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))`
- Mobile (< 640px) : 1 colonne + boutons empilés verticalement

### Sémantique
- `FormLayout` rend un `<form>` si `onSubmit` est fourni, sinon un `<div>`
- `FormSection` rend un `<fieldset>` + `<legend>` (sémantique native)

---

## 6. 🧩 ModuleLayout + SplitLayout

### ModuleLayout — Structure
```jsx
<ModuleLayout>
  <PageHeader title="Commandes" badge={42} icon={<ShoppingCart />} actions={…}>
    <SearchBar … />
  </PageHeader>
  <ModuleToolbar>
    <FilterBar … />
    <Button variant="ghost" size="sm"><Grid size={14}/></Button>
    <Button variant="ghost" size="sm"><List size={14}/></Button>
  </ModuleToolbar>
  <ModuleContent>
    <Table columns={cols} data={rows} />
  </ModuleContent>
  <ModuleFooter>
    <span>42 résultats</span>
    <Pagination … />
  </ModuleFooter>
</ModuleLayout>
```

### Exports

| Composant | Props clés | Rôle |
|-----------|------------|------|
| `ModuleLayout` | `className` | Conteneur flex-column height:100% |
| `ModuleToolbar` | `className` | Barre filtres/actions (flex-wrap) |
| `ModuleContent` | `noPadding`, `className` | Zone scrollable |
| `ModuleFooter` | `className` | Pied de page (pagination, stats) |
| `SplitLayout` | `sidebar`, `sidebarWidth`, `side` | Split horizontal sidebar + main |

### SplitLayout — Structure
```jsx
<SplitLayout
  sidebar={<DashboardTasksSidebar />}
  sidebarWidth={300}
  side="left"
>
  <ModuleLayout>
    <ModuleContent>…</ModuleContent>
  </ModuleLayout>
</SplitLayout>
```

### SplitLayout — Props
| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `sidebar` | `ReactNode` | — | Contenu du panneau latéral |
| `sidebarWidth` | `number\|string` | `280` | Largeur du sidebar |
| `side` | `'left'\|'right'` | `'left'` | Côté du sidebar |

### Responsive
- Desktop : Layout flex horizontal (sidebar + main)
- Tablet (< 768px) : Stack vertical, sidebar limité à 40vh

---

## 📊 Inventaire complet du Design System

### Barrel export — 43 composants

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
  Accordion, SearchBar, FilterBar, ListItem,
  // Organismes & Templates (Étape 5)
  Modal, ModalHeader, ModalBody, ModalFooter,
  Dialog, Drawer, PageHeader,
  FormLayout, FormSection, FormRow, FormActions,
  ModuleLayout, ModuleToolbar, ModuleContent, ModuleFooter, SplitLayout,
} from '../components/ui';
```

### Couverture des patterns existants

| Catégorie demandée | Solution | Status |
|--------------------|----------|--------|
| Panels | `Panel` (existant) + `Drawer` (nouveau) | ✅ |
| Modals | `Modal` + `ModalHeader/Body/Footer` | ✅ |
| Dialogs | `Dialog` (5 variantes) | ✅ |
| Sidebars | `Drawer` (side=left/right) | ✅ |
| Headers | `PageHeader` + `SectionHeader` (existant) | ✅ |
| Footers | `ModalFooter` + `ModuleFooter` | ✅ |
| Layouts de modules | `ModuleLayout/Toolbar/Content/Footer` | ✅ |
| Layouts de formulaires | `FormLayout/Section/Row/Actions` | ✅ |
| Layouts de modals | `Modal` (5 tailles) composable | ✅ |
| Layouts de panneaux latéraux | `Drawer` + `SplitLayout` | ✅ |

---

## 🚀 Prochaine étape

**Étape 6 — Règles UX (comportements)** : Spécifier les interactions, feedback, transitions, animations, validation, et patterns de navigation.
