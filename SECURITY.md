# SECURITY.md — Politique de Sécurité eM@g

> **Version de sécurité** : 1.0.0  
> **Date** : 7 avril 2026  
> **Branche** : `oss-preparation`

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
- Login : 30 tentatives/15 min
- API sensibles : rate limiters dédiés

## Vulnérabilités connues

Voir [SECURITY_AUDIT.md](docs/02-Securite/SECURITY_AUDIT.md) pour le rapport complet.

## Dépendances

Exécutez `npm audit` régulièrement. Voir la section dépendances du rapport d'audit pour l'état actuel.
