# 🎭 Étape 6 — Règles UX (Comportements)

> Date : 23 mars 2026  
> Type : Spécifications (pas de code créé)  
> Basé sur : Analyse approfondie des patterns existants

---

## 1. 🪟 Ouverture / Fermeture des modaux

### Règle : Props-driven, portal-based

| Aspect | Règle | Token / Valeur |
|--------|-------|----------------|
| **Contrôle** | Toujours via prop `open` (boolean) + callback `onClose` | — |
| **Rendu** | `createPortal(…, document.body)` — jamais inline | — |
| **Overlay** | Fond `rgba(15, 23, 42, 0.5)` + `backdrop-filter: blur(4px)` | — |
| **Fermeture backdrop** | Sur `mouseDown` (pas click) pour éviter les faux positifs de drag | — |
| **Fermeture Escape** | Toujours actif, listener sur `document` avec `keydown` | — |
| **Scroll lock** | `body.overflow = 'hidden'` quand ouvert, restauré à la fermeture | — |
| **Focus restore** | `document.activeElement` sauvegardé à l'ouverture, `.focus()` à la fermeture | — |
| **Z-index** | `--z-modal: 2000` ; Modal imbriqué : `--z-modal-nested: 2500` | theme.css |

### Cycle de vie modal
```
1. open=true        → Portal monté, body scroll lock, focus sauvegardé
2. Animation entrée → Overlay fade-in + container slide-up (spring)
3. Interaction      → Escape / backdrop mouseDown → onClose()
4. open=false       → Animation sortie, scroll restauré, focus restauré
5. Unmount          → Portal supprimé
```

### Cycle de vie drawer (slide-panel)
```
1. open=true        → setVisible(true) → double rAF → setAnimating(true)
2. CSS transition   → translateX(±100%) → translateX(0) sur 300ms
3. Interaction      → Escape / backdrop → onClose()
4. open=false       → setAnimating(false) → timer 320ms → setVisible(false)
5. Unmount          → Portal supprimé
```

### Composant à utiliser

| Besoin | Composant |
|--------|-----------|
| Formulaire / contenu centré | `<Modal>` |
| Confirmation / alerte | `<Dialog>` |
| Détail latéral / édition longue | `<Drawer>` |
| Section repliable en page | `<Accordion>` |

---

## 2. ✨ Transitions & Animations

### Tokens de durée

| Token | Valeur | Usage |
|-------|--------|-------|
| `--duration-fast` | `150ms` | Hover, focus, toggle, dropdown |
| `--duration-normal` | `200ms` | Boutons, inputs, onglets |
| `--duration-smooth` | `300ms` | Modals, drawers, toasts |
| `--duration-slow` | `400ms` | Transitions lourdes (page) |

### Tokens d'easing

| Token | Valeur | Usage |
|-------|--------|-------|
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Transitions standard |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Entrées, apparitions |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Modals (bounce subtil) |

### Raccourcis legacy (compatibilité)

| Token | Valeur | Équivalent |
|-------|--------|------------|
| `--transition-fast` | `0.15s ease` | duration-fast + ease |
| `--transition-normal` | `0.2s ease` | duration-normal + ease |
| `--transition-smooth` | `0.3s cubic-bezier(…)` | duration-smooth + ease-in-out |
| `--transition-slow` | `0.4s cubic-bezier(…)` | duration-slow + ease-in-out |

### Animations par composant

| Composant | Entrée | Sortie | Durée |
|-----------|--------|--------|-------|
| **Modal overlay** | `opacity 0→1` | `opacity 1→0` | fast |
| **Modal container** | `translateY(12px) scale(.97) → 0 scale(1)` | Inverse | normal (spring) |
| **Drawer** | `translateX(±100%) → 0` | Inverse | 300ms (ease-out) |
| **Dropdown** | `translateY(-4px) scale(.95) → 0 scale(1)` | — | fast |
| **Toast** | `translateX(100%) → 0` | `translateX(100%)` | smooth |
| **Accordion** | Contenu déplie (hauteur auto) | Inverse | fast |
| **Tooltip** | `opacity 0→1` (après délai) | `opacity 1→0` | fast |
| **Button hover** | `translateY(-1px)` + shadow lift | Reset | fast |
| **Spinner** | `rotate 0→360deg linear infinite` | — | 1s |

### Règle : motion-reduce
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
Déjà supporté — respecter cette media query dans tout nouveau composant.

---

## 3. 🎯 Gestion du focus

### Principes

| Règle | Détail |
|-------|--------|
| **Focus ring** | `--focus-ring: 0 0 0 3px rgba(102, 126, 234, 0.15)` via `box-shadow` |
| **Visibilité** | `:focus-visible` uniquement (pas `:focus`) — pas de ring au clic souris |
| **Focus-within** | Sur les wrappers d'input pour highlighter la zone entière |
| **Autofocus** | Premier champ interactif dans les modaux/drawers |
| **Restauration** | Le focus revient à l'élément déclencheur à la fermeture |

### Pattern focus dans les inputs
```css
.ui-input:focus-visible {
  border-color: var(--theme-border-focus);
  box-shadow: var(--focus-ring);
  outline: none;
}
```

### Focus dans les modaux
```
Ouverture : saveActiveElement → lock scroll → autofocus premier input
Fermeture : restore scroll → restoreActiveElement.focus()
```

### Ordre de tabulation
- Tab navigue séquentiellement dans le modal/drawer
- Escape ferme la couche la plus haute
- Les éléments `disabled` sont exclus du flux tab (natif)

---

## 4. ✅ Validation des formulaires

### Timing de validation

| Étape | Action | Feedback |
|-------|--------|----------|
| **Saisie** | Validation légère en temps réel (longueur min, format basique) | Bordure neutre → pas d'erreur tant que non touché |
| **Blur** | Validation complète du champ quitté | Si erreur : bordure rouge + message |
| **Submit** | Re-validation globale de tous les champs | Toast error si échec global ; scroll vers première erreur |

### Apparence des erreurs

| État | Bordure | Background | Ring au focus | Texte |
|------|---------|------------|---------------|-------|
| Normal | `--theme-border` | transparent | `--focus-ring` | — |
| Erreur | `--theme-danger` | `--theme-danger-bg` | rouge 15% | Message sous l'input |
| Valide | `--theme-success` (optionnel) | — | — | — |

### Props de validation sur Input/FormField
```jsx
<FormField label="Email" required error="Adresse email invalide">
  <Input error value={form.email} onChange={…} aria-invalid />
</FormField>
```

### ARIA
- `aria-invalid="true"` sur l'input en erreur
- `aria-describedby` reliant l'input au message d'erreur
- `aria-required="true"` sur les champs obligatoires

### Règles
1. Ne jamais afficher d'erreur sur un champ non touché (sauf après submit)
2. L'erreur disparaît dès que la valeur devient valide
3. Les champs `required` affichent un `*` via `FormField`
4. En cas d'erreur serveur : toast error avec message descriptif

---

## 5. 🚫 États désactivés

### Règle visuelle universelle

| Propriété | Valeur |
|-----------|--------|
| `opacity` | `0.55` (boutons), `0.6` (inputs, contrôles) |
| `cursor` | `not-allowed` |
| `pointer-events` | `none` (facultatif, selon contexte) |
| `user-select` | `none` |

### Application par composant

| Composant | Disabled via | Effet |
|-----------|-------------|-------|
| **Button** | `disabled` prop | Opacity 0.55, cursor not-allowed, pas de hover/active |
| **Input** | `disabled` prop natif | Opacity 0.6, fond `--theme-bg-tertiary` |
| **Checkbox / Toggle** | `disabled` prop | Opacity 0.6, cursor not-allowed |
| **Tab** | `disabled` prop | Opacity 0.5, cursor not-allowed, click ignoré |
| **DropdownItem** | `disabled` prop | Opacity 0.5, hover ignoré |
| **FilterBar option** | `disabled` dans options | Opacity 0.5, click ignoré |
| **Ligne tableau** | Classe `.disabled-row` | Opacity 0.5 sur la ligne |

### Règles
1. Un élément `disabled` n'est jamais focusable (sauf si `aria-disabled` utilisé au lieu de `disabled` natif)
2. Les boutons désactivés gardent leur layout (pas de collapse)
3. Les tooltips fonctionnent sur les éléments désactivés (pour expliquer pourquoi)

---

## 6. ⏳ Loaders & états de chargement

### Niveaux de chargement

| Niveau | Composant | Usage |
|--------|-----------|-------|
| **Bouton** | `<Button loading>` | Action en cours (save, delete…) |
| **Zone** | `<LoadingOverlay />` | Section de page qui charge |
| **Page** | `<Spinner size="lg" />` | Chargement initial du module |
| **Inline** | `<Spinner size="sm" />` | Dans un texte ou une cellule |

### Comportement du Button loading
```
1. onClick déclenche l'action async
2. loading=true → Spinner remplace l'icône, texte conservé
3. Le bouton est disabled pendant le loading (prevent double-click)
4. loading=false → Bouton restauré
```

### Timing
- Si chargement < 300ms : pas de spinner (éviter le flash)
- Si chargement > 300ms : spinner affiché
- Si chargement > 10s : considérer un message "Chargement long…"

### LoadingOverlay
- Fond semi-transparent avec blur
- `role="status"` + texte sr-only "Chargement…"
- Z-index au-dessus du contenu local

---

## 7. 🔔 Toasts & notifications

### Architecture
```
useFeedback() → toastRef → ToastContainer (impératif via ref)
```

### API
```jsx
const { toastRef, toast } = useFeedback();
toast.success('Sauvegardé !');
toast.error('Erreur : champ obligatoire manquant');
toast.warning('Attention : stock bas');
toast.info('Nouvel import disponible');
```

### Types & durées

| Type | Icône (Lucide) | Durée auto-close | Couleur |
|------|----------------|-------------------|---------|
| `success` | CheckCircle | 3.5s | `--theme-success` |
| `error` | XCircle | 6s | `--theme-danger` |
| `warning` | AlertTriangle | 5s | `--theme-warning` |
| `info` | Info | 4s | `--theme-info` |

### Règles

| Règle | Détail |
|-------|--------|
| **Stack max** | 5 toasts simultanés (le plus ancien est retiré) |
| **Position** | Bottom-right (desktop), bottom-center (mobile) |
| **Animation entrée** | Slide-in depuis la droite |
| **Animation sortie** | Slide-out vers la droite |
| **Pause au hover** | Le timer se met en pause quand on survole un toast |
| **Fermeture** | Bouton ✕ sur chaque toast |
| **Accessibilité** | `role="alert"` + `aria-live="assertive"` |

### Quand utiliser un toast

| Situation | Toast type |
|-----------|-----------|
| Sauvegarde réussie | `success` |
| Erreur API (réseau, validation serveur) | `error` |
| Action potentiellement dangereuse effectuée | `warning` |
| Information contextuelle, notification passive | `info` |
| Erreur de validation formulaire | **NE PAS** utiliser de toast — afficher inline |

---

## 8. ⌨️ Raccourcis clavier

### Raccourcis globaux (via `useKeyboardShortcuts`)

| Raccourci | Action | Catégorie |
|-----------|--------|-----------|
| `Mod+1` | Module Parc | Navigation |
| `Mod+2` | Module Personnel | Navigation |
| `Mod+3` | Module Affaires | Navigation |
| `Mod+4` | Module Matériel | Navigation |
| `Mod+5` | Module Commandes | Navigation |
| `Mod+M` | Messagerie | Navigation |
| `Mod+N` | Nouvelle réservation | Actions |
| `Mod+,` | Préférences | Général |
| `Mod+T` | Aujourd'hui (calendrier) | Calendrier |
| `F1` | Aide | Général |
| `Escape` | Fermer la fenêtre active | Général |
| `←` / `→` | Navigation période calendrier | Calendrier |

> `Mod` = `⌘` (Mac) / `Ctrl` (Windows/Linux)

### Règles

| Règle | Détail |
|-------|--------|
| **Input safety** | Les raccourcis sont ignorés quand le focus est dans INPUT/TEXTAREA/SELECT (sauf Escape) |
| **preventDefault** | Toujours appeler `e.preventDefault()` sur les raccourcis interceptés |
| **Composant-level** | Modal, Drawer, Dropdown gèrent eux-mêmes Escape |
| **Non-collision** | Ne jamais utiliser les raccourcis navigateur standard (Mod+C, Mod+V, Mod+A, Mod+Z, etc.) |
| **Découvrabilité** | Tous les raccourcis sont listés dans `SHORTCUTS` et affichés dans HelpModal (F1) |
| **Extensibilité** | Ajouter un raccourci = ajouter dans `SHORTCUTS` + handler dans `useKeyboardShortcuts` |

---

## 9. 📱 Comportements tactiles (mobile)

### Détection mobile
```javascript
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
```
Override possible via `sessionStorage.forceDesktop`.

### Breakpoints responsive

| Breakpoint | Cible | Adaptations |
|------------|-------|-------------|
| `≤ 768px` | Tablette | SplitLayout → stack vertical ; sidebar ≤ 40vh |
| `≤ 640px` | Mobile | Drawers full-width ; grilles → 1 col ; FormActions stack |
| `≤ 480px` | Petit mobile | Paddings réduits ; toasts bottom-center |

### Règles tactiles

| Règle | Valeur |
|-------|--------|
| **Taille cible minimum** | 44×44px (WCAG 2.5.5 AAA) |
| **Espacement minimum entre cibles** | 8px |
| **Momentum scrolling** | `-webkit-overflow-scrolling: touch` |
| **Touch action** | `touch-action: none` sur les zones interactives (canvas, drag) |
| **Hover impossible** | Ne jamais cacher de fonctionnalité derrière un hover seul |
| **Long press** | Non utilisé dans l'app (éviter confusion avec sélection texte) |

### Adaptations par composant

| Composant | Adaptation mobile |
|-----------|------------------|
| **Drawer** | Full width (100vw) au lieu de width fixe |
| **Modal** | 92-96vw, paddings réduits |
| **DropdownMenu** | Préférer action sheet en bottom si possible |
| **Tooltip** | Tap to show (pas de hover) |
| **Tabs** | Scroll horizontal (overflow-x auto) |
| **Table** | Scroll horizontal ou responsive (stacked rows) |

### Composant mobile dédié
Quand `isMobile` détecté, l'app charge `MobileApp` (lazy) avec une interface optimisée tactile.

---

## 10. 📺 Comportements TV (affichage)

### Architecture TV
L'affichage TV (`apps/tv-client/`) est une **app séparée en vanilla JavaScript** :
- Pas de React (DOM direct pour performance)
- Pas de Design System partagé (standalone)
- Communication via API `/api/display/*`

### Comportements spécifiques

| Aspect | Règle |
|--------|-------|
| **Interaction** | Aucune — affichage passif uniquement |
| **Navigation** | Pas de navigation utilisateur |
| **Polling** | Actualisation automatique via API |
| **Alarme** | Son (SNCF.wav) + effet visuel à l'arrivée d'un événement |
| **Couleurs** | Règles de couleur configurables par type d'événement |
| **Icônes** | Mapping configuré par localisation |
| **État global** | Events, colorRules, locationIconRules, config |

### Règles pour le Design System
Le tv-client étant une app séparée sans React, le Design System ne s'y applique pas directement. Cependant, les **tokens de couleur** doivent rester cohérents :
- Les couleurs d'événements configurées dans le back-office (DisplayDashboard) doivent utiliser les mêmes palettes que le Design System
- Les templates d'affichage créés dans la web-app sont rendus sur les écrans TV

---

## 📊 Récapitulatif des règles

### Matrice comportement × composant

| Comportement | Modal | Dialog | Drawer | Dropdown | Toast | Accordion |
|-------------|-------|--------|--------|----------|-------|-----------|
| Escape ferme | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Backdrop ferme | ✅ | ✅ | ✅ | ✅ (outside click) | ❌ | ❌ |
| Scroll lock body | ✅ | ✅ | ✅ (avec overlay) | ❌ | ❌ | ❌ |
| Focus restore | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Portal | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Animation entrée | slide-up | slide-up | slide-X | scale | slide-X | height |
| Duration | normal | normal | smooth | fast | smooth | fast |

### Z-index stack

| Couche | Token | Valeur |
|--------|-------|--------|
| Base | `--z-base` | 1 |
| Dropdown | `--z-dropdown` | 100 |
| Sticky header | `--z-sticky` | 200 |
| Overlay | `--z-overlay` | 1000 |
| Modal | `--z-modal` | 2000 |
| Modal imbriqué | `--z-modal-nested` | 2500 |
| Popover | `--z-popover` | 3000 |
| Draggable | `--z-draggable` | 4000 |
| Toast | `--z-toast` | 5000 |
| Tooltip | `--z-tooltip` | 9999 |

---

## 🚀 Prochaine étape

**Étape 7 — Thèmes** : Définir le système de thèmes (light/dark), les palettes de couleur, et les règles de personnalisation.
