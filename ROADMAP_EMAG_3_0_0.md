# ROADMAP EMAG 3.0.0

## 1. Vision 3.0.0

eM@g 3.0.0 vise une plateforme plus fiable, plus rapide, plus accessible et plus évolutive, avec une architecture API modernisée, une expérience temps réel robuste, une cohérence UX complète et un socle qualité orienté non-régression continue.

## 2. API v2 versionnée

Objectif : introduire une API v2 contractuelle, versionnée, documentée, rétro-compatible par étapes, avec stratégie de migration progressive des consommateurs.

Résultats attendus :
- Contrats stabilisés.
- Gouvernance claire des évolutions incompatibles.
- Réduction du couplage historique des endpoints.

## 3. Pagination cursor-based

Objectif : remplacer les schémas de pagination fragiles par une pagination cursor-based sur flux volumineux.

Résultats attendus :
- Performance stable sur grands jeux de données.
- Cohérence des parcours liste/détail.
- Meilleure robustesse en temps réel.

## 4. WebSocket temps réel

Objectif : intégrer des flux temps réel pilotés et observables pour les modules nécessitant synchronisation rapide.

Résultats attendus :
- Rafraîchissement événementiel fiable.
- Réduction des rafraîchissements complets coûteux.
- Amélioration de la réactivité perçue.

## 5. Refactor modules lourds

Objectif : diminuer le risque structurel des modules à forte dette technique.

Cibles prioritaires :
- Planning
- Personnel
- Affaires
- Équipements
- Stock
- Display

Résultats attendus :
- Composants et services plus petits.
- Tests plus ciblés.
- Vélocité de correction augmentée.

## 6. DS complet

Objectif : faire du Design System la source de vérité UI/UX/a11y sur tous les modules.

Résultats attendus :
- Uniformité visuelle et comportementale.
- Réduction des divergences de composants.
- Maintenabilité renforcée.

## 7. Responsive mobile-first

Objectif : converger vers une stratégie mobile-first cohérente, sans couches parallèles non maîtrisées.

Résultats attendus :
- Expérience homogène sur tailles d’écran.
- Réduction des coûts de maintenance responsive.
- Gains en qualité perçue terrain.

## 8. PWA offline-first

Objectif : améliorer la résilience opérationnelle via capacités PWA et scénarios offline-first ciblés.

Résultats attendus :
- Continuité minimale en connectivité dégradée.
- Synchronisation contrôlée au retour réseau.
- Meilleure robustesse sur usage mobile.

## 9. i18n

Objectif : préparer la plateforme à la gestion multilingue cohérente des contenus UI et messages métier.

Résultats attendus :
- Internationalisation structurée.
- Messages centralisés et maintenables.
- Réduction du texte hardcodé.

## 10. Optimisation DB

Objectif : renforcer durablement performances et intégrité base de données.

Axes :
- Revue index et requêtes critiques.
- Contrôles d’invariants automatisés.
- Hygiène migrations et sauvegardes.

Résultats attendus :
- Latence plus stable.
- Réduction des incidents DB.
- Prévisibilité opérationnelle.

## 11. Refactor planning

Objectif : réduire complexité des flux de planification et fiabiliser les invariants métier.

Livrables : découpage des zones critiques, normalisation des interactions, tests de non-régression sur scénarios sensibles.

## 12. Refactor personnel

Objectif : clarifier gestion des statuts, rôles et disponibilités, tout en améliorant la lisibilité des écrans.

Livrables : composants rationalisés, règles métier centralisées, couverture de tests augmentée.

## 13. Refactor affaires

Objectif : stabiliser les parcours commerciaux complexes et découpler les zones fortement couplées.

Livrables : architecture de panneaux simplifiée, transitions d’état clarifiées, meilleure observabilité des erreurs.

## 14. Refactor stock

Objectif : renforcer cohérence des mouvements et fiabilité des invariants de quantité/état.

Livrables : flux normalisés, contrôles renforcés, tests ciblés sur cas limites.

## 15. Refactor équipements

Objectif : stabiliser inventaire, maintenance, médias et workflows SAV.

Livrables : séparation sous-domaines, validations homogènes, couverture smoke et intégration renforcée.

## 16. Jalons

- Jalon 1 : socle qualité et stabilisation critique.
- Jalon 2 : API v2 et performance de base.
- Jalon 3 : temps réel et convergence UX/DS.
- Jalon 4 : mobile-first avancé, PWA et i18n.
- Jalon 5 : consolidation finale et préparation release 3.0.0.

## 17. Dépendances

- Les refactors modules dépendent du socle stabilisation continue.
- L’API v2 dépend d’un cadrage contractuel et d’une stratégie de migration.
- Le temps réel dépend des invariants backend et de l’observabilité.
- L’offline-first dépend d’une stratégie de synchronisation robuste.
- L’i18n dépend de la normalisation des textes et composants.

## 18. Risques

- Dilution du périmètre si les jalons ne restent pas séquencés.
- Régressions sur modules lourds sans tests renforcés.
- Complexité d’intégration du temps réel sans contrat strict.
- Coût de transformation élevé si design system non imposé.
- Retard sur objectifs 3.0.0 en cas de dette critique non résorbée.

## 19. Livrables

- API v2 documentée et gouvernée.
- Modules critiques refactorés avec critères de sortie validés.
- Design System complet appliqué.
- Pipeline qualité/stabilisation continue renforcé.
- Socle responsive mobile-first consolidé.
- Capacités PWA offline-first ciblées.
- Préparation i18n opérationnelle.
- Tableau de bord qualité et non-régression actifs.

Conclusion stratégique : eM@g 3.0.0 doit être une version de fiabilité durable autant qu’une version de capacités nouvelles.