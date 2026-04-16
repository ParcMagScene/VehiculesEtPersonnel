import { useMemo, useCallback } from 'react';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  eachMonthOfInterval,
} from 'date-fns';
import { getPeriodTimestamp, formatLocalDate } from '../../utils/dateUtils';
import { STATUS } from '../../constants';

/**
 * Hook encapsulating all computed/memoized calendar data.
 */
export default function useCalendarData({
  view,
  currentDate,
  reservations,
  maintenances,
  vehicles,
  windowWidth,
  reservationLookup: _externalLookup,
}) {
  // Convertir les maintenances programmées en pseudo-réservations
  const maintenancesAsReservations = useMemo(() => {
    return maintenances
      .filter((m) => m.startDate && m.endDate)
      .map((m) => ({
        id: `maint-${m.id}`,
        vehicleId: m.vehicleId,
        date: m.startDate,
        endDate: m.endDate,
        period: 'AM',
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
        startDate: m.startDate,
      }));
  }, [maintenances]);

  const allReservations = useMemo(() => {
    return [...reservations, ...maintenancesAsReservations];
  }, [reservations, maintenancesAsReservations]);

  const days = useMemo(() => {
    if (view === 'day') return [currentDate];
    if (view === 'week') {
      return eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      });
    }
    if (view === 'month') {
      return eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
    }
    return eachMonthOfInterval({ start: startOfYear(currentDate), end: endOfYear(currentDate) });
  }, [view, currentDate]);

  const periods = view === 'year' ? ['M'] : ['AM', 'PM'];

  // Index pré-calculé O(1)
  const reservationLookup = useMemo(() => {
    const lookup = new Map();
    const viewStart = days.length > 0 ? days[0] : null;
    const viewEnd = days.length > 0 ? days[days.length - 1] : null;
    if (!viewStart || !viewEnd) return lookup;

    const viewStartTs = getPeriodTimestamp(viewStart, 'AM');
    const viewEndTs = getPeriodTimestamp(viewEnd, 'PM');
    const currentPeriods = view === 'year' ? ['M'] : ['AM', 'PM'];

    for (const r of allReservations) {
      const resStart = getPeriodTimestamp(r.date, r.period);
      const resEnd = getPeriodTimestamp(r.endDate || r.date, r.endPeriod || r.period);
      if (resEnd < viewStartTs || resStart > viewEndTs) continue;

      for (const day of days) {
        for (const period of currentPeriods) {
          const cellTs = getPeriodTimestamp(day, period);
          if (cellTs >= resStart && cellTs <= resEnd) {
            const key = `${r.vehicleId}-${formatLocalDate(day)}-${period}`;
            const existing = lookup.get(key);
            if (!existing || (r.isMaintenance && !existing.isMaintenance)) {
              lookup.set(key, r);
            }
          }
        }
      }
    }
    return lookup;
  }, [allReservations, days, view]);

  const getMaintenanceConflicts = useCallback(
    (maintenanceBlock) => {
      if (!maintenanceBlock.isMaintenance || !maintenanceBlock.date) return [];
      const newStart = getPeriodTimestamp(maintenanceBlock.date, 'AM');
      const newEnd = getPeriodTimestamp(maintenanceBlock.endDate || maintenanceBlock.date, 'PM');
      const conflicts = [];
      for (const r of reservations) {
        if (String(r.vehicleId) !== String(maintenanceBlock.vehicleId)) continue;
        const existingStart = getPeriodTimestamp(r.date, r.period);
        const existingEnd = getPeriodTimestamp(r.endDate || r.date, r.endPeriod || r.period);
        if (Math.max(newStart, existingStart) <= Math.min(newEnd, existingEnd)) {
          conflicts.push(r);
        }
      }
      return conflicts;
    },
    [reservations],
  );

  const vehicleGroups = useMemo(() => {
    const companyVehicles = vehicles.filter((v) => !v.isLocation);
    const locationVehicles = vehicles.filter((v) => v.isLocation);
    return { companyVehicles, locationVehicles };
  }, [vehicles]);

  const availabilityCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const isOccupied = (vehicleId) => {
      const hasReservation = reservations.some((r) => {
        if (r.vehicleId !== vehicleId) return false;
        const start = r.startDate?.slice(0, 10) || '';
        const end = r.endDate?.slice(0, 10) || start;
        return start <= today && today <= end;
      });
      const hasMaintenance = maintenances.some((m) => {
        if (m.vehicleId !== vehicleId) return false;
        if (m.status === STATUS.COMPLETED) return false;
        const start = m.startDate?.slice(0, 10) || m.date?.slice(0, 10) || '';
        const end = m.endDate?.slice(0, 10) || start;
        return start <= today && today <= end;
      });
      return hasReservation || hasMaintenance;
    };
    const companyAvail = vehicleGroups.companyVehicles.filter((v) => !isOccupied(v.id)).length;
    const locationAvail = vehicleGroups.locationVehicles.filter((v) => !isOccupied(v.id)).length;
    return {
      company: { available: companyAvail, total: vehicleGroups.companyVehicles.length },
      location: { available: locationAvail, total: vehicleGroups.locationVehicles.length },
      allAvailable: companyAvail,
      allTotal: vehicleGroups.companyVehicles.length,
    };
  }, [vehicleGroups, reservations, maintenances]);

  const allVehicleBlocks = useMemo(() => {
    const result = new Map();
    const allVehicles = [...vehicleGroups.companyVehicles, ...vehicleGroups.locationVehicles];
    const timeSlots = [];
    if (view === 'year') {
      days.forEach((monthDate) => timeSlots.push({ day: monthDate, period: 'M' }));
    } else {
      days.forEach((day) => periods.forEach((period) => timeSlots.push({ day, period })));
    }

    for (const vehicle of allVehicles) {
      const blocks = [];
      let currentBlock = null;

      if (view === 'year') {
        timeSlots.forEach((slot, index) => {
          const monthStart = startOfMonth(slot.day);
          const monthEnd = endOfMonth(slot.day);
          const hasReservation = reservations.some((r) => {
            const rDate = new Date(r.date);
            return r.vehicleId === vehicle.id && rDate >= monthStart && rDate <= monthEnd;
          });
          if (hasReservation) {
            if (!currentBlock) {
              currentBlock = { clientName: 'Occupé', startIndex: index, span: 1 };
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
      } else {
        timeSlots.forEach((slot, index) => {
          const key = `${vehicle.id}-${formatLocalDate(slot.day)}-${slot.period}`;
          const reservation = reservationLookup.get(key) || null;
          if (reservation) {
            const currentName = currentBlock
              ? currentBlock.isMaintenance
                ? currentBlock.prestationName
                : currentBlock.clientName
              : null;
            const newName = reservation.isMaintenance
              ? reservation.prestationName
              : reservation.clientName;
            if (
              !currentBlock ||
              currentBlock.id !== reservation.id ||
              currentName !== newName ||
              currentBlock.isMaintenance !== reservation.isMaintenance
            ) {
              if (currentBlock) blocks.push(currentBlock);
              currentBlock = { ...reservation, startIndex: index, span: 1 };
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
      }
      if (currentBlock) blocks.push(currentBlock);
      result.set(vehicle.id, { blocks, timeSlots });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleGroups, days, view, reservationLookup, reservations]);

  const gridColumns = useMemo(() => {
    let minWidth;
    if (view === 'year') {
      minWidth =
        windowWidth <= 480 ? 80 : windowWidth <= 768 ? 100 : windowWidth <= 1024 ? 120 : 150;
      return `repeat(12, minmax(${minWidth}px, 1fr))`;
    }
    if (view === 'day') return `repeat(2, 1fr)`;
    if (view === 'week') {
      minWidth = windowWidth <= 480 ? 55 : windowWidth <= 768 ? 65 : windowWidth <= 1024 ? 80 : 100;
    } else {
      minWidth = windowWidth <= 480 ? 26 : windowWidth <= 768 ? 32 : windowWidth <= 1024 ? 42 : 55;
    }
    return `repeat(${days.length * 2}, minmax(${minWidth}px, 1fr))`;
  }, [view, days.length, windowWidth]);

  const getReservation = useCallback(
    (vehicleId, date, period) => {
      const key = `${vehicleId}-${formatLocalDate(date)}-${period}`;
      return reservationLookup.get(key) || null;
    },
    [reservationLookup],
  );

  return {
    maintenancesAsReservations,
    allReservations,
    days,
    periods,
    reservationLookup,
    getReservation,
    getMaintenanceConflicts,
    vehicleGroups,
    availabilityCount,
    allVehicleBlocks,
    gridColumns,
  };
}
