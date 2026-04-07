# 📦 API Commandes & Fournisseurs

> **Version** : 1.0.0  
> **Source** : `ordersRoutes.js`  
> **Dernière MÀJ** : 7 avril 2026

---

## Fournisseurs

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/suppliers` | ✅ | Liste fournisseurs (inclut order_count) |
| POST | `/api/suppliers` | ✅ | Crée fournisseur |
| PUT | `/api/suppliers/:id` | ✅ | MAJ fournisseur |
| DELETE | `/api/suppliers/:id` | ✅🔑 | Empêche suppression si commandes liées |

---

## Commandes (PO)

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/orders` | ✅ | Filtres: status, affaire_id, supplier_id (LEFT JOIN affaires) |
| POST | `/api/orders` | ✅🔑 | Crée commande (ref auto PO-YYYY-###) |
| GET | `/api/orders/stats` | ✅ | Comptages par statut + total HT |
| GET | `/api/orders/my-linked` | ✅ | Commandes issues de mes demandes matériel |
| GET | `/api/orders/:id` | ✅ | Détail + lignes + pièces jointes |
| PUT | `/api/orders/:id` | ✅🔑 | MAJ avec machine d'état (ORDER_TRANSITIONS) |
| DELETE | `/api/orders/:id` | ✅🔑 | Supprime si brouillon |

### Machine d'état commandes

```
draft → sent → confirmed → partial → received
                    ↘                    ↗
                      → cancelled ←────
```

---

## Lignes de commande

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/orders/:id/items` | ✅ | Lignes de commande |
| POST | `/api/orders/:id/items` | ✅🔑 | Ajoute ligne |
| PUT | `/api/orders/:id/items/:itemId` | ✅🔑 | MAJ (qté, prix, received_qty) |
| DELETE | `/api/orders/:id/items/:itemId` | ✅🔑 | Supprime ligne |

---

## Devis (Quotes)

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/quotes` | ✅ | Liste devis |
| POST | `/api/quotes` | ✅🔑 | Crée devis (ref auto QUOTE-YYYY-###) |
| PUT | `/api/quotes/:id` | ✅🔑 | MAJ statut (draft→sent→accepted/refused) |

---

## Demandes matériel

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/material-requests` | ✅ | Liste demandes d'achat |
| POST | `/api/material-requests` | ✅ | Crée demande |
| PUT | `/api/material-requests/:id` | ✅ | MAJ (needs_review→approved→ordered) |
| DELETE | `/api/material-requests/:id` | ✅ | Supprime si pending |

---

## Documents fournisseurs

| Méthode | Endpoint | Auth | Description |
|---------|----------|:----:|-------------|
| GET | `/api/supplier-documents` | ✅ | Liste docs (contrats, catalogues) |
| POST | `/api/supplier-documents` | ✅🔑 | Upload document |
| DELETE | `/api/supplier-documents/:id` | ✅🔑 | Supprime document |
