# SPEC — Planning v2 (design doc)

> **Version** : 0.1.0 (cadrage T-P0-01)
> **Statut** : `Cadrage`
> **Auteurs** : équipe eM@g
> **Références** :
> - [EMAG_3_0_ACTION_PLAN.md](../../EMAG_3_0_ACTION_PLAN.md) §3.1.1
> - [EXECUTION_PLAN_EMAG_3_0.md](../../EXECUTION_PLAN_EMAG_3_0.md) T-P0-01 → T-P0-06
> - [../api/v2/planning.md](../api/v2/planning.md)

---

## 1. Objectif

Sortir le module Planning de son monolithisme actuel :

- `apps/api/planningRoutes.js` : routeur ~2600 lignes couvrant tâches, événements, imports BL/BP, affaires planning, iCal, statistiques.
- `task_assignments` : table à 50+ colonnes reconstruite plusieurs fois au boot (dette structurelle).
- Couplage fort entre pilotage opérationnel, communication et affichage TV.
- Absence de pagination cursor-based sur des flux qui grandissent.

Le refactor doit livrer :

1. Une découpe en 6 sous-domaines autonomes (`tasks`, `events`, `affaires`, `imports`, `recurrence`, `ical`).
2. Une DB v2 normalisée (`task_sections_ref`, index composites cursor-based, potentiellement vue matérialisée `v_planning_affaires_status`).
3. Une API v2 versionnée (`/api/v2/planning/*`) rétro-compatible avec la v1 pendant la transition.
4. Une UI v2 séparée en sous-panneaux (Tasks, Events, AffairesStatus, BlBpImports, Recurrence) chargée sous feature flag `flags.v2Planning`.
5. Une migration data + un plan de sunset v1 explicite.

---

## 2. Non-objectifs

- Le refactor n'introduit pas de WebSocket. Ce point est traité par le ticket T-P1-02.
- Le refactor ne modifie pas les schémas Affaires (T-P0-07 / T-P0-08 / T-P0-09).
- Le refactor ne modifie pas les schémas Équipements (T-P1-06+).
- Le refactor ne touche pas au TV-client v1 gelé (voir T-P0-16).

---

## 3. Découpage cible

### 3.1 Sous-domaines

| Sous-domaine | Responsabilités |
|--------------|-----------------|
| `tasks` | CRUD tâches opérationnelles, batch, clear-completed, rollover. |
| `events` | CRUD `dynamic_display_events`, alignement statut / catégorie. |
| `affaires` | Consolidation compteurs, cycle statut, toggle visibilité. |
| `imports` | Import BL (PDF/image), batch, matching BP → inventaire. |
| `recurrence` | Templates récurrents, génération d'instances. |
| `ical` | Abonnements iCal externes, export ICS. |

### 3.2 Frontière runtime

Les 6 sous-domaines sont exposés comme modules ESM sous `apps/api/services/planning/`. Aucun d'entre eux ne monte de route Express. Le câblage HTTP sera pris en charge par `apps/api/v2/planningRoutes.js` (T-P0-03 / T-P0-04).

### 3.3 Frontière données

- Aucun accès direct à `db.prepare(...)` depuis les composants React.
- Les services v2 prennent une `db` en paramètre (injection). Cela facilite les tests avec des bases SQLite in-memory.
- Les fonctions sont pures autant que possible : entrée → sortie, pas d'effets globaux.

---

## 4. Schéma DB v2 (aperçu — détaillé dans T-P0-02)

- `task_sections_ref (code TEXT PRIMARY KEY, label TEXT NOT NULL, sort_order INTEGER NOT NULL)` seedée avec les 15 sections métier + `manual`.
- Nouveaux index composites orientés cursor-based sur `task_assignments` :
  - `(date, id)` pour listing par date paginé.
  - `(person_id, date, id)` pour vue par personne.
  - `(section, date, id)` pour vue par section.
- Potentielle vue `v_planning_affaires_status` synthétisant les compteurs.
- Aucune colonne existante n'est renommée ni supprimée à cette étape.

---

## 5. Contrats API v2

- Payload uniforme `{ success, data, meta, error }` (T-P1-01).
- Pagination : `meta.pagination = { cursor, next_cursor, limit, has_more }`.
- Cursor opaque encodé base64 sur `(date, id)`.
- Filtres : grammaire `?filter[field]=op:value` avec whitelist par ressource.
- Tri : `?sort=field:asc|desc` avec whitelist par ressource.

---

## 6. Flag serveur

- `FEATURE_V2_PLANNING` (env). Valeurs : `"1"` active, absente ou `"0"` désactive.
- Défaut prod : désactivé.
- Défaut dev : activable par `.env.development`.
- Un middleware garde-fou refuse les routes v2 planning si le flag est absent.

---

## 7. Flag client

- `flags.v2Planning` (préférence utilisateur ou build-time).
- Sous flag ON, `App.jsx` charge `TaskPlanningPanelV2` à la place de la v1.
- Sous flag OFF, comportement inchangé.

---

## 8. Tests

- `tests/planning-cadre.test.js` (T-P0-01) : vérifie l'existence des namespaces et des constantes de vérité, et vérifie que les fonctions squelette lèvent bien `PlanningV2NotImplementedError`.
- `tests/db/planning-v2-schema.test.js` (T-P0-02) : vérifie la présence de `task_sections_ref`, du seed 16 lignes et des index composites.
- `tests/api-smoke/v2/planning.read.test.js` (T-P0-03) : vérifie la parité de lecture v1 ↔ v2 sur un jeu de données minimal.
- `tests/api-smoke/v2/planning.write.test.js` (T-P0-04) : vérifie les transitions d'état et la double-écriture temporaire.

---

## 9. Plan de bascule

1. T-P0-01 (ce ticket) : cadrage + squelette + docs (0 régression v1, 0 endpoint monté).
2. T-P0-02 : DB v2 (migrations idempotentes, tests DB).
3. T-P0-03 : routes v2 lecture + `FEATURE_V2_PLANNING`.
4. T-P0-04 : routes v2 mutations + double-écriture.
5. T-P0-05 : UI `TaskPlanningPanelV2` sous flag client.
6. T-P0-06 : bascule progressive prod + sunset v1 après `P0-DECISION-2`.

---

## 10. Critères d'acceptation globaux Planning v2

- Aucune régression v1 pendant toute la période de coexistence.
- Latence GET planning divisée en pratique (mesure Phase 1 vs Phase 2).
- Taille du fichier de routes principal Planning divisée d'au moins moitié après T-P0-06.
- Zéro reconstruction de `task_assignments` au boot après sunset.
- Documentation `docs/api/v2/planning.md` à jour.
- Changelogs `docs/06-Changelog/CHANGELOG_API.md`, `CHANGELOG_DB.md`, `CHANGELOG_UI.md` alimentés.

---

## 11. Livrables T-P0-01

- `apps/api/services/planning/index.js`
- `apps/api/services/planning/tasks.js`
- `apps/api/services/planning/events.js`
- `apps/api/services/planning/affaires.js`
- `apps/api/services/planning/imports.js`
- `apps/api/services/planning/recurrence.js`
- `apps/api/services/planning/ical.js`
- `docs/api/v2/README.md`
- `docs/api/v2/planning.md`
- `docs/05-Specs/PLANNING_V2.md` (ce document)
- `tests/planning-cadre.test.js`
- Mise à jour `docs/docs-index.json` (totalFiles + section api).
- Mise à jour `package.json` racine (script `test` étendu).
