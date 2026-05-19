import {
  Archive,
  Bell,
  BookOpen,
  Building2,
  Check,
  ClipboardList,
  Euro,
  FileText,
  Filter,
  Package,
  Plus,
  ShoppingCart,
} from 'lucide-react';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

const SupplierCatalogPanel = lazy(() =>
  import('./SupplierCatalogPanel').then((m) => ({
    default: m.default || m.SupplierCatalogPanel,
  })),
);
const ExternalProductsPanel = lazy(() =>
  import('./ExternalProductsPanel').then((m) => ({
    default: m.default || m.ExternalProductsPanel,
  })),
);
import './OrdersPanel.css';

import { Button, Checkbox, SearchBar, Select } from '@/design-system';

import { STATUS } from '../../constants';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useRefreshSubscription } from '../../hooks/useRefreshSubscription';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { formatCurrency } from '../../utils/formatUtils';
import { refreshBus } from '../../utils/refresh-bus';
import { OrderFormModal, QuoteFormModal } from './OrderFormModals';
import { ORDER_STATUS, QUOTE_STATUS, REQUEST_STATUS } from './ordersConstants';
import { OrderDetailDialog, QuoteDetailDialog, RequestDetailDialog } from './OrdersDialogs';
import {
  EnhancedSuppliersList,
  MaterialRequestsList,
  MyLinkedOrdersList,
  OrdersList,
  QuotesList,
} from './OrdersListViews';
import {
  OrderSlidePanel,
  QuoteSlidePanel,
  RequestSlidePanel,
  SupplierSlidePanel,
} from './OrdersSlidePanels';
import {
  ApproveRequestModal,
  MaterialRequestModal,
  SupplierDetailModal,
  SupplierFormModal,
} from './SupplierModals';

function OrdersPanel({ currentUser, isMobile }) {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const isSimpleUser = isMobile && !currentUser?.isAdmin;
  const [activeTab, setActiveTab] = useState(isSimpleUser ? 'requests' : 'orders');
  const [orders, setOrders] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [myLinkedOrders, setMyLinkedOrders] = useState([]);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [dialogOrder, setDialogOrder] = useState(null);
  const [dialogQuote, setDialogQuote] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [dialogRequest, setDialogRequest] = useState(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editingQuote, setEditingQuote] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const clickTimerRef = useRef(null);

  const [materialRequests, setMaterialRequests] = useState([]);
  const [requestStats, setRequestStats] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [approvingRequest, setApprovingRequest] = useState(null); // { request, eligibleData }
  const [dispatchPrefill, setDispatchPrefill] = useState(null); // { request, assignments, prefillOrder, newLineIds }

  const [suppliersWithOrders, setSuppliersWithOrders] = useState([]);
  const [showArchivedSuppliers, setShowArchivedSuppliers] = useState(false);
  const [selectedSupplierPanel, setSelectedSupplierPanel] = useState(null);
  const [supplierDetailData, setSupplierDetailData] = useState(null);
  const [newSupplierId, setNewSupplierId] = useState(null);

  const [completionAlerts, setCompletionAlerts] = useState([]);

  // ═══ Chargement des données ═══
  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  const loadData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;

      if (isSimpleUser) {
        const requestParams = { ...params, requested_by: currentUser.id };
        const results = await Promise.all([
          api.getMaterialRequests(requestParams),
          api.getMaterialRequestsStats(),
          api.getMyLinkedOrders(),
          api.getSuppliers({}),
        ]);
        if (controller.signal.aborted) return;
        setMaterialRequests(results[0]);
        setRequestStats(results[1]);
        setMyLinkedOrders(results[2]);
        setSuppliers(results[3]);
      } else {
        const promises = [api.getSuppliers(searchTerm ? { search: searchTerm } : {})];
        if (activeTab === 'orders' || !orders.length) promises.push(api.getOrders(params));
        if (activeTab === 'quotes' || !quotes.length) promises.push(api.getQuotes(params));
        promises.push(api.getOrdersStats());
        if (!clients.length) promises.push(api.getClients());
        if (activeTab === 'requests') promises.push(api.getMaterialRequests(params));
        promises.push(api.getMaterialRequestsStats());
        if (activeTab === 'suppliers')
          promises.push(api.getSuppliersWithOrders(showArchivedSuppliers));
        promises.push(api.getCompletionAlerts(true));

        const results = await Promise.all(promises);
        if (controller.signal.aborted) return;

        let idx = 0;
        setSuppliers(results[idx++]);
        if (activeTab === 'orders' || !orders.length) setOrders(results[idx++]);
        if (activeTab === 'quotes' || !quotes.length) setQuotes(results[idx++]);
        setStats(results[idx++]);
        if (!clients.length && results[idx]) {
          setClients(results[idx]);
          idx++;
        } else if (!clients.length) idx++;
        if (activeTab === 'requests') setMaterialRequests(results[idx++]);
        setRequestStats(results[idx++]);
        if (activeTab === 'suppliers') setSuppliersWithOrders(results[idx++]);
        setCompletionAlerts(results[idx] || []);
      }
    } catch (error) {
      if (error.name !== 'AbortError') console.error('Erreur chargement commandes:', error);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter, activeTab, showArchivedSuppliers]);

  // Rafraîchissement silencieux des fournisseurs (sans spinner) après création/modification
  const refreshSuppliersOnly = useCallback(async () => {
    try {
      const fresh = await api.getSuppliersWithOrders(showArchivedSuppliers);
      setSuppliersWithOrders(fresh);
    } catch {
      // silencieux
    }
  }, [showArchivedSuppliers]);

  const filteredSuppliersWithOrders = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const list = term
      ? suppliersWithOrders.filter(
          (s) =>
            s.name?.toLowerCase().includes(term) ||
            s.contact_name?.toLowerCase().includes(term) ||
            s.email?.toLowerCase().includes(term) ||
            s.phone?.toLowerCase().includes(term),
        )
      : [...suppliersWithOrders];
    // Trier : nb commandes DESC, puis created_at DESC (nouveaux en tête de leur groupe)
    // newSupplierId persiste même après loadData() pour garder le highlight en tête
    return list
      .map((s) => (newSupplierId && s.id === newSupplierId ? { ...s, _new: true } : s))
      .sort(
        (a, b) =>
          (b._new ? 1 : 0) - (a._new ? 1 : 0) ||
          (b.active_order_count || 0) - (a.active_order_count || 0) ||
          new Date(b.created_at || 0) - new Date(a.created_at || 0),
      );
  }, [suppliersWithOrders, searchTerm, newSupplierId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadData(), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [loadData]);

  // Auto-refresh quand des commandes/fournisseurs/demandes changent ailleurs
  useRefreshSubscription('orders', loadData);

  // Scroll en tête de liste après création d'un fournisseur
  useEffect(() => {
    if (!newSupplierId) return;
    const wrapper = document.querySelector('.orders-table-wrapper');
    if (wrapper) wrapper.scrollTop = 0;
  }, [newSupplierId]);

  // ═══ Handlers Commandes ═══
  const handleSaveOrder = async (data) => {
    try {
      if (editingOrder) await api.updateOrder(editingOrder.id, data);
      else await api.createOrder(data);
      refreshBus.publish('orders');
      setShowOrderForm(false);
      setEditingOrder(null);
      loadData();
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };
  const handleDeleteOrder = (order) => {
    confirm({
      title: 'Supprimer la commande',
      message: `Supprimer la commande ${order.reference} ? Cette action est irréversible.`,
      onConfirm: async () => {
        try {
          await api.deleteOrder(order.id);
          refreshBus.publish('orders');
          setSelectedOrder(null);
          loadData();
        } catch (error) {
          toast.error('Erreur: ' + error.message);
        }
      },
    });
  };
  const handleEditOrder = async (order) => {
    try {
      const full = await api.getOrderById(order.id);
      setEditingOrder(full);
      setShowOrderForm(true);
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };
  const handleViewOrder = async (order) => {
    try {
      const full = await api.getOrderById(order.id);
      setSelectedOrder(full);
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };
  const handleOpenOrderDialog = async (order) => {
    try {
      const full = await api.getOrderById(order.id);
      setDialogOrder(full);
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };

  // ═══ Handlers Devis ═══
  const handleSaveQuote = async (data) => {
    try {
      if (editingQuote) await api.updateQuote(editingQuote.id, data);
      else await api.createQuote(data);
      refreshBus.publish('orders');
      setShowQuoteForm(false);
      setEditingQuote(null);
      loadData();
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };
  const handleDeleteQuote = (quote) => {
    confirm({
      title: 'Supprimer le devis',
      message: `Supprimer le devis ${quote.reference} ? Cette action est irréversible.`,
      onConfirm: async () => {
        try {
          await api.deleteQuote(quote.id);
          refreshBus.publish('orders');
          setSelectedQuote(null);
          loadData();
        } catch (error) {
          toast.error('Erreur: ' + error.message);
        }
      },
    });
  };
  const handleEditQuote = async (quote) => {
    try {
      const full = await api.getQuoteById(quote.id);
      setEditingQuote(full);
      setShowQuoteForm(true);
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };
  const handleViewQuote = async (quote) => {
    try {
      const full = await api.getQuoteById(quote.id);
      setSelectedQuote(full);
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };
  const handleOpenQuoteDialog = async (quote) => {
    try {
      const full = await api.getQuoteById(quote.id);
      setDialogQuote(full);
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };
  const handleConvertQuote = (quote) => {
    confirm({
      title: 'Convertir en commande',
      message: `Convertir le devis ${quote.reference} en bon de commande ?`,
      onConfirm: async () => {
        try {
          await api.convertQuoteToOrder(quote.id);
          refreshBus.publish('orders');
          setSelectedQuote(null);
          loadData();
        } catch (error) {
          toast.error('Erreur: ' + error.message);
        }
      },
    });
  };

  // ═══ Handlers Fournisseurs ═══
  const handleSaveSupplier = async (data) => {
    try {
      const saved = editingSupplier
        ? await api.updateSupplier(editingSupplier.id, data)
        : await api.createSupplier(data);
      refreshBus.publish('orders');
      if (!editingSupplier && saved?.id) {
        // Mise à jour optimiste immédiate + flag persistant après loadData()
        setSuppliersWithOrders((prev) => [
          {
            ...saved,
            active_order_count: 0,
            total_ht: 0,
            order_statuses: null,
            catalog_count: 0,
            _new: true,
          },
          ...prev,
        ]);
        setNewSupplierId(saved.id);
        // Effacer le highlight après 6 secondes
        setTimeout(() => setNewSupplierId(null), 6000);
      }
      toast.success(
        editingSupplier
          ? 'Fournisseur mis à jour'
          : `Fournisseur « ${saved?.name || data.name} » créé`,
      );
      setShowSupplierForm(false);
      setEditingSupplier(null);
      // Rafraîchissement silencieux : pas de spinner, l'update optimiste reste visible
      refreshSuppliersOnly();
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };
  const handleDeleteSupplier = (supplier) => {
    confirm({
      title: 'Supprimer le fournisseur',
      message: `Supprimer ${supplier.name} ? ${supplier.order_count > 0 ? `Attention: ${supplier.order_count} commande(s) liée(s).` : ''}`,
      onConfirm: async () => {
        try {
          await api.deleteSupplier(supplier.id);
          refreshBus.publish('orders');
          loadData();
        } catch (error) {
          toast.error('Erreur: ' + error.message);
        }
      },
    });
  };

  // ═══ Handlers Demandes ═══
  const handleSaveRequest = async (data) => {
    try {
      if (editingRequest) {
        await api.updateMaterialRequest(editingRequest.id, data);
        setEditingRequest(null);
        toast.success('Demande modifiée');
      } else {
        const created = await api.createMaterialRequest(data);
        const count = Array.isArray(created?.lines) ? created.lines.length : 1;
        toast.success(
          count > 1 ? `Demande créée (${count} références)` : 'Demande créée avec succès',
        );
      }
      refreshBus.publish('orders');
      setShowRequestModal(false);
      loadData();
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };
  const handleEditRequest = (request) => {
    setEditingRequest(request);
    setShowRequestModal(true);
  };
  const handleValidateRequest = async (request, action, reason = null) => {
    if (action === 'approve') {
      // Ouvrir le modal de choix : commande existante ou nouvelle
      try {
        const data = await api.getEligibleOrdersForRequest(request.id);
        setApprovingRequest({ request, eligibleData: data });
      } catch (error) {
        toast.error('Erreur chargement commandes: ' + error.message);
      }
      return;
    }
    try {
      const result = await api.validateMaterialRequest(request.id, action, reason);
      if (result.action === STATUS.APPROVED)
        toast.success(`Demande approuvée → commande ${result.order?.orderRef || ''}`);
      else toast.success('Demande refusée');
      refreshBus.publish('orders');
      loadData();
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };

  const finalizeApproval = async (requestId, assignments) => {
    try {
      const result = await api.validateMaterialRequest(requestId, 'approve', null, assignments);
      const dispatched = result?.dispatched || [];
      const distinctOrders = [...new Set(dispatched.map((d) => d.order_ref))];
      if (distinctOrders.length === 1) {
        const isNew = dispatched[0]?.isNew;
        toast.success(
          isNew
            ? `Demande approuvée → nouvelle commande ${distinctOrders[0]}`
            : `Demande approuvée → ajoutée à ${distinctOrders[0]}`,
        );
      } else {
        toast.success(
          `Demande approuvée → répartie sur ${distinctOrders.length} commandes (${distinctOrders.join(', ')})`,
        );
      }
      setApprovingRequest(null);
      setDispatchPrefill(null);
      refreshBus.publish('orders');
      loadData();
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };

  const handleConfirmApproval = async (assignments) => {
    if (!approvingRequest) return;
    const { request } = approvingRequest;
    const newOnes = assignments.filter((a) => !a.target_order_id || a.target_order_id === 'new');

    // Aucune nouvelle commande → dispatch direct.
    if (newOnes.length === 0) {
      return finalizeApproval(request.id, assignments);
    }

    // Pré-remplir OrderFormModal avec les lignes assignées "new".
    const newLineIds = new Set(newOnes.map((a) => a.line_id));
    const requestLines = Array.isArray(request.lines) ? request.lines : [];
    const linesForOrder = requestLines.filter((l) => newLineIds.has(l.id));
    if (linesForOrder.length === 0) {
      // Cas legacy (pas de table lines) : laisser le backend gérer.
      return finalizeApproval(request.id, assignments);
    }
    const prefillOrder = {
      type: 'purchase',
      supplier_id: request.supplier_id || '',
      affaire_id: request.affaire_id || '',
      status: 'draft',
      order_date: new Date().toISOString().slice(0, 10),
      tva_rate: 20,
      notes: `Commande issue de la demande matériel #${request.id} (${request.requested_by_name || ''})`,
      items: linesForOrder.map((l) => ({
        designation: l.article,
        quantity: l.quantity || 1,
        unit: 'u',
        unit_price_ht: 0,
        ref_code: l.ref_code || '',
      })),
    };
    setApprovingRequest(null);
    setDispatchPrefill({
      request,
      assignments,
      prefillOrder,
      newLineIds: linesForOrder.map((l) => l.id), // ordre des items === ordre des lignes
    });
  };

  const handleSaveDispatchOrder = async (orderData) => {
    if (!dispatchPrefill) return;
    try {
      const created = await api.createOrder(orderData);
      const newOrderId = created?.id;
      const createdItems = Array.isArray(created?.items) ? created.items : [];
      if (!newOrderId) throw new Error('Réponse création commande invalide');

      // Mapper chaque newLineId au order_item_id correspondant (même ordre).
      const lineToItem = new Map();
      dispatchPrefill.newLineIds.forEach((lineId, idx) => {
        const item = createdItems[idx];
        if (item?.id) lineToItem.set(lineId, item.id);
      });

      const finalAssignments = dispatchPrefill.assignments.map((a) => {
        const isNew = !a.target_order_id || a.target_order_id === 'new';
        if (isNew) {
          return {
            line_id: a.line_id,
            target_order_id: String(newOrderId),
            order_item_id: lineToItem.get(a.line_id) || null,
          };
        }
        return a;
      });
      await finalizeApproval(dispatchPrefill.request.id, finalAssignments);
    } catch (error) {
      toast.error('Erreur création commande: ' + error.message);
    }
  };
  const handleDeleteRequest = (request) => {
    const lineCount = Array.isArray(request.lines) ? request.lines.length : 1;
    const label =
      lineCount > 1
        ? `Supprimer la demande "${request.article}" et ses ${lineCount} références ?`
        : `Supprimer la demande "${request.article}" ?`;
    confirm({
      title: 'Supprimer la demande',
      message: label,
      onConfirm: async () => {
        try {
          await api.deleteMaterialRequest(request.id);
          refreshBus.publish('orders');
          loadData();
        } catch (error) {
          toast.error('Erreur: ' + error.message);
        }
      },
    });
  };

  // #7 Retirer une demande approuvée de sa/ses commande(s) liée(s).
  const handleDetachRequest = (request) => {
    confirm({
      title: 'Retirer de la commande',
      message: `Retirer la demande « ${request.article} » de la commande liée ? La demande repassera en attente et les lignes correspondantes seront supprimées de la commande.`,
      onConfirm: async () => {
        try {
          await api.detachMaterialRequest(request.id);
          toast.success('Demande retirée de la commande');
          loadData();
        } catch (error) {
          toast.error('Erreur: ' + (error.message || 'Impossible de retirer la demande'));
        }
      },
    });
  };

  // ═══ Handlers Fournisseurs enrichis ═══
  const handleSupplierClick = async (supplier) => {
    try {
      const [orders, catalogs] = await Promise.all([
        api.getSupplierOrders(supplier.id, showArchivedSuppliers),
        api.getSupplierCatalogs(supplier.id),
      ]);
      setSelectedSupplierPanel({ ...supplier, orders, catalogs });
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };
  const handleSupplierDoubleClick = async (supplier) => {
    try {
      const detail = await api.getSupplierFullDetail(supplier.id);
      setSupplierDetailData(detail);
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };

  const handleMarkAlertRead = async (alertId) => {
    try {
      await api.markAlertRead(alertId);
      setCompletionAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (error) {
      toast.error('Erreur: ' + error.message);
    }
  };

  // ═══ Click / double-click handlers ═══
  const handleOrderRowClick = (order) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      selectedOrder?.id === order.id ? setSelectedOrder(null) : handleViewOrder(order);
    }, 200);
  };
  const handleOrderRowDblClick = (order) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    handleOpenOrderDialog(order);
  };
  const handleQuoteRowClick = (quote) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      selectedQuote?.id === quote.id ? setSelectedQuote(null) : handleViewQuote(quote);
    }, 200);
  };
  const handleQuoteRowDblClick = (quote) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    handleOpenQuoteDialog(quote);
  };
  const handleRequestRowClick = (r) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      setSelectedRequest((prev) => (prev?.id === r.id ? null : r));
    }, 200);
  };
  const handleRequestRowDblClick = (r) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setDialogRequest(r);
  };
  const handleSupplierRowClick = async (supplier) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      handleSupplierClick(supplier);
    }, 200);
  };
  const handleSupplierRowDblClick = (supplier) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    handleSupplierDoubleClick(supplier);
  };

  // ═══ Rendu ═══
  return (
    <div className="orders-panel">
      {completionAlerts.length > 0 && (
        <div className="completion-alerts-banner">
          <Bell size={16} />
          <span>{completionAlerts.length} nouvelle(s) alerte(s) de réception</span>
          <div className="alerts-preview">
            {completionAlerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className="alert-preview-item">
                <span>{alert.message}</span>
                <Button variant="ghost" onClick={() => handleMarkAlertRead(alert.id)}>
                  <Check size={12} />
                </Button>
              </div>
            ))}
          </div>
          {completionAlerts.length > 3 && (
            <span className="alerts-more">+{completionAlerts.length - 3} autres</span>
          )}
        </div>
      )}

      <div className="orders-tabs">
        {isSimpleUser ? (
          <>
            <Button
              variant="ghost"
              className={`orders-tab ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('requests');
                setStatusFilter('');
              }}
            >
              <ClipboardList size={16} /> Mes demandes
              {requestStats?.pending > 0 && (
                <span className="tab-badge">{requestStats.pending}</span>
              )}
            </Button>
            <Button
              variant="ghost"
              className={`orders-tab ${activeTab === 'tracking' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('tracking');
                setStatusFilter('');
              }}
            >
              <Package size={16} /> Suivi commandes
              {myLinkedOrders.length > 0 && (
                <span className="tab-badge">{myLinkedOrders.length}</span>
              )}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              className={`orders-tab ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('orders');
                setStatusFilter('');
              }}
            >
              <ShoppingCart size={16} /> Commandes
            </Button>
            <Button
              variant="ghost"
              className={`orders-tab ${activeTab === 'quotes' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('quotes');
                setStatusFilter('');
              }}
            >
              <FileText size={16} /> Devis
            </Button>
            <Button
              variant="ghost"
              className={`orders-tab ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('requests');
                setStatusFilter('');
              }}
            >
              <ClipboardList size={16} /> Demandes
              {requestStats?.pending > 0 && (
                <span className="tab-badge">{requestStats.pending}</span>
              )}
            </Button>
            <Button
              variant="ghost"
              className={`orders-tab ${activeTab === 'suppliers' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('suppliers');
                setStatusFilter('');
              }}
            >
              <Building2 size={16} /> Fournisseurs
            </Button>
            <Button
              variant="ghost"
              className={`orders-tab ${activeTab === 'catalog' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('catalog');
                setStatusFilter('');
              }}
            >
              <BookOpen size={16} /> Catalogue
            </Button>
            <Button
              variant="ghost"
              className={`orders-tab ${activeTab === 'eshop' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('eshop');
                setStatusFilter('');
              }}
            >
              <ShoppingCart size={16} /> E-shops
            </Button>
          </>
        )}
        {!isSimpleUser && activeTab !== 'catalog' && stats && (
          <div className="orders-header-stats">
            <span className="stat-badge">
              <ShoppingCart size={13} /> {stats.orders?.total || 0}
            </span>
            <span className="stat-badge">
              <FileText size={13} /> {stats.quotes?.total || 0}
            </span>
            <span className="stat-badge highlight">
              <Euro size={13} /> {formatCurrency(stats.orders?.total_ht || 0)}
            </span>
            {completionAlerts.length > 0 && (
              <span
                className="stat-badge alert"
                role="button"
                tabIndex={0}
                onClick={() => setActiveTab('requests')}
              >
                <Bell size={13} /> {completionAlerts.length}
              </span>
            )}
          </div>
        )}
      </div>

      {activeTab === 'catalog' && (
        <Suspense fallback={<div className="orders-loading">Chargement du catalogue...</div>}>
          <SupplierCatalogPanel currentUser={currentUser} embedded />
        </Suspense>
      )}

      {activeTab === 'eshop' && (
        <Suspense
          fallback={<div className="orders-loading">Chargement des produits e-shop...</div>}
        >
          <ExternalProductsPanel currentUser={currentUser} />
        </Suspense>
      )}

      {activeTab !== 'catalog' && activeTab !== 'eshop' && activeTab !== 'tracking' && (
        <div className="orders-toolbar">
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Rechercher..." />
          {activeTab === 'requests' && (
            <div className="orders-filter">
              <Filter size={14} />
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tous les statuts</option>
                {Object.entries(REQUEST_STATUS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {!isSimpleUser && activeTab !== 'suppliers' && activeTab !== 'requests' && (
            <div className="orders-filter">
              <Filter size={14} />
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tous les statuts</option>
                {Object.entries(activeTab === 'orders' ? ORDER_STATUS : QUOTE_STATUS).map(
                  ([key, val]) => (
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ),
                )}
              </Select>
            </div>
          )}
          {!isSimpleUser && activeTab === 'suppliers' && (
            <label className="archived-toggle">
              <Checkbox
                checked={showArchivedSuppliers}
                onChange={(e) => setShowArchivedSuppliers(e.target.checked)}
              />
              <Archive size={14} /> Inclure archivées
            </label>
          )}
          {isSimpleUser ? (
            activeTab === 'requests' && (
              <Button
                variant="ghost"
                className="orders-add-btn"
                onClick={() => setShowRequestModal(true)}
              >
                <Plus size={16} /> Nouvelle demande
              </Button>
            )
          ) : (
            <Button
              variant="ghost"
              className="orders-add-btn"
              onClick={() => {
                if (activeTab === 'orders') {
                  setEditingOrder(null);
                  setShowOrderForm(true);
                } else if (activeTab === 'quotes') {
                  setEditingQuote(null);
                  setShowQuoteForm(true);
                } else if (activeTab === 'requests') {
                  setShowRequestModal(true);
                } else {
                  setEditingSupplier(null);
                  setShowSupplierForm(true);
                }
              }}
            >
              <Plus size={16} />
              {activeTab === 'orders'
                ? 'Nouvelle commande'
                : activeTab === 'quotes'
                  ? 'Nouveau devis'
                  : activeTab === 'requests'
                    ? 'Nouvelle demande'
                    : 'Nouveau fournisseur'}
            </Button>
          )}
        </div>
      )}

      {activeTab !== 'catalog' && activeTab !== 'tracking' && (
        <div className="orders-body">
          <div className="orders-list">
            {loading ? (
              <div className="orders-loading">Chargement...</div>
            ) : (
              <>
                {activeTab === 'orders' && (
                  <OrdersList
                    orders={orders}
                    onView={handleOrderRowClick}
                    onDoubleClick={handleOrderRowDblClick}
                    onEdit={handleEditOrder}
                    onDelete={handleDeleteOrder}
                    selectedId={selectedOrder?.id}
                  />
                )}
                {activeTab === 'quotes' && (
                  <QuotesList
                    quotes={quotes}
                    onView={handleQuoteRowClick}
                    onDoubleClick={handleQuoteRowDblClick}
                    onEdit={handleEditQuote}
                    onDelete={handleDeleteQuote}
                    onConvert={handleConvertQuote}
                    selectedId={selectedQuote?.id}
                  />
                )}
                {activeTab === 'requests' && (
                  <MaterialRequestsList
                    requests={materialRequests}
                    isAdmin={currentUser?.isAdmin}
                    isSimpleUser={isSimpleUser}
                    onValidate={handleValidateRequest}
                    onDelete={handleDeleteRequest}
                    onClick={handleRequestRowClick}
                    onDoubleClick={handleRequestRowDblClick}
                    selectedId={selectedRequest?.id}
                  />
                )}
                {activeTab === 'suppliers' && (
                  <EnhancedSuppliersList
                    suppliers={activeTab === 'suppliers' ? filteredSuppliersWithOrders : suppliers}
                    onEdit={(s) => {
                      setEditingSupplier(s);
                      setShowSupplierForm(true);
                    }}
                    onDelete={handleDeleteSupplier}
                    onClick={handleSupplierRowClick}
                    onDoubleClick={handleSupplierRowDblClick}
                    selectedId={selectedSupplierPanel?.id}
                  />
                )}
              </>
            )}
          </div>

          {activeTab === 'orders' && (
            <OrderSlidePanel
              order={selectedOrder}
              onClose={() => setSelectedOrder(null)}
              onOpenDialog={(o) => {
                setSelectedOrder(null);
                handleOpenOrderDialog(o);
              }}
              onEdit={() => handleEditOrder(selectedOrder)}
              onDelete={() => handleDeleteOrder(selectedOrder)}
              onStatusChange={async (newStatus) => {
                try {
                  await api.updateOrder(selectedOrder.id, { status: newStatus });
                  refreshBus.publish('orders');
                  const full = await api.getOrderById(selectedOrder.id);
                  setSelectedOrder(full);
                  loadData();
                } catch (error) {
                  toast.error('Erreur: ' + error.message);
                }
              }}
            />
          )}
          {activeTab === 'quotes' && (
            <QuoteSlidePanel
              quote={selectedQuote}
              onClose={() => setSelectedQuote(null)}
              onOpenDialog={(q) => {
                setSelectedQuote(null);
                handleOpenQuoteDialog(q);
              }}
              onEdit={() => handleEditQuote(selectedQuote)}
              onDelete={() => handleDeleteQuote(selectedQuote)}
              onConvert={() => handleConvertQuote(selectedQuote)}
            />
          )}
          {activeTab === 'requests' && (
            <RequestSlidePanel
              request={selectedRequest}
              onClose={() => setSelectedRequest(null)}
              onOpenDialog={(r) => {
                setSelectedRequest(null);
                setDialogRequest(r);
              }}
              isAdmin={currentUser?.isAdmin}
              onValidate={handleValidateRequest}
              onEdit={(r) => {
                setSelectedRequest(null);
                handleEditRequest(r);
              }}
            />
          )}
          {activeTab === 'suppliers' && selectedSupplierPanel && (
            <SupplierSlidePanel
              supplier={selectedSupplierPanel}
              onClose={() => setSelectedSupplierPanel(null)}
              onViewDetail={handleSupplierDoubleClick}
              onViewOrder={(o) => {
                setActiveTab('orders');
                handleOpenOrderDialog(o);
              }}
            />
          )}
        </div>
      )}

      {activeTab === 'tracking' && <MyLinkedOrdersList orders={myLinkedOrders} loading={loading} />}

      {dialogOrder && (
        <OrderDetailDialog
          order={dialogOrder}
          onClose={() => setDialogOrder(null)}
          onEdit={() => {
            setDialogOrder(null);
            handleEditOrder(dialogOrder);
          }}
          onDelete={() => {
            setDialogOrder(null);
            handleDeleteOrder(dialogOrder);
          }}
          onStatusChange={async (newStatus) => {
            try {
              await api.updateOrder(dialogOrder.id, { status: newStatus });
              refreshBus.publish('orders');
              const full = await api.getOrderById(dialogOrder.id);
              setDialogOrder(full);
              loadData();
            } catch (error) {
              toast.error('Erreur: ' + error.message);
            }
          }}
        />
      )}
      {dialogQuote && (
        <QuoteDetailDialog
          quote={dialogQuote}
          onClose={() => setDialogQuote(null)}
          onEdit={() => {
            setDialogQuote(null);
            handleEditQuote(dialogQuote);
          }}
          onDelete={() => {
            setDialogQuote(null);
            handleDeleteQuote(dialogQuote);
          }}
          onConvert={() => {
            setDialogQuote(null);
            handleConvertQuote(dialogQuote);
          }}
          onStatusChange={async (newStatus) => {
            try {
              await api.updateQuote(dialogQuote.id, { status: newStatus });
              const full = await api.getQuoteById(dialogQuote.id);
              setDialogQuote(full);
              loadData();
            } catch (error) {
              toast.error('Erreur: ' + error.message);
            }
          }}
        />
      )}
      {dialogRequest && (
        <RequestDetailDialog
          request={dialogRequest}
          onClose={() => setDialogRequest(null)}
          isAdmin={currentUser?.isAdmin}
          onValidate={handleValidateRequest}
          onDelete={handleDeleteRequest}
          onDetach={handleDetachRequest}
          onEdit={(r) => {
            setDialogRequest(null);
            handleEditRequest(r);
          }}
        />
      )}

      {showOrderForm && (
        <OrderFormModal
          order={editingOrder}
          suppliers={suppliers}
          onSave={handleSaveOrder}
          onClose={() => {
            setShowOrderForm(false);
            setEditingOrder(null);
          }}
        />
      )}
      {dispatchPrefill && (
        <OrderFormModal
          order={dispatchPrefill.prefillOrder}
          suppliers={suppliers}
          onSave={handleSaveDispatchOrder}
          onClose={() => setDispatchPrefill(null)}
        />
      )}
      {showQuoteForm && (
        <QuoteFormModal
          quote={editingQuote}
          clients={clients}
          onSave={handleSaveQuote}
          onClose={() => {
            setShowQuoteForm(false);
            setEditingQuote(null);
          }}
        />
      )}
      {showSupplierForm && (
        <SupplierFormModal
          supplier={editingSupplier}
          onSave={handleSaveSupplier}
          onClose={() => {
            setShowSupplierForm(false);
            setEditingSupplier(null);
          }}
        />
      )}
      {showRequestModal && (
        <MaterialRequestModal
          request={editingRequest}
          suppliers={suppliers}
          onSave={handleSaveRequest}
          onClose={() => {
            setShowRequestModal(false);
            setEditingRequest(null);
          }}
        />
      )}
      {approvingRequest && (
        <ApproveRequestModal
          request={approvingRequest.request}
          eligibleData={approvingRequest.eligibleData}
          onConfirm={handleConfirmApproval}
          onClose={() => setApprovingRequest(null)}
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
      {ConfirmDialogRenderer}
    </div>
  );
}

export default React.memo(OrdersPanel);
