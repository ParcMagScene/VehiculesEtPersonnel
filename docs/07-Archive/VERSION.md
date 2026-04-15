# eM@g — Version

**Version courante** : `2.5.0`  
**Date** : 11 avril 2026  
**Branche** : `dev`

---

## Versions par composant

| Composant | Version | Package |
|-----------|---------|---------|
| **Application globale** | 2.5.0 | `package.json` |
| **API Backend** | 1.0.0 | `apps/api/package.json` |
| **Web Frontend** | 2.0.0 | `apps/web/package.json` |
| **Documentation** | 1.0.0 | `docs/docs-index.json` |
| **Prompts** | 1.0.0 | `prompts/prompts-index.json` |

---

## Historique des versions majeures

| Version | Date | Description |
|---------|------|-------------|
| 2.5.0 | 2026-04-11 | Synchronisation bidirectionnelle Google Calendar (push + pull + réconciliation), session Google persistante via localStorage |
| 2.4.1 | 2026-04-10 | Correctifs prod réservations (validation Zod, droits collaborateurs non read_only), build warnings nettoyés, vérification TV 3003 |
| 2.4.0 | 2026-04-09 | Module Sonos complet — contrôles lecture, volume, zones, favoris, widget TV enrichi, sécurité renforcée |
| 2.3.0 | 2026-04-09 | Refactoring Google Calendar OAuth2 — Authorization Code Flow, refresh_token chiffré AES-256-GCM, sync intelligente multi-tab |
| 2.2.0 | 2026-04-08 | Module cartographie des lieux (Leaflet), carte générale + locale, impression A4/A3, marqueurs SVG stylisés DS |
| 2.0.0 | 2026-04-07 | Migration monorepo, audit sécurité (Phases 1-4), Documentation Continue, Versioning Continu, Gouvernance Open-Source |
| 1.0.0 | 2025 | Version initiale — gestion véhicules, personnel, matériel |

---

## Règles de versioning

- **SemVer** : `MAJOR.MINOR.PATCH`
- **MAJOR** : Changement incompatible, refonte, rupture d'API
- **MINOR** : Ajout fonctionnalité, extension
- **PATCH** : Correction, amélioration mineure, documentation
- Toute modification doit passer par le protocole de versioning continu (9 étapes)
- Les changelogs ne sont **jamais écrasés**, uniquement enrichis
