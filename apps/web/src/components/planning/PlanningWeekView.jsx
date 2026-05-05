import {
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Edit2,
  Eye,
  EyeOff,
  Monitor,
  Trash2,
  X,
} from 'lucide-react';
import React from 'react';

import { Button, Tooltip } from '@/design-system';

import { STATUS } from '../../constants';
import { STATUS_COLORS } from '../../constants/colors';
import { AFFAIRE_TYPE_INFO } from '../../utils/affaireConstants';
import { safeParseDate } from '../../utils/dateUtils';
import AffaireBadge from '../AffaireBadge';
import {
  EVENT_TYPES,
  extractAffaireNum,
  normalizeSection,
  SECTIONS,
  todayStr,
} from './planningConstants';

// ═══ WeekMiniCard ═══
// Compact card for the week view — handles task, event, affaire, google types
const WeekMiniCardInner = ({
  item,
  type,
  affaireByNum,
  processedGoogleIds,
  onNavigateToEntity,
  onCycleStatus,
  onEdit,
  onDelete,
  onToggleTaskVisible,
  onToggleDisplayEventVisible,
  onDeleteDisplayEvent,
  onOpenAffaireTaskModal,
  onOpenEventTaskModal,
  onHideAffaire,
}) => {
  if (type === 'task') {
    const isDone = item.status === STATUS.DONE;
    const isProgress = item.status === 'in_progress';
    const sectionInfo = SECTIONS[normalizeSection(item.section || 'manual')] || SECTIONS.manual;
    return (
      <div
        key={`wt-${item.id}`}
        className={`wk-card wk-task ${isDone ? 'done' : ''} ${isProgress ? 'in-progress' : ''} ${item.visible === 0 ? 'hidden-display' : ''}`}
        style={{ borderLeftColor: sectionInfo.color }}
      >
        <Button
          variant="ghost"
          className={`wk-status ${isDone ? 'done' : isProgress ? 'in-progress' : ''}`}
          onClick={() => onCycleStatus(item)}
        >
          {isDone && <Check size={10} />}
          {isProgress && <Clock size={10} />}
        </Button>
        {(() => {
          const an =
            item.affaireNum ||
            extractAffaireNum(item.title) ||
            extractAffaireNum(item.googleEventTitle);
          return an ? (
            <AffaireBadge
              numero={an}
              type={affaireByNum.get(an.toUpperCase())?.type}
              size="sm"
              onNavigate={
                onNavigateToEntity
                  ? (num) => onNavigateToEntity('affaire', { numero: num })
                  : undefined
              }
            />
          ) : null;
        })()}
        {(() => {
          const isP = (item.section || '').startsWith('prep_');
          const cleaned = isP ? item.title.replace(/^🔧\s*Préparation\s*—\s*/i, '') : item.title;
          const an =
            item.affaireNum ||
            extractAffaireNum(item.title) ||
            extractAffaireNum(item.googleEventTitle);
          // Nom de l'événement Google ou titre de l'affaire liée
          const eventLabel =
            item.googleEventTitle ||
            (an && affaireByNum.get(an.toUpperCase())?.event_name) ||
            (an && affaireByNum.get(an.toUpperCase())?.titre) ||
            '';
          const wkDisplayTitle = cleaned || eventLabel || item.title || '-';
          const wkCapTitle = wkDisplayTitle.charAt(0).toUpperCase() + wkDisplayTitle.slice(1);
          return (
            <span className="wk-task-info">
              <span
                className={`wk-title ${isDone ? 'done' : ''}`}
                title={`${an ? an + ' · ' : ''}${item.title}${eventLabel ? ' — ' + eventLabel : ''}`}
              >
                {wkCapTitle}
              </span>
              {eventLabel && (
                <span className="wk-event-label" title={eventLabel}>
                  {eventLabel.length > 20 ? eventLabel.slice(0, 20) + '…' : eventLabel}
                </span>
              )}
            </span>
          );
        })()}
        {item.personFirstName && (
          <span className="wk-person">
            {item.personFirstName?.charAt(0)}
            {item.personLastName?.charAt(0)}
          </span>
        )}
        <div className="wk-actions">
          <Tooltip content="Modifier" position="bottom">
            <Button variant="ghost" onClick={() => onEdit(item)}>
              <Edit2 size={10} />
            </Button>
          </Tooltip>
          <Button
            variant="ghost"
            onClick={() => onToggleTaskVisible(item)}
            title={item.visible === 0 ? 'Afficher' : 'Masquer'}
          >
            {item.visible === 0 ? <EyeOff size={10} /> : <Eye size={10} />}
          </Button>
          <Tooltip content="Supprimer" position="bottom">
            <Button variant="ghost" className="del" onClick={() => onDelete(item.id)}>
              <Trash2 size={10} />
            </Button>
          </Tooltip>
        </div>
      </div>
    );
  }

  if (type === 'event') {
    const typeInfo = EVENT_TYPES[item.type] || {
      label: item.type,
      emoji: '📌',
      color: 'var(--theme-text-secondary)',
    };
    return (
      <div
        key={`we-${item.id}`}
        className={`wk-card wk-event ${item.visible === 0 ? 'hidden-display' : ''}`}
        style={{ borderLeftColor: typeInfo.color }}
      >
        <Monitor size={10} style={{ color: typeInfo.color }} />
        <span
          className="wk-title"
          title={`${typeInfo.label}${item.client ? ' — ' + item.client : ''}`}
        >
          {typeInfo.emoji} {item.client || typeInfo.label}
        </span>
        <div className="wk-actions">
          <Button
            variant="ghost"
            onClick={() => onToggleDisplayEventVisible(item)}
            title={item.visible === 0 ? 'Afficher' : 'Masquer'}
          >
            {item.visible === 0 ? <EyeOff size={10} /> : <Eye size={10} />}
          </Button>
          <Tooltip content="Retirer" position="bottom">
            <Button variant="ghost" className="del" onClick={() => onDeleteDisplayEvent(item.id)}>
              <Trash2 size={10} />
            </Button>
          </Tooltip>
        </div>
      </div>
    );
  }

  if (type === 'affaire') {
    const typeInfo = AFFAIRE_TYPE_INFO[item.type] || {
      label: 'Affaire',
      emoji: '📋',
      color: 'var(--theme-text-secondary)',
    };
    const isProcessed = item._googleId
      ? processedGoogleIds.has(item._googleId)
      : processedGoogleIds.has(`affaire-${item.id || item.numeroAffaire}`);
    return (
      <div
        key={`wa-${item.numeroAffaire}`}
        className={`wk-card wk-affaire ${isProcessed ? 'processed' : 'pending'} ${item._linkedGoogleEvent ? 'google-linked' : ''}`}
        style={{ borderLeftColor: typeInfo.color }}
        onClick={() => onOpenAffaireTaskModal(item)}
      >
        <Briefcase size={10} style={{ color: typeInfo.color }} />
        <span
          className="wk-title"
          title={`${item.numeroAffaire}${item.client ? ' — ' + item.client : ''}${item.event_name || item.titre ? ' • ' + (item.event_name || item.titre) : ''}${item._googleTime ? ' • ' + item._googleTime : ''}`}
        >
          {typeInfo.emoji} {item.client || item.numeroAffaire}
          {item.event_name || item.titre
            ? ` · ${(item.event_name || item.titre).slice(0, 15)}${(item.event_name || item.titre).length > 15 ? '…' : ''}`
            : ''}
        </span>
        {item._googleTime && <span className="wk-time">{item._googleTime}</span>}
        {item._linkedGoogleEvent && (
          <Tooltip content="Lié Google" position="bottom">
            <span className="wk-google-badge">G</span>
          </Tooltip>
        )}
        {isProcessed && <span className="wk-status-dot done">✓</span>}
        <div className="wk-actions">
          <Tooltip content="Retirer" position="bottom">
            <Button
              variant="ghost"
              className="del"
              onClick={(e) => {
                e.stopPropagation();
                onHideAffaire(item);
              }}
            >
              <X size={10} />
            </Button>
          </Tooltip>
        </div>
      </div>
    );
  }

  if (type === 'google') {
    const summary = item.summary || 'Événement';
    const isProcessed = processedGoogleIds.has(item.id);
    const startDT =
      typeof item.start === 'string' ? item.start : item.start?.dateTime || item.start?.date || '';
    const timeStr = startDT.includes('T')
      ? safeParseDate(startDT)?.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }) || ''
      : '';
    return (
      <div
        key={`wg-${item.id}`}
        className={`wk-card wk-google ${isProcessed ? 'processed' : 'pending'}`}
        style={{ borderLeftColor: isProcessed ? STATUS_COLORS.success : '#4285f4' }}
        onClick={() => onOpenEventTaskModal(item)}
      >
        <Calendar size={10} style={{ color: '#4285f4' }} />
        <span className="wk-title" title={summary}>
          {summary.slice(0, 22)}
          {summary.length > 22 ? '…' : ''}
        </span>
        {timeStr && <span className="wk-time">{timeStr}</span>}
        <span className={`wk-status-dot ${isProcessed ? 'done' : ''}`}>
          {isProcessed ? '✓' : '⚙'}
        </span>
      </div>
    );
  }

  return null;
};

export const WeekMiniCard = React.memo(WeekMiniCardInner);

// ═══ PlanningWeekView ═══
// Full week layout with 7 day columns, split events/tasks, expand/collapse
const PlanningWeekViewInner = ({
  weekDays,
  weekGroupedByDay,
  expandedWeekDay,
  setExpandedWeekDay,
  wkSplitRatio,
  onSplitMouseDown,
  setSelectedDate,
  renderTaskRow,
  // WeekMiniCard props (passed through)
  affaireByNum,
  processedGoogleIds,
  onNavigateToEntity,
  onCycleStatus,
  onEdit,
  onDelete,
  onToggleTaskVisible,
  onToggleDisplayEventVisible,
  onDeleteDisplayEvent,
  onOpenAffaireTaskModal,
  onOpenEventTaskModal,
  onHideAffaire,
}) => {
  const miniCardProps = {
    affaireByNum,
    processedGoogleIds,
    onNavigateToEntity,
    onCycleStatus,
    onEdit,
    onDelete,
    onToggleTaskVisible,
    onToggleDisplayEventVisible,
    onDeleteDisplayEvent,
    onOpenAffaireTaskModal,
    onOpenEventTaskModal,
    onHideAffaire,
  };

  // ── Expanded events (Google, affaires, display events) ──
  const renderWeekDayExpandedEvents = (dayStr) => {
    const dayData = weekGroupedByDay?.[dayStr] || {
      tasks: [],
      events: [],
      affaires: [],
      googleEvents: [],
    };
    const totalEvents =
      dayData.googleEvents.length + dayData.affaires.length + dayData.events.length;
    if (totalEvents === 0) return <div className="wk-empty">—</div>;
    return (
      <div className="wk-day-expanded">
        {dayData.googleEvents.length > 0 && (
          <div className="wk-expanded-section">
            <div className="wk-expanded-section-label wk-section-google">📅 Google Calendar</div>
            {dayData.googleEvents.map((ev) => (
              <WeekMiniCard key={`wg-${ev.id}`} item={ev} type="google" {...miniCardProps} />
            ))}
          </div>
        )}
        {dayData.affaires.length > 0 && (
          <div className="wk-expanded-section">
            <div className="wk-expanded-section-label wk-section-affaires">📋 Affaires</div>
            {dayData.affaires.map((a) => (
              <WeekMiniCard
                key={`wa-${a.numeroAffaire}`}
                item={a}
                type="affaire"
                {...miniCardProps}
              />
            ))}
          </div>
        )}
        {dayData.events.length > 0 && (
          <div className="wk-expanded-section">
            <div className="wk-expanded-section-label wk-section-display">📺 Écran</div>
            {dayData.events.map((ev) => (
              <WeekMiniCard key={`we-${ev.id}`} item={ev} type="event" {...miniCardProps} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Expanded tasks (grouped by section with columns header) ──
  const renderWeekDayExpandedTasks = (dayStr) => {
    const dayData = weekGroupedByDay?.[dayStr] || {
      tasks: [],
      events: [],
      affaires: [],
      googleEvents: [],
    };
    if (dayData.tasks.length === 0) return <div className="wk-empty">—</div>;

    const tasksBySection = {};
    dayData.tasks.forEach((t) => {
      const sec = normalizeSection(t.section || 'manual');
      if (!tasksBySection[sec]) tasksBySection[sec] = [];
      tasksBySection[sec].push(t);
    });
    const sectionOrder = Object.keys(SECTIONS);

    return (
      <div className="wk-day-expanded">
        {/* En-tête de colonnes */}
        <div className="tp-columns-header tp-columns-header-mini">
          <span className="ev-col-h ev-col-h-status">✔</span>
          <span className="ev-col-h ev-col-h-affaire">Aff.</span>
          <span className="ev-col-h ev-col-h-nom">Titre</span>
          <span className="ev-col-h ev-col-h-client">Client</span>
          <span className="ev-col-h ev-col-h-spacer"></span>
          <span className="ev-col-h ev-col-h-time">Heure</span>
          <span className="ev-col-h ev-col-h-actions">Actions</span>
        </div>
        {sectionOrder.map((secKey) => {
          const secInfo = SECTIONS[secKey];
          if (!secInfo) return null;
          const secTasks = tasksBySection[secKey] || [];
          if (secTasks.length === 0) return null;
          return (
            <div key={secKey} className="wk-expanded-section">
              <div className="wk-expanded-section-label" style={{ color: secInfo.color }}>
                {secInfo.emoji} {secInfo.label}
              </div>
              {secTasks.map(renderTaskRow)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="wk-split-layout">
      {/* ── Colonnes des jours ── */}
      <div className="wk-days-row">
        {weekDays.map((d) => {
          const dt = new Date(d + 'T00:00:00');
          const dayLabel = dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
          const isToday = d === todayStr();
          const isExpanded = expandedWeekDay === d;
          const dayData = weekGroupedByDay?.[d] || {
            tasks: [],
            events: [],
            affaires: [],
            googleEvents: [],
          };
          const evCount =
            dayData.googleEvents.length + dayData.affaires.length + dayData.events.length;
          const taskCount = dayData.tasks.length;

          return (
            <div
              key={d}
              className={`wk-day-col ${isToday ? 'today' : ''} ${isExpanded ? 'expanded' : ''}`}
            >
              {/* En-tête cliquable */}
              <div
                className={`wk-col-header ${isToday ? 'today' : ''}`}
                onClick={() => {
                  setExpandedWeekDay(isExpanded ? null : d);
                  setSelectedDate(d);
                }}
                title={isExpanded ? 'Réduire' : 'Cliquer pour agrandir'}
              >
                <span className="wk-day-label">{dayLabel}</span>
                <span className="wk-header-counts">
                  {evCount > 0 && <span className="wk-day-count ev">{evCount}</span>}
                  {taskCount > 0 && <span className="wk-day-count task">{taskCount}</span>}
                </span>
                <ChevronDown
                  size={14}
                  className={`wk-expand-chevron ${isExpanded ? 'open' : ''}`}
                />
              </div>

              {/* Contenu splitté en deux sections */}
              <div className="wk-day-content">
                {isExpanded ? (
                  <>
                    {/* ── Section Événements (expanded) ── */}
                    <div
                      className="wk-section wk-section-events"
                      style={{ flex: `${wkSplitRatio} 0 0` }}
                    >
                      <div className="wk-section-label ev-label">📅 Événements</div>
                      {renderWeekDayExpandedEvents(d)}
                    </div>
                    {/* ── Séparateur draggable ── */}
                    <div
                      className="wk-split-handle"
                      onMouseDown={onSplitMouseDown}
                      title="Glisser pour redimensionner"
                    >
                      <div className="wk-split-handle-grip" />
                    </div>
                    {/* ── Section Tâches (expanded) ── */}
                    <div
                      className="wk-section wk-section-tasks"
                      style={{ flex: `${100 - wkSplitRatio} 0 0` }}
                    >
                      <div className="wk-section-label task-label">📋 Tâches</div>
                      {renderWeekDayExpandedTasks(d)}
                    </div>
                  </>
                ) : (
                  <>
                    {/* ── Section Événements (compact) ── */}
                    <div
                      className="wk-section wk-section-events"
                      style={{ flex: `${wkSplitRatio} 0 0` }}
                    >
                      <div className="wk-section-label ev-label">📅 Événements</div>
                      {dayData.googleEvents.length > 0 && (
                        <div className="wk-compact-group">
                          {dayData.googleEvents.map((ev) => (
                            <WeekMiniCard
                              key={`wg-${ev.id}`}
                              item={ev}
                              type="google"
                              {...miniCardProps}
                            />
                          ))}
                        </div>
                      )}
                      {dayData.affaires.length > 0 && (
                        <div className="wk-compact-group">
                          {dayData.affaires.map((a) => (
                            <WeekMiniCard
                              key={`wa-${a.numeroAffaire}`}
                              item={a}
                              type="affaire"
                              {...miniCardProps}
                            />
                          ))}
                        </div>
                      )}
                      {dayData.events.length > 0 && (
                        <div className="wk-compact-group">
                          {dayData.events.map((ev) => (
                            <WeekMiniCard
                              key={`we-${ev.id}`}
                              item={ev}
                              type="event"
                              {...miniCardProps}
                            />
                          ))}
                        </div>
                      )}
                      {evCount === 0 && <div className="wk-empty-mini">—</div>}
                    </div>

                    {/* ── Séparateur draggable ── */}
                    <div
                      className="wk-split-handle"
                      onMouseDown={onSplitMouseDown}
                      title="Glisser pour redimensionner"
                    >
                      <div className="wk-split-handle-grip" />
                    </div>

                    {/* ── Section Tâches (compact) ── */}
                    <div
                      className="wk-section wk-section-tasks"
                      style={{ flex: `${100 - wkSplitRatio} 0 0` }}
                    >
                      <div className="wk-section-label task-label">📋 Tâches</div>
                      {(() => {
                        const grouped = {};
                        dayData.tasks.forEach((t) => {
                          const sec = normalizeSection(t.section || 'manual');
                          if (!grouped[sec]) grouped[sec] = [];
                          grouped[sec].push(t);
                        });
                        return Object.keys(SECTIONS).map((secKey) => {
                          const items = grouped[secKey];
                          if (!items || items.length === 0) return null;
                          const info = SECTIONS[secKey] || SECTIONS.manual;
                          return (
                            <div key={secKey} className="wk-compact-group">
                              <div className="wk-task-group-label" style={{ color: info.color }}>
                                <span>{info.emoji}</span> {info.label}
                              </div>
                              {items.map((t) => (
                                <WeekMiniCard
                                  key={`wt-${t.id}`}
                                  item={t}
                                  type="task"
                                  {...miniCardProps}
                                />
                              ))}
                            </div>
                          );
                        });
                      })()}
                      {taskCount === 0 && <div className="wk-empty-mini">—</div>}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const PlanningWeekView = React.memo(PlanningWeekViewInner);
