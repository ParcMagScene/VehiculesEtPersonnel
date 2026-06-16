import './MobileSuivi.css';

import { CheckCircle, ChevronRight, Circle, Clock, FileText, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button, Input, Select, Spinner, Textarea } from '@/design-system';

import usePullToRefresh from '../../hooks/usePullToRefresh';
import api from '../../utils/api';
import PullToRefreshIndicator from './PullToRefreshIndicator';

const STATUS_MAP = {
  draft: { label: 'Brouillon', color: 'var(--theme-text-muted)', Icon: Circle },
  completed: { label: 'Complétée', color: 'var(--theme-info)', Icon: Clock },
  validated: { label: 'Validée', color: 'var(--theme-success)', Icon: CheckCircle },
};

/**
 * MobileSuivi — module Suivi du personnel (mobile).
 * Sous-écrans : list | detail | add
 * Navigation interne via state (pas de routes hash supplémentaires).
 */
function MobileSuivi({ currentUser, initialDate = null, initialPersonId = null }) {
  const [view, setView] = useState('list'); // list | detail | add
  const [loading, setLoading] = useState(true);
  const [personId, setPersonId] = useState(
    initialPersonId ? Number(initialPersonId) || null : null,
  );
  const [sheet, setSheet] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state (ajout)
  const [addTask, setAddTask] = useState('');
  const [addPeriod, setAddPeriod] = useState('AM');
  const [addTime, setAddTime] = useState('');
  const [addComment, setAddComment] = useState('');

  // Date à charger : QR > aujourd'hui (validée YYYY-MM-DD)
  const targetDate =
    initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)
      ? initialDate
      : new Date().toISOString().slice(0, 10);

  // Résoudre le person_id lié au user courant si pas fourni explicitement
  useEffect(() => {
    if (initialPersonId) return; // déjà fixé par le QR
    if (!currentUser) return;
    (async () => {
      try {
        const persons = await api.getPersons();
        const me = persons.find((p) => p.userId === currentUser.id || p.user_id === currentUser.id);
        if (me) setPersonId(me.id);
      } catch (e) {
        console.error('Erreur résolution personne:', e);
      }
    })();
  }, [currentUser, initialPersonId]);

  const loadSheet = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    try {
      const data = await api.getSuiviSheet(personId, targetDate);
      setSheet(data);
    } catch (e) {
      console.error('Erreur chargement fiche suivi:', e);
    }
    setLoading(false);
  }, [personId, targetDate]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  const { containerProps: ptrProps, indicatorNode: ptrIndicator } = usePullToRefresh(loadSheet);

  // ── Valider / compléter une entrée ──
  const handleToggleEntry = async (entry) => {
    setSaving(true);
    try {
      const newCompleted = !entry.completed;
      await api.patchSuiviEntry(entry.id, { completed: newCompleted ? 1 : 0 });
      setSheet((prev) => ({
        ...prev,
        entries: prev.entries.map((e) =>
          e.id === entry.id ? { ...e, completed: newCompleted ? 1 : 0 } : e,
        ),
      }));
      if (selectedEntry?.id === entry.id) {
        setSelectedEntry((prev) => ({ ...prev, completed: newCompleted ? 1 : 0 }));
      }
    } catch (e) {
      console.error('Erreur validation entrée:', e);
    }
    setSaving(false);
  };

  // ── Ajout d'une entrée ──
  const handleAddEntry = async () => {
    if (!addTask.trim()) return;
    setSaving(true);
    try {
      const entries = [
        ...(sheet?.entries || []),
        {
          task: addTask.trim(),
          period: addPeriod,
          time_spent: addTime ? parseInt(addTime, 10) : 0,
          comment: addComment.trim(),
          completed: 0,
        },
      ];
      await api.updateSuiviSheet(personId, targetDate, {
        status: sheet?.status || 'draft',
        notes: sheet?.notes || '',
        entries,
      });
      setAddTask('');
      setAddPeriod('AM');
      setAddTime('');
      setAddComment('');
      setView('list');
      await loadSheet();
    } catch (e) {
      console.error('Erreur ajout entrée:', e);
    }
    setSaving(false);
  };

  // ══════ VUE DÉTAIL ══════
  if (view === 'detail' && selectedEntry) {
    const st = selectedEntry.completed ? STATUS_MAP.validated : STATUS_MAP.draft;
    return (
      <div className="mobile-suivi">
        <div className="ms-sub-header">
          <Button variant="ghost" className="ms-sub-back" onClick={() => setView('list')}>
            ← Retour
          </Button>
          <h3>Détail de la tâche</h3>
        </div>
        <div className="ms-detail-card">
          <div className="ms-detail-status" style={{ color: st.color }}>
            <st.Icon size={20} /> {st.label}
          </div>
          <h4 className="ms-detail-title">{selectedEntry.task || '—'}</h4>
          <div className="ms-detail-meta">
            {selectedEntry.period && <span className="ms-detail-tag">{selectedEntry.period}</span>}
            {selectedEntry.time_spent > 0 && (
              <span className="ms-detail-tag">
                <Clock size={12} /> {selectedEntry.time_spent} min
              </span>
            )}
          </div>
          {selectedEntry.comment && <p className="ms-detail-comment">{selectedEntry.comment}</p>}
          <Button
            variant={selectedEntry.completed ? 'secondary' : 'primary'}
            className="ms-detail-action"
            onClick={() => handleToggleEntry(selectedEntry)}
            disabled={saving}
          >
            {selectedEntry.completed ? 'Remettre à faire' : 'Valider'}
          </Button>
        </div>
      </div>
    );
  }

  // ══════ VUE AJOUT ══════
  if (view === 'add') {
    return (
      <div className="mobile-suivi">
        <div className="ms-sub-header">
          <Button variant="ghost" className="ms-sub-back" onClick={() => setView('list')}>
            ← Retour
          </Button>
          <h3>Ajouter une tâche</h3>
        </div>
        <div className="ms-add-form">
          <label className="ms-field">
            <span>Tâche *</span>
            <Input
              type="text"
              value={addTask}
              onChange={(e) => setAddTask(e.target.value)}
              placeholder="Description de la tâche…"
              autoFocus
            />
          </label>
          <label className="ms-field">
            <span>Période</span>
            <Select value={addPeriod} onChange={(e) => setAddPeriod(e.target.value)}>
              <option value="AM">Matin</option>
              <option value="PM">Après-midi</option>
              <option value="Full">Journée</option>
            </Select>
          </label>
          <label className="ms-field">
            <span>Temps passé</span>
            <Select value={addTime} onChange={(e) => setAddTime(e.target.value)}>
              <option value="">—</option>
              <option value="10">10 min</option>
              <option value="15">15 min</option>
              <option value="20">20 min</option>
              <option value="30">30 min</option>
              <option value="40">40 min</option>
              <option value="45">45 min</option>
              <option value="60">1 h</option>
              <option value="90">1 h 30</option>
              <option value="120">2 h</option>
              <option value="150">2 h 30</option>
              <option value="180">3 h</option>
              <option value="210">3 h 30</option>
              <option value="240">4 h</option>
              <option value="300">5 h</option>
              <option value="360">6 h</option>
              <option value="420">7 h</option>
              <option value="480">8 h</option>
            </Select>
          </label>
          <label className="ms-field">
            <span>Commentaire</span>
            <Textarea
              value={addComment}
              onChange={(e) => setAddComment(e.target.value)}
              placeholder="Notes…"
              rows={3}
            />
          </label>
          <Button
            variant="primary"
            className="ms-add-submit"
            onClick={handleAddEntry}
            disabled={!addTask.trim() || saving}
          >
            {saving ? <Spinner size={16} /> : 'Ajouter'}
          </Button>
        </div>
      </div>
    );
  }

  // ══════ VUE LISTE (défaut) ══════
  const entries = sheet?.entries || [];
  const doneCount = entries.filter((e) => e.completed).length;
  const sheetStatus = sheet ? STATUS_MAP[sheet.status] || STATUS_MAP.draft : null;

  return (
    <div className="mobile-suivi" {...ptrProps}>
      <PullToRefreshIndicator indicator={ptrIndicator} />

      {/* Barre statut fiche */}
      {sheet && (
        <div className="ms-sheet-status">
          <FileText size={16} />
          <span>Fiche du {targetDate}</span>
          <span className="ms-sheet-badge" style={{ color: sheetStatus?.color }}>
            {sheetStatus?.label}
          </span>
          <span className="ms-sheet-count">
            {doneCount}/{entries.length}
          </span>
        </div>
      )}

      {/* Bouton ajouter */}
      <div className="ms-actions">
        <Button
          variant="primary"
          className="ms-add-btn"
          onClick={() => setView('add')}
          disabled={!personId}
        >
          <Plus size={18} /> Nouvelle tâche
        </Button>
        <Button
          variant="ghost"
          className="ms-refresh-btn"
          onClick={loadSheet}
          disabled={loading}
          aria-label="Actualiser"
        >
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </Button>
      </div>

      {/* Liste entrées */}
      {loading && entries.length === 0 ? (
        <div className="ms-empty">
          <Spinner size={32} />
          <p>Chargement…</p>
        </div>
      ) : !personId ? (
        <div className="ms-empty">
          <FileText size={40} />
          <p>Votre compte n'est pas lié à une fiche personnel</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="ms-empty">
          <CheckCircle size={40} />
          <p>Aucune entrée pour aujourd'hui</p>
          <span>Appuyez sur "Nouvelle tâche" pour commencer</span>
        </div>
      ) : (
        <div className="ms-list">
          {entries.map((entry) => {
            const done = !!entry.completed;
            return (
              <div
                key={entry.id}
                className={`ms-entry ${done ? 'done' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedEntry(entry);
                  setView('detail');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSelectedEntry(entry);
                    setView('detail');
                  }
                }}
              >
                <Button
                  variant="ghost"
                  className={`ms-entry-check ${done ? 'done' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleEntry(entry);
                  }}
                  disabled={saving}
                  aria-label={done ? 'Remettre à faire' : 'Valider'}
                >
                  {done ? <CheckCircle size={22} /> : <Circle size={22} />}
                </Button>
                <div className="ms-entry-content">
                  <span className={`ms-entry-task ${done ? 'done' : ''}`}>{entry.task || '—'}</span>
                  <div className="ms-entry-meta">
                    {entry.period && <span className="ms-entry-tag">{entry.period}</span>}
                    {entry.time_spent > 0 && (
                      <span className="ms-entry-time">
                        <Clock size={11} /> {entry.time_spent} min
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="ms-entry-chevron" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MobileSuivi;
