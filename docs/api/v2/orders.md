# API v2 — Orders (Commandes et devis)

**Ticket** : T-P1-09 (Commandes v2 — cycle achat).
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
