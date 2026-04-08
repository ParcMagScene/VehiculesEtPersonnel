# AUDIT_SECURITE.md — Sécurité API

> **Branche** : `audit/securite` | **Phase** : B ✅ TERMINÉ | **Priorité** : P0
> **Commit** : `40fc034` | **Merge dev** : 8 avril 2026

---

## Objectif

Étendre la validation Zod, renforcer la sanitisation, auditer les endpoints restants sans protection.

## Modules impactés

- Tous les routes backend (23+ fichiers)
- Middleware d'authentification
- Schémas de validation

## Fichiers impactés

| Fichier | Modification prévue |
|---------|-------------------|
| `apps/api/schemas/` | Nouveaux schémas Zod |
| `apps/api/*Routes.js` | Ajout validation |
| `apps/api/server.js` | Rate limiters |
| `apps/api/middleware/` | Sanitisation |

## Problèmes détectés

| # | Sévérité | Problème | Source |
|---|----------|----------|--------|
| S1 | CRIT | Endpoints POST/PUT sans validation body | PLAN_ACTION_EMAG |
| S2 | CRIT | Uploads sans vérification MIME réelle | PLAN_ACTION_EMAG |
| S3 | HIGH | Certains endpoints admin sans requireAdmin | PLAN_ACTION_EMAG |
| S4 | HIGH | Pas de sanitisation HTML sur champs texte libres | PLAN_ACTION_EMAG |
| S5 | HIGH | Réponses d'erreur exposent des détails internes | PLAN_ACTION_EMAG |
| S6 | HIGH | Token refresh sans rotation | PLAN_ACTION_EMAG |
| S7 | HIGH | Pas de limit sur taille body (hors uploads) | PLAN_ACTION_EMAG |
| S8 | MED | CORS permissif en dev | PLAN_ACTION_EMAG |
| S9 | MED | Logs sans masquage données sensibles | PLAN_ACTION_EMAG |
| S10 | MED | Pas d'audit log des actions admin | PLAN_ACTION_EMAG |

## Analyse UI → API → DB

- **Flux** : Frontend `api.request()` → JWT cookie → Express middleware → SQLite
- **Déjà en place** : `authenticateToken`, `requireAdmin`, Helmet, generalLimiter, Zod sur 4 imports
- **Manquant** : Validation body sur la majorité des POST/PUT, sanitisation globale

## ⚠️ Conflit avec audit/imports

Les deux audits touchent `schemas/imports.js` et potentiellement `server.js`.
→ **Résolution** : audit/securite se merge d'abord, audit/imports rebase ensuite.

## Plan d'action

| Étape | Action | État |
|-------|--------|------|
| 1 | Inventorier tous les POST/PUT sans validation | ⬜ TODO |
| 2 | Créer schémas Zod par domaine | ⬜ TODO |
| 3 | Ajouter validation sur endpoints critiques | ⬜ TODO |
| 4 | Vérification MIME uploads | ⬜ TODO |
| 5 | Sanitisation HTML globale | ⬜ TODO |
| 6 | Masquer détails erreur en prod | ⬜ TODO |
| 7 | Body size limit global | ⬜ TODO |

## Tests à effectuer

- `node --test tests/unit.test.js` — 0 régression
- Test POST avec body invalide → 400
- Test upload avec MIME spoofé → rejeté
- Test erreur prod → pas de stack trace

## Notes de validation

_(à remplir après chaque étape)_
