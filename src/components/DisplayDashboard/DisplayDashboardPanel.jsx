// ═══════════════════════════════════════════════════════════════
// DisplayDashboardPanel — Panneau principal du module Dashboard
// Sous-module de Communication → onglet « Dashboard Écrans »
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, lazy, Suspense, memo } from 'react';
import { Monitor, List, Image, MessageSquare, Layout, Activity, RefreshCw, Plus } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import './DisplayDashboardPanel.css';

// Lazy sub-tabs
const ScreensTab = lazy(() => import('./ScreensTab'));
const PlaylistsTab = lazy(() => import('./PlaylistsTab'));
const MediaTab = lazy(() => import('./MediaTab'));
const MessagesTab = lazy(() => import('./MessagesTab'));
const TemplatesTab = lazy(() => import('./TemplatesTab'));
const LogsTab = lazy(() => import('./LogsTab'));

// Lazy modals
const ScreenFormModal = lazy(() => import('./ScreenFormModal'));
const PlaylistFormModal = lazy(() => import('./PlaylistFormModal'));
const MediaUploadModal = lazy(() => import('./MediaUploadModal'));
const MessageFormModal = lazy(() => import('./MessageFormModal'));
const TemplateFormModal = lazy(() => import('./TemplateFormModal'));

const SUB_TABS = [
  { id: 'screens', label: 'Écrans', icon: Monitor },
  { id: 'playlists', label: 'Playlists', icon: List },
  { id: 'media', label: 'Médias', icon: Image },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'templates', label: 'Templates', icon: Layout },
  { id: 'logs', label: 'Logs', icon: Activity },
];

function DisplayDashboardPanel({ currentUser }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('screens');
  const [stats, setStats] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modals
  const [showScreenModal, setShowScreenModal] = useState(false);
  const [editingScreen, setEditingScreen] = useState(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

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

  const handleCreatePlaylist = useCallback(() => {
    setEditingPlaylist(null);
    setShowPlaylistModal(true);
  }, []);
  const handleEditPlaylist = useCallback((playlist) => {
    setEditingPlaylist(playlist);
    setShowPlaylistModal(true);
  }, []);
  const handlePlaylistSaved = useCallback(() => {
    setShowPlaylistModal(false);
    setEditingPlaylist(null);
    handleRefresh();
    toast.success('Playlist enregistrée');
  }, [handleRefresh, toast]);

  const handleUploadMedia = useCallback(() => {
    setShowMediaModal(true);
  }, []);
  const handleMediaUploaded = useCallback(() => {
    setShowMediaModal(false);
    handleRefresh();
    toast.success('Média uploadé');
  }, [handleRefresh, toast]);

  const handleCreateMessage = useCallback(() => {
    setEditingMessage(null);
    setShowMessageModal(true);
  }, []);
  const handleEditMessage = useCallback((msg) => {
    setEditingMessage(msg);
    setShowMessageModal(true);
  }, []);
  const handleMessageSaved = useCallback(() => {
    setShowMessageModal(false);
    setEditingMessage(null);
    handleRefresh();
    toast.success('Message enregistré');
  }, [handleRefresh, toast]);

  const handleCreateTemplate = useCallback(() => {
    setEditingTemplate(null);
    setShowTemplateModal(true);
  }, []);
  const handleEditTemplate = useCallback((tpl) => {
    setEditingTemplate(tpl);
    setShowTemplateModal(true);
  }, []);
  const handleTemplateSaved = useCallback(() => {
    setShowTemplateModal(false);
    setEditingTemplate(null);
    handleRefresh();
    toast.success('Template enregistré');
  }, [handleRefresh, toast]);

  // Bouton d'action par onglet
  const getActionButton = () => {
    const isAdmin = currentUser?.isAdmin;
    switch (activeTab) {
      case 'screens':
        return isAdmin ? (
          <button className="btn-primary-sm" onClick={handleCreateScreen}>
            <Plus size={14} /> Nouvel écran
          </button>
        ) : null;
      case 'playlists':
        return (
          <button className="btn-primary-sm" onClick={handleCreatePlaylist}>
            <Plus size={14} /> Nouvelle playlist
          </button>
        );
      case 'media':
        return (
          <button className="btn-primary-sm" onClick={handleUploadMedia}>
            <Plus size={14} /> Upload média
          </button>
        );
      case 'messages':
        return (
          <button className="btn-primary-sm" onClick={handleCreateMessage}>
            <Plus size={14} /> Nouveau message
          </button>
        );
      case 'templates':
        return isAdmin ? (
          <button className="btn-primary-sm" onClick={handleCreateTemplate}>
            <Plus size={14} /> Nouveau template
          </button>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="display-dashboard">
      {/* Header stats */}
      <div className="display-dashboard-header">
        <div className="display-stats-row">
          {stats && (
            <>
              <span className="display-stat">
                <Monitor size={14} />
                {stats.screens?.online || 0}/{stats.screens?.total || 0} écrans
              </span>
              <span className="display-stat">
                <List size={14} />
                {stats.playlists?.total || 0} playlists
              </span>
              <span className="display-stat">
                <Image size={14} />
                {stats.media?.total || 0} médias
              </span>
              <span className="display-stat">
                <MessageSquare size={14} />
                {stats.messages?.active || 0} messages actifs
              </span>
            </>
          )}
        </div>
        <div className="display-header-actions">
          {getActionButton()}
          <button className="btn-icon-sm" onClick={handleRefresh} title="Rafraîchir">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Sous-onglets */}
      <div className="display-subtabs">
        {SUB_TABS.map(tab => {
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

      {/* Contenu */}
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
          {activeTab === 'playlists' && (
            <PlaylistsTab
              currentUser={currentUser}
              refreshKey={refreshKey}
              onEdit={handleEditPlaylist}
              onRefresh={handleRefresh}
            />
          )}
          {activeTab === 'media' && (
            <MediaTab
              currentUser={currentUser}
              refreshKey={refreshKey}
              onUpload={handleUploadMedia}
              onRefresh={handleRefresh}
            />
          )}
          {activeTab === 'messages' && (
            <MessagesTab
              currentUser={currentUser}
              refreshKey={refreshKey}
              onEdit={handleEditMessage}
              onRefresh={handleRefresh}
            />
          )}
          {activeTab === 'templates' && (
            <TemplatesTab
              currentUser={currentUser}
              refreshKey={refreshKey}
              onEdit={handleEditTemplate}
              onRefresh={handleRefresh}
            />
          )}
          {activeTab === 'logs' && (
            <LogsTab refreshKey={refreshKey} />
          )}
        </Suspense>
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
      {showPlaylistModal && (
        <Suspense fallback={null}>
          <PlaylistFormModal
            playlist={editingPlaylist}
            onSave={handlePlaylistSaved}
            onClose={() => { setShowPlaylistModal(false); setEditingPlaylist(null); }}
          />
        </Suspense>
      )}
      {showMediaModal && (
        <Suspense fallback={null}>
          <MediaUploadModal
            onSave={handleMediaUploaded}
            onClose={() => setShowMediaModal(false)}
          />
        </Suspense>
      )}
      {showMessageModal && (
        <Suspense fallback={null}>
          <MessageFormModal
            message={editingMessage}
            onSave={handleMessageSaved}
            onClose={() => { setShowMessageModal(false); setEditingMessage(null); }}
          />
        </Suspense>
      )}
      {showTemplateModal && (
        <Suspense fallback={null}>
          <TemplateFormModal
            template={editingTemplate}
            onSave={handleTemplateSaved}
            onClose={() => { setShowTemplateModal(false); setEditingTemplate(null); }}
          />
        </Suspense>
      )}
    </div>
  );
}

export default memo(DisplayDashboardPanel);
