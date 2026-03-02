// ═══════════════════════════════════════════════════════════════
// DisplayDashboardPanel — Panneau principal du module Dashboard
// Sous-module de Communication → onglet « Dashboard Écrans »
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, lazy, Suspense, memo } from 'react';
import { Monitor, RefreshCw, Plus,
         Palette, MessageCircle, Tag, Film, Camera, Music } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
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

// Lazy modals
const ScreenFormModal = lazy(() => import('./ScreenFormModal'));

const CONFIG_TABS = [
  { id: 'screens', label: 'Écrans', icon: Monitor },
  { id: 'appearance', label: 'Apparence', icon: Palette },
  { id: 'welcomeMessages', label: 'Messages TV', icon: MessageCircle },
  { id: 'colorRules', label: 'Couleurs', icon: Tag },
  { id: 'locationIcons', label: 'Icônes lieu', icon: Film },
  { id: 'sneaky', label: 'Photo furtive', icon: Camera },
  { id: 'sonos', label: 'Sonos', icon: Music },
];

// Écrans n'a pas de preview split, les autres oui
const TV_PREVIEW_TAB_IDS = new Set(['appearance', 'welcomeMessages', 'colorRules', 'locationIcons', 'sneaky', 'sonos']);

function DisplayDashboardPanel({ currentUser }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('screens');
  const [stats, setStats] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [previewOverrides, setPreviewOverrides] = useState({});

  const isTVTab = TV_PREVIEW_TAB_IDS.has(activeTab);

  const handlePreviewChange = useCallback((overrides) => {
    setPreviewOverrides(prev => ({ ...prev, ...overrides }));
  }, []);

  // Réinitialiser les overrides à chaque changement d'onglet
  useEffect(() => {
    setPreviewOverrides({});
  }, [activeTab]);

  // Modals
  const [showScreenModal, setShowScreenModal] = useState(false);
  const [editingScreen, setEditingScreen] = useState(null);

  // Charger les stats
  const loadStats = useCallback(async () => {
    try {
      const data = await api.getDisplayStats();
      setStats(data);
    } catch {
      // Stats optionnelles
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats, refreshKey]);

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // Handlers modals
  const handleCreateScreen = useCallback(() => {
    setEditingScreen(null);
    setShowScreenModal(true);
  }, []);
  const handleEditScreen = useCallback((screen) => {
    setEditingScreen(screen);
    setShowScreenModal(true);
  }, []);
  const handleScreenSaved = useCallback(() => {
    setShowScreenModal(false);
    setEditingScreen(null);
    handleRefresh();
    toast.success('Écran enregistré');
  }, [handleRefresh, toast]);

  // Bouton d'action par onglet
  const getActionButton = () => {
    if (activeTab === 'screens' && currentUser?.isAdmin) {
      return (
        <button className="btn-primary-sm" onClick={handleCreateScreen}>
          <Plus size={14} /> Nouvel écran
        </button>
      );
    }
    return null;
  };

  return (
    <div className="display-dashboard">
      {/* Header actions */}
      <div className="display-dashboard-header">
        <div className="display-stats-row">
          {stats && (
            <span className="display-stat">
              <Monitor size={14} />
              {stats.screens?.online || 0}/{stats.screens?.total || 0} écrans
            </span>
          )}
        </div>
        <div className="display-header-actions">
          {getActionButton()}
          <button className="btn-icon-sm" onClick={handleRefresh} title="Rafraîchir">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Sous-onglets Configuration TV */}
      <div className="display-tabs-container">
        <div className="display-tabs-group">
          <span className="display-tabs-label">Configuration TV</span>
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
      </div>

      {/* Corps — split layout si onglet TV actif */}
      <div className={`display-body${isTVTab ? ' split' : ''}`}>
      <div className="display-tab-content">
        <Suspense fallback={<div className="display-loading">Chargement…</div>}>
          {activeTab === 'screens' && (
            <ScreensTab
              currentUser={currentUser}
              refreshKey={refreshKey}
              onEdit={handleEditScreen}
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

        {isTVTab && (
          <Suspense fallback={<div className="tv-preview-loading">Chargement aperçu…</div>}>
            <TVPreviewPanel previewOverrides={previewOverrides} refreshKey={refreshKey} />
          </Suspense>
        )}
      </div>

      {/* Modals */}
      {showScreenModal && (
        <Suspense fallback={null}>
          <ScreenFormModal
            screen={editingScreen}
            onSave={handleScreenSaved}
            onClose={() => { setShowScreenModal(false); setEditingScreen(null); }}
          />
        </Suspense>
      )}
    </div>
  );
}

export default memo(DisplayDashboardPanel);
