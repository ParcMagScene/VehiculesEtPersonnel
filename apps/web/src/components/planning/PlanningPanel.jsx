import './PlanningPanel.css';

import { Calendar, ClipboardCheck, ClipboardList, Tv2, Users } from 'lucide-react';
import { lazy, Suspense, useEffect, useState, useTransition } from 'react';

import { Button } from '@/design-system';

import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import ErrorBoundary from '../ErrorBoundary';
import { PlanningModalProvider } from './PlanningModalContext';

const PersonnelPanel = lazy(() => import('../personnel/PersonnelPanel'));
const DisplayDashboardPanel = lazy(() => import('../DisplayDashboard/DisplayDashboardPanel'));
const PersonalSuiviWrapper = lazy(() => import('../suivi/PersonalSuiviWrapper'));
const PersonalPlanningWrapper = lazy(() => import('./PersonalPlanningWrapper'));

// ═══ Composant Principal ═══
function PlanningPanel({
  currentUser,
  googleEvents = [],
  onNavigateToEntity,
  // Props Personnel (passées au sous-onglet Personnel)
  personnelRefreshKey,
  view,
  setView,
  currentDate,
  setCurrentDate,
  navigateToPersonId,
  onNavigateToPersonHandled,
  quickAssignmentSlot,
  onQuickAssignmentHandled,
}) {
  const _toast = useToast();
  const [activeSubTab, setActiveSubTab] = useState('personnel');
  const [_isPending, startTransition] = useTransition();
  const [stats, setStats] = useState(null);
  const [displayRefreshKey, _setDisplayRefreshKey] = useState(0);
  const [suiviInitialPersonId, setSuiviInitialPersonId] = useState(null);
  const [personnel, setPersonnel] = useState([]);

  // Charger la liste du personnel pour les wrappers d'auth personnelle
  useEffect(() => {
    api
      .getSuiviPersonnel()
      .then((data) => setPersonnel(Array.isArray(data) ? data : []))
      .catch(() => setPersonnel([]));
  }, []);

  // Auto-switch vers l'onglet Personnel quand navigation demandée
  useEffect(() => {
    if (navigateToPersonId || quickAssignmentSlot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSubTab('personnel');
    }
  }, [navigateToPersonId, quickAssignmentSlot]);

  // Ouvrir l'onglet Suivi depuis le planning (menu clic-droit)
  const handleOpenSuivi = (person) => {
    setSuiviInitialPersonId(person?.id ?? null);
    startTransition(() => setActiveSubTab('suivi'));
  };

  useEffect(() => {
    api
      .getPlanningStats()
      .then(setStats)
      .catch(() => null);
  }, [activeSubTab]);

  const subTabs = [
    { id: 'personnel', label: 'Planning', icon: Users },
    { id: 'suivi', label: 'Suivi', icon: ClipboardCheck },
    { id: 'tasks', label: 'Tâches', icon: ClipboardList, count: stats?.tasksPending || 0 },
    { id: 'dashboard', label: 'Dashboard Écrans', icon: Tv2 },
  ];

  return (
    <PlanningModalProvider>
      <div className="planning-panel">
        {/* Sub-tabs (fusionnés avec stats) */}
        <div className="sub-tabs">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                variant="ghost"
                key={tab.id}
                className={`sub-tab ${activeSubTab === tab.id ? 'active' : ''}`}
                onClick={() => startTransition(() => setActiveSubTab(tab.id))}
              >
                <Icon size={16} />
                {tab.label}
                {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
              </Button>
            );
          })}
          {stats && activeSubTab !== 'personnel' && (
            <div className="header-stats">
              <span className="stat-badge highlight">
                <Calendar size={14} /> {stats.displayEventsToday} aujourd'hui
              </span>
              <span className="stat-badge">
                <ClipboardList size={14} /> {stats.tasksPending} tâches en attente
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="panel-content">
          {activeSubTab === 'personnel' && (
            <ErrorBoundary moduleName="Planning · Personnel">
              <Suspense fallback={null}>
                <PersonnelPanel
                  key={personnelRefreshKey}
                  currentUser={currentUser}
                  mode="planning"
                  view={view}
                  setView={setView}
                  currentDate={currentDate}
                  setCurrentDate={setCurrentDate}
                  googleEvents={googleEvents}
                  navigateToPersonId={navigateToPersonId}
                  onNavigateToPersonHandled={onNavigateToPersonHandled}
                  quickAssignmentSlot={quickAssignmentSlot}
                  onQuickAssignmentHandled={onQuickAssignmentHandled}
                  onOpenSuivi={handleOpenSuivi}
                />
              </Suspense>
            </ErrorBoundary>
          )}
          {activeSubTab === 'suivi' && (
            <ErrorBoundary moduleName="Planning · Suivi">
              <Suspense fallback={null}>
                <PersonalSuiviWrapper
                  currentUser={currentUser}
                  personnel={personnel}
                  initialPersonId={suiviInitialPersonId}
                />
              </Suspense>
            </ErrorBoundary>
          )}
          {activeSubTab === 'tasks' && (
            <ErrorBoundary moduleName="Planning · Planification">
              <Suspense fallback={null}>
                <PersonalPlanningWrapper
                  currentUser={currentUser}
                  personnel={personnel}
                  refreshKey={displayRefreshKey}
                  googleEvents={googleEvents}
                  onNavigateToEntity={onNavigateToEntity}
                />
              </Suspense>
            </ErrorBoundary>
          )}
          {activeSubTab === 'dashboard' && (
            <ErrorBoundary moduleName="Planning · Dashboard Écrans">
              <Suspense fallback={null}>
                <DisplayDashboardPanel currentUser={currentUser} />
              </Suspense>
            </ErrorBoundary>
          )}
        </div>
      </div>
    </PlanningModalProvider>
  );
}

export default PlanningPanel;
