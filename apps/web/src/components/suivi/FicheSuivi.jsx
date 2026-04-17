/* ═══════════════════════════════════════════════════════════════
   FicheSuivi — Formulaire journalier d'un personnel
   Grille d'entrées AM/PM avec tâches, temps, commentaires
   ═══════════════════════════════════════════════════════════════ */

import {
  Check,
  GripVertical,
  HelpCircle,
  Loader2,
  Minus,
  Plus,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';

function newEntry(period = 'AM', sortOrder = 0) {
  return {
    _key: crypto.randomUUID(),
    period,
    task: '',
    time_spent: 0,
    comment: '',
    completed: null,
    task_assignment_id: null,
    sort_order: sortOrder,
  };
}

function FicheSuivi({ sheet, onSave, saving, isAdmin }) {
  const [entries, setEntries] = useState([]);
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (sheet) {
      const mapped = (sheet.entries || []).map((e) => ({
        ...e,
        _key: e.id || crypto.randomUUID(),
      }));
      setEntries(mapped);
      setNotes(sheet.notes || '');
      setDirty(false);
    }
  }, [sheet?.id, sheet?.modified_at]);

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
        // Cycle: null(?) → 1(Oui) → 0(Non) → null(?)
        const next = e.completed === null ? 1 : e.completed === 1 ? 0 : null;
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

  const isValidated = sheet?.status === 'validated';
  const amEntries = entries.filter((e) => e.period === 'AM');
  const pmEntries = entries.filter((e) => e.period === 'PM');
  const totalTime = entries.reduce((s, e) => s + (parseFloat(e.time_spent) || 0), 0);
  const totalDone = entries.filter((e) => e.completed === 1).length;

  const renderEntryRow = (entry) => (
    <tr
      key={entry._key}
      className={`fiche-row ${entry.completed === 1 ? 'completed' : entry.completed === 0 ? 'not-done' : ''}`}
    >
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
        <button
          className={`fiche-check-btn ${entry.completed === 1 ? 'checked' : entry.completed === 0 ? 'not-done' : 'unknown'}`}
          onClick={() => handleToggleCompleted(entry._key)}
          disabled={isValidated}
          title={
            entry.completed === 1 ? 'Fait' : entry.completed === 0 ? 'Non fait' : 'Indéterminé'
          }
        >
          {entry.completed === 1 ? (
            <Check size={16} />
          ) : entry.completed === 0 ? (
            <Minus size={16} />
          ) : (
            <HelpCircle size={16} />
          )}
        </button>
      </td>
      <td className="fiche-col-actions">
        {!isValidated && (
          <button
            className="fiche-delete-btn"
            onClick={() => handleRemoveEntry(entry._key)}
            title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  );

  const renderSection = (label, sectionEntries, period) => (
    <div className="fiche-section">
      <div className="fiche-section-header">
        <h4>{label}</h4>
        {!isValidated && (
          <button className="fiche-add-btn" onClick={() => handleAddEntry(period)}>
            <Plus size={14} /> Ajouter
          </button>
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
        </div>

        {!isValidated && (
          <div className="fiche-footer-actions">
            <button
              className="suivi-btn suivi-btn-secondary"
              onClick={() => handleSave('draft')}
              disabled={saving || !dirty}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Enregistrer brouillon
            </button>
            <button
              className="suivi-btn suivi-btn-primary"
              onClick={() => handleSave('submitted')}
              disabled={saving}
            >
              <Send size={14} /> Soumettre
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(FicheSuivi);
