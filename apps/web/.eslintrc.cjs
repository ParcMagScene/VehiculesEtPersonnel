module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  plugins: ['simple-import-sort', 'unused-imports'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
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
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'react/display-name': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    // Apostrophes françaises dans le JSX — trop de faux positifs
    'react/no-unescaped-entities': 'off',
    // Règles react-hooks v7 nouvellement strictes : 52 warnings sur le code
    // existant. Désactivées pour stabiliser la CI ; à traiter en PR dédiées
    // (refactor effets/refs avec tests). Suivi : issue dédiée.
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
    // → désactive no-unused-vars pour les imports (géré par unused-imports/no-unused-imports)
    'unused-imports/no-unused-imports': 'warn',
    // ─── A11Y ─────────────────────────────────────────────────────────
    // Mode permissif au démarrage : tout en `warn` pour ne pas bloquer
    // le build pendant la résorption du backlog.
    'jsx-a11y/alt-text': 'warn',
    'jsx-a11y/anchor-has-content': 'warn',
    'jsx-a11y/anchor-is-valid': 'warn',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-unsupported-elements': 'error',
    // Désactivés : 352 occurrences (194 + 147 + 11) sur le code legacy.
    // Vraie correction = revue UX clavier (Enter/Espace, focus management,
    // role/tabIndex), pas un commit massif. Suivi : issue dédiée.
    'jsx-a11y/click-events-have-key-events': 'off',
    'jsx-a11y/no-static-element-interactions': 'off',
    'jsx-a11y/no-noninteractive-element-interactions': 'off',
    'jsx-a11y/heading-has-content': 'warn',
    'jsx-a11y/img-redundant-alt': 'warn',
    'jsx-a11y/interactive-supports-focus': 'warn',
    // Désactivé : 344 occurrences sur le code legacy (labels sans htmlFor).
    // À traiter dans une PR a11y dédiée (axe-core + revue UX/QA clavier).
    // Suivi : ouvrir une issue "a11y: associate form labels with controls".
    'jsx-a11y/label-has-associated-control': 'off',
    'jsx-a11y/no-autofocus': 'off', // utilisé volontairement dans modales
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/role-supports-aria-props': 'warn',
    // Vidéos = flux NVR / aperçus, pas de pistes de sous-titres applicables
    'jsx-a11y/media-has-caption': 'off',
  },
  ignorePatterns: ['dist/', 'node_modules/', 'public/', '_archive/'],
};
