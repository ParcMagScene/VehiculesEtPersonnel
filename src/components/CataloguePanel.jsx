// ============================================================
// CataloguePanel.jsx — Catalogue Matériel eM@g
// Table de tous les équipements avec filtres, recherche, CRUD, deep link 3D
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Search, Plus, Edit2, Trash2, Box, X, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import { formatDimensions, buildChargementUrlForEquipment, openInChargement } from '../utils/deepLinking';
import './CataloguePanel.css';

const PAGE_SIZE = 50;

export default function CataloguePanel({ currentUser }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [families, setFamilies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [flightcases, setFlightcases] = useState([]);

  const isAdmin = currentUser?.isAdmin;
  const canWrite = isAdmin || currentUser?.permissions?.can_manage_catalog === true;

  // Charger familles et catégories
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [fam, cat, fc] = await Promise.all([
          api.getCatalogFamilies(),
          api.getCatalogCategories(),
          api.getFlightcases(),
        ]);
        setFamilies(fam || []);
        setCategories(cat || []);
        setFlightcases(fc || []);
      } catch (e) {
        console.error('Erreur chargement filtres catalogue:', e);
      }
    };
    loadFilters();
  }, []);

  // Charger les items
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (search) params.search = search;
      if (familyFilter) params.family = familyFilter;
      if (categoryFilter) params.category = categoryFilter;

      const data = await api.getCatalogEquipment(params);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error('Erreur chargement catalogue:', e);
    } finally {
      setLoading(false);
    }
  }, [page, search, familyFilter, categoryFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Recherche avec debounce
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // CRUD handlers
  const handleSave = async (formData) => {
    try {
      if (editItem) {
        await api.updateCatalogEquipment(editItem.id, formData);
      } else {
        await api.createCatalogEquipment(formData);
      }
      setShowForm(false);
      setEditItem(null);
      loadItems();
      // Recharger filtres
      const [fam, cat] = await Promise.all([api.getCatalogFamilies(), api.getCatalogCategories()]);
      setFamilies(fam || []);
      setCategories(cat || []);
    } catch (e) {
      alert(e.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Supprimer "${item.name}" du catalogue ?`)) return;
    try {
      await api.deleteCatalogEquipment(item.id);
      loadItems();
    } catch (e) {
      alert(e.message || 'Erreur lors de la suppression');
    }
  };

  const handleOpenIn3D = (item) => {
    const dims = item.dimensions ? JSON.parse(item.dimensions) : null;
    const url = buildChargementUrlForEquipment([{
      id: item.id,
      name: item.name,
      reference: item.reference,
      dimensions: dims,
      weight: item.weight,
    }]);
    openInChargement(url);
  };

  return (
    <div className="catalog-panel">
      {/* Header */}
      <div className="panel-header">
        <h2><Package size={24} /> Catalogue Matériel</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {canWrite && (
            <button className="catalog-btn catalog-btn-primary" onClick={() => { setEditItem(null); setShowForm(true); }}>
              <Plus size={16} /> Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="catalog-toolbar">
        <div className="search-input" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Rechercher par nom, référence..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ paddingLeft: '2.25rem', width: '100%' }}
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select value={familyFilter} onChange={(e) => { setFamilyFilter(e.target.value); setPage(0); }}>
          <option value="">Toutes les familles</option>
          {families.map(f => <option key={f} value={f}>{f}</option>)}
        </select>

        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}>
          <option value="">Toutes les catégories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <span className="filter-count">{total} résultat{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="catalog-empty"><p>Chargement…</p></div>
      ) : items.length === 0 ? (
        <div className="catalog-empty">
          <Package size={48} />
          <p>Aucun équipement trouvé</p>
          <p className="empty-hint">Ajoutez des équipements au catalogue ou élargissez vos filtres.</p>
        </div>
      ) : (
        <>
          <div className="catalog-table-wrapper">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Nom</th>
                  <th>Famille</th>
                  <th>Catégorie</th>
                  <th>Dimensions</th>
                  <th>Poids (kg)</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="td-ref">{item.reference || '—'}</td>
                    <td><strong>{item.name}</strong></td>
                    <td>
                      {item.family && <span className="catalog-badge catalog-badge-family">{item.family}</span>}
                    </td>
                    <td>
                      {item.category && <span className="catalog-badge catalog-badge-category">{item.category}</span>}
                    </td>
                    <td className="td-dim">{formatDimensions(item.dimensions)}</td>
                    <td className="td-weight">{item.weight ? `${item.weight} kg` : '—'}</td>
                    <td className="td-actions">
                      <button className="catalog-btn catalog-btn-3d catalog-btn-sm" onClick={() => handleOpenIn3D(item)} title="Voir dans Chargement 3D">
                        <Box size={14} /> 3D
                      </button>
                      {canWrite && (
                        <>
                          <button className="catalog-btn catalog-btn-secondary catalog-btn-sm" onClick={() => { setEditItem(item); setShowForm(true); }} title="Modifier">
                            <Edit2 size={14} />
                          </button>
                          <button className="catalog-btn catalog-btn-danger catalog-btn-sm" onClick={() => handleDelete(item)} title="Supprimer">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
              <button className="catalog-btn catalog-btn-secondary catalog-btn-sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                <ChevronLeft size={16} /> Préc.
              </button>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Page {page + 1} / {totalPages}
              </span>
              <button className="catalog-btn catalog-btn-secondary catalog-btn-sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                Suiv. <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Form */}
      {showForm && (
        <CatalogFormModal
          item={editItem}
          flightcases={flightcases}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}

// ─── Modal de création / édition ───
function CatalogFormModal({ item, flightcases, onSave, onClose }) {
  const [form, setForm] = useState({
    reference: item?.reference || '',
    name: item?.name || '',
    family: item?.family || '',
    subfamily: item?.subfamily || '',
    category: item?.category || '',
    weight: item?.weight || '',
    defaultFlightcaseId: item?.defaultFlightcaseId || item?.default_flightcase_id || '',
    dimW: '',
    dimH: '',
    dimD: '',
  });

  // Parse dimensions existantes
  useEffect(() => {
    if (item?.dimensions) {
      try {
        const dims = typeof item.dimensions === 'string' ? JSON.parse(item.dimensions) : item.dimensions;
        setForm(f => ({ ...f, dimW: dims.w || '', dimH: dims.h || '', dimD: dims.d || '' }));
      } catch (e) { /* ignore */ }
    }
  }, [item]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      reference: form.reference || null,
      name: form.name,
      family: form.family || null,
      subfamily: form.subfamily || null,
      category: form.category || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      default_flightcase_id: form.defaultFlightcaseId || null,
      dimensions: (form.dimW && form.dimH && form.dimD)
        ? { w: parseFloat(form.dimW), h: parseFloat(form.dimH), d: parseFloat(form.dimD) }
        : null,
    };
    onSave(data);
  };

  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="catalog-modal-overlay" onClick={onClose}>
      <div className="catalog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="catalog-modal-header">
          <h3><Package size={20} /> {item ? 'Modifier l\'équipement' : 'Nouvel équipement'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="catalog-modal-body">
            <div className="catalog-form-row">
              <div className="catalog-form-group">
                <label>Référence</label>
                <input value={form.reference} onChange={(e) => update('reference', e.target.value)} placeholder="REF-001" />
              </div>
              <div className="catalog-form-group">
                <label>Nom *</label>
                <input value={form.name} onChange={(e) => update('name', e.target.value)} required placeholder="Console Yamaha CL5" />
              </div>
            </div>

            <div className="catalog-form-row-3">
              <div className="catalog-form-group">
                <label>Famille</label>
                <input value={form.family} onChange={(e) => update('family', e.target.value)} placeholder="Audio" />
              </div>
              <div className="catalog-form-group">
                <label>Sous-famille</label>
                <input value={form.subfamily} onChange={(e) => update('subfamily', e.target.value)} placeholder="Consoles" />
              </div>
              <div className="catalog-form-group">
                <label>Catégorie</label>
                <input value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="Mix numérique" />
              </div>
            </div>

            <div className="catalog-form-row-3">
              <div className="catalog-form-group">
                <label>Largeur (cm)</label>
                <input type="number" step="0.1" value={form.dimW} onChange={(e) => update('dimW', e.target.value)} />
              </div>
              <div className="catalog-form-group">
                <label>Hauteur (cm)</label>
                <input type="number" step="0.1" value={form.dimH} onChange={(e) => update('dimH', e.target.value)} />
              </div>
              <div className="catalog-form-group">
                <label>Profondeur (cm)</label>
                <input type="number" step="0.1" value={form.dimD} onChange={(e) => update('dimD', e.target.value)} />
              </div>
            </div>

            <div className="catalog-form-row">
              <div className="catalog-form-group">
                <label>Poids (kg)</label>
                <input type="number" step="0.1" value={form.weight} onChange={(e) => update('weight', e.target.value)} />
              </div>
              <div className="catalog-form-group">
                <label>Flight-case par défaut</label>
                <select value={form.defaultFlightcaseId} onChange={(e) => update('defaultFlightcaseId', e.target.value)}>
                  <option value="">Aucun</option>
                  {flightcases.map(fc => (
                    <option key={fc.id} value={fc.id}>{fc.name} {fc.internalCode ? `(${fc.internalCode})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="catalog-modal-footer">
            <button type="button" className="catalog-btn catalog-btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="catalog-btn catalog-btn-primary">{item ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
