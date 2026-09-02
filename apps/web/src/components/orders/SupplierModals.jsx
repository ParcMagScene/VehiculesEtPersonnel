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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Button,
  EntityCombobox,
  FormField,
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

import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { formatCurrency, formatDateSimple as formatDate } from '../../utils/formatUtils';
import AddressAutocomplete from '../AddressAutocomplete';
import PhoneInput from '../PhoneInput';
import { DESTINATIONS, DOC_TYPES, ORDER_STATUS, REQUEST_PRIORITY } from './ordersConstants';

function triggerOnEnterSpace(event, callback) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  callback();
}

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
          <FormField className="form-field" label="Nom" required>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </FormField>
          <FormField className="form-field" label="Contact">
            <Input
              type="text"
              value={form.contact_name}
              onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
            />
          </FormField>
          <FormField className="form-field" label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </FormField>
          <FormField className="form-field" label="Téléphone">
            <PhoneInput
              value={form.phone}
              onChange={(val) => setForm((f) => ({ ...f, phone: val }))}
            />
          </FormField>
          <FormField className="form-field full-width" label="Adresse">
            <AddressAutocomplete
              value={form.address}
              onChange={(val) => setForm((f) => ({ ...f, address: val }))}
            />
          </FormField>
          <FormField className="form-field full-width" label="Site web e-shop">
            <Input
              type="url"
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="https://..."
            />
          </FormField>
          <FormField className="form-field" label="Port forfait (EUR)">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.shipping_flat_rate}
              onChange={(e) => setForm((f) => ({ ...f, shipping_flat_rate: e.target.value }))}
              placeholder="ex: 6.90"
            />
          </FormField>
          <FormField className="form-field" label="Seuil franco (EUR)">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.shipping_free_threshold}
              onChange={(e) => setForm((f) => ({ ...f, shipping_free_threshold: e.target.value }))}
              placeholder="ex: 150"
            />
          </FormField>
          <FormField className="form-field full-width" label="Notes livraison/port">
            <Textarea
              value={form.shipping_notes}
              onChange={(e) => setForm((f) => ({ ...f, shipping_notes: e.target.value }))}
              rows={2}
              placeholder="Ex: expédition 24/48h, franco hors volumineux..."
            />
          </FormField>
          <FormField className="form-field full-width" label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </FormField>
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

// ═══ Modal approbation demande : choix commande PAR LIGNE ═══
export const ApproveRequestModal = React.memo(({ request, eligibleData, onConfirm, onClose }) => {
  const sameSupplier = useMemo(() => eligibleData?.same_supplier || [], [eligibleData]);
  const otherSupplier = useMemo(() => eligibleData?.other_supplier || [], [eligibleData]);
  const requestLines =
    Array.isArray(request?.lines) && request.lines.length > 0
      ? request.lines
      : [
          {
            id: `legacy-${request?.id}`,
            article: request?.article,
            ref_code: request?.ref_code,
            quantity: request?.quantity || 1,
            status: 'pending',
          },
        ];
  const pendingLines = requestLines.filter(
    (l) => l.status !== 'approved' && l.status !== 'rejected',
  );
  // Pré-sélection : cible mémorisée sur la demande > 1re commande même fournisseur > 'new'
  const defaultTarget = request?.target_order_id
    ? String(request.target_order_id)
    : sameSupplier[0]
      ? String(sameSupplier[0].id)
      : 'new';

  // Map line.id -> target ('new' | order_id string)
  const [targets, setTargets] = useState(() => {
    const m = {};
    for (const l of pendingLines) m[l.id] = defaultTarget;
    return m;
  });
  const [submitting, setSubmitting] = useState(false);

  const setTarget = (lineId, value) => {
    setTargets((prev) => ({ ...prev, [lineId]: value }));
  };

  const applyToAll = (value) => {
    setTargets(() => {
      const m = {};
      for (const l of pendingLines) m[l.id] = value;
      return m;
    });
  };

  const allAssigned = pendingLines.every((l) => targets[l.id]);

  const handleConfirm = async () => {
    if (!allAssigned) return;
    setSubmitting(true);
    try {
      const assignments = pendingLines.map((l) => ({
        line_id: typeof l.id === 'number' ? l.id : null,
        target_order_id: targets[l.id],
      }));
      await onConfirm(assignments);
    } finally {
      setSubmitting(false);
    }
  };

  // Options EntityCombobox (avec préfixe catégorie pour recherche).
  const comboOptions = useMemo(() => {
    const arr = [{ id: 'new', label: '➕ Nouvelle commande' }];
    for (const o of sameSupplier) {
      arr.push({
        id: String(o.id),
        label: `[Même fournisseur] ${o.reference} — ${o.supplier_name || '—'} (${o.items_count || 0} art.)`,
      });
    }
    for (const o of otherSupplier) {
      arr.push({
        id: String(o.id),
        label: `[Autre fournisseur] ${o.reference} — ${o.supplier_name || '—'} (${o.items_count || 0} art.)`,
      });
    }
    return arr;
  }, [sameSupplier, otherSupplier]);

  return (
    <Modal open={true} onClose={onClose} size="lg" className="approve-request-modal">
      <ModalHeader icon={<CheckCircle size={20} />} onClose={onClose}>
        Approuver et répartir la demande
      </ModalHeader>
      <ModalBody>
        <div className="approve-request-summary">
          <div>
            <strong>Demandeur :</strong> {request?.requested_by_name || '—'}
          </div>
          <div>
            <strong>Fournisseur demandé :</strong>{' '}
            {eligibleData?.request_supplier || request?.supplier_name || '— non spécifié —'}
          </div>
          {request?.target_order_id ? (
            <div style={{ color: 'var(--theme-accent, #2563eb)' }}>
              <strong>🎯 Commande cible demandée :</strong>{' '}
              {(() => {
                const all = [...sameSupplier, ...otherSupplier];
                const tgt = all.find((o) => String(o.id) === String(request.target_order_id));
                return tgt
                  ? `${tgt.reference}${tgt.name ? ' — ' + tgt.name : ''} (${tgt.supplier_name || '—'})`
                  : `#${request.target_order_id} (non modifiable, remplacée)`;
              })()}
            </div>
          ) : null}
          <div>
            <strong>{pendingLines.length}</strong> référence{pendingLines.length > 1 ? 's' : ''} à
            dispatcher
          </div>
        </div>

        {pendingLines.length > 1 && (
          <div className="approve-request-bulk">
            <span>Tout assigner à :</span>
            <div className="approve-request-bulk__combo">
              <EntityCombobox
                value=""
                onChange={(val) => {
                  if (val) applyToAll(val);
                }}
                options={comboOptions}
                placeholder="🔍 Rechercher une commande…"
                allowClear={false}
              />
            </div>
          </div>
        )}

        <div className="approve-request-lines">
          {pendingLines.map((line, idx) => (
            <div key={line.id} className="approve-request-line">
              <div className="approve-request-line__info">
                <strong>
                  #{idx + 1} — {line.article}
                </strong>
                <span className="approve-request-line__meta">
                  Qté: {line.quantity || 1}
                  {line.ref_code ? ` · Réf. ${line.ref_code}` : ''}
                </span>
              </div>
              <div className="approve-request-line__target">
                <EntityCombobox
                  value={targets[line.id] || ''}
                  onChange={(val) => setTarget(line.id, val || 'new')}
                  options={comboOptions}
                  placeholder="🔍 Rechercher une commande…"
                  allowClear={false}
                />
              </div>
            </div>
          ))}
        </div>

        {comboOptions.length === 1 && (
          <div className="approve-request-empty">
            Aucune commande modifiable disponible. Une nouvelle commande sera créée pour chaque
            ligne marquée « Nouvelle commande ».
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Annuler
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={submitting || !allAssigned}>
          <Check size={16} /> Approuver et répartir
        </Button>
      </ModalFooter>
    </Modal>
  );
});

// ═══ Modal sélection article depuis catalogues fournisseurs ═══
export const CatalogPickerModal = React.memo(({ onSelect, onClose }) => {
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [filterOptions, setFilterOptions] = useState({ suppliers: [], brands: [], families: [] });
  const [page, setPage] = useState(0);
  // FIX CI : déclaration manquante (régression). Liste paginée des articles du catalogue.
  const [articles, setArticles] = useState([]);
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
  }, [search, supplierFilter, brandFilter, familyFilter, page, LIMIT]);

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
  const isEditing = !!request;
  const [common, setCommon] = useState({
    supplier_id: request?.supplier_id ? String(request.supplier_id) : '',
    supplier_name: request?.supplier_name || '',
    priority: request?.priority || 'normal',
    affaire_id: request?.affaire_id || '',
    destination: request?.destination || 'Stock',
    destination_other: request?.destination_other || '',
    notes: request?.notes || '',
    target_order_id: request?.target_order_id ? String(request.target_order_id) : '',
  });
  const [openOrders, setOpenOrders] = useState([]);

  // Charger les commandes ouvertes (draft/sent) pour permettre de cibler
  // une commande existante lors de la création/édition de la demande.
  useEffect(() => {
    let cancelled = false;
    api
      .getOpenOrders()
      .then((data) => {
        if (!cancelled) setOpenOrders(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setOpenOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [lines, setLines] = useState(() => {
    // Préférer les lignes serveur si présentes (édition d'une demande multi-références).
    if (Array.isArray(request?.lines) && request.lines.length > 0) {
      return request.lines.map((l) => ({
        article: l.article || '',
        ref_code: l.ref_code || '',
        quantity: l.quantity || 1,
      }));
    }
    return [
      {
        article: request?.article || '',
        ref_code: request?.ref_code || '',
        quantity: request?.quantity || 1,
      },
    ];
  });
  const [pickerForLine, setPickerForLine] = useState(null); // index de la ligne active

  const updateLine = (idx, patch) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, { article: '', ref_code: '', quantity: 1 }]);
  };

  const removeLine = (idx) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const handleCatalogSelect = (item) => {
    if (pickerForLine === null) return;
    const idx = pickerForLine;
    updateLine(idx, {
      article: item.designation || item.name || '',
      ref_code: item.supplier_ref || item.reference || '',
    });
    // Si pas de fournisseur commun choisi, pré-remplir avec celui de l'article
    setCommon((c) => {
      if (c.supplier_id) return c;
      if (!item.supplier_id && !item.supplier_name && !item.brand) return c;
      return {
        ...c,
        supplier_id: item.supplier_id ? String(item.supplier_id) : c.supplier_id,
        supplier_name: item.supplier_name || item.brand || c.supplier_name,
      };
    });
    setPickerForLine(null);
  };

  const handleSupplierChange = (supplierId) => {
    const s = suppliers.find((su) => su.id === parseInt(supplierId));
    setCommon((c) => ({ ...c, supplier_id: supplierId, supplier_name: s ? s.name : '' }));
  };

  const validLines = lines.filter((l) => l.article.trim());
  const canSave = validLines.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const payload = {
      ...common,
      target_order_id: common.target_order_id ? Number(common.target_order_id) : null,
      lines: validLines.map((l) => ({
        article: l.article,
        ref_code: l.ref_code,
        quantity: l.quantity,
      })),
    };
    onSave(payload);
  };

  return (
    <Modal open={true} onClose={onClose} size="lg" className="material-request-modal">
      <ModalHeader icon={<ClipboardList size={20} />} onClose={onClose}>
        {isEditing ? 'Modifier la demande' : 'Nouvelle demande de matériel'}
      </ModalHeader>
      <ModalBody className="modal-body">
        <div className="form-grid">
          <FormField className="form-field" label="Fournisseur (optionnel)">
            <EntityCombobox
              value={common.supplier_id}
              onChange={(val) => handleSupplierChange(val)}
              options={suppliers}
              placeholder="— Non spécifié —"
            />
          </FormField>
          <FormField className="form-field" label="Priorité">
            <Select
              value={common.priority}
              onChange={(e) => setCommon((c) => ({ ...c, priority: e.target.value }))}
            >
              {Object.entries(REQUEST_PRIORITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField className="form-field" label="Affaire (optionnel)">
            <Input
              type="text"
              value={common.affaire_id}
              onChange={(e) => setCommon((c) => ({ ...c, affaire_id: e.target.value }))}
              placeholder="ex: AF32844"
            />
          </FormField>
          <FormField className="form-field" label="Destination">
            <Select
              value={common.destination}
              onChange={(e) => setCommon((c) => ({ ...c, destination: e.target.value }))}
            >
              {DESTINATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </FormField>
          {common.destination === 'Autre' && (
            <FormField className="form-field" label="Préciser la destination">
              <Input
                type="text"
                value={common.destination_other}
                onChange={(e) => setCommon((c) => ({ ...c, destination_other: e.target.value }))}
                placeholder="Destination..."
              />
            </FormField>
          )}
          <FormField className="form-field full-width" label="Notes / Commentaires">
            <Textarea
              value={common.notes}
              onChange={(e) => setCommon((c) => ({ ...c, notes: e.target.value }))}
              rows={2}
              placeholder="Informations supplémentaires..."
            />
          </FormField>
          <FormField
            className="form-field full-width"
            label="Ajouter à une commande existante (optionnel)"
          >
            <EntityCombobox
              value={common.target_order_id}
              onChange={(val) => setCommon((c) => ({ ...c, target_order_id: val || '' }))}
              options={(() => {
                // Priorise les commandes du même fournisseur si sélectionné
                const supId = common.supplier_id ? parseInt(common.supplier_id, 10) : null;
                const same = supId ? openOrders.filter((o) => Number(o.supplier_id) === supId) : [];
                const others = supId
                  ? openOrders.filter((o) => Number(o.supplier_id) !== supId)
                  : openOrders;
                const fmt = (o, prefix = '') =>
                  `${prefix}${o.reference}${o.name ? ' — ' + o.name : ''} · ${o.supplier_name || '—'} (${o.items_count || 0} art.)`;
                return [
                  ...same.map((o) => ({
                    id: String(o.id),
                    label: fmt(o, '[Même fourn.] '),
                  })),
                  ...others.map((o) => ({
                    id: String(o.id),
                    label: fmt(o, supId ? '[Autre fourn.] ' : ''),
                  })),
                ];
              })()}
              placeholder="— Nouvelle commande (par défaut) —"
              allowClear
            />
          </FormField>
        </div>

        <div className="material-request-lines">
          <div className="material-request-lines__head">
            <strong>
              Articles ({validLines.length}/{lines.length})
            </strong>
            <Button variant="secondary" size="sm" type="button" onClick={addLine}>
              <Check size={14} /> Ajouter une référence
            </Button>
          </div>
          {lines.map((line, idx) => (
            <div key={idx} className="material-request-line">
              <div className="material-request-line__row">
                <FormField className="form-field" label="Article" required style={{ flex: 2 }}>
                  <div className="article-input-group">
                    <Input
                      type="text"
                      value={line.article}
                      onChange={(e) => updateLine(idx, { article: e.target.value })}
                      placeholder="Nom de l'article"
                    />
                    <Tooltip content="Chercher dans les catalogues fournisseurs" position="bottom">
                      <Button
                        variant="ghost"
                        type="button"
                        className="catalog-search-btn"
                        onClick={() => setPickerForLine(idx)}
                      >
                        <Layers size={14} /> Catalogue
                      </Button>
                    </Tooltip>
                  </div>
                </FormField>
                <FormField className="form-field" label="Réf. article" style={{ flex: 1 }}>
                  <Input
                    type="text"
                    value={line.ref_code}
                    onChange={(e) => updateLine(idx, { ref_code: e.target.value })}
                    placeholder="Référence"
                  />
                </FormField>
                <FormField className="form-field" label="Quantité" style={{ width: 110 }}>
                  <Input
                    type="number"
                    min="1"
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: parseInt(e.target.value) || 1 })}
                  />
                </FormField>
                {lines.length > 1 && (
                  <div className="form-field" style={{ width: 'auto', alignSelf: 'flex-end' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => removeLine(idx)}
                      title="Retirer cette ligne"
                    >
                      ×
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!canSave}>
          <Check size={16} />{' '}
          {isEditing
            ? 'Enregistrer'
            : validLines.length > 1
              ? `Créer la demande (${validLines.length} références)`
              : 'Créer la demande'}
        </Button>
      </ModalFooter>

      {pickerForLine !== null && (
        <CatalogPickerModal onSelect={handleCatalogSelect} onClose={() => setPickerForLine(null)} />
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
        toast.error(
          error?.message
            ? `Impossible d'enregistrer le document: ${error.message}`
            : "Impossible d'enregistrer le document.",
        );
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
                          onKeyDown={(e) =>
                            triggerOnEnterSpace(e, () => {
                              onClose();
                              onViewOrder(order);
                            })
                          }
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
