import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import api from '../utils/api';

export default function useGoogleBannerOrchestration({
  activeModule,
  view,
  currentDate,
  currentUser,
  data,
  handleGoogleEventsChange,
  setActiveModule,
  setShowManagement,
  setShowSettings,
  setQuickReservationSlot,
  setQuickAssignmentSlot,
  setGoogleEventForReservation,
  setHoveredEventId,
  setReservationToEdit,
  openEventDetailsModalRef,
  toast,
}) {
  const scrollSyncSourceRef = useRef(null);
  const scrollSyncFrameRef = useRef(null);
  const scrollSyncLastLeftRef = useRef(0);

  const findScrollers = useCallback(
    () => ({
      grid:
        document.querySelector('.calendar-scroll-area') ||
        document.querySelector('.pp-scroll-area'),
      banner: document.querySelector('.banner-scroll-area'),
    }),
    [],
  );

  const flushScrollSync = useCallback(() => {
    scrollSyncFrameRef.current = null;
    if (document.hidden) return;
    const { grid, banner } = findScrollers();
    if (!grid || !banner) return;
    const left = scrollSyncLastLeftRef.current;
    const source = scrollSyncSourceRef.current;
    if (source === 'banner') {
      if (Math.abs(grid.scrollLeft - left) > 1) {
        grid.scrollLeft = left;
      }
    } else if (source === 'grid') {
      if (Math.abs(banner.scrollLeft - left) > 1) {
        banner.scrollLeft = left;
      }
    }
  }, [findScrollers]);

  const scheduleScrollSync = useCallback(
    (source, left) => {
      scrollSyncSourceRef.current = source;
      scrollSyncLastLeftRef.current = left;
      if (scrollSyncFrameRef.current != null) return;
      scrollSyncFrameRef.current = requestAnimationFrame(flushScrollSync);
    },
    [flushScrollSync],
  );

  const handleBannerScroll = useCallback(
    (scrollLeft) => {
      scheduleScrollSync('banner', scrollLeft);
    },
    [scheduleScrollSync],
  );

  const handleCalendarScroll = useCallback(
    (scrollLeft) => {
      scheduleScrollSync('grid', scrollLeft);
    },
    [scheduleScrollSync],
  );

  const showGoogleBanner = useMemo(
    () => ['vehicles', 'parc', 'google'].includes(activeModule),
    [activeModule],
  );

  useEffect(() => {
    if (!showGoogleBanner) return undefined;
    let attachTimer = null;
    let frameId = null;
    let observer = null;
    let observed = [];

    const realign = () => {
      if (frameId != null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        if (document.hidden) return;
        const { grid, banner } = findScrollers();
        if (!grid || !banner) return;
        if (Math.abs(banner.scrollLeft - grid.scrollLeft) > 1) {
          banner.scrollLeft = grid.scrollLeft;
        }
      });
    };

    const tryAttach = () => {
      const { grid, banner } = findScrollers();
      if (!grid || !banner) {
        attachTimer = setTimeout(tryAttach, 120);
        return;
      }
      observer = new ResizeObserver(realign);
      observer.observe(grid);
      observer.observe(banner);
      observed = [grid, banner];
      realign();
    };
    tryAttach();

    return () => {
      if (attachTimer) clearTimeout(attachTimer);
      if (frameId != null) cancelAnimationFrame(frameId);
      if (observer) {
        observed.forEach((el) => {
          try {
            observer.unobserve(el);
          } catch {
            /* element peut deja etre detache du DOM */
          }
        });
        observer.disconnect();
      }
    };
  }, [showGoogleBanner, view, activeModule, findScrollers]);

  useEffect(
    () => () => {
      if (scrollSyncFrameRef.current != null) {
        cancelAnimationFrame(scrollSyncFrameRef.current);
        scrollSyncFrameRef.current = null;
      }
    },
    [],
  );

  const handleBannerEventClick = useCallback(
    (event) => {
      setGoogleEventForReservation(event);
    },
    [setGoogleEventForReservation],
  );

  const handleBannerRequestViewEvent = useCallback(
    (fn) => {
      openEventDetailsModalRef.current = fn;
    },
    [openEventDetailsModalRef],
  );

  const handleBannerReservationsRefresh = useCallback(async () => {
    try {
      const res = await api.getReservations();
      data.setReservations(res);
    } catch (e) {
      console.error('Erreur rechargement réservations:', e);
    }
  }, [data]);

  const handleBannerNewReservation = useCallback(() => {
    setActiveModule('vehicles');
    setShowManagement(false);
    setShowSettings(false);
    setQuickReservationSlot({
      vehicleId: null,
      date: new Date().toISOString().slice(0, 10),
      period: 'morning',
      endDate: new Date().toISOString().slice(0, 10),
      endPeriod: 'afternoon',
    });
  }, [setActiveModule, setQuickReservationSlot, setShowManagement, setShowSettings]);

  const handleBannerNewAssignment = useCallback(
    (event) => {
      setActiveModule('planning');
      setShowManagement(false);
      setShowSettings(false);
      setQuickAssignmentSlot({
        day: event?.start
          ? new Date(event.start).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        period: 'AM',
        title: event?.summary || '',
        affaire: event?.affaire || '',
      });
    },
    [setActiveModule, setQuickAssignmentSlot, setShowManagement, setShowSettings],
  );

  const handleBannerNewAffaire = useCallback(async () => {
    try {
      const newAffaire = {
        numeroAffaire: `AF${Date.now().toString().slice(-5)}`,
        client: '',
        interlocuteur: '',
        tel: '',
        type: 'Prestation',
        dateDebut: format(new Date(), 'yyyy-MM-dd'),
        dateFin: '',
        adresseLivraison: '',
        description: '',
        devis: '',
        source: 'db',
      };
      await api.createOrUpdateAffaire(newAffaire);
      setActiveModule('affaires');
    } catch (err) {
      console.error('Erreur création affaire:', err);
      toast.error("Erreur lors de la création de l'affaire");
    }
  }, [setActiveModule, toast]);

  const handleBannerNavigateToAffaire = useCallback(
    (affaireNum) => {
      setActiveModule('affaires');
      setShowManagement(false);
      setShowSettings(false);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('emag:navigate-affaire', { detail: { affaireNum } }));
      }, 100);
    },
    [setActiveModule, setShowManagement, setShowSettings],
  );

  const googleBannerProps = useMemo(
    () => ({
      calendarConfig: data.calendarConfig,
      view,
      activeModule,
      currentDate,
      currentUser,
      onScroll: handleBannerScroll,
      onEventClick: handleBannerEventClick,
      onEventsChange: handleGoogleEventsChange,
      clients: data.clients,
      locations: data.locations,
      reservations: data.reservations,
      onEventHover: setHoveredEventId,
      onRequestEditReservation: setReservationToEdit,
      onRequestViewEvent: handleBannerRequestViewEvent,
      onReservationsRefresh: handleBannerReservationsRefresh,
      onNewReservation: handleBannerNewReservation,
      onNewAssignment: handleBannerNewAssignment,
      onNewAffaire: handleBannerNewAffaire,
      onNavigateToAffaire: handleBannerNavigateToAffaire,
    }),
    [
      data.calendarConfig,
      view,
      activeModule,
      currentDate,
      currentUser,
      handleBannerScroll,
      handleBannerEventClick,
      handleGoogleEventsChange,
      data.clients,
      data.locations,
      data.reservations,
      setHoveredEventId,
      setReservationToEdit,
      handleBannerRequestViewEvent,
      handleBannerReservationsRefresh,
      handleBannerNewReservation,
      handleBannerNewAssignment,
      handleBannerNewAffaire,
      handleBannerNavigateToAffaire,
    ],
  );

  return {
    showGoogleBanner,
    handleCalendarScroll,
    googleBannerProps,
  };
}
