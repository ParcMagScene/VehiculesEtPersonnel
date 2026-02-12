import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users, Award, CalendarDays, Briefcase,
  Plus, Edit2, Trash2, X, Save, Search,
  ChevronDown, ChevronUp, AlertTriangle,
  Phone, Mail, User, Check,
  Link2,
} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  eachDayOfInterval, eachMonthOfInterval, format, parseISO,
  isSameDay, isWeekend as isWeekendFn,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../utils/api';
import AssignmentDialog from './AssignmentDialog';
import { PersonnelSlidePanel } from './PersonnelDetailPanel';
import './PersonnelPanel.css';

// ═══════════════════════════════════════
// Constantes
// ═══════════════════════════════════════

const PERSON_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'contractuel', label: 'Contractuel' },
];

const CONTRACT_TYPES = [
  { value: 'intermittent', label: 'Intermittent' },
  { value: 'CDD', label: 'CDD' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'prestataire', label: 'Prestataire' },
  { value: 'auto-entrepreneur', label: 'Auto-entrepreneur' },
  { value: 'entreprise', label: 'Entreprise' },
];

const SKILL_CATEGORIES = [
  { value: 'son', label: 'Son', color: '#3b82f6' },
  { value: 'lumière', label: 'Lumière', color: '#eab308' },
  { value: 'vidéo', label: 'Vidéo', color: '#8b5cf6' },
  { value: 'plateau', label: 'Plateau', color: '#ef4444' },
  { value: 'régie', label: 'Régie', color: '#f97316' },
  { value: 'conduite', label: 'Conduite', color: '#06b6d4' },
  { value: 'logistique', label: 'Logistique', color: '#10b981' },
  { value: 'autre', label: 'Autre', color: '#6b7280' },
];

const SKILL_LEVELS = [
  { value: 'débutant', label: 'Débutant' },
  { value: 'intermédiaire', label: 'Intermédiaire' },
  { value: 'confirmé', label: 'Confirmé' },
  { value: 'expert', label: 'Expert' },
];

const POSITION_CATEGORIES = [
  { value: 'direction', label: 'Direction & Coordination', color: '#dc2626' },
  { value: 'son', label: 'Son (Audio)', color: '#3b82f6' },
  { value: 'lumiere', label: 'Lumière', color: '#eab308' },
  { value: 'video', label: 'Vidéo & Média', color: '#8b5cf6' },
  { value: 'plateau', label: 'Plateau, Décors & Machinerie', color: '#ef4444' },
  { value: 'backline', label: 'Backline', color: '#f97316' },
  { value: 'costumes', label: 'Costumes, Maquillage & Habillage', color: '#ec4899' },
  { value: 'electricite', label: 'Électricité & Réseaux', color: '#06b6d4' },
  { value: 'logistique', label: 'Logistique & Transport', color: '#10b981' },
  { value: 'captation', label: 'Audiovisuel & Captation', color: '#6366f1' },
  { value: 'production', label: 'Production & Administration', color: '#78716c' },
  { value: 'autre', label: 'Autre', color: '#6b7280' },
];

const getCategoryColor = (category) => {
  return SKILL_CATEGORIES.find(c => c.value === category)?.color || '#6b7280';
};

// ═══════════════════════════════════════
// Composant principal
// ═══════════════════════════════════════

const PersonnelPanel = ({ currentUser, mode = 'standalone', view, currentDate, googleEvents = [], navigateToPersonId, onNavigateToPersonHandled }) => {
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
      }
      resetEditForm();
    } catch (err) {
      alert('Erreur : ' + (err.message || 'Impossible de sauvegarder'));
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
      console.log('[Personnel] loadData — début du chargement...');
      const [personsData, skillsData, positionsData, usersData] = await Promise.all([
        api.getPersons(),
        api.getSkills(),
        api.getPositions(),
        api.getUsers().catch(() => []),
      ]);
      console.log('[Personnel] personsData:', personsData?.length, 'personnes reçues', personsData);
      console.log('[Personnel] skillsData:', skillsData?.length, 'skills');
      console.log('[Personnel] positionsData:', positionsData?.length, 'positions');
      console.log('[Personnel] usersData:', usersData?.length, 'users');
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
        <PlanningTab persons={persons} skills={skills} positions={positions} view={view} currentDate={currentDate} googleEvents={googleEvents} onPersonEdit={openEditDirect} />
        {editFormVisible && (
          <div className="modal-overlay" onClick={resetEditForm}>
            <div className="personnel-edit-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2><User size={20} /> Modifier la fiche</h2>
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
                    <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
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
                      const catColor = POSITION_CATEGORIES.find(c => c.value === pos.category)?.color || '#6b7280';
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
            currentDate={currentDate}
            googleEvents={googleEvents}
            onPersonEdit={(person) => { setPersonToEdit(person); setSubTab('persons'); }}
          />
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// Onglet PERSONNES
// ═══════════════════════════════════════

const PersonsTab = ({ persons, setPersons, skills, positions = [], users, currentUser, personToEdit, onPersonToEditConsumed }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [expandedPerson, setExpandedPerson] = useState(null);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    type: 'permanent', contractType: '', userId: null,
    status: 'active', notes: '',
    skills: [],
    defaultPositions: [],
  });

  const filteredPersons = persons.filter(p => {
    const matchSearch = `${p.firstName} ${p.lastName} ${p.email || ''}`
      .toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = !filterType || p.type === filterType;
    return matchSearch && matchType;
  });

  const resetForm = () => {
    setForm({
      firstName: '', lastName: '', email: '', phone: '',
      type: 'permanent', contractType: '', userId: null,
      status: 'active', notes: '',
      skills: [],
      defaultPositions: [],
    });
    setEditingPerson(null);
    setShowForm(false);
  };

  const openEdit = (person) => {
    let defaultPos = [];
    try {
      const raw = person.defaultPositions || person.default_positions;
      defaultPos = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
    } catch { /* ignore */ }
    setForm({
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
        level: s.level || 'intermédiaire',
      })),
      defaultPositions: defaultPos,
    });
    setEditingPerson(person);
    setShowForm(true);
  };

  // Ouvrir automatiquement la fiche si une personne est demandée par le parent
  useEffect(() => {
    if (personToEdit) {
      openEdit(personToEdit);
      onPersonToEditConsumed?.();
    }
  }, [personToEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
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
        skills: form.skills.map(s => ({
          skill_id: s.skillId,
          level: s.level,
        })),
      };

      if (editingPerson) {
        const updated = await api.updatePerson(editingPerson.id, payload);
        setPersons(prev => prev.map(p => p.id === editingPerson.id ? updated : p));
      } else {
        const created = await api.createPerson(payload);
        setPersons(prev => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      alert('Erreur : ' + (err.message || 'Impossible de sauvegarder'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette personne ?')) return;
    try {
      await api.deletePerson(id);
      setPersons(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      alert('Erreur : ' + (err.message || 'Impossible de supprimer'));
    }
  };

  const toggleSkill = (skillId) => {
    setForm(prev => {
      const existing = prev.skills.find(s => s.skillId === skillId);
      if (existing) {
        return { ...prev, skills: prev.skills.filter(s => s.skillId !== skillId) };
      }
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
    <div className="personnel-tab-content">
      {/* Barre de recherche + filtres */}
      <div className="personnel-toolbar">
        <div className="personnel-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="personnel-filter"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">Tous les types</option>
          {PERSON_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button className="personnel-add-btn" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="personnel-form-overlay">
          <form className="personnel-form" onSubmit={handleSubmit}>
            <div className="personnel-form-header">
              <h3>{editingPerson ? 'Modifier' : 'Nouvelle personne'}</h3>
              <button type="button" className="close-btn" onClick={resetForm}><X size={18} /></button>
            </div>

            <div className="personnel-form-grid">
              <div className="form-field">
                <label>Prénom *</label>
                <input required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Nom *</label>
                <input required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Téléphone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Catégorie</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, contractType: e.target.value === 'permanent' ? '' : form.contractType })}>
                  {PERSON_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              {form.type === 'contractuel' && (
                <div className="form-field">
                  <label>Type de contrat</label>
                  <select value={form.contractType} onChange={e => setForm({ ...form, contractType: e.target.value })}>
                    <option value="">-- Choisir --</option>
                    {CONTRACT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-field">
                <label>Statut</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>
              <div className="form-field">
                <label><Link2 size={14} /> Compte utilisateur</label>
                <select
                  value={form.userId || ''}
                  onChange={e => setForm({ ...form, userId: e.target.value || null })}
                  className={form.userId ? 'linked' : ''}
                >
                  <option value="">Aucun (non lié)</option>
                  {(users || []).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email || `Utilisateur #${u.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-field full-width">
              <label>Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            {/* Sélecteur de compétences */}
            <div className="form-field full-width">
              <label>Compétences</label>
              <div className="skills-selector">
                {skills.map(skill => {
                  const selected = form.skills.find(s => s.skillId === skill.id);
                  return (
                    <div key={skill.id} className={`skill-chip-select ${selected ? 'selected' : ''}`}>
                      <button
                        type="button"
                        className="skill-toggle"
                        onClick={() => toggleSkill(skill.id)}
                        style={{ '--chip-color': getCategoryColor(skill.category) }}
                      >
                        {selected && <Check size={12} />} {skill.name}
                      </button>
                      {selected && (
                        <select
                          className="skill-level-select"
                          value={selected.level}
                          onChange={e => updateSkillLevel(skill.id, e.target.value)}
                        >
                          {SKILL_LEVELS.map(l => (
                            <option key={l.value} value={l.value}>{l.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sélecteur de postes habituels */}
            <div className="form-field full-width">
              <label>Postes habituels</label>
              <div className="skills-selector">
                {positions.map(pos => {
                  const selected = form.defaultPositions.includes(pos.name);
                  const catColor = POSITION_CATEGORIES.find(c => c.value === pos.category)?.color || '#6b7280';
                  return (
                    <div key={pos.id} className={`skill-chip-select ${selected ? 'selected' : ''}`}>
                      <button
                        type="button"
                        className="skill-toggle"
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            defaultPositions: selected
                              ? prev.defaultPositions.filter(n => n !== pos.name)
                              : [...prev.defaultPositions, pos.name],
                          }));
                        }}
                        style={{ '--chip-color': catColor }}
                      >
                        {selected && <Check size={12} />} {pos.name}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="personnel-form-actions">
              <button type="button" className="cancel-btn" onClick={resetForm}>Annuler</button>
              <button type="submit" className="save-btn"><Save size={16} /> Enregistrer</button>
            </div>
          </form>
        </div>
      )}

      {/* Liste */}
      <div className="personnel-list">
        {filteredPersons.length === 0 ? (
          <div className="personnel-empty">
            <Users size={48} />
            <p>{searchTerm ? 'Aucun résultat' : 'Aucune personne enregistrée'}</p>
          </div>
        ) : (
          filteredPersons.map(person => (
            <div
              key={person.id}
              className={`person-card ${person.status === 'inactive' ? 'inactive' : ''}`}
            >
              <div className="person-card-main" onClick={() => setExpandedPerson(expandedPerson === person.id ? null : person.id)}>
                <div className="person-avatar">
                  <User size={20} />
                </div>
                <div className="person-info">
                  <div className="person-name">
                    {person.firstName} {person.lastName}
                    <span className={`person-type-badge type-${person.type}`}>{person.type === 'permanent' ? 'Permanent' : 'Contractuel'}</span>
                    {person.type === 'contractuel' && person.contractType && (
                      <span className={`person-type-badge contract-type type-${person.contractType}`}>
                        {CONTRACT_TYPES.find(c => c.value === person.contractType)?.label || person.contractType}
                      </span>
                    )}
                    {person.userId && <span className="person-linked-badge" title="Lié à un compte utilisateur"><Link2 size={10} /></span>}
                    {person.status === 'inactive' && <span className="person-status-badge inactive">Inactif</span>}
                  </div>
                  <div className="person-contact">
                    {person.phone && <span><Phone size={12} /> {person.phone}</span>}
                    {person.email && <span><Mail size={12} /> {person.email}</span>}
                  </div>
                  {/* Postes habituels — preview */}
                  {(() => {
                    let postes = [];
                    try {
                      const raw = person.defaultPositions || person.default_positions;
                      postes = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
                    } catch { /* ignore */ }
                    return postes.length > 0 ? (
                      <div className="person-skills-preview">
                        {postes.slice(0, 3).map((name, i) => {
                          const posObj = positions.find(p => p.name === name);
                          const catColor = POSITION_CATEGORIES.find(c => c.value === posObj?.category)?.color || '#6b7280';
                          return (
                            <span key={i} className="skill-chip-mini" style={{ '--chip-color': catColor }}>
                              {name}
                            </span>
                          );
                        })}
                        {postes.length > 3 && <span className="skill-more">+{postes.length - 3}</span>}
                      </div>
                    ) : null;
                  })()}
                  {person.skills && person.skills.length > 0 && (
                    <div className="person-skills-preview">
                      {person.skills.slice(0, 4).map((s, i) => (
                        <span
                          key={i}
                          className="skill-chip-mini"
                          style={{ '--chip-color': getCategoryColor(s.category) }}
                        >
                          {s.name}
                        </span>
                      ))}
                      {person.skills.length > 4 && <span className="skill-more">+{person.skills.length - 4}</span>}
                    </div>
                  )}
                </div>
                <div className="person-actions">
                  <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openEdit(person); }}>
                    <Edit2 size={14} />
                  </button>
                  {currentUser?.isAdmin && (
                    <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); handleDelete(person.id); }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                  {expandedPerson === person.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {expandedPerson === person.id && (
                <div className="person-expanded">
                  {person.userId && (
                    <p className="person-linked-info">
                      <Link2 size={14} /> Lié au compte : <strong>{(users || []).find(u => u.id === person.userId)?.name || `#${person.userId}`}</strong>
                    </p>
                  )}
                  {person.notes && <p className="person-notes">{person.notes}</p>}
                  {/* Postes habituels — sélecteur interactif */}
                  {(() => {
                    let postes = [];
                    try {
                      const raw = person.defaultPositions || person.default_positions;
                      postes = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
                    } catch { /* ignore */ }
                    
                    const togglePosition = async (posName) => {
                      const newPositions = postes.includes(posName)
                        ? postes.filter(n => n !== posName)
                        : [...postes, posName];
                      try {
                        const updated = await api.updatePerson(person.id, {
                          default_positions: JSON.stringify(newPositions),
                        });
                        setPersons(prev => prev.map(p => p.id === person.id ? updated : p));
                      } catch (err) {
                        console.error('Erreur mise à jour postes:', err);
                      }
                    };

                    return (
                      <div className="person-skills-detail">
                        <strong>Postes habituels :</strong>
                        <div className="skills-detail-grid">
                          {positions.filter(p => p.isCommon || postes.includes(p.name)).map(pos => {
                            const selected = postes.includes(pos.name);
                            const catColor = POSITION_CATEGORIES.find(c => c.value === pos.category)?.color || '#6b7280';
                            return (
                              <div
                                key={pos.id}
                                className={`skill-detail-item clickable ${selected ? 'selected' : ''}`}
                                style={{ '--chip-color': catColor }}
                                onClick={() => togglePosition(pos.name)}
                                title={selected ? 'Retirer ce poste' : 'Ajouter ce poste'}
                              >
                                {selected && <Check size={10} />}
                                <span className="skill-name">{pos.name}</span>
                              </div>
                            );
                          })}
                        </div>
                        {positions.filter(p => !p.isCommon && !postes.includes(p.name)).length > 0 && (
                          <details className="person-positions-more">
                            <summary>Voir tous les postes...</summary>
                            <div className="skills-detail-grid">
                              {positions.filter(p => !p.isCommon && !postes.includes(p.name)).map(pos => {
                                const catColor = POSITION_CATEGORIES.find(c => c.value === pos.category)?.color || '#6b7280';
                                return (
                                  <div
                                    key={pos.id}
                                    className="skill-detail-item clickable"
                                    style={{ '--chip-color': catColor }}
                                    onClick={() => togglePosition(pos.name)}
                                    title="Ajouter ce poste"
                                  >
                                    <span className="skill-name">{pos.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })()}
                  {person.skills && person.skills.length > 0 && (
                    <div className="person-skills-detail">
                      <strong>Compétences :</strong>
                      <div className="skills-detail-grid">
                        {person.skills.map((s, i) => (
                          <div key={i} className="skill-detail-item" style={{ '--chip-color': getCategoryColor(s.category) }}>
                            <span className="skill-name">{s.name}</span>
                            <span className="skill-level">{s.level}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// Onglet COMPÉTENCES
// ═══════════════════════════════════════

const SkillsTab = ({ skills, setSkills, currentUser }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'autre', description: '' });

  const groupedSkills = SKILL_CATEGORIES.map(cat => ({
    ...cat,
    skills: skills.filter(s => s.category === cat.value),
  })).filter(g => g.skills.length > 0);

  const resetForm = () => {
    setForm({ name: '', category: 'autre', description: '' });
    setEditingSkill(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSkill) {
        const updated = await api.updateSkill(editingSkill.id, form);
        setSkills(prev => prev.map(s => s.id === editingSkill.id ? updated : s));
      } else {
        const created = await api.createSkill(form);
        setSkills(prev => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      alert('Erreur : ' + (err.message || 'Impossible de sauvegarder'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette compétence ?')) return;
    try {
      await api.deleteSkill(id);
      setSkills(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert('Erreur : ' + (err.message || 'Impossible de supprimer'));
    }
  };

  return (
    <div className="personnel-tab-content">
      {currentUser?.isAdmin && (
        <div className="personnel-toolbar">
          <div style={{ flex: 1 }} />
          <button className="personnel-add-btn" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus size={16} /> Ajouter une compétence
          </button>
        </div>
      )}

      {showForm && currentUser?.isAdmin && (
        <div className="personnel-form-overlay">
          <form className="personnel-form compact" onSubmit={handleSubmit}>
            <div className="personnel-form-header">
              <h3>{editingSkill ? 'Modifier' : 'Nouvelle compétence'}</h3>
              <button type="button" className="close-btn" onClick={resetForm}><X size={18} /></button>
            </div>
            <div className="personnel-form-grid">
              <div className="form-field">
                <label>Nom *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Catégorie</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {SKILL_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-field full-width">
              <label>Description</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="personnel-form-actions">
              <button type="button" className="cancel-btn" onClick={resetForm}>Annuler</button>
              <button type="submit" className="save-btn"><Save size={16} /> Enregistrer</button>
            </div>
          </form>
        </div>
      )}

      <div className="skills-grid">
        {groupedSkills.map(group => (
          <div key={group.value} className="skill-group">
            <h4 className="skill-group-title" style={{ '--group-color': group.color }}>
              <span className="skill-group-dot" style={{ background: group.color }} />
              {group.label} ({group.skills.length})
            </h4>
            <div className="skill-group-items">
              {group.skills.map(skill => (
                <div key={skill.id} className="skill-item" style={{ '--chip-color': group.color }}>
                  <span className="skill-item-name">{skill.name}</span>
                  {skill.description && <span className="skill-item-desc">{skill.description}</span>}
                  {currentUser?.isAdmin && (
                    <div className="skill-item-actions">
                      <button className="icon-btn" onClick={() => { setForm({ name: skill.name, category: skill.category, description: skill.description || '' }); setEditingSkill(skill); setShowForm(true); }}>
                        <Edit2 size={12} />
                      </button>
                      <button className="icon-btn danger" onClick={() => handleDelete(skill.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {groupedSkills.length === 0 && (
          <div className="personnel-empty">
            <Award size={48} />
            <p>Aucune compétence enregistrée</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// Onglet POSTES
// ═══════════════════════════════════════

const PositionsTab = ({ positions, setPositions, currentUser }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'autre', is_common: false });

  const groupedPositions = POSITION_CATEGORIES.map(cat => ({
    ...cat,
    positions: positions.filter(p => p.category === cat.value),
  })).filter(g => g.positions.length > 0);

  const resetForm = () => {
    setForm({ name: '', category: 'autre', is_common: false });
    setEditingPosition(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPosition) {
        const updated = await api.updatePosition(editingPosition.id, form);
        setPositions(prev => prev.map(p => p.id === editingPosition.id ? updated : p));
      } else {
        const created = await api.createPosition(form);
        setPositions(prev => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      alert('Erreur : ' + (err.message || 'Impossible de sauvegarder'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce poste ?')) return;
    try {
      await api.deletePosition(id);
      setPositions(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      alert('Erreur : ' + (err.message || 'Impossible de supprimer'));
    }
  };

  return (
    <div className="personnel-tab-content">
      {currentUser?.isAdmin && (
        <div className="personnel-toolbar">
          <div style={{ flex: 1 }} />
          <button className="personnel-add-btn" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus size={16} /> Ajouter un poste
          </button>
        </div>
      )}

      {showForm && currentUser?.isAdmin && (
        <div className="personnel-form-overlay">
          <form className="personnel-form compact" onSubmit={handleSubmit}>
            <div className="personnel-form-header">
              <h3>{editingPosition ? 'Modifier' : 'Nouveau poste'}</h3>
              <button type="button" className="close-btn" onClick={resetForm}><X size={18} /></button>
            </div>
            <div className="personnel-form-grid">
              <div className="form-field">
                <label>Nom du poste *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Catégorie</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {POSITION_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.is_common}
                  onChange={e => setForm({ ...form, is_common: e.target.checked })}
                />
                Poste couramment occupé (affiché en priorité)
              </label>
            </div>
            <div className="personnel-form-actions">
              <button type="button" className="cancel-btn" onClick={resetForm}>Annuler</button>
              <button type="submit" className="save-btn"><Save size={16} /> Enregistrer</button>
            </div>
          </form>
        </div>
      )}

      <div className="skills-grid">
        {groupedPositions.map(group => (
          <div key={group.value} className="skill-group">
            <h4 className="skill-group-title" style={{ '--group-color': group.color }}>
              <span className="skill-group-dot" style={{ background: group.color }} />
              {group.label} ({group.positions.length})
            </h4>
            <div className="skill-group-items">
              {group.positions.map(pos => (
                <div key={pos.id} className="skill-item" style={{ '--chip-color': group.color }}>
                  <span className="skill-item-name">
                    {pos.name}
                    {pos.isCommon ? ' ⭐' : ''}
                  </span>
                  {currentUser?.isAdmin && (
                    <div className="skill-item-actions">
                      <button className="icon-btn" onClick={() => {
                        setForm({ name: pos.name, category: pos.category, is_common: !!pos.isCommon });
                        setEditingPosition(pos);
                        setShowForm(true);
                      }}>
                        <Edit2 size={12} />
                      </button>
                      <button className="icon-btn danger" onClick={() => handleDelete(pos.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {groupedPositions.length === 0 && (
          <div className="personnel-empty">
            <Briefcase size={48} />
            <p>Aucun poste enregistré</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// Onglet PLANNING
// ═══════════════════════════════════════

const PERMANENT_TYPES = ['permanent'];
const CONTRACTUEL_TYPES = ['contractuel'];

const PlanningTab = ({ persons, skills, positions = [], view = 'week', currentDate = new Date(), googleEvents = [], onPersonEdit }) => {
  const scrollAreaRef = useRef(null);
  const headerScrollRef = useRef(null);
  const personColumnRef = useRef(null);
  const [collapsedSections, setCollapsedSections] = useState({ permanents: false, contractuels: false });
  const [selectedPersonForDetails, setSelectedPersonForDetails] = useState(null);
  const clickTimerRef = useRef(null);

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

  // Planning data state
  const [planningData, setPlanningData] = useState({ missions: [], availabilities: [] });
  const [assignmentDialog, setAssignmentDialog] = useState(null); // { person, day, period, endDay? }
  const [deleteMission, setDeleteMission] = useState(null); // { mission, person }
  const [hoveredSlot, setHoveredSlot] = useState(null); // { personId, slotIndex }

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
  const permanents = activePersons.filter(p => PERMANENT_TYPES.includes(p.type));
  const contractuels = activePersons.filter(p => CONTRACTUEL_TYPES.includes(p.type));

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
      case 'proposed': return '#6b7280';
      case 'refused': return '#ef4444';
      case 'cancelled': return '#9ca3af';
      default: return '#667eea';
    }
  };

  // Helper pour rendre les lignes d'une personne dans la grille
  const renderPersonRow = (person) => {
    const personSpanList = missionSpans[person.id] || [];
    const covered = coveredSlotsForPerson(person.id);
    const personName = `${person.firstName} ${person.lastName?.[0] || ''}.`;

    // Calcul des positions pour drag-move et resize previews
    const isMoving = dragMove && dragMove.person.id === person.id;
    const isResizing = resizeState && resizeState.person.id === person.id;
    const movingSpanId = isMoving ? dragMove.span.missionId : null;
    const resizingSpanId = isResizing ? resizeState.span.missionId : null;

    return (
      <div key={person.id} className={`pp-person-row${hoveredSlot?.personId === person.id ? ' pp-row-hovered' : ''}`}
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

          return (
            <div
              key={slotIndex}
              className={`pp-slot${weekend ? ' weekend' : ''}${todayCls}${isCovered && !isOriginalBeingMoved ? ' has-assignment' : ''}${isColHovered ? ' pp-col-hovered' : ''}${isDragSel ? ' pp-drag-selected' : ''}`}
              onMouseDown={(e) => !isCovered && handleSlotMouseDown(person, slotIndex, e)}
              onMouseEnter={() => {
                handleSlotMouseEnter(person, slotIndex);
                if (!anyDragActive) setHoveredSlot({ personId: person.id, slotIndex });
              }}
              onMouseLeave={() => { if (!anyDragActive) setHoveredSlot(null); }}
              onMouseUp={handleGlobalMouseUp}
              onClick={(e) => {
                if (isCovered || wasDraggedRef.current) { wasDraggedRef.current = false; return; }
                e.stopPropagation();
                handleSlotClick(person, slot.day, slotIndex);
              }}
              data-tooltip={isHovered && !anyDragActive ? `${personName} — ${dayLabel}` : undefined}
              style={{ cursor: view !== 'year' && !isCovered ? 'crosshair' : 'default' }}
            >
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
      {activePersons.length === 0 ? (
        <div className="personnel-empty">
          <CalendarDays size={48} />
          <p>Ajoutez du personnel pour afficher le planning</p>
        </div>
      ) : (
        <div className="pp-planning-with-panel">
          <div className="pp-calendar-container">
          {/* Ligne d'en-têtes */}
          <div className="pp-headers-row">
            <div className="pp-column-header">
              <span>Permanents</span>
              <button
                className="pp-section-toggle"
                onClick={() => setCollapsedSections(prev => ({ ...prev, permanents: !prev.permanents }))}
                title={collapsedSections.permanents ? 'Développer' : 'Rétracter'}
              >
                {collapsedSections.permanents ? '▼' : '▲'}
              </button>
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
                  style={{ cursor: 'pointer' }}
                >                  <span className="pp-person-name">{person.firstName} {person.lastName?.[0] || ''}.</span>
                  <span className={`person-type-badge mini type-permanent`}>Permanent</span>
                </div>
              ))}

              {/* Section Contractuels — header */}
              {contractuels.length > 0 && (
                <div className="pp-section-header">
                  <span>Contractuels</span>
                  <button
                    className="pp-section-toggle"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, contractuels: !prev.contractuels }))}
                  >
                    {collapsedSections.contractuels ? '▼' : '▲'}
                  </button>
                </div>
              )}
              {!collapsedSections.contractuels && contractuels.map(person => (
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
                  style={{ cursor: 'pointer' }}
                >                  <span className="pp-person-name">{person.firstName} {person.lastName?.[0] || ''}.</span>
                  <span className={`person-type-badge mini type-contractuel`}>
                    {CONTRACT_TYPES.find(c => c.value === person.contractType)?.label || 'Contractuel'}
                  </span>
                </div>
              ))}
            </div>

            <div className="pp-scroll-area" ref={scrollAreaRef}>
              <div className={`pp-grid ${view}-view${dragCreate ? ' pp-dragging' : ''}${resizeState ? ' pp-resizing' : ''}${dragMove ? ' pp-dragging' : ''}`} style={{ gridTemplateColumns: gridColumns }}>
                {/* Lignes Permanents */}
                {!collapsedSections.permanents && permanents.map(renderPersonRow)}

                {/* Séparateur Contractuels dans la grille */}
                {contractuels.length > 0 && (
                  <div className="pp-section-separator" style={{ gridColumn: '1 / -1' }}>
                    <span>Contractuels</span>
                    <button
                      className="pp-section-toggle"
                      onClick={() => setCollapsedSections(prev => ({ ...prev, contractuels: !prev.contractuels }))}
                    >
                      {collapsedSections.contractuels ? '▼' : '▲'}
                    </button>
                  </div>
                )}

                {/* Lignes Contractuels */}
                {!collapsedSections.contractuels && contractuels.map(renderPersonRow)}
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
    </div>
  );
};

export default PersonnelPanel;
