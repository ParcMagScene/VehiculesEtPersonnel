import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users, Award, CalendarDays, Briefcase,
  Plus, Edit2, Trash2, X, Save, Search,
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle,
  User, Check, Clock,
  Link2, Upload, Star, Filter, CalendarOff,
} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import PhoneInput, { formatPhoneDisplay } from './PhoneInput';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  eachDayOfInterval, eachMonthOfInterval, format, parseISO,
  isSameDay, isWeekend as isWeekendFn,
  isSameWeek, isSameMonth, isSameYear,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../utils/api';
import AssignmentDialog from './AssignmentDialog';
import { PersonnelSlidePanel } from './PersonnelDetailPanel';
import LeaveRequestForm from './LeaveRequestForm';
import LeaveRequestsPanel from './LeaveRequestsPanel';
import LeaveValidationPanel from './LeaveValidationPanel';
import PersonnelContextMenu from './PersonnelContextMenu';
import PeriodCalendarModal from './PeriodCalendarModal';
import PersonnelImportModal from './PersonnelImportModal';
import MonthSelector from './MonthSelector';
import WeekSelector from './WeekSelector';
import YearSelector from './YearSelector';
import './PersonnelPanel.css';
import './EquipmentPanel.css';
import './Calendar.css';
import { useToast } from '../hooks/useToast';
import PersonnelAgenda from './PersonnelAgenda';
import LeavesTab from './LeavesTab';
import SkillsTab from './SkillsTab';
import PositionsTab from './PositionsTab';
import {
  PERSON_TYPES, CONTRACT_TYPES, SKILL_CATEGORIES, SKILL_LEVELS,
  POSITION_CATEGORIES, PERMANENT_TYPES, NON_PERMANENT_TYPES,
  getCategoryColor, getPositionCategoryColor,
} from './personnelConstants';

// ═══════════════════════════════════════
// Composant principal
// ═══════════════════════════════════════

const PersonnelPanel = ({ currentUser, mode = 'standalone', view, setView, currentDate, setCurrentDate, googleEvents = [], navigateToPersonId, onNavigateToPersonHandled, quickAssignmentSlot, onQuickAssignmentHandled }) => {
  const toast = useToast();
  const [subTab, setSubTab] = useState(mode === 'planning' ? 'planning' : 'persons');
  const [persons, setPersons] = useState([]);
  const [skills, setSkills] = useState([]);
  const [positions, setPositions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [personToEdit, setPersonToEdit] = useState(null);

  // États pour le formulaire d'édition (mode planning)
  const [editFormVisible, setEditFormVisible] = useState(false);
  const [editingPersonDirect, setEditingPersonDirect] = useState(null);
  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    type: 'permanent', contractType: '', userId: null,
    status: 'active', notes: '',
    skills: [],
    defaultPositions: [],
  });

  const openEditDirect = (person) => {
    let defaultPos = [];
    try {
      const raw = person.defaultPositions || person.default_positions;
      defaultPos = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
    } catch { /* ignore */ }
    setEditForm({
      firstName: person.firstName || '',
      lastName: person.lastName || '',
      email: person.email || '',
      phone: person.phone || '',
      type: person.type || 'permanent',
      contractType: person.contractType || '',
      userId: person.userId || null,
      status: person.status || 'active',
      notes: person.notes || '',
      skills: (person.skills || []).map(s => ({
        skillId: s.skillId || s.skill_id,
        level: s.level || 'interm\u00e9diaire',
      })),
      defaultPositions: defaultPos,
    });
    setEditingPersonDirect(person);
    setEditFormVisible(true);
  };

  const resetEditForm = () => {
    setEditForm({
      firstName: '', lastName: '', email: '', phone: '',
      type: 'permanent', contractType: '', userId: null,
      status: 'active', notes: '',
      skills: [],
      defaultPositions: [],
    });
    setEditingPersonDirect(null);
    setEditFormVisible(false);
  };

  // Ouvrir le modal en mode création (formulaire vide)
  const openCreateDirect = () => {
    setEditForm({
      firstName: '', lastName: '', email: '', phone: '',
      type: 'permanent', contractType: '', userId: null,
      status: 'active', notes: '',
      skills: [],
      defaultPositions: [],
    });
    setEditingPersonDirect(null);
    setEditFormVisible(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        first_name: editForm.firstName,
        last_name: editForm.lastName,
        email: editForm.email || null,
        phone: editForm.phone || null,
        type: editForm.type,
        contract_type: editForm.type === 'contractuel' ? (editForm.contractType || 'intermittent') : null,
        user_id: editForm.userId ? Number(editForm.userId) : null,
        status: editForm.status,
        notes: editForm.notes || null,
        default_positions: JSON.stringify(editForm.defaultPositions || []),
        skills: editForm.skills.map(s => ({
          skill_id: s.skillId,
          level: s.level,
        })),
      };
      if (editingPersonDirect) {
        const updated = await api.updatePerson(editingPersonDirect.id, payload);
        setPersons(prev => prev.map(p => p.id === editingPersonDirect.id ? updated : p));
      } else {
        const created = await api.createPerson(payload);
        setPersons(prev => [...prev, created]);
      }
      resetEditForm();
    } catch (err) {
      toast.error('Erreur : ' + (err.message || 'Impossible de sauvegarder'));
    }
  };

  const toggleEditSkill = (skillId) => {
    setEditForm(prev => {
      const existing = prev.skills.find(s => s.skillId === skillId);
      if (existing) return { ...prev, skills: prev.skills.filter(s => s.skillId !== skillId) };
      return { ...prev, skills: [...prev.skills, { skillId, level: 'interm\u00e9diaire' }] };
    });
  };

  const updateEditSkillLevel = (skillId, level) => {
    setEditForm(prev => ({
      ...prev,
      skills: prev.skills.map(s => s.skillId === skillId ? { ...s, level } : s),
    }));
  };

  // Sous-onglets (filtrés selon le mode)
  const allSubTabs = [
    { id: 'persons', label: 'Personnel', icon: Users, color: '#3b82f6' },
    { id: 'skills', label: 'Compétences', icon: Award, color: '#8b5cf6' },
    { id: 'positions', label: 'Postes', icon: Briefcase, color: '#f97316' },
    { id: 'planning', label: 'Planning', icon: CalendarDays, color: '#10b981' },
    { id: 'agenda', label: 'Agenda', icon: Clock, color: '#06b6d4' },
    { id: 'leaves', label: 'Congés', icon: CalendarOff, color: '#ef4444' },
  ];
  const subTabs = mode === 'management'
    ? allSubTabs.filter(t => t.id !== 'planning')
    : mode === 'planning'
      ? []
      : allSubTabs;

  // Chargement initial
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [personsData, skillsData, positionsData, usersData] = await Promise.all([
        api.getPersons(),
        api.getSkills(),
        api.getPositions(),
        api.getUsers().catch(() => []),
      ]);
      setPersons(personsData || []);
      setSkills(skillsData || []);
      setPositions(positionsData || []);
      setUsers(usersData || []);
      setError(null);
    } catch (err) {
      console.error('[Personnel] ERREUR chargement:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="personnel-panel">
        <div className="personnel-loading">
          <div className="loading-spinner" />
          <p>Chargement du module Personnel...</p>
        </div>
      </div>
    );
  }

  // Mode planning = vue principale pleine page
  if (mode === 'planning') {
    return (
      <div className="personnel-panel personnel-panel--main">
        {error && (
          <div className="personnel-error">
            <AlertTriangle size={16} /> {error}
            <button onClick={loadData}>Réessayer</button>
          </div>
        )}
        <PlanningTab persons={persons} skills={skills} positions={positions} view={view} setView={setView} currentDate={currentDate} setCurrentDate={setCurrentDate} googleEvents={googleEvents} onPersonEdit={openEditDirect} onPersonCreate={openCreateDirect} navigateToPersonId={navigateToPersonId} onNavigateToPersonHandled={onNavigateToPersonHandled} quickAssignmentSlot={quickAssignmentSlot} onQuickAssignmentHandled={onQuickAssignmentHandled} currentUser={currentUser} />
        {editFormVisible && (
          <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && resetEditForm()}>
            <div className="personnel-edit-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2><User size={20} /> {editingPersonDirect ? 'Modifier la fiche' : 'Nouvelle personne'}</h2>
                <button className="close-button" onClick={resetEditForm}><X size={24} /></button>
              </div>

              <form id="personnel-edit-form" className="personnel-edit-form-body" onSubmit={handleEditSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Prénom *</label>
                    <input required value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Nom *</label>
                    <input required value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Téléphone</label>
                    <PhoneInput value={editForm.phone} onChange={(val) => setEditForm({ ...editForm, phone: val })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Catégorie</label>
                    <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value, contractType: e.target.value === 'permanent' ? '' : editForm.contractType })}>
                      {PERSON_TYPES.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
                    </select>
                  </div>
                  {editForm.type === 'contractuel' ? (
                    <div className="form-group">
                      <label>Type de contrat</label>
                      <select value={editForm.contractType} onChange={e => setEditForm({ ...editForm, contractType: e.target.value })}>
                        <option value="">-- Choisir --</option>
                        {CONTRACT_TYPES.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>Statut</label>
                      <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                        <option value="active">Actif</option>
                        <option value="inactive">Inactif</option>
                      </select>
                    </div>
                  )}
                </div>
                {editForm.type === 'contractuel' && (
                  <div className="form-group">
                    <label>Statut</label>
                    <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Notes</label>
                  <textarea rows={2} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Compétences</label>
                  <div className="skills-selector">
                    {skills.map(skill => {
                      const selected = editForm.skills.find(s => s.skillId === skill.id);
                      return (
                        <div key={skill.id} className={`skill-chip-select ${selected ? 'selected' : ''}`}>
                          <button type="button" className="skill-toggle" onClick={() => toggleEditSkill(skill.id)} style={{ '--chip-color': getCategoryColor(skill.category) }}>
                            {selected && <Check size={12} />} {skill.name}
                          </button>
                          {selected && (
                            <select className="skill-level-select" value={selected.level} onChange={e => updateEditSkillLevel(skill.id, e.target.value)}>
                              {SKILL_LEVELS.map(l => (<option key={l.value} value={l.value}>{l.label}</option>))}
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="form-group">
                  <label>Postes habituels</label>
                  <div className="skills-selector">
                    {positions.map(pos => {
                      const selected = editForm.defaultPositions.includes(pos.name);
                      const catColor = POSITION_CATEGORIES.find(c => c.value === pos.category)?.color || 'var(--theme-text-gray)';
                      return (
                        <div key={pos.id} className={`skill-chip-select ${selected ? 'selected' : ''}`}>
                          <button type="button" className="skill-toggle" onClick={() => setEditForm(prev => ({ ...prev, defaultPositions: selected ? prev.defaultPositions.filter(n => n !== pos.name) : [...prev.defaultPositions, pos.name] }))} style={{ '--chip-color': catColor }}>
                            {selected && <Check size={12} />} {pos.name}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </form>

              <div className="form-actions">
                <div />
                <div className="right-actions">
                  <button type="button" className="cancel-button" onClick={resetEditForm}>Annuler</button>
                  <button type="submit" form="personnel-edit-form" className="save-button"><Save size={18} /> Enregistrer</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="personnel-panel">
      {error && (
        <div className="personnel-error">
          <AlertTriangle size={16} /> {error}
          <button onClick={loadData}>Réessayer</button>
        </div>
      )}

      {/* Sous-onglets */}
      {subTabs.length > 0 && (
      <div className="personnel-subtabs">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            className={`personnel-subtab ${subTab === tab.id ? 'active' : ''}`}
            onClick={() => setSubTab(tab.id)}
            style={{ '--tab-color': tab.color }}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      )}

      {/* Contenu */}
      <div className="personnel-content">
        {subTab === 'persons' && (
          <PersonsTab
            persons={persons}
            setPersons={setPersons}
            skills={skills}
            positions={positions}
            users={users}
            currentUser={currentUser}
            personToEdit={personToEdit}
            onPersonToEditConsumed={() => setPersonToEdit(null)}
          />
        )}
        {subTab === 'skills' && (
          <SkillsTab
            skills={skills}
            setSkills={setSkills}
            currentUser={currentUser}
          />
        )}
        {subTab === 'positions' && (
          <PositionsTab
            positions={positions}
            setPositions={setPositions}
            currentUser={currentUser}
          />
        )}
        {subTab === 'planning' && (
          <PlanningTab
            persons={persons}
            skills={skills}
            positions={positions}
            view={view}
            setView={setView}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            googleEvents={googleEvents}
            onPersonEdit={(person) => { setPersonToEdit(person); setSubTab('persons'); }}
            navigateToPersonId={navigateToPersonId}
            onNavigateToPersonHandled={onNavigateToPersonHandled}
            quickAssignmentSlot={quickAssignmentSlot}
            onQuickAssignmentHandled={onQuickAssignmentHandled}
            currentUser={currentUser}
          />
        )}
        {subTab === 'agenda' && (
          <PersonnelAgenda
            persons={persons}
            currentUser={currentUser}
            googleEvents={googleEvents}
          />
        )}
        {subTab === 'leaves' && (
          <LeavesTab
            persons={persons}
            currentUser={currentUser}
          />
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// Onglet PERSONNES (pattern Parc : table + modal)
// ═══════════════════════════════════════

const PersonsTab = ({ persons, setPersons, skills, positions = [], users, currentUser, personToEdit, onPersonToEditConsumed }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const filteredPersons = useMemo(() => persons.filter(p => {
    const matchSearch = `${p.firstName} ${p.lastName} ${p.email || ''} ${p.phone || ''}`
      .toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = !filterType ||
      (filterType === '_permanent' ? PERMANENT_TYPES.includes(p.type) :
       filterType === '_non_permanent' ? NON_PERMANENT_TYPES.includes(p.type) :
       p.type === filterType);
    const matchStatus = !filterStatus || p.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  }), [persons, searchTerm, filterType, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const total = persons.length;
    const active = persons.filter(p => p.status === 'active').length;
    const permanent = persons.filter(p => PERMANENT_TYPES.includes(p.type)).length;
    const nonPermanent = persons.filter(p => NON_PERMANENT_TYPES.includes(p.type)).length;
    const inactive = persons.filter(p => p.status === 'inactive').length;
    return { total, active, permanent, nonPermanent, inactive };
  }, [persons]);

  const openEdit = (person) => {
    setEditingPerson(person);
    setShowFormModal(true);
  };

  const openCreate = () => {
    setEditingPerson(null);
    setShowFormModal(true);
  };

  // Ouvrir automatiquement la fiche si une personne est demandée par le parent
  useEffect(() => {
    if (personToEdit) {
      openEdit(personToEdit);
      onPersonToEditConsumed?.();
    }
  }, [personToEdit]);

  const handleSave = async (payload) => {
    try {
      if (editingPerson) {
        const updated = await api.updatePerson(editingPerson.id, payload);
        setPersons(prev => prev.map(p => p.id === editingPerson.id ? updated : p));
      } else {
        const created = await api.createPerson(payload);
        setPersons(prev => [...prev, created]);
      }
      setShowFormModal(false);
      setEditingPerson(null);
    } catch (err) {
      toast.error('Erreur : ' + (err.message || 'Impossible de sauvegarder'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette personne ?')) return;
    try {
      await api.deletePerson(id);
      setPersons(prev => prev.filter(p => p.id !== id));
      if (selectedPerson?.id === id) setSelectedPerson(null);
    } catch (err) {
      toast.error('Erreur : ' + (err.message || 'Impossible de supprimer'));
    }
  };

  const getTypeBadge = (person) => {
    const t = person.type;
    if (t === 'permanent') return { label: 'Permanent', cls: 'type-permanent' };
    if (t === 'salarié') return { label: 'Salarié', cls: 'type-salarie' };
    if (t === 'stagiaire') return { label: 'Stagiaire', cls: 'type-stagiaire' };
    if (t === 'contractuel') {
      const sub = CONTRACT_TYPES.find(c => c.value === person.contractType)?.label || person.contractType || 'Contractuel';
      return { label: sub, cls: 'type-contractuel' };
    }
    return { label: t, cls: '' };
  };

  return (
    <div className="personnel-tab-content">
      {/* Stats row */}
      <div className="eq-header pp-header">
        <div className="eq-stats-row">
          <div role="button" tabIndex={0} className={`eq-stat ${!filterType && !filterStatus ? 'active' : ''}`} onClick={() => { setFilterType(''); setFilterStatus(''); }}>
            <Users size={16} />
            <span className="eq-stat-value">{stats.total}</span>
            <span className="eq-stat-label">Total</span>
          </div>
          <div role="button" tabIndex={0} className={`eq-stat eq-stat-available ${filterStatus === 'active' ? 'active' : ''}`} onClick={() => { setFilterStatus(filterStatus === 'active' ? '' : 'active'); setFilterType(''); }}>
            <CheckCircle size={16} />
            <span className="eq-stat-value">{stats.active}</span>
            <span className="eq-stat-label">Actifs</span>
          </div>
          <div role="button" tabIndex={0} className={`eq-stat eq-stat-inuse ${filterType === '_permanent' ? 'active' : ''}`} onClick={() => { setFilterStatus(''); setFilterType(filterType === '_permanent' ? '' : '_permanent'); }}>
            <User size={16} />
            <span className="eq-stat-value">{stats.permanent}</span>
            <span className="eq-stat-label">Permanents</span>
          </div>
          <div role="button" tabIndex={0} className={`eq-stat eq-stat-maint ${filterType === '_non_permanent' ? 'active' : ''}`} onClick={() => { setFilterStatus(''); setFilterType(filterType === '_non_permanent' ? '' : '_non_permanent'); }}>
            <Clock size={16} />
            <span className="eq-stat-value">{stats.nonPermanent}</span>
            <span className="eq-stat-label">Non-permanents</span>
          </div>
          {stats.inactive > 0 && (
            <div role="button" tabIndex={0} className={`eq-stat eq-stat-tickets ${filterStatus === 'inactive' ? 'active' : ''}`} onClick={() => setFilterStatus(filterStatus === 'inactive' ? '' : 'inactive')}>
              <AlertTriangle size={16} />
              <span className="eq-stat-value">{stats.inactive}</span>
              <span className="eq-stat-label">Inactifs</span>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="eq-toolbar pp-toolbar">
        <div className="eq-toolbar-actions">
          <div className="eq-search">
            <Search size={14} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Rechercher..."
            />
            {searchTerm && <button className="eq-search-clear" onClick={() => setSearchTerm('')}><X size={12} /></button>}
          </div>
          <select className="eq-filter" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Tous les types</option>
            {PERSON_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {currentUser?.isAdmin && (
            <button className="eq-btn-secondary" onClick={() => setShowImportModal(true)} title="Importer depuis un CSV">
              <Upload size={14} /> Import CSV
            </button>
          )}
          <button className="eq-btn-add" onClick={openCreate}>
            <Plus size={14} /> Personnel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="eq-content-wrapper">
        <div className="eq-content">
          {filteredPersons.length === 0 ? (
            <div className="eq-empty">
              <Users size={48} strokeWidth={1} />
              <p>{searchTerm ? 'Aucun résultat' : 'Aucune personne enregistrée'}</p>
              <span>Ajoutez votre premier personnel avec le bouton +</span>
            </div>
          ) : (
            <div className="eq-table-wrap">
              <table className="eq-table pp-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Catégorie</th>
                    <th>Téléphone</th>
                    <th>Email</th>
                    <th>Postes</th>
                    <th>Statut</th>
                    <th style={{ width: 70 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPersons.map(person => {
                    const badge = getTypeBadge(person);
                    let postes = [];
                    try {
                      const raw = person.defaultPositions || person.default_positions;
                      postes = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
                    } catch { /* ignore */ }
                    return (
                      <tr
                        key={person.id}
                        className={`eq-table-row${selectedPerson?.id === person.id ? ' selected' : ''}${person.status === 'inactive' ? ' pp-row-inactive' : ''}`}
                        onClick={() => setSelectedPerson(selectedPerson?.id === person.id ? null : person)}
                        onDoubleClick={() => openEdit(person)}
                      >
                        <td className="eq-table-thumb">
                          <span className="pp-avatar-cell"><User size={16} /></span>
                        </td>
                        <td className="eq-table-name">{person.lastName}</td>
                        <td>{person.firstName}</td>
                        <td>
                          <span className={`pp-type-badge ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td className="pp-phone-cell">{formatPhoneDisplay(person.phone) || '—'}</td>
                        <td className="pp-email-cell">{person.email || '—'}</td>
                        <td className="pp-postes-cell">
                          {postes.length > 0 ? (
                            <div className="pp-postes-chips">
                              {postes.slice(0, 2).map((name, i) => {
                                const posObj = positions.find(p => p.name === name);
                                const catColor = POSITION_CATEGORIES.find(c => c.value === posObj?.category)?.color || 'var(--theme-text-gray)';
                                return <span key={i} className="skill-chip-mini" style={{ '--chip-color': catColor }}>{name}</span>;
                              })}
                              {postes.length > 2 && <span className="skill-more">+{postes.length - 2}</span>}
                            </div>
                          ) : '—'}
                        </td>
                        <td>
                          <span className={`pp-status-dot ${person.status}`}>
                            {person.status === 'active' ? '● Actif' : '○ Inactif'}
                          </span>
                        </td>
                        <td className="pp-actions-cell">
                          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openEdit(person); }} title="Modifier">
                            <Edit2 size={14} />
                          </button>
                          {currentUser?.isAdmin && (
                            <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); handleDelete(person.id); }} title="Supprimer">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Slide panel détail (clic simple) */}
        <PersonnelSlidePanel
          person={selectedPerson}
          positions={positions}
          skills={skills}
          onClose={() => setSelectedPerson(null)}
          onEdit={(person) => { setSelectedPerson(null); openEdit(person); }}
        />
      </div>

      {/* Modal formulaire (ajout/édition) */}
      {showFormModal && (
        <PersonFormModal
          person={editingPerson}
          skills={skills}
          positions={positions}
          users={users}
          onSave={handleSave}
          onClose={() => { setShowFormModal(false); setEditingPerson(null); }}
        />
      )}

      {/* Modal Import CSV */}
      {showImportModal && (
        <PersonnelImportModal
          onClose={() => setShowImportModal(false)}
          onImportDone={async () => {
            try {
              const data = await api.getPersons();
              setPersons(data);
            } catch (e) { console.error(e); }
          }}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════
// Modal formulaire personnel (pattern Parc)
// ═══════════════════════════════════════

const PersonFormModal = ({ person, skills, positions, users, onSave, onClose }) => {
  const [form, setForm] = useState(() => {
    let defaultPos = [];
    if (person) {
      try {
        const raw = person.defaultPositions || person.default_positions;
        defaultPos = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
      } catch { /* ignore */ }
    }
    return {
      firstName: person?.firstName || '',
      lastName: person?.lastName || '',
      email: person?.email || '',
      phone: person?.phone || '',
      type: person?.type || 'permanent',
      contractType: person?.contractType || '',
      userId: person?.userId || null,
      status: person?.status || 'active',
      notes: person?.notes || '',
      skills: (person?.skills || []).map(s => ({
        skillId: s.skillId || s.skill_id,
        level: s.level || 'intermédiaire',
      })),
      defaultPositions: defaultPos,
    };
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) return toast.warning('Prénom et nom requis');
    onSave({
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email || null,
      phone: form.phone || null,
      type: form.type,
      contract_type: form.type === 'contractuel' ? (form.contractType || 'intermittent') : null,
      user_id: form.userId ? Number(form.userId) : null,
      status: form.status,
      notes: form.notes || null,
      default_positions: JSON.stringify(form.defaultPositions || []),
      skills: form.skills.map(s => ({ skill_id: s.skillId, level: s.level })),
    });
  };

  const toggleSkill = (skillId) => {
    setForm(prev => {
      const existing = prev.skills.find(s => s.skillId === skillId);
      if (existing) return { ...prev, skills: prev.skills.filter(s => s.skillId !== skillId) };
      return { ...prev, skills: [...prev.skills, { skillId, level: 'intermédiaire' }] };
    });
  };

  const updateSkillLevel = (skillId, level) => {
    setForm(prev => ({
      ...prev,
      skills: prev.skills.map(s => s.skillId === skillId ? { ...s, level } : s),
    }));
  };

  return (
    <div className="eq-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="eq-modal pp-form-modal">
        <div className="eq-modal-header">
          <h3>{person ? '✏️ Modifier la fiche' : '➕ Nouvelle personne'}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="eq-modal-body">
          <div className="eq-form-grid">
            <div className="eq-form-field">
              <label>Prénom *</label>
              <input type="text" required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} autoFocus />
            </div>
            <div className="eq-form-field">
              <label>Nom *</label>
              <input type="text" required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <div className="eq-form-field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="eq-form-field">
              <label>Téléphone</label>
              <PhoneInput value={form.phone} onChange={(val) => setForm({ ...form, phone: val })} />
            </div>
            <div className="eq-form-field">
              <label>Catégorie</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, contractType: e.target.value !== 'contractuel' ? '' : form.contractType })}>
                {PERSON_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {form.type === 'contractuel' && (
              <div className="eq-form-field">
                <label>Type de contrat</label>
                <select value={form.contractType} onChange={e => setForm({ ...form, contractType: e.target.value })}>
                  <option value="">— Choisir —</option>
                  {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            )}
            <div className="eq-form-field">
              <label>Statut</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </select>
            </div>
            <div className="eq-form-field">
              <label><Link2 size={14} /> Compte utilisateur</label>
              <select
                value={form.userId || ''}
                onChange={e => setForm({ ...form, userId: e.target.value || null })}
              >
                <option value="">Aucun (non lié)</option>
                {(users || []).map(u => (
                  <option key={u.id} value={u.id}>{u.name || u.email || `Utilisateur #${u.id}`}</option>
                ))}
              </select>
            </div>
            <div className="eq-form-field eq-form-full">
              <label>Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            {/* Compétences */}
            <div className="eq-form-field eq-form-full">
              <label>Compétences</label>
              <div className="skills-selector">
                {skills.map(skill => {
                  const selected = form.skills.find(s => s.skillId === skill.id);
                  return (
                    <div key={skill.id} className={`skill-chip-select ${selected ? 'selected' : ''}`}>
                      <button type="button" className="skill-toggle" onClick={() => toggleSkill(skill.id)} style={{ '--chip-color': getCategoryColor(skill.category) }}>
                        {selected && <Check size={12} />} {skill.name}
                      </button>
                      {selected && (
                        <select className="skill-level-select" value={selected.level} onChange={e => updateSkillLevel(skill.id, e.target.value)}>
                          {SKILL_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Postes habituels */}
            <div className="eq-form-field eq-form-full">
              <label>Postes habituels</label>
              <div className="skills-selector">
                {positions.map(pos => {
                  const selected = form.defaultPositions.includes(pos.name);
                  const catColor = POSITION_CATEGORIES.find(c => c.value === pos.category)?.color || 'var(--theme-text-gray)';
                  return (
                    <div key={pos.id} className={`skill-chip-select ${selected ? 'selected' : ''}`}>
                      <button type="button" className="skill-toggle" onClick={() => setForm(prev => ({ ...prev, defaultPositions: selected ? prev.defaultPositions.filter(n => n !== pos.name) : [...prev.defaultPositions, pos.name] }))} style={{ '--chip-color': catColor }}>
                        {selected && <Check size={12} />} {pos.name}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="eq-modal-footer">
            <button type="button" className="eq-btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="eq-btn-save">{person ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// Onglet PLANNING
// ═══════════════════════════════════════

const PlanningTab = ({ persons, skills, positions = [], view = 'week', setView, currentDate = new Date(), setCurrentDate, googleEvents = [], onPersonEdit, onPersonCreate, navigateToPersonId, onNavigateToPersonHandled, quickAssignmentSlot, onQuickAssignmentHandled, currentUser }) => {
  const scrollAreaRef = useRef(null);
  const headerScrollRef = useRef(null);
  const personColumnRef = useRef(null);
  const [collapsedSections, setCollapsedSections] = useState({ permanents: false, nonPermanents: false });
  const [selectedPersonForDetails, setSelectedPersonForDetails] = useState(null);
  const clickTimerRef = useRef(null);

  // ═══ Navigation de dates ═══
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [showWeekSelector, setShowWeekSelector] = useState(false);
  const [showYearSelector, setShowYearSelector] = useState(false);

  const goToPrevious = () => {
    if (!setCurrentDate) return;
    const newDate = new Date(currentDate);
    if (view === 'week') newDate.setDate(newDate.getDate() - 7);
    else if (view === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else newDate.setFullYear(newDate.getFullYear() - 1);
    setCurrentDate(newDate);
  };
  const goToNext = () => {
    if (!setCurrentDate) return;
    const newDate = new Date(currentDate);
    if (view === 'week') newDate.setDate(newDate.getDate() + 7);
    else if (view === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else newDate.setFullYear(newDate.getFullYear() + 1);
    setCurrentDate(newDate);
  };
  const goToToday = () => setCurrentDate?.(new Date());
  const getDateLabel = () => {
    let label = '';
    if (view === 'week') label = format(currentDate, "'Semaine du' d MMMM yyyy", { locale: fr });
    else if (view === 'month') label = format(currentDate, 'MMMM yyyy', { locale: fr });
    else label = format(currentDate, 'yyyy', { locale: fr });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };
  const ppIsCurrentPeriod = () => {
    const today = new Date();
    if (view === 'week') return isSameWeek(currentDate, today, { weekStartsOn: 1 });
    if (view === 'month') return isSameMonth(currentDate, today);
    return isSameYear(currentDate, today);
  };
  const ppShowTodayHighlight = !ppIsCurrentPeriod();

  // ═══ Toolbar : recherche, filtre, favoris ═══
  const [planningSearch, setPlanningSearch] = useState('');
  const [planningFilter, setPlanningFilter] = useState(''); // '', 'permanent', 'salarié', 'contractuel', 'stagiaire'
  const [sortByFavorites, setSortByFavorites] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      const saved = localStorage.getItem('personnel_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const toggleFavorite = useCallback((personId) => {
    setFavoriteIds(prev => {
      const next = prev.includes(personId) ? prev.filter(id => id !== personId) : [...prev, personId];
      localStorage.setItem('personnel_favorites', JSON.stringify(next));
      return next;
    });
  }, []);

  // Navigation croisée depuis un autre module
  useEffect(() => {
    if (navigateToPersonId && persons.length > 0) {
      const target = persons.find(p => p.id === navigateToPersonId);
      if (target) {
        setSelectedPersonForDetails(target);
      }
      if (onNavigateToPersonHandled) onNavigateToPersonHandled();
    }
  }, [navigateToPersonId, persons, onNavigateToPersonHandled]);

  // Ouvrir le dialog d'affectation rapide depuis l'extérieur
  useEffect(() => {
    if (quickAssignmentSlot && persons.length > 0) {
      const dayDate = new Date(quickAssignmentSlot.day + 'T00:00:00');
      setAssignmentDialog({
        person: persons[0] || null,
        day: dayDate,
        period: quickAssignmentSlot.period || 'AM',
      });
      if (onQuickAssignmentHandled) onQuickAssignmentHandled();
    }
  }, [quickAssignmentSlot, persons, onQuickAssignmentHandled]);

  // Planning data state
  const [planningData, setPlanningData] = useState({ missions: [], availabilities: [] });
  const [assignmentDialog, setAssignmentDialog] = useState(null); // { person, day, period, endDay? }
  const [deleteMission, setDeleteMission] = useState(null); // { mission, person }
  const [hoveredSlot, setHoveredSlot] = useState(null); // { personId, slotIndex }

  // Leave management state
  const [showLeaveModal, setShowLeaveModal] = useState(null); // { person } or { personId }
  const [showLeaveApproval, setShowLeaveApproval] = useState(false);
  const [showLeaveHistory, setShowLeaveHistory] = useState(null); // { personId }
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null); // { x, y, person }
  const [periodCalendar, setPeriodCalendar] = useState(null); // { person, type }

  // Drag-to-create state
  const [dragCreate, setDragCreate] = useState(null); // { person, startSlotIdx, endSlotIdx }
  const isDragCreatingRef = useRef(false);

  // Drag-to-move state
  const [dragMove, setDragMove] = useState(null); // { span, person, offsetSlots, originalStartIdx }
  const isDragMovingRef = useRef(false);
  const pendingBlockDragRef = useRef(null); // { span, person, slotIndex, offsetSlots, originalStartIdx }

  // Resize state
  const [resizeState, setResizeState] = useState(null); // { span, person, edge: 'start'|'end', originalStartIdx, originalSlotCount }
  const isResizingRef = useRef(false);
  const lastDragSlotRef = useRef(null);
  const wasDraggedRef = useRef(false); // true si un vrai déplacement a eu lieu (pas un simple clic)

  // Calcul des jours selon la vue
  const days = useMemo(() => {
    if (view === 'week') {
      return eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      });
    } else if (view === 'month') {
      return eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      });
    } else {
      return eachMonthOfInterval({
        start: startOfYear(currentDate),
        end: endOfYear(currentDate),
      });
    }
  }, [view, currentDate]);

  // Slots journaliers (1 par jour, ou 1 par mois en vue année)
  const timeSlots = useMemo(() => {
    return days.map(day => ({ day }));
  }, [days, view]);

  // Charger les données du planning (missions + assignments)
  const loadPlanning = useCallback(async () => {
    try {
      if (days.length === 0) return;
      const startStr = format(days[0], 'yyyy-MM-dd');
      const endStr = format(days[days.length - 1], 'yyyy-MM-dd');
      const data = await api.getPersonnelPlanning({ startDate: startStr, endDate: endStr });
      setPlanningData(data || { missions: [], availabilities: [] });
    } catch (err) {
      console.error('Erreur chargement planning:', err);
    }
  }, [days]);

  useEffect(() => {
    loadPlanning();
  }, [loadPlanning]);

  // Charger le nombre de demandes en attente (module congés)
  useEffect(() => {
    api.getPendingLeavesCount()
      .then(r => setPendingLeaveCount(r?.count || 0))
      .catch(() => {});
  }, [planningData]);

  // Index des missions par personne avec calcul de span continu
  // { personId -> [{ mission, assignment, startSlotIdx, slotCount }] }
  const missionSpans = useMemo(() => {
    const spans = {};
    if (view === 'year' || days.length === 0) return spans;
    const viewStart = days[0];
    const viewEnd = days[days.length - 1];

    (planningData.missions || []).forEach(mission => {
      if (!mission.assignments) return;
      mission.assignments.forEach(a => {
        const personId = a.personId || a.person_id;
        if (!personId) return;
        if (!spans[personId]) spans[personId] = [];

        try {
          const mStart = parseISO(mission.startDate || mission.start_date);
          const mEnd = parseISO(mission.endDate || mission.end_date);

          // Clamper aux bornes visibles
          const visStart = mStart < viewStart ? viewStart : mStart;
          const visEnd = mEnd > viewEnd ? viewEnd : mEnd;
          if (visStart > viewEnd || visEnd < viewStart) return;

          const startDayIdx = days.findIndex(d => isSameDay(d, visStart));
          const endDayIdx = days.findIndex(d => isSameDay(d, visEnd));
          if (startDayIdx === -1) return;
          const endIdx = endDayIdx === -1 ? startDayIdx : endDayIdx;

          const startSlotIdx = startDayIdx; // 1 slot par jour
          const slotCount = endIdx - startDayIdx + 1;

          // Calculer les jours ON dans la plage visible
          // Utiliser day_states stockés, sinon fallback weekday=ON / weekend=OFF
          const mDays = eachDayOfInterval({ start: visStart, end: visEnd });
          const onDaySet = new Set();

          // Parser les jours OFF stockés (JSON array de dates 'yyyy-MM-dd')
          let storedOffDays = null;
          const rawDayStates = mission.dayStates || mission.day_states;
          if (rawDayStates) {
            try {
              const parsed = typeof rawDayStates === 'string' ? JSON.parse(rawDayStates) : rawDayStates;
              if (Array.isArray(parsed)) {
                storedOffDays = new Set(parsed);
              }
            } catch { /* ignore */ }
          }

          mDays.forEach(d => {
            const dayKey = format(d, 'yyyy-MM-dd');
            if (storedOffDays) {
              // Utiliser les states stockés : ON sauf si explicitement OFF
              if (!storedOffDays.has(dayKey)) {
                onDaySet.add(dayKey);
              }
            } else {
              // Fallback : jours ouvrés = ON, weekends = OFF
              if (!isWeekendFn(d)) {
                onDaySet.add(dayKey);
              }
            }
          });

          spans[personId].push({
            mission,
            assignment: a,
            startSlotIdx,
            slotCount,
            missionId: mission.id,
            clippedLeft: mStart < viewStart,
            clippedRight: mEnd > viewEnd,
            onDays: onDaySet,
            missionStart: mStart,
            missionEnd: mEnd,
          });
        } catch { /* erreur parsing date */ }
      });
    });
    return spans;
  }, [planningData.missions, days, view]);

  // Index des absences (availabilities) par personne + jour (pour colorer les slots)
  // LEAVE_TYPE_COLORS : couleur de fond des cellules pour chaque type d'absence
  const LEAVE_TYPE_COLORS = {
    unavailable: 'var(--theme-text-muted)',  // gris-bleu
    conge_paye: '#60a5fa',   // bleu
    rtt: '#a78bfa',          // violet
    maladie: '#f87171',      // rouge
    sans_solde: '#fb923c',   // orange
    formation: '#8b5cf6',    // violet foncé
    entreprise: '#3b82f6',   // bleu
    workshop: '#f59e0b',     // ambre
    examen: '#10b981',       // vert
    rdv: '#06b6d4',          // cyan
    repos: '#fbbf24',        // jaune
    autre: 'var(--theme-text-muted)',        // gris
  };
  const LEAVE_TYPE_LABELS = {
    unavailable: 'Indisponible',
    conge_paye: 'CP',
    rtt: 'RTT',
    maladie: 'Maladie',
    sans_solde: 'SS',
    formation: 'Form.',
    entreprise: 'Entr.',
    workshop: 'Work.',
    examen: 'Exam.',
    rdv: 'RDV',
    repos: 'Repos',
    autre: 'Autre',
  };

  // Map : `${personId}_${slotIndex}` → { type, reason, status }
  const absenceSlots = useMemo(() => {
    const map = {};
    if (view === 'year' || days.length === 0) return map;
    const viewStart = days[0];
    const viewEnd = days[days.length - 1];

    (planningData.availabilities || []).forEach(avail => {
      if (avail.status === 'rejected') return; // ignorer les refusées
      try {
        const aStart = parseISO(avail.start_date || avail.startDate);
        const aEnd = parseISO(avail.end_date || avail.endDate);
        if (aStart > viewEnd || aEnd < viewStart) return;

        const personId = avail.person_id || avail.personId;
        const clampedStart = aStart < viewStart ? viewStart : aStart;
        const clampedEnd = aEnd > viewEnd ? viewEnd : aEnd;
        const startIdx = days.findIndex(d => isSameDay(d, clampedStart));
        const endIdx = days.findIndex(d => isSameDay(d, clampedEnd));
        if (startIdx === -1) return;
        const eIdx = endIdx === -1 ? startIdx : endIdx;

        for (let i = startIdx; i <= eIdx; i++) {
          map[`${personId}_${i}`] = {
            type: avail.type || 'unavailable',
            reason: avail.reason,
            status: avail.status || 'approved',
          };
        }
      } catch { /* ignore */ }
    });
    return map;
  }, [planningData.availabilities, days, view]);

  // Set des slots couverts par une mission (pour styling et empêcher clic)
  const coveredSlotsForPerson = useCallback((personId) => {
    const set = new Set();
    (missionSpans[personId] || []).forEach(s => {
      for (let i = s.startSlotIdx; i < s.startSlotIdx + s.slotCount; i++) set.add(i);
    });
    return set;
  }, [missionSpans]);

  // Grid columns CSS
  const gridColumns = useMemo(() => {
    if (view === 'year') return `repeat(12, minmax(120px, 1fr))`;
    const minWidth = view === 'week' ? 120 : 56;
    return `repeat(${days.length}, minmax(${minWidth}px, 1fr))`;
  }, [view, days.length]);

  // Scroll synchronisé
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    const headerScroll = headerScrollRef.current;
    const personCol = personColumnRef.current;
    if (!scrollArea) return;

    const handleScroll = () => {
      if (headerScroll) headerScroll.scrollLeft = scrollArea.scrollLeft;
      if (personCol) personCol.scrollTop = scrollArea.scrollTop;
      // Synchroniser aussi avec le banner Google Calendar
      const bannerScrollArea = document.querySelector('.banner-scroll-area');
      if (bannerScrollArea) bannerScrollArea.scrollLeft = scrollArea.scrollLeft;
    };
    const handlePersonScroll = () => {
      if (scrollArea) scrollArea.scrollTop = personCol.scrollTop;
    };

    scrollArea.addEventListener('scroll', handleScroll, { passive: true });
    if (personCol) personCol.addEventListener('scroll', handlePersonScroll, { passive: true });
    return () => {
      scrollArea.removeEventListener('scroll', handleScroll);
      if (personCol) personCol.removeEventListener('scroll', handlePersonScroll);
    };
  }, []);

  // Déterminer si un jour est aujourd'hui
  const isToday = (day) => isSameDay(day, new Date());

  const activePersons = persons.filter(p => p.isActive !== false);

  // Appliquer recherche et filtre
  const filteredPersons = useMemo(() => {
    return activePersons.filter(p => {
      const matchSearch = !planningSearch || `${p.firstName} ${p.lastName}`.toLowerCase().includes(planningSearch.toLowerCase());
      const matchFilter = !planningFilter || p.type === planningFilter;
      return matchSearch && matchFilter;
    });
  }, [activePersons, planningSearch, planningFilter]);

  const permanents = filteredPersons.filter(p => PERMANENT_TYPES.includes(p.type));
  const nonPermanentsRaw = filteredPersons.filter(p => NON_PERMANENT_TYPES.includes(p.type));

  // Tri : favoris en haut des non-permanents
  const nonPermanents = useMemo(() => {
    if (!sortByFavorites) return nonPermanentsRaw;
    return [...nonPermanentsRaw].sort((a, b) => {
      const aFav = favoriteIds.includes(a.id) ? 0 : 1;
      const bFav = favoriteIds.includes(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
    });
  }, [nonPermanentsRaw, favoriteIds, sortByFavorites]);

  // ═══ DRAG-TO-CREATE : cliquer-glisser sur cellules vides ═══
  const handleSlotMouseDown = (person, slotIndex, e) => {
    if (view === 'year' || e.button !== 0) return;
    const covered = coveredSlotsForPerson(person.id);
    if (covered.has(slotIndex)) return;
    e.preventDefault();
    isDragCreatingRef.current = true;
    wasDraggedRef.current = false;
    lastDragSlotRef.current = slotIndex;
    setDragCreate({ person, startSlotIdx: slotIndex, endSlotIdx: slotIndex });
  };

  const handleSlotMouseEnter = (person, slotIndex) => {
    if (isDragCreatingRef.current && dragCreate && dragCreate.person.id === person.id) {
      if (slotIndex !== dragCreate.startSlotIdx) wasDraggedRef.current = true;
      setDragCreate(prev => ({ ...prev, endSlotIdx: slotIndex }));
    }
    // Activer le drag-to-move seulement quand la souris entre dans un slot différent
    if (pendingBlockDragRef.current && pendingBlockDragRef.current.person.id === person.id && slotIndex !== pendingBlockDragRef.current.slotIndex) {
      const p = pendingBlockDragRef.current;
      isDragMovingRef.current = true;
      wasDraggedRef.current = true;
      const newStartIdx = slotIndex - p.offsetSlots;
      setDragMove({
        span: p.span, person: p.person, offsetSlots: p.offsetSlots,
        originalStartIdx: p.originalStartIdx,
        currentStartIdx: Math.max(0, Math.min(newStartIdx, days.length - p.span.slotCount))
      });
      pendingBlockDragRef.current = null;
    }
    if (isDragMovingRef.current && dragMove && dragMove.person.id === person.id) {
      const newStartIdx = slotIndex - dragMove.offsetSlots;
      if (newStartIdx >= 0 && newStartIdx + dragMove.span.slotCount <= days.length) {
        setDragMove(prev => ({ ...prev, currentStartIdx: newStartIdx }));
      }
    }
    if (isResizingRef.current && resizeState && resizeState.person.id === person.id) {
      if (resizeState.edge === 'end') {
        const newSlotCount = Math.max(1, slotIndex - resizeState.currentStartIdx + 1);
        setResizeState(prev => ({ ...prev, currentSlotCount: newSlotCount }));
      } else {
        const endIdx = resizeState.currentStartIdx + resizeState.currentSlotCount - 1;
        if (slotIndex <= endIdx) {
          setResizeState(prev => ({ ...prev, currentStartIdx: slotIndex, currentSlotCount: endIdx - slotIndex + 1 }));
        }
      }
    }
  };

  const handleGlobalMouseUp = useCallback(() => {
    // Annuler un pending drag (clic simple sur un bloc — le onClick du bloc gèrera l'ouverture)
    if (pendingBlockDragRef.current) {
      pendingBlockDragRef.current = null;
      return;
    }
    // Fin de drag-to-create
    if (isDragCreatingRef.current && dragCreate) {
      isDragCreatingRef.current = false;
      const minIdx = Math.min(dragCreate.startSlotIdx, dragCreate.endSlotIdx);
      const maxIdx = Math.max(dragCreate.startSlotIdx, dragCreate.endSlotIdx);
      const startDay = days[minIdx];
      const endDay = days[maxIdx];
      if (startDay) {
        setAssignmentDialog({ person: dragCreate.person, day: startDay, endDay: endDay || startDay, period: 'AM' });
      }
      setDragCreate(null);
      return;
    }
    // Fin de drag-to-move
    if (isDragMovingRef.current && dragMove) {
      isDragMovingRef.current = false;
      const { span, currentStartIdx, originalStartIdx } = dragMove;
      if (currentStartIdx !== originalStartIdx && days[currentStartIdx]) {
        const delta = currentStartIdx - originalStartIdx;
        const newStart = new Date(span.missionStart);
        newStart.setDate(newStart.getDate() + delta);
        const newEnd = new Date(span.missionEnd);
        newEnd.setDate(newEnd.getDate() + delta);
        api.updateMission(span.mission.id, {
          start_date: format(newStart, 'yyyy-MM-dd'),
          end_date: format(newEnd, 'yyyy-MM-dd'),
        }).then(() => loadPlanning()).catch(err => console.error('Erreur déplacement:', err));
      }
      setDragMove(null);
      return;
    }
    // Fin de resize
    if (isResizingRef.current && resizeState) {
      isResizingRef.current = false;
      const { span, currentStartIdx, currentSlotCount, originalStartIdx, originalSlotCount } = resizeState;
      if (currentStartIdx !== originalStartIdx || currentSlotCount !== originalSlotCount) {
        const deltaStart = currentStartIdx - originalStartIdx;
        const deltaEnd = (currentStartIdx + currentSlotCount) - (originalStartIdx + originalSlotCount);
        const newStart = new Date(span.missionStart);
        newStart.setDate(newStart.getDate() + deltaStart);
        const newEnd = new Date(span.missionEnd);
        newEnd.setDate(newEnd.getDate() + deltaEnd);
        api.updateMission(span.mission.id, {
          start_date: format(newStart, 'yyyy-MM-dd'),
          end_date: format(newEnd, 'yyyy-MM-dd'),
        }).then(() => loadPlanning()).catch(err => console.error('Erreur resize:', err));
      }
      setResizeState(null);
      return;
    }
  }, [dragCreate, dragMove, resizeState, days, loadPlanning]);

  // Écouter mouseup global (au cas où la souris sort du composant)
  useEffect(() => {
    const onUp = () => handleGlobalMouseUp();
    document.addEventListener('mouseup', onUp);
    return () => document.removeEventListener('mouseup', onUp);
  }, [handleGlobalMouseUp]);

  // ═══ DRAG-TO-MOVE : cliquer-maintenir sur un bloc existant ═══
  const handleBlockMouseDown = (e, span, person, slotIndex) => {
    if (view === 'year' || e.button !== 0) return;
    if (e.target.closest('.pp-resize-handle') || e.target.closest('.pp-assignment-delete')) return;
    e.preventDefault();
    e.stopPropagation();
    // Ne pas activer le drag immédiatement — attendre un vrai mouvement
    wasDraggedRef.current = false;
    pendingBlockDragRef.current = {
      span, person, slotIndex,
      offsetSlots: slotIndex - span.startSlotIdx,
      originalStartIdx: span.startSlotIdx
    };
  };

  // ═══ RESIZE HANDLES : modifier début/fin ═══
  const handleResizeStart = (e, span, person, edge) => {
    if (view === 'year' || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    setResizeState({
      span, person, edge,
      originalStartIdx: span.startSlotIdx,
      originalSlotCount: span.slotCount,
      currentStartIdx: span.startSlotIdx,
      currentSlotCount: span.slotCount,
    });
  };

  // Clic simple sur cellule vide (fallback si pas eu de drag)
  const handleSlotClick = (person, day, slotIndex) => {
    if (view === 'year') return;
    if (dragCreate || dragMove || resizeState) return;
    const covered = coveredSlotsForPerson(person.id);
    if (covered.has(slotIndex)) return;
    setAssignmentDialog({ person, day, period: 'AM' });
  };

  // Vérifier si un slot est dans la sélection drag-to-create
  const isInDragSelection = useCallback((personId, slotIndex) => {
    if (!dragCreate || dragCreate.person.id !== personId) return false;
    const minIdx = Math.min(dragCreate.startSlotIdx, dragCreate.endSlotIdx);
    const maxIdx = Math.max(dragCreate.startSlotIdx, dragCreate.endSlotIdx);
    return slotIndex >= minIdx && slotIndex <= maxIdx;
  }, [dragCreate]);

  // Callback après création d'une affectation
  const handleAssignmentCreated = () => {
    loadPlanning();
  };

  // Supprimer une mission
  const handleDeleteMission = async () => {
    if (!deleteMission) return;
    try {
      await api.deleteMission(deleteMission.mission.id);
      setDeleteMission(null);
      loadPlanning();
    } catch (err) {
      console.error('Erreur suppression mission:', err);
      setDeleteMission(null);
    }
  };

  // Obtenir la couleur d'un statut d'affectation
  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return '#10b981';
      case 'option': return '#f59e0b';
      case 'proposed': return 'var(--theme-text-gray)';
      case 'refused': return '#ef4444';
      case 'cancelled': return 'var(--theme-text-muted)';
      default: return '#667eea';
    }
  };

  // Helper pour rendre les lignes d'une personne dans la grille
  const renderPersonRow = (person) => {
    const personSpanList = missionSpans[person.id] || [];
    const covered = coveredSlotsForPerson(person.id);
    const personName = `${person.firstName} ${person.lastName || ''}`;

    // Calcul des positions pour drag-move et resize previews
    const isMoving = dragMove && dragMove.person.id === person.id;
    const isResizing = resizeState && resizeState.person.id === person.id;
    const movingSpanId = isMoving ? dragMove.span.missionId : null;
    const resizingSpanId = isResizing ? resizeState.span.missionId : null;

    return (
      <div key={person.id} className="pp-person-row"
           onMouseUp={handleGlobalMouseUp}
      >
        {timeSlots.map((slot, slotIndex) => {
          const weekend = isWeekendFn(slot.day);
          const today = isToday(slot.day);
          const todayCls = today ? ' today-slot' : '';

          // Chercher si un bloc commence à ce slot (original ou preview)
          let spanHere = personSpanList.find(s => s.startSlotIdx === slotIndex);
          const isCovered = covered.has(slotIndex);
          const isDragSel = isInDragSelection(person.id, slotIndex);

          // Preview drag-move : afficher le bloc à sa nouvelle position
          let movePreviewHere = null;
          if (isMoving && dragMove.currentStartIdx === slotIndex && movingSpanId) {
            movePreviewHere = dragMove.span;
          }
          // Masquer le bloc original en cours de déplacement
          const isOriginalBeingMoved = spanHere && isMoving && spanHere.missionId === movingSpanId;

          // Preview resize : afficher le bloc avec sa nouvelle taille
          let resizePreviewHere = null;
          if (isResizing && resizeState.currentStartIdx === slotIndex && resizingSpanId) {
            resizePreviewHere = { ...resizeState.span, slotCount: resizeState.currentSlotCount };
          }
          const isOriginalBeingResized = spanHere && isResizing && spanHere.missionId === resizingSpanId;

          const missionTitle = spanHere?.mission?.title || '';
          const assignStatus = spanHere?.assignment?.status || '';
          const isHovered = hoveredSlot?.personId === person.id && hoveredSlot?.slotIndex === slotIndex;
          const isColHovered = hoveredSlot?.slotIndex === slotIndex;
          const dayLabel = view === 'year'
            ? format(slot.day, 'MMMM yyyy', { locale: fr })
            : format(slot.day, 'EEEE d MMM', { locale: fr });

          const anyDragActive = isDragCreatingRef.current || isDragMovingRef.current || isResizingRef.current;

          // Absence sur ce slot ?
          const absenceKey = `${person.id}_${slotIndex}`;
          const absence = absenceSlots[absenceKey];
          const hasAbsence = !!absence;
          const absenceColor = hasAbsence ? LEAVE_TYPE_COLORS[absence.type] || 'var(--theme-text-muted)' : null;
          const absenceLabel = hasAbsence ? LEAVE_TYPE_LABELS[absence.type] || '' : '';
          const absenceTooltip = hasAbsence
            ? `${absenceLabel}${absence.reason ? ' — ' + absence.reason : ''}${absence.status === 'pending' ? ' (en attente)' : ''}`
            : '';

          return (
            <div
              key={slotIndex}
              className={`pp-slot${weekend ? ' weekend' : ''}${todayCls}${isCovered && !isOriginalBeingMoved ? ' has-assignment' : ''}${isColHovered ? ' pp-col-hovered' : ''}${isDragSel ? ' pp-drag-selected' : ''}${hasAbsence ? ' pp-slot-absence' : ''}`}
              onMouseDown={(e) => !isCovered && !hasAbsence && handleSlotMouseDown(person, slotIndex, e)}
              onMouseEnter={() => {
                handleSlotMouseEnter(person, slotIndex);
                if (!anyDragActive) setHoveredSlot({ personId: person.id, slotIndex });
              }}
              onMouseLeave={() => { if (!anyDragActive) setHoveredSlot(null); }}
              onMouseUp={handleGlobalMouseUp}
              onClick={(e) => {
                if (isCovered || hasAbsence || wasDraggedRef.current) { wasDraggedRef.current = false; return; }
                e.stopPropagation();
                handleSlotClick(person, slot.day, slotIndex);
              }}
              data-emag-tooltip={isHovered && !anyDragActive ? (hasAbsence ? `${personName} — ${absenceTooltip}` : `${personName} — ${dayLabel}`) : undefined}
              style={{
                cursor: view !== 'year' && !isCovered && !hasAbsence ? 'crosshair' : 'default',
                ...(hasAbsence ? {
                  backgroundColor: absenceColor + (absence.status === 'pending' ? '30' : '40'),
                  backgroundImage: absence.status === 'pending' ? `repeating-linear-gradient(45deg, transparent, transparent 4px, ${absenceColor}20 4px, ${absenceColor}20 8px)` : 'none',
                } : {}),
              }}
            >
              {/* Label absence */}
              {hasAbsence && !isCovered && (
                <span className="pp-absence-label" style={{ color: absenceColor }}>
                  {absenceLabel}
                </span>
              )}
              {/* Bloc original (masqué si en cours de move/resize) */}
              {spanHere && !isOriginalBeingMoved && !isOriginalBeingResized && renderAssignmentBlock(spanHere, person, slotIndex, false)}
              {/* Bloc fantôme (original pendant move/resize) */}
              {spanHere && (isOriginalBeingMoved || isOriginalBeingResized) && renderAssignmentBlock(spanHere, person, slotIndex, true)}
              {/* Preview drag-move */}
              {movePreviewHere && renderPreviewBlock(movePreviewHere, person)}
              {/* Preview resize */}
              {resizePreviewHere && renderPreviewBlock(resizePreviewHere, person)}
            </div>
          );
        })}
      </div>
    );
  };

  // Rendu d'un bloc d'assignation (normal ou fantôme)
  const renderAssignmentBlock = (spanHere, person, slotIndex, isGhost) => {
    const assignStatus = spanHere.assignment?.status || '';
    const missionTitle = spanHere.mission?.title || '';
    return (
      <div
        className={`pp-assignment-block${spanHere.clippedLeft ? ' clipped-left' : ''}${spanHere.clippedRight ? ' clipped-right' : ''}${isGhost ? ' pp-ghost' : ''}`}
        style={{
          backgroundColor: 'transparent',
          '--indicator-color': getStatusColor(assignStatus),
          borderRight: spanHere.clippedRight ? `3px dashed ${getStatusColor(assignStatus)}40` : 'none',
          width: `calc(${spanHere.slotCount * 100}% + ${spanHere.slotCount - 1}px)`,
        }}
        title=""
        onMouseDown={(e) => !isGhost && handleBlockMouseDown(e, spanHere, person, slotIndex)}
        onClick={(e) => {
          if (isGhost) return;
          if (wasDraggedRef.current) { wasDraggedRef.current = false; return; }
          e.stopPropagation();
          setAssignmentDialog({ person, day: days[slotIndex], period: 'AM', editMission: spanHere });
        }}
      >
        <div className="pp-assignment-days">
          {Array.from({ length: spanHere.slotCount }, (_, i) => {
            const dayDate = days[spanHere.startSlotIdx + i];
            if (!dayDate) return null;
            const dayKey = format(dayDate, 'yyyy-MM-dd');
            const isOn = spanHere.onDays.has(dayKey);
            const isWe = isWeekendFn(dayDate);
            return (
              <div
                key={dayKey}
                className={`pp-assignment-day-stripe${isOn ? ' on' : ' off'}${isWe ? ' we' : ''}`}
                style={{
                  width: `${100 / spanHere.slotCount}%`,
                  backgroundColor: isOn ? getStatusColor(assignStatus) + 'C0' : getStatusColor(assignStatus) + '25',
                }}
              />
            );
          })}
        </div>
        <div className="pp-assignment-content">
          <span className="pp-assignment-title">{missionTitle}</span>
          {spanHere.assignment?.position && (() => {
            let posNames = [];
            try {
              const parsed = JSON.parse(spanHere.assignment.position);
              if (Array.isArray(parsed)) posNames = parsed;
              else posNames = [spanHere.assignment.position];
            } catch { posNames = [spanHere.assignment.position]; }
            return posNames.length > 0 ? (
              <span className="pp-assignment-position">{posNames.join(', ')}</span>
            ) : null;
          })()}
        </div>
        {!isGhost && (
          <>
            <button
              className="pp-assignment-delete"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteMission({ mission: spanHere.mission, person });
              }}
              title="Supprimer cette mission"
            >
              <Trash2 size={12} />
            </button>
            {/* Poignées de resize */}
            {view !== 'year' && !spanHere.clippedLeft && (
              <div className="pp-resize-handle pp-resize-handle-start"
                   onMouseDown={(e) => handleResizeStart(e, spanHere, person, 'start')}
                   title="Glisser pour modifier le début" />
            )}
            {view !== 'year' && !spanHere.clippedRight && (
              <div className="pp-resize-handle pp-resize-handle-end"
                   onMouseDown={(e) => handleResizeStart(e, spanHere, person, 'end')}
                   title="Glisser pour modifier la fin" />
            )}
          </>
        )}
      </div>
    );
  };

  // Rendu d'un bloc de preview (drag-move ou resize)
  const renderPreviewBlock = (span, person) => {
    const assignStatus = span.assignment?.status || '';
    const missionTitle = span.mission?.title || '';
    return (
      <div
        className="pp-assignment-block pp-preview"
        style={{
          '--indicator-color': getStatusColor(assignStatus),
          width: `calc(${span.slotCount * 100}% + ${span.slotCount - 1}px)`,
        }}
      >
        <div className="pp-assignment-days">
          {Array.from({ length: span.slotCount }, (_, i) => (
            <div key={i} className="pp-assignment-day-stripe on"
              style={{
                width: `${100 / span.slotCount}%`,
                backgroundColor: getStatusColor(assignStatus) + '80',
              }}
            />
          ))}
        </div>
        <div className="pp-assignment-content">
          <span className="pp-assignment-title">{missionTitle}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="personnel-tab-content planning-full">
      {/* ═══ Toolbar Planning ═══ */}
      <div className="pp-planning-toolbar">
        {/* Navigation de dates */}
        {setView && setCurrentDate && (
          <div className="cal-nav-toolbar pp-nav-toolbar">
            <div className="cal-nav-views">
              <button className={`cal-nav-view-btn ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>Semaine</button>
              <button className={`cal-nav-view-btn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Mois</button>
              <button className={`cal-nav-view-btn ${view === 'year' ? 'active' : ''}`} onClick={() => setView('year')}>Année</button>
            </div>
            <div className="cal-nav-date">
              <button className="cal-nav-btn" onClick={goToPrevious}><ChevronLeft size={18} /></button>
              <button className={`cal-nav-btn cal-nav-today ${ppShowTodayHighlight ? 'highlight' : ''}`} onClick={goToToday}>Aujourd'hui</button>
              <button className="cal-nav-btn" onClick={goToNext}><ChevronRight size={18} /></button>
              <span 
                className="cal-nav-label clickable"
                onClick={() => {
                  if (view === 'month') setShowMonthSelector(true);
                  if (view === 'week') setShowWeekSelector(true);
                  if (view === 'year') setShowYearSelector(true);
                }}
                title={view === 'month' ? 'Sélectionner un mois' : view === 'week' ? 'Sélectionner une semaine' : 'Sélectionner une année'}
              >
                {getDateLabel()}
              </span>
            </div>
          </div>
        )}
        <div className="pp-planning-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Rechercher un personnel..."
            value={planningSearch}
            onChange={e => setPlanningSearch(e.target.value)}
            className="pp-planning-search-input"
          />
          {planningSearch && (
            <button className="pp-planning-search-clear" onClick={() => setPlanningSearch('')}><X size={12} /></button>
          )}
        </div>
        <div className="pp-planning-filters">
          <Filter size={14} />
          <select
            value={planningFilter}
            onChange={e => setPlanningFilter(e.target.value)}
            className="pp-planning-filter-select"
          >
            <option value="">Tous les types</option>
            {PERSON_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <button
          className={`pp-planning-fav-btn${sortByFavorites ? ' active' : ''}`}
          onClick={() => setSortByFavorites(v => !v)}
          title={sortByFavorites ? 'Tri par favoris actif' : 'Activer le tri par favoris'}
        >
          <Star size={14} fill={sortByFavorites ? 'currentColor' : 'none'} />
          Favoris
        </button>
      </div>

      {activePersons.length === 0 ? (
        <div className="personnel-empty">
          <CalendarDays size={48} />
          <p>Ajoutez du personnel pour afficher le planning</p>
          {onPersonCreate && (
            <button className="personnel-add-btn" onClick={onPersonCreate} style={{ marginTop: 12 }}>
              <Plus size={16} /> Ajouter une personne
            </button>
          )}
        </div>
      ) : (
        <div className="pp-planning-with-panel">
          <div className="pp-calendar-container">
          {/* Ligne d'en-têtes */}
          <div className="pp-headers-row">
            <div className="pp-column-header">
              <span>Permanents</span>
              <div className="pp-column-header-actions">
                {pendingLeaveCount > 0 && (
                  <button
                    className="pp-leave-badge-btn"
                    onClick={() => setShowLeaveApproval(true)}
                    title="Demandes de congés en attente"
                  >
                    <Clock size={12} />
                    <span className="pp-leave-badge-count">{pendingLeaveCount}</span>
                  </button>
                )}
                <button
                  className="pp-section-toggle"
                  onClick={() => setCollapsedSections(prev => ({ ...prev, permanents: !prev.permanents }))}
                  title={collapsedSections.permanents ? 'Développer' : 'Rétracter'}
                >
                  {collapsedSections.permanents ? '▼' : '▲'}
                </button>
              </div>
            </div>
            <div className="pp-headers-scroll" ref={headerScrollRef}>
              <div className="pp-headers-grid" style={{ gridTemplateColumns: gridColumns }}>
                {view === 'year' ? (
                  <div className="pp-header">
                    {days.map((monthDate, i) => (
                      <div
                        key={i}
                        className={`pp-header-cell month-header${isSameDay(startOfMonth(new Date()), startOfMonth(monthDate)) ? ' today' : ''}${hoveredSlot?.slotIndex === i ? ' pp-col-hovered' : ''}`}
                      >
                        <div className="pp-month-name">{format(monthDate, 'MMMM', { locale: fr })}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pp-header">
                    {days.map((day, i) => (
                      <div
                        key={i}
                        className={`pp-header-cell day-header${isWeekendFn(day) ? ' weekend' : ''}${isToday(day) ? ' today' : ''}${hoveredSlot?.slotIndex === i ? ' pp-col-hovered' : ''}`}
                      >
                        <div className="pp-day-name">{format(day, 'EEE', { locale: fr })}</div>
                        <div className="pp-day-number">{format(day, 'd MMM', { locale: fr })}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Corps : colonne personnel + grille */}
          <div className="pp-content-row">
            <div className="pp-person-column" ref={personColumnRef}>
              {/* Section Permanents */}
              {!collapsedSections.permanents && permanents.map(person => (
                <div key={person.id} className={`pp-person-cell${hoveredSlot?.personId === person.id ? ' pp-row-hovered' : ''}`}
                  onClick={() => {
                    if (clickTimerRef.current) return;
                    clickTimerRef.current = setTimeout(() => {
                      clickTimerRef.current = null;
                      setSelectedPersonForDetails(person);
                    }, 250);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
                    onPersonEdit && onPersonEdit(person);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, person });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="pp-person-name">{person.firstName} {person.lastName || ''}</span>
                  <span className={`person-type-badge mini type-${person.type}`}>
                    {PERSON_TYPES.find(t => t.value === person.type)?.label || person.type}
                  </span>
                </div>
              ))}

              {/* Section Contractuels — header */}
              {nonPermanents.length > 0 && (
                <div className="pp-section-header">
                  <span>Non-permanents</span>
                  <button
                    className="pp-section-toggle"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, nonPermanents: !prev.nonPermanents }))}
                  >
                    {collapsedSections.nonPermanents ? '▼' : '▲'}
                  </button>
                </div>
              )}
              {!collapsedSections.nonPermanents && nonPermanents.map(person => (
                <div key={person.id} className={`pp-person-cell${hoveredSlot?.personId === person.id ? ' pp-row-hovered' : ''}${favoriteIds.includes(person.id) ? ' pp-person-favorite' : ''}`}
                  onClick={() => {
                    if (clickTimerRef.current) return;
                    clickTimerRef.current = setTimeout(() => {
                      clickTimerRef.current = null;
                      setSelectedPersonForDetails(person);
                    }, 250);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
                    onPersonEdit && onPersonEdit(person);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, person });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <button
                    className={`pp-fav-star${favoriteIds.includes(person.id) ? ' active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(person.id); }}
                    title={favoriteIds.includes(person.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    <Star size={12} fill={favoriteIds.includes(person.id) ? 'currentColor' : 'none'} />
                  </button>
                  <span className="pp-person-name">{person.firstName} {person.lastName || ''}</span>
                  <span className={`person-type-badge mini type-${person.type}`}>
                    {person.type === 'contractuel'
                      ? (CONTRACT_TYPES.find(c => c.value === person.contractType)?.label || 'Contractuel')
                      : (PERSON_TYPES.find(t => t.value === person.type)?.label || person.type)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pp-scroll-area" ref={scrollAreaRef}>
              <div className={`pp-grid ${view}-view${dragCreate ? ' pp-dragging' : ''}${resizeState ? ' pp-resizing' : ''}${dragMove ? ' pp-dragging' : ''}`} style={{ gridTemplateColumns: gridColumns }}>
                {/* Lignes Permanents */}
                {!collapsedSections.permanents && permanents.map(renderPersonRow)}

                {/* Séparateur Contractuels dans la grille */}
                {nonPermanents.length > 0 && (
                  <div className="pp-section-separator" style={{ gridColumn: '1 / -1' }}>
                    <span>Non-permanents</span>
                    <button
                      className="pp-section-toggle"
                      onClick={() => setCollapsedSections(prev => ({ ...prev, nonPermanents: !prev.nonPermanents }))}
                    >
                      {collapsedSections.nonPermanents ? '▼' : '▲'}
                    </button>
                  </div>
                )}

                {/* Lignes Contractuels */}
                {!collapsedSections.nonPermanents && nonPermanents.map(renderPersonRow)}
              </div>
            </div>
          </div>
          </div>
          <PersonnelSlidePanel
            person={selectedPersonForDetails}
            positions={positions}
            skills={skills}
            onClose={() => setSelectedPersonForDetails(null)}
            onEdit={(person) => { setSelectedPersonForDetails(null); onPersonEdit && onPersonEdit(person); }}
            onRequestLeave={(personId) => {
              const p = persons.find(pp => pp.id === personId);
              setShowLeaveModal({ person: p || null });
            }}
          />
        </div>
      )}

      {/* Dialog d'affectation */}
      {assignmentDialog && (
        <AssignmentDialog
          person={assignmentDialog.person}
          day={assignmentDialog.day}
          endDay={assignmentDialog.endDay}
          period={assignmentDialog.period}
          skills={skills}
          positions={positions}
          editMission={assignmentDialog.editMission || null}
          googleEvents={googleEvents}
          onClose={() => setAssignmentDialog(null)}
          onCreated={handleAssignmentCreated}
          onDelete={(mission) => {
            setAssignmentDialog(null);
            setDeleteMission({ mission, person: assignmentDialog.person });
          }}
        />
      )}

      {/* Dialog de confirmation de suppression */}
      {deleteMission && (
        <ConfirmDialog
          message={`Supprimer la mission "${deleteMission.mission.title}" et toutes ses affectations ?`}
          onConfirm={handleDeleteMission}
          onCancel={() => setDeleteMission(null)}
        />
      )}

      {/* Modal de demande de congé — Module Code du travail / IDCC 3252 */}
      {showLeaveModal && (
        <LeaveRequestForm
          person={showLeaveModal.person || null}
          persons={activePersons}
          isAdmin={!!currentUser?.isAdmin}
          currentUser={currentUser}
          onClose={() => setShowLeaveModal(null)}
          onCreated={() => { loadPlanning(); }}
        />
      )}

      {/* Panneau de validation admin des congés */}
      {showLeaveApproval && (
        <LeaveValidationPanel
          onClose={() => setShowLeaveApproval(false)}
          onUpdated={() => loadPlanning()}
        />
      )}

      {/* Panneau historique des congés d'un employé */}
      {showLeaveHistory && (
        <LeaveRequestsPanel
          personId={showLeaveHistory.personId}
          isAdmin={!!currentUser?.isAdmin}
          onClose={() => setShowLeaveHistory(null)}
          onNewRequest={() => {
            const p = persons.find(pp => pp.id === showLeaveHistory.personId);
            setShowLeaveHistory(null);
            setShowLeaveModal({ person: p || null });
          }}
          onRefresh={() => loadPlanning()}
        />
      )}

      {/* Menu contextuel personnel */}
      {contextMenu && (
        <PersonnelContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          person={contextMenu.person}
          onSelect={(type, person) => {
            setContextMenu(null);
            if (type === 'conge_paye') {
              setShowLeaveModal({ person });
            } else {
              setPeriodCalendar({ person, type });
            }
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Modal calendrier de période */}
      {periodCalendar && (
        <PeriodCalendarModal
          person={periodCalendar.person}
          periodType={periodCalendar.type}
          isAdmin={false}
          onClose={() => setPeriodCalendar(null)}
          onCreated={() => loadPlanning()}
        />
      )}

      {/* Sélecteurs de dates */}
      {showMonthSelector && (
        <MonthSelector
          currentDate={currentDate}
          onSelectMonth={(date) => { setCurrentDate(date); setShowMonthSelector(false); }}
          onClose={() => setShowMonthSelector(false)}
        />
      )}
      {showWeekSelector && (
        <WeekSelector
          currentDate={currentDate}
          onSelectWeek={(date) => { setCurrentDate(date); setShowWeekSelector(false); }}
          onClose={() => setShowWeekSelector(false)}
        />
      )}
      {showYearSelector && (
        <YearSelector
          currentDate={currentDate}
          onSelectYear={(date) => { setCurrentDate(date); setShowYearSelector(false); }}
          onClose={() => setShowYearSelector(false)}
        />
      )}
    </div>
  );
};

export default React.memo(PersonnelPanel);
