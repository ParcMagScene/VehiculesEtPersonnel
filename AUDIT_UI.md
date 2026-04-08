# AUDIT_UI.md — UI / UX

> **Branche** : `audit/ui` | **Phase** : C | **Priorité** : P1
> **Statut** : ✅ TERMINÉ — commit `84f0bc3`

---

## Objectif

Corriger les problèmes d'expérience utilisateur : actions destructives sans confirmation, feedback manquant, accessibilité.

## Corrections appliquées (commit `84f0bc3`)

| # | Sev | Problème | Fix | Fichier |
|---|-----|----------|-----|---------|
| U1 | CRIT | PresetPanel — delete sans confirmation | useConfirmDialog ajouté | PresetPanel.jsx |
| U2 | CRIT | ProfileEditModal — delete avatar sans confirmation | useConfirmDialog ajouté | ProfileEditModal.jsx |
| U3 | CRIT | EquipmentPanel — 5× window.confirm() | → confirm() du hook (5 remplacements) | EquipmentPanel.jsx |
| U4 | HIGH | InventoryPanel — toast stub no-op | → useToast() réel | InventoryPanel.jsx |
| U5 | HIGH | StockPanel — loadData error silencieux | + toast.error() | StockPanel.jsx |
| U6 | HIGH | PresetPanel — CRUD sans feedback | + toast success/error sur save/delete | PresetPanel.jsx |
| U7 | HIGH | LeaveRequestsPanel — loadBalance silencieux | + useToast + toast.error() | LeaveRequestsPanel.jsx |
| U8 | MED | StockPanel — recherche sans debounce | + debouncedSearch 300ms | StockPanel.jsx |
| U9 | MED | Modal.jsx — pas de focus trap | + Tab/Shift+Tab cycling + auto-focus | Modal.jsx |
| U11 | MED | LeavesTab — cancel congé sans confirmation | useConfirmDialog + toast | LeavesTab.jsx |

## Backlog

| # | Sev | Problème | Raison report |
|---|-----|----------|---------------|
| U10 | MED | AnnuairePanel — `<td>` cliquable sans role/tabIndex | Risque a11y faible |
| U12 | LOW | SearchBar — pas de prop debounce intégrée | Design-level change |

- Vérification visuelle sur desktop + mobile
- Test formulaire avec erreur → feedback visible
- Test suppression → confirmation demandée
- Audit Lighthouse accessibilité

## Notes de validation

_(à remplir après chaque étape)_
