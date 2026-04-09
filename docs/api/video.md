# 📹 API Vidéo Surveillance

> **Version** : 1.0.0  
> **Source** : `videoRoutes.js`  
> **Dernière MÀJ** : 7 avril 2026

---

## Caméras

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/video/cameras` | ✅🔑 | Liste caméras (masque credentials, indique support playback) |
| GET | `/api/video/cameras/:id` | ✅ | Détail caméra (sans URL RTSP complète) |
| POST | `/api/video/cameras` | ✅🔑 | Crée caméra (chiffre mot de passe RTSP — AES-256-GCM) |
| PUT | `/api/video/cameras/:id` | ✅🔑 | MAJ caméra (gère update mot de passe) |
| DELETE | `/api/video/cameras/:id` | ✅🔑 | Supprime caméra |

---

## Streaming

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/video/cameras/:id/stream` | ✅ | Initie flux WebRTC via proxy (rate limit 120/min/user) |
| DELETE | `/api/video/cameras/:id/stream` | ✅ | Ferme flux |
| GET | `/api/video/cameras/:id/snapshot` | ✅ | Capture instantanée via HTTP |
| POST | `/api/video/cameras/:id/ptz` | ✅ | Commande PTZ (pan/tilt/zoom) |

---

## Enregistrements

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/video/recordings/search` | ✅ | Recherche enregistrements NVR (Dahua) — plage dates + filtre caméra |

---

## Audit

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/video/access-logs` | ✅🔑 | Journal d'accès vidéo (qui a accédé quelle caméra) |

---

## Sécurité

- **Chiffrement** : Mots de passe RTSP chiffrés AES-256-GCM (VIDEO_CIPHER_KEY auto-persisté — Phase 3)
- **Credentials masqués** : Jamais renvoyés dans les réponses API
- **Rate limiting** : 120 requêtes stream / minute / utilisateur
- **Audit trail** : Tous les accès caméra loggés
- **Proxy** : MediaMTX gère le transcodage RTSP→WebRTC
