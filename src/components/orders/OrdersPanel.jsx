import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ShoppingCart, FileText, Search, Plus, Filter, Edit2, Trash2, ArrowLeft, 
  Users as UsersIcon, Package, Send, Check, X, ArrowRight, 
  Building2, Phone, Mail, MapPin, Euro, Hash, FileCheck,
  ClipboardList, Bell, Eye, CheckCircle, Clock, Archive, 
  FileDown, Receipt, Layers, ChevronRight } from 'lucide-react';
import api from '../../utils/api';
import { formatCurrency, formatDateSimple as formatDate } from '../../utils/formatUtils';
import ConfirmDialog from '../ConfirmDialog';
import PhoneInput, { formatPhoneDisplay } from '../PhoneInput';
import AddressAutocomplete from '../AddressAutocomplete';
import './OrdersPanel.css';
import { useToast } from '../../hooks/useToast';

// ═══ Constantes ═══
const ORDER_STATUS = {
  draft: { label: 'Brouillon', color: 'var(--theme-text-muted)', icon: '📝' },
  sent: { label: 'Envoyée', color: '#3b82f6', icon: '📤' },
  confirmed: { label: 'Confirmée', color: '#8b5cf6', icon: '✅' },
  partial: { label: 'Reçue partiellement', color: '#f59e0b', icon: '📦' },
  received: { label: 'Réceptionnée', color: '#10b981', icon: '✔️' },
  cancelled: { label: 'Annulée', color: '#ef4444', icon: '❌' },
};

const QUOTE_STATUS = {
  draft: { label: 'Brouillon', color: 'var(--theme-text-muted)', icon: '📝' },
  sent: { label: 'Envoyé', color: '#3b82f6', icon: '📤' },
  accepted: { label: 'Accepté', color: '#10b981', icon: '✅' },
  refused: { label: 'Refusé', color: '#ef4444', icon: '❌' },
  expired: { label: 'Expiré', color: 'var(--theme-text-gray)', icon: '⏰' },
};

const UNITS = ['u', 'm', 'm²', 'm³', 'kg', 'L', 'h', 'j', 'lot', 'forfait'];

const REQUEST_STATUS = {
  pending: { label: 'En attente', color: '#f59e0b', icon: '⏳' },
  approved: { label: 'Validée', color: '#10b981', icon: '✅' },
  rejected: { label: 'Refusée', color: '#ef4444', icon: '❌' },
  ordered: { label: 'Commandée', color: '#3b82f6', icon: '📦' },
};

const REQUEST_PRIORITY = {
  low: { label: 'Basse', color: '#6b7280', icon: '🔵' },
  normal: { label: 'Normale', color: '#3b82f6', icon: '🟢' },
  high: { label: 'Haute', color: '#f59e0b', icon: '🟡' },
  urgent: { label: 'Urgente', color: '#ef4444', icon: '🔴' },
};

const DESTINATIONS = ['SAV', 'Pièces', 'Stock Mag Scène', 'Autre'];

const DOC_TYPES = {
  acknowledgment: { label: 'Accusé de commande', icon: '📋' },
  delivery_note: { label: 'BL fournisseur', icon: '📦' },
  quote: { label: 'Devis fournisseur', icon: '📄' },
  invoice: { label: 'Facture fournisseur', icon: '🧾' },
};

// ═══ Composant Principal ═══
function OrdersPanel({ currentUser }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Détail / formulaires
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editingQuote, setEditingQuote] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Demandes de matériel
  const [materialRequests, setMaterialRequests] = useState([]);
  const [requestStats, setRequestStats] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Fournisseurs enrichis
  const [suppliersWithOrders, setSuppliersWithOrders] = useState([]);
  const [showArchivedSuppliers, setShowArchivedSuppliers] = useState(false);
  const [selectedSupplierPanel, setSelectedSupplierPanel] = useState(null);
  const [supplierDetailData, setSupplierDetailData] = useState(null);

  // Alertes complétion
  const [completionAlerts, setCompletionAlerts] = useState([]);

  // ═══ Chargement des données ═══
  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  const loadData = useCallback(async () => {
    // Annuler requêtes précédentes
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;

      // Charger seulement les données de l'onglet actif + fournisseurs (nécessaires pour le formulaire commande)
      const promises = [api.getSuppliers(searchTerm ? { search: searchTerm } : {})];
      if (activeTab === 'orders' || !orders.length) promises.push(api.getOrders(params));
      if (activeTab === 'quotes' || !quotes.length) promises.push(api.getQuotes(params));
      promises.push(api.getOrdersStats());
      if (!clients.length) promises.push(api.getClients());
      if (activeTab === 'requests') promises.push(api.getMaterialRequests(params));
      promises.push(api.getMaterialRequestsStats());
      if (activeTab === 'suppliers') promises.push(api.getSuppliersWithOrders(showArchivedSuppliers));
      promises.push(api.getCompletionAlerts(true));

      const results = await Promise.all(promises);

      if (controller.signal.aborted) return;

      let idx = 0;
      setSuppliers(results[idx++]);
      if (activeTab === 'orders' || !orders.length) setOrders(results[idx++]);
      if (activeTab === 'quotes' || !quotes.length) setQuotes(results[idx++]);
      setStats(results[idx++]);
      if (!clients.length && results[idx]) { setClients(results[idx]); idx++; } else if (!clients.length) idx++;
      if (activeTab === 'requests') setMaterialRequests(results[idx++]); 
      setRequestStats(results[idx++]);
      if (activeTab === 'suppliers') setSuppliersWithOrders(results[idx++]);
      setCompletionAlerts(results[idx] || []);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Erreur chargement commandes:', error);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter, activeTab, showArchivedSuppliers]);

  // Debounce search: déclencher loadData après 300ms d'inactivité
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadData(), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [loadData]);

  // ═══ Handlers Commandes ═══
  const handleSaveOrder = async (data) => {
    try {
      if (editingOrder) {
        await api.updateOrder(editingOrder.id, data);
      } else {
        await api.createOrder(data);
      }
      setShowOrderForm(false);
      setEditingOrder(null);
      loadData();
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };

  const handleDeleteOrder = (order) => {
    setConfirmDialog({
      title: 'Supprimer la commande',
      message: `Supprimer la commande ${order.reference} ? Cette action est irréversible.`,
      onConfirm: async () => {
        try {
          await api.deleteOrder(order.id);
          setSelectedOrder(null);
          loadData();
        } catch (error) { toast.error('Erreur: ' + error.message); }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const handleEditOrder = async (order) => {
    try {
      const full = await api.getOrderById(order.id);
      setEditingOrder(full);
      setShowOrderForm(true);
    } catch (error) { toast.error('Erreur: ' + error.message); }
  };

  const handleViewOrder = async (order) => {
    try {
      const full = await api.getOrderById(order.id);
      setSelectedOrder(full);
    } catch (error) { toast.error('Erreur: ' + error.message); }
  };

  // ═══ Handlers Devis ═══
  const handleSaveQuote = async (data) => {
    try {
      if (editingQuote) {
        await api.updateQuote(editingQuote.id, data);
      } else {
        await api.createQuote(data);
      }
      setShowQuoteForm(false);
      setEditingQuote(null);
      loadData();
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };

  const handleDeleteQuote = (quote) => {
    setConfirmDialog({
      title: 'Supprimer le devis',
      message: `Supprimer le devis ${quote.reference} ? Cette action est irréversible.`,
      onConfirm: async () => {
        try {
          await api.deleteQuote(quote.id);
          setSelectedQuote(null);
          loadData();
        } catch (error) { toast.error('Erreur: ' + error.message); }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const handleEditQuote = async (quote) => {
    try {
      const full = await api.getQuoteById(quote.id);
      setEditingQuote(full);
      setShowQuoteForm(true);
    } catch (error) { toast.error('Erreur: ' + error.message); }
  };

  const handleViewQuote = async (quote) => {
    try {
      const full = await api.getQuoteById(quote.id);
      setSelectedQuote(full);
    } catch (error) { toast.error('Erreur: ' + error.message); }
  };

  const handleConvertQuote = (quote) => {
    setConfirmDialog({
      title: 'Convertir en commande',
      message: `Convertir le devis ${quote.reference} en bon de commande ?`,
      onConfirm: async () => {
        try {
          await api.convertQuoteToOrder(quote.id);
          setSelectedQuote(null);
          loadData();
        } catch (error) { toast.error('Erreur: ' + error.message); }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  // ═══ Handlers Fournisseurs ═══
  const handleSaveSupplier = async (data) => {
    try {
      if (editingSupplier) {
        await api.updateSupplier(editingSupplier.id, data);
      } else {
        await api.createSupplier(data);
      }
      setShowSupplierForm(false);
      setEditingSupplier(null);
      loadData();
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };

  const handleDeleteSupplier = (supplier) => {
    setConfirmDialog({
      title: 'Supprimer le fournisseur',
      message: `Supprimer ${supplier.name} ? ${supplier.order_count > 0 ? `Attention: ${supplier.order_count} commande(s) liée(s).` : ''}`,
      onConfirm: async () => {
        try {
          await api.deleteSupplier(supplier.id);
          loadData();
        } catch (error) { toast.error('Erreur: ' + error.message); }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  // ═══ Handlers Demandes de matériel ═══
  const handleSaveRequest = async (data) => {
    try {
      await api.createMaterialRequest(data);
      setShowRequestModal(false);
      toast.success('Demande créée avec succès');
      loadData();
    } catch (error) { toast.error('Erreur: ' + error.message); }
  };

  const handleValidateRequest = async (request, action, reason = null) => {
    try {
      const result = await api.validateMaterialRequest(request.id, action, reason);
      if (result.action === 'approved') {
        toast.success(`Demande approuvée → commande ${result.order?.orderRef || ''}`);
      } else {
        toast.success('Demande refusée');
      }
      loadData();
    } catch (error) { toast.error('Erreur: ' + error.message); }
  };

  const handleDeleteRequest = (request) => {
    setConfirmDialog({
      title: 'Supprimer la demande',
      message: `Supprimer la demande "${request.article}" ?`,
      onConfirm: async () => {
        try {
          await api.deleteMaterialRequest(request.id);
          loadData();
        } catch (error) { toast.error('Erreur: ' + error.message); }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  // ═══ Handlers Fournisseurs enrichis ═══
  const handleSupplierClick = async (supplier) => {
    try {
      const orders = await api.getSupplierOrders(supplier.id, showArchivedSuppliers);
      setSelectedSupplierPanel({ ...supplier, orders });
    } catch (error) { toast.error('Erreur: ' + error.message); }
  };

  const handleSupplierDoubleClick = async (supplier) => {
    try {
      const detail = await api.getSupplierFullDetail(supplier.id);
      setSupplierDetailData(detail);
    } catch (error) { toast.error('Erreur: ' + error.message); }
  };

  // ═══ Handler Alertes ═══
  const handleMarkAlertRead = async (alertId) => {
    try {
      await api.markAlertRead(alertId);
      setCompletionAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (error) { toast.error('Erreur: ' + error.message); }
  };

  // ═══ Rendu du détail commande ═══
  if (selectedOrder) {
    return (
      <div className="orders-panel">
        <OrderDetail
          order={selectedOrder}
          onBack={() => setSelectedOrder(null)}
          onEdit={() => handleEditOrder(selectedOrder)}
          onDelete={() => handleDeleteOrder(selectedOrder)}
          onStatusChange={async (newStatus) => {
            try {
              await api.updateOrder(selectedOrder.id, { status: newStatus });
              const full = await api.getOrderById(selectedOrder.id);
              setSelectedOrder(full);
              loadData();
            } catch (error) { toast.error('Erreur: ' + error.message); }
          }}
        />
        {confirmDialog && <ConfirmDialog {...confirmDialog} />}
      </div>
    );
  }

  // ═══ Rendu du détail devis ═══
  if (selectedQuote) {
    return (
      <div className="orders-panel">
        <QuoteDetail
          quote={selectedQuote}
          onBack={() => setSelectedQuote(null)}
          onEdit={() => handleEditQuote(selectedQuote)}
          onDelete={() => handleDeleteQuote(selectedQuote)}
          onConvert={() => handleConvertQuote(selectedQuote)}
          onStatusChange={async (newStatus) => {
            try {
              await api.updateQuote(selectedQuote.id, { status: newStatus });
              const full = await api.getQuoteById(selectedQuote.id);
              setSelectedQuote(full);
              loadData();
            } catch (error) { toast.error('Erreur: ' + error.message); }
          }}
        />
        {confirmDialog && <ConfirmDialog {...confirmDialog} />}
      </div>
    );
  }

  return (
    <div className="orders-panel">
      {/* Completion Alerts Banner */}
      {completionAlerts.length > 0 && (
        <div className="completion-alerts-banner">
          <Bell size={16} />
          <span>{completionAlerts.length} nouvelle(s) alerte(s) de réception</span>
          <div className="alerts-preview">
            {completionAlerts.slice(0, 3).map(alert => (
              <div key={alert.id} className="alert-preview-item">
                <span>{alert.message}</span>
                <button onClick={() => handleMarkAlertRead(alert.id)}><Check size={12} /></button>
              </div>
            ))}
          </div>
          {completionAlerts.length > 3 && <span className="alerts-more">+{completionAlerts.length - 3} autres</span>}
        </div>
      )}

      {/* Tabs + Stats unified */}
      <div className="orders-tabs">
        <button className={`orders-tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => { setActiveTab('orders'); setStatusFilter(''); }}>
          <ShoppingCart size={16} /> Commandes
        </button>
        <button className={`orders-tab ${activeTab === 'quotes' ? 'active' : ''}`} onClick={() => { setActiveTab('quotes'); setStatusFilter(''); }}>
          <FileText size={16} /> Devis
        </button>
        <button className={`orders-tab ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => { setActiveTab('requests'); setStatusFilter(''); }}>
          <ClipboardList size={16} /> Demandes
          {requestStats?.pending > 0 && <span className="tab-badge">{requestStats.pending}</span>}
        </button>
        <button className={`orders-tab ${activeTab === 'suppliers' ? 'active' : ''}`} onClick={() => { setActiveTab('suppliers'); setStatusFilter(''); }}>
          <Building2 size={16} /> Fournisseurs
        </button>
        {stats && (
          <div className="orders-header-stats">
            <span className="stat-badge"><ShoppingCart size={13} /> {stats.orders?.total || 0}</span>
            <span className="stat-badge"><FileText size={13} /> {stats.quotes?.total || 0}</span>
            <span className="stat-badge highlight"><Euro size={13} /> {formatCurrency(stats.orders?.total_ht || 0)}</span>
            {completionAlerts.length > 0 && (
              <span className="stat-badge alert" onClick={() => setActiveTab('requests')}><Bell size={13} /> {completionAlerts.length}</span>
            )}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="orders-toolbar">
        <div className="orders-search">
          <Search size={16} />
          <input
            type="text" placeholder="Rechercher..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {activeTab === 'requests' && (
          <div className="orders-filter">
            <Filter size={14} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tous les statuts</option>
              {Object.entries(REQUEST_STATUS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
        )}
        {activeTab !== 'suppliers' && activeTab !== 'requests' && (
          <div className="orders-filter">
            <Filter size={14} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tous les statuts</option>
              {Object.entries(activeTab === 'orders' ? ORDER_STATUS : QUOTE_STATUS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
        )}
        {activeTab === 'suppliers' && (
          <label className="archived-toggle">
            <input type="checkbox" checked={showArchivedSuppliers} onChange={(e) => setShowArchivedSuppliers(e.target.checked)} />
            <Archive size={14} /> Inclure archivées
          </label>
        )}
        <button className="orders-add-btn" onClick={() => {
          if (activeTab === 'orders') { setEditingOrder(null); setShowOrderForm(true); }
          else if (activeTab === 'quotes') { setEditingQuote(null); setShowQuoteForm(true); }
          else if (activeTab === 'requests') { setShowRequestModal(true); }
          else { setEditingSupplier(null); setShowSupplierForm(true); }
        }}>
          <Plus size={16} />
          {activeTab === 'orders' ? 'Nouvelle commande' : activeTab === 'quotes' ? 'Nouveau devis' : activeTab === 'requests' ? 'Nouvelle demande' : 'Nouveau fournisseur'}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="orders-loading">Chargement...</div>
      ) : (
        <>
          {activeTab === 'orders' && (
            <OrdersList orders={orders} onView={handleViewOrder} onEdit={handleEditOrder} onDelete={handleDeleteOrder} />
          )}
          {activeTab === 'quotes' && (
            <QuotesList quotes={quotes} onView={handleViewQuote} onEdit={handleEditQuote} onDelete={handleDeleteQuote} onConvert={handleConvertQuote} />
          )}
          {activeTab === 'requests' && (
            <MaterialRequestsList 
              requests={materialRequests} 
              isAdmin={currentUser?.isAdmin}
              onValidate={handleValidateRequest} 
              onDelete={handleDeleteRequest} 
            />
          )}
          {activeTab === 'suppliers' && (
            <EnhancedSuppliersList 
              suppliers={activeTab === 'suppliers' ? suppliersWithOrders : suppliers}
              onEdit={(s) => { setEditingSupplier(s); setShowSupplierForm(true); }} 
              onDelete={handleDeleteSupplier}
              onClick={handleSupplierClick}
              onDoubleClick={handleSupplierDoubleClick}
            />
          )}
        </>
      )}

      {/* Modals */}
      {showOrderForm && (
        <OrderFormModal
          order={editingOrder}
          suppliers={suppliers}
          onSave={handleSaveOrder}
          onClose={() => { setShowOrderForm(false); setEditingOrder(null); }}
        />
      )}
      {showQuoteForm && (
        <QuoteFormModal
          quote={editingQuote}
          clients={clients}
          onSave={handleSaveQuote}
          onClose={() => { setShowQuoteForm(false); setEditingQuote(null); }}
        />
      )}
      {showSupplierForm && (
        <SupplierFormModal
          supplier={editingSupplier}
          onSave={handleSaveSupplier}
          onClose={() => { setShowSupplierForm(false); setEditingSupplier(null); }}
        />
      )}
      {showRequestModal && (
        <MaterialRequestModal 
          suppliers={suppliers}
          onSave={handleSaveRequest}
          onClose={() => setShowRequestModal(false)}
        />
      )}
      {selectedSupplierPanel && (
        <SupplierPanel 
          supplier={selectedSupplierPanel}
          onClose={() => setSelectedSupplierPanel(null)}
          onViewDetail={handleSupplierDoubleClick}
          onViewOrder={handleViewOrder}
        />
      )}
      {supplierDetailData && (
        <SupplierDetailModal 
          data={supplierDetailData}
          onClose={() => setSupplierDetailData(null)}
          onViewOrder={handleViewOrder}
          onReload={async () => {
            const detail = await api.getSupplierFullDetail(supplierDetailData.supplier.id);
            setSupplierDetailData(detail);
          }}
          currentUser={currentUser}
        />
      )}
      {confirmDialog && <ConfirmDialog {...confirmDialog} />}
    </div>
  );
}

// ═══ Liste des commandes ═══
const OrdersList = React.memo(({ orders, onView, onEdit, onDelete }) => {
  if (!orders.length) return <div className="orders-empty">Aucune commande</div>;
  return (
    <div className="orders-table-wrapper">
      <table className="orders-table">
        <thead>
          <tr>
            <th>Référence</th>
            <th>Fournisseur</th>
            <th>Date</th>
            <th>Statut</th>
            <th>Articles</th>
            <th>Total HT</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => {
            const status = ORDER_STATUS[order.status] || ORDER_STATUS.draft;
            return (
              <tr key={order.id} onClick={() => onView(order)} className="clickable-row">
                <td className="ref-cell"><Hash size={14} /> {order.reference}</td>
                <td>{order.supplier_name || '—'}</td>
                <td>{formatDate(order.order_date)}</td>
                <td>
                  <span className="status-badge" style={{ backgroundColor: status.color + '20', color: status.color, borderColor: status.color }}>
                    {status.icon} {status.label}
                  </span>
                </td>
                <td className="center">{order.item_count || 0}</td>
                <td className="amount">{formatCurrency(order.total_ht)}</td>
                <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn" onClick={() => onEdit(order)} title="Modifier"><Edit2 size={14} /></button>
                  <button className="icon-btn danger" onClick={() => onDelete(order)} title="Supprimer"><Trash2 size={14} /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

// ═══ Liste des devis ═══
const QuotesList = React.memo(({ quotes, onView, onEdit, onDelete, onConvert }) => {
  if (!quotes.length) return <div className="orders-empty">Aucun devis</div>;
  return (
    <div className="orders-table-wrapper">
      <table className="orders-table">
        <thead>
          <tr>
            <th>Référence</th>
            <th>Client</th>
            <th>Date</th>
            <th>Validité</th>
            <th>Statut</th>
            <th>Total HT</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map(quote => {
            const status = QUOTE_STATUS[quote.status] || QUOTE_STATUS.draft;
            return (
              <tr key={quote.id} onClick={() => onView(quote)} className="clickable-row">
                <td className="ref-cell"><Hash size={14} /> {quote.reference}</td>
                <td>{quote.client_name || '—'}</td>
                <td>{formatDate(quote.quote_date)}</td>
                <td>{formatDate(quote.validity_date)}</td>
                <td>
                  <span className="status-badge" style={{ backgroundColor: status.color + '20', color: status.color, borderColor: status.color }}>
                    {status.icon} {status.label}
                  </span>
                </td>
                <td className="amount">{formatCurrency(quote.total_ht)}</td>
                <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  {quote.status === 'accepted' && !quote.converted_to_order_id && (
                    <button className="icon-btn success" onClick={() => onConvert(quote)} title="Convertir en commande"><ArrowRight size={14} /></button>
                  )}
                  <button className="icon-btn" onClick={() => onEdit(quote)} title="Modifier"><Edit2 size={14} /></button>
                  <button className="icon-btn danger" onClick={() => onDelete(quote)} title="Supprimer"><Trash2 size={14} /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

// ═══ Liste des fournisseurs ═══
const SuppliersList = React.memo(({ suppliers, onEdit, onDelete }) => {
  if (!suppliers.length) return <div className="orders-empty">Aucun fournisseur</div>;
  return (
    <div className="orders-suppliers-grid">
      {suppliers.map(supplier => (
        <div key={supplier.id} className="supplier-card">
          <div className="supplier-card-header">
            <Building2 size={18} />
            <h3>{supplier.name}</h3>
            <div className="supplier-actions">
              <button className="icon-btn" onClick={() => onEdit(supplier)} title="Modifier"><Edit2 size={14} /></button>
              <button className="icon-btn danger" onClick={() => onDelete(supplier)} title="Supprimer"><Trash2 size={14} /></button>
            </div>
          </div>
          <div className="supplier-card-body">
            {supplier.contact_name && <div className="supplier-field"><UsersIcon size={13} /> {supplier.contact_name}</div>}
            {supplier.email && <div className="supplier-field"><Mail size={13} /> {supplier.email}</div>}
            {supplier.phone && <div className="supplier-field"><Phone size={13} /> {formatPhoneDisplay(supplier.phone)}</div>}
            {supplier.address && <div className="supplier-field"><MapPin size={13} /> {supplier.address}</div>}
          </div>
          <div className="supplier-card-footer">
            <span className="supplier-order-count">{supplier.order_count || 0} commande(s)</span>
          </div>
        </div>
      ))}
    </div>
  );
});

// ═══ Détail Commande ═══
const OrderDetail = React.memo(({ order, onBack, onEdit, onDelete, onStatusChange }) => {
  const status = ORDER_STATUS[order.status] || ORDER_STATUS.draft;
  const items = order.items || [];

  // Group items by source (affaire or requester)
  const groupedItems = useMemo(() => {
    const hasSourceInfo = items.some(it => it.source_affaire_id || it.source_requester_name);
    if (!hasSourceInfo) return null; // No grouping needed

    const groups = {};
    for (const item of items) {
      let key, label;
      if (item.source_type === 'personnel' && item.source_requester_name) {
        key = `personnel-${item.source_requester_id || item.source_requester_name}`;
        label = `👤 ${item.source_requester_name}`;
      } else if (item.source_affaire_id) {
        key = `affaire-${item.source_affaire_id}`;
        label = `📋 Affaire ${item.source_affaire_id}`;
      } else {
        key = '_other';
        label = '📦 Autres articles';
      }
      if (!groups[key]) groups[key] = { label, items: [] };
      groups[key].items.push(item);
    }
    return groups;
  }, [items]);

  return (
    <div className="order-detail">
      <div className="order-detail-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={18} /> Retour</button>
        <div className="order-detail-title">
          <h2>{order.reference}</h2>
          <span className="status-badge" style={{ backgroundColor: status.color + '20', color: status.color, borderColor: status.color }}>
            {status.icon} {status.label}
          </span>
          {groupedItems && <span className="grouped-badge">Commande groupée</span>}
        </div>
        <div className="order-detail-actions">
          {order.status === 'draft' && <button className="action-btn" onClick={() => onStatusChange('sent')}><Send size={14} /> Envoyer</button>}
          {order.status === 'sent' && <button className="action-btn" onClick={() => onStatusChange('confirmed')}><Check size={14} /> Confirmer</button>}
          {order.status === 'confirmed' && <button className="action-btn" onClick={() => onStatusChange('received')}><Package size={14} /> Réceptionner</button>}
          <button className="action-btn" onClick={onEdit}><Edit2 size={14} /> Modifier</button>
          <button className="action-btn danger" onClick={onDelete}><Trash2 size={14} /> Supprimer</button>
        </div>
      </div>

      <div className="order-detail-grid">
        <div className="detail-section">
          <h3>Informations</h3>
          <div className="detail-fields">
            <div className="detail-field"><span className="field-label">Fournisseur</span><span>{order.supplier_name || '—'}</span></div>
            <div className="detail-field"><span className="field-label">Date commande</span><span>{formatDate(order.order_date)}</span></div>
            <div className="detail-field"><span className="field-label">Date prévue</span><span>{formatDate(order.expected_date)}</span></div>
            <div className="detail-field"><span className="field-label">Affaire</span><span>{order.affaire_id || '—'}</span></div>
            <div className="detail-field"><span className="field-label">Créé par</span><span>{order.created_by_name || '—'}</span></div>
          </div>
        </div>

        <div className="detail-section">
          <h3>Montants</h3>
          <div className="detail-fields">
            <div className="detail-field"><span className="field-label">Total HT</span><span className="amount-large">{formatCurrency(order.total_ht)}</span></div>
            <div className="detail-field"><span className="field-label">TVA ({order.tva_rate}%)</span><span>{formatCurrency(order.total_ttc - order.total_ht)}</span></div>
            <div className="detail-field total"><span className="field-label">Total TTC</span><span className="amount-large">{formatCurrency(order.total_ttc)}</span></div>
          </div>
        </div>
      </div>

      {order.notes && <div className="detail-notes"><h3>Notes</h3><p>{order.notes}</p></div>}

      <div className="detail-section">
        <h3>Lignes de commande ({items.length})</h3>
        {items.length > 0 ? (
          groupedItems ? (
            /* ═══ Grouped display by affaire/requester ═══ */
            <div className="grouped-items-container">
              {Object.entries(groupedItems).map(([key, group]) => (
                <div key={key} className="grouped-items-section">
                  <div className="grouped-items-header">{group.label} <span className="grouped-count">{group.items.length}</span></div>
                  <table className="items-table">
                    <thead>
                      <tr><th>Réf</th><th>Désignation</th><th>Qté</th><th>Unité</th><th>P.U. HT</th><th>Total HT</th><th>Reçu</th></tr>
                    </thead>
                    <tbody>
                      {group.items.map(item => (
                        <tr key={item.id}>
                          <td className="ref-code">{item.ref_code || '—'}</td>
                          <td>{item.designation}</td>
                          <td className="center">{item.quantity}</td>
                          <td className="center">{item.unit}</td>
                          <td className="amount">{formatCurrency(item.unit_price_ht)}</td>
                          <td className="amount">{formatCurrency(item.total_ht)}</td>
                          <td className="center">{item.received_qty || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            /* ═══ Simple flat display ═══ */
            <table className="items-table">
              <thead>
                <tr><th>Désignation</th><th>Qté</th><th>Unité</th><th>P.U. HT</th><th>Total HT</th><th>Reçu</th></tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>{item.designation}</td>
                    <td className="center">{item.quantity}</td>
                    <td className="center">{item.unit}</td>
                    <td className="amount">{formatCurrency(item.unit_price_ht)}</td>
                    <td className="amount">{formatCurrency(item.total_ht)}</td>
                    <td className="center">{item.received_qty || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : <p className="no-items">Aucune ligne</p>}
      </div>
    </div>
  );
});

// ═══ Détail Devis ═══
const QuoteDetail = React.memo(({ quote, onBack, onEdit, onDelete, onConvert, onStatusChange }) => {
  const status = QUOTE_STATUS[quote.status] || QUOTE_STATUS.draft;
  const items = quote.items || [];
  return (
    <div className="order-detail">
      <div className="order-detail-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={18} /> Retour</button>
        <div className="order-detail-title">
          <h2>{quote.reference}</h2>
          <span className="status-badge" style={{ backgroundColor: status.color + '20', color: status.color, borderColor: status.color }}>
            {status.icon} {status.label}
          </span>
          {quote.converted_to_order_id && <span className="converted-badge"><FileCheck size={14} /> Converti en commande</span>}
        </div>
        <div className="order-detail-actions">
          {quote.status === 'draft' && <button className="action-btn" onClick={() => onStatusChange('sent')}><Send size={14} /> Envoyer</button>}
          {quote.status === 'sent' && (
            <>
              <button className="action-btn success" onClick={() => onStatusChange('accepted')}><Check size={14} /> Accepter</button>
              <button className="action-btn danger" onClick={() => onStatusChange('refused')}><X size={14} /> Refuser</button>
            </>
          )}
          {quote.status === 'accepted' && !quote.converted_to_order_id && (
            <button className="action-btn success" onClick={onConvert}><ArrowRight size={14} /> Convertir en commande</button>
          )}
          <button className="action-btn" onClick={onEdit}><Edit2 size={14} /> Modifier</button>
          <button className="action-btn danger" onClick={onDelete}><Trash2 size={14} /> Supprimer</button>
        </div>
      </div>

      <div className="order-detail-grid">
        <div className="detail-section">
          <h3>Client</h3>
          <div className="detail-fields">
            <div className="detail-field"><span className="field-label">Nom</span><span>{quote.client_name || '—'}</span></div>
            <div className="detail-field"><span className="field-label">Email</span><span>{quote.client_email || '—'}</span></div>
            <div className="detail-field"><span className="field-label">Adresse</span><span>{quote.client_address || '—'}</span></div>
          </div>
        </div>
        <div className="detail-section">
          <h3>Informations</h3>
          <div className="detail-fields">
            <div className="detail-field"><span className="field-label">Date devis</span><span>{formatDate(quote.quote_date)}</span></div>
            <div className="detail-field"><span className="field-label">Validité</span><span>{formatDate(quote.validity_date)}</span></div>
            <div className="detail-field"><span className="field-label">Affaire</span><span>{quote.affaire_id || '—'}</span></div>
            <div className="detail-field total"><span className="field-label">Total HT</span><span className="amount-large">{formatCurrency(quote.total_ht)}</span></div>
            <div className="detail-field"><span className="field-label">Total TTC</span><span className="amount-large">{formatCurrency(quote.total_ttc)}</span></div>
          </div>
        </div>
      </div>

      {quote.notes && <div className="detail-notes"><h3>Notes</h3><p>{quote.notes}</p></div>}

      <div className="detail-section">
        <h3>Lignes du devis ({items.length})</h3>
        {items.length > 0 ? (
          <table className="items-table">
            <thead>
              <tr><th>Désignation</th><th>Qté</th><th>Unité</th><th>P.U. HT</th><th>Total HT</th></tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.designation}</td>
                  <td className="center">{item.quantity}</td>
                  <td className="center">{item.unit}</td>
                  <td className="amount">{formatCurrency(item.unit_price_ht)}</td>
                  <td className="amount">{formatCurrency(item.total_ht)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="no-items">Aucune ligne</p>}
      </div>
    </div>
  );
});

// ═══ Formulaire Commande ═══
const OrderFormModal = React.memo(({ order, suppliers, onSave, onClose }) => {
  const itemIdCounter = useRef(0);
  const generateItemId = () => `item-${++itemIdCounter.current}`;
  const [form, setForm] = useState(() => {
    const items = (order?.items || [{ designation: '', quantity: 1, unit: 'u', unit_price_ht: 0 }])
      .map(i => ({ ...i, _key: generateItemId() }));
    return {
      type: order?.type || 'purchase',
      supplier_id: order?.supplier_id || '',
      affaire_id: order?.affaire_id || '',
      status: order?.status || 'draft',
      order_date: order?.order_date || new Date().toISOString().slice(0, 10),
      expected_date: order?.expected_date || '',
      tva_rate: order?.tva_rate || 20,
      notes: order?.notes || '',
      items,
    };
  });

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { designation: '', quantity: 1, unit: 'u', unit_price_ht: 0, _key: generateItemId() }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, value) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const totalHT = useMemo(() => form.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price_ht || 0), 0), [form.items]);
  const totalTTC = totalHT * (1 + (form.tva_rate || 0) / 100);

  return (
    <div className="orders-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="order-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{order ? `Modifier ${order.reference}` : 'Nouvelle commande'}</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-field">
              <label>Fournisseur</label>
              <select value={form.supplier_id} onChange={(e) => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                <option value="">— Sélectionner —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Code affaire</label>
              <input type="text" value={form.affaire_id} onChange={(e) => setForm(f => ({ ...f, affaire_id: e.target.value }))} placeholder="ex: AF32844" />
            </div>
            <div className="form-field">
              <label>Date commande</label>
              <input type="date" value={form.order_date} onChange={(e) => setForm(f => ({ ...f, order_date: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Date prévue</label>
              <input type="date" value={form.expected_date} onChange={(e) => setForm(f => ({ ...f, expected_date: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>TVA (%)</label>
              <input type="number" value={form.tva_rate} onChange={(e) => setForm(f => ({ ...f, tva_rate: parseFloat(e.target.value) || 0 }))} />
            </div>
            {order && (
              <div className="form-field">
                <label>Statut</label>
                <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
                  {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="form-items-section">
            <div className="items-header">
              <h3>Lignes de commande</h3>
              <button type="button" className="add-item-btn" onClick={addItem}><Plus size={14} /> Ajouter une ligne</button>
            </div>
            {form.items.map((item, idx) => (
              <div key={item._key} className="item-row">
                <input type="text" placeholder="Désignation" value={item.designation} onChange={(e) => updateItem(idx, 'designation', e.target.value)} className="item-designation" />
                <input type="number" placeholder="Qté" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="item-qty" />
                <select value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className="item-unit">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <input type="number" placeholder="P.U. HT" value={item.unit_price_ht} onChange={(e) => updateItem(idx, 'unit_price_ht', parseFloat(e.target.value) || 0)} step="0.01" className="item-price" />
                <span className="item-total">{formatCurrency((item.quantity || 0) * (item.unit_price_ht || 0))}</span>
                <input type="text" placeholder="Affaire / Demandeur" value={item.source_affaire_id || ''} onChange={(e) => updateItem(idx, 'source_affaire_id', e.target.value)} className="item-source" title="Affaire ou demandeur source" />
                {form.items.length > 1 && (
                  <button type="button" className="remove-item-btn" onClick={() => removeItem(idx)}><X size={14} /></button>
                )}
              </div>
            ))}
            <div className="items-totals">
              <span>Total HT: <strong>{formatCurrency(totalHT)}</strong></span>
              <span>TVA ({form.tva_rate}%): <strong>{formatCurrency(totalTTC - totalHT)}</strong></span>
              <span>Total TTC: <strong>{formatCurrency(totalTTC)}</strong></span>
            </div>
          </div>

          <div className="form-field full-width">
            <label>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Annuler</button>
          <button className="save-btn" onClick={() => onSave(form)} disabled={!form.items.some(i => i.designation)}>
            <Check size={16} /> {order ? 'Enregistrer' : 'Créer la commande'}
          </button>
        </div>
      </div>
    </div>
  );
});

// ═══ Formulaire Devis ═══
const QuoteFormModal = React.memo(({ quote, clients = [], onSave, onClose }) => {
  const itemIdCounter = useRef(0);
  const generateItemId = () => `item-${++itemIdCounter.current}`;
  const [form, setForm] = useState(() => {
    const items = (quote?.items || [{ designation: '', quantity: 1, unit: 'u', unit_price_ht: 0 }])
      .map(i => ({ ...i, _key: generateItemId() }));
    return {
      client_name: quote?.client_name || '',
      client_email: quote?.client_email || '',
      client_address: quote?.client_address || '',
      affaire_id: quote?.affaire_id || '',
      status: quote?.status || 'draft',
      quote_date: quote?.quote_date || new Date().toISOString().slice(0, 10),
      validity_date: quote?.validity_date || '',
      tva_rate: quote?.tva_rate || 20,
      notes: quote?.notes || '',
      items,
    };
  });

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { designation: '', quantity: 1, unit: 'u', unit_price_ht: 0, _key: generateItemId() }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, value) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const totalHT = useMemo(() => form.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price_ht || 0), 0), [form.items]);
  const totalTTC = totalHT * (1 + (form.tva_rate || 0) / 100);

  return (
    <div className="orders-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="order-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{quote ? `Modifier ${quote.reference}` : 'Nouveau devis'}</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-field">
              <label>Nom client</label>
              <input type="text" value={form.client_name} onChange={(e) => setForm(f => ({ ...f, client_name: e.target.value }))} list="quote-clients-autocomplete" />
              <datalist id="quote-clients-autocomplete">
                {clients.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div className="form-field">
              <label>Email client</label>
              <input type="email" value={form.client_email} onChange={(e) => setForm(f => ({ ...f, client_email: e.target.value }))} />
            </div>
            <div className="form-field full-width">
              <label>Adresse client</label>
              <AddressAutocomplete value={form.client_address} onChange={(val) => setForm(f => ({ ...f, client_address: val }))} />
            </div>
            <div className="form-field">
              <label>Code affaire</label>
              <input type="text" value={form.affaire_id} onChange={(e) => setForm(f => ({ ...f, affaire_id: e.target.value }))} placeholder="ex: AF32844" />
            </div>
            <div className="form-field">
              <label>Date devis</label>
              <input type="date" value={form.quote_date} onChange={(e) => setForm(f => ({ ...f, quote_date: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Validité</label>
              <input type="date" value={form.validity_date} onChange={(e) => setForm(f => ({ ...f, validity_date: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>TVA (%)</label>
              <input type="number" value={form.tva_rate} onChange={(e) => setForm(f => ({ ...f, tva_rate: parseFloat(e.target.value) || 0 }))} />
            </div>
            {quote && (
              <div className="form-field">
                <label>Statut</label>
                <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
                  {Object.entries(QUOTE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="form-items-section">
            <div className="items-header">
              <h3>Lignes du devis</h3>
              <button type="button" className="add-item-btn" onClick={addItem}><Plus size={14} /> Ajouter une ligne</button>
            </div>
            {form.items.map((item, idx) => (
              <div key={item._key} className="item-row">
                <input type="text" placeholder="Désignation" value={item.designation} onChange={(e) => updateItem(idx, 'designation', e.target.value)} className="item-designation" />
                <input type="number" placeholder="Qté" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="item-qty" />
                <select value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className="item-unit">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <input type="number" placeholder="P.U. HT" value={item.unit_price_ht} onChange={(e) => updateItem(idx, 'unit_price_ht', parseFloat(e.target.value) || 0)} step="0.01" className="item-price" />
                <span className="item-total">{formatCurrency((item.quantity || 0) * (item.unit_price_ht || 0))}</span>
                {form.items.length > 1 && (
                  <button type="button" className="remove-item-btn" onClick={() => removeItem(idx)}><X size={14} /></button>
                )}
              </div>
            ))}
            <div className="items-totals">
              <span>Total HT: <strong>{formatCurrency(totalHT)}</strong></span>
              <span>TVA ({form.tva_rate}%): <strong>{formatCurrency(totalTTC - totalHT)}</strong></span>
              <span>Total TTC: <strong>{formatCurrency(totalTTC)}</strong></span>
            </div>
          </div>

          <div className="form-field full-width">
            <label>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Annuler</button>
          <button className="save-btn" onClick={() => onSave(form)} disabled={!form.items.some(i => i.designation)}>
            <Check size={16} /> {quote ? 'Enregistrer' : 'Créer le devis'}
          </button>
        </div>
      </div>
    </div>
  );
});

// ═══ Formulaire Fournisseur ═══
const SupplierFormModal = React.memo(({ supplier, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: supplier?.name || '',
    contact_name: supplier?.contact_name || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    notes: supplier?.notes || '',
  });

  return (
    <div className="orders-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="supplier-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-field">
              <label>Nom *</label>
              <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-field">
              <label>Contact</label>
              <input type="text" value={form.contact_name} onChange={(e) => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Téléphone</label>
              <PhoneInput value={form.phone} onChange={(val) => setForm(f => ({ ...f, phone: val }))} />
            </div>
            <div className="form-field full-width">
              <label>Adresse</label>
              <AddressAutocomplete value={form.address} onChange={(val) => setForm(f => ({ ...f, address: val }))} />
            </div>
            <div className="form-field full-width">
              <label>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Annuler</button>
          <button className="save-btn" onClick={() => onSave(form)} disabled={!form.name.trim()}>
            <Check size={16} /> {supplier ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
});

// ═══ Liste des demandes de matériel ═══
const MaterialRequestsList = React.memo(({ requests, isAdmin, onValidate, onDelete }) => {
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  if (!requests.length) return <div className="orders-empty"><ClipboardList size={24} /><p>Aucune demande de matériel</p></div>;
  return (
    <div className="orders-table-wrapper">
      <table className="orders-table requests-table">
        <thead>
          <tr>
            <th>Article</th>
            <th>Qté</th>
            <th>Priorité</th>
            <th>Destination</th>
            <th>Fournisseur</th>
            <th>Demandeur</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(req => {
            const status = REQUEST_STATUS[req.status] || REQUEST_STATUS.pending;
            const priority = REQUEST_PRIORITY[req.priority] || REQUEST_PRIORITY.normal;
            return (
              <React.Fragment key={req.id}>
                <tr className={req.priority === 'urgent' ? 'urgent-row' : ''}>
                  <td className="article-cell">
                    <strong>{req.article}</strong>
                    {req.ref_code && <span className="ref-small">Réf: {req.ref_code}</span>}
                    {req.affaire_id && <span className="affaire-small">Aff: {req.affaire_id}</span>}
                  </td>
                  <td className="center">{req.quantity}</td>
                  <td>
                    <span className="priority-badge" style={{ color: priority.color }}>{priority.icon} {priority.label}</span>
                  </td>
                  <td>{req.destination === 'Autre' ? req.destination_other || 'Autre' : req.destination}</td>
                  <td>{req.supplier_name || '—'}</td>
                  <td>{req.requested_by_name || req.requested_by_name_db || '—'}</td>
                  <td>
                    <span className="status-badge" style={{ backgroundColor: status.color + '20', color: status.color, borderColor: status.color }}>
                      {status.icon} {status.label}
                    </span>
                    {req.order_id && <span className="order-link-small">→ Cmd #{req.order_id}</span>}
                  </td>
                  <td className="actions-cell" onClick={e => e.stopPropagation()}>
                    {isAdmin && req.status === 'pending' && (
                      <>
                        <button className="icon-btn success" onClick={() => onValidate(req, 'approve')} title="Approuver"><Check size={14} /></button>
                        <button className="icon-btn danger" onClick={() => setRejectingId(req.id)} title="Refuser"><X size={14} /></button>
                      </>
                    )}
                    <button className="icon-btn danger" onClick={() => onDelete(req)} title="Supprimer"><Trash2 size={14} /></button>
                  </td>
                </tr>
                {rejectingId === req.id && (
                  <tr className="reject-reason-row">
                    <td colSpan={8}>
                      <div className="reject-input-row">
                        <input type="text" placeholder="Raison du refus (optionnel)" value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)} className="reject-reason-input" />
                        <button className="save-btn small" onClick={() => { onValidate(req, 'reject', rejectReason); setRejectingId(null); setRejectReason(''); }}>Confirmer refus</button>
                        <button className="cancel-btn small" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Annuler</button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

// ═══ Modal demande de matériel ═══
const MaterialRequestModal = React.memo(({ suppliers, onSave, onClose }) => {
  const [form, setForm] = useState({
    article: '', supplier_id: '', supplier_name: '', quantity: 1,
    priority: 'normal', affaire_id: '', destination: 'Stock Mag Scène',
    destination_other: '', notes: '', ref_code: '',
  });
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogResults, setCatalogResults] = useState([]);
  const [showCatalog, setShowCatalog] = useState(false);

  const searchCatalog = useCallback(async (term) => {
    if (term.length < 2) { setCatalogResults([]); return; }
    try {
      const results = await api.getCatalogEquipment({ search: term, limit: 10 });
      setCatalogResults(Array.isArray(results) ? results : results?.data || []);
    } catch { setCatalogResults([]); }
  }, []);

  const handleCatalogSelect = (item) => {
    setForm(f => ({
      ...f,
      article: item.name || item.designation || item.label || '',
      ref_code: item.reference || item.ref_code || '',
      supplier_name: item.supplier_name || item.brand || f.supplier_name,
    }));
    setShowCatalog(false);
    setCatalogSearch('');
  };

  const handleSupplierChange = (supplierId) => {
    const s = suppliers.find(su => su.id === parseInt(supplierId));
    setForm(f => ({ ...f, supplier_id: supplierId, supplier_name: s ? s.name : '' }));
  };

  return (
    <div className="orders-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="order-form-modal material-request-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><ClipboardList size={20} /> Nouvelle demande de matériel</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-field full-width">
              <label>Article *</label>
              <div className="article-input-group">
                <input type="text" value={form.article} onChange={e => setForm(f => ({ ...f, article: e.target.value }))} 
                  placeholder="Nom de l'article" />
                <button type="button" className="catalog-search-btn" onClick={() => setShowCatalog(!showCatalog)} title="Chercher dans catalogue">
                  <Layers size={14} /> Catalogue
                </button>
              </div>
              {showCatalog && (
                <div className="catalog-search-panel">
                  <input type="text" placeholder="Rechercher dans le catalogue..." value={catalogSearch}
                    onChange={e => { setCatalogSearch(e.target.value); searchCatalog(e.target.value); }} autoFocus />
                  {catalogResults.length > 0 && (
                    <div className="catalog-results">
                      {catalogResults.map((item, i) => (
                        <div key={item.id || i} className="catalog-result-item" onClick={() => handleCatalogSelect(item)}>
                          <strong>{item.name || item.designation}</strong>
                          {item.reference && <span className="ref-small">Réf: {item.reference}</span>}
                          {(item.supplier_name || item.brand) && <span className="supplier-small">{item.supplier_name || item.brand}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="form-field">
              <label>Réf. article</label>
              <input type="text" value={form.ref_code} onChange={e => setForm(f => ({ ...f, ref_code: e.target.value }))} placeholder="Référence" />
            </div>
            <div className="form-field">
              <label>Quantité</label>
              <input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
            </div>
            <div className="form-field">
              <label>Fournisseur (optionnel)</label>
              <select value={form.supplier_id} onChange={e => handleSupplierChange(e.target.value)}>
                <option value="">— Non spécifié —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Priorité</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {Object.entries(REQUEST_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Affaire (optionnel)</label>
              <input type="text" value={form.affaire_id} onChange={e => setForm(f => ({ ...f, affaire_id: e.target.value }))} placeholder="ex: AF32844" />
            </div>
            <div className="form-field">
              <label>Destination</label>
              <select value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}>
                {DESTINATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {form.destination === 'Autre' && (
              <div className="form-field">
                <label>Préciser la destination</label>
                <input type="text" value={form.destination_other} onChange={e => setForm(f => ({ ...f, destination_other: e.target.value }))} placeholder="Destination..." />
              </div>
            )}
            <div className="form-field full-width">
              <label>Notes / Commentaires</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Informations supplémentaires..." />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Annuler</button>
          <button className="save-btn" onClick={() => onSave(form)} disabled={!form.article.trim()}>
            <Check size={16} /> Créer la demande
          </button>
        </div>
      </div>
    </div>
  );
});

// ═══ Liste fournisseurs enrichie (avec commandes) ═══
const EnhancedSuppliersList = React.memo(({ suppliers, onEdit, onDelete, onClick, onDoubleClick }) => {
  const clickTimerRef = useRef(null);

  const handleClick = (supplier) => {
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; return; }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      onClick(supplier);
    }, 250);
  };

  const handleDoubleClick = (supplier) => {
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
    onDoubleClick(supplier);
  };

  if (!suppliers.length) return <div className="orders-empty"><Building2 size={24} /><p>Aucun fournisseur avec commandes en cours</p></div>;
  return (
    <div className="orders-suppliers-grid enhanced">
      {suppliers.map(supplier => (
        <div key={supplier.id} className="supplier-card enhanced" onClick={() => handleClick(supplier)} onDoubleClick={() => handleDoubleClick(supplier)}>
          <div className="supplier-card-header">
            <Building2 size={18} />
            <h3>{supplier.name}</h3>
            <div className="supplier-actions" onClick={e => e.stopPropagation()}>
              <button className="icon-btn" onClick={() => onEdit(supplier)} title="Modifier"><Edit2 size={14} /></button>
              <button className="icon-btn danger" onClick={() => onDelete(supplier)} title="Supprimer"><Trash2 size={14} /></button>
            </div>
          </div>
          <div className="supplier-card-body">
            <div className="supplier-order-info">
              <span className="order-count-badge"><ShoppingCart size={14} /> {supplier.active_order_count || 0} commande(s)</span>
              {supplier.total_ht > 0 && <span className="supplier-total">{formatCurrency(supplier.total_ht)} HT</span>}
            </div>
            {supplier.order_statuses && (
              <div className="supplier-statuses">
                {supplier.order_statuses.split(',').map(s => {
                  const st = ORDER_STATUS[s.trim()];
                  return st ? <span key={s} className="mini-status" style={{ color: st.color }}>{st.icon}</span> : null;
                })}
              </div>
            )}
            {supplier.contact_name && <div className="supplier-field"><UsersIcon size={13} /> {supplier.contact_name}</div>}
            {supplier.email && <div className="supplier-field"><Mail size={13} /> {supplier.email}</div>}
            {supplier.phone && <div className="supplier-field"><Phone size={13} /> {formatPhoneDisplay(supplier.phone)}</div>}
          </div>
          <div className="supplier-card-footer enhanced">
            <span className="click-hint">Clic: commandes — Double clic: détail complet</span>
            <ChevronRight size={16} />
          </div>
        </div>
      ))}
    </div>
  );
});

// ═══ Volet fournisseur (clic simple) ═══
const SupplierPanel = React.memo(({ supplier, onClose, onViewDetail, onViewOrder }) => {
  return (
    <div className="supplier-slide-panel">
      <div className="slide-panel-header">
        <button className="back-btn" onClick={onClose}><X size={18} /></button>
        <h2><Building2 size={20} /> {supplier.name}</h2>
        <button className="action-btn" onClick={() => { onClose(); onViewDetail(supplier); }}>
          <Eye size={14} /> Détail complet
        </button>
      </div>
      <div className="slide-panel-body">
        <h3>Commandes en cours ({supplier.orders?.length || 0})</h3>
        {!supplier.orders?.length ? (
          <p className="no-items">Aucune commande en cours</p>
        ) : (
          <div className="supplier-orders-list">
            {supplier.orders.map(order => {
              const status = ORDER_STATUS[order.status] || ORDER_STATUS.draft;
              const completion = order.item_count > 0 ? Math.round((order.completed_items / order.item_count) * 100) : 0;
              return (
                <div key={order.id} className="supplier-order-card" onClick={() => { onClose(); onViewOrder(order); }}>
                  <div className="order-card-top">
                    <span className="order-ref"><Hash size={14} /> {order.reference}</span>
                    <span className="status-badge small" style={{ backgroundColor: status.color + '20', color: status.color }}>
                      {status.icon} {status.label}
                    </span>
                  </div>
                  <div className="order-card-meta">
                    <span>{formatDate(order.order_date)}</span>
                    <span>{order.item_count} article(s)</span>
                    <span>{formatCurrency(order.total_ht)} HT</span>
                  </div>
                  <div className="order-progress">
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${completion}%` }} /></div>
                    <span className="progress-text">{completion}% réceptionné</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

// ═══ Modal détail fournisseur (double clic) ═══
const SupplierDetailModal = React.memo(({ data, onClose, onViewOrder, onReload, currentUser }) => {
  const { supplier, orders, documents, workflow } = data;
  const [activeSection, setActiveSection] = useState('workflow');
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const toast = useToast();

  const handleUploadDoc = async (orderId, docType) => {
    try {
      await api.uploadSupplierDocument({
        supplier_id: supplier.id,
        order_id: orderId,
        doc_type: docType,
        filename: `${docType}-${supplier.name}-${Date.now()}`,
      });
      toast.success('Document enregistré');
      setUploadingDoc(null);
      onReload();
    } catch (error) { toast.error('Erreur: ' + error.message); }
  };

  return (
    <div className="orders-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="supplier-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><Building2 size={20} /> {supplier.name} — Détail complet</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="supplier-detail-tabs">
          <button className={activeSection === 'workflow' ? 'active' : ''} onClick={() => setActiveSection('workflow')}>
            <Layers size={14} /> Workflow
          </button>
          <button className={activeSection === 'orders' ? 'active' : ''} onClick={() => setActiveSection('orders')}>
            <ShoppingCart size={14} /> Commandes ({orders.length})
          </button>
          <button className={activeSection === 'documents' ? 'active' : ''} onClick={() => setActiveSection('documents')}>
            <FileText size={14} /> Documents ({documents.length})
          </button>
        </div>

        <div className="modal-body supplier-detail-body">
          {/* ═══ Section Workflow ═══ */}
          {activeSection === 'workflow' && (
            <div className="workflow-section">
              {workflow.map(w => (
                <div key={w.order_id} className="workflow-card">
                  <div className="workflow-card-header">
                    <Hash size={14} /> {w.reference}
                    <span className="status-badge small" style={{ backgroundColor: (ORDER_STATUS[w.status]?.color || '#666') + '20', color: ORDER_STATUS[w.status]?.color || '#666' }}>
                      {ORDER_STATUS[w.status]?.icon} {ORDER_STATUS[w.status]?.label || w.status}
                    </span>
                  </div>
                  <div className="workflow-steps">
                    <div className={`workflow-step ${w.steps.quote ? 'done' : ''}`}>
                      <div className="step-icon">{w.steps.quote ? <CheckCircle size={16} /> : <Clock size={16} />}</div>
                      <span>Devis</span>
                    </div>
                    <div className="workflow-arrow">→</div>
                    <div className={`workflow-step done`}>
                      <div className="step-icon"><CheckCircle size={16} /></div>
                      <span>Commande</span>
                    </div>
                    <div className="workflow-arrow">→</div>
                    <div className={`workflow-step ${w.steps.acknowledgment ? 'done' : ''}`}>
                      <div className="step-icon">{w.steps.acknowledgment ? <CheckCircle size={16} /> : <Clock size={16} />}</div>
                      <span>Accusé</span>
                    </div>
                    <div className="workflow-arrow">→</div>
                    <div className={`workflow-step ${w.steps.delivery_note ? 'done' : ''}`}>
                      <div className="step-icon">{w.steps.delivery_note ? <CheckCircle size={16} /> : <Clock size={16} />}</div>
                      <span>BL fourni.</span>
                    </div>
                    <div className="workflow-arrow">→</div>
                    <div className={`workflow-step ${w.steps.invoice ? 'done' : ''}`}>
                      <div className="step-icon">{w.steps.invoice ? <CheckCircle size={16} /> : <Clock size={16} />}</div>
                      <span>Facture</span>
                    </div>
                  </div>
                  <div className="workflow-progress">
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${w.completion}%` }} /></div>
                    <span>{w.completion}% réceptionné</span>
                  </div>
                  {/* Import buttons */}
                  {currentUser?.isAdmin && (
                    <div className="workflow-actions">
                      {!w.steps.quote && <button className="doc-upload-btn" onClick={() => handleUploadDoc(w.order_id, 'quote')}><FileDown size={12} /> Devis</button>}
                      {!w.steps.acknowledgment && <button className="doc-upload-btn" onClick={() => handleUploadDoc(w.order_id, 'acknowledgment')}><Receipt size={12} /> Accusé</button>}
                      {!w.steps.delivery_note && <button className="doc-upload-btn accent" onClick={() => handleUploadDoc(w.order_id, 'delivery_note')}><Package size={12} /> BL fournisseur</button>}
                      {!w.steps.invoice && <button className="doc-upload-btn" onClick={() => handleUploadDoc(w.order_id, 'invoice')}><FileText size={12} /> Facture</button>}
                    </div>
                  )}
                </div>
              ))}
              {workflow.length === 0 && <p className="no-items">Aucune commande</p>}
            </div>
          )}

          {/* ═══ Section Commandes ═══ */}
          {activeSection === 'orders' && (
            <div className="supplier-orders-section">
              {orders.map(order => {
                const status = ORDER_STATUS[order.status] || ORDER_STATUS.draft;
                return (
                  <div key={order.id} className="supplier-order-detail-card">
                    <div className="order-card-top">
                      <span className="order-ref clickable" onClick={() => { onClose(); onViewOrder(order); }}>
                        <Hash size={14} /> {order.reference}
                      </span>
                      <span className="status-badge small" style={{ backgroundColor: status.color + '20', color: status.color }}>
                        {status.icon} {status.label}
                      </span>
                      <span>{formatDate(order.order_date)}</span>
                      <span className="amount">{formatCurrency(order.total_ht)} HT</span>
                    </div>
                    {order.items?.length > 0 && (
                      <table className="items-table compact">
                        <thead><tr><th>Désignation</th><th>Qté</th><th>Reçu</th><th>Source</th></tr></thead>
                        <tbody>
                          {order.items.map(item => (
                            <tr key={item.id} className={item.received_qty >= item.quantity ? 'received-row' : ''}>
                              <td>{item.designation}</td>
                              <td className="center">{item.quantity}</td>
                              <td className="center">{item.received_qty || 0} {item.received_qty >= item.quantity && <CheckCircle size={12} className="check-green" />}</td>
                              <td className="source-cell">{item.source_affaire_id ? `Aff: ${item.source_affaire_id}` : (item.source_requester_name || '—')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
              {orders.length === 0 && <p className="no-items">Aucune commande</p>}
            </div>
          )}

          {/* ═══ Section Documents ═══ */}
          {activeSection === 'documents' && (
            <div className="supplier-docs-section">
              {Object.entries(DOC_TYPES).map(([type, info]) => {
                const docs = documents.filter(d => d.doc_type === type);
                return (
                  <div key={type} className="doc-type-group">
                    <h4>{info.icon} {info.label} ({docs.length})</h4>
                    {docs.length > 0 ? (
                      <div className="doc-list">
                        {docs.map(doc => (
                          <div key={doc.id} className="doc-item">
                            <span className="doc-filename">{doc.filename}</span>
                            <span className="doc-date">{formatDate(doc.created_at)}</span>
                            {doc.order_id && <span className="doc-order">Cmd #{doc.order_id}</span>}
                            {doc.notes && <span className="doc-notes">{doc.notes}</span>}
                          </div>
                        ))}
                      </div>
                    ) : <p className="no-docs">Aucun document</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default React.memo(OrdersPanel);
