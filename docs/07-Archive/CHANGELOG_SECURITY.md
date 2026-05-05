# Changelog Sécurité — eM@g

Toutes les modifications liées à la sécurité du projet.

## [1.0.0] — 2026-04-07

### Audit initial
- **Audit complet** : Backend Express, Frontend React, Base SQLite, Dépendances npm, Workflows métier
- **8 vulnérabilités critiques** identifiées
- **22 vulnérabilités élevées** identifiées
- **37 vulnérabilités moyennes** identifiées
- **21 vulnérabilités basses** identifiées
- **27 points forts** confirmés

### Documentation créée
- `SECURITY.md` (racine) — Politique de sécurité et signalement
- `docs/02-Securite/SECURITY_AUDIT.md` — Rapport d'audit complet
- `CHANGELOG_SECURITY.md` — Ce fichier

### Points forts confirmés
- Requêtes SQL 100% paramétrisées (zero injection SQL directe)
- JWT dans cookie httpOnly + SameSite=lax
- Sanitisation XSS globale via middleware
- Protection path traversal sur les uploads
- Aucun secret hardcodé dans le frontend
- Passwords hashés bcrypt, tokens hashés SHA-256
- Error handler centralisé (pas de leak de stack trace)

### À corriger — voir `SECURITY_AUDIT.md` pour le plan complet

## Phase A — Qualité Code (2026-04-07)

### Corrigé
- `stockRoutes.js:168` — Template literal dans LIKE → requête paramétrisée
- `displayRoutes.js:914` — authenticateToken ajouté sur GET /api/display/welcome-message

### Reclassifié (faux positifs)
- `supplierCatalogRoutes.js:86-88` — Fragments conditionnels contrôlés, valeurs via `?` → **sûr**
- `planningRoutes.js:629` — Noms de colonnes hardcodés + valeurs via `?` → **sûr**
- `ordersRoutes.js:1342,1391` — Pattern IN standard `ids.map(() => '?').join(',')` → **sûr**
- `annuaireRoutes.js:618-643` — Table names issus d'un dict hardcodé → **sûr**
- `equipmentRoutes.js:887` — Pattern IN standard → **sûr**
