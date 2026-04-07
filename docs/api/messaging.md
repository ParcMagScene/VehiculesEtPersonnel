# 💬 API Messagerie

> **Version** : 1.0.0  
> **Source** : `messagingRoutes.js`  
> **Dernière MÀJ** : 7 avril 2026

---

## Endpoints

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/messaging/conversations` | ✅ | Conversations de l'utilisateur + compteurs non lus + derniers messages |
| POST | `/api/messaging/conversations` | ✅ | Crée conversation (déduplique direct 1:1 ou groupe) |
| GET | `/api/messaging/conversations/:id/messages` | ✅ | Messages paginés par cursor (limit 50) + pièces jointes |
| POST | `/api/messaging/conversations/:id/messages` | ✅ | Poste message texte/image/vidéo |
| POST | `/api/messaging/conversations/:id/messages/file` | ✅ | Upload fichier (allowlist MIME, max 25Mo, sanitize filename) |
| DELETE | `/api/messaging/messages/:id` | ✅ | Supprime propre message (soft delete) |
| PUT | `/api/messaging/messages/:id` | ✅ | Édite propre message |
| POST | `/api/messaging/conversations/:id/read` | ✅ | Marque conversation comme lue |
| GET | `/api/messaging/unread-count` | ✅ | Total messages non lus |

---

## Sécurité uploads (Phase 4)

Types MIME autorisés :
- Images : `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Vidéo : `video/mp4`, `video/webm`
- Documents : `application/pdf`, `text/plain`
- Office : `.doc`, `.docx`, `.xls`, `.xlsx`

**Bloqués** : SVG (vecteur XSS), exécutables, scripts

**Validation** :
- Taille max : 25 Mo
- Filename sanitisé : `basename()` + regex `[^a-zA-Z0-9._-]` → `_`
- Protection path traversal

---

## Tables associées

| Table | Rôle |
|-------|------|
| `conversations` | Conversations (direct ou groupe) |
| `conversation_participants` | Participants + last_read_at |
| `messages` | Messages (text, image, video, file) |
| `message_attachments` | Fichiers uploadés |
