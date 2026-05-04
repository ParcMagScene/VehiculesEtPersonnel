module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  plugins: ['simple-import-sort'],
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
    // Règles react-hooks v7 trop strictes pour le code existant
    'react-hooks/set-state-in-effect': 'warn',
    'react-hooks/refs': 'warn',
    'react-hooks/purity': 'off',
    'react-hooks/immutability': 'warn',
    'react-hooks/preserve-manual-memoization': 'warn',
    // Regex avec emoji (planning français) — faux positifs
    'no-misleading-character-class': 'warn',
    // Catch vides volontaires (silencieux)
    'no-empty': ['error', { allowEmptyCatch: true }],
    // Import sorting automatique
    'simple-import-sort/imports': 'warn',
    'simple-import-sort/exports': 'warn',
    // ─── A11Y ─────────────────────────────────────────────────────────
    // Mode permissif au démarrage : tout en `warn` pour ne pas bloquer
    // le build pendant la résorption du backlog.
    'jsx-a11y/alt-text': 'warn',
    'jsx-a11y/anchor-has-content': 'warn',
    'jsx-a11y/anchor-is-valid': 'warn',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-unsupported-elements': 'error',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/heading-has-content': 'warn',
    'jsx-a11y/img-redundant-alt': 'warn',
    'jsx-a11y/interactive-supports-focus': 'warn',
    'jsx-a11y/label-has-associated-control': 'warn',
    'jsx-a11y/no-autofocus': 'off', // utilisé volontairement dans modales
    'jsx-a11y/no-noninteractive-element-interactions': 'warn',
    'jsx-a11y/no-static-element-interactions': 'warn',
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/role-supports-aria-props': 'warn',
    // Vidéos = flux NVR / aperçus, pas de pistes de sous-titres applicables
    'jsx-a11y/media-has-caption': 'off',
  },
  ignorePatterns: ['dist/', 'node_modules/', 'public/', '_archive/'],
};
