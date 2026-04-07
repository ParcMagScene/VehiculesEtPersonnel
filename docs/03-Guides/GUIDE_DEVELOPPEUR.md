# 🛠️ Guide Développeur — eM@g

> Guide technique pour le développement, la configuration et le déploiement de eM@g.

---

## Table des matières

1. [Stack technique](#stack-technique)
2. [Prérequis](#prérequis)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Lancement en développement](#lancement-en-développement)
6. [Déploiement production](#déploiement-production)
7. [Structure du projet](#structure-du-projet)
8. [URLs d'accès](#urls-daccès)
9. [Commandes disponibles](#commandes-disponibles)
10. [Branches & workflow Git](#branches--workflow-git)

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
| **Domaine** | DuckDNS | (configurable via .env) |

---

## Prérequis

- Node.js ≥ 18
- npm

---

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/ParcMagScene/VehiculesEtPersonnel.git
cd "eM@g"

# Installer toutes les dépendances (racine + apps)
npm install
cd apps/api && npm install && cd ../..
cd apps/web && npm install && cd ../..
```

---

## Configuration

```bash
# Créer le fichier d'environnement backend
cp apps/api/.env.example apps/api/.env
# Éditer apps/api/.env avec votre JWT_SECRET et VIDEO_CIPHER_KEY
```

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
│   │   ├── database.js         # SQLite ~83 tables + index
│   │   ├── config/             # Helmet, CORS, rate limiters
│   │   ├── middleware/         # Auth JWT, authorize, sanitize, upload, errorHandler
│   │   ├── *Routes.js          # ~15 fichiers de routes API
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
```

---

## Branches & workflow Git

| Branche | Usage |
|---------|-------|
| `main` | **Production** — ne JAMAIS toucher directement |
| `dev` | Développement actif — toutes les modifications ici |

Workflow : `dev` → PR → `main` (via safe-deploy.sh)

---

> Voir aussi : [ARCHITECTURE.md](../01-Architecture/ARCHITECTURE.md) pour l'architecture détaillée, [CHECKLIST_PRODUCTION.md](../04-Operations/CHECKLIST_PRODUCTION.md) avant chaque déploiement.
