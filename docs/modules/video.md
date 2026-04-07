# 📹 Module Vidéo

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

## Composants

| Composant | Rôle |
|-----------|------|
| VideoPanel | Panel principal (grille caméras, playback) |
| CameraSettingsModal | Configuration caméra |

## Hooks

- `useCameraList` — Liste caméras + état streaming
- `useWebRTCStream` — Gestion flux WebRTC
- `usePTZ` — Contrôle pan/tilt/zoom

## Service API

`utils/api/video.js` — Streaming caméras, playback enregistrements

## Architecture technique

- **Protocole** : RTSP → WebRTC (via MediaMTX proxy)
- **Chiffrement** : Mots de passe RTSP en AES-256-GCM
- **NVR** : Support Dahua (recherche enregistrements)
- **Audit** : Tous accès caméra loggés
