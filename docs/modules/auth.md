# 🔐 Module Auth

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

## Composants

| Composant | Fichier | Rôle |
|-----------|---------|------|
| LoginForm | `auth/LoginForm.jsx` | Écran connexion (politique mdp intégrée) |
| UserPreferencesModal | `auth/UserPreferencesModal.jsx` | Paramètres utilisateur (thème, notifs) |
| ProfileEditModal | `auth/ProfileEditModal.jsx` | Édition profil + avatar |
| AccessRequestModal | `management/AccessRequestModal.jsx` | Demande d'accès |

## Hooks

- `useSilentRefresh` — Renouvellement automatique JWT
- `useTheme` — Gestion thème

## Service API

`utils/api/admin.js` — Login, register, changement mdp, gestion utilisateurs

## Sécurité (post-audit)

- JWT httpOnly cookie (SameSite=lax)
- Politique mdp : ≥10 chars, majuscule, chiffre, symbole (Phase 2)
- Rate limiting : 5/15min sur login (Phase 3)
- Bearer undefined fix (Phase 1 — CRIT-5)
- IndexedDB nettoyé au logout (Phase 3 — MED-F4)
