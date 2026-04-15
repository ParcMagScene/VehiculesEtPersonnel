import React from 'react';
import { Check, Clock, Eye, Plus, X, Link, User, UserPlus } from 'lucide-react';
import AffaireBadge from '../AffaireBadge';
import { Button, DetailRow, Input, Tooltip } from '@/design-system';
import { STATUS } from '../../constants';
import { STATUS_COLORS } from '../../constants/colors';
import { safeParseDate } from '../../utils/dateUtils';
import { AFFAIRE_TYPE_INFO } from '../../utils/affaireConstants';

// ═══ MultiAssignWidget ═══
// Shared multi-assignment dropdown used by event rows
export const MultiAssignWidget = React.memo(function MultiAssignWidget({
  entityType,
  entityId,
  assignmentsByEntity,
  assigningEntity,
  setAssigningEntity,
  onToggleAssignment,
  persons,
}) {
  const key = `${entityType}:${entityId}`;
  const assignments = assignmentsByEntity.get(key) || [];
  const isOpen = assigningEntity === key;

  return (
    <div className="event-assign-container">
      <div className="multi-assign-chips">
        {assignments.map(a => (
          <span key={a.id} className="task-person assigned" role="button" tabIndex={0} onClick={() => setAssigningEntity(isOpen ? null : key)}>
            <User size={11} />
            {a.firstName} {a.lastName?.charAt(0)}.
          </span>
        ))}
        <Tooltip content="Affecter du personnel">
          <Button variant="primary" size="sm" iconOnly className="btn-assign" onClick={() => setAssigningEntity(isOpen ? null : key)} aria-label="Affecter">
            <UserPlus size={13} />
          </Button>
        </Tooltip>
      </div>
      {isOpen && (
        <div className="assign-dropdown">
          <div className="assign-dropdown-title">Multi-affectation :</div>
          {persons.map(p => {
            const isAssigned = assignments.some(a => a.personId === p.id);
            return (
              <div key={p.id} className={`assign-option ${isAssigned ? 'selected' : ''}`} role="button" tabIndex={0} onClick={() => onToggleAssignment(entityType, entityId, p.id)}>
                <span className={`assign-check ${isAssigned ? 'on' : ''}`}>{isAssigned ? <Check size={12} /> : null}</span>
                {p.firstName || p.prenom} {p.lastName || p.nom}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ═══ Shared link popover used by GoogleRdvRow and IcalEventRow ═══
function LinkAffairePopover({ linkSearchQuery, setLinkSearchQuery, setLinkingEvent, linkableAffaires, event, onManualLink }) {
  return (
    <div className="link-affaire-popover" onClick={(e) => e.stopPropagation()}>
      <div className="link-popover-header">
        <span>🔗 Lier à une affaire</span>
        <Button variant="ghost" className="link-popover-close" onClick={() => { setLinkingEvent(null); setLinkSearchQuery(''); }}>
          <X size={14} />
        </Button>
      </div>
      <Input
        type="text"
        className="link-search-input"
        placeholder="Rechercher AF, client…"
        value={linkSearchQuery}
        onChange={(e) => setLinkSearchQuery(e.target.value)}
        autoFocus
        onKeyDown={(e) => { if (e.key === 'Escape') { setLinkingEvent(null); setLinkSearchQuery(''); } }}
      />
      {/* Saisie directe d'un numéro AF */}
      {linkSearchQuery.match(/^\s*AF\s*\d{4,}\s*$/i) && (
        <Button variant="ghost" className="link-option link-option-create"
          onClick={() => {
            const num = linkSearchQuery.toUpperCase().replace(/\s+/g, '').trim();
            onManualLink(event, num);
          }}
        >
          ➕ Créer & lier <strong>{linkSearchQuery.toUpperCase().replace(/\s+/g, '').trim()}</strong>
        </Button>
      )}
      {linkableAffaires.length > 0 && (
        <div className="link-options-list">
          {linkableAffaires.map(a => (
            <Button variant="ghost"
              key={a.id || a.numeroAffaire}
              className="link-option"
              onClick={() => onManualLink(event, a.numeroAffaire)}
            >
              <AffaireBadge numero={a.numeroAffaire} type={a.type} size="sm" />
              <span className="link-option-client">{a.client || 'Sans client'}</span>
            </Button>
          ))}
        </div>
      )}
      {linkSearchQuery.length >= 2 && linkableAffaires.length === 0 && !linkSearchQuery.match(/^\s*AF\s*\d{4,}\s*$/i) && (
        <div className="link-no-results">Aucune affaire trouvée</div>
      )}
    </div>
  );
}

// ═══ Shared linked-tasks chips ═══
function LinkedTasksChips({ linkedTasks, selectedDate }) {
  if (linkedTasks.length === 0) return null;
  return (
    <div className="event-linked-tasks">
      {linkedTasks.map(t => {
        const isDone = t.status === STATUS.DONE;
        // eslint-disable-next-line no-misleading-character-class
        const label = (t.title || '').replace(/\s*—.*$/, '').replace(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]+\s*/u, '').trim();
        // eslint-disable-next-line no-misleading-character-class
        const emoji = (t.title || '').match(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]+/u)?.[0] || '📋';
        return (
          <span key={t.id} className={`linked-task-chip ${isDone ? 'done' : ''}`} title={`${t.title}${t.date ? ' — ' + t.date : ''}${t.time ? ' ' + t.time : ''}`}>
            {emoji} {label}{t.date && t.date !== selectedDate ? ` (${new Date(t.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })})` : ''}
            {isDone && <Check size={10} />}
          </span>
        );
      })}
    </div>
  );
}

// ═══ Helper: filter linkable affaires ═══
function filterLinkableAffaires(affaires, linkSearchQuery) {
  if (linkSearchQuery.length < 2) return [];
  const q = linkSearchQuery.toUpperCase();
  return affaires.filter(a =>
    (a.numeroAffaire || '').toUpperCase().includes(q)
    || (a.client || '').toUpperCase().includes(q)
    || (a.titre || '').toUpperCase().includes(q)
  ).slice(0, 8);
}

// ═══ GoogleRdvRow ═══
// Google Calendar event row — compact column layout
export const GoogleRdvRow = React.memo(function GoogleRdvRow({
  event,
  affaireByNum,
  processedGoogleIds,
  tasksBySourceId,
  onNavigateToEntity,
  onOpenEventTaskModal,
  linkingEvent,
  setLinkingEvent,
  linkSearchQuery,
  setLinkSearchQuery,
  affaires,
  onManualLink,
  selectedDate,
}) {
  const summary = event.summary || 'Événement';
  const startDT = event.start?.dateTime || event.start?.date || '';
  const endDT = event.end?.dateTime || event.end?.date || '';
  const timeStr = startDT.includes('T')
    ? `${safeParseDate(startDT)?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || '?'}${endDT ? ' → ' + (safeParseDate(endDT)?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || '') : ''}`
    : 'Journée';
  const location = event.location || '';
  const affaireMatch = summary.match(/\bAF\s*\d{4,}/i);
  const affaireNum = affaireMatch ? affaireMatch[0].toUpperCase().replace(/\s+/g, '') : '';
  const isProcessed = processedGoogleIds.has(event.id);
  const linkedTasks = tasksBySourceId.get(event.id) || [];
  const isLinking = linkingEvent?.id === event.id;
  const linkedAff = affaireNum ? affaireByNum.get(affaireNum.toUpperCase()) : null;
  const affaireClient = linkedAff?.client || '';
  let displayNom = summary;
  if (affaireNum) {
    displayNom = summary.replace(/\baf\s*\d{4,}/gi, '').replace(/^\s*[-—–:]+\s*/, '').replace(/\s*[-—–:]+\s*$/, '').trim() || summary;
  }

  const linkableAffaires = isLinking ? filterLinkableAffaires(affaires, linkSearchQuery) : [];

  return (
    <div
      key={`gcal-rdv-${event.id}`}
      className="task-row event-row-cols google-rdv-row"
    >
      <span className="ev-col ev-col-affaire">
        {affaireNum ? <AffaireBadge numero={affaireNum} type={linkedAff?.type} size="sm" onNavigate={onNavigateToEntity ? (num) => onNavigateToEntity('affaire', { numero: num }) : undefined} /> : null}
      </span>
      <span className="ev-col ev-col-nom" role="button" tabIndex={0} title={[displayNom, location && '📍 ' + location].filter(Boolean).join('\n')} onClick={() => onOpenEventTaskModal(event)}>{displayNom}</span>
      <span className="ev-col ev-col-client" title={affaireClient}>{affaireClient}</span>
      <span className="ev-col ev-col-spacer" />
      <span className="ev-col ev-col-time"><Clock size={11} /> {timeStr}</span>
      <div className="task-actions">
        <Tooltip content="Google Calendar" position="bottom"><span className="google-badge">G</span></Tooltip>
        <span className={`ev-col ev-col-status google-status-badge ${isProcessed ? 'done' : 'pending'}`}>
          {isProcessed ? '✓' : '⚙'}
        </span>
        <Tooltip content="Lier à une affaire" position="bottom">
          <Button variant="ghost"
            className={`btn-link-affaire ${isLinking ? 'active' : ''}`}
            style={affaireNum ? { visibility: 'hidden' } : {}}
            onClick={(e) => { e.stopPropagation(); setLinkingEvent(isLinking ? null : event); setLinkSearchQuery(''); }}
          >
            <Link size={13} />
          </Button>
        </Tooltip>
      </div>
      {/* Mini-badges des tâches créées depuis cet événement */}
      <LinkedTasksChips linkedTasks={linkedTasks} selectedDate={selectedDate} />
      {/* Popover de liaison manuelle */}
      {isLinking && (
        <LinkAffairePopover
          linkSearchQuery={linkSearchQuery}
          setLinkSearchQuery={setLinkSearchQuery}
          setLinkingEvent={setLinkingEvent}
          linkableAffaires={linkableAffaires}
          event={event}
          onManualLink={onManualLink}
        />
      )}
    </div>
  );
});

// ═══ RdvRow ═══
// Affaire RDV card with expandable details
export const RdvRow = React.memo(function RdvRow({
  affaire,
  expandedRdv,
  setExpandedRdv,
  onNavigateToEntity,
  onOpenAffaireTaskModal,
  onHideAffaire,
}) {
  const typeInfo = AFFAIRE_TYPE_INFO[affaire.type] || { label: affaire.type || 'Affaire', emoji: '📋', color: 'var(--theme-text-secondary)' };
  const isExpanded = expandedRdv === affaire.numeroAffaire;
  const displayNom = affaire.nom || affaire.event_name || affaire.titre || affaire.client || typeInfo.label;
  const displayClient = affaire.client || '';
  const timeStr = affaire._googleTime
    ? `${affaire._googleTime}${affaire._googleEndTime ? ` → ${affaire._googleEndTime}` : ''}`
    : '';
  const tooltipParts = [
    displayNom,
    (affaire.titre || affaire.event_name) && (affaire.event_name || affaire.titre),
    (affaire._googleLocation || affaire.adresseLivraison) && '📍 ' + (affaire._googleLocation || affaire.adresseLivraison).split('\n')[0],
    affaire.interlocuteur && '👤 ' + affaire.interlocuteur,
    affaire.tel && '📞 ' + affaire.tel,
  ].filter(Boolean).join('\n');

  return (
    <div key={`rdv-${affaire.numeroAffaire}`} className={`task-row event-row-cols rdv-row ${affaire._linkedGoogleEvent ? 'google-linked' : ''}`}>

      <span className="ev-col ev-col-affaire">
        <AffaireBadge numero={affaire.numeroAffaire} type={affaire.type} size="sm" onNavigate={onNavigateToEntity ? (num) => onNavigateToEntity('affaire', { numero: num }) : undefined} />
      </span>

      <span className="ev-col ev-col-nom" role="button" tabIndex={0} title={tooltipParts} onClick={() => onOpenAffaireTaskModal(affaire)}>
        {displayNom}
        {affaire._linkedGoogleEvent && <Tooltip content="Lié à un événement Google Calendar" position="bottom"><span className="google-linked-badge">G</span></Tooltip>}
      </span>

      <span className="ev-col ev-col-client" title={displayClient}>{displayClient}</span>
      <span className="ev-col ev-col-spacer" />

      <span className="ev-col ev-col-time">
        {timeStr ? <><Clock size={11} /> {timeStr}</> : ''}
      </span>

      <div className="task-actions rdv-actions">
        <Tooltip content="Voir détails">
          <Button variant="ghost" className="btn-rdv-view" onClick={() => setExpandedRdv(isExpanded ? null : affaire.numeroAffaire)}>
            <Eye size={14} />
          </Button>
        </Tooltip>
        <Tooltip content="Définir les tâches pour cette affaire">
          <Button variant="ghost" className="task-status-btn" onClick={(e) => { e.stopPropagation(); onOpenAffaireTaskModal(affaire); }}>
            <Plus size={14} />
          </Button>
        </Tooltip>
        <Tooltip content="Retirer de la planification">
          <Button variant="ghost" className="delete" onClick={(e) => { e.stopPropagation(); onHideAffaire(affaire); }}>
            <X size={14} />
          </Button>
        </Tooltip>
      </div>

      {isExpanded && (
        <div className="rdv-detail-card">
          <DetailRow className="rdv-detail-row" label="Client :" value={affaire.client || '—'} />
          <DetailRow className="rdv-detail-row" label="Interlocuteur :" value={affaire.interlocuteur || '—'} />
          <DetailRow className="rdv-detail-row" label="Tél :" value={affaire.tel || '—'} />
          <DetailRow className="rdv-detail-row" label="Adresse :" value={affaire.adresseLivraison?.split('\n').join(', ') || '—'} />
          {affaire.titre && <DetailRow className="rdv-detail-row" label="Titre :" value={affaire.titre} />}
          {affaire.devis && <DetailRow className="rdv-detail-row" label="Devis :" value={affaire.devis} />}
        </div>
      )}
    </div>
  );
});

// ═══ IcalEventRow ═══
// iCal calendar event row — similar to GoogleRdvRow but with iCal-specific fields
export const IcalEventRow = React.memo(function IcalEventRow({
  event,
  affaireByNum,
  processedGoogleIds,
  tasksBySourceId,
  onNavigateToEntity,
  onOpenEventTaskModal,
  linkingEvent,
  setLinkingEvent,
  linkSearchQuery,
  setLinkSearchQuery,
  affaires,
  onManualLink,
  selectedDate,
  icalToGoogleLike,
}) {
  const startDT = event.start || '';
  const endDT = event.end || '';
  const timeStr = startDT.includes('T')
    ? `${safeParseDate(startDT)?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || '?'}${endDT ? ' → ' + (safeParseDate(endDT)?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || '') : ''}`
    : 'Journée';
  const isProcessed = processedGoogleIds.has(event.id);
  const linkedTasks = tasksBySourceId.get(event.id) || [];
  const icalAffaireMatch = (event.summary || '').match(/\bAF\s*\d{4,}/i);
  const affaireNum = icalAffaireMatch ? icalAffaireMatch[0].toUpperCase().replace(/\s+/g, '') : '';
  const isLinking = linkingEvent?.id === event.id;
  const linkedAff = affaireNum ? affaireByNum.get(affaireNum.toUpperCase()) : null;
  const affaireClient = linkedAff?.client || '';
  let displayNom = event.summary || 'Événement';
  if (affaireNum) {
    displayNom = displayNom.replace(/\baf\s*\d{4,}/gi, '').replace(/^\s*[-—–:]+\s*/, '').replace(/\s*[-—–:]+\s*$/, '').trim() || displayNom;
  }

  const linkableAffaires = isLinking ? filterLinkableAffaires(affaires, linkSearchQuery) : [];

  return (
    <div
      key={`ical-${event.id}-${startDT}`}
      className="task-row event-row-cols ical-event-row"
    >
      <span className="ev-col ev-col-affaire">
        {affaireNum ? <AffaireBadge numero={affaireNum} type={linkedAff?.type} size="sm" onNavigate={onNavigateToEntity ? (num) => onNavigateToEntity('affaire', { numero: num }) : undefined} /> : null}
      </span>
      <span className="ev-col ev-col-nom" role="button" tabIndex={0} title={[displayNom, event.location && '📍 ' + event.location].filter(Boolean).join('\n')} onClick={() => onOpenEventTaskModal(icalToGoogleLike(event))}>{displayNom}</span>
      <span className="ev-col ev-col-client" title={affaireClient}>{affaireClient}</span>
      <span className="ev-col ev-col-spacer" />
      <span className="ev-col ev-col-time"><Clock size={11} /> {timeStr}</span>
      <div className="task-actions">
        <span className="ical-origin-badge" style={{ borderColor: event.calendarColor || STATUS_COLORS.info, color: event.calendarColor || STATUS_COLORS.info }} title={event.calendarName}>
          {(event.calendarName || 'iCal').slice(0, 3)}
        </span>
        <span className={`ev-col ev-col-status google-status-badge ${isProcessed ? 'done' : 'pending'}`}>
          {isProcessed ? '✓' : '⚙'}
        </span>
        <Tooltip content="Lier à une affaire" position="bottom">
          <Button variant="ghost"
            className={`btn-link-affaire ${isLinking ? 'active' : ''}`}
            style={affaireNum ? { visibility: 'hidden' } : {}}
            onClick={(e) => { e.stopPropagation(); setLinkingEvent(isLinking ? null : event); setLinkSearchQuery(''); }}
          >
            <Link size={13} />
          </Button>
        </Tooltip>
      </div>
      {/* Mini-badges des tâches créées depuis cet événement iCal */}
      <LinkedTasksChips linkedTasks={linkedTasks} selectedDate={selectedDate} />
      {/* Popover de liaison manuelle */}
      {isLinking && (
        <LinkAffairePopover
          linkSearchQuery={linkSearchQuery}
          setLinkSearchQuery={setLinkSearchQuery}
          setLinkingEvent={setLinkingEvent}
          linkableAffaires={linkableAffaires}
          event={event}
          onManualLink={onManualLink}
        />
      )}
    </div>
  );
});
