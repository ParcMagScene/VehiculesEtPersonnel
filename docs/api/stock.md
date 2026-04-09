# 📊 API Stock

> **Version** : 1.0.0  
> **Source** : `stockRoutes.js`  
> **Dernière MÀJ** : 7 avril 2026

---

## Catégories stock

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/stock/categories` | ✅ | Catégories hiérarchiques + item_count |
| POST | `/api/stock/categories` | ✅🔑 | Crée catégorie |
| PUT | `/api/stock/categories/:id` | ✅🔑 | MAJ catégorie |
| DELETE | `/api/stock/categories/:id` | ✅🔑 | Empêche suppression si articles rattachés |

---

## Articles stock

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/stock/items` | ✅ | Filtres: search, category_id, low_stock (qty ≤ min_qty), supplier_id, stock_type (vente/sav) |
| GET | `/api/stock/items/:id` | ✅ | Détail + historique prix |
| POST | `/api/stock/items` | ✅🔑 | Crée article (ref auto STK-00001 ou SAV-00001, log mouvement initial) |
| PUT | `/api/stock/items/:id` | ✅🔑 | MAJ (log mouvement si qté change) |
| DELETE | `/api/stock/items/:id` | ✅🔑 | Supprime (vérifie mouvements actifs) |

---

## Mouvements stock

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/stock/movements` | ✅ | in/out/adjustment/return, filtre par date |
| POST | `/api/stock/movements` | ✅ | Crée mouvement (valide qté disponible) |

---

## Import & Stats

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/stock/imports` | ✅ | Sessions d'import en masse |
| POST | `/api/stock/imports` | ✅🔑 | Import CSV batch |
| GET | `/api/stock/stats` | ✅ | Stats: total articles, alertes stock bas, valeur totale |

---

## Règles métier

- **Alerte stock bas** : Signalé quand `quantity ≤ min_quantity`
- **Référence auto** : STK-00001 (vente) ou SAV-00001 (pièces SAV)
- **Traçabilité** : Tout mouvement loggé (type, quantité, opérateur, date)
- **Types mouvement** : `in` (entrée), `out` (sortie), `adjustment` (correction), `return` (retour)
