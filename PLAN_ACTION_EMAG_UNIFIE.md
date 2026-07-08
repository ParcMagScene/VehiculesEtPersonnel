# PLAN D'ACTION eM@g — Synthèse unifiée des audits

## 1. Résumé exécutif

Le système eM@g présente une base technique globalement solide, fonctionnellement dense et déjà structurée autour d'un monorepo cohérent, d'un backend Express mature, d'un frontend React riche, d'une base SQLite bien outillée et d'un Design System réel mais encore imparfaitement adopté. La maturité technique globale peut être qualifiée de bonne, avec une architecture en place, des garde-fous concrets sur les flux critiques, une couverture de tests significative et une capacité de déploiement maîtrisée. En revanche, cette maturité reste pénalisée par trois poches de risque majeures : la dette structurelle sur plusieurs fichiers et modules monolithiques, l'hétérogénéité d'adoption des standards UI/UX et accessibilité, et une série de sujets sécurité/performance historiquement accumulés dont certains ont été corrigés récemment mais nécessitent encore normalisation et verrouillage opérationnel.

Les audits convergent vers une même conclusion : eM@g n'est pas en crise architecturale, mais dans une phase où la stabilité future dépend moins d'une réécriture que d'une consolidation disciplinée. Les urgences immédiates sont la réduction des risques P0 liés à la sécurité, à l'intégrité des données et à la robustesse d'exploitation ; viennent ensuite la stabilisation des modules métier lourds et la normalisation transverse des patterns backend, frontend, base de données et design system. La stratégie recommandée est donc une trajectoire en trois temps : sécuriser, stabiliser, standardiser.

## 2. Synthèse des audits

### Audit global
L'audit complet consolidé met en évidence une application métier large, avec une couverture fonctionnelle élevée et une architecture globalement saine, mais aussi une concentration de dette technique sur des points structurants : fichiers géants, workflows critiques insuffisamment atomiques, points de contention SQLite, et dépendance excessive à certains modules centraux. La trajectoire recommandée est un plan de fiabilisation incrémental centré sur les modules les plus sollicités et les invariants système.

### Audit backend
Le backend présente de bons fondamentaux : découpage par domaines, validation Zod sur de nombreuses routes, cache auth, rate limiters, et base SQLite correctement configurée en WAL. Les faiblesses identifiées portent surtout sur les fichiers monolithiques, des patterns SQL dynamiques résiduels, l'absence historique de certains timeouts et quelques flux métier encore trop couplés. Les travaux backend doivent prioriser la réduction de la complexité structurelle, la sécurisation des mutations et la standardisation des patterns d'écriture.

### Audit base de données
La base SQLite est correctement instrumentée et indexée dans l'ensemble, mais l'audit a mis en lumière plusieurs signaux de fragilité : WAL historiquement trop volumineux, tables anciennes moins rigoureuses en contraintes, manque de vérifications d'invariants en CI, et risque de dérive sur les sauvegardes et artefacts de base. Le plan DB doit viser la résilience opérationnelle, l'hygiène des migrations, la validation d'intégrité et l'optimisation des accès les plus fréquents.

### Audit frontend
Le frontend React bénéficie d'une base moderne, d'un découpage lazy déjà engagé, d'une vraie dynamique d'optimisation et d'un socle UX déjà conséquent. Les problèmes viennent principalement des méga-composants, de dépendances lourdes encore concentrées dans certains flux, et d'une hétérogénéité dans les loaders, états d'erreur, tableaux, interactions et shells de navigation. Le chantier frontend doit se concentrer sur le découpage, la réduction du coût initial et l'uniformisation des patterns d'interface.

### Audit UI/UX
L'audit UI/UX conclut que les fondations sont bonnes mais que l'adoption réelle du design system n'est pas homogène. Les écarts concernent les couleurs hardcodées, les styles inline, les breakpoints exotiques, les formulaires non uniformisés, les terminologies métier parfois instables et les comportements divergents entre modules. L'action prioritaire consiste à faire du design system une source de vérité réellement contraignante, en ciblant d'abord les méga-composants et la couche mobile parallèle.

### Audit accessibilité (a11y)
L'audit accessibilité est le plus sévère sur le plan qualité transverse. La couverture ARIA est très faible, de nombreux états interactifs ne sont pas exposés, les formulaires n'annoncent pas correctement leurs erreurs, les contrastes ne sont pas validés systématiquement, et plusieurs patterns n'atteignent pas le niveau WCAG attendu. L'enjeu n'est pas cosmétique : il touche à la conformité, à la robustesse et à l'industrialisation des composants.

### Audit performance
L'audit performance montre une amélioration concrète grâce au lazy loading déjà engagé, notamment sur les gros panneaux métier et sur la chaîne PDF. Malgré cela, le coût global du bundle reste élevé, le CSS historique reste volumineux, et certaines optimisations doivent être pérennisées via des budgets CI, des importations à la demande et une réduction du bootstrap shell. La performance doit être traitée comme un budget contrôlé, non comme une série de corrections ponctuelles.

### Audit sécurité
L'audit sécurité historique a révélé des vulnérabilités critiques sur les flux d'authentification, certains endpoints publics, la surface TV, le reset password, l'exposition de secrets et le transport. Une partie importante de ces risques a été corrigée, notamment lors de la session la plus récente : verrouillage des écritures TV, durcissement des uploads, sécurisation des cookies, durcissement du flow OTP de réinitialisation, et préparation d'une activation HSTS pilotée par environnement. Le résiduel principal n'est plus un défaut applicatif majeur, mais un sujet d'exploitation et de gouvernance de configuration.

## 3. Points critiques P0

### P0.1 — Sécurité des écritures TV et endpoints publics sensibles
- Statut : traité partiellement et récemment sécurisé.
- Problème : des routes TV mutatrices acceptaient historiquement un accès avec authentification trop permissive.
- Action : maintenir l'authentification stricte par token TV sur toute écriture, inventorier les autres endpoints publics à mutation, interdire toute dérive future via règles de revue et tests smoke.
- Résultat attendu : impossibilité d'altérer l'état TV sans jeton valide.

### P0.2 — Réinitialisation de mot de passe et abuse control
- Statut : chaîne critique réduite, flow OTP imposé, throttling renforcé.
- Problème : l'ancien flux de reset direct était incompatible avec un niveau de sécurité acceptable.
- Action : conserver le flow OTP obligatoire, étendre la journalisation des tentatives, surveiller les volumes d'envoi, et intégrer ce flux dans la batterie de tests de non-régression.
- Résultat attendu : suppression durable du takeover trivial de compte.

### P0.3 — Intégrité et santé SQLite
- Statut : risque structurel toujours présent à surveiller.
- Problème : WAL historiquement surdimensionné, risques d'artefacts de sauvegarde, manque d'invariants automatisés.
- Action : checkpoints planifiés, vérification d'intégrité régulière, audit FK, nettoyage systématique des artefacts DB, ajout des contrôles en CI.
- Résultat attendu : réduction du risque de corruption, de démarrage lent et de dérive silencieuse.

### P0.4 — Monolithes applicatifs critiques
- Statut : non résolu structurellement.
- Problème : plusieurs fichiers pilotent trop de responsabilités et concentrent le risque de régression.
- Action : découper en priorité `database.js`, `suiviRoutes.js`, `displayRoutes.js`, `ordersRoutes.js`, `equipmentRoutes.js`, `AffaireDetailPanel.jsx`, `EquipmentPanel.jsx`, `PersonnelPanel.jsx`, `OrdersPanel.jsx`, `ManagementPanel.jsx`.
- Résultat attendu : baisse de la complexité, tests plus ciblés, corrections plus sûres.

### P0.5 — Accessibilité de base non conforme
- Statut : ouvert.
- Problème : couverture ARIA très insuffisante, formulaires incomplets, états invisibles aux lecteurs d'écran.
- Action : faire de l'a11y un chantier P0 sur le Design System et les composants structurants, avant toute refonte visuelle additionnelle.
- Résultat attendu : conformité minimale, robustesse accrue et baisse des incohérences UI.

## 4. Points importants P1

### P1.1 — Performance bundle et bootstrap
Réduire durablement le coût du shell initial, préserver les gains obtenus sur les panneaux lourds, poursuivre le découpage des dépendances PDF/print et généraliser les budgets de bundle en CI.

### P1.2 — Stabilisation des modules métier lourds
Planning, Personnel, Affaires, Équipements, Stock et Display concentrent les charges fonctionnelles, les surfaces de bug et la dette UX. Ils doivent faire l'objet de plans de stabilisation individualisés avec critères de sortie.

### P1.3 — Standardisation des patterns formulaires, tableaux, modals et feedbacks
Les divergences actuelles dégradent la maintenabilité et l'expérience utilisateur. Il faut unifier les règles d'usage du Design System, les tableaux, les modals, les loaders, les erreurs et les interactions métier.

### P1.4 — Fiabilité d'exploitation et configuration runtime
Le durcissement récent a montré qu'un écart entre configuration versionnée et runtime PM2 peut invalider une mesure de sécurité. Le cycle de déploiement doit systématiquement recharger l'environnement, vérifier les variables critiques et produire un smoke report exploitable.

### P1.5 — Gouvernance documentaire et backlog unifié
Les audits sont riches mais dispersés. Il faut basculer vers un pilotage centralisé par backlog priorisé, critères d'acceptation, dépendances et jalons.

## 5. Points moyens P2

### P2.1 — Refactors de structure
- Extraction de sous-modules backend.
- Extraction de sous-vues frontend.
- Réduction des responsabilités par fichier.
- Standardisation des helpers transverses.

### P2.2 — Normalisation du Design System
- Remplacement des couleurs hardcodées.
- Réduction des styles inline.
- Adoption systématique des tokens spacing/typographie.
- Normalisation des breakpoints.
- Unification des composants de navigation, badges, tableaux et headers.

### P2.3 — Accessibilité fonctionnelle
- `aria-describedby` et `aria-invalid` sur les champs.
- États ARIA sur menus, accordéons, toggles et tabs.
- Revue des contrastes WCAG AA.
- Focus management et annonces sur les modals.

### P2.4 — Couverture de tests métier
- Tests d'import SAV idempotents.
- Tests de contrôles périodiques en retard/manqués.
- Tests d'invariants DB.
- Smoke tests API/UI par module critique.

### P2.5 — Observabilité
- Réactivation d'une solution de suivi d'erreurs.
- Web Vitals côté frontend.
- Tableaux de bord de qualité et de performance.
- Alertes sur les flows critiques.

## 6. Points faibles P3

### P3.1 — Polish visuel
Nettoyage des micro-incohérences de densité, d'espacement, de terminologie et d'états visuels restants.

### P3.2 — Documentation technique complémentaire
Glossaire UI, conventions de nommage, README module par module, runbooks d'exploitation, fiches de bascule sécurité.

### P3.3 — Rationalisation cosmétique mobile
Réduction des duplications secondaires de la couche mobile lorsque les chantiers P1/P2 seront stabilisés.

### P3.4 — Nettoyage des reliquats historiques
Suppression ou archivage de patterns, couleurs, fragments CSS et comportements non canoniques encore tolérés.

## 7. Dépendances entre tâches

### Dépendances structurantes
1. Sécurisation et exploitation runtime avant toute stabilisation profonde des modules.
2. Vérification d'intégrité DB avant les refactors lourds backend.
3. Découpage des méga-fichiers avant généralisation des tests fins par module.
4. Normalisation du Design System avant harmonisation massive UI/UX.
5. Mise à niveau a11y du Design System avant campagnes d'accessibilité sur les écrans métier.
6. Budgets de performance et instrumentation avant optimisation de détail.
7. Backlog unifié et critères de sortie avant montée en charge multi-branches.

### Graphe logique simplifié
- Sécurité P0 et exploitation runtime -> stabilité de la prod -> capacité à refactorer.
- Intégrité DB -> sécurité métier -> refactor backend.
- Refactor backend/frontend lourds -> réduction du risque de régression -> extension des tests.
- Design System + a11y -> homogénéité UI -> amélioration UX à coût marginal réduit.
- Monitoring qualité/perf -> pilotage continu -> prévention des retours en arrière.

## 8. Impacts potentiels

### Risques des chantiers
- Régressions métier sur modules historiques si les découpages sont trop larges.
- Risques de conflits inter-modules en l'absence de backlog gouverné.
- Tension temporaire sur les délais fonctionnels si la stabilisation n'est pas sanctuarisée.
- Risque de faux sentiment de sécurité si les contrôles ne sont pas monitorés en runtime.

### Bénéfices attendus
- Réduction immédiate du risque de faille exploitable.
- Diminution des incidents de régression sur les zones critiques.
- Accélération des corrections futures grâce à des fichiers plus petits et des patterns standardisés.
- Meilleure expérience utilisateur, meilleure accessibilité et meilleure résilience perçue.
- Capacité à préparer une roadmap 3.0.0 sans dette bloquante.

### ROI attendu
- Très élevé sur sécurité runtime, reset password, endpoints publics, déploiement et checks DB.
- Élevé sur découpage des 6 à 10 plus gros fichiers.
- Élevé sur standardisation Design System / formulaires / modals.
- Moyen sur polish visuel et documentation complémentaire.

## 9. Modules concernés

### Planning
- Problèmes : workflows complexes, modals multiples, logique dense, dépendance GCal.
- Priorités : stabilisation formulaire, cohérence des événements, tests de régression, optimisation lecture.

### Personnel
- Problèmes : panneau volumineux, duplication mobile, règles visuelles multiples.
- Priorités : découpage, harmonisation fiches et affectations, accessibilité formulaires, tests métier.

### Affaires
- Problèmes : composant massif, dashboards et imports couplés, styles dynamiques nombreux.
- Priorités : refactor de détail d'affaire, unification des modals, simplification des vues secondaires.

### Équipements
- Problèmes : panel central très lourd, multiples modals et imports, surface upload critique.
- Priorités : découpage, stabilisation média/SAV/import, tests d'intégration et normalisation UI.

### Stock
- Problèmes : complexité fonctionnelle, dialogues multiples, terminologie composite.
- Priorités : découpage, clarification des workflows, standardisation des tableaux et actions.

### Display
- Problèmes : surface publique, héritage TV/legacy, configuration dense.
- Priorités : maintien du durcissement sécurité, découpage backend, instrumentation et gouvernance des accès.

### Google Calendar
- Problèmes : dépendance externe structurante, couplage planning, contraintes de quota et feedback utilisateur.
- Priorités : robustesse sync, messages d'état, tests smoke et isolation des erreurs.

## 10. Risques si non traités

### Risques techniques
- Réapparition de vulnérabilités sur des surfaces publiques ou semi-publiques.
- Régressions fréquentes sur les méga-composants.
- Dégradation du temps de chargement et inflation bundle/CSS.
- Dette d'exploitation sur déploiement et configuration.
- Corruption ou dérive silencieuse des données non détectée assez tôt.

### Risques métier
- Pertes de confiance sur les workflows critiques.
- Blocages opératoires sur planning, personnel, équipements ou stock.
- Complexité croissante pour intégrer de nouvelles fonctionnalités métier.
- Augmentation du coût de support et de correction.

### Risques sécurité
- Réouverture future de vecteurs TV/auth/reset/upload si les règles ne sont pas institutionnalisées.
- Mauvaise bascule HSTS si l'infra n'est pas préparée.
- Faible détection des dérives sans instrumentation ni revue dédiée.

## 11. Gains si traités

### Stabilité
- Baisse des incidents de production et meilleure confiance sur les déploiements.
- Refactors plus ciblés et moins risqués.

### Performance
- Réduction du coût du bootstrap.
- Chargements plus fluides sur les panneaux lourds.
- Budgets de performance pilotés au lieu de subir les dérives.

### UX
- Interface plus homogène, plus lisible, plus prévisible.
- Formulaires, tableaux et modals plus cohérents.
- Réduction des comportements divergents desktop/mobile.

### Sécurité
- Surface publique mieux contrôlée.
- Flows d'authentification durcis.
- Configuration runtime plus fiable.
- Préparation propre à une montée de niveau transport avec HSTS.

## 12. Plan d'action court terme (1–2 semaines)

### Semaine 1
1. Geler les règles de sécurité récemment corrigées dans des tests smoke et de non-régression.
2. Ajouter les vérifications d'intégrité DB en CI : foreign_key_check, invariants critiques, hygiène WAL/artefacts.
3. Sanctuariser le script de déploiement et la vérification runtime des variables critiques.
4. Centraliser un backlog P0/P1 unique et nommer explicitement les responsables par module.
5. Ouvrir les chantiers de découpage sur les deux ou trois plus gros hotspots backend et frontend.

### Semaine 2
1. Corriger le Design System sur l'axe accessibilité de base : `aria-describedby`, `aria-invalid`, focus management, états ARIA critiques.
2. Standardiser les formulaires et modals des modules Planning, Personnel et Équipements.
3. Lancer l'audit des tableaux et des headers de page pour préparer leur unification.
4. Installer les budgets CI frontend/backend/documentation comme critères bloquants.
5. Vérifier les flux Google Calendar, TV et uploads via smoke tests ciblés.

## 13. Plan d'action moyen terme (1–2 mois)

### Axe 1 — Stabilisation structurelle
1. Découper les méga-fichiers backend et frontend prioritaires.
2. Réduire le couplage inter-modules et extraire les patterns de service, validation et transactions.
3. Normaliser les migrations et la gouvernance DB.

### Axe 2 — Uniformisation UX / DS / a11y
1. Éliminer les couleurs hardcodées et styles inline critiques.
2. Normaliser breakpoints, tableaux, badges, loaders, feedbacks et headers.
3. Refaire la cartographie mobile pour réduire les duplications non justifiées.
4. Faire passer les composants structurants au niveau WCAG ciblé.

### Axe 3 — Performance et observabilité
1. Mettre en place budgets de taille et de perf obligatoires en CI.
2. Poursuivre la stratégie lazy sur les dépendances lourdes et les panneaux secondaires.
3. Ajouter Web Vitals, suivi d'erreurs, rapports mensuels qualité/performance.

### Axe 4 — Sécurité et gouvernance
1. Préparer la bascule HSTS lorsque le frontal sera intégralement servi en HTTPS.
2. Formaliser les règles de review sécurité et les critères bloquants par domaine.
3. Consolider les audits en tableau de bord qualité et backlog piloté.

## 14. Plan d'action long terme (3–6 mois)

### Objectif 1 — Plateforme stabilisée et standardisée
Faire converger backend, frontend, base et UI vers un référentiel unique de patterns, de règles de validation, de conventions de nommage et de critères de qualité.

### Objectif 2 — Préparation de la version majeure
Préparer le terrain pour une trajectoire eM@g 3.0.0 : API mieux versionnable, navigation plus déterministe, modules métiers plus découplés, instrumentation native, meilleure observabilité et capacité d'évolution plus rapide.

### Objectif 3 — Excellence opérationnelle continue
Transformer les audits ponctuels en système permanent : revue mensuelle qualité, budgets CI, métriques, alertes, tableau de bord de maturité, contrôles de non-régression et gouvernance documentaire.

### Objectif 4 — Réduction durable du coût de maintenance
Amener les principaux modules métier à un niveau où chaque correction locale n'impose plus une réanalyse globale du panneau ou de la route concernée. La cible n'est pas seulement un code plus propre, mais un système où le coût marginal du changement diminue réellement.
