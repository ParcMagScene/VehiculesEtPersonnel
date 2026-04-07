# 🧩 Documentation Modules — eM@g

> Référence complète des modules fonctionnels frontend (React 18 + Vite).
>
> **Version** : 1.0.0  
> **Dernière MÀJ** : 7 avril 2026

---

## Architecture

- **Routage** : Hash-based + état local `activeModule` (pas de React Router)
- **Navigation** : `setActiveModule()` + `NavigationContext` pour navigation croisée
- **Design System** : Composants atomiques dans `components/ui/`
- **API** : Modules dans `utils/api/` — instance singleton `api`

---

## Index des modules

| Module | Panel principal | Service API | Doc |
|--------|----------------|-------------|-----|
| Auth | LoginForm | `api/admin.js` | [auth.md](auth.md) |
| Véhicules | VehicleDetailPanel + Calendar | `api/vehicles.js` | [vehicles.md](vehicles.md) |
| Personnel | PersonnelPanel | `api/personnel.js` | [personnel.md](personnel.md) |
| Matériel | EquipmentPanel | `api/equipment.js` | [equipment.md](equipment.md) |
| Affaires | AffairesPanel | `api/affaires.js` | [affaires.md](affaires.md) |
| Commandes | OrdersPanel | `api/orders.js` | [orders.md](orders.md) |
| Stock | StockPanel | `api/stock.js` | [stock.md](stock.md) |
| Planning | PlanningPanel | `api/planning.js` | [planning.md](planning.md) |
| Messagerie | MessagingPanel | `api/messaging.js` | [messaging.md](messaging.md) |
| Congés | (dans PersonnelPanel) | `api/leaves.js` | [leaves.md](leaves.md) |
| Annuaire | AnnuairePanel | `api/annuaire.js` | [annuaire.md](annuaire.md) |
| Vidéo | VideoPanel | `api/video.js` | [video.md](video.md) |
| Affichage TV | DisplayDashboardPanel | `api/display.js` | [display.md](display.md) |
| Inventaire | InventoryPanel | `api/inventory.js` | [inventory.md](inventory.md) |
| Mailing | MailingPanel | `api/mailing.js` | [mailing.md](mailing.md) |
| Management | ManagementPanel | `api/admin.js` | [auth.md](auth.md) |

---

## Hooks partagés

| Hook | Fichier | Usage |
|------|---------|-------|
| `useAppData` | `hooks/useAppData.js` | Charge + cache données métier |
| `useTheme` | `hooks/useTheme.js` | Thème (light/dark, palette, densité) |
| `useToast` | `hooks/useToast.jsx` | Notifications toast |
| `useFeedback` | `hooks/useFeedback.js` | Feedback (toast + dialogs) |
| `useSilentRefresh` | `hooks/useSilentRefresh.js` | Renouvellement JWT |
| `useKeyboardShortcuts` | `hooks/useKeyboardShortcuts.js` | Raccourcis clavier |
| `useWindowWidth` | `hooks/useWindowWidth.js` | Breakpoints responsive |
| `useMessagingPolling` | `hooks/useMessagingPolling.js` | Polling messages non lus |
| `useAutocomplete` | `hooks/useAutocomplete.js` | Autocomplétion avec cache |

---

## Contextes

| Context | Fichier | Rôle |
|---------|---------|------|
| `AuthContext` | `contexts/AuthContext.jsx` | Utilisateur courant, prefs |
| `NavigationContext` | `contexts/NavigationContext.jsx` | Navigation croisée inter-modules |
| `ToastProvider` | `hooks/useToast.jsx` | Partage instance toast |
