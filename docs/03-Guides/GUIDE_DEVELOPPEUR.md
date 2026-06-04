# 🛠️ Guide Développeur — eM@g

> Guide technique pour le développement, la configuration et le déploiement de eM@g.

---

## Table des matières

1. [Stack technique](#stack-technique)
2. [Prérequis](#prérequis)
3. [Démarrage en 5 minutes](#démarrage-en-5-minutes)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Variables d'environnement](#variables-denvironnement)
7. [Lancement en développement](#lancement-en-développement)
8. [Déploiement production](#déploiement-production)
9. [Structure du projet](#structure-du-projet)
10. [URLs d'accès](#urls-daccès)
11. [Commandes disponibles](#commandes-disponibles)
12. [Dépannage fréquent](#dépannage-fréquent)
13. [Branches & workflow Git](#branches--workflow-git)

---

## Stack technique

| Couche | Technologie | Version |
|--------|------------|---------|
| **Frontend** | React | 18.3 |
| **Bundler** | Vite | 5.4 |
| **Backend** | Express.js (ESM) | 4.18 |
| **Base de données** | SQLite | via better-sqlite3 (WAL mode) |
| **Authentification** | JWT | httpOnly cookie + silent refresh |
| **Process manager** | PM2 | — |
| **Domaine** | Dynamic DNS | (configurable via .env) |

---

## Prérequis

- Node.js ≥ 18
- npm

---

## Démarrage en 5 minutes

```bash
git clone https://github.com/ParcMagScene/VehiculesEtPersonnel.git
cd "eM@g"
npm install
cp apps/api/.env.example apps/api/.env
npm run dev:start
```

- Frontend : http://localhost:5174
- Backend API : http://localhost:3003

---

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/ParcMagScene/VehiculesEtPersonnel.git
cd "eM@g"

# Installer toutes les dépendances (racine + workspaces)
npm install
```

---

## Configuration

```bash
# Créer le fichier d'environnement backend
cp apps/api/.env.example apps/api/.env
# Éditer apps/api/.env avec votre JWT_SECRET et VIDEO_CIPHER_KEY
```

---

## Variables d'environnement

- **Backend** : `apps/api/.env`
- **Exemple** : `apps/api/.env.example`
- **Note dev** : après modification de `apps/api/.env.development`, redémarrer le backend pour recharger `process.env`

---

## Lancement en développement

```bash
# Tout-en-un (backend + frontend)
npm run dev:start

# Ou séparément :
# Terminal 1 — Backend (port 3003)
cd apps/api && npm start

# Terminal 2 — Frontend (port 5174)
cd apps/web && npm run dev
```

- **Frontend** : http://localhost:5174
- **Backend API** : http://localhost:3003

---

## Déploiement production

```bash
npm run deploy
```

Le script `scripts/safe-deploy.sh` effectue :
1. Backup du build actuel
2. Build production (`vite build`)
3. Rollback automatique si échec
4. Redémarrage PM2 frontend + backend

---

## Structure du projet

```
eM@g/                           # Monorepo
├── package.json                # Scripts racine (dev:start, deploy, etc.)
├── apps/
│   ├── api/                    # ══ BACKEND EXPRESS ══
│   │   ├── server.js           # Point d'entrée Express
│   │   ├── database.js         # SQLite (initialisation + migrations runtime)
│   │   ├── config/             # Helmet, CORS, rate limiters
│   │   ├── middleware/         # Auth JWT, authorize, sanitize, upload, errorHandler
│   │   ├── *Routes.js          # ~25 fichiers/modules de routes API
│   │   ├── cache.js            # Cache LRU/TTL
│   │   ├── emailService.js     # Service email
│   │   ├── migrations.js       # Migrations DB
│   │   └── backups/            # Sauvegardes DB
│   │
│   ├── web/                    # ══ FRONTEND REACT ══
│   │   ├── index.html          # Point d'entrée HTML (SPA)
│   │   ├── vite.config.js      # Config Vite (proxy /api → :3003)
│   │   └── src/
│   │       ├── main.jsx        # Point d'entrée React
│   │       ├── App.jsx         # Composant racine
│   │       ├── contexts/       # AuthContext
│   │       ├── components/     # ~130 composants par domaine
│   │       ├── hooks/          # Hooks custom
│   │       └── utils/          # Client API, utilitaires
│   │
│   └── tv-client/              # ══ CLIENT TV ══
│
├── docs/                       # Documentation (ce dossier)
├── public/                     # Assets statiques (photos, attachments, plans dépôts)
├── scripts/                    # Scripts de déploiement et maintenance
└── tests/                      # Tests (api-integration, unit)
```

---

## URLs d'accès

### Production
- **Frontend** : http://votre-serveur:4173
- **Backend** : http://votre-serveur:3002

### Développement
- **Frontend** : http://localhost:5174
- **Backend** : http://localhost:3003

---

## Commandes disponibles

```bash
npm run dev          # Serveur de développement (Vite)
npm run build        # Build de production
npm run preview      # Prévisualiser le build
npm run deploy       # Build + déploiement PM2
npm run lint         # Vérification du code (ESLint)
npm run dev:start    # Démarre backend + frontend en dev
npm test             # Lance la suite backend (unit + Zod + DB init + audits)
```

---

## Dépannage fréquent

- **Port backend occupé (3003)** : arrêter le process puis relancer `npm run dev:start`
- **Variables env non prises en compte** : redémarrer le backend
- **Erreur auth au chargement** : vérifier cookie session + endpoint `/api/health`
- **Échec build** : exécuter `npm run build` depuis `apps/web` pour isoler les erreurs frontend

---

## Branches & workflow Git

| Branche | Usage |
|---------|-------|
| `main` | **Production** — ne JAMAIS toucher directement |
| `dev` | Développement actif — toutes les modifications ici |

Workflow : `dev` → PR → `main` (via safe-deploy.sh)

---

> Voir aussi : [ARCHITECTURE.md](../01-Architecture/ARCHITECTURE.md) pour l'architecture détaillée, [CHECKLIST_PRODUCTION.md](../04-Operations/CHECKLIST_PRODUCTION.md) avant chaque déploiement.
