// ─────────────────────────────────────────────────────────────────────────────
// apps/web/eslint.config.js — ESLint v9 flat config
// Migré depuis .eslintrc.cjs. Comportement et règles strictement équivalents.
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname, recommendedConfig: js.configs.recommended });

export default [
  // Ignores (remplace .eslintignore racine pour ce workspace + ignorePatterns du legacy)
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      '_archive/**',
      'coverage/**',
      '.vite/**',
      '.storybook/**',
      'storybook-static/**',
    ],
  },

  // Base recommended (eslint:recommended)
  js.configs.recommended,

  // Aligne le comportement legacy : ne pas remonter de warnings sur les
  // directives eslint-disable inutilisées (sinon explosion de bruit après
  // la mise à off de plusieurs règles react-hooks v7).
  {
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },

  // Plugins React (pas encore d'export flat natif → fixup via compat)
  ...fixupConfigRules(compat.extends('plugin:react/recommended')),
  ...fixupConfigRules(compat.extends('plugin:react/jsx-runtime')),
  ...fixupConfigRules(compat.extends('plugin:jsx-a11y/recommended')),

  // react-hooks v7 expose un export flat dédié
  reactHooks.configs.flat.recommended,

  // Prettier (désactive règles conflictuelles) — doit rester en dernier des extends
  prettier,

  // Configuration projet
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react: fixupPluginRules(react),
      'jsx-a11y': fixupPluginRules(jsxA11y),
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    settings: {
      react: { version: 'detect' },
      // jsx-a11y: composants custom traités comme des contrôles natifs
      // (réduit les faux positifs sur label-has-associated-control)
      'jsx-a11y': {
        components: {
          Select: 'select',
          TextField: 'input',
          Input: 'input',
          Textarea: 'textarea',
          Checkbox: 'input',
          RadioButton: 'input',
        },
      },
    },
    rules: {
      // Désactivé pour ne pas casser le code existant
      'react/prop-types': 'off',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          // ESLint v9 inspecte par défaut les binders de catch ; le projet
          // utilise massivement `catch (e/err)` sans utiliser l'erreur
          // (logs déjà gérés en amont). On ignore ces cas pour éviter le
          // bruit sans toucher au code applicatif.
          caughtErrors: 'none',
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // ESLint v9 ajoute ces règles à `eslint:recommended` ; elles produisent
      // ~17 erreurs sur le code existant. Désactivées pour stabiliser la CI ;
      // à traiter en cleanup dédié.
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
      'react/display-name': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Apostrophes françaises dans le JSX — trop de faux positifs
      'react/no-unescaped-entities': 'off',
      // Règles react-hooks v7 nouvellement strictes : 52 warnings sur le code
      // existant. Désactivées pour stabiliser la CI ; à traiter en PR dédiées
      // (refactor effets/refs avec tests). Suivi : issue #10.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      // Regex avec emoji (planning français) — faux positifs
      'no-misleading-character-class': 'warn',
      // Catch vides volontaires (silencieux)
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Import sorting automatique
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
      // Suppression automatique des imports inutilisés (autofix)
      'unused-imports/no-unused-imports': 'warn',
      // ─── A11Y ─────────────────────────────────────────────────────────
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-has-content': 'warn',
      'jsx-a11y/anchor-is-valid': 'warn',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      // Désactivés : 352 occurrences. Suivi : issue #9.
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/heading-has-content': 'warn',
      'jsx-a11y/img-redundant-alt': 'warn',
      'jsx-a11y/interactive-supports-focus': 'warn',
      // Désactivé : 344 occurrences. Suivi : issue #8.
      'jsx-a11y/label-has-associated-control': 'off',
      'jsx-a11y/no-autofocus': 'off', // utilisé volontairement dans modales
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'warn',
      // Vidéos = flux NVR / aperçus, pas de pistes de sous-titres applicables
      'jsx-a11y/media-has-caption': 'off',
    },
  },

  // Scripts Node ESM (.mjs) — environnement Node, pas de browser globals,
  // console/process autorisés (ce sont des scripts CLI de build).
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // ─── DS adoption guard-rails (warn-only) ─────────────────────────────
  // Audit UI/UX Sprint 2 : on signale (sans bloquer) les écarts au design system
  // dans le code applicatif. Exclus :
  //  - components/ui/      → source de vérité du DS, peut utiliser <button>/inline
  //  - components/mobile/  → couche mobile spécialisée (refacto Sprint final)
  //  - DisplayDashboard/   → écrans TV, styles dynamiques inévitables
  //  - layouts/            → wrappers DS internes
  {
    files: ['src/components/**/*.{js,jsx}'],
    ignores: [
      'src/components/ui/**',
      'src/components/mobile/**',
      'src/components/DisplayDashboard/**',
    ],
    rules: {
      // P2.1 : <button> HTML brut → utiliser <Button> du DS
      'react/forbid-elements': [
        'warn',
        {
          forbid: [
            {
              element: 'button',
              message: 'Utiliser <Button> du @/design-system au lieu de <button> HTML.',
            },
          ],
        },
      ],
      // P2.4 : style={{ color/background/border/padding/margin/gap }} inline
      // → utiliser des classes CSS + tokens.
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "JSXAttribute[name.name='style'] ObjectExpression > Property[key.name=/^(color|background|backgroundColor|border|borderColor|padding|margin|gap)$/]",
          message:
            'Évite les styles inline pour color/background/border/padding/margin/gap : utilise une classe CSS + tokens (var(--theme-*) / var(--space-*)).',
        },
      ],
    },
  },
];
