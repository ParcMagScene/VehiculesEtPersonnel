# Fournisseurs & Catalogue — Prompt Maître
Version: 1.0.0
Statut: stable
Dernière mise à jour: 2026-03-30
Auteur: Alexandre + Copilot
Description: Gestion du système fournisseurs, import de catalogues, enrichissement automatique des articles et mapping ALGAM.

---

## Contexte

Le module fournisseurs/catalogue gère l'import et la normalisation des articles provenant de différents fournisseurs (ALGAM, EVI Audio, etc.) avec enrichissement automatique via la taxonomie unifiée.

---

## Tables de base de données

```sql
-- Registre des fournisseurs
suppliers(id, name, slug, contact_email, phone, address, notes, is_active)

-- Articles du catalogue fournisseur
supplier_articles(id, supplier_id, reference, designation, brand, family, subfamily, category, price, currency, brand_id, unified_family)

-- Métadonnées d'import
catalog_imports(id, supplier_id, filename, import_date, article_count, status)

-- Référence croisée équipement
equipment_catalog(id, equipment_id, supplier_article_id, location_id)
```

---

## Mapping ALGAM

ALGAM utilise des codes internes mappés vers les marques canoniques :

| Code ALGAM | Marque canonique |
|------------|-----------------|
| SAH | Allen & Heath |
| SMA | Mackie |
| SSD | Shure |
| SCA | Crown |
| LAC | L-Acoustics |
| ... | (30+ mappings) |

---

## Routes API

| Endpoint | Méthode | Fonction |
|----------|---------|----------|
| `/api/supplier-articles` | GET | Liste + filtres + pagination |
| `/api/supplier-articles/filters` | GET | Valeurs distinctes (dropdowns) |
| `/api/supplier-articles/stats` | GET | Stats par fournisseur/marque |
| `/api/supplier-articles/refresh-brands` | POST | Auto-détection marques + mapping ALGAM |

---

## Flux d'enrichissement (enrichArticle)

```
Import CSV/PDF → articles bruts
      ↓
Mapping code ALGAM → marque canonique
      ↓
resolveBrand() → brand_id
      ↓
resolveUnifiedFamily() → unified_family (via regex taxonomy_family_mapping)
      ↓
Stockage avec données enrichies
```

---

## Règles impératives

1. Les imports ne suppriment jamais d'articles existants
2. `refresh-brands` est idempotent — peut être relancé sans risque
3. Les prix sont stockés en EUR par défaut
4. Un article sans `brand_id` résolu est marqué pour revue manuelle
5. Les parsers d'import sont dans `apps/web/src/utils/parsers/catalogParsers.js`

---

## Fichiers de référence

| Fichier | Rôle |
|---------|------|
| `apps/api/supplierCatalogRoutes.js` | Routes API catalogue |
| `apps/api/brandHelpers.js` | Enrichissement et résolution de marques |
| `apps/web/src/components/orders/SupplierCatalogPanel.jsx` | Interface catalogue |
| `apps/web/src/utils/parsers/catalogParsers.js` | Parsers d'import CSV/PDF |

---

## Workflow d'import

1. Upload du fichier (CSV ou PDF) via l'interface
2. Parsing par le parser adapté au format fournisseur
3. Enrichissement automatique (`enrichArticle`)
4. Revue des articles non résolus
5. Validation et stockage final
6. `refresh-brands` si nécessaire
