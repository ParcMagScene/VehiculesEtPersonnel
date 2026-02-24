import React, { useState, useEffect, useMemo, useCallback } from 'react';
import useWindowWidth from '../hooks/useWindowWidth';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  isSameDay,
  isWeekend,
  isToday,
  getWeek,
  setMonth,
  isSameWeek,
  isSameMonth,
  isSameYear,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link, Link2, MapPin, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getPeriodTimestamp, formatLocalDate, capitalizeText } from '../utils/dateUtils';
import { hasExpiredTechnicalControl, getExpiredTechnicalControls } from '../utils/vehicleUtils';
import { loadFromIndexedDB } from '../utils/indexedDB';
import { getVehicleAvatar } from '../utils/vehicleAvatars';
import MonthSelector from './MonthSelector';
import WeekSelector from './WeekSelector';
import YearSelector from './YearSelector';
import ReservationModal from './ReservationModal';
import TripDetailsModal from './TripDetailsModal';
import './Calendar.css';

// Fonction pour obtenir les initiales d'un utilisateur
const getUserInitials = (userId, currentUser, users = []) => {
  if (currentUser && userId === currentUser.id) {
    return currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }
  
  // Chercher dans la liste des utilisateurs
  const user = users.find(u => u.id === userId);
  if (user && user.name) {
    return user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }
  
  return `U${userId.toString().slice(-1)}`;
};

// Helper pour compter les liens Google Drive d'un bloc
const getDriveLinksCount = (block) => {
  const raw = block.googleDriveLinks;
  if (Array.isArray(raw) && raw.length > 0) return raw.length;
  const link = block.googleDriveLink;
  if (!link) return 0;
  try {
    const parsed = JSON.parse(link);
    if (Array.isArray(parsed)) return parsed.length;
  } catch { /* ignore */ }
  return link.trim() ? 1 : 0;
};

// Composant Tooltip pour les réservations
const ReservationTooltip = ({ block, currentUser, users = [] }) => {
  let creatorName = `Utilisateur ${block.createdBy}`;
  
  if (currentUser && block.createdBy === currentUser.id) {
    creatorName = currentUser.name;
  } else {
    const creator = users.find(u => u.id === block.createdBy);
    if (creator && creator.name) {
      creatorName = creator.name;
    }
  }

  return (
    <div className="emag-tooltip">
      <div className="tooltip-row">
        <span className="tooltip-label">Type:</span>
        <span className="tooltip-value">{block.isMaintenance ? 'Intervention' : 'Réservation'}</span>
      </div>
      {block.isMaintenance ? (
        <>
          <div className="tooltip-row">
            <span className="tooltip-label">Prestation:</span>
            <span className="tooltip-value">{block.prestationName || 'Non spécifiée'}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Garage:</span>
            <span className="tooltip-value">{block.garageName || 'Non spécifié'}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Début:</span>
            <span className="tooltip-value">{block.start_date || block.startDate || 'Non spécifié'}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Fin:</span>
            <span className="tooltip-value">{block.end_date || block.endDate || 'Non spécifiée'}</span>
          </div>
        </>
      ) : (
        <>
          <div className="tooltip-row">
            <span className="tooltip-label">Client:</span>
            <span className="tooltip-value">{block.clientName || 'Non spécifié'}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Début:</span>
            <span className="tooltip-value">{block.startDate || block.date ? `${new Date(block.startDate || block.date).toLocaleDateString('fr-FR')} ${(block.startPeriod || block.period) === 'AM' ? 'Matin' : 'Après-midi'}` : 'Non spécifié'}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Fin:</span>
            <span className="tooltip-value">{block.endDate || block.date ? `${new Date(block.endDate || block.date).toLocaleDateString('fr-FR')} ${(block.endPeriod || block.period) === 'AM' ? 'Matin' : 'Après-midi'}` : 'Non spécifiée'}</span>
          </div>
        </>
      )}
      {block.description && (
        <div className="tooltip-row">
          <span className="tooltip-label">Description:</span>
          <span className="tooltip-value">{block.description}</span>
        </div>
      )}
      <div className="tooltip-row">
        <span className="tooltip-label">Créé par:</span>
        <span className="tooltip-value">{creatorName}</span>
      </div>
    </div>
  );
};

// Helper pour lier deux trajets directement depuis le calendrier
// Helper pour délier un trajet depuis le calendrier
const unlinkTripDirectly = async (reservationId, eventId, btn, onLinked) => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token || !reservationId) return;
    if (btn) btn.classList.add('linking');
    const response = await fetch('/api/trip-details/unlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ reservationId, eventId })
    });
    if (response.ok) {
      if (btn) btn.classList.remove('linking');
      if (onLinked) onLinked();
    } else {
      if (btn) btn.classList.remove('linking');
      console.error('Erreur déliaison trajet');
    }
  } catch (err) {
    if (btn) btn.classList.remove('linking');
    console.error('Erreur déliaison trajet:', err);
  }
};

const linkTripsDirectly = async (reservationId, eventId1, eventId2, btn, onLinked) => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token || !reservationId) return;
    if (btn) btn.classList.add('linking');
    const response = await fetch('/api/trip-details/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ reservationId, eventId1, eventId2 })
    });
    if (response.ok) {
      if (btn) { btn.classList.remove('linking'); btn.classList.add('linked'); }
      if (onLinked) onLinked();
    } else {
      if (btn) btn.classList.remove('linking');
      console.error('Erreur liaison trajets');
    }
  } catch (err) {
    if (btn) btn.classList.remove('linking');
    console.error('Erreur liaison trajets:', err);
  }
};

// Transformer les trip details de snake_case vers camelCase
const transformTripSnake = (detail) => {
  if (!detail) return undefined;
  return {
    ...detail,
    departureLocation: detail.departure_location || detail.departureLocation,
    departureDate: detail.departure_date || detail.departureDate,
    departureTime: detail.departure_time || detail.departureTime,
    arrivalLocation: detail.arrival_location || detail.arrivalLocation,
    arrivalDate: detail.arrival_date || detail.arrivalDate,
    arrivalTime: detail.arrival_time || detail.arrivalTime,
    returnDepartureLocation: detail.return_departure_location || detail.returnDepartureLocation,
    returnDepartureDate: detail.return_departure_date || detail.returnDepartureDate,
    returnDepartureTime: detail.return_departure_time || detail.returnDepartureTime,
    returnArrivalLocation: detail.return_arrival_location || detail.returnArrivalLocation,
    returnArrivalDate: detail.return_arrival_date || detail.returnArrivalDate,
    returnArrivalTime: detail.return_arrival_time || detail.returnArrivalTime,
    driverName: detail.driver_name || detail.driverName,
    hasJunctionWithNext: detail.has_junction_with_next || detail.hasJunctionWithNext,
    junctionLocation: detail.junction_location || detail.junctionLocation,
    outboundDuration: detail.outbound_duration || detail.outboundDuration,
    returnDuration: detail.return_duration || detail.returnDuration,
    tripGroupId: detail.trip_group_id || detail.tripGroupId
  };
};

// Helper pour afficher les affaires d'une réservation alignées avec leur position
const renderReservationAffaires = (block, googleEvents, timeSlots, blockStartIndex, tripData, onOpenTrip, onTripLinked) => {
  // Mode tournée : créer une grille interne alignée sur les slots
  if (block.isTournee && block.linkedEventIds && Array.isArray(block.linkedEventIds) && googleEvents && timeSlots) {
    // Pour chaque événement, calculer sa position et son span dans la grille
    const eventBlocks = [];
    
    block.linkedEventIds.forEach(eventId => {
      const event = googleEvents.find(e => e.id === eventId);
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
          const dayStart = new Date(slot.day);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(slot.day);
          dayEnd.setHours(23, 59, 59, 999);
          
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
          cleanTitle = cleanTitle.replace(/\s+/g, ' ').replace(/^\s*-\s*|\s*-\s*$/g, '').trim();
        }
        if (!cleanTitle) cleanTitle = '(Sans titre)';
        cleanTitle = capitalizeText(cleanTitle);
        
        const eventBlock = {
          eventId,
          startSlot: firstSlotIdx,
          span: lastSlotIdx - firstSlotIdx + 1,
          affaire: event.affaire,
          title: cleanTitle,
          eventStart
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
        tripData.forEach(td => {
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
            const linkCol = gapStart <= gapEnd ? Math.floor((gapStart + gapEnd) / 2) : eventBlock.startSlot + 1;
            const prevEventId = prevLastBlock.eventId;
            const curEventId = eventBlock.eventId;
            // Si dans le même groupe, bouton "délier"
            if (seg.type === 'group' && !isFirstInSeg) {
              gridElements.push(
                <button
                  key={`linked-sep-${segIdx}-${itemIdx}`}
                  className="tournee-link-btn linked"
                  style={{ gridColumn: `${linkCol} / span 1` }}
                  title="Délier les trajets"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    unlinkTripDirectly(block.id, curEventId, e.currentTarget, onTripLinked);
                  }}
                >
                  <Link size={12} />
                </button>
              );
            } else {
              // Bouton "dé-lié" (pas encore liés) - icône Link2
              gridElements.push(
                <button
                  key={`link-${segIdx}-${itemIdx}`}
                  className="tournee-link-btn"
                  style={{ gridColumn: `${linkCol} / span 1` }}
                  title="Lier les trajets"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    linkTripsDirectly(block.id, prevEventId, curEventId, e.currentTarget, onTripLinked);
                  }}
                >
                  <Link2 size={12} />
                </button>
              );
            }
          }

          // Bloc événement (chip) avec bouton trajet intégré
          if (seg.type === 'solo') {
            const soloEventId = eventBlock.eventId;
            gridElements.push(
              <span key={`ev-${segIdx}-${itemIdx}`} className="tournee-event-chip" style={{
                gridColumn: `${eventBlock.startSlot + 1} / span ${eventBlock.span}`,
              }}>
                <span className="tournee-chip-text">{eventBlock.affaire || eventBlock.title}</span>
                {onOpenTrip && (
                  <button
                    className="tournee-trip-btn"
                    title="Détails du trajet"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onOpenTrip([soloEventId], 'simple');
                    }}
                  >
                    <MapPin size={10} />
                  </button>
                )}
              </span>
            );
          } else {
            // Événement dans un groupe lié
            const groupEventIds = seg.items.map(it => it.eventId);
            gridElements.push(
              <span key={`ev-${segIdx}-${itemIdx}`} className="tournee-event-chip in-trip-group" style={{
                gridColumn: `${eventBlock.startSlot + 1} / span ${eventBlock.span}`,
              }}>
                <span className="tournee-chip-text">{eventBlock.affaire || eventBlock.title}</span>
                {isLastInSeg && onOpenTrip && (
                  <button
                    className="tournee-trip-btn combined"
                    title={`Trajet combiné (${seg.items.length} événements)`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onOpenTrip(groupEventIds, 'combined');
                    }}
                  >
                    <MapPin size={10} />
                  </button>
                )}
              </span>
            );
          }

          prevLastBlock = eventBlock;
        });
      });

      return (
        <div style={{ 
          position: 'absolute',
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
          alignItems: 'center'
        }}>
          {gridElements}
        </div>
      );
    }
    
    return null;
  }
  
  // Mode normal : affichage standard
  // Si pas une tournée mais liée à un événement, récupérer l'affaire depuis l'événement
  let affaires = block.affaires && Array.isArray(block.affaires) 
    ? block.affaires 
    : block.affaire ? [block.affaire] : [];
  
  // Si pas de tournée et qu'il y a des événements liés, récupérer leurs numéros d'affaire
  if (!block.isTournee && block.linkedEventIds && Array.isArray(block.linkedEventIds) && block.linkedEventIds.length > 0 && googleEvents) {
    const eventAffaires = block.linkedEventIds
      .map(eventId => {
        const event = googleEvents.find(e => e.id === eventId);
        return event?.affaire;
      })
      .filter(Boolean);
    
    if (eventAffaires.length > 0) {
      affaires = eventAffaires;
    }
  }
  
  // Pour une réservation simple, un seul événement lié possible
  const singleEventId = block.googleEventId || (block.linkedEventIds && block.linkedEventIds.length > 0 ? block.linkedEventIds[0] : null);
  
  if (affaires.length > 0) {
    return (
      <div className="reservation-affaire">
        <span className="reservation-affaire-text">{affaires[0]}{affaires.length > 1 && <span className="affaire-plus"> +{affaires.length - 1}</span>}</span>
        {singleEventId && onOpenTrip && (
          <button
            className="reservation-trip-btn"
            title="Voir le trajet"
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onOpenTrip([singleEventId], 'simple'); }}
          >
            <MapPin size={10} />
          </button>
        )}
      </div>
    );
  }
  
  // Même sans affaire, afficher un bouton trajet si événement lié
  if (singleEventId && onOpenTrip && !block.isTournee) {
    return (
      <div className="reservation-affaire">
        <button
          className="reservation-trip-btn solo"
          title="Voir le trajet"
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onOpenTrip([singleEventId], 'simple'); }}
        >
          <MapPin size={10} />
        </button>
      </div>
    );
  }
  
  return null;
};

// Couleurs des interventions selon le statut
const getMaintenanceStatusStyle = (status, hasConflict) => {
  // Les interventions terminées ou annulées ne montrent pas les conflits
  if (hasConflict && status !== 'completed' && status !== 'cancelled') {
    return { bg: '#fee2e2', border: '2px solid #dc2626', icon: '⚠️' };
  }
  const styles = {
    scheduled:   { bg: '#dbeafe', border: '2px dashed #3b82f6', icon: '📅' },
    completed:   { bg: '#d1fae5', border: '2px solid #10b981', icon: '✅' },
    reported:    { bg: '#fee2e2', border: '2px solid #ef4444', icon: '⚠️' },
    pending:     { bg: '#ede9fe', border: '2px dashed #8b5cf6', icon: '📝' },
    in_progress: { bg: '#fef3c7', border: '2px solid #f59e0b', icon: '🔧' },
    IN_PROGRESS: { bg: '#fef3c7', border: '2px solid #f59e0b', icon: '🔧' },
    cancelled:   { bg: '#f3f4f6', border: '2px dashed #6b7280', icon: '❌' },
    rescheduled: { bg: '#ffedd5', border: '2px dashed #f97316', icon: '🔄' },
  };
  return styles[status] || { bg: '#f3f4f6', border: '2px dashed #6b7280', icon: '🔧' };
};

const Calendar = ({
  view,
  setView,
  currentDate,
  setCurrentDate,
  vehicles,
  reservations,
  maintenances = [],
  onAddReservation,
  onUpdateReservation,
  onUpdateMaintenance,
  onDeleteReservation,
  clients,
  drivers,
  persons = [],
  locations,
  users = [],
  onScroll,
  googleEvent,
  onCloseGoogleEvent,
  googleEvents,
  highlightedReservationIds = [],
  reservationToEdit,
  onReservationEditComplete,
  onVehicleClick,
  onVehicleDoubleClick,
  onMaintenanceClick,
  onRequestViewEvent,
  currentUser,
  quickReservationSlot,
  onQuickReservationHandled,
}) => {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [dragState, setDragState] = useState(null); // { vehicle, startDay, startPeriod, endDay, endPeriod }
  const [isDragging, setIsDragging] = useState(false);
  const [resizeState, setResizeState] = useState(null); // { reservation, edge: 'start' | 'end', currentDay, currentPeriod }
  const [resizePreview, setResizePreview] = useState(null); // { vehicleId, startDate, startPeriod, endDate, endPeriod }
  
  // Drag-to-move pour blocs de réservation
  const [blockDragState, setBlockDragState] = useState(null); // { block, vehicle, originalStart, originalEnd, currentStart, currentEnd }
  const [blockDragPreview, setBlockDragPreview] = useState(null); // { vehicleId, startDate, startPeriod, endDate, endPeriod }
  const pendingBlockDragRef = React.useRef(null); // { block, vehicle, startDay, startPeriod }

  const [collapsedSections, setCollapsedSections] = useState({ magScene: false, location: false });
  
  // État pour le tooltip global
  const [tooltipState, setTooltipState] = useState({ visible: false, block: null, x: 0, y: 0 });

  // États pour la navigation de dates (toolbar calendrier)
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [showWeekSelector, setShowWeekSelector] = useState(false);
  const [showYearSelector, setShowYearSelector] = useState(false);

  // Fonctions de navigation
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (view === 'week') newDate.setDate(newDate.getDate() - 7);
    else if (view === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else newDate.setFullYear(newDate.getFullYear() - 1);
    setCurrentDate(newDate);
  };
  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'week') newDate.setDate(newDate.getDate() + 7);
    else if (view === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else newDate.setFullYear(newDate.getFullYear() + 1);
    setCurrentDate(newDate);
  };
  const goToToday = () => setCurrentDate(new Date());
  const getDateLabel = () => {
    let label = '';
    if (view === 'week') label = format(currentDate, "'Semaine du' d MMMM yyyy", { locale: fr });
    else if (view === 'month') label = format(currentDate, 'MMMM yyyy', { locale: fr });
    else label = format(currentDate, 'yyyy', { locale: fr });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };
  const isCurrentPeriod = () => {
    const today = new Date();
    if (view === 'week') return isSameWeek(currentDate, today, { weekStartsOn: 1 });
    if (view === 'month') return isSameMonth(currentDate, today);
    return isSameYear(currentDate, today);
  };
  const showTodayHighlight = !isCurrentPeriod();

  // États pour TripDetailsModal ouvert depuis le calendrier
  const [calendarTripModal, setCalendarTripModal] = useState(null); // { reservation, event, tripDetail, combinedEvents, vehicle }
  const [calendarTripCache, setCalendarTripCache] = useState({}); // { [reservationId]: tripDetails[] }
  const [calendarGoogleMapsApiKey, setCalendarGoogleMapsApiKey] = useState('');
  const [calendarCompanyAddress, setCalendarCompanyAddress] = useState('');

  // Réagir au quick-create de réservation depuis le Header
  useEffect(() => {
    if (quickReservationSlot) {
      setSelectedSlot(quickReservationSlot);
      setSelectedReservation(null);
      if (onQuickReservationHandled) onQuickReservationHandled();
    }
  }, [quickReservationSlot, onQuickReservationHandled]);

  // Charger les configs Google Maps au montage (depuis IndexedDB comme ReservationModal)
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await loadFromIndexedDB('calendarConfig', {});
        if (config.googleMapsApiKey) setCalendarGoogleMapsApiKey(config.googleMapsApiKey);
        if (config.companyAddress) setCalendarCompanyAddress(config.companyAddress);
      } catch (err) {
        console.error('Erreur chargement config calendrier:', err);
      }
    };
    loadConfig();
  }, []);

  // Fetch trip data pour une réservation (avec cache)
  const fetchTripData = useCallback(async (reservationId) => {
    if (calendarTripCache[reservationId]) return calendarTripCache[reservationId];
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return [];
      const response = await fetch(`/api/trip-details/${reservationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const trips = Array.isArray(data) ? data : (data.tripDetails || []);
        setCalendarTripCache(prev => ({ ...prev, [reservationId]: trips }));
        return trips;
      }
    } catch (err) {
      console.error('Erreur fetch trip data:', err);
    }
    return [];
  }, [calendarTripCache]);

  // Ouvrir le TripDetailsModal depuis le calendrier
  const handleOpenTripFromCalendar = useCallback(async (block, eventIds, mode) => {
    // eventIds = [eventId] pour solo, [eventId1, eventId2, ...] pour groupe
    const trips = await fetchTripData(block.id);
    const vehicle = vehicles.find(v => v.id === block.vehicleId);
    
    // Helper : trouver un événement Google ou créer un objet minimal
    const findOrCreateEvent = (eid) => {
      const found = googleEvents.find(e => e.id === eid);
      if (found) return found;
      // Fallback : créer un événement minimal depuis les données du bloc
      return {
        id: eid,
        summary: block.affaire || block.clientName || 'Événement',
        affaire: block.affaire,
        start: { dateTime: block.startDate || block.date },
        end: { dateTime: block.endDate || block.date }
      };
    };
    
    if (mode === 'combined' && eventIds.length > 1) {
      // Mode combiné : ouvrir avec combinedEvents
      const combinedEvents = eventIds.map(eid => {
        const event = findOrCreateEvent(eid);
        const td = trips.find(t => t.event_id === eid);
        return { event, tripDetail: td ? transformTripSnake(td) : undefined };
      }).filter(ce => ce.event);
      if (combinedEvents.length > 0) {
        setCalendarTripModal({
          reservation: block,
          event: combinedEvents[0].event,
          tripDetail: combinedEvents[0].tripDetail,
          combinedEvents: combinedEvents.length > 1 ? combinedEvents : null,
          vehicle
        });
      }
    } else {
      // Mode simple
      const eid = eventIds[0];
      const event = findOrCreateEvent(eid);
      const td = trips.find(t => t.event_id === eid);
      if (event) {
        setCalendarTripModal({
          reservation: block,
          event,
          tripDetail: td ? transformTripSnake(td) : undefined,
          combinedEvents: null,
          vehicle
        });
      }
    }
  }, [fetchTripData, vehicles, googleEvents]);

  // Handler de sauvegarde trip depuis le calendrier
  const handleSaveTripFromCalendar = useCallback(async (tripFormData) => {
    if (!calendarTripModal) return null;
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return null;
      const response = await fetch('/api/trip-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          reservationId: calendarTripModal.reservation.id,
          eventId: calendarTripModal.event.id,
          eventOrder: 0,
          ...tripFormData
        })
      });
      if (response.ok) {
        const savedData = await response.json();
        // Invalider le cache pour cette réservation
        setCalendarTripCache(prev => {
          const updated = { ...prev };
          delete updated[calendarTripModal.reservation.id];
          return updated;
        });
        return savedData;
      }
    } catch (err) {
      console.error('Erreur sauvegarde trip:', err);
    }
    return null;
  }, [calendarTripModal]);

  // Callback après liaison de trajets : invalider le cache et re-fetcher
  const handleTripLinked = useCallback((reservationId) => {
    // Invalider le cache
    setCalendarTripCache(prev => {
      const u = { ...prev };
      delete u[reservationId];
      return u;
    });
    // Re-fetcher immédiatement
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    fetch(`/api/trip-details/${reservationId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.ok ? r.json() : []).then(data => {
      const trips = Array.isArray(data) ? data : (data.tripDetails || []);
      setCalendarTripCache(prev => ({ ...prev, [reservationId]: trips }));
    }).catch(() => {});
  }, []);

  // Ouvrir le modal automatiquement quand un événement Google est sélectionné
  useEffect(() => {
    if (googleEvent) {
      setSelectedSlot({ googleEvent });
    }
  }, [googleEvent]);

  // Pré-charger les trip data pour les réservations tournée visibles
  useEffect(() => {
    if (!reservations || !Array.isArray(reservations)) return;
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    const headers = { 'Authorization': `Bearer ${token}` };
    const tourneeIds = reservations
      .filter(r => (r.isTournee || r.is_tournee) && r.id && !calendarTripCache[r.id])
      .map(r => r.id);
    // Aussi charger pour les réservations avec googleEventId
    const singleEventIds = reservations
      .filter(r => !(r.isTournee || r.is_tournee) && (r.googleEventId || r.google_event_id) && r.id && !calendarTripCache[r.id])
      .map(r => r.id);
    const allIds = [...new Set([...tourneeIds, ...singleEventIds])];
    // Charger par petits lots de 5 avec un délai pour éviter le rate limiting
    const loadBatch = async (ids) => {
      const BATCH_SIZE = 5;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(batch.map(id =>
          fetch(`/api/trip-details/${id}`, { headers })
            .then(r => r.ok ? r.json() : [])
            .then(data => {
              const trips = Array.isArray(data) ? data : (data.tripDetails || []);
              setCalendarTripCache(prev => ({ ...prev, [id]: trips }));
            })
            .catch(() => {})
        ));
        if (i + BATCH_SIZE < ids.length) await new Promise(r => setTimeout(r, 100));
      }
    };
    if (allIds.length > 0) loadBatch(allIds);
  }, [reservations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ouvrir le modal automatiquement quand une réservation doit être éditée depuis l'extérieur
  useEffect(() => {
    if (reservationToEdit) {
      setSelectedReservation(reservationToEdit);
    }
  }, [reservationToEdit]);

  const handleScroll = (e) => {
    if (onScroll) {
      onScroll(e.target.scrollLeft);
    }
  };

  // Gérer le mouseup global pour le drag-and-drop, resize et block-drag
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      // Fin d'un pending block drag (clic simple → ouvrir la réservation)
      if (pendingBlockDragRef.current) {
        const { block } = pendingBlockDragRef.current;
        pendingBlockDragRef.current = null;
        if (!block.isMaintenance) {
          const existing = reservations.find(r => r.id === block.id);
          if (existing) setSelectedReservation(existing);
        }
        return;
      }
      // Fin du drag-to-move d'un bloc
      if (blockDragState) {
        handleBlockDragEnd();
        return;
      }
      if (isDragging) {
        handleSlotMouseUp();
      }
      if (resizeState) {
        handleResizeEnd();
      }
    };
    
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, dragState, resizeState, blockDragState]);

  // Fonctions de gestion du tooltip
  const handleTooltipShow = useCallback((event, block) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipState({
      visible: true,
      block,
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  }, []);

  const handleTooltipHide = useCallback(() => {
    setTooltipState({ visible: false, block: null, x: 0, y: 0 });
  }, []);

  // Centrer sur le début du mois/année visible lors des changements, sauf si on revient à aujourd'hui
  useEffect(() => {
    if (view === 'month' || view === 'year') {
      // Utiliser plusieurs timeouts pour s'assurer que tout est bien rendu
      const timeouts = [];
      
      const scrollToPosition = () => {
        const container = document.querySelector('.calendar-scroll-area');
        const headersContainer = document.querySelector('.calendar-headers-scroll-area');
        
        if (!container) return;
        
        // Vérifier si currentDate correspond à aujourd'hui (même jour)
        const today = new Date();
        const isToday = currentDate.getDate() === today.getDate() &&
                       currentDate.getMonth() === today.getMonth() &&
                       currentDate.getFullYear() === today.getFullYear();
        
        if (isToday) {
          // Si on est aujourd'hui, centrer sur le jour actuel
          const todayElements = document.querySelectorAll('.calendar-header-cell.today');
          if (todayElements.length > 0) {
            const todayElement = todayElements[0];
            // Calculer la position pour centrer l'élément
            const containerWidth = container.offsetWidth;
            const elementLeft = todayElement.offsetLeft;
            const elementWidth = todayElement.offsetWidth;
            const scrollLeft = elementLeft - (containerWidth / 2) + (elementWidth / 2);
            
            container.scrollLeft = scrollLeft;
            if (headersContainer) {
              headersContainer.scrollLeft = scrollLeft;
            }
          }
        } else {
          // Sinon, scroller au début du mois/année
          container.scrollLeft = 0;
          if (headersContainer) {
            headersContainer.scrollLeft = 0;
          }
        }
      };

      // Essayer plusieurs fois pour s'assurer que le DOM est prêt
      timeouts.push(setTimeout(scrollToPosition, 50));
      timeouts.push(setTimeout(scrollToPosition, 150));
      timeouts.push(setTimeout(scrollToPosition, 300));

      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    }
  }, [view, currentDate]);

  // Synchroniser le scroll vertical entre la colonne véhicules et la grille
  useEffect(() => {
    const vehicleColumn = document.querySelector('.vehicle-column');
    const scrollArea = document.querySelector('.calendar-scroll-area');
    const headersScrollArea = document.querySelector('.calendar-headers-scroll-area');
    
    if (!vehicleColumn || !scrollArea) return;

    const handleScroll = (e) => {
      if (e.target === scrollArea) {
        vehicleColumn.scrollTop = scrollArea.scrollTop;
        // Synchroniser le scroll horizontal des headers
        if (headersScrollArea) {
          headersScrollArea.scrollLeft = scrollArea.scrollLeft;
        }
      } else if (e.target === vehicleColumn) {
        scrollArea.scrollTop = vehicleColumn.scrollTop;
      }
    };

    vehicleColumn.addEventListener('scroll', handleScroll);
    scrollArea.addEventListener('scroll', handleScroll);

    return () => {
      vehicleColumn.removeEventListener('scroll', handleScroll);
      scrollArea.removeEventListener('scroll', handleScroll);
    };
  }, [vehicles]);

  // Synchroniser les hauteurs des lignes
  useEffect(() => {
    const syncRowHeights = () => {
      // Sélectionner les cellules et lignes dans l'ordre d'affichage
      const leftColumn = document.querySelector('.vehicle-column');
      const grid = document.querySelector('.calendar-scroll-area .calendar-grid');
      
      if (!leftColumn || !grid) return;
      
      // Récupérer tous les enfants de la colonne de gauche (cellules et en-têtes)
      const leftChildren = Array.from(leftColumn.children);
      // Récupérer tous les enfants de la grille (lignes de véhicules et séparateurs)
      const gridChildren = Array.from(grid.children);
      
      // Synchroniser chaque élément
      leftChildren.forEach((leftChild, index) => {
        const gridChild = gridChildren[index];
        if (!gridChild) return;
        
        // Obtenir la hauteur de l'élément de gauche
        const leftHeight = leftChild.offsetHeight;
        
        // Si c'est une ligne de véhicule dans la grille
        if (gridChild.classList.contains('vehicle-row')) {
          const timeslots = gridChild.querySelectorAll('.time-slot');
          timeslots.forEach(slot => {
            slot.style.height = `${leftHeight}px`;
            slot.style.minHeight = `${leftHeight}px`;
          });
        }
        // Si c'est un séparateur de section
        else if (gridChild.classList.contains('vehicle-section-separator')) {
          gridChild.style.height = `${leftHeight}px`;
          gridChild.style.minHeight = `${leftHeight}px`;
        }
      });
    };

    // Exécuter la synchronisation plusieurs fois pour s'assurer qu'elle prend effet
    const timer1 = setTimeout(syncRowHeights, 50);
    const timer2 = setTimeout(syncRowHeights, 200);
    const timer3 = setTimeout(syncRowHeights, 500);
    
    window.addEventListener('resize', syncRowHeights);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      window.removeEventListener('resize', syncRowHeights);
    };
  }, [vehicles, view, reservations, collapsedSections]);

  // Convertir les maintenances programmées en pseudo-réservations pour affichage
  const maintenancesAsReservations = useMemo(() => {
    const converted = maintenances
      .filter(m => {
        // Afficher les maintenances qui ont des dates définies (exclut reported et pending sans dates)
        // Inclut: 'scheduled', 'in_progress', 'completed', 'rescheduled', 'cancelled' (si dates)
        const isValid = m.startDate && m.endDate;
        return isValid;
      })
      .map(m => {
        const pseudoReservation = {
          id: `maint-${m.id}`,
          vehicleId: m.vehicleId,
          date: m.startDate,
          endDate: m.endDate,
          period: 'AM', // Les maintenances occupent toute la journée
          endPeriod: 'PM',
          clientName: '',
          prestationName: `🔧 ${m.description}`,
          affaires: [],
          isMaintenance: true,
          maintenanceId: m.id,
          maintenanceType: m.type,
          maintenanceStatus: m.status,
          createdBy: m.createdBy,
          description: m.description,
          garageName: m.garageName,
          startDate: m.startDate
        };
        
        return pseudoReservation;
      });
    
    return converted;
  }, [maintenances]);

  // Fusionner réservations et maintenances pour l'affichage
  // Les maintenances sont placées après pour s'afficher au-dessus (z-index plus élevé en CSS)
  const allReservations = useMemo(() => {
    return [...reservations, ...maintenancesAsReservations];
  }, [reservations, maintenancesAsReservations]);

  // Fonction pour détecter les conflits entre une maintenance et les réservations
  const getMaintenanceConflicts = useCallback((maintenanceBlock) => {
    if (!maintenanceBlock.isMaintenance || !maintenanceBlock.date) return [];
    
    const newStart = getPeriodTimestamp(maintenanceBlock.date, 'AM');
    const newEnd = getPeriodTimestamp(maintenanceBlock.endDate || maintenanceBlock.date, 'PM');
    
    const conflicts = [];
    for (const r of reservations) {
      if (String(r.vehicleId) !== String(maintenanceBlock.vehicleId)) continue;
      
      const existingStart = getPeriodTimestamp(r.date, r.period);
      const existingEnd = getPeriodTimestamp(
        r.endDate || r.date,
        r.endPeriod || r.period
      );
      
      if (Math.max(newStart, existingStart) <= Math.min(newEnd, existingEnd)) {
        conflicts.push(r);
      }
    }
    return conflicts;
  }, [reservations]);

  // Séparer les véhicules en deux groupes
  const vehicleGroups = useMemo(() => {
    const magSceneVehicles = vehicles.filter(v => !v.isLocation);
    const locationVehicles = vehicles.filter(v => v.isLocation);
    return { magSceneVehicles, locationVehicles };
  }, [vehicles]);

  // Compteur de disponibilité (véhicules non occupés aujourd'hui)
  const availabilityCount = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const isOccupied = (vehicleId) => {
      // Vérifier s'il y a une réservation active aujourd'hui
      const hasReservation = reservations.some(r => {
        if (r.vehicleId !== vehicleId) return false;
        const start = r.startDate?.slice(0, 10) || '';
        const end = r.endDate?.slice(0, 10) || start;
        return start <= today && today <= end;
      });
      // Vérifier s'il y a une maintenance active aujourd'hui
      const hasMaintenance = maintenances.some(m => {
        if (m.vehicleId !== vehicleId) return false;
        if (m.status === 'completed') return false;
        const start = m.startDate?.slice(0, 10) || m.date?.slice(0, 10) || '';
        const end = m.endDate?.slice(0, 10) || start;
        return start <= today && today <= end;
      });
      return hasReservation || hasMaintenance;
    };
    const magSceneAvail = vehicleGroups.magSceneVehicles.filter(v => !isOccupied(v.id)).length;
    const locationAvail = vehicleGroups.locationVehicles.filter(v => !isOccupied(v.id)).length;
    return {
      magScene: { available: magSceneAvail, total: vehicleGroups.magSceneVehicles.length },
      location: { available: locationAvail, total: vehicleGroups.locationVehicles.length },
      allAvailable: magSceneAvail,
      allTotal: vehicleGroups.magSceneVehicles.length,
    };
  }, [vehicleGroups, reservations, maintenances]);

  const days = useMemo(() => {
    if (view === 'week') {
      return eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      });
    } else if (view === 'month') {
      return eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      });
    } else {
      // Vue année - afficher les 12 mois
      return eachMonthOfInterval({
        start: startOfYear(currentDate),
        end: endOfYear(currentDate),
      });
    }
  }, [view, currentDate]);

  const periods = view === 'year' ? ['M'] : ['AM', 'PM'];

  // Handlers pour la navigation depuis la vue année
  const handleMonthClick = useCallback((monthIndex) => {
    if (view === 'year') {
      const newDate = setMonth(currentDate, monthIndex);
      setCurrentDate(newDate);
      setView('month');
    }
  }, [view, currentDate, setCurrentDate, setView]);

  const handleWeekClick = useCallback((weekDate) => {
    if (view === 'year') {
      setCurrentDate(weekDate);
      setView('week');
    }
  }, [view, setCurrentDate, setView]);

  const handleDayClick = useCallback((day) => {
    if (view === 'month') {
      setCurrentDate(day);
      setView('week');
    }
  }, [view, setCurrentDate, setView]);

  const handleSlotMouseDown = (vehicle, date, period, e) => {
    // Ne pas faire de drag si un block drag est en cours
    if (blockDragState || pendingBlockDragRef.current) return;
    // Ne pas faire de drag si c'est la vue année
    if (view === 'year') return;
    
    // Vérifier si une réservation existe déjà
    const existing = reservations.find(
      (r) =>
        r.vehicleId === vehicle.id &&
        isSameDay(new Date(r.date), date) &&
        r.period === period
    );

    // Si une réservation existe, l'ouvrir directement (lecture seule pour non-admin)
    if (existing) {
      setSelectedReservation(existing);
      return;
    }

    // Non-admin : clic simple ou drag → ouvrir la modale en mode demande
    if (!currentUser?.isAdmin) {
      e.preventDefault();
      setIsDragging(true);
      setDragState({
        vehicle,
        startDay: date,
        startPeriod: period,
        endDay: date,
        endPeriod: period
      });
      return;
    }

    // Admin : commencer le drag
    e.preventDefault();
    setIsDragging(true);
    setDragState({
      vehicle,
      startDay: date,
      startPeriod: period,
      endDay: date,
      endPeriod: period
    });
  };

  const handleSlotMouseEnter = (vehicle, date, period) => {
    // Activer le drag-to-move si pending et la souris a bougé sur un slot différent
    if (pendingBlockDragRef.current) {
      const p = pendingBlockDragRef.current;
      const isSameSlot = isSameDay(p.startDay, date) && p.startPeriod === period && p.vehicle.id === vehicle.id;
      if (!isSameSlot) {
        const block = p.block;
        const startDate = new Date(block.date); startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(block.endDate || block.date); endDate.setHours(0, 0, 0, 0);
        setBlockDragState({
          block, vehicle: p.vehicle, targetVehicle: vehicle,
          anchorDay: p.startDay, anchorPeriod: p.startPeriod,
          originalStart: { date: startDate, period: block.period },
          originalEnd: { date: endDate, period: block.endPeriod || block.period },
          currentStart: { date: startDate, period: block.period },
          currentEnd: { date: endDate, period: block.endPeriod || block.period },
        });
        pendingBlockDragRef.current = null;
        // Mettre à jour immédiatement avec la position de la souris
        const origStartTs = getPeriodTimestamp(startDate, block.period);
        const origEndTs = getPeriodTimestamp(endDate, block.endPeriod || block.period);
        const anchorTs = getPeriodTimestamp(p.startDay, p.startPeriod);
        const currentTs = getPeriodTimestamp(date, period);
        const delta = currentTs - anchorTs;
        const tsToDP = (ts) => {
          const d = new Date(Math.floor(ts / 2));
          d.setHours(0, 0, 0, 0);
          return { date: d, period: ts % 2 === 0 ? 'AM' : 'PM' };
        };
        const newStart = tsToDP(origStartTs + delta);
        const newEnd = tsToDP(origEndTs + delta);
        setBlockDragState(prev => ({ ...prev, targetVehicle: vehicle, currentStart: newStart, currentEnd: newEnd }));
        setBlockDragPreview({
          vehicleId: vehicle.id,
          startDate: newStart.date, startPeriod: newStart.period,
          endDate: newEnd.date, endPeriod: newEnd.period,
        });
        return;
      }
    }
    // Drag-to-move en cours (accepte le déplacement vers un autre véhicule)
    if (blockDragState) {
      handleBlockDragMove(vehicle, date, period);
      return;
    }
    // Drag-to-create on empty slots
    if (!isDragging || !dragState || dragState.vehicle.id !== vehicle.id) return;
    
    setDragState({
      ...dragState,
      endDay: date,
      endPeriod: period
    });
  };

  const handleSlotMouseUp = () => {
    if (!isDragging || !dragState) return;
    
    setIsDragging(false);
    
    // Ouvrir la modal avec la période sélectionnée
    setSelectedSlot({
      vehicle: dragState.vehicle,
      startDate: dragState.startDay,
      startPeriod: dragState.startPeriod,
      endDate: dragState.endDay,
      endPeriod: dragState.endPeriod
    });
    
    setDragState(null);
  };

  // Fonction helper pour vérifier si une cellule fait partie de l'aperçu de redimensionnement
  const isInResizePreview = (vehicleId, day, period) => {
    if (!resizePreview || resizePreview.vehicleId !== vehicleId) return false;
    
    // Calculer les timestamps de début et fin de l'aperçu
    let previewStart = getPeriodTimestamp(resizePreview.startDate, resizePreview.startPeriod);
    let previewEnd = getPeriodTimestamp(resizePreview.endDate, resizePreview.endPeriod);
    
    // Si les timestamps sont inversés (invalide), les normaliser pour afficher quand même l'aperçu
    if (previewStart > previewEnd) {
      [previewStart, previewEnd] = [previewEnd, previewStart];
    }
    
    // Calculer le timestamp de la cellule actuelle
    const cellTimestamp = getPeriodTimestamp(day, period);
    
    // La cellule fait partie de l'aperçu si son timestamp est dans l'intervalle [previewStart, previewEnd]
    return cellTimestamp >= previewStart && cellTimestamp <= previewEnd;
  };

  // Fonctions de gestion du redimensionnement
  const handleResizeStart = (e, block, edge) => {
    if (view === 'year') return; // Pas de resize en vue année
    if (!currentUser?.isAdmin) return; // Seuls les admins peuvent redimensionner
    e.preventDefault();
    e.stopPropagation();
    
    // Sauvegarder la position initiale pour vérifier si on a vraiment bougé
    // Convertir les ISO strings en objets Date et normaliser à minuit
    const initialDate = edge === 'start' 
      ? new Date(block.date) 
      : new Date(block.endDate || block.date);
    // Normaliser à minuit pour éviter les problèmes de comparaison d'heures
    initialDate.setHours(0, 0, 0, 0);
    
    const initialPeriod = edge === 'start' 
      ? block.period 
      : (block.endPeriod || block.period);
    
    // Stocker TOUTES les positions initiales (début ET fin) pour éviter les bugs
    const startDate = new Date(block.date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(block.endDate || block.date);
    endDate.setHours(0, 0, 0, 0);
    
    setResizeState({
      reservation: block,
      edge,
      initialDate: initialDate,
      initialPeriod: initialPeriod,
      currentDay: initialDate, // Initialiser avec la date de départ
      currentPeriod: initialPeriod,
      // Stocker les positions de début et fin ORIGINALES
      originalStartDate: startDate,
      originalStartPeriod: block.period,
      originalEndDate: endDate,
      originalEndPeriod: block.endPeriod || block.period
    });
    
    // Initialiser l'aperçu avec la position actuelle
    setResizePreview({
      vehicleId: block.vehicleId,
      startDate: startDate,
      startPeriod: block.period,
      endDate: endDate,
      endPeriod: block.endPeriod || block.period
    });
  };

  const handleResizeMove = (day, period) => {
    if (!resizeState) return;
    
    // Ne mettre à jour que si la position a réellement changé
    if (resizeState.currentDay && 
        isSameDay(resizeState.currentDay, day) && 
        resizeState.currentPeriod === period) {
      return; // Même position, pas de mise à jour nécessaire
    }
    
    const { edge, originalStartDate, originalStartPeriod, originalEndDate, originalEndPeriod, reservation } = resizeState;
    const normalizedDay = new Date(day);
    normalizedDay.setHours(0, 0, 0, 0);
    
    // Calculer l'aperçu de la nouvelle position en utilisant les valeurs ORIGINALES
    let previewStartDate, previewStartPeriod, previewEndDate, previewEndPeriod;
    
    if (edge === 'start') {
      // Redimensionner le début - garder la fin originale
      previewStartDate = normalizedDay;
      previewStartPeriod = period;
      previewEndDate = originalEndDate;
      previewEndPeriod = originalEndPeriod;
    } else {
      // Redimensionner la fin - garder le début original
      previewStartDate = originalStartDate;
      previewStartPeriod = originalStartPeriod;
      previewEndDate = normalizedDay;
      previewEndPeriod = period;
    }
    
    // Toujours mettre à jour l'aperçu (même si invalide, la validation se fera dans handleResizeEnd)
    setResizePreview({
      vehicleId: reservation.vehicleId,
      startDate: previewStartDate,
      startPeriod: previewStartPeriod,
      endDate: previewEndDate,
      endPeriod: previewEndPeriod
    });
    
    setResizeState(prev => ({
      ...prev,
      currentDay: day,
      currentPeriod: period
    }));
  };

  const handleResizeEnd = () => {
    if (!resizeState) {
      return;
    }

    const { reservation, edge, currentDay, currentPeriod, initialDate, initialPeriod } = resizeState;
    
    // Normaliser currentDay à minuit pour comparaison cohérente
    const normalizedCurrentDay = new Date(currentDay);
    normalizedCurrentDay.setHours(0, 0, 0, 0);
    
    // Vérifier qu'on a vraiment changé de position
    const hasMoved = !isSameDay(initialDate, normalizedCurrentDay) || initialPeriod !== currentPeriod;
    
    if (!hasMoved) {
      setResizeState(null);
      return;
    }
    
    // Calculer les nouvelles dates de début et fin en utilisant les valeurs ORIGINALES
    let newStartDate, newStartPeriod, newEndDate, newEndPeriod;
    
    const { originalStartDate, originalStartPeriod, originalEndDate, originalEndPeriod } = resizeState;
    
    if (edge === 'start') {
      // On redimensionne le début - garder la fin originale
      newStartDate = normalizedCurrentDay;
      newStartPeriod = currentPeriod;
      newEndDate = originalEndDate;
      newEndPeriod = originalEndPeriod;
      
      // Vérifier que le début n'est pas après la fin (utiliser les timestamps)
      const startTimestamp = getPeriodTimestamp(newStartDate, newStartPeriod);
      const endTimestamp = getPeriodTimestamp(newEndDate, newEndPeriod);
      
      if (startTimestamp > endTimestamp) {
        setResizeState(null);
        setResizePreview(null);
        return;
      }
    } else {
      // On redimensionne la fin - garder le début original
      newStartDate = originalStartDate;
      newStartPeriod = originalStartPeriod;
      newEndDate = normalizedCurrentDay;
      newEndPeriod = currentPeriod;
      
      // Vérifier que la fin n'est pas avant le début (utiliser les timestamps)
      const startTimestamp = getPeriodTimestamp(newStartDate, newStartPeriod);
      const endTimestamp = getPeriodTimestamp(newEndDate, newEndPeriod);
      
      if (endTimestamp < startTimestamp) {
        setResizeState(null);
        setResizePreview(null);
        return;
      }
    }

    const updatedReservation = {
      ...reservation,
      date: formatLocalDate(newStartDate),
      period: newStartPeriod,
      endDate: formatLocalDate(newEndDate),
      endPeriod: newEndPeriod
    };
    
    // Mettre à jour la réservation
    onUpdateReservation(reservation.id, updatedReservation);

    setResizeState(null);
    setResizePreview(null);
  };

  // ═══ DRAG-TO-MOVE : déplacer un bloc de réservation ═══
  const handleBlockMouseDown = (e, block, vehicle) => {
    if (view === 'year' || e.button !== 0) return;
    if (!currentUser?.isAdmin) return;
    if (block.isMaintenance) return;
    if (e.target.closest('.resize-handle, .tournee-link-btn, .tournee-trip-btn, .reservation-trip-btn')) return;
    e.preventDefault();
    e.stopPropagation();
    // Calculer la position exacte (demi-journée) du clic dans le bloc
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const colWidth = rect.width / block.span;
    const colOffset = Math.max(0, Math.min(block.span - 1, Math.floor(relX / colWidth)));
    // Calculer la demi-journée survolée à partir de la position du bloc
    const blockStartDate = new Date(block.date); blockStartDate.setHours(0, 0, 0, 0);
    const totalHalfDays = (block.period === 'PM' ? 1 : 0) + colOffset;
    const clickDate = new Date(blockStartDate);
    clickDate.setDate(clickDate.getDate() + Math.floor(totalHalfDays / 2));
    const clickPeriod = totalHalfDays % 2 === 0 ? 'AM' : 'PM';
    // Ne pas activer le drag immédiatement — enregistrer pour détecter si c'est un clic ou un drag
    pendingBlockDragRef.current = { block, vehicle, startDay: clickDate, startPeriod: clickPeriod };
  };

  const handleBlockDragMove = (vehicle, day, period) => {
    if (!blockDragState) return;
    
    const normalizedDay = new Date(day);
    normalizedDay.setHours(0, 0, 0, 0);
    
    // Calculer le delta en demi-journées
    const origStartTs = getPeriodTimestamp(blockDragState.originalStart.date, blockDragState.originalStart.period);
    const currentTs = getPeriodTimestamp(normalizedDay, period);
    const anchorTs = getPeriodTimestamp(blockDragState.anchorDay, blockDragState.anchorPeriod);
    const delta = currentTs - anchorTs;
    
    const origEndTs = getPeriodTimestamp(blockDragState.originalEnd.date, blockDragState.originalEnd.period);
    const newStartTs = origStartTs + delta;
    const newEndTs = origEndTs + delta;
    
    // Convertir timestamps back to dates/periods
    const tsToDatePeriod = (ts) => {
      const d = new Date(Math.floor(ts / 2));
      d.setHours(0, 0, 0, 0);
      return { date: d, period: ts % 2 === 0 ? 'AM' : 'PM' };
    };
    
    const newStart = tsToDatePeriod(newStartTs);
    const newEnd = tsToDatePeriod(newEndTs);
    
    // Vérifier les conflits avec les réservations du véhicule cible
    const targetVehicleId = vehicle.id;
    const hasConflict = targetVehicleId !== blockDragState.vehicle.id && reservations.some(r => {
      if (r.id === blockDragState.block.id) return false;
      if (r.vehicleId !== targetVehicleId) return false;
      const rStartTs = getPeriodTimestamp(new Date(r.date || r.startDate), r.period || r.startPeriod || 'AM');
      const rEndTs = getPeriodTimestamp(new Date(r.endDate || r.date || r.startDate), r.endPeriod || r.period || 'PM');
      return newStartTs <= rEndTs && newEndTs >= rStartTs;
    });
    
    setBlockDragState(prev => ({
      ...prev,
      targetVehicle: vehicle,
      currentStart: newStart,
      currentEnd: newEnd,
      hasConflict,
    }));
    
    setBlockDragPreview({
      vehicleId: vehicle.id,
      startDate: newStart.date,
      startPeriod: newStart.period,
      endDate: newEnd.date,
      endPeriod: newEnd.period,
      hasConflict,
    });
  };

  const handleBlockDragEnd = () => {
    if (!blockDragState) return;
    
    const { block, vehicle, targetVehicle, currentStart, currentEnd, originalStart, originalEnd, hasConflict } = blockDragState;
    
    // Vérifier si la position a changé
    const hasMoved = !isSameDay(originalStart.date, currentStart.date) || originalStart.period !== currentStart.period;
    const hasChangedVehicle = targetVehicle && targetVehicle.id !== vehicle.id;
    
    if ((hasMoved || hasChangedVehicle) && !hasConflict) {
      const existing = reservations.find(r => r.id === block.id);
      if (existing) {
        const updatedReservation = {
          ...existing,
          date: formatLocalDate(currentStart.date),
          period: currentStart.period,
          endDate: formatLocalDate(currentEnd.date),
          endPeriod: currentEnd.period,
          ...(hasChangedVehicle ? { vehicleId: targetVehicle.id } : {}),
        };
        onUpdateReservation(existing.id, updatedReservation);
      }
    }
    
    setBlockDragState(null);
    setBlockDragPreview(null);
  };

  // Vérifier si une cellule fait partie du preview de déplacement de bloc
  const isInBlockDragPreview = (vehicleId, day, period) => {
    if (!blockDragPreview || blockDragPreview.vehicleId !== vehicleId) return false;
    let previewStart = getPeriodTimestamp(blockDragPreview.startDate, blockDragPreview.startPeriod);
    let previewEnd = getPeriodTimestamp(blockDragPreview.endDate, blockDragPreview.endPeriod);
    if (previewStart > previewEnd) [previewStart, previewEnd] = [previewEnd, previewStart];
    const cellTs = getPeriodTimestamp(day, period);
    return cellTs >= previewStart && cellTs <= previewEnd;
  };

  const handleSlotClick = (vehicle, date, period) => {
    // Cette fonction est maintenant utilisée uniquement pour la vue année
    if (view !== 'year') return;
    
    // Vérifier si une réservation existe déjà
    const existing = reservations.find(
      (r) =>
        r.vehicleId === vehicle.id &&
        isSameDay(new Date(r.date), date) &&
        r.period === period
    );

    if (existing) {
      setSelectedReservation(existing);
    } else {
      setSelectedSlot({ vehicle, date, period });
    }
  };

  // Vérifier si un slot fait partie de la sélection en cours
  const isInDragSelection = useCallback((vehicleId, date, period) => {
    if (!dragState || dragState.vehicle.id !== vehicleId) return false;
    
    const dragPeriods = view === 'year' ? ['M'] : ['AM', 'PM'];
    
    // Créer un tableau de tous les slots
    const allSlots = [];
    days.forEach(day => {
      dragPeriods.forEach(p => {
        allSlots.push({ day, period: p });
      });
    });
    
    // Trouver les indices de début et fin
    const startIndex = allSlots.findIndex(s => 
      isSameDay(s.day, dragState.startDay) && s.period === dragState.startPeriod
    );
    const endIndex = allSlots.findIndex(s => 
      isSameDay(s.day, dragState.endDay) && s.period === dragState.endPeriod
    );
    const currentIndex = allSlots.findIndex(s => 
      isSameDay(s.day, date) && s.period === period
    );
    
    if (startIndex === -1 || endIndex === -1 || currentIndex === -1) return false;
    
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    
    return currentIndex >= minIndex && currentIndex <= maxIndex;
  }, [dragState, days, view]);

  const getReservation = (vehicleId, date, period) => {
    // Filtrer toutes les réservations correspondantes
    const matches = allReservations.filter((r) => {
      if (r.vehicleId !== vehicleId) return false;
      
      // Calculer les timestamps de début et fin de la réservation
      const resStart = getPeriodTimestamp(r.date, r.period);
      const resEnd = getPeriodTimestamp(
        r.endDate || r.date, 
        r.endPeriod || r.period
      );
      
      // Calculer le timestamp de la cellule actuelle
      const cellTimestamp = getPeriodTimestamp(date, period);
      
      // La cellule fait partie de la réservation si son timestamp est dans l'intervalle [resStart, resEnd]
      return cellTimestamp >= resStart && cellTimestamp <= resEnd;
    });
    
    // Priorité aux maintenances : si une maintenance existe, elle prend le dessus
    const maintenance = matches.find(r => r.isMaintenance);
    if (maintenance) return maintenance;
    
    // Sinon retourner la première réservation normale
    return matches[0];
  };

  // Grouper les réservations consécutives pour affichage continu
  const getReservationBlocks = (vehicleId, days, period) => {
    const blocks = [];
    let currentBlock = null;

    days.forEach((day, dayIndex) => {
      const reservation = getReservation(vehicleId, day, period);
      
      if (reservation) {
        if (!currentBlock || 
            currentBlock.id !== reservation.id ||
            currentBlock.clientName !== reservation.clientName ||
            currentBlock.endDate !== reservation.endDate ||
            currentBlock.endPeriod !== reservation.endPeriod) {
          // Nouveau bloc
          if (currentBlock) {
            blocks.push(currentBlock);
          }
          currentBlock = {
            ...reservation,
            startIndex: dayIndex,
            endIndex: dayIndex,
            indices: [dayIndex]
          };
        } else {
          // Continuer le bloc
          currentBlock.endIndex = dayIndex;
          currentBlock.indices.push(dayIndex);
        }
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
          currentBlock = null;
        }
      }
    });

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    return blocks;
  };

  const findBlockForCell = (blocks, dayIndex) => {
    return blocks.find(block => block.indices.includes(dayIndex));
  };

  const handleSaveReservation = (reservationData) => {
    let success = false;
    if (selectedReservation) {
      success = onUpdateReservation(selectedReservation.id, reservationData);
    } else {
      success = onAddReservation(reservationData);
    }
    
    // Ne fermer la modal que si la sauvegarde a réussi
    if (success !== false) {
      setSelectedSlot(null);
      setSelectedReservation(null);
    }
  };

  const handleDeleteReservation = () => {
    if (selectedReservation) {
      onDeleteReservation(selectedReservation.id);
      setSelectedReservation(null);
    }
  };

  const closeModal = () => {
    setSelectedSlot(null);
    setSelectedReservation(null);
    if (onCloseGoogleEvent) {
      onCloseGoogleEvent();
    }
    if (onReservationEditComplete) {
      onReservationEditComplete();
    }
  };

  const windowWidth = useWindowWidth();

  const gridColumns = useMemo(() => {
    let minWidth;
    if (view === 'year') {
      minWidth = windowWidth <= 480 ? 80 : windowWidth <= 768 ? 100 : windowWidth <= 1024 ? 120 : 150;
      return `repeat(12, minmax(${minWidth}px, 1fr))`;
    }
    if (view === 'week') {
      minWidth = windowWidth <= 480 ? 55 : windowWidth <= 768 ? 65 : windowWidth <= 1024 ? 80 : 100;
    } else {
      // month
      minWidth = windowWidth <= 480 ? 26 : windowWidth <= 768 ? 32 : windowWidth <= 1024 ? 42 : 55;
    }
    return `repeat(${days.length * 2}, minmax(${minWidth}px, 1fr))`;
  }, [view, days.length, windowWidth]);

  // Gestionnaire de mouvement global pour le redimensionnement avec throttle
  const throttleTimeoutRef = React.useRef(null);
  const lastPositionRef = React.useRef({ dayIndex: null, period: null });
  
  const handleGlobalMouseMove = (e) => {
    if (!resizeState) return;
    
    // Trouver la grille calendrier
    const grid = document.querySelector('.calendar-grid');
    if (!grid) return;
    
    // Obtenir les dimensions de la grille
    const gridRect = grid.getBoundingClientRect();
    const relativeX = e.clientX - gridRect.left;
    
    // Calculer le nombre de colonnes par jour (2 pour AM/PM)
    const periodsPerDay = view === 'year' ? 1 : 2;
    const totalColumns = days.length * periodsPerDay;
    const columnWidth = gridRect.width / totalColumns;
    
    // Calculer l'index de colonne
    const columnIndex = Math.floor(relativeX / columnWidth);
    
    // Calculer dayIndex et period
    const dayIndex = Math.floor(columnIndex / periodsPerDay);
    const periodIndex = columnIndex % periodsPerDay;
    const period = periodsPerDay === 1 ? 'M' : (periodIndex === 0 ? 'AM' : 'PM');
    
    // Vérifier que l'index est valide
    if (dayIndex < 0 || dayIndex >= days.length) return;
    
    // Vérifier si on est sur une nouvelle cellule
    if (lastPositionRef.current.dayIndex === dayIndex && 
        lastPositionRef.current.period === period) {
      return; // Même cellule, ne rien faire
    }
    
    // Mettre à jour la dernière position
    lastPositionRef.current = { dayIndex, period };
    
    // Trouver le jour correspondant
    const day = days[dayIndex];
    handleResizeMove(day, period);
  };

  const handleGlobalMouseUp = () => {
    if (resizeState) {
      handleResizeEnd();
      lastPositionRef.current = { dayIndex: null, period: null }; // Reset
    }
    setResizePreview(null);
  };

  return (
    <div 
      className="calendar-container"
      onMouseMove={handleGlobalMouseMove}
      onMouseUp={handleGlobalMouseUp}
    >
      {/* Toolbar de navigation */}
      <div className="cal-nav-toolbar">
        <div className="cal-nav-views">
          <button className={`cal-nav-view-btn ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>Semaine</button>
          <button className={`cal-nav-view-btn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Mois</button>
          <button className={`cal-nav-view-btn ${view === 'year' ? 'active' : ''}`} onClick={() => setView('year')}>Année</button>
        </div>
        <div className="cal-nav-date">
          <button className="cal-nav-btn" onClick={goToPrevious}><ChevronLeft size={18} /></button>
          <button className={`cal-nav-btn cal-nav-today ${showTodayHighlight ? 'highlight' : ''}`} onClick={goToToday}>Aujourd'hui</button>
          <button className="cal-nav-btn" onClick={goToNext}><ChevronRight size={18} /></button>
          <span 
            className="cal-nav-label clickable"
            onClick={() => {
              if (view === 'month') setShowMonthSelector(true);
              if (view === 'week') setShowWeekSelector(true);
              if (view === 'year') setShowYearSelector(true);
            }}
            title={view === 'month' ? 'Sélectionner un mois' : view === 'week' ? 'Sélectionner une semaine' : 'Sélectionner une année'}
          >
            {getDateLabel()}
          </span>
        </div>
      </div>
      <div className="calendar">
        {/* Ligne des headers - fixe, non scrollable */}
        <div className="calendar-headers-row">
          <div className="vehicle-column-header">
            <span>Véhicules Mag Scène</span>
            <span className="vehicle-availability-badge" title="Véhicules disponibles aujourd'hui (hors locations)">
              {availabilityCount.magScene.available}/{availabilityCount.magScene.total}
            </span>
            <button 
              className="section-toggle-button" 
              onClick={() => setCollapsedSections(prev => ({ ...prev, magScene: !prev.magScene }))}
              title={collapsedSections.magScene ? 'Développer' : 'Rétracter'}
            >
              {collapsedSections.magScene ? '▼' : '▲'}
            </button>
          </div>
          <div className="calendar-headers-scroll-area">
            <div className={`calendar-grid-headers ${view}-view`} style={{ gridTemplateColumns: gridColumns }}>
              {/* En-tête */}
              {view === 'year' ? (
                // Vue année : 12 colonnes pour les 12 mois
                <>
                  <div className="calendar-header">
                    {days.map((monthDate, monthIndex) => {
                      const monthStart = startOfMonth(monthDate);
                      const monthEnd = endOfMonth(monthDate);
                      const weeksInMonth = eachWeekOfInterval({
                        start: monthStart,
                        end: monthEnd
                      }, { weekStartsOn: 1 });

                      return (
                        <div
                          key={monthIndex}
                          className="calendar-header-cell month-header clickable"
                          onClick={() => handleMonthClick(monthIndex)}
                          title="Cliquer pour voir le mois"
                        >
                          <div className="month-name">{format(monthDate, 'MMMM', { locale: fr })}</div>
                          <div className="weeks-in-month">
                            {weeksInMonth.map((weekStart, idx) => {
                              const weekNum = getWeek(weekStart, { weekStartsOn: 1 });
                              return (
                                <span 
                                  key={idx} 
                                  className="week-number-small clickable"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleWeekClick(weekStart);
                                  }}
                                  title="Cliquer pour voir la semaine"
                                >
                                  S{weekNum}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                          
                      );
                    })}
                  </div>
                </>
              ) : (
                // Vues semaine et mois : en-têtes standards
                <>
                  <div className="calendar-header">
                    {days.map((day, index) => (
                      <div
                        key={index}
                        className={`calendar-header-cell day-header ${isWeekend(day) ? 'weekend' : ''} ${isToday(day) ? 'today' : ''} ${view === 'month' ? 'clickable' : ''}`}
                        style={{ gridColumn: 'span 2' }}
                        data-day-index={index}
                        onClick={() => view === 'month' && handleDayClick(day)}
                        title={view === 'month' ? 'Cliquer pour voir la semaine' : undefined}
                      >
                        <div>
                          <div className="day-name">{format(day, 'EEEE', { locale: fr })}</div>
                          <div className="day-number">{format(day, 'd MMM', { locale: fr })}</div>
                        </div>
                      </div>
                          
                    ))}
                  </div>

                  {/* Sous-en-tête AM/PM */}
                  <div className="calendar-subheader">
                    {days.map((day, index) => (
                      <React.Fragment key={index}>
                        <div className={`calendar-header-cell period-cell ${isWeekend(day) ? 'weekend' : ''} ${isToday(day) ? 'today today-left' : ''}`} data-day-index={index}>
                          AM
                        </div>
                        <div className={`calendar-header-cell period-cell ${isWeekend(day) ? 'weekend' : ''} ${isToday(day) ? 'today today-right' : ''}`} data-day-index={index}>
                          PM
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
                          
        </div>

        {/* Ligne du contenu scrollable */}
        <div className="calendar-content-row">
          {/* Colonne véhicules fixe à gauche */}
          <div className="vehicle-column">
            {/* Section Véhicules Mag Scène */}
            {vehicleGroups.magSceneVehicles.length > 0 && (
              <>
                {!collapsedSections.magScene && vehicleGroups.magSceneVehicles.map((vehicle) => {
                  // Vérifier si le véhicule a une panne signalée
                  const hasBreakdown = maintenances.some(m => 
                    m.vehicleId === vehicle.id && 
                    (m.status === 'reported' || m.type === 'breakdown') &&
                    m.status !== 'completed'
                  );

                  // Vérifier si le véhicule a un contrôle technique expiré
                  const hasExpiredControl = hasExpiredTechnicalControl(vehicle, maintenances);
                  const expiredControls = hasExpiredControl ? getExpiredTechnicalControls(vehicle, maintenances) : [];
                  
                  return (
                  <div 
                    key={vehicle.id} 
                    className="vehicle-cell"
                    onClick={() => onVehicleClick && onVehicleClick(vehicle)}
                    onDoubleClick={(e) => { e.stopPropagation(); onVehicleDoubleClick && onVehicleDoubleClick(vehicle); }}
                    style={{ cursor: onVehicleClick ? 'pointer' : 'default' }}
                  >
                    <div
                      className="vehicle-color"
                      style={{ backgroundColor: vehicle.displayColor || vehicle.color || '#3b82f6' }}
                    />
                    <div className="vehicle-photo">
                      {vehicle.photo ? (
                        <img src={`/Photos/${vehicle.photo}`} alt={vehicle.name} />
                      ) : (
                        <img src={getVehicleAvatar(vehicle.type)} alt={vehicle.name} className="vehicle-avatar" />
                      )}
                      {hasBreakdown && (
                        <span className="breakdown-indicator-photo" title="Panne signalée">⚠️</span>
                      )}
                      {hasExpiredControl && (
                        <div 
                          className="expired-control-indicator" 
                          title={`Contrôle technique expiré: ${expiredControls.map(c => `${c.type} (${c.daysExpired}j)`).join(', ')}`}
                        >
                          🚫
                        </div>
                      )}
                    </div>
                    <div className="vehicle-info">
                      <span className="vehicle-name">{vehicle.name}</span>
                      <span className="vehicle-brand">{vehicle.brand || vehicle.marque || ''}</span>
                      <span className="vehicle-type">{vehicle.type || ''}</span>
                      <span className="vehicle-registration">{vehicle.registration || vehicle.immatriculation || ''}</span>
                    </div>
                  </div>
                  );
                })}
              </>
            )}
            
            {/* Section Véhicules de location */}
            {vehicleGroups.locationVehicles.length > 0 && (
              <>
                <div 
                  className="vehicle-section-header"
                >
                  <span>Véhicules de location</span>
                  <span className="vehicle-availability-badge location" title="Véhicules de location disponibles aujourd'hui">
                    {availabilityCount.location.available}/{availabilityCount.location.total}
                  </span>
                  <button 
                    className="section-toggle-button"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, location: !prev.location }))}
                  >
                    {collapsedSections.location ? '▼' : '▲'}
                  </button>
                </div>
                {!collapsedSections.location && vehicleGroups.locationVehicles.map((vehicle) => {
                  // Vérifier si le véhicule a une panne signalée
                  const hasBreakdown = maintenances.some(m => 
                    m.vehicleId === vehicle.id && 
                    (m.status === 'reported' || m.type === 'breakdown') &&
                    m.status !== 'completed'
                  );

                  // Vérifier si le véhicule a un contrôle technique expiré
                  const hasExpiredControl = hasExpiredTechnicalControl(vehicle, maintenances);
                  const expiredControls = hasExpiredControl ? getExpiredTechnicalControls(vehicle, maintenances) : [];
                  
                  return (
                  <div 
                    key={vehicle.id} 
                    className="vehicle-cell"
                    onClick={() => onVehicleClick && onVehicleClick(vehicle)}
                    onDoubleClick={(e) => { e.stopPropagation(); onVehicleDoubleClick && onVehicleDoubleClick(vehicle); }}
                    style={{ cursor: onVehicleClick ? 'pointer' : 'default' }}
                  >
                    <div
                      className="vehicle-color"
                      style={{ backgroundColor: vehicle.displayColor || vehicle.color || '#3b82f6' }}
                    />
                    <div className="vehicle-photo">
                      {vehicle.photo ? (
                        <img src={`/Photos/${vehicle.photo}`} alt={vehicle.name} />
                      ) : (
                        <img src={getVehicleAvatar(vehicle.type)} alt={vehicle.name} className="vehicle-avatar" />
                      )}
                      {hasBreakdown && (
                        <span className="breakdown-indicator-photo" title="Panne signalée">⚠️</span>
                      )}
                      {hasExpiredControl && (
                        <div 
                          className="expired-control-indicator" 
                          title={`Contrôle technique expiré: ${expiredControls.map(c => `${c.type} (${c.daysExpired}j)`).join(', ')}`}
                        >
                          🚫
                        </div>
                      )}
                    </div>
                    <div className="vehicle-info">
                      <span className="vehicle-name">{vehicle.name}</span>
                      <span className="vehicle-brand">{vehicle.brand || vehicle.marque || ''}</span>
                      <span className="vehicle-type">{vehicle.type || ''}</span>
                      <span className="vehicle-registration">{vehicle.registration || vehicle.immatriculation || ''}</span>
                    </div>
                  </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Grille scrollable à droite */}
          <div className="calendar-scroll-area" onScroll={handleScroll}>
            <div className={`calendar-grid ${view}-view`} style={{ gridTemplateColumns: gridColumns, position: 'relative' }}>
              {/* Lignes véhicules - Section Mag Scène */}
              {!collapsedSections.magScene && vehicleGroups.magSceneVehicles.map((vehicle) => {
            // Créer un tableau de toutes les demi-journées (ou mois pour vue année)
            const timeSlots = [];
            if (view === 'year') {
              // Vue année : une slot par mois
              days.forEach(monthDate => {
                timeSlots.push({ day: monthDate, period: 'M' });
              });
            } else {
              // Vue semaine/mois : AM/PM par jour
              days.forEach(day => {
                periods.forEach(period => {
                  timeSlots.push({ day, period });
                });
              });
            }

            // Trouver les blocs de réservations consécutives
            const blocks = [];
            let currentBlock = null;

            if (view === 'year') {
              // Vue année : afficher les mois occupés
              timeSlots.forEach((slot, index) => {
                const monthStart = startOfMonth(slot.day);
                const monthEnd = endOfMonth(slot.day);
                
                // Vérifier s'il y a des réservations dans ce mois
                const hasReservation = reservations.some(r => {
                  const rDate = new Date(r.date);
                  return r.vehicleId === vehicle.id && rDate >= monthStart && rDate <= monthEnd;
                });

                if (hasReservation) {
                  if (!currentBlock) {
                    currentBlock = {
                      clientName: 'Occupé',
                      startIndex: index,
                      span: 1
                    };
                  } else {
                    currentBlock.span++;
                  }
                } else {
                  if (currentBlock) {
                    blocks.push(currentBlock);
                    currentBlock = null;
                  }
                }
              });
              if (currentBlock) blocks.push(currentBlock);
            } else {
              // Vue semaine/mois : logique AM/PM habituelle
              timeSlots.forEach((slot, index) => {
                const reservation = getReservation(vehicle.id, slot.day, slot.period);
                
                if (reservation) {
                  // Pour les maintenances, utiliser prestationName au lieu de clientName pour la comparaison
                  const currentName = currentBlock ? (currentBlock.isMaintenance ? currentBlock.prestationName : currentBlock.clientName) : null;
                  const newName = reservation.isMaintenance ? reservation.prestationName : reservation.clientName;
                  
                  if (!currentBlock || currentBlock.id !== reservation.id || currentName !== newName || currentBlock.isMaintenance !== reservation.isMaintenance) {
                    if (currentBlock) blocks.push(currentBlock);
                    currentBlock = {
                      ...reservation,
                      startIndex: index,
                      span: 1
                    };
                  } else {
                    currentBlock.span++;
                  }
                } else {
                  if (currentBlock) {
                    blocks.push(currentBlock);
                    currentBlock = null;
                  }
                }
              });
              if (currentBlock) blocks.push(currentBlock);
            }

            return (
              <div key={vehicle.id} className="vehicle-row">
                {timeSlots.map((slot, slotIndex) => {
                  const block = blocks.find(b => b.startIndex === slotIndex);
                  const isInBlock = blocks.some(b => slotIndex > b.startIndex && slotIndex < b.startIndex + b.span);
                  
                  // Vérifier si cette cellule fait partie de la prévisualisation
                  const cellInPreview = isInResizePreview(vehicle.id, slot.day, slot.period);
                  
                  // Vérifier si cette cellule est dans un bloc en cours de redimensionnement
                  const inResizingBlock = blocks.some(b => {
                    const isResizing = resizeState && resizeState.reservation.id === b.id;
                    return isResizing && slotIndex >= b.startIndex && slotIndex < b.startIndex + b.span;
                  });
                  
                  // Si dans un bloc en cours de redimensionnement, afficher comme cellule normale
                  if (inResizingBlock) {
                    const dayIndex = days.findIndex(d => isSameDay(d, slot.day));
                    const isFirstOfDay = slot.period === 'AM';
                    const isLastOfDay = slot.period === 'PM';
                    const isSelected = isInDragSelection(vehicle.id, slot.day, slot.period);
                    const isInPreview = isInResizePreview(vehicle.id, slot.day, slot.period);
                    
                    return (
                      <div
                        key={`${vehicle.id}-${slotIndex}`}
                        className={`time-slot period-${slot.period.toLowerCase()} ${isWeekend(slot.day) ? 'weekend-slot' : ''} ${isToday(slot.day) ? 'today-slot' : ''} ${isToday(slot.day) && isFirstOfDay ? 'today-left' : ''} ${isToday(slot.day) && isLastOfDay ? 'today-right' : ''} ${isSelected ? 'drag-selected' : ''} ${isInPreview ? 'resize-preview' : ''}`}
                        data-day-index={dayIndex}
                      />
                    );
                  }
                  
                  // Ne pas rendre les cellules dans un bloc (comportement normal)
                  if (isInBlock) return null;
                  
                  if (block) {
                    const dayIndex = days.findIndex(d => isSameDay(d, slot.day));
                    const isFirstOfDay = slot.period === 'AM';
                    const isLastOfDay = slot.period === 'PM' && block.span === 1;
                    const isBeingResized = resizeState && resizeState.reservation.id === block.id;
                    const isBeingDragged = blockDragState && blockDragState.block.id === block.id;
                        // Calculer les slots couverts par ce bloc pour les tournées
                    
                    // Si on redimensionne ce bloc, ne pas l'afficher (on affiche uniquement la prévisualisation)
                    if (isBeingResized) return null;
                    
                    return (
                      <div
                        key={`${vehicle.id}-${slotIndex}`}
                        className={`time-slot reserved period-${slot.period.toLowerCase()} ${isWeekend(slot.day) ? 'weekend-slot' : ''} ${isToday(slot.day) ? 'today-slot' : ''} ${isToday(slot.day) && isFirstOfDay ? 'today-left' : ''} ${isToday(slot.day) && isLastOfDay ? 'today-right' : ''}`}
                        style={{ 
                          gridColumn: `span ${block.span}`, position: 'relative',
                          cursor: block.isMaintenance ? 'pointer' : (currentUser?.isAdmin ? 'grab' : 'pointer')
                        }}
                        onMouseDown={(e) => {
                          if (e.target.closest('.tournee-link-btn, .tournee-trip-btn, .reservation-trip-btn, .resize-handle')) return;
                          if (e.button === 2) return;
                          if (block.isMaintenance) {
                            e.preventDefault();
                            if (onMaintenanceClick) {
                              const maintenanceId = block.maintenanceId || block.id.replace('maint-', '');
                              onMaintenanceClick(vehicle, maintenanceId);
                            }
                            return;
                          }
                          handleBlockMouseDown(e, block, vehicle);
                        }}
                        onMouseMove={(e) => {
                          if (!blockDragState && !pendingBlockDragRef.current) return;
                          if ((blockDragState && blockDragState.vehicle.id !== vehicle.id) ||
                              (pendingBlockDragRef.current && pendingBlockDragRef.current.vehicle.id !== vehicle.id)) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relX = e.clientX - rect.left;
                          const colWidth = rect.width / block.span;
                          const colOffset = Math.max(0, Math.min(block.span - 1, Math.floor(relX / colWidth)));
                          const slotBase = new Date(slot.day); slotBase.setHours(0, 0, 0, 0);
                          const totalHalfDays = (slot.period === 'PM' ? 1 : 0) + colOffset;
                          const hoverDate = new Date(slotBase);
                          hoverDate.setDate(hoverDate.getDate() + Math.floor(totalHalfDays / 2));
                          const hoverPeriod = totalHalfDays % 2 === 0 ? 'AM' : 'PM';
                          if (pendingBlockDragRef.current) {
                            handleSlotMouseEnter(vehicle, hoverDate, hoverPeriod);
                          } else {
                            handleBlockDragMove(vehicle, hoverDate, hoverPeriod);
                          }
                        }}
                        data-day-index={dayIndex}
                        data-reservation-id={block.id}
                      >
                        <div
                          className={`reservation ${isBeingResized ? 'resizing' : ''} ${isBeingDragged ? 'block-drag-ghost' : ''} ${highlightedReservationIds.includes(block.id) ? 'highlighted' : ''} ${block.isMaintenance ? `maintenance-block maintenance-status-${block.maintenanceStatus || 'scheduled'} ${getMaintenanceConflicts(block).length > 0 ? 'maintenance-conflict' : ''}` : ''}`} onMouseEnter={(e) => handleTooltipShow(e, block)} onMouseLeave={handleTooltipHide}
                          style={{
                            backgroundColor: block.isMaintenance ? undefined : (vehicle.displayColor || vehicle.color || '#3b82f6') + '40',
                            border: block.isMaintenance ? undefined : `2px solid ${vehicle.displayColor || vehicle.color || '#3b82f6'}`,
                            color: '#1f2937', position: 'relative',
                          }}
                        >
                          {/* Pastille utilisateur créateur */}
                          {block.createdBy && (
                            <div className="user-badge" title={`Créé par ${currentUser && block.createdBy === currentUser.id ? currentUser.name : users.find(u => u.id === block.createdBy)?. name || "Utilisateur " + block.createdBy}`}>
                              {getUserInitials(block.createdBy, currentUser, users)}
                            </div>
                          )}
                          
                          
                          <div className="reservation-content-wrapper">
                            <div className="reservation-content">
                              <div className="reservation-name">
                                {block.isMaintenance && getMaintenanceStatusStyle(block.maintenanceStatus, getMaintenanceConflicts(block).length > 0).icon + ' '}
                                {block.clientName || block.prestationName}
                              </div>
                              {block.locationName && <div className="reservation-location">{block.locationName}</div>}
                              {renderReservationAffaires(block, googleEvents, timeSlots, block.startIndex, calendarTripCache[block.id], (eventIds, mode) => handleOpenTripFromCalendar(block, eventIds, mode), () => handleTripLinked(block.id))}
                            </div>
                          </div>
                          {!block.isMaintenance && onDeleteReservation && (
                            <button
                              className="reservation-delete-btn"
                              title="Supprimer cette réservation"
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (window.confirm('Supprimer cette réservation ?')) onDeleteReservation(block.id); }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          
                        </div>
                      {view !== 'year' && !isBeingResized && (
                            <>
                              <div
                                className="resize-handle resize-handle-start"
                                onMouseDown={(e) => handleResizeStart(e, block, 'start')}
                                title="Glisser pour modifier le début"
                              />
                              <div
                                className="resize-handle resize-handle-end"
                                onMouseDown={(e) => handleResizeStart(e, block, 'end')}
                                title="Glisser pour modifier la fin"
                              />
                            </>
                          )}
                      </div>
                    );
                  }
                  
                  const dayIndex = days.findIndex(d => isSameDay(d, slot.day));
                  const isFirstOfDay = slot.period === 'AM';
                  const isLastOfDay = slot.period === 'PM';
                  const isSelected = isInDragSelection(vehicle.id, slot.day, slot.period);
                  const isInPreview = isInResizePreview(vehicle.id, slot.day, slot.period);
                  const isInMovePreview = isInBlockDragPreview(vehicle.id, slot.day, slot.period);
                  
                  return (
                    <div
                      key={`${vehicle.id}-${slotIndex}`}
                      className={`time-slot period-${slot.period.toLowerCase()} ${isWeekend(slot.day) ? 'weekend-slot' : ''} ${isToday(slot.day) ? 'today-slot' : ''} ${isToday(slot.day) && isFirstOfDay ? 'today-left' : ''} ${isToday(slot.day) && isLastOfDay ? 'today-right' : ''} ${isSelected ? 'drag-selected' : ''} ${isInPreview ? 'resize-preview' : ''} ${isInMovePreview ? `block-drag-preview${blockDragPreview?.hasConflict ? ' drag-conflict' : ''}` : ''}`}
                      onMouseDown={(e) => !resizeState && handleSlotMouseDown(vehicle, slot.day, slot.period, e)}
                      onMouseEnter={() => !resizeState && handleSlotMouseEnter(vehicle, slot.day, slot.period)}
                      onMouseUp={handleSlotMouseUp}
                      onClick={() => handleSlotClick(vehicle, slot.day, slot.period)}
                      data-day-index={dayIndex}
                    />
                  );
                })}
              </div>
            );
          })}
              
              {/* En-tête de section Location - ligne pleine largeur */}
              {vehicleGroups.locationVehicles.length > 0 && (
                <div 
                  className="vehicle-section-separator" 
                  style={{ gridColumn: '1 / -1' }}
                >
                  <span>Véhicules de location</span>
                  <span className="vehicle-availability-badge location" title="Véhicules de location disponibles aujourd'hui">
                    {availabilityCount.location.available}/{availabilityCount.location.total}
                  </span>
                  <button 
                    className="section-toggle-button"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, location: !prev.location }))}
                  >
                    {collapsedSections.location ? '▼' : '▲'}
                  </button>
                </div>
              )}
              
              {/* Lignes véhicules - Section Location */}
              {!collapsedSections.location && vehicleGroups.locationVehicles.map((vehicle) => {
            // Créer un tableau de toutes les demi-journées (ou mois pour vue année)
            const timeSlots = [];
            if (view === 'year') {
              // Vue année : une slot par mois
              days.forEach(monthDate => {
                timeSlots.push({ day: monthDate, period: 'M' });
              });
            } else {
              // Vue semaine/mois : AM/PM par jour
              days.forEach(day => {
                periods.forEach(period => {
                  timeSlots.push({ day, period });
                });
              });
            }

            // Trouver les blocs de réservations consécutives
            const blocks = [];
            let currentBlock = null;

            if (view === 'year') {
              // Vue année : afficher les mois occupés
              timeSlots.forEach((slot, index) => {
                const monthStart = startOfMonth(slot.day);
                const monthEnd = endOfMonth(slot.day);
                
                // Vérifier s'il y a des réservations dans ce mois
                const hasReservation = reservations.some(r => {
                  const rDate = new Date(r.date);
                  return r.vehicleId === vehicle.id && rDate >= monthStart && rDate <= monthEnd;
                });

                if (hasReservation) {
                  if (!currentBlock) {
                    currentBlock = {
                      clientName: 'Occupé',
                      startIndex: index,
                      span: 1
                    };
                  } else {
                    currentBlock.span++;
                  }
                } else {
                  if (currentBlock) {
                    blocks.push(currentBlock);
                    currentBlock = null;
                  }
                }
              });
              if (currentBlock) blocks.push(currentBlock);
            } else {
              // Vue semaine/mois : logique AM/PM habituelle
              timeSlots.forEach((slot, index) => {
                const reservation = getReservation(vehicle.id, slot.day, slot.period);
                
                if (reservation) {
                  // Pour les maintenances, utiliser prestationName au lieu de clientName pour la comparaison
                  const currentName = currentBlock ? (currentBlock.isMaintenance ? currentBlock.prestationName : currentBlock.clientName) : null;
                  const newName = reservation.isMaintenance ? reservation.prestationName : reservation.clientName;
                  
                  if (!currentBlock || currentBlock.id !== reservation.id || currentName !== newName || currentBlock.isMaintenance !== reservation.isMaintenance) {
                    if (currentBlock) blocks.push(currentBlock);
                    currentBlock = {
                      ...reservation,
                      startIndex: index,
                      span: 1
                    };
                  } else {
                    currentBlock.span++;
                  }
                } else {
                  if (currentBlock) {
                    blocks.push(currentBlock);
                    currentBlock = null;
                  }
                }
              });
              if (currentBlock) blocks.push(currentBlock);
            }

            return (
              <div key={vehicle.id} className="vehicle-row">
                {timeSlots.map((slot, slotIndex) => {
                  const block = blocks.find(b => b.startIndex === slotIndex);
                  const isInBlock = blocks.some(b => slotIndex > b.startIndex && slotIndex < b.startIndex + b.span);
                  
                  // Vérifier si cette cellule fait partie de la prévisualisation
                  const cellInPreview = isInResizePreview(vehicle.id, slot.day, slot.period);
                  
                  // Vérifier si cette cellule est dans un bloc en cours de redimensionnement
                  const inResizingBlock = blocks.some(b => {
                    const isResizing = resizeState && resizeState.reservation.id === b.id;
                    return isResizing && slotIndex >= b.startIndex && slotIndex < b.startIndex + b.span;
                  });
                  
                  // Si dans un bloc en cours de redimensionnement, afficher comme cellule normale
                  if (inResizingBlock) {
                    const dayIndex = days.findIndex(d => isSameDay(d, slot.day));
                    const isFirstOfDay = slot.period === 'AM';
                    const isLastOfDay = slot.period === 'PM';
                    const isSelected = isInDragSelection(vehicle.id, slot.day, slot.period);
                    const isInPreview = isInResizePreview(vehicle.id, slot.day, slot.period);
                    
                    return (
                      <div
                        key={`${vehicle.id}-${slotIndex}`}
                        className={`time-slot period-${slot.period.toLowerCase()} ${isWeekend(slot.day) ? 'weekend-slot' : ''} ${isToday(slot.day) ? 'today-slot' : ''} ${isToday(slot.day) && isFirstOfDay ? 'today-left' : ''} ${isToday(slot.day) && isLastOfDay ? 'today-right' : ''} ${isSelected ? 'drag-selected' : ''} ${isInPreview ? 'resize-preview' : ''}`}
                        data-day-index={dayIndex}
                      />
                    );
                  }
                  
                  // Ne pas rendre les cellules dans un bloc (comportement normal)
                  if (isInBlock) return null;
                  
                  if (block) {
                    const dayIndex = days.findIndex(d => isSameDay(d, slot.day));
                    const isFirstOfDay = slot.period === 'AM';
                    const isLastOfDay = slot.period === 'PM' && block.span === 1;
                    const isBeingResized = resizeState && resizeState.reservation.id === block.id;
                    const isBeingDragged = blockDragState && blockDragState.block.id === block.id;
                        // Calculer les slots couverts par ce bloc pour les tournées
                    
                    // Si on redimensionne ce bloc, ne pas l'afficher (on affiche uniquement la prévisualisation)
                    if (isBeingResized) return null;
                    
                    return (
                      <div
                        key={`${vehicle.id}-${slotIndex}`}
                        className={`time-slot reserved period-${slot.period.toLowerCase()} ${isWeekend(slot.day) ? 'weekend-slot' : ''} ${isToday(slot.day) ? 'today-slot' : ''} ${isToday(slot.day) && isFirstOfDay ? 'today-left' : ''} ${isToday(slot.day) && isLastOfDay ? 'today-right' : ''}`}
                        style={{ 
                          gridColumn: `span ${block.span}`, position: 'relative',
                          cursor: block.isMaintenance ? 'pointer' : (currentUser?.isAdmin ? 'grab' : 'pointer')
                        }}
                        onMouseDown={(e) => {
                          if (e.target.closest('.tournee-link-btn, .tournee-trip-btn, .reservation-trip-btn, .resize-handle')) return;
                          if (e.button === 2) return;
                          if (block.isMaintenance) {
                            e.preventDefault();
                            if (onMaintenanceClick) {
                              const maintenanceId = block.maintenanceId || block.id.replace('maint-', '');
                              onMaintenanceClick(vehicle, maintenanceId);
                            }
                            return;
                          }
                          handleBlockMouseDown(e, block, vehicle);
                        }}
                        onMouseMove={(e) => {
                          if (!blockDragState && !pendingBlockDragRef.current) return;
                          if ((blockDragState && blockDragState.vehicle.id !== vehicle.id) ||
                              (pendingBlockDragRef.current && pendingBlockDragRef.current.vehicle.id !== vehicle.id)) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relX = e.clientX - rect.left;
                          const colWidth = rect.width / block.span;
                          const colOffset = Math.max(0, Math.min(block.span - 1, Math.floor(relX / colWidth)));
                          const slotBase = new Date(slot.day); slotBase.setHours(0, 0, 0, 0);
                          const totalHalfDays = (slot.period === 'PM' ? 1 : 0) + colOffset;
                          const hoverDate = new Date(slotBase);
                          hoverDate.setDate(hoverDate.getDate() + Math.floor(totalHalfDays / 2));
                          const hoverPeriod = totalHalfDays % 2 === 0 ? 'AM' : 'PM';
                          if (pendingBlockDragRef.current) {
                            handleSlotMouseEnter(vehicle, hoverDate, hoverPeriod);
                          } else {
                            handleBlockDragMove(vehicle, hoverDate, hoverPeriod);
                          }
                        }}
                        data-day-index={dayIndex}
                        data-reservation-id={block.id}
                      >
                        <div
                          className={`reservation ${isBeingResized ? 'resizing' : ''} ${isBeingDragged ? 'block-drag-ghost' : ''} ${highlightedReservationIds.includes(block.id) ? 'highlighted' : ''} ${block.isMaintenance ? `maintenance-block maintenance-status-${block.maintenanceStatus || 'scheduled'} ${getMaintenanceConflicts(block).length > 0 ? 'maintenance-conflict' : ''}` : ''}`} onMouseEnter={(e) => handleTooltipShow(e, block)} onMouseLeave={handleTooltipHide}
                          style={{
                            backgroundColor: block.isMaintenance ? undefined : (vehicle.displayColor || vehicle.color || '#3b82f6') + '40',
                            border: block.isMaintenance ? undefined : `2px solid ${vehicle.displayColor || vehicle.color || '#3b82f6'}`,
                            color: '#1f2937', position: 'relative',
                          }}
                        >
                          {/* Pastille utilisateur créateur */}
                          {block.createdBy && (
                            <div className="user-badge" title={`Créé par ${currentUser && block.createdBy === currentUser.id ? currentUser.name : users.find(u => u.id === block.createdBy)?. name || "Utilisateur " + block.createdBy}`}>
                              {getUserInitials(block.createdBy, currentUser, users)}
                            </div>
                          )}
                          
                          
                          <div className="reservation-content-wrapper">
                            <div className="reservation-content">
                              <div className="reservation-name">
                                {block.isMaintenance && getMaintenanceStatusStyle(block.maintenanceStatus, getMaintenanceConflicts(block).length > 0).icon + ' '}
                                {block.clientName || block.prestationName}
                              </div>
                              {block.locationName && <div className="reservation-location">{block.locationName}</div>}
                              {renderReservationAffaires(block, googleEvents, timeSlots, block.startIndex, calendarTripCache[block.id], (eventIds, mode) => handleOpenTripFromCalendar(block, eventIds, mode), () => handleTripLinked(block.id))}
                            </div>
                          </div>
                          {!block.isMaintenance && onDeleteReservation && (
                            <button
                              className="reservation-delete-btn"
                              title="Supprimer cette réservation"
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (window.confirm('Supprimer cette réservation ?')) onDeleteReservation(block.id); }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          
                        </div>
                      {view !== 'year' && !isBeingResized && (
                            <>
                              <div
                                className="resize-handle resize-handle-start"
                                onMouseDown={(e) => handleResizeStart(e, block, 'start')}
                                title="Glisser pour modifier le début"
                              />
                              <div
                                className="resize-handle resize-handle-end"
                                onMouseDown={(e) => handleResizeStart(e, block, 'end')}
                                title="Glisser pour modifier la fin"
                              />
                            </>
                          )}
                      </div>
                    );
                  }
                  
                  const dayIndex = days.findIndex(d => isSameDay(d, slot.day));
                  const isFirstOfDay = slot.period === 'AM';
                  const isLastOfDay = slot.period === 'PM';
                  const isSelected = isInDragSelection(vehicle.id, slot.day, slot.period);
                  const isInPreview = isInResizePreview(vehicle.id, slot.day, slot.period);
                  const isInMovePreview = isInBlockDragPreview(vehicle.id, slot.day, slot.period);
                  
                  return (
                    <div
                      key={`${vehicle.id}-${slotIndex}`}
                      className={`time-slot period-${slot.period.toLowerCase()} ${isWeekend(slot.day) ? 'weekend-slot' : ''} ${isToday(slot.day) ? 'today-slot' : ''} ${isToday(slot.day) && isFirstOfDay ? 'today-left' : ''} ${isToday(slot.day) && isLastOfDay ? 'today-right' : ''} ${isSelected ? 'drag-selected' : ''} ${isInPreview ? 'resize-preview' : ''} ${isInMovePreview ? `block-drag-preview${blockDragPreview?.hasConflict ? ' drag-conflict' : ''}` : ''}`}
                      onMouseDown={(e) => !resizeState && handleSlotMouseDown(vehicle, slot.day, slot.period, e)}
                      onMouseEnter={() => !resizeState && handleSlotMouseEnter(vehicle, slot.day, slot.period)}
                      onMouseUp={handleSlotMouseUp}
                      onClick={() => handleSlotClick(vehicle, slot.day, slot.period)}
                      data-day-index={dayIndex}
                    />
                  );
                })}
              </div>
            );
          })}
            </div>
          </div>
                          
        </div>
      </div>
                          

      {(selectedSlot || selectedReservation) && (
        <ReservationModal
          slot={selectedSlot}
          reservation={selectedReservation}
          vehicles={vehicles}
          clients={clients}
          drivers={drivers}
          persons={persons}
          locations={locations}
          onSave={handleSaveReservation}
          onDelete={handleDeleteReservation}
          onClose={closeModal}
          googleEvent={selectedSlot?.googleEvent || googleEvent}
          googleEvents={googleEvents}
          onRequestViewEvent={onRequestViewEvent}
          currentUser={currentUser}
        />
      )}

      {/* TripDetailsModal ouvert depuis le calendrier */}
      {calendarTripModal && !calendarTripModal.combinedEvents && (
        <TripDetailsModal
          event={calendarTripModal.event}
          tripDetail={calendarTripModal.tripDetail}
          onSave={handleSaveTripFromCalendar}
          onClose={() => setCalendarTripModal(null)}
          drivers={drivers}
          persons={persons}
          vehicle={calendarTripModal.vehicle}
          nextEvent={null}
          googleMapsApiKey={calendarGoogleMapsApiKey}
          companyAddress={calendarCompanyAddress}
          initialLocations={locations}
        />
      )}

      {calendarTripModal && calendarTripModal.combinedEvents && (
        <TripDetailsModal
          event={calendarTripModal.combinedEvents[0].event}
          tripDetail={calendarTripModal.combinedEvents[0].tripDetail}
          onSave={handleSaveTripFromCalendar}
          onClose={() => setCalendarTripModal(null)}
          drivers={drivers}
          persons={persons}
          vehicle={calendarTripModal.vehicle}
          nextEvent={calendarTripModal.combinedEvents.length > 1 ? calendarTripModal.combinedEvents[1].event : null}
          googleMapsApiKey={calendarGoogleMapsApiKey}
          companyAddress={calendarCompanyAddress}
          initialLocations={locations}
          combinedEvents={calendarTripModal.combinedEvents}
        />
      )}

      {/* Tooltip global */}
      {tooltipState.visible && tooltipState.block && (
        <div
          className="emag-tooltip"
          style={{
            left: `${tooltipState.x}px`,
            top: `${tooltipState.y}px`,
            opacity: 1,
            visibility: 'visible'
          }}
        >
          <div className="tooltip-row">
            <span className="tooltip-label">Type:</span>
            <span className="tooltip-value">{tooltipState.block.isMaintenance ? 'Intervention' : 'Réservation'}</span>
          </div>
          {tooltipState.block.isMaintenance ? (
            <>
              <div className="tooltip-row">
                <span className="tooltip-label">Prestation:</span>
                <span className="tooltip-value">{tooltipState.block.prestationName || 'Non spécifiée'}</span>
              </div>
              <div className="tooltip-row">
                <span className="tooltip-label">Garage:</span>
                <span className="tooltip-value">{tooltipState.block.garageName || 'Non spécifié'}</span>
              </div>
              <div className="tooltip-row">
                <span className="tooltip-label">Début:</span>
                <span className="tooltip-value">{tooltipState.block.start_date || tooltipState.block.startDate || 'Non spécifié'}</span>
              </div>
              <div className="tooltip-row">
                <span className="tooltip-label">Fin:</span>
                <span className="tooltip-value">{tooltipState.block.end_date || tooltipState.block.endDate || 'Non spécifiée'}</span>
              </div>
            </>
          ) : (
            <>
              <div className="tooltip-row">
                <span className="tooltip-label">Client:</span>
                <span className="tooltip-value">{tooltipState.block.clientName || 'Non spécifié'}</span>
              </div>
              <div className="tooltip-row">
                <span className="tooltip-label">Début:</span>
                <span className="tooltip-value">{tooltipState.block.startDate || tooltipState.block.date ? `${new Date(tooltipState.block.startDate || tooltipState.block.date).toLocaleDateString('fr-FR')} ${(tooltipState.block.startPeriod || tooltipState.block.period) === 'AM' ? 'Matin' : 'Après-midi'}` : 'Non spécifié'}</span>
              </div>
              <div className="tooltip-row">
                <span className="tooltip-label">Fin:</span>
                <span className="tooltip-value">{tooltipState.block.endDate || tooltipState.block.date ? `${new Date(tooltipState.block.endDate || tooltipState.block.date).toLocaleDateString('fr-FR')} ${(tooltipState.block.endPeriod || tooltipState.block.period) === 'AM' ? 'Matin' : 'Après-midi'}` : 'Non spécifiée'}</span>
              </div>
            </>
          )}
          {tooltipState.block.description && (
            <div className="tooltip-row">
              <span className="tooltip-label">Description:</span>
              <span className="tooltip-value">{tooltipState.block.description}</span>
            </div>
          )}
          {(() => {
            const driveCount = getDriveLinksCount(tooltipState.block);
            return driveCount > 0 ? (
              <div className="tooltip-row">
                <span className="tooltip-label"><Link size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Drive:</span>
                <span className="tooltip-value">{driveCount} lien{driveCount > 1 ? 's' : ''}</span>
              </div>
            ) : null;
          })()}
          <div className="tooltip-row">
            <span className="tooltip-label">Créé par:</span>
            <span className="tooltip-value">
              {currentUser && tooltipState.block.createdBy === currentUser.id 
                ? currentUser.name 
                : users.find(u => u.id === tooltipState.block.createdBy)?.name || `Utilisateur ${tooltipState.block.createdBy}`}
            </span>
          </div>
        </div>
      )}

      {/* Sélecteurs de dates */}
      {showMonthSelector && (
        <MonthSelector
          currentDate={currentDate}
          onSelectMonth={(date) => { setCurrentDate(date); setShowMonthSelector(false); }}
          onClose={() => setShowMonthSelector(false)}
        />
      )}
      {showWeekSelector && (
        <WeekSelector
          currentDate={currentDate}
          onSelectWeek={(date) => { setCurrentDate(date); setShowWeekSelector(false); }}
          onClose={() => setShowWeekSelector(false)}
        />
      )}
      {showYearSelector && (
        <YearSelector
          currentDate={currentDate}
          onSelectYear={(date) => { setCurrentDate(date); setShowYearSelector(false); }}
          onClose={() => setShowYearSelector(false)}
        />
      )}
    </div>
  );
};

export default Calendar;
