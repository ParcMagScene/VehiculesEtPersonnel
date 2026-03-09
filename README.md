# 🚛 eM@g — Gestion de Flotte, Personnel & Équipements

Application web de **gestion de flotte de véhicules, de planning du personnel et de catalogue d'équipements** pour Mag Scène (entreprise de prestations événementielles à La Réunion).

## ✨ Fonctionnalités

### 📅 Calendrier & Réservations
- **Vues multiples** : Semaine, Mois, Année, Planning
- **Réservation par clic** : Cliquez sur une période pour créer une réservation
- **Gestion par demi-journée** : Matin (AM) et Après-midi (PM)
- **Détection de conflits** : Alertes automatiques de chevauchement
- **Demandes de réservation** : Workflow non-admin (demande → approbation)
- **Synchronisation Google Calendar** : Lecture des événements, création de réservations depuis Google
- **Planification de trajets** : Détails aller/retour, pauses, jonctions

### 🚗 Gestion des véhicules
- **CRUD complet** : Ajout, modification, suppression avec photos et couleurs personnalisées
- **Kilométrage** : Suivi et historique
- **Contrôles techniques** : Programmation et alertes

### 🔧 Maintenance
- **Types** : Entretien programmé, réparation, contrôle technique, révision, signalement de panne
- **Workflow** : `reported` → `scheduled` → `in_progress` → `completed`
- **Signalement rapide** : Même pour les utilisateurs non-admin

### 👷 Personnel & Congés
- **Personnes** : Recherche, filtres par type, compétences avec niveaux
- **Compétences** : 8 catégories (Son, Lumière, Vidéo, Régie, Transport, Structure, Électricité, Autre)
- **Missions** : 6 statuts, gestion des affectations avec détection de conflits
- **Planning** : Grille semaine, personnes en lignes, jours en colonnes
- **Congés** : Demandes, approbation, solde, planning intégré

### 📎 Affaires
- **Dossiers projets** : Création, recherche, filtres
- **Pièces jointes** : Upload multi-format (PDF, images, documents) jusqu'à 50 MB
- **Import** : BL (PDF), fichiers Excel, BL fournisseur/prestataire

### 📦 Catalogue & Équipements
- **Catalogue d'équipements** : Matériel, câbles, armoires… avec familles et catégories
- **Matériel individualisé** : UID unique, numéro de série, état, SAV
- **Localisation multi-dépôt** : 2 dépôts (Événementiel / Structure) avec plans interactifs SVG
- **Zones par étage** : RDC, Mezzanine, Extérieur — sélection en cascade (Dépôt → Étage → Zone → Code)
- **Flight-cases** : Modèles de conteneurs réutilisables
- **Modèles de camions** : Dimensions cargo, hayons, chargement 3D
- **Deep linking** : Intégration bidirectionnelle avec application Chargement 3D

### 📊 Stock & Commandes
- **Suivi de stock** : Mouvements entrées/sorties, inventaire
- **Commandes fournisseurs** : Création, suivi, réception
- **Bons de commande** : Génération et gestion

### 📢 Communication & Mailing
- **Événements** : Agenda d'entreprise, affichage écran (toggle visibilité)
- **Notes internes** : Partage d'informations
- **Mailing** : Templates, envoi groupé, historique
- **Dashboard Écrans** : Gestion d'écrans d'affichage dynamique (playlists, médias, messages, templates, logs)
- **Planning des tâches** : Planning jour/semaine, PDF export, édition de tâches individuelles

### 📒 Annuaire
- **Clients** : Gestion complète avec contacts multiples, validation SIRET/TVA, normalisation téléphone
- **Fournisseurs** : Répertoire fournisseurs avec spécialités, code NAF
- **Prestataires** : Gestion des prestataires freelance, formes juridiques
- **Contacts** : Contacts multi-entité avec catégories (Direction, Commercial, Technique…)
- **Référentiels** : 4 tables lookup éditables (structures légales, types de prestation, secteurs, catégories contacts)
- **Recherche unifiée** : Recherche globale cross-entité
- **Import** : Import CSV avec UPSERT et normalisation automatique

### 💬 Messagerie
- **Conversations** : Temps réel entre utilisateurs
- **Notifications** : Badge de nouveaux messages

### 📱 Mobile
- **Interface dédiée** : Planning, réservations, maintenances, personnel, messagerie
- **QR Code** : Accès rapide par véhicule
- **Tableau de bord** : Vue synthétique du parc
- **PWA** : Installation possible en mode hors ligne

### 👥 Utilisateurs
- **Inscription par invitation** : Emails pré-autorisés
- **Rôles** : Admin (gestion complète) / Utilisateur (lecture + demandes + signalements)
- **Profil** : Avatar, préférences (thème, module par défaut)

---

## 🛠️ Stack technique

| Couche | Technologie | Version |
|--------|------------|---------|
| **Frontend** | React | 18.3 |
| **Bundler** | Vite | 5.4 |
| **Backend** | Express.js | 4.18 |
| **Base de données** | SQLite | via better-sqlite3 |
| **Authentification** | JWT | jsonwebtoken 9.0 |
| **Process manager** | PM2 | — |

---

## 🚀 Installation

### Prérequis

- Node.js (version 18 ou supérieure)
- npm

### Installation

```bash
# Cloner le dépôt
git clone https://github.com/ParcMagScene/VehiculesEtPersonnel.git
cd "eM@g"

# Installer les dépendances frontend
npm install

# Installer les dépendances backend
cd server && npm install && cd ..
```

### Configuration

```bash
# Créer le fichier d'environnement backend
cp server/.env.example server/.env
# Éditer server/.env avec votre JWT_SECRET
```

### Lancement en développement

```bash
# Terminal 1 — Backend (port 3003)
cd server && npm start

# Terminal 2 — Frontend (port 5174)
npm run dev
```

- **Frontend** : http://localhost:5174
- **Backend API** : http://localhost:3003

### Déploiement production

```bash
npm run deploy
```

Le script `scripts/safe-deploy.sh` effectue :
1. Backup du build actuel
2. Build production (`vite build`)
3. Rollback automatique si échec
4. Redémarrage PM2 frontend + backend

---

## 🏗️ Structure du projet

```
eM@g/
├── index.html              # Point d'entrée HTML (SPA)
├── package.json            # Dépendances frontend
├── vite.config.js          # Configuration Vite (proxy /api → :3003)
├── src/
│   ├── main.jsx            # Point d'entrée React
│   ├── App.jsx             # Composant racine (~1490 lignes)
│   ├── components/         # 87 composants React desktop
│   │   ├── DisplayDashboard/ # 21 composants affichage dynamique
│   │   └── mobile/         # 16 composants mobile
│   ├── hooks/              # 7 hooks custom
│   └── utils/              # 13 utilitaires (API client ~2006 lignes, dates, import, etc.)
├── server/
│   ├── server.js           # Express (~3330 lignes)
│   ├── database.js         # SQLite 86 tables (~3198 lignes)
│   ├── 12 fichiers routes  # ~13 642 lignes de routes API
│   ├── emailService.js     # Service d'envoi d'emails (~383 lignes)
│   └── migrations/         # 17 fichiers SQL
├── public/
│   ├── depot-zones.json    # Plan dépôt 1 (Événementiel)
│   ├── depot2-zones.json   # Plan dépôt 2 (Structure)
│   ├── Photos/             # Photos des véhicules
│   └── attachments/        # Pièces jointes par affaire
└── scripts/                # Scripts de déploiement et développement
```

---

## 🌐 Accès

### Production
- **Frontend** : http://magsav.duckdns.org:4173
- **Backend** : http://magsav.duckdns.org:3002

### Développement
- **Frontend** : http://localhost:5174
- **Backend** : http://localhost:3003

---

## 📖 Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Architecture technique complète (DB, API, composants, catalogue, deep linking, dépôts)
- [SECURITY.md](SECURITY.md) — Politique de sécurité et vulnérabilités connues
- [GUIDE_DEMARRAGE_RAPIDE.md](GUIDE_DEMARRAGE_RAPIDE.md) — Guide utilisateur

---

## 📝 Commandes disponibles

```bash
npm run dev          # Serveur de développement (Vite)
npm run build        # Build de production
npm run preview      # Prévisualiser le build
npm run deploy       # Build + déploiement PM2
npm run lint         # Vérification du code (ESLint)
npm run dev:start    # Démarre backend + frontend en dev
```

---

**Développé pour Mag Scène — La Réunion**
