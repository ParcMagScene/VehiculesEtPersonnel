# 🔍 AUDIT COMPLET — eM@g

> **Date** : 14 avril 2026
> **Branche** : `feature/sonos-full-gui` (HEAD: `a150ca1`)
> **Périmètre** : Backend, Frontend, Base de données, Mobile, TV Client, CSS, UX/UI, Architecture
> **Objectif** : Inventaire exhaustif — aucune solution proposée à ce stade

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble & métriques](#1-vue-densemble--métriques)
2. [Architecture & Structure](#2-architecture--structure)
3. [Backend (Express.js)](#3-backend-expressjs)
4. [Frontend (React + Vite)](#4-frontend-react--vite)
5. [Base de données (SQLite)](#5-base-de-données-sqlite)
6. [Client TV (Vanilla JS)](#6-client-tv-vanilla-js)
7. [Interface Mobile](#7-interface-mobile)
8. [Module Sonos](#8-module-sonos)
9. [Design System & CSS](#9-design-system--css)
10. [UX/UI](#10-uxui)
11. [Sécurité](#11-sécurité)
12. [Tests & CI](#12-tests--ci)
13. [Score global consolidé](#13-score-global-consolidé)
14. [Inventaire des problèmes par sévérité](#14-inventaire-des-problèmes-par-sévérité)

---

## 1. VUE D'ENSEMBLE & MÉTRIQUES

### Échelle du projet

| Domaine | Fichiers | Lignes estimées | Technologie |
|---------|----------|-----------------|-------------|
| Backend API | 22 routes + middlewares | ~15 000+ | Express.js ESM + better-sqlite3 |
| Frontend Desktop | 131+ composants | ~45 000+ | React 18 + Vite |
| Frontend Mobile | 42 composants | ~5 000+ | React (dans web) |
| Client TV | 4 fichiers | ~1 700 | Vanilla JS |
| Sonos (desktop+mobile) | 12 composants | ~500+ | React + hook partagé |
| Design System | 44 composants | ~4 000+ | React + CSS tokens |
| Tests frontend | 37 suites | 400 tests | Vitest + Testing Library |
| Tests backend | 14 suites | 85 tests | node --test |
| Base de données | 84 tables | ~2 100+ colonnes | SQLite (WAL mode) |
| CSS | ~60+ fichiers | ~12 000+ | CSS modules + variables |
| Scripts | 30+ fichiers | ~3 000+ | JS/Python/Shell |
| Documentation | 40+ fichiers | ~15 000+ | Markdown |

**Total estimé** : ~100 000+ lignes de code applicatif

### Domaines fonctionnels (15)

| # | Domaine | Tables DB | Routes API | Composants UI |
|---|---------|-----------|------------|---------------|
| 1 | Véhicules & Réservations | 6 | vehicleRoutes.js | Calendar, ReservationModal |
| 2 | Personnel & Annuaire | 5 | personnelRoutes.js, annuaireRoutes.js | PersonnelPanel, AnnuairePanel |
| 3 | Équipement & Catalogue | 11 | equipmentRoutes.js, catalogRoutes.js | EquipmentPanel |
| 4 | Stock & Inventaire | 7 | stockRoutes.js, inventoryRoutes.js | InventoryPanel |
| 5 | Affaires & Devis | 4 | affaireRoutes.js | AffaireDetailPanel |
| 6 | Planning & Tâches | 6 | planningRoutes.js, tasksRoutes.js | TaskPlanningPanel |
| 7 | Commandes & Fournisseurs | 5 | ordersRoutes.js, supplierCatalogRoutes.js | OrdersPanel |
| 8 | Messagerie | 3 | messagingRoutes.js | MessagingPanel, MobileMessaging |
| 9 | Congés & Absences | 2 | leavesRoutes.js | LeaveRequestsPanel |
| 10 | Affichage TV | 3 | displayRoutes.js | TV client standalone |
| 11 | Sonos | 1 | sonosRoutes.js | SonosPanel, MobileSonos |
| 12 | Vidéo / Caméras | 2 | cameraRoutes.js | PlaybackPanel |
| 13 | Administration | 3 | adminRoutes.js | UserManagement |
| 14 | Authentification | 2 | authRoutes.js | LoginForm |
| 15 | Import/Export | 2 | import-backup.js | Various |

---

## 2. ARCHITECTURE & STRUCTURE

### Monorepo

```
eM@g/
├── apps/
│   ├── api/          # Backend Express.js ESM
│   ├── web/          # Frontend React + Vite
│   └── tv-client/    # Client TV Vanilla JS
├── scripts/          # Utilitaires déploiement/maintenance
├── docs/             # Documentation structurée
├── prompts/          # Prompts IA versionnés
├── public/           # Assets statiques partagés
└── tests/            # (vide — tests dans apps/)
```

### Constats architecturaux

| # | Constat | Type |
|---|---------|------|
| A1 | Monorepo avec npm workspaces — **bien structuré** | ✅ Force |
| A2 | Séparation front/back/tv propre — 3 apps indépendantes | ✅ Force |
| A3 | Le dossier `tests/` racine est **vide** — tous les tests sont dans `apps/web/` et `apps/api/` | ⚠️ Incohérence |
| A4 | Le dossier `public/` contient des assets **métier** (photos, catalogues, imports) mélangés avec des assets **statiques** (icons, manifest) | ⚠️ Confusion |
| A5 | `backups/` contient des logs de sync — pas de vrais backups DB | ⚠️ Nommage trompeur |
| A6 | `prompts/` versionné dans le repo — inhabituel mais intentionnel | 📝 Note |
| A7 | Pas de `docker-compose.yml` ni de conteneurisation | 📝 Absence |
| A8 | Pas de monorepo tool (Turborepo, Nx) — scripts manuels | 📝 Absence |
| A9 | Le fichier `mediamtx.yml` (config streaming) est à la racine au lieu de `config/` | ⚠️ Placement |

---

## 3. BACKEND (Express.js)

### 3.1 Architecture des routes

**22 fichiers de routes — ~150+ endpoints**

| Fichier | Endpoints | Validation Zod | Commentaire |
|---------|-----------|----------------|-------------|
| authRoutes.js | ~8 | ✅ Oui | Login, register, refresh, logout |
| adminRoutes.js | ~12 | ✅ Oui | Users CRUD, permissions, settings |
| vehicleRoutes.js | ~15 | ✅ Oui | Véhicules, réservations, calendrier |
| personnelRoutes.js | ~10 | ✅ Oui | Personnel, compétences, groupes |
| equipmentRoutes.js | ~20 | ✅ Partiel | CRUD, catégories, SAV, import |
| catalogRoutes.js | ~12 | ❌ Non | Catalogue, flightcases, trucks |
| stockRoutes.js | ~15 | ✅ Partiel | Items, catégories, mouvements |
| inventoryRoutes.js | ~10 | ❌ Non | Opérations inventaire, ABC, export |
| affaireRoutes.js | ~15 | ✅ Partiel | Affaires, devis, documents |
| planningRoutes.js | ~12 | ✅ Partiel | Planning, récurrences, templates |
| tasksRoutes.js | ~10 | ✅ Oui | Tâches, assignations, statuts |
| ordersRoutes.js | ~18 | ✅ Partiel | Commandes, lignes, fournisseurs |
| supplierCatalogRoutes.js | ~8 | ❌ Non | Catalogues fournisseurs |
| messagingRoutes.js | ~10 | ✅ Oui | Messages, SSE, fichiers |
| leavesRoutes.js | ~8 | ✅ Oui | Demandes congés, approbation |
| displayRoutes.js | ~15 | ❌ Non | TV config, événements, GIFs |
| sonosRoutes.js | ~12 | ❌ Non | Sonos proxy (play, pause, volume) |
| cameraRoutes.js | ~8 | ❌ Non | Caméras NVR, streams |
| annuaireRoutes.js | ~10 | ✅ Partiel | Contacts, import CSV |
| settingsRoutes.js | ~5 | ✅ Oui | Paramètres app |
| import-backup.js | ~3 | ❌ Non | Import/restore DB |
| healthRoutes.js | ~2 | N/A | Health check |

### 3.2 Problèmes identifiés — Backend

| # | Problème | Sévérité | Fichier(s) |
|---|----------|----------|------------|
| B1 | **6 fichiers routes sans aucune validation Zod** : catalogRoutes, inventoryRoutes, supplierCatalogRoutes, displayRoutes, sonosRoutes, cameraRoutes | 🔴 Critique |  |
| B2 | **Gestion d'erreurs incohérente** : certaines routes renvoient `{ error: msg }`, d'autres `{ message: msg }`, d'autres encore `{ success: false, error: msg }` | 🟠 Élevé | Tous |
| B3 | **console.log x17 dans import-backup.js** — pas de logger structuré | 🟠 Élevé | import-backup.js |
| B4 | **Pas de middleware de logging des requêtes** (morgan ou équivalent) | 🟠 Élevé | server.js |
| B5 | **Dead code** dans adminRoutes.js (~L375, ~L542) | 🟡 Moyen | adminRoutes.js |
| B6 | **Magic numbers** dans displayRoutes.js (570, 720, 780, 1080 — résolutions TV) | 🟡 Moyen | displayRoutes.js |
| B7 | **Duplication patterns CRUD** sur 15+ fichiers : chaque route réimplémente get/list/create/update/delete | 🟡 Moyen | Tous les routes |
| B8 | **Inconsistance nommage** : mix camelCase / snake_case dans les payloads API | 🟡 Moyen | Plusieurs |
| B9 | **Pas de pagination** sur certains endpoints list (retournent tout) | 🟡 Moyen | catalogRoutes, displayRoutes |
| B10 | **Bcrypt synchrone** sur certains chemins d'authentification | 🟡 Moyen | authRoutes.js |
| B11 | **Session invalidation on permission change** : modifier les permissions d'un utilisateur force sa déconnexion | 🟡 Moyen | adminRoutes.js |
| B12 | **Pas de cache** sur les requêtes fréquentes (listes, configs) | 🟢 Bas | Plusieurs |
| B13 | **Silent catch blocks** ~10 instances (erreurs avalées) | 🟢 Bas | Plusieurs |
| B14 | **Code commenté** ~5 blocs restants | 🟢 Bas | Plusieurs |

### 3.3 Middleware chain

```
CORS → Helmet → JSON parser → Cookie parser → Rate limiter → Auth JWT → Admin check
```

| Middleware | Status | Note |
|-----------|--------|------|
| CORS | ✅ Configuré | Origins restrictives |
| Helmet | ✅ Actif | Headers sécurité |
| Rate limiter | ✅ Actif | Limite par IP |
| JWT httpOnly | ✅ Implémenté | Cookies sécurisés |
| Zod validation | ⚠️ Partiel | 25+ routes couvertes, 6 fichiers sans |
| Error handler global | ⚠️ Basique | Pas de format unifié |
| Request logging | ❌ Absent | Aucun morgan/winston |

---

## 4. FRONTEND (React + Vite)

### 4.1 Inventaire des composants

| Catégorie | Nombre | Localisation |
|-----------|--------|-------------|
| Design System (atoms/molecules/organisms) | 44 | `components/ui/` |
| Composants desktop métier | 131+ | `components/*/` |
| Composants mobile | 42 | `components/mobile/` |
| Composants Sonos | 12 | `components/sonos/` + mobile |
| Composants TV | 0 (standalone) | `apps/tv-client/` |
| **Total** | **~229+** | |

### 4.2 Composants surdimensionnés (> 500 lignes)

| Composant | Lignes | Sévérité | Domaine |
|-----------|--------|----------|---------|
| EquipmentPanel.jsx | **3 166** | 🔴 Critique | Équipement |
| Calendar.jsx | **2 744** | 🔴 Critique | Véhicules |
| OrdersPanel.jsx | **2 621** | 🔴 Critique | Commandes |
| TaskPlanningPanel.jsx | **2 592** | 🔴 Critique | Planning |
| PersonnelPanel.jsx | **2 152** | 🟠 Élevé | Personnel |
| AffaireDetailPanel.jsx | **2 143** | 🟠 Élevé | Affaires |
| ReservationModal.jsx | **1 738** | 🟠 Élevé | Véhicules |
| AnnuairePanel.jsx | **1 247** | 🟡 Moyen | Annuaire |
| Header.jsx | **1 101** | 🟡 Moyen | Layout |

**Total** : 9 fichiers de plus de 1000 lignes — **~17 500 lignes concentrées**

### 4.3 Problèmes identifiés — Frontend

| # | Problème | Sévérité | Détail |
|---|----------|----------|--------|
| F1 | **5 composants "monstres" > 2500 lignes** : EquipmentPanel, Calendar, OrdersPanel, TaskPlanningPanel, PersonnelPanel | 🔴 Critique | Logique métier + UI + état dans un seul fichier |
| F2 | **State management par Context API + prop drilling** — pas de state manager global | 🟠 Élevé | Chaque panel gère son propre état indépendamment |
| F3 | **~130 inline styles `style={{}}`** restants | 🟡 Moyen | ~558 dynamiques (acceptables), ~130 statiques à migrer |
| F4 | **Headers.jsx (1101 lignes)** combine : navigation, notifications, recherche globale, profil, thème, métriques | 🟡 Moyen | Trop de responsabilités |
| F5 | **Lazy loading** uniquement pour MobileApp — les modules desktop sont chargés d'un bloc | 🟡 Moyen | Bundle size impacté |
| F6 | **~50 magic values** dans le JSX (tailles, délais, seuils) | 🟡 Moyen | Dispersés dans le code |
| F7 | **Dead code** : GoogleCalendarBanner.jsx ~L974 | 🟢 Bas | Code mort identifié |
| F8 | **~5 imports inutilisés** restants | 🟢 Bas | Mineur |

### 4.4 Patterns de code

| Pattern | Utilisé | Qualité |
|---------|---------|---------|
| Hooks customs (useSonos, useTheme, useMessagingSSE, useSwipeBack) | ✅ Oui | ✅ Bon |
| API service layer (12 modules dans utils/api/) | ✅ Oui | ✅ Bon |
| Error Boundary | ✅ Oui | 🟡 Inline styles |
| Code splitting (lazy) | ⚠️ Partiel | Mobile uniquement |
| Memoization (useMemo/useCallback) | ⚠️ Partiel | Pas systématique |
| Design System barrel import | ✅ Oui | ✅ Bien centralisé |

---

## 5. BASE DE DONNÉES (SQLite)

### 5.1 Métriques

| Métrique | Valeur |
|----------|--------|
| Tables | 84 |
| Colonnes totales | ~2 100+ |
| Index | 50+ |
| Données seedées | 180+ enregistrements |
| Domaines fonctionnels | 15 |
| Mode | WAL (Write-Ahead Logging) |
| Foreign Keys | ✅ Activées |

### 5.2 Problèmes identifiés — Base de données

| # | Problème | Sévérité | Détail |
|---|----------|----------|--------|
| D1 | **Foreign keys manquantes** : `vehicles.assigned_to` ne référence aucune table, `missions.affaire` n'a pas de FK vers affaires | 🟠 Élevé | Intégrité référentielle partielle |
| D2 | **Duplication données employés** : table `persons` (annuaire) ET `drivers` (conducteurs) avec données redondantes (nom, prénom, téléphone) | 🟠 Élevé | Risque de désynchronisation |
| D3 | **Table task_assignments surdimensionnée** : 50 colonnes dans une seule table | 🟠 Élevé | Dénormalisation excessive |
| D4 | **`equipment_id` nullable** dans `maintenances` — une maintenance sans équipement n'a pas de sens | 🟡 Moyen | Contrainte métier manquante |
| D5 | **Dénormalisation clients/fournisseurs** : adresse, téléphone, email stockés à plat au lieu de tables séparées | 🟡 Moyen | Schema rigide |
| D6 | **Colonnes `location` legacy** dans `equipment` (freetext) coexistent avec `location_depot/zone/floor/code` structurées | 🟡 Moyen | Double stockage |
| D7 | **Pas de versioning de schema** (pas de migration tool type knex/prisma) — migrations via scripts SQL ad hoc | 🟡 Moyen | Risque de drift |
| D8 | **`import_code`, `import_serial`, `import_name`** dans `sav_tickets` — champs d'import temporaires jamais nettoyés | 🟢 Bas | Cruft |
| D9 | **Pas de soft delete** généralisé — certaines tables ont `is_active`, d'autres non | 🟢 Bas | Inconsistance pattern |
| D10 | **`stock_items` a 30+ colonnes** après extension inventory-v1 — certaines redondantes avec `equipment` | 🟢 Bas | Overlap fonctionnel |

### 5.3 Cartographie des 84 tables par domaine

| Domaine | Tables | Clé |
|---------|--------|-----|
| Véhicules | vehicles, vehicle_types, vehicle_documents, reservations, reservation_vehicles, vehicle_inspections | FK cascade ✅ |
| Personnel | persons, drivers, person_competences, competence_types, personnel_groups | Duplication persons↔drivers ⚠️ |
| Équipement | equipment, equipment_catalog, equipment_categories, equipment_assignments, equipment_lists, equipment_to_vehicle | Bien structuré ✅ |
| Stock | stock_items, stock_categories, stock_movements, inventory_locations, inventory_price_history, inventory_anomalies, inventory_stats_cache | Complet ✅ |
| Affaires | affaires, affaire_documents, affaire_phases, devis | Bon ✅ |
| Planning | events, recurrent_events, event_templates, planning_versions, color_rules, task_assignments | task_assignments 50 cols ⚠️ |
| Commandes | orders, order_lines, order_templates, supplier_catalogs, suppliers | Bon ✅ |
| Messagerie | messages, message_attachments, conversations | Bon ✅ |
| Congés | leave_requests, leave_balances | Bon ✅ |
| Affichage TV | display_config, display_messages, display_gifs | Bon ✅ |
| Sonos | sonos_config | 1 table ✅ |
| Vidéo | cameras, nvr_config | Bon ✅ |
| Auth | users, authorized_emails, sessions | Bon ✅ |
| SAV | sav_tickets, sav_attachments | Champs import legacy ⚠️ |
| Flightcases/3D | flightcases, truck_models | Bon ✅ |

---

## 6. CLIENT TV (Vanilla JS)

### 6.1 Métriques

| Fichier | Lignes | Rôle |
|---------|--------|------|
| main.js | ~900 | Logique complète (widgets, data, animation) |
| styles.css | ~800 | Styles TV spécifiques |
| index.html | ~100 | Shell HTML |
| manifest.json | ~20 | Config PWA |

### 6.2 Constats

| # | Constat | Type |
|---|---------|------|
| T1 | **XSS protection robuste** : `escapeHtml()` via `textContent`, validation URL sneaky photos | ✅ Force |
| T2 | **Token auth via URL param `?token=`** — visible dans l'historique navigateur et logs serveur | ⚠️ Risque |
| T3 | **Token refresh silencieux** toutes les 6h | ✅ Bien |
| T4 | **Alarme SNCF** : joue un son + flash rouge — fonctionnalité métier spécifique | 📝 Note |
| T5 | **main.js monolithique** (900 lignes) — pas de modules, tout dans un seul fichier | 🟡 Moyen |
| T6 | **Pas de build step** — JS/CSS servis directement | 🟡 Moyen |
| T7 | **CSS responsive TV** bien fait (overscan, tailles texte, grilles) | ✅ Force |
| T8 | **Pas de tests** pour le client TV | 🟡 Moyen |
| T9 | **Pas de gestion offline** — si l'API est down, l'écran est vide | 🟡 Moyen |
| T10 | **Couleurs hardcodées** : `#00e1ff`, palettes badge type inline | 🟡 Moyen |

---

## 7. INTERFACE MOBILE

### 7.1 Métriques

| Métrique | Valeur |
|----------|--------|
| Composants JSX | 42 |
| Fichiers CSS | 42+ (co-localisés) |
| Lignes JSX estimées | ~3 500+ |
| Lignes CSS estimées | ~1 500+ |
| Shell principal | MobileApp.jsx (350 lignes) |

### 7.2 Fonctionnalités mobiles

| Feature | Implémenté | Qualité |
|---------|-----------|---------|
| Détection mobile (UA + touch + screen) | ✅ | ✅ Robuste |
| Swipe-back (hook dédié) | ✅ | ✅ Bien |
| Pull-to-refresh | ✅ | ✅ Bien |
| Safe area (notch iPhone) | ✅ | ✅ Bien |
| Dynamic viewport (100dvh) | ✅ | ✅ Bien |
| QR Code scan → navigation | ✅ | ✅ Innovant |
| Momentum scroll iOS | ✅ | ✅ Bien |
| Swipeable rows | ✅ | ✅ Bien |
| Touch gestures (pan map) | ✅ | ✅ Bien |

### 7.3 Problèmes identifiés — Mobile

| # | Problème | Sévérité | Détail |
|---|----------|----------|--------|
| M1 | **App mobile complètement séparée du desktop** — pas de responsive, 2 arbres de composants distincts | 🟠 Élevé | MobileApp.jsx est un shell entièrement indépendant |
| M2 | **Routing par `useState('home')`** au lieu d'un vrai router (react-router) — pas de bookmarks, pas de back browser | 🟠 Élevé | `setCurrentScreen('equipment')` — hash partiel pour QR |
| M3 | **MobileApp.css monolithique ~1000+ lignes** — tous les styles de tous les écrans dans un fichier | 🟡 Moyen | Plus des CSS co-localisés par module |
| M4 | **Pas de skeleton loading** — les écrans flashent blanc pendant le chargement | 🟡 Moyen | Pull-to-refresh existe mais pas de placeholder |
| M5 | **Détection mobile par User-Agent** — fragile, ne couvre pas les tablettes modernes correctement | 🟡 Moyen | Regex `/Android|webOS|iPhone|iPad|...` |
| M6 | **Pas de tests** pour les composants mobile | 🟡 Moyen | 0 test sur 42 composants |
| M7 | **Pas de mode offline / service worker fonctionnel** pour le mobile | 🟡 Moyen | `sw-cleanup.js` dans public — SW nettoyé, pas remplacé |

---

## 8. MODULE SONOS

### 8.1 Architecture

| Élément | Détail |
|---------|--------|
| Hook partagé | `useSonos()` — polling 5s, actions play/pause/next/prev/volume |
| Desktop | SonosPanel (3-colonnes), 8 sous-composants |
| Mobile | MobileSonos + wrappers tactiles, réutilise `useSonos` |
| Backend | sonosRoutes.js — proxy vers Sonos HTTP API |

### 8.2 Constats

| # | Constat | Type |
|---|---------|------|
| S1 | **Hook partagé desktop/mobile** — zéro duplication logique | ✅ Force |
| S2 | **Polling 5s** au lieu de WebSocket/SSE — charge serveur proportionnelle au nombre de clients | 🟡 Moyen |
| S3 | **Pas de validation Zod** sur sonosRoutes.js | 🟠 Élevé |
| S4 | **Pas de gestion d'erreur** si le Sonos est injoignable — UI silencieuse | 🟡 Moyen |
| S5 | **Pas de tests** pour useSonos ni les composants Sonos | 🟡 Moyen |

---

## 9. DESIGN SYSTEM & CSS

### 9.1 État du Design System

| Métrique | Valeur | Appréciation |
|----------|--------|-------------|
| Composants DS | 44 | ✅ Complet |
| Tests DS | 34/34 (100%) | ✅ Exemplaire |
| Adoption DS dans features | ~60-70% | 🟡 En progrès |
| Tokens CSS définis | 80+ | ✅ Bon |
| Variables couleur | ~25 | ✅ Bien structuré |
| Variables typographie | ~8 | ✅ Bon |
| Variables espacement | ~6 | ✅ Bon |
| Variables z-index | ~7 | ✅ Hiérarchie claire |
| Variables rayon | ~4 | ✅ Bon |

### 9.2 Problèmes CSS identifiés

| # | Problème | Sévérité | Détail |
|---|----------|----------|--------|
| C1 | **Couleurs hexadécimales brutes** dans InventoryPanel.css : `rgba(255,152,0,0.15)`, `#2a6cb5`, `#7b1fa2` | 🟠 Élevé | Non tokenisées |
| C2 | **~130 inline styles statiques** restants (sur 24 composants) | 🟡 Moyen | Migrés partiellement (commit 02dd1c2) |
| C3 | **Fallbacks CSS variables imbriqués** : `var(--text-primary, var(--theme-text-primary))` | 🟡 Moyen | AnnuairePanel.css, ContactsCSVImportDialog.css |
| C4 | **Font-size hardcodées** : `0.82rem`, `1.15rem`, `0.65rem` dans AnnuairePanel.css | 🟡 Moyen | Devraient être `var(--font-*)` |
| C5 | **3 z-index hardcodés** : `z-index: 20` (AnnuairePanel), `z-index: 25` (App.css), `z-index: 100` (MobileApp.css) | 🟡 Moyen | Hors hiérarchie tokens |
| C6 | **ErrorBoundary.jsx** avec styles inline en `px` hardcodés | 🟡 Moyen | `fontSize: '18px'`, `padding: '10px'` |
| C7 | **~510 hex restants** après migration Phase D (non-sémantiques / fallbacks) | 🟢 Bas | Résidu acceptable à court terme |

### 9.3 Score CSS

| Critère | Score |
|---------|-------|
| Design System Adoption | A (44/44 composants, usage ~65%) |
| CSS Variable Coverage | A- (92%) |
| Z-Index Management | C+ (hiérarchie OK, 3 anomalies) |
| Inline Styles | B+ (dynamiques acceptables, statiques à finir) |
| Typography | B (tokens définis, quelques brutes) |

---

## 10. UX/UI

### 10.1 Accessibilité

| Métrique | Valeur | Appréciation |
|----------|--------|-------------|
| Attributs `aria-*` | ~145 | ✅ Bon |
| Attributs `role` | ~85 | ✅ Bon |
| `aria-label` sur boutons icône | ✅ Systématique | ✅ |
| `role="dialog"` sur modales | ✅ Oui | ✅ |
| `aria-modal="true"` | ✅ Oui | ✅ |
| `tabIndex={0}` sur cliquables | ✅ Oui | ✅ |

**Lacunes :**

| # | Problème | Sévérité |
|---|----------|----------|
| U1 | **Pas de `aria-pressed`** sur les toggles/boutons toggle | 🟡 Moyen |
| U2 | **Pas de `aria-live`** sur les notifications/toasts dynamiques | 🟡 Moyen |
| U3 | **Pas de skip-to-content** link | 🟢 Bas |
| U4 | **Contraste non vérifié** en mode sombre | 🟢 Bas |

### 10.2 Problèmes UX identifiés

| # | Problème | Sévérité | Détail |
|---|----------|----------|--------|
| U5 | **Composants "tout-en-un"** : EquipmentPanel (3166L) combine liste, détail, édition, filtres, import, SAV dans un même écran | 🔴 Critique | Surcharge cognitive pour l'utilisateur |
| U6 | **Navigation mobile par state** — pas de URL, pas de retour arrière navigateur natif | 🟠 Élevé | L'utilisateur perd sa position si il rafraîchit la page |
| U7 | **Flash "Chargement..."** lors des actions (corrigé sur UserManagement, mais potentiellement ailleurs) | 🟡 Moyen | Pattern `loadData(true)` non généralisé |
| U8 | **Session invalidée sur changement de permissions** — l'admin qui modifie les droits d'un utilisateur peut causer sa déconnexion | 🟡 Moyen | Signalé dans le backend aussi |
| U9 | **Pas de feedback visuel sur la sauvegarde** dans certains formulaires (pas de toast de confirmation) | 🟡 Moyen | Inconsistant entre modules |
| U10 | **Pas de mode "compact"** sur les grosses listes — affichage identique pour 5 ou 500 éléments | 🟢 Bas | Performance et lisibilité |

---

## 11. SÉCURITÉ

### 11.1 État actuel

| Contrôle | Status | Détail |
|----------|--------|--------|
| JWT httpOnly cookies | ✅ | Secure, SameSite |
| Bcrypt passwords | ✅ | Rounds = 10 |
| Rate limiting | ✅ | Par IP |
| Helmet headers | ✅ | CSP, HSTS, etc. |
| CORS restrictif | ✅ | Origins whitelist |
| Zod validation | ⚠️ 60% | 6 fichiers sans |
| XSS TV client | ✅ | escapeHtml() |
| SQL Injection | ✅ | Parameterized (corrigé Phase A) |
| File upload validation | ⚠️ | Type check basique |
| Admin middleware | ✅ | requireAdmin |

### 11.2 Problèmes sécurité restants

| # | Problème | Sévérité | Détail |
|---|----------|----------|--------|
| SEC1 | **6 fichiers routes sans validation d'entrée** (catalogRoutes, inventoryRoutes, supplierCatalogRoutes, displayRoutes, sonosRoutes, cameraRoutes) | 🟠 Élevé | Données non validées passent directement en DB |
| SEC2 | **Token TV dans URL** : `?token=xxx` visible dans URL bar, logs serveur, historique | 🟡 Moyen | Devrait être header-only |
| SEC3 | **displayRoutes.js `GET /api/display/welcome-message`** sans auth (identifié précédemment) | 🟡 Moyen | Endpoint public non intentionnel |
| SEC4 | **Upload fichiers** : validation de type MIME basique, pas de scanning de contenu | 🟡 Moyen | messagingRoutes, affaireRoutes |
| SEC5 | **Pas de CSP granulaire** pour les images/scripts externes (OpenWeather, album art Sonos) | 🟢 Bas | Helmet defaults |

---

## 12. TESTS & CI

### 12.1 Couverture

| Domaine | Tests | Suites | Couverture |
|---------|-------|--------|-----------|
| Design System | 355 | 34 | **100%** (34/34 composants) |
| Frontend features | 45 | 3 | **~5%** (3/131 composants) |
| Frontend mobile | 0 | 0 | **0%** (0/42 composants) |
| Backend API | 85 | 14 | **~40%** estimé |
| Client TV | 0 | 0 | **0%** |
| Sonos | 0 | 0 | **0%** |
| **Total** | **485** | **51** | |

### 12.2 CI/CD

| Outil | Status | Détail |
|-------|--------|--------|
| Husky pre-commit | ✅ | ESLint --quiet + vitest run + npm test |
| ESLint | ✅ | 0 errors, 9 warnings (no-console dans logger.js) |
| Prettier | ✅ | Configuré |
| Stylelint | ✅ | Configuré |
| GitHub Actions | ❌ | Pas de CI/CD automatisé |
| Deploy | ✅ | `safe-deploy.sh` + PM2 |
| Smoke test | ⚠️ | Peut donner faux négatifs après restart PM2 |

### 12.3 Problèmes tests

| # | Problème | Sévérité |
|---|----------|----------|
| TS1 | **0% couverture frontend feature** (EquipmentPanel, Calendar, OrdersPanel, etc.) | 🔴 Critique |
| TS2 | **0% couverture mobile** (42 composants non testés) | 🟠 Élevé |
| TS3 | **0% couverture TV client et Sonos** | 🟡 Moyen |
| TS4 | **Pas de tests E2E** (Playwright, Cypress) | 🟡 Moyen |
| TS5 | **Pas de CI/CD GitHub Actions** — tests uniquement en pre-commit local | 🟡 Moyen |
| TS6 | **Pas de test de régression DB** (migrations) | 🟢 Bas |

---

## 13. SCORE GLOBAL CONSOLIDÉ

### Par domaine

| Domaine | Score | Évolution vs audit précédent (C+ 62%) |
|---------|-------|---------------------------------------|
| Architecture & Structure | **B+ (78%)** | ↑ Stable |
| Backend API | **B- (68%)** | ↑ +6% (Zod ajouté) |
| Frontend (code) | **C+ (62%)** | → Stable |
| Frontend (composants) | **D+ (45%)** | → 5 monstres non traités |
| Base de données | **B (72%)** | → Stable |
| Client TV | **B- (65%)** | ↑ +15% (XSS fixé) |
| Mobile | **C (55%)** | → Nouveau constat |
| Sonos | **B (70%)** | → Nouveau constat |
| Design System | **A- (88%)** | ↑ +20% (44 composants, 100% testés) |
| CSS | **B+ (78%)** | ↑ +15% (tokens, migration) |
| UX/UI | **B- (65%)** | → Nouveau constat |
| Sécurité | **B+ (80%)** | ↑ +10% (SQL fixé, Zod partiel) |
| Tests | **C- (48%)** | ↑ +10% (DS 100%, features ~0%) |
| CI/CD | **C (55%)** | → Husky OK, pas de GitHub Actions |

### Score global

```
╔══════════════════════════════════════════╗
║                                          ║
║   SCORE GLOBAL :  B-  (67/100)           ║
║                                          ║
║   Précédent :     C+  (62/100)           ║
║   Évolution :     ↑ +5 points            ║
║                                          ║
╚══════════════════════════════════════════╝
```

### Répartition

```
Architecture    ████████████████░░░░  78%
Backend         █████████████░░░░░░░  68%
Frontend code   ████████████░░░░░░░░  62%
Frontend comp.  █████████░░░░░░░░░░░  45%
Database        ██████████████░░░░░░  72%
TV Client       █████████████░░░░░░░  65%
Mobile          ███████████░░░░░░░░░  55%
Sonos           ██████████████░░░░░░  70%
Design System   █████████████████░░░  88%
CSS             ████████████████░░░░  78%
UX/UI           █████████████░░░░░░░  65%
Sécurité        ████████████████░░░░  80%
Tests           ██████████░░░░░░░░░░  48%
CI/CD           ███████████░░░░░░░░░  55%
```

---

## 14. INVENTAIRE DES PROBLÈMES PAR SÉVÉRITÉ

### 🔴 CRITIQUE (7)

| # | Problème | Domaine |
|---|----------|---------|
| F1 | 5 composants "monstres" > 2500 lignes | Frontend |
| B1 | 6 fichiers routes sans validation Zod | Backend |
| U5 | Composants tout-en-un — surcharge cognitive | UX |
| TS1 | 0% couverture tests features principales | Tests |
| — | EquipmentPanel.jsx (3166L) | Frontend |
| — | Calendar.jsx (2744L) | Frontend |
| — | OrdersPanel.jsx (2621L) | Frontend |

### 🟠 ÉLEVÉ (13)

| # | Problème | Domaine |
|---|----------|---------|
| B2 | Gestion d'erreurs incohérente (formats différents) | Backend |
| B3 | console.log x17 dans import-backup.js | Backend |
| B4 | Pas de middleware de logging requêtes | Backend |
| D1 | Foreign keys manquantes (vehicles.assigned_to, missions.affaire) | Database |
| D2 | Duplication données persons ↔ drivers | Database |
| D3 | task_assignments — 50 colonnes | Database |
| M1 | App mobile totalement séparée du desktop | Mobile |
| M2 | Routing mobile par useState (pas de router) | Mobile |
| F2 | State management par Context + prop drilling | Frontend |
| S3 | Pas de validation Zod sur sonosRoutes | Sonos |
| SEC1 | 6 fichiers routes sans validation d'entrée | Sécurité |
| TS2 | 0% couverture mobile (42 composants) | Tests |
| C1 | Couleurs hex brutes dans InventoryPanel.css | CSS |

### 🟡 MOYEN (27)

| # | Problème | Domaine |
|---|----------|---------|
| B5-B11 | Dead code, magic numbers, duplication CRUD, nommage, pagination, bcrypt sync, session invalidation | Backend |
| D4-D7 | equipment_id nullable, dénormalisation, double location, pas de migration tool | Database |
| M3-M7 | CSS mobile monolithique, pas de skeleton, UA detection fragile, pas de tests, pas d'offline | Mobile |
| F3-F6 | Inline styles, Header.jsx trop gros, lazy loading partiel, magic values | Frontend |
| T5-T10 | main.js monolithique, pas de build, pas de tests TV, pas d'offline, couleurs hardcodées | TV |
| S2,S4,S5 | Polling 5s, pas de gestion erreur Sonos, pas de tests | Sonos |
| C2-C6 | Inline styles statiques, fallbacks imbriqués, font-size brutes, z-index hardcodé, ErrorBoundary | CSS |
| U1-U2,U7-U9 | aria-pressed manquant, aria-live absent, flash chargement, session, feedback sauvegarde | UX |
| SEC2-SEC4 | Token TV URL, endpoint public, upload MIME | Sécurité |
| TS3-TS5 | Tests TV/Sonos, pas d'E2E, pas de CI GitHub | Tests |

### 🟢 BAS (12)

| # | Problème | Domaine |
|---|----------|---------|
| B12-B14 | Pas de cache, silent catch, code commenté | Backend |
| D8-D10 | Champs import legacy, soft delete inconsistant, overlap stock/equipment | Database |
| F7-F8 | Dead code GoogleCalendar, imports inutilisés | Frontend |
| C7 | ~510 hex restants (résidu Phase D) | CSS |
| U3-U4,U10 | Pas de skip-to-content, contraste mode sombre, pas de mode compact | UX |
| SEC5 | CSP non granulaire | Sécurité |
| TS6 | Pas de test régression DB | Tests |

---

## RÉSUMÉ EXÉCUTIF

**eM@g est un projet mature et fonctionnel** couvrant 15 domaines métier avec ~100 000 lignes de code. Le Design System (44 composants, 100% testés) et la sécurité (JWT, Helmet, Zod partiel, XSS protégé) sont des points forts notables.

**Les principaux axes d'amélioration** se concentrent sur :
1. **5 composants géants** (>2500 lignes chacun) qui concentrent 17 500 lignes de code monolithique
2. **Couverture de tests faible** sur les fonctionnalités principales (DS 100%, features ~0%)
3. **6 fichiers routes sans validation** d'entrée
4. **Architecture mobile** séparée du desktop sans partage de layout
5. **Incohérences de schéma DB** (FK manquantes, duplications, dénormalisations)

> ⚠️ **Aucune solution n'est proposée dans cet audit.** Ce document est un constat factuel. Les étapes suivantes (Design System, Plan de Refonte, Roadmap) seront abordées séparément après validation.

---

*Audit réalisé le 14 avril 2026 — Branche `feature/sonos-full-gui` — Commit `a150ca1`*
