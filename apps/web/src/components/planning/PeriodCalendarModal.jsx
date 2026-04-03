import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, addMonths, subMonths,
  isSameMonth, isSameDay, isWeekend, isBefore, isAfter, parseISO
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X, AlertTriangle, Check, Clock, CalendarPlus, Briefcase, User } from 'lucide-react';
import api from '../../utils/api';
import { Button, Input, Checkbox, InlineAlert } from '@/design-system';
import { PERIOD_MENU_ITEMS } from '../personnel/PersonnelContextMenu';
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

  // ═══ RDV-specific state ═══
  const isRdv = periodType === 'rdv';
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [rdvCategory, setRdvCategory] = useState('pro'); // 'pro' | 'perso'
  const [syncGoogle, setSyncGoogle] = useState(true);
  const [googleSynced, setGoogleSynced] = useState(false);
  const [hasGoogleToken, setHasGoogleToken] = useState(true);

  useEffect(() => {
    if (isRdv) api.getGoogleTokenStatus().then(s => setHasGoogleToken(!!s?.hasToken)).catch(() => setHasGoogleToken(false));
  }, [isRdv]);

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

  // ═══ Google Calendar sync for RDV ═══
  const createGoogleCalendarEvent = async (dateStr, endDateStr) => {
    try {
      const tokenStatus = await api.getGoogleTokenStatus();
      if (!tokenStatus?.hasToken) return null;

      const categoryLabel = rdvCategory === 'pro' ? '🏢 Pro' : '🏠 Perso';
      const summary = `${categoryLabel} — RDV ${person.firstName} ${person.lastName || ''}`.trim();
      const description = reason ? `Motif : ${reason}` : '';

      const eventData = {
        summary,
        description,
        start: { dateTime: `${dateStr}T${startTime}:00`, timeZone: 'Europe/Paris' },
        end: { dateTime: `${endDateStr}T${endTime}:00`, timeZone: 'Europe/Paris' },
        colorId: rdvCategory === 'pro' ? '9' : '2', // Blueberry / Sage
      };

      const created = await api.createGoogleEvent(eventData);
      return created.id; // google_event_id
    } catch (err) {
      console.warn('Google Calendar sync error:', err);
      return null;
    }
  };

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

      const dateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(end, 'yyyy-MM-dd');

      // Google Calendar sync for RDV
      let googleEventId = null;
      if (isRdv && syncGoogle) {
        googleEventId = await createGoogleCalendarEvent(dateStr, endDateStr);
        if (googleEventId) setGoogleSynced(true);
      }

      await api.createAvailability({
        person_id: person.id,
        start_date: dateStr,
        end_date: endDateStr,
        start_period: isRdv ? 'AM' : startPeriod,
        end_period: isRdv ? 'PM' : endPeriod,
        type: periodType,
        reason: reason.trim() || undefined,
        source,
        // RDV-specific fields
        ...(isRdv ? {
          start_time: startTime,
          end_time: endTime,
          rdv_category: rdvCategory,
          google_event_id: googleEventId || undefined,
        } : {}),
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
      setGoogleSynced(false);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="pcm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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
              {/* ═══ RDV : Horaires précis ═══ */}
              {isRdv ? (
                <>
                  <div className="pcm-option-row pcm-rdv-times">
                    <label><Clock size={14} /> Horaires :</label>
                    <div className="pcm-time-inputs">
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="pcm-time-input"
                      />
                      <span className="pcm-time-sep">→</span>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="pcm-time-input"
                      />
                    </div>
                    <span className="pcm-date-display">{format(startDate, 'dd MMM yyyy', { locale: fr })}</span>
                  </div>

                  {/* Pro / Perso toggle */}
                  <div className="pcm-option-row pcm-rdv-category">
                    <label>Type :</label>
                    <div className="pcm-category-toggle">
                      <button
                        className={`pcm-cat-btn ${rdvCategory === 'pro' ? 'active pro' : ''}`}
                        onClick={() => setRdvCategory('pro')}
                      >
                        <Briefcase size={14} /> Pro
                      </button>
                      <button
                        className={`pcm-cat-btn ${rdvCategory === 'perso' ? 'active perso' : ''}`}
                        onClick={() => setRdvCategory('perso')}
                      >
                        <User size={14} /> Perso
                      </button>
                    </div>
                  </div>

                  {/* Google Calendar sync toggle */}
                  <div className="pcm-option-row pcm-google-sync">
                    <label className="pcm-checkbox-label">
                      <Checkbox
                        checked={syncGoogle}
                        onChange={(e) => setSyncGoogle(e.target.checked)}
                      />
                      <CalendarPlus size={14} />
                      <span>Synchroniser Google Agenda</span>
                    </label>
                    {!hasGoogleToken && syncGoogle && (
                      <span className="pcm-google-warn">⚠ Non connecté à Google</span>
                    )}
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}

              <div className="pcm-days-count" style={{ color: periodInfo.color }}>
                {isRdv ? (
                  <>{startTime} — {endTime}</>
                ) : (
                  <>{selectedDays} jour{selectedDays > 1 ? 's' : ''} ouvré{selectedDays > 1 ? 's' : ''}</>
                )}
              </div>

              {/* Motif */}
              <div className="pcm-reason">
                <label>Motif (optionnel) :</label>
                <Input
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
                <InlineAlert variant="info">
                  Cette demande sera soumise à validation par les administrateurs
                </InlineAlert>
              )}

              {error && (
                <InlineAlert>{error}</InlineAlert>
              )}
            </div>
          )}

          {/* Message de succès */}
          {successCount > 0 && !startDate && (
            <div className="pcm-success-banner" style={{ borderColor: periodInfo.color }}>
              <Check size={16} style={{ color: periodInfo.color }} />
              <span>
                {successCount} période{successCount > 1 ? 's' : ''} enregistrée{successCount > 1 ? 's' : ''}
                {googleSynced && ' — synchronisé avec Google Agenda ✓'}
                {' — sélectionnez de nouvelles dates ou fermez'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pcm-footer">
          <Button variant="ghost" onClick={onClose}>
            {successCount > 0 ? 'Fermer' : 'Annuler'}
          </Button>
          <Button
            variant="primary"
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
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PeriodCalendarModal;
