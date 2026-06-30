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
import PersonnelPlanningEditModal from './PersonnelPlanningEditModal';
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

  const openEditDirect = (person) => {
    setEditingPersonDirect(person);
    setEditFormVisible(true);
  };

  const openCreateDirect = () => {
    setEditingPersonDirect(null);
    setEditFormVisible(true);
  };

  const resetEditForm = () => {
    setEditingPersonDirect(null);
    setEditFormVisible(false);
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
        <PersonnelPlanningEditModal
          open={editFormVisible}
          onClose={resetEditForm}
          person={editingPersonDirect}
          skills={skills}
          positions={positions}
          onSuccess={() => {
            loadData();
            resetEditForm();
          }}
          onError={(err) => {
            toast.error('Erreur : ' + (err.message || 'Impossible de sauvegarder'));
          }}
        />
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
