# 📎 API Pièces Jointes

> **Version** : 1.0.0  
> **Source** : `attachmentsRoutes.js`  
> **Dernière MÀJ** : 7 avril 2026

---

## Endpoints

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| POST | `/api/create-folder` | ✅ | Crée dossier affaire (chemin sanitisé, protection traversal) |
| POST | `/api/upload-attachment` | ✅ | Upload fichier (max 50Mo, multer, MIME allowlist) |
| GET | `/api/attachments/:affaireId` | ✅ | Liste contenu dossier affaire |
| GET | `/api/attachments/:affaireId/*` | ✅ | Sert fichier (statique) |
| DELETE | `/api/attachments/:affaireId/:filename` | ✅ | Supprime pièce jointe |

---

## Types MIME autorisés (Phase 4)

| Catégorie | Types |
|-----------|-------|
| Images | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| Documents | `application/pdf`, `text/plain` |
| Office | `application/msword`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx` |
| Archives | `application/zip`, `application/x-rar` |
| Vidéo | `video/mp4`, `video/webm`, `video/quicktime` |
| Audio | `audio/mpeg`, `audio/wav` |

**Bloqué** : `image/svg+xml` (vecteur XSS — Phase 4 STAB)

---

## Sécurité

- **Path traversal** : Chemin sanitisé, `basename()` appliqué
- **Taille max** : 50 Mo par fichier
- **Stockage** : `public/attachments/<affaireId>/`
