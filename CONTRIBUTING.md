# Contribuer à eM@g

Merci de votre intérêt pour eM@g ! Ce document explique comment contribuer au projet.

## Prérequis

- **Node.js** 18+ (LTS recommandé)
- **npm** 9+
- Un éditeur avec support ESLint (VS Code recommandé)

## Installation locale

```bash
git clone https://github.com/ParcMagScene/VehiculesEtPersonnel.git
cd VehiculesEtPersonnel
npm install
cp apps/api/.env.example apps/api/.env
# Éditez apps/api/.env avec vos valeurs
npm run dev:start
```

## Structure du projet

```
apps/
  api/        # Backend Express.js (ESM, SQLite)
  web/        # Frontend React (Vite)
  tv-client/  # Client affichage TV
public/       # Fichiers statiques partagés
scripts/      # Utilitaires de migration et maintenance
docs/         # Documentation technique
```

## Workflow de contribution

1. **Forkez** le dépôt
2. Créez une **branche** depuis `dev` : `git checkout -b feature/ma-feature`
3. Faites vos modifications
4. **Testez** localement : `npm run dev:start`
5. **Committez** avec un message clair : `git commit -m "feat: description courte"`
6. **Poussez** votre branche : `git push origin feature/ma-feature`
7. Ouvrez une **Pull Request** vers `dev`

## Conventions

### Commits

Suivez le format [Conventional Commits](https://www.conventionalcommits.org/) :

- `feat:` nouvelle fonctionnalité
- `fix:` correction de bug
- `docs:` documentation uniquement
- `style:` formatage, sans changement de logique
- `refactor:` refactorisation sans changement fonctionnel
- `chore:` maintenance, dépendances

### Code

- **Backend** : ESM (`import/export`), pas de CommonJS dans le code applicatif
- **Frontend** : React avec hooks, composants fonctionnels
- **CSS** : fichiers `.css` colocalisés avec les composants
- **Base de données** : migrations SQL dans `apps/api/migrations/`
- Pas de secrets, tokens ou données personnelles dans le code

### Pull Requests

- Ciblez toujours la branche `dev`
- Décrivez clairement le changement et sa motivation
- Ajoutez des captures d'écran pour les changements UI

## Signaler un bug

Ouvrez une [issue](https://github.com/ParcMagScene/VehiculesEtPersonnel/issues) avec :

- Description du problème
- Étapes pour reproduire
- Comportement attendu vs observé
- Version de Node.js et navigateur utilisé

## Documents associés

- [GOVERNANCE.md](GOVERNANCE.md) — Modèle de gouvernance, rôles, processus
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — Code de conduite
- [CODING_STANDARDS.md](CODING_STANDARDS.md) — Conventions de développement
- [ROADMAP.md](ROADMAP.md) — Feuille de route
- [SECURITY.md](SECURITY.md) — Politique de sécurité

## Licence

En contribuant, vous acceptez que vos contributions soient sous licence [MIT](LICENSE).
