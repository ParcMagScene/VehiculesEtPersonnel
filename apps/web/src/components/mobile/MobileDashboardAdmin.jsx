import './MobileDashboardAdmin.css';

import {
  ArrowLeft,
  Briefcase,
  Camera,
  CheckCircle,
  Circle,
  Clock,
  Eye,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, ProgressBar, Select, Spinner } from '@/design-system';

import { STATUS } from '../../constants';
import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import { useRefreshSubscription } from '../../hooks/useRefreshSubscription';
import useSwipeAction from '../../hooks/useSwipeAction';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';
import PullToRefreshIndicator from './PullToRefreshIndicator';
import SwipeableRow from './SwipeableRow';

const TASK_SECTIONS = {
  rdv: { label: 'RDV', emoji: '📅', color: STATUS_COLORS.info },
  evenements: { label: 'Événements', emoji: '📌', color: '#64748b' },
  taches_prioritaires: { label: 'Prioritaires', emoji: '🔴', color: STATUS_COLORS.danger },
  courses: { label: 'Courses', emoji: '🚗', color: STATUS_COLORS.warning },
  prep_locations: { label: 'Prép. Locations', emoji: '📦', color: ACCENT_COLORS.violet },
  prep_prestations: { label: 'Prép. Prestations', emoji: '🎤', color: ACCENT_COLORS.pink },
  prep_ventes: { label: 'Prép. Ventes', emoji: '🏷️', color: '#14b8a6' },
  prep_installations: { label: 'Prép. Installations', emoji: '⚙️', color: '#8b5cf6' },
  prep_tournees: { label: 'Prép. Tournées', emoji: '🚐', color: '#ec4899' },
  chargement: { label: 'Chargement', emoji: '📦', color: ACCENT_COLORS.indigo },
  depart: { label: 'Départ', emoji: '🚀', color: '#0ea5e9' },
  enlevement: { label: 'Enlèvement', emoji: '📦', color: '#f59e0b' },
  installation: { label: 'Installation', emoji: '🛠️', color: STATUS_COLORS.success },
  montage: { label: 'Montage', emoji: '🔩', color: '#059669' },
  demontage: { label: 'Démontage', emoji: '🔧', color: STATUS_COLORS.warningDark },
  intervention: { label: 'Intervention', emoji: '🛠️', color: '#0d9488' },
  retour: { label: 'Retour', emoji: '↩️', color: '#8b5cf6' },
  recuperation: { label: 'Récupération', emoji: '📥', color: '#ef4444' },
  depot: { label: 'Dépôt', emoji: '🏠', color: '#6366f1' },
  taches_secondaires: { label: 'Secondaires', emoji: '🟡', color: ACCENT_COLORS.amber },
  manual: { label: 'Autres', emoji: '📋', color: STATUS_COLORS.neutralSoft },
};

const SNEAKY_DURATION_OPTIONS = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '1 heure' },
  { value: '240', label: '4 heures' },
  { value: 'endOfDay', label: 'Fin de journée' },
  { value: 'endOfWeek', label: 'Fin de semaine' },
];

// Section "Photo furtive" — replique la fonctionnalite desktop (SneakyTab.jsx)
// avec picker natif mobile (capture="environment" pour l'appareil photo).
function SneakyPhotoSection() {
  const toast = useToast();
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [status, setStatus] = useState({ active: false });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [duration, setDuration] = useState('60');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDisplaySneakyPhotoStatus();
      setStatus(data || { active: false });
    } catch {
      // Silencieux : le composant reste utilisable pour envoyer une nouvelle photo.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Libere l'objectURL de preview quand il change/le composant se demonte.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    // Reset la valeur pour permettre de reselectionner le meme fichier plus tard
    // (iOS Safari / Chrome mobile ne re-firent pas onChange si input.value inchange).
    e.target.value = '';
    if (!file) return;

    // Cote backend : DISPLAY_IMAGE_MIMES = jpeg / png / gif / webp.
    // HEIC (iPhone) et autres formats sont rejetes silencieusement, on previent l'utilisateur ici.
    const okType =
      /^image\/(jpeg|png|gif|webp)$/i.test(file.type) ||
      (!file.type && /\.(jpe?g|png|gif|webp)$/i.test(file.name || ''));
    if (!okType) {
      toast.error(
        `Format non supporté (${file.type || 'inconnu'}). Réglez votre iPhone sur JPEG (Réglages > Appareil photo > Formats > Plus compatible).`,
      );
      return;
    }

    // Backend refuse > 10 Mo (limite multer). Avertit l'utilisateur avant l'upload.
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(1);
      toast.error(`Photo trop grande (${sizeMb} Mo). Maximum 10 Mo.`);
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleClearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', selectedFile);
      formData.append('duration', duration);
      await api.uploadDisplaySneakyPhoto(formData);
      refreshBus.publish('display');
      toast.success('Photo furtive envoyée sur la TV');
      handleClearSelection();
      await loadStatus();
    } catch (e) {
      console.error('Erreur upload photo furtive:', e);
      // Detail visible (utile depuis mobile ou l'inspecteur ne s'ouvre pas facilement).
      const msg = e?.message || e?.error || 'erreur reseau';
      toast.error(`Envoi impossible : ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDisable = async () => {
    try {
      await api.deleteDisplaySneakyPhoto();
      refreshBus.publish('display');
      toast.success('Photo furtive désactivée');
      setStatus({ active: false });
    } catch {
      toast.error('Impossible de désactiver la photo');
    }
  };

  return (
    <div className="mda-sneaky-section">
      <div className="mda-section-title">
        <span>📸 Photo furtive</span>
        {status.active && <span className="mda-sneaky-badge">Active</span>}
      </div>

      {loading ? (
        <div className="mda-empty mda-empty-small">
          <Spinner size={20} />
        </div>
      ) : status.active ? (
        <div className="mda-sneaky-active-block">
          {status.path && (
            <div className="mda-sneaky-preview">
              <img src={`${status.path}?t=${Date.now()}`} alt="Aperçu furtif actif" />
            </div>
          )}
          <div className="mda-sneaky-expires">
            <Clock size={12} /> Expire :{' '}
            {status.expiresAt ? new Date(status.expiresAt).toLocaleString('fr-FR') : '—'}
          </div>
          <Button variant="danger" size="sm" onClick={handleDisable} className="mda-sneaky-off-btn">
            <Trash2 size={14} /> Désactiver
          </Button>
        </div>
      ) : (
        <div className="mda-sneaky-upload-block">
          {/* Inputs caches — declenches par les boutons ci-dessous.
              display:none casse le change event sur certains iOS Safari + PWA :
              on utilise donc visibility:hidden + position absolue hors ecran. */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/*"
            onChange={handleFileSelect}
            className="mda-sneaky-file-input"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="mda-sneaky-file-input"
          />

          {previewUrl ? (
            <>
              <div className="mda-sneaky-preview">
                <img src={previewUrl} alt="Aperçu" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  className="mda-sneaky-clear-btn"
                  aria-label="Retirer"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
              <div className="mda-sneaky-duration">
                <label htmlFor="mda-sneaky-duration">Durée d'affichage</label>
                <Select
                  id="mda-sneaky-duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  {SNEAKY_DURATION_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                variant="primary"
                onClick={handleUpload}
                disabled={uploading}
                className="mda-sneaky-send-btn"
              >
                {uploading ? <Spinner size={14} /> : <Upload size={14} />} Envoyer sur la TV
              </Button>
            </>
          ) : (
            <div className="mda-sneaky-pick-row">
              <Button
                variant="secondary"
                onClick={() => cameraInputRef.current?.click()}
                className="mda-sneaky-pick-btn"
              >
                <Camera size={18} /> Appareil photo
              </Button>
              <Button
                variant="secondary"
                onClick={() => galleryInputRef.current?.click()}
                className="mda-sneaky-pick-btn"
              >
                <ImageIcon size={18} /> Galerie
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * MobileDashboardAdmin — Dashboard admin mobile.
 * Tâches du jour + photo furtive + gestion des messages display.
 */
function MobileDashboardAdmin({ currentUser: _currentUser, onBack }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);

  // Tasks state
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [updatingTask, setUpdatingTask] = useState(null);
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();

  const today = new Date().toISOString().slice(0, 10);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.request('/display/messages');
      setEntries(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Erreur chargement entrées dashboard:', e);
    }
    setLoading(false);
  }, []);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const data = await api.getTasks({ date: today });
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Erreur chargement tâches:', e);
    }
    setLoadingTasks(false);
  }, [today]);

  useEffect(() => {
    loadEntries();
    loadTasks();
  }, [loadEntries, loadTasks]);

  // Auto-refresh tasks quand le planning change ailleurs.
  useRefreshSubscription('planning', loadTasks);

  const handleRefreshAll = useCallback(() => {
    loadEntries();
    loadTasks();
  }, [loadEntries, loadTasks]);

  const { containerProps: ptrProps, indicatorNode: ptrIndicator } =
    usePullToRefresh(handleRefreshAll);
  const { getSwipeProps, swipeState, resetSwipe } = useSwipeAction();

  const handleValidate = async (entry) => {
    setActionId(entry.id);
    try {
      const newActive = entry.active ? 0 : 1;
      await api.request(`/display/messages/${entry.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...entry, active: newActive }),
      });
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, active: newActive } : e)));
    } catch (e) {
      console.error('Erreur validation entrée:', e);
    }
    setActionId(null);
  };

  const handleDelete = (entry) => {
    confirm({
      title: 'Supprimer l’entrée',
      message: `Supprimer "${entry.title || entry.content?.slice(0, 30)}" ?`,
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        setActionId(entry.id);
        try {
          await api.request(`/display/messages/${entry.id}`, { method: 'DELETE' });
          setEntries((prev) => prev.filter((e) => e.id !== entry.id));
          resetSwipe();
        } catch (e) {
          console.error('Erreur suppression entrée:', e);
        }
        setActionId(null);
      },
    });
  };

  const handleToggleTask = async (task) => {
    const newStatus = task.status === STATUS.DONE ? 'pending' : 'done';
    setUpdatingTask(task.id);
    try {
      await api.updateTask(task.id, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
      refreshBus.publish('planning');
    } catch (e) {
      console.error('Erreur mise à jour tâche:', e);
    }
    setUpdatingTask(null);
  };

  // Task stats
  const doneCount = tasks.filter((t) => t.status === STATUS.DONE).length;
  const totalTasks = tasks.length;

  // Group tasks by section (fallback to 'manual' if section not in TASK_SECTIONS)
  const grouped = {};
  tasks.forEach((t) => {
    const sec = t.section && TASK_SECTIONS[t.section] ? t.section : 'manual';
    if (!grouped[sec]) grouped[sec] = [];
    grouped[sec].push(t);
  });
  const activeSections = Object.keys(TASK_SECTIONS).filter((k) => grouped[k]?.length > 0);

  return (
    <div className="mobile-dash-admin" {...ptrProps}>
      <PullToRefreshIndicator indicator={ptrIndicator} />

      {/* Header with back button */}
      <div className="mda-header">
        <Button variant="ghost" className="mobile-back-btn" onClick={onBack} aria-label="Retour">
          <ArrowLeft size={20} />
        </Button>
        <h2>Dashboard</h2>
        <Button
          variant="ghost"
          className="mda-refresh"
          onClick={handleRefreshAll}
          disabled={loading || loadingTasks}
          aria-label="Actualiser"
        >
          <RefreshCw size={18} className={loading || loadingTasks ? 'spin' : ''} />
        </Button>
      </div>

      {/* ═══ TÂCHES DU JOUR ═══ */}
      <div className="mda-tasks-section">
        <div className="mda-section-title">
          <span>📋 Tâches du jour</span>
          <span className="mda-task-progress">
            {doneCount}/{totalTasks}
          </span>
        </div>
        {totalTasks > 0 && (
          <ProgressBar
            value={doneCount}
            max={totalTasks}
            size="sm"
            color="success"
            className="mda-task-progressbar"
          />
        )}
        {loadingTasks && tasks.length === 0 ? (
          <div className="mda-empty">
            <Spinner size={24} />
            <p>Chargement…</p>
          </div>
        ) : totalTasks === 0 ? (
          <div className="mda-empty mda-empty-small">
            <CheckCircle size={24} />
            <p>Aucune tâche aujourd'hui</p>
          </div>
        ) : (
          <div className="mda-tasks-list">
            {activeSections.map((sectionKey) => {
              const info = TASK_SECTIONS[sectionKey] || TASK_SECTIONS.manual;
              const sectionTasks = grouped[sectionKey];

              return (
                <div key={sectionKey} className="mda-task-group">
                  <div className="mda-task-group-header" style={{ borderLeftColor: info.color }}>
                    <span>
                      {info.emoji} {info.label}
                    </span>
                    <span className="mda-task-group-count" style={{ color: info.color }}>
                      {sectionTasks.filter((t) => t.status === STATUS.DONE).length}/
                      {sectionTasks.length}
                    </span>
                  </div>
                  {sectionTasks.map((task) => {
                    const isDone = task.status === STATUS.DONE;
                    const isUpdating = updatingTask === task.id;

                    return (
                      <SwipeableRow
                        key={task.id}
                        itemId={task.id}
                        swipeState={swipeState}
                        getSwipeProps={getSwipeProps}
                        onReset={resetSwipe}
                        leftAction={{
                          label: isDone ? 'À faire' : 'Valider',
                          icon: isDone ? '↩️' : '✅',
                          color: isDone ? STATUS_COLORS.warning : STATUS_COLORS.success,
                          onClick: () => handleToggleTask(task),
                        }}
                      >
                        <div
                          className={`mda-task-card ${isDone ? 'done' : ''} ${isUpdating ? 'updating' : ''}`}
                        >
                          <Button
                            type="button"
                            className={`mda-task-check ${isDone ? 'checked' : ''}`}
                            onClick={() => handleToggleTask(task)}
                            disabled={isUpdating}
                          >
                            {isDone ? <CheckCircle size={20} /> : <Circle size={20} />}
                          </Button>
                          <div className="mda-task-content">
                            <span className={`mda-task-title ${isDone ? 'done' : ''}`}>
                              {task.title || '—'}
                            </span>
                            <div className="mda-task-meta">
                              {task.time && (
                                <span>
                                  <Clock size={11} /> {task.time}
                                </span>
                              )}
                              {task.affaireNum && (
                                <span>
                                  <Briefcase size={11} /> {task.affaireNum}
                                </span>
                              )}
                              {(task.personFirstName || task.person_first_name) && (
                                <span>
                                  <User size={11} />{' '}
                                  {task.personFirstName || task.person_first_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </SwipeableRow>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ PHOTO FURTIVE ═══ */}
      <SneakyPhotoSection />

      {/* ═══ MESSAGES DISPLAY ═══ */}
      <div className="mda-messages-section">
        <div className="mda-section-title">
          <span>📺 Messages display</span>
          <span className="mda-count">{entries.length}</span>
        </div>

        {/* Liste */}
        {loading && entries.length === 0 ? (
          <div className="mda-empty">
            <Spinner size={32} />
            <p>Chargement…</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="mda-empty">
            <Eye size={40} />
            <p>Aucune entrée</p>
          </div>
        ) : (
          <div className="mda-list">
            {entries.map((entry) => {
              const isActive = !!entry.active;
              const isProcessing = actionId === entry.id;

              return (
                <SwipeableRow
                  key={entry.id}
                  itemId={entry.id}
                  swipeState={swipeState}
                  getSwipeProps={getSwipeProps}
                  onReset={resetSwipe}
                  leftAction={{
                    label: isActive ? 'Désactiver' : 'Activer',
                    icon: '✅',
                    color: isActive ? 'var(--theme-warning)' : 'var(--theme-success)',
                    onClick: () => handleValidate(entry),
                  }}
                  rightAction={{
                    label: 'Supprimer',
                    icon: '🗑️',
                    color: 'var(--theme-danger)',
                    onClick: () => handleDelete(entry),
                  }}
                >
                  <div
                    className={`mda-card ${isActive ? 'active' : 'inactive'} ${isProcessing ? 'processing' : ''}`}
                  >
                    <div className="mda-card-status">
                      {isActive ? (
                        <CheckCircle size={18} className="mda-icon-active" />
                      ) : (
                        <Eye size={18} className="mda-icon-inactive" />
                      )}
                    </div>
                    <div className="mda-card-content">
                      <span className="mda-card-title">
                        {entry.title || entry.content?.slice(0, 50) || '(sans titre)'}
                      </span>
                      {entry.content && entry.title && (
                        <span className="mda-card-desc">{entry.content.slice(0, 80)}</span>
                      )}
                      <div className="mda-card-meta">
                        {entry.type && <span className="mda-card-type">{entry.type}</span>}
                        {entry.priority && (
                          <span className="mda-card-priority">P{entry.priority}</span>
                        )}
                      </div>
                    </div>
                    <div className="mda-card-actions">
                      <Button
                        variant="ghost"
                        className="mda-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleValidate(entry);
                        }}
                        disabled={isProcessing}
                        aria-label={isActive ? 'Désactiver' : 'Activer'}
                      >
                        <CheckCircle size={18} />
                      </Button>
                      <Button
                        variant="ghost"
                        className="mda-action-btn danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(entry);
                        }}
                        disabled={isProcessing}
                        aria-label="Supprimer"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                </SwipeableRow>
              );
            })}
          </div>
        )}
      </div>
      {ConfirmDialogRenderer}
    </div>
  );
}

export default MobileDashboardAdmin;
