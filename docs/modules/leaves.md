# 🏖️ Module Congés

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

## Composants

Intégré dans le module Personnel :
- `LeaveRequestsPanel` — Demandes de congés
- `LeaveValidationPanel` — Validation admin
- `LeavesTab` — Onglet congés
- `MonEspacePanel` — Espace personnel

## Service API

`utils/api/leaves.js` — Gestion complète congés

## Conformité IDCC 3252

- 2,5j/mois = 30j/an
- Période référence : 1er juin → 31 mai
- Congé principal : min 12j consécutifs (1er mai → 31 oct)
- Préavis minimum 30 jours
- Solde avant 28 février

## Sécurité

- Auto-approbation bloquée (Phase 1 — CRIT-4)
- Audit trail complet (leave_request_history)
- Détection conflits chevauchement
