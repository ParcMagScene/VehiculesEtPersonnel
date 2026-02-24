import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, Search, Plus, Edit2, Trash2, ArrowLeft, Filter,
  TrendingUp, TrendingDown, AlertTriangle, BarChart3, ArrowUpCircle, ArrowDownCircle,
  RotateCcw, Layers, Tag, MapPin, Euro, Hash, X, Check, ChevronDown,
  Archive, Eye, FolderOpen } from 'lucide-react';
import api from '../utils/api';
import ConfirmDialog from './ConfirmDialog';
import './StockPanel.css';

// ═══ Constantes ═══
const MOVEMENT_TYPES = {
  in: { label: 'Entrée', color: '#10b981', icon: '📥', Icon: ArrowDownCircle },
  out: { label: 'Sortie', color: '#ef4444', icon: '📤', Icon: ArrowUpCircle },
  adjustment: { label: 'Ajustement', color: '#f59e0b', icon: '🔧', Icon: RotateCcw },
  return: { label: 'Retour', color: '#3b82f6', icon: '↩️', Icon: RotateCcw },
};

const UNITS = ['u', 'm', 'm²', 'm³', 'kg', 'L', 'h', 'j', 'lot', 'forfait', 'paire', 'rouleau', 'boîte'];

const CATEGORY_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'
];

const CATEGORY_ICONS = ['📦', '🔧', '⚡', '🔩', '🛠️', '📐', '🧰', '💡', '🔌', '🧲', '🪛', '⛓️'];

const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR');
};

// ═══ Composant Principal ═══
function StockPanel({ currentUser }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [movements, setMovements] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [loading, setLoading] = useState(true);

  // Formulaires
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // ═══ Chargement des données ═══
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (categoryFilter) params.category_id = categoryFilter;
      if (lowStockFilter) params.low_stock = 'true';

      const [itemsData, catsData, statsData, suppData] = await Promise.all([
        api.getStockItems(params),
        api.getStockCategories(),
        api.getStockStats(),
        api.getSuppliers({}).catch(() => [])
      ]);
      setItems(itemsData);
      setCategories(catsData);
      setStats(statsData);
      setSuppliers(suppData);
    } catch (error) {
      console.error('Erreur chargement stock:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter, lowStockFilter]);

  const loadMovements = useCallback(async (itemId) => {
    try {
      const params = {};
      if (itemId) params.stock_item_id = itemId;
      const data = await api.getStockMovements(params);
      setMovements(data.movements || []);
    } catch (error) {
      console.error('Erreur chargement mouvements:', error);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (activeTab === 'movements') loadMovements();
  }, [activeTab, loadMovements]);

  const isAdmin = currentUser?.role === 'admin';

  // ═══ Handlers Articles ═══
  const handleSaveItem = async (data) => {
    try {
      if (editingItem) {
        await api.updateStockItem(editingItem.id, data);
      } else {
        await api.createStockItem(data);
      }
      setShowItemForm(false);
      setEditingItem(null);
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleDeleteItem = (item) => {
    setConfirmDialog({
      title: 'Supprimer l\'article',
      message: `Supprimer "${item.name}" (${item.reference}) ? L'historique des mouvements sera aussi supprimé.`,
      onConfirm: async () => {
        try {
          await api.deleteStockItem(item.id);
          setSelectedItem(null);
          loadData();
        } catch (error) { alert('Erreur: ' + error.message); }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  // ═══ Handlers Catégories ═══
  const handleSaveCategory = async (data) => {
    try {
      if (editingCategory) {
        await api.updateStockCategory(editingCategory.id, data);
      } else {
        await api.createStockCategory(data);
      }
      setShowCategoryForm(false);
      setEditingCategory(null);
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleDeleteCategory = (cat) => {
    setConfirmDialog({
      title: 'Supprimer la catégorie',
      message: `Supprimer la catégorie "${cat.name}" ? Elle ne doit contenir aucun article.`,
      onConfirm: async () => {
        try {
          await api.deleteStockCategory(cat.id);
          loadData();
        } catch (error) { alert('Erreur: ' + error.message); }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  // ═══ Handler Mouvements ═══
  const handleCreateMovement = async (data) => {
    try {
      await api.createStockMovement(data);
      setShowMovementForm(false);
      loadData();
      if (activeTab === 'movements') loadMovements();
      if (selectedItem) {
        const updated = await api.getStockItem(selectedItem.id);
        setSelectedItem(updated);
        loadMovements(selectedItem.id);
      }
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  // ═══ Onglets ═══
  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
    { id: 'items', label: 'Articles', icon: Package },
    { id: 'movements', label: 'Mouvements', icon: TrendingUp },
    { id: 'categories', label: 'Catégories', icon: Layers },
  ];

  // ═══ Rendu ═══
  return (
    <div className="stock-panel">
      {/* Header */}
      <div className="stock-header">
        <div className="stock-header-left">
          <Package size={24} />
          <h2>Stock & Pièces</h2>
        </div>
        <div className="stock-tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`stock-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab.id); setSelectedItem(null); }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="stock-content">
        {loading && !items.length ? (
          <div className="stock-loading">
            <div className="loading-spinner" />
            <p>Chargement du stock...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView stats={stats} items={items} onSelectItem={(item) => { setSelectedItem(item); setActiveTab('items'); }} />
            )}
            {activeTab === 'items' && !selectedItem && (
              <ItemsListView
                items={items}
                categories={categories}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                lowStockFilter={lowStockFilter}
                onLowStockChange={setLowStockFilter}
                onSelect={setSelectedItem}
                onAdd={() => { setEditingItem(null); setShowItemForm(true); }}
                isAdmin={isAdmin}
              />
            )}
            {activeTab === 'items' && selectedItem && (
              <ItemDetailView
                item={selectedItem}
                movements={movements}
                onBack={() => setSelectedItem(null)}
                onEdit={() => { setEditingItem(selectedItem); setShowItemForm(true); }}
                onDelete={() => handleDeleteItem(selectedItem)}
                onMovement={() => setShowMovementForm(true)}
                loadMovements={loadMovements}
                isAdmin={isAdmin}
              />
            )}
            {activeTab === 'movements' && (
              <MovementsView
                movements={movements}
                items={items}
                onAddMovement={() => setShowMovementForm(true)}
                onRefresh={() => loadMovements()}
              />
            )}
            {activeTab === 'categories' && (
              <CategoriesView
                categories={categories}
                onAdd={() => { setEditingCategory(null); setShowCategoryForm(true); }}
                onEdit={(cat) => { setEditingCategory(cat); setShowCategoryForm(true); }}
                onDelete={handleDeleteCategory}
                isAdmin={isAdmin}
              />
            )}
          </>
        )}
      </div>

      {/* Formulaires modaux */}
      {showItemForm && (
        <ItemFormModal
          item={editingItem}
          categories={categories}
          suppliers={suppliers}
          onSave={handleSaveItem}
          onClose={() => { setShowItemForm(false); setEditingItem(null); }}
        />
      )}
      {showCategoryForm && (
        <CategoryFormModal
          category={editingCategory}
          categories={categories}
          onSave={handleSaveCategory}
          onClose={() => { setShowCategoryForm(false); setEditingCategory(null); }}
        />
      )}
      {showMovementForm && (
        <MovementFormModal
          items={items}
          preselectedItem={selectedItem}
          onSave={handleCreateMovement}
          onClose={() => setShowMovementForm(false)}
        />
      )}
      {confirmDialog && <ConfirmDialog {...confirmDialog} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════════
function DashboardView({ stats, items, onSelectItem }) {
  if (!stats) return <div className="stock-empty">Chargement des statistiques...</div>;

  return (
    <div className="stock-dashboard">
      {/* KPIs */}
      <div className="stock-kpis">
        <div className="stock-kpi">
          <div className="kpi-icon" style={{ background: '#dbeafe' }}><Package size={20} color="#3b82f6" /></div>
          <div className="kpi-info">
            <span className="kpi-value">{stats.totalItems}</span>
            <span className="kpi-label">Articles actifs</span>
          </div>
        </div>
        <div className="stock-kpi">
          <div className="kpi-icon" style={{ background: '#dcfce7' }}><Euro size={20} color="#10b981" /></div>
          <div className="kpi-info">
            <span className="kpi-value">{formatCurrency(stats.totalValue)}</span>
            <span className="kpi-label">Valeur du stock</span>
          </div>
        </div>
        <div className="stock-kpi warning">
          <div className="kpi-icon" style={{ background: '#fef3c7' }}><AlertTriangle size={20} color="#f59e0b" /></div>
          <div className="kpi-info">
            <span className="kpi-value">{stats.lowStockCount}</span>
            <span className="kpi-label">Stock bas</span>
          </div>
        </div>
        <div className="stock-kpi danger">
          <div className="kpi-icon" style={{ background: '#fee2e2' }}><Archive size={20} color="#ef4444" /></div>
          <div className="kpi-info">
            <span className="kpi-value">{stats.outOfStockCount}</span>
            <span className="kpi-label">Rupture</span>
          </div>
        </div>
      </div>

      {/* Mouvements récents (30j) */}
      {stats.recentMovements?.length > 0 && (
        <div className="stock-dashboard-section">
          <h3>📊 Activité (30 derniers jours)</h3>
          <div className="stock-activity-grid">
            {stats.recentMovements.map(m => {
              const mt = MOVEMENT_TYPES[m.type];
              return (
                <div key={m.type} className="stock-activity-card" style={{ borderLeftColor: mt?.color }}>
                  <span className="activity-type">{mt?.icon} {mt?.label || m.type}</span>
                  <span className="activity-count">{m.count} mouvement(s)</span>
                  <span className="activity-qty">Σ {m.total_qty}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alertes stock bas */}
      {stats.lowStockItems?.length > 0 && (
        <div className="stock-dashboard-section">
          <h3>⚠️ Alertes stock bas</h3>
          <div className="stock-alerts-list">
            {stats.lowStockItems.map(item => {
              const pct = item.min_quantity > 0 ? Math.round((item.quantity / item.min_quantity) * 100) : 0;
              return (
                <div key={item.id} className="stock-alert-item" onClick={() => onSelectItem(item)}>
                  <div className="alert-item-info">
                    <span className="alert-item-name">{item.name}</span>
                    <span className="alert-item-ref">{item.reference}</span>
                  </div>
                  <div className="alert-item-qty">
                    <div className="alert-bar-bg">
                      <div
                        className={`alert-bar-fill ${pct <= 25 ? 'critical' : pct <= 50 ? 'warning' : 'ok'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className={`alert-qty-text ${item.quantity === 0 ? 'rupture' : ''}`}>
                      {item.quantity} / {item.min_quantity} {item.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top articles les plus mouvementés */}
      {stats.topMovedItems?.length > 0 && (
        <div className="stock-dashboard-section">
          <h3>🔥 Articles les plus mouvementés</h3>
          <div className="stock-top-items">
            {stats.topMovedItems.map((item, i) => (
              <div key={item.id} className="stock-top-item" onClick={() => onSelectItem(item)}>
                <span className="top-rank">#{i + 1}</span>
                <span className="top-name">{item.name}</span>
                <span className="top-ref">{item.reference}</span>
                <span className="top-count">{item.movement_count} mvt</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Liste des Articles
// ═══════════════════════════════════════════════════════════════
function ItemsListView({ items, categories, searchTerm, onSearchChange, categoryFilter, onCategoryChange, lowStockFilter, onLowStockChange, onSelect, onAdd, isAdmin }) {
  return (
    <div className="stock-items-view">
      {/* Toolbar */}
      <div className="stock-toolbar">
        <div className="stock-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Rechercher un article..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="stock-filters">
          <select value={categoryFilter} onChange={(e) => onCategoryChange(e.target.value)}>
            <option value="">Toutes catégories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          <button
            className={`stock-filter-btn ${lowStockFilter ? 'active' : ''}`}
            onClick={() => onLowStockChange(!lowStockFilter)}
            title="Afficher uniquement les stocks bas"
          >
            <AlertTriangle size={14} />
            Stock bas
          </button>
        </div>
        <button className="stock-add-btn" onClick={onAdd}>
          <Plus size={16} />
          <span>Nouvel article</span>
        </button>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="stock-empty">
          <Package size={48} />
          <p>Aucun article trouvé</p>
          <button className="stock-add-btn" onClick={onAdd}>
            <Plus size={16} /> Créer un article
          </button>
        </div>
      ) : (
        <div className="stock-table-container">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Réf.</th>
                <th>Article</th>
                <th>Catégorie</th>
                <th>Stock</th>
                <th>Unité</th>
                <th>P.U. Achat</th>
                <th>P.U. Vente</th>
                <th>Emplacement</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const isLow = item.min_quantity > 0 && item.quantity <= item.min_quantity;
                const isOut = item.quantity === 0;
                return (
                  <tr
                    key={item.id}
                    className={`stock-row ${isOut ? 'out-of-stock' : isLow ? 'low-stock' : ''}`}
                    onClick={() => onSelect(item)}
                  >
                    <td className="stock-ref">{item.reference}</td>
                    <td className="stock-name">
                      <span>{item.name}</span>
                      {item.description && <small>{item.description.substring(0, 40)}</small>}
                    </td>
                    <td>
                      {item.category_name ? (
                        <span className="stock-cat-badge" style={{ background: item.category_color + '20', color: item.category_color, borderColor: item.category_color }}>
                          {item.category_icon} {item.category_name}
                        </span>
                      ) : '—'}
                    </td>
                    <td className={`stock-qty ${isOut ? 'rupture' : isLow ? 'low' : ''}`}>
                      {item.quantity}
                      {isLow && !isOut && <AlertTriangle size={12} className="qty-warn-icon" />}
                      {isOut && <X size={12} className="qty-out-icon" />}
                    </td>
                    <td>{item.unit}</td>
                    <td>{formatCurrency(item.unit_price)}</td>
                    <td>{formatCurrency(item.sell_price)}</td>
                    <td className="stock-location">{item.location || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="stock-footer-info">
        {items.length} article(s) — Valeur totale : {formatCurrency(items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Détail d'un article
// ═══════════════════════════════════════════════════════════════
function ItemDetailView({ item, movements, onBack, onEdit, onDelete, onMovement, loadMovements, isAdmin }) {
  useEffect(() => {
    loadMovements(item.id);
  }, [item.id, loadMovements]);

  const isLow = item.min_quantity > 0 && item.quantity <= item.min_quantity;
  const isOut = item.quantity === 0;

  return (
    <div className="stock-detail">
      <div className="stock-detail-header">
        <button className="stock-back-btn" onClick={onBack}>
          <ArrowLeft size={18} /> Retour
        </button>
        <div className="stock-detail-actions">
          <button className="stock-movement-btn" onClick={onMovement}>
            <TrendingUp size={16} /> Mouvement
          </button>
          <button className="stock-edit-btn" onClick={onEdit}>
            <Edit2 size={16} /> Modifier
          </button>
          {isAdmin && (
            <button className="stock-delete-btn" onClick={onDelete}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="stock-detail-body">
        {/* Infos principales */}
        <div className="stock-detail-card">
          <div className="stock-detail-title">
            <h3>{item.name}</h3>
            <span className="stock-detail-ref">{item.reference}</span>
          </div>

          {item.description && <p className="stock-detail-desc">{item.description}</p>}

          <div className="stock-detail-grid">
            <div className="stock-detail-field">
              <label><Tag size={14} /> Catégorie</label>
              <span>
                {item.category_name ? (
                  <span className="stock-cat-badge" style={{ background: item.category_color + '20', color: item.category_color, borderColor: item.category_color }}>
                    {item.category_icon} {item.category_name}
                  </span>
                ) : '—'}
              </span>
            </div>
            <div className="stock-detail-field">
              <label><Package size={14} /> Quantité</label>
              <span className={`stock-qty-big ${isOut ? 'rupture' : isLow ? 'low' : 'ok'}`}>
                {item.quantity} {item.unit}
                {isLow && !isOut && <span className="qty-badge warning">Stock bas</span>}
                {isOut && <span className="qty-badge danger">Rupture</span>}
              </span>
            </div>
            <div className="stock-detail-field">
              <label><AlertTriangle size={14} /> Seuil alerte</label>
              <span>{item.min_quantity > 0 ? `${item.min_quantity} ${item.unit}` : 'Non défini'}</span>
            </div>
            <div className="stock-detail-field">
              <label><Euro size={14} /> P.U. Achat</label>
              <span>{formatCurrency(item.unit_price)}</span>
            </div>
            <div className="stock-detail-field">
              <label><Euro size={14} /> P.U. Vente</label>
              <span>{formatCurrency(item.sell_price)}</span>
            </div>
            <div className="stock-detail-field">
              <label><Euro size={14} /> Valeur stock</label>
              <span className="stock-value-total">{formatCurrency(item.quantity * item.unit_price)}</span>
            </div>
            <div className="stock-detail-field">
              <label><MapPin size={14} /> Emplacement</label>
              <span>{item.location || '—'}</span>
            </div>
            <div className="stock-detail-field">
              <label><Hash size={14} /> Fournisseur</label>
              <span>{item.supplier_name || '—'}</span>
            </div>
          </div>

          {item.notes && (
            <div className="stock-detail-notes">
              <label>Notes</label>
              <p>{item.notes}</p>
            </div>
          )}
        </div>

        {/* Historique des mouvements */}
        <div className="stock-detail-card">
          <h4><TrendingUp size={16} /> Historique des mouvements</h4>
          {movements.length === 0 ? (
            <p className="stock-empty-text">Aucun mouvement enregistré</p>
          ) : (
            <div className="stock-movements-list">
              {movements.map(m => {
                const mt = MOVEMENT_TYPES[m.type] || {};
                return (
                  <div key={m.id} className="stock-movement-row">
                    <span className="movement-icon" style={{ color: mt.color }}>{mt.icon}</span>
                    <div className="movement-info">
                      <span className="movement-type" style={{ color: mt.color }}>{mt.label}</span>
                      <span className="movement-reason">{m.reason || '—'}</span>
                    </div>
                    <div className="movement-qty-change">
                      <span>{m.previous_quantity}</span>
                      <span className="movement-arrow">→</span>
                      <span className="movement-new-qty">{m.new_quantity}</span>
                      <span className={`movement-diff ${m.type === 'out' ? 'negative' : 'positive'}`}>
                        {m.type === 'out' ? '-' : '+'}{m.quantity}
                      </span>
                    </div>
                    <div className="movement-meta">
                      <span className="movement-user">{m.user_name || '—'}</span>
                      <span className="movement-date">{formatDate(m.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Vue Mouvements globaux
// ═══════════════════════════════════════════════════════════════
function MovementsView({ movements, items, onAddMovement, onRefresh }) {
  const [typeFilter, setTypeFilter] = useState('');

  const filtered = useMemo(() => {
    if (!typeFilter) return movements;
    return movements.filter(m => m.type === typeFilter);
  }, [movements, typeFilter]);

  return (
    <div className="stock-movements-view">
      <div className="stock-toolbar">
        <div className="stock-filters">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Tous types</option>
            {Object.entries(MOVEMENT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
        </div>
        <button className="stock-add-btn" onClick={onAddMovement}>
          <Plus size={16} /> Nouveau mouvement
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="stock-empty">
          <TrendingUp size={48} />
          <p>Aucun mouvement enregistré</p>
        </div>
      ) : (
        <div className="stock-table-container">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Article</th>
                <th>Quantité</th>
                <th>Avant → Après</th>
                <th>Motif</th>
                <th>Utilisateur</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const mt = MOVEMENT_TYPES[m.type] || {};
                return (
                  <tr key={m.id}>
                    <td>{formatDate(m.created_at)}</td>
                    <td>
                      <span className="movement-type-badge" style={{ background: mt.color + '20', color: mt.color }}>
                        {mt.icon} {mt.label}
                      </span>
                    </td>
                    <td>
                      <div className="movement-item-info">
                        <span>{m.item_name}</span>
                        <small>{m.item_reference}</small>
                      </div>
                    </td>
                    <td className={`movement-qty ${m.type === 'out' ? 'negative' : 'positive'}`}>
                      {m.type === 'out' ? '-' : '+'}{m.quantity} {m.item_unit}
                    </td>
                    <td className="movement-change">
                      {m.previous_quantity} → {m.new_quantity}
                    </td>
                    <td>{m.reason || '—'}</td>
                    <td>{m.user_name || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Vue Catégories
// ═══════════════════════════════════════════════════════════════
function CategoriesView({ categories, onAdd, onEdit, onDelete, isAdmin }) {
  return (
    <div className="stock-categories-view">
      <div className="stock-toolbar">
        <h3><Layers size={18} /> Catégories ({categories.length})</h3>
        {isAdmin && (
          <button className="stock-add-btn" onClick={onAdd}>
            <Plus size={16} /> Nouvelle catégorie
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="stock-empty">
          <Layers size={48} />
          <p>Aucune catégorie créée</p>
          {isAdmin && (
            <button className="stock-add-btn" onClick={onAdd}><Plus size={16} /> Créer</button>
          )}
        </div>
      ) : (
        <div className="stock-categories-grid">
          {categories.map(cat => (
            <div key={cat.id} className="stock-category-card" style={{ borderLeftColor: cat.color }}>
              <div className="cat-card-header">
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-name">{cat.name}</span>
                <span className="cat-count">{cat.item_count} article(s)</span>
              </div>
              {cat.description && <p className="cat-desc">{cat.description}</p>}
              {cat.parent_name && <span className="cat-parent">↳ {cat.parent_name}</span>}
              {isAdmin && (
                <div className="cat-actions">
                  <button onClick={() => onEdit(cat)} title="Modifier"><Edit2 size={14} /></button>
                  <button onClick={() => onDelete(cat)} title="Supprimer" disabled={cat.item_count > 0}><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Modal Formulaire Article
// ═══════════════════════════════════════════════════════════════
function ItemFormModal({ item, categories, suppliers, onSave, onClose }) {
  const [form, setForm] = useState({
    reference: item?.reference || '',
    name: item?.name || '',
    description: item?.description || '',
    category_id: item?.category_id || '',
    unit: item?.unit || 'u',
    unit_price: item?.unit_price || 0,
    sell_price: item?.sell_price || 0,
    quantity: item?.quantity || 0,
    min_quantity: item?.min_quantity || 0,
    location: item?.location || '',
    supplier_id: item?.supplier_id || '',
    notes: item?.notes || '',
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert('Le nom est requis');
    onSave({
      ...form,
      unit_price: Number(form.unit_price) || 0,
      sell_price: Number(form.sell_price) || 0,
      quantity: Number(form.quantity) || 0,
      min_quantity: Number(form.min_quantity) || 0,
      category_id: form.category_id || null,
      supplier_id: form.supplier_id || null,
    });
  };

  return (
    <div className="stock-modal-overlay" onClick={onClose}>
      <div className="stock-modal" onClick={e => e.stopPropagation()}>
        <div className="stock-modal-header">
          <h3>{item ? 'Modifier l\'article' : 'Nouvel article'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="stock-modal-form">
          <div className="stock-form-row">
            <div className="stock-form-field">
              <label>Référence</label>
              <input type="text" value={form.reference} onChange={(e) => handleChange('reference', e.target.value)} placeholder="Auto-généré si vide" />
            </div>
            <div className="stock-form-field full">
              <label>Nom *</label>
              <input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)} required />
            </div>
          </div>
          <div className="stock-form-field">
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} rows={2} />
          </div>
          <div className="stock-form-row">
            <div className="stock-form-field">
              <label>Catégorie</label>
              <select value={form.category_id} onChange={(e) => handleChange('category_id', e.target.value)}>
                <option value="">— Aucune —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div className="stock-form-field">
              <label>Unité</label>
              <select value={form.unit} onChange={(e) => handleChange('unit', e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="stock-form-field">
              <label>Fournisseur</label>
              <select value={form.supplier_id} onChange={(e) => handleChange('supplier_id', e.target.value)}>
                <option value="">— Aucun —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="stock-form-row">
            <div className="stock-form-field">
              <label>P.U. Achat (€)</label>
              <input type="number" step="0.01" min="0" value={form.unit_price} onChange={(e) => handleChange('unit_price', e.target.value)} />
            </div>
            <div className="stock-form-field">
              <label>P.U. Vente (€)</label>
              <input type="number" step="0.01" min="0" value={form.sell_price} onChange={(e) => handleChange('sell_price', e.target.value)} />
            </div>
            <div className="stock-form-field">
              <label>Quantité</label>
              <input type="number" step="0.01" min="0" value={form.quantity} onChange={(e) => handleChange('quantity', e.target.value)} />
            </div>
            <div className="stock-form-field">
              <label>Seuil alerte</label>
              <input type="number" step="0.01" min="0" value={form.min_quantity} onChange={(e) => handleChange('min_quantity', e.target.value)} />
            </div>
          </div>
          <div className="stock-form-field">
            <label>Emplacement</label>
            <input type="text" value={form.location} onChange={(e) => handleChange('location', e.target.value)} placeholder="ex: Étagère A3, Atelier B..." />
          </div>
          <div className="stock-form-field">
            <label>Notes</label>
            <textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={2} />
          </div>
          <div className="stock-modal-actions">
            <button type="button" onClick={onClose} className="stock-btn-cancel">Annuler</button>
            <button type="submit" className="stock-btn-save"><Check size={16} /> {item ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Modal Formulaire Catégorie
// ═══════════════════════════════════════════════════════════════
function CategoryFormModal({ category, categories, onSave, onClose }) {
  const [form, setForm] = useState({
    name: category?.name || '',
    description: category?.description || '',
    parent_id: category?.parent_id || '',
    color: category?.color || CATEGORY_COLORS[0],
    icon: category?.icon || '📦',
  });

  const parentOptions = categories.filter(c => c.id !== category?.id);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert('Le nom est requis');
    onSave({ ...form, parent_id: form.parent_id || null });
  };

  return (
    <div className="stock-modal-overlay" onClick={onClose}>
      <div className="stock-modal stock-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="stock-modal-header">
          <h3>{category ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="stock-modal-form">
          <div className="stock-form-field">
            <label>Nom *</label>
            <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="stock-form-field">
            <label>Description</label>
            <input type="text" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="stock-form-field">
            <label>Parent</label>
            <select value={form.parent_id} onChange={(e) => setForm(f => ({ ...f, parent_id: e.target.value }))}>
              <option value="">— Aucun (racine) —</option>
              {parentOptions.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="stock-form-field">
            <label>Icône</label>
            <div className="stock-icon-picker">
              {CATEGORY_ICONS.map(icon => (
                <button
                  key={icon}
                  type="button"
                  className={`icon-pick ${form.icon === icon ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, icon }))}
                >{icon}</button>
              ))}
            </div>
          </div>
          <div className="stock-form-field">
            <label>Couleur</label>
            <div className="stock-color-picker">
              {CATEGORY_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`color-pick ${form.color === color ? 'active' : ''}`}
                  style={{ background: color }}
                  onClick={() => setForm(f => ({ ...f, color }))}
                />
              ))}
            </div>
          </div>
          <div className="stock-modal-actions">
            <button type="button" onClick={onClose} className="stock-btn-cancel">Annuler</button>
            <button type="submit" className="stock-btn-save"><Check size={16} /> {category ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Modal Formulaire Mouvement
// ═══════════════════════════════════════════════════════════════
function MovementFormModal({ items, preselectedItem, onSave, onClose }) {
  const [form, setForm] = useState({
    stock_item_id: preselectedItem?.id || '',
    type: 'in',
    quantity: '',
    reason: '',
    reference: '',
  });

  const selectedItem = items.find(i => i.id === Number(form.stock_item_id));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.stock_item_id || !form.quantity) return alert('Article et quantité sont requis');
    onSave({
      ...form,
      stock_item_id: Number(form.stock_item_id),
      quantity: Number(form.quantity),
    });
  };

  return (
    <div className="stock-modal-overlay" onClick={onClose}>
      <div className="stock-modal stock-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="stock-modal-header">
          <h3>Nouveau mouvement</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="stock-modal-form">
          <div className="stock-form-field">
            <label>Article *</label>
            <select
              value={form.stock_item_id}
              onChange={(e) => setForm(f => ({ ...f, stock_item_id: e.target.value }))}
              required
            >
              <option value="">— Sélectionner —</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  [{item.reference}] {item.name} (stock: {item.quantity} {item.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="stock-form-field">
            <label>Type de mouvement</label>
            <div className="stock-movement-types">
              {Object.entries(MOVEMENT_TYPES).map(([key, mt]) => (
                <button
                  key={key}
                  type="button"
                  className={`movement-type-btn ${form.type === key ? 'active' : ''}`}
                  style={{ '--mt-color': mt.color }}
                  onClick={() => setForm(f => ({ ...f, type: key }))}
                >
                  {mt.icon} {mt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="stock-form-row">
            <div className="stock-form-field">
              <label>Quantité *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.quantity}
                onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))}
                required
              />
            </div>
            {selectedItem && (
              <div className="stock-form-field">
                <label>Stock actuel</label>
                <div className="stock-current-qty">
                  {selectedItem.quantity} {selectedItem.unit}
                  {form.quantity && (
                    <span className="stock-preview-qty">
                      → {form.type === 'in' || form.type === 'return'
                        ? selectedItem.quantity + Number(form.quantity)
                        : form.type === 'out'
                          ? Math.max(0, selectedItem.quantity - Number(form.quantity))
                          : Number(form.quantity)
                      } {selectedItem.unit}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="stock-form-field">
            <label>Motif / Raison</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="ex: Livraison fournisseur, Prêt chantier, Inventaire..."
            />
          </div>
          <div className="stock-form-field">
            <label>Référence (BL, facture...)</label>
            <input
              type="text"
              value={form.reference}
              onChange={(e) => setForm(f => ({ ...f, reference: e.target.value }))}
              placeholder="ex: BL-2024-0045"
            />
          </div>
          <div className="stock-modal-actions">
            <button type="button" onClick={onClose} className="stock-btn-cancel">Annuler</button>
            <button type="submit" className="stock-btn-save"><Check size={16} /> Valider</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StockPanel;
