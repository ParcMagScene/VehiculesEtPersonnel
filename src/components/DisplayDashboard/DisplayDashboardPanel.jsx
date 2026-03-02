// ═══════════════════════════════════════════════════════════════
// DisplayDashboardPanel — Panneau principal du module Dashboard
// Sous-module de Communication → onglet « Dashboard Écrans »
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, lazy, Suspense, memo } from 'react';
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
  { id: 'locationIcons', label: 'Icônes lieu', icon: Film },
  { id: 'sneaky', label: 'Photo furtive', icon: Camera },
  { id: 'sonos', label: 'Sonos', icon: Music },
];

function DisplayDashboardPanel({ currentUser }) {
  const [activeTab, setActiveTab] = useState('screens');
  const [refreshKey, setRefreshKey] = useState(0);
  const [previewOverrides, setPreviewOverrides] = useState({});

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
      <div className="display-body split">
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

        <Suspense fallback={<div className="tv-preview-loading">Chargement aperçu…</div>}>
          <TVPreviewPanel previewOverrides={previewOverrides} refreshKey={refreshKey} />
        </Suspense>
      </div>

    </div>
  );
}

export default memo(DisplayDashboardPanel);
