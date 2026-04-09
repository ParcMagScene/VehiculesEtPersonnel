# 📺 API Affichage TV (Dashboard)

> **Version** : 1.0.0  
> **Source** : `displayRoutes.js`  
> **Dernière MÀJ** : 7 avril 2026

---

## Écrans

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/display/screens` | ✅🔑 | Liste écrans TV liés aux affaires |
| POST | `/api/display/screens` | ✅🔑 | Configure écran (nom, layout, affaire assignée) |
| PUT | `/api/display/screens/:id` | ✅🔑 | MAJ config écran |
| DELETE | `/api/display/screens/:id` | ✅🔑 | Supprime écran |

---

## Playlists

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/display/playlists` | ✅ | Playlists média (rotation sur écrans) |
| POST | `/api/display/playlists` | ✅🔑 | Crée playlist |
| PUT | `/api/display/playlists/:id` | ✅🔑 | MAJ playlist |
| DELETE | `/api/display/playlists/:id` | ✅🔑 | Supprime playlist |

---

## Médias

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| POST | `/api/display/media/upload` | ✅🔑 | Upload média (image/vidéo, max 50Mo, multer) |
| GET | `/api/display/media/:id` | ✅ | Sert fichier média |
| DELETE | `/api/display/media/:id` | ✅🔑 | Supprime média |

---

## Messages

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/display/messages` | ✅ | Messages alerte/info pour écrans |
| POST | `/api/display/messages` | ✅🔑 | Crée message (expiration, catégorie) |
| PUT | `/api/display/messages/:id` | ✅🔑 | MAJ message |
| DELETE | `/api/display/messages/:id` | ✅🔑 | Supprime message |

---

## Endpoints spéciaux

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| POST | `/api/display/alarm/test` | ✅🔑 | Déclenche alarme test sur tous les écrans |
| GET | `/api/display/current-affaires` | TV Token | Affaires du jour (pour client TV, auth par `verifyTvToken` — Phase 1) |

---

## Client TV

Le client TV (`apps/tv-client/`) s'authentifie via un token spécifique (`TV_ACCESS_TOKEN`).  
Les endpoints publics pour le client TV sont protégés par le middleware `verifyTvToken` (Phase 1 sécurité).
