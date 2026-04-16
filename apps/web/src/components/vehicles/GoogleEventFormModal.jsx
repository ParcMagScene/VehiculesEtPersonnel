import './GoogleEventFormModal.css';

import { format } from 'date-fns';
import { AlignLeft, Calendar, Clock, MapPin, Save, Type } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button, Input, Textarea, Toggle } from '@/design-system';

import { useDirtyForm } from '../../hooks/useDirtyForm';
import { useToast } from '../../hooks/useToast';
import AddressAutocomplete from '../AddressAutocomplete';

function GoogleEventFormModal({ isOpen, onClose, mode, event, onSave, currentDate }) {
  const toast = useToast();
  const [formData, setFormData] = useState({
    summary: '',
    startDateTime: '',
    endDateTime: '',
    allDay: false,
    startDate: '',
    endDate: '',
    description: '',
    location: '',
  });
  const [saving, setSaving] = useState(false);
  const { resetDirty, guardClose } = useDirtyForm(formData);
  const safeClose = guardClose(onClose);
  const needsResetRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && event) {
      const isAllDay = !!event.start?.date && !event.start?.dateTime;
      setFormData({
        summary: event.summary || '',
        startDateTime: event.start?.dateTime ? toLocalInput(event.start.dateTime) : '',
        endDateTime: event.end?.dateTime ? toLocalInput(event.end.dateTime) : '',
        allDay: isAllDay,
        startDate:
          event.start?.date ||
          (event.start?.dateTime ? format(new Date(event.start.dateTime), 'yyyy-MM-dd') : ''),
        endDate:
          event.end?.date ||
          (event.end?.dateTime ? format(new Date(event.end.dateTime), 'yyyy-MM-dd') : ''),
        description: event.description || '',
        location: event.location || '',
      });
    } else {
      // Create mode — defaults based on currentDate
      const base = currentDate || new Date();
      const now = new Date();
      const start = new Date(base);
      start.setHours(now.getHours(), 0, 0, 0);
      if (start.getHours() >= 18) start.setHours(8, 0, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 1);

      setFormData({
        summary: '',
        startDateTime: toLocalInput(start.toISOString()),
        endDateTime: toLocalInput(end.toISOString()),
        allDay: false,
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(start, 'yyyy-MM-dd'),
        description: '',
        location: '',
      });
    }
    needsResetRef.current = true;
  }, [isOpen, mode, event, currentDate]);

  // Reset dirty tracking after initial form data load
  useEffect(() => {
    if (needsResetRef.current) {
      needsResetRef.current = false;
      resetDirty();
    }
  }, [formData, resetDirty]);

  const toLocalInput = (isoString) => {
    const d = new Date(isoString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.summary.trim()) {
      toast.warning('Le titre est requis');
      return;
    }

    setSaving(true);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const eventData = {
        summary: formData.summary.trim(),
      };

      if (formData.description.trim()) {
        eventData.description = formData.description.trim();
      }
      if (formData.location.trim()) {
        eventData.location = formData.location.trim();
      }

      if (formData.allDay) {
        eventData.start = { date: formData.startDate };
        // Google Calendar expects exclusive end date for all-day events
        let endDate = formData.endDate || formData.startDate;
        if (endDate <= formData.startDate) {
          const d = new Date(formData.startDate);
          d.setDate(d.getDate() + 1);
          endDate = format(d, 'yyyy-MM-dd');
        }
        eventData.end = { date: endDate };
      } else {
        if (!formData.startDateTime || !formData.endDateTime) {
          toast.warning('Les dates de début et fin sont requises');
          setSaving(false);
          return;
        }
        eventData.start = {
          dateTime: new Date(formData.startDateTime).toISOString(),
          timeZone,
        };
        eventData.end = {
          dateTime: new Date(formData.endDateTime).toISOString(),
          timeZone,
        };
      }

      await onSave(eventData);
      onClose();
    } catch (error) {
      console.error('Erreur sauvegarde événement:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="event-form-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && safeClose()}
    >
      <div
        className="event-form-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="event-form-header">
          <Calendar size={20} />
          <h2>{mode === 'edit' ? "Modifier l'événement" : 'Nouvel événement Google'}</h2>
          <Button variant="ghost" className="event-form-close" onClick={safeClose}>
            ×
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="event-form-body">
            {/* Titre */}
            <div className="event-form-field">
              <label>
                <Type size={15} /> Titre
              </label>
              <Input
                type="text"
                value={formData.summary}
                onChange={(e) => handleChange('summary', e.target.value)}
                placeholder="Titre de l'événement"
                autoFocus
                required
              />
            </div>

            {/* Journée entière toggle */}
            <div className="event-form-field event-form-toggle">
              <label>
                <Clock size={15} /> Journée entière
              </label>
              <Toggle
                checked={formData.allDay}
                onChange={(e) => handleChange('allDay', e.target.checked)}
              />
            </div>

            {/* Dates */}
            {formData.allDay ? (
              <div className="event-form-row">
                <div className="event-form-field">
                  <label>Date de début</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleChange('startDate', e.target.value)}
                    required
                  />
                </div>
                <div className="event-form-field">
                  <label>Date de fin</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleChange('endDate', e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="event-form-row">
                <div className="event-form-field">
                  <label>Début</label>
                  <input
                    type="datetime-local"
                    value={formData.startDateTime}
                    onChange={(e) => handleChange('startDateTime', e.target.value)}
                    required
                  />
                </div>
                <div className="event-form-field">
                  <label>Fin</label>
                  <input
                    type="datetime-local"
                    value={formData.endDateTime}
                    onChange={(e) => handleChange('endDateTime', e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Lieu */}
            <div className="event-form-field">
              <label>
                <MapPin size={15} /> Lieu
              </label>
              <AddressAutocomplete
                value={formData.location}
                onChange={(val) => handleChange('location', val)}
                placeholder="Adresse ou lieu"
              />
            </div>

            {/* Description */}
            <div className="event-form-field">
              <label>
                <AlignLeft size={15} /> Description
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Description de l'événement"
                rows={4}
              />
            </div>
          </div>

          <div className="event-form-footer">
            <Button variant="ghost" onClick={safeClose}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              <Save size={16} />
              {saving
                ? 'Enregistrement...'
                : mode === 'edit'
                  ? 'Mettre à jour'
                  : "Créer l'événement"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GoogleEventFormModal;
