# Module API Suivi Personnel

Version: 1.0.0
Derniere mise a jour: 20 avril 2026
Prefixe: /api/suivi

## Objectif

Gestion des fiches quotidiennes de suivi du personnel, syntheses (jour/semaine/mois) et exports PDF.

## Endpoints principaux

- GET /api/suivi/personnel
- GET /api/suivi/planning-tasks/:date
- PATCH /api/suivi/tache/:tacheId
- GET /api/suivi/synthese/jour/:date
- GET /api/suivi/synthese/semaine/:week
- GET /api/suivi/synthese/mois/:month
- GET /api/suivi/synthese/jour/:date/pdf
- GET /api/suivi/synthese/semaine/:week/pdf
- GET /api/suivi/synthese/mois/:month/pdf
- POST /api/suivi/batch/pdf
- POST /api/suivi/batch/print
- GET /api/suivi/:personnelId/:date
- PATCH /api/suivi/:personnelId/:date
- GET /api/suivi/:ficheId/pdf
- PUT /api/suivi/:ficheId/validate

## Authentification

- JWT requis sur toutes les routes.
- Validation admin requise pour la validation finale de fiche.

## Source

- apps/api/suiviRoutes.js
