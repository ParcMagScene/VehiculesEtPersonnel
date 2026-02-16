import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ShoppingCart, FileText, Search, Plus, Filter, Edit2, Trash2, ArrowLeft, 
  ChevronDown, Users as UsersIcon, Package, Send, Check, X, RefreshCw, ArrowRight, 
  Eye, Building2, Phone, Mail, MapPin, Calendar, Euro, Hash, FileCheck } from 'lucide-react';
import api from '../utils/api';
import ConfirmDialog from './ConfirmDialog';
import PhoneInput, { formatPhoneDisplay } from './PhoneInput';
import AddressAutocomplete from './AddressAutocomplete';
import './OrdersPanel.css';

// ═══ Constantes ═══
const ORDER_STATUS = {
  draft: { label: 'Brouillon', color: '#94a3b8', icon: '📝' },
  sent: { label: 'Envoyée', color: '#3b82f6', icon: '📤' },
  confirmed: { label: 'Confirmée', color: '#8b5cf6', icon: '✅' },
  partial: { label: 'Reçue partiellement', color: '#f59e0b', icon: '📦' },
  received: { label: 'Réceptionnée', color: '#10b981', icon: '✔️' },
  cancelled: { label: 'Annulée', color: '#ef4444', icon: '❌' },
};

const QUOTE_STATUS = {
  draft: { label: 'Brouillon', color: '#94a3b8', icon: '📝' },
  sent: { label: 'Envoyé', color: '#3b82f6', icon: '📤' },
  accepted: { label: 'Accepté', color: '#10b981', icon: '✅' },
  refused: { label: 'Refusé', color: '#ef4444', icon: '❌' },
  expired: { label: 'Expiré', color: '#6b7280', icon: '⏰' },
};

const UNITS = ['u', 'm', 'm²', 'm³', 'kg', 'L', 'h', 'j', 'lot', 'forfait'];

// ═══ Formatage monétaire ═══
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR');
};

// ═══ Composant Principal ═══
function OrdersPanel({ currentUser }) {
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState(null);
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

  // ═══ Chargement des données ═══
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;

      const [ordersData, quotesData, suppliersData, statsData] = await Promise.all([
        api.getOrders(params),
        api.getQuotes(params),
        api.getSuppliers(searchTerm ? { search: searchTerm } : {}),
        api.getOrdersStats()
      ]);
      setOrders(ordersData);
      setQuotes(quotesData);
      setSuppliers(suppliersData);
      setStats(statsData);
    } catch (error) {
      console.error('Erreur chargement commandes:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

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
      alert('Erreur: ' + error.message);
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
        } catch (error) { alert('Erreur: ' + error.message); }
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
    } catch (error) { alert('Erreur: ' + error.message); }
  };

  const handleViewOrder = async (order) => {
    try {
      const full = await api.getOrderById(order.id);
      setSelectedOrder(full);
    } catch (error) { alert('Erreur: ' + error.message); }
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
      alert('Erreur: ' + error.message);
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
        } catch (error) { alert('Erreur: ' + error.message); }
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
    } catch (error) { alert('Erreur: ' + error.message); }
  };

  const handleViewQuote = async (quote) => {
    try {
      const full = await api.getQuoteById(quote.id);
      setSelectedQuote(full);
    } catch (error) { alert('Erreur: ' + error.message); }
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
        } catch (error) { alert('Erreur: ' + error.message); }
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
      alert('Erreur: ' + error.message);
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
        } catch (error) { alert('Erreur: ' + error.message); }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
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
            } catch (error) { alert('Erreur: ' + error.message); }
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
            } catch (error) { alert('Erreur: ' + error.message); }
          }}
        />
        {confirmDialog && <ConfirmDialog {...confirmDialog} />}
      </div>
    );
  }

  return (
    <div className="orders-panel">
      {/* Stats bar */}
      {stats && (
        <div className="orders-stats-bar">
          <div className="orders-stat">
            <ShoppingCart size={16} />
            <span className="stat-value">{stats.orders?.total || 0}</span>
            <span className="stat-label">Commandes</span>
          </div>
          <div className="orders-stat">
            <FileText size={16} />
            <span className="stat-value">{stats.quotes?.total || 0}</span>
            <span className="stat-label">Devis</span>
          </div>
          <div className="orders-stat">
            <Building2 size={16} />
            <span className="stat-value">{stats.suppliers?.total || 0}</span>
            <span className="stat-label">Fournisseurs</span>
          </div>
          <div className="orders-stat highlight">
            <Euro size={16} />
            <span className="stat-value">{formatCurrency(stats.orders?.total_ht || 0)}</span>
            <span className="stat-label">Total commandes HT</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="orders-tabs">
        <button className={`orders-tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => { setActiveTab('orders'); setStatusFilter(''); }}>
          <ShoppingCart size={16} /> Commandes
        </button>
        <button className={`orders-tab ${activeTab === 'quotes' ? 'active' : ''}`} onClick={() => { setActiveTab('quotes'); setStatusFilter(''); }}>
          <FileText size={16} /> Devis
        </button>
        <button className={`orders-tab ${activeTab === 'suppliers' ? 'active' : ''}`} onClick={() => { setActiveTab('suppliers'); setStatusFilter(''); }}>
          <Building2 size={16} /> Fournisseurs
        </button>
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
        {activeTab !== 'suppliers' && (
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
        <button className="orders-add-btn" onClick={() => {
          if (activeTab === 'orders') { setEditingOrder(null); setShowOrderForm(true); }
          else if (activeTab === 'quotes') { setEditingQuote(null); setShowQuoteForm(true); }
          else { setEditingSupplier(null); setShowSupplierForm(true); }
        }}>
          <Plus size={16} />
          {activeTab === 'orders' ? 'Nouvelle commande' : activeTab === 'quotes' ? 'Nouveau devis' : 'Nouveau fournisseur'}
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
          {activeTab === 'suppliers' && (
            <SuppliersList suppliers={suppliers} onEdit={(s) => { setEditingSupplier(s); setShowSupplierForm(true); }} onDelete={handleDeleteSupplier} />
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
  return (
    <div className="order-detail">
      <div className="order-detail-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={18} /> Retour</button>
        <div className="order-detail-title">
          <h2>{order.reference}</h2>
          <span className="status-badge" style={{ backgroundColor: status.color + '20', color: status.color, borderColor: status.color }}>
            {status.icon} {status.label}
          </span>
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
  const [form, setForm] = useState({
    type: order?.type || 'purchase',
    supplier_id: order?.supplier_id || '',
    affaire_id: order?.affaire_id || '',
    status: order?.status || 'draft',
    order_date: order?.order_date || new Date().toISOString().slice(0, 10),
    expected_date: order?.expected_date || '',
    tva_rate: order?.tva_rate || 20,
    notes: order?.notes || '',
    items: order?.items || [{ designation: '', quantity: 1, unit: 'u', unit_price_ht: 0 }],
  });

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { designation: '', quantity: 1, unit: 'u', unit_price_ht: 0 }] }));
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
    <div className="modal-overlay" onClick={onClose}>
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
              <div key={idx} className="item-row">
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
            <Check size={16} /> {order ? 'Enregistrer' : 'Créer la commande'}
          </button>
        </div>
      </div>
    </div>
  );
});

// ═══ Formulaire Devis ═══
const QuoteFormModal = React.memo(({ quote, onSave, onClose }) => {
  const [form, setForm] = useState({
    client_name: quote?.client_name || '',
    client_email: quote?.client_email || '',
    client_address: quote?.client_address || '',
    affaire_id: quote?.affaire_id || '',
    status: quote?.status || 'draft',
    quote_date: quote?.quote_date || new Date().toISOString().slice(0, 10),
    validity_date: quote?.validity_date || '',
    tva_rate: quote?.tva_rate || 20,
    notes: quote?.notes || '',
    items: quote?.items || [{ designation: '', quantity: 1, unit: 'u', unit_price_ht: 0 }],
  });

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { designation: '', quantity: 1, unit: 'u', unit_price_ht: 0 }] }));
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="order-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{quote ? `Modifier ${quote.reference}` : 'Nouveau devis'}</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-field">
              <label>Nom client</label>
              <input type="text" value={form.client_name} onChange={(e) => setForm(f => ({ ...f, client_name: e.target.value }))} />
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
              <div key={idx} className="item-row">
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
    <div className="modal-overlay" onClick={onClose}>
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

export default React.memo(OrdersPanel);
