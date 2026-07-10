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
| **Core** | 🟢 T-P1-01 — payload commun + pagination cursor + `GET /api/v2/meta` discovery global | [core.md](core.md) |
| **WebSocket** | 🟢 T-P1-02 — socle serveur (`ws`) + auth JWT + namespace `meta` + client reconnexion exponentielle (messaging/display reportés T-P1-02b) | [websocket.md](websocket.md) |
| Planning | 🟡 Cadrage (T-P0-01) — squelette services publié | [planning.md](planning.md) |
| Display | 🟢 T-P0-14 + T-P0-15 + T-P0-16 — discovery + `/config` `/content` `/signals` + SSE `/signals/stream` + TV-client v2 | [display.md](display.md) |
| Locations | 🟢 T-P0-12 — discovery + `/depots` + `/depots/:id` + `PATCH /equipment/:id/location` | [locations.md](locations.md) |
| Affaires | 🟢 T-P0-09 — discovery + `GET /affaires` (cursor) + `GET /affaires/:num` + `/history` + `PATCH` audité | [affaires.md](affaires.md) |
| Leaves | 🟢 T-P1-04 — discovery + `POST /calculate` (miroir v1) + `GET /balance/mine` + `GET /balance/:person_id` (admin) | [leaves.md](leaves.md) |
| Conflicts | 🟢 T-P1-05 — discovery + `POST /check` (détection agenda `availabilities` + `missions` + `task_assignments`) | [conflicts.md](conflicts.md) |
| Equipment UID | 🟢 T-P1-06 — discovery + `GET /audit` (doublons serials/uid) + `POST /equipment/:id/regenerate-uid` (admin, audit dans `equipment.notes`) | [equipment-uid.md](equipment-uid.md) |
| SAV | 🟢 T-P1-07 — discovery + machine d'état (`POST /tickets/:id/transition`) + pièces détachées (`GET`/`POST /tickets/:id/parts` + `PATCH /parts/:id/status`) | [sav.md](sav.md) |
| Equipment Assignments | 🟢 T-P1-08 — discovery + `POST /equipment/:id/assignments` (double-assign bloquée) + `POST /:aid/release` + history | [equipment-assignments.md](equipment-assignments.md) |
| Orders | 🟢 T-P1-09 — discovery + `POST /orders/:id/transition` + `POST /quotes/:id/transition` (matrices strictes réutilisées v1) | [orders.md](orders.md) |

---

## Principes communs

- **Payload** : `{ success, data, meta, error }` (T-P1-01, à formaliser).
- **Pagination** : cursor-based (`meta.pagination.cursor` / `next_cursor` / `limit` / `has_more`).
- **Deprecation** : header `Deprecation` + header `Sunset` sur les endpoints v1 lorsqu'un endpoint v2 équivalent est stabilisé.
- **Feature flag serveur** : `FEATURE_V2_<DOMAINE>` (variable d'environnement, off par défaut en production).
- **Feature flag client** : `flags.v2<Domaine>` (préférence utilisateur ou build-time).
- **Coexistence** : la v1 reste servie tant que la v2 n'est pas validée en production (voir points de contrôle `P0-DECISION-2` et `P1-DECISION-2`).

Voir aussi : [../README.md](../README.md), [../../06-Changelog/CHANGELOG_API.md](../../06-Changelog/CHANGELOG_API.md).
