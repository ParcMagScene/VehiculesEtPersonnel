Tu es Copilot, expert en WebRTC, RTSP, Node.js, Express, React, sécurité réseau, proxys vidéo, caméras IP (Dahua, Hikvision, Ezviz), et intégration dans des systèmes complexes.
Ta mission : implémenter un module complet de surveillance vidéo WebRTC dans eM@g, basé sur les caméras détectées dans le scan réseau (Dahua, Hikvision, Ezviz, etc.).

🎯 Objectif général
Créer un module Vidéo dans eM@g permettant :

Lecture WebRTC en temps réel (<300 ms)

Conversion RTSP → WebRTC via un serveur proxy interne

Multi‑caméras (1 / 4 / 9 / 16)

Contrôle PTZ (Pan / Tilt / Zoom)

Snapshots

Mode plein écran

Mode TV (rotation automatique)

Mode Mobile (PWA)

Sécurité stricte (pas d’accès direct aux caméras)

Intégration avec les Affaires (zones, dépôts, véhicules)

Gestion des caméras dans l’interface Admin

Logs d’accès vidéo

🧩 1. Architecture technique obligatoire
✔ Backend Express (module videoRoutes.js)
Générer les endpoints suivants :

Code
GET /api/video/cameras
POST /api/video/cameras
PUT /api/video/cameras/:id
DELETE /api/video/cameras/:id

GET /api/video/cameras/:id/webrtc-offer
POST /api/video/cameras/:id/webrtc-answer

POST /api/video/cameras/:id/ptz
GET /api/video/cameras/:id/snapshot
✔ Serveur proxy WebRTC obligatoire
Utiliser rtsp-simple-server / MediaMTX pour :

Convertir RTSP → WebRTC

Gérer les sessions

Gérer les ICE candidates

Gérer STUN/TURN internes

Protéger l’accès par token eM@g

✔ Base de données SQLite
Créer la table :

Code
cameras (
  id INTEGER PRIMARY KEY,
  name TEXT,
  brand TEXT,
  ip TEXT,
  rtsp_url TEXT,
  username TEXT,
  password TEXT,
  ptz_supported BOOLEAN,
  location TEXT,
  affaire_id INTEGER,
  last_seen DATETIME,
  enabled BOOLEAN
)
✔ Sécurité
Aucun accès direct aux caméras depuis le navigateur

Tous les flux passent par le proxy WebRTC

Authentification eM@g obligatoire

Chiffrement des mots de passe caméras

Tokens temporaires pour sessions WebRTC

Rate limiting sur les flux

Logs d’accès

🎨 2. Frontend React (module VideoPanel.jsx)
Générer les composants :

CameraGrid.jsx

CameraPlayerWebRTC.jsx

CameraPTZControls.jsx

CameraSelector.jsx

CameraSettingsModal.jsx

CameraSnapshotButton.jsx

CameraFullscreenButton.jsx

Fonctionnalités :

Lecture WebRTC

Grille dynamique

Mode plein écran

Snapshots

PTZ

Rotation automatique (mode TV)

Mode sombre / clair

Compatibilité mobile (PWA)

Hooks :

useWebRTCStream(camera)

usePTZ(camera)

useCameraList()

📱 3. Intégration Mobile (PWA)
Générer :

Interface responsive

Swipe entre caméras

Mode plein écran natif

Lecture WebRTC via RTCPeerConnection

Snapshots

PTZ

Mode “Surveillance rapide”

📺 4. Intégration TV Client
Générer :

Grille 4 / 9 / 16 caméras

Rotation automatique

Mode nuit

Lecture WebRTC

Affichage sans interaction

🕹 5. Contrôle PTZ
Implémenter :

Dahua
/cgi-bin/ptz.cgi?action=start&channel=1&code=Left&arg1=0&arg2=1&arg3=0

Auth Basic

Hikvision
/ISAPI/PTZCtrl/channels/1/continuous

XML ou JSON

Ezviz
API propriétaire (fallback ONVIF)

ONVIF fallback
Pan / Tilt / Zoom

Presets

🔐 6. Sécurité obligatoire
Proxy WebRTC sécurisé

Aucun accès direct aux caméras

Chiffrement des mots de passe

Tokens de session WebRTC

Limitation du nombre de flux

Journalisation des accès vidéo

🧪 7. Livrables attendus
Copilot doit produire :

Backend complet
Routes Express

Services WebRTC

Proxy config

PTZ API

Snapshots

Sécurité

Frontend complet
Composants React

Hooks

UI Desktop + Mobile + TV

Base de données
Schéma

Migrations

Seed

Scripts
Installation du proxy WebRTC

Configuration Dahua / Hikvision

Vérification des flux

Documentation
Architecture

Sécurité

Déploiement

Maintenance

🚀 Action
Génère maintenant :

Le backend complet WebRTC

Le proxy WebRTC

Les routes Express

Les composants React

Le module mobile

Le module TV

Le PTZ

Le snapshot

Le schéma DB

Le plan de sécurité

Le plan de déploiement

Le tout intégré proprement dans eM@g, sans casser l’existant.