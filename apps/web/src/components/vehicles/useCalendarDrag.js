import { useState, useCallback, useEffect, useRef } from 'react';
import { isSameDay } from 'date-fns';
import { getPeriodTimestamp, formatLocalDate } from '../../utils/dateUtils';

/**
 * Hook encapsulating all drag-to-create, resize, and block-drag-to-move interactions.
 */
export default function useCalendarDrag({
  view,
  currentUser,
  days,
  reservations,
  onUpdateReservation,
  onSelectSlot,
  onSelectReservation,
}) {
  // ═══ STATE ═══
  const [dragState, setDragState] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [resizeState, setResizeState] = useState(null);
  const [resizePreview, setResizePreview] = useState(null);
  const [blockDragState, setBlockDragState] = useState(null);
  const [blockDragPreview, setBlockDragPreview] = useState(null);
  const pendingBlockDragRef = useRef(null);
  const reservationsRef = useRef(reservations);
  const lastPositionRef = useRef({ dayIndex: null, period: null });

  useEffect(() => {
    reservationsRef.current = reservations;
  }, [reservations]);

  // ═══ DRAG-TO-CREATE ═══
  const handleSlotMouseDown = (vehicle, date, period, e) => {
    if (blockDragState || pendingBlockDragRef.current) return;
    if (view === 'year') return;

    const existing = reservations.find(
      (r) => r.vehicleId === vehicle.id && isSameDay(new Date(r.date), date) && r.period === period,
    );
    if (existing) {
      onSelectReservation(existing);
      return;
    }

    e.preventDefault();
    setIsDragging(true);
    setDragState({ vehicle, startDay: date, startPeriod: period, endDay: date, endPeriod: period });
  };

  const handleSlotMouseEnter = (vehicle, date, period) => {
    // Activate block-drag if pending and mouse moved to a different slot
    if (pendingBlockDragRef.current) {
      const p = pendingBlockDragRef.current;
      const isSameSlot =
        isSameDay(p.startDay, date) && p.startPeriod === period && p.vehicle.id === vehicle.id;
      if (!isSameSlot) {
        const block = p.block;
        const startDate = new Date(block.date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(block.endDate || block.date);
        endDate.setHours(0, 0, 0, 0);
        setBlockDragState({
          block,
          vehicle: p.vehicle,
          targetVehicle: vehicle,
          anchorDay: p.startDay,
          anchorPeriod: p.startPeriod,
          originalStart: { date: startDate, period: block.period },
          originalEnd: { date: endDate, period: block.endPeriod || block.period },
          currentStart: { date: startDate, period: block.period },
          currentEnd: { date: endDate, period: block.endPeriod || block.period },
        });
        pendingBlockDragRef.current = null;
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
        setBlockDragState((prev) => ({
          ...prev,
          targetVehicle: vehicle,
          currentStart: newStart,
          currentEnd: newEnd,
        }));
        setBlockDragPreview({
          vehicleId: vehicle.id,
          startDate: newStart.date,
          startPeriod: newStart.period,
          endDate: newEnd.date,
          endPeriod: newEnd.period,
        });
        return;
      }
    }
    if (blockDragState) {
      handleBlockDragMove(vehicle, date, period);
      return;
    }
    if (!isDragging || !dragState || dragState.vehicle.id !== vehicle.id) return;
    setDragState({ ...dragState, endDay: date, endPeriod: period });
  };

  const handleSlotMouseUp = () => {
    if (!isDragging || !dragState) return;
    setIsDragging(false);
    onSelectSlot({
      vehicle: dragState.vehicle,
      startDate: dragState.startDay,
      startPeriod: dragState.startPeriod,
      endDate: dragState.endDay,
      endPeriod: dragState.endPeriod,
    });
    setDragState(null);
  };

  // ═══ RESIZE ═══
  const isInResizePreview = (vehicleId, day, period) => {
    if (!resizePreview || resizePreview.vehicleId !== vehicleId) return false;
    let previewStart = getPeriodTimestamp(resizePreview.startDate, resizePreview.startPeriod);
    let previewEnd = getPeriodTimestamp(resizePreview.endDate, resizePreview.endPeriod);
    if (previewStart > previewEnd) [previewStart, previewEnd] = [previewEnd, previewStart];
    const cellTimestamp = getPeriodTimestamp(day, period);
    return cellTimestamp >= previewStart && cellTimestamp <= previewEnd;
  };

  const handleResizeStart = (e, block, edge) => {
    if (view === 'year') return;
    if (!currentUser?.isAdmin) return;
    e.preventDefault();
    e.stopPropagation();

    const initialDate =
      edge === 'start' ? new Date(block.date) : new Date(block.endDate || block.date);
    initialDate.setHours(0, 0, 0, 0);
    const initialPeriod = edge === 'start' ? block.period : block.endPeriod || block.period;
    const startDate = new Date(block.date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(block.endDate || block.date);
    endDate.setHours(0, 0, 0, 0);

    setResizeState({
      reservation: block,
      edge,
      initialDate,
      initialPeriod,
      currentDay: initialDate,
      currentPeriod: initialPeriod,
      originalStartDate: startDate,
      originalStartPeriod: block.period,
      originalEndDate: endDate,
      originalEndPeriod: block.endPeriod || block.period,
    });
    setResizePreview({
      vehicleId: block.vehicleId,
      startDate,
      startPeriod: block.period,
      endDate,
      endPeriod: block.endPeriod || block.period,
    });
  };

  const handleResizeMove = (day, period) => {
    if (!resizeState) return;
    if (
      resizeState.currentDay &&
      isSameDay(resizeState.currentDay, day) &&
      resizeState.currentPeriod === period
    )
      return;

    const {
      edge,
      originalStartDate,
      originalStartPeriod,
      originalEndDate,
      originalEndPeriod,
      reservation,
    } = resizeState;
    const normalizedDay = new Date(day);
    normalizedDay.setHours(0, 0, 0, 0);

    let previewStartDate, previewStartPeriod, previewEndDate, previewEndPeriod;
    if (edge === 'start') {
      previewStartDate = normalizedDay;
      previewStartPeriod = period;
      previewEndDate = originalEndDate;
      previewEndPeriod = originalEndPeriod;
    } else {
      previewStartDate = originalStartDate;
      previewStartPeriod = originalStartPeriod;
      previewEndDate = normalizedDay;
      previewEndPeriod = period;
    }

    setResizePreview({
      vehicleId: reservation.vehicleId,
      startDate: previewStartDate,
      startPeriod: previewStartPeriod,
      endDate: previewEndDate,
      endPeriod: previewEndPeriod,
    });
    setResizeState((prev) => ({ ...prev, currentDay: day, currentPeriod: period }));
  };

  const handleResizeEnd = () => {
    if (!resizeState) return;
    const { reservation, edge, currentDay, currentPeriod, initialDate, initialPeriod } =
      resizeState;
    const normalizedCurrentDay = new Date(currentDay);
    normalizedCurrentDay.setHours(0, 0, 0, 0);
    const hasMoved =
      !isSameDay(initialDate, normalizedCurrentDay) || initialPeriod !== currentPeriod;

    if (!hasMoved) {
      setResizeState(null);
      return;
    }

    const { originalStartDate, originalStartPeriod, originalEndDate, originalEndPeriod } =
      resizeState;
    let newStartDate, newStartPeriod, newEndDate, newEndPeriod;

    if (edge === 'start') {
      newStartDate = normalizedCurrentDay;
      newStartPeriod = currentPeriod;
      newEndDate = originalEndDate;
      newEndPeriod = originalEndPeriod;
      if (
        getPeriodTimestamp(newStartDate, newStartPeriod) >
        getPeriodTimestamp(newEndDate, newEndPeriod)
      ) {
        setResizeState(null);
        setResizePreview(null);
        return;
      }
    } else {
      newStartDate = originalStartDate;
      newStartPeriod = originalStartPeriod;
      newEndDate = normalizedCurrentDay;
      newEndPeriod = currentPeriod;
      if (
        getPeriodTimestamp(newEndDate, newEndPeriod) <
        getPeriodTimestamp(newStartDate, newStartPeriod)
      ) {
        setResizeState(null);
        setResizePreview(null);
        return;
      }
    }

    onUpdateReservation(reservation.id, {
      ...reservation,
      date: formatLocalDate(newStartDate),
      period: newStartPeriod,
      endDate: formatLocalDate(newEndDate),
      endPeriod: newEndPeriod,
    });
    setResizeState(null);
    setResizePreview(null);
  };

  // ═══ BLOCK DRAG-TO-MOVE ═══
  const handleBlockMouseDown = (e, block, vehicle) => {
    if (view === 'year' || e.button !== 0) return;
    if (!currentUser?.isAdmin) return;
    if (block.isMaintenance) return;
    if (
      e.target.closest(
        '.resize-handle, .tournee-link-btn, .tournee-trip-btn, .reservation-trip-btn, .reservation-delete-btn',
      )
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const colWidth = rect.width / block.span;
    const colOffset = Math.max(0, Math.min(block.span - 1, Math.floor(relX / colWidth)));
    const blockStartDate = new Date(block.date);
    blockStartDate.setHours(0, 0, 0, 0);
    const totalHalfDays = (block.period === 'PM' ? 1 : 0) + colOffset;
    const clickDate = new Date(blockStartDate);
    clickDate.setDate(clickDate.getDate() + Math.floor(totalHalfDays / 2));
    const clickPeriod = totalHalfDays % 2 === 0 ? 'AM' : 'PM';
    pendingBlockDragRef.current = { block, vehicle, startDay: clickDate, startPeriod: clickPeriod };
  };

  const handleBlockDragMove = (vehicle, day, period) => {
    if (!blockDragState) return;
    const normalizedDay = new Date(day);
    normalizedDay.setHours(0, 0, 0, 0);
    const origStartTs = getPeriodTimestamp(
      blockDragState.originalStart.date,
      blockDragState.originalStart.period,
    );
    const currentTs = getPeriodTimestamp(normalizedDay, period);
    const anchorTs = getPeriodTimestamp(blockDragState.anchorDay, blockDragState.anchorPeriod);
    const delta = currentTs - anchorTs;
    const origEndTs = getPeriodTimestamp(
      blockDragState.originalEnd.date,
      blockDragState.originalEnd.period,
    );
    const newStartTs = origStartTs + delta;
    const newEndTs = origEndTs + delta;

    const tsToDatePeriod = (ts) => {
      const d = new Date(Math.floor(ts / 2));
      d.setHours(0, 0, 0, 0);
      return { date: d, period: ts % 2 === 0 ? 'AM' : 'PM' };
    };
    const newStart = tsToDatePeriod(newStartTs);
    const newEnd = tsToDatePeriod(newEndTs);

    const targetVehicleId = vehicle.id;
    const hasConflict =
      targetVehicleId !== blockDragState.vehicle.id &&
      reservations.some((r) => {
        if (r.id === blockDragState.block.id) return false;
        if (r.vehicleId !== targetVehicleId) return false;
        const rStartTs = getPeriodTimestamp(
          new Date(r.date || r.startDate),
          r.period || r.startPeriod || 'AM',
        );
        const rEndTs = getPeriodTimestamp(
          new Date(r.endDate || r.date || r.startDate),
          r.endPeriod || r.period || 'PM',
        );
        return newStartTs <= rEndTs && newEndTs >= rStartTs;
      });

    setBlockDragState((prev) => ({
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
    const { block, vehicle, targetVehicle, currentStart, currentEnd, originalStart, hasConflict } =
      blockDragState;
    const hasMoved =
      !isSameDay(originalStart.date, currentStart.date) ||
      originalStart.period !== currentStart.period;
    const hasChangedVehicle = targetVehicle && targetVehicle.id !== vehicle.id;

    if ((hasMoved || hasChangedVehicle) && !hasConflict) {
      const existing = reservations.find((r) => r.id === block.id);
      if (existing) {
        onUpdateReservation(existing.id, {
          ...existing,
          date: formatLocalDate(currentStart.date),
          period: currentStart.period,
          endDate: formatLocalDate(currentEnd.date),
          endPeriod: currentEnd.period,
          ...(hasChangedVehicle ? { vehicleId: targetVehicle.id } : {}),
        });
      }
    }
    setBlockDragState(null);
    setBlockDragPreview(null);
  };

  const isInBlockDragPreview = (vehicleId, day, period) => {
    if (!blockDragPreview || blockDragPreview.vehicleId !== vehicleId) return false;
    let previewStart = getPeriodTimestamp(blockDragPreview.startDate, blockDragPreview.startPeriod);
    let previewEnd = getPeriodTimestamp(blockDragPreview.endDate, blockDragPreview.endPeriod);
    if (previewStart > previewEnd) [previewStart, previewEnd] = [previewEnd, previewStart];
    const cellTs = getPeriodTimestamp(day, period);
    return cellTs >= previewStart && cellTs <= previewEnd;
  };

  // ═══ SLOT CLICK (year view) ═══
  const handleSlotClick = (vehicle, date, period) => {
    if (view !== 'year') return;
    const existing = reservations.find(
      (r) => r.vehicleId === vehicle.id && isSameDay(new Date(r.date), date) && r.period === period,
    );
    if (existing) {
      onSelectReservation(existing);
    } else {
      onSelectSlot({ vehicle, date, period });
    }
  };

  // ═══ DRAG SELECTION CHECK ═══
  const isInDragSelection = useCallback(
    (vehicleId, date, period) => {
      if (!dragState || dragState.vehicle.id !== vehicleId) return false;
      const dragPeriods = view === 'year' ? ['M'] : ['AM', 'PM'];
      const allSlots = [];
      days.forEach((day) => {
        dragPeriods.forEach((p) => {
          allSlots.push({ day, period: p });
        });
      });
      const startIndex = allSlots.findIndex(
        (s) => isSameDay(s.day, dragState.startDay) && s.period === dragState.startPeriod,
      );
      const endIndex = allSlots.findIndex(
        (s) => isSameDay(s.day, dragState.endDay) && s.period === dragState.endPeriod,
      );
      const currentIndex = allSlots.findIndex((s) => isSameDay(s.day, date) && s.period === period);
      if (startIndex === -1 || endIndex === -1 || currentIndex === -1) return false;
      const minIndex = Math.min(startIndex, endIndex);
      const maxIndex = Math.max(startIndex, endIndex);
      return currentIndex >= minIndex && currentIndex <= maxIndex;
    },
    [dragState, days, view],
  );

  // ═══ GLOBAL MOUSE HANDLERS ═══
  const handleGlobalMouseMove = (e) => {
    if (!resizeState) return;
    const grid = document.querySelector('.calendar-grid');
    if (!grid) return;
    const gridRect = grid.getBoundingClientRect();
    const relativeX = e.clientX - gridRect.left;
    const periodsPerDay = view === 'year' ? 1 : 2;
    const totalColumns = days.length * periodsPerDay;
    const columnWidth = gridRect.width / totalColumns;
    const columnIndex = Math.floor(relativeX / columnWidth);
    const dayIndex = Math.floor(columnIndex / periodsPerDay);
    const periodIndex = columnIndex % periodsPerDay;
    const period = periodsPerDay === 1 ? 'M' : periodIndex === 0 ? 'AM' : 'PM';
    if (dayIndex < 0 || dayIndex >= days.length) return;
    if (lastPositionRef.current.dayIndex === dayIndex && lastPositionRef.current.period === period)
      return;
    lastPositionRef.current = { dayIndex, period };
    handleResizeMove(days[dayIndex], period);
  };

  const handleGlobalMouseUp = () => {
    if (resizeState) {
      handleResizeEnd();
      lastPositionRef.current = { dayIndex: null, period: null };
    }
    setResizePreview(null);
  };

  // ═══ GLOBAL MOUSEUP (document-level for drag/resize cleanup) ═══
  useEffect(() => {
    const onDocumentMouseUp = () => {
      if (pendingBlockDragRef.current) {
        const { block } = pendingBlockDragRef.current;
        pendingBlockDragRef.current = null;
        if (!block.isMaintenance) {
          const existing = reservationsRef.current.find((r) => r.id === block.id);
          if (existing) onSelectReservation(existing);
        }
        return;
      }
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
    document.addEventListener('mouseup', onDocumentMouseUp);
    return () => document.removeEventListener('mouseup', onDocumentMouseUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, dragState, resizeState, blockDragState]);

  return {
    dragState,
    isDragging,
    resizeState,
    resizePreview,
    blockDragState,
    blockDragPreview,
    pendingBlockDragRef,
    handleSlotMouseDown,
    handleSlotMouseEnter,
    handleSlotMouseUp,
    isInResizePreview,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
    handleBlockMouseDown,
    handleBlockDragMove,
    handleBlockDragEnd,
    isInBlockDragPreview,
    isInDragSelection,
    handleSlotClick,
    handleGlobalMouseMove,
    handleGlobalMouseUp,
  };
}
