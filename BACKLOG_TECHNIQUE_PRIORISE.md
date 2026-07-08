# BACKLOG TECHNIQUE PRIORISÉ — eM@g

## 1. Priorité 0 — Critique

### Tâche P0-01 — Verrouiller durablement les endpoints publics sensibles
- Description : maintenir et généraliser le durcissement des routes publiques ou semi-publiques à mutation, avec inventaire formel, règles de revue, smoke tests obligatoires et surveillance des régressions sur les routes TV, auth et autres accès sans session utilisateur classique.
- Module : Display, Auth, Backend transverse
- Impact : très élevé sur la sécurité, l'intégrité métier et la réduction du risque de compromission ou d'altération distante.
- Dépendances : aucune dépendance bloquante ; s'appuie sur les correctifs déjà déployés.
- Complexité : moyenne
- Durée : 2 à 3 jours
- Risques : oubli d'un endpoint legacy, couverture de test incomplète, divergence entre routes modernes et historiques.
- Livrables : inventaire des endpoints publics, matrice d'authentification attendue, smoke tests sécurité, checklist de revue sécurité.

### Tâche P0-02 — Sanctuariser le flow de réinitialisation de mot de passe
- Description : transformer le flow OTP renforcé en standard non régressable, avec journalisation des tentatives, métriques de volume, contrôles anti-abus, tests de non-régression et validation documentaire du comportement attendu.
- Module : Auth, Backend, Exploitation
- Impact : très élevé sur la prévention de prise de contrôle de comptes et sur la sécurité des utilisateurs.
- Dépendances : P0-01 partiellement liée pour la logique de contrôle des routes publiques.
- Complexité : moyenne
- Durée : 2 à 4 jours
- Risques : faux positifs sur les limitations, friction utilisateur trop forte, manque de traçabilité des tentatives OTP.
- Livrables : règles du flow OTP, journalisation des tentatives, métriques de reset, tests automatisés du flow, fiche d'exploitation sécurité.

### Tâche P0-03 — Mettre l'intégrité SQLite sous contrôle continu
- Description : ajouter les vérifications d'intégrité de base en CI et en exploitation, incluant `foreign_key_check`, contrôle des invariants critiques, hygiène WAL, checkpoint planifié, nettoyage des artefacts et surveillance du volume des journaux.
- Module : Base de données, CI, Exploitation
- Impact : très élevé sur la prévention de corruption, de dérive silencieuse et d'incidents de démarrage ou de restauration.
- Dépendances : aucune ; recommandé avant refactors structurels lourds.
- Complexité : moyenne
- Durée : 3 à 5 jours
- Risques : faux sentiment de sécurité si les invariants retenus sont incomplets, coûts CI mal calibrés.
- Livrables : suite de vérifications DB, procédure de checkpoint, règles de nettoyage, checklist d'intégrité, reporting de santé DB.

### Tâche P0-04 — Découper les monolithes applicatifs les plus risqués
- Description : lancer le découpage des fichiers qui concentrent le plus de dette, de risque de régression et de coût de maintenance, en commençant par `database.js`, `suiviRoutes.js`, `displayRoutes.js`, `ordersRoutes.js`, `equipmentRoutes.js`, `AffaireDetailPanel.jsx`, `EquipmentPanel.jsx`, `PersonnelPanel.jsx`, `OrdersPanel.jsx` et `ManagementPanel.jsx`.
- Module : Backend, Frontend, modules métier critiques
- Impact : très élevé sur la stabilité des futures corrections, la lisibilité et la granularité des tests.
- Dépendances : P0-03 recommandée en amont ; P1 de standardisation facilitera la phase 2.
- Complexité : élevée
- Durée : 2 à 4 semaines
- Risques : régressions fonctionnelles diffuses, conflits inter-branches, baisse temporaire de vélocité.
- Livrables : plan de découpage par fichier, sous-modules extraits, critères de sortie, tests associés, journal de migration interne.

### Tâche P0-05 — Remettre l'accessibilité de base au niveau minimal acceptable
- Description : corriger en priorité les manques d'accessibilité fondamentaux dans le Design System et les composants structurants : ARIA de base, annonces d'erreurs de formulaires, états interactifs, focus management des modals, conformité minimale des patterns critiques.
- Module : Design System, Frontend, UI/UX, a11y
- Impact : très élevé sur la conformité, la robustesse et la qualité transverse de l'interface.
- Dépendances : aucune ; sert de socle à la standardisation P1/P2.
- Complexité : élevée
- Durée : 1 à 2 semaines
- Risques : corrections dispersées si le Design System n'est pas traité en source de vérité, oublis sur les composants historiques.
- Livrables : liste des écarts a11y P0, correctifs DS, checklists WCAG prioritaires, composants critiques remis à niveau, tests et scripts de vérification.

## 2. Priorité 1 — Haute

### Tâche P1-01 — Réduire durablement le coût du bootstrap frontend
- Description : poursuivre la réduction du shell initial, maintenir les gains de lazy loading, isoler les dépendances lourdes restantes, et poser des budgets de bundle bloquants en CI.
- Module : Frontend, Performance
- Impact : élevé sur la fluidité perçue, la charge initiale et la stabilité mobile.
- Dépendances : aucune forte ; complémentaire aux refactors frontend lourds.
- Complexité : moyenne
- Durée : 4 à 6 jours
- Risques : optimisation locale sans pilotage global, réintroductions involontaires au fil des features.
- Livrables : budgets bundle CI, plan des chunks critiques, liste des imports à différer, tableau avant/après des coûts bootstrap.

### Tâche P1-02 — Stabiliser les modules métier lourds un par un
- Description : produire et exécuter un plan de stabilisation ciblé pour Planning, Personnel, Affaires, Équipements, Stock et Display, avec analyse de risques, workflows critiques, composants à refactorer et critères de sortie par module.
- Module : Planning, Personnel, Affaires, Équipements, Stock, Display
- Impact : élevé sur la qualité métier, la résilience des usages quotidiens et la réduction du support correctif.
- Dépendances : P0-04 facilite l'exécution ; P0-05 améliore la qualité de sortie UI.
- Complexité : élevée
- Durée : 3 à 6 semaines
- Risques : surcharge de coordination, chantiers trop larges si le découpage n'est pas piloté module par module.
- Livrables : fiches de stabilisation par module, liste des scénarios critiques, priorisation intra-module, journal d'avancement.

### Tâche P1-03 — Standardiser formulaires, tableaux, modals et feedbacks
- Description : imposer des patterns unifiés pour les formulaires, tableaux, loaders, erreurs, toasts, modals et entêtes de page afin d'éliminer les divergences d'usage du Design System.
- Module : Design System, Frontend, UI/UX
- Impact : élevé sur la maintenabilité, la cohérence d'interface et la vitesse future de développement.
- Dépendances : P0-05 en amont pour les aspects a11y ; dépend partiellement de P0-04 sur les gros composants.
- Complexité : moyenne
- Durée : 1 à 2 semaines
- Risques : coexistence prolongée de deux standards, résistance des composants historiques.
- Livrables : catalogue de patterns, règles d'usage DS, backlog de migration des composants non conformes, checklist de revue UI.

### Tâche P1-04 — Verrouiller la fiabilité d'exploitation runtime
- Description : formaliser les contrôles runtime critiques autour de PM2, des variables d'environnement, des smoke tests, des redémarrages, des runbooks de sécurité et des vérifications post-déploiement.
- Module : Déploiement, Exploitation, Backend
- Impact : élevé sur la sécurité effective et la fiabilité des mises en production.
- Dépendances : s'appuie sur les correctifs récents de déploiement et d'environnement.
- Complexité : faible à moyenne
- Durée : 2 à 3 jours
- Risques : oubli d'un contrôle critique, documentation non tenue à jour.
- Livrables : runbook de déploiement sécurisé, checklist post-deploy, matrice des variables critiques, procédure de vérification runtime.

### Tâche P1-05 — Centraliser la gouvernance des audits et du backlog
- Description : transformer la matière d'audit existante en backlog gouverné, avec propriétaires, critères d'acceptation, priorisation stable, dépendances et suivi d'exécution.
- Module : Gouvernance, Documentation, transverse
- Impact : élevé sur la capacité à exécuter les corrections sans dispersion.
- Dépendances : le plan d'action unifié sert de base ; ce backlog en constitue le premier livrable.
- Complexité : faible
- Durée : 1 à 2 jours
- Risques : backlog trop verbeux ou insuffisamment actionnable, perte de lien avec les preuves d'audit.
- Livrables : backlog priorisé, règles de pilotage, structure de suivi, statut par lot.

## 3. Priorité 2 — Moyenne

### Tâche P2-01 — Extraire les patterns backend partagés
- Description : factoriser les patterns de routes, services, validations, mutations, transactions et helpers récurrents afin de réduire les divergences de style backend.
- Module : Backend, Architecture
- Impact : moyen à élevé sur la cohérence technique et la maintenabilité.
- Dépendances : P0-04 souhaitable sur les fichiers les plus volumineux.
- Complexité : moyenne
- Durée : 1 à 2 semaines
- Risques : abstraction prématurée, factorisation trop théorique.
- Livrables : patterns backend documentés, helpers factorisés, conventions d'écriture partagées.

### Tâche P2-02 — Normaliser entièrement l'usage du Design System
- Description : remplacer progressivement couleurs hardcodées, styles inline structurants, breakpoints exotiques, spacings bruts et composants d'interface ad-hoc par les primitives et tokens canoniques.
- Module : Frontend, UI/UX, Design System
- Impact : moyen sur la cohérence visuelle, la maintenabilité et la capacité d'évolution.
- Dépendances : P1-03 et P0-05 recommandées.
- Complexité : moyenne à élevée
- Durée : 2 à 4 semaines
- Risques : grande dispersion des corrections, effet cosmétique sans gain structurel si non piloté par priorités.
- Livrables : plan de migration DS, liste des écarts résiduels, modules remédiés, tableau de conformité.

### Tâche P2-03 — Étendre l'accessibilité fonctionnelle au-delà du minimum
- Description : après remise à niveau P0, compléter l'accessibilité sur les composants interactifs, les contrastes, les feedbacks visuels, la navigation clavier et les états complexes.
- Module : Frontend, Design System, a11y
- Impact : moyen à élevé sur la conformité et la qualité d'usage.
- Dépendances : P0-05 obligatoire.
- Complexité : moyenne
- Durée : 1 à 3 semaines
- Risques : dispersion, difficulté à vérifier sans outillage et scénarios de test.
- Livrables : plan a11y P2, checklist WCAG, rapport de couverture ARIA, corrections par famille de composants.

### Tâche P2-04 — Renforcer la couverture de tests métier ciblés
- Description : ajouter les scénarios automatisés les plus rentables sur SAV, contrôles périodiques, invariants DB, uploads sensibles, TV, planning et Google Calendar.
- Module : Tests, Backend, Frontend, modules métier
- Impact : moyen à élevé sur la prévention des régressions.
- Dépendances : dépend en partie de P0-04 pour améliorer la testabilité.
- Complexité : moyenne
- Durée : 1 à 2 semaines
- Risques : surinvestissement dans des tests fragiles si les composants restent trop monolithiques.
- Livrables : suites de tests ciblées, matrice de couverture, critères de non-régression renforcés.

### Tâche P2-05 — Mettre en place une observabilité qualité/performance
- Description : instrumenter le frontend et le backend avec Web Vitals, suivi d'erreurs, indicateurs de qualité, alertes et rapports récurrents.
- Module : Observabilité, Frontend, Backend
- Impact : moyen à élevé sur la capacité de détection précoce.
- Dépendances : budgets perf et gouvernance backlog utiles mais non bloquants.
- Complexité : moyenne
- Durée : 4 à 7 jours
- Risques : instrumentation partielle, bruit trop élevé dans les alertes.
- Livrables : plan d'observabilité, métriques suivies, tableau de bord qualité/perf, règles d'alerte.

## 4. Priorité 3 — Faible

### Tâche P3-01 — Finaliser le polish visuel transverse
- Description : nettoyer les incohérences visuelles mineures de densité, libellés, pastilles, micro-espacements et états d'interface non critiques restants.
- Module : UI/UX, Frontend
- Impact : faible à moyen sur la perception de qualité.
- Dépendances : P1-03 et P2-02 recommandées.
- Complexité : faible
- Durée : 3 à 5 jours
- Risques : dilution dans des tâches à faible ROI si engagé trop tôt.
- Livrables : liste des écarts cosmétiques, corrections groupées, contrôle visuel final.

### Tâche P3-02 — Compléter la documentation technique transverse
- Description : produire les documents de référence manquants : glossaire UI, conventions, README par domaine, runbooks et notes de bascule sécurité.
- Module : Documentation, Gouvernance
- Impact : faible à moyen sur la transmission et l'exploitation.
- Dépendances : P1-05 utile pour structurer les sorties.
- Complexité : faible
- Durée : 2 à 4 jours
- Risques : documentation obsolète si non reliée à un processus de mise à jour.
- Livrables : corpus documentaire structuré, index de référence, règles de maintenance documentaire.

### Tâche P3-03 — Rationaliser la couche mobile secondaire
- Description : réduire les duplications mobiles non essentielles après stabilisation des modules principaux, pour simplifier l'entretien de la parité responsive.
- Module : Frontend mobile, UI/UX
- Impact : faible à moyen sur le coût de maintenance futur.
- Dépendances : P1-02, P1-03 et P2-02 recommandées.
- Complexité : moyenne
- Durée : 1 à 2 semaines
- Risques : régression responsive si engagé avant stabilisation des patterns communs.
- Livrables : cartographie des duplications mobiles, plan de fusion/factorisation, composants mutualisés.

### Tâche P3-04 — Nettoyer les reliquats historiques non canoniques
- Description : archiver, supprimer ou normaliser les fragments de code, patterns visuels, couleurs, styles et comportements résiduels qui n'ont plus vocation à rester en production.
- Module : Transverse
- Impact : faible sur la prod immédiate, utile sur le long terme.
- Dépendances : P2-02 et P2-05 utiles pour savoir quoi retirer proprement.
- Complexité : faible à moyenne
- Durée : 3 à 5 jours
- Risques : suppression prématurée d'un reliquat encore utilisé indirectement.
- Livrables : inventaire des reliquats, lot de nettoyage, règles d'archivage, état final allégé.
