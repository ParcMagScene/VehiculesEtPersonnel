import './PlanningPanel.css';

import { Calendar, ClipboardCheck, ClipboardList, Tv2, Users } from 'lucide-react';
import { lazy, Suspense, useEffect, useState, useTransition } from 'react';

import { Button } from '@/design-system';

import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

const PersonnelPanel = lazy(() => import('../personnel/PersonnelPanel'));
const SuiviPanel = lazy(() => import('../suivi/SuiviPanel'));
const TaskPlanningPanel = lazy(() => import('./TaskPlanningPanel'));
const DisplayDashboardPanel = lazy(() => import('../DisplayDashboard/DisplayDashboardPanel'));

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

  // Auto-switch vers l'onglet Personnel quand navigation demandée
  useEffect(() => {
    if (navigateToPersonId || quickAssignmentSlot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSubTab('personnel');
    }
  }, [navigateToPersonId, quickAssignmentSlot]);

  useEffect(() => {
    api
      .getPlanningStats()
      .then(setStats)
      .catch(() => null);
  }, [activeSubTab]);

  const subTabs = [
    { id: 'personnel', label: 'Personnel', icon: Users },
    { id: 'suivi', label: 'Suivi', icon: ClipboardCheck },
    { id: 'tasks', label: 'Planification', icon: ClipboardList, count: stats?.tasksPending || 0 },
    { id: 'dashboard', label: 'Dashboard Écrans', icon: Tv2 },
  ];

  return (
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
            />
          </Suspense>
        )}
        {activeSubTab === 'suivi' && (
          <Suspense fallback={null}>
            <SuiviPanel currentUser={currentUser} />
          </Suspense>
        )}
        {activeSubTab === 'tasks' && (
          <Suspense fallback={null}>
            <TaskPlanningPanel
              currentUser={currentUser}
              refreshKey={displayRefreshKey}
              googleEvents={googleEvents}
              onNavigateToEntity={onNavigateToEntity}
            />
          </Suspense>
        )}
        {activeSubTab === 'dashboard' && (
          <Suspense fallback={null}>
            <DisplayDashboardPanel currentUser={currentUser} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default PlanningPanel;
