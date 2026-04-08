# AUDIT_VIDEO.md — Module Vidéo

> **Branche** : `audit/video` | **Phase** : D | **Priorité** : P1

---

## Objectif

Stabiliser les flux vidéo, corriger les erreurs MediaMTX, améliorer la gestion des timeouts et reconnexions.

## Modules impactés

- Backend vidéo (videoRoutes.js)
- Frontend vidéo (VideoPanel, PresetPanel, CameraCard)
- MediaMTX (configuration, proxy)
- TV client (flux vidéo)

## Fichiers impactés

| Fichier | Modification prévue |
|---------|-------------------|
| `apps/api/videoRoutes.js` | Robustesse proxy |
| `apps/web/src/components/video/` | Reconnexion, timeout |
| `mediamtx.yml` | Configuration |
| `apps/tv-client/main.js` | Flux vidéo TV |

## Problèmes détectés

| # | Sévérité | Problème | Source |
|---|----------|----------|--------|
| V1 | CRIT | Stream crash sans reconnexion auto | PLAN_ACTION_EMAG |
| V2 | HIGH | Timeout trop court sur proxy MediaMTX | PLAN_ACTION_EMAG |
| V3 | MED | Pas de feedback UI quand caméra hors ligne | PLAN_ACTION_EMAG |
| V4 | MED | Logs MediaMTX non capturés | PLAN_ACTION_EMAG |
| V5 | MED | Preset partagés sans contrôle d'accès | Commit `5e809fc` |

## Analyse UI → API → DB

- **UI** : `VideoPanel.jsx` → `CameraCard.jsx` → `<img>` MJPEG ou HLS
- **API** : `GET /api/video/cameras` → DB `cameras` table
- **Proxy** : `GET /api/video/snapshot/:id` → proxy vers caméra IP
- **MediaMTX** : RTSP→HLS transcoding, ports 8554/8888
- **DB** : `cameras` (id, name, ip, port, channel, username, password_encrypted)

## Plan d'action

| Étape | Action | État |
|-------|--------|------|
| 1 | Scan complet flux vidéo (proxy, snapshot, HLS) | ⬜ TODO |
| 2 | Ajouter reconnexion auto sur stream crash | ⬜ TODO |
| 3 | Augmenter timeout proxy | ⬜ TODO |
| 4 | Feedback UI caméra hors ligne | ⬜ TODO |
| 5 | Audit presets partagés (contrôle accès) | ⬜ TODO |

## Tests à effectuer

- Test stream avec caméra online → flux stable
- Test stream avec caméra offline → message clair, retry auto
- Test preset multi-caméras
- Test fenêtre détachée

## Notes de validation

_(à remplir après chaque étape)_
