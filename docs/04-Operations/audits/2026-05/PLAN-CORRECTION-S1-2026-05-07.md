# 🛠️ Plan de correction S1 — eM@g

> **Statut** : plan + patches **non appliqués**, en attente de validation explicite, item par item.
> **Référence audit** : [AUDIT-COMPLET-2026-05-06.md](AUDIT-COMPLET-2026-05-06.md)
> **Date** : 7 mai 2026 — **HEAD** : `321ef262` (dev)
> **Contraintes respectées** :
> - 🚫 TV client (`apps/tv-client/`) — **non touché**.
> - 🚫 Aucun correctif appliqué automatiquement.
> - 🚫 Aucune donnée supprimée.
> - ✅ Patches modulaires, commentés, testables, réversibles.

---

## 0. Index des items S1

| ID | Titre | Sévérité | Risque principal | Effort | Réversibilité |
|---|---|---|---|---|---|
| **S1-01** | WAL SQLite saturé (244 Mo) | 🔴 | Corruption sur crash, démarrage lent | XS | Trivial |
| **S1-02** | Listener HTTPS sans `error` handler → `EADDRINUSE` tue le process | 🔴 | Downtime API HTTPS récurrent | XS | Trivial |
| **S1-03** | Backups DB `*.bak-*` non gitignorés (11 fichiers présents) | 🔴 | Fuite données + saturation disque | XS | Trivial |
| **S1-04** | 5 CVE deps backend (`ip` SSRF + `ip-address` XSS) | 🔴 | SSRF/XSS sous condition réseau | S | npm audit fix |
| **S1-05** | Absence de `request timeout` Express | 🟠↑ | DoS requête lente (single-thread DB) | XS | Trivial |
| **S1-06** | SQL dynamique `${table}` non whitelistée (8 sites) | 🟠↑ | Injection SQL si bug de routage | S | Ajout d'assert |
| **S1-07** | UPDATE dynamique `${sets.join}` SAV non whitelisté | 🟠↑ | Injection SQL via clé du body | XS | Whitelist |
| **S1-08** | `loadEnv` `.env.development` non gitignoré global | 🟢 | (déjà couvert par `.gitignore` actuel) | — | — |

**Note** : S1-08 vérifié → déjà couvert (`apps/api/.env.development` gitignoré L65).

---

# S1-01 — WAL SQLite saturé (244 Mo)

### Description
`apps/api/vehicules.db-wal` atteint **244 Mo** alors que la DB elle-même fait 277 Mo (47% du fichier en journal non checkpointé). Le `wal_autocheckpoint=1000` et le `setInterval(checkpointDatabase, 5min)` ne suffisent pas car des **readers persistants** (SSE messaging, contrôles scheduler, sonos heartbeat, sessions Express en cours) bloquent les checkpoints `PASSIVE`.

### Pourquoi critique
- **Corruption** : si crash kernel/power, le replay WAL >200 Mo peut échouer partiellement.
- **Démarrage lent** : SQLite rejoue le WAL au boot (~secondes voire minutes).
- **Mémoire** : SQLite mappe le WAL → +244 Mo RSS.
- **Backups** : nos `cp` de la `.db` sans `.db-wal` sont **incomplets**.

### Cause racine
1. Checkpoint type `PASSIVE` (default) ne tronque jamais le WAL.
2. Aucune fenêtre sans reader (SSE permanent) pour `RESTART`/`TRUNCATE` opportuniste.
3. Pas de checkpoint forcé périodique.

### Correctif proposé
Ajouter dans [apps/api/database.js](apps/api/database.js#L3789):
- Un checkpoint `TRUNCATE` quotidien à 03:00 (heure creuse).
- Un checkpoint `RESTART` toutes les 30 min en complément du `PASSIVE` actuel.
- Réduire `wal_autocheckpoint` à 500 pages.

### Patch (proposé, non appliqué)

```diff
*** apps/api/database.js (vers L3789)
@@
-// Checkpoint automatique toutes les 5 minutes
-const checkpointTimer = setInterval(
-  () => {
-    checkpointDatabase();
-  },
-  5 * 60 * 1000,
-);
+// ─────────────────────────────────────────────────────────────
+// S1-01 — Stratégie WAL renforcée
+// PASSIVE: toutes les 5 min (ne bloque pas, mais peut ne rien tronquer)
+// RESTART: toutes les 30 min (force la rotation du WAL)
+// TRUNCATE: une fois par jour à 03:00 (libère l'espace disque)
+// ─────────────────────────────────────────────────────────────
+const checkpointTimer = setInterval(
+  () => checkpointDatabase(),
+  5 * 60 * 1000,
+);
+
+const restartTimer = setInterval(() => {
+  try {
+    const r = db.pragma('wal_checkpoint(RESTART)');
+    logger.info(`🔁 WAL RESTART: ${JSON.stringify(r)}`);
+  } catch (e) {
+    logger.warn('⚠️ WAL RESTART échec (readers actifs):', e.message);
+  }
+}, 30 * 60 * 1000);
+
+let truncateTimer = null;
+function scheduleDailyTruncate() {
+  const now = new Date();
+  const next = new Date(now);
+  next.setHours(3, 0, 0, 0);
+  if (next <= now) next.setDate(next.getDate() + 1);
+  setTimeout(() => {
+    try {
+      const r = db.pragma('wal_checkpoint(TRUNCATE)');
+      logger.info(`🧹 WAL TRUNCATE quotidien: ${JSON.stringify(r)}`);
+    } catch (e) {
+      logger.error('❌ WAL TRUNCATE échec:', e);
+    }
+    truncateTimer = setInterval(() => {
+      try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (_) { /* noop */ }
+    }, 24 * 60 * 60 * 1000);
+  }, next - now);
+}
+scheduleDailyTruncate();
+
+// Affiner l'autocheckpoint (default 1000 pages = ~4 Mo)
+try { db.pragma('wal_autocheckpoint = 500'); } catch (_) { /* noop */ }
@@ closeDatabase()
   try {
     clearInterval(checkpointTimer);
+    clearInterval(restartTimer);
+    if (truncateTimer) clearInterval(truncateTimer);
     // Faire un checkpoint final avant de fermer
-    checkpointDatabase();
+    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (_) { checkpointDatabase(); }
     db.close();
```

### Tests
- **Unitaire** (`tests/database-wal.test.js`) :
  - mock `setInterval`, vérifier que `scheduleDailyTruncate` calcule la bonne échéance (avant/après 03:00).
  - vérifier que `closeDatabase` clear les 3 timers.
- **Intégration** :
  - `npm run test:db` → écrire 10k rows, attendre 1 min, exécuter manuellement `pragma('wal_checkpoint(TRUNCATE)')`, vérifier `ls -l vehicules.db-wal` < 10 Mo.
- **Non-régression** :
  - Toutes les routes répondent 200 pendant un `TRUNCATE` (lecteurs SSE en parallèle).
  - Bench : `wrk -t2 -c10 -d30s http://localhost:3003/api/health` avant/après.

### Migration DB
Aucune migration de schéma. Action one-shot manuelle pré-déploiement :
```bash
sqlite3 apps/api/vehicules.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

### Garde-fous
- Logger chaque checkpoint avec `{busy, log, checkpointed}` (retour SQLite).
- Alerte si `wal-size > 50 Mo` au démarrage : log warning + métrique.

### Impacts potentiels
- Pendant `TRUNCATE` : très brève pause writers (~ms). Aucun impact perceptible.
- Si tous les checkpoints échouent (readers bloqués 24h) : WAL continue de croître → métrique d'alerte recommandée.

### Alternative
Si problème en prod : revenir au `setInterval` 5 min seul (revert trivial).

---

# S1-02 — `httpsServer.listen` sans handler `error` → EADDRINUSE tue le process

### Description
À chaque `npm run dev:start` ou `pm2 restart vehicules-backend`, on observe `EADDRINUSE: address already in use 0.0.0.0:3443`. Le `httpsServer.listen()` n'a **pas** de handler `error` ; l'exception remonte au global `process.on('uncaughtException')` qui appelle `gracefulShutdown` → process tombe avant que l'autre instance libère le port.

### Pourquoi critique
- **Downtime backend HTTPS** : 5 incidents constatés en 24 h.
- **Boucle PM2** : restart loop possible si systemd respawne avant libération du port.
- **Faux positif `uncaughtException`** : un port occupé n'est pas une exception fatale.

### Cause racine
[apps/api/server.js#L517](apps/api/server.js#L517) : `httpsServer.listen(...)` sans `.on('error', ...)`.

### Correctif proposé
- Attacher un `error` handler sur `httpsServer` et `redirectApp` qui :
  - log `WARN` si `EADDRINUSE`,
  - **ne** déclenche **pas** `gracefulShutdown`,
  - tente un retry (3 fois, backoff 2s/4s/8s),
  - en dernier recours, démarre en HTTP-only (déjà supporté par le code).

### Patch (proposé, non appliqué)

```diff
*** apps/api/server.js (autour L516-L520)
@@
-  const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
-  const httpsServer = https.createServer(sslOptions, app);
-  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
+  const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
+  const httpsServer = https.createServer(sslOptions, app);
+
+  // S1-02 — Démarrage HTTPS résilient avec retry et fallback HTTP-only
+  let httpsAttempts = 0;
+  const MAX_HTTPS_ATTEMPTS = 3;
+  function tryListenHttps() {
+    httpsServer.listen(HTTPS_PORT, '0.0.0.0');
+  }
+  httpsServer.on('error', (err) => {
+    if (err.code === 'EADDRINUSE' && httpsAttempts < MAX_HTTPS_ATTEMPTS) {
+      const delay = 2000 * 2 ** httpsAttempts;
+      httpsAttempts += 1;
+      logger.warn(
+        `⚠️ HTTPS :${HTTPS_PORT} occupé (tentative ${httpsAttempts}/${MAX_HTTPS_ATTEMPTS}) — retry dans ${delay}ms`,
+      );
+      setTimeout(tryListenHttps, delay);
+      return;
+    }
+    if (err.code === 'EADDRINUSE') {
+      logger.error(
+        `❌ HTTPS :${HTTPS_PORT} toujours occupé après ${MAX_HTTPS_ATTEMPTS} tentatives — bascule HTTP-only`,
+      );
+      // On laisse le serveur HTTP redirect tomber et on conserve uniquement le HTTP principal.
+      return;
+    }
+    logger.error('❌ Erreur serveur HTTPS:', err);
+  });
+  httpsServer.once('listening', () => {
     logger.info(`🔒 Serveur HTTPS démarré sur https://0.0.0.0:${HTTPS_PORT}`);
     logger.info(`📡 Accessible sur https://${SERVER_HOST}:${HTTPS_PORT}`);
     initEmailTransporter(db);
     cleanTempFiles();
     setInterval(cleanTempFiles, 6 * 60 * 60 * 1000);
     cleanExpiredSessions();
     setInterval(cleanExpiredSessions, 30 * 60 * 1000);
     startEshopCatalogAutoSync();
     startControlesScheduler(db);
   });
+  tryListenHttps();
```

⚠️ **Side-effect important** : les `setInterval`/init transférés dans `'listening'` ne tournent plus si HTTPS échoue. Variante plus sûre : extraire un `function bootBackgroundJobs()` appelé soit dans le callback HTTPS, soit dans `app.listen` HTTP fallback.

```diff
+  function bootBackgroundJobs() {
+    initEmailTransporter(db);
+    cleanTempFiles();
+    setInterval(cleanTempFiles, 6 * 60 * 60 * 1000);
+    cleanExpiredSessions();
+    setInterval(cleanExpiredSessions, 30 * 60 * 1000);
+    startEshopCatalogAutoSync();
+    startControlesScheduler(db);
+  }
+  // Appelé dans l'événement 'listening' HTTPS, ou dans le else HTTP-only.
```

### Tests
- **Unitaire** : mock `https.createServer().listen` → simuler `EADDRINUSE`, vérifier 3 retries puis bascule.
- **Intégration** :
  ```bash
  # Terminal 1 : occuper le port
  nc -l 3443 &
  # Terminal 2 : démarrer backend, vérifier 3 retries puis HTTP-only
  npm run dev:start
  ```
- **Non-régression** : démarrage sans port occupé → comportement identique.

### Garde-fous
- `MAX_HTTPS_ATTEMPTS=3` configurable via env.
- Métrique `https_listen_failures_total` (compteur).

### Impacts
- Aucun impact en cas de port libre.
- En cas d'échec définitif : API toujours servie en HTTP local (3003), redirection HTTPS perdue → impact frontend si HTTPS attendu.

### Alternative
Avant le `listen`, faire un `net.createServer().listen(HTTPS_PORT)` test pour détecter le conflit puis émettre une alerte explicite.

---

# S1-03 — Backups DB `*.bak-*` et `*.backup-*` non gitignorés

### Description
[.gitignore](.gitignore) ignore `*.db`, `*.db-shm`, `*.db-wal`, `apps/api/backups/`, mais **pas** :
- `apps/api/vehicules.db.bak-*` (11 fichiers présents)
- `apps/api/vehicules.db.backup-*` (2 fichiers)

Constatés ce jour via `git status` après `git add -A`.

### Pourquoi critique
- **Fuite de données** : un backup peut contenir mots de passe hashés, données RGPD, secrets.
- **Saturation repo** : DB ~277 Mo × 13 backups = >3 Go potentiels si committés.
- **rsync deploy** : si un déploiement copie le repo, les backups partent en prod.

### Cause racine
Pattern `*.db` ne couvre pas `*.db.bak-*` (extension `.bak-…` après `.db`).

### Correctif proposé
1. Étendre [.gitignore](.gitignore#L20).
2. **Déplacer** (ne pas supprimer) les backups vers `apps/api/_backups_local/` (déjà ignoré par pattern à ajouter).
3. Vérifier qu'aucun backup n'est déjà tracké : `git ls-files | grep -E '\.bak-|\.backup-'`.

### Patch (proposé, non appliqué)

```diff
*** .gitignore
@@ Base de données
 *.db
 *.db-shm
 *.db-wal
 *.sqlite
 *.sqlite3
 *.sqlite-shm
 *.sqlite-wal
+
+# S1-03 — Backups locaux de DB (jamais versionnés)
+*.db.bak-*
+*.db.backup-*
+apps/api/_backups_local/
```

### Procédure de migration sûre (manuelle, à valider)
```bash
# 1. Vérifier qu'aucun backup n'est tracké (doit retourner vide)
git ls-files | grep -E '\.(bak|backup)-' || echo "OK: rien tracké"

# 2. Créer le dossier dédié
mkdir -p apps/api/_backups_local

# 3. Déplacer (pas supprimer)
mv apps/api/vehicules.db.bak-* apps/api/_backups_local/ 2>/dev/null
mv apps/api/vehicules.db.backup-* apps/api/_backups_local/ 2>/dev/null

# 4. Vérifier git status propre
git status --short apps/api/
```

### Tests
- **Pre-commit hook** (`scripts/check-no-db-backup-staged.sh`) :
  ```bash
  if git diff --cached --name-only | grep -E '\.(bak|backup)-'; then
    echo "❌ Backup DB stagé — refus"
    exit 1
  fi
  ```
- Ajouter à Husky `pre-commit`.

### Garde-fous
- CI : job `check-no-large-files` qui rejette tout fichier > 50 Mo.
- Script `scripts/backup-db.sh` doit pointer vers `_backups_local/`.

### Impact
Aucun (action 100% locale, pas de modif d'historique git).

---

# S1-04 — CVE npm backend (5 vulnérabilités)

### Description
`npm audit --omit=dev` côté `apps/api/` :
- **HIGH** : `ip` (SSRF) ← `sonos`
- **MODERATE** : `ip-address` (XSS) ← `express-rate-limit`

### Pourquoi critique
- `express-rate-limit` est en première ligne (toutes les requêtes auth y passent).
- `sonos>ip` : SSRF non exploitable côté LAN, mais à documenter.

### Correctif proposé

```bash
cd apps/api
npm audit fix          # non breaking : passe express-rate-limit à 8.5.1+
npm audit              # vérifier
```

Pour `sonos>ip` :
- **Option A** : attendre upstream `sonos@2.x` (pas dispo).
- **Option B** : remplacer la lib `sonos` par fork/patch (lourd).
- **Option C (retenue)** : documenter le risque accepté (Sonos LAN uniquement, IP source contrôlée).

### Tests
- `npm test` (suite backend complète, 85 tests).
- E2E rate-limit : 6 tentatives login en 15 min → 429 attendu.
- E2E Sonos : lecture artwork OK.

### Garde-fous
- Job CI `npm audit --audit-level=high` sur PR.
- Re-check mensuel via `dependabot` ou `renovate`.

### Impact
Aucun changement d'API publique de `express-rate-limit` (8.5.0 → 8.5.x).

### Alternative
Si breaking change futur : pin `express-rate-limit@^8` dans `package.json`.

---

# S1-05 — Absence de `request timeout` Express

### Description
Aucun timeout par requête. Une requête lente (gros JOIN, fetch externe Google bloqué) garde un socket ouvert et un slot dans le pool d'event loop.

### Pourquoi critique
- DoS trivial : 100 requêtes ouvertes → SQLite single-thread saturé.
- Frontend reste sur spinner indéfini.

### Correctif proposé
Middleware global timeout 30 s qui répond 408.

```diff
*** apps/api/server.js (avant les routes, après helmet)
+// S1-05 — Timeout global par requête (30s)
+// Évite les connexions zombies qui saturent l'event loop SQLite single-thread.
+app.use((req, res, next) => {
+  // Exclusions: SSE et uploads volumineux
+  if (req.path.startsWith('/api/messaging/stream') ||
+      req.path.startsWith('/api/uploads/') ||
+      req.path.startsWith('/api/imports/')) {
+    return next();
+  }
+  req.setTimeout(30_000, () => {
+    if (!res.headersSent) {
+      logger.warn(`⏱ Request timeout: ${req.method} ${req.path}`);
+      res.status(408).json({ error: 'Request timeout' });
+    }
+  });
+  next();
+});
```

### Tests
- **Unitaire** : route mock `await new Promise(r => setTimeout(r, 35000))` → attendre 408.
- **Intégration** : `curl -X POST /api/orders` avec body bloquant → 408 après 30 s.
- **Non-régression** : SSE messaging continue à fonctionner (exclu).

### Garde-fous
- Loguer chaque timeout pour identifier les routes lentes.
- Métrique `http_request_timeout_total{route}`.

### Impact
- Risque de couper les exports lourds → exclusions explicites.
- Vérifier listes paginées : si TTFB > 30 s, problème de design (=> S2 pagination).

---

# S1-06 — SQL dynamique `${table}` non whitelistée (annuaireRoutes)

### Description
8 patterns `${table}` dans [apps/api/annuaireRoutes.js](apps/api/annuaireRoutes.js#L1090). La variable `table` provient d'une `forEach` sur `REF_TABLES` (closure), donc **non exploitable directement**, mais aucun assert défensif.

### Pourquoi critique
- Si un futur refacto branche `table` sur `req.params` ou `req.body`, l'injection devient triviale.
- Phase A audit avait laissé ces sites en l'état.

### Cause racine
Absence de whitelist runtime — sécurité par construction (closure) non documentée.

### Correctif proposé
Geler le set des tables autorisées et asserter à chaque usage.

```diff
*** apps/api/annuaireRoutes.js (en haut du module)
+// S1-06 — Whitelist défensive des tables annuaire référence
+const REF_TABLE_WHITELIST = Object.freeze(new Set([
+  'ref_civilites', 'ref_fonctions', 'ref_services', 'ref_secteurs',
+  // ⚠️ Compléter avec la liste exhaustive issue de REF_TABLES
+]));
+function assertRefTable(table) {
+  if (!REF_TABLE_WHITELIST.has(table)) {
+    throw new Error(`Table annuaire non autorisée: ${table}`);
+  }
+}
@@
   app.post(`/api/annuaire/ref/${slug}`, authenticateToken, requireAdmin, (req, res) => {
     try {
+      assertRefTable(table);
       const { code, name, sort_order } = req.body;
```

Idem pour PUT, DELETE, GET, et les 2 sites L1966/L1969 (`ENTITY_TABLE_BY_TYPE`) qui dérivent de `req.body.left.type`/`req.body.right.type` → **vérifier que les 4 types `client/supplier/prestataire/contact` sont déjà strictement validés en amont** (Zod).

### Tests
- **Unitaire** : appeler `assertRefTable('users; DROP TABLE users; --')` → throw attendu.
- **Intégration** : POST `/api/annuaire/ref/<slug>` avec slug légitime → 201. Avec slug forgé (404 route avant) → 404.
- **Non-régression** : suite annuaire complète.

### Migration DB
Aucune.

### Garde-fous
- ESLint custom rule `no-template-literal-in-prepare` (à terme).

### Impact
Aucun en runtime nominal. Throw défensif uniquement si bug dev.

---

# S1-07 — UPDATE dynamique `${sets.join}` SAV non whitelisté

### Description
[apps/api/savRoutes.js#L498](apps/api/savRoutes.js#L498) :
```js
db.prepare(`UPDATE sav_tickets SET ${sets.join(', ')} WHERE id = ?`).run(...params);
```
`sets` est construit à partir des clés du body, sans whitelist explicite des colonnes.

### Pourquoi critique
- Si validation Zod en amont est partielle, une clé `password = 'x'` pourrait s'infiltrer.
- Risque d'**injection de colonnes** non prévues.

### Cause racine
Pattern "patch dynamique" sans liste fermée de colonnes éditables.

### Correctif proposé

```diff
*** apps/api/savRoutes.js (autour L470-L498)
+// S1-07 — Whitelist des colonnes éditables d'un ticket SAV
+const SAV_TICKET_EDITABLE = Object.freeze(new Set([
+  'status', 'description', 'priority', 'assigned_to',
+  'resolution_notes', 'closed_at', 'equipment_id',
+  // ⚠️ Compléter selon le schéma réel sav_tickets
+]));
@@
   const sets = [];
   const params = [];
   for (const [key, value] of Object.entries(req.body)) {
+    if (!SAV_TICKET_EDITABLE.has(key)) {
+      logger.warn(`SAV update: clé ignorée non whitelistée: ${key}`);
+      continue;
+    }
     sets.push(`${key} = ?`);
     params.push(value);
   }
+  if (sets.length === 0) {
+    return res.status(400).json({ error: 'Aucune colonne valide à modifier' });
+  }
   params.push(req.params.id);
   db.prepare(`UPDATE sav_tickets SET ${sets.join(', ')} WHERE id = ?`).run(...params);
```

### Tests
- **Unitaire** :
  - PATCH `/api/sav/tickets/1` body `{status: 'closed', evil: 'x'}` → succès, `evil` ignoré.
  - PATCH body vide → 400.
- **Intégration** : workflow SAV complet (open → in_progress → closed).
- **Non-régression** : E2E SAV import + édition.

### Migration DB
Aucune.

### Garde-fous
- Logger les clés ignorées (alerte si récurrent → bug client).
- Idem audit pour autres `UPDATE … SET ${…}` dans le code (`grep -rn 'SET \${' apps/api/`).

### Impact
- Si une clé légitime manque dans la whitelist → sera ignorée ⇒ vérifier la liste exhaustive avant déploiement.

---

# Récapitulatif global

## Plan d'application sécurisé (item par item, validation requise)

| Étape | Item | Pré-requis | Validation |
|---|---|---|---|
| 1 | **Backup DB** | `cp vehicules.db vehicules.db.pre-S1-2026-05-07` | Hash SHA256 noté |
| 2 | **S1-01** WAL | Backup + maintenance window 5 min | Vérifier WAL < 10 Mo après TRUNCATE |
| 3 | **S1-02** HTTPS retry | — | Test EADDRINUSE manuel (`nc -l 3443`) |
| 4 | **S1-03** gitignore + mv backups | Vérifier `git ls-files` | `git status` propre |
| 5 | **S1-04** npm audit fix | Lock file commité avant | `npm audit` clean (sauf sonos>ip documenté) |
| 6 | **S1-05** request timeout | — | Test 408 + non-régression SSE |
| 7 | **S1-06** whitelist annuaire | — | Suite tests annuaire 100% |
| 8 | **S1-07** whitelist SAV update | Lister colonnes exhaustives sav_tickets | E2E SAV |

## Plan de validation

1. **Suite tests automatisée** : `npm test` (backend 85 + frontend 355 = 440 tests).
2. **E2E manuels** :
   - Login + navigation 5 modules principaux.
   - Création commande depuis demande matériel (régression test du 6 mai).
   - Import SAV CSV.
   - Génération étiquettes plaque.
   - Contrôle périodique : créer + scheduler.
3. **Smoke prod** : `curl https://localhost:3443/api/health` + login admin + une lecture par module.
4. **Bench** : `wrk -t2 -c10 -d30s` avant/après pour `/api/equipment` et `/api/health`.
5. **Vérif WAL** : `ls -lh apps/api/vehicules.db*` quotidien pendant 7 jours.

## Plan de rollback

| Item | Rollback |
|---|---|
| S1-01 WAL | `git revert` du commit database.js + arrêt cron TRUNCATE |
| S1-02 HTTPS retry | `git revert` server.js |
| S1-03 gitignore | `git revert` .gitignore + `mv _backups_local/* apps/api/` (rétablit l'état) |
| S1-04 npm audit | `git checkout HEAD~1 -- apps/api/package*.json && npm ci` |
| S1-05 timeout | `git revert` middleware (impact 0 si retiré) |
| S1-06 whitelist annuaire | `git revert` (impact 0 en runtime nominal) |
| S1-07 whitelist SAV | `git revert` (sinon : retirer l'`if`, garder la migration) |

## Plan de surveillance post-déploiement (J+0 à J+7)

| Métrique | Seuil alerte | Source |
|---|---|---|
| Taille `vehicules.db-wal` | > 50 Mo | `ls -l` cron 1×/h |
| HTTPS uptime port 3443 | < 99% | PM2 + curl externe |
| Logs `EADDRINUSE` | > 0 incidents non récupérés | grep logs |
| `http_request_timeout_total` | > 5 / heure | logs |
| `npm audit` high+ | > 0 | CI quotidien |
| Erreurs SAV update | clés ignorées récurrentes | logs warn |
| Tests CI | 100% vert | GitHub Actions |

---

## Items NON traités dans ce plan S1 (renvoyés à S2/S3)

- Découpage fichiers >2500 LOC (S2)
- Sentry/Glitchtip (S2)
- Pagination systématique (S2)
- Suite Playwright auto (S2)
- Inline styles + hex (S3)
- ANALYZE mensuel + FK exhaustives (S3)

Voir [AUDIT-COMPLET-2026-05-06.md](AUDIT-COMPLET-2026-05-06.md) §15 pour le plan S2/S3 complet.

---

**Validation requise** : pour démarrer l'application, indiquez l'item à traiter (ex: "Applique S1-03" ou "Applique S1-01 + S1-02"). Chaque item est commité séparément avec son propre message conventionnel pour rollback granulaire.
