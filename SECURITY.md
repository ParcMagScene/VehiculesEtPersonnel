# 🔒 Politique de Sécurité

## Versions Supportées

| Version | Support Sécurité |
| ------- | ---------------- |
| 2.x     | ✅ Support actif |

---

## 🛡️ Vulnérabilités Connues

### État Actuel (Février 2026)

Nous suivons activement les vulnérabilités de nos dépendances via `npm audit`.

#### 📦 Dépendances avec Vulnérabilités

##### 1. xlsx (Haute Priorité)
- **Version actuelle :** 0.18.5
- **Vulnérabilités :**
  - **GHSA-4r6h-8v6p-xvw6** — Prototype Pollution
  - **GHSA-5pgg-2g8v-p4x9** — Regular Expression Denial of Service (ReDoS)
- **Sévérité :** HIGH
- **Impact :**
  - Exploitable uniquement si l'utilisateur importe un fichier Excel malveillant
  - L'application n'accepte les imports que depuis des utilisateurs authentifiés
- **Mitigation actuelle :**
  - ⚠️ Pas de patch disponible
  - Limitation de l'import aux administrateurs uniquement
  - Validation côté serveur des fichiers importés
- **Roadmap :** Évaluer migration vers `exceljs` — cible Q2 2026

##### 2. esbuild/vite (Priorité Modérée)
- **Versions actuelles :** esbuild ≤0.24.2, vite 5.2.0
- **Vulnérabilité :**
  - **GHSA-67mh-4wv8-2f99** — SSRF sur serveur de développement
- **Sévérité :** MODERATE
- **Impact :**
  - ⚠️ Exploitable UNIQUEMENT en mode développement local
  - **Aucun risque en production** (build statique)
- **Mitigation :** Serveur dev uniquement sur réseau local privé
- **Roadmap :** Migration vers Vite 7.x planifiée Q2 2026

---

## 🔐 Pratiques de Sécurité Implémentées

### Backend (Node.js / Express + SQLite)

✅ **Requêtes SQL Préparées**
- 100 % des requêtes utilisent des prepared statements (better-sqlite3)
- Protection contre SQL Injection garantie

✅ **Authentification JWT**
- Tokens expirés après 30 jours (`JWT_EXPIRY_DAYS` configurable)
- Hash bcrypt (12 rounds) pour les mots de passe
- Sessions enregistrées en DB (`active_sessions`) → invalidation au logout
- Middleware `authenticateToken` sur toutes les routes protégées

✅ **Rate Limiting**
- Auth : 20 requêtes / 15 minutes
- API : 200 requêtes / minute
- Implémenté via `express-rate-limit`

✅ **Validation des Entrées**
- Validation des types de données sur toutes les routes POST/PUT
- Regex sur IDs (format attendu)
- Validation des emails
- Génération automatique d'ID si manquant

✅ **Protection des Fichiers**
- `sanitizePath()` sur tous les uploads (anti path-traversal)
- Multer avec filtres : types MIME autorisés, taille max 50 MB
- Dossiers d'upload séparés par contexte (attachments, avatars, messaging-uploads, photos)

✅ **Console Stripping**
- En production, `console.log`, `console.debug` et `console.info` sont supprimés par esbuild
- Seuls `console.warn` et `console.error` sont préservés

### Frontend (React + Vite)

✅ **Protection XSS**
- Aucun usage de `dangerouslySetInnerHTML`
- React échappe automatiquement tout le contenu JSX

✅ **Stockage Tokens**
- JWT stocké en localStorage (acceptable pour usage LAN interne)
- Auto-logout sur erreur 401/403 (sauf endpoints d'auth)
- Pas de refresh token persisté

⚠️ **Limitation connue**
- LocalStorage vulnérable aux attaques XSS. Acceptable en réseau local privé.
- Pour exposition internet publique : migrer vers httpOnly cookies.

### Réseau

✅ **Configuration CORS**
- Whitelist stricte : `magsav.duckdns.org`, `localhost:5174`, `localhost:4173`, IP locale
- Headers sécurisés

⚠️ **HTTPS**
- Actuellement HTTP (réseau local)
- Pour exposition internet : implémenter HTTPS avec Let's Encrypt

### Permissions Granulaires

| Permission | Portée |
|------------|--------|
| `is_admin` | Accès complet (réservations, véhicules, utilisateurs, maintenances) |
| `can_manage_catalog` | CRUD catalogue équipements + flight-cases |
| `can_manage_trucks` | CRUD modèles de camions |

Les routes GET ne nécessitent que l'authentification. Les routes de modification vérifient les permissions spécifiques via middleware.

---

## 📋 Procédure de Mise à Jour des Dépendances

### Audit Régulier

```bash
npm audit                    # Vérifier les vulnérabilités
npm audit --json             # Format JSON pour analyse
npm audit --production       # Production uniquement
```

### Mise à Jour Sécurisée

```bash
# 1. Branche dédiée
git checkout -b security-update-$(date +%Y%m%d)
npm list --depth=0 > package-versions-backup.txt

# 2. Patches mineurs (safe)
npm update

# 3. Vérifier le build
npm run build

# 4. Tester l'application (fonctionnalités critiques)

# 5. Audit résiduel
npm audit

# 6. Commit & merge
git add package.json package-lock.json
git commit -m "Security: Mise à jour des dépendances"
git checkout main && git merge security-update-$(date +%Y%m%d)
```

---

## 🚨 Signaler une Vulnérabilité

### Contact

**Ne créez PAS d'issue publique** pour les vulnérabilités.

- **Email :** admin@magsav.com
- **Délai de réponse :** 48 heures maximum

### Informations à Fournir

- Description détaillée
- Étapes de reproduction
- Impact potentiel
- Version affectée
- Preuve de concept (si disponible)

### Processus de Traitement

1. **Accusé de réception** — 48 h
2. **Évaluation de la gravité** — 1 semaine
3. **Développement du patch** — 2-4 semaines selon gravité
4. **Publication du fix** — avec mention de crédit (si souhaité)
5. **Divulgation publique** — 30 jours après le patch

---

## 🔄 Historique des Mises à Jour Sécurité

### 2026-02-26
- ✅ Mise à jour SECURITY.md (nouvelles permissions, rate limiting, sanitizePath)
- ✅ 56 tables DB, 267 routes API documentées

### 2026-02-08
- ✅ Audit complet, SECURITY.md créé
- ✅ Identification de 3 vulnérabilités (1 high, 2 moderate)
- ✅ Plan de mitigation établi

### 2026-02-04
- ✅ Correction vulnérabilité ID null (réservations)
- ✅ Validation serveur renforcée

---

## ⚖️ Responsabilités

| Rôle | Responsabilité |
|------|---------------|
| **Mainteneur** | Monitoring mensuel, patches critiques sous 7 jours, documentation des risques |
| **Utilisateurs** | Signalement rapide, mots de passe forts, mise à jour navigateurs |

---

## 📞 Support

- 📧 Email : admin@magsav.com
- 📖 Documentation : `ARCHITECTURE.md` (section sécurité)
- 🔧 Issues : GitHub (questions non-sensibles uniquement)

---

**Dernière mise à jour :** 26 février 2026
**Prochaine révision :** Mensuelle
