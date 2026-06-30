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
import { PersonsTab } from './PersonnelListView';
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
// Onglets personnalisés (importés depuis PersonnelPlanningView, PersonnelListView, etc.)
// ═══════════════════════════════════════

// PersonsTab, PlanningTab, etc. sont maintenant dans leurs fichiers respectifs et importées en début de file

export default React.memo(PersonnelPanel);
