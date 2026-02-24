// ============================================================
// FlightcasePanel.jsx — Gestion des modèles de flight-cases
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Edit2, Trash2, X, Search, Box } from 'lucide-react';
import api from '../utils/api';
import { formatDimensions } from '../utils/deepLinking';
import './CataloguePanel.css';

export default function FlightcasePanel({ currentUser }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const isAdmin = currentUser?.isAdmin;
  const canWrite = isAdmin || currentUser?.permissions?.can_manage_catalog === true;

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      const data = await api.getFlightcases(params);
      setItems(data || []);
    } catch (e) {
      console.error('Erreur chargement flightcases:', e);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Catégories distinctes
  const categories = [...new Set(items.filter(i => i.category).map(i => i.category))].sort();

  const handleSave = async (formData) => {
    try {
      if (editItem) {
        await api.updateFlightcase(editItem.id, formData);
      } else {
        await api.createFlightcase(formData);
      }
      setShowForm(false);
      setEditItem(null);
      loadItems();
    } catch (e) {
      alert(e.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Supprimer le flight-case "${item.name}" ?`)) return;
    try {
      await api.deleteFlightcase(item.id);
      loadItems();
    } catch (e) {
      alert(e.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="flightcase-panel">
      <div className="panel-header">
        <h2><Box size={24} /> Flight-Cases</h2>
        {canWrite && (
          <button className="catalog-btn catalog-btn-primary" onClick={() => { setEditItem(null); setShowForm(true); }}>
            <Plus size={16} /> Ajouter
          </button>
        )}
      </div>

      <div className="catalog-toolbar">
        <div className="search-input" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Rechercher…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ paddingLeft: '2.25rem', width: '100%' }}
          />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="filter-count">{items.length} flight-case{items.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="catalog-empty"><p>Chargement…</p></div>
      ) : items.length === 0 ? (
        <div className="catalog-empty">
          <Box size={48} />
          <p>Aucun flight-case</p>
          <p className="empty-hint">Créez des modèles de flight-cases pour le catalogue.</p>
        </div>
      ) : (
        <div className="catalog-table-wrapper">
          <table className="catalog-table">
            <thead>
              <tr>
                <th>Code interne</th>
                <th>Nom</th>
                <th>Catégorie</th>
                <th>Dimensions</th>
                <th>Capacité</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td className="td-ref">{item.internalCode || item.internal_code || '—'}</td>
                  <td><strong>{item.name}</strong></td>
                  <td>
                    {item.category && <span className="catalog-badge catalog-badge-category">{item.category}</span>}
                  </td>
                  <td className="td-dim">{formatDimensions(item.dimensions)}</td>
                  <td>{item.capacity || 1}</td>
                  <td className="td-actions">
                    {canWrite && (
                      <>
                        <button className="catalog-btn catalog-btn-secondary catalog-btn-sm" onClick={() => { setEditItem(item); setShowForm(true); }}>
                          <Edit2 size={14} />
                        </button>
                        <button className="catalog-btn catalog-btn-danger catalog-btn-sm" onClick={() => handleDelete(item)}>
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
      )}

      {/* Placeholder aperçu 3D */}
      {items.length > 0 && (
        <div className="preview-3d-placeholder">
          <Box size={40} />
          <span>Aperçu 3D — bientôt disponible</span>
        </div>
      )}

      {showForm && (
        <FlightcaseFormModal
          item={editItem}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}

function FlightcaseFormModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    internalCode: item?.internalCode || item?.internal_code || '',
    capacity: item?.capacity || 1,
    category: item?.category || '',
    texture: item?.texture || '',
    dimW: '', dimH: '', dimD: '',
  });

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
    onSave({
      name: form.name,
      internal_code: form.internalCode || null,
      capacity: parseInt(form.capacity) || 1,
      category: form.category || null,
      texture: form.texture || null,
      dimensions: (form.dimW && form.dimH && form.dimD)
        ? { w: parseFloat(form.dimW), h: parseFloat(form.dimH), d: parseFloat(form.dimD) }
        : null,
    });
  };

  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="catalog-modal-overlay" onClick={onClose}>
      <div className="catalog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="catalog-modal-header">
          <h3><Box size={20} /> {item ? 'Modifier flight-case' : 'Nouveau flight-case'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="catalog-modal-body">
            <div className="catalog-form-row">
              <div className="catalog-form-group">
                <label>Nom *</label>
                <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
              </div>
              <div className="catalog-form-group">
                <label>Code interne</label>
                <input value={form.internalCode} onChange={(e) => update('internalCode', e.target.value)} />
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
                <label>Capacité</label>
                <input type="number" min="1" value={form.capacity} onChange={(e) => update('capacity', e.target.value)} />
              </div>
              <div className="catalog-form-group">
                <label>Catégorie</label>
                <input value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="Audio, Lumière…" />
              </div>
            </div>

            <div className="catalog-form-group">
              <label>Texture (chemin)</label>
              <input value={form.texture} onChange={(e) => update('texture', e.target.value)} placeholder="textures/fc_noir.png" />
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
