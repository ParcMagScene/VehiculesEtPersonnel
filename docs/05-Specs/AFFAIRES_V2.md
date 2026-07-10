# SPEC — Affaires v2 (design doc)

> **Version** : 0.2.0 (T-P0-08 livré — matérialisation + FK ref + audit trail)
> **Statut** : `T-P0-08 livré, T-P0-09 (sunset TEXT + FK stricte) en attente`
> **Historique décisions** :
>
> - **P0-DECISION-2** validée 2026-07-10 (Affaires uniquement, autres domaines refusés).

---

## 1. Objectif

Sortir eM@g de la logique "affaires implicites" (affaires référencées par
`numero_affaire` dans les autres tables mais sans ligne correspondante dans
`affaires`).

Cible :
1. Matérialiser toutes les affaires implicites dans la table `affaires`
   (INSERT OR IGNORE, une ligne par `numero_affaire` distinct).
2. Ajouter les FK strictes `reservations.affaire_id`, `missions.affaire_id`,
   `orders.affaire_id`, `bl_imports.affaire_id`, `dynamic_display_events.affaire_id`,
   `equipment_assignments.affaire_id` (colonnes INTEGER pointant `affaires.id`),
   en cohabitation avec les colonnes TEXT legacy pendant la transition.
3. À terme (T-P0-09), retirer l'enrichissement automatique côté API v1 et
   déprécier les colonnes TEXT legacy.

---

## 2. Sources d'affaires implicites recensées (T-P0-07)

Le script `scripts/affaires-v2-backfill.mjs` (dry-run) parcourt les
sources suivantes :

| Table | Colonne | Type de référence |
|-------|---------|-------------------|
| `reservations` | `affaire` | TEXT |
| `missions` | `affaire` | TEXT |
| `orders` | `affaire_id` | TEXT |
| `bl_imports` | `affaire_id` | TEXT |
| `dynamic_display_events` | `affaire_id` | TEXT |
| `equipment_assignments` | `affaire_id` | TEXT |

Rapport produit : nombre d'affaires implicites distinctes, par source,
avec payload de matérialisation suggéré (client, dates min/max déduites
de `reservations`).

---

## 3. Tickets & phases

### T-P0-07 (ce ticket) — Backfill dry-run

- Script `scripts/affaires-v2-backfill.mjs` **read-only**.
- Aucune écriture DB.
- Rapport JSON exploitable pour préparer T-P0-08.
- Exit code 1 si affaires implicites détectées (décision requise).

### T-P0-08 (livré 2026-07-10) — Matérialisation + FK ref + audit trail

- Migration effective : `apps/api/migrations/affaires-v2-schema-v1.js`
  (nommée `schema` plutôt que `materialize` pour englober les 3
  chantiers du ticket : matérialisation, colonnes `affaire_ref_id`,
  table `affaire_history`).
- **Matérialisation** : `INSERT OR IGNORE` dans `affaires`. Payload
  déduit de `reservations` (client + date_debut/fin + prestation).
  12 affaires implicites recensées par le dry-run T-P0-07 (source
  prod).
- **Coexistence stricte** : les colonnes TEXT existantes restent
  intactes. La nouvelle colonne est nommée `affaire_ref_id` (et non
  `*_affaire_id` comme prévu initialement) pour éviter toute
  collision avec les colonnes `affaire_id` TEXT préexistantes
  (`orders`, `bl_imports`, `dynamic_display_events`,
  `equipment_assignments`, `quotes`).
- **Portée** : 6 tables — `reservations` (col TEXT `affaire`),
  `missions` (col TEXT `affaire`), `orders`, `bl_imports`,
  `dynamic_display_events`, `equipment_assignments`. La table
  `quotes` (col TEXT `affaire_id`) n'est pas incluse (hors périmètre
  T-P0-08, à traiter en T-P0-09 si besoin).
- **FK stricte différée** : SQLite ne permet pas d'ajouter une
  contrainte `FOREIGN KEY` sur une colonne existante via
  `ALTER TABLE`. La FK réelle sera introduite par recréation de
  chaque table lors du sunset TEXT (T-P0-09), après validation
  supplémentaire zéro-consommateur v1.
- **Table `affaire_history`** : audit trail créé. Aucun trigger posé
  dans ce ticket (l'écriture historique sera pilotée par le
  namespace v2 en T-P0-09).
- **Prérequis satisfaits** : `P0-DECISION-2` validée 2026-07-10 (cf
  `EXECUTION_PLAN_EMAG_3_0.md §0.5`). Backup DB prod obligatoire
  avant déploiement en prod (responsabilité du déploiement, hors
  scope de ce ticket).

### T-P0-09 (à venir) — Sunset TEXT + FK strict + API v2

- Retrait de l'enrichissement automatique côté API v1.
- DROP des colonnes TEXT legacy après vérification zero-usage.
- Ajout `FOREIGN KEY (*_affaire_id) REFERENCES affaires(id)`.
- **Prérequis** : ≥ 1 semaine sans consommateur v1 de l'enrichissement.

---

## 4. Payload de matérialisation suggéré (T-P0-08)

Pour chaque `numero_affaire` implicite :

```
{
  "numero_affaire": "AF-2026-042",
  "type": "Prestation",                // défaut sûr
  "client":       "<premier client_name non nul depuis reservations>",
  "date_debut":   "<MIN(start_date)>",
  "date_fin":     "<MAX(end_date)>",
  "nom":          "<premier prestation_name non nul>",
  "status":       null,                // NULL par défaut
  "created_by":   null,                // système
  "created_at":   "datetime('now')"
}
```

---

## 5. Rollback

### Rollback T-P0-08 (matérialisation)

En cas de bug post-matérialisation :

1. **DELETE** les lignes créées par le script (`created_by IS NULL AND
   numero_affaire IN (<liste-du-rapport>)`).
2. Retour à l'état pré-matérialisation.

### Rollback T-P0-09 (FK)

Le retrait des FK est un DROP CONSTRAINT SQLite — nécessite
recréation de la table. Le rollback complet exige de rejouer un
snapshot DB pré-migration.

---

## 6. Critères de succès

- **T-P0-07** : script produit un rapport lisible et déterministe.
- **T-P0-08** : après exécution, `SELECT COUNT(*) FROM reservations r
  LEFT JOIN affaires a ON a.numero_affaire = r.affaire WHERE r.affaire
  IS NOT NULL AND r.affaire <> '' AND a.id IS NULL` retourne 0.
- **T-P0-09** : aucun appel v1 utilisant l'enrichissement automatique
  détecté pendant 7 jours.

---

## 7. Livrables T-P0-07

- `scripts/affaires-v2-backfill.mjs` (dry-run, ce ticket)
- `docs/05-Specs/AFFAIRES_V2.md` (ce document)
- Mise à jour `docs/06-Changelog/CHANGELOG_DOCS.md`

**Non-livrables (réservés T-P0-08 / T-P0-09)** :
- Migration d'écriture
- Modification du schéma `affaires`
- Modification des routes v1
- Suppression des colonnes TEXT legacy

---

## 8. Références

- [EMAG_3_0_ACTION_PLAN.md](../../EMAG_3_0_ACTION_PLAN.md) §3.1.2
- [EXECUTION_PLAN_EMAG_3_0.md](../../EXECUTION_PLAN_EMAG_3_0.md) T-P0-07/08/09
- [docs/05-Specs/PLANNING_V2.md](PLANNING_V2.md) (design équivalent Planning v2)
