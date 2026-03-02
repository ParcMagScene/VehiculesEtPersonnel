// ═══════════════════════════════════════════════════════════════
// DisplayDashboardPanel — Panneau principal du module Dashboard
// Sous-module de Communication → onglet « Dashboard Écrans »
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef, lazy, Suspense, memo } from 'react';
import { Monitor, Palette, MessageCircle, Tag, Film, Camera, Music } from 'lucide-react';
import './DisplayDashboardPanel.css';

// Lazy sub-tabs
const ScreensTab = lazy(() => import('./ScreensTab'));
const AppearanceTab = lazy(() => import('./AppearanceTab'));
const WelcomeMessagesTab = lazy(() => import('./WelcomeMessagesTab'));
const ColorRulesTab = lazy(() => import('./ColorRulesTab'));
const LocationIconsTab = lazy(() => import('./LocationIconsTab'));
const SneakyTab = lazy(() => import('./SneakyTab'));
const SonosTab = lazy(() => import('./SonosTab'));
const TVPreviewPanel = lazy(() => import('./TVPreviewPanel'));

const CONFIG_TABS = [
  { id: 'screens', label: 'Écrans', icon: Monitor },
  { id: 'appearance', label: 'Apparence', icon: Palette },
  { id: 'welcomeMessages', label: 'Messages TV', icon: MessageCircle },
  { id: 'colorRules', label: 'Couleurs', icon: Tag },
  { id: 'locationIcons', label: 'Icônes tâches', icon: Film },
  { id: 'sneaky', label: 'Photo furtive', icon: Camera },
  { id: 'sonos', label: 'Sonos', icon: Music },
];

function DisplayDashboardPanel({ currentUser }) {
  const [activeTab, setActiveTab] = useState('screens');
  const [refreshKey, setRefreshKey] = useState(0);
  const [previewOverrides, setPreviewOverrides] = useState({});
  const [previewWidth, setPreviewWidth] = useState(() => {
    const saved = localStorage.getItem('ddp-preview-width');
    return saved ? Number(saved) : 360;
  });
  const isDragging = useRef(false);
  const bodyRef = useRef(null);

  // Drag handler for the resizable divider
  const handleDividerMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev) => {
      if (!isDragging.current || !bodyRef.current) return;
      const rect = bodyRef.current.getBoundingClientRect();
      const newWidth = Math.round(rect.right - ev.clientX);
      const clamped = Math.max(200, Math.min(newWidth, rect.width - 300));
      setPreviewWidth(clamped);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setPreviewWidth(w => { localStorage.setItem('ddp-preview-width', w); return w; });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const handlePreviewChange = useCallback((overrides) => {
    setPreviewOverrides(prev => ({ ...prev, ...overrides }));
  }, []);

  // Réinitialiser les overrides à chaque changement d'onglet
  useEffect(() => {
    setPreviewOverrides({});
  }, [activeTab]);

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <div className="display-dashboard">
      {/* Sous-onglets Configuration TV */}
      <div className="display-tabs-container">
        <div className="display-subtabs">
          {CONFIG_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`display-subtab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Corps — split layout avec moniteurs Direct/Preview à droite */}
      <div className="display-body split" ref={bodyRef}>
      <div className="display-tab-content">
        <Suspense fallback={<div className="display-loading">Chargement…</div>}>
          {activeTab === 'screens' && (
            <ScreensTab
              currentUser={currentUser}
              refreshKey={refreshKey}
              onRefresh={handleRefresh}
            />
          )}
          {activeTab === 'appearance' && (
            <AppearanceTab currentUser={currentUser} refreshKey={refreshKey} onPreviewChange={handlePreviewChange} />
          )}
          {activeTab === 'welcomeMessages' && (
            <WelcomeMessagesTab currentUser={currentUser} refreshKey={refreshKey} onPreviewChange={handlePreviewChange} />
          )}
          {activeTab === 'colorRules' && (
            <ColorRulesTab currentUser={currentUser} refreshKey={refreshKey} onPreviewChange={handlePreviewChange} />
          )}
          {activeTab === 'locationIcons' && (
            <LocationIconsTab currentUser={currentUser} refreshKey={refreshKey} onPreviewChange={handlePreviewChange} />
          )}
          {activeTab === 'sneaky' && (
            <SneakyTab currentUser={currentUser} refreshKey={refreshKey} />
          )}
          {activeTab === 'sonos' && (
            <SonosTab currentUser={currentUser} refreshKey={refreshKey} />
          )}
        </Suspense>
      </div>

        {/* Divider draggable */}
        <div
          className="display-split-divider"
          onMouseDown={handleDividerMouseDown}
          title="Glisser pour redimensionner"
        />

        <Suspense fallback={<div className="tv-preview-loading">Chargement aperçu…</div>}>
          <TVPreviewPanel previewOverrides={previewOverrides} refreshKey={refreshKey} style={{ width: previewWidth }} />
        </Suspense>
      </div>

    </div>
  );
}

export default memo(DisplayDashboardPanel);
