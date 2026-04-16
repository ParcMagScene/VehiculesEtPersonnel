import React from 'react';
import {
  ChevronDown,
  Plus,
  Check,
  X,
  Edit2,
  Trash2,
  Link,
  RefreshCw,
  Repeat,
  AlertCircle,
} from 'lucide-react';
import { Accordion, Button, Divider, Input, Select, Tooltip } from '@/design-system';
import { STATUS_COLORS } from '../../constants/colors';
import { SECTIONS, OPS_SECTION_KEYS, DAYS_FR } from './planningConstants';

// ═══════════════════════════════════════════════════════════════
// PlanningDaySection — renders a single day-view section
// ═══════════════════════════════════════════════════════════════
const PlanningDaySection = React.memo(function PlanningDaySection({
  sectionKey,
  grouped,
  affairesBySection,
  googleRdvEvents,
  mergedOtherEvents,
  collapsedSections,
  toggleSectionCollapse,
  collapsedPastEvents,
  setCollapsedPastEvents,
  collapsedFutureEvents,
  setCollapsedFutureEvents,
  renderTaskRow,
  renderGoogleRdvRow,
  renderRdvRow,
  renderIcalEventRow,
  selectedDate,
  icalCalendars,
  icalLoading,
  onShowIcalManager,
  onRefreshIcal,
}) {
  const info = SECTIONS[sectionKey];
  const sectionTasks = grouped[sectionKey] || [];
  const sectionAffaires = affairesBySection[sectionKey] || [];
  const isRdv = sectionKey === 'rdv';
  const isEvenements = sectionKey === 'evenements';
  const googleRdvCount = isRdv ? googleRdvEvents.length : 0;
  const mergedCount = isEvenements ? mergedOtherEvents.length : 0;
  const affaireCount = isRdv ? sectionAffaires.length : 0;
  const totalCount = sectionTasks.length + affaireCount + googleRdvCount + mergedCount;

  // Masquer les sections opérationnelles vides
  if (!isRdv && !isEvenements && totalCount === 0) return null;

  const isCollapsible = isEvenements;
  const isCollapsed = isCollapsible && collapsedSections[sectionKey];

  return (
    <div
      className={`task-section ${isRdv ? 'rdv-section' : ''} ${isEvenements ? 'evenements-section' : ''} ${isCollapsed ? 'section-collapsed' : ''}`}
    >
      <div
        className={`section-header ${isCollapsible ? 'collapsible' : ''}`}
        style={{
          borderBottomColor: info.color,
          background: `color-mix(in srgb, ${info.color} 10%, var(--theme-bg-secondary, #f8fafc))`,
        }}
        onClick={isCollapsible ? () => toggleSectionCollapse(sectionKey) : undefined}
      >
        <h4 style={{ color: info.color }}>
          {isCollapsible && (
            <ChevronDown
              size={16}
              className={`section-chevron ${isCollapsed ? 'collapsed' : ''}`}
            />
          )}
          <span>{info.emoji}</span>
          {info.label}
        </h4>
        <span className="section-count" style={{ background: info.color }}>
          {totalCount}
        </span>
        {isEvenements && (
          <div className="ical-header-actions" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" className="ical-manage-btn" onClick={onShowIcalManager}>
              <Link size={13} /> iCal ({icalCalendars.length})
            </Button>
            <Tooltip content="Rafraîchir les événements iCal">
              <Button variant="ghost" className="ical-refresh-btn" onClick={onRefreshIcal}>
                <RefreshCw size={13} className={icalLoading ? 'spinning' : ''} />
              </Button>
            </Tooltip>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <>
          {/* Section RDV : Google Calendar RDV + affaires avec "rdv" */}
          {isRdv && googleRdvEvents.map(renderGoogleRdvRow)}
          {isRdv && sectionAffaires.map(renderRdvRow)}
          {isRdv && totalCount === 0 && (
            <div className="section-empty-msg">Aucun rendez-vous pour cette date</div>
          )}

          {/* Section Événements Google + iCal : liste fusionnée triée */}
          {isEvenements &&
            (() => {
              const now = new Date();
              const viewDate = selectedDate;
              const classifyEvent = (ev) => {
                const start =
                  ev._source === 'ical'
                    ? ev.start || ''
                    : ev.start?.dateTime || ev.start?.date || '';
                const end =
                  ev._source === 'ical' ? ev.end || '' : ev.end?.dateTime || ev.end?.date || '';
                const startDate = start.slice(0, 10);
                const evStart = start
                  ? new Date(start.includes('T') ? start : start + 'T00:00:00')
                  : null;
                const evEnd = end ? new Date(end.includes('T') ? end : end + 'T23:59:59') : null;
                const isSelected = startDate === viewDate;
                const isOngoing = evStart && evEnd && evStart <= now && now <= evEnd;
                if (isSelected || isOngoing) return 'today';
                if (startDate < viewDate) return 'past';
                return 'future';
              };
              const pastEvents = [];
              const todayEvents = [];
              const futureEvents = [];
              mergedOtherEvents.forEach((ev) => {
                const cls = classifyEvent(ev);
                if (cls === 'past') pastEvents.push(ev);
                else if (cls === 'today') todayEvents.push(ev);
                else futureEvents.push(ev);
              });
              const renderEvRow = (ev) =>
                ev._source === 'ical' ? renderIcalEventRow(ev) : renderGoogleRdvRow(ev);
              return (
                <>
                  {pastEvents.length > 0 && (
                    <Accordion
                      title={
                        <>
                          <span className="subgroup-label">Événements précédents</span>{' '}
                          <span className="subgroup-count">{pastEvents.length}</span>
                        </>
                      }
                      open={!collapsedPastEvents}
                      onToggle={() => setCollapsedPastEvents((v) => !v)}
                      className="events-subgroup events-past-group"
                    >
                      <div className="events-subgroup-content">{pastEvents.map(renderEvRow)}</div>
                    </Accordion>
                  )}
                  {todayEvents.length > 0 && (
                    <div className="events-today-group">{todayEvents.map(renderEvRow)}</div>
                  )}
                  {futureEvents.length > 0 && (
                    <Accordion
                      title={
                        <>
                          <span className="subgroup-label">Événements suivants</span>{' '}
                          <span className="subgroup-count">{futureEvents.length}</span>
                        </>
                      }
                      open={!collapsedFutureEvents}
                      onToggle={() => setCollapsedFutureEvents((v) => !v)}
                      className="events-subgroup events-future-group"
                    >
                      <div className="events-subgroup-content">{futureEvents.map(renderEvRow)}</div>
                    </Accordion>
                  )}
                </>
              );
            })()}

          {/* Sections opérationnelles : uniquement des tâches */}
          {!isRdv && !isEvenements && sectionTasks.map(renderTaskRow)}
          {!isRdv && !isEvenements && sectionTasks.length === 0 && (
            <div className="section-empty-msg">Aucune tâche</div>
          )}
        </>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// PlanningIcalManager — inline iCal calendars management panel
// ═══════════════════════════════════════════════════════════════
const PlanningIcalManager = React.memo(function PlanningIcalManager({
  icalCalendars,
  icalForm,
  setIcalForm,
  onSave,
  onDelete,
}) {
  return (
    <div className="ical-manager-panel">
      <div className="ical-manager-header">
        <h5>
          <Link size={14} /> Calendriers iCal
        </h5>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIcalForm({ name: '', url: '', color: STATUS_COLORS.info })}
        >
          <Plus size={14} /> Ajouter
        </Button>
      </div>

      {icalForm && (
        <div className="ical-form">
          <Input
            type="text"
            placeholder="Nom du calendrier"
            value={icalForm.name}
            onChange={(e) => setIcalForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <Input
            type="url"
            placeholder="URL iCal (.ics)"
            value={icalForm.url}
            onChange={(e) => setIcalForm((f) => ({ ...f, url: e.target.value }))}
          />
          <div className="ical-form-row">
            <input
              type="color"
              value={icalForm.color || STATUS_COLORS.info}
              onChange={(e) => setIcalForm((f) => ({ ...f, color: e.target.value }))}
              title="Couleur"
            />
            <div className="form-actions">
              <Button
                variant="success"
                size="sm"
                iconOnly
                onClick={onSave}
                aria-label="Enregistrer"
              >
                <Check size={14} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={() => setIcalForm(null)}
                aria-label="Annuler"
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="ical-calendar-list">
        {icalCalendars.length === 0 && !icalForm && (
          <div className="ical-empty">Aucun calendrier iCal configuré</div>
        )}
        {icalCalendars.map((cal) => (
          <div
            key={cal.id}
            className={`ical-calendar-item ${cal.lastSyncError ? 'has-error' : ''}`}
          >
            <span
              className="ical-color-dot"
              style={{ background: cal.color || STATUS_COLORS.info }}
            />
            <div className="ical-cal-info">
              <span className="ical-cal-name">{cal.name}</span>
              <span className="ical-cal-url" title={cal.url}>
                {cal.url.length > 50 ? cal.url.slice(0, 50) + '…' : cal.url}
              </span>
              {cal.lastSyncError && (
                <span className="ical-cal-error">
                  <AlertCircle size={11} /> {cal.lastSyncError}
                </span>
              )}
            </div>
            <div className="ical-cal-actions">
              <Tooltip content="Modifier">
                <Button variant="ghost" onClick={() => setIcalForm({ ...cal })}>
                  <Edit2 size={13} />
                </Button>
              </Tooltip>
              <Tooltip content="Supprimer">
                <Button variant="ghost" className="delete" onClick={() => onDelete(cal.id)}>
                  <Trash2 size={13} />
                </Button>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// PlanningRecurringPanel — recurring tasks management panel
// ═══════════════════════════════════════════════════════════════
const PlanningRecurringPanel = React.memo(function PlanningRecurringPanel({
  recurringTasks,
  recurringForm,
  setRecurringForm,
  onSave,
  onDelete,
}) {
  return (
    <div className="recurring-panel">
      <div className="recurring-panel-header">
        <h3>
          <Repeat size={18} /> Tâches Récurrentes
        </h3>
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            setRecurringForm({
              title: '',
              section: 'manual',
              recurrence: 'daily',
              dayOfWeek: 1,
              dayOfMonth: 1,
              time: '08:00',
              period: 'AM',
              notes: '',
            })
          }
        >
          <Plus size={14} /> Ajouter
        </Button>
      </div>

      {/* Formulaire création/édition */}
      {recurringForm && (
        <div className="recurring-form">
          <div className="recurring-form-row">
            <Input
              type="text"
              placeholder="Titre de la tâche..."
              value={recurringForm.title || ''}
              onChange={(e) => setRecurringForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
            />
            <Select
              value={recurringForm.section || 'manual'}
              onChange={(e) => setRecurringForm((f) => ({ ...f, section: e.target.value }))}
            >
              {Object.entries(SECTIONS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.emoji} {v.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="recurring-form-row">
            <Select
              value={recurringForm.recurrence || 'daily'}
              onChange={(e) => setRecurringForm((f) => ({ ...f, recurrence: e.target.value }))}
            >
              <option value="daily">Journalière</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuelle</option>
            </Select>
            {recurringForm.recurrence === 'weekly' && (
              <Select
                value={recurringForm.dayOfWeek ?? 1}
                onChange={(e) =>
                  setRecurringForm((f) => ({ ...f, dayOfWeek: parseInt(e.target.value) }))
                }
              >
                {DAYS_FR.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
            )}
            {recurringForm.recurrence === 'monthly' && (
              <Select
                value={recurringForm.dayOfMonth ?? 1}
                onChange={(e) =>
                  setRecurringForm((f) => ({ ...f, dayOfMonth: parseInt(e.target.value) }))
                }
              >
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </Select>
            )}
            <input
              type="time"
              value={recurringForm.time || '08:00'}
              onChange={(e) => setRecurringForm((f) => ({ ...f, time: e.target.value }))}
            />
            <Select
              value={recurringForm.period || 'AM'}
              onChange={(e) => setRecurringForm((f) => ({ ...f, period: e.target.value }))}
            >
              <option value="AM">Matin</option>
              <option value="PM">Après-midi</option>
            </Select>
          </div>
          <div className="recurring-form-row">
            <Input
              type="text"
              placeholder="Notes (optionnel)"
              value={recurringForm.notes || ''}
              onChange={(e) => setRecurringForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <div className="form-actions">
              <Button
                variant="success"
                size="sm"
                iconOnly
                onClick={onSave}
                aria-label="Enregistrer"
              >
                <Check size={14} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={() => setRecurringForm(null)}
                aria-label="Annuler"
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="recurring-list">
        {recurringTasks.length === 0 && !recurringForm && (
          <div className="recurring-empty">Aucune tâche récurrente configurée</div>
        )}
        {recurringTasks.map((rt) => (
          <div key={rt.id} className={`recurring-item ${rt.active ? '' : 'inactive'}`}>
            <div className="recurring-item-info">
              <span className="recurring-item-title">
                {SECTIONS[rt.section]?.emoji || '📋'} {rt.title}
              </span>
              <span className="recurring-item-meta">
                {rt.recurrence === 'daily' && '🔄 Tous les jours'}
                {rt.recurrence === 'weekly' && `🔄 Chaque ${DAYS_FR[rt.dayOfWeek] || ''}`}
                {rt.recurrence === 'monthly' && `🔄 Le ${rt.dayOfMonth} de chaque mois`}
                {rt.time && ` à ${rt.time}`}
                {' · '}
                {SECTIONS[rt.section]?.label || rt.section}
              </span>
            </div>
            <div className="recurring-item-actions">
              <Tooltip content="Modifier">
                <Button variant="ghost" onClick={() => setRecurringForm({ ...rt })}>
                  <Edit2 size={14} />
                </Button>
              </Tooltip>
              <Tooltip content="Supprimer">
                <Button variant="ghost" className="delete" onClick={() => onDelete(rt.id)}>
                  <Trash2 size={14} />
                </Button>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// PlanningDayView — full day layout with sections
// ═══════════════════════════════════════════════════════════════
const PlanningDayView = React.memo(function PlanningDayView({
  grouped,
  affairesBySection,
  googleRdvEvents,
  mergedOtherEvents,
  renderTaskRow,
  renderGoogleRdvRow,
  renderRdvRow,
  renderIcalEventRow,
  collapsedSections,
  toggleSectionCollapse,
  collapsedPastEvents,
  setCollapsedPastEvents,
  collapsedFutureEvents,
  setCollapsedFutureEvents,
  selectedDate,
  icalCalendars,
  icalLoading,
  showIcalManager,
  setShowIcalManager,
  icalForm,
  setIcalForm,
  onSaveIcal,
  onDeleteIcal,
  onRefreshIcal,
}) {
  const sectionProps = {
    grouped,
    affairesBySection,
    googleRdvEvents,
    mergedOtherEvents,
    collapsedSections,
    toggleSectionCollapse,
    collapsedPastEvents,
    setCollapsedPastEvents,
    collapsedFutureEvents,
    setCollapsedFutureEvents,
    renderTaskRow,
    renderGoogleRdvRow,
    renderRdvRow,
    renderIcalEventRow,
    selectedDate,
    icalCalendars,
    icalLoading,
    onShowIcalManager: () => setShowIcalManager((v) => !v),
    onRefreshIcal,
  };

  return (
    <div className="sections-container">
      {/* ── En-têtes de colonnes (sticky) ── */}
      <div className="ev-columns-header sticky-columns-header">
        <span className="ev-col-h ev-col-h-check">✔</span>
        <span className="ev-col-h ev-col-h-affaire">Affaire</span>
        <span className="ev-col-h ev-col-h-nom">Titre / Nom</span>
        <span className="ev-col-h ev-col-h-client">Client</span>
        <span className="ev-col-h ev-col-h-spacer"></span>
        <span className="ev-col-h ev-col-h-time">Heure</span>
        <span className="ev-col-h ev-col-h-actions">Actions</span>
      </div>

      {/* ── Autres Événements : tout en haut avec gestion iCal ── */}
      <div className="sections-group sections-top-events">
        <PlanningDaySection sectionKey="evenements" {...sectionProps} />

        {showIcalManager && (
          <PlanningIcalManager
            icalCalendars={icalCalendars}
            icalForm={icalForm}
            setIcalForm={setIcalForm}
            onSave={onSaveIcal}
            onDelete={onDeleteIcal}
          />
        )}
      </div>

      {/* ── RDV ── */}
      <div className="sections-group sections-events-group">
        <PlanningDaySection sectionKey="rdv" {...sectionProps} />
      </div>

      <Divider label="Opérations & Tâches" style={{ margin: '18px 0 14px' }} />
      <div className="sections-group sections-ops-group">
        {OPS_SECTION_KEYS.map((key) => (
          <PlanningDaySection key={key} sectionKey={key} {...sectionProps} />
        ))}
      </div>
    </div>
  );
});

export { PlanningDaySection, PlanningIcalManager, PlanningRecurringPanel, PlanningDayView };
