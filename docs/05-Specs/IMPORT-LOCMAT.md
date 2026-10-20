# Module — Import intelligent Locmat

> Version : 2.8.0 — Date : 2026-05-04
> Statut : ✅ Implémenté
> Migration DB : `apps/api/migrations/locmat-import-v1.js`

## 1. Objectif

Synchroniser de façon **différentielle** le stock eM@g à partir des deux exports
Locmat (`.csv` ou `.txt`, séparés par point-virgule, virgule ou tabulation) :

| Fichier         | Contenu                                                |
|-----------------|--------------------------------------------------------|
| `Locations.csv` / `Locations.txt` | Une ligne par référence (code, désignation, qté, prix) |
| `Serialise.csv` / `Serialises.txt` | Une ligne par numéro de série (code + n° série)        |

Au moins **un** des deux fichiers est requis ; les deux sont compatibles et se
complètent (les références présentes uniquement dans `Serialise.csv` sont
créées comme produits **sérialisés** sans quantité initiale).

Les exports tabulés Locmat en `.txt` sont acceptés directement. Pour importer
ensuite les interventions SAV, importer d'abord l'export des numéros de série :
les nouveaux équipements pourront alors être liés aux tickets SAV par numéro
de série. Les numéros MAG séparés par ` - ` sont normalisés pour ce rapprochement.
L'import SAV accepte également les exports tabulés à retours chariot seuls,
la colonne `A` pour le statut et les dates à année sur deux chiffres.
À la confirmation d'un import SAV, les tickets actifs absents de l'export sont
clôturés par défaut, car l'export LocMat est traité comme la liste exhaustive
des interventions en cours. Cette option peut être décochée dans l'aperçu si
l'export est incomplet.

## 2. Garanties (cahier des charges §8)

- ❌ Aucune écriture avant validation explicite utilisateur (étape *preview*)
- ❌ Aucun n° de série supprimé physiquement → `status = 'removed'`, `removed_at` daté
- ❌ Aucun UID régénéré pour une référence existante
- ❌ Aucune régression sur les modules existants (extensions seulement)

## 3. Schéma de données

### `equipment` (étendu)

| Colonne         | Type    | Notes                                            |
|-----------------|---------|--------------------------------------------------|
| `uid`           | TEXT    | Existant ; rempli à la création via Locmat (`crypto.randomUUID()`, unique) |
| `qrcode`        | TEXT    | data-URL PNG généré via `qrcode` (encode l'UID)  |
| `is_serialized` | INT     | 0/1 — vrai si la référence porte des n° de série |

Index unique partiel : `idx_equipment_uid_unique (uid) WHERE uid IS NOT NULL`.

### `equipment_serials` (nouvelle)

```
id INTEGER PK
equipment_id INTEGER NOT NULL FK → equipment(id) ON DELETE CASCADE
serial         TEXT NOT NULL
status         TEXT DEFAULT 'active'   -- 'active' | 'removed'
source         TEXT DEFAULT 'locmat'
notes          TEXT
created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
removed_at     DATETIME
```

Index unique partiel : `(serial) WHERE status='active'`.

### `import_logs` (nouvelle, mutualisée)

```
id INTEGER PK
type        TEXT NOT NULL   -- 'locmat' | 'autres'
source      TEXT
summary     TEXT (JSON)
details     TEXT (JSON)
user_id     INTEGER
user_name   TEXT
created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
```

Index : `(type, created_at)`.

## 4. Flux fonctionnel

```
 ┌──────────────────────┐
 │ Sélection CSV (web)  │  ← parse PapaParse côté client
 └──────────┬───────────┘
            │ POST /api/import/locmat/preview   {locations[], serials[]}
            ▼
 ┌──────────────────────┐
 │ Diff serveur (read)  │  ← service `diffWithDatabase`
 └──────────┬───────────┘
            │ {newProducts, updatedProducts, quantityChanges,
            │  newSerials, removedSerials, errors}
            ▼
 ┌──────────────────────┐
 │ Validation utilisateur (modal, 6 onglets)
 │  + export rapport JSON
 └──────────┬───────────┘
            │ POST /api/import/locmat/confirm   (mêmes payloads)
            ▼
 ┌──────────────────────────────────────────┐
 │ Transaction SQLite (better-sqlite3)      │
 │  • INSERT equipment (uid + qrcode pré-    │
 │    générés HORS transaction)             │
 │  • UPDATE via COALESCE pour ne pas       │
 │    écraser les valeurs non fournies      │
 │  • Diff quantités → UPDATE stock_quantity │
 │  • INSERT/réactivation/soft-remove       │
 │    sur equipment_serials                 │
 │  • INSERT import_logs (summary+details)  │
 └──────────────────────────────────────────┘
```

## 5. Endpoints API

| Méthode | Route                                | Auth        | Description                               |
|---------|--------------------------------------|-------------|-------------------------------------------|
| POST    | `/api/import/locmat/preview`         | Admin       | Calcule le diff, ne touche pas la DB      |
| POST    | `/api/import/locmat/confirm`         | Admin       | Applique le diff sous transaction         |
| GET     | `/api/import/locmat/logs?limit=N`    | Admin       | Historique (max 200)                      |
| GET     | `/api/import/locmat/logs/:id`        | Admin       | Détail JSON complet                       |

Limites Zod : 50 000 lignes `Locations`, 100 000 lignes `Serialise` par appel.

## 6. Mapping des en-têtes (FR/EN)

Tolérance casse + accents + alias multiples (cf. `services/locmatImport.js`) :

| Champ logique | Alias acceptés                                           |
|---------------|----------------------------------------------------------|
| `code`        | Code Libre, Code Article, Code, Référence                |
| `name`        | Désignation, Designation, Nom, Libellé                   |
| `quantity`    | Quantité, Qté, Stock                                     |
| `price`       | Tarif, Prix unitaire, Prix                               |
| `value`       | Valeur                                                   |
| `barcode`     | Code-barres, EAN                                         |
| `location`    | Emplacement, Lieu                                        |
| `isMagScene`  | MagScène, Magscene (booléen oui/non/1/0/true/false)      |
| `isSerialized`| Sérialisé, Serialise, Serialisé (booléen)                |
| `serial`      | Numéro de Série, N° de série, Serial                     |

Clé de comparaison : `code.toUpperCase()`.

## 7. UID + QR Code

- Généré uniquement à la **création** d'une référence (jamais ré-écrit)
- UID = `crypto.randomUUID()`
- QR Code PNG (data-URL) via `qrcode@1.5.4`, payload = UID
- Pré-générés **hors transaction** pour ne pas bloquer SQLite (l'API `qrcode`
  est asynchrone)

## 8. Idempotence

- Migration garde-fous via `db.pragma('table_info()')` + try/catch
- Index uniques partiels (UID, serial actif) → ré-exécution safe
- Re-soumettre exactement le même CSV produit `0 createdProducts / 0
  serialsAdded / 0 serialsRemoved` (les diffs sont vides)

## 9. Rollback

- Transaction SQL complète : un échec en cours d'apply rollback **toutes** les
  écritures (equipment, equipment_serials, import_logs)
- Suppressions de série = soft → réversibles via UPDATE
  `SET status='active', removed_at=NULL WHERE id=?`

## 10. Tests

`tests/locmat-import.test.js` — 7 tests (`node --test`) :

```bash
node --test tests/locmat-import.test.js
```

Couverture :
- Normalisation en-têtes accentués / casse
- Détection `newProducts` / `updatedProducts` / `quantityChanges`
- Détection `newSerials` / `removedSerials`
- Création implicite de produit pour ref `Serialise.csv` orpheline
- Détection codes dupliqués comme erreurs

## 11. Fichiers livrés

```
apps/api/migrations/locmat-import-v1.js
apps/api/services/locmatImport.js
apps/api/locmatImportRoutes.js
apps/api/schemas/imports.js                    (étendu)
apps/api/migrations.js                         (wiring)
apps/api/server.js                             (route)
apps/web/src/utils/api/locmatImport.js
apps/web/src/utils/api/index.js                (wiring)
apps/web/src/components/orders/import/LocmatImportModal.jsx
apps/web/src/components/orders/StockPanel.jsx  (bouton + lazy import)
tests/locmat-import.test.js
```
