import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, FileDown, Eye, Check, CheckSquare, Square, Minus,
  User, Clock, Briefcase, Loader2
} from 'lucide-react';
import api from '../utils/api';
import './TaskPDFExportModal.css';

// ═══ Constantes sections ═══
const SECTIONS = {
  prep_locations:      { label: 'Prépa Locations',     emoji: '📦', color: '#3b82f6' },
  prep_prestations:    { label: 'Prépa Prestations',   emoji: '🎤', color: '#f59e0b' },
  prep_ventes:         { label: 'Prépa Ventes',        emoji: '🏷️', color: '#10b981' },
  taches_prioritaires: { label: 'Tâches Prioritaires', emoji: '🔴', color: '#ef4444' },
  taches_secondaires:  { label: 'Tâches Secondaires',  emoji: '🟡', color: '#f59e0b' },
  courses:             { label: 'Courses',              emoji: '🚗', color: '#8b5cf6' },
  manual:              { label: 'Autres',               emoji: '📋', color: '#64748b' },
};

const STATUS_ICONS = {
  pending: '○',
  in_progress: '◐',
  done: '●',
  cancelled: '✕',
};

const STATUS_LABELS = {
  pending: 'À faire',
  in_progress: 'En cours',
  done: 'Fait',
  cancelled: 'Annulé',
};

const formatDateFr = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

function TaskPDFExportModal({ date, tasks, onClose }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [pdfUrl, setPdfUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Initialiser avec toutes les tâches sélectionnées
  useEffect(() => {
    if (tasks && tasks.length > 0) {
      setSelectedIds(new Set(tasks.map(t => t.id)));
    }
  }, [tasks]);

  // Grouper les tâches par section
  const grouped = useMemo(() => {
    const groups = {};
    Object.keys(SECTIONS).forEach(key => { groups[key] = []; });
    (tasks || []).forEach(t => {
      const sec = t.section || 'manual';
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(t);
    });
    return groups;
  }, [tasks]);

  // Sections non vides
  const activeSections = useMemo(() =>
    Object.keys(SECTIONS).filter(k => (grouped[k] || []).length > 0),
    [grouped]
  );

  // Générer l'aperçu PDF
  const generatePreview = useCallback(async () => {
    if (selectedIds.size === 0) {
      setPdfUrl(null);
      return;
    }
    setGenerating(true);
    try {
      const blob = await api.exportTasksPdf(date, [...selectedIds]);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      console.error('Erreur aperçu PDF:', err);
    } finally {
      setGenerating(false);
    }
  }, [date, selectedIds, pdfUrl]);

  // Générer l'aperçu au montage et quand la sélection change (debounced)
  useEffect(() => {
    if (selectedIds.size === 0) {
      setPdfUrl(null);
      return;
    }
    const timer = setTimeout(() => {
      generatePreview();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, date]);

  // Cleanup URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle une tâche
  const toggleTask = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle toute une section
  const toggleSection = (sectionKey) => {
    const sectionTaskIds = (grouped[sectionKey] || []).map(t => t.id);
    const allSelected = sectionTaskIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      sectionTaskIds.forEach(id => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  // Tout sélectionner / désélectionner
  const toggleAll = () => {
    const allIds = (tasks || []).map(t => t.id);
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  // État section : all / some / none
  const sectionState = (sectionKey) => {
    const sectionTaskIds = (grouped[sectionKey] || []).map(t => t.id);
    if (sectionTaskIds.length === 0) return 'none';
    const selected = sectionTaskIds.filter(id => selectedIds.has(id)).length;
    if (selected === 0) return 'none';
    if (selected === sectionTaskIds.length) return 'all';
    return 'partial';
  };

  // Télécharger le PDF
  const handleDownload = async () => {
    if (selectedIds.size === 0) return;
    setDownloading(true);
    try {
      const blob = await api.exportTasksPdf(date, [...selectedIds]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taches-${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur téléchargement:', err);
    } finally {
      setDownloading(false);
    }
  };

  const totalTasks = (tasks || []).length;
  const dateFr = formatDateFr(date);

  return (
    <div className="pdf-export-overlay" onClick={onClose}>
      <div className="pdf-export-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="pdf-export-header">
          <div className="pdf-export-header-left">
            <FileDown size={20} />
            <div>
              <h3>Export PDF — Tâches</h3>
              <span className="pdf-export-date">{dateFr}</span>
            </div>
          </div>
          <button className="pdf-export-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="pdf-export-body">
          {/* Panneau de sélection (gauche) */}
          <div className="pdf-export-selection">
            <div className="selection-toolbar">
              <button className="select-all-btn" onClick={toggleAll}>
                {selectedIds.size === totalTasks ? (
                  <><CheckSquare size={15} /> Tout désélectionner</>
                ) : (
                  <><Square size={15} /> Tout sélectionner</>
                )}
              </button>
              <span className="selection-count">
                {selectedIds.size}/{totalTasks} tâche{selectedIds.size > 1 ? 's' : ''}
              </span>
            </div>

            <div className="selection-sections">
              {activeSections.map(sectionKey => {
                const info = SECTIONS[sectionKey];
                const sectionTasks = grouped[sectionKey] || [];
                const state = sectionState(sectionKey);

                return (
                  <div key={sectionKey} className="selection-section">
                    <div
                      className="section-checkbox-row"
                      onClick={() => toggleSection(sectionKey)}
                    >
                      <span className="section-cb" style={{ borderColor: info.color }}>
                        {state === 'all' && <Check size={12} style={{ color: info.color }} />}
                        {state === 'partial' && <Minus size={12} style={{ color: info.color }} />}
                      </span>
                      <span className="section-cb-emoji">{info.emoji}</span>
                      <span className="section-cb-label">{info.label}</span>
                      <span className="section-cb-count" style={{ color: info.color }}>
                        {sectionTasks.filter(t => selectedIds.has(t.id)).length}/{sectionTasks.length}
                      </span>
                    </div>

                    <div className="section-tasks-list">
                      {sectionTasks.map(task => {
                        const checked = selectedIds.has(task.id);
                        const isDone = task.status === 'done';
                        return (
                          <div
                            key={task.id}
                            className={`task-checkbox-row ${checked ? 'selected' : ''} ${isDone ? 'done' : ''}`}
                            onClick={() => toggleTask(task.id)}
                          >
                            <span className={`task-cb ${checked ? 'checked' : ''}`}>
                              {checked && <Check size={10} />}
                            </span>
                            <span className="task-cb-status" title={STATUS_LABELS[task.status]}>
                              {STATUS_ICONS[task.status]}
                            </span>
                            <span className={`task-cb-title ${isDone ? 'done' : ''}`}>
                              {task.title}
                            </span>
                            {(task.personFirstName || task.personLastName) && (
                              <span className="task-cb-person">
                                <User size={10} />
                                {task.personFirstName} {task.personLastName?.charAt(0)}.
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {activeSections.length === 0 && (
                <div className="empty-selection">
                  <p>Aucune tâche pour cette date</p>
                </div>
              )}
            </div>
          </div>

          {/* Aperçu PDF (droite) */}
          <div className="pdf-export-preview">
            {generating ? (
              <div className="preview-loading">
                <Loader2 size={32} className="spin" />
                <p>Génération de l'aperçu…</p>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="pdf-preview-frame"
                title="Aperçu PDF"
              />
            ) : (
              <div className="preview-empty">
                <Eye size={40} />
                <p>Sélectionnez au moins une tâche<br />pour voir l'aperçu</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pdf-export-footer">
          <button className="btn-cancel" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn-download"
            onClick={handleDownload}
            disabled={selectedIds.size === 0 || downloading}
          >
            {downloading ? (
              <><Loader2 size={15} className="spin" /> Téléchargement…</>
            ) : (
              <><FileDown size={15} /> Télécharger le PDF ({selectedIds.size} tâche{selectedIds.size > 1 ? 's' : ''})</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskPDFExportModal;
