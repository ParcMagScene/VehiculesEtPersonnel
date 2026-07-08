# STABILISATION DES MODULES CRITIQUES — eM@g

## Planning

### 1. Analyse des risques
- Complexité métier élevée (contraintes temporelles, affectations, dépendances calendaires).
- Risque de régression transversal avec Google Calendar.
- Forte sensibilité UX sur les opérations quotidiennes.

### 2. Problèmes connus
- Logique écran dense, difficile à maintenir.
- Gestion des états parfois hétérogène entre vues.
- Scénarios de conflit de planning insuffisamment outillés.

### 3. Corrections nécessaires
- Stabiliser les invariants d’affectation et de disponibilité.
- Clarifier les règles de priorité en cas de conflit.
- Renforcer les garde-fous sur les actions critiques.

### 4. Refactors recommandés
- Découper les blocs de logique métier volumineux.
- Isoler les transformations de données planning.
- Séparer clairement orchestration UI et logique métier.

### 5. Normalisations
- Uniformiser nomenclature, statuts et libellés métier.
- Harmoniser composants formulaires et tableaux.
- Aligner comportement desktop/mobile.

### 6. Tests à ajouter
- Non-régression sur création, modification, suppression d’événements.
- Cas de conflit multi-ressources.
- Smoke tests sync calendrier externe.

### 7. Dépendances
- Dépend fortement de Google Calendar.
- Interagit avec Personnel, Affaires et Équipements.

### 8. Impacts
- Stabilisation du module le plus central pour l’exploitation.
- Réduction des incidents opérationnels quotidiens.

## Personnel

### 1. Analyse des risques
- Données RH sensibles et structurantes pour les affectations.
- Risque élevé d’incohérence avec planning et permissions.

### 2. Problèmes connus
- Écrans et composants lourds.
- Variantes UI parfois divergentes selon contexte.
- Règles métier dispersées.

### 3. Corrections nécessaires
- Fiabiliser la gestion des statuts et disponibilités.
- Renforcer cohérence des permissions et actions.
- Clarifier les règles de visibilité des données.

### 4. Refactors recommandés
- Fractionner les composants volumineux.
- Extraire les règles métier partagées.
- Réduire le couplage entre affichage et logique métier.

### 5. Normalisations
- Standardiser formulaires et validations.
- Uniformiser parcours édition/consultation.
- Aligner terminologie métier.

### 6. Tests à ajouter
- Scénarios CRUD personnel complets.
- Cas limites permissions et rôles.
- Non-régression affectations inter-modules.

### 7. Dépendances
- Fort lien avec Planning et Auth.
- Dépendances de données vers Affaires.

### 8. Impacts
- Amélioration de la fiabilité des affectations.
- Réduction des incohérences métier en chaîne.

## Affaires

### 1. Analyse des risques
- Module à forte densité fonctionnelle.
- Impacts multiples sur dashboards, documents et workflow commercial.

### 2. Problèmes connus
- Composants massifs et difficiles à relire.
- Multiplication d’états UI locaux.
- Hétérogénéité de certaines interactions.

### 3. Corrections nécessaires
- Stabiliser les transitions d’état métier.
- Sécuriser les mutations sensibles.
- Clarifier règles de calcul et d’affichage.

### 4. Refactors recommandés
- Découpage des panneaux détaillés.
- Extraction des blocs de logique calculatoire.
- Réduction des effets secondaires implicites.

### 5. Normalisations
- Uniformiser structures de vues détaillées.
- Harmoniser actions contextuelles et feedbacks.
- Aligner règles d’erreurs et messages utilisateur.

### 6. Tests à ajouter
- Parcours complet création jusqu’à clôture.
- Cas limites statuts et transitions.
- Tests smoke sur vues clés et actions prioritaires.

### 7. Dépendances
- Dépendances fortes avec Planning, Stock et Documents.
- Interactions backend critiques sur mutations.

### 8. Impacts
- Réduction des régressions à fort coût métier.
- Meilleure lisibilité des flux commerciaux.

## Équipements

### 1. Analyse des risques
- Module très exposé aux imports, médias et suivi SAV.
- Risques élevés sur intégrité des données techniques.

### 2. Problèmes connus
- Surface fonctionnelle large et couplée.
- Multiples modals et parcours avec états complexes.
- Historique de corrections sécurité sur uploads.

### 3. Corrections nécessaires
- Stabiliser les workflows d’import et de suivi.
- Renforcer contrôles sur opérations de mutation.
- Consolider les règles de validation médias et pièces.

### 4. Refactors recommandés
- Séparer les sous-domaines (inventaire, maintenance, médias).
- Extraire services de transformation et validation.
- Réduire la complexité des composants d’orchestration.

### 5. Normalisations
- Harmoniser statuts de maintenance et d’intervention.
- Standardiser tableaux et actions de masse.
- Aligner conventions de nommage technique.

### 6. Tests à ajouter
- Non-régression imports et rapprochements.
- Tests de flux SAV/maintenance.
- Smoke tests upload et consultation média.

### 7. Dépendances
- Dépendances avec Stock, Affaires et API fichiers.
- Interactions DB sensibles sur historique équipement.

### 8. Impacts
- Réduction des incidents à fort coût opérationnel.
- Fiabilisation des traces techniques et SAV.

## Stock

### 1. Analyse des risques
- Cœur logistique avec effets directs sur disponibilité terrain.
- Risque de divergence de quantités et d’états.

### 2. Problèmes connus
- Complexité de certains workflows de mouvement.
- Comportements UI pas toujours homogènes.
- Contrôles d’invariants perfectibles.

### 3. Corrections nécessaires
- Renforcer cohérence des opérations d’entrée/sortie.
- Sécuriser les transitions d’état critiques.
- Clarifier les règles de correction et d’annulation.

### 4. Refactors recommandés
- Isoler logique de mouvement et de calcul.
- Structurer les services autour d’invariants explicites.
- Réduire la duplication des règles de validation.

### 5. Normalisations
- Standardiser unités, statuts et motifs.
- Uniformiser parcours d’inventaire et ajustements.
- Aligner tableaux de suivi avec le design system.

### 6. Tests à ajouter
- Cas d’invariants de stock et anti-dérive.
- Scénarios de mouvements chaînés.
- Tests de non-régression sur corrections manuelles.

### 7. Dépendances
- Interagit fortement avec Équipements et Affaires.
- Dépendances DB critiques pour cohérence globale.

### 8. Impacts
- Diminution du risque d’écarts de stock.
- Fiabilisation des décisions opérationnelles.

## Display

### 1. Analyse des risques
- Surface exposée (affichage/TV) avec enjeux sécurité et disponibilité.
- Risque de mutation non autorisée si garde-fous contournés.

### 2. Problèmes connus
- Héritage legacy encore présent.
- Complexité de cohabitation routes modernes et historiques.
- Sensibilité forte à la robustesse runtime.

### 3. Corrections nécessaires
- Maintenir l’authentification stricte sur mutations.
- Consolider les routes legacy critiques.
- Renforcer surveillance des erreurs et refus attendus.

### 4. Refactors recommandés
- Poursuivre la séparation des responsabilités par sous-route.
- Isoler les règles d’accès et validations.
- Clarifier les contrats d’entrée/sortie.

### 5. Normalisations
- Uniformiser schémas de réponses et statuts.
- Standardiser journalisation sécurité.
- Aligner conventions entre legacy et moderne.

### 6. Tests à ajouter
- Smoke tests lecture/écriture TV.
- Cas sans jeton, jeton invalide, jeton valide.
- Non-régression sur endpoints legacy.

### 7. Dépendances
- Dépend de la couche Auth et de la configuration runtime.
- Dépendances UI sur affichage public.

### 8. Impacts
- Réduction immédiate du risque de dérive sécurité.
- Meilleure confiance en exploitation continue.

## Google Calendar

### 1. Analyse des risques
- Dépendance externe critique pour la continuité planning.
- Risques de quota, latence et incohérence de synchronisation.

### 2. Problèmes connus
- Sensibilité aux variations d’API externe.
- Gestion d’erreur utilisateur parfois insuffisante.
- Couplage opérationnel élevé avec planning.

### 3. Corrections nécessaires
- Renforcer gestion des erreurs et reprises.
- Clarifier états de synchronisation visibles.
- Sécuriser les scénarios de défaillance externe.

### 4. Refactors recommandés
- Isoler la couche d’intégration externe.
- Centraliser mapping des erreurs et statuts.
- Réduire le couplage direct dans les vues métier.

### 5. Normalisations
- Uniformiser messages de sync et niveaux d’alerte.
- Standardiser journaux techniques de synchronisation.
- Aligner les conventions de reprise manuelle.

### 6. Tests à ajouter
- Smoke tests de synchronisation nominale.
- Cas de panne externe et reprise.
- Tests de cohérence planning après synchronisation.

### 7. Dépendances
- Dépend fortement de Planning.
- Dépendances d’authentification service externe.

### 8. Impacts
- Amélioration de la fiabilité de planification.
- Réduction des incidents liés à l’intégration externe.