# 📦 Module Commandes

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

## Composants

| Composant | Rôle |
|-----------|------|
| OrdersPanel | Panel principal commandes |

## Service API

`utils/api/orders.js` — Commandes fournisseurs, devis, demandes matériel, documents

## Machines d'état

- **Commandes** : draft → sent → confirmed → partial → received / cancelled
- **Devis** : draft → sent → accepted / refused
- **Demandes matériel** : pending → needs_review → approved → ordered

## Références auto

- Commandes : `PO-YYYY-###`
- Devis : `QUOTE-YYYY-###`
