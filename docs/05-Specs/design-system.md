# Design System eM@g — référence courte

> Source de vérité : `apps/web/src/design-system/index.js` (composants),
> `apps/web/src/design/tokens.css` (sémantique), `apps/web/src/theme.css` (primitifs).

## 1. Couleurs

Quatre familles sémantiques, chacune en 3 niveaux d'intensité.

| Famille  | Usage                  | Tokens à privilégier                                            |
| -------- | ---------------------- | --------------------------------------------------------------- |
| success  | confirmation, OK       | `--feedback-success`, `--feedback-success-bg`, `-text`, `-border` |
| danger   | erreur, suppression    | `--feedback-error`, `--feedback-error-bg`, `-text`, `-border`     |
| warning  | alerte, attention      | `--feedback-warning`, `--feedback-warning-bg`, `-text`, `-border` |
| info     | information, neutre    | `--feedback-info`, `--feedback-info-bg`, `-text`, `-border`       |

Pour les opacités/tints, **n'utiliser que** :

- `--<color>-tint-light` (≈ 0.08) — survol/surface
- `--<color>-tint`        (≈ 0.15) — sélection/active
- `--<color>-tint-strong` (≈ 0.30) — emphase

Les autres tints (`-faint`, `-subtle`, `-medium`, `-vivid`, `-bold`, `-heavy`) sont conservés pour compatibilité mais **dépréciés** pour les nouveaux développements.

**Interdit** : hex codé en dur dans JSX/CSS (sauf cas démontré : palette d'accent annuaire, charts).

## 2. Espacement

Échelle `--space-{0..24}` (4 px par cran). Utiliser **uniquement** ces tokens.

Layout primitives (utilitaires) — remplacent les `style={{ display:'flex', gap: N }}` :

```html
<div class="ds-stack-2">…</div>      <!-- colonne, gap 8px -->
<div class="ds-cluster-3">…</div>    <!-- ligne wrap, gap 12px -->
<div class="ds-row">…</div>          <!-- ligne, no wrap, gap 8px, center -->
<div class="ds-row-between">…</div>  <!-- ligne + space-between -->
```

Disponibles : `ds-stack-{1,2,3,4,6}`, `ds-cluster-{1,2,3,4}`, `ds-row`, `ds-row-between`, `ds-tap-target`.

## 3. Typographie

| Niveau    | Token CSS         | Taille   | Usage                |
| --------- | ----------------- | -------- | -------------------- |
| H1 / page | `--font-2xl`      | ~1.5 rem | Titre de module      |
| H2        | `--font-xl`       | ~1.25 rem| Section principale   |
| H3        | `--font-lg`       | ~1.125 rem| Sous-section        |
| Corps     | `--font-base`     | 1 rem    | Texte courant        |
| Petit     | `--font-sm`       | ~0.875 rem| Méta, helpers       |
| Mini      | `--font-xs`       | ~0.75 rem | Badges, labels      |

Line-height : `--leading-snug` (titres), `--leading-normal` (corps).
Poids : `--weight-{normal, medium, semibold, bold}`.

## 4. Composants

Toujours importer via `@/design-system` :

```js
import { Button, Modal, FormField, Card, Table } from '@/design-system';
```

- `<Button>` au lieu de `<button>` natif.
- `<FormField>` au lieu de `<label>` + `<input>` séparés.
- `<Modal>` + `ModalHeader/Body/Footer` pour toute fenêtre modale.
- `<ModuleLayout>` + `<PageHeader>` pour tout nouvel écran.

## 5. Layout & responsive

### Breakpoints canoniques

| Token       | Valeur  | Cible                  |
| ----------- | ------- | ---------------------- |
| `--bp-sm`   | 600 px  | Mobile → tablette portrait |
| `--bp-md`   | 900 px  | Tablette landscape     |
| `--bp-lg`   | 1200 px | Desktop                |
| `--bp-xl`   | 1600 px | Large desktop          |

> CSS ne supporte pas `var()` dans `@media`. Coder les valeurs en dur **uniquement parmi** `600 / 900 / 1200 / 1600 px`.

### Cible tactile

- `--tap-min: 44px` — taille minimale interactive sur mobile (WCAG 2.5.5).
- Classe utilitaire : `.ds-tap-target`.

## 6. Accessibilité

- Tout bouton icône-seule **doit** avoir un `aria-label` explicite.
- Anneau de focus : utiliser `:focus-visible` + `var(--focus-ring)`.
- Couleurs porteuses d'information **toujours** doublées d'un texte ou d'une icône.
- Contrastes texte : tokens `--theme-text-*` validés WCAG AA sur fond clair.

## 7. À ne pas faire

- ❌ Hex/rgb codés en dur dans JSX ou CSS.
- ❌ `px` en dur pour spacing/typo (sauf 1 px bordures).
- ❌ Inline `style={{ ... }}` pour ce qui est tokenisé (préférer classes utilitaires).
- ❌ `z-index` numérique en CSS (utiliser `var(--z-*)`).
- ❌ Composant local qui duplique un export du DS.

## 8. État actuel (informatif)

Mesures `dev` au 2026-05-05 :

- 154 fichiers contiennent encore `style={{ ... }}`.
- 678 occurrences de hex codés en dur dans JSX/JS.
- 8 028 valeurs `px` en dur dans CSS.
- 48 `z-index` numériques sans token.
- 169 `@media` (breakpoints disparates à harmoniser).

Plan de réduction : voir `/memories/repo/code-quality-audit.md`.
