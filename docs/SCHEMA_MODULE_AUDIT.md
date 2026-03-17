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
