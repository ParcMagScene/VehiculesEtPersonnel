import './PersonnelPanel.css';
import '../equipment/EquipmentPanel.css';
import '../vehicles/Calendar.css';

import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  isSameWeek,
  isSameYear,
  isWeekend as isWeekendFn,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  Award,
  Briefcase,
  CalendarDays,
  CalendarOff,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Filter,
  Link2,
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
        <PersonFormModal
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

// ═══════════════════════════════════════
// Modal formulaire personnel (pattern Parc)
// ═══════════════════════════════════════

const PersonFormModal = ({ person, skills, positions, users, currentUser, onSave, onClose }) => {
  const isAdmin = !!currentUser?.isAdmin;
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [showAnnuaire, setShowAnnuaire] = useState(false);
  const [form, setForm] = useState(() => {
    let defaultPos = [];
    if (person) {
      try {
        const raw = person.defaultPositions || person.default_positions;
        defaultPos = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
      } catch {
        /* ignore */
      }
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
      skills: (person?.skills || []).map((s) => ({
        skillId: s.skillId || s.skill_id,
        level: s.level || 'intermédiaire',
      })),
      defaultPositions: defaultPos,
      // ── Annuaire étendu ──
      address: person?.address || '',
      postalCode: person?.postalCode || person?.postal_code || '',
      city: person?.city || '',
      country: person?.country || 'France',
      phonePersonal: person?.phonePersonal || person?.phone_personal || '',
      personalEmail: person?.personalEmail || person?.personal_email || '',
      birthDate: person?.birthDate || person?.birth_date || '',
      emergencyContactName: person?.emergencyContactName || person?.emergency_contact_name || '',
      emergencyContactPhone: person?.emergencyContactPhone || person?.emergency_contact_phone || '',
      emergencyContactRelation:
        person?.emergencyContactRelation || person?.emergency_contact_relation || '',
      linkedinUrl: person?.linkedinUrl || person?.linkedin_url || '',
      // Sensibles — admin only.
      socialSecurityNumber: person?.socialSecurityNumber || person?.social_security_number || '',
      iban: person?.iban || '',
      hrNotes: person?.hrNotes || person?.hr_notes || '',
    };
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim())
      return toast.warning('Prénom et nom requis');
    const payload = {
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email || null,
      phone: form.phone || null,
      type: form.type,
      contract_type: form.type === 'contractuel' ? form.contractType || 'intermittent' : null,
      user_id: form.userId ? Number(form.userId) : null,
      status: form.status,
      notes: form.notes || null,
      default_positions: JSON.stringify(form.defaultPositions || []),
      skills: form.skills.map((s) => ({ skill_id: s.skillId, level: s.level })),
      // Annuaire
      address: form.address || null,
      postal_code: form.postalCode || null,
      city: form.city || null,
      country: form.country || null,
      phone_personal: form.phonePersonal || null,
      personal_email: form.personalEmail || null,
      birth_date: form.birthDate || null,
      emergency_contact_name: form.emergencyContactName || null,
      emergency_contact_phone: form.emergencyContactPhone || null,
      emergency_contact_relation: form.emergencyContactRelation || null,
      linkedin_url: form.linkedinUrl || null,
    };
    if (isAdmin) {
      payload.social_security_number = form.socialSecurityNumber || null;
      payload.iban = form.iban || null;
      payload.hr_notes = form.hrNotes || null;
    }
    resetDirty();
    onSave(payload);
  };

  const toggleSkill = (skillId) => {
    setForm((prev) => {
      const existing = prev.skills.find((s) => s.skillId === skillId);
      if (existing) return { ...prev, skills: prev.skills.filter((s) => s.skillId !== skillId) };
      return { ...prev, skills: [...prev.skills, { skillId, level: 'intermédiaire' }] };
    });
  };

  const updateSkillLevel = (skillId, level) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.map((s) => (s.skillId === skillId ? { ...s, level } : s)),
    }));
  };

  const { resetDirty, guardClose } = useDirtyForm(form, { confirmer: confirm });
  const handleSafeClose = guardClose(onClose);

  return (
    <>
      <ModalLayout
        open
        onClose={handleSafeClose}
        title={person ? '✏️ Modifier la fiche' : '➕ Nouvelle personne'}
        size="lg"
        className="eq-modal pp-form-modal"
        footer={
          <>
            <Button variant="ghost" onClick={handleSafeClose}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" form="person-form">
              {person ? 'Enregistrer' : 'Créer'}
            </Button>
          </>
        }
      >
        <form id="person-form" onSubmit={handleSubmit} className="eq-modal-body">
          <div className="eq-form-grid">
            <div className="eq-form-field">
              <label>Prénom *</label>
              <Input
                type="text"
                required
                maxLength={100}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                autoFocus
              />
            </div>
            <div className="eq-form-field">
              <label>Nom *</label>
              <Input
                type="text"
                required
                maxLength={100}
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
            <div className="eq-form-field">
              <label>Email</label>
              <Input
                type="email"
                maxLength={254}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="eq-form-field">
              <label>Téléphone</label>
              <PhoneInput value={form.phone} onChange={(val) => setForm({ ...form, phone: val })} />
            </div>
            <div className="eq-form-field">
              <label>Catégorie</label>
              <Select
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value,
                    contractType: e.target.value !== 'contractuel' ? '' : form.contractType,
                  })
                }
              >
                {PERSON_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            {form.type === 'contractuel' && (
              <div className="eq-form-field">
                <label>Type de contrat</label>
                <Select
                  value={form.contractType}
                  onChange={(e) => setForm({ ...form, contractType: e.target.value })}
                >
                  <option value="">— Choisir —</option>
                  {CONTRACT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="eq-form-field">
              <label>Statut</label>
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </Select>
            </div>
            <div className="eq-form-field">
              <label>
                <Link2 size={14} /> Compte utilisateur
              </label>
              <Select
                value={form.userId || ''}
                onChange={(e) => setForm({ ...form, userId: e.target.value || null })}
              >
                <option value="">Aucun (non lié)</option>
                {(users || []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email || `Utilisateur #${u.id}`}
                  </option>
                ))}
              </Select>
            </div>
            <div className="eq-form-field eq-form-full">
              <label>Notes</label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {/* Annuaire — coordonnées étendues + contact d'urgence (+ RH si admin) */}
            <div className="eq-form-field eq-form-full">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setShowAnnuaire((v) => !v)}
                aria-expanded={showAnnuaire}
              >
                {showAnnuaire ? '▾' : '▸'} Annuaire — coordonnées & contact d'urgence
                {isAdmin ? ' (+ RH)' : ''}
              </Button>
            </div>
            {showAnnuaire && (
              <>
                <div className="eq-form-field eq-form-full">
                  <label>Adresse</label>
                  <Input
                    type="text"
                    maxLength={500}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                <div className="eq-form-field">
                  <label>Code postal</label>
                  <Input
                    type="text"
                    maxLength={10}
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  />
                </div>
                <div className="eq-form-field">
                  <label>Ville</label>
                  <Input
                    type="text"
                    maxLength={100}
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="eq-form-field">
                  <label>Pays</label>
                  <Input
                    type="text"
                    maxLength={100}
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
                <div className="eq-form-field">
                  <label>Date de naissance</label>
                  <Input
                    type="date"
                    value={form.birthDate || ''}
                    onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  />
                </div>
                <div className="eq-form-field">
                  <label>Téléphone personnel</label>
                  <PhoneInput
                    value={form.phonePersonal}
                    onChange={(val) => setForm({ ...form, phonePersonal: val })}
                  />
                </div>
                <div className="eq-form-field">
                  <label>Email personnel</label>
                  <Input
                    type="email"
                    maxLength={254}
                    value={form.personalEmail}
                    onChange={(e) => setForm({ ...form, personalEmail: e.target.value })}
                  />
                </div>
                <div className="eq-form-field">
                  <label>LinkedIn</label>
                  <Input
                    type="url"
                    maxLength={500}
                    placeholder="https://linkedin.com/in/…"
                    value={form.linkedinUrl}
                    onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                  />
                </div>
                <div className="eq-form-field">
                  <label>Contact d'urgence — Nom</label>
                  <Input
                    type="text"
                    maxLength={255}
                    value={form.emergencyContactName}
                    onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                  />
                </div>
                <div className="eq-form-field">
                  <label>Contact d'urgence — Téléphone</label>
                  <PhoneInput
                    value={form.emergencyContactPhone}
                    onChange={(val) => setForm({ ...form, emergencyContactPhone: val })}
                  />
                </div>
                <div className="eq-form-field">
                  <label>Contact d'urgence — Lien</label>
                  <Input
                    type="text"
                    maxLength={100}
                    placeholder="Conjoint, parent, ami…"
                    value={form.emergencyContactRelation}
                    onChange={(e) => setForm({ ...form, emergencyContactRelation: e.target.value })}
                  />
                </div>
                {isAdmin && (
                  <>
                    <div className="eq-form-field eq-form-full">
                      <label>🔒 N° Sécurité sociale (admin)</label>
                      <Input
                        type="text"
                        maxLength={30}
                        autoComplete="off"
                        value={form.socialSecurityNumber}
                        onChange={(e) => setForm({ ...form, socialSecurityNumber: e.target.value })}
                      />
                    </div>
                    <div className="eq-form-field eq-form-full">
                      <label>🔒 IBAN (admin)</label>
                      <Input
                        type="text"
                        maxLength={40}
                        autoComplete="off"
                        value={form.iban}
                        onChange={(e) => setForm({ ...form, iban: e.target.value })}
                      />
                    </div>
                    <div className="eq-form-field eq-form-full">
                      <label>🔒 Notes RH (admin)</label>
                      <Textarea
                        rows={3}
                        value={form.hrNotes}
                        onChange={(e) => setForm({ ...form, hrNotes: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* Compétences */}
            <div className="eq-form-field eq-form-full">
              <label>Compétences</label>
              <div className="skills-selector">
                {skills.map((skill) => {
                  const selected = form.skills.find((s) => s.skillId === skill.id);
                  return (
                    <div
                      key={skill.id}
                      className={`skill-chip-select ${selected ? 'selected' : ''}`}
                    >
                      <Button
                        variant="ghost"
                        type="button"
                        className="skill-toggle"
                        onClick={() => toggleSkill(skill.id)}
                        style={{ '--chip-color': getCategoryColor(skill.category) }}
                      >
                        {selected && <Check size={12} />} {skill.name}
                      </Button>
                      {selected && (
                        <Select
                          className="skill-level-select"
                          value={selected.level}
                          onChange={(e) => updateSkillLevel(skill.id, e.target.value)}
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
            </div>

            {/* Postes habituels */}
            <div className="eq-form-field eq-form-full">
              <label>Postes habituels</label>
              <div className="skills-selector">
                {positions.map((pos) => {
                  const selected = form.defaultPositions.includes(pos.name);
                  const catColor =
                    POSITION_CATEGORIES.find((c) => c.value === pos.category)?.color ||
                    'var(--theme-text-gray)';
                  return (
                    <div key={pos.id} className={`skill-chip-select ${selected ? 'selected' : ''}`}>
                      <Button
                        variant="ghost"
                        type="button"
                        className="skill-toggle"
                        onClick={() =>
                          setForm((prev) => ({
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
            </div>
          </div>
        </form>
      </ModalLayout>
      {ConfirmDialogRenderer}
    </>
  );
};

// ═══════════════════════════════════════
// Onglet PLANNING
// ═══════════════════════════════════════

const PlanningTab = ({
  persons,
  skills,
  positions = [],
  view = 'week',
  setView,
  currentDate = new Date(),
  setCurrentDate,
  googleEvents = [],
  onPersonEdit,
  onPersonCreate,
  navigateToPersonId,
  onNavigateToPersonHandled,
  quickAssignmentSlot,
  onQuickAssignmentHandled,
  currentUser,
  onOpenSuivi,
  googleBanner = null,
}) => {
  const toast = useToast();
  const { confirm: confirmDelete, ConfirmDialogRenderer: DeleteConfirmRenderer } =
    useConfirmDialog();
  const scrollAreaRef = useRef(null);
  const headerScrollRef = useRef(null);
  const personColumnRef = useRef(null);
  const [personColumnWidth, setPersonColumnWidth] = useState(250);
  const columnResizingRef = useRef(false);
  const [collapsedSections, setCollapsedSections] = useState({
    permanents: false,
    favoris: false,
    nonPermanents: true,
    inactifs: true,
  });
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
  const { isFavorite, toggleFavorite, sortPersonsByFavorites } = usePersonnelFavorites();

  // Navigation croisée depuis un autre module
  useEffect(() => {
    if (navigateToPersonId && persons.length > 0) {
      const target = persons.find((p) => p.id === navigateToPersonId);
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
  const [planningData, setPlanningData] = useState({
    missions: [],
    availabilities: [],
    taskAssignments: [],
  });
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
    return days.map((day) => ({ day }));
  }, [days]);

  // Charger les données du planning (missions + assignments)
  const loadPlanning = useCallback(async () => {
    try {
      if (days.length === 0) return;
      const startStr = format(days[0], 'yyyy-MM-dd');
      const endStr = format(days[days.length - 1], 'yyyy-MM-dd');
      const data = await api.getPersonnelPlanning({ startDate: startStr, endDate: endStr });
      setPlanningData(data || { missions: [], availabilities: [], taskAssignments: [] });
    } catch (err) {
      console.error('Erreur chargement planning:', err);
      toast.error('Erreur chargement du planning');
    }
  }, [days, toast]);

  useEffect(() => {
    loadPlanning();
  }, [loadPlanning]);

  // Charger le nombre de demandes en attente (module congés)
  useEffect(() => {
    api
      .getPendingLeavesCount()
      .then((r) => setPendingLeaveCount(r?.count || 0))
      .catch(() => {});
  }, [planningData]);

  // Index des missions par personne avec calcul de span continu
  // { personId -> [{ mission, assignment, startSlotIdx, slotCount }] }
  const missionSpans = useMemo(() => {
    const spans = {};
    if (view === 'year' || days.length === 0) return spans;
    const viewStart = days[0];
    const viewEnd = days[days.length - 1];

    (planningData.missions || []).forEach((mission) => {
      if (!mission.assignments) return;
      mission.assignments.forEach((a) => {
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

          const startDayIdx = days.findIndex((d) => isSameDay(d, visStart));
          const endDayIdx = days.findIndex((d) => isSameDay(d, visEnd));
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
              const parsed =
                typeof rawDayStates === 'string' ? JSON.parse(rawDayStates) : rawDayStates;
              if (Array.isArray(parsed)) {
                storedOffDays = new Set(parsed);
              }
            } catch {
              /* ignore */
            }
          }

          mDays.forEach((d) => {
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
        } catch {
          /* erreur parsing date */
        }
      });
    });
    return spans;
  }, [planningData.missions, days, view]);

  // Index des absences (availabilities) par personne + jour (pour colorer les slots)
  // LEAVE_TYPE_COLORS : couleur de fond des cellules pour chaque type d'absence
  const LEAVE_TYPE_COLORS = {
    unavailable: 'var(--theme-text-muted)', // gris-bleu
    absence: STATUS_COLORS.danger, // rouge absence
    conge_paye: '#60a5fa', // bleu
    rtt: '#a78bfa', // violet
    maladie: '#f87171', // rouge
    sans_solde: '#fb923c', // orange
    formation: ACCENT_COLORS.violet, // violet foncé
    entreprise: STATUS_COLORS.info, // bleu
    workshop: STATUS_COLORS.warning, // ambre
    examen: STATUS_COLORS.success, // vert
    rdv: ACCENT_COLORS.cyan, // cyan
    repos: '#fbbf24', // jaune
    autre: 'var(--theme-text-muted)', // gris
  };
  const LEAVE_TYPE_LABELS = {
    unavailable: 'Indisponible',
    absence: 'Absence',
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

    (planningData.availabilities || []).forEach((avail) => {
      if (avail.status === STATUS.REJECTED) return; // ignorer les refusées
      try {
        const aStart = parseISO(avail.start_date || avail.startDate);
        const aEnd = parseISO(avail.end_date || avail.endDate);
        if (aStart > viewEnd || aEnd < viewStart) return;

        const personId = avail.person_id || avail.personId;
        const clampedStart = aStart < viewStart ? viewStart : aStart;
        const clampedEnd = aEnd > viewEnd ? viewEnd : aEnd;
        const startIdx = days.findIndex((d) => isSameDay(d, clampedStart));
        const endIdx = days.findIndex((d) => isSameDay(d, clampedEnd));
        if (startIdx === -1) return;
        const eIdx = endIdx === -1 ? startIdx : endIdx;

        for (let i = startIdx; i <= eIdx; i++) {
          // [2.5] Déterminer la période pour ce jour spécifique
          const isFirstDay = i === startIdx && isSameDay(clampedStart, aStart);
          const isLastDay = i === endIdx && isSameDay(clampedEnd, aEnd);
          const sp = isFirstDay ? avail.start_period || avail.startPeriod || 'AM' : 'AM';
          const ep = isLastDay ? avail.end_period || avail.endPeriod || 'PM' : 'PM';
          // period: 'AM' = matin seul, 'PM' = après-midi seul, 'FULL' = journée entière
          const period = sp === 'AM' && ep === 'PM' ? 'FULL' : sp === 'PM' ? 'PM' : 'AM';
          map[`${personId}_${i}`] = {
            type: avail.type || 'unavailable',
            reason: avail.reason,
            status: avail.status || 'approved',
            period,
            is_unavailability: (avail.type || 'unavailable').toLowerCase() !== 'entreprise',
          };
        }
      } catch {
        /* ignore */
      }
    });
    return map;
  }, [planningData.availabilities, days, view]);

  // Index des tâches assignées (task_assignments) par personne + jour
  // Map : `${personId}_${slotIndex}` → [{ id, title, period, section, affaire_num, source_type, status }]
  const taskSlots = useMemo(() => {
    const map = {};
    if (view === 'year' || days.length === 0) return map;

    (planningData.taskAssignments || []).forEach((ta) => {
      try {
        const personId = ta.person_id || ta.personId;
        const taskDate = parseISO(ta.date);
        const slotIdx = days.findIndex((d) => isSameDay(d, taskDate));
        if (slotIdx === -1) return;

        const key = `${personId}_${slotIdx}`;
        if (!map[key]) map[key] = [];
        map[key].push({
          id: ta.id,
          title: ta.title,
          period: ta.period,
          section: ta.section,
          affaireNum: ta.affaire_num,
          sourceType: ta.source_type,
          status: ta.status,
        });
      } catch {
        /* ignore */
      }
    });
    return map;
  }, [planningData.taskAssignments, days, view]);

  // Set des slots couverts par une mission (pour styling et empêcher clic)
  const coveredSlotsForPerson = useCallback(
    (personId) => {
      const set = new Set();
      (missionSpans[personId] || []).forEach((s) => {
        for (let i = s.startSlotIdx; i < s.startSlotIdx + s.slotCount; i++) set.add(i);
      });
      return set;
    },
    [missionSpans],
  );

  // Grid columns CSS — source de verite UNIQUE partagee avec le banner
  // Google Calendar et le module Parc, via utils/planningGridColumns.
  // Garantit l'alignement pixel-perfect entre banner et grille.
  const windowWidth = useWindowWidth();
  const gridColumns = useMemo(
    () => computeGridColumnsCss({ view, days, module: 'planning', windowWidth }),
    [view, days, windowWidth],
  );

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

  // Appliquer recherche et filtre sur tout le personnel (actif + inactif)
  const filteredPersons = useMemo(() => {
    return persons.filter((p) => {
      const matchSearch =
        !planningSearch ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(planningSearch.toLowerCase());
      const matchFilter = !planningFilter || p.type === planningFilter;
      return matchSearch && matchFilter;
    });
  }, [persons, planningSearch, planningFilter]);

  const isPersonInactive = useCallback(
    (p) => p.status === STATUS.INACTIVE || p.isActive === false,
    [],
  );

  // Stagiaires en période entreprise : traités comme permanents sur la période affichée
  const enterpriseTraineeIds = useMemo(() => {
    if (!days.length) return new Set();
    const start = days[0];
    const end = view === 'year' ? endOfMonth(days[days.length - 1]) : days[days.length - 1];
    const ids = new Set();

    (planningData.availabilities || []).forEach((avail) => {
      if (avail.status === STATUS.REJECTED) return;
      if ((avail.type || '').toLowerCase() !== 'entreprise') return;

      try {
        const aStart = parseISO(avail.start_date || avail.startDate);
        const aEnd = parseISO(avail.end_date || avail.endDate);
        if (aStart <= end && aEnd >= start) {
          ids.add(avail.person_id || avail.personId);
        }
      } catch {
        /* ignore */
      }
    });

    return ids;
  }, [planningData.availabilities, days, view]);

  const activeFilteredPersons = filteredPersons.filter((p) => !isPersonInactive(p));
  const inactivePersons = filteredPersons.filter((p) => isPersonInactive(p));

  const permanents = activeFilteredPersons.filter(
    (p) =>
      PERMANENT_TYPES.includes(p.type) ||
      (p.type === 'stagiaire' && enterpriseTraineeIds.has(p.id)),
  );
  const nonPermanentsRaw = activeFilteredPersons.filter(
    (p) =>
      NON_PERMANENT_TYPES.includes(p.type) &&
      !(p.type === 'stagiaire' && enterpriseTraineeIds.has(p.id)),
  );

  const favoriteNonPermanents = useMemo(
    () => sortPersonsByFavorites(nonPermanentsRaw.filter((p) => isFavorite(p.id))),
    [nonPermanentsRaw, isFavorite, sortPersonsByFavorites],
  );

  const nonPermanentsSource = useMemo(
    () => nonPermanentsRaw.filter((p) => !isFavorite(p.id)),
    [nonPermanentsRaw, isFavorite],
  );

  // Tri : favoris en haut des non-permanents (toujours actif).
  const nonPermanents = useMemo(
    () => sortPersonsByFavorites(nonPermanentsSource),
    [nonPermanentsSource, sortPersonsByFavorites],
  );

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
      setDragCreate((prev) => ({ ...prev, endSlotIdx: slotIndex }));
    }
    // Activer le drag-to-move seulement quand la souris entre dans un slot différent
    if (
      pendingBlockDragRef.current &&
      pendingBlockDragRef.current.person.id === person.id &&
      slotIndex !== pendingBlockDragRef.current.slotIndex
    ) {
      const p = pendingBlockDragRef.current;
      isDragMovingRef.current = true;
      wasDraggedRef.current = true;
      const newStartIdx = slotIndex - p.offsetSlots;
      setDragMove({
        span: p.span,
        person: p.person,
        offsetSlots: p.offsetSlots,
        originalStartIdx: p.originalStartIdx,
        currentStartIdx: Math.max(0, Math.min(newStartIdx, days.length - p.span.slotCount)),
      });
      pendingBlockDragRef.current = null;
    }
    if (isDragMovingRef.current && dragMove && dragMove.person.id === person.id) {
      const newStartIdx = slotIndex - dragMove.offsetSlots;
      if (newStartIdx >= 0 && newStartIdx + dragMove.span.slotCount <= days.length) {
        setDragMove((prev) => ({ ...prev, currentStartIdx: newStartIdx }));
      }
    }
    if (isResizingRef.current && resizeState && resizeState.person.id === person.id) {
      if (resizeState.edge === 'end') {
        const newSlotCount = Math.max(1, slotIndex - resizeState.currentStartIdx + 1);
        setResizeState((prev) => ({ ...prev, currentSlotCount: newSlotCount }));
      } else {
        const endIdx = resizeState.currentStartIdx + resizeState.currentSlotCount - 1;
        if (slotIndex <= endIdx) {
          setResizeState((prev) => ({
            ...prev,
            currentStartIdx: slotIndex,
            currentSlotCount: endIdx - slotIndex + 1,
          }));
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
        setAssignmentDialog({
          person: dragCreate.person,
          day: startDay,
          endDay: endDay || startDay,
          period: 'AM',
        });
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
        api
          .updateMission(span.mission.id, {
            start_date: format(newStart, 'yyyy-MM-dd'),
            end_date: format(newEnd, 'yyyy-MM-dd'),
          })
          .then(() => loadPlanning())
          .catch((err) => {
            console.error('Erreur déplacement:', err);
            toast.error('Erreur déplacement de la mission');
            loadPlanning();
          });
      }
      setDragMove(null);
      return;
    }
    // Fin de resize
    if (isResizingRef.current && resizeState) {
      isResizingRef.current = false;
      const { span, currentStartIdx, currentSlotCount, originalStartIdx, originalSlotCount } =
        resizeState;
      if (currentStartIdx !== originalStartIdx || currentSlotCount !== originalSlotCount) {
        const deltaStart = currentStartIdx - originalStartIdx;
        const deltaEnd =
          currentStartIdx + currentSlotCount - (originalStartIdx + originalSlotCount);
        const newStart = new Date(span.missionStart);
        newStart.setDate(newStart.getDate() + deltaStart);
        const newEnd = new Date(span.missionEnd);
        newEnd.setDate(newEnd.getDate() + deltaEnd);
        api
          .updateMission(span.mission.id, {
            start_date: format(newStart, 'yyyy-MM-dd'),
            end_date: format(newEnd, 'yyyy-MM-dd'),
          })
          .then(() => loadPlanning())
          .catch((err) => {
            console.error('Erreur resize:', err);
            toast.error('Erreur modification de la mission');
            loadPlanning();
          });
      }
      setResizeState(null);
      return;
    }
  }, [dragCreate, dragMove, resizeState, days, loadPlanning, toast]);

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
      span,
      person,
      slotIndex,
      offsetSlots: slotIndex - span.startSlotIdx,
      originalStartIdx: span.startSlotIdx,
    };
  };

  // ═══ RESIZE HANDLES : modifier début/fin ═══
  const handleResizeStart = (e, span, person, edge) => {
    if (view === 'year' || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    setResizeState({
      span,
      person,
      edge,
      originalStartIdx: span.startSlotIdx,
      originalSlotCount: span.slotCount,
      currentStartIdx: span.startSlotIdx,
      currentSlotCount: span.slotCount,
    });
  };

  // Clic simple sur cellule vide (fallback si pas eu de drag)
  const handleSlotClick = (person, day, slotIndex, period) => {
    if (view === 'year') return;
    if (dragCreate || dragMove || resizeState) return;
    const covered = coveredSlotsForPerson(person.id);
    if (covered.has(slotIndex)) return;
    setAssignmentDialog({ person, day, period: period || 'AM' });
  };

  // Vérifier si un slot est dans la sélection drag-to-create
  const isInDragSelection = useCallback(
    (personId, slotIndex) => {
      if (!dragCreate || dragCreate.person.id !== personId) return false;
      const minIdx = Math.min(dragCreate.startSlotIdx, dragCreate.endSlotIdx);
      const maxIdx = Math.max(dragCreate.startSlotIdx, dragCreate.endSlotIdx);
      return slotIndex >= minIdx && slotIndex <= maxIdx;
    },
    [dragCreate],
  );

  // Callback après création d'une affectation
  const handleAssignmentCreated = () => {
    loadPlanning();
  };

  // Supprimer une mission
  const handleDeleteMission = async (missionToDelete) => {
    const mission = missionToDelete || deleteMission?.mission;
    if (!mission) return;
    const ok = await confirmDelete(
      `Supprimer la mission "${mission.title}" et toutes ses affectations ?`,
    );
    if (!ok) {
      setDeleteMission(null);
      return;
    }
    try {
      await api.deleteMission(mission.id);
      setDeleteMission(null);
      loadPlanning();
    } catch (err) {
      console.error('Erreur suppression mission:', err);
      toast.error('Erreur suppression de la mission');
      setDeleteMission(null);
    }
  };

  // Obtenir la couleur d'un statut d'affectation
  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return STATUS_COLORS.success;
      case 'option':
        return STATUS_COLORS.warning;
      case 'proposed':
        return 'var(--theme-text-gray)';
      case 'refused':
        return STATUS_COLORS.danger;
      case 'cancelled':
        return 'var(--theme-text-muted)';
      default:
        return '#667eea';
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
      <div key={person.id} className="pp-person-row" onMouseUp={handleGlobalMouseUp}>
        {timeSlots.map((slot, slotIndex) => {
          const weekend = isWeekendFn(slot.day);
          const today = isToday(slot.day);
          const todayCls = today ? ' today-slot' : '';

          // Chercher si un bloc commence à ce slot (original ou preview)
          let spanHere = personSpanList.find((s) => s.startSlotIdx === slotIndex);
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
          const isOriginalBeingResized =
            spanHere && isResizing && spanHere.missionId === resizingSpanId;

          const _missionTitle = spanHere?.mission?.title || '';
          const _assignStatus = spanHere?.assignment?.status || '';
          const isHovered =
            hoveredSlot?.personId === person.id && hoveredSlot?.slotIndex === slotIndex;
          const dayLabel =
            view === 'year'
              ? format(slot.day, 'MMMM yyyy', { locale: fr })
              : format(slot.day, 'EEEE d MMM', { locale: fr });

          const anyDragActive =
            isDragCreatingRef.current || isDragMovingRef.current || isResizingRef.current;

          // Absence sur ce slot ?
          const absenceKey = `${person.id}_${slotIndex}`;
          const absence = absenceSlots[absenceKey];
          const hasAbsence = !!absence;
          const hasBlockingAbsence = !!absence && absence.is_unavailability !== false;
          const absenceColor = hasAbsence
            ? LEAVE_TYPE_COLORS[absence.type] || 'var(--theme-text-muted)'
            : null;
          const absenceLabel = hasAbsence ? LEAVE_TYPE_LABELS[absence.type] || '' : '';
          const absencePeriodLabel =
            hasAbsence && absence.period !== 'FULL' ? ` (${absence.period})` : '';
          const absenceTooltip = hasAbsence
            ? `${absenceLabel}${absencePeriodLabel}${absence.reason ? ' — ' + absence.reason : ''}${absence.status === STATUS.PENDING ? ' (en attente)' : ''}`
            : '';

          // Absence partielle (AM/PM) ne bloque pas entièrement le slot
          const isFullAbsence = hasBlockingAbsence && absence.period === 'FULL';

          const tasksHere = taskSlots[`${person.id}_${slotIndex}`] || [];

          return (
            <div
              key={slotIndex}
              className={`pp-slot${weekend ? ' weekend' : ''}${todayCls}${isCovered && !isOriginalBeingMoved ? ' has-assignment' : ''}${isHovered ? ' pp-cell-hovered' : ''}${isDragSel ? ' pp-drag-selected' : ''}${hasBlockingAbsence ? ' pp-slot-absence' : ''}`}
              onMouseDown={(e) =>
                !isCovered && !isFullAbsence && handleSlotMouseDown(person, slotIndex, e)
              }
              onContextMenu={(e) => {
                // [2.6] Clic droit sur cellule → menu contextuel avec date pré-remplie
                if (isCovered) return;
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, person, day: slot.day });
              }}
              onMouseEnter={() => {
                handleSlotMouseEnter(person, slotIndex);
                if (!anyDragActive) setHoveredSlot({ personId: person.id, slotIndex });
              }}
              onMouseLeave={() => {
                if (!anyDragActive) setHoveredSlot(null);
              }}
              onMouseUp={handleGlobalMouseUp}
              onClick={(e) => {
                if (isCovered || isFullAbsence || wasDraggedRef.current) {
                  wasDraggedRef.current = false;
                  return;
                }
                e.stopPropagation();
                // Si demi-journée absence AM, proposer PM, et inversement
                const period = hasBlockingAbsence
                  ? absence.period === 'AM'
                    ? 'PM'
                    : 'AM'
                  : undefined;
                handleSlotClick(person, slot.day, slotIndex, period);
              }}
              data-emag-tooltip={
                isHovered && !anyDragActive
                  ? hasAbsence
                    ? `${personName} — ${absenceTooltip}`
                    : `${personName} — ${dayLabel}`
                  : undefined
              }
              style={{
                cursor: view !== 'year' && !isCovered && !isFullAbsence ? 'crosshair' : 'default',
                ...(hasAbsence
                  ? (() => {
                      // [2.5] AM = moitié haut, PM = moitié bas, FULL = tout
                      // Pending = hachures diagonales marquées + bordure dashed pour signaler "demande en attente"
                      const isPending = absence.status === STATUS.PENDING;
                      const baseAlpha = isPending ? '25' : '40';
                      const stripesAlpha = isPending ? '70' : '00';
                      const stripes = isPending
                        ? `, repeating-linear-gradient(45deg, transparent 0, transparent 5px, ${absenceColor}${stripesAlpha} 5px, ${absenceColor}${stripesAlpha} 8px)`
                        : '';
                      let backgroundImage = 'none';
                      if (absence.period === 'AM') {
                        backgroundImage = `linear-gradient(to bottom, ${absenceColor}${baseAlpha} 50%, transparent 50%)${stripes}`;
                      } else if (absence.period === 'PM') {
                        backgroundImage = `linear-gradient(to bottom, transparent 50%, ${absenceColor}${baseAlpha} 50%)${stripes}`;
                      } else if (isPending) {
                        backgroundImage = `repeating-linear-gradient(45deg, transparent 0, transparent 5px, ${absenceColor}${stripesAlpha} 5px, ${absenceColor}${stripesAlpha} 8px)`;
                      }
                      return {
                        backgroundColor:
                          absence.period === 'FULL' ? absenceColor + baseAlpha : 'transparent',
                        backgroundImage,
                        ...(isPending
                          ? {
                              outline: `1.5px dashed ${absenceColor}`,
                              outlineOffset: '-2px',
                            }
                          : {}),
                      };
                    })()
                  : {}),
              }}
            >
              {/* Label absence */}
              {hasAbsence && !isCovered && (
                <span
                  className="pp-absence-label"
                  style={{
                    color: absenceColor,
                    fontStyle: absence.status === STATUS.PENDING ? 'italic' : 'normal',
                    opacity: absence.status === STATUS.PENDING ? 0.85 : 1,
                  }}
                >
                  {absence.status === STATUS.PENDING ? '⏳ ' : ''}
                  {absenceLabel}
                  {absencePeriodLabel}
                </span>
              )}
              {/* Tâches assignées (affichées sous les missions ou seules) */}
              {tasksHere.length > 0 && !isCovered && (
                <div className="pp-task-chips">
                  {tasksHere.map((task) => (
                    <div
                      key={task.id}
                      className={`pp-task-chip${task.sourceType === 'affaire' ? ' affaire' : ''}`}
                      title={`${task.title}${task.affaireNum ? ` (${task.affaireNum})` : ''}${task.period ? ` — ${task.period}` : ''}`}
                    >
                      <span className="pp-task-chip-title">
                        {task.title || task.affaireNum || 'Tâche'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {/* Bloc original (masqué si en cours de move/resize) */}
              {spanHere &&
                !isOriginalBeingMoved &&
                !isOriginalBeingResized &&
                renderAssignmentBlock(spanHere, person, slotIndex, false)}
              {/* Bloc fantôme (original pendant move/resize) */}
              {spanHere &&
                (isOriginalBeingMoved || isOriginalBeingResized) &&
                renderAssignmentBlock(spanHere, person, slotIndex, true)}
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
          borderRight: spanHere.clippedRight
            ? `3px dashed ${getStatusColor(assignStatus)}40`
            : 'none',
          width: `calc(${spanHere.slotCount * 100}% + ${spanHere.slotCount - 1}px)`,
        }}
        title=""
        onMouseDown={(e) => !isGhost && handleBlockMouseDown(e, spanHere, person, slotIndex)}
        onClick={(e) => {
          if (isGhost) return;
          if (wasDraggedRef.current) {
            wasDraggedRef.current = false;
            return;
          }
          e.stopPropagation();
          setAssignmentDialog({
            person,
            day: days[slotIndex],
            period: 'AM',
            editMission: spanHere,
          });
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
                  backgroundColor: isOn
                    ? getStatusColor(assignStatus) + 'C0'
                    : getStatusColor(assignStatus) + '25',
                }}
              />
            );
          })}
        </div>
        <div className="pp-assignment-content">
          <span className="pp-assignment-title">{missionTitle}</span>
          {spanHere.assignment?.position &&
            (() => {
              let posNames = [];
              try {
                const parsed = JSON.parse(spanHere.assignment.position);
                if (Array.isArray(parsed)) posNames = parsed;
                else posNames = [spanHere.assignment.position];
              } catch {
                posNames = [spanHere.assignment.position];
              }
              return posNames.length > 0 ? (
                <span className="pp-assignment-position">{posNames.join(', ')}</span>
              ) : null;
            })()}
        </div>
        {!isGhost && (
          <>
            <Tooltip content="Supprimer cette mission" position="bottom">
              <Button
                variant="ghost"
                className="pp-assignment-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteMission(spanHere.mission);
                }}
              >
                <Trash2 size={12} />
              </Button>
            </Tooltip>
            {/* Poignées de resize */}
            {view !== 'year' && !spanHere.clippedLeft && (
              <div
                className="pp-resize-handle pp-resize-handle-start"
                onMouseDown={(e) => handleResizeStart(e, spanHere, person, 'start')}
                title="Glisser pour modifier le début"
              />
            )}
            {view !== 'year' && !spanHere.clippedRight && (
              <div
                className="pp-resize-handle pp-resize-handle-end"
                onMouseDown={(e) => handleResizeStart(e, spanHere, person, 'end')}
                title="Glisser pour modifier la fin"
              />
            )}
          </>
        )}
      </div>
    );
  };

  // Rendu d'un bloc de preview (drag-move ou resize)
  const renderPreviewBlock = (span, _person) => {
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
            <div
              key={i}
              className="pp-assignment-day-stripe on"
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
              <Button
                variant="ghost"
                className={`cal-nav-view-btn ${view === 'week' ? 'active' : ''}`}
                onClick={() => setView('week')}
              >
                Semaine
              </Button>
              <Button
                variant="ghost"
                className={`cal-nav-view-btn ${view === 'month' ? 'active' : ''}`}
                onClick={() => setView('month')}
              >
                Mois
              </Button>
            </div>
            <div className="cal-nav-date">
              <Button
                variant="ghost"
                className="cal-nav-btn"
                onClick={goToPrevious}
                aria-label="Mois précédent"
              >
                <ChevronLeft size={18} />
              </Button>
              <Button
                variant="ghost"
                className={`cal-nav-btn cal-nav-today ${ppShowTodayHighlight ? 'highlight' : ''}`}
                onClick={goToToday}
              >
                Aujourd'hui
              </Button>
              <Button
                variant="ghost"
                className="cal-nav-btn"
                onClick={goToNext}
                aria-label="Mois suivant"
              >
                <ChevronRight size={18} />
              </Button>
              <span
                className="cal-nav-label clickable"
                onClick={() => {
                  if (view === 'month') setShowMonthSelector(true);
                  if (view === 'week') setShowWeekSelector(true);
                  if (view === 'year') setShowYearSelector(true);
                }}
                title={
                  view === 'month'
                    ? 'Sélectionner un mois'
                    : view === 'week'
                      ? 'Sélectionner une semaine'
                      : 'Sélectionner une année'
                }
              >
                {getDateLabel()}
              </span>
            </div>
          </div>
        )}
        <div className="pp-planning-filters">
          <Filter size={14} />
          <Select
            value={planningFilter}
            onChange={(e) => setPlanningFilter(e.target.value)}
            className="pp-planning-filter-select"
          >
            <option value="">Tous les types</option>
            {PERSON_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {googleBanner}

      {filteredPersons.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={48} />}
          title="Ajoutez du personnel pour afficher le planning"
          action={
            onPersonCreate && (
              <Button variant="ghost" className="personnel-add-btn u-mt-3" onClick={onPersonCreate}>
                <Plus size={16} /> Ajouter une personne
              </Button>
            )
          }
        />
      ) : (
        <div className="pp-planning-with-panel">
          <div className="pp-calendar-container">
            {/* Recherche personnel (contenue dans la colonne sidebar) */}
            <div className="pp-planning-search-row">
              <div className="pp-planning-search-wrap" style={{ width: personColumnWidth }}>
                <SearchBar
                  value={planningSearch}
                  onChange={setPlanningSearch}
                  placeholder="Rechercher…"
                  size="sm"
                />
                {onPersonCreate && (
                  <Tooltip
                    content="Ajouter une personne (modification/suppression : clic droit sur la ligne)"
                    position="bottom"
                  >
                    <Button
                      variant="primary"
                      className="pp-planning-search-add-btn"
                      onClick={onPersonCreate}
                      aria-label="Ajouter une personne"
                    >
                      <Plus size={14} />
                    </Button>
                  </Tooltip>
                )}
              </div>
            </div>
            {/* Ligne d'en-têtes */}
            <div className="pp-headers-row">
              <div className="pp-column-header">
                <span>Permanents</span>
                <div className="pp-column-header-actions">
                  {pendingLeaveCount > 0 && (
                    <Tooltip content="Demandes de congés en attente" position="bottom">
                      <Button
                        variant="ghost"
                        className="pp-leave-badge-btn"
                        onClick={() => setShowLeaveApproval(true)}
                      >
                        <Clock size={12} />
                        <span className="pp-leave-badge-count">{pendingLeaveCount}</span>
                      </Button>
                    </Tooltip>
                  )}
                  <Button
                    variant="ghost"
                    className="pp-section-toggle"
                    onClick={() =>
                      setCollapsedSections((prev) => ({ ...prev, permanents: !prev.permanents }))
                    }
                    title={collapsedSections.permanents ? 'Développer' : 'Rétracter'}
                  >
                    {collapsedSections.permanents ? '▼' : '▲'}
                  </Button>
                </div>
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
                          <div className="pp-month-name">
                            {format(monthDate, 'MMMM', { locale: fr })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="pp-header">
                      {days.map((day, i) => (
                        <div
                          key={i}
                          className={`pp-header-cell day-header${isWeekendFn(day) ? ' weekend' : ''}${isToday(day) ? ' today' : ''}`}
                        >
                          <div className="pp-day-name">{format(day, 'EEEE', { locale: fr })}</div>
                          <div className="pp-day-number">
                            {format(day, 'd MMMM', { locale: fr })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Corps : colonne personnel + grille */}
            <div className="pp-content-row">
              <div
                className="pp-person-column"
                ref={personColumnRef}
                style={{ width: personColumnWidth }}
              >
                {/* Poignée de redimensionnement de la colonne */}
                <div
                  className="pp-column-resize-handle"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startWidth = personColumnWidth;
                    columnResizingRef.current = true;
                    const onMove = (ev) => {
                      if (!columnResizingRef.current) return;
                      const delta = ev.clientX - startX;
                      setPersonColumnWidth(Math.max(150, Math.min(420, startWidth + delta)));
                    };
                    const onUp = () => {
                      columnResizingRef.current = false;
                      document.removeEventListener('mousemove', onMove);
                      document.removeEventListener('mouseup', onUp);
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                  }}
                />
                {/* Section Permanents */}
                {!collapsedSections.permanents &&
                  permanents.map((person) => (
                    <div
                      key={person.id}
                      className={`pp-person-cell u-cursor-pointer${hoveredSlot?.personId === person.id ? ' pp-row-hovered' : ''}`}
                      onClick={() => {
                        if (clickTimerRef.current) return;
                        clickTimerRef.current = setTimeout(() => {
                          clickTimerRef.current = null;
                          setSelectedPersonForDetails(person);
                        }, 250);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (clickTimerRef.current) {
                          clearTimeout(clickTimerRef.current);
                          clickTimerRef.current = null;
                        }
                        onPersonEdit && onPersonEdit(person);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, person });
                      }}
                    >
                      <Button
                        variant="ghost"
                        className={`pp-fav-star${isFavorite(person.id) ? ' active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(person.id);
                        }}
                        title={
                          isFavorite(person.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'
                        }
                      >
                        <Star size={12} fill={isFavorite(person.id) ? 'currentColor' : 'none'} />
                      </Button>
                      <span className="pp-person-name">
                        {person.firstName} {person.lastName || ''}
                      </span>
                      <span className={`person-type-badge mini type-${person.type}`}>
                        {PERSON_TYPES.find((t) => t.value === person.type)?.label || person.type}
                      </span>
                    </div>
                  ))}

                {/* Section Favoris (non-permanents) */}
                {favoriteNonPermanents.length > 0 && (
                  <div className="pp-section-header">
                    <span>Favoris</span>
                    <Button
                      variant="ghost"
                      className="pp-section-toggle"
                      onClick={() =>
                        setCollapsedSections((prev) => ({
                          ...prev,
                          favoris: !prev.favoris,
                        }))
                      }
                    >
                      {collapsedSections.favoris ? '▼' : '▲'}
                    </Button>
                  </div>
                )}
                {!collapsedSections.favoris &&
                  favoriteNonPermanents.map((person) => (
                    <div
                      key={person.id}
                      className={`pp-person-cell u-cursor-pointer pp-person-favorite${hoveredSlot?.personId === person.id ? ' pp-row-hovered' : ''}`}
                      onClick={() => {
                        if (clickTimerRef.current) return;
                        clickTimerRef.current = setTimeout(() => {
                          clickTimerRef.current = null;
                          setSelectedPersonForDetails(person);
                        }, 250);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (clickTimerRef.current) {
                          clearTimeout(clickTimerRef.current);
                          clickTimerRef.current = null;
                        }
                        onPersonEdit && onPersonEdit(person);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, person });
                      }}
                    >
                      <Button
                        variant="ghost"
                        className="pp-fav-star active"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(person.id);
                        }}
                        title="Retirer des favoris"
                      >
                        <Star size={12} fill="currentColor" />
                      </Button>
                      <span className="pp-person-name">
                        {person.firstName} {person.lastName || ''}
                      </span>
                      <span className={`person-type-badge mini type-${person.type}`}>
                        {person.type === 'contractuel'
                          ? CONTRACT_TYPES.find((c) => c.value === person.contractType)?.label ||
                            'Contractuel'
                          : PERSON_TYPES.find((t) => t.value === person.type)?.label || person.type}
                      </span>
                    </div>
                  ))}

                {/* Section Contractuels — header */}
                {nonPermanents.length > 0 && (
                  <div className="pp-section-header">
                    <span>Non-permanents</span>
                    <Button
                      variant="ghost"
                      className="pp-section-toggle"
                      onClick={() =>
                        setCollapsedSections((prev) => ({
                          ...prev,
                          nonPermanents: !prev.nonPermanents,
                        }))
                      }
                    >
                      {collapsedSections.nonPermanents ? '▼' : '▲'}
                    </Button>
                  </div>
                )}
                {!collapsedSections.nonPermanents &&
                  nonPermanents.map((person) => (
                    <div
                      key={person.id}
                      className={`pp-person-cell u-cursor-pointer${hoveredSlot?.personId === person.id ? ' pp-row-hovered' : ''}${isFavorite(person.id) ? ' pp-person-favorite' : ''}`}
                      onClick={() => {
                        if (clickTimerRef.current) return;
                        clickTimerRef.current = setTimeout(() => {
                          clickTimerRef.current = null;
                          setSelectedPersonForDetails(person);
                        }, 250);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (clickTimerRef.current) {
                          clearTimeout(clickTimerRef.current);
                          clickTimerRef.current = null;
                        }
                        onPersonEdit && onPersonEdit(person);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, person });
                      }}
                    >
                      <Button
                        variant="ghost"
                        className={`pp-fav-star${isFavorite(person.id) ? ' active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(person.id);
                        }}
                        title={
                          isFavorite(person.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'
                        }
                      >
                        <Star size={12} fill={isFavorite(person.id) ? 'currentColor' : 'none'} />
                      </Button>
                      <span className="pp-person-name">
                        {person.firstName} {person.lastName || ''}
                      </span>
                      <span className={`person-type-badge mini type-${person.type}`}>
                        {person.type === 'contractuel'
                          ? CONTRACT_TYPES.find((c) => c.value === person.contractType)?.label ||
                            'Contractuel'
                          : PERSON_TYPES.find((t) => t.value === person.type)?.label || person.type}
                      </span>
                    </div>
                  ))}

                {/* Section Inactifs */}
                {inactivePersons.length > 0 && (
                  <div className="pp-section-header">
                    <span>Inactifs</span>
                    <Button
                      variant="ghost"
                      className="pp-section-toggle"
                      onClick={() =>
                        setCollapsedSections((prev) => ({
                          ...prev,
                          inactifs: !prev.inactifs,
                        }))
                      }
                    >
                      {collapsedSections.inactifs ? '▼' : '▲'}
                    </Button>
                  </div>
                )}
                {!collapsedSections.inactifs &&
                  inactivePersons.map((person) => (
                    <div
                      key={person.id}
                      className={`pp-person-cell u-cursor-pointer pp-person-inactive${hoveredSlot?.personId === person.id ? ' pp-row-hovered' : ''}`}
                      onClick={() => {
                        if (clickTimerRef.current) return;
                        clickTimerRef.current = setTimeout(() => {
                          clickTimerRef.current = null;
                          setSelectedPersonForDetails(person);
                        }, 250);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (clickTimerRef.current) {
                          clearTimeout(clickTimerRef.current);
                          clickTimerRef.current = null;
                        }
                        onPersonEdit && onPersonEdit(person);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, person });
                      }}
                    >
                      <Button
                        variant="ghost"
                        className={`pp-fav-star${isFavorite(person.id) ? ' active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(person.id);
                        }}
                        title={
                          isFavorite(person.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'
                        }
                      >
                        <Star size={12} fill={isFavorite(person.id) ? 'currentColor' : 'none'} />
                      </Button>
                      <span className="pp-person-name">
                        {person.firstName} {person.lastName || ''}
                      </span>
                      <span className="pp-status-dot inactive">○ Inactif</span>
                    </div>
                  ))}
              </div>

              <div className="pp-scroll-area" ref={scrollAreaRef}>
                <div
                  className={`pp-grid ${view}-view${dragCreate ? ' pp-dragging' : ''}${resizeState ? ' pp-resizing' : ''}${dragMove ? ' pp-dragging' : ''}`}
                  style={{ gridTemplateColumns: gridColumns }}
                >
                  {/* Lignes Permanents */}
                  {!collapsedSections.permanents && permanents.map(renderPersonRow)}

                  {/* Séparateur Contractuels dans la grille */}
                  {favoriteNonPermanents.length > 0 && (
                    <div className="pp-section-separator" style={{ gridColumn: '1 / -1' }}>
                      <span>Favoris</span>
                      <Button
                        variant="ghost"
                        className="pp-section-toggle"
                        onClick={() =>
                          setCollapsedSections((prev) => ({
                            ...prev,
                            favoris: !prev.favoris,
                          }))
                        }
                      >
                        {collapsedSections.favoris ? '▼' : '▲'}
                      </Button>
                    </div>
                  )}

                  {!collapsedSections.favoris && favoriteNonPermanents.map(renderPersonRow)}

                  {/* Séparateur Contractuels dans la grille */}
                  {nonPermanents.length > 0 && (
                    <div className="pp-section-separator" style={{ gridColumn: '1 / -1' }}>
                      <span>Non-permanents</span>
                      <Button
                        variant="ghost"
                        className="pp-section-toggle"
                        onClick={() =>
                          setCollapsedSections((prev) => ({
                            ...prev,
                            nonPermanents: !prev.nonPermanents,
                          }))
                        }
                      >
                        {collapsedSections.nonPermanents ? '▼' : '▲'}
                      </Button>
                    </div>
                  )}

                  {/* Lignes Contractuels */}
                  {!collapsedSections.nonPermanents && nonPermanents.map(renderPersonRow)}

                  {/* Séparateur Inactifs dans la grille */}
                  {inactivePersons.length > 0 && (
                    <div className="pp-section-separator" style={{ gridColumn: '1 / -1' }}>
                      <span>Inactifs</span>
                      <Button
                        variant="ghost"
                        className="pp-section-toggle"
                        onClick={() =>
                          setCollapsedSections((prev) => ({
                            ...prev,
                            inactifs: !prev.inactifs,
                          }))
                        }
                      >
                        {collapsedSections.inactifs ? '▼' : '▲'}
                      </Button>
                    </div>
                  )}

                  {/* Lignes Inactifs */}
                  {!collapsedSections.inactifs && inactivePersons.map(renderPersonRow)}
                </div>
              </div>
            </div>
          </div>
          <PersonnelSlidePanel
            person={selectedPersonForDetails}
            positions={positions}
            skills={skills}
            onClose={() => setSelectedPersonForDetails(null)}
            onEdit={(person) => {
              setSelectedPersonForDetails(null);
              onPersonEdit && onPersonEdit(person);
            }}
            onRequestLeave={(personId) => {
              const p = persons.find((pp) => pp.id === personId);
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
            handleDeleteMission(mission);
          }}
        />
      )}

      {/* Dialog de confirmation de suppression */}
      {DeleteConfirmRenderer}

      {/* Modal de demande de congé — Module Code du travail / IDCC 3252 */}
      {showLeaveModal && (
        <LeaveRequestForm
          person={showLeaveModal.person || null}
          persons={persons.filter((p) => !isPersonInactive(p))}
          isAdmin={!!currentUser?.isAdmin}
          currentUser={currentUser}
          onClose={() => setShowLeaveModal(null)}
          onCreated={() => {
            loadPlanning();
          }}
        />
      )}

      {/* Panneau de validation admin des congés */}
      {showLeaveApproval && (
        <LeaveValidationPanel
          onClose={() => setShowLeaveApproval(false)}
          onRefresh={() => loadPlanning()}
        />
      )}

      {/* Panneau historique des congés d'un employé */}
      {showLeaveHistory && (
        <LeaveRequestsPanel
          personId={showLeaveHistory.personId}
          isAdmin={!!currentUser?.isAdmin}
          onClose={() => setShowLeaveHistory(null)}
          onNewRequest={() => {
            const p = persons.find((pp) => pp.id === showLeaveHistory.personId);
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
            const day = contextMenu.day; // [2.6] date de la cellule clic-droit
            setContextMenu(null);
            if (type === 'suivi') {
              onOpenSuivi && onOpenSuivi(person);
            } else if (type === 'conge_paye') {
              setShowLeaveModal({ person, day });
            } else {
              setPeriodCalendar({ person, type, day });
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
          initialDate={periodCalendar.day}
          isAdmin={false}
          onClose={() => setPeriodCalendar(null)}
          onCreated={() => loadPlanning()}
        />
      )}

      {/* Sélecteurs de dates */}
      {showMonthSelector && (
        <MonthSelector
          currentDate={currentDate}
          onSelectMonth={(date) => {
            setCurrentDate(date);
            setShowMonthSelector(false);
          }}
          onClose={() => setShowMonthSelector(false)}
        />
      )}
      {showWeekSelector && (
        <WeekSelector
          currentDate={currentDate}
          onSelectWeek={(date) => {
            setCurrentDate(date);
            setShowWeekSelector(false);
          }}
          onClose={() => setShowWeekSelector(false)}
        />
      )}
      {showYearSelector && (
        <YearSelector
          currentDate={currentDate}
          onSelectYear={(date) => {
            setCurrentDate(date);
            setShowYearSelector(false);
          }}
          onClose={() => setShowYearSelector(false)}
        />
      )}
    </div>
  );
};

export default React.memo(PersonnelPanel);
