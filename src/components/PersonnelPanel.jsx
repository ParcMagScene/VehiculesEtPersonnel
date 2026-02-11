import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users, Award, CalendarDays,
  Plus, Edit2, Trash2, X, Save, Search,
  ChevronDown, ChevronUp, AlertTriangle,
  Phone, Mail, User, Check,
  Link2,
} from 'lucide-react';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  eachDayOfInterval, eachMonthOfInterval, format,
  isSameDay, isWeekend as isWeekendFn,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../utils/api';
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
  { value: 'freelance', label: 'Freelance' },
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

const getCategoryColor = (category) => {
  return SKILL_CATEGORIES.find(c => c.value === category)?.color || '#6b7280';
};

// ═══════════════════════════════════════
// Composant principal
// ═══════════════════════════════════════

const PersonnelPanel = ({ currentUser, mode = 'standalone', view, currentDate }) => {
  const [subTab, setSubTab] = useState(mode === 'planning' ? 'planning' : 'persons');
  const [persons, setPersons] = useState([]);
  const [skills, setSkills] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sous-onglets (filtrés selon le mode)
  const allSubTabs = [
    { id: 'persons', label: 'Personnel', icon: Users, color: '#3b82f6' },
    { id: 'skills', label: 'Compétences', icon: Award, color: '#8b5cf6' },
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
      const [personsData, skillsData, usersData] = await Promise.all([
        api.getPersons(),
        api.getSkills(),
        api.getUsers().catch(() => []),
      ]);
      setPersons(personsData || []);
      setSkills(skillsData || []);
      setUsers(usersData || []);
      setError(null);
    } catch (err) {
      console.error('Erreur chargement données personnel:', err);
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
        <PlanningTab persons={persons} skills={skills} view={view} currentDate={currentDate} />
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
            users={users}
            currentUser={currentUser}
          />
        )}
        {subTab === 'skills' && (
          <SkillsTab
            skills={skills}
            setSkills={setSkills}
            currentUser={currentUser}
          />
        )}
        {subTab === 'planning' && (
          <PlanningTab
            persons={persons}
            skills={skills}
            view={view}
            currentDate={currentDate}
          />
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// Onglet PERSONNES
// ═══════════════════════════════════════

const PersonsTab = ({ persons, setPersons, skills, users, currentUser }) => {
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
    });
    setEditingPerson(null);
    setShowForm(false);
  };

  const openEdit = (person) => {
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
    });
    setEditingPerson(person);
    setShowForm(true);
  };

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
// Onglet PLANNING
// ═══════════════════════════════════════

const PERMANENT_TYPES = ['permanent'];
const CONTRACTUEL_TYPES = ['contractuel'];

const PlanningTab = ({ persons, skills, view = 'week', currentDate = new Date() }) => {
  const scrollAreaRef = useRef(null);
  const headerScrollRef = useRef(null);
  const personColumnRef = useRef(null);
  const [collapsedSections, setCollapsedSections] = useState({ permanents: false, contractuels: false });

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

  // Demi-journées (AM/PM) sauf en vue année
  const periods = ['AM', 'PM'];
  const timeSlots = useMemo(() => {
    const slots = [];
    if (view === 'year') {
      days.forEach(monthDate => slots.push({ day: monthDate, period: 'M' }));
    } else {
      days.forEach(day => {
        periods.forEach(period => slots.push({ day, period }));
      });
    }
    return slots;
  }, [days, view]);

  // Grid columns CSS
  const gridColumns = useMemo(() => {
    if (view === 'year') return `repeat(12, minmax(120px, 1fr))`;
    const minWidth = view === 'week' ? 80 : 44;
    return `repeat(${days.length * 2}, minmax(${minWidth}px, 1fr))`;
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

  // Helper pour rendre les lignes d'une personne dans la grille
  const renderPersonRow = (person) => {
    return (
      <div key={person.id} className="pp-person-row">
        {timeSlots.map((slot, slotIndex) => {
          const weekend = isWeekendFn(slot.day);
          const today = isToday(slot.day);
          const todayCls = today ? ` today-slot${slot.period === 'AM' ? ' today-left' : slot.period === 'PM' ? ' today-right' : ''}` : '';
          return (
            <div
              key={slotIndex}
              className={`pp-slot${weekend ? ' weekend' : ''}${todayCls}${slot.period === 'AM' ? ' period-am' : slot.period === 'PM' ? ' period-pm' : ''}`}
            />
          );
        })}
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
                        className={`pp-header-cell month-header${isSameDay(startOfMonth(new Date()), startOfMonth(monthDate)) ? ' today' : ''}`}
                      >
                        <div className="pp-month-name">{format(monthDate, 'MMMM', { locale: fr })}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="pp-header">
                      {days.map((day, i) => (
                        <div
                          key={i}
                          className={`pp-header-cell day-header${isWeekendFn(day) ? ' weekend' : ''}${isToday(day) ? ' today' : ''}`}
                          style={{ gridColumn: 'span 2' }}
                        >
                          <div className="pp-day-name">{format(day, 'EEE', { locale: fr })}</div>
                          <div className="pp-day-number">{format(day, 'd MMM', { locale: fr })}</div>
                        </div>
                      ))}
                    </div>
                    <div className="pp-subheader">
                      {days.map((day, i) => (
                        <React.Fragment key={i}>
                          <div className={`pp-header-cell period-cell${isWeekendFn(day) ? ' weekend' : ''}${isToday(day) ? ' today' : ''}`}>AM</div>
                          <div className={`pp-header-cell period-cell${isWeekendFn(day) ? ' weekend' : ''}${isToday(day) ? ' today' : ''}`}>PM</div>
                        </React.Fragment>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Corps : colonne personnel + grille */}
          <div className="pp-content-row">
            <div className="pp-person-column" ref={personColumnRef}>
              {/* Section Permanents */}
              {!collapsedSections.permanents && permanents.map(person => (
                <div key={person.id} className="pp-person-cell">
                  <span className="pp-person-name">{person.firstName} {person.lastName?.[0] || ''}.</span>
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
                <div key={person.id} className="pp-person-cell">
                  <span className="pp-person-name">{person.firstName} {person.lastName?.[0] || ''}.</span>
                  <span className={`person-type-badge mini type-contractuel`}>
                    {CONTRACT_TYPES.find(c => c.value === person.contractType)?.label || 'Contractuel'}
                  </span>
                </div>
              ))}
            </div>

            <div className="pp-scroll-area" ref={scrollAreaRef}>
              <div className={`pp-grid ${view}-view`} style={{ gridTemplateColumns: gridColumns }}>
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
      )}
    </div>
  );
};

export default PersonnelPanel;
