import { Link, Link2, MapPin } from 'lucide-react';
import React from 'react';

import { Button, Tooltip } from '@/design-system';

import { capitalizeText } from '../../utils/dateUtils';
import { linkTripsDirectly, unlinkTripDirectly } from './calendarUtils';

// Helper pour afficher les affaires d'une réservation alignées avec leur position
export const renderReservationAffaires = (
  block,
  googleEvents,
  timeSlots,
  blockStartIndex,
  tripData,
  onOpenTrip,
  onTripLinked,
) => {
  // Mode tournée : créer une grille interne alignée sur les slots
  if (
    block.isTournee &&
    block.linkedEventIds &&
    Array.isArray(block.linkedEventIds) &&
    googleEvents &&
    timeSlots
  ) {
    // Pour chaque événement, calculer sa position et son span dans la grille
    const eventBlocks = [];

    block.linkedEventIds.forEach((eventId) => {
      const event = googleEvents.find((e) => e.id === eventId);
      if (!event) return;

      // Récupérer les dates de l'événement
      const isAllDayEvent = !event.start?.dateTime;
      let eventStart, eventEnd;

      if (isAllDayEvent) {
        const [year, month, day] = event.start.date.split('-').map(Number);
        const [endYear, endMonth, endDay] = event.end.date.split('-').map(Number);
        eventStart = new Date(year, month - 1, day, 0, 0, 0);
        eventEnd = new Date(endYear, endMonth - 1, endDay - 1, 23, 59, 59);
      } else {
        eventStart = new Date(event.start.dateTime);
        eventEnd = new Date(event.end.dateTime);
      }

      if (!eventStart || !eventEnd) {
        return;
      }

      // Trouver le premier et le dernier slot que l'événement touche (dans le bloc de la tournée)
      let firstSlotIdx = -1;
      let lastSlotIdx = -1;

      // Parcourir seulement les slots du bloc (de blockStartIndex à blockStartIndex + block.span)
      for (let i = 0; i < block.span; i++) {
        const slotIndex = blockStartIndex + i;
        if (slotIndex >= timeSlots.length) break;

        const slot = timeSlots[slotIndex];

        // Extraire la date en heure locale (pas UTC)
        const slotYear = slot.day.getFullYear();
        const slotMonth = slot.day.getMonth() + 1;
        const slotDate = slot.day.getDate();
        const slotDateISO = `${slotYear}-${String(slotMonth).padStart(2, '0')}-${String(slotDate).padStart(2, '0')}`;

        // Pour événements toute la journée : comparer les dates ISO (YYYY-MM-DD)
        if (isAllDayEvent) {
          const eventStartYear = eventStart.getFullYear();
          const eventStartMonth = eventStart.getMonth();
          const eventStartDate = eventStart.getDate();

          const eventEndYear = eventEnd.getFullYear();
          const eventEndMonth = eventEnd.getMonth();
          const eventEndDate = eventEnd.getDate();

          // Créer les dates ISO pour comparaison
          const eventStartISO = `${eventStartYear}-${String(eventStartMonth + 1).padStart(2, '0')}-${String(eventStartDate).padStart(2, '0')}`;
          const eventEndISO = `${eventEndYear}-${String(eventEndMonth + 1).padStart(2, '0')}-${String(eventEndDate).padStart(2, '0')}`;

          const matches = eventEndISO >= slotDateISO && eventStartISO <= slotDateISO;
          if (matches) {
            if (firstSlotIdx === -1) firstSlotIdx = i;
            lastSlotIdx = i;
          }
        } else {
          // Pour événements avec heure
          const periodStart = new Date(slot.day);
          const periodEnd = new Date(slot.day);

          if (slot.period === 'AM') {
            periodStart.setHours(0, 0, 0, 0);
            periodEnd.setHours(11, 59, 59, 999);
          } else if (slot.period === 'PM') {
            periodStart.setHours(12, 0, 0, 0);
            periodEnd.setHours(23, 59, 59, 999);
          } else {
            periodStart.setHours(0, 0, 0, 0);
            periodEnd.setHours(23, 59, 59, 999);
          }

          const touches = eventStart <= periodEnd && eventEnd >= periodStart;
          if (touches) {
            if (firstSlotIdx === -1) firstSlotIdx = i;
            lastSlotIdx = i;
          }
        }
      }

      if (firstSlotIdx !== -1) {
        let cleanTitle = event.summary || '(Sans titre)';
        if (event.affaire) {
          cleanTitle = cleanTitle.replace(/\baf\s*\d+\b/gi, '').trim();
          cleanTitle = cleanTitle
            .replace(/\s+/g, ' ')
            .replace(/^\s*-\s*|\s*-\s*$/g, '')
            .trim();
        }
        if (!cleanTitle) cleanTitle = '(Sans titre)';
        cleanTitle = capitalizeText(cleanTitle);

        const eventBlock = {
          eventId,
          startSlot: firstSlotIdx,
          span: lastSlotIdx - firstSlotIdx + 1,
          affaire: event.affaire,
          title: cleanTitle,
          eventStart,
        };
        eventBlocks.push(eventBlock);
      }
    });

    if (eventBlocks.length > 0) {
      // Trier les événements par date de début
      eventBlocks.sort((a, b) => {
        if (!a.eventStart) return 1;
        if (!b.eventStart) return -1;
        return a.eventStart - b.eventStart;
      });

      // Construire les éléments avec des boutons "lier" entre les événements adjacents
      // Déterminer les groupes de trajets liés
      const tripMap = {}; // eventId -> trip_group_id
      if (tripData && Array.isArray(tripData)) {
        tripData.forEach((td) => {
          if (td.event_id && td.trip_group_id) {
            tripMap[td.event_id] = td.trip_group_id;
          }
        });
      }

      // Grouper les eventBlocks par trip_group_id (contigus)
      const segments = [];
      let currentGroup = null;
      let currentGroupItems = [];
      eventBlocks.forEach((eb) => {
        const gid = tripMap[eb.eventId];
        if (gid) {
          if (gid === currentGroup) {
            currentGroupItems.push(eb);
          } else {
            if (currentGroup && currentGroupItems.length > 0) {
              segments.push({ type: 'group', groupId: currentGroup, items: currentGroupItems });
            }
            currentGroup = gid;
            currentGroupItems = [eb];
          }
        } else {
          if (currentGroup && currentGroupItems.length > 0) {
            segments.push({ type: 'group', groupId: currentGroup, items: currentGroupItems });
            currentGroup = null;
            currentGroupItems = [];
          }
          segments.push({ type: 'solo', items: [eb] });
        }
      });
      if (currentGroup && currentGroupItems.length > 0) {
        segments.push({ type: 'group', groupId: currentGroup, items: currentGroupItems });
      }

      const gridElements = [];
      let prevLastBlock = null;
      segments.forEach((seg, segIdx) => {
        seg.items.forEach((eventBlock, itemIdx) => {
          const isFirstInSeg = itemIdx === 0;
          const isLastInSeg = itemIdx === seg.items.length - 1;

          // Bouton de liaison entre segments/événements adjacents
          if (prevLastBlock) {
            const gapStart = prevLastBlock.startSlot + prevLastBlock.span + 1;
            const gapEnd = eventBlock.startSlot + 1;
            const linkCol =
              gapStart <= gapEnd ? Math.floor((gapStart + gapEnd) / 2) : eventBlock.startSlot + 1;
            const prevEventId = prevLastBlock.eventId;
            const curEventId = eventBlock.eventId;
            // Si dans le même groupe, bouton "délier"
            if (seg.type === 'group' && !isFirstInSeg) {
              gridElements.push(
                <Tooltip
                  content="Délier les trajets"
                  position="bottom"
                  key={`linked-sep-${segIdx}-${itemIdx}`}
                >
                  <Button
                    variant="ghost"
                    className="tournee-link-btn linked"
                    style={{ gridColumn: `${linkCol} / span 1` }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      unlinkTripDirectly(block.id, curEventId, e.currentTarget, onTripLinked);
                    }}
                  >
                    <Link size={12} />
                  </Button>
                </Tooltip>,
              );
            } else {
              // Bouton "dé-lié" (pas encore liés) - icône Link2
              gridElements.push(
                <Tooltip
                  content="Lier les trajets"
                  position="bottom"
                  key={`link-${segIdx}-${itemIdx}`}
                >
                  <Button
                    variant="ghost"
                    className="tournee-link-btn"
                    style={{ gridColumn: `${linkCol} / span 1` }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      linkTripsDirectly(
                        block.id,
                        prevEventId,
                        curEventId,
                        e.currentTarget,
                        onTripLinked,
                      );
                    }}
                  >
                    <Link2 size={12} />
                  </Button>
                </Tooltip>,
              );
            }
          }

          // Bloc événement (chip) avec bouton trajet intégré
          if (seg.type === 'solo') {
            const soloEventId = eventBlock.eventId;
            gridElements.push(
              <span
                key={`ev-${segIdx}-${itemIdx}`}
                className="tournee-event-chip"
                style={{
                  gridColumn: `${eventBlock.startSlot + 1} / span ${eventBlock.span}`,
                }}
              >
                <span className="tournee-chip-text">{eventBlock.affaire || eventBlock.title}</span>
                {onOpenTrip && (
                  <Tooltip content="Détails du trajet" position="bottom">
                    <Button
                      variant="ghost"
                      className="tournee-trip-btn"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onOpenTrip([soloEventId], 'simple');
                      }}
                    >
                      <MapPin size={10} />
                    </Button>
                  </Tooltip>
                )}
              </span>,
            );
          } else {
            // Événement dans un groupe lié
            const groupEventIds = seg.items.map((it) => it.eventId);
            gridElements.push(
              <span
                key={`ev-${segIdx}-${itemIdx}`}
                className="tournee-event-chip in-trip-group"
                style={{
                  gridColumn: `${eventBlock.startSlot + 1} / span ${eventBlock.span}`,
                }}
              >
                <span className="tournee-chip-text">{eventBlock.affaire || eventBlock.title}</span>
                {isLastInSeg && onOpenTrip && (
                  <Button
                    variant="ghost"
                    className="tournee-trip-btn combined"
                    title={`Trajet combiné (${seg.items.length} événements)`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onOpenTrip(groupEventIds, 'combined');
                    }}
                  >
                    <MapPin size={10} />
                  </Button>
                )}
              </span>,
            );
          }

          prevLastBlock = eventBlock;
        });
      });

      return (
        <div
          className="u-absolute"
          style={{
            top: 'auto',
            left: 0,
            right: 0,
            bottom: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${block.span}, 1fr)`,
            gap: '0.125rem',
            padding: '0.25rem',
            pointerEvents: 'auto',
            zIndex: 10,
            alignItems: 'center',
          }}
        >
          {gridElements}
        </div>
      );
    }

    return null;
  }

  // Mode normal : affichage standard
  // Si pas une tournée mais liée à un événement, récupérer l'affaire depuis l'événement
  let affaires =
    block.affaires && Array.isArray(block.affaires)
      ? block.affaires
      : block.affaire
        ? [block.affaire]
        : [];

  // Si pas de tournée et qu'il y a des événements liés, récupérer leurs numéros d'affaire
  if (
    !block.isTournee &&
    block.linkedEventIds &&
    Array.isArray(block.linkedEventIds) &&
    block.linkedEventIds.length > 0 &&
    googleEvents
  ) {
    const eventAffaires = block.linkedEventIds
      .map((eventId) => {
        const event = googleEvents.find((e) => e.id === eventId);
        return event?.affaire;
      })
      .filter(Boolean);

    if (eventAffaires.length > 0) {
      affaires = eventAffaires;
    }
  }

  // Pour une réservation simple, un seul événement lié possible
  const singleEventId =
    block.googleEventId ||
    (block.linkedEventIds && block.linkedEventIds.length > 0 ? block.linkedEventIds[0] : null);

  if (affaires.length > 0) {
    return (
      <div className="reservation-affaire">
        <span className="reservation-affaire-text">
          {affaires[0]}
          {affaires.length > 1 && <span className="affaire-plus"> +{affaires.length - 1}</span>}
        </span>
        {singleEventId && onOpenTrip && (
          <Tooltip content="Voir le trajet" position="bottom">
            <Button
              variant="ghost"
              className="reservation-trip-btn"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onOpenTrip([singleEventId], 'simple');
              }}
            >
              <MapPin size={10} />
            </Button>
          </Tooltip>
        )}
      </div>
    );
  }

  // Même sans affaire, afficher un bouton trajet si événement lié
  if (singleEventId && onOpenTrip && !block.isTournee) {
    return (
      <div className="reservation-affaire">
        <Tooltip content="Voir le trajet" position="bottom">
          <Button
            variant="ghost"
            className="reservation-trip-btn solo"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onOpenTrip([singleEventId], 'simple');
            }}
          >
            <MapPin size={10} />
          </Button>
        </Tooltip>
      </div>
    );
  }

  return null;
};
