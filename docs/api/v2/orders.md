# API v2 — Orders (Commandes et devis)

**Ticket** : T-P1-09 (cycle achat) + T-P1-10 (réception partielle
& conversion devis → commande).
**Feature flag serveur** : `FEATURE_V2_ORDERS` (off par défaut).
**Coexistence** : `/api/orders/*` et `/api/quotes/*` v1 inchangés.

Ce namespace valide strictement les transitions de statut via les
matrices déjà définies dans `apps/api/orders/_helpers.js`
(`ORDER_TRANSITIONS`, `QUOTE_TRANSITIONS`). Le v1 les applique déjà
via `validateStatusTransition`, mais avec une réponse HTTP
non-standardisée. Le v2 les rejoue avec le payload `{success, data,
meta}` + `handleServiceError` typé.

---

## Discovery — `GET /api/v2/orders/protocol`

Public. Retourne notamment les 2 matrices sérialisées :

```json
{
  "order_transitions": {
    "draft":     ["sent", "cancelled"],
    "sent":      ["confirmed", "cancelled"],
    "confirmed": ["partial", "received", "cancelled"],
    "partial":   ["received"],
    "received":  [],
    "cancelled": ["draft"]
  },
  "quote_transitions": {
    "draft":     ["sent", "cancelled"],
    "sent":      ["accepted", "refused", "cancelled"],
    "accepted":  [],
    "refused":   ["draft"],
    "cancelled": ["draft"]
  }
}
```

Les auto-transitions (`from === to`) sont autorisées silencieusement
(idempotence, `changed=false` dans la réponse).

---

## Transition commande — `POST /api/v2/orders/:id/transition`

Authentifié. Body :

```json
{ "status": "sent" }
```

### Réponse 200

```json
{
  "success": true,
  "data": {
    "order_id": 17,
    "previous_status": "draft",
    "new_status": "sent",
    "changed": true
  }
}
```

### Erreurs

- `400 VALIDATION_ERROR` : statut inconnu, body invalide.
- `404 NOT_FOUND` : commande introuvable.
- `409 CONFLICT` : transition interdite. `meta.details.allowed` =
  liste des statuts atteignables depuis `from`.

---

## Transition devis — `POST /api/v2/quotes/:id/transition`

Même contrat que orders, applique la matrice
`QUOTE_TRANSITIONS`.

---

## Reference

- `apps/api/orders/_helpers.js` : source des matrices
  (réutilisées telles quelles, aucune duplication).
- `apps/api/services/orders/stateMachine.js` : wrapper avec typed
  errors (`OrdersV2ValidationError`, `OrdersV2ConflictError`).
- `apps/api/services/orders/transitions.js` : `transitionOrder`,
  `transitionQuote`.
- `apps/api/v2/ordersRoutes.js` : namespace + gate + handler.

---

## Non couvert par T-P1-09

- **CRUD complet** des commandes/devis en v2 (create, list, update,
  delete) : le v1 reste seul propriétaire. Migration progressive
  possible dans un ticket ultérieur.
- **Réception partielle enrichie** (`order_receptions` détaillé,
  ventilation par ligne) : ticket **T-P1-10** dédié.
- **Conversion devis → commande** (`quotes.converted_to_order_id`) :
  ticket **T-P1-10**.
- **UI** consommant les endpoints : ticket T-P1-09b après
  dogfooding.

---

## T-P1-10 — Réception partielle détaillée

### Migration `order_receptions`

Nouvelle table (additive, idempotente) :

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | INTEGER PK | |
| `order_id` | INTEGER FK CASCADE `orders(id)` | |
| `order_item_id` | INTEGER FK CASCADE `order_items(id)` | |
| `received_qty` | REAL NOT NULL | > 0 |
| `received_at` | DATETIME | Défaut `datetime('now')`. |
| `received_by` | INTEGER FK users SET NULL | |
| `notes` | TEXT | |
| `created_at` | DATETIME | |

Index : `idx_order_receptions_order`, `idx_order_receptions_item`,
`idx_order_receptions_received_at`.

### `POST /api/v2/orders/:id/receptions`

Authentifié. Insère une ligne dans `order_receptions` + incrémente
`order_items.received_qty` cumulativement. **Ne modifie pas** le
statut de la commande automatiquement (à faire manuellement via
`POST /orders/:id/transition` selon la matrice, `confirmed →
partial` ou `→ received`).

#### Body

```json
{
  "order_item_id": 42,
  "received_qty": 3,
  "notes": "Livraison 1"
}
```

#### Réponse 201

```json
{
  "success": true,
  "data": {
    "reception": { "id": 7, "received_qty": 3, ... },
    "order_item": {
      "id": 42,
      "quantity": 10,
      "received_qty": 3,
      "remaining": 7,
      "fully_received": false
    }
  }
}
```

#### Erreurs

- `400 VALIDATION_ERROR` : `receivedQty <= 0`, `order_item_id`
  n'appartient pas à la commande.
- `404 NOT_FOUND` : commande ou ligne introuvable.
- `409 CONFLICT` : **sur-réception refusée** (cumul dépasserait
  `order_items.quantity`). `meta.details.max_allowed` = quantité
  restante autorisée.

### `GET /api/v2/orders/:id/receptions/summary`

Authentifié. Résumé agrégé :

```json
{
  "order_id": 17,
  "items_total": 3,
  "items_fully_received": 1,
  "items_partial": 1,
  "items_pending": 1,
  "all_received": false,
  "any_received": true
}
```

Utile pour proposer la transition `→ received` en UI dès que
`all_received=true`.

---

## T-P1-10 — Conversion devis → commande

### `POST /api/v2/quotes/:id/convert-to-order`

Authentifié. Convertit un devis `accepted` en commande `draft` +
copie les items. Marque `quotes.converted_to_order_id`. Miroir
strict de la logique v1 (`POST /api/quotes/:id/convert`) en
service pur avec transaction.

#### Réponse 201

```json
{
  "success": true,
  "data": {
    "quote_id": 5,
    "order_id": 12,
    "order_reference": "BC-2026-007",
    "items_copied": 3
  }
}
```

#### Erreurs

- `400 VALIDATION_ERROR`.
- `404 NOT_FOUND` : devis introuvable.
- `409 CONFLICT` : devis pas en statut `accepted`
  (`meta.details.currentStatus`) OU déjà converti
  (`meta.details.existingOrderId`).

---

## Non couvert par T-P1-10

- Auto-transition de `orders.status` lors des réceptions (partial /
  received) : reste manuelle via `POST /orders/:id/transition`.
- Annulation d'une réception (delete row `order_receptions`) : hors
  scope.
- UI : ticket T-P1-10b.
