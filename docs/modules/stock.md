# 📊 Module Stock

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

## Composants

| Composant | Rôle |
|-----------|------|
| StockPanel | Panel principal gestion stock |

## Service API

`utils/api/stock.js` — Inventaire stock, articles, mouvements, imports

## Règles métier

- Alerte stock bas (qty ≤ min_qty)
- Traçabilité mouvements (in/out/adjustment/return)
- Références auto : STK-00001 (vente), SAV-00001 (pièces SAV)
- Import CSV en masse
