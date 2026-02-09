# 🏗️ Architecture Complète — MagSav Réservation Véhicules

> **Dernière mise à jour** : 9 février 2026
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
9. [Authentification & sécurité](#9-authentification--sécurité)
10. [Déploiement & infrastructure](#10-déploiement--infrastructure)
11. [Conventions de code](#11-conventions-de-code)
12. [Diagramme des relations](#12-diagramme-des-relations)

---

## 1. Vue d'ensemble

Application web de **gestion de flotte de véhicules** pour Mag Scène (entreprise de prestations événementielles à La Réunion). Elle permet de :

- **Réserver** des véhicules sur un calendrier interactif (vue semaine/mois/année/planning)
- **Gérer l'entretien** : maintenances programmées, signalements de pannes, contrôles techniques
- **Planifier les trajets** : détails aller/retour, pauses, jonctions entre événements
- **Administrer les utilisateurs** : inscription par invitation, rôles admin/user, demandes d'accès
- **Importer des données** : BL (bons de livraison PDF), fichiers Excel, véhicules CSV
- **Synchroniser Google Calendar** : lecture des événements, création de réservations depuis Google
- **Accès mobile** : interface dédiée avec QR code

---

## 2. Stack technique

### Technologies principales

| Couche | Technologie | Version | Rôle |
|--------|------------|---------|------|
| **Frontend** | React | 18.3 | UI composants |
| **Bundler** | Vite | 5.2 | Build & dev server |
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

### Outils de développement

| Outil | Rôle |
|-------|------|
| `eslint` + `eslint-plugin-react` + `eslint-plugin-react-hooks` | Linting |
| `prettier` + `eslint-config-prettier` | Formatage |
| `nodemon` | Rechargement auto backend (dev) |
| `md-to-pdf` | Conversion documentation |

---

## 3. Structure des dossiers

```
Resevation Véhicules/
├── index.html                      # Point d'entrée HTML (SPA)
├── package.json                    # Dépendances frontend
├── vite.config.js                  # Config Vite (proxy, build, etc.)
├── .eslintrc.cjs                   # Règles ESLint
├── .prettierrc                     # Règles Prettier
├── .prettierignore                 # Fichiers ignorés par Prettier
│
├── src/                            # ══ CODE SOURCE FRONTEND ══
│   ├── main.jsx                    # Point d'entrée React
│   ├── App.jsx                     # Composant racine (802 lignes)
│   ├── App.css                     # Styles globaux
│   ├── index.css                   # Reset CSS
│   │
│   ├── components/                 # Composants React (59 fichiers)
│   │   ├── Calendar.jsx            # Calendrier principal (semaine/mois/année)
│   │   ├── Header.jsx              # Barre de navigation + notifications
│   │   ├── LoginForm.jsx           # Formulaire de connexion
│   │   ├── ManagementPanel.jsx     # Panel admin (onglets CRUD)
│   │   ├── ReservationModal.jsx    # Modal création/édition réservation
│   │   ├── MaintenanceDialog.jsx   # Dialog maintenance/intervention
│   │   ├── VehicleDetailsModal.jsx # Fiche détail véhicule
│   │   ├── EventDetailsModal.jsx   # Détail d'un événement calendrier
│   │   ├── TripDetailsModal.jsx    # Planification de trajet
│   │   ├── PlanningView.jsx        # Vue planning (liste chronologique)
│   │   ├── UserManagement.jsx      # Gestion utilisateurs (admin)
│   │   ├── AccessRequestModal.jsx  # Demande d'accès / création compte
│   │   ├── GoogleCalendarBanner.jsx # Bandeau événements Google
│   │   ├── GoogleCalendarConfig.jsx # Config Google (admin)
│   │   ├── AffaireImportModal.jsx  # Import BL/Excel
│   │   ├── InterventionModal.jsx   # Modal intervention rapide
│   │   ├── OverdueInterventionModal.jsx # Alertes interventions en retard
│   │   ├── ReservationRequestsPanel.jsx # Demandes de réservation
│   │   ├── LocationDialog.jsx      # Dialog création lieu (Google Places)
│   │   ├── ClientDialog.jsx        # Dialog création client
│   │   ├── VehiclePickerCards.jsx   # Sélecteur de véhicule (cartes)
│   │   ├── VehicleMaintenanceModal.jsx # Modal km/contrôle technique
│   │   ├── ProfileEditModal.jsx    # Édition de profil utilisateur
│   │   ├── ChangePassword.jsx      # Changement mot de passe
│   │   ├── MobileAccess.jsx        # QR code accès mobile
│   │   ├── QRCodeModal.jsx         # Affichage QR code
│   │   ├── UserAvatar.jsx          # Avatar utilisateur
│   │   ├── ErrorBoundary.jsx       # Capture d'erreurs React
│   │   ├── ConfirmDialog.jsx       # Dialog de confirmation
│   │   ├── MonthSelector.jsx       # Sélecteur de mois
│   │   ├── WeekSelector.jsx        # Sélecteur de semaine
│   │   ├── YearSelector.jsx        # Sélecteur d'année
│   │   └── mobile/                 # Interface mobile dédiée
│   │       ├── MobileApp.jsx       # Routeur mobile
│   │       ├── MobileHome.jsx      # Accueil mobile
│   │       ├── MobileLogin.jsx     # Login mobile
│   │       ├── MobilePlanning.jsx  # Planning mobile
│   │       ├── MobileReservations.jsx # Réservations mobile
│   │       ├── MobileMaintenances.jsx # Maintenances mobile
│   │       └── MobileAvailability.jsx # Disponibilité véhicules
│   │
│   ├── hooks/                      # Hooks React custom
│   │   ├── useAutocomplete.js      # Autocomplétion générique
│   │   └── useGooglePlacesAutocomplete.js # Google Places
│   │
│   └── utils/                      # Fonctions utilitaires
│       ├── api.js                  # Client API (506 lignes, ~60 méthodes)
│       ├── dateUtils.js            # Utilitaires de dates
│       ├── excelImport.js          # Import Excel
│       ├── googleMapsLoader.js     # Chargement Google Maps API
│       ├── indexedDB.js            # Couche cache IndexedDB
│       ├── logger.js               # Logger conditionnel (dev/prod)
│       ├── pdfParser.js            # Parsing PDF (pdfjs-dist)
│       ├── photoList.js            # Gestion photos véhicules
│       ├── vehicleUtils.js         # Utilitaires véhicules (CT, statuts)
│       └── vehiclesCsvImport.js    # Import CSV véhicules
│
├── server/                         # ══ CODE SOURCE BACKEND ══
│   ├── server.js                   # Serveur Express principal (~2100 lignes)
│   ├── routes.js                   # Routes additionnelles (~640 lignes)
│   ├── database.js                 # Initialisation SQLite + schéma
│   ├── package.json                # Dépendances backend
│   ├── ecosystem.config.js         # Configuration PM2
│   ├── .env                        # Variables d'environnement (secrets)
│   ├── .env.example                # Template variables d'environnement
│   ├── logger.js                   # Logger backend
│   ├── backup-database.sh          # Script de backup SQLite
│   ├── import-backup.js            # Restauration depuis backup
│   ├── backup-restore.json         # Config restauration
│   ├── fix-schema.sql              # Corrections de schéma
│   ├── vehicules.db                # Base de données SQLite
│   ├── backups/                    # Dossier backups DB
│   └── migrations/                 # Migrations SQL
│       ├── add_technical_control_type_to_maintenances.sql
│       ├── add_trip_details.sql
│       ├── add_trip_group_id.sql
│       ├── add_vehicle_maintenance_info.sql
│       └── fix_trip_details_reservation_id_type.sql
│
├── public/                         # ══ ASSETS STATIQUES ══
│   ├── initial_data.json           # Données initiales (seed)
│   ├── photos-list.json            # Index photos véhicules
│   ├── pdf.worker.mjs              # Worker PDF.js
│   ├── diagnostic.html             # Page diagnostic
│   ├── guide-utilisation.html      # Guide utilisateur
│   ├── Logos/                      # Logos de l'application
│   ├── Photos/                     # Photos des véhicules
│   └── attachments/                # Pièces jointes (par affaire)
│
├── scripts/                        # ══ SCRIPTS UTILITAIRES ══
│   ├── safe-deploy.sh              # Déploiement zero-downtime
│   ├── generate-photo-list.js      # Génération index photos
│   └── watch-photos.js             # Watcher photos (dev)
│
└── _archive/                       # Documentation archivée
```

---

## 4. Architecture Backend

### Serveur Express (`server/server.js` + `server/routes.js`)

```
Client HTTP
    │
    ▼
┌─────────────────────────────────────────────┐
│ Express (port 3002)                         │
│                                             │
│  ┌──────────────┐  ┌────────────────────┐   │
│  │ Rate Limiter  │  │ CORS whitelist     │   │
│  │ (express-rate │  │ (magsav.duckdns,   │   │
│  │  -limit)      │  │  localhost:5174/    │   │
│  │               │  │  4173, IP locale)   │   │
│  └───────┬───────┘  └────────┬───────────┘   │
│          │                   │               │
│          ▼                   ▼               │
│  ┌──────────────────────────────────────┐    │
│  │ Middlewares                          │    │
│  │  - express.json()                   │    │
│  │  - express.static('./dist')         │    │
│  │  - express.static('./public')       │    │
│  │  - /attachments → public/attachments│    │
│  │  - /avatars → uploads/avatars       │    │
│  └───────────────┬──────────────────────┘    │
│                  │                           │
│                  ▼                           │
│  ┌──────────────────────────────────────┐    │
│  │ Route Handlers                       │    │
│  │                                      │    │
│  │  server.js :                         │    │
│  │   - /api/auth/*      (auth)          │    │
│  │   - /api/vehicles     (CRUD)         │    │
│  │   - /api/reservations (CRUD)         │    │
│  │   - /api/reservation-requests        │    │
│  │   - /api/maintenances (CRUD)         │    │
│  │   - /api/access-requests             │    │
│  │   - /api/admin/*      (admin)        │    │
│  │   - /api/users/*      (profils)      │    │
│  │   - /api/upload-*     (fichiers)     │    │
│  │   - /api/attachments* (PJ)           │    │
│  │                                      │    │
│  │  routes.js :                         │    │
│  │   - /api/clients      (CRUD)         │    │
│  │   - /api/drivers      (CRUD)         │    │
│  │   - /api/locations    (CRUD)         │    │
│  │   - /api/garages      (CRUD)         │    │
│  │   - /api/config/*     (settings)     │    │
│  │   - /api/trip-details (CRUD)         │    │
│  └───────────────┬──────────────────────┘    │
│                  │                           │
│                  ▼                           │
│  ┌──────────────────────────────────────┐    │
│  │ SQLite (better-sqlite3)              │    │
│  │ vehicules.db — WAL mode             │    │
│  │ 16 tables, FK enforced             │    │
│  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Fichiers serveur

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `server.js` | ~2100 | Routes principales (auth, véhicules, réservations, maintenances, utilisateurs, uploads) |
| `routes.js` | ~640 | Routes secondaires (clients, conducteurs, lieux, garages, config, trip-details) |
| `database.js` | ~250 | Initialisation schéma SQLite, pragmas, migrations dynamiques |
| `logger.js` | ~30 | Logger conditionnel |

### Variables d'environnement (`server/.env`)

```
JWT_SECRET=<clé secrète>
JWT_EXPIRY_DAYS=30
```

---

## 5. Architecture Frontend

### Composant racine : `App.jsx` (802 lignes)

```
main.jsx
  └─ App.jsx
       ├─ Détection mobile → MobileApp (si /mobile ou #/mobile)
       ├─ État loading → Spinner
       ├─ Non authentifié → LoginForm
       └─ Authentifié →
            ├─ Header (toujours)
            ├─ GoogleCalendarBanner (toujours)
            ├─ Calendar | PlanningView (selon view)
            ├─ ManagementPanel (lazy, si showManagement)
            ├─ MaintenanceDialog (lazy, si selectedVehicle)
            ├─ VehicleDetailsModal (si selectedVehicleForDetails)
            └─ VehicleMaintenanceModal (lazy, si selectedForKmControl)
```

### States principaux de App.jsx (24 states)

| Catégorie | States |
|-----------|--------|
| **Navigation** | `view` (week/month/year/planning), `currentDate` |
| **Données métier** | `vehicles`, `reservations`, `clients`, `drivers`, `locations`, `garages`, `maintenances`, `users` |
| **Google Calendar** | `calendarConfig`, `googleEvents`, `googleEventForReservation`, `hoveredEventId` |
| **UI / Modals** | `showManagement`, `isLoading`, `reservationToEdit`, `selectedVehicleForMaintenance`, `maintenanceToEdit`, `selectedVehicleForDetails`, `selectedVehicleForKilometrageControl`, `maintenanceActionType` |
| **Auth** | `isAuthenticated`, `currentUser` |

### Code splitting (lazy loading)

3 composants chargés à la demande via `React.lazy()` :
- `ManagementPanel` — Panel de gestion (le plus gros composant)
- `MaintenanceDialog` — Dialog maintenance/intervention
- `VehicleMaintenanceModal` — Modal kilométrage/contrôle technique

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

Le debounce de sauvegarde est de **500ms** pour éviter des écritures trop fréquentes.

### Client API (`src/utils/api.js` — 506 lignes)

Classe `ApiClient` avec ~60 méthodes. Fonctionnalités :
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

### Schéma complet (16 tables)

#### `users` — Utilisateurs
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `email` | TEXT | UNIQUE NOT NULL |
| `name` | TEXT | NOT NULL |
| `password_hash` | TEXT | NOT NULL |
| `is_admin` | BOOLEAN | DEFAULT 0 |
| `password_reset_required` | BOOLEAN | DEFAULT 0 |
| `avatar` | TEXT | — |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `active_sessions` — Sessions JWT actives
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `user_id` | INTEGER | NOT NULL, FK → users(id) |
| `token_hash` | TEXT | NOT NULL |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `expires_at` | DATETIME | NOT NULL |
| `last_activity` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `vehicles` — Véhicules
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | TEXT | PK |
| `name` | TEXT | NOT NULL |
| `type` | TEXT | — |
| `registration` | TEXT | — |
| `brand` | TEXT | — |
| `model` | TEXT | — |
| `color` | TEXT | — |
| `owner` | TEXT | — |
| `comment` | TEXT | — |
| `display_color` | TEXT | — |
| `photo` | TEXT | — |
| `order_index` | INTEGER | DEFAULT 0 |
| `is_location` | BOOLEAN | DEFAULT 0 |
| `kilometrage` | INTEGER | DEFAULT 0 |
| `controles_techniques` | TEXT | DEFAULT '[]' (JSON array) |
| `created_by` | INTEGER | FK → users(id) |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `modified_by` | INTEGER | FK → users(id) |
| `modified_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

> **Note** : Les colonnes `controle_technique_type`, `controle_technique_date`, `controle_technique_deadline` sont **LEGACY** (remplacées par `controles_techniques` JSON).

#### `reservations` — Réservations
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | TEXT | PK |
| `vehicle_id` | TEXT | NOT NULL, FK → vehicles(id) ON DELETE CASCADE |
| `start_date` | TEXT | NOT NULL |
| `start_period` | TEXT | DEFAULT 'AM' |
| `end_date` | TEXT | NOT NULL |
| `end_period` | TEXT | DEFAULT 'PM' |
| `client_name` | TEXT | — |
| `driver_name` | TEXT | — |
| `location_name` | TEXT | — |
| `prestation_name` | TEXT | — |
| `notes` | TEXT | — |
| `google_event_id` | TEXT | — |
| `affaire` | TEXT | — |
| `is_tournee` | BOOLEAN | DEFAULT 0 |
| `linked_event_ids` | TEXT | JSON array |
| `created_by` | INTEGER | FK → users(id) |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `modified_by` | INTEGER | FK → users(id) |
| `modified_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `reservation_requests` — Demandes de réservation
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | TEXT | PK |
| `vehicle_id` | TEXT | NOT NULL, FK → vehicles(id) ON DELETE CASCADE |
| `start_date` | TEXT | NOT NULL |
| `start_period` | TEXT | DEFAULT 'AM' |
| `end_date` | TEXT | NOT NULL |
| `end_period` | TEXT | DEFAULT 'PM' |
| `client_name` | TEXT | — |
| `driver_name` | TEXT | — |
| `location_name` | TEXT | — |
| `prestation_name` | TEXT | — |
| `notes` | TEXT | — |
| `status` | TEXT | DEFAULT 'pending' |
| `requested_by` | INTEGER | NOT NULL, FK → users(id) |
| `requested_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `reviewed_by` | INTEGER | FK → users(id) |
| `reviewed_at` | DATETIME | — |
| `rejection_reason` | TEXT | — |

#### `maintenances` — Maintenances & interventions
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | TEXT | PK |
| `vehicle_id` | TEXT | FK → vehicles(id) ON DELETE CASCADE |
| `vehicle_name` | TEXT | — |
| `type` | TEXT | — |
| `status` | TEXT | — |
| `date` | TEXT | — |
| `end_date` | TEXT | — |
| `start_date_period` | TEXT | — |
| `end_date_period` | TEXT | — |
| `description` | TEXT | — |
| `garage_id` | INTEGER | FK → garages(id) |
| `cost` | REAL | — |
| `mileage` | INTEGER | — |
| `notes` | TEXT | — |
| `is_immobilized` | BOOLEAN | DEFAULT 0 |
| `is_quick_report` | BOOLEAN | DEFAULT 0 |
| `technical_control_type` | TEXT | — |
| `reported_date` | DATETIME | — |
| `reported_by` | INTEGER | FK → users(id) |
| `created_by` | INTEGER | FK → users(id) |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `modified_by` | INTEGER | FK → users(id) |
| `modified_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `clients` — Clients
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `name` | TEXT | NOT NULL |
| `email` | TEXT | — |
| `phone` | TEXT | — |
| `address` | TEXT | — |
| `created_by` / `modified_by` | INTEGER | FK → users(id) |
| `created_at` / `modified_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `drivers` — Conducteurs
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `name` | TEXT | NOT NULL |
| `license_number` | TEXT | — |
| `phone` | TEXT | — |
| `created_by` / `modified_by` | INTEGER | FK → users(id) |
| `created_at` / `modified_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `locations` — Lieux
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `name` | TEXT | NOT NULL |
| `address` | TEXT | — |
| `lat` | REAL | — |
| `lng` | REAL | — |
| `place_id` | TEXT | — |
| `type` | TEXT | — |
| `created_by` / `modified_by` | INTEGER | FK → users(id) |
| `created_at` / `modified_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `garages` — Garages
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `name` | TEXT | NOT NULL |
| `address` | TEXT | — |
| `phone` | TEXT | — |
| `email` | TEXT | — |
| `created_by` / `modified_by` | INTEGER | FK → users(id) |
| `created_at` / `modified_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `config` — Configuration clé-valeur
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `key` | TEXT | PK |
| `value` | TEXT | — |
| `modified_by` | INTEGER | FK → users(id) |
| `modified_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `authorized_emails` — Emails pré-autorisés
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `email` | TEXT | UNIQUE NOT NULL |
| `status` | TEXT | DEFAULT 'pending' |
| `is_admin` | INTEGER | DEFAULT 0 |
| `activated_at` | DATETIME | — |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `access_requests` — Demandes d'accès
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `email` | TEXT | NOT NULL |
| `name` | TEXT | NOT NULL |
| `status` | TEXT | DEFAULT 'pending' |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `reviewed_by` | INTEGER | FK → users(id) |
| `reviewed_at` | DATETIME | — |

#### `modification_history` — Historique des modifications
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `entity_type` | TEXT | NOT NULL |
| `entity_id` | TEXT | NOT NULL |
| `action` | TEXT | NOT NULL |
| `changes` | TEXT | JSON |
| `user_id` | INTEGER | FK → users(id) |
| `user_name` | TEXT | — |
| `timestamp` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `trip_details` — Détails de trajets
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `reservation_id` | TEXT | FK → reservations(id) |
| `event_id` | TEXT | — |
| `event_order` | INTEGER | — |
| `departure_location` | TEXT | — |
| `departure_date` | TEXT | — |
| `departure_time` | TEXT | — |
| `arrival_location` | TEXT | — |
| `arrival_date` | TEXT | — |
| `arrival_time` | TEXT | — |
| `return_departure_location` | TEXT | — |
| `return_departure_date` | TEXT | — |
| `return_departure_time` | TEXT | — |
| `return_arrival_location` | TEXT | — |
| `return_arrival_date` | TEXT | — |
| `return_arrival_time` | TEXT | — |
| `driver_name` | TEXT | — |
| `outbound_duration` | TEXT | — |
| `return_duration` | TEXT | — |
| `has_junction_with_next` | BOOLEAN | — |
| `junction_location` | TEXT | — |
| `trip_group_id` | TEXT | — |
| `updated_at` | DATETIME | — |

#### `trip_pauses` — Pauses de trajet
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `trip_detail_id` | INTEGER | FK → trip_details(id) |
| `pause_type` | TEXT | — |
| `location` | TEXT | — |
| `start_time` | TEXT | — |
| `duration` | TEXT | — |
| `notes` | TEXT | — |

---

## 7. API — Catalogue des routes

### Authentification (`/api/auth/*`)

| Méthode | Route | Auth | Description |
|---------|-------|:----:|-------------|
| POST | `/api/auth/register` | ❌ | Inscription (email doit être pré-autorisé) |
| POST | `/api/auth/login` | ❌ | Connexion → JWT |
| POST | `/api/auth/force-login` | ❌ | Connexion forcée (kill autres sessions) |
| POST | `/api/auth/logout` | ✅ | Déconnexion |
| GET | `/api/auth/users` | ❌ | Liste des utilisateurs (id, email, name, avatar) |
| POST | `/api/auth/change-password` | ✅ | Changer son mot de passe |
| POST | `/api/auth/check-reset` | ❌ | Vérifier si reset requis |
| POST | `/api/auth/set-new-password` | ❌ | Définir nouveau mot de passe (rate limited) |

### Véhicules (`/api/vehicles`)

| Méthode | Route | Auth | Admin | Description |
|---------|-------|:----:|:-----:|-------------|
| GET | `/api/vehicles` | ✅ | ❌ | Liste tous les véhicules |
| POST | `/api/vehicles` | ✅ | ❌ | Créer un véhicule |
| PUT | `/api/vehicles/:id` | ✅ | ❌ | Modifier un véhicule |
| DELETE | `/api/vehicles/:id` | ✅ | ❌ | Supprimer un véhicule |

### Réservations (`/api/reservations`)

| Méthode | Route | Auth | Admin | Description |
|---------|-------|:----:|:-----:|-------------|
| GET | `/api/reservations` | ✅ | ❌ | Liste toutes les réservations |
| POST | `/api/reservations` | ✅ | ✅ | Créer une réservation |
| PUT | `/api/reservations/:id` | ✅ | ✅ | Modifier une réservation |
| DELETE | `/api/reservations/:id` | ✅ | ✅ | Supprimer une réservation |

### Demandes de réservation (`/api/reservation-requests`)

| Méthode | Route | Auth | Admin | Description |
|---------|-------|:----:|:-----:|-------------|
| GET | `/api/reservation-requests` | ✅ | ❌ | Liste toutes les demandes |
| POST | `/api/reservation-requests` | ✅ | ❌ | Créer une demande |
| PUT | `/api/reservation-requests/:id/approve` | ✅ | ✅ | Approuver → crée la réservation |
| PUT | `/api/reservation-requests/:id/reject` | ✅ | ✅ | Rejeter une demande |
| GET | `/api/reservation-requests/pending` | ✅ | ❌ | Demandes en attente |

### Maintenances (`/api/maintenances`)

| Méthode | Route | Auth | Admin | Description |
|---------|-------|:----:|:-----:|-------------|
| GET | `/api/maintenances` | ✅ | ❌ | Liste toutes les maintenances |
| POST | `/api/maintenances` | ✅ | ❌* | Créer (*non-admin limité à status='reported') |
| PUT | `/api/maintenances/:id` | ✅ | ❌* | Modifier (*non-admin limité à ses signalements) |
| DELETE | `/api/maintenances/:id` | ✅ | ✅ | Supprimer (admin uniquement) |

### Demandes d'accès (`/api/access-requests`)

| Méthode | Route | Auth | Admin | Description |
|---------|-------|:----:|:-----:|-------------|
| POST | `/api/access-requests` | ❌ | ❌ | Créer une demande (auto-approve si email autorisé) |
| POST | `/api/access-requests/check-email` | ❌ | ❌ | Vérifier si email autorisé |
| GET | `/api/access-requests` | ✅ | ❌ | Lister les demandes |
| PATCH | `/api/access-requests/:id` | ✅ | ✅ | Approuver/Rejeter |
| GET | `/api/access-requests/count/pending` | ✅ | ❌ | Count demandes en attente |

### Administration (`/api/admin/*` + `/api/users/*`)

| Méthode | Route | Auth | Admin | Description |
|---------|-------|:----:|:-----:|-------------|
| GET | `/api/admin/authorized-emails` | ✅ | ✅ | Emails autorisés |
| POST | `/api/admin/authorized-emails` | ✅ | ✅ | Ajouter email |
| DELETE | `/api/admin/authorized-emails/:id` | ✅ | ✅ | Supprimer email |
| GET | `/api/admin/users` | ✅ | ✅ | Liste utilisateurs (admin) |
| POST | `/api/admin/reset-password` | ✅ | ✅ | Reset mot de passe |
| GET | `/api/users` | ✅ | ✅ | Liste complète utilisateurs |
| GET | `/api/users/names` | ✅ | ❌ | Noms des utilisateurs |
| PATCH | `/api/users/:id` | ✅ | ✅ | Modifier utilisateur |
| DELETE | `/api/users/:id` | ✅ | ✅ | Supprimer utilisateur |
| PATCH | `/api/users/me` | ✅ | ❌ | Modifier son profil |
| POST | `/api/users/me/avatar` | ✅ | ❌ | Upload son avatar |
| DELETE | `/api/users/me/avatar` | ✅ | ❌ | Supprimer son avatar |
| PATCH | `/api/users/:id/profile` | ✅ | ✅ | Modifier profil (admin) |
| POST | `/api/users/:id/avatar` | ✅ | ✅ | Upload avatar (admin) |
| DELETE | `/api/users/:id/avatar` | ✅ | ✅ | Supprimer avatar (admin) |

### Entités CRUD (`routes.js`)

| Entité | GET | POST | PUT | DELETE |
|--------|:---:|:----:|:---:|:------:|
| `/api/clients` | ✅ | ✅ | ✅ | ✅ |
| `/api/drivers` | ✅ | ✅ | ✅ | ✅ |
| `/api/locations` | ✅ | ✅ | ✅ | ✅ |
| `/api/garages` | ✅ | ✅ | ✅ | ✅ |

> Toutes nécessitent `authenticateToken`.

### Configuration (`/api/config/*`)

| Méthode | Route | Auth | Admin |
|---------|-------|:----:|:-----:|
| GET | `/api/config/:key` | ✅ | ❌ |
| POST | `/api/config/:key` | ✅ | ❌ |
| GET | `/api/config/google/client-id` | ✅ | ❌ |
| GET | `/api/config/google/calendar-id` | ✅ | ❌ |
| GET | `/api/config/google/maps-api-key` | ✅ | ❌ |
| POST | `/api/config/google/client-id` | ✅ | ✅ |
| POST | `/api/config/google/calendar-id` | ✅ | ✅ |
| POST | `/api/config/google/maps-api-key` | ✅ | ✅ |

### Trajets (`/api/trip-details`)

| Méthode | Route | Auth | Description |
|---------|-------|:----:|-------------|
| GET | `/api/trip-details/:reservationId` | ✅ | Détails trajets d'une réservation |
| POST | `/api/trip-details` | ✅ | Créer un détail de trajet |
| PUT | `/api/trip-details/:id` | ✅ | Modifier un trajet |
| DELETE | `/api/trip-details/:id` | ✅ | Supprimer un trajet |
| POST | `/api/trip-details/link` | ✅ | Lier deux trajets |
| POST | `/api/trip-details/unlink` | ✅ | Délier un trajet |

### Fichiers & pièces jointes

| Méthode | Route | Auth | Description |
|---------|-------|:----:|-------------|
| POST | `/api/create-folder` | ✅ | Créer dossier dans attachments |
| POST | `/api/upload-bl` | ✅ | Upload BL (PDF uniquement) |
| POST | `/api/upload-attachment` | ✅ | Upload PJ (50MB max, multi-type) |
| GET | `/api/attachments/:affaireId` | ✅ | Lister PJ d'une affaire |
| GET | `/api/attachments-index` | ✅ | Index des affaires avec PJ |
| DELETE | `/api/attachments/:affaireId/:filename` | ✅ | Supprimer une PJ |

### Divers

| Méthode | Route | Auth | Description |
|---------|-------|:----:|-------------|
| GET | `/api/pending-requests-count` | ✅ | Badge admin (interventions + réservations) |
| GET | `/api/history/:entityType/:entityId` | ✅ | Historique des modifications |

> **Total : ~80 routes API**

---

## 8. Modules fonctionnels

### 📅 Module Calendrier
- **Composants** : `Calendar`, `MonthSelector`, `WeekSelector`, `YearSelector`
- **Vues** : Semaine, Mois, Année, Planning
- **Fonctionnalités** : Drag & drop, resize, détection de chevauchement, codage couleur par véhicule
- **Intégration Google** : Lecture événements Google Calendar, création de réservation depuis un événement Google

### 🚗 Module Véhicules
- **Composants** : `VehicleDetailsModal`, `VehiclePickerCards`, `VehicleMaintenanceModal`
- **Fonctionnalités** : CRUD véhicules, photos, immatriculation, kilométrage, contrôles techniques (JSON array), tri par `order_index`, flag `is_location`
- **Import** : CSV via `vehiclesCsvImport.js`

### 📋 Module Réservations
- **Composants** : `ReservationModal`, `EventDetailsModal`, `ReservationRequestsPanel`
- **Fonctionnalités** : Création/édition/suppression par admin, demandes par utilisateurs non-admin, approbation/rejet, lien avec événements Google, tournées (multi-véhicules), affaires (numéros de dossier)
- **Workflow non-admin** : L'utilisateur crée une `reservation_request` → l'admin approuve → devient une `reservation`

### 🔧 Module Maintenance
- **Composants** : `MaintenanceDialog`, `InterventionModal`, `OverdueInterventionModal`
- **Types** : Entretien programmé, réparation, contrôle technique, révision, signalement de panne
- **Statuts** : `reported` → `scheduled` → `in_progress` → `completed`
- **Fonctionnalités** : Signalement rapide (non-admin), programmation complète (admin), suivi des coûts et kilométrages, immobilisation véhicule, alertes interventions en retard
- **Transition auto** : Cron dans App.jsx met à jour les statuts en fonction des dates (toutes les heures)

### 🗺️ Module Trajets
- **Composants** : `TripDetailsModal`
- **Fonctionnalités** : Détails aller/retour, pauses (repos, repas, technique), durées estimées, jonctions entre événements, groupement de trajets (`trip_group_id`)
- **Intégration** : Google Maps pour les adresses, calcul d'itinéraires

### 👥 Module Utilisateurs & Auth
- **Composants** : `LoginForm`, `AccessRequestModal`, `UserManagement`, `ChangePassword`, `ProfileEditModal`, `UserAvatar`
- **Workflow d'inscription** :
  1. L'admin pré-autorise un email (`authorized_emails`)
  2. L'utilisateur demande un accès (`access_requests`)
  3. Si email autorisé → création de mot de passe immédiate
  4. Sinon → demande en attente → admin approuve → envoie lien Gmail → l'utilisateur crée son mot de passe
- **Rôles** : Admin (CRUD tout), Utilisateur (lecture + demandes + signalements)
- **Fonctionnalités** : Avatar, profil éditable, reset mot de passe, sessions actives en DB

### 📎 Module Import / Pièces jointes
- **Composants** : `AffaireImportModal`
- **Fonctionnalités** : Import BL (PDF), import Excel, upload pièces jointes par affaire (50MB max), index des affaires
- **Formats** : PDF, images (JPEG, PNG, GIF, SVG, WebP), documents (DOC, XLS, PPT, TXT, CSV, ZIP, RAR)

### 📱 Module Mobile
- **Composants** : `MobileApp`, `MobileHome`, `MobileLogin`, `MobilePlanning`, `MobileReservations`, `MobileMaintenances`, `MobileAvailability`
- **Accès** : Via `/mobile` ou QR code généré dans `MobileAccess` / `QRCodeModal`
- **Fonctionnalités** : Planning, réservations, maintenances, disponibilité véhicules

### ⚙️ Module Configuration
- **Composants** : `GoogleCalendarConfig`, `ManagementPanel` (onglets)
- **Onglets ManagementPanel** : Véhicules, Clients, Conducteurs, Lieux, Mon compte, Demandes, Utilisateurs, Import/Export, Config Google, Accès Mobile
- **Configuration stockée** : Google Client ID, Calendar ID, Maps API Key, adresse entreprise

---

## 9. Authentification & sécurité

### Flux d'authentification

```
┌──────────┐    POST /auth/login     ┌──────────┐
│ Frontend │ ──────────────────────▶  │ Backend  │
│          │                          │          │
│          │  ◀── JWT + user info ──  │  bcrypt  │
│          │                          │  verify  │
│ localStorage                        │          │
│  ├─ token                           │ active_  │
│  └─ user                            │ sessions │
└──────────┘                          └──────────┘
     │                                     │
     │  Authorization: Bearer <jwt>        │
     │ ──────────────────────────────────▶  │
     │  (chaque requête authentifiée)       │
```

### Mesures de sécurité

| Mesure | Implémentation |
|--------|---------------|
| **Hashage** | bcrypt (password_hash) |
| **JWT** | Secret via `JWT_SECRET` env var, expiration configurable |
| **Sessions** | Stockées en DB (`active_sessions`), invalidation au logout |
| **Rate limiting** | Auth: 20 req/15min, API: 200 req/min |
| **CORS** | Whitelist stricte |
| **Path traversal** | `sanitizePath()` sur tous les uploads |
| **Validation** | `isValidAffaireId()` regex, validation email |
| **Uploads** | Multer avec filtres (type, taille), avatars 5MB/images, PJ 50MB |
| **Console stripping** | `console.log/debug/info` supprimés en production (esbuild) |
| **Admin guard** | Middleware `requireAdmin` sur routes sensibles |

---

## 10. Déploiement & infrastructure

### Environnement de production

| Composant | Détails |
|-----------|---------|
| **Machine** | macOS, utilisateur `reunion` |
| **Domaine** | `magsav.duckdns.org` (DynDNS) |
| **Frontend** | `vite preview` sur port **4173** (PM2 : `vehicules`) |
| **Backend** | `node server.js` sur port **3002** (PM2 : `vehicules-backend`) |
| **Base de données** | `/Users/reunion/Resevation Véhicules/server/vehicules.db` |

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
5. pm2 restart vehicules (frontend)
6. pm2 restart vehicules-backend (backend)
7. Nettoyage backup
```

**Commande** : `npm run deploy`

### Environnement de développement

| Composant | Commande | Port |
|-----------|----------|------|
| Frontend | `npm run dev` | 5174 |
| Backend | `cd server && npm start` | 3002 |

Le proxy Vite en dev redirige `/api` → `http://localhost:3002`.

### Backup

- Script : `server/backup-database.sh`
- Cron PM2 : toutes les 6 heures (via `post_update`)
- Dossier : `server/backups/`

---

## 11. Conventions de code

### Nommage

| Contexte | Convention | Exemple |
|----------|------------|---------|
| **Composants React** | PascalCase | `ReservationModal`, `VehicleDetailsModal` |
| **Fichiers composants** | PascalCase.jsx + .css | `MaintenanceDialog.jsx`, `MaintenanceDialog.css` |
| **Hooks** | camelCase avec préfixe `use` | `useAutocomplete`, `useGooglePlacesAutocomplete` |
| **Utilitaires** | camelCase.js | `dateUtils.js`, `vehicleUtils.js` |
| **Variables JS** | camelCase | `currentUser`, `isAuthenticated` |
| **Colonnes DB** | snake_case | `vehicle_id`, `created_at`, `is_admin` |
| **Routes API** | kebab-case | `/api/access-requests`, `/api/trip-details` |
| **CSS classes** | kebab-case | `.management-panel`, `.tab-button`, `.error-message` |
| **Constantes** | UPPER_SNAKE_CASE | `STORES`, `API_URL` |

### Conversion automatique

Le client API (`api.js`) convertit transparemment :
- **Requêtes** (frontend → backend) : `camelCase` → `snake_case`
- **Réponses** (backend → frontend) : `snake_case` → `camelCase`

### Structure des composants

```jsx
// 1. Imports
import React, { useState, useEffect } from 'react';
import { Icon } from 'lucide-react';
import api from '../utils/api';
import './Component.css';

// 2. Composant (function déclaration ou const)
function MyComponent({ prop1, prop2, onAction }) {
  // 3. States
  const [data, setData] = useState(null);

  // 4. Effects
  useEffect(() => { /* ... */ }, []);

  // 5. Handlers
  const handleClick = () => { /* ... */ };

  // 6. Render
  return (
    <div className="my-component">
      {/* JSX */}
    </div>
  );
}

// 7. Export
export default MyComponent;
```

### Structure CSS

- **Un fichier CSS par composant** (même nom)
- **Classes préfixées** par le nom du composant (ex: `.management-panel`, `.management-tabs`)
- **Variables CSS** pour les couleurs dynamiques (`--tab-color`)
- **Animations** via `@keyframes` dans le même fichier

### ESLint — Règles principales

| Règle | Valeur |
|-------|--------|
| `react/prop-types` | off |
| `no-unused-vars` | warn (ignore `_` préfixés) |
| `no-console` | warn (autorise `warn`, `error`) |
| `react-hooks/rules-of-hooks` | error |
| `react-hooks/exhaustive-deps` | warn |

### Prettier — Formatage

| Option | Valeur |
|--------|--------|
| Guillemets | Simple (`'`) |
| Point-virgule | Oui |
| Virgule finale | Partout (`all`) |
| Largeur | 100 caractères |
| Indentation | 2 espaces |
| Fin de ligne | LF |

---

## 12. Diagramme des relations

```
users ──────────┬──< active_sessions (user_id)
                ├──< access_requests (reviewed_by)
                ├──< vehicles (created_by, modified_by)
                ├──< reservations (created_by, modified_by)
                ├──< reservation_requests (requested_by, reviewed_by)
                ├──< clients (created_by, modified_by)
                ├──< drivers (created_by, modified_by)
                ├──< locations (created_by, modified_by)
                ├──< garages (created_by, modified_by)
                ├──< maintenances (reported_by, created_by, modified_by)
                ├──< config (modified_by)
                └──< modification_history (user_id)

vehicles ───────┬──< reservations (vehicle_id, ON DELETE CASCADE)
                ├──< maintenances (vehicle_id, ON DELETE CASCADE)
                └──< reservation_requests (vehicle_id, ON DELETE CASCADE)

garages ────────┬──< maintenances (garage_id)

reservations ───┬──< trip_details (reservation_id)

trip_details ───┬──< trip_pauses (trip_detail_id)
```

### Résumé chiffré

| Métrique | Valeur |
|----------|--------|
| Tables DB | 16 |
| Routes API | ~80 |
| Composants React | ~45 (desktop) + 7 (mobile) |
| Utilitaires | 10 |
| Hooks custom | 2 |
| Méthodes API client | ~60 |
| Fichiers source (src/) | ~80 |
| Code splitting (lazy) | 3 composants |
| Stores IndexedDB | 8 |
