import './EventTaskModal.css';

import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Loader,
  MapPin,
  Package,
  RotateCcw,
  Truck,
  Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, Select } from '@/design-system';

import { STATUS } from '../../constants';
import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import { useToast } from '../../hooks/useToast';
import { AFFAIRE_TYPE_SECTIONS, guessAffaireType } from '../../utils/affaireConstants';
import api from '../../utils/api';
import AffaireBadge from '../AffaireBadge';

// ═══ Définition des étapes opérationnelles ═══
const TASK_STEPS = [
  {
    key: 'preparation',
    label: 'Préparation',
    emoji: '🔧',
    icon: Wrench,
    color: ACCENT_COLORS.indigo,
    defaultSection: 'prep_locations',
  },
  {
    key: 'chargement',
    label: 'Chargement',
    emoji: '📦',
    icon: Package,
    color: STATUS_COLORS.warning,
    defaultSection: 'chargement',
  },
  {
    key: 'depart',
    label: 'Départ',
    emoji: '🚀',
    icon: ArrowRight,
    color: STATUS_COLORS.info,
    defaultSection: 'depart',
  },
  {
    key: 'livraison',
    label: 'Livraison',
    emoji: '🚚',
    icon: Truck,
    color: ACCENT_COLORS.orange,
    defaultSection: 'courses',
  },
  {
    key: 'enlevement',
    label: 'Enlèvement',
    emoji: '📦',
    icon: Truck,
    color: STATUS_COLORS.success,
    defaultSection: 'courses',
  },
  {
    key: 'retour',
    label: 'Retour',
    emoji: '↩️',
    icon: RotateCcw,
    color: ACCENT_COLORS.violet,
    defaultSection: 'courses',
  },
  {
    key: 'recuperation',
    label: 'Récupération',
    emoji: '📥',
    icon: Package,
    color: STATUS_COLORS.danger,
    defaultSection: 'courses',
  },
  {
    key: 'installation',
    label: 'Installation',
    emoji: '🛠️',
    icon: Wrench,
    color: STATUS_COLORS.success,
    defaultSection: 'installation',
  },
  {
    key: 'montage',
    label: 'Montage',
    emoji: '🔩',
    icon: Wrench,
    color: ACCENT_COLORS.cyanDark,
    defaultSection: 'montage',
  },
  {
    key: 'demontage',
    label: 'Démontage',
    emoji: '🔧',
    icon: Wrench,
    color: STATUS_COLORS.dangerDark,
    defaultSection: 'demontage',
  },
];

// Toutes les étapes sont disponibles pour tous les types d'événement
const getVisibleSteps = () => TASK_STEPS;

function EventTaskModal({ event, existingTasks = [], onSave, onDelete, onClose }) {
  // Bloque le scroll du body quand le modal est ouvert
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Déterminer le source_type (iCal vs Google)
  const sourceType = event?._ical ? 'ical_event' : 'google_event';

  // Extraire les infos de l'événement (Google ou iCal)
  const eventInfo = useMemo(() => {
    const summary = event?.summary || '';
    const startDT = event?.start?.dateTime || event?.start?.date || '';
    const endDT = event?.end?.dateTime || event?.end?.date || '';
    const startDate = startDT.slice(0, 10);
    const parsedStart = startDT.includes('T') ? new Date(startDT) : null;
    const parsedEnd = endDT.includes('T') ? new Date(endDT) : null;
    const startTime =
      parsedStart && !isNaN(parsedStart)
        ? parsedStart.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : '';
    const endTime =
      parsedEnd && !isNaN(parsedEnd)
        ? parsedEnd.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : '';
    const location = event?.location || '';
    const description = event?.description || '';
    // Extraire numéro d'affaire (AF xxxxx ou AFxxxxx pattern)
    const affaireMatch = summary.match(/\bAF\s*\d{4,}/i);
    const affaireNum = affaireMatch ? affaireMatch[0].toUpperCase().replace(/\s+/g, '') : '';
    // Titre nettoyé sans le N° d'affaire (affiché en badge séparé)
    const cleanSummary = summary
      .replace(/\bAF\s*\d{4,}\s*/i, '')
      .replace(/^\s*[-—]\s*/, '')
      .trim();
    // Déduire le type à partir du titre
    const affaireType = guessAffaireType(summary);

    return {
      summary,
      cleanSummary,
      startDate,
      startTime,
      endTime,
      location,
      description,
      affaireNum,
      affaireType,
    };
  }, [event]);

  // ═══ État des tâches par étape ═══
  const [steps, setSteps] = useState(() => {
    const initial = {};
    // Déduire la période AM/PM à partir de l'heure de l'événement
    const eventPeriod = (() => {
      if (!eventInfo.startTime) return null;
      const hour = parseInt(eventInfo.startTime.split(':')[0], 10);
      return hour < 12 ? 'AM' : 'PM';
    })();

    TASK_STEPS.forEach((step) => {
      // Chercher si une tâche existe déjà pour cette étape
      const existing =
        existingTasks.find((t) => t.sourceId === event?.id && t.section?.includes(step.key)) ||
        existingTasks.find(
          (t) =>
            t.sourceId === event?.id &&
            (t.title || '').toLowerCase().includes(step.label.toLowerCase()),
        );

      // Période par défaut : basée sur l'heure de l'événement, sinon prep/chargement=AM, reste=PM
      const defaultPeriod =
        eventPeriod || (step.key === 'preparation' || step.key === 'chargement' ? 'AM' : 'PM');

      initial[step.key] = {
        enabled: !!existing,
        date: existing?.date || eventInfo.startDate || '',
        time: existing?.time || eventInfo.startTime || '',
        endTime: existing?.endTime || eventInfo.endTime || '',
        period: existing?.period || defaultPeriod,
        notes: existing?.notes || '',
        locationAddress: existing?.locationAddress || existing?.location_address || '',
        taskId: existing?.id || null,
      };
    });
    return initial;
  });

  const hasExistingTasks = existingTasks.filter((t) => t.sourceId === event?.id).length > 0;

  const toggleStep = (key) => {
    setSteps((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
  };

  const updateStep = (key, field, value) => {
    setSteps((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const visibleSteps = useMemo(
    () => getVisibleSteps(eventInfo.affaireType),
    [eventInfo.affaireType],
  );

  const enabledSteps = useMemo(
    () => visibleSteps.filter((s) => steps[s.key]?.enabled),
    [steps, visibleSteps],
  );

  // Déterminer la section en fonction du type de step + affaire
  const getSectionForStep = (stepKey) => {
    if (stepKey === 'preparation') {
      return AFFAIRE_TYPE_SECTIONS[eventInfo.affaireType] || 'prep_locations';
    }
    const stepDef = TASK_STEPS.find((s) => s.key === stepKey);
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
    Location: 'location',
    Prestation: 'prestation',
    Vente: 'vente',
    Installation: 'installation',
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
      const displayEventsToCreate = enabledSteps.map((step) => {
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
          title: `${step.emoji} ${step.label}${eventInfo.cleanSummary ? ` — ${eventInfo.cleanSummary}` : ''}`,
          notes: s.notes || '',
          source_type: sourceType,
          source_id: event.id,
          google_event_title: eventInfo.cleanSummary || eventInfo.summary,
          affaire_num: eventInfo.affaireNum || null,
          status: STATUS.PENDING,
          location_address: s.locationAddress || null,
        };
      });

      await api.createTasksBatch(tasksToCreate);
      toast.success(
        `${tasksToCreate.length} tâche${tasksToCreate.length > 1 ? 's' : ''} créée${tasksToCreate.length > 1 ? 's' : ''}`,
      );
      // Passer la date de la première tâche pour naviguer automatiquement
      const firstTaskDate = tasksToCreate[0]?.date || null;
      onSave?.(firstTaskDate);
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
    <Modal open onClose={onClose} size="lg" className="etm-modal no-drag-resize">
      <ModalHeader icon={<Calendar size={18} />} onClose={onClose}>
        <span className="etm-header-title">Définir les tâches</span>
        <span className="etm-event-title">{eventInfo.summary}</span>
      </ModalHeader>

      <ModalBody>
        <div className="etm-event-summary">
          {eventInfo.affaireNum && (
            <AffaireBadge numero={eventInfo.affaireNum} type={eventInfo.affaireType} showIcon />
          )}
          {eventInfo.startTime && (
            <span className="etm-badge time">
              <Clock size={12} /> {eventInfo.startTime}
              {eventInfo.endTime ? ` → ${eventInfo.endTime}` : ''}
            </span>
          )}
          {eventInfo.location && (
            <span className="etm-badge location">
              <MapPin size={12} /> {eventInfo.location}
            </span>
          )}
        </div>

        {/* Steps */}
        <div className="etm-steps">
          {visibleSteps.map((step) => {
            const s = steps[step.key];
            const Icon = step.icon;
            return (
              <div key={step.key} className={`etm-step ${s.enabled ? 'enabled' : ''}`}>
                <div
                  className="etm-step-header"
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleStep(step.key)}
                >
                  <div
                    className={`etm-step-check ${s.enabled ? 'checked' : ''}`}
                    style={s.enabled ? { background: step.color } : {}}
                  >
                    {s.enabled && <Check size={12} />}
                  </div>
                  <Icon size={16} style={{ color: step.color }} />
                  <span className="etm-step-label">
                    {step.emoji} {step.label}
                  </span>
                </div>

                {s.enabled && (
                  <div className="etm-step-fields">
                    <div className="etm-field">
                      <label>Date</label>
                      <input
                        type="date"
                        value={s.date}
                        onChange={(e) => updateStep(step.key, 'date', e.target.value)}
                      />
                    </div>
                    <div className="etm-field">
                      <label>Période</label>
                      <Select
                        value={s.period}
                        onChange={(e) => updateStep(step.key, 'period', e.target.value)}
                      >
                        <option value="AM">Matin (AM)</option>
                        <option value="PM">Après-midi (PM)</option>
                      </Select>
                    </div>
                    <div className="etm-field">
                      <label>Heure début</label>
                      <input
                        type="time"
                        value={s.time}
                        onChange={(e) => updateStep(step.key, 'time', e.target.value)}
                      />
                    </div>
                    <div className="etm-field">
                      <label>Heure fin</label>
                      <input
                        type="time"
                        value={s.endTime}
                        onChange={(e) => updateStep(step.key, 'endTime', e.target.value)}
                      />
                    </div>
                    <div className="etm-field full">
                      <label>Notes</label>
                      <Input
                        type="text"
                        placeholder="Notes..."
                        value={s.notes}
                        onChange={(e) => updateStep(step.key, 'notes', e.target.value)}
                      />
                    </div>
                    {step.defaultSection === 'courses' && (
                      <div className="etm-field full">
                        <label>
                          <MapPin size={12} /> Lieu
                        </label>
                        <div className="etm-location-row">
                          <Input
                            type="text"
                            placeholder="Adresse ou lieu…"
                            value={s.locationAddress}
                            onChange={(e) =>
                              updateStep(step.key, 'locationAddress', e.target.value)
                            }
                          />
                          {s.locationAddress?.trim() && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.locationAddress.trim())}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="etm-maps-link"
                              title="Ouvrir dans Google Maps"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MapPin size={14} />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ModalBody>

      <ModalFooter className="etm-footer">
        {hasExistingTasks && (
          <Button
            variant="ghost"
            className="etm-btn danger"
            onClick={handleDeleteAll}
            disabled={deleting}
          >
            {deleting ? <Loader size={14} className="spin" /> : <AlertCircle size={14} />}
            Supprimer les tâches
          </Button>
        )}
        <div className="etm-footer-right">
          <Button variant="ghost" className="etm-btn secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="ghost"
            className="etm-btn primary"
            onClick={handleSave}
            disabled={saving || enabledSteps.length === 0}
          >
            {saving ? <Loader size={14} className="spin" /> : <Check size={14} />}
            {hasExistingTasks ? 'Mettre à jour' : 'Créer'} {enabledSteps.length} tâche
            {enabledSteps.length > 1 ? 's' : ''}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

export default EventTaskModal;
