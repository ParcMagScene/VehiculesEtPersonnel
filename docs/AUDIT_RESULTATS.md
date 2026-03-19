# 🔍 AUDIT COMPLET eM@g — Résultats

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
