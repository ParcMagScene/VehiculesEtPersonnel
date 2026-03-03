# AUDIT TECHNIQUE COMPLET — eM@g v2.0.0

> **Date** : Juillet 2025  
> **Auditeur** : Copilot (Claude Opus 4.6)  
> **Périmètre** : Frontend React, Backend Express, SQLite, CSS, Sécurité, UX, Modules métier  
> **Total lignes source** : ~138 500 (250+ fichiers)

---

## TABLE DES MATIÈRES

1. [Architecture globale](#1-architecture-globale)
2. [Inventaire chiffré](#2-inventaire-chiffré)
3. [Audit sécurité](#3-audit-sécurité)
4. [Audit base de données](#4-audit-base-de-données)
5. [Audit backend](#5-audit-backend)
6. [Audit frontend React](#6-audit-frontend-react)
7. [Audit CSS / Design System](#7-audit-css--design-system)
8. [Audit modules métier](#8-audit-modules-métier)
9. [Plan de corrections priorisé](#9-plan-de-corrections-priorisé)
10. [Migrations SQL idempotentes](#10-migrations-sql-idempotentes)
11. [Design System unifié — Tokens manquants](#11-design-system-unifié--tokens-manquants)
12. [Annexes](#12-annexes)

---

## 1. ARCHITECTURE GLOBALE

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
│  SQLite (better-sqlite3) — WAL mode — ~80 tables — 17 migrations  │
│  Multer (uploads) │ Nodemailer (mailing) │ PDFKit │ PM2 (prod)     │
└─────────────────────────────────────────────────────────────────────┘

FRONTEND REACT : App.jsx → Header + 14 modules lazy-loaded
  ├─ Calendar.jsx (2 760 l.) — Calendrier véhicules
  ├─ PersonnelPanel.jsx (2 391 l.) — Personnel, compétences, missions
  ├─ EquipmentPanel.jsx (2 372 l.) — Parc matériel individualisé
  ├─ AffairesPanel + AffaireDetailPanel — Affaires projets
  ├─ TaskPlanningPanel.jsx (1 715 l.) — Planning tâches jour/semaine
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

---

## 2. INVENTAIRE CHIFFRÉ

| Catégorie | Fichiers | Lignes |
|-----------|----------|-------:|
| Backend (server/) | 17 | 18 902 |
| Composants JSX (desktop) | 83 | ~42 000 |
| Composants JSX (mobile) | 16 | ~5 410 |
| Composants JSX (DisplayDashboard) | 21 | ~10 410 |
| CSS composants | 85 | 51 341 |
| CSS globaux (App/theme/index) | 4 | 3 851 |
| Utilitaires (utils/) | 14 | 4 678 |
| Hooks + Contextes | 7 | 391 |
| **TOTAL** | **~250** | **~138 461** |

| Métrique technique | Valeur |
|--------------------|--------|
| Tables SQLite | ~80 |
| Routes API | ~380+ |
| Méthodes API client (api.js) | ~364 |
| Variables CSS (theme.css) | ~120 |
| Palettes de thème | 7 |
| Stores IndexedDB | 12 |
| Migrations SQL | 17 |

---

## 3. AUDIT SÉCURITÉ

### 3.1 Vulnérabilités CRITIQUES

#### [CRIT-1] Self-reset-password exploitable — Prise de contrôle de compte
- **Endpoint** : `POST /api/auth/self-reset-password`
- **Fichier** : `server/server.js` ~L270
- **Problème** : La vérification d'identité repose uniquement sur `email + nom` (case-insensitive). Un attaquant connaissant l'email et le nom d'un employé (LinkedIn, organigramme) peut déclencher un reset → `password_reset_required = 1`.
- **Impact** : Combiné avec CRIT-2, prise de contrôle complète de n'importe quel compte.

#### [CRIT-2] Set-new-password sans token signé
- **Endpoint** : `POST /api/auth/set-new-password`
- **Fichier** : `server/server.js` ~L1790
- **Problème** : Requiert uniquement `email + newPassword`. Seule vérification : `password_reset_required = 1` en base. Après CRIT-1, un attaquant définit le mot de passe de son choix.
- **Impact** : Accès complet avec les privilèges de la victime.

**Chaîne d'attaque :**
```
POST /api/auth/self-reset-password {email, name}  → password_reset_required = 1
POST /api/auth/set-new-password {email, newPassword}  → mot de passe changé
POST /api/auth/login {email, password}  → JWT valide 30 jours
```

**Remédiation** : Implémenter un vrai flux OTP par email avec token signé temporaire (voir §10).

---

### 3.2 Vulnérabilités HAUTES

| ID | Vulnérabilité | Fichier | Impact |
|----|---------------|---------|--------|
| HIGH-1 | `authenticateToken` ne vérifie pas la session en DB → tokens révoqués restent valides | `server.js` ~L119 | Impossible de révoquer un accès compromis pendant 30j |
| HIGH-2 | JWT_SECRET dev hardcodé dans le repo Git | `server.js` ~L57, `.env.development` | Forgerie de tokens si mode dev activé en prod |
| HIGH-3 | Mot de passe SMTP stocké en clair dans `email_config.pass` | `database.js` ~L1109 | Si DB compromise → compte email compromis |

### 3.3 Vulnérabilités MOYENNES

| ID | Vulnérabilité | Fichier |
|----|---------------|---------|
| MED-1 | Énumération d'emails sans auth (`check-email`, `check-reset`) | server.js ~L1535/~L1750 |
| MED-2 | Path traversal dans suppression GIFs (`path.join` sans sanitize) | displayRoutes.js ~L993 |
| MED-3 | Upload `application/octet-stream` autorisé (contournement MIME) | server.js config multer |
| MED-4 | Pas de helmet → CSP, Permissions-Policy manquantes | server.js |
| MED-5 | Déconnexion supprime TOUTES les sessions (pas seulement la courante) | server.js ~L422 |
| MED-6 | Aucune validation d'entrée structurée (pas Joi/Zod/express-validator) | Tous routes |
| MED-7 | `express.json({ limit: '10mb' })` global → payload abuse | server.js |
| MED-8 | Pas de CAPTCHA sur endpoints publics | server.js |

### 3.4 Points positifs sécurité
- ✅ 100% prepared statements SQLite (0 injection SQL)
- ✅ bcrypt 10 salt rounds
- ✅ sanitizePath() pour attachments
- ✅ Rate limiting (20/15m auth, 600/1m API)
- ✅ WAL mode + checkpoint auto
- ✅ Token hash SHA-256 en DB (pas le JWT brut)
- ✅ 6 headers de sécurité manuels
- ✅ Guard JWT secret en production (process.exit)
- ✅ DOMPurify sur dangerouslySetInnerHTML
- ✅ Validation SIRET/TVA dans l'annuaire
- ✅ Nettoyage temp auto (>24h toutes les 6h)

---

## 4. AUDIT BASE DE DONNÉES

### 4.1 Index manquants critiques

| Sévérité | Table | Colonnes | Justification |
|----------|-------|----------|---------------|
| **HAUTE** | `active_sessions` | `token_hash` | Chaque requête auth fait un scan complet |
| **HAUTE** | `active_sessions` | `expires_at` | Nettoyage sessions expirées = full scan |
| **HAUTE** | `reservations` | `vehicle_id, start_date, end_date` | Détection conflits de réservation |
| **HAUTE** | `reservations` | `status` | Filtre omniprésent |
| **MOYENNE** | `maintenances` | `vehicle_id, status, date` | Suivi véhicule |
| **MOYENNE** | `modification_history` | `entity_type, entity_id` | Audit trail |
| **MOYENNE** | `access_requests` | `status` | Filtre admin |
| **BASSE** | `mail_history` | `sent_by, status` | Historique envois |
| **BASSE** | `bl_imports` | `affaire_id` | Recherche BL par affaire |

### 4.2 FK sans ON DELETE (20+ cas)

Tables affectées : `vehicles`, `reservations` (5 FK), `clients`, `drivers`, `locations`, `garages`, `maintenances` (3 FK), `conversations`, `conversation_participants`, `messages`, `equipment`, `reservation_requests` (3 FK), `supplier_documents` (2 FK).

**Risque** : `FOREIGN KEY constraint failed` si suppression d'un parent → erreur 500 en prod.

**Remédiation** : `ON DELETE SET NULL` pour `created_by` / `modified_by`, `ON DELETE RESTRICT` pour les vraies relations.

### 4.3 FK logiques non déclarées

| Table | Colonne | Devrait référencer |
|-------|---------|-------------------|
| `bl_imports` | `created_by` | users(id) |
| `bl_imports` | `affaire_id` | affaires(numero_affaire) |
| `mail_history` | `template_id` | mail_templates(id) |
| `material_requests` | `supplier_id`, `affaire_id`, `order_id` | respectifs |
| `completion_alerts` | `recipient_id` | users(id) |

### 4.4 Incohérence Affaire ID — Double identifiant

La table `affaires` a **deux identifiants** :
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `numero_affaire TEXT NOT NULL UNIQUE`

**Problème** : `affaire_links` utilise l'`id` INTEGER avec FK propres, mais **toutes les autres tables** (`task_assignments`, `bl_imports`, `dynamic_display_events`, `material_requests`, `planning_hidden_affaires`) stockent le `numero_affaire` dans un champ nommé de façon trompeuse `affaire_id TEXT`, sans FK formelle.

### 4.5 Migrations non idempotentes — 27 ALTER TABLE risqués

Sur 75 `ALTER TABLE ADD COLUMN`, **27 n'ont pas de vérification** (`table_info`) ni de `try/catch`. Si la colonne existe déjà → crash au démarrage.

---

## 5. AUDIT BACKEND

### 5.1 task_assignments DROP/CREATE — CRITIQUE

La table `task_assignments` est **DROP/CREATEd 6 fois** dans database.js pour modifier les CHECK constraints de `section` et `source_type`. À chaque démarrage :
1. CREATE TABLE `_new` avec nouveau schema
2. INSERT INTO `_new` SELECT FROM ancien
3. DROP TABLE original
4. RENAME `_new` → original

**Risques** :
- FK d'autres tables cassées lors du DROP
- Perte de données si crash entre DROP et RENAME
- Performance : 6 copies complètes de la table à chaque startup

**Remédiation** : Vérifier si la migration est nécessaire avant exécution (comparer le CHECK actuel).

### 5.2 Double système client — CRITIQUE

Deux ensembles de routes opèrent sur la **même table `clients`** :

| Système | Fichier | Champs gérés | Utilisé par |
|---------|---------|--------------|-------------|
| Legacy | `routes.js` L7-64 | 4 champs (name, email, phone, address) | ManagementPanel, OrdersPanel, App.jsx |
| Annuaire | `annuaireRoutes.js` L100-160 | 20 champs (+ siret, tva, city, postal_code...) | AnnuairePanel |

**Risque** : Un client créé via ManagementPanel n'a aucun champ enrichi. Les deux INSERT sont incompatibles.

**Remédiation** : Migrer tous les CRUD client vers l'annuaire. Garder un `GET /api/clients` legacy en lecture seule.

### 5.3 ReportsPanel désactivé

`ReportsPanel.jsx` (848 lignes, module complet) est **commenté** dans App.jsx :
```js
// const ReportsPanel = lazy(() => import('./components/ReportsPanel'));
```
Module fonctionnel mais invisible pour les utilisateurs.

### 5.4 Code mort API

3 méthodes API mortes dans `api.js` : `createGarage()`, `updateGarage()`, `deleteGarage()` — jamais appelées.

1 fichier utilitaire mort : `src/utils/excelImport.js` (221 lignes) — jamais importé.

---

## 6. AUDIT FRONTEND REACT

### 6.1 God Components

| Composant | useState | useEffect | Lignes | Verdict |
|-----------|---------|-----------|--------|---------|
| PersonnelPanel.jsx | **48** | 9 | 2 391 | **Critique — décomposer** |
| App.jsx | **44** | 10 | 1 466 | **Haute — useReducer** |
| Calendar.jsx | 18 | 11 | 2 760 | Moyenne |
| EquipmentPanel.jsx | ~30 | 8 | 2 372 | Moyenne |

### 6.2 Anti-patterns React

| Problème | Occurrences | Impact |
|----------|-------------|--------|
| `eslint-disable react-hooks/exhaustive-deps` | 7 | Bugs potentiels |
| `key={index}` sur listes réordonnables | 15+ | Instabilité DOM |
| `dangerouslySetInnerHTML` | 1 (avec DOMPurify) | Acceptable |
| `console.log/warn/error` en prod | **195** | Pollution console |
| `style={}` inline | **764** | Non-thématisable |
| Aucun PropTypes / TypeScript | **0** | Aucune validation statique |

### 6.3 Accessibilité — Lacunes majeures

| Problème | Quantité |
|----------|----------|
| `<div>` / `<span>` cliquables sans `role="button"` ni `tabIndex` | **84** |
| Attributs `aria-*` total (pour 123 fichiers JSX) | **15** |
| `tabIndex` total | **0** |
| `aria-live` pour notifications | 1 seul (ToastContainer) |
| `aria-expanded` sur menus/accordéons | **0** |
| Skip-links | **0** |

### 6.4 Performance

- ✅ 24 composants lazy-loaded (React.lazy + Suspense)
- ✅ 189 useMemo, 244 useCallback
- ✅ 39 React.memo
- ⚠️ 13 gros composants (>800 lignes) SANS React.memo
- ✅ ErrorBoundary au niveau racine
- ⚠️ Aucun ErrorBoundary granulaire par module

---

## 7. AUDIT CSS / DESIGN SYSTEM

### 7.1 Tokens définis dans theme.css (~120 variables)

| Catégorie | Tokens | Couverture dark |
|-----------|--------|----------------|
| Couleurs principales | 7 | ✅ |
| Dégradés | 4 | ✅ |
| Sémantiques (danger/success/info/warning) | 29 | ✅ |
| Texte | 9 | ✅ |
| Bordures | 5 | ✅ |
| Backgrounds | 12 | ✅ |
| Ombres | 3 | ✅ |
| Boutons | ~29 | ✅ (partiel) |
| Transitions | 3 | N/A |
| Overlay | 2 | ✅ |

### 7.2 Tokens MANQUANTS — CRITIQUE

| Catégorie | Statut | Conséquence |
|-----------|--------|-------------|
| **Spacing** (padding/margin/gap) | **ABSENT** | 100% hardcodé px/rem |
| **Border-radius** | **QUASI-ABSENT** | 30+ valeurs distinctes (3px à 50%) |
| **Typography** (font-size/line-height/weight) | **ABSENT** | 30+ tailles distinctes, mélange px/rem |
| **Z-index** | **ABSENT** | 26 valeurs de 0 à 99999, chaos complet |
| **Breakpoints** | **ABSENT** | — |
| **Icon sizes** | **ABSENT** | — |

### 7.3 Incohérences CSS majeures

| Problème | Quantité |
|----------|----------|
| Couleurs hex hardcodées (hors theme.css) | **80+** |
| `!important` | **210** |
| `style={}` inline | **764** |
| Valeurs `border-radius` distinctes | **30+** |
| Valeurs `font-size` distinctes | **30+** |
| Valeurs `z-index` distinctes | **26** |

### 7.4 Dark mode — Couverture insuffisante

- **18 fichiers CSS** avec `[data-theme="dark"]` sur **~70 significatifs** = **~25% de couverture**
- **52 fichiers CSS majeurs** sans dark mode

---

## 8. AUDIT MODULES MÉTIER

### 8.1 Véhicules & Réservations
- ✅ CRUD complet, conflits de réservation détectés
- ⚠️ Pas d'index sur `reservations(vehicle_id, start_date, end_date)` → scan complet pour détection conflit
- ⚠️ `reservation_requests` pas d'index sur status

### 8.2 Personnel & Congés
- ✅ Module le plus complet : compétences, disponibilités, missions, congés Code du travail/IDCC 3252
- ⚠️ PersonnelPanel.jsx = 48 useState (God Component)
- ✅ Toutes les FK ont ON DELETE CASCADE

### 8.3 Affaires
- ✅ Import Excel/CSV, BL, PJ, tâches
- ⚠️ Double identifiant (id INT vs numero_affaire TEXT) → incohérence FK

### 8.4 Catalogue & Équipements
- ✅ UID auto, localisation multi-dépôt, SAV
- ⚠️ `equipment.category_id` FK sans ON DELETE
- ⚠️ `equipment_assignments.assigned_to` TEXT libre (pas FK)

### 8.5 Stock & Commandes
- ✅ CRUD, mouvements, workflow commandes (draft→sent→confirmed→received)
- ✅ Bons index sur stock_items et stock_movements
- ⚠️ `material_requests` n'a **aucune FK déclarée**

### 8.6 Annuaire
- ✅ Validation SIRET, TVA, enrichissement
- ⚠️ **Double système client** (conflits avec routes.js legacy)
- ⚠️ `annuaire_contacts.entity_id` polymorphe sans FK formelle

### 8.7 Communication / Planning
- ✅ Planning jour/semaine, tâches récurrentes, iCal, export PDF
- ⚠️ task_assignments DROP/CREATE 6x au démarrage

### 8.8 Display Dashboard
- ✅ 21 sous-composants, écrans, playlists, médias, Sonos
- ⚠️ DisplayDashboardPanel.css : 2 238 lignes sans dark mode

### 8.9 Messagerie
- ✅ Conversations, messages, pièces jointes
- ⚠️ `messages.sender_id` FK sans ON DELETE

### 8.10 Mailing
- ✅ Templates, envoi groupé, historique
- ⚠️ `mail_history.template_id` pas de FK
- ⚠️ SMTP password en clair en DB

### 8.11 Mobile (PWA)
- ✅ 16 vues, détection auto mobile, login dédié
- ✅ Service Worker + manifest installable

---

## 9. PLAN DE CORRECTIONS PRIORISÉ

### 🔴 P0 — CRITIQUE (sécurité / intégrité)

| # | Action | Effort | Fichiers |
|---|--------|--------|----------|
| 1 | Sécuriser le flux reset password (OTP email + token signé) | 3h | server.js |
| 2 | Vérifier session DB dans authenticateToken | 30min | server.js |
| 3 | Rendre les 27 migrations ALTER TABLE idempotentes | 2h | database.js |
| 4 | Éliminer les 6 DROP TABLE task_assignments (vérif avant migration) | 1h | database.js |
| 5 | Unifier le système client (supprimer legacy routes.js) | 1h | routes.js, api.js, ManagementPanel.jsx |

### 🟠 P1 — HAUTE (performance / robustesse)

| # | Action | Effort | Fichiers |
|---|--------|--------|----------|
| 6 | Ajouter les 9 index manquants | 30min | database.js |
| 7 | Ajouter ON DELETE SET NULL sur FK `created_by` | 1h | database.js (migration) |
| 8 | Installer helmet + configurer CSP | 30min | server.js, package.json |
| 9 | Sanitizer les filename dans displayRoutes | 15min | displayRoutes.js |
| 10 | Retirer `application/octet-stream` de la whitelist upload | 5min | server.js |

### 🟡 P2 — MOYENNE (UX / maintenabilité)

| # | Action | Effort | Fichiers |
|---|--------|--------|----------|
| 11 | Créer les tokens CSS manquants (spacing, radius, typography, z-index) | 2h | theme.css |
| 12 | Remplacer les 80+ couleurs hardcodées par var(--theme-*) | 4h | 52 fichiers CSS |
| 13 | Ajouter dark mode aux 52 fichiers CSS manquants | 8h | 52 fichiers CSS |
| 14 | Décomposer PersonnelPanel (48 useState → sous-composants + useReducer) | 4h | PersonnelPanel.jsx |
| 15 | Corriger les 84 divs cliquables sans role/tabIndex | 2h | 30+ fichiers JSX |
| 16 | Nettoyer les 195 console.log | 30min | grep + sed |
| 17 | Corriger les 7 eslint-disable | 30min | 4 fichiers |
| 18 | Activer ReportsPanel (décommenter lazy import) | 5min | App.jsx |

### 🟢 P3 — BASSE (qualité / optimisation)

| # | Action | Effort | Fichiers |
|---|--------|--------|----------|
| 19 | Supprimer le code mort (3 méthodes garage, excelImport.js) | 15min | api.js, excelImport.js |
| 20 | Ajouter React.memo aux 13 gros composants | 1h | 13 fichiers |
| 21 | Remplacer les 15 key={index} par des clés stables | 30min | 8 fichiers |
| 22 | Ajouter ErrorBoundary granulaires par module | 1h | App.jsx |
| 23 | Standardiser le z-index via tokens | 1h | ~15 fichiers CSS |
| 24 | Normaliser l'identifiant affaire (migrer vers numero_affaire TEXT partout) | 2h | database.js, routes |

---

## 10. MIGRATIONS SQL IDEMPOTENTES

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

---

## 11. DESIGN SYSTEM UNIFIÉ — TOKENS MANQUANTS

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

/* Shadow Scale (en complément des existants) */
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
--shadow-xl: 0 12px 40px rgba(0, 0, 0, 0.15);

/* Tooltip tokens */
--tooltip-bg: rgba(17, 24, 39, 0.95);
--tooltip-color: #ffffff;
--tooltip-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
```

### Overrides dark

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

### Échelle z-index — Cartographie actuelle → cible

| Composant | Actuel | Cible |
|-----------|--------|-------|
| Header `sticky` | 200 | `var(--z-sticky)` = 200 |
| Dropdown/menu | 100-300 | `var(--z-dropdown)` = 100 |
| Modal overlay | 1000-3000 | `var(--z-overlay)` = 1000 |
| Modal contenu | 2000-10000 | `var(--z-modal)` = 2000 |
| Popover/context menu | 5000-9000 | `var(--z-popover)` = 3000 |
| Toast notifications | 9500 | `var(--z-toast)` = 5000 |
| Tooltips | 99999 | `var(--z-tooltip)` = 9999 |
| Loading overlay | 9999 | `var(--z-tooltip)` = 9999 |

---

## 12. ANNEXES

### A. Fichiers audités

| Répertoire | Fichiers audités | Méthode |
|------------|-----------------|---------|
| server/ | 17/17 (100%) | Lecture complète |
| src/components/ | 83/83 | Métriques + patterns |
| src/components/mobile/ | 16/16 | Métriques |
| src/components/DisplayDashboard/ | 21/21 | Métriques |
| src/utils/ | 14/14 | Lecture complète |
| src/hooks/ | 6/6 | Lecture complète |
| CSS | 89/89 | grep patterns |

### B. Dépendances vulnérables connues

| Package | Version | Vulnérabilité | Sévérité |
|---------|---------|---------------|----------|
| xlsx | 0.18.5 | Prototype Pollution + ReDoS | HIGH |
| esbuild | (dev) | CVE connue | MODERATE (dev-only) |

### C. Matrice de couverture dark mode par module

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
| Réservations | ReservationModal.css | ✅ | OK |
| Maintenance | MaintenanceDialog.css | ✅ | OK |

### D. Tableau récapitulatif

| Métrique | Valeur |
|----------|--------|
| Vulnérabilités CRITIQUES | **2** |
| Vulnérabilités HAUTES | **3** |
| Vulnérabilités MOYENNES | **8** |
| Index DB manquants | **9** |
| FK sans ON DELETE | **20+** |
| Migrations non idempotentes | **27** |
| God Components (>1500 l.) | **6** |
| Fichiers CSS sans dark mode | **52** |
| Couleurs hardcodées | **80+** |
| Divs cliquables sans a11y | **84** |
| console.log en prod | **195** |
| !important | **210** |
| styles inline | **764** |
| Tokens CSS manquants (catégories) | **4** (spacing, radius, typo, z-index) |
| Code mort (fichiers) | **1** (excelImport.js) |
| Code mort (méthodes API) | **3** |
| Tests automatisés | **0** |
| TypeScript / PropTypes | **0** |

---

*Fin de l'audit technique eM@g v2.0.0 — Juillet 2025*
