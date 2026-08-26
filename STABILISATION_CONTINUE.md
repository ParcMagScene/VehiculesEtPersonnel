# SYSTÈME DE STABILISATION CONTINUE — eM@g

## 1. Lint strict (backend + frontend)

Le lint est un contrôle bloquant de qualité minimale sur l’ensemble du monorepo.

Règles normatives :
- Toute modification backend doit passer un lint backend strict.
- Toute modification frontend doit passer un lint frontend strict.
- Les warnings critiques sont traités comme des échecs.
- Les règles de style et de sécurité statique validées sont obligatoires.
- Les exceptions locales temporaires doivent être documentées, tracées et limitées dans le temps.

Objectif : réduire les régressions de qualité structurelle avant exécution des tests.

## 2. Tests obligatoires avant merge (Husky + CI)

Les tests sont requis à deux niveaux : local et distant.

Règles normatives :
- Les hooks locaux (Husky) bloquent les commits non conformes sur les contrôles critiques.
- La CI exécute les tests obligatoires sur chaque pull request.
- Aucun contournement des hooks n’est autorisé hors procédure d’urgence validée.
- Les tests de non-régression des flux sensibles sont systématiquement inclus.
- Les tests cassés intermittents doivent être soit fiabilisés, soit neutralisés avec décision explicite et ticket associé.

Objectif : détecter tôt les erreurs et interdire les merges non vérifiés.

## 3. CI/CD renforcée (build séparés, tests DB init, tests migrations)

La CI/CD est segmentée pour isoler les risques et accélérer le diagnostic.

Règles normatives :
- Build backend et build frontend exécutés séparément.
- Vérification d’initialisation base de données exécutée à chaque pipeline pertinent.
- Vérification des migrations exécutée sur environnement de test contrôlé.
- Les pipelines doivent produire des journaux lisibles et exploitables en audit.
- Les déploiements n’avancent pas si un contrôle de build, DB ou migration échoue.

Objectif : garantir la validité technique de bout en bout avant livraison.

## 4. Audit mensuel automatique (workflow GitHub)

Un audit qualité mensuel est obligatoire et automatisé.

Règles normatives :
- Un workflow planifié exécute les audits techniques principaux.
- Le rapport mensuel couvre backend, frontend, DB, sécurité, performance, accessibilité et documentation.
- Les écarts majeurs sont convertis en actions backlog priorisées.
- Les tendances sont comparées au mois précédent.
- Les résultats sont archivés pour traçabilité de gouvernance.

Objectif : passer d’une correction ponctuelle à un pilotage continu.

## 5. Vérification documentaire automatique (docs:check)

La documentation est traitée comme un artefact de production.

Règles normatives :
- Le contrôle documentaire est obligatoire dans la CI avant merge.
- Les références obsolètes, liens cassés, incohérences de conventions et sections manquantes doivent être détectés.
- Toute évolution de comportement critique implique une mise à jour documentaire associée.
- Les documents normatifs et runbooks sont versionnés avec les changements techniques.
- Une pull request non alignée avec l’état documentaire n’est pas fusionnable.

Objectif : aligner code, exploitation et connaissance projet.

## 6. Tests API smoke

Les tests smoke API valident la disponibilité et les invariants essentiels.

Périmètre minimal :
- Santé de l’API.
- Authentification et autorisation sur routes sensibles.
- Principales routes de lecture métier.
- Routes de mutation critiques avec cas nominal et refus attendu.
- Vérification des codes de réponse contractuels.

Règles normatives :
- Exécution obligatoire avant merge sur les zones impactées.
- Exécution obligatoire après déploiement production.
- Échec smoke API = rollback ou blocage de la promotion.

Objectif : éviter les régressions grossières en production.

## 7. Tests UI smoke

Les tests smoke UI valident les parcours essentiels côté interface.

Périmètre minimal :
- Chargement application et navigation principale.
- Ouverture et fermeture des écrans structurants.
- Parcours critiques par module prioritaire.
- États d’erreur et feedback utilisateur de base.
- Vérification responsive sur cibles desktop et mobile.

Règles normatives :
- Exécution en CI sur les branches de correction UI/UX.
- Exécution pré-release sur le lot à livrer.
- Les scénarios instables sont fiabilisés en priorité, pas ignorés durablement.

Objectif : garantir une expérience minimale utilisable après chaque livraison.

## 8. Conditions de succès

Le système de stabilisation continue est considéré efficace si les conditions suivantes sont tenues :
- Taux de pipelines verts stable et supérieur au seuil fixé.
- Baisse des incidents de régression en production.
- Baisse des retours correctifs urgents post-merge.
- Amélioration mesurable des scores qualité mensuels.
- Réduction progressive du stock de dette critique ouverte.
- Alignement constant entre backlog, code et documentation.

## 9. Processus de validation

Le processus de validation suit un enchaînement fixe :
1. Validation locale (lint + hooks + tests ciblés).
2. Validation CI complète (build, tests, docs, contrôles DB/migrations).
3. Revue de code et validation des risques.
4. Merge conditionnel vers dev.
5. Déploiement contrôlé.
6. Smoke tests post-déploiement.
7. Clôture avec traçabilité des preuves.

Règles normatives :
- Aucune étape ne peut être sautée sans décision formelle documentée.
- Toute dérogation doit être temporaire, justifiée et revue au sprint suivant.

## 10. Règles de non-régression

Les règles de non-régression sont obligatoires pour tout lot de changement.

Règles normatives :
- Tout bug critique corrigé doit avoir au moins un test de non-régression associé.
- Les zones sensibles (auth, sécurité, DB, modules critiques) sont couvertes par des scénarios dédiés.
- Une régression détectée en production génère une action corrective et un renforcement du filet de tests.
- Les métriques de non-régression sont suivies dans le tableau de bord qualité.
- Les pratiques de stabilisation sont revues mensuellement et ajustées sur preuves.

Finalité : instituer une discipline continue qui réduit durablement le risque de retour arrière technique, fonctionnel et sécurité.