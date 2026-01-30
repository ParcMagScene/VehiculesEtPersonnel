# 🚀 Guide de Démarrage Rapide - Système de Réservation de Véhicules

## 📱 Table des Matières
- [Accès aux Applications](#accès-aux-applications)
- [Application Web](#application-web)
- [Application Mobile](#application-mobile)
- [Fonctionnalités Principales](#fonctionnalités-principales)
- [Gestion Administrative](#gestion-administrative)
- [Support et Assistance](#support-et-assistance)

---

## 🔐 Accès aux Applications

### Première Connexion

#### Option 1 : Demande d'Accès (Nouveaux Utilisateurs)

1. **Accéder à l'interface de connexion**
   - Web : `https://votre-domaine.com`
   - Mobile : Scanner le QR code ou accéder à `https://votre-domaine.com/#/mobile`

2. **Faire une demande d'accès**
   - Cliquez sur **"Pas encore d'accès ? Faire une demande"**
   - Remplissez le formulaire :
     - **Nom complet** : Votre nom et prénom
     - **Email professionnel** : Votre adresse email
   - Cliquez sur **"Envoyer la demande"**

3. **Attendre l'approbation**
   - Un administrateur recevra votre demande
   - Vous recevrez une notification une fois approuvé
   - Délai habituel : 24h ouvrées

#### Option 2 : Connexion avec Compte Existant

1. **Saisir vos identifiants**
   - **Email** : Votre adresse email autorisée
   - **Mot de passe** : Votre mot de passe (si compte créé)

2. **Première connexion avec email autorisé**
   - Si vous n'avez pas encore de compte mais que votre email est autorisé :
   - Cliquez sur **"Créer un compte"**
   - Remplissez :
     - **Nom complet**
     - **Mot de passe** (minimum 6 caractères)
     - **Confirmation du mot de passe**

---

## 💻 Application Web

### Interface Principale

#### 1. Navigation et Vues

**Sélecteur de Vue** (en haut à gauche)
- **📅 Semaine** : Vue hebdomadaire détaillée
- **📆 Mois** : Vue mensuelle complète
- **📊 Année** : Vue annuelle (planning global)

**Navigation Temporelle**
- Flèches **◀ ▶** : Naviguer entre les périodes
- **Date centrale** (cliquable) : Sélecteur rapide de période
- **Bouton "Aujourd'hui"** : Retour à la date actuelle (en bleu si période différente)

#### 2. Gestion des Véhicules

**Affichage**
- Chaque véhicule a une **couleur unique** pour faciliter l'identification
- **Immatriculation** et **modèle** affichés
- **Statut visuel** : disponible, réservé, en maintenance

**Interaction**
- Cliquez sur un véhicule pour voir ses **détails complets**
- Icône **🔧** : Maintenance en cours ou programmée
- Icône **⚠️** : Panne signalée

#### 3. Créer une Réservation

**Méthode 1 : Clic Direct**
1. Cliquez sur une **case vide** du calendrier
2. Sélectionnez :
   - **Véhicule** (liste déroulante)
   - **Nom du réservateur**
   - **Période** : AM (matin) / PM (après-midi) / Journée complète
   - **Date de fin** (optionnel pour réservations multi-jours)
   - **Remarques** (optionnel)
3. Cliquez **"Ajouter la réservation"**

**Méthode 2 : Bouton Gestion**
1. Cliquez sur **"⚙️ Gestion"** (en haut à droite)
2. Onglet **"Réservations"**
3. Cliquez **"+ Nouvelle Réservation"**
4. Remplissez le formulaire complet
5. Validez avec **"Créer"**

#### 4. Modifier/Supprimer une Réservation

1. **Cliquez sur la réservation** dans le calendrier
2. Dans la fenêtre qui s'ouvre :
   - **Modifier** : Changez les informations et sauvegardez
   - **Supprimer** : Confirmez la suppression

#### 5. Notifications et Alertes

**Badges de Notification** (haut de page)
- 🔴 **Véhicules immobilisés** : Pannes bloquantes
- 🟠 **Pannes signalées** : Problèmes non bloquants
- 🟣 **Demandes d'intervention** : À planifier
- 🔵 **Interventions programmées** : Maintenances planifiées
- 🔴 **Conflits** : Interventions en conflit avec réservations

**Cliquez sur un badge** pour voir les détails et agir rapidement.

---

## 📱 Application Mobile

### Accès Rapide

**Deux méthodes d'accès :**

1. **Via QR Code**
   - Sur l'app web, cliquez sur **📱** (bouton QR code vert en haut)
   - Scannez avec votre smartphone
   - L'app mobile s'ouvre automatiquement

2. **URL Directe**
   - Ajoutez `/#/mobile` à l'URL : `https://votre-domaine.com/#/mobile`
   - Ajoutez à l'écran d'accueil pour un accès rapide

### Interface Mobile

#### 1. Écran de Connexion

- Identique à la version web
- Interface optimisée tactile
- Demande d'accès disponible

#### 2. Navigation Principale

**Menu Bas de Page** (5 onglets)

1. **🏠 Accueil**
   - Vue d'ensemble des véhicules
   - Statut en temps réel
   - Accès rapide aux fonctions principales

2. **📅 Planning**
   - **Vue mensuelle multi-véhicules**
   - Scroll horizontal pour naviguer dans le mois
   - **Étiquettes véhicules fixes** (restent visibles au scroll)
   - **Bouton "Aujourd'hui"** (violet) : auto-scroll vers la date actuelle
   - **Jour actuel surligné** (gradient bleu)
   - **Codes couleur** : Chaque véhicule a sa couleur unique
   - Réservations affichées en blocs continus
   - **Filtrage intelligent** : Maintenances reportées/demandées masquées

3. **🔍 Disponibilités**
   - Rechercher un véhicule par date
   - Voir les créneaux disponibles
   - Créer une réservation directement

4. **📋 Mes Réservations**
   - Liste de vos réservations
   - Filtres : À venir / Passées / Toutes
   - Modifier ou annuler rapidement

5. **🔧 Maintenances**
   - Signaler une panne
   - Demander une intervention
   - Voir l'historique

#### 3. Planning Mensuel (Détails)

**Fonctionnalités Avancées**

- **Navigation Mensuelle**
  - Flèches **◀ ▶** pour changer de mois
  - Affichage du mois en cours en haut

- **Véhicules Fixes**
  - Noms des véhicules **toujours visibles** lors du scroll horizontal
  - Centrés dans la vue pour meilleure lisibilité

- **Auto-Scroll Intelligent**
  - Au changement de mois : scroll automatique vers le jour actuel
  - Bouton **"Aujourd'hui"** : retour instantané à la date actuelle

- **Visualisation Optimisée**
  - 1 ligne par véhicule (pas de chevauchement)
  - Réservations en blocs continus sur plusieurs jours
  - Couleurs cohérentes avec l'app web
  - Maintenances pertinentes uniquement (programmées/en cours)

- **Interactions Tactiles**
  - Tap sur réservation : voir détails
  - Swipe horizontal : naviguer dans le calendrier
  - Pinch-to-zoom compatible

#### 4. Actions Rapides

**Signaler une Panne**
1. Onglet **🔧 Maintenances**
2. Bouton **"Signaler une panne"**
3. Sélectionnez :
   - Véhicule concerné
   - **Type** : Panne bloquante / Non bloquante
   - **Description** du problème
   - **Photo** (optionnel)
4. Validez

**Créer une Réservation**
1. Onglet **🔍 Disponibilités**
2. Sélectionnez la date souhaitée
3. Choisissez un véhicule disponible
4. Remplissez :
   - Période (AM/PM/Journée)
   - Nom du réservateur
   - Remarques
5. Confirmez

---

## ⚙️ Fonctionnalités Principales

### Pour Tous les Utilisateurs

#### Réservations
- ✅ Créer des réservations simples ou multi-jours
- ✅ Modifier vos réservations
- ✅ Annuler une réservation
- ✅ Voir l'historique complet
- ✅ Filtrer par véhicule, date, statut

#### Visualisation
- ✅ Planning hebdomadaire, mensuel, annuel
- ✅ Codes couleur par véhicule
- ✅ Export PDF du planning (web)
- ✅ Vue mobile optimisée avec auto-scroll

#### Maintenances
- ✅ Signaler une panne
- ✅ Demander une intervention
- ✅ Suivre l'état des maintenances
- ✅ Notifications en temps réel

### Pour les Administrateurs

#### Panneau de Gestion (🔐 Accès Restreint)

**Onglet Véhicules**
- ➕ Ajouter/Modifier/Supprimer des véhicules
- 🎨 Personnaliser les couleurs d'affichage
- 📊 Voir les statistiques d'utilisation
- 🔧 Gérer les maintenances

**Onglet Maintenances**
- 📅 Programmer des interventions
- ✅ Valider les demandes
- 🔄 Suivre l'état (En attente, En cours, Terminé)
- ⚠️ Détecter les conflits avec réservations
- 📄 Historique complet

**Onglet Réservations**
- 👀 Vue globale de toutes les réservations
- 🔍 Recherche avancée
- 📊 Statistiques d'utilisation
- 📥 Export données (CSV/Excel)

**Onglet Paramètres**
- 🎨 Configuration visuelle
- 📧 Notifications email
- 🔗 Intégration Google Calendar
- 🔐 Gestion des accès

**Gestion des Utilisateurs**
- 👥 Liste des utilisateurs actifs
- ✉️ Gestion des emails autorisés
- ✅ Approbation des demandes d'accès
- 🔒 Attribution des rôles (admin/utilisateur)
- 📊 **Badge de notification** pour les demandes en attente
- 📜 Historique des demandes approuvées/rejetées

---

## 🛠️ Gestion Administrative

### Workflow d'Approbation des Accès

#### Pour les Administrateurs

1. **Notification de Nouvelle Demande**
   - Badge **violet** sur "Demandes d'accès" dans Gestion Utilisateurs
   - Nombre de demandes en attente affiché

2. **Examiner la Demande**
   - Panneau **"Gestion"** → Onglet **"Paramètres"** → Section **"Gestion des Utilisateurs"**
   - Section **"Demandes d'accès en attente"**
   - Voir : Nom, Email, Date de demande

3. **Approuver une Demande**
   - Cliquez sur **"✓ Approuver"**
   - L'email est automatiquement ajouté aux autorisés
   - L'utilisateur peut maintenant créer son compte

4. **Rejeter une Demande**
   - Cliquez sur **"✗ Rejeter"**
   - Confirmez l'action
   - La demande passe dans l'historique

5. **Historique**
   - Tableau **"Historique des demandes"** en bas
   - Voir toutes les décisions avec dates et réviseurs

### Gestion des Emails Autorisés

1. **Ajouter Manuellement**
   - Section **"Emails autorisés"**
   - Bouton **"+ Ajouter un email"**
   - Saisissez l'adresse email
   - Validez

2. **Retirer un Accès**
   - Liste des emails autorisés
   - Cliquez sur **"🗑️ Supprimer"** à côté de l'email
   - Confirmez l'action

### Gestion des Maintenances

1. **Programmer une Intervention**
   - Panneau **"Gestion"** → **"Maintenances"**
   - **"+ Nouvelle Maintenance"**
   - Remplissez :
     - Véhicule concerné
     - Type (Révision, Réparation, Contrôle technique...)
     - Dates début/fin
     - Description
   - Le système **détecte automatiquement les conflits** avec réservations
   - Sauvegardez

2. **Gérer les Conflits**
   - Badge **rouge "Conflits"** en haut si interventions en conflit
   - Cliquez pour voir la liste
   - Options :
     - Modifier les dates d'intervention
     - Contacter le réservateur
     - Annuler la réservation si nécessaire

3. **Traiter les Pannes Signalées**
   - Badge **orange "Pannes signalées"** en haut
   - Cliquez pour voir les détails
   - Actions possibles :
     - **Programmer une intervention** : Convertir en maintenance
     - **Résoudre** : Marquer comme résolue
     - **Immobiliser** : Si panne bloquante

### Configuration Google Calendar

1. **Activer la Synchronisation**
   - Panneau **"Gestion"** → **"Paramètres"**
   - Section **"Intégration Google Calendar"**
   - Cliquez **"Configurer Google Calendar"**

2. **Authentification**
   - Connectez-vous avec votre compte Google
   - Autorisez l'accès au calendrier

3. **Paramètres de Sync**
   - Choisir le calendrier cible
   - Activer la synchronisation automatique
   - Les réservations apparaissent dans Google Calendar en temps réel

---

## 📊 Bonnes Pratiques

### Pour les Utilisateurs

✅ **Toujours vérifier la disponibilité** avant de réserver
✅ **Annuler rapidement** si vos plans changent
✅ **Signaler immédiatement** toute panne
✅ **Ajouter des remarques** pour des besoins spécifiques
✅ **Utiliser l'app mobile** pour un accès rapide sur le terrain

### Pour les Administrateurs

✅ **Traiter les demandes d'accès** sous 24h
✅ **Vérifier régulièrement** les badges de notification
✅ **Planifier les maintenances** en évitant les périodes chargées
✅ **Communiquer** les interventions programmées en avance
✅ **Exporter régulièrement** les données pour archivage
✅ **Réviser les accès** trimestriellement

---

## 🆘 Support et Assistance

### Questions Fréquentes

**Q : J'ai oublié mon mot de passe**
R : Contactez un administrateur pour réinitialiser votre accès.

**Q : Mon email n'est pas autorisé**
R : Faites une demande d'accès via le bouton "Pas encore d'accès ?". Un admin vous approuvera sous 24h.

**Q : La réservation que je veux faire est grisée**
R : Le créneau est déjà réservé ou le véhicule est en maintenance. Choisissez un autre créneau ou véhicule.

**Q : Je ne vois pas mon planning mobile mis à jour**
R : Rafraîchissez la page (pull-to-refresh) ou reconnectez-vous.

**Q : Comment annuler une réservation ?**
R : Cliquez sur la réservation dans le calendrier, puis "Supprimer" et confirmez.

**Q : Le scroll horizontal ne fonctionne pas bien sur mobile**
R : Utilisez le bouton "Aujourd'hui" (violet) pour centrer automatiquement sur le jour actuel, puis scrollez normalement.

**Q : Les étiquettes véhicules défilent lors du scroll**
R : Ce ne devrait pas être le cas - elles sont fixes. Si ça arrive, rafraîchissez l'app mobile.

### Problèmes Techniques

**Problème de connexion ?**
1. Vérifiez votre connexion Internet
2. Videz le cache du navigateur
3. Essayez un autre navigateur
4. Contactez l'administrateur système

**Données non synchronisées ?**
1. Rafraîchissez la page (F5 ou pull-to-refresh)
2. Déconnectez-vous et reconnectez-vous
3. Vérifiez que vous êtes sur la dernière version

### Contact Support

📧 **Email** : support@votre-entreprise.com
📞 **Téléphone** : +XX XX XX XX XX
💬 **Chat** : Disponible dans l'app (icône en bas à droite)

---

## 🚀 Démarrage Rapide en 3 Étapes

### Pour Nouveaux Utilisateurs

1. **📝 Demandez l'accès**
   - Cliquez "Pas encore d'accès ? Faire une demande"
   - Remplissez nom et email
   - Attendez l'approbation (24h)

2. **🔐 Créez votre compte**
   - Une fois approuvé, cliquez "Créer un compte"
   - Choisissez un mot de passe
   - Connectez-vous

3. **🎉 Réservez votre premier véhicule**
   - Naviguez dans le planning
   - Cliquez sur un créneau disponible
   - Remplissez le formulaire
   - Validez !

### Pour Utilisateurs Existants

1. **🔑 Connectez-vous**
   - Email + Mot de passe

2. **📅 Consultez le planning**
   - Vue Semaine/Mois/Année

3. **✅ Gérez vos réservations**
   - Créez, modifiez, annulez

---

## 📱 Raccourcis Utiles

### Application Web
- **Ctrl + R** : Rafraîchir
- **Esc** : Fermer les fenêtres modales
- **←/→** : Navigation entre périodes (si focus sur navigation)

### Application Mobile
- **Pull-to-refresh** : Actualiser les données
- **Swipe** : Navigation dans le calendrier
- **Tap long** : Menu contextuel (si disponible)
- **Bouton "Aujourd'hui"** : Centrage auto sur jour actuel

---

## 🔄 Mises à Jour et Nouveautés

### Dernières Fonctionnalités

✨ **Nouveau : Planning mobile multi-véhicules** (Jan 2026)
- Vue mensuelle avec tous les véhicules
- Auto-scroll vers le jour actuel
- Étiquettes véhicules fixes lors du scroll
- Codes couleur identiques à l'app web

✨ **Nouveau : Système de demandes d'accès** (Jan 2026)
- Workflow d'approbation complet
- Notifications pour admins
- Historique des demandes

✨ **Améliorations : Interface responsive** (Jan 2026)
- Header adaptatif sur tous les écrans
- Optimisation mobile complète
- Meilleure expérience utilisateur

---

**Version du guide** : 1.0
**Dernière mise à jour** : 30 janvier 2026

💡 **Astuce** : Ajoutez cette page à vos favoris pour un accès rapide !
