import './PersonnelPanel.css';
import '../../styles/person-sidebar.css';
import '../equipment/EquipmentPanel.css';
import '../vehicles/Calendar.css';

import { Award, Briefcase, CalendarDays, CalendarOff, Clock, Timer, Users } from 'lucide-react';
import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';

import { Button, InlineAlert, Spinner } from '@/design-system';

import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
const PlanningTab = lazy(() =>
  import('./PersonnelPlanningView').then((m) => ({ default: m.PlanningTab })),
);
const PersonsTab = lazy(() =>
  import('./PersonnelListView').then((m) => ({ default: m.PersonsTab })),
);
const PersonnelAgenda = lazy(() => import('./PersonnelAgenda'));
const PersonnelPlanningEditModal = lazy(() => import('./PersonnelPlanningEditModal'));

const PositionsTab = lazy(() => import('./PositionsTab'));
const SkillsTab = lazy(() => import('./SkillsTab'));
const LeavesTab = lazy(() => import('../leaves/LeavesTab'));
const ForfaitJoursTab = lazy(() => import('../forfait/ForfaitJoursTab'));

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
    { id: 'forfait', label: 'Forfait-jours', icon: Timer, color: ACCENT_COLORS.violet },
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
        <Suspense
          fallback={
            <div className="personnel-loading">
              <Spinner size="lg" />
            </div>
          }
        >
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
        </Suspense>
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
          <Suspense
            fallback={
              <div className="personnel-loading">
                <Spinner size="lg" />
              </div>
            }
          >
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
          </Suspense>
        )}
        {subTab === 'skills' && (
          <Suspense
            fallback={
              <div className="personnel-loading">
                <Spinner size="lg" />
              </div>
            }
          >
            <SkillsTab skills={skills} setSkills={setSkills} currentUser={currentUser} />
          </Suspense>
        )}
        {subTab === 'positions' && (
          <Suspense
            fallback={
              <div className="personnel-loading">
                <Spinner size="lg" />
              </div>
            }
          >
            <PositionsTab
              positions={positions}
              setPositions={setPositions}
              currentUser={currentUser}
            />
          </Suspense>
        )}
        {subTab === 'planning' && (
          <Suspense
            fallback={
              <div className="personnel-loading">
                <Spinner size="lg" />
              </div>
            }
          >
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
          </Suspense>
        )}
        {subTab === 'agenda' && (
          <Suspense
            fallback={
              <div className="personnel-loading">
                <Spinner size="lg" />
              </div>
            }
          >
            <PersonnelAgenda
              persons={persons}
              currentUser={currentUser}
              googleEvents={googleEvents}
            />
          </Suspense>
        )}
        {subTab === 'leaves' && (
          <Suspense
            fallback={
              <div className="personnel-loading">
                <Spinner size="lg" />
              </div>
            }
          >
            <LeavesTab persons={persons} currentUser={currentUser} />
          </Suspense>
        )}
        {subTab === 'forfait' && (
          <Suspense
            fallback={
              <div className="personnel-loading">
                <Spinner size="lg" />
              </div>
            }
          >
            <ForfaitJoursTab persons={persons} currentUser={currentUser} />
          </Suspense>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// Onglets personnalisés (importés depuis PersonnelPlanningView, PersonnelListView, etc.)
// ═══════════════════════════════════════

// PersonsTab, PlanningTab, etc. sont maintenant dans leurs fichiers respectifs et importées en début de file

export default React.memo(PersonnelPanel);
