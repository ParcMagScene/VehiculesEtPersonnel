# 📙 Documentation API — eM@g

> Référence complète de tous les endpoints REST du backend Express.js.
>
> **Version** : 1.0.0  
> **Dernière mise à jour** : 7 avril 2026  
> **Base URL** : `http://localhost:3002/api`

---

## Authentification

Toutes les routes marquées ✅ requièrent un JWT valide (cookie `auth_token` httpOnly).  
Les routes marquées 🔑 requièrent en plus le rôle `is_admin`.

---

## Modules API

| Module | Fichier source | Doc | Endpoints |
|--------|---------------|-----|:---------:|
| Auth & Accès | `authRoutes.js` + `adminRoutes.js` | [auth.md](auth.md) | 22 |
| Véhicules & Réservations | `vehicleRoutes.js` | [vehicles.md](vehicles.md) | 10 |
| Personnel & Planning | `personnelRoutes.js` | [personnel.md](personnel.md) | 22 |
| Matériel & SAV | `equipmentRoutes.js` | [equipment.md](equipment.md) | 20 |
| Affaires | `affairesRoutes.js` | [affaires.md](affaires.md) | 6 |
| Commandes & Fournisseurs | `ordersRoutes.js` | [orders.md](orders.md) | 24 |
| Stock | `stockRoutes.js` | [stock.md](stock.md) | 12 |
| Planning & Tâches | `planningRoutes.js` | [planning.md](planning.md) | 28 |
| Messagerie | `messagingRoutes.js` | [messaging.md](messaging.md) | 9 |
| Congés | `leaveRoutes.js` | [leaves.md](leaves.md) | 20 |
| Annuaire | `annuaireRoutes.js` | [annuaire.md](annuaire.md) | 18 |
| Vidéo | `videoRoutes.js` | [video.md](video.md) | 11 |
| Affichage TV | `displayRoutes.js` | [display.md](display.md) | 16 |
| Pièces jointes | `attachmentsRoutes.js` | [attachments.md](attachments.md) | 5 |
| Catalogue fournisseurs | `supplierCatalogRoutes.js` | [supplier-catalog.md](supplier-catalog.md) | 12 |
| Profil utilisateur | `profileRoutes.js` | [auth.md](auth.md#profil-utilisateur) | 8 |

**Total : ~243 endpoints**

---

## Conventions

- **Format réponse** : JSON `{ data?, error?, message? }`
- **Pagination** : `?page=1&limit=50` ou cursor-based `?cursor=<id>&limit=50`
- **Filtres** : Query params spécifiques par module
- **Erreurs** : HTTP standard (400, 401, 403, 404, 409, 500)
- **Rate limiting** : Auth 5/15min, sensible 10/15min, général 600/min

---

## Middlewares transversaux

| Middleware | Fichier | Rôle |
|-----------|---------|------|
| `authenticateToken` | `middleware/authenticate.js` | JWT + session DB (cache 30s) |
| `requireAdmin` | `middleware/authorize.js` | Vérifie `is_admin` |
| `xssSanitize` | `middleware/sanitize.js` | Nettoyage XSS entrées |
| `rateLimiter` | `config/rateLimiter.js` | Limitation débit |
| `corsMiddleware` | `config/cors.js` | CORS allowlist |
| `helmetMiddleware` | `config/helmet.js` | En-têtes sécurité |
| `verifyTvToken` | `middleware/tvAuth.js` | Auth client TV |
