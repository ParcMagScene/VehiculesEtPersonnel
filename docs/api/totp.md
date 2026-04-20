# Module API 2FA TOTP

Version: 1.0.0
Derniere mise a jour: 20 avril 2026
Prefixe: /api/auth/2fa

## Objectif

Activation et verification de l'authentification a deux facteurs TOTP pour les comptes administrateurs.

## Endpoints principaux

- POST /api/auth/2fa/setup
- POST /api/auth/2fa/confirm
- POST /api/auth/2fa/disable
- GET /api/auth/2fa/status
- POST /api/auth/2fa/verify

## Authentification

- JWT requis sur toutes les routes.
- Certaines routes necessitent le role admin.

## Source

- apps/api/totpRoutes.js
