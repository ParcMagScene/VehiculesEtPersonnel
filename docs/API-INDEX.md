# 📇 Index API Global — eM@g

> Référence exhaustive de toute la documentation interne du projet eM@g.
> Équivalent d'une API Reference (type Swagger) pour la documentation.
>
> **Dernière mise à jour** : Avril 2026
> **Fichiers indexés** : 16 fichiers Markdown dans `docs/`

---

## Table des matières

- [1. Architecture & Backend](#1-architecture--backend)
- [2. Base de données](#2-base-de-données)
- [3. API — Catalogue des routes](#3-api--catalogue-des-routes)
- [4. Modules fonctionnels](#4-modules-fonctionnels)
- [5. Frontend](#5-frontend)
- [6. Sécurité & Audit](#6-sécurité--audit)
- [7. Guides](#7-guides)
- [8. Opérations & Maintenance](#8-opérations--maintenance)
- [9. Spécifications](#9-spécifications)
- [10. Changelog](#10-changelog)
- [Matrice des dépendances](#matrice-des-dépendances)
- [Glossaire](#glossaire)

---

## 1. Architecture & Backend

📄 **Source** : [01-Architecture/ARCHITECTURE.md](01-Architecture/ARCHITECTURE.md)

| Section | Anchor | Contenu clé |
|---------|--------|-------------|
| Vue d'ensemble | [§1](01-Architecture/ARCHITECTURE.md#1-vue-densemble) | 14 modules métier, architecture globale |
| Stack technique | [§2](01-Architecture/ARCHITECTURE.md#2-stack-technique) | React 18, Vite 6, Express.js ESM, SQLite, JWT |
| Structure des dossiers | [§3](01-Architecture/ARCHITECTURE.md#3-structure-des-dossiers) | Monorepo `apps/api`, `apps/web`, `apps/tv-client` |
| Architecture Backend | [§4](01-Architecture/ARCHITECTURE.md#4-architecture-backend) | Express, 18 fichiers routes, middlewares, `.env` |
| Architecture Frontend | [§5](01-Architecture/ARCHITECTURE.md#5-architecture-frontend) | App.jsx, code splitting, IndexedDB (12 stores), API client (15 modules, ~375 méthodes) |
| Déploiement & infrastructure | [§14](01-Architecture/ARCHITECTURE.md#14-déploiement--infrastructure) | PM2, Raspberry Pi, Dynamic DNS, ports 3002/4173 |
| Design System | [§15](01-Architecture/ARCHITECTURE.md#15-design-system) | Variables CSS, tokens, thèmes |
| Cache Backend | [§16](01-Architecture/ARCHITECTURE.md#16-cache-backend) | LRU/TTL, invalidation automatique |
| Performance (Phase 4) | [§17](01-Architecture/ARCHITECTURE.md#17-performance-phase-4) | Batch queries, index SQL |
| Conventions de code | [§18](01-Architecture/ARCHITECTURE.md#18-conventions-de-code) | Imports ESM, style, nommage |
| Diagramme des relations | [§19](01-Architecture/ARCHITECTURE.md#19-diagramme-des-relations) | Diagramme ER complet |

---

## 2. Base de données

📄 **Source** : [01-Architecture/ARCHITECTURE.md — §6](01-Architecture/ARCHITECTURE.md#6-base-de-données)

**Moteur** : SQLite (better-sqlite3) — **92 tables** — Fichier : `apps/api/db.sqlite3`

| Groupe de tables | Nombre | Détail |
|------------------|:------:|--------|
| Personnel & Congés | 9 | `persons`, `person_competences`, `leave_requests`, `leave_balances`… |
| Catalogue & Équipements | 8 | `catalog_items`, `catalog_categories`, `equipment_items`, `equipment_kits`… |
| Stock & Commandes | 5 | `stock_movements`, `orders`, `order_items`, `suppliers`… |
| Communication | 13 | `communication_events`, `communication_tasks`, `planning_*`… |
| Dashboard TV | 13 | `display_screens`, `display_playlists`, `display_events`… |
| Messagerie | 4 | `conversations`, `messages`, `conversation_participants`… |
| Affaires | 4 | `affaires`, `affaire_documents`, `affaire_items`… |
| Complémentaires | 16 | `vehicles`, `reservations`, `maintenances`, `active_sessions`… |

→ Voir aussi : [Migrations automatiques](01-Architecture/ARCHITECTURE.md#6-base-de-données), [Audit DB](02-Securite/AUDIT.md)

---

## 3. API — Catalogue des routes

📄 **Source** : [01-Architecture/ARCHITECTURE.md — §7](01-Architecture/ARCHITECTURE.md#7-api--catalogue-des-routes)

**Total** : ~431 routes réparties sur 18 fichiers

| Module API | Préfixe | Routes | Fichier backend |
|------------|---------|:------:|-----------------|
| Authentification | `/api/auth` | 5 | `authRoutes.js` |
| Véhicules | `/api/vehicles` | 4 | `vehicleRoutes.js` |
| Réservations | `/api/reservations` | 4 | (dans routes.js) |
| Maintenances | `/api/maintenances` | 4 | (dans routes.js) |
| Personnel | `/api/persons` | 6+ | `personnelRoutes.js` |
| Congés | `/api/leaves` | 5 | `leaveRoutes.js` |
| Catalogue | `/api/catalog` | 7 | `catalogRoutes.js` |
| Équipements | `/api/equipment` | 8 | `equipmentRoutes.js` |
| Stock | `/api/stock` | 4 | `stockRoutes.js` |
| Commandes | `/api/orders` | 4 | `ordersRoutes.js` |
| Communication | `/api/communication` | 7 | (dans routes.js) |
| Mailing | `/api/mailing` | 4 | `mailingRoutes.js` |
| Messagerie | `/api/messages` | 4 | `messagingRoutes.js` |
| Affaires | `/api/affaires` | — | `affairesRoutes.js` |
| Pièces jointes | `/api/attachments` | 4 | `attachmentsRoutes.js` |
| Annuaire | `/api/annuaire` | — | `annuaireRoutes.js` |
| Inventaire | `/api/inventory` | — | `inventoryRoutes.js` |
| Administration | `/api/admin` | 5 | `adminRoutes.js` |
| Vidéo | `/api/video` | — | `videoRoutes.js` |
| Planning | `/api/planning` | — | `planningRoutes.js` |
| Display TV | `/api/display` | — | `displayRoutes.js` |
| Google Calendar | `/api/google-calendar` | — | `googleCalendarRoutes.js` |
| Fournisseurs | `/api/supplier-catalog` | — | `supplierCatalogRoutes.js` |
| Profil | `/api/profile` | — | `profileRoutes.js` |
| Santé | `/api/health` | 1 | `server.js` (GET — vérifie DB, uptime, retourne 503 si erreur) |

→ Codes d'erreur : `400` Bad Request, `401` Unauthorized, `403` Forbidden, `404` Not Found, `409` Conflict, `500` Internal Server Error

### 3.1 Routes dépréciées (legacy)

Ces routes restent fonctionnelles pour rétrocompatibilité mais émettent un avertissement dans les logs. Elles seront supprimées dans une version majeure future.

| Préfixe legacy | Remplacement | Fichier |
|----------------|--------------|----------|
| `/api/clients` | `/api/annuaire/clients` | `routes.js` → `annuaireRoutes.js` |
| `/api/drivers` | `/api/annuaire` (table `persons`) | `routes.js` → `annuaireRoutes.js` |
| `/api/locations` | `/api/annuaire/locations` | `routes.js` → `annuaireRoutes.js` |
| `/api/garages` | `/api/annuaire/garages` | `routes.js` → `annuaireRoutes.js` |

> **Action** : migrer tous les appels frontend vers les routes `/api/annuaire/*` avant suppression.

---

## 4. Modules fonctionnels

📄 **Source** : [01-Architecture/ARCHITECTURE.md — §8-12](01-Architecture/ARCHITECTURE.md#8-modules-fonctionnels)

| Module | Section | Points clés |
|--------|---------|-------------|
| Calendrier | [§8](01-Architecture/ARCHITECTURE.md#8-modules-fonctionnels) | 4 vues (jour/semaine/mois/année), sync Google Calendar |
| Véhicules | §8 | Photos multi, fiches, carte |
| Maintenance | §8 | Types (préventive/curative), auto-transition statuts |
| Personnel | §8 | Compétences, missions, affectations |
| Congés | §8 | Demandes, solde, planning conflits |
| Affaires | §8 | Dossiers, PJ, import BL (Bons de Livraison) |
| Messagerie | §8 | Conversations, notifications temps réel |
| Communication | §8 | Événements, planning tâches |
| Dashboard TV | §8 | 21 composants, écrans configurables, playlists |
| Mon Espace | §8 | Espace personnel utilisateur |
| Mailing | §8 | Templates, campagnes |
| Stock | §8 | Mouvements, inventaire |
| Commandes | §8 | Fournisseurs, bon de commande |
| Mobile | §8 | 16 vues PWA |
| Annuaire | §8 | Clients, fournisseurs, contacts |
| Catalogue & Équipements | [§9](01-Architecture/ARCHITECTURE.md#9-module-catalogue--équipements) | Individualisation, kits, multi-dépôt |
| Localisation multi-dépôt | [§10](01-Architecture/ARCHITECTURE.md#10-localisation-multi-dépôt) | Dépôt → Étage → Zone → Code, 2 dépôts |
| Deep Linking 3D | [§11](01-Architecture/ARCHITECTURE.md#11-deep-linking--chargement-3d) | Protocole `chargement3d://`, 3 actions |
| Synchronisation inventaire | [§12](01-Architecture/ARCHITECTURE.md#12-synchronisation-inventaire) | Import CSV/XLSX → catalogue |

---

## 5. Frontend

📄 **Source** : [01-Architecture/ARCHITECTURE.md — §5](01-Architecture/ARCHITECTURE.md#5-architecture-frontend)

| Composant | Détail |
|-----------|--------|
| **App.jsx** | Point d'entrée, lazy loading, gestion onglets |
| **Code splitting** | ~30 composants lazy-loaded |
| **Cache IndexedDB** | 12 stores (vehicles, persons, reservations…) |
| **API Client** | 15 modules, ~375 méthodes dans `apps/web/src/api/` |
| **Design System** | Variables CSS, tokens — [§15](01-Architecture/ARCHITECTURE.md#15-design-system) |

---

## 6. Sécurité & Audit

### 6.1 Politique de sécurité

📄 **Source** : [02-Securite/SECURITY.md](02-Securite/SECURITY.md)

| Section | Contenu |
|---------|---------|
| Versions supportées | v2.x actif, v1.x maintenance |
| Vulnérabilités connues | xlsx (HIGH — Prototype Pollution, ReDoS), esbuild/vite (MODERATE — SSRF dev) |
| Pratiques implémentées | Prepared statements, JWT httpOnly, bcrypt, rate limiting, CORS, Helmet, permissions granulaires |
| Procédure mises à jour | `npm audit`, cycle 6 étapes sécurisé |
| Signalement | Email admin@example.com, 30 jours divulgation coordonnée |

### 6.2 Audit technique

📄 **Source** : [02-Securite/AUDIT.md](02-Securite/AUDIT.md) (~2858 lignes)

| Partie | Contenu |
|--------|---------|
| **Partie I** — Audit Juillet 2025 | 16 sections : résumé exécutif, architecture, inventaire, sécurité, DB, backend, performance, frontend, CSS, a11y, UX, modules, plan corrections, migrations SQL, design system, annexes |
| **Partie II** — Audit Mars 2026 | Post-monorepo, correctifs appliqués |
| Chiffres clés | 3 P0 critiques, 5 P1 hauts, 12 P2 moyens |

### 6.3 Authentification

📄 **Source** : [01-Architecture/ARCHITECTURE.md — §13](01-Architecture/ARCHITECTURE.md#13-authentification--sécurité)

| Mécanisme | Détail |
|-----------|--------|
| JWT | Token dans cookie httpOnly `auth_token`, algorithme HS256 |
| Silent Refresh | Endpoint `POST /api/auth/refresh` — [spec](06-Changelog/SilentRefresh.md) |
| Hachage | bcrypt (cost factor 10) |
| Sessions | Table `active_sessions`, purge automatique |
| Rate limiting | express-rate-limit sur `/api/auth/*` |
| Permissions | `is_admin`, `can_manage_catalog`, `can_manage_equipment`… |

---

## 7. Guides

| Guide | Source | Public cible |
|-------|--------|-------------|
| Guide utilisateur | [03-Guides/GUIDE_UTILISATEUR.md](03-Guides/GUIDE_UTILISATEUR.md) | Utilisateurs finaux — connexion, modules, rôles, dépannage |
| Guide développeur | [03-Guides/GUIDE_DEVELOPPEUR.md](03-Guides/GUIDE_DEVELOPPEUR.md) | Développeurs — installation, `.env`, `npm run dev:start`, déploiement, branches Git |

---

## 8. Opérations & Maintenance

| Document | Source | Contenu |
|----------|--------|---------|
| Checklist production | [04-Operations/CHECKLIST_PRODUCTION.md](04-Operations/CHECKLIST_PRODUCTION.md) | 7 sections : tests auto, vérifs manuelles, sécurité, DB, config, déploiement, post-déploiement |
| Plan maintenance | [04-Operations/PLAN_MAINTENANCE.md](04-Operations/PLAN_MAINTENANCE.md) | Cycles mensuel (nettoyage, sécurité), trimestriel (performance), par merge (documentation), procédures urgence |

### Commandes clés

```bash
# Santé rapide
npm run lint && npm run build && npm run test:all && npm audit --audit-level=high

# Dev
npm run dev:start          # Backend + Frontend en parallèle

# Production
npm run deploy             # Build + déploiement via safe-deploy.sh
pm2 status                 # Statut PM2
```

---

## 9. Spécifications

📄 **Index** : [05-Specs/README.md](05-Specs/README.md)

### Specs futures (🔴)

| Spec | Source | Résumé |
|------|--------|--------|
| Annotations PDF + ViT | [Annotations_PDF_ViT.md](05-Specs/Annotations_PDF_ViT.md) | Surlignage automatique de BP, Vision Transformer pour détection kits |
| Module Vidéo WebRTC | [MODULE_VIDEO.md](05-Specs/MODULE_VIDEO.md) | Caméras RTSP→WebRTC, PTZ, snapshots, enregistrement |
| Thème VS Code | [MODE_VS_CODE.md](05-Specs/MODE_VS_CODE.md) | UI reproduisant VS Code (dark/light), zéro ombre, Cascadia Code |

### Prompts & Directives

| Document | Source | Résumé |
|----------|--------|--------|
| Directives Audit | [Directives_Audit.md](05-Specs/Directives_Audit.md) | Prompt Copilot pour audit technique complet (5 étapes, 4 niveaux sévérité) |
| Réorganisation Monorepo | [Reorganisation_Monorepo.md](05-Specs/Reorganisation_Monorepo.md) | Spec migration `server/` → `apps/api/` (✅ réalisée) |
| Documentation API | [DOC_API.md](05-Specs/DOC_API.md) | Prompt pour génération de cet index (✅ exécuté) |

---

## 10. Changelog

| Feature | Source | Statut |
|---------|--------|--------|
| Silent JWT Refresh | [06-Changelog/SilentRefresh.md](06-Changelog/SilentRefresh.md) | ✅ Implémenté — endpoint `/api/auth/refresh`, hook `useSilentRefresh()`, IndexedDB persistence |

---

## Matrice des dépendances

Quels documents référencent quels autres :

```
ARCHITECTURE.md ──→ (référence centrale, pas de dépendance sortante)
SECURITY.md     ──→ ARCHITECTURE.md (section sécurité), AUDIT.md
AUDIT.md        ──→ ARCHITECTURE.md (historique)
GUIDE_UTILISATEUR ──→ ARCHITECTURE.md, SECURITY.md, GUIDE_DEVELOPPEUR
GUIDE_DEVELOPPEUR ──→ ARCHITECTURE.md
CHECKLIST_PROD  ──→ PLAN_MAINTENANCE, SECURITY.md, ARCHITECTURE.md, GUIDE_DEVELOPPEUR
PLAN_MAINTENANCE ──→ CHECKLIST_PROD, ARCHITECTURE.md, SECURITY.md, AUDIT.md
SilentRefresh   ──→ ARCHITECTURE.md (auth)
```

---

## Glossaire

| Terme | Signification |
|-------|---------------|
| **BL** | Bon de Livraison — document de livraison fournisseur |
| **BP** | Bon de Prestation — document de prestation/location fournisseur |
| **CRUD** | Create, Read, Update, Delete |
| **JWT** | JSON Web Token — mécanisme d'authentification |
| **PWA** | Progressive Web App — application mobile via navigateur |
| **ViT** | Vision Transformer — modèle IA de détection d'objets |
| **WebRTC** | Web Real-Time Communication — protocole vidéo/audio temps réel |
| **RTSP** | Real-Time Streaming Protocol — flux vidéo caméras |
| **PM2** | Process Manager 2 — gestionnaire de processus Node.js |
| **WAL** | Write-Ahead Logging — mode journalisation SQLite |
| **Dynamic DNS** | Service DNS dynamique (configurable) |
| **Flugtcase** | Flight case — caisse de transport pour équipement événementiel |

---

> **Maintenance** : Cet index doit être mis à jour à chaque ajout ou modification significative d'un fichier `.md` dans `docs/`.
> Voir la section B du [prompt DOC_API](05-Specs/DOC_API.md) pour les directives de maintenance.
