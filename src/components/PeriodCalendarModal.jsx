import React, { useState, useMemo, useCallback } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, addMonths, subMonths,
  isSameMonth, isSameDay, isWeekend, isBefore, isAfter, parseISO
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X, AlertTriangle, Check } from 'lucide-react';
import api from '../utils/api';
import { PERIOD_MENU_ITEMS } from './PersonnelContextMenu';
import './PeriodCalendarModal.css';

// Jours ouvrés entre deux dates
const countBusinessDays = (start, end) => {
  const days = eachDayOfInterval({ start, end });
  return days.filter(d => !isWeekend(d)).length;
};

const PeriodCalendarModal = ({ person, periodType, onClose, onCreated, isAdmin = false }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);
  const [startPeriod, setStartPeriod] = useState('AM'); // AM = journée entière, PM = après-midi
  const [endPeriod, setEndPeriod] = useState('PM'); // PM = journée entière, AM = matin
  const [reason, setReason] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successCount, setSuccessCount] = useState(0);
  const [savedRanges, setSavedRanges] = useState([]);

  const periodInfo = PERIOD_MENU_ITEMS.find(p => p.type === periodType) || PERIOD_MENU_ITEMS[0];

  // Calcul des jours du calendrier (grille 6 semaines)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Range sélectionnée (pour highlight)
  const isInRange = useCallback((day) => {
    if (!startDate) return false;
    const end = endDate || hoverDate;
    if (!end) return isSameDay(day, startDate);
    const rangeStart = isBefore(startDate, end) ? startDate : end;
    const rangeEnd = isAfter(startDate, end) ? startDate : end;
    return (isSameDay(day, rangeStart) || isAfter(day, rangeStart)) &&
           (isSameDay(day, rangeEnd) || isBefore(day, rangeEnd));
  }, [startDate, endDate, hoverDate]);

  const isRangeStart = useCallback((day) => {
    if (!startDate) return false;
    const end = endDate || hoverDate;
    if (!end) return isSameDay(day, startDate);
    return isSameDay(day, isBefore(startDate, end) ? startDate : end);
  }, [startDate, endDate, hoverDate]);

  const isRangeEnd = useCallback((day) => {
    if (!startDate) return false;
    const end = endDate || hoverDate;
    if (!end) return isSameDay(day, startDate);
    return isSameDay(day, isAfter(startDate, end) ? startDate : end);
  }, [startDate, endDate, hoverDate]);

  // Gestion du clic sur un jour
  const handleDayClick = (day) => {
    if (!startDate || endDate) {
      // Premier clic ou reset
      setStartDate(day);
      setEndDate(null);
      setConflicts([]);
    } else {
      // Deuxième clic : fixer la fin
      const start = isBefore(day, startDate) ? day : startDate;
      const end = isAfter(day, startDate) ? day : startDate;
      setStartDate(start);
      setEndDate(end);
      // Vérifier les conflits
      checkConflicts(start, end);
    }
  };

  // Vérifier les conflits
  const checkConflicts = async (start, end) => {
    try {
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      const data = await api.getAvailabilities({ personId: person.id, startDate: startStr, endDate: endStr });
      const existing = Array.isArray(data) ? data : (data.availabilities || []);
      // Filtrer les conflits (pas les rejetés)
      const activeConflicts = existing.filter(a => a.status !== 'rejected');
      setConflicts(activeConflicts);
    } catch {
      // Pas bloquant
      setConflicts([]);
    }
  };

  // Nombre de jours ouvrés sélectionnés
  const selectedDays = useMemo(() => {
    if (!startDate) return 0;
    const end = endDate || startDate;
    let days = countBusinessDays(startDate, end);
    if (startPeriod === 'PM') days -= 0.5;
    if (endPeriod === 'AM') days -= 0.5;
    return Math.max(0, days);
  }, [startDate, endDate, startPeriod, endPeriod]);

  // Soumission
  const handleSubmit = async () => {
    if (!startDate || submitting) return;
    const end = endDate || startDate;

    setSubmitting(true);
    setError(null);

    try {
      // Pour les congés : la source détermine si c'est une demande (pending) ou un ajout admin (approved)
      // Pour les autres types : toujours auto-approuvé
      const source = periodInfo.requiresApproval && !isAdmin ? 'request' : 'admin';

      await api.createAvailability({
        person_id: person.id,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(end, 'yyyy-MM-dd'),
        start_period: startPeriod,
        end_period: endPeriod,
        type: periodType,
        reason: reason.trim() || undefined,
        source,
      });

      if (onCreated) onCreated();
      setSuccessCount(c => c + 1);
      // Sauvegarder la plage pour la garder surlignée
      setSavedRanges(prev => [...prev, { start: new Date(startDate), end: new Date(end) }]);
      // Reset pour permettre un nouvel ajout
      setStartDate(null);
      setEndDate(null);
      setHoverDate(null);
      setStartPeriod('AM');
      setEndPeriod('PM');
      setReason('');
      setConflicts([]);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="pcm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pcm-modal">
        {/* Header */}
        <div className="pcm-header" style={{ background: periodInfo.color }}>
          <div className="pcm-header-info">
            <span className="pcm-header-emoji">{periodInfo.emoji}</span>
            <div>
              <div className="pcm-header-title">{periodInfo.label}</div>
              <div className="pcm-header-person">{person.firstName} {person.lastName || ''}</div>
            </div>
          </div>
          <button className="pcm-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Calendrier */}
        <div className="pcm-body">
          <div className="pcm-calendar">
            <div className="pcm-cal-nav">
              <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="pcm-nav-btn">
                <ChevronLeft size={18} />
              </button>
              <span className="pcm-cal-month">
                {format(currentMonth, 'MMMM yyyy', { locale: fr })}
              </span>
              <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="pcm-nav-btn">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="pcm-cal-grid">
              {dayNames.map(d => (
                <div key={d} className="pcm-cal-dayname">{d}</div>
              ))}
              {calendarDays.map((day, i) => {
                const inMonth = isSameMonth(day, currentMonth);
                const weekend = isWeekend(day);
                const inRange = isInRange(day);
                const rangeStart = isRangeStart(day);
                const rangeEnd = isRangeEnd(day);
                const today = isSameDay(day, new Date());
                const isSaved = savedRanges.some(r =>
                  (isSameDay(day, r.start) || isAfter(day, r.start)) &&
                  (isSameDay(day, r.end) || isBefore(day, r.end))
                );

                return (
                  <button
                    key={i}
                    className={[
                      'pcm-cal-day',
                      !inMonth && 'other-month',
                      weekend && 'weekend',
                      inRange && 'in-range',
                      rangeStart && 'range-start',
                      rangeEnd && 'range-end',
                      isSaved && 'saved',
                      today && 'today',
                    ].filter(Boolean).join(' ')}
                    style={(inRange || isSaved) ? { '--range-color': periodInfo.color } : undefined}
                    onClick={() => handleDayClick(day)}
                    onMouseEnter={() => {
                      if (startDate && !endDate) setHoverDate(day);
                    }}
                    onMouseLeave={() => setHoverDate(null)}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options demi-journées */}
          {startDate && (
            <div className="pcm-options">
              <div className="pcm-option-row">
                <label>Début :</label>
                <div className="pcm-period-toggle">
                  <button className={startPeriod === 'AM' ? 'active' : ''} onClick={() => setStartPeriod('AM')}>
                    Matin
                  </button>
                  <button className={startPeriod === 'PM' ? 'active' : ''} onClick={() => setStartPeriod('PM')}>
                    Après-midi
                  </button>
                </div>
                <span className="pcm-date-display">{format(startDate, 'dd MMM yyyy', { locale: fr })}</span>
              </div>
              <div className="pcm-option-row">
                <label>Fin :</label>
                <div className="pcm-period-toggle">
                  <button className={endPeriod === 'AM' ? 'active' : ''} onClick={() => setEndPeriod('AM')}>
                    Matin
                  </button>
                  <button className={endPeriod === 'PM' ? 'active' : ''} onClick={() => setEndPeriod('PM')}>
                    Journée entière
                  </button>
                </div>
                <span className="pcm-date-display">
                  {endDate ? format(endDate, 'dd MMM yyyy', { locale: fr }) : format(startDate, 'dd MMM yyyy', { locale: fr })}
                </span>
              </div>

              <div className="pcm-days-count" style={{ color: periodInfo.color }}>
                {selectedDays} jour{selectedDays > 1 ? 's' : ''} ouvré{selectedDays > 1 ? 's' : ''}
              </div>

              {/* Motif */}
              <div className="pcm-reason">
                <label>Motif (optionnel) :</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={`Motif de ${periodInfo.label.toLowerCase()}…`}
                />
              </div>

              {/* Conflits */}
              {conflicts.length > 0 && (
                <div className="pcm-conflicts">
                  <AlertTriangle size={14} />
                  <span>
                    {conflicts.length} période{conflicts.length > 1 ? 's' : ''} existante{conflicts.length > 1 ? 's' : ''} sur cette plage
                  </span>
                </div>
              )}

              {/* Avertissement approbation */}
              {periodInfo.requiresApproval && !isAdmin && (
                <div className="pcm-approval-notice">
                  <Clock size={14} />
                  <span>Cette demande sera soumise à validation par les administrateurs</span>
                </div>
              )}

              {error && (
                <div className="pcm-error">
                  <AlertTriangle size={14} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Message de succès */}
          {successCount > 0 && !startDate && (
            <div className="pcm-success-banner" style={{ borderColor: periodInfo.color }}>
              <Check size={16} style={{ color: periodInfo.color }} />
              <span>{successCount} période{successCount > 1 ? 's' : ''} enregistrée{successCount > 1 ? 's' : ''} — sélectionnez de nouvelles dates ou fermez</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pcm-footer">
          <button className="pcm-btn-cancel" onClick={onClose}>
            {successCount > 0 ? 'Fermer' : 'Annuler'}
          </button>
          <button
            className="pcm-btn-submit"
            style={{ background: periodInfo.color }}
            disabled={!startDate || submitting}
            onClick={handleSubmit}
          >
            <Check size={16} />
            {submitting ? 'Enregistrement…' : (
              periodInfo.requiresApproval && !isAdmin ? 'Soumettre la demande' : (
                successCount > 0 ? 'Ajouter cette période' : 'Enregistrer'
              )
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PeriodCalendarModal;
