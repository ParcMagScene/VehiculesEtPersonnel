# 🚛 eM@g — Gestion de Flotte & Personnel

Application web de **gestion de flotte de véhicules et de planning du personnel** pour Mag Scène (entreprise de prestations événementielles à La Réunion).

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
- **Alertes** : Interventions en retard

### 👷 Personnel
- **Personnes** : Recherche, filtres par type, compétences avec niveaux
- **Compétences** : 8 catégories (Son, Lumière, Vidéo, Régie, Transport, Structure, Électricité, Autre)
- **Missions** : 6 statuts, gestion des affectations avec détection de conflits
- **Planning** : Grille semaine, personnes en lignes, jours en colonnes

### 📎 Affaires
- **Dossiers projets** : Création, recherche, filtres
- **Pièces jointes** : Upload multi-format (PDF, images, documents) jusqu'à 50 MB
- **Import** : BL (PDF), fichiers Excel

### 💬 Messagerie
- **Conversations** : Temps réel entre utilisateurs
- **Notifications** : Badge de nouveaux messages

### 📱 Mobile
- **Interface dédiée** : Planning, réservations, maintenances, personnel, messagerie
- **QR Code** : Accès rapide par véhicule
- **Tableau de bord** : Vue synthétique du parc

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
cd "Resevation Véhicules"

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
# Terminal 1 — Backend
cd server && npm start

# Terminal 2 — Frontend
npm run dev
```

- **Frontend** : http://localhost:5174
- **Backend API** : http://localhost:3002

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
Resevation Véhicules/
├── index.html              # Point d'entrée HTML (SPA)
├── package.json            # Dépendances frontend
├── vite.config.js          # Configuration Vite (proxy /api → :3002)
├── src/
│   ├── main.jsx            # Point d'entrée React
│   ├── App.jsx             # Composant racine (~1248 lignes)
│   ├── App.css             # Styles globaux
│   ├── theme.css           # Variables de thème
│   ├── components/         # 43 composants React desktop
│   │   └── mobile/         # 10 composants mobile
│   ├── hooks/              # 4 hooks custom
│   └── utils/              # 12 utilitaires (API client, dates, import, etc.)
├── server/
│   ├── server.js           # Express (~2545 lignes, 65 routes)
│   ├── routes.js           # Routes secondaires (~641 lignes, 30 routes)
│   ├── personnelRoutes.js  # Routes personnel (~928 lignes, 27 routes)
│   ├── database.js         # SQLite 27 tables (~966 lignes)
│   └── migrations/         # 9 fichiers SQL
├── public/
│   ├── Photos/             # Photos des véhicules
│   ├── Logos/              # Logos de l'application
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
- **Backend** : http://localhost:3002

---

## 📖 Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Architecture technique complète (schéma DB, routes API, composants)
- [SECURITY.md](SECURITY.md) — Politique de sécurité et vulnérabilités connues
- [GUIDE_DEMARRAGE_RAPIDE.md](GUIDE_DEMARRAGE_RAPIDE.md) — Guide utilisateur

---

## 📝 Commandes disponibles

```bash
npm run dev        # Serveur de développement (Vite)
npm run build      # Build de production
npm run preview    # Prévisualiser le build
npm run deploy     # Build + déploiement PM2
npm run lint       # Vérification du code (ESLint)
```

---

**Développé pour Mag Scène — La Réunion**
