# 📙 API v2 — Index

> Sous-espace de documentation dédié à l'API eM@g v2.
> Base URL : `/api/v2/*` (activée par feature flag serveur `FEATURE_V2_<DOMAINE>`).
>
> Cette API cohabite avec la v1 (`/api/*`) pendant toute la période de transition
> définie par le [plan d'action 3.0](../../../EMAG_3_0_ACTION_PLAN.md) et le
> [plan d'exécution](../../../EXECUTION_PLAN_EMAG_3_0.md).

---

## Modules v2 en cours de spécification

| Module | Statut | Doc |
|--------|--------|-----|
| Planning | 🟡 Cadrage (T-P0-01) — squelette services publié | [planning.md](planning.md) |
| Display | � T-P0-14 + T-P0-15 — discovery + `/config` `/content` `/signals` implémentés | [display.md](display.md) |

---

## Principes communs

- **Payload** : `{ success, data, meta, error }` (T-P1-01, à formaliser).
- **Pagination** : cursor-based (`meta.pagination.cursor` / `next_cursor` / `limit` / `has_more`).
- **Deprecation** : header `Deprecation` + header `Sunset` sur les endpoints v1 lorsqu'un endpoint v2 équivalent est stabilisé.
- **Feature flag serveur** : `FEATURE_V2_<DOMAINE>` (variable d'environnement, off par défaut en production).
- **Feature flag client** : `flags.v2<Domaine>` (préférence utilisateur ou build-time).
- **Coexistence** : la v1 reste servie tant que la v2 n'est pas validée en production (voir points de contrôle `P0-DECISION-2` et `P1-DECISION-2`).

Voir aussi : [../README.md](../README.md), [../../06-Changelog/CHANGELOG_API.md](../../06-Changelog/CHANGELOG_API.md).
