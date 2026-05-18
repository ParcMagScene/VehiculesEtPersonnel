import './StockPanel.css';

import {
  AlertTriangle,
  Archive,
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  Check,
  Edit2,
  Euro,
  ExternalLink,
  Hash,
  Layers,
  Map,
  MapPin,
  Package,
  Plus,
  RotateCcw,
  Search,
  Tag as TagIcon,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Button,
  EmptyState,
  EntityCombobox,
  InlineAlert,
  Input,
  Modal,
  ModalBody,
  ModalHeader,
  ModalLayout,
  SearchBar,
  Select,
  Spinner,
  Table,
  Tag,
  Textarea,
  Tooltip,
} from '@/design-system';

import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useSlidePanelClose } from '../../hooks/useSlidePanelClose';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { formatCurrency, formatDateTime as formatDate } from '../../utils/formatUtils';
import { extractTextFromPDF } from '../../utils/pdfParser';
import DepotMap from '../vehicles/DepotMap';
import LocationSelector from '../vehicles/LocationSelector';

// ═══ Constantes ═══

const MOVEMENT_TYPES = {
  in: { label: 'Entrée', color: STATUS_COLORS.success, icon: '📥', Icon: ArrowDownCircle },
  out: { label: 'Sortie', color: STATUS_COLORS.danger, icon: '📤', Icon: ArrowUpCircle },
  adjustment: { label: 'Ajustement', color: STATUS_COLORS.warning, icon: '🔧', Icon: RotateCcw },
  return: { label: 'Retour', color: STATUS_COLORS.info, icon: '↩️', Icon: RotateCcw },
};

const UNITS = [
  'u',
  'm',
  'm²',
  'm³',
  'kg',
  'L',
  'h',
  'j',
  'lot',
  'forfait',
  'paire',
  'rouleau',
  'boîte',
];

const CATEGORY_COLORS = [
  ACCENT_COLORS.indigo,
  STATUS_COLORS.info,
  STATUS_COLORS.success,
  STATUS_COLORS.warning,
  STATUS_COLORS.danger,
  ACCENT_COLORS.violet,
  ACCENT_COLORS.pink,
  '#14b8a6',
  ACCENT_COLORS.orange,
  STATUS_COLORS.neutral,
];

const CATEGORY_ICONS = ['📦', '🔧', '⚡', '🔩', '🛠️', '📐', '🧰', '💡', '🔌', '🧲', '🪛', '⛓️'];

// ═══ Composant Principal ═══
function StockPanel({
  currentUser,
  stockType = 'vente',
  showManagement = false,
  onOpenManagement,
  onCloseManagement,
}) {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [movements, setMovements] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [dialogItem, setDialogItem] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [depotZones, setDepotZones] = useState(null);
  const [allDepotZones, setAllDepotZones] = useState(null);

  const isAdmin = currentUser?.isAdmin === true;
  const clickTimerRef = useRef(null);
  const debounceRef = useRef(null);

  // Debounce search (300ms)
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  // ═══ Chargement des données ═══
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { stock_type: stockType };
      if (debouncedSearch) params.search = debouncedSearch;
      if (categoryFilter) params.category_id = categoryFilter;
      if (lowStockFilter) params.low_stock = 'true';

      const [itemsData, catsData, statsData, suppData, zonesData, allZonesData] = await Promise.all(
        [
          api.getStockItems(params),
          api.getStockCategories(),
          api.getStockStats({ stock_type: stockType }),
          api.getSuppliers({}).catch(() => []),
          api.getEquipmentDepotZones().catch(() => null),
          api.getAllDepotZones().catch(() => null),
        ],
      );
      setItems(itemsData);
      setCategories(catsData);
      setStats(statsData);
      setSuppliers(suppData);
      setDepotZones(zonesData);
      setAllDepotZones(allZonesData);
    } catch (error) {
      console.error('Erreur chargement stock:', error);
      toast.error('Erreur de chargement du stock');
    } finally {
      setLoading(false);
    }
  }, [stockType, debouncedSearch, categoryFilter, lowStockFilter, toast]);

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

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ═══ Handlers Articles ═══
  const handleSaveItem = async (data) => {
    try {
      const payload = { ...data, stock_type: stockType };
      if (editingItem) {
        const updated = await api.updateStockItem(editingItem.id, payload);
        setShowItemForm(false);
        setEditingItem(null);
        if (selectedItem?.id === updated.id) setSelectedItem(updated);
        if (dialogItem?.id === updated.id) setDialogItem(updated);
      } else {
        await api.createStockItem(payload);
        setShowItemForm(false);
        setEditingItem(null);
      }
      setShowItemForm(false);
      setEditingItem(null);
      loadData();
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };

  const handleDeleteItem = (item) => {
    confirm({
      title: "Supprimer l'article",
      message: `Supprimer "${item.name}" (${item.reference}) ? L'historique des mouvements sera aussi supprimé.`,
      onConfirm: async () => {
        try {
          await api.deleteStockItem(item.id);
          setSelectedItem(null);
          loadData();
        } catch (error) {
          toast.error('Erreur: ' + error.message);
        }
      },
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
    confirm({
      title: 'Supprimer la catégorie',
      message: `Supprimer la catégorie "${cat.name}" ? Elle ne doit contenir aucun article.`,
      onConfirm: async () => {
        try {
          await api.deleteStockCategory(cat.id);
          loadData();
        } catch (error) {
          toast.error('Erreur: ' + error.message);
        }
      },
    });
  };

  // ═══ Handler Mouvements ═══
  const handleCreateMovement = async (data) => {
    try {
      await api.createStockMovement(data);
      setShowMovementForm(false);
      loadData();
      if (selectedItem) {
        const updated = await api.getStockItem(selectedItem.id);
        setSelectedItem(updated);
        loadMovements(selectedItem.id);
      }
      if (dialogItem) {
        const updated = await api.getStockItem(dialogItem.id);
        setDialogItem(updated);
        loadMovements(dialogItem.id);
      }
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };

  // ═══ Rendu ═══
  return (
    <div className="stock-panel">
      {/* Content wrapper — table + slide panel côte à côte */}
      <div className="stock-content-wrapper">
        <div className="stock-content-inner">
          <div className="stock-content">
            {loading && !items.length ? (
              <div className="stock-loading">
                <Spinner size="lg" />
                <p>Chargement du stock...</p>
              </div>
            ) : dialogItem ? (
              <ItemDetailView
                item={dialogItem}
                movements={movements}
                onBack={() => setDialogItem(null)}
                onEdit={() => {
                  setEditingItem(dialogItem);
                  setShowItemForm(true);
                }}
                onDelete={() => handleDeleteItem(dialogItem)}
                onMovement={() => setShowMovementForm(true)}
                loadMovements={loadMovements}
                isAdmin={isAdmin}
                depotZones={depotZones}
                allDepotZones={allDepotZones}
              />
            ) : (
              <ItemsListView
                items={items}
                categories={categories}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                lowStockFilter={lowStockFilter}
                onLowStockChange={setLowStockFilter}
                selectedItemId={selectedItem?.id}
                stats={stats}
                onOpenManagement={onOpenManagement}
                onSelect={(item) => {
                  clearTimeout(clickTimerRef.current);
                  clickTimerRef.current = setTimeout(() => {
                    if (selectedItem?.id === item.id) {
                      setSelectedItem(null);
                    } else {
                      setSelectedItem(item);
                      api
                        .getStockItem(item.id)
                        .then((detail) => setSelectedItem(detail))
                        .catch(() => {});
                    }
                  }, 200);
                }}
                onDoubleClick={(item) => {
                  clearTimeout(clickTimerRef.current);
                  setDialogItem(item);
                  api
                    .getStockItem(item.id)
                    .then((detail) => setDialogItem(detail))
                    .catch(() => {});
                }}
                onAdd={() => {
                  setEditingItem(null);
                  setShowItemForm(true);
                }}
                onImport={() => setShowImport(true)}
                isAdmin={isAdmin}
              />
            )}
          </div>
        </div>

        {/* Volet de détail rapide (clic simple) */}
        {!dialogItem && (
          <StockSlidePanel
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onOpenDialog={(item) => {
              setSelectedItem(null);
              setDialogItem(item);
            }}
            onEdit={(item) => {
              setEditingItem(item);
              setShowItemForm(true);
            }}
            onMovement={() => setShowMovementForm(true)}
            isAdmin={isAdmin}
            depotZones={depotZones}
            allDepotZones={allDepotZones}
          />
        )}
      </div>

      {/* Formulaires modaux */}
      {showItemForm && (
        <ItemFormModal
          item={editingItem}
          categories={categories}
          suppliers={suppliers}
          depotZones={depotZones}
          allDepotZones={allDepotZones}
          onSave={handleSaveItem}
          onClose={() => {
            setShowItemForm(false);
            setEditingItem(null);
          }}
        />
      )}
      {showCategoryForm && (
        <CategoryFormModal
          category={editingCategory}
          categories={categories}
          onSave={handleSaveCategory}
          onClose={() => {
            setShowCategoryForm(false);
            setEditingCategory(null);
          }}
        />
      )}
      {showMovementForm && (
        <MovementFormModal
          items={items}
          preselectedItem={selectedItem || dialogItem}
          onSave={handleCreateMovement}
          onClose={() => setShowMovementForm(false)}
        />
      )}
      {ConfirmDialogRenderer}
      {showImport && (
        <ImportStockModal
          onDone={() => {
            setShowImport(false);
            loadData();
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Panneau Gestion Catégories (via bouton Gestion du header) */}
      {showManagement && (
        <Modal open={true} onClose={onCloseManagement} size="lg" className="stock-management-panel">
          <ModalHeader icon={<Layers size={20} />} onClose={onCloseManagement}>
            Gestion des catégories
          </ModalHeader>
          <ModalBody>
            <CategoriesView
              categories={categories}
              onAdd={() => {
                setEditingCategory(null);
                setShowCategoryForm(true);
              }}
              onEdit={(cat) => {
                setEditingCategory(cat);
                setShowCategoryForm(true);
              }}
              onDelete={handleDeleteCategory}
              isAdmin={isAdmin}
            />
          </ModalBody>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Volet latéral (Slide Panel)
// ═══════════════════════════════════════════════════════════════
const StockSlidePanel = ({
  item,
  onClose,
  onOpenDialog,
  onEdit,
  onMovement,
  isAdmin,
  _depotZones,
  _allDepotZones,
}) => {
  const panelRef = useRef(null);
  const { isVisible, isOpen, isClosing, handleClose } = useSlidePanelClose(item, onClose);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        const row = e.target.closest('.stock-row');
        if (!row) handleClose();
      }
    };
    if (item && isVisible) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [item, isVisible, handleClose]);

  if (!isVisible && !item) return null;

  const current = item || {};
  const isLow = current.min_quantity > 0 && current.quantity <= current.min_quantity;
  const isOut = current.quantity === 0;
  const locationLabel = current.location_zone
    ? `${current.location_depot ? `D${current.location_depot} — ` : ''}${current.location_zone}${current.location_floor ? ` (${current.location_floor})` : ''}`
    : current.location || null;

  return (
    <div
      className={`stock-slide-panel ${isClosing ? 'closing' : isOpen ? 'open' : ''}`}
      ref={panelRef}
    >
      <div className="stock-slide-header">
        <div className="stock-slide-title-row">
          <span className="stock-slide-name">{current.name}</span>
          <span className="stock-slide-ref">{current.reference}</span>
        </div>
        <Tooltip content="Fermer">
          <Button
            variant="ghost"
            className="stock-slide-close"
            onClick={handleClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </Button>
        </Tooltip>
      </div>
      <div className="stock-slide-body">
        {current.category_name && (
          <span
            className="stock-cat-badge"
            style={
              current.category_color
                ? {
                    background: current.category_color + '20',
                    color: current.category_color,
                    borderColor: current.category_color,
                  }
                : undefined
            }
          >
            {current.category_icon} {current.category_name}
          </span>
        )}
        <div className="stock-slide-qty">
          <span className={`stock-qty-big ${isOut ? 'rupture' : isLow ? 'low' : 'ok'}`}>
            {current.quantity} {current.unit}
          </span>
          {isLow && !isOut && (
            <Tag color="warning" size="sm">
              Stock bas
            </Tag>
          )}
          {isOut && (
            <Tag color="danger" size="sm">
              Rupture
            </Tag>
          )}
          {current.min_quantity > 0 && (
            <small className="stock-slide-min">
              Seuil : {current.min_quantity} {current.unit}
            </small>
          )}
        </div>
        <div className="stock-slide-prices">
          <div>
            <small>P.U. Achat</small>
            <span>{formatCurrency(current.unit_price)}</span>
          </div>
          <div>
            <small>P.U. Vente</small>
            <span>{formatCurrency(current.sell_price)}</span>
          </div>
          <div>
            <small>Valeur stock</small>
            <span>{formatCurrency(current.quantity * (current.unit_price || 0))}</span>
          </div>
        </div>
        {locationLabel && (
          <div className="stock-slide-location">
            <MapPin size={14} /> {locationLabel}
          </div>
        )}
        {current.supplier_name && (
          <div className="stock-slide-supplier">
            <Hash size={14} /> {current.supplier_name}
          </div>
        )}
        {current.notes && <p className="stock-slide-notes">{current.notes}</p>}
      </div>
      <div className="stock-slide-footer">
        <Tooltip content="Mouvement" position="bottom">
          <Button variant="secondary" onClick={() => onMovement()}>
            <TrendingUp size={14} /> Mouvement
          </Button>
        </Tooltip>
        {isAdmin && (
          <Tooltip content="Modifier">
            <Button
              variant="secondary"
              onClick={() => onEdit(current)}
              iconOnly
              aria-label="Modifier"
            >
              <Edit2 size={14} />
            </Button>
          </Tooltip>
        )}
        <Button
          variant="ghost"
          className="stock-slide-open-btn"
          onClick={() => onOpenDialog(current)}
        >
          <ExternalLink size={14} /> Ouvrir la fiche
        </Button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Dashboard (exporté pour InventoryPanel)
// ═══════════════════════════════════════════════════════════════
function _DashboardView({ stats, _items, onSelectItem }) {
  if (!stats) return <div className="stock-empty">Chargement des statistiques...</div>;

  return (
    <div className="stock-dashboard">
      {/* KPIs */}
      <div className="stock-kpis">
        <div className="stock-kpi">
          <div className="kpi-icon" style={{ background: 'var(--theme-info-bg-strong)' }}>
            <Package size={20} color={STATUS_COLORS.info} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{stats.totalItems}</span>
            <span className="kpi-label">Articles actifs</span>
          </div>
        </div>
        <div className="stock-kpi">
          <div className="kpi-icon" style={{ background: 'var(--theme-success-bg-strong)' }}>
            <Euro size={20} color={STATUS_COLORS.success} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{formatCurrency(stats.totalValue)}</span>
            <span className="kpi-label">Valeur du stock</span>
          </div>
        </div>
        <div className="stock-kpi warning">
          <div className="kpi-icon" style={{ background: 'var(--btn-warning-bg)' }}>
            <AlertTriangle size={20} color={STATUS_COLORS.warning} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{stats.lowStockCount}</span>
            <span className="kpi-label">Stock bas</span>
          </div>
        </div>
        <div className="stock-kpi danger">
          <div className="kpi-icon" style={{ background: 'var(--btn-danger-bg)' }}>
            <Archive size={20} color={STATUS_COLORS.danger} />
          </div>
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
            {stats.recentMovements.map((m) => {
              const mt = MOVEMENT_TYPES[m.type];
              return (
                <div
                  key={m.type}
                  className="stock-activity-card"
                  style={{ borderLeftColor: mt?.color }}
                >
                  <span className="activity-type">
                    {mt?.icon} {mt?.label || m.type}
                  </span>
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
            {stats.lowStockItems.map((item) => {
              const pct =
                item.min_quantity > 0 ? Math.round((item.quantity / item.min_quantity) * 100) : 0;
              return (
                <div
                  key={item.id}
                  className="stock-alert-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectItem(item)}
                >
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
              <div
                key={item.id}
                className="stock-top-item"
                role="button"
                tabIndex={0}
                onClick={() => onSelectItem(item)}
              >
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
function ItemsListView({
  items,
  categories,
  searchTerm,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  lowStockFilter,
  onLowStockChange,
  selectedItemId,
  onSelect,
  onDoubleClick,
  onAdd,
  onImport,
  _isAdmin,
  stats,
  onOpenManagement,
}) {
  return (
    <div className="stock-items-view">
      {/* Toolbar */}
      <div className="stock-toolbar">
        <SearchBar
          value={searchTerm}
          onChange={onSearchChange}
          placeholder="Rechercher un article..."
        />
        <div className="stock-filters">
          <EntityCombobox
            value={categoryFilter}
            onChange={(val) => onCategoryChange(val)}
            options={categories.map((c) => ({ id: c.id, name: `${c.icon} ${c.name}` }))}
            placeholder="Toutes catégories"
            allowClear
          />
          <Tooltip content="Afficher uniquement les stocks bas" position="bottom">
            <Button
              variant="ghost"
              className={`stock-filter-btn ${lowStockFilter ? 'active' : ''}`}
              onClick={() => onLowStockChange(!lowStockFilter)}
            >
              <AlertTriangle size={14} />
              Stock bas
            </Button>
          </Tooltip>
        </div>
        {stats && (
          <div className="stock-header-stats">
            <span className="stat-badge">
              <Package size={14} /> {stats.totalItems || 0} articles
            </span>
            {stats.lowStockCount > 0 && (
              <span className="stat-badge warning">
                <AlertTriangle size={14} /> {stats.lowStockCount} stock bas
              </span>
            )}
          </div>
        )}
        <Tooltip content="Importer un inventaire CSV" position="bottom">
          <Button variant="ghost" className="stock-add-btn" onClick={onImport}>
            <Upload size={16} />
            <span>Importer</span>
          </Button>
        </Tooltip>
        <Button variant="ghost" className="stock-add-btn" onClick={onAdd}>
          <Plus size={16} />
          <span>Nouvel article</span>
        </Button>
        {onOpenManagement && (
          <Button
            variant="ghost"
            className="stock-management-btn"
            onClick={onOpenManagement}
            aria-label="Ouvrir la gestion des catégories"
          >
            <Layers size={16} /> Gestion
          </Button>
        )}
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <EmptyState
          icon={<Package size={48} />}
          title="Aucun article trouvé"
          action={
            <Button variant="ghost" className="stock-add-btn" onClick={onAdd}>
              <Plus size={16} /> Créer un article
            </Button>
          }
        />
      ) : (
        <div className="stock-table-container">
          <Table className="stock-table">
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
              {items.map((item) => {
                const isLow = item.min_quantity > 0 && item.quantity <= item.min_quantity;
                const isOut = item.quantity === 0;
                const isSelected = selectedItemId === item.id;
                return (
                  <tr
                    key={item.id}
                    className={`stock-row ${isOut ? 'out-of-stock' : isLow ? 'low-stock' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSelect(item)}
                    onDoubleClick={() => onDoubleClick?.(item)}
                  >
                    <td className="stock-ref">{item.reference}</td>
                    <td className="stock-name">
                      <span>{item.name}</span>
                      {item.description && <small>{item.description.substring(0, 40)}</small>}
                    </td>
                    <td>
                      {item.category_name ? (
                        <span
                          className="stock-cat-badge"
                          style={
                            item.category_color
                              ? {
                                  background: item.category_color + '20',
                                  color: item.category_color,
                                  borderColor: item.category_color,
                                }
                              : undefined
                          }
                        >
                          {item.category_icon} {item.category_name}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`stock-qty ${isOut ? 'rupture' : isLow ? 'low' : ''}`}>
                      {item.quantity}
                      {isLow && !isOut && <AlertTriangle size={12} className="qty-warn-icon" />}
                      {isOut && <X size={12} className="qty-out-icon" />}
                    </td>
                    <td>{item.unit}</td>
                    <td>{formatCurrency(item.unit_price)}</td>
                    <td>{formatCurrency(item.sell_price)}</td>
                    <td className="stock-value">
                      {formatCurrency(item.quantity * (item.unit_price || 0))}
                    </td>
                    <td className="stock-location">
                      {item.location_zone
                        ? `${item.location_depot ? `D${item.location_depot}–` : ''}${item.location_zone}`
                        : item.location || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      <div className="stock-footer-info">
        {items.length} article(s) — Valeur totale :{' '}
        {formatCurrency(items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Détail d'un article
// ═══════════════════════════════════════════════════════════════
function ItemDetailView({
  item,
  movements,
  onBack,
  onEdit,
  onDelete,
  onMovement,
  loadMovements,
  isAdmin,
  depotZones,
  allDepotZones,
}) {
  const [showMap, setShowMap] = useState(false);
  useEffect(() => {
    loadMovements(item.id);
  }, [item.id, loadMovements]);

  const isLow = item.min_quantity > 0 && item.quantity <= item.min_quantity;
  const isOut = item.quantity === 0;

  return (
    <div className="stock-detail">
      <div className="stock-detail-header">
        <Button variant="ghost" className="stock-back-btn" onClick={onBack}>
          <ArrowLeft size={18} /> Retour
        </Button>
        <div className="stock-detail-actions">
          <Button variant="ghost" className="stock-movement-btn" onClick={onMovement}>
            <TrendingUp size={16} /> Mouvement
          </Button>
          <Button variant="ghost" className="stock-edit-btn" onClick={onEdit}>
            <Edit2 size={16} /> Modifier
          </Button>
          {isAdmin && (
            <Button variant="ghost" className="stock-delete-btn" onClick={onDelete}>
              <Trash2 size={16} />
            </Button>
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
              <span className="stock-detail-label">
                <TagIcon size={14} /> Catégorie
              </span>
              <span>
                {item.category_name ? (
                  <span
                    className="stock-cat-badge"
                    style={
                      item.category_color
                        ? {
                            background: item.category_color + '20',
                            color: item.category_color,
                            borderColor: item.category_color,
                          }
                        : undefined
                    }
                  >
                    {item.category_icon} {item.category_name}
                  </span>
                ) : (
                  '—'
                )}
              </span>
            </div>
            <div className="stock-detail-field">
              <span className="stock-detail-label">
                <Package size={14} /> Quantité
              </span>
              <span className={`stock-qty-big ${isOut ? 'rupture' : isLow ? 'low' : 'ok'}`}>
                {item.quantity} {item.unit}
                {isLow && !isOut && (
                  <Tag color="warning" size="sm">
                    Stock bas
                  </Tag>
                )}
                {isOut && (
                  <Tag color="danger" size="sm">
                    Rupture
                  </Tag>
                )}
              </span>
            </div>
            <div className="stock-detail-field">
              <span className="stock-detail-label">
                <AlertTriangle size={14} /> Seuil alerte
              </span>
              <span>
                {item.min_quantity > 0 ? `${item.min_quantity} ${item.unit}` : 'Non défini'}
              </span>
            </div>
            <div className="stock-detail-field">
              <span className="stock-detail-label">
                <Euro size={14} /> P.U. Achat
              </span>
              <span>{formatCurrency(item.unit_price)}</span>
            </div>
            <div className="stock-detail-field">
              <span className="stock-detail-label">
                <Euro size={14} /> P.U. Vente
              </span>
              <span>{formatCurrency(item.sell_price)}</span>
            </div>
            <div className="stock-detail-field">
              <span className="stock-detail-label">
                <Euro size={14} /> Valeur stock
              </span>
              <span className="stock-value-total">
                {formatCurrency(item.quantity * item.unit_price)}
              </span>
            </div>
            <div className="stock-detail-field">
              <span className="stock-detail-label">
                <MapPin size={14} /> Emplacement
              </span>
              <span>
                {item.location_zone ? (
                  <>
                    {item.location_depot ? `D${item.location_depot} — ` : ''}
                    {item.location_zone}
                    {item.location_floor ? ` (${item.location_floor})` : ''}
                    {(depotZones || allDepotZones) && (
                      <Tooltip content="Voir sur le plan" position="bottom">
                        <Button
                          variant="ghost"
                          className="stock-zone-map-btn"
                          onClick={() => setShowMap(!showMap)}
                        >
                          <Map size={13} /> Plan
                        </Button>
                      </Tooltip>
                    )}
                  </>
                ) : (
                  item.location || '—'
                )}
              </span>
            </div>
            <div className="stock-detail-field">
              <span className="stock-detail-label">
                <Hash size={14} /> Fournisseur
              </span>
              <span>{item.supplier_name || '—'}</span>
            </div>
          </div>

          {showMap &&
            item.location_zone &&
            (() => {
              const depotsList = allDepotZones?.depots || (depotZones ? [depotZones] : []);
              const depotData =
                depotsList.find((d) => String(d.id || d.depotId) === String(item.location_depot)) ||
                depotsList[0];
              if (!depotData) return null;
              return (
                <div className="stock-detail-map">
                  <DepotMap
                    zones={depotData}
                    selectedZone={item.location_zone}
                    onZoneSelect={() => {}}
                    onZoneFilter={() => {}}
                    compact
                  />
                </div>
              );
            })()}

          {item.notes && (
            <div className="stock-detail-notes">
              <span className="stock-detail-label">Notes</span>
              <p>{item.notes}</p>
            </div>
          )}
        </div>

        {/* Historique des mouvements */}
        <div className="stock-detail-card">
          <h4>
            <TrendingUp size={16} /> Historique des mouvements
          </h4>
          {movements.length === 0 ? (
            <p className="stock-empty-text">Aucun mouvement enregistré</p>
          ) : (
            <div className="stock-movements-list">
              {movements.map((m) => {
                const mt = MOVEMENT_TYPES[m.type] || {};
                return (
                  <div key={m.id} className="stock-movement-row">
                    <span className="movement-icon" style={{ color: mt.color }}>
                      {mt.icon}
                    </span>
                    <div className="movement-info">
                      <span className="movement-type" style={{ color: mt.color }}>
                        {mt.label}
                      </span>
                      <span className="movement-reason">{m.reason || '—'}</span>
                    </div>
                    <div className="movement-qty-change">
                      <span>{m.previous_quantity}</span>
                      <span className="movement-arrow">→</span>
                      <span className="movement-new-qty">{m.new_quantity}</span>
                      <span
                        className={`movement-diff ${m.type === 'out' ? 'negative' : 'positive'}`}
                      >
                        {m.type === 'out' ? '-' : '+'}
                        {m.quantity}
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
// Vue Catégories
// ═══════════════════════════════════════════════════════════════
function CategoriesView({ categories, onAdd, onEdit, onDelete, isAdmin }) {
  return (
    <div className="stock-categories-view">
      <div className="stock-toolbar">
        <h3>
          <Layers size={18} /> Catégories ({categories.length})
        </h3>
        {isAdmin && (
          <Button variant="ghost" className="stock-add-btn" onClick={onAdd}>
            <Plus size={16} /> Nouvelle catégorie
          </Button>
        )}
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={<Layers size={48} />}
          title="Aucune catégorie créée"
          action={
            isAdmin && (
              <Button variant="ghost" className="stock-add-btn" onClick={onAdd}>
                <Plus size={16} /> Créer
              </Button>
            )
          }
        />
      ) : (
        <div className="stock-categories-grid">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="stock-category-card"
              style={{ borderLeftColor: cat.color }}
            >
              <div className="cat-card-header">
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-name">{cat.name}</span>
                <span className="cat-count">{cat.item_count} article(s)</span>
              </div>
              {cat.description && <p className="cat-desc">{cat.description}</p>}
              {cat.parent_name && <span className="cat-parent">↳ {cat.parent_name}</span>}
              {isAdmin && (
                <div className="cat-actions">
                  <Tooltip content="Modifier">
                    <Button variant="ghost" onClick={() => onEdit(cat)}>
                      <Edit2 size={14} />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Supprimer">
                    <Button
                      variant="ghost"
                      onClick={() => onDelete(cat)}
                      disabled={cat.item_count > 0}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </Tooltip>
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
function ItemFormModal({
  item,
  categories,
  suppliers,
  depotZones,
  allDepotZones,
  onSave,
  onClose,
}) {
  const toast = useToast();
  const [showMap, setShowMap] = useState(false);
  const [mapDepotIdx, setMapDepotIdx] = useState(0);
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
    location_depot: item?.location_depot || '',
    location_zone: item?.location_zone || '',
    location_floor: item?.location_floor || '',
    supplier_id: item?.supplier_id || '',
    notes: item?.notes || '',
  });

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

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
    <ModalLayout
      open
      onClose={onClose}
      title={item ? "Modifier l'article" : 'Nouvel article'}
      size="lg"
      className="stock-modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="stock-item-form">
            <Check size={16} /> {item ? 'Enregistrer' : 'Créer'}
          </Button>
        </>
      }
    >
      <form id="stock-item-form" onSubmit={handleSubmit} className="stock-modal-form">
        <div className="stock-form-row">
          <div className="stock-form-field">
            <label htmlFor="stock-reference">Référence</label>
            <Input
              id="stock-reference"
              type="text"
              value={form.reference}
              onChange={(e) => handleChange('reference', e.target.value)}
              placeholder="Auto-généré si vide"
            />
          </div>
          <div className="stock-form-field full">
            <label htmlFor="stock-nom">Nom *</label>
            <Input
              id="stock-nom"
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </div>
        </div>
        <div className="stock-form-field">
          <label htmlFor="stock-description">Description</label>
          <Textarea
            id="stock-description"
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={2}
          />
        </div>
        <div className="stock-form-row">
          <div className="stock-form-field">
            <label htmlFor="stock-categorie">Catégorie</label>
            <EntityCombobox
              id="stock-categorie"
              value={form.category_id}
              onChange={(val) => handleChange('category_id', val)}
              options={categories.map((c) => ({ id: c.id, name: `${c.icon} ${c.name}` }))}
              placeholder="— Aucune —"
            />
          </div>
          <div className="stock-form-field">
            <label htmlFor="stock-unite">Unité</label>
            <Select
              id="stock-unite"
              value={form.unit}
              onChange={(e) => handleChange('unit', e.target.value)}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </div>
          <div className="stock-form-field">
            <label htmlFor="stock-fournisseur">Fournisseur</label>
            <EntityCombobox
              id="stock-fournisseur"
              value={form.supplier_id}
              onChange={(val) => handleChange('supplier_id', val)}
              options={suppliers}
              placeholder="— Aucun —"
            />
          </div>
        </div>
        <div className="stock-form-row">
          <div className="stock-form-field">
            <label htmlFor="stock-p-u-achat">P.U. Achat (€)</label>
            <Input
              id="stock-p-u-achat"
              type="number"
              step="0.01"
              min="0"
              value={form.unit_price}
              onChange={(e) => handleChange('unit_price', e.target.value)}
            />
          </div>
          <div className="stock-form-field">
            <label htmlFor="stock-p-u-vente">P.U. Vente (€)</label>
            <Input
              id="stock-p-u-vente"
              type="number"
              step="0.01"
              min="0"
              value={form.sell_price}
              onChange={(e) => handleChange('sell_price', e.target.value)}
            />
          </div>
          <div className="stock-form-field">
            <label htmlFor="stock-quantite">Quantité</label>
            <Input
              id="stock-quantite"
              type="number"
              step="0.01"
              min="0"
              value={form.quantity}
              onChange={(e) => handleChange('quantity', e.target.value)}
            />
          </div>
          <div className="stock-form-field">
            <label htmlFor="stock-seuil-alerte">Seuil alerte</label>
            <Input
              id="stock-seuil-alerte"
              type="number"
              step="0.01"
              min="0"
              value={form.min_quantity}
              onChange={(e) => handleChange('min_quantity', e.target.value)}
            />
          </div>
        </div>
        {depotZones || allDepotZones ? (
          <div className="stock-form-field stock-form-full">
            <LocationSelector
              zones={depotZones}
              depots={allDepotZones}
              value={{
                location_depot: form.location_depot,
                location_zone: form.location_zone,
                location_floor: form.location_floor,
              }}
              onChange={(loc) =>
                setForm((f) => ({
                  ...f,
                  location_depot: loc.location_depot || '',
                  location_zone: loc.location_zone || '',
                  location_floor: loc.location_floor || '',
                }))
              }
            />
            <Button
              variant="ghost"
              type="button"
              className="stock-form-map-toggle"
              onClick={() => setShowMap(!showMap)}
              aria-pressed={showMap}
            >
              <Map size={14} /> {showMap ? 'Masquer le plan' : 'Choisir sur le plan'}
            </Button>
            {showMap &&
              (() => {
                const depotsList = allDepotZones?.depots || (depotZones ? [depotZones] : []);
                const currentDepotData = depotsList[mapDepotIdx] || depotsList[0];
                if (!currentDepotData) return null;
                return (
                  <div className="stock-form-map-container">
                    {depotsList.length > 1 && (
                      <div className="stock-form-map-tabs">
                        {depotsList.map((d, i) => (
                          <Button
                            variant="ghost"
                            key={d.id || i}
                            type="button"
                            className={`stock-form-map-tab${i === mapDepotIdx ? ' active' : ''}`}
                            onClick={() => setMapDepotIdx(i)}
                          >
                            {d.name || `Dépôt ${d.id || i + 1}`}
                          </Button>
                        ))}
                      </div>
                    )}
                    <DepotMap
                      zones={currentDepotData}
                      selectedZone={form.location_zone}
                      onZoneSelect={(zoneId) => {
                        if (!zoneId) return;
                        const zoneObj = currentDepotData.zones?.find((z) => z.id === zoneId);
                        setForm((f) => ({
                          ...f,
                          location_depot: currentDepotData.id || currentDepotData.depotId || '',
                          location_zone: zoneId,
                          location_floor: zoneObj?.floor || '',
                        }));
                      }}
                      onZoneFilter={() => {}}
                      compact
                    />
                  </div>
                );
              })()}
          </div>
        ) : (
          <div className="stock-form-field">
            <label htmlFor="stock-emplacement">Emplacement</label>
            <Input
              id="stock-emplacement"
              type="text"
              value={form.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="ex: Étagère A3, Atelier B..."
            />
          </div>
        )}
        <div className="stock-form-field">
          <label htmlFor="stock-notes">Notes</label>
          <Textarea
            id="stock-notes"
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={2}
          />
        </div>
      </form>
    </ModalLayout>
  );
}

// ═══════════════════════════════════════════════════════════════
// Modal Formulaire Catégorie
// ═══════════════════════════════════════════════════════════════
function CategoryFormModal({ category, categories, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: category?.name || '',
    description: category?.description || '',
    parent_id: category?.parent_id || '',
    color: category?.color || CATEGORY_COLORS[0],
    icon: category?.icon || '📦',
  });

  const parentOptions = categories.filter((c) => c.id !== category?.id);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.warning('Le nom est requis');
    onSave({ ...form, parent_id: form.parent_id || null });
  };

  return (
    <ModalLayout
      open
      onClose={onClose}
      title={category ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
      size="sm"
      className="stock-modal stock-modal-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="category-form">
            <Check size={16} /> {category ? 'Enregistrer' : 'Créer'}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} className="stock-modal-form">
        <div className="stock-form-field">
          <label htmlFor="stock-nom-2">Nom *</label>
          <Input
            id="stock-nom-2"
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div className="stock-form-field">
          <label htmlFor="stock-description-2">Description</label>
          <Input
            id="stock-description-2"
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="stock-form-field">
          <label htmlFor="stock-parent">Parent</label>
          <EntityCombobox
            id="stock-parent"
            value={form.parent_id}
            onChange={(val) => setForm((f) => ({ ...f, parent_id: val }))}
            options={parentOptions.map((c) => ({ id: c.id, name: `${c.icon} ${c.name}` }))}
            placeholder="— Aucun (racine) —"
          />
        </div>
        <div className="stock-form-field">
          <span className="stock-form-group-label">Icône</span>
          <div className="stock-icon-picker">
            {CATEGORY_ICONS.map((icon) => (
              <Button
                variant="ghost"
                key={icon}
                type="button"
                className={`icon-pick ${form.icon === icon ? 'active' : ''}`}
                onClick={() => setForm((f) => ({ ...f, icon }))}
              >
                {icon}
              </Button>
            ))}
          </div>
        </div>
        <div className="stock-form-field">
          <span className="stock-form-group-label">Couleur</span>
          <div className="stock-color-picker">
            {CATEGORY_COLORS.map((color) => (
              <Button
                variant="ghost"
                key={color}
                type="button"
                className={`color-pick ${form.color === color ? 'active' : ''}`}
                style={{ background: color }}
                onClick={() => setForm((f) => ({ ...f, color }))}
              />
            ))}
          </div>
        </div>
      </form>
    </ModalLayout>
  );
}

// ═══════════════════════════════════════════════════════════════
// Modal Formulaire Mouvement
// ═══════════════════════════════════════════════════════════════
function MovementFormModal({ items, preselectedItem, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    stock_item_id: preselectedItem?.id || '',
    type: 'in',
    quantity: '',
    reason: '',
    reference: '',
  });

  const selectedItem = items.find((i) => i.id === Number(form.stock_item_id));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.stock_item_id || !form.quantity)
      return toast.warning('Article et quantité sont requis');
    onSave({
      ...form,
      stock_item_id: Number(form.stock_item_id),
      quantity: Number(form.quantity),
    });
  };

  return (
    <ModalLayout
      open
      onClose={onClose}
      title="Nouveau mouvement"
      size="sm"
      className="stock-modal stock-modal-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="movement-form">
            <Check size={16} /> Valider
          </Button>
        </>
      }
    >
      <form id="movement-form" onSubmit={handleSubmit} className="stock-modal-form">
        <div className="stock-form-field">
          <label htmlFor="stock-article">Article *</label>
          <Select
            id="stock-article"
            value={form.stock_item_id}
            onChange={(e) => setForm((f) => ({ ...f, stock_item_id: e.target.value }))}
            required
          >
            <option value="">— Sélectionner —</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                [{item.reference}] {item.name} (stock: {item.quantity} {item.unit})
              </option>
            ))}
          </Select>
        </div>
        <div className="stock-form-field">
          <span className="stock-form-group-label">Type de mouvement</span>
          <div className="stock-movement-types">
            {Object.entries(MOVEMENT_TYPES).map(([key, mt]) => (
              <Button
                variant="ghost"
                key={key}
                type="button"
                className={`movement-type-btn ${form.type === key ? 'active' : ''}`}
                style={{ '--mt-color': mt.color }}
                onClick={() => setForm((f) => ({ ...f, type: key }))}
              >
                {mt.icon} {mt.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="stock-form-row">
          <div className="stock-form-field">
            <label htmlFor="stock-quantite-2">Quantité *</label>
            <Input
              id="stock-quantite-2"
              type="number"
              step="0.01"
              min="0.01"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              required
            />
          </div>
          {selectedItem && (
            <div className="stock-form-field">
              <span className="stock-form-group-label">Stock actuel</span>
              <div className="stock-current-qty">
                {selectedItem.quantity} {selectedItem.unit}
                {form.quantity && (
                  <span className="stock-preview-qty">
                    →{' '}
                    {form.type === 'in' || form.type === 'return'
                      ? selectedItem.quantity + Number(form.quantity)
                      : form.type === 'out'
                        ? Math.max(0, selectedItem.quantity - Number(form.quantity))
                        : Number(form.quantity)}{' '}
                    {selectedItem.unit}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="stock-form-field">
          <label htmlFor="stock-motif-raison">Motif / Raison</label>
          <Input
            id="stock-motif-raison"
            type="text"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="ex: Livraison fournisseur, Prêt chantier, Inventaire..."
          />
        </div>
        <div className="stock-form-field">
          <label htmlFor="stock-reference-bl-facture">Référence (BL, facture...)</label>
          <Input
            id="stock-reference-bl-facture"
            type="text"
            value={form.reference}
            onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
            placeholder="ex: BL-2024-0045"
          />
        </div>
      </form>
    </ModalLayout>
  );
}

// ═══════════════════════════════════════════════════════════════
// Modal Import Stock (CSV / inventaire)
// ═══════════════════════════════════════════════════════════════

function parseInventoryCSV(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const items = [];
  // Try to detect separator (tab, semicolon, comma)
  const firstDataLine = lines.find(
    (l) =>
      /\d/.test(l) &&
      !/^(Rapport|Inventaire|Résumé|Synthèse|Catégorie|Emplacement|Fournisseur|TOTAL|Page|Détail|Référence)/i.test(
        l,
      ),
  );
  const sep = firstDataLine?.includes('\t') ? '\t' : firstDataLine?.includes(';') ? ';' : ',';

  // Find header line
  let headerIdx = lines.findIndex((l) => {
    const lower = l.toLowerCase();
    return (
      (lower.includes('référence') || lower.includes('reference') || lower.includes('ref')) &&
      (lower.includes('nom') ||
        lower.includes('désignation') ||
        lower.includes('designation') ||
        lower.includes('article'))
    );
  });

  if (headerIdx === -1) {
    // No header found — try raw data parsing (each field separated)
    // Fallback: treat each line as: reference, name, description, category, location, quantity, unit_price, total
    for (const line of lines) {
      const cols = line.split(sep).map((c) => c.trim());
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

  const headers = lines[headerIdx].split(sep).map((h) => h.trim().toLowerCase());
  const colIdx = {
    ref: headers.findIndex((h) => /^(r[ée]f|reference)/.test(h)),
    name: headers.findIndex((h) => /^(nom|d[ée]signation|article)/.test(h)),
    desc: headers.findIndex((h) => /^desc/.test(h)),
    cat: headers.findIndex((h) => /^cat[ée]gorie/.test(h)),
    loc: headers.findIndex((h) => /^(emplacement|lieu|location)/.test(h)),
    qty: headers.findIndex((h) => /^(quanti|qty|qté|stock)/.test(h)),
    price: headers.findIndex((h) => /^(valeur|prix|p\.?u|unit)/.test(h)),
    total: headers.findIndex((h) => /^total/.test(h)),
  };

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^(Page|TOTAL|Synthèse)/i.test(line)) continue;
    const cols = line.split(sep).map((c) => c.trim());
    if (cols.length < 3) continue;

    const get = (idx) => (idx >= 0 && idx < cols.length ? cols[idx] : '');
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
    'Batteries',
    'Connecteurs',
    'Consommables divers',
    'Consommables d',
    'Câbles',
    'DICJONTEUR',
    'ELEC',
    'Filtres',
    'Gaffer & Adhésifs',
    'Gaffer & Adhés',
    'Lampes',
    'Mousse & Protection',
    'Mousse & Prote',
    'Outillage',
    'EPI',
    'SON',
    'STRUCTURE',
    'Sans catégorie',
    'Électronique',
  ];
  const LOCATIONS = ['Atelier', 'Sans emplacement', 'Stock Pièces', 'Stock Vente'];
  const SKIP_RE =
    /^(Rapport|Inventaire|Résumé|Synthèse|Catégorie\s|Référence\s|Détail|Page\s+\d|\d+\s+articles$)/i;

  const restoreCat = (raw) => {
    const n = raw.replace(/…$/, '').trim();
    const MAP = {
      'Consommables d': 'Consommables divers',
      'Gaffer & Adhés': 'Gaffer & Adhésifs',
      'Mousse & Prote': 'Mousse & Protection',
    };
    return MAP[n] || n;
  };
  const parseNum = (s) => parseFloat((s || '').replace(/\s/g, '').replace(',', '.'));

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || SKIP_RE.test(line)) continue;

    // Split sur 2+ espaces = colonnes
    const cols = line
      .split(/\s{2 }/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (cols.length < 4) continue;

    // Les 3 dernières colonnes = total, valeur, quantité
    const qty = parseNum(cols[cols.length - 3]);
    const value = parseNum(cols[cols.length - 2]);
    if (isNaN(qty)) continue;

    let idx = cols.length - 4;

    // Emplacement (optionnel)
    let location = '';
    if (idx >= 0 && LOCATIONS.some((l) => cols[idx].startsWith(l))) {
      location = cols[idx];
      idx--;
    }

    // Catégorie (optionnelle)
    let category_name = '';
    if (idx >= 0) {
      const cleaned = cols[idx].replace(/…$/, '').trim();
      if (CATEGORIES.some((c) => cleaned === c || cleaned.startsWith(c))) {
        category_name = restoreCat(cols[idx]);
        idx--;
      }
    }

    // Le reste = référence, nom, description
    const remaining = cols.slice(0, idx + 1);
    let reference = '',
      name = '',
      description = '';
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
  const [_result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPasteText('');
    }
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
      toast.success(
        `Import terminé : ${res.inserted} créés, ${res.updated} mis à jour, ${res.skipped} ignorés`,
      );
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

  const totalQty = useMemo(
    () => parsedItems.reduce((s, i) => s + (i.quantity || 0), 0),
    [parsedItems],
  );
  const totalValue = useMemo(
    () => parsedItems.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0),
    [parsedItems],
  );

  return (
    <ModalLayout
      open
      onClose={step !== 'importing' ? onClose : undefined}
      title={
        <>
          <Upload size={20} /> Importer un inventaire
        </>
      }
      size="lg"
      className="stock-modal stock-modal-lg"
      footer={
        step === 'select' ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleParse} disabled={!file && !pasteText.trim()}>
              <Search size={16} /> Analyser
            </Button>
          </>
        ) : step === 'preview' ? (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setStep('select');
                setParsedItems([]);
              }}
            >
              ← Retour
            </Button>
            <Button variant="primary" onClick={handleImport}>
              <Upload size={16} /> Importer {parsedItems.length} articles
            </Button>
          </>
        ) : null
      }
    >
      <div className="stock-modal-body u-overflow-auto" style={{ maxHeight: '70vh' }}>
        {error && <InlineAlert>{error}</InlineAlert>}

        {/* STEP: SELECT */}
        {step === 'select' && (
          <>
            <p className="stock-import-hint">
              Importez un <strong>PDF</strong> (Rapport d'Inventaire) ou un <strong>CSV</strong>{' '}
              (colonnes&nbsp;: Référence, Nom, Description, Catégorie, Emplacement, Quantité,
              Valeur).
            </p>

            <div className="stock-form-field">
              <label htmlFor="stock-import-file">Fichier PDF ou CSV</label>
              <input
                id="stock-import-file"
                type="file"
                accept=".pdf,.csv,.tsv,.txt"
                onChange={handleFileChange}
              />
              {file && (
                <small>
                  {file.name} — {(file.size / 1024).toFixed(1)} Ko
                </small>
              )}
            </div>

            {!isPDF && (
              <div className="stock-form-field">
                <label htmlFor="stock-ou-coller-les-donnees-csv">Ou coller les données (CSV)</label>
                <Textarea
                  id="stock-ou-coller-les-donnees-csv"
                  rows={8}
                  value={pasteText}
                  onChange={(e) => {
                    setPasteText(e.target.value);
                    setFile(null);
                  }}
                  aria-label="Coller les données CSV"
                  placeholder={
                    'Référence\tNom\tDescription\tCatégorie\tEmplacement\tQuantité\tValeur\n62006042\t360 MAC AURA\t\tÉlectronique\tStock Pièces\t3\t59.17'
                  }
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                />
              </div>
            )}

            <div className="stock-form-field">
              <span className="stock-form-group-label">Mode d'import</span>
              <div className="u-flex u-gap-3">
                <label className="u-flex-center u-gap-1 u-cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="upsert"
                    checked={importMode === 'upsert'}
                    onChange={() => setImportMode('upsert')}
                  />
                  Créer + mettre à jour
                </label>
                <label className="u-flex-center u-gap-1 u-cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="insert_only"
                    checked={importMode === 'insert_only'}
                    onChange={() => setImportMode('insert_only')}
                  />
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
                <strong>
                  {totalValue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </strong>
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
              <Table className="stock-table">
                <thead>
                  <tr>
                    <th>Réf.</th>
                    <th>Nom</th>
                    <th>Catégorie</th>
                    <th>Emplacement</th>
                    <th className="u-text-right">Qté</th>
                    <th className="u-text-right">Valeur unit.</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.slice(0, 30).map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {item.reference || '—'}
                      </td>
                      <td>{item.name}</td>
                      <td>{item.category_name || '—'}</td>
                      <td>{item.location || '—'}</td>
                      <td className="u-text-right">{item.quantity}</td>
                      <td className="u-text-right">
                        {item.unit_price
                          ? item.unit_price.toLocaleString('fr-FR', {
                              style: 'currency',
                              currency: 'EUR',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {parsedItems.length > 30 && (
                <p className="stock-import-hint u-text-center u-mt-2">
                  …et {parsedItems.length - 30} autres articles
                </p>
              )}
            </div>
          </>
        )}

        {/* STEP: IMPORTING */}
        {step === 'importing' && (
          <div className="stock-import-loading">
            <Spinner size="lg" />
            <p>Import de {parsedItems.length} articles en cours…</p>
          </div>
        )}
      </div>
    </ModalLayout>
  );
}

export default React.memo(StockPanel);
