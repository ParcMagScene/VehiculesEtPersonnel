# 📁 Module Affaires

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

## Composants

| Composant | Rôle |
|-----------|------|
| AffairesPanel | Panel principal |
| AffaireDetailPanel | Détail affaire |
| AffaireImportModal | Import CSV |
| BLImportModal | Import bon de livraison |
| BLMultiImportModal | Import batch BL |
| BLImportLocPrestaModal | Import BL avec localisation |
| SavImportModal | Import SAV |
| GenerateOrdersModal | Génération commandes FRS |

## Hooks

- `useAnnotateBP` — Annotation bons de prestation
- `useAppData` — Données affaires

## Service API

`utils/api/affaires.js` — Affaires, BL, devis, factures, annotations

## Enrichissement

Les affaires sont auto-détectées depuis les réservations (champ `affaire`).
Le GET liste enrichit automatiquement avec les counts (véhicules, personnel, BL, commandes).
