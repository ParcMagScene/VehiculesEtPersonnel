import './GoogleCalendarBanner.css';

import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarPlus, Plus } from 'lucide-react';
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { Button, InlineAlert, LoadingOverlay } from '@/design-system';

import { TIMING } from '../../constants';
import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import { useGoogleSync } from '../../hooks/useGoogleSync';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { isApiCoolingDown } from '../../utils/api/base';
import { capitalizeText } from '../../utils/dateUtils';
import EventDetailsModal from '../planning/EventDetailsModal';

// Code splitting - Lazy loading
const AffaireImportModal = lazy(() => import('../affaires/AffaireImportModal'));
const GoogleEventFormModal = lazy(() => import('./GoogleEventFormModal'));

function GoogleCalendarBanner({
  _calendarConfig,
  view,
  currentDate,
  currentUser,
  activeModule,
  onScroll,
  onEventClick,
  onEventsChange,
  clients,
  locations,
  reservations = [],
  onEventHover,
  onRequestEditReservation,
  onRequestViewEvent,
  onReservationsRefresh,
  onNewReservation,
  onNewAssignment,
  onNewAffaire,
  onNavigateToAffaire,
}) {
  const toast = useToast();
  const [error, setError] = useState(null);
  const [googleConfigured, setGoogleConfigured] = useState(null); // null = loading, true/false
  const [googleCanWrite, setGoogleCanWrite] = useState(false);
  const displayMode = 'compact';
  const [bannerHeight, setBannerHeight] = useState(200);
  const [modalOpen, setModalOpen] = useState(false);
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [_clickedCell, setClickedCell] = useState(null);
  const [googleCalendarId, setGoogleCalendarId] = useState(null);

  const [affairesWithAttachments, setAffairesWithAttachments] = useState([]);
  const [attachmentCounts, setAttachmentCounts] = useState({});

  const [eventFormOpen, setEventFormOpen] = useState(false);
  const widthSyncFrameRef = useRef(null);
  const lastWidthSyncAtRef = useRef(0);
  const scrollSyncFrameRef = useRef(null);
  const lastGridColumnsRef = useRef('');
  const [eventFormMode, setEventFormMode] = useState('create'); // 'create' | 'edit'
  const [eventFormEvent, setEventFormEvent] = useState(null);

  // ── Synchronisation intelligente via useGoogleSync ──
  const {
    events: rawEvents,
    loading,
    fetchNow,
    lastSync: _lastSync,
    isLeader: _isLeader,
    fetchError,
  } = useGoogleSync({
    isSignedIn: !!googleConfigured,
    view,
    currentDate,
    calendarId: googleCalendarId,
  });

  const analyzeEventTitle = (event) => {
    const title = event.summary || '';
    const eventLocation = event.location || '';
    const enrichedEvent = { ...event };

    // Détecter le numero d'affaire (formats: "af 32744", "AF 32744", "af32744", "AF32744")
    const affaireMatch = title.match(/\baf\s*(\d+)\b/i);
    if (affaireMatch) {
      enrichedEvent.affaire = `AF${affaireMatch[1]}`;
    }

    const foundClient = clients.find((client) =>
      title.toLowerCase().includes(client.name.toLowerCase()),
    );
    if (foundClient) {
      enrichedEvent.detectedClient = foundClient.name;
    }

    // Détecter un lieu existant dans le titre, le champ location, ou l'adresse
    if (locations && locations.length > 0) {
      const foundLocation = locations.find((location) => {
        const titleMatch = title.toLowerCase().includes(location.name.toLowerCase());
        const locationFieldMatch = eventLocation
          .toLowerCase()
          .includes(location.name.toLowerCase());

        let addressMatch = false;
        if (location.address && eventLocation) {
          const locationParts = eventLocation
            .toLowerCase()
            .split(',')
            .map((part) => part.trim());
          const addressParts = location.address
            .toLowerCase()
            .split(',')
            .map((part) => part.trim());

          addressMatch = addressParts.some((addressPart) =>
            locationParts.some(
              (locationPart) =>
                locationPart.includes(addressPart) || addressPart.includes(locationPart),
            ),
          );
        }

        return titleMatch || locationFieldMatch || addressMatch;
      });

      if (foundLocation) {
        enrichedEvent.detectedLocation = foundLocation.name;
      }
    }

    return enrichedEvent;
  };

  // Événements enrichis avec détection client/lieu/affaire
  const events = useMemo(
    () => rawEvents.map((e) => analyzeEventTitle(e)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawEvents, clients, locations],
  );

  // Charger la configuration Google Service Account
  useEffect(() => {
    const loadGoogleStatus = async () => {
      if (isApiCoolingDown()) return;
      try {
        const [statusData, calendarIdData] = await Promise.all([
          api.getCalendarServiceStatus(),
          api.getGoogleCalendarId(),
        ]);
        setGoogleConfigured(!!statusData?.configured);
        setGoogleCanWrite(!!statusData?.canWrite);
        setGoogleCalendarId(calendarIdData?.value || null);
      } catch (error) {
        // Google non configuré ou inaccessible
        void error;
        setGoogleConfigured(false);
        setGoogleCanWrite(false);
      }
    };
    loadGoogleStatus();
  }, [toast]);

  // Charger l'index des affaires ayant des pièces jointes
  useEffect(() => {
    const loadAttachmentsIndex = async () => {
      if (isApiCoolingDown()) return;
      try {
        const data = await api.getAttachmentsIndex();
        setAffairesWithAttachments(data.affaires || []);
        setAttachmentCounts(data.counts || {});
      } catch (e) {
        // silencieux
      }
    };
    loadAttachmentsIndex();
    // Rafraîchir toutes les 60s
    const interval = setInterval(loadAttachmentsIndex, 60000);
    return () => clearInterval(interval);
  }, []);

  // Notifier le parent quand les événements changent
  useEffect(() => {
    if (onEventsChange) {
      onEventsChange(events);
    }
  }, [events, onEventsChange]);

  // Exposer la fonction pour ouvrir un événement depuis l'extérieur
  useEffect(() => {
    if (onRequestViewEvent) {
      onRequestViewEvent(handleCellClick);
    }
  }, [onRequestViewEvent]);

  // Synchroniser les largeurs avec le calendrier principal (ou le planning personnel)
  useEffect(() => {
    let calendarGridEl = null;
    let bannerGridEl = null;

    const resolveGridEls = () => {
      if (!calendarGridEl || !calendarGridEl.isConnected) {
        // Selectionner explicitement selon le module actif pour eviter de
        // copier la grille du Parc (14 col) sur le banner du Planning (7 col).
        if (activeModule === 'personnel') {
          calendarGridEl = document.querySelector('.pp-grid');
        } else {
          calendarGridEl =
            document.querySelector('.calendar-grid') || document.querySelector('.pp-grid');
        }
      }
      if (!bannerGridEl || !bannerGridEl.isConnected) {
        bannerGridEl = document.querySelector('.banner-grid');
      }
      return { calendarGrid: calendarGridEl, bannerGrid: bannerGridEl };
    };

    const applyWidths = () => {
      const { calendarGrid, bannerGrid } = resolveGridEls();

      if (calendarGrid && bannerGrid) {
        // Copier les colonnes calculees en pixels (toujours, sans cache)
        // pour garantir l'alignement meme si la grille principale change de
        // taille apres le mount (lazy load, fonts, scrollbar, etc).
        const gridComputedStyle = window.getComputedStyle(calendarGrid);
        const gridColumns = gridComputedStyle.gridTemplateColumns;
        if (gridColumns && gridColumns !== bannerGrid.style.gridTemplateColumns) {
          bannerGrid.style.gridTemplateColumns = gridColumns;
        }
      }

      // Synchroniser la largeur de la colonne fixe a gauche
      // Parc: .vehicle-column (250px) | Planning: .pp-column-header (250px)
      const leftCol =
        document.querySelector('.pp-column-header') ||
        document.querySelector('.vehicle-column-header') ||
        document.querySelector('.pp-person-column') ||
        document.querySelector('.vehicle-column');
      const bannerLeftCol = document.querySelector('.banner-vehicle-column');
      if (leftCol && bannerLeftCol) {
        const w = Math.round(leftCol.getBoundingClientRect().width);
        if (w > 0) {
          const px = `${w}px`;
          if (bannerLeftCol.style.width !== px) {
            bannerLeftCol.style.width = px;
            bannerLeftCol.style.minWidth = px;
            bannerLeftCol.style.flexShrink = '0';
          }
        }
      }

      // Compenser le scrollbar-gutter de la grille principale.
      // .calendar-scroll-area utilise scrollbar-gutter:stable qui reserve ~11-16px
      // meme quand la scrollbar n'est pas visible. .banner-scroll-area n'a pas de
      // gutter (overflow-y:hidden), donc son grid s'etale sur toute la largeur.
      // On mesure le delta reel entre le scroll-area et son grid pour le compenser.
      const mainScroll =
        document.querySelector('.pp-scroll-area') ||
        document.querySelector('.calendar-scroll-area');
      const bannerScroll = document.querySelector('.banner-scroll-area');
      if (mainScroll && calendarGrid && bannerScroll) {
        const mainW = mainScroll.getBoundingClientRect().width;
        const gridW = calendarGrid.getBoundingClientRect().width;
        const gutter = Math.max(0, Math.round(mainW - gridW));
        const px = `${gutter}px`;
        if (bannerScroll.style.paddingRight !== px) {
          bannerScroll.style.paddingRight = px;
        }
      }
    };

    const scheduleWidthSync = () => {
      if (document.hidden) return;
      if (widthSyncFrameRef.current) {
        cancelAnimationFrame(widthSyncFrameRef.current);
      }
      widthSyncFrameRef.current = requestAnimationFrame(() => {
        widthSyncFrameRef.current = null;
        applyWidths();
      });
    };

    // Attendre que le DOM soit complètement rendu après changement de vue
    // Reset du cache pour garantir une re-application meme si la valeur calculee
    // n'a pas change (ex: switch Parc <-> Planning au meme nb de colonnes).
    lastGridColumnsRef.current = '';
    scheduleWidthSync();
    // Au mount initial, la grille principale peut ne pas avoir sa taille finale
    // (lazy-load PersonnelPanel/PlanningView, fonts, scrollbar apparait apres).
    // On rejoue la sync plusieurs fois sur ~2.5s pour attraper la stabilisation.
    const retryDelays = [16, 50, 100, 200, 350, 600, 1000, 1500, 2500];
    const retryTimers = retryDelays.map((d) => setTimeout(scheduleWidthSync, d));

    // Observer les changements de taille du calendrier ou du planning personnel
    let { calendarGrid } = resolveGridEls();
    let resizeObserver;
    let mutationObserver;

    const attachResizeObserver = () => {
      if (resizeObserver) resizeObserver.disconnect();
      resizeObserver = new ResizeObserver(scheduleWidthSync);
      const grid = resolveGridEls().calendarGrid;
      if (grid) resizeObserver.observe(grid);
      const leftCol =
        document.querySelector('.pp-column-header') ||
        document.querySelector('.vehicle-column-header') ||
        document.querySelector('.pp-person-column') ||
        document.querySelector('.vehicle-column');
      if (leftCol) resizeObserver.observe(leftCol);
      const mainScroll =
        document.querySelector('.pp-scroll-area') ||
        document.querySelector('.calendar-scroll-area');
      if (mainScroll) resizeObserver.observe(mainScroll);
    };

    if (calendarGrid) {
      attachResizeObserver();
    } else {
      // Si la grille n'est pas encore montee (lazy load), observer le DOM
      // jusqu'a son apparition pour attacher le ResizeObserver et resync.
      mutationObserver = new MutationObserver(() => {
        const grid =
          activeModule === 'personnel'
            ? document.querySelector('.pp-grid')
            : document.querySelector('.calendar-grid') || document.querySelector('.pp-grid');
        if (grid) {
          calendarGrid = grid;
          attachResizeObserver();
          scheduleWidthSync();
          mutationObserver.disconnect();
          mutationObserver = null;
        }
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    // Synchroniser lors du resize de la fenêtre
    window.addEventListener('resize', scheduleWidthSync);

    return () => {
      retryTimers.forEach(clearTimeout);
      if (widthSyncFrameRef.current) {
        cancelAnimationFrame(widthSyncFrameRef.current);
        widthSyncFrameRef.current = null;
      }
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
      window.removeEventListener('resize', scheduleWidthSync);
    };
  }, [view, currentDate, activeModule]);

  // Synchroniser le scroll entre le calendrier et le banner
  useEffect(() => {
    let cleanupFn = null;
    let retryTimer = null;
    let sourceRef = null;

    const attachScrollListeners = () => {
      // Chercher la zone de scroll principale : Calendar ou PersonnelPanel
      const calendarScrollArea =
        document.querySelector('.calendar-scroll-area') ||
        document.querySelector('.pp-scroll-area');
      const bannerScrollArea = document.querySelector('.banner-scroll-area');

      if (!calendarScrollArea || !bannerScrollArea) {
        retryTimer = setTimeout(attachScrollListeners, 80);
        return;
      }

      const scheduleScrollSync = () => {
        if (document.hidden) return;
        if (scrollSyncFrameRef.current) return;
        scrollSyncFrameRef.current = requestAnimationFrame(() => {
          scrollSyncFrameRef.current = null;
          if (sourceRef === 'calendar') {
            const nextLeft = calendarScrollArea.scrollLeft;
            if (bannerScrollArea.scrollLeft !== nextLeft) {
              bannerScrollArea.scrollLeft = nextLeft;
            }
            return;
          }
          if (sourceRef === 'banner') {
            const nextLeft = bannerScrollArea.scrollLeft;
            if (calendarScrollArea.scrollLeft !== nextLeft) {
              calendarScrollArea.scrollLeft = nextLeft;
            }
          }
        });
      };

      const handleCalendarScroll = () => {
        sourceRef = 'calendar';
        scheduleScrollSync();
      };

      const handleBannerScroll = () => {
        sourceRef = 'banner';
        scheduleScrollSync();
      };

      calendarScrollArea.addEventListener('scroll', handleCalendarScroll, { passive: true });
      bannerScrollArea.addEventListener('scroll', handleBannerScroll, { passive: true });

      // Aligner immédiatement après l'attache (sans attendre un scroll utilisateur)
      sourceRef = 'calendar';
      scheduleScrollSync();

      cleanupFn = () => {
        calendarScrollArea.removeEventListener('scroll', handleCalendarScroll);
        bannerScrollArea.removeEventListener('scroll', handleBannerScroll);
      };
    };

    const timer = setTimeout(attachScrollListeners, 100);

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      clearTimeout(timer);
      if (scrollSyncFrameRef.current) {
        cancelAnimationFrame(scrollSyncFrameRef.current);
        scrollSyncFrameRef.current = null;
      }
      if (cleanupFn) cleanupFn();
    };
  }, [view]);

  // Centrer sur la date actuelle quand elle change (synchroniser avec le calendrier principal ou personnel)
  useEffect(() => {
    if (view === 'month' || view === 'year') {
      const timeouts = [];

      const syncScroll = () => {
        const calendarScrollArea =
          document.querySelector('.calendar-scroll-area') ||
          document.querySelector('.pp-scroll-area');
        const bannerScrollArea = document.querySelector('.banner-scroll-area');

        if (calendarScrollArea && bannerScrollArea) {
          bannerScrollArea.scrollLeft = calendarScrollArea.scrollLeft;
        }
      };

      // Synchroniser plusieurs fois pour s'assurer que c'est bien aligné
      timeouts.push(setTimeout(syncScroll, 60));
      timeouts.push(setTimeout(syncScroll, 160));
      timeouts.push(setTimeout(syncScroll, 310));
      timeouts.push(setTimeout(syncScroll, TIMING.PRINT_DELAY));

      return () => {
        timeouts.forEach((timeout) => clearTimeout(timeout));
      };
    }
  }, [view, currentDate]);

  const handleScroll = (e) => {
    if (onScroll) {
      onScroll(e.target.scrollLeft);
    }
  };

  // Ouvrir le modal de détails d'événement
  const handleCellClick = (event = null) => {
    setSelectedEvent(event);
    setEventDetailsOpen(true);
  };

  const handleCloseEventDetails = () => {
    setEventDetailsOpen(false);
    setSelectedEvent(null);
  };

  // Ouvrir l'ancien modal d'import d'affaire depuis le modal de détails
  const handleOpenAffaireImport = (event) => {
    setEventDetailsOpen(false);
    setSelectedEvent(event);
    setModalOpen(true);
  };

  // Ouvrir le modal de création de réservation classique
  const handleCreateReservationFromEvent = (event) => {
    // Fermer le modal de détails et notifier le parent pour ouvrir ReservationModal
    setEventDetailsOpen(false);
    if (onEventClick) {
      onEventClick(event);
    }
  };

  // Ouvrir le dialog d'affectation personnel depuis le modal de détails
  const handleCreateAssignmentFromEvent = (event) => {
    setEventDetailsOpen(false);
    if (onNewAssignment) {
      onNewAssignment(event);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedEvent(null);
    setClickedCell(null);
  };

  // --- Event form (create / edit / delete) ---
  const handleOpenNewEvent = () => {
    setEventFormMode('create');
    setEventFormEvent(null);
    setEventFormOpen(true);
  };

  const handleRequestEditEvent = (event) => {
    setEventDetailsOpen(false);
    setEventFormMode('edit');
    setEventFormEvent(event);
    setEventFormOpen(true);
  };

  const handleSaveEventForm = async (eventData) => {
    if (eventFormMode === 'edit' && eventFormEvent?.id) {
      await handleEventUpdated(eventFormEvent.id, eventData);
    } else {
      await handleEventCreated(eventData);
    }
    setEventFormOpen(false);
    setEventFormEvent(null);
  };

  const handleCloseEventForm = () => {
    setEventFormOpen(false);
    setEventFormEvent(null);
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await api.deleteGoogleEventV2(eventId, googleCalendarId);
      fetchNow();
      setEventDetailsOpen(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Erreur suppression événement:', error);
      toast.error("Erreur lors de la suppression de l'événement: " + error.message);
    }
  };

  const handleEventCreated = async (newEventData) => {
    try {
      const createdEvent = await api.createGoogleEventV2(newEventData, googleCalendarId);
      fetchNow();
      return createdEvent;
    } catch (error) {
      console.error('Erreur création événement:', error);
      toast.error("Erreur lors de la création de l'événement: " + error.message);
      throw error;
    }
  };

  const handleEventUpdated = async (eventId, updates) => {
    try {
      const eventToUpdate = events.find((e) => e.id === eventId);
      if (!eventToUpdate) return;
      await api.updateGoogleEventV2(eventId, updates, googleCalendarId);
      fetchNow();
    } catch (error) {
      console.error('Erreur mise à jour événement:', error);
      toast.error("Erreur lors de la mise à jour de l'événement: " + error.message);
      throw error;
    }
  };

  // Gestion du redimensionnement
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = bannerHeight;

    const handleMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.min(Math.max(startHeight + deltaY, 100), 600);
      setBannerHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // La récupération des événements est gérée par useGoogleSync (timer, IDB, BroadcastChannel)

  // Gérer les erreurs de sync (calendrier introuvable, indisponibilité)
  useEffect(() => {
    if (!fetchError) return;
    const msg = fetchError.message || '';
    setError('Impossible de récupérer les événements: ' + msg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchError]);

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
    } else if (view === 'year') {
      // Utiliser eachMonthOfInterval comme Calendar pour synchroniser la grille
      const months = eachMonthOfInterval({
        start: startOfYear(currentDate),
        end: endOfYear(currentDate),
      });
      // Diagnostic supprimé (Phase D cleanup)
      return months;
    }
    return [];
  }, [view, currentDate]);

  const eventBlocks = useMemo(() => {
    const isPersonnelMode = activeModule === 'personnel';
    const eventBlocks = [];
    const processedEvents = new Set();

    // Pour la vue année, filtrer les événements par année affichée
    const _filteredEvents =
      view === 'year'
        ? events.filter((event) => {
            const eventStart = event.start.dateTime
              ? parseISO(event.start.dateTime)
              : parseISO(event.start.date);
            return eventStart.getFullYear() === currentDate.getFullYear();
          })
        : events;

    // Mapping des colorId Google Calendar vers des couleurs hexadécimales
    const googleColorMap = {
      1: '#a4bdfc', // Lavande
      2: '#7ae7bf', // Sauge
      3: '#dbadff', // Raisin
      4: '#ff887c', // Flamant
      5: '#fbd75b', // Banane
      6: '#ffb878', // Mandarine
      7: '#46d6db', // Paon
      8: '#e1e1e1', // Graphite
      9: '#5484ed', // Bleuet
      10: '#51b749', // Basilic
      11: '#dc2127', // Tomate
    };

    // Couleurs de repli si pas de colorId
    const fallbackColors = [
      STATUS_COLORS.info,
      STATUS_COLORS.success,
      STATUS_COLORS.warning,
      STATUS_COLORS.danger,
      ACCENT_COLORS.violet,
      ACCENT_COLORS.pink,
      '#14b8a6',
      ACCENT_COLORS.orange,
    ];
    let colorIndex = 0;

    events.forEach((event) => {
      if (processedEvents.has(event.id)) return;
      processedEvents.add(event.id);

      const eventStart = event.start.dateTime
        ? parseISO(event.start.dateTime)
        : parseISO(event.start.date);
      const eventEnd = event.end.dateTime ? parseISO(event.end.dateTime) : parseISO(event.end.date);

      // Utiliser la couleur Google si disponible, sinon couleur de repli
      const eventColor =
        event.colorId && googleColorMap[event.colorId]
          ? googleColorMap[event.colorId]
          : fallbackColors[colorIndex++ % fallbackColors.length];

      if (view === 'year') {
        // Vue année : calculer la span en mois
        let startMonthIndex = -1;
        let span = 0;

        const eventStartMonth = eventStart.getFullYear() * 12 + eventStart.getMonth();
        const eventEndMonth = eventEnd.getFullYear() * 12 + eventEnd.getMonth();

        days.forEach((monthDate, monthIndex) => {
          const monthValue = monthDate.getFullYear() * 12 + monthDate.getMonth();

          if (eventStartMonth <= monthValue && eventEndMonth >= monthValue) {
            if (startMonthIndex === -1) {
              startMonthIndex = monthIndex;
            }
            span++;
          }
        });

        if (startMonthIndex !== -1) {
          // Nettoyer le titre en supprimant le numéro d'affaire
          let cleanTitle = event.summary || '(Sans titre)';
          cleanTitle = cleanTitle.replace(/\baf\s*\d+\b/gi, '').trim();
          cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

          eventBlocks.push({
            eventId: event.id,
            summary: cleanTitle,
            color: eventColor,
            location: event.location,
            time: event.start.dateTime ? format(eventStart, 'HH:mm', { locale: fr }) : null,
            affaire: event.affaire,
            startIndex: startMonthIndex,
            span,
            event: event, // Données complètes pour la création de réservation
          });
        }
      } else {
        // Vues semaine/mois : calculer la span en jours (colonnes)
        const slots = [];

        days.forEach((day, dayIndex) => {
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);

          // Vérifier si l'événement touche ce jour
          if (eventStart < dayEnd && eventEnd > dayStart) {
            slots.push(dayIndex);
          }
        });

        if (slots.length > 0) {
          const startIndex = Math.min(...slots);
          const endIndex = Math.max(...slots);
          const span = endIndex - startIndex + 1;

          // Nettoyer le titre en supprimant le numéro d'affaire
          let cleanTitle = event.summary || '(Sans titre)';
          cleanTitle = cleanTitle.replace(/\baf\s*\d+\b/gi, '').trim();
          cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

          eventBlocks.push({
            eventId: event.id,
            summary: cleanTitle,
            color: eventColor,
            location: event.location,
            time: event.start.dateTime ? format(eventStart, 'HH:mm', { locale: fr }) : null,
            affaire: event.affaire,
            startIndex: isPersonnelMode ? startIndex : startIndex * 2,
            span: isPersonnelMode ? span : span * 2,
            event: event, // Données complètes pour la création de réservation
          });
        }
      }
    });

    // Trier les blocs par index de début (chronologique)
    eventBlocks.sort((a, b) => {
      if (a.startIndex !== b.startIndex) {
        return a.startIndex - b.startIndex;
      }
      // Si même index de début, trier par durée (plus long d'abord)
      return b.span - a.span;
    });

    return eventBlocks;
  }, [view, currentDate, events, days, activeModule]);

  // Afficher un message si le module Google n'est pas configuré côté serveur
  if (googleConfigured === false) {
    return (
      <div className="google-calendar-banner auth">
        <div className="banner-content">
          <div className="auth-prompt">
            <h3>📅 Synchronisation Google Calendar</h3>
            <p>⚠️ Configuration manquante</p>
            <p>
              Le module Google Calendar n'est pas configuré sur le serveur (variables
              GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_SERVICE_ACCOUNT_KEY_PATH manquantes)
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!googleConfigured) {
    return (
      <div className="google-calendar-banner auth">
        <div className="banner-content">
          <div className="auth-prompt">
            <h3>📅 Synchronisation Google Calendar</h3>
            <p>Le calendrier n'est pas configuré côté administrateur.</p>
            {error && <InlineAlert>{error}</InlineAlert>}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="google-calendar-banner loading">Chargement des événements...</div>;
  }

  // Ne pas masquer le banner si aucun événement, garder la structure pour la cohérence visuelle
  // if (events.length === 0) {
  //   return null;
  // }

  return (
    <>
      <div className={`google-calendar-banner-grid ${displayMode}`}>
        <div
          className={`calendar-banner${activeModule === 'personnel' ? ' calendar-banner--personnel' : ''}`}
        >
          {/* Colonne véhicules fixe à gauche */}
          <div className="banner-vehicle-column">
            <div className="banner-vehicle-header">
              <div className="banner-header-top">
                {displayMode === 'closed' ? (
                  <span>Évènements</span>
                ) : (
                  <div className="banner-title-stack">
                    <span>Locations</span>
                    <span>Prestations</span>
                    <span>Installations</span>
                  </div>
                )}
              </div>
              {/* Bouton contextuel : Nouvelle réservation / Nouvelle affectation / Nouvelle affaire */}
              <Button
                variant="ghost"
                className="banner-new-action-btn"
                onClick={
                  activeModule === 'affaires'
                    ? onNewAffaire
                    : activeModule === 'personnel'
                      ? onNewAssignment
                      : onNewReservation
                }
                title={
                  activeModule === 'affaires'
                    ? 'Nouvelle affaire'
                    : activeModule === 'personnel'
                      ? 'Nouvelle affectation'
                      : 'Nouvelle réservation'
                }
              >
                <Plus size={14} />
                <span>
                  {activeModule === 'affaires'
                    ? 'Nouvelle affaire'
                    : activeModule === 'personnel'
                      ? 'Nouvelle affectation'
                      : 'Nouvelle réservation'}
                </span>
              </Button>
              {/* Bouton Nouvel événement Google Calendar */}
              {googleCanWrite && currentUser?.isAdmin && (
                <Button
                  variant="ghost"
                  className="banner-new-action-btn banner-new-event-btn"
                  onClick={handleOpenNewEvent}
                  title="Créer un événement Google Calendar"
                >
                  <CalendarPlus size={14} />
                  <span>Nouvel événement</span>
                </Button>
              )}
            </div>
          </div>

          {/* Grille scrollable à droite */}
          <div
            className="banner-scroll-area"
            onScroll={handleScroll}
            style={displayMode === 'compact' ? { height: `${bannerHeight}px` } : undefined}
          >
            <div className={`banner-grid ${view}-view`}>
              {/* Lignes de séparation alignées sur les colonnes */}
              <div className="banner-grid-lines">
                {view === 'week' &&
                  days.flatMap((day, dayIndex) => {
                    const dayIsToday = isToday(day);
                    if (activeModule === 'personnel') {
                      return [
                        <div key={dayIndex} className={`grid-line ${dayIsToday ? 'today' : ''}`} />,
                      ];
                    }
                    return [
                      <div
                        key={`${dayIndex}-am`}
                        className={`grid-line ${dayIsToday ? 'today today-left' : ''}`}
                      />,
                      <div
                        key={`${dayIndex}-pm`}
                        className={`grid-line ${dayIsToday ? 'today today-right' : ''}`}
                      />,
                    ];
                  })}
                {view === 'month' &&
                  days.flatMap((day, dayIndex) => {
                    const dayIsToday = isToday(day);
                    if (activeModule === 'personnel') {
                      return [
                        <div key={dayIndex} className={`grid-line ${dayIsToday ? 'today' : ''}`} />,
                      ];
                    }
                    return [
                      <div
                        key={`${dayIndex}-am`}
                        className={`grid-line ${dayIsToday ? 'today today-left' : ''}`}
                      />,
                      <div
                        key={`${dayIndex}-pm`}
                        className={`grid-line ${dayIsToday ? 'today today-right' : ''}`}
                      />,
                    ];
                  })}
                {view === 'year' &&
                  days.map((month, index) => <div key={index} className="grid-line" />)}
              </div>
              {/* Ligne des événements */}
              <div className="banner-events-row">
                {eventBlocks.map((eventBlock, idx) => {
                  // Trouver les réservations liées à cet événement
                  const linkedReservations = reservations.filter(
                    (r) => r.googleEventId === eventBlock.eventId,
                  );
                  const hasLinkedReservations = linkedReservations.length > 0;
                  // Détecter si le titre contient "RDV" (insensible à la casse)
                  const isRdv = /\brdv\b/i.test(eventBlock.summary);

                  return (
                    <div
                      key={`${eventBlock.eventId}-${idx}`}
                      className={`event-block-span clickable ${hasLinkedReservations ? 'linked' : ''} ${isRdv ? 'rdv-highlight' : ''}`}
                      style={{
                        gridColumn: `${eventBlock.startIndex + 1} / span ${eventBlock.span}`,
                        backgroundColor: eventBlock.color + '40',
                        borderLeft: `3px solid ${eventBlock.color}`,
                      }}
                      title={
                        hasLinkedReservations
                          ? `${eventBlock.summary}${eventBlock.affaire ? ' - ' + eventBlock.affaire : ''}${eventBlock.location ? ' - ' + eventBlock.location : ''}${eventBlock.time ? ' - ' + eventBlock.time : ''}${eventBlock.affaire && attachmentCounts[eventBlock.affaire] ? '\n📎 ' + attachmentCounts[eventBlock.affaire] + ' pièce(s) jointe(s)' : ''}\n\n${linkedReservations.length} réservation(s) liée(s)\nCliquer pour modifier`
                          : `${eventBlock.summary}${eventBlock.affaire ? ' - ' + eventBlock.affaire : ''}${eventBlock.location ? ' - ' + eventBlock.location : ''}${eventBlock.time ? ' - ' + eventBlock.time : ''}${eventBlock.affaire && attachmentCounts[eventBlock.affaire] ? '\n📎 ' + attachmentCounts[eventBlock.affaire] + ' pièce(s) jointe(s)' : ''}\n\nCliquer pour importer une affaire`
                      }
                      onMouseEnter={() => {
                        if (onEventHover && hasLinkedReservations) {
                          onEventHover(eventBlock.eventId);
                        }
                      }}
                      onMouseLeave={() => {
                        if (onEventHover) {
                          onEventHover(null);
                        }
                      }}
                      onClick={() => {
                        handleCellClick(eventBlock.event);
                      }}
                    >
                      <div className="event-content">
                        <span className="event-summary">{capitalizeText(eventBlock.summary)}</span>
                        {hasLinkedReservations && (
                          <span
                            className="event-linked-indicator"
                            title={`${linkedReservations.length} réservation(s) liée(s)`}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M13 8C13 5.79086 11.2091 4 9 4H7C4.79086 4 3 5.79086 3 8C3 10.2091 4.79086 12 7 12H9C11.2091 12 13 10.2091 13 8Z"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                              <path
                                d="M6 8H10"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                            </svg>
                          </span>
                        )}
                        {eventBlock.affaire &&
                          affairesWithAttachments.includes(eventBlock.affaire) && (
                            <span
                              className="event-attachment-indicator"
                              title={`${attachmentCounts[eventBlock.affaire] || ''} pièce(s) jointe(s)`}
                            >
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                              </svg>
                              <span className="attachment-count">
                                {attachmentCounts[eventBlock.affaire]}
                              </span>
                            </span>
                          )}
                        {eventBlock.affaire && (
                          <span
                            className="event-affaire"
                            style={{
                              cursor: onNavigateToAffaire ? 'pointer' : 'default',
                              textDecoration: 'underline',
                            }}
                            onClick={(e) => {
                              if (onNavigateToAffaire) {
                                e.stopPropagation();
                                onNavigateToAffaire(eventBlock.affaire);
                              }
                            }}
                          >
                            {eventBlock.affaire}
                          </span>
                        )}
                        {eventBlock.time && <span className="event-time">{eventBlock.time}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Poignée de redimensionnement */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            width: '100%',
            height: '12px',
            background: 'var(--theme-gradient)',
            cursor: 'ns-resize',
            display: displayMode === 'compact' ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            borderTop: '1px solid var(--theme-border)',
            borderBottom: '2px solid var(--theme-info)',
            transition: 'background 0.2s',
            userSelect: 'none',
            position: 'relative',
            zIndex: 200,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = 'brightness(1.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = '';
          }}
        >
          <div
            style={{
              color: 'var(--theme-text-inverse)',
              fontSize: '12px',
              lineHeight: 1,
              letterSpacing: '-2px',
              fontWeight: 'bold',
              pointerEvents: 'none',
            }}
          >
            ⋮⋮⋮
          </div>
        </div>
      </div>

      {/* Modal de détails d'événement */}
      <EventDetailsModal
        isOpen={eventDetailsOpen}
        onClose={handleCloseEventDetails}
        event={selectedEvent}
        reservations={reservations}
        onRequestEditReservation={onRequestEditReservation}
        onRequestCreateReservation={handleCreateReservationFromEvent}
        onRequestCreateAssignment={handleCreateAssignmentFromEvent}
        onEventCreated={handleOpenAffaireImport}
        onEventUpdated={handleEventUpdated}
        onRequestEditEvent={googleCanWrite ? handleRequestEditEvent : undefined}
        onRequestDeleteEvent={googleCanWrite ? handleDeleteEvent : undefined}
        onReservationsRefresh={onReservationsRefresh}
        currentUser={currentUser}
        activeModule={activeModule}
      />

      {/* Modal de création / édition d'événement Google */}
      {eventFormOpen && (
        <Suspense fallback={<LoadingOverlay />}>
          <GoogleEventFormModal
            isOpen={eventFormOpen}
            onClose={handleCloseEventForm}
            mode={eventFormMode}
            event={eventFormEvent}
            onSave={handleSaveEventForm}
            currentDate={currentDate}
          />
        </Suspense>
      )}

      {/* Modal d'import d'affaires (ouvert depuis le modal de détails) */}
      {modalOpen && (
        <Suspense fallback={<LoadingOverlay />}>
          <AffaireImportModal
            isOpen={modalOpen}
            onClose={handleCloseModal}
            event={selectedEvent}
            onEventCreated={handleEventCreated}
            onEventUpdated={handleEventUpdated}
            onRequestEditReservation={onRequestEditReservation}
          />
        </Suspense>
      )}
    </>
  );
}

export default React.memo(GoogleCalendarBanner);
