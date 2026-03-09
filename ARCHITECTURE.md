# 🏗️ Architecture Complète — eM@g

> **Dernière mise à jour** : 9 mars 2026
> **Branche** : `dev` — **Dépôt** : `ParcMagScene/VehiculesEtPersonnel`
> **Domaine** : `magsav.duckdns.org`

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Stack technique](#2-stack-technique)
3. [Structure des dossiers](#3-structure-des-dossiers)
4. [Architecture Backend](#4-architecture-backend)
5. [Architecture Frontend](#5-architecture-frontend)
6. [Base de données](#6-base-de-données)
7. [API — Catalogue des routes](#7-api--catalogue-des-routes)
8. [Modules fonctionnels](#8-modules-fonctionnels)
9. [Module Catalogue & Équipements](#9-module-catalogue--équipements)
10. [Localisation multi-dépôt](#10-localisation-multi-dépôt)
11. [Deep Linking — Chargement 3D](#11-deep-linking--chargement-3d)
12. [Synchronisation inventaire](#12-synchronisation-inventaire)
13. [Authentification & sécurité](#13-authentification--sécurité)
14. [Déploiement & infrastructure](#14-déploiement--infrastructure)
15. [Design System](#15-design-system)
16. [Cache Backend](#16-cache-backend)
17. [Conventions de code](#17-conventions-de-code)
18. [Diagramme des relations](#18-diagramme-des-relations)

---

## 1. Vue d'ensemble

Application web de **gestion de flotte de véhicules, de planning du personnel et de catalogue d'équipements** pour Mag Scène (entreprise de prestations événementielles à La Réunion). Elle permet de :

- **Réserver** des véhicules sur un calendrier interactif (vue semaine/mois/année/planning)
- **Gérer l'entretien** : maintenances programmées, signalements de pannes, contrôles techniques
- **Planifier les trajets** : détails aller/retour, pauses, jonctions entre événements
- **Administrer les utilisateurs** : inscription par invitation, rôles admin/user, demandes d'accès
- **Importer des données** : BL (bons de livraison PDF), fichiers Excel, CSV, BL fournisseur/prestataire
- **Synchroniser Google Calendar** : lecture des événements, création de réservations depuis Google
- **Gérer le personnel** : personnes, compétences, disponibilités, missions, affectations, planning
- **Gérer les congés** : demandes, approbation, solde, planning intégré
- **Gérer les affaires** : dossiers projets, pièces jointes, historique, liens réservations
- **Cataloguer les équipements** : matériel individualisé avec UID, localisation multi-dépôt, plans interactifs SVG
- **Gérer le stock** : mouvements entrées/sorties, inventaire, commandes fournisseurs
- **Communiquer** : événements d'entreprise, notes internes, mailing, messagerie temps réel
- **Accès mobile** : interface dédiée avec QR code (planning, réservations, maintenances, messagerie)

---

## 2. Stack technique

### Technologies principales

| Couche | Technologie | Version | Rôle |
|--------|------------|---------|------|
| **Frontend** | React | 18.3 | UI composants |
| **Bundler** | Vite | 5.4 | Build & dev server |
| **Backend** | Express.js | 4.18 | API REST |
| **Base de données** | SQLite | via better-sqlite3 9.2 | Stockage persistant |
| **Authentification** | JWT | jsonwebtoken 9.0 | Tokens d'accès |
| **Hashage** | bcrypt | 5.1 | Mots de passe |
| **Process manager** | PM2 | — | Production |

### Librairies frontend

| Librairie | Rôle |
|-----------|------|
| `lucide-react` | Icônes SVG |
| `date-fns` | Manipulation de dates |
| `xlsx` | Import/export Excel |
| `pdfjs-dist` | Lecture PDF côté client |
| `@react-oauth/google` | OAuth2 Google |
| `canvas` | Rendu canvas (PDF) |

### Librairies backend

| Librairie | Rôle |
|-----------|------|
| `better-sqlite3` | Driver SQLite synchrone |
| `cors` | Cross-Origin Resource Sharing |
| `dotenv` | Variables d'environnement |
| `express-rate-limit` | Protection anti-brute-force |
| `multer` | Upload de fichiers |
| `node-fetch` | Requêtes HTTP côté serveur |
| `nodemailer` | Envoi d'emails (module mailing) |

---

## 3. Structure des dossiers

```
eM@g/
├── index.html                      # Point d'entrée HTML (SPA)
├── package.json                    # Dépendances frontend
├── vite.config.js                  # Config Vite (proxy, build, etc.)
│
├── src/                            # ══ CODE SOURCE FRONTEND ══
│   ├── main.jsx                    # Point d'entrée React
│   ├── App.jsx                     # Composant racine (~1490 lignes)
│   ├── App.css / index.css / theme.css
│   │
│   ├── components/                 # 87 composants React desktop
│   │   ├── Calendar.jsx            # Calendrier principal (semaine/mois/année)
│   │   ├── Header.jsx              # Barre de navigation + boutons contextuels
│   │   ├── ManagementPanel.jsx     # Panel admin (multi-onglets)
│   │   ├── EquipmentPanel.jsx      # Module équipements individualisés
│   │   ├── CataloguePanel.jsx      # Module catalogue d'équipements
│   │   ├── CommunicationPanel.jsx  # Communication & événements
│   │   ├── DisplayDashboard/       # Module Dashboard écrans (affichage dynamique)
│   │   │   ├── DisplayDashboardPanel.jsx  # Panel principal (sous-onglets)
│   │   │   ├── ScreensTab.jsx       # Gestion écrans
│   │   │   ├── PlaylistsTab.jsx     # Playlists de contenu
│   │   │   ├── MediaTab.jsx         # Galerie médias
│   │   │   ├── MessagesTab.jsx      # Messages d'affichage
│   │   │   ├── TemplatesTab.jsx     # Templates de mise en page
│   │   │   ├── LogsTab.jsx          # Historique d'activité
│   │   │   └── *FormModal.jsx       # Modales création/édition
│   │   ├── MailingPanel.jsx        # Mailing avancé
│   │   ├── StockPanel.jsx          # Gestion de stock
│   │   ├── OrdersPanel.jsx         # Commandes fournisseurs
│   │   ├── PersonnelPanel.jsx      # Module personnel complet
│   │   ├── AffairesPanel.jsx       # Module affaires
│   │   ├── MessagingPanel.jsx      # Messagerie interne
│   │   ├── DepotMap.jsx            # Plan interactif du dépôt (SVG)
│   │   ├── LocationSelector.jsx    # Sélecteur localisation 4 niveaux
│   │   ├── TaskPlanningPanel.jsx   # Planning des tâches
│   │   ├── TaskEditModal.jsx       # Édition de tâches individuelles
│   │   ├── TaskPDFExportModal.jsx  # Export PDF du planning
│   │   ├── AnnuairePanel.jsx       # Annuaire contacts (clients, fournisseurs, prestataires)
│   │   ├── ReservationModal.jsx    # Modal création/édition réservation
│   │   ├── MaintenanceDialog.jsx   # Dialog maintenance/intervention
│   │   ├── BLImportModal.jsx       # Import BL standard
│   │   ├── BLImportLocPrestaModal.jsx # Import BL fournisseur/prestataire
│   │   └── mobile/                 # 16 composants mobile
│   │       ├── MobileApp.jsx       # Routeur mobile
│   │       ├── MobileHome.jsx      # Accueil mobile
│   │       └── ...                 # Planning, réservations, maintenances, etc.
│   │
│   ├── hooks/                      # 7 hooks React custom
│   │   ├── useAutocomplete.js
│   │   ├── useFeedback.js
│   │   ├── useKeyboardShortcuts.js
│   │   ├── useTheme.js
│   │   ├── useToast.jsx
│   │   └── useWindowWidth.js
│   │
│   └── utils/                      # Fonctions utilitaires
│       ├── api.js                  # Client API (~2006 lignes, ~375 méthodes)
│       ├── deepLinking.js          # URL builders, ouverture protocole Chargement 3D
│       ├── dateUtils.js            # Utilitaires de dates
│       ├── indexedDB.js            # Cache IndexedDB (11 stores)
│       ├── pdfParser.js            # Parsing PDF (pdfjs-dist)
│       └── ...
│
├── server/                         # ══ CODE SOURCE BACKEND ══
│   ├── server.js                   # Serveur Express principal (~3330 lignes)
│   ├── cache.js                    # Cache LRU/TTL en mémoire (auth, stats, listes, iCal, config)
│   ├── routes.js                   # Routes secondaires (~672 lignes)
│   ├── personnelRoutes.js          # Routes personnel (~1337 lignes)
│   ├── catalogRoutes.js            # Routes catalogue (~775 lignes)
│   ├── equipmentRoutes.js          # Routes équipements (~1299 lignes)
│   ├── communicationRoutes.js      # Routes communication (~1522 lignes)
│   ├── leaveRoutes.js              # Routes congés (~1337 lignes)
│   ├── ordersRoutes.js             # Routes commandes (~1367 lignes)
│   ├── stockRoutes.js              # Routes stock (~433 lignes)
│   ├── mailingRoutes.js            # Routes mailing (~299 lignes)
│   ├── messagingRoutes.js          # Routes messagerie (~368 lignes)
│   ├── displayRoutes.js            # Routes Dashboard écrans (~1383 lignes)
│   ├── annuaireRoutes.js           # Routes annuaire (~833 lignes)
│   ├── emailService.js             # Service d'envoi d'emails (~383 lignes)
│   ├── database.js                 # Init SQLite + schéma + migrations (~3198 lignes)
│   ├── logger.js                   # Logger conditionnel
│   ├── package.json                # Dépendances backend
│   ├── ecosystem.config.js         # Configuration PM2
│   ├── backup-database.sh          # Script de backup SQLite
│   └── migrations/                 # 17 fichiers SQL
│
├── public/                         # ══ ASSETS STATIQUES ══
│   ├── depot-zones.json            # Zones du dépôt 1 — Événementiel (SVG 770×560)
│   ├── depot2-zones.json           # Zones du dépôt 2 — Structure (SVG 770×510)
│   ├── initial_data.json           # Données initiales (seed)
│   ├── photos-list.json            # Index photos véhicules
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service Worker
│   ├── Photos/                     # Photos des véhicules
│   ├── Logos/                      # Logos de l'application
│   ├── attachments/                # Pièces jointes par affaire
│   └── imports/                    # Fichiers CSV d'import
│
└── scripts/                        # ══ SCRIPTS UTILITAIRES ══
    ├── safe-deploy.sh              # Déploiement zero-downtime
    ├── dev-reset-db.sh             # Reset DB en développement
    ├── dev-start.sh                # Démarrage environnement dev
    ├── sync_inventory_to_catalog.js # Import CSV/XLSX → catalogue
    ├── generate-photo-list.js      # Génération index photos
    └── watch-photos.js             # Watcher photos (dev)
```

---

## 4. Architecture Backend

### Serveur Express

```
Client HTTP
    │
    ▼
┌─────────────────────────────────────────────┐
│ Express (port 3003 dev / 3002 prod)         │
│                                             │
│  ┌──────────────┐  ┌────────────────────┐   │
│  │ Rate Limiter  │  │ CORS whitelist     │   │
│  │ (express-rate │  │ (magsav.duckdns,   │   │
│  │  -limit)      │  │  localhost:5174/    │   │
│  │               │  │  4173, IP locale)   │   │
│  └───────┬───────┘  └────────┬───────────┘   │
│          ▼                   ▼               │
│  ┌──────────────────────────────────────┐    │
│  │ Route Handlers (15 fichiers)         │    │
│  │                                      │    │
│  │  server.js :                         │    │
│  │   - /api/auth/*      (auth)          │    │
│  │   - /api/vehicles     (CRUD)         │    │
│  │   - /api/reservations (CRUD)         │    │
│  │   - /api/maintenances (CRUD)         │    │
│  │   - /api/admin/*      (admin)        │    │
│  │   - /api/users/*      (profils)      │    │
│  │   - /api/upload-*     (fichiers)     │    │
│  │   - /api/attachments* (PJ)           │    │
│  │                                      │    │
│  │  routes.js :                         │    │
│  │   - /api/clients, drivers, locations │    │
│  │   - /api/garages, config, trip-*     │    │
│  │                                      │    │
│  │  personnelRoutes.js :                │    │
│  │   - /api/persons, skills             │    │
│  │   - /api/availabilities, missions    │    │
│  │   - /api/assignments, planning       │    │
│  │                                      │    │
│  │  catalogRoutes.js :                  │    │
│  │   - /api/catalog/equipment (CRUD)    │    │
│  │   - /api/flightcases (CRUD)          │    │
│  │   - /api/trucks/models (CRUD)        │    │
│  │   - /api/reservations/:id/equipment  │    │
│  │                                      │    │
│  │  equipmentRoutes.js :                │    │
│  │   - /api/equipment (CRUD + SAV)      │    │
│  │   - /api/equipment-depot-zones       │    │
│  │   - /api/equipment-all-depot-zones   │    │
│  │   - /api/equipment-location-stats    │    │
│  │                                      │    │
│  │  communicationRoutes.js :            │    │
│  │   - /api/communication/* (events,    │    │
│  │     notes, display-events, tasks,    │    │
│  │     planning, PDF export)            │    │
│  │                                      │    │
│  │  displayRoutes.js :                  │    │
│  │   - /api/display/* (screens,         │    │
│  │     playlists, media, messages,      │    │
│  │     templates, logs)                 │    │
│  │                                      │    │
│  │  annuaireRoutes.js :                 │    │
│  │   - /api/annuaire/* (clients,        │    │
│  │     fournisseurs, prestataires,      │    │
│  │     contacts, import)                │    │
│  │                                      │    │
│  │  leaveRoutes.js :                    │    │
│  │   - /api/leaves/* (demandes,         │    │
│  │     approbation, solde, planning)    │    │
│  │                                      │    │
│  │  ordersRoutes.js :                   │    │
│  │   - /api/orders/* (commandes,        │    │
│  │     fournisseurs, bons)              │    │
│  │                                      │    │
│  │  stockRoutes.js :                    │    │
│  │   - /api/stock/* (mouvements,        │    │
│  │     inventaire)                      │    │
│  │                                      │    │
│  │  mailingRoutes.js :                  │    │
│  │   - /api/mailing/* (templates,       │    │
│  │     campagnes, envois)               │    │
│  │                                      │    │
│  │  messagingRoutes.js :                │    │
│  │   - /api/messages/* (conversations)  │    │
│  └───────────────┬──────────────────────┘    │
│                  ▼                           │
│  ┌──────────────────────────────────────┐    │
│  │ SQLite (better-sqlite3)              │    │
│  │ vehicules.db — WAL mode             │    │
│  │ 86 tables, FK enforced              │    │
│  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Fichiers serveur

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `server.js` | ~3330 | Routes principales (auth, véhicules, réservations, maintenances, utilisateurs, uploads, messagerie) |
| `routes.js` | ~678 | Routes secondaires (clients, conducteurs, lieux, garages, config, trip-details) |
| `personnelRoutes.js` | ~1361 | Routes module personnel (personnes, compétences, disponibilités, missions, affectations) |
| `leaveRoutes.js` | ~1346 | Routes module congés (demandes, approbation, solde, planning) |
| `equipmentRoutes.js` | ~1299 | Routes équipements individualisés (UID, SAV, localisation multi-dépôt) |
| `communicationRoutes.js` | ~2672 | Routes communication (événements, notes, tâches, planning, PDF export) |
| `displayRoutes.js` | ~1965 | Routes Dashboard écrans (screens, playlists, médias, messages, templates, logs) |
| `ordersRoutes.js` | ~1377 | Routes commandes fournisseurs |
| `annuaireRoutes.js` | ~1069 | Routes annuaire (clients, fournisseurs, prestataires, contacts, import) |
| `catalogRoutes.js` | ~775 | Routes catalogue (équipements, flight-cases, camions, réservation-équipement) |
| `stockRoutes.js` | ~433 | Routes gestion de stock (mouvements, inventaire) |
| `messagingRoutes.js` | ~368 | Routes messagerie interne |
| `mailingRoutes.js` | ~299 | Routes mailing avancé (templates, campagnes) |
| `emailService.js` | ~383 | Service d'envoi d'emails (nodemailer) |
| `database.js` | ~3198 | Initialisation schéma SQLite, pragmas, migrations, 86 tables |
| `logger.js` | ~28 | Logger conditionnel |

### Variables d'environnement (`server/.env`)

```
JWT_SECRET=<clé secrète>
JWT_EXPIRY_DAYS=30
```

---

## 5. Architecture Frontend

### Composant racine : `App.jsx` (~1490 lignes)

```
main.jsx
  └─ App.jsx
       ├─ Détection mobile → MobileApp (si /mobile ou #/mobile)
       ├─ État loading → Spinner
       ├─ Non authentifié → LoginForm
       └─ Authentifié →
            ├─ Header (toujours — boutons Nouvelle affaire, Aide)
            ├─ GoogleCalendarBanner (boutons Nouvelle réservation/affectation)
            ├─ activeModule === 'vehicles' ? Calendar | PlanningView
            ├─ activeModule === 'personnel' ? PersonnelPanel (lazy)
            ├─ activeModule === 'affaires' ? AffairesPanel (lazy)
            ├─ activeModule === 'catalog' ? CataloguePanel (lazy)
            ├─ activeModule === 'equipment' ? EquipmentPanel (lazy)
            ├─ activeModule === 'trucks' ? TruckModelPanel (lazy)
            ├─ activeModule === 'communication' ? CommunicationPanel (lazy)
            ├─ activeModule === 'stock' ? StockPanel (lazy)
            ├─ activeModule === 'orders' ? OrdersPanel (lazy)
            ├─ ManagementPanel (lazy, si showManagement)
            ├─ MessagingPanel (lazy, si showMessaging)
            └─ Modals divers (maintenance, détail véhicule, préférences, aide…)
```

### Code splitting (lazy loading)

Composants chargés à la demande via `React.lazy()` :
- `ManagementPanel`, `PersonnelPanel`, `AffairesPanel`
- `CataloguePanel`, `EquipmentPanel`, `TruckModelPanel`
- `CommunicationPanel`, `StockPanel`, `OrdersPanel`, `MailingPanel`
- `MessagingPanel`, `MaintenanceDialog`, `DepotMap`
- `UserPreferencesModal`, `HelpModal`

### Cache IndexedDB

Le frontend persiste les données dans IndexedDB (via `src/utils/indexedDB.js`) pour un chargement instantané au démarrage, puis synchronise avec l'API.

| Store | Données |
|-------|---------|
| `vehicles` | Véhicules |
| `reservations` | Réservations |
| `clients` | Clients |
| `drivers` | Conducteurs |
| `locations` | Lieux |
| `garages` | Garages |
| `maintenances` | Maintenances |
| `calendarConfig` | Configuration Google |
| `affaires` | Affaires / dossiers projets |
| `persons` | Personnel (personnes) |
| `skills` | Compétences |
| `missions` | Missions |

### Client API (`src/utils/api.js` — ~2006 lignes)

Classe `ApiClient` avec ~375 méthodes. Fonctionnalités :
- Détection automatique de l'URL backend (DuckDNS / localhost / IP)
- Injection automatique du Bearer token JWT
- Conversion `snake_case` ↔ `camelCase` transparente
- Auto-logout sur erreur 401/403 (sauf endpoints d'auth)

---

## 6. Base de données

### Moteur : SQLite (via `better-sqlite3`)

**Configuration :**
- `PRAGMA foreign_keys = ON` — Intégrité référentielle activée
- `PRAGMA journal_mode = WAL` — Write-Ahead Logging (performances)
- `PRAGMA synchronous = FULL` — Durabilité maximale
- Checkpoint automatique toutes les 5 minutes

### Schéma — 86 tables

#### Tables principales

| Table | Description |
|-------|-------------|
| `users` | Utilisateurs (email, password_hash, is_admin, avatar) |
| `active_sessions` | Sessions JWT actives |
| `vehicles` | Véhicules (immat, marque, modèle, km, CT, photo, display_color) |
| `reservations` | Réservations de véhicules (dates, client, conducteur, affaire) |
| `reservation_requests` | Demandes de réservation (workflow non-admin) |
| `maintenances` | Maintenances & interventions (type, statut, garage, coût) |
| `clients` | Clients |
| `drivers` | Conducteurs |
| `locations` | Lieux (avec coordonnées GPS) |
| `garages` | Garages |
| `config` | Configuration clé-valeur |
| `authorized_emails` | Emails pré-autorisés |
| `access_requests` | Demandes d'accès |
| `modification_history` | Historique des modifications (audit trail) |
| `trip_details` | Détails de trajets (aller/retour/jonctions) |
| `trip_pauses` | Pauses de trajet |

#### Tables Personnel & Congés

| Table | Description |
|-------|-------------|
| `persons` | Personnel (nom, type, poste, actif) |
| `skills` | Compétences (8 catégories, 18 seed) |
| `person_skills` | Association personne ↔ compétence (avec niveau) |
| `availabilities` | Disponibilités / indisponibilités |
| `missions` | Missions / prestations (6 statuts) |
| `mission_assignments` | Affectation personne → mission |
| `leave_requests` | Demandes de congé |
| `leave_balances` | Soldes de congé |
| `leave_types` | Types de congé |

#### Tables Catalogue & Équipements

| Table | Description |
|-------|-------------|
| `equipment_catalog` | Catalogue d'équipements (ref, famille, catégorie, localisation) |
| `equipment` | Matériel individualisé (UID, n° série, état, SAV, localisation multi-dépôt) |
| `flightcases` | Modèles de flight-cases |
| `truck_models` | Modèles de véhicules de transport |
| `equipment_to_vehicle` | Association réservation ↔ équipement |
| `sav_tickets` | Tickets SAV (suivi des pannes matériel) |
| `equipment_lists` | Listes d'équipements nommées |
| `equipment_list_items` | Items dans les listes |

#### Tables Stock & Commandes

| Table | Description |
|-------|-------------|
| `stock_movements` | Mouvements de stock (entrées/sorties) |
| `stock_locations` | Emplacements de stockage |
| `orders` | Commandes fournisseurs |
| `order_items` | Lignes de commande |
| `suppliers` | Fournisseurs |

#### Tables Communication & Mailing

| Table | Description |
|-------|-------------|
| `communication_events` | Événements d'entreprise (visibilité, affichage écran) |
| `communication_notes` | Notes internes |
| `task_assignments` | Affectation de tâches au planning (date, période, section, statut) |
| `mail_templates` | Templates d'emails |
| `mail_campaigns` | Campagnes de mailing |
| `mail_recipients` | Destinataires de campagne |
| `mail_sends` | Historique d'envois |

#### Tables Messagerie

| Table | Description |
|-------|-------------|
| `conversations` | Conversations de messagerie |
| `conversation_participants` | Participants aux conversations |
| `messages` | Messages texte |

### Migrations automatiques

Le fichier `database.js` exécute des migrations dynamiques au démarrage :
- Détection de colonnes manquantes (ex: `location_depot`)
- Parsing et migration de données texte → champs structurés
- Transactions sécurisées (rollback en cas d'erreur)
- Idempotent (safe re-run)

---

## 7. API — Catalogue des routes

> **Total : ~428 routes API** réparties en 12 fichiers

### Authentification (`/api/auth/*`)

| Méthode | Route | Auth | Description |
|---------|-------|:----:|-------------|
| POST | `/api/auth/register` | ❌ | Inscription (email doit être pré-autorisé) |
| POST | `/api/auth/login` | ❌ | Connexion → JWT |
| POST | `/api/auth/force-login` | ❌ | Connexion forcée (kill autres sessions) |
| POST | `/api/auth/logout` | ✅ | Déconnexion |
| POST | `/api/auth/change-password` | ✅ | Changer son mot de passe |

### Véhicules (`/api/vehicles`)

| Méthode | Route | Auth | Admin |
|---------|-------|:----:|:-----:|
| GET | `/api/vehicles` | ✅ | ❌ |
| POST | `/api/vehicles` | ✅ | ❌ |
| PUT | `/api/vehicles/:id` | ✅ | ❌ |
| DELETE | `/api/vehicles/:id` | ✅ | ❌ |

### Réservations (`/api/reservations`)

| Méthode | Route | Auth | Admin |
|---------|-------|:----:|:-----:|
| GET | `/api/reservations` | ✅ | ❌ |
| POST | `/api/reservations` | ✅ | ✅ |
| PUT | `/api/reservations/:id` | ✅ | ✅ |
| DELETE | `/api/reservations/:id` | ✅ | ✅ |

### Demandes de réservation (`/api/reservation-requests`)

| Méthode | Route | Auth | Admin |
|---------|-------|:----:|:-----:|
| GET | `/api/reservation-requests` | ✅ | ❌ |
| POST | `/api/reservation-requests` | ✅ | ❌ |
| PUT | `/api/reservation-requests/:id/approve` | ✅ | ✅ |
| PUT | `/api/reservation-requests/:id/reject` | ✅ | ✅ |

### Maintenances (`/api/maintenances`)

| Méthode | Route | Auth | Admin |
|---------|-------|:----:|:-----:|
| GET | `/api/maintenances` | ✅ | ❌ |
| POST | `/api/maintenances` | ✅ | ❌* |
| PUT | `/api/maintenances/:id` | ✅ | ❌* |
| DELETE | `/api/maintenances/:id` | ✅ | ✅ |

> *Non-admin limité à ses propres signalements (status='reported')

### Entités CRUD (`routes.js`)

| Entité | GET | POST | PUT | DELETE |
|--------|:---:|:----:|:---:|:------:|
| `/api/clients` | ✅ | ✅ | ✅ | ✅ |
| `/api/drivers` | ✅ | ✅ | ✅ | ✅ |
| `/api/locations` | ✅ | ✅ | ✅ | ✅ |
| `/api/garages` | ✅ | ✅ | ✅ | ✅ |

### Personnel (`personnelRoutes.js`)

| Méthode | Route | Auth | Description |
|---------|-------|:----:|-------------|
| GET/POST/PUT/DELETE | `/api/persons` | ✅ | CRUD personnes (avec compétences) |
| GET/POST/PUT/DELETE | `/api/skills` | ✅ | CRUD compétences |
| GET/POST/PUT/DELETE | `/api/availabilities` | ✅ | CRUD disponibilités |
| GET/POST/PUT/DELETE | `/api/missions` | ✅ | CRUD missions |
| GET/POST/PUT/DELETE | `/api/assignments` | ✅ | CRUD affectations (détection conflits) |
| GET | `/api/personnel/planning` | ✅ | Planning global |

### Congés (`leaveRoutes.js`)

| Méthode | Route | Auth | Description |
|---------|-------|:----:|-------------|
| GET/POST | `/api/leaves` | ✅ | Demandes de congé |
| PUT | `/api/leaves/:id/approve` | ✅ | Approbation |
| PUT | `/api/leaves/:id/reject` | ✅ | Refus |
| GET | `/api/leaves/balance/:personId` | ✅ | Solde de congé |
| GET | `/api/leaves/planning` | ✅ | Planning des congés |

### Catalogue (`catalogRoutes.js`)

| Méthode | Route | Auth | Permission |
|---------|-------|:----:|:----------:|
| GET | `/api/catalog/equipment` | ✅ | — |
| POST/PUT/DELETE | `/api/catalog/equipment` | ✅ | `can_manage_catalog` |
| GET | `/api/catalog/equipment/families` | ✅ | — |
| GET | `/api/catalog/equipment/categories` | ✅ | — |
| GET/POST/PUT/DELETE | `/api/flightcases` | ✅ | `can_manage_catalog` |
| GET/POST/PUT/DELETE | `/api/trucks/models` | ✅ | `can_manage_trucks` |
| GET/POST/DELETE | `/api/reservations/:id/equipment` | ✅ | — |
| GET | `/api/reservations/:id/chargement-export` | ✅ | — |

### Équipements (`equipmentRoutes.js`)

| Méthode | Route | Auth | Description |
|---------|-------|:----:|-------------|
| GET | `/api/equipment` | ✅ | Liste équipements (filtres: zone, état, catalogue) |
| POST | `/api/equipment` | ✅ | Créer un équipement (UID auto, localisation multi-dépôt) |
| PUT | `/api/equipment/:id` | ✅ | Modifier un équipement |
| DELETE | `/api/equipment/:id` | ✅ | Supprimer un équipement |
| GET | `/api/equipment-depot-zones` | ✅ | Zones du dépôt 1 (depot-zones.json) |
| GET | `/api/equipment-all-depot-zones` | ✅ | Zones des 2 dépôts combinées |
| GET | `/api/equipment-location-stats` | ✅ | Compteurs par zone (filtre ?depot=) |
| GET/POST/PUT/DELETE | `/api/sav-tickets` | ✅ | Tickets SAV |
| GET/POST/PUT/DELETE | `/api/equipment-lists` | ✅ | Listes d'équipements |

### Communication (`communicationRoutes.js`)

| Méthode | Route | Auth | Description |
|---------|-------|:----:|-------------|
| GET/POST/PUT/DELETE | `/api/communication/events` | ✅ | Événements d'entreprise |
| GET | `/api/communication/display-events` | ✅ | Événements pour affichage écran |
| PATCH | `/api/communication/events/:id/visibility` | ✅ | Toggle visibilité |
| GET/POST/PUT/DELETE | `/api/communication/notes` | ✅ | Notes internes |
| GET | `/api/communication/tasks/planning` | ✅ | Planning des tâches (jour/semaine) |
| POST/PUT/DELETE | `/api/communication/tasks` | ✅ | CRUD tâches |
| GET | `/api/communication/tasks/pdf` | ✅ | Export PDF planning |

### Stock & Commandes

| Méthode | Route | Auth | Description |
|---------|-------|:----:|-------------|
| GET/POST | `/api/stock/movements` | ✅ | Mouvements de stock |
| GET | `/api/stock/inventory` | ✅ | Inventaire actuel |
| GET/POST/PUT/DELETE | `/api/orders` | ✅ | Commandes fournisseurs |
| GET/POST/PUT/DELETE | `/api/suppliers` | ✅ | Fournisseurs |

### Mailing (`mailingRoutes.js`)

| Méthode | Route | Auth | Description |
|---------|-------|:----:|-------------|
| GET/POST/PUT/DELETE | `/api/mailing/templates` | ✅ | Templates d'email |
| POST | `/api/mailing/send` | ✅ | Envoi de campagne |
| GET | `/api/mailing/history` | ✅ | Historique d'envois |

### Messagerie (`messagingRoutes.js`)

| Méthode | Route | Auth | Description |
|---------|-------|:----:|-------------|
| GET | `/api/messages/conversations` | ✅ | Liste des conversations |
| POST | `/api/messages/conversations` | ✅ | Créer une conversation |
| GET | `/api/messages/conversations/:id` | ✅ | Messages d'une conversation |
| POST | `/api/messages` | ✅ | Envoyer un message |

### Fichiers & pièces jointes

| Méthode | Route | Auth | Description |
|---------|-------|:----:|-------------|
| POST | `/api/upload-bl` | ✅ | Upload BL (PDF uniquement) |
| POST | `/api/upload-attachment` | ✅ | Upload PJ (50MB max, multi-type) |
| GET | `/api/attachments/:affaireId` | ✅ | Lister PJ d'une affaire |
| DELETE | `/api/attachments/:affaireId/:filename` | ✅ | Supprimer une PJ |

### Administration

| Méthode | Route | Auth | Admin |
|---------|-------|:----:|:-----:|
| GET/POST/DELETE | `/api/admin/authorized-emails` | ✅ | ✅ |
| GET | `/api/admin/users` | ✅ | ✅ |
| POST | `/api/admin/reset-password` | ✅ | ✅ |
| PATCH | `/api/users/:id` | ✅ | ✅ |
| PATCH | `/api/users/me` | ✅ | ❌ |

### Codes d'erreur

| Code | Signification |
|------|---------------|
| 400 | Paramètre manquant ou invalide |
| 401 | Token JWT manquant |
| 403 | Permission insuffisante |
| 404 | Ressource non trouvée |
| 409 | Conflit (doublon référence, suppression impossible) |
| 500 | Erreur serveur |

---

## 8. Modules fonctionnels

### 📅 Module Calendrier
- **Composants** : `Calendar`, `MonthSelector`, `WeekSelector`, `YearSelector`
- **Vues** : Semaine, Mois, Année, Planning
- **Fonctionnalités** : Détection de chevauchement, codage couleur par véhicule
- **Intégration Google** : Lecture événements Google Calendar, création depuis événement Google

### 🚗 Module Véhicules
- **Composants** : `VehicleDetailsModal`, `VehiclePickerCards`, `VehicleMaintenanceModal`
- **Fonctionnalités** : CRUD véhicules, photos, kilométrage, contrôles techniques (JSON array), tri par `order_index`

### 🔧 Module Maintenance
- **Composants** : `MaintenanceDialog`, `InterventionModal`, `OverdueInterventionModal`
- **Types** : Entretien programmé, réparation, contrôle technique, révision, signalement de panne
- **Statuts** : `reported` → `scheduled` → `in_progress` → `completed`
- **Transition auto** : Cron dans App.jsx met à jour les statuts en fonction des dates

### 👷 Module Personnel
- **Composants** : `PersonnelPanel` (4 sous-onglets), `PersonnelDetailPanel`, `AssignmentDialog`
- **Sous-onglets** : Personnes, Compétences, Missions, Planning
- **Fonctionnalités** : Détection conflits d'affectation, vérification indisponibilités, passage auto au statut `confirmed`

### 🏖️ Module Congés
- **Backend** : `leaveRoutes.js` (~1346 lignes)
- **Fonctionnalités** : Demandes de congé, workflow d'approbation, solde par employé, planning intégré, types de congé configurables

### 📎 Module Affaires
- **Composants** : `AffairesPanel`, `AffaireDetailPanel`, `AffaireImportModal`, `BLImportModal`, `BLImportLocPrestaModal`
- **Fonctionnalités** : Dossiers projets, PJ multi-format (50MB max), import BL (PDF standard + fournisseur/prestataire), import Excel, historique

### 💬 Module Messagerie
- **Composants** : `MessagingPanel`, `MobileMessaging`
- **Fonctionnalités** : Conversations temps réel, notifications, historique

### 📢 Module Communication
- **Composants** : `CommunicationPanel`, `TaskPlanningPanel`, `TaskEditModal`, `TaskPDFExportModal`
- **Fonctionnalités** : Événements d'entreprise (calendrier), notes internes, toggle visibilité affichage écran, endpoint `/display-events` pour écrans déportés
- **Planning tâches** : Vue jour/semaine, 9 sections ordonnées (RDV, priorités, courses, prépa, opérationnel, événements, secondaires, manuelles), édition individuelle
- **Export PDF** : Génération PDF une page avec badges colorés, enrichissement par affaire

### ✉️ Module Mailing
- **Composants** : `MailingPanel`
- **Backend** : `mailingRoutes.js` + `emailService.js`
- **Fonctionnalités** : Templates d'email, envoi groupé, historique de campagnes, service nodemailer

### 📊 Module Stock
- **Composants** : `StockPanel`
- **Fonctionnalités** : Mouvements entrées/sorties, inventaire temps réel, emplacements de stockage

### 🛒 Module Commandes
- **Composants** : `OrdersPanel`
- **Fonctionnalités** : Gestion fournisseurs, commandes, lignes de commande, suivi de réception

### 📱 Module Mobile
- **Composants** : `MobileApp`, `MobileHome`, `MobileLogin`, `MobilePlanning`, `MobileReservations`, `MobileMaintenances`, `MobileAvailability`, `MobilePersonnel`, `MobileMessaging`, `MobileParcDashboard`, `MobileEquipmentQR`, `MobileLocation`, `MobileLeaves`, `MobileOrders`, `MobileEquipment` et 1 autre
- **Accès** : Via `/mobile` ou QR code
- **PWA** : Service Worker + manifest pour installation

### ⚙️ Module Configuration
- **Composants** : `GoogleCalendarConfig`, `ManagementPanel` (multi-onglets)
- **Onglets** : Véhicules, Clients, Conducteurs, Lieux, Personnel, Mon compte, Demandes, Utilisateurs, Import/Export, Config Google, Accès Mobile, Plan Dépôt
- **Configuration stockée** : Google Client ID, Calendar ID, Maps API Key, adresse entreprise

### 📒 Module Annuaire
- **Composants** : `AnnuairePanel` (~1112 lignes, 6 sous-composants)
- **Backend** : `annuaireRoutes.js` (~1069 lignes, 29 routes)
- **Tables** : `clients` (enrichie), `suppliers` (enrichie), `prestataires`, `annuaire_contacts`, 4 tables lookup (legal_structures, service_types, activity_sectors, contact_categories)
- **Validation** : SIRET (algorithme de Luhn), TVA intracommunautaire (format FR+11), normalisation téléphone automatique
- **Fonctionnalités** : Répertoire unifié clients/fournisseurs/prestataires, contacts multiples par entité, recherche globale, import CSV avec UPSERT, lookups éditables, code NAF

---

## 9. Module Catalogue & Équipements

### Vue d'ensemble

Le module **Catalogue & Équipements** étend l'application avec :

- Un **catalogue d'équipements** référençant tout le matériel (backline, audiovisuel, câbles, armoires…)
- Des **équipements individualisés** avec UID unique, numéro de série, état, et tickets SAV
- Des **flight-cases** (modèles de conteneurs réutilisables)
- Des **modèles de camions** pour le chargement 3D
- L'**association équipement ↔ réservation** pour la planification logistique
- La **localisation multi-dépôt** avec plans interactifs SVG

### Structure des fichiers

```
server/
  catalogRoutes.js          ← Routes API (CRUD catalogue, FC, camions, résa-équip.)
  equipmentRoutes.js        ← Routes API (CRUD équipements individuels, SAV, zones)
src/
  components/
    CataloguePanel.jsx      ← Catalogue (familles, catégories, localisation)
    EquipmentPanel.jsx       ← Équipements individualisés (UID, SAV, dépôt)
    FlightcasePanel.jsx      ← Modèles de flight-cases
    TruckModelPanel.jsx      ← Modèles de camions
    ReservationEquipment.jsx ← Section matériel dans le modal réservation
    DepotMap.jsx             ← Plan interactif SVG du dépôt
    LocationSelector.jsx     ← Sélecteur 4 niveaux (Dépôt → Étage → Zone → Code)
  utils/
    deepLinking.js           ← URL builders, ouverture protocole Chargement 3D
```

### Modèle de données

```
equipment_catalog
  └─ default_flightcase_id → flightcases.id (optionnel)

equipment
  ├─ catalog_id → equipment_catalog.id (optionnel)
  ├─ location_depot ("1" ou "2")
  ├─ location_zone (ex: "A1", "M1", "I3")
  ├─ location_floor ("RDC", "MEZZ")
  └─ location_code (code précis optionnel)

equipment_to_vehicle
  ├─ equipment_id → equipment_catalog.id
  ├─ flightcase_id → flightcases.id (optionnel)
  └─ reservation_id → reservations.id

sav_tickets
  └─ equipment_id → equipment.id
```

### Permissions

| Permission | Accès |
|---|---|
| `can_manage_catalog` | CRUD catalogue + flight-cases |
| `can_manage_trucks` | CRUD modèles de camions |

Les admins (`is_admin = 1`) ont tous les droits. Les routes GET ne nécessitent que `authenticateToken`.

---

## 10. Localisation multi-dépôt

### Architecture

L'application gère **2 dépôts physiques** avec un système de localisation structuré en 4 niveaux :

```
Dépôt (1 ou 2) → Étage (RDC / Mezzanine / Extérieur) → Zone (A1, M1, I3…) → Code (optionnel)
```

### Dépôts configurés

| Dépôt | Nom | Fichier JSON | Dimensions SVG |
|-------|-----|-------------|----------------|
| **1** | Événementiel | `public/depot-zones.json` | 770 × 560 |
| **2** | Structure | `public/depot2-zones.json` | 770 × 510 |

### Dépôt 1 — Événementiel

| Étage | Zones | Description |
|-------|-------|-------------|
| **RDC** | A1–A5, B1–B4, C1–C6, D1–D4, QUAI1–3 | Stockage principal |
| **Mezzanine** | E1–E3, F1–F8, G1–G3, H1–H3 + locaux | Stockage complémentaire |
| **Extérieur** | I1 (Parking EST), I2 (Parking NORD), I3 (Arrière OUEST) | Zones extérieures |

### Dépôt 2 — Structure

| Étage | Zones | Description |
|-------|-------|-------------|
| **RDC** | J1–J5, K1–K4, L1–L2, N, QUAI1–2 | Stockage structure |
| **Mezzanine** | M1 | Mezzanine structure |

### Composants frontend

- **`DepotMap.jsx`** : Plan interactif SVG avec zoom/pan, tooltip, recherche, compteurs d'équipements par zone, dimensions dynamiques depuis le JSON
- **`LocationSelector.jsx`** : Sélecteur en cascade à 4 niveaux (Dépôt → Étage → Zone → Code), auto-remplissage de l'étage depuis la zone, compatible mono et multi-dépôt

### API

| Route | Description |
|-------|-------------|
| `GET /api/equipment-depot-zones` | Zones du dépôt 1 |
| `GET /api/equipment-all-depot-zones` | Zones des 2 dépôts combinées |
| `GET /api/equipment-location-stats?depot=` | Compteurs par zone (filtre par dépôt) |

### Migration de données

Au démarrage, `database.js` exécute une migration automatique qui :
1. Parse les anciennes valeurs texte `location` (ex: `"Entrepôt 1 : D2"`)
2. Extrait dépôt, zone et étage via regex + mapping Set
3. Peuple `location_depot`, `location_zone`, `location_floor`
4. Cas spécial : `"Entrepôt 2 : M"` → zone `M1`, étage `MEZZ`
5. Migration idempotente (safe re-run)

---

## 11. Deep Linking — Chargement 3D

### Principe

Le deep linking permet l'ouverture croisée entre eM@g (web) et Chargement 3D (app desktop/web) via des URL construites dynamiquement.

### Protocole `chargement3d://`

| Action | URL |
|--------|-----|
| Charger réservation | `chargement3d://load?reservation=<id>&source=emag` |
| Prévisualiser équipement | `chargement3d://preview?equipment=<ref>&dimensions=LxWxH` |
| Charger modèle camion | `chargement3d://truck?model=<id>&source=emag` |

### Module utilitaire (`deepLinking.js`)

```js
// Construire des URL Chargement 3D
buildChargementUrlForReservation(reservationId)
buildChargementUrlForEquipment(reference, dimensions)
buildChargementUrlForTruck(modelId)

// Ouvrir dans Chargement 3D (avec détection fallback)
await openInChargement(url)

// Construire des URL eM@g (pour Chargement 3D → eM@g)
buildEmagReservationUrl(reservationId)
buildEmagCatalogUrl(reference)

// Parser les liens entrants
parseIncomingDeepLink()
// → { type: 'reservation', id: '123' } ou null

// Utilitaires
formatDimensions({ length, width, height }) // → "100 × 50 × 30 mm"
calculateVolume({ length, width, height })   // → 0.15 (m³)
```

### API d'export

`GET /api/reservations/:id/chargement-export` — Retourne les items avec dimensions parsées + résumé (poids, volume, quantité).

---

## 12. Synchronisation inventaire

### Script `scripts/sync_inventory_to_catalog.js`

Import CSV/XLSX → table `equipment_catalog`. Exécution manuelle, idempotent (upsert par référence).

```bash
node scripts/sync_inventory_to_catalog.js chemin/vers/inventaire.csv
node scripts/sync_inventory_to_catalog.js chemin/vers/inventaire.xlsx
```

### Colonnes reconnues (FR/EN, insensible à la casse)

| Colonne CSV/XLSX | Champ DB | Obligatoire |
|---|---|---|
| `reference` / `ref` / `code` | `reference` | Non |
| `name` / `nom` / `designation` / `libellé` | `name` | **Oui** |
| `family` / `famille` / `type` | `family` | Non |
| `subfamily` / `sous_famille` | `subfamily` | Non |
| `category` / `catégorie` | `category` | Non |
| `weight` / `poids` | `weight` | Non |
| `length` / `longueur` | `dimensions.length` | Non |
| `width` / `largeur` | `dimensions.width` | Non |
| `height` / `hauteur` | `dimensions.height` | Non |

### Logique

1. **Détection auto des colonnes** depuis les en-têtes
2. **Upsert par référence** — existant = mise à jour, nouveau = insertion
3. **Sans référence** — toujours inséré (pas de dé-duplication)
4. **Dimensions** — JSON si au moins une dimension présente
5. **Flight-case auto** — Association par catégorie (micro, console, enceinte…)
6. **Transaction SQLite** — Rollback complet en cas d'erreur

---

## 13. Authentification & sécurité

### Flux d'authentification

```
┌──────────┐    POST /auth/login     ┌──────────┐
│ Frontend │ ──────────────────────▶  │ Backend  │
│          │  ◀── JWT + user info ──  │  bcrypt  │
│ localStorage                        │ active_  │
│  ├─ token                           │ sessions │
│  └─ user                            │          │
└──────────┘                          └──────────┘
     │  Authorization: Bearer <jwt>        │
     │ ──────────────────────────────────▶  │
```

### Mesures de sécurité

| Mesure | Implémentation |
|--------|---------------|
| **Hashage** | bcrypt (12 rounds) |
| **JWT** | Secret via env var, expiration 30 jours |
| **Sessions** | Stockées en DB, invalidation au logout |
| **Rate limiting** | Auth: 20 req/15min, API: 200 req/min |
| **CORS** | Whitelist stricte |
| **Path traversal** | `sanitizePath()` sur tous les uploads |
| **Validation** | Regex sur IDs, validation email |
| **Uploads** | Multer avec filtres (type, taille), 50MB max |
| **Console stripping** | `console.log/debug/info` supprimés en production (esbuild) |
| **Admin guard** | Middleware `requireAdmin` sur routes sensibles |

---

## 14. Déploiement & infrastructure

### Environnement de production

| Composant | Détails |
|-----------|---------|
| **Machine** | macOS, utilisateur `reunion` |
| **Domaine** | `magsav.duckdns.org` (DynDNS) |
| **Frontend** | `vite preview` sur port **4173** (PM2 : `vehicules`) |
| **Backend** | `node server.js` sur port **3002** (PM2 : `vehicules-backend`) |
| **Base de données** | `/Users/reunion/eM@g/server/vehicules.db` |

### PM2 — Process Manager

| Process | Script | Port | Mémoire max | Restart auto |
|---------|--------|------|-------------|:------------:|
| `vehicules` | `npx vite preview` | 4173 | 500 MB | ✅ |
| `vehicules-backend` | `node server.js` | 3002 | 1 GB | ✅ + cron 6h |

### Script de déploiement (`scripts/safe-deploy.sh`)

```
1. Backup dist/ → dist-backup/
2. npm run build
3. Si échec → restaure dist-backup/ (zero-downtime)
4. Vérifie dist/index.html existe
5. pm2 restart vehicules + vehicules-backend
6. Nettoyage backup
```

### Environnement de développement

| Composant | Commande | Port |
|-----------|----------|------|
| Frontend | `npm run dev` | 5174 |
| Backend | `cd server && npm start` | 3003 |

Le proxy Vite en dev redirige `/api` → `http://localhost:3003`.

### Backup

- Script : `server/backup-database.sh`
- Cron PM2 : toutes les 6 heures
- Dossier : `server/backups/`

---

## 15. Design System

### Tokens CSS (`src/theme.css`)

Le fichier central `theme.css` définit toutes les variables CSS (custom properties) du projet. Les catégories de tokens :

| Catégorie | Préfixe | Tokens |
|-----------|---------|--------|
| **Espacement** | `--space-*` | 16 niveaux (0.25rem → 5rem) |
| **Rayons** | `--radius-*` | 7 variantes (sm → full) |
| **Typographie** | `--font-*` | 9 tailles + leading + weights |
| **Ombres** | `--shadow-*` | 5 niveaux (xs → 2xl) |
| **Z-index** | `--z-*` | 8 paliers (base → max) |
| **Scrollbar** | `--scrollbar-*` | width, thumb, track, hover, radius, bg, width-thin |
| **Tableaux** | `--table-*` | header-bg, header-color, row-hover, row-stripe, border, cell-padding, radius |
| **Cartes/Panels** | `--card-*`, `--panel-*` | bg, border, radius, shadow, padding, header-padding, body-padding |

**Dark mode** : toutes les couleurs thème sont redéfinies dans `[data-theme="dark"]`.

### Composants UI réutilisables (`src/components/ui/`)

| Composant | Fichier | Usage |
|-----------|---------|-------|
| `Card` | `Card.jsx` | Conteneur avec fond, bordure, ombre (variantes: flat, compact) |
| `Panel` | `Panel.jsx` | Panneau structuré header/body/footer avec bouton fermer |
| `SectionHeader` | `SectionHeader.jsx` | Titre de section avec badge de comptage et actions |
| `Table` | `Table.jsx` | Tableau standardisé : columns, data, striped, compact, sticky header |
| `ScrollArea` | `ScrollArea.jsx` | Conteneur scrollable avec scrollbars unifiées |
| `FormField` | `FormField.jsx` | Champ de formulaire label + input + hint/erreur |

**Import** : `import { Card, Panel, Table } from '../components/ui';`

---

## 16. Cache Backend (`server/cache.js`)

Module de cache LRU (Least Recently Used) en mémoire avec TTL (Time To Live).

### Instances pré-configurées

| Instance | TTL | Max | Usage |
|----------|-----|-----|-------|
| `authCache` | 30s | 1000 | Vérification session `authenticateToken` (évite SHA-256 + SELECT à chaque requête) |
| `statsCache` | 20s | 100 | Endpoints `/stats` (6+ queries agrégées par appel) |
| `listCache` | 30s | 200 | Listes enrichies (`/api/affaires`, `/api/communication/planning-affaires`) |
| `icalCache` | 5min | 50 | Événements iCal (évite les fetch HTTP externes répétés) |
| `configCache` | 10min | 50 | Configuration quasi-statique (Google keys, etc.) |

### Invalidation automatique

- Mutations (POST/PUT/DELETE) sur `/api/affaires` → `invalidateEntity('affaires')` vide `listCache` + `statsCache`
- Logout → `authCache.clear()` force re-vérification DB

### Monitoring

- `GET /api/cache/stats` (admin) → statistiques tous caches (size, hits, misses, hitRate)
- `POST /api/cache/clear` (admin) → vider un cache par nom ou tous

### Middleware Express

```js
app.get('/api/stats', cacheMiddleware(statsCache, () => 'comm-stats', 20_000), handler);
```

---

## 17. Conventions de code

### Nommage

| Contexte | Convention | Exemple |
|----------|------------|---------|
| **Composants React** | PascalCase | `ReservationModal`, `DepotMap` |
| **Fichiers composants** | PascalCase.jsx + .css | `EquipmentPanel.jsx` |
| **Hooks** | camelCase avec préfixe `use` | `useAutocomplete` |
| **Utilitaires** | camelCase.js | `deepLinking.js` |
| **Variables JS** | camelCase | `currentUser` |
| **Colonnes DB** | snake_case | `location_depot` |
| **Routes API** | kebab-case | `/api/equipment-all-depot-zones` |
| **CSS classes** | kebab-case | `.depot-map-container` |

### Conversion automatique

Le client API (`api.js`) convertit transparemment :
- **Requêtes** : `camelCase` → `snake_case`
- **Réponses** : `snake_case` → `camelCase`

### ESLint / Prettier

- Guillemets simples, point-virgule, virgule finale partout
- Indentation 2 espaces, largeur 100 caractères, fin de ligne LF

---

## 18. Diagramme des relations

```
users ──────────┬──< active_sessions
                ├──< vehicles, reservations, maintenances
                ├──< clients, drivers, locations, garages
                ├──< access_requests, modification_history
                └──< config

vehicles ───────┬──< reservations (ON DELETE CASCADE)
                ├──< maintenances (ON DELETE CASCADE)
                └──< reservation_requests (ON DELETE CASCADE)

reservations ───┬──< trip_details → trip_pauses
                ├──< missions → mission_assignments
                └──< equipment_to_vehicle

persons ────────┬──< person_skills (← skills)
                ├──< availabilities
                ├──< mission_assignments (← missions)
                └──< leave_requests, leave_balances

equipment_catalog ──< equipment (catalog_id)
                  └─ default_flightcase_id → flightcases

equipment ──────┬──< sav_tickets
                └──< equipment_list_items (← equipment_lists)

orders ─────────┬──< order_items
                └─ supplier_id → suppliers

communication_events, communication_notes
mail_templates → mail_campaigns → mail_recipients, mail_sends
conversations → conversation_participants, messages
```

### Résumé chiffré

| Métrique | Valeur |
|----------|--------|
| Tables DB | 86 |
| Routes API | ~428 |
| Composants React (desktop) | 87 |
| Composants React (mobile) | 16 |
| Composants DisplayDashboard | 21 |
| Composants UI réutilisables | 6 |
| Total composants React | 130 |
| Utilitaires | 13 |
| Hooks custom | 7 |
| Méthodes API client | ~375 |
| Code splitting (lazy) | ~24 composants |
| Stores IndexedDB | 11 |
| Fichiers routes backend | 12 |
| Lignes backend total | ~20 170 |
| Lignes frontend composants | ~60 900 |
| Palettes de thème | 7 (défaut + 6 Flat Design) |
| Variables CSS --theme-* | ~145 |
| Migrations SQL | 17 |
| Scripts utilitaires | 17 |
