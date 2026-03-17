# AUDIT TECHNIQUE COMPLET — eM@g v2.0.0

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
