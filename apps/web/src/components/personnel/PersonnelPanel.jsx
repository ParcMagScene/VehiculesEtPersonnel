import './PersonnelPanel.css';
import '../equipment/EquipmentPanel.css';
import '../vehicles/Calendar.css';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  Award,
  Briefcase,
  CalendarDays,
  CalendarOff,
  Check,
  CheckCircle,
  Clock,
  Edit2,
  Plus,
  Save,
  Star,
  Trash2,
  Upload,
  User,
  Users,
} from 'lucide-react';
import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TableVirtuoso } from 'react-virtuoso';

import {
  Avatar,
  Button,
  EmptyState,
  FormField,
  InlineAlert,
  Input,
  ModalLayout,
  SearchBar,
  Select,
  Spinner,
  Textarea,
  Tooltip,
} from '@/design-system';

import { STATUS } from '../../constants';
import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import usePersonnelFavorites from '../../hooks/usePersonnelFavorites';
import { useToast } from '../../hooks/useToast';
import useWindowWidth from '../../hooks/useWindowWidth';
import api from '../../utils/api';
import { computeGridColumnsCss } from '../../utils/planningGridColumns';
import { refreshBus } from '../../utils/refresh-bus';
import LeaveRequestForm from '../leaves/LeaveRequestForm';
import LeaveRequestsPanel from '../leaves/LeaveRequestsPanel';
import LeavesTab from '../leaves/LeavesTab';
import LeaveValidationPanel from '../leaves/LeaveValidationPanel';
import MonthSelector from '../MonthSelector';
import PhoneInput, { formatPhoneDisplay } from '../PhoneInput';
import PeriodCalendarModal from '../planning/PeriodCalendarModal';
import WeekSelector from '../WeekSelector';
import YearSelector from '../YearSelector';
import AssignmentDialog from './AssignmentDialog';
import { PlanningTab } from './PersonnelPlanningView';
import PersonnelAgenda from './PersonnelAgenda';
import {
  CONTRACT_TYPES,
  getCategoryColor,
  NON_PERMANENT_TYPES,
  PERMANENT_TYPES,
  PERSON_TYPES,
  POSITION_CATEGORIES,
  SKILL_LEVELS,
} from './personnelConstants';
import PersonnelContextMenu from './PersonnelContextMenu';
import { PersonnelSlidePanel } from './PersonnelDetailPanel';
import PersonnelFormModal from './PersonnelFormModal';
import PersonnelImportModal from './PersonnelImportModal';
import PositionsTab from './PositionsTab';
import SkillsTab from './SkillsTab';

// ═══════════════════════════════════════
// Composants TableVirtuoso pour la liste personnel
// Définis au module-level pour éviter remounts à chaque render.
// `context` est utilisé pour transmettre selectedId + handlers aux rows.
// ═══════════════════════════════════════
const PpVirtuosoScroller = forwardRef(function PpVirtuosoScroller(props, ref) {
  return <div {...props} ref={ref} />;
});
const PpVirtuosoTable = (props) => <table {...props} className="eq-table pp-table" />;
const PpVirtuosoTableHead = forwardRef(function PpVirtuosoTableHead(props, ref) {
  return <thead {...props} ref={ref} />;
});
const PpVirtuosoTableBody = forwardRef(function PpVirtuosoTableBody(props, ref) {
  return <tbody {...props} ref={ref} />;
});
const PpVirtuosoTableRow = ({ item, context, ...rest }) => {
  if (item?.__group) {
    return <tr {...rest} className="pp-group-header" />;
  }
  const selectedId = context?.selectedId;
  const inactive = item?.status === STATUS.INACTIVE;
  return (
    <tr
      {...rest}
      className={`eq-table-row${selectedId === item?.id ? ' selected' : ''}${inactive ? ' pp-row-inactive' : ''}`}
      onClick={() => item && context?.onSelect?.(item)}
      onDoubleClick={() => item && context?.onEdit?.(item)}
    />
  );
};
const PP_TABLE_COMPONENTS = {
  Scroller: PpVirtuosoScroller,
  Table: PpVirtuosoTable,
  TableHead: PpVirtuosoTableHead,
  TableBody: PpVirtuosoTableBody,
  TableRow: PpVirtuosoTableRow,
};

// ═══════════════════════════════════════
// Composant principal
// ═══════════════════════════════════════

const PersonnelPanel = ({
  currentUser,
  mode = 'standalone',
  view,
  setView,
  currentDate,
  setCurrentDate,
  googleEvents = [],
  navigateToPersonId,
  onNavigateToPersonHandled,
  quickAssignmentSlot,
  onQuickAssignmentHandled,
  onOpenSuivi,
  googleBanner = null,
}) => {
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
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    type: 'permanent',
    contractType: '',
    userId: null,
    status: STATUS.ACTIVE,
    notes: '',
    skills: [],
    defaultPositions: [],
    showInPlanning: true,
  });

  const openEditDirect = (person) => {
    let defaultPos = [];
    try {
      const raw = person.defaultPositions || person.default_positions;
      defaultPos = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
    } catch {
      /* ignore */
    }
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
      showInPlanning: person.show_in_planning !== 0 && person.showInPlanning !== false,
      skills: (person.skills || []).map((s) => ({
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
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      type: 'permanent',
      contractType: '',
      userId: null,
      status: STATUS.ACTIVE,
      notes: '',
      skills: [],
      defaultPositions: [],
      showInPlanning: true,
    });
    setEditingPersonDirect(null);
    setEditFormVisible(false);
  };

  // Ouvrir le modal en mode création (formulaire vide)
  const openCreateDirect = () => {
    setEditForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      type: 'permanent',
      contractType: '',
      userId: null,
      status: STATUS.ACTIVE,
      notes: '',
      skills: [],
      defaultPositions: [],
      showInPlanning: true,
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
        contract_type:
          editForm.type === 'contractuel' ? editForm.contractType || 'intermittent' : null,
        user_id: editForm.userId ? Number(editForm.userId) : null,
        status: editForm.status,
        notes: editForm.notes || null,
        default_positions: JSON.stringify(editForm.defaultPositions || []),
        show_in_planning: editForm.showInPlanning ? 1 : 0,
        skills: editForm.skills.map((s) => ({
          skill_id: s.skillId,
          level: s.level,
        })),
      };
      if (editingPersonDirect) {
        const updated = await api.updatePerson(editingPersonDirect.id, payload);
        setPersons((prev) => prev.map((p) => (p.id === editingPersonDirect.id ? updated : p)));
      } else {
        const created = await api.createPerson(payload);
        setPersons((prev) => [...prev, created]);
      }
      refreshBus.publish('persons');
      resetEditForm();
    } catch (err) {
      toast.error('Erreur : ' + (err.message || 'Impossible de sauvegarder'));
    }
  };

  const toggleEditSkill = (skillId) => {
    setEditForm((prev) => {
      const existing = prev.skills.find((s) => s.skillId === skillId);
      if (existing) return { ...prev, skills: prev.skills.filter((s) => s.skillId !== skillId) };
      return { ...prev, skills: [...prev.skills, { skillId, level: 'interm\u00e9diaire' }] };
    });
  };

  const updateEditSkillLevel = (skillId, level) => {
    setEditForm((prev) => ({
      ...prev,
      skills: prev.skills.map((s) => (s.skillId === skillId ? { ...s, level } : s)),
    }));
  };

  // Sous-onglets (filtrés selon le mode)
  const allSubTabs = [
    { id: 'persons', label: 'Personnel', icon: Users, color: STATUS_COLORS.info },
    { id: 'skills', label: 'Compétences', icon: Award, color: ACCENT_COLORS.violet },
    { id: 'positions', label: 'Postes', icon: Briefcase, color: ACCENT_COLORS.orange },
    { id: 'planning', label: 'Planning', icon: CalendarDays, color: STATUS_COLORS.success },
    { id: 'agenda', label: 'Agenda', icon: Clock, color: ACCENT_COLORS.cyan },
    { id: 'leaves', label: 'Congés', icon: CalendarOff, color: STATUS_COLORS.danger },
  ];
  const subTabs =
    mode === 'management'
      ? allSubTabs.filter((t) => t.id !== 'planning')
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
  }, [setPersons, setSkills, setPositions, setUsers, setError, setLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="personnel-panel">
        <div className="personnel-loading">
          <Spinner size="lg" />
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
          <InlineAlert
            action={
              <Button variant="ghost" onClick={loadData}>
                Réessayer
              </Button>
            }
          >
            {error}
          </InlineAlert>
        )}
        <PlanningTab
          persons={persons}
          skills={skills}
          positions={positions}
          view={view}
          setView={setView}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          googleEvents={googleEvents}
          onPersonEdit={openEditDirect}
          onPersonCreate={openCreateDirect}
          navigateToPersonId={navigateToPersonId}
          onNavigateToPersonHandled={onNavigateToPersonHandled}
          quickAssignmentSlot={quickAssignmentSlot}
          onQuickAssignmentHandled={onQuickAssignmentHandled}
          currentUser={currentUser}
          onOpenSuivi={onOpenSuivi}
          googleBanner={googleBanner}
        />
        {editFormVisible && (
          <ModalLayout
            open
            onClose={resetEditForm}
            title={
              <>
                <User size={20} /> {editingPersonDirect ? 'Modifier la fiche' : 'Nouvelle personne'}
              </>
            }
            size="lg"
            className="personnel-edit-modal"
            footer={
              <>
                <div />
                <div className="right-actions">
                  <Button variant="ghost" onClick={resetEditForm}>
                    Annuler
                  </Button>
                  <Button variant="primary" type="submit" form="personnel-edit-form">
                    <Save size={18} /> Enregistrer
                  </Button>
                </div>
              </>
            }
          >
            <form
              id="personnel-edit-form"
              className="personnel-edit-form-body"
              onSubmit={handleEditSubmit}
            >
              <div className="form-row">
                <FormField className="form-group" label="Prénom" required>
                  <Input
                    required
                    maxLength={100}
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  />
                </FormField>
                <FormField className="form-group" label="Nom" required>
                  <Input
                    required
                    maxLength={100}
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  />
                </FormField>
              </div>
              <div className="form-row">
                <FormField className="form-group" label="Email">
                  <Input
                    type="email"
                    maxLength={254}
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </FormField>
                <FormField className="form-group" label="Téléphone">
                  <PhoneInput
                    value={editForm.phone}
                    onChange={(val) => setEditForm({ ...editForm, phone: val })}
                  />
                </FormField>
              </div>
              <div className="form-row">
                <FormField className="form-group" label="Catégorie">
                  <Select
                    value={editForm.type}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        type: e.target.value,
                        contractType: e.target.value === 'permanent' ? '' : editForm.contractType,
                      })
                    }
                  >
                    {PERSON_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                {editForm.type === 'contractuel' ? (
                  <FormField className="form-group" label="Type de contrat">
                    <Select
                      value={editForm.contractType}
                      onChange={(e) => setEditForm({ ...editForm, contractType: e.target.value })}
                    >
                      <option value="">-- Choisir --</option>
                      {CONTRACT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                ) : (
                  <FormField className="form-group" label="Statut">
                    <Select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    >
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                    </Select>
                  </FormField>
                )}
              </div>
              {editForm.type === 'contractuel' && (
                <FormField className="form-group" label="Statut">
                  <Select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                  </Select>
                </FormField>
              )}
              <FormField className="form-group" label="Notes">
                <Textarea
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </FormField>
              {['permanent', 'apprenti', 'stagiaire'].includes(editForm.type) && (
                <FormField className="form-group" label="Affichage dans planning">
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  >
                    <Input
                      type="checkbox"
                      checked={!!editForm.showInPlanning}
                      onChange={(e) =>
                        setEditForm({ ...editForm, showInPlanning: e.target.checked })
                      }
                    />
                    Visible dans la liste du planning
                  </label>
                </FormField>
              )}
              <FormField className="form-group" label="Compétences">
                <div className="skills-selector">
                  {skills.map((skill) => {
                    const selected = editForm.skills.find((s) => s.skillId === skill.id);
                    return (
                      <div
                        key={skill.id}
                        className={`skill-chip-select ${selected ? 'selected' : ''}`}
                      >
                        <Button
                          variant="ghost"
                          type="button"
                          className="skill-toggle"
                          onClick={() => toggleEditSkill(skill.id)}
                          style={{ '--chip-color': getCategoryColor(skill.category) }}
                        >
                          {selected && <Check size={12} />} {skill.name}
                        </Button>
                        {selected && (
                          <Select
                            className="skill-level-select"
                            value={selected.level}
                            onChange={(e) => updateEditSkillLevel(skill.id, e.target.value)}
                          >
                            {SKILL_LEVELS.map((l) => (
                              <option key={l.value} value={l.value}>
                                {l.label}
                              </option>
                            ))}
                          </Select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </FormField>
              <FormField className="form-group" label="Postes habituels">
                <div className="skills-selector">
                  {positions.map((pos) => {
                    const selected = editForm.defaultPositions.includes(pos.name);
                    const catColor =
                      POSITION_CATEGORIES.find((c) => c.value === pos.category)?.color ||
                      'var(--theme-text-gray)';
                    return (
                      <div
                        key={pos.id}
                        className={`skill-chip-select ${selected ? 'selected' : ''}`}
                      >
                        <Button
                          variant="ghost"
                          type="button"
                          className="skill-toggle"
                          onClick={() =>
                            setEditForm((prev) => ({
                              ...prev,
                              defaultPositions: selected
                                ? prev.defaultPositions.filter((n) => n !== pos.name)
                                : [...prev.defaultPositions, pos.name],
                            }))
                          }
                          style={{ '--chip-color': catColor }}
                        >
                          {selected && <Check size={12} />} {pos.name}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </FormField>
            </form>
          </ModalLayout>
        )}
      </div>
    );
  }

  return (
    <div className="personnel-panel">
      {error && (
        <InlineAlert
          action={
            <Button variant="ghost" onClick={loadData}>
              Réessayer
            </Button>
          }
        >
          {error}
        </InlineAlert>
      )}

      {/* Sous-onglets */}
      {subTabs.length > 0 && (
        <div className="personnel-subtabs">
          {subTabs.map((tab) => (
            <Button
              variant="ghost"
              key={tab.id}
              className={`personnel-subtab ${subTab === tab.id ? 'active' : ''}`}
              onClick={() => setSubTab(tab.id)}
              style={{ '--tab-color': tab.color }}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </Button>
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
          <SkillsTab skills={skills} setSkills={setSkills} currentUser={currentUser} />
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
            onPersonEdit={(person) => {
              setPersonToEdit(person);
              setSubTab('persons');
            }}
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
        {subTab === 'leaves' && <LeavesTab persons={persons} currentUser={currentUser} />}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// Onglet PERSONNES (pattern Parc : table + modal)
// ═══════════════════════════════════════

const PersonsTab = ({
  persons,
  setPersons,
  skills,
  positions = [],
  users,
  currentUser,
  personToEdit,
  onPersonToEditConsumed,
}) => {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();

  const filteredPersons = useMemo(
    () =>
      persons.filter((p) => {
        const matchSearch = `${p.firstName} ${p.lastName} ${p.email || ''} ${p.phone || ''}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const matchType =
          !filterType ||
          (filterType === '_permanent'
            ? PERMANENT_TYPES.includes(p.type)
            : filterType === '_non_permanent'
              ? NON_PERMANENT_TYPES.includes(p.type)
              : p.type === filterType);
        const matchStatus = !filterStatus || p.status === filterStatus;
        return matchSearch && matchType && matchStatus;
      }),
    [persons, searchTerm, filterType, filterStatus],
  );

  // Stats
  const stats = useMemo(() => {
    const total = persons.length;
    const active = persons.filter((p) => p.status === STATUS.ACTIVE).length;
    const permanent = persons.filter((p) => PERMANENT_TYPES.includes(p.type)).length;
    const nonPermanent = persons.filter((p) => NON_PERMANENT_TYPES.includes(p.type)).length;
    const inactive = persons.filter((p) => p.status === STATUS.INACTIVE).length;
    return { total, active, permanent, nonPermanent, inactive };
  }, [persons]);

  const openEdit = useCallback((person) => {
    setEditingPerson(person);
    setShowFormModal(true);
  }, []);

  const openCreate = useCallback(() => {
    setEditingPerson(null);
    setShowFormModal(true);
  }, []);

  // Ouvrir automatiquement la fiche si une personne est demandée par le parent
  useEffect(() => {
    if (personToEdit) {
      openEdit(personToEdit);
      onPersonToEditConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personToEdit]);

  const handleSave = async (payload) => {
    try {
      if (editingPerson) {
        const updated = await api.updatePerson(editingPerson.id, payload);
        setPersons((prev) => prev.map((p) => (p.id === editingPerson.id ? updated : p)));
      } else {
        const created = await api.createPerson(payload);
        setPersons((prev) => [...prev, created]);
      }
      refreshBus.publish('persons');
      setShowFormModal(false);
      setEditingPerson(null);
    } catch (err) {
      toast.error('Erreur : ' + (err.message || 'Impossible de sauvegarder'));
    }
  };

  const handleDelete = useCallback(
    (id) => {
      confirm({
        title: 'Supprimer cette personne',
        message: 'Supprimer cette personne ?',
        variant: 'danger',
        confirmLabel: 'Supprimer',
        onConfirm: async () => {
          try {
            await api.deletePerson(id);
            refreshBus.publish('persons');
            setPersons((prev) => prev.filter((p) => p.id !== id));
            if (selectedPerson?.id === id) setSelectedPerson(null);
          } catch (err) {
            toast.error('Erreur : ' + (err.message || 'Impossible de supprimer'));
          }
        },
      });
    },
    // setPersons est stable (setter useState), pas besoin dans les deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confirm, selectedPerson, toast],
  );

  const getTypeBadge = useCallback((person) => {
    const t = person.type;
    if (t === 'permanent') return { label: 'Permanent', cls: 'type-permanent' };
    if (t === 'salarié') return { label: 'Salarié', cls: 'type-salarie' };
    if (t === 'stagiaire') return { label: 'Stagiaire', cls: 'type-stagiaire' };
    if (t === 'apprenti') return { label: 'Apprenti', cls: 'type-apprenti' };
    if (t === 'contractuel') {
      const sub =
        CONTRACT_TYPES.find((c) => c.value === person.contractType)?.label ||
        person.contractType ||
        'Contractuel';
      return { label: sub, cls: 'type-contractuel' };
    }
    return { label: t, cls: '' };
  }, []);

  // [PERF Sprint 4] Mémorisation des sous-listes permanents/non-permanents :
  // évite 2 .filter() supplémentaires à chaque render (en plus de filteredPersons).
  const permanentsList = useMemo(
    () => filteredPersons.filter((p) => PERMANENT_TYPES.includes(p.type)),
    [filteredPersons],
  );
  const nonPermanentsList = useMemo(
    () => filteredPersons.filter((p) => NON_PERMANENT_TYPES.includes(p.type)),
    [filteredPersons],
  );

  // [PERF Phase 4.L] Données aplaties pour TableVirtuoso :
  // chaque élément est soit un séparateur de groupe (__group=true), soit une personne.
  // Cela permet la virtualisation tout en conservant les en-têtes de section.
  const ppTableData = useMemo(() => {
    const items = [];
    if (permanentsList.length > 0) {
      items.push({
        __group: true,
        kind: 'permanent',
        label: 'Permanents',
        count: permanentsList.length,
      });
      items.push(...permanentsList);
    }
    if (nonPermanentsList.length > 0) {
      items.push({
        __group: true,
        kind: 'non-permanent',
        label: 'Non-permanents',
        count: nonPermanentsList.length,
      });
      items.push(...nonPermanentsList);
    }
    return items;
  }, [permanentsList, nonPermanentsList]);

  // Context partagé avec les composants TableVirtuoso (au module-level).
  // Toggle sélection au clic, ouverture édition au double-clic.
  const ppTableContext = useMemo(
    () => ({
      selectedId: selectedPerson?.id || null,
      onSelect: (person) => setSelectedPerson((prev) => (prev?.id === person.id ? null : person)),
      onEdit: (person) => openEdit(person),
    }),
    // openEdit est stable (defined plus haut sans deps externes); selectedPerson change le HIT visuel
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedPerson?.id],
  );

  return (
    <div className="personnel-tab-content">
      {/* Toolbar */}
      <div className="eq-toolbar pp-toolbar">
        <div className="eq-toolbar-actions">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Rechercher..."
            size="sm"
          />
          <Select
            className="eq-filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Tous les types</option>
            {PERSON_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          {currentUser?.isAdmin && (
            <Tooltip content="Importer depuis un CSV" position="bottom">
              <Button variant="secondary" onClick={() => setShowImportModal(true)}>
                <Upload size={14} /> Import CSV
              </Button>
            </Tooltip>
          )}
          <Button variant="primary" onClick={openCreate}>
            <Plus size={14} /> Personnel
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="eq-header pp-header">
        <div className="eq-stats-row">
          <div
            role="button"
            tabIndex={0}
            className={`eq-stat ${!filterType && !filterStatus ? 'active' : ''}`}
            onClick={() => {
              setFilterType('');
              setFilterStatus('');
            }}
          >
            <Users size={16} />
            <span className="eq-stat-value">{stats.total}</span>
            <span className="eq-stat-label">Total</span>
          </div>
          <div
            role="button"
            tabIndex={0}
            className={`eq-stat eq-stat-available ${filterStatus === STATUS.ACTIVE ? 'active' : ''}`}
            onClick={() => {
              setFilterStatus(filterStatus === STATUS.ACTIVE ? '' : 'active');
              setFilterType('');
            }}
          >
            <CheckCircle size={16} />
            <span className="eq-stat-value">{stats.active}</span>
            <span className="eq-stat-label">Actifs</span>
          </div>
          <div
            role="button"
            tabIndex={0}
            className={`eq-stat eq-stat-inuse ${filterType === '_permanent' ? 'active' : ''}`}
            onClick={() => {
              setFilterStatus('');
              setFilterType(filterType === '_permanent' ? '' : '_permanent');
            }}
          >
            <User size={16} />
            <span className="eq-stat-value">{stats.permanent}</span>
            <span className="eq-stat-label">Permanents</span>
          </div>
          <div
            role="button"
            tabIndex={0}
            className={`eq-stat eq-stat-maint ${filterType === '_non_permanent' ? 'active' : ''}`}
            onClick={() => {
              setFilterStatus('');
              setFilterType(filterType === '_non_permanent' ? '' : '_non_permanent');
            }}
          >
            <Clock size={16} />
            <span className="eq-stat-value">{stats.nonPermanent}</span>
            <span className="eq-stat-label">Non-permanents</span>
          </div>
          {stats.inactive > 0 && (
            <div
              role="button"
              tabIndex={0}
              className={`eq-stat eq-stat-tickets ${filterStatus === STATUS.INACTIVE ? 'active' : ''}`}
              onClick={() => setFilterStatus(filterStatus === STATUS.INACTIVE ? '' : 'inactive')}
            >
              <AlertTriangle size={16} />
              <span className="eq-stat-value">{stats.inactive}</span>
              <span className="eq-stat-label">Inactifs</span>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="eq-content-wrapper">
        <div className="eq-content">
          {filteredPersons.length === 0 ? (
            <EmptyState
              icon={<Users size={48} strokeWidth={1} />}
              title={searchTerm ? 'Aucun résultat' : 'Aucune personne enregistrée'}
              description="Ajoutez votre premier personnel avec le bouton +"
            />
          ) : (
            <div className="eq-table-wrap">
              <TableVirtuoso
                style={{ height: '100%' }}
                data={ppTableData}
                overscan={200}
                increaseViewportBy={200}
                components={PP_TABLE_COMPONENTS}
                computeItemKey={(_idx, item) => (item?.__group ? `g-${item.kind}` : `p-${item.id}`)}
                context={ppTableContext}
                fixedHeaderContent={() => (
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
                )}
                itemContent={(_idx, item) => {
                  if (item?.__group) {
                    return (
                      <td colSpan={9}>
                        <span className={`pp-group-label ${item.kind}`}>
                          {item.label} ({item.count})
                        </span>
                      </td>
                    );
                  }
                  const person = item;
                  const badge = getTypeBadge(person);
                  let postes = [];
                  try {
                    const raw = person.defaultPositions || person.default_positions;
                    postes = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
                  } catch {
                    /* ignore */
                  }
                  return (
                    <>
                      <td className="eq-table-thumb">
                        <Avatar name={`${person.firstName} ${person.lastName}`} size="xs" />
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
                              const posObj = positions.find((p) => p.name === name);
                              const catColor =
                                POSITION_CATEGORIES.find((c) => c.value === posObj?.category)
                                  ?.color || 'var(--theme-text-gray)';
                              return (
                                <span
                                  key={i}
                                  className="skill-chip-mini"
                                  style={{ '--chip-color': catColor }}
                                >
                                  {name}
                                </span>
                              );
                            })}
                            {postes.length > 2 && (
                              <span className="skill-more">+{postes.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span className={`pp-status-dot ${person.status}`}>
                          {person.status === STATUS.ACTIVE ? '● Actif' : '○ Inactif'}
                        </span>
                      </td>
                      <td className="pp-actions-cell">
                        <Tooltip content="Modifier">
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(person);
                            }}
                            aria-label="Modifier"
                          >
                            <Edit2 size={14} />
                          </Button>
                        </Tooltip>
                        {currentUser?.isAdmin && (
                          <Tooltip content="Supprimer">
                            <Button
                              variant="danger"
                              size="sm"
                              iconOnly
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(person.id);
                              }}
                              aria-label="Supprimer"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </Tooltip>
                        )}
                      </td>
                    </>
                  );
                }}
              />
            </div>
          )}
        </div>

        {/* Slide panel détail (clic simple) */}
        <PersonnelSlidePanel
          person={selectedPerson}
          positions={positions}
          skills={skills}
          onClose={() => setSelectedPerson(null)}
          onEdit={(person) => {
            setSelectedPerson(null);
            openEdit(person);
          }}
        />
      </div>

      {/* Modal formulaire (ajout/édition) */}
      {showFormModal && (
        <PersonnelFormModal
          person={editingPerson}
          skills={skills}
          positions={positions}
          users={users}
          currentUser={currentUser}
          onSave={handleSave}
          onClose={() => {
            setShowFormModal(false);
            setEditingPerson(null);
          }}
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
            } catch (e) {
              console.error(e);
            }
          }}
        />
      )}

      {ConfirmDialogRenderer}
    </div>
  );
};

export default React.memo(PersonnelPanel);
