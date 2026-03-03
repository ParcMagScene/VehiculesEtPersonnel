import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X, Calendar, Clock, MapPin, Briefcase, Check, Loader,
  Package, Truck, ArrowRight, RotateCcw, Wrench, AlertCircle
} from 'lucide-react';
import api from '../utils/api';
import { AFFAIRE_TYPE_SECTIONS, guessAffaireType } from '../utils/affaireConstants';
import AffaireBadge from './AffaireBadge';
import { useToast } from '../hooks/useToast';
import './EventTaskModal.css';

// ═══ Définition des étapes opérationnelles ═══
const TASK_STEPS = [
  { key: 'preparation',  label: 'Préparation',  emoji: '🔧', icon: Wrench,      color: '#6366f1', defaultSection: 'prep_locations' },
  { key: 'chargement',   label: 'Chargement',   emoji: '📦', icon: Package,     color: '#f59e0b', defaultSection: 'chargement' },
  { key: 'depart',       label: 'Départ',        emoji: '🚀', icon: ArrowRight,  color: '#3b82f6', defaultSection: 'depart',       typeRestriction: ['Prestation', 'Tournée'] },
  { key: 'livraison',    label: 'Livraison',    emoji: '🚚', icon: Truck,       color: '#f97316', defaultSection: 'courses',      typeRestriction: ['Location', 'Tournée'] },
  { key: 'enlevement',   label: 'Enlèvement',   emoji: '📦', icon: Truck,       color: '#10b981', defaultSection: 'enlevement',   typeRestriction: ['Location', 'Tournée'] },
  { key: 'retour',       label: 'Retour',        emoji: '↩️', icon: RotateCcw,   color: '#8b5cf6', defaultSection: 'retour',       typeRestriction: ['Prestation', 'Tournée'] },
  { key: 'recuperation', label: 'Récupération', emoji: '📥', icon: Package,     color: '#ef4444', defaultSection: 'recuperation', typeRestriction: ['Location', 'Tournée'] },
  { key: 'installation', label: 'Installation', emoji: '🛠️', icon: Wrench,      color: '#10b981', defaultSection: 'installation', typeRestriction: ['Installation'] },
];

// Filtrer les étapes selon le type d'affaire
const getVisibleSteps = (affaireType) => TASK_STEPS.filter(s => !s.typeRestriction || (Array.isArray(s.typeRestriction) ? s.typeRestriction.includes(affaireType) : s.typeRestriction === affaireType));

function EventTaskModal({ event, existingTasks = [], onSave, onDelete, onClose }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Extraire les infos de l'événement Google
  const eventInfo = useMemo(() => {
    const summary = event?.summary || '';
    const startDT = event?.start?.dateTime || event?.start?.date || '';
    const endDT = event?.end?.dateTime || event?.end?.date || '';
    const startDate = startDT.slice(0, 10);
    const startTime = startDT.includes('T')
      ? new Date(startDT).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '';
    const endTime = endDT.includes('T')
      ? new Date(endDT).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '';
    const location = event?.location || '';
    const description = event?.description || '';
    // Extraire numéro d'affaire (AFxxxxx pattern)
    const affaireMatch = summary.match(/AF\d{4,}/i);
    const affaireNum = affaireMatch ? affaireMatch[0].toUpperCase() : '';
    // Déduire le type à partir du titre
    const affaireType = guessAffaireType(summary);

    return { summary, startDate, startTime, endTime, location, description, affaireNum, affaireType };
  }, [event]);

  // ═══ État des tâches par étape ═══
  const [steps, setSteps] = useState(() => {
    const initial = {};
    TASK_STEPS.forEach(step => {
      // Chercher si une tâche existe déjà pour cette étape
      const existing = existingTasks.find(t =>
        t.sourceId === event?.id && t.section?.includes(step.key)
      ) || existingTasks.find(t =>
        t.sourceId === event?.id && (t.title || '').toLowerCase().includes(step.label.toLowerCase())
      );

      initial[step.key] = {
        enabled: !!existing,
        date: existing?.date || eventInfo.startDate || '',
        time: existing?.time || '',
        endTime: existing?.endTime || '',
        period: existing?.period || (step.key === 'preparation' || step.key === 'chargement' ? 'AM' : 'PM'),
        notes: existing?.notes || '',
        taskId: existing?.id || null,
      };
    });
    return initial;
  });

  const hasExistingTasks = existingTasks.filter(t => t.sourceId === event?.id).length > 0;

  const toggleStep = (key) => {
    setSteps(prev => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
  };

  const updateStep = (key, field, value) => {
    setSteps(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const visibleSteps = useMemo(() => getVisibleSteps(eventInfo.affaireType), [eventInfo.affaireType]);

  const enabledSteps = useMemo(() =>
    visibleSteps.filter(s => steps[s.key]?.enabled),
  [steps, visibleSteps]);

  // Déterminer la section en fonction du type de step + affaire
  const getSectionForStep = (stepKey) => {
    if (stepKey === 'preparation') {
      return AFFAIRE_TYPE_SECTIONS[eventInfo.affaireType] || 'prep_locations';
    }
    const stepDef = TASK_STEPS.find(s => s.key === stepKey);
    return stepDef?.defaultSection || 'manual';
  };

  // Mapping step → type d'événement d'affichage
  const STEP_TO_DISPLAY_TYPE = {
    preparation: 'preparation',
    chargement: 'preparation',
    depart: 'depart',
    enlevement: 'enlevement',
    retour: 'retour',
    recuperation: 'recuperation',
    installation: 'installation',
  };

  // Mapping affaire type → catégorie d'affichage
  const AFFAIRE_TYPE_TO_CATEGORY = {
    'Location': 'location',
    'Prestation': 'prestation',
    'Vente': 'vente',
    'Installation': 'installation',
  };

  // ═══ Sauvegarde ═══
  const handleSave = async () => {
    if (enabledSteps.length === 0) {
      toast.warning('Sélectionnez au moins une étape');
      return;
    }

    setSaving(true);
    try {
      // Supprimer les anciennes tâches liées si elles existent
      if (hasExistingTasks) {
        await api.deleteTasksBySource(event.id);
      }

      // 1) Créer les événements d'affichage correspondants
      const displayEventsToCreate = enabledSteps.map(step => {
        const s = steps[step.key];
        return {
          affaire_id: eventInfo.affaireNum || null,
          type: STEP_TO_DISPLAY_TYPE[step.key] || 'preparation',
          category: AFFAIRE_TYPE_TO_CATEGORY[eventInfo.affaireType] || 'prestation',
          date: s.date,
          period: s.period || null,
          time: s.time || null,
          comment: `${step.emoji} ${step.label} — ${eventInfo.summary}${s.notes ? '\n' + s.notes : ''}`,
          client: eventInfo.summary || '',
          location: eventInfo.location || '',
        };
      });

      let createdDisplayEvents = [];
      try {
        createdDisplayEvents = await api.createDisplayEventsBatch(displayEventsToCreate);
      } catch (e) {
        console.warn('Erreur création événements affichage (non bloquant):', e);
      }

      // 2) Créer les tâches, liées aux display events si possible
      const tasksToCreate = enabledSteps.map((step, idx) => {
        const s = steps[step.key];
        const displayEventId = createdDisplayEvents[idx]?.id || null;
        return {
          display_event_id: displayEventId,
          date: s.date,
          period: s.period || null,
          time: s.time || null,
          end_time: s.endTime || null,
          section: getSectionForStep(step.key),
          title: `${step.emoji} ${step.label} — ${eventInfo.summary}`,
          notes: s.notes || '',
          source_type: 'google_event',
          source_id: event.id,
          google_event_title: eventInfo.summary,
          affaire_num: eventInfo.affaireNum || null,
          status: 'pending',
        };
      });

      await api.createTasksBatch(tasksToCreate);
      toast.success(`${tasksToCreate.length} tâche${tasksToCreate.length > 1 ? 's' : ''} créée${tasksToCreate.length > 1 ? 's' : ''}`);
      onSave?.();
      onClose();
    } catch (err) {
      console.error('Erreur sauvegarde tâches:', err);
      toast.error('Erreur lors de la sauvegarde des tâches');
    } finally {
      setSaving(false);
    }
  };

  // ═══ Suppression des tâches liées ═══
  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await api.deleteTasksBySource(event.id);
      toast.success('Tâches supprimées');
      onDelete?.();
      onClose();
    } catch (err) {
      toast.error('Erreur suppression');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="etm-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="etm-modal">
        {/* Header */}
        <div className="etm-header">
          <div className="etm-header-info">
            <h3><Calendar size={18} /> Définir les tâches</h3>
            <p className="etm-event-title">{eventInfo.summary}</p>
          </div>
          <button className="etm-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Event summary */}
        <div className="etm-event-summary">
          {eventInfo.affaireNum && (
            <AffaireBadge numero={eventInfo.affaireNum} type={eventInfo.affaireType} showIcon />
          )}
          {eventInfo.startTime && (
            <span className="etm-badge time"><Clock size={12} /> {eventInfo.startTime}{eventInfo.endTime ? ` → ${eventInfo.endTime}` : ''}</span>
          )}
          {eventInfo.location && (
            <span className="etm-badge location"><MapPin size={12} /> {eventInfo.location}</span>
          )}
        </div>

        {/* Steps */}
        <div className="etm-steps">
          {visibleSteps.map(step => {
            const s = steps[step.key];
            const Icon = step.icon;
            return (
              <div key={step.key} className={`etm-step ${s.enabled ? 'enabled' : ''}`}>
                <div className="etm-step-header" onClick={() => toggleStep(step.key)}>
                  <div className={`etm-step-check ${s.enabled ? 'checked' : ''}`} style={s.enabled ? { background: step.color } : {}}>
                    {s.enabled && <Check size={12} />}
                  </div>
                  <Icon size={16} style={{ color: step.color }} />
                  <span className="etm-step-label">{step.emoji} {step.label}</span>
                </div>

                {s.enabled && (
                  <div className="etm-step-fields">
                    <div className="etm-field">
                      <label>Date</label>
                      <input
                        type="date"
                        value={s.date}
                        onChange={e => updateStep(step.key, 'date', e.target.value)}
                      />
                    </div>
                    <div className="etm-field">
                      <label>Période</label>
                      <select
                        value={s.period}
                        onChange={e => updateStep(step.key, 'period', e.target.value)}
                      >
                        <option value="AM">Matin (AM)</option>
                        <option value="PM">Après-midi (PM)</option>
                      </select>
                    </div>
                    <div className="etm-field">
                      <label>Heure début</label>
                      <input
                        type="time"
                        value={s.time}
                        onChange={e => updateStep(step.key, 'time', e.target.value)}
                      />
                    </div>
                    <div className="etm-field">
                      <label>Heure fin</label>
                      <input
                        type="time"
                        value={s.endTime}
                        onChange={e => updateStep(step.key, 'endTime', e.target.value)}
                      />
                    </div>
                    <div className="etm-field full">
                      <label>Notes</label>
                      <input
                        type="text"
                        placeholder="Notes..."
                        value={s.notes}
                        onChange={e => updateStep(step.key, 'notes', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="etm-footer">
          {hasExistingTasks && (
            <button className="etm-btn danger" onClick={handleDeleteAll} disabled={deleting}>
              {deleting ? <Loader size={14} className="spin" /> : <AlertCircle size={14} />}
              Supprimer les tâches
            </button>
          )}
          <div className="etm-footer-right">
            <button className="etm-btn secondary" onClick={onClose}>Annuler</button>
            <button className="etm-btn primary" onClick={handleSave} disabled={saving || enabledSteps.length === 0}>
              {saving ? <Loader size={14} className="spin" /> : <Check size={14} />}
              {hasExistingTasks ? 'Mettre à jour' : 'Créer'} {enabledSteps.length} tâche{enabledSteps.length > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventTaskModal;
