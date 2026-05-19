# Audit formulaires — apps/web (2026-05-19)

## 1. Périmètre et méthode

- Cible : 36 balises `<form>` réparties sur 30 fichiers JSX (apps/web/src),
  hors `apps/tv-client` et `apps/api`.
- Axes : primitives UI, validation, dirty-state, save/submit, gestion des
  erreurs, accessibilité (label / aria / autoComplete), confirmation avant
  fermeture / suppression.
- Outils audités : aucune lib externe ; tout est custom (`useState` + handlers).

## 2. Primitives existantes

| Primitive | Fichier | Couverture | État |
|---|---|---|---|
| `FormField` (label + hint + erreur + aria-injection) | [apps/web/src/components/ui/FormField.jsx](apps/web/src/components/ui/FormField.jsx) | 0 import en prod | ✅ Robuste, sous-utilisée |
| `FormLayout` / `FormSection` / `FormRow` / `FormActions` | [apps/web/src/components/ui/FormLayout.jsx](apps/web/src/components/ui/FormLayout.jsx) | 0 import en prod | ✅ Robuste, sous-utilisée |
| `useDirtyForm` (snapshot JSON + `guardClose`) | [apps/web/src/hooks/useDirtyForm.js](apps/web/src/hooks/useDirtyForm.js) | 6 imports sur ~30 forms | ⚠️ Adoption faible |
| `useConfirmDialog` (Dialog promisifié) | [apps/web/src/hooks/useConfirmDialog.jsx](apps/web/src/hooks/useConfirmDialog.jsx) | 3 imports | ⚠️ Adoption faible |
| `Input` / `Select` / `Textarea` (aria-invalid auto via `error`) | apps/web/src/components/ui/ | OK | ✅ |

**Constat** : les briques d'a11y et de cohérence existent, mais les écrans
métier les contournent — `<label>...<input/></label>` ou
`<label>X</label><input>` recodés à la main, sans `htmlFor`, sans `aria-*`.

## 3. Inventaire des formulaires

### 3.1 Auth & profil
- [LoginForm.jsx](apps/web/src/components/auth/LoginForm.jsx) — 2 forms (login + self reset).
- [MobileLogin.jsx](apps/web/src/components/mobile/MobileLogin.jsx)
- [ChangePassword.jsx](apps/web/src/components/auth/ChangePassword.jsx)
- [ProfileEditModal.jsx](apps/web/src/components/auth/ProfileEditModal.jsx)
- [MonEspacePanel.jsx](apps/web/src/components/auth/MonEspacePanel.jsx)
- [UserPreferencesModal.jsx](apps/web/src/components/auth/UserPreferencesModal.jsx) — utilise `useDirtyForm` ✅

### 3.2 Personnel / annuaire
- [PersonnelPanel.jsx](apps/web/src/components/personnel/PersonnelPanel.jsx)
- [SkillsTab.jsx](apps/web/src/components/personnel/SkillsTab.jsx) / [PositionsTab.jsx](apps/web/src/components/personnel/PositionsTab.jsx)
- [AnnuairePanel.jsx](apps/web/src/components/annuaire/AnnuairePanel.jsx) — 2 forms.

### 3.3 Équipement / SAV / inventaire
- [EquipmentFormModal.jsx](apps/web/src/components/equipment/EquipmentFormModal.jsx)
- [EquipmentSAV.jsx](apps/web/src/components/equipment/EquipmentSAV.jsx) — 2 forms (desktop + mobile).
- [InventoryPanel.jsx](apps/web/src/components/inventory/InventoryPanel.jsx)
- [StockPanel.jsx](apps/web/src/components/orders/StockPanel.jsx) — 3 forms (item / category / movement).

### 3.4 Véhicules
- [ReservationModal.jsx](apps/web/src/components/vehicles/ReservationModal.jsx) — utilise `useDirtyForm` ✅
- [GoogleEventFormModal.jsx](apps/web/src/components/vehicles/GoogleEventFormModal.jsx) — `useDirtyForm` ✅
- [MaintenanceDialog.jsx](apps/web/src/components/vehicles/MaintenanceDialog.jsx)
- [VehicleMaintenanceModal.jsx](apps/web/src/components/vehicles/VehicleMaintenanceModal.jsx)
- [TripDetailsModal.jsx](apps/web/src/components/vehicles/TripDetailsModal.jsx)
- [LocationDialog.jsx](apps/web/src/components/vehicles/LocationDialog.jsx) / [ClientDialog.jsx](apps/web/src/components/vehicles/ClientDialog.jsx)
- [GoogleCalendarConfig.jsx](apps/web/src/components/vehicles/GoogleCalendarConfig.jsx)

### 3.5 Planning / tâches / congés
- [InterventionModal.jsx](apps/web/src/components/planning/InterventionModal.jsx) — `useDirtyForm` ✅
- [TaskEditModal.jsx](apps/web/src/components/planning/TaskEditModal.jsx) — `useDirtyForm` ✅ ; mais 10+ `<label>` sans `htmlFor`.
- [AddTaskModal.jsx](apps/web/src/components/planning/AddTaskModal.jsx) — mêmes constats labels.
- [LeaveRequestForm.jsx](apps/web/src/components/leaves/LeaveRequestForm.jsx)

### 3.6 Mobile
- [MobileReservations.jsx](apps/web/src/components/mobile/MobileReservations.jsx) ✅ pattern `isSubmitting`.
- [MobileMaintenances.jsx](apps/web/src/components/mobile/MobileMaintenances.jsx) ✅ pattern `isSubmitting`.
- MobileLogin déjà cité.

### 3.7 Divers
- [CameraSettingsModal.jsx](apps/web/src/components/video/CameraSettingsModal.jsx) — `useDirtyForm` ✅
- [UserManagement.jsx](apps/web/src/components/management/UserManagement.jsx) — 2 forms + 1 quick.
- [AccessRequestModal.jsx](apps/web/src/components/management/AccessRequestModal.jsx) — 2 forms.
- [SuiviPanel.jsx](apps/web/src/components/suivi/SuiviPanel.jsx) — team auth.

## 4. Patterns détectés

### 4.1 ✅ Conformes
- Tous les inputs design-system (`Input`, `Select`, `Textarea`) propagent
  `aria-invalid` quand on passe `error`.
- Les champs sensibles (login, password, PIN) ont les `autoComplete`
  appropriés (`username`, `current-password`, `new-password`, `one-time-code`,
  `email`).
- 14 boutons submit avec `disabled={loading|saving|isSubmitting}` pour
  prévenir le double submit.

### 4.2 ⚠️ Incohérences
| # | Sujet | Détail | Impact |
|---|---|---|---|
| F1 | `useDirtyForm` sous-utilisé | 6 forms sur 30 (auth/préférences/calendar/intervention/réservation/caméra). Tous les autres perdent les modifications silencieusement à la fermeture. | UX |
| F2 | `FormField` / `FormLayout` zéro adoption | 0 import en prod, label/htmlFor recodés à la main partout. | A11y + maintenance |
| F3 | `<label>` sans `htmlFor` | ~60 occurrences (TaskEditModal, AddTaskModal, MailingPanel, UserManagement, ManagementPanel, ReportsPanel…). Beaucoup compensent en englobant l'input dans le label, mais pas tous. | A11y |
| F4 | `window.confirm` natif | 7 sites (cf. §5) → UX hétérogène, pas thématisable, bloque le thread. | UX + thème sombre |
| F5 | Loading state submit hétérogène | Noms divers : `loading`, `saving`, `isSaving`, `isSubmitting`, `submitting`, `pinLoading`, `backfillingRefs`… aucune convention. | Maintenance |
| F6 | Pas de schema validation | Validation inline dans `handleSubmit` (regex email, longueur, présence). Duplication entre desktop / mobile. | Robustesse |
| F7 | `alert()` pour erreurs serveur | `ControlsDashboard.jsx` lignes 88-95 ; supprimer au profit de `toast.error` (déjà utilisé ailleurs). | UX |
| F8 | Aucune lib `react-hook-form` / `zod` | Refonte complète d'envergure → garder le custom mais **systématiser** `FormField` + `useDirtyForm`. | Stratégie |

### 4.3 ❌ Anti-patterns critiques (à corriger en priorité)
- `useDirtyForm` lui-même utilise `window.confirm` (l.52) → migration vers
  `useConfirmDialog` nécessite une refonte (callback async). À **différer**
  jusqu'à ce que `guardClose` accepte un confirmer injecté.
- TaskEditModal : 10+ `<label>` non liés. À migrer vers `FormField`.

## 5. Quick wins — `window.confirm` à migrer vers `useConfirmDialog`

| Fichier | Ligne | Action |
|---|---|---|
| [controles/EquipmentControls.jsx](apps/web/src/components/controles/EquipmentControls.jsx) | 131 | Désactiver contrôle |
| [controles/ControlsDashboard.jsx](apps/web/src/components/controles/ControlsDashboard.jsx) | 84 | Désactiver contrôle |
| [controles/ControlsDashboard.jsx](apps/web/src/components/controles/ControlsDashboard.jsx) | 93 | Recompute statuts |
| [suivi/IncidentsSuiviPanel.jsx](apps/web/src/components/suivi/IncidentsSuiviPanel.jsx) | 513 | Supprimer ticket |
| [planning/TaskPlanningPanel.jsx](apps/web/src/components/planning/TaskPlanningPanel.jsx) | 400 | Clear completed tasks |
| [equipment/EquipmentPanel.jsx](apps/web/src/components/equipment/EquipmentPanel.jsx) | 910 | Backfill Locmat references |
| [mobile/MobileDashboardAdmin.jsx](apps/web/src/components/mobile/MobileDashboardAdmin.jsx) | 123 | Supprimer entrée |

> ✅ **Action de ce chantier** : 7 migrations appliquées (commit séparé).

## 6. Plan de fond (hors quick wins)

### Phase A — A11y forms (1-2 jours)
- Migrer TaskEditModal / AddTaskModal / MailingPanel vers `FormField` pour
  bénéficier de l'`htmlFor` automatique et de `aria-describedby`.
- Storybook : ajouter une story de référence "Form complet conforme".

### Phase B — `useDirtyForm` partout (1 jour)
- Brancher sur tous les modals d'édition : Equipment, Inventory, Stock,
  Maintenance, TripDetails, LocationDialog, ClientDialog, LeaveRequestForm.
- Critère : si le composant a un état `formData` + `onClose`, il doit avoir
  `guardClose`.

### Phase C — Convention loading (½ journée)
- Renommer `loading|saving|isSaving|isSubmitting|submitting|pinLoading` →
  convention unique `submitting` (forms) / `loading` (lectures).
- Lint custom optionnel (`no-restricted-syntax` sur les variants).

### Phase D — `guardClose` v2 (½ journée)
- `useDirtyForm` accepte un `confirmer` (par défaut `window.confirm`,
  injectable avec `useConfirmDialog`). Permet de remplacer le dernier
  `window.confirm` du codebase.

### Phase E — Validation déclarative (optionnel, 2-3 jours)
- Choisir entre `zod` (schema-first) ou rester custom mais factoriser un
  `useValidatedForm({ schema, onSubmit })`. Décision à prendre après les
  phases A-D.

## 7. Métriques avant/après ce chantier

| Métrique | Avant | Après ce chantier |
|---|---|---|
| `window.confirm` (hors `useDirtyForm`) | 7 | 0 |
| Adoption `useConfirmDialog` | 3 fichiers | 10 fichiers |
| Adoption `useDirtyForm` | 6 forms | 6 forms (inchangé) |
| Adoption `FormField` en prod | 0 | 0 (Phase A) |

## 8. Conclusion

L'arsenal est en place (FormField, FormLayout, useDirtyForm,
useConfirmDialog, Input/Select/Textarea avec aria-invalid). **Le problème
n'est pas l'outillage mais l'adoption**. Le quick win immédiat
(`window.confirm` → `useConfirmDialog`) homogénéise l'UX. La phase A
ramène une vraie cohérence a11y. Les phases B-D consolident le pattern
sans introduire de dépendance externe.
