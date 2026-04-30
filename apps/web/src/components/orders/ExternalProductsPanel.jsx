// ============================================================
// ExternalProductsPanel.jsx — Catalogue e-shops multi-fournisseurs eM@g
// Produits externes, comparaison prix + port + franco, devis PDF
// ============================================================

import './ExternalProductsPanel.css';

import {
  ArrowLeft,
  Download,
  Edit2,
  ExternalLink,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button, InlineAlert, ModalLayout, SearchBar, Select, Spinner, Tag } from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

const fmt = (v) =>
  v != null
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)
    : '—';

const SHIPPING_POLICIES = [
  { value: 'flat', label: 'Forfait fixe' },
  { value: 'free', label: 'Toujours gratuit' },
  { value: 'weight', label: 'Au poids (manuel)' },
];

// ─── Formulaire produit ──────────────────────────────────────────────────────
function ProductForm({ initial = {}, onSave, onCancel, loading }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    description: initial.description || '',
    category: initial.category || '',
    image_url: initial.image_url || '',
    notes: initial.notes || '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
    >
      <div className="eshop-form-grid">
        <div className="eshop-field">
          <label>Nom *</label>
          <input
            className="eshop-input"
            value={form.name}
            onChange={set('name')}
            required
            placeholder="ex: Console de mixage, Câble XLR…"
          />
        </div>
        <div className="eshop-field">
          <label>Catégorie</label>
          <input
            className="eshop-input"
            value={form.category}
            onChange={set('category')}
            placeholder="ex: Audio, Lumière, Câblage…"
          />
        </div>
        <div className="eshop-field eshop-field--full">
          <label>Description</label>
          <textarea
            className="eshop-input"
            value={form.description}
            onChange={set('description')}
            rows={2}
            placeholder="Détails, modèle, spécifications…"
          />
        </div>
        <div className="eshop-field eshop-field--full">
          <label>URL image</label>
          <input
            className="eshop-input"
            value={form.image_url}
            onChange={set('image_url')}
            type="url"
            placeholder="https://…"
          />
        </div>
        <div className="eshop-field eshop-field--full">
          <label>Notes</label>
          <textarea className="eshop-input" value={form.notes} onChange={set('notes')} rows={2} />
        </div>
      </div>
      <div className="eshop-modal-actions">
        <Button variant="ghost" type="button" onClick={onCancel}>
          Annuler
        </Button>
        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}

// ─── Formulaire fournisseur pour un produit ──────────────────────────────────
function SupplierEntryForm({ initial = {}, suppliers = [], onSave, onCancel, loading }) {
  const [form, setForm] = useState({
    supplier_id: initial.supplier_id || '',
    supplier_name: initial.supplier_name || '',
    supplier_ref: initial.supplier_ref || '',
    price_ht: initial.price_ht ?? '',
    external_url: initial.external_url || '',
    shipping_policy: initial.shipping_policy || 'flat',
    shipping_flat_rate: initial.shipping_flat_rate ?? '',
    shipping_free_threshold: initial.shipping_free_threshold ?? '',
    notes: initial.notes || '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setNum = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Si on choisit un fournisseur connu, pré-remplir le nom
  const handleSupplierChange = (e) => {
    const id = e.target.value;
    const sup = suppliers.find((s) => String(s.id) === id);
    setForm((f) => ({
      ...f,
      supplier_id: id,
      supplier_name: sup ? sup.name : f.supplier_name,
      shipping_flat_rate:
        sup?.shipping_flat_rate != null ? String(sup.shipping_flat_rate) : f.shipping_flat_rate,
      shipping_free_threshold:
        sup?.shipping_free_threshold != null
          ? String(sup.shipping_free_threshold)
          : f.shipping_free_threshold,
    }));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...form,
          supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
          price_ht: form.price_ht !== '' ? Number(form.price_ht) : null,
          shipping_flat_rate:
            form.shipping_flat_rate !== '' ? Number(form.shipping_flat_rate) : null,
          shipping_free_threshold:
            form.shipping_free_threshold !== '' ? Number(form.shipping_free_threshold) : null,
        });
      }}
    >
      <div className="eshop-form-grid">
        <div className="eshop-field">
          <label>Fournisseur connu (optionnel)</label>
          <select className="eshop-input" value={form.supplier_id} onChange={handleSupplierChange}>
            <option value="">— Nouveau fournisseur —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="eshop-field">
          <label>Nom affiché *</label>
          <input
            className="eshop-input"
            value={form.supplier_name}
            onChange={set('supplier_name')}
            required
            placeholder="Würth, Thomann, SonoVente…"
          />
        </div>
        <div className="eshop-field">
          <label>Référence fournisseur</label>
          <input
            className="eshop-input"
            value={form.supplier_ref}
            onChange={set('supplier_ref')}
            placeholder="SKU / Ref produit"
          />
        </div>
        <div className="eshop-field">
          <label>Prix HT (€)</label>
          <input
            className="eshop-input"
            type="number"
            min="0"
            step="0.01"
            value={form.price_ht}
            onChange={setNum('price_ht')}
            placeholder="0.00"
          />
        </div>
        <div className="eshop-field eshop-field--full">
          <label>URL produit</label>
          <input
            className="eshop-input"
            type="url"
            value={form.external_url}
            onChange={set('external_url')}
            placeholder="https://…"
          />
        </div>
        <div className="eshop-field">
          <label>Politique de port</label>
          <select
            className="eshop-input"
            value={form.shipping_policy}
            onChange={set('shipping_policy')}
          >
            {SHIPPING_POLICIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {form.shipping_policy !== 'free' && (
          <>
            <div className="eshop-field">
              <label>Port forfait (€)</label>
              <input
                className="eshop-input"
                type="number"
                min="0"
                step="0.01"
                value={form.shipping_flat_rate}
                onChange={setNum('shipping_flat_rate')}
                placeholder="ex: 5.90"
              />
            </div>
            <div className="eshop-field">
              <label>Seuil de franco (€)</label>
              <input
                className="eshop-input"
                type="number"
                min="0"
                step="0.01"
                value={form.shipping_free_threshold}
                onChange={setNum('shipping_free_threshold')}
                placeholder="ex: 150.00"
              />
            </div>
          </>
        )}
        <div className="eshop-field eshop-field--full">
          <label>Notes</label>
          <input
            className="eshop-input"
            value={form.notes}
            onChange={set('notes')}
            placeholder="Délai, disponibilité, remarques…"
          />
        </div>
      </div>
      <div className="eshop-modal-actions">
        <Button variant="ghost" type="button" onClick={onCancel}>
          Annuler
        </Button>
        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}

// ─── Vue comparaison ──────────────────────────────────────────────────────────
function CompareView({ product, entries, bestId, onAddToQuote }) {
  return (
    <div className="eshop-compare">
      <h3 className="eshop-compare-title">Comparaison fournisseurs — {product.name}</h3>
      {entries.length === 0 ? (
        <p className="eshop-empty">Aucun fournisseur renseigné pour ce produit.</p>
      ) : (
        <div className="eshop-compare-table-wrap">
          <table className="eshop-compare-table">
            <thead>
              <tr>
                <th>Fournisseur</th>
                <th>Réf</th>
                <th>Prix HT</th>
                <th>Port</th>
                <th>Franco dès</th>
                <th>Total HT</th>
                <th>Lien</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className={e.id === bestId ? 'eshop-row--best' : ''}>
                  <td>
                    <span className="eshop-sup-name">{e.supplier_name}</span>
                    {e.id === bestId && (
                      <Star size={12} className="eshop-star" title="Meilleur prix" />
                    )}
                  </td>
                  <td className="eshop-mono">{e.supplier_ref || '—'}</td>
                  <td className="eshop-num">{e.price_ht > 0 ? fmt(e.price_ht) : '—'}</td>
                  <td className="eshop-num">
                    {e.is_franco ? (
                      <Tag variant="success" size="sm">
                        Franco
                      </Tag>
                    ) : e.shipping > 0 ? (
                      fmt(e.shipping)
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="eshop-num">
                    {e.shipping_free_threshold != null ? fmt(e.shipping_free_threshold) : '—'}
                  </td>
                  <td className="eshop-num eshop-total">
                    {e.price_ht > 0 ? fmt(e.total_ht) : '—'}
                  </td>
                  <td>
                    {e.external_url && (
                      <a
                        href={e.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="eshop-ext-link"
                        title="Ouvrir le lien fournisseur"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </td>
                  <td>
                    {e.price_ht > 0 && (
                      <button
                        className="eshop-btn-icon"
                        title="Ajouter au devis"
                        onClick={() => onAddToQuote(e)}
                      >
                        <ShoppingCart size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────
export default function ExternalProductsPanel({ currentUser }) {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();

  // ── État liste
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── État fiche / comparaison
  const [selected, setSelected] = useState(null); // produit ouvert
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // ── Fournisseurs globaux (pour dropdowns)
  const [suppliers, setSuppliers] = useState([]);

  // ── Modales
  const [showProductForm, setShowProductForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null); // null = nouveau
  const [supplierFormLoading, setSupplierFormLoading] = useState(false);

  // ── Devis interne
  const [quoteItems, setQuoteItems] = useState([]);
  const [showQuote, setShowQuote] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const isAdmin = currentUser?.isAdmin;
  const canWrite = isAdmin || currentUser?.permissions?.canManageCatalog === true;

  // ── Chargement liste ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.orders.getExternalProducts({
        search: search || undefined,
        category: categoryFilter || undefined,
      });
      setProducts(data.products || []);
      setTotal(data.total || 0);
      setCategories(data.categories || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Charger les fournisseurs globaux une seule fois
  useEffect(() => {
    api.orders
      .getSuppliers()
      .then(setSuppliers)
      .catch(() => {});
  }, []);

  // ── Ouvrir une fiche produit avec comparaison
  const openProduct = async (product) => {
    setSelected(product);
    setCompareData(null);
    setCompareLoading(true);
    try {
      const data = await api.orders.compareExternalProduct(product.id);
      setCompareData(data);
    } catch (_) {}
    setCompareLoading(false);
  };

  // ── CRUD produit ─────────────────────────────────────────────────────────────
  const handleSaveProduct = async (form) => {
    setFormLoading(true);
    try {
      if (editProduct?.id) {
        await api.orders.updateExternalProduct(editProduct.id, form);
        toast.success('Produit mis à jour');
      } else {
        await api.orders.createExternalProduct(form);
        toast.success('Produit créé');
      }
      setShowProductForm(false);
      setEditProduct(null);
      load();
    } catch (e) {
      toast.error(e.message || 'Erreur lors de la sauvegarde');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProduct = async (product) => {
    const ok = await confirm({
      title: 'Supprimer le produit',
      message: `Supprimer « ${product.name} » et tous ses fournisseurs associés ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.orders.deleteExternalProduct(product.id);
      toast.success('Produit supprimé');
      if (selected?.id === product.id) setSelected(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ── CRUD fournisseur par produit ─────────────────────────────────────────────
  const handleSaveSupplier = async (form) => {
    setSupplierFormLoading(true);
    try {
      if (editSupplier?.id) {
        await api.orders.updateExternalProductSupplier(editSupplier.id, form);
        toast.success('Fournisseur mis à jour');
      } else {
        await api.orders.addExternalProductSupplier({ ...form, product_id: selected.id });
        toast.success('Fournisseur ajouté');
      }
      setShowSupplierForm(false);
      setEditSupplier(null);
      // Refresh la comparaison
      if (selected) {
        const data = await api.orders.compareExternalProduct(selected.id);
        setCompareData(data);
      }
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSupplierFormLoading(false);
    }
  };

  const handleDeleteSupplier = async (entry) => {
    const ok = await confirm({
      title: 'Supprimer ce fournisseur',
      message: `Retirer « ${entry.supplier_name} » de ce produit ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.orders.deleteExternalProductSupplier(entry.id);
      toast.success('Fournisseur retiré');
      if (selected) {
        const data = await api.orders.compareExternalProduct(selected.id);
        setCompareData(data);
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ── Devis interne ────────────────────────────────────────────────────────────
  const addToQuote = (entry) => {
    setQuoteItems((prev) => {
      const existing = prev.find((i) => i.id === entry.id);
      if (existing) return prev.map((i) => (i.id === entry.id ? { ...i, qty: i.qty + 1 } : i));
      return [
        ...prev,
        {
          ...entry,
          product_name: selected?.name || '',
          qty: 1,
        },
      ];
    });
    toast.success(`${entry.supplier_name} ajouté au devis`);
  };

  const generatePdf = async () => {
    if (quoteItems.length === 0) return;
    setQuoteLoading(true);
    try {
      const blob = await api.orders.generateEshopQuotePdf('Devis interne e-shops', quoteItems);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devis-eshop-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e.message || 'Erreur génération PDF');
    } finally {
      setQuoteLoading(false);
    }
  };

  // ─── Rendu liste produits ────────────────────────────────────────────────────
  const renderList = () => (
    <div className="eshop-list">
      <div className="eshop-toolbar">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un produit…"
          className="eshop-search"
        />
        <select
          className="eshop-input eshop-filter-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button variant="ghost" onClick={load} title="Rafraîchir">
          <RefreshCw size={14} />
        </Button>
        {canWrite && (
          <Button
            variant="primary"
            onClick={() => {
              setEditProduct(null);
              setShowProductForm(true);
            }}
          >
            <Plus size={14} />
            Nouveau produit
          </Button>
        )}
      </div>

      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      {loading ? (
        <div className="eshop-loading">
          <Spinner />
        </div>
      ) : products.length === 0 ? (
        <div className="eshop-empty-state">
          <Package size={40} className="eshop-empty-icon" />
          <p>Aucun produit e-shop pour l'instant.</p>
          {canWrite && (
            <Button
              variant="primary"
              onClick={() => {
                setEditProduct(null);
                setShowProductForm(true);
              }}
            >
              <Plus size={14} /> Ajouter un produit
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="eshop-count">
            {total} produit{total > 1 ? 's' : ''}
          </p>
          <div className="eshop-grid">
            {products.map((p) => (
              <div
                key={p.id}
                className="eshop-card"
                role="button"
                tabIndex={0}
                onClick={() => openProduct(p)}
                onKeyDown={(e) => e.key === 'Enter' && openProduct(p)}
              >
                {p.image_url && <img src={p.image_url} alt={p.name} className="eshop-card-img" />}
                <div className="eshop-card-body">
                  <div className="eshop-card-head">
                    <Tag variant="info" size="sm">
                      Externe
                    </Tag>
                    {p.category && (
                      <Tag variant="default" size="sm">
                        {p.category}
                      </Tag>
                    )}
                  </div>
                  <h4 className="eshop-card-name">{p.name}</h4>
                  {p.description && <p className="eshop-card-desc">{p.description.slice(0, 80)}</p>}
                  <div className="eshop-card-footer">
                    <span className="eshop-card-sups">
                      {p.supplier_count > 0
                        ? `${p.supplier_count} fournisseur${p.supplier_count > 1 ? 's' : ''}`
                        : 'Aucun fournisseur'}
                    </span>
                    {p.min_price_ht != null && p.min_price_ht > 0 && (
                      <span className="eshop-card-price">à partir de {fmt(p.min_price_ht)}</span>
                    )}
                  </div>
                </div>
                {canWrite && (
                  <div className="eshop-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="eshop-btn-icon"
                      title="Modifier"
                      onClick={() => {
                        setEditProduct(p);
                        setShowProductForm(true);
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="eshop-btn-icon eshop-btn-danger"
                      title="Supprimer"
                      onClick={() => handleDeleteProduct(p)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ─── Rendu fiche produit ─────────────────────────────────────────────────────
  const renderDetail = () => {
    const { product, entries = [], best_id } = compareData || {};
    return (
      <div className="eshop-detail">
        <div className="eshop-detail-header">
          <Button variant="ghost" onClick={() => setSelected(null)}>
            <ArrowLeft size={14} /> Retour
          </Button>
          <h2 className="eshop-detail-title">{selected.name}</h2>
          {selected.category && <Tag variant="info">{selected.category}</Tag>}
          {canWrite && (
            <div className="eshop-detail-head-actions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditProduct(selected);
                  setShowProductForm(true);
                }}
              >
                <Edit2 size={13} /> Modifier
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditSupplier(null);
                  setShowSupplierForm(true);
                }}
              >
                <Plus size={13} /> Ajouter un fournisseur
              </Button>
            </div>
          )}
        </div>

        {selected.description && <p className="eshop-detail-desc">{selected.description}</p>}

        {compareLoading ? (
          <div className="eshop-loading">
            <Spinner />
          </div>
        ) : (
          compareData && (
            <>
              <CompareView
                product={product || selected}
                entries={entries}
                bestId={best_id}
                onAddToQuote={addToQuote}
              />
              {/* Liste avec actions sur chaque fournisseur */}
              {canWrite && entries.length > 0 && (
                <div className="eshop-supplier-actions-list">
                  {entries.map((e) => (
                    <div key={e.id} className="eshop-sup-action-row">
                      <span>{e.supplier_name}</span>
                      <div>
                        <button
                          className="eshop-btn-icon"
                          title="Modifier"
                          onClick={() => {
                            setEditSupplier(e);
                            setShowSupplierForm(true);
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="eshop-btn-icon eshop-btn-danger"
                          title="Supprimer"
                          onClick={() => handleDeleteSupplier(e)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        )}
      </div>
    );
  };

  // ─── Rendu devis flottant ─────────────────────────────────────────────────────
  const renderQuoteBadge = () => {
    if (quoteItems.length === 0) return null;
    return (
      <button className="eshop-quote-fab" onClick={() => setShowQuote(true)} title="Voir le devis">
        <ShoppingCart size={18} />
        <span className="eshop-quote-fab-count">{quoteItems.length}</span>
      </button>
    );
  };

  const renderQuotePanel = () => (
    <ModalLayout title="Devis interne e-shops" onClose={() => setShowQuote(false)} size="lg">
      {quoteItems.length === 0 ? (
        <p className="eshop-empty">Aucun article dans le devis.</p>
      ) : (
        <>
          <div className="eshop-quote-list">
            {quoteItems.map((item, idx) => (
              <div key={item.id} className="eshop-quote-row">
                <div className="eshop-quote-info">
                  <strong>{item.product_name}</strong>
                  <span className="eshop-quote-sup">{item.supplier_name}</span>
                  {item.supplier_ref && <span className="eshop-mono">{item.supplier_ref}</span>}
                </div>
                <div className="eshop-quote-nums">
                  <span>{fmt(item.price_ht)} HT</span>
                  <span>+{fmt(item.shipping)} port</span>
                  <span className="eshop-total">{fmt(item.total_ht)}</span>
                  <input
                    type="number"
                    min="1"
                    className="eshop-input eshop-qty"
                    value={item.qty}
                    onChange={(e) =>
                      setQuoteItems((prev) =>
                        prev.map((i, i2) =>
                          i2 === idx ? { ...i, qty: Math.max(1, Number(e.target.value)) } : i,
                        ),
                      )
                    }
                  />
                  <button
                    className="eshop-btn-icon eshop-btn-danger"
                    onClick={() => setQuoteItems((prev) => prev.filter((_, i2) => i2 !== idx))}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="eshop-quote-total">
            Total HT estimé :{' '}
            <strong>
              {fmt(quoteItems.reduce((s, i) => s + (i.total_ht ?? 0) * (i.qty ?? 1), 0))}
            </strong>
          </div>
          <div className="eshop-modal-actions">
            <Button variant="ghost" onClick={() => setQuoteItems([])}>
              Vider
            </Button>
            <Button variant="primary" onClick={generatePdf} disabled={quoteLoading}>
              {quoteLoading ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <Download size={14} /> Générer PDF
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </ModalLayout>
  );

  // ─── Rendu principal ──────────────────────────────────────────────────────────
  return (
    <div className="eshop-panel">
      {selected ? renderDetail() : renderList()}

      {renderQuoteBadge()}
      {showQuote && renderQuotePanel()}

      {/* Modal création / édition produit */}
      {showProductForm && (
        <ModalLayout
          title={editProduct ? 'Modifier le produit' : 'Nouveau produit e-shop'}
          onClose={() => {
            setShowProductForm(false);
            setEditProduct(null);
          }}
        >
          <ProductForm
            initial={editProduct || {}}
            onSave={handleSaveProduct}
            onCancel={() => {
              setShowProductForm(false);
              setEditProduct(null);
            }}
            loading={formLoading}
          />
        </ModalLayout>
      )}

      {/* Modal ajout / édition fournisseur */}
      {showSupplierForm && (
        <ModalLayout
          title={editSupplier ? 'Modifier le fournisseur' : 'Ajouter un fournisseur'}
          onClose={() => {
            setShowSupplierForm(false);
            setEditSupplier(null);
          }}
        >
          <SupplierEntryForm
            initial={editSupplier || {}}
            suppliers={suppliers}
            onSave={handleSaveSupplier}
            onCancel={() => {
              setShowSupplierForm(false);
              setEditSupplier(null);
            }}
            loading={supplierFormLoading}
          />
        </ModalLayout>
      )}

      {ConfirmDialogRenderer}
    </div>
  );
}
