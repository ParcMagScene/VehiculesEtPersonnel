# SYSTÈME DE NON-RÉGRESSION — eM@g

## 1. Règles de PR

- Toute PR doit définir clairement problème, périmètre, risques et validation.
- Toute PR doit lier une référence de backlog, audit ou incident.
- Toute PR sur zone critique doit inclure les scénarios de non-régression associés.
- Toute PR incomplète sur preuves de validation est non fusionnable.

## 2. Règles de merge

- Merge autorisé uniquement vers dev selon la gouvernance en place.
- Merge interdit sans CI verte et review requise.
- Merge interdit si tests critiques manquants sur zone impactée.
- Merge des correctifs critiques effectué en lots maîtrisés et traçables.

## 3. Règles de tests

- Toute correction de bug critique ajoute un test de non-régression.
- Les flux sensibles (auth, DB, sécurité, modules critiques) sont couverts systématiquement.
- Les tests smoke API et UI sont obligatoires avant promotion production.
- Les tests instables sont fiabilisés en priorité et non tolérés durablement.

## 4. Règles de documentation

- Toute modification de comportement métier ou sécurité met à jour la documentation.
- Toute règle de gouvernance qualité est versionnée.
- Toute PR significative doit inclure la trace documentaire correspondante.
- La vérification documentaire automatique est bloquante avant merge.

## 5. Règles de versioning

- Le versioning suit une convention explicite et stable.
- Les changements incompatibles nécessitent communication et plan de migration.
- Les releases majeures incluent une revue complète des risques de régression.
- Chaque version publie un changelog orienté impacts et remédiations.

## 6. Règles de sécurité

- Aucune régression sur contrôles d’accès, auth et endpoints sensibles n’est tolérée.
- Toute faille critique déclenche correction prioritaire, test de preuve et suivi renforcé.
- Les configurations runtime critiques sont vérifiées post-déploiement.
- Les revues sécurité sont intégrées au cycle de stabilisation continue.

## 7. Règles de navigation

- L’URL doit rester source de vérité des états navigables majeurs.
- Les parcours clés doivent rester fonctionnels sur desktop et mobile.
- Toute modification de navigation inclut tests smoke de parcours.
- Les régressions de transition ou de contexte sont bloquantes.

## 8. Règles de Design System

- Les composants partagés sont la référence unique des patterns UI.
- Les écarts au Design System sont interdits sans justification validée.
- Toute nouvelle variante doit être documentée et contrôlée.
- Les divergences visuelles répétées déclenchent action de normalisation.

## 9. Règles de modals

- Les modals respectent structure, accessibilité et comportements standardisés.
- Les règles de focus, fermeture et feedback d’erreur sont obligatoires.
- Les modals critiques sont couvertes par tests de non-régression UI.
- Les comportements divergents entre modules sont interdits.

## 10. Règles a11y

- Conformité accessibilité minimale obligatoire sur composants critiques.
- Contrastes, labels, erreurs et navigation clavier sont vérifiés systématiquement.
- Toute régression a11y identifiée déclenche correction prioritaire selon sévérité.
- Les composants non conformes ne peuvent pas devenir référence de pattern.

## 11. Mécanismes de contrôle

Mécanismes obligatoires :
- Gates CI bloquantes (lint, tests, build, docs).
- Revues de code orientées risques.
- Smoke tests pré et post-déploiement.
- Audits mensuels et suivi des tendances.
- Backlog de remédiation priorisé et tracé.

## 12. Outils

Familles d’outils requises :
- Outils de lint et qualité statique.
- Outils de test backend, frontend, DB, smoke.
- Outils de CI/CD et reporting.
- Outils de vérification documentaire.
- Outils de suivi métrique qualité et incidents.

## 13. Workflows

Workflows obligatoires :
1. Développement local avec contrôles pré-commit.
2. Pull request avec validation complète.
3. Revue et arbitrage risques.
4. Merge contrôlé.
5. Déploiement sécurisé.
6. Validation post-déploiement.
7. Retour d’expérience et amélioration continue.

## 14. Obligations

Obligations d’équipe :
- Respect des gates qualité sans contournement.
- Traçabilité complète des décisions de dérogation.
- Réactivité sur incidents de régression.
- Mise à jour continue des tests et de la documentation.
- Pilotage mensuel de la santé non-régression.

Obligations de gouvernance :
- Maintenir des critères de sortie explicites par priorité.
- Arbitrer rapidement les risques critiques.
- Vérifier l’efficacité des mesures par indicateurs.

Finalité : instaurer un cadre normatif durable qui empêche les retours arrière techniques, fonctionnels, sécurité et UX, tout en soutenant la trajectoire eM@g 3.0.0.