# Module API Sonos

Version: 1.0.0
Derniere mise a jour: 20 avril 2026
Prefixe: /api/sonos

## Objectif

Controle des enceintes Sonos sur le reseau local: etat de lecture, zones, favoris, volume, seek, shuffle/repeat et actions de transport.

## Endpoints principaux

- GET /api/sonos/config
- POST /api/sonos/config
- GET /api/sonos/now-playing
- GET /api/sonos/zones
- GET /api/sonos/state/:zone
- POST /api/sonos/play/:zone
- POST /api/sonos/pause/:zone
- POST /api/sonos/next/:zone
- POST /api/sonos/previous/:zone
- POST /api/sonos/volume/:zone
- POST /api/sonos/mute/:zone
- POST /api/sonos/unmute/:zone
- GET /api/sonos/favorites
- GET /api/sonos/radio-stations
- GET /api/sonos/browse/:objectId(*)
- GET /api/sonos/music-services
- GET /api/sonos/queue
- POST /api/sonos/favorite/:zone
- POST /api/sonos/seek/:zone
- POST /api/sonos/shuffle/:zone
- POST /api/sonos/repeat/:zone

## Authentification

- La majorite des routes necessitent un JWT valide.
- Certaines routes de lecture TV utilisent un token TV optionnel.

## Source

- apps/api/sonosRoutes.js
