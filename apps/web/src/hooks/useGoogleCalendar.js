import { useState, useRef, useCallback, useMemo } from 'react';
import api from '../utils/api';

/**
 * Hook gérant la synchronisation des événements Google Calendar
 * et la détection automatique des numéros d'affaire. Extrait d'App.jsx.
 */
export function useGoogleCalendar() {
  const [googleEvents, setGoogleEvents] = useState([]);
  const allGoogleEventsRef = useRef(new Map());
  const syncedGoogleEventIdsRef = useRef(new Set());

  const handleGoogleEventsChange = useCallback((newEvents) => {
    setGoogleEvents(newEvents);
    if (newEvents && newEvents.length > 0) {
      newEvents.forEach((ev) => {
        if (ev.id) allGoogleEventsRef.current.set(ev.id, ev);
      });

      // Sync automatique : détecter les events avec numéro d'affaire non encore traités
      const affaireRegex = /\baf\s*\d{3,}\b/i;
      const eventsToSync = newEvents.filter(
        (ev) =>
          ev.id &&
          !syncedGoogleEventIdsRef.current.has(ev.id) &&
          affaireRegex.test(ev.summary || ev.title || ''),
      );

      if (eventsToSync.length > 0) {
        eventsToSync.forEach((ev) => syncedGoogleEventIdsRef.current.add(ev.id));

        api
          .syncGoogleEventsToAffaires(eventsToSync)
          .then(() => {})
          .catch((err) => {
            console.warn('⚠️ Sync affaires/Google échouée:', err);
            eventsToSync.forEach((ev) => syncedGoogleEventIdsRef.current.delete(ev.id));
          });
      }
    }
  }, []);

  const allGoogleEvents = useMemo(() => {
    return Array.from(allGoogleEventsRef.current.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleEvents]);

  return {
    googleEvents,
    allGoogleEvents,
    handleGoogleEventsChange,
  };
}
