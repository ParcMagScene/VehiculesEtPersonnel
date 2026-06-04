// ═══════════════════════════════════════════════════════════════
// DisplayDashboardPanel — Panneau principal du module Dashboard
// Sous-module de Planning → onglet « Dashboard Écrans »
// ═══════════════════════════════════════════════════════════════

import './DisplayDashboardPanel.css';

import { Camera, ExternalLink, Film, MessageCircle, Music, Palette, Tag } from 'lucide-react';
import { lazy, memo, Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { Tab, TabList, TabPanel, Tabs } from '@/design-system';

import ErrorBoundary from '../ErrorBoundary';

// Lazy sub-tabs
const AppearanceTab = lazy(() => import('./AppearanceTab'));
const WelcomeMessagesTab = lazy(() => import('./WelcomeMessagesTab'));
const ColorRulesTab = lazy(() => import('./ColorRulesTab'));
const LocationIconsTab = lazy(() => import('./LocationIconsTab'));
const SneakyTab = lazy(() => import('./SneakyTab'));
const SonosTab = lazy(() => import('../sonos/SonosPanel'));
const TVPreviewPanel = lazy(() => import('./TVPreviewPanel'));
const DashboardTasksSidebar = lazy(() => import('./DashboardTasksSidebar'));

function getTvUrl() {
  const { hostname, port } = window.location;
  // Dev (Vite) → backend sur 3003 ; Preview/Prod → backend sur 3002
  if (port === '5174' || port === '5175') return `http://${hostname}:3003/tv`;
  if (port === '4173') return `http://${hostname}:3002/tv`;
  return `http://${hostname}:${port}/tv`;
}

const CONFIG_TABS = [
  { id: 'appearance', label: 'Apparence', icon: Palette },
  { id: 'welcomeMessages', label: 'Messages TV', icon: MessageCircle },
  { id: 'colorRules', label: 'Couleurs', icon: Tag },
  { id: 'locationIcons', label: 'Icônes tâches', icon: Film },
  { id: 'sneaky', label: 'Photo furtive', icon: Camera },
  { id: 'sonos', label: 'Sonos', icon: Music },
];

function DisplayDashboardPanel({ currentUser }) {
  const [activeTab, setActiveTab] = useState('appearance');
  const [refreshKey, setRefreshKey] = useState(0);
  const [previewOverrides, setPreviewOverrides] = useState({});
  const [previewWidth, setPreviewWidth] = useState(() => {
    const saved = localStorage.getItem('ddp-preview-width');
    return saved ? Number(saved) : 360;
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('ddp-sidebar-width');
    return saved ? Number(saved) : 280;
  });
  const isDragging = useRef(false);
  const draggingTarget = useRef(null); // 'preview' | 'sidebar'
  const bodyRef = useRef(null);

  // Generic drag handler for resizable dividers
  const handleDividerMouseDown = useCallback(
    (target) => (e) => {
      e.preventDefault();
      isDragging.current = true;
      draggingTarget.current = target;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (ev) => {
        if (!isDragging.current || !bodyRef.current) return;
        const rect = bodyRef.current.getBoundingClientRect();
        if (draggingTarget.current === 'preview') {
          const newWidth = Math.round(rect.right - ev.clientX);
          const clamped = Math.max(200, Math.min(newWidth, rect.width - 300));
          setPreviewWidth(clamped);
        } else if (draggingTarget.current === 'sidebar') {
          const newWidth = Math.round(ev.clientX - rect.left);
          const clamped = Math.max(200, Math.min(newWidth, 500));
          setSidebarWidth(clamped);
        }
      };

      const onMouseUp = () => {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        if (draggingTarget.current === 'preview') {
          setPreviewWidth((w) => {
            localStorage.setItem('ddp-preview-width', w);
            return w;
          });
        } else {
          setSidebarWidth((w) => {
            localStorage.setItem('ddp-sidebar-width', w);
            return w;
          });
        }
        draggingTarget.current = null;
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [],
  );

  const handlePreviewChange = useCallback((overrides) => {
    setPreviewOverrides((prev) => ({ ...prev, ...overrides }));
  }, []);

  // Réinitialiser les overrides à chaque changement d'onglet
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewOverrides({});
  }, [activeTab]);

  const _handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const validTabIds = CONFIG_TABS.map((t) => t.id);
  useEffect(() => {
    if (!validTabIds.includes(activeTab)) {
      setActiveTab('appearance');
    }
  }, [activeTab, validTabIds]);

  const handleTabChange = useCallback(
    (nextTab) => {
      if (validTabIds.includes(nextTab)) {
        setActiveTab(nextTab);
      } else {
        setActiveTab('appearance');
      }
    },
    [validTabIds],
  );

  return (
    <div className="display-dashboard">
      {/* Sous-onglets Configuration TV */}
      <Tabs value={activeTab} onChange={handleTabChange}>
        {/* Corps — split layout : tâches | config | divider | aperçu TV */}
        <div className="display-body split" ref={bodyRef}>
          {/* Sidebar tâches du jour + Sonos */}
          <Suspense fallback={<div className="display-loading">Chargement…</div>}>
            <DashboardTasksSidebar refreshKey={refreshKey} style={{ width: sidebarWidth }} />
          </Suspense>

          {/* Divider sidebar ↔ config */}
          <div
            className="display-split-divider"
            onMouseDown={handleDividerMouseDown('sidebar')}
            title="Glisser pour redimensionner"
          />

          <div className="display-tab-content">
            <div className="display-tabs-container">
              <TabList className="display-subtabs">
                {CONFIG_TABS.map((tab) => (
                  <Tab key={tab.id} value={tab.id} icon={<tab.icon size={14} />}>
                    {tab.label}
                  </Tab>
                ))}
              </TabList>
              <a
                href={getTvUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="display-tv-link"
                title="Ouvrir le Dashboard TV dans un nouvel onglet"
              >
                <ExternalLink size={14} />
                <span>{getTvUrl()}</span>
              </a>
            </div>
            <ErrorBoundary moduleName="Dashboard Écrans (onglets)">
              <Suspense fallback={<div className="display-loading">Chargement…</div>}>
                <TabPanel value="appearance">
                  <AppearanceTab
                    currentUser={currentUser}
                    refreshKey={refreshKey}
                    onPreviewChange={handlePreviewChange}
                  />
                </TabPanel>
                <TabPanel value="welcomeMessages">
                  <WelcomeMessagesTab
                    currentUser={currentUser}
                    refreshKey={refreshKey}
                    onPreviewChange={handlePreviewChange}
                  />
                </TabPanel>
                <TabPanel value="colorRules">
                  <ColorRulesTab
                    currentUser={currentUser}
                    refreshKey={refreshKey}
                    onPreviewChange={handlePreviewChange}
                  />
                </TabPanel>
                <TabPanel value="locationIcons">
                  <LocationIconsTab
                    currentUser={currentUser}
                    refreshKey={refreshKey}
                    onPreviewChange={handlePreviewChange}
                  />
                </TabPanel>
                <TabPanel value="sneaky">
                  <SneakyTab currentUser={currentUser} refreshKey={refreshKey} />
                </TabPanel>
                <TabPanel value="sonos">
                  <SonosTab currentUser={currentUser} />
                </TabPanel>
              </Suspense>
            </ErrorBoundary>
          </div>

          {/* Divider draggable */}
          {/* Divider config ↔ aperçu TV */}
          <div
            className="display-split-divider"
            onMouseDown={handleDividerMouseDown('preview')}
            title="Glisser pour redimensionner"
          />

          <Suspense fallback={<div className="tv-preview-loading">Chargement aperçu…</div>}>
            <TVPreviewPanel
              previewOverrides={previewOverrides}
              refreshKey={refreshKey}
              style={{ width: previewWidth }}
            />
          </Suspense>
        </div>
      </Tabs>
    </div>
  );
}

export default memo(DisplayDashboardPanel);
