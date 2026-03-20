# AUDIT TECHNIQUE eM@g — Document Unifié

> Ce document consolide les deux audits techniques réalisés sur eM@g :
> - **Partie I** — Audit Complet Architectural (Juillet 2025) — 16 sections couvrant architecture, sécurité, DB, backend, frontend, CSS, a11y, UX, modules métier, migrations SQL, design system
> - **Partie II** — Audit Post-Monorepo (Mars 2026) — Findings détaillés avec diffs correctifs (18 CRIT, 22 HIGH, 19 MED, 12 LOW)

---

## TABLE DES MATIÈRES GLOBALE

### Partie I — Audit Complet Architectural (Juillet 2025)
Voir sections 1 à 16 ci-dessous.

### Partie II — Audit Post-Monorepo (Mars 2026)
Voir la section dédiée en fin de document.

---
---

# PARTIE I — AUDIT COMPLET ARCHITECTURAL

> **Date** : Juillet 2025  
> **Auditeur** : Copilot (Claude Opus 4.6)  
> **Périmètre** : Frontend React, Backend Express, SQLite, CSS, Sécurité, Performance, Accessibilité, UX, Modules métier  
> **Total lignes source** : ~138 500 (250+ fichiers)  
> **Méthodologie** : Analyse statique exhaustive de 100% des fichiers source, 0% de code modifié

---

## TABLE DES MATIÈRES

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Architecture globale](#2-architecture-globale)
3. [Inventaire chiffré](#3-inventaire-chiffré)
4. [Audit sécurité](#4-audit-sécurité)
5. [Audit base de données](#5-audit-base-de-données)
6. [Audit backend](#6-audit-backend)
7. [Audit performance](#7-audit-performance)
8. [Audit frontend React](#8-audit-frontend-react)
9. [Audit CSS / Design System](#9-audit-css--design-system)
10. [Audit accessibilité (a11y)](#10-audit-accessibilité-a11y)
11. [Audit UX / Responsive / Mobile](#11-audit-ux--responsive--mobile)
12. [Audit modules métier](#12-audit-modules-métier)
13. [Plan de corrections priorisé](#13-plan-de-corrections-priorisé)
14. [Migrations SQL idempotentes](#14-migrations-sql-idempotentes)
15. [Design System unifié — Tokens manquants](#15-design-system-unifié--tokens-manquants)
16. [Annexes](#16-annexes)

---

## 1. RÉSUMÉ EXÉCUTIF

### Verdict global

eM@g est une application métier **fonctionnellement riche** qui couvre 14 modules (véhicules, personnel, affaires, équipements, commandes, stock, congés, planning, communication, messagerie, mailing, annuaire, display TV, mobile PWA). Le projet est développé par une équipe réduite et a atteint un périmètre fonctionnel remarquable.

### Forces principales
- ✅ **Sécurité SQL exemplaire** : 100% des requêtes utilisent des prepared statements (0 injection SQL possible)
- ✅ **Architecture frontend moderne** : React 18 + lazy loading + design system CSS variables
- ✅ **Backend performant** : SQLite WAL + LRU cache + rate limiting
- ✅ **PWA mobile complète** : 16 vues dédiées + service worker
- ✅ **Déploiement robuste** : safe-deploy.sh avec rollback automatique

### Risques critiques identifiés

| Priorité | Problème | Impact |
|----------|----------|--------|
| 🔴 **P0** | Chaîne d'attaque reset password (prise de contrôle compte) | Sécurité |
| 🔴 **P0** | Path traversal sur endpoint public (lecture fichier arbitraire) | Sécurité |
| 🔴 **P0** | `/api/auth/users` sans auth (fuite emails/noms) | Sécurité |
| 🔴 **P0** | 6 DROP TABLE `task_assignments` à chaque démarrage | Intégrité |
| 🔴 **P1** | N+1 queries sur 4 endpoints critiques (×50-150 queries) | Performance |
| 🔴 **P1** | Transactions manquantes sur congés (4 ops non-atomiques) | Intégrité |
| 🟡 **P2** | 0 tests automatisés, 0 TypeScript, 0 PropTypes | Maintenabilité |
| 🟡 **P2** | 52 fichiers CSS sans dark mode, 192 !important | UX |

### Chiffres clés

| Métrique | Valeur | Évaluation |
|----------|--------|------------|
| Vulnérabilités critiques | **3** | 🔴 À corriger immédiatement |
| Vulnérabilités hautes | **5** | 🟠 Sous 2 semaines |
| Vulnérabilités moyennes | **12** | 🟡 Sous 1 mois |
| Tests automatisés | **0** | 🔴 Aucune couverture |
| Couverture TypeScript | **0%** | 🟡 Risque maintenabilité |
| Couverture ARIA (a11y) | **5%** | 🔴 Non conforme WCAG |
| Couverture dark mode CSS | **25%** | 🟡 Incomplète |

---

## 2. ARCHITECTURE GLOBALE

```
                         ┌──────────────────────────────────────┐
                         │         CLIENTS                      │
                         │  Desktop (React SPA, port 5174)      │
                         │  Mobile (PWA, /mobile)               │
                         │  Dashboard TV (DisplayDashboard)     │
                         └──────────────┬───────────────────────┘
                                        │ HTTP / Vite Proxy
                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXPRESS.JS (port 3003 dev / 3002 prod)           │
│  Rate Limiter │ CORS Whitelist │ Security Headers │ JWT Auth       │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              15 FICHIERS DE ROUTES (18 902 lignes)            │  │
│  │  server.js · routes.js · personnelRoutes · catalogRoutes      │  │
│  │  equipmentRoutes · communicationRoutes · displayRoutes        │  │
│  │  annuaireRoutes · leaveRoutes · ordersRoutes · stockRoutes    │  │
│  │  mailingRoutes · messagingRoutes · emailService · logger      │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
│                              ▼                                      │
│  SQLite (better-sqlite3) — WAL mode — ~83 tables — 30+ migrations │
│  Multer (uploads) │ Nodemailer (mailing) │ PDFKit │ PM2 (prod)     │
└─────────────────────────────────────────────────────────────────────┘

FRONTEND REACT : App.jsx → Header + 14 modules lazy-loaded
  ├─ Calendar.jsx (2 760 l.) — Calendrier véhicules
  ├─ PersonnelPanel.jsx (2 391 l.) — Personnel, compétences, missions
  ├─ EquipmentPanel.jsx (2 372 l.) — Parc matériel individualisé
  ├─ AffairesPanel + AffaireDetailPanel — Affaires projets
  ├─ TaskPlanningPanel.jsx (2 326 l.) — Planning tâches jour/semaine
  ├─ OrdersPanel.jsx (1 691 l.) — Commandes fournisseurs
  ├─ StockPanel.jsx — Stock
  ├─ AnnuairePanel.jsx — Annuaire unifié
  ├─ CommunicationPanel.jsx — Notes, événements, BL
  ├─ DisplayDashboardPanel.jsx — Dashboard TV (21 sous-composants)
  ├─ MessagingPanel.jsx — Messagerie interne
  ├─ MailingPanel.jsx — Templates email + envoi groupé
  ├─ ManagementPanel.jsx — Admin (users, import, config)
  └─ MobileApp.jsx — PWA mobile (16 vues)
```

### Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Frontend | React + Vite | 18.3.1 / 5.4.21 |
| Backend | Node.js + Express | 22.18.0 / 4.18 |
| Base de données | SQLite (better-sqlite3) | WAL mode |
| Authentification | JWT + bcrypt | SHA-256 hash en DB |
| Déploiement | PM2 | Cron restart 6h |
| Domaine | DuckDNS | magsav.duckdns.org |
| Reverse proxy | Non documenté | HTTP → HTTPS supposé |

---

## 3. INVENTAIRE CHIFFRÉ

| Catégorie | Fichiers | Lignes |
|-----------|----------|-------:|
| Backend (server/) | 17 | 18 902 |
| Routes API | 12 fichiers | 12 720 |
| server.js (monolithe) | 1 | 3 116 |
| database.js (schéma) | 1 | 3 146 |
| Composants JSX (desktop) | 83 | ~42 000 |
| Composants JSX (mobile) | 16 | ~5 410 |
| Composants JSX (DisplayDashboard) | 21 | ~10 410 |
| CSS composants | 90 | 56 857 |
| CSS globaux (App/theme/index) | 4 | 3 851 |
| Utilitaires (utils/) | 14 | 4 678 |
| Hooks + Contextes | 7 | 391 |
| api.js (client API) | 1 | 1 977 |
| **TOTAL** | **~250** | **~138 500** |

| Métrique technique | Valeur |
|--------------------|--------|
| Tables SQLite | **83** |
| Index DB | **70+** |
| Routes API (endpoints) | **671** |
| Méthodes API client (api.js) | **~370** |
| Variables CSS (theme.css) | **~160** |
| Palettes de thème | 7 |
| Stores IndexedDB | 12 |
| Migrations SQL (formelles + inline) | **30+** |
| Dépendances production (frontend) | 7 |
| Dépendances production (backend) | ~15 |

---

## 4. AUDIT SÉCURITÉ

### 4.1 Vulnérabilités CRITIQUES

#### [CRIT-1] Chaîne d'attaque reset password — Prise de contrôle de compte

**Chaîne d'exploitation complète en 3 étapes :**

```
1. GET  /api/auth/users                        → Obtient emails + noms (SANS auth)
2. POST /api/auth/self-reset-password {email,name} → Active password_reset_required=1
3. POST /api/auth/set-new-password {email,pwd}     → Définit nouveau mot de passe
4. POST /api/auth/login {email,pwd}                → JWT valide 30 jours
```

| Étape | Endpoint | Auth requise | Fichier |
|-------|----------|-------------|---------|
| 1 | `GET /api/auth/users` | **AUCUNE** | server.js ~L547 |
| 2 | `POST /api/auth/self-reset-password` | **AUCUNE** (email+nom) | server.js ~L355 |
| 3 | `POST /api/auth/set-new-password` | **AUCUNE** (email+pwd) | server.js ~L1906 |

**Impact** : N'importe qui sur Internet peut prendre le contrôle de n'importe quel compte utilisateur.

**Remédiation** : Implémenter un vrai flux OTP par email avec token signé temporaire (15min). Protéger `/api/auth/users` par authentification.

#### [CRIT-2] Path Traversal — Lecture fichier arbitraire (endpoint PUBLIC)

```javascript
// displayRoutes.js L1456-L1463 — AUCUNE authentification
app.get('/api/display/gifs/:filename', (req, res) => {
    const filePath = join(gifsDir, req.params.filename); // ← PAS de sanitisation
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);  // ← lecture fichier arbitraire
    }
});
```

**Exploitation** : `GET /api/display/gifs/../../.env` → lit le fichier `.env` avec les secrets.

**2ème occurrence** (DELETE, auth requise mais vulnérable) : displayRoutes.js ~L991 — suppression de fichier arbitraire via `fs.unlinkSync(join(gifsDir, req.params.filename))`.

**Remédiation** : Appliquer `sanitizePath()` (déjà implémenté dans server.js L250 pour les attachments) sur tous les `req.params.filename`.

#### [CRIT-3] `/api/auth/users` sans authentification

```javascript
// server.js L547 — AUCUN middleware authenticateToken
app.get('/api/auth/users', (req, res) => {
    const stmt = db.prepare('SELECT id, email, name, avatar FROM users ORDER BY name');
    const users = stmt.all();
    res.json(users.map(u => ({
      id: u.id, email: u.email, name: u.name, avatar: u.avatar || null
    })));
});
```

**Impact** : Fuite de tous les emails et noms d'utilisateurs. Facilite phishing, énumération, et brute-force. Pré-requis de CRIT-1.

---

### 4.2 Vulnérabilités HAUTES

| ID | Vulnérabilité | Fichier | Détail |
|----|---------------|---------|--------|
| HIGH-1 | **Pas de Content-Security-Policy** | server.js | Aucun en-tête CSP → XSS possible via injection de script |
| HIGH-2 | **Aucune sanitization XSS serveur** | Tous les routes | Noms, messages, descriptions stockés sans échappement → XSS stocké possible |
| HIGH-3 | **Mot de passe SMTP en clair en DB** | database.js ~L1109 | `email_config.smtp_pass` non chiffré. Si DB compromise → email compromis |
| HIGH-4 | **JWT_SECRET dev hardcodé et versionné** | .env.development | `JWT_SECRET=dev-secret-key-not-for-production` → forgerie de tokens si mode dev en prod |
| HIGH-5 | **Upload BL PDF sans limite de taille** | server.js ~L2790 | Multer sans `limits.fileSize` → DoS par upload massif |

---

### 4.3 Vulnérabilités MOYENNES

| ID | Vulnérabilité | Fichier | Détail |
|----|---------------|---------|--------|
| MED-1 | Énumération d'emails (`check-email`, `check-reset`) | server.js | Révèle si un email existe |
| MED-2 | `application/octet-stream` autorisé dans uploads | server.js multer | Contourne validation MIME |
| MED-3 | JWT expiration 30 jours sans refresh token | server.js ~L58 | Fenêtre d'exploitation longue |
| MED-4 | Sessions expirées jamais nettoyées | server.js | Accumulation infinie en DB |
| MED-5 | `last_activity` jamais mis à jour sur sessions | database.js | Timeout d'inactivité impossible |
| MED-6 | Pas de helmet (seulement headers manuels) | server.js | CSP, X-Permitted-Cross-Domain absents |
| MED-7 | DB permissions 644 (world-readable) | server/ | Tout utilisateur système peut lire la base |
| MED-8 | Mixed HTTP/HTTPS dans CORS origins | server.js ~L83 | Tokens peuvent transiter en clair |
| MED-9 | CORS `origin: null` autorisé | server.js ~L88 | Requêtes curl/Postman passent |
| MED-10 | Uploads par extension et non par MIME | displayRoutes, equipmentRoutes | Fichier malveillant renommable en .jpg |
| MED-11 | Copie données prod → dev dans dev-start.sh | scripts/dev-start.sh | Passwords hashés, emails en dev |
| MED-12 | Pas de backup automatisé de la DB | — | Aucun script de backup en place |

---

### 4.4 Inventaire des endpoints non protégés

| Endpoint | Méthode | Fichier | Risque |
|----------|---------|---------|--------|
| `/api/auth/users` | GET | server.js | 🔴 **CRITIQUE** — fuite utilisateurs |
| `/api/auth/self-reset-password` | POST | server.js | 🔴 Chaîne CRIT-1 |
| `/api/auth/set-new-password` | POST | server.js | 🔴 Chaîne CRIT-1 |
| `/api/auth/check-reset` | POST | server.js | 🟡 Fuite info reset |
| `/api/access-requests` | POST | server.js | 🟢 Normal (inscription) |
| `/api/access-requests/check-email` | POST | server.js | 🟡 Énumération emails |
| `/api/display/welcome-message` | GET | displayRoutes | 🟢 Public (écran TV) |
| `/api/display/sneaky-photo/status` | GET | displayRoutes | 🟢 Public (écran TV) |
| `/api/display/sneaky-message/status` | GET | displayRoutes | 🟢 Public (écran TV) |
| `/api/display/weather` | GET | displayRoutes | 🟢 Public (écran TV) |
| `/api/display/sonos-now-playing` | GET | displayRoutes | 🟢 Public (écran TV) |
| `/api/display/gifs/:filename` | GET | displayRoutes | 🔴 **PATH TRAVERSAL** |

---

### 4.5 Points positifs sécurité

- ✅ **100% prepared statements** SQLite — 795 appels `db.prepare` tous paramétrés (0 injection SQL)
- ✅ **bcrypt** 10 salt rounds pour tous les mots de passe
- ✅ `sanitizePath()` correctement utilisé pour les attachments (server.js L250-255)
- ✅ Rate limiting auth : 20 req/15min login, 600 req/min API globale
- ✅ WAL mode + `synchronous = FULL` + checkpoint auto toutes les 5min
- ✅ Token hash SHA-256 en DB (pas le JWT brut en base)
- ✅ 6 headers de sécurité manuels (X-Content-Type-Options, X-Frame-Options, HSTS, etc.)
- ✅ Guard JWT secret par défaut en production (process.exit si non changé)
- ✅ DOMPurify utilisé sur les `dangerouslySetInnerHTML`
- ✅ Validation SIRET/TVA regex dans l'annuaire
- ✅ Nettoyage fichiers temporaires auto (>24h toutes les 6h)
- ✅ `isValidAffaireId()` avec validation regex
- ✅ `.gitignore` correct : `.env`, `node_modules`, `*.db`, `backups/` exclus
- ✅ `.env.development` versionné mais avec secret dev explicite (`not-for-production`)

---

## 5. AUDIT BASE DE DONNÉES

### 5.1 Vue d'ensemble

| Métrique | Valeur |
|----------|--------|
| Tables | ~83 |
| Index | 70+ |
| DB mode | WAL, `synchronous = FULL`, `foreign_keys = ON` |
| Checkpoint | Auto toutes les 5 min + graceful shutdown |
| Migrations formelles (migrations_log) | 17 |
| Migrations inline (ALTER TABLE try/catch) | 27 sans vérification |
| DROP/CREATE table (task_assignments) | 6 occurrences |

### 5.2 Index manquants critiques

| Sévérité | Table | Colonnes | Justification |
|----------|-------|----------|---------------|
| 🔴 | `active_sessions` | `token_hash` | Chaque requête auth scanne toute la table |
| 🔴 | `active_sessions` | `expires_at` | Nettoyage sessions = full scan |
| 🔴 | `reservations` | `vehicle_id, start_date, end_date` | Détection conflits = full scan |
| 🔴 | `reservations` | `status` | Filtre omniprésent |
| 🟡 | `maintenances` | `vehicle_id, status, date` | Suivi véhicule |
| 🟡 | `modification_history` | `entity_type, entity_id` | Audit trail |
| 🟡 | `access_requests` | `status` | Filtre admin |
| 🟢 | `mail_history` | `sent_by, status` | Historique envois |
| 🟢 | `bl_imports` | `affaire_id` | Recherche BL par affaire |

### 5.3 FK sans ON DELETE (20+ cas)

Tables affectées : `vehicles`, `reservations` (5 FK), `clients`, `drivers`, `locations`, `garages`, `maintenances` (3 FK), `conversations`, `conversation_participants`, `messages`, `equipment`, `reservation_requests` (3 FK), `supplier_documents` (2 FK).

**Risque** : `FOREIGN KEY constraint failed` si suppression d'un parent → erreur 500 en prod.

| Action recommandée | FK type |
|-------------------|---------|
| `ON DELETE SET NULL` | `created_by`, `modified_by`, `assigned_to` |
| `ON DELETE RESTRICT` | Relations métier (commandes → items, affaires → BL) |
| `ON DELETE CASCADE` | Relations de composition (conversation → messages) |

### 5.4 FK logiques non déclarées

| Table | Colonne | Devrait référencer |
|-------|---------|-------------------|
| `bl_imports` | `created_by` | users(id) |
| `bl_imports` | `affaire_id` | affaires(numero_affaire) |
| `mail_history` | `template_id` | mail_templates(id) |
| `material_requests` | `supplier_id`, `affaire_id`, `order_id` | respectifs |
| `completion_alerts` | `recipient_id` | users(id) |
| `annuaire_contacts` | `entity_id` | Polymorphe sans FK formelle |

### 5.5 Incohérence Affaire ID — Double identifiant

La table `affaires` a **deux identifiants** :
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `numero_affaire TEXT NOT NULL UNIQUE`

**Problème** : `affaire_links` utilise l'`id` INTEGER avec FK propres, mais **toutes les autres tables** (`task_assignments`, `bl_imports`, `dynamic_display_events`, `material_requests`, `planning_hidden_affaires`) stockent le `numero_affaire` dans un champ nommé `affaire_id TEXT`, sans FK formelle.

### 5.6 Incohérence clés primaires TEXT vs INTEGER

| Type PK | Tables |
|---------|--------|
| TEXT (UUID/hex) | `vehicles`, `reservations`, `maintenances`, `dynamic_display_events`, `task_assignments`, `equipment_catalog`, `flightcases`, `truck_models`, `equipment_to_vehicle`, `bl_imports` |
| INTEGER AUTO | Tout le reste (~70+ tables) |

**Impact** : Les JOINs sur TEXT PK sont ~15-30% plus lents que sur INTEGER.

### 5.7 BOOLEAN sans CHECK constraint

Dizaines de colonnes `BOOLEAN DEFAULT 0` sans `CHECK(col IN (0,1))` : `is_admin`, `is_location`, `is_immobilized`, `is_recurring`, etc. Rien n'empêche l'insertion de valeurs > 1.

### 5.8 Migrations non idempotentes — 27 ALTER TABLE risqués

Sur 75+ `ALTER TABLE ADD COLUMN`, **27 n'ont pas de vérification** (`pragma table_info`) ni de `try/catch`. Si la colonne existe déjà → crash au démarrage.

### 5.9 task_assignments DROP/CREATE — CRITIQUE

La table `task_assignments` est **DROP → CREATE 6 fois** dans database.js pour modifier les CHECK constraints de `section` et `source_type`. À chaque démarrage :

1. CREATE TABLE `_new` avec nouveau schema
2. INSERT INTO `_new` SELECT FROM ancien
3. DROP TABLE original
4. RENAME `_new` → original

**Risques** :
- FK d'autres tables cassées lors du DROP
- Perte de données si crash entre DROP et RENAME
- Performance : 6 copies complètes de la table à chaque startup

### 5.10 Transactions manquantes sur opérations critiques

| Localisation | Opérations non-atomiques | Risque |
|-------------|-------------------------|--------|
| leaveRoutes `PUT /api/leaves/:id/decision` | UPDATE leave_requests → UPDATE leave_balances → UPDATE availabilities → INSERT leave_request_history (4 ops) | 🔴 Soldes congés incohérents |
| leaveRoutes `PUT /api/leaves/:id/cancel` | UPDATE + UPDATE + DELETE + INSERT (4 ops) | 🔴 Balance erronée |
| leaveRoutes `PUT /api/leaves/:id/sign` | UPDATE + INSERT (2 ops) | 🟡 Historique manquant |
| stockRoutes mouvements stock | UPDATE quantity + INSERT movement | 🟡 Stock incorrect |
| messagingRoutes envoi message | INSERT message + UPDATE conversation | 🟡 Message sans conversation |

---

## 6. AUDIT BACKEND

### 6.1 Architecture — Monolithe serveur

| Fichier | Lignes | Endpoints | Rôle |
|---------|--------|-----------|------|
| server.js | 3 116 | ~100 | Auth, véhicules, affaires, reservations, config |
| communicationRoutes.js | 2 298 | 97 | Planning, BL, tâches, iCal — **trop gros** |
| ordersRoutes.js | 1 367 | 89 | Commandes, devis, demandes matériel |
| personnelRoutes.js | 1 337 | 66 | Personnel, compétences, missions |
| leaveRoutes.js | 1 337 | 54 | Congés, soldes, validations |
| displayRoutes.js | 1 466 | 89 | Dashboard TV, médias, playlists |
| equipmentRoutes.js | 1 299 | 61 | Matériel, SAV, listes |
| annuaireRoutes.js | 1 069 | 56 | Clients, fournisseurs, contacts |
| catalogRoutes.js | 775 | 53 | Catalogue matériel |
| routes.js | 672 | 44 | Routes legacy véhicules |
| stockRoutes.js | 433 | 30 | Stock, mouvements |
| messagingRoutes.js | 368 | 17 | Messagerie interne |
| mailingRoutes.js | 299 | 15 | Templates email, envoi |
| **TOTAL** | **12 720** | **671** | |

### 6.2 Anti-patterns backend

#### Double système client — CRITIQUE

Deux ensembles de routes opèrent sur la **même table `clients`** :

| Système | Fichier | Champs gérés | Utilisé par |
|---------|---------|--------------|-------------|
| Legacy | routes.js L7-64 | 4 champs (name, email, phone, address) | ManagementPanel, OrdersPanel, App.jsx |
| Annuaire | annuaireRoutes.js L100-160 | 20 champs (+ siret, tva, city, postal_code...) | AnnuairePanel |

**Risque** : Un client créé via ManagementPanel n'a aucun champ enrichi. Les deux INSERT sont incompatibles.

#### db.prepare() non mis en cache

**100% des `db.prepare(...)` sont appelés à l'intérieur des route handlers** à chaque requête. `better-sqlite3` a un cache interne qui atténue l'impact, mais externaliser les statements en `const` module-level éliminerait l'overhead de lookup (~5-15% sur routes chaudes).

#### Pas de couche service

La logique métier est directement dans les route handlers. Aucune séparation modèle/service/contrôleur. Rend les tests unitaires impossibles et la duplication inévitable.

#### Pattern CRUD dupliqué 4×

`annuaireRoutes.js` — 4× le même pattern CRUD pour clients, fournisseurs, prestataires, contacts. Candidat pour une factory/générique.

#### Génération numéro séquentiel dupliquée

Génération de numéros type `BC-2026-001` dupliquée en 3+ endroits dans `ordersRoutes.js`.

### 6.3 N+1 Queries — 4 patterns critiques

| Endpoint | Fichier | Pattern | Queries pour 50 items |
|----------|---------|---------|----------------------|
| `GET /api/persons` | personnelRoutes L17-28 | `persons.map(p => skillsStmt.all(p.id))` | **51** |
| `GET /api/missions` | personnelRoutes L880-900 | `missions.map(m → assignStmt → skillsStmt)` triple boucle | **61+** |
| `GET /api/leaves/balances` | leaveRoutes L952-962 | `persons.map(p => getOrCreateBalance(p.id))` (2-3 req chaque) | **100-150** |
| `GET /api/orders/bl/:affaireId` | ordersRoutes | items par commande dans for loop | **20+** |

**Remédiation type** (pour persons) :
```sql
SELECT p.*, GROUP_CONCAT(s.name) as skills 
FROM persons p 
LEFT JOIN person_skills ps ON ps.person_id = p.id 
LEFT JOIN skills s ON s.id = ps.skill_id 
GROUP BY p.id
```

### 6.4 Code mort

- **ReportsPanel.jsx** (848 lignes) : Module complet mais commenté dans App.jsx
- **api.js** : 3 méthodes mortes (`createGarage()`, `updateGarage()`, `deleteGarage()`)
- **src/utils/excelImport.js** (221 lignes) : Jamais importé
- **195 console.log/warn/error** en production

### 6.5 Déploiement (safe-deploy.sh)

| Étape | Action | Statut |
|-------|--------|--------|
| 1 | Backup `dist/` → `dist-backup/` | ✅ |
| 2 | `npm run build` | ✅ |
| 3 | Si échec → restaure `dist-backup/` | ✅ Rollback auto |
| 4 | Vérifie `dist/index.html` existe | ✅ |
| 5 | `pm2 restart` frontend + backend | ✅ |
| 6 | Supprime le backup | ⚠️ Pas de rollback post-deploy |

**Manquants** : Pas de tests avant deploy, pas de health check après restart, pas de backup DB avant deploy.

---

## 7. AUDIT PERFORMANCE

### 7.1 Cache LRU (server/cache.js)

| Instance | maxSize | TTL | Usage |
|----------|---------|-----|-------|
| `authCache` | 1000 | 30s | Tokens/sessions |
| `statsCache` | 100 | 20s | Endpoints `/stats` |
| `listCache` | 200 | 30s | Listes (véhicules, persons…) |
| `icalCache` | 50 | 5min | Flux iCal |
| `configCache` | 50 | 10min | Configuration |

| Problème | Impact |
|----------|--------|
| TTL très courts (20-30s) pour données peu volatiles | Cache inefficace — rechargements fréquents |
| `invalidateEntity()` invalide **tout** `statsCache` | Modifier un véhicule invalide stats congés/équipements |
| Pas d'invalidation automatique sur écriture | Données stale si oubli d'appel `invalidateEntity()` |
| Seul `communicationRoutes.js` utilise le cache (9 réf.) | 11/12 fichiers routes sans aucun cache |
| Pas de cache-warming au démarrage | Premières requêtes après restart = coût complet |

### 7.2 Optimisation SQL

#### `SELECT *` systématique — 100+ occurrences
Transfert de données inutiles, empêche les covering indexes. Exemples critiques :
- `SELECT * FROM vehicles ORDER BY order_index` (toute la flotte à chaque chargement)
- `SELECT * FROM affaires ORDER BY date_debut DESC` (sans LIMIT, toutes les affaires)

#### COUNT séquentiels (5 endpoints, ~22 queries remplaçables par 5)

| Endpoint | Queries actuelles | Remplacement |
|----------|-------------------|-------------|
| ordersRoutes `/stats` | 4 COUNT séquentiels | `SELECT status, COUNT(*) FROM material_requests GROUP BY status` |
| leaveRoutes `/stats` | 6 COUNT séquentiels | `SELECT status, COUNT(*), SUM(working_days) GROUP BY status` |
| equipmentRoutes `/sav/stats` | 4 COUNT séquentiels | `SELECT status, COUNT(*) FROM sav_tickets GROUP BY status` |
| displayRoutes `/stats` | 4 COUNT séquentiels | Combinable en 1-2 queries |
| annuaireRoutes `/stats` | 4 COUNT séquentiels | `UNION ALL` ou CTE |

#### `strftime()` dans les clauses WHERE
`WHERE strftime("%Y", start_date) = ?` → empêche l'utilisation d'index. Remplacer par `WHERE start_date >= '2024-01-01' AND start_date < '2025-01-01'`.

#### Absence de LIMIT sur endpoints de liste
`GET /api/vehicles`, `/api/affaires`, `/api/bl-imports`, `/api/display-media` — tous sans LIMIT. Acceptable tant que le volume est faible, mais risque de dégradation.

### 7.3 Bundle Frontend

**Configuration Vite (vite.config.js)** :
```js
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-pdf': ['pdfjs-dist'],
  'vendor-xlsx': ['xlsx'],
  'vendor-dates': ['date-fns'],
  'vendor-icons': ['lucide-react'],
  'vendor-qr': ['qrcode.react'],
}
```

| Problème | Sévérité |
|----------|----------|
| **Source maps en production** (`sourcemap: true`) — expose le code source | 🟡 Moyen |
| Pas de chunking des composants lourds (seuls vendors séparés) | 🟢 Faible |
| `PlanningView` et `GoogleCalendarBanner` (1459 l.) importés eagerly | 🟡 Moyen |

### 7.4 Risques de fuites mémoire

| Composant | Risque | Cleanup |
|-----------|--------|---------|
| GoogleCalendarBanner (1459 l., 8 refs) | `fetchTimeoutRef` et `renewalResolverRef` pendant OAuth | ⚠️ À vérifier |
| MobileApp polling interval | Interval recréé dans useEffect avec dépendances | ⚠️ Potentielle fuite |
| App.jsx (~40 useState) | Données accumulées sans purge | 🟢 Faible (jamais démonté) |
| **Majorité des composants** | cleanups corrects (clearInterval, removeEventListener) | ✅ |

---

## 8. AUDIT FRONTEND REACT

### 8.1 God Components

| Composant | useState | useEffect | Lignes | Verdict |
|-----------|---------|-----------|--------|---------|
| Calendar.jsx | 18 | 11 | 2 760 | **Décomposer** |
| PersonnelPanel.jsx | **48** | 9 | 2 391 | **Critique — useReducer** |
| EquipmentPanel.jsx | ~30 | 8 | 2 372 | **Décomposer** |
| TaskPlanningPanel.jsx | ~20 | 7 | 2 326 | Moyen |
| AffaireDetailPanel.jsx | ~25 | 6 | 1 964 | Moyen |
| ReservationModal.jsx | ~18 | 5 | 1 894 | Moyen |
| App.jsx | **44** | 10 | 1 468 | **useReducer + contextes** |

33 composants dépassent 500 lignes. Les 6 plus gros dépassent 2 000 lignes.

### 8.2 Gestion d'état

| Aspect | Statut |
|--------|--------|
| Contextes React | **1 seul** (NavigationContext) + ToastProvider |
| Prop drilling | **Massif** — Header reçoit 25 props, Calendar 22 props |
| State manager externe | **Aucun** (pas de Redux, Zustand, Jotai) |
| PropTypes / TypeScript | **0** — aucune validation de types |

### 8.3 Anti-patterns React

| Problème | Occurrences | Impact |
|----------|-------------|--------|
| `eslint-disable react-hooks/exhaustive-deps` | 7 | Bugs de stale closure |
| `key={index}` sur listes réordonnables | 15+ | Instabilité DOM |
| `dangerouslySetInnerHTML` | 1 (avec DOMPurify ✅) | Acceptable |
| `console.log/warn/error` restants en prod | **195** | Pollution console |
| `style={{}}` inline | **737** | Non-thématisable, non-cacheable |
| `onKeyPress` (déprécié) | 5 | ManagementPanel.jsx |

### 8.4 Points positifs frontend

- ✅ **24 composants lazy-loaded** (React.lazy + Suspense)
- ✅ **189 useMemo** + **244 useCallback** = bonne optimisation
- ✅ **39 React.memo** sur composants enfants
- ✅ **1 ErrorBoundary** au niveau racine avec UX française
- ✅ **7 dépendances prod uniquement** — bundle très lean
- ✅ `api.js` auto-conversion `snake_case → camelCase`
- ⚠️ 13 gros composants (>800 lignes) **sans** React.memo
- ⚠️ Aucun ErrorBoundary granulaire par module

---

## 9. AUDIT CSS / DESIGN SYSTEM

### 9.1 theme.css — Excellent système de tokens (~160 variables)

| Catégorie | Tokens | Dark mode |
|-----------|--------|-----------|
| Couleurs principales | 7 | ✅ |
| Dégradés | 4 | ✅ |
| Sémantiques (danger/success/info/warning) | ~30 | ✅ |
| Texte | 9 | ✅ |
| Backgrounds | 12 | ✅ |
| Bordures | 5 | ✅ |
| Boutons | ~25 | ✅ (partiel) |
| Ombres | 3-5 | ✅ |
| Transitions | 3 | N/A |
| Overlay | 2 | ✅ |

### 9.2 Tokens MANQUANTS — Impact élevé

| Catégorie | Statut | Conséquence |
|-----------|--------|-------------|
| **Spacing** (padding/margin/gap) | ❌ ABSENT | 100% hardcodé px/rem |
| **Border-radius** | ❌ QUASI-ABSENT | 30+ valeurs distinctes (3px à 50%) |
| **Typography** (size/height/weight) | ❌ ABSENT | 30+ tailles distinctes, mélange px/rem |
| **Z-index** | ❌ ABSENT | 26 valeurs de 0 à 99999, chaos complet |
| **Breakpoints** | ❌ ABSENT | 11 breakpoints différents utilisés |
| **Icon sizes** | ❌ ABSENT | Tailles hardcodées partout |

### 9.3 Indicateurs d'incohérence CSS

| Problème | Quantité | Sévérité |
|----------|----------|----------|
| `!important` | **192** | 🔴 Conflits de spécificité |
| `style={{}}` inline | **737** | 🔴 Non-thématisable |
| Couleurs hex hardcodées (hors theme.css) | **~379** | 🟡 Migration incomplète |
| CSS Modules (`*.module.css`) | **0** | 🟡 Architecture flat CSS |
| Fichiers CSS > 1000 lignes | 6 | 🟡 Maintenabilité |
| Animations `@keyframes` dupliquées | `spin` ×6, `slideUp` ×3, `fadeIn` ×3 | 🟡 Centraliser dans theme.css |

### 9.4 Dark mode — Couverture 25%

| Module | CSS | Dark mode | Statut |
|--------|-----|-----------|--------|
| Véhicules/Calendar | Calendar.css | ✅ | OK |
| Personnel | PersonnelPanel.css | ❌ | **Manquant** |
| Affaires | AffairesPanel.css + AffaireDetailPanel.css | ❌ | **Manquant** |
| Équipements | EquipmentPanel.css | ✅ | OK |
| Planning | TaskPlanningPanel.css | ❌ | **Manquant** |
| Commandes | OrdersPanel.css | ❌ | **Manquant** |
| Stock | StockPanel.css | ❌ | **Manquant** |
| Annuaire | AnnuairePanel.css | ❌ | **Manquant** |
| Communication | CommunicationPanel.css | ❌ | **Manquant** |
| Display Dashboard | DisplayDashboardPanel.css | ❌ | **Manquant** |
| Messagerie | MessagingPanel.css | ❌ | **Manquant** |
| Mailing | MailingPanel.css | ❌ | **Manquant** |
| Admin | ManagementPanel.css | ✅ | OK |
| Login | LoginForm.css | ✅ | OK |
| Mobile | MobileApp.css | ✅ | OK |
| Réservation | ReservationModal.css | ✅ | OK |
| Maintenance | MaintenanceDialog.css | ✅ | OK |

**18 fichiers CSS** avec `[data-theme="dark"]` sur **~90 significatifs** = **~20-25% de couverture**.

---

## 10. AUDIT ACCESSIBILITÉ (a11y)

### 10.1 Conformité WCAG — Non conforme

| Critère WCAG | Statut | Détail |
|-------------|--------|--------|
| 1.1.1 Alt text | ✅ 91% | 52/57 images avec alt renseigné |
| 1.3.1 Rôles sémantiques | 🔴 5% | 25 aria-* sur 126 composants |
| 2.1.1 Clavier accessible | 🔴 Faible | 17 onKeyDown, ~2 tabIndex |
| 2.4.1 Skip links | 🔴 0 | Aucun skip-link |
| 2.4.3 Focus order | 🔴 Faible | Pas de focus trap dans les modales |
| 3.3.2 Labels de formulaires | 🟡 Partiel | 47 htmlFor, beaucoup de placeholder-only |
| 4.1.2 ARIA states | 🔴 0 | 0 aria-expanded, 0 aria-checked |

### 10.2 Détails des lacunes

| Problème | Quantité | Impact |
|----------|----------|--------|
| `<div>` / `<span>` cliquables sans `role="button"` ni `tabIndex` | **84** | Inaccessible au clavier |
| Attributs `aria-*` total | **25** (sur 126 composants → ~5%) | Invisible aux lecteurs d'écran |
| `tabIndex` explicite | **~2** | Navigation clavier quasi-impossible |
| `aria-expanded` sur menus/accordéons | **0** | État invisible |
| Focus trap dans les modales | **0** (ReservationModal seul a `role="dialog"`) | Focus s'échappe des dialogs |
| Skip-links | **0** | Navigation laborieuse |
| `onKeyPress` déprécié | **5** | ManagementPanel.jsx |

### 10.3 Points positifs a11y

- ✅ **ReservationModal** : `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-required`
- ✅ **Header** : `role="tablist"`, `role="tab"`, `aria-selected` pour la navigation
- ✅ **ToastContainer** : `role="alert"` correctement utilisé
- ✅ **ui/Card** : rôle conditionnel `button` + `tabIndex`
- ✅ **Alt text** : 91% de couverture sur les images
- ✅ **htmlFor** : 47 labels associés
- ✅ **ErrorBoundary** : Message français accessible

---

## 11. AUDIT UX / RESPONSIVE / MOBILE

### 11.1 Responsive Design

| Métrique | Valeur |
|----------|--------|
| Media queries total | **119** |
| Fichiers CSS avec media queries | 55 / 90 (61%) |
| Breakpoints distincts utilisés | **11** (480, 500, 520, 560, 600, 640, 700, 768, 900, 1024, 1200) |
| Breakpoint principal | **768px** (~30 occurrences) |

**Problème** : 11 breakpoints non standardisés. Aucune variable CSS pour les breakpoints.

### 11.2 Mobile PWA

| Métrique | Valeur |
|----------|--------|
| Composants mobile dédiés | **16** fichiers JSX |
| CSS mobile dédiés | **13** fichiers CSS |
| Service Worker | ✅ sw.js |
| Manifest PWA | ✅ manifest.json |
| Touch events | **15** occurrences ciblées |

Excellente couverture mobile avec vues dédiées : MobileHome, MobilePlanning, MobilePersonnel, MobileMessaging, MobileEquipment, MobileOrders, MobileReservations, MobileLeaves, MobileLocation, MobileLogin, MobileQRLanding, MobileEquipmentQR, MobileAvailability, MobileParcDashboard, MobileMaintenances.

### 11.3 Unités viewport

| Unité | Occurrences |
|-------|-------------|
| `vh` | ~20 |
| `vw` | ~15 |
| `dvh` / `svh` / `lvh` | **0** ⚠️ |

L'absence de `dvh` (dynamic viewport height) peut causer des problèmes sur Safari mobile où la barre d'adresse change la hauteur du viewport.

### 11.4 Error Handling UX — Excellent

| Aspect | Statut | Détail |
|--------|--------|--------|
| Loading states | ✅ | 100+ patterns `loading/isLoading` dans ~30 composants |
| Empty states | ✅ | 60+ messages "Aucun…" |
| Toast notifications | ✅ | `useToast()` dans 30+ composants (success/warning/error) |
| ErrorBoundary | ✅ | Message français + stack dev + bouton recharger |
| autoFocus | ✅ | ~15 champs de recherche |

### 11.5 Internationalisation

- **Aucune bibliothèque i18n** — tous les textes UI en français hardcodé
- `date-fns/locale/fr` correctement utilisé pour le calendrier
- `toLocaleDateString('fr-FR', ...)` et `toLocaleTimeString('fr-FR', ...)` utilisés systématiquement
- **Sévérité** : INFO si mono-langue, HAUTE si traduction envisagée

### 11.6 Animations

| Aspect | Valeur |
|--------|--------|
| @keyframes déclarés | 100+ |
| Animations centralisées (theme.css) | 6 (overlayIn, modalSlideUp, fadeIn, spin, pulse, slideUp) |
| Animations dupliquées | `spin` ×6, `slideUp` ×3, `fadeIn` ×3 |
| `will-change` | **0** (pas d'optimisation GPU explicite) |
| `requestAnimationFrame` | **12** (slide panels, bonne pratique) |

---

## 12. AUDIT MODULES MÉTIER

### 12.1 Véhicules & Réservations
- ✅ CRUD complet, conflits de réservation détectés
- ⚠️ Pas d'index sur `reservations(vehicle_id, start_date, end_date)` → scan complet
- ⚠️ `reservation_requests` pas d'index sur status

### 12.2 Personnel & Congés
- ✅ Module le plus complet : compétences, disponibilités, missions, congés Code du travail/IDCC 3252
- ⚠️ PersonnelPanel.jsx = 48 useState (God Component)
- ⚠️ N+1 critique sur `GET /api/persons` et `GET /api/leaves/balances`
- ⚠️ Transactions manquantes sur décision/annulation congé
- ✅ Toutes les FK ont ON DELETE CASCADE

### 12.3 Affaires
- ✅ Import Excel/CSV, BL, PJ, tâches
- ⚠️ Double identifiant (id INT vs numero_affaire TEXT) → incohérence FK

### 12.4 Catalogue & Équipements
- ✅ UID auto, localisation multi-dépôt, SAV
- ⚠️ `equipment.category_id` FK sans ON DELETE
- ⚠️ `equipment_assignments.assigned_to` TEXT libre (pas FK)

### 12.5 Stock & Commandes
- ✅ CRUD, mouvements, workflow commandes (draft→sent→confirmed→received)
- ✅ Bons index sur stock_items et stock_movements
- ⚠️ `material_requests` n'a **aucune FK déclarée**
- ⚠️ Transactions manquantes sur mouvements stock

### 12.6 Annuaire
- ✅ Validation SIRET, TVA, enrichissement
- ⚠️ **Double système client** (conflits avec routes.js legacy)
- ⚠️ `annuaire_contacts.entity_id` polymorphe sans FK formelle

### 12.7 Communication / Planning
- ✅ Planning jour/semaine, tâches récurrentes, iCal, export PDF
- ⚠️ task_assignments DROP/CREATE 6× au démarrage
- ⚠️ communicationRoutes.js = 2 298 lignes → à découper

### 12.8 Display Dashboard
- ✅ 21 sous-composants, écrans, playlists, médias, Sonos
- ⚠️ DisplayDashboardPanel.css : 2 238 lignes sans dark mode
- 🔴 Path traversal sur endpoint GIFs

### 12.9 Messagerie
- ✅ Conversations, messages, pièces jointes
- ⚠️ `messages.sender_id` FK sans ON DELETE
- ⚠️ Pas de transactions sur envoi

### 12.10 Mailing
- ✅ Templates, envoi groupé, historique
- ⚠️ `mail_history.template_id` pas de FK
- ⚠️ SMTP password en clair en DB

### 12.11 Mobile (PWA)
- ✅ 16 vues, détection auto mobile, login dédié
- ✅ Service Worker + manifest installable
- ⚠️ Pas de `dvh` pour viewport Safari mobile

---

## 13. PLAN DE CORRECTIONS PRIORISÉ

### 🔴 P0 — CRITIQUE (sécurité / intégrité) — À corriger immédiatement

| # | Action | Effort | Fichiers |
|---|--------|--------|----------|
| 1 | Sécuriser `/api/auth/users` avec `authenticateToken` | 5min | server.js |
| 2 | Sécuriser le flux reset password (OTP email + token signé temporaire) | 3h | server.js |
| 3 | Corriger path traversal GIFs (appliquer `sanitizePath()`) | 15min | displayRoutes.js |
| 4 | Éliminer les 6 DROP TABLE task_assignments (vérif avant migration) | 1h | database.js |
| 5 | Rendre les 27 migrations ALTER TABLE idempotentes | 2h | database.js |
| 6 | Ajouter transactions sur décision/annulation congés | 30min | leaveRoutes.js |

### 🟠 P1 — HAUTE (performance / robustesse) — Sous 2 semaines

| # | Action | Effort | Fichiers |
|---|--------|--------|----------|
| 7 | Ajouter les 9 index DB manquants | 30min | database.js |
| 8 | Corriger les 4 N+1 queries (JOINs ou batch) | 2h | personnelRoutes, leaveRoutes, ordersRoutes |
| 9 | Installer helmet + configurer CSP | 30min | server.js, package.json |
| 10 | Ajouter sanitization XSS serveur (DOMPurify/xss côté serveur) | 1h | Tous les routes |
| 11 | Retirer `application/octet-stream` de la whitelist upload | 5min | server.js |
| 12 | Ajouter ON DELETE SET NULL/CASCADE sur FK | 1h | database.js |
| 13 | Ajouter nettoyage sessions expirées (setInterval) | 15min | server.js |
| 14 | Désactiver source maps en production | 1min | vite.config.js |
| 15 | Unifier le système client (supprimer legacy routes.js) | 1h | routes.js, api.js, ManagementPanel.jsx |

### 🟡 P2 — MOYENNE (UX / maintenabilité) — Sous 1 mois

| # | Action | Effort | Fichiers |
|---|--------|--------|----------|
| 16 | Créer les tokens CSS manquants (spacing, radius, typo, z-index) | 2h | theme.css |
| 17 | Remplacer les ~379 couleurs hex par var(--theme-*) | 4h | 52 fichiers CSS |
| 18 | Ajouter dark mode aux 52 fichiers CSS manquants | 8h | 52 fichiers CSS |
| 19 | Décomposer PersonnelPanel (48 useState → sous-composants + useReducer) | 4h | PersonnelPanel.jsx |
| 20 | Corriger les 84 divs cliquables sans role/tabIndex | 2h | 30+ fichiers JSX |
| 21 | Centraliser les animations dupliquées | 1h | theme.css + 15 CSS |
| 22 | Remplacer les 192 `!important` | 4h | 20 fichiers CSS |
| 23 | Nettoyer les 195 console.log | 30min | grep + sed |
| 24 | Convertir COUNT séquentiels en GROUP BY (5 endpoints) | 1h | 5 fichiers routes |
| 25 | Extraire App.jsx useState vers useReducer + contextes | 3h | App.jsx |
| 26 | Lazy-load PlanningView + GoogleCalendarBanner | 15min | App.jsx |

### 🟢 P3 — BASSE (qualité / optimisation) — Backlog

| # | Action | Effort | Fichiers |
|---|--------|--------|----------|
| 27 | Supprimer le code mort (garage methods, excelImport.js) | 15min | api.js, excelImport.js |
| 28 | Activer ReportsPanel (décommenter lazy import) | 5min | App.jsx |
| 29 | Ajouter React.memo aux 13 gros composants | 1h | 13 fichiers |
| 30 | Remplacer les 15 key={index} par des clés stables | 30min | 8 fichiers |
| 31 | Ajouter ErrorBoundary granulaires par module | 1h | App.jsx |
| 32 | Standardiser z-index via tokens | 1h | ~15 fichiers CSS |
| 33 | Normaliser l'identifiant affaire (migrer vers numero_affaire) | 2h | database.js, routes |
| 34 | Standardiser les breakpoints responsive (3-4 valeurs max) | 2h | 55 fichiers CSS |
| 35 | Ajouter `dvh` pour viewport mobile Safari | 30min | 5 CSS files |
| 36 | Ajouter focus trap aux modales | 2h | 15 composants modaux |
| 37 | Mettre en cache les db.prepare au niveau module | 2h | 12 fichiers routes |
| 38 | Ajouter skip-links | 30min | App.jsx, theme.css |
| 39 | Corriger les 7 eslint-disable exhaustive-deps | 30min | 4 fichiers |
| 40 | Ajouter backup automatisé de la DB | 1h | scripts/ |

---

## 14. MIGRATIONS SQL IDEMPOTENTES

### Migration 1 : Index manquants critiques

```sql
-- Migration safe : CREATE INDEX IF NOT EXISTS est natif SQLite
CREATE INDEX IF NOT EXISTS idx_active_sessions_token_hash ON active_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_reservations_vehicle_dates ON reservations(vehicle_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_maintenances_vehicle ON maintenances(vehicle_id, status, date);
CREATE INDEX IF NOT EXISTS idx_modification_history_entity ON modification_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_mail_history_status ON mail_history(sent_by, status);
CREATE INDEX IF NOT EXISTS idx_bl_imports_affaire ON bl_imports(affaire_id);
```

### Migration 2 : Pattern ALTER TABLE idempotent (template)

```javascript
// Pattern sûr pour toutes les migrations ALTER TABLE dans database.js
function safeAddColumn(db, table, column, type, defaultVal = null) {
  const cols = db.pragma(`table_info(${table})`).map(c => c.name);
  if (!cols.includes(column)) {
    const defClause = defaultVal !== null ? ` DEFAULT ${defaultVal}` : '';
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}${defClause}`);
    console.log(`  ✅ ${table}.${column} ajouté`);
  }
}

// Exemple d'utilisation pour les 27 ALTER TABLE non protégés :
safeAddColumn(db, 'vehicles', 'display_color', 'TEXT', "NULL");
safeAddColumn(db, 'vehicles', 'short_name', 'TEXT', "NULL");
safeAddColumn(db, 'users', 'preferences', 'TEXT', "'{}'");
safeAddColumn(db, 'email_config', 'alert_recipients', 'TEXT', "NULL");
// ... etc pour les 27 restants
```

### Migration 3 : Sécuriser task_assignments (éviter DROP)

```javascript
// Au lieu de DROP/CREATE, vérifier d'abord si la migration est nécessaire
function needsTaskAssignmentsMigration(db, requiredSections, requiredSourceTypes) {
  const tableInfo = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='task_assignments'"
  ).get();
  if (!tableInfo) return true;
  
  const sql = tableInfo.sql;
  for (const section of requiredSections) {
    if (!sql.includes(`'${section}'`)) return true;
  }
  for (const source of requiredSourceTypes) {
    if (!sql.includes(`'${source}'`)) return true;
  }
  return false;
}

// Utilisation :
const requiredSections = ['prep_locations', 'prep_prestations', 'prep_ventes', 
  'prep_installations', 'chargement', 'depart', 'enlevement', 'retour', 
  'recuperation', 'installation', 'evenements', 'operations', 'rdv',
  'prep_tournees', 'livraison'];
const requiredSourceTypes = ['google_event', 'sync', 'manual', 'ical_event'];

if (needsTaskAssignmentsMigration(db, requiredSections, requiredSourceTypes)) {
  db.transaction(() => {
    // ... le DROP/CREATE existant, SEULEMENT si nécessaire
  })();
} else {
  console.log('  ⏭️ task_assignments : schéma à jour, migration ignorée');
}
```

### Migration 4 : Nettoyage sessions expirées

```javascript
// Ajouter dans server.js, après l'initialisation de la DB
setInterval(() => {
  try {
    const result = db.prepare(
      'DELETE FROM active_sessions WHERE expires_at < datetime("now")'
    ).run();
    if (result.changes > 0) {
      logger.info(`🧹 ${result.changes} sessions expirées nettoyées`);
    }
  } catch (err) {
    logger.error('Erreur nettoyage sessions:', err);
  }
}, 30 * 60 * 1000); // Toutes les 30 minutes
```

---

## 15. DESIGN SYSTEM UNIFIÉ — TOKENS MANQUANTS

### Tokens à ajouter dans theme.css

```css
/* ═══════════════════════════════════════════════════
   DESIGN TOKENS — À ajouter dans :root de theme.css
   ═══════════════════════════════════════════════════ */

/* Spacing Scale */
--space-0: 0;
--space-px: 1px;
--space-0-5: 2px;
--space-1: 4px;
--space-1-5: 6px;
--space-2: 8px;
--space-2-5: 10px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;

/* Border Radius Scale */
--radius-xs: 4px;
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-2xl: 20px;
--radius-full: 9999px;

/* Typography Scale */
--font-2xs: 0.65rem;    /* 10.4px — micro-labels */
--font-xs: 0.72rem;     /* 11.5px — metas, sub */
--font-sm: 0.8rem;      /* 12.8px — secondaire */
--font-base: 0.875rem;  /* 14px   — texte courant */
--font-md: 1rem;        /* 16px   — titres sections */
--font-lg: 1.125rem;    /* 18px   — titres modals */
--font-xl: 1.25rem;     /* 20px   — titres panels */
--font-2xl: 1.5rem;     /* 24px   — titres pages */
--font-3xl: 1.875rem;   /* 30px   — hero */

--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;

--weight-normal: 400;
--weight-medium: 500;
--weight-semibold: 600;
--weight-bold: 700;

/* Z-Index Scale */
--z-base: 1;
--z-dropdown: 100;
--z-sticky: 200;
--z-overlay: 1000;
--z-modal: 2000;
--z-popover: 3000;
--z-toast: 5000;
--z-tooltip: 9999;

/* Shadow Scale (enrichi) */
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
--shadow-xl: 0 12px 40px rgba(0, 0, 0, 0.15);

/* Tooltip tokens */
--tooltip-bg: rgba(17, 24, 39, 0.95);
--tooltip-color: #ffffff;
--tooltip-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

/* Breakpoints (pour référence — non utilisable en CSS natif) */
/* --bp-sm: 480px;  --bp-md: 768px;  --bp-lg: 1024px;  --bp-xl: 1200px; */
```

### Overrides dark mode

```css
[data-theme="dark"] {
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 12px 40px rgba(0, 0, 0, 0.6);
  
  --tooltip-bg: rgba(241, 245, 249, 0.95);
  --tooltip-color: #0f172a;
  --tooltip-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}
```

### Cartographie z-index actuel → cible

| Composant | Actuel | Cible |
|-----------|--------|-------|
| Header sticky | 200 | `var(--z-sticky)` = 200 |
| Dropdown/menu | 100-300 | `var(--z-dropdown)` = 100 |
| Modal overlay | 1000-3000 | `var(--z-overlay)` = 1000 |
| Modal contenu | 2000-10000 | `var(--z-modal)` = 2000 |
| Popover/context menu | 5000-9000 | `var(--z-popover)` = 3000 |
| Toast notifications | 9500 | `var(--z-toast)` = 5000 |
| Tooltips | 99999 | `var(--z-tooltip)` = 9999 |
| Loading overlay | 9999 | `var(--z-tooltip)` = 9999 |

---

## 16. ANNEXES

### A. Fichiers audités

| Répertoire | Fichiers audités | Couverture |
|------------|-----------------|------------|
| server/ | 17/17 | **100%** |
| src/components/ | 83/83 | **100%** |
| src/components/mobile/ | 16/16 | **100%** |
| src/components/DisplayDashboard/ | 21/21 | **100%** |
| src/utils/ | 14/14 | **100%** |
| src/hooks/ | 6/6 | **100%** |
| CSS | 90/90 | **100%** |
| Scripts | 7/7 | **100%** |
| Config (package.json, vite.config.js, .env*) | 5/5 | **100%** |

### B. Dépendances vulnérables connues

| Package | Version | Vulnérabilité | Sévérité |
|---------|---------|---------------|----------|
| xlsx | 0.18.5 | Prototype Pollution + ReDoS | HIGH |
| esbuild | (dev) | CVE connue | MODERATE (dev-only) |

### C. Uploads Multer — Inventaire complet

| Upload | Fichier | Taille max | MIME validé | Auth |
|--------|---------|------------|-------------|------|
| uploadMedia | displayRoutes L43 | 50 MB | ✅ images+vidéo | ✅ |
| uploadGif | displayRoutes L64 | 5 MB | ✅ GIF/PNG | ✅ Admin |
| uploadLogo | displayRoutes L81 | 5 MB | ✅ image/* | ✅ Admin |
| uploadSneaky | displayRoutes L98 | 10 MB | ✅ image/* | ✅ Admin |
| uploadAvatar | server.js L2593 | 5 MB | ✅ image/* | ✅ |
| upload (BL) | server.js L2790 | ⚠️ **Pas de limite** | ✅ PDF only | ✅ |
| uploadAttachment | server.js L2803 | 50 MB | ⚠️ octet-stream accepté | ✅ |
| uploadBL | communicationRoutes L33 | 20 MB | ⚠️ Par extension | ✅ |
| uploadPhoto | equipmentRoutes L1174 | 20 MB | ⚠️ Par extension | ✅ |

### D. Tableau récapitulatif final

| Métrique | Valeur | Évaluation |
|----------|--------|------------|
| Vulnérabilités CRITIQUES | **3** | 🔴 |
| Vulnérabilités HAUTES | **5** | 🟠 |
| Vulnérabilités MOYENNES | **12** | 🟡 |
| Tables SQLite | **83** | ✅ |
| Index DB existants | **70+** | ✅ |
| Index DB manquants | **9** | 🟡 |
| FK sans ON DELETE | **20+** | 🟡 |
| FK logiques non déclarées | **5+** | 🟡 |
| Migrations non idempotentes | **27** | 🔴 |
| DROP/CREATE task_assignments | **6** | 🔴 |
| N+1 queries critiques | **4** | 🔴 |
| Transactions manquantes | **5** | 🔴 |
| Endpoints API | **671** | ✅ |
| Endpoints non protégés | **12** (6 critiques) | 🔴 |
| God Components (>1500 l.) | **6** | 🟡 |
| useState dans PersonnelPanel | **48** | 🔴 |
| PropTypes / TypeScript | **0** | 🟡 |
| Tests automatisés | **0** | 🔴 |
| Couverture ARIA (a11y) | **~5%** | 🔴 |
| Dark mode CSS | **~25%** couverture | 🟡 |
| Couleurs hex hardcodées | **~379** | 🟡 |
| !important | **192** | 🔴 |
| styles inline JSX | **737** | 🔴 |
| Tokens CSS manquants (catégories) | **5** (spacing, radius, typo, z-index, breakpoints) | 🟡 |
| console.log en prod | **195** | 🟡 |
| Code mort (fichiers) | **1** (excelImport.js) | 🟢 |
| Code mort (méthodes API) | **3** | 🟢 |
| Source maps en production | **Activées** | 🟡 |

---

**Effort total estimé pour les corrections :**
- 🔴 P0 (critique) : **~7h**
- 🟠 P1 (haute) : **~7h**
- 🟡 P2 (moyenne) : **~25h**
- 🟢 P3 (basse) : **~12h**
- **Total : ~51h de travail**

---

*Fin de l'audit technique eM@g v2.0.0 — Juillet 2025*

---

# ANNEXE E — Audit Backend Détaillé (Juin 2025)

> *Contenu fusionné depuis BACKEND_AUDIT_REPORT.md*

# Rapport d'Audit Backend — eM@g

**Date :** Juin 2025  
**Périmètre :** `/server/` — ~18 000 lignes, 15 fichiers JS  
**Méthodologie :** Lecture intégrale du code, vérification croisée schéma ↔ requêtes  
**Règle :** Bugs réels et failles de sécurité uniquement, pas de préférences de style.

---

## Résumé exécutif

| Sévérité | Nombre |
|----------|--------|
| CRITIQUE | 4 |
| HAUTE    | 9 |
| MOYENNE  | 11 |
| BASSE    | 5 |
| **Total** | **29** |

---

## 1. Fichier principal — server.js (2 912 lignes)

### [CRITIQUE] SEC-01 — JWT_SECRET par défaut en clair

- **Fichier :** `server/server.js` ligne 57
- **Code :** `const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';`
- **Problème :** Si la variable d'environnement `JWT_SECRET` n'est pas définie, tous les tokens JWT sont signés avec un secret publiquement connu. N'importe qui peut forger un token valide et usurper n'importe quel compte, y compris administrateur. La ligne 60 émet un `logger.warn` mais n'empêche PAS le démarrage du serveur.
- **Correction suggérée :** Refuser de démarrer si `JWT_SECRET` n'est pas défini en variable d'environnement. Remplacer le fallback par un `process.exit(1)`.

---

### [CRITIQUE] SEC-02 — Réinitialisation mot de passe sans vérification cryptographique (self-reset)

- **Fichier :** `server/server.js` lignes 327-380
- **Route :** `POST /api/auth/self-reset-password` (non authentifiée)
- **Problème :** La seule vérification est email + nom (comparaison case-insensitive). Il n'y a aucun token à usage unique, aucun OTP, aucun e-mail de confirmation. Un attaquant connaissant l'email et le nom d'un utilisateur (informations souvent publiques) peut réinitialiser son mot de passe et obtenir un JWT valide dans la réponse.
- **Correction suggérée :** Implémenter un flux standard : (1) envoi d'un token signé par email, (2) vérification du token avant autorisation de changement de mot de passe. Supprimer le renvoi du JWT dans la réponse de réinitialisation.

---

### [CRITIQUE] SEC-03 — Flux admin reset : check-reset fuit des données, set-new-password sans token

- **Fichier :** `server/server.js` lignes 1871-1940
- **Routes :** `POST /api/auth/check-reset` et `POST /api/auth/set-new-password` (non authentifiées)
- **Problème (check-reset, ligne 1871) :** Renvoie `{ id, email, name }` de l'utilisateur à partir d'un simple email — fuite d'information utilisable pour de l'énumération de comptes.
- **Problème (set-new-password, ligne 1893) :** La seule protection est le flag `password_reset_required = 1` dans la base. Un attaquant qui connaît l'email d'un utilisateur dont l'admin a demandé la réinitialisation peut intercepter le flux et définir le mot de passe avant l'utilisateur légitime. Aucun token à usage unique n'est vérifié.
- **Correction suggérée :** (1) `check-reset` ne doit renvoyer que `{ resetRequired: boolean }`, pas les données utilisateur. (2) `set-new-password` doit exiger un token de réinitialisation signé, envoyé par email ou généré lors de l'étape admin.

---

### [HAUTE] PERF-01 — PRAGMA table_info exécuté sur chaque requête

- **Fichier :** `server/server.js` lignes 260 (register) et 1620 (access-request PATCH)
- **Problème :** `db.prepare("PRAGMA table_info(authorized_emails)").all()` est exécuté à chaque appel `POST /api/auth/register` et `PATCH /api/admin/access-requests/:id` pour vérifier si la colonne `is_admin` existe. C'est une opération de migration qui devrait s'exécuter une fois au démarrage, pas à chaque requête.
- **Correction suggérée :** Déplacer cette migration dans `database.js` à l'initialisation, ou la mettre en cache dans une variable au premier appel.

---

### [HAUTE] DATA-01 — Suppression utilisateur ne réassigne qu'un sous-ensemble de tables

- **Fichier :** `server/server.js` lignes ~2040-2060
- **Problème :** La transaction de suppression d'un utilisateur réassigne les données vers un autre utilisateur, mais uniquement pour les tables : `vehicles`, `reservations`, `clients`, `drivers`, `locations`, `garages`, `maintenances`, `config`, `reservation_requests`. Cela ignore de nombreuses tables où `created_by` ou `user_id` référencent l'utilisateur supprimé : `orders`, `equipment_assignments`, `sav_tickets`, `leave_requests`, `display_messages`, `stock_movements`, `conversations`, `messages`, etc.
- **Correction suggérée :** Auditer toutes les colonnes FK vers `users(id)` et les inclure dans la transaction de réassignement, ou utiliser `ON DELETE SET NULL` / `ON DELETE CASCADE` (selon le cas fonctionnel).

---

### [HAUTE] SEC-04 — set-new-password renvoie un JWT — contournement du flux de login

- **Fichier :** `server/server.js` lignes 1917-1935
- **Problème :** `set-new-password` crée et renvoie un JWT complet dans la réponse HTTP, connectant automatiquement l'utilisateur. Combiné avec SEC-03 (pas de token de vérification), cela signifie qu'un attaquant obtient directement un accès authentifié.
- **Correction suggérée :** Ne pas renvoyer de token. Rediriger l'utilisateur vers la page de login après réinitialisation.

---

### [MOYENNE] AUTH-01 — Mot de passe minimum 6 caractères

- **Fichier :** `server/server.js` lignes 337, 1900
- **Problème :** Aucune exigence de complexité (majuscule, chiffre, caractère spécial). Six caractères sont insuffisants face à une attaque par dictionnaire, même avec bcrypt.
- **Correction suggérée :** Exiger au minimum 8 caractères avec critères de complexité, ou intégrer une vérification de force type zxcvbn.

---

## 2. Cohérence des routes

### [HAUTE] BUG-01 — Colonnes inexistantes : `p.prenom` / `p.nom` dans communicationRoutes

- **Fichier :** `server/communicationRoutes.js` ligne 1509
- **Requête :** `SELECT de.*, p.prenom as assigned_person_first_name, p.nom as assigned_person_last_name FROM dynamic_display_events de LEFT JOIN persons p ON …`
- **Problème :** La table `persons` utilise les colonnes `first_name` et `last_name` (confirmé dans personnelRoutes.js et database.js). `p.prenom` et `p.nom` n'existent pas. SQLite ne lève pas d'erreur sur un LEFT JOIN avec des colonnes inexistantes dans certains cas, mais retourne systématiquement `NULL`. Le nom de la personne assignée ne sera **jamais** affiché.
- **Correction suggérée :** Remplacer `p.prenom` par `p.first_name` et `p.nom` par `p.last_name`.

---

### [HAUTE] BUG-02 — Requête display_messages : 2 colonnes inexistantes

- **Fichier :** `server/displayRoutes.js` ligne 1346
- **Requête :** `SELECT content, priority FROM display_messages WHERE status = 'active' ORDER BY priority DESC LIMIT 8`
- **Problème :** La table `display_messages` (database.js ligne 2239) n'a ni colonne `content` (→ `body` ou `title`) ni colonne `status` (→ `is_active INTEGER`). Cette requête **crashera à l'exécution** avec `SqliteError: no such column: content`.
- **Correction suggérée :** Remplacer par `SELECT title, body, priority FROM display_messages WHERE is_active = 1 AND (date_start IS NULL OR date_start <= datetime('now')) AND (date_end IS NULL OR date_end >= datetime('now')) ORDER BY priority DESC LIMIT 8`.

---

### [HAUTE] BUG-03 — crypto.getRandomValues sans import

- **Fichier :** `server/communicationRoutes.js` lignes 114, 237, 1112, 1176
- **Problème :** Le fichier n'importe pas `crypto` (confirmé — seuls `db`, `multer`, `path`, `fs`, `PDFDocument`, `logger` sont importés). Le code utilise `crypto.getRandomValues(new Uint8Array(16))` qui repose sur `globalThis.crypto` — API Web Crypto disponible uniquement depuis Node.js 19+. Si le serveur tourne sur Node 18 LTS (fin de vie avril 2025, mais encore largement déployé), ces 4 appels plantent avec `ReferenceError: crypto is not defined`.
- **Correction suggérée :** Ajouter `import crypto from 'crypto';` et utiliser `crypto.randomBytes(16)` (API Node.js stable), ou `import { randomUUID } from 'crypto';`.

---

### [HAUTE] RACE-01 — Génération de référence hors transaction (ordersRoutes)

- **Fichier :** `server/ordersRoutes.js` ~ligne 100 (fonction `generateReference`)
- **Problème :** La fonction lit la dernière référence (ex: `BC-2025-042`), incrémente le compteur et insère. Mais la lecture et l'insertion ne sont pas dans la même transaction. Sous charge concurrente, deux requêtes simultanées peuvent lire le même compteur et produire un doublon. Le UNIQUE constraint provoquera alors un crash 500.
- **Correction suggérée :** Englober lecture + insertion dans `db.transaction()`, ou utiliser un `INSERT … SELECT MAX(…) + 1` atomique.

---

### [HAUTE] PERM-01 — Garages : POST/PUT sans requireAdmin mais DELETE avec

- **Fichier :** `server/routes.js` (routes garages)
- **Problème :** N'importe quel utilisateur authentifié peut créer ou modifier un garage, mais seul un admin peut le supprimer. Incohérence du modèle de permissions.
- **Correction suggérée :** Appliquer `requireAdmin` sur les 3 opérations d'écriture (POST, PUT, DELETE).

---

### [MOYENNE] MSG-01 — messagingRoutes vérifie isAdmin depuis le JWT et non la base

- **Fichier :** `server/messagingRoutes.js` ~ligne 310
- **Problème :** La suppression de message vérifie `req.user.isAdmin` (valeur du JWT). Si un admin est rétrogradé pendant la durée de vie du token (jusqu'à 30 jours), il conserve le privilège admin dans la messagerie jusqu'à expiration du token.
- **Correction suggérée :** Interroger `users.is_admin` dans la base pour les opérations sensibles, ou réduire la durée de vie des tokens.

---

### [MOYENNE] DUPLIC-01 — ordersRoutes batch-validate duplique la logique de single-validate

- **Fichier :** `server/ordersRoutes.js` ~ligne 1200
- **Problème :** L'endpoint de validation en lot duplique entièrement la logique de distribution vers les commandes fournisseur, au lieu d'appeler une fonction partagée. Tout correctif appliqué à l'un devra être appliqué manuellement à l'autre.
- **Correction suggérée :** Extraire la logique de distribution dans une fonction réutilisable appelée par les deux endpoints.

---

### [MOYENNE] SORT-01 — Interpolation directe de colonne de tri (annuaireRoutes)

- **Fichier :** `server/annuaireRoutes.js` lignes 56, 179, 297
- **Code :** `` ORDER BY ${sortCol} ${sortOrder} ``
- **Problème :** Bien que `sortCol` soit validé contre un tableau `allowedSorts`, le pattern d'interpolation directe dans le SQL est fragile. Si `allowedSorts` est étendu par erreur avec une valeur contrôlée par l'utilisateur, cela devient une injection SQL. `sortOrder` est aussi interpolé (devrait être limité à `ASC`/`DESC`).
- **Correction suggérée :** Utiliser un mapping explicite (objet/Map) plutôt qu'un tableau, et valider `sortOrder` contre `['ASC', 'DESC']` strictement.

---

## 3. Schéma de base de données — database.js (2 819 lignes)

### [MOYENNE] MIGR-01 — Rebuild de table task_assignments avec transactions manuelles

- **Fichier :** `server/database.js` lignes ~1830-2090 (4 migrations séquentielles)
- **Problème :** Quatre migrations recréent la table `task_assignments` via le pattern CREATE temp → INSERT SELECT → DROP → RENAME, en utilisant `db.exec('BEGIN')` / `db.exec('COMMIT')` manuels au lieu de `db.transaction()`. En cas d'erreur dans le `catch`, le `ROLLBACK` peut échouer si la transaction est déjà dans un état incohérent (ex : RENAME partiel). Better-sqlite3 recommande fortement `db.transaction()` pour garantir le rollback automatique.
- **Correction suggérée :** Remplacer par `db.transaction(() => { … })()`.

---

### [MOYENNE] MIGR-02 — Migrations silencieuses avec try/catch et logger.warn

- **Fichier :** `server/database.js` (tout le fichier — pattern récurrent)
- **Problème :** Chaque migration est dans un `try { … } catch(e) { logger.warn(…) }`. Si une migration échoue partiellement (ex : ALTER TABLE réussit mais CREATE INDEX échoue), le schéma reste dans un état intermédiaire non détecté. Le serveur continue de fonctionner avec un schéma corrompu.
- **Correction suggérée :** Distinguer les migrations idempotentes (ALTER TABLE IF NOT EXISTS) des migrations destructives (table rebuild). Pour ces dernières, propager l'erreur.

---

### [MOYENNE] SCHEMA-01 — Colonnes INSERT fragiles (personnelRoutes vs migration)

- **Fichier :** `server/personnelRoutes.js` ligne 82
- **Problème :** L'INSERT INTO persons référence des colonnes ajoutées par migrations (`contract_type`, `default_positions`, `code_libre`, `postal_code`, `city`). Si une migration n'a pas été appliquée (ex : base restaurée depuis une vieille sauvegarde), l'INSERT échoue.
- **Correction suggérée :** Vérifier la présence des colonnes au démarrage, ou n'insérer que dans les colonnes du schéma de base et faire les updates optionnelles ensuite.

---

### [BASSE] SCHEMA-02 — Pas de ON DELETE CASCADE sur equipment_assignments / sav_tickets

- **Fichier :** `server/equipmentRoutes.js` (endpoint DELETE equipment)
- **Problème :** La suppression d'un équipement fait un DELETE manuel sur les tables liées (assignments, tickets) avant de supprimer l'équipement lui-même, au lieu de compter sur ON DELETE CASCADE. Si un développeur ajoute une nouvelle table référençant `equipment(id)`, il devra se souvenir de mettre à jour manuellement ce code.
- **Correction suggérée :** Ajouter ON DELETE CASCADE sur les foreign keys (nécessite un rebuild de table en SQLite).

---

## 4. Service email — emailService.js (383 lignes)

### [MOYENNE] MAIL-01 — Fallback de transport fragile (mailingRoutes)

- **Fichier :** `server/mailingRoutes.js` lignes ~120-135
- **Problème :** Le code fait `getTransporter()` → si null → `initTransporter()` → `getTransporter()` à nouveau. Si `initTransporter()` échoue silencieusement (ex : config SMTP invalide en base), le second `getTransporter()` retourne encore `null` et le endpoint renvoie une erreur 500 générique sans indication.
- **Correction suggérée :** Propager l'erreur d'initialisation. Retourner un message d'erreur explicite : "Configuration SMTP invalide ou manquante".

---

### [MOYENNE] MAIL-02 — emailService ne valide pas l'intégrité de la configuration

- **Fichier :** `server/emailService.js` (~ligne 30, `initTransporter`)
- **Problème :** La configuration SMTP est lue depuis la base (`email_config`). Si les champs obligatoires (`host`, `port`, `user`, `pass`) sont vides ou corrompus, `nodemailer.createTransport` créera un transport invalide qui ne sera détecté qu'au premier envoi.
- **Correction suggérée :** Valider les champs obligatoires avant de créer le transport. Appeler `transporter.verify()` après création.

---

## 5. Problèmes transverses (cross-file)

### [CRITIQUE] XF-01 — Pas de validation d'entrée centralisée

- **Fichiers :** Tous les fichiers routes
- **Problème :** Il n'y a aucune couche de validation d'entrée (pas de Joi, Zod, express-validator, ou équivalent). Chaque route fait ses propres vérifications manuelles ad-hoc, souvent incomplètes :
  - Certaines routes vérifient les champs requis, d'autres non
  - Aucune validation de type (un number pourrait recevoir "abc")
  - Aucune limite de longueur sur les champs texte (DoS par payload géant)
  - Les paramètres d'URL (`:id`) ne sont jamais validés comme integers
- **Correction suggérée :** Implémenter une couche de validation avec Zod ou Joi. Créer un middleware `validate(schema)` réutilisable.

---

### [HAUTE] XF-02 — Réponses d'erreur incohérentes

- **Fichiers :** Tous les fichiers routes
- **Problème :** Au moins 4 formats de réponse d'erreur différents coexistent :
  - `{ error: 'message' }` (le plus fréquent)
  - `{ error: 'titre', message: 'détail' }`
  - `{ success: false, error: 'message' }`
  - `{ message: 'message' }` (sans champ error)
  - Codes HTTP incohérents : certaines erreurs métier retournent 400, d'autres 500 pour des cas similaires
- **Correction suggérée :** Créer un helper `sendError(res, statusCode, message)` et l'utiliser partout. Définir un format standard.

---

### [MOYENNE] XF-03 — Aucun rate limiting sur les endpoints d'upload

- **Fichier :** `server/server.js` lignes 2650-2800 (attachment uploads)
- **Problème :** Le rate limiter est appliqué sur `/api/auth/*` (20/15min) et globalement (600/min), mais les endpoints d'upload de fichiers (attachments jusqu'à 50MB, BL imports, photos, médias display) n'ont pas de rate limiting spécifique. Un attaquant authentifié pourrait saturer le disque.
- **Correction suggérée :** Ajouter un rate limiter dédié aux endpoints d'upload (ex : 10 uploads/minute) et une vérification d'espace disque restant.

---

### [MOYENNE] XF-04 — Gestion de la concurrence inexistante (au-delà de RACE-01)

- **Fichiers :** Multiples routes CRUD
- **Problème :** Aucun mécanisme d'optimistic locking ou de vérification de version. Par exemple, si deux administrateurs modifient le même utilisateur simultanément, le dernier à sauvegarder écrase silencieusement les modifications de l'autre.
- **Correction suggérée :** Ajouter une colonne `version` ou `updated_at` et vérifier dans les UPDATE que la valeur n'a pas changé depuis la lecture.

---

### [MOYENNE] XF-05 — Balance de congés clippée silencieusement

- **Fichier :** `server/leaveRoutes.js` (restauration après annulation)
- **Code :** `MAX(0, days_taken - ?)`
- **Problème :** Si `days_taken` est inférieur au nombre de jours à restaurer (incohérence de données), le résultat est clippé à 0 au lieu de signaler l'anomalie. Cela masque des erreurs de calcul de solde de congés.
- **Correction suggérée :** Logger un avertissement si `days_taken < amount` et investiguer la cause.

---

### [BASSE] XF-06 — Nommage incohérent des paramètres de requête

- **Fichiers :** `server/displayRoutes.js` (ligne ~1160 : `_req`), divers fichiers (mélange `snake_case` / `camelCase`)
- **Problème :** Certains handlers utilisent `_req` au lieu de `req` sans raison apparente. Les réponses JSON mélangent `camelCase` et `snake_case` selon les fichiers.
- **Correction :** Adopter une convention unique et l'appliquer.

---

### [BASSE] XF-07 — Aucun test automatisé

- **Fichiers :** Aucun fichier `*.test.js` ou `*.spec.js` dans `server/`
- **Problème :** Aucun test unitaire ou d'intégration pour 18 000 lignes de code backend. Les bugs identifiés dans ce rapport (BUG-01, BUG-02, RACE-01) auraient été détectés par des tests basiques.
- **Correction suggérée :** Prioriser les tests sur les flux critiques : authentification, réinitialisation mot de passe, calcul de solde congés, génération de références.

---

### [BASSE] XF-08 — Checkpoint WAL toutes les 5 minutes sans condition

- **Fichier :** `server/database.js` (fin de fichier) et `server/server.js` (fin)
- **Problème :** Un `PRAGMA wal_checkpoint(TRUNCATE)` est exécuté toutes les 5 minutes inconditionnellement. En l'absence d'écriture, c'est une opération inutile. Sous forte charge, cela peut bloquer momentanément les écritures.
- **Correction suggérée :** Vérifier avec `PRAGMA wal_checkpoint` (sans argument) si le WAL a des pages à checkpointer avant de forcer un TRUNCATE.

---

### [BASSE] XF-09 — server.js monolithique (2 912 lignes)

- **Fichier :** `server/server.js`
- **Problème :** Le fichier contient l'authentification, les routes véhicules, les routes réservations, les routes maintenances, les routes affaires, la gestion d'accès, l'upload de fichiers, la configuration email, les avatars, les profils, les préférences, et le lifecycle serveur. Cela rend le code difficile à maintenir et à auditer.
- **Correction suggérée :** Extraire les modules logiques dans des fichiers de routes dédiés (comme déjà fait pour les 11 autres modules).

---

## Matrice des risques

| ID | Sévérité | Impact immédiat |
|----|----------|----------------|
| SEC-01 | CRITIQUE | Forge de token → accès admin |
| SEC-02 | CRITIQUE | Prise de contrôle de compte |
| SEC-03 | CRITIQUE | Prise de contrôle de compte + fuite données |
| XF-01  | CRITIQUE | Surface d'attaque non contrôlée |
| BUG-01 | HAUTE | Noms jamais affichés (NULL) |
| BUG-02 | HAUTE | Crash runtime (SqliteError) |
| BUG-03 | HAUTE | Crash sur Node < 19 |
| RACE-01 | HAUTE | Doublons de référence BC/DEV |
| SEC-04 | HAUTE | Token dans réponse non sécurisée |
| PERF-01 | HAUTE | PRAGMA exécuté sur chaque requête |
| DATA-01 | HAUTE | Données orphelines FK après suppression |
| PERM-01 | HAUTE | Création de garage sans autorisation admin |
| XF-02  | HAUTE | Parsing d'erreur imprévisible côté client |

---

## Recommandations prioritaires

1. **Immédiat** — Corriger SEC-01, SEC-02, SEC-03 : sécuriser le flux de réinitialisation de mot de passe et forcer JWT_SECRET en env
2. **Court terme** — Corriger BUG-01, BUG-02, BUG-03, RACE-01 : bugs fonctionnels qui crashent ou produisent des données incorrectes
3. **Moyen terme** — Implémenter XF-01 (validation), XF-02 (erreurs standardisées), XF-07 (tests)
4. **Long terme** — Refactorer server.js (XF-09), ajouter optimistic locking (XF-04)

---

# ANNEXE F — Audit Schéma DB & Modules (Janvier 2025)

> *Contenu fusionné depuis SCHEMA_MODULE_AUDIT.md*

# Audit Complet — Schéma de Base de Données & Complétude des Modules

**Projet** : eM@g  
**Date** : 2025-01-XX  
**Périmètre** : `server/database.js` (2819 lignes, 82 tables), 12 fichiers de routes (~11 625 lignes)  
**Type** : Recherche uniquement — aucune modification de code

---

## Table des matières

1. [Partie 1 — Schéma de Base de Données](#partie-1--schéma-de-base-de-données)
2. [Partie 2 — Module Annuaire](#partie-2--module-annuaire)
3. [Partie 3 — Module Communication](#partie-3--module-communication)
4. [Partie 4 — Module Display Dashboard / TV](#partie-4--module-display-dashboard--tv)
5. [Partie 5 — Modules Stock & Commandes](#partie-5--modules-stock--commandes)
6. [Annexe — Modules complémentaires](#annexe--modules-complémentaires)

---

## Niveaux de sévérité

| Icône | Niveau | Description |
|-------|--------|-------------|
| 🔴 | **CRITIQUE** | Bug en production ou perte de données potentielle |
| 🟠 | **MAJEUR** | Comportement incorrect / incohérence fonctionnelle |
| 🟡 | **MODÉRÉ** | Dette technique, maintenabilité dégradée |
| 🔵 | **MINEUR** | Amélioration recommandée, bonnes pratiques |
| ⚪ | **INFO** | Observation, pas d'action requise |

---

## Partie 1 — Schéma de Base de Données

### 1.1 Vue d'ensemble

- **82 CREATE TABLE** dans `database.js`
- **17 fichiers de migration SQL** dans `server/migrations/`
- **SQLite** via `better-sqlite3`, mode WAL, synchronous FULL, foreign_keys ON
- **Seed data** : 18 compétences, ~80 postes, 23 structures juridiques, 23 types de service, 16 secteurs d'activité, 12 catégories de contacts, 8 catégories d'équipement, jours fériés 2025-2027

### 1.2 Findings

#### 🔴 CRITIQUE — Reconstruction de `task_assignments` (4 fois)

**Fichier** : `database.js` lignes 1818-1926

La table `task_assignments` est créée puis recréée par une migration qui DROP + RENAME pour corriger une contrainte CHECK sur `section`. Ce pattern :

- Peut perdre des données en cas d'erreur intermédiaire (bien que wrappé dans une transaction implicite)
- Recrée les index à chaque démarrage du serveur (5 CREATE INDEX IF NOT EXISTS)
- Le schéma originel et le schéma migré coexistent dans le même fichier de manière confuse

**Sections CHECK originale** : `'rdv','prep_locations','prep_prestations','prep_ventes','prep_installations','chargement','depart','enlevement','retour','recuperation','installation','evenements','taches_prioritaires','taches_secondaires','courses'`

**Sections CHECK migrée** : ajoute `'manual'`

**Risque** : Si une nouvelle section est ajoutée, il faut encore une migration destructive.

---

#### 🟠 MAJEUR — Système de clients dupliqué

**Tables impliquées** :
- `clients` (ligne 138) — champs basiques : `name, email, phone, address` → utilisé par `routes.js`
- `prestataires` (via annuaire, ligne ~2400+) — champs enrichis : `code_libre, siret, legal_structure_id, service_type_id`, etc. → utilisé par `annuaireRoutes.js`
- `suppliers` (ligne ~1600) — `name, email, phone, address, contact_name, notes` → utilisé par `ordersRoutes.js`

**Impact** :
- Un même client/fournisseur peut exister dans 2-3 tables non liées
- Pas de FK entre `clients` et `prestataires` ni entre `suppliers` et `prestataires`
- Les données annuaire ne bénéficient pas aux modules commandes/réservations

---

#### 🟠 MAJEUR — Colonnes manquantes dans des requêtes (display_messages)

**Schema** (`database.js:2239`) :
```sql
CREATE TABLE display_messages (
  ...
  body TEXT,          -- ← colonne existante
  is_active INTEGER,  -- ← colonne existante
  ...
)
```

**Requête** (`displayRoutes.js:1346`) :
```sql
SELECT content, priority FROM display_messages WHERE status = 'active'
```

→ Référence `content` (n'existe pas, devrait être `body`) et `status` (n'existe pas, devrait être `is_active = 1`).  
→ **Provoque une erreur SQL à l'exécution** du endpoint `/api/display/tv-state`.

---

#### 🟠 MAJEUR — Modifications de schéma au runtime

**Fichier** : `communicationRoutes.js` (endpoint `PUT /display-events/:id/assign`)

```javascript
try {
  db.exec('ALTER TABLE display_events ADD COLUMN assigned_person_id INTEGER');
} catch { /* column already exists */ }
```

Cela signifie que chaque appel à cet endpoint tente un ALTER TABLE avec un `try/catch` silencieux. Ce pattern :
- Masque les vraies erreurs SQL
- N'est pas idempotent de manière déclarative
- Devrait être dans `database.js` avec les autres migrations

---

#### 🟡 MODÉRÉ — Foreign keys sans index

De nombreuses colonnes FK n'ont pas d'index dédié. Les JOINs et DELETE CASCADE seront lents sur les tables volumineuses :

| Table | Colonne FK | Index manquant |
|-------|-----------|----------------|
| `equipment` | `category_id` | ❌ |
| `equipment_assignments` | `equipment_id` | ❌ |
| `equipment_assignments` | `assigned_to` | ❌ |
| `sav_tickets` | `equipment_id` | ❌ |
| `sav_tickets` | `reported_by` | ❌ |
| `sav_tickets` | `assigned_to` | ❌ |
| `orders` | `supplier_id` | ❌ |
| `order_items` | `order_id` | ❌ |
| `quotes` | `supplier_id` | ❌ |
| `quote_items` | `quote_id` | ❌ |
| `material_requests` | `requested_by` | ❌ |
| `message_attachments` | `message_id` | ❌ |
| `conversations` | `created_by` | ❌ |
| `display_messages` | `template_id` | ❌ |
| `display_playlist_items` | `playlist_id` | ❌ |

**Note** : Les tables bien indexées incluent `task_assignments`, `missions`, `mission_assignments`, `leave_requests`, `availabilities`, `stock_movements`, `display_events`.

---

#### 🟡 MODÉRÉ — Pas de contrainte NOT NULL sur des champs critiques

| Table | Colonne | Valeur possible NULL |
|-------|---------|---------------------|
| `equipment` | `name` | NULL autorisé (devrait être NOT NULL) |
| `orders` | `supplier_id` | NULL autorisé (commande sans fournisseur) |
| `sav_tickets` | `equipment_id` | NULL autorisé (par design pour tickets CSV non liés) |
| `persons` | `last_name` | NULL autorisé (seul `first_name` est NOT NULL implicitement dans INSERT) |
| `missions` | `title` | NOT NULL validé côté route mais pas en schema |

---

#### 🟡 MODÉRÉ — Migrations inline non versionnées

Les ALTER TABLE sont dispersés dans `database.js` avec des `try/catch` :
```javascript
try { db.exec('ALTER TABLE xxx ADD COLUMN yyy ...'); } catch { /* already exists */ }
```

Au moins **25+** de ces blocs existent dans database.js. Ils :
- Ne sont pas traçables dans `migrations_log`
- Ne permettent pas de rollback
- S'exécutent à chaque démarrage du serveur

Le système `migrations_log` + fichiers `.sql` dans `server/migrations/` existe mais n'est pas utilisé pour ces modifications inline.

---

#### 🔵 MINEUR — Nommage incohérent

| Incohérence | Exemples |
|-------------|----------|
| Statut boolean | `is_active` (display_messages) vs `status` (persons, equipment, missions) |
| Timestamps | `created_at TEXT DEFAULT (datetime('now'))` vs `created_at TEXT DEFAULT CURRENT_TIMESTAMP` |
| Clés étrangères | `created_by` (→ users.id) vs `reported_by` (→ users.id) vs `sent_by` (→ users.id) |
| Identifiants | `person_id` vs `assigned_to` (même sémantique = personne) |
| Pluriel/singulier | `drivers` (pluriel) vs `email_config` (singulier) |

---

#### 🔵 MINEUR — Tables potentiellement inutilisées

| Table | Observation |
|-------|-------------|
| `drivers` | Basique (name, license, phone). Aucune FK vers d'autres tables. Semble être un vestige d'un module transport antérieur. |
| `garages` | Basique (name, address, phone, email). Aucune FK. |
| `vehicles` | Référencé par `reservations.vehicle_id` et `missions.vehicle_id`, mais pas par le module équipement. |
| `reservations` | Module complet mais les routes ne sont plus dans routes.js. Possiblement migré vers missions. |
| `reservation_requests` | Doublon fonctionnel avec reservations. |

---

### 1.3 Points positifs

- ⚪ Mode WAL activé avec checkpoint auto (1000 pages) — bonnes performances en lecture concurrent
- ⚪ `foreign_keys = ON` activé — intégrité référentielle active
- ⚪ Indexes composites sur les tables les plus requêtées (leave_requests, missions, stock_movements)
- ⚪ Seed data complet pour les référentiels métier (positions, compétences, jours fériés)

---

## Partie 2 — Module Annuaire

**Fichiers** : `annuaireRoutes.js` (834 lignes), `routes.js` (672 lignes, partie clients)

### 2.1 Couverture fonctionnelle

| Fonctionnalité | Statut | Endpoint |
|----------------|--------|----------|
| CRUD Clients enrichis | ✅ | `/api/annuaire/clients` |
| CRUD Fournisseurs enrichis | ✅ | `/api/annuaire/suppliers` |
| CRUD Prestataires | ✅ | `/api/annuaire/prestataires` |
| CRUD Contacts | ✅ | `/api/annuaire/contacts` |
| Référentiels (4 tables lookup) | ✅ | `/api/annuaire/ref/*` |
| Recherche unifiée | ✅ | `/api/annuaire/search` |
| Statistiques | ✅ | `/api/annuaire/stats` |
| Import CSV clients | ✅ | `/api/annuaire/import/clients-csv` |
| Import CSV fournisseurs | ✅ | `/api/annuaire/import/suppliers-csv` |
| Export | ❌ | Non implémenté |
| Fusion de doublons | ❌ | Non implémenté |

### 2.2 Findings

#### 🟠 MAJEUR — Système client dupliqué (cf. §1.2)

`routes.js` expose un CRUD complet sur la table `clients` basique (GET/POST/PUT/DELETE `/api/clients`). `annuaireRoutes.js` expose un CRUD enrichi sur les tables annuaire. Rien ne les lie.

**Scénario de bug** : Un utilisateur crée un client via le formulaire de réservation (table `clients`), un autre le crée via l'annuaire (table enrichie). Deux entrées pour la même entité.

---

#### 🟡 MODÉRÉ — Normalisation téléphone incomplète

La normalisation de numéro de téléphone (retrait caractères non-numériques, padding à 10 chiffres) n'est appliquée que dans l'import CSV :

```javascript
// annuaireRoutes.js — import CSV seulement
const normalizePhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length < 10 ? digits.padStart(10, '0') : digits;
};
```

**Non appliquée** dans : POST/PUT des endpoints CRUD normaux. Un numéro peut donc être stocké sous forme `"06 12 34 56 78"`, `"0612345678"`, ou `"+33612345678"` selon le canal d'entrée.

---

#### 🟡 MODÉRÉ — Déduplication limitée au `code_libre`

L'import CSV utilise `ON CONFLICT(code_libre) DO UPDATE`, mais :
- Le `code_libre` n'est pas obligatoire dans le CRUD manuel
- Deux entrées avec le même SIRET mais des `code_libre` différents coexistent
- Pas de déduplication par nom+adresse, email, ou téléphone

---

#### 🔵 MINEUR — Soft-delete incomplet

Quand un client annuaire a des contacts liés, la suppression est refusée. Mais il n'y a pas de soft-delete (`is_deleted` ou `deleted_at`). L'utilisateur doit supprimer manuellement les contacts d'abord.

---

## Partie 3 — Module Communication

**Fichiers** : `communicationRoutes.js` (1523 lignes), `messagingRoutes.js` (368 lignes), `mailingRoutes.js` (299 lignes)

### 3.1 Couverture fonctionnelle

| Fonctionnalité | Statut | Fichier / Endpoint |
|----------------|--------|-------------------|
| Display events CRUD | ✅ | communicationRoutes — `/api/communication/display-events` |
| BL imports & BP items | ✅ | communicationRoutes — `/api/communication/bl-imports`, `/api/communication/bp-items` |
| Tasks CRUD + batch | ✅ | communicationRoutes — `/api/communication/tasks` |
| Export PDF feuille de route | ✅ | communicationRoutes — `/api/communication/export-pdf` |
| Planning affaires | ✅ | communicationRoutes — `/api/communication/planning-affaires` |
| Messagerie interne | ✅ | messagingRoutes — `/api/messaging/*` |
| Templates email | ✅ | mailingRoutes — `/api/mail-templates` |
| Envoi email SMTP | ✅ | mailingRoutes — `/api/mailing/send` |
| Historique mailing | ✅ | mailingRoutes — `/api/mailing/history` |
| Notifications temps réel | ❌ | Pas de WebSocket/SSE — polling uniquement |
| Recherche dans messages | ❌ | Non implémenté |

### 3.2 Findings

#### 🟠 MAJEUR — ALTER TABLE au runtime (cf. §1.2)

L'endpoint `PUT /api/communication/display-events/:id/assign` ajoute dynamiquement `assigned_person_id` via un try/catch silencieux. La colonne `visible` des display_events est ajoutée de la même manière.

---

#### 🟡 MODÉRÉ — Export PDF fragile

Le générateur PDF dans `communicationRoutes.js` (endpoint `/api/communication/export-pdf`) :

- Contient **16 sections hardcodées** avec des couleurs et ordres fixes
- Utilise un algorithme de dimensionnement dynamique pour tout faire tenir sur une page A4 (minFontSize = 5pt)
- Le stripping d'émojis est fait par regex partielle : `text.replace(/[\u{1F600}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')`
- Ne gère pas les caractères Unicode composés (emoji ZWJ sequences, drapeaux)
- Le layout est calculé en pixels empiriques sans tenir compte du rendu réel de PDFKit

---

#### 🟡 MODÉRÉ — Messagerie sans nettoyage des fichiers

Les fichiers uploadés via la messagerie (`messaging-uploads/`) ne sont jamais nettoyés :
- Pas de suppression quand un message est supprimé (le `DELETE /api/messaging/messages/:id` supprime l'entrée DB `message_attachments` mais pas le fichier sur disque)
- Pas de limite de stockage global
- Les noms de fichiers contiennent un timestamp + random, mais pas de vérification de chemin traversal au-delà du préfixe

---

#### 🔵 MINEUR — Mailing contacts incomplet

L'endpoint `/api/mailing/contacts` agrège des contacts de 4 tables (`users`, `persons`, `clients`, `suppliers`) mais :
- N'inclut pas les contacts de l'annuaire enrichi (`annuaire_contacts`)
- N'inclut pas les prestataires
- Utilise des `try/catch` vides pour chaque table (`/* table pas encore créée */`)

---

#### 🔵 MINEUR — Messagerie sans pagination des conversations

`GET /api/messaging/conversations` retourne TOUTES les conversations de l'utilisateur sans pagination. Pour un utilisateur avec beaucoup de conversations, cela peut dégrader les performances (sous-requêtes corrélées × nombre de conversations).

---

## Partie 4 — Module Display Dashboard / TV

**Fichier** : `displayRoutes.js` (1384 lignes)

### 4.1 Couverture fonctionnelle

| Fonctionnalité | Statut | Endpoint |
|----------------|--------|----------|
| Écrans CRUD + heartbeat | ✅ | `/api/display/screens` |
| Playlists CRUD + items | ✅ | `/api/display/playlists` |
| Upload/gestion médias | ✅ | `/api/display/media` |
| Messages/annonces CRUD | ✅ | `/api/display/messages` |
| Templates CRUD | ✅ | `/api/display/templates` |
| Logs + stats | ✅ | `/api/display/logs`, `/api/display/stats` |
| Config apparence TV | ✅ | `/api/display/appearance` |
| Messages d'accueil par jour/créneau | ✅ | `/api/display/welcome-messages` |
| Règles de couleur (mot-clé→couleur) | ✅ | `/api/display/color-rules` |
| Icônes de lieu + GIFs | ✅ | `/api/display/gifs`, `/api/display/location-icon-rules` |
| Logo upload | ✅ | `/api/display/logo` |
| Sneaky photo (overlay temporisé) | ✅ | `/api/display/sneaky-photo` |
| Sneaky message (message prioritaire temporisé) | ✅ | `/api/display/sneaky-message` |
| Météo (proxy OpenWeatherMap) | ✅ | `/api/display/weather` |
| Intégration Sonos | ✅ | `/api/display/sonos` |
| TV state (agrégation complète) | ⚠️ | `/api/display/tv-state` — **BUG SQL** |
| Multi-écrans / zones | ❌ | Un seul jeu de config global |

### 4.2 Findings

#### 🔴 CRITIQUE — Requête SQL invalide dans tv-state

**Fichier** : `displayRoutes.js:1346`

```javascript
const displayMessages = db.prepare(
  "SELECT content, priority FROM display_messages WHERE status = 'active' ORDER BY priority DESC LIMIT 8"
).all();
```

**Problèmes** :
1. La colonne `content` **n'existe pas** → devrait être `body`
2. La colonne `status` **n'existe pas** → devrait être `is_active = 1`
3. Le tri `ORDER BY priority DESC` trie alphabétiquement (`urgent > normal > low > high`) au lieu de par importance réelle

**Requête corrigée** :
```sql
SELECT body, priority FROM display_messages
WHERE is_active = 1 AND (date_end IS NULL OR date_end >= date('now'))
ORDER BY CASE priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 WHEN 'low' THEN 1 END DESC
LIMIT 8
```

---

#### 🟠 MAJEUR — Sneaky features stockées hors DB

Les fonctionnalités "sneaky photo" et "sneaky message" stockent leur état dans des fichiers JSON sur le filesystem (`sneaky-photo.json`, `sneaky-message.json`) au lieu de la base de données :

```javascript
const sneakyPath = join(__dirname, '..', 'public', 'display-sneaky', 'sneaky-photo.json');
writeFileSync(sneakyPath, JSON.stringify(data));
```

**Conséquences** :
- Pas de transaction atomique avec les autres opérations DB
- Pas de sauvegarde avec la DB (les backups SQLite ne les incluent pas)
- Pas d'historique/audit trail
- Race condition possible si deux admins modifient en même temps

---

#### 🟡 MODÉRÉ — Authentification écrans par token mais sans expiration

Les écrans TV utilisent un `auth_token` pour s'authentifier via `authenticateScreenToken`, mais :
- Le token n'a pas de date d'expiration
- Le token est stocké en clair dans la DB
- Pas de rotation automatique du token
- Un token compromis donne un accès permanent

---

#### 🟡 MODÉRÉ — Médias sans limite de nombre

L'upload média (`50 MB max` par fichier) n'a pas de :
- Limite sur le nombre total de fichiers
- Limite sur l'espace disque total utilisé
- Vérification du type MIME réel (seule l'extension est vérifiée)

---

#### 🔵 MINEUR — Config météo/Sonos en dur dans display_config

La clé API OpenWeatherMap et la config Sonos sont stockées dans la table `display_config` en tant que JSON. Pas de chiffrement des clés API.

---

## Partie 5 — Modules Stock & Commandes

**Fichiers** : `stockRoutes.js` (434 lignes), `ordersRoutes.js` (1368 lignes), `equipmentRoutes.js` (1300 lignes), `catalogRoutes.js` (775 lignes)

### 5.1 Couverture fonctionnelle — Stock

| Fonctionnalité | Statut | Endpoint |
|----------------|--------|----------|
| Catégories stock CRUD | ✅ | `/api/stock/categories` |
| Articles stock CRUD + recherche | ✅ | `/api/stock/items` |
| Mouvements (in/out/adjustment/return) | ✅ | `/api/stock/movements` |
| Stats (rupture, bas stock, top mouvements) | ✅ | `/api/stock/stats` |
| Alertes de stock bas | ❌ | Pas de notifications automatiques |
| Inventaire physique | ❌ | Non implémenté |

### 5.2 Couverture fonctionnelle — Commandes

| Fonctionnalité | Statut | Endpoint |
|----------------|--------|----------|
| Fournisseurs CRUD | ✅ | `/api/suppliers` |
| Commandes CRUD + workflow statut | ✅ | `/api/orders` |
| Devis CRUD + conversion en commande | ✅ | `/api/quotes` |
| Demandes matériel + validation admin | ✅ | `/api/material-requests` |
| Documents fournisseur | ✅ | `/api/supplier-documents` |
| Alertes de complétion | ✅ | `/api/completion-alerts` |
| Génération depuis BL | ✅ | `/api/orders/generate-from-bl` |
| Export PDF commande | ❌ | Non implémenté |

### 5.3 Couverture fonctionnelle — Équipement

| Fonctionnalité | Statut | Endpoint |
|----------------|--------|----------|
| Catégories hiérarchiques (famille/sous-famille/catégorie) | ✅ | `/api/equipment-categories` |
| Équipement CRUD + UID auto (EMAG-XXXXX) | ✅ | `/api/equipment` |
| Sérialisation (split quantité→entités individuelles) | ✅ | `/api/equipment/:id/serialize` |
| Import CSV Locmat | ✅ | `/api/equipment/import-csv` |
| Affectations (assign/return) | ✅ | `/api/equipment-assignments` |
| Tickets SAV CRUD + import CSV | ✅ | `/api/sav-tickets` |
| Rapport maintenance | ✅ | `/api/sav-tickets/report` |
| Listes favoris/surveillance | ✅ | `/api/equipment-lists` |
| Lookup par UID (QR code) | ✅ | `/api/equipment/by-uid/:uid` |
| Gestion photos matériel | ✅ | `/api/equipment-photos` |
| Zones de dépôt (2 dépôts) | ✅ | `/api/equipment-depot-zones` |
| Catalogue + flightcases + camions | ✅ | `/api/catalog/*` |
| Export 3D (Chargement 3D) | ✅ | `/api/reservations/:id/chargement-export` |
| Génération QR code | ❌ | Non implémenté côté serveur |

### 5.4 Findings

#### 🟠 MAJEUR — Transitions de statut commande non validées

L'endpoint `PUT /api/orders/:id` accepte n'importe quelle valeur de `status` sans vérifier la transition :

```javascript
// ordersRoutes.js — PUT /api/orders/:id
db.prepare('UPDATE orders SET ... status = ? ... WHERE id = ?').run(status, ...);
```

Un utilisateur pourrait passer directement de `received` à `draft`, ou de `cancelled` à `confirmed`. Il n'y a pas de machine à états.

**Transitions attendues** : `draft → sent → confirmed → partial → received` (avec `cancelled` comme état terminal).

---

#### 🟠 MAJEUR — Suppression de doublons SAV destructive

`DELETE /api/sav-tickets/duplicates` supprime physiquement les tickets considérés comme doublons (même `title` en lowercase). Le critère est fragile :

```sql
SELECT id FROM sav_tickets WHERE id NOT IN (
  SELECT MIN(id) FROM sav_tickets GROUP BY LOWER(TRIM(title))
)
```

- Deux interventions légitimes avec le même titre seraient considérées comme doublons
- La suppression est irréversible
- L'endpoint est admin-only mais sans confirmation/preview

---

#### 🟡 MODÉRÉ — Stock : pas de réversion de mouvement

Un mouvement de stock (`POST /api/stock/movements`) avec `type = 'out'` décrémente la quantité. Mais :
- Pas de mécanisme d'annulation d'un mouvement erroné
- Pas de mouvement inverse automatique
- L'adjustment peut compenser, mais sans traçabilité du lien avec le mouvement original

---

#### 🟡 MODÉRÉ — Equipment photo : LIKE pattern trop large

Lors de la suppression/renommage de photos, la mise à jour DB utilise `LIKE '%filename%'` :
```javascript
db.prepare("UPDATE equipment SET photo = NULL WHERE photo LIKE ?").run(`%${filename}%`);
```

Si un fichier `cam.jpg` est supprimé, cela affectera aussi les équipements pointant vers `webcam.jpg` ou `cam.jpg.bak`.

---

#### 🟡 MODÉRÉ — Auto-validation à la réception de BL

`autoValidateReceivedItems()` dans ordersRoutes.js marque automatiquement les items comme reçus quand un document de type `delivery_note` est uploadé. Mais :
- Pas de vérification des quantités (le BL peut être partiel)
- Pas de workflow de vérification physique
- La validation déclanche `checkOrderCompletion` qui peut cascader vers `checkAffaireCompletion`

---

#### 🔵 MINEUR — Catalogue : matching de référence fragile

Le matching dans `/api/catalog/equipment/match-references` normalise les références :
```javascript
const normalizeRef = (ref) => ref.trim().toLowerCase().replace(/[\s\-_.,;:/\\]+/g, '');
```

Mais la normalisation ne gère pas les préfixes/suffixes fournisseur courants, ni les zéros initiaux.

---

#### 🔵 MINEUR — Equipment CSV import sans rollback utilisateur

L'import CSV crée automatiquement la hiérarchie de catégories avec des icônes et couleurs par défaut. Si l'import est incorrect, l'utilisateur doit nettoyer manuellement les catégories créées.

---

## Annexe — Modules complémentaires

### A.1 Module Personnel (`personnelRoutes.js` — 1338 lignes)

**Couverture** : Complet — Persons CRUD, compétences, postes, disponibilités avec approbation, missions CRUD, affectations avec détection de conflits, planning global.

| Finding | Sévérité | Description |
|---------|----------|-------------|
| Approbation congés dupliquée | 🟡 MODÉRÉ | `personnelRoutes.js` a ses propres endpoints `approve`/`reject` sur les availabilities, tandis que `leaveRoutes.js` gère le workflow complet via `leave_requests`. Les deux systèmes modifient le même `leave_balances`. |
| Calcul jours pris naïf | 🟡 MODÉRÉ | Dans `approve` (personnelRoutes), le calcul des jours pris utilise `Math.round((end - start) / 86400000) + 1` — ne tient pas compte des week-ends ni jours fériés, contrairement à `leaveRoutes.js` qui utilise `calcWorkingDays()`. |
| Planning JSON parsing fragile | 🔵 MINEUR | Le parsing des assignments dans `/api/personnel/planning` utilise `GROUP_CONCAT` de `json_object()` puis split par `,{` — ne gère pas les virgules dans les valeurs JSON. |
| Email alerte affectation | ⚪ INFO | L'alerte email à la création d'affectation (`alertAssignmentCreated`) est fire-and-forget avec `.catch()`. Un échec est silencieux. |

### A.2 Module Congés (`leaveRoutes.js` — 1338 lignes)

**Couverture** : Très complet — Conformité IDCC 3252, congés exceptionnels (Art. L3142-1), signatures, justificatifs, arbitrage conflits, PDF, statistiques.

| Finding | Sévérité | Description |
|---------|----------|-------------|
| Report de congés simplifié | 🟡 MODÉRÉ | `getOrCreateBalance()` autorise le report jusqu'au 31 décembre de l'année suivante, mais la convention IDCC 3252 prévoit un report jusqu'au 31 mai de la période suivante (période de référence juin-mai). |
| Congé par défaut 25j vs 30j | 🟡 MODÉRÉ | Dans `personnelRoutes.js`→approve, le solde par défaut est 25 jours (`conge_paye ? 25 : 10`), tandis que dans `leaveRoutes.js` c'est `DAYS_PER_YEAR = 30`. Incohérence entre les deux systèmes. |
| Justificatifs en base64 | 🔵 MINEUR | Le upload de justificatif se fait via JSON body avec le fichier en base64. Pas de limite de taille côté route (limitée uniquement par les settings Express JSON globaux). |
| PDF côté client | ⚪ INFO | L'endpoint `/api/leaves/:id/pdf` retourne du HTML, pas un vrai PDF. Le commentaire dit "le client le convertira en PDF via window.print/jsPDF". |

### A.3 Module Messagerie (`messagingRoutes.js` — 368 lignes)

**Couverture** : Conversations directes et de groupe, messages texte/fichier/image/vidéo, read tracking, edit/delete.

| Finding | Sévérité | Description |
|---------|----------|-------------|
| Fichiers non nettoyés | 🟡 MODÉRÉ | cf. §3.2 — Le DELETE message supprime la ligne `message_attachments` mais pas le fichier `messaging-uploads/`. |
| Admin check inconsistent | 🔵 MINEUR | Le DELETE message vérifie `req.user.isAdmin` (camelCase) tandis que d'autres routes utilisent `requireAdmin` middleware ou `req.user.is_admin`. |
| Pas de WebSocket | ⚪ INFO | La messagerie est entièrement basée sur du polling HTTP. Pas de push en temps réel. |

### A.4 Module Mailing (`mailingRoutes.js` — 299 lignes)

**Couverture** : Templates CRUD, envoi SMTP avec variables, preview, historique, contacts agrégés.

| Finding | Sévérité | Description |
|---------|----------|-------------|
| Contacts annuaire manquants | 🔵 MINEUR | cf. §3.2 — `/api/mailing/contacts` n'inclut pas les contacts de l'annuaire enrichi. |
| Erreur d'envoi silencieuse | ⚪ INFO | Les erreurs d'envoi sont loggées en DB (`mail_history.status = 'error'`) mais aucune notification proactive à l'admin. |

---

## Résumé des findings par sévérité

| Sévérité | Nombre | Modules impactés |
|----------|--------|-----------------|
| 🔴 CRITIQUE | 2 | Schema (task_assignments reconstruction), Display (tv-state SQL invalide) |
| 🟠 MAJEUR | 7 | Schema (dual clients, ALTER runtime), Display (sneaky hors DB), Orders (transitions), SAV (doublons), Communication (display_messages mismatch) |
| 🟡 MODÉRÉ | 12 | Schema (FK indexes, NOT NULL, migrations inline, nommage), Annuaire (phone, dedup), Communication (PDF, fichiers), Display (tokens, médias), Stock (réversion), Equipment (LIKE pattern, auto-validation), Personnel (approbation dupliquée, calcul jours), Congés (report, 25j vs 30j) |
| 🔵 MINEUR | 9 | Schema (tables inutilisées), Annuaire (soft-delete), Communication (contacts mailing, pagination), Display (API keys), Stock (matching, CSV rollback), Personnel (JSON parsing), Messagerie (isAdmin), Mailing (contacts) |
| ⚪ INFO | 5 | Schema (WAL, FK, indexes), Personnel (email fire-and-forget), Congés (PDF HTML), Messagerie (WebSocket), Mailing (erreur silencieuse) |

**Total : 35 findings** dont 2 critiques nécessitant une correction immédiate.

---

## Recommandations prioritaires

1. **Corriger la requête tv-state** (`displayRoutes.js:1346`) — remplacer `content`→`body` et `status='active'`→`is_active=1`
2. **Déplacer les ALTER TABLE runtime** dans `database.js` avec les autres migrations
3. **Unifier le système clients** — FK de `clients` → annuaire ou migration des données
4. **Ajouter les index FK manquants** — script de migration one-time
5. **Implémenter une machine à états** pour les transitions de commandes
6. **Nettoyer les fichiers messaging** — ajouter `unlinkSync` dans DELETE message
7. **Harmoniser le calcul de jours de congés** entre personnelRoutes et leaveRoutes


---
---

# PARTIE II — AUDIT POST-MONOREPO (Mars 2026)

**Date** : 18 mars 2026  
**Périmètre** : Backend (24k+ lignes), Frontend React, Scripts, Infra, PWA, TV Client  
**Branche** : `dev`  
**Auditeur** : GitHub Copilot (Claude Opus 4.6)

---

## 📊 Synthèse Globale

| Sévérité | Nombre | Description |
|----------|--------|-------------|
| 🔴 Critique | **18** | Failles exploitables immédiatement, corruption de données, perte de backups |
| 🟠 Haute | **22** | Risques de crash, DoS, IDOR, race conditions |
| 🟡 Moyenne | **19** | Bugs fonctionnels, dette technique, maintenabilité |
| 🔵 Basse | **12** | Code mort, style, micro-optimisations |

**Score de sécurité global : 30/100** — Intervention urgente nécessaire.

---

## 🔴 PROBLÈMES CRITIQUES (18)

---

### CRIT-01 · Backups production défaillants (chemins cassés)

**Fichiers** : `apps/api/backup-database.sh:4-5`, `apps/api/backup-on-stop.sh:4-5`, `apps/api/ecosystem.config.js:9`  
**Impact** : ⚠️ **AUCUN BACKUP N'EST CRÉÉ** lors des redémarrages PM2

Les scripts de sauvegarde pointent vers l'ancien chemin `/Users/reunion/eM@g/server/vehicules.db` alors que la DB est en `/Users/reunion/eM@g/apps/api/vehicules.db`. PM2 appelle ces scripts (`post_update`) mais ils échouent silencieusement.

**Root cause** : Migration en monorepo sans mise à jour des scripts de backup.

```diff
--- a/apps/api/backup-database.sh
+++ b/apps/api/backup-database.sh
-DB_FILE="/Users/reunion/eM@g/server/vehicules.db"
-BACKUP_DIR="/Users/reunion/eM@g/server/backups"
+SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
+DB_FILE="$SCRIPT_DIR/vehicules.db"
+BACKUP_DIR="$SCRIPT_DIR/backups"
```

```diff
--- a/apps/api/backup-on-stop.sh
+++ b/apps/api/backup-on-stop.sh
-DB_FILE="/Users/reunion/eM@g/server/vehicules.db"
-BACKUP_DIR="/Users/reunion/eM@g/server/backups"
+SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
+DB_FILE="$SCRIPT_DIR/vehicules.db"
+BACKUP_DIR="$SCRIPT_DIR/backups"
```

---

### CRIT-02 · Bypass Helmet (désactivation des headers de sécurité)

**Fichier** : `apps/api/config/helmet.js:23-35`  
**Impact** : CSP, X-Frame-Options, X-Content-Type-Options désactivés pour toute route API sans token Authorization

La condition actuelle désactive Helmet pour TOUTES les routes `/api/` quand aucun header Authorization n'est envoyé — ce qui inclut les requêtes malveillantes.

```diff
--- a/apps/api/config/helmet.js
+++ b/apps/api/config/helmet.js
 export function helmetConditional(req, res, next) {
   const port = req.socket?.localPort;
   // TV client sur port 3001 — pas de CSP nécessaire
   if (port === 3001 || req.path.startsWith('/tv-client')) return next();
-  // Routes API sans auth — pas de helmet pour éviter les conflicts CORS préflight
-  if (req.path.startsWith('/api/') && !req.path.startsWith('/api/display/')
-      && !req.headers.authorization) {
-    return next();
-  }
+  // Seules les routes TV display publiques sont exemptées
+  if (req.path.startsWith('/api/display/tv/')) return next();
+  if (req.path === '/SNCF.wav') return next();
   return helmetMiddleware(req, res, next);
 }
```

---

### CRIT-03 · Upload de fichiers arbitraires (messaging)

**Fichier** : `apps/api/middleware/upload.js:68-70` (uploadMessaging)  
**Impact** : N'importe quel fichier peut être uploadé (.exe, .php, .sh) via la messagerie

```diff
--- a/apps/api/middleware/upload.js
+++ b/apps/api/middleware/upload.js
 export const uploadMessaging = multer({
   storage: createStorage('messaging-uploads', 'msg'),
   limits: { fileSize: 10 * 1024 * 1024 },
+  fileFilter: (_req, file, cb) => {
+    const allowed = /\.(pdf|jpg|jpeg|png|gif|webp|doc|docx|xls|xlsx|txt|csv|mp3|mp4|webm)$/i;
+    if (!allowed.test(path.extname(file.originalname))) {
+      return cb(new Error('Type de fichier non autorisé'));
+    }
+    cb(null, true);
+  }
 });
```

**ET** dans `messagingRoutes.js:200-225`, le fichier uploadé via base64 préserve l'extension originale du client :

```diff
--- a/apps/api/messagingRoutes.js
+++ b/apps/api/messagingRoutes.js
-  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${filename}`;
+  const SAFE_EXTS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
+    'image/webp': '.webp', 'video/mp4': '.mp4', 'application/pdf': '.pdf', 'text/plain': '.txt' };
+  const ext = SAFE_EXTS[mimeType] || '.bin';
+  const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
```

---

### CRIT-04 · Endpoint public exposant tous les emails utilisateurs

**Fichier** : `apps/api/authRoutes.js:328-344`  
**Endpoint** : `GET /api/auth/users-public` — **SANS authentification**  
**Impact** : Énumération complète des comptes utilisateur avec emails

```diff
--- a/apps/api/authRoutes.js
+++ b/apps/api/authRoutes.js
-  app.get('/api/auth/users-public', (req, res) => {
+  app.get('/api/auth/users-public', authenticateToken, (req, res) => {
     try {
-      const users = db.prepare('SELECT id, name, email, avatar FROM users').all();
+      const users = db.prepare('SELECT id, name, avatar FROM users').all();
       res.json(users);
```

---

### CRIT-05 · XSS dans templates email (injection HTML)

**Fichier** : `apps/api/emailService.js:200-240`  
**Impact** : Les données utilisateur (commentaires, noms de véhicules, descriptions) sont injectées dans les emails HTML sans échappement.

```diff
--- a/apps/api/emailService.js
+++ b/apps/api/emailService.js
+function escapeHtml(str) {
+  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
+  return (str || '').replace(/[&<>"']/g, c => map[c]);
+}
+
 // Utiliser escapeHtml() sur TOUTES les variables user dans le HTML des emails :
-<p><strong>Commentaire :</strong> ${leave.employee_comment}</p>
+<p><strong>Commentaire :</strong> ${escapeHtml(leave.employee_comment)}</p>
```

---

### CRIT-06 · Email Header Injection

**Fichier** : `apps/api/emailService.js:30-50`  
**Impact** : `from_name` de la config email peut contenir `\n` → injection de headers SMTP (Bcc)

```diff
--- a/apps/api/emailService.js
+++ b/apps/api/emailService.js
+function sanitizeEmailHeader(str) {
+  return (str || '').replace(/[\r\n]/g, '').replace(/"/g, '\\"').slice(0, 255);
+}
+
 from: `"${sanitizeEmailHeader(emailConfig.from_name || 'eM@g')}" <${emailConfig.smtp_user}>`,
```

---

### CRIT-07 · SSRF dans le proxy vidéo

**Fichier** : `apps/api/videoProxyService.js:68-82`  
**Impact** : `camera.rtsp_url` ou `camera.ip` peut pointer vers des IPs internes (127.0.0.1, 169.254.169.254, 10.x.x.x)

```diff
--- a/apps/api/videoProxyService.js
+++ b/apps/api/videoProxyService.js
+const BLOCKED_RANGES = [/^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./, /^255\./];
+
+function isValidCameraIP(ip) {
+  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return false;
+  // Autoriser le réseau local 192.168.x.x (caméras sur LAN)
+  return !BLOCKED_RANGES.some(r => r.test(ip));
+}
+
 export function buildRtspUrl(camera, password) {
-  if (camera.rtsp_url) return camera.rtsp_url;
+  if (camera.rtsp_url) {
+    if (!/^rtsp[s]?:\/\//.test(camera.rtsp_url)) throw new Error('rtsp_url doit être RTSP(S)');
+    return camera.rtsp_url;
+  }
+  if (!isValidCameraIP(camera.ip)) throw new Error('Adresse IP bloquée');
```

---

### CRIT-08 · Path Traversal dans displayRoutes (suppression de GIFs)

**Fichier** : `apps/api/displayRoutes.js:1965`  
**Impact** : Le paramètre filename peut être encodé en double-encoding ou Unicode pour contourner la sanitization et supprimer des fichiers arbitraires.

```diff
--- a/apps/api/displayRoutes.js
+++ b/apps/api/displayRoutes.js
-  const sanitized = req.params.filename.replace(/\.\.[\/\\]/g, '').replace(/[\/\\]/g, '');
+  const sanitized = path.basename(req.params.filename);
+  if (!sanitized || sanitized !== req.params.filename || /\.\./.test(sanitized)) {
+    return res.status(400).json({ error: 'Nom de fichier invalide' });
+  }
   const filePath = join(gifsDir, sanitized);
+  if (!filePath.startsWith(path.resolve(gifsDir))) {
+    return res.status(403).json({ error: 'Accès interdit' });
+  }
```

---

### CRIT-09 · Path Traversal dans attachmentsRoutes

**Fichier** : `apps/api/attachmentsRoutes.js:10-86`  
**Impact** : `sanitizePath()` utilise `path.resolve()` + `startsWith()` qui peut être contourné via encodage. La regex de validation affaireId est trop permissive.

```diff
--- a/apps/api/attachmentsRoutes.js
+++ b/apps/api/attachmentsRoutes.js
 function sanitizePath(basePath, relativePath) {
-  const resolved = path.resolve(basePath, relativePath);
-  if (!resolved.startsWith(basePath)) return null;
-  return resolved;
+  const normalizedBase = path.resolve(basePath);
+  const resolved = path.resolve(basePath, relativePath);
+  if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) return null;
+  return resolved;
 }
```

---

### CRIT-10 · Tokens JWT stockés en localStorage (frontend)

**Fichier** : `apps/web/src/utils/api/base.js:60-73`, `apps/web/src/contexts/AuthContext.jsx`  
**Impact** : Tout code JavaScript (extension, XSS) peut lire les tokens d'authentification

**Ce problème nécessite une refonte du mécanisme d'auth** (migration vers httpOnly cookies). C'est un correctif moyen terme mais CRITIQUE en impact.

Plan de migration :
1. Backend : `/api/auth/login` retourne le token en cookie `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict`
2. Backend middleware authenticate : lire le token depuis `req.cookies.token` en plus de `Authorization`
3. Frontend : `fetch(..., { credentials: 'include' })` partout
4. Frontend : supprimer `localStorage.getItem('auth_token')`

---

### CRIT-11 · Tokens Google OAuth en localStorage

**Fichiers** : `GoogleCalendarBanner.jsx:663`, `AffairesPanel.jsx:116`, `PeriodCalendarModal.jsx:124`  
**Impact** : Tokens d'accès Google Calendar exposés à XSS

Même solution que CRIT-10 : proxier Google Calendar via le backend.

---

### CRIT-12 · Race condition sérialisation équipement (TOCTOU)

**Fichier** : `apps/api/equipmentRoutes.js:520-560`  
**Impact** : Deux requêtes parallèles créent des doublons et corrompent les données

```diff
--- a/apps/api/equipmentRoutes.js
+++ b/apps/api/equipmentRoutes.js
+  const serializeEquipment = db.transaction((id, userId) => {
+    const original = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id);
+    if (!original) throw { status: 404, error: 'Équipement non trouvé' };
+    const qty = parseInt(original.stock_quantity, 10) || 1;
+    if (qty <= 1) throw { status: 400, error: 'Quantité insuffisante' };
+    // ... reste de la logique dans la transaction
+    return result;
+  });
```

---

### CRIT-13 · Clé de chiffrement vidéo volatile

**Fichier** : `apps/api/videoProxyService.js:1-10`  
**Impact** : Sans `VIDEO_CIPHER_KEY` en env, une clé aléatoire est générée → les mots de passe caméra deviennent indéchiffrables au prochain redémarrage

```diff
--- a/apps/api/videoProxyService.js
+++ b/apps/api/videoProxyService.js
-const CIPHER_KEY = process.env.VIDEO_CIPHER_KEY || crypto.randomBytes(32).toString('hex');
+if (!process.env.VIDEO_CIPHER_KEY) {
+  logger.warn('⚠️  VIDEO_CIPHER_KEY non défini — les mots de passe caméra seront perdus au redémarrage');
+}
+const CIPHER_KEY = process.env.VIDEO_CIPHER_KEY || crypto.randomBytes(32).toString('hex');
```

---

### CRIT-14 · URL backend codée en dur dans le frontend

**Fichier** : `apps/web/src/components/management/UserManagement.jsx:128`  
**Impact** : Appel direct à `http://localhost:3002` qui bypasse le proxy Vite et ne fonctionne pas en production

```diff
--- a/apps/web/src/components/management/UserManagement.jsx
+++ b/apps/web/src/components/management/UserManagement.jsx
-  const response = await fetch(`http://localhost:3002/api/users/${userId}/reset-password`, {
-    method: 'POST',
-    headers: {
-      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
-      'Content-Type': 'application/json'
-    }
-  });
+  const response = await api.request(`/api/users/${userId}/reset-password`, { method: 'POST' });
```

---

### CRIT-15 · Upload SVG avec JavaScript (XSS stored)

**Fichier** : `apps/api/middleware/upload.js:56`  
**Impact** : Les SVG uploadés via `uploadMedia` peuvent contenir du JavaScript exécutable

```diff
--- a/apps/api/middleware/upload.js
+++ b/apps/api/middleware/upload.js
 const allowedMimes = [
   'image/jpeg', 'image/png', 'image/gif', 'image/webp',
-  'image/svg+xml',
   'video/mp4', 'video/webm', 'video/ogg',
 ];
```

---

### CRIT-16 · CSP trop permissive (`unsafe-inline`)

**Fichier** : `apps/api/config/helmet.js:8-9`  
**Impact** : `'unsafe-inline'` pour scriptSrc désactive la protection CSP contre les scripts injectés

Correctif moyen terme : migration vers nonces CSP.

---

### CRIT-17 · CORS accepte les requêtes sans Origin + credentials

**Fichier** : `apps/api/config/cors.js:19`  
**Impact** : Requêtes sans header Origin acceptées avec `credentials: true` → CSRF possible

```diff
--- a/apps/api/config/cors.js
+++ b/apps/api/config/cors.js
 origin: function(origin, callback) {
-  if (!origin) return callback(null, true);
+  if (!origin) {
+    if (process.env.NODE_ENV === 'development') return callback(null, true);
+    return callback(new Error('Origin header requis'), false);
+  }
   if (allowedOrigins.includes(origin)) return callback(null, true);
```

---

### CRIT-18 · Debug endpoints accessibles en production

**Fichier** : `apps/api/server.js:242-253`  
**Impact** : `/api/debug/route-test` et `/api/debug/routes` sont accessibles SANS authentification en production

```diff
--- a/apps/api/server.js
+++ b/apps/api/server.js
+if (isDev) {
   app.get('/api/debug/route-test', (req, res) => {
     res.json({ ok: true, isDev, env: process.env.NODE_ENV, args: process.argv });
   });
   app.get('/api/debug/routes', (req, res) => {
     const routes = [];
     app._router.stack.forEach((middleware) => { /* ... */ });
     res.json({ routes });
   });
+}
```

---

## 🟠 PROBLÈMES HAUTS (22)

---

### HIGH-01 · Cache d'authentification non invalidé au logout

**Fichier** : `apps/api/middleware/authenticate.js:24-27`  
Le cache de 30s permet à un token révoqué de rester valide pendant 30 secondes après logout.

**Fix** : Invalider le cache au logout : `authCache.delete(tokenHash)`

---

### HIGH-02 · Rate limiting auth trop permissif (20 tentatives/15min)

**Fichier** : `apps/api/config/rateLimiter.js:6-8`

**Fix** : Réduire à 5 tentatives, ajouter `skipSuccessfulRequests: true`

---

### HIGH-03 · Pas de `trust proxy` configuré

**Fichier** : `apps/api/server.js` (absent)  
Derrière un reverse proxy, toutes les requêtes viennent de 127.0.0.1 → rate limiter inefficace.

**Fix** : `app.set('trust proxy', 1);`

---

### HIGH-04 · IDOR vidéo (accès caméras sans vérification permissions)

**Fichier** : `apps/api/videoRoutes.js:88-100`  
N'importe quel utilisateur authentifié peut accéder à n'importe quelle caméra.

**Fix** : Ajouter vérification `requireAdmin` sur les routes vidéo sensibles.

---

### HIGH-05 · IDOR congés (ownership check fragile)

**Fichier** : `apps/api/leaveRoutes.js:770-800`  
Si `is_admin` est `null/undefined`, la condition passe.

**Fix** : `if (!currentUser?.is_admin === true && request.owner_user_id !== req.user.id)`

---

### HIGH-06 · Race condition leave_balances hors transaction

**Fichier** : `apps/api/leaveRoutes.js:900-920`  
Mise à jour du solde de congés en dehors de la transaction → double déduction possible.

**Fix** : Inclure `leave_balances` dans le `db.transaction()`.

---

### HIGH-07 · N+1 queries dans messagingRoutes

**Fichier** : `apps/api/messagingRoutes.js:37-56`  
1 query par conversation pour les participants.

**Fix** : Utiliser `json_group_array()` dans un JOIN unique.

---

### HIGH-08 · XSS dans templates mailing (substituteVariables)

**Fichier** : `apps/api/mailingRoutes.js:9-13`  
Variables substituées dans le HTML sans échappement.

**Fix** : Ajouter `escapeHtml()` dans `substituteVariables()`.

---

### HIGH-09 · Directory listing DoS (equipment-photos)

**Fichier** : `apps/api/equipmentRoutes.js:1180`  
`readdirSync()` sans limite → OOM si beaucoup de fichiers.

**Fix** : Limiter à 500 fichiers, ou paginer.

---

### HIGH-10 · parseInt sans vérification NaN (display/logs)

**Fichier** : `apps/api/displayRoutes.js:1645`

**Fix** : `const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 100, 1000));`

---

### HIGH-11 · Suppression fichier TOCTOU (equipment-photos)

**Fichier** : `apps/api/equipmentRoutes.js:1250`

**Fix** : Wrapper `unlinkSync` dans un try/catch.

---

### HIGH-12 · Queries sans LIMIT (affaires, persons, etc.)

**Fichiers** : `affairesRoutes.js:30-73`, `personnelRoutes.js:1190`  
GROUP BY et SELECT * sans LIMIT → OOM avec beaucoup de données.

**Fix** : Ajouter `LIMIT 1000` ou pagination.

---

### HIGH-13 · Index manquants sur colonnes critiques

**Fichier** : `apps/api/database.js`

```sql
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_vehicles_registration ON vehicles(registration);
CREATE INDEX IF NOT EXISTS idx_persons_email ON persons(email);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token_hash);
```

---

### HIGH-14 · Email config non rechargée (emailService)

**Fichier** : `apps/api/emailService.js:12-30`  
Config SMTP mise en cache global, jamais re-lue depuis la DB.

**Fix** : Cache avec TTL de 60s ou re-lecture à chaque envoi.

---

### HIGH-15 · Pas de rate limiting sur envoi d'emails

**Fichier** : `apps/api/emailService.js`  
100 demandes d'accès = 100 emails envoyés sans throttle.

---

### HIGH-16 · Foreign keys inconsistantes (SET NULL vs CASCADE)

**Fichier** : `apps/api/database.js:100-250`  
Mélange illogique de DELETE CASCADE et SET NULL → perte d'historique d'audit.

---

### HIGH-17 · Scripts backup sans `set -e`

**Fichiers** : `apps/api/backup-database.sh`, `apps/api/backup-on-stop.sh`  
Erreurs silencieuses si la copie de DB échoue.

**Fix** : Ajouter `set -euo pipefail` en ligne 2.

---

### HIGH-18 · `ls | xargs` dangereux dans backup

**Fichier** : `apps/api/backup-database.sh:18`

**Fix** : `find "$BACKUP_DIR" -name 'vehicules_backup_*.db' -mtime +30 -delete`

---

### HIGH-19 · OAuth Google sans validation state/nonce

**Fichier** : `apps/web/src/components/vehicles/GoogleCalendarBanner.jsx:650-690`

---

### HIGH-20 · Appels fetch directs avec localStorage dans composants

**Fichiers** : `UserManagement.jsx`, `EventDetailsModal.jsx`, `ProfileEditModal.jsx`  
Anti-pattern : chaque composant gère son propre auth au lieu d'utiliser le client API centralisé.

---

### HIGH-21 · Race condition equipment assignment (double attribution)

**Fichier** : `apps/api/equipmentRoutes.js:850`  
Vérification status + update non atomiques → deux assignments pour le même équipement.

---

### HIGH-22 · Upload photos équipement sans vérification magic bytes

**Fichier** : `apps/api/equipmentRoutes.js:1155`  
Validation par extension seule (`.jpg.php` passe).

---

## 🟡 PROBLÈMES MOYENS (19)

| # | Description | Fichier | Fix |
|---|-------------|---------|-----|
| MED-01 | Routes display TV sans auth | displayRoutes.js:1905 | Ajouter token écran |
| MED-02 | JSON colonnes sans validation | database.js (20+ cols) | `CHECK(json_valid(...))` |
| MED-03 | Migration controles_techniques sans transaction | database.js:1215 | Wrapper en transaction |
| MED-04 | WAL autocheckpoint trop fréquent (1000) | database.js:39 | Passer à 10000 |
| MED-05 | Migrations complexes sans rollback propre | migrations.js:200 | `BEGIN IMMEDIATE` + meilleur catch |
| MED-06 | XSS via exemptions sanitize (signatures) | middleware/sanitize.js:7 | Valider base64 |
| MED-07 | Information disclosure dans erreurs | middleware/errorHandler.js:14 | Messages génériques |
| MED-08 | CSV injection via import annuaire | annuaireRoutes.js:915 | Rejeter `=+\-@` en tête |
| MED-09 | Email injection stockée (suppliers) | ordersRoutes.js:180 | Validation email stricte |
| MED-10 | Regex affaireId trop permissive | attachmentsRoutes.js:15 | Regex plus stricte |
| MED-11 | Offset sans limite max | supplierCatalogRoutes.js:21 | `max(offset) = 100000` |
| MED-12 | Rate limiting vidéo in-memory (volatile) | videoRoutes.js:14 | TTL cleanup |
| MED-13 | JSON.parse sans try/catch (frontend) | api/base.js:61, AuthContext.jsx:64 | `safeJSONParse()` |
| MED-14 | Cache version SW manuelle (v45) | public/sw.js:4 | Versionner au build |
| MED-15 | Log permissions non vérifiées | ecosystem.config.js:12 | `chmod 700 logs/` |
| MED-16 | Category parent_id cycle possible | equipmentRoutes.js:180 | Cycle detection |
| MED-17 | Double-assignment équipement | equipmentRoutes.js:850 | Transaction atomique |
| MED-18 | ReDoS potentiel dans recherche | annuaireRoutes.js:475 | Set lookup au lieu de regex |
| MED-19 | allowedHosts: true dans Vite config | vite.config.js:57 | Whitelist domaines |

---

## 🔵 PROBLÈMES MINEURS (12)

| # | Description | Fichier |
|---|-------------|---------|
| LOW-01 | database.js monolithique (2954 lignes) | database.js |
| LOW-02 | Depot zones hardcodées | migrations.js:120 |
| LOW-03 | Pas de timeout/LIMIT sur getHistory() | db-helpers.js |
| LOW-04 | Variable globale alarmTestTimestamp | displayRoutes.js:23 |
| LOW-05 | Regex cleanTaskTitle inefficiente | planningRoutes.js:1400 |
| LOW-06 | AbortError non spécifiquement géré | planningRoutes.js:2650 |
| LOW-07 | Constantes congés hardcodées | leaveRoutes.js:25 |
| LOW-08 | Coercion implicite de types | equipmentRoutes.js:470 |
| LOW-09 | Domain production dans logs deploy | safe-deploy.sh:77 |
| LOW-10 | PM2 chemins absolus user-specific | ecosystem.config.js:3-5 |
| LOW-11 | Pas d'utilisateur système dédié | ecosystem.config.js |
| LOW-12 | Exposition domaine DuckDNS | safe-deploy.sh |

---

## 🛠️ PLAN DE STABILISATION

### Phase 1 — Urgence (à déployer immédiatement)

| # | Action | Effort | Risque |
|---|--------|--------|--------|
| 1 | Corriger chemins backup-database.sh + backup-on-stop.sh | 10 min | Nul |
| 2 | Protéger debug endpoints (`if (isDev)`) | 5 min | Nul |
| 3 | Ajouter `authenticateToken` sur `/api/auth/users-public` | 5 min | Null (frontend déjà auth) |
| 4 | Ajouter escapeHtml() dans emailService.js | 15 min | Nul |
| 5 | Retirer SVG de uploadMedia allowedMimes | 2 min | Faible |
| 6 | Ajouter fileFilter sur uploadMessaging | 5 min | Nul |
| 7 | Fixer Helmet bypass condition | 10 min | Faible (tester CORS) |
| 8 | Fixer CORS !origin en prod | 5 min | Faible |
| 9 | Ajouter sanitizeEmailHeader() | 5 min | Nul |
| 10 | Path traversal : `path.basename()` dans displayRoutes | 10 min | Nul |

### Phase 2 — Court terme (1-2 semaines)

| # | Action | Effort |
|---|--------|--------|
| 1 | Ajouter les index SQL manquants | 15 min |
| 2 | Ajouter `app.set('trust proxy', 1)` | 2 min |
| 3 | Réduire rate limit auth à 5 | 2 min |
| 4 | Invalider cache auth au logout | 15 min |
| 5 | Transaction atomique sérialisation équipement | 30 min |
| 6 | Transaction atomique leave_balances | 30 min |
| 7 | Fix N+1 messaging (json_group_array) | 30 min |
| 8 | LIMIT sur toutes les queries unbounded | 1h |
| 9 | Valider SSRF dans videoProxyService | 30 min |
| 10 | Fixer URL hardcodée dans UserManagement.jsx | 5 min |
| 11 | Fix `set -euo pipefail` dans scripts backup | 5 min |

### Phase 3 — Moyen terme (1-3 mois)

| # | Action | Effort |
|---|--------|--------|
| 1 | Migration auth localStorage → httpOnly cookies | 3-5 jours |
| 2 | Proxy Google Calendar via backend | 2-3 jours |
| 3 | CSP avec nonces (suppression unsafe-inline) | 2 jours |
| 4 | Refactorer database.js en modules | 2 jours |
| 5 | Centraliser tous les appels API frontend | 1 jour |
| 6 | Validation magic bytes sur uploads | 1 jour |
| 7 | Tests de sécurité automatisés (OWASP ZAP) | 2 jours |
| 8 | Versioning automatique du Service Worker | 1 jour |

### Phase 4 — Long terme (3-6 mois)

| # | Action |
|---|--------|
| 1 | Design system + composants réutilisables |
| 2 | Tests e2e (Playwright/Cypress) |
| 3 | CI/CD avec linting sécurité (eslint-plugin-security) |
| 4 | Utilisateur système dédié pour PM2 |
| 5 | Monitoring applicatif (Sentry) |
| 6 | Audit de dépendances automatisé (npm audit, Dependabot) |

---

## ✅ Points Positifs Identifiés

1. **Requêtes SQL paramétrées** — 99% des queries utilisent `db.prepare().run/get/all()` ✅
2. **Compression activée** — `compression({ threshold: 1024 })` ✅
3. **WAL mode + FULL sync** — Bonne configuration SQLite ✅
4. **Graceful shutdown** — Properly handles SIGTERM/SIGINT ✅
5. **DOMPurify utilisé** dans le frontend pour le mailing ✅
6. **Source maps désactivées** en production ✅
7. **rel="noopener noreferrer"** sur tous les `target="_blank"` ✅
8. **Nettoyage automatique** des sessions et fichiers TEMP ✅
9. **Foreign keys activées** ✅
10. **Logs structurés** avec Winston ✅

---

*Rapport généré le 18 mars 2026 — GitHub Copilot (Claude Opus 4.6)*
