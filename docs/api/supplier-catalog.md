# 🏷️ API Catalogue Fournisseurs

> **Version** : 1.0.0  
> **Source** : `supplierCatalogRoutes.js`  
> **Dernière MÀJ** : 7 avril 2026

---

## Articles fournisseurs

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/supplier-articles` | ✅ | Filtres: supplier_id, brand, family, subfamily, category, import_id |
| GET | `/api/supplier-articles/filters` | ✅ | Valeurs distinctes pour dropdowns filtres |
| GET | `/api/supplier-articles/stats` | ✅ | Stats import (total articles, par fournisseur) |
| GET | `/api/supplier-articles/taxonomy` | ✅ | Taxonomie famille/catégorie (vue unifiée) |
| POST | `/api/supplier-articles/refresh-brands` | ✅🔑 | Re-normalise noms de marques + liens table brands |
| POST | `/api/supplier-articles/import` | ✅🔑 | Import en masse depuis CSV/PDF (via catalog_imports) |
| DELETE | `/api/supplier-articles/:id` | ✅🔑 | Supprime article |
| DELETE | `/api/catalog-imports/:id` | ✅🔑 | Supprime batch import complet |

---

## Marques

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/brands` | ✅ | Liste marques (nom canonique + slug) |
| POST | `/api/brands/resolve` | ✅ | Normalise texte → marque (fuzzy matching) |
| GET | `/api/brands/:id` | ✅ | Détail marque + articles + alias |
| POST | `/api/brands/:id/aliases` | ✅🔑 | Ajoute alias (ex: "JBL" → "JBL Professional") |

---

## Processus d'import

1. Upload CSV/PDF → crée entrée `catalog_imports`
2. Parsing → extraction articles avec metadata (désignation, ref, prix, marque, famille)
3. Normalisation marques → liaison table `brands` (fuzzy matching)
4. Catégorisation → taxonomie famille/sous-famille/catégorie
5. Articles disponibles pour consultation et liaison commandes
