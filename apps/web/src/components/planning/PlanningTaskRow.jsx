/* eslint-disable no-misleading-character-class */
import { Check, Clock, Edit2, Eye, EyeOff, Link, MapPin, Trash2, Truck, X } from 'lucide-react';
import React from 'react';

import { Button, Input, Tooltip } from '@/design-system';

import { STATUS } from '../../constants';
import AffaireBadge from '../AffaireBadge';
import { EVENT_TYPES, extractAffaireNum, normalizeSection, SECTIONS } from './planningConstants';

/**
 * PlanningTaskRow — renders a single task row in the planning panel.
 * Extracted from TaskPlanningPanel.renderTaskRow.
 */
export const PlanningTaskRow = React.memo(
  ({
    task,
    affaireByNum,
    onNavigateToEntity,
    onCycleStatus,
    onDelete,
    onToggleVisible,
    onEdit,
    onLinkTask,
    linkingTaskId,
    setLinkingTaskId,
    linkTaskSearchQuery,
    setLinkTaskSearchQuery,
    affaires,
    selectedDate,
    renderMultiAssign,
  }) => {
    const sourceType = task.sourceType || task.source_type || '';
    const googleEventTitle = task.googleEventTitle || task.google_event_title || '';
    const taskEventType = task.eventType || task.event_type || '';
    const isDone = task.status === STATUS.DONE;
    const isProgress = task.status === 'in_progress';
    const isGoogle =
      sourceType === 'google_event' || (!!googleEventTitle && (task.sourceId || task.source_id));
    const isHidden = task.visible === 0;
    const affaireNum =
      task.affaireNum || extractAffaireNum(task.title) || extractAffaireNum(googleEventTitle);
    const taskSection = normalizeSection(task.section || 'manual');
    const sectionInfo = SECTIONS[taskSection];

    // --- Nettoyage du titre pour éviter les doublons ---
    let displayTitle = task.title;
    // 1. Retirer le suffixe " — eventSummary" (tâches Google: "emoji Label — Summary")
    if (googleEventTitle) {
      const dashIdx = displayTitle.indexOf(' — ');
      if (dashIdx >= 0) {
        const suffix = displayTitle.slice(dashIdx + 3).trim();
        if (suffix.toLowerCase() === googleEventTitle.trim().toLowerCase()) {
          displayTitle = displayTitle.slice(0, dashIdx).trim();
        }
      }
    }
    // 2. Retirer le label de section du titre (redondant : "📦 Chargement" dans la section Chargement, etc.)
    if (sectionInfo?.affaireOnly) {
      displayTitle = displayTitle
        // eslint-disable-next-line no-misleading-character-class
        .replace(
          /^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]+\s*/u,
          '',
        )
        .replace(
          /^(Pr(?:e|é)paration|Chargement|D(?:e|é)part|Enl(?:e|è)vement|Retour|R(?:e|é)cup(?:e|é)ration|Installation)\s*—?\s*/i,
          '',
        )
        .trim();
      if (!displayTitle) {
        displayTitle = googleEventTitle || task.notes || '';
      }
    }

    // 2b. Section Courses : extraire le type (Livraison, Récupération, etc.)
    let courseType = null;
    if (taskSection === 'courses') {
      const SECTION_COURSE_TYPE = {
        enlevement: 'enlevement',
        retour: 'retour',
        recuperation: 'recuperation',
      };
      const EVENT_COURSE_TYPE = {
        livraison: 'livraison',
        enlevement: 'enlevement',
        retour: 'retour',
        recuperation: 'recuperation',
      };
      if (SECTION_COURSE_TYPE[task.section]) {
        courseType = SECTION_COURSE_TYPE[task.section];
      } else if (taskEventType && EVENT_COURSE_TYPE[taskEventType]) {
        courseType = EVENT_COURSE_TYPE[taskEventType];
      } else {
        // eslint-disable-next-line no-misleading-character-class
        const courseMatch = displayTitle.match(
          /^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]*\s*(Livraison|R(?:e|é)cup(?:e|é)ration|Recuperation|Enl(?:e|è)vement|Enlevement|Retour)\b/iu,
        );
        if (courseMatch) {
          const rawType = courseMatch[1]
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          const TYPE_MAP = {
            livraison: 'livraison',
            recuperation: 'recuperation',
            enlevement: 'enlevement',
            retour: 'retour',
          };
          courseType = TYPE_MAP[rawType] || null;
        }
      }
      if (courseType) {
        displayTitle = displayTitle
          // eslint-disable-next-line no-misleading-character-class
          .replace(
            /^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]+\s*/u,
            '',
          )
          .replace(
            /^(Livraison|R(?:e|é)cup(?:e|é)ration|Recuperation|Enl(?:e|è)vement|Enlevement|Retour)\s*—?\s*/i,
            '',
          )
          .trim();
        if (!displayTitle) {
          displayTitle = googleEventTitle || task.notes || '';
        }
      }
    }

    // 3. Retirer le N° d'affaire du titre (déjà affiché en badge)
    const stripAffaireNum = (text) => {
      if (!text || !affaireNum) return text;
      const digits = affaireNum.replace(/^AF/i, '');
      const flexDigits = digits.split('').join('\\s*');
      const pattern = new RegExp('\\bAF\\s*' + flexDigits + '\\b', 'gi');
      return text
        .replace(pattern, '')
        .replace(/\s*[—–-]\s*(?=[—–-]|$)/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    };
    displayTitle = stripAffaireNum(displayTitle);

    // 4. Enrichir avec le client/titre de l'affaire si le titre est trop générique
    const linkedAffaire = affaireNum ? affaireByNum.get(affaireNum.toUpperCase()) : null;
    const isGenericTitle =
      !displayTitle ||
      /^(Location|Prestation|Vente|Installation|Livraison)\s*$/i.test(displayTitle);
    if (isGenericTitle && linkedAffaire) {
      const titre = linkedAffaire.titre || linkedAffaire.eventName || '';
      displayTitle = titre || displayTitle || '-';
    }

    // --- Nettoyage du sous-titre (googleEventTitle) ---
    let cleanEventTitle = stripAffaireNum(googleEventTitle || '');
    if (isGenericTitle && linkedAffaire) {
      const affaireTitre = linkedAffaire.titre || linkedAffaire.eventName || '';
      if (affaireTitre && affaireTitre.toLowerCase() !== displayTitle.toLowerCase()) {
        cleanEventTitle = affaireTitre;
      }
    }
    const cleanEventNorm = cleanEventTitle.toLowerCase().replace(/\s+/g, '');
    const displayTitleNorm = displayTitle.toLowerCase().replace(/\s+/g, '');
    const showSubtitle = googleEventTitle
      ? false
      : cleanEventTitle &&
        cleanEventNorm !== displayTitleNorm &&
        !displayTitleNorm.includes(cleanEventNorm);

    // Masquer l'eventType quand il est redondant avec le nom de la section
    const SECTION_EVENT_TYPES = {
      prep_locations: 'preparation',
      prep_prestations: 'preparation',
      prep_ventes: 'preparation',
      prep_installations: 'preparation',
      chargement: 'chargement',
      depart: 'depart',
      courses: 'courses',
      installation: 'installation',
      montage: 'montage',
      demontage: 'demontage',
    };
    const showEventType = taskEventType && SECTION_EVENT_TYPES[taskSection] !== taskEventType;

    // Combiner titre + sous-titre
    const fullTitle = showSubtitle ? `${displayTitle} — ${cleanEventTitle}` : displayTitle;
    const affaireNom = stripAffaireNum(linkedAffaire?.nom || '');
    const affaireClient = linkedAffaire?.client || '';
    const rawNom = fullTitle || affaireNom || '-';
    const displayNom = rawNom.charAt(0).toUpperCase() + rawNom.slice(1);
    const displayClient = affaireClient;

    return (
      <div
        key={task.id}
        className={`task-row event-row-cols ${isGoogle ? 'google-task-row' : ''} ${isDone ? 'task-done-row' : ''} ${isHidden ? 'hidden-display' : ''}`}
      >
        <Button
          variant="ghost"
          className={`ev-col task-status-btn ${isDone ? 'done' : isProgress ? 'in-progress' : ''}`}
          onClick={() => onCycleStatus(task)}
          title={`Statut: ${task.status} — cliquer pour changer`}
        >
          {isDone && <Check size={14} />}
          {isProgress && <Clock size={12} />}
        </Button>

        <span className="ev-col ev-col-affaire">
          {affaireNum ? (
            <AffaireBadge
              numero={affaireNum}
              type={linkedAffaire?.type}
              size="sm"
              onNavigate={
                onNavigateToEntity
                  ? (num) => onNavigateToEntity('affaire', { numero: num })
                  : undefined
              }
            />
          ) : null}
        </span>

        <span
          className={`ev-col ev-col-nom ${isDone ? 'done' : ''}`}
          title={[
            fullTitle,
            showEventType && taskEventType,
            (task.locationAddress || task.eventLocation || linkedAffaire?.location) &&
              '📍 ' + (task.locationAddress || task.eventLocation || linkedAffaire?.location),
            task.notes && '📝 ' + task.notes,
            (task.personFirstName || task.personLastName) &&
              '👤 ' + [task.personFirstName, task.personLastName].filter(Boolean).join(' '),
          ]
            .filter(Boolean)
            .join('\n')}
        >
          {isGoogle && (
            <Tooltip content="Google Calendar" position="bottom">
              <span className="google-mini-badge">G</span>
            </Tooltip>
          )}
          {courseType &&
            (() => {
              const ct = EVENT_TYPES[courseType];
              return ct ? (
                <span
                  className="course-type-badge"
                  style={{
                    background: `${ct.color}18`,
                    color: ct.color,
                    borderColor: `${ct.color}40`,
                  }}
                >
                  {ct.emoji} {ct.label}
                </span>
              ) : null;
            })()}
          {task.reservation_vehicle_name && (
            <span
              className="vehicle-badge"
              title={`🚗 ${task.reservation_vehicle_name} ${task.reservation_vehicle_reg || ''}`}
            >
              <Truck size={11} /> {task.reservation_vehicle_name}
            </span>
          )}
          {task.locationAddress && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.locationAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="task-location-badge"
              title={`📍 ${task.locationAddress}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MapPin size={11} />{' '}
              {task.locationAddress.length > 30
                ? task.locationAddress.slice(0, 30) + '…'
                : task.locationAddress}
            </a>
          )}
          {displayNom}
          {task.notes && <span className="task-notes-inline">({task.notes})</span>}
        </span>

        <span className="ev-col ev-col-client" title={displayClient}>
          {displayClient}
        </span>
        <span className="ev-col ev-col-spacer" />

        <span className="ev-col ev-col-time">
          {task.time ? (
            <>
              <Clock size={11} /> {task.time}
              {task.endTime ? ` → ${task.endTime}` : ''}
            </>
          ) : task.period ? (
            <span className="period-badge">{task.period}</span>
          ) : (
            ''
          )}
        </span>

        <div className="task-actions">
          {renderMultiAssign('task', task.id)}
          {!affaireNum && (
            <Tooltip content="Lier à une affaire" position="bottom">
              <Button
                variant="ghost"
                size="xs"
                iconOnly
                className={`btn-link-affaire ${linkingTaskId === task.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setLinkingTaskId(linkingTaskId === task.id ? null : task.id);
                  setLinkTaskSearchQuery('');
                }}
              >
                <Link size={13} />
              </Button>
            </Tooltip>
          )}
          <Tooltip content={isHidden ? "Afficher sur l'écran" : "Masquer de l'écran"}>
            <Button
              variant="ghost"
              size="xs"
              iconOnly
              className={`toggle-visible ${isHidden ? 'off' : ''}`}
              onClick={() => onToggleVisible(task)}
            >
              {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
          </Tooltip>
          <Tooltip content="Modifier cette tâche">
            <Button
              variant="ghost"
              size="xs"
              iconOnly
              className="edit"
              onClick={() => onEdit(task)}
            >
              <Edit2 size={14} />
            </Button>
          </Tooltip>
          <Tooltip content="Supprimer">
            <Button
              variant="ghost"
              size="xs"
              iconOnly
              className="delete"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 size={14} />
            </Button>
          </Tooltip>
        </div>

        {/* Popover de liaison manuelle tâche → affaire */}
        {linkingTaskId === task.id &&
          (() => {
            const today = selectedDate || new Date().toISOString().slice(0, 10);
            const q = linkTaskSearchQuery.toUpperCase().trim();
            const sorted = [...affaires].sort((a, b) => {
              const aDebut = a.dateDebut || a.date_debut || '';
              const aFin = a.dateFin || a.date_fin || '';
              const bDebut = b.dateDebut || b.date_debut || '';
              const bFin = b.dateFin || b.date_fin || '';
              const aActive =
                aDebut <= today && (!aFin || aFin >= today) ? 0 : aDebut > today ? 1 : 2;
              const bActive =
                bDebut <= today && (!bFin || bFin >= today) ? 0 : bDebut > today ? 1 : 2;
              if (aActive !== bActive) return aActive - bActive;
              return (bDebut || '').localeCompare(aDebut || '');
            });
            const filtered =
              q.length >= 1
                ? sorted.filter(
                    (a) =>
                      (a.numeroAffaire || '').toUpperCase().includes(q) ||
                      (a.client || '').toUpperCase().includes(q) ||
                      (a.titre || '').toUpperCase().includes(q) ||
                      (a.eventName || '').toUpperCase().includes(q),
                  )
                : sorted;
            const linkableAff = filtered.slice(0, 10);
            return (
              <div className="link-affaire-popover" onClick={(e) => e.stopPropagation()}>
                <div className="link-popover-header">
                  <span>🔗 Lier à une affaire</span>
                  <Button
                    variant="ghost"
                    className="link-popover-close"
                    onClick={() => {
                      setLinkingTaskId(null);
                      setLinkTaskSearchQuery('');
                    }}
                  >
                    <X size={14} />
                  </Button>
                </div>
                <Input
                  type="text"
                  className="link-search-input"
                  placeholder="Filtrer par AF, client…"
                  value={linkTaskSearchQuery}
                  onChange={(e) => setLinkTaskSearchQuery(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setLinkingTaskId(null);
                      setLinkTaskSearchQuery('');
                    }
                  }}
                />
                {linkTaskSearchQuery.match(/^\s*AF\s*\d{4,}\s*$/i) &&
                  !affaires.some(
                    (a) =>
                      (a.numeroAffaire || '').toUpperCase() ===
                      linkTaskSearchQuery.toUpperCase().replace(/\s+/g, '').trim(),
                  ) && (
                    <Button
                      variant="ghost"
                      className="link-option link-option-create"
                      onClick={() => {
                        const num = linkTaskSearchQuery.toUpperCase().replace(/\s+/g, '').trim();
                        onLinkTask(task.id, num);
                      }}
                    >
                      ➕ Lier à{' '}
                      <strong>
                        {linkTaskSearchQuery.toUpperCase().replace(/\s+/g, '').trim()}
                      </strong>
                    </Button>
                  )}
                {linkableAff.length > 0 ? (
                  <div className="link-options-list">
                    {linkableAff.map((a) => (
                      <Button
                        variant="ghost"
                        key={a.id || a.numeroAffaire}
                        className="link-option"
                        onClick={() => onLinkTask(task.id, a.numeroAffaire)}
                      >
                        <AffaireBadge numero={a.numeroAffaire} type={a.type} size="sm" />
                        <span className="link-option-client">
                          {a.client || a.titre || 'Sans client'}
                        </span>
                      </Button>
                    ))}
                    {filtered.length > 10 && (
                      <div className="link-no-results link-no-results-more">
                        +{filtered.length - 10} autres…
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="link-no-results">Aucune affaire trouvée</div>
                )}
              </div>
            );
          })()}
      </div>
    );
  },
);

PlanningTaskRow.displayName = 'PlanningTaskRow';

export default PlanningTaskRow;
