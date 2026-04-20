# Module API Google OAuth2

Version: 1.0.0
Derniere mise a jour: 20 avril 2026
Prefixe: /api/google

## Objectif

Connexion OAuth2 Google Calendar cote serveur, proxy d'operations agenda et synchronisation des reservations.

## Endpoints principaux

- GET /api/google/auth
- GET /api/google/callback
- GET /api/google/status
- POST /api/google/disconnect
- GET /api/google/configured
- GET /api/google/calendars
- POST /api/google/calendars
- GET /api/google/events
- GET /api/google/events/:eventId
- POST /api/google/events
- PUT /api/google/events/:eventId
- DELETE /api/google/events/:eventId
- POST /api/google/sync/pull-reservations

## Authentification

- JWT requis pour les operations utilisateur.
- Callback OAuth2 public, protege par validation state CSRF.

## Source

- apps/api/googleRoutes.js
