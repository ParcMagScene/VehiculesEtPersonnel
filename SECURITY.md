# SECURITY.md — Politique de Sécurité eM@g

> **Version de sécurité** : 1.0.0  
> **Date** : 8 avril 2026  
> **Branche** : `dev`

## Signaler une vulnérabilité

Si vous découvrez une faille de sécurité, **ne créez PAS d'issue publique**.

Envoyez un email à : **security@votre-domaine.example.com**  
Incluez :
- Description de la vulnérabilité
- Étapes de reproduction
- Impact estimé
- Correction proposée (si applicable)

Nous nous engageons à :
- Accuser réception sous **48h**
- Fournir un correctif sous **7 jours** (critique) / **30 jours** (autre)
- Créditer le rapporteur dans le changelog (sauf si anonymat demandé)

## Périmètre

| Composant | Couvert |
|-----------|---------|
| Backend Express.js (`apps/api/`) | ✅ |
| Frontend React (`apps/web/`) | ✅ |
| Base de données SQLite | ✅ |
| Client TV (`apps/tv-client/`) | ✅ |
| Dépendances npm | ✅ |
| Infrastructure (serveur, réseau) | ❌ Hors périmètre |

## Architecture de sécurité

### Authentification
- **JWT** dans cookie `httpOnly` + `SameSite=lax`
- Flag `Secure` activé en production (désactivable via `ALLOW_HTTP` pour LAN sans TLS)
- Sessions persistantes en DB avec révocation possible
- Refresh token silencieux (toutes les 12h)
- Inscription par invitation uniquement (emails pré-autorisés)

### Autorisation
- Modèle RBAC : Admin / Utilisateur
- Permissions granulaires par module (JSON en DB)
- Middleware `requireAdmin` et `authorize()` systématiques
- Vérification permissions en DB (pas seulement JWT)

### Protection des données
- Mots de passe hashés avec **bcrypt** (cost factor auto)
- Tokens de reset hashés (SHA-256)
- Sessions hashées en DB
- Mots de passe caméras chiffrés AES-256 (`VIDEO_CIPHER_KEY`)
- Sanitisation XSS globale sur tous les `req.body` (middleware)
- Path traversal protection sur les uploads (sanitizePath + sanitizeFilename)
- Requêtes SQL 100% paramétrisées (better-sqlite3 prepared statements)

### Headers de sécurité
- **Helmet.js** configuré (CSP, X-Frame-Options, X-Content-Type-Options, etc.)
- HSTS désactivé (HTTP uniquement en déploiement interne)
- CORS avec whitelist stricte d'origines

### Rate limiting
- Global : 600 req/min par IP
- Login : 5 tentatives/15 min (prod), 50 en dev
- Endpoints sensibles : 10 req/15 min (reset password, access requests)

### Validation des entrées
- **Zod** sur les imports CSV/JSON (equipment, personnel, SAV, affaires)
- Regex sur IDs, validation email, sanitisation XSS globale

### Health check
- `GET /api/health` — vérifie la connexion DB, retourne uptime (503 si erreur DB)
- Smoke test post-déploiement dans `safe-deploy.sh`

### Tests automatisés
- 56 tests : 21 unit + 17 schémas Zod + 18 DB init
- CI GitHub Actions : `npm test` avant build (`protect-prod.yml`)

## Vulnérabilités connues

Voir [SECURITY_AUDIT.md](docs/02-Securite/SECURITY_AUDIT.md) pour le rapport complet.

## Risques acceptés (Known Accepted Risks)

| CVE / Advisory | Package | Sévérité | Raison de l'acceptation | Atténuation |
|---|---|---|---|---|
| GHSA-67mh-4wv8-2f99 | esbuild ≤0.24.2 (via vite@5.4.21) | Moderate | Affecte uniquement le serveur de dev local, aucun impact en production | Vite 5.4.21 est la dernière v5 ; la montée en v6/v8 est un breaking change majeur. Correction prévue lors de la migration Vite majeure. |
| GHSA-2p57-rm9w-gvfp | ip@* (via sonos@1.14.3) | High | Toutes versions affectées — pas de fix disponible. Sonos utilise ip pour la découverte réseau locale uniquement. | Protection SSRF applicative dans `displayRoutes.js` (Phase B). Blocage des IPs privées/localhost au niveau applicatif. |
| GHSA-5v7r-6r5c-r473 | file-type 13.0-21.3 | Moderate | Le fix (v22) est un breaking change ESM. Parser ASF touché par boucle infinie sur input malformé. | Les fichiers sont validés par taille max (50MB) et type MIME avant parsing. Risque limité aux uploads admin. |

> **Date de revue** : 9 avril 2026 — Prochaine revue prévue : 9 juillet 2026

## Dépendances

Exécutez `npm audit` régulièrement. Voir la section dépendances du rapport d'audit pour l'état actuel.
