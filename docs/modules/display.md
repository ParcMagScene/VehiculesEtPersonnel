# 📺 Module Affichage TV

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

## Composants

| Composant | Rôle |
|-----------|------|
| DisplayDashboardPanel | Panel config écrans |
| MessageFormModal | Création message écran |
| ScreenFormModal | Configuration écran |
| PlaylistFormModal | Gestion playlists |
| TemplateFormModal | Templates affichage |
| MediaUploadModal | Upload média |

## Client TV

Application dédiée dans `apps/tv-client/` — authentification par `TV_ACCESS_TOKEN`.

## Service API

`utils/api/display.js` — Écrans, templates, playlists, médias, messages

## Sécurité

- Endpoints TV protégés par `verifyTvToken` (Phase 1 — CRIT-1)
- Upload média max 50Mo
