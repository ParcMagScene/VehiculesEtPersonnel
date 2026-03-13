# Checklist de mise en production — PR dev → main

> À valider avant fusion de la branche `dev` dans `main`.

## 1. Tests automatisés

- [ ] **Tests unitaires** : `npm test` — 21/21 ✅
- [ ] **Tests intégration API** : `npm run test:api` — 15/15 ✅ (backend dev en cours)
- [ ] **Tests intégration authentifiée** : `TEST_EMAIL=xxx TEST_PASSWORD=xxx npm run test:api` (vérifie login, session, logout, accès protégés)
- [ ] **Smoke test** : `SMOKE_EMAIL=xxx SMOKE_PASSWORD=xxx npm run smoke-test`

## 2. Vérifications manuelles

- [ ] Se connecter via le formulaire de login (sélecteur d'utilisateur + mot de passe)
- [ ] Tester le flux « mot de passe oublié » : demander OTP → saisir code → nouveau mdp → auto-login
- [ ] Vérifier que le sélecteur d'affaire dans TaskEditModal s'affiche correctement (z-index, fond opaque)
- [ ] Tester l'affichage TV (`/tv-client/`) : titres nettoyés, auto-majuscule, affaire_type remonté
- [ ] Tester l'éditeur de zones dépôt (DepotMapEditor) : création, déplacement, sauvegarde
- [ ] Vérifier la vue mobile : MobileApp, MobilePersonnel, MobileLogin
- [ ] Tester l'export PDF planning : titres enrichis correctement
- [ ] Ouvrir la page équipement : catalogue, zones des 2 dépôts

## 3. Sécurité

- [ ] `GET /api/auth/users-public` **ne retourne PAS** d'email (vérifié par test auto)
- [ ] Les endpoints protégés sans token retournent 401/403 (vérifié par test auto)
- [ ] Un JWT forgé est rejeté (vérifié par test auto)
- [ ] Les tokens invalides déclenchent un `clearAuth()` + reload côté client
- [ ] La config CORS est correcte : localhost uniquement en dev, uniquement domaines prod en prod
- [ ] Les endpoints `/api/debug/*` ne sont **pas accessibles** en production (vérifier `isDev`)

## 4. Base de données

- [ ] Sauvegarder la base prod (`vehicules.db`) **avant** le déploiement
- [ ] Vérifier que les migrations s'exécutent correctement au démarrage
- [ ] Confirmer que `vehicules-dev.db` n'est **jamais** déployée en prod

## 5. Configuration

- [ ] `.env` (production) : `JWT_SECRET` est un secret fort, **pas** `dev-secret-key-not-for-production`
- [ ] `.env` : `ALLOWED_ORIGINS` ne contient pas `localhost` en prod
- [ ] `.env.development` non déployé en prod
- [ ] `NODE_ENV=production` est bien défini dans l'environnement de déploiement

## 6. Déploiement

- [ ] Rebase la branche `dev` sur `main` : `git rebase main` (résoudre les conflits s'il y en a)
- [ ] `npm run build` — vérifier que le build Vite réussit sans erreur
- [ ] `npm run deploy` (via `scripts/safe-deploy.sh`)
- [ ] Vérifier les logs PM2 après démarrage (`pm2 logs`)
- [ ] Tester l'application en prod depuis un navigateur externe

## 7. Post-déploiement

- [ ] Vérifier l'accès depuis le domaine public (`magsav.duckdns.org`)
- [ ] Tester le login d'au moins 2 utilisateurs
- [ ] Vérifier que les zones dépôt en `server/data/` persistent correctement après redémarrage
- [ ] Monitorer les logs pendant 30 min pour détecter des erreurs silencieuses
