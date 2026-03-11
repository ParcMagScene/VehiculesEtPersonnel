import React, { useState, useEffect, lazy, Suspense } from 'react';
import { ClipboardList, Calendar, Tv2 } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../hooks/useToast';
import './PlanningPanel.css';

const TaskPlanningPanel = lazy(() => import('./TaskPlanningPanel'));
const DisplayDashboardPanel = lazy(() => import('../DisplayDashboard/DisplayDashboardPanel'));

// ═══ Composant Principal ═══
function PlanningPanel({ currentUser, googleEvents = [], onNavigateToEntity }) {
  const toast = useToast();
  const [activeSubTab, setActiveSubTab] = useState('tasks');
  const [stats, setStats] = useState(null);
  const [displayRefreshKey, setDisplayRefreshKey] = useState(0);

  useEffect(() => {
    api.getPlanningStats().then(setStats).catch(() => null);
  }, [activeSubTab]);

  const subTabs = [
    { id: 'tasks', label: 'Planification', icon: ClipboardList, count: stats?.tasksPending || 0 },
    { id: 'dashboard', label: 'Dashboard Écrans', icon: Tv2 },
  ];

  return (
    <div className="planning-panel">
      {/* Sub-tabs (fusionnés avec stats) */}
      <div className="sub-tabs">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`sub-tab ${activeSubTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveSubTab(tab.id)}
            >
              <Icon size={16} />
              {tab.label}
              {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
            </button>
          );
        })}
        {stats && (
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
        {activeSubTab === 'tasks' && (
          <Suspense fallback={null}>
            <TaskPlanningPanel currentUser={currentUser} refreshKey={displayRefreshKey} googleEvents={googleEvents} onNavigateToEntity={onNavigateToEntity} />
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
