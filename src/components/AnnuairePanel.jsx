import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Plus, Edit2, Trash2, Filter, X, Check, ChevronDown, ChevronRight,
  Building2, Users2, UserCheck, Phone, Mail, Globe, MapPin, FileText,
  Upload, Download, BarChart3, BookOpen, Contact, Eye, EyeOff,
  Building, Hash, Tag, ArrowLeft, Briefcase, Star, RefreshCw
} from 'lucide-react';
import api from '../utils/api';
import ConfirmDialog from './ConfirmDialog';
import ContactsCSVImportDialog from './ContactsCSVImportDialog';
import './AnnuairePanel.css';
import { useToast } from '../hooks/useToast';

// ═══ Constantes ═══
const ENTITY_TABS = [
  { id: 'clients', label: 'Clients', icon: Building2, color: '#3b82f6' },
  { id: 'suppliers', label: 'Fournisseurs', icon: Building, color: '#10b981' },
  { id: 'prestataires', label: 'Prestataires', icon: UserCheck, color: '#8b5cf6' },
  { id: 'contacts', label: 'Contacts', icon: Contact, color: '#f59e0b' },
  { id: 'referentiels', label: 'Référentiels', icon: BookOpen, color: '#64748b' },
];

const CLIENT_TYPES = [
  { value: 'client', label: 'Client actif' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'ancien', label: 'Ancien client' },
];

const SUPPLIER_TYPES = [
  { value: 'fournisseur', label: 'Fournisseur' },
  { value: 'sous-traitant', label: 'Sous-traitant' },
];

const REFERENTIEL_TABS = [
  { slug: 'legal-structures', label: 'Structures juridiques', key: 'legal_structures' },
  { slug: 'service-types', label: 'Types de prestation', key: 'service_types' },
  { slug: 'activity-sectors', label: 'Secteurs d\'activité', key: 'activity_sectors' },
  { slug: 'contact-categories', label: 'Catégories de contact', key: 'contact_categories' },
];

// ═══ Composant Principal ═══
function AnnuairePanel({ currentUser }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('clients');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lookups, setLookups] = useState({});
  const [stats, setStats] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  // Contact form linked entity
  const [contactParentType, setContactParentType] = useState('');
  const [contactParentId, setContactParentId] = useState('');
  // Referentiels
  const [refTab, setRefTab] = useState('legal-structures');
  const [refData, setRefData] = useState([]);
  const [showRefForm, setShowRefForm] = useState(false);
  const [editingRef, setEditingRef] = useState(null);
  // Import CSV contacts
  const [showContactsImport, setShowContactsImport] = useState(false);
  // Compteurs de version pour déclencher un refresh après CRUD
  const [dataVersion, setDataVersion] = useState(0);
  const [refVersion, setRefVersion] = useState(0);
  // Ref pour le toast (éviter les dépendances instables dans les effets)
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; });

  // ═══ Fonctions stables de chargement (lookups/stats) ═══
  const loadLookups = useCallback(async () => {
    try {
      const refs = await api.getAnnuaireRefAll();
      setLookups(refs);
    } catch (e) {
      console.error('Erreur chargement référentiels:', e);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const s = await api.getAnnuaireStats();
      setStats(s);
    } catch (e) {
      console.error('Erreur chargement stats:', e);
    }
  }, []);

  // ═══ Chargement initial ═══
  useEffect(() => {
    loadLookups();
    loadStats();
  }, [loadLookups, loadStats]);

  // ═══ Changement d'onglet (reset des filtres, batché avec React 18) ═══
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    setPage(1);
    setSearchTerm('');
    setTypeFilter('');
    setSectorFilter('');
    setSelectedItem(null);
    setShowForm(false);
  }, []);

  // ═══ Chargement des données (liste) — un seul effet propre ═══
  useEffect(() => {
    if (activeTab === 'referentiels') return;

    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = { page, limit: 50 };
        if (searchTerm) params.search = searchTerm;
        if (typeFilter) params.type = typeFilter;
        if (sectorFilter) params.activity_sector = sectorFilter;
        if (activeTab === 'contacts' && contactParentType && contactParentId) {
          params[`${contactParentType}_id`] = contactParentId;
        }

        let result;
        switch (activeTab) {
          case 'clients':
            result = await api.getAnnuaireClients(params);
            break;
          case 'suppliers':
            result = await api.getAnnuaireSuppliers(params);
            break;
          case 'prestataires':
            result = await api.getAnnuairePrestataires(params);
            break;
          case 'contacts':
            result = await api.getAnnuaireContacts(params);
            break;
          default:
            result = { data: [], total: 0 };
        }
        if (!cancelled) {
          setData(result.data || []);
          setTotal(result.total || 0);
        }
      } catch (e) {
        if (!cancelled) toastRef.current?.error('Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [activeTab, page, searchTerm, typeFilter, sectorFilter, contactParentType, contactParentId, dataVersion]);

  // ═══ Chargement référentiels ═══
  useEffect(() => {
    if (activeTab !== 'referentiels') return;

    let cancelled = false;
    const fetchRefData = async () => {
      setLoading(true);
      try {
        const d = await api.getAnnuaireRef(refTab);
        if (!cancelled) setRefData(d);
      } catch (e) {
        if (!cancelled) toastRef.current?.error('Erreur chargement référentiels');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRefData();
    return () => { cancelled = true; };
  }, [activeTab, refTab, refVersion]);

  // ═══ CRUD handlers ═══
  const handleSave = async (formData) => {
    try {
      const isEdit = !!editingItem;
      switch (activeTab) {
        case 'clients':
          isEdit ? await api.updateAnnuaireClient(editingItem.id, formData) : await api.createAnnuaireClient(formData);
          break;
        case 'suppliers':
          isEdit ? await api.updateAnnuaireSupplier(editingItem.id, formData) : await api.createAnnuaireSupplier(formData);
          break;
        case 'prestataires':
          isEdit ? await api.updateAnnuairePrestataire(editingItem.id, formData) : await api.createAnnuairePrestataire(formData);
          break;
        case 'contacts':
          isEdit ? await api.updateAnnuaireContact(editingItem.id, formData) : await api.createAnnuaireContact(formData);
          break;
      }
      toast?.success(isEdit ? 'Modifié avec succès' : 'Créé avec succès');
      setShowForm(false);
      setEditingItem(null);
      setDataVersion(v => v + 1);
      loadStats();
    } catch (e) {
      toast?.error(e.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = (item) => {
    setConfirmDialog({
      title: 'Confirmer la suppression',
      message: `Supprimer ${item.name || item.last_name} ?`,
      onConfirm: async () => {
        try {
          switch (activeTab) {
            case 'clients': await api.deleteAnnuaireClient(item.id); break;
            case 'suppliers': await api.deleteAnnuaireSupplier(item.id); break;
            case 'prestataires': await api.deleteAnnuairePrestataire(item.id); break;
            case 'contacts': await api.deleteAnnuaireContact(item.id); break;
          }
          toast?.success('Supprimé');
          setDataVersion(v => v + 1);
          loadStats();
        } catch (e) {
          toast?.error(e.message || 'Erreur');
        }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const handleImportCSV = async (type) => {
    try {
      const result = type === 'clients' ? await api.importClientsCsv() : await api.importSuppliersCsv();
      toast?.success(`Import terminé : ${result.imported} importés, ${result.skipped} ignorés, ${result.errors} erreurs`);
      setDataVersion(v => v + 1);
      loadStats();
    } catch (e) {
      toast?.error('Erreur import CSV');
    }
  };

  const handleRefSave = async (formData) => {
    try {
      if (editingRef) {
        await api.updateAnnuaireRef(refTab, editingRef.id, formData);
      } else {
        await api.createAnnuaireRef(refTab, formData);
      }
      toast?.success('Référentiel sauvegardé');
      setShowRefForm(false);
      setEditingRef(null);
      setRefVersion(v => v + 1);
      loadLookups();
    } catch (e) {
      toast?.error(e.message || 'Erreur');
    }
  };

  const handleRefDelete = (item) => {
    setConfirmDialog({
      title: 'Supprimer',
      message: `Supprimer « ${item.name} » ?`,
      onConfirm: async () => {
        try {
          await api.deleteAnnuaireRef(refTab, item.id);
          toast?.success('Supprimé');
          setRefVersion(v => v + 1);
          loadLookups();
        } catch (e) {
          toast?.error('Erreur');
        }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  // ═══ Helpers ═══
  const getLookupName = (key, code) => {
    const list = lookups[key] || [];
    const found = list.find(l => l.code === code);
    return found ? found.name : code || '—';
  };

  const totalPages = Math.ceil(total / 50);

  // ═══ RENDU ═══
  return (
    <div className="annuaire-panel">
      {/* Header — unified tabs + stats */}
      <div className="annuaire-header">
        <div className="annuaire-tabs">
          {ENTITY_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`annuaire-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        {stats && (
          <div className="annuaire-header-stats">
            <span className="stat-badge client">{stats.clients?.total || 0} clients</span>
            <span className="stat-badge supplier">{stats.suppliers?.total || 0} fournisseurs</span>
            <span className="stat-badge prestataire">{stats.prestataires?.total || 0} prestataires</span>
            <span className="stat-badge contact">{stats.contacts?.total || 0} contacts</span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      {activeTab !== 'referentiels' && (
        <div className="annuaire-toolbar">
          <div className="annuaire-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            />
            {searchTerm && <X size={14} className="clear-search" onClick={() => setSearchTerm('')} />}
          </div>

          <div className="annuaire-toolbar-actions">
            {(activeTab === 'clients' || activeTab === 'suppliers') && (
              <button className="btn-filter" onClick={() => setShowFilters(!showFilters)}>
                <Filter size={15} />
              </button>
            )}
            {activeTab === 'clients' && currentUser?.isAdmin && (
              <button className="btn-import" onClick={() => handleImportCSV('clients')} title="Import CSV Clients Locmat">
                <Upload size={15} /> CSV
              </button>
            )}
            {activeTab === 'suppliers' && currentUser?.isAdmin && (
              <button className="btn-import" onClick={() => handleImportCSV('suppliers')} title="Import CSV Fournisseurs Locmat">
                <Upload size={15} /> CSV
              </button>
            )}
            {activeTab === 'contacts' && currentUser?.isAdmin && (
              <button className="btn-import" onClick={() => setShowContactsImport(true)} title="Import CSV Contacts Locmat">
                <Upload size={15} /> CSV
              </button>
            )}
            <button className="btn-add" onClick={() => { setEditingItem(null); setShowForm(true); }}>
              <Plus size={15} /> Nouveau
            </button>
          </div>
        </div>
      )}

      {/* Filters bar */}
      {showFilters && activeTab !== 'referentiels' && activeTab !== 'contacts' && (
        <div className="annuaire-filters">
          {activeTab === 'clients' && (
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">Tous les types</option>
              {CLIENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          )}
          {activeTab === 'suppliers' && (
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">Tous les types</option>
              {SUPPLIER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          )}
          <select value={sectorFilter} onChange={e => { setSectorFilter(e.target.value); setPage(1); }}>
            <option value="">Tous les secteurs</option>
            {(lookups.activity_sectors || []).map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
      )}

      {/* Content */}
      <div className="annuaire-content">
        {loading ? (
          <div className="annuaire-loading">
            <div className="loading-spinner" />
            <p>Chargement...</p>
          </div>
        ) : selectedItem ? (
          <DetailView
            item={selectedItem}
            entityType={activeTab}
            lookups={lookups}
            getLookupName={getLookupName}
            currentUser={currentUser}
            onBack={() => setSelectedItem(null)}
            onEdit={(item) => { setEditingItem(item); setShowForm(true); setSelectedItem(null); }}
            onAddContact={(parentType, parentId) => {
              handleTabChange('contacts');
              setContactParentType(parentType);
              setContactParentId(parentId);
              setTimeout(() => { setEditingItem(null); setShowForm(true); }, 100);
            }}
            toast={toast}
          />
        ) : activeTab === 'referentiels' ? (
          <ReferentielsView
            refTab={refTab}
            setRefTab={setRefTab}
            refData={refData}
            loading={loading}
            currentUser={currentUser}
            onAdd={() => { setEditingRef(null); setShowRefForm(true); }}
            onEdit={(item) => { setEditingRef(item); setShowRefForm(true); }}
            onDelete={handleRefDelete}
          />
        ) : (
          <>
            <EntityTable
              data={data}
              entityType={activeTab}
              currentUser={currentUser}
              getLookupName={getLookupName}
              onSelect={setSelectedItem}
              onEdit={(item) => { setEditingItem(item); setShowForm(true); }}
              onDelete={handleDelete}
            />
            {totalPages > 1 && (
              <div className="annuaire-pagination">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Précédent</button>
                <span>Page {page} / {totalPages} ({total} résultats)</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Suivant →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <EntityFormModal
          entityType={activeTab}
          item={editingItem}
          lookups={lookups}
          contactParentType={contactParentType}
          contactParentId={contactParentId}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingItem(null); }}
        />
      )}

      {/* Ref Form Modal */}
      {showRefForm && (
        <RefFormModal
          item={editingRef}
          onSave={handleRefSave}
          onClose={() => { setShowRefForm(false); setEditingRef(null); }}
        />
      )}

      {confirmDialog && <ConfirmDialog {...confirmDialog} />}

      {showContactsImport && (
        <ContactsCSVImportDialog
          onClose={() => setShowContactsImport(false)}
          onSuccess={() => {
            setDataVersion(v => v + 1);
            loadStats();
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ENTITY TABLE
// ═══════════════════════════════════════════════════════════════
function EntityTable({ data, entityType, currentUser, getLookupName, onSelect, onEdit, onDelete }) {
  if (!data.length) {
    return <div className="annuaire-empty"><p>Aucun enregistrement trouvé</p></div>;
  }

  if (entityType === 'contacts') {
    return (
      <div className="annuaire-table-wrapper">
        <table className="annuaire-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Fonction</th>
              <th>Entité</th>
              <th>Téléphone</th>
              <th>Email</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map(c => (
              <tr key={c.id}>
                <td className="name-cell">
                  {c.is_primary ? <Star size={12} className="primary-star" /> : null}
                  {c.first_name} <strong>{c.last_name}</strong>
                </td>
                <td>{c.job_title || '—'}</td>
                <td className="entity-cell">
                  {c.client_name && <span className="entity-tag client">Client: {c.client_name}</span>}
                  {c.supplier_name && <span className="entity-tag supplier">Fourn: {c.supplier_name}</span>}
                  {c.prestataire_name && <span className="entity-tag prestataire">Presta: {c.prestataire_name}</span>}
                </td>
                <td>{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : '—'}</td>
                <td>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</td>
                <td className="actions-cell">
                  <button onClick={() => onEdit(c)} title="Modifier"><Edit2 size={14} /></button>
                  {currentUser?.isAdmin && <button onClick={() => onDelete(c)} title="Supprimer" className="btn-danger"><Trash2 size={14} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Clients / Suppliers / Prestataires
  return (
    <div className="annuaire-table-wrapper">
      <table className="annuaire-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Nom</th>
            <th>Ville</th>
            <th>Téléphone</th>
            <th>Email</th>
            {entityType !== 'prestataires' && <th>Type</th>}
            <th>Contacts</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr key={item.id} className={item.is_active === 0 ? 'inactive-row' : ''}>
              <td className="code-cell">{item.code_libre || '—'}</td>
              <td className="name-cell clickable" onClick={() => onSelect(item)}>
                <strong>{item.name}</strong>
                {item.is_active === 0 && <span className="inactive-badge">Inactif</span>}
              </td>
              <td>{[item.postal_code, item.city].filter(Boolean).join(' ') || '—'}</td>
              <td>{item.phone ? <a href={`tel:${item.phone}`}>{item.phone}</a> : '—'}</td>
              <td>{item.email ? <a href={`mailto:${item.email}`}>{item.email}</a> : '—'}</td>
              {entityType !== 'prestataires' && (
                <td>
                  <span className={`type-badge ${item.type || ''}`}>
                    {item.type || '—'}
                  </span>
                </td>
              )}
              <td className="count-cell">{item.contact_count || 0}</td>
              <td className="actions-cell">
                <button onClick={() => onSelect(item)} title="Voir"><Eye size={14} /></button>
                <button onClick={() => onEdit(item)} title="Modifier"><Edit2 size={14} /></button>
                {currentUser?.isAdmin && <button onClick={() => onDelete(item)} title="Supprimer" className="btn-danger"><Trash2 size={14} /></button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DETAIL VIEW
// ═══════════════════════════════════════════════════════════════
function DetailView({ item, entityType, lookups, getLookupName, currentUser, onBack, onEdit, onAddContact, toast }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        let d;
        switch (entityType) {
          case 'clients': d = await api.getAnnuaireClient(item.id); break;
          case 'suppliers': d = await api.getAnnuaireSupplier(item.id); break;
          case 'prestataires': d = await api.getAnnuairePrestataire(item.id); break;
          default: d = item;
        }
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) toast?.error('Erreur chargement détail');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDetail();
    return () => { cancelled = true; };
  }, [item.id, entityType]);

  if (loading || !detail) return <div className="annuaire-loading"><div className="loading-spinner" /></div>;

  const serviceTypes = (() => {
    try {
      return JSON.parse(detail.service_types || '[]');
    } catch { return []; }
  })();

  const parentType = entityType === 'clients' ? 'client' : entityType === 'suppliers' ? 'supplier' : 'prestataire';

  return (
    <div className="annuaire-detail">
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}><ArrowLeft size={16} /> Retour</button>
        <div className="detail-title">
          <h3>{detail.name}</h3>
          {detail.code_libre && <span className="code-badge">{detail.code_libre}</span>}
          {detail.is_active === 0 && <span className="inactive-badge">Inactif</span>}
        </div>
        <button className="btn-edit" onClick={() => onEdit(detail)}><Edit2 size={14} /> Modifier</button>
      </div>

      <div className="detail-grid">
        {/* Infos générales */}
        <div className="detail-section">
          <h4>Informations générales</h4>
          <div className="detail-fields">
            {detail.type && <div className="field"><label>Type</label><span className={`type-badge ${detail.type}`}>{detail.type}</span></div>}
            {detail.legal_structure && <div className="field"><label>Forme juridique</label><span>{getLookupName('legal_structures', detail.legal_structure)}</span></div>}
            {detail.siret && <div className="field"><label>SIRET</label><span>{detail.siret}</span></div>}
            {detail.tva_intra && <div className="field"><label>TVA Intra.</label><span>{detail.tva_intra}</span></div>}
            {detail.activity_sector && <div className="field"><label>Secteur</label><span>{getLookupName('activity_sectors', detail.activity_sector)}</span></div>}
          </div>
        </div>

        {/* Coordonnées */}
        <div className="detail-section">
          <h4>Coordonnées</h4>
          <div className="detail-fields">
            {detail.address && <div className="field"><label><MapPin size={13} /> Adresse</label><span>{detail.address}</span></div>}
            {(detail.postal_code || detail.city) && <div className="field"><label>Ville</label><span>{[detail.postal_code, detail.city].filter(Boolean).join(' ')}</span></div>}
            {detail.country && detail.country !== 'France' && <div className="field"><label>Pays</label><span>{detail.country}</span></div>}
            {detail.phone && <div className="field"><label><Phone size={13} /> Tél.</label><a href={`tel:${detail.phone}`}>{detail.phone}</a></div>}
            {detail.phone2 && <div className="field"><label><Phone size={13} /> Tél. 2</label><a href={`tel:${detail.phone2}`}>{detail.phone2}</a></div>}
            {detail.email && <div className="field"><label><Mail size={13} /> Email</label><a href={`mailto:${detail.email}`}>{detail.email}</a></div>}
            {detail.website && <div className="field"><label><Globe size={13} /> Site web</label><a href={detail.website.startsWith('http') ? detail.website : `https://${detail.website}`} target="_blank" rel="noreferrer">{detail.website}</a></div>}
          </div>
        </div>

        {/* Prestations */}
        {serviceTypes.length > 0 && (
          <div className="detail-section">
            <h4>Types de prestation</h4>
            <div className="tags-list">
              {serviceTypes.map(code => (
                <span key={code} className="service-tag">{getLookupName('service_types', code)}</span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {detail.notes && (
          <div className="detail-section full-width">
            <h4>Notes</h4>
            <p className="notes-text">{detail.notes}</p>
          </div>
        )}

        {/* Contacts */}
        <div className="detail-section full-width">
          <div className="section-header">
            <h4>Contacts ({detail.contacts?.length || 0})</h4>
            <button className="btn-add-small" onClick={() => onAddContact(parentType, detail.id)}>
              <Plus size={13} /> Ajouter
            </button>
          </div>
          {detail.contacts?.length > 0 ? (
            <div className="contacts-grid">
              {detail.contacts.map(c => (
                <div key={c.id} className="contact-card">
                  {c.is_primary ? <Star size={12} className="primary-star" /> : null}
                  <div className="contact-name">{c.first_name} <strong>{c.last_name}</strong></div>
                  {c.job_title && <div className="contact-job">{c.job_title}</div>}
                  {c.phone && <div className="contact-info"><Phone size={12} /> <a href={`tel:${c.phone}`}>{c.phone}</a></div>}
                  {c.email && <div className="contact-info"><Mail size={12} /> <a href={`mailto:${c.email}`}>{c.email}</a></div>}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-text">Aucun contact associé</p>
          )}
        </div>

        {/* Commandes (fournisseurs) */}
        {entityType === 'suppliers' && detail.orders?.length > 0 && (
          <div className="detail-section full-width">
            <h4>Dernières commandes</h4>
            <table className="mini-table">
              <thead><tr><th>Réf.</th><th>Date</th><th>Statut</th><th>Total TTC</th></tr></thead>
              <tbody>
                {detail.orders.map(o => (
                  <tr key={o.id}>
                    <td>{o.reference}</td>
                    <td>{o.order_date || '—'}</td>
                    <td><span className={`status-badge ${o.status}`}>{o.status}</span></td>
                    <td>{o.total_ttc ? `${o.total_ttc.toFixed(2)} €` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FORM MODAL
// ═══════════════════════════════════════════════════════════════
function EntityFormModal({ entityType, item, lookups, contactParentType, contactParentId, onSave, onClose }) {
  const isEdit = !!item;
  const isContact = entityType === 'contacts';

  const [form, setForm] = useState(() => {
    if (isContact) {
      return {
        first_name: item?.first_name || '',
        last_name: item?.last_name || '',
        job_title: item?.job_title || '',
        category: item?.category || '',
        email: item?.email || '',
        phone: item?.phone || '',
        phone2: item?.phone2 || '',
        is_primary: item?.is_primary || false,
        notes: item?.notes || '',
        client_id: item?.client_id || (contactParentType === 'client' ? contactParentId : '') || '',
        supplier_id: item?.supplier_id || (contactParentType === 'supplier' ? contactParentId : '') || '',
        prestataire_id: item?.prestataire_id || (contactParentType === 'prestataire' ? contactParentId : '') || '',
      };
    }
    // Parse service_types
    let st = [];
    try { st = JSON.parse(item?.service_types || '[]'); } catch {}

    return {
      name: item?.name || '',
      code_libre: item?.code_libre || '',
      email: item?.email || '',
      phone: item?.phone || '',
      phone2: item?.phone2 || '',
      address: item?.address || '',
      postal_code: item?.postal_code || '',
      city: item?.city || '',
      country: item?.country || 'France',
      type: item?.type || (entityType === 'clients' ? 'client' : entityType === 'suppliers' ? 'fournisseur' : ''),
      legal_structure: item?.legal_structure || '',
      siret: item?.siret || '',
      tva_intra: item?.tva_intra || '',
      website: item?.website || '',
      activity_sector: item?.activity_sector || '',
      service_types: st,
      notes: item?.notes || '',
      is_active: item?.is_active !== undefined ? item.is_active : 1,
      contact_name: item?.contact_name || '',
    };
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleServiceType = (code) => {
    setForm(prev => {
      const list = prev.service_types || [];
      return { ...prev, service_types: list.includes(code) ? list.filter(c => c !== code) : [...list, code] };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    // Clean empty strings to null
    for (const [k, v] of Object.entries(data)) {
      if (v === '') data[k] = null;
    }
    if (isContact) {
      data.is_primary = data.is_primary ? 1 : 0;
    }
    onSave(data);
  };

  const types = entityType === 'clients' ? CLIENT_TYPES : entityType === 'suppliers' ? SUPPLIER_TYPES : [];

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="annuaire-form-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Modifier' : 'Nouveau'} {
            isContact ? 'contact' :
            entityType === 'clients' ? 'client' :
            entityType === 'suppliers' ? 'fournisseur' : 'prestataire'
          }</h3>
          <button className="btn-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="annuaire-form">
          {isContact ? (
            // ─── Contact form ───
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Prénom</label>
                  <input value={form.first_name || ''} onChange={e => handleChange('first_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Nom *</label>
                  <input value={form.last_name || ''} onChange={e => handleChange('last_name', e.target.value)} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Fonction</label>
                  <input value={form.job_title || ''} onChange={e => handleChange('job_title', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Catégorie</label>
                  <select value={form.category || ''} onChange={e => handleChange('category', e.target.value)}>
                    <option value="">— Choisir —</option>
                    {(lookups.contact_categories || []).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Téléphone</label>
                  <input value={form.phone || ''} onChange={e => handleChange('phone', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Tél. 2</label>
                  <input value={form.phone2 || ''} onChange={e => handleChange('phone2', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email || ''} onChange={e => handleChange('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked={form.is_primary || false} onChange={e => handleChange('is_primary', e.target.checked)} />
                  Contact principal
                </label>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={form.notes || ''} onChange={e => handleChange('notes', e.target.value)} rows={2} />
              </div>
            </>
          ) : (
            // ─── Entity form (client/supplier/prestataire) ───
            <>
              <div className="form-row">
                <div className="form-group flex-2">
                  <label>Nom *</label>
                  <input value={form.name} onChange={e => handleChange('name', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Code libre</label>
                  <input value={form.code_libre || ''} onChange={e => handleChange('code_libre', e.target.value)} />
                </div>
              </div>

              {types.length > 0 && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Type</label>
                    <select value={form.type || ''} onChange={e => handleChange('type', e.target.value)}>
                      <option value="">— Choisir —</option>
                      {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Forme juridique</label>
                    <select value={form.legal_structure || ''} onChange={e => handleChange('legal_structure', e.target.value)}>
                      <option value="">— Choisir —</option>
                      {(lookups.legal_structures || []).map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {entityType === 'prestataires' && (
                <div className="form-group">
                  <label>Forme juridique</label>
                  <select value={form.legal_structure || ''} onChange={e => handleChange('legal_structure', e.target.value)}>
                    <option value="">— Choisir —</option>
                    {(lookups.legal_structures || []).map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                  </select>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>SIRET</label>
                  <input value={form.siret || ''} onChange={e => handleChange('siret', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>TVA Intra.</label>
                  <input value={form.tva_intra || ''} onChange={e => handleChange('tva_intra', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>Adresse</label>
                <input value={form.address || ''} onChange={e => handleChange('address', e.target.value)} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Code postal</label>
                  <input value={form.postal_code || ''} onChange={e => handleChange('postal_code', e.target.value)} />
                </div>
                <div className="form-group flex-2">
                  <label>Ville</label>
                  <input value={form.city || ''} onChange={e => handleChange('city', e.target.value)} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Téléphone</label>
                  <input value={form.phone || ''} onChange={e => handleChange('phone', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Tél. 2</label>
                  <input value={form.phone2 || ''} onChange={e => handleChange('phone2', e.target.value)} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email || ''} onChange={e => handleChange('email', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Site web</label>
                  <input value={form.website || ''} onChange={e => handleChange('website', e.target.value)} />
                </div>
              </div>

              {entityType === 'suppliers' && (
                <div className="form-group">
                  <label>Nom du contact</label>
                  <input value={form.contact_name || ''} onChange={e => handleChange('contact_name', e.target.value)} />
                </div>
              )}

              <div className="form-group">
                <label>Secteur d'activité</label>
                <select value={form.activity_sector || ''} onChange={e => handleChange('activity_sector', e.target.value)}>
                  <option value="">— Choisir —</option>
                  {(lookups.activity_sectors || []).map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Types de prestation</label>
                <div className="service-types-grid">
                  {(lookups.service_types || []).map(st => (
                    <label key={st.code} className={`service-type-chip ${(form.service_types || []).includes(st.code) ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={(form.service_types || []).includes(st.code)}
                        onChange={() => toggleServiceType(st.code)}
                      />
                      {st.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea value={form.notes || ''} onChange={e => handleChange('notes', e.target.value)} rows={3} />
              </div>
            </>
          )}

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-save"><Check size={15} /> {isEdit ? 'Modifier' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REFERENTIELS VIEW
// ═══════════════════════════════════════════════════════════════
function ReferentielsView({ refTab, setRefTab, refData, loading, currentUser, onAdd, onEdit, onDelete }) {
  return (
    <div className="referentiels-view">
      <div className="ref-tabs">
        {REFERENTIEL_TABS.map(t => (
          <button key={t.slug} className={`ref-tab ${refTab === t.slug ? 'active' : ''}`} onClick={() => setRefTab(t.slug)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="ref-toolbar">
        {currentUser?.isAdmin && (
          <button className="btn-add" onClick={onAdd}><Plus size={15} /> Ajouter</button>
        )}
      </div>

      <div className="annuaire-table-wrapper">
        <table className="annuaire-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Libellé</th>
              <th>Ordre</th>
              <th>Actif</th>
              {currentUser?.isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {refData.map(item => (
              <tr key={item.id} className={!item.is_active ? 'inactive-row' : ''}>
                <td className="code-cell">{item.code}</td>
                <td>{item.name}</td>
                <td>{item.sort_order}</td>
                <td>{item.is_active ? <Check size={14} className="text-success" /> : <X size={14} className="text-muted" />}</td>
                {currentUser?.isAdmin && (
                  <td className="actions-cell">
                    <button onClick={() => onEdit(item)} title="Modifier"><Edit2 size={14} /></button>
                    <button onClick={() => onDelete(item)} title="Supprimer" className="btn-danger"><Trash2 size={14} /></button>
                  </td>
                )}
              </tr>
            ))}
            {refData.length === 0 && (
              <tr><td colSpan={5} className="empty-cell">Aucune donnée</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REF FORM MODAL
// ═══════════════════════════════════════════════════════════════
function RefFormModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({
    code: item?.code || '',
    name: item?.name || '',
    sort_order: item?.sort_order || 0,
    is_active: item?.is_active !== undefined ? item.is_active : 1,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="annuaire-form-modal small" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{item ? 'Modifier' : 'Ajouter'}</h3>
          <button className="btn-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="annuaire-form">
          <div className="form-row">
            <div className="form-group">
              <label>Code *</label>
              <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} required />
            </div>
            <div className="form-group flex-2">
              <label>Libellé *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Ordre</label>
              <input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={!!form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked ? 1 : 0 }))} />
                Actif
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-save"><Check size={15} /> Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default React.memo(AnnuairePanel);
