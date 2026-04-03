# GUI — Conventions d'Interface — Prompt Maître
Version: 1.0.0
Statut: stable
Dernière mise à jour: 2026-03-30
Auteur: Alexandre + Copilot
Description: Conventions de développement des interfaces React dans eM@g — structure des panneaux, patterns de composants, gestion d'état, formulaires et interactions.

---

## Contexte

Toutes les interfaces d'eM@g suivent un pattern Panel uniforme avec toolbar, filtres, table/grid, modales et notifications. L'état est géré localement (pas de Redux/Zustand).

---

## Architecture d'un Panel

```jsx
function XyzPanel({ currentUser, isMobile, initialTab }) {
  // --- État principal ---
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(initialTab || 'default');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // --- État d'édition ---
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // --- Chargement ---
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.getItems();
      setData(result);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Rendu ---
  return (
    <div className="xyz-panel">
      {/* Toolbar */}
      {/* Tabs */}
      {/* Content (Table / Grid) */}
      {/* Modales */}
      {/* ConfirmDialog */}
    </div>
  );
}
```

---

## Pattern Toolbar

```jsx
<div className="panel-toolbar">
  <div className="panel-search">
    <Search size={16} />
    <input
      type="text"
      placeholder="Rechercher..."
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
    />
    {searchTerm && <X size={14} className="clear-search" onClick={() => setSearchTerm('')} />}
  </div>
  <div className="panel-toolbar-actions">
    <button className="btn-add" onClick={() => { setEditingItem(null); setShowForm(true); }}>
      <Plus size={15} /> Nouveau
    </button>
  </div>
</div>
```

---

## Pattern Table

```jsx
<table className="panel-table">
  <thead>
    <tr>
      <th>Nom</th>
      <th>Type</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {items.map(item => (
      <tr key={item.id}>
        <td className="name-cell">{item.name}</td>
        <td><span className="type-badge">{item.type}</span></td>
        <td>
          <div className="actions-cell">
            <button title="Modifier" onClick={() => handleEdit(item)}><Edit2 size={14} /></button>
            <button className="btn-danger" title="Supprimer" onClick={() => handleDelete(item)}><Trash2 size={14} /></button>
          </div>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

---

## Pattern Modales

### Formulaire (Dialog)
```jsx
{showForm && (
  <XyzDialog
    item={editingItem}
    onSave={handleSave}
    onClose={() => { setShowForm(false); setEditingItem(null); }}
  />
)}
```

### Confirmation
```jsx
{confirmDialog && <ConfirmDialog {...confirmDialog} />}

// Déclenchement :
setConfirmDialog({
  title: 'Supprimer l\'élément',
  message: `Voulez-vous vraiment supprimer « ${item.name} » ?`,
  onConfirm: async () => { await api.deleteItem(item.id); loadData(); setConfirmDialog(null); },
  onCancel: () => setConfirmDialog(null),
});
```

---

## Pattern Notifications (Toast)

```jsx
const toast = useToast();
toast.success('Élément créé');
toast.error('Erreur lors de la sauvegarde');
toast.warning('Attention : données manquantes');
toast.info('Import en cours...');
```

---

## Pattern Status

```javascript
const STATUS_MAP = {
  draft:     { label: 'Brouillon',  color: '#6b7280', icon: '📝' },
  sent:      { label: 'Envoyée',    color: '#3b82f6', icon: '📤' },
  confirmed: { label: 'Confirmée', color: '#22c55e', icon: '✅' },
  cancelled: { label: 'Annulée',   color: '#ef4444', icon: '❌' },
};
```

---

## Pattern Tabs

```jsx
const TABS = [
  { id: 'tab1', label: 'Onglet 1', icon: Package },
  { id: 'tab2', label: 'Onglet 2', icon: Users },
];

<div className="panel-tabs">
  {TABS.map(tab => (
    <button
      key={tab.id}
      className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
      onClick={() => setActiveTab(tab.id)}
    >
      <tab.icon size={15} /> {tab.label}
    </button>
  ))}
</div>
```

---

## Règles impératives

1. **État local uniquement** — pas de state manager global
2. **API centralisée** — `api.{method}()` depuis `utils/api/`
3. **Icônes lucide-react** — jamais d'emoji dans les boutons
4. **Responsive** — tester avec `isMobile` prop
5. **Accessibilité** — `title` sur les boutons d'action, `label` sur les inputs
6. **Pas de `console.log` en production** — utiliser `logger`
7. **Un Panel = un fichier .jsx + un fichier .css**
8. **Formulaires dans des composants Dialog séparés**

---

## Panneaux de référence

| Panel | Fichier | Pattern illustré |
|-------|---------|------------------|
| Orders | `apps/web/src/components/orders/OrdersPanel.jsx` | Tabs, status, stats |
| Annuaire | `apps/web/src/components/annuaire/AnnuairePanel.jsx` | Entity tabs, import CSV |
| Équipement | `apps/web/src/components/equipment/EquipmentPanel.jsx` | Hiérarchie, detail panel |
| Véhicules | `apps/web/src/components/vehicles/VehiclesPanel.jsx` | Formulaires complexes |
