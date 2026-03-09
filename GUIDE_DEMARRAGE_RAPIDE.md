# 🚀 Guide de Démarrage Rapide — eM@g

## 📋 Table des Matières

1. [Premiers Pas](#premiers-pas)
2. [Interface Desktop](#interface-desktop)
3. [Interface Mobile](#interface-mobile)
4. [Rôles & Permissions](#rôles--permissions)
5. [Modules](#modules)
6. [Dépannage](#dépannage)
7. [Astuces](#astuces)

---

## 🎯 Premiers Pas

### 1. Demande d'Accès

1. Accédez à l'application via l'URL fournie par votre administrateur
2. Cliquez sur **"Demander un accès"** en bas du formulaire de connexion
3. Remplissez : nom complet, email professionnel, raison
4. Attendez l'approbation admin (généralement < 24 h ouvrées)

### 2. Première Connexion

1. Connectez-vous avec votre email
2. Créez votre mot de passe
3. Vous accédez au calendrier principal

---

## 💻 Interface Desktop

### Vue Calendrier

- **Vues** : Semaine / Mois / Année / Planning (boutons en haut)
- **Navigation** : Flèches ← → ou clic sur le sélecteur de période
- **Créer une réservation** : Clic sur cellule vide → formulaire (véhicule, dates, affaire, conducteur)
- **Modifier** : Clic sur réservation existante → édition ou suppression

### Barre de navigation (Header)

| Bouton | Fonction |
|--------|----------|
| **Nouvelle réservation** | Créer une réservation véhicule |
| **Nouvelle affectation** | Affecter du personnel à une mission |
| **Nouvelle affaire** | Créer un dossier projet |
| **Aide** | Documentation contextuelle |
| **Gestion** | Panel d'administration (multi-onglets) |
| **Module** | Menu déroulant pour accéder aux modules |

### Modules accessibles

| Module | Icône | Description |
|--------|-------|-------------|
| Véhicules | 🚗 | Calendrier & planning véhicules |
| Personnel | 👷 | Personnes, compétences, missions, planning |
| Affaires | 📎 | Dossiers projets, BL, pièces jointes |
| Catalogue | 📦 | Équipements catalogue (familles, catégories) |
| Équipements | 🏷️ | Matériel individualisé (UID, SAV, localisation) |
| Camions | 🚛 | Modèles de camions (chargement 3D) |
| Communication | 📢 | Événements d'entreprise, notes internes, planning tâches |
| Mailing | ✉️ | Templates, envoi groupé, historique campagnes |
| Messagerie | 💬 | Conversations temps réel entre utilisateurs |
| Annuaire | 📒 | Clients, fournisseurs, prestataires, contacts |
| Dashboard Écrans | 📺 | Affichage dynamique : écrans, playlists, médias |
| Congés | 🏖️ | Demandes, approbation, solde, planning intégré |
| Stock | 📊 | Mouvements de stock, inventaire |
| Commandes | 🛒 | Commandes fournisseurs |

---

## 📱 Interface Mobile

### Accès

- URL : `/mobile` ou scan du **QR code** sur le véhicule
- PWA : ajoutez à l'écran d'accueil pour un accès direct

### Fonctions disponibles

| Fonction | Description |
|----------|-------------|
| **Planning** | Réservations actuelles et futures |
| **Réservation rapide** | Véhicule présélectionné (QR), 2 clics |
| **Signaler un problème** | Panne, dommage + photo optionnelle |
| **Historique** | Réservations passées + maintenances |
| **Personnel** | Personnes et disponibilités |
| **Messagerie** | Conversations temps réel |
| **Tableau de bord** | Vue globale du parc |

### Mode Hors Ligne

- ✅ Consultation des données récentes (cache)
- ✅ Création de réservations (synchronisées au retour réseau)
- ❌ Modifications temps réel

---

## 👥 Rôles & Permissions

### 👤 Utilisateur Standard

- ✅ Consulter calendrier, réservations, véhicules (lecture seule)
- ✅ Accéder mobile, messagerie
- ✅ Signaler des pannes (status `reported`)
- ❌ Créer/modifier réservations
- ❌ Gérer véhicules, utilisateurs, catalogue

### 🔑 Administrateur (`is_admin`)

Accès complet : réservations, véhicules, maintenances, utilisateurs, imports, configuration.

### 🏷️ Permissions spécifiques

| Permission | Portée |
|------------|--------|
| `can_manage_catalog` | CRUD catalogue équipements + flight-cases |
| `can_manage_trucks` | CRUD modèles de camions |

> Les admins ont automatiquement toutes les permissions.

### Passage Administrateur

Un admin peut attribuer les droits lors de l'approbation d'une demande d'accès :
1. Notification sur le bouton **"Gestion"** (pastille rouge)
2. **"Approuver"** → répondre « oui » ou « non » à la question des droits admin

---

## 📦 Modules

### Calendrier & Réservations
- 4 vues (semaine, mois, année, planning)
- Codage couleur par véhicule
- Détection des chevauchements
- Intégration Google Calendar (lecture + création depuis événements Google)

### Maintenance
- Types : entretien programmé, réparation, contrôle technique, signalement panne
- Statuts : `reported` → `scheduled` → `in_progress` → `completed`
- Transition automatique selon les dates

### Personnel & Congés
- Gestion personnes, compétences (8 catégories), missions
- Détection automatique conflits d'affectation
- Planning visuel (grille semaine)
- Demandes de congés avec workflow d'approbation et solde

### Affaires
- Dossiers projets avec pièces jointes (50 MB max)
- Import BL par PDF (standard + fournisseur/prestataire)
- Import Excel, historique, liens vers réservations

### Catalogue & Équipements
- Catalogue par familles / sous-familles / catégories
- Équipements individualisés avec UID unique et n° de série
- **Localisation multi-dépôt** : 2 dépôts avec plan interactif SVG
- Sélecteur 4 niveaux : Dépôt → Étage → Zone → Code
- Tickets SAV (suivi pannes matériel)
- Listes d'équipements nommées

### Communication & Mailing
- Événements d'entreprise (calendrier, affichage écran déporté)
- Notes internes
- **Planning des tâches** : Vue jour/semaine, 9 sections, édition individuelle, export PDF
- Mailing avancé : templates, envoi groupé, historique

### Annuaire
- Répertoire unifié : clients, fournisseurs, prestataires
- Contacts multiples par entité
- Recherche globale sur tous les types
- Import CSV/Excel de contacts

### Dashboard Écrans
- Gestion multi-écrans d'affichage dynamique
- Playlists de contenu, médias, messages
- Templates de mise en page, messages de bienvenue
- Logs d'activité

### Stock & Commandes
- Mouvements entrées/sorties, inventaire
- Commandes fournisseurs, lignes de commande, suivi réception

### Messagerie
- Conversations temps réel entre utilisateurs
- Disponible desktop et mobile

---

## 🔧 Dépannage

### Connexion

| Problème | Solution |
|----------|----------|
| « Email ou mot de passe incorrect » | Vérifiez la casse et l'email exact. Demandez un reset. |
| « Failed to fetch » | Vérifiez la connexion, rafraîchissez (F5/Cmd+R), videz le cache. |

### Réservations

| Problème | Solution |
|----------|----------|
| N'apparaît pas | Vérifiez la date / vue sélectionnée, rafraîchissez. |
| Impossible de créer | Vérifiez disponibilité du véhicule et champs obligatoires. |

### Mobile

| Problème | Solution |
|----------|----------|
| QR code ne scanne pas | Autorisez la caméra, assurez un bon éclairage, tenez à 10-15 cm. |
| Application lente | Vérifiez le réseau, videz le cache, redémarrez l'app. |

### Google Calendar

| Problème | Solution |
|----------|----------|
| Événements non synchronisés | Vérifiez l'auth Google, réautorisez dans Paramètres. Délai : 5-10 min. |

---

## 🎓 Astuces

### Organisation
- **Planifiez à l'avance** — réservez dès confirmation du chantier
- **Libérez vite** — supprimez les réservations annulées
- **Soyez précis** — renseignez toujours affaire + conducteur
- **Notes utiles** — lieu, équipement spécial, contact client

### Mobile
- **Écran d'accueil** — ajoutez la PWA pour accès direct
- **Scannez avant** — vérifiez la disponibilité in situ
- **Signalez immédiatement** — photo + description brève

### Sécurité
- Mot de passe fort (&ge; 8 caractères, lettres + chiffres)
- Déconnectez-vous sur les postes partagés
- Ne partagez jamais vos identifiants

---

## 📄 Autres Documentations

| Fichier | Contenu |
|---------|---------|
| `ARCHITECTURE.md` | Architecture technique complète, API, schéma DB, modules |
| `SECURITY.md` | Politique de sécurité, vulnérabilités, audit |
| `README.md` | Vue d'ensemble, installation, stack |

---

**Version :** 4.1
**Dernière mise à jour :** 9 mars 2026
© MagScene — Usage interne uniquement
