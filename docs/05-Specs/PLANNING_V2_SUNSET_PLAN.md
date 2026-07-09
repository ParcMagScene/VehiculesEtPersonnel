# SPEC — Planning v2 Sunset & Cutover

> **Version** : 0.2.0 (Phase B activée)
> **Statut** : `Phase B — dogfooding dev en cours (depuis 2026-07-09)`
> **Prérequis stricts** :
>
> - **P0-DECISION-1** : validation utilisateur explicite pour activer `FEATURE_V2_PLANNING=1` en production.
> - **P0-DECISION-2** : validation utilisateur explicite pour retirer les endpoints v1 et la logique Planning v2 côté serveur.
>
> **Ce document ne déclenche AUCUNE bascule automatique.**

---

## 1. Objectif

Encadrer la bascule progressive de `planningRoutes.js` v1 (routeur monolithique, ~2600 lignes) vers `apps/api/v2/planningRoutes.js` v2 (namespace `/api/v2/planning/*`, cursor-based, Zod, transitions statuts validées).

Tous les tickets T-P0-01 à T-P0-05b sont livrés en coexistence stricte. Aucun ne modifie v1. Ce document définit le protocole pour passer de "cohabitation" à "v2 seule".

---

## 2. État actuel (au 2026-07-09, mise à jour Phase B)

- **Backend v2** : GET (cursor-based), GET /:id, POST, PUT, DELETE sur `/api/v2/planning/tasks` — gardés par `FEATURE_V2_PLANNING`.
- **Backend v1** : `planningRoutes.js` inchangé. Toutes les routes `/api/planning/*` actives.
- **Frontend v2** : `TasksPanelV2` + `TaskFormDialog` disponibles, non montés dans `App.jsx`. Flag client `flags.v2Planning` détecté via `?v=2` ou `localStorage`.
- **DB v2** : `task_sections_ref` seedée (20), 3 index cursor-based sur `task_assignments`. `task_assignments` partagée v1/v2.
- **`FEATURE_V2_PLANNING` dev** : `=1` depuis 2026-07-09 (Phase B activée).
- **`FEATURE_V2_PLANNING` prod** : non défini (OFF), v1 exclusive. Phase C non déclenchée (`P0-DECISION-1` non encore validée pour la prod).
- **Contraintes préservées** : aucune régression v1 sur toutes les branches (contrôlée à chaque commit). Parity-check ré-exécuté 2026-07-09 sur DB dev fusionnée : 19/19 OK, verdict `OK (parité attendue)`.

---

## 3. Phases de bascule (protocole)

### Phase A — Vérification préalable (parity check)

**Objectif** : s'assurer que v2 lecture renvoie les mêmes tâches que v1 pour les mêmes paramètres, sur un jeu de données représentatif.

- Script : [`scripts/planning-v2-parity-check.mjs`](../../scripts/planning-v2-parity-check.mjs).
- Mode : dry-run par défaut, aucune écriture.
- Sortie : rapport JSON par filtre testé (`date`, `person_id`, `section`), et delta v1 ↔ v2 (items ajoutés, retirés, altérés).
- Exit codes :
  - `0` : parité parfaite.
  - `1` : divergences détectées.
  - `2` : environnement invalide.

**Critère de sortie Phase A** :
- Toutes les combinaisons testées renvoient un delta `==` 0.
- Zéro warning dans le rapport de contrôle.

### Phase B — Bascule client progressive (dogfooding)

**Objectif** : basculer les usages internes sur v2 sans imposer la bascule à l'ensemble des utilisateurs.

1. **Activation serveur ciblée** : `FEATURE_V2_PLANNING=1` sur l'environnement de test/dev interne uniquement (voir `apps/api/.env`).
2. **Feature flag client** : les utilisateurs internes activent `flags.v2Planning` manuellement (`?v=2` ou console `emag_flag_v2Planning=1`).
3. **Durée conseillée** : ≥ 1 sprint (2 semaines).
4. **Observations à collecter** :
   - Erreurs client (bannière `submitError` de `TaskFormDialog`).
   - Erreurs backend logguées.
   - Retour utilisateur qualitatif.

**Critère de sortie Phase B** :
- Zéro erreur 500 sur `/api/v2/planning/*`.
- Zéro régression fonctionnelle détectée.
- Validation qualitative utilisateur explicite (`P0-DECISION-1`).

### Phase C — Activation généralisée v2 (production)

**Objectif** : v2 devient le chemin par défaut pour tous les utilisateurs.

1. **`P0-DECISION-1` explicite requise**.
2. **`FEATURE_V2_PLANNING=1`** sur l'environnement de production.
3. **Bascule client automatique** : `App.jsx` monte `TasksPanelV2` à la place de `TaskPlanningPanel` v1 (à venir dans un ticket dédié T-P0-06-cutover).
4. **Flag client `flags.v2Planning`** conservé pour permettre le rollback UI utilisateur en cas de gêne.
5. **Rollback plan** : voir §6.

**Critère de sortie Phase C** :
- ≥ 1 semaine sans incident significatif.
- Aucun ticket support lié à Planning v2 en attente.

### Phase D — Sunset v1 (destructif)

**Objectif** : retrait effectif de `planningRoutes.js` et de la logique v1 côté frontend.

1. **`P0-DECISION-2` explicite requise**.
2. Retrait du montage `setupPlanningRoutes(...)` dans `apps/api/server.js`.
3. Suppression physique de `apps/api/planningRoutes.js` (préservée dans l'historique git).
4. Retrait des composants v1 côté frontend (`TaskPlanningPanel`, imports associés).
5. Retrait de la double-écriture éventuelle (T-P0-04 n'en a pas introduite, la coexistence se fait par table partagée).
6. Mise à jour changelogs (`CHANGELOG_API.md`, `CHANGELOG_UI.md`, `CHANGELOG_DB.md`).

**Critère de sortie Phase D** :
- CI verte (lint, format, tests, build).
- Zéro appel v1 dans les logs sur ≥ 7 jours.
- Documentation à jour.

---

## 4. Checklist pré-cutover (Phase C)

À remplir manuellement avant activation prod :

- [ ] Phase A parity-check exécuté récemment (< 7 jours), delta `==` 0.
- [ ] Phase B exécutée sur env interne ≥ 2 semaines.
- [ ] Zéro erreur 500 sur `/api/v2/planning/*` dans les logs.
- [ ] Zéro divergence v1 ↔ v2 signalée par les utilisateurs internes.
- [ ] Backup DB production réalisé (`apps/api/backup-database.sh`).
- [ ] Rollback plan lu et compris (voir §6).
- [ ] `P0-DECISION-1` **explicitement** validée par l'équipe.
- [ ] Fenêtre de bascule communiquée aux utilisateurs (créneau creux, hors événement critique).

---

## 5. Checklist pré-sunset (Phase D)

À remplir manuellement avant retrait v1 :

- [ ] Phase C stable depuis ≥ 1 semaine.
- [ ] Zéro appel `/api/planning/*` v1 dans les logs sur ≥ 7 jours (à vérifier via observabilité).
- [ ] Aucun consommateur externe recensé de `/api/planning/*` v1.
- [ ] Tests d'intégration frontend adaptés (retrait des mocks v1).
- [ ] Backup DB production réalisé.
- [ ] Backup export `planningRoutes.js` conservé en tag git (`planning-v1-final`).
- [ ] `P0-DECISION-2` **explicitement** validée par l'équipe.

---

## 6. Rollback plan

### Rollback Phase C → B (bascule prod → dogfooding)

En cas de régression détectée pendant Phase C :

1. **Désactivation immédiate côté serveur** :
   ```
   FEATURE_V2_PLANNING=0  # dans .env production
   pm2 restart vehicules-backend --update-env
   ```
   Effet : `/api/v2/planning/*` renvoie 404 `FEATURE_DISABLED`. Le frontend v2 dégrade gracieusement via la bannière info (`TasksPanelV2` détecte le 404 via `usePlanningTasksV2.featureDisabled`).

2. **Rollback frontend optionnel** : purger `localStorage.emag_flag_v2Planning` côté clients (via une mise à jour build ou script utilisateur).

3. **Aucune donnée à restaurer** : la table `task_assignments` est partagée v1/v2, les données créées via v2 restent lisibles par v1.

### Rollback Phase D → C (sunset → bascule prod)

En cas de bug post-sunset :

1. **Revert git** du commit de sunset :
   ```
   git revert <sha-sunset>
   git push origin main
   npm run deploy
   ```
2. **Vérification** : `/api/planning/*` doit répondre à nouveau. `TaskPlanningPanel` v1 doit se remonter côté frontend.

---

## 7. Compatibilité inter-composants

Après Phase D (sunset v1), les composants suivants restent inchangés :

- **Table `task_assignments`** : conservée telle quelle (aucun renommage).
- **Table `task_sections_ref`** : conservée.
- **Table `dynamic_display_events`** : non touchée par ce ticket.
- **iCal endpoints** : à traiter dans un ticket dédié (dépendance directe consommateurs externes).
- **Client TV** : indépendant, aucun impact.
- **Sonos** : indépendant, aucun impact.

---

## 8. Livrables T-P0-06 (préparation, ce ticket)

- `docs/05-Specs/PLANNING_V2_SUNSET_PLAN.md` (ce document)
- `scripts/planning-v2-parity-check.mjs` (dry-run, non destructif)
- Mise à jour `docs/06-Changelog/CHANGELOG_DOCS.md`

**Non-livrables (réservés à T-P0-06-cutover et T-P0-06-sunset)** :
- Modification `apps/api/server.js` ou `apps/api/planningRoutes.js`
- Activation `FEATURE_V2_PLANNING` en production
- Modification `apps/web/src/App.jsx` ou intégration ModuleHost
- Suppression `apps/api/planningRoutes.js`

---

## 9. Références

- [EMAG_3_0_ACTION_PLAN.md](../../EMAG_3_0_ACTION_PLAN.md) §3.1.1
- [EXECUTION_PLAN_EMAG_3_0.md](../../EXECUTION_PLAN_EMAG_3_0.md) T-P0-06 + points d'arrêt
- [docs/api/v2/planning.md](../api/v2/planning.md)
- [docs/05-Specs/PLANNING_V2.md](PLANNING_V2.md)
- [docs/04-Operations/ROLLBACK_PLAN.md](../04-Operations/ROLLBACK_PLAN.md) (procédures génériques)
