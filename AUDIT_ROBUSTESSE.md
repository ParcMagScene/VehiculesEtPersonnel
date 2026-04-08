# AUDIT_ROBUSTESSE.md — Configuration & Gouvernance

> **Branche** : `audit/robustesse` | **Phase** : A | **Priorité** : P2

---

## Objectif

Corriger les incohérences de configuration, aligner le versioning, documenter PM2, compléter .env.

## Modules impactés

- Configuration globale (VERSION.md, package.json, .env)
- Documentation opérationnelle (PM2, ports)
- Scripts de déploiement

## Fichiers impactés

| Fichier | Modification prévue |
|---------|-------------------|
| `VERSION.md` | Aligner sur package.json |
| `package.json` | Vérifier version |
| `.env.example` | Compléter 5 vars manquantes |
| `docs/04-Operations/` | Documenter PM2 |
| `apps/api/server.js` | Log PORT cohérent |

## Problèmes détectés

| # | Sévérité | Problème | Source |
|---|----------|----------|--------|
| R1 | HIGH | VERSION.md incohérent avec package.json | PLAN_ACTION_EMAG |
| R2 | HIGH | 5 variables .env manquantes dans .env.example | PLAN_ACTION_EMAG |
| R3 | HIGH | PM2 non documenté (ecosystem, ports, restart) | PLAN_ACTION_EMAG |
| R4 | MED | Log PORT incohérent au démarrage serveur | PLAN_ACTION_EMAG |
| R5 | MED | CI dev branch workflow à valider | PLAN_ACTION_EMAG |
| R6 | LOW | 3 assets orphelins dans public/images/ | PLAN_ACTION_EMAG |
| R7 | LOW | SECURITY_AUDIT.md duplique AUDIT.md | PLAN_ACTION_EMAG |

## Plan d'action

| Étape | Action | État |
|-------|--------|------|
| 1 | Aligner VERSION.md ↔ package.json | ⬜ TODO |
| 2 | Compléter .env.example | ⬜ TODO |
| 3 | Documenter PM2 ecosystem | ⬜ TODO |
| 4 | Corriger log PORT serveur | ⬜ TODO |
| 5 | Nettoyer assets orphelins | ⬜ TODO |
| 6 | Déprécier SECURITY_AUDIT.md | ⬜ TODO |

## Tests à effectuer

- `node --test tests/unit.test.js` — 0 régression
- Vérifier démarrage serveur (log PORT correct)
- Vérifier `.env.example` complet

## Notes de validation

_(à remplir après chaque étape)_
