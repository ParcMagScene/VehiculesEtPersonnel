import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Truck } from 'lucide-react';
import { getPeriodTimestamp, formatLocalDate, capitalizeText } from '../utils/dateUtils';
import { hasExpiredTechnicalControl, getExpiredTechnicalControls } from '../utils/vehicleUtils';
import ReservationModal from './ReservationModal';
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
    <div className="reservation-tooltip">
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
            <span className="tooltip-label">Date:</span>
            <span className="tooltip-value">{new Date(block.date).toLocaleDateString('fr-FR')}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Période:</span>
            <span className="tooltip-value">{block.period === 'AM' ? 'Matin' : 'Après-midi'}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Départ:</span>
            <span className="tooltip-value">{block.locationName || 'Non spécifié'}</span>
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

// Helper pour afficher les affaires d'une réservation alignées avec leur position
const renderReservationAffaires = (block, googleEvents, timeSlots, blockStartIndex) => {
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
        console.log('Invalid event dates');
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
          console.log(`  Timed check (${slot.period}): ${touches}`);
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
          startSlot: firstSlotIdx,
          span: lastSlotIdx - firstSlotIdx + 1,
          affaire: event.affaire,
          title: cleanTitle
        };
        eventBlocks.push(eventBlock);
      }
    });
    
    if (eventBlocks.length > 0) {
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
          pointerEvents: 'none',
          zIndex: 10
        }}>
          {eventBlocks.map((eventBlock, idx) => (
            <span key={idx} style={{ 
              fontSize: '0.55rem',
              background: '#eef2ff',
              padding: '0.1rem 0.2rem',
              borderRadius: '0.2rem',
              color: '#6366f1',
              fontWeight: '600',
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              gridColumn: `${eventBlock.startSlot + 1} / span ${eventBlock.span}`,
              height: '1rem',
              lineHeight: '0.8rem'
            }}>
              {eventBlock.affaire || eventBlock.title}
            </span>
          ))}
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
  
  if (affaires.length > 0) {
    return (
      <div className="reservation-affaire">
        {affaires[0]}
        {affaires.length > 1 && <span className="affaire-plus"> +{affaires.length - 1}</span>}
      </div>
    );
  }
  return null;
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
  onDeleteReservation,
  clients,
  drivers,
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
  onRequestViewEvent,
  currentUser,
}) => {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [dragState, setDragState] = useState(null); // { vehicle, startDay, startPeriod, endDay, endPeriod }
  const [isDragging, setIsDragging] = useState(false);
  const [resizeState, setResizeState] = useState(null); // { reservation, edge: 'start' | 'end', currentDay, currentPeriod }
  const [resizePreview, setResizePreview] = useState(null); // { vehicleId, startDate, startPeriod, endDate, endPeriod }
  const [collapsedSections, setCollapsedSections] = useState({ magScene: false, location: false });
  
  // État pour le tooltip global
  const [tooltipState, setTooltipState] = useState({ visible: false, block: null, x: 0, y: 0 });

  // Ouvrir le modal automatiquement quand un événement Google est sélectionné
  useEffect(() => {
    if (googleEvent) {
      setSelectedSlot({ googleEvent });
    }
  }, [googleEvent]);

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

  // Gérer le mouseup global pour le drag-and-drop et resize
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleSlotMouseUp();
      }
      if (resizeState) {
        handleResizeEnd();
      }
    };
    
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, dragState, resizeState]);

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
        // Afficher toutes les maintenances SAUF les pannes signalées (reported)
        // Inclut: 'scheduled', 'in_progress', 'completed', 'pending'
        const isValid = m.status !== 'reported' && m.startDate && m.endDate;
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
    // Ne pas faire de drag si c'est la vue année
    if (view === 'year') return;
    
    // Vérifier si une réservation existe déjà
    const existing = reservations.find(
      (r) =>
        r.vehicleId === vehicle.id &&
        isSameDay(new Date(r.date), date) &&
        r.period === period
    );

    // Si une réservation existe, l'ouvrir directement
    if (existing) {
      setSelectedReservation(existing);
      return;
    }

    // Sinon, commencer le drag
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

  const gridColumns = useMemo(() => {
    return view === 'year' 
      ? `repeat(12, minmax(150px, 1fr))`
      : `repeat(${days.length * 2}, minmax(50px, 1fr))`;
  }, [view, days.length]);

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
      <div className="calendar">
        {/* Ligne des headers - fixe, non scrollable */}
        <div className="calendar-headers-row">
          <div className="vehicle-column-header">
            <span>Véhicules Mag Scène</span>
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
                        <div className="photo-placeholder">
                          <Truck size={20} color="#9ca3af" />
                        </div>
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
                        <div className="photo-placeholder">
                          <Truck size={20} color="#9ca3af" />
                        </div>
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
                  
                  if (!currentBlock || currentName !== newName || currentBlock.isMaintenance !== reservation.isMaintenance) {
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
                        // Calculer les slots couverts par ce bloc pour les tournées
                    
                    // Si on redimensionne ce bloc, ne pas l'afficher (on affiche uniquement la prévisualisation)
                    if (isBeingResized) return null;
                    
                    return (
                      <div
                        key={`${vehicle.id}-${slotIndex}`}
                        className={`time-slot reserved period-${slot.period.toLowerCase()} ${isWeekend(slot.day) ? 'weekend-slot' : ''} ${isToday(slot.day) ? 'today-slot' : ''} ${isToday(slot.day) && isFirstOfDay ? 'today-left' : ''} ${isToday(slot.day) && isLastOfDay ? 'today-right' : ''}`}
                        style={{ 
                          gridColumn: `span ${block.span}`, position: 'relative',
                          cursor: block.isMaintenance ? 'pointer' : 'default'
                        }}
                        onMouseDown={(e) => {
                          // Ignorer le clic droit
                          if (e.button === 2) return;
                          
                          if (block.isMaintenance) {
                            e.preventDefault();
                            if (onVehicleClick) {
                              const maintenanceId = block.maintenanceId || block.id.replace('maint-', '');
                              onVehicleClick(vehicle, maintenanceId);
                            }
                            return;
                          }
                          e.preventDefault();
                          const existing = reservations.find(r => r.id === block.id);
                          if (existing) setSelectedReservation(existing);
                        }}
                        data-day-index={dayIndex}
                        data-reservation-id={block.id}
                      >
                        <div
                          className={`reservation ${isBeingResized ? 'resizing' : ''} ${highlightedReservationIds.includes(block.id) ? 'highlighted' : ''} ${block.isMaintenance ? 'maintenance-block' : ''}`} onMouseEnter={(e) => handleTooltipShow(e, block)} onMouseLeave={handleTooltipHide}
                          style={{
                            backgroundColor: block.isMaintenance 
                              ? (getMaintenanceConflicts(block).length > 0 ? '#fee2e2' : '#f3f4f6')
                              : (vehicle.displayColor || vehicle.color || '#3b82f6') + '40',
                            border: block.isMaintenance
                              ? (getMaintenanceConflicts(block).length > 0 ? '2px solid #dc2626' : '2px dashed #6b7280')
                              : `2px solid ${vehicle.displayColor || vehicle.color || '#3b82f6'}`,
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
                                {block.isMaintenance && getMaintenanceConflicts(block).length > 0 && '⚠️ '}
                                {block.clientName || block.prestationName}
                              </div>
                              {block.locationName && <div className="reservation-location">{block.locationName}</div>}
                              {renderReservationAffaires(block, googleEvents, timeSlots, block.startIndex)}
                            </div>
                          </div>
                          
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
                  
                  return (
                    <div
                      key={`${vehicle.id}-${slotIndex}`}
                      className={`time-slot period-${slot.period.toLowerCase()} ${isWeekend(slot.day) ? 'weekend-slot' : ''} ${isToday(slot.day) ? 'today-slot' : ''} ${isToday(slot.day) && isFirstOfDay ? 'today-left' : ''} ${isToday(slot.day) && isLastOfDay ? 'today-right' : ''} ${isSelected ? 'drag-selected' : ''} ${isInPreview ? 'resize-preview' : ''}`}
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
                  
                  if (!currentBlock || currentName !== newName || currentBlock.isMaintenance !== reservation.isMaintenance) {
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
                        // Calculer les slots couverts par ce bloc pour les tournées
                    
                    // Si on redimensionne ce bloc, ne pas l'afficher (on affiche uniquement la prévisualisation)
                    if (isBeingResized) return null;
                    
                    return (
                      <div
                        key={`${vehicle.id}-${slotIndex}`}
                        className={`time-slot reserved period-${slot.period.toLowerCase()} ${isWeekend(slot.day) ? 'weekend-slot' : ''} ${isToday(slot.day) ? 'today-slot' : ''} ${isToday(slot.day) && isFirstOfDay ? 'today-left' : ''} ${isToday(slot.day) && isLastOfDay ? 'today-right' : ''}`}
                        style={{ 
                          gridColumn: `span ${block.span}`, position: 'relative',
                          cursor: block.isMaintenance ? 'pointer' : 'default'
                        }}
                        onMouseDown={(e) => {
                          // Ignorer le clic droit
                          if (e.button === 2) return;
                          
                          if (block.isMaintenance) {
                            e.preventDefault();
                            if (onVehicleClick) {
                              const maintenanceId = block.maintenanceId || block.id.replace('maint-', '');
                              onVehicleClick(vehicle, maintenanceId);
                            }
                            return;
                          }
                          e.preventDefault();
                          const existing = reservations.find(r => r.id === block.id);
                          if (existing) setSelectedReservation(existing);
                        }}
                        data-day-index={dayIndex}
                        data-reservation-id={block.id}
                      >
                        <div
                          className={`reservation ${isBeingResized ? 'resizing' : ''} ${highlightedReservationIds.includes(block.id) ? 'highlighted' : ''} ${block.isMaintenance ? 'maintenance-block' : ''}`} onMouseEnter={(e) => handleTooltipShow(e, block)} onMouseLeave={handleTooltipHide}
                          style={{
                            backgroundColor: block.isMaintenance 
                              ? (getMaintenanceConflicts(block).length > 0 ? '#fee2e2' : '#f3f4f6')
                              : (vehicle.displayColor || vehicle.color || '#3b82f6') + '40',
                            border: block.isMaintenance
                              ? (getMaintenanceConflicts(block).length > 0 ? '2px solid #dc2626' : '2px dashed #6b7280')
                              : `2px solid ${vehicle.displayColor || vehicle.color || '#3b82f6'}`,
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
                                {block.isMaintenance && getMaintenanceConflicts(block).length > 0 && '⚠️ '}
                                {block.clientName || block.prestationName}
                              </div>
                              {block.locationName && <div className="reservation-location">{block.locationName}</div>}
                              {renderReservationAffaires(block, googleEvents, timeSlots, block.startIndex)}
                            </div>
                          </div>
                          
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
                  
                  return (
                    <div
                      key={`${vehicle.id}-${slotIndex}`}
                      className={`time-slot period-${slot.period.toLowerCase()} ${isWeekend(slot.day) ? 'weekend-slot' : ''} ${isToday(slot.day) ? 'today-slot' : ''} ${isToday(slot.day) && isFirstOfDay ? 'today-left' : ''} ${isToday(slot.day) && isLastOfDay ? 'today-right' : ''} ${isSelected ? 'drag-selected' : ''} ${isInPreview ? 'resize-preview' : ''}`}
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

      {/* Tooltip global */}
      {tooltipState.visible && tooltipState.block && (
        <div
          className="reservation-tooltip"
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
                <span className="tooltip-label">Date:</span>
                <span className="tooltip-value">{new Date(tooltipState.block.date).toLocaleDateString('fr-FR')}</span>
              </div>
              <div className="tooltip-row">
                <span className="tooltip-label">Période:</span>
                <span className="tooltip-value">{tooltipState.block.period === 'AM' ? 'Matin' : 'Après-midi'}</span>
              </div>
              <div className="tooltip-row">
                <span className="tooltip-label">Départ:</span>
                <span className="tooltip-value">{tooltipState.block.locationName || 'Non spécifié'}</span>
              </div>
            </>
          )}
          {tooltipState.block.description && (
            <div className="tooltip-row">
              <span className="tooltip-label">Description:</span>
              <span className="tooltip-value">{tooltipState.block.description}</span>
            </div>
          )}
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
    </div>
  );
};

export default Calendar;
