export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Types autorisés (Conventional Commits standard + quelques extras)
    'type-enum': [
      2,
      'always',
      [
        'feat',     // Nouvelle fonctionnalité
        'fix',      // Correction de bug
        'docs',     // Documentation uniquement
        'style',    // Formatage, semi-colons, etc. (pas de changement fonctionnel)
        'refactor', // Refactoring (ni fix ni feat)
        'perf',     // Amélioration de performance
        'test',     // Ajout/correction de tests
        'build',    // Changement build system ou dépendances
        'ci',       // Changement CI/CD
        'chore',    // Tâches de maintenance
        'revert',   // Revert d'un commit précédent
      ],
    ],
    // Scopes libres (pas de restriction)
    'scope-case': [2, 'always', 'kebab-case'],
    // Sujet en minuscule
    'subject-case': [0],
    // Longueur max du header
    'header-max-length': [2, 'always', 120],
  },
};
