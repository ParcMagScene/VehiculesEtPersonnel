# Design — Unification persons / drivers

> **Version** : 0.3.0 (audit T-P1-03 livré 2026-07-10)
> **Statut** : Table `drivers` **vide en production** (0 lignes,
> 0 driver orphelin, 0 person avec `driver_id` renseigné). Endpoint
> `/api/drivers` déprécié depuis Phase 6 (retourne `[]` + headers
> `Deprecation`). Sunset destructif (DROP TABLE + DROP COLUMN
> `persons.driver_id`) prêt techniquement, en attente de décision
> utilisateur explicite (analogue P0-DECISION-2).

## 0. Historique du ticket

| Date | Étape | Détail |
|------|-------|--------|
| — | **Phase 6+** | CRUD `/api/drivers` retiré, table conservée en compat. |
| 2026-07-10 | **T-P1-03** | Script d'audit dry-run `scripts/personnel-v2-drivers-audit.mjs` + tests + doc de statut. Constat : sunset safe (0 orphan). |
| _à venir_ | **T-P1-03b** | Sunset destructif : DROP TABLE `drivers` + DROP COLUMN `persons.driver_id` + suppression `driversRoutes.js` + suppression store IndexedDB. Nécessite décision utilisateur (analogue P0-DECISION-2). |

## 1. Constat

La table `drivers` est une entité legacy créée avant `persons`. Elle ne contient que 4 champs métier (`name`, `license_number`, `phone`, `created_by`) alors que `persons` gère tout le cycle de vie RH (identité, compétences, congés, disponibilités, contrats, photo…).

**Redondances identifiées** :
| Champ | `drivers` | `persons` |
|---|---|---|
| Nom | `name` (champ unique) | `first_name` + `last_name` |
| Téléphone | `phone` | `phone` |
| Permis | `license_number` (texte) | `license_types` (JSON array) |

**Lien existant** : `persons.driver_id → drivers.id` (FK ON DELETE SET NULL) — **jamais utilisé en JOIN dans le code**.

## 2. Impact multi-modules

### Backend (API)

| Fichier | Usage `drivers` | Action |
|---|---|---|
| `routes.js` (L81+) | CRUD `/api/drivers` (GET/POST/PUT/DELETE) | Supprimer les 4 endpoints |
| `adminRoutes.js` (L703) | `UPDATE drivers SET created_by/modified_by` (migration refs) | Supprimer les 2 lignes |
| `database.js` | CREATE TABLE drivers (L198) + index + migrations | Supprimer la table + migrations |
| `personnelRoutes.js` | INSERT/UPDATE `persons.driver_id` | Supprimer le champ |

### Frontend

| Fichier | Usage | Action |
|---|---|---|
| `useAppData.js` | `api.getDrivers()` + state `drivers` | Supprimer l'appel et le state |
| `ManagementPanel.jsx` | Onglet "Conducteurs" (CRUD drivers) | Supprimer l'onglet |
| `DriverSelect.jsx` | Utilise déjà `persons` (qualifiedDrivers) | Aucun changement |
| `ReservationModal.jsx` | Utilise déjà `persons` | Aucun changement |
| API client (`base.js`) | `getDrivers()` | Supprimer la méthode |

### Réservations

Les réservations stockent `driver_name` en **texte libre** (pas de FK). Aucun impact immédiat. Évolution future possible : ajouter `driver_person_id → persons.id`.

### IndexedDB / Offline

Le store `drivers` dans le service worker doit être supprimé.

## 3. Script de migration

```sql
-- 1. Vérifier les drivers orphelins (sans person liée)
SELECT d.id, d.name, d.phone, d.license_number
FROM drivers d
LEFT JOIN persons p ON p.driver_id = d.id
WHERE p.id IS NULL;

-- 2. Pour chaque driver orphelin, créer une person
-- (à exécuter via script Node.js pour gérer le split name → first_name/last_name)

-- 3. Supprimer la colonne driver_id de persons
-- SQLite ne supporte pas ALTER TABLE DROP COLUMN (< 3.35.0)
-- → Recréer la table persons sans driver_id

-- 4. Supprimer la table drivers
DROP TABLE IF EXISTS drivers;

-- 5. Supprimer les index liés
DROP INDEX IF EXISTS idx_persons_driver_id;
```

### Script Node.js (pseudo-code)

```javascript
// migrate-drivers-to-persons.mjs
import db from './database.js';

const orphanDrivers = db.prepare(`
  SELECT d.* FROM drivers d
  LEFT JOIN persons p ON p.driver_id = d.id
  WHERE p.id IS NULL
`).all();

for (const driver of orphanDrivers) {
  const parts = driver.name.trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || driver.name;
  
  db.prepare(`
    INSERT INTO persons (first_name, last_name, phone, license_types, type, status)
    VALUES (?, ?, ?, ?, 'permanent', 'active')
  `).run(firstName, lastName, driver.phone, 
         JSON.stringify(driver.license_number ? [driver.license_number] : []));
}

// Nettoyer persons.driver_id (mettre à NULL)
db.prepare('UPDATE persons SET driver_id = NULL').run();
```

## 4. Ordre d'exécution recommandé

1. **Créer le script de migration** `scripts/migrate-drivers.mjs`
2. **Backup** de la base de données
3. **Exécuter le script** de migration (créer les persons manquantes)
4. **Backend** : supprimer CRUD drivers dans `routes.js`, supprimer refs dans `adminRoutes.js`
5. **Frontend** : supprimer onglet Conducteurs, `getDrivers()`, state drivers
6. **Database** : supprimer table `drivers`, colonne `persons.driver_id`
7. **IndexedDB** : supprimer store `drivers` du service worker
8. **Tests** : vérifier que tous les tests passent

## 5. Risques

| Risque | Probabilité | Mitigation |
|---|---|---|
| Drivers orphelins sans person | Moyenne | Script de migration les crée automatiquement |
| Split name incorrect | Faible | Revue manuelle après migration |
| Réservations `driver_name` cassées | Nulle | Texte libre, pas impacté |
| Régression onglet Conducteurs | Faible | L'onglet est supprimé, pas modifié |

## 6. Estimation

| Étape | Effort |
|---|---|
| Script de migration | 1h |
| Backend (routes + DB) | 2h |
| Frontend (UI + state) | 2h |
| Tests + validation | 1h |
| **Total** | **6h** |
