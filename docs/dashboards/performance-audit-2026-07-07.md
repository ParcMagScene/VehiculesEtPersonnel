# Audit Performance Frontend — 2026-07-07

## Baseline Build

- Commande: `npm run build --workspace=apps/web`
- Durée build: `8.96s`
- Modules transformés: `3358`
- Taille totale JS (dist/assets): `4,070,173` bytes (~3.88 MB)
- Taille totale CSS (dist/assets): `1,472,713` bytes (~1.40 MB)

## Top Chunks JS (brut)

1. `vendor-pdf-DLjU8Rgw.js` — 438,881 B
2. `jspdf.es.min-DhkXAwTp.js` — 390,391 B
3. `index-ClIf-pAB.js` — 285,102 B
4. `html2canvas.esm-CLyRJ9cx.js` — 202,238 B
5. `LocationsMapPanel-D02GAje_.js` — 201,435 B
6. `EquipmentPanel-Cj2tFZ3N.js` — 195,185 B
7. `PersonnelPanel-NFcyfgWM.js` — 158,202 B
8. `index.es-D8vuLHC8.js` — 150,873 B
9. `vendor-react-B1HojYE1.js` — 133,953 B
10. `PersonalPlanningWrapper-B4kyRyk9.js` — 102,180 B

## Top Chunks CSS (brut)

1. `index-DngGdMWF.css` — 212,703 B
2. `PersonnelPanel-C27npEw_.css` — 113,480 B
3. `PersonalPlanningWrapper-Bi0fcFRa.css` — 80,994 B
4. `EquipmentPanel-DOHa6SKn.css` — 72,648 B
5. `ManagementPanel-BD25jU2_.css` — 60,774 B
6. `DisplayDashboardPanel-KoCGVCv2.css` — 58,758 B
7. `ReservationModal-DVKoZBpX.css` — 51,539 B
8. `OrdersPanel-DOxOLch5.css` — 42,046 B
9. `LocationsMapPanel-DEG57v7x.css` — 36,972 B
10. `AffaireDetailPanel-DVfHTtyy.css` — 35,682 B

## Dette UI/CSS (impact indirect perf)

- `node scripts/measure-ui-debt.mjs --format=summary`
  - Stylelint: `205` hex, `437` rgb/rgba
  - JSX inline: `230` color/border, `107` spacing
  - `<button>` brut: `9`
  - CSS px hardcodés: `1847`
  - Breakpoints exotiques: `169`

- `node scripts/audit-css.js --summary`
  - Violations totales: `1540`
  - Top règles:
    - `color-named`: `849`
    - `function-disallowed`: `414`
    - `color-no-hex`: `132`

## Constat Principal

Le coût le plus élevé se concentre sur:

- La chaîne PDF/print (`pdfjs-dist`, `jspdf`, `html2canvas`)
- Les gros panneaux métier (Locations, Equipment, Personnel)
- Un volume CSS global élevé (`index.css` + panneaux historiques)

## Actions Prioritaires (ROI)

1. **PDF on-demand strict**
   - Vérifier que tout code lié PDF/print reste derrière `import()` au clic.
   - Éviter tout import statique de wrappers PDF dans des composants affichés au chargement.

2. **Réduction de `index-*.js`**
   - Auditer les imports du shell (`App`, providers, helpers globaux) pour éliminer les dépendances non critiques au bootstrap.
   - Déporter les utilitaires lourds vers chargement lazy au niveau des modules.

3. **Plan CSS Top 6 fichiers**
   - Cibler d'abord: `index.css`, `PersonnelPanel.css`, `PersonalPlanningWrapper.css`, `EquipmentPanel.css`, `ManagementPanel.css`, `DisplayDashboardPanel.css`.
   - Objectif: réduire duplication, variables DS, découpage par module pour limiter CSS initial.

4. **Monitoring build budget**
   - Mettre en place des budgets simples en CI (warning) sur:
     - `index-*.js`
     - `index-*.css`
     - total JS/CSS de `dist/assets`

## Delta de cette session

- Harmonisation des images matériel sur route thumbnail (fiche/volet/form/media/contrôles), ce qui améliore la robustesse et réduit les coûts d'images pleines résolutions dans certaines vues.
- Baseline performance chiffrée rafraîchie et documentée pour pilotage des prochaines optimisations.
- Optimisation appliquée: `BPAnnotationViewer` passe `pdfjs-dist` en chargement à la demande (suppression de l'import statique), ce qui évite de charger la chaîne PDF tant que le viewer BP n'est pas ouvert.
- Optimisation appliquée: suppression de `optimizeDeps.include = ['pdfjs-dist']` dans `apps/web/vite.config.js` (prébundle dev inutile depuis le passage en lazy), pour alléger le démarrage Vite en développement.
- Optimisation appliquée: découpe lazy des sous-vues cartographie (`MapGeneral`, `MapLocal`, `MapDualPrintModal`) dans `LocationsMapPanel`.
- Optimisation appliquée: découpe lazy des sous-onglets personnel (`PlanningTab`, `PersonsTab`, `Agenda`, `Leaves`, `Skills`, `Positions`).
- Optimisation appliquée: découpe lazy des modales/panneaux secondaires de `EquipmentPanel` (dialogs, formulaires, SAV, imports, médias, plan dépôt, rapport).

### Mesure après découpe lazy (build du 2026-07-07)

- `LocationsMapPanel` JS: `201.33 kB` → `12.81 kB`
- `PersonnelPanel` JS: `157.69 kB` → `34.31 kB`
- `EquipmentPanel` JS: `194.32 kB` → `57.60 kB`
- Budgets bundle: toujours **OK** (`npm run audit:bundle`)

### Mesure après lazy-load shell overlays (build du 2026-07-07)

- `index JS` (budget principal): `278.5 KiB` → `271.6 KiB` (gzip)
- Nouveau chunk dédié: `GlobalOverlays-*.js` ~ `8.56 kB` (généré et chargé à la demande)
- Budgets bundle: toujours **OK** (`npm run audit:bundle`)

### Mesure après extraction CSS personnel hors bootstrap global (build du 2026-07-07)

- `index CSS` (budget principal): `207.7 KiB` → `205.3 KiB` (audit bundle)
- `index-*.css` (build): `212.70 kB` (gzip `35.57 kB`) → `210.18 kB` (gzip `35.21 kB`)
- Changement appliqué: `person-sidebar.css` retiré de `main.jsx` et importé localement par les modules `PersonnelPanel` / `SuiviPanel`.
- Budgets bundle: toujours **OK** (`npm run audit:bundle`)

### Mesure après chargement conditionnel des palettes optionnelles (build du 2026-07-07)

- `index CSS` (budget principal): `205.3 KiB` → `155.6 KiB` (audit bundle)
- `index-*.css` (build): `210.18 kB` (gzip `35.21 kB`) → `159.32 kB` (gzip `26.22 kB`)
- Découpage confirmé en chunks asynchrones:
   - `theme-palettes-*.css` `22.93 kB` (gzip `4.20 kB`)
   - `theme-vscode-*.css` `23.74 kB` (gzip `4.27 kB`)
   - `theme-tv-*.css` `4.19 kB` (gzip `1.25 kB`)
- Implémentation: imports globaux retirés de `main.jsx` + chargeur runtime `loadOptionalPaletteStyles.js` basé sur `data-palette`.
- Budgets bundle: toujours **OK** (`npm run audit:bundle`)

### Mesure après chargement conditionnel de la densité compacte (build du 2026-07-07)

- `index CSS` (budget principal): `155.6 KiB` → `152.6 KiB` (audit bundle)
- `index-*.css` (build): `159.32 kB` (gzip `26.22 kB`) → `156.22 kB` (gzip `25.64 kB`)
- Nouveau chunk asynchrone confirmé:
   - `theme-density-*.css` `6.82 kB`
- Implémentation: `theme-density.css` retiré de `main.jsx` et chargé à la demande selon `data-density='compact'` dans `loadOptionalPaletteStyles.js`.
- Budgets bundle: toujours **OK** (`npm run audit:bundle`)

### Mesure après déferisation JS du loader de thèmes (build du 2026-07-07)

- `index JS` (budget principal): `272.8 KiB` → `272.2 KiB` (audit bundle)
- `index CSS`: stable à `152.6 KiB`
- Effet build: création d'un chunk JS dédié `loadOptionalPaletteStyles-*.js` (chargeur lancé en import dynamique depuis `main.jsx`, immédiat si attributs thème déjà présents, sinon en idle).
- Budgets bundle: toujours **OK** (`npm run audit:bundle`)

### Mesure après lazy-load de AppStatusBar (build du 2026-07-07)

- `index JS` (budget principal): `272.2 KiB` → `272.0 KiB` (audit bundle)
- `index CSS`: stable à `152.6 KiB`
- Effet build: création d'un chunk JS dédié `AppStatusBar-*.js` chargé uniquement en contexte VS Code.
- Budgets bundle: toujours **OK** (`npm run audit:bundle`)

### Mesure après lazy-load du shell authentifié (AppChrome + ModuleHost) (build du 2026-07-07)

- `index JS` (budget principal): `272.0 KiB` → `214.9 KiB` (audit bundle)
- `index CSS` (budget principal): `152.6 KiB` → `141.1 KiB` (audit bundle)
- Effet build: `AppChrome` et `ModuleHost` sortis du bundle d'entrée vers des chunks asynchrones dédiés.
- Budgets bundle: toujours **OK** (`npm run audit:bundle`)

### Mesure après extraction de draggable-modals.css hors bootstrap (build du 2026-07-07)

- `index CSS` (budget principal): `141.1 KiB` → `137.0 KiB` (audit bundle)
- `index JS`: stable à `214.9 KiB`
- Effet build: styles draggable déplacés vers le chunk lazy `GlobalOverlays` (plus chargés dans `index-*.css`).
- Budgets bundle: toujours **OK** (`npm run audit:bundle`)

### Mesure après split App.css (AppBase bootstrap + AppChrome lazy) (build du 2026-07-07)

- `index CSS` (budget principal): `137.0 KiB` → `105.5 KiB` (audit bundle)
- `index JS`: stable à `214.9 KiB`
- Effet build: styles shell transférés dans `AppChrome-*.css`; le bootstrap conserve uniquement `AppBase.css` (login/loading).
- Budgets bundle: toujours **OK** (`npm run audit:bundle`)

### Mesure après fallback local AppShell (retrait LoadingOverlay du bootstrap) (build du 2026-07-07)

- `index JS` (budget principal): `214.9 KiB` → `214.7 KiB` (audit bundle)
- `index CSS`: stable à `105.5 KiB`
- Implémentation: `App.jsx` n'importe plus `LoadingOverlay`/`Loader.css` ; fallback local minimal basé sur `AppBase.css`.
- Budgets bundle: toujours **OK** (`npm run audit:bundle`)

### Validation stabilité (strict) — 2026-07-07

- Audit strict: **OK** (`npm run audit:bundle:strict`)
   - `index JS`: `214.7 KiB / 293.0 KiB`
   - `index CSS`: `105.5 KiB / 224.6 KiB`
   - `total JS`: `4013.5 KiB / 4199.2 KiB`
   - `total CSS`: `1438.7 KiB / 1513.7 KiB`

Checklist non-régression (post-split bootstrap/shell):
- [x] Le bootstrap minimal conserve les styles de login/loading via `AppBase.css`.
- [x] Les styles shell lourds (`App.css`) sont chargés avec `AppChrome` (lazy).
- [x] Les styles draggable modals sont chargés avec `GlobalOverlays` (lazy).
- [x] Les thèmes/palettes/densité optionnels sont chargés à la demande (`data-palette` / `data-density`).

### Mesure après ajustement bundler (target `es2022`) — 2026-07-07

- `total JS`: `4013.5 KiB` → `3979.5 KiB` (audit strict)
- `index JS`: stable à `214.7 KiB`
- `index CSS`: stable à `105.5 KiB`
- Implémentation: `build.target` relevé de `es2020` à `es2022` dans `vite.config.js`.
- Budgets stricts: toujours **OK** (`npm run audit:bundle:strict`).

### Mesure après minification `terser` (build du 2026-07-07)

- `total JS`: `3979.5 KiB` → `3912.7 KiB` (audit strict)
- `index JS`: `214.7 KiB` → `212.6 KiB`
- `index CSS`: stable à `105.5 KiB`
- Implémentation:
   - `build.minify`: `esbuild` → `terser`
   - `terserOptions.compress.passes = 2`
   - `terserOptions.format.comments = false`
- Budgets stricts: toujours **OK** (`npm run audit:bundle:strict`).
