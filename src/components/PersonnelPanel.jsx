import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Award, Briefcase, CalendarDays,
  Plus, Edit2, Trash2, X, Save, Search,
  ChevronDown, ChevronUp, AlertTriangle,
  Phone, Mail, User, Filter, Check, Clock, XCircle,
} from 'lucide-react';
import api from '../utils/api';
import './PersonnelPanel.css';

// ═══════════════════════════════════════
// Constantes
// ═══════════════════════════════════════

const PERSON_TYPES = [
  { value: 'salarié', label: 'Salarié' },
  { value: 'technicien', label: 'Technicien' },
  { value: 'conducteur', label: 'Conducteur' },
  { value: 'intermittent', label: 'Intermittent' },
  { value: 'indépendant', label: 'Indépendant' },
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

const MISSION_STATUSES = [
  { value: 'draft', label: 'Brouillon', color: '#9ca3af', icon: Clock },
  { value: 'open', label: 'Ouverte', color: '#3b82f6', icon: Briefcase },
  { value: 'staffed', label: 'Staffée', color: '#10b981', icon: Check },
  { value: 'in_progress', label: 'En cours', color: '#f97316', icon: Clock },
  { value: 'completed', label: 'Terminée', color: '#6b7280', icon: Check },
  { value: 'cancelled', label: 'Annulée', color: '#ef4444', icon: XCircle },
];

const ASSIGNMENT_STATUSES = [
  { value: 'proposed', label: 'Proposée', color: '#9ca3af' },
  { value: 'option', label: 'Option', color: '#eab308' },
  { value: 'confirmed', label: 'Confirmée', color: '#10b981' },
  { value: 'refused', label: 'Refusée', color: '#ef4444' },
  { value: 'cancelled', label: 'Annulée', color: '#6b7280' },
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

const getMissionStatusInfo = (status) => {
  return MISSION_STATUSES.find(s => s.value === status) || MISSION_STATUSES[0];
};

const getAssignmentStatusInfo = (status) => {
  return ASSIGNMENT_STATUSES.find(s => s.value === status) || ASSIGNMENT_STATUSES[0];
};

// ═══════════════════════════════════════
// Composant principal
// ═══════════════════════════════════════

const PersonnelPanel = ({ currentUser }) => {
  const [subTab, setSubTab] = useState('persons');
  const [persons, setPersons] = useState([]);
  const [skills, setSkills] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sous-onglets
  const subTabs = [
    { id: 'persons', label: 'Personnel', icon: Users, color: '#3b82f6' },
    { id: 'skills', label: 'Compétences', icon: Award, color: '#8b5cf6' },
    { id: 'missions', label: 'Missions', icon: Briefcase, color: '#f97316' },
    { id: 'planning', label: 'Planning', icon: CalendarDays, color: '#10b981' },
  ];

  // Chargement initial
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [personsData, skillsData, missionsData] = await Promise.all([
        api.getPersons(),
        api.getSkills(),
        api.getMissions(),
      ]);
      setPersons(personsData || []);
      setSkills(skillsData || []);
      setMissions(missionsData || []);
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

  return (
    <div className="personnel-panel">
      {error && (
        <div className="personnel-error">
          <AlertTriangle size={16} /> {error}
          <button onClick={loadData}>Réessayer</button>
        </div>
      )}

      {/* Sous-onglets */}
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

      {/* Contenu */}
      <div className="personnel-content">
        {subTab === 'persons' && (
          <PersonsTab
            persons={persons}
            setPersons={setPersons}
            skills={skills}
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
        {subTab === 'missions' && (
          <MissionsTab
            missions={missions}
            setMissions={setMissions}
            persons={persons}
            skills={skills}
            currentUser={currentUser}
          />
        )}
        {subTab === 'planning' && (
          <PlanningTab
            persons={persons}
            missions={missions}
            skills={skills}
          />
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// Onglet PERSONNES
// ═══════════════════════════════════════

const PersonsTab = ({ persons, setPersons, skills, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [expandedPerson, setExpandedPerson] = useState(null);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    type: 'technicien', status: 'active', notes: '',
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
      type: 'technicien', status: 'active', notes: '',
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
      type: person.type || 'technicien',
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
                <label>Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {PERSON_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Statut</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
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
                    <span className={`person-type-badge type-${person.type}`}>{person.type}</span>
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
// Onglet MISSIONS
// ═══════════════════════════════════════

const MissionsTab = ({ missions, setMissions, persons, skills, currentUser }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingMission, setEditingMission] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedMission, setExpandedMission] = useState(null);
  const [form, setForm] = useState({
    title: '', clientName: '', locationName: '',
    startDate: '', endDate: '', startTime: '', endTime: '',
    position: '', requiredSkillId: '', status: 'draft', notes: '',
  });

  // Dialogue d'affectation
  const [showAssignDialog, setShowAssignDialog] = useState(null);
  const [assignPersonId, setAssignPersonId] = useState('');

  const filteredMissions = missions.filter(m => {
    return !filterStatus || m.status === filterStatus;
  });

  const resetForm = () => {
    setForm({
      title: '', clientName: '', locationName: '',
      startDate: '', endDate: '', startTime: '', endTime: '',
      position: '', requiredSkillId: '', status: 'draft', notes: '',
    });
    setEditingMission(null);
    setShowForm(false);
  };

  const openEdit = (mission) => {
    setForm({
      title: mission.title || '',
      clientName: mission.clientName || '',
      locationName: mission.locationName || '',
      startDate: mission.startDate || '',
      endDate: mission.endDate || '',
      startTime: mission.startTime || '',
      endTime: mission.endTime || '',
      position: mission.position || '',
      requiredSkillId: mission.requiredSkillId || '',
      status: mission.status || 'draft',
      notes: mission.notes || '',
    });
    setEditingMission(mission);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: form.title,
        client_name: form.clientName || null,
        location_name: form.locationName || null,
        start_date: form.startDate,
        end_date: form.endDate || form.startDate,
        start_time: form.startTime || null,
        end_time: form.endTime || null,
        position: form.position || null,
        required_skill_id: form.requiredSkillId || null,
        status: form.status,
        notes: form.notes || null,
      };

      if (editingMission) {
        const updated = await api.updateMission(editingMission.id, payload);
        setMissions(prev => prev.map(m => m.id === editingMission.id ? updated : m));
      } else {
        const created = await api.createMission(payload);
        setMissions(prev => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      alert('Erreur : ' + (err.message || 'Impossible de sauvegarder'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette mission et toutes ses affectations ?')) return;
    try {
      await api.deleteMission(id);
      setMissions(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      alert('Erreur : ' + (err.message || 'Impossible de supprimer'));
    }
  };

  const handleAssign = async (missionId) => {
    if (!assignPersonId) return;
    try {
      const result = await api.createAssignment({
        mission_id: missionId,
        person_id: parseInt(assignPersonId),
        status: 'proposed',
      });

      // Mettre à jour la mission dans le state
      setMissions(prev => prev.map(m => {
        if (m.id === missionId) {
          return { ...m, assignments: [...(m.assignments || []), result] };
        }
        return m;
      }));

      if (result.warnings?.conflicts) {
        alert('⚠️ Attention : cette personne a un conflit de planning sur cette période !');
      }

      setShowAssignDialog(null);
      setAssignPersonId('');
    } catch (err) {
      alert('Erreur : ' + (err.message || 'Impossible d\'affecter'));
    }
  };

  const handleUpdateAssignmentStatus = async (assignmentId, missionId, newStatus) => {
    try {
      await api.updateAssignment(assignmentId, { status: newStatus });
      // Recharger la mission avec ses affectations
      const updated = await api.getMission(missionId);
      setMissions(prev => prev.map(m => m.id === missionId ? updated : m));
    } catch (err) {
      alert('Erreur : ' + (err.message || 'Impossible de modifier'));
    }
  };

  const handleRemoveAssignment = async (assignmentId, missionId) => {
    try {
      await api.deleteAssignment(assignmentId);
      setMissions(prev => prev.map(m => {
        if (m.id === missionId) {
          return { ...m, assignments: (m.assignments || []).filter(a => a.id !== assignmentId) };
        }
        return m;
      }));
    } catch (err) {
      alert('Erreur : ' + (err.message || 'Impossible de retirer'));
    }
  };

  return (
    <div className="personnel-tab-content">
      <div className="personnel-toolbar">
        <select
          className="personnel-filter"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          {MISSION_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button className="personnel-add-btn" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus size={16} /> Nouvelle mission
        </button>
      </div>

      {/* Formulaire mission */}
      {showForm && (
        <div className="personnel-form-overlay">
          <form className="personnel-form" onSubmit={handleSubmit}>
            <div className="personnel-form-header">
              <h3>{editingMission ? 'Modifier la mission' : 'Nouvelle mission'}</h3>
              <button type="button" className="close-btn" onClick={resetForm}><X size={18} /></button>
            </div>
            <div className="personnel-form-grid">
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <label>Titre *</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Client</label>
                <input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Lieu</label>
                <input value={form.locationName} onChange={e => setForm({ ...form, locationName: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Date début *</label>
                <input type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Date fin</label>
                <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Heure début</label>
                <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Heure fin</label>
                <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Poste</label>
                <input value={form.position} placeholder="Ex: Ingénieur son" onChange={e => setForm({ ...form, position: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Compétence requise</label>
                <select value={form.requiredSkillId} onChange={e => setForm({ ...form, requiredSkillId: e.target.value })}>
                  <option value="">Aucune</option>
                  {skills.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Statut</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {MISSION_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-field full-width">
              <label>Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="personnel-form-actions">
              <button type="button" className="cancel-btn" onClick={resetForm}>Annuler</button>
              <button type="submit" className="save-btn"><Save size={16} /> Enregistrer</button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des missions */}
      <div className="missions-list">
        {filteredMissions.length === 0 ? (
          <div className="personnel-empty">
            <Briefcase size={48} />
            <p>{filterStatus ? 'Aucune mission avec ce statut' : 'Aucune mission créée'}</p>
          </div>
        ) : (
          filteredMissions.map(mission => {
            const statusInfo = getMissionStatusInfo(mission.status);
            const assignments = mission.assignments || [];
            const isExpanded = expandedMission === mission.id;
            
            return (
              <div key={mission.id} className="mission-card">
                <div className="mission-card-main" onClick={() => setExpandedMission(isExpanded ? null : mission.id)}>
                  <div className="mission-status-dot" style={{ background: statusInfo.color }} title={statusInfo.label} />
                  <div className="mission-info">
                    <div className="mission-title">{mission.title}</div>
                    <div className="mission-meta">
                      {mission.clientName && <span>{mission.clientName}</span>}
                      {mission.locationName && <span>📍 {mission.locationName}</span>}
                      <span>📅 {mission.startDate}{mission.endDate && mission.endDate !== mission.startDate ? ` → ${mission.endDate}` : ''}</span>
                      {mission.startTime && <span>🕐 {mission.startTime}{mission.endTime ? ` - ${mission.endTime}` : ''}</span>}
                    </div>
                    <div className="mission-assignments-preview">
                      <Users size={14} /> {assignments.length} affecté{assignments.length !== 1 ? 's' : ''}
                      {assignments.filter(a => a.status === 'confirmed').length > 0 && (
                        <span className="confirmed-count">
                          ({assignments.filter(a => a.status === 'confirmed').length} confirmé{assignments.filter(a => a.status === 'confirmed').length !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mission-actions">
                    <button className="icon-btn" onClick={e => { e.stopPropagation(); openEdit(mission); }}>
                      <Edit2 size={14} />
                    </button>
                    {currentUser?.isAdmin && (
                      <button className="icon-btn danger" onClick={e => { e.stopPropagation(); handleDelete(mission.id); }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mission-expanded">
                    {mission.position && <p><strong>Poste :</strong> {mission.position}</p>}
                    {mission.notes && <p className="mission-notes">{mission.notes}</p>}

                    <div className="mission-assignments-section">
                      <div className="assignment-header">
                        <strong>Affectations</strong>
                        <button className="personnel-add-btn small" onClick={() => { setShowAssignDialog(mission.id); setAssignPersonId(''); }}>
                          <Plus size={14} /> Affecter
                        </button>
                      </div>

                      {/* Dialog d'affectation */}
                      {showAssignDialog === mission.id && (
                        <div className="assign-dialog">
                          <select value={assignPersonId} onChange={e => setAssignPersonId(e.target.value)}>
                            <option value="">Choisir une personne...</option>
                            {persons
                              .filter(p => p.status === 'active' && !assignments.find(a => a.personId === p.id))
                              .map(p => (
                                <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.type})</option>
                              ))}
                          </select>
                          <button className="save-btn small" onClick={() => handleAssign(mission.id)} disabled={!assignPersonId}>
                            <Check size={14} /> Affecter
                          </button>
                          <button className="cancel-btn small" onClick={() => setShowAssignDialog(null)}>
                            <X size={14} />
                          </button>
                        </div>
                      )}

                      {assignments.length === 0 ? (
                        <p className="no-assignments">Aucune affectation</p>
                      ) : (
                        <div className="assignments-list">
                          {assignments.map(a => {
                            const aStatus = getAssignmentStatusInfo(a.status);
                            return (
                              <div key={a.id} className="assignment-item">
                                <div className="assignment-person">
                                  <User size={14} />
                                  <span>{a.firstName} {a.lastName}</span>
                                  {a.position && <span className="assignment-position">{a.position}</span>}
                                </div>
                                <div className="assignment-status-actions">
                                  <select
                                    className="assignment-status-select"
                                    value={a.status}
                                    style={{ color: aStatus.color, borderColor: aStatus.color }}
                                    onChange={e => handleUpdateAssignmentStatus(a.id, mission.id, e.target.value)}
                                  >
                                    {ASSIGNMENT_STATUSES.map(s => (
                                      <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                  </select>
                                  <button className="icon-btn danger small" onClick={() => handleRemoveAssignment(a.id, mission.id)}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// Onglet PLANNING
// ═══════════════════════════════════════

const PlanningTab = ({ persons, missions, skills }) => {
  const [viewRange, setViewRange] = useState(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay() + 1); // Lundi
    const end = new Date(start);
    end.setDate(end.getDate() + 13); // 2 semaines
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  // Générer les jours de la plage
  const getDays = () => {
    const days = [];
    const current = new Date(viewRange.start);
    const end = new Date(viewRange.end);
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const days = getDays();

  // Trouver les missions d'une personne pour un jour donné
  const getPersonMissions = (personId, dayStr) => {
    return missions.filter(m => {
      const hasAssignment = (m.assignments || []).some(a =>
        a.personId === personId && ['proposed', 'option', 'confirmed'].includes(a.status)
      );
      return hasAssignment && m.startDate <= dayStr && m.endDate >= dayStr;
    });
  };

  const formatDay = (date) => {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return `${days[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
  };

  const shiftRange = (direction) => {
    const days = direction * 7;
    const start = new Date(viewRange.start);
    const end = new Date(viewRange.end);
    start.setDate(start.getDate() + days);
    end.setDate(end.getDate() + days);
    setViewRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  };

  const activePersons = persons.filter(p => p.status === 'active');

  return (
    <div className="personnel-tab-content">
      <div className="planning-toolbar">
        <button className="planning-nav-btn" onClick={() => shiftRange(-1)}>◀ Semaine préc.</button>
        <span className="planning-range">
          {new Date(viewRange.start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          {' — '}
          {new Date(viewRange.end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <button className="planning-nav-btn" onClick={() => shiftRange(1)}>Semaine suiv. ▶</button>
      </div>

      {activePersons.length === 0 ? (
        <div className="personnel-empty">
          <CalendarDays size={48} />
          <p>Ajoutez du personnel pour afficher le planning</p>
        </div>
      ) : (
        <div className="planning-grid-wrapper">
          <div className="planning-grid" style={{ gridTemplateColumns: `180px repeat(${days.length}, 1fr)` }}>
            {/* Header */}
            <div className="planning-cell header corner">Personnel</div>
            {days.map((day, i) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isToday = day.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
              return (
                <div key={i} className={`planning-cell header ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}`}>
                  {formatDay(day)}
                </div>
              );
            })}

            {/* Lignes par personne */}
            {activePersons.map(person => (
              <React.Fragment key={person.id}>
                <div className="planning-cell person-label">
                  <span className="planning-person-name">{person.firstName} {person.lastName?.[0]}.</span>
                  <span className={`person-type-badge mini type-${person.type}`}>{person.type}</span>
                </div>
                {days.map((day, di) => {
                  const dayStr = day.toISOString().split('T')[0];
                  const dayMissions = getPersonMissions(person.id, dayStr);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday = dayStr === new Date().toISOString().split('T')[0];

                  return (
                    <div
                      key={di}
                      className={`planning-cell ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''} ${dayMissions.length > 0 ? 'has-mission' : ''}`}
                      title={dayMissions.map(m => m.title).join(', ')}
                    >
                      {dayMissions.map((m, mi) => {
                        const statusInfo = getMissionStatusInfo(m.status);
                        const assignment = (m.assignments || []).find(a => a.personId === person.id);
                        const aStatus = assignment ? getAssignmentStatusInfo(assignment.status) : null;
                        return (
                          <div
                            key={mi}
                            className="planning-mission-chip"
                            style={{ '--mission-color': aStatus?.color || statusInfo.color }}
                            title={`${m.title} (${statusInfo.label}) - ${aStatus?.label || ''}`}
                          >
                            <span className="planning-mission-title">{m.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelPanel;
