# TABLEAU DE BORD QUALITÉ — eM@g

## 1. Score backend

Finalité : mesurer la robustesse applicative backend.

Composants recommandés :
- Qualité statique.
- Fiabilité des tests backend.
- Stabilité des routes critiques.
- Conformité des patterns sécurité backend.

## 2. Score frontend

Finalité : mesurer la qualité de l’interface et la maintenabilité front.

Composants recommandés :
- Qualité statique frontend.
- Santé des tests UI.
- Cohérence Design System.
- Stabilité responsive.

## 3. Score DB

Finalité : mesurer intégrité, performance et hygiène des données.

Composants recommandés :
- Vérifications d’intégrité.
- Santé migrations.
- Stabilité des requêtes critiques.
- Indicateurs de dérive et d’anomalie.

## 4. Score sécurité

Finalité : suivre le niveau de risque opérationnel sécurité.

Composants recommandés :
- Vulnérabilités ouvertes par sévérité.
- Conformité des routes sensibles.
- Résultats des tests de refus attendus.
- Dette de remédiation sécurité.

## 5. Score performance

Finalité : suivre fluidité et efficience technique.

Composants recommandés :
- Temps de réponse API clés.
- Indicateurs bundle et chargement frontend.
- Stabilité des budgets de performance.
- Variabilité des temps sur parcours critiques.

## 6. Score UX

Finalité : mesurer lisibilité, cohérence et efficacité des parcours.

Composants recommandés :
- Cohérence des patterns écrans.
- Qualité des feedbacks utilisateur.
- Frictions observées sur parcours majeurs.
- Taux de résolution sans assistance.

## 7. Score a11y

Finalité : mesurer la conformité accessibilité et la robustesse des interactions.

Composants recommandés :
- Couverture ARIA critique.
- Conformité des formulaires.
- Contrastes et navigation clavier.
- Régressions accessibilité ouvertes.

## 8. Score documentation

Finalité : mesurer l’alignement entre système réel et connaissance projet.

Composants recommandés :
- Conformité docs:check.
- Fraîcheur des documents normatifs.
- Couverture runbooks critiques.
- Cohérence changelog/backlog/docs.

## 9. Métriques

Métriques minimales :
- Taux de CI verte.
- Taux de tests réussis.
- Nombre de régressions détectées.
- Nombre de vulnérabilités par sévérité.
- Temps moyen de correction par priorité.
- Nombre d’écarts DS/a11y/documentation.
- Tendance des incidents production.

## 10. Seuils

Les seuils doivent être définis par score et validés en gouvernance technique.

Règles :
- Seuil d’alerte (préventif).
- Seuil critique (action immédiate).
- Seuil cible (objectif trimestriel).
- Révision mensuelle des seuils selon maturité.

## 11. Couleurs

Convention visuelle recommandée :
- Vert : conforme.
- Orange : vigilance.
- Rouge : non conforme.
- Gris : données insuffisantes.

Règles :
- Les couleurs doivent refléter les seuils validés.
- Aucun statut couleur sans métrique source traçable.

## 12. Alertes

Types d’alertes :
- Alerte immédiate sur franchissement critique.
- Alerte de dérive sur tendance négative continue.
- Alerte de conformité sur documents/tests manquants.

Règles :
- Les alertes doivent être assignées à un propriétaire.
- Chaque alerte produit une action tracée.

## 13. Tendances

Suivi des tendances :
- Hebdomadaire pour signaux rapides.
- Mensuel pour pilotage stratégique.
- Trimestriel pour trajectoire de maturité.

Règles :
- Comparaison avec baseline.
- Analyse des causes pour chaque dérive significative.
- Validation des gains durables avant clôture d’actions.

## 14. Rapports mensuels

Le rapport mensuel qualité doit inclure :
- Synthèse des scores par domaine.
- Évolution des métriques clés.
- Écarts critiques et causes.
- Actions correctives engagées et statut.
- Priorités du cycle suivant.

Finalité : transformer la qualité en pilotage continu fondé sur des preuves, avec visibilité claire pour la décision technique et produit.