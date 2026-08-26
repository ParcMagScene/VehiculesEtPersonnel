# SCRIPT D’ORCHESTRATION DES AUDITS — eM@g

## 1. Ordre d’exécution

Ordre normatif obligatoire :
1. global
2. backend
3. DB
4. frontend
5. UI/UX
6. a11y
7. performance
8. sécurité

Règles :
- Aucun audit ne démarre hors ordre sans justification formelle.
- L’audit global fournit le contexte de cadrage pour les suivants.
- Les audits aval exploitent explicitement les résultats des audits amont.

## 2. Dépendances entre audits

Dépendances structurantes :
- global -> tous les audits spécialisés.
- backend <-> DB (contrats de persistance, migrations, invariants).
- frontend -> UI/UX -> a11y (cohérence interface puis conformité).
- performance dépend des résultats backend, DB et frontend.
- sécurité consolide les risques transverses de toutes les couches.

Règles :
- Chaque audit doit consommer les sorties utiles des audits dépendants.
- Les contradictions entre audits déclenchent une phase de clarification.

## 3. Conditions de succès

Un cycle d’audits est réussi si :
- Tous les audits planifiés sont exécutés et tracés.
- Chaque audit produit un rapport exploitable.
- Les findings sont classés par sévérité et impact.
- Les dépendances et conflits sont explicités.
- Les actions de remédiation sont injectées dans un backlog priorisé.

## 4. Sorties attendues

Sorties minimales par audit :
- Résumé exécutif.
- Liste structurée des écarts.
- Classification P0/P1/P2/P3.
- Risques techniques, métier et sécurité.
- Recommandations actionnables.
- Éléments de preuve.

Sortie consolidée :
- Synthèse globale multi-audits avec priorités unifiées.

## 5. Rapports générés

Rapports obligatoires :
- Rapport global consolidé.
- Rapports spécialisés backend, DB, frontend, UI/UX, a11y, performance, sécurité.
- Tableau de synthèse des tendances.
- Journal d’exécution et de conformité du cycle d’audit.

Règles :
- Les rapports sont horodatés et versionnés.
- Les formats sont standardisés pour comparaison mensuelle.

## 6. Intégration CI

Le système d’orchestration doit s’intégrer à la CI de manière contrôlée.

Règles :
- Déclenchements sur planning mensuel et sur événements ciblés.
- Exécution en jobs séparés avec dépendances explicites.
- Archivage automatique des artefacts d’audit.
- Échec d’un audit critique = statut CI non conforme.
- Notifications automatiques aux responsables qualité.

## 7. Processus de validation

Processus normatif :
1. Vérification de complétude des rapports.
2. Contrôle qualité des preuves.
3. Validation croisée des dépendances entre audits.
4. Arbitrage des priorités de remédiation.
5. Validation finale par référent technique/qualité.

Règles :
- Aucune publication sans validation formelle.
- Toute anomalie de méthode déclenche une relance partielle.

## 8. Processus de publication

Processus normatif :
1. Publication du rapport consolidé.
2. Publication des rapports spécialisés associés.
3. Mise à jour du backlog priorisé.
4. Communication des actions P0/P1 aux équipes concernées.
5. Archivage et indexation du cycle d’audit.

Règles :
- La publication inclut un résumé exécutif orienté décision.
- Les engagements de remédiation doivent être datés et assignés.
- Les cycles successifs doivent rester comparables pour suivi de tendance.

Finalité : garantir une exécution auditable, répétable et gouvernée des audits eM@g, avec transformation systématique des constats en actions de stabilisation.