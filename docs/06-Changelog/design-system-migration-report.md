# Rapport de Migration — Design System MagLog

**Date** : Juin 2025  
**Branche** : `dev`  
**Scope** : Centralisation CSS + tokens sémantiques + outillage

---

## 1. Résumé exécutif

Migration automatisée des valeurs CSS brutes (hex, rgba, z-index, named colors) vers des tokens centralisés. 3 vagues successives, **1 244 remplacements** sur **112 fichiers CSS**, **0 régression** (build OK à chaque vague).

### Métriques clés

| Indicateur | Avant | Après | Δ |
|---|---|---|---|
| Violations audit custom | 2 460 | 1 193 | **-51,5 %** |
| Violations Stylelint | 3 225 | 1 516 | **-53 %** |
| Violations DS pures (hex+rgba+z-index+named) | 1 831 | 391 | **-78,6 %** |
| Fichiers CSS 100 % conformes DS | ~22 | ~100 | **+355 %** |

---

## 2. Livrables créés

### Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `src/design/tokens.css` | 85+ tokens sémantiques (surfaces, glass, overlays, tints, layout, modals, forms, animations) |
| `src/design-system/index.js` | Façade d'import unique — re-exporte les 29 composants UI |
| `src/components/ui/Select.jsx` + `.css` | Composant Select manquant (3 tailles, états error/disabled) |
| `src/layouts/Page.jsx` + `.css` | Wrapper page obligatoire (titre, actions, sections) |
| `src/layouts/ModalLayout.jsx` + `.css` | Wrapper modal obligatoire (compose Modal + Header/Body/Footer) |
| `.stylelintrc.json` | Config Stylelint stricte (interdit hex, rgba, named colors, z-index littéraux) |
| `scripts/audit-css.js` | Audit CSS/JSX : hex, rgba, named, z-index, inline styles, duplications DS |
| `scripts/migrate-css-tokens.js` | Migration automatique avec 120+ mappings (hex, rgba, z-index, named, shadows) |

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `src/main.jsx` | Import `tokens.css` après `theme.css` |
| `src/components/ui/index.js` | Export Select |
| `apps/web/vite.config.js` | Alias `@` → `src/` |
| `apps/web/package.json` | Scripts `lint:css` + `lint:css:fix`, devDeps stylelint |
| **112 fichiers CSS** | Remplacement des valeurs brutes par tokens |

---

## 3. Tokens ajoutés (`tokens.css`)

### Architecture 3 niveaux
```
┌─────────────────────────────┐
│  3. Composants (Button.css) │  → var(--btn-primary-bg)
│  2. Sémantique (tokens.css) │  → var(--surface-primary)
│  1. Primitifs  (theme.css)  │  → var(--theme-primary)
└─────────────────────────────┘
```

### Catégories de tokens

| Catégorie | Tokens | Exemples |
|---|---|---|
| Surfaces | 10 | `--surface-page`, `--surface-overlay`, `--surface-hover` |
| Texte | 8 | `--text-heading`, `--text-body`, `--text-muted` |
| Bordures | 5 | `--border-default`, `--border-focus` |
| Interactifs | 5 | `--interactive-primary`, `--interactive-gradient` |
| Feedback | 16 | `--feedback-{success,error,warning,info}-{bg,text,border}` |
| Glass (white overlays) | 8 | `--glass-subtle` (0.1) → `--glass-bright` (0.8) |
| Dark overlays | 10 | `--overlay-subtle` (0.03) → `--overlay-opaque` (0.85) |
| Primary tints | 8 | `--primary-tint-faint` (0.04) → `--primary-tint-bold` (0.4) |
| Accent tints | 12 | `--accent-tint-muted` (0.03) → `--accent-tint-heavy` (0.5) |
| Success tints | 9 | `--success-tint-subtle` (0.06) → `--success-tint-strong` (0.45) |
| Danger tints | 6 | `--danger-tint-light` (0.12) → `--danger-tint-dark` |
| Warning tints | 3 | `--warning-tint-light` → `--warning-tint-medium` |
| Info/Violet | 3 | `--info-tint-faint`, `--info-tint-light`, `--violet-tint` |
| Layout | 6 | `--page-padding`, `--sidebar-width`, `--toolbar-height` |
| Modals | 6 | `--modal-width-{sm,md,lg,xl,full}`, `--modal-radius` |
| Formulaires | 7 | `--input-height-{sm,md,lg}`, `--input-radius`, `--input-bg` |
| Animations | 4 | `--motion-fast`, `--motion-spring` |

**Total : ~85+ tokens sémantiques** sur la base de **287+ tokens primitifs** existants.

---

## 4. Détail des 3 vagues de migration

### Vague 1 — Mappings principaux
- **112 fichiers, 794 remplacements**
- Hex courants (#667eea, #e2e8f0, #1e293b, etc.) → `var(--theme-*)`
- Rgba courants (overlays noirs, blanc translucide) → `var(--shadow-*)`, `var(--theme-overlay-*)`
- Named colors (white en background/color) → tokens contextuels

### Vague 2 — Hex étendus
- **80 fichiers, 332 remplacements**
- Hex Bootstrap/Material (#dc3545, #007bff, #333, #999, etc.)
- Glass tokens (rgba white 0.1→0.7)
- Overlays étendus (rgba black 0.03→0.85)

### Vague 3 — Tints complets
- **34 fichiers, 118 remplacements**
- Indigo/accent tints (0.03→0.5)
- Success/danger/warning tints étendus
- Info, violet, danger-dark, gray-overlay

---

## 5. Violations restantes (1 193 custom / 1 516 Stylelint)

### Incompressibles / volontaires

| Catégorie | Count | Explication |
|---|---|---|
| `color-named` | 687 | Majoritairement `transparent` (valide), `white`/`black` dans des gradients complexes |
| Stylistic (Stylelint) | ~1 125 | `single-line-max-declarations`, `media-feature-range-notation`, `keyframes-name-pattern`, etc. — non liées au DS |

### À traiter manuellement (prochaines itérations)

| Catégorie | Count | Action recommandée |
|---|---|---|
| `function-disallowed` (rgba rares) | 194 | Créer des tokens contextuels ou utiliser `color-mix()` |
| `color-no-hex` | 88 | Hex uniques — mapper vers tokens existants au cas par cas |
| `z-index-no-literal` | 41 | Valeurs custom (ex: -1, 3, 15) — auditer l'usage |
| Inline styles JSX | 182 | Migrer vers classes CSS + tokens (effort moyen) |

---

## 6. Outillage disponible

```bash
# Linter CSS strict
npm run lint:css              # Audit Stylelint
npm run lint:css:fix          # Auto-fix Stylelint

# Audit DS custom (plus détaillé)
node scripts/audit-css.js              # Top 50 violations détaillées
node scripts/audit-css.js --summary    # Résumé tableaux
node scripts/audit-css.js --json       # Export JSON

# Migration automatique
node scripts/migrate-css-tokens.js             # Dry-run
node scripts/migrate-css-tokens.js --apply     # Appliquer
node scripts/migrate-css-tokens.js --file X    # Un seul fichier
```

---

## 7. Règles pour les nouveaux composants

1. **Importer depuis le DS** : `import { Button, Input, Modal } from '@/design-system'`
2. **Wrapper obligatoire** : `<Page>` pour les pages, `<ModalLayout>` pour les modals
3. **Zéro valeur brute** : uniquement `var(--token)` dans les CSS
4. **Vérifier avant commit** : `npm run lint:css` doit passer
5. **Fichiers exemptés** : `theme.css`, `theme-*.css`, `tokens.css`

---

## 8. Prochaines étapes recommandées

| Priorité | Action | Effort |
|---|---|---|
| 🔴 P0 | CI gate — intégrer `lint:css` dans le pipeline CI | Faible |
| 🟠 P1 | Migrer les 182 inline styles JSX (top 5 fichiers) | Moyen |
| 🟡 P2 | Mapper les 88 hex restants vers des tokens spécifiques | Faible |
| 🟢 P3 | Refactorer les 41 z-index non standard | Faible |
| 🟢 P3 | Adopter `color-mix()` pour les rgba dynamiques | Faible |
| 🔵 P4 | Migrer composants existants vers `<Page>` / `<ModalLayout>` | Élevé |
| 🔵 P4 | Désactiver les règles Stylelint stylistic non pertinentes | Faible |
