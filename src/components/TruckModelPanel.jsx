// ============================================================
// TruckModelPanel.jsx — Modèles de camions / semi-remorques
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Edit2, Trash2, X, Search, Box, ExternalLink } from 'lucide-react';
import api from '../utils/api';
import { formatDimensions, buildChargementUrlForTruck, openInChargement } from '../utils/deepLinking';
import './CataloguePanel.css';
import { useToast } from '../hooks/useToast';

const TYPE_LABELS = {
  semi: 'Semi-remorque',
  porteur: 'Porteur',
  utilitaire: 'Utilitaire',
};

const TYPE_BADGE_CLASS = {
  semi: 'catalog-badge-semi',
  porteur: 'catalog-badge-porteur',
  utilitaire: 'catalog-badge-utilitaire',
};

export default function TruckModelPanel({ currentUser }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const isAdmin = currentUser?.isAdmin;
  const canWrite = isAdmin || currentUser?.permissions?.can_manage_trucks === true;

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      const data = await api.getTruckModels(params);
      setItems(data || []);
    } catch (e) {
      console.error('Erreur chargement truck models:', e);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSave = async (formData) => {
    try {
      if (editItem) {
        await api.updateTruckModel(editItem.id, formData);
      } else {
        await api.createTruckModel(formData);
      }
      setShowForm(false);
      setEditItem(null);
      loadItems();
    } catch (e) {
      toast.error(e.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Supprimer le modèle "${item.name}" ?`)) return;
    try {
      await api.deleteTruckModel(item.id);
      loadItems();
    } catch (e) {
      toast.error(e.message || 'Erreur lors de la suppression');
    }
  };

  const handleLoadInChargement = (item) => {
    const code = item.internalCode || item.internal_code || item.id;
    const url = buildChargementUrlForTruck(code);
    openInChargement(url);
  };

  return (
    <div className="truck-model-panel">
      <div className="panel-header">
        <h2><Truck size={24} /> Modèles de Camions</h2>
        {canWrite && (
          <button className="catalog-btn catalog-btn-primary" onClick={() => { setEditItem(null); setShowForm(true); }}>
            <Plus size={16} /> Ajouter
          </button>
        )}
      </div>

      <div className="catalog-toolbar">
        <div className="search-input" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--theme-text-muted)' }} />
          <input
            type="text"
            placeholder="Rechercher…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ paddingLeft: '2.25rem', width: '100%' }}
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Tous les types</option>
          <option value="semi">Semi-remorque</option>
          <option value="porteur">Porteur</option>
          <option value="utilitaire">Utilitaire</option>
        </select>
        <span className="filter-count">{items.length} modèle{items.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="catalog-empty"><p>Chargement…</p></div>
      ) : items.length === 0 ? (
        <div className="catalog-empty">
          <Truck size={48} />
          <p>Aucun modèle de camion</p>
          <p className="empty-hint">Ajoutez des modèles de semi-remorques, porteurs ou utilitaires.</p>
        </div>
      ) : (
        <div className="catalog-table-wrapper">
          <table className="catalog-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Nom</th>
                <th>Type</th>
                <th>Dimensions</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const type = item.type;
                return (
                  <tr key={item.id}>
                    <td className="td-ref">{item.internalCode || item.internal_code || '—'}</td>
                    <td><strong>{item.name}</strong></td>
                    <td>
                      {type && (
                        <span className={`catalog-badge ${TYPE_BADGE_CLASS[type] || ''}`}>
                          {TYPE_LABELS[type] || type}
                        </span>
                      )}
                    </td>
                    <td className="td-dim">{formatDimensions(item.dimensions)}</td>
                    <td className="td-actions">
                      <button className="catalog-btn catalog-btn-3d catalog-btn-sm" onClick={() => handleLoadInChargement(item)} title="Charger dans Chargement 3D">
                        <Box size={14} /> Charger
                      </button>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dimensions viewer par modèle sélectionné */}
      {items.length > 0 && items[0]?.dimensions && (
        <div className="dimensions-viewer" style={{ marginTop: '1.5rem' }}>
          <div className="dim-box">
            <Truck size={24} />
          </div>
          <div className="dim-labels">
            <span><strong>{items[0].name}</strong></span>
            <span>{formatDimensions(items[0].dimensions)}</span>
          </div>
        </div>
      )}

      {showForm && (
        <TruckModelFormModal
          item={editItem}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}

function TruckModelFormModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    type: item?.type || 'semi',
    internalCode: item?.internalCode || item?.internal_code || '',
    dimL: '', dimW: '', dimH: '',
  });

  useEffect(() => {
    if (item?.dimensions) {
      try {
        const dims = typeof item.dimensions === 'string' ? JSON.parse(item.dimensions) : item.dimensions;
        setForm(f => ({
          ...f,
          dimL: dims.length || '',
          dimW: dims.width || '',
          dimH: dims.height || '',
        }));
      } catch (e) { /* ignore */ }
    }
  }, [item]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name: form.name,
      type: form.type,
      internal_code: form.internalCode || null,
      dimensions: (form.dimL && form.dimW && form.dimH)
        ? { length: parseFloat(form.dimL), width: parseFloat(form.dimW), height: parseFloat(form.dimH) }
        : null,
    });
  };

  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="catalog-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="catalog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="catalog-modal-header">
          <h3><Truck size={20} /> {item ? 'Modifier le modèle' : 'Nouveau modèle'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="catalog-modal-body">
            <div className="catalog-form-row">
              <div className="catalog-form-group">
                <label>Nom *</label>
                <input value={form.name} onChange={(e) => update('name', e.target.value)} required placeholder="Semi 13m6" />
              </div>
              <div className="catalog-form-group">
                <label>Type *</label>
                <select value={form.type} onChange={(e) => update('type', e.target.value)}>
                  <option value="semi">Semi-remorque</option>
                  <option value="porteur">Porteur</option>
                  <option value="utilitaire">Utilitaire</option>
                </select>
              </div>
            </div>

            <div className="catalog-form-group">
              <label>Code interne</label>
              <input value={form.internalCode} onChange={(e) => update('internalCode', e.target.value)} placeholder="SEMI_13M" />
            </div>

            <div className="catalog-form-row-3">
              <div className="catalog-form-group">
                <label>Longueur (cm)</label>
                <input type="number" step="1" value={form.dimL} onChange={(e) => update('dimL', e.target.value)} placeholder="1360" />
              </div>
              <div className="catalog-form-group">
                <label>Largeur (cm)</label>
                <input type="number" step="1" value={form.dimW} onChange={(e) => update('dimW', e.target.value)} placeholder="248" />
              </div>
              <div className="catalog-form-group">
                <label>Hauteur (cm)</label>
                <input type="number" step="1" value={form.dimH} onChange={(e) => update('dimH', e.target.value)} placeholder="270" />
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
