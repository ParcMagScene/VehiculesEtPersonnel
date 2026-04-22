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
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import Button from '../ui/Button';
import api from '../../utils/api';

function newEntry(period = 'AM', sortOrder = 0) {
  return {
    _key: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36),
    period,
    task: '',
    time_spent: 0,
    comment: '',
    completed: null,
    task_assignment_id: null,
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
  const pickerRef = useRef(null);

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

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker]);

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

  const handleSave = useCallback(
    (status) => {
      const cleanEntries = entries.map((e, i) => ({
        id: e.id || undefined,
        period: e.period,
        task: e.task,
        time_spent: parseFloat(e.time_spent) || 0,
        comment: e.comment || '',
        completed: e.completed === 1 ? 1 : e.completed === 0 ? 0 : null,
        task_assignment_id: e.task_assignment_id || null,
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
  const totalTime = entries.reduce((s, e) => s + (parseFloat(e.time_spent) || 0), 0);
  const totalDone = entries.filter((e) => e.completed === 1).length;

  const renderEntryRow = (entry) => (
    <tr key={entry._key} className={`fiche-row ${entry.completed === 1 ? 'completed' : ''}`}>
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
        <input
          type="number"
          min="0"
          max="24"
          step="0.25"
          value={entry.time_spent}
          onChange={(e) => handleEntryChange(entry._key, 'time_spent', e.target.value)}
          className="fiche-input fiche-input-time"
          disabled={isValidated}
        />
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
          aria-label={entry.completed === 1 ? 'Fait — cliquer pour annuler' : 'Marquer comme fait'}
        >
          {entry.completed === 1 ? <Check size={16} /> : <Square size={16} />}
        </Button>
      </td>
      <td className="fiche-col-actions">
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
  );

  const renderSection = (label, sectionEntries, period) => {
    const existingTaskIds = new Set(entries.map((e) => e.task_assignment_id).filter(Boolean));
    const availableTasks = planningTasks.filter(
      (t) =>
        (!t.period || t.period === period || t.period === 'FULL') && !existingTaskIds.has(t.id),
    );

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
                <div
                  className="fiche-picker-wrapper"
                  ref={showPicker === period ? pickerRef : null}
                >
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
                          <span className="fiche-picker-title">{t.title}</span>
                          {t.section && <span className="fiche-picker-section">{t.section}</span>}
                          {t.time && <span className="fiche-picker-time">{t.time}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
                <th style={{ width: 70 }}>Temps (h)</th>
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
          <span>{totalTime}h total</span>
          {saving && <Loader2 size={14} className="animate-spin" />}
        </div>
      </div>
    </div>
  );
}

export default memo(FicheSuivi);
