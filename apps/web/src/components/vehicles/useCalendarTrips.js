import { useCallback, useEffect, useState } from 'react';

import api from '../../utils/api';
import { loadFromIndexedDB } from '../../utils/indexedDB';
import { transformTripSnake } from './calendarUtils';

/**
 * Hook encapsulating trip modal state, handlers, and config/preloading effects.
 */
export default function useCalendarTrips({
  vehicles,
  googleEvents,
  reservations,
  googleEvent: _googleEvent,
}) {
  const [calendarTripModal, setCalendarTripModal] = useState(null);
  const [calendarTripCache, setCalendarTripCache] = useState({});
  const [calendarGoogleMapsApiKey, setCalendarGoogleMapsApiKey] = useState('');
  const [calendarCompanyAddress, setCalendarCompanyAddress] = useState('');

  // Charger les configs Google Maps au montage
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
  const fetchTripData = useCallback(
    async (reservationId) => {
      if (calendarTripCache[reservationId]) return calendarTripCache[reservationId];
      try {
        const data = await api.getTripDetails(reservationId);
        const trips = Array.isArray(data) ? data : data.tripDetails || [];
        setCalendarTripCache((prev) => ({ ...prev, [reservationId]: trips }));
        return trips;
      } catch (err) {
        console.error('Erreur fetch trip data:', err);
      }
      return [];
    },
    [calendarTripCache],
  );

  // Ouvrir le TripDetailsModal depuis le calendrier
  const handleOpenTripFromCalendar = useCallback(
    async (block, eventIds, mode) => {
      const trips = await fetchTripData(block.id);
      const vehicle = vehicles.find((v) => v.id === block.vehicleId);

      const findOrCreateEvent = (eid) => {
        const found = googleEvents.find((e) => e.id === eid);
        if (found) return found;
        return {
          id: eid,
          summary: block.affaire || block.clientName || 'Événement',
          affaire: block.affaire,
          start: { dateTime: block.startDate || block.date },
          end: { dateTime: block.endDate || block.date },
        };
      };

      if (mode === 'combined' && eventIds.length > 1) {
        const combinedEvents = eventIds
          .map((eid) => {
            const event = findOrCreateEvent(eid);
            const td = trips.find((t) => t.event_id === eid);
            return { event, tripDetail: td ? transformTripSnake(td) : undefined };
          })
          .filter((ce) => ce.event);
        if (combinedEvents.length > 0) {
          setCalendarTripModal({
            reservation: block,
            event: combinedEvents[0].event,
            tripDetail: combinedEvents[0].tripDetail,
            combinedEvents: combinedEvents.length > 1 ? combinedEvents : null,
            vehicle,
          });
        }
      } else {
        const eid = eventIds[0];
        const event = findOrCreateEvent(eid);
        const td = trips.find((t) => t.event_id === eid);
        if (event) {
          setCalendarTripModal({
            reservation: block,
            event,
            tripDetail: td ? transformTripSnake(td) : undefined,
            combinedEvents: null,
            vehicle,
          });
        }
      }
    },
    [fetchTripData, vehicles, googleEvents],
  );

  // Handler de sauvegarde trip
  const handleSaveTripFromCalendar = useCallback(
    async (tripFormData) => {
      if (!calendarTripModal) return null;
      try {
        const savedData = await api.saveTripDetails({
          reservationId: calendarTripModal.reservation.id,
          eventId: calendarTripModal.event.id,
          eventOrder: 0,
          ...tripFormData,
        });
        setCalendarTripCache((prev) => {
          const updated = { ...prev };
          delete updated[calendarTripModal.reservation.id];
          return updated;
        });
        return savedData;
      } catch (err) {
        console.error('Erreur sauvegarde trip:', err);
      }
      return null;
    },
    [calendarTripModal],
  );

  // Callback après liaison de trajets : invalider le cache et re-fetcher
  const handleTripLinked = useCallback((reservationId) => {
    setCalendarTripCache((prev) => {
      const u = { ...prev };
      delete u[reservationId];
      return u;
    });
    api
      .getTripDetails(reservationId)
      .then((data) => {
        const trips = Array.isArray(data) ? data : data.tripDetails || [];
        setCalendarTripCache((prev) => ({ ...prev, [reservationId]: trips }));
      })
      .catch(() => {});
  }, []);

  // Pré-charger les trip data pour les réservations tournée visibles
  useEffect(() => {
    if (!reservations || !Array.isArray(reservations)) return;
    let aborted = false;
    const tourneeIds = reservations
      .filter((r) => (r.isTournee || r.is_tournee) && r.id && !calendarTripCache[r.id])
      .map((r) => r.id);
    const singleEventIds = reservations
      .filter(
        (r) =>
          !(r.isTournee || r.is_tournee) &&
          (r.googleEventId || r.google_event_id) &&
          r.id &&
          !calendarTripCache[r.id],
      )
      .map((r) => r.id);
    const allIds = [...new Set([...tourneeIds, ...singleEventIds])];
    const loadBatch = async (ids) => {
      const BATCH_SIZE = 5;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        if (aborted) return;
        const batch = ids.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map((id) =>
            api
              .getTripDetails(id)
              .then((data) => {
                if (aborted) return;
                const trips = Array.isArray(data) ? data : data.tripDetails || [];
                setCalendarTripCache((prev) => ({ ...prev, [id]: trips }));
              })
              .catch(() => {}),
          ),
        );
        if (i + BATCH_SIZE < ids.length) await new Promise((r) => setTimeout(r, 100));
      }
    };
    if (allIds.length > 0) loadBatch(allIds);
    return () => {
      aborted = true;
    };
  }, [reservations]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    calendarTripModal,
    setCalendarTripModal,
    calendarTripCache,
    calendarGoogleMapsApiKey,
    calendarCompanyAddress,
    handleOpenTripFromCalendar,
    handleSaveTripFromCalendar,
    handleTripLinked,
  };
}
