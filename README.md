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
- **Planning des tâches** : Planning jour/semaine, tâches récurrentes, PDF export, édition de tâches individuelles avec sélecteur d'affaire
- **Import BL en lot** : Import multi-fichiers de bons de livraison

### 📺 Dashboard TV (Affichage dynamique)
- **21 composants** : Gestion complète d'écrans d'affichage dynamique
- **Écrans & Playlists** : Configuration d'écrans, playlists de contenu, médias, messages, templates
- **Apparence** : Règles de couleurs dynamiques, icônes de localisation, messages de bienvenue
- **Sonos** : Contrôle Sonos intégré (now playing)
- **Alarme SNCF** : Alarme sonore à l'échéance des tâches + bouton test admin
- **Sneaky** : Affichage furtif de GIFs
- **Prévisualisation** : Aperçu temps réel des écrans TV, sidebar tâches avec nettoyage automatique des titres
- **Client TV** : Client web dédié pour écrans d'affichage

### 👤 Mon Espace
- **Espace personnel** : Tableau de bord personnel de l'utilisateur connecté

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
│   ├── App.jsx             # Composant racine (~901 lignes)
│   ├── contexts/           # AuthContext (auth state, login/logout)
│   ├── components/         # 131 composants React organisés par domaine
│   │   ├── vehicles/       # (21) Calendar, VehicleDetailsModal…
│   │   ├── affaires/       # (8) AffairesPanel, BLImportModal…
│   │   ├── personnel/      # (9) PersonnelPanel, PersonnelAgenda…
│   │   ├── planning/       # (9) PlanningPanel, TaskPlanningPanel…
│   │   ├── management/     # (5) ManagementPanel, DashboardPanel…
│   │   ├── equipment/      # (5) EquipmentPanel…
│   │   ├── orders/         # (3) OrdersPanel, CataloguePanel, StockPanel
│   │   ├── auth/           # (6) LoginForm, ChangePassword…
│   │   ├── DisplayDashboard/ # (21) Module affichage dynamique
│   │   ├── mobile/         # (16) Interface mobile complète
│   │   ├── ui/             # (6) Composants réutilisables
│   │   └── ...             # messaging, mailing, annuaire, leaves…
│   ├── hooks/              # 10 hooks custom (useAppData, useGoogleCalendar…)
│   └── utils/
│       ├── api/            # Client API modulaire (15 modules, ~375 méthodes)
│       └── ...             # dates, indexedDB, pdfParser, deepLinking
├── server/
│   ├── server.js           # Point d'entrée Express (~317 lignes)
│   ├── database.js         # SQLite 92 tables + 15 index perf (~2855 lignes)
│   ├── config/             # Helmet, CORS, rate limiters
│   ├── middleware/          # Auth JWT, authorize, sanitize, upload, errorHandler
│   ├── 18 fichiers routes  # ~19 593 lignes de routes API
│   ├── cache.js            # Cache LRU/TTL (5 instances)
│   ├── emailService.js     # Service d'envoi d'emails
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

- [📚 Index docs/](docs/README.md) — Index complet de la documentation
- [Architecture](docs/01-Architecture/ARCHITECTURE.md) — Architecture technique complète
- [Sécurité](docs/02-Securite/SECURITY.md) — Politique de sécurité et vulnérabilités connues
- [Guide utilisateur](docs/03-Guides/GUIDE_UTILISATEUR.md) — Guide de démarrage rapide
- [Guide développeur](docs/03-Guides/GUIDE_DEVELOPPEUR.md) — Installation, configuration, déploiement
- [Audit technique](docs/02-Securite/AUDIT.md) — Audit unifié (Juillet 2025 + Mars 2026)

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
