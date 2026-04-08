> **⚠️ DÉPRÉCIÉ** — Ce rapport est supplée par [`AUDIT.md`](AUDIT.md) (Partie II).  
> Les corrections appliquées (avril 2026) y sont documentées.  
> Ce fichier est conservé en archive — ne plus le mettre à jour.

# Rapport d'Audit de Sécurité — eM@g

> **Version** : 1.0.0  
> **Date** : 7 avril 2026  
> **Auditeur** : GitHub Copilot (automatisé)  
> **Périmètre** : Backend, Frontend, Base de données, Dépendances, Workflows

---

## Résumé exécutif

| Sévérité | Backend | Frontend | DB | Deps | Workflows | Total |
|----------|---------|----------|----|------|-----------|-------|
| 🔴 CRITIQUE | 2 | 0 | 5 | 1 | 0 | **8** |
| 🟠 ÉLEVÉ | 7 | 1 | 8 | 4 | 2 | **22** |
| 🟡 MOYEN | 8 | 5 | 12 | 7 | 5 | **37** |
| 🔵 BAS | 6 | 4 | 6 | 1 | 4 | **21** |
| ✅ Points positifs | 4 | 10 | 10 | — | 3 | **27** |

**Verdict** : Le projet a une **bonne base de sécurité** (requêtes paramétrisées, JWT httpOnly, sanitisation XSS, path traversal protection). Les risques principaux sont :
1. Endpoints publics trop permissifs (TV, users, vidéo)
2. SMTP password et tokens en clair en DB
3. Absence de HTTPS (déploiement interne)
4. Dépendances avec CVE connues

---

## 🔴 CRITIQUE — Corrections prioritaires

### CRIT-1 — Endpoints TV publics avec écriture DB
- **Fichier** : `apps/api/displayRoutes.js` L1856-L1871
- **CWE** : CWE-306 (Missing Authentication)
- **Risque** : `POST /api/display/tv/complete-event` et `uncomplete-event` modifient la DB sans auth
- **Fix** : Ajouter un token d'accès TV dédié (`X-TV-Token` header)

### CRIT-2 — JWT Secret fallback statique
- **Fichier** : `apps/api/server.js` L77
- **CWE** : CWE-798 (Hard-coded Credentials)
- **Risque** : Fallback `your-secret-key-change-in-production` peut être copié tel quel
- **Fix** : Refuser le démarrage si JWT_SECRET < 64 chars ou est une valeur connue

### CRIT-3 — SMTP password en clair en DB
- **Table** : `email_config.smtp_pass`
- **CWE** : CWE-312 (Cleartext Storage)
- **Fix** : Chiffrer avec `VIDEO_CIPHER_KEY` (AES-256 existant) ou une clé dédiée

### CRIT-4 — Token d'écran en clair en DB
- **Table** : `display_screens.token`
- **CWE** : CWE-312

### CRIT-5 — Base SQLite non chiffrée
- **CWE** : CWE-311 (Missing Encryption of Sensitive Data)
- **Risque** : Accès fichier = accès total aux données
- **Fix** : Évaluer SQLCipher ou chiffrement applicatif des colonnes sensibles

### CRIT-6 — Signatures congés en clair
- **Table** : `leave_requests.signature_employee`, `signature_admin`
- **CWE** : CWE-345 (Insufficient Verification of Data Authenticity)

### CRIT-7 — Pragma `secure_delete` non activé
- **CWE** : CWE-226 (Sensitive Information Uncleared Before Release)
- **Fix** : Ajouter `PRAGMA secure_delete = ON` dans database.js

### CRIT-8 — Dépendance `basic-ftp` — Path Traversal (CVSS 9.1)
- **CVE** : GHSA-5rq4-664w-9x2c
- **Fix** : `npm audit fix`

---

## 🟠 ÉLEVÉ — Corrections importantes

### Backend

| ID | Fichier | Description | CWE |
|----|---------|-------------|-----|
| HIGH-B1 | `authRoutes.js` L348 | `/api/auth/users-public` expose emails sans auth | CWE-200 |
| HIGH-B2 | `adminRoutes.js` L449 | `/api/auth/check-reset` permet l'énumération de comptes | CWE-204 |
| HIGH-B3 | `videoRoutes.js` L552 | Routes TV vidéo publiques — accès caméras sans auth | CWE-306 |
| HIGH-B4 | `adminRoutes.js` L476 | Mot de passe min 6 chars, pas de complexité | CWE-521 |
| HIGH-B5 | `config/helmet.js` L24 | HSTS désactivé, pas de HTTPS | CWE-319 |
| HIGH-B6 | `server.js` L78 | JWT valide 30 jours | CWE-613 |
| HIGH-B7 | `authRoutes.js` L242 | Données sensibles dans le JWT payload | CWE-922 |

### Frontend

| ID | Fichier | Description | CWE |
|----|---------|-------------|-----|
| HIGH-F1 | `ProfileEditModal.jsx` L76 | `api.token` fantôme — `Bearer undefined` | CWE-522 |

### Base de données

| ID | Table | Description |
|----|-------|-------------|
| HIGH-D1 | `persons`, `clients`, etc. | PII sans chiffrement au repos |
| HIGH-D2 | `users.reset_token_hash` | Pas de CHECK constraint |
| HIGH-D3 | `active_sessions` | Sessions expirées non nettoyées en schema |
| HIGH-D4 | `mail_history.recipients` | Emails en clair (RGPD) |
| HIGH-D5 | `bl_imports.raw_text` | Données commerciales en clair |
| HIGH-D6 | `leave_requests.justification_path` | Path traversal potentiel |
| HIGH-D7 | `config` | Secrets potentiels sans distinction |
| HIGH-D8 | `users.preferences/permissions` | JSON exposé côté client |

### Workflows

| ID | Route | Description |
|----|-------|-------------|
| HIGH-W1 | `leaveRoutes.js` L635 | Admin peut approuver ses propres congés |
| HIGH-W2 | `vehicleRoutes.js` L494 | Pas de détection de chevauchement à l'approbation |

### Dépendances

| Package | Sévérité | Type | Fix |
|---------|----------|------|-----|
| `bcrypt` | HIGH | direct | → 6.0.0 (breaking) |
| `sonos` | HIGH | direct | → 0.6.1 (breaking) |
| `path-to-regexp` | HIGH | transitive | `npm audit fix` |
| `rollup` | HIGH | transitive | `npm audit fix` |

---

## 🟡 MOYEN — Améliorations recommandées

### Backend
- MED-B1 : Template literals SQL pour colonnes (whitelisted mais fragile)
- MED-B2 : `execFile('curl', ...)` — SSRF potentiel via config admin
- MED-B3 : Cache auth 30s — délai de révocation
- MED-B4 : `/api/access-requests` sans rate limiter spécifique
- MED-B5 : `VIDEO_CIPHER_KEY` fallback aléatoire au runtime
- MED-B6 : Pas de rate limiting sur admin reset-password
- MED-B7 : CORS accepte requêtes sans Origin
- MED-B8 : ALLOW_HTTP contourne le flag Secure du cookie

### Frontend
- MED-F1 : `localStorage` contient `auth_user` (nom, email, rôle)
- MED-F2 : `document.write(data.html)` sans DOMPurify (4 composants congés)
- MED-F3 : `publicDir` expose `public/` avec fichiers potentiellement sensibles
- MED-F4 : IndexedDB stocke des PII (clients, personnel, conducteurs)
- MED-F5 : Pas de CSRF token (atténué par SameSite=lax)

### Base de données
- MED-D1 à D12 : Contraintes UNIQUE/CHECK manquantes (VIN, immatriculation, n° série, statuts)

### Workflows
- MED-W1 : Tickets SAV — transitions d'état non validées
- MED-W2 : Politique mot de passe faible (6 chars)
- MED-W3 : Mutations équipement ouvertes à tout utilisateur authentifié
- MED-W4 : Double affectation équipement possible
- MED-W5 : `/api/auth/users-public` sans auth

### Dépendances
- `dompurify` MODERATE, `ajv` MODERATE, `vite` MODERATE, etc.

---

## ✅ Points forts confirmés

| Domaine | Contrôle | Statut |
|---------|----------|--------|
| Backend | Requêtes SQL 100% paramétrisées | ✅ |
| Backend | Sanitisation XSS globale (middleware) | ✅ |
| Backend | Protection path traversal (uploads) | ✅ |
| Backend | Error handler centralisé (pas de stack leak) | ✅ |
| Frontend | JWT dans cookie httpOnly | ✅ |
| Frontend | DOMPurify pour le seul dangerouslySetInnerHTML | ✅ |
| Frontend | Aucun secret hardcodé | ✅ |
| Frontend | Aucun eval() | ✅ |
| Frontend | CSP configurée, sourcemaps off, console.log purgé en prod | ✅ |
| Frontend | Refresh token silencieux fonctionnel | ✅ |
| DB | WAL mode activé | ✅ |
| DB | Foreign keys ON | ✅ |
| DB | Passwords hashés bcrypt | ✅ |
| DB | Reset tokens hashés SHA-256 | ✅ |
| DB | Sessions hashées en DB | ✅ |
| DB | Mots de passe caméras chiffrés AES-256 | ✅ |
| Workflow | Inscription par invitation uniquement | ✅ |
| Workflow | Vérification permissions en DB (pas JWT seul) | ✅ |
| Workflow | SQLite synchrone = pas de race conditions | ✅ |

---

## Plan de corrections recommandé

### Phase 1 — Critiques (immédiat)
1. Ajouter token d'accès TV sur les endpoints display publics
2. Ajouter validation JWT_SECRET (longueur + valeurs connues)
3. Chiffrer `email_config.smtp_pass` et `display_screens.token`
4. Activer `PRAGMA secure_delete = ON`
5. `npm audit fix` pour basic-ftp

### Phase 2 — Élevées (sous 2 semaines)
1. Supprimer les emails de `/api/auth/users-public` ou ajouter auth
2. Corriger `ProfileEditModal.jsx` (Bearer undefined)
3. Empêcher l'auto-approbation des congés
4. Ajouter détection de conflit à l'approbation des réservations
5. Renforcer la politique de mot de passe (8+ chars, complexité)
6. Mettre à jour `bcrypt` → 6.0.0

### Phase 3 — Moyennes (sous 1 mois)
1. Sanitiser `document.write(data.html)` avec DOMPurify
2. Ajouter CHECK/UNIQUE constraints en DB
3. Vider IndexedDB au logout
4. Rate limiters spécifiques sur endpoints sensibles
5. Mettre à jour les dépendances restantes

---

*Ce rapport est généré automatiquement et sera mis à jour à chaque audit.*
