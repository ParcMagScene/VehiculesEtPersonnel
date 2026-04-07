# 📒 Module Annuaire

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

## Composants

| Composant | Rôle |
|-----------|------|
| AnnuairePanel | Panel principal |
| ContactsCSVImportDialog | Import CSV contacts/lieux |

## Service API

`utils/api/annuaire.js` — Clients, fournisseurs, prestataires, contacts

## Validations

- SIRET : 14 chiffres + algorithme de Luhn
- TVA intracommunautaire : FR + 11 chiffres
- Téléphone : normalisation format français
- Recherche FTS globale (toutes entités)
