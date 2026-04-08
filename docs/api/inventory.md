# 📋 Module Inventaire

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

## Composants

| Composant | Rôle |
|-----------|------|
| InventoryPanel | Panel principal inventaire |

## Hooks

- `useInventory` — Gestion état inventaire

## Service API

`utils/api/inventory.js` — Inventaire matériel

## Tables spécifiques

- `inventory_locations` — Localisations inventaire
- `inventory_price_history` — Historique prix
- `inventory_anomalies` — Anomalies détectées

## Fonctionnalités

- Scan barcode
- Géolocalisation multi-niveaux (dépôt/zone/étage)
- Classification ABC
- Détection anomalies
