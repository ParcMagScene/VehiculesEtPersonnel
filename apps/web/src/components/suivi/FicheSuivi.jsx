/* ═══════════════════════════════════════════════════════════════
   FicheSuivi — Formulaire journalier d'un personnel
   Grille d'entrées AM/PM avec tâches, temps, commentaires
   ═══════════════════════════════════════════════════════════════ */

import {
  Calendar,
  Check,
  ChevronDown,
  GripVertical,
  Loader2,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import { Fragment, memo, useCallback, useEffect, useRef, useState } from 'react';

import api from '../../utils/api';
import Button from '../ui/Button';

function newEntry(period = 'AM', sortOrder = 0) {
  return {
    _key: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36),
    period,
    task: '',
    time_spent: 0,
    comment: '',
    completed: null,
    task_assignment_id: null,
    recurring_task_id: null,
    sort_order: sortOrder,
  };
}

function FicheSuivi({ sheet, onSave, saving }) {
  const [entries, setEntries] = useState([]);
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);
  const autoSaveTimer = useRef(null);
  // Planning task picker
  const [planningTasks, setPlanningTasks] = useState([]);
  const [showPicker, setShowPicker] = useState(null); // 'AM' | 'PM' | null
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [recurringTasks, setRecurringTasks] = useState([]);
  const [showRecurringForm, setShowRecurringForm] = useState(null); // 'AM' | 'PM' | null
  const [editingRecurringId, setEditingRecurringId] = useState(null); // id ou null
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [recurringError, setRecurringError] = useState('');
  const [recurringForm, setRecurringForm] = useState({
    title: '',
    recurrence: 'daily',
    day_of_week: String(new Date().getDay()),
    day_of_month: String(new Date().getDate()),
    default_time_spent: 0,
    default_comment: '',
    period: 'AM',
  });
  // Postpone state
  const [postponeTarget, setPostponeTarget] = useState(null);
  const [postponeDate, setPostponeDate] = useState('');
  const [postponePeriod, setPostponePeriod] = useState('AM');
  const [postponeSaving, setPostponeSaving] = useState(false);
  const [postponeError, setPostponeError] = useState('');

  useEffect(() => {
    if (sheet) {
      const mapped = (sheet.entries || []).map((e) => ({
        ...e,
        _key:
          e.id ||
          (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)),
      }));
      setEntries(mapped);
      setNotes(sheet.notes || '');
      setDirty(false);
    }
  }, [sheet?.id, sheet?.modified_at]);

  // Fetch unassigned planning tasks for this date
  useEffect(() => {
    if (!sheet?.date) return;
    setLoadingTasks(true);
    api
      .getSuiviPlanningTasks(sheet.date)
      .then((res) => setPlanningTasks(Array.isArray(res) ? res : res.tasks || []))
      .catch(() => setPlanningTasks([]))
      .finally(() => setLoadingTasks(false));
  }, [sheet?.date]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showPicker && !showRecurringForm) return;
    const handleClick = (e) => {
      if (
        !e.target.closest('.fiche-picker-wrapper') &&
        !e.target.closest('.fiche-recurring-wrapper')
      ) {
        setShowPicker(null);
        setShowRecurringForm(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker, showRecurringForm]);

  useEffect(() => {
    if (!sheet?.person_id) return;
    api
      .getSuiviRecurringTasks(sheet.person_id)
      .then((rows) => setRecurringTasks(Array.isArray(rows) ? rows : []))
      .catch(() => setRecurringTasks([]));
  }, [sheet?.person_id]);

  const handlePickPlanningTask = useCallback(
    (task, period) => {
      const entry = {
        _key:
          crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36),
        period,
        task: task.title,
        time_spent: 0,
        comment: task.notes || '',
        completed: null,
        task_assignment_id: task.id,
        recurring_task_id: null,
        sort_order: entries.length,
      };
      setEntries((prev) => [...prev, entry]);
      setPlanningTasks((prev) => prev.filter((t) => t.id !== task.id));
      setDirty(true);
      setShowPicker(null);

      // Affecter automatiquement la tâche au personnel de cette fiche
      if (sheet?.person_id) {
        api
          .updateTask(task.id, { person_id: sheet.person_id })
          .catch((e) => console.error('Erreur affectation tâche:', e));
      }
    },
    [entries.length, sheet?.person_id],
  );

  const handleEntryChange = useCallback((key, field, value) => {
    setEntries((prev) => prev.map((e) => (e._key === key ? { ...e, [field]: value } : e)));
    setDirty(true);
  }, []);

  const handleAddEntry = useCallback((period = 'AM') => {
    setEntries((prev) => [...prev, newEntry(period, prev.length)]);
    setDirty(true);
  }, []);

  const handleRemoveEntry = useCallback((key) => {
    setEntries((prev) => prev.filter((e) => e._key !== key));
    setDirty(true);
  }, []);

  const handleToggleCompleted = useCallback((key) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e._key !== key) return e;
        // Cycle 2 états : null/0(non fait) → 1(fait) → null(non fait)
        const next = e.completed === 1 ? null : 1;
        return { ...e, completed: next };
      }),
    );
    setDirty(true);
  }, []);

  const handleMarkAllDone = useCallback(() => {
    setEntries((prev) => prev.map((e) => ({ ...e, completed: 1 })));
    setDirty(true);
  }, []);

  const handleSave = useCallback(
    (status) => {
      const cleanEntries = entries.map((e, i) => ({
        id: e.id || undefined,
        period: e.period,
        task: e.task,
        time_spent: parseInt(e.time_spent, 10) || 0,
        comment: e.comment || '',
        completed: e.completed === 1 ? 1 : e.completed === 0 ? 0 : null,
        task_assignment_id: e.task_assignment_id || null,
        recurring_task_id: e.recurring_task_id || null,
        sort_order: i,
      }));
      onSave({ status, notes, entries: cleanEntries });
      setDirty(false);
    },
    [entries, notes, onSave],
  );

  const isValidated = false; // La fiche est toujours éditable

  // Auto-save débouncé — sauvegarde 600ms après la dernière modification
  useEffect(() => {
    if (!dirty) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSave('draft');
    }, 600);
    return () => clearTimeout(autoSaveTimer.current);
  }, [entries, notes, dirty, handleSave]);

  const amEntries = entries.filter((e) => e.period === 'AM');
  const pmEntries = entries.filter((e) => e.period === 'PM');
  const TIME_OPTIONS = [
    { value: 0, label: '—' },
    { value: 10, label: '10 min' },
    { value: 15, label: '15 min' },
    { value: 20, label: '20 min' },
    { value: 30, label: '30 min' },
    { value: 40, label: '40 min' },
    { value: 45, label: '45 min' },
    { value: 60, label: '1 h' },
    { value: 90, label: '1 h 30' },
    { value: 120, label: '2 h' },
    { value: 150, label: '2 h 30' },
    { value: 180, label: '3 h' },
    { value: 210, label: '3 h 30' },
    { value: 240, label: '4 h' },
    { value: 300, label: '5 h' },
    { value: 360, label: '6 h' },
    { value: 420, label: '7 h' },
    { value: 480, label: '8 h' },
  ];
  const totalMinutes = entries.reduce((s, e) => s + (parseInt(e.time_spent, 10) || 0), 0);
  const totalTimeLabel =
    totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)}h${totalMinutes % 60 > 0 ? ` ${totalMinutes % 60}min` : ''}`
      : `${totalMinutes} min`;
  const totalDone = entries.filter((e) => e.completed === 1).length;
  const allDone = entries.length > 0 && totalDone === entries.length;
  const dayContext = sheet?.day_context || {};
  const dayAvailabilitiesRaw = Array.isArray(dayContext.availabilities)
    ? dayContext.availabilities
    : [];
  const dayEnterprisePresence = dayAvailabilitiesRaw.filter((a) => a.type === 'entreprise');
  const dayAvailabilities = dayAvailabilitiesRaw.filter((a) => a.type !== 'entreprise');
  const dayMissions = Array.isArray(dayContext.missions) ? dayContext.missions : [];
  const dayPlanningAffairesRaw = Array.isArray(dayContext.planning_affaires)
    ? dayContext.planning_affaires
    : [];
  const entryAffaireNums = new Set(
    entries.map((e) => (e.affaire_num || '').toString().trim().toUpperCase()).filter(Boolean),
  );
  const dayPlanningAffaires = [...dayPlanningAffairesRaw].sort((a, b) => {
    const aNum = (a.affaire_num || '').toString().trim().toUpperCase();
    const bNum = (b.affaire_num || '').toString().trim().toUpperCase();
    const aMaterialized = aNum ? entryAffaireNums.has(aNum) : false;
    const bMaterialized = bNum ? entryAffaireNums.has(bNum) : false;
    if (aMaterialized !== bMaterialized) return aMaterialized ? 1 : -1;
    return (a.affaire_label || a.affaire_num || '').localeCompare(
      b.affaire_label || b.affaire_num || '',
      'fr',
      { sensitivity: 'base' },
    );
  });

  const getAvailabilityStatusLabel = (status) => {
    if (status === 'approved') return 'Approuvé';
    if (status === 'pending') return 'En attente';
    if (status === 'rejected') return 'Refusé';
    return 'Statut inconnu';
  };

  const getAvailabilityStatusClass = (status) => {
    if (status === 'approved') return 'fiche-context-status-approved';
    if (status === 'pending') return 'fiche-context-status-pending';
    if (status === 'rejected') return 'fiche-context-status-rejected';
    return 'fiche-context-status-unknown';
  };

  const getMissionTypeClass = (mission) => {
    const rawType = (mission.affaire_type || mission.affaire || '').toString().toLowerCase();
    if (rawType.includes('prestation')) return 'fiche-mission-type-prestation';
    if (rawType.includes('location')) return 'fiche-mission-type-location';
    if (rawType.includes('vente')) return 'fiche-mission-type-vente';
    if (rawType.includes('installation')) return 'fiche-mission-type-installation';
    return 'fiche-mission-type-autre';
  };

  const getMissionStatusLabel = (status) => {
    if (status === 'confirmed') return 'Confirmée';
    if (status === 'draft') return 'Brouillon';
    if (status === 'cancelled') return 'Annulée';
    return status || 'Statut';
  };

  const getMissionStatusClass = (status) => {
    if (status === 'confirmed') return 'fiche-mission-status-confirmed';
    if (status === 'draft') return 'fiche-mission-status-draft';
    if (status === 'cancelled') return 'fiche-mission-status-cancelled';
    return 'fiche-mission-status-unknown';
  };

  const resetRecurringForm = (defaultPeriod = 'AM') => {
    const now = new Date(sheet?.date ? `${sheet.date}T12:00:00` : Date.now());
    setRecurringForm({
      title: '',
      recurrence: 'daily',
      day_of_week: String(now.getDay()),
      day_of_month: String(now.getDate()),
      default_time_spent: 0,
      default_comment: '',
      period: defaultPeriod,
    });
    setEditingRecurringId(null);
    setRecurringError('');
  };

  const isRecurringDueForSheet = (payload) => {
    if (!sheet?.date) return false;
    const d = new Date(`${sheet.date}T12:00:00`);
    if (Number.isNaN(d.getTime())) return false;
    if (payload.recurrence === 'daily') return true;
    if (payload.recurrence === 'weekly') return d.getDay() === Number(payload.day_of_week);
    if (payload.recurrence === 'monthly') return d.getDate() === Number(payload.day_of_month);
    return false;
  };

  const handleCreateRecurring = async (period) => {
    if (!sheet?.person_id) return;
    if (!recurringForm.title.trim()) {
      setRecurringError('Le titre est requis');
      return;
    }

    setRecurringSaving(true);
    setRecurringError('');
    try {
      const payload = {
        title: recurringForm.title.trim(),
        period: recurringForm.period,
        recurrence: recurringForm.recurrence,
        day_of_week:
          recurringForm.recurrence === 'weekly' ? Number(recurringForm.day_of_week) : null,
        day_of_month:
          recurringForm.recurrence === 'monthly' ? Number(recurringForm.day_of_month) : null,
        default_time_spent: Number(recurringForm.default_time_spent) || 0,
        default_comment: recurringForm.default_comment || '',
      };

      const created = await api.createSuiviRecurringTask(sheet.person_id, payload);
      setRecurringTasks((prev) => [created, ...prev]);

      if (isRecurringDueForSheet(payload)) {
        const entry = {
          _key:
            crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36),
          period,
          task: payload.title,
          time_spent: payload.default_time_spent,
          comment: payload.default_comment,
          completed: null,
          task_assignment_id: null,
          recurring_task_id: created?.id || null,
          sort_order: entries.length,
        };
        setEntries((prev) => [...prev, entry]);
        setDirty(true);
      }

      setShowRecurringForm(null);
      resetRecurringForm();
    } catch (e) {
      setRecurringError(e?.message || 'Erreur lors de la création');
    } finally {
      setRecurringSaving(false);
    }
  };

  const handleDeleteRecurring = async (id) => {
    try {
      await api.deleteSuiviRecurringTask(id);
      setRecurringTasks((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setRecurringError('Suppression impossible');
    }
  };

  const handleStartEditRecurring = (r, period) => {
    setRecurringForm({
      title: r.title,
      recurrence: r.recurrence,
      day_of_week:
        r.day_of_week !== null && r.day_of_week !== undefined ? String(r.day_of_week) : '1',
      day_of_month:
        r.day_of_month !== null && r.day_of_month !== undefined ? String(r.day_of_month) : '1',
      default_time_spent: r.default_time_spent ?? 0,
      default_comment: r.default_comment || '',
      period: r.period || period || 'AM',
    });
    setEditingRecurringId(r.id);
    setRecurringError('');
    setShowRecurringForm(period);
  };

  const handleUpdateRecurring = async () => {
    if (!editingRecurringId) return;
    if (!recurringForm.title.trim()) {
      setRecurringError('Le titre est requis');
      return;
    }
    setRecurringSaving(true);
    setRecurringError('');
    try {
      const payload = {
        title: recurringForm.title.trim(),
        period: recurringForm.period,
        recurrence: recurringForm.recurrence,
        day_of_week:
          recurringForm.recurrence === 'weekly' ? Number(recurringForm.day_of_week) : null,
        day_of_month:
          recurringForm.recurrence === 'monthly' ? Number(recurringForm.day_of_month) : null,
        default_time_spent: Number(recurringForm.default_time_spent) || 0,
        default_comment: recurringForm.default_comment || '',
      };
      const updated = await api.updateSuiviRecurringTask(editingRecurringId, payload);
      setRecurringTasks((prev) => prev.map((r) => (r.id === editingRecurringId ? updated : r)));
      setShowRecurringForm(null);
      resetRecurringForm();
    } catch (e) {
      setRecurringError(e?.message || 'Erreur lors de la mise à jour');
    } finally {
      setRecurringSaving(false);
    }
  };

  const handlePostponeEntry = async () => {
    if (!postponeTarget || !postponeDate) return;
    setPostponeSaving(true);
    setPostponeError('');
    try {
      const result = await api.postponeSuiviEntry(postponeTarget.id, postponeDate, postponePeriod);
      setEntries((prev) =>
        prev.map((e) =>
          e._key === postponeTarget._key
            ? {
                ...e,
                comment:
                  result.updated_comment || `→ Reporté au ${postponeDate} (${postponePeriod})`,
              }
            : e,
        ),
      );
      setPostponeTarget(null);
      setDirty(false);
    } catch (err) {
      setPostponeError(err?.message || 'Erreur lors du report');
    } finally {
      setPostponeSaving(false);
    }
  };

  const formatRecurringLabel = (r) => {
    if (r.recurrence === 'daily') return 'Chaque jour';
    if (r.recurrence === 'weekly') {
      const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      return `Chaque ${days[Number(r.day_of_week)] || '?'}`;
    }
    if (r.recurrence === 'monthly') return `Chaque mois le ${r.day_of_month}`;
    return r.recurrence;
  };

  const renderEntryRow = (entry) => {
    const isPostponing = postponeTarget?._key === entry._key;
    return (
      <Fragment key={entry._key}>
        <tr className={`fiche-row ${entry.completed === 1 ? 'completed' : ''}`}>
          <td className="fiche-col-grip">
            <GripVertical size={14} className="grip-icon" />
          </td>
          <td className="fiche-col-task">
            <input
              type="text"
              value={entry.task}
              onChange={(e) => handleEntryChange(entry._key, 'task', e.target.value)}
              placeholder="Description de la tâche…"
              className="fiche-input fiche-input-task"
              disabled={isValidated}
            />
            {entry.task_assignment_id && (
              <span className="fiche-tag-planned" title="Tâche planifiée">
                📋
              </span>
            )}
          </td>
          <td className="fiche-col-time">
            <select
              value={parseInt(entry.time_spent, 10) || 0}
              onChange={(e) => handleEntryChange(entry._key, 'time_spent', Number(e.target.value))}
              className="fiche-input fiche-input-time"
              disabled={isValidated}
            >
              {TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </td>
          <td className="fiche-col-comment">
            <input
              type="text"
              value={entry.comment || ''}
              onChange={(e) => handleEntryChange(entry._key, 'comment', e.target.value)}
              placeholder="Commentaire…"
              className="fiche-input fiche-input-comment"
              disabled={isValidated}
            />
          </td>
          <td className="fiche-col-done">
            <Button
              variant="ghost"
              size="xs"
              iconOnly
              className={`fiche-check-btn ${entry.completed === 1 ? 'checked' : ''}`}
              onClick={() => handleToggleCompleted(entry._key)}
              disabled={isValidated}
              title={entry.completed === 1 ? 'Fait — cliquer pour annuler' : 'Marquer comme fait'}
              aria-label={
                entry.completed === 1 ? 'Fait — cliquer pour annuler' : 'Marquer comme fait'
              }
            >
              {entry.completed === 1 ? <Check size={16} /> : <Square size={16} />}
            </Button>
          </td>
          <td className="fiche-col-actions">
            {!isValidated && entry.recurring_task_id && entry.id && (
              <Button
                variant="ghost"
                size="xs"
                iconOnly
                className={`fiche-postpone-btn ${isPostponing ? 'active' : ''}`}
                onClick={() => {
                  if (isPostponing) {
                    setPostponeTarget(null);
                    return;
                  }
                  const tomorrow = new Date(
                    `${sheet?.date || new Date().toISOString().split('T')[0]}T12:00:00`,
                  );
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  setPostponeDate(tomorrow.toISOString().split('T')[0]);
                  setPostponePeriod(entry.period || 'AM');
                  setPostponeTarget(entry);
                  setPostponeError('');
                }}
                title="Reporter cette tâche à une autre date"
                aria-label="Reporter cette tâche"
              >
                ➔
              </Button>
            )}
            {!isValidated && (
              <Button
                variant="ghost"
                size="xs"
                iconOnly
                className="fiche-delete-btn"
                onClick={() => handleRemoveEntry(entry._key)}
                title="Supprimer"
                aria-label="Supprimer l'entrée"
              >
                <Trash2 size={14} />
              </Button>
            )}
          </td>
        </tr>
        {isPostponing && (
          <tr className="fiche-row-postpone">
            <td colSpan={6}>
              <div className="fiche-postpone-form">
                <span className="fiche-postpone-label">Reporter au :</span>
                <input
                  type="date"
                  className="fiche-input fiche-postpone-date"
                  value={postponeDate}
                  onChange={(e) => setPostponeDate(e.target.value)}
                />
                <select
                  className="fiche-input fiche-postpone-period"
                  value={postponePeriod}
                  onChange={(e) => setPostponePeriod(e.target.value)}
                >
                  <option value="AM">Matin (AM)</option>
                  <option value="PM">Après-midi (PM)</option>
                </select>
                {postponeError && <span className="fiche-postpone-error">{postponeError}</span>}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePostponeEntry}
                  disabled={postponeSaving || !postponeDate}
                >
                  {postponeSaving ? <Loader2 size={12} className="animate-spin" /> : null}
                  Confirmer
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPostponeTarget(null)}>
                  Annuler
                </Button>
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  const renderSection = (label, sectionEntries, period) => {
    // On n'exclut que les tâches non-complétées déjà dans la fiche
    // Les tâches déjà effectuées (completed=1) restent proposables
    const existingIncompleteTaskIds = new Set(
      entries
        .filter((e) => e.completed !== 1)
        .map((e) => e.task_assignment_id)
        .filter(Boolean),
    );
    const alreadyDoneTaskIds = new Set(
      entries
        .filter((e) => e.completed === 1)
        .map((e) => e.task_assignment_id)
        .filter(Boolean),
    );
    const availableTasks = planningTasks.filter(
      (t) =>
        (!t.period || t.period === period || t.period === 'FULL') &&
        !existingIncompleteTaskIds.has(t.id),
    );
    const recurringForPeriod = recurringTasks.filter((r) => r.period === period && r.active === 1);

    return (
      <div className="fiche-section">
        <div className="fiche-section-header">
          <h4>{label}</h4>
          {!isValidated && (
            <div className="fiche-section-actions">
              <Button
                variant="secondary"
                size="sm"
                className="fiche-add-btn"
                onClick={() => handleAddEntry(period)}
              >
                <Plus size={14} /> Ajouter
              </Button>
              {availableTasks.length > 0 && (
                <div className="fiche-picker-wrapper">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="fiche-add-btn fiche-add-btn-planning"
                    onClick={() => setShowPicker(showPicker === period ? null : period)}
                  >
                    <Calendar size={14} /> Depuis planning
                    <ChevronDown size={12} />
                  </Button>
                  {showPicker === period && (
                    <div className="fiche-picker-dropdown">
                      {availableTasks.map((t) => (
                        <button
                          type="button"
                          key={t.id}
                          className="fiche-picker-item"
                          onClick={() => handlePickPlanningTask(t, period)}
                        >
                          <div className="fiche-picker-main">
                            <span className="fiche-picker-title">
                              {t.title || t.google_event_title || 'Tâche sans nom'}
                              {alreadyDoneTaskIds.has(t.id) && (
                                <span className="fiche-picker-done-badge">✓ Déjà effectuée</span>
                              )}
                            </span>
                            <div className="fiche-picker-meta">
                              {t.affaire_num && (
                                <span
                                  className={`fiche-picker-badge fiche-picker-badge--${(t.affaire_type || 'autre').toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  {t.affaire_type || 'Affaire'}
                                </span>
                              )}
                              {t.affaire_num && (
                                <span className="fiche-picker-affaire-num">#{t.affaire_num}</span>
                              )}
                              {(t.affaire_nom || t.affaire_titre) && (
                                <span className="fiche-picker-affaire-name">
                                  {t.affaire_nom || t.affaire_titre}
                                </span>
                              )}
                              {t.affaire_client && (
                                <span className="fiche-picker-client">{t.affaire_client}</span>
                              )}
                            </div>
                          </div>
                          <div className="fiche-picker-right">
                            {t.section && <span className="fiche-picker-section">{t.section}</span>}
                            {t.time && <span className="fiche-picker-time">{t.time}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="fiche-recurring-wrapper">
                <Button
                  variant="secondary"
                  size="sm"
                  className="fiche-add-btn fiche-add-btn-recurring"
                  onClick={() => {
                    if (showRecurringForm === period) {
                      setShowRecurringForm(null);
                      return;
                    }
                    resetRecurringForm(period);
                    setShowRecurringForm(period);
                  }}
                >
                  ⟳ Récurrente
                  <ChevronDown size={12} />
                </Button>
                {showRecurringForm === period && (
                  <div className="fiche-recurring-dropdown">
                    <div className="fiche-recurring-row">
                      <input
                        type="text"
                        className="fiche-recurring-input"
                        placeholder="Titre de la tâche"
                        value={recurringForm.title}
                        onChange={(e) =>
                          setRecurringForm((prev) => ({ ...prev, title: e.target.value }))
                        }
                      />
                    </div>
                    <div className="fiche-recurring-row fiche-recurring-row-grid">
                      <select
                        className="fiche-recurring-input"
                        value={recurringForm.recurrence}
                        onChange={(e) =>
                          setRecurringForm((prev) => ({ ...prev, recurrence: e.target.value }))
                        }
                      >
                        <option value="daily">Journalière</option>
                        <option value="weekly">Hebdomadaire</option>
                        <option value="monthly">Mensuelle</option>
                      </select>
                      <select
                        className="fiche-recurring-input"
                        value={Number(recurringForm.default_time_spent) || 0}
                        onChange={(e) =>
                          setRecurringForm((prev) => ({
                            ...prev,
                            default_time_spent: Number(e.target.value),
                          }))
                        }
                      >
                        {TIME_OPTIONS.map((o) => (
                          <option key={`rt-${o.value}`} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="fiche-recurring-input"
                        value={recurringForm.period}
                        onChange={(e) =>
                          setRecurringForm((prev) => ({ ...prev, period: e.target.value }))
                        }
                        title="Période de la tâche"
                      >
                        <option value="AM">Matin (AM)</option>
                        <option value="PM">Après-midi (PM)</option>
                      </select>
                    </div>
                    {recurringForm.recurrence === 'weekly' && (
                      <div className="fiche-recurring-row">
                        <select
                          className="fiche-recurring-input"
                          value={recurringForm.day_of_week}
                          onChange={(e) =>
                            setRecurringForm((prev) => ({ ...prev, day_of_week: e.target.value }))
                          }
                        >
                          <option value="1">Lundi</option>
                          <option value="2">Mardi</option>
                          <option value="3">Mercredi</option>
                          <option value="4">Jeudi</option>
                          <option value="5">Vendredi</option>
                          <option value="6">Samedi</option>
                          <option value="0">Dimanche</option>
                        </select>
                      </div>
                    )}
                    {recurringForm.recurrence === 'monthly' && (
                      <div className="fiche-recurring-row">
                        <input
                          type="number"
                          min={1}
                          max={31}
                          className="fiche-recurring-input"
                          value={recurringForm.day_of_month}
                          onChange={(e) =>
                            setRecurringForm((prev) => ({ ...prev, day_of_month: e.target.value }))
                          }
                        />
                      </div>
                    )}
                    <div className="fiche-recurring-row">
                      <input
                        type="text"
                        className="fiche-recurring-input"
                        placeholder="Commentaire par défaut (optionnel)"
                        value={recurringForm.default_comment}
                        onChange={(e) =>
                          setRecurringForm((prev) => ({ ...prev, default_comment: e.target.value }))
                        }
                      />
                    </div>
                    {recurringError ? (
                      <div className="fiche-recurring-error">{recurringError}</div>
                    ) : null}
                    <div className="fiche-recurring-actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          editingRecurringId
                            ? handleUpdateRecurring()
                            : handleCreateRecurring(period)
                        }
                        disabled={recurringSaving}
                      >
                        {recurringSaving ? <Loader2 size={12} className="animate-spin" /> : null}
                        {editingRecurringId ? 'Enregistrer' : 'Créer'}
                      </Button>
                      {editingRecurringId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowRecurringForm(null);
                            resetRecurringForm();
                          }}
                        >
                          Annuler
                        </Button>
                      )}
                    </div>
                    {recurringForPeriod.length > 0 && (
                      <ul className="fiche-recurring-list">
                        {recurringForPeriod.map((r) => (
                          <li key={r.id}>
                            <span>{r.title}</span>
                            <span className="fiche-recurring-chip">{formatRecurringLabel(r)}</span>
                            <button
                              type="button"
                              className="fiche-recurring-edit"
                              onClick={() => handleStartEditRecurring(r, period)}
                              title="Modifier"
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="fiche-recurring-delete"
                              onClick={() => handleDeleteRecurring(r.id)}
                              title="Supprimer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              {loadingTasks && <Loader2 size={14} className="animate-spin" />}
            </div>
          )}
        </div>
        {sectionEntries.length > 0 ? (
          <table className="fiche-table">
            <thead>
              <tr>
                <th style={{ width: 30 }} />
                <th>Tâche</th>
                <th style={{ width: 90 }}>Temps</th>
                <th>Commentaire</th>
                <th style={{ width: 50 }}>Fait</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>{sectionEntries.map(renderEntryRow)}</tbody>
          </table>
        ) : (
          <p className="fiche-empty">Aucune tâche pour cette période</p>
        )}
      </div>
    );
  };

  return (
    <div className="fiche-suivi">
      {(dayAvailabilities.length > 0 ||
        dayEnterprisePresence.length > 0 ||
        dayMissions.length > 0 ||
        dayPlanningAffaires.length > 0) && (
        <div className="fiche-day-context">
          <h4>Contexte du jour</h4>
          <div className="fiche-context-grid">
            {dayAvailabilities.length > 0 && (
              <div className="fiche-context-card fiche-context-card-unavailability">
                <div className="fiche-context-title">Congés / indisponibilités</div>
                <ul className="fiche-context-list">
                  {dayAvailabilities.map((a) => (
                    <li key={`av-${a.id}`}>
                      <span className="fiche-context-label">
                        {a.type_label || a.type || 'Indisponible'}
                      </span>
                      {a.reason ? <span className="fiche-context-meta"> - {a.reason}</span> : null}
                      <span
                        className={`fiche-context-status ${getAvailabilityStatusClass(a.status)}`}
                      >
                        {getAvailabilityStatusLabel(a.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dayEnterprisePresence.length > 0 && (
              <div className="fiche-context-card fiche-context-card-mission">
                <div className="fiche-context-title">Présence entreprise</div>
                <ul className="fiche-context-list">
                  {dayEnterprisePresence.map((a) => (
                    <li key={`ep-${a.id}`}>
                      <span className="fiche-context-label">{a.type_label || 'Entreprise'}</span>
                      {a.reason ? <span className="fiche-context-meta"> - {a.reason}</span> : null}
                      <span className="fiche-context-status fiche-context-status-approved">
                        Présent
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dayMissions.length > 0 && (
              <div className="fiche-context-card fiche-context-card-mission">
                <div className="fiche-context-title">Prestations / missions</div>
                <ul className="fiche-context-list">
                  {dayMissions.map((m) => (
                    <li key={`ms-${m.id}`}>
                      <span className={`fiche-context-badge ${getMissionTypeClass(m)}`}>
                        {m.affaire_type || m.affaire || 'Mission'}
                      </span>
                      <span className="fiche-context-label">
                        {m.title || m.affaire || `Mission #${m.id}`}
                      </span>
                      {m.client_name ? (
                        <span className="fiche-context-meta"> - {m.client_name}</span>
                      ) : null}
                      <span className={`fiche-context-status ${getMissionStatusClass(m.status)}`}>
                        {getMissionStatusLabel(m.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dayPlanningAffaires.length > 0 && (
              <div className="fiche-context-card fiche-context-card-mission">
                <div className="fiche-context-title">Affectations planning</div>
                <ul className="fiche-context-list">
                  {dayPlanningAffaires.map((a) => (
                    <li key={`pa-${a.affaire_num}`}>
                      <span className={`fiche-context-badge ${getMissionTypeClass(a)}`}>
                        {a.affaire_type || 'Affaire'}
                      </span>
                      <span className="fiche-context-label">
                        {a.affaire_label || a.affaire_num}
                      </span>
                      {a.affaire_client ? (
                        <span className="fiche-context-meta"> - {a.affaire_client}</span>
                      ) : null}
                      {a.affaire_num &&
                      !entryAffaireNums.has(a.affaire_num.toString().trim().toUpperCase()) ? (
                        <span className="fiche-context-status fiche-context-status-pending">
                          À traiter
                        </span>
                      ) : (
                        <span className="fiche-context-status fiche-context-status-approved">
                          Déjà en tâches
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {renderSection('🌅 Matin (AM)', amEntries, 'AM')}
      {renderSection('🌇 Après-midi (PM)', pmEntries, 'PM')}

      {/* Notes */}
      <div className="fiche-notes">
        <label>Notes de la journée</label>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setDirty(true);
          }}
          placeholder="Notes, remarques, incidents…"
          rows={3}
          disabled={isValidated}
        />
      </div>

      {/* Récap + Actions */}
      <div className="fiche-footer">
        <div className="fiche-summary">
          <span>
            {totalDone}/{entries.length} tâches effectuées
          </span>
          <span>—</span>
          <span>{totalTimeLabel} total</span>
          {saving && <Loader2 size={14} className="animate-spin" />}
        </div>
        <div className="fiche-footer-actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkAllDone}
            disabled={isValidated || entries.length === 0 || allDone}
            title="Marquer toutes les tâches de la journée comme faites"
          >
            <Check size={14} /> Tout marquer fait
          </Button>
        </div>
      </div>
    </div>
  );
}

export default memo(FicheSuivi);
