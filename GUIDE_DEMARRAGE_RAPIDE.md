# 🚀 Guide de Démarrage Rapide - Système de Réservation de Véhicules

## 📋 Table des Matières
1. [Premiers Pas](#premiers-pas)
2. [Interface Desktop](#interface-desktop)
3. [Interface Mobile](#interface-mobile)
4. [Rôles Utilisateurs](#rôles-utilisateurs)
5. [Dépannage](#dépannage)

---

## 🎯 Premiers Pas

### 1. Demande d'Accès

Si vous n'avez pas encore de compte :

1. **Accédez à l'application** via l'URL fournie par votre administrateur
2. **Cliquez sur "Demander un accès"** en bas du formulaire de connexion
3. **Remplissez le formulaire** :
   - Nom complet
   - Adresse email professionnelle
   - Raison de la demande
4. **Validez** et attendez l'approbation d'un administrateur

> ⏱️ **Délai** : Les demandes sont généralement traitées sous 24h ouvrées

### 2. Première Connexion

Une fois votre compte approuvé :

1. **Ouvrez l'email de confirmation** reçu
2. **Connectez-vous** avec votre adresse email
3. **Créez votre mot de passe** lors de la première connexion
4. **Acceptez les conditions d'utilisation**

---

## 💻 Interface Desktop

### Vue Calendrier

#### Navigation
- **Boutons en haut** : Changez entre vues Semaine / Mois / Année
- **Sélecteur de période** : Cliquez pour choisir une date précise
- **Flèches ← →** : Naviguez entre les périodes

#### Créer une Réservation

1. **Cliquez sur une cellule vide** dans le calendrier
2. **Remplissez le formulaire** :
   - **Véhicule** : Sélectionnez dans la liste (avec photo)
   - **Dates** : Début et fin de réservation
   - **Affaire** : Numéro de projet/chantier
   - **Conducteur** : Nom du conducteur
   - **Notes** : Informations complémentaires (optionnel)
3. **Validez** avec le bouton "Créer"

#### Modifier une Réservation

1. **Cliquez sur une réservation existante** (cellule colorée)
2. **Modifiez les informations** nécessaires
3. **Sauvegardez** ou **Supprimez** si besoin

#### Maintenance des Véhicules

1. **Cliquez sur un véhicule** dans la liste de gauche
2. **Sélectionnez "Maintenance"** dans la fiche détaillée
3. **Enregistrez** :
   - Type de maintenance (révision, réparation, contrôle technique)
   - Dates de début et fin
   - Description des travaux
   - Coût (optionnel)

### Vue Planning

Affichage alternatif montrant :
- **Toutes les réservations** par véhicule
- **Disponibilités** en temps réel
- **Conflits potentiels** (chevauchements)

---

## 📱 Interface Mobile

### Accès via QR Code

#### Première Configuration

1. **Scannez le QR code** apposé sur le véhicule
2. **Autorisez l'accès caméra** de votre smartphone
3. **Connectez-vous** avec vos identifiants
4. **Le véhicule est automatiquement sélectionné**

> 💡 **Astuce** : Ajoutez l'application à votre écran d'accueil pour un accès rapide

#### Fonctions Disponibles

##### 📅 Consulter les Réservations
- Voir les réservations **actuelles et futures** du véhicule
- Filtrer par date
- Voir les détails (conducteur, affaire, durée)

##### ➕ Créer une Réservation Rapide
1. **Dates automatiques** : aujourd'hui ou période suggérée
2. **Véhicule présélectionné** depuis le QR code
3. **Renseignez** : Affaire + Conducteur
4. **Validez** en 2 clics

##### 🔧 Signaler un Problème
1. **Bouton "Signaler"** sur la fiche véhicule
2. **Type de problème** : Panne, dommage, entretien nécessaire
3. **Photo** : Prenez une photo du problème (optionnel)
4. **Description** : Expliquez brièvement
5. **Envoi** : L'administrateur est notifié instantanément

##### 📊 Voir l'Historique
- **Toutes les réservations passées** du véhicule
- **Historique de maintenance**
- **Kilométrage** et statistiques d'utilisation

### Mode Hors Ligne

L'application fonctionne en mode déconnecté :
- ✅ Consultation des données récentes
- ✅ Création de réservations (synchronisées plus tard)
- ❌ Modifications en temps réel impossibles

---

## 👥 Rôles Utilisateurs

### 👤 Utilisateur Standard

**Permissions** :
- ✅ Consulter le calendrier
- ✅ Créer ses propres réservations
- ✅ Modifier/supprimer ses réservations
- ✅ Voir les détails des véhicules
- ✅ Signaler des problèmes
- ❌ Gérer les utilisateurs
- ❌ Modifier les réservations des autres
- ❌ Supprimer des véhicules

### 🔑 Administrateur

**Permissions supplémentaires** :
- ✅ **Gérer tous les utilisateurs** :
  - Approuver/rejeter les demandes d'accès
  - Attribuer les droits administrateur
  - Réinitialiser les mots de passe
  - Désactiver des comptes
- ✅ **Gérer toutes les réservations** :
  - Modifier n'importe quelle réservation
  - Supprimer des réservations
  - Résoudre les conflits
- ✅ **Gérer les véhicules** :
  - Ajouter/supprimer des véhicules
  - Mettre à jour les informations
  - Gérer la maintenance
- ✅ **Notification badge** : Voir les demandes d'accès en attente

### Passage Administrateur

Un administrateur peut **attribuer des droits** lors de l'approbation d'une demande :
1. Notification sur le bouton **"Gestion"** (pastille rouge)
2. Clic sur **"Approuver"**
3. Répondre **"oui"** ou **"non"** à la question des droits admin

---

## 🔧 Dépannage

### Problèmes de Connexion

#### "Email ou mot de passe incorrect"
- ✅ Vérifiez la casse (majuscules/minuscules)
- ✅ Utilisez l'email professionnel exact
- ✅ Demandez une réinitialisation de mot de passe

#### "Failed to fetch"
- ✅ Vérifiez votre connexion Internet
- ✅ Actualisez la page (F5 ou Cmd+R)
- ✅ Vider le cache du navigateur
- ✅ Contactez l'administrateur si persistant

### Problèmes de Réservation

#### "La réservation n'apparaît pas"
- ✅ Vérifiez la date sélectionnée dans le calendrier
- ✅ Actualisez la page
- ✅ Vérifiez que vous êtes sur la bonne vue (semaine/mois)

#### "Impossible de créer une réservation"
- ✅ Vérifiez que le véhicule est disponible sur la période
- ✅ Tous les champs obligatoires sont remplis ?
- ✅ Les dates sont dans le bon ordre (début < fin)

### Problèmes Mobile

#### "Le QR code ne scanne pas"
- ✅ Autorisez l'accès à la caméra dans les paramètres
- ✅ Assurez un bon éclairage
- ✅ Tenez le téléphone stable à 10-15 cm
- ✅ Nettoyez l'objectif de la caméra

#### "L'application est lente"
- ✅ Vérifiez votre connexion réseau (WiFi/4G)
- ✅ Fermez les autres applications
- ✅ Videz le cache du navigateur mobile
- ✅ Redémarrez l'application

### Synchronisation Google Calendar

#### "Événements non synchronisés"
- ✅ Vérifiez que l'authentification Google est active
- ✅ Autorisez les permissions calendrier
- ✅ Réautorisez l'accès dans Paramètres
- ✅ La synchronisation peut prendre 5-10 minutes

---

## 📞 Support

### Contacts

- **Email** : support@magscene.fr
- **Téléphone** : 01 XX XX XX XX
- **Horaires** : Lundi-Vendredi, 9h-18h

### Avant de Contacter

Ayez sous la main :
- 📧 Votre adresse email de connexion
- 🖥️ Navigateur et système d'exploitation
- 📸 Capture d'écran du problème (si possible)
- 📝 Description détaillée des étapes reproduisant le problème

---

## 🎓 Astuces & Bonnes Pratiques

### Organisation

1. **Planifiez à l'avance** : Réservez vos véhicules dès que possible
2. **Libérez rapidement** : Supprimez les réservations inutilisées
3. **Soyez précis** : Renseignez toujours l'affaire et le conducteur
4. **Notes utiles** : Ajoutez des infos pour vos collègues (lieu, équipement spécial)

### Mobile

1. **Ajoutez à l'écran d'accueil** : Accès direct sans navigateur
2. **Scannez avant utilisation** : Vérifiez la disponibilité in situ
3. **Signalez immédiatement** : Tout problème technique détecté
4. **Photos** : Documentez l'état du véhicule avant/après

### Sécurité

1. **Mot de passe fort** : Min. 8 caractères, lettres + chiffres
2. **Déconnexion** : Sur ordinateurs partagés
3. **Confidentialité** : Ne partagez pas vos identifiants
4. **Mises à jour** : Acceptez les notifications de nouvelle version

---

## 🆕 Nouveautés Récentes

### Version Actuelle

✨ **Gestion complète des demandes d'accès** :
- Badge de notification pour les administrateurs
- Choix des droits administrateur lors de l'approbation
- Statut automatiquement activé après approbation

🎨 **Améliorations visuelles** :
- Logo MagScene dans les QR codes
- Colonne "Droits" plus claire
- Meilleure ergonomie mobile

🔧 **Corrections** :
- Résolution des erreurs de connexion
- Amélioration de la stabilité
- Correction des bugs de synchronisation

---

## 📄 Licence & Mentions

© 2024 MagScene - Tous droits réservés

Ce guide est destiné à un usage interne uniquement.
Toute reproduction ou distribution externe est interdite sans autorisation.

**Version** : 1.0  
**Dernière mise à jour** : Février 2024
