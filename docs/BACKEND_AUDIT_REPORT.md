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
