import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, Search, Plus, Filter, Wrench, AlertTriangle, CheckCircle, Clock, X, ChevronRight, Edit2, Trash2, RotateCcw, Tag, MapPin, Calendar, DollarSign, User, Clipboard, ArrowLeft } from 'lucide-react';
import api from '../utils/api';
import './EquipmentPanel.css';

// ═══ CONSTANTES ═══
const EQUIPMENT_STATUS = {
  available: { label: 'Disponible', color: '#10b981', icon: '✅' },
  in_use: { label: 'En service', color: '#3b82f6', icon: '🔄' },
  maintenance: { label: 'En maintenance', color: '#f59e0b', icon: '🔧' },
  retired: { label: 'Réformé', color: '#6b7280', icon: '⛔' },
};

const SAV_STATUS = {
  open: { label: 'Ouvert', color: '#ef4444' },
  in_progress: { label: 'En cours', color: '#f59e0b' },
  waiting_parts: { label: 'Attente pièces', color: '#8b5cf6' },
  resolved: { label: 'Résolu', color: '#10b981' },
  closed: { label: 'Clôturé', color: '#6b7280' },
};

const SAV_PRIORITY = {
  low: { label: 'Basse', color: '#6b7280' },
  medium: { label: 'Moyenne', color: '#f59e0b' },
  high: { label: 'Haute', color: '#ef4444' },
  urgent: { label: 'Urgente', color: '#dc2626' },
};

const SAV_TYPES = {
  panne: 'Panne',
  entretien: 'Entretien',
  reparation: 'Réparation',
  calibrage: 'Calibrage',
};

// ═══ COMPOSANT PRINCIPAL ═══
const EquipmentPanel = ({ currentUser }) => {
  const [subTab, setSubTab] = useState('inventory'); // inventory | sav
  const [equipment, setEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [savTickets, setSavTickets] = useState([]);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtres
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [savFilterStatus, setSavFilterStatus] = useState('');

  // Modals
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [showSavModal, setShowSavModal] = useState(false);
  const [editingSavTicket, setEditingSavTicket] = useState(null);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignEquipment, setAssignEquipment] = useState(null);

  const isAdmin = currentUser?.isAdmin === true;

  // ═══ CHARGEMENT ═══
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [eqData, catData, ticketData, persData] = await Promise.all([
        api.getEquipment(),
        api.getEquipmentCategories(),
        api.getSavTickets(),
        api.getPersons().catch(() => []),
      ]);
      setEquipment(eqData);
      setCategories(catData);
      setSavTickets(ticketData);
      setPersons(persData);
      setError(null);
    } catch (err) {
      console.error('Erreur chargement matériel:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ═══ FILTRAGE ═══
  const filteredEquipment = useMemo(() => {
    return equipment.filter(eq => {
      if (filterStatus && eq.status !== filterStatus) return false;
      if (filterCategory && eq.category_id !== parseInt(filterCategory)) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!eq.name?.toLowerCase().includes(s) && !eq.reference?.toLowerCase().includes(s) && !eq.serial_number?.toLowerCase().includes(s) && !eq.location?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [equipment, filterStatus, filterCategory, search]);

  const filteredTickets = useMemo(() => {
    return savTickets.filter(t => {
      if (savFilterStatus && t.status !== savFilterStatus) return false;
      return true;
    });
  }, [savTickets, savFilterStatus]);

  // ═══ STATS ═══
  const stats = useMemo(() => ({
    total: equipment.length,
    available: equipment.filter(e => e.status === 'available').length,
    in_use: equipment.filter(e => e.status === 'in_use').length,
    maintenance: equipment.filter(e => e.status === 'maintenance').length,
    openTickets: savTickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length,
  }), [equipment, savTickets]);

  // ═══ HANDLERS ═══
  const handleSaveEquipment = async (data) => {
    try {
      if (editingEquipment) {
        await api.updateEquipment(editingEquipment.id, data);
      } else {
        await api.createEquipment(data);
      }
      setShowEquipmentModal(false);
      setEditingEquipment(null);
      loadData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleDeleteEquipment = async (id) => {
    if (!confirm('Supprimer cet équipement et tout son historique ?')) return;
    try {
      await api.deleteEquipment(id);
      setSelectedEquipment(null);
      loadData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleSaveSavTicket = async (data) => {
    try {
      if (editingSavTicket) {
        await api.updateSavTicket(editingSavTicket.id, data);
      } else {
        await api.createSavTicket(data);
      }
      setShowSavModal(false);
      setEditingSavTicket(null);
      loadData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleAssign = async (data) => {
    try {
      await api.createEquipmentAssignment(data);
      setShowAssignModal(false);
      setAssignEquipment(null);
      loadData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleReturn = async (assignmentId) => {
    try {
      await api.returnEquipmentAssignment(assignmentId);
      loadData();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  // ═══ RENDU ═══
  if (loading && equipment.length === 0) {
    return <div className="eq-loading"><div className="eq-spinner" /> Chargement du parc matériel...</div>;
  }

  return (
    <div className="equipment-panel">
      {/* En-tête avec stats */}
      <div className="eq-header">
        <div className="eq-stats-row">
          <div className="eq-stat" onClick={() => { setFilterStatus(''); setSubTab('inventory'); }}>
            <Package size={16} />
            <span className="eq-stat-value">{stats.total}</span>
            <span className="eq-stat-label">Total</span>
          </div>
          <div className="eq-stat eq-stat-available" onClick={() => { setFilterStatus('available'); setSubTab('inventory'); }}>
            <CheckCircle size={16} />
            <span className="eq-stat-value">{stats.available}</span>
            <span className="eq-stat-label">Disponibles</span>
          </div>
          <div className="eq-stat eq-stat-inuse" onClick={() => { setFilterStatus('in_use'); setSubTab('inventory'); }}>
            <Clock size={16} />
            <span className="eq-stat-value">{stats.in_use}</span>
            <span className="eq-stat-label">En service</span>
          </div>
          <div className="eq-stat eq-stat-maint" onClick={() => { setFilterStatus('maintenance'); setSubTab('inventory'); }}>
            <Wrench size={16} />
            <span className="eq-stat-value">{stats.maintenance}</span>
            <span className="eq-stat-label">Maintenance</span>
          </div>
          {stats.openTickets > 0 && (
            <div className="eq-stat eq-stat-tickets" onClick={() => { setSavFilterStatus(''); setSubTab('sav'); }}>
              <AlertTriangle size={16} />
              <span className="eq-stat-value">{stats.openTickets}</span>
              <span className="eq-stat-label">Tickets SAV</span>
            </div>
          )}
        </div>
      </div>

      {/* Onglets + Actions */}
      <div className="eq-toolbar">
        <div className="eq-tabs">
          <button className={`eq-tab ${subTab === 'inventory' ? 'active' : ''}`} onClick={() => setSubTab('inventory')}>
            <Package size={14} /> Inventaire
          </button>
          <button className={`eq-tab ${subTab === 'sav' ? 'active' : ''}`} onClick={() => setSubTab('sav')}>
            <Wrench size={14} /> SAV
            {stats.openTickets > 0 && <span className="eq-tab-badge">{stats.openTickets}</span>}
          </button>
        </div>

        <div className="eq-toolbar-actions">
          {subTab === 'inventory' && (
            <>
              <div className="eq-search">
                <Search size={14} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                />
                {search && <button className="eq-search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
              </div>
              <select className="eq-filter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">Tous statuts</option>
                {Object.entries(EQUIPMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
              <select className="eq-filter" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">Toutes catégories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <button className="eq-btn-add" onClick={() => { setEditingEquipment(null); setShowEquipmentModal(true); }}>
                <Plus size={14} /> Matériel
              </button>
            </>
          )}
          {subTab === 'sav' && (
            <>
              <select className="eq-filter" value={savFilterStatus} onChange={(e) => setSavFilterStatus(e.target.value)}>
                <option value="">Tous statuts</option>
                {Object.entries(SAV_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button className="eq-btn-add" onClick={() => { setEditingSavTicket(null); setShowSavModal(true); }}>
                <Plus size={14} /> Ticket SAV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="eq-content">
        {subTab === 'inventory' && (
          selectedEquipment ? (
            <EquipmentDetail
              equipment={selectedEquipment}
              categories={categories}
              persons={persons}
              isAdmin={isAdmin}
              onBack={() => setSelectedEquipment(null)}
              onEdit={(eq) => { setEditingEquipment(eq); setShowEquipmentModal(true); }}
              onDelete={handleDeleteEquipment}
              onAssign={(eq) => { setAssignEquipment(eq); setShowAssignModal(true); }}
              onReturn={handleReturn}
              onCreateTicket={(eq) => { setEditingSavTicket(null); setShowSavModal(true); }}
              onRefresh={loadData}
            />
          ) : (
            <EquipmentGrid
              equipment={filteredEquipment}
              onSelect={async (eq) => {
                try {
                  const detail = await api.getEquipmentById(eq.id);
                  setSelectedEquipment(detail);
                } catch { setSelectedEquipment(eq); }
              }}
            />
          )
        )}

        {subTab === 'sav' && (
          <SavTicketsList
            tickets={filteredTickets}
            equipment={equipment}
            persons={persons}
            onEdit={(t) => { setEditingSavTicket(t); setShowSavModal(true); }}
            onDelete={async (id) => {
              if (!confirm('Supprimer ce ticket ?')) return;
              await api.deleteSavTicket(id);
              loadData();
            }}
          />
        )}
      </div>

      {/* Modals */}
      {showEquipmentModal && (
        <EquipmentFormModal
          equipment={editingEquipment}
          categories={categories}
          onSave={handleSaveEquipment}
          onClose={() => { setShowEquipmentModal(false); setEditingEquipment(null); }}
        />
      )}

      {showSavModal && (
        <SavTicketFormModal
          ticket={editingSavTicket}
          equipment={equipment}
          persons={persons}
          preselectedEquipment={selectedEquipment}
          onSave={handleSaveSavTicket}
          onClose={() => { setShowSavModal(false); setEditingSavTicket(null); }}
        />
      )}

      {showAssignModal && assignEquipment && (
        <AssignModal
          equipment={assignEquipment}
          persons={persons}
          onSave={handleAssign}
          onClose={() => { setShowAssignModal(false); setAssignEquipment(null); }}
        />
      )}
    </div>
  );
};

// ═══ GRILLE D'ÉQUIPEMENTS ═══
const EquipmentGrid = ({ equipment, onSelect }) => {
  if (equipment.length === 0) {
    return (
      <div className="eq-empty">
        <Package size={48} strokeWidth={1} />
        <p>Aucun matériel trouvé</p>
        <span>Ajoutez votre premier équipement avec le bouton +</span>
      </div>
    );
  }

  return (
    <div className="eq-grid">
      {equipment.map(eq => {
        const st = EQUIPMENT_STATUS[eq.status] || EQUIPMENT_STATUS.available;
        return (
          <div key={eq.id} className="eq-card" onClick={() => onSelect(eq)}>
            <div className="eq-card-header">
              <span className="eq-card-cat" style={{ background: eq.category_color || '#6366f1' }}>
                {eq.category_icon || '📦'} {eq.category_name || 'Sans catégorie'}
              </span>
              <span className="eq-card-status" style={{ color: st.color }}>
                {st.icon} {st.label}
              </span>
            </div>
            <div className="eq-card-body">
              <h4 className="eq-card-name">{eq.name}</h4>
              {eq.reference && <p className="eq-card-ref"><Tag size={12} /> {eq.reference}</p>}
              {eq.location && <p className="eq-card-location"><MapPin size={12} /> {eq.location}</p>}
              {eq.currentAssignment && (
                <p className="eq-card-assigned">
                  <User size={12} /> {eq.currentAssignment.first_name} {eq.currentAssignment.last_name}
                </p>
              )}
            </div>
            <div className="eq-card-footer">
              <ChevronRight size={14} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ═══ DÉTAIL D'UN ÉQUIPEMENT ═══
const EquipmentDetail = ({ equipment: eq, categories, persons, isAdmin, onBack, onEdit, onDelete, onAssign, onReturn, onCreateTicket, onRefresh }) => {
  const st = EQUIPMENT_STATUS[eq.status] || EQUIPMENT_STATUS.available;
  
  return (
    <div className="eq-detail">
      <div className="eq-detail-header">
        <button className="eq-back-btn" onClick={onBack}><ArrowLeft size={16} /> Retour</button>
        <div className="eq-detail-actions">
          <button className="eq-btn-secondary" onClick={() => onEdit(eq)}><Edit2 size={14} /> Modifier</button>
          {eq.status === 'available' && (
            <button className="eq-btn-primary" onClick={() => onAssign(eq)}>
              <User size={14} /> Attribuer
            </button>
          )}
          <button className="eq-btn-secondary" onClick={() => onCreateTicket(eq)}>
            <Wrench size={14} /> Ticket SAV
          </button>
          {isAdmin && (
            <button className="eq-btn-danger" onClick={() => onDelete(eq.id)}><Trash2 size={14} /></button>
          )}
        </div>
      </div>

      <div className="eq-detail-body">
        <div className="eq-detail-main">
          <h2>{eq.category_icon} {eq.name}</h2>
          <span className="eq-detail-status" style={{ background: st.color }}>{st.icon} {st.label}</span>

          <div className="eq-detail-fields">
            {eq.reference && <div className="eq-detail-field"><Tag size={14} /><span>Réf.</span><strong>{eq.reference}</strong></div>}
            {eq.serial_number && <div className="eq-detail-field"><Clipboard size={14} /><span>N° série</span><strong>{eq.serial_number}</strong></div>}
            {eq.location && <div className="eq-detail-field"><MapPin size={14} /><span>Localisation</span><strong>{eq.location}</strong></div>}
            {eq.purchase_date && <div className="eq-detail-field"><Calendar size={14} /><span>Achat</span><strong>{new Date(eq.purchase_date).toLocaleDateString('fr-FR')}</strong></div>}
            {eq.purchase_price && <div className="eq-detail-field"><DollarSign size={14} /><span>Prix</span><strong>{parseFloat(eq.purchase_price).toFixed(2)} €</strong></div>}
            {eq.warranty_end && <div className="eq-detail-field"><CheckCircle size={14} /><span>Garantie</span><strong>jusqu'au {new Date(eq.warranty_end).toLocaleDateString('fr-FR')}</strong></div>}
          </div>

          {eq.notes && <div className="eq-detail-notes"><h4>Notes</h4><p>{eq.notes}</p></div>}
        </div>

        {/* Historique des attributions */}
        <div className="eq-detail-section">
          <h3><User size={16} /> Attributions</h3>
          {(!eq.assignments || eq.assignments.length === 0) ? (
            <p className="eq-detail-empty">Aucune attribution</p>
          ) : (
            <div className="eq-detail-list">
              {eq.assignments.map(a => (
                <div key={a.id} className={`eq-assign-item ${a.status}`}>
                  <div className="eq-assign-info">
                    <strong>{a.first_name} {a.last_name}</strong>
                    <span>{a.start_date ? new Date(a.start_date).toLocaleDateString('fr-FR') : ''} → {a.end_date ? new Date(a.end_date).toLocaleDateString('fr-FR') : 'En cours'}</span>
                    {a.notes && <em>{a.notes}</em>}
                  </div>
                  {a.status === 'active' && (
                    <button className="eq-btn-sm" onClick={() => onReturn(a.id)}>
                      <RotateCcw size={12} /> Retour
                    </button>
                  )}
                  {a.status === 'returned' && <span className="eq-assign-badge returned">Retourné</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tickets SAV */}
        <div className="eq-detail-section">
          <h3><Wrench size={16} /> Tickets SAV</h3>
          {(!eq.savTickets || eq.savTickets.length === 0) ? (
            <p className="eq-detail-empty">Aucun ticket</p>
          ) : (
            <div className="eq-detail-list">
              {eq.savTickets.map(t => {
                const tst = SAV_STATUS[t.status] || SAV_STATUS.open;
                const pri = SAV_PRIORITY[t.priority] || SAV_PRIORITY.medium;
                return (
                  <div key={t.id} className="eq-ticket-item">
                    <div className="eq-ticket-header">
                      <span className="eq-ticket-type">{SAV_TYPES[t.type] || t.type}</span>
                      <span className="eq-ticket-priority" style={{ color: pri.color }}>{pri.label}</span>
                      <span className="eq-ticket-status" style={{ background: tst.color }}>{tst.label}</span>
                    </div>
                    <strong>{t.title}</strong>
                    {t.description && <p>{t.description}</p>}
                    {t.resolution && <p className="eq-ticket-resolution">✅ {t.resolution}</p>}
                    <div className="eq-ticket-meta">
                      <span>{new Date(t.created_at).toLocaleDateString('fr-FR')}</span>
                      {t.reported_by_name && <span>par {t.reported_by_name}</span>}
                      {t.cost && <span>{parseFloat(t.cost).toFixed(2)} €</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══ LISTE DES TICKETS SAV ═══
const SavTicketsList = ({ tickets, equipment, persons, onEdit, onDelete }) => {
  if (tickets.length === 0) {
    return (
      <div className="eq-empty">
        <Wrench size={48} strokeWidth={1} />
        <p>Aucun ticket SAV</p>
        <span>Les tickets apparaîtront ici lorsque du matériel nécessitera une intervention</span>
      </div>
    );
  }

  return (
    <div className="eq-tickets-table">
      <table>
        <thead>
          <tr>
            <th>Priorité</th>
            <th>Titre</th>
            <th>Matériel</th>
            <th>Type</th>
            <th>Statut</th>
            <th>Date</th>
            <th>Coût</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map(t => {
            const tst = SAV_STATUS[t.status] || SAV_STATUS.open;
            const pri = SAV_PRIORITY[t.priority] || SAV_PRIORITY.medium;
            return (
              <tr key={t.id}>
                <td><span className="eq-pri-dot" style={{ background: pri.color }} title={pri.label} /></td>
                <td className="eq-ticket-title-cell">{t.title}</td>
                <td>
                  <span className="eq-ticket-eq">{t.category_icon} {t.equipment_name}</span>
                </td>
                <td>{SAV_TYPES[t.type] || t.type}</td>
                <td><span className="eq-status-badge" style={{ background: tst.color }}>{tst.label}</span></td>
                <td>{new Date(t.created_at).toLocaleDateString('fr-FR')}</td>
                <td>{t.cost ? `${parseFloat(t.cost).toFixed(2)} €` : '-'}</td>
                <td>
                  <div className="eq-table-actions">
                    <button onClick={() => onEdit(t)} title="Modifier"><Edit2 size={14} /></button>
                    <button onClick={() => onDelete(t.id)} title="Supprimer" className="eq-btn-danger-sm"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ═══ MODAL FORMULAIRE ÉQUIPEMENT ═══
const EquipmentFormModal = ({ equipment: eq, categories, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: eq?.name || '',
    reference: eq?.reference || '',
    serial_number: eq?.serial_number || '',
    category_id: eq?.category_id || '',
    status: eq?.status || 'available',
    location: eq?.location || '',
    purchase_date: eq?.purchase_date || '',
    purchase_price: eq?.purchase_price || '',
    warranty_end: eq?.warranty_end || '',
    notes: eq?.notes || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert('Nom requis');
    onSave({
      ...form,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
    });
  };

  return (
    <div className="eq-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="eq-modal">
        <div className="eq-modal-header">
          <h3>{eq ? '✏️ Modifier l\'équipement' : '➕ Nouveau matériel'}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="eq-modal-body">
          <div className="eq-form-grid">
            <div className="eq-form-field eq-form-full">
              <label>Nom *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Perceuse Bosch GSB 18V" autoFocus />
            </div>
            <div className="eq-form-field">
              <label>Référence</label>
              <input type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Ex: REF-001" />
            </div>
            <div className="eq-form-field">
              <label>N° de série</label>
              <input type="text" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            </div>
            <div className="eq-form-field">
              <label>Catégorie</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">— Sélectionner —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div className="eq-form-field">
              <label>Statut</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(EQUIPMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div className="eq-form-field">
              <label>Localisation</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ex: Dépôt A, Étagère 3" />
            </div>
            <div className="eq-form-field">
              <label>Date d'achat</label>
              <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
            </div>
            <div className="eq-form-field">
              <label>Prix d'achat (€)</label>
              <input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
            </div>
            <div className="eq-form-field">
              <label>Fin de garantie</label>
              <input type="date" value={form.warranty_end} onChange={(e) => setForm({ ...form, warranty_end: e.target.value })} />
            </div>
            <div className="eq-form-field eq-form-full">
              <label>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Remarques, accessoires inclus..." />
            </div>
          </div>
          <div className="eq-modal-footer">
            <button type="button" className="eq-btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="eq-btn-save">{eq ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═══ MODAL TICKET SAV ═══
const SavTicketFormModal = ({ ticket, equipment, persons, preselectedEquipment, onSave, onClose }) => {
  const [form, setForm] = useState({
    equipment_id: ticket?.equipment_id || preselectedEquipment?.id || '',
    assigned_to: ticket?.assigned_to || '',
    type: ticket?.type || 'panne',
    priority: ticket?.priority || 'medium',
    status: ticket?.status || 'open',
    title: ticket?.title || '',
    description: ticket?.description || '',
    resolution: ticket?.resolution || '',
    cost: ticket?.cost || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.equipment_id || !form.title.trim()) return alert('Équipement et titre requis');
    onSave({
      ...form,
      equipment_id: parseInt(form.equipment_id),
      assigned_to: form.assigned_to ? parseInt(form.assigned_to) : null,
      cost: form.cost ? parseFloat(form.cost) : null,
    });
  };

  return (
    <div className="eq-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="eq-modal">
        <div className="eq-modal-header">
          <h3>{ticket ? '✏️ Modifier le ticket' : '🔧 Nouveau ticket SAV'}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="eq-modal-body">
          <div className="eq-form-grid">
            <div className="eq-form-field eq-form-full">
              <label>Équipement *</label>
              <select value={form.equipment_id} onChange={(e) => setForm({ ...form, equipment_id: e.target.value })} required>
                <option value="">— Sélectionner —</option>
                {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.category_icon} {eq.name} {eq.reference ? `(${eq.reference})` : ''}</option>)}
              </select>
            </div>
            <div className="eq-form-field eq-form-full">
              <label>Titre *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Batterie ne charge plus" autoFocus />
            </div>
            <div className="eq-form-field">
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(SAV_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="eq-form-field">
              <label>Priorité</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {Object.entries(SAV_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {ticket && (
              <div className="eq-form-field">
                <label>Statut</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(SAV_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            )}
            <div className="eq-form-field">
              <label>Technicien assigné</label>
              <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                <option value="">— Non assigné —</option>
                {persons.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </select>
            </div>
            <div className="eq-form-field eq-form-full">
              <label>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Détails du problème, circonstances..." />
            </div>
            {ticket && (
              <>
                <div className="eq-form-field eq-form-full">
                  <label>Résolution</label>
                  <textarea value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} rows={2} placeholder="Action corrective, pièces changées..." />
                </div>
                <div className="eq-form-field">
                  <label>Coût (€)</label>
                  <input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
                </div>
              </>
            )}
          </div>
          <div className="eq-modal-footer">
            <button type="button" className="eq-btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="eq-btn-save">{ticket ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═══ MODAL ATTRIBUTION ═══
const AssignModal = ({ equipment: eq, persons, onSave, onClose }) => {
  const [form, setForm] = useState({
    equipment_id: eq.id,
    assigned_to: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    affaire_id: '',
    notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.assigned_to) return alert('Veuillez sélectionner une personne');
    onSave({
      ...form,
      assigned_to: parseInt(form.assigned_to),
    });
  };

  return (
    <div className="eq-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="eq-modal eq-modal-sm">
        <div className="eq-modal-header">
          <h3>👤 Attribuer : {eq.name}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="eq-modal-body">
          <div className="eq-form-grid">
            <div className="eq-form-field eq-form-full">
              <label>Attribuer à *</label>
              <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} required autoFocus>
                <option value="">— Sélectionner —</option>
                {persons.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </select>
            </div>
            <div className="eq-form-field">
              <label>Date de début</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="eq-form-field">
              <label>Date de retour prévue</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div className="eq-form-field eq-form-full">
              <label>Notes</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ex: Pour chantier Rouen" />
            </div>
          </div>
          <div className="eq-modal-footer">
            <button type="button" className="eq-btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="eq-btn-save">Attribuer</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default React.memo(EquipmentPanel);
