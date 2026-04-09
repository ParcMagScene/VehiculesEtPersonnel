# AUDIT_VIDEO.md — Module Vidéo

> **Branche** : `audit/video` | **Phase** : D | **Priorité** : P1
> **Statut** : ✅ TERMINÉ — commit `f5adeb3`

---

## Scan

- **Fichiers analysés** : videoRoutes.js (710 lignes), videoProxyService.js (500 lignes), useWebRTCStream.js (130 lignes), CameraPlayerWebRTC.jsx (110 lignes), PlaybackPanel.jsx (300 lignes), mediamtx.yml (150 lignes)
- **Findings** : 5 corrigés + 3 backlog

## Corrections appliquées

| # | Sévérité | Problème | Fichier | Fix |
|---|----------|----------|---------|-----|
| V1 | CRIT | Mots de passe caméras en clair dans mediamtx.yml (18 paths `888888:888888` + `JXIYXG`) | `mediamtx.yml` (local) | Supprimé tous les paths statiques — le backend les enregistre dynamiquement via `registerStreamInProxy()` |
| V2 | HIGH | Presets sans contrôle d'accès — GET retourne tous, PUT/DELETE sans vérif propriétaire | `videoRoutes.js` | GET filtre `is_shared=1 OR user_id=?`, PUT/DELETE vérifient `user_id` ou `role=admin` |
| V3 | HIGH | Session close ne libère pas le stream WHEP dans MediaMTX → gaspillage NVR | `videoRoutes.js` | Appel `whepDelete(session.location)` avant `removeSession()` |
| V4 | MED | `activeSessions` Map sans limite → croissance mémoire illimitée | `videoProxyService.js` | Cap à 500 sessions, purge de la plus ancienne si cap atteint |
| V5 | MED | TV WHEP : `req.params.id` sans `parseInt`, pas de rate limit | `videoRoutes.js` | `parseInt` + `checkStreamRate('tv_' + id)` |

## Backlog (non bloquant)

| # | Problème | Raison du report |
|---|----------|-----------------|
| B1 | `streamRateMap` sans purge auto des vieilles entrées | Fuite mémoire lente, pas critique en usage normal |
| B2 | PlaybackPanel pas de reconnexion auto sur disconnect | Playback = one-shot, le NVR ferme naturellement |
| B3 | Snapshot canvas fallback peut produire image vide si videoWidth=0 | Edge case rare |

## Notes

- `mediamtx.yml` est dans `.gitignore` (contient des credentials locaux) → le nettoyage V1 est local uniquement, non commitable
- La reconnexion auto live stream (CRIT original V1 du plan initial) est **déjà implémentée** dans `useWebRTCStream.js` : `doReconnect()` avec max 2 tentatives sur `iceConnectionState === 'failed'` ou `'disconnected'` après 5s
