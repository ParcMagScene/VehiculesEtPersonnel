# Synchronisation Inventaire → Catalogue

## Présentation

Le script `scripts/sync_inventory_to_catalog.js` permet d'importer un fichier CSV ou XLSX dans la table `equipment_catalog` de la base eM@g.

Il est conçu pour être exécuté manuellement en ligne de commande, de manière répétée (idempotent) : les équipements existants sont mis à jour, les nouveaux sont créés.

## Utilisation

```bash
# Import CSV
node scripts/sync_inventory_to_catalog.js chemin/vers/inventaire.csv

# Import XLSX (nécessite le package xlsx)
node scripts/sync_inventory_to_catalog.js chemin/vers/inventaire.xlsx
```

## Format attendu

### Colonnes reconnues (FR ou EN)

| Colonne CSV/XLSX | Champ DB | Obligatoire |
|---|---|---|
| `reference` / `ref` / `référence` / `code` | `reference` | Non |
| `name` / `nom` / `designation` / `désignation` / `libelle` / `libellé` | `name` | **Oui** |
| `family` / `famille` / `type` | `family` | Non |
| `subfamily` / `sous_famille` / `sous-famille` | `subfamily` | Non |
| `category` / `categorie` / `catégorie` | `category` | Non |
| `weight` / `poids` / `masse` | `weight` | Non |
| `length` / `longueur` / `l` | `dimensions.length` | Non |
| `width` / `largeur` / `w` | `dimensions.width` | Non |
| `height` / `hauteur` / `h` | `dimensions.height` | Non |

> La détection des colonnes est insensible à la casse et aux accents.

### Exemple minimal CSV

```csv
reference,nom,famille,catégorie,poids,longueur,largeur,hauteur
MIC-SM58,Shure SM58,Backline,Micro dynamique,0.33,162,51,51
CAB-XLR10,Câble XLR 10m,Câblage,XLR,0.8,,,
```

## Logique de synchronisation

1. **Détection des colonnes** — Le script détecte automatiquement le mapping entre les en-têtes du fichier et les champs DB
2. **Upsert par référence** — Si une ligne a une `reference` déjà existante dans `equipment_catalog`, elle est mise à jour. Sinon, elle est insérée.
3. **Sans référence** — Les lignes sans référence sont toujours insérées (pas de dé-duplication possible)
4. **Dimensions** — Si au moins une dimension (L, W, H) est présente, le champ `dimensions` est rempli en JSON
5. **Flight-case auto** — Si la catégorie correspond à un pattern connu, le script tente de lier automatiquement un flight-case existant

## Association automatique de flight-cases

Le script cherche un flight-case existant dans la table `flightcases` dont le nom contient la catégorie de l'équipement. Les règles sont :

| Catégorie contient… | Cherche FC contenant… |
|---|---|
| `micro` | `micro` |
| `console` | `console` |
| `enceinte` | `enceinte` ou `speaker` |
| `ampli` | `ampli` |
| `clavier` | `clavier` ou `keyboard` |

## Transaction & robustesse

- L'import complet est exécuté dans une **transaction SQLite**
- En cas d'erreur, toute la transaction est annulée (rollback)
- Les lignes sans `name` sont ignorées silencieusement

## Statistiques

À la fin de l'exécution, le script affiche :

```
📊 Résultats :
  Total lignes : 150
  Créés : 120
  Mis à jour : 28
  Ignorés (sans nom) : 2
```

## Pré-requis

- Node.js ≥ 18
- Package `xlsx` installé si fichier .xlsx (optionnel sinon)
- Base de données eM@g initialisée (tables `equipment_catalog` et `flightcases` existantes)
