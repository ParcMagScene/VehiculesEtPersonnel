import {
  BookOpen,
  Building2,
  Check,
  CheckCircle,
  ClipboardList,
  Clock,
  FileDown,
  FileText,
  Hash,
  Layers,
  Package,
  Receipt,
  ShoppingCart,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  Button,
  EntityCombobox,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ProgressBar,
  SearchBar,
  Select,
  Spinner,
  StatusBadge,
  Table,
  Textarea,
  Tooltip,
} from '@/design-system';

import { STATUS as _STATUS } from '../../constants';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { formatCurrency, formatDateSimple as formatDate } from '../../utils/formatUtils';
import AddressAutocomplete from '../AddressAutocomplete';
import PhoneInput from '../PhoneInput';
import {
  DESTINATIONS,
  DOC_TYPES,
  ORDER_STATUS,
  QUOTE_STATUS as _QUOTE_STATUS,
  REQUEST_PRIORITY,
} from './ordersConstants';

// ═══ Modal fournisseur (création / édition) ═══
export const SupplierFormModal = React.memo(({ supplier, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: supplier?.name || '',
    contact_name: supplier?.contact_name || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    notes: supplier?.notes || '',
    website: supplier?.website || '',
    shipping_flat_rate: supplier?.shipping_flat_rate ?? '',
    shipping_free_threshold: supplier?.shipping_free_threshold ?? '',
    shipping_notes: supplier?.shipping_notes || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        shipping_flat_rate: form.shipping_flat_rate !== '' ? Number(form.shipping_flat_rate) : null,
        shipping_free_threshold:
          form.shipping_free_threshold !== '' ? Number(form.shipping_free_threshold) : null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} size="md" className="supplier-form-modal">
      <ModalHeader onClose={onClose}>
        {supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
      </ModalHeader>
      <ModalBody>
        <div className="form-grid">
          <div className="form-field">
            <label>Nom *</label>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="form-field">
            <label>Contact</label>
            <Input
              type="text"
              value={form.contact_name}
              onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Email</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Téléphone</label>
            <PhoneInput
              value={form.phone}
              onChange={(val) => setForm((f) => ({ ...f, phone: val }))}
            />
          </div>
          <div className="form-field full-width">
            <label>Adresse</label>
            <AddressAutocomplete
              value={form.address}
              onChange={(val) => setForm((f) => ({ ...f, address: val }))}
            />
          </div>
          <div className="form-field full-width">
            <label>Site web e-shop</label>
            <Input
              type="url"
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div className="form-field">
            <label>Port forfait (EUR)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.shipping_flat_rate}
              onChange={(e) => setForm((f) => ({ ...f, shipping_flat_rate: e.target.value }))}
              placeholder="ex: 6.90"
            />
          </div>
          <div className="form-field">
            <label>Seuil franco (EUR)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.shipping_free_threshold}
              onChange={(e) => setForm((f) => ({ ...f, shipping_free_threshold: e.target.value }))}
              placeholder="ex: 150"
            />
          </div>
          <div className="form-field full-width">
            <label>Notes livraison/port</label>
            <Textarea
              value={form.shipping_notes}
              onChange={(e) => setForm((f) => ({ ...f, shipping_notes: e.target.value }))}
              rows={2}
              placeholder="Ex: expédition 24/48h, franco hors volumineux..."
            />
          </div>
          <div className="form-field full-width">
            <label>Notes</label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" onClick={save} disabled={!form.name.trim() || saving}>
          <Check size={16} />{' '}
          {saving
            ? supplier
              ? 'Enregistrement…'
              : 'Création…'
            : supplier
              ? 'Enregistrer'
              : 'Créer'}
        </Button>
      </ModalFooter>
    </Modal>
  );
});

// ═══ Modal sélection article depuis catalogues fournisseurs ═══
export const CatalogPickerModal = React.memo(({ onSelect, onClose }) => {
  const [articles, setArticles] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [filterOptions, setFilterOptions] = useState({ suppliers: [], brands: [], families: [] });
  const [page, setPage] = useState(0);
  const searchTimer = useRef(null);
  const LIMIT = 30;

  // Load filter options on mount
  useEffect(() => {
    api
      .getSupplierArticleFilters({})
      .then((data) => {
        setFilterOptions({
          suppliers: data.suppliers || [],
          brands: (data.brands || []).filter(Boolean),
          families: (data.families || []).filter(Boolean),
        });
      })
      .catch(() => {});
  }, []);

  // Load articles whenever filters or page change
  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset: page * LIMIT };
      if (search) params.search = search;
      if (supplierFilter) params.supplier_id = supplierFilter;
      if (brandFilter) params.brand_id = brandFilter;
      if (familyFilter) params.family = familyFilter;
      const data = await api.getSupplierArticles(params);
      setArticles(data.articles || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error('Erreur chargement catalogue:', e);
    } finally {
      setLoading(false);
    }
  }, [search, supplierFilter, brandFilter, familyFilter, page]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  // Debounced search
  const handleSearchChange = (val) => {
    setSearch(val);
    setPage(0);
  };

  const handleSearchInput = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => handleSearchChange(val), 300);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <Modal open={true} onClose={onClose} size="xl" className="catalog-picker-modal">
      <ModalHeader icon={<BookOpen size={20} />} onClose={onClose}>
        Sélection depuis les catalogues
      </ModalHeader>
      <ModalBody>
        <div className="catalog-picker-filters">
          <div className="catalog-picker-search">
            <SearchBar
              value={searchInput}
              onChange={handleSearchInput}
              placeholder="Rechercher par désignation, référence, marque, fournisseur…"
              autoFocus
            />
          </div>
          <div className="catalog-picker-filter-row">
            <Select
              value={supplierFilter}
              onChange={(e) => {
                setSupplierFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Tous fournisseurs</option>
              {filterOptions.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select
              value={brandFilter}
              onChange={(e) => {
                setBrandFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Toutes marques</option>
              {filterOptions.brands.map((b) => (
                <option key={b.id || b} value={b.id || b}>
                  {b.name || b}
                </option>
              ))}
            </Select>
            <Select
              value={familyFilter}
              onChange={(e) => {
                setFamilyFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Toutes familles</option>
              {filterOptions.families.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="catalog-picker-body">
          {loading ? (
            <div className="catalog-picker-loading">
              <Spinner size="lg" />
              <p>Recherche en cours…</p>
            </div>
          ) : articles.length === 0 ? (
            <div className="catalog-picker-empty">
              <Package size={40} />
              <p>
                {search || supplierFilter || brandFilter || familyFilter
                  ? 'Aucun article trouvé pour ces critères'
                  : 'Aucun article dans les catalogues'}
              </p>
            </div>
          ) : (
            <Table className="catalog-picker-table">
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th>Réf.</th>
                  <th>Marque</th>
                  <th>Famille</th>
                  <th>Prix HT</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const grouped = [];
                  let lastSupplier = null;
                  for (const art of articles) {
                    const sn = art.supplier_name || 'Sans fournisseur';
                    if (sn !== lastSupplier) {
                      grouped.push(
                        <tr
                          key={`grp-${art.supplier_id || sn}`}
                          className="catalog-picker-group-header"
                        >
                          <td colSpan={6}>
                            <Building2 size={14} /> {sn}
                          </td>
                        </tr>,
                      );
                      lastSupplier = sn;
                    }
                    grouped.push(
                      <tr
                        key={art.id}
                        className="catalog-picker-row"
                        onDoubleClick={() => onSelect(art)}
                      >
                        <td className="catalog-picker-designation">
                          <span>{art.designation}</span>
                          {art.model && <small>{art.model}</small>}
                        </td>
                        <td className="catalog-picker-ref">{art.supplier_ref || '—'}</td>
                        <td>{art.brand_canonical || art.brand || '—'}</td>
                        <td>{art.family || '—'}</td>
                        <td className="catalog-picker-price">
                          {art.price_ht ? `${Number(art.price_ht).toFixed(2)} €` : '—'}
                        </td>
                        <td>
                          <Tooltip content="Sélectionner cet article" position="bottom">
                            <Button
                              variant="ghost"
                              className="catalog-picker-select-btn"
                              onClick={() => onSelect(art)}
                            >
                              <Check size={14} /> Choisir
                            </Button>
                          </Tooltip>
                        </td>
                      </tr>,
                    );
                  }
                  return grouped;
                })()}
              </tbody>
            </Table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="catalog-picker-pagination">
            <Button variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              ← Précédent
            </Button>
            <span>
              Page {page + 1} / {totalPages} ({total} résultat{total > 1 ? 's' : ''})
            </span>
            <Button
              variant="ghost"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant →
            </Button>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
});

// ═══ Modal demande de matériel ═══
export const MaterialRequestModal = React.memo(({ request, suppliers, onSave, onClose }) => {
  const [form, setForm] = useState({
    article: request?.article || '',
    supplier_id: request?.supplier_id ? String(request.supplier_id) : '',
    supplier_name: request?.supplier_name || '',
    quantity: request?.quantity || 1,
    priority: request?.priority || 'normal',
    affaire_id: request?.affaire_id || '',
    destination: request?.destination || 'Stock',
    destination_other: request?.destination_other || '',
    notes: request?.notes || '',
    ref_code: request?.ref_code || '',
  });
  const isEditing = !!request;
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);

  const handleCatalogSelect = (item) => {
    setForm((f) => ({
      ...f,
      article: item.designation || item.name || '',
      ref_code: item.supplier_ref || item.reference || '',
      supplier_name: item.supplier_name || item.brand || f.supplier_name,
      supplier_id: item.supplier_id ? String(item.supplier_id) : f.supplier_id,
    }));
    setShowCatalogPicker(false);
  };

  const handleSupplierChange = (supplierId) => {
    const s = suppliers.find((su) => su.id === parseInt(supplierId));
    setForm((f) => ({ ...f, supplier_id: supplierId, supplier_name: s ? s.name : '' }));
  };

  return (
    <Modal open={true} onClose={onClose} size="lg" className="material-request-modal">
      <ModalHeader icon={<ClipboardList size={20} />} onClose={onClose}>
        {isEditing ? 'Modifier la demande' : 'Nouvelle demande de matériel'}
      </ModalHeader>
      <ModalBody className="modal-body">
        <div className="form-grid">
          <div className="form-field full-width">
            <label>Article *</label>
            <div className="article-input-group">
              <Input
                type="text"
                value={form.article}
                onChange={(e) => setForm((f) => ({ ...f, article: e.target.value }))}
                placeholder="Nom de l'article"
              />
              <Tooltip content="Chercher dans les catalogues fournisseurs" position="bottom">
                <Button
                  variant="ghost"
                  type="button"
                  className="catalog-search-btn"
                  onClick={() => setShowCatalogPicker(true)}
                >
                  <Layers size={14} /> Catalogue
                </Button>
              </Tooltip>
            </div>
          </div>
          <div className="form-field">
            <label>Réf. article</label>
            <Input
              type="text"
              value={form.ref_code}
              onChange={(e) => setForm((f) => ({ ...f, ref_code: e.target.value }))}
              placeholder="Référence"
            />
          </div>
          <div className="form-field">
            <label>Quantité</label>
            <Input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
            />
          </div>
          <div className="form-field">
            <label>Fournisseur (optionnel)</label>
            <EntityCombobox
              value={form.supplier_id}
              onChange={(val) => handleSupplierChange(val)}
              options={suppliers}
              placeholder="— Non spécifié —"
            />
          </div>
          <div className="form-field">
            <label>Priorité</label>
            <Select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            >
              {Object.entries(REQUEST_PRIORITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="form-field">
            <label>Affaire (optionnel)</label>
            <Input
              type="text"
              value={form.affaire_id}
              onChange={(e) => setForm((f) => ({ ...f, affaire_id: e.target.value }))}
              placeholder="ex: AF32844"
            />
          </div>
          <div className="form-field">
            <label>Destination</label>
            <Select
              value={form.destination}
              onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
            >
              {DESTINATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
          {form.destination === 'Autre' && (
            <div className="form-field">
              <label>Préciser la destination</label>
              <Input
                type="text"
                value={form.destination_other}
                onChange={(e) => setForm((f) => ({ ...f, destination_other: e.target.value }))}
                placeholder="Destination..."
              />
            </div>
          )}
          <div className="form-field full-width">
            <label>Notes / Commentaires</label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Informations supplémentaires..."
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" onClick={() => onSave(form)} disabled={!form.article.trim()}>
          <Check size={16} /> {isEditing ? 'Enregistrer' : 'Créer la demande'}
        </Button>
      </ModalFooter>

      {showCatalogPicker && (
        <CatalogPickerModal
          onSelect={handleCatalogSelect}
          onClose={() => setShowCatalogPicker(false)}
        />
      )}
    </Modal>
  );
});

// ═══ Modal détail fournisseur (double clic) ═══
export const SupplierDetailModal = React.memo(
  ({ data, onClose, onViewOrder, onReload, currentUser }) => {
    const { supplier, orders, documents, catalogs, workflow } = data;
    const [activeSection, setActiveSection] = useState('workflow');
    const [_uploadingDoc, setUploadingDoc] = useState(null);
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
      } catch (error) {
        toast.error('Erreur: ' + error.message);
      }
    };

    return (
      <Modal open={true} onClose={onClose} size="xl" className="supplier-detail-modal">
        <ModalHeader icon={<Building2 size={20} />} onClose={onClose}>
          {supplier.name} — Détail complet
        </ModalHeader>
        <ModalBody>
          <div className="supplier-detail-tabs">
            <Button
              variant="ghost"
              className={activeSection === 'workflow' ? 'active' : ''}
              onClick={() => setActiveSection('workflow')}
            >
              <Layers size={14} /> Workflow
            </Button>
            <Button
              variant="ghost"
              className={activeSection === 'orders' ? 'active' : ''}
              onClick={() => setActiveSection('orders')}
            >
              <ShoppingCart size={14} /> Commandes ({orders.length})
            </Button>
            <Button
              variant="ghost"
              className={activeSection === 'documents' ? 'active' : ''}
              onClick={() => setActiveSection('documents')}
            >
              <FileText size={14} /> Documents ({documents.length})
            </Button>
            {catalogs?.length > 0 && (
              <Button
                variant="ghost"
                className={activeSection === 'catalogs' ? 'active' : ''}
                onClick={() => setActiveSection('catalogs')}
              >
                <BookOpen size={14} /> Catalogues ({catalogs.length})
              </Button>
            )}
          </div>

          <div className="modal-body supplier-detail-body">
            {/* ═══ Section Workflow ═══ */}
            {activeSection === 'workflow' && (
              <div className="workflow-section">
                {workflow.map((w) => (
                  <div key={w.order_id} className="workflow-card">
                    <div className="workflow-card-header">
                      <Hash size={14} /> {w.reference}
                      <StatusBadge color={ORDER_STATUS[w.status]?.color || '#666'} size="sm">
                        {ORDER_STATUS[w.status]?.icon} {ORDER_STATUS[w.status]?.label || w.status}
                      </StatusBadge>
                    </div>
                    <div className="workflow-steps">
                      <div className={`workflow-step ${w.steps.quote ? 'done' : ''}`}>
                        <div className="step-icon">
                          {w.steps.quote ? <CheckCircle size={16} /> : <Clock size={16} />}
                        </div>
                        <span>Devis</span>
                      </div>
                      <div className="workflow-arrow">→</div>
                      <div className={`workflow-step done`}>
                        <div className="step-icon">
                          <CheckCircle size={16} />
                        </div>
                        <span>Commande</span>
                      </div>
                      <div className="workflow-arrow">→</div>
                      <div className={`workflow-step ${w.steps.acknowledgment ? 'done' : ''}`}>
                        <div className="step-icon">
                          {w.steps.acknowledgment ? <CheckCircle size={16} /> : <Clock size={16} />}
                        </div>
                        <span>Accusé</span>
                      </div>
                      <div className="workflow-arrow">→</div>
                      <div className={`workflow-step ${w.steps.delivery_note ? 'done' : ''}`}>
                        <div className="step-icon">
                          {w.steps.delivery_note ? <CheckCircle size={16} /> : <Clock size={16} />}
                        </div>
                        <span>BL fourni.</span>
                      </div>
                      <div className="workflow-arrow">→</div>
                      <div className={`workflow-step ${w.steps.invoice ? 'done' : ''}`}>
                        <div className="step-icon">
                          {w.steps.invoice ? <CheckCircle size={16} /> : <Clock size={16} />}
                        </div>
                        <span>Facture</span>
                      </div>
                    </div>
                    <div className="workflow-progress">
                      <ProgressBar
                        value={w.completion}
                        color="success"
                        label={`${w.completion}% réceptionné`}
                      />
                    </div>
                    {/* Import buttons */}
                    {currentUser?.isAdmin && (
                      <div className="workflow-actions">
                        {!w.steps.quote && (
                          <Button
                            variant="ghost"
                            className="doc-upload-btn"
                            onClick={() => handleUploadDoc(w.order_id, 'quote')}
                          >
                            <FileDown size={12} /> Devis
                          </Button>
                        )}
                        {!w.steps.acknowledgment && (
                          <Button
                            variant="ghost"
                            className="doc-upload-btn"
                            onClick={() => handleUploadDoc(w.order_id, 'acknowledgment')}
                          >
                            <Receipt size={12} /> Accusé
                          </Button>
                        )}
                        {!w.steps.delivery_note && (
                          <Button
                            variant="ghost"
                            className="doc-upload-btn accent"
                            onClick={() => handleUploadDoc(w.order_id, 'delivery_note')}
                          >
                            <Package size={12} /> BL fournisseur
                          </Button>
                        )}
                        {!w.steps.invoice && (
                          <Button
                            variant="ghost"
                            className="doc-upload-btn"
                            onClick={() => handleUploadDoc(w.order_id, 'invoice')}
                          >
                            <FileText size={12} /> Facture
                          </Button>
                        )}
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
                {orders.map((order) => {
                  const status = ORDER_STATUS[order.status] || ORDER_STATUS.draft;
                  return (
                    <div key={order.id} className="supplier-order-detail-card">
                      <div className="order-card-top">
                        <span
                          className="order-ref clickable"
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            onClose();
                            onViewOrder(order);
                          }}
                        >
                          <Hash size={14} /> {order.reference}
                        </span>
                        <StatusBadge color={status.color} size="sm">
                          {status.icon} {status.label}
                        </StatusBadge>
                        <span>{formatDate(order.order_date)}</span>
                        <span className="amount">{formatCurrency(order.total_ht)} HT</span>
                      </div>
                      {order.affaire_id && (
                        <div className="order-card-affaire">
                          📋{' '}
                          {order.affaire_name
                            ? `${order.affaire_id} — ${order.affaire_name}`
                            : order.affaire_id}
                        </div>
                      )}
                      {order.items?.length > 0 && (
                        <Table className="items-table compact">
                          <thead>
                            <tr>
                              <th>Désignation</th>
                              <th>Qté</th>
                              <th>Reçu</th>
                              <th>Source</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item) => (
                              <tr
                                key={item.id}
                                className={item.received_qty >= item.quantity ? 'received-row' : ''}
                              >
                                <td>{item.designation}</td>
                                <td className="center">{item.quantity}</td>
                                <td className="center">
                                  {item.received_qty || 0}{' '}
                                  {item.received_qty >= item.quantity && (
                                    <CheckCircle size={12} className="check-green" />
                                  )}
                                </td>
                                <td className="source-cell">
                                  {item.source_affaire_id
                                    ? `Aff: ${item.source_affaire_id}`
                                    : item.source_requester_name || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
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
                  const docs = documents.filter((d) => d.doc_type === type);
                  return (
                    <div key={type} className="doc-type-group">
                      <h4>
                        {info.icon} {info.label} ({docs.length})
                      </h4>
                      {docs.length > 0 ? (
                        <div className="doc-list">
                          {docs.map((doc) => (
                            <div key={doc.id} className="doc-item">
                              <span className="doc-filename">{doc.filename}</span>
                              <span className="doc-date">{formatDate(doc.created_at)}</span>
                              {doc.order_id && (
                                <span className="doc-order">Cmd #{doc.order_id}</span>
                              )}
                              {doc.notes && <span className="doc-notes">{doc.notes}</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="no-docs">Aucun document</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═══ Section Catalogues ═══ */}
            {activeSection === 'catalogs' && catalogs?.length > 0 && (
              <div className="supplier-catalogs-section">
                {catalogs.map((cat) => (
                  <a
                    key={cat.id}
                    className="catalog-detail-card"
                    href={`/catalogues/${cat.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="catalog-card-icon">
                      <BookOpen size={24} />
                    </div>
                    <div className="catalog-card-info">
                      <span className="catalog-card-name">{cat.filename}</span>
                      <div className="catalog-card-meta">
                        {cat.items_count > 0 && (
                          <span>
                            {cat.items_count} article{cat.items_count > 1 ? 's' : ''}
                          </span>
                        )}
                        {cat.page_count > 0 && (
                          <span>
                            {cat.page_count} page{cat.page_count > 1 ? 's' : ''}
                          </span>
                        )}
                        <span>{formatDate(cat.created_at)}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </ModalBody>
      </Modal>
    );
  },
);
