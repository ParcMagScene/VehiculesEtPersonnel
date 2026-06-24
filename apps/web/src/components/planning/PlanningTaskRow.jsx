/* eslint-disable no-misleading-character-class */
import {
  Calendar,
  Check,
  Clock,
  Edit2,
  Eye,
  EyeOff,
  Link,
  MapPin,
  Trash2,
  Truck,
  User,
} from 'lucide-react';
import React from 'react';

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Tooltip,
} from '@/design-system';

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
    onLinkTaskToGoogleEvent,
    onAssignTaskPerson,
    onPostponeTask,
    googleEvents = [],
    persons,
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
    const rolledTask =
      task.isRolled === 1 ||
      task.isRolled === true ||
      task.is_rolled === 1 ||
      task.is_rolled === true ||
      !!task.rolledFromDate ||
      !!task.rolled_from_date;
    const rolledFrom = task.rolledFromDate || task.rolled_from_date || '';
    const affaireNum =
      task.affaireNum || extractAffaireNum(task.title) || extractAffaireNum(googleEventTitle);
    const taskSection = normalizeSection(task.section || 'manual');
    const sectionInfo = SECTIONS[taskSection];

    // --- Nettoyage du titre pour éviter les doublons ---
    let displayTitle = task.title;
    if (googleEventTitle) {
      const dashIdx = displayTitle.indexOf(' — ');
      if (dashIdx >= 0) {
        const suffix = displayTitle.slice(dashIdx + 3).trim();
        if (suffix.toLowerCase() === googleEventTitle.trim().toLowerCase()) {
          displayTitle = displayTitle.slice(0, dashIdx).trim();
        }
      }
    }

    if (sectionInfo?.affaireOnly) {
      displayTitle = displayTitle
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

    const linkedAffaire = affaireNum ? affaireByNum.get(affaireNum.toUpperCase()) : null;
    const isGenericTitle =
      !displayTitle ||
      /^(Location|Prestation|Vente|Installation|Livraison)\s*$/i.test(displayTitle);
    if (isGenericTitle && linkedAffaire) {
      const titre = linkedAffaire.titre || linkedAffaire.eventName || '';
      displayTitle = titre || displayTitle || '-';
    }

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

    const fullTitle = showSubtitle ? `${displayTitle} — ${cleanEventTitle}` : displayTitle;
    const affaireNom = stripAffaireNum(linkedAffaire?.nom || '');
    const affaireClient = linkedAffaire?.client || '';
    const rawNom = fullTitle || affaireNom || '-';
    const displayNom = rawNom.charAt(0).toUpperCase() + rawNom.slice(1);
    const displayClient = affaireClient;

    const [showActionsModal, setShowActionsModal] = React.useState(false);
    const [postponeDate, setPostponeDate] = React.useState(task.date || selectedDate || '');
    const [postponePeriod, setPostponePeriod] = React.useState(task.period || 'AM');
    const [linkTaskSearchQuery, setLinkTaskSearchQuery] = React.useState('');
    const [selectedGoogleEventId, setSelectedGoogleEventId] = React.useState(
      String(
        (task.sourceType || task.source_type) === 'google_event'
          ? task.sourceId || task.source_id || ''
          : '',
      ),
    );
    const [selectedPersonId, setSelectedPersonId] = React.useState(String(task.person_id || ''));

    React.useEffect(() => {
      if (!showActionsModal) return;
      setPostponeDate(task.date || selectedDate || '');
      setPostponePeriod(task.period || 'AM');
      setSelectedGoogleEventId(
        String(
          (task.sourceType || task.source_type) === 'google_event'
            ? task.sourceId || task.source_id || ''
            : '',
        ),
      );
      setSelectedPersonId(String(task.person_id || ''));
      setLinkTaskSearchQuery('');
    }, [showActionsModal, task, selectedDate]);

    const today = selectedDate || new Date().toISOString().slice(0, 10);
    const sortedAffaires = React.useMemo(() => {
      return [...affaires].sort((a, b) => {
        const aDebut = a.dateDebut || a.date_debut || '';
        const aFin = a.dateFin || a.date_fin || '';
        const bDebut = b.dateDebut || b.date_debut || '';
        const bFin = b.dateFin || b.date_fin || '';
        const aActive = aDebut <= today && (!aFin || aFin >= today) ? 0 : aDebut > today ? 1 : 2;
        const bActive = bDebut <= today && (!bFin || bFin >= today) ? 0 : bDebut > today ? 1 : 2;
        if (aActive !== bActive) return aActive - bActive;
        return (bDebut || '').localeCompare(aDebut || '');
      });
    }, [affaires, today]);

    const filteredAffaires = React.useMemo(() => {
      const q = linkTaskSearchQuery.toUpperCase().trim();
      if (q.length < 2) return [];
      return sortedAffaires
        .filter(
          (a) =>
            (a.numeroAffaire || '').toUpperCase().includes(q) ||
            (a.client || '').toUpperCase().includes(q) ||
            (a.titre || '').toUpperCase().includes(q) ||
            (a.eventName || '').toUpperCase().includes(q),
        )
        .slice(0, 8);
    }, [linkTaskSearchQuery, sortedAffaires]);

    const googleEventsForLink = React.useMemo(() => {
      const linkDate = task.date || selectedDate;
      const forDay = (googleEvents || []).filter((ev) => {
        if (!linkDate) return true;

        const dayStart = new Date(`${linkDate}T00:00:00`);
        const dayEnd = new Date(`${linkDate}T23:59:59.999`);

        const startRaw = ev.start?.dateTime || ev.start?.date;
        const endRaw = ev.end?.dateTime || ev.end?.date;
        if (!startRaw) return false;

        const startAt = new Date(ev.start?.dateTime ? startRaw : `${startRaw}T00:00:00`);
        const endAt = endRaw
          ? new Date(ev.end?.dateTime ? endRaw : `${endRaw}T23:59:59.999`)
          : startAt;

        // Inclut tout événement qui chevauche la journée ciblée, y compris multi-jours.
        return startAt <= dayEnd && endAt >= dayStart;
      });
      return forDay.sort((a, b) => {
        const ad = a.start?.dateTime || a.start?.date || '';
        const bd = b.start?.dateTime || b.start?.date || '';
        return ad.localeCompare(bd);
      });
    }, [googleEvents, selectedDate, task.date]);

    return (
      <>
        <div
          key={task.id}
          className={`task-row event-row-cols task-row-clickable ${isGoogle ? 'google-task-row' : ''} ${isDone ? 'task-done-row' : ''} ${isHidden ? 'hidden-display' : ''} ${rolledTask ? 'is-rolled' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => setShowActionsModal(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowActionsModal(true);
            }
          }}
        >
          <Button
            variant="ghost"
            className={`ev-col task-status-btn ${isDone ? 'done' : isProgress ? 'in-progress' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onCycleStatus(task);
            }}
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
            {displayNom}
            {task.notes && <span className="task-notes-inline">({task.notes})</span>}
            {rolledTask && (
              <span
                className="task-rolled-badge"
                title={`Tâche reportée${rolledFrom ? ` depuis le ${rolledFrom}` : ''}`}
              >
                Reportée{rolledFrom ? ` (${rolledFrom})` : ''}
              </span>
            )}
            {isGoogle && (
              <Tooltip content="Google Calendar" position="bottom">
                <span className="google-mini-badge google-mini-badge-end">G</span>
              </Tooltip>
            )}
          </span>

          <span className="ev-col ev-col-client" title={displayClient}>
            {displayClient}
          </span>
          <span className="ev-col ev-col-spacer" />

          {task.locationAddress && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.locationAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ev-col task-location-badge ev-col-location"
              title={`📍 ${task.locationAddress}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MapPin size={11} />{' '}
              {task.locationAddress.length > 30
                ? task.locationAddress.slice(0, 30) + '…'
                : task.locationAddress}
            </a>
          )}

          <span className="ev-col ev-col-time">
            {task.allDay === 1 || task.all_day === 1 ? (
              <span className="period-badge period-allday">Journée</span>
            ) : task.time ? (
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

          <span className="ev-col ev-col-personnel">{renderMultiAssign('task', task.id)}</span>
        </div>

        <Modal
          open={showActionsModal}
          onClose={() => setShowActionsModal(false)}
          size="xl"
          className="task-actions-modal"
        >
          <ModalHeader onClose={() => setShowActionsModal(false)}>Actions sur la tâche</ModalHeader>
          <ModalBody className="task-actions-modal-body">
            <div className="task-actions-modal-grid">
              <div className="task-actions-modal-quick-actions">
                <Button
                  variant="secondary"
                  className="task-actions-modal-btn"
                  size="md"
                  onClick={() => {
                    setShowActionsModal(false);
                    onEdit(task);
                  }}
                >
                  <Edit2 size={14} /> Modifier
                </Button>

                <Button
                  variant="secondary"
                  className="task-actions-modal-btn"
                  size="md"
                  onClick={() => {
                    setShowActionsModal(false);
                    onToggleVisible(task);
                  }}
                >
                  {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  {isHidden ? 'Afficher' : 'Masquer'}
                </Button>
              </div>

              <div className="task-actions-modal-block">
                <div className="task-actions-modal-label">
                  <Calendar size={14} /> Reporter
                </div>
                <div className="task-actions-modal-row">
                  <Input
                    type="date"
                    size="md"
                    className="task-actions-modal-input"
                    value={postponeDate}
                    onChange={(e) => setPostponeDate(e.target.value)}
                  />
                  <Select
                    size="md"
                    fullWidth
                    className="task-actions-modal-select"
                    value={postponePeriod}
                    onChange={(e) => setPostponePeriod(e.target.value)}
                    options={[
                      { value: 'AM', label: 'AM' },
                      { value: 'PM', label: 'PM' },
                      { value: 'JOURNEE', label: 'Journée' },
                    ]}
                  />
                  <Button
                    variant="secondary"
                    className="task-actions-modal-btn"
                    size="md"
                    disabled={!postponeDate}
                    onClick={() => {
                      onPostponeTask(task.id, postponeDate, postponePeriod);
                      setShowActionsModal(false);
                    }}
                  >
                    Appliquer
                  </Button>
                </div>
              </div>

              <div className="task-actions-modal-block">
                <div className="task-actions-modal-label">
                  <Link size={14} /> Lier à un évènement Google
                </div>
                <div className="task-actions-modal-row">
                  <Select
                    size="md"
                    fullWidth
                    className="task-actions-modal-select task-actions-modal-select-wide"
                    value={selectedGoogleEventId}
                    onChange={(e) => setSelectedGoogleEventId(e.target.value)}
                    options={[
                      { value: '', label: 'Aucun évènement Google' },
                      ...googleEventsForLink.map((ev) => ({
                        value: String(ev.id),
                        label: `${(ev.start?.dateTime || '').slice(11, 16) || 'Journée'} • ${ev.summary || 'Évènement Google'}${ev.location ? ` • ${ev.location}` : ''}`,
                      })),
                    ]}
                  />
                  <Button
                    variant="secondary"
                    className="task-actions-modal-btn"
                    size="md"
                    onClick={() => {
                      const selectedGoogleEvent = googleEventsForLink.find(
                        (ev) => String(ev.id) === String(selectedGoogleEventId),
                      );
                      onLinkTaskToGoogleEvent(task.id, selectedGoogleEvent || null);
                      setShowActionsModal(false);
                    }}
                  >
                    Lier
                  </Button>
                </div>
              </div>

              <div className="task-actions-modal-block">
                <div className="task-actions-modal-label">
                  <Link size={14} /> Lier à une affaire
                </div>
                <Input
                  type="text"
                  size="md"
                  className="task-actions-modal-input"
                  placeholder="Rechercher AF, client..."
                  value={linkTaskSearchQuery}
                  onChange={(e) => setLinkTaskSearchQuery(e.target.value)}
                />
                {linkTaskSearchQuery.trim().length < 2 ? (
                  <div className="task-actions-modal-hint">
                    Tape au moins 2 caractères pour rechercher.
                  </div>
                ) : (
                  <div className="task-actions-modal-affaires">
                    {filteredAffaires.length > 0 ? (
                      filteredAffaires.map((a) => (
                        <Button
                          variant="ghost"
                          key={a.id || a.numeroAffaire}
                          className="task-actions-modal-affaire-option"
                          onClick={() => {
                            onLinkTask(task.id, a.numeroAffaire);
                            setShowActionsModal(false);
                          }}
                        >
                          <AffaireBadge numero={a.numeroAffaire} type={a.type} size="sm" />
                          <span>{a.client || a.titre || 'Sans client'}</span>
                        </Button>
                      ))
                    ) : (
                      <div className="task-actions-modal-hint">Aucune affaire trouvée.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="task-actions-modal-block">
                <div className="task-actions-modal-label">
                  <User size={14} /> Affecter personnel
                </div>
                <div className="task-actions-modal-row">
                  <Select
                    size="md"
                    fullWidth
                    className="task-actions-modal-select task-actions-modal-select-wide"
                    value={selectedPersonId}
                    onChange={(e) => setSelectedPersonId(e.target.value)}
                    options={[
                      { value: '', label: 'Aucun personnel' },
                      ...(persons || []).map((p) => ({
                        value: String(p.id),
                        label:
                          `${p.firstName || p.prenom || ''} ${p.lastName || p.nom || ''}`.trim(),
                      })),
                    ]}
                  />
                  <Button
                    variant="secondary"
                    className="task-actions-modal-btn"
                    size="md"
                    onClick={() => {
                      onAssignTaskPerson(
                        task.id,
                        selectedPersonId ? Number(selectedPersonId) : null,
                      );
                      setShowActionsModal(false);
                    }}
                  >
                    Affecter
                  </Button>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="danger"
              className="task-actions-modal-btn task-actions-modal-btn-danger"
              size="md"
              onClick={() => {
                setShowActionsModal(false);
                onDelete(task.id);
              }}
            >
              <Trash2 size={14} /> Supprimer
            </Button>
            <Button
              variant="secondary"
              className="task-actions-modal-btn"
              size="md"
              onClick={() => setShowActionsModal(false)}
            >
              Fermer
            </Button>
          </ModalFooter>
        </Modal>
      </>
    );
  },
);

PlanningTaskRow.displayName = 'PlanningTaskRow';

export default PlanningTaskRow;
