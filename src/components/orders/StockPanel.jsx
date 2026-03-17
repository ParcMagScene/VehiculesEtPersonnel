import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, Search, Plus, Edit2, Trash2, ArrowLeft, Filter,
  TrendingUp, TrendingDown, AlertTriangle, BarChart3, ArrowUpCircle, ArrowDownCircle,
  RotateCcw, Layers, Tag, MapPin, Euro, Hash, X, Check, ChevronDown,
  Archive, Eye, FolderOpen, Upload, FileText, AlertCircle } from 'lucide-react';
import api from '../../utils/api';
import { formatCurrency, formatDateTime as formatDate, formatDateSimple as formatDateShort } from '../../utils/formatUtils';
import ConfirmDialog from '../ConfirmDialog';
import './StockPanel.css';
import { useToast } from '../../hooks/useToast';
import EntityCombobox from '../ui/EntityCombobox';
import { extractTextFromPDF } from '../../utils/pdfParser';

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

// ═══ Composant Principal ═══
function StockPanel({ currentUser }) {
  const toast = useToast();
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
  const [showImport, setShowImport] = useState(false);

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
      toast.error('Erreur: ' + error.message);
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
        } catch (error) { toast.error('Erreur: ' + error.message); }
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
      toast.error('Erreur: ' + error.message);
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
        } catch (error) { toast.error('Erreur: ' + error.message); }
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
      toast.error('Erreur: ' + error.message);
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
      {/* Header — unified tabs + stats */}
      <div className="stock-header">
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
        {stats && (
          <div className="stock-header-stats">
            <span className="stat-badge"><Package size={14} /> {stats.totalItems || 0} articles</span>
            {stats.lowStockCount > 0 && <span className="stat-badge warning"><AlertTriangle size={14} /> {stats.lowStockCount} stock bas</span>}
          </div>
        )}
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
                onImport={() => setShowImport(true)}
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
      {showImport && (
        <ImportStockModal
          onDone={() => { setShowImport(false); loadData(); }}
          onClose={() => setShowImport(false)}
        />
      )}
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
          <div className="kpi-icon" style={{ background: 'var(--theme-info-bg-strong)' }}><Package size={20} color="#3b82f6" /></div>
          <div className="kpi-info">
            <span className="kpi-value">{stats.totalItems}</span>
            <span className="kpi-label">Articles actifs</span>
          </div>
        </div>
        <div className="stock-kpi">
          <div className="kpi-icon" style={{ background: 'var(--theme-success-bg-strong)' }}><Euro size={20} color="#10b981" /></div>
          <div className="kpi-info">
            <span className="kpi-value">{formatCurrency(stats.totalValue)}</span>
            <span className="kpi-label">Valeur du stock</span>
          </div>
        </div>
        <div className="stock-kpi warning">
          <div className="kpi-icon" style={{ background: 'var(--btn-warning-bg)' }}><AlertTriangle size={20} color="#f59e0b" /></div>
          <div className="kpi-info">
            <span className="kpi-value">{stats.lowStockCount}</span>
            <span className="kpi-label">Stock bas</span>
          </div>
        </div>
        <div className="stock-kpi danger">
          <div className="kpi-icon" style={{ background: 'var(--btn-danger-bg)' }}><Archive size={20} color="#ef4444" /></div>
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
function ItemsListView({ items, categories, searchTerm, onSearchChange, categoryFilter, onCategoryChange, lowStockFilter, onLowStockChange, onSelect, onAdd, onImport, isAdmin }) {
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
          <EntityCombobox
            value={categoryFilter}
            onChange={val => onCategoryChange(val)}
            options={categories.map(c => ({ id: c.id, name: `${c.icon} ${c.name}` }))}
            placeholder="Toutes catégories"
            allowClear
          />
          <button
            className={`stock-filter-btn ${lowStockFilter ? 'active' : ''}`}
            onClick={() => onLowStockChange(!lowStockFilter)}
            title="Afficher uniquement les stocks bas"
          >
            <AlertTriangle size={14} />
            Stock bas
          </button>
        </div>
        <button className="stock-add-btn" onClick={onImport} title="Importer un inventaire CSV">
          <Upload size={16} />
          <span>Importer</span>
        </button>
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
                <th>Valeur</th>
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
                        <span className="stock-cat-badge" style={item.category_color ? { background: item.category_color + '20', color: item.category_color, borderColor: item.category_color } : undefined}>
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
                    <td className="stock-value">{formatCurrency(item.quantity * (item.unit_price || 0))}</td>
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
                  <span className="stock-cat-badge" style={item.category_color ? { background: item.category_color + '20', color: item.category_color, borderColor: item.category_color } : undefined}>
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
    if (!form.name.trim()) return toast.warning('Le nom est requis');
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
    <div className="stock-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
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
              <EntityCombobox
                value={form.category_id}
                onChange={val => handleChange('category_id', val)}
                options={categories.map(c => ({ id: c.id, name: `${c.icon} ${c.name}` }))}
                placeholder="— Aucune —"
              />
            </div>
            <div className="stock-form-field">
              <label>Unité</label>
              <select value={form.unit} onChange={(e) => handleChange('unit', e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="stock-form-field">
              <label>Fournisseur</label>
              <EntityCombobox
                value={form.supplier_id}
                onChange={val => handleChange('supplier_id', val)}
                options={suppliers}
                placeholder="— Aucun —"
              />
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
    if (!form.name.trim()) return toast.warning('Le nom est requis');
    onSave({ ...form, parent_id: form.parent_id || null });
  };

  return (
    <div className="stock-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
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
            <EntityCombobox
              value={form.parent_id}
              onChange={val => setForm(f => ({ ...f, parent_id: val }))}
              options={parentOptions.map(c => ({ id: c.id, name: `${c.icon} ${c.name}` }))}
              placeholder="— Aucun (racine) —"
            />
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
    if (!form.stock_item_id || !form.quantity) return toast.warning('Article et quantité sont requis');
    onSave({
      ...form,
      stock_item_id: Number(form.stock_item_id),
      quantity: Number(form.quantity),
    });
  };

  return (
    <div className="stock-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
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

// ═══════════════════════════════════════════════════════════════
// Modal Import Stock (CSV / inventaire)
// ═══════════════════════════════════════════════════════════════

function parseInventoryCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  // Try to detect separator (tab, semicolon, comma)
  const firstDataLine = lines.find(l => /\d/.test(l) && !/^(Rapport|Inventaire|Résumé|Synthèse|Catégorie|Emplacement|Fournisseur|TOTAL|Page|Détail|Référence)/i.test(l));
  const sep = firstDataLine?.includes('\t') ? '\t' : firstDataLine?.includes(';') ? ';' : ',';

  // Find header line
  let headerIdx = lines.findIndex(l => {
    const lower = l.toLowerCase();
    return (lower.includes('référence') || lower.includes('reference') || lower.includes('ref'))
      && (lower.includes('nom') || lower.includes('désignation') || lower.includes('designation') || lower.includes('article'));
  });

  if (headerIdx === -1) {
    // No header found — try raw data parsing (each field separated)
    // Fallback: treat each line as: reference, name, description, category, location, quantity, unit_price, total
    for (const line of lines) {
      const cols = line.split(sep).map(c => c.trim());
      if (cols.length >= 6) {
        const qty = parseFloat(cols[cols.length - 3]?.replace(/\s/g, '').replace(',', '.'));
        const val = parseFloat(cols[cols.length - 2]?.replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(qty)) {
          items.push({
            reference: cols[0] || '',
            name: cols[1] || '',
            description: cols[2] || '',
            category_name: cols[3] || '',
            location: cols[4] || '',
            quantity: qty,
            unit_price: isNaN(val) ? 0 : val,
          });
        }
      }
    }
    return items;
  }

  const headers = lines[headerIdx].split(sep).map(h => h.trim().toLowerCase());
  const colIdx = {
    ref: headers.findIndex(h => /^(r[ée]f|reference)/.test(h)),
    name: headers.findIndex(h => /^(nom|d[ée]signation|article)/.test(h)),
    desc: headers.findIndex(h => /^desc/.test(h)),
    cat: headers.findIndex(h => /^cat[ée]gorie/.test(h)),
    loc: headers.findIndex(h => /^(emplacement|lieu|location)/.test(h)),
    qty: headers.findIndex(h => /^(quanti|qty|qté|stock)/.test(h)),
    price: headers.findIndex(h => /^(valeur|prix|p\.?u|unit)/.test(h)),
    total: headers.findIndex(h => /^total/.test(h)),
  };

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^(Page|TOTAL|Synthèse)/i.test(line)) continue;
    const cols = line.split(sep).map(c => c.trim());
    if (cols.length < 3) continue;

    const get = (idx) => idx >= 0 && idx < cols.length ? cols[idx] : '';
    const getNum = (idx) => {
      const v = get(idx).replace(/\s/g, '').replace(',', '.');
      return parseFloat(v) || 0;
    };

    const name = get(colIdx.name);
    if (!name) continue;

    items.push({
      reference: get(colIdx.ref),
      name,
      description: get(colIdx.desc),
      category_name: get(colIdx.cat),
      location: get(colIdx.loc),
      quantity: getNum(colIdx.qty),
      unit_price: getNum(colIdx.price),
    });
  }

  return items;
}

// ═══ Parser PDF — Format "Rapport d'Inventaire" (extractTextFromPDF → lignes) ═══
function parseInventoryPDF(text) {
  const lines = text.split(/\r?\n/);
  const items = [];

  // Catégories connues dans le PDF (avec formes tronquées)
  const CATEGORIES = [
    'Batteries', 'Connecteurs', 'Consommables divers', 'Consommables d',
    'Câbles', 'DICJONTEUR', 'ELEC', 'Filtres',
    'Gaffer & Adhésifs', 'Gaffer & Adhés',
    'Lampes', 'Mousse & Protection', 'Mousse & Prote',
    'Mécanique', 'SON', 'STRUCTURE', 'Sans catégorie', 'Électronique',
  ];
  const LOCATIONS = ['Atelier', 'Sans emplacement', 'Stock Pièces', 'Stock Vente'];
  const SKIP_RE = /^(Rapport|Inventaire|Résumé|Synthèse|Catégorie\s|Référence\s|Détail|Page\s+\d|\d+\s+articles$)/i;

  const restoreCat = (raw) => {
    const n = raw.replace(/…$/, '').trim();
    const MAP = { 'Consommables d': 'Consommables divers', 'Gaffer & Adhés': 'Gaffer & Adhésifs', 'Mousse & Prote': 'Mousse & Protection' };
    return MAP[n] || n;
  };
  const parseNum = (s) => parseFloat((s || '').replace(/\s/g, '').replace(',', '.'));

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || SKIP_RE.test(line)) continue;

    // Split sur 2+ espaces = colonnes
    const cols = line.split(/\s{2,}/).map(c => c.trim()).filter(Boolean);
    if (cols.length < 4) continue;

    // Les 3 dernières colonnes = total, valeur, quantité
    const qty = parseNum(cols[cols.length - 3]);
    const value = parseNum(cols[cols.length - 2]);
    if (isNaN(qty)) continue;

    let idx = cols.length - 4;

    // Emplacement (optionnel)
    let location = '';
    if (idx >= 0 && LOCATIONS.some(l => cols[idx].startsWith(l))) {
      location = cols[idx];
      idx--;
    }

    // Catégorie (optionnelle)
    let category_name = '';
    if (idx >= 0) {
      const cleaned = cols[idx].replace(/…$/, '').trim();
      if (CATEGORIES.some(c => cleaned === c || cleaned.startsWith(c))) {
        category_name = restoreCat(cols[idx]);
        idx--;
      }
    }

    // Le reste = référence, nom, description
    const remaining = cols.slice(0, idx + 1);
    let reference = '', name = '', description = '';
    if (remaining.length >= 3) {
      reference = remaining[0];
      name = remaining[1];
      description = remaining.slice(2).join(' ').replace(/…$/, '').trim();
    } else if (remaining.length === 2) {
      reference = remaining[0];
      name = remaining[1];
    } else if (remaining.length === 1) {
      name = remaining[0];
    }
    if (!name && !reference) continue;

    items.push({
      reference,
      name: name || reference,
      description,
      category_name,
      location,
      quantity: isNaN(qty) ? 0 : qty,
      unit_price: isNaN(value) ? 0 : value,
    });
  }
  return items;
}

function ImportStockModal({ onDone, onClose }) {
  const toast = useToast();
  const [step, setStep] = useState('select'); // select | preview | importing
  const [file, setFile] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [parsedItems, setParsedItems] = useState([]);
  const [error, setError] = useState('');
  const [importMode, setImportMode] = useState('upsert'); // upsert | insert_only
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setPasteText(''); }
  };

  const isPDF = file?.name?.toLowerCase().endsWith('.pdf');

  const handleParse = async () => {
    setError('');
    let items = [];

    if (file && isPDF) {
      try {
        const text = await extractTextFromPDF(file);
        items = parseInventoryPDF(text);
      } catch (e) {
        setError('Impossible de lire le PDF: ' + e.message);
        return;
      }
    } else if (file) {
      try {
        const text = await file.text();
        items = parseInventoryCSV(text);
      } catch (e) {
        setError('Impossible de lire le fichier: ' + e.message);
        return;
      }
    } else if (pasteText.trim()) {
      items = parseInventoryCSV(pasteText);
    } else {
      setError('Sélectionnez un fichier (PDF ou CSV) ou collez les données');
      return;
    }

    if (items.length === 0) {
      setError('Aucun article détecté. Vérifiez le format du fichier.');
      return;
    }
    setParsedItems(items);
    setStep('preview');
  };

  const handleImport = async () => {
    if (parsedItems.length === 0) return;
    setStep('importing');
    try {
      const res = await api.importStockItems({
        items: parsedItems,
        mode: importMode,
      });
      setResult(res);
      toast.success(`Import terminé : ${res.inserted} créés, ${res.updated} mis à jour, ${res.skipped} ignorés`);
      onDone();
    } catch (e) {
      setError('Erreur import: ' + (e.message || 'erreur serveur'));
      setStep('preview');
    }
  };

  // Compteurs par catégorie
  const catCounts = useMemo(() => {
    const map = {};
    for (const item of parsedItems) {
      const cat = item.category_name || 'Sans catégorie';
      map[cat] = (map[cat] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [parsedItems]);

  const totalQty = useMemo(() => parsedItems.reduce((s, i) => s + (i.quantity || 0), 0), [parsedItems]);
  const totalValue = useMemo(
    () => parsedItems.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0),
    [parsedItems]
  );

  return (
    <div className="stock-modal-overlay" onMouseDown={e => e.target === e.currentTarget && step !== 'importing' && onClose()}>
      <div className="stock-modal stock-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="stock-modal-header">
          <h3><Upload size={20} /> Importer un inventaire</h3>
          {step !== 'importing' && <button onClick={onClose}><X size={20} /></button>}
        </div>

        <div className="stock-modal-body" style={{ maxHeight: '70vh', overflow: 'auto' }}>
          {error && (
            <div className="stock-import-error">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* STEP: SELECT */}
          {step === 'select' && (
            <>
              <p className="stock-import-hint">
                Importez un <strong>PDF</strong> (Rapport d'Inventaire) ou un <strong>CSV</strong> (colonnes&nbsp;: Référence, Nom, Description, Catégorie, Emplacement, Quantité, Valeur).
              </p>

              <div className="stock-form-field">
                <label>Fichier PDF ou CSV</label>
                <input
                  type="file"
                  accept=".pdf,.csv,.tsv,.txt"
                  onChange={handleFileChange}
                />
                {file && <small>{file.name} — {(file.size / 1024).toFixed(1)} Ko</small>}
              </div>

              {!isPDF && (
                <div className="stock-form-field">
                  <label>Ou coller les données (CSV)</label>
                  <textarea
                    rows={8}
                    value={pasteText}
                    onChange={e => { setPasteText(e.target.value); setFile(null); }}
                    placeholder={"Référence\tNom\tDescription\tCatégorie\tEmplacement\tQuantité\tValeur\n62006042\t360 MAC AURA\t\tÉlectronique\tStock Pièces\t3\t59.17"}
                    style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                  />
                </div>
              )}

              <div className="stock-form-field">
                <label>Mode d'import</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input type="radio" name="importMode" value="upsert" checked={importMode === 'upsert'} onChange={() => setImportMode('upsert')} />
                    Créer + mettre à jour
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input type="radio" name="importMode" value="insert_only" checked={importMode === 'insert_only'} onChange={() => setImportMode('insert_only')} />
                    Créer uniquement (ignorer les existants)
                  </label>
                </div>
              </div>
            </>
          )}

          {/* STEP: PREVIEW */}
          {step === 'preview' && parsedItems.length > 0 && (
            <>
              <div className="stock-import-stats">
                <div className="stock-import-stat">
                  <strong>{parsedItems.length}</strong>
                  <span>articles</span>
                </div>
                <div className="stock-import-stat">
                  <strong>{totalQty.toLocaleString('fr-FR')}</strong>
                  <span>quantité totale</span>
                </div>
                <div className="stock-import-stat">
                  <strong>{totalValue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</strong>
                  <span>valeur estimée</span>
                </div>
                <div className="stock-import-stat">
                  <strong>{catCounts.length}</strong>
                  <span>catégories</span>
                </div>
              </div>

              {/* Catégories détectées */}
              <div className="stock-import-cats">
                <h4>Catégories détectées :</h4>
                <div className="stock-import-cat-list">
                  {catCounts.map(([cat, count]) => (
                    <span key={cat} className="stock-import-cat-badge">
                      {cat} <em>({count})</em>
                    </span>
                  ))}
                </div>
              </div>

              {/* Aperçu */}
              <div className="stock-import-preview">
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>Réf.</th>
                      <th>Nom</th>
                      <th>Catégorie</th>
                      <th>Emplacement</th>
                      <th style={{ textAlign: 'right' }}>Qté</th>
                      <th style={{ textAlign: 'right' }}>Valeur unit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedItems.slice(0, 30).map((item, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{item.reference || '—'}</td>
                        <td>{item.name}</td>
                        <td>{item.category_name || '—'}</td>
                        <td>{item.location || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right' }}>
                          {item.unit_price ? item.unit_price.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedItems.length > 30 && (
                  <p className="stock-import-hint" style={{ textAlign: 'center', marginTop: 8 }}>
                    …et {parsedItems.length - 30} autres articles
                  </p>
                )}
              </div>
            </>
          )}

          {/* STEP: IMPORTING */}
          {step === 'importing' && (
            <div className="stock-import-loading">
              <div className="loading-spinner" />
              <p>Import de {parsedItems.length} articles en cours…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'select' && (
          <div className="stock-modal-actions" style={{ padding: '12px 20px', borderTop: '1px solid var(--theme-border)' }}>
            <button className="stock-btn-cancel" onClick={onClose}>Annuler</button>
            <button className="stock-btn-save" onClick={handleParse} disabled={!file && !pasteText.trim()}>
              <Search size={16} /> Analyser
            </button>
          </div>
        )}
        {step === 'preview' && (
          <div className="stock-modal-actions" style={{ padding: '12px 20px', borderTop: '1px solid var(--theme-border)' }}>
            <button className="stock-btn-cancel" onClick={() => { setStep('select'); setParsedItems([]); }}>← Retour</button>
            <button className="stock-btn-save" onClick={handleImport}>
              <Upload size={16} /> Importer {parsedItems.length} articles
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(StockPanel);
