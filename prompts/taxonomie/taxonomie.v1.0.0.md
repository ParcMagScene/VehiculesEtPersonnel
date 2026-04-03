# Taxonomie Équipement — Prompt Maître
Version: 1.0.0
Statut: stable
Dernière mise à jour: 2026-03-30
Auteur: Alexandre + Copilot
Description: Gestion de la taxonomie unifiée des équipements techniques — familles, sous-familles, catégories, marques, alias et mappings.

---

## Contexte

Le système de taxonomie d'eM@g organise l'inventaire technique en une hiérarchie à 3 niveaux :
- **Famille** (ex : Sonorisation, Éclairage, Structure)
- **Sous-famille** (ex : Enceintes, Projecteurs, Ponts)
- **Catégorie** (ex : Sub, Moving Head, Moteur de levage)

Le projet maintient **13 familles primaires** : Sonorisation, Éclairage, Structure, Audiovisuel, Distribution Électrique, Backline, Rideau-Machinerie, Informatique, Accroche, Motorisation, Mobilier, Outillage & EPI, Divers.

---

## Tables de base de données

```sql
-- Marques canoniques
brands(id, name, slug, website, country, primary_domain, is_active)

-- Alias de marques (variations de noms)
brand_aliases(id, brand_id, alias, alias_slug, source)

-- Liaison marque ↔ famille
brand_family_mapping(id, brand_id, family_id, is_primary)

-- Arbre des catégories (3 niveaux)
equipment_categories(id, name, level, parent_id, icon, color)

-- Catégories de stock
stock_categories(id, name, parent_id, color, icon)

-- Règles de résolution de famille (regex)
taxonomy_family_mapping(id, pattern, family, priority)
```

---

## Fonctions clés (brandHelpers.js)

| Fonction | Rôle |
|----------|------|
| `resolveBrand(text)` | Recherche brand_id par nom ou alias (cache 60s) |
| `normalizeBrand(text)` | Retourne nom canonique + brand_id |
| `resolveUnifiedFamily(article)` | Applique `taxonomy_family_mapping` (regex → famille) |
| `enrichArticle(article)` | Auto-normalise marque + famille unifiée |
| `linkBrandIds(table)` | Liaison batch d'articles → brand_id |

---

## Règles impératives

1. **87 marques canoniques** réparties par domaine (son: 34, lumière: 18, structure: 14, vidéo: 12, backline: 5, câbles: 4)
2. **64 alias** pour les variations (L-Acoustics ← L-ACOUSTICS, l-acoustics, etc.)
3. Toute nouvelle marque doit :
   - Être ajoutée dans `brands` avec un `slug` unique
   - Avoir au moins un `brand_family_mapping`
   - Avoir ses alias courants dans `brand_aliases`
4. Les migrations sont dans `apps/api/migrations/taxonomy-brands-v1.js` (13 migrations séquentielles)
5. Ne jamais modifier les migrations existantes — toujours en ajouter de nouvelles
6. Le cache de `resolveBrand` expire après 60 secondes

---

## Fichiers de référence

| Fichier | Rôle |
|---------|------|
| `apps/api/brandHelpers.js` | Fonctions de résolution et normalisation |
| `apps/api/migrations/taxonomy-brands-v1.js` | 13 migrations de la taxonomie marques |
| `apps/api/migrations/taxonomy-v1.js` | Arbre des catégories d'équipement |
| `apps/api/migrations/taxonomy-maintenance-v1.js` | Catégories de stock |
| `docs/05-Specs/Taxonomie_Unifiee.md` | Spécification complète |

---

## Workflow de modification

1. Créer une nouvelle migration dans `taxonomy-brands-v1.js`
2. Utiliser `INSERT OR IGNORE` pour les seeds idempotents
3. Tester localement (base dev)
4. Vérifier la résolution : `resolveBrand('nouveau nom')` doit retourner le bon ID
5. Vérifier `enrichArticle()` sur des articles réels
6. Commit : `feat(taxonomy): add {description}`
