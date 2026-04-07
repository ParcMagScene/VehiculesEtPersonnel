# 🔧 Module Matériel & SAV

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

## Composants

| Composant | Rôle |
|-----------|------|
| EquipmentPanel | Panel principal (matériel, SAV, assignations) |
| EquipmentImportModal | Import CSV matériel |

## Hooks

- `useAppData` — Données matériel, catégories

## Service API

`utils/api/equipment.js` — Matériel, catégories, SAV, listes, photos, assignations

## Règles métier

- Prévention double assignation matériel (Phase 3 — MED-W4)
- Machine d'état SAV validée côté serveur (Phase 3 — MED-W1)
- Catégories hiérarchiques (famille→sous-famille→catégorie)
- Référence auto-générée par matériel
