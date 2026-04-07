# 🔐 API Auth & Gestion Utilisateurs

> **Version** : 1.0.0  
> **Sources** : `authRoutes.js`, `adminRoutes.js`, `profileRoutes.js`  
> **Dernière MÀJ** : 7 avril 2026

---

## Authentification

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| POST | `/api/auth/register` | ❌ | Inscription (email pré-autorisé requis) |
| POST | `/api/auth/login` | ❌ | Connexion → JWT cookie httpOnly |
| POST | `/api/auth/logout` | ✅ | Déconnexion (supprime sessions + clear cache) |
| POST | `/api/auth/forgot-password` | ❌ | Envoi OTP 6 chiffres par email (expire 15min) |
| POST | `/api/auth/self-reset-password` | ❌ | Reset via nom + email + OTP |
| POST | `/api/auth/check-reset` | ❌ | Valide token OTP |
| POST | `/api/auth/set-new-password` | ❌ | Applique nouveau mot de passe |
| POST | `/api/auth/change-password` | ✅ | Changement mot de passe utilisateur connecté |
| POST | `/api/auth/refresh` | ✅ | Silent refresh JWT |
| GET | `/api/auth/users-public` | ❌ | Liste publique (nom + avatar, sans email) |

### Règles métier

- **Politique mot de passe** : ≥10 caractères, 1 majuscule, 1 chiffre, 1 symbole
- **Rate limiting** : 5 tentatives / 15 minutes (authLimiter)
- **JWT** : Cookie httpOnly, SameSite=lax, expiration configurable
- **Sessions** : Enregistrées en DB (`active_sessions`), nettoyage automatique

---

## Demandes d'accès

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| POST | `/api/access-requests` | ❌ | Demande d'accès (workflow approbation admin) |
| POST | `/api/access-requests/check-email` | ❌ | Vérifie si email pré-autorisé |
| GET | `/api/access-requests` | ✅🔑 | Liste demandes en attente |
| PATCH | `/api/access-requests/:id` | ✅🔑 | Approuve / rejette |
| GET | `/api/access-requests/count/pending` | ✅🔑 | Compteur demandes en attente |

---

## Gestion utilisateurs (Admin)

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/users` | ✅🔑 | Liste tous les utilisateurs |
| GET | `/api/users/names` | ✅ | Liste {id, name} pour autocomplete |
| PATCH | `/api/users/:id` | ✅🔑 | Modifie rôle, permissions, statut |
| DELETE | `/api/users/:id` | ✅🔑 | Soft-delete (marque inactif) |
| POST | `/api/admin/reset-password` | ✅🔑 | Reset forcé mot de passe |
| GET | `/api/authorized-emails` | ✅🔑 | Emails pré-autorisés |
| POST | `/api/authorized-emails` | ✅🔑 | Pré-autorise un email |
| DELETE | `/api/authorized-emails/:id` | ✅🔑 | Révoque autorisation |

---

## Profil utilisateur

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| PATCH | `/api/users/me` | ✅ | MAJ profil (nom) |
| POST | `/api/users/me/avatar` | ✅ | Upload avatar (max 5Mo, image) |
| DELETE | `/api/users/me/avatar` | ✅ | Supprime avatar |
| GET | `/api/users/me/preferences` | ✅ | Préférences JSON |
| PUT | `/api/users/me/preferences` | ✅ | Sauvegarde préférences |
| PATCH | `/api/users/:id/profile` | ✅🔑 | Admin MAJ profil utilisateur |
| POST | `/api/users/:id/avatar` | ✅🔑 | Admin upload avatar |
| DELETE | `/api/users/:id/avatar` | ✅🔑 | Admin supprime avatar |
